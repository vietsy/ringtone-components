"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  sendApplication,
  sendAssessment,
  sendAssuranceApproval,
  sendAssuranceDraft,
  sendCondition,
  sendEnrolment,
  sendOfflineApproval,
  sendOfflineDraft,
  sendReinstatement,
  sendRevocation,
  sendRuleSetApproval,
  sendRuleSetDraft,
  sendSuspension,
  type ApplyAttempt,
  type ApproveAttempt,
  type AssessAttempt,
  type AssuranceAttempt,
  type AssurancePart,
  type ConditionAttempt,
  type ConditionInput,
  type CredentialAct,
  type CredentialAttempt,
  type EnrolAttempt,
  type GovernedPolicy,
  type OfflineAttempt,
  type OfflinePart,
  type RuleSetAttempt,
  type RuleSetField,
} from "@/lib/api/player";
import type { CommandAnswer } from "@/lib/api/venue";
import { requireStaff, worldForAct } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { isoDate, text } from "./fields";

/*
 * The Player device acts. Each asks who is acting - a member of staff, or, on the public register and on the device,
 * the browser's world - sends its command through the seam, which checks the role again with everything else the
 * contract checks, and moves the person on to the screen the board says comes next. A refused act goes back to the
 * page it was made on with the attempt kept (`keepForPage`), so the page draws the refusal where the act was, with
 * the values as entered.
 */

const DEVICE = /^PLY-\d{4}$/;
const CERTIFICATION = /^CRT-[0-9A-Z]{10}$/;
const CREDENTIAL = /^DCR-[0-9A-Z]{10}$/;

function named(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new Error(`The form names no ${what}.`);
  return value;
}

/** A refusal's code, or no code where the API names only a field the form left wrong. */
const codeOf = (refusal: { code: string } | null) => (refusal === null || refusal.code === "FIELD_INVALID" || refusal.code === "FIELD_MISSING" ? null : refusal.code);

// ---------------------------------------------------------------- SCR-PLR-03 Enrol a device

const ENROL_FIELDS = { device_identity: "identity", supplier_name: "supplier", premises_id: "premises" } as const;

/** Enrol (SCR-PLR-03): the new device's record, or the refusal in place of the result panel with what was typed kept. */
export async function enrolDevice(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const values = { identity: text(formData, "device_identity"), supplier: text(formData, "supplier_name"), premises: text(formData, "premises_id") };
  const answer = (await sendEnrolment(staff, values)).data;
  if (answer === null) redirect(routes.opsEnrolDevice());
  if (answer.accepted !== null) redirect(routes.opsDevice(answer.accepted.device));
  const { code, field } = answer.refusal;
  const attempt: EnrolAttempt = {
    page: "enrol",
    values,
    code: codeOf(answer.refusal),
    field: code === "FIELD_INVALID" && field !== null && field in ENROL_FIELDS ? ENROL_FIELDS[field as keyof typeof ENROL_FIELDS] : null,
    existing: code === "DEVICE_ALREADY_ENROLLED" ? field : null,
  };
  redirect(withAttempt(routes.opsEnrolDevice(), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-PLR-02 Record a condition

const CONDITION_FIELDS = { premises_id: "premises", reported_at: "reported" } as const;

/**
 * Record a condition (SCR-PLR-02), confirmed in its dialog: the record with the condition in force or waiting for its
 * time, or the refusal. The operations officer and the security officer record (PERM-473); the API says which may
 * transfer.
 */
export async function recordCondition(device: string, formData: FormData): Promise<void> {
  named(device, DEVICE, "device");
  const staff = await requireStaff("ACT-OPS", "ACT-SEC");
  const values: ConditionInput = {
    condition: text(formData, "condition"),
    cause: text(formData, "cause"),
    effectiveFrom: text(formData, "effective_from"),
    reportedAt: text(formData, "reported_at"),
    premises: text(formData, "premises_id"),
    pending: text(formData, "pending_evidence_decision"),
    ground: text(formData, "discard_ground"),
  };
  const answer = (await sendCondition(staff, device, values)).data;
  if (answer === null) redirect(routes.opsDevice(device));
  const refusal = answer.refusal;
  const field = refusal?.code === "FIELD_INVALID" ? (refusal.field !== null && refusal.field in CONDITION_FIELDS ? CONDITION_FIELDS[refusal.field as keyof typeof CONDITION_FIELDS] : "condition") : null;
  const attempt: ConditionAttempt = {
    page: "condition",
    device,
    values,
    code: codeOf(refusal),
    field,
    done: answer.accepted?.status ?? null,
    doneFrom: answer.accepted?.effectiveFrom ?? null,
    doneInForce: answer.accepted?.inForce ?? false,
  };
  redirect(withAttempt(routes.opsDevice(device), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-PLR-13 Draft

const PARTS: readonly OfflinePart[] = ["max", "exceeded", "propagation", "grace", "from"];

/** Draft (SCR-PLR-13): the new version in DRAFT, or POLICY_INCOMPLETE naming the part missing, above the action row. */
export async function draftOfflinePolicy(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-EVD");
  const values = {
    maxOfflineHours: text(formData, "max_offline_hours"),
    exceeded: text(formData, "when_exceeded"),
    propagation: text(formData, "propagation_rule"),
    graceHours: text(formData, "grace_period_hours"),
    effectiveFrom: isoDate(text(formData, "effective_from")),
  };
  const answer = (await sendOfflineDraft(staff, values)).data;
  if (answer === null) redirect(routes.evidenceOfflinePolicy());
  const part = PARTS.find((candidate) => candidate === answer.refusal?.field) ?? null;
  const attempt: OfflineAttempt = { page: "offline", values, code: codeOf(answer.refusal), part, saved: answer.accepted?.no ?? null };
  redirect(withAttempt(routes.evidenceOfflinePolicy(), keepForPage(attempt)));
}

// ---------------------------------------------------------------- Approve, on the screen that shows the draft

/** The version an Approve names, from the form's own binding. */
function versionNo(no: number): number {
  if (!Number.isInteger(no) || no <= 0) throw new Error("The form names no policy version.");
  return no;
}

/** The approval's answer kept for the page that shows the draft: done, or the refusal with the part or version it names. */
function approval(policy: GovernedPolicy, no: number, values: ApproveAttempt["values"], answer: CommandAnswer<unknown>): ApproveAttempt {
  const refusal = answer.refusal;
  return {
    page: "approve",
    policy,
    no,
    values,
    code: refusal?.code ?? null,
    part: refusal !== null && (refusal.code === "POLICY_INCOMPLETE" || refusal.code === "POLICY_VERSION_INCOMPLETE") ? refusal.field : null,
    overlaps: refusal?.code === "EFFECTIVE_PERIOD_OVERLAPS" ? refusal.item : null,
    done: answer.accepted !== null,
  };
}

/**
 * Approve (SCR-PLR-13): the specification draws no control for POST /offline-continuity-policy-versions/{id}/approve,
 * so it sits on the screen that shows the draft. Approved, the version governs from its effective date.
 */
export async function approveOfflinePolicy(no: number, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-EVD");
  const values = { note: text(formData, "approval_note"), publish: false };
  const answer = (await sendOfflineApproval(staff, versionNo(no), values.note)).data;
  if (answer === null) redirect(routes.evidenceOfflinePolicy());
  redirect(withAttempt(routes.evidenceOfflinePolicy(), keepForPage(approval("offline", no, values, answer))));
}

// ---------------------------------------------------------------- SCR-PLR-11 on the evidence console: Draft and Approve

const ASSURANCE_PARTS: readonly AssurancePart[] = ["criteria", "authority", "validity", "withdrawal", "from"];

/** Draft (SCR-PLR-11 on the evidence console): the version in DRAFT, or POLICY_VERSION_INCOMPLETE naming the part. */
export async function draftAssurancePolicy(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-EVD");
  const values = {
    criteria: text(formData, "criteria"),
    authority: text(formData, "issuing_authority"),
    validityMonths: text(formData, "validity_period_months"),
    withdrawal: text(formData, "withdrawal_grounds"),
    effectiveFrom: isoDate(text(formData, "effective_from")),
  };
  const answer = (await sendAssuranceDraft(staff, values)).data;
  if (answer === null) redirect(routes.evidenceAssurancePolicy());
  const part = ASSURANCE_PARTS.find((candidate) => candidate === answer.refusal?.field) ?? null;
  const attempt: AssuranceAttempt = { page: "assurance", values, code: codeOf(answer.refusal), part, saved: answer.accepted?.no ?? null };
  redirect(withAttempt(routes.evidenceAssurancePolicy(), keepForPage(attempt)));
}

/** Approve and publish (SCR-PLR-11 on the evidence console), or approve and keep the criteria unpublished. */
export async function approveAssurancePolicy(no: number, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-EVD");
  const values = { note: "", publish: text(formData, "publish") === "true" };
  const answer = (await sendAssuranceApproval(staff, versionNo(no), values.publish)).data;
  if (answer === null) redirect(routes.evidenceAssurancePolicy());
  redirect(withAttempt(routes.evidenceAssurancePolicy(), keepForPage(approval("assurance", no, values, answer))));
}

// ---------------------------------------------------------------- SCR-PLR-15's rule set: Draft and Approve

const RULE_FIELDS: readonly RuleSetField[] = ["loudness", "transitions", "from"];

/** Draft a loudness and transition rule-set version: in DRAFT, or the refusal naming what it lacks. */
export async function draftRuleSet(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-EVD");
  const values = {
    loudness: text(formData, "loudness_rules"),
    transitions: text(formData, "transition_rules"),
    effectiveFrom: isoDate(text(formData, "effective_from")),
    premises: "",
  };
  const answer = (await sendRuleSetDraft(staff, values)).data;
  if (answer === null) redirect(routes.evidencePlaybackRules());
  const field = RULE_FIELDS.find((candidate) => candidate === answer.refusal?.field) ?? null;
  const attempt: RuleSetAttempt = { page: "rules", values, code: codeOf(answer.refusal), field, saved: answer.accepted?.no ?? null };
  redirect(withAttempt(routes.evidencePlaybackRules(), keepForPage(attempt)));
}

/** Approve a rule-set version, with the note the audit record keeps. */
export async function approveRuleSet(no: number, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-EVD");
  const values = { note: text(formData, "approval_note"), publish: false };
  const answer = (await sendRuleSetApproval(staff, versionNo(no), values.note)).data;
  if (answer === null) redirect(routes.evidencePlaybackRules());
  redirect(withAttempt(routes.evidencePlaybackRules(), keepForPage(approval("rules", no, values, answer))));
}

// ---------------------------------------------------------------- SCR-PLR-10 Apply, and Assess on the console

/** Apply (SCR-PLR-10), by any supplier, with no account: the register with the application in it, or the refusal. */
export async function applyForCertification(formData: FormData): Promise<void> {
  const world = await worldForAct();
  const values = { applicant: text(formData, "applicant_name"), version: text(formData, "assurance_policy_version_id") };
  const answer = (await sendApplication(world, values)).data;
  if (answer === null) redirect(routes.certificationRegister());
  const attempt: ApplyAttempt = {
    page: "apply",
    values,
    code: codeOf(answer.refusal),
    field: answer.refusal?.code === "FIELD_MISSING" ? "applicant" : null,
    lodged: answer.accepted?.id ?? null,
  };
  redirect(withAttempt(routes.certificationRegister(), keepForPage(attempt)));
}

/** Assess (SCR-PLR-10 on the evidence console): certified, or refused with the criterion not met. */
export async function assessCertification(certification: string, formData: FormData): Promise<void> {
  named(certification, CERTIFICATION, "certification");
  const staff = await requireStaff("ACT-EVD");
  const values = { outcome: text(formData, "outcome"), criterion: text(formData, "refusal_criterion") };
  const answer = (await sendAssessment(staff, certification, values)).data;
  if (answer === null) redirect(routes.evidenceCertification());
  const attempt: AssessAttempt = {
    page: "assess",
    certification,
    values,
    code: codeOf(answer.refusal),
    field: answer.refusal?.code === "FIELD_INVALID" ? "outcome" : null,
    done: answer.accepted?.status ?? null,
  };
  redirect(withAttempt(routes.evidenceCertification(), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-IAM-08 Suspend, Reinstate, Revoke

/** Suspend, Reinstate or Revoke (SCR-IAM-08), each confirmed in its dialog: the device's page with its new state, or the refusal. */
export async function actOnCredential(credential: string, act: CredentialAct, formData: FormData): Promise<void> {
  named(credential, CREDENTIAL, "device credential");
  const staff = await requireStaff("ACT-OPS", "ACT-SEC");
  const words = text(formData, act === "revoke" ? "revocation_cause" : "reason");
  const effectiveAt = text(formData, "revoked_at");
  // The dialogue offers no change to the evidence; a request that asks for one anyway is refused by the backend.
  const asked = text(formData, "evidence_change").toUpperCase();
  const evidence = asked === "REMOVE" || asked === "AMEND" ? asked : null;
  const outcome =
    act === "suspend"
      ? await sendSuspension(staff, credential, words)
      : act === "reinstate"
        ? await sendReinstatement(staff, credential, words)
        : await sendRevocation(staff, credential, words, effectiveAt, evidence);
  const answer = outcome.data;
  if (answer === null) redirect(routes.opsDeviceCredential(credential));
  const attempt: CredentialAttempt = {
    page: "credential",
    credential,
    act,
    values: { text: words, effectiveAt },
    code: answer.refusal?.code ?? null,
    field: answer.refusal?.field ?? null,
    done: answer.accepted !== null,
  };
  redirect(withAttempt(routes.opsDeviceCredential(credential), keepForPage(attempt)));
}
