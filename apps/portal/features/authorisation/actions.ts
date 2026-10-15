"use server";

import { redirect } from "next/navigation";
import { sendAuthorityVerification, type VerifyAttempt, type VerifyQuestion, type VerifyResult } from "@/lib/api/authorisation";
import { keepForPage } from "@/lib/api/flash";
import { requireCmo } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";

/** A form field's text, trimmed; an absent field is empty. */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The moment as R1's date field sends it with its time - "2026-09-26T21:00+07:00", the day and the 24-hour time
 * in Vietnam time - split back into the two fields for the form to show again, and as the instant asked about.
 * Null when it is not a moment on the calendar.
 */
function readMoment(value: string): { date: string; time: string; instant: string } | null {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})\+07:00$/.exec(value);
  if (parts === null) return null;
  const [, date = "", hours = "", minutes = ""] = parts;
  const instant = `${date}T${hours}:${minutes}:00+07:00`;
  const calendar = new Date(`${date}T00:00:00Z`);
  const real = !Number.isNaN(calendar.getTime()) && calendar.toISOString().slice(0, 10) === date && Number(hours) < 24 && Number(minutes) < 60;
  return real ? { date, time: `${hours}:${minutes}`, instant } : null;
}

/**
 * SCR-PTY-17 Ask: POST /authority-verifications with the premises and the moment, then the same screen with
 * what came of it - the answer, the refusal beside its field, or no answer when the register did not reply -
 * kept for the page (`keepForPage`) so a reload shows the same and the question stays as typed.
 */
export async function askAboutAuthority(formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const premises = text(formData, "premises_id");
  const moment = readMoment(text(formData, "at"));
  const question: VerifyQuestion = { premises, date: moment?.date ?? "", time: moment?.time ?? "" };
  const back = (result: VerifyResult): never =>
    redirect(withAttempt(routes.orgVerify(), keepForPage({ organisation: cmo.organisation, question, result } satisfies VerifyAttempt)));
  // Ask waits for both; a question sent without one is shown again as it was, with nothing asked.
  if (premises === "" || moment === null) back({ kind: "none" });
  const outcome = await sendAuthorityVerification(cmo, { premises, at: moment?.instant ?? "" });
  back(outcome.data ?? { kind: "failed", traceId: outcome.failure?.traceId ?? null });
}
