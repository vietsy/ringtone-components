import type { LoadOutcome } from "@rightone/ui";
import {
  approvals,
  caseFile,
  claimReview,
  evidenceRequestForm,
  proposalForm,
  recordClaimOutcome,
  recordCorrection,
  recordOfficerWithdrawal,
  recordProposal,
  recordVerdict,
  registrationPolicy,
  registrationReports,
  requestEvidence,
  reviewQueue,
  sendOfficerAmendment,
  startOfficerAmendment,
  useStartRecord,
  withdrawalForm,
} from "@/lib/mock/backend/registration";
import { mockReviewFailure, type REVIEW_STATES, type REVIEW_TYPES, type ReviewView } from "@/lib/mock/registration-review";
import type { ApplicationKind, ApplicationStatus, ClaimKind, ClaimState, CommandAnswer, DocumentItem, Period, PremisesOption, RightsLayer } from "./registration";
import type { Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The registration family (REG) on the operations console and the reporting surface: the review queue, the case
 * file and every act an officer takes on it, the approver's verdict, and the three reads of reporting and policy.
 * Each loader is one screen's read for the member of staff signed in; given a review view, it answers the
 * failure the board drew instead (design review). Every command is the API's, checked server side against the
 * member's roles, the record's state and the segregation of duties, and answers with the codes of
 * `design/04-refusal-codes.md`; a refused command records nothing.
 */

/*
 * The vocabularies are the contract's; they live beside the console's data so the backend reads them without
 * importing this seam back.
 */
export { REVIEW_STATES, REVIEW_TYPES } from "@/lib/mock/registration-review";
export type ReviewType = (typeof REVIEW_TYPES)[number];
export type ReviewState = (typeof REVIEW_STATES)[number];

export type Route = "AUTOMATED" | "MANUAL";

// ---------------------------------------------------------------- SCR-REG-09

export interface QueueRow {
  reference: string;
  premises: PremisesOption;
  /** Null on the automated route: RightOne decides it when the document asked at submission arrives. */
  reviewType: ReviewType | null;
  status: ReviewState;
  completeOn: string | null;
  expectedOn: string | null;
  /** Evidence is awaited, so the expected date is stated again when the answer arrives. */
  restatedOnAnswer: boolean;
  /** The expected date has passed undecided (EXC-REG-05). */
  pastExpected: boolean;
  /** The payment deadline, from the latest statement. */
  deadline: string | null;
  /** DR-41 rows 2 and 3: the decision is expected after the deadline and the applicant was told; or it had passed already. */
  risk: { kind: "TOLD"; toldOn: string } | { kind: "PASSED" } | null;
}

export interface QueueFilter {
  queue: ReviewType | null;
  status: ReviewState | null;
  premises: string | null;
}

export interface ReviewQueue {
  asOf: string;
  filter: QueueFilter;
  /** The page, the oldest completeness first. */
  rows: readonly QueueRow[];
  /** Every application that matches the filter, across the pages. */
  total: number;
  /** The rows before this page. */
  offset: number;
  /** The opaque cursor of the next page; null on the last. */
  nextCursor: string | null;
  /** Every premises with an application in review, for the Premises filter. */
  premisesOptions: readonly PremisesOption[];
}

// ---------------------------------------------------------------- SCR-REG-10

export type FactCode = "business_registration" | "premises_class" | "customer_area" | "days_open" | "music_method" | "use_began_on";
/** The FR-REG-007 label of a fact, as the console names it with R1's provenance chip. */
export type FactLabel = "registry-sourced" | "declared" | "evidenced" | "corrected" | "derived";
/** The BR-DAT-02 class FR-REG-033 keeps with the decision. */
export type ProvenanceClass = "authoritative" | "declared" | "derived";

/** One version of one fact. A correction is a new version; the version it corrects stays, never removed. */
export interface CaseFact {
  code: FactCode;
  /** The value as the record holds it: m² and days as numbers, a class or a way of playing music by its code, a date in ISO form. */
  value: string | number;
  version: number;
  label: FactLabel;
  cls: ProvenanceClass;
  /** False for a version kept as the earlier one. */
  current: boolean;
  /** A correction: the version it corrects, who corrected it, when, and the document it rests on. */
  correction: { corrects: number; by: string; on: string; document: EvidenceTitle | null } | null;
  /** An earlier version: the version that replaced it and when. */
  replaced: { by: number; on: string } | null;
  /** The document the declared value comes with (evidenced). */
  document: EvidenceTitle | null;
  /** The application a renewal or a change copied the value from. */
  copiedFrom: string | null;
  /** A registry value: the register's answer, which the data owner checks (FR-REG-033). */
  source: { at: string; version: number } | null;
}

/** A document's name: one the rules or a claim name, a reviewer's item as the officer described it, or the board's own words. */
export type EvidenceTitle = { document: DocumentItem } | { described: string } | { drawn: "PHOTOS" | "PIANIST" | "SCHEDULE" | "FLOOR_PLAN" };

export interface CaseEvidence {
  key: string;
  title: EvidenceTitle;
  /** What it answers: the requirement's code, a claim of a kind, or the n-th item of a reviewer's request. */
  answers: { requirement: string } | { claim: ClaimKind } | { requestItem: number };
  /** The moment it arrived, or only the day where the record gives no time. */
  receivedAt: string | null;
  receivedOn: string;
  file: { mediaType: string; sizeBytes: number };
  /** The last four characters of the document's SHA-256 digest. */
  digest: string;
}

export interface CaseClaim {
  id: string;
  kind: ClaimKind;
  layer: RightsLayer;
  period: Period;
  state: ClaimState;
  raisedAt: string | null;
  /** Once recorded on SCR-REG-12. */
  outcome: ClaimOutcome | null;
}

export interface ClaimOutcome {
  reason: string;
  scope: Period | null;
  recordedBy: string;
  recordedAt: string;
  /** Recorded with the legal authority, by name. */
  legal: string | null;
}

/** Who acted: a person by name where the record names one, or the role alone (the premises principal of another party, RightOne itself). */
export interface Actor {
  name: string | null;
  role: "PRINCIPAL" | "OFFICER" | "APPROVER" | "LEGAL" | "SYSTEM";
  /** A principal's party, as the attestation names it. */
  party: string | null;
}

export interface CaseAttestation {
  version: number;
  at: string;
  by: Actor;
  explanation: number;
  rulebook: string;
  superseded: boolean;
}

export type RequestState = "OPEN" | "ANSWERED" | "LAPSED" | "WITHDRAWN";

export interface CaseRequest {
  state: RequestState;
  /** RightOne, at submission, or the officer who asked. */
  by: Actor;
  at: string | null;
  dueOn: string;
  items: readonly { code: string; title: EvidenceTitle; receivedOn: string | null }[];
  /**
   * NTF-REG-02: sent, or not sent because COM issued no notice (EXC-REG-02), in which case the request does not lapse;
   * null for a request the sample data draws without its notice.
   */
  notice: "SENT" | "NOT_SENT" | null;
}

export interface CaseStatement {
  statedAt: string | null;
  completeOn: string | null;
  expectedOn: string | null;
  reviewType: ReviewType | null;
  periodDays: number;
  deadline: string;
  /** DR-41 row 2: when the applicant was told the decision would come after the deadline. */
  toldAt: string | null;
  /** Evidence is awaited: the statement is made again when the last item arrives. */
  restatedOnAnswer: boolean;
}

export type ProposedOutcome = "DECIDED_AS_APPLIED" | "DECIDED_OTHERWISE" | "REFUSED";
export type ProposalStatus = "PENDING_APPROVAL" | "APPROVED" | "RETURNED" | "ISSUED_WITHOUT_APPROVAL" | "CLOSED_BY_WITHDRAWAL";

/** A proposed decision on the application, with who prepared it and, once given, the approver's verdict. */
export interface CaseProposal {
  id: string;
  outcome: ProposedOutcome;
  status: ProposalStatus;
  /** A reason as the officer chose it: one the review triggers list (by its code), or a short code typed. */
  reason: string | null;
  text: string | null;
  unmet: readonly string[];
  actionOpen: string | null;
  preparedBy: { name: string; position: string };
  preparedAt: string;
  verdict: { by: string; position: string; at: string; note: string | null } | null;
  /** TAR's fee on the outcome; null on a refusal. */
  feeMinor: number | null;
  currency: string;
  tariffVersion: string | null;
}

export interface CaseTransition {
  at: string | null;
  from: ApplicationStatus | null;
  to: ApplicationStatus;
  cause: string;
  by: Actor;
}

/** How an application left the process without a decision: withdrawn as a draft, by the applicant, on its instruction, or closed for evidence not supplied. */
export type EndCause = "DRAFT_WITHDRAWN" | "APPLICANT_WITHDREW" | "WITHDRAWN_ON_INSTRUCTION" | "EVIDENCE_NOT_SUPPLIED";

/** The act controls of the case file: null when the act may be taken, otherwise the refusal code that holds it (convention 14). */
export interface CaseActs {
  requestEvidence: string | null;
  propose: string | null;
  withdraw: string | null;
  correct: string | null;
}

export interface CaseFile {
  reference: string;
  premises: PremisesOption;
  status: ApplicationStatus;
  kind: ApplicationKind;
  reviewType: ReviewType | null;
  route: Route | null;
  submittedAt: string | null;
  rulebook: string;
  /** Null where the sample data does not hold this part of the record; never an empty answer standing in for it. */
  facts: readonly CaseFact[] | null;
  evidence: readonly CaseEvidence[] | null;
  claims: readonly CaseClaim[];
  attestations: readonly CaseAttestation[] | null;
  requests: readonly CaseRequest[] | null;
  statements: readonly CaseStatement[];
  /** Why no statement is listed, where none is: decided at once on the automated route, or a draft not sent. */
  noStatement: "AUTOMATED" | "DRAFT" | null;
  proposals: readonly CaseProposal[];
  decision: {
    reference: string;
    status: "CURRENT" | "SUPERSEDED";
    outcome: "PAYABLE" | "NO_PAYABLE_OBLIGATION";
    asApplied: boolean;
    issuedAt: string;
    feeMinor: number;
    currency: string;
    period: Period;
  } | null;
  ended: {
    kind: "REFUSED" | "WITHDRAWN" | "CLOSED_INCOMPLETE";
    on: string;
    instruction: string | null;
    reason: string | null;
    /** The reason code it ended with: DR-287's for a withdrawal, the closure reason for one closed incomplete; none for a refusal, whose statement says why. */
    cause: EndCause | null;
  } | null;
  transitions: readonly CaseTransition[];
  acts: CaseActs;
  /** The applicant's first saved input, which starts the clock and never moves (`first_saved_at`, FR-REG-002, FR-REG-015). */
  firstSavedAt: string | null;
  /** An amendment: why it was started, the appeal case it follows, the decision it changes and who started it. */
  amendment: {
    cause: string;
    caseRef: string | null;
    decision: string;
    initiatedBy: "APPLICANT" | "OFFICER" | "SYSTEM";
    /** An officer's draft only: the refusal Send the amendment would meet now, or null when it can be sent. */
    sendHeld: string | null;
  } | null;
  /** Start an amendment (spine amendment A6-2): the decision it would change and that decision's end, while it is current. */
  amend: { decision: string; to: string; today: string } | null;
  /** The documents a correction may rest on. */
  correctionDocuments: readonly { key: string; title: EvidenceTitle; digest: string }[];
  /** The reader holds ACT-DAT and not ACT-OPS: the record is read only, with each registry fact's source. */
  dataOwner: boolean;
}

export interface CorrectionInput {
  code: string;
  value: string;
  document: string | null;
}

/** A correction refused beside its panel, as typed. */
export interface CorrectionAttempt {
  page: "case-file";
  application: string;
  values: { code: string; value: string; document: string };
  code: string;
}

/** Start an amendment as SCR-REG-10's panel sends it: the cause, the appeal case for an appeal outcome, the first day. */
export interface AmendmentInput {
  cause: string;
  caseRef: string;
  /** As typed; a date that cannot be read is null. */
  from: string | null;
}

/** An amendment start or send refused on the case file, as typed. */
export interface AmendmentAttempt {
  page: "amendment";
  /** Start is answered in its panel, Send in the header. */
  act: "start" | "send";
  application: string;
  values: { cause: string; caseRef: string; from: string };
  code: string;
  /** OPEN_APPLICATION_EXISTS: the amendment already in progress. */
  openApplication: string | null;
}

// ---------------------------------------------------------------- SCR-REG-11

export interface EvidenceRequestForm {
  reference: string;
  premises: PremisesOption;
  status: ApplicationStatus;
  reviewType: ReviewType | null;
  completeOn: string | null;
  expectedOn: string | null;
  /** The claim under review, which the request is about, when there is one. */
  claimUnderReview: { kind: ClaimKind; layer: RightsLayer } | null;
  /** The request date plus the REG-EVIDENCE-RESPONSE period. */
  dueOn: string;
  responseVersion: number;
  /** A refusal the request will meet in this state, said above the actions with the items kept. */
  blocked: string | null;
}

export interface EvidenceRequestItem {
  code: string;
  description: string;
}

export interface EvidenceRequestAttempt {
  page: "evidence-request";
  application: string;
  items: readonly EvidenceRequestItem[];
  code: string;
}

// ---------------------------------------------------------------- SCR-REG-12

export interface ClaimReviewView {
  reference: string;
  premises: PremisesOption;
  status: ApplicationStatus;
  reviewType: ReviewType | null;
  completeOn: string | null;
  /** The decision already issued, which an acceptance now amends. */
  decision: string | null;
  claim: CaseClaim;
  evidence: readonly CaseEvidence[];
  /** The reader is the legal authority (ACT-LGL), who records with the box ticked and fixed, and is confirmed in place. */
  legalReader: boolean;
  /** A refusal of the state the claim is in, said in the page header. */
  blocked: string | null;
}

export interface ClaimOutcomeInput {
  outcome: string;
  reason: string;
  scopeFrom: string | null;
  scopeTo: string | null;
  withLegal: boolean;
}

export interface ClaimOutcomeAttempt {
  page: "claim";
  application: string;
  claim: string;
  values: { outcome: string; reason: string; scopeFrom: string; scopeTo: string; withLegal: boolean };
  code: string;
}

// ---------------------------------------------------------------- SCR-REG-13

export interface ProposalForm {
  reference: string;
  premises: PremisesOption;
  status: ApplicationStatus;
  kind: ApplicationKind;
  reviewType: ReviewType | null;
  rulebook: string;
  /** The decision an amendment changes, and the registration date its Effective from may not precede. */
  amends: { decision: string; registeredOn: string } | null;
  /** TAR's fee on each outcome; null where no approved tariff answers it. */
  fees: { asApplied: number | null; otherwise: number | null; currency: string; tariffVersion: string };
  dates: { completeOn: string | null; expectedOn: string | null; deadline: string | null; toldOn: string | null };
  explanationVersion: number;
  blocked: string | null;
}

export interface ProposalInput {
  outcome: string;
  reason: string;
  text: string;
  unmet: readonly string[];
  actionOpen: string;
  effectiveFrom: string | null;
}

export interface ProposalAttempt {
  page: "proposal";
  application: string;
  values: { outcome: string; reason: string; text: string; unmet: readonly string[]; actionOpen: string; effectiveFrom: string };
  code: string;
  /** INTENDED_PERIOD_INVALID: the decision that governs a day of the period, named beside the message. */
  governingDecision: string | null;
}

// ---------------------------------------------------------------- SCR-REG-14

export interface AwaitingRow {
  proposal: string;
  reference: string;
  premises: PremisesOption;
  outcome: ProposedOutcome;
  preparedBy: string;
  preparedAt: string;
}

export interface ProposalDetail {
  proposal: CaseProposal;
  reference: string;
  premises: PremisesOption;
  applicationStatus: ApplicationStatus;
  explanationVersion: number;
  /** Opened from the list rather than a link. */
  fromList: boolean;
  /** SEC-286: the reader prepared it. */
  readerIsPreparer: boolean;
  /** The reader holds ACT-BIZ-APR and the adverse-decision authority. */
  readerMayDecide: boolean;
  /** What a withdrawal that closed it recorded. */
  withdrawal: { instruction: string } | null;
  /** The decision an approval issued. */
  issued: string | null;
}

export interface Approvals {
  asOf: string;
  awaiting: readonly AwaitingRow[];
  opened: LoadOutcome<ProposalDetail> | null;
}

export interface VerdictInput {
  verdict: string;
  note: string;
}

export interface VerdictAttempt {
  page: "verdict";
  proposal: string;
  note: string;
  code: string;
  governingDecision: string | null;
}

// ---------------------------------------------------------------- SCR-REG-15

export interface WithdrawalForm {
  reference: string;
  premises: PremisesOption;
  status: ApplicationStatus;
  reviewType: ReviewType | null;
  completeOn: string | null;
  expectedOn: string | null;
  /** An adverse proposal waiting for approval, which the withdrawal closes unissued. */
  pendingAdverse: { outcome: ProposedOutcome; since: string } | null;
  /** An open evidence request, which the withdrawal ends. */
  openRequest: boolean;
  blocked: string | null;
}

export interface WithdrawalInput {
  instruction: string;
  reason: string;
}

export interface WithdrawalAttempt {
  page: "withdrawal";
  application: string;
  values: WithdrawalInput;
  code: string;
}

// ---------------------------------------------------------------- SCR-REG-16 to 18

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface OverBaselineRow {
  reference: string;
  premises: string;
  seconds: number;
  excludedSeconds: number | null;
  step: string;
  /** The world holds this application, so its case file opens. */
  caseFile: boolean;
}

export interface RegistrationReports {
  period: ReportPeriod;
  asOf: string;
  completion: {
    /** Seconds a registration may take: CFG-26. */
    baselineSeconds: number;
    measured: number;
    /** Null while nothing is measured: UNAVAILABLE, never 0. */
    medianSeconds: number | null;
    p90Seconds: number | null;
    over: number | null;
    notYetMeasured: number;
    /** Facts declared because the register did not answer. */
    declaredFallback: number;
    rows: readonly OverBaselineRow[];
    /** The interim reading to the decision, while anything is not yet measured. */
    interim: { decided: number; medianSeconds: number; p90Seconds: number; over: number; rows: readonly OverBaselineRow[] } | null;
  };
  outcomes: {
    decided: number;
    refused: number;
    withdrawn: number;
    closed: number;
    withdrawnWithAdverse: number;
    /** The applications whose withdrawal closed an adverse proposal, where this world recorded it (RPT-REG-03). */
    withdrawnWithAdverseRefs: readonly string[];
  };
}

export type RuleCode =
  | "REG-OBLIGATION-RULEBOOK"
  | "REG-EXPLANATION"
  | "REG-REVIEW-PERIODS"
  | "REG-EVIDENCE-RESPONSE"
  | "REG-DECISION-RESERVATION"
  | "REG-AMNESTY-PERIOD"
  | "REG-PRE-REGISTRATION";

export interface PolicyRow {
  rule: RuleCode;
  /**
   * The version in force at the instant, or null where none is approved and the default applies. An amnesty version
   * carries its first and last day (FR-REG-021).
   */
  version: { id: string; from: string; amnesty?: { from: string; to: string } } | null;
  /** A version approved with a later start. */
  later: { id: string; from: string; amnesty?: { from: string; to: string } } | null;
  /** `default_in_force`: the configuration point whose tested default applies while no version is approved; null otherwise. */
  defaultInForce: string | null;
  /** The pre-registration entry only: the DR-22 row that applies at the instant (3 until DEC-13 approves a rule, then 4). */
  preRegistrationRow?: 3 | 4;
}

export interface RegistrationPolicy {
  asOf: string;
  rows: readonly PolicyRow[];
}

export interface UseStartRow {
  key: string;
  date: string;
  inForce: boolean;
  cls: ProvenanceClass;
  source: string;
  recordedOn: string;
  /** The date of the row this one corrects; null for an original row. */
  corrects: string | null;
}

export interface UseStartRecord {
  premises: PremisesOption | null;
  asOf: string;
  rows: readonly UseStartRow[];
  options: readonly PremisesOption[];
  /** Opened from a case file, which the page returns to. */
  application: string | null;
}

// ---------------------------------------------------------------- the loaders

const mock = <T,>(view: ReviewView | null, read: () => LoadOutcome<T>): Promise<LoadOutcome<T>> => {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockReviewFailure(view) : read());
};

/** SCR-REG-09: every application in review, filtered, a page at a time. */
export function loadReviewQueue(staff: Staff, filter: { queue: string | null; status: string | null; premises: string | null }, cursor: string | null, view: ReviewView | null): Promise<LoadOutcome<ReviewQueue>> {
  return mock(view, () => reviewQueue(staff, filter, cursor));
}

/** SCR-REG-10: the whole case file of one application, and which acts its state admits. */
export function loadCaseFile(staff: Staff, reference: string, view: ReviewView | null): Promise<LoadOutcome<CaseFile>> {
  return mock(view, () => caseFile(staff, reference));
}

/** SCR-REG-11: the application the request is about, and the due date sending it would set. */
export function loadEvidenceRequestForm(staff: Staff, reference: string, view: ReviewView | null): Promise<LoadOutcome<EvidenceRequestForm>> {
  return mock(view, () => evidenceRequestForm(staff, reference));
}

/** SCR-REG-12: one claim, its evidence, and whether its application is decided already. */
export function loadClaimReview(staff: Staff, reference: string, claim: string, view: ReviewView | null): Promise<LoadOutcome<ClaimReviewView>> {
  return mock(view, () => claimReview(staff, reference, claim));
}

/** SCR-REG-13: the application, the fee on each outcome, and its dates. */
export function loadProposalForm(staff: Staff, reference: string, view: ReviewView | null): Promise<LoadOutcome<ProposalForm>> {
  return mock(view, () => proposalForm(staff, reference));
}

/** SCR-REG-14: the proposals awaiting the reader's approval, and the one opened. */
export function loadApprovals(staff: Staff, proposal: string | null, view: ReviewView | null): Promise<LoadOutcome<Approvals>> {
  return mock(view, () => approvals(staff, proposal));
}

/** SCR-REG-15: the application and what a withdrawal on instruction closes. */
export function loadWithdrawalForm(staff: Staff, reference: string, view: ReviewView | null): Promise<LoadOutcome<WithdrawalForm>> {
  return mock(view, () => withdrawalForm(staff, reference));
}

/** SCR-REG-16: both registration reports for a period; `measure` is the API's, and one outside its two values is refused. */
export function loadRegistrationReports(staff: Staff, from: string | null, to: string | null, view: ReviewView | null, measure: string | null = null): Promise<LoadOutcome<RegistrationReports>> {
  return mock(view, () => registrationReports(staff, from, to, measure));
}

/** SCR-REG-17: each registration rule's version in force at an instant. */
export function loadRegistrationPolicy(staff: Staff, asOf: string | null, view: ReviewView | null): Promise<LoadOutcome<RegistrationPolicy>> {
  return mock(view, () => registrationPolicy(staff, asOf));
}

/** SCR-REG-18: a premises' use-start dates, by premises or by the application a case file opens it from. */
export function loadUseStartRecord(staff: Staff, premises: string | null, application: string | null, view: ReviewView | null): Promise<LoadOutcome<UseStartRecord>> {
  return mock(view, () => useStartRecord(staff, premises, application));
}

// ---------------------------------------------------------------- the commands

const command = <T,>(run: () => CommandAnswer<T>): Promise<LoadOutcome<CommandAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/** POST /applications/{id}/fact-declarations by an officer: a correction while the application is in review. */
export function sendCorrection(staff: Staff, reference: string, input: CorrectionInput): Promise<LoadOutcome<CommandAnswer<{ version: number }>>> {
  return command(() => recordCorrection(staff, reference, input));
}

/** POST /applications/{id}/evidence-requests: the items, with one due date. */
export function sendEvidenceRequest(staff: Staff, reference: string, items: readonly EvidenceRequestItem[]): Promise<LoadOutcome<CommandAnswer<{ dueOn: string }>>> {
  return command(() => requestEvidence(staff, reference, items));
}

/** POST /assertions/{id}/outcomes: the claim's outcome, and the amendment it starts once the decision is issued. */
export function sendClaimOutcome(staff: Staff, reference: string, claim: string, input: ClaimOutcomeInput): Promise<LoadOutcome<CommandAnswer<{ state: ClaimState; decision: string | null }>>> {
  return command(() => recordClaimOutcome(staff, reference, claim, input));
}

/** POST /applications/{id}/decision-proposals: sent for approval, or issued at once when as applied for. */
export function sendProposal(staff: Staff, reference: string, input: ProposalInput): Promise<LoadOutcome<CommandAnswer<{ proposal: string; decision: string | null }>>> {
  return command(() => recordProposal(staff, reference, input));
}

/** POST /decision-proposals/{id}/verdicts: approved, which issues it, or returned with the note. */
export function sendVerdict(staff: Staff, proposal: string, input: VerdictInput): Promise<LoadOutcome<CommandAnswer<{ status: ProposalStatus; decision: string | null }>>> {
  return command(() => recordVerdict(staff, proposal, input));
}

/** POST /applications/{id}/withdrawals by an officer, on the applicant's recorded instruction. */
export function sendOfficerWithdrawal(staff: Staff, reference: string, input: WithdrawalInput): Promise<LoadOutcome<CommandAnswer<{ status: ApplicationStatus }>>> {
  return command(() => recordOfficerWithdrawal(staff, reference, input));
}

/** POST /applications by an officer: an amendment of a decision for an appeal outcome or a reconciled classification. */
export function sendAmendmentStart(staff: Staff, decision: string, input: AmendmentInput): Promise<LoadOutcome<CommandAnswer<{ application: string }>>> {
  return command(() => startOfficerAmendment(staff, decision, input));
}

/** POST /applications/{id}/submissions by an officer: the amendment an officer started, sent to the amendment review. */
export function sendAmendment(staff: Staff, reference: string): Promise<LoadOutcome<CommandAnswer<{ status: ApplicationStatus }>>> {
  return command(() => sendOfficerAmendment(staff, reference));
}
