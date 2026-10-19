"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { holds, requirePrincipal, requireStaff, type Staff } from "@/lib/api/session";
import {
  makeStatusRecordPrintout,
  sendAssessment,
  sendIssueDecision,
  sendKeyRegistration,
  sendKeyRetirement,
  sendKeyRevocation,
  sendProposal,
  sendResolution,
  sendReviewDecision,
  type Actor,
  type FollowUpAttempt,
  type IssueAttempt,
  type KeyAttempt,
  type KeyField,
  type PrintAttempt,
  type ProposalAttempt,
  type RecordAttempt,
  type ReviewAttempt,
  type StatusAct,
} from "@/lib/api/status-records";
import { routes, withAttempt } from "@/lib/routes";

/*
 * The status record acts. Each asks who is signed in, sends its command through the seam, which checks the role
 * again with everything else the contract checks, and moves the person on to the screen the board says comes next.
 * A refused act goes back to the page it was made on with the attempt kept (`keepForPage`), so the page draws the
 * refusal where the act was, with the values as entered.
 */

/** A status record's public reference. */
const RECORD = /^R1-CER-\d{4}-[0-9A-Z]{8}$/;
/** What the console addresses a record by: its reference, or the decision a pending record was opened under. */
const RECORD_KEY = /^(R1-CER-\d{4}-[0-9A-Z]{8}|OBD-[0-9A-Z]{10}|cer-[0-9a-zA-Z-]{1,40})$/;
const REVIEW = /^CSR-[0-9A-Z]{10}$/;
const FOLLOW_UP = /^CFU-[0-9A-Z]{10}$/;
const ACTS: readonly StatusAct[] = ["NO_CHANGE", "SUSPEND", "REVOKE", "CANCEL", "REINSTATE"];

const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

function named(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new Error(`The form names no ${what}.`);
  return value;
}

const actorOf = (staff: Staff): Actor => ({ name: staff.account, position: staff.position, roles: staff.roles });

// ---------------------------------------------------------------- SCR-CER-12, the holder

/**
 * Print the status record (SCR-CER-12). The printout is made and opens as its printed sheet, SCR-CER-13, which
 * the browser prints; the record's page, read again, lists it among the printouts. A refusal of the act is
 * drawn on the record's page, beside Print; a record the reader does not hold is the page's own not-found.
 */
export async function printStatusRecord(record: string): Promise<void> {
  if (typeof record !== "string" || !RECORD.test(record)) throw new Error("Print names one status record.");
  const principal = await requirePrincipal();
  const outcome = await makeStatusRecordPrintout({ sessionId: principal.sessionId, party: principal.party }, record);
  // The record's page kept for the back button would not list the new printout.
  revalidatePath(routes.statusRecord(record));
  const code = outcome.failure?.code;
  if (code === "RECORD_NOT_CURRENT" || code === "SIGNING_UNAVAILABLE") {
    const attempt: PrintAttempt = { refusal: code };
    redirect(withAttempt(routes.statusRecord(record), keepForPage(attempt)));
  }
  redirect(outcome.data !== null ? routes.statusRecordPrint(record, outcome.data.printout) : routes.statusRecord(record));
}

// ---------------------------------------------------------------- SCR-CER-02 Status record

/** Assess again (SCR-CER-02): the record's page with the new assessment, or the record issued, or the refusal. */
export async function assessStatusRecord(form: FormData): Promise<void> {
  const key = named(text(form, "record"), RECORD_KEY, "record");
  const staff = await requireStaff();
  const outcome = await sendAssessment(staff.sessionId, actorOf(staff), key);
  const attempt: RecordAttempt = {
    page: "record",
    record: key,
    assess: outcome.data !== null ? { issued: outcome.data.issued } : { refusal: outcome.failure?.code ?? "INTERNAL_ERROR" },
    print: null,
  };
  redirect(withAttempt(routes.opsStatusRecord(outcome.data?.issued ?? key), keepForPage(attempt)));
}

/** Print the status record (SCR-CER-02), an operations officer's act: the printout opens; a refusal stays beside Print. */
export async function printFromConsole(form: FormData): Promise<void> {
  const key = named(text(form, "record"), RECORD, "record");
  const staff = await requireStaff();
  const outcome = holds(staff, "ACT-OPS")
    ? await makeStatusRecordPrintout({ sessionId: staff.sessionId, party: null }, key)
    : { data: null, failure: { code: "NOT_AUTHORISED", traceId: null, retryable: false } };
  if (outcome.data !== null) redirect(routes.opsStatusRecordPrint(key, outcome.data.printout));
  const attempt: RecordAttempt = { page: "record", record: key, assess: null, print: { refusal: outcome.failure?.code ?? "INTERNAL_ERROR" } };
  redirect(withAttempt(routes.opsStatusRecord(key), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CER-03 Approve an issue

/**
 * Approve or decline the issue (SCR-CER-03). Either way the page is drawn again with the decision recorded, as the
 * board draws it; a refusal is drawn in place of the decision, with every unmet condition it lists.
 */
export async function decideIssueAction(form: FormData): Promise<void> {
  const key = named(text(form, "record"), RECORD_KEY, "record");
  const decision = text(form, "decision") === "DECLINE" ? "DECLINE" : "APPROVE";
  const evidence = form.getAll("evidence_refs").filter((value): value is string => typeof value === "string" && value.trim() !== "");
  const reason = text(form, "reason");
  const staff = await requireStaff();
  const outcome = await sendIssueDecision(staff.sessionId, actorOf(staff), key, { decision, reason, evidence });
  const attempt: IssueAttempt = {
    page: "approve",
    record: key,
    refusal: outcome.failure !== null ? { code: outcome.failure.code, unmet: outcome.unmet ?? [] } : null,
    done: outcome.failure === null ? (decision === "APPROVE" ? "approved" : "declined") : null,
    values: { evidence, reason },
  };
  redirect(withAttempt(routes.opsStatusRecordApproval(key), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CER-05 Propose a status change

/**
 * Propose (SCR-CER-05). Recorded, the page shows the proposal waiting for a business approver; refused, the form
 * comes back with the refusal below the field it names and every value as entered.
 */
export async function proposeChangeAction(form: FormData): Promise<void> {
  const key = named(text(form, "record"), RECORD_KEY, "record");
  const reviewText = text(form, "review");
  const review = reviewText === "" ? null : named(reviewText, REVIEW, "review");
  const act = ACTS.find((candidate) => candidate === text(form, "action")) ?? "NO_CHANGE";
  const ground = text(form, "ground_code");
  const reason = text(form, "reason");
  const evidenceText = text(form, "evidence_refs");
  const effectiveText = text(form, "effective_at");
  const conditions = [...form.keys()]
    .filter((name) => name.startsWith("condition:"))
    .map((name) => ({ condition: name.slice("condition:".length), howMet: text(form, name) }));
  const effectiveAt = effectiveText === "" ? null : Number.isNaN(Date.parse(effectiveText)) ? "invalid" : effectiveText;
  const staff = await requireStaff();
  const outcome = await sendProposal(staff.sessionId, actorOf(staff), {
    record: key,
    review,
    act,
    ground: ground === "" ? null : ground,
    reason,
    evidence: evidenceText.split(",").map((item) => item.trim()).filter((item) => item !== ""),
    effectiveAt,
    conditions,
  });
  const attempt: ProposalAttempt = {
    page: "propose",
    record: key,
    review,
    refusal: outcome.failure !== null ? { code: outcome.failure.code, field: outcome.field ?? null, openReview: outcome.openReview ?? null } : null,
    proposed: outcome.data?.review ?? null,
    values: {
      act,
      ground,
      reason,
      evidence: evidenceText,
      effective: effectiveText,
      conditions: Object.fromEntries(conditions.map((entry) => [entry.condition, entry.howMet])),
    },
  };
  redirect(withAttempt(routes.opsStatusRecordProposal(key, outcome.data?.review ?? review ?? undefined), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CER-06 Decide a status change

/** Approve or decline the proposal (SCR-CER-06): the review is drawn again, decided or refused. */
export async function decideReviewAction(form: FormData): Promise<void> {
  const review = named(text(form, "review"), REVIEW, "review");
  const decision = text(form, "decision") === "DECLINE" ? "DECLINE" : "APPROVE";
  const reason = text(form, "reason");
  const staff = await requireStaff();
  const outcome = await sendReviewDecision(staff.sessionId, actorOf(staff), review, { decision, reason });
  const attempt: ReviewAttempt = {
    page: "decide",
    review,
    refusal: outcome.failure?.code ?? null,
    done: outcome.failure === null ? (decision === "APPROVE" ? "approved" : "declined") : null,
    values: { reason },
  };
  redirect(withAttempt(routes.opsStatusReview(review), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CER-08 Resolve a follow-up

/** Resolve (SCR-CER-08): the follow-up drawn again, applied, or with the refusal below the field it names. */
export async function resolveFollowUpAction(form: FormData): Promise<void> {
  const followUp = named(text(form, "follow_up"), FOLLOW_UP, "follow-up");
  const outcomeChosen = text(form, "outcome");
  const reason = text(form, "reason");
  const staff = await requireStaff();
  const outcome = await sendResolution(staff.sessionId, actorOf(staff), followUp, { outcome: outcomeChosen, reason });
  const code = outcome.failure?.code ?? null;
  const attempt: FollowUpAttempt = {
    page: "resolve",
    followUp,
    refusal: code !== null ? { code, field: code === "REASON_REQUIRED" ? "reason" : code === "RECORD_WOULD_NOT_MATCH_DECISION" ? "outcome" : null } : null,
    done: code === null,
    values: { outcome: outcomeChosen, reason },
  };
  redirect(withAttempt(routes.opsFollowUp(followUp), keepForPage(attempt)));
}

// ---------------------------------------------------------------- SCR-CER-10 Signing keys

const KID = /^[A-Za-z0-9._-]{1,64}$/;

/** Register a key (SCR-CER-10): listed, or the form back with the refusal below its field. */
export async function registerKeyAction(form: FormData): Promise<void> {
  const values = { kid: text(form, "kid"), key_handle: text(form, "key_handle"), public_key_jwk: text(form, "public_key_jwk"), valid_from: text(form, "valid_from") };
  const staff = await requireStaff();
  const validFrom = values.valid_from === "" || Number.isNaN(Date.parse(values.valid_from)) ? null : values.valid_from;
  const outcome = await sendKeyRegistration(staff.sessionId, actorOf(staff), { kid: values.kid, handle: values.key_handle, jwk: values.public_key_jwk, validFrom });
  const code = outcome.failure?.code ?? null;
  const field: KeyField | null =
    code === "KID_EXISTS" ? "kid" : code === "VALID_FROM_IN_PAST" ? "valid_from" : code === "KEY_INVALID" ? "public_key_jwk" : null;
  const attempt: KeyAttempt = {
    page: "keys",
    register: code !== null ? { refusal: { code, field }, values } : null,
    row: null,
    done: outcome.data !== null ? { kind: "registered", kid: outcome.data.kid, validFrom: outcome.data.validFrom } : null,
  };
  redirect(withAttempt(routes.securitySigningKeys(), keepForPage(attempt)));
}

/** Retire a key (SCR-CER-10), confirmed in a dialog: the toast, or the refusal in place of the row's actions. */
export async function retireKeyAction(form: FormData): Promise<void> {
  const kid = named(text(form, "kid"), KID, "key");
  const staff = await requireStaff();
  const outcome = await sendKeyRetirement(staff.sessionId, actorOf(staff), kid);
  const attempt: KeyAttempt = {
    page: "keys",
    register: null,
    row: outcome.failure !== null ? { kid, code: outcome.failure.code } : null,
    done: outcome.failure === null ? { kind: "retired", kid } : null,
  };
  redirect(withAttempt(routes.securitySigningKeys(), keepForPage(attempt)));
}

/** Revoke a key (SCR-CER-10), with its reason given in the confirmation: how many holders print again, or the refusal. */
export async function revokeKeyAction(form: FormData): Promise<void> {
  const kid = named(text(form, "kid"), KID, "key");
  const reason = text(form, "reason");
  const staff = await requireStaff();
  const outcome = await sendKeyRevocation(staff.sessionId, actorOf(staff), kid, reason);
  const attempt: KeyAttempt = {
    page: "keys",
    register: null,
    row: outcome.failure !== null ? { kid, code: outcome.failure.code } : null,
    done: outcome.data !== null ? { kind: "revoked", kid, reprint: outcome.data.reprint } : null,
  };
  redirect(withAttempt(routes.securitySigningKeys(), keepForPage(attempt)));
}
