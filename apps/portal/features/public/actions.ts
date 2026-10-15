"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { requestIndicativeAmount, requestScopeAssessment, type FormFacts } from "@/lib/api/public";
import { lookUpCertificate, type VerificationAttempt } from "@/lib/api/verification";
import { routes, withAttempt } from "@/lib/routes";

const field = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/**
 * The facts as the public forms send them. A decimal comma is read as the point the API takes, since a
 * Vietnamese reader writes 85,5; nothing else is changed, and what was typed is what the page draws back.
 */
function facts(formData: FormData): FormFacts {
  return {
    assessmentDate: field(formData, "assessment_date"),
    premisesClass: field(formData, "premises_class"),
    adminArea: field(formData, "admin_area_key"),
    floorAreaM2: field(formData, "floor_area_m2").replace(",", "."),
    seats: field(formData, "seating_capacity"),
  };
}

/**
 * SCR-PUB-02 "Xem kết quả". The answer is shown in place, on the page that asked, with the facts drawn back
 * into the form; a refusal marks the fields to correct. The service keeps nothing declared: the answer is
 * held only for the page it is shown on.
 */
export async function assessScope(formData: FormData): Promise<void> {
  const outcome = await requestScopeAssessment(facts(formData));
  if (outcome.data === null) redirect(routes.scope());
  redirect(withAttempt(routes.scope(), keepForPage(outcome.data)));
}

/** SCR-PUB-03 "Tính số tiền". As `assessScope`: the amount, the answer without one, or the refusal, in place. */
export async function calculateIndicativeAmount(formData: FormData): Promise<void> {
  const outcome = await requestIndicativeAmount(facts(formData));
  if (outcome.data === null) redirect(routes.indicativeAmount());
  redirect(withAttempt(routes.indicativeAmount(), keepForPage(outcome.data)));
}

/**
 * SCR-PUB-04 "Tra cứu". An answer lives at the reference's own address (SCR-PUB-05), the one a certificate's
 * QR code opens, so a typed reference and a scanned one land on the same page; the answer just given goes with
 * it, so the lookup is made and counted once. A refusal comes back to the field it concerns, with what was
 * typed. A reference read from paper is often typed in lower case; Crockford base 32 is the same in either,
 * so it is sent in upper case.
 */
export async function verifyReference(formData: FormData): Promise<void> {
  const typed = field(formData, "reference");
  const asked = typed.toUpperCase();
  const outcome = await lookUpCertificate(asked);
  const attempt: VerificationAttempt = { typed, asked, outcome };
  if (outcome.data === null) redirect(withAttempt(routes.verify(), keepForPage(attempt)));
  redirect(withAttempt(routes.verification(asked), keepForPage(attempt)));
}
