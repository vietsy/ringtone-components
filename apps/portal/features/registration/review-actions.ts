"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  sendAmendment,
  sendAmendmentStart,
  sendClaimOutcome,
  sendCorrection,
  sendEvidenceRequest,
  sendOfficerWithdrawal,
  sendProposal,
  sendVerdict,
  type AmendmentAttempt,
  type ClaimOutcomeAttempt,
  type CorrectionAttempt,
  type EvidenceRequestAttempt,
  type ProposalAttempt,
  type VerdictAttempt,
  type WithdrawalAttempt,
} from "@/lib/api/registration-review";
import { holds, requireStaff } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { readDate, text } from "./fields";

/*
 * The registration console's acts. Each asks who is signed in, sends its command through the seam, which checks
 * the member's roles, the record's state and the segregation of duties again, and moves the officer on to the
 * screen the board says comes next: the case file, or the approval in place. A refused act goes back to the page
 * it was made on with the values kept (`keepForPage`), so the page draws the refusal where the act was.
 */

/** The values of rows a FieldRows form sends as `<name>[i].<field>`, in their order. */
function rows(formData: FormData, name: string, fields: readonly string[]): Record<string, string>[] {
  const found = new Map<number, Record<string, string>>();
  const pattern = new RegExp(`^${name}\\[(\\d+)\\]\\.(\\w+)$`);
  for (const [key, value] of formData.entries()) {
    const match = pattern.exec(key);
    if (match === null || typeof value !== "string" || !fields.includes(match[2] ?? "")) continue;
    const index = Number(match[1]);
    const row = found.get(index) ?? {};
    row[match[2] ?? ""] = value;
    found.set(index, row);
  }
  return [...found.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

// ---------------------------------------------------------------- SCR-REG-10

/** SCR-REG-10 Correct a fact: a new version labelled RightOne's, or the panel again with the refusal beside it. */
export async function correctFact(application: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const code = text(formData, "fact_code");
  const typed = text(formData, "value");
  const document = text(formData, "evidence_item_id");
  // A date goes to the API as an ISO date; one that cannot be read goes as typed, and is refused as invalid.
  const value = code === "use_began_on" && typed !== "" ? (readDate(typed) ?? typed) : typed;
  const outcome = await sendCorrection(staff, application, { code, value, document: document === "" || document === "none" ? null : document });
  const refusal = outcome.data?.refusal ?? null;
  if (refusal === null) redirect(routes.opsApplication(application));
  const attempt: CorrectionAttempt = { page: "case-file", application, values: { code, value: typed, document }, code: refusal.code };
  redirect(withAttempt(routes.opsApplication(application), keepForPage(attempt)));
}

/**
 * SCR-REG-10 Start an amendment, from a decided application's case file: the new draft's case file opens, or the
 * panel again with the refusal in it and the values kept.
 */
export async function startAmendment(application: string, decision: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const cause = text(formData, "cause");
  const caseRef = text(formData, "cause_ref");
  const fromText = text(formData, "intended_period_start");
  const answer = await sendAmendmentStart(staff, decision, { cause, caseRef, from: readDate(fromText) });
  const accepted = answer.data?.accepted ?? null;
  if (accepted !== null) redirect(routes.opsApplication(accepted.application));
  const refusal = answer.data?.refusal ?? null;
  const attempt: AmendmentAttempt = {
    page: "amendment",
    act: "start",
    application,
    values: { cause, caseRef, from: fromText },
    code: refusal?.code ?? "INTERNAL_ERROR",
    openApplication: refusal?.openApplication ?? null,
  };
  redirect(withAttempt(routes.opsApplication(application), keepForPage(attempt)));
}

/** SCR-REG-10 Send the amendment: the case file showing it in the amendment review, or the refusal in its header. */
export async function sendAmendmentAct(application: string): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const answer = await sendAmendment(staff, application);
  const refusal = answer.data?.refusal ?? null;
  if (refusal === null) redirect(routes.opsApplication(application));
  const attempt: AmendmentAttempt = { page: "amendment", act: "send", application, values: { cause: "", caseRef: "", from: "" }, code: refusal.code, openApplication: null };
  redirect(withAttempt(routes.opsApplication(application), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-REG-11

/** SCR-REG-11 Request {n} items: the case file in EVIDENCE_REQUIRED, or the form again with the items kept. */
export async function requestEvidence(application: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const items = rows(formData, "items", ["item_code", "description"])
    .map((row) => ({ code: (row.item_code ?? "").trim(), description: (row.description ?? "").trim() }))
    .filter((item) => item.code !== "" || item.description !== "");
  const outcome = await sendEvidenceRequest(staff, application, items);
  const refusal = outcome.data?.refusal ?? null;
  if (refusal === null) redirect(routes.opsApplication(application));
  const attempt: EvidenceRequestAttempt = { page: "evidence-request", application, items, code: refusal.code };
  redirect(withAttempt(routes.opsEvidenceRequest(application), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-REG-12

/**
 * SCR-REG-12 Record the outcome. An officer goes back to the case file with the outcome on the claim row; the
 * legal authority, who cannot read the queue or the case file, is confirmed in place.
 */
export async function recordClaimOutcome(application: string, claim: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS", "ACT-LGL");
  const outcome = text(formData, "outcome");
  const reason = text(formData, "reason_code");
  const fromText = text(formData, "accepted_scope-from");
  const toText = text(formData, "accepted_scope-to");
  const withLegal = formData.has("co_recorded_by_legal");
  const answer = await sendClaimOutcome(staff, application, claim, { outcome, reason, scopeFrom: readDate(fromText), scopeTo: readDate(toText), withLegal });
  const refusal = answer.data?.refusal ?? null;
  if (refusal === null) redirect(holds(staff, "ACT-OPS") ? routes.opsApplication(application) : routes.opsClaimReview(application, claim));
  const attempt: ClaimOutcomeAttempt = {
    page: "claim",
    application,
    claim,
    values: { outcome, reason, scopeFrom: fromText, scopeTo: toText, withLegal },
    code: refusal.code,
  };
  redirect(withAttempt(routes.opsClaimReview(application, claim), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-REG-13

/** SCR-REG-13 Send for approval, or Issue the decision: the case file showing the proposal or the decision. */
export async function proposeDecision(application: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = text(formData, "proposed_outcome");
  const reason = text(formData, "reason_code");
  const reasonText = text(formData, "reason_text");
  const unmet = rows(formData, "unmet_conditions", ["text"]).map((row) => (row.text ?? "").trim());
  const actionOpen = text(formData, "action_open");
  const effectiveText = text(formData, "effective_from");
  const effectiveFrom = effectiveText !== "" ? readDate(effectiveText) : null;
  const answer = await sendProposal(staff, application, { outcome, reason, text: reasonText, unmet, actionOpen, effectiveFrom });
  const refusal = answer.data?.refusal ?? null;
  if (refusal === null) redirect(routes.opsApplication(application));
  const attempt: ProposalAttempt = {
    page: "proposal",
    application,
    values: { outcome, reason, text: reasonText, unmet, actionOpen, effectiveFrom: effectiveText },
    code: refusal.code,
    governingDecision: refusal.governingDecision,
  };
  redirect(withAttempt(routes.opsDecisionProposal(application), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-REG-14

/** SCR-REG-14 Approve, or Return with the note: answered in place, approved and issued or returned, or refused. */
export async function recordVerdict(proposal: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const verdict = text(formData, "intent");
  const note = text(formData, "note");
  const answer = await sendVerdict(staff, proposal, { verdict, note });
  const refusal = answer.data?.refusal ?? null;
  if (refusal === null) redirect(routes.opsApprovals(proposal));
  const attempt: VerdictAttempt = { page: "verdict", proposal, note, code: refusal.code, governingDecision: refusal.governingDecision };
  redirect(withAttempt(routes.opsApprovals(proposal), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-REG-15

/** SCR-REG-15 Record the withdrawal: the case file showing WITHDRAWN on the applicant's instruction. */
export async function withdrawOnInstruction(application: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const values = { instruction: text(formData, "instruction_ref"), reason: text(formData, "reason_text") };
  const answer = await sendOfficerWithdrawal(staff, application, values);
  const refusal = answer.data?.refusal ?? null;
  if (refusal === null) redirect(routes.opsApplication(application));
  const attempt: WithdrawalAttempt = { page: "withdrawal", application, values, code: refusal.code };
  redirect(withAttempt(routes.opsWithdrawal(application), keepForPage(attempt)));
}
