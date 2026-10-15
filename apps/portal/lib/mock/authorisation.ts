import type { LoadOutcome } from "@rightone/ui";
import type { RegisterPremises, VerifyAuthorisation, VerifyQuestion, VerifyResult } from "@/lib/api/authorisation";

/** The view states SCR-PTY-17 was drawn in on the premises canvas (its `-unavailable` board is the unavailable view). */
export const PTY17_VIEWS = ["another", "yours", "none", "form", "checking", "unavailable", "not-registered", "future", "not-found", "error"] as const;
export type Pty17View = (typeof PTY17_VIEWS)[number];

/**
 * The view states of SCR-PTY-18. The board draws its organisation reader the same in each: the refusal; the
 * other two readers (the data owner, assurance) are on consoles the organisation portal does not have.
 */
export const PTY18_VIEWS = ["populated", "empty", "not-found", "loading", "error"] as const;
export type Pty18View = (typeof PTY18_VIEWS)[number];

/** When the canvas asks: 1 October 2026, 10:14 in Ho Chi Minh, and the day its calendar stops at. */
const NOW = "2026-10-01T10:14:00+07:00";
const TODAY = "2026-10-01";

/** The ward the board writes beside every premises it offers. */
const BEN_THANH = "Phường Bến Thành";

/** The public register as SCR-PTY-17 offers it: three premises in Phường Bến Thành. */
export const REGISTER: readonly RegisterPremises[] = [
  { reference: "PRM-6BVK3RQT", name: "Then Cửa Lounge & Karaoke – Bùi Viện", ward: BEN_THANH },
  { reference: "PRM-9NTR4KBE", name: "The Lintel Coffee – Nguyễn Trãi", ward: BEN_THANH },
  { reference: "PRM-5JZT3HQV", name: "The Lintel Coffee – Lý Tự Trọng", ward: BEN_THANH },
];

/**
 * The holder of the lounge's authority. No board names it, and SCR-PTY-18 says each of the three organisations
 * that asked about the lounge (Lam Hồng, Trường Xuân, Hạc Bạch) was told another authority exists, so it is none
 * of them. It is kept as a holder nobody signs in as; the answer never names a holder, so no name is needed.
 */
export const UNNAMED_HOLDER = "holder-not-drawn";

/** An authority to collect for one premises, held by one organisation, for its period; an end left open is unbounded. */
export interface SeedAuthority {
  premises: string;
  holder: string;
  /** Calendar days in Vietnam time, both included; null where the canvas draws no bound. */
  from: string | null;
  to: string | null;
}

/**
 * The authorities the board's three answers imply, and nothing more:
 * - another: the lounge was held by an organisation other than the asker on 26 September 2026 at 21:00. The board
 *   draws no period for it, so neither end is bounded and every moment asked about falls inside it;
 * - yours: Lam Hồng's own authority for The Lintel Coffee – Nguyễn Trãi runs from 1 September 2026 to 31 August
 *   2027, the period the answer names;
 * - none: nobody held one for The Lintel Coffee – Lý Tự Trọng, so it has no authority at all.
 */
export const AUTHORITIES: readonly SeedAuthority[] = [
  { premises: "PRM-6BVK3RQT", holder: UNNAMED_HOLDER, from: null, to: null },
  { premises: "PRM-9NTR4KBE", holder: "lamhong", from: "2026-09-01", to: "2027-08-31" },
];

const [LOUNGE, TRAI, TRONG] = REGISTER as [RegisterPremises, RegisterPremises, RegisterPremises];

/** The question the board fills in for its checking, unavailable and error views. */
const ASKED: VerifyQuestion = { premises: LOUNGE.reference, date: "2026-09-26", time: "21:00" };
const EMPTY: VerifyQuestion = { premises: "", date: "", time: "" };

const page = (question: VerifyQuestion, result: VerifyResult, registered = true): LoadOutcome<VerifyAuthorisation> => ({
  data: { registered, register: registered ? REGISTER : [], today: TODAY, question, result },
  failure: null,
});

const answered = (premises: RegisterPremises, at: string, answer: "EFFECTIVE" | "NOT_EFFECTIVE" | "ANOTHER_AUTHORITY_EXISTS", period: { from: string; to: string } | null) =>
  page(EMPTY, { kind: "answered", verification: { premises, at, answer, period, readAt: NOW } });

/** SCR-PTY-17's states, per view, with the board's premises, moments and answers. */
export function mockVerifyAuthorisation(view: Pty17View): LoadOutcome<VerifyAuthorisation> {
  switch (view) {
    case "another":
      return answered(LOUNGE, "2026-09-26T21:00:00+07:00", "ANOTHER_AUTHORITY_EXISTS", null);
    case "yours":
      return answered(TRAI, "2026-09-30T19:00:00+07:00", "EFFECTIVE", { from: "2026-09-01", to: "2027-08-31" });
    case "none":
      return answered(TRONG, "2026-09-30T19:00:00+07:00", "NOT_EFFECTIVE", null);
    case "form":
      return page(EMPTY, { kind: "none" });
    case "checking":
      return page(ASKED, { kind: "checking" });
    case "unavailable":
      return page(ASKED, { kind: "unavailable" });
    case "not-registered":
      return page(EMPTY, { kind: "refused", code: "NOT_A_REGISTERED_COLLECTING_ORGANISATION", requestedAt: NOW }, false);
    case "future":
      return page({ premises: LOUNGE.reference, date: "2026-10-02", time: "20:00" }, { kind: "refused", code: "INSTANT_IN_FUTURE", requestedAt: NOW });
    case "not-found":
      return page({ premises: "PRM-6BVK3RQ7", date: "2026-09-26", time: "21:00" }, { kind: "refused", code: "PREMISES_NOT_FOUND", requestedAt: NOW });
    case "error":
      return page(ASKED, { kind: "failed", traceId: "c58e2a91f04d7b36" });
  }
}

/** SCR-PTY-18 for its organisation reader: refused, as the board draws it in every one of its views. */
export function mockOverlapReport(): LoadOutcome<never> {
  return { data: null, failure: { code: "OVERLAP_REPORT_RESERVED", traceId: null, retryable: false } };
}
