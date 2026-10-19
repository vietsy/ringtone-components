import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import type { TransitionRule } from "./tariff";
import {
  addEvidenceItem,
  addRequestedDocument,
  applicationDraft,
  applicationList,
  applicationRecord,
  attestationStep,
  attestAndSubmit,
  decisionList,
  decisionRecord,
  declareFacts,
  evidenceStep,
  factsStep,
  premisesActedFor,
  previewApplication,
  raiseAssertion,
  startApplication,
  startForm,
  startValuesFrom,
  withdrawApplication,
} from "@/lib/mock/backend/registration";
import {
  mockApplicationDraft,
  mockApplicationRecord,
  mockApplications,
  mockAttestationStep,
  mockDecision,
  mockDecisions,
  mockEvidenceStep,
  mockFactsStep,
  mockPremisesActedFor,
  mockReviewStep,
  mockStartApplication,
  type DraftView,
  type Reg01View,
  type Reg02View,
  type Reg03View,
  type Reg04View,
  type Reg05View,
  type Reg06View,
  type Reg07View,
  type Reg08View,
} from "@/lib/mock/registration";
import { settlementOf } from "@/lib/mock/backend/finance";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The registration family (REG) on the premises portal: applications, their steps, and the obligation
 * decisions they end in. Each loader is one screen's read for the signed-in session; given a view, it answers
 * the state the design canvas drew instead (design review). A refusal is a failure with its code, never an
 * empty answer. The commands are the API's: each answers whether RightOne accepted the act, and a refused act
 * carries its code and the values its refusal names.
 */

export interface Period {
  from: string;
  to: string;
}

/** A premises the signed-in person may act for, as PTY names it. */
export interface PremisesOption {
  id: string;
  name: string;
}

export type ApplicationKind = "NEW" | "RENEWAL" | "AMENDMENT";

/** SM-REG-01, the application's states. */
export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "EVIDENCE_REQUIRED"
  | "DECIDED"
  | "REFUSED"
  | "WITHDRAWN"
  | "CLOSED_INCOMPLETE";

export type RightsLayer = "AUTHORS" | "PERFORMERS" | "PRODUCERS";
export type ClaimKind = "NON_USE" | "DIRECT_LICENCE";

/** A document the rules or a reviewer ask for, by the item it answers. */
export type DocumentItem = "USE_START_PROOF" | "LEASE" | "SUPPLIER_INVOICE" | "MUSIC_INVOICE_Q3" | "EQUIPMENT_PHOTO";

/** SM-266, a claim's states: drafted with the application, in review once sent, then the outcome recorded on the console. */
export type ClaimState = "DRAFT" | "UNDER_REVIEW" | "ACCEPTED" | "PARTLY_ACCEPTED" | "NOT_ACCEPTED" | "WITHDRAWN";

export interface UploadedFile {
  name: string;
  sizeBytes: number;
}

/** The file a person chose: its name, media type and size. The mock keeps these and never the file itself. */
export interface ChosenFile {
  name: string;
  type: string;
  sizeBytes: number;
}

/**
 * Words a person at RightOne wrote about this one case - a reviewer's reason, what the premises can do -
 * in each language the page is read in. They are the statement's own text, not the catalogue's copy.
 */
export type CaseText = Readonly<Record<Locale, string>>;

/** An item the application still needs before it can be reviewed or sent (`missing_items`, `remaining`). */
export type MissingItem =
  | { for: "FACTS"; question: FactQuestion }
  | { for: "RULES"; item: DocumentItem }
  | { for: "CLAIM"; item: DocumentItem; layer: RightsLayer };

// ---------------------------------------------------------------- SCR-REG-01

export interface ApplicationSummary {
  reference: string;
  premises: PremisesOption;
  kind: ApplicationKind;
  status: ApplicationStatus;
  /** RightOne started it (a claim outcome), not the premises; the premises confirms only if an answer changes. */
  startedByRightOne: boolean;
  savedAt: string | null;
  sentAt: string | null;
  /** While documents are asked for: when, and by when. */
  evidence: { askedOn: string; dueOn: string } | null;
  /** The decision issued on it, once decided. */
  decision: string | null;
}

export interface ApplicationList {
  items: readonly ApplicationSummary[];
  /** The list has a further page. */
  hasMore: boolean;
  /** The refusal of the request for the next page (CURSOR_INVALID), shown in place of Show more. */
  moreRefused: string | null;
}

export interface DecisionSummary {
  reference: string;
  premises: PremisesOption;
  status: "CURRENT" | "SUPERSEDED";
  outcome: "PAYABLE" | "NO_PAYABLE_OBLIGATION";
  /** What the list says beside the state: decided otherwise than applied for, a claim pending, out of scope. */
  note: "OTHERWISE" | "CLAIM_PENDING" | "OUT_OF_SCOPE" | null;
  feeMinor: number;
  currency: string;
  payBy: string | null;
  period: Period;
  replaces: string | null;
  replacedBy: { reference: string; from: string } | null;
}

export interface DecisionList {
  items: readonly DecisionSummary[];
  hasMore: boolean;
}

// ---------------------------------------------------------------- SCR-REG-02

export type AmendmentCause = "FACT_CHANGE_REPORTED" | "APPLICANT_REQUEST";

export interface StartApplication {
  /** The business day in Vietnam the dates are checked against. */
  today: string;
  /** The party the person acts for. */
  party: string;
  premises: readonly PremisesOption[];
  /** The form as RightOne answers it: the choices made so far, echoed back after an attempt to start. */
  values: StartValues;
  /** The refusal of the last attempt to start, for the whole form; openApplication names the one already in progress. */
  refusal: { code: string; openApplication: string | null } | null;
  /** A refusal that belongs to one field; governingDecision names the decision already covering the period. */
  fieldError: { field: "period" | "cause"; code: string; governingDecision: string | null } | null;
}

export interface StartValues {
  premisesId: string | null;
  kind: ApplicationKind;
  /** The decision a renewal or a change starts from; its period is null when RightOne no longer finds it. */
  prior: { reference: string; period: Period | null } | null;
  cause: AmendmentCause | null;
  period: Period;
}

// ---------------------------------------------------------------- SCR-REG-03 to 06, the draft

export type DraftStep = "facts" | "evidence" | "review" | "attestation";

export interface ApplicationDraft {
  reference: string;
  premises: string;
  kind: ApplicationKind;
  period: Period;
  /** Each step saves when the person moves on; null until the first save. */
  savedAt: string | null;
}

export type PremisesClass = "cafe" | "restaurant" | "bar" | "karaoke" | "hotel" | "shop";
export type MusicMethod = "speakers" | "live" | "both" | "screens";
export type FactQuestion = "premises_class" | "customer_area" | "days_open" | "music_method" | "use_began_on";

export interface FactAnswers {
  premisesClass: PremisesClass | null;
  customerArea: number | null;
  daysOpen: number | null;
  musicMethod: MusicMethod | null;
  useBeganOn: string | null;
}

export interface FactsStep {
  /** The business day in Vietnam; the date music began may not be later. */
  today: string;
  /**
   * What RightOne already holds from the register. An area of null is one the register did not answer, so it is
   * not shown; a class of null is asked as a question instead.
   */
  known: {
    businessRegistration: string;
    administrativeArea: string | null;
    premisesClass: PremisesClass | null;
    /** The register changed the class since the last decision (a renewal). */
    classChanged: boolean;
  };
  /** A rule that stops the questions; RightOne resolves it, the draft is kept. */
  blocked: "RULEBOOK_NOT_APPROVED" | "RULEBOOK_EXCEEDS_FACT_LIMIT" | "USE_START_REQUIRED" | null;
  /** The questions the rules ask; none when the register already holds everything. */
  questions: readonly FactQuestion[];
  answers: FactAnswers;
  /** A renewal copies the answers from the last decision; each says whether it was confirmed as still true. */
  copied: Partial<Record<FactQuestion, boolean>> | null;
  /** The refusal of the last save, per answer. */
  fieldErrors: Partial<Record<FactQuestion, string>>;
  /** The refusal of the last save as a whole; every answer stays as entered. */
  saveRefusal: "DATA_GOVERNANCE_UNAVAILABLE" | "PROCESSING_NOT_PERMITTED" | null;
}

export type DocumentState =
  | { state: "RECEIVED"; receivedOn: string; file: UploadedFile }
  | { state: "UPLOADING"; file: UploadedFile; percent: number }
  | { state: "NEEDED"; refusal: string | null };

export interface RequiredDocument {
  item: DocumentItem;
  status: DocumentState;
}

export interface EvidenceStep {
  /** The business day in Vietnam, for the claim form's calendar. */
  today: string;
  blocked: "RULEBOOK_NOT_APPROVED" | null;
  /** The documents the rules ask for now; none is a governed answer, not a gap. */
  documents: readonly RequiredDocument[];
  /** Documents RightOne asks for once the application is sent. */
  afterSending: readonly DocumentItem[];
  claims: readonly {
    kind: ClaimKind;
    layer: RightsLayer;
    period: Period;
    documents: readonly RequiredDocument[];
  }[];
  /** The claim form as the last attempt left it; null while it is closed. */
  claimAttempt: {
    kind: ClaimKind;
    layer: RightsLayer | null;
    from: string;
    to: string;
    refusal: { field: "layer" | "period"; code: string } | null;
  } | null;
  /** Every item still needed before the review, facts included, and what it is for. */
  stillNeeded: readonly MissingItem[];
}

export interface ReviewStep {
  /** A rule or a gap that stops the review; the review shows nothing it cannot stand behind. */
  blocked: "REQUIRED_ITEMS_MISSING" | "RULEBOOK_NOT_APPROVED" | "USE_START_REQUIRED" | "RULEBOOK_EXCEEDS_FACT_LIMIT" | null;
  missing: readonly MissingItem[];
  /** The answers given, in the order asked; the class only when the person declared it. Null while items are missing. */
  told: {
    premisesClass: PremisesClass | null;
    customerArea: number;
    daysOpen: number;
    musicMethod: MusicMethod;
    useBeganOn: string;
  } | null;
  /** Null when no approved tariff applies; feeRefusal then says so. */
  fee: {
    period: Period;
    /** A layer the tariff does not charge says why: exempt, no organisation represents it now, or a claim accepted. */
    lines: readonly { layer: RightsLayer; amountMinor: number; claimPending: boolean; treatment?: "EXEMPT" | "MANDATE_STOPPED" | "CLAIM_ACCEPTED" | null }[];
    totalMinor: number;
    currency: string;
    tariffVersion: string;
    workedOutAt: string;
  } | null;
  feeRefusal: "TARIFF_NOT_APPROVED" | null;
  /** The fee rests on a class the person declared, not on the register. */
  declaredClass: boolean;
  /**
   * The small-business exemption, criterion by criterion: the canvas's three conditions on its design states, or the
   * tariff's micro-business criteria (`DR-291`) where the calculation applied them and nothing is owed.
   */
  exemption: readonly (
    | { criterion: "AREA_UNDER_100"; met: boolean; declaredArea: number }
    | { criterion: "ONE_PREMISES"; met: boolean; premisesInRegister: number; party: string }
    | { criterion: "RECORDED_SPEAKERS_ONLY"; met: boolean; declared: MusicMethod }
    | { criterion: "FLOOR_AREA_M2" | "SEATING_CAPACITY"; met: boolean; atMost: number; value: number | null }
  )[] | null;
  /** The payment deadline, 89 days after use began (DR-23); null while the date is not given. */
  payBy: string | null;
  /**
   * The explanation version in force on the governing date, and the change-report period it quotes (TAR's `CFG-360`,
   * the thirty-day default while no version is approved). Never blank: the canvas's design states quote the default.
   */
  explanation: { version: number; published: boolean; changeReportDays: number };
  /**
   * What a submission at this moment comes to (`DR-01`): decided at once, with the amount or the basis of no fee, or
   * sent to an officer, and why. Absent on the canvas's design states.
   */
  outcome?: ReviewOutcome | null;
  /** `DR-22`: what is decided for the time before registration, with the amnesty that applies. Absent on design states. */
  preRegistration?: PreRegistration | null;
  /** The calculation the fee rests on (TAR's reference), recorded with the review. */
  calculation?: string | null;
}

/** `DR-01` as a review shows it: the outcome a submission now reaches, before anyone confirms anything. */
export type ReviewOutcome =
  | { kind: "PAYABLE" }
  | { kind: "NO_PAYABLE_OBLIGATION"; basis: "OUT_OF_SCOPE" | "EXEMPTION" | "MICRO_BUSINESS_EXEMPTION" }
  | { kind: "UNDER_REVIEW"; reason: "CLAIM_NEEDS_REVIEW" | "OFFICER_AMENDMENT" | "RULEBOOK_TRIGGER" | "INDETERMINATE_FACTS" };

/** `DR-22`'s answer for the time before registration, and the amnesty version it applied. */
export interface PreRegistration {
  treatment: "NO_PRE_REGISTRATION_PERIOD" | "AMNESTY_APPLIED" | "DEC13_NOT_EFFECTIVE";
  amnesty: { version: string; period: Period } | null;
}

export interface AttestationStep {
  party: string;
  /** The two confirmations as last sent; a refusal echoes what was ticked. */
  confirmed: boolean;
  changeDutyAcknowledged: boolean;
  /** The refusal of the last attempt; governingDecision names the decision already covering some days. */
  refusal: { code: string; governingDecision: string | null } | null;
  missing: readonly MissingItem[];
  /** The confirmation is recorded and only the sending failed: the button sends again. */
  sendPending: boolean;
  /** What SCR-REG-05 showed, carried with the confirmation; null when no review was recorded. */
  shown: { presentation: string; factsDigest: string } | null;
  /** The change-report period the explanation shown quoted, which the second box holds the premises to (CFG-360). */
  changeReportDays: number;
}

// ---------------------------------------------------------------- SCR-REG-07

export type HistoryEvent =
  | { event: "STARTED" }
  | { event: "CONFIRMED" }
  | { event: "SENT"; route: "CLAIM_REVIEW" | "RULEBOOK_REVIEW" | "AMENDMENT_REVIEW" | "RULES"; claim: ClaimKind | null }
  | { event: "EVIDENCE_ASKED"; by: "REVIEWER" | "RIGHTONE" }
  | { event: "EVIDENCE_COMPLETE" }
  /** afterDocument: the decision followed the last document on the automated route. */
  | { event: "DECIDED"; decision: string; afterDocument: boolean }
  | { event: "REFUSED" }
  | { event: "WITHDRAWN" }
  /** Withdrawn by an officer on the applicant's recorded instruction (SCR-REG-15). */
  | { event: "WITHDRAWN_ON_INSTRUCTION" }
  | { event: "CLOSED" };

/** Why one requested document was not taken: a bad file, a request that has ended, or no tariff to decide on. */
export type EvidenceItemRefusal = "DOCUMENT_INVALID" | "EVIDENCE_REQUEST_CLOSED" | "TARIFF_NOT_APPROVED" | "EVIDENCE_NOT_REQUESTED";

/** The statement of a refusal (convention 9): the outcome, the reason, the condition not met, what the premises can do. */
export interface RefusalStatement {
  outcome: CaseText;
  reason: CaseText;
  notMet: CaseText;
  youCan: CaseText;
}

export interface ApplicationRecord {
  reference: string;
  premises: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  savedAt: string | null;
  /** Null while a draft, or where the record does not give the moment. */
  sentAt: string | null;
  /** The queue that reviews it; null while it is a draft, or where the record does not name it. */
  review: "CLAIM" | "RULEBOOK" | "AMENDMENT" | "NONE" | null;
  /** The documents asked for once the application was sent; the route is automated when RightOne asked. */
  evidenceRequest: {
    askedBy: "REVIEWER" | "RIGHTONE";
    askedOn: string;
    /** Null once every item has arrived. */
    dueOn: string | null;
    /** The request has ended, so no document can be added. */
    closed: boolean;
    /**
     * Each item by its code. A reviewer's item carries the sentence the officer wrote for the applicant, read as
     * written; an item the rules name carries the document instead, worded by the catalogue.
     */
    items: readonly {
      item: string;
      document: DocumentItem | null;
      description: string | null;
      receivedOn: string | null;
      refusal: EvidenceItemRefusal | null;
    }[];
  } | null;
  /** The latest expected-date statement; completeness and the expected decision only where a review takes place. */
  dates: {
    completeOn: string | null;
    decisionExpectedBy: string | null;
    /** Both dates are set again when the last document arrives. */
    reset: boolean;
    paymentDeadline: string;
    useBeganOn: string;
    /** When RightOne told the premises the decision would come after its payment deadline (DR-41 row 2). */
    toldOn: string | null;
    /** The payment deadline had passed when the application became complete (DR-41 row 3). */
    passedWhenComplete: boolean;
  } | null;
  claims: readonly { kind: ClaimKind; layer: RightsLayer; period: Period; state: ClaimState }[];
  /** Newest first; a moment the record does not give is null. */
  history: readonly ({ at: string | null } & HistoryEvent)[];
  decision: { reference: string; issuedAt: string | null } | null;
  /**
   * How the application ended. A withdrawal is the applicant's own, or one an officer recorded on the
   * applicant's instruction, which then carries the instruction's reference (convention 9).
   */
  ended:
    | { kind: "REFUSED"; on: string; statement: RefusalStatement }
    | { kind: "WITHDRAWN"; on: string; at: string; instruction: string | null }
    | { kind: "CLOSED_INCOMPLETE"; on: string }
    | null;
  canWithdraw: boolean;
  /** The refusal of the last attempt to withdraw. */
  withdrawRefusal: "APPLICATION_ALREADY_FINAL" | null;
}

// ---------------------------------------------------------------- SCR-REG-08

export interface DecisionRecord {
  reference: string;
  premises: string;
  status: "CURRENT" | "SUPERSEDED";
  outcome: "PAYABLE" | "NO_PAYABLE_OBLIGATION";
  issuedAt: string;
  period: Period;
  /** Why it owes what it owes: the tariff, outside the obligation, or an exemption the tariff defines (DR-01 rows 3 to 5). */
  basis: "TARIFF" | "OUT_OF_SCOPE" | "EXEMPTION" | "MICRO_BUSINESS_EXEMPTION";
  /** One line per rights layer; a partly accepted claim splits its layer into the accepted part and the rest. */
  lines: readonly {
    layer: RightsLayer;
    amountMinor: number;
    /** MANDATE_STOPPED: not charged, no organisation represents the right now (TAR's EXCLUDED_MANDATE_STOPPED). */
    treatment: "EXEMPT" | "CLAIM_PENDING" | "CLAIM_ACCEPTED" | "MANDATE_STOPPED" | null;
    /** The part of the period a split line covers. */
    scope: Period | null;
  }[];
  currency: string;
  tariffVersion: string;
  payBy: string | null;
  useBeganOn: string | null;
  confirmedAt: string;
  explanationVersion: number;
  rulebookVersion: string;
  /** The time before registration: a period, or a single day. */
  beforeRegistration: Period | string | null;
  /**
   * The claim the decision charged pending, as it stands now (`claim_pending` is derived from the claim, never kept):
   * still in review, partly accepted, or not accepted after the decision, with the statement DR-289 row 6 writes.
   */
  claim:
    | { state: "UNDER_REVIEW" }
    | { state: "PARTLY_ACCEPTED"; accepted: Period }
    | { state: "NOT_ACCEPTED"; kind: ClaimKind; layer: RightsLayer; period: Period; reason: CaseText; on: string }
    | null;
  /** The statutory payment deadline and where the moment of reading falls against it (DR-23); derived at each read, never kept. */
  deadline: { on: string; state: "WITHIN_DEADLINE" | "PAST_DEADLINE" } | null;
  /** The decision this one follows: the one a renewal renews or an amendment replaces (`prior_decision_id`, FR-REG-014). */
  prior: string | null;
  /** The expected decision date fell after the payment deadline, as the statement the applicant was told said (FR-REG-030). */
  lateStatement: { expectedOn: string; deadline: string; toldOn: string | null } | null;
  /**
   * Where the decision departs from the application, when it does, with the statement that says why. STATEMENT
   * is an officer's decision otherwise than applied for, approved on the console: its sentences are the
   * officer's own, read as written.
   */
  otherwise: { aspect: "CUSTOMER_AREA" | "PRODUCERS_CLAIM" | "STATEMENT"; reason: CaseText; notMet: CaseText; youCan: CaseText } | null;
  replacedBy: { reference: string; from: string } | null;
  /** The application it decides, when the data names it. */
  application: string | null;
  /** The TAR calculation its fee rests on (`tariff_calculation_ref`); absent for a decision the canvas draws. */
  calculation?: string | null;
  /** It rests on a premises class the applicant declared (`rests_on_declared_classification`, FR-TAR-012). */
  declaredClassification?: boolean;
  /** How it was reached: at submission by the rules, or by an officer (`route`). */
  route?: "AUTOMATED" | "MANUAL";
  /** `DR-22`'s answer for the time before registration, with the amnesty version it applied. */
  preRegistration?: PreRegistration | null;
  /**
   * The governing date (`governing_on`, DR-288 row 3): the first day the decision takes effect, on which the rulebook,
   * explanation and tariff versions were resolved. Absent on a decision the canvas draws.
   */
  governingOn?: string;
  /** The transition rule of the tariff version applied (`transition_rule_ref`, DEC-04); absent on a decision the canvas draws. */
  transitionRule?: TransitionRule | null;
}

// ---------------------------------------------------------------- what a form hands back to its page

/*
 * A refused act comes back to the page it was made on (`lib/api/flash.ts`): the page draws the refusal where
 * the act was, with the values as entered. Each names its page and application, so an attempt is never drawn
 * on another.
 */

export interface StartAttempt {
  page: "start";
  values: StartValues;
  refusal: StartApplication["refusal"];
  fieldError: StartApplication["fieldError"];
}

export interface FactsAttempt {
  page: "facts";
  application: string;
  /** Every answer as typed, so a refused value is shown as the person entered it. */
  values: Partial<Record<FactQuestion, string>>;
  /** The copied answers ticked as still true. */
  reconfirmed: readonly FactQuestion[];
  fieldErrors: Partial<Record<FactQuestion, string>>;
}

export interface EvidenceAttempt {
  page: "evidence";
  application: string;
  /** A refused document, by the slot it was added to. */
  document: { target: string; code: string } | null;
  claim: EvidenceStep["claimAttempt"];
}

export interface AttestAttempt {
  page: "attest";
  application: string;
  confirmed: boolean;
  changeDutyAcknowledged: boolean;
  refusal: { code: string; governingDecision: string | null };
  missing: readonly MissingItem[];
}

export interface StatusAttempt {
  page: "status";
  application: string;
  withdrawRefusal: "APPLICATION_ALREADY_FINAL" | null;
  /** A refused document, by the code of the item it was added to. */
  document: { item: string; code: EvidenceItemRefusal } | null;
}

// ---------------------------------------------------------------- the loaders

/** The premises the person may act for, for SCR-REG-01's filter. */
export function loadPremisesActedFor(sessionId: string, view: Exclude<Reg01View, "loading"> | null): Promise<LoadOutcome<readonly PremisesOption[]>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockPremisesActedFor(view) : premisesActedFor(sessionId));
}

/** SCR-REG-01's applications, newest first, for one premises or all of them. */
export function loadApplications(
  sessionId: string,
  view: Exclude<Reg01View, "loading"> | null,
  premisesId: string | null,
): Promise<LoadOutcome<ApplicationList>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockApplications(view, premisesId) : applicationList(sessionId, premisesId));
}

/** SCR-REG-01's decisions, read separately: one list can fail while the other shows. */
export function loadDecisions(
  sessionId: string,
  view: Exclude<Reg01View, "loading"> | null,
  premisesId: string | null,
): Promise<LoadOutcome<DecisionList>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockDecisions(view, premisesId) : decisionList(sessionId, premisesId));
}

/**
 * SCR-REG-02: the premises to choose from, and the form as the last attempt left it. A renewal or a change
 * arrives from SCR-REG-08 as an attempt naming the decision it starts from.
 */
export function loadStartApplication(
  principal: { sessionId: string; party: string },
  view: Exclude<Reg02View, "loading"> | null,
  attempt: StartAttempt | null,
): Promise<LoadOutcome<StartApplication>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockStartApplication(view) : startForm(principal.sessionId, principal.party, attempt));
}

/**
 * The form SCR-REG-08's Renew or Report a change opens SCR-REG-02 with: the decision's premises, the kind and
 * the period the specification prefills.
 */
export function loadStartFromDecision(sessionId: string, decision: string, kind: "RENEWAL" | "AMENDMENT"): Promise<LoadOutcome<StartValues>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(startValuesFrom(sessionId, decision, kind));
}

/**
 * The draft a step belongs to, for the page header; read on its own, so a step can fail under it. An
 * application already sent answers APPLICATION_NOT_EDITABLE: its steps are over.
 */
export function loadApplicationDraft(sessionId: string, reference: string, step: DraftStep, view: DraftView | null): Promise<LoadOutcome<ApplicationDraft>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockApplicationDraft(reference, step, view) : applicationDraft(sessionId, reference));
}

/** SCR-REG-03: what the register holds and the questions the rules ask. */
export function loadFactsStep(sessionId: string, reference: string, view: Exclude<Reg03View, "loading"> | null): Promise<LoadOutcome<FactsStep>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockFactsStep(reference, view) : factsStep(sessionId, reference));
}

/** SCR-REG-04: the documents the rules ask for and the claims made. */
export function loadEvidenceStep(sessionId: string, reference: string, view: Exclude<Reg04View, "loading"> | null): Promise<LoadOutcome<EvidenceStep>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockEvidenceStep(reference, view) : evidenceStep(sessionId, reference));
}

/**
 * SCR-REG-05: the fee worked out from the answers, and the explanation. Opening the review is the API's
 * preview: when it answers with a fee and an explanation, the presentation the confirmation rests on is
 * recorded.
 */
export function loadReviewStep(sessionId: string, reference: string, view: Exclude<Reg05View, "loading"> | null): Promise<LoadOutcome<ReviewStep>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockReviewStep(reference, view) : previewApplication(sessionId, reference));
}

/** SCR-REG-06: the confirmation, unticked each time the page opens, and what the review showed. */
export function loadAttestationStep(principal: { sessionId: string; party: string }, reference: string, view: Reg06View | null): Promise<LoadOutcome<AttestationStep>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockAttestationStep(reference, view) : attestationStep(principal.sessionId, principal.party, reference));
}

/** SCR-REG-07: one application, its state, dates, claims and history. */
export function loadApplicationRecord(sessionId: string, reference: string, view: Exclude<Reg07View, "loading"> | null): Promise<LoadOutcome<ApplicationRecord>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockApplicationRecord(reference, view) : applicationRecord(sessionId, reference));
}

/** SCR-REG-08: one obligation decision. */
/**
 * Whether FIN holds a reconciled payment of this decision (`settlementOf`), so SCR-REG-08 leads to the payment's
 * position rather than offering to pay again. Read at the seam: registration's backend does not import finance's.
 */
export function loadDecisionSettled(sessionId: string, reference: string): Promise<boolean> {
  if (!usesMockData()) return Promise.resolve(false);
  return Promise.resolve(settlementOf(sessionId, reference) !== null);
}

export function loadDecision(sessionId: string, reference: string, view: Exclude<Reg08View, "loading"> | null): Promise<LoadOutcome<DecisionRecord>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockDecision(reference, view) : decisionRecord(sessionId, reference));
}

// ---------------------------------------------------------------- the commands

/**
 * A command's answer: accepted, with what it made, or refused with its code from `04-refusal-codes.md` and the
 * values the refusal names. Nothing is recorded by a refused command.
 */
export type CommandAnswer<T> = { accepted: T; refusal: null } | { accepted: null; refusal: CommandRefusal };

export interface CommandRefusal {
  code: string;
  /** The field the refusal belongs to, when it names one. */
  field: string | null;
  /** OPEN_APPLICATION_EXISTS: the application already in progress. */
  openApplication: string | null;
  /** INTENDED_PERIOD_INVALID: the decision that governs a day of the period. */
  governingDecision: string | null;
  /** REQUIRED_ITEMS_MISSING: every item still needed. */
  missing: readonly MissingItem[];
  /** A save refused answer by answer (SCR-REG-03): each refused field with its code. */
  fieldErrors: Readonly<Record<string, string>>;
}

export interface StartInput {
  premisesId: string;
  kind: ApplicationKind;
  prior: string | null;
  cause: string | null;
  /** As typed; a date that cannot be read is null. */
  from: string | null;
  to: string | null;
}

export interface FactsInput {
  /** The answers as typed, by question; a question left out is not saved. */
  values: Partial<Record<FactQuestion, string>>;
  reconfirmed: readonly FactQuestion[];
}

export interface ClaimInput {
  kind: string;
  layer: string;
  from: string | null;
  to: string | null;
}

export interface AttestInput {
  presentation: string;
  factsDigest: string;
  confirmed: boolean;
  changeDutyAcknowledged: boolean;
}

const command = <T,>(run: () => CommandAnswer<T>): Promise<LoadOutcome<CommandAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/** POST /applications: a new draft with its reference, or the refusal of the start. */
export function sendStartApplication(sessionId: string, input: StartInput): Promise<LoadOutcome<CommandAnswer<{ application: string }>>> {
  return command(() => startApplication(sessionId, input));
}

/** POST /applications/{id}/fact-declarations: the answers saved, or each refused answer. */
export function sendFactDeclarations(sessionId: string, reference: string, input: FactsInput): Promise<LoadOutcome<CommandAnswer<{ complete: boolean }>>> {
  return command(() => declareFacts(sessionId, reference, input));
}

/** POST /applications/{id}/evidence-items for a document the rules or a claim ask for, by its slot. */
export function sendEvidenceItem(sessionId: string, reference: string, target: string, file: ChosenFile): Promise<LoadOutcome<CommandAnswer<{ receivedOn: string }>>> {
  return command(() => addEvidenceItem(sessionId, reference, target, file));
}

/** POST /applications/{id}/assertions: a claim raised on one rights layer. */
export function sendAssertion(sessionId: string, reference: string, input: ClaimInput): Promise<LoadOutcome<CommandAnswer<{ layer: RightsLayer }>>> {
  return command(() => raiseAssertion(sessionId, reference, input));
}

/** POST /applications/{id}/attestations, then /submissions: the application sent, or why not. */
export function sendAttestationAndSubmission(sessionId: string, reference: string, input: AttestInput): Promise<LoadOutcome<CommandAnswer<{ status: ApplicationStatus }>>> {
  return command(() => attestAndSubmit(sessionId, reference, input));
}

/** POST /applications/{id}/evidence-items for an item of an evidence request (SCR-REG-07). */
export function sendRequestedDocument(sessionId: string, reference: string, item: string, file: ChosenFile): Promise<LoadOutcome<CommandAnswer<{ status: ApplicationStatus }>>> {
  return command(() => addRequestedDocument(sessionId, reference, item, file));
}

/** POST /applications/{id}/withdrawals: the applicant's own withdrawal. */
export function sendWithdrawal(sessionId: string, reference: string): Promise<LoadOutcome<CommandAnswer<{ status: ApplicationStatus }>>> {
  return command(() => withdrawApplication(sessionId, reference));
}
