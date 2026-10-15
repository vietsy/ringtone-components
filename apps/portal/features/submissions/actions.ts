"use server";

import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { requireCmo } from "@/lib/api/session";
import {
  sendAcknowledgement,
  sendCancellation,
  sendSubmission,
  stageSubmissionFile,
  type CancelAttempt,
  type ExchangeFormat,
  type OutcomesAttempt,
  type StageAnswer,
  type SubmitAttempt,
} from "@/lib/api/submissions";
import { routes, withAttempt } from "@/lib/routes";
import { text } from "./fields";

/*
 * The acts of the submission screens. Each asks who is signed in, sends its command through the seam, and opens
 * the screen the board says comes next; a refused act goes back to its page with the attempt kept, so the page
 * draws the refusal where the act was.
 */

const formatOf = (value: string): ExchangeFormat => (value === "csv" ? "csv" : "json");

/**
 * SCR-CAT-04: one part of the chosen file on its way in. A server action takes at most 1 MB a request, so the
 * form sends the file in parts and the last act names the upload they make up.
 */
export async function stageSubmissionPart(formData: FormData): Promise<StageAnswer> {
  const cmo = await requireCmo();
  const part = formData.get("part");
  const upload = text(formData, "upload");
  if (!(part instanceof Blob)) return { upload: null, refusal: "PAYLOAD_TOO_LARGE" };
  const outcome = await stageSubmissionFile(cmo, upload !== "" ? upload : null, new Uint8Array(await part.arrayBuffer()));
  return outcome.data ?? { upload: null, refusal: "PAYLOAD_TOO_LARGE" };
}

/**
 * SCR-CAT-04 Submit: the submission is received and SCR-CAT-05 opens on it, RECEIVED; refused, the form comes
 * back with the refusal beside its field and the channel, format and file as they were.
 */
export async function submitRecords(formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const channel = text(formData, "channel");
  const format = text(formData, "format");
  const upload = text(formData, "upload");
  const outcome = await sendSubmission(cmo, { channel, format, upload: upload !== "" ? upload : null, name: text(formData, "name"), type: text(formData, "type") });
  const answer = outcome.data;
  if (answer === null) redirect(routes.orgSubmit());
  if (answer.outcome === "received") redirect(routes.orgSubmission(answer.reference));
  const attempt: SubmitAttempt = {
    page: "submit",
    entered: { channel, format: formatOf(format), file: answer.file, refusal: { code: answer.code, field: answer.field } },
  };
  redirect(withAttempt(routes.orgSubmit(), keepForPage(attempt)));
}

/** SCR-CAT-05 Acknowledge all, confirmed: the page again, acknowledged, or with the refusal above its outcomes. */
export async function acknowledgeSubmission(reference: string): Promise<void> {
  const cmo = await requireCmo();
  const outcome = await sendAcknowledgement(cmo, reference);
  const answer = outcome.data;
  if (answer === null || answer.outcome === "acknowledged") redirect(routes.orgSubmission(reference));
  const { code } = answer;
  if (code === "NOT_YOUR_SUBMISSION" || code === "SUBMISSION_NOT_FOUND") redirect(routes.orgSubmission(reference));
  const attempt: OutcomesAttempt = { page: "outcomes", reference, refusal: code };
  redirect(withAttempt(routes.orgSubmission(reference), keepForPage(attempt)));
}

/**
 * SCR-CAT-24 Cancel the submission, confirmed: SCR-CAT-05 reads it back cancelled, its reference kept. A missing
 * reason comes back to the form as typed; once processing has begun the page draws that state from the
 * submission itself.
 */
export async function cancelSubmission(reference: string, formData: FormData): Promise<void> {
  const cmo = await requireCmo();
  const reason = text(formData, "reason");
  const outcome = await sendCancellation(cmo, reference, reason);
  const answer = outcome.data;
  if (answer?.outcome === "cancelled") redirect(routes.orgSubmission(reference));
  if (answer?.outcome === "refused" && answer.code === "FIELD_MISSING") {
    const attempt: CancelAttempt = { page: "cancel", reference, reason, refusal: "FIELD_MISSING" };
    redirect(withAttempt(routes.orgCancelSubmission(reference), keepForPage(attempt)));
  }
  redirect(routes.orgCancelSubmission(reference));
}
