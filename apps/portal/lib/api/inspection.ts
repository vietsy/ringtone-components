import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import {
  abandonInspection as abandonInBackend,
  appointmentDecisionsOf,
  authorityWorkOf,
  closeInspection as closeInBackend,
  correctionOf,
  correctRecord as correctInBackend,
  decideAppointment as decideAppointmentInBackend,
  decideDesignation as decideDesignationInBackend,
  designationDecisionsOf,
  endAppointment as endAppointmentInBackend,
  endDesignation as endDesignationInBackend,
  inspectionAuthoritiesOf,
  inspectorAppointmentsOf,
  oversightOf,
  premisesRecordOf,
  premisesRecordsOf,
  reconsiderationOf,
  recordAppointment as recordAppointmentInBackend,
  recordDesignation as recordDesignationInBackend,
  reinstateAppointment as reinstateInBackend,
  requestReconsideration as requestReconsiderationInBackend,
  suspendAppointment as suspendInBackend,
  type PremisesActor,
  type Refused,
  type StaffActor,
  attachVerification,
  carryAnswerIntoInspection,
  checkOffline,
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
  scanCode as scanCodeInBackend,
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
import type { Principal, Staff } from "./session";
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
  | "DEVICE_TIME_IN_FUTURE"
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
  | "LOCATION_CONTEXT_NOT_PERMITTED"
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
  | "SUPPLY_NOT_READY"
  // The operations console's (SCR-VER-09 to 12)
  | "APPOINTMENT_EXISTS"
  | "APPOINTMENT_NOT_ACTIVE"
  | "APPOINTMENT_NOT_FOUND"
  | "APPOINTMENT_NOT_SUSPENDED"
  | "AREA_NOT_IN_GEOGRAPHY"
  | "AUTHORITY_CODE_EXISTS"
  | "AUTHORITY_NOT_FOUND"
  | "DESIGNATION_NOT_ACTIVE"
  | "END_DATE_EXTENDS_PERIOD"
  | "END_DATE_IN_PAST"
  | "GEOGRAPHY_READ_UNAVAILABLE"
  | "NOT_PENDING_APPROVAL"
  | "PERSON_NOT_FOUND"
  | "SEGREGATION_REQUIRED"
  // The premises' records and their reconsideration (SCR-VER-13, 14), and a correction (SCR-VER-15, 18)
  | "CASE_NOT_DECIDED"
  | "CASE_NOT_FOR_RECORD"
  | "CASE_STATE_UNAVAILABLE"
  | "CHALLENGE_ALREADY_OPEN"
  | "CORRECTION_ALREADY_RECORDED"
  | "CORRECTION_NOT_REQUIRED"
  | "GROUNDS_MISSING"
  | "INSPECTOR_STILL_APPOINTED"
  | "NOT_AUTHORISED_FOR_PREMISES"
  | "NOT_PARTY_TO_SUBJECT"
  | "PREMISES_REQUIRED"
  | "SUBJECT_NOT_FOUND"
  | "SUBJECT_SUPERSEDED";

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
/**
 * A status record's state as the inspector route says it (design/03 section 5b): IN_FORCE is CER's ACTIVE inside its
 * period, NOT_YET_IN_FORCE an ACTIVE record whose first period has not begun; the rest are CER's own states.
 */
export type RecordState =
  | "IN_FORCE"
  | "NOT_YET_IN_FORCE"
  | "EXPIRING"
  | "REINSTATED"
  | "SUSPENDED"
  | "EXPIRED"
  | "REVOKED"
  | "CANCELLED"
  | "REPLACED";
/** The states in which a record is current: the only ones a compliant outcome rests on (DR-741 row 1). */
export const CURRENT_STATES: readonly RecordState[] = ["IN_FORCE", "EXPIRING", "REINSTATED"];
/** Where an inspection is said to have taken place (CFG-772): the premises' register address, never a device location. */
export type LocationContext = "REGISTER_ADDRESS" | "SCANNED_AT_PREMISES" | "DEVICE_LOCATION";
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
  /** The key the phone generated when it checked the code: the upload's idempotency key, and the result's address. */
  id: string;
  representation: string;
  /**
   * LIMITED_OFFLINE: authentic, current state unknown. NOT_AUTHENTICATED: the signature does not verify under the
   * keys held. UNABLE_TO_VERIFY: no key held for it, or keys too old.
   */
  outcome: "LIMITED_OFFLINE" | "NOT_AUTHENTICATED" | "UNABLE_TO_VERIFY";
  checkedAt: string;
  /** The answer its last upload got that left it waiting (a read RightOne could not make). */
  refusal: RefusalCode | null;
}

/**
 * RightOne's own answer to a result the phone uploaded in the last 7 days: the state an online read gave (the seed's
 * two), or the outcome RightOne computed from the signed code (`ALG-711` on the server).
 */
export interface UploadedResult {
  answer: string;
  state: "IN_FORCE" | "REVOKED" | "LIMITED_OFFLINE" | "NOT_AUTHENTICATED" | "NO_RECORD";
  /** RightOne's answer is not what the phone said offline. */
  differsFromDevice: boolean;
  checkedAt: string;
  /** The refusal the answer gave when the inspector opened it. */
  refusal: RefusalCode | null;
  /** Checked from an inspection and refused there: stored, not attached to it, for this reason. */
  notAttached: RefusalCode | null;
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
  /** The printout reference the stand-in camera was pointed at, and whether it found no code there. */
  scan: { printout: string; noCode: boolean };
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
      state: RecordState;
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
  | { kind: "NO_CURRENT_RECORD_FOR_PREMISES"; premises: PremisesName; lastState: RecordState | null }
  | { kind: "AMBIGUOUS"; count: number }
  /** The signature does not verify under the key it names, or the key was not valid when the code was issued. */
  | { kind: "NOT_AUTHENTICATED"; reason: "SIGNATURE_NOT_VERIFIED" | "KEY_NOT_VALID_AT_ISSUE" }
  /**
   * Checked without a network, on the phone or by RightOne from the code uploaded: the code is authentic, and its
   * state is the one printed. `keyRetiredAt` says the key that signed it was retired after the code was issued.
   */
  | {
      kind: "LIMITED_OFFLINE";
      record: string;
      premises: PremisesName;
      printedState: RecordState;
      period: Period;
      printedAt: string;
      keysRefreshedAt: string;
      keyId: string;
      keyRetiredAt: string | null;
    };

export interface VerificationAnswer {
  device: FieldDevice;
  /** The answer reference; null for a result not yet uploaded. */
  reference: string | null;
  /** The identifier presented, as stored with the answer (FR-VER-025); null for an answer of the seed. */
  identifier: { type: IdentifierType; value: string } | null;
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
  /** The record was in another state that is not current when the answer was given (revoked, expired, ...). */
  | { kind: "NOT_CURRENT"; state: RecordState }
  /** Uploaded from a check without a network: authentic, with the state printed and what was not checked. */
  | { kind: "OFFLINE"; printedAt: string; printedState: RecordState }
  /** The code's signature did not verify: no fact of the code is evidence. */
  | { kind: "NOT_AUTHENTICATED" }
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

/**
 * An answer a record cites, as the record carries it (`ALG-715` step 3, `verified`): an online answer with the state
 * it read and when, or an offline one with its limits - the state printed at the code's issue, that issue instant and
 * when the phone's keys were refreshed; the current state and any revocation after issue were not checked.
 */
export type VerifiedAnswer =
  | { answer: string; channel: "ONLINE"; state: RecordState; readAt: string }
  | { answer: string; channel: "OFFLINE_UPLOAD"; printedState: RecordState; printedAt: string; keysRefreshedAt: string };

/** How a record version reached the inspected party (SM-705), by which route and when. */
export interface RecordDelivery {
  state: "PENDING" | "HANDED_OVER" | "NOTICE_DELIVERED" | "UNDELIVERED";
  route: "ON_SITE" | "NOTICE" | null;
  handedOverAt: string | null;
  /** When the notice reached the party, as COM reported it. */
  deliveredAt: string | null;
  dueBy: string;
  /** When the period passed with neither route; kept after a late delivery (FR-VER-035). */
  undeliveredAt: string | null;
  /** The notice COM raised to the party at issue, and when; null while none is raised. */
  notice: { reference: string; raisedAt: string } | null;
}

export interface InspectionRecord {
  device: FieldDevice;
  reference: string;
  version: number;
  premises: PremisesName;
  /** The issuing authority's code and name. */
  authority: string;
  issuedAt: string;
  outcome: Outcome;
  /**
   * Whether the premises asked to reconsider the record, and the case it opened; UNKNOWN when it cannot be told just
   * now. The case is null for an inspector of another authority, who is told the record is under challenge and
   * nothing of the case (FR-VER-027).
   */
  reconsideration: "NONE" | "UNKNOWN" | { case: string | null };
  /** The tail of the record's digest. */
  digest: string;
  /** The version in force after a correction. */
  versionInForce: boolean;
  /** Set when the version read is an earlier one: when a correction superseded it. */
  supersededAt: string | null;
  /** The versions a correction superseded, each readable on request (`version`). */
  earlier: readonly { version: number; supersededAt: string }[];
  /**
   * The whole record, for the issuing authority only. Another authority's inspector reads the confirmation:
   * no person, no finding, no representative.
   */
  whole: {
    inspector: { name: string; card: string };
    inspectedAt: string;
    /** What the inspection was opened for and under; null where a record of the seed does not say. */
    purpose: Purpose | null;
    basis: string | null;
    /** Where the record says the inspection took place: the register address, the one context CFG-772 permits. */
    locationContext: LocationContext;
    /** The answers the record cites, each with its own limits (FR-VER-037). */
    verified: readonly VerifiedAnswer[];
    /** The state CER answered for the premises' record when the inspection took place; null where not read. */
    recordStateAtObservation: RecordState | null;
    /** The case CAS opened for the referral's follow-up. */
    referralCase: string | null;
    findings: readonly Finding[];
    /** The role is null where nobody was present; the whole is null where the record does not say (a seed record). */
    representative: { role: RepresentativeRole | null; acknowledgement: Acknowledgement } | null;
    followUp: FollowUpKind;
    followUpBy: string | null;
    /** The guidance given, the referral's route and note, and what the representative said, as issued (FR-VER-007). */
    guidance: string | null;
    referral: { route: ReferralRoute; note: string } | null;
    statement: string | null;
    /** Why the inspection was recorded after CFG-773's interval, where it was (FR-VER-038). */
    delayReason: string | null;
    /** The case under which this version corrected the earlier one. */
    correctedUnderCase: string | null;
    delivery: RecordDelivery;
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

// ------------------------------------------------------------------ SCR-VER-09 to 12 The operations console

/** A designation's or an appointment's standing (SM-700, SM-701), in the words of section 5c. */
export type Standing = "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | "REFUSED" | "ENDED";
export type AuthorityLevel = "CENTRAL" | "PROVINCIAL" | "COMMUNE";
export const AUTHORITY_LEVELS: readonly AuthorityLevel[] = ["CENTRAL", "PROVINCIAL", "COMMUNE"];

/** Who recorded, suspended or decided something: the staff member's name, and the address segregation compares. */
export interface StaffStamp {
  name: string;
  email: string;
  at: string;
}

export interface DesignationRow {
  id: string;
  code: string;
  name: string;
  level: AuthorityLevel;
  areas: readonly string[];
  /** The geography version's words ("Địa giới từ 1 tháng 7, 2025"). */
  geography: string;
  from: string;
  to: string | null;
  state: Standing;
  /** An end date recorded on a designation in force: it ends after this day. */
  endsAfter: string | null;
  recordedBy: StaffStamp | null;
}

/** SCR-VER-09: the designations, in force first then by code, and what the form offers. */
export interface InspectionAuthorities {
  asOf: string;
  designations: readonly DesignationRow[];
  geographies: readonly { id: string; label: string }[];
  /** The reader holds ACT-OPS: the form and the row acts are theirs. */
  mayAct: boolean;
}

/** A designation opened for a decision (SCR-VER-10). */
export interface DesignationDetail extends DesignationRow {
  legalBasis: string | null;
  document: { name: string; size: string; at: string; by: string } | null;
  predecessor: { code: string; name: string } | null;
}

/** Why the reader may not decide what is opened: DR-746 rows 1 and 2, in the board's order. */
export type DecisionBar = "SEGREGATION_REQUIRED" | "NOT_AUTHORISED" | null;

export interface DesignationDecisions {
  asOf: string;
  waiting: readonly { id: string; code: string; name: string; from: string; recordedBy: StaffStamp | null }[];
  /** The appointments waiting, for the other tab's count. */
  appointmentsWaiting: number;
  opened: { designation: DesignationDetail; bar: DecisionBar } | null;
  /** In place of the form: the designation named is not found or no longer waits. */
  openedRefusal: RefusalCode | null;
  /** The decision just recorded, said above the list. */
  decided: { code: string; state: "ACTIVE" | "REFUSED"; at: string } | null;
}

export interface AppointmentRow {
  id: string;
  person: string;
  name: string;
  card: string | null;
  instrument: string | null;
  from: string;
  to: string | null;
  state: Standing;
  /** The suspension's instant, for a suspended appointment. */
  suspendedAt: string | null;
  /** An end date recorded on an appointment in force or suspended. */
  endsAfter: string | null;
}

/** SCR-VER-11: one authority's appointments, in force first then by name, and the form's authorities. */
export interface InspectorAppointments {
  asOf: string;
  authority: { id: string; code: string; name: string; state: Standing };
  /** The designations in force, which the form may appoint under. */
  authorities: readonly { id: string; code: string; name: string }[];
  appointments: readonly AppointmentRow[];
  mayAct: boolean;
}

export interface AppointmentWaiting {
  id: string;
  name: string;
  card: string | null;
  authorityCode: string;
  from: string;
  recordedBy: StaffStamp | null;
}

export interface SuspendedAppointment {
  id: string;
  name: string;
  card: string | null;
  authorityCode: string;
  suspendedAt: string;
  suspendedBy: string;
  reason: string;
  /** Why the reader may not reinstate it. */
  bar: DecisionBar;
}

export interface AppointmentDecisions {
  asOf: string;
  waiting: readonly AppointmentWaiting[];
  designationsWaiting: number;
  opened: {
    appointment: AppointmentWaiting & { authority: string; person: string; instrument: string | null; to: string | null };
    bar: DecisionBar;
  } | null;
  openedRefusal: RefusalCode | null;
  suspended: readonly SuspendedAppointment[];
  decided: { name: string; act: "APPROVE" | "REFUSE" | "REINSTATE"; at: string } | null;
}

// ------------------------------------------------------------------ SCR-VER-13, 14 The premises' records

/** A record as the premises and the authority read it, whole (FR-VER-012, 027). */
export interface RecordDetail {
  reference: string;
  version: number;
  premises: { key: string; name: string };
  inspectedAt: string;
  issuedAt: string;
  authority: string;
  authorityCode: string;
  inspector: { name: string; card: string };
  findings: readonly Finding[];
  outcome: Outcome;
  guidance: string | null;
  /** The referral's route and note, what the representative said, and why it was recorded late, as issued. */
  referral: { route: ReferralRoute; note: string } | null;
  statement: string | null;
  delayReason: string | null;
  followUp: FollowUpKind;
  followUpBy: string | null;
  /**
   * The case of an unsettled request to reconsider this version; null in its place for an inspector of another
   * authority, who reads that the record is under challenge and nothing of the case (FR-VER-027).
   */
  challenge: { case: string | null } | null;
  correctedUnderCase: string | null;
  /** The answers the record cites, each with its own limits (FR-VER-037). */
  verified: readonly VerifiedAnswer[];
  delivery: RecordDelivery;
  /** Earlier versions, still readable, each marked superseded (FR-VER-033). */
  superseded: readonly { version: number; issuedAt: string; supersededAt: string; outcome: Outcome }[];
}

export interface PremisesInspectionRecords {
  asOf: string;
  premises: { id: string; name: string };
  /** The premises the person acts for, by the portal's id. */
  options: readonly { id: string; name: string }[];
  records: readonly RecordDetail[];
  opened: RecordDetail | null;
  openedRefusal: RefusalCode | null;
}

/** What a request to reconsider is about, as it was shown (SCR-VER-14). */
export type ReconsiderationSubject =
  | {
      kind: "INSPECTION_RECORD";
      record: RecordDetail;
      /** The version in force, when the one named was superseded. */
      versionInForce: number;
    }
  | {
      kind: "ANSWER";
      reference: string;
      premises: { id: string; name: string } | null;
      outcome: AnswerOutcome;
      scope: string | null;
      shownAt: string;
    };

export interface Reconsideration {
  subject: ReconsiderationSubject | null;
  /** In place of the subject: no answer or record has the reference. */
  subjectRefusal: RefusalCode | null;
  typed: string;
  premisesOptions: readonly { id: string; name: string }[];
  /** The request just received, with its case. */
  sent: { case: string } | null;
}

export interface ReconsiderationAttempt {
  subject: string;
  premises: string | null;
  grounds: string;
  refusal: RefusalCode | null;
  /** The case CHALLENGE_ALREADY_OPEN names, or the version in force SUBJECT_SUPERSEDED names. */
  detail: string | null;
}

// ------------------------------------------------------------------ SCR-VER-18, 15 The authority's work and a correction

export type WorkFlag = "INSPECTOR_CANNOT_ACT" | "UNDELIVERED" | "CORRECTION_DUE" | "OPEN_BEYOND_INTERVAL" | "FOLLOW_UP_OVERDUE";
export const WORK_FLAGS: readonly WorkFlag[] = ["INSPECTOR_CANNOT_ACT", "UNDELIVERED", "CORRECTION_DUE", "OPEN_BEYOND_INTERVAL", "FOLLOW_UP_OVERDUE"];

export interface WorkRow {
  /** An IRC- record or, for an open inspection, its ISP- reference. */
  reference: string;
  kind: "RECORD" | "INSPECTION";
  authorityCode: string;
  premises: string;
  flag: WorkFlag;
  /** When the flag began: the age is said from it. */
  since: string;
  /** What the flag's sentence names: the date due, the case, who opened it and when their appointment ended. */
  detail: { date: string | null; case: string | null; person: string | null };
}

export interface AuthorityWork {
  asOf: string;
  /** DR-740 rows 1 to 3 when no appointment of the person passes them. */
  refusal: RefusalCode | null;
  flag: WorkFlag | null;
  /** One page of the rows, oldest flag first. */
  rows: readonly WorkRow[];
  /** The cursor of the page after this one; null on the last page. */
  nextCursor: string | null;
  /** The cursor this page was read from; null for the first page. */
  cursor: string | null;
  /** The page asked for could not be read (CURSOR_INVALID): the rows are the first page again, with the filter kept. */
  rowsRefusal: RefusalCode | null;
  /** The record opened by reference: whole for the issuing authority, the confirmation for another. */
  opened: { record: RecordDetail; whole: boolean; correctionCase: string | null } | null;
  openedRef: string;
  openedRefusal: RefusalCode | null;
  /** The inspection just closed, said once. */
  closed: { reference: string; premises: string } | null;
  /** The closure dialog to open again with its refusal. */
  closing: { inspection: string; premises: string; openedBy: string; reason: string; refusal: RefusalCode } | null;
}

export interface CorrectionDraft {
  caseRef: string;
  outcome: Outcome | null;
  findings: readonly { kind: FindingKind | null; note: string }[];
  guidance: string;
  route: ReferralRoute;
  referralNote: string;
  followUp: FollowUpKind;
  followUpBy: string;
  reason: string;
}

export interface RecordCorrection {
  record: RecordDetail;
  /** What CAS answers for the case named, in the page's words. */
  caseLine: "DECIDED_CORRECTION" | "NOT_DECIDED" | "NOT_FOR_RECORD" | "NO_CORRECTION" | "ALREADY_RECORDED" | "NONE";
  /** In the page header, with Issue unavailable: DR-740 rows 1 to 3, NOT_ISSUING_AUTHORITY and DR-747 rows 1 to 5. */
  refusal: RefusalCode | null;
  /** The version that already names the case (CORRECTION_ALREADY_RECORDED). */
  already: { version: number; issuedAt: string } | null;
  draft: CorrectionDraft;
  /** The refusal the last send got, where the board draws it beside a field. */
  fieldRefusal: { field: "outcome" | "findings" | "guidance" | "referralNote" | "followUp" | "reason" | "case"; code: RefusalCode } | null;
}

export interface CorrectionAttempt {
  draft: CorrectionDraft;
  refusal: RefusalCode | null;
}

// ------------------------------------------------------------------ SCR-VER-16 Oversight

export interface OversightCountsRow {
  authorityCode: string;
  open: number;
  concluded: number;
  abandoned: number;
  compliant: number;
  nothingFound: number;
  guidance: number;
  referred: number;
  undelivered: number;
}

export interface OversightSupply {
  reference: string;
  authorityCode: string;
  kind: ListKind;
  state: SupplyState;
  generatedAt: string | null;
  listed: number | null;
  /** Who requested it: to ACT-AUD only; ACT-REG receives no person. */
  requester: string | null;
}

export interface InspectionOversight {
  asOf: string;
  /** The month read, "2026-09". */
  period: string;
  periods: readonly string[];
  authority: string | null;
  authorities: readonly { id: string; code: string; name: string }[];
  supplies: readonly OversightSupply[];
  counts: readonly OversightCountsRow[];
  /** The reader holds ACT-AUD and reads who requested a supply. */
  requesterShown: boolean;
  opened: {
    supply: OversightSupply;
    authority: string;
    areas: readonly string[];
    register: RegisterRead | null;
    byArea: readonly { area: string; listed: number }[];
  } | null;
  openedRefusal: RefusalCode | null;
}

// ------------------------------------------------------------------ what a refused form hands back to its page

/** SCR-VER-01: the inspection it verifies for, what was typed, and the refusal the verification got. */
export interface ScanAttempt {
  inspection: string | null;
  typed: string;
  refusal: RefusalCode | null;
  /** The printout the stand-in camera was pointed at, and whether it found no code there. */
  scan?: { printout: string; noCode: boolean };
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

/** SCR-VER-09: the designation form as it was sent. */
export interface DesignationForm {
  code: string;
  name: string;
  level: AuthorityLevel | null;
  legalBasis: string;
  document: { name: string; size: string } | null;
  geography: string;
  areas: string;
  from: string;
  to: string;
  predecessor: string;
}

/** SCR-VER-11: the appointment form as it was sent. */
export interface AppointmentForm {
  authority: string;
  person: string;
  name: string;
  card: string;
  instrument: string;
  document: { name: string; size: string } | null;
  from: string;
  to: string;
}

/** A refused form of the operations console: what was sent, the refusal, and the area it names. */
export interface FormAttempt<F> {
  form: F;
  /** Null for a form sent without a field it requires: it comes back as sent, with nothing recorded. */
  refusal: RefusalCode | null;
  /** AREA_NOT_IN_GEOGRAPHY names the area; END_DATE_EXTENDS_PERIOD the approved end. */
  detail: string | null;
}

/** A refused act on a row (End, Withdraw, Suspend, Reinstate, a decision, Close): the row, what was typed, the refusal. */
export interface RowAttempt {
  id: string;
  act: "end" | "suspend" | "reinstate" | "decide" | "close";
  effectiveTo: string;
  reason: string;
  decision: "APPROVE" | "REFUSE" | null;
  refusal: RefusalCode;
  detail: string | null;
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
  version: number | null = null,
): Promise<LoadOutcome<InspectionRecord>> {
  return answer(
    () => mockInspectionRecord(record, view ?? "pending", reader ?? "issuing", locale),
    () => inspectionRecordOf(sessionId, record, locale, attempt, version),
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

/** SCR-VER-01 Refresh keys (`GET /verification-keys`): the key set the phone now holds, and when it was served. */
export function refreshKeys(sessionId: string): Promise<LoadOutcome<{ servedAt: string; keys: readonly string[] }>> {
  return act(() => refreshVerificationKeys(sessionId));
}

/**
 * SCR-VER-01 Scan: the code on the printout in front of the camera. The web stand-in has no camera; it reads the code
 * CER printed on the printout whose reference is typed.
 */
export function scanCode(sessionId: string, printout: string): Promise<LoadOutcome<ScannedCode>> {
  return act(() => scanCodeInBackend(sessionId, printout));
}

/** SCR-VER-01 Check offline (`ALG-711` on the phone): the result waits to upload, and SCR-VER-02 reads it by its key. */
export function checkCodeOffline(
  sessionId: string,
  request: { printout: string; code: ScannedCode; inspection: string | null },
): Promise<LoadOutcome<{ result: string }>> {
  return act(() => checkOffline(sessionId, request));
}

/** SCR-VER-01 Upload now (`POST /verifications/offline-results`), for one waiting result. */
export function uploadOfflineResult(sessionId: string, key: string): Promise<LoadOutcome<{ answer: string }>> {
  return act(() => uploadInBackend(sessionId, key));
}

/** SCR-VER-01 Discard, for one result that could not be uploaded: the phone deletes it. */
export function discardOfflineResult(sessionId: string, key: string): Promise<LoadOutcome<{ accepted: true }>> {
  return act(() => discardInBackend(sessionId, key));
}

/**
 * The code a camera reads from a printout (`v1`): the base64url payload, its signature and the key it names. The web
 * stand-in has no camera; it reads the code CER printed on the printout whose reference is typed (`scanCode`).
 */
export interface ScannedCode {
  payload: string;
  signature: string;
  keyId: string;
}

/** What SCR-VER-01 sends to verify a typed reference, or a scanned code with the printout reference it carries. */
export interface VerificationRequest {
  value: string;
  identifierType: IdentifierType | null;
  /** The open inspection the screen was opened from; the answer attaches to it. */
  inspection: string | null;
  /** The code scanned; null for a reference typed. */
  code: ScannedCode | null;
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
  /** Where the inspection is said to have taken place; the field client sends the register address (CFG-772). */
  locationContext: string;
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

// ------------------------------------------------------------------ the operations, premises and oversight screens

/** What an act of these screens answers: its result, or its refusal with what the sentence names (an area, a case). */
export type ActAnswer<T> = Refused<T>;

const asStaff = (staff: Staff): StaffActor => ({ name: staff.account, email: staff.email, roles: staff.roles });
const asPrincipal = (principal: Principal): PremisesActor => ({ party: principal.organisation, name: principal.account });

function read<T>(live: () => LoadOutcome<T>): Promise<LoadOutcome<T>> {
  return Promise.resolve(usesMockData() ? live() : NOT_CONFIGURED);
}

function command<T>(run: () => ActAnswer<T>): Promise<ActAnswer<T>> {
  return Promise.resolve(usesMockData() ? run() : NOT_CONFIGURED);
}

/** SCR-VER-09 reads the designations (`GET /inspection-authorities`). */
export function loadInspectionAuthorities(staff: Staff, locale: Locale): Promise<LoadOutcome<InspectionAuthorities>> {
  return read(() => inspectionAuthoritiesOf(staff.sessionId, asStaff(staff), locale));
}

/** SCR-VER-09 Record for approval (`POST /inspection-authorities`). */
export function recordDesignation(staff: Staff, form: DesignationForm): Promise<ActAnswer<{ designation: string }>> {
  return command(() => recordDesignationInBackend(staff.sessionId, asStaff(staff), form));
}

/** SCR-VER-09 End, or Withdraw a pending one (`POST /inspection-authorities/{id}/endings`). */
export function endDesignation(staff: Staff, id: string, effectiveTo: string, reason: string): Promise<ActAnswer<{ accepted: true }>> {
  return command(() => endDesignationInBackend(staff.sessionId, asStaff(staff), id, effectiveTo, reason));
}

/** SCR-VER-10 reads the designations waiting, the one opened and the decision just recorded. */
export function loadDesignationDecisions(
  staff: Staff,
  opened: string | null,
  decided: string | null,
  locale: Locale,
): Promise<LoadOutcome<DesignationDecisions>> {
  return read(() => designationDecisionsOf(staff.sessionId, asStaff(staff), opened, decided, locale));
}

/** SCR-VER-10 Record the decision (`POST /inspection-authorities/{id}/decisions`). */
export function decideDesignation(staff: Staff, id: string, decision: "APPROVE" | "REFUSE" | null, reason: string): Promise<ActAnswer<{ accepted: true }>> {
  return command(() => decideDesignationInBackend(staff.sessionId, asStaff(staff), id, decision, reason));
}

/** SCR-VER-11 reads one authority's appointments (`GET /inspection-appointments?authority_id=`). */
export function loadInspectorAppointments(staff: Staff, authority: string | null): Promise<LoadOutcome<InspectorAppointments>> {
  return read(() => inspectorAppointmentsOf(staff.sessionId, asStaff(staff), authority));
}

/** SCR-VER-11 Record for approval (`POST /inspection-appointments`). */
export function recordAppointment(staff: Staff, form: AppointmentForm): Promise<ActAnswer<{ appointment: string }>> {
  return command(() => recordAppointmentInBackend(staff.sessionId, asStaff(staff), form));
}

/** SCR-VER-11 Suspend (`POST /inspection-appointments/{id}/suspensions`). */
export function suspendAppointment(staff: Staff, id: string, reason: string): Promise<ActAnswer<{ accepted: true }>> {
  return command(() => suspendInBackend(staff.sessionId, asStaff(staff), id, reason));
}

/** SCR-VER-11 End, or withdraw a pending one (`POST /inspection-appointments/{id}/endings`). */
export function endAppointment(staff: Staff, id: string, effectiveTo: string, reason: string): Promise<ActAnswer<{ accepted: true }>> {
  return command(() => endAppointmentInBackend(staff.sessionId, asStaff(staff), id, effectiveTo, reason));
}

/** SCR-VER-12 reads the appointments waiting, the one opened, the suspended, and the decision just recorded. */
export function loadAppointmentDecisions(
  staff: Staff,
  opened: string | null,
  decided: string | null,
  locale: Locale,
): Promise<LoadOutcome<AppointmentDecisions>> {
  return read(() => appointmentDecisionsOf(staff.sessionId, asStaff(staff), opened, decided, locale));
}

/** SCR-VER-12 Record the decision (`POST /inspection-appointments/{id}/decisions`). */
export function decideAppointment(staff: Staff, id: string, decision: "APPROVE" | "REFUSE" | null, reason: string): Promise<ActAnswer<{ accepted: true }>> {
  return command(() => decideAppointmentInBackend(staff.sessionId, asStaff(staff), id, decision, reason));
}

/** SCR-VER-12 Reinstate (`POST /inspection-appointments/{id}/reinstatements`). */
export function reinstateAppointment(staff: Staff, id: string): Promise<ActAnswer<{ accepted: true }>> {
  return command(() => reinstateInBackend(staff.sessionId, asStaff(staff), id));
}

/** SCR-VER-13 reads a premises' records and the one opened (`GET /premises/{id}/inspection-records`, `GET /inspection-records/{ref}`). */
export function loadPremisesInspectionRecords(
  principal: Principal,
  premises: string | null,
  record: string | null,
  locale: Locale,
): Promise<LoadOutcome<PremisesInspectionRecords>> {
  return read(() => premisesRecordsOf(principal.sessionId, asPrincipal(principal), premises, record, locale));
}

/** SCR-VER-13 Download PDF reads one record version of the premises, with its digest, for its printout. */
export function loadPremisesRecord(principal: Principal, record: string, locale: Locale): Promise<LoadOutcome<RecordDetail & { digest: string }>> {
  return read(() => premisesRecordOf(principal.sessionId, asPrincipal(principal), record, locale));
}

/** SCR-VER-14 reads what the request is about, as it was shown, and the case once sent. */
export function loadReconsideration(
  principal: Principal,
  subject: string | null,
  sent: string | null,
  locale: Locale,
): Promise<LoadOutcome<Reconsideration>> {
  return read(() => reconsiderationOf(principal.sessionId, asPrincipal(principal), subject, sent, locale));
}

/** SCR-VER-14 Send the request (`POST /verification-challenges`): the case CAS opened. */
export function requestReconsideration(
  principal: Principal,
  request: { subject: string; versionNo: number | null; premises: string | null; grounds: string },
): Promise<ActAnswer<{ case: string }>> {
  return command(() => requestReconsiderationInBackend(principal.sessionId, asPrincipal(principal), request));
}

/** SCR-VER-18 reads the authority's inspections and records needing attention, and a record opened by reference. */
export function loadAuthorityWork(
  sessionId: string,
  flag: WorkFlag | null,
  record: string | null,
  closed: string | null,
  closing: RowAttempt | null,
  locale: Locale,
  cursor: string | null = null,
): Promise<LoadOutcome<AuthorityWork>> {
  return read(() => authorityWorkOf(sessionId, flag, record, closed, closing, locale, cursor));
}

/** SCR-VER-18 Close the inspection (`POST /inspections/{id}/abandonments`, INSPECTOR_NO_LONGER_APPOINTED). */
export function closeInspection(sessionId: string, inspection: string, reason: string): Promise<ActAnswer<{ accepted: true }>> {
  return command(() => closeInBackend(sessionId, inspection, reason));
}

/** SCR-VER-15 reads the version in force, what CAS answers for the case, and the correction as the form holds it. */
export function loadRecordCorrection(
  sessionId: string,
  record: string,
  caseRef: string | null,
  attempt: CorrectionAttempt | null,
  locale: Locale,
): Promise<LoadOutcome<RecordCorrection>> {
  return read(() => correctionOf(sessionId, record, caseRef, attempt, locale));
}

/** SCR-VER-15 Issue version n+1 (`POST /inspection-records/{ref}/corrections`). */
export function correctRecord(sessionId: string, inspector: string, record: string, draft: CorrectionDraft): Promise<ActAnswer<{ record: string; version: number }>> {
  return command(() => correctInBackend(sessionId, inspector, record, draft));
}

/** SCR-VER-16 reads a month's supplies and inspection counts, and one supply's header. */
export function loadInspectionOversight(
  staff: Staff,
  period: string | null,
  authority: string | null,
  supply: string | null,
): Promise<LoadOutcome<InspectionOversight>> {
  return read(() => oversightOf(staff.sessionId, asStaff(staff), period, authority, supply));
}
