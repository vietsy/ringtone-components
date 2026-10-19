"use server";

import type { Route } from "next";
import type { LoadOutcome } from "@rightone/ui";
import {
  sendAmendment,
  sendDeclaration,
  sendGrant,
  sendNewParty,
  sendCandidacy,
  sendPartyPerson,
  sendPersonAmendment,
  sendPrincipal,
  sendReviewDecision,
  sendRevocation,
  sendSourceSearch,
  type PartyAnswer,
  type PartyAttempt,
  type ReferenceClass,
} from "@/lib/api/parties";
import { requirePartyPrincipal, requireStaff } from "@/lib/api/session";
import { routes } from "@/lib/routes";
import { chosenFile, readDate, text, texts, typed } from "./fields";
import { settle as settleAttempt } from "./settle";

/*
 * The party family's acts. Each asks who is signed in, sends one command through the seam - which checks the roles,
 * the party and the separations of duties again - and opens the screen the boards draw next, or the same screen with
 * the refusal beside what it names and every value as typed (`keepForPage`).
 */

/** The next screen on success, or the form's screen with the attempt kept; both carry what the act answered. */
function settle<T>(outcome: LoadOutcome<PartyAnswer<T>>, attempt: Omit<PartyAttempt, "refusal" | "done">, done: (accepted: T) => string, next: Route, back: Route): never {
  return settleAttempt<T, PartyAttempt>(outcome, attempt, done, next, back);
}

/** A period from R1's range field: the days as typed, and as ISO dates where they are dates. */
function period(formData: FormData, name: string) {
  const fromText = text(formData, `${name}-from`);
  const toText = text(formData, `${name}-to`);
  return { from: readDate(fromText), fromText, to: readDate(toText), toText };
}

// ---------------------------------------------------------------- SCR-PTY-01

/** Create party: the new record in DRAFT, opened at once so it can be identified. */
export async function createPartyAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const input = { kind: text(formData, "party_kind"), legalName: text(formData, "legal_name"), businessRegistration: text(formData, "identifying_reference") };
  const outcome = await sendNewParty(staff, input);
  // The registration number typed goes back to the form masked: it is not kept in the address or the flash.
  const values = { ...typed(formData), identifying_reference: "" };
  settle(outcome, { form: "create", subject: "", values }, (accepted) => accepted.record, routes.opsParty(outcome.data?.accepted?.record ?? ""), routes.opsParties({ panel: "create" }));
}

// ---------------------------------------------------------------- SCR-PTY-02

/** Add person: a person of the register on this party's record, with no account needed. */
export async function addPersonAction(party: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = await sendPartyPerson(staff, party, { displayName: text(formData, "display_name"), account: text(formData, "account_ref") });
  settle(outcome, { form: "person", subject: party, values: typed(formData) }, (accepted) => accepted.person, routes.opsParty(party), routes.opsParty(party, "person"));
}

/** Amend person: a new display name or an account linked later; the person's reference stays as the register issued it. */
export async function amendPersonAction(party: string, person: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = await sendPersonAmendment(staff, person, { reference: "", displayName: text(formData, "display_name"), account: text(formData, "account_ref") });
  settle(outcome, { form: "amendPerson", subject: person, values: typed(formData) }, (accepted) => accepted.person, routes.opsPartyPerson(party, person), routes.opsPartyPerson(party, person));
}

/** Record principal: an authority for the whole party, recorded under the officer's name. */
export async function recordPrincipalAction(party: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = await sendPrincipal(staff, party, {
    person: text(formData, "party_person_id"),
    basis: text(formData, "basis"),
    evidence: text(formData, "evidence_ref"),
    acts: texts(formData, "scope_keys"),
    ...period(formData, "effective_period"),
  });
  settle(outcome, { form: "principal", subject: party, values: typed(formData) }, (accepted) => accepted.authority, routes.opsParty(party), routes.opsParty(party, "principal"));
}

// ---------------------------------------------------------------- SCR-PTY-03

/** Search the source: the search is recorded with its answer, and the form shows it. */
export async function searchSourceAction(party: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = await sendSourceSearch(staff, party, text(formData, "identifier_kind"));
  const back = routes.opsPartyIdentification(party);
  settle(outcome, { form: "search", subject: party, values: typed(formData) }, (accepted) => (accepted.matched ? "MATCHED" : "NO_MATCH"), back, back);
}

/** Declare: sent to review where the source found no match, or standing at once; either way the form says what happened. */
export async function declareAction(party: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = await sendDeclaration(staff, party, {
    evidenceKind: text(formData, "evidence_kind"),
    evidenceRef: text(formData, "evidence_ref"),
    reason: text(formData, "reason"),
    scan: chosenFile(formData, "scan"),
  });
  const back = routes.opsPartyIdentification(party);
  const stands = outcome.data?.accepted?.state === "IDENTIFIED";
  settle(outcome, { form: "declare", subject: party, values: typed(formData) }, (accepted) => accepted.review ?? accepted.state, stands ? routes.opsParty(party) : back, back);
}

// ---------------------------------------------------------------- SCR-PTY-05

const CLASSES: readonly ReferenceClass[] = ["PREMISES_RELATIONSHIPS", "AUTHORITIES", "LICENCE_HISTORY", "VERIFICATION_READS", "CHANGE_RECORDS"];

/** A review's decision: the outcome the button sent, and on a linkage the survivor and every disposition. */
export async function decideReviewAction(review: string, formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const dispositions = Object.fromEntries(CLASSES.map((key) => [key, text(formData, `dispositions.${key}`)]));
  const outcome = await sendReviewDecision(staff, review, { outcome: text(formData, "intent"), survivor: text(formData, "surviving_party_id"), dispositions });
  const page = routes.opsIdentificationReview(review);
  settle(outcome, { form: "decide", subject: review, values: typed(formData) }, (accepted) => accepted.outcome, page, page);
}

/** Raise candidacy: the review it opens, in the queue; nothing is linked until the review is decided. */
export async function raiseCandidacyAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("ACT-OPS");
  const outcome = await sendCandidacy(staff, { subjectKind: text(formData, "subject_kind"), left: text(formData, "left_ref"), right: text(formData, "right_ref"), ground: text(formData, "ground") });
  settle(outcome, { form: "candidacy", subject: "", values: typed(formData) }, (accepted) => accepted.review, routes.opsIdentificationReviews(), routes.opsRaiseCandidacy());
}

// ---------------------------------------------------------------- SCR-PTY-12, 13

/** Grant: the authority recorded, shown in place with what it allows. */
export async function grantAction(formData: FormData): Promise<void> {
  const principal = await requirePartyPrincipal();
  const outcome = await sendGrant(principal, {
    person: text(formData, "party_person_id"),
    scope: text(formData, "scope"),
    premises: text(formData, "premises_id"),
    acts: texts(formData, "scope_keys"),
    basis: text(formData, "basis"),
    evidence: text(formData, "evidence_ref"),
    file: chosenFile(formData, "evidence_file"),
    ...period(formData, "effective_period"),
    approvalAuthority: text(formData, "approval_authority_ref"),
    approvalLevel: text(formData, "approval_level"),
  });
  const page = routes.grantPartyAuthority();
  settle(outcome, { form: "grant", subject: "", values: typed(formData) }, (accepted) => accepted.authority, page, page);
}

/** Amend: the new version saved, and the authority shown with it. */
export async function amendAction(authority: string, formData: FormData): Promise<void> {
  const principal = await requirePartyPrincipal();
  const outcome = await sendAmendment(principal, authority, { acts: texts(formData, "scope_keys"), ...period(formData, "effective_period") });
  settle(outcome, { form: "amend", subject: authority, values: typed(formData) }, (accepted) => String(accepted.version), routes.partyAuthority(authority), routes.amendPartyAuthority(authority));
}

/** Revoke: back to the list, where the authority now reads revoked (the board's way out of SCR-PTY-13). */
export async function revokeAction(authority: string, formData: FormData): Promise<void> {
  const principal = await requirePartyPrincipal();
  const outcome = await sendRevocation(principal, authority, { effective: text(formData, "effective"), at: text(formData, "effective_at"), ground: text(formData, "ground") });
  settle(outcome, { form: "revoke", subject: authority, values: typed(formData) }, (accepted) => accepted.at, routes.partyAuthorities(), routes.partyAuthority(authority));
}
