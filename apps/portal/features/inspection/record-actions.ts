"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  FINDING_KINDS,
  FOLLOW_UPS,
  OUTCOMES,
  REFERRAL_ROUTES,
  closeInspection,
  correctRecord,
  isoDay,
  requestReconsideration,
  type CorrectionAttempt,
  type CorrectionDraft,
  type ReconsiderationAttempt,
  type RefusalCode,
  type RowAttempt,
} from "@/lib/api/inspection";
import { requireInspector, requirePrincipal } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";

/*
 * The acts on inspection records beyond the field client: the premises' request to reconsider one (SCR-VER-14),
 * and on the authority's console the closure of an inspection whose inspector can no longer act (SCR-VER-18)
 * and the correction a case requires (SCR-VER-15). Each moves on to the screen the board says comes next, or
 * goes back to its own with what was sent and its refusal (`keepForPage`).
 */

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function oneOf<T extends string>(values: readonly T[], value: string): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

function refusalOf(failure: { code: string } | null): RefusalCode | null {
  if (failure === null || failure.code === "FORM_INCOMPLETE") return null;
  if (failure.code === "SERVICE_NOT_CONFIGURED") throw new Error("The inspection records' service is not configured");
  return failure.code as RefusalCode;
}

function forgetPages(): void {
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ SCR-VER-14

/**
 * SCR-VER-14 Send the request: the case CAS opened is said on the same screen (its success state), or the form
 * comes back with what was typed and the refusal where the board draws it.
 */
export async function requestReconsiderationAct(form: FormData): Promise<void> {
  const principal = await requirePrincipal();
  const subject = text(form, "subject");
  const version = Number.parseInt(text(form, "version"), 10);
  const premises = text(form, "premises_id") || null;
  const grounds = text(form, "grounds");
  const outcome = await requestReconsideration(principal, { subject, versionNo: Number.isNaN(version) ? null : version, premises, grounds });
  forgetPages();
  if (outcome.data !== null) redirect(routes.requestReconsideration({ subject, sent: outcome.data.case }));
  const attempt: ReconsiderationAttempt = { subject, premises, grounds, refusal: refusalOf(outcome.failure), detail: outcome.detail ?? null };
  redirect(withAttempt(routes.requestReconsideration({ subject }), keepForPage(attempt)));
}

// ------------------------------------------------------------------ SCR-VER-18

/** SCR-VER-18 Close the inspection, once confirmed: it is said closed, or the dialog opens again with its refusal. */
export async function closeInspectionAct(form: FormData): Promise<void> {
  const { sessionId } = await requireInspector();
  const id = text(form, "id");
  const reason = text(form, "reason");
  const outcome = await closeInspection(sessionId, id, reason);
  forgetPages();
  if (outcome.data !== null) redirect(routes.inspectionWork({ closed: id }));
  const refusal = refusalOf(outcome.failure) ?? "REASON_REQUIRED";
  const attempt: RowAttempt = { id, act: "close", effectiveTo: "", reason, decision: null, refusal, detail: null };
  redirect(withAttempt(routes.inspectionWork(), keepForPage(attempt)));
}

// ------------------------------------------------------------------ SCR-VER-15

/**
 * SCR-VER-15 Issue version n+1, once confirmed: the new version opens on SCR-VER-18 (design/03), or the form
 * comes back as sent with its refusal.
 */
export async function correctRecordAct(form: FormData): Promise<void> {
  const { sessionId, account } = await requireInspector();
  const record = text(form, "record");
  const kinds = form.getAll("finding_kind").map((value) => (typeof value === "string" ? value : ""));
  const notes = form.getAll("note").map((value) => (typeof value === "string" ? value.trim() : ""));
  const draft: CorrectionDraft = {
    caseRef: text(form, "case_ref").toUpperCase(),
    outcome: oneOf(OUTCOMES, text(form, "outcome")),
    findings: kinds.map((kind, index) => ({ kind: oneOf(FINDING_KINDS, kind), note: notes[index] ?? "" })),
    guidance: text(form, "guidance_text"),
    route: oneOf(REFERRAL_ROUTES, text(form, "referral_route")) ?? "CASE_FOLLOW_UP",
    referralNote: text(form, "referral_note"),
    followUp: oneOf(FOLLOW_UPS, text(form, "follow_up_kind")) ?? "NONE",
    followUpBy: isoDay(text(form, "follow_up_by")) ?? "",
    reason: text(form, "correction_reason"),
  };
  const outcome = await correctRecord(sessionId, account, record, draft);
  forgetPages();
  if (outcome.data !== null) redirect(routes.inspectionWork({ record: outcome.data.record }));
  const attempt: CorrectionAttempt = { draft, refusal: refusalOf(outcome.failure) };
  redirect(withAttempt(routes.inspectionCorrection(record, draft.caseRef), keepForPage(attempt)));
}
