import type { LoadOutcome } from "@rightone/ui";
import { loadParticipationStanding } from "@/lib/api/participation";
import type { CmoAdministrator, Staff } from "@/lib/api/session";
import { enquiryForm, overlapReport, readVerificationReads, verifyAuthorityScope } from "@/lib/mock/backend/authorisation";
import { mockOverlapReport, mockVerifyAuthorisation, type Pty17View, type Pty18View } from "@/lib/mock/authorisation";
import { NOT_CONFIGURED, usesMockData } from "./source";

/** A premises of the public register, as the enquirer picks it: its record, trading name and ward. */
export interface RegisterPremises {
  reference: string;
  name: string;
  ward: string;
}

/**
 * The three answers of POST /authority-verifications (FR-PTY-047). None names another holder: the third says
 * only that somebody's authority was in effect (@AC-FR-PTY-047-02).
 */
export type VerificationAnswer = "EFFECTIVE" | "NOT_EFFECTIVE" | "ANOTHER_AUTHORITY_EXISTS";

/** One answered enquiry, as the enquirer reads it. */
export interface AuthorityVerification {
  premises: RegisterPremises;
  /** The business instant asked about. */
  at: string;
  answer: VerificationAnswer;
  /** EFFECTIVE only: the period the enquirer's own authority runs, the one period the answer may carry. */
  period: { from: string; to: string } | null;
  /** When the read was recorded in `party.verification_reads`. */
  readAt: string;
}

/** One verification read of a premises, as the overlap report lists it: who asked, about when, and what they were told. */
export interface OverlapRow {
  id: string;
  organisation: { id: string; name: string };
  askedAt: string;
  answer: VerificationAnswer;
  readAt: string;
}

/** SCR-PTY-18 for the data owner and assurance: GET /premises/{id}/verification-reads. */
export interface OverlapReport {
  asOf: string;
  /** The premises asked about; null until one is chosen. */
  premises: RegisterPremises | null;
  filter: { from: string | null; to: string | null };
  rows: readonly OverlapRow[];
  /** How many organisations asked, and how many of them were told another authority exists. */
  organisations: number;
  toldAnother: number;
  /** The register to choose another premises from. */
  register: readonly RegisterPremises[];
}

/** The refusals SCR-PTY-17 renders (PTY 04, the account-free surface's three). */
export type VerifyRefusal = "NOT_A_REGISTERED_COLLECTING_ORGANISATION" | "INSTANT_IN_FUTURE" | "PREMISES_NOT_FOUND";

/** What became of an enquiry: the answer, a refusal, or no answer at all. */
export type VerifyResult =
  /** Nothing asked yet. */
  | { kind: "none" }
  /** The register is being asked; a review state, the form's own sending draws it live. */
  | { kind: "checking" }
  | { kind: "answered"; verification: AuthorityVerification }
  /** INSTANT_IN_FUTURE carries the time of the request, which the time field's helper names. */
  | { kind: "refused"; code: VerifyRefusal; requestedAt: string }
  /** CAT's participation could not be read, so the route failed closed: nothing about the premises is shared. */
  | { kind: "unavailable" }
  /** The register did not answer: no answer is guessed, the trace is given. */
  | { kind: "failed"; traceId: string | null };

/** The question as the reader gave it, kept so a refused or failed enquiry shows it again as typed. */
export interface VerifyQuestion {
  /** The premises record chosen, or the reference typed. */
  premises: string;
  /** ISO date and 24-hour time, in Vietnam time, as R1's date field reads them back. */
  date: string;
  time: string;
}

/** What Ask hands back to SCR-PTY-17. */
export interface VerifyAttempt {
  /** The organisation that asked: an attempt's address opened by another organisation shows it nothing. */
  organisation: string;
  question: VerifyQuestion;
  result: VerifyResult;
}

/** SCR-PTY-17 as one enquirer reads it. */
export interface VerifyAuthorisation {
  /** Whether the organisation may use the route: an effective CAT participation (PTY 09, UC-PTY-05 precondition). */
  registered: boolean;
  /** The public register to pick from; empty for an organisation that may not ask, so nothing of a premises is shared. */
  register: readonly RegisterPremises[];
  /** The latest day the calendar offers: today, as no later moment may be asked about (FR-PTY-046). */
  today: string;
  question: VerifyQuestion;
  result: VerifyResult;
}

/**
 * SCR-PTY-17: the question, as the canvas drew it with `view`, otherwise as the session's last enquiry left it.
 * An organisation without an effective participation reads the refusal and nothing of the register; an
 * attempt kept for another organisation (its address opened by someone else) is not shown.
 */
export function loadVerifyAuthorisation(
  cmo: CmoAdministrator,
  registered: boolean,
  view: Pty17View | null,
  attempt: VerifyAttempt | null,
): Promise<LoadOutcome<VerifyAuthorisation>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  const own = attempt !== null && attempt.organisation === cmo.organisation ? attempt : null;
  return Promise.resolve(view !== null ? mockVerifyAuthorisation(view) : enquiryForm(cmo.sessionId, registered, own));
}

/**
 * POST /authority-verifications: whether an authority to collect for the premises was in effect at the instant,
 * for this organisation. Whether it is a collecting organisation is CAT's answer (`ICatalogueReader`, PTY srs/07),
 * read here through the participation standing; a standing that cannot be read fails closed.
 */
export async function sendAuthorityVerification(
  cmo: CmoAdministrator,
  input: { premises: string; at: string },
): Promise<LoadOutcome<VerifyResult>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  let registered: boolean | null;
  try {
    registered = (await loadParticipationStanding(cmo)).active;
  } catch {
    registered = null;
  }
  return { data: verifyAuthorityScope(cmo.sessionId, { organisation: cmo.organisation, registered }, input), failure: null };
}

/**
 * SCR-PTY-18 for the organisation portal: GET /premises/{id}/verification-reads is reserved to the data owner
 * and assurance, so a collecting organisation is refused with OVERLAP_REPORT_RESERVED and is never answered
 * with a report. The report's own shape belongs to the consoles, which this portal does not have.
 */
export function loadOverlapReport(cmo: CmoAdministrator, view: Pty18View | null): Promise<LoadOutcome<never>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockOverlapReport() : readVerificationReads(cmo.sessionId, { organisation: cmo.organisation }));
}

/**
 * SCR-PTY-18 on the register data console: the verification reads of one premises for the data owner and assurance,
 * optionally from and to a day. Reading it changes nothing.
 */
export function loadConsoleOverlapReport(staff: Staff, premises: string, period: { from: string | null; to: string | null }): Promise<LoadOutcome<OverlapReport>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(overlapReport(staff, premises, period));
}
