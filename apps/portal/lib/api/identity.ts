import type { LoadOutcome } from "@rightone/ui";
import {
  mockEmailConfirmation,
  mockOrganisationChoice,
  mockRegistrationAttempt,
  mockSignInAttempt,
  type Rid01View,
  type Rid04View,
  type Rid07View,
  type Rid08View,
} from "@/lib/mock/identity";
import { attemptSignIn, confirmEmail, mayActFor, organisationChoice, register } from "@/lib/mock/backend/identity";
import type { Role } from "@/lib/mock/backend/store";
import { actFor, currentSession, startSession } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/**
 * RightOne ID (id.rightone.vn) is a separate product with its own pages. The portal never calls it for
 * these: a sign-in is a redirect to RightOne ID and back. The functions here feed the demonstration's
 * stand-ins for those pages (app/(id)), so without mock data they return a failure like every other seam.
 */

/** A sign-in attempt as RightOne ID answers it, with what the reader typed drawn back into the form. */
export interface SignInAttempt {
  email: string;
  password: string;
  remember: boolean;
  /** Checks made before the password is tried. */
  emailError: "required" | "invalid" | null;
  passwordError: "required" | null;
  /** RightOne ID's answer; null while the attempt is being made or when a field check stopped it. */
  outcome:
    | { kind: "invalid" }
    | { kind: "locked"; answeredAt: string; lockedUntil: string }
    | { kind: "suspended" }
    | { kind: "unconfirmed" }
    | { kind: "session-expired" }
    | { kind: "external-failed" }
    | { kind: "external-unverified" }
    | { kind: "account-deleted" }
    | null;
  /** The application asked for a fresh sign-in, the last one being older than it allows. */
  reauth: boolean;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
}

/** The organisations the account belongs to, and the one submitted when the page answers a submit. */
export interface OrganisationChoice {
  organisations: readonly Organisation[];
  submitted: string | null;
  /** RightOne ID refused the submitted organisation: the account no longer belongs to it, or it is inactive. */
  refused: boolean;
}

export interface RegistrationAttempt {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  nameError: "required" | null;
  /** The password appears in public breach corpora. */
  passwordError: "breached" | null;
  confirmError: "mismatch" | null;
  /** "sent": the confirmation link went out if the address is valid; RightOne ID never says whether it is. */
  outcome: "sent" | null;
}

export interface EmailConfirmation {
  outcome: "confirmed" | "failed" | "bad-link";
}

export function loadSignInAttempt(view: Exclude<Rid01View, "form">): Promise<LoadOutcome<SignInAttempt>> {
  return Promise.resolve(usesMockData() ? mockSignInAttempt(view) : NOT_CONFIGURED);
}

export function loadOrganisationChoice(view: Exclude<Rid04View, "loading">): Promise<LoadOutcome<OrganisationChoice>> {
  return Promise.resolve(usesMockData() ? mockOrganisationChoice(view) : NOT_CONFIGURED);
}

/** Registration closed (REGISTRATION_CLOSED) is a refusal with its code, never a form that cannot be sent. */
export function loadRegistrationAttempt(view: Exclude<Rid07View, "form">): Promise<LoadOutcome<RegistrationAttempt>> {
  return Promise.resolve(usesMockData() ? mockRegistrationAttempt(view) : NOT_CONFIGURED);
}

export function loadEmailConfirmation(view: Rid08View): Promise<LoadOutcome<EmailConfirmation>> {
  return Promise.resolve(usesMockData() ? mockEmailConfirmation(view) : NOT_CONFIGURED);
}

// ---------------------------------------------------------------- what a person does

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });

/**
 * Sign in with an address and a password. Signed in, the session starts and the account's role says where
 * the reader goes next; refused, the attempt says why, as SCR-RID-01 draws it.
 */
export async function signInWithPassword(
  email: string,
  password: string,
  remember: boolean,
): Promise<LoadOutcome<{ attempt: SignInAttempt; role: Role | null }>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  const result = attemptSignIn(email, password, remember);
  if (result.account !== null) await startSession(result.account);
  return ok({ attempt: result.attempt, role: result.account?.role ?? null });
}

/** The organisations the signed-in reader may choose from, and how their last choice was answered. */
export async function loadSessionOrganisations(submitted: string | null): Promise<LoadOutcome<OrganisationChoice> | null> {
  if (!usesMockData()) return NOT_CONFIGURED;
  const session = await currentSession();
  return session === null ? null : ok(organisationChoice(session, submitted));
}

/** Act for an organisation; refused when the account does not belong to it or RightOne does not serve it. */
export async function chooseOrganisation(organisation: string): Promise<LoadOutcome<{ accepted: boolean }>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  const session = await currentSession();
  if (session === null || !mayActFor(session, organisation)) return ok({ accepted: false });
  await actFor(organisation);
  return ok({ accepted: true });
}

/**
 * Register. RightOne ID mails a confirmation link; the mock backend has no mail, so it writes the link to the
 * server's log, where whoever runs the portal can follow it, as a development mail catcher would show it.
 */
export function registerAccount(
  fullName: string,
  email: string,
  password: string,
  confirm: string,
): LoadOutcome<{ attempt: RegistrationAttempt; token: string | null }> {
  if (!usesMockData()) return NOT_CONFIGURED;
  return ok(register(fullName, email, password, confirm));
}

/** Follow a confirmation link. */
export function confirmEmailLink(token: string | null): LoadOutcome<EmailConfirmation> {
  if (!usesMockData()) return NOT_CONFIGURED;
  return ok({ outcome: token === null ? "bad-link" : confirmEmail(token) });
}
