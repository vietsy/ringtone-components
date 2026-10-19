"use server";

import { redirect } from "next/navigation";
import {
  previewGeographyDraft,
  sendGeographyPolicy,
  sendProvenanceClass,
  type GeographyAttempt,
  type GeographyDraftInput,
  type ProvenanceAttempt,
  type ProvenanceRefusal,
} from "@/lib/api/data-governance";
import { keepForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { askedDay } from "./console";

/*
 * DAT's acts on SCR-DAT-04 and 16. Each asks for the role the act needs and the backend asks again; each redirects to
 * its page with what it did, or the refusal at the field it concerns, kept for that page (`?attempt=`).
 */

const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const PROVENANCE_REFUSALS: readonly ProvenanceRefusal[] = ["PROVENANCE_CLASS_MISSING", "PROVENANCE_CLASS_UNKNOWN"];

/** "Ghi phân loại" on SCR-DAT-04: the class recorded for the value, or the refusal at the class field. */
export async function recordClassAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-DAT");
  const valueRef = text(form, "value_ref").trim();
  if (valueRef === "") throw new Error("A class is recorded for one value, named by its reference.");
  const answer = await sendProvenanceClass(staff, valueRef, text(form, "provenance_class"));
  const refusal = PROVENANCE_REFUSALS.find((code) => code === answer.failure?.code) ?? null;
  if (answer.data === null && refusal === null) throw new Error(`Recording a class failed: ${answer.failure?.code ?? "no answer"}`);
  const attempt: ProvenanceAttempt = { valueRef, recorded: answer.data?.recorded ?? null, refusal };
  redirect(withAttempt(routes.opsProvenance({ value: valueRef }), keepForPage(attempt)));
}

/** The new version as the form sends it: the levels ticked, the default, the minimum, the switch and the day. */
function draftOf(form: FormData): GeographyDraftInput {
  const typedDay = text(form, "effective_from");
  return {
    levels: form.getAll("levels").filter((value): value is string => typeof value === "string"),
    defaultLevel: text(form, "default_level"),
    minimum: text(form, "minimum_population").slice(0, 12),
    differencing: text(form, "differencing") === "on",
    effectiveFrom: askedDay(typedDay) ?? "",
  };
}

/** The preview's filter, carried through an act so the page comes back as it was. */
const filterOf = (form: FormData) => ({ q: text(form, "q").slice(0, 80), period: text(form, "period") });

/** "Xem trước" on SCR-DAT-16: the new version checked, and the preview under it once it passes; nothing is written. */
export async function previewGeographyAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-DPO");
  const answer = await previewGeographyDraft(staff, draftOf(form));
  if (answer.data === null) throw new Error(`Previewing a geography policy failed: ${answer.failure?.code ?? "no answer"}`);
  const attempt: GeographyAttempt = { act: "preview", draft: answer.data };
  redirect(withAttempt(routes.opsGeographyPolicy({ ...filterOf(form), draft: "new" }), keepForPage(attempt)));
}

/**
 * "Phê duyệt phiên bản" on SCR-DAT-16, confirmed: the version as previewed is approved, or its refusals come back at
 * their fields with the draft still open.
 */
export async function approveGeographyAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-DPO");
  const answer = await sendGeographyPolicy(staff, draftOf(form));
  if (answer.data === null) throw new Error(`Approving a geography policy failed: ${answer.failure?.code ?? "no answer"}`);
  const { approved, draft } = answer.data;
  if (approved === null) {
    const attempt: GeographyAttempt = { act: "approve", draft };
    redirect(withAttempt(routes.opsGeographyPolicy({ ...filterOf(form), draft: "new" }), keepForPage(attempt)));
  }
  const done: GeographyAttempt = { act: "approved", version: approved.version, effectiveFrom: approved.effectiveFrom };
  redirect(withAttempt(routes.opsGeographyPolicy(filterOf(form)), keepForPage(done)));
}
