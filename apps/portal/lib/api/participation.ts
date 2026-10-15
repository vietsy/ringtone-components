import type { LoadOutcome } from "@rightone/ui";
import type { CmoAdministrator } from "@/lib/api/session";
import type { Locale } from "@/lib/i18n/translate";
import {
  amendmentStep,
  applicationForm,
  lodgeObjection as lodgeObjectionCommand,
  myParticipation,
  objectionStep,
  participationStanding,
  proposeScopeAmendment as proposeScopeAmendmentCommand,
  saveParticipationDraft,
  submitParticipation,
  type ParticipationStanding,
  type ParticipationState,
} from "@/lib/mock/backend/participation";
import {
  mockAmendmentStep,
  mockApplicationForm,
  mockMyParticipation,
  mockObjectionStep,
  scopeAsAt,
  type Cat01View,
  type Cat02State,
  type Cat02View,
  type Cat03View,
  type Cat25View,
} from "@/lib/mock/participation";
import { today } from "@/lib/mock/backend/clock";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The catalogue's participation of a rights organisation (CAT, SM-21), as the organisation portal reads and
 * changes it: the application (SCR-CAT-01), the participation and its scope as at a date (SCR-CAT-02), a scope
 * amendment (SCR-CAT-03), and an answer to a decision (SCR-CAT-25). Every read and act is the signed-in
 * administrator's own organisation's (`cmo.organisation`); a reference of another organisation is not found.
 *
 * With `view` a load answers the state a board drew, for design review; without it, the session's live state
 * from the mock backend. Outside mock data everything is NOT_CONFIGURED.
 */

export type { ParticipationState, ParticipationStanding } from "@/lib/mock/backend/participation";

/**
 * Where the organisation stands in the catalogue: its participation's reference and state. Every page of the
 * organisation portal reads it for the nav (submitting, submissions and claims open once it participates,
 * suspended included) and for the shell's context line. Outside mock data nothing is known, which reads as no
 * participation: the nav then offers only what needs none.
 */
export function loadParticipationStanding(cmo: CmoAdministrator): Promise<ParticipationStanding & { active: boolean; open: boolean }> {
  const standing = usesMockData() ? participationStanding(cmo.sessionId, cmo.organisation) : { reference: null, state: null };
  // Open: the organisation participates, even while suspended (SCR-CAT-04 then draws its own locked form).
  return Promise.resolve({ ...standing, active: standing.state === "ACTIVE", open: standing.state === "ACTIVE" || standing.state === "SUSPENDED" });
}

// ---------------------------------------------------------------- the registers

/** The rights-layer register, in its own order. */
export type Right = "perf" | "mech" | "sync";
/** The repertoire register. */
export type Repertoire = "dom" | "int";
/** The territory register: the provinces the boards draw, in the register's order. */
export type Territory = "hn" | "dn" | "hp" | "hue" | "hcm";

export const RIGHTS: readonly Right[] = ["perf", "mech", "sync"];
export const REPERTOIRES: readonly Repertoire[] = ["dom", "int"];
export const TERRITORIES: readonly Territory[] = ["hn", "dn", "hp", "hue", "hcm"];

/** One combination of the three dimensions: what a scope row represents. */
export interface ScopeKey {
  right: Right;
  repertoire: Repertoire;
  territory: Territory;
}

export const scopeKey = (key: ScopeKey): string => `${key.right}-${key.repertoire}-${key.territory}`;

// ---------------------------------------------------------------- SCR-CAT-01

export type ApplyingAs = "holder" | "intermediary";
/** The organisation's own list of contact roles, as the board offers it. */
export type ContactRole = "admin" | "legal";

export interface ApplicationContact {
  name: string;
  role: ContactRole | null;
  address: string;
}

/** An authority document: its name, kind and size as the browser gave them; the mock keeps no file. */
export interface EvidenceFile {
  name: string;
  kind: "pdf" | "image" | "other";
  sizeBytes: number;
  /** When it was recorded and by whom; null until the draft holding it is saved. */
  at: string | null;
  by: string | null;
}

/** What the application form holds, saved or as typed. Dates are ISO dates; null when empty or unreadable. */
export interface ApplicationFields {
  applyingAs: ApplyingAs | null;
  evidenceRef: string;
  evidenceFiles: readonly EvidenceFile[];
  contacts: readonly ApplicationContact[];
  layers: readonly Right[];
  repertoires: readonly Repertoire[];
  territories: readonly Territory[];
  periodFrom: string | null;
  periodTo: string | null;
}

/**
 * A field a submission is refused for with FIELD_MISSING, by the form's name for it. A contact's field carries
 * its row: `contact_name.0`.
 */
export type ApplicationField = string;

export interface ApplicationForm {
  /** What the party register holds; a value it holds nothing for is null and shows as not recorded. */
  organisation: { legalName: string; partyRecord: string | null; partyKind: "organisation" | null };
  /** When the draft was last saved; null when nothing has been saved yet. */
  savedAt: string | null;
  fields: ApplicationFields;
  /** The fields a submission of the draft as saved would be refused for: the board's missing state. */
  missing: readonly ApplicationField[];
}

export type ApplicationRefusal =
  | { code: "FIELD_MISSING"; fields: readonly ApplicationField[] }
  | { code: "RANGE_OVERLAP" | "PERIOD_INVALID"; fields: readonly ["period"] };

/** A refused submission, kept for the form: every value as typed and the refusal against its fields. */
export interface ApplicationAttempt {
  page: "apply";
  fields: ApplicationFields;
  refusal: ApplicationRefusal;
}

export type Answer<A, R> = { accepted: A; refusal: null } | { accepted: null; refusal: R };

export function loadApplicationForm(cmo: CmoAdministrator, view: Exclude<Cat01View, "loading"> | null): Promise<LoadOutcome<ApplicationForm>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockApplicationForm(view) : applicationForm(cmo.sessionId, cmo.organisation));
}

/** Save draft: everything as entered, whatever is missing (SCR-CAT-01 Actions, Save draft "Always"). */
export function saveApplicationDraft(cmo: CmoAdministrator, fields: ApplicationFields): Promise<LoadOutcome<{ savedAt: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: saveParticipationDraft(cmo.sessionId, cmo.organisation, fields, cmo.account), failure: null });
}

/** POST /participations: the participation at APPLIED, or the refusal against the fields it names. */
export function submitApplication(
  cmo: CmoAdministrator,
  fields: ApplicationFields,
): Promise<LoadOutcome<Answer<{ reference: string }, ApplicationRefusal>>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: submitParticipation(cmo.sessionId, cmo.organisation, fields, cmo.account), failure: null });
}

// ---------------------------------------------------------------- SCR-CAT-02

/** One approved scope row with its period and what the unified catalogue holds under it. */
export interface ScopeRow extends ScopeKey {
  from: string;
  /** The first day the row no longer applies; null for an open end. */
  to: string | null;
  claimedSubjects: number;
}

/** A proposed scope change still awaiting its approval (FR-CAT-023). */
export interface PendingAmendment {
  reference: string;
  additions: readonly ScopeKey[];
  removals: readonly ScopeKey[];
  effectiveFrom: string;
  preparedBy: string;
  preparedAt: string;
}

/** The authority's stop on a participation (SCR-CAT-21, SCR-CAT-22), as the organisation reads it. */
export interface ParticipationStop {
  kind: "suspension" | "withdrawal";
  effectiveFrom: string;
  /** The reason recorded with the decision, verbatim. */
  reason: string;
  decidedBy: string;
  decidedOn: string;
  /** Withdrawn: the claims made while the participation held, which stay active. */
  claimsKept: number | null;
}

export interface MyParticipation {
  reference: string;
  organisation: string;
  /** How the boards name the organisation in a sentence ("Lam Hồng"). */
  shortName: string;
  /** What kind of rights organisation the register records; null when it records none. */
  kind: "cmo" | "publisher" | null;
  state: ParticipationState;
  appliedAt: string | null;
  /** The day the eighth approval of FR-CAT-002 was recorded. */
  approvedOn: string | null;
  /** Active since, or takes effect on. */
  effectiveFrom: string | null;
  lastReviewedOn: string | null;
  stop: ParticipationStop | null;
  /** Every approved scope row, closed ones included. */
  scope: readonly ScopeRow[];
  amendments: readonly PendingAmendment[];
  /** The reference of a decision about this participation that has been notified, which SCR-CAT-25 answers. */
  decision: string | null;
}

/** A right not represented in a territory the scope otherwise covers: the computed gap sentence. */
export interface ScopeGap {
  right: Right;
  territory: Territory;
  /** The earliest pending amendment that would add the combination, when one does. */
  addedFrom: string | null;
}

export interface ScopeView {
  asOf: string;
  rows: readonly ScopeRow[];
  gaps: readonly ScopeGap[];
}

export interface ParticipationPage {
  participation: MyParticipation;
  /** Design review only: the legal approver the board draws as the reader (`?reader=legal`); null otherwise. */
  legalReader: string | null;
  /** Null when the date was cleared: AS_OF_REQUIRED, nothing is resolved. */
  scope: ScopeView | null;
}

/**
 * SCR-CAT-02: the organisation's participation and the scope in force on `asOf`: undefined reads the default
 * (today; the board's date in review), null is a cleared date (AS_OF_REQUIRED, nothing resolved). Null data
 * without a failure: the organisation has no participation.
 */
export function loadMyParticipation(
  cmo: CmoAdministrator,
  asOf: string | null | undefined,
  review: { view: Exclude<Cat02View, "loading">; state: Cat02State } | null,
  locale: Locale,
): Promise<LoadOutcome<ParticipationPage | null>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (review !== null) return Promise.resolve(mockMyParticipation(review.view, review.state, asOf, locale));
  const outcome = myParticipation(cmo.sessionId, cmo.organisation);
  const participation = outcome.data;
  if (participation === null) return Promise.resolve({ data: null, failure: outcome.failure });
  const date = asOf === undefined ? today() : asOf;
  return Promise.resolve({ data: { participation, legalReader: null, scope: date === null ? null : scopeAsAt(participation, date) }, failure: null });
}

// ---------------------------------------------------------------- SCR-CAT-03

export interface AmendmentStep {
  participation: { reference: string; organisation: string; shortName: string };
  /** Today, which an effective date must come after. */
  today: string;
  /** The scope rows in force today, which a removal chooses from and the comparison starts from. */
  current: readonly ScopeRow[];
  /** The amendment shown read-only, awaiting approval; null while a new one is prepared. */
  amendment: PendingAmendment | null;
  /** Who prepares a new amendment: the signed-in administrator. */
  preparer: string;
  /** Design review only: the legal approver the board draws as the reader; null otherwise. */
  legalReader: string | null;
  /** Design review only: the board's draft typed in (draft, past-date). */
  draft: { additions: readonly ScopeKey[]; removals: readonly string[]; effectiveFrom: string } | null;
}

export type AmendmentRefusal =
  | { code: "PARTICIPATION_NOT_ACTIVE"; field: null }
  | { code: "EFFECTIVE_FROM_IN_PAST"; field: "effective_from" }
  | { code: "FIELD_MISSING"; field: string };

/** A refused proposal kept for the form: the rows, the closings and the date as entered, and the refusal. */
export interface AmendmentAttempt {
  page: "amend";
  additions: readonly { right: Right | null; repertoire: Repertoire | null; territory: Territory | null }[];
  removals: readonly string[];
  effectiveFrom: string | null;
  refusal: AmendmentRefusal;
}

/** SCR-CAT-03: a new amendment of the active participation, or a review state. Null data: not active. */
export function loadAmendmentStep(
  cmo: CmoAdministrator,
  review: { view: Exclude<Cat03View, "loading"> } | null,
): Promise<LoadOutcome<AmendmentStep | null>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(review !== null ? mockAmendmentStep(review.view) : amendmentStep(cmo.sessionId, cmo.organisation, cmo.account));
}

/** POST /participations/{id}/scope-amendments: a pending amendment, or the refusal. */
export function proposeScopeAmendment(
  cmo: CmoAdministrator,
  proposal: { additions: readonly ScopeKey[]; incomplete: string | null; removals: readonly string[]; effectiveFrom: string | null },
): Promise<LoadOutcome<Answer<{ reference: string }, AmendmentRefusal>>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: proposeScopeAmendmentCommand(cmo.sessionId, cmo.organisation, proposal, cmo.account), failure: null });
}

// ---------------------------------------------------------------- SCR-CAT-25

export type ObjectionKind = "objection" | "correction" | "erasure";

/** A decision of this catalogue notified to the organisation, which it may answer. */
export interface NotifiedDecision {
  /** The reference given in the notice: the participation's, for a stop. */
  reference: string;
  kind: "suspension";
  effectiveFrom: string;
  reason: string;
}

export interface ObjectionRecord {
  reference: string;
  decision: string;
  requested: ObjectionKind;
  ground: string;
  lodgedAt: string;
  dueAt: string;
  outcome: { outcome: "upheld" | "refused" | "partly_upheld"; ground: string; decidedBy: string; decidedAt: string } | null;
}

export interface ObjectionStep {
  decision: NotifiedDecision;
  participation: { reference: string; organisation: string; state: ParticipationState };
  /** The objection already lodged about this decision, open or decided; null while nothing is lodged. */
  objection: ObjectionRecord | null;
  /** The date an answer would be due for each kind, lodged today (CFG-35). */
  dueBy: Readonly<Record<ObjectionKind, string>>;
  /** Design review only: the board's ground typed in, for the confirm state. */
  ground: string;
}

export type ObjectionRefusal = { code: "FIELD_MISSING"; fields: readonly ("request_kind" | "ground")[] } | { code: "SUBJECT_UNKNOWN" | "OBJECTION_ALREADY_OPEN"; fields: readonly [] };

export interface ObjectionAttempt {
  page: "objection";
  decision: string;
  requested: ObjectionKind | null;
  ground: string;
  refusal: ObjectionRefusal;
}

/**
 * SCR-CAT-25 for the decision the reference names. A reference that names no decision notified to this
 * organisation is not found, never another organisation's decision. Null data: no reference was given.
 */
export function loadObjectionStep(
  cmo: CmoAdministrator,
  decision: string | null,
  view: Exclude<Cat25View, "loading"> | null,
  locale: Locale,
): Promise<LoadOutcome<ObjectionStep | null>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view !== null) return Promise.resolve(mockObjectionStep(view, locale));
  return Promise.resolve(decision === null ? { data: null, failure: null } : objectionStep(cmo.sessionId, cmo.organisation, decision));
}

/** POST /objections: the objection with its due date, or the refusal. */
export function lodgeObjection(
  cmo: CmoAdministrator,
  request: { decision: string; requested: ObjectionKind | null; ground: string },
): Promise<LoadOutcome<Answer<{ reference: string }, ObjectionRefusal>>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: lodgeObjectionCommand(cmo.sessionId, cmo.organisation, request), failure: null });
}
