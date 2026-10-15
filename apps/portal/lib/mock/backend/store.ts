/**
 * The mock backend's memory: what the API will hold, kept in the server process while the portal runs on
 * mock data. Each signed-in session has its own tables, seeded from the design canvas's data the first time
 * a family reads them, so every sign-in starts the journeys from the same state and two people walking them
 * at once do not see each other's acts. Accounts and sessions are process-wide, as RightOne ID's would be.
 *
 * Held on globalThis so a module reload in development keeps what was done; a server restart forgets it,
 * which is the mock's reset.
 */

/** Who an account is: a premises principal, an inspector, or the administrator of a rights organisation (CMO). */
export type Role = "principal" | "inspector" | "cmo";

export interface MockAccount {
  email: string;
  /** The name a shell shows for the account. */
  name: string;
  role: Role;
  password: string;
  state: "active" | "suspended" | "unconfirmed";
  /** The organisations a principal acts for, by RightOne ID's id. */
  organisations: readonly string[];
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface MockSession {
  id: string;
  email: string;
  role: Role;
  /** The organisation chosen after sign-in; a principal acts for none until then. */
  organisation: string | null;
  startedAt: string;
}

interface Memory {
  accounts: Map<string, MockAccount>;
  sessions: Map<string, MockSession>;
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
 * One family's table for one session, seeded on first use. The table is the family's own shape; a family
 * keeps everything it owns under one name (`"registration"`, `"finance"`, ...) and never reads another's.
 */
export function table<T>(sessionId: string, name: string, seed: () => T): T {
  const all = memory().tables;
  const mine = all.get(sessionId) ?? new Map<string, unknown>();
  all.set(sessionId, mine);
  if (!mine.has(name)) mine.set(name, seed());
  return mine.get(name) as T;
}

/** The tables of the public, who have no session: read-only reference data such as the published records. */
export const PUBLIC_SESSION = "public";

export function forgetSession(sessionId: string): void {
  memory().sessions.delete(sessionId);
  memory().tables.delete(sessionId);
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
