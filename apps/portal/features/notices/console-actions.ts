"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  sendAlternativeService,
  sendNoticeReissue,
  sendNoticeWithdrawal,
  sendPolicyApproval,
  sendPolicyClass,
  sendPolicyVersion,
  sendPolicyWithdrawal,
  sendRunContinuation,
  sendTemplateApproval,
  sendTemplateVersion,
  sendTrackChange,
  sendVersionForApproval,
  type ClassInput,
  type ConsoleAttempt,
} from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { askedDay } from "./console";

/*
 * The notice console's acts. Any member of staff may send one; the backend decides by their roles who may do it, so
 * a preparer who tries to approve meets the segregation refusal there. Each act redirects to the page it belongs
 * to, with what it did or the refusal kept for that page (`?attempt=`).
 */

const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const versionOf = (form: FormData): number => {
  const value = Number(text(form, "version"));
  if (!Number.isInteger(value) || value < 1) throw new Error("A policy act names one version by its number.");
  return value;
};

/** A day field: its ISO date, null when left empty, and whether something was typed that is not a day. */
function dayField(form: FormData, name: string): { iso: string | null; unreadable: boolean } {
  const typed = text(form, name).trim();
  const iso = askedDay(typed);
  return { iso, unreadable: typed !== "" && iso === null };
}

const yesNo = (value: string): boolean | null => (value === "yes" ? true : value === "no" ? false : null);

/** Prepare a version on SCR-COM-01: it opens on SCR-COM-02, or the refusal stands beside the dates. */
export async function preparePolicyAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const from = dayField(form, "period-from");
  const to = dayField(form, "period-to");
  const answer = await sendPolicyVersion(staff, { effectiveFrom: from.iso, effectiveTo: to.iso, unreadable: from.unreadable || to.unreadable, restate: text(form, "restate") === "on" });
  revalidatePath(routes.opsNoticePolicies());
  if (answer.refusal !== null) {
    const attempt: ConsoleAttempt = { page: "policy", refusal: answer.refusal, typed: { from: text(form, "period-from"), to: text(form, "period-to") } };
    redirect(withAttempt(routes.opsNoticePolicies(), keepForPage(attempt)));
  }
  redirect(routes.opsNoticePolicy(answer.accepted.versionNo));
}

/** Add a class on SCR-COM-02, or the refusal beside the designation that is unset. */
export async function addClassAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const version = versionOf(form);
  const input: ClassInput = {
    classCode: text(form, "class"),
    eventKind: text(form, "event"),
    recipientRole: text(form, "recipient"),
    channels: form.getAll("channels").filter((value): value is string => typeof value === "string"),
    subjectKinds: form.getAll("subjects").filter((value): value is string => typeof value === "string"),
    isRequired: yesNo(text(form, "required")),
    requiresProof: yesNo(text(form, "proof")),
    requiredActionRule: text(form, "action") !== "" ? text(form, "action") : null,
    leadTimeDays: text(form, "lead"),
  };
  const answer = await sendPolicyClass(staff, version, input);
  revalidatePath(routes.opsNoticePolicy(version));
  const attempt: ConsoleAttempt =
    answer.refusal !== null ? { page: "class", version, refusal: answer.refusal, typed: input } : { page: "class-added", version, classCode: answer.accepted.classCode };
  redirect(withAttempt(routes.opsNoticePolicy(version), keepForPage(attempt)));
}

/** Send for approval, confirmed on SCR-COM-02: SCR-COM-03 opens on the version, or the refusal names the class. */
export async function sendForApprovalAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const version = versionOf(form);
  const answer = await sendVersionForApproval(staff, version);
  revalidatePath(routes.opsNoticePolicies());
  if (answer.refusal !== null) {
    const attempt: ConsoleAttempt = { page: "send", version, refusal: answer.refusal };
    redirect(withAttempt(routes.opsNoticePolicy(version), keepForPage(attempt)));
  }
  const done: ConsoleAttempt = { page: "approved", version, act: "send" };
  redirect(withAttempt(routes.opsNoticePolicyApproval(version), keepForPage(done)));
}

/** Approve or Withdraw on SCR-COM-03, confirmed: the page says what was recorded, or the refusal in its header. */
export async function decidePolicyAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const version = versionOf(form);
  const intent = text(form, "intent") === "withdraw" ? "withdraw" : "approve";
  const note = text(form, "note").slice(0, 500);
  const reason = text(form, "reason").slice(0, 500);
  const answer = intent === "approve" ? await sendPolicyApproval(staff, version, note) : await sendPolicyWithdrawal(staff, version, reason);
  revalidatePath(routes.opsNoticePolicies());
  revalidatePath(routes.opsNoticePolicy(version));
  const attempt: ConsoleAttempt =
    answer.refusal !== null ? { page: "approval", version, refusal: answer.refusal, note, reason } : { page: "approved", version, act: intent };
  redirect(withAttempt(routes.opsNoticePolicyApproval(version), keepForPage(attempt)));
}

/** Prepare a template version on SCR-COM-04, or the refusal beside the body or the period. */
export async function prepareTemplateAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const classCode = text(form, "class");
  const from = dayField(form, "period-from");
  const to = dayField(form, "period-to");
  const answer = await sendTemplateVersion(staff, {
    classCode,
    language: text(form, "language"),
    body: text(form, "body"),
    effectiveFrom: from.iso,
    effectiveTo: to.iso,
    unreadable: from.unreadable || to.unreadable,
  });
  revalidatePath(routes.opsNoticeTemplates(classCode));
  const attempt: ConsoleAttempt =
    answer.refusal !== null
      ? { page: "template", classCode, refusal: answer.refusal, typed: { language: text(form, "language"), body: text(form, "body"), from: text(form, "period-from"), to: text(form, "period-to") } }
      : { page: "template-done", classCode, act: "prepare", versionNo: answer.accepted.versionNo, language: text(form, "language") };
  redirect(withAttempt(routes.opsNoticeTemplates(classCode), keepForPage(attempt)));
}

/** Approve a template version on SCR-COM-04, confirmed, or the refusal naming the preparer. */
export async function approveTemplateAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const classCode = text(form, "class");
  const answer = await sendTemplateApproval(staff, text(form, "template"));
  revalidatePath(routes.opsNoticeTemplates(classCode));
  const attempt: ConsoleAttempt =
    answer.refusal !== null
      ? { page: "template-approval", classCode, refusal: answer.refusal }
      : { page: "template-done", classCode, act: "approve", versionNo: answer.accepted.versionNo, language: answer.accepted.language };
  redirect(withAttempt(routes.opsNoticeTemplates(classCode), keepForPage(attempt)));
}

/** Record the service on SCR-COM-09, confirmed: back on the recovery queue with what was recorded, or the refusal inline. */
export async function recordServiceAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const reference = text(form, "notice");
  if (!/^COM-[A-Z0-9]{10}$/.test(reference)) throw new Error("A service names one notice by its reference.");
  const servedOn = dayField(form, "servedOn");
  const typed = { route: text(form, "route").slice(0, 200), servedOn: text(form, "servedOn"), evidence: text(form, "evidence").slice(0, 200) };
  const answer = await sendAlternativeService(staff, reference, { route: typed.route, servedOn: servedOn.iso, unreadable: servedOn.unreadable, evidence: typed.evidence });
  revalidatePath(routes.opsNoticeRecovery());
  if (answer.refusal !== null) {
    const attempt: ConsoleAttempt = { page: "service", reference, refusal: answer.refusal, typed };
    redirect(withAttempt(routes.opsNoticeService(reference), keepForPage(attempt)));
  }
  const done: ConsoleAttempt = { page: "served", reference, servedOn: answer.accepted.servedOn };
  redirect(withAttempt(routes.opsNoticeRecovery(), keepForPage(done)));
}

/** Issue the outstanding notices on SCR-COM-13, confirmed: the counts move, or the refusal says how many remain. */
export async function continueRunAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const run = text(form, "run");
  if (!/^TCN-[A-Z0-9]{10}$/.test(run)) throw new Error("A run is continued by its reference.");
  const answer = await sendRunContinuation(staff, run);
  revalidatePath(routes.opsTrackChanges());
  const attempt: ConsoleAttempt = answer.refusal !== null ? { page: "run", run, refusal: answer.refusal, issued: 0 } : { page: "run", run, refusal: null, issued: answer.accepted.issued };
  redirect(withAttempt(routes.opsTrackChange(run), keepForPage(attempt)));
}

const NOTICE_REFERENCE = /^COM-[A-Z0-9]{10}$/;

/**
 * Reissue on SCR-COM-07 (the notice opened beside the queue), confirmed: the queue opens on the new notice with what
 * was done, or on this one with the refusal beside the reason.
 */
export async function reissueNoticeAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const reference = text(form, "notice");
  if (!NOTICE_REFERENCE.test(reference)) throw new Error("A reissue names one notice by its reference.");
  const reason = text(form, "reason").slice(0, 500);
  const answer = await sendNoticeReissue(staff, reference, reason);
  revalidatePath(routes.opsNotices());
  const attempt: ConsoleAttempt =
    answer.refusal !== null ? { page: "reissue", reference, refusal: answer.refusal, reissued: null, reason } : { page: "reissue", reference, refusal: null, reissued: answer.accepted.reference, reason };
  redirect(withAttempt(routes.opsNotices({ notice: answer.accepted?.reference ?? reference }), keepForPage(attempt)));
}

/** Withdraw on SCR-COM-09, confirmed: the page shows the notice closed unserved, or the refusal. */
export async function withdrawNoticeAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const reference = text(form, "notice");
  if (!NOTICE_REFERENCE.test(reference)) throw new Error("A withdrawal names one notice by its reference.");
  const reason = text(form, "reason").slice(0, 500);
  const answer = await sendNoticeWithdrawal(staff, reference, reason);
  revalidatePath(routes.opsNoticeRecovery());
  const attempt: ConsoleAttempt = { page: "withdraw", reference, refusal: answer.refusal, reason };
  redirect(withAttempt(routes.opsNoticeService(reference), keepForPage(attempt)));
}

/**
 * Record a change the catalogue reported, on SCR-COM-13: the run it raised opens with its counts, a run held because
 * it resolved nobody included; a missing field is refused beside it on the list of runs.
 */
export async function recordTrackChangeAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const typed = { track: text(form, "track").slice(0, 60), kind: text(form, "kind"), when: text(form, "when") };
  const day = askedDay(typed.when);
  const answer = await sendTrackChange(staff, { trackRef: typed.track, changeKind: typed.kind, effectiveAt: day !== null ? new Date(`${day}T00:00:00+07:00`).toISOString() : null });
  revalidatePath(routes.opsTrackChanges());
  const run = answer.accepted?.run ?? (answer.refusal?.code === "TRACK_CHANGE_RUN_EMPTY" ? String(answer.refusal.values.run ?? "") : "");
  if (run !== "") {
    const done: ConsoleAttempt = { page: "run", run, refusal: null, issued: answer.accepted?.issued ?? 0 };
    redirect(answer.accepted !== null ? withAttempt(routes.opsTrackChange(run), keepForPage(done)) : routes.opsTrackChange(run));
  }
  const attempt: ConsoleAttempt = { page: "track-change", refusal: answer.refusal ?? { code: "FIELD_MISSING", field: null, values: {} }, typed };
  redirect(withAttempt(routes.opsTrackChanges(), keepForPage(attempt)));
}
