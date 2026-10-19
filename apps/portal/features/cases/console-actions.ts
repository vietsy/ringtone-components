"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import {
  sendAppealOutcome,
  sendCallerCase,
  sendCaseLink,
  sendCategoryPolicy,
  sendClassification,
  sendClosure,
  sendDecision,
  sendDecisionDraft,
  sendEvidenceItem,
  sendEvidenceRequest,
  sendIntakeApproval,
  sendIntakeVersion,
  sendLinkageCheck,
  sendParty,
  sendPeriodVersion,
  sendPolicyApproval,
  sendProgress,
  sendProtectedClassification,
  sendRecordedResponse,
  sendReferral,
  sendRegisterEntry,
  sendRemedyLink,
  sendReopening,
  sendReopeningAuthorisation,
  sendRequestCancellation,
  type CallerCaseRecorded,
  type CaseAnswer,
  type ConsoleAttempt,
  type DecisionValues,
  type IntakeAttempt,
  type IntakeValues,
} from "@/lib/api/cases";
import type { LoadOutcome } from "@rightone/ui";
import { keepForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { readDate } from "./dates";

/*
 * The case console's acts. Each asks who is signed in - the backend checks their roles and their part in the
 * record itself - sends one command, and opens the screen that comes next, or the same screen with the refusal and
 * every value as typed, kept for the form it came from.
 */

const text = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const texts = (formData: FormData, name: string): string[] => formData.getAll(name).filter((value): value is string => typeof value === "string" && value !== "");

/** Every field of a form as typed, for the page to put back. */
function typed(formData: FormData): Record<string, string | readonly string[]> {
  const values: Record<string, string | string[]> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string" || name.startsWith("$ACTION")) continue;
    const before = values[name];
    values[name] = before === undefined ? value : Array.isArray(before) ? [...before, value] : [before, value];
  }
  return values;
}

/** The next screen on success, or the same one with the attempt kept for the form that was refused. */
function settle<T>(outcome: LoadOutcome<CaseAnswer<T>>, form: string, subject: string, values: Record<string, string | readonly string[]>, back: Route, next: Route): never {
  const refusal = outcome.data?.refusal ?? null;
  if (outcome.data === null || refusal === null) redirect(next);
  const attempt: ConsoleAttempt = { form, subject, refusal, values };
  redirect(withAttempt(back, keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CAS-04

/** Classify and derive: the target appears on the case, or the refusal in the page header and beside each field. */
export async function classify(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const from = readDate(text(formData, "affected_period-from"));
  const to = readDate(text(formData, "affected_period-to"));
  const outcome = await sendClassification(staff, reference, {
    caseType: text(formData, "case_type"),
    subjectKind: text(formData, "subject_kind"),
    subjectRef: text(formData, "subject_ref"),
    period: { from: from.iso, to: to.iso, unreadable: from.unreadable || to.unreadable },
    remedy: text(formData, "requested_remedy_kind"),
    owner: text(formData, "owner_actor_id"),
    severity: text(formData, "severity"),
    impact: text(formData, "business_impact"),
    vulnerability: text(formData, "raiser_vulnerability"),
  });
  settle(outcome, "classify", reference, typed(formData), routes.opsCase(reference), routes.opsCase(reference));
}

/** Start investigating, Ready to decide. */
export async function progress(reference: string, to: string): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendProgress(staff, reference, to);
  settle(outcome, "progress", reference, {}, routes.opsCase(reference), routes.opsCase(reference));
}

/** Link a case: the row on both cases, or the refusal beside the reference or the kind. */
export async function linkCase(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendCaseLink(staff, reference, { to: text(formData, "to_case"), kind: text(formData, "link_kind") });
  settle(outcome, "link", reference, typed(formData), routes.opsCase(reference), routes.opsCase(reference));
}

/** Add a party in a role. */
export async function addParty(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendParty(staff, reference, { party: text(formData, "party_id"), role: text(formData, "party_role") });
  settle(outcome, "party", reference, typed(formData), routes.opsCase(reference), routes.opsCase(reference));
}

/** Refer this case, confirmed in the dialog that names the process: REFERRED, and the raiser is told which process has it. */
export async function referCase(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendReferral(staff, reference, { process: text(formData, "receiving_process"), reason: text(formData, "reason") });
  settle(outcome, "refer", reference, typed(formData), routes.opsCase(reference), routes.opsCase(reference));
}

/**
 * Close this case, confirmed in the dialog that names the reopening ground the closure carries: as inadmissible from
 * TRIAGED, with the route the matter should take instead, or as incomplete from AWAITING_EVIDENCE, with a second case
 * officer's approval and what could not be established.
 */
export async function closeCase(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendClosure(staff, reference, {
    disposition: text(formData, "disposition"),
    reason: text(formData, "reason"),
    route: text(formData, "route"),
    unestablished: text(formData, "unestablished"),
    approver: text(formData, "approver_actor_id"),
  });
  settle(outcome, "close", reference, typed(formData), routes.opsCase(reference), routes.opsCase(reference));
}

/**
 * Classify as protected, confirmed in the dialog that names the consequence: from that instant only the category's
 * access list, less anyone the matter names, reads the case - the officer who classified it included - so the page
 * that opens next may say the reader no longer has access.
 */
export async function classifyProtected(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendProtectedClassification(staff, reference, {
    category: text(formData, "category"),
    reason: text(formData, "reason"),
    subjects: texts(formData, "subject_actor_id"),
  });
  settle(outcome, "protect", reference, typed(formData), routes.opsCase(reference), routes.opsCase(reference));
}

// ---------------------------------------------------------------- SCR-CAS-06

/** Send the request: issued, and the case waits on it. */
export async function requestEvidence(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const deadline = readDate(text(formData, "deadline"));
  const outcome = await sendEvidenceRequest(staff, reference, {
    item: text(formData, "requested_item"),
    addressee: text(formData, "responsible_party"),
    deadline: deadline.iso,
    deadlineUnreadable: deadline.unreadable,
    disclosure: text(formData, "disclosure_status"),
  });
  settle(outcome, "request", reference, typed(formData), routes.opsCaseEvidence(reference), routes.opsCaseEvidence(reference));
}

/** Cancel this request, with its reason, confirmed in the dialog that names who will be told. */
export async function cancelRequest(reference: string, request: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendRequestCancellation(staff, reference, request, text(formData, "reason"));
  settle(outcome, `cancel:${request}`, reference, typed(formData), routes.opsCaseEvidence(reference), routes.opsCaseEvidence(reference));
}

/**
 * Record a response that arrived another way - by post, at the counter, by telephone: what arrived against the
 * request, said even where nothing did, and the officer recorded as who wrote it down.
 */
export async function recordResponse(reference: string, request: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendRecordedResponse(staff, reference, request, { outcome: text(formData, "receipt_outcome"), supplied: text(formData, "supplied") });
  settle(outcome, `respond:${request}`, reference, typed(formData), routes.opsCaseEvidence(reference), routes.opsCaseEvidence(reference));
}

/** Add an item held against the case: what it is, the status it carries, and who supplied it. */
export async function addEvidenceItem(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendEvidenceItem(staff, reference, {
    itemRef: text(formData, "item_ref"),
    disclosure: text(formData, "disclosure_status"),
    suppliedBy: text(formData, "supplied_by"),
  });
  settle(outcome, "item", reference, typed(formData), routes.opsCaseEvidence(reference), routes.opsCaseEvidence(reference));
}

// ---------------------------------------------------------------- SCR-CAS-07

/** Save draft or Record and issue, by the form's intent; the same screen shows the time saved or the decision issued. */
export async function decide(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const values: DecisionValues = {
    facts: text(formData, "facts"),
    authority: text(formData, "authority_ref"),
    reasoning: text(formData, "reasoning"),
    remedy: text(formData, "remedy_kind"),
    effective: text(formData, "effective_date"),
    appealRoute: text(formData, "appeal_route"),
    ground: text(formData, "governing_ground"),
  };
  const back = routes.opsCaseDecision(reference);
  if (text(formData, "intent") === "draft") {
    settle(await sendDecisionDraft(staff, reference, values), "decision", reference, typed(formData), back, back);
  }
  const effective = readDate(values.effective);
  settle(await sendDecision(staff, reference, values, effective.unreadable ? null : effective.iso), "decision", reference, typed(formData), back, back);
}

// ---------------------------------------------------------------- SCR-CAS-10

/** Link an artefact: the row turns from absent to linked, and the answer for the remedy is read again. */
export async function linkRemedy(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendRemedyLink(staff, reference, { kind: text(formData, "artefact_kind"), artefact: text(formData, "artefact_ref") });
  settle(outcome, "link", reference, typed(formData), routes.opsCaseRemedy(reference), routes.opsCaseRemedy(reference));
}

/** Re-check linkage: every back-reference read again where it lives. */
export async function recheckLinkage(reference: string): Promise<void> {
  const staff = await requireStaff();
  settle(await sendLinkageCheck(staff, reference), "recheck", reference, {}, routes.opsCaseRemedy(reference), routes.opsCaseRemedy(reference));
}

// ---------------------------------------------------------------- SCR-CAS-09

/** Record outcome, confirmed in the dialog that names the party who will be told. */
export async function recordOutcome(appeal: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const effective = readDate(text(formData, "outcome_effective_date"));
  const outcome = await sendAppealOutcome(staff, appeal, {
    outcome: text(formData, "outcome"),
    facts: text(formData, "outcome_facts"),
    authority: text(formData, "outcome_authority_ref"),
    reasoning: text(formData, "outcome_reasoning"),
    remedy: text(formData, "outcome_remedy_kind"),
    effective: effective.unreadable ? null : effective.iso,
    furtherRoute: text(formData, "outcome_further_route"),
    ground: text(formData, "outcome_governing_ground"),
  });
  settle(outcome, "outcome", appeal, typed(formData), routes.opsAppeal(appeal), routes.opsAppeal(appeal));
}

// ---------------------------------------------------------------- SCR-CAS-15

/** Send for authorisation: the proposal waits for an authority other than the proposer. */
export async function proposeReopening(reference: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const evidenceOn = readDate(text(formData, "evidence_date"));
  const displaced = texts(formData, "displaced_outcomes");
  const outcome = await sendReopening(staff, reference, {
    groundKind: text(formData, "ground_kind"),
    groundRef: text(formData, "ground_ref"),
    evidenceOn: evidenceOn.iso,
    evidenceUnreadable: evidenceOn.unreadable,
    displaced: displaced.filter((value) => value !== "nothing"),
    nothing: displaced.includes("nothing"),
  });
  settle(outcome, "propose", reference, typed(formData), routes.opsCaseReopening(reference), routes.opsCaseReopening(reference));
}

/** Authorise, confirmed in the dialog that names what will be displaced. */
export async function authoriseReopening(reference: string, reopening: string): Promise<void> {
  const staff = await requireStaff();
  settle(await sendReopeningAuthorisation(staff, reopening), "authorise", reference, {}, routes.opsCaseReopening(reference), routes.opsCaseReopening(reference));
}

/** Refuse the reopening, with the reason the dialog asks for: REOPEN_REFUSED, and the earlier decision stands. */
export async function refuseReopening(reference: string, reopening: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendReopeningAuthorisation(staff, reopening, "refuse", text(formData, "reason"));
  settle(outcome, "refuse", reference, typed(formData), routes.opsCaseReopening(reference), routes.opsCaseReopening(reference));
}

// ---------------------------------------------------------------- SCR-CAS-16

/** Save this version: the rows the page's table sent, each a group, a route and whether it needs an account. */
export async function saveIntakeVersion(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const effective = readDate(text(formData, "effective_from"));
  const groups = formData.getAll("route_group");
  const kinds = formData.getAll("route_kind");
  const accounts = formData.getAll("route_requires_account");
  const rows = groups.map((group, index) => ({
    group: typeof group === "string" ? group : "",
    kind: typeof kinds[index] === "string" ? kinds[index] : "",
    requiresAccount: accounts[index] === "yes" ? true : accounts[index] === "no" ? false : null,
  }));
  const versionId = text(formData, "version_id");
  const outcome = await sendIntakeVersion(staff, {
    versionId: versionId !== "" ? versionId : null,
    effectiveFrom: effective.iso,
    effectiveUnreadable: effective.unreadable,
    routes: rows,
  });
  settle(outcome, "save", versionId, typed(formData), routes.opsIntakeMatrix(), routes.opsIntakeMatrix());
}

/** Approve, confirmed in the dialog that names the effective date. */
export async function approveIntakeVersion(version: string): Promise<void> {
  const staff = await requireStaff();
  settle(await sendIntakeApproval(staff, version), "approve", version, {}, routes.opsIntakeMatrix(), routes.opsIntakeMatrix());
}

// ---------------------------------------------------------------- SCR-CAS-18

/** Add an entry: prepared, and read by nobody until approved. */
export async function addRegisterEntry(register: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const effective = readDate(text(formData, "effective_from"));
  const outcome = await sendRegisterEntry(staff, register, {
    code: text(formData, "code"),
    label: text(formData, "label"),
    authority: text(formData, "required_authority"),
    effectiveFrom: effective.iso,
    effectiveUnreadable: effective.unreadable,
  });
  settle(outcome, "entry", register, typed(formData), routes.opsCasePolicy(register), routes.opsCasePolicy(register));
}

/** Prepare a period version for a case type. */
export async function preparePeriod(register: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const effective = readDate(text(formData, "effective_from"));
  const outcome = await sendPeriodVersion(staff, register, {
    caseType: text(formData, "case_type"),
    amount: text(formData, "amount"),
    effectiveFrom: effective.iso,
    effectiveUnreadable: effective.unreadable,
  });
  settle(outcome, "period", register, typed(formData), routes.opsCasePolicy(register), routes.opsCasePolicy(register));
}

/** Approve and publish, confirmed in the dialog that names the effective date and what reads it. */
export async function approvePolicyItem(register: string, id: string): Promise<void> {
  const staff = await requireStaff();
  settle(await sendPolicyApproval(staff, id), `approve:${id}`, register, {}, routes.opsCasePolicy(register), routes.opsCasePolicy(register));
}

/** Refuse it, with the reason the dialog asks for: it stays prepared, and its preparer reads why. */
export async function refusePolicyItem(register: string, id: string, formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const outcome = await sendPolicyApproval(staff, id, "refuse", text(formData, "reason"));
  settle(outcome, `approve:${id}`, register, typed(formData), routes.opsCasePolicy(register), routes.opsCasePolicy(register));
}

/**
 * Prepare a category policy (the protected categories' register, by the security owner): the category, the specialist
 * process it routes to, who may read a matter in it, and the two people an independent escalation goes to.
 */
export async function prepareCategoryPolicy(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const effective = readDate(text(formData, "effective_from"));
  const outcome = await sendCategoryPolicy(staff, {
    category: text(formData, "category"),
    specialistProcess: text(formData, "specialist_process"),
    access: texts(formData, "access_actor_ids"),
    primary: text(formData, "primary_addressee_actor_id"),
    alternate: text(formData, "alternate_addressee_actor_id"),
    effectiveFrom: effective.iso,
    effectiveUnreadable: effective.unreadable,
  });
  const register = "protected_category";
  settle(outcome, "category", register, typed(formData), routes.opsCasePolicy(register), routes.opsCasePolicy(register));
}

// ---------------------------------------------------------------- SCR-CAS-01, by the support line

/**
 * Record the case for a caller (ACT-SUP): their group, their words and the contact they give, on the group's support
 * line. The form opens again saying the reference to read back, and that the acknowledgement went to the caller; or
 * with the refusal beside the field it fell on, every value as typed.
 */
export async function recordCallerCase(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-SUP");
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
  const outcome = await sendCallerCase(staff, {
    group: values.group,
    routeId: "",
    matter: values.matter,
    subject: values.subject,
    period: { from: from.iso, to: to.iso, unreadable: from.unreadable || to.unreadable },
    remedy: values.remedy,
    contact: values.contact,
  });
  const answer = outcome.data;
  if (answer === null) redirect(routes.opsCallerCase(values.group));
  if (answer.refusal !== null) {
    const { code, fieldErrors } = answer.refusal;
    const attempt: IntakeAttempt = { page: "raise", values, refusal: Object.keys(fieldErrors).length > 0 ? null : code, fieldErrors };
    redirect(withAttempt(routes.opsCallerCase(values.group), keepForPage(attempt)));
  }
  const recorded: CallerCaseRecorded = { page: "recorded", reference: answer.accepted.reference, contact: answer.accepted.contact, notice: answer.accepted.notice };
  redirect(withAttempt(routes.opsCallerCase(), keepForPage(recorded)));
}
