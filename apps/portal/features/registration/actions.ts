"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  loadStartFromDecision,
  sendAssertion,
  sendAttestationAndSubmission,
  sendEvidenceItem,
  sendFactDeclarations,
  sendRequestedDocument,
  sendStartApplication,
  sendWithdrawal,
  type ApplicationKind,
  type AttestAttempt,
  type ChosenFile,
  type EvidenceAttempt,
  type EvidenceItemRefusal,
  type FactQuestion,
  type FactsAttempt,
  type RightsLayer,
  type StartAttempt,
  type StatusAttempt,
} from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { readDate, text } from "./fields";

/*
 * The registration forms' acts. Each asks who is signed in, sends its command through the seam, and moves the
 * person on to the screen the board says comes next. A refused act goes back to the page it was made on with
 * the attempt kept (`keepForPage`), so the page draws the refusal where the act was, with the values as entered.
 * An act on an application that is no longer a draft lands on its status page, which says where it stands.
 */

const QUESTIONS: readonly FactQuestion[] = ["premises_class", "customer_area", "days_open", "music_method", "use_began_on"];
const LAYERS: readonly RightsLayer[] = ["AUTHORS", "PERFORMERS", "PRODUCERS"];
const ITEM_REFUSALS: readonly EvidenceItemRefusal[] = ["DOCUMENT_INVALID", "EVIDENCE_REQUEST_CLOSED", "TARIFF_NOT_APPROVED", "EVIDENCE_NOT_REQUESTED"];

const kindOf = (value: string): ApplicationKind => (value === "RENEWAL" || value === "AMENDMENT" ? value : "NEW");

/** What the browser says of the file chosen, checked here because an act's arguments come from the browser. */
function chosen(file: unknown): ChosenFile {
  const candidate = (typeof file === "object" && file !== null ? file : {}) as Record<string, unknown>;
  return {
    name: typeof candidate.name === "string" ? candidate.name : "",
    type: typeof candidate.type === "string" ? candidate.type : "",
    sizeBytes: typeof candidate.sizeBytes === "number" && Number.isFinite(candidate.sizeBytes) ? candidate.sizeBytes : 0,
  };
}

// ---------------------------------------------------------------- SCR-REG-02 and SCR-REG-08

/**
 * SCR-REG-02 Start the application: SCR-REG-03 of the new draft, or the form again with the refusal in place
 * and every value as entered.
 */
export async function startApplication(formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const kind = kindOf(text(formData, "kind"));
  const premisesId = text(formData, "premises_id");
  const prior = text(formData, "prior_decision_id");
  const cause = text(formData, "cause");
  const change = kind === "AMENDMENT";
  const fromText = text(formData, change ? "intended_period_start" : "intended_period-from");
  const toText = text(formData, "intended_period-to");
  const from = readDate(fromText);
  const to = readDate(toText);

  // The prior decision as RightOne reads it, for the form to show again; a decision no longer found has no period.
  const priorValues = prior !== "" && kind !== "NEW" ? (await loadStartFromDecision(principal.sessionId, prior, kind)).data : null;
  const values: StartAttempt["values"] = {
    premisesId: premisesId !== "" ? premisesId : null,
    kind,
    prior: prior !== "" ? { reference: prior, period: priorValues?.prior?.period ?? null } : null,
    cause: cause === "FACT_CHANGE_REPORTED" || cause === "APPLICANT_REQUEST" ? cause : null,
    period: { from: from ?? "", to: change ? (priorValues?.period.to ?? "") : (to ?? "") },
  };
  const back = (attempt: Omit<StartAttempt, "page" | "values">): never =>
    redirect(withAttempt(routes.startApplication(), keepForPage({ page: "start", values, ...attempt } satisfies StartAttempt)));
  if (premisesId === "") back({ refusal: null, fieldError: null });

  const outcome = await sendStartApplication(principal.sessionId, { premisesId, kind, prior: prior !== "" ? prior : null, cause: cause !== "" ? cause : null, from, to: change ? null : to });
  const answer = outcome.data;
  if (answer === null) redirect(routes.startApplication());
  if (answer.accepted !== null) redirect(routes.applicationFacts(answer.accepted.application));
  const { code, field, openApplication, governingDecision } = answer.refusal;
  back(
    field === "period" || field === "cause"
      ? { refusal: null, fieldError: { field, code, governingDecision } }
      : { refusal: { code, openApplication }, fieldError: null },
  );
}

/** SCR-REG-08 Renew and Report a change: SCR-REG-02 as a renewal or a change of that decision. */
async function startFromDecision(decision: string, kind: "RENEWAL" | "AMENDMENT"): Promise<void> {
  const principal = await requirePrincipal();
  const outcome = await loadStartFromDecision(principal.sessionId, decision, kind);
  if (outcome.data === null) redirect(routes.decision(decision));
  redirect(withAttempt(routes.startApplication(), keepForPage({ page: "start", values: outcome.data, refusal: null, fieldError: null } satisfies StartAttempt)));
}

export async function renewDecision(decision: string): Promise<void> {
  await startFromDecision(decision, "RENEWAL");
}

export async function changeDecision(decision: string): Promise<void> {
  await startFromDecision(decision, "AMENDMENT");
}

// ---------------------------------------------------------------- SCR-REG-03

/**
 * SCR-REG-03 Next: documents, and Save and leave. Both save the answers; Next goes on to the documents once
 * every question is answered, Save and leave back to the list. A refused answer keeps everything as typed.
 */
export async function saveFacts(application: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const leave = text(formData, "intent") === "leave";
  const typed: Partial<Record<FactQuestion, string>> = {};
  const sent: Partial<Record<FactQuestion, string>> = {};
  for (const question of QUESTIONS) {
    if (!formData.has(question)) continue;
    const value = text(formData, question);
    typed[question] = value;
    // A date goes to the API as an ISO date; one that cannot be read goes as typed, and is refused as invalid.
    sent[question] = question === "use_began_on" && value !== "" ? (readDate(value) ?? value) : value;
  }
  const reconfirmed = QUESTIONS.filter((question) => formData.has(`reconfirm_${question}`));
  const outcome = await sendFactDeclarations(principal.sessionId, application, { values: sent, reconfirmed });
  const answer = outcome.data;
  if (answer === null) redirect(routes.applicationFacts(application));
  if (answer.refusal !== null) {
    if (answer.refusal.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
    const attempt: FactsAttempt = { page: "facts", application, values: typed, reconfirmed, fieldErrors: answer.refusal.fieldErrors };
    redirect(withAttempt(routes.applicationFacts(application), keepForPage(attempt)));
  }
  if (leave) redirect(routes.applications());
  redirect(answer.accepted.complete ? routes.applicationEvidence(application) : routes.applicationFacts(application));
}

// ---------------------------------------------------------------- SCR-REG-04

/** SCR-REG-04 Add a document: the file's name, type and size are recorded against its slot; the file is not kept. */
export async function addDocument(application: string, target: string, file: unknown): Promise<void> {
  const principal = await requirePrincipal();
  const outcome = await sendEvidenceItem(principal.sessionId, application, String(target), chosen(file));
  const refusal = outcome.data?.refusal ?? null;
  if (refusal === null) redirect(routes.applicationEvidence(application));
  if (refusal.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
  const attempt: EvidenceAttempt = { page: "evidence", application, document: { target: String(target), code: refusal.code }, claim: null };
  redirect(withAttempt(routes.applicationEvidence(application), keepForPage(attempt)));
}

/** SCR-REG-04 Add the claim: the claim joins the application with its own documents, or the form comes back with the refusal. */
export async function addClaim(application: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const kind = text(formData, "kind") === "DIRECT_LICENCE" ? "DIRECT_LICENCE" : "NON_USE";
  const layer = text(formData, "rights_layer");
  const from = readDate(text(formData, "claim_period-from"));
  const to = readDate(text(formData, "claim_period-to"));
  const outcome = await sendAssertion(principal.sessionId, application, { kind, layer, from, to });
  const refusal = outcome.data?.refusal ?? null;
  if (refusal === null) redirect(routes.applicationEvidence(application));
  if (refusal.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
  const attempt: EvidenceAttempt = {
    page: "evidence",
    application,
    document: null,
    claim: {
      kind,
      layer: LAYERS.find((option) => option === layer) ?? null,
      from: from ?? "",
      to: to ?? "",
      refusal: { field: refusal.field === "period" ? "period" : "layer", code: refusal.code },
    },
  };
  redirect(withAttempt(routes.applicationEvidence(application), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-REG-06

/**
 * SCR-REG-06 Confirm and send: the confirmation against the review shown, then the sending. Sent, the status
 * page opens; refused, the page shows the refusal above the button, the boxes as they were ticked.
 */
export async function sendApplication(application: string, formData: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const confirmed = formData.has("confirmed");
  const changeDutyAcknowledged = formData.has("change_duty_acknowledged");
  const outcome = await sendAttestationAndSubmission(principal.sessionId, application, {
    presentation: text(formData, "explanation_presentation_id"),
    factsDigest: text(formData, "facts_digest"),
    confirmed,
    changeDutyAcknowledged,
  });
  const answer = outcome.data;
  if (answer === null) redirect(routes.applicationSubmit(application));
  if (answer.refusal === null || answer.refusal.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
  const { code, governingDecision, missing } = answer.refusal;
  const attempt: AttestAttempt = { page: "attest", application, confirmed, changeDutyAcknowledged, refusal: { code, governingDecision }, missing };
  redirect(withAttempt(routes.applicationSubmit(application), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-REG-07

/** SCR-REG-07 Withdraw: the application is withdrawn by the person, or the page says it has already ended. */
export async function withdrawApplication(application: string): Promise<void> {
  const principal = await requirePrincipal();
  const outcome = await sendWithdrawal(principal.sessionId, application);
  const refusal = outcome.data?.refusal ?? null;
  if (refusal?.code !== "APPLICATION_ALREADY_FINAL") redirect(routes.application(application));
  const attempt: StatusAttempt = { page: "status", application, withdrawRefusal: "APPLICATION_ALREADY_FINAL", document: null };
  redirect(withAttempt(routes.application(application), keepForPage(attempt)));
}

/** SCR-REG-07 Add a document for an item a reviewer, or RightOne, asked for. */
export async function addRequestedDocument(application: string, item: string, file: unknown): Promise<void> {
  const principal = await requirePrincipal();
  const outcome = await sendRequestedDocument(principal.sessionId, application, String(item), chosen(file));
  const code = outcome.data?.refusal?.code ?? null;
  const refusal = ITEM_REFUSALS.find((candidate) => candidate === code);
  if (refusal === undefined) redirect(routes.application(application));
  // The item by its code, as the request names it: a reviewer's code or a document the rules name.
  const attempt: StatusAttempt = { page: "status", application, withdrawRefusal: null, document: { item: String(item), code: refusal } };
  redirect(withAttempt(routes.application(application), keepForPage(attempt)));
}
