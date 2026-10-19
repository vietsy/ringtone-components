"use server";

import { redirect } from "next/navigation";
import {
  sendAppeal,
  sendCase,
  sendCaseWithdrawal,
  sendEvidenceAnswer,
  sendOwnEvidence,
  sendReopeningRequest,
  type CaseAttempt,
  type ConsoleAttempt,
  type IntakeAttempt,
  type IntakeValues,
} from "@/lib/api/cases";
import { keepForPage } from "@/lib/api/flash";
import { currentPrincipal, currentWorld, worldForAct } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { readerOf } from "./copy";
import { readDate } from "./dates";

/*
 * The case forms' acts on the public surface. None needs an account: each asks who is signed in, acts as that
 * principal or as nobody, and opens the screen that comes next, or the same screen with the refusal kept where the
 * act was.
 */

const text = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/**
 * SCR-CAS-01 Raise the case: SCR-CAS-02 of the new case, or the form again with the refusal in the page header or
 * beside the field, every value as typed. A case raised without an account is written to this browser's world,
 * made now if it has none, so the reference reaches the same case afterwards. There is no mail behind the mock: the
 * acknowledgement is the COM notice the backend raises (`recordNoticeEvent`), read on SCR-COM-10 by its reference,
 * so nothing about the raiser, their contact included, is written to the server's log.
 */
export async function raiseCase(formData: FormData): Promise<void> {
  const principal = await currentPrincipal();
  const key = principal?.sessionId ?? (await worldForAct());
  const values: IntakeValues = {
    group: text(formData, "stakeholder_group"),
    matter: text(formData, "matter"),
    subject: text(formData, "subject_ref"),
    periodFrom: text(formData, "affected_period-from"),
    periodTo: text(formData, "affected_period-to"),
    remedy: text(formData, "requested_remedy_kind"),
    contact: text(formData, "raiser_contact"),
  };
  const from = readDate(values.periodFrom);
  const to = readDate(values.periodTo);
  const outcome = await sendCase(key, readerOf(principal), {
    group: values.group,
    routeId: text(formData, "intake_route_id"),
    matter: values.matter,
    subject: values.subject,
    period: { from: from.iso, to: to.iso, unreadable: from.unreadable || to.unreadable },
    remedy: values.remedy,
    contact: values.contact,
  });
  const answer = outcome.data;
  if (answer === null) redirect(routes.raiseCase());
  if (answer.refusal !== null) {
    const { code, fieldErrors } = answer.refusal;
    const attempt: IntakeAttempt = { page: "raise", values, refusal: Object.keys(fieldErrors).length > 0 ? null : code, fieldErrors };
    redirect(withAttempt(routes.raiseCase(), keepForPage(attempt)));
  }
  redirect(routes.myCase(answer.accepted.reference));
}

/**
 * SCR-CAS-02 Withdraw this case, confirmed in the dialog: the case is WITHDRAWN and the page says so, or the page
 * shows the refusal in its header.
 */
export async function withdrawCase(reference: string): Promise<void> {
  const principal = await currentPrincipal();
  const key = principal?.sessionId ?? (await currentWorld());
  const outcome = await sendCaseWithdrawal(key, reference, readerOf(principal));
  const code = outcome.data?.refusal?.code ?? null;
  if (code !== "CASE_ALREADY_DECIDED" && code !== "ROLE_OUT_OF_SCOPE" && code !== "TRANSITION_NOT_PERMITTED") redirect(routes.myCase(reference));
  const attempt: CaseAttempt = { page: "case", reference, refusal: code };
  redirect(withAttempt(routes.myCase(reference), keepForPage(attempt)));
}

/**
 * SCR-CAS-02 Answer this request: what the party supplies, or that they will not, recorded against the request.
 * The page reads again; a refusal is kept beside the request it fell on.
 */
export async function answerRequest(reference: string, request: string, formData: FormData): Promise<void> {
  const principal = await currentPrincipal();
  const key = principal?.sessionId ?? (await currentWorld());
  const values = { outcome: text(formData, "receipt_outcome"), supplied: text(formData, "supplied") };
  const outcome = await sendEvidenceAnswer(key, readerOf(principal), reference, request, values);
  const refusal = outcome.data?.refusal ?? null;
  if (refusal === null) redirect(routes.myCase(reference));
  const code = refusal.code;
  if (code !== "REQUEST_CANCELLED" && code !== "RECEIPT_OUTCOME_REQUIRED" && code !== "FIELD_MISSING" && code !== "ROLE_OUT_OF_SCOPE") redirect(routes.myCase(reference));
  const attempt: CaseAttempt = { page: "case", reference, refusal: code, request, values };
  redirect(withAttempt(routes.myCase(reference), keepForPage(attempt)));
}

/**
 * SCR-CAS-08 Lodge the appeal: SCR-CAS-02, where the appeal and the date it is answered by now show; or the form
 * again with the refusal, the grounds as typed.
 */
export async function lodgeAppeal(reference: string, formData: FormData): Promise<void> {
  const principal = await currentPrincipal();
  const key = principal?.sessionId ?? (await currentWorld());
  const values = { grounds: text(formData, "grounds"), contact: text(formData, "appellant_contact") };
  const outcome = await sendAppeal(key, readerOf(principal), reference, values);
  const refusal = outcome.data?.refusal ?? null;
  if (outcome.data === null) redirect(routes.lodgeAppeal(reference));
  if (refusal === null) redirect(routes.myCase(reference));
  const attempt: ConsoleAttempt = { form: "appeal", subject: reference, refusal, values };
  redirect(withAttempt(routes.lodgeAppeal(reference), keepForPage(attempt)));
}

/**
 * SCR-CAS-02 Add something to your case: an item, and whether it may be shown to the other party, chosen before it is
 * supplied. The page reads again with the item listed; a refusal is kept beside the form.
 */
export async function supplyEvidence(reference: string, formData: FormData): Promise<void> {
  const principal = await currentPrincipal();
  const key = principal?.sessionId ?? (await currentWorld());
  const values = { item_ref: text(formData, "item_ref"), disclosure_status: text(formData, "disclosure_status") };
  const outcome = await sendOwnEvidence(key, readerOf(principal), reference, { itemRef: values.item_ref, disclosure: values.disclosure_status });
  const refusal = outcome.data?.refusal ?? null;
  if (refusal === null) redirect(routes.myCase(reference));
  const code = refusal.code;
  if (code !== "DISCLOSURE_STATUS_REQUIRED" && code !== "FIELD_MISSING" && code !== "TRANSITION_NOT_PERMITTED" && code !== "ROLE_OUT_OF_SCOPE") redirect(routes.myCase(reference));
  const attempt: CaseAttempt = { page: "case", reference, refusal: code, request: "evidence", values };
  redirect(withAttempt(routes.myCase(reference), keepForPage(attempt)));
}

/**
 * SCR-CAS-08 Ask for a reopening, where the appeal is no longer the reader's route: the new evidence, the day it came
 * to exist, and what it would displace - naming nothing is an answer. The proposal waits for an authority, and
 * SCR-CAS-02 says so; or the form opens again with the refusal beside the field it fell on.
 */
export async function askReopening(reference: string, formData: FormData): Promise<void> {
  const principal = await currentPrincipal();
  const key = principal?.sessionId ?? (await currentWorld());
  const evidenceOn = readDate(text(formData, "evidence_date"));
  const displaced = formData.getAll("displaced_outcomes").filter((value): value is string => typeof value === "string" && value !== "");
  const outcome = await sendReopeningRequest(key, readerOf(principal), reference, {
    groundKind: "new_evidence",
    groundRef: text(formData, "ground_ref"),
    evidenceOn: evidenceOn.iso,
    evidenceUnreadable: evidenceOn.unreadable,
    displaced: displaced.filter((value) => value !== "nothing"),
    nothing: displaced.includes("nothing"),
  });
  const refusal = outcome.data?.refusal ?? null;
  if (outcome.data === null) redirect(routes.lodgeAppeal(reference));
  if (refusal === null) redirect(routes.myCase(reference));
  const values = { ground_ref: text(formData, "ground_ref"), evidence_date: text(formData, "evidence_date"), displaced_outcomes: displaced };
  const attempt: ConsoleAttempt = { form: "reopen", subject: reference, refusal, values };
  redirect(withAttempt(routes.lodgeAppeal(reference), keepForPage(attempt)));
}
