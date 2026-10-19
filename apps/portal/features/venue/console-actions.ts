"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import {
  loadMoodTrackSearch,
  sendEnforcement,
  sendMoodApproval,
  sendMoodVersion,
  sendMoodWithdrawal,
  sendNewMood,
  sendReinstatement,
  sendScopeExit,
  type EnforcementAttempt,
  type EnforcementInput,
  type MoodAttempt,
  type ReinstatementAttempt,
  type ScopeExitAttempt,
  type ScopeExitInput,
  type TrackOption,
} from "@/lib/api/venue";
import { routes, withAttempt } from "@/lib/routes";
import { readDate, text } from "./fields";

/*
 * The consoles' Player acts (SCR-VEN-12 to 18). Each asks who is signed in and with which roles, sends its command
 * through the seam, and opens the screen the specification names next. A refused act goes back to the page it was
 * made on with the attempt kept (`keepForPage`), so the refusal is drawn where the act was, the fields as typed.
 */

/** A value a form's JSON field carried, where a string was expected. */
const word = (value: unknown) => (typeof value === "string" ? value : "");

/** A date and time field's value as the API takes it: "2026-09-30T10:15+07:00" from R1's field, without the offset. */
const localTime = (formData: FormData, name: string) => text(formData, name).replace(/\+07:00$/, "");

// ---------------------------------------------------------------- SCR-VEN-12 and 13

/**
 * SCR-VEN-12, for a reader the register does not admit: one service opened by its code. Evidence reads its case file
 * (PERM-538); legal, who reads no case file, records its scope exit (SCR-VEN-16's direct link).
 */
export async function openByCode(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS", "ACT-EVD", "ACT-LGL");
  const code = text(formData, "service_code").toUpperCase();
  if (code === "") redirect(routes.opsServices());
  redirect(holds(staff, "ACT-OPS", "ACT-EVD") ? routes.opsService(code) : routes.opsServiceScopeExit(code));
}

/** SCR-VEN-13 Show the periods: the week and the as-at instant as chosen, kept in the address. */
export async function showPeriods(service: string, formData: FormData): Promise<void> {
  await requireStaff("ACT-OPS");
  const from = text(formData, "week-from");
  const to = text(formData, "week-to");
  redirect(routes.opsService(service, { from: readDate(from) ?? from, to: readDate(to) ?? to, asOf: localTime(formData, "as_of") }));
}

// ---------------------------------------------------------------- SCR-VEN-14

/** SCR-VEN-14 Record the action, confirmed: SCR-VEN-13 with the new row; refused, the panel above the actions, fields kept. */
export async function recordEnforcement(service: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const conditions = (() => {
    try {
      const parsed: unknown = JSON.parse(text(formData, "conditions") || "[]");
      return Array.isArray(parsed)
        ? parsed.map((entry: { code?: unknown; text?: unknown }) => ({ code: word(entry.code), text: word(entry.text) }))
        : [];
    } catch {
      return [];
    }
  })();
  const values: EnforcementInput = {
    action: text(formData, "action"),
    ground: text(formData, "ground_code"),
    when: text(formData, "effective_when"),
    effectiveAt: localTime(formData, "effective_at"),
    notice: text(formData, "notice_ref"),
    remedy: text(formData, "remedy"),
    conditions,
  };
  const answer = (await sendEnforcement(staff, service, values)).data;
  if (answer === null || answer.accepted !== null) redirect(routes.opsService(service));
  const attempt: EnforcementAttempt = { page: "enforcement", service, values, code: answer.refusal.code };
  redirect(withAttempt(routes.opsServiceEnforcement(service), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-VEN-15

/** SCR-VEN-15 Reinstate, confirmed: SCR-VEN-13 showing the service active; refused, the code above the conditions, evidence kept. */
export async function recordReinstatement(service: string, action: string, codes: readonly string[], formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const evidence = Object.fromEntries(codes.map((code) => [code, text(formData, `evidence_${code}`)]));
  const effectiveAt = localTime(formData, "effective_at");
  const answer = (await sendReinstatement(staff, service, { action, evidence, effectiveAt })).data;
  if (answer === null || answer.accepted !== null) redirect(routes.opsService(service));
  const attempt: ReinstatementAttempt = { page: "reinstatement", service, evidence, effectiveAt, code: answer.refusal.code };
  redirect(withAttempt(routes.opsServiceReinstatement(service), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-VEN-16

const FIELDS = ["detail", "event", "effectiveAt", "evidence"] as const;

/**
 * SCR-VEN-16 Record the scope exit, confirmed: SCR-VEN-13 for operations; legal, who reads no case file, stays here and
 * the screen confirms in place. Refused, beside the field or in the header, fields kept.
 */
export async function recordScopeExit(service: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS", "ACT-LGL");
  const values: ScopeExitInput = {
    family: text(formData, "cause_family"),
    detail: text(formData, "cause_detail"),
    event: text(formData, "cause_event_ref"),
    effectiveAt: localTime(formData, "event_effective_at"),
    evidence: text(formData, "evidence_ref"),
  };
  const answer = (await sendScopeExit(staff, service, values)).data;
  if (answer === null) redirect(routes.opsServiceScopeExit(service));
  if (answer.accepted !== null && holds(staff, "ACT-OPS")) redirect(routes.opsService(service));
  const field = answer.refusal?.field ?? null;
  const attempt: ScopeExitAttempt = {
    page: "scope-exit",
    service,
    values,
    code: answer.refusal?.code ?? null,
    field: FIELDS.find((name) => name === field) ?? null,
    recorded: answer.accepted,
  };
  redirect(withAttempt(routes.opsServiceScopeExit(service), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-VEN-17 and 18

/** The track picker's search: CAT's tracks eligible now. */
export async function searchMoodTracks(query: string): Promise<readonly TrackOption[]> {
  const staff = await requireStaff("ACT-MOD");
  return (await loadMoodTrackSearch(staff, String(query))).data ?? [];
}

/** The tracks a picker sends, in order, with their words so a refused form shows them again. */
function picked(formData: FormData): TrackOption[] {
  try {
    const parsed: unknown = JSON.parse(text(formData, "tracks") || "[]");
    return Array.isArray(parsed)
      ? parsed.map((entry: { id?: unknown; title?: unknown; by?: unknown }) => ({ id: word(entry.id), title: word(entry.title), by: word(entry.by) }))
      : [];
  } catch {
    return [];
  }
}

function moodAttempt(form: MoodAttempt["form"], refused: { code: string; field: string | null; item: number | null }, values: MoodAttempt["values"]): string {
  const track = refused.item === null ? null : (values.tracks[refused.item]?.id ?? null);
  return keepForPage({ page: "mood", form, code: refused.code, field: refused.field, track, values } satisfies MoodAttempt);
}

/** SCR-VEN-17 Create the mood with version 1: SCR-VEN-18 for the new draft; refused, beside the field or the track. */
export async function createMood(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-MOD", "ACT-OPS");
  const tracks = picked(formData);
  const typedFrom = text(formData, "effective_from");
  const values = { name: text(formData, "name"), effectiveFrom: typedFrom, tracks, reason: "" };
  const answer = (
    await sendNewMood(staff, { name: values.name, owner: text(formData, "owner_role"), effectiveFrom: readDate(typedFrom) ?? typedFrom, tracks: tracks.map((track) => track.id) })
  ).data;
  if (answer === null) redirect(routes.opsMoods());
  if (answer.accepted !== null) redirect(routes.opsMoodVersion(answer.accepted.version));
  redirect(withAttempt(routes.opsMoods(), moodAttempt("create", answer.refusal, values)));
}

/** SCR-VEN-18 Prepare the next version: the new draft opens here; refused, in the prepare panel. */
export async function prepareMoodVersion(mood: string, version: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-MOD", "ACT-OPS");
  const tracks = picked(formData);
  const typedFrom = text(formData, "effective_from");
  const answer = (await sendMoodVersion(staff, mood, { effectiveFrom: readDate(typedFrom) ?? typedFrom, tracks: tracks.map((track) => track.id) })).data;
  if (answer === null) redirect(routes.opsMoodVersion(version));
  if (answer.accepted !== null) redirect(routes.opsMoodVersion(answer.accepted.version));
  redirect(withAttempt(routes.opsMoodVersion(version), moodAttempt("prepare", answer.refusal, { name: "", effectiveFrom: typedFrom, tracks, reason: "" })));
}

/** SCR-VEN-18 Approve version {n}: the version approved, in effect from its date; refused, above the action row. */
export async function approveMoodVersion(version: string): Promise<void> {
  const staff = await requireStaff("ACT-MOD", "ACT-OPS");
  const answer = (await sendMoodApproval(staff, version)).data;
  if (answer === null || answer.accepted !== null) redirect(routes.opsMoodVersion(version));
  redirect(withAttempt(routes.opsMoodVersion(version), moodAttempt("approve", answer.refusal, { name: "", effectiveFrom: "", tracks: [], reason: "" })));
}

/** SCR-VEN-18 Withdraw with a reason, confirmed: the version withdrawn with its reason; refused, the reason kept. */
export async function withdrawMoodVersion(version: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-MOD", "ACT-OPS");
  const reason = text(formData, "reason");
  const answer = (await sendMoodWithdrawal(staff, version, reason)).data;
  if (answer === null || answer.accepted !== null) redirect(routes.opsMoodVersion(version));
  redirect(withAttempt(routes.opsMoodVersion(version), moodAttempt("withdraw", answer.refusal, { name: "", effectiveFrom: "", tracks: [], reason })));
}
