import type { LoadOutcome } from "@rightone/ui";
import {
  addPartyPerson,
  amendAuthority as amendAuthorityCommand,
  amendPartyPerson,
  changeRecords,
  authorityAmendment,
  authorityDetail,
  createParty,
  decideReview,
  declareIdentification,
  grantAuthority as grantAuthorityCommand,
  grantForm,
  identificationForm,
  partyAuthorities,
  partyDetail,
  partiesWithAuthorities,
  partyList,
  partyPerson,
  personResolution,
  raiseCandidacy,
  recordPrincipal,
  reviewDetail,
  reviewQueue,
  revokeAuthority as revokeAuthorityCommand,
  searchSource,
} from "@/lib/mock/backend/parties";
import { PARTIES_TRACES, mockPartiesFailure, type PartiesView } from "@/lib/mock/parties";
import type { Principal, Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";
import type { Act, ApprovalLevel, IdentifierKind } from "./parties-terms";

export {
  ACTS,
  APPROVAL_LEVELS,
  CANDIDACY_KINDS,
  EVIDENCE_KINDS,
  IDENTIFIER_KINDS,
  type Act,
  type ApprovalLevel,
  type CandidacyKind,
  type EvidenceKind,
  type IdentifierKind,
} from "./parties-terms";

/*
 * The party family (PTY) as the operations console, the premises portal and the security console read it: who a
 * party is and how it was identified, the reviews that decide whether two records are one, and who may act for a
 * party (SCR-PTY-01 to 05, 11 to 13). Each loader is one screen's read for the person signed in; given a review
 * view it answers the failure the board drew instead (design review). Every command is the API's
 * (`srs/02-api-contracts.md`, sections 1, 3 and 4), checked server side against the reader's roles, their party and
 * the separations of duties, and refused with the codes of `design/04-refusal-codes.md`; a refused command records
 * nothing.
 */

// ---------------------------------------------------------------- vocabularies

export const PARTY_STATES = ["DRAFT", "IDENTIFIED", "REFERRED", "SUPERSEDED"] as const;
/** SM-190: a party record's state, shown on the console as its code. */
export type PartyState = (typeof PARTY_STATES)[number];

/** CFG-248: the kinds of party the register holds. */
export const PARTY_KINDS = ["ORGANISATION", "HOUSEHOLD_BUSINESS", "NATURAL_PERSON"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

/** SM-192 as a reader sees it: PROPOSED never persists and REFUSED is never stored, so neither is listed. */
export type AuthorityState = "PENDING_START" | "EFFECTIVE" | "EXPIRED" | "REVOKED" | "LAPSED";


export const REVIEW_KINDS = ["DUPLICATE_CANDIDACY", "IDENTIFICATION"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
/** SM-193. */
export type ReviewState = "OPEN" | "LINKED" | "NOT_LINKED" | "STANDS" | "RETURNED";

/** DR-207's licensing status of a premises, derived from the status record of record. */
export type LicensingStatus = "LICENSED" | "UNREGISTERED" | "LAPSED";



/** How the source of identification stood when the form was opened (DR-200's inputs). */
export type SourceCondition = "REACHABLE" | "UNREACHABLE" | "NOT_CONFIGURED";

/** Where a party record came from, which a reader weighs the rest of the record by. */
export type PartyOrigin =
  | { kind: "SOURCE"; on: string | null }
  | { kind: "MANUAL"; on: string }
  | { kind: "IMPORTED"; on: string }
  | { kind: "CREATED"; on: string; by: string }
  /** Entered from what the party declared, with no time kept for it. */
  | { kind: "DECLARED" };

/** The kinds of reference a linkage disposes of (FR-PTY-032), in the order the decision lists them. */
export type ReferenceClass = "PREMISES_RELATIONSHIPS" | "AUTHORITIES" | "LICENCE_HISTORY" | "VERIFICATION_READS" | "CHANGE_RECORDS";

/** A file chosen in a form: the mock keeps what it is, never its bytes. */
export interface ChosenFile {
  name: string;
  type: string;
  sizeBytes: number;
}

/** A command's answer: what it recorded, or the refusal with the field it names and the values its sentence names. */
export interface PartyAnswer<T> {
  accepted: T | null;
  refusal: { code: string; field: string | null; values: Readonly<Record<string, string>> } | null;
}

// ---------------------------------------------------------------- SCR-PTY-01

export interface PartyRow {
  record: string;
  legalName: string;
  /** Masked to its last four digits; null for a party with none. */
  businessRegistration: string | null;
  kind: PartyKind;
  state: PartyState;
  /** The linkage that superseded the record, read with the row and never only in a tooltip. */
  supersededBy: { record: string; legalName: string; on: string; by: string } | null;
}

export interface PartyList {
  asOf: string;
  filter: { q: string | null; state: PartyState | null };
  rows: readonly PartyRow[];
  /** The open reviews, counted on the queue's link tab. */
  openReviews: number;
}

// ---------------------------------------------------------------- SCR-PTY-02

export interface IdentificationView {
  route: "SOURCED" | "MANUAL";
  /** When the source answered or the declaration was made; null where the register keeps no time for it. */
  at: string | null;
  /** SOURCED: the kind of identifier sent; null where the register keeps none. */
  identifierKind: IdentifierKind | null;
  /** MANUAL: the declaration and how the source stood when it was made. */
  declaration: {
    evidenceKind: string;
    evidenceRef: string;
    reason: string;
    by: string;
    scan: { name: string; at: string; by: string } | null;
    source: SourceCondition;
    /** The search that found no match before the declaration, when the source answered. */
    search: { identifier: string; at: string } | null;
  } | null;
  /** The review that decided a declaration, when one did. */
  decided: { by: string; at: string } | null;
  /** DR-200's reason code, where the register recorded one; the seed's earlier identifications carry none. */
  reasonCode?: "IDENTIFIED_FROM_SOURCE" | "NO_MATCH_DECLARED" | "MANUAL_ROUTE_CHOSEN" | "MANUAL_ROUTE_FORCED" | "NO_SOURCE_CONFIGURED";
  /** SOURCED: the source that answered and the record it matched. */
  source?: { name: string; legalName: string } | null;
}

export interface PremisesRow {
  /** The register record, PRM- and eight characters; null where the register has not given one yet. */
  record: string | null;
  name: string;
  since: string | null;
  licensing: LicensingStatus;
  /** The status record the status is derived from, and when it took its state. */
  statusRecord: { reference: string; since: string } | null;
  /** Where the premises holds no status record: how far its application has gone, as the board says it. */
  application: "IN_REVIEW" | "DRAFT" | null;
}

export interface AuthorityRow {
  reference: string;
  person: string;
  /** The premises the authority is scoped to, or null for the whole party. */
  premises: { record: string | null; name: string } | null;
  acts: readonly Act[];
  from: string;
  to: string | null;
  state: AuthorityState;
  revoked: { at: string; by: string } | null;
  /** A point the revocation has not reached inside the interval, with when security took up its exception. */
  unpropagated: { point: "PORTAL_SESSIONS" | "API_TOKENS" | "PLAYER"; acknowledgedAt: string } | null;
  /** A principal recorded on the console, with who recorded it and when. */
  recorded: { by: string; at: string } | null;
}

export interface PartyPersonOption {
  reference: string;
  name: string;
  hasAccount: boolean;
  createdBy: string | null;
  createdAt: string | null;
}

export interface PartyDetail {
  asOf: string;
  record: string;
  legalName: string;
  kind: PartyKind;
  businessRegistration: string | null;
  state: PartyState;
  origin: PartyOrigin;
  /** The legal representative the business register names, or the principal recorded on the console. */
  principal: { name: string; fromRegister: boolean } | null;
  identification: IdentificationView | null;
  /** An open duplicate review naming this record, with the other record. */
  duplicate: { review: string; other: { record: string; legalName: string; origin: PartyOrigin } } | null;
  /** The review a declaration of this party waits in. */
  identificationReview: string | null;
  supersededBy: { record: string; legalName: string; on: string; by: string } | null;
  premises: readonly PremisesRow[];
  authorities: readonly AuthorityRow[];
  /** The register's persons, for Record principal. */
  persons: readonly PartyPersonOption[];
  /** The reader holds the operations role and may act here; assurance reads only. */
  mayAct: boolean;
  /** The officer signed in, as Recorded by shows them. */
  officer: string;
  today: string;
}

// ---------------------------------------------------------------- SCR-PTY-03

export interface IdentificationForm {
  record: string;
  legalName: string;
  kind: PartyKind;
  businessRegistration: string | null;
  state: PartyState;
  source: { condition: SourceCondition; probedAt: string };
  /** The last search of the source for this party. */
  lastSearch: { identifierKind: IdentifierKind; identifier: string; matched: boolean; at: string } | null;
  /** SELF_IDENTIFICATION_REFUSED: the reader is a person the party's authorities name, so no form is offered. */
  selfRefused: boolean;
  officer: string;
  /** Where the party is REFERRED: the declaration recorded and the review it waits in. */
  declared: { identification: IdentificationView; review: string; openedAt: string } | null;
}

// ---------------------------------------------------------------- SCR-PTY-04

export interface ReviewRow {
  id: string;
  kind: ReviewKind;
  /** The records' names, which the subject joins: one for an identification, two for a duplicate candidacy. */
  names: readonly string[];
  records: readonly string[];
  openedAt: string;
  /** Whole days since the review was opened, a figure and never a colour band. */
  age: number;
}

export interface ReviewQueue {
  asOf: string;
  filter: { kind: ReviewKind | null; age: number | null };
  rows: readonly ReviewRow[];
  open: number;
}

// ---------------------------------------------------------------- SCR-PTY-05

export interface ReferenceClassView {
  key: ReferenceClass;
  count: number;
  /** The premises named, for premises relationships; the persons, for authorities. */
  names: readonly string[];
  /** The day every relationship ended, where all have. */
  endedOn: string | null;
  /** Since when, for change records. */
  since: string | null;
}

export interface CandidateRecord {
  record: string;
  legalName: string;
  businessRegistration: string | null;
  kind: PartyKind;
  state: PartyState;
  origin: PartyOrigin;
  principal: string | null;
  premises: { current: number; ended: { names: readonly string[]; on: string } | null };
  authorities: number;
  /** What a linkage that supersedes this record would have to dispose of. */
  references: readonly ReferenceClassView[];
}

export interface ReviewDetail {
  id: string;
  kind: ReviewKind;
  state: ReviewState;
  openedAt: string;
  age: number;
  /** DUPLICATE_CANDIDACY: the two records, A the one identified first. */
  candidates: readonly [CandidateRecord, CandidateRecord] | null;
  /** IDENTIFICATION: the party and its declaration. */
  identification: { record: string; legalName: string; businessRegistration: string | null; view: IdentificationView } | null;
  decision: {
    outcome: Exclude<ReviewState, "OPEN">;
    by: string;
    at: string;
    survivor: string | null;
    superseded: string | null;
    dispositions: readonly { key: ReferenceClass; count: number; to: "MOVE" | "STAY" }[];
  } | null;
  mayAct: boolean;
}

// ---------------------------------------------------------------- SCR-PTY-11 to 13

export interface AuthorityList {
  asOf: string;
  party: { record: string; legalName: string; principal: string | null };
  authorities: readonly AuthorityRow[];
}

export interface VersionView {
  number: number;
  from: string;
  to: string | null;
  acts: readonly Act[];
  role: "CURRENT" | "SUPERSEDED" | "LAST" | "NOT_STARTED" | "ENDED";
}

/** What a person did under an authority: the canvas's acts, and those the families record through `recordActUnderAuthority`. */
export type ActKind =
  | "UPLOADED_FLOOR_PLAN"
  | "OPENED_DECISION"
  | "UPLOADED_PHOTO"
  | "STARTED_APPLICATION"
  | "DECLARED_FACTS"
  | "SUBMITTED_APPLICATION"
  | "WITHDREW_APPLICATION"
  | "ISSUED_PAIRING";

export interface ActView {
  at: string;
  kind: ActKind;
  subject: string;
  version: { number: number; from: string; acts: readonly Act[] };
}

export interface PropagationPoint {
  point: "PORTAL_SESSIONS" | "API_TOKENS" | "PLAYER";
  stoppedAt: string | null;
  afterSeconds: number | null;
  /** The exception a point past the interval raised. */
  exception: { raisedAt: string; acknowledgedBy: string; acknowledgedAt: string } | null;
}

/** A phrase the canvas names by its code (a basis, a ground), or what the principal typed. */
export type Words = { code: string } | { text: string };

export interface AuthorityDetail {
  reference: string;
  party: { record: string; legalName: string };
  person: string;
  premises: { record: string | null; name: string } | null;
  acts: readonly Act[];
  from: string;
  to: string | null;
  state: AuthorityState;
  basis: Words | null;
  evidence: string | null;
  granted: { at: string; by: string } | null;
  versions: readonly VersionView[];
  performed: readonly ActView[];
  revocation: { at: string; by: string; ground: Words; propagation: readonly PropagationPoint[] | null } | null;
  /** An authority with no end date: the approval DR-202 recorded with it, by whom and at which level. */
  approval: { by: string; level: ApprovalLevel } | null;
  /** The principal signed in is the person who granted it ("By you"). */
  grantedByReader: boolean;
  revokedByReader: boolean;
  now: string;
}

export interface GrantForm {
  party: { record: string; legalName: string };
  premises: readonly { record: string; name: string }[];
  persons: readonly { reference: string; name: string }[];
  existing: readonly AuthorityRow[];
  /** CFG-240: the approval level an authority with no end date needs; null while the standard is not approved. */
  delegationStandard: { level: ApprovalLevel } | null;
  /** Who may approve an authority with no end date: the persons on the party's record, the principal included. */
  approvers: readonly { reference: string; name: string }[];
  today: string;
}

export interface AmendForm {
  authority: AuthorityDetail;
  existing: readonly AuthorityRow[];
  delegationStandard: { level: ApprovalLevel } | null;
  today: string;
}

// ---------------------------------------------------------------- inputs and attempts

export interface PartyInput {
  kind: string;
  legalName: string;
  businessRegistration: string;
}

export interface DeclarationInput {
  evidenceKind: string;
  evidenceRef: string;
  reason: string;
  scan: ChosenFile | null;
}

export interface DecisionInput {
  outcome: string;
  survivor: string;
  dispositions: Readonly<Partial<Record<ReferenceClass, string>>>;
}

export interface PersonInput {
  displayName: string;
  account: string;
}

export interface PrincipalInput {
  person: string;
  basis: string;
  evidence: string;
  acts: readonly string[];
  from: string | null;
  fromText: string;
  to: string | null;
  toText: string;
  /** DR-202: the approval an authority with no end date carries, by whom and at which level; empty where none is given. */
  approvalAuthority?: string;
  approvalLevel?: string;
}

export interface GrantInput {
  person: string;
  scope: string;
  premises: string;
  acts: readonly string[];
  basis: string;
  evidence: string;
  file: ChosenFile | null;
  from: string | null;
  fromText: string;
  to: string | null;
  toText: string;
  approvalAuthority?: string;
  approvalLevel?: string;
}

/** PATCH /party-persons/{id}: a new display name or a linked account; the reference typed is never applied. */
export interface PersonAmendInput {
  reference: string;
  displayName: string;
  account: string;
}

/** POST /duplicate-candidates. */
export interface CandidacyInput {
  subjectKind: string;
  left: string;
  right: string;
  ground: string;
}

export interface AmendInput {
  acts: readonly string[];
  from: string | null;
  fromText: string;
  to: string | null;
  toText: string;
}

export interface RevocationInput {
  effective: string;
  at: string;
  ground: string;
}

// ---------------------------------------------------------------- the party person (FR-PTY-019, 044)

/** GET /party-persons/{id}/resolution: three answers, the third not a refusal (IPartyReader.PersonExists). */
export type PersonResolution =
  | { kind: "CURRENT"; person: string }
  | { kind: "SUPERSEDED"; person: string; survivor: string; effectiveAt: string }
  | { kind: "NEVER_EXISTED"; person: string };

/** GET /party-persons/{id}: the person, the account linked, every authority they hold with its party, and the survivor. */
export interface PartyPersonView {
  reference: string;
  name: string;
  /** The account linked, by the address RightOne ID signs it in with; null where the register knows of none. */
  account: string | null;
  hasAccount: boolean;
  createdBy: string | null;
  createdAt: string | null;
  parties: readonly { record: string; legalName: string }[];
  authorities: readonly (AuthorityRow & { party: { record: string; legalName: string } })[];
  resolution: PersonResolution;
}

// ---------------------------------------------------------------- the change record (FR-PTY-018, 048)

export type ChangeSubjectKind = "PARTY" | "PARTY_PERSON" | "AUTHORITY" | "PREMISES";
export const CHANGE_SUBJECT_KINDS: readonly ChangeSubjectKind[] = ["PARTY", "PARTY_PERSON", "AUTHORITY", "PREMISES"];

/** One row of `party.change_records`: what changed, who or which process changed it, what it relied on, and when. */
export interface ChangeRecordRow {
  id: string;
  at: string;
  subject: { kind: ChangeSubjectKind; reference: string };
  change: string;
  values: Readonly<Record<string, string>>;
  actor: { kind: "PERSON"; name: string; person: string | null } | { kind: "PROCESS"; name: string };
  /** A premises actor's authority and its version; an operator's permission row; a sweep's rule (@AC-FR-PTY-048-04). */
  reliedOn: { kind: "AUTHORITY"; authority: string | null; version: number | null } | { kind: "PERMISSION"; row: string } | { kind: "RULE"; rule: string };
}

export interface ChangeRecordList {
  asOf: string;
  filter: { from: string; to: string; subjectKind: ChangeSubjectKind | null; subject: string | null };
  rows: readonly ChangeRecordRow[];
}

/** What a refused or completed form hands to the page it goes back to: the act, its answer and the values typed. */
export interface PartyAttempt {
  form: "create" | "search" | "declare" | "decide" | "person" | "principal" | "grant" | "amend" | "revoke" | "amendPerson" | "candidacy";
  /** The record the act was on: a party, a review or an authority. */
  subject: string;
  values: Readonly<Record<string, string | readonly string[]>>;
  refusal: { code: string; field: string | null; values: Readonly<Record<string, string>> } | null;
  /** What the act recorded, when it was accepted: a party, a person, an authority or a review's outcome. */
  done: string | null;
}

// ---------------------------------------------------------------- the reads

/** One screen's read, or the failure a reviewer asked for with the trace that screen's board prints. */
const read = <T,>(view: PartiesView | null, screen: keyof typeof PARTIES_TRACES, run: () => LoadOutcome<T>): Promise<LoadOutcome<T>> => {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockPartiesFailure(view, PARTIES_TRACES[screen]) : run());
};

/** SCR-PTY-01: GET /parties, by name, record or registration number, and state. */
export function loadPartyList(staff: Staff, filter: { q: string | null; state: string | null }, view: PartiesView | null): Promise<LoadOutcome<PartyList>> {
  return read(view, "01", () => partyList(staff, filter));
}

/** SCR-PTY-02: GET /parties/{id} with its premises, authorities and identification. */
export function loadPartyDetail(staff: Staff, record: string, view: PartiesView | null): Promise<LoadOutcome<PartyDetail>> {
  return read(view, "02", () => partyDetail(staff, record));
}

/** SCR-PTY-03: the party, how the source stands and the last search of it. */
export function loadIdentificationForm(staff: Staff, record: string, view: PartiesView | null): Promise<LoadOutcome<IdentificationForm>> {
  return read(view, "02", () => identificationForm(staff, record));
}

/** SCR-PTY-04: GET /identification-reviews, the open ones, oldest first. */
export function loadReviewQueue(staff: Staff, filter: { kind: string | null; age: string | null }, view: PartiesView | null): Promise<LoadOutcome<ReviewQueue>> {
  return read(view, "04", () => reviewQueue(staff, filter));
}

/** SCR-PTY-05: GET /identification-reviews/{id}. */
export function loadReviewDetail(staff: Staff, review: string, view: PartiesView | null): Promise<LoadOutcome<ReviewDetail>> {
  return read(view, "05", () => reviewDetail(staff, review));
}

/** SCR-PTY-11 for the principal: GET /authorities of the party they act for, or of the party they ask about. */
export function loadPartyAuthorities(principal: Principal, party: string | null, view: PartiesView | null): Promise<LoadOutcome<AuthorityList>> {
  return read(view, "11", () => partyAuthorities({ kind: "principal", sessionId: principal.sessionId, organisation: principal.organisation, account: principal.account }, party));
}

/** SCR-PTY-11 on the security console: one party's authorities, read only. */
export function loadSecurityAuthorities(staff: Staff, party: string, view: PartiesView | null): Promise<LoadOutcome<AuthorityList>> {
  return read(view, "11", () => partyAuthorities({ kind: "staff", staff }, party));
}

/** The security console's choice of party: those with an authority recorded. */
export function loadAuthorityParties(staff: Staff): Promise<LoadOutcome<readonly { record: string; legalName: string }[]>> {
  return read(null, "11", () => partiesWithAuthorities(staff));
}

/** SCR-PTY-13: GET /authorities/{id} with its versions, the acts performed under it and its revocation. */
export function loadAuthority(reader: { principal: Principal } | { staff: Staff }, reference: string, view: PartiesView | null): Promise<LoadOutcome<AuthorityDetail>> {
  const who =
    "principal" in reader
      ? ({ kind: "principal", sessionId: reader.principal.sessionId, organisation: reader.principal.organisation, account: reader.principal.account } as const)
      : ({ kind: "staff", staff: reader.staff } as const);
  return read(view, "13", () => authorityDetail(who, reference));
}

/** SCR-PTY-12 to grant: the party's premises and persons, and what it has granted. */
export function loadGrantForm(principal: Principal, view: PartiesView | null): Promise<LoadOutcome<GrantForm>> {
  return read(view, "12", () => grantForm(principal));
}

/** SCR-PTY-12 to amend: the authority and its current version. */
export function loadAmendForm(principal: Principal, reference: string, view: PartiesView | null): Promise<LoadOutcome<AmendForm>> {
  return read(view, "12", () => authorityAmendment(principal, reference));
}

// ---------------------------------------------------------------- the commands

const command = <T,>(run: () => PartyAnswer<T>): Promise<LoadOutcome<PartyAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/** POST /parties: a new party record in DRAFT. */
export function sendNewParty(staff: Staff, input: PartyInput): Promise<LoadOutcome<PartyAnswer<{ record: string }>>> {
  return command(() => createParty(staff, input));
}

/** POST /parties/{id}/identifications on the sourced route: a search of the source by an identifier it accepts. */
export function sendSourceSearch(staff: Staff, record: string, identifierKind: string): Promise<LoadOutcome<PartyAnswer<{ matched: boolean }>>> {
  return command(() => searchSource(staff, record, identifierKind));
}

/** POST /parties/{id}/identifications on the manual route: the declaration, standing at once or sent to review. */
export function sendDeclaration(staff: Staff, record: string, input: DeclarationInput): Promise<LoadOutcome<PartyAnswer<{ state: PartyState; review: string | null }>>> {
  return command(() => declareIdentification(staff, record, input));
}

/** POST /identification-reviews/{id}/decision. */
export function sendReviewDecision(staff: Staff, review: string, input: DecisionInput): Promise<LoadOutcome<PartyAnswer<{ outcome: ReviewState }>>> {
  return command(() => decideReview(staff, review, input));
}

/** POST /party-persons: a person of the register, for a party's record. */
export function sendPartyPerson(staff: Staff, record: string, input: PersonInput): Promise<LoadOutcome<PartyAnswer<{ person: string }>>> {
  return command(() => addPartyPerson(staff, record, input));
}

/** The principal recorded on the console: an authority to act for the whole party, granting and revoking included. */
export function sendPrincipal(staff: Staff, record: string, input: PrincipalInput): Promise<LoadOutcome<PartyAnswer<{ authority: string }>>> {
  return command(() => recordPrincipal(staff, record, input));
}

/** POST /authorities by the principal. */
export function sendGrant(principal: Principal, input: GrantInput): Promise<LoadOutcome<PartyAnswer<{ authority: string }>>> {
  return command(() => grantAuthorityCommand(principal, input));
}

/** POST /authorities/{id}/versions by the principal. */
export function sendAmendment(principal: Principal, reference: string, input: AmendInput): Promise<LoadOutcome<PartyAnswer<{ version: number }>>> {
  return command(() => amendAuthorityCommand(principal, reference, input));
}

/** POST /authorities/{id}/revocation by the principal. */
export function sendRevocation(principal: Principal, reference: string, input: RevocationInput): Promise<LoadOutcome<PartyAnswer<{ at: string }>>> {
  return command(() => revokeAuthorityCommand(principal, reference, input));
}

// ---------------------------------------------------------------- the party person and the change record

/** SCR-PTY-02's person panel: GET /party-persons/{id}, with its resolution. */
export function loadPartyPerson(staff: Staff, person: string): Promise<LoadOutcome<PartyPersonView>> {
  return read(null, "02", () => partyPerson(staff, person));
}

/** GET /party-persons/{id}/resolution: current, superseded with the survivor, or never existed. */
export function loadPersonResolution(staff: Staff, person: string): Promise<LoadOutcome<PersonResolution>> {
  return read(null, "02", () => personResolution(staff, person));
}

/** PATCH /party-persons/{id}: a new display name or a linked account, the reference unchanged. */
export function sendPersonAmendment(staff: Staff, person: string, input: PersonAmendInput): Promise<LoadOutcome<PartyAnswer<{ person: string }>>> {
  return command(() => amendPartyPerson(staff, person, input));
}

/** POST /duplicate-candidates: two records an officer thinks are one, and the review it opens. */
export function sendCandidacy(staff: Staff, input: CandidacyInput): Promise<LoadOutcome<PartyAnswer<{ review: string }>>> {
  return command(() => raiseCandidacy(staff, input));
}

/** GET /change-records for a period, by the kind of subject and the subject. */
export function loadChangeRecords(staff: Staff, asked: { from: string | null; to: string | null; subjectKind: string | null; subject: string | null }): Promise<LoadOutcome<ChangeRecordList>> {
  return read(null, "04", () => changeRecords(staff, asked));
}
