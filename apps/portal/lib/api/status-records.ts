import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import {
  assessIssue,
  consoleRecord,
  consoleRecordList,
  createRepresentation,
  decideIssue,
  decideReview,
  followUpList,
  followUpPage,
  getCertificate,
  getRepresentationDocument,
  holderPremises,
  issueApproval,
  premisesStatusRecords,
  proposalForm,
  proposeChange,
  recordHistory,
  registerKey,
  resolveFollowUp,
  retireKey,
  reviewList,
  reviewPage,
  revokeKey,
  signingKeys,
  type Actor,
} from "@/lib/mock/backend/status-records";
import {
  mockConsoleView,
  mockPremisesStatusRecords,
  mockStatusRecord,
  mockStatusRecordPrintout,
  type Cer11View,
  type Cer12View,
  type Cer13View,
  type ConsoleScreen,
  type ConsoleView,
} from "@/lib/mock/status-records";
import { NOT_CONFIGURED, usesMockData } from "./source";

/**
 * A console page's answer: NOT_CONFIGURED without mock data; with a review view that replaces the answer, the
 * board's failure; otherwise the live read. Views that change part of a live answer are applied by the caller.
 */
function consoleRead<T>(screen: ConsoleScreen, view: ConsoleView | null, live: () => LoadOutcome<T>, partial: readonly ConsoleView[] = []): Promise<LoadOutcome<T>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view !== null && !partial.includes(view)) return Promise.resolve(mockConsoleView(screen, view));
  return Promise.resolve(live());
}

/*
 * CER, the premises status record: the seam every page of the family reads through. The premises portal reads a
 * holder's records (SCR-CER-11 to 13); the operations console reads and acts on every record, review and
 * follow-up (SCR-CER-01 to 09); the security console manages the signing keys (SCR-CER-10). With mock data the
 * mock backend answers (`lib/mock/backend/status-records.ts`); otherwise every read and command is
 * SERVICE_NOT_CONFIGURED, never an empty answer.
 */

// ================================================================== the vocabulary

/** SM-03, the record's lifecycle. A status is shown as its word, never as this code (convention 7). */
export type RecordStatus =
  | "PENDING_ISSUE"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "SUSPENDED"
  | "REINSTATED"
  | "REVOKED"
  | "CANCELLED"
  | "REPLACED";

export const RECORD_STATUSES: readonly RecordStatus[] = [
  "PENDING_ISSUE",
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
  "SUSPENDED",
  "REINSTATED",
  "REVOKED",
  "CANCELLED",
  "REPLACED",
];

/** The issue conditions `DR-430` records, in its row order. */
export type IssueCondition =
  | "AUTHORITY_NOT_RIGHTONE"
  | "DEFINITION_NOT_APPROVED"
  | "DECISION_SUPERSEDED"
  | "PAYMENT_PENDING"
  | "PAYMENT_PART_PAID"
  | "PAYMENT_REVERSED"
  | "PAYMENT_IN_SUSPENSE_OR_DISPUTED"
  | "PROCESSING_NOT_PERMITTED"
  | "PERIOD_EXCEEDS_DECISION";

/** `DR-431`'s answer: issued straight through, or waiting for an approver and why. */
export type RouteReason = "STRAIGHT_THROUGH" | "HOLDER_CHANGED" | "CLAIM_PENDING" | "DECLARED_CLASSIFICATION";

/** The acts a status review proposes (`SM-03` transitions 3, 5 to 8, and no change). */
export type StatusAct = "NO_CHANGE" | "SUSPEND" | "REVOKE" | "CANCEL" | "REINSTATE";

/** The grounds of `CER-ENFORCEMENT` the boards draw. */
export type GroundCode = "GR-PAYMENT-REVERSED" | "GR-FALSE-FACT" | "GR-ISSUED-IN-ERROR";

/** A ground's reinstatement condition; `RC-SETTLED` is checkable against FIN. */
export type ConditionCode = "RC-SETTLED" | "RC-FACT-CORRECTED";

/** SM-400, a status review. */
export type ReviewState = "OPEN" | "PROPOSED" | "APPROVED" | "SUPERSEDED";

/** SM-401, a decision follow-up; OVERDUE is derived from the due instant. */
export type FollowUpState = "OPEN" | "OVERDUE" | "APPLIED" | "SUPERSEDED";

/** `DR-435`'s outcomes, named as the rule names them. */
export type FollowUpOutcome = "AMEND" | "REPLACE" | "END_AT_EFFECTIVE_DATE" | "NO_CHANGE_NEEDED";

/** SM-402, a signing key. */
export type KeyState = "ACTIVE" | "RETIRED" | "REVOKED";

/**
 * Words a person wrote. The canvas writes its sample reasons in both languages; a reason typed in the console is
 * kept as typed and read the same in either.
 */
export type Written = string | Readonly<Record<Locale, string>>;

export interface Period {
  from: string;
  to: string;
}

/**
 * The status record definition's four texts as the record copied them when it issued (`FR-CER-019`), and the
 * definition they came from: a later definition never rewrites them.
 */
export interface RecordDefinition {
  id: string;
  version: string;
  legalName: Written;
  legalNature: Written;
  legalEffect: Written;
  issuer: Written;
}

/**
 * The remedy a status change states (`DR-439`): an appeal through Cases by the closing date its ground's lodging
 * period gives, or, for a change that rests on no ground, a complaint through Cases with no closing date.
 */
export interface Remedy {
  kind: "APPEAL" | "COMPLAINT";
  route: "CAS";
  closesOn: string | null;
}

/** Who acted, as an approval pair shows them. */
export interface Person {
  name: string;
  position: string;
  at: string;
}

// ================================================================== SCR-CER-11 to 13, the premises portal

/** One status record of a premises, as SCR-CER-11 lists it. */
export interface StatusRecordSummary {
  reference: string;
  /** The record's premises when the list spans the party's premises; null in a list of one premises, which its title names. */
  premises: string | null;
  /** SM-03, as the holder's list reads it: an issued record (a pending record holds no reference and is not listed). */
  state: HolderState;
  /** The day the current state began; the list is ordered by it. */
  since: string;
  from: string;
  to: string;
  /** The day an obligation change amended this record, when one did. */
  followsChangeOn: string | null;
}

/**
 * A record of the premises still waiting to issue, as its holder reads it (`AC-FR-CER-001-02`). It holds no reference,
 * so it is addressed by the decision it waits under. `waitingOn` is every condition its latest assessment found unmet;
 * an approval wait or a decline is the staff's to read, not the holder's (`Q-CER-13`), so it is empty then.
 */
export interface PendingRecordSummary {
  key: string;
  /** The instant it was opened, when REG's decision was placed on no record. */
  since: string;
  from: string;
  to: string;
  waitingOn: readonly IssueCondition[];
}

export interface PremisesStatusRecords {
  /** Null when no premises is chosen; the page names the party instead. */
  premises: string | null;
  /** The premises as the portal's address names it, and its register record, which its page opens by; null with none chosen. */
  premisesId: string | null;
  register: string | null;
  party: string;
  /** When the list was read, for the meta line. */
  asOf: string;
  records: readonly StatusRecordSummary[];
  /** The premises' records waiting to issue, the latest opened first; a list that spans premises holds none. */
  pending: readonly PendingRecordSummary[];
  /** Where Xem thêm continues the list; null when every record is shown. */
  nextCursor: string | null;
}

/** A premises the signed-in person may list the records of (PTY's answer for `PERM-770`), as SCR-CER-11 offers it. */
export interface HolderPremises {
  /** The id the portal's address names it by. */
  id: string;
  name: string;
  /** Its register record, which the premises' page opens by. */
  register: string;
}

/** A status the holder can read: every SM-03 state an issued record takes. */
export type HolderState = "active" | "expiring" | "expired" | "suspended" | "reinstated" | "revoked" | "cancelled" | "replaced";

/**
 * SCR-CER-11 reads one premises' status records (GET /certificates with `premises_id`), or with `view` as the
 * canvas drew them. No premises named is PREMISES_FILTER_REQUIRED; a premises the person does not act for is
 * NOT_AUTHORISED_FOR_PREMISES; a refusal is a failure with its code, never an empty list. `pages` is how many
 * pages Xem thêm has opened: the list reads them in turn, each from the cursor the last returned.
 */
export function loadPremisesStatusRecords(
  principal: { sessionId: string; party: string },
  view: Exclude<Cer11View, "loading"> | null,
  premises: string | null = null,
  pages = 1,
): Promise<LoadOutcome<PremisesStatusRecords>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view !== null) return Promise.resolve(mockPremisesStatusRecords(view));
  let outcome = premisesStatusRecords(principal.sessionId, principal.party, premises, null);
  for (let page = 1; page < pages && outcome.data !== null && outcome.data.nextCursor !== null; page += 1) {
    const before = outcome.data;
    const next = premisesStatusRecords(principal.sessionId, principal.party, premises, before.nextCursor);
    if (next.data === null) return Promise.resolve(next);
    outcome = { data: { ...next.data, records: [...before.records, ...next.data.records], pending: before.pending }, failure: null };
  }
  return Promise.resolve(outcome);
}

/**
 * The premises SCR-CER-11 offers when its address names none: those PTY answers the signed-in person may list the
 * records of now, a delegate's within her delegation.
 */
export function loadHolderPremises(principal: { sessionId: string }): Promise<LoadOutcome<readonly HolderPremises[]>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: holderPremises(principal.sessionId), failure: null });
}

/** One printout of a record: the status it states is the status at the instant it was printed. */
export interface PrintoutSummary {
  reference: string;
  printedAt: string;
  /** Only a current record prints, so a printout states that it was in force. */
  stateWhenPrinted: "active";
  signingKey: string;
}

/**
 * Why a record no longer answers as in force, as the holder reads it (FR-CER-014, FR-CER-022): the ground's
 * wording, the officer's reason, the condition that reinstates it and until when it may be appealed.
 */
export interface Standing {
  kind: "suspended" | "revoked" | "cancelled";
  ground: GroundCode | null;
  reason: Written | null;
  condition: ConditionCode | null;
  /** The last day of the appeal; null where the change rests on no ground and the complaint has no closing date. */
  appealBy: string | null;
  /** The remedy the change states, with its route and closing date (`FR-CER-022`). */
  remedy: Remedy;
}

/** A status record as its holder reads it, SCR-CER-12. */
export interface StatusRecord {
  /** Null while it waits to issue: a pending record holds no reference yet. */
  reference: string | null;
  /** Its address on the portal: the reference, or the decision a pending record waits under. */
  key: string;
  premises: string;
  /** The premises as the portal names it, for the way back to its list; null for one the portal does not name. */
  premisesId: string | null;
  holder: string;
  state: HolderState | "pending";
  /** While pending, every issue condition the latest assessment found unmet, in `DR-430`'s order (`FR-CER-001`). */
  waitingOn: readonly IssueCondition[];
  /** The instant the current state began. */
  since: string;
  /** Whether the record answers as in force now: only a current record prints. */
  current: boolean;
  /** The period in force, under its decision. */
  period: { from: string; to: string; decision: string | null };
  earlierPeriods: readonly { from: string; to: string; decision: string | null }[];
  /** Set for a suspended, revoked or cancelled record; null otherwise. */
  standing: Standing | null;
  /** The premises' class as the register states it, where the canvas draws one. */
  premisesClass: "cafe" | "bar" | "restaurant" | "karaoke" | "hotel" | null;
  /** The latest first. */
  printouts: readonly PrintoutSummary[];
  /** What the record is, as copied from its definition when it issued. */
  definition: RecordDefinition | null;
}

/** The refusals of Print the page draws beside Print. */
export type PrintRefusal = "SIGNING_UNAVAILABLE" | "RECORD_NOT_CURRENT";

/**
 * What the page says beside Print, after the reader pressed it: a printout made, or the act refused with its
 * code. Null when the page answers no act.
 */
export type PrintAnswer = { outcome: "made"; printout: PrintoutSummary } | { outcome: "refused"; code: PrintRefusal };

/** What Print hands back to SCR-CER-12 when it is refused. */
export interface PrintAttempt {
  refusal: PrintRefusal;
}

export interface StatusRecordPage {
  record: StatusRecord;
  printAnswer: PrintAnswer | null;
  /** A printout link that led nowhere and brought the reader here instead, with its code. */
  printoutRefusal: "NOT_A_PRINTABLE_REPRESENTATION" | "REPRESENTATION_NOT_FOUND" | null;
}

/**
 * SCR-CER-12 reads one status record, as the principal's party holds it or, with `view`, as the canvas drew it. A
 * record that does not exist (CERTIFICATE_NOT_FOUND), one of another holder, or reference data that cannot be read
 * is a failure with its code, never another premises' record.
 */
export function loadStatusRecord(
  principal: { sessionId: string; party: string },
  record: string,
  view: Exclude<Cer12View, "loading"> | null,
): Promise<LoadOutcome<StatusRecordPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockStatusRecord(record, view) : getCertificate(principal.sessionId, principal.party, record));
}

/** The printed record, SCR-CER-13: what the sheet carries, copied at the instant it was printed. */
export interface StatusRecordPrintout {
  record: string;
  premises: string;
  /**
   * The premises' address as the record carries it, in each language the sheet is printed in; null where the
   * canvas draws no address for the premises, and the sheet then has no address line.
   */
  address: Readonly<Record<Locale, string>> | null;
  /** The operator, printed only for an organisation; a household business owner's name is never printed (SEC-436). */
  operator: string | null;
  period: { from: string; to: string };
  decision: string | null;
  premisesClass: StatusRecord["premisesClass"];
  stateWhenPrinted: "active";
  printedAt: string;
  printout: string;
  signingKey: string;
  /** The verification route the code opens, printed beside it. */
  verifyUrl: string;
  /**
   * The code's content (`ALG-407`): the verification route with the representation, its signed payload and the
   * signature, so a verifier holding the published key checks it without reaching RightOne.
   */
  code: string;
  /** What the record is, as copied when it issued: the sheet's title and issuer. */
  definition: RecordDefinition | null;
}

/**
 * SCR-CER-13 reads one printout of a record, the latest when none is named (the one Print just made), or, with
 * `view`, the sheet the canvas drew. A printout the reader may not open is REPRESENTATION_NOT_FOUND.
 */
export function loadStatusRecordPrintout(
  reader: { sessionId: string; party: string | null },
  record: string,
  view: Cer13View | null,
  printout: string | null = null,
): Promise<LoadOutcome<StatusRecordPrintout>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockStatusRecordPrintout(record, view) : getRepresentationDocument(reader.sessionId, reader.party, record, printout));
}

/**
 * Print the record (FR-CER-005, POST /certificates/{id}/representations): RightOne signs a printout of its current
 * status with the key that signs now and answers with the printout's reference. Refused RECORD_NOT_CURRENT for a
 * record not in force, SIGNING_UNAVAILABLE when no key signs, CERTIFICATE_NOT_FOUND for one the reader may not read.
 * The holder prints their own records (`party`); an operations officer prints any (`party` null).
 */
export function makeStatusRecordPrintout(reader: { sessionId: string; party: string | null }, record: string): Promise<LoadOutcome<{ printout: string; record: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(createRepresentation(reader.sessionId, reader.party, record));
}

// ================================================================== SCR-CER-01 Status records

/** What a record waits on before it issues, as the list's Waiting on cell says it. */
export type WaitingOn =
  | { kind: "condition"; condition: IssueCondition }
  | { kind: "approver"; reason: Exclude<RouteReason, "STRAIGHT_THROUGH"> }
  | { kind: "declined" };

export interface ConsoleRecordRow {
  /** The record's address in the console: its reference once issued, the decision it was opened under while pending. */
  key: string;
  reference: string | null;
  premises: { name: string; register: string | null };
  status: RecordStatus;
  since: string;
  period: Period | null;
  /** Null for a record whose latest assessment issued it. */
  waitingOn: WaitingOn | null;
  /** The latest assessment waits for an approver and nobody has decided on it: Approve is offered to the approver. */
  awaitsApprover: boolean;
}

export interface RecordFilter {
  status: RecordStatus | null;
  /** The premises' register record. */
  premises: string | null;
  waiting: boolean;
}

export interface ConsoleRecordList {
  asOf: string;
  filter: RecordFilter;
  premisesOptions: readonly { value: string; label: string; detail: string | null }[];
  rows: readonly ConsoleRecordRow[];
  /** Where the next page starts; null on the last page. */
  nextCursor: string | null;
  /** The rows before this page, for the pager's "1–25 of ...". */
  offset: number;
  total: number;
  /** The tabs' counts: reviews open or proposed, follow-ups open or overdue. */
  counts: { reviews: number; followUps: number };
}

/** The review states a console page can force for design review (`?view=`): an outage, a refusal, loading. */
export type { ConsoleView } from "@/lib/mock/status-records";

/**
 * SCR-CER-01 reads the records by status, premises and whether they wait, newest status change first, 25 a page
 * (GET /certificates). A cursor that no longer fits the filter is CURSOR_INVALID.
 */
export function loadConsoleRecords(sessionId: string, filter: RecordFilter, cursor: string | null, view: ConsoleView | null): Promise<LoadOutcome<ConsoleRecordList>> {
  return consoleRead("cer01", view, () => consoleRecordList(sessionId, filter, cursor));
}

// ================================================================== SCR-CER-02 Status record

/** The record's latest status change, as Last change states it. */
export type LastChange =
  | { kind: "opened"; decision: string; at: string }
  | { kind: "issued"; at: string; route: "STRAIGHT_THROUGH" | "APPROVED" | null }
  | {
      kind: "status";
      to: "SUSPENDED" | "REINSTATED" | "REVOKED" | "CANCELLED";
      effectiveAt: string;
      ground: GroundCode | null;
      condition: ConditionCode | null;
      reason: Written | null;
      evidence: readonly string[];
      appealBy: string | null;
      noticeRaised: boolean;
      review: string | null;
      proposer: Person | null;
      approver: Person | null;
      comment: Written | null;
      /** The version of `CER-ENFORCEMENT` the change relied on (`FR-CER-025`); null for a reinstatement. */
      policyVersion: string | null;
      remedy: Remedy;
      /** COM's reference for the holder's notice of the change. */
      notice: string | null;
    }
  | { kind: "replaced"; at: string; successor: string; holder: string; approver: string | null }
  | {
      /** A change no one decided, recorded at the instant it took effect (`DR-438`, `ALG-411`). */
      kind: "automatic";
      cause: AutomaticCause;
      to: RecordStatus;
      at: string;
      /** For an entry into the expiring state, the expiry notice it rests on; otherwise the holder's notice of it. */
      notice: string | null;
      /** The decision of the period that ended or came into force. */
      decision: string | null;
    };

/** Why a change no one decided was recorded: the expiry notice fell due, a period ended, a renewal or a period came into force. */
export type AutomaticCause = "EXPIRY_NOTICE_DUE" | "LAPSE" | "RENEWAL" | "PERIOD_IN_FORCE";

/** A pending record's latest assessment (`DR-430`, `DR-431`), or that of a renewal waiting on an issued record. */
export interface AssessmentView {
  /** What it assesses: the record's issue, or a renewal period of its holder (`DR-432` row 2). */
  kind: "ISSUE" | "RENEWAL";
  /** The decision assessed. */
  decision: string | null;
  at: string;
  trigger: "DECISION_RECORDED" | "PAYMENT_RECONCILED" | "OPERATOR_REQUEST" | "APPROVAL";
  unmet: readonly IssueCondition[];
  route: RouteReason | null;
  decided: { outcome: "APPROVE" | "DECLINE"; by: string; at: string } | null;
}

/** The record's open review, as the console's record page shows it (finding F-2). */
export interface OpenReview {
  reference: string;
  state: "OPEN" | "PROPOSED";
  trigger: ReviewTrigger;
  openedAt: string;
  proposal: Proposal | null;
}

export type ReviewTrigger =
  | { kind: "PAYMENT_REVERSAL"; event: string; at: string }
  | { kind: "CASE"; caseRef: string; letter: string | null; letterOn: string | null }
  | { kind: "OFFICER" };

export interface Proposal {
  act: StatusAct;
  statusWhenProposed: RecordStatus;
  ground: GroundCode | null;
  condition: ConditionCode | null;
  reason: Written;
  evidence: readonly string[];
  /** Null: when the approver decides. */
  effectiveAt: string | null;
  conditionsAddressed: readonly { condition: ConditionCode; howMet: string }[];
  proposer: Person;
  /** The version of `CER-ENFORCEMENT` in force when it was proposed; null where none was. */
  policyVersion: string | null;
}

export interface ConsoleRecord {
  key: string;
  /** When the record was read, for the meta line. */
  asOf: string;
  reference: string | null;
  status: RecordStatus;
  since: string;
  current: boolean;
  premises: { name: string; register: string | null; ward: string | null };
  holder: string;
  period: Period | null;
  decision: string | null;
  /** The decision's fee and how it stands; null where the decision owes nothing or the data draws no fee. */
  fee: { amountMinor: number; paid: { at: string; method: "card" | "transfer" | null } | null; payBy: string | null } | null;
  issued: { at: string; route: "STRAIGHT_THROUGH" | "APPROVED" | null } | null;
  predecessor: { reference: string; holder: string } | null;
  successor: { reference: string; holder: string } | null;
  openReview: OpenReview | null;
  lastChange: LastChange;
  assessment: AssessmentView | null;
  printouts: readonly (PrintoutSummary & { stillTheStatus: boolean })[];
  /** SM-03 permits a proposed act from the record's status. */
  proposable: boolean;
  /** What the record is, as copied from its definition when it issued; null while pending. */
  definition: RecordDefinition | null;
  /** A renewal of the holder's record waiting to add its period: its decision, period and latest assessment. */
  renewal: { decision: string; period: Period; openedAt: string; fee: ConsoleRecord["fee"]; assessment: AssessmentView | null } | null;
}

/** What an act on SCR-CER-02 hands back to it: Assess again or Print refused with its code, or Assess again done. */
export interface RecordAttempt {
  page: "record";
  record: string;
  assess: { refusal: string } | { issued: string | null } | null;
  print: { refusal: string } | null;
}

/** SCR-CER-02 reads one record for the console (GET /certificates/{id}): CERTIFICATE_NOT_FOUND for a key that names none. */
export function loadConsoleRecord(sessionId: string, key: string, view: ConsoleView | null): Promise<LoadOutcome<ConsoleRecord>> {
  return consoleRead("cer02", view, () => consoleRecord(sessionId, key));
}

/** Assess again (POST /certificates/{id}/issue-assessments): the new assessment, and the record issued where it may be. */
export function sendAssessment(sessionId: string, actor: Actor, key: string): Promise<LoadOutcome<{ issued: string | null }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(assessIssue(sessionId, actor, key));
}

// ================================================================== SCR-CER-03 Approve an issue

export interface IssueApproval {
  key: string;
  premises: { name: string; register: string | null; ward: string | null };
  holder: string;
  status: RecordStatus;
  /** The reference it was issued as, once an approval issued it. */
  reference: string | null;
  pendingSince: string;
  route: RouteReason | null;
  decision: string;
  fee: ConsoleRecord["fee"];
  period: Period | null;
  predecessor: { reference: string; key: string; holder: string } | null;
  assessment: AssessmentView | null;
  /** The latest issue decision, once an approver has answered the latest assessment. */
  decided: { outcome: "APPROVE" | "DECLINE"; by: string; at: string; evidence: readonly string[]; reason: Written | null } | null;
  /** Approve and Decline are offered: the latest assessment waits for an approver and nobody has decided on it. */
  awaitsApprover: boolean;
  /**
   * For a renewal (`DR-432` row 2), the issued record the approval adds the period to; null for an issue. The
   * decision, fee and period above are then the renewal's.
   */
  renewal: { record: string } | null;
}

export interface IssueAttempt {
  page: "approve";
  record: string;
  refusal: { code: string; unmet: readonly IssueCondition[] } | null;
  done: "approved" | "declined" | null;
  values: { evidence: readonly string[]; reason: string };
  /** For a renewal approved, the record its period was added to. */
  renewed?: string | null;
}

export function loadIssueApproval(sessionId: string, key: string, view: ConsoleView | null): Promise<LoadOutcome<IssueApproval>> {
  return consoleRead("cer03", view, () => issueApproval(sessionId, key));
}

/** Approve or decline an issue (POST /certificates/{id}/issue-decisions). */
export function sendIssueDecision(
  sessionId: string,
  actor: Actor,
  key: string,
  input: { decision: "APPROVE" | "DECLINE"; reason: string; evidence: readonly string[] },
): Promise<LoadOutcome<{ issued: string | null; renewed: Period | null }> & { unmet?: readonly IssueCondition[] }> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(decideIssue(sessionId, actor, key, input));
}

// ================================================================== SCR-CER-04 Status reviews

export interface ReviewRow {
  reference: string;
  record: { key: string; reference: string | null };
  premises: string;
  trigger: ReviewTrigger;
  state: ReviewState;
  openedAt: string;
  closedAt: string | null;
  /** The proposal waiting, or for a closed review the one decided. */
  proposal: Proposal | null;
  /** The approval that closed it. */
  approved: { by: string; at: string } | null;
}

export type ReviewFilter = "OPEN_PROPOSED" | "OPEN" | "PROPOSED" | "APPROVED" | "SUPERSEDED" | "ALL";

export interface ReviewList {
  asOf: string;
  filter: ReviewFilter;
  rows: readonly ReviewRow[];
  counts: ConsoleRecordList["counts"];
  /** Where the next page starts; null on the last page. */
  nextCursor: string | null;
  /** The rows before this page, for the pager. */
  offset: number;
  total: number;
}

/** SCR-CER-04 reads the reviews by state, the longest open first, 25 a page; a cursor of another filter is CURSOR_INVALID. */
export function loadReviews(sessionId: string, filter: ReviewFilter, view: ConsoleView | null, cursor: string | null = null): Promise<LoadOutcome<ReviewList>> {
  return consoleRead("cer04", view, () => reviewList(sessionId, filter, cursor));
}

// ================================================================== SCR-CER-05 Propose a status change

export interface PolicyInForce {
  code: "CER-ENFORCEMENT";
  version: string;
  effective: string;
  grounds: readonly { code: GroundCode; acts: readonly StatusAct[]; condition: ConditionCode | null }[];
}

export interface ProposalPage {
  record: {
    key: string;
    reference: string | null;
    status: RecordStatus;
    premises: string;
    period: Period | null;
    fee: ConsoleRecord["fee"];
    /** The premises register's closing date, where the register records one. */
    closing: { on: string; recordedAt: string } | null;
    successor: { reference: string; since: string } | null;
  };
  /** The review the proposal joins, or null: the proposal opens a review of its own. */
  review: { reference: string; state: ReviewState; trigger: ReviewTrigger; openedAt: string; proposal: Proposal | null } | null;
  /** The record's open review, which a new one may not join it beside (REVIEW_ALREADY_OPEN). */
  openReview: { reference: string; state: "OPEN" | "PROPOSED"; trigger: ReviewTrigger } | null;
  /** The acts SM-03 permits from the record's status, in the board's order. */
  acts: readonly StatusAct[];
  /** The policy in force, or null when none is: then only reinstatement and no change can be proposed. */
  policy: PolicyInForce | null;
  /** The policy could not be read: Propose is unavailable. */
  policyUnreadable: boolean;
  /** For a suspended record, the conditions its suspension states, each of which a reinstatement addresses. */
  conditions: readonly ConditionCode[];
}

/** The field a refusal of a proposal names, drawn below it. */
export type ProposalField = "act" | "ground" | "reason" | "evidence" | "effective" | "conditions";

export interface ProposalAttempt {
  page: "propose";
  record: string;
  review: string | null;
  refusal: { code: string; field: ProposalField | null; openReview: string | null } | null;
  /** The review the proposal was recorded on. */
  proposed: string | null;
  values: { act: StatusAct; ground: string; reason: string; evidence: string; effective: string; conditions: Readonly<Record<string, string>> };
}

export function loadProposalPage(sessionId: string, key: string, review: string | null, view: ConsoleView | null): Promise<LoadOutcome<ProposalPage>> {
  return consoleRead(
    "cer05",
    view,
    () => {
      const live = proposalForm(sessionId, key, review);
      if (live.data === null) return live;
      // With no policy in force only reinstatement and no change can be proposed; unreadable, nothing can.
      if (view === "no-policy") return { data: { ...live.data, policy: null, acts: live.data.acts.filter((act) => act === "NO_CHANGE" || act === "REINSTATE") }, failure: null };
      if (view === "policy-unavailable") return { data: { ...live.data, policy: null, policyUnreadable: true }, failure: null };
      return live;
    },
    ["no-policy", "policy-unavailable"],
  );
}

export interface ProposalInput {
  record: string;
  review: string | null;
  act: StatusAct;
  ground: string | null;
  reason: string;
  evidence: readonly string[];
  /** ISO 8601 with its offset, or null for "when the approver decides"; "invalid" when typed but not a time. */
  effectiveAt: string | null;
  conditions: readonly { condition: string; howMet: string }[];
}

/** Propose (POST /status-reviews, or /status-reviews/{id}/proposals on a review an event opened). */
export function sendProposal(sessionId: string, actor: Actor, input: ProposalInput): Promise<LoadOutcome<{ review: string }> & { field?: ProposalField; openReview?: string }> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(proposeChange(sessionId, actor, input));
}

// ================================================================== SCR-CER-06 Decide a status change

export interface ReviewPage {
  reference: string;
  state: ReviewState;
  record: { key: string; reference: string | null; status: RecordStatus; premises: string };
  trigger: ReviewTrigger;
  openedAt: string;
  /** The latest proposal, waiting or answered. */
  proposal: Proposal | null;
  /** What an approval of the proposal records, worked out now (`DR-40`, `DR-439`). */
  recorded: {
    status: "SUSPENDED" | "REINSTATED" | "REVOKED" | "CANCELLED" | null;
    takesEffect: string;
    condition: ConditionCode | null;
    appealBy: string | null;
    notice: boolean;
    /** The version of `CER-ENFORCEMENT` the approval relies on, or relied on once recorded (`FR-CER-025`). */
    policyVersion: string | null;
    remedy: Remedy;
  } | null;
  /** The decision on the latest proposal, once there is one. */
  decision: { outcome: "APPROVE" | "DECLINE"; by: Person; reason: Written | null } | null;
  /** The reader made the proposal waiting here. */
  readerProposed: boolean;
  /** The events that joined the review after it opened, each a trigger step (`DR-437` row 2). */
  joined: readonly (ReviewTrigger & { joinedAt: string })[];
}

export interface ReviewAttempt {
  page: "decide";
  review: string;
  refusal: string | null;
  done: "approved" | "declined" | null;
  values: { reason: string };
}

export function loadReviewPage(sessionId: string, actor: Actor, review: string, view: ConsoleView | null): Promise<LoadOutcome<ReviewPage>> {
  return consoleRead("cer06", view, () => reviewPage(sessionId, actor, review));
}

/** Approve or decline a proposal (POST /status-reviews/{id}/decisions). */
export function sendReviewDecision(
  sessionId: string,
  actor: Actor,
  review: string,
  input: { decision: "APPROVE" | "DECLINE"; reason: string },
): Promise<LoadOutcome<{ effectiveAt: string | null }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(decideReview(sessionId, actor, review, input));
}

// ================================================================== SCR-CER-07 and 08, re-decided obligations

export interface FollowUpRow {
  reference: string;
  /** How late it was applied, beyond the five minutes RightOne takes to apply one by itself (NFR-513); null when not. */
  lateMs: number | null;
  record: { key: string; reference: string | null };
  premises: { name: string; register: string | null };
  dueBy: string;
  state: FollowUpState;
  /** The rule's outcome for an open or overdue row, the recorded one for an applied row, none for a superseded one. */
  outcome: FollowUpOutcome | null;
  appliedAt: string | null;
}

export type FollowUpFilter = "ALL" | FollowUpState;

export interface FollowUpList {
  asOf: string;
  filter: FollowUpFilter;
  rows: readonly FollowUpRow[];
  counts: ConsoleRecordList["counts"];
  /** Where the next page starts; null on the last page. */
  nextCursor: string | null;
  offset: number;
  total: number;
}

/** SCR-CER-07 reads the follow-ups, overdue first then by due instant, 25 a page; a cursor of another filter is CURSOR_INVALID. */
export function loadFollowUps(sessionId: string, filter: FollowUpFilter, view: ConsoleView | null, cursor: string | null = null): Promise<LoadOutcome<FollowUpList>> {
  return consoleRead("cer07", view, () => followUpList(sessionId, filter, cursor));
}

export interface FollowUpPage {
  reference: string;
  state: FollowUpState;
  record: { key: string; reference: string | null; premises: string; register: string | null; holder: string };
  dueBy: string;
  /** Why RightOne did not apply it itself, when it could not. */
  notApplied: Written | null;
  decision: { reference: string | null; inForceFrom: string };
  superseded: string | null;
  change: Written | null;
  holderChanged: boolean;
  periodInForce: Period | null;
  /** `DR-435`'s outcome now, with the condition that is unmet when it ends the period. */
  rule: { outcome: FollowUpOutcome; unmet: IssueCondition | null; cutOn: string };
  applied: { outcome: FollowUpOutcome; at: string; by: string | null; reason: Written | null; inForceFrom: string; lateMs: number | null } | null;
  /** When RightOne raised to the certificate authority that the consequence was not recorded by its due instant (FR-CER-026). */
  exceptionRaisedAt: string | null;
}

export interface FollowUpAttempt {
  page: "resolve";
  followUp: string;
  refusal: { code: string; field: "outcome" | "reason" | null } | null;
  done: boolean;
  values: { outcome: string; reason: string };
}

export function loadFollowUpPage(sessionId: string, followUp: string, view: ConsoleView | null): Promise<LoadOutcome<FollowUpPage>> {
  return consoleRead("cer08", view, () => followUpPage(sessionId, followUp));
}

/** Resolve (POST /decision-follow-ups/{id}/resolutions). */
export function sendResolution(sessionId: string, actor: Actor, followUp: string, input: { outcome: string; reason: string }): Promise<LoadOutcome<{ inForceFrom: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(resolveFollowUp(sessionId, actor, followUp, input));
}

// ================================================================== SCR-CER-09 Record history

export type ChangeAuthority =
  /** Straight through: the rule `CER-ISSUE-ROUTE` at its default, and the decision that required the issue (`FR-CER-023`). */
  | { kind: "ROUTE"; straight: boolean; decision?: string | null }
  | { kind: "APPROVAL"; approver: string }
  | { kind: "REVIEW"; review: string; proposer: string; approver: string }
  | { kind: "SUCCESSOR"; successor: string }
  /** An entry into the expiring state: COM's expiry notice and its due instant, or the fallback of `DR-434` row 3. */
  | { kind: "NOTICE"; notice: string | null; dueAt: string | null; fallback: boolean }
  /** A lapse, a renewal or a period coming into force: the period's decision. */
  | { kind: "PERIOD"; decision: string | null };

export interface RecordHistory {
  key: string;
  reference: string | null;
  status: RecordStatus;
  since: string;
  premises: string;
  register: string | null;
  /** What last changed, for the page's line under the title. */
  latest: { kind: "amended"; decision: string | null; at: string } | { kind: "status"; status: RecordStatus; ground: GroundCode | null; at: string };
  /**
   * Every period in the order written, with the interval it governed. A renewal names the decision it renews and the
   * period before it (`follows`, `FR-CER-010`, `FR-CER-024`); every other period follows none.
   */
  periods: readonly {
    decision: string | null;
    from: string | null;
    to: string | null;
    cause: "ISSUE" | "AMENDMENT" | "RENEWAL" | "NO_CHANGE" | "END";
    follows: { decision: string | null; from: string; to: string } | null;
  }[];
  changes: readonly {
    from: RecordStatus;
    to: RecordStatus;
    effectiveAt: string;
    recordedAt: string;
    authority: ChangeAuthority;
    ground: GroundCode | null;
    evidence: readonly string[];
    condition: ConditionCode | null;
    /** The version of `CER-ENFORCEMENT` an enforcement relied on. */
    policyVersion: string | null;
  }[];
  followUps: readonly { reference: string; decision: string | null; dueBy: string; appliedAt: string | null; lateMs: number | null; outcome: FollowUpOutcome | null; why: Written | null }[];
}

export function loadRecordHistory(sessionId: string, key: string, view: ConsoleView | null): Promise<LoadOutcome<RecordHistory>> {
  return consoleRead("cer09", view, () => recordHistory(sessionId, key));
}

// ================================================================== SCR-CER-10 Signing keys

export interface SigningKeyRow {
  kid: string;
  state: KeyState;
  /** An active key whose start has come: the one a printout is signed with now. */
  signsNow: boolean;
  validFrom: string;
  retireBy: string;
  signed: number;
  revokedAt: string | null;
}

export interface SigningKeys {
  asOf: string;
  /** The Vietnam day of the read: the first a new key may start signing on. */
  today: string;
  keys: readonly SigningKeyRow[];
}

/** The field of Register a key a refusal names. */
export type KeyField = "kid" | "key_handle" | "public_key_jwk" | "valid_from";

export interface KeyAttempt {
  page: "keys";
  register: { refusal: { code: string; field: KeyField | null } | null; values: Readonly<Record<string, string>> } | null;
  row: { kid: string; code: string } | null;
  done: { kind: "registered"; kid: string; validFrom: string } | { kind: "retired"; kid: string } | { kind: "revoked"; kid: string; reprint: number } | null;
}

export function loadSigningKeys(sessionId: string, view: ConsoleView | null): Promise<LoadOutcome<SigningKeys>> {
  return consoleRead(
    "cer10",
    view,
    () => {
      const live = signingKeys(sessionId);
      return view === "empty" && live.data !== null ? { data: { ...live.data, keys: [] }, failure: null } : live;
    },
    ["empty", "signing-unavailable"],
  );
}

export function sendKeyRegistration(
  sessionId: string,
  actor: Actor,
  input: { kid: string; handle: string; jwk: string; validFrom: string | null },
): Promise<LoadOutcome<{ kid: string; validFrom: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(registerKey(sessionId, actor, input));
}

export function sendKeyRetirement(sessionId: string, actor: Actor, kid: string): Promise<LoadOutcome<{ kid: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(retireKey(sessionId, actor, kid));
}

export function sendKeyRevocation(sessionId: string, actor: Actor, kid: string, reason: string): Promise<LoadOutcome<{ kid: string; reprint: number }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(revokeKey(sessionId, actor, kid, reason));
}

export type { Actor };
