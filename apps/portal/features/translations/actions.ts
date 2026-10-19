"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { sendTranslation, type TranslationAttempt, type TranslationInput } from "@/lib/api/translations";
import { routes, withAttempt } from "@/lib/routes";

/*
 * SVC's act on SCR-SVC-21. It asks for the role the act needs and the backend asks again; it redirects to the
 * register of the content with what it recorded, or with the form still open and the refusal at the field it concerns,
 * kept for that page (`?attempt=`).
 */

const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.slice(0, 120) : "";
};

/** "Ghi bản dịch" on SCR-SVC-21: the translation recorded as current, or the refusal with what was chosen. */
export async function recordTranslationAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const input: TranslationInput = { contentKey: text(form, "content_key"), languageCode: text(form, "language_code"), sourceVersion: text(form, "source_version") };
  const answer = await sendTranslation(staff, input);
  if (answer.data === null) throw new Error(`Recording a translation failed: ${answer.failure?.code ?? "no answer"}`);
  const contentKey = input.contentKey.trim().toUpperCase();
  const { refusal } = answer.data;
  const attempt: TranslationAttempt = {
    contentKey,
    input,
    recorded: refusal === null ? { languageCode: input.languageCode.trim(), sourceVersion: input.sourceVersion.trim() } : null,
    refusal,
  };
  redirect(withAttempt(routes.opsTranslations({ content: contentKey, record: refusal !== null ? "1" : null }), keepForPage(attempt)));
}
