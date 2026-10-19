import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { findAccount, organisationName } from "@/lib/mock/backend/accounts";
import { actingAs } from "@/lib/mock/backend/parties";
import { sessionId as newSessionId } from "@/lib/mock/backend/ids";
import { now } from "@/lib/mock/backend/clock";
import { PUBLIC_SESSION, forgetSession, resetWorld, sessions, type MockAccount, type MockSession, type StaffRole } from "@/lib/mock/backend/store";
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
/** The browser's world: the copy of the data everyone signing in from this browser acts in (store.ts). */
const WORLD_COOKIE = "r1-world";
const WORLD_LIFETIME_S = 60 * 60 * 24 * 30;

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
  /**
   * Who the party register says the person is for that party: its principal (ACT-PRE-PRI), or a delegate (ACT-PRE-DEL)
   * whose authority decides, premises by premises and act by act, what they may read and do (DR-201).
   */
  actor: "PRINCIPAL" | "DELEGATE";
  /** The person of the party register the account is linked to (PPN-PTY-), which every decision is asked about. */
  person: string;
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

/**
 * The premises actor, once they have chosen the organisation they act for, as the party register knows them: its
 * principal, or a delegate holding an authority in force. A person the register holds no authority of for that
 * organisation acts for it as nobody.
 */
export async function currentPrincipal(): Promise<Principal | null> {
  const session = await currentSession();
  if (session?.role !== "principal" || session.organisation === null) return null;
  const account = findAccount(session.email);
  if (account === null) return null;
  const acting = actingAs(session.id);
  if (acting === null) return null;
  return { sessionId: session.id, account: account.name, party: organisationName(session.organisation), organisation: session.organisation, actor: acting.actor, person: acting.person };
}

export async function currentInspector(): Promise<Inspector | null> {
  const session = await currentSession();
  if (session?.role !== "inspector") return null;
  const account = findAccount(session.email);
  return account === null ? null : { sessionId: session.id, account: account.name };
}

/**
 * The premises actor - the principal or a delegate - or the way to become one: sign in, then choose the organisation.
 * A page of the premises portal calls this first, so nothing of a premises is read for someone who may not see it; a
 * person who holds no authority for the organisation chosen is sent back to choose another. Each read and act then
 * asks the party register what this person may do at each premises (`authorityToActAt`), server side.
 */
export async function requirePrincipal(): Promise<Principal> {
  const session = await currentSession();
  if (session?.role === "principal" && session.organisation === null) redirect(routes.chooseOrganisation());
  const principal = await currentPrincipal();
  if (principal === null) redirect(session?.role === "principal" ? routes.chooseOrganisation() : routes.signIn());
  return principal;
}

/**
 * The party's principal (ACT-PRE-PRI), for the acts no delegate holds - granting, amending and revoking authorities.
 * A delegate is sent to their premises portfolio, which lists what their authority does cover.
 */
export async function requirePartyPrincipal(): Promise<Principal> {
  const principal = await requirePrincipal();
  if (principal.actor !== "PRINCIPAL") redirect(routes.premisesPortfolio());
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

/** An artist (ACT-ART), acting for themselves: every read of the artist portal is of their own works and record. */
export interface Artist {
  sessionId: string;
  /** The account's name, as the shell shows it. */
  account: string;
  /** RightOne ID's address for the account, the key each family's artist record is kept under. */
  email: string;
}

export async function currentArtist(): Promise<Artist | null> {
  const session = await currentSession();
  if (session?.role !== "artist") return null;
  const account = findAccount(session.email);
  return account === null ? null : { sessionId: session.id, account: account.name, email: account.email };
}

/** The artist, or the sign-in page. Every page of the artist portal calls this first. */
export async function requireArtist(): Promise<Artist> {
  const artist = await currentArtist();
  if (artist === null) redirect(routes.signIn());
  return artist;
}

/** A member of the gateway's staff, with the spec roles that decide what they may open and do. */
export interface Staff {
  sessionId: string;
  account: string;
  email: string;
  /** As the shell and a record's attribution show it: "Cán bộ vận hành". */
  position: string;
  roles: readonly StaffRole[];
}

export async function currentStaff(): Promise<Staff | null> {
  const session = await currentSession();
  if (session?.role !== "staff") return null;
  const account = findAccount(session.email);
  if (account === null) return null;
  return { sessionId: session.id, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

export const holds = (staff: Staff, ...roles: readonly StaffRole[]): boolean => roles.some((role) => staff.roles.includes(role));

/**
 * A member of staff, or the sign-in page. With roles given, a member holding none of them is sent to the
 * operations landing, which offers only the workspaces their roles open; each page then decides, per act, what
 * the roles it holds allow (an approver who prepared a record still may not approve it).
 */
export async function requireStaff(...anyOf: readonly StaffRole[]): Promise<Staff> {
  const staff = await currentStaff();
  if (staff === null) redirect(routes.signIn());
  if (anyOf.length > 0 && !holds(staff, ...anyOf)) redirect(routes.ops());
  return staff;
}

/**
 * The world this browser acts in, for a page read without a session (a public page): the browser's world once
 * someone has signed in from it, the seed otherwise.
 */
export async function currentWorld(): Promise<string> {
  if (!usesMockData()) return PUBLIC_SESSION;
  return (await cookies()).get(WORLD_COOKIE)?.value ?? PUBLIC_SESSION;
}

/**
 * The world an act without a session writes to (a case raised without an account). A browser that has never
 * signed in reads the seed (`PUBLIC_SESSION`), and an act there would be every such browser's; so the first such act
 * gives the browser a world of its own, under the cookie a later sign-in keeps. Called from a server action only.
 */
export async function worldForAct(): Promise<string> {
  const world = await currentWorld();
  if (world !== PUBLIC_SESSION) return world;
  const made = newSessionId();
  (await cookies()).set(WORLD_COOKIE, made, { httpOnly: true, sameSite: "lax", path: "/", maxAge: WORLD_LIFETIME_S });
  return made;
}

/** Signs the account in: a new session and its cookie, in the browser's world. Called from a server action only. */
export async function startSession(account: MockAccount): Promise<MockSession> {
  const store = await cookies();
  // An organisation's administrator belongs to that one organisation, so there is nothing to choose.
  const own = account.role === "cmo" && account.organisations.length === 1 ? (account.organisations[0] ?? null) : null;
  const world = store.get(WORLD_COOKIE)?.value ?? newSessionId();
  const session: MockSession = { id: newSessionId(), email: account.email, role: account.role, organisation: own, world, startedAt: now() };
  sessions().set(session.id, session);
  store.set(COOKIE, session.id, { httpOnly: true, sameSite: "lax", path: "/" });
  store.set(WORLD_COOKIE, world, { httpOnly: true, sameSite: "lax", path: "/", maxAge: WORLD_LIFETIME_S });
  return session;
}

/** The organisation the signed-in principal acts for from now on. Called from a server action only. */
export async function actFor(organisation: string): Promise<void> {
  const session = await currentSession();
  if (session !== null) session.organisation = organisation;
}

/** Signs out: the session ends and its cookie goes; the world keeps what was done, for whoever signs in next. */
export async function endSession(): Promise<void> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id !== undefined) forgetSession(id);
  store.delete(COOKIE);
}

/** Returns this browser's world to the seed and signs out. Called from the reset route only. */
export async function resetData(): Promise<void> {
  const world = (await cookies()).get(WORLD_COOKIE)?.value;
  if (world !== undefined) resetWorld(world);
  await endSession();
}
