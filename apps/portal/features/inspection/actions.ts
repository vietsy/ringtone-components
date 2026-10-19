"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  ACKNOWLEDGEMENTS,
  FINDING_KINDS,
  FOLLOW_UPS,
  IDENTIFIER_TYPES,
  LIST_KINDS,
  OUTCOMES,
  PURPOSES,
  REFERRAL_ROUTES,
  REPRESENTATIVE_ROLES,
  abandonInspection as abandonInspectionAct,
  attachAnswer,
  checkCodeOffline,
  chooseAppointment,
  discardOfflineResult,
  inspectPremises,
  isoDay,
  issueInspectionRecord,
  openInspection,
  recordFinding,
  recordHandover as recordHandoverAct,
  refreshKeys,
  requestList as requestListAct,
  requestVerification,
  scanCode,
  uploadOfflineResult,
  type ConclusionAttempt,
  type ConditionalField,
  type HandoverAttempt,
  type InspectionAttempt,
  type ListAttempt,
  type RefusalCode,
  type ScanAttempt,
  type StartAttempt,
} from "@/lib/api/inspection";
import { endSession, requireInspector } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";

/**
 * The inspector's acts. Each one asks who is signed in, calls its seam in `lib/api/inspection`, and moves on
 * to the screen the board says comes next, built from the reference the act returned. A refused act keeps what
 * was sent and its refusal for the page it came from (`keepForPage`), which draws the refusal where the act
 * was, with the values typed. A failure that is no refusal of the act (nothing configured) is our failure to
 * act, so it is thrown to the route's error boundary rather than dropped.
 */

/** What a form that shows its own failure gets back: nothing yet, or the failure's code and trace. */
export interface ActState {
  failure: { code: string; traceId: string | null } | null;
}

type Failure = { code: string; traceId: string | null } | null;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** A value of a closed set, or null for anything else (an empty choice, a value tampered with). */
function oneOf<T extends string>(values: readonly T[], value: string): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

/** The date and time a date-and-time field sends ("2026-10-14T10:20+07:00"), split as the field takes them back. */
function dateAndTime(value: string): { on: string; time: string; at: string | null } {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?\+07:00$/.exec(value);
  if (parts?.[1] === undefined || parts[2] === undefined) return { on: "", time: "", at: null };
  const at = `${parts[1]}T${parts[2]}:00+07:00`;
  return { on: parts[1], time: parts[2], at: Number.isNaN(Date.parse(at)) ? null : at };
}

/** A failure the act's page cannot draw: the seam is not configured, or the code is not one of the act's. */
function failed(act: string, failure: Failure): never {
  throw new Error(`${act} was not accepted: ${failure?.code ?? "UNKNOWN"}`);
}

/** The refusal of the act, or null where the form came back without a field it requires. */
function refusalOf(failure: Failure): RefusalCode | null {
  return failure === null || failure.code === "FORM_INCOMPLETE" ? null : (failure.code as RefusalCode);
}

/** An act changes what the inspector's other screens show; the router's copies of them are read again. */
function forgetPages(): void {
  revalidatePath(routes.field(), "layout");
  revalidatePath(routes.inspectionLists(), "layout");
}

// ------------------------------------------------------------------ SCR-VER-17

/** SCR-VER-17 Acting for: the phone keeps the authority chosen and sends it with every act that names no inspection. */
export async function chooseActingFor(form: FormData): Promise<void> {
  const { sessionId } = await requireInspector();
  await chooseAppointment(sessionId, text(form, "appointment_id"));
  forgetPages();
  redirect(routes.field());
}

/** SCR-VER-17 Open: the record the inspector typed the reference of (SCR-VER-06 says when there is none). */
export async function openRecord(_previous: ActState, form: FormData): Promise<ActState> {
  await requireInspector();
  const reference = text(form, "record_ref").toUpperCase();
  if (reference === "") return { failure: null };
  redirect(routes.fieldRecord(reference));
}

/** SCR-VER-17 Sign out: the session ends and RightOne ID's sign-in page follows (design/03 SCR-VER-17). */
export async function signOut(): Promise<void> {
  await endSession();
  redirect(routes.signIn());
}

// ------------------------------------------------------------------ SCR-VER-01

/**
 * SCR-VER-01 Verify. A reference beginning IRC- opens that record and one beginning VRA- opens that stored
 * answer (design/03 SCR-VER-01, Reference); anything else is verified, and its new answer opens on SCR-VER-02.
 * From SCR-VER-04 the answer is attached to the inspection named.
 */
export async function verifyReference(_previous: ActState, form: FormData): Promise<ActState> {
  const { sessionId } = await requireInspector();
  const typed = text(form, "value");
  const inspection = text(form, "inspection") || null;
  if (typed === "") return { failure: null };
  const prefix = typed.toUpperCase();
  if (prefix.startsWith("IRC-")) redirect(routes.fieldRecord(prefix));
  if (prefix.startsWith("VRA-")) redirect(routes.fieldAnswer(prefix));
  const outcome = await requestVerification(sessionId, {
    value: typed,
    identifierType: oneOf(IDENTIFIER_TYPES, text(form, "identifier_type")),
    inspection,
    code: null,
  });
  forgetPages();
  if (outcome.data !== null) redirect(routes.fieldAnswer(outcome.data.answer));
  if (outcome.failure?.code === "SERVICE_NOT_CONFIGURED") return { failure: outcome.failure };
  const attempt: ScanAttempt = { inspection, typed, refusal: refusalOf(outcome.failure) };
  redirect(withAttempt(routes.fieldScan(), keepForPage(attempt)));
}

/**
 * SCR-VER-01 Scan, as the web stand-in has it: the camera reads the code on the printout whose reference is typed.
 * Online the code is verified (`POST /verifications` with its payload, signature and key) and the answer opens on
 * SCR-VER-02; with Check offline ticked the phone checks it against the keys it holds (`ALG-711`), the result waits
 * to upload, and its offline answer opens on SCR-VER-02. A printout carrying no code comes back saying so.
 */
export async function scanPrintout(_previous: ActState, form: FormData): Promise<ActState> {
  const { sessionId } = await requireInspector();
  const printout = text(form, "printout").toUpperCase();
  const inspection = text(form, "inspection") || null;
  if (printout === "") return { failure: null };
  const read = await scanCode(sessionId, printout);
  if (read.data === null) {
    if (read.failure?.code !== "NO_CODE_READ") return { failure: read.failure };
    const attempt: ScanAttempt = { inspection, typed: "", refusal: null, scan: { printout, noCode: true } };
    redirect(withAttempt(routes.fieldScan(), keepForPage(attempt)));
  }
  if (form.get("offline") === "on") {
    const checked = await checkCodeOffline(sessionId, { printout, code: read.data, inspection });
    forgetPages();
    if (checked.data !== null) redirect(routes.fieldAnswer(checked.data.result));
    if (checked.failure?.code === "SERVICE_NOT_CONFIGURED") return { failure: checked.failure };
    const attempt: ScanAttempt = { inspection, typed: "", refusal: refusalOf(checked.failure), scan: { printout, noCode: false } };
    redirect(withAttempt(routes.fieldScan(), keepForPage(attempt)));
  }
  const outcome = await requestVerification(sessionId, { value: printout, identifierType: "REPRESENTATION_REFERENCE", inspection, code: read.data });
  forgetPages();
  if (outcome.data !== null) redirect(routes.fieldAnswer(outcome.data.answer));
  if (outcome.failure?.code === "SERVICE_NOT_CONFIGURED") return { failure: outcome.failure };
  const attempt: ScanAttempt = { inspection, typed: "", refusal: refusalOf(outcome.failure), scan: { printout, noCode: false } };
  redirect(withAttempt(routes.fieldScan(), keepForPage(attempt)));
}

/**
 * SCR-VER-01 Refresh keys: the strip's date moves to the new key set's; KEYS_UNAVAILABLE comes back beside the keys,
 * which the phone keeps with their earlier instant.
 */
export async function refreshVerificationKeys(): Promise<void> {
  const { sessionId } = await requireInspector();
  const outcome = await refreshKeys(sessionId);
  forgetPages();
  if (outcome.failure?.code === "KEYS_UNAVAILABLE") {
    const attempt: ScanAttempt = { inspection: null, typed: "", refusal: "KEYS_UNAVAILABLE" };
    redirect(withAttempt(routes.fieldScan(), keepForPage(attempt)));
  }
  redirect(routes.fieldScan());
}

/** SCR-VER-01 Upload now, for one waiting result: it moves to Uploaded, or stays waiting with its reason. */
export async function uploadResult(key: string): Promise<void> {
  const { sessionId } = await requireInspector();
  await uploadOfflineResult(sessionId, key);
  forgetPages();
  redirect(routes.fieldScan());
}

/** SCR-VER-01 Discard, after its confirmation: the result leaves the phone. */
export async function discardResult(key: string): Promise<void> {
  const { sessionId } = await requireInspector();
  await discardOfflineResult(sessionId, key);
  forgetPages();
  redirect(routes.fieldScan());
}

// ------------------------------------------------------------------ SCR-VER-02 and SCR-VER-03

/** SCR-VER-02 Inspect this premises: the premises and the answer carry into SCR-VER-03. */
export async function inspectThisPremises(answer: string): Promise<void> {
  const { sessionId } = await requireInspector();
  const outcome = await inspectPremises(sessionId, answer);
  if (outcome.data === null) redirect(routes.fieldAnswer(answer));
  redirect(routes.fieldStartInspection());
}

/**
 * SCR-VER-03 Start, Start without the answer, and Continue the open inspection, by the button pressed. Continue
 * attaches the answer to the inspection already open and opens it whether or not the answer could be attached
 * (design/03 SCR-VER-03, Actions); Start opens a new inspection on SCR-VER-04.
 */
export async function startInspection(form: FormData): Promise<void> {
  const { sessionId } = await requireInspector();
  const intent = text(form, "intent");
  if (intent === "continue") {
    const open = text(form, "open_inspection");
    await attachAnswer(sessionId, open, text(form, "answer"));
    forgetPages();
    redirect(routes.fieldInspection(open));
  }
  const observed = dateAndTime(text(form, "observed_at"));
  const sent = {
    purpose: oneOf(PURPOSES, text(form, "purpose")) ?? "ROUTINE",
    basis: text(form, "inspection_basis_ref"),
    delayReason: text(form, "delay_reason"),
  };
  const outcome = await openInspection(sessionId, {
    withAnswer: intent !== "without",
    // The field client says where it took place as the register address, the one context CFG-772 permits.
    locationContext: text(form, "location_context"),
    purpose: text(form, "purpose"),
    basis: sent.basis,
    observedAt: observed.at,
    delayReason: sent.delayReason,
  });
  forgetPages();
  if (outcome.data !== null) redirect(routes.fieldInspection(outcome.data.inspection));
  if (outcome.failure?.code === "NOTHING_CARRIED" || outcome.failure?.code === "ANSWER_NOT_FOUND") redirect(routes.fieldScan());
  if (outcome.failure?.code === "SERVICE_NOT_CONFIGURED") failed("Opening the inspection", outcome.failure);
  const attempt: StartAttempt = { ...sent, observedOn: observed.on, observedTime: observed.time, refusal: refusalOf(outcome.failure) };
  redirect(withAttempt(routes.fieldStartInspection(), keepForPage(attempt)));
}

// ------------------------------------------------------------------ SCR-VER-04

function backToInspection(inspection: string, attempt: InspectionAttempt): never {
  redirect(withAttempt(routes.fieldInspection(inspection), keepForPage(attempt)));
}

/** SCR-VER-04 Verify the record: SCR-VER-01 opens with the inspection named, so the answer attaches to it. */
export async function verifyForInspection(inspection: string): Promise<void> {
  await requireInspector();
  const context: ScanAttempt = { inspection, typed: "", refusal: null };
  redirect(withAttempt(routes.fieldScan(), keepForPage(context)));
}

/** SCR-VER-04 Add a finding; the inspection reads again with it, or with the note's refusal beside the note. */
export async function addFinding(inspection: string, form: FormData): Promise<void> {
  const { sessionId } = await requireInspector();
  const finding = { kind: oneOf(FINDING_KINDS, text(form, "finding_kind")), note: text(form, "note") };
  const outcome = await recordFinding(sessionId, inspection, finding);
  forgetPages();
  if (outcome.data === null) {
    if (outcome.failure?.code === "SERVICE_NOT_CONFIGURED") failed("Adding the finding", outcome.failure);
    backToInspection(inspection, { act: "finding", ...finding, refusal: refusalOf(outcome.failure) });
  }
  redirect(routes.fieldInspection(inspection));
}

/** SCR-VER-04 Attach, for an answer uploaded about the premises; the row moves, or says why it cannot. */
export async function attachToInspection(inspection: string, answer: string): Promise<void> {
  const { sessionId } = await requireInspector();
  const outcome = await attachAnswer(sessionId, inspection, answer);
  forgetPages();
  if (outcome.data === null) {
    const refusal = refusalOf(outcome.failure);
    if (refusal === null) failed("Attaching the answer", outcome.failure);
    backToInspection(inspection, { act: "attach", answer, refusal });
  }
  redirect(routes.fieldInspection(inspection));
}

/** SCR-VER-04 Abandon, with the inspector's reason; back to the field client's home, or the refusal in the dialog. */
export async function abandonInspection(inspection: string, form: FormData): Promise<void> {
  const { sessionId } = await requireInspector();
  const reason = text(form, "reason");
  const outcome = await abandonInspectionAct(sessionId, inspection, reason);
  forgetPages();
  if (outcome.data === null) {
    const refusal = refusalOf(outcome.failure);
    if (refusal === null) failed("Abandoning the inspection", outcome.failure);
    backToInspection(inspection, { act: "abandon", reason, refusal });
  }
  redirect(routes.field());
}

// ------------------------------------------------------------------ SCR-VER-05 and SCR-VER-06

/** SCR-VER-05 Issue the record, once confirmed: the record opens on SCR-VER-06, or the form with its refusal. */
export async function issueRecord(inspection: string, form: FormData): Promise<void> {
  const { sessionId, account } = await requireInspector();
  const fields: Readonly<Record<ConditionalField, string>> = {
    guidance: "guidance_text",
    route: "referral_route",
    referralNote: "referral_note",
    delayReason: "delay_reason",
    followUpBy: "follow_up_by",
  };
  const conclusion: Omit<ConclusionAttempt, "refusal"> = {
    notSent: (Object.keys(fields) as ConditionalField[]).filter((field) => !form.has(fields[field])),
    outcome: oneOf(OUTCOMES, text(form, "outcome")),
    guidance: text(form, "guidance_text"),
    route: oneOf(REFERRAL_ROUTES, text(form, "referral_route")) ?? "CASE_FOLLOW_UP",
    referralNote: text(form, "referral_note"),
    representativeRole: oneOf(REPRESENTATIVE_ROLES, text(form, "representative_role")),
    acknowledgement: oneOf(ACKNOWLEDGEMENTS, text(form, "acknowledgement")),
    statement: text(form, "party_statement"),
    delayReason: text(form, "delay_reason"),
    followUp: oneOf(FOLLOW_UPS, text(form, "follow_up_kind")) ?? "NONE",
    followUpBy: isoDay(text(form, "follow_up_by")) ?? "",
  };
  const outcome = await issueInspectionRecord(sessionId, account, inspection, conclusion);
  forgetPages();
  if (outcome.data !== null) redirect(routes.fieldRecord(outcome.data.record));
  if (outcome.failure?.code === "SERVICE_NOT_CONFIGURED") failed("Issuing the record", outcome.failure);
  const attempt: ConclusionAttempt = { ...conclusion, refusal: refusalOf(outcome.failure) };
  redirect(withAttempt(routes.fieldConclude(inspection), keepForPage(attempt)));
}

/** SCR-VER-06 Record handover; the record reads again with its delivery, or with the refusal beside the handover. */
export async function recordHandover(record: string, form: FormData): Promise<void> {
  const { sessionId } = await requireInspector();
  const handed = dateAndTime(text(form, "handed_over_at"));
  const recipient = oneOf(REPRESENTATIVE_ROLES, text(form, "recipient_role"));
  const outcome = await recordHandoverAct(sessionId, record, { handedOverAt: handed.at, recipient });
  forgetPages();
  if (outcome.data !== null) redirect(routes.fieldRecord(record));
  if (outcome.failure?.code === "SERVICE_NOT_CONFIGURED") failed("Recording the handover", outcome.failure);
  const attempt: HandoverAttempt = { on: handed.on, time: handed.time, recipient, refusal: refusalOf(outcome.failure) };
  redirect(withAttempt(routes.fieldRecord(record), keepForPage(attempt)));
}

// ------------------------------------------------------------------ SCR-VER-07

/** SCR-VER-07 Request the list: the new supply opens on SCR-VER-08, or the request comes back with its refusal. */
export async function requestList(form: FormData): Promise<void> {
  const { sessionId } = await requireInspector();
  const request = {
    appointment: text(form, "appointment_id") || null,
    kind: oneOf(LIST_KINDS, text(form, "list_kind")) ?? "NO_CURRENT_RECORD",
    areas: form.getAll("areas").filter((value): value is string => typeof value === "string" && value !== ""),
  };
  const outcome = await requestListAct(sessionId, request);
  forgetPages();
  if (outcome.data !== null) redirect(routes.inspectionList(outcome.data.supply));
  const refusal = refusalOf(outcome.failure);
  if (refusal === null || outcome.failure?.code === "SERVICE_NOT_CONFIGURED") failed("Requesting the list", outcome.failure);
  const attempt: ListAttempt = { ...request, refusal };
  redirect(withAttempt(routes.inspectionLists(), keepForPage(attempt)));
}
