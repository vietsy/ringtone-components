import type { LoadOutcome } from "@rightone/ui";
import {
  addEvidence,
  addParty,
  addRegisterEntry,
  answerEvidenceRequest,
  appealForm,
  appealPage,
  approveIntakeVersion,
  approvePolicyItem,
  approvalsQueue,
  askReopening,
  authoriseReopening,
  callerIntakeForm,
  cancelEvidenceRequest,
  caseQueue,
  caseRead,
  casesRaisedBy,
  classifyCase,
  classifyProtected,
  closeCase,
  consoleCase,
  decisionPage,
  evidencePage,
  intakeForm,
  intakeMatrixPage,
  linkCase,
  linkRemedyArtefact,
  lodgeAppeal,
  policyRegister,
  prepareCategoryPolicy,
  preparePeriod,
  progressCase,
  proposeReopening,
  raiseCase,
  recheckLinkage,
  recordAppealOutcome,
  recordCallerCase,
  recordDecision,
  recordEvidenceResponse,
  referCase,
  remedyPage,
  reopeningPage,
  requestEvidence,
  saveDecisionDraft,
  saveIntakeVersion,
  supplyEvidence,
  withdrawCase,
  type CategoryPolicyInput,
  type ClassifyInput,
  type CloseInput,
  type OutcomeInput,
  type ReopeningInput,
} from "@/lib/mock/backend/cases";
import {
  mockCaseFailure,
  type Cas01View,
  type Cas02View,
  type Cas03View,
  type Cas08View,
  type CasesView,
  type ConsoleView,
} from "@/lib/mock/cases";
import type { StaffRole } from "@/lib/mock/backend/store";
import type { Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The case family's seam (CAS, `/api/v1/cases/`): SCR-CAS-01, 02 and 08 as the premises and the public read them,
 * and the case console (SCR-CAS-01 for the support line, 03, 04, 06, 07, 09, 10, 15, 16, 18) as the gateway's staff
 * do. Three of the reads need no account - the intake routes, a case by its reference, and its decision to appeal -
 * so a page there is answered for a signed-in principal or for nobody, and `CaseReader` says which. Every console
 * read and act takes the member of staff, whose roles and identity the backend checks itself.
 */

/** `SM-05`, the case lifecycle. */
export type CaseState =
  | "RECEIVED"
  | "TRIAGED"
  | "ASSIGNED"
  | "INVESTIGATING"
  | "AWAITING_EVIDENCE"
  | "SPECIALIST_ESCALATION"
  | "DECISION_PENDING"
  | "DECIDED"
  | "REMEDY_IN_PROGRESS"
  | "CLOSED"
  | "CLOSED_INADMISSIBLE"
  | "CLOSED_INCOMPLETE"
  | "REFERRED"
  | "WITHDRAWN";

/** `SM-40`, one request for evidence. */
export type EvidenceRequestState = "ISSUED" | "OVERDUE" | "RESPONDED" | "NOT_SUPPLIED" | "CANCELLED";
export type ReceiptOutcome = "supplied" | "supplied_in_part" | "refused" | "not_supplied_by_deadline";
/** The outcomes the answering party chooses from; the last one of `ReceiptOutcome` is the deadline's, not theirs. */
export const ANSWER_OUTCOMES = ["supplied", "supplied_in_part", "refused"] as const;
export type AnswerOutcome = (typeof ANSWER_OUTCOMES)[number];

/** `cases.intake_routes.route_kind`. */
export type RouteKind = "support_line" | "portal_form" | "email" | "post";
export const ROUTE_KINDS: readonly RouteKind[] = ["portal_form", "support_line", "email", "post"];

/** The remedy kinds a raiser may ask for and a decision may set (register `remedy_kind`). */
export type RemedyKind = "refund" | "correction" | "explanation";

/** The DR-47 inputs. */
export type Severity = "low" | "medium" | "high" | "critical";
export type BusinessImpact = "minor" | "material" | "major";
/** `cases.cases.raiser_vulnerability`: three answers, and `not_asked` is one of them. */
export type Vulnerability = "yes" | "no" | "not_asked";
export const VULNERABILITIES: readonly Vulnerability[] = ["yes", "no", "not_asked"];

export const LINK_KINDS = ["same_subject", "duplicate", "depends_on", "superseded_by"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export const PARTY_ROLES = ["raiser", "respondent", "affected", "representative"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];
export const DISCLOSURES = ["open", "confidential_to_case_team", "sealed"] as const;
export type DisclosureStatus = (typeof DISCLOSURES)[number];

/** `cases.remedy_links.artefact_kind`: what a remedy causes in its owning module. */
export type ArtefactKind = "recalculation" | "invoice" | "refund" | "status_change" | "correction" | "notice";

/** `SM-31`: an appeal, and a reopening. */
export type AppealState = "UNDER_APPEAL" | "APPEAL_DECIDED" | "APPEAL_LAPSED";
export const APPEAL_OUTCOMES = ["upheld", "varied", "set_aside"] as const;
export type AppealOutcome = (typeof APPEAL_OUTCOMES)[number];
export type ReopeningState = "REOPEN_PROPOSED" | "REOPENED" | "REOPEN_REFUSED";
export const GROUND_KINDS = ["new_evidence", "authorised_decision"] as const;
export type GroundKind = (typeof GROUND_KINDS)[number];

/** The two closures `POST /cases/{id}/close` admits, each from its own state (SM-05 transitions 4 and 9). */
export const DISPOSITIONS = ["inadmissible", "incomplete"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/** The five protected categories `CFG-50` expects (`cases.protected_matters.category`). */
export const PROTECTED_CATEGORIES = ["fraud", "privacy", "security", "corruption", "legal"] as const;
export type ProtectedCategory = (typeof PROTECTED_CATEGORIES)[number];

/** `SM-41`, a protected matter. */
export type ProtectedMatterState = "CLASSIFIED" | "ROUTED" | "UNDER_SPECIALIST" | "CONCLUDED" | "RECLASSIFIED";

/** The three period kinds of `cases.policy_periods` this module approves (CFG-48, CFG-49, CFG-51). */
export type PeriodKind = "appeal_decision" | "evidence_response" | "reopen_window";
/** The registers SCR-CAS-18 lists: five registers of entries and the three period kinds. */
export const POLICY_REGISTERS = [
  "pause_ground",
  "protected_category",
  "reopen_ground",
  "statutory_limit",
  "remedy_requirement",
  "appeal_decision",
  "evidence_response",
  "reopen_window",
] as const;
export type PolicyRegisterCode = (typeof POLICY_REGISTERS)[number];

export interface IntakeRoute {
  id: string;
  group: string;
  kind: RouteKind;
  requiresAccount: boolean;
  caseTypes: readonly string[];
}

/**
 * Who reads or acts on the public surface: the party a signed-in principal acts for, or nobody, on the routes
 * where the reference is the credential. `account` is the person's name, recorded on what they raise.
 */
export interface CaseReader {
  party: string | null;
  account: string | null;
}

/** A refusal as a console form keeps it: the code, the field each code falls on, and the values its sentence names. */
export interface Refusal {
  code: string;
  fields: Readonly<Record<string, string>>;
  detail: Readonly<Record<string, string>>;
}

export type CaseAnswer<T> = { accepted: T; refusal: null } | { accepted: null; refusal: Refusal };

/** What a console form hands back to its page when the act is refused: the refusal and every value as typed. */
export interface ConsoleAttempt {
  /** The form it came from, so a page with several forms draws the refusal beside the right one. */
  form: string;
  /** The case, appeal, version or register the form acted on. */
  subject: string;
  refusal: Refusal;
  values: Readonly<Record<string, string | readonly string[]>>;
}

// ---------------------------------------------------------------- SCR-CAS-01

export type IntakeField = "matter" | "period" | "remedy" | "contact";

/** The form's values as typed: dates as R1's date field sends them, so a refused value comes back as entered. */
export interface IntakeValues {
  group: string;
  matter: string;
  subject: string;
  periodFrom: string;
  periodTo: string;
  remedy: string;
  contact: string;
}

export interface IntakeForm {
  today: string;
  /** The matrix version in force today, which every route below belongs to. */
  version: number;
  /** The groups that version lists, in the register's order. */
  groups: readonly string[];
  /** The group the form is for: the reader's choice, or the account's own. */
  group: string;
  /** Signed in to the account the group's account route takes. */
  signedIn: boolean;
  /** Every route the group has, the support line among them. */
  routes: readonly IntakeRoute[];
  /** The web form this reader can send on for the group; null when that form needs an account they are not signed in with. */
  formRoute: IntakeRoute | null;
  /** The remedy kinds the form route's case types admit. */
  remedies: readonly RemedyKind[];
  supportLine: string;
  values: IntakeValues;
  /** A refusal of the whole intake, said in the page header: GROUP_NOT_IN_MATRIX or MATRIX_VERSION_NOT_APPROVED. */
  refusal: string | null;
  /** A refusal of one field, by field: FIELD_MISSING, PERIOD_INVALID, REMEDY_KIND_UNKNOWN. */
  fieldErrors: Partial<Record<IntakeField, string>>;
}

/** What Raise the case hands back to SCR-CAS-01 when the case is refused. */
export interface IntakeAttempt {
  page: "raise";
  values: IntakeValues;
  refusal: string | null;
  fieldErrors: Partial<Record<IntakeField, string>>;
}

/** What Record the case hands back to the support-line agent's SCR-CAS-01: the reference to read to the caller. */
export interface CallerCaseRecorded {
  page: "recorded";
  reference: string;
  /** Where the acknowledgement went: the contact the caller gave, never only the agent's screen. */
  contact: string;
  notice: string | null;
}

/** POST /cases, as the form sends it: the period already read as ISO dates, or the text that is not one. */
export interface IntakeInput {
  group: string;
  routeId: string;
  matter: string;
  subject: string;
  period: { from: string | null; to: string | null; unreadable: boolean };
  remedy: string;
  contact: string;
}

// ---------------------------------------------------------------- SCR-CAS-02 and 08

export interface EvidenceRequest {
  id: string;
  item: string;
  deadline: string;
  state: EvidenceRequestState;
  receiptOutcome: ReceiptOutcome | null;
  /** The status what is supplied will carry, shown to the party before they supply it. */
  disclosure: DisclosureStatus;
  /** Addressed to the reader, and still open: they may answer it here. */
  answerable: boolean;
  /** The day it was cancelled, for the sentence that says so. */
  cancelledOn: string | null;
  /** Answered after its deadline: a late answer is an answer, and the lateness is recorded on it (SM-40 transition 3). */
  late: boolean;
}

/**
 * An item held against the case as the raiser reads it (`cases.case_evidence`): its existence always, its content
 * only where its disclosure status lets the reader see it (AC-FR-CAS-006-02).
 */
export interface EvidenceHeld {
  /** What the item is; null where it is withheld from the reader, whose page then says why. */
  item: string | null;
  disclosure: DisclosureStatus;
  receivedAt: string;
  /** Supplied by the reader's own party, or by them on the route that needs no account. */
  own: boolean;
}

/** The seven elements FR-CAS-007 requires of a decision, as issued to the raiser. */
export interface CaseDecision {
  facts: string;
  authority: string;
  reasoning: string;
  remedy: RemedyKind;
  effectiveDate: string;
  decisionMaker: string;
  appealRoute: string;
  appealDeadline: string | null;
  issuedAt: string;
}

/** An appeal as the appellant reads it: when it was received, when it is answered, and its outcome once decided. */
export interface AppealSummary {
  reference: string;
  receivedAt: string;
  /**
   * The date the outcome is due by; null where no appeal period was approved for the case type when the decision
   * was issued, so nothing measured it (AC-FR-CAS-021-03) and `measurement` says why.
   */
  dueAt: string | null;
  /** PERIOD_VERSION_NOT_APPROVED where the appeal could not be measured; null where it was. */
  measurement: "PERIOD_VERSION_NOT_APPROVED" | null;
  late: boolean;
  state: AppealState;
  outcome: {
    outcome: AppealOutcome;
    facts: string;
    authority: string;
    reasoning: string;
    remedy: RemedyKind | null;
    effectiveDate: string | null;
    furtherRoute: string;
    decidedAt: string;
    /** Decided on or before the due date (AC-FR-CAS-014-03); null where the appeal had no due date. */
    inTime: boolean | null;
  } | null;
}

/** A reopening as the party reads it: the one last proposed on the case and what became of it. */
export interface ReopeningSummary {
  state: ReopeningState;
  proposedAt: string;
  decidedAt: string | null;
  /** The reason an authority refused it, which the refusal must carry (SM-31 transition 7). */
  refusedReason: string | null;
}

export interface CaseSummary {
  reference: string;
  submittedAt: string;
  state: CaseState;
  /** The record the case is about, in the raiser's words; null when they named none. */
  subject: string | null;
  /** The date the next step names: classification while RECEIVED, the target once one is set. */
  nextBy: string | null;
  /** When the case entered its state: the day it was withdrawn, decided, closed. */
  stateSince: string;
}

export interface CaseView extends CaseSummary {
  /** Who acts next: the case team until an owner is recorded. */
  owner: string | null;
  evidenceRequests: readonly EvidenceRequest[];
  decision: CaseDecision | null;
  appeal: AppealSummary | null;
  /** The day an authorised reopening took the case back to investigation, its earlier decision kept. */
  reopenedOn: string | null;
  /** The reopening last proposed on the case, by anyone, and what became of it. */
  reopening: ReopeningSummary | null;
  /** What the case team holds against the case, each item as this reader may see it. */
  evidence: readonly EvidenceHeld[];
  /** The process a referral sent the matter to, which the raiser is told (SM-05 transition 3); null unless REFERRED. */
  referral: { process: string; at: string } | null;
  /**
   * How the case was closed without a decision, with the route the matter should take instead on an inadmissible
   * one, and the last day it may be asked to reopen: neither closure is an ending (BR-CAS-09).
   */
  closure: { disposition: Disposition; reason: string; route: string | null; windowEnds: string | null } | null;
  /** Raised from the reader's own account: one of their cases, read in their portal. */
  own: boolean;
  /** SM-05 transition 16: the raiser may withdraw while the case is RECEIVED, TRIAGED or ASSIGNED. */
  canWithdraw: boolean;
  /** A decision exists and nobody has appealed it yet (PERM-87, AC-FR-CAS-008-06). */
  canAppeal: boolean;
  /** The raiser may add an item to their own case (POST /cases/{id}/evidence). */
  canAddEvidence: boolean;
  /** The case is closed, the window is open and nothing is waiting: the raiser may ask for a reopening on SCR-CAS-08. */
  canReopen: boolean;
  supportLine: string;
}

/** What a refused act hands back to SCR-CAS-02. */
export interface CaseAttempt {
  page: "case";
  reference: string;
  refusal:
    | "CASE_ALREADY_DECIDED"
    | "ROLE_OUT_OF_SCOPE"
    | "TRANSITION_NOT_PERMITTED"
    | "REQUEST_CANCELLED"
    | "RECEIPT_OUTCOME_REQUIRED"
    | "FIELD_MISSING"
    | "DISCLOSURE_STATUS_REQUIRED";
  /** The request an answer was refused on, or `evidence` for an item the raiser added; and what was typed. */
  request?: string;
  values?: Readonly<Record<string, string>>;
}

export type CommandAnswer<T> = { accepted: T; refusal: null } | { accepted: null; refusal: { code: string; fieldErrors: Partial<Record<IntakeField, string>> } };

/** SCR-CAS-08: the decision under appeal, the deadline beside today, and the appeal already lodged, if one is. */
export interface AppealForm {
  reference: string;
  today: string;
  decision: CaseDecision | null;
  /** The appeal open on the decision: APPEAL_ALREADY_LODGED, said in the page header. */
  open: AppealSummary | null;
  /** The appeal on the decision already decided: a decision is challenged once, and its outcome names the next route. */
  decided: AppealSummary | null;
  /**
   * SCR-CAS-08's reopening block, where the appeal route is no longer the reader's - the decision was challenged
   * already, or the case was closed without one - and the case is closed: the outcomes a displacement may name, the
   * last day of the CFG-51 window, and the proposal already waiting, if one is. Null where the block is not shown.
   */
  reopen: { outcomes: readonly RemedyKind[]; windowEnds: string | null; waiting: ReopeningSummary | null } | null;
  supportLine: string;
  contact: string;
}

// ---------------------------------------------------------------- the case console

/** A member of staff, as a console row names them. */
export interface StaffName {
  name: string;
  email: string;
}

/** SCR-CAS-03: one row of the queue. */
export interface QueueRow {
  reference: string;
  caseType: string | null;
  state: CaseState;
  submittedAt: string;
  /** The target in force, or the classification date while the case is not classified. */
  due: string | null;
  /** Whole days past the due date; null when it is not passed. */
  overdueDays: number | null;
  owner: StaffName | null;
  priority: number | null;
}

export interface QueueFilter {
  state: CaseState | null;
  caseType: string | null;
  owner: string | null;
}

export interface CaseQueue {
  asOf: string;
  rows: readonly QueueRow[];
  /** Every case the filter admits, of which `rows` is a page. */
  total: number;
  offset: number;
  nextCursor: string | null;
  filter: QueueFilter;
  owners: readonly StaffName[];
  /** The states a case in scope is in, for the state filter. */
  states: readonly CaseState[];
}

/** DR-47's answer, and the inputs it read, kept so a reader months later sees both. */
export interface Derivation {
  priority: number;
  targetOn: string;
  objectiveVersion: string;
  statutoryLimit: { on: string; instrument: string } | null;
  reason: "STATUTORY_LIMIT_APPLIES" | "VULNERABILITY_RAISED" | "DERIVED_FROM_OBJECTIVES";
  severity: Severity;
  impact: BusinessImpact;
  vulnerability: Vulnerability;
  derivedAt: string;
}

export interface ConsoleCaseView {
  asOf: string;
  today: string;
  reference: string;
  state: CaseState;
  stateSince: string;
  submittedAt: string;
  group: string;
  /** Raised from an account, by the party named; null on the route that needs no account. */
  raiser: { party: string | null; name: string | null; account: string | null };
  /** The support-line agent who recorded the case for a caller, where one did (both identities are stored). */
  agent: StaffName | null;
  /** The intake route the case arrived on and the matrix version it belongs to (AC-FR-CAS-018-02); null where a module opened it. */
  route: { versionNo: number; kind: RouteKind } | null;
  contact: string;
  matter: string;
  caseType: string | null;
  subjectKind: string | null;
  subjectRef: string | null;
  period: { from: string | null; to: string | null };
  requestedRemedy: RemedyKind | null;
  owner: StaffName | null;
  severity: Severity | null;
  impact: BusinessImpact | null;
  vulnerability: Vulnerability | null;
  derivation: Derivation | null;
  /** The statutory limit each case type carries, shown before classification with its instrument. */
  statutoryLimits: Readonly<Record<string, { days: number; instrument: string }>>;
  links: readonly { reference: string; kind: LinkKind; state: CaseState }[];
  parties: readonly { party: string; name: string; role: PartyRole }[];
  history: readonly { from: CaseState | null; to: CaseState; at: string; reason: string | null }[];
  notices: readonly { reference: string; kind: string; at: string }[];
  evidence: { open: number; total: number };
  decision: { issuedAt: string; remedy: RemedyKind; maker: StaffName } | null;
  appeal: { reference: string; state: AppealState; dueAt: string | null } | null;
  reopening: { reference: string; state: ReopeningState } | null;
  /** Where a referral sent the matter (SM-05 transition 3), with the reason. */
  referral: { process: string; reason: string; at: string } | null;
  /** How the case was closed without a decision (SM-05 transitions 4 and 9), and who approved an incomplete closure. */
  closure: {
    disposition: Disposition;
    reason: string;
    route: string | null;
    unestablished: string | null;
    approver: StaffName | null;
    at: string;
  } | null;
  /** The protected matter the case is restricted under, read by someone on its access list; null where it is not one. */
  protection: { category: ProtectedCategory; state: ProtectedMatterState; since: string; process: string } | null;
  options: {
    caseTypes: readonly string[];
    remediesByType: Readonly<Record<string, readonly RemedyKind[]>>;
    subjectKinds: readonly string[];
    owners: readonly StaffName[];
    parties: readonly { id: string; name: string }[];
    /** The case officers who may approve an incomplete closure: every ACT-CAS but the owner and the reader. */
    closeApprovers: readonly StaffName[];
    /** The protected categories with an approved policy in force today, the only ones a case may be classified into. */
    categories: readonly ProtectedCategory[];
    /** The staff a protected matter may name as its subjects. */
    staff: readonly StaffName[];
  };
}

export interface EvidenceRow {
  id: string;
  item: string;
  party: string;
  deadline: string;
  disclosure: DisclosureStatus;
  state: EvidenceRequestState;
  receiptOutcome: ReceiptOutcome | null;
  issuedAt: string;
  issuedBy: string;
  /** What arrived, as the party described it; null until something did. Confidential to the case team. */
  supplied: string | null;
  respondedAt: string | null;
  /** Answered after the deadline, recorded late. */
  late: boolean;
  /** Who recorded the answer: the party on SCR-CAS-02, or a case officer for one that arrived another way. */
  recordedBy: string | null;
  cancelled: { on: string; reason: string } | null;
  /** The reader may cancel it: the officer who issued it, or the case owner. */
  mayCancel: boolean;
}

/** One item held against the case (`cases.case_evidence`), as the case team reads it. */
export interface EvidenceItemRow {
  item: string;
  disclosure: DisclosureStatus;
  receivedAt: string;
  /** Who supplied it: the party's name, the raiser's contact, or the officer who added it. */
  suppliedBy: string;
  /** Arrived against a request, or added on its own (POST /cases/{id}/evidence). */
  via: "request" | "added";
}

export interface EvidencePage {
  reference: string;
  state: CaseState;
  caseType: string | null;
  today: string;
  rows: readonly EvidenceRow[];
  /** Every item held against the case, whatever brought it. */
  held: readonly EvidenceItemRow[];
  /** Who a request may be addressed to: the parties on the case, and the raiser's contact where they hold no account. */
  addressees: readonly { value: string; label: string }[];
  /** Who an item added here may be recorded as supplied by: the same parties and contact. */
  suppliers: readonly { value: string; label: string }[];
  /** The CFG-49 period for this case type: the last day a request sent today may give, and how many working days. */
  policy: { workingDays: number; latest: string } | null;
}

export interface DecisionValues {
  facts: string;
  authority: string;
  reasoning: string;
  remedy: string;
  effective: string;
  appealRoute: string;
  ground: string;
}

export interface DecisionPage {
  reference: string;
  state: CaseState;
  caseType: string | null;
  today: string;
  matter: string;
  requestedRemedy: RemedyKind | null;
  owner: StaffName | null;
  raiserLabel: string;
  remedies: readonly RemedyKind[];
  grounds: readonly string[];
  evidence: readonly { item: string; state: EvidenceRequestState; receiptOutcome: ReceiptOutcome | null }[];
  /** The deadline the party will be given if the decision is issued today, from the CFG-48 period in force. */
  appealDeadline: string | null;
  draft: { values: DecisionValues; savedAt: string; by: string } | null;
  /** The decision once issued, with everything it recorded. */
  issued: (CaseDecision & { governingGround: string; maker: StaffName }) | null;
  /** The remedy in force has a financial effect, so its artefacts are linked on SCR-CAS-10. */
  financial: boolean;
}

export interface RemedyRow {
  kind: ArtefactKind;
  link: { reference: string; namesCase: boolean; linkedAt: string; linkedBy: string; checkedAt: string } | null;
}

export interface RemedyPage {
  reference: string;
  state: CaseState;
  remedy: RemedyKind | null;
  /** The appeal outcome whose remedy is in force, where one set it. */
  fromAppeal: string | null;
  rows: readonly RemedyRow[];
  linkage: { complete: true; closedOn: string | null } | { complete: false; missing: readonly ArtefactKind[]; absent: readonly string[] };
  /** Which artefact kinds the reader may link: financial ones with ACT-FIN-OP, a correction or a notice with ACT-CAS. */
  mayLink: readonly ArtefactKind[];
}

export interface AppealListRow {
  reference: string;
  caseReference: string;
  receivedAt: string;
  dueAt: string | null;
  late: boolean;
  state: AppealState;
}

export interface ReopeningListRow {
  reference: string;
  caseReference: string;
  groundKind: GroundKind;
  proposedAt: string;
  proposedBy: string;
  /** Proposed by a case officer, or by the raiser on their own case. */
  proposer: "officer" | "raiser";
  state: ReopeningState;
}

export interface ApprovalsQueue {
  asOf: string;
  appeals: readonly AppealListRow[];
  reopenings: readonly ReopeningListRow[];
}

/** SCR-CAS-09: the ALG-23 answer comes first, and the file only with an eligible answer. */
export type AppealPage =
  | {
      reference: string;
      caseReference: string;
      receivedAt: string;
      dueAt: string | null;
      period: { amount: number; versionNo: number; effectiveFrom: string } | null;
      measurement: "PERIOD_VERSION_NOT_APPROVED" | null;
      eligibility: { eligible: false; act: "made" | "approved"; on: string };
    }
  | {
      reference: string;
      caseReference: string;
      receivedAt: string;
      dueAt: string | null;
      period: { amount: number; versionNo: number; effectiveFrom: string } | null;
      measurement: "PERIOD_VERSION_NOT_APPROVED" | null;
      eligibility: { eligible: true };
      /** The reader may record the outcome: a dispute authority. */
      mayDecide: boolean;
      late: boolean;
      lapsed: boolean;
      state: AppealState;
      grounds: string;
      decision: CaseDecision & { governingGround: string };
      remedies: readonly RemedyKind[];
      governingGrounds: readonly string[];
      outcome: AppealSummary["outcome"];
      decidedBy: string | null;
      today: string;
    };

export interface ReopeningPage {
  reference: string;
  state: CaseState;
  today: string;
  closedOn: string | null;
  decision: { issuedAt: string; remedy: RemedyKind; outcomes: readonly RemedyKind[] } | null;
  /** The proposal open on the case, with who proposed it named only to the record, never in a refusal. */
  open: {
    reference: string;
    groundKind: GroundKind;
    groundRef: string;
    evidenceOn: string | null;
    displaced: readonly string[];
    proposedAt: string;
    proposedBy: StaffName;
    /** A case officer, or the raiser on their own case (SCR-CAS-08). */
    proposer: "officer" | "raiser";
    state: ReopeningState;
  } | null;
  history: readonly {
    reference: string;
    groundKind: GroundKind;
    /** What the ground rested on, kept with every reopening (FR-CAS-017). */
    groundRef: string;
    state: ReopeningState;
    recordedAt: string;
    decidedAt: string | null;
    displaced: readonly string[];
    /** The authority's reason, on a refused proposal. */
    refusedReason: string | null;
  }[];
  /** The CFG-51 window: the last day new evidence may be offered on this case. */
  windowEnds: string | null;
}

export interface MatrixRoute {
  group: string;
  kind: RouteKind;
  requiresAccount: boolean;
}

export interface MatrixVersionView {
  id: string;
  versionNo: number;
  state: "PREPARED" | "APPROVED";
  effectiveFrom: string;
  effectiveTo: string | null;
  preparedBy: StaffName;
  approvedBy: StaffName | null;
  approvedAt: string | null;
  routes: readonly MatrixRoute[];
  /** The listed group with no route that works without an account (NO_ACCOUNT_FREE_ROUTE), or null when every one has. */
  withoutAccountFree: string | null;
}

export interface IntakeMatrixPage {
  today: string;
  inForce: MatrixVersionView | null;
  prepared: MatrixVersionView | null;
  groups: readonly string[];
}

export interface PolicyEntryView {
  id: string;
  code: string;
  /** The words typed for a new entry; null where the catalogue words a seeded code. */
  label: string | null;
  requiredAuthority: StaffRole | null;
  limit: { caseType: string; instrument: string; days: number } | null;
  requires: { remedyKind: RemedyKind; artefactKinds: readonly ArtefactKind[] } | null;
  state: "PREPARED" | "APPROVED";
  effectiveFrom: string;
  preparedBy: StaffName;
  approvedBy: StaffName | null;
  approvedAt: string | null;
  /** The approver's last refusal of it, while it stays prepared: the reason and who gave it. */
  refused: { reason: string; by: StaffName } | null;
}

export interface PeriodView {
  id: string;
  caseType: string;
  versionNo: number;
  amount: number;
  unit: "working_days" | "months";
  state: "PREPARED" | "APPROVED";
  effectiveFrom: string;
  effectiveTo: string | null;
  preparedBy: StaffName;
  approvedBy: StaffName | null;
  approvedAt: string | null;
  refused: { reason: string; by: StaffName } | null;
}

/** One version of a protected category's policy (`cases.protected_category_policies`, CFG-50). */
export interface CategoryPolicyView {
  id: string;
  category: ProtectedCategory;
  versionNo: number;
  specialistProcess: string;
  /** Who may read a matter in the category, and nobody else. */
  access: readonly StaffName[];
  /** Where an independent escalation goes first, and where it goes when the first is a subject of the matter. */
  primary: StaffName;
  alternate: StaffName;
  state: "PREPARED" | "APPROVED";
  effectiveFrom: string;
  effectiveTo: string | null;
  preparedBy: StaffName;
  approvedBy: StaffName | null;
  approvedAt: string | null;
  refused: { reason: string; by: StaffName } | null;
}

/** An appeal lodged while no appeal period was approved for its case type: nothing measures it (AC-FR-CAS-021-03). */
export interface UnmeasuredAppeal {
  appeal: string;
  caseReference: string;
  caseType: string | null;
  receivedAt: string;
}

export interface PolicyRegisterPage {
  today: string;
  register: PolicyRegisterCode;
  entries: readonly PolicyEntryView[];
  periods: readonly PeriodView[];
  /** The protected categories' policy versions, on the `protected_category` register. */
  categoryPolicies: readonly CategoryPolicyView[];
  /** On `appeal_decision`: the appeals lodged under no approved period, which approving a version now does not measure. */
  unmeasured: readonly UnmeasuredAppeal[];
  caseTypes: readonly string[];
  /** The pause-ground authorities a ground may name. */
  authorities: readonly StaffRole[];
  /** The staff a category policy may name on its access list and as its addressees. */
  staff: readonly StaffName[];
  counts: Readonly<Record<PolicyRegisterCode, number>>;
}

// ---------------------------------------------------------------- reads

const answer = <T>(read: () => LoadOutcome<T>): Promise<LoadOutcome<T>> => Promise.resolve(usesMockData() ? read() : NOT_CONFIGURED);

/**
 * GET /intake-routes for SCR-CAS-01: the groups of the matrix in force, the routes open to the chosen one, and the
 * form as the last attempt left it. `key` is the principal's session, or the browser's world for anyone else.
 */
export function loadIntakeForm(
  key: string,
  reader: CaseReader,
  group: string | null,
  subject: string | null,
  attempt: IntakeAttempt | null,
  view: Exclude<Cas01View, "loading"> | null,
): Promise<LoadOutcome<IntakeForm>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockCaseFailure("error"));
  const form = intakeForm(key, reader, group, subject, attempt);
  // The review state of a route only a prepared version lists: the refusal, over the public form.
  if (view === "not-open" && form.data !== null) return Promise.resolve({ data: { ...form.data, refusal: "MATRIX_VERSION_NOT_APPROVED" }, failure: null });
  return Promise.resolve(form);
}

/**
 * SCR-CAS-01 as the support-line agent reads it on the console: the groups of the matrix in force and, for the
 * caller's group, its support line, the route a case recorded for a caller arrives on.
 */
export function loadCallerIntakeForm(staff: Staff, group: string | null, attempt: IntakeAttempt | null, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<IntakeForm>> {
  return consoleRead(view, () => callerIntakeForm(staff.sessionId, staff, group, attempt));
}

/** GET /cases/{reference} for SCR-CAS-02: CASE_NOT_FOUND for a reference that names no case, whoever asks. */
export function loadCase(key: string, reference: string, reader: CaseReader, view: Exclude<Cas02View, "loading"> | null): Promise<LoadOutcome<CaseView>> {
  if (view !== null && usesMockData()) return Promise.resolve(mockCaseFailure(view));
  return answer(() => caseRead(key, reference, reader));
}

/** The cases a party raised from its account, newest first (`cases.case_parties` by party). */
export function loadCasesRaisedBy(sessionId: string, party: string, view: Exclude<CasesView, "loading"> | null): Promise<LoadOutcome<readonly CaseSummary[]>> {
  if (view !== null && usesMockData()) return Promise.resolve(mockCaseFailure(view));
  return answer(() => casesRaisedBy(sessionId, party));
}

/** SCR-CAS-08: the decision on the case the reference names, for the party it went against. */
export function loadAppealForm(key: string, reference: string, reader: CaseReader, view: Exclude<Cas08View, "loading"> | null): Promise<LoadOutcome<AppealForm>> {
  if (view !== null && usesMockData()) return Promise.resolve(mockCaseFailure(view));
  return answer(() => appealForm(key, reference, reader));
}

/** A console read, or the review state a reviewer asked for. */
function consoleRead<T>(view: ConsoleView | Cas03View | null, read: () => LoadOutcome<T>): Promise<LoadOutcome<T>> {
  if (view !== null && view !== "loading" && usesMockData()) return Promise.resolve(mockCaseFailure(view));
  return answer(read);
}

/** GET /cases for SCR-CAS-03: a keyset page of the cases in the reader's scope. */
export function loadCaseQueue(staff: Staff, filter: QueueFilter, cursor: string | null, view: Exclude<Cas03View, "loading"> | null): Promise<LoadOutcome<CaseQueue>> {
  return consoleRead(view, () => caseQueue(staff.sessionId, staff, filter, cursor));
}

/** GET /cases/{reference} for SCR-CAS-04. */
export function loadConsoleCase(staff: Staff, reference: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<ConsoleCaseView>> {
  return consoleRead(view, () => consoleCase(staff.sessionId, staff, reference));
}

/** GET /cases/{id}/evidence-requests for SCR-CAS-06. */
export function loadEvidencePage(staff: Staff, reference: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<EvidencePage>> {
  return consoleRead(view, () => evidencePage(staff.sessionId, staff, reference));
}

/** GET /cases/{id}/decisions for SCR-CAS-07. */
export function loadDecisionPage(staff: Staff, reference: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<DecisionPage>> {
  return consoleRead(view, () => decisionPage(staff.sessionId, staff, reference));
}

/** GET /decisions/{id}/remedy-links for SCR-CAS-10. */
export function loadRemedyPage(staff: Staff, reference: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<RemedyPage>> {
  return consoleRead(view, () => remedyPage(staff.sessionId, staff, reference));
}

/** The approvals surface's queue: the appeals and the reopenings waiting on a dispute authority. */
export function loadApprovals(staff: Staff, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<ApprovalsQueue>> {
  return consoleRead(view, () => approvalsQueue(staff.sessionId, staff));
}

/** GET /appeals/{id} after POST /appeals/{id}/eligibility, for SCR-CAS-09. */
export function loadAppealPage(staff: Staff, appeal: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<AppealPage>> {
  return consoleRead(view, () => appealPage(staff.sessionId, staff, appeal));
}

/** GET /cases/{id}/reopenings for SCR-CAS-15. */
export function loadReopeningPage(staff: Staff, reference: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<ReopeningPage>> {
  return consoleRead(view, () => reopeningPage(staff.sessionId, staff, reference));
}

/** GET /intake-routes with the versions, for SCR-CAS-16. */
export function loadIntakeMatrix(staff: Staff, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<IntakeMatrixPage>> {
  return consoleRead(view, () => intakeMatrixPage(staff.sessionId, staff));
}

/** One register of SCR-CAS-18. */
export function loadPolicyRegister(staff: Staff, register: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<PolicyRegisterPage>> {
  return consoleRead(view, () => policyRegister(staff.sessionId, staff, register));
}

// ---------------------------------------------------------------- acts

const command = <T>(run: () => CommandAnswer<T>): Promise<LoadOutcome<CommandAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

const act = <T>(run: () => CaseAnswer<T>): Promise<LoadOutcome<CaseAnswer<T>>> => Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/**
 * POST /cases: the case is recorded RECEIVED with its reference, its acknowledgement is raised (COM), and the
 * reference comes back; or the refusal, with every field it names.
 */
export function sendCase(key: string, reader: CaseReader, input: IntakeInput): Promise<LoadOutcome<CommandAnswer<{ reference: string; contact: string; notice: string | null }>>> {
  return command(() => raiseCase(key, reader, input));
}

/** POST /cases by a support-line agent, for a caller: both identities stored, the acknowledgement to the caller. */
export function sendCallerCase(staff: Staff, input: IntakeInput): Promise<LoadOutcome<CommandAnswer<{ reference: string; contact: string; notice: string | null }>>> {
  return command(() => recordCallerCase(staff.sessionId, staff, input));
}

/** POST /cases/{id}/withdraw: WITHDRAWN, or CASE_ALREADY_DECIDED, ROLE_OUT_OF_SCOPE, TRANSITION_NOT_PERMITTED. */
export function sendCaseWithdrawal(key: string, reference: string, reader: CaseReader): Promise<LoadOutcome<CommandAnswer<{ state: CaseState }>>> {
  return command(() => withdrawCase(key, reference, reader));
}

/** POST /evidence-requests/{id}/responses, by the party the request addresses (SCR-CAS-02). */
export function sendEvidenceAnswer(key: string, reader: CaseReader, reference: string, request: string, input: { outcome: string; supplied: string }) {
  return act(() => answerEvidenceRequest(key, reader, reference, request, input));
}

/** POST /cases/{id}/evidence by the raiser, an item on their own case with the status it carries (SCR-CAS-02). */
export function sendOwnEvidence(key: string, reader: CaseReader, reference: string, input: { itemRef: string; disclosure: string }) {
  return act(() => supplyEvidence(key, reader, reference, input));
}

/** POST /decisions/{id}/appeals (SCR-CAS-08). */
export function sendAppeal(key: string, reader: CaseReader, reference: string, input: { grounds: string; contact: string }) {
  return act(() => lodgeAppeal(key, reader, reference, input));
}

/** POST /cases/{id}/reopenings by the raiser, on new evidence (SCR-CAS-08's Ask for a reopening). */
export function sendReopeningRequest(key: string, reader: CaseReader, reference: string, input: ReopeningInput) {
  return act(() => askReopening(key, reader, reference, input));
}

/** POST /cases/{id}/classify (SCR-CAS-04). */
export function sendClassification(staff: Staff, reference: string, input: ClassifyInput) {
  return act(() => classifyCase(staff.sessionId, staff, reference, input));
}

/** POST /cases/{id}/progress (SCR-CAS-04). */
export function sendProgress(staff: Staff, reference: string, to: string) {
  return act(() => progressCase(staff.sessionId, staff, reference, to));
}

/** POST /cases/{id}/refer (SCR-CAS-04): REFERRED, the process named, the raiser told. */
export function sendReferral(staff: Staff, reference: string, input: { process: string; reason: string }) {
  return act(() => referCase(staff.sessionId, staff, reference, input));
}

/** POST /cases/{id}/close (SCR-CAS-04): CLOSED_INADMISSIBLE or CLOSED_INCOMPLETE, or the dispositions the state admits. */
export function sendClosure(staff: Staff, reference: string, input: CloseInput) {
  return act(() => closeCase(staff.sessionId, staff, reference, input));
}

/** POST /cases/{id}/protected-classification (SCR-CAS-04's Classify as protected). */
export function sendProtectedClassification(staff: Staff, reference: string, input: { category: string; reason: string; subjects: readonly string[] }) {
  return act(() => classifyProtected(staff.sessionId, staff, reference, input));
}

/** POST /cases/{id}/links (SCR-CAS-04). */
export function sendCaseLink(staff: Staff, reference: string, input: { to: string; kind: string }) {
  return act(() => linkCase(staff.sessionId, staff, reference, input));
}

/** POST /cases/{id}/parties (SCR-CAS-04). */
export function sendParty(staff: Staff, reference: string, input: { party: string; role: string }) {
  return act(() => addParty(staff.sessionId, staff, reference, input));
}

/** POST /cases/{id}/evidence-requests (SCR-CAS-06). */
export function sendEvidenceRequest(staff: Staff, reference: string, input: Parameters<typeof requestEvidence>[3]) {
  return act(() => requestEvidence(staff.sessionId, staff, reference, input));
}

/** POST /evidence-requests/{id}/cancel (SCR-CAS-06). */
export function sendRequestCancellation(staff: Staff, reference: string, request: string, reason: string) {
  return act(() => cancelEvidenceRequest(staff.sessionId, staff, reference, request, reason));
}

/** POST /evidence-requests/{id}/responses by a case officer, for an answer that arrived another way (SCR-CAS-06). */
export function sendRecordedResponse(staff: Staff, reference: string, request: string, input: { outcome: string; supplied: string }) {
  return act(() => recordEvidenceResponse(staff.sessionId, staff, reference, request, input));
}

/** POST /cases/{id}/evidence by a case officer (SCR-CAS-06). */
export function sendEvidenceItem(staff: Staff, reference: string, input: { itemRef: string; disclosure: string; suppliedBy: string }) {
  return act(() => addEvidence(staff.sessionId, staff, reference, input));
}

/** Save draft on SCR-CAS-07. */
export function sendDecisionDraft(staff: Staff, reference: string, values: DecisionValues) {
  return act(() => saveDecisionDraft(staff.sessionId, staff, reference, values));
}

/** POST /cases/{id}/decisions (SCR-CAS-07). */
export function sendDecision(staff: Staff, reference: string, values: DecisionValues, effective: string | null) {
  return act(() => recordDecision(staff.sessionId, staff, reference, values, effective));
}

/** POST /decisions/{id}/remedy-links (SCR-CAS-10). */
export function sendRemedyLink(staff: Staff, reference: string, input: { kind: string; artefact: string }) {
  return act(() => linkRemedyArtefact(staff.sessionId, staff, reference, input));
}

/** Re-check linkage (SCR-CAS-10). */
export function sendLinkageCheck(staff: Staff, reference: string) {
  return act(() => recheckLinkage(staff.sessionId, staff, reference));
}

/** POST /appeals/{id}/outcome (SCR-CAS-09). */
export function sendAppealOutcome(staff: Staff, appeal: string, input: OutcomeInput) {
  return act(() => recordAppealOutcome(staff.sessionId, staff, appeal, input));
}

/** POST /cases/{id}/reopenings (SCR-CAS-15). */
export function sendReopening(staff: Staff, reference: string, input: ReopeningInput) {
  return act(() => proposeReopening(staff.sessionId, staff, reference, input));
}

/** POST /reopenings/{id}/authorise (SCR-CAS-15): `authorise`, or `refuse` with its reason. */
export function sendReopeningAuthorisation(staff: Staff, reopening: string, decision: "authorise" | "refuse" = "authorise", reason = "") {
  return act(() => authoriseReopening(staff.sessionId, staff, reopening, decision, reason));
}

/** POST /intake-matrix-versions (SCR-CAS-16). */
export function sendIntakeVersion(staff: Staff, input: Parameters<typeof saveIntakeVersion>[2]) {
  return act(() => saveIntakeVersion(staff.sessionId, staff, input));
}

/** POST /intake-matrix-versions/{id}/approve (SCR-CAS-16). */
export function sendIntakeApproval(staff: Staff, version: string) {
  return act(() => approveIntakeVersion(staff.sessionId, staff, version));
}

/** POST /registers/{register}/entries (SCR-CAS-18). */
export function sendRegisterEntry(staff: Staff, register: string, input: Parameters<typeof addRegisterEntry>[3]) {
  return act(() => addRegisterEntry(staff.sessionId, staff, register, input));
}

/** POST /policy-periods (SCR-CAS-18). */
export function sendPeriodVersion(staff: Staff, kind: string, input: Parameters<typeof preparePeriod>[3]) {
  return act(() => preparePeriod(staff.sessionId, staff, kind, input));
}

/** POST /category-policies (SCR-CAS-18, the protected categories): a version, PREPARED until approved. */
export function sendCategoryPolicy(staff: Staff, input: CategoryPolicyInput) {
  return act(() => prepareCategoryPolicy(staff.sessionId, staff, input));
}

/** Approve and publish, or refuse with a reason (SCR-CAS-18). */
export function sendPolicyApproval(staff: Staff, id: string, decision: "approve" | "refuse" = "approve", reason = "") {
  return act(() => approvePolicyItem(staff.sessionId, staff, id, decision, reason));
}
