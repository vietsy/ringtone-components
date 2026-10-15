"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { makeStatusRecordPrintout, type PrintAttempt } from "@/lib/api/status-records";
import { routes, withAttempt } from "@/lib/routes";

/** A status record's public reference. Anything else is not a record this act can name. */
const RECORD = /^R1-CER-\d{4}-[0-9A-Z]{8}$/;

/**
 * Print the status record (SCR-CER-12). The printout is made and opens as its printed sheet, SCR-CER-13, which
 * the browser prints; the record's page, read again, lists it among the printouts. A refusal of the act is
 * drawn on the record's page, beside Print; a record the reader does not hold is the page's own not-found.
 */
export async function printStatusRecord(record: string): Promise<void> {
  if (typeof record !== "string" || !RECORD.test(record)) throw new Error("Print names one status record.");
  const principal = await requirePrincipal();
  const outcome = await makeStatusRecordPrintout(principal.sessionId, record);
  // The record's page kept for the back button would not list the new printout.
  revalidatePath(routes.statusRecord(record));
  const code = outcome.failure?.code;
  if (code === "RECORD_NOT_CURRENT" || code === "SIGNING_UNAVAILABLE") {
    const attempt: PrintAttempt = { refusal: code };
    redirect(withAttempt(routes.statusRecord(record), keepForPage(attempt)));
  }
  redirect(outcome.data !== null ? routes.statusRecordPrint(record, outcome.data.printout) : routes.statusRecord(record));
}
