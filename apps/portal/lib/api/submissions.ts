import type { LoadOutcome } from "@rightone/ui";
import {
  acknowledge,
  cancel,
  claimAt,
  claimForNav,
  getClaim,
  getSubmission,
  stageFile,
  submissionForNav,
  submit,
  submitForm,
} from "@/lib/mock/backend/submissions";
import { today } from "@/lib/mock/backend/clock";
import {
  BOARD_ORGANISATION,
  mockCancellation,
  mockClaim,
  mockSubmission,
  mockSubmitForm,
  type Cat04View,
  type Cat05View,
  type Cat07View,
  type Cat24View,
} from "@/lib/mock/submissions";
import { reviewView } from "@/lib/view/demo-view";
import { loadParticipationStanding } from "./participation";
import type { CmoAdministrator } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The catalogue's submissions and claims as the organisation portal reads and acts on them (CAT: SCR-CAT-04,
 * 05, 07, 24; `srs/02-api-contracts.md`). Each read takes the administrator, so it is scoped to their own
 * organisation, and `view`: a view the canvas drew answers its fixture for design review, null reads the
 * session's live state. Each act sends its command and answers what the API would: accepted, or refused with
 * the code of `design/04-refusal-codes.md`. Outside mock data everything is NOT_CONFIGURED.
 */

// ---------------------------------------------------------------- the domain

/** SM-23. */
export type SubmissionState = "RECEIVED" | "PROCESSING" | "COMPLETED" | "ACKNOWLEDGED" | "CANCELLED";

/** DR-33's five classes, in the order the boards count them. */
export type OutcomeClass = "ACCEPTED" | "WARNING" | "REJECTED" | "DUPLICATE" | "CONFLICT";
export const OUTCOME_CLASSES: readonly OutcomeClass[] = ["ACCEPTED", "WARNING", "REJECTED", "DUPLICATE", "CONFLICT"];

export type ExchangeFormat = "json" | "csv";

/** A channel the form offers: a CFG-31 register entry with its format, or one the register does not agree. */
export interface ExchangeChannel {
  code: string;
  /** The channel's technical profile; null for a channel outside the register, which has none here. */
  format: ExchangeFormat | null;
  agreed: boolean;
}

/** A record-level reason (DR-33), with the values its sentence names. */
export type RecordReason =
  | { code: "TERRITORY_NOT_REPRESENTED" }
  | { code: "IDENTIFIER_FORMAT"; scheme: string }
  | { code: "CLAIM_CONFLICT" }
  | { code: "RECORD_DUPLICATE"; heldAs: string }
  | { code: "COMPLETENESS_RULE_ABSENT" }
  | { code: "CREDIT_KIND_UNRECOGNISED"; credit: string }
  | { code: "ROLE_MISSING"; role: string };

/** FR-CAT-020: who corrects a record that was not accepted, by which channel, and whether it replaces or supplements. */
export type CorrectionRoute =
  | { kind: "scope-amendment" }
  | { kind: "correct-identifier"; scheme: string }
  | { kind: "conflict-handling" }
  | { kind: "none-duplicate" }
  | { kind: "none-activation" }
  | { kind: "supplement-credit" }
  | { kind: "supplement-role"; role: string };

export interface SubmissionOutcome {
  /** `record_index`: the record's position in the payload. */
  index: number;
  subject: { title: string; right: "mechanical" | "performing" | null; territory: string | null; claim: string | null };
  outcome: Exclude<OutcomeClass, "ACCEPTED">;
  reason: RecordReason;
  route: CorrectionRoute;
}

/** The file a submission was read from, as the portal received it; the file itself is not kept. */
export interface ReceivedFile {
  name: string;
  type: string;
  sizeBytes: number;
}

export interface Submission {
  reference: string;
  state: SubmissionState;
  channel: string;
  format: ExchangeFormat;
  /** The records the payload held, read at receipt; null where the channel's profile does not say how to count them. */
  records: number | null;
  file: ReceivedFile | null;
  receivedAt: string;
  /** Null where the canvas draws nobody. */
  submittedBy: string | null;
  /** While PROCESSING: how many records are classified so far. */
  processing: { classified: number } | null;
  completedAt: string | null;
  /** All five classes once COMPLETED, zeroes included; null before. */
  counts: Readonly<Record<OutcomeClass, number>> | null;
  /** The records that were not accepted, by record index. */
  outcomes: readonly SubmissionOutcome[];
  acknowledged: { by: string; at: string } | null;
  cancelled: { by: string; at: string; reason: string } | null;
}

/** SM-22. */
export type ClaimState = "DECLARED" | "VALIDATED" | "ACTIVE" | "SUPERSEDED" | "WITHDRAWN";

export interface ShareRecord {
  kind: "ownership" | "beneficiary";
  party: string;
  /** A share stated on another party's behalf names that party. */
  forParty: string | null;
  /** numeric(7,4); null where the claim states no share. */
  percent: number | null;
  from: string;
  to: string | null;
}

export interface ClaimRecord {
  reference: string;
  state: ClaimState;
  claimant: string;
  subject: { kind: "work"; title: string; id: string };
  layer: "work";
  territory: string;
  basis: "assignment-from-member";
  effectiveFrom: string;
  recordedOn: string;
  /** The submission record the claim was recorded from, when it came from one. */
  source: { submission: string; record: number } | null;
  /** A claim to the whole interest records no share. */
  wholeInterest: boolean;
  shares: readonly ShareRecord[];
}

/** DR-30's answer for one share kind, with the figures its sentence names; WHOLE_INTEREST is the screen's governed state. */
export type Completeness =
  | { code: "SHARES_COMPLETE"; total: number }
  | { code: "SHARES_SHORT"; total: number }
  | { code: "SHARES_OVER"; total: number }
  | { code: "SHARE_NOT_STATED" }
  | { code: "SHARES_ABSENT" }
  | { code: "COMPLETENESS_RULE_ABSENT" }
  | { code: "NO_BENEFICIARY_STATED" }
  | { code: "BENEFICIARY_PARTIAL"; assigned: number; kept: number }
  | { code: "WHOLE_INTEREST" };

/** The shares effective at the date asked about, each kind largest first. */
export interface SharesAt {
  ownership: readonly ShareRecord[];
  beneficiary: readonly ShareRecord[];
  /** When nothing is effective yet, the day the earliest later share starts. */
  nextFrom: string | null;
}

// ---------------------------------------------------------------- what the pages read

type Standing = Awaited<ReturnType<typeof loadParticipationStanding>>;

/** Who reads the page: the organisation, its administrator and its participation, as the shell's context draws them. */
export interface OrgReader {
  organisationName: string;
  account: string;
  participation: { reference: string | null; state: Standing["state"] };
}

/** What the submit form holds: typed by the person, kept by a refused attempt, or drawn by the canvas. */
export interface SubmitEntered {
  channel: string;
  format: ExchangeFormat;
  file: (ReceivedFile & { records: number | null; upload: string | null }) | null;
  refusal: { code: SubmitRefusalCode; field: "channel" | "format" | "file" | null } | null;
}

export type SubmitRefusalCode =
  | "PARTICIPATION_SUSPENDED"
  | "PARTICIPATION_NOT_ACTIVE"
  | "FIELD_MISSING"
  | "CHANNEL_NOT_AGREED"
  | "PAYLOAD_TOO_LARGE";

export interface SubmitFormPage {
  reader: OrgReader;
  channels: readonly ExchangeChannel[];
  /** NFR-12's batch ceiling, in records. */
  ceiling: number;
  entered: SubmitEntered | null;
  /** The canvas's submitting view: the file part-way up. */
  sending: { sentBytes: number } | null;
}

export interface SubmissionPage {
  reader: OrgReader;
  submission: Submission;
  /** An act on this page that was refused, with its code. */
  refusal: AcknowledgeRefusalCode | null;
}

export interface CancelPage {
  reader: OrgReader;
  submission: Submission;
  entered: { reason: string; refusal: "FIELD_MISSING" | null } | null;
}

export interface ClaimPage {
  reader: OrgReader;
  claim: ClaimRecord;
  /** The date the shares are read at; null when the reader cleared it. */
  asOf: string | null;
  asOfRefusal: "AS_OF_REQUIRED" | null;
  shares: SharesAt | null;
  completeness: { ownership: Completeness; beneficiary: Completeness } | null;
}

// ---------------------------------------------------------------- what a refused act hands back to its page

export interface SubmitAttempt {
  page: "submit";
  entered: SubmitEntered;
}

export type AcknowledgeRefusalCode = "SUBMISSION_NOT_COMPLETED" | "ALREADY_ACKNOWLEDGED" | "OUTCOME_NEVER_ISSUED";

export interface OutcomesAttempt {
  page: "outcomes";
  reference: string;
  refusal: AcknowledgeRefusalCode;
}

export interface CancelAttempt {
  page: "cancel";
  reference: string;
  reason: string;
  refusal: "FIELD_MISSING";
}

// ---------------------------------------------------------------- answers of the acts

export type SubmitAnswer =
  | { outcome: "received"; reference: string }
  | { outcome: "refused"; code: SubmitRefusalCode; field: "channel" | "format" | "file" | null; file: SubmitEntered["file"] };

export type StageAnswer = { upload: string; refusal: null } | { upload: null; refusal: "PAYLOAD_TOO_LARGE" };

export type CancelAnswer =
  | { outcome: "cancelled" }
  | { outcome: "refused"; code: "FIELD_MISSING" | "SUBMISSION_NOT_RECEIVED" | "NOT_YOUR_SUBMISSION" | "SUBMISSION_NOT_FOUND" };

export type AcknowledgeAnswer =
  | { outcome: "acknowledged" }
  | { outcome: "refused"; code: AcknowledgeRefusalCode | "NOT_YOUR_SUBMISSION" | "SUBMISSION_NOT_FOUND" };

// ---------------------------------------------------------------- review states

/**
 * The view `?view=` asks for, for design review. Every fixture is the canvas's, and the canvas draws Lam Hồng's
 * submissions and claim, so only Lam Hồng's own session reads them; any other organisation reads its live state,
 * never another organisation's records.
 */
export function reviewFor<V extends string>(
  cmo: CmoAdministrator,
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
  views: readonly V[],
): V | null {
  return cmo.organisation === BOARD_ORGANISATION ? reviewView(searchParams, views) : null;
}

async function readerOf(cmo: CmoAdministrator): Promise<OrgReader> {
  const standing = await loadParticipationStanding(cmo);
  return { organisationName: cmo.organisationName, account: cmo.account, participation: { reference: standing.reference, state: standing.state } };
}

// ---------------------------------------------------------------- reads

/** SCR-CAT-04: the channels the form offers and the ceiling, for the reader's participation. */
export async function loadSubmitForm(
  cmo: CmoAdministrator,
  view: Exclude<Cat04View, "loading"> | null,
  attempt: SubmitAttempt | null,
): Promise<LoadOutcome<SubmitFormPage>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  if (view !== null) return mockSubmitForm(view);
  return submitForm(cmo.sessionId, await readerOf(cmo), attempt?.entered ?? null);
}

/**
 * SCR-CAT-05 (GET /submissions/{reference}, /outcomes): one of the organisation's submissions. Another
 * organisation's reference is refused NOT_YOUR_SUBMISSION and discloses nothing of it (@AC-FR-CAT-010-04); an
 * unknown one is SUBMISSION_NOT_FOUND, the contract's 404.
 */
export async function loadSubmission(
  cmo: CmoAdministrator,
  reference: string,
  view: Exclude<Cat05View, "loading"> | null,
  attempt: OutcomesAttempt | null,
): Promise<LoadOutcome<SubmissionPage>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  if (view !== null) return mockSubmission(view);
  const outcome = getSubmission(cmo.sessionId, cmo.organisation, reference);
  if (outcome.data === null) return { data: null, failure: outcome.failure };
  const refusal = attempt?.reference === reference ? attempt.refusal : null;
  return { data: { reader: await readerOf(cmo), submission: outcome.data, refusal }, failure: null };
}

/** SCR-CAT-24: the submission to cancel, read as SCR-CAT-05 reads it, with the reason a refused attempt kept. */
export async function loadCancellation(
  cmo: CmoAdministrator,
  reference: string,
  view: Exclude<Cat24View, "loading"> | null,
  attempt: CancelAttempt | null,
): Promise<LoadOutcome<CancelPage>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  if (view !== null) return mockCancellation(view);
  const outcome = getSubmission(cmo.sessionId, cmo.organisation, reference);
  if (outcome.data === null) return { data: null, failure: outcome.failure };
  const entered = attempt?.reference === reference ? { reason: attempt.reason, refusal: attempt.refusal } : null;
  return { data: { reader: await readerOf(cmo), submission: outcome.data, entered }, failure: null };
}

/**
 * SCR-CAT-07 (GET /claims/{id}/shares, /completeness): one of the organisation's claims, with its shares and
 * DR-30's answers at a date. The API takes `as_of` with no default; the screen fills it with today as a visible
 * value, so `asked` null reads today and an empty one (the reader cleared the date) is AS_OF_REQUIRED.
 * Another organisation's claim is refused ROLE_OUT_OF_SCOPE, as the board draws it.
 */
export async function loadClaim(
  cmo: CmoAdministrator,
  reference: string,
  asked: string | null,
  view: Exclude<Cat07View, "loading"> | null,
): Promise<LoadOutcome<ClaimPage>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  if (view !== null) {
    const fixture = mockClaim(view);
    if (fixture.data === null) return { data: null, failure: fixture.failure };
    const { reader, claim, asOf, rules } = fixture.data;
    return { data: { reader, ...claimAt(claim, asOf, rules) }, failure: null };
  }
  const asOf = asked === null ? today() : asked;
  const outcome = getClaim(cmo.sessionId, cmo.organisation, reference, asOf === "" ? null : asOf);
  if (outcome.data === null) return { data: null, failure: outcome.failure };
  return { data: { reader: await readerOf(cmo), ...outcome.data }, failure: null };
}

/**
 * The nav's Submissions. No list of submissions is specified (G-11), so it opens one on SCR-CAT-05: the earliest
 * completed submission not yet acknowledged, which is what NTF-CAT-01 sends the organisation to; otherwise the
 * latest received. Null when the organisation has none.
 */
export function findSubmissionForNav(cmo: CmoAdministrator): Promise<LoadOutcome<string | null>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: submissionForNav(cmo.sessionId, cmo.organisation), failure: null });
}

/** The nav's Claims. The claim list is cited but not specified (G-11): it opens the latest recorded claim, or none. */
export function findClaimForNav(cmo: CmoAdministrator): Promise<LoadOutcome<string | null>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: claimForNav(cmo.sessionId, cmo.organisation), failure: null });
}

// ---------------------------------------------------------------- acts

/**
 * One part of the file the person chose, on its way to the server. The portal reads the whole file before it
 * sends POST /submissions; it arrives in parts because one request to a server action carries at most 1 MB.
 */
export function stageSubmissionFile(cmo: CmoAdministrator, upload: string | null, bytes: Uint8Array): Promise<LoadOutcome<StageAnswer>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: stageFile(cmo.sessionId, upload, bytes), failure: null });
}

/** POST /submissions (FR-CAT-009): the file read and checked; a reference issued at RECEIVED, or the refusal. */
export async function sendSubmission(
  cmo: CmoAdministrator,
  input: { channel: string; format: string; upload: string | null; name: string; type: string },
): Promise<LoadOutcome<SubmitAnswer>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  const standing = await loadParticipationStanding(cmo);
  return { data: submit(cmo.sessionId, { ...input, organisation: cmo.organisation, account: cmo.account, participation: standing.state }), failure: null };
}

/** POST /submissions/{reference}/cancel (FR-CAT-028). */
export function sendCancellation(cmo: CmoAdministrator, reference: string, reason: string): Promise<LoadOutcome<CancelAnswer>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: cancel(cmo.sessionId, cmo.organisation, cmo.account, reference, reason), failure: null });
}

/** POST /submissions/{reference}/acknowledge, every outcome at once (FR-CAT-024). */
export function sendAcknowledgement(cmo: CmoAdministrator, reference: string): Promise<LoadOutcome<AcknowledgeAnswer>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: acknowledge(cmo.sessionId, cmo.organisation, cmo.account, reference), failure: null });
}
