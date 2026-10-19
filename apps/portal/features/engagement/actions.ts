"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  sendActionValue,
  sendAddAction,
  sendApproveVersion,
  sendAuthorisation,
  sendCorrection,
  sendDisclosureVersion,
  sendEndDisclosure,
  sendMetricDefinition,
  sendPointDisposition,
  sendPrepareVersion,
  sendPublication,
  sendQualifyingAction,
  sendReferralRequest,
  sendRelease,
  sendReleaseWithdrawal,
  sendRemoveAction,
  sendResumption,
  sendSnapshot,
  sendStopTakingPart,
  sendSubmitVersion,
  sendSupportRead,
  sendSuspension,
  sendTakePart,
  sendWithdrawVersion,
  type EngagementAnswer,
  type EngagementAttempt,
} from "@/lib/api/engagement";
import { requireArtist, requireStaff } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { readInstant } from "./copy";
import { requirePortal } from "./participant";

/*
 * Every engagement act: the seam's command, then the screen that comes next. A refusal goes back to the page the act
 * was made on, kept for it with what the reader typed (`keepForPage`), so a reload shows the same and nothing typed is
 * lost; a completed act is kept the same way where the page says what it did.
 */

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/** Everything a form sent, as typed, so the page can give it back beside a refusal. */
const typed = (form: FormData, ...names: readonly string[]) => Object.fromEntries(names.map((name) => [name, text(form, name)]));

const kept = (page: string, answer: EngagementAnswer<unknown>, form: Readonly<Record<string, string>> = {}, done: string | null = null): string =>
  keepForPage({ page, refusal: answer.refusal, done, form } satisfies EngagementAttempt);

/** A command the seam could not send at all is our outage, not the reader's refusal: the error boundary says so. */
function unsent(answer: EngagementAnswer<unknown>): void {
  if (answer.refusal?.code === "SERVICE_NOT_CONFIGURED") throw new Error("The engagement service is not configured.");
}

const back = (path: Route, page: string, answer: EngagementAnswer<unknown>, form: Readonly<Record<string, string>> = {}): never =>
  redirect(withAttempt(path, kept(page, answer, form)));

/** A whole number from a form, or null: a version or a page names one. */
function number(form: FormData, name: string): number {
  const value = Number(text(form, name));
  if (!Number.isSafeInteger(value) || value < 1) notFound();
  return value;
}

/** Every act on the participation or the ledger changes what the participant's pages read, in both portals. */
function forgetParticipantPages(): void {
  for (const path of [routes.engagement(), routes.engagementBalance(), routes.engagementPoints()]) revalidatePath(path);
  for (const path of [routes.artistEngagement(), routes.artistEngagementBalance(), routes.artistEngagementPoints(), routes.artistReferral()]) revalidatePath(path);
}

// ------------------------------------------------------------------ SCR-ENG-01 to 05, in the portal named

/**
 * Take part: POST /engagement/participation, then the balance and history it opens (SCR-ENG-02). The page names its
 * portal (`premises` or `artist`); the session decides who takes part.
 */
export async function takePartAct(kind: string): Promise<void> {
  const portal = await requirePortal(kind);
  const answer = await sendTakePart(portal.who);
  unsent(answer);
  forgetParticipantPages();
  if (answer.refusal !== null) back(portal.home, "eng01", answer);
  redirect(portal.balance());
}

/** Stop taking part: no confirmation and no reason asked, whatever the capability's state (`PERM-135`). */
export async function stopTakingPartAct(kind: string): Promise<void> {
  const portal = await requirePortal(kind);
  const answer = await sendStopTakingPart(portal.who);
  unsent(answer);
  forgetParticipantPages();
  redirect(withAttempt(portal.home, kept("eng01", answer, {}, answer.refusal === null ? "stopped" : null)));
}

/**
 * Use points, submitted anyway while its control is drawn disabled: POST /engagement/point-dispositions refuses while
 * `DEC-30` is not effective and records the attempt, and SCR-ENG-03 draws the refusal from its code.
 */
export async function pointDispositionAct(kind: string, form: FormData): Promise<void> {
  const portal = await requirePortal(kind);
  const answer = await sendPointDisposition(portal.who, text(form, "disposition_kind"));
  unsent(answer);
  redirect(withAttempt(portal.points, kept("eng03", answer)));
}

/** Request a reference (SCR-ENG-05): the artist's own; a repeat returns the reference already issued. */
export async function requestReferralAct(): Promise<void> {
  const artist = await requireArtist();
  const answer = await sendReferralRequest(artist);
  unsent(answer);
  revalidatePath(routes.artistReferral());
  const done = answer.accepted === null ? null : answer.accepted.replay ? "replay" : "issued";
  redirect(withAttempt(routes.artistReferral(), kept("eng05", answer, {}, done)));
}

// ------------------------------------------------------------------ SCR-ENG-06 and 07

const RULES: readonly ["ACT-POL-PRE", "ACT-POL-APR", "ACT-AUD", "ACT-OPS", "ACT-DPO"] = ["ACT-POL-PRE", "ACT-POL-APR", "ACT-AUD", "ACT-OPS", "ACT-DPO"];

function forgetRules(no: number): void {
  revalidatePath(routes.policyAwardRules());
  revalidatePath(routes.policyAwardRuleEditor(no));
}

/** Prepare a version: a new PREPARED version, opened in the editor (SCR-ENG-07). */
export async function prepareVersionAct(): Promise<void> {
  const staff = await requireStaff(...RULES);
  const answer = await sendPrepareVersion(staff);
  unsent(answer);
  if (answer.refusal !== null) back(routes.policyAwardRules(), "eng06", answer);
  revalidatePath(routes.policyAwardRules());
  redirect(routes.policyAwardRuleEditor(answer.accepted?.no ?? 1));
}

/** Approve, after its confirmation naming the effective instant (SCR-ENG-06). */
export async function approveVersionAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...RULES);
  const no = number(form, "version");
  const answer = await sendApproveVersion(staff, no, readInstant(text(form, "effective_from")));
  unsent(answer);
  forgetRules(no);
  const attempt = kept("eng06", answer, typed(form, "effective_from", "reason"), answer.refusal === null ? "approved" : null);
  redirect(withAttempt(routes.policyAwardRules(no), attempt));
}

/** Withdraw a PREPARED or APPROVED version, with its reason (SCR-ENG-06). */
export async function withdrawVersionAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...RULES);
  const no = number(form, "version");
  const answer = await sendWithdrawVersion(staff, no, text(form, "reason"));
  unsent(answer);
  forgetRules(no);
  const attempt = kept("eng06", answer, typed(form, "effective_from", "reason"), answer.refusal === null ? "withdrawn" : null);
  redirect(withAttempt(routes.policyAwardRules(no), attempt));
}

/** Add an action to a PREPARED version (SCR-ENG-07). */
export async function addActionAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...RULES);
  const no = number(form, "version");
  const answer = await sendAddAction(staff, no, { code: text(form, "action_code"), value: text(form, "award_value"), participantClass: text(form, "participant_class") });
  unsent(answer);
  forgetRules(no);
  if (answer.refusal !== null) back(routes.policyAwardRuleEditor(no), "eng07", answer, typed(form, "action_code", "award_value", "participant_class"));
  redirect(routes.policyAwardRuleEditor(no));
}

/** Change the value of an action the version already lists (SCR-ENG-07). */
export async function changeActionValueAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...RULES);
  const no = number(form, "version");
  const code = text(form, "action_code");
  const answer = await sendActionValue(staff, no, code, text(form, "award_value"));
  unsent(answer);
  forgetRules(no);
  if (answer.refusal !== null) back(routes.policyAwardRuleEditor(no, code), "eng07", answer, typed(form, "award_value"));
  redirect(routes.policyAwardRuleEditor(no));
}

/** Remove an action from a PREPARED version, sent at once from its row (SCR-ENG-07). */
export async function removeActionAct(no: number, code: string): Promise<void> {
  const staff = await requireStaff(...RULES);
  const answer = await sendRemoveAction(staff, no, code);
  unsent(answer);
  forgetRules(no);
  if (answer.refusal !== null) back(routes.policyAwardRuleEditor(no), "eng07", answer);
  redirect(routes.policyAwardRuleEditor(no));
}

/** Submit for approval: the effective instant and the referral setting, then back to the versions (SCR-ENG-06). */
export async function submitVersionAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...RULES);
  const no = number(form, "version");
  const answer = await sendSubmitVersion(staff, no, { effectiveFrom: readInstant(text(form, "effective_from")), referral: text(form, "referral") === "yes" });
  unsent(answer);
  forgetRules(no);
  if (answer.refusal !== null) back(routes.policyAwardRuleEditor(no), "eng07", answer, typed(form, "effective_from", "referral"));
  redirect(withAttempt(routes.policyAwardRules(no), kept("eng06", answer, {}, "submitted")));
}

// ------------------------------------------------------------------ SCR-ENG-13

/** End the effective disclosure version, after its confirmation: participants are shown no figure until one is effective. */
export async function endDisclosureAct(): Promise<void> {
  const staff = await requireStaff(...RULES);
  const answer = await sendEndDisclosure(staff);
  unsent(answer);
  revalidatePath(routes.policyDisclosure());
  forgetParticipantPages();
  redirect(withAttempt(routes.policyDisclosure(), kept("eng13-end", answer, {}, answer.refusal === null ? "ended" : null)));
}

/** Approve a disclosure version, after its confirmation; a refusal keeps the draft as typed. */
export async function approveDisclosureAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...RULES);
  const answer = await sendDisclosureVersion(staff, {
    textEn: text(form, "treatment_text_en"),
    textVi: text(form, "treatment_text_vi"),
    reservingDecision: text(form, "reserving_decision"),
    effectiveFrom: readInstant(text(form, "effective_from")),
  });
  unsent(answer);
  revalidatePath(routes.policyDisclosure());
  forgetParticipantPages();
  const draft = typed(form, "treatment_text_en", "treatment_text_vi", "reserving_decision", "effective_from");
  redirect(withAttempt(routes.policyDisclosure(), kept("eng13", answer, answer.refusal !== null ? draft : {}, answer.refusal === null ? "approved" : null)));
}

// ------------------------------------------------------------------ the operations console (SCR-ENG-08 to 12)

const OPERATIONS: readonly ["ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD"] = ["ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD"];

function forgetOperations(): void {
  revalidatePath(routes.opsEngagement());
  revalidatePath(routes.opsEngagementRelease());
  revalidatePath(routes.opsEngagementMetrics());
  forgetParticipantPages();
}

/** Record: POST /engagement/qualifying-actions; the screen returns to itself with the event recorded (SCR-ENG-08). */
export async function recordQualifyingActionAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const participant = text(form, "participant");
  const at = text(form, "at");
  const answer = await sendQualifyingAction(staff, {
    participant,
    code: text(form, "action_code"),
    at: readInstant(at),
    subject: text(form, "subject_ref"),
    profile: text(form, "display_profile_ref"),
  });
  unsent(answer);
  forgetOperations();
  const asked = { participant, at };
  const given = typed(form, "action_code", "subject_ref", "display_profile_ref");
  if (answer.refusal !== null) back(routes.opsQualifyingAction(asked), "eng08", answer, given);
  redirect(withAttempt(routes.opsQualifyingAction({ ...asked, recorded: answer.accepted?.event ?? null }), kept("eng08", answer, given, answer.accepted?.replay === true ? "replay" : "recorded")));
}

/** Find: the purpose is recorded with the read before anything is shown (SCR-ENG-10). */
export async function supportReadAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const answer = await sendSupportRead(staff, text(form, "participant"), text(form, "purpose"));
  unsent(answer);
  if (answer.refusal !== null) back(routes.opsEngagementSupport(), "eng10", answer, typed(form, "participant", "purpose"));
  redirect(routes.opsEngagementSupport({ read: answer.accepted?.read ?? null }));
}

/** Propose: POST /engagement/corrections; the correction opens, waiting for a second person (SCR-ENG-09). */
export async function proposeCorrectionAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const read = text(form, "read");
  const event = text(form, "event");
  const answer = await sendCorrection(staff, read, { event, ground: text(form, "ground"), delta: text(form, "point_delta") });
  unsent(answer);
  forgetOperations();
  if (answer.refusal !== null) back(routes.opsCorrectionNew(read, event), "eng09", answer, typed(form, "ground", "point_delta"));
  redirect(routes.opsCorrection(answer.accepted?.correction ?? ""));
}

/** Authorise, after its confirmation: the correcting event is recorded and cannot be undone (SCR-ENG-09). */
export async function authoriseCorrectionAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const correction = text(form, "correction");
  const answer = await sendAuthorisation(staff, correction);
  unsent(answer);
  forgetOperations();
  redirect(withAttempt(routes.opsCorrection(correction), kept("eng09", answer, {}, answer.refusal === null ? "authorised" : null)));
}

/** Release, Suspend, Resume or Withdraw (SCR-ENG-12): one form, the act in `intent`, each confirmed where the spec asks. */
export async function releaseAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const intent = text(form, "intent");
  const scope = form.getAll("scope").filter((value): value is string => typeof value === "string");
  const answer =
    intent === "suspend"
      ? await sendSuspension(staff, text(form, "ground"))
      : intent === "resume"
        ? await sendResumption(staff)
        : intent === "withdraw"
          ? await sendReleaseWithdrawal(staff, text(form, "ground"))
          : await sendRelease(staff, { scope, effectiveFrom: readInstant(text(form, "effective_from")) });
  unsent(answer);
  forgetOperations();
  const page = `eng12-${intent === "suspend" || intent === "resume" || intent === "withdraw" ? intent : "release"}`;
  const given = { ...typed(form, "effective_from", "ground"), scope: scope.join(",") };
  redirect(withAttempt(routes.opsEngagementRelease(), kept(page, answer, answer.refusal !== null ? given : {}, answer.refusal === null ? intent : null)));
}

/** Approve a definition version of a metric (SCR-ENG-11), the evidence of `CG-ENG`'s metric ownership. */
export async function defineMetricAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const metric = text(form, "metric");
  const answer = await sendMetricDefinition(staff, metric, text(form, "statement"), readInstant(text(form, "effective_from")));
  unsent(answer);
  forgetOperations();
  if (answer.refusal !== null) back(routes.opsEngagementMetrics({ define: metric }), "eng11-define", answer, typed(form, "statement", "effective_from"));
  redirect(withAttempt(routes.opsEngagementMetrics(), kept("eng11-define", answer, { metric }, "defined")));
}

/** Prepare a snapshot for a month (SCR-ENG-11); the snapshot opens, its figures beside the ledger's. */
export async function prepareSnapshotAct(form: FormData): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const answer = await sendSnapshot(staff, text(form, "metric"), text(form, "month"));
  unsent(answer);
  revalidatePath(routes.opsEngagementMetrics());
  if (answer.refusal !== null) back(routes.opsEngagementMetrics(), "eng11-prepare", answer, typed(form, "metric", "month"));
  redirect(routes.opsEngagementMetrics({ snapshot: answer.accepted?.snapshot ?? null }));
}

/** Publish a prepared snapshot, sent at once from its row; a refused one stays on the table as refused (SCR-ENG-11). */
export async function publishSnapshotAct(snapshot: string): Promise<void> {
  const staff = await requireStaff(...OPERATIONS);
  const answer = await sendPublication(staff, snapshot);
  unsent(answer);
  revalidatePath(routes.opsEngagementMetrics());
  redirect(withAttempt(routes.opsEngagementMetrics({ snapshot }), kept("eng11-publish", answer, {}, answer.refusal === null ? "published" : null)));
}
