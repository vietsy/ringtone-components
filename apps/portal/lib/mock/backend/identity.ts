import { randomUUID } from "node:crypto";
import type { OrganisationChoice, RegistrationAttempt, SignInAttempt } from "@/lib/api/identity";
import { accountBook, findAccount, ORGANISATIONS } from "./accounts";
import { now } from "./clock";
import type { MockAccount, MockSession } from "./store";

/**
 * RightOne ID's behaviour, played by the mock backend: the answers its sign-in, organisation choice,
 * registration and confirmation give, from the accounts it holds. The pages draw these answers exactly as
 * they draw the canvas's states.
 */

/** Five wrong passwords lock the account for twelve minutes, as the canvas's locked state reads (10:15 to 10:27). */
const ATTEMPTS_BEFORE_LOCK = 5;
const LOCK_MINUTES = 12;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Passwords found in public breach lists; the canvas's breached example among them. */
const BREACHED = new Set(["Password@2026", "Password@123", "Matkhau@2026", "Abc@12345678"]);

export interface SignInResult {
  attempt: SignInAttempt;
  /** The account signed in, when the attempt succeeded. */
  account: MockAccount | null;
}

export function attemptSignIn(email: string, password: string, remember: boolean): SignInResult {
  const base: SignInAttempt = { email, password: "", remember, emailError: null, passwordError: null, outcome: null, reauth: false };
  const emailError = email === "" ? "required" : EMAIL.test(email) ? null : "invalid";
  const passwordError = password === "" ? "required" : null;
  if (emailError !== null || passwordError !== null) return { attempt: { ...base, emailError, passwordError }, account: null };

  const account = findAccount(email);
  const at = now();
  if (account !== null && account.lockedUntil !== null && account.lockedUntil > at) {
    return { attempt: { ...base, outcome: { kind: "locked", answeredAt: at, lockedUntil: account.lockedUntil } }, account: null };
  }
  // A wrong password and an unknown address read the same: RightOne ID never says which addresses exist.
  if (account?.password !== password) {
    if (account !== null) {
      account.failedAttempts += 1;
      if (account.failedAttempts >= ATTEMPTS_BEFORE_LOCK) {
        account.failedAttempts = 0;
        account.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
        return { attempt: { ...base, outcome: { kind: "locked", answeredAt: at, lockedUntil: account.lockedUntil } }, account: null };
      }
    }
    return { attempt: { ...base, outcome: { kind: "invalid" } }, account: null };
  }
  if (account.state === "suspended") return { attempt: { ...base, outcome: { kind: "suspended" } }, account: null };
  if (account.state === "unconfirmed") return { attempt: { ...base, outcome: { kind: "unconfirmed" } }, account: null };
  account.failedAttempts = 0;
  account.lockedUntil = null;
  return { attempt: base, account };
}

/** The organisations the signed-in account belongs to; `submitted` and `refused` describe the last choice. */
export function organisationChoice(session: MockSession, submitted: string | null): OrganisationChoice {
  const account = findAccount(session.email);
  const mine = ORGANISATIONS.filter((organisation) => account?.organisations.includes(organisation.id) === true);
  const refused = submitted !== null && mine.find((organisation) => organisation.id === submitted)?.served !== true;
  return { organisations: mine.map(({ id, name, slug }) => ({ id, name, slug })), submitted, refused };
}

/** Whether the account may act for the organisation in RightOne: it belongs to it and RightOne serves it. */
export function mayActFor(session: MockSession, organisation: string): boolean {
  return !organisationChoice(session, organisation).refused;
}

/** Tokens of the confirmation links sent, by token: the address each confirms. */
const holder = globalThis as typeof globalThis & { __rightoneMockConfirmations?: Map<string, string> };
const confirmations = (): Map<string, string> => (holder.__rightoneMockConfirmations ??= new Map());

export interface RegistrationResult {
  attempt: RegistrationAttempt;
  /** The confirmation link's token, when one was sent. */
  token: string | null;
}

/**
 * Registration. The answer is "sent" whether or not the address already has an account, so registering never
 * tells anyone which addresses exist; a new address gets an unconfirmed account and a confirmation link.
 */
export function register(fullName: string, email: string, password: string, confirm: string): RegistrationResult {
  const attempt: RegistrationAttempt = {
    fullName,
    email,
    password: "",
    confirm: "",
    nameError: fullName === "" ? "required" : null,
    passwordError: BREACHED.has(password) ? "breached" : null,
    confirmError: password !== confirm ? "mismatch" : null,
    outcome: null,
  };
  if (attempt.nameError !== null || attempt.passwordError !== null || attempt.confirmError !== null || !EMAIL.test(email)) {
    return { attempt, token: null };
  }
  const address = email.trim().toLowerCase();
  const book = accountBook();
  let token: string | null = null;
  if (!book.has(address)) {
    book.set(address, { email: address, name: fullName, role: "principal", password, state: "unconfirmed", organisations: [], failedAttempts: 0, lockedUntil: null });
  }
  if (book.get(address)?.state === "unconfirmed") {
    token = randomUUID();
    confirmations().set(token, address);
  }
  return { attempt: { ...attempt, outcome: "sent" }, token };
}

/** Following a confirmation link: the account is confirmed once; a used or unknown link is a bad link. */
export function confirmEmail(token: string): "confirmed" | "bad-link" {
  const address = confirmations().get(token);
  const account = address === undefined ? null : findAccount(address);
  if (account === null) return "bad-link";
  confirmations().delete(token);
  account.state = "active";
  return "confirmed";
}
