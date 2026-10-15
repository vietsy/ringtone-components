import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { findAccount, organisationName } from "@/lib/mock/backend/accounts";
import { sessionId as newSessionId } from "@/lib/mock/backend/ids";
import { now } from "@/lib/mock/backend/clock";
import { forgetSession, sessions, type MockAccount, type MockSession } from "@/lib/mock/backend/store";
import { routes } from "@/lib/routes";
import { usesMockData } from "./source";

/**
 * Who is signed in: the data access layer every page, seam and action asks before it reads or acts. The
 * session comes from RightOne ID; until it is wired, the mock backend plays RightOne ID, and outside mock data
 * there is nobody, so a page that needs someone sends the reader to sign in.
 *
 * Checked in the page and in the data layer, never in a layout: a layout does not run again on a client-side
 * navigation, so a check there would not hold for every route.
 */

const COOKIE = "r1-session";

/** The session in this request, read once per render pass. */
export const currentSession = cache(async (): Promise<MockSession | null> => {
  if (!usesMockData()) return null;
  const id = (await cookies()).get(COOKIE)?.value;
  return id === undefined ? null : (sessions().get(id) ?? null);
});

export interface Principal {
  sessionId: string;
  /** The account's name, as the shell shows it. */
  account: string;
  /** The organisation the principal acts for. */
  party: string;
  organisation: string;
}

export interface Inspector {
  sessionId: string;
  account: string;
}

/** The administrator of a rights organisation (ACT-CMO-ADM), acting for their own organisation only. */
export interface CmoAdministrator {
  sessionId: string;
  account: string;
  /** RightOne ID's id of the organisation, the key every CMO read and act is scoped to. */
  organisation: string;
  organisationName: string;
}

/** The premises principal, once they have chosen the organisation they act for; otherwise nobody. */
export async function currentPrincipal(): Promise<Principal | null> {
  const session = await currentSession();
  if (session?.role !== "principal" || session.organisation === null) return null;
  const account = findAccount(session.email);
  if (account === null) return null;
  return { sessionId: session.id, account: account.name, party: organisationName(session.organisation), organisation: session.organisation };
}

export async function currentInspector(): Promise<Inspector | null> {
  const session = await currentSession();
  if (session?.role !== "inspector") return null;
  const account = findAccount(session.email);
  return account === null ? null : { sessionId: session.id, account: account.name };
}

/**
 * The premises principal, or the way to become one: sign in, then choose the organisation. A page of the
 * premises portal calls this first, so nothing of a premises is read for someone who may not see it.
 */
export async function requirePrincipal(): Promise<Principal> {
  const session = await currentSession();
  if (session?.role === "principal" && session.organisation === null) redirect(routes.chooseOrganisation());
  const principal = await currentPrincipal();
  if (principal === null) redirect(routes.signIn());
  return principal;
}

/** The inspector, or the sign-in page. A page of the field client or the inspection console calls this first. */
export async function requireInspector(): Promise<Inspector> {
  const inspector = await currentInspector();
  if (inspector === null) redirect(routes.signIn());
  return inspector;
}

export async function currentCmo(): Promise<CmoAdministrator | null> {
  const session = await currentSession();
  if (session?.role !== "cmo" || session.organisation === null) return null;
  const account = findAccount(session.email);
  if (account === null) return null;
  return { sessionId: session.id, account: account.name, organisation: session.organisation, organisationName: organisationName(session.organisation) };
}

/**
 * The rights organisation's administrator, or the sign-in page. Every page of the organisation portal calls
 * this first; every CMO read is then scoped to `organisation`, so one organisation never reads another's.
 */
export async function requireCmo(): Promise<CmoAdministrator> {
  const cmo = await currentCmo();
  if (cmo === null) redirect(routes.signIn());
  return cmo;
}

/** Signs the account in: a new session and its cookie. Called from a server action only. */
export async function startSession(account: MockAccount): Promise<MockSession> {
  // An organisation's administrator belongs to that one organisation, so there is nothing to choose.
  const own = account.role === "cmo" && account.organisations.length === 1 ? (account.organisations[0] ?? null) : null;
  const session: MockSession = { id: newSessionId(), email: account.email, role: account.role, organisation: own, startedAt: now() };
  sessions().set(session.id, session);
  (await cookies()).set(COOKIE, session.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return session;
}

/** The organisation the signed-in principal acts for from now on. Called from a server action only. */
export async function actFor(organisation: string): Promise<void> {
  const session = await currentSession();
  if (session !== null) session.organisation = organisation;
}

/** Signs out: the session and everything done in it are forgotten, and the cookie goes. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id !== undefined) forgetSession(id);
  store.delete(COOKIE);
}
