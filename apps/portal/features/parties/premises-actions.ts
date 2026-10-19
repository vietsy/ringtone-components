"use server";

import type { Route } from "next";
import type { LoadOutcome } from "@rightone/ui";
import type { PartyAnswer } from "@/lib/api/parties";
import {
  sendAcknowledgement,
  sendAdmission,
  sendDispositionDecision,
  sendOverride,
  sendPremisesChange,
  sendProposal,
  sendRelationship,
  sendRepointing,
  sendResolution,
  sendRunStart,
  type PremisesAttempt,
} from "@/lib/api/premises";
import { requireStaff } from "@/lib/api/session";
import { routes } from "@/lib/routes";
import { readDate, text, typed } from "./fields";
import { settle as settleAttempt } from "./settle";

/*
 * The premises register's acts (SCR-PTY-06 to 09, 14 to 16). Each asks who is signed in, sends one command through
 * the seam, which checks the roles and the separations of duties again, and opens the screen the boards draw next,
 * or the same screen with the refusal beside what it names and every value as typed.
 */

function settle<T>(outcome: LoadOutcome<PartyAnswer<T>>, attempt: Omit<PremisesAttempt, "refusal" | "done">, done: (accepted: T) => string, next: Route, back: Route): never {
  return settleAttempt<T, PremisesAttempt>(outcome, attempt, done, next, back);
}

// ---------------------------------------------------------------- SCR-PTY-06

/** Admit premises: the new entry, opened at once; the reference typed goes back masked, never in the flash. */
export async function admitPremisesAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS", "ACT-DAT");
  const outcome = await sendAdmission(staff, {
    identifyingReference: text(formData, "identifying_reference"),
    tradingName: text(formData, "trading_name"),
    address: text(formData, "address"),
    classification: text(formData, "classification"),
    area: text(formData, "administrative_area_key"),
    geographyVersion: text(formData, "geography_version"),
    evidenceKind: text(formData, "evidence_kind"),
    evidenceRef: text(formData, "evidence_ref"),
    reason: text(formData, "reason"),
  });
  const values = { ...typed(formData), identifying_reference: "" };
  const back = routes.opsPremisesRegister({ area: text(formData, "return_area") || null, panel: "admit" });
  settle(outcome, { form: "admit", subject: "", values }, (accepted) => accepted.record, routes.opsPremises(outcome.data?.accepted?.record ?? ""), back);
}

// ---------------------------------------------------------------- SCR-PTY-07

/** Record party: the relationship from the day given; the premises page shows it at once. */
export async function recordPartyAction(record: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const typedFrom = text(formData, "effective_from");
  const outcome = await sendRelationship(staff, record, { party: text(formData, "party_id"), effectiveFrom: readDate(typedFrom), effectiveFromText: typedFrom });
  settle(outcome, { form: "relationship", subject: record, values: typed(formData) }, (accepted) => accepted.party, routes.opsPremises(record), routes.opsPremises(record, "party"));
}

// ---------------------------------------------------------------- SCR-PTY-08

/** Apply override: the provenance shows the override with the earlier value kept. */
export async function overrideAction(record: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-DAT");
  const outcome = await sendOverride(staff, record, { field: text(formData, "field_name"), value: text(formData, "field_value"), authority: text(formData, "override_authority_ref") });
  const page = routes.opsPremisesProvenance(record);
  settle(outcome, { form: "override", subject: record, values: typed(formData) }, (accepted) => `${accepted.field}|${accepted.at}`, page, page);
}

// ---------------------------------------------------------------- SCR-PTY-09

/** Record change: the recorded change and the dispositions it raised, on the same page; a refusal keeps the draft. */
export async function recordChangeAction(record: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const effectiveText = text(formData, "effective_on");
  const checked = text(formData, "checked_for");
  const outcome = await sendPremisesChange(staff, record, {
    cause: text(formData, "cause"),
    effectiveOn: readDate(effectiveText),
    effectiveOnText: effectiveText,
    incoming: text(formData, "incoming_party_id"),
    checkedFor: checked === "" ? null : checked,
  });
  const draft = { cause: text(formData, "cause") || null, effective: readDate(effectiveText), incoming: text(formData, "incoming_party_id") || null };
  settle(outcome, { form: "change", subject: record, values: typed(formData) }, (accepted) => accepted.change.id, routes.opsPremisesChange(record), routes.opsPremisesChange(record, draft));
}

// ---------------------------------------------------------------- SCR-PTY-14

/** Start a run: the runs page shows it running. */
export async function startRunAction(): Promise<void> {
  const staff = await requireStaff("ACT-DAT");
  const outcome = await sendRunStart(staff);
  const page = routes.opsReconciliation();
  settle(outcome, { form: "run", subject: "", values: {} }, (accepted) => accepted.run, page, page);
}

/**
 * Re-point the register from one geography version to the next (FR-PTY-040), from now: the runs page says how many
 * premises moved and names each area left where it was, with its exception.
 */
export async function repointAction(fromVersion: string, toVersion: string): Promise<void> {
  const staff = await requireStaff("ACT-DAT");
  const outcome = await sendRepointing(staff, { fromVersion, toVersion });
  const page = routes.opsReconciliation();
  settle(outcome, { form: "repoint", subject: fromVersion, values: {} }, (accepted) => JSON.stringify(accepted), page, page);
}

// ---------------------------------------------------------------- SCR-PTY-15

/** Acknowledge: the reader's name on the exception, which stays open under the table. */
export async function acknowledgeAction(exception: string): Promise<void> {
  const staff = await requireStaff("ACT-DAT", "ACT-SEC");
  const outcome = await sendAcknowledgement(staff, exception);
  const page = routes.opsRegisterExceptions(exception);
  settle(outcome, { form: "acknowledge", subject: exception, values: {} }, (accepted) => accepted.at, page, page);
}

/** Resolve: closed with what was done, or refused with the figure that has not changed. */
export async function resolveAction(exception: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-DAT", "ACT-SEC");
  const outcome = await sendResolution(staff, exception, text(formData, "resolution"));
  const page = routes.opsRegisterExceptions(exception);
  settle(outcome, { form: "resolve", subject: exception, values: typed(formData) }, (accepted) => accepted.at, page, page);
}

// ---------------------------------------------------------------- SCR-PTY-16

/** Propose a transfer or a closure: the record waits for a business approver. */
export async function proposeAction(change: string, disposition: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = await sendProposal(staff, disposition, { outcome: text(formData, "proposed_outcome"), ground: text(formData, "ground") });
  const page = routes.opsChangeDispositions(change, disposition);
  settle(outcome, { form: "propose", subject: disposition, values: typed(formData) }, (accepted) => accepted.state, page, page);
}

/** Approve transfer, or leave in place: decided in place, with the approver's name and ground. */
export async function decideAction(change: string, disposition: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS");
  const outcome = await sendDispositionDecision(staff, disposition, { decision: text(formData, "intent"), ground: text(formData, "ground") });
  const page = routes.opsChangeDispositions(change, disposition);
  settle(outcome, { form: "decide", subject: disposition, values: typed(formData) }, (accepted) => accepted.state, page, page);
}
