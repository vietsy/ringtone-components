import type { LoadOutcome } from "@rightone/ui";
import type {
  ConditionCode,
  FollowUpOutcome,
  GroundCode,
  IssueCondition,
  PremisesStatusRecords,
  PrintoutSummary,
  RecordStatus,
  RouteReason,
  StatusAct,
  StatusRecord,
  StatusRecordPage,
  StatusRecordPrintout,
  Written,
} from "@/lib/api/status-records";
import type { Locale } from "@/lib/i18n/translate";
import { MOCK_PRINCIPAL } from "./session";

/*
 * CER's sample data, word for word from the premises canvas (`CER-Index`, `SCR-CER-01` to `13`), in two roles: the
 * seed the mock backend starts every world from (`CER_SEED`), and the states a reviewer forces with `?view=`. The
 * console boards draw one morning, Thursday 1 October 2026 at 10:14; what a person does in the portal happens now.
 */

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({
  data: null,
  failure: { code, traceId, retryable },
});

// ================================================================== the premises and their holders

const THEN_CUA = MOCK_PRINCIPAL.party;
const THE_LINTEL = "Công ty TNHH The Lintel";
const AP_MAI = "Công ty TNHH Áp Mái";

export type PremisesKey =
  | "pasteur"
  | "nguyenHue"
  | "leThanhTon"
  | "phanXichLong"
  | "daKao"
  | "sala"
  | "buiVien"
  | "haiBaTrung"
  | "apMai"
  | "nguyenTrai"
  | "maySong"
  | "lintelThaoDien"
  | "hatMe";

export interface SeedPremises {
  /** The premises register's record (PTY), `PRM-` and eight characters; null where no board names it. */
  register: string | null;
  name: string;
  ward: string | null;
  /** The party responsible for the premises now. */
  holder: string;
  /** The premises' class as the register states it, where a board draws it. */
  premisesClass: StatusRecord["premisesClass"];
  /** The premises register's closing date, where it records one (SCR-CER-05). */
  closing: { on: string; recordedAt: string } | null;
}

/**
 * Every premises the CER boards name, with the register record and ward the console shows under the name
 * (SCR-CER-01, 02, 03) and, where the CER boards draw none, the parties-and-premises boards' (SCR-PTY-06, 07).
 */
export const CER_PREMISES: Readonly<Record<PremisesKey, SeedPremises>> = {
  pasteur: { register: "PRM-5PSR9VJA", name: "Then Cửa Coffee & Tea – Pasteur", ward: "Phường Sài Gòn", holder: THEN_CUA, premisesClass: "cafe", closing: null },
  nguyenHue: { register: "PRM-3NHZ6PKW", name: "Then Cửa Coffee & Tea – Nguyễn Huệ", ward: null, holder: THEN_CUA, premisesClass: "cafe", closing: null },
  leThanhTon: { register: "PRM-8RTN5QZD", name: "Then Cửa Coffee & Tea – Lê Thánh Tôn", ward: "Phường Bến Thành", holder: THEN_CUA, premisesClass: "cafe", closing: null },
  phanXichLong: { register: "PRM-7PXK4TDM", name: "Then Cửa Kitchen – Phan Xích Long", ward: null, holder: THEN_CUA, premisesClass: null, closing: null },
  daKao: { register: "PRM-4DKX7WNP", name: "Then Cửa Bakery – Đa Kao", ward: null, holder: THEN_CUA, premisesClass: null, closing: null },
  sala: { register: "PRM-9VB5HJ2E", name: "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ", ward: "Phường An Khánh", holder: THEN_CUA, premisesClass: "cafe", closing: null },
  buiVien: { register: "PRM-6BVK3RQT", name: "Then Cửa Lounge & Karaoke – Bùi Viện", ward: "Phường Bến Thành", holder: THEN_CUA, premisesClass: "karaoke", closing: null },
  haiBaTrung: { register: null, name: "Then Cửa Bakery – Hai Bà Trưng", ward: null, holder: THEN_CUA, premisesClass: null, closing: null },
  apMai: { register: "PRM-7KD2WQ9M", name: "Áp Mái Bar – Thảo Điền", ward: "Phường An Khánh", holder: THE_LINTEL, premisesClass: "bar", closing: null },
  nguyenTrai: { register: "PRM-9NTR4KBE", name: "The Lintel Coffee – Nguyễn Trãi", ward: "Phường Bến Thành", holder: THE_LINTEL, premisesClass: null, closing: null },
  maySong: {
    register: "PRM-4MSG8TDX",
    name: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng",
    ward: "Phường Sài Gòn",
    holder: "Công ty TNHH Khách sạn Mây Sông",
    premisesClass: "hotel",
    closing: { on: "2026-11-01", recordedAt: "2026-09-30T14:05:00+07:00" },
  },
  lintelThaoDien: { register: "PRM-2MX6PC8T", name: "The Lintel Coffee – Thảo Điền", ward: "Phường An Khánh", holder: THE_LINTEL, premisesClass: "cafe", closing: null },
  hatMe: { register: "PRM-3RT8XN4C", name: "Nhà hàng Chay Hạt Mè – Chi nhánh Khu đô thị Sala", ward: "Phường An Khánh", holder: "Công ty TNHH Chay Hạt Mè", premisesClass: "restaurant", closing: null },
};

/**
 * REG's premises ids (`lib/mock/registration.ts`): the premises Đỗ Thu Trang acts for, all Then Cửa Việt's, so a
 * decision REG records for one of them lands on a record of that party.
 */
export const REGISTRATION_PREMISES: Readonly<Record<string, PremisesKey>> = {
  pasteur: "pasteur",
  nh: "nguyenHue",
  ltt: "leThanhTon",
  pxl: "phanXichLong",
  dakao: "daKao",
  sala: "sala",
  buivien: "buiVien",
  hbt: "haiBaTrung",
};

// ================================================================== the decisions REG does not hold

/**
 * The obligation decisions the CER boards draw for premises REG's sample world does not hold (The Lintel's, Áp
 * Mái's), with the fee and payment each board states; and, for REG's own decisions, the payment the record page
 * draws (Pasteur paid by card at 11:34 on 18 September, Nguyễn Huệ by transfer at 16:51 on 24 September).
 */
export interface SeedDecision {
  reference: string;
  premises: PremisesKey;
  status: "CURRENT" | "SUPERSEDED";
  outcome: "PAYABLE" | "NO_PAYABLE_OBLIGATION";
  feeMinor: number | null;
  payBy: string | null;
  paid: { at: string; method: "card" | "transfer" | null } | null;
  period: { from: string; to: string };
  /** In force from; an amendment's effective instant. */
  inForceFrom: string;
}

export const CER_DECISIONS: readonly SeedDecision[] = [
  {
    reference: "OBD-7HCW3QNT5R", premises: "apMai", status: "CURRENT", outcome: "PAYABLE", feeMinor: 14976000, payBy: null,
    paid: { at: "2026-09-30T16:20:00+07:00", method: null }, period: { from: "2026-10-01", to: "2027-09-30" }, inForceFrom: "2026-10-01T00:00:00+07:00",
  },
  {
    reference: "OBD-2RKD8MXT4Q", premises: "nguyenTrai", status: "CURRENT", outcome: "PAYABLE", feeMinor: 1386000, payBy: "2026-12-23",
    paid: null, period: { from: "2026-09-25", to: "2027-09-24" }, inForceFrom: "2026-09-25T00:00:00+07:00",
  },
  {
    reference: "OBD-5WRM8KTC3H", premises: "apMai", status: "CURRENT", outcome: "PAYABLE", feeMinor: null, payBy: null,
    paid: null, period: { from: "2026-09-02", to: "2027-09-01" }, inForceFrom: "2026-09-02T00:00:00+07:00",
  },
  {
    reference: "OBD-3XWP7KDA5N", premises: "lintelThaoDien", status: "SUPERSEDED", outcome: "PAYABLE", feeMinor: null, payBy: null,
    paid: null, period: { from: "2026-09-11", to: "2027-09-10" }, inForceFrom: "2026-09-11T00:00:00+07:00",
  },
  // The amendment of SCR-CER-08: in force from midnight on 1 October; its term keeps the record's last day, as
  // Lê Thánh Tôn's change does, and its conditions hold (the rule preselects Amend).
  {
    reference: "OBD-8NQV4TRC6W", premises: "lintelThaoDien", status: "CURRENT", outcome: "PAYABLE", feeMinor: null, payBy: null,
    paid: { at: "2026-09-30T00:00:00+07:00", method: null }, period: { from: "2026-10-01", to: "2027-09-10" }, inForceFrom: "2026-10-01T00:00:00+07:00",
  },
];

/** The payment the record pages draw for decisions REG holds, which FIN's world does not reconcile again. */
export const CER_PAYMENTS: Readonly<Record<string, { at: string; method: "card" | "transfer" }>> = {
  "OBD-3FJW6NRA5C": { at: "2026-09-18T11:34:00+07:00", method: "card" },
  "OBD-8KWT2PZH6M": { at: "2026-09-24T16:51:00+07:00", method: "transfer" },
};

// ================================================================== the records

export interface SeedPeriod {
  decision: string | null;
  from: string;
  to: string;
  governedFrom: string;
  governedTo: string | null;
  /**
   * What started the period: the issue, a renewal of the same holder's record, an amendment or a decision moved
   * only, or the cut of a period at a re-decision.
   */
  cause: "ISSUE" | "RENEWAL" | "AMENDMENT" | "NO_CHANGE" | "END";
  followUp: string | null;
}

export interface SeedChange {
  from: RecordStatus;
  to: RecordStatus;
  effectiveAt: string;
  recordedAt: string;
  authority:
    | { kind: "ROUTE"; straight: boolean }
    | { kind: "APPROVAL"; approver: string }
    | { kind: "REVIEW"; review: string; proposer: SeedPerson; approver: SeedPerson; comment: Written | null }
    | { kind: "SUCCESSOR"; successor: string };
  ground: GroundCode | null;
  condition: ConditionCode | null;
  reason: Written | null;
  evidence: readonly string[];
  appealBy: string | null;
  notice: boolean;
}

export interface SeedPerson {
  name: string;
  position: string;
  at: string;
}

export interface SeedAssessment {
  at: string;
  trigger: "DECISION_RECORDED" | "PAYMENT_RECONCILED" | "OPERATOR_REQUEST" | "APPROVAL";
  unmet: readonly IssueCondition[];
  route: RouteReason | null;
}

export interface SeedRecord {
  /** The record's internal identity: never on screen, never in an address. */
  id: string;
  reference: string | null;
  /** The reference the canvas draws a pending record issued under, once an approval issues it. */
  reserved: string | null;
  premises: PremisesKey;
  holder: string;
  /** The decision the record was opened under, and when. */
  opened: { decision: string | null; at: string };
  issued: { at: string; route: "STRAIGHT_THROUGH" | "APPROVED" | null } | null;
  /** A pending record's period: the decision's, until it issues and the period is its own. */
  pendingPeriod: { from: string; to: string } | null;
  periods: readonly SeedPeriod[];
  changes: readonly SeedChange[];
  assessments: readonly SeedAssessment[];
  predecessor: string | null;
  successor: string | null;
  printouts: readonly PrintoutSummary[];
  /** What a printed sheet carries beyond the record: the address in both languages, and the operator. */
  sheet: { address: Readonly<Record<Locale, string>> | null; operator: string | null };
}

const SIGNING_KEY = "CK-2026-01";
const PASTEUR_REF = "R1-CER-2026-T7QM4BWJ";
const PASTEUR_PRINTOUT = "CRP-4WTN8QHC2K";

function printout(reference: string, printedAt: string): PrintoutSummary {
  return { reference, printedAt, stateWhenPrinted: "active", signingKey: SIGNING_KEY };
}

/** A record issued straight through, as the CER-01 list draws most of them: one period, one status change. */
function issued(
  id: string,
  reference: string,
  premises: PremisesKey,
  decision: string | null,
  at: string,
  period: { from: string; to: string },
  route: "STRAIGHT_THROUGH" | null,
  more: Partial<Pick<SeedRecord, "printouts" | "sheet" | "periods" | "holder" | "opened">> = {},
): SeedRecord {
  const holder = more.holder ?? CER_PREMISES[premises].holder;
  return {
    id,
    reference,
    reserved: null,
    premises,
    holder,
    opened: more.opened ?? { decision, at },
    issued: { at, route },
    pendingPeriod: null,
    periods: more.periods ?? [{ decision, from: period.from, to: period.to, governedFrom: at, governedTo: null, cause: "ISSUE", followUp: null }],
    changes: [
      {
        from: "PENDING_ISSUE",
        to: "ACTIVE",
        effectiveAt: at,
        recordedAt: at,
        authority: { kind: "ROUTE", straight: route === "STRAIGHT_THROUGH" },
        ground: null,
        condition: null,
        reason: null,
        evidence: [],
        appealBy: null,
        notice: true,
      },
    ],
    assessments: [{ at, trigger: "DECISION_RECORDED", unmet: [], route: route }],
    predecessor: null,
    successor: null,
    printouts: more.printouts ?? [],
    sheet: more.sheet ?? { address: null, operator: holder },
  };
}

/**
 * Every record the CER boards draw (SCR-CER-01's list, SCR-CER-02, 03, 08, 09), in the list's order: the two
 * waiting to issue, then the issued ones newest first. Áp Mái Bar's new record waits for an approver because the
 * holder changed, and issues as R1-CER-2026-V8KM3QXD, the reference SCR-CER-03 draws; The Lintel Coffee –
 * Nguyễn Trãi waits for its fee. Lê Thánh Tôn's record was amended late on 28 September (SCR-CER-09); Nhà hàng
 * Chay Hạt Mè's on 12 September, under a decision no board names.
 */
export const CER_RECORDS: readonly SeedRecord[] = [
  {
    id: "cer-ap-mai-lintel",
    reference: null,
    reserved: "R1-CER-2026-V8KM3QXD",
    premises: "apMai",
    holder: THE_LINTEL,
    opened: { decision: "OBD-7HCW3QNT5R", at: "2026-10-01T00:00:00+07:00" },
    issued: null,
    pendingPeriod: { from: "2026-10-01", to: "2027-09-30" },
    periods: [],
    changes: [],
    assessments: [{ at: "2026-10-01T00:00:00+07:00", trigger: "DECISION_RECORDED", unmet: [], route: "HOLDER_CHANGED" }],
    predecessor: "cer-ap-mai",
    successor: null,
    printouts: [],
    sheet: { address: null, operator: THE_LINTEL },
  },
  {
    id: "cer-nguyen-trai",
    reference: null,
    reserved: null,
    premises: "nguyenTrai",
    holder: THE_LINTEL,
    opened: { decision: "OBD-2RKD8MXT4Q", at: "2026-09-25T14:10:00+07:00" },
    issued: null,
    pendingPeriod: { from: "2026-09-25", to: "2027-09-24" },
    periods: [],
    changes: [],
    assessments: [{ at: "2026-09-25T14:10:00+07:00", trigger: "DECISION_RECORDED", unmet: ["PAYMENT_PENDING"], route: "STRAIGHT_THROUGH" }],
    predecessor: null,
    successor: null,
    printouts: [],
    sheet: { address: null, operator: THE_LINTEL },
  },
  issued("cer-nguyen-hue", "R1-CER-2026-N6PZ2RKE", "nguyenHue", "OBD-8KWT2PZH6M", "2026-09-24T16:52:00+07:00", { from: "2026-09-24", to: "2027-09-23" }, "STRAIGHT_THROUGH", {
    opened: { decision: "OBD-8KWT2PZH6M", at: "2026-09-24T16:05:00+07:00" },
  }),
  issued("cer-phan-xich-long", "R1-CER-2026-P3HV9XFT", "phanXichLong", "OBD-9MZB3QFT4X", "2026-09-20T09:44:00+07:00", { from: "2026-09-20", to: "2027-09-19" }, "STRAIGHT_THROUGH"),
  issued(
    "cer-pasteur",
    PASTEUR_REF,
    "pasteur",
    "OBD-3FJW6NRA5C",
    "2026-09-18T11:40:00+07:00",
    { from: "2026-09-18", to: "2027-09-17" },
    "STRAIGHT_THROUGH",
    {
      opened: { decision: "OBD-3FJW6NRA5C", at: "2026-09-18T11:32:00+07:00" },
      printouts: [printout(PASTEUR_PRINTOUT, "2026-09-19T08:30:00+07:00")],
      sheet: { address: { vi: "Phường Sài Gòn, TP. Hồ Chí Minh", en: "Sài Gòn Ward, Hồ Chí Minh City" }, operator: THEN_CUA },
    },
  ),
  issued("cer-may-song", "R1-CER-2026-H3NV6PXA", "maySong", null, "2026-09-12T03:10:00+07:00", { from: "2026-09-12", to: "2027-09-11" }, null),
  issued("cer-lintel-thao-dien", "R1-CER-2026-F9RB2KXN", "lintelThaoDien", "OBD-3XWP7KDA5N", "2026-09-11T10:02:00+07:00", { from: "2026-09-11", to: "2027-09-10" }, null),
  issued("cer-da-kao", "R1-CER-2026-D4KX7MQA", "daKao", "OBD-4NPV8CRA2J", "2026-09-10T15:02:00+07:00", { from: "2026-09-10", to: "2027-09-09" }, null),
  issued("cer-hat-me", "R1-CER-2026-M2QT7VHD", "hatMe", null, "2026-09-05T08:47:00+07:00", { from: "2026-09-05", to: "2027-09-04" }, null, {
    periods: [
      { decision: null, from: "2026-09-05", to: "2027-09-04", governedFrom: "2026-09-05T08:47:00+07:00", governedTo: "2026-09-12T00:02:00+07:00", cause: "ISSUE", followUp: null },
      { decision: null, from: "2026-09-05", to: "2027-09-04", governedFrom: "2026-09-12T00:02:00+07:00", governedTo: null, cause: "AMENDMENT", followUp: "CFU-6DQX4MKT9B" },
    ],
  }),
  issued("cer-ap-mai", "R1-CER-2026-W5HK8TQM", "apMai", "OBD-5WRM8KTC3H", "2026-09-02T16:24:00+07:00", { from: "2026-09-02", to: "2027-09-01" }, null, {
    holder: AP_MAI,
  }),
  // Amended on 28 Sep 2026 by follow-up CFU-3KV8TQ2MXD (same holder): still Active since its issue, its period now
  // OBD-2YDA7KMS5X's from 11:20, when the late follow-up was recorded.
  issued("cer-le-thanh-ton", "R1-CER-2026-K9TE4WQC", "leThanhTon", "OBD-6RHC4WNE9B", "2026-09-02T15:05:00+07:00", { from: "2026-09-02", to: "2027-09-01" }, "STRAIGHT_THROUGH", {
    periods: [
      { decision: "OBD-6RHC4WNE9B", from: "2026-09-02", to: "2027-09-01", governedFrom: "2026-09-02T15:05:00+07:00", governedTo: "2026-09-28T11:20:00+07:00", cause: "ISSUE", followUp: null },
      { decision: "OBD-2YDA7KMS5X", from: "2026-09-28", to: "2027-09-01", governedFrom: "2026-09-28T11:20:00+07:00", governedTo: null, cause: "AMENDMENT", followUp: "CFU-3KV8TQ2MXD" },
    ],
  }),
];

// ================================================================== the reviews

export interface SeedProposal {
  at: string;
  by: SeedPerson | null;
  act: StatusAct;
  statusWhenProposed: RecordStatus;
  ground: GroundCode | null;
  reason: Written | null;
  evidence: readonly string[];
  effectiveAt: string | null;
}

export interface SeedReview {
  reference: string;
  record: string;
  trigger:
    | { kind: "PAYMENT_REVERSAL"; event: string; at: string }
    | { kind: "CASE"; caseRef: string; letter: string | null; letterOn: string | null }
    | { kind: "OFFICER" };
  openedAt: string;
  state: "OPEN" | "PROPOSED" | "APPROVED";
  proposal: SeedProposal | null;
  approval: SeedPerson | null;
}

const LUONG = "Phan Gia Lượng";
const KHAI = "Thạch Minh Khải";
const OFFICER = "Cán bộ vận hành";
const APPROVER = "Người duyệt nghiệp vụ";

/**
 * SCR-CER-04's reviews. Pasteur's opened from the card chargeback FIN-EV-3114 and carries Phan Gia Lượng's proposal
 * to suspend from 14:00; Mây Sông's opened from case CAS-2026-0418 and has no proposal yet; Lê Thánh Tôn's closed
 * on 22 September with no change. The boards draw neither the proposer nor the reason of that closed one.
 */
export const CER_REVIEWS: readonly SeedReview[] = [
  {
    reference: "CSR-2HMW7QXK4T",
    record: "cer-le-thanh-ton",
    trigger: { kind: "CASE", caseRef: "CAS-2026-0391", letter: null, letterOn: null },
    // The boards draw only the day it was approved, and list it first among every state: its times are that day's start.
    openedAt: "2026-09-22T00:00:00+07:00",
    state: "APPROVED",
    proposal: { at: "2026-09-22T00:00:00+07:00", by: null, act: "NO_CHANGE", statusWhenProposed: "ACTIVE", ground: null, reason: null, evidence: [], effectiveAt: null },
    approval: { name: KHAI, position: APPROVER, at: "2026-09-22T00:00:00+07:00" },
  },
  {
    reference: "CSR-6PX2WN8KTA",
    record: "cer-may-song",
    trigger: { kind: "CASE", caseRef: "CAS-2026-0418", letter: "IN-5528", letterOn: "2026-09-29" },
    openedAt: "2026-09-30T14:20:00+07:00",
    state: "OPEN",
    proposal: null,
    approval: null,
  },
  {
    reference: "CSR-4TN7QK2MVD",
    record: "cer-pasteur",
    trigger: { kind: "PAYMENT_REVERSAL", event: "FIN-EV-3114", at: "2026-09-30T17:42:00+07:00" },
    openedAt: "2026-09-30T17:45:00+07:00",
    state: "PROPOSED",
    proposal: {
      at: "2026-10-01T09:05:00+07:00",
      by: { name: LUONG, position: OFFICER, at: "2026-10-01T09:05:00+07:00" },
      act: "SUSPEND",
      statusWhenProposed: "ACTIVE",
      ground: "GR-PAYMENT-REVERSED",
      reason: { vi: "Chủ thẻ đòi lại toàn bộ khoản phí 986.000 VND", en: "Card chargeback of the whole fee, 986,000 VND" },
      evidence: ["FIN-EV-3114"],
      effectiveAt: "2026-10-01T14:00:00+07:00",
    },
    approval: null,
  },
];

// ================================================================== the follow-ups

export interface SeedFollowUp {
  reference: string;
  record: string;
  decision: string | null;
  superseded: string | null;
  change: Written | null;
  dueBy: string;
  state: "OPEN" | "APPLIED";
  /** RightOne could not apply it itself: the decision could not be read when it arrived. */
  decisionUnreadable: boolean;
  applied: { outcome: FollowUpOutcome; at: string; by: string | null; reason: Written | null } | null;
  /** Why it was applied late, as the history writes it under the row. */
  lateWhy: Written | null;
}

/**
 * SCR-CER-07's follow-ups: The Lintel Coffee – Thảo Điền's amendment, overdue since midnight on 1 October; Hạt
 * Mè's, applied two minutes after it was due; Lê Thánh Tôn's change, applied 11 h 20 min late.
 */
export const CER_FOLLOW_UPS: readonly SeedFollowUp[] = [
  {
    reference: "CFU-8WN3KT6QPA",
    record: "cer-lintel-thao-dien",
    decision: "OBD-8NQV4TRC6W",
    superseded: "OBD-3XWP7KDA5N",
    change: { vi: "Thêm nhạc sống: quyền của người biểu diễn nay thuộc phạm vi", en: "Live music added: performers’ rights are now in scope" },
    dueBy: "2026-10-01T00:00:00+07:00",
    state: "OPEN",
    decisionUnreadable: true,
    applied: null,
    lateWhy: null,
  },
  {
    reference: "CFU-6DQX4MKT9B",
    record: "cer-hat-me",
    decision: null,
    superseded: null,
    change: null,
    dueBy: "2026-09-12T00:00:00+07:00",
    state: "APPLIED",
    decisionUnreadable: false,
    applied: { outcome: "AMEND", at: "2026-09-12T00:02:00+07:00", by: null, reason: null },
    lateWhy: null,
  },
  {
    reference: "CFU-3KV8TQ2MXD",
    record: "cer-le-thanh-ton",
    decision: "OBD-2YDA7KMS5X",
    superseded: "OBD-6RHC4WNE9B",
    change: null,
    dueBy: "2026-09-28T00:00:00+07:00",
    state: "APPLIED",
    decisionUnreadable: false,
    applied: { outcome: "AMEND", at: "2026-09-28T11:20:00+07:00", by: null, reason: null },
    lateWhy: {
      vi: "Không đọc được quyết định nghĩa vụ lúc 0:00; thử lại lúc 6:00 cũng không được.",
      en: "The obligation decision could not be read at 00:00, nor on the retry at 06:00.",
    },
  },
];

// ================================================================== the policy and the keys

/** A version of rule code `CER-ENFORCEMENT` as GOV publishes it (`FR-CER-025`). */
export interface SeedPolicyVersion {
  code: "CER-ENFORCEMENT";
  /** The version identifier `IRuleVersionResolver.Resolve` answers, which a status change records. */
  version: string;
  /** The first day it is in force; a published version is in force from then until the next one's. */
  effective: string;
  state: "PUBLISHED" | "DRAFT";
  grounds: readonly { code: GroundCode; acts: readonly StatusAct[]; condition: ConditionCode | null }[];
  /** The working days a holder has to lodge an appeal against a change on any of its grounds (`DR-439`). */
  appealWorkingDays: number;
}

/**
 * `CER-ENFORCEMENT` as the boards draw it in force (version 1, effective 1 September 2026; findings F-9): which
 * acts each ground permits, the condition that reinstates a suspension on it, and the working days a holder has
 * to appeal, the only lodging period the boards give (F-8). SCR-CER-05's cancel view draws "a fact the record rests
 * on is false" as a ground for suspend and revoke only.
 */
export const CER_POLICY: SeedPolicyVersion = {
  code: "CER-ENFORCEMENT",
  version: "1",
  effective: "2026-09-01",
  state: "PUBLISHED",
  grounds: [
    { code: "GR-PAYMENT-REVERSED", acts: ["SUSPEND"], condition: "RC-SETTLED" },
    { code: "GR-FALSE-FACT", acts: ["SUSPEND", "REVOKE"], condition: "RC-FACT-CORRECTED" },
    { code: "GR-ISSUED-IN-ERROR", acts: ["CANCEL"], condition: null },
  ],
  appealWorkingDays: 15,
};

/** Every version of `CER-ENFORCEMENT` GOV holds, as the boards know them: version 1 alone, published. */
export const CER_POLICY_VERSIONS: readonly SeedPolicyVersion[] = [CER_POLICY];

/**
 * A status record definition GOV approved (`DEC-02`, `FR-CER-019`): the four texts a record copies when it issues,
 * the code of its issuer in a signed payload, and the period its validity conditions set, none for the interim of
 * `BR-CER-09`. The boards draw version 2026.1 as the wording every record they show was issued under.
 */
export interface SeedDefinition {
  id: string;
  version: string;
  /** The first day it is in force. */
  effectiveFrom: string;
  legalName: Readonly<Record<Locale, string>>;
  legalNature: Readonly<Record<Locale, string>>;
  legalEffect: Readonly<Record<Locale, string>>;
  issuer: Readonly<Record<Locale, string>>;
  issuerCode: string;
  /** `DR-433`: months the validity conditions set from the decision's first day; null where they set no period. */
  validityMonths: number | null;
}

export const CER_DEFINITIONS: readonly SeedDefinition[] = [
  {
    id: "SRD-2026.1",
    version: "2026.1",
    effectiveFrom: "2026-09-01",
    legalName: { vi: "Giấy xác nhận của cơ sở", en: "Premises status record" },
    legalNature: { vi: "Xác nhận trạng thái tuân thủ tại một thời điểm", en: "Confirmation of compliance status at a point in time" },
    legalEffect: {
      vi: "Giấy này xác nhận cơ sở đã đăng ký và đã thanh toán nghĩa vụ bản quyền âm nhạc cho kỳ ghi trên giấy, theo phạm vi của các tổ chức tham gia. Giấy không xác nhận quyền với tác phẩm nằm ngoài phạm vi đó, và không thay thế giấy phép của cơ quan nhà nước.",
      en: "The record confirms that the premises has registered and has paid its music copyright obligation for the period shown, within the scope of the participating organisations. It does not confirm rights in works outside that scope and does not replace a licence issued by a state authority.",
    },
    issuer: { vi: "Cổng một cửa về quyền tác giả âm nhạc", en: "The one-stop gateway for music copyright" },
    issuerCode: "R1-OSG",
    validityMonths: null,
  },
];

/**
 * TRN's answer to `ResolveAuthority("CERTIFICATE")`: from 1 September 2026, the day the boards' first key signs and
 * version 1 of the policy takes effect, RightOne issues records; before it the legacy system did, in parallel run.
 */
export const ISSUING_AUTHORITY: readonly { from: string; system: "RIGHTONE" | "LEGACY" }[] = [{ from: "2026-09-01T00:00:00+07:00", system: "RIGHTONE" }];

/** DAT's purpose register (`IPurposeLimits.MayProcess`): the activity that issues records may use a premises' data from that day. */
export const PROCESSING_PURPOSES: readonly { activity: "certificate issue"; from: string }[] = [{ activity: "certificate issue", from: "2026-09-01" }];

/**
 * Where a holder's notices go (COM's recipient): its RightOne ID organisation and the address its principal gave.
 * A holder RightOne ID does not know is named as the party itself, with no address, and COM records the notice
 * it cannot send as unmet.
 */
export const HOLDER_CONTACTS: Readonly<Record<string, { party: string; address: string }>> = {
  [THEN_CUA]: { party: "tcv", address: "trang.do@thencuaviet.vn" },
};

export interface SeedKey {
  kid: string;
  /** The key service's handle; the private half never leaves it (SEC-433). */
  handle: string;
  validFrom: string;
  state: "ACTIVE" | "RETIRED" | "REVOKED";
  /** Printouts signed before this world began, across every record. */
  signed: number;
}

/** SCR-CER-10's keys: the one that signs now, 318 printouts in, and the one that takes over next September. */
export const CER_KEYS: readonly SeedKey[] = [
  { kid: "CK-2026-01", handle: "kms://r1/cert/2026-01", validFrom: "2026-09-01T00:00:00+07:00", state: "ACTIVE", signed: 318 },
  { kid: "CK-2027-01", handle: "kms://r1/cert/2027-01", validFrom: "2027-09-01T00:00:00+07:00", state: "ACTIVE", signed: 0 },
];

/** Where the code on a printout leads: the public verification page of the record, as the sheet prints it. */
export const VERIFY_BASE = "rightone.vn/v/";

// ================================================================== review states of the consoles

/**
 * The states a console page can be forced into with `?view=`, for design review: those no act in the portal
 * reaches, because the mock's services never fail. Each page lists the ones its board draws.
 */
export type ConsoleView =
  | "loading"
  | "error"
  | "unavailable"
  | "cursor-invalid"
  | "policy-unavailable"
  | "decision-unavailable"
  | "no-policy"
  | "empty"
  | "signing-unavailable";

export const CER01_VIEWS = ["loading", "error", "cursor-invalid"] as const satisfies readonly ConsoleView[];
export const CER02_VIEWS = ["loading", "error", "unavailable"] as const satisfies readonly ConsoleView[];
export const CER03_VIEWS = ["loading", "error"] as const satisfies readonly ConsoleView[];
export const CER04_VIEWS = ["loading", "error", "cursor-invalid"] as const satisfies readonly ConsoleView[];
export const CER05_VIEWS = ["loading", "error", "no-policy", "policy-unavailable"] as const satisfies readonly ConsoleView[];
export const CER06_VIEWS = ["loading", "error", "policy-unavailable"] as const satisfies readonly ConsoleView[];
export const CER07_VIEWS = ["loading", "error", "cursor-invalid", "decision-unavailable"] as const satisfies readonly ConsoleView[];
export const CER08_VIEWS = ["loading", "error"] as const satisfies readonly ConsoleView[];
export const CER09_VIEWS = ["loading", "error"] as const satisfies readonly ConsoleView[];
export const CER10_VIEWS = ["loading", "error", "empty", "signing-unavailable"] as const satisfies readonly ConsoleView[];

/** The console screens, by the code of their board. */
export type ConsoleScreen = "cer01" | "cer02" | "cer03" | "cer04" | "cer05" | "cer06" | "cer07" | "cer08" | "cer09" | "cer10";

/** The trace id each board prints under its error state. */
const TRACES: Readonly<Record<ConsoleScreen, string>> = {
  cer01: "6b2e9d40c7f15a38",
  cer02: "d41a7c2e09b83f65",
  cer03: "8e5c03b9a1f6d274",
  cer04: "a71c3e95d04b62f8",
  cer05: "5e2b97c04a1f86d3",
  cer06: "c39f0d18b7e6a254",
  cer07: "7c1e9a40d3b58f26",
  cer08: "b42f8d07e6a1c935",
  cer09: "e05b3c9a71f2d846",
  cer10: "3d8a6f1c0e94b275",
};

/**
 * A console view that replaces the page's answer with a failure: our outage with the board's trace, or a refusal no
 * act reaches here because the mock's services never fail. Views that change only part of a live answer (no policy,
 * an empty key list, signing down) are `PARTIAL_VIEWS`, applied by the seam over the live read.
 */
export function mockConsoleView(screen: ConsoleScreen, view: ConsoleView): LoadOutcome<never> {
  switch (view) {
    case "unavailable":
      return failure("REFERENCE_DATA_UNAVAILABLE", true);
    case "cursor-invalid":
      return failure("CURSOR_INVALID", false);
    case "policy-unavailable":
      return failure("POLICY_READ_UNAVAILABLE", true);
    case "decision-unavailable":
      return failure("DECISION_READ_UNAVAILABLE", true);
    default:
      return failure("INTERNAL_ERROR", true, TRACES[screen]);
  }
}

/** The views a seam applies over the live answer rather than in place of it. */
export const PARTIAL_VIEWS: readonly ConsoleView[] = ["no-policy", "policy-unavailable", "empty", "signing-unavailable"];

// ================================================================== SCR-CER-11 to 13, review states of the premises portal

/** The view states SCR-CER-11 was drawn in on the design canvas. */
export const CER11_VIEWS = ["one", "amended", "empty", "premises-required", "not-authorised", "unavailable", "loading", "error"] as const;
export type Cer11View = (typeof CER11_VIEWS)[number];

/** When the canvas reads the list: 1 October 2026, 10:14 in Ho Chi Minh. */
const AS_OF = "2026-10-01T10:14:00+07:00";

const PASTEUR = CER_PREMISES.pasteur.name;
const LE_THANH_TON = CER_PREMISES.leThanhTon.name;
const SALA = CER_PREMISES.sala.name;

/**
 * SCR-CER-11's answers, per view. Pasteur holds one active record since its issue on 18 September 2026;
 * Lê Thánh Tôn keeps one record amended by the change decided on 28 September (the holder stayed, so the
 * record was amended rather than replaced); Sala has none yet.
 */
export function mockPremisesStatusRecords(view: Exclude<Cer11View, "loading">): LoadOutcome<PremisesStatusRecords> {
  switch (view) {
    case "one":
      return {
        data: {
          premises: PASTEUR,
          premisesId: "pasteur",
          register: CER_PREMISES.pasteur.register,
          party: THEN_CUA,
          asOf: AS_OF,
          records: [{ reference: PASTEUR_REF, premises: null, state: "active", since: "2026-09-18", from: "2026-09-18", to: "2027-09-17", followsChangeOn: null }],
          pending: [],
          nextCursor: null,
        },
        failure: null,
      };
    case "amended":
      return {
        data: {
          premises: LE_THANH_TON,
          premisesId: "ltt",
          register: CER_PREMISES.leThanhTon.register,
          party: THEN_CUA,
          asOf: AS_OF,
          pending: [],
          records: [
            { reference: "R1-CER-2026-K9TE4WQC", premises: null, state: "active", since: "2026-09-02", from: "2026-09-28", to: "2027-09-01", followsChangeOn: "2026-09-28" },
          ],
          nextCursor: null,
        },
        failure: null,
      };
    case "empty":
      return {
        data: { premises: SALA, premisesId: "sala", register: CER_PREMISES.sala.register, party: THEN_CUA, asOf: AS_OF, records: [], pending: [], nextCursor: null },
        failure: null,
      };
    case "premises-required":
      return failure("PREMISES_FILTER_REQUIRED", false);
    case "not-authorised":
      return failure("NOT_AUTHORISED_FOR_PREMISES", false);
    case "unavailable":
      return failure("REFERENCE_DATA_UNAVAILABLE", true);
    case "error":
      return failure("INTERNAL_ERROR", true, "3e8b51d7a04c9f26");
  }
}

/** The view states SCR-CER-12 was drawn in. */
export const CER12_VIEWS = [
  "active",
  "printing",
  "printed",
  "suspended",
  "not-current-print",
  "signing-unavailable",
  "not-printable",
  "printout-not-found",
  "not-authorised",
  "not-found",
  "unavailable",
  "loading",
  "error",
] as const;
export type Cer12View = (typeof CER12_VIEWS)[number];

/** The view states SCR-CER-13, the printed sheet, was drawn in. */
export const CER13_VIEWS = ["printout", "household", "error"] as const;
export type Cer13View = (typeof CER13_VIEWS)[number];

const NGUYEN_HUE = CER_PREMISES.nguyenHue.name;

/** The definition every record the canvas draws was issued under, as the record pages copy it. */
const DRAWN_DEFINITION = (() => {
  const definition = CER_DEFINITIONS[0];
  if (definition === undefined) throw new Error("the boards draw one definition");
  const { id, version, legalName, legalNature, legalEffect, issuer } = definition;
  return { id, version, legalName, legalNature, legalEffect, issuer };
})();

/**
 * The records SCR-CER-12 opens, from the data sheet: Pasteur's, issued at 11:40 on 18 September once its fee
 * was reconciled and printed the next morning; and Nguyễn Huệ's, issued on 24 September and never printed.
 * Each carries the printout a Print would make.
 */
const RECORDS: Readonly<Record<string, { record: StatusRecord; made: PrintoutSummary; views: readonly Cer12View[] }>> = {
  [PASTEUR_REF]: {
    record: {
      reference: PASTEUR_REF,
      key: PASTEUR_REF,
      premises: PASTEUR,
      premisesId: "pasteur",
      holder: THEN_CUA,
      state: "active",
      waitingOn: [],
      since: "2026-09-18T11:40:00+07:00",
      current: true,
      period: { from: "2026-09-18", to: "2027-09-17", decision: "OBD-3FJW6NRA5C" },
      earlierPeriods: [],
      standing: null,
      premisesClass: "cafe",
      printouts: [printout(PASTEUR_PRINTOUT, "2026-09-19T08:30:00+07:00")],
      definition: DRAWN_DEFINITION,
    },
    made: printout("CRP-7DQM3XRK2W", AS_OF),
    views: ["active", "printing", "printed", "suspended", "not-current-print", "signing-unavailable", "not-printable", "printout-not-found"],
  },
  // The board draws Nguyễn Huệ's record for the delegate; its suspended and not-current views are Pasteur's.
  "R1-CER-2026-N6PZ2RKE": {
    record: {
      reference: "R1-CER-2026-N6PZ2RKE",
      key: "R1-CER-2026-N6PZ2RKE",
      premises: NGUYEN_HUE,
      premisesId: "nh",
      holder: THEN_CUA,
      state: "active",
      waitingOn: [],
      since: "2026-09-24T16:52:00+07:00",
      current: true,
      period: { from: "2026-09-24", to: "2027-09-23", decision: "OBD-8KWT2PZH6M" },
      earlierPeriods: [],
      standing: null,
      premisesClass: "cafe",
      printouts: [],
      definition: DRAWN_DEFINITION,
    },
    made: printout("CRP-2VJH8MTC5Q", AS_OF),
    views: ["active", "printing", "printed", "signing-unavailable", "not-printable", "printout-not-found"],
  },
};

/**
 * SCR-CER-12's answers, by record and view. Pasteur's record is suspended from 14:00 on 1 October, after the
 * chargeback of its whole fee; a view drawn for another record falls back to this record's own page.
 */
export function mockStatusRecord(reference: string, view: Exclude<Cer12View, "loading">): LoadOutcome<StatusRecordPage> {
  switch (view) {
    case "error":
      return failure("INTERNAL_ERROR", true, "c71f0a4d2e98b635");
    case "unavailable":
      return failure("REFERENCE_DATA_UNAVAILABLE", true);
    case "not-authorised":
      return failure("NOT_AUTHORISED_FOR_PREMISES", false);
    case "not-found":
      return failure("CERTIFICATE_NOT_FOUND", false);
  }
  const drawn = RECORDS[reference];
  if (drawn === undefined) return failure("CERTIFICATE_NOT_FOUND", false);
  const page: StatusRecordPage = { record: drawn.record, printAnswer: null, printoutRefusal: null };
  switch (drawn.views.includes(view) ? view : "active") {
    case "suspended":
      return {
        data: {
          ...page,
          record: {
            ...drawn.record,
            state: "suspended",
            since: "2026-10-01T14:00:00+07:00",
            current: false,
            standing: {
              kind: "suspended",
              ground: "GR-PAYMENT-REVERSED",
              reason: { vi: "Chủ thẻ đòi lại toàn bộ khoản phí 986.000 VND.", en: "Card chargeback of the whole fee, 986,000 VND." },
              condition: "RC-SETTLED",
              appealBy: "2026-10-22",
              remedy: { kind: "APPEAL", route: "CAS", closesOn: "2026-10-22" },
            },
          },
        },
        failure: null,
      };
    case "printed":
      return {
        data: {
          record: { ...drawn.record, printouts: [drawn.made, ...drawn.record.printouts] },
          printAnswer: { outcome: "made", printout: drawn.made },
          printoutRefusal: null,
        },
        failure: null,
      };
    case "signing-unavailable":
      return { data: { ...page, printAnswer: { outcome: "refused", code: "SIGNING_UNAVAILABLE" } }, failure: null };
    case "not-current-print":
      return { data: { ...page, printAnswer: { outcome: "refused", code: "RECORD_NOT_CURRENT" } }, failure: null };
    case "not-printable":
      return { data: { ...page, printoutRefusal: "NOT_A_PRINTABLE_REPRESENTATION" }, failure: null };
    case "printout-not-found":
      return { data: { ...page, printoutRefusal: "REPRESENTATION_NOT_FOUND" }, failure: null };
    default:
      return { data: page, failure: null };
  }
}

/** Pasteur's printout of 19 September 2026, 08:30, the one the sheet on the canvas shows. */
const PASTEUR_SHEET: StatusRecordPrintout = {
  record: PASTEUR_REF,
  premises: PASTEUR,
  address: { vi: "Phường Sài Gòn, TP. Hồ Chí Minh", en: "Sài Gòn Ward, Hồ Chí Minh City" },
  operator: THEN_CUA,
  period: { from: "2026-09-18", to: "2027-09-17" },
  decision: "OBD-3FJW6NRA5C",
  premisesClass: "cafe",
  stateWhenPrinted: "active",
  printedAt: "2026-09-19T08:30:00+07:00",
  printout: PASTEUR_PRINTOUT,
  signingKey: SIGNING_KEY,
  verifyUrl: `${VERIFY_BASE}${PASTEUR_REF}`,
  // The canvas draws the code as the route alone; a printout made in the portal carries its signed payload too.
  code: `${VERIFY_BASE}${PASTEUR_REF}?r=${PASTEUR_PRINTOUT}`,
  definition: DRAWN_DEFINITION,
};

/**
 * SCR-CER-13's answers. The household view is the same sheet for a household business, whose owner's name is
 * never printed. A record the canvas drew no printout for has none to open.
 */
export function mockStatusRecordPrintout(reference: string, view: Cer13View): LoadOutcome<StatusRecordPrintout> {
  if (view === "error") return failure("INTERNAL_ERROR", true, "9c41e07b2d5a8f36");
  if (reference !== PASTEUR_SHEET.record) return failure("REPRESENTATION_NOT_FOUND", false);
  return { data: view === "household" ? { ...PASTEUR_SHEET, operator: null } : PASTEUR_SHEET, failure: null };
}

/** The holder's printed sheet of Pasteur's record, the one the canvas draws (the seed's sheet). */
export const PASTEUR_PRINTOUT_REFERENCE = PASTEUR_PRINTOUT;
