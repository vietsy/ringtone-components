import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import {
  abandonInspection as abandonInBackend,
  attachVerification,
  carryAnswerIntoInspection,
  chooseActingFor,
  concludeInspection as concludeInBackend,
  conclusionOf,
  discardOfflineResult as discardInBackend,
  fieldHomeOf,
  inspectionListsOf,
  inspectionOf,
  inspectionRecordOf,
  inspectionStartOf,
  listSupplyOf,
  openInspection as openInBackend,
  parseDay,
  recordDelivery,
  recordFinding as recordFindingInBackend,
  refreshVerificationKeys,
  requestInspectionList,
  scanAndVerifyOf,
  uploadOfflineResult as uploadInBackend,
  verificationAnswerOf,
  verify,
} from "@/lib/mock/backend/inspection";
import {
  MOCK_FIELD_DEVICE,
  mockConclusion,
  mockFieldHome,
  mockInspection,
  mockInspectionLists,
  mockInspectionRecord,
  mockInspectionStart,
  mockListSupply,
  mockScanAndVerify,
  mockVerificationAnswer,
  type Ver01View,
  type Ver02View,
  type Ver03View,
  type Ver04View,
  type Ver05View,
  type Ver06Reader,
  type Ver06View,
  type Ver07View,
  type Ver08View,
  type Ver17View,
} from "@/lib/mock/inspection";
import { NOT_CONFIGURED, usesMockData } from "./source";

/**
 * The inspector's two surfaces: the field client on the phone (SCR-VER-17, -01 to -06) and the inspection
 * console on the authority's desk (SCR-VER-07, -08). Every refusal is named by its code from the family's
 * refusal catalogue (design/04); the words are the page's, from the catalogue pair `ver`.
 *
 * Each load takes the view a reviewer asked for with `?view=`: a view returns the canvas's fixture for that
 * state, and null reads the signed-in session's own state from the mock backend, as the API will be read.
 */
export type RefusalCode =
  | "ABANDONMENT_NOT_PERMITTED"
  | "ALREADY_DELIVERED"
  | "ANSWER_NOT_FOR_PREMISES"
  | "ANSWER_NOT_FOUND"
  | "ANSWER_OUTSIDE_INSPECTION_WINDOW"
  | "APPOINTMENT_REQUIRED"
  | "APPOINTMENT_SUSPENDED"
  | "AUTHORITY_NOT_ACTIVE"
  | "CASE_INTAKE_UNAVAILABLE"
  | "CERTIFICATE_READ_UNAVAILABLE"
  | "CURSOR_INVALID"
  | "DECISION_READ_UNAVAILABLE"
  | "DELAY_REASON_REQUIRED"
  | "ENTRIES_DISPOSED"
  | "FOLLOW_UP_DATE_INVALID"
  | "GENERATION_TIMED_OUT"
  | "GUIDANCE_MISSING"
  | "HANDOVER_TIME_INVALID"
  | "INSPECTION_NOT_FOUND"
  | "INSPECTION_NOT_OPEN"
  | "JURISDICTION_NOT_RECORDED_FOR_GEOGRAPHY"
  | "KEYS_UNAVAILABLE"
  | "LIST_SUPPLY_LIMIT_REACHED"
  | "NOTE_REQUIRED"
  | "NOT_AUTHORISED"
  | "NOT_ISSUING_AUTHORITY"
  | "NO_EFFECTIVE_APPOINTMENT"
  | "OBSERVED_AT_IN_FUTURE"
  | "OBSERVED_OUTSIDE_AUTHORITY"
  | "OUTCOME_CONTRADICTS_FINDING"
  | "OUTCOME_NOT_SUPPORTED"
  | "OUTSIDE_JURISDICTION"
  | "PAYLOAD_REFERENCE_MISMATCH"
  | "PAYLOAD_UNREADABLE"
  | "PENALTY_ROUTE_NOT_IN_FORCE"
  | "POLICY_READ_UNAVAILABLE"
  | "PREMISES_READ_UNAVAILABLE"
  | "PURPOSE_NOT_ADMITTED"
  | "REASON_REQUIRED"
  | "RECORD_NOT_CURRENT_AT_INSPECTION"
  | "RECORD_NOT_FOUND"
  | "RECORD_READ_UNAVAILABLE"
  | "REFERRAL_NOTE_MISSING"
  | "REGISTER_READ_UNAVAILABLE"
  | "REPRESENTATIVE_ROLE_MISSING"
  | "SCOPE_READ_UNAVAILABLE"
  | "SUPPLY_NOT_FOUND"
  | "SUPPLY_NOT_READY";

export type Purpose = "ROUTINE" | "COMPLAINT_FOLLOW_UP" | "LIST_FOLLOW_UP" | "RE_VISIT";
export type FindingKind =
  | "MUSIC_IN_USE"
  | "NO_MUSIC_IN_USE"
  | "RECORD_PRESENTED"
  | "RECORD_NOT_PRESENTED"
  | "RECORD_SCOPE_EXCEEDED"
  | "EXTERNAL_LICENCE_PRESENTED"
  | "PREMISES_CLOSED"
  | "OTHER";
export type Outcome = "COMPLIANT" | "NOTHING_FOUND" | "GUIDANCE_GIVEN" | "REFERRED";
export type ReferralRoute = "CASE_FOLLOW_UP" | "PENALTY_ROUTE";
export type RepresentativeRole = "OWNER" | "MANAGER" | "EMPLOYEE" | "OTHER_PRESENT_PERSON";
export type Acknowledgement = "ACKNOWLEDGED" | "REFUSED_TO_ACKNOWLEDGE" | "NO_REPRESENTATIVE_PRESENT";
export type FollowUpKind = "NONE" | "RE_VISIT" | "AWAIT_REGISTRATION" | "CASE";
export type IdentifierType = "PUBLIC_REFERENCE" | "REPRESENTATION_REFERENCE" | "PREMISES_REFERENCE";
export type ListKind = "NO_CURRENT_RECORD" | "NOT_CURRENT_WITH_DECISION";
export type SupplyState = "REQUESTED" | "READY" | "FAILED" | "DISPOSED";

/** The values each choice admits, in the order the screens offer them (design/03 section 5c). */
export const PURPOSES: readonly Purpose[] = ["ROUTINE", "COMPLAINT_FOLLOW_UP", "LIST_FOLLOW_UP", "RE_VISIT"];
export const FINDING_KINDS: readonly FindingKind[] = [
  "MUSIC_IN_USE",
  "NO_MUSIC_IN_USE",
  "RECORD_PRESENTED",
  "RECORD_NOT_PRESENTED",
  "RECORD_SCOPE_EXCEEDED",
  "EXTERNAL_LICENCE_PRESENTED",
  "PREMISES_CLOSED",
  "OTHER",
];
export const OUTCOMES: readonly Outcome[] = ["COMPLIANT", "NOTHING_FOUND", "GUIDANCE_GIVEN", "REFERRED"];
export const REFERRAL_ROUTES: readonly ReferralRoute[] = ["CASE_FOLLOW_UP", "PENALTY_ROUTE"];
export const REPRESENTATIVE_ROLES: readonly RepresentativeRole[] = ["OWNER", "MANAGER", "EMPLOYEE", "OTHER_PRESENT_PERSON"];
export const ACKNOWLEDGEMENTS: readonly Acknowledgement[] = ["ACKNOWLEDGED", "REFUSED_TO_ACKNOWLEDGE", "NO_REPRESENTATIVE_PRESENT"];
export const FOLLOW_UPS: readonly FollowUpKind[] = ["NONE", "RE_VISIT", "AWAIT_REGISTRATION", "CASE"];
export const IDENTIFIER_TYPES: readonly IdentifierType[] = ["PUBLIC_REFERENCE", "REPRESENTATION_REFERENCE", "PREMISES_REFERENCE"];
export const LIST_KINDS: readonly ListKind[] = ["NO_CURRENT_RECORD", "NOT_CURRENT_WITH_DECISION"];

/** A premises as the register names it: its display name and its register address, where the canvas gives one. */
export interface PremisesName {
  name: string;
  address: string | null;
}

export interface Period {
  from: string;
  to: string;
}

/** An appointment in force, under which an inspector acts for one authority over its jurisdiction. */
export interface Appointment {
  id: string;
  /** The authority's code, as the inspection rows and titles write it: "KTVH-KV1". */
  authorityCode: string;
  /** The authority's code and name, as a choice reads it. */
  authority: string;
  /** The wards of the authority's jurisdiction. */
  areas: readonly string[];
}

/**
 * The phone's own state, which the field client keeps in its store on the device rather than reading from
 * the API: the network, the verification key it checks codes with offline, when the screen was last read, and
 * the results it holds. The seams hand it over with each screen so a page renders once, on the server.
 */
export interface FieldDevice {
  network: "online" | "offline";
  /** `until` is a date while the key is valid and a timestamp while it is expiring. */
  verificationKey: { state: "valid" | "expiring"; until: string } | { state: "missing" };
  /** When the screen's data was last read; said while offline. */
  readAt: string | null;
  /** Results checked offline waiting to upload, and results a permanent refusal returned. */
  queue: { waiting: number; failed: number };
}

// ------------------------------------------------------------------ SCR-VER-17 Field client home

/** An inspection the inspector opened and has not concluded. */
export interface OpenInspectionSummary {
  reference: string;
  premises: string;
  authorityCode: string;
  openedAt: string;
  /** Open past the recording interval: it is concluded with a reason for late recording. */
  pastRecordingInterval: boolean;
  /** After the appointment's last day, until when the visit already made may still be recorded. */
  recordableUntil: string | null;
}

export interface FieldHome {
  device: FieldDevice;
  /** The appointments in force; none when the inspector holds none or the appointment is suspended. */
  appointments: readonly Appointment[];
  actingFor: string | null;
  /** A refusal that governs the whole screen: no appointment in force, a suspension, the authority, the rules. */
  refusal: RefusalCode | null;
  openInspections: readonly OpenInspectionSummary[];
  /** Set when the page of open inspections asked for can no longer be read (CURSOR_INVALID). */
  openInspectionsRefusal: RefusalCode | null;
  /** The browser may clear the results waiting to upload when the phone runs short of storage. */
  storageAtRisk: boolean;
  /** A new version of the field client is waiting. */
  updateReady: boolean;
}

// ------------------------------------------------------------------ SCR-VER-01 Scan and verify

/** A result checked offline, waiting on the phone to upload, in the outcome words of section 5. */
export interface WaitingResult {
  representation: string;
  /** LIMITED_OFFLINE: authentic, current state unknown. UNABLE_TO_VERIFY: no key held for it, or keys too old. */
  outcome: "LIMITED_OFFLINE" | "UNABLE_TO_VERIFY";
  checkedAt: string;
  /** The answer its last upload got that left it waiting (a read RightOne could not make). */
  refusal: RefusalCode | null;
}

/** RightOne's own answer to a result the phone uploaded in the last 7 days. */
export interface UploadedResult {
  answer: string;
  state: "IN_FORCE" | "REVOKED";
  /** RightOne's answer is not what the phone said offline. */
  differsFromDevice: boolean;
  checkedAt: string;
  /** The refusal the answer gave when the inspector opened it. */
  refusal: RefusalCode | null;
}

/** A result a permanent refusal returned; it can only be discarded. */
export interface FailedResult {
  representation: string;
  refusal: RefusalCode;
  checkedAt: string;
}

export interface ScanAndVerify {
  device: FieldDevice;
  /** In the page header, with the controls unavailable. */
  refusal: RefusalCode | null;
  /** Beside the refresh line: the keys could not be read, the earlier ones are kept. */
  keysRefusal: RefusalCode | null;
  /** The camera on the phone: scanning, a code read, or access refused. */
  camera: "scanning" | "found" | "denied";
  /** The reference the camera read. */
  scannedCode: string | null;
  /** The answer to the code read is being fetched; after 5 s the offline check is offered. */
  checking: boolean;
  /** What the inspector had typed when the act was refused. */
  typedReference: string;
  /** The open inspection the screen was opened from (SCR-VER-04): what is verified attaches to it. */
  inspection: string | null;
  waiting: readonly WaitingResult[];
  uploaded: readonly UploadedResult[];
  failed: readonly FailedResult[];
}

/** The key a row of results waiting or not uploaded is acted on by: its printout and when it was checked. */
export function resultKey(row: { representation: string; checkedAt: string }): string {
  return `${row.representation}-${row.checkedAt}`;
}

// ------------------------------------------------------------------ SCR-VER-02 Verification answer

export type AnswerOutcome =
  /** The record's state now; the only outcome headed by the state. */
  | {
      kind: "CURRENT_RESULT";
      state: "IN_FORCE" | "SUSPENDED";
      record: string;
      /** Null in the public field set, which names no premises. */
      premises: PremisesName | null;
      /** A timestamp, or a date where the source gives only the day; null where it is not known. */
      stateSince: string | null;
      period: Period;
      /** When the register was read, to the second. */
      readAt: string;
      /** False when the code scanned is an older printout of the record. */
      representationCurrent: boolean;
      /** Why only the public field set is shown, when it is. */
      publicFieldSetReason: "OUTSIDE_JURISDICTION" | null;
    }
  /** SYSTEM: a system did not answer. NO_KEY: offline, with no key for the code or keys more than 7 days old. */
  | { kind: "UNABLE_TO_VERIFY"; cause: "SYSTEM" | "NO_KEY" }
  | { kind: "INVALID_INPUT"; expectedFormat: string | null; usableTypes: readonly IdentifierType[] }
  | { kind: "NO_RECORD" }
  | { kind: "NO_PREMISES_IN_JURISDICTION" }
  /** `lastState` null: never issued. */
  | { kind: "NO_CURRENT_RECORD_FOR_PREMISES"; premises: PremisesName; lastState: "SUSPENDED" | null }
  | { kind: "AMBIGUOUS"; count: number }
  | { kind: "NOT_AUTHENTICATED" }
  /** Checked on the phone without a network: the code is authentic, its state is the one printed. */
  | {
      kind: "LIMITED_OFFLINE";
      record: string;
      premises: PremisesName;
      printedState: "IN_FORCE";
      period: Period;
      printedAt: string;
      keysRefreshedAt: string;
    };

export interface VerificationAnswer {
  device: FieldDevice;
  /** The answer reference; null for a result not yet uploaded. */
  reference: string | null;
  outcome: AnswerOutcome;
  /** The inspection the answer was verified from, and whether it was attached to it. */
  inspection: { reference: string; attached: boolean } | null;
  /** Why the answer was not attached to that inspection. */
  attachRefusal: RefusalCode | null;
}

// ------------------------------------------------------------------ SCR-VER-03 Start an inspection

export interface InspectionStart {
  device: FieldDevice;
  premises: PremisesName;
  answer: string;
  appointment: Appointment;
  /** The inspection of this premises the inspector already has open. */
  openInspection: string | null;
  /** In the page header. */
  refusal: RefusalCode | null;
  /** The answer could not be attached as the inspection's evidence. */
  answerRefusal: RefusalCode | null;
  /** After the appointment's last day an inspection opens only from a verification made before it. */
  pastAppointmentEnd: boolean;
  /** The list of open inspections could not be read from the page asked for. */
  openInspectionsRefusal: RefusalCode | null;
  /** What the form holds: the inspector's last entry, or the defaults. */
  draft: {
    purpose: Purpose;
    basis: string;
    observedOn: string;
    observedTime: string;
    observedRefusal: RefusalCode | null;
    /** Recorded after the time allowed, so a reason for late recording is required. */
    delayReasonRequired: boolean;
    delayReason: string;
    delayRefusal: RefusalCode | null;
  };
}

// ------------------------------------------------------------------ SCR-VER-04 Inspection in progress

export type AttachedAnswerResult =
  | { kind: "IN_FORCE" }
  /** The record was suspended when the answer was given. */
  | { kind: "SUSPENDED" }
  /** The premises held no record in force when the answer was given. */
  | { kind: "NO_CURRENT_RECORD" }
  /** Refused at attaching; the answer is stored on its own. */
  | { kind: "NOT_ATTACHED"; refusal: RefusalCode }
  /** Checked offline from this inspection, waiting on the phone: the state printed, not the state now. */
  | { kind: "WAITING_OFFLINE"; printedOn: string };

export interface AttachedAnswer {
  answer: string;
  result: AttachedAnswerResult;
  readAt: string;
}

export interface UploadedAnswer {
  answer: string;
  checkedAt: string;
  /** The refusal Attach got for this answer. */
  refusal: RefusalCode | null;
}

export interface Finding {
  kind: FindingKind;
  note: string | null;
}

export interface InspectionInProgress {
  device: FieldDevice;
  reference: string;
  premises: string;
  authorityCode: string;
  /** Null where the canvas does not say what an inspection of its seed was for. */
  purpose: Purpose | null;
  tookPlaceAt: string;
  state: "OPEN" | "CONCLUDED" | "ABANDONED";
  /** The record issued when the inspection was concluded. */
  record: string | null;
  attached: readonly AttachedAnswer[];
  /** Answers the inspector uploaded for this premises that are not attached to the inspection. */
  uploadedNotAttached: readonly UploadedAnswer[];
  findings: readonly Finding[];
  /** In the page header, with the acts unavailable. */
  refusal: RefusalCode | null;
  pastAppointmentEnd: boolean;
  /** What the finding form holds, and the refusal its last send got. */
  draft: { kind: FindingKind | null; note: string | null; noteRefusal: RefusalCode | null };
  /** What the abandon dialog holds, and the refusal its last send got. */
  abandon: { reason: string; refusal: RefusalCode | null };
}

// ------------------------------------------------------------------ SCR-VER-05 Conclude the inspection

export interface ConclusionDraft {
  /** Null until the inspector chooses one. */
  outcome: Outcome | null;
  /** The refusal the outcome got: the pilot's penalty route, an outcome the evidence does not support. */
  outcomeRefusal: RefusalCode | null;
  guidance: string;
  guidanceRefusal: RefusalCode | null;
  route: ReferralRoute;
  referralNote: string;
  referralNoteRefusal: RefusalCode | null;
  representativeRole: RepresentativeRole | null;
  roleRefusal: RefusalCode | null;
  acknowledgement: Acknowledgement | null;
  statement: string;
  delayReason: string;
  delayRefusal: RefusalCode | null;
  followUp: FollowUpKind;
  followUpBy: string;
  followUpRefusal: RefusalCode | null;
}

export interface Conclusion {
  device: FieldDevice;
  inspection: string;
  premises: string;
  tookPlaceAt: string;
  /** More than 24 hours since it took place: a reason for late recording is required. */
  lateRecording: boolean;
  /** In the page header. */
  refusal: RefusalCode | null;
  /** The record already issued, when the inspection has ended. */
  record: string | null;
  /** A result checked offline for this inspection that has not been uploaded. */
  offlineResultWaiting: string | null;
  draft: ConclusionDraft;
}

// ------------------------------------------------------------------ SCR-VER-06 Inspection record

export interface InspectionRecord {
  device: FieldDevice;
  reference: string;
  version: number;
  premises: PremisesName;
  /** The issuing authority's code and name. */
  authority: string;
  issuedAt: string;
  outcome: Outcome;
  /** Whether the premises asked to reconsider the record; UNKNOWN when it cannot be told just now. */
  reconsideration: "NONE" | "UNKNOWN";
  /** The tail of the record's digest. */
  digest: string;
  /** The version in force after a correction. */
  versionInForce: boolean;
  /**
   * The whole record, for the issuing authority only. Another authority's inspector reads the confirmation:
   * no person, no finding, no representative.
   */
  whole: {
    inspector: { name: string; card: string };
    inspectedAt: string;
    /** The answer in force the record rests on; null where none is attached. */
    answer: { reference: string; state: "IN_FORCE" } | null;
    findings: readonly Finding[];
    /** Null where nobody was present. */
    representative: { role: RepresentativeRole | null; acknowledgement: Acknowledgement };
    followUp: FollowUpKind;
    followUpBy: string | null;
    /** The case under which this version corrected the earlier one. */
    correctedUnderCase: string | null;
    delivery: { state: "PENDING" | "HANDED_OVER"; handedOverAt: string | null; dueBy: string; noticeSent: boolean };
  } | null;
  /** In the page header. */
  refusal: RefusalCode | null;
  /** The refusal the handover got. */
  deliveryRefusal: RefusalCode | null;
  /** What the handover form holds, and the refusal its last send got. */
  handover: { on: string; time: string; recipient: RepresentativeRole | null; refusal: RefusalCode | null };
}

// ------------------------------------------------------------------ SCR-VER-07 Inspection lists

/** One list the authority requested, and what became of it. */
export interface Supply {
  reference: string;
  kind: ListKind;
  state: SupplyState;
  generatedAt: string | null;
  /** Why a supply could not be generated. */
  failure: RefusalCode | null;
}

export interface InspectionLists {
  authorityCode: string;
  asOf: string;
  appointments: readonly Appointment[];
  /** The appointment the request is made under; null when none is chosen. */
  actingFor: string | null;
  actingForRefusal: RefusalCode | null;
  /** The kind the request form holds. */
  requestKind: ListKind;
  /** The wards the request may name: the jurisdiction, and any the inspector typed. */
  areaOptions: readonly string[];
  areas: readonly string[];
  areasRefusal: RefusalCode | null;
  requestedToday: number;
  dailyLimit: number;
  /** Set when today's limit is reached: when the next request can be made. */
  nextRequestAt: string | null;
  /** In the page header. */
  refusal: RefusalCode | null;
  /** The filter the supplies were read with; null is every kind or state. */
  filter: { kind: ListKind | null; state: SupplyState | null };
  supplies: readonly Supply[];
  /** The page of supplies asked for can no longer be read (CURSOR_INVALID). */
  suppliesRefusal: RefusalCode | null;
}

// ------------------------------------------------------------------ SCR-VER-08 List supply and entries

/** The register line of FR-VER-041: where the register came from, its reconciliation, and its limits. */
export interface RegisterRead {
  route: "AUTHORITATIVE_SOURCE" | "ALTERNATIVE_ROUTE" | "MANUAL_ADMISSION";
  reconciledAt: string | null;
  reconciledDaysAgo: number;
  scope: "NONE" | "WHOLE_REGISTER" | "AREAS";
  limitedAreas: readonly string[];
  version: string;
  readAt: string;
}

export type EntryClass =
  | "NO_RECORD_EVER"
  | "DECIDED_AWAITING_RECORD"
  | "RECORD_NOT_CURRENT"
  | "REPORTED_CHANGE_UNDECIDED"
  | "CONSEQUENCE_NOT_EFFECTIVE";

export interface SupplyEntry {
  premises: string;
  reference: string;
  /** The register address, with its ward. */
  address: string;
  area: string;
  class: EntryClass;
  /** The decision the class waits on, or the change reported. */
  detail: { kind: "DECISION" | "CHANGE"; reference: string } | null;
  lastStatus: "IN_FORCE" | "SUSPENDED" | null;
  since: string | null;
  deadline: { kind: "WITHIN" | "PAST"; date: string } | null;
}

/** How the premises in the supply's areas were counted; null where the count is not known. */
export interface SupplyCounts {
  byArea: readonly { area: string; listed: number }[];
  listed: number;
  current: number | null;
  outOfScope: number | null;
  indeterminate: number | null;
  notOperating: number | null;
}

export interface ListSupply {
  reference: string;
  kind: ListKind;
  state: SupplyState;
  areas: readonly string[];
  /**
   * When it was requested. The header says it only while the supply is being generated, which is the only
   * state the canvas gives it for; null where the read does not carry it.
   */
  requestedAt: string | null;
  generatedAt: string | null;
  /** Days since it was generated, as the header says it. */
  ageDays: number;
  register: RegisterRead | null;
  /** The register could not be read when the supply was generated. */
  registerUnread: boolean;
  /** Why the supply could not be generated. */
  failure: RefusalCode | null;
  counts: SupplyCounts | null;
  entries: readonly SupplyEntry[];
  /** In place of the entries: not ready, disposed after retention, or a page that can no longer be read. */
  entriesRefusal: RefusalCode | null;
  /** The entry in focus, whose reference can be copied. */
  selected: string | null;
  /** In the page header, in place of the supply. */
  refusal: RefusalCode | null;
}

// ------------------------------------------------------------------ what a refused form hands back to its page

/** SCR-VER-01: the inspection it verifies for, what was typed, and the refusal the verification got. */
export interface ScanAttempt {
  inspection: string | null;
  typed: string;
  refusal: RefusalCode | null;
}

/** SCR-VER-03: the form as it was sent, and its refusal. */
export interface StartAttempt {
  purpose: Purpose;
  basis: string;
  observedOn: string;
  observedTime: string;
  delayReason: string;
  /** Null for a form sent without a field it requires: it is drawn again as sent, with nothing recorded. */
  refusal: RefusalCode | null;
}

/** SCR-VER-04: the act refused, with what was typed for it. */
export type InspectionAttempt =
  | { act: "finding"; kind: FindingKind | null; note: string; refusal: RefusalCode | null }
  | { act: "abandon"; reason: string; refusal: RefusalCode }
  | { act: "attach"; answer: string; refusal: RefusalCode };

/** The fields of SCR-VER-05 that show only for some outcomes or follow-ups, and so may not be on the form sent. */
export type ConditionalField = "guidance" | "route" | "referralNote" | "delayReason" | "followUpBy";

/** SCR-VER-05: the conclusion as it was sent, and its refusal. */
export interface ConclusionAttempt {
  /** The fields that were not on the form: what the page held for them before is kept, not emptied. */
  notSent: readonly ConditionalField[];
  outcome: Outcome | null;
  guidance: string;
  route: ReferralRoute;
  referralNote: string;
  representativeRole: RepresentativeRole | null;
  acknowledgement: Acknowledgement | null;
  statement: string;
  delayReason: string;
  followUp: FollowUpKind;
  followUpBy: string;
  refusal: RefusalCode | null;
}

/** SCR-VER-06: the handover as it was sent, and its refusal. */
export interface HandoverAttempt {
  on: string;
  time: string;
  recipient: RepresentativeRole | null;
  refusal: RefusalCode | null;
}

/** SCR-VER-07: the request as it was sent, and its refusal. */
export interface ListAttempt {
  appointment: string | null;
  kind: ListKind;
  areas: readonly string[];
  refusal: RefusalCode;
}

// ------------------------------------------------------------------ the seams

/**
 * The phone's state on its own, for a screen whose data is still being read. Outside mock data there is no
 * device to read on the server, so the page draws no status strip rather than a guessed one.
 */
export function currentFieldDevice(): FieldDevice | null {
  return usesMockData() ? MOCK_FIELD_DEVICE : null;
}

function answer<T>(fixture: () => LoadOutcome<T>, live: () => LoadOutcome<T>, view: unknown): Promise<LoadOutcome<T>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? fixture() : live());
}

/** SCR-VER-17 reads the inspector's appointments and open inspections, and the phone's results. */
export function loadFieldHome(sessionId: string, view: Exclude<Ver17View, "loading"> | null): Promise<LoadOutcome<FieldHome>> {
  return answer(
    () => mockFieldHome(view ?? "populated"),
    () => fieldHomeOf(sessionId),
    view,
  );
}

/** SCR-VER-01 reads the keys' state and the results the phone holds and uploaded. */
export function loadScanAndVerify(
  sessionId: string,
  view: Exclude<Ver01View, "loading"> | null,
  attempt: ScanAttempt | null,
): Promise<LoadOutcome<ScanAndVerify>> {
  return answer(
    () => mockScanAndVerify(view ?? "online"),
    () => scanAndVerifyOf(sessionId, attempt),
    view,
  );
}

/**
 * SCR-VER-02 reads one stored answer by its reference. A refusal (not found, a mismatched payload, no
 * appointment, the register unreadable) is a failure with its code, never an answer.
 */
export function loadVerificationAnswer(
  sessionId: string,
  reference: string,
  view: Exclude<Ver02View, "loading"> | null,
): Promise<LoadOutcome<VerificationAnswer>> {
  return answer(
    () => mockVerificationAnswer(view ?? "online"),
    () => verificationAnswerOf(sessionId, reference),
    view,
  );
}

/**
 * SCR-VER-03 reads what the inspection would start from: the premises, the answer carried in from SCR-VER-02
 * and the appointment it was given under. Nothing carried in answers NOTHING_CARRIED, and the page goes back to
 * where every inspection starts, a verification.
 */
export function loadInspectionStart(
  sessionId: string,
  view: Exclude<Ver03View, "loading"> | null,
  attempt: StartAttempt | null,
): Promise<LoadOutcome<InspectionStart>> {
  return answer(
    () => mockInspectionStart(view ?? "populated"),
    () => inspectionStartOf(sessionId, attempt),
    view,
  );
}

/** SCR-VER-04 reads one inspection. The canvas's sample notes are written in the reader's language. */
export function loadInspection(
  sessionId: string,
  inspection: string,
  view: Exclude<Ver04View, "loading"> | null,
  locale: Locale,
  attempt: InspectionAttempt | null,
): Promise<LoadOutcome<InspectionInProgress>> {
  return answer(
    () => mockInspection(view ?? "populated", locale),
    () => inspectionOf(sessionId, inspection, locale, attempt),
    view,
  );
}

/** SCR-VER-05 reads the inspection to conclude and what the inspector has entered so far. */
export function loadConclusion(
  sessionId: string,
  inspection: string,
  view: Ver05View | null,
  locale: Locale,
  attempt: ConclusionAttempt | null,
): Promise<LoadOutcome<Conclusion>> {
  return answer(
    () => mockConclusion(inspection, view ?? "guidance", locale),
    () => conclusionOf(sessionId, inspection, locale, attempt),
    view,
  );
}

/**
 * SCR-VER-06 reads one inspection record: the whole of it for the issuing authority, its confirmation for
 * another. A reviewer may ask for either reader of the canvas with `reader`; the session's own reader is
 * decided by its appointments.
 */
export function loadInspectionRecord(
  sessionId: string,
  record: string,
  view: Exclude<Ver06View, "loading"> | null,
  reader: Ver06Reader | null,
  locale: Locale,
  attempt: HandoverAttempt | null,
): Promise<LoadOutcome<InspectionRecord>> {
  return answer(
    () => mockInspectionRecord(record, view ?? "pending", reader ?? "issuing", locale),
    () => inspectionRecordOf(sessionId, record, locale, attempt),
    view === null && reader === null ? null : true,
  );
}

/** SCR-VER-07 reads the authority's list supplies and today's count. */
export function loadInspectionLists(
  sessionId: string,
  view: Exclude<Ver07View, "loading"> | null,
  attempt: ListAttempt | null,
): Promise<LoadOutcome<InspectionLists>> {
  return answer(
    () => mockInspectionLists(view ?? "populated"),
    () => inspectionListsOf(sessionId, attempt),
    view,
  );
}

/** SCR-VER-08 reads one supply and its entries. */
export function loadListSupply(
  sessionId: string,
  list: string,
  view: Exclude<Ver08View, "loading"> | null,
): Promise<LoadOutcome<ListSupply>> {
  return answer(
    () => mockListSupply(view ?? "ready"),
    () => listSupplyOf(sessionId, list),
    view,
  );
}

// ------------------------------------------------------------------ acts

/** The day a date field sends (ISO, or the dd/mm/yyyy a field without a time sends) as an ISO date; null for none. */
export function isoDay(value: string): string | null {
  return parseDay(value);
}

/** What an act answers: its result, or the refusal with its code. Outside mock data nothing is configured. */
function act<T>(run: () => LoadOutcome<T>): Promise<LoadOutcome<T>> {
  return Promise.resolve(usesMockData() ? run() : NOT_CONFIGURED);
}

/** SCR-VER-17 Acting for: the appointment the phone sends with every act that names no inspection. */
export function chooseAppointment(sessionId: string, appointment: string): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => chooseActingFor(sessionId, appointment));
}

/** SCR-VER-01 Refresh keys (`GET /verification-keys`). */
export function refreshKeys(sessionId: string): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => refreshVerificationKeys(sessionId));
}

/** SCR-VER-01 Upload now (`POST /verifications/offline-results`), for one waiting result. */
export function uploadOfflineResult(sessionId: string, key: string): Promise<LoadOutcome<{ answer: string }>> {
  return act(() => uploadInBackend(sessionId, key));
}

/** SCR-VER-01 Discard, for one result that could not be uploaded: the phone deletes it. */
export function discardOfflineResult(sessionId: string, key: string): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => discardInBackend(sessionId, key));
}

/** What SCR-VER-01 sends to verify a typed reference. */
export interface VerificationRequest {
  value: string;
  identifierType: IdentifierType | null;
  /** The open inspection the screen was opened from; the answer attaches to it. */
  inspection: string | null;
}

/** SCR-VER-01 Verify (`POST /verifications`): a new answer, by its reference, which SCR-VER-02 opens. */
export function requestVerification(sessionId: string, request: VerificationRequest): Promise<LoadOutcome<{ answer: string }>> {
  return act(() => verify(sessionId, request));
}

/** SCR-VER-02 Inspect this premises: the premises and the answer carry into SCR-VER-03 (SC 3.3.7). */
export function inspectPremises(sessionId: string, reference: string): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => carryAnswerIntoInspection(sessionId, reference));
}

/** The fields of SCR-VER-03's form, as the inspector sent them. */
export interface InspectionOpening {
  /** False for Start without the answer: the answer carried in is not attached. */
  withAnswer: boolean;
  purpose: string;
  basis: string;
  /** The instant it took place, or null where the field could not be read. */
  observedAt: string | null;
  delayReason: string;
}

/** SCR-VER-03 Start (`POST /inspections`): a new inspection, which SCR-VER-04 opens. */
export function openInspection(sessionId: string, opening: InspectionOpening): Promise<LoadOutcome<{ inspection: string }>> {
  return act(() => openInBackend(sessionId, opening));
}

/**
 * SCR-VER-03 Continue the open inspection, and SCR-VER-04 Attach (`POST /inspections/{id}/verifications`).
 * From SCR-VER-03 the inspection opens whether or not the answer could be attached.
 */
export function attachAnswer(sessionId: string, inspection: string, reference: string): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => attachVerification(sessionId, inspection, reference));
}

/** SCR-VER-04 Add a finding (`POST /inspections/{id}/findings`). */
export function recordFinding(
  sessionId: string,
  inspection: string,
  finding: { kind: FindingKind | null; note: string },
): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => recordFindingInBackend(sessionId, inspection, finding));
}

/** SCR-VER-04 Abandon, opened in error (`POST /inspections/{id}/abandonments`). */
export function abandonInspection(sessionId: string, inspection: string, reason: string): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => abandonInBackend(sessionId, inspection, reason));
}

/** SCR-VER-05 Issue the record (`POST /inspections/{id}/conclusions`): record version 1, which SCR-VER-06 opens. */
export function issueInspectionRecord(
  sessionId: string,
  inspector: string,
  inspection: string,
  conclusion: Omit<ConclusionAttempt, "refusal">,
): Promise<LoadOutcome<{ record: string }>> {
  return act(() => concludeInBackend(sessionId, inspector, inspection, conclusion));
}

/** SCR-VER-06 Record handover (`POST /inspection-records/{ref}/deliveries`). */
export function recordHandover(
  sessionId: string,
  record: string,
  handover: { handedOverAt: string | null; recipient: RepresentativeRole | null },
): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => recordDelivery(sessionId, record, handover));
}

/** SCR-VER-07 Request the list (`POST /inspection-lists`): a new supply, which SCR-VER-08 opens. */
export function requestList(
  sessionId: string,
  request: { appointment: string | null; kind: ListKind; areas: readonly string[] },
): Promise<LoadOutcome<{ supply: string }>> {
  return act(() => requestInspectionList(sessionId, request));
}
