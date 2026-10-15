"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { recordPaymentAuthorisation, startCardPayment, type PayAttempt } from "@/lib/api/finance";
import { requirePrincipal } from "@/lib/api/session";
import { routes, withAttempt } from "@/lib/routes";

/** An obligation decision's reference, as REG issues it. Anything else is not a decision this act can name. */
const DECISION = /^OBD-[0-9A-Z]{10}$/;

function decisionReference(value: unknown): string {
  if (typeof value !== "string" || !DECISION.test(value)) throw new Error("A payment act names one obligation decision.");
  return value;
}

/**
 * A payment act changes the decision's three pages; a page kept for the back button would show the state
 * before the act, so the screens of the decision are read again on the next visit.
 */
function forgetPagesOf(decision: string): void {
  revalidatePath(routes.pay(decision));
  revalidatePath(routes.paymentPosition(decision));
  revalidatePath(routes.payments());
}

/**
 * Where a refused act goes: a repeated request is drawn on SCR-FIN-01 beside the act it refused; any other
 * failure (a decision no longer in force, one the reader may not see) is what the page itself reads and draws.
 */
function backToPay(decision: string, code: string): never {
  if (code === "FIN_IDEMPOTENCY_CONFLICT") {
    const attempt: PayAttempt = { refusal: code };
    redirect(withAttempt(routes.pay(decision), keepForPage(attempt)));
  }
  redirect(routes.pay(decision));
}

/**
 * Authorise payment, after its one confirmation (SCR-FIN-01): the instruction is made and the payer is back on
 * the decision's payment page, which now shows how to pay it.
 */
export async function authorisePayment(decision: string): Promise<void> {
  const reference = decisionReference(decision);
  const principal = await requirePrincipal();
  const outcome = await recordPaymentAuthorisation(principal, reference);
  forgetPagesOf(reference);
  if (outcome.failure !== null) backToPay(reference, outcome.failure.code);
  redirect(routes.pay(reference));
}

/** Pay by card (SCR-FIN-01). The card payment page hands the payer back to the payment position, SCR-FIN-02. */
export async function payByCard(decision: string): Promise<void> {
  const reference = decisionReference(decision);
  const principal = await requirePrincipal();
  const outcome = await startCardPayment(principal.sessionId, reference);
  forgetPagesOf(reference);
  if (outcome.failure !== null) backToPay(reference, outcome.failure.code);
  redirect(routes.paymentPosition(reference));
}
