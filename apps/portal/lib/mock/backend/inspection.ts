import { createHash } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import {
  FINDING_KINDS,
  LIST_KINDS,
  PURPOSES,
  resultKey,
  type Acknowledgement,
  type AnswerOutcome,
  type Appointment,
  type AttachedAnswerResult,
  type Conclusion,
  type ConclusionAttempt,
  type ConclusionDraft,
  type FailedResult,
  type FieldDevice,
  type FieldHome,
  type Finding,
  type FindingKind,
  type FollowUpKind,
  type HandoverAttempt,
  type IdentifierType,
  type InspectionAttempt,
  type InspectionInProgress,
  type InspectionLists,
  type InspectionOpening,
  type InspectionRecord,
  type InspectionStart,
  type ListAttempt,
  type ListKind,
  type ListSupply,
  type Outcome,
  type PremisesName,
  type Purpose,
  type ReferralRoute,
  type RefusalCode,
  type RegisterRead,
  type RepresentativeRole,
  type ScanAndVerify,
  type ScanAttempt,
  type StartAttempt,
  type SupplyCounts,
  type SupplyEntry,
  type SupplyState,
  type UploadedResult,
  type VerificationAnswer,
  type VerificationRequest,
  type WaitingResult,
} from "@/lib/api/inspection";
import type { Locale } from "@/lib/i18n/translate";
import {
  APPOINTMENTS,
  CANVAS_ANSWERS,
  CANVAS_DEVICE,
  CANVAS_INSPECTIONS,
  CANVAS_PREMISES,
  CANVAS_RECORDS,
  CANVAS_REGISTER,
  CANVAS_STATUS_RECORDS,
  CANVAS_SUPPLIES,
  INSPECTOR_CARD,
  type CanvasConclusionDraft,
  type CanvasPremises,
  type CanvasStatusRecord,
  type Localised,
} from "@/lib/mock/inspection";
import { addDays, now, today } from "./clock";
import { reference as newReference } from "./ids";
import { table } from "./store";

/**
 * VER's behaviour for the inspector, played by the mock backend for one signed-in session: the answers the
 * inspector's verifications store, the inspections opened from them with their findings, the records issued
 * when they are concluded and their handover, and the list supplies the console requests. Commands are named
 * after the API's operations (`srs/02-api-contracts.md`), check what the API checks in the order it checks
 * it, and refuse with the codes of `design/04-refusal-codes.md`.
 *
 * Behind VER the API reads other services: CER for the status records, PTY for the premises register, CAS for
 * a case follow-up. The mock reads the canvas's register (`CANVAS_PREMISES`, `CANVAS_STATUS_RECORDS`) for the
 * first two and has no case service, so a conclusion that would open a case is answered as the API answers
 * while CAS cannot take it (CASE_INTAKE_UNAVAILABLE), and the inspection stays open.
 *
 * The phone's own store (its keys, the results it checked offline, the authority chosen on the home screen) is
 * kept here too, per session, since the web stand-in for the field client has no store of its own.
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
/** The finding kinds that need a note (design/03 SCR-VER-04). */
const NOTE_REQUIRED_FOR: ReadonlySet<FindingKind> = new Set<FindingKind>(["OTHER", "RECORD_SCOPE_EXCEEDED", "EXTERNAL_LICENCE_PRESENTED"]);

// ------------------------------------------------------------------ the table

/** Text the canvas wrote in the reader's language, or what a person typed. */
type Text = string | Localised;

interface StoredAnswer {
  reference: string;
  appointment: string;
  channel: "ONLINE" | "OFFLINE_UPLOAD";
  answeredAt: string;
  /** The premises the answer is about, by its key in the register; null where it names none. */
  premises: string | null;
  outcome: AnswerOutcome;
  /** The inspection it was verified from, and whether it was attached there. */
  inspection: { reference: string; attached: boolean } | null;
  attachRefusal: RefusalCode | null;
}

interface StoredInspection {
  reference: string;
  premises: string;
  appointment: string;
  purpose: Purpose | null;
  basis: string | null;
  observedAt: string;
  openedAt: string;
  delayReason: string | null;
  /** The canvas's own reading of the recording interval for an inspection of the seed; null: the rule decides. */
  seedLate: boolean | null;
  state: "OPEN" | "CONCLUDED" | "ABANDONED";
  attached: { answer: string; readAt: string }[];
  findings: { kind: FindingKind; note: Text | null; recordedAt: string }[];
  record: string | null;
  abandonment: { reason: string; at: string } | null;
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
  inspector: { name: string; card: string };
  outcome: Outcome;
  /** The attached answer in force the record rests on. */
  answer: string | null;
  findings: { kind: FindingKind; note: Text | null }[];
  representativeRole: RepresentativeRole | null;
  acknowledgement: Acknowledgement;
  followUp: FollowUpKind;
  followUpBy: string | null;
  guidance: string | null;
  referral: { route: ReferralRoute; note: string } | null;
  statement: string | null;
  delayReason: string | null;
  correctedUnderCase: string | null;
  digest: string;
  delivery: { state: "PENDING" | "HANDED_OVER"; dueBy: string; handedOverAt: string | null; recipient: RepresentativeRole | null };
}

interface StoredSupply {
  reference: string;
  kind: ListKind;
  state: SupplyState;
  appointment: string;
  areas: readonly string[];
  requestedAt: string | null;
  generatedAt: string | null;
  failure: RefusalCode | null;
  /** The register as it was read at generation; its age is said from now. */
  register: Omit<RegisterRead, "reconciledDaysAgo"> | null;
  counts: SupplyCounts | null;
  entries: readonly SupplyEntry[];
}

/** The phone's store: its keys, the authority chosen, the answer carried into a start, the offline results. */
interface Device {
  keysRefreshedAt: string;
  keysUntil: string;
  actingFor: string | null;
  /** The answer SCR-VER-02's Inspect this premises carried into SCR-VER-03 (design/03 convention 9). */
  carried: string | null;
  waiting: WaitingResult[];
  uploaded: UploadedResult[];
  failed: FailedResult[];
}

interface InspectionTables {
  device: Device;
  /** The appointment the console acts under: the one its last request named. */
  consoleActingFor: string;
  answers: Map<string, StoredAnswer>;
  inspections: Map<string, StoredInspection>;
  records: Map<string, StoredRecord>;
  supplies: Map<string, StoredSupply>;
}

/**
 * The seed, from the canvas. The phone refreshes its keys on every connection (srs/10, Key refresh), so a
 * sign-in starts with keys refreshed at that moment; everything else keeps the canvas's own moments.
 */
function seed(): InspectionTables {
  const at = now();
  const answers = new Map<string, StoredAnswer>(
    CANVAS_ANSWERS.map((answer) => [answer.reference, { ...answer, inspection: null, attachRefusal: null }]),
  );
  const inspections = new Map<string, StoredInspection>(
    CANVAS_INSPECTIONS.map((inspection) => [
      inspection.reference,
      {
        reference: inspection.reference,
        premises: inspection.premises,
        appointment: inspection.appointment,
        purpose: inspection.purpose,
        basis: null,
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
        inspector: { name: record.inspector, card: INSPECTOR_CARD },
        outcome: record.outcome,
        answer: record.answer,
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
        digest: record.digest,
        delivery: { state: "PENDING", dueBy: record.dueBy, handedOverAt: null, recipient: null },
      },
    ]),
  );
  const supplies = new Map<string, StoredSupply>(
    CANVAS_SUPPLIES.map(({ supply, ...rest }) => [
      supply.reference,
      {
        reference: supply.reference,
        kind: supply.kind,
        state: supply.state,
        appointment: rest.appointment,
        areas: rest.areas,
        requestedAt: rest.requestedAt,
        generatedAt: supply.generatedAt,
        failure: supply.failure,
        register: rest.register,
        counts: rest.counts,
        entries: rest.entries,
      },
    ]),
  );
  return {
    device: {
      keysRefreshedAt: at,
      keysUntil: addDays(at, KEY_AGE_DAYS),
      actingFor: CANVAS_DEVICE.actingFor,
      carried: null,
      waiting: CANVAS_DEVICE.waiting.map((row) => ({ ...row })),
      uploaded: CANVAS_DEVICE.uploaded.map((row) => ({ ...row })),
      failed: CANVAS_DEVICE.failed.map((row) => ({ ...row })),
    },
    consoleActingFor: CANVAS_DEVICE.actingFor,
    answers,
    inspections,
    records,
    supplies,
  };
}

const tables = (sessionId: string): InspectionTables => table(sessionId, "inspection", seed);

// ------------------------------------------------------------------ answers and small rules

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const accepted = (): LoadOutcome<{ accepted: true }> => ok({ accepted: true });

/** A 503 is a read RightOne could not make: trying again may pass. Every other refusal stands until something changes. */
const RETRYABLE: ReadonlySet<string> = new Set([
  "CASE_INTAKE_UNAVAILABLE",
  "CERTIFICATE_READ_UNAVAILABLE",
  "KEYS_UNAVAILABLE",
  "POLICY_READ_UNAVAILABLE",
  "PREMISES_READ_UNAVAILABLE",
]);

/**
 * Two answers that are not refusals of the API: NOTHING_CARRIED, SCR-VER-03 opened with no answer carried in;
 * FORM_INCOMPLETE, a form sent without a field it requires (the browser asks for it first), which the page
 * draws again as it was sent, with nothing recorded.
 */
type Answer = RefusalCode | "NOTHING_CARRIED" | "FORM_INCOMPLETE";

function refused<T>(code: Answer): LoadOutcome<T> {
  return { data: null, failure: { code, traceId: null, retryable: RETRYABLE.has(code) } };
}

const ms = (iso: string): number => Date.parse(iso);
/** The minute an instant falls in: a field that takes hours and minutes cannot say a second. */
const minuteOf = (iso: string): number => Math.floor(ms(iso) / 60_000) * 60_000;

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

function text(value: Text | null, locale: Locale): string | null {
  return value === null ? null : typeof value === "string" ? value : value[locale];
}

function appointmentOf(id: string): Appointment | null {
  return (
    APPOINTMENTS.inForce.find((appointment) => appointment.id === id) ??
    APPOINTMENTS.withinAllowance.find((allowance) => allowance.appointment.id === id)?.appointment ??
    null
  );
}

const inForce = (id: string): boolean => APPOINTMENTS.inForce.some((appointment) => appointment.id === id);
const allowanceUntil = (id: string): string | null => APPOINTMENTS.withinAllowance.find((allowance) => allowance.appointment.id === id)?.until ?? null;
/** The authorities the inspector acts for: in force, or within the last-day allowance. */
const mine = (id: string): boolean => appointmentOf(id) !== null;

function premisesOf(key: string | null): CanvasPremises | null {
  return key === null ? null : (CANVAS_PREMISES.find((premises) => premises.key === key) ?? null);
}

function premisesName(key: string): PremisesName {
  const premises = premisesOf(key);
  return premises === null ? { name: key, address: null } : { name: premises.name, address: premises.address };
}

function deviceOf(device: Device): FieldDevice {
  return {
    network: "online",
    verificationKey: { state: "valid", until: device.keysUntil },
    readAt: null,
    queue: { waiting: device.waiting.length, failed: device.failed.length },
  };
}

/** DR-742: recorded more than the interval after it took place, unless the canvas already read it for its seed. */
function isLate(inspection: StoredInspection, at: string = now()): boolean {
  return inspection.seedLate ?? ms(at) - ms(inspection.observedAt) > RECORDING_INTERVAL_MS;
}

/** CER's answer for a premises at an instant (DR-741 row 3): a record in force then. */
function recordInForceAt(premises: string, at: string): boolean {
  const day = addDays(at, 0);
  return CANVAS_STATUS_RECORDS.some(
    (record) =>
      record.premises === premises &&
      record.state === "IN_FORCE" &&
      ms(record.since ?? `${record.period.from}T00:00:00+07:00`) <= ms(at) &&
      day <= record.period.to,
  );
}

function attachedResult(outcome: AnswerOutcome): AttachedAnswerResult {
  if (outcome.kind === "CURRENT_RESULT") return outcome.state === "IN_FORCE" ? { kind: "IN_FORCE" } : { kind: "SUSPENDED" };
  return { kind: "NO_CURRENT_RECORD" };
}

const showsInForce = (answer: StoredAnswer | undefined): boolean => answer?.outcome.kind === "CURRENT_RESULT" && answer.outcome.state === "IN_FORCE";

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

/** A record's answer: the premises named only for a premises of the jurisdiction acted under (CFG-770). */
function currentResult(record: CanvasStatusRecord, representationCurrent: boolean, appointment: Appointment): AnswerOutcome {
  const premises = premisesOf(record.premises);
  const inJurisdiction = premises !== null && premises.area !== null && appointment.areas.includes(premises.area);
  return {
    kind: "CURRENT_RESULT",
    state: record.state,
    record: record.reference,
    premises: inJurisdiction ? { name: premises.name, address: premises.address } : null,
    stateSince: record.since,
    period: record.period,
    readAt: now(),
    representationCurrent,
    publicFieldSetReason: inJurisdiction ? null : "OUTSIDE_JURISDICTION",
  };
}

function lookUp(value: string, chosen: IdentifierType | null, appointment: Appointment): { outcome: AnswerOutcome; premises: string | null } {
  const typed = value.toUpperCase();
  const type = chosen ?? typeOf(typed);
  const form = FORMS[type];
  if (!form.pattern.test(typed)) return { outcome: { kind: "INVALID_INPUT", expectedFormat: form.format, usableTypes: [] }, premises: null };

  if (type === "PUBLIC_REFERENCE" || type === "REPRESENTATION_REFERENCE") {
    const record = CANVAS_STATUS_RECORDS.find((candidate) =>
      type === "PUBLIC_REFERENCE" ? candidate.reference === typed : candidate.printouts.includes(typed),
    );
    if (record === undefined) return { outcome: { kind: "NO_RECORD" }, premises: null };
    // A printout is current while it is the record's latest; a public reference names the record itself.
    const current = type === "PUBLIC_REFERENCE" || record.printouts.at(-1) === typed;
    return { outcome: currentResult(record, current, appointment), premises: record.premises };
  }

  const premises = CANVAS_PREMISES.find((candidate) => candidate.reference === typed);
  if (premises === undefined || premises.area === null || !appointment.areas.includes(premises.area)) {
    return { outcome: { kind: "NO_PREMISES_IN_JURISDICTION" }, premises: null };
  }
  // The canvas lists this premises as holding a record in force but never draws the record: CER cannot be read for it.
  if (premises.recordNotDrawn) return { outcome: { kind: "UNABLE_TO_VERIFY", cause: "SYSTEM" }, premises: premises.key };
  const records = CANVAS_STATUS_RECORDS.filter((record) => record.premises === premises.key);
  const current = records.find((record) => record.state === "IN_FORCE");
  if (current !== undefined) return { outcome: currentResult(current, true, appointment), premises: premises.key };
  return {
    outcome: {
      kind: "NO_CURRENT_RECORD_FOR_PREMISES",
      premises: { name: premises.name, address: premises.address },
      lastState: records.some((record) => record.state === "SUSPENDED") ? "SUSPENDED" : null,
    },
    premises: premises.key,
  };
}

/** Whether an answer names a premises of the field set an inspection can start from (design/03 SCR-VER-02). */
function inspectable(answer: StoredAnswer): boolean {
  if (answer.premises === null || answer.inspection !== null) return false;
  if (answer.outcome.kind === "NO_CURRENT_RECORD_FOR_PREMISES") return true;
  return answer.outcome.kind === "CURRENT_RESULT" && answer.outcome.premises !== null;
}

// ------------------------------------------------------------------ reads

/** GET /inspections (mine, OPEN) and the appointments, with the phone's own counts. */
export function fieldHomeOf(sessionId: string): LoadOutcome<FieldHome> {
  const { device, inspections } = tables(sessionId);
  return ok({
    device: deviceOf(device),
    appointments: APPOINTMENTS.inForce,
    actingFor: device.actingFor,
    refusal: null,
    openInspections: [...inspections.values()]
      .filter((inspection) => inspection.state === "OPEN" && mine(inspection.appointment))
      .map((inspection) => ({
        reference: inspection.reference,
        premises: premisesName(inspection.premises).name,
        authorityCode: appointmentOf(inspection.appointment)?.authorityCode ?? inspection.appointment,
        openedAt: inspection.openedAt,
        pastRecordingInterval: isLate(inspection),
        recordableUntil: allowanceUntil(inspection.appointment),
      })),
    openInspectionsRefusal: null,
    storageAtRisk: false,
    updateReady: false,
  });
}

/** The phone's keys and results, with what the last verification left to say. */
export function scanAndVerifyOf(sessionId: string, attempt: ScanAttempt | null): LoadOutcome<ScanAndVerify> {
  const { device } = tables(sessionId);
  return ok({
    device: deviceOf(device),
    refusal: attempt?.refusal ?? null,
    keysRefusal: null,
    camera: "scanning",
    scannedCode: null,
    checking: false,
    typedReference: attempt?.typed ?? "",
    inspection: attempt?.inspection ?? null,
    waiting: device.waiting,
    uploaded: device.uploaded,
    failed: device.failed,
  });
}

/** GET /verification-answers/{ref}: the stored answer exactly as it was given. */
export function verificationAnswerOf(sessionId: string, reference: string): LoadOutcome<VerificationAnswer> {
  const { device, answers } = tables(sessionId);
  const answer = answers.get(reference);
  if (answer === undefined) return refused("ANSWER_NOT_FOUND");
  return ok({
    device: deviceOf(device),
    reference: answer.reference,
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
  const { device, answers, inspections } = tables(sessionId);
  const answer = device.carried === null ? undefined : answers.get(device.carried);
  const appointment = answer === undefined ? null : appointmentOf(answer.appointment);
  if (answer === undefined || answer.premises === null || appointment === null) return refused("NOTHING_CARRIED");
  const at = now();
  const open = [...inspections.values()].find(
    (inspection) => inspection.state === "OPEN" && inspection.premises === answer.premises && inspection.appointment === answer.appointment,
  );
  const refusal = attempt?.refusal ?? null;
  const observed = attempt !== null ? parseObserved(attempt.observedOn, attempt.observedTime) : null;
  return ok({
    device: deviceOf(device),
    premises: premisesName(answer.premises),
    answer: answer.reference,
    appointment,
    openInspection: open?.reference ?? null,
    refusal: refusal !== null && !START_ANSWER_CODES.has(refusal) && refusal !== "OBSERVED_AT_IN_FUTURE" && refusal !== "DELAY_REASON_REQUIRED" ? refusal : null,
    answerRefusal: refusal !== null && START_ANSWER_CODES.has(refusal) ? refusal : null,
    pastAppointmentEnd: !inForce(answer.appointment),
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

/** GET /inspections/{id}: the inspection, its answers and findings, and the uploads about its premises not attached. */
export function inspectionOf(
  sessionId: string,
  reference: string,
  locale: Locale,
  attempt: InspectionAttempt | null,
): LoadOutcome<InspectionInProgress> {
  const { device, answers, inspections } = tables(sessionId);
  const inspection = inspections.get(reference);
  if (inspection === undefined || !mine(inspection.appointment)) return refused("INSPECTION_NOT_FOUND");
  const attachedRefs = new Set(inspection.attached.map((row) => row.answer));
  const open = inspection.state === "OPEN";
  return ok({
    device: deviceOf(device),
    reference: inspection.reference,
    premises: premisesName(inspection.premises).name,
    authorityCode: appointmentOf(inspection.appointment)?.authorityCode ?? inspection.appointment,
    purpose: inspection.purpose,
    tookPlaceAt: inspection.observedAt,
    state: inspection.state,
    record: inspection.record,
    attached: inspection.attached.map((row) => {
      const stored = answers.get(row.answer);
      return { answer: row.answer, result: stored === undefined ? { kind: "IN_FORCE" } : attachedResult(stored.outcome), readAt: row.readAt };
    }),
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
    refusal: null,
    pastAppointmentEnd: !inForce(inspection.appointment),
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
  const { device, inspections } = tables(sessionId);
  const inspection = inspections.get(reference);
  if (inspection === undefined || !mine(inspection.appointment)) return refused("INSPECTION_NOT_FOUND");
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
    device: deviceOf(device),
    inspection: inspection.reference,
    premises: premisesName(inspection.premises).name,
    tookPlaceAt: inspection.observedAt,
    lateRecording: isLate(inspection),
    refusal: open ? headerRefusal : "INSPECTION_NOT_OPEN",
    record: inspection.record,
    offlineResultWaiting: null,
    draft,
  });
}

/** GET /inspection-records/{ref}: whole for the issuing authority, the confirmation for another. */
export function inspectionRecordOf(
  sessionId: string,
  reference: string,
  locale: Locale,
  attempt: HandoverAttempt | null,
): LoadOutcome<InspectionRecord> {
  const { device, records } = tables(sessionId);
  const record = records.get(reference);
  if (record === undefined) return refused("RECORD_NOT_FOUND");
  const appointment = appointmentOf(record.appointment);
  const at = now();
  const handoverCodes: ReadonlySet<RefusalCode> = new Set<RefusalCode>(["HANDOVER_TIME_INVALID"]);
  const deliveryCodes: ReadonlySet<RefusalCode> = new Set<RefusalCode>(["ALREADY_DELIVERED", "NOT_ISSUING_AUTHORITY"]);
  const refusal = attempt?.refusal ?? null;
  return ok({
    device: deviceOf(device),
    reference: record.reference,
    version: record.version,
    premises: premisesName(record.premises),
    authority: appointment?.authority ?? record.appointment,
    issuedAt: record.issuedAt,
    outcome: record.outcome,
    // A request to reconsider is recorded by VER itself (POST /verification-challenges); none was made in the mock.
    reconsideration: "NONE",
    digest: record.digest,
    versionInForce: record.version > 1,
    whole:
      appointment === null
        ? null
        : {
            inspector: record.inspector,
            inspectedAt: record.inspectedAt,
            answer: record.answer === null ? null : { reference: record.answer, state: "IN_FORCE" },
            findings: record.findings.map((finding) => ({ kind: finding.kind, note: text(finding.note, locale) })),
            representative: { role: record.representativeRole, acknowledgement: record.acknowledgement },
            followUp: record.followUp,
            followUpBy: record.followUpBy,
            correctedUnderCase: record.correctedUnderCase,
            delivery: {
              state: record.delivery.state,
              handedOverAt: record.delivery.handedOverAt,
              dueBy: record.delivery.dueBy,
              noticeSent: false,
            },
          },
    refusal: refusal !== null && !handoverCodes.has(refusal) && !deliveryCodes.has(refusal) ? refusal : null,
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

/** CFG-777: today's supplies not FAILED, every authority of the inspector counted. */
function requestedToday(supplies: Map<string, StoredSupply>): number {
  const day = today();
  return [...supplies.values()].filter((supply) => supply.state !== "FAILED" && requestedOn(supply) === day).length;
}

/** GET /inspection-lists: the supplies of the authority the console acts under, newest first, and today's count. */
export function inspectionListsOf(sessionId: string, attempt: ListAttempt | null): LoadOutcome<InspectionLists> {
  const { consoleActingFor, supplies } = tables(sessionId);
  const authority = appointmentOf(consoleActingFor);
  if (authority === null) return refused("NO_EFFECTIVE_APPOINTMENT");
  const chosen = attempt !== null ? attempt.appointment : consoleActingFor;
  const jurisdiction = (chosen === null ? null : appointmentOf(chosen))?.areas ?? authority.areas;
  const typed = attempt?.areas ?? [];
  const count = requestedToday(supplies);
  const refusal = attempt?.refusal ?? null;
  const sortKey = (supply: StoredSupply) => ms(supply.requestedAt ?? supply.generatedAt ?? "1970-01-01T00:00:00Z");
  return ok({
    authorityCode: authority.authorityCode,
    asOf: now(),
    appointments: APPOINTMENTS.inForce,
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
        : null,
    filter: { kind: null, state: null },
    supplies: [...supplies.values()]
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
  const supply = tables(sessionId).supplies.get(reference);
  if (supply === undefined || !mine(supply.appointment)) return refused("SUPPLY_NOT_FOUND");
  const at = now();
  const register = supply.register;
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
    entries: supply.state === "READY" ? supply.entries : [],
    entriesRefusal: supply.state === "REQUESTED" ? "SUPPLY_NOT_READY" : supply.state === "DISPOSED" ? "ENTRIES_DISPOSED" : null,
    selected: null,
    refusal: null,
  });
}

// ------------------------------------------------------------------ commands: the phone

/** The authority chosen on SCR-VER-17, kept on the phone and sent with every act that names no inspection. */
export function chooseActingFor(sessionId: string, appointment: string): LoadOutcome<{ accepted: true }> {
  if (!inForce(appointment)) return refused("APPOINTMENT_REQUIRED");
  tables(sessionId).device.actingFor = appointment;
  return accepted();
}

/** GET /verification-keys: the keys are refreshed now and check codes offline for CFG-778's 7 days. */
export function refreshVerificationKeys(sessionId: string): LoadOutcome<{ accepted: true }> {
  const { device } = tables(sessionId);
  const at = now();
  device.keysRefreshedAt = at;
  device.keysUntil = addDays(at, KEY_AGE_DAYS);
  return accepted();
}

/**
 * POST /verifications/offline-results for one waiting result. The server verifies the printout's record again
 * through CER; the mock's register holds the records the canvas draws, and no record of the printouts the
 * canvas shows waiting on the phone, so CER cannot read it: CERTIFICATE_READ_UNAVAILABLE, and the result stays
 * waiting with the reason on its row, as the API leaves it (design/03 SCR-VER-01, Refused).
 */
export function uploadOfflineResult(sessionId: string, key: string): LoadOutcome<{ answer: string }> {
  const { device, answers } = tables(sessionId);
  const row = device.waiting.find((candidate) => resultKey(candidate) === key);
  if (row === undefined) return refused("ANSWER_NOT_FOUND");
  const record = CANVAS_STATUS_RECORDS.find((candidate) => candidate.printouts.includes(row.representation));
  const appointment = device.actingFor === null ? null : appointmentOf(device.actingFor);
  if (record === undefined || appointment === null) {
    row.refusal = "CERTIFICATE_READ_UNAVAILABLE";
    return refused("CERTIFICATE_READ_UNAVAILABLE");
  }
  const answer = newReference("VRA");
  answers.set(answer, {
    reference: answer,
    appointment: appointment.id,
    channel: "OFFLINE_UPLOAD",
    answeredAt: now(),
    premises: record.premises,
    outcome: currentResult(record, record.printouts.at(-1) === row.representation, appointment),
    inspection: null,
    attachRefusal: null,
  });
  device.waiting = device.waiting.filter((candidate) => candidate !== row);
  device.uploaded = [
    { answer, state: "IN_FORCE", differsFromDevice: record.state !== "IN_FORCE", checkedAt: row.checkedAt, refusal: null },
    ...device.uploaded,
  ];
  return ok({ answer });
}

/** Discard a result that could not be uploaded: the phone deletes it; RightOne never had it. */
export function discardOfflineResult(sessionId: string, key: string): LoadOutcome<{ accepted: true }> {
  const { device } = tables(sessionId);
  device.failed = device.failed.filter((row) => resultKey(row) !== key);
  return accepted();
}

/** SCR-VER-02 Inspect this premises: the answer, and with it the premises, carry into SCR-VER-03. */
export function carryAnswerIntoInspection(sessionId: string, answerRef: string): LoadOutcome<{ accepted: true }> {
  const { device, answers } = tables(sessionId);
  const answer = answers.get(answerRef);
  if (answer === undefined || !inspectable(answer)) return refused("ANSWER_NOT_FOUND");
  device.carried = answer.reference;
  return accepted();
}

// ------------------------------------------------------------------ commands: verification and inspections

/**
 * POST /verifications. Every outcome is an answer, stored with a new VRA- reference: an invalid input, no
 * record, a premises outside the jurisdiction. From an inspection the answer is attached to it when it is
 * about the inspection's premises, and stored on its own with ANSWER_NOT_FOR_PREMISES when it is about another.
 */
export function verify(sessionId: string, request: VerificationRequest): LoadOutcome<{ answer: string }> {
  const { device, answers, inspections } = tables(sessionId);
  let inspection: StoredInspection | null = null;
  let appointmentId: string | null;
  if (request.inspection !== null) {
    inspection = inspections.get(request.inspection) ?? null;
    if (inspection?.state !== "OPEN" || !mine(inspection.appointment)) return refused("INSPECTION_NOT_FOUND");
    appointmentId = inspection.appointment;
  } else {
    appointmentId = device.actingFor ?? (APPOINTMENTS.inForce.length === 1 ? (APPOINTMENTS.inForce[0]?.id ?? null) : null);
    if (appointmentId === null) return refused("APPOINTMENT_REQUIRED");
  }
  // The last-day allowance never admits a new verification (DR-740).
  const appointment = inForce(appointmentId) ? appointmentOf(appointmentId) : null;
  if (appointment === null) return refused("NO_EFFECTIVE_APPOINTMENT");

  const { outcome, premises } = lookUp(request.value.trim(), request.identifierType, appointment);
  const answer: StoredAnswer = {
    reference: newReference("VRA"),
    appointment: appointment.id,
    channel: "ONLINE",
    answeredAt: now(),
    premises,
    outcome,
    inspection: null,
    attachRefusal: null,
  };
  if (inspection !== null) {
    const about = premises === inspection.premises;
    answer.inspection = { reference: inspection.reference, attached: about };
    if (about) inspection.attached.push({ answer: answer.reference, readAt: answer.answeredAt });
    else if (premises !== null) answer.attachRefusal = "ANSWER_NOT_FOR_PREMISES";
  }
  answers.set(answer.reference, answer);
  return ok({ answer: answer.reference });
}

/**
 * POST /inspections, from the answer SCR-VER-02 carried in. Checked in the contract's order: the jurisdiction,
 * the purpose, the time it took place (DR-742), then the answer to attach. The answer is left out for Start
 * without the answer, after it was refused as the inspection's evidence.
 */
export function openInspection(sessionId: string, opening: InspectionOpening): LoadOutcome<{ inspection: string }> {
  const state = tables(sessionId);
  const answer = state.device.carried === null ? undefined : state.answers.get(state.device.carried);
  if (answer === undefined || answer.premises === null) return refused("ANSWER_NOT_FOUND");
  const appointment = appointmentOf(answer.appointment);
  const premises = premisesOf(answer.premises);
  if (appointment === null || !inForce(appointment.id)) return refused("NO_EFFECTIVE_APPOINTMENT");
  if (premises === null || premises.area === null || !appointment.areas.includes(premises.area)) return refused("OUTSIDE_JURISDICTION");
  const purpose = PURPOSES.find((candidate) => candidate === opening.purpose);
  if (purpose === undefined) return refused("PURPOSE_NOT_ADMITTED");
  const at = now();
  if (opening.observedAt === null) return refused("FORM_INCOMPLETE");
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

/** The inspection an act on it names, open; or the refusal the contract gives first. */
function openOne(sessionId: string, reference: string): StoredInspection | RefusalCode {
  const inspection = tables(sessionId).inspections.get(reference);
  if (inspection === undefined || !mine(inspection.appointment)) return "INSPECTION_NOT_FOUND";
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
  inspection.abandonment = { reason, at: now() };
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
 * POST /inspections/{id}/conclusions: DR-741 on the outcome, then the representative, the follow-up, DR-742 at
 * the conclusion instant, and last a case follow-up, which the mock cannot open (no case service): it answers
 * CASE_INTAKE_UNAVAILABLE and the inspection stays open. Issued, the record is version 1 with its delivery
 * PENDING and due CFG-774's 5 days after issue, and the inspection is CONCLUDED.
 */
export function concludeInspection(
  sessionId: string,
  inspectorName: string,
  reference: string,
  conclusion: Omit<ConclusionAttempt, "refusal" | "notSent">,
): LoadOutcome<{ record: string }> {
  const state = tables(sessionId);
  const inspection = openOne(sessionId, reference);
  if (typeof inspection === "string") return refused(inspection);
  const { outcome } = conclusion;
  if (outcome === null) return refused("FORM_INCOMPLETE");
  const findings = inspection.findings.map((finding) => finding.kind);
  const evidence = inspection.attached.map((row) => state.answers.get(row.answer));

  // DR-741, rows 1 to 8 in order.
  if (outcome === "COMPLIANT" && !evidence.some(showsInForce)) return refused("OUTCOME_NOT_SUPPORTED");
  if (outcome === "COMPLIANT" && !recordInForceAt(inspection.premises, inspection.observedAt)) return refused("RECORD_NOT_CURRENT_AT_INSPECTION");
  if ((outcome === "COMPLIANT" || outcome === "NOTHING_FOUND") && findings.includes("RECORD_SCOPE_EXCEEDED")) {
    return refused("OUTCOME_CONTRADICTS_FINDING");
  }
  if (outcome === "NOTHING_FOUND" && findings.includes("MUSIC_IN_USE") && !findings.includes("EXTERNAL_LICENCE_PRESENTED")) {
    return refused("OUTCOME_CONTRADICTS_FINDING");
  }
  if (outcome === "GUIDANCE_GIVEN" && conclusion.guidance === "") return refused("GUIDANCE_MISSING");
  if (outcome === "REFERRED" && conclusion.route === "PENALTY_ROUTE") return refused("PENALTY_ROUTE_NOT_IN_FORCE");
  if (outcome === "REFERRED" && conclusion.referralNote === "") return refused("REFERRAL_NOTE_MISSING");

  const nobody = conclusion.acknowledgement === "NO_REPRESENTATIVE_PRESENT";
  if (conclusion.acknowledgement === null || (!nobody && conclusion.representativeRole === null)) return refused("REPRESENTATIVE_ROLE_MISSING");
  const followUpBy = conclusion.followUp === "NONE" ? null : parseDay(conclusion.followUpBy);
  if (conclusion.followUp !== "NONE" && (followUpBy === null || followUpBy < today())) return refused("FOLLOW_UP_DATE_INVALID");
  const delayReason = conclusion.delayReason !== "" ? conclusion.delayReason : (inspection.delayReason ?? "");
  if (isLate(inspection) && delayReason === "") return refused("DELAY_REASON_REQUIRED");
  if ((outcome === "REFERRED" && conclusion.route === "CASE_FOLLOW_UP") || conclusion.followUp === "CASE") {
    return refused("CASE_INTAKE_UNAVAILABLE");
  }

  const issuedAt = now();
  const answer = inspection.attached.find((row) => showsInForce(state.answers.get(row.answer)))?.answer ?? null;
  const content = {
    reference: newReference("IRC"),
    version: 1,
    premises: inspection.premises,
    appointment: inspection.appointment,
    issuedAt,
    inspectedAt: inspection.observedAt,
    inspector: { name: inspectorName, card: INSPECTOR_CARD },
    outcome,
    answer,
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
  };
  const record: StoredRecord = {
    ...content,
    // ALG-715 keeps the content's digest; the record shows its tail.
    digest: `…${createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(-6)}`,
    delivery: { state: "PENDING", dueBy: new Date(ms(issuedAt) + DELIVERY_DAYS * 86_400_000).toISOString(), handedOverAt: null, recipient: null },
  };
  state.records.set(record.reference, record);
  inspection.state = "CONCLUDED";
  inspection.record = record.reference;
  return ok({ record: record.reference });
}

/**
 * POST /inspection-records/{ref}/deliveries: the issuing authority records the copy handed over on site, at a
 * time after the record was issued and not later than now (to the minute the field gives).
 */
export function recordDelivery(
  sessionId: string,
  reference: string,
  handover: { handedOverAt: string | null; recipient: RepresentativeRole | null },
): LoadOutcome<{ accepted: true }> {
  const record = tables(sessionId).records.get(reference);
  if (record === undefined) return refused("RECORD_NOT_FOUND");
  if (!mine(record.appointment)) return refused("NOT_ISSUING_AUTHORITY");
  if (record.delivery.state === "HANDED_OVER") return refused("ALREADY_DELIVERED");
  const at = handover.handedOverAt;
  if (at === null || ms(at) < minuteOf(record.issuedAt) || ms(at) > ms(now())) return refused("HANDOVER_TIME_INVALID");
  if (handover.recipient === null) return refused("FORM_INCOMPLETE");
  record.delivery = { ...record.delivery, state: "HANDED_OVER", handedOverAt: at, recipient: handover.recipient };
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
 * POST /inspection-lists, then the generation job the API runs within a minute, which the mock runs at once:
 * the entries are the canvas's register entries of that kind in the areas asked for (the whole jurisdiction
 * when none is named), read from the register as the canvas's ready supply read it.
 */
export function requestInspectionList(
  sessionId: string,
  request: { appointment: string | null; kind: ListKind; areas: readonly string[] },
): LoadOutcome<{ supply: string }> {
  const state = tables(sessionId);
  const appointmentId = request.appointment ?? (APPOINTMENTS.inForce.length === 1 ? (APPOINTMENTS.inForce[0]?.id ?? null) : null);
  if (appointmentId === null) return refused("APPOINTMENT_REQUIRED");
  const appointment = inForce(appointmentId) ? appointmentOf(appointmentId) : null;
  if (appointment === null) return refused("NO_EFFECTIVE_APPOINTMENT");
  if (request.areas.some((area) => !appointment.areas.includes(area))) return refused("OUTSIDE_JURISDICTION");
  if (requestedToday(state.supplies) >= DAILY_LIST_LIMIT) return refused("LIST_SUPPLY_LIMIT_REACHED");
  const kind = LIST_KINDS.find((candidate) => candidate === request.kind) ?? "NO_CURRENT_RECORD";

  const at = now();
  const areas = request.areas.length > 0 ? appointment.areas.filter((area) => request.areas.includes(area)) : appointment.areas;
  const entries = CANVAS_REGISTER.entries[kind].filter((entry) => areas.includes(entry.area));
  const supply: StoredSupply = {
    reference: newReference("ILS"),
    kind,
    state: "READY",
    appointment: appointment.id,
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
