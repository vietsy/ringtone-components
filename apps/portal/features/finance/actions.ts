"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import {
  closeCorrectionOf,
  decideRefundOf,
  decideWriteOff,
  recordChargebackOn,
  recordCorrectionOf,
  recordPaymentAuthorisation,
  proposeWriteOffOn,
  recordRefundOf,
  sendRefundOf,
  startCardPayment,
  type CorrectionAttempt,
  type PayAttempt,
  type WriteOffAttempt,
  type WriteOffDone,
  type WriteOffProposalAttempt,
} from "@/lib/api/finance";
import { requirePrincipal, requireStaff } from "@/lib/api/session";
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
 * failure (a decision no longer in force, a reader whose authority does not cover payment, one the reader may not
 * see) is what the page itself reads and draws.
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

// ------------------------------------------------------------------ the operations console (SCR-FIN-10, 15)

const CORRECTION = /^COR-[0-9A-Z]{10}$/;
const OUTSTANDING_AMOUNT = /^OUT-[0-9A-Z]{10}$/;

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function correctionReference(form: FormData): string {
  const value = field(form, "correction");
  if (!CORRECTION.test(value)) throw new Error("A correction act names one correction.");
  return value;
}

/** Every act on a correction changes the finance workspace's lists and the payer's payment pages. */
function forgetConsole(): void {
  revalidatePath(routes.opsCorrections());
  revalidatePath(routes.opsFinance());
  revalidatePath(routes.payments());
}

/** A refused act on SCR-FIN-10 goes back to the correction it was made on, with the refusal drawn where the act was. */
function backToCorrections(correction: string | null, attempt: CorrectionAttempt): never {
  const form = attempt.act === "chargeback" || attempt.act === "refund" ? attempt.act : undefined;
  redirect(withAttempt(routes.opsCorrections(correction, form), keepForPage(attempt)));
}

/** A refusal of an act that holds no form: its code, and the record it names where it names one. */
function refusedAct(act: CorrectionAttempt["act"], refusal: { code: string; field: CorrectionAttempt["field"]; subject?: string }, reason = ""): CorrectionAttempt {
  return { page: "corrections", act, code: refusal.code, form: null, field: refusal.field, subject: refusal.subject ?? null, reason };
}

/** The amount a money field sent, by its digits alone; null when it sent none. */
function amountOf(form: FormData): number | null {
  const digits = field(form, "amount").replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

/**
 * Record a chargeback (SCR-FIN-10): the payment the acquirer's notice names, the notice, the amount taken back. The
 * amount is typed as the money field writes it, so only its digits count. Recorded, the new correction opens.
 */
export async function recordChargebackAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-FIN-OP");
  const payment = field(form, "payment_id");
  const evidence = field(form, "evidence_ref");
  const amountMinor = amountOf(form);
  const answer = await recordChargebackOn(staff, { payment, evidence, amountMinor });
  forgetConsole();
  if (answer.refusal !== null) {
    backToCorrections(null, { ...refusedAct("chargeback", answer.refusal), form: { payment, evidence, case: "", amountMinor } });
  }
  redirect(routes.opsCorrections(answer.accepted.correction));
}

/**
 * Record a correction that refunds part of a payment under the case that decided it (SCR-FIN-10): the payment, the
 * case, the amount. Recorded, the new correction opens, waiting for a finance approver; refused, the form comes back
 * as it was sent with the refusal under the field it belongs to.
 */
export async function recordRefundAct(form: FormData): Promise<void> {
  const staff = await requireStaff("ACT-FIN-OP");
  const payment = field(form, "payment_id");
  const caseRef = field(form, "case_ref");
  const amountMinor = amountOf(form);
  const answer = await recordRefundOf(staff, { payment, caseRef, amountMinor });
  forgetConsole();
  if (answer.refusal !== null) {
    backToCorrections(null, { ...refusedAct("refund", answer.refusal), form: { payment, evidence: "", case: caseRef, amountMinor } });
  }
  redirect(routes.opsCorrections(answer.accepted.correction));
}

/**
 * Approve or Decline a refund (SCR-FIN-10), after Approve's confirmation. Any member of staff may send it; the backend
 * decides who may decide it, so the officer who prepared it meets the segregation refusal there.
 */
export async function decideRefundAct(form: FormData): Promise<void> {
  const correction = correctionReference(form);
  const decision = field(form, "decision") === "approve" ? "approve" : "decline";
  const reason = field(form, "reason");
  const staff = await requireStaff();
  const answer = await decideRefundOf(staff, correction, decision, reason);
  forgetConsole();
  if (answer.refusal !== null) backToCorrections(correction, refusedAct("approval", answer.refusal, reason));
  redirect(routes.opsCorrections(correction));
}

/** Send the approved refund, after its confirmation: once sent it cannot be called back. */
export async function sendRefundAct(form: FormData): Promise<void> {
  const correction = correctionReference(form);
  const staff = await requireStaff("ACT-FIN-OP");
  const answer = await sendRefundOf(staff, correction);
  forgetConsole();
  if (answer.refusal !== null) backToCorrections(correction, refusedAct("send", answer.refusal));
  redirect(routes.opsCorrections(correction));
}

/** Record a correction: the consequences of the correction opened on SCR-FIN-10, decided once. */
export async function recordCorrectionAct(form: FormData): Promise<void> {
  const correction = correctionReference(form);
  const staff = await requireStaff("ACT-FIN-OP");
  const answer = await recordCorrectionOf(staff, correction);
  forgetConsole();
  if (answer.refusal !== null) backToCorrections(correction, refusedAct("correction", answer.refusal));
  redirect(routes.opsCorrections(correction));
}

/** Close the correction, once every consequence agrees with the financial result. */
export async function closeCorrectionAct(form: FormData): Promise<void> {
  const correction = correctionReference(form);
  const staff = await requireStaff("ACT-FIN-OP");
  const answer = await closeCorrectionOf(staff, correction);
  forgetConsole();
  if (answer.refusal !== null) backToCorrections(correction, refusedAct("close", answer.refusal));
  redirect(routes.opsCorrections(correction));
}

/**
 * Approve or Decline a write-off (SCR-FIN-15), after Approve's confirmation. Any member of staff may send it; the
 * backend decides who may decide it, so a proposer who also approves meets the segregation refusal there. The page
 * shows what was recorded, or the refusal where the act was, with the reason as typed.
 */
export async function decideWriteOffAct(form: FormData): Promise<void> {
  const amount = field(form, "amount");
  if (!OUTSTANDING_AMOUNT.test(amount)) throw new Error("A write-off decision names one outstanding amount.");
  const decision = field(form, "decision") === "approve" ? "approve" : "decline";
  const reason = field(form, "reason");
  const staff = await requireStaff();
  const answer = await decideWriteOff(staff, amount, decision, reason);
  revalidatePath(routes.opsWriteOff(amount));
  revalidatePath(routes.opsFinance());
  if (answer.refusal !== null) {
    const attempt: WriteOffAttempt = {
      page: "write-off",
      amount,
      refusal: answer.refusal.field === "reason" ? { field: "reason" } : { code: answer.refusal.code },
      reason,
    };
    redirect(withAttempt(routes.opsWriteOff(amount), keepForPage(attempt)));
  }
  const done: WriteOffDone = { page: "write-off", amount, done: decision === "approve" ? "approved" : "declined" };
  redirect(withAttempt(routes.opsWriteOff(amount), keepForPage(done)));
}

/**
 * Propose a write-off (SCR-FIN-14): the finance officer gives the ground for the amount opened beside the list. Recorded,
 * the amount's panel shows the proposal waiting for a finance approver, with the way to it on SCR-FIN-15; refused, the
 * panel shows the refusal where the act was, with the ground as typed.
 */
export async function proposeWriteOffAct(form: FormData): Promise<void> {
  const amount = field(form, "amount");
  if (!OUTSTANDING_AMOUNT.test(amount)) throw new Error("A write-off proposal names one outstanding amount.");
  const ground = field(form, "ground");
  const staff = await requireStaff("ACT-FIN-OP");
  const answer = await proposeWriteOffOn(staff, amount, ground);
  revalidatePath(routes.opsFinance());
  revalidatePath(routes.opsWriteOff(amount));
  if (answer.refusal !== null) {
    const attempt: WriteOffProposalAttempt = { page: "propose-write-off", amount, code: answer.refusal.code, field: answer.refusal.field === "ground" ? "ground" : null, ground };
    redirect(withAttempt(routes.opsFinance({ amount }), keepForPage(attempt)));
  }
  redirect(routes.opsFinance({ amount }));
}
