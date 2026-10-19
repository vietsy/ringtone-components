import type { LoadOutcome } from "@rightone/ui";
import type {
  Acknowledgement,
  AnswerOutcome,
  Appointment,
  AttachedAnswer,
  Conclusion,
  ConclusionDraft,
  FailedResult,
  FieldDevice,
  FieldHome,
  InspectionInProgress,
  InspectionLists,
  InspectionRecord,
  InspectionStart,
  ListKind,
  ListSupply,
  OpenInspectionSummary,
  Period,
  PremisesName,
  Purpose,
  ReferralRoute,
  RefusalCode,
  RegisterRead,
  RepresentativeRole,
  ScanAndVerify,
  Supply,
  SupplyCounts,
  SupplyEntry,
  UploadedResult,
  VerificationAnswer,
  WaitingResult,
  FindingKind,
  FollowUpKind,
  Outcome,
  AuthorityLevel,
  StaffStamp,
  Standing,
} from "@/lib/api/inspection";
import type { Locale } from "@/lib/i18n/translate";
import { MOCK_INSPECTOR } from "./session";

/*
 * The inspector's screens as the design canvas draws them (SCR-VER-17, -01 to -08): one answer per view state,
 * which `?view=` shows for design review, and at the end of the file the canvas's world the mock backend
 * (`lib/mock/backend/inspection.ts`) is seeded from. The canvas reads everything on 30 September 2026 at 10:14
 * in Ho Chi Minh. Âu Thị Ngọc Diệp holds two appointments, for KTVH-KV1 and KTVH-KV3; her open inspection at
 * Then Cửa Coffee & Tea – Pasteur is ISP-2QK7TM4W8E, and its record is IRC-7T2MW9KQ4D.
 *
 * The boards do not agree with one another everywhere: the answer SCR-VER-03 starts from is about
 * Lê Thánh Tôn, and SCR-VER-05 concludes ISP-5H3WQ8KM2A at Quán Nướng Hẻm 214. Each review state keeps its own
 * board's data rather than a record made up to join them; the seed joins only what the canvas itself joins.
 */

/** The view states each board was drawn in, in the board's order. */
export const VER17_VIEWS = [
  "populated",
  "empty",
  "offline",
  "p1-queue",
  "update",
  "no-appointment",
  "suspended",
  "authority-not-active",
  "policy-unavailable",
  "cursor-invalid",
  "signout-confirm",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver17View = (typeof VER17_VIEWS)[number];

export const VER01_VIEWS = [
  "online",
  "offline",
  "keys-expiring",
  "no-keys",
  "keys-unavailable",
  "checking",
  "camera-denied",
  "record-offline",
  "row-refused",
  "no-appointment",
  "appointment-required",
  "suspended",
  "discard-confirm",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver01View = (typeof VER01_VIEWS)[number];

export const VER02_VIEWS = [
  "unable",
  "invalid",
  "invalid-type",
  "offline-keys",
  "online",
  "online-from-inspection",
  "state-suspended",
  "public-set",
  "no-record",
  "no-premises",
  "no-current-record",
  "ambiguous",
  "not-authenticated",
  "offline",
  "answer-not-found",
  "payload-mismatch",
  "not-for-premises",
  "no-appointment",
  "premises-unavailable",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver02View = (typeof VER02_VIEWS)[number];

export const VER03_VIEWS = [
  "populated",
  "open-exists",
  "answer-refused",
  "last-day",
  "late",
  "time-in-future",
  "offline",
  "no-appointment",
  "suspended",
  "outside",
  "jurisdiction-not-recorded",
  "observed-outside",
  "premises-unavailable",
  "policy-unavailable",
  "cursor-invalid",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver03View = (typeof VER03_VIEWS)[number];

export const VER04_VIEWS = [
  "populated",
  "empty",
  "waiting-offline",
  "offline",
  "note-required",
  "row-refused",
  "last-day",
  "not-open",
  "not-found",
  "no-appointment",
  "suspended",
  "policy-unavailable",
  "abandon-confirm",
  "abandon-reason-missing",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver04View = (typeof VER04_VIEWS)[number];

/** SCR-VER-05 has no loading state on the canvas: it opens on what SCR-VER-04 already read. */
export const VER05_VIEWS = [
  "penalty-refused",
  "guidance",
  "outcome-not-supported",
  "not-current",
  "contradicts",
  "guidance-missing",
  "representative-missing",
  "follow-up-invalid",
  "delay-missing",
  "offline-waiting",
  "confirm-offline-waiting",
  "no-network",
  "not-open",
  "case-intake-unavailable",
  "certificate-unavailable",
  "premises-unavailable",
  "no-appointment",
  "not-found",
  "confirm",
  "not-authorised",
  "error",
] as const;
export type Ver05View = (typeof VER05_VIEWS)[number];

export const VER06_VIEWS = [
  "pending",
  "handed-over",
  "corrected",
  "challenge-unknown",
  "offline",
  "not-issuing",
  "already-delivered",
  "handover-time-invalid",
  "no-appointment",
  "premises-unavailable",
  "policy-unavailable",
  "record-not-found",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver06View = (typeof VER06_VIEWS)[number];

/** Who reads SCR-VER-06 on the canvas: the authority that issued the record, or another one. */
export const VER06_READERS = ["issuing", "other"] as const;
export type Ver06Reader = (typeof VER06_READERS)[number];

export const VER07_VIEWS = [
  "populated",
  "p1-failed",
  "outside",
  "limit",
  "appointment-required",
  "no-appointment",
  "suspended",
  "jurisdiction-not-recorded",
  "premises-unavailable",
  "policy-unavailable",
  "cursor-invalid",
  "filtered",
  "empty",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver07View = (typeof VER07_VIEWS)[number];

export const VER08_VIEWS = [
  "ready",
  "entry-selected",
  "kind-not-current",
  "empty-limited",
  "failed-register",
  "failed-record",
  "failed-scope",
  "failed-decision",
  "failed-timeout",
  "not-ready",
  "disposed",
  "no-appointment",
  "cursor-invalid",
  "not-found",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Ver08View = (typeof VER08_VIEWS)[number];

// ------------------------------------------------------------------ the canvas's sample data

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({
  data: null,
  failure: { code, traceId, retryable },
});

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

const KV1_AREAS = ["Phường Sài Gòn", "Phường Bến Thành", "Phường Tân Định", "Phường Cầu Ông Lãnh"] as const;

const KV1: Appointment = {
  id: "kv1",
  authorityCode: "KTVH-KV1",
  authority: "KTVH-KV1 – Đội Kiểm tra Văn hoá Khu vực 1",
  areas: KV1_AREAS,
};

const KV3: Appointment = {
  id: "kv3",
  authorityCode: "KTVH-KV3",
  authority: "KTVH-KV3 – Đội Kiểm tra Văn hoá Khu vực 3",
  areas: ["Phường Xuân Hoà", "Phường Nhiêu Lộc", "Phường Bàn Cờ"],
};

const LE_THANH_TON: PremisesName = {
  name: "Then Cửa Coffee & Tea – Lê Thánh Tôn",
  address: "74 Lê Thánh Tôn, Phường Sài Gòn, TP. Hồ Chí Minh",
};
const HEM_214: PremisesName = { name: "Quán Nướng Hẻm 214", address: "Hẻm 214 Cô Giang, Phường Cầu Ông Lãnh, TP. Hồ Chí Minh" };
const PASTEUR: PremisesName = { name: "Then Cửa Coffee & Tea – Pasteur", address: "212 Pasteur, Phường Xuân Hoà, TP. Hồ Chí Minh" };
const DA_KAO: PremisesName = { name: "Then Cửa Bakery – Đa Kao", address: "9 Đinh Tiên Hoàng, Phường Tân Định, TP. Hồ Chí Minh" };

/** The inspection the field client's thread runs through, and the record it ends in. */
const OPEN_INSPECTION = "ISP-2QK7TM4W8E";
const ISSUED_RECORD = "IRC-7T2MW9KQ4D";
/** The record the corrected view reads: Đa Kao's, version 2, corrected under a case. */
const CORRECTED_RECORD = "IRC-3XK7QW2MTD";
/** The online answer SCR-VER-02 draws, which SCR-VER-03 starts the inspection from. */
const ONLINE_ANSWER = "VRA-9KD4QW7M2T";

/** The phone as the canvas draws it in most views: online, its key valid until 7 October, one result waiting. */
export const MOCK_FIELD_DEVICE: FieldDevice = {
  network: "online",
  verificationKey: { state: "valid", until: "2026-10-07" },
  readAt: null,
  queue: { waiting: 1, failed: 0 },
};

const offlineDevice = (readAt: string | null): FieldDevice => ({ ...MOCK_FIELD_DEVICE, network: "offline", readAt });

// ------------------------------------------------------------------ SCR-VER-17

const OPEN_INSPECTIONS: readonly OpenInspectionSummary[] = [
  {
    reference: "ISP-5H3WQ8KM2A",
    premises: "Quán Nướng Hẻm 214",
    authorityCode: "KTVH-KV1",
    openedAt: "2026-09-29T09:41:00+07:00",
    pastRecordingInterval: true,
    recordableUntil: null,
  },
  {
    reference: OPEN_INSPECTION,
    premises: PASTEUR.name,
    authorityCode: "KTVH-KV3",
    openedAt: "2026-09-30T09:40:00+07:00",
    pastRecordingInterval: false,
    recordableUntil: null,
  },
  {
    reference: "ISP-6PW2KD8RQM",
    premises: "Áp Mái Bar – Thảo Điền",
    authorityCode: "KTVH-KV2",
    openedAt: "2026-09-29T16:20:00+07:00",
    pastRecordingInterval: false,
    recordableUntil: "2026-09-30T23:59:00+07:00",
  },
];

/**
 * SCR-VER-17's answers. With no appointment in force nothing is read, so there is no choice of appointment and
 * no list of open inspections; on the P1 fixture every upload is answered KEYS_UNAVAILABLE and the queue only grows.
 */
export function mockFieldHome(view: Exclude<Ver17View, "loading">): LoadOutcome<FieldHome> {
  const home: FieldHome = {
    device: MOCK_FIELD_DEVICE,
    appointments: [KV1, KV3],
    actingFor: KV1.id,
    refusal: null,
    openInspections: OPEN_INSPECTIONS,
    openInspectionsRefusal: null,
    storageAtRisk: false,
    updateReady: false,
  };
  switch (view) {
    case "populated":
    case "signout-confirm":
      return ok(home);
    case "empty":
      return ok({ ...home, openInspections: [] });
    case "offline":
      return ok({ ...home, device: offlineDevice("2026-09-30T07:02:00+07:00") });
    case "p1-queue":
      return ok({ ...home, device: { ...MOCK_FIELD_DEVICE, queue: { waiting: 23, failed: 0 } }, storageAtRisk: true });
    case "update":
      return ok({ ...home, updateReady: true });
    case "no-appointment":
      return ok({
        ...home,
        device: { ...MOCK_FIELD_DEVICE, queue: { waiting: 0, failed: 4 } },
        appointments: [],
        actingFor: null,
        refusal: "NO_EFFECTIVE_APPOINTMENT",
        openInspections: [],
      });
    case "suspended":
      return ok({ ...home, appointments: [], actingFor: null, refusal: "APPOINTMENT_SUSPENDED", openInspections: [] });
    case "authority-not-active":
      return ok({ ...home, refusal: "AUTHORITY_NOT_ACTIVE" });
    case "policy-unavailable":
      return ok({ ...home, refusal: "POLICY_READ_UNAVAILABLE" });
    case "cursor-invalid":
      return ok({ ...home, openInspections: [], openInspectionsRefusal: "CURSOR_INVALID" });
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "5c1e8a03d97b42f6");
  }
}

// ------------------------------------------------------------------ SCR-VER-01

const WAITING_ONE: readonly WaitingResult[] = [
  { id: "seed-waiting-1", representation: "CRP-7QX2M4KD9A", outcome: "LIMITED_OFFLINE", checkedAt: "2026-09-30T09:52:00+07:00", refusal: null },
];

/** P1: the keys cannot be read, so nothing checked offline can be checked or uploaded. */
const WAITING_P1: readonly WaitingResult[] = [
  { id: "p1-waiting-1", representation: "CRP-6TB5KN9XWE", outcome: "UNABLE_TO_VERIFY", checkedAt: "2026-09-30T09:58:00+07:00", refusal: null },
  { id: "p1-waiting-2", representation: "CRP-4RW8QJ2MVH", outcome: "UNABLE_TO_VERIFY", checkedAt: "2026-09-30T09:31:00+07:00", refusal: null },
  { id: "p1-waiting-3", representation: "CRP-9DK3XM7TPA", outcome: "UNABLE_TO_VERIFY", checkedAt: "2026-09-30T09:06:00+07:00", refusal: null },
  { id: "p1-waiting-4", representation: "CRP-2HN6WT8QKC", outcome: "UNABLE_TO_VERIFY", checkedAt: "2026-09-29T16:44:00+07:00", refusal: null },
  { id: "p1-waiting-5", representation: "CRP-7QX2M4KD9A", outcome: "UNABLE_TO_VERIFY", checkedAt: "2026-09-29T15:12:00+07:00", refusal: null },
];

const FAILED_ONE: readonly FailedResult[] = [
  { representation: "CRP-5WK2QT7M3H", refusal: "PAYLOAD_UNREADABLE", checkedAt: "2026-09-29T11:08:00+07:00" },
];

const UPLOADED: readonly UploadedResult[] = [
  { answer: "VRA-8MQ2TK5WXD", state: "REVOKED", differsFromDevice: true, checkedAt: "2026-09-29T16:05:00+07:00", refusal: null, notAttached: null },
  { answer: "VRA-3WT8KQ2M5N", state: "IN_FORCE", differsFromDevice: false, checkedAt: "2026-09-29T14:20:00+07:00", refusal: null, notAttached: null },
];

/**
 * SCR-VER-01's answers. Offline the phone checks a scan against the keys it holds; with no keys yet (a first run)
 * nothing was checked or uploaded. In production P1 every upload is refused NO_EFFECTIVE_APPOINTMENT, which is
 * permanent for a result made without an inspection.
 */
export function mockScanAndVerify(view: Exclude<Ver01View, "loading">): LoadOutcome<ScanAndVerify> {
  const scan: ScanAndVerify = {
    device: MOCK_FIELD_DEVICE,
    refusal: null,
    keysRefusal: null,
    camera: "scanning",
    scannedCode: null,
    checking: false,
    typedReference: "",
    scan: { printout: "", noCode: false },
    inspection: null,
    waiting: WAITING_ONE,
    uploaded: UPLOADED,
    failed: FAILED_ONE,
  };
  switch (view) {
    case "online":
    case "discard-confirm":
      return ok(scan);
    case "offline":
      return ok({ ...scan, device: offlineDevice(null) });
    case "keys-expiring":
      return ok({
        ...scan,
        device: { ...offlineDevice(null), verificationKey: { state: "expiring", until: "2026-10-01T07:00:00+07:00" } },
      });
    case "no-keys":
      return ok({
        ...scan,
        device: { ...offlineDevice(null), verificationKey: { state: "missing" } },
        waiting: [],
        uploaded: [],
        failed: [],
      });
    case "keys-unavailable":
      return ok({ ...scan, keysRefusal: "KEYS_UNAVAILABLE", waiting: WAITING_P1, uploaded: [], failed: [] });
    case "checking":
      return ok({ ...scan, camera: "found", scannedCode: "CRP-3HN8T2WQ5E", checking: true });
    case "camera-denied":
      return ok({ ...scan, camera: "denied" });
    case "record-offline":
      return ok({ ...scan, device: offlineDevice(null), camera: "found", scannedCode: ISSUED_RECORD });
    case "row-refused":
      return ok({
        ...scan,
        uploaded: UPLOADED.map((row) => (row.answer === "VRA-3WT8KQ2M5N" ? { ...row, refusal: "ANSWER_NOT_FOUND" } : row)),
      });
    case "no-appointment":
      return ok({
        ...scan,
        refusal: "NO_EFFECTIVE_APPOINTMENT",
        waiting: [],
        uploaded: [],
        failed: [
          { representation: "CRP-7QX2M4KD9A", refusal: "NO_EFFECTIVE_APPOINTMENT", checkedAt: "2026-09-30T09:52:00+07:00" },
          { representation: "CRP-5WK2QT7M3H", refusal: "NO_EFFECTIVE_APPOINTMENT", checkedAt: "2026-09-29T11:08:00+07:00" },
        ],
      });
    case "appointment-required":
      return ok({ ...scan, refusal: "APPOINTMENT_REQUIRED", typedReference: "R1-CER-2026-K9TE4WQC" });
    case "suspended":
      return ok({ ...scan, refusal: "APPOINTMENT_SUSPENDED" });
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "a42d7c19e05b836f");
  }
}

// ------------------------------------------------------------------ SCR-VER-02

const READ_AT = (second: string) => `2026-09-30T10:14:${second}+07:00`;

const ONLINE: VerificationAnswer = {
  device: MOCK_FIELD_DEVICE,
  reference: ONLINE_ANSWER,
  identifier: null,
  outcome: {
    kind: "CURRENT_RESULT",
    state: "IN_FORCE",
    record: "R1-CER-2026-K9TE4WQC",
    premises: LE_THANH_TON,
    stateSince: "2026-09-02T15:05:00+07:00",
    period: { from: "2026-09-28", to: "2027-09-01" },
    readAt: READ_AT("03"),
    representationCurrent: false,
    publicFieldSetReason: null,
  },
  inspection: null,
  attachRefusal: null,
};

/**
 * SCR-VER-02's answers, one per outcome of sections 5 and 5b. The online answer is a P3 capability: in P1 a
 * typed reference is answered UNABLE_TO_VERIFY, which is the board's default.
 */
export function mockVerificationAnswer(view: Exclude<Ver02View, "loading">): LoadOutcome<VerificationAnswer> {
  const answer = (reference: string, outcome: VerificationAnswer["outcome"]): LoadOutcome<VerificationAnswer> =>
    ok({ ...ONLINE, reference, outcome });
  switch (view) {
    case "online":
      return ok(ONLINE);
    case "online-from-inspection":
      return ok({ ...ONLINE, inspection: { reference: OPEN_INSPECTION, attached: true } });
    case "not-for-premises":
      return ok({ ...ONLINE, inspection: { reference: OPEN_INSPECTION, attached: false }, attachRefusal: "ANSWER_NOT_FOR_PREMISES" });
    case "state-suspended":
      return answer("VRA-4HX7QM2WKD", {
        kind: "CURRENT_RESULT",
        state: "SUSPENDED",
        record: "R1-CER-2026-V8JD3MRA",
        premises: { name: "Áp Mái Bar – Tôn Thất Thiệp", address: "17 Tôn Thất Thiệp, Phường Sài Gòn, TP. Hồ Chí Minh" },
        stateSince: "2026-09-22T16:30:00+07:00",
        period: { from: "2026-06-15", to: "2027-06-14" },
        readAt: READ_AT("41"),
        representationCurrent: true,
        publicFieldSetReason: null,
      });
    case "public-set":
      return answer("VRA-7NC2WT9KQE", {
        kind: "CURRENT_RESULT",
        state: "IN_FORCE",
        record: "R1-CER-2026-F9RB2KXN",
        premises: null,
        stateSince: "2026-09-11T10:02:00+07:00",
        period: { from: "2026-09-11", to: "2027-09-10" },
        readAt: READ_AT("22"),
        representationCurrent: true,
        publicFieldSetReason: "OUTSIDE_JURISDICTION",
      });
    case "unable":
      return answer("VRA-6RT3XW8KQB", { kind: "UNABLE_TO_VERIFY", cause: "SYSTEM" });
    case "invalid":
      return answer("VRA-2PX8MK5T3Q", { kind: "INVALID_INPUT", expectedFormat: "R1-CER-YYYY-XXXXXXXX", usableTypes: [] });
    case "invalid-type":
      return answer("VRA-5KW9QD3TXM", {
        kind: "INVALID_INPUT",
        expectedFormat: null,
        usableTypes: ["PUBLIC_REFERENCE", "REPRESENTATION_REFERENCE"],
      });
    case "offline-keys":
      return ok({
        ...ONLINE,
        device: { ...offlineDevice(null), verificationKey: { state: "missing" } },
        reference: null,
        outcome: { kind: "UNABLE_TO_VERIFY", cause: "NO_KEY" },
      });
    case "no-record":
      return answer("VRA-3QT6KX8MWA", { kind: "NO_RECORD" });
    case "no-premises":
      return answer("VRA-8WD4KQ2TXN", { kind: "NO_PREMISES_IN_JURISDICTION" });
    case "no-current-record":
      return answer("VRA-6MK3TQ9WXB", { kind: "NO_CURRENT_RECORD_FOR_PREMISES", premises: HEM_214, lastState: null });
    case "ambiguous":
      return answer("VRA-2TK8WQ5MXD", { kind: "AMBIGUOUS", count: 2 });
    case "not-authenticated":
      return answer("VRA-9XQ4MT7KWC", { kind: "NOT_AUTHENTICATED", reason: "SIGNATURE_NOT_VERIFIED" });
    case "offline":
      // Checked on the phone from the open inspection; it is attached when it uploads.
      return ok({
        device: offlineDevice(null),
        reference: null,
        outcome: {
          kind: "LIMITED_OFFLINE",
          record: "R1-CER-2026-D4KX7MQA",
          premises: DA_KAO,
          printedState: "IN_FORCE",
          period: { from: "2026-09-10", to: "2027-09-09" },
          printedAt: "2026-09-10T15:02:00+07:00",
          keysRefreshedAt: "2026-09-30T07:00:00+07:00",
          keyId: "CK-2026-01",
          keyRetiredAt: null,
        },
        identifier: { type: "REPRESENTATION_REFERENCE", value: "CRP-8TQ3WK6MXA" },
        inspection: { reference: OPEN_INSPECTION, attached: false },
        attachRefusal: null,
      });
    case "answer-not-found":
      return failure("ANSWER_NOT_FOUND", false);
    case "payload-mismatch":
      return failure("PAYLOAD_REFERENCE_MISMATCH", false);
    case "no-appointment":
      return failure("NO_EFFECTIVE_APPOINTMENT", false);
    case "premises-unavailable":
      return failure("PREMISES_READ_UNAVAILABLE", true);
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "0e7b5d29c4a1f836");
  }
}

// ------------------------------------------------------------------ SCR-VER-03

const header = (code: RefusalCode) => code;

/** SCR-VER-03's answers: the inspection starts from the online answer about Lê Thánh Tôn, under KTVH-KV1. */
export function mockInspectionStart(view: Exclude<Ver03View, "loading">): LoadOutcome<InspectionStart> {
  const start: InspectionStart = {
    device: MOCK_FIELD_DEVICE,
    premises: LE_THANH_TON,
    answer: ONLINE_ANSWER,
    appointment: KV1,
    openInspection: null,
    refusal: null,
    answerRefusal: null,
    pastAppointmentEnd: false,
    openInspectionsRefusal: null,
    draft: {
      purpose: "ROUTINE",
      basis: "Kế hoạch kiểm tra số 18/KH-KTVH",
      observedOn: "2026-09-30",
      observedTime: "10:20",
      observedRefusal: null,
      delayReasonRequired: false,
      delayReason: "",
      delayRefusal: null,
    },
  };
  switch (view) {
    case "populated":
      return ok(start);
    case "open-exists":
      // The canvas continues into SCR-VER-04, whose open inspection is the only one it draws.
      return ok({ ...start, openInspection: OPEN_INSPECTION });
    case "answer-refused":
      return ok({ ...start, answerRefusal: "ANSWER_OUTSIDE_INSPECTION_WINDOW" });
    case "last-day":
      return ok({ ...start, answerRefusal: "ANSWER_OUTSIDE_INSPECTION_WINDOW", pastAppointmentEnd: true });
    case "late":
      return ok({
        ...start,
        draft: { ...start.draft, observedOn: "2026-09-28", observedTime: "15:30", delayReasonRequired: true, delayRefusal: "DELAY_REASON_REQUIRED" },
      });
    case "time-in-future":
      return ok({ ...start, draft: { ...start.draft, observedTime: "18:30", observedRefusal: "OBSERVED_AT_IN_FUTURE" } });
    case "offline":
      return ok({ ...start, device: offlineDevice("2026-09-30T10:09:00+07:00") });
    case "no-appointment":
      return ok({ ...start, refusal: header("NO_EFFECTIVE_APPOINTMENT") });
    case "suspended":
      return ok({ ...start, refusal: header("APPOINTMENT_SUSPENDED") });
    case "outside":
      return ok({ ...start, refusal: header("OUTSIDE_JURISDICTION") });
    case "jurisdiction-not-recorded":
      return ok({ ...start, refusal: header("JURISDICTION_NOT_RECORDED_FOR_GEOGRAPHY") });
    case "observed-outside":
      return ok({ ...start, refusal: header("OBSERVED_OUTSIDE_AUTHORITY") });
    case "premises-unavailable":
      return ok({ ...start, refusal: header("PREMISES_READ_UNAVAILABLE") });
    case "policy-unavailable":
      return ok({ ...start, refusal: header("POLICY_READ_UNAVAILABLE") });
    case "cursor-invalid":
      return ok({ ...start, openInspectionsRefusal: "CURSOR_INVALID" });
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "7f30c2b9d16e4a58");
  }
}

// ------------------------------------------------------------------ SCR-VER-04

/** The canvas writes its sample notes in the reader's language. */
const NOTES = {
  vi: {
    music: "Nhạc nền ở phòng chính",
    abandon: "Mở nhầm cơ sở: lượt này định mở cho Then Cửa Coffee & Tea – Lê Thánh Tôn.",
  },
  en: {
    music: "Background music in the main room",
    abandon: "Opened for the wrong premises: it was meant for Then Cửa Coffee & Tea – Lê Thánh Tôn.",
  },
} as const;

const ATTACHED_IN_FORCE: AttachedAnswer = { answer: "VRA-4TW9KQ3MXA", result: { kind: "IN_FORCE" }, readAt: "2026-09-30T09:46:00+07:00" };

/** SCR-VER-04's answers: ISP-2QK7TM4W8E at Pasteur, under KTVH-KV3, one answer attached and one finding. */
export function mockInspection(view: Exclude<Ver04View, "loading">, locale: Locale): LoadOutcome<InspectionInProgress> {
  const notes = NOTES[locale];
  const inspection: InspectionInProgress = {
    device: MOCK_FIELD_DEVICE,
    reference: OPEN_INSPECTION,
    premises: PASTEUR.name,
    authorityCode: "KTVH-KV3",
    purpose: "ROUTINE",
    tookPlaceAt: "2026-09-30T09:40:00+07:00",
    state: "OPEN",
    record: null,
    attached: [ATTACHED_IN_FORCE],
    uploadedNotAttached: [{ answer: "VRA-5MX8QT2KWB", checkedAt: "2026-09-30T09:12:00+07:00", refusal: null }],
    findings: [{ kind: "MUSIC_IN_USE", note: notes.music }],
    refusal: null,
    pastAppointmentEnd: false,
    draft: { kind: null, note: null, noteRefusal: null },
    abandon: { reason: notes.abandon, refusal: null },
  };
  // Nothing recorded yet: the only state in which an inspection may be abandoned as opened in error.
  const nothingYet: InspectionInProgress = { ...inspection, attached: [], uploadedNotAttached: [], findings: [] };
  switch (view) {
    case "populated":
      return ok(inspection);
    case "empty":
    case "abandon-confirm":
      return ok(nothingYet);
    case "abandon-reason-missing":
      return ok({ ...nothingYet, abandon: { reason: "", refusal: "REASON_REQUIRED" } });
    case "waiting-offline":
      return ok({
        ...inspection,
        attached: [
          ATTACHED_IN_FORCE,
          { answer: "CRP-8TQ3WK6MXA", result: { kind: "WAITING_OFFLINE", printedOn: "2026-09-18" }, readAt: "2026-09-30T10:05:00+07:00" },
        ],
      });
    case "offline":
      return ok({ ...inspection, device: offlineDevice("2026-09-30T10:09:00+07:00") });
    case "note-required":
      return ok({ ...inspection, draft: { kind: "RECORD_SCOPE_EXCEEDED", note: "", noteRefusal: "NOTE_REQUIRED" } });
    case "row-refused":
      return ok({
        ...inspection,
        attached: [
          ATTACHED_IN_FORCE,
          {
            answer: "VRA-7KQ2XW5MTD",
            result: { kind: "NOT_ATTACHED", refusal: "ANSWER_NOT_FOR_PREMISES" },
            readAt: "2026-09-30T10:02:00+07:00",
          },
        ],
      });
    case "last-day":
      return ok({ ...inspection, pastAppointmentEnd: true });
    case "not-open":
      return ok({ ...inspection, state: "CONCLUDED", record: ISSUED_RECORD, uploadedNotAttached: [] });
    case "no-appointment":
      return ok({ ...inspection, refusal: "NO_EFFECTIVE_APPOINTMENT" });
    case "suspended":
      return ok({ ...inspection, refusal: "APPOINTMENT_SUSPENDED" });
    case "policy-unavailable":
      return ok({ ...inspection, refusal: "POLICY_READ_UNAVAILABLE" });
    case "not-found":
      return failure("INSPECTION_NOT_FOUND", false);
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "91d4a6e2b0c75f3d");
  }
}

// ------------------------------------------------------------------ SCR-VER-05

const DRAFT_WORDS = {
  vi: {
    guidance: "Đã hướng dẫn cơ sở đăng ký qua cổng một cửa RightOne trước ngày 30 tháng 10, 2026.",
    referralNote: "Cơ sở phát nhạc nền và nhạc sống cuối tuần, chưa có giấy xác nhận; đề nghị theo dõi việc đăng ký.",
    delayReason: "Mất sóng tại cơ sở, ghi nhận khi về trụ sở.",
  },
  en: {
    guidance: "Advised the premises to register through the RightOne single window before 30 October 2026.",
    referralNote: "Background music daily and live music at weekends, no certificate yet; registration to be followed up.",
    delayReason: "No signal at the premises; recorded back at the office.",
  },
} as const;

/** The representative's statement, as they said it: in Vietnamese in both languages of the page. */
const STATEMENT = "Quán đang làm thủ tục đăng ký, dự kiến xong trong tháng 10.";

/** The inspection the canvas concludes, at Quán Nướng Hẻm 214, and the open inspection at Pasteur. */
const HEM_214_INSPECTION = "ISP-5H3WQ8KM2A";
const PASTEUR_INSPECTION = "ISP-2QK7TM4W8E";

/** The views of SCR-VER-05 that hold for any inspection: a refusal of the page, the network, the confirmation. */
const ANY_INSPECTION: ReadonlySet<Ver05View> = new Set<Ver05View>([
  "confirm",
  "no-network",
  "case-intake-unavailable",
  "certificate-unavailable",
  "premises-unavailable",
  "no-appointment",
  "not-found",
  "not-authorised",
  "error",
]);

/**
 * SCR-VER-05's answers, by inspection. The canvas concludes ISP-5H3WQ8KM2A at Quán Nướng Hẻm 214, more than
 * 24 hours after it took place, in every view. The demo concludes the Pasteur inspection it walks through
 * SCR-VER-04, so that inspection is concluded as its own record on SCR-VER-06 reads: compliant, the manager
 * present and acknowledging, no follow-up; the views drawn only for Quán Nướng Hẻm 214 show it so. Any other
 * reference is not found.
 */
export function mockConclusion(inspection: string, view: Ver05View, locale: Locale): LoadOutcome<Conclusion> {
  if (inspection === PASTEUR_INSPECTION) return pasteurConclusion(ANY_INSPECTION.has(view) ? view : "confirm");
  if (inspection !== HEM_214_INSPECTION) return failure("INSPECTION_NOT_FOUND", false);
  return hem214Conclusion(view, locale);
}

function pasteurConclusion(view: Ver05View): LoadOutcome<Conclusion> {
  const draft: ConclusionDraft = {
    outcome: "COMPLIANT",
    outcomeRefusal: null,
    guidance: "",
    guidanceRefusal: null,
    route: "CASE_FOLLOW_UP",
    referralNote: "",
    referralNoteRefusal: null,
    representativeRole: "MANAGER",
    roleRefusal: null,
    acknowledgement: "ACKNOWLEDGED",
    statement: "",
    delayReason: "",
    delayRefusal: null,
    followUp: "NONE",
    followUpBy: "",
    followUpRefusal: null,
  };
  const conclusion: Conclusion = {
    device: MOCK_FIELD_DEVICE,
    inspection: PASTEUR_INSPECTION,
    premises: PASTEUR.name,
    tookPlaceAt: "2026-09-30T09:40:00+07:00",
    lateRecording: false,
    refusal: null,
    record: null,
    offlineResultWaiting: null,
    draft,
  };
  return drawnConclusion(conclusion, view);
}

/** Quán Nướng Hẻm 214, which took place more than 24 hours ago. During the pilot inspection gives guidance and makes no penalty referral. */
function hem214Conclusion(view: Ver05View, locale: Locale): LoadOutcome<Conclusion> {
  const words = DRAFT_WORDS[locale];
  const draft: ConclusionDraft = {
    outcome: "REFERRED",
    outcomeRefusal: null,
    guidance: words.guidance,
    guidanceRefusal: null,
    route: "CASE_FOLLOW_UP",
    referralNote: words.referralNote,
    referralNoteRefusal: null,
    representativeRole: "MANAGER",
    roleRefusal: null,
    acknowledgement: "ACKNOWLEDGED",
    statement: STATEMENT,
    delayReason: words.delayReason,
    delayRefusal: null,
    followUp: "RE_VISIT",
    followUpBy: "2026-10-30",
    followUpRefusal: null,
  };
  const conclusion: Conclusion = {
    device: MOCK_FIELD_DEVICE,
    inspection: HEM_214_INSPECTION,
    premises: HEM_214.name,
    tookPlaceAt: "2026-09-29T09:41:00+07:00",
    lateRecording: true,
    refusal: null,
    record: null,
    offlineResultWaiting: null,
    draft,
  };
  return drawnConclusion(conclusion, view);
}

/** One view of SCR-VER-05 over an inspection's conclusion, as the canvas draws it. */
function drawnConclusion(conclusion: Conclusion, view: Ver05View): LoadOutcome<Conclusion> {
  const draft = conclusion.draft;
  const withDraft = (change: Partial<ConclusionDraft>): LoadOutcome<Conclusion> => ok({ ...conclusion, draft: { ...draft, ...change } });
  switch (view) {
    case "penalty-refused":
      return withDraft({ route: "PENALTY_ROUTE", outcomeRefusal: "PENALTY_ROUTE_NOT_IN_FORCE" });
    case "guidance":
      return withDraft({ outcome: "GUIDANCE_GIVEN" });
    case "outcome-not-supported":
      return withDraft({ outcome: "COMPLIANT", outcomeRefusal: "OUTCOME_NOT_SUPPORTED" });
    case "not-current":
      return withDraft({ outcome: "COMPLIANT", outcomeRefusal: "RECORD_NOT_CURRENT_AT_INSPECTION" });
    case "contradicts":
      return withDraft({ outcome: "COMPLIANT", outcomeRefusal: "OUTCOME_CONTRADICTS_FINDING" });
    case "guidance-missing":
      return withDraft({ outcome: "GUIDANCE_GIVEN", guidance: "", guidanceRefusal: "GUIDANCE_MISSING" });
    case "representative-missing":
      return withDraft({ representativeRole: null, roleRefusal: "REPRESENTATIVE_ROLE_MISSING" });
    case "follow-up-invalid":
      return withDraft({ followUpBy: "2026-09-15", followUpRefusal: "FOLLOW_UP_DATE_INVALID" });
    case "delay-missing":
      return withDraft({ delayRefusal: "DELAY_REASON_REQUIRED" });
    case "offline-waiting":
    case "confirm-offline-waiting":
      return ok({ ...conclusion, offlineResultWaiting: "CRP-8TQ3WK6MXA", draft: { ...draft, outcome: "GUIDANCE_GIVEN" } });
    case "no-network":
      return ok({ ...conclusion, device: offlineDevice(null) });
    case "not-open":
      return ok({ ...conclusion, refusal: "INSPECTION_NOT_OPEN", record: "IRC-5WQ8KT3MXD" });
    case "case-intake-unavailable":
      return ok({ ...conclusion, refusal: "CASE_INTAKE_UNAVAILABLE" });
    case "certificate-unavailable":
      return ok({ ...conclusion, refusal: "CERTIFICATE_READ_UNAVAILABLE" });
    case "premises-unavailable":
      return ok({ ...conclusion, refusal: "PREMISES_READ_UNAVAILABLE" });
    case "no-appointment":
      return ok({ ...conclusion, refusal: "NO_EFFECTIVE_APPOINTMENT" });
    case "confirm":
      return ok(conclusion);
    case "not-found":
      return failure("INSPECTION_NOT_FOUND", false);
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "c83f1a6d02e9b574");
  }
}

// ------------------------------------------------------------------ SCR-VER-06

const FINDING_NOTE = { vi: "nhạc nền ở phòng chính", en: "background music in the main room" } as const;

/**
 * SCR-VER-06's answers: IRC-7T2MW9KQ4D, version 1, issued at Pasteur at 10:31 and waiting to reach the premises.
 * The corrected view reads another record, IRC-3XK7QW2MTD version 2, so its dates stay before 30 September.
 */
export function mockInspectionRecord(
  reference: string,
  asked: Exclude<Ver06View, "loading">,
  reader: Ver06Reader,
  locale: Locale,
): LoadOutcome<InspectionRecord> {
  if (asked === "record-not-found") return failure("RECORD_NOT_FOUND", false);
  if (asked === "not-authorised") return failure("NOT_AUTHORISED", false);
  if (asked === "error") return failure("INTERNAL_ERROR", true, "2a6f9e04d71c8b35");
  // The reference selects the record: the corrected record is drawn in one view, Pasteur's in all the others,
  // and a reference the canvas never draws is not found rather than shown as one of them.
  if (reference !== ISSUED_RECORD && reference !== CORRECTED_RECORD) return failure("RECORD_NOT_FOUND", false);
  const view: Exclude<Ver06View, "loading"> = reference === CORRECTED_RECORD ? "corrected" : asked === "corrected" ? "pending" : asked;

  const corrected = view === "corrected";
  const handedOver = view === "handed-over" || view === "already-delivered";
  const record: InspectionRecord = {
    device: view === "offline" ? offlineDevice("2026-09-30T10:33:00+07:00") : MOCK_FIELD_DEVICE,
    reference: corrected ? CORRECTED_RECORD : ISSUED_RECORD,
    version: corrected ? 2 : 1,
    premises: corrected ? DA_KAO : PASTEUR,
    authority: corrected ? KV1.authority : KV3.authority,
    issuedAt: corrected ? "2026-09-25T16:40:00+07:00" : "2026-09-30T10:31:00+07:00",
    outcome: corrected ? "NOTHING_FOUND" : "COMPLIANT",
    reconsideration: view === "challenge-unknown" ? "UNKNOWN" : "NONE",
    digest: "…4f2a9c",
    versionInForce: corrected,
    supersededAt: null,
    // The corrected record's version 1, which a correction under CAS-2026-000377 superseded on 25 September.
    earlier: corrected ? [{ version: 1, supersededAt: "2026-09-25T16:40:00+07:00" }] : [],
    whole:
      reader === "other"
        ? null
        : {
            inspector: { name: MOCK_INSPECTOR.account, card: "KTVH-0418" },
            inspectedAt: corrected ? "2026-09-10T14:05:00+07:00" : "2026-09-30T09:40:00+07:00",
            purpose: "ROUTINE",
            basis: null,
            locationContext: "REGISTER_ADDRESS",
            verified: [
              {
                answer: corrected ? "VRA-8QW3KT6MXC" : "VRA-4TW9KQ3MXA",
                channel: "ONLINE",
                state: "IN_FORCE",
                readAt: corrected ? "2026-09-10T14:02:00+07:00" : "2026-09-30T09:46:00+07:00",
              },
            ],
            recordStateAtObservation: "IN_FORCE",
            referralCase: null,
            findings: [{ kind: "MUSIC_IN_USE", note: FINDING_NOTE[locale] }],
            representative: { role: "MANAGER", acknowledgement: "ACKNOWLEDGED" },
            followUp: "NONE",
            followUpBy: null,
            guidance: null,
            referral: null,
            statement: null,
            delayReason: null,
            correctedUnderCase: corrected ? "CAS-2026-000377" : null,
            delivery: {
              state: handedOver ? "HANDED_OVER" : "PENDING",
              route: handedOver ? "ON_SITE" : null,
              handedOverAt: handedOver ? "2026-09-30T10:34:00+07:00" : null,
              deliveredAt: handedOver ? "2026-09-30T10:34:00+07:00" : null,
              dueBy: corrected ? "2026-09-30T16:40:00+07:00" : "2026-10-05T10:31:00+07:00",
              undeliveredAt: null,
              // The board draws the notice to the premises not yet sent.
              notice: null,
            },
          },
    refusal: null,
    deliveryRefusal: null,
    handover: { on: "2026-09-30", time: "10:34", recipient: "MANAGER", refusal: null },
  };
  switch (view) {
    case "pending":
    case "handed-over":
    case "corrected":
    case "challenge-unknown":
    case "offline":
      return ok(record);
    case "not-issuing":
      return ok({ ...record, deliveryRefusal: "NOT_ISSUING_AUTHORITY" });
    case "already-delivered":
      return ok({ ...record, deliveryRefusal: "ALREADY_DELIVERED" });
    case "handover-time-invalid":
      return ok({ ...record, handover: { ...record.handover, time: "09:15", refusal: "HANDOVER_TIME_INVALID" } });
    case "no-appointment":
      return ok({ ...record, refusal: "NO_EFFECTIVE_APPOINTMENT" });
    case "premises-unavailable":
      return ok({ ...record, refusal: "PREMISES_READ_UNAVAILABLE" });
    case "policy-unavailable":
      return ok({ ...record, refusal: "POLICY_READ_UNAVAILABLE" });
  }
}

// ------------------------------------------------------------------ SCR-VER-07

const SUPPLIES: readonly Supply[] = [
  { reference: "ILS-5RN8KT3WQD", kind: "NO_CURRENT_RECORD", state: "REQUESTED", generatedAt: null, failure: null },
  { reference: "ILS-8KW2QM4T7B", kind: "NOT_CURRENT_WITH_DECISION", state: "READY", generatedAt: "2026-09-30T08:22:00+07:00", failure: null },
  { reference: "ILS-3QW7KD2M8H", kind: "NO_CURRENT_RECORD", state: "READY", generatedAt: "2026-09-30T08:21:00+07:00", failure: null },
  {
    reference: "ILS-6TD2XQ9KMB",
    kind: "NO_CURRENT_RECORD",
    state: "FAILED",
    generatedAt: "2026-09-29T16:05:00+07:00",
    failure: "RECORD_READ_UNAVAILABLE",
  },
  { reference: "ILS-9HV4QM2TXK", kind: "NO_CURRENT_RECORD", state: "DISPOSED", generatedAt: "2026-06-29T09:10:00+07:00", failure: null },
];

/** P1: the register has no defined population, so every supply fails, and a failed supply does not count. */
const SUPPLIES_P1: readonly Supply[] = [
  {
    reference: "ILS-7WQ2KT9MXD",
    kind: "NO_CURRENT_RECORD",
    state: "FAILED",
    generatedAt: "2026-09-30T10:02:00+07:00",
    failure: "REGISTER_READ_UNAVAILABLE",
  },
  {
    reference: "ILS-4KX8QM3TWB",
    kind: "NOT_CURRENT_WITH_DECISION",
    state: "FAILED",
    generatedAt: "2026-09-30T09:47:00+07:00",
    failure: "REGISTER_READ_UNAVAILABLE",
  },
  {
    reference: "ILS-6TD2XQ9KMB",
    kind: "NO_CURRENT_RECORD",
    state: "FAILED",
    generatedAt: "2026-09-29T16:05:00+07:00",
    failure: "REGISTER_READ_UNAVAILABLE",
  },
];

/** SCR-VER-07's answers: KTVH-KV1's supplies, three requested today of ten. */
export function mockInspectionLists(view: Exclude<Ver07View, "loading">): LoadOutcome<InspectionLists> {
  const lists: InspectionLists = {
    authorityCode: KV1.authorityCode,
    asOf: "2026-09-30T10:14:00+07:00",
    appointments: [KV1, KV3],
    actingFor: KV1.id,
    actingForRefusal: null,
    requestKind: "NO_CURRENT_RECORD",
    areaOptions: KV1_AREAS,
    areas: [],
    areasRefusal: null,
    requestedToday: 3,
    dailyLimit: 10,
    nextRequestAt: null,
    refusal: null,
    filter: { kind: null, state: null },
    supplies: SUPPLIES,
    suppliesRefusal: null,
  };
  switch (view) {
    case "populated":
      return ok(lists);
    case "p1-failed":
      return ok({ ...lists, requestedToday: 0, supplies: SUPPLIES_P1 });
    case "outside":
      return ok({
        ...lists,
        areaOptions: [...KV1_AREAS, "Phường Xuân Hoà"],
        areas: ["Phường Bến Thành", "Phường Xuân Hoà"],
        areasRefusal: "OUTSIDE_JURISDICTION",
      });
    case "limit":
      return ok({ ...lists, requestedToday: 10, nextRequestAt: "2026-10-01T00:00:00+07:00" });
    case "appointment-required":
      return ok({ ...lists, actingFor: null, actingForRefusal: "APPOINTMENT_REQUIRED" });
    case "no-appointment":
      return ok({ ...lists, requestedToday: 0, refusal: "NO_EFFECTIVE_APPOINTMENT", supplies: [] });
    case "suspended":
      return ok({ ...lists, refusal: "APPOINTMENT_SUSPENDED", supplies: [] });
    case "jurisdiction-not-recorded":
      return ok({ ...lists, refusal: "JURISDICTION_NOT_RECORDED_FOR_GEOGRAPHY" });
    case "premises-unavailable":
      return ok({ ...lists, refusal: "PREMISES_READ_UNAVAILABLE" });
    case "policy-unavailable":
      return ok({ ...lists, refusal: "POLICY_READ_UNAVAILABLE" });
    case "cursor-invalid":
      return ok({ ...lists, supplies: [], suppliesRefusal: "CURSOR_INVALID" });
    case "filtered":
      return ok({ ...lists, filter: { kind: null, state: "DISPOSED" }, supplies: [] });
    case "empty":
      return ok({ ...lists, requestedToday: 0, supplies: [] });
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "d07a3e5c19b84f62");
  }
}

// ------------------------------------------------------------------ SCR-VER-08

const entry = (
  premises: string,
  area: (typeof KV1_AREAS)[number],
  reference: string,
  street: string,
  rest: Omit<SupplyEntry, "premises" | "area" | "reference" | "address">,
): SupplyEntry => ({ premises, area, reference, address: `${street}, ${area}`, ...rest });

const NONE_YET = { detail: null, lastStatus: null, since: null, deadline: null } as const;

const ENTRIES_NO_CURRENT: readonly SupplyEntry[] = [
  entry("Áp Mái Bar – Tôn Thất Thiệp", "Phường Sài Gòn", "PRM-5AMT2HXR", "17 Tôn Thất Thiệp", {
    class: "RECORD_NOT_CURRENT",
    detail: null,
    lastStatus: "SUSPENDED",
    since: "2026-09-22",
    deadline: null,
  }),
  entry("The Lintel Coffee – Lý Tự Trọng", "Phường Sài Gòn", "PRM-3LTX7KQV", "61 Lý Tự Trọng", { class: "NO_RECORD_EVER", ...NONE_YET }),
  entry("The Lintel Coffee – Nguyễn Trãi", "Phường Bến Thành", "PRM-9NTR4KBE", "238 Nguyễn Trãi", {
    class: "DECIDED_AWAITING_RECORD",
    detail: { kind: "DECISION", reference: "OBD-7WNT3KPA2C" },
    lastStatus: null,
    since: "2026-09-25",
    deadline: { kind: "WITHIN", date: "2026-10-09" },
  }),
  entry("Then Cửa Lounge & Karaoke – Bùi Viện", "Phường Bến Thành", "PRM-6BVK3RQT", "186 Bùi Viện", { class: "NO_RECORD_EVER", ...NONE_YET }),
  entry("Quán Nướng Hẻm 214", "Phường Cầu Ông Lãnh", "PRM-8QNH6WZT", "Hẻm 214 Cô Giang", { class: "NO_RECORD_EVER", ...NONE_YET }),
];

const ENTRIES_NOT_CURRENT: readonly SupplyEntry[] = [
  entry("Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng", "Phường Sài Gòn", "PRM-4MSG8TDX", "8 Tôn Đức Thắng", {
    class: "REPORTED_CHANGE_UNDECIDED",
    detail: { kind: "CHANGE", reference: "REG-D2VL7KQE3S" },
    lastStatus: "IN_FORCE",
    since: "2026-09-21",
    deadline: { kind: "WITHIN", date: "2026-10-20" },
  }),
  entry("Then Cửa Coffee & Tea – Nguyễn Huệ", "Phường Sài Gòn", "PRM-3NHZ6PKW", "41 Nguyễn Huệ", {
    class: "CONSEQUENCE_NOT_EFFECTIVE",
    detail: { kind: "DECISION", reference: "OBD-4NPV8CRA2J" },
    lastStatus: "IN_FORCE",
    since: "2026-09-26",
    deadline: { kind: "WITHIN", date: "2026-10-12" },
  }),
];

const byArea = (listed: readonly number[]) => KV1_AREAS.map((area, i) => ({ area, listed: listed[i] ?? 0 }));

const COUNTS_NO_CURRENT: SupplyCounts = {
  byArea: byArea([2, 2, 0, 1]),
  listed: 5,
  current: 37,
  outOfScope: 4,
  indeterminate: 2,
  notOperating: 1,
};

const COUNTS_NOT_CURRENT: SupplyCounts = {
  byArea: byArea([2, 0, 0, 0]),
  listed: 2,
  current: 40,
  outOfScope: 4,
  indeterminate: 2,
  notOperating: 1,
};

const REGISTER_AUTHORITATIVE = (readAt: string): RegisterRead => ({
  route: "AUTHORITATIVE_SOURCE",
  reconciledAt: "2026-09-30T02:00:00+07:00",
  reconciledDaysAgo: 0,
  scope: "NONE",
  limitedAreas: [],
  version: "RR-2026-09-30-02",
  readAt,
});

/** SCR-VER-08's answers: ILS-3QW7KD2M8H, premises holding no current record across KTVH-KV1's four wards. */
export function mockListSupply(view: Exclude<Ver08View, "loading">): LoadOutcome<ListSupply> {
  const generatedAt = "2026-09-30T08:21:00+07:00";
  const supply: ListSupply = {
    reference: "ILS-3QW7KD2M8H",
    kind: "NO_CURRENT_RECORD",
    state: "READY",
    areas: KV1_AREAS,
    requestedAt: null,
    generatedAt,
    ageDays: 0,
    register: REGISTER_AUTHORITATIVE(generatedAt),
    registerUnread: false,
    failure: null,
    counts: COUNTS_NO_CURRENT,
    entries: ENTRIES_NO_CURRENT,
    entriesRefusal: null,
    selected: null,
    refusal: null,
  };
  const failedAt = "2026-09-30T10:02:00+07:00";
  const failed = (cause: RefusalCode, register: RegisterRead | null): LoadOutcome<ListSupply> =>
    ok({
      ...supply,
      reference: "ILS-7WQ2KT9MXD",
      state: "FAILED",
      generatedAt: failedAt,
      register,
      registerUnread: register === null,
      failure: cause,
      counts: null,
      entries: [],
    });
  switch (view) {
    case "ready":
      return ok(supply);
    case "entry-selected":
      return ok({ ...supply, selected: "PRM-8QNH6WZT" });
    case "kind-not-current":
      return ok({
        ...supply,
        reference: "ILS-8KW2QM4T7B",
        kind: "NOT_CURRENT_WITH_DECISION",
        counts: COUNTS_NOT_CURRENT,
        entries: ENTRIES_NOT_CURRENT,
      });
    case "empty-limited": {
      const at = "2026-09-30T09:15:00+07:00";
      return ok({
        ...supply,
        reference: "ILS-2TQ6WK8MXN",
        areas: ["Phường Tân Định"],
        generatedAt: at,
        register: {
          route: "ALTERNATIVE_ROUTE",
          reconciledAt: "2026-09-15T02:00:00+07:00",
          reconciledDaysAgo: 15,
          scope: "AREAS",
          limitedAreas: ["Phường Tân Định"],
          version: "RR-2026-09-15-01",
          readAt: at,
        },
        counts: {
          byArea: [{ area: "Phường Tân Định", listed: 0 }],
          listed: 0,
          current: 9,
          outOfScope: 1,
          indeterminate: 0,
          notOperating: 0,
        },
        entries: [],
      });
    }
    case "failed-register":
      return failed("REGISTER_READ_UNAVAILABLE", null);
    case "failed-record":
      return failed("RECORD_READ_UNAVAILABLE", {
        route: "MANUAL_ADMISSION",
        reconciledAt: null,
        reconciledDaysAgo: 0,
        scope: "WHOLE_REGISTER",
        limitedAreas: [],
        version: "RR-2026-09-30-01",
        readAt: failedAt,
      });
    case "failed-scope":
      return failed("SCOPE_READ_UNAVAILABLE", REGISTER_AUTHORITATIVE(failedAt));
    case "failed-decision":
      return failed("DECISION_READ_UNAVAILABLE", REGISTER_AUTHORITATIVE(failedAt));
    case "failed-timeout":
      return failed("GENERATION_TIMED_OUT", REGISTER_AUTHORITATIVE(failedAt));
    case "not-ready":
      return ok({
        ...supply,
        reference: "ILS-5RN8KT3WQD",
        state: "REQUESTED",
        requestedAt: "2026-09-30T10:12:00+07:00",
        generatedAt: null,
        register: null,
        counts: null,
        entries: [],
        entriesRefusal: "SUPPLY_NOT_READY",
      });
    case "disposed": {
      const at = "2026-06-29T09:10:00+07:00";
      return ok({
        ...supply,
        reference: "ILS-9HV4QM2TXK",
        state: "DISPOSED",
        generatedAt: at,
        ageDays: 93,
        register: REGISTER_AUTHORITATIVE(at),
        entries: [],
        entriesRefusal: "ENTRIES_DISPOSED",
      });
    }
    case "no-appointment":
      return ok({ ...supply, refusal: "NO_EFFECTIVE_APPOINTMENT" });
    case "cursor-invalid":
      return ok({ ...supply, entries: [], entriesRefusal: "CURSOR_INVALID" });
    case "not-found":
      return failure("SUPPLY_NOT_FOUND", false);
    case "not-authorised":
      return failure("NOT_AUTHORISED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "f61b2d8e37a04c95");
  }
}

// ------------------------------------------------------------------ the canvas's world, which the backend is seeded from

/*
 * What the mock backend starts every sign-in from: the register the field client reads through CER, the
 * appointments, the answers, inspections, records and supplies the boards draw, and the phone's own store.
 * Nothing here is made up: each value is the canvas's, from the board named beside it, and where the canvas
 * draws nothing (the purpose of two seeded inspections, an address, a state's first moment) the value is null
 * and the screens say no more than they know.
 */

/** Text the canvas writes in the reader's language; what a person types is kept as typed. */
export interface Localised {
  vi: string;
  en: string;
}

/** The inspector's card number, which SCR-VER-06 prints beside her name. */
export const INSPECTOR_CARD = "KTVH-0418";

/** KV2's name is never drawn; its code is all the canvas gives (SCR-VER-17). */
const KV2: Appointment = { id: "kv2", authorityCode: "KTVH-KV2", authority: "KTVH-KV2", areas: [] };

/**
 * The appointments: KV1 and KV3 in force (SCR-VER-17's choice), and KV2, ended, within its last-day allowance
 * until the moment SCR-VER-17 writes on Áp Mái Bar – Thảo Điền's row.
 */
export const APPOINTMENTS: {
  inForce: readonly Appointment[];
  withinAllowance: readonly { appointment: Appointment; until: string }[];
} = {
  inForce: [KV1, KV3],
  withinAllowance: [{ appointment: KV2, until: "2026-09-30T23:59:00+07:00" }],
};

/** A premises in the register, by the key the seed joins on. */
export interface CanvasPremises {
  key: string;
  /**
   * The premises register's reference (PRM-), which a list entry gives and CER names a record's premises by; null where
   * no board draws one.
   */
  reference: string | null;
  name: string;
  address: string | null;
  /** The ward it lies in, which decides the authority whose jurisdiction it is in. */
  area: string | null;
}

const premisesOf = (key: string, name: PremisesName, area: string | null, reference: string | null = null): CanvasPremises => ({
  key,
  reference,
  name: name.name,
  address: name.address,
  area,
});

const fromEntry = (entry: SupplyEntry): CanvasPremises => ({
  key: entry.reference,
  reference: entry.reference,
  name: entry.premises,
  address: entry.address,
  area: entry.area,
});

const ENTRY = (reference: string): SupplyEntry => {
  const found = [...ENTRIES_NO_CURRENT, ...ENTRIES_NOT_CURRENT].find((entry) => entry.reference === reference);
  if (found === undefined) throw new Error(`No list entry ${reference} on the canvas`);
  return found;
};

/**
 * The premises the boards name. Those of SCR-VER-02 and SCR-VER-17 carry the addresses the answers print, and the
 * register reference the CER boards draw for the same premises (SCR-CER-01), by which CER's records join them; those
 * of SCR-VER-08's lists carry their entry's reference, address and ward. Quán Nướng Hẻm 214 is both.
 */
export const CANVAS_PREMISES: readonly CanvasPremises[] = [
  premisesOf("pasteur", PASTEUR, "Phường Xuân Hoà", "PRM-5PSR9VJA"),
  premisesOf("le-thanh-ton", LE_THANH_TON, "Phường Sài Gòn", "PRM-8RTN5QZD"),
  premisesOf("da-kao", DA_KAO, "Phường Tân Định", "PRM-4DKX7WNP"),
  premisesOf("hem-214", HEM_214, "Phường Cầu Ông Lãnh", "PRM-8QNH6WZT"),
  premisesOf(
    "ap-mai-ton-that-thiep",
    { name: "Áp Mái Bar – Tôn Thất Thiệp", address: "17 Tôn Thất Thiệp, Phường Sài Gòn, TP. Hồ Chí Minh" },
    "Phường Sài Gòn",
    "PRM-5AMT2HXR",
  ),
  premisesOf("ap-mai-thao-dien", { name: "Áp Mái Bar – Thảo Điền", address: null }, null, "PRM-7KD2WQ9M"),
  fromEntry(ENTRY("PRM-3NHZ6PKW")),
  fromEntry(ENTRY("PRM-3LTX7KQV")),
  fromEntry(ENTRY("PRM-9NTR4KBE")),
  fromEntry(ENTRY("PRM-6BVK3RQT")),
  fromEntry(ENTRY("PRM-4MSG8TDX")),
];

/** A stored verification answer of the seed. */
export interface CanvasAnswer {
  reference: string;
  appointment: string;
  channel: "ONLINE" | "OFFLINE_UPLOAD";
  answeredAt: string;
  premises: string | null;
  outcome: AnswerOutcome;
}

const answered = (second: string) => `2026-09-30T10:14:${second}+07:00`;
/** The answers SCR-VER-02 draws carry no instant of their own unless they show one; the canvas reads at 10:14. */
const CANVAS_READ = "2026-09-30T10:14:00+07:00";

const inForce = (record: string, premises: PremisesName, since: string, period: Period, readAt: string): AnswerOutcome => ({
  kind: "CURRENT_RESULT",
  state: "IN_FORCE",
  record,
  premises,
  stateSince: since,
  period,
  readAt,
  representationCurrent: true,
  publicFieldSetReason: null,
});

/**
 * The stored answers: every answer SCR-VER-02 draws under KTVH-KV1, the one SCR-VER-04 draws attached to the
 * Pasteur inspection at 09:46 and the one uploaded for Pasteur at 09:12, both under KTVH-KV3. The canvas does not
 * say which record the two Pasteur answers read; Pasteur holds one record, R1-CER-2026-T7QM4BWJ.
 */
export const CANVAS_ANSWERS: readonly CanvasAnswer[] = [
  { reference: ONLINE_ANSWER, appointment: "kv1", channel: "ONLINE", answeredAt: answered("03"), premises: "le-thanh-ton", outcome: ONLINE.outcome },
  {
    reference: "VRA-4HX7QM2WKD",
    appointment: "kv1",
    channel: "ONLINE",
    answeredAt: answered("41"),
    premises: "ap-mai-ton-that-thiep",
    outcome: {
      kind: "CURRENT_RESULT",
      state: "SUSPENDED",
      record: "R1-CER-2026-V8JD3MRA",
      premises: { name: "Áp Mái Bar – Tôn Thất Thiệp", address: "17 Tôn Thất Thiệp, Phường Sài Gòn, TP. Hồ Chí Minh" },
      stateSince: "2026-09-22T16:30:00+07:00",
      period: { from: "2026-06-15", to: "2027-06-14" },
      readAt: answered("41"),
      representationCurrent: true,
      publicFieldSetReason: null,
    },
  },
  {
    reference: "VRA-7NC2WT9KQE",
    appointment: "kv1",
    channel: "ONLINE",
    answeredAt: answered("22"),
    premises: null,
    outcome: {
      kind: "CURRENT_RESULT",
      state: "IN_FORCE",
      record: "R1-CER-2026-F9RB2KXN",
      premises: null,
      stateSince: "2026-09-11T10:02:00+07:00",
      period: { from: "2026-09-11", to: "2027-09-10" },
      readAt: answered("22"),
      representationCurrent: true,
      publicFieldSetReason: "OUTSIDE_JURISDICTION",
    },
  },
  { reference: "VRA-6RT3XW8KQB", appointment: "kv1", channel: "ONLINE", answeredAt: CANVAS_READ, premises: null, outcome: { kind: "UNABLE_TO_VERIFY", cause: "SYSTEM" } },
  {
    reference: "VRA-2PX8MK5T3Q",
    appointment: "kv1",
    channel: "ONLINE",
    answeredAt: CANVAS_READ,
    premises: null,
    outcome: { kind: "INVALID_INPUT", expectedFormat: "R1-CER-YYYY-XXXXXXXX", usableTypes: [] },
  },
  {
    reference: "VRA-5KW9QD3TXM",
    appointment: "kv1",
    channel: "ONLINE",
    answeredAt: CANVAS_READ,
    premises: null,
    outcome: { kind: "INVALID_INPUT", expectedFormat: null, usableTypes: ["PUBLIC_REFERENCE", "REPRESENTATION_REFERENCE"] },
  },
  { reference: "VRA-3QT6KX8MWA", appointment: "kv1", channel: "ONLINE", answeredAt: CANVAS_READ, premises: null, outcome: { kind: "NO_RECORD" } },
  { reference: "VRA-8WD4KQ2TXN", appointment: "kv1", channel: "ONLINE", answeredAt: CANVAS_READ, premises: null, outcome: { kind: "NO_PREMISES_IN_JURISDICTION" } },
  {
    reference: "VRA-6MK3TQ9WXB",
    appointment: "kv1",
    channel: "ONLINE",
    answeredAt: CANVAS_READ,
    premises: "hem-214",
    outcome: { kind: "NO_CURRENT_RECORD_FOR_PREMISES", premises: HEM_214, lastState: null },
  },
  { reference: "VRA-2TK8WQ5MXD", appointment: "kv1", channel: "ONLINE", answeredAt: CANVAS_READ, premises: null, outcome: { kind: "AMBIGUOUS", count: 2 } },
  {
    reference: "VRA-9XQ4MT7KWC",
    appointment: "kv1",
    channel: "ONLINE",
    answeredAt: CANVAS_READ,
    premises: null,
    outcome: { kind: "NOT_AUTHENTICATED", reason: "SIGNATURE_NOT_VERIFIED" },
  },
  {
    reference: ATTACHED_IN_FORCE.answer,
    appointment: "kv3",
    channel: "ONLINE",
    answeredAt: ATTACHED_IN_FORCE.readAt,
    premises: "pasteur",
    outcome: inForce("R1-CER-2026-T7QM4BWJ", PASTEUR, "2026-09-18T11:40:00+07:00", { from: "2026-09-18", to: "2027-09-17" }, ATTACHED_IN_FORCE.readAt),
  },
  {
    reference: "VRA-5MX8QT2KWB",
    appointment: "kv3",
    channel: "OFFLINE_UPLOAD",
    answeredAt: "2026-09-30T09:12:00+07:00",
    premises: "pasteur",
    outcome: inForce("R1-CER-2026-T7QM4BWJ", PASTEUR, "2026-09-18T11:40:00+07:00", { from: "2026-09-18", to: "2027-09-17" }, "2026-09-30T09:12:00+07:00"),
  },
];

/** What the inspector has entered on SCR-VER-05 for an inspection of the seed, as the canvas draws it. */
export interface CanvasConclusionDraft {
  outcome: Outcome;
  guidance: Localised;
  route: ReferralRoute;
  referralNote: Localised;
  representativeRole: RepresentativeRole;
  acknowledgement: Acknowledgement;
  statement: string;
  delayReason: Localised;
  followUp: FollowUpKind;
  followUpBy: string;
}

/** An inspection of the seed. */
export interface CanvasInspection {
  reference: string;
  premises: string;
  appointment: string;
  /** Null where the canvas does not draw what the inspection was for. */
  purpose: Purpose | null;
  observedAt: string;
  /** The canvas's own reading of the 24-hour recording interval, at its moment. */
  late: boolean;
  attached: readonly { answer: string; readAt: string }[];
  findings: readonly { kind: FindingKind; note: Localised | null }[];
  draft: CanvasConclusionDraft | null;
}

/**
 * The three open inspections SCR-VER-17 draws. Pasteur's holds what SCR-VER-04 draws: one answer attached and
 * one finding. Quán Nướng Hẻm 214's, open past the recording interval, holds the conclusion SCR-VER-05 draws
 * being entered. Áp Mái Bar – Thảo Điền's is open under KTVH-KV2's last-day allowance; nothing else of it is drawn.
 */
export const CANVAS_INSPECTIONS: readonly CanvasInspection[] = [
  {
    reference: HEM_214_INSPECTION,
    premises: "hem-214",
    appointment: "kv1",
    purpose: null,
    observedAt: "2026-09-29T09:41:00+07:00",
    late: true,
    attached: [],
    findings: [],
    draft: {
      outcome: "REFERRED",
      guidance: { vi: DRAFT_WORDS.vi.guidance, en: DRAFT_WORDS.en.guidance },
      route: "CASE_FOLLOW_UP",
      referralNote: { vi: DRAFT_WORDS.vi.referralNote, en: DRAFT_WORDS.en.referralNote },
      representativeRole: "MANAGER",
      acknowledgement: "ACKNOWLEDGED",
      statement: STATEMENT,
      delayReason: { vi: DRAFT_WORDS.vi.delayReason, en: DRAFT_WORDS.en.delayReason },
      followUp: "RE_VISIT",
      followUpBy: "2026-10-30",
    },
  },
  {
    reference: PASTEUR_INSPECTION,
    premises: "pasteur",
    appointment: "kv3",
    purpose: "ROUTINE",
    observedAt: "2026-09-30T09:40:00+07:00",
    late: false,
    attached: [{ answer: ATTACHED_IN_FORCE.answer, readAt: ATTACHED_IN_FORCE.readAt }],
    findings: [{ kind: "MUSIC_IN_USE", note: { vi: NOTES.vi.music, en: NOTES.en.music } }],
    draft: null,
  },
  {
    reference: "ISP-6PW2KD8RQM",
    premises: "ap-mai-thao-dien",
    appointment: "kv2",
    purpose: null,
    observedAt: "2026-09-29T16:20:00+07:00",
    late: false,
    attached: [],
    findings: [],
    draft: null,
  },
];

/** A record of the seed: Đa Kao's, version 2, corrected under a case (SCR-VER-06, corrected). */
export interface CanvasRecord {
  reference: string;
  version: number;
  inspector: string;
  premises: string;
  appointment: string;
  issuedAt: string;
  inspectedAt: string;
  outcome: Outcome;
  answer: string;
  findings: readonly { kind: FindingKind; note: Localised | null }[];
  representativeRole: RepresentativeRole;
  acknowledgement: Acknowledgement;
  followUp: FollowUpKind;
  correctedUnderCase: string;
  digest: string;
  dueBy: string;
}

export const CANVAS_RECORDS: readonly CanvasRecord[] = [
  {
    reference: CORRECTED_RECORD,
    version: 2,
    inspector: MOCK_INSPECTOR.account,
    premises: "da-kao",
    appointment: "kv1",
    issuedAt: "2026-09-25T16:40:00+07:00",
    inspectedAt: "2026-09-10T14:05:00+07:00",
    outcome: "NOTHING_FOUND",
    answer: "VRA-8QW3KT6MXC",
    findings: [{ kind: "MUSIC_IN_USE", note: FINDING_NOTE }],
    representativeRole: "MANAGER",
    acknowledgement: "ACKNOWLEDGED",
    followUp: "NONE",
    correctedUnderCase: "CAS-2026-000377",
    digest: "…4f2a9c",
    dueBy: "2026-09-30T16:40:00+07:00",
  },
];

/** A list supply of the seed, with what SCR-VER-08 draws of it. */
export interface CanvasSupply {
  supply: Supply;
  appointment: string;
  areas: readonly string[];
  requestedAt: string | null;
  register: RegisterRead | null;
  counts: SupplyCounts | null;
  entries: readonly SupplyEntry[];
}

const supplyOf = (reference: string): Supply => {
  const found = SUPPLIES.find((supply) => supply.reference === reference);
  if (found === undefined) throw new Error(`No supply ${reference} on the canvas`);
  return found;
};

/** KTVH-KV1's five supplies of SCR-VER-07, each as SCR-VER-08 draws it. */
export const CANVAS_SUPPLIES: readonly CanvasSupply[] = [
  {
    supply: supplyOf("ILS-5RN8KT3WQD"),
    appointment: "kv1",
    areas: KV1_AREAS,
    requestedAt: "2026-09-30T10:12:00+07:00",
    register: null,
    counts: null,
    entries: [],
  },
  {
    supply: supplyOf("ILS-8KW2QM4T7B"),
    appointment: "kv1",
    areas: KV1_AREAS,
    requestedAt: null,
    register: REGISTER_AUTHORITATIVE("2026-09-30T08:22:00+07:00"),
    counts: COUNTS_NOT_CURRENT,
    entries: ENTRIES_NOT_CURRENT,
  },
  {
    supply: supplyOf("ILS-3QW7KD2M8H"),
    appointment: "kv1",
    areas: KV1_AREAS,
    requestedAt: null,
    register: REGISTER_AUTHORITATIVE("2026-09-30T08:21:00+07:00"),
    counts: COUNTS_NO_CURRENT,
    entries: ENTRIES_NO_CURRENT,
  },
  { supply: supplyOf("ILS-6TD2XQ9KMB"), appointment: "kv1", areas: KV1_AREAS, requestedAt: null, register: null, counts: null, entries: [] },
  {
    supply: supplyOf("ILS-9HV4QM2TXK"),
    appointment: "kv1",
    areas: KV1_AREAS,
    requestedAt: null,
    register: REGISTER_AUTHORITATIVE("2026-06-29T09:10:00+07:00"),
    counts: COUNTS_NO_CURRENT,
    entries: [],
  },
];

/**
 * The register a new supply is generated from: the entries SCR-VER-08 draws for each kind across KTVH-KV1's four
 * wards, and the counts it draws for the whole jurisdiction and, for the first kind, for Phường Tân Định alone.
 * No other area's counts are drawn; the register is read as SCR-VER-08's ready supply read it.
 */
export const CANVAS_REGISTER: {
  entries: Readonly<Record<ListKind, readonly SupplyEntry[]>>;
  counts: readonly { kind: ListKind; areas: readonly string[]; counts: Omit<SupplyCounts, "byArea" | "listed"> }[];
  read: Omit<RegisterRead, "readAt" | "reconciledDaysAgo">;
} = {
  entries: { NO_CURRENT_RECORD: ENTRIES_NO_CURRENT, NOT_CURRENT_WITH_DECISION: ENTRIES_NOT_CURRENT },
  counts: [
    { kind: "NO_CURRENT_RECORD", areas: KV1_AREAS, counts: { current: 37, outOfScope: 4, indeterminate: 2, notOperating: 1 } },
    { kind: "NOT_CURRENT_WITH_DECISION", areas: KV1_AREAS, counts: { current: 40, outOfScope: 4, indeterminate: 2, notOperating: 1 } },
    { kind: "NO_CURRENT_RECORD", areas: ["Phường Tân Định"], counts: { current: 9, outOfScope: 1, indeterminate: 0, notOperating: 0 } },
  ],
  read: {
    route: "AUTHORITATIVE_SOURCE",
    reconciledAt: "2026-09-30T02:00:00+07:00",
    scope: "NONE",
    limitedAreas: [],
    version: "RR-2026-09-30-02",
  },
};

/** The phone's store as SCR-VER-01 draws it: its keys, the result waiting, the uploads, the one that failed. */
export const CANVAS_DEVICE: {
  keysRefreshedAt: string;
  keysUntil: string;
  actingFor: string;
  waiting: readonly WaitingResult[];
  uploaded: readonly UploadedResult[];
  failed: readonly FailedResult[];
} = {
  keysRefreshedAt: "2026-09-30T07:00:00+07:00",
  keysUntil: "2026-10-07",
  actingFor: KV1.id,
  waiting: WAITING_ONE,
  uploaded: UPLOADED,
  failed: FAILED_ONE,
};

// ------------------------------------------------------------------ the authorities, their inspectors and their records

/*
 * The world the operations, premises and oversight boards draw beside the field client (SCR-VER-09 to 16, 18):
 * the designations of the four authorities, the appointments of KTVH-KV1's five inspectors, the records the
 * premises portal and the authority's console read, the cases of the requests to reconsider them, and the
 * month the oversight console counts. The values are the boards'; where a board leaves a field undrawn the seed
 * says so beside it rather than making one up.
 */

/** A document attached to a designation or an appointment: its name and size only (there is no document store). */
export interface CanvasDocument {
  name: string;
  size: string;
  at: string;
  by: string;
}

/** The staff the boards name as the recorder of the pending entries: Phan Gia Lượng (accounts.ts). */
const LUONG = { name: "Phan Gia Lượng", email: "phan.gialuong@rightone.example" } as const;

/** The geography version the boards record every jurisdiction under, and the wards it holds. */
export const GEOGRAPHY_2025 = {
  id: "g2025",
  label: { vi: "Địa giới từ 1 tháng 7, 2025", en: "Geography from 1 July 2025" },
  /** The wards the boards draw; an area outside them is refused AREA_NOT_IN_GEOGRAPHY, as SCR-VER-09 draws "Phường 6". */
  areas: [
    "Phường Sài Gòn",
    "Phường Bến Thành",
    "Phường Tân Định",
    "Phường Cầu Ông Lãnh",
    "Phường An Khánh",
    "Phường Thủ Đức",
    "Phường Hiệp Bình",
    "Phường Xuân Hoà",
    "Phường Nhiêu Lộc",
    "Phường Bàn Cờ",
    "Phường Chợ Lớn",
    "Phường An Đông",
    "Phường Chợ Quán",
  ],
} as const;

export interface CanvasDesignation {
  id: string;
  code: string;
  name: string;
  level: AuthorityLevel;
  /** Null where the board draws no legal basis (the designations in force are drawn as a row only). */
  legalBasis: string | null;
  document: CanvasDocument | null;
  geography: string;
  areas: readonly string[];
  from: string;
  to: string | null;
  predecessor: string | null;
  state: Standing;
  /** Null where the board draws no recorder. */
  recordedBy: StaffStamp | null;
}

/**
 * SCR-VER-09's four designations. KTVH-KV4 waits for a decision, recorded by Phan Gia Lượng (SCR-VER-10). The
 * decision board also draws KTVH-KV5 waiting, but SCR-VER-09 counts four authorities and nothing else of KV5 is
 * drawn (no level, basis or jurisdiction), so it is not in the seed.
 */
export const CANVAS_DESIGNATIONS: readonly CanvasDesignation[] = [
  {
    id: "dsg-kv1",
    code: "KTVH-KV1",
    name: "Đội Kiểm tra Văn hoá Khu vực 1",
    level: "PROVINCIAL",
    legalBasis: null,
    document: null,
    geography: "g2025",
    areas: KV1_AREAS,
    from: "2026-09-01",
    to: "2027-08-31",
    predecessor: null,
    state: "ACTIVE",
    recordedBy: null,
  },
  {
    id: "dsg-kv2",
    code: "KTVH-KV2",
    name: "Đội Kiểm tra Văn hoá Khu vực 2",
    level: "PROVINCIAL",
    legalBasis: null,
    document: null,
    geography: "g2025",
    areas: ["Phường An Khánh", "Phường Thủ Đức", "Phường Hiệp Bình"],
    from: "2026-09-01",
    to: "2027-08-31",
    predecessor: null,
    state: "ACTIVE",
    recordedBy: null,
  },
  {
    id: "dsg-kv3",
    code: "KTVH-KV3",
    name: "Đội Kiểm tra Văn hoá Khu vực 3",
    level: "PROVINCIAL",
    legalBasis: null,
    document: null,
    geography: "g2025",
    areas: KV3.areas,
    from: "2026-09-15",
    to: "2027-09-14",
    predecessor: null,
    state: "ACTIVE",
    recordedBy: null,
  },
  {
    id: "dsg-kv4",
    code: "KTVH-KV4",
    name: "Đội Kiểm tra Văn hoá Khu vực 4",
    level: "PROVINCIAL",
    legalBasis: "Quyết định số 2388/QĐ-SVHTT",
    document: { name: "QD-2388-SVHTT.pdf", size: "388 KB", at: "2026-09-29T15:18:00+07:00", by: LUONG.name },
    geography: "g2025",
    areas: ["Phường Chợ Lớn", "Phường An Đông", "Phường Chợ Quán"],
    from: "2026-11-01",
    to: "2027-10-31",
    predecessor: null,
    state: "PENDING_APPROVAL",
    recordedBy: { ...LUONG, at: "2026-09-29T15:20:00+07:00" },
  },
];

export interface CanvasAppointment {
  id: string;
  /** The designation that appoints. */
  authority: string;
  /** The party person reference the person's own RightOne account shows. */
  person: string;
  name: string;
  card: string | null;
  /** Null where the board draws no instrument (Âu Thị Ngọc Diệp's KTVH-KV2 and KV3 appointments). */
  instrument: string | null;
  document: CanvasDocument | null;
  from: string;
  to: string | null;
  state: Standing;
  recordedBy: StaffStamp | null;
  suspension: (StaffStamp & { reason: Localised }) | null;
  /** After an ended appointment's last day, until when a visit already made may still be recorded (CFG-779). */
  allowanceUntil: string | null;
}

/** The person Âu Thị Ngọc Diệp's account shows (SCR-VER-11), by her RightOne address. */
export const INSPECTOR_PERSONS: Readonly<Record<string, string>> = { "ngocdiep.au@kiemtra.example": "PTY-552817" };

/**
 * The persons the register knows, by party person reference: the five inspectors of SCR-VER-11 and Đinh Khánh
 * Vy, whose appointment its form records. Any other reference is PERSON_NOT_FOUND.
 */
export const CANVAS_PERSONS: Readonly<Record<string, string>> = {
  "PTY-552817": "Âu Thị Ngọc Diệp",
  "PTY-553104": "Tạ Quốc Huy",
  "PTY-551938": "Mạc Văn Toàn",
  "PTY-553480": "Hứa Minh Tâm",
  "PTY-550274": "La Thị Bích Ngân",
  "PTY-553671": "Đinh Khánh Vy",
};

const appointment = (
  id: string,
  authority: string,
  person: string,
  card: string | null,
  instrument: string | null,
  period: { from: string; to: string | null },
  state: Standing,
  rest: Partial<Pick<CanvasAppointment, "recordedBy" | "suspension" | "allowanceUntil">> = {},
): CanvasAppointment => ({
  id,
  authority,
  person,
  name: CANVAS_PERSONS[person] ?? person,
  card,
  instrument,
  document: null,
  ...period,
  state,
  recordedBy: rest.recordedBy ?? null,
  suspension: rest.suspension ?? null,
  allowanceUntil: rest.allowanceUntil ?? null,
});

/**
 * KTVH-KV1's five inspectors as SCR-VER-11 draws them, and Âu Thị Ngọc Diệp's two other appointments, which the
 * field client acts under: KTVH-KV3 in force (its period is the designation's; the board draws no instrument)
 * and KTVH-KV2, ended, within its last-day allowance (SCR-VER-17). Her appointments keep the ids the seed's
 * inspections, answers and supplies join on ("kv1", "kv2", "kv3").
 */
export const CANVAS_APPOINTMENTS: readonly CanvasAppointment[] = [
  appointment("kv1", "dsg-kv1", "PTY-552817", INSPECTOR_CARD, "Quyết định số 115/QĐ-KTVH", { from: "2026-09-01", to: "2027-08-31" }, "ACTIVE"),
  appointment("apt-kv1-huy", "dsg-kv1", "PTY-553104", "KTVH-0422", "Quyết định số 116/QĐ-KTVH", { from: "2026-09-01", to: "2027-08-31" }, "ACTIVE"),
  appointment("apt-kv1-toan", "dsg-kv1", "PTY-551938", "KTVH-0407", "Quyết định số 108/QĐ-KTVH", { from: "2026-09-01", to: "2027-08-31" }, "SUSPENDED", {
    suspension: {
      ...LUONG,
      at: "2026-09-28T16:45:00+07:00",
      reason: {
        vi: "Đang được xem xét theo phản ánh của cơ sở về lượt kiểm tra ngày 26 tháng 9.",
        en: "Under review following a premises’ report about the inspection of 26 September.",
      },
    },
  }),
  appointment("apt-kv1-tam", "dsg-kv1", "PTY-553480", "KTVH-0431", "Quyết định số 129/QĐ-KTVH", { from: "2026-10-15", to: "2027-10-14" }, "PENDING_APPROVAL", {
    recordedBy: { ...LUONG, at: "2026-09-29T11:05:00+07:00" },
  }),
  appointment("apt-kv1-ngan", "dsg-kv1", "PTY-550274", "KTVH-0391", "Quyết định số 097/QĐ-KTVH", { from: "2026-09-01", to: "2026-09-26" }, "ENDED"),
  appointment("kv3", "dsg-kv3", "PTY-552817", INSPECTOR_CARD, null, { from: "2026-09-15", to: "2027-09-14" }, "ACTIVE"),
  appointment("kv2", "dsg-kv2", "PTY-552817", INSPECTOR_CARD, null, { from: "2026-09-01", to: null }, "ENDED", {
    allowanceUntil: APPOINTMENTS.withinAllowance[0]?.until ?? null,
  }),
];

/** Premises of the Then Cửa Việt chain, by the inspection seed's key, with the portal's premises id (registration). */
export const PREMISES_OF_PARTY: Readonly<Record<string, { party: string; portalId: string }>> = {
  pasteur: { party: "tcv", portalId: "pasteur" },
  "le-thanh-ton": { party: "tcv", portalId: "ltt" },
  "da-kao": { party: "tcv", portalId: "dakao" },
  "PRM-6BVK3RQT": { party: "tcv", portalId: "buivien" },
  "PRM-3NHZ6PKW": { party: "tcv", portalId: "nh" },
};

/** A record of the premises portal and the authority's console, beyond the field client's own (SCR-VER-13, 18). */
export interface CanvasAuthorityRecord {
  reference: string;
  premises: string;
  appointment: string;
  inspectedAt: string;
  issuedAt: string;
  outcome: Outcome;
  findings: readonly { kind: FindingKind; note: Localised | null }[];
  guidance: Localised | null;
  followUp: FollowUpKind;
  followUpBy: string | null;
  delivery: { state: "PENDING" | "HANDED_OVER"; dueBy: string; handedOverAt: string | null };
}

const handed = (at: string) => ({ state: "HANDED_OVER" as const, dueBy: at, handedOverAt: at });

/**
 * The records the premises portal draws for Then Cửa Coffee & Tea – Lê Thánh Tôn (SCR-VER-13), and the two the
 * authority's console draws needing attention (SCR-VER-18): Bùi Viện's, not delivered by 27 September, and Áp
 * Mái Bar – Tôn Thất Thiệp's, whose re-visit was due by 25 September. None of them draws its representative,
 * so the seed records none; the boards draw no outcome for the two console rows and no finding for the oldest
 * Lê Thánh Tôn record, and none is given. Where a board draws when a record reached the premises (14:31 on
 * SCR-VER-14, 10:05 on SCR-VER-18) it was handed over then; the oldest record is taken as handed over when issued.
 */
export const CANVAS_AUTHORITY_RECORDS: readonly CanvasAuthorityRecord[] = [
  {
    reference: "IRC-6KD2TW8QMX",
    premises: "le-thanh-ton",
    appointment: "kv1",
    inspectedAt: "2026-09-29T14:10:00+07:00",
    issuedAt: "2026-09-29T14:31:00+07:00",
    outcome: "GUIDANCE_GIVEN",
    findings: [
      { kind: "MUSIC_IN_USE", note: null },
      {
        kind: "RECORD_SCOPE_EXCEEDED",
        note: {
          vi: "nhạc phát ở cả sân thượng, ngoài khu vực ghi trong giấy xác nhận",
          en: "music also plays on the roof terrace, outside the area the certificate names",
        },
      },
    ],
    guidance: {
      vi: "Đã hướng dẫn cơ sở báo thay đổi khu vực sử dụng nhạc qua cổng một cửa RightOne trong 30 ngày.",
      en: "Advised the premises to report the change of music area through the RightOne single window within 30 days.",
    },
    followUp: "RE_VISIT",
    followUpBy: "2026-11-30",
    delivery: handed("2026-09-29T14:31:00+07:00"),
  },
  {
    reference: "IRC-4M8QK2TW7C",
    premises: "le-thanh-ton",
    appointment: "kv1",
    inspectedAt: "2026-09-10T09:40:00+07:00",
    issuedAt: "2026-09-10T10:02:00+07:00",
    outcome: "GUIDANCE_GIVEN",
    findings: [
      { kind: "MUSIC_IN_USE", note: null },
      { kind: "RECORD_NOT_PRESENTED", note: null },
    ],
    guidance: {
      vi: "Đã hướng dẫn cơ sở xuất trình giấy xác nhận đang có hiệu lực tại quầy.",
      en: "Advised the premises to show the certificate in force at the counter.",
    },
    followUp: "NONE",
    followUpBy: null,
    delivery: handed("2026-09-10T10:05:00+07:00"),
  },
  {
    reference: "IRC-1TQ9WM4KXD",
    premises: "le-thanh-ton",
    appointment: "kv1",
    inspectedAt: "2026-08-12T15:25:00+07:00",
    issuedAt: "2026-08-12T15:25:00+07:00",
    outcome: "NOTHING_FOUND",
    findings: [],
    guidance: null,
    followUp: "NONE",
    followUpBy: null,
    delivery: handed("2026-08-12T15:25:00+07:00"),
  },
  {
    reference: "IRC-8KT3QW5MXA",
    premises: "PRM-6BVK3RQT",
    appointment: "kv1",
    inspectedAt: "2026-09-22T10:00:00+07:00",
    issuedAt: "2026-09-22T10:00:00+07:00",
    outcome: "GUIDANCE_GIVEN",
    findings: [],
    guidance: null,
    followUp: "NONE",
    followUpBy: null,
    delivery: { state: "PENDING", dueBy: "2026-09-27T10:00:00+07:00", handedOverAt: null },
  },
  {
    reference: "IRC-2QX7MK4TWD",
    premises: "ap-mai-ton-that-thiep",
    appointment: "kv1",
    inspectedAt: "2026-09-18T15:00:00+07:00",
    issuedAt: "2026-09-18T15:00:00+07:00",
    outcome: "GUIDANCE_GIVEN",
    findings: [],
    guidance: null,
    followUp: "RE_VISIT",
    followUpBy: "2026-09-25",
    delivery: handed("2026-09-18T15:00:00+07:00"),
  },
];

/**
 * The inspection SCR-VER-18 draws whose inspector can no longer act: opened at The Lintel Coffee – Lý Tự Trọng
 * by La Thị Bích Ngân, whose appointment ended on 26 September, six days before the canvas's moment.
 */
export const CANVAS_ORPHANED_INSPECTIONS: readonly CanvasInspection[] = [
  {
    reference: "ISP-3T7KW2MQ9A",
    premises: "PRM-3LTX7KQV",
    appointment: "apt-kv1-ngan",
    purpose: null,
    observedAt: "2026-09-24T10:00:00+07:00",
    late: false,
    attached: [],
    findings: [],
    draft: null,
  },
];

/** A request to reconsider a record, and the case it opened. */
export interface CanvasChallenge {
  subjectKind: "ANSWER" | "INSPECTION_RECORD";
  subjectRef: string;
  versionNo: number | null;
  premises: string;
  caseRef: string;
  /** Null where the board draws no instant. */
  openedAt: string | null;
}

/**
 * The requests to reconsider VER's boards draw, and the cases they opened, which CAS's seed holds under the same
 * references (`SEED_CASES`): CAS-2026-000412, decided, requires IRC-4M8QK2TW7C corrected (SCR-VER-13, 15, 18);
 * CAS-2026-000377, decided, under which Đa Kao's record was corrected to version 2 (SCR-VER-06).
 */
export const CANVAS_CHALLENGES: readonly CanvasChallenge[] = [
  { subjectKind: "INSPECTION_RECORD", subjectRef: "IRC-4M8QK2TW7C", versionNo: 1, premises: "le-thanh-ton", caseRef: "CAS-2026-000412", openedAt: null },
  { subjectKind: "INSPECTION_RECORD", subjectRef: "IRC-3XK7QW2MTD", versionNo: 1, premises: "da-kao", caseRef: "CAS-2026-000377", openedAt: null },
];

/**
 * The answer SCR-VER-14 draws a premises asking to reconsider: given on the public verification page at 19:40 on
 * 29 September about Lê Thánh Tôn, in force, for background music in the main room.
 */
export interface CanvasPublicAnswer {
  reference: string;
  answeredAt: string;
  premises: string;
  outcome: AnswerOutcome;
  /** The scope of use the answer showed. */
  scope: Localised;
}

export const CANVAS_PUBLIC_ANSWERS: readonly CanvasPublicAnswer[] = [
  {
    reference: "VRA-6T2KQ9MW4A",
    answeredAt: "2026-09-29T19:40:00+07:00",
    premises: "le-thanh-ton",
    outcome: inForce("R1-CER-2026-K9TE4WQC", LE_THANH_TON, "2026-09-02T15:05:00+07:00", { from: "2026-09-28", to: "2027-09-01" }, "2026-09-29T19:40:00+07:00"),
    scope: { vi: "Nhạc nền tại phòng chính", en: "Background music in the main room" },
  },
];

/** The supply SCR-VER-16 draws requested by Tạ Quốc Huy for Phường Tân Định alone (SCR-VER-08, empty and limited). */
export const CANVAS_OTHER_SUPPLIES: readonly (CanvasSupply & { requester: string })[] = [
  {
    supply: { reference: "ILS-2TQ6WK8MXN", kind: "NO_CURRENT_RECORD", state: "READY", generatedAt: "2026-09-30T09:15:00+07:00", failure: null },
    appointment: "apt-kv1-huy",
    areas: ["Phường Tân Định"],
    requestedAt: null,
    register: {
      route: "ALTERNATIVE_ROUTE",
      reconciledAt: "2026-09-15T02:00:00+07:00",
      reconciledDaysAgo: 15,
      scope: "AREAS",
      limitedAreas: ["Phường Tân Định"],
      version: "RR-2026-09-15-01",
      readAt: "2026-09-30T09:15:00+07:00",
    },
    counts: { byArea: [{ area: "Phường Tân Định", listed: 0 }], listed: 0, current: 9, outOfScope: 1, indeterminate: 0, notOperating: 0 },
    entries: [],
    requester: "Tạ Quốc Huy",
  },
];

/** The counts of SCR-VER-16 per authority over a month: inspections by state, records by outcome, deliveries. */
export interface OversightCounts {
  open: number;
  concluded: number;
  abandoned: number;
  compliant: number;
  nothingFound: number;
  guidance: number;
  referred: number;
  undelivered: number;
}

/**
 * What SCR-VER-16 counts in September 2026 beyond the inspections and records the seed holds one by one: the
 * board's figures per authority less those the world draws (two open and five records of KTVH-KV1, KV2's and
 * KV3's open inspections). The page adds the world's own, so an act made now moves the count.
 */
export const OVERSIGHT_BASELINE: readonly { month: string; authority: string; counts: OversightCounts }[] = [
  { month: "2026-09", authority: "dsg-kv1", counts: { open: 0, concluded: 9, abandoned: 1, compliant: 6, nothingFound: 2, guidance: 0, referred: 1, undelivered: 0 } },
  { month: "2026-09", authority: "dsg-kv2", counts: { open: 0, concluded: 5, abandoned: 0, compliant: 3, nothingFound: 1, guidance: 1, referred: 0, undelivered: 0 } },
  { month: "2026-09", authority: "dsg-kv3", counts: { open: 0, concluded: 3, abandoned: 0, compliant: 2, nothingFound: 0, guidance: 1, referred: 0, undelivered: 0 } },
];
