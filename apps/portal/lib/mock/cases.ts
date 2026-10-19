import type { LoadOutcome } from "@rightone/ui";
import type { ArtefactKind, BusinessImpact, PeriodKind, RemedyKind, RouteKind, Severity } from "@/lib/api/cases";
import type { StaffRole } from "./backend/store";

/*
 * The case family's sample data (CAS). No canvas board and no Figma frame draws a case screen, so the data is the
 * specification's own: the case-intake matrix of SCR-CAS-16's drawing and of UAT-CAS-01's test data, the registers
 * the matrix, the intake form and the case console read, with the safe defaults `frd/13-configuration-points.md`
 * states for them, and the people of the staff boards for who prepared and approved each. No case is seeded:
 * every case in a world is one somebody raised in it.
 */

/** The review states a reader can force with `?view=`: the states the specification defines and no act reaches. */
export const CAS01_VIEWS = ["loading", "error", "not-open"] as const;
export type Cas01View = (typeof CAS01_VIEWS)[number];

export const CAS02_VIEWS = ["loading", "error", "protected"] as const;
export type Cas02View = (typeof CAS02_VIEWS)[number];

export const CASES_VIEWS = ["loading", "error"] as const;
export type CasesView = (typeof CASES_VIEWS)[number];

/** SCR-CAS-08: the decision being read, our outage. */
export const CAS08_VIEWS = ["loading", "error"] as const;
export type Cas08View = (typeof CAS08_VIEWS)[number];

/**
 * The console screens' review states: loading and our outage on every one; SCR-CAS-03 also draws the page lost
 * (CURSOR_INVALID) and a reader with no case in scope (ROLE_NOT_ASSIGNED).
 */
export const CONSOLE_VIEWS = ["loading", "error"] as const;
export type ConsoleView = (typeof CONSOLE_VIEWS)[number];
export const CAS03_VIEWS = ["loading", "error", "page-lost", "no-scope"] as const;
export type Cas03View = (typeof CAS03_VIEWS)[number];

/** A member of staff as a record names them: the name the boards draw, and the account that identifies them. */
export interface SeedActor {
  name: string;
  email: string;
}

/** The two staff the seeded versions name: Phan Gia Lượng prepared them, Thạch Minh Khải approved them. */
export const PREPARER: SeedActor = { name: "Phan Gia Lượng", email: "phan.gialuong@rightone.example" };
export const APPROVER: SeedActor = { name: "Thạch Minh Khải", email: "thach.minhkhai@rightone.example" };

/** The case types a route accepts (register `case_type`), and the remedy kinds each admits (register `remedy_kind`). */
export const CASE_TYPE_REMEDIES: Readonly<Record<string, readonly RemedyKind[]>> = {
  billing: ["refund", "correction", "explanation"],
  certificate: ["correction", "explanation"],
  registration: ["correction", "explanation"],
  // A request to reconsider an inspection record or a verification answer (VER's SCR-VER-14).
  inspection: ["correction", "explanation"],
};

export const CASE_TYPES = Object.keys(CASE_TYPE_REMEDIES);

/** Register `subject_kind`: what a case is about, among the records the premises portal shows a principal. */
export const SUBJECT_KINDS = ["decision", "payment", "invoice", "status_record", "application", "inspection_record", "verification_answer"] as const;

/** The DR-47 inputs: four severities and three business impacts (`srs/02` POST /classify). */
export const SEVERITIES: readonly Severity[] = ["low", "medium", "high", "critical"];
export const IMPACTS: readonly BusinessImpact[] = ["minor", "material", "major"];

/**
 * Register `governing_ground` (DEC-32): SCR-CAS-07 draws the interim rule of BR-FIN-16; the tariff is the other
 * ground a fee rests on, and the inspection rules the ground a decision on an inspection record rests on.
 */
export const GOVERNING_GROUNDS = ["approved_tariff", "fin16_interim_hold", "inspection_rules"] as const;

/** The stakeholder groups the registers list (register `stakeholder_group`), in the order the form offers them. */
export const STAKEHOLDER_GROUPS = ["public", "premises_principal", "rights_organisation", "music_teacher"] as const;

export interface SeedRoute {
  group: string;
  kind: RouteKind;
  requiresAccount: boolean;
  caseTypes: readonly string[];
}

export interface SeedMatrixVersion {
  versionNo: number;
  state: "PREPARED" | "APPROVED";
  effectiveFrom: string;
  effectiveTo: string | null;
  preparedBy: SeedActor;
  approvedBy: SeedActor | null;
  approvedAt: string | null;
  routes: readonly SeedRoute[];
}

/**
 * Every group has the support line, which needs no account; the public also has this web form without one
 * (UAT-CAS-01's test data), and the premises principal and the rights organisation have it from their
 * account (SCR-CAS-16's rows).
 */
const VERSION_3_ROUTES: readonly SeedRoute[] = [
  { group: "public", kind: "portal_form", requiresAccount: false, caseTypes: CASE_TYPES },
  { group: "public", kind: "support_line", requiresAccount: false, caseTypes: CASE_TYPES },
  { group: "premises_principal", kind: "portal_form", requiresAccount: true, caseTypes: CASE_TYPES },
  { group: "premises_principal", kind: "support_line", requiresAccount: false, caseTypes: CASE_TYPES },
  { group: "rights_organisation", kind: "portal_form", requiresAccount: true, caseTypes: CASE_TYPES },
  { group: "rights_organisation", kind: "support_line", requiresAccount: false, caseTypes: CASE_TYPES },
];

/**
 * The matrix as it stands: version 3 approved and in force, version 4 prepared for 1 January 2027 with the music
 * teachers SCR-CAS-16 draws, whose only route needs an account, so it cannot be approved as it is.
 */
export const INTAKE_MATRIX_SEED: readonly SeedMatrixVersion[] = [
  {
    versionNo: 3,
    state: "APPROVED",
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    preparedBy: PREPARER,
    approvedBy: APPROVER,
    approvedAt: "2026-06-24T15:20:00+07:00",
    routes: VERSION_3_ROUTES,
  },
  {
    versionNo: 4,
    state: "PREPARED",
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    preparedBy: PREPARER,
    approvedBy: null,
    approvedAt: null,
    routes: [...VERSION_3_ROUTES, { group: "music_teacher", kind: "portal_form", requiresAccount: true, caseTypes: CASE_TYPES }],
  },
];

/** The day the seeded registers and periods began to govern: the day version 3 of the matrix did. */
const SINCE = "2026-07-01";
const APPROVED_AT = "2026-06-24T15:20:00+07:00";

/** A register entry of SCR-CAS-18, as `cases.register_entries` holds it; its words come from the catalogue. */
export interface SeedRegisterEntry {
  register: "pause_ground" | "protected_category" | "reopen_ground" | "statutory_limit" | "remedy_requirement";
  code: string;
  requiredAuthority: StaffRole | null;
  /** `cases.statutory_limits`: the case type, the instrument and the days it allows. */
  limit: { caseType: string; instrument: string; days: number } | null;
  /** `cases.remedy_requirements`: the artefact kinds a remedy kind requires before its linkage is complete. */
  requires: { remedyKind: RemedyKind; artefactKinds: readonly ArtefactKind[] } | null;
}

/**
 * The registers' approved entries, each the safe default its configuration point states:
 *
 * - CFG-47: one pause ground, waiting on evidence requested from a party, recorded by the business approver;
 * - CFG-50: no protected category is approved, so the register is empty and a classification into one is refused;
 * - CFG-51: two reopening grounds and no third;
 * - the ninety-day royalty limit `CR-17` carries (Nghị định 17/2023/NĐ-CP, khoản 5 Điều 34), on billing cases;
 * - the remedy requirements: a refund changes a calculation and an invoice and is a refund in its own right; a
 *   correction is the corrected record in its owning module - a financial correction in FIN, a corrected version of
 *   an inspection record in VER - and the notice (DR-51 row 3); an explanation changes nothing, so it has nothing to
 *   link. SCR-CAS-10's drawing of a partial refund also lists a status change; a fee case bears on no status record
 *   until CER says so.
 */
export const REGISTER_SEED: readonly SeedRegisterEntry[] = [
  { register: "pause_ground", code: "awaiting_party", requiredAuthority: "ACT-BIZ-APR", limit: null, requires: null },
  { register: "reopen_ground", code: "new_evidence", requiredAuthority: null, limit: null, requires: null },
  { register: "reopen_ground", code: "authorised_decision", requiredAuthority: null, limit: null, requires: null },
  {
    register: "statutory_limit",
    code: "royalty_90_days",
    requiredAuthority: null,
    limit: { caseType: "billing", instrument: "Nghị định 17/2023/NĐ-CP, khoản 5 Điều 34", days: 90 },
    requires: null,
  },
  { register: "remedy_requirement", code: "refund", requiredAuthority: null, limit: null, requires: { remedyKind: "refund", artefactKinds: ["recalculation", "invoice", "refund", "notice"] } },
  { register: "remedy_requirement", code: "correction", requiredAuthority: null, limit: null, requires: { remedyKind: "correction", artefactKinds: ["correction", "notice"] } },
  { register: "remedy_requirement", code: "explanation", requiredAuthority: null, limit: null, requires: { remedyKind: "explanation", artefactKinds: [] } },
];

/** A version of a period, as `cases.policy_periods` holds it: per case type and kind, in its unit. */
export interface SeedPeriod {
  kind: PeriodKind;
  caseType: string;
  amount: number;
  unit: "working_days" | "months";
}

/**
 * The periods' first approved versions, the safe defaults of CFG-48 (an appeal decided within fifteen working days
 * of receipt), CFG-49 (evidence supplied within ten working days of the request) and CFG-51 (new evidence offered
 * within twelve months of closure, kept in months as CFG-51 states it), for every case type.
 */
export const PERIOD_SEED: readonly SeedPeriod[] = CASE_TYPES.flatMap((caseType) => [
  { kind: "appeal_decision", caseType, amount: 15, unit: "working_days" },
  { kind: "evidence_response", caseType, amount: 10, unit: "working_days" },
  { kind: "reopen_window", caseType, amount: 12, unit: "months" },
]);

export const SEEDED_SINCE = SINCE;
export const SEEDED_APPROVED_AT = APPROVED_AT;

/**
 * The service-objective table DR-47 reads (the programme's configuration point under DEC-25, which the service owner
 * signs before production activation). The specification fixes the shape of the read and approves no values, so a
 * version stands in here until one is signed: the band follows the severity, a major business impact raises it one
 * band, and each band has a response period in working days.
 */
export const SERVICE_OBJECTIVES = {
  version: "DEC-25 v0",
  effectiveFrom: SINCE,
  bandOf: { critical: 1, high: 2, medium: 3, low: 4 } as Readonly<Record<Severity, number>>,
  workingDays: { 1: 3, 2: 5, 3: 10, 4: 20 } as Readonly<Record<number, number>>,
} as const;

/** A case the seed holds: a request to reconsider an inspection record, as VER's boards draw it, decided. */
export interface SeedCase {
  reference: string;
  party: string;
  contact: string;
  recordedBy: string;
  subjectRef: string;
  submittedAt: string;
  owner: SeedActor;
  decision: { maker: SeedActor; decidedAt: string; facts: string; authority: string; reasoning: string; appealRoute: string };
}

const TRANG = { party: "tcv", contact: "trang.do@thencuaviet.vn", recordedBy: "Đỗ Thu Trang" };
const OWNER: SeedActor = PREPARER;
const MAKER: SeedActor = { name: "Quan Ngọc Trâm", email: "quan.ngoctram@rightone.example" };

/**
 * The two requests to reconsider VER's boards draw, each a case decided with a correction of the record it names
 * (SCR-VER-06, 13, 15, 18): CAS-2026-000412 on Lê Thánh Tôn's IRC-4M8QK2TW7C, decided on 28 September, its
 * correction still to issue; CAS-2026-000377 on Đa Kao's IRC-3XK7QW2MTD, decided on 24 September, under which the
 * record was corrected to version 2. They keep the references the boards draw. The boards draw no instant either
 * was raised, nor who owned and decided them: the record's handover stands in for the first, and a case officer
 * who did not own the case for the decision maker, as PERM-86 requires.
 */
export const SEED_CASES: readonly SeedCase[] = [
  {
    reference: "CAS-2026-000412",
    ...TRANG,
    subjectRef: "IRC-4M8QK2TW7C",
    submittedAt: "2026-09-10T10:05:00+07:00",
    owner: OWNER,
    decision: {
      maker: MAKER,
      decidedAt: "2026-09-28T10:14:00+07:00",
      facts: "Đề nghị xem xét lại biên bản kiểm tra IRC-4M8QK2TW7C, phiên bản 1, có căn cứ.",
      authority: "Quy định về biên bản kiểm tra và việc xem xét lại",
      reasoning: "Biên bản cần được cơ quan kiểm tra đã lập sửa lại, với lý do sửa nêu trong phiên bản mới.",
      appealRoute: "Gửi khiếu nại trên cổng RightOne, mục Vụ việc, bằng mã vụ việc này.",
    },
  },
  {
    reference: "CAS-2026-000377",
    ...TRANG,
    subjectRef: "IRC-3XK7QW2MTD",
    submittedAt: "2026-09-10T14:05:00+07:00",
    owner: OWNER,
    decision: {
      maker: MAKER,
      decidedAt: "2026-09-24T16:00:00+07:00",
      facts: "Đề nghị xem xét lại biên bản kiểm tra IRC-3XK7QW2MTD, phiên bản 1, có căn cứ.",
      authority: "Quy định về biên bản kiểm tra và việc xem xét lại",
      reasoning: "Biên bản cần được cơ quan kiểm tra đã lập sửa lại, với lý do sửa nêu trong phiên bản mới.",
      appealRoute: "Gửi khiếu nại trên cổng RightOne, mục Vụ việc, bằng mã vụ việc này.",
    },
  },
];

/** A review state's failure: the page's own outage, or a refusal no act in the mock reaches. */
export function mockCaseFailure(view: "error" | "not-open" | "protected" | "page-lost" | "no-scope"): LoadOutcome<never> {
  switch (view) {
    case "error":
      return { data: null, failure: { code: "INTERNAL_ERROR", traceId: "4b1e9c27a0d36f15", retryable: true } };
    case "not-open":
      return { data: null, failure: { code: "MATRIX_VERSION_NOT_APPROVED", traceId: null, retryable: false } };
    case "protected":
      return { data: null, failure: { code: "PROTECTED_MATTER_NO_ACCESS", traceId: "9d07f3a2c1b84e60", retryable: false } };
    case "page-lost":
      return { data: null, failure: { code: "CURSOR_INVALID", traceId: null, retryable: false } };
    case "no-scope":
      return { data: null, failure: { code: "ROLE_NOT_ASSIGNED", traceId: null, retryable: false } };
  }
}
