import { randomUUID } from "node:crypto";
import { findAccount } from "@/lib/mock/backend/accounts";
import { sessions, type MockSession } from "@/lib/mock/backend/store";

/**
 * A session in a world of its own, as the portal's sign-in would make it, so a test calls the mock backend's
 * commands the way a page or a server action does: with a session id. A fresh world per call keeps tests
 * independent, because every family seeds its tables on the first read in a world.
 */
export function signIn(email: string, options: { organisation?: string | null; world?: string } = {}): string {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  const own = account.role === "cmo" && account.organisations.length === 1 ? (account.organisations[0] ?? null) : null;
  const session: MockSession = {
    id: randomUUID(),
    email: account.email,
    role: account.role,
    organisation: options.organisation === undefined ? (own ?? account.organisations[0] ?? null) : options.organisation,
    world: options.world ?? `test-${randomUUID()}`,
    startedAt: new Date().toISOString(),
  };
  sessions().set(session.id, session);
  return session.id;
}

/** A second person signing in on the same browser: same world, their own session. */
export function signInBeside(sessionId: string, email: string, organisation?: string | null): string {
  const world = sessions().get(sessionId)?.world;
  if (world === undefined) throw new Error(`no session ${sessionId}`);
  return signIn(email, organisation === undefined ? { world } : { world, organisation });
}

/** The seed's people, by what they do, so a test names a role rather than an address. */
export const PEOPLE = {
  principal: "trang.do@thencuaviet.vn",
  /** Hầu Ngọc Ánh: PTY's authority lets her read and submit for Nguyễn Huệ alone (ACT-PRE-DEL). */
  delegate: "anh.hau@thencuaviet.vn",
  /** Giang Thục Quyên: her party-wide authority was revoked on 28 September, and her account is suspended. */
  revokedDelegate: "quyen.giang@thencuaviet.vn",
  noOrganisation: "ngan.luc@thencuaviet.vn",
  inspector: "ngocdiep.au@kiemtra.example",
  operations: "phan.gialuong@rightone.example",
  preparer: "quan.ngoctram@rightone.example",
  approver: "thach.minhkhai@rightone.example",
  supervisor: "le.vancuong@giamsat.example",
  cmo: "baotran.la@lamhong.example",
  /** Tống Nhã Uyên, the artist of the artist portal (ACT-ART), acting for herself. */
  artist: "nhauyen.tong@nghesi.example",
} as const;
