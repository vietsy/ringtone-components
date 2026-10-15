"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  saveMandateDraft,
  sendMandate,
  sendParticipationTerms,
  type GovRefusal,
  type MandateAttempt,
  type MandateForm,
  type TermsAttempt,
} from "@/lib/api/governance";
import { requireCmo } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";
import { readDate, readMandateForm, text } from "./fields";

/*
 * The governance forms' acts on the organisation portal. Each asks who is signed in (the organisation is always
 * the session's, never a form value), sends its command through the seam, and opens the screen the board says
 * comes next: the same screen, which reads the new state. A refused act goes back to its page with the values as
 * entered and the refusal kept (`keepForPage`), so the page draws it where the act was.
 */

/** A date that was typed but cannot be read is no date: the API is sent none and names the field. */
const unreadable = (formData: FormData, name: string) => text(formData, name) !== "" && readDate(text(formData, name)) === null;

const refusal = (code: string, field: GovRefusal["field"]): GovRefusal => ({ code, field, row: null, range: null });

/**
 * SCR-GOV-14 Save draft and Submit for approval, one form with its intent. Save keeps the form as entered on this
 * device and draws it again with the time it was saved. Submit sends `POST /mandates`; accepted, the page reads
 * the mandate as submitted, and it stays so until the copyright authority reviews it.
 */
export async function actOnMandate(formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const form: MandateForm = readMandateForm(formData);
  if (text(formData, "intent") !== "submit") {
    await saveMandateDraft(cmo, form);
    revalidatePath(routes.orgMandate());
    redirect(routes.orgMandate());
  }

  const back = (refused: GovRefusal): never =>
    redirect(withAttempt(routes.orgMandate(), keepForPage({ page: "mandate", organisation: cmo.organisation, values: form, refusal: refused } satisfies MandateAttempt)));
  if (unreadable(formData, "period-from")) back(refusal("FIELD_MISSING", "effective_from"));
  if (unreadable(formData, "period-to")) back(refusal("FIELD_MISSING", "effective_to"));

  const outcome = await sendMandate(cmo, { ...form, idempotencyKey: text(formData, "idempotency_key") });
  const refused = outcome.data?.refusal ?? null;
  if (refused !== null) back(refused);
  revalidatePath(routes.orgMandate());
  redirect(routes.orgMandate());
}

/**
 * SCR-GOV-15 Record the terms, confirmed in its dialog. `direct_licensing_retained` is sent true: the screen draws
 * the retained right as a statement, never as a control that could clear it. Accepted, the page reads the terms
 * as recorded.
 */
export async function recordTerms(formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const typed = text(formData, "effective_from");
  const effectiveFrom = readDate(typed);
  const outcome = await sendParticipationTerms(cmo, {
    termsVersion: text(formData, "terms_version"),
    effectiveFrom,
    directLicensingRetained: text(formData, "direct_licensing_retained") === "true",
    idempotencyKey: text(formData, "idempotency_key"),
  });
  const refused = outcome.data?.refusal ?? null;
  if (refused !== null) {
    redirect(withAttempt(routes.orgTerms(), keepForPage({ page: "terms", organisation: cmo.organisation, values: { effectiveFrom }, refusal: refused } satisfies TermsAttempt)));
  }
  revalidatePath(routes.orgTerms());
  redirect(routes.orgTerms());
}
