/**
 * The mock backend's memory: what the API will hold, kept in the server process while the portal runs on
 * mock data. Accounts and sessions are process-wide, as RightOne ID's would be. The families' tables belong
 * to a world: one browser's copy of the canvas's data, seeded the first time a family reads it. Everyone who
 * signs in from that browser acts in the same world, so what a premises principal sends is in the review queue
 * when gateway staff sign in after them, and the decision they record is on the principal's list after that.
 * Another browser has a world of its own, so two people walking the journeys at once do not see each other's
 * acts. Resetting a world returns it to the seed.
 *
 * Held on globalThis so a module reload in development keeps what was done; a server restart forgets it.
 */

/**
 * Who an account is: a premises principal, an inspector, the administrator of a rights organisation (CMO), an
 * artist acting for themselves (ACT-ART), or a member of the gateway's staff, whose spec roles (`staffRoles`)
 * decide what they may open and do.
 */
export type Role = "principal" | "inspector" | "cmo" | "artist" | "staff";

/** The spec's actors a member of staff may hold (docs/spec/inherited/00-FRD-Master.md, actor catalogue). */
export type StaffRole =
  | "ACT-OPS"
  | "ACT-SUP"
  | "ACT-BIZ-APR"
  | "ACT-LGL"
  | "ACT-CAS"
  | "ACT-DSP"
  | "ACT-FIN-OP"
  | "ACT-FIN-APR"
  | "ACT-POL-PRE"
  | "ACT-POL-APR"
  | "ACT-EVD"
  | "ACT-DAT"
  | "ACT-DPO"
  | "ACT-SEC"
  | "ACT-AUD"
  | "ACT-REG"
  | "ACT-REP"
  | "ACT-MKT-OP"
  | "ACT-MOD";

export interface MockAccount {
  email: string;
  /** The name a shell shows for the account. */
  name: string;
  role: Role;
  password: string;
  state: "active" | "suspended" | "unconfirmed";
  /** The organisations a principal acts for, by RightOne ID's id. */
  organisations: readonly string[];
  /** A member of staff's spec roles; empty for every other account. */
  staffRoles: readonly StaffRole[];
  /** A member of staff's position as the shell and a record's attribution show it ("Cán bộ vận hành"). */
  position: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface MockSession {
  id: string;
  email: string;
  role: Role;
  /** The organisation chosen after sign-in; a principal acts for none until then. */
  organisation: string | null;
  /** The world the session acts in: the browser's copy of the data. */
  world: string;
  startedAt: string;
}

interface Memory {
  accounts: Map<string, MockAccount>;
  sessions: Map<string, MockSession>;
  /** Each world's tables, by world id. */
  tables: Map<string, Map<string, unknown>>;
  /** Short-lived answers a form hands to the page it redirects to (a refused sign-in), by id. */
  flashes: Map<string, { at: number; value: unknown }>;
}

const holder = globalThis as typeof globalThis & { __rightoneMockBackend?: Memory };

function memory(): Memory {
  holder.__rightoneMockBackend ??= { accounts: new Map(), sessions: new Map(), tables: new Map(), flashes: new Map() };
  return holder.__rightoneMockBackend;
}

export const accounts = (): Map<string, MockAccount> => memory().accounts;
export const sessions = (): Map<string, MockSession> => memory().sessions;

/**
 * One family's table, seeded on first use. `key` is a session id, whose world it resolves to, or a world id
 * itself (a public page reads the browser's world without a session). The table is the family's own shape; a
 * family keeps everything it owns under one name (`"registration"`, `"finance"`, ...) and reads another
 * family's state only through the functions that family exports.
 */
export function table<T>(key: string, name: string, seed: () => T): T {
  const world = sessions().get(key)?.world ?? key;
  const all = memory().tables;
  const mine = all.get(world) ?? new Map<string, unknown>();
  all.set(world, mine);
  if (!mine.has(name)) mine.set(name, seed());
  return mine.get(name) as T;
}

/** The world of a visitor whose browser has none yet: the seed, read-only in effect since nobody signed in acts in it. */
export const PUBLIC_SESSION = "public";

/** Ends a session. Its world keeps what was done in it, for the next person who signs in from that browser. */
export function forgetSession(sessionId: string): void {
  memory().sessions.delete(sessionId);
}

/** Returns a world to the seed: every family seeds itself again the next time it is read. */
export function resetWorld(world: string): void {
  memory().tables.delete(world);
}

const FLASH_LIFETIME_MS = 10 * 60 * 1000;

export function putFlash(id: string, value: unknown): void {
  const flashes = memory().flashes;
  const now = Date.now();
  for (const [key, flash] of flashes) if (now - flash.at > FLASH_LIFETIME_MS) flashes.delete(key);
  flashes.set(id, { at: now, value });
}

export function readFlash<T>(id: string): T | null {
  const flash = memory().flashes.get(id);
  return flash === undefined ? null : (flash.value as T);
}
