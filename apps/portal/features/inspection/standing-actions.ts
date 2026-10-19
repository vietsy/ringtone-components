"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  AUTHORITY_LEVELS,
  decideAppointment,
  decideDesignation,
  endAppointment,
  endDesignation,
  isoDay,
  recordAppointment,
  recordDesignation,
  reinstateAppointment,
  suspendAppointment,
  type ActAnswer,
  type AppointmentForm,
  type DesignationForm,
  type FormAttempt,
  type RefusalCode,
  type RowAttempt,
} from "@/lib/api/inspection";
import { requireStaff } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";

/*
 * The operations console's acts on designations and appointments (SCR-VER-09 to 12). Each asks who is signed in,
 * sends its command through the seam, and reads its page again: the row changed, or the form or dialog drawn
 * again with what was sent and its refusal (`keepForPage`). Who may act is the backend's to say (ACT-OPS records,
 * ACT-BIZ-APR decides, and nobody decides what they recorded or suspended), so a refusal is the page's to draw.
 */

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** A refusal of the act, or null where the form came back without a field it requires. */
function refusalOf<T>(outcome: ActAnswer<T>): RefusalCode | null {
  const code = outcome.failure?.code;
  if (code === undefined || code === "FORM_INCOMPLETE") return null;
  if (code === "SERVICE_NOT_CONFIGURED") throw new Error("The inspection authorities' service is not configured");
  return code as RefusalCode;
}

/** A designation's or an appointment's change is read by every screen of the family, the field client's too. */
function forgetPages(): void {
  revalidatePath("/", "layout");
}

const documentOf = (form: FormData): { name: string; size: string } | null =>
  text(form, "document_name") === "" ? null : { name: text(form, "document_name"), size: text(form, "document_size") };

/** A date range field sends its two ends as `<name>-from` and `<name>-to`, in the reader's dd/mm/yyyy. */
const periodOf = (form: FormData): { from: string; to: string } => ({
  from: isoDay(text(form, "effective-from")) ?? text(form, "effective-from"),
  to: isoDay(text(form, "effective-to")) ?? text(form, "effective-to"),
});

/** A row's act refused: the page opens its dialog again with what was typed. */
function backToRow(path: Parameters<typeof withAttempt>[0], attempt: RowAttempt): never {
  redirect(withAttempt(path, keepForPage(attempt)));
}

// ------------------------------------------------------------------ SCR-VER-09

/** SCR-VER-09 Record for approval: the new row waits for a decision, or the form comes back with its refusal. */
export async function recordDesignationAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const level = AUTHORITY_LEVELS.find((candidate) => candidate === text(form, "level")) ?? null;
  const sent: DesignationForm = {
    code: text(form, "authority_code"),
    name: text(form, "name"),
    level,
    legalBasis: text(form, "legal_basis_ref"),
    document: documentOf(form),
    geography: text(form, "geography_version"),
    areas: text(form, "areas"),
    ...periodOf(form),
    predecessor: text(form, "predecessor_id"),
  };
  const outcome = await recordDesignation(staff, sent);
  forgetPages();
  if (outcome.data !== null) redirect(routes.opsInspectionAuthorities());
  const attempt: FormAttempt<DesignationForm> = { form: sent, refusal: refusalOf(outcome), detail: outcome.detail ?? null };
  redirect(withAttempt(routes.opsInspectionAuthorities(), keepForPage(attempt)));
}

/** SCR-VER-09 End, or Withdraw a pending designation, once confirmed in its dialog. */
export async function endDesignationAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = text(form, "id");
  const effectiveTo = text(form, "effective_to");
  const reason = text(form, "reason");
  const outcome = await endDesignation(staff, id, effectiveTo, reason);
  forgetPages();
  const refusal = refusalOf(outcome);
  if (outcome.data !== null || refusal === null) redirect(routes.opsInspectionAuthorities());
  backToRow(routes.opsInspectionAuthorities(), {
    id,
    act: "end",
    effectiveTo: isoDay(effectiveTo) ?? "",
    reason,
    decision: null,
    refusal,
    detail: outcome.detail ?? null,
  });
}

// ------------------------------------------------------------------ SCR-VER-10 and SCR-VER-12

const decisionOf = (form: FormData): "APPROVE" | "REFUSE" | null => {
  const value = text(form, "decision");
  return value === "APPROVE" || value === "REFUSE" ? value : null;
};

/** SCR-VER-10 Record the decision: the row leaves the list and the decision is said above it, or its refusal. */
export async function decideDesignationAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = text(form, "id");
  const decision = decisionOf(form);
  const reason = text(form, "reason");
  const outcome = await decideDesignation(staff, id, decision, reason);
  forgetPages();
  if (outcome.data !== null) redirect(routes.opsDesignationDecisions({ decided: id }));
  const refusal = refusalOf(outcome);
  if (refusal === null) redirect(routes.opsDesignationDecisions({ designation: id }));
  backToRow(routes.opsDesignationDecisions({ designation: id }), { id, act: "decide", effectiveTo: "", reason, decision, refusal, detail: null });
}

/** SCR-VER-12 Record the decision on an appointment. */
export async function decideAppointmentAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = text(form, "id");
  const decision = decisionOf(form);
  const reason = text(form, "reason");
  const outcome = await decideAppointment(staff, id, decision, reason);
  forgetPages();
  if (outcome.data !== null) redirect(routes.opsAppointmentDecisions({ decided: id }));
  const refusal = refusalOf(outcome);
  if (refusal === null) redirect(routes.opsAppointmentDecisions({ appointment: id }));
  backToRow(routes.opsAppointmentDecisions({ appointment: id }), { id, act: "decide", effectiveTo: "", reason, decision, refusal, detail: null });
}

/** SCR-VER-12 Reinstate, once confirmed: the row leaves the suspended list, or the dialog says why it cannot. */
export async function reinstateAppointmentAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = text(form, "id");
  const outcome = await reinstateAppointment(staff, id);
  forgetPages();
  if (outcome.data !== null) redirect(routes.opsAppointmentDecisions({ decided: id }));
  const refusal = refusalOf(outcome);
  if (refusal === null) redirect(routes.opsAppointmentDecisions());
  backToRow(routes.opsAppointmentDecisions(), { id, act: "reinstate", effectiveTo: "", reason: "", decision: null, refusal, detail: null });
}

// ------------------------------------------------------------------ SCR-VER-11

/** SCR-VER-11 Record for approval: the new row on its authority's list, or the form with its refusal. */
export async function recordAppointmentAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const sent: AppointmentForm = {
    authority: text(form, "authority_id"),
    person: text(form, "person_id"),
    name: text(form, "person_display_name"),
    card: text(form, "card_number"),
    instrument: text(form, "instrument_ref"),
    document: documentOf(form),
    ...periodOf(form),
  };
  const outcome = await recordAppointment(staff, sent);
  forgetPages();
  if (outcome.data !== null) redirect(routes.opsInspectorAppointments(sent.authority));
  const attempt: FormAttempt<AppointmentForm> = { form: sent, refusal: refusalOf(outcome), detail: outcome.detail ?? null };
  redirect(withAttempt(routes.opsInspectorAppointments(sent.authority === "" ? undefined : sent.authority), keepForPage(attempt)));
}

/** SCR-VER-11 Suspend or End an appointment, once confirmed in its dialog; the row changes, or the dialog opens again. */
export async function changeAppointmentAct(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = text(form, "id");
  const authority = text(form, "authority");
  const act = text(form, "act") === "suspend" ? "suspend" : "end";
  const effectiveTo = text(form, "effective_to");
  const reason = text(form, "reason");
  const outcome = act === "suspend" ? await suspendAppointment(staff, id, reason) : await endAppointment(staff, id, effectiveTo, reason);
  forgetPages();
  const back = routes.opsInspectorAppointments(authority === "" ? undefined : authority);
  const refusal = refusalOf(outcome);
  if (outcome.data !== null || refusal === null) redirect(back);
  backToRow(back, { id, act, effectiveTo: isoDay(effectiveTo) ?? "", reason, decision: null, refusal, detail: outcome.detail ?? null });
}
