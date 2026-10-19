import { createHash, createPublicKey, randomUUID, verify as verifySignature } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type { RecordStatus } from "@/lib/api/status-records";
import {
  CURRENT_STATES,
  FINDING_KINDS,
  LIST_KINDS,
  PURPOSES,
  resultKey,
  type Acknowledgement,
  type AnswerOutcome,
  type Appointment,
  type AppointmentDecisions,
  type AppointmentForm,
  type AppointmentRow,
  type AppointmentWaiting,
  type AttachedAnswerResult,
  type AuthorityWork,
  type Conclusion,
  type ConclusionAttempt,
  type ConclusionDraft,
  type CorrectionAttempt,
  type CorrectionDraft,
  type DecisionBar,
  type DesignationDecisions,
  type DesignationDetail,
  type DesignationForm,
  type DesignationRow,
  type FailedResult,
  type FieldDevice,
  type FieldHome,
  type Finding,
  type FindingKind,
  type FollowUpKind,
  type HandoverAttempt,
  type IdentifierType,
  type InspectionAttempt,
  type InspectionAuthorities,
  type InspectionInProgress,
  type InspectionLists,
  type InspectionOpening,
  type InspectionOversight,
  type InspectionRecord,
  type InspectionStart,
  type InspectorAppointments,
  type ListAttempt,
  type ListKind,
  type ListSupply,
  type LocationContext,
  type Outcome,
  type OversightCountsRow,
  type OversightSupply,
  type PremisesInspectionRecords,
  type PremisesName,
  type Purpose,
  type Reconsideration,
  type RecordCorrection,
  type RecordDetail,
  type RecordDelivery,
  type RecordState,
  type ReferralRoute,
  type RefusalCode,
  type RegisterRead,
  type RepresentativeRole,
  type RowAttempt,
  type ScanAndVerify,
  type ScanAttempt,
  type ScannedCode,
  type StaffStamp,
  type Standing,
  type StartAttempt,
  type SupplyCounts,
  type SupplyEntry,
  type SupplyState,
  type UploadedResult,
  type VerificationAnswer,
  type VerificationRequest,
  type VerifiedAnswer,
  type WaitingResult,
  type WorkFlag,
  type WorkRow,
} from "@/lib/api/inspection";
import type { Locale } from "@/lib/i18n/translate";
import {
  CANVAS_ANSWERS,
  CANVAS_APPOINTMENTS,
  CANVAS_AUTHORITY_RECORDS,
  CANVAS_CHALLENGES,
  CANVAS_DESIGNATIONS,
  CANVAS_DEVICE,
  CANVAS_INSPECTIONS,
  CANVAS_ORPHANED_INSPECTIONS,
  CANVAS_OTHER_SUPPLIES,
  CANVAS_PERSONS,
  CANVAS_PREMISES,
  CANVAS_PUBLIC_ANSWERS,
  CANVAS_RECORDS,
  CANVAS_REGISTER,
  CANVAS_SUPPLIES,
  GEOGRAPHY_2025,
  INSPECTOR_CARD,
  INSPECTOR_PERSONS,
  OVERSIGHT_BASELINE,
  PREMISES_OF_PARTY,
  type CanvasConclusionDraft,
  type CanvasDocument,
  type CanvasPremises,
  type Localised,
  type OversightCounts,
} from "@/lib/mock/inspection";
import { MOCK_INSPECTOR } from "@/lib/mock/session";
import { accountBook } from "./accounts";
import { caseDecisionFor, openCase, openReconsideration } from "./cases";
import { addDays, now, today } from "./clock";
import { reference as newReference } from "./ids";
import { noticeStateOf, recordNoticeEvent } from "./notices";
import { actingAs, mayActFor } from "./parties";
import { premisesRelationshipAt } from "./premises";
import { publicVerificationAnswer } from "./public";
import { deadlineStateAt, openFactChangeReportsAt, premisesActedFor } from "./registration";
import { inspectorRecordAt, premisesRecordAt, signedCodeOf, verificationKeysAt, type InspectorRecordRead, type VerificationKey } from "./status-records";
import { sessions, table, type StaffRole } from "./store";

/**
 * VER's behaviour, played by the mock backend for one browser's world: the designations of the inspection
 * authorities and the appointments of their inspectors, the answers the inspector's verifications store, the
 * inspections opened from them with their findings, the records issued when they are concluded, their
 * handover and correction, the requests to reconsider a record and the cases they open, and the list supplies
 * the console requests. Commands are named after the API's operations (`srs/02-api-contracts.md`), check what
 * the API checks in the order it checks it, and refuse with the codes of `design/04-refusal-codes.md`.
 *
 * Behind VER the API reads other services: CER for the status records and the verification keys, PTY for the
 * premises register and the persons, CAS for a case, COM for a notice, GOV for the approval right. The mock reads CER's
 * live records and keys in the browser's world through `status-records.ts`'s exported reads (`inspectorRecordAt`,
 * `premisesRecordAt`, `verificationKeysAt`), so a record issued, suspended or revoked on the console answers the same
 * here as on the public route; the premises register is the canvas's (`CANVAS_PREMISES`), joined to CER's premises by
 * their register reference, with a premises only CER names taken as CER names it; the persons are the canvas's
 * (`CANVAS_PERSONS`), the premises a principal acts for registration's `premisesActedFor`, and the party that operated a
 * premises when a record or an answer was made PTY's `premisesRelationshipAt` at that instant (SEC-745). A request to reconsider
 * opens its case in CAS (`openReconsideration`), a referral for case follow-up through CAS's intake (`openCase`), and
 * DR-747 reads CAS's answer (`caseDecisionFor`): one case registry per world. An issued record is raised to the party
 * through COM (`recordNoticeEvent`), whose state the delivery reads (`noticeStateOf`).
 *
 * The phone's own store (the keys it was served, the results it checked offline, the authority chosen on the home
 * screen) is kept here too, per world, since the web stand-in for the field client has no store of its own. Its
 * offline check (`ALG-711`) verifies a code's signature against the keys it holds, and RightOne verifies the result
 * again against the keys CER publishes when it is uploaded.
 */

// ------------------------------------------------------------------ the rules' values (design/frd/13)

/** CFG-773: after 24 hours an inspection is recorded late and needs a reason; also the answer's window. */
const RECORDING_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** CFG-774: a record reaches the inspected party within 5 calendar days of its issue. */
const DELIVERY_DAYS = 5;
/** CFG-777: 10 supplies per inspector per calendar day, Vietnam time; a failed one does not count. */
const DAILY_LIST_LIMIT = 10;
/** CFG-778: the keys check codes offline for 7 days from their last refresh. */
const KEY_AGE_DAYS = 7;
/** A check instant the phone reports may run ahead of RightOne's clock by this much (srs/02, DEVICE_TIME_IN_FUTURE). */
const DEVICE_CLOCK_TOLERANCE_MS = 120_000;
/** CFG-776: a stored answer is kept 24 months, then disposed and no longer read. */
const ANSWER_RETENTION_MONTHS = 24;
/** CFG-772: the one location context an inspection may name. */
const PERMITTED_LOCATION = "REGISTER_ADDRESS" satisfies LocationContext;
/** The rows of SCR-VER-18 one page holds (GET /inspections, `page_size`). */
const WORK_PAGE_SIZE = 20;
/** The finding kinds that need a note (design/03 SCR-VER-04). */
const NOTE_REQUIRED_FOR: ReadonlySet<FindingKind> = new Set<FindingKind>(["OTHER", "RECORD_SCOPE_EXCEEDED", "EXTERNAL_LICENCE_PRESENTED"]);
/** The length limits of the reasons and grounds (design/03). */
const REASON_MAX = 1000;
const GROUNDS_MAX = 4000;

// ------------------------------------------------------------------ the table

/** Text the canvas wrote in the reader's language, or what a person typed. */
type Text = string | Localised;

interface StoredAnswer {
  reference: string;
  /** The appointment it was given under; null for an answer of the public verification page. */
  appointment: string | null;
  channel: "ONLINE" | "OFFLINE_UPLOAD" | "PUBLIC";
  answeredAt: string;
  /** The premises the answer is about, by its key in the register; null where it names none. */
  premises: string | null;
  outcome: AnswerOutcome;
  /** The inspection it was verified from, and whether it was attached there. */
  inspection: { reference: string; attached: boolean } | null;
  attachRefusal: RefusalCode | null;
  /** The scope of use the answer showed, where it showed one. */
  scope: Text | null;
  /** The identifier presented (`identifier_type`, `identifier_value`); null for an answer of the seed. */
  identifier: { type: IdentifierType; value: string } | null;
  /** The field set the answer was given in; null where it names no record. */
  fieldSet: "INSPECTOR" | "PUBLIC" | null;
  /** The verification policy version applied; null where none is approved and CFG-770's tested default applied. */
  policyVersion: string | null;
  /** For a code scanned: the key it named and whether it verified (`key_id`, `authentic`). */
  keyId: string | null;
  authentic: boolean | null;
  /** For a result uploaded from a check without a network (`offline_payload` ... `device_verdict`). */
  offline: {
    payload: string;
    issuedAt: string | null;
    deviceCheckedAt: string;
    deviceKeysRefreshedAt: string;
    deviceVerdict: WaitingResult["outcome"];
  } | null;
}

interface StoredInspection {
  reference: string;
  premises: string;
  appointment: string;
  purpose: Purpose | null;
  basis: string | null;
  /** The area it fell under and where it is said to have taken place (the register address, CFG-772). */
  areaKey: string | null;
  locationContext: LocationContext;
  observedAt: string;
  openedAt: string;
  delayReason: string | null;
  /** The canvas's own reading of the recording interval for an inspection of the seed; null: the rule decides. */
  seedLate: boolean | null;
  state: "OPEN" | "CONCLUDED" | "ABANDONED";
  attached: { answer: string; readAt: string }[];
  findings: { kind: FindingKind; note: Text | null; recordedAt: string }[];
  record: string | null;
  abandonment: { code: "OPENED_IN_ERROR" | "INSPECTOR_NO_LONGER_APPOINTED"; reason: string; at: string } | null;
  /** What SCR-VER-05 holds for an inspection of the seed, as the canvas draws it being entered. */
  draft: CanvasConclusionDraft | null;
}

interface StoredRecord {
  reference: string;
  version: number;
  premises: string;
  appointment: string;
  issuedAt: string;
  inspectedAt: string;
  /** What the inspection was opened for and under, and where it is said to have taken place (`ALG-715` step 3). */
  purpose: Purpose | null;
  basis: string | null;
  locationContext: LocationContext;
  inspector: { name: string; card: string };
  outcome: Outcome;
  /** The attached answer in force the record rests on. */
  answer: string | null;
  /** Every attached answer the record cites, with its limits (`verified`, FR-VER-037). */
  verified: VerifiedAnswer[];
  /** CER's state for the premises' record when the inspection took place, read for a compliant outcome. */
  recordStateAtObservation: RecordState | null;
  /** The case CAS opened for a referral or a follow-up by case (`referral_case_ref`). */
  referralCase: string | null;
  findings: { kind: FindingKind; note: Text | null }[];
  /** Null where a record of the seed does not say who represented the premises. */
  representativeRole: RepresentativeRole | null;
  acknowledgement: Acknowledgement | null;
  followUp: FollowUpKind;
  followUpBy: string | null;
  guidance: Text | null;
  referral: { route: ReferralRoute; note: string } | null;
  statement: string | null;
  delayReason: string | null;
  /** The case under which this version corrected the earlier one, and why. */
  correctedUnderCase: string | null;
  correctionReason: string | null;
  digest: string;
  /**
   * `raiseOwed`: a notice is still to be raised to the party (`DR-744` row 3); never for a record of the seed, issued
   * before the world began, whose notice the canvas does not draw. `raiseTriedAt`: when the last raise COM answered
   * with no notice was made, so the sweep tries again at its next hourly run, not at every read.
   */
  delivery: RecordDelivery & { recipient: RepresentativeRole | null; raiseOwed: boolean; raiseTriedAt: string | null };
}

/** A version a correction superseded: still readable (FR-VER-033). */
interface SupersededRecord extends StoredRecord {
  supersededAt: string;
}

interface StoredSupply {
  reference: string;
  kind: ListKind;
  state: SupplyState;
  appointment: string;
  /** Who requested it, as SCR-VER-16 names the requester to ACT-AUD. */
  requester: string;
  areas: readonly string[];
  requestedAt: string | null;
  generatedAt: string | null;
  failure: RefusalCode | null;
  /** The register as it was read at generation; its age is said from now. */
  register: Omit<RegisterRead, "reconciledDaysAgo"> | null;
  counts: SupplyCounts | null;
  entries: readonly SupplyEntry[];
}

/** A decision on a pending designation or appointment, or a reinstatement: who, when, what. */
interface Decided {
  act: "APPROVE" | "REFUSE" | "REINSTATE";
  by: StaffStamp;
  reason: string | null;
}

interface StoredDesignation {
  id: string;
  code: string;
  name: string;
  level: DesignationRow["level"];
  legalBasis: string | null;
  document: CanvasDocument | null;
  geography: string;
  areas: readonly string[];
  from: string;
  to: string | null;
  predecessor: string | null;
  state: Standing;
  recordedBy: StaffStamp | null;
  /** An end date recorded on a designation in force: DR-740 row 3 refuses acts under it from the next day. */
  endsAfter: string | null;
  ending: { by: StaffStamp; reason: string } | null;
  decision: Decided | null;
}

interface StoredAppointment {
  id: string;
  authority: string;
  person: string;
  name: string;
  card: string | null;
  instrument: string | null;
  document: CanvasDocument | null;
  from: string;
  to: string | null;
  state: Standing;
  recordedBy: StaffStamp | null;
  suspension: (StaffStamp & { reason: Text }) | null;
  allowanceUntil: string | null;
  endsAfter: string | null;
  ending: { by: StaffStamp; reason: string } | null;
  decision: Decided | null;
}

/** A request to reconsider (POST /verification-challenges) and the case CAS opened for it. */
interface StoredChallenge {
  subjectKind: "ANSWER" | "INSPECTION_RECORD";
  subjectRef: string;
  versionNo: number | null;
  premises: string;
  /** The party the challenger acts for, which operated the premises when the subject was made. */
  party: string;
  challenger: string | null;
  grounds: string | null;
  caseRef: string;
  openedAt: string | null;
  /** What the subject showed when it was challenged (`ALG-717` step 6); null for a challenge of the seed. */
  snapshot: ChallengeSnapshot | null;
}

/** What a challenge copies of its subject, as the case carries it (FR-VER-008). */
export type ChallengeSnapshot =
  | {
      kind: "ANSWER";
      identifier: { type: IdentifierType; value: string } | null;
      outcome: AnswerOutcome;
      scope: string | null;
      answeredAt: string;
    }
  | { kind: "INSPECTION_RECORD"; version: number; outcome: Outcome; findings: readonly FindingKind[]; digest: string; issuedAt: string };

/**
 * A result the phone checked without a network, waiting to upload: the code it read, the appointment and inspection
 * it was checked under, the keys' refresh instant, and the answer it showed (`ALG-711` on the device).
 */
interface DeviceResult extends WaitingResult {
  /** Null for the seed's result, which the canvas draws without its code. */
  code: ScannedCode | null;
  appointment: string | null;
  inspection: string | null;
  keysRefreshedAt: string;
  answer: AnswerOutcome;
}

/** The phone's store: the keys it was served, the authority chosen, the answer carried into a start, the offline results. */
interface Device {
  /** The key set `GET /verification-keys` served at the last refresh; empty before the first. */
  keys: readonly VerificationKey[];
  keysRefreshedAt: string;
  actingFor: string | null;
  /** The answer SCR-VER-02's Inspect this premises carried into SCR-VER-03 (design/03 convention 9). */
  carried: string | null;
  waiting: DeviceResult[];
  uploaded: UploadedResult[];
  failed: FailedResult[];
}

interface InspectionTables {
  device: Device;
  /** The premises register as VER reads it: the canvas's, and those only CER names, by their key. */
  register: Map<string, CanvasPremises>;
  /** The module audit log: what EXC-VER-06, EXC-VER-07 and a notice not raised leave behind, and who acted. */
  audit: { at: string; act: string; subject: string; reason: string; by?: string | null }[];
  /** The offline results uploaded, by the key the phone generated when it checked the code: each is stored once. */
  uploads: Map<string, string>;
  /** The appointment the console acts under: the one its last request named. */
  consoleActingFor: string;
  answers: Map<string, StoredAnswer>;
  inspections: Map<string, StoredInspection>;
  /** Each record's version in force, by reference. */
  records: Map<string, StoredRecord>;
  /** The versions a correction superseded, oldest first, by reference. */
  history: Map<string, SupersededRecord[]>;
  supplies: Map<string, StoredSupply>;
  designations: Map<string, StoredDesignation>;
  appointments: Map<string, StoredAppointment>;
  challenges: StoredChallenge[];
}

/** ALG-715 keeps the content's digest; a record shows its tail. */
function digestOf(content: unknown): string {
  return `…${createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(-6)}`;
}

/** A delivery as a record of the seed holds it: handed over on site where the canvas draws it so, else pending. */
function seededDelivery(delivery: { state: "PENDING" | "HANDED_OVER"; dueBy: string; handedOverAt: string | null }): StoredRecord["delivery"] {
  return {
    state: delivery.state,
    route: delivery.state === "HANDED_OVER" ? "ON_SITE" : null,
    handedOverAt: delivery.handedOverAt,
    deliveredAt: delivery.handedOverAt,
    dueBy: delivery.dueBy,
    undeliveredAt: null,
    notice: null,
    recipient: null,
    raiseOwed: false,
    raiseTriedAt: null,
  };
}

/** What an answer of the seed was given in: the inspector field set where it names a premises, the public one where it says why. */
function seededFieldSet(outcome: AnswerOutcome): StoredAnswer["fieldSet"] {
  if (outcome.kind !== "CURRENT_RESULT") return null;
  return outcome.publicFieldSetReason === null ? "INSPECTOR" : "PUBLIC";
}

/**
 * The seed, from the canvas. The phone refreshes its keys on every connection (srs/10, Key refresh), so a sign-in
 * starts with CER's keys of that moment held on the phone; everything else keeps the canvas's own moments.
 */
function seed(key: string): InspectionTables {
  const at = now();
  const stored = { identifier: null, policyVersion: null, keyId: null, authentic: null, offline: null };
  const answers = new Map<string, StoredAnswer>([
    ...CANVAS_ANSWERS.map((answer): [string, StoredAnswer] => [
      answer.reference,
      { ...answer, ...stored, inspection: null, attachRefusal: null, scope: null, fieldSet: seededFieldSet(answer.outcome) },
    ]),
    ...CANVAS_PUBLIC_ANSWERS.map((answer): [string, StoredAnswer] => [
      answer.reference,
      { ...answer, ...stored, appointment: null, channel: "PUBLIC", inspection: null, attachRefusal: null, fieldSet: "PUBLIC" },
    ]),
  ]);
  const inspections = new Map<string, StoredInspection>(
    [...CANVAS_INSPECTIONS, ...CANVAS_ORPHANED_INSPECTIONS].map((inspection) => [
      inspection.reference,
      {
        reference: inspection.reference,
        premises: inspection.premises,
        appointment: inspection.appointment,
        purpose: inspection.purpose,
        basis: null,
        areaKey: CANVAS_PREMISES.find((premises) => premises.key === inspection.premises)?.area ?? null,
        locationContext: PERMITTED_LOCATION,
        observedAt: inspection.observedAt,
        openedAt: inspection.observedAt,
        delayReason: null,
        seedLate: inspection.late,
        state: "OPEN",
        attached: inspection.attached.map((row) => ({ ...row })),
        findings: inspection.findings.map((finding) => ({ ...finding, recordedAt: inspection.observedAt })),
        record: null,
        abandonment: null,
        draft: inspection.draft,
      },
    ]),
  );
  // A record of the seed cites the answer the canvas draws it resting on, read online in force.
  const cited = (answer: string | null, readAt: string): VerifiedAnswer[] =>
    answer === null ? [] : [{ answer, channel: "ONLINE", state: "IN_FORCE", readAt }];
  const records = new Map<string, StoredRecord>(
    CANVAS_RECORDS.map((record) => [
      record.reference,
      {
        reference: record.reference,
        version: record.version,
        premises: record.premises,
        appointment: record.appointment,
        issuedAt: record.issuedAt,
        inspectedAt: record.inspectedAt,
        purpose: null,
        basis: null,
        locationContext: PERMITTED_LOCATION,
        inspector: { name: record.inspector, card: INSPECTOR_CARD },
        outcome: record.outcome,
        answer: record.answer,
        verified: cited(record.answer, record.inspectedAt),
        recordStateAtObservation: null,
        referralCase: null,
        findings: record.findings.map((finding) => ({ ...finding })),
        representativeRole: record.representativeRole,
        acknowledgement: record.acknowledgement,
        followUp: record.followUp,
        followUpBy: null,
        guidance: null,
        referral: null,
        statement: null,
        delayReason: null,
        correctedUnderCase: record.correctedUnderCase,
        correctionReason: null,
        digest: record.digest,
        delivery: seededDelivery({ state: "PENDING", dueBy: record.dueBy, handedOverAt: null }),
      },
    ]),
  );
  for (const record of CANVAS_AUTHORITY_RECORDS) {
    const content = { ...record, version: 1 };
    records.set(record.reference, {
      reference: record.reference,
      version: 1,
      premises: record.premises,
      appointment: record.appointment,
      issuedAt: record.issuedAt,
      inspectedAt: record.inspectedAt,
      purpose: null,
      basis: null,
      locationContext: PERMITTED_LOCATION,
      inspector: { name: MOCK_INSPECTOR.account, card: INSPECTOR_CARD },
      outcome: record.outcome,
      answer: null,
      verified: [],
      recordStateAtObservation: null,
      referralCase: null,
      findings: record.findings.map((finding) => ({ ...finding })),
      representativeRole: null,
      acknowledgement: null,
      followUp: record.followUp,
      followUpBy: record.followUpBy,
      guidance: record.guidance,
      referral: null,
      statement: null,
      delayReason: null,
      correctedUnderCase: null,
      correctionReason: null,
      digest: digestOf(content),
      delivery: seededDelivery(record.delivery),
    });
  }
  const supplyOf = (rest: (typeof CANVAS_SUPPLIES)[number], requester: string): StoredSupply => ({
    reference: rest.supply.reference,
    kind: rest.supply.kind,
    state: rest.supply.state,
    appointment: rest.appointment,
    requester,
    areas: rest.areas,
    requestedAt: rest.requestedAt,
    generatedAt: rest.supply.generatedAt,
    failure: rest.supply.failure,
    register: rest.register,
    counts: rest.counts,
    entries: rest.entries,
  });
  const supplies = new Map<string, StoredSupply>([
    ...CANVAS_SUPPLIES.map((supply): [string, StoredSupply] => [supply.supply.reference, supplyOf(supply, MOCK_INSPECTOR.account)]),
    ...CANVAS_OTHER_SUPPLIES.map((supply): [string, StoredSupply] => [supply.supply.reference, supplyOf(supply, supply.requester)]),
  ]);
  return {
    device: {
      keys: verificationKeysAt(key, at),
      keysRefreshedAt: at,
      actingFor: CANVAS_DEVICE.actingFor,
      carried: null,
      // The canvas draws the result waiting without the code it was checked from.
      waiting: CANVAS_DEVICE.waiting.map((row) => ({
        ...row,
        code: null,
        appointment: CANVAS_DEVICE.actingFor,
        inspection: null,
        keysRefreshedAt: CANVAS_DEVICE.keysRefreshedAt,
        answer: { kind: "UNABLE_TO_VERIFY", cause: "NO_KEY" },
      })),
      uploaded: CANVAS_DEVICE.uploaded.map((row) => ({ ...row })),
      failed: CANVAS_DEVICE.failed.map((row) => ({ ...row })),
    },
    register: new Map(CANVAS_PREMISES.map((premises) => [premises.key, premises])),
    audit: [],
    uploads: new Map(),
    consoleActingFor: CANVAS_DEVICE.actingFor,
    answers,
    inspections,
    records,
    history: new Map(),
    supplies,
    designations: new Map(
      CANVAS_DESIGNATIONS.map((designation) => [designation.id, { ...designation, endsAfter: null, ending: null, decision: null }]),
    ),
    appointments: new Map(
      CANVAS_APPOINTMENTS.map((appointment) => [appointment.id, { ...appointment, endsAfter: null, ending: null, decision: null }]),
    ),
    challenges: CANVAS_CHALLENGES.map((challenge) => ({ ...challenge, party: "tcv", challenger: null, grounds: null, snapshot: null })),
  };
}

/** A world's tables, with what time has done to the deliveries since the last read (`ALG-716`). */
function tables(key: string): InspectionTables {
  const state = table(key, "inspection", () => seed(key));
  sweepDeliveries(key, state);
  return state;
}

// ------------------------------------------------------------------ answers and small rules

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const accepted = (): LoadOutcome<{ accepted: true }> => ok({ accepted: true });

/** A 503 is a read RightOne could not make: trying again may pass. Every other refusal stands until something changes. */
const RETRYABLE: ReadonlySet<string> = new Set([
  "CASE_INTAKE_UNAVAILABLE",
  "CASE_STATE_UNAVAILABLE",
  "CERTIFICATE_READ_UNAVAILABLE",
  "GEOGRAPHY_READ_UNAVAILABLE",
  "KEYS_UNAVAILABLE",
  "POLICY_READ_UNAVAILABLE",
  "PREMISES_READ_UNAVAILABLE",
]);

/**
 * Three answers that are not refusals of the API: NOTHING_CARRIED, SCR-VER-03 opened with no answer carried in;
 * NO_CODE_READ, the stand-in camera pointed at a printout that carries no code CER signed; FORM_INCOMPLETE, a form
 * sent without a field it requires (the browser asks for it first), which the page draws again as it was sent, with
 * nothing recorded.
 */
type Answer = RefusalCode | "NOTHING_CARRIED" | "NO_CODE_READ" | "FORM_INCOMPLETE";

/** A refusal, with what its sentence names where it names something: the area, the date, the case, the version. */
export interface Refused<T> extends LoadOutcome<T> {
  detail?: string | null;
}

function refused<T>(code: Answer, detail: string | null = null): Refused<T> {
  return { data: null, failure: { code, traceId: null, retryable: RETRYABLE.has(code) }, detail };
}

const ms = (iso: string): number => Date.parse(iso);
/** The minute an instant falls in: a field that takes hours and minutes cannot say a second. */
const minuteOf = (iso: string): number => Math.floor(ms(iso) / 60_000) * 60_000;
/** The month an instant or a date falls in, in Vietnam time: "2026-09". */
const monthOf = (iso: string): string => addDays(iso.length === 10 ? `${iso}T12:00:00+07:00` : iso, 0).slice(0, 7);

/** The hour and minute of an instant in Vietnam time, as a time field writes it. */
function vietnamTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}

/** Whole calendar days in Vietnam time from one instant to another. */
function daysFrom(from: string, to: string): number {
  const day = (iso: string) => Date.parse(`${addDays(iso, 0)}T00:00:00Z`);
  return Math.max(0, Math.round((day(to) - day(from)) / 86_400_000));
}

/** An instant a number of calendar months later. */
function monthsAfter(iso: string, months: number): string {
  const date = new Date(iso);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function text(value: Text | null, locale: Locale): string | null {
  return value === null ? null : typeof value === "string" ? value : value[locale];
}

function premisesOf(state: InspectionTables, key: string | null): CanvasPremises | null {
  return key === null ? null : (state.register.get(key) ?? null);
}

function premisesName(state: InspectionTables, key: string): PremisesName {
  const premises = premisesOf(state, key);
  return premises === null ? { name: key, address: null } : { name: premises.name, address: premises.address };
}

/** The instant the keys held stop checking codes offline (CFG-778). */
const keysUntil = (device: Device): string => new Date(ms(device.keysRefreshedAt) + KEY_AGE_DAYS * 86_400_000).toISOString();

/** The phone's strip: its keys valid until a date, expiring at a time within the last 24 hours, or none held. */
function deviceOf(device: Device): FieldDevice {
  const until = keysUntil(device);
  return {
    network: "online",
    verificationKey:
      device.keys.length === 0
        ? { state: "missing" }
        : ms(until) - ms(now()) < RECORDING_INTERVAL_MS
          ? { state: "expiring", until }
          : { state: "valid", until: addDays(until, 0) },
    readAt: null,
    queue: { waiting: device.waiting.length, failed: device.failed.length },
  };
}

/** DR-742: recorded more than the interval after it took place, unless the canvas already read it for its seed. */
function isLate(inspection: StoredInspection, at: string = now()): boolean {
  return inspection.seedLate ?? ms(at) - ms(inspection.observedAt) > RECORDING_INTERVAL_MS;
}

// ------------------------------------------------------------------ CER's records, as the inspector route reads them

/** A state CER answers, in the words of section 5b: ACTIVE is in force inside its period, and not yet before it. */
function stateFrom(status: RecordStatus, current: boolean): RecordState {
  switch (status) {
    case "ACTIVE":
    case "PENDING_ISSUE":
      return current ? "IN_FORCE" : "NOT_YET_IN_FORCE";
    case "EXPIRING":
    case "REINSTATED":
      return current ? status : "NOT_YET_IN_FORCE";
    default:
      return status;
  }
}

/** The state a printed code carries: the record's status when it was printed, which the printout took as current. */
function printedStateOf(status: string): RecordState {
  const known: readonly string[] = ["ACTIVE", "PENDING_ISSUE", "EXPIRING", "REINSTATED", "SUSPENDED", "EXPIRED", "REVOKED", "CANCELLED", "REPLACED"];
  return known.includes(status) ? stateFrom(status as RecordStatus, true) : "IN_FORCE";
}

/**
 * The premises CER names for a record, as VER's register holds it: the register's entry with the same register
 * reference or name, or, for a premises only CER names, an entry taken as CER names it, with its ward as its area.
 */
function registerEntryFor(state: InspectionTables, read: InspectorRecordRead): CanvasPremises {
  const { register, name, ward } = read.premises;
  const entries = [...state.register.values()];
  const known = entries.find((premises) => register !== null && premises.reference === register) ?? entries.find((premises) => premises.name === name);
  if (known !== undefined) return known;
  const entry: CanvasPremises = { key: register ?? `CER:${read.reference}`, reference: register, name, address: null, area: ward };
  state.register.set(entry.key, entry);
  return entry;
}

/**
 * CER's answer for a premises at an instant (`CurrentRecordsForPremisesAt`, DR-741 row 3): the state of the record
 * current then, or null where none was, with the last known state. A premises the register reference of which CER
 * does not hold has no record.
 */
function recordAt(key: string, state: InspectionTables, premises: string, at: string): { current: RecordState | null; lastKnown: RecordState | null } {
  const register = premisesOf(state, premises)?.reference ?? null;
  if (register === null) return { current: null, lastKnown: null };
  const read = premisesRecordAt(key, register, at);
  return {
    current: read.current === null ? null : stateFrom(read.current.status, true),
    lastKnown: read.lastKnown === null ? null : stateFrom(read.lastKnown, false),
  };
}

/** How an attached answer reads on SCR-VER-04: the state it showed, its offline limits, or no record in force. */
function attachedResult(answer: StoredAnswer): AttachedAnswerResult {
  const { outcome } = answer;
  if (outcome.kind === "CURRENT_RESULT") {
    if (CURRENT_STATES.includes(outcome.state)) return { kind: "IN_FORCE" };
    return outcome.state === "SUSPENDED" ? { kind: "SUSPENDED" } : { kind: "NOT_CURRENT", state: outcome.state };
  }
  if (outcome.kind === "LIMITED_OFFLINE") return { kind: "OFFLINE", printedAt: outcome.printedAt, printedState: outcome.printedState };
  if (outcome.kind === "NOT_AUTHENTICATED") return { kind: "NOT_AUTHENTICATED" };
  return { kind: "NO_CURRENT_RECORD" };
}

/**
 * DR-741 row 1: an answer a compliant outcome may rest on - online, a record current when it was read; offline, a
 * code authenticated (`OFFLINE_AUTHENTIC`). A code that did not authenticate supports nothing (FR-VER-037).
 */
const supportsCompliant = (answer: StoredAnswer | undefined): boolean =>
  answer !== undefined &&
  ((answer.outcome.kind === "CURRENT_RESULT" && CURRENT_STATES.includes(answer.outcome.state)) || answer.outcome.kind === "LIMITED_OFFLINE");

/** An attached answer as a record cites it, with its own limits (`ALG-715` step 3, `verified`). */
function citedAs(answer: StoredAnswer): VerifiedAnswer | null {
  const { outcome } = answer;
  if (outcome.kind === "CURRENT_RESULT") return { answer: answer.reference, channel: "ONLINE", state: outcome.state, readAt: outcome.readAt };
  if (outcome.kind === "LIMITED_OFFLINE") {
    return { answer: answer.reference, channel: "OFFLINE_UPLOAD", printedState: outcome.printedState, printedAt: outcome.printedAt, keysRefreshedAt: outcome.keysRefreshedAt };
  }
  return null;
}

// ------------------------------------------------------------------ who acts, under what (DR-740 rows 1 to 3)

/** The party person reference of the inspector signed in, from the account RightOne ID shows. */
function personOf(sessionId: string): string | null {
  const email = sessions().get(sessionId)?.email;
  return email === undefined ? null : (INSPECTOR_PERSONS[email] ?? null);
}

/** The standing of an appointment at an instant: DR-740 rows 1 to 3, or the last-day allowance. */
type Admission = "WITHIN" | "ALLOWANCE" | "NO_EFFECTIVE_APPOINTMENT" | "APPOINTMENT_SUSPENDED" | "AUTHORITY_NOT_ACTIVE";

function designationActive(designation: StoredDesignation | undefined, day: string): boolean {
  return (
    designation !== undefined &&
    designation.state === "ACTIVE" &&
    designation.from <= day &&
    (designation.to === null || day <= designation.to) &&
    (designation.endsAfter === null || day <= designation.endsAfter)
  );
}

/**
 * Rows 1 to 3 in order. The last-day allowance of an ended appointment is the canvas's own reading of CFG-779
 * (SCR-VER-17 draws KTVH-KV2 still recordable), kept as the seed holds it.
 */
function admission(state: InspectionTables, appointmentId: string, at: string = now()): Admission {
  const appointment = state.appointments.get(appointmentId);
  if (appointment === undefined) return "NO_EFFECTIVE_APPOINTMENT";
  if (appointment.state === "ENDED" && appointment.allowanceUntil !== null) return "ALLOWANCE";
  const day = addDays(at, 0);
  const inPeriod =
    appointment.from <= day && (appointment.to === null || day <= appointment.to) && (appointment.endsAfter === null || day <= appointment.endsAfter);
  if ((appointment.state !== "ACTIVE" && appointment.state !== "SUSPENDED") || !inPeriod) return "NO_EFFECTIVE_APPOINTMENT";
  if (appointment.state === "SUSPENDED") return "APPOINTMENT_SUSPENDED";
  return designationActive(state.designations.get(appointment.authority), day) ? "WITHIN" : "AUTHORITY_NOT_ACTIVE";
}

/** The refusal an act under an admission gets; a new act is never admitted by the last-day allowance (DR-740). */
function barOf(admitted: Admission, allowance: "admits" | "refuses"): RefusalCode | null {
  if (admitted === "WITHIN") return null;
  if (admitted === "ALLOWANCE") return allowance === "admits" ? null : "NO_EFFECTIVE_APPOINTMENT";
  return admitted;
}

/**
 * Rows 1 to 3 as they stood at an earlier instant: an upload is judged at its check instant, so a result checked
 * under an appointment since ended or suspended is still taken and attributed to it. The appointment's approved
 * period and any end recorded on it, a suspension recorded by then, and the designation; one never approved never
 * admitted anything.
 */
function admissionAsOf(state: InspectionTables, appointmentId: string, at: string): Admission {
  const appointment = state.appointments.get(appointmentId);
  if (appointment === undefined || appointment.state === "PENDING_APPROVAL" || appointment.state === "REFUSED") return "NO_EFFECTIVE_APPOINTMENT";
  if (appointment.state === "ENDED" && appointment.allowanceUntil !== null) return ms(at) <= ms(appointment.allowanceUntil) ? "ALLOWANCE" : "NO_EFFECTIVE_APPOINTMENT";
  const day = addDays(at, 0);
  const lastDay = appointment.endsAfter ?? appointment.to;
  const endedAt = appointment.state === "ENDED" ? (appointment.ending?.by.at ?? null) : null;
  if (appointment.from > day || (lastDay !== null && day > lastDay) || (endedAt !== null && ms(at) >= ms(endedAt))) return "NO_EFFECTIVE_APPOINTMENT";
  if (appointment.state === "SUSPENDED" && appointment.suspension !== null && ms(appointment.suspension.at) <= ms(at)) return "APPOINTMENT_SUSPENDED";
  return designationActive(state.designations.get(appointment.authority), day) ? "WITHIN" : "AUTHORITY_NOT_ACTIVE";
}

/** The person's appointments that still give them a standing: in force, suspended, outside the authority's period, or within the allowance. */
function heldBy(state: InspectionTables, person: string | null): StoredAppointment[] {
  if (person === null) return [];
  return [...state.appointments.values()].filter((appointment) => appointment.person === person && admission(state, appointment.id) !== "NO_EFFECTIVE_APPOINTMENT");
}

/** Whether an appointment is one of the person's: their inspections, answers and supplies are theirs to read. */
const mine = (state: InspectionTables, person: string | null, id: string): boolean => heldBy(state, person).some((appointment) => appointment.id === id);

/** The appointments the person acts under now: DR-740 rows 1 to 3 pass. */
const inForceFor = (state: InspectionTables, person: string | null): StoredAppointment[] =>
  heldBy(state, person).filter((appointment) => admission(state, appointment.id) === "WITHIN");

function authorityOf(state: InspectionTables, appointmentId: string): StoredDesignation | null {
  const appointment = state.appointments.get(appointmentId);
  return appointment === undefined ? null : (state.designations.get(appointment.authority) ?? null);
}

const authorityName = (designation: StoredDesignation): string => `${designation.code} – ${designation.name}`;

function appointmentView(state: InspectionTables, appointment: StoredAppointment): Appointment {
  const designation = state.designations.get(appointment.authority);
  return designation === undefined
    ? { id: appointment.id, authorityCode: appointment.authority, authority: appointment.authority, areas: [] }
    : { id: appointment.id, authorityCode: designation.code, authority: authorityName(designation), areas: designation.areas };
}

const authorityCodeOf = (state: InspectionTables, appointmentId: string): string => authorityOf(state, appointmentId)?.code ?? appointmentId;

/** The person's appointment of an authority, the one an act on that authority's record is made under. */
function appointmentForAuthority(state: InspectionTables, person: string | null, authority: string | null): StoredAppointment | null {
  if (authority === null) return null;
  const held = heldBy(state, person).filter((appointment) => appointment.authority === authority);
  return held.find((appointment) => admission(state, appointment.id) === "WITHIN") ?? held[0] ?? null;
}

/** The last-day allowance's end for an appointment within it. */
const allowanceUntil = (state: InspectionTables, id: string): string | null =>
  admission(state, id) === "ALLOWANCE" ? (state.appointments.get(id)?.allowanceUntil ?? null) : null;

// ------------------------------------------------------------------ the register, as the inspector route reads it (DR-03)

/**
 * The form of each kind of reference. The canvas writes the public reference's as "R1-CER-YYYY-XXXXXXXX"
 * (SCR-VER-02, invalid); the printout's and the premises' follow the references it prints: CRP- and ten
 * characters, PRM- and eight.
 */
const FORMS: Readonly<Record<IdentifierType, { pattern: RegExp; format: string }>> = {
  PUBLIC_REFERENCE: { pattern: /^R1-CER-\d{4}-[A-Z0-9]{8}$/, format: "R1-CER-YYYY-XXXXXXXX" },
  REPRESENTATION_REFERENCE: { pattern: /^CRP-[A-Z0-9]{10}$/, format: "CRP-XXXXXXXXXX" },
  PREMISES_REFERENCE: { pattern: /^PRM-[A-Z0-9]{8}$/, format: "PRM-XXXXXXXX" },
};

/** The type a reference's prefix gives: R1-CER- public, CRP- a printout, anything else a premises (design/03 SCR-VER-01). */
function typeOf(value: string): IdentifierType {
  if (value.startsWith("R1-CER-")) return "PUBLIC_REFERENCE";
  if (value.startsWith("CRP-")) return "REPRESENTATION_REFERENCE";
  return "PREMISES_REFERENCE";
}

/** What a lookup answered: the outcome, the premises it is about by its key, and the field set it was given in. */
interface LookedUp {
  outcome: AnswerOutcome;
  premises: string | null;
  fieldSet: StoredAnswer["fieldSet"];
}

/**
 * A record as CER read it now (`ALG-710` steps 6 and 7): the premises named only for a premises of the jurisdiction
 * acted under (CFG-770); outside it the public field set, which names none.
 */
function currentResult(state: InspectionTables, read: InspectorRecordRead, at: string, appointment: Appointment): LookedUp {
  const premises = registerEntryFor(state, read);
  const inJurisdiction = premises.area !== null && appointment.areas.includes(premises.area);
  const day = addDays(read.since, 0);
  return {
    outcome: {
      kind: "CURRENT_RESULT",
      state: stateFrom(read.status, read.current),
      record: read.reference,
      premises: inJurisdiction ? { name: premises.name, address: premises.address } : null,
      stateSince: read.since,
      period: read.period ?? { from: day, to: day },
      readAt: at,
      // A printout is current while it is the record's latest; a public reference names the record itself.
      representationCurrent: read.printout === null || read.printout.latest,
      publicFieldSetReason: inJurisdiction ? null : "OUTSIDE_JURISDICTION",
    },
    premises: premises.key,
    fieldSet: inJurisdiction ? "INSPECTOR" : "PUBLIC",
  };
}

/**
 * `ALG-710` steps 2, 5, 6 and 7 for a reference: its form, then CER's record now - by a public reference, a printout
 * reference, or the record current for a premises of the jurisdiction named by its register reference.
 */
function lookUp(key: string, state: InspectionTables, value: string, chosen: IdentifierType | null, appointment: Appointment, at: string): LookedUp {
  const typed = value.toUpperCase();
  const type = chosen ?? typeOf(typed);
  const form = FORMS[type];
  if (!form.pattern.test(typed)) return { outcome: { kind: "INVALID_INPUT", expectedFormat: form.format, usableTypes: [] }, premises: null, fieldSet: null };

  if (type === "PUBLIC_REFERENCE" || type === "REPRESENTATION_REFERENCE") {
    const read = inspectorRecordAt(key, typed, at);
    // A public reference names a record, a printout reference a printout: neither answers for the other.
    if (read === null || (type === "PUBLIC_REFERENCE") !== (read.printout === null)) return { outcome: { kind: "NO_RECORD" }, premises: null, fieldSet: null };
    return currentResult(state, read, at, appointment);
  }

  const premises = [...state.register.values()].find((candidate) => candidate.reference === typed);
  if (premises === undefined || premises.area === null || !appointment.areas.includes(premises.area)) {
    return { outcome: { kind: "NO_PREMISES_IN_JURISDICTION" }, premises: null, fieldSet: null };
  }
  const read = premisesRecordAt(key, typed, at);
  if (read.current !== null) return currentResult(state, read.current, at, appointment);
  return {
    outcome: {
      kind: "NO_CURRENT_RECORD_FOR_PREMISES",
      premises: { name: premises.name, address: premises.address },
      lastState: read.lastKnown === null ? null : stateFrom(read.lastKnown, false),
    },
    premises: premises.key,
    fieldSet: "INSPECTOR",
  };
}

/** A code's payload, version 1, as CER signs it (`status-records.ts`, `signedCodeOf`); null where it does not decode to it. */
interface Payload {
  ref: string;
  rep: string;
  kid: string;
  iat: string;
  st: string;
  from: string | null;
  to: string | null;
  pn: string;
}

function decodePayload(payload: string): Payload | null {
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const field = (name: string): string | null => {
      const value = body[name];
      return typeof value === "string" ? value : null;
    };
    const [ref, rep, kid, iat, st, pn] = [field("ref"), field("rep"), field("kid"), field("iat"), field("st"), field("pn")];
    if (body.v !== 1 || ref === null || rep === null || kid === null || iat === null || st === null || pn === null || Number.isNaN(ms(iat))) return null;
    return { ref, rep, kid, iat, st, from: field("from"), to: field("to"), pn };
  } catch {
    return null;
  }
}

/**
 * `ALG-710` step 4 and `ALG-711` step 2: a code is authentic only where its signature verifies, over the payload's
 * bytes, under the key it names among the keys given, and its issue instant falls within that key's validity.
 */
function authenticate(code: ScannedCode, payload: Payload, keys: readonly VerificationKey[]): "AUTHENTIC" | "SIGNATURE_NOT_VERIFIED" | "KEY_NOT_VALID_AT_ISSUE" {
  const key = keys.find((candidate) => candidate.kid === payload.kid);
  if (key === undefined) return "SIGNATURE_NOT_VERIFIED";
  let verified = false;
  try {
    const publicKey = createPublicKey({ key: key.publicKeyJwk, format: "jwk" });
    verified = verifySignature("sha256", Buffer.from(code.payload, "base64url"), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(code.signature, "base64url"));
  } catch {
    verified = false;
  }
  if (!verified) return "SIGNATURE_NOT_VERIFIED";
  if (ms(payload.iat) < ms(key.validFrom) || (key.validTo !== null && ms(payload.iat) > ms(key.validTo))) return "KEY_NOT_VALID_AT_ISSUE";
  return "AUTHENTIC";
}

/** The offline answer a code gives once authenticated: what it says, as at its issue instant (`DR-03` row 10). */
function offlineAnswer(payload: Payload, premises: PremisesName, keysRefreshedAt: string, key: VerificationKey | undefined): AnswerOutcome {
  const day = addDays(payload.iat, 0);
  return {
    kind: "LIMITED_OFFLINE",
    record: payload.ref,
    premises,
    printedState: printedStateOf(payload.st),
    period: { from: payload.from ?? day, to: payload.to ?? day },
    printedAt: payload.iat,
    keysRefreshedAt,
    keyId: payload.kid,
    // The key was retired after the code was issued, and still verifies it (AC-FR-VER-017-01).
    keyRetiredAt: key?.retiredAt !== null && key?.retiredAt !== undefined && ms(key.retiredAt) > ms(payload.iat) ? key.retiredAt : null,
  };
}

/** Whether an answer names a premises of the field set an inspection can start from (design/03 SCR-VER-02). */
function inspectable(answer: StoredAnswer): boolean {
  if (answer.premises === null || answer.inspection !== null || answer.appointment === null) return false;
  if (answer.outcome.kind === "NO_CURRENT_RECORD_FOR_PREMISES") return true;
  if (answer.outcome.kind === "LIMITED_OFFLINE") return answer.fieldSet === "INSPECTOR";
  return answer.outcome.kind === "CURRENT_RESULT" && answer.outcome.premises !== null;
}

// ------------------------------------------------------------------ reads: the field client and the lists

/**
 * GET /inspections (mine, OPEN) and the appointments, with the phone's own counts. The choice of authority
 * offers every appointment the inspector holds, a suspended one too, so the refusal under it is said and the
 * inspector can turn to another authority; with none held, nothing is read (SCR-VER-17, no appointment).
 */
export function fieldHomeOf(sessionId: string): LoadOutcome<FieldHome> {
  const state = tables(sessionId);
  const { device, inspections } = state;
  const person = personOf(sessionId);
  const held = heldBy(state, person).filter((appointment) => admission(state, appointment.id) !== "ALLOWANCE");
  const actingFor = held.some((appointment) => appointment.id === device.actingFor) ? device.actingFor : null;
  const acting = actingFor === null ? null : admission(state, actingFor);
  const refusal: RefusalCode | null =
    held.length === 0
      ? "NO_EFFECTIVE_APPOINTMENT"
      : acting === "APPOINTMENT_SUSPENDED" || acting === "AUTHORITY_NOT_ACTIVE"
        ? acting
        : actingFor === null && held.every((appointment) => admission(state, appointment.id) === "APPOINTMENT_SUSPENDED")
          ? "APPOINTMENT_SUSPENDED"
          : null;
  const none = refusal === "NO_EFFECTIVE_APPOINTMENT";
  return ok({
    device: deviceOf(device),
    appointments: none ? [] : held.map((appointment) => appointmentView(state, appointment)),
    actingFor,
    refusal,
    openInspections: none
      ? []
      : [...inspections.values()]
          .filter((inspection) => inspection.state === "OPEN" && mine(state, person, inspection.appointment))
          .map((inspection) => ({
            reference: inspection.reference,
            premises: premisesName(state, inspection.premises).name,
            authorityCode: authorityCodeOf(state, inspection.appointment),
            openedAt: inspection.openedAt,
            pastRecordingInterval: isLate(inspection),
            recordableUntil: allowanceUntil(state, inspection.appointment),
          })),
    openInspectionsRefusal: null,
    storageAtRisk: false,
    updateReady: false,
  });
}

/** The refusal the field client's acts under the authority acted for get, said in its header. */
function actingRefusal(state: InspectionTables, person: string | null): RefusalCode | null {
  const held = heldBy(state, person).filter((appointment) => admission(state, appointment.id) !== "ALLOWANCE");
  if (held.length === 0) return "NO_EFFECTIVE_APPOINTMENT";
  const acting = state.device.actingFor;
  return acting === null ? null : barOf(admission(state, acting), "refuses");
}

/** The phone's keys and results, with what the last verification left to say. */
export function scanAndVerifyOf(sessionId: string, attempt: ScanAttempt | null): LoadOutcome<ScanAndVerify> {
  const state = tables(sessionId);
  const { device } = state;
  // A refresh the key read refused is said beside the keys, which the phone keeps with their earlier instant.
  const keysRefusal = attempt?.refusal === "KEYS_UNAVAILABLE" ? attempt.refusal : null;
  return ok({
    device: deviceOf(device),
    refusal: keysRefusal === null ? (attempt?.refusal ?? actingRefusal(state, personOf(sessionId))) : actingRefusal(state, personOf(sessionId)),
    keysRefusal,
    camera: "scanning",
    scannedCode: null,
    checking: false,
    typedReference: attempt?.typed ?? "",
    scan: attempt?.scan ?? { printout: "", noCode: false },
    inspection: attempt?.inspection ?? null,
    waiting: device.waiting.map(({ id, representation, outcome, checkedAt, refusal }) => ({ id, representation, outcome, checkedAt, refusal })),
    uploaded: device.uploaded,
    failed: device.failed,
  });
}

/**
 * GET /verification-answers/{ref}: the stored answer exactly as it was given, nothing recomputed, to the inspector
 * whose appointment gave it, within DR-740 rows 1 to 3 (under the last-day allowance only an answer checked by its
 * end); an answer past CFG-776's retention is disposed and reads as none. A result the phone checked offline and has
 * not uploaded is read from the phone by the key it was checked with, and carries no reference yet.
 */
export function verificationAnswerOf(sessionId: string, reference: string): LoadOutcome<VerificationAnswer> {
  const state = tables(sessionId);
  const person = personOf(sessionId);
  const waiting = state.device.waiting.find((row) => row.id === reference);
  if (waiting !== undefined && waiting.code !== null && (waiting.appointment === null || mine(state, person, waiting.appointment))) {
    return ok({
      device: deviceOf(state.device),
      reference: null,
      identifier: { type: "REPRESENTATION_REFERENCE", value: waiting.representation },
      outcome: waiting.answer,
      inspection: waiting.inspection === null ? null : { reference: waiting.inspection, attached: false },
      attachRefusal: null,
    });
  }
  // DR-740 row 1 before anything is read: a person holding no appointment that gives a standing reads nothing.
  if (heldBy(state, person).length === 0) return refused("NO_EFFECTIVE_APPOINTMENT");
  const answer = state.answers.get(reference);
  if (answer === undefined || answer.appointment === null || !mine(state, person, answer.appointment)) return refused("ANSWER_NOT_FOUND");
  const admitted = admission(state, answer.appointment);
  if (admitted === "ALLOWANCE") {
    const until = state.appointments.get(answer.appointment)?.allowanceUntil ?? null;
    if (until !== null && ms(answer.answeredAt) > ms(until)) return refused("ANSWER_NOT_FOUND");
  } else {
    const bar = barOf(admitted, "admits");
    if (bar !== null) return refused(bar);
  }
  if (ms(monthsAfter(answer.answeredAt, ANSWER_RETENTION_MONTHS)) <= ms(now())) return refused("ANSWER_NOT_FOUND");
  return ok({
    device: deviceOf(state.device),
    reference: answer.reference,
    identifier: answer.identifier,
    outcome: answer.outcome,
    inspection: answer.inspection,
    attachRefusal: answer.attachRefusal,
  });
}

const START_ANSWER_CODES: ReadonlySet<RefusalCode> = new Set<RefusalCode>([
  "ANSWER_NOT_FOUND",
  "ANSWER_NOT_FOR_PREMISES",
  "ANSWER_OUTSIDE_INSPECTION_WINDOW",
]);

/** SCR-VER-03: the premises and answer carried in, the appointment the answer was given under, and the form. */
export function inspectionStartOf(sessionId: string, attempt: StartAttempt | null): LoadOutcome<InspectionStart> {
  const state = tables(sessionId);
  const { device, answers, inspections } = state;
  const person = personOf(sessionId);
  const answer = device.carried === null ? undefined : answers.get(device.carried);
  const held = answer === undefined || answer.appointment === null || !mine(state, person, answer.appointment) ? null : (state.appointments.get(answer.appointment) ?? null);
  if (answer === undefined || answer.premises === null || held === null) return refused("NOTHING_CARRIED");
  const at = now();
  const open = [...inspections.values()].find(
    (inspection) => inspection.state === "OPEN" && inspection.premises === answer.premises && inspection.appointment === held.id,
  );
  const admitted = admission(state, held.id);
  const refusal = attempt?.refusal ?? null;
  const observed = attempt !== null ? parseObserved(attempt.observedOn, attempt.observedTime) : null;
  const headerRefusal =
    refusal !== null && !START_ANSWER_CODES.has(refusal) && refusal !== "OBSERVED_AT_IN_FUTURE" && refusal !== "DELAY_REASON_REQUIRED" ? refusal : null;
  return ok({
    device: deviceOf(device),
    premises: premisesName(state, answer.premises),
    answer: answer.reference,
    appointment: appointmentView(state, held),
    openInspection: open?.reference ?? null,
    refusal: headerRefusal ?? (admitted === "APPOINTMENT_SUSPENDED" || admitted === "AUTHORITY_NOT_ACTIVE" ? admitted : null),
    answerRefusal: refusal !== null && START_ANSWER_CODES.has(refusal) ? refusal : null,
    pastAppointmentEnd: admitted === "ALLOWANCE",
    openInspectionsRefusal: null,
    draft: {
      purpose: attempt?.purpose ?? "ROUTINE",
      basis: attempt?.basis ?? "",
      observedOn: attempt?.observedOn ?? today(),
      observedTime: attempt?.observedTime ?? vietnamTime(at),
      observedRefusal: refusal === "OBSERVED_AT_IN_FUTURE" ? refusal : null,
      delayReasonRequired: refusal === "DELAY_REASON_REQUIRED" || (observed !== null && ms(at) - ms(observed) > RECORDING_INTERVAL_MS),
      delayReason: attempt?.delayReason ?? "",
      delayRefusal: refusal === "DELAY_REASON_REQUIRED" ? refusal : null,
    },
  });
}

/** The instant a date and a time field give, in Vietnam time; null where they do not make one. */
export function parseObserved(on: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const iso = `${on}T${time}:00+07:00`;
  return Number.isNaN(ms(iso)) ? null : iso;
}

/** The results the phone checked offline from an inspection, authenticated, that wait to upload and attach to it. */
const waitingFor = (device: Device, inspection: string): DeviceResult[] =>
  device.waiting.filter((row) => row.inspection === inspection && row.outcome === "LIMITED_OFFLINE");

/** The refusal a read of an inspection or record says in its header: the appointment suspended, the authority not active. */
function headerOf(state: InspectionTables, appointmentId: string): RefusalCode | null {
  const admitted = admission(state, appointmentId);
  return admitted === "APPOINTMENT_SUSPENDED" || admitted === "AUTHORITY_NOT_ACTIVE" ? admitted : null;
}

/** GET /inspections/{id}: the inspection, its answers and findings, and the uploads about its premises not attached. */
export function inspectionOf(
  sessionId: string,
  reference: string,
  locale: Locale,
  attempt: InspectionAttempt | null,
): LoadOutcome<InspectionInProgress> {
  const state = tables(sessionId);
  const { device, answers, inspections } = state;
  const inspection = inspections.get(reference);
  if (inspection === undefined || !mine(state, personOf(sessionId), inspection.appointment)) return refused("INSPECTION_NOT_FOUND");
  const attachedRefs = new Set(inspection.attached.map((row) => row.answer));
  const open = inspection.state === "OPEN";
  return ok({
    device: deviceOf(device),
    reference: inspection.reference,
    premises: premisesName(state, inspection.premises).name,
    authorityCode: authorityCodeOf(state, inspection.appointment),
    purpose: inspection.purpose,
    tookPlaceAt: inspection.observedAt,
    state: inspection.state,
    record: inspection.record,
    attached: [
      ...inspection.attached.map((row) => {
        const stored = answers.get(row.answer);
        return { answer: row.answer, result: stored === undefined ? ({ kind: "IN_FORCE" } as const) : attachedResult(stored), readAt: row.readAt };
      }),
      // Checked offline from this inspection and still on the phone: attached once it uploads.
      ...(open ? waitingFor(device, inspection.reference) : []).map((row) => ({
        answer: row.representation,
        result: { kind: "WAITING_OFFLINE" as const, printedOn: row.answer.kind === "LIMITED_OFFLINE" ? addDays(row.answer.printedAt, 0) : addDays(row.checkedAt, 0) },
        readAt: row.checkedAt,
      })),
    ],
    uploadedNotAttached: open
      ? [...answers.values()]
          .filter(
            (answer) =>
              answer.channel === "OFFLINE_UPLOAD" &&
              answer.appointment === inspection.appointment &&
              answer.premises === inspection.premises &&
              !attachedRefs.has(answer.reference),
          )
          .map((answer) => ({
            answer: answer.reference,
            checkedAt: answer.answeredAt,
            refusal: attempt?.act === "attach" && attempt.answer === answer.reference ? attempt.refusal : null,
          }))
      : [],
    findings: inspection.findings.map((finding): Finding => ({ kind: finding.kind, note: text(finding.note, locale) })),
    refusal: open ? headerOf(state, inspection.appointment) : null,
    pastAppointmentEnd: admission(state, inspection.appointment) === "ALLOWANCE",
    draft:
      attempt?.act === "finding"
        ? { kind: attempt.kind, note: attempt.note, noteRefusal: attempt.refusal }
        : { kind: null, note: null, noteRefusal: null },
    abandon: attempt?.act === "abandon" ? { reason: attempt.reason, refusal: attempt.refusal } : { reason: "", refusal: null },
  });
}

/** Where SCR-VER-05 draws each refusal of a conclusion: beside the outcome or its field, else in the header. */
const BESIDE: Readonly<Partial<Record<RefusalCode, keyof ConclusionDraft>>> = {
  OUTCOME_NOT_SUPPORTED: "outcomeRefusal",
  RECORD_NOT_CURRENT_AT_INSPECTION: "outcomeRefusal",
  OUTCOME_CONTRADICTS_FINDING: "outcomeRefusal",
  PENALTY_ROUTE_NOT_IN_FORCE: "outcomeRefusal",
  GUIDANCE_MISSING: "guidanceRefusal",
  REFERRAL_NOTE_MISSING: "referralNoteRefusal",
  REPRESENTATIVE_ROLE_MISSING: "roleRefusal",
  DELAY_REASON_REQUIRED: "delayRefusal",
  FOLLOW_UP_DATE_INVALID: "followUpRefusal",
};

/** SCR-VER-05: the inspection to conclude, and what the form holds. */
export function conclusionOf(
  sessionId: string,
  reference: string,
  locale: Locale,
  attempt: ConclusionAttempt | null,
): LoadOutcome<Conclusion> {
  const state = tables(sessionId);
  const inspection = state.inspections.get(reference);
  if (inspection === undefined || !mine(state, personOf(sessionId), inspection.appointment)) return refused("INSPECTION_NOT_FOUND");
  const seeded = inspection.draft;
  const none: ConclusionDraft = {
    outcome: null,
    outcomeRefusal: null,
    guidance: "",
    guidanceRefusal: null,
    route: "CASE_FOLLOW_UP",
    referralNote: "",
    referralNoteRefusal: null,
    representativeRole: null,
    roleRefusal: null,
    acknowledgement: null,
    statement: "",
    // A reason given when the inspection was opened is kept and satisfies the conclusion (DR-742).
    delayReason: inspection.delayReason ?? "",
    delayRefusal: null,
    followUp: "NONE",
    followUpBy: "",
    followUpRefusal: null,
  };
  const held: ConclusionDraft =
    seeded === null
      ? none
      : {
          ...none,
          outcome: seeded.outcome,
          guidance: seeded.guidance[locale],
          route: seeded.route,
          referralNote: seeded.referralNote[locale],
          representativeRole: seeded.representativeRole,
          acknowledgement: seeded.acknowledgement,
          statement: seeded.statement,
          delayReason: seeded.delayReason[locale],
          followUp: seeded.followUp,
          followUpBy: seeded.followUpBy,
        };
  let draft: ConclusionDraft = held;
  if (attempt !== null) {
    const { refusal, notSent, ...sent } = attempt;
    draft = { ...none, ...sent };
    // A field the chosen outcome did not show was not sent: it keeps what the page held for it.
    for (const field of notSent) draft = { ...draft, [field]: held[field] };
    const beside = refusal === null ? undefined : BESIDE[refusal];
    if (beside !== undefined) draft = { ...draft, [beside]: refusal };
  }
  const headerRefusal = attempt !== null && attempt.refusal !== null && BESIDE[attempt.refusal] === undefined ? attempt.refusal : null;
  const open = inspection.state === "OPEN";
  return ok({
    device: deviceOf(state.device),
    inspection: inspection.reference,
    premises: premisesName(state, inspection.premises).name,
    tookPlaceAt: inspection.observedAt,
    lateRecording: isLate(inspection),
    refusal: open ? (headerRefusal ?? headerOf(state, inspection.appointment)) : "INSPECTION_NOT_OPEN",
    record: inspection.record,
    // A result checked offline for this inspection that has not uploaded: no compliant outcome rests on it yet.
    offlineResultWaiting: open ? (waitingFor(state.device, inspection.reference)[0]?.representation ?? null) : null,
    draft,
  });
}

/** Whether the person acts for the authority that issued a record (or a designation succeeding it): the whole record is theirs. */
function issuingAppointment(state: InspectionTables, person: string | null, record: StoredRecord): StoredAppointment | null {
  return appointmentForAuthority(state, person, state.appointments.get(record.appointment)?.authority ?? null);
}

/** A delivery as a reader sees it: its state, route and instants, without whom it was handed to. */
function deliveryView(delivery: StoredRecord["delivery"]): RecordDelivery {
  const { state, route, handedOverAt, deliveredAt, dueBy, undeliveredAt, notice } = delivery;
  return { state, route, handedOverAt, deliveredAt, dueBy, undeliveredAt, notice };
}

/**
 * GET /inspection-records/{ref}: whole for the issuing authority, the confirmation for another. Any inspector reads a
 * record by its reference within DR-740 rows 1 to 3 (FR-VER-036), and under the last-day allowance alone only a record
 * of an inspection made under it; `version` reads a version a correction superseded, whole as it was issued.
 */
export function inspectionRecordOf(
  sessionId: string,
  reference: string,
  locale: Locale,
  attempt: HandoverAttempt | null,
  version: number | null = null,
): LoadOutcome<InspectionRecord> {
  const state = tables(sessionId);
  const person = personOf(sessionId);
  const scope = consoleScope(state, person);
  if (scope.refusal !== null) return refused(scope.refusal);
  const inForce = state.records.get(reference);
  if (inForce === undefined || (scope.authorities.size === 0 && !scope.own.has(inForce.appointment))) return refused("RECORD_NOT_FOUND");
  const history = state.history.get(inForce.reference) ?? [];
  const earlier = version === null || version === inForce.version ? null : (history.find((entry) => entry.version === version) ?? undefined);
  if (earlier === undefined) return refused("RECORD_NOT_FOUND");
  const record: StoredRecord = earlier ?? inForce;
  const designation = authorityOf(state, record.appointment);
  const issuing = issuingAppointment(state, person, record);
  const at = now();
  const handoverCodes: ReadonlySet<RefusalCode> = new Set<RefusalCode>(["HANDOVER_TIME_INVALID"]);
  const deliveryCodes: ReadonlySet<RefusalCode> = new Set<RefusalCode>(["ALREADY_DELIVERED", "NOT_ISSUING_AUTHORITY"]);
  const refusal = attempt?.refusal ?? null;
  const header = refusal !== null && !handoverCodes.has(refusal) && !deliveryCodes.has(refusal) ? refusal : null;
  return ok({
    device: deviceOf(state.device),
    reference: record.reference,
    version: record.version,
    premises: premisesName(state, record.premises),
    authority: designation === null ? record.appointment : authorityName(designation),
    issuedAt: record.issuedAt,
    outcome: record.outcome,
    // Whether the premises asked to reconsider this version: the request still open on it, and its case, which an
    // inspector of another authority is not told (FR-VER-027).
    reconsideration: ((challenge) => (challenge === null ? "NONE" : { case: issuing === null ? null : challenge.caseRef }))(
      openChallenge(sessionId, state, record.reference, record.version),
    ),
    digest: record.digest,
    versionInForce: earlier === null && record.version > 1,
    supersededAt: earlier?.supersededAt ?? null,
    earlier: history.map((entry) => ({ version: entry.version, supersededAt: entry.supersededAt })),
    whole:
      issuing === null
        ? null
        : {
            inspector: record.inspector,
            inspectedAt: record.inspectedAt,
            purpose: record.purpose,
            basis: record.basis,
            locationContext: record.locationContext,
            verified: record.verified,
            recordStateAtObservation: record.recordStateAtObservation,
            referralCase: record.referralCase,
            findings: record.findings.map((finding) => ({ kind: finding.kind, note: text(finding.note, locale) })),
            representative: record.acknowledgement === null ? null : { role: record.representativeRole, acknowledgement: record.acknowledgement },
            followUp: record.followUp,
            followUpBy: record.followUpBy,
            guidance: text(record.guidance, locale),
            referral: record.referral,
            statement: record.statement,
            delayReason: record.delayReason,
            correctedUnderCase: record.correctedUnderCase,
            delivery: deliveryView(record.delivery),
          },
    refusal: header ?? (issuing === null ? null : headerOf(state, issuing.id)),
    deliveryRefusal: refusal !== null && deliveryCodes.has(refusal) ? refusal : null,
    handover: {
      on: attempt?.on ?? today(),
      time: attempt?.time ?? vietnamTime(at),
      recipient: attempt !== null ? attempt.recipient : record.representativeRole,
      refusal: refusal !== null && handoverCodes.has(refusal) ? refusal : null,
    },
  });
}

/** The day a supply was asked for: its request, or its generation where the canvas draws no request instant. */
const requestedOn = (supply: StoredSupply): string | null => {
  const at = supply.requestedAt ?? supply.generatedAt;
  return at === null ? null : addDays(at, 0);
};

/** CFG-777: the inspector's own supplies of today not FAILED, every authority of theirs counted. */
function requestedToday(state: InspectionTables, person: string | null): number {
  const day = today();
  return [...state.supplies.values()].filter(
    (supply) => supply.state !== "FAILED" && requestedOn(supply) === day && state.appointments.get(supply.appointment)?.person === person,
  ).length;
}

/** GET /inspection-lists: the supplies of the authority the console acts under, newest first, and today's count. */
export function inspectionListsOf(sessionId: string, attempt: ListAttempt | null): LoadOutcome<InspectionLists> {
  const state = tables(sessionId);
  const { consoleActingFor, supplies } = state;
  const person = personOf(sessionId);
  const acting = state.appointments.get(consoleActingFor);
  if (acting === undefined || !mine(state, person, consoleActingFor)) return refused("NO_EFFECTIVE_APPOINTMENT");
  const authority = appointmentView(state, acting);
  const blocked = headerOf(state, consoleActingFor);
  const inForce = inForceFor(state, person).map((appointment) => appointmentView(state, appointment));
  const chosen = attempt !== null ? attempt.appointment : consoleActingFor;
  const jurisdiction = inForce.find((appointment) => appointment.id === chosen)?.areas ?? authority.areas;
  const typed = attempt?.areas ?? [];
  const count = requestedToday(state, person);
  const refusal = attempt?.refusal ?? null;
  const sortKey = (supply: StoredSupply) => ms(supply.requestedAt ?? supply.generatedAt ?? "1970-01-01T00:00:00Z");
  return ok({
    authorityCode: authority.authorityCode,
    asOf: now(),
    appointments: inForce,
    actingFor: chosen,
    actingForRefusal: refusal === "APPOINTMENT_REQUIRED" ? refusal : null,
    requestKind: attempt?.kind ?? "NO_CURRENT_RECORD",
    areaOptions: [...jurisdiction, ...typed.filter((area) => !jurisdiction.includes(area))],
    areas: typed,
    areasRefusal: refusal === "OUTSIDE_JURISDICTION" ? refusal : null,
    requestedToday: count,
    dailyLimit: DAILY_LIST_LIMIT,
    nextRequestAt: count >= DAILY_LIST_LIMIT ? `${addDays(now(), 1)}T00:00:00+07:00` : null,
    refusal:
      refusal !== null && refusal !== "APPOINTMENT_REQUIRED" && refusal !== "OUTSIDE_JURISDICTION" && refusal !== "LIST_SUPPLY_LIMIT_REACHED"
        ? refusal
        : blocked,
    filter: { kind: null, state: null },
    // Under a suspension nothing of the authority is read (SCR-VER-07, suspended).
    supplies:
      blocked !== null
        ? []
        : [...supplies.values()]
            .filter((supply) => supply.appointment === consoleActingFor)
            .sort((a, b) => sortKey(b) - sortKey(a))
            .map((supply) => ({
              reference: supply.reference,
              kind: supply.kind,
              state: supply.state,
              generatedAt: supply.generatedAt,
              failure: supply.failure,
            })),
    suppliesRefusal: null,
  });
}

/** GET /inspection-lists/{id} and its entries: the header, the counts, and the entries while it is ready. */
export function listSupplyOf(sessionId: string, reference: string): LoadOutcome<ListSupply> {
  const state = tables(sessionId);
  const supply = state.supplies.get(reference);
  if (supply === undefined || !mine(state, personOf(sessionId), supply.appointment)) return refused("SUPPLY_NOT_FOUND");
  const at = now();
  const register = supply.register;
  const blocked = headerOf(state, supply.appointment);
  return ok({
    reference: supply.reference,
    kind: supply.kind,
    state: supply.state,
    areas: supply.areas,
    requestedAt: supply.requestedAt,
    generatedAt: supply.generatedAt,
    ageDays: supply.generatedAt === null ? 0 : daysFrom(supply.generatedAt, at),
    register:
      register === null
        ? null
        : { ...register, reconciledDaysAgo: register.reconciledAt === null ? 0 : daysFrom(register.reconciledAt, at) },
    registerUnread: false,
    failure: supply.failure,
    counts: supply.counts,
    entries: supply.state === "READY" && blocked === null ? supply.entries : [],
    entriesRefusal: supply.state === "REQUESTED" ? "SUPPLY_NOT_READY" : supply.state === "DISPOSED" ? "ENTRIES_DISPOSED" : null,
    selected: null,
    refusal: blocked,
  });
}

// ------------------------------------------------------------------ commands: the phone

/** The authority chosen on SCR-VER-17, kept on the phone and sent with every act that names no inspection. */
export function chooseActingFor(sessionId: string, appointment: string): LoadOutcome<{ accepted: true }> {
  const state = tables(sessionId);
  const held = heldBy(state, personOf(sessionId)).filter((candidate) => admission(state, candidate.id) !== "ALLOWANCE");
  if (!held.some((candidate) => candidate.id === appointment)) return refused("APPOINTMENT_REQUIRED");
  state.device.actingFor = appointment;
  return accepted();
}

/**
 * GET /verification-keys: every key CER publishes now, retired ones included and revoked ones absent. The phone keeps
 * the set and the instant it was served (`served_at`), from which the keys check codes offline for CFG-778's 7 days.
 * With no key published the read is refused KEYS_UNAVAILABLE, and the phone keeps its keys and their earlier instant.
 */
export function refreshVerificationKeys(sessionId: string): LoadOutcome<{ servedAt: string; keys: readonly string[] }> {
  const { device } = tables(sessionId);
  const servedAt = now();
  const keys = verificationKeysAt(sessionId, servedAt);
  if (keys.length === 0) return refused("KEYS_UNAVAILABLE");
  device.keys = keys;
  device.keysRefreshedAt = servedAt;
  return ok({ servedAt, keys: keys.map((key) => key.kid) });
}

/**
 * The camera, as the web stand-in has it: pointed at the printout whose reference is typed, it reads the code CER
 * printed there - the payload, the signature and the key a camera reads off the paper. A printout CER never made
 * carries no code to read (NO_CODE_READ).
 */
export function scanCode(sessionId: string, printout: string): LoadOutcome<ScannedCode> {
  const code = signedCodeOf(sessionId, printout.trim().toUpperCase());
  return code === null ? refused("NO_CODE_READ") : ok(code);
}

/**
 * Check offline, `ALG-711` on the phone: the code is checked against the keys the phone holds, with no network. Keys
 * older than CFG-778's 7 days, or none with the code's key, give no answer (UNABLE_TO_VERIFY); a signature that does
 * not verify, or a key not valid when the code was issued, NOT_AUTHENTICATED; otherwise LIMITED_OFFLINE, the facts as
 * at the code's issue. The result waits on the phone to upload, with the appointment and the inspection it was
 * checked under; it is read on SCR-VER-02 by the key the phone gave it.
 */
export function checkOffline(sessionId: string, request: { printout: string; code: ScannedCode; inspection: string | null }): LoadOutcome<{ result: string }> {
  const state = tables(sessionId);
  const { device } = state;
  const inspection = request.inspection === null ? undefined : state.inspections.get(request.inspection);
  const inForce = inForceFor(state, personOf(sessionId));
  const appointment = inspection?.appointment ?? device.actingFor ?? (inForce.length === 1 ? (inForce[0]?.id ?? null) : null);
  if (appointment === null) return refused("APPOINTMENT_REQUIRED");
  const at = now();
  const payload = decodePayload(request.code.payload);
  const key = device.keys.find((candidate) => candidate.kid === request.code.keyId);
  let answer: AnswerOutcome;
  if (ms(at) - ms(device.keysRefreshedAt) > KEY_AGE_DAYS * 86_400_000 || key === undefined) answer = { kind: "UNABLE_TO_VERIFY", cause: "NO_KEY" };
  else if (payload === null) answer = { kind: "NOT_AUTHENTICATED", reason: "SIGNATURE_NOT_VERIFIED" };
  else {
    const checked = authenticate(request.code, payload, device.keys);
    const known = [...state.register.values()].find((premises) => premises.name === payload.pn);
    answer =
      checked === "AUTHENTIC"
        ? offlineAnswer(payload, { name: payload.pn, address: known?.address ?? null }, device.keysRefreshedAt, key)
        : { kind: "NOT_AUTHENTICATED", reason: checked };
  }
  const result: DeviceResult = {
    id: randomUUID(),
    representation: request.printout.trim().toUpperCase(),
    outcome: answer.kind === "LIMITED_OFFLINE" || answer.kind === "NOT_AUTHENTICATED" ? answer.kind : "UNABLE_TO_VERIFY",
    checkedAt: at,
    refusal: null,
    code: request.code,
    appointment,
    inspection: request.inspection,
    keysRefreshedAt: device.keysRefreshedAt,
    answer,
  };
  device.waiting = [result, ...device.waiting];
  return ok({ result: result.id });
}

/** What the phone uploads for one result it checked offline (POST /verifications/offline-results). */
export interface OfflineUpload {
  payload: string;
  signature: string;
  keyId: string;
  representation: string;
  deviceCheckedAt: string;
  deviceKeysRefreshedAt: string;
  deviceVerdict: WaitingResult["outcome"];
  /** The appointment the inspector acted under when checking. */
  appointment: string | null;
  inspection: string | null;
  /** `Idempotency-Key`: the key the phone generated when it checked the code, so a result sent twice is stored once. */
  idempotencyKey?: string | null;
}

/**
 * POST /verifications/offline-results, in the contract's order: DR-740 rows 1 to 3 at the check instant, the payload's
 * shape, the references it signs, the device's clock, CER's keys, then with an inspection its own checks. The outcome
 * is the one RightOne computes from the payload, the signature and the keys CER publishes now (`ALG-711` steps 5 and
 * 6), never the phone's: LIMITED_OFFLINE with the facts as at the code's issue, NOT_AUTHENTICATED, or NO_RECORD where
 * CER holds no such printout. Where the phone said otherwise, EXC-VER-07 is kept in the audit log with the inspector.
 * A refusal stores nothing. A result sent again under the key it was stored with (a lost response) answers the answer
 * already stored, and EXC-VER-06 is kept.
 */
export function receiveOfflineResult(sessionId: string, upload: OfflineUpload): LoadOutcome<{ answer: string; outcome: AnswerOutcome }> {
  const state = tables(sessionId);
  const at = now();
  const person = personOf(sessionId);
  const appointmentId = upload.appointment;
  const held = appointmentId === null ? undefined : state.appointments.get(appointmentId);
  if (appointmentId === null || held === undefined || held.person !== person) return refused("NO_EFFECTIVE_APPOINTMENT");
  const idempotencyKey = upload.idempotencyKey ?? null;
  const repeated = idempotencyKey === null ? undefined : state.uploads.get(idempotencyKey);
  const stored = repeated === undefined ? undefined : state.answers.get(repeated);
  if (stored !== undefined) {
    state.audit.push({ at, act: "EXC-VER-06", subject: stored.reference, reason: "offline_result_repeated", by: person });
    return ok({ answer: stored.reference, outcome: stored.outcome });
  }
  const then = barOf(admissionAsOf(state, appointmentId, upload.deviceCheckedAt), "admits");
  if (then !== null) return refused(then);
  const payload = decodePayload(upload.payload);
  if (payload === null) return refused("PAYLOAD_UNREADABLE");
  if (upload.representation !== payload.rep || upload.keyId !== payload.kid) return refused("PAYLOAD_REFERENCE_MISMATCH");
  if (Number.isNaN(ms(upload.deviceCheckedAt)) || ms(upload.deviceCheckedAt) - ms(at) > DEVICE_CLOCK_TOLERANCE_MS) return refused("DEVICE_TIME_IN_FUTURE");
  const keys = verificationKeysAt(sessionId, at);
  if (keys.length === 0) return refused("KEYS_UNAVAILABLE");
  let inspection: StoredInspection | null = null;
  if (upload.inspection !== null) {
    inspection = state.inspections.get(upload.inspection) ?? null;
    if (inspection === null || inspection.state !== "OPEN" || inspection.appointment !== appointmentId) return refused("INSPECTION_NOT_FOUND");
    // Attaching is an act of now: rows 1 to 3 at the upload instant as well.
    const bar = barOf(admission(state, appointmentId), "admits");
    if (bar !== null) return refused(bar);
  }

  const checked = authenticate(upload, payload, keys);
  let outcome: AnswerOutcome = { kind: "NO_RECORD" };
  let premises: string | null = null;
  let fieldSet: StoredAnswer["fieldSet"] = null;
  if (checked !== "AUTHENTIC") outcome = { kind: "NOT_AUTHENTICATED", reason: checked };
  else {
    // The signed reference, never the request's alone; the record as it stood when the code was issued.
    const read = inspectorRecordAt(sessionId, payload.rep, payload.iat);
    if (read !== null) {
      const entry = registerEntryFor(state, read);
      const areas = appointmentView(state, held).areas;
      premises = entry.key;
      fieldSet = entry.area !== null && areas.includes(entry.area) ? "INSPECTOR" : "PUBLIC";
      outcome = offlineAnswer(payload, { name: entry.name, address: entry.address }, upload.deviceKeysRefreshedAt, keys.find((key) => key.kid === payload.kid));
    }
  }
  if (inspection !== null && premises !== inspection.premises) return refused("ANSWER_NOT_FOR_PREMISES");
  if (inspection !== null && ms(inspection.observedAt) - ms(upload.deviceCheckedAt) > RECORDING_INTERVAL_MS) return refused("ANSWER_OUTSIDE_INSPECTION_WINDOW");

  const answer: StoredAnswer = {
    reference: newReference("VRA"),
    appointment: appointmentId,
    channel: "OFFLINE_UPLOAD",
    answeredAt: at,
    premises,
    outcome,
    inspection: inspection === null ? null : { reference: inspection.reference, attached: true },
    attachRefusal: null,
    scope: null,
    identifier: { type: "REPRESENTATION_REFERENCE", value: upload.representation },
    fieldSet,
    policyVersion: null,
    keyId: upload.keyId,
    authentic: checked === "AUTHENTIC",
    offline: {
      payload: upload.payload,
      issuedAt: payload.iat,
      deviceCheckedAt: upload.deviceCheckedAt,
      deviceKeysRefreshedAt: upload.deviceKeysRefreshedAt,
      deviceVerdict: upload.deviceVerdict,
    },
  };
  state.answers.set(answer.reference, answer);
  if (idempotencyKey !== null) state.uploads.set(idempotencyKey, answer.reference);
  if (inspection !== null) inspection.attached.push({ answer: answer.reference, readAt: upload.deviceCheckedAt });
  // EXC-VER-07: the phone's verdict is kept beside RightOne's, and the difference recorded with the inspector (SEC-744).
  if (upload.deviceVerdict !== outcome.kind) state.audit.push({ at, act: "EXC-VER-07", subject: answer.reference, reason: `${upload.deviceVerdict} ${outcome.kind}`, by: person });
  return ok({ answer: answer.reference, outcome });
}

/** Refusals of an upload made from an inspection after which the phone uploads the result again without it (design/03 SCR-VER-01). */
const RETRY_WITHOUT_INSPECTION: ReadonlySet<string> = new Set([
  "INSPECTION_NOT_FOUND",
  "ANSWER_NOT_FOR_PREMISES",
  "ANSWER_OUTSIDE_INSPECTION_WINDOW",
  "NO_EFFECTIVE_APPOINTMENT",
  "APPOINTMENT_SUSPENDED",
  "AUTHORITY_NOT_ACTIVE",
]);

/** Refusals of a read RightOne could not make: the result stays waiting with the reason on its row. */
const STAYS_WAITING: ReadonlySet<string> = new Set(["KEYS_UNAVAILABLE", "CERTIFICATE_READ_UNAVAILABLE", "POLICY_READ_UNAVAILABLE", "PREMISES_READ_UNAVAILABLE"]);

/** RightOne's answer to an upload as the Uploaded row says it. */
function uploadedState(outcome: AnswerOutcome): UploadedResult["state"] {
  if (outcome.kind === "LIMITED_OFFLINE" || outcome.kind === "NOT_AUTHENTICATED") return outcome.kind;
  if (outcome.kind === "CURRENT_RESULT") return CURRENT_STATES.includes(outcome.state) ? "IN_FORCE" : "REVOKED";
  return "NO_RECORD";
}

/**
 * Upload now, for one waiting result: the phone sends it with the key it generated when it checked the code. Taken,
 * the result moves to Uploaded with RightOne's own answer; refused as the inspection's evidence, it is uploaded again
 * without the inspection and says why it is not attached; a read RightOne could not make leaves it waiting with the
 * reason on its row; any other refusal will not pass on another try, and it moves to Could not upload.
 */
export function uploadOfflineResult(sessionId: string, key: string): LoadOutcome<{ answer: string }> {
  const state = tables(sessionId);
  const { device } = state;
  const row = device.waiting.find((candidate) => resultKey(candidate) === key);
  if (row === undefined) return refused("ANSWER_NOT_FOUND");
  const upload = (inspection: string | null): OfflineUpload => ({
    payload: row.code?.payload ?? "",
    signature: row.code?.signature ?? "",
    keyId: row.code?.keyId ?? "",
    representation: row.representation,
    deviceCheckedAt: row.checkedAt,
    deviceKeysRefreshedAt: row.keysRefreshedAt,
    deviceVerdict: row.outcome,
    appointment: row.appointment,
    inspection,
    idempotencyKey: row.id,
  });
  let sent = receiveOfflineResult(sessionId, upload(row.inspection));
  let notAttached: RefusalCode | null = null;
  const first = sent.failure?.code ?? null;
  if (row.inspection !== null && first !== null && RETRY_WITHOUT_INSPECTION.has(first)) {
    notAttached = first as RefusalCode;
    sent = receiveOfflineResult(sessionId, upload(null));
  }
  if (sent.data !== null) {
    const taken = sent.data;
    device.waiting = device.waiting.filter((candidate) => candidate !== row);
    device.uploaded = [
      { answer: taken.answer, state: uploadedState(taken.outcome), differsFromDevice: row.outcome !== taken.outcome.kind, checkedAt: row.checkedAt, refusal: null, notAttached },
      ...device.uploaded,
    ];
    return ok({ answer: taken.answer });
  }
  const refusal = (sent.failure?.code ?? "CERTIFICATE_READ_UNAVAILABLE") as RefusalCode;
  if (STAYS_WAITING.has(refusal)) {
    row.refusal = refusal;
    return refused(refusal);
  }
  device.waiting = device.waiting.filter((candidate) => candidate !== row);
  device.failed = [{ representation: row.representation, refusal, checkedAt: row.checkedAt }, ...device.failed];
  return refused(refusal);
}

/** Discard a result that could not be uploaded: the phone deletes it; RightOne never had it. */
export function discardOfflineResult(sessionId: string, key: string): LoadOutcome<{ accepted: true }> {
  const { device } = tables(sessionId);
  device.failed = device.failed.filter((row) => resultKey(row) !== key);
  return accepted();
}

/** SCR-VER-02 Inspect this premises: the answer, and with it the premises, carry into SCR-VER-03. */
export function carryAnswerIntoInspection(sessionId: string, answerRef: string): LoadOutcome<{ accepted: true }> {
  const state = tables(sessionId);
  const answer = state.answers.get(answerRef);
  if (answer === undefined || !inspectable(answer) || answer.appointment === null || !mine(state, personOf(sessionId), answer.appointment)) {
    return refused("ANSWER_NOT_FOUND");
  }
  state.device.carried = answer.reference;
  return accepted();
}

// ------------------------------------------------------------------ commands: verification and inspections

/**
 * POST /verifications, in the contract's order: the appointment, DR-740 rows 1 to 3, a scanned code whose references
 * differ from what it signs (nothing is stored), the inspection named. Every outcome after that is an answer, stored
 * with a new VRA- reference: an invalid input, no record, a premises outside the jurisdiction, a code not
 * authenticated. A scanned code is checked against the keys CER publishes now before any record is read (`ALG-710`
 * step 4). From an inspection the answer is attached to it when it is about the inspection's premises, and stored on
 * its own with ANSWER_NOT_FOR_PREMISES when it is about another.
 */
export function verify(sessionId: string, request: VerificationRequest): LoadOutcome<{ answer: string }> {
  const state = tables(sessionId);
  const { device, answers, inspections } = state;
  const person = personOf(sessionId);
  const named = request.inspection === null ? null : (inspections.get(request.inspection) ?? null);
  const inForce = inForceFor(state, person);
  // From an inspection the act is made under its appointment; otherwise under the one the phone keeps, or the only one.
  const appointmentId = named?.appointment ?? device.actingFor ?? (inForce.length === 1 ? (inForce[0]?.id ?? null) : null);
  if (appointmentId === null) return refused("APPOINTMENT_REQUIRED");
  // The last-day allowance never admits a new verification (DR-740).
  const held = mine(state, person, appointmentId) ? state.appointments.get(appointmentId) : undefined;
  if (held === undefined) return refused("NO_EFFECTIVE_APPOINTMENT");
  const bar = barOf(admission(state, held.id), "refuses");
  if (bar !== null) return refused(bar);
  const value = request.value.trim().toUpperCase();
  const payload = request.code === null ? null : decodePayload(request.code.payload);
  if (request.code !== null && (payload === null || (value !== payload.ref && value !== payload.rep) || request.code.keyId !== payload.kid)) {
    return refused("PAYLOAD_REFERENCE_MISMATCH");
  }
  if (request.inspection !== null && (named === null || named.state !== "OPEN" || named.appointment !== held.id)) return refused("INSPECTION_NOT_FOUND");
  const appointment = appointmentView(state, held);
  const at = now();

  const type = request.identifierType ?? (request.code !== null ? "REPRESENTATION_REFERENCE" : null);
  const checked = request.code === null || payload === null ? "AUTHENTIC" : authenticate(request.code, payload, verificationKeysAt(sessionId, at));
  const found: LookedUp =
    checked === "AUTHENTIC"
      ? lookUp(sessionId, state, value, type, appointment, at)
      : { outcome: { kind: "NOT_AUTHENTICATED", reason: checked }, premises: null, fieldSet: null };
  const answer: StoredAnswer = {
    reference: newReference("VRA"),
    appointment: appointment.id,
    channel: "ONLINE",
    answeredAt: at,
    premises: found.premises,
    outcome: found.outcome,
    inspection: null,
    attachRefusal: null,
    scope: null,
    identifier: { type: type ?? typeOf(value), value },
    fieldSet: found.fieldSet,
    policyVersion: null,
    keyId: request.code?.keyId ?? null,
    authentic: request.code === null ? null : checked === "AUTHENTIC",
    offline: null,
  };
  if (named !== null) {
    const about = found.premises === named.premises;
    answer.inspection = { reference: named.reference, attached: about };
    if (about) named.attached.push({ answer: answer.reference, readAt: answer.answeredAt });
    else if (found.premises !== null) answer.attachRefusal = "ANSWER_NOT_FOR_PREMISES";
  }
  answers.set(answer.reference, answer);
  return ok({ answer: answer.reference });
}

/**
 * POST /inspections, from the answer SCR-VER-02 carried in. Checked in the contract's order: the appointment
 * (DR-740 rows 1 to 3), the jurisdiction, the purpose, the time it took place (DR-742), then the answer to
 * attach. The answer is left out for Start without the answer, after it was refused as the inspection's evidence.
 */
export function openInspection(sessionId: string, opening: InspectionOpening): LoadOutcome<{ inspection: string }> {
  const state = tables(sessionId);
  const answer = state.device.carried === null ? undefined : state.answers.get(state.device.carried);
  if (answer === undefined || answer.premises === null || answer.appointment === null) return refused("ANSWER_NOT_FOUND");
  const held = mine(state, personOf(sessionId), answer.appointment) ? state.appointments.get(answer.appointment) : undefined;
  if (held === undefined) return refused("NO_EFFECTIVE_APPOINTMENT");
  const bar = barOf(admission(state, held.id), "refuses");
  if (bar !== null) return refused(bar);
  if (opening.observedAt === null) return refused("FORM_INCOMPLETE");
  // DR-740 row 8: when it took place, the appointment and the designation were in their periods.
  const then = admissionAsOf(state, held.id, opening.observedAt);
  if (then === "NO_EFFECTIVE_APPOINTMENT" || then === "AUTHORITY_NOT_ACTIVE") return refused("OBSERVED_OUTSIDE_AUTHORITY", opening.observedAt);
  const appointment = appointmentView(state, held);
  const premises = premisesOf(state, answer.premises);
  if (premises === null || premises.area === null || !appointment.areas.includes(premises.area)) return refused("OUTSIDE_JURISDICTION");
  const purpose = PURPOSES.find((candidate) => candidate === opening.purpose);
  if (purpose === undefined) return refused("PURPOSE_NOT_ADMITTED");
  // CFG-772: a record carries the register address, never where a code was scanned or a device's location (FR-VER-005).
  const locationContext = opening.locationContext === "" ? PERMITTED_LOCATION : opening.locationContext;
  if (locationContext !== PERMITTED_LOCATION) return refused("LOCATION_CONTEXT_NOT_PERMITTED");
  const at = now();
  if (ms(opening.observedAt) > ms(at)) return refused("OBSERVED_AT_IN_FUTURE");
  const late = ms(at) - ms(opening.observedAt) > RECORDING_INTERVAL_MS;
  if (late && opening.delayReason === "") return refused("DELAY_REASON_REQUIRED");
  if (opening.withAnswer && ms(opening.observedAt) - ms(answer.answeredAt) > RECORDING_INTERVAL_MS) {
    return refused("ANSWER_OUTSIDE_INSPECTION_WINDOW");
  }

  const inspection: StoredInspection = {
    reference: newReference("ISP"),
    premises: answer.premises,
    appointment: appointment.id,
    purpose,
    basis: opening.basis === "" ? null : opening.basis,
    areaKey: premises.area,
    locationContext,
    observedAt: opening.observedAt,
    openedAt: at,
    delayReason: late ? opening.delayReason : null,
    seedLate: null,
    state: "OPEN",
    attached: opening.withAnswer ? [{ answer: answer.reference, readAt: answer.answeredAt }] : [],
    findings: [],
    record: null,
    abandonment: null,
    draft: null,
  };
  state.inspections.set(inspection.reference, inspection);
  state.device.carried = null;
  return ok({ inspection: inspection.reference });
}

/** The inspection an act on it names, open and acted on within DR-740 rows 1 to 3; or the refusal the contract gives first. */
function openOne(sessionId: string, reference: string): StoredInspection | RefusalCode {
  const state = tables(sessionId);
  const inspection = state.inspections.get(reference);
  if (inspection === undefined || !mine(state, personOf(sessionId), inspection.appointment)) return "INSPECTION_NOT_FOUND";
  const bar = barOf(admission(state, inspection.appointment), "admits");
  if (bar !== null) return bar;
  return inspection.state === "OPEN" ? inspection : "INSPECTION_NOT_OPEN";
}

/** POST /inspections/{id}/verifications: an answer of the same appointment, about the premises, checked within the window. */
export function attachVerification(sessionId: string, reference: string, answerRef: string): LoadOutcome<{ accepted: true }> {
  const inspection = openOne(sessionId, reference);
  if (typeof inspection === "string") return refused(inspection);
  const answer = tables(sessionId).answers.get(answerRef);
  if (answer === undefined || answer.appointment !== inspection.appointment) return refused("ANSWER_NOT_FOUND");
  if (answer.premises !== inspection.premises) return refused("ANSWER_NOT_FOR_PREMISES");
  if (ms(inspection.observedAt) - ms(answer.answeredAt) > RECORDING_INTERVAL_MS) return refused("ANSWER_OUTSIDE_INSPECTION_WINDOW");
  if (!inspection.attached.some((row) => row.answer === answer.reference)) {
    inspection.attached.push({ answer: answer.reference, readAt: answer.answeredAt });
  }
  return accepted();
}

/** POST /inspections/{id}/findings. A kind of the eight; a note for the three kinds that need one. */
export function recordFinding(
  sessionId: string,
  reference: string,
  finding: { kind: FindingKind | null; note: string },
): LoadOutcome<{ accepted: true }> {
  const inspection = openOne(sessionId, reference);
  if (typeof inspection === "string") return refused(inspection);
  const kind = FINDING_KINDS.find((candidate) => candidate === finding.kind);
  if (kind === undefined) return refused("FORM_INCOMPLETE");
  if (NOTE_REQUIRED_FOR.has(kind) && finding.note === "") return refused("NOTE_REQUIRED");
  inspection.findings.push({ kind, note: finding.note === "" ? null : finding.note, recordedAt: now() });
  return accepted();
}

/** POST /inspections/{id}/abandonments, OPENED_IN_ERROR: with a reason, and only while it holds nothing (DR-748). */
export function abandonInspection(sessionId: string, reference: string, reason: string): LoadOutcome<{ accepted: true }> {
  const inspection = openOne(sessionId, reference);
  if (typeof inspection === "string") return refused(inspection);
  if (reason === "") return refused("REASON_REQUIRED");
  if (inspection.attached.length > 0 || inspection.findings.length > 0) return refused("ABANDONMENT_NOT_PERMITTED");
  inspection.state = "ABANDONED";
  inspection.abandonment = { code: "OPENED_IN_ERROR", reason, at: now() };
  return accepted();
}

/** The date a follow-up runs to, from a date field: ISO, or the dd/mm/yyyy a date field without a time sends. */
export function parseDay(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const [year, month, day] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (year === undefined || month === undefined || day === undefined) return null;
  const out = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${out}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== out ? null : out;
}

/**
 * DR-741 rows 1 to 8 on an outcome, against the evidence and findings it rests on and CER's answer for the premises
 * when the inspection took place, which is read only for a compliant outcome: the same rule for a conclusion and for a
 * correction's content. RECORD_NOT_CURRENT_AT_INSPECTION names the state CER answered.
 */
function outcomeRefusal(
  outcome: Outcome,
  evidenceSupports: boolean,
  readObserved: () => { current: RecordState | null; lastKnown: RecordState | null },
  findings: readonly FindingKind[],
  content: { guidance: string; route: ReferralRoute; referralNote: string },
): { code: RefusalCode; detail: string | null } | null {
  if (outcome === "COMPLIANT" && !evidenceSupports) return { code: "OUTCOME_NOT_SUPPORTED", detail: null };
  if (outcome === "COMPLIANT") {
    const observed = readObserved();
    if (observed.current === null) return { code: "RECORD_NOT_CURRENT_AT_INSPECTION", detail: observed.lastKnown };
  }
  if ((outcome === "COMPLIANT" || outcome === "NOTHING_FOUND") && findings.includes("RECORD_SCOPE_EXCEEDED")) return { code: "OUTCOME_CONTRADICTS_FINDING", detail: "RECORD_SCOPE_EXCEEDED" };
  if (outcome === "NOTHING_FOUND" && findings.includes("MUSIC_IN_USE") && !findings.includes("EXTERNAL_LICENCE_PRESENTED")) {
    return { code: "OUTCOME_CONTRADICTS_FINDING", detail: "MUSIC_IN_USE" };
  }
  if (outcome === "GUIDANCE_GIVEN" && content.guidance === "") return { code: "GUIDANCE_MISSING", detail: null };
  // CFG-12, the pilot's posture, admits no penalty action (DEC-13): a penalty route is never in force here.
  if (outcome === "REFERRED" && content.route === "PENALTY_ROUTE") return { code: "PENALTY_ROUTE_NOT_IN_FORCE", detail: null };
  if (outcome === "REFERRED" && content.referralNote === "") return { code: "REFERRAL_NOTE_MISSING", detail: null };
  return null;
}

/** The address a party's notices go to: its principal's account (RightOne ID), where the party has one active. */
function principalAddress(party: string | null): string | null {
  if (party === null) return null;
  const principal = [...accountBook().values()].find((account) => account.role === "principal" && account.state === "active" && account.organisations.includes(party));
  return principal?.email ?? null;
}

/**
 * `ALG-715` step 6: a record version is raised through COM to the party operating the premises, at its principal's
 * address, keyed by the record and its version so a repeated raise is the same notice. COM answering with no notice
 * (its policy in force requires none, or no party is known) leaves the delivery owing one, for the sweep (`DR-744`
 * row 3), and is kept in the audit log.
 */
function raiseRecordNotice(key: string, state: InspectionTables, record: StoredRecord): void {
  const party = operatorAt(key, record.premises, record.inspectedAt);
  const at = now();
  const notice = recordNoticeEvent(key, {
    sourceModule: "VER",
    eventKind: "inspection_recorded",
    occurrenceRef: `${record.reference}-v${record.version}`,
    occurredAt: at,
    subjectKind: "inspection",
    subjectRef: record.reference,
    recipientPartyId: party,
    destination: principalAddress(party),
    facts: { record: record.reference, version: record.version, premises: premisesName(state, record.premises).name, by: addDays(record.delivery.dueBy, 0) },
  });
  if (notice === null) {
    state.audit.push({ at, act: "NOTICE_NOT_RAISED", subject: `${record.reference}-v${record.version}`, reason: "inspection_recorded" });
    record.delivery.raiseTriedAt = at;
    return;
  }
  record.delivery.notice = { reference: notice, raisedAt: at };
  record.delivery.raiseOwed = false;
}

/** The job's first run after an instant: `Verification.SweepRecordDeliveries` runs every 60 minutes, on the hour. */
const nextRunAfter = (iso: string): string => new Date(Math.floor(ms(iso) / 3_600_000) * 3_600_000 + 3_600_000).toISOString();

/**
 * `ALG-716`, played when the world is read rather than every 60 minutes: for each delivery PENDING or UNDELIVERED, a
 * notice still owed is raised again (`DR-744` row 3); a notice COM reports DELIVERED or SERVED_ALTERNATIVELY is the
 * delivery, at COM's instant (row 2); otherwise a delivery past its due instant is UNDELIVERED from the run that found
 * it so (row 5, EXC-VER-03), and stays so recorded whatever reaches the party later.
 */
function sweepDeliveries(key: string, state: InspectionTables): void {
  const at = now();
  for (const record of state.records.values()) {
    const { delivery } = record;
    if (delivery.state !== "PENDING" && delivery.state !== "UNDELIVERED") continue;
    const retryDue = delivery.raiseTriedAt === null || ms(nextRunAfter(delivery.raiseTriedAt)) <= ms(at);
    if (delivery.notice === null && delivery.raiseOwed && retryDue) raiseRecordNotice(key, state, record);
    const notice = delivery.notice === null ? null : noticeStateOf(key, delivery.notice.reference);
    if (notice !== null && (notice.state === "DELIVERED" || notice.state === "SERVED_ALTERNATIVELY")) {
      Object.assign(delivery, { state: "NOTICE_DELIVERED", route: "NOTICE", deliveredAt: notice.deliveredAt ?? at });
      continue;
    }
    const ran = nextRunAfter(delivery.dueBy);
    if (delivery.state === "PENDING" && ms(ran) <= ms(at)) Object.assign(delivery, { state: "UNDELIVERED", undeliveredAt: ran });
  }
}

/** A new version's delivery: pending, due CFG-774's 5 days after issue, with a notice owed to the party. */
const pendingDelivery = (issuedAt: string): StoredRecord["delivery"] => ({
  state: "PENDING",
  route: null,
  handedOverAt: null,
  deliveredAt: null,
  dueBy: new Date(ms(issuedAt) + DELIVERY_DAYS * 86_400_000).toISOString(),
  undeliveredAt: null,
  notice: null,
  recipient: null,
  raiseOwed: true,
  raiseTriedAt: null,
});

/**
 * `ALG-715` step 4: CAS opens the case of a referral for case follow-up (`ICaseIntake.OpenCase`, subject
 * INSPECTION_REFERRAL) on the record version that carries it, raised by the inspector at their account's address, the
 * premises' party recorded as the respondent, keyed by the record and version so a repeat opens no second case.
 * Answers the case's reference.
 */
function openReferralCase(
  sessionId: string,
  state: InspectionTables,
  inspection: { premises: string; appointment: string; reference: string; observedAt: string },
  record: { reference: string; version: number; outcome: Outcome },
  note: string,
): string {
  const designation = authorityOf(state, inspection.appointment);
  return openCase(sessionId, {
    subjectKind: "INSPECTION_REFERRAL",
    subjectRef: record.reference,
    subjectVersion: record.version,
    snapshot: {
      inspection: inspection.reference,
      premises: premisesName(state, inspection.premises).name,
      authority: designation === null ? inspection.appointment : authorityName(designation),
      outcome: record.outcome,
    },
    raiser: { account: state.appointments.get(inspection.appointment)?.name ?? null, contact: sessions().get(sessionId)?.email ?? "" },
    onBehalfOfParty: operatorAt(sessionId, inspection.premises, inspection.observedAt),
    grounds: note,
    idempotencyKey: `${record.reference}-v${record.version}-referral`,
  });
}

/**
 * POST /inspections/{id}/conclusions: DR-741 on the outcome, then the representative, the follow-up, DR-742 at the
 * conclusion instant, and last a case follow-up - a referral to CASE_FOLLOW_UP or a follow-up by CASE - for which CAS
 * opens a case first (`openCase`), answered CASE_INTAKE_UNAVAILABLE where CAS cannot take it, the
 * inspection staying open. Issued, the record is version 1 citing every attached answer with its limits, its
 * delivery PENDING and due CFG-774's 5 days after issue, the inspection CONCLUDED, and the record is raised to the
 * party through COM.
 */
export function concludeInspection(
  sessionId: string,
  inspectorName: string,
  reference: string,
  conclusion: Omit<ConclusionAttempt, "refusal" | "notSent">,
): Refused<{ record: string }> {
  const state = tables(sessionId);
  const inspection = openOne(sessionId, reference);
  if (typeof inspection === "string") return refused(inspection);
  const { outcome } = conclusion;
  if (outcome === null) return refused("FORM_INCOMPLETE");
  const findings = inspection.findings.map((finding) => finding.kind);
  const evidence = inspection.attached.map((row) => state.answers.get(row.answer)).filter((answer): answer is StoredAnswer => answer !== undefined);

  // DR-741, rows 1 to 8 in order; CER is read at the instant the inspection took place, for a compliant outcome only.
  const cer: { observed: ReturnType<typeof recordAt> | null } = { observed: null };
  const readObserved = () => (cer.observed = recordAt(sessionId, state, inspection.premises, inspection.observedAt));
  const ruled = outcomeRefusal(outcome, evidence.some(supportsCompliant), readObserved, findings, conclusion);
  if (ruled !== null) return refused(ruled.code, ruled.detail);

  const nobody = conclusion.acknowledgement === "NO_REPRESENTATIVE_PRESENT";
  if (conclusion.acknowledgement === null || (!nobody && conclusion.representativeRole === null)) return refused("REPRESENTATIVE_ROLE_MISSING");
  const followUpBy = conclusion.followUp === "NONE" ? null : parseDay(conclusion.followUpBy);
  if (conclusion.followUp !== "NONE" && (followUpBy === null || followUpBy < today())) return refused("FOLLOW_UP_DATE_INVALID");
  const delayReason = conclusion.delayReason !== "" ? conclusion.delayReason : (inspection.delayReason ?? "");
  if (isLate(inspection) && delayReason === "") return refused("DELAY_REASON_REQUIRED");

  const recordRef = newReference("IRC");
  const byCase = (outcome === "REFERRED" && conclusion.route === "CASE_FOLLOW_UP") || conclusion.followUp === "CASE";
  const note = outcome === "REFERRED" ? conclusion.referralNote : outcome === "GUIDANCE_GIVEN" ? conclusion.guidance : "";
  const referralCase = byCase ? openReferralCase(sessionId, state, inspection, { reference: recordRef, version: 1, outcome }, note) : null;
  if (byCase && referralCase === null) return refused("CASE_INTAKE_UNAVAILABLE");

  const issuedAt = now();
  const content = {
    reference: recordRef,
    version: 1,
    premises: inspection.premises,
    appointment: inspection.appointment,
    issuedAt,
    inspectedAt: inspection.observedAt,
    purpose: inspection.purpose,
    basis: inspection.basis,
    locationContext: inspection.locationContext,
    inspector: { name: inspectorName, card: state.appointments.get(inspection.appointment)?.card ?? INSPECTOR_CARD },
    outcome,
    answer: evidence.find(supportsCompliant)?.reference ?? null,
    verified: evidence.map(citedAs).filter((cited): cited is VerifiedAnswer => cited !== null),
    recordStateAtObservation: cer.observed?.current ?? null,
    referralCase,
    findings: inspection.findings.map(({ kind, note }) => ({ kind, note })),
    representativeRole: nobody ? null : conclusion.representativeRole,
    acknowledgement: conclusion.acknowledgement,
    followUp: conclusion.followUp,
    followUpBy,
    guidance: outcome === "GUIDANCE_GIVEN" ? conclusion.guidance : null,
    referral: outcome === "REFERRED" ? { route: conclusion.route, note: conclusion.referralNote } : null,
    statement: conclusion.statement === "" ? null : conclusion.statement,
    delayReason: isLate(inspection) ? delayReason : null,
    correctedUnderCase: null,
    correctionReason: null,
  };
  const record: StoredRecord = { ...content, digest: digestOf(content), delivery: pendingDelivery(issuedAt) };
  state.records.set(record.reference, record);
  inspection.state = "CONCLUDED";
  inspection.record = record.reference;
  raiseRecordNotice(sessionId, state, record);
  return ok({ record: record.reference });
}

/**
 * POST /inspection-records/{ref}/deliveries: the issuing authority records the copy handed over on site, while the
 * delivery is PENDING or UNDELIVERED, at a time after the record was issued and not later than now (to the minute
 * the field gives). The instant it became UNDELIVERED stays recorded (FR-VER-035).
 */
export function recordDelivery(
  sessionId: string,
  reference: string,
  handover: { handedOverAt: string | null; recipient: RepresentativeRole | null },
): LoadOutcome<{ accepted: true }> {
  const state = tables(sessionId);
  const record = state.records.get(reference);
  if (record === undefined) return refused("RECORD_NOT_FOUND");
  const issuing = issuingAppointment(state, personOf(sessionId), record);
  if (issuing === null) return refused("NOT_ISSUING_AUTHORITY");
  const bar = barOf(admission(state, issuing.id), "admits");
  if (bar !== null) return refused(bar);
  if (record.delivery.state === "HANDED_OVER" || record.delivery.state === "NOTICE_DELIVERED") return refused("ALREADY_DELIVERED");
  const at = handover.handedOverAt;
  if (at === null || ms(at) < minuteOf(record.issuedAt) || ms(at) > ms(now())) return refused("HANDOVER_TIME_INVALID");
  if (handover.recipient === null) return refused("FORM_INCOMPLETE");
  record.delivery = { ...record.delivery, state: "HANDED_OVER", route: "ON_SITE", handedOverAt: at, deliveredAt: at, recipient: handover.recipient };
  return accepted();
}

/** The counts the canvas draws for a kind over exactly these areas; none for any other set of areas. */
function countsFor(kind: ListKind, areas: readonly string[], entries: readonly SupplyEntry[]): SupplyCounts {
  const known = CANVAS_REGISTER.counts.find(
    (row) => row.kind === kind && row.areas.length === areas.length && row.areas.every((area) => areas.includes(area)),
  );
  return {
    byArea: areas.map((area) => ({ area, listed: entries.filter((entry) => entry.area === area).length })),
    listed: entries.length,
    current: known?.counts.current ?? null,
    outOfScope: known?.counts.outOfScope ?? null,
    indeterminate: known?.counts.indeterminate ?? null,
    notOperating: known?.counts.notOperating ?? null,
  };
}

/**
 * REG's answers on each entry at the supply's instant, in place of the canvas's copy of them (ALG-713, ALG-714): the
 * deadline state (`DeadlineStateAt`) and, on the second list, one REPORTED_CHANGE_UNDECIDED entry per open report of
 * a changed fact (`OpenFactChangeReportsAt`, DR-743 row 3). A premises REG's world does not hold keeps the canvas's.
 */
function withRegistration(key: string, kind: ListKind, entries: readonly SupplyEntry[], at: string): SupplyEntry[] {
  const reports = openFactChangeReportsAt(key, [...new Set(entries.map((entry) => entry.premises))], at);
  const deadline = (entry: SupplyEntry): SupplyEntry["deadline"] => {
    if (!reports.has(entry.premises)) return entry.deadline;
    const answer = deadlineStateAt(key, entry.premises, at);
    return answer === null ? null : { kind: answer.state === "WITHIN_DEADLINE" ? "WITHIN" : "PAST", date: answer.on };
  };
  return [...new Set(entries.map((entry) => entry.premises))].flatMap((premises) => {
    const all = entries.filter((entry) => entry.premises === premises);
    const answered = kind === "NOT_CURRENT_WITH_DECISION" && reports.has(premises);
    const kept = all.filter((entry) => !answered || entry.class !== "REPORTED_CHANGE_UNDECIDED").map((entry) => ({ ...entry, deadline: deadline(entry) }));
    const template = all[0];
    if (!answered || template === undefined) return kept;
    // Rows 4 then 3, in the fixed order ALG-714 gives a premises in both conditions.
    const changes = (reports.get(premises) ?? []).map(
      (report): SupplyEntry => ({ ...template, deadline: deadline(template), class: "REPORTED_CHANGE_UNDECIDED", detail: { kind: "CHANGE", reference: report.application }, since: report.submittedOn }),
    );
    return [...kept, ...changes];
  });
}

/**
 * POST /inspection-lists, then the generation job the API runs within a minute, which the mock runs at once:
 * the entries are the canvas's register entries of that kind in the areas asked for (the whole jurisdiction
 * when none is named), read from the register as the canvas's ready supply read it.
 */
export function requestInspectionList(
  sessionId: string,
  request: { appointment: string | null; kind: ListKind; areas: readonly string[] },
): LoadOutcome<{ supply: string }> {
  const state = tables(sessionId);
  const person = personOf(sessionId);
  const inForce = inForceFor(state, person);
  const appointmentId = request.appointment ?? (inForce.length === 1 ? (inForce[0]?.id ?? null) : null);
  if (appointmentId === null) return refused("APPOINTMENT_REQUIRED");
  const held = mine(state, person, appointmentId) ? state.appointments.get(appointmentId) : undefined;
  if (held === undefined) return refused("NO_EFFECTIVE_APPOINTMENT");
  const bar = barOf(admission(state, held.id), "refuses");
  if (bar !== null) return refused(bar);
  const appointment = appointmentView(state, held);
  if (request.areas.some((area) => !appointment.areas.includes(area))) return refused("OUTSIDE_JURISDICTION");
  if (requestedToday(state, person) >= DAILY_LIST_LIMIT) return refused("LIST_SUPPLY_LIMIT_REACHED");
  const kind = LIST_KINDS.find((candidate) => candidate === request.kind) ?? "NO_CURRENT_RECORD";

  const at = now();
  const areas = request.areas.length > 0 ? appointment.areas.filter((area) => request.areas.includes(area)) : appointment.areas;
  const entries = withRegistration(sessionId, kind, CANVAS_REGISTER.entries[kind].filter((entry) => areas.includes(entry.area)), at);
  const supply: StoredSupply = {
    reference: newReference("ILS"),
    kind,
    state: "READY",
    appointment: appointment.id,
    requester: held.name,
    areas,
    requestedAt: at,
    generatedAt: at,
    failure: null,
    register: { ...CANVAS_REGISTER.read, readAt: at },
    counts: countsFor(kind, areas, entries),
    entries,
  };
  state.supplies.set(supply.reference, supply);
  state.consoleActingFor = appointment.id;
  return ok({ supply: supply.reference });
}

// ------------------------------------------------------------------ the operations console (SCR-VER-09 to 12)

/** A member of staff as the operations console's acts need them: who, for segregation, and what they hold. */
export interface StaffActor {
  name: string;
  email: string;
  roles: readonly StaffRole[];
}

const holdsRole = (staff: StaffActor, role: StaffRole): boolean => staff.roles.includes(role);
const stampOf = (staff: StaffActor): StaffStamp => ({ name: staff.name, email: staff.email, at: now() });

/** Who is barred from deciding: DR-746 row 1 before row 2, so segregation is said whatever the person holds. */
function decisionBar(staff: StaffActor, actor: StaffStamp | null): DecisionBar {
  if (actor !== null && actor.email === staff.email) return "SEGREGATION_REQUIRED";
  return holdsRole(staff, "ACT-BIZ-APR") ? null : "NOT_AUTHORISED";
}

const STANDING_ORDER: Readonly<Record<Standing, number>> = { ACTIVE: 0, SUSPENDED: 1, PENDING_APPROVAL: 2, REFUSED: 3, ENDED: 4 };

function geographyLabel(id: string, locale: Locale): string {
  return id === GEOGRAPHY_2025.id ? GEOGRAPHY_2025.label[locale] : id;
}

function designationRow(designation: StoredDesignation, locale: Locale): DesignationRow {
  return {
    id: designation.id,
    code: designation.code,
    name: designation.name,
    level: designation.level,
    areas: designation.areas,
    geography: geographyLabel(designation.geography, locale),
    from: designation.from,
    to: designation.to,
    state: designation.state,
    endsAfter: designation.endsAfter,
    recordedBy: designation.recordedBy,
  };
}

/** GET /inspection-authorities: the designations, those in force first, then by code. */
export function inspectionAuthoritiesOf(key: string, staff: StaffActor, locale: Locale): LoadOutcome<InspectionAuthorities> {
  const { designations } = tables(key);
  return ok({
    asOf: now(),
    designations: [...designations.values()]
      .sort((a, b) => STANDING_ORDER[a.state] - STANDING_ORDER[b.state] || a.code.localeCompare(b.code))
      .map((designation) => designationRow(designation, locale)),
    geographies: [{ id: GEOGRAPHY_2025.id, label: GEOGRAPHY_2025.label[locale] }],
    mayAct: holdsRole(staff, "ACT-OPS"),
  });
}

/** The areas typed or pasted into the form: keys separated by semicolons (or new lines), each trimmed. */
function areasOf(typed: string): string[] {
  return typed
    .split(/[;\n]/)
    .map((area) => area.trim())
    .filter((area) => area !== "");
}

/**
 * POST /inspection-authorities: AREA_NOT_IN_GEOGRAPHY naming the area, AUTHORITY_CODE_EXISTS, AUTHORITY_NOT_FOUND
 * for the predecessor, in that order. Recorded, the designation waits for a second person's approval.
 */
export function recordDesignation(key: string, staff: StaffActor, form: DesignationForm): Refused<{ designation: string }> {
  if (!holdsRole(staff, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const state = tables(key);
  const areas = areasOf(form.areas);
  const from = parseDay(form.from);
  const to = form.to === "" ? null : parseDay(form.to);
  if (form.code === "" || form.name === "" || form.level === null || form.legalBasis === "" || form.document === null || areas.length === 0 || from === null) {
    return refused("FORM_INCOMPLETE");
  }
  if (form.geography !== GEOGRAPHY_2025.id) return refused("GEOGRAPHY_READ_UNAVAILABLE");
  const known: readonly string[] = GEOGRAPHY_2025.areas;
  const outside = areas.find((area) => !known.includes(area));
  if (outside !== undefined) return refused("AREA_NOT_IN_GEOGRAPHY", outside);
  const code = form.code.toUpperCase();
  if ([...state.designations.values()].some((designation) => designation.code.toUpperCase() === code)) return refused("AUTHORITY_CODE_EXISTS");
  if (form.predecessor !== "" && !state.designations.has(form.predecessor)) return refused("AUTHORITY_NOT_FOUND");
  const at = now();
  const designation: StoredDesignation = {
    id: newReference("DSG"),
    code,
    name: form.name,
    level: form.level,
    legalBasis: form.legalBasis,
    document: { ...form.document, at, by: staff.name },
    geography: form.geography,
    areas,
    from,
    to,
    predecessor: form.predecessor === "" ? null : form.predecessor,
    state: "PENDING_APPROVAL",
    recordedBy: stampOf(staff),
    endsAfter: null,
    ending: null,
    decision: null,
  };
  state.designations.set(designation.id, designation);
  return ok({ designation: designation.id });
}

/** The checks an ending shares for a designation and an appointment, after the state: the reason, then the date. */
function endingRefusal(standing: Standing, effectiveTo: string, reason: string, approvedEnd: string | null): Refused<never> | { day: string | null } {
  if (reason === "" || reason.length > REASON_MAX) return refused("REASON_REQUIRED");
  if (standing === "PENDING_APPROVAL") return { day: null };
  const day = parseDay(effectiveTo);
  if (day === null || day < today()) return refused("END_DATE_IN_PAST");
  if (approvedEnd !== null && day > approvedEnd) return refused("END_DATE_EXTENDS_PERIOD", approvedEnd);
  return { day };
}

/**
 * POST /inspection-authorities/{id}/endings: an end date on a designation in force (it stays in force until
 * then; the job ends it after), or the withdrawal of a pending one, at once.
 */
export function endDesignation(key: string, staff: StaffActor, id: string, effectiveTo: string, reason: string): Refused<{ accepted: true }> {
  if (!holdsRole(staff, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const designation = tables(key).designations.get(id);
  if (designation === undefined) return refused("AUTHORITY_NOT_FOUND");
  if (designation.state !== "ACTIVE" && designation.state !== "PENDING_APPROVAL") return refused("DESIGNATION_NOT_ACTIVE");
  const checked = endingRefusal(designation.state, effectiveTo, reason, designation.to);
  if ("failure" in checked) return checked;
  designation.ending = { by: stampOf(staff), reason };
  if (checked.day === null) designation.state = "ENDED";
  else designation.endsAfter = checked.day;
  return accepted();
}

function designationDetail(state: InspectionTables, designation: StoredDesignation, locale: Locale): DesignationDetail {
  const predecessor = designation.predecessor === null ? undefined : state.designations.get(designation.predecessor);
  return {
    ...designationRow(designation, locale),
    legalBasis: designation.legalBasis,
    document: designation.document,
    predecessor: predecessor === undefined ? null : { code: predecessor.code, name: predecessor.name },
  };
}

const waitingSince = (stamp: StaffStamp | null): number => (stamp === null ? 0 : ms(stamp.at));

/** GET /inspection-authorities?status=PENDING_APPROVAL: the waiting list, oldest first, and the one opened. */
export function designationDecisionsOf(
  key: string,
  staff: StaffActor,
  opened: string | null,
  decided: string | null,
  locale: Locale,
): LoadOutcome<DesignationDecisions> {
  const state = tables(key);
  const waiting = [...state.designations.values()]
    .filter((designation) => designation.state === "PENDING_APPROVAL")
    .sort((a, b) => waitingSince(a.recordedBy) - waitingSince(b.recordedBy));
  const named = opened === null ? undefined : state.designations.get(opened);
  const openedRefusal: RefusalCode | null =
    opened === null ? null : named === undefined ? "AUTHORITY_NOT_FOUND" : named.state !== "PENDING_APPROVAL" ? "NOT_PENDING_APPROVAL" : null;
  const shown = opened === null ? waiting[0] : openedRefusal === null ? named : undefined;
  const just = decided === null ? undefined : state.designations.get(decided);
  return ok({
    asOf: now(),
    waiting: waiting.map((designation) => ({
      id: designation.id,
      code: designation.code,
      name: designation.name,
      from: designation.from,
      recordedBy: designation.recordedBy,
    })),
    appointmentsWaiting: [...state.appointments.values()].filter((appointment) => appointment.state === "PENDING_APPROVAL").length,
    opened: shown === undefined ? null : { designation: designationDetail(state, shown, locale), bar: decisionBar(staff, shown.recordedBy) },
    openedRefusal,
    decided:
      just !== undefined && just.decision !== null && just.decision.act !== "REINSTATE" && (just.state === "ACTIVE" || just.state === "REFUSED")
        ? { code: just.code, state: just.state, at: just.decision.by.at }
        : null,
  });
}

/** DR-746 for a decision: segregation, the approval right, still pending, a reason to refuse; in that order. */
function decide(
  staff: StaffActor,
  subject: { state: Standing; recordedBy: StaffStamp | null; decision: Decided | null },
  decision: "APPROVE" | "REFUSE" | null,
  reason: string,
  authorityActive: boolean | null,
): Refused<{ accepted: true }> {
  const bar = decisionBar(staff, subject.recordedBy);
  if (bar !== null) return refused(bar);
  if (subject.state !== "PENDING_APPROVAL") return refused("NOT_PENDING_APPROVAL");
  if (authorityActive === false) return refused("DESIGNATION_NOT_ACTIVE");
  if (decision === null) return refused("FORM_INCOMPLETE");
  if (decision === "REFUSE" && (reason === "" || reason.length > REASON_MAX)) return refused("REASON_REQUIRED");
  subject.state = decision === "APPROVE" ? "ACTIVE" : "REFUSED";
  subject.decision = { act: decision, by: stampOf(staff), reason: reason === "" ? null : reason };
  return accepted();
}

/** POST /inspection-authorities/{id}/decisions. */
export function decideDesignation(
  key: string,
  staff: StaffActor,
  id: string,
  decision: "APPROVE" | "REFUSE" | null,
  reason: string,
): Refused<{ accepted: true }> {
  const designation = tables(key).designations.get(id);
  if (designation === undefined) return refused("AUTHORITY_NOT_FOUND");
  return decide(staff, designation, decision, reason, null);
}

function appointmentRow(appointment: StoredAppointment): AppointmentRow {
  return {
    id: appointment.id,
    person: appointment.person,
    name: appointment.name,
    card: appointment.card,
    instrument: appointment.instrument,
    from: appointment.from,
    to: appointment.to,
    state: appointment.state,
    suspendedAt: appointment.state === "SUSPENDED" ? (appointment.suspension?.at ?? null) : null,
    endsAfter: appointment.endsAfter,
  };
}

/**
 * GET /inspection-appointments?authority_id=: one authority's appointments, in force first, then by name. With no
 * authority named, the first designation in force by code (KTVH-KV1, as SCR-VER-11 opens).
 */
export function inspectorAppointmentsOf(key: string, staff: StaffActor, authority: string | null): LoadOutcome<InspectorAppointments> {
  const state = tables(key);
  const active = [...state.designations.values()].filter((designation) => designation.state === "ACTIVE").sort((a, b) => a.code.localeCompare(b.code));
  const designation = authority === null ? active[0] : state.designations.get(authority);
  if (designation === undefined) return refused("AUTHORITY_NOT_FOUND");
  return ok({
    asOf: now(),
    authority: { id: designation.id, code: designation.code, name: designation.name, state: designation.state },
    authorities: active.map((entry) => ({ id: entry.id, code: entry.code, name: entry.name })),
    appointments: [...state.appointments.values()]
      .filter((appointment) => appointment.authority === designation.id)
      .sort((a, b) => STANDING_ORDER[a.state] - STANDING_ORDER[b.state] || a.name.localeCompare(b.name, "vi"))
      .map(appointmentRow),
    mayAct: holdsRole(staff, "ACT-OPS"),
  });
}

/**
 * POST /inspection-appointments: AUTHORITY_NOT_FOUND, DESIGNATION_NOT_ACTIVE, PERSON_NOT_FOUND (PTY's register),
 * APPOINTMENT_EXISTS, in that order. Recorded, the appointment waits for a second person's approval.
 */
export function recordAppointment(key: string, staff: StaffActor, form: AppointmentForm): Refused<{ appointment: string }> {
  if (!holdsRole(staff, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const state = tables(key);
  const from = parseDay(form.from);
  const to = form.to === "" ? null : parseDay(form.to);
  if (form.authority === "" || form.person === "" || form.name === "" || form.instrument === "" || form.document === null || from === null) {
    return refused("FORM_INCOMPLETE");
  }
  const designation = state.designations.get(form.authority);
  if (designation === undefined) return refused("AUTHORITY_NOT_FOUND");
  if (designation.state === "REFUSED" || designation.state === "ENDED") return refused("DESIGNATION_NOT_ACTIVE");
  const person = form.person.toUpperCase();
  if (CANVAS_PERSONS[person] === undefined) return refused("PERSON_NOT_FOUND");
  const open: ReadonlySet<Standing> = new Set<Standing>(["ACTIVE", "SUSPENDED", "PENDING_APPROVAL"]);
  if ([...state.appointments.values()].some((appointment) => appointment.person === person && appointment.authority === designation.id && open.has(appointment.state))) {
    return refused("APPOINTMENT_EXISTS");
  }
  const at = now();
  const appointment: StoredAppointment = {
    id: newReference("APT"),
    authority: designation.id,
    person,
    name: form.name,
    card: form.card === "" ? null : form.card,
    instrument: form.instrument,
    document: { ...form.document, at, by: staff.name },
    from,
    to,
    state: "PENDING_APPROVAL",
    recordedBy: stampOf(staff),
    suspension: null,
    allowanceUntil: null,
    endsAfter: null,
    ending: null,
    decision: null,
  };
  state.appointments.set(appointment.id, appointment);
  return ok({ appointment: appointment.id });
}

/** POST /inspection-appointments/{id}/suspensions: from now, with a reason; the inspector's next act is refused. */
export function suspendAppointment(key: string, staff: StaffActor, id: string, reason: string): Refused<{ accepted: true }> {
  if (!holdsRole(staff, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const appointment = tables(key).appointments.get(id);
  if (appointment === undefined) return refused("APPOINTMENT_NOT_FOUND");
  if (appointment.state !== "ACTIVE") return refused("APPOINTMENT_NOT_ACTIVE");
  if (reason === "" || reason.length > REASON_MAX) return refused("REASON_REQUIRED");
  appointment.state = "SUSPENDED";
  appointment.suspension = { ...stampOf(staff), reason };
  return accepted();
}

/** POST /inspection-appointments/{id}/endings: an end date on one in force or suspended, or a pending one withdrawn. */
export function endAppointment(key: string, staff: StaffActor, id: string, effectiveTo: string, reason: string): Refused<{ accepted: true }> {
  if (!holdsRole(staff, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const appointment = tables(key).appointments.get(id);
  if (appointment === undefined) return refused("APPOINTMENT_NOT_FOUND");
  if (appointment.state === "REFUSED" || appointment.state === "ENDED") return refused("APPOINTMENT_NOT_ACTIVE");
  const checked = endingRefusal(appointment.state, effectiveTo, reason, appointment.to);
  if ("failure" in checked) return checked;
  appointment.ending = { by: stampOf(staff), reason };
  if (checked.day === null) appointment.state = "ENDED";
  else appointment.endsAfter = checked.day;
  return accepted();
}

function waitingAppointment(state: InspectionTables, appointment: StoredAppointment): AppointmentWaiting {
  return {
    id: appointment.id,
    name: appointment.name,
    card: appointment.card,
    authorityCode: state.designations.get(appointment.authority)?.code ?? appointment.authority,
    from: appointment.from,
    recordedBy: appointment.recordedBy,
  };
}

/** GET /inspection-appointments for the approver: the waiting ones, oldest first, the one opened, and the suspended. */
export function appointmentDecisionsOf(
  key: string,
  staff: StaffActor,
  opened: string | null,
  decided: string | null,
  locale: Locale,
): LoadOutcome<AppointmentDecisions> {
  const state = tables(key);
  const all = [...state.appointments.values()];
  const waiting = all.filter((appointment) => appointment.state === "PENDING_APPROVAL").sort((a, b) => waitingSince(a.recordedBy) - waitingSince(b.recordedBy));
  const named = opened === null ? undefined : state.appointments.get(opened);
  const openedRefusal: RefusalCode | null =
    opened === null ? null : named === undefined ? "APPOINTMENT_NOT_FOUND" : named.state !== "PENDING_APPROVAL" ? "NOT_PENDING_APPROVAL" : null;
  const shown = opened === null ? waiting[0] : openedRefusal === null ? named : undefined;
  const designation = shown === undefined ? undefined : state.designations.get(shown.authority);
  const just = decided === null ? undefined : state.appointments.get(decided);
  return ok({
    asOf: now(),
    waiting: waiting.map((appointment) => waitingAppointment(state, appointment)),
    designationsWaiting: [...state.designations.values()].filter((entry) => entry.state === "PENDING_APPROVAL").length,
    opened:
      shown === undefined
        ? null
        : {
            appointment: {
              ...waitingAppointment(state, shown),
              authority: designation === undefined ? shown.authority : authorityName(designation),
              person: shown.person,
              instrument: shown.instrument,
              to: shown.to,
            },
            bar: decisionBar(staff, shown.recordedBy),
          },
    openedRefusal,
    suspended: all
      .filter((appointment) => appointment.state === "SUSPENDED")
      .map((appointment) => ({
        id: appointment.id,
        name: appointment.name,
        card: appointment.card,
        authorityCode: state.designations.get(appointment.authority)?.code ?? appointment.authority,
        suspendedAt: appointment.suspension?.at ?? appointment.from,
        suspendedBy: appointment.suspension?.name ?? "",
        reason: text(appointment.suspension?.reason ?? null, locale) ?? "",
        bar: decisionBar(staff, appointment.suspension),
      })),
    decided: just !== undefined && just.decision !== null ? { name: just.name, act: just.decision.act, at: just.decision.by.at } : null,
  });
}

/** POST /inspection-appointments/{id}/decisions: DR-746, with the designation in force (row 4). */
export function decideAppointment(
  key: string,
  staff: StaffActor,
  id: string,
  decision: "APPROVE" | "REFUSE" | null,
  reason: string,
): Refused<{ accepted: true }> {
  const state = tables(key);
  const appointment = state.appointments.get(id);
  if (appointment === undefined) return refused("APPOINTMENT_NOT_FOUND");
  return decide(staff, appointment, decision, reason, state.designations.get(appointment.authority)?.state === "ACTIVE");
}

/**
 * POST /inspection-appointments/{id}/reinstatements: DR-746 rows 1 to 4 with the person who suspended in place of
 * the one who recorded; the inspector's next act is admitted again.
 */
export function reinstateAppointment(key: string, staff: StaffActor, id: string): Refused<{ accepted: true }> {
  const state = tables(key);
  const appointment = state.appointments.get(id);
  if (appointment === undefined) return refused("APPOINTMENT_NOT_FOUND");
  const bar = decisionBar(staff, appointment.suspension);
  if (bar !== null) return refused(bar);
  if (appointment.state !== "SUSPENDED") return refused("APPOINTMENT_NOT_SUSPENDED");
  if (state.designations.get(appointment.authority)?.state !== "ACTIVE") return refused("DESIGNATION_NOT_ACTIVE");
  appointment.state = "ACTIVE";
  appointment.suspension = null;
  appointment.decision = { act: "REINSTATE", by: stampOf(staff), reason: null };
  return accepted();
}

// ------------------------------------------------------------------ the records and their reconsideration

/** The party operating a premises and its id in the portal: Then Cửa Việt's premises, and none for another's. */
const partyOf = (premises: string): { party: string; portalId: string } | null => PREMISES_OF_PARTY[premises] ?? null;

/**
 * The party that operated a premises at an instant, by its RightOne ID organisation (SEC-745): what PTY's register
 * answers (`premisesRelationshipAt`), so a record or an answer belongs to the party of its own instant, not to whoever
 * operates the premises now. A premises PTY's register does not hold is the seed's party; null where nobody operated it.
 */
function operatorAt(key: string, premises: string, at: string): string | null {
  const known = partyOf(premises);
  const answer = premisesRelationshipAt(key, known?.portalId ?? premises, { at });
  if (answer.kind === "EFFECTIVE") return answer.organisation;
  return answer.kind === "NOT_FOUND" || answer.kind === "INSTANT_IN_FUTURE" ? (known?.party ?? null) : null;
}

/** Whether a case is not settled for the record: not decided yet, or decided with a correction not yet issued under it. */
function unsettled(key: string, state: InspectionTables, challenge: StoredChallenge): boolean {
  const entry = caseDecisionFor(key, challenge.caseRef);
  if (entry === null || !entry.decided) return true;
  if (!entry.correctionRequired || challenge.subjectKind !== "INSPECTION_RECORD") return false;
  return correctedUnderDecision(state, challenge.subjectRef, challenge.caseRef, entry.decidedAt) === null;
}

function versionsOf(state: InspectionTables, reference: string): StoredRecord[] {
  const current = state.records.get(reference);
  return [...(state.history.get(reference) ?? []), ...(current === undefined ? [] : [current])];
}

/**
 * The version corrected under the case's decision in force (`ICaseLinkage.IsArtefactLinked`): one naming the case and
 * issued once that decision was made. A version issued under an earlier decision, which an appeal has since varied
 * with a new remedy, is not the correction the remedy in force requires (DR-747 row 5, AC-FR-VER-026-10).
 */
function correctedUnderDecision(state: InspectionTables, reference: string, caseRef: string, decidedAt: string | null): StoredRecord | null {
  return (
    versionsOf(state, reference).find(
      (version) => version.correctedUnderCase === caseRef && (decidedAt === null || ms(version.issuedAt) >= ms(decidedAt)),
    ) ?? null
  );
}

/** The unsettled request to reconsider a subject's version, if one is open. */
function openChallenge(key: string, state: InspectionTables, subjectRef: string, version: number | null): StoredChallenge | null {
  return (
    state.challenges.find(
      (challenge) => challenge.subjectRef === subjectRef && (version === null || challenge.versionNo === null || challenge.versionNo === version) && unsettled(key, state, challenge),
    ) ?? null
  );
}

/** The case decided with a correction of a record still to issue: correction_due (DR-747). */
function correctionDue(key: string, state: InspectionTables, record: StoredRecord): { case: string; since: string } | null {
  for (const challenge of state.challenges) {
    if (challenge.subjectRef !== record.reference || !unsettled(key, state, challenge)) continue;
    const entry = caseDecisionFor(key, challenge.caseRef);
    if (entry !== null && entry.decided && entry.correctionRequired) return { case: challenge.caseRef, since: entry.decidedAt ?? record.issuedAt };
  }
  return null;
}

/**
 * A record as its readers read it whole. `caseShown` false is the reader of another authority's record, told that
 * it is under challenge and nothing of the case (FR-VER-027).
 */
function recordDetail(key: string, state: InspectionTables, record: StoredRecord, locale: Locale, caseShown = true): RecordDetail {
  const designation = authorityOf(state, record.appointment);
  const challenge = openChallenge(key, state, record.reference, record.version);
  return {
    reference: record.reference,
    version: record.version,
    premises: { key: record.premises, name: premisesName(state, record.premises).name },
    inspectedAt: record.inspectedAt,
    issuedAt: record.issuedAt,
    authority: designation === null ? record.appointment : authorityName(designation),
    authorityCode: designation?.code ?? record.appointment,
    inspector: record.inspector,
    findings: record.findings.map((finding) => ({ kind: finding.kind, note: text(finding.note, locale) })),
    outcome: record.outcome,
    guidance: text(record.guidance, locale),
    referral: record.referral,
    statement: record.statement,
    delayReason: record.delayReason,
    followUp: record.followUp,
    followUpBy: record.followUpBy,
    challenge: challenge === null ? null : { case: caseShown ? challenge.caseRef : null },
    correctedUnderCase: record.correctedUnderCase,
    verified: record.verified,
    delivery: deliveryView(record.delivery),
    superseded: (state.history.get(record.reference) ?? []).map((version) => ({
      version: version.version,
      issuedAt: version.issuedAt,
      supersededAt: version.supersededAt,
      outcome: version.outcome,
    })),
  };
}

/** A premises principal, as the portal's reads are scoped: the party they act for and their name. */
export interface PremisesActor {
  party: string;
  name: string;
}

/** The premises the person acts for, from the registration the portal's shell lists (PTY's delegations). */
function actedFor(key: string): readonly { id: string; name: string }[] {
  return premisesActedFor(key).data ?? [];
}

/** The permission entries of the premises actor's reads and challenge (`frd/09-permission-entries.md`), which PTY's scopes cover. */
type PremisesPermission = "PERM-1102" | "PERM-1121" | "PERM-1124" | "PERM-1129";

/**
 * PTY's answer for a read or a challenge by reference (`AuthorityToActForPartyAt`, SEC-745): whether the person signed
 * in acts today for the party, about this premises. The principal acts for the whole party, after the premises changed
 * hands or closed as well; a delegate only within her delegation, at the premises and for the act (`mayActFor`,
 * DR-201), so one whose delegation was revoked, or names another premises, reads and challenges nothing of it. A
 * session PTY answers for nobody acts on nothing.
 */
function actsForPremises(key: string, premises: string, permission: PremisesPermission): boolean {
  const acting = actingAs(key);
  if (acting === null) return false;
  return acting.actor === "PRINCIPAL" || mayActFor(key, partyOf(premises)?.portalId ?? premises, permission);
}

/**
 * The record a premises actor may read: one of a premises their party operated when it was made, which PTY lets the
 * person read for the party now (SEC-745); for anyone else none, so the read is RECORD_NOT_FOUND.
 */
function partysRecord(key: string, state: InspectionTables, actor: PremisesActor, reference: string): StoredRecord | null {
  const record = state.records.get(reference.toUpperCase());
  return record !== undefined && operatorAt(key, record.premises, record.inspectedAt) === actor.party && actsForPremises(key, record.premises, "PERM-1121") ? record : null;
}

/**
 * GET /premises/{premisesId}/inspection-records and GET /inspection-records/{ref}: the records of one premises
 * the person acts for, newest first, and the one opened. With no premises named, the premises of the newest
 * record the party holds; a record named opens with its premises.
 */
export function premisesRecordsOf(
  key: string,
  actor: PremisesActor,
  premisesId: string | null,
  recordRef: string | null,
  locale: Locale,
): LoadOutcome<PremisesInspectionRecords> {
  const state = tables(key);
  const options = actedFor(key);
  // The records of inspections made while the party the person acts for operated the premises, of the premises PTY
  // lets the person read (SEC-745): a delegate's within her delegation, so one outside it never chooses the premises.
  const partys = [...state.records.values()]
    .filter((record) => operatorAt(key, record.premises, record.inspectedAt) === actor.party && actsForPremises(key, record.premises, "PERM-1121"))
    .sort((a, b) => ms(b.inspectedAt) - ms(a.inspectedAt));
  const named = recordRef === null ? null : partysRecord(key, state, actor, recordRef);
  const chosen = premisesId ?? (named !== null ? partyOf(named.premises)?.portalId : partys[0] !== undefined ? partyOf(partys[0].premises)?.portalId : options[0]?.id) ?? null;
  const premises = options.find((option) => option.id === chosen);
  // GET /premises/{premisesId}/inspection-records asks PTY whether the person may act for the premises now (PERM-1124).
  if (premises === undefined || !mayActFor(key, premises.id, "PERM-1124")) return refused("NOT_AUTHORISED_FOR_PREMISES");
  const records = partys.filter((record) => partyOf(record.premises)?.portalId === premises.id).map((record) => recordDetail(key, state, record, locale));
  const opened = named !== null && partyOf(named.premises)?.portalId === premises.id ? recordDetail(key, state, named, locale) : recordRef === null ? (records[0] ?? null) : null;
  return ok({
    asOf: now(),
    premises,
    options,
    records,
    opened,
    openedRefusal: recordRef !== null && opened === null ? "RECORD_NOT_FOUND" : null,
  });
}

/** The record version a premises actor reads by reference, for its printout. */
export function premisesRecordOf(key: string, actor: PremisesActor, reference: string, locale: Locale): LoadOutcome<RecordDetail & { digest: string }> {
  const state = tables(key);
  const record = partysRecord(key, state, actor, reference);
  return record === null ? refused("RECORD_NOT_FOUND") : ok({ ...recordDetail(key, state, record, locale), digest: record.digest });
}

/**
 * What a request to reconsider is about (GET /inspection-records/{ref} or /verification-answers/{ref}), as the
 * subject showed it; and, after sending, the case it opened.
 */
export function reconsiderationOf(
  key: string,
  actor: PremisesActor,
  subjectRef: string | null,
  sentCase: string | null,
  locale: Locale,
): LoadOutcome<Reconsideration> {
  const state = tables(key);
  const options = actedFor(key);
  const typed = subjectRef?.trim().toUpperCase() ?? "";
  const sent = sentCase === null ? undefined : state.challenges.find((challenge) => challenge.caseRef === sentCase && challenge.party === actor.party);
  const base = { typed, premisesOptions: options, sent: sent === undefined ? null : { case: sent.caseRef } };
  if (typed === "") return ok({ ...base, subject: null, subjectRefusal: null });
  if (typed.startsWith("IRC-")) {
    const record = partysRecord(key, state, actor, typed);
    if (record === null) return ok({ ...base, subject: null, subjectRefusal: "RECORD_NOT_FOUND" });
    return ok({ ...base, subject: { kind: "INSPECTION_RECORD", record: recordDetail(key, state, record, locale), versionInForce: record.version }, subjectRefusal: null });
  }
  if (typed.startsWith("VRA-")) {
    const answer = answerOf(key, state, typed);
    // An answer about a premises is the party's that operated it when the answer was given, read by whom PTY lets
    // read it for the party now (SEC-745, PERM-1102); one naming no premises is read in the public field set.
    if (answer === null || (answer.premises !== null && (operatorAt(key, answer.premises, answer.answeredAt) !== actor.party || !actsForPremises(key, answer.premises, "PERM-1102")))) {
      return ok({ ...base, subject: null, subjectRefusal: "ANSWER_NOT_FOUND" });
    }
    const portalId = answer.premises === null ? null : (partyOf(answer.premises)?.portalId ?? null);
    const premises = portalId === null ? null : (options.find((option) => option.id === portalId) ?? null);
    return ok({
      ...base,
      subject: { kind: "ANSWER", reference: answer.reference, premises, outcome: answer.outcome, scope: text(answer.scope, locale), shownAt: answer.answeredAt },
      subjectRefusal: null,
    });
  }
  return ok({ ...base, subject: null, subjectRefusal: "SUBJECT_NOT_FOUND" });
}

/** PUB's status words, as the public route answered a record, in the words of section 5b. */
const PUBLIC_STATES: Readonly<Record<string, RecordState>> = {
  active: "IN_FORCE",
  expiring: "EXPIRING",
  reinstated: "REINSTATED",
  suspended: "SUSPENDED",
  revoked: "REVOKED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
  replaced: "REPLACED",
};

/**
 * A stored answer by its reference: VER's own, or one the public route gave (`PUB`'s `publicVerificationAnswer`, the
 * answer kept as it was shown, in the public field set and to the hour). A public answer that found a record is about
 * that record's premises, as CER names them; one that found none names no premises.
 */
function answerOf(key: string, state: InspectionTables, reference: string): StoredAnswer | null {
  const own = state.answers.get(reference);
  if (own !== undefined) return own;
  const given = publicVerificationAnswer(key, reference);
  if (given === null) return null;
  const read = given.record === null ? null : inspectorRecordAt(key, given.record, given.answeredHour);
  const shown = given.shown;
  const day = addDays(given.answeredHour, 0);
  const outcome: AnswerOutcome =
    given.outcome === "RECORD" && given.record !== null && shown !== null
      ? {
          kind: "CURRENT_RESULT",
          state: PUBLIC_STATES[shown.status] ?? "IN_FORCE",
          record: given.record,
          premises: null,
          stateSince: shown.statusSince ?? null,
          period: { from: shown.validFrom ?? day, to: shown.validTo ?? day },
          readAt: given.answeredHour,
          representationCurrent: true,
          publicFieldSetReason: null,
        }
      : { kind: "NO_RECORD" };
  return {
    reference: given.reference,
    appointment: null,
    channel: "PUBLIC",
    answeredAt: given.answeredHour,
    premises: read === null ? null : registerEntryFor(state, read).key,
    outcome,
    inspection: null,
    attachRefusal: null,
    scope: null,
    identifier: given.presented === null ? null : { type: typeOf(given.presented), value: given.presented },
    fieldSet: "PUBLIC",
    policyVersion: null,
    keyId: null,
    authentic: null,
    offline: null,
  };
}

/** What a challenge copies of its subject (`ALG-717` step 6): an answer as it was shown, or a record version as issued. */
function snapshotOf(answer: StoredAnswer | null, record: StoredRecord | null, locale: Locale): ChallengeSnapshot | null {
  if (record !== null) {
    return { kind: "INSPECTION_RECORD", version: record.version, outcome: record.outcome, findings: record.findings.map((finding) => finding.kind), digest: record.digest, issuedAt: record.issuedAt };
  }
  if (answer === null) return null;
  return { kind: "ANSWER", identifier: answer.identifier, outcome: answer.outcome, scope: text(answer.scope, locale), answeredAt: answer.answeredAt };
}

/**
 * POST /verification-challenges, DR-745 in the contract's order: the grounds, the subject, the premises where
 * the subject names none, the party, a superseded version, a request already open; then CAS opens the case,
 * whose reference the challenge keeps with what the subject showed (FR-VER-008), in the product's language. An answer
 * the public route gave is a subject too, read from where PUB keeps it.
 */
export function requestReconsideration(
  key: string,
  actor: PremisesActor,
  request: { subject: string; versionNo: number | null; premises: string | null; grounds: string },
): Refused<{ case: string }> {
  const state = tables(key);
  if (request.grounds === "" || request.grounds.length > GROUNDS_MAX) return refused("GROUNDS_MISSING");
  const subjectRef = request.subject.trim().toUpperCase();
  const record = subjectRef.startsWith("IRC-") ? state.records.get(subjectRef) : undefined;
  const answer = subjectRef.startsWith("VRA-") ? (answerOf(key, state, subjectRef) ?? undefined) : undefined;
  if (record === undefined && answer === undefined) return refused("SUBJECT_NOT_FOUND");
  const options = actedFor(key);
  let premises: string;
  if (record !== undefined) premises = record.premises;
  else if (answer !== undefined && answer.premises !== null) premises = answer.premises;
  else {
    if (request.premises === null || request.premises === "") return refused("PREMISES_REQUIRED");
    const chosen = options.find((option) => option.id === request.premises);
    const registered = Object.entries(PREMISES_OF_PARTY).find(([, value]) => value.portalId === request.premises)?.[0];
    if (chosen === undefined) return refused("NOT_PARTY_TO_SUBJECT");
    // A premises of the party the inspection register does not hold yet is named by the portal's id.
    premises = registered ?? chosen.id;
  }
  // DR-745 rows 4 and 5: the party PTY says operated the premises at the subject's instant is the one the person acts
  // for, and PTY lets the person challenge for it now (PERM-1129): a delegate within her delegation only.
  const subjectAt = record?.inspectedAt ?? answer?.answeredAt ?? now();
  if (operatorAt(key, premises, subjectAt) !== actor.party || !actsForPremises(key, premises, "PERM-1129")) return refused("NOT_PARTY_TO_SUBJECT");
  if (record !== undefined && request.versionNo !== null && request.versionNo < record.version) return refused("SUBJECT_SUPERSEDED", String(record.version));
  const version = record?.version ?? null;
  const already = openChallenge(key, state, subjectRef, version);
  if (already !== null) return refused("CHALLENGE_ALREADY_OPEN", already.caseRef);
  // The principal is answered at their account's address, as a case raised from the account is.
  const subjectKind = record !== undefined ? "INSPECTION_RECORD" : "ANSWER";
  // The case carries what the subject showed (`ALG-717` steps 6 and 7), and the challenge keeps the same copy.
  const snapshot = snapshotOf(answer ?? null, record ?? null, "vi");
  const caseRef = openReconsideration(key, {
    party: actor.party,
    account: actor.name,
    contact: sessions().get(key)?.email ?? "",
    subjectKind,
    subjectRef,
    grounds: request.grounds,
    subjectVersion: version,
    snapshot: snapshot === null ? null : { ...snapshot },
  });
  state.challenges.push({
    subjectKind,
    subjectRef,
    versionNo: version,
    premises,
    party: actor.party,
    challenger: actor.name,
    grounds: request.grounds,
    caseRef,
    openedAt: now(),
    snapshot,
  });
  return ok({ case: caseRef });
}

// ------------------------------------------------------------------ the authority's console: its work and a correction

/**
 * The authorities whose inspections and records the inspector's console reads: those of every appointment that
 * passes DR-740 rows 1 to 3; under the last-day allowance only their own inspections observed by its end.
 */
function consoleScope(state: InspectionTables, person: string | null): { authorities: Set<string>; own: Set<string>; refusal: RefusalCode | null } {
  const held = heldBy(state, person);
  const passing = held.filter((appointment) => admission(state, appointment.id) === "WITHIN");
  const allowance = held.filter((appointment) => admission(state, appointment.id) === "ALLOWANCE");
  const refusal: RefusalCode | null =
    passing.length > 0 || allowance.length > 0
      ? null
      : held.some((appointment) => admission(state, appointment.id) === "APPOINTMENT_SUSPENDED")
        ? "APPOINTMENT_SUSPENDED"
        : held.length > 0
          ? "AUTHORITY_NOT_ACTIVE"
          : "NO_EFFECTIVE_APPOINTMENT";
  return {
    authorities: new Set(passing.map((appointment) => appointment.authority)),
    own: new Set(allowance.map((appointment) => appointment.id)),
    refusal,
  };
}

function inScope(state: InspectionTables, scope: ReturnType<typeof consoleScope>, appointmentId: string): boolean {
  const authority = state.appointments.get(appointmentId)?.authority;
  return (authority !== undefined && scope.authorities.has(authority)) || scope.own.has(appointmentId);
}

/** When an inspector stopped being able to act: the day after their appointment's last day, or its end. */
function cannotActSince(appointment: StoredAppointment | undefined): string | null {
  if (appointment === undefined) return null;
  return appointment.endsAfter ?? appointment.to ?? appointment.ending?.by.at ?? appointment.from;
}

/** The rows the authority acts on, one per flag (GET /inspections?flag=), oldest flag first. */
function workRows(key: string, state: InspectionTables, scope: ReturnType<typeof consoleScope>): WorkRow[] {
  const at = now();
  const day = today();
  const rows: WorkRow[] = [];
  for (const inspection of state.inspections.values()) {
    if (inspection.state !== "OPEN" || !inScope(state, scope, inspection.appointment)) continue;
    const base = { reference: inspection.reference, kind: "INSPECTION" as const, authorityCode: authorityCodeOf(state, inspection.appointment), premises: premisesName(state, inspection.premises).name };
    if (admission(state, inspection.appointment) === "NO_EFFECTIVE_APPOINTMENT") {
      const appointment = state.appointments.get(inspection.appointment);
      rows.push({ ...base, flag: "INSPECTOR_CANNOT_ACT", since: cannotActSince(appointment) ?? inspection.openedAt, detail: { date: appointment?.to ?? null, case: null, person: appointment?.name ?? null } });
    } else if (isLate(inspection, at)) {
      rows.push({ ...base, flag: "OPEN_BEYOND_INTERVAL", since: inspection.openedAt, detail: { date: inspection.openedAt, case: null, person: null } });
    }
  }
  for (const record of state.records.values()) {
    if (!inScope(state, scope, record.appointment)) continue;
    const base = { reference: record.reference, kind: "RECORD" as const, authorityCode: authorityCodeOf(state, record.appointment), premises: premisesName(state, record.premises).name };
    const due = correctionDue(key, state, record);
    if (due !== null) rows.push({ ...base, flag: "CORRECTION_DUE", since: due.since, detail: { date: null, case: due.case, person: null } });
    // EXC-VER-03: the sweep found the period passed with neither route reaching the party.
    if (record.delivery.state === "UNDELIVERED") {
      rows.push({ ...base, flag: "UNDELIVERED", since: record.delivery.dueBy, detail: { date: record.delivery.dueBy, case: null, person: null } });
    }
    if ((record.followUp === "RE_VISIT" || record.followUp === "AWAIT_REGISTRATION") && record.followUpBy !== null && record.followUpBy < day) {
      rows.push({ ...base, flag: "FOLLOW_UP_OVERDUE", since: `${record.followUpBy}T00:00:00+07:00`, detail: { date: record.followUpBy, case: null, person: null } });
    }
  }
  return rows.sort((a, b) => ms(a.since) - ms(b.since));
}

/** A page's cursor: where it starts and the filter it was issued for, so a cursor of another filter is not one of this read's. */
const workCursor = (offset: number, flag: WorkFlag | null): string => Buffer.from(JSON.stringify({ o: offset, f: flag ?? "" })).toString("base64url");

/** Where a cursor this read issued starts; null for one it did not issue (CURSOR_INVALID). */
function workOffset(cursor: string, flag: WorkFlag | null): number | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown; f?: unknown };
    return typeof parsed.o === "number" && Number.isInteger(parsed.o) && parsed.o > 0 && parsed.f === (flag ?? "") ? parsed.o : null;
  } catch {
    return null;
  }
}

/**
 * SCR-VER-18: GET /inspections over every appointment of the person in force, with the exceptions of the
 * console, filtered by flag, a page of WORK_PAGE_SIZE rows at a time; a record opened by reference (GET
 * /inspection-records/{ref}); and an inspection just closed, or its closure refused.
 */
export function authorityWorkOf(
  sessionId: string,
  flag: WorkFlag | null,
  recordRef: string | null,
  closed: string | null,
  closing: RowAttempt | null,
  locale: Locale,
  cursor: string | null = null,
): LoadOutcome<AuthorityWork> {
  const state = tables(sessionId);
  const scope = consoleScope(state, personOf(sessionId));
  const all = scope.refusal === null ? workRows(sessionId, state, scope) : [];
  const flagged = flag === null ? all : all.filter((row) => row.flag === flag);
  const offset = cursor === null ? 0 : workOffset(cursor, flag);
  const typed = recordRef?.trim().toUpperCase() ?? "";
  const record = typed === "" ? undefined : state.records.get(typed);
  const shut = closed === null ? undefined : state.inspections.get(closed);
  const closingInspection = closing === null ? undefined : state.inspections.get(closing.id);
  return ok({
    asOf: now(),
    refusal: scope.refusal,
    flag,
    // A cursor this read did not issue reads the first page again, with the filter kept, and says so (convention 10).
    rows: flagged.slice(offset ?? 0, (offset ?? 0) + WORK_PAGE_SIZE),
    nextCursor: (offset ?? 0) + WORK_PAGE_SIZE < flagged.length ? workCursor((offset ?? 0) + WORK_PAGE_SIZE, flag) : null,
    cursor: offset === null ? null : cursor,
    rowsRefusal: offset === null ? "CURSOR_INVALID" : null,
    opened:
      record === undefined || scope.refusal !== null
        ? null
        : {
            record: recordDetail(sessionId, state, record, locale, inScope(state, scope, record.appointment)),
            whole: inScope(state, scope, record.appointment),
            correctionCase: inScope(state, scope, record.appointment) ? (correctionDue(sessionId, state, record)?.case ?? null) : null,
          },
    openedRef: typed,
    openedRefusal: typed !== "" && record === undefined ? "RECORD_NOT_FOUND" : null,
    closed:
      shut?.abandonment?.code === "INSPECTOR_NO_LONGER_APPOINTED" ? { reference: shut.reference, premises: premisesName(state, shut.premises).name } : null,
    closing:
      closing === null || closingInspection === undefined
        ? null
        : {
            inspection: closingInspection.reference,
            premises: premisesName(state, closingInspection.premises).name,
            openedBy: state.appointments.get(closingInspection.appointment)?.name ?? "",
            reason: closing.reason,
            refusal: closing.refusal,
          },
  });
}

/**
 * POST /inspections/{id}/abandonments, INSPECTOR_NO_LONGER_APPOINTED (DR-748): the authority closes an open
 * inspection whose inspector can no longer act; what was found stays on file.
 */
export function closeInspection(sessionId: string, reference: string, reason: string): LoadOutcome<{ accepted: true }> {
  const state = tables(sessionId);
  const scope = consoleScope(state, personOf(sessionId));
  if (scope.refusal !== null) return refused(scope.refusal);
  const inspection = state.inspections.get(reference);
  if (inspection === undefined || !inScope(state, scope, inspection.appointment)) return refused("INSPECTION_NOT_FOUND");
  if (inspection.state !== "OPEN") return refused("INSPECTION_NOT_OPEN");
  if (reason === "" || reason.length > REASON_MAX) return refused("REASON_REQUIRED");
  if (admission(state, inspection.appointment) !== "NO_EFFECTIVE_APPOINTMENT") return refused("INSPECTOR_STILL_APPOINTED");
  inspection.state = "ABANDONED";
  inspection.abandonment = { code: "INSPECTOR_NO_LONGER_APPOINTED", reason, at: now() };
  return accepted();
}

/** DR-747 rows 1 to 5 for a record and the case named: what CAS answers, and the refusal it gives. */
function caseCheck(
  key: string,
  state: InspectionTables,
  record: StoredRecord,
  caseRef: string,
): { line: RecordCorrection["caseLine"]; refusal: RefusalCode | null; already: StoredRecord | null } {
  if (caseRef === "") return { line: "NONE", refusal: null, already: null };
  const challenged = state.challenges.some((challenge) => challenge.subjectRef === record.reference && challenge.caseRef === caseRef);
  if (!challenged) return { line: "NOT_FOR_RECORD", refusal: "CASE_NOT_FOR_RECORD", already: null };
  const entry = caseDecisionFor(key, caseRef);
  if (entry === null) return { line: "NONE", refusal: "CASE_STATE_UNAVAILABLE", already: null };
  if (!entry.decided) return { line: "NOT_DECIDED", refusal: "CASE_NOT_DECIDED", already: null };
  if (!entry.correctionRequired) return { line: "NO_CORRECTION", refusal: "CORRECTION_NOT_REQUIRED", already: null };
  const already = correctedUnderDecision(state, record.reference, caseRef, entry.decidedAt);
  if (already !== null) return { line: "ALREADY_RECORDED", refusal: "CORRECTION_ALREADY_RECORDED", already };
  return { line: "DECIDED_CORRECTION", refusal: null, already: null };
}

/** Where SCR-VER-15 draws a refusal of a correction beside its field; the rest in the header. */
const CORRECTION_BESIDE: Readonly<Partial<Record<RefusalCode, NonNullable<RecordCorrection["fieldRefusal"]>["field"]>>> = {
  OUTCOME_NOT_SUPPORTED: "outcome",
  RECORD_NOT_CURRENT_AT_INSPECTION: "outcome",
  OUTCOME_CONTRADICTS_FINDING: "outcome",
  PENALTY_ROUTE_NOT_IN_FORCE: "outcome",
  GUIDANCE_MISSING: "guidance",
  REFERRAL_NOTE_MISSING: "referralNote",
  NOTE_REQUIRED: "findings",
  FOLLOW_UP_DATE_INVALID: "followUp",
  CASE_NOT_FOR_RECORD: "case",
};

/** SCR-VER-15: the version in force, the case's answer, and the correction as the form holds it. */
export function correctionOf(
  sessionId: string,
  reference: string,
  caseRef: string | null,
  attempt: CorrectionAttempt | null,
  locale: Locale,
): LoadOutcome<RecordCorrection> {
  const state = tables(sessionId);
  const record = state.records.get(reference.toUpperCase());
  if (record === undefined) return refused("RECORD_NOT_FOUND");
  const issuing = issuingAppointment(state, personOf(sessionId), record);
  const named = attempt?.draft.caseRef ?? caseRef ?? correctionDue(sessionId, state, record)?.case ?? "";
  const checked = caseCheck(sessionId, state, record, named);
  const standing = issuing === null ? "NOT_ISSUING_AUTHORITY" : barOf(admission(state, issuing.id), "admits");
  const sentRefusal = attempt?.refusal ?? null;
  const beside = sentRefusal === null ? undefined : CORRECTION_BESIDE[sentRefusal];
  const draft: CorrectionDraft = attempt?.draft ?? {
    caseRef: named,
    outcome: record.outcome,
    findings: record.findings.map((finding) => ({ kind: finding.kind, note: text(finding.note, locale) ?? "" })),
    guidance: text(record.guidance, locale) ?? "",
    route: record.referral?.route ?? "CASE_FOLLOW_UP",
    referralNote: record.referral?.note ?? "",
    followUp: record.followUp,
    followUpBy: record.followUpBy ?? "",
    reason: "",
  };
  return ok({
    record: recordDetail(sessionId, state, record, locale),
    caseLine: checked.line,
    refusal: standing ?? (sentRefusal !== null && beside === undefined ? sentRefusal : checked.refusal),
    already: checked.already === null ? null : { version: checked.already.version, issuedAt: checked.already.issuedAt },
    draft,
    fieldRefusal: sentRefusal !== null && beside !== undefined ? { field: beside, code: sentRefusal } : null,
  });
}

/**
 * POST /inspection-records/{ref}/corrections in the contract's order: DR-740 rows 1 to 3 for the person's
 * appointment of the issuing authority, the record, the authority, DR-747 rows 1 to 5, DR-741 on the corrected
 * content, a finding's note, the follow-up's date, and last a correction that newly refers the premises for case
 * follow-up, for which CAS opens a case (CASE_INTAKE_UNAVAILABLE where it cannot). Issued, version n+1 is ISSUED,
 * citing the answers the record cited, with its delivery PENDING and raised to the party through COM, and the version
 * in force is SUPERSEDED, kept readable.
 */
export function correctRecord(sessionId: string, inspectorName: string, reference: string, draft: CorrectionDraft): Refused<{ record: string; version: number }> {
  const state = tables(sessionId);
  const person = personOf(sessionId);
  const record = state.records.get(reference.toUpperCase());
  if (record === undefined) return refused("RECORD_NOT_FOUND");
  const issuing = issuingAppointment(state, person, record);
  if (issuing === null) return refused("NOT_ISSUING_AUTHORITY");
  const bar = barOf(admission(state, issuing.id), "admits");
  if (bar !== null) return refused(bar);
  const checked = caseCheck(sessionId, state, record, draft.caseRef);
  if (draft.caseRef === "") return refused("FORM_INCOMPLETE");
  if (checked.refusal !== null) return refused(checked.refusal, checked.already === null ? null : String(checked.already.version));
  const { outcome } = draft;
  if (outcome === null || draft.reason === "" || draft.reason.length > REASON_MAX) return refused("FORM_INCOMPLETE");
  const findings = draft.findings.filter((finding): finding is { kind: FindingKind; note: string } => finding.kind !== null);
  const supports = record.verified.some((cited) => cited.channel === "OFFLINE_UPLOAD" || CURRENT_STATES.includes(cited.state));
  const cer: { observed: ReturnType<typeof recordAt> | null } = { observed: null };
  const readObserved = () => (cer.observed = recordAt(sessionId, state, record.premises, record.inspectedAt));
  const ruled = outcomeRefusal(outcome, supports, readObserved, findings.map((finding) => finding.kind), draft);
  if (ruled !== null) return refused(ruled.code, ruled.detail);
  if (findings.some((finding) => NOTE_REQUIRED_FOR.has(finding.kind) && finding.note === "")) return refused("NOTE_REQUIRED");
  const first = versionsOf(state, record.reference)[0] ?? record;
  const followUpBy = draft.followUp === "NONE" ? null : parseDay(draft.followUpBy);
  if (draft.followUp !== "NONE" && (followUpBy === null || followUpBy < addDays(first.issuedAt, 0))) return refused("FOLLOW_UP_DATE_INVALID");
  const byCase = (outcome === "REFERRED" && draft.route === "CASE_FOLLOW_UP") || draft.followUp === "CASE";
  const note = outcome === "REFERRED" ? draft.referralNote : outcome === "GUIDANCE_GIVEN" ? draft.guidance : "";
  const inspection = {
    premises: record.premises,
    appointment: record.appointment,
    reference: [...state.inspections.values()].find((entry) => entry.record === record.reference)?.reference ?? record.reference,
    observedAt: record.inspectedAt,
  };
  const referralCase = byCase ? (record.referralCase ?? openReferralCase(sessionId, state, inspection, { reference: record.reference, version: record.version + 1, outcome }, note)) : null;
  if (byCase && referralCase === null) return refused("CASE_INTAKE_UNAVAILABLE");

  const issuedAt = now();
  const content = {
    ...record,
    version: record.version + 1,
    issuedAt,
    inspector: { name: inspectorName, card: issuing.card ?? INSPECTOR_CARD },
    outcome,
    findings: findings.map(({ kind, note }) => ({ kind, note: note === "" ? null : note })),
    followUp: draft.followUp,
    followUpBy,
    guidance: outcome === "GUIDANCE_GIVEN" ? draft.guidance : null,
    referral: outcome === "REFERRED" ? { route: draft.route, note: draft.referralNote } : null,
    referralCase,
    recordStateAtObservation: cer.observed?.current ?? record.recordStateAtObservation,
    correctedUnderCase: draft.caseRef,
    correctionReason: draft.reason,
  };
  const corrected: StoredRecord = { ...content, digest: digestOf({ ...content, delivery: null }), delivery: pendingDelivery(issuedAt) };
  state.history.set(record.reference, [...(state.history.get(record.reference) ?? []), { ...record, supersededAt: issuedAt }]);
  state.records.set(record.reference, corrected);
  raiseRecordNotice(sessionId, state, corrected);
  return ok({ record: corrected.reference, version: corrected.version });
}

// ------------------------------------------------------------------ the oversight console (SCR-VER-16)

const ZERO: OversightCounts = { open: 0, concluded: 0, abandoned: 0, compliant: 0, nothingFound: 0, guidance: 0, referred: 0, undelivered: 0 };
const OUTCOME_COUNT: Readonly<Record<Outcome, keyof OversightCounts>> = {
  COMPLIANT: "compliant",
  NOTHING_FOUND: "nothingFound",
  GUIDANCE_GIVEN: "guidance",
  REFERRED: "referred",
};

function oversightSupply(state: InspectionTables, supply: StoredSupply, requesterShown: boolean): OversightSupply {
  return {
    reference: supply.reference,
    authorityCode: authorityCodeOf(state, supply.appointment),
    kind: supply.kind,
    state: supply.state,
    generatedAt: supply.generatedAt,
    listed: supply.state === "READY" || supply.state === "DISPOSED" ? (supply.counts?.listed ?? null) : null,
    requester: requesterShown ? supply.requester : null,
  };
}

/** The counts of one month per authority: the board's baseline, then the world's inspections and records of the month. */
function countsOf(state: InspectionTables, period: string): Map<string, OversightCounts> {
  const out = new Map<string, OversightCounts>();
  const bump = (authority: string | undefined, field: keyof OversightCounts) => {
    if (authority === undefined) return;
    const counts = out.get(authority) ?? { ...ZERO };
    counts[field] += 1;
    out.set(authority, counts);
  };
  for (const row of OVERSIGHT_BASELINE) {
    if (row.month !== period) continue;
    const counts = out.get(row.authority) ?? { ...ZERO };
    for (const field of Object.keys(ZERO) as (keyof OversightCounts)[]) counts[field] += row.counts[field];
    out.set(row.authority, counts);
  }
  for (const inspection of state.inspections.values()) {
    if (monthOf(inspection.observedAt) !== period || inspection.state === "CONCLUDED") continue;
    bump(state.appointments.get(inspection.appointment)?.authority, inspection.state === "OPEN" ? "open" : "abandoned");
  }
  const at = now();
  for (const record of state.records.values()) {
    if (monthOf(record.inspectedAt) !== period) continue;
    const authority = state.appointments.get(record.appointment)?.authority;
    bump(authority, "concluded");
    bump(authority, OUTCOME_COUNT[record.outcome]);
    if (record.delivery.state === "UNDELIVERED" || (record.delivery.state === "PENDING" && ms(record.delivery.dueBy) < ms(at))) bump(authority, "undelivered");
  }
  return out;
}

/**
 * SCR-VER-16: GET /inspection-lists and GET /inspections with counts over a month, per authority, with no list
 * entry and no person but, for ACT-AUD, who requested a supply; and one supply's header (GET /inspection-lists/{id}).
 * With no month named, the latest month anything was supplied or inspected.
 */
export function oversightOf(
  key: string,
  staff: StaffActor,
  period: string | null,
  authority: string | null,
  supplyRef: string | null,
): LoadOutcome<InspectionOversight> {
  const state = tables(key);
  const requesterShown = holdsRole(staff, "ACT-AUD");
  const current = monthOf(now());
  const active = new Set<string>([
    ...[...state.supplies.values()].map((supply) => monthOf(supply.requestedAt ?? supply.generatedAt ?? now())),
    ...[...state.inspections.values()].map((inspection) => monthOf(inspection.observedAt)),
    ...[...state.records.values()].map((record) => monthOf(record.inspectedAt)),
    ...OVERSIGHT_BASELINE.map((row) => row.month),
  ]);
  const periods = [...new Set([current, ...active])].filter((month) => month <= current).sort().reverse();
  const chosen = period !== null && periods.includes(period) ? period : ([...active].filter((month) => month <= current).sort().at(-1) ?? current);
  const designations = [...state.designations.values()].filter((designation) => designation.state !== "PENDING_APPROVAL").sort((a, b) => a.code.localeCompare(b.code));
  const scoped = authority !== null && state.designations.has(authority) ? authority : null;
  const ofAuthority = (appointmentId: string) => scoped === null || state.appointments.get(appointmentId)?.authority === scoped;
  const sortKey = (supply: StoredSupply) => ms(supply.requestedAt ?? supply.generatedAt ?? "1970-01-01T00:00:00Z");
  const supplies = [...state.supplies.values()]
    .filter((supply) => monthOf(supply.requestedAt ?? supply.generatedAt ?? now()) === chosen && ofAuthority(supply.appointment))
    .sort((a, b) => sortKey(b) - sortKey(a));
  const counts = countsOf(state, chosen);
  const opened = supplyRef === null ? undefined : state.supplies.get(supplyRef);
  const openedDesignation = opened === undefined ? null : authorityOf(state, opened.appointment);
  return ok({
    asOf: now(),
    period: chosen,
    periods,
    authority: scoped,
    authorities: designations.map((designation) => ({ id: designation.id, code: designation.code, name: designation.name })),
    supplies: supplies.map((supply) => oversightSupply(state, supply, requesterShown)),
    counts: designations
      .filter((designation) => (scoped === null || designation.id === scoped) && counts.has(designation.id))
      .map((designation): OversightCountsRow => ({ authorityCode: designation.code, ...(counts.get(designation.id) ?? ZERO) })),
    requesterShown,
    opened:
      opened === undefined
        ? null
        : {
            supply: oversightSupply(state, opened, requesterShown),
            authority: openedDesignation === null ? opened.appointment : authorityName(openedDesignation),
            areas: opened.areas,
            register:
              opened.register === null
                ? null
                : { ...opened.register, reconciledDaysAgo: opened.register.reconciledAt === null ? 0 : daysFrom(opened.register.reconciledAt, opened.register.readAt) },
            byArea: opened.counts?.byArea ?? [],
          },
    openedRefusal: supplyRef !== null && opened === undefined ? "SUPPLY_NOT_FOUND" : null,
  });
}

// ------------------------------------------------------------------ for the case console (CAS)

/**
 * A record's versions as VER holds them, with the case each was corrected under: what CAS reads to know a record
 * names a case from its own side (SCR-CAS-10's "Names the case"). Null when VER holds no record by that reference.
 */
export function recordVersions(key: string, reference: string): readonly { version: number; issuedAt: string; correctedUnderCase: string | null }[] | null {
  const state = tables(key);
  if (!state.records.has(reference.trim().toUpperCase())) return null;
  return versionsOf(state, reference.trim().toUpperCase()).map((version) => ({ version: version.version, issuedAt: version.issuedAt, correctedUnderCase: version.correctedUnderCase }));
}

/**
 * What a challenge copied of its subject when CAS opened its case (`ALG-717` step 6, FR-VER-008): the answer as it
 * was shown, or the record version as issued, for the case console to read beside the grounds. Null when no challenge
 * of VER opened the case, or one of the seed whose snapshot the canvas does not draw.
 */
export function challengeSnapshotFor(key: string, caseRef: string): { subjectKind: "ANSWER" | "INSPECTION_RECORD"; subjectRef: string; snapshot: ChallengeSnapshot } | null {
  const challenge = tables(key).challenges.find((entry) => entry.caseRef === caseRef.trim().toUpperCase());
  return challenge === undefined || challenge.snapshot === null ? null : { subjectKind: challenge.subjectKind, subjectRef: challenge.subjectRef, snapshot: challenge.snapshot };
}

/**
 * The premises an inspection record or a stored verification answer is about, by the id PTY is asked about it with
 * (the portal's, or the register record): CAS reads it for a case raised on the record or the answer, so a delegate
 * acts on the case only within her delegation. An answer that names no premises is about the one its challenge named
 * (DR-745 row 2). Null for a reference that names neither, or an answer about no premises nobody challenged.
 */
export function subjectPremisesOf(key: string, reference: string): string | null {
  const state = tables(key);
  const ref = reference.trim().toUpperCase();
  const challenged = () => state.challenges.find((challenge) => challenge.subjectRef === ref)?.premises ?? null;
  const premises = ref.startsWith("IRC-") ? (state.records.get(ref)?.premises ?? null) : ref.startsWith("VRA-") ? (answerOf(key, state, ref)?.premises ?? challenged()) : null;
  return premises === null ? null : (partyOf(premises)?.portalId ?? premisesOf(state, premises)?.reference ?? premises);
}
