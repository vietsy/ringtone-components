import { createHash, randomUUID } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  ApplicationDraft,
  ApplicationKind,
  ApplicationList,
  ApplicationRecord,
  ApplicationStatus,
  ApplicationSummary,
  AttestationStep,
  AttestInput,
  CaseText,
  ChosenFile,
  ClaimInput,
  ClaimKind,
  ClaimState,
  CommandAnswer,
  CommandRefusal,
  DecisionList,
  DecisionRecord,
  DecisionSummary,
  DocumentItem,
  EvidenceStep,
  FactAnswers,
  FactQuestion,
  FactsInput,
  FactsStep,
  MissingItem,
  MusicMethod,
  Period,
  PremisesClass,
  PremisesOption,
  PreRegistration,
  RefusalStatement,
  RequiredDocument,
  ReviewOutcome,
  ReviewStep,
  RightsLayer,
  StartApplication,
  StartAttempt,
  StartInput,
  StartValues,
} from "@/lib/api/registration";
import type {
  Actor,
  AmendmentInput,
  Approvals,
  AwaitingRow,
  CaseActs,
  CaseAttestation,
  CaseClaim,
  CaseEvidence,
  CaseFact,
  CaseFile,
  CaseProposal,
  CaseRequest,
  CaseStatement,
  CaseTransition,
  ClaimOutcomeInput,
  ClaimReviewView,
  CorrectionInput,
  EndCause,
  EvidenceRequestForm,
  EvidenceRequestItem,
  EvidenceTitle,
  FactCode,
  OverBaselineRow,
  PolicyRow,
  ProposalDetail,
  ProposalForm,
  ProposalInput,
  ProposalStatus,
  ProposedOutcome,
  QueueRow,
  RegistrationPolicy,
  RegistrationReports,
  RequestState,
  ReviewQueue,
  ReviewState,
  ReviewType,
  Route,
  RuleCode,
  UseStartRecord,
  UseStartRow,
  VerdictInput,
  WithdrawalForm,
  WithdrawalInput,
} from "@/lib/api/registration-review";
import type { Staff } from "@/lib/api/session";
import type { Calculation, CalculationInput } from "@/lib/api/tariff";
import { registrationSeed, type RegistrationSeed, type SeedDocument } from "../registration";
import { REASON_NAMES, REVIEW_STATES, REVIEW_TYPES, reviewSeed, type ReviewSeed, type SeedReview, type SeedRuleVersion, type WorldPremises } from "../registration-review";
import { findAccount, organisationName } from "./accounts";
import { caseDecisionFor } from "./cases";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { recordNoticeEvent } from "./notices";
import { mayActFor, premisesActableBy, recordActUnderAuthority } from "./parties";
import { sessions, table, type StaffRole } from "./store";
import { calculateFee, changeEffectiveOn, changeReportPeriodAt, indicateFee, type FeeAnswer, type FeeClaim } from "./tariff";

/*
 * The registration family's backend (REG), as the API will behave: applications keyed by reference, each with
 * its status and history, and one function per command of `srs/02-api-contracts.md`. A command checks what the
 * contract checks, in the contract's order, and answers with the codes of `design/04-refusal-codes.md`; a
 * refused command records nothing. What a person does happens now (`clock.ts`); the seed keeps the canvas's
 * moments.
 *
 * The world holds every party's applications: Then Cửa Việt's, which its principal reads on the premises portal,
 * and the other parties' in the review queue, which only gateway staff read. A premises read is scoped to the
 * party the signed-in principal acts for (SEC-285), never the table. The console's reads and acts are scoped by
 * the member of staff's roles, and a verdict by the segregation of duties (SEC-286).
 *
 * The fee is TAR's calculator (`tariff.ts`, `calculateFee`), asked with the facts the application holds on its
 * governing date, under the rule versions effective that day. A sent application is decided at once where the rules
 * decide it (DR-285, DR-01): no claim to review, no review trigger met, every class the tariff needs answered. Any
 * other waits in review until an officer proposes and, for an adverse outcome, a second person approves.
 */

const OPEN: readonly ApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "EVIDENCE_REQUIRED"];
const IN_REVIEW: readonly ApplicationStatus[] = REVIEW_STATES;
const CLASSES: readonly PremisesClass[] = ["cafe", "restaurant", "bar", "karaoke", "hotel", "shop"];
const METHODS: readonly MusicMethod[] = ["speakers", "live", "both", "screens"];
const LAYERS: readonly RightsLayer[] = ["AUTHORS", "PERFORMERS", "PRODUCERS"];
const CAUSES = ["FACT_CHANGE_REPORTED", "APPLICANT_REQUEST"] as const;
/** The two causes only an operations officer starts an amendment for (PERM-590, DR-285 row 2). */
const OFFICER_CAUSES = ["APPEAL_OUTCOME", "CLASSIFICATION_RECONCILED"] as const;
const QUESTIONS: readonly FactQuestion[] = ["premises_class", "customer_area", "days_open", "music_method", "use_began_on"];
const OUTCOMES: readonly ProposedOutcome[] = ["DECIDED_AS_APPLIED", "DECIDED_OTHERWISE", "REFUSED"];
const CLAIM_OUTCOMES = ["ACCEPTED", "PARTLY_ACCEPTED", "NOT_ACCEPTED"] as const;

/** The review period of every review type in the canvas's `REG-REVIEW-PERIODS`: 21 days (DR-41, CFG-327's default). */
const REVIEW_DAYS = 21;
/** The payment deadline is 89 days after the day use began: 90 days counting that day (DR-23). */
const DEADLINE_DAYS = 89;
/** The evidence response period of `REG-EVIDENCE-RESPONSE` version 1: 14 calendar days (CFG-328). */
const RESPONSE_DAYS = 14;
/**
 * The rulebook and explanation versions every application of the canvas was sent under. An application started in
 * the world is governed by the versions effective on its governing date (`rulebookAt`, `explanationAt`).
 */
const RULEBOOK = "2026.2";
const EXPLANATION = 3;
/** A queue page (convention 13). */
const PAGE_SIZE = 25;
/** CFG-26: ten minutes. */
const BASELINE_SECONDS = 600;

// ---------------------------------------------------------------- the state

interface StoredDocument {
  item: DocumentItem;
  receivedOn: string | null;
  receivedAt: string | null;
  file: ChosenFile | null;
}

interface Claim {
  id: string;
  kind: ClaimKind;
  layer: RightsLayer;
  period: Period;
  state: ClaimState;
  raisedAt: string | null;
  documents: StoredDocument[];
  outcome: CaseClaim["outcome"];
}

/** A draft's steps: what SCR-REG-03 to 06 read and write. */
interface Work {
  period: Period;
  prior: string | null;
  cause: string | null;
  known: FactsStep["known"];
  questions: readonly FactQuestion[];
  answers: FactAnswers;
  copied: Partial<Record<FactQuestion, boolean>> | null;
  documents: StoredDocument[];
  /** The latest review shown (SCR-REG-05), and the answers it showed, as their digest. */
  presentation: { id: string; digest: string } | null;
  /** The latest confirmation, for the answers it confirmed. */
  attestation: { digest: string; at: string } | null;
  /**
   * What the latest review rested on (`explanation_presentations`): the rulebook and explanation versions, the
   * change-report period it quoted and TAR's calculation. A confirmation made against other versions is superseded.
   */
  shown?: { rulebook: string; explanation: number; changeReportDays: number; calculation: string | null };
  /**
   * A reported change (cause FACT_CHANGE_REPORTED): the day it occurred, the day it was reported, the date it takes
   * effect by the tariff's transition rule and whether it was reported inside the change-report period (ALG-302).
   */
  change?: { occurredOn: string; reportedOn: string; effectiveOn: string; transitionRule: string; withinPeriod: boolean; periodDays: number };
}

interface RequestItem {
  code: string;
  document: DocumentItem | null;
  description: string | null;
  receivedOn: string | null;
  file: ChosenFile | null;
}

/** An evidence request: RightOne's at submission, or a reviewer's on the console (SM-267). */
interface Request {
  askedBy: "REVIEWER" | "RIGHTONE";
  by: Actor;
  askedAt: string | null;
  askedOn: string;
  dueOn: string;
  state: RequestState;
  items: RequestItem[];
  /**
   * NTF-REG-02 as raised for the request: COM's reference, null while COM issued none (EXC-REG-02), and the day it
   * was last tried. Absent on a request the canvas draws, which no notice of this world told the applicant of: like
   * one whose notice was never raised, it does not lapse (SM-267 transition 3).
   */
  notice?: { reference: string | null; triedOn: string };
}

interface Member {
  name: string;
  email: string;
  position: string;
}

interface FeeLine {
  layer: RightsLayer;
  amountMinor: number;
  treatment: DecisionRecord["lines"][number]["treatment"];
  scope: Period | null;
}

/** TAR's fee on an outcome, the claims' treatments applied. */
interface Fee {
  lines: FeeLine[];
  totalMinor: number;
  currency: string;
  tariffVersion: string;
  /** The calculation it rests on (`tariff_calculation_ref`); null for one the canvas recorded. */
  calculation?: string | null;
  /** DR-01 rows 3 to 5: why it owes what it owes. */
  basis?: DecisionRecord["basis"];
  /** It rests on a premises class the applicant declared (DR-285 row 5). */
  declaredClass?: boolean;
  /** The transition rule of the version the calculation used (`transition_rule_ref`, DR-288 rows 3 and 4). */
  transitionRule?: Calculation["transitionRule"];
}

/** A decision proposal (SM-268). */
interface Proposal {
  id: string;
  outcome: ProposedOutcome;
  status: ProposalStatus;
  reason: string | null;
  text: string | null;
  unmet: string[];
  actionOpen: string | null;
  effectiveFrom: string | null;
  preparedBy: Member;
  preparedAt: string;
  verdict: { by: Member; at: string; note: string | null } | null;
  fee: Fee | null;
}

type Dates = NonNullable<ApplicationRecord["dates"]>;
type HistoryEntry = ApplicationRecord["history"][number];

interface Application {
  reference: string;
  premisesId: string;
  kind: ApplicationKind;
  startedByRightOne: boolean;
  status: ApplicationStatus;
  savedAt: string | null;
  sentAt: string | null;
  review: ApplicationRecord["review"];
  /** Oldest first; the latest is the one the premises reads. */
  requests: Request[];
  dates: Dates | null;
  claims: Claim[];
  /** Newest first. */
  history: HistoryEntry[];
  decision: ApplicationRecord["decision"];
  ended: ApplicationRecord["ended"];
  /** A draft's steps; null once sent, and for an application the canvas draws no steps of. */
  work: Work | null;
  // What the console reads beside it (SCR-REG-10).
  period: Period | null;
  /** The decision a renewal or a change starts from. */
  prior: string | null;
  reviewType: ReviewType | null;
  route: Route | null;
  rulebook: string;
  /** Null where the world does not hold this part of the record. */
  facts: CaseFact[] | null;
  evidence: CaseEvidence[] | null;
  attestations: CaseAttestation[] | null;
  /** Newest first. */
  statements: CaseStatement[];
  /** Newest first. */
  transitions: CaseTransition[];
  /** Oldest first. */
  proposals: Proposal[];
  /** The answers as sent, which the decision rests on and a renewal or a change copies. */
  answers: FactAnswers | null;
}

interface DecisionEntry {
  summary: DecisionSummary;
  record: DecisionRecord | null;
}

interface UseStart {
  premisesId: string;
  date: string;
  source: string;
  recordedOn: string;
  /** The class of the fact the date was decided on (FR-REG-033). */
  cls: CaseFact["cls"];
  /** The row a correction names, which stays as it was (`corrects_use_start_id`, SEC-287); null for a first date. */
  corrects: { source: string; date: string } | null;
}

/** The canvas's dates, each naming the earlier row of its premises it corrects where the date differs. */
function seededUseStarts(rows: ReviewSeed["useStarts"]): UseStart[] {
  return rows.map((row, index) => {
    const earlier = rows.slice(0, index).filter((entry) => entry.premisesId === row.premisesId).at(-1) ?? null;
    return { ...row, cls: "declared", corrects: earlier !== null && earlier.date !== row.date ? { source: earlier.source, date: earlier.date } : null };
  });
}

/** How an application ended, dated, for the outcomes report (RPT-REG-03). */
interface OutcomeEvent {
  on: string;
  kind: "DECIDED" | "REFUSED" | "WITHDRAWN" | "CLOSED";
  /** A withdrawal while an adverse proposal waited (DR-287). */
  withAdverse: boolean;
  /** The application that ended, which the report names beside a withdrawal that closed an adverse proposal. */
  reference: string;
  /** The report's split: a decision as applied for or otherwise, a withdrawal of the applicant's own or on instruction. */
  split: "AS_APPLIED" | "OTHERWISE" | "OWN" | "ON_INSTRUCTION" | null;
}

/** A step of an application on its way to a decision (`registration.step_events`, FR-REG-015). */
type StepCode = "START" | "FACTS" | "EVIDENCE" | "PREVIEW" | "ATTESTATION" | "SUBMISSION" | "EVIDENCE_WAIT_START" | "EVIDENCE_WAIT_END" | "DECISION";

interface StepEvent {
  code: StepCode;
  at: string;
}

/**
 * Why an amendment was started (`cause`, `cause_ref`) and who started it (`initiated_by_kind`): the premises, an
 * officer for an appeal outcome or a reconciliation (DR-285 row 2), or RightOne for a claim outcome.
 */
interface Amendment {
  cause: string;
  caseRef: string | null;
  decision: string;
  initiatedBy: "APPLICANT" | "OFFICER" | "SYSTEM";
  by: Actor;
}

/** DR-289 row 6: the statement written when a claim a decision charged pending is not accepted after it. */
interface ClaimStatement {
  claim: string;
  kind: ClaimKind;
  layer: RightsLayer;
  period: Period;
  reason: string;
  on: string;
}

/** A notice raised through COM: which, for what, and COM's reference, null where COM issued none (EXC-REG-02). */
interface RaisedNotice {
  kind: NoticeKind;
  occurrence: string;
  application: string;
  at: string;
  reference: string | null;
}

type NoticeKind = "NTF-REG-01" | "NTF-REG-02" | "NTF-REG-03" | "NTF-REG-04" | "NTF-REG-05";

interface State {
  seed: RegistrationSeed;
  review: ReviewSeed;
  /** Every premises of the world, with the party PTY records as operating it. */
  premises: Map<string, WorldPremises>;
  /** References, newest first: the list's order. */
  order: string[];
  applications: Map<string, Application>;
  /** Newest first: the canvas's, then those issued on the console. */
  decisions: DecisionEntry[];
  /** The facts each decision rests on, which a renewal or a change copies. */
  decisionFacts: Map<string, FactAnswers>;
  /** Oldest first. */
  useStarts: UseStart[];
  outcomes: OutcomeEvent[];
  /** The world these tables belong to: the key a notice is raised with, and another family read with. */
  world: string;
  /** Each amendment's cause and who started it, by application. */
  amendments: Map<string, Amendment>;
  /** Each application's first saved input (`first_saved_at`) and its step events, oldest first (FR-REG-015). */
  firstSaved: Map<string, string>;
  steps: Map<string, StepEvent[]>;
  /** The statements of claims not accepted after their decision, by decision. */
  claimStatements: Map<string, ClaimStatement>;
  /** Oldest first. */
  notices: RaisedNotice[];
  /** The withdrawal's reason as the applicant gave it, kept with the act (the audit record's `reason_text`). */
  withdrawalReasons: Map<string, string>;
  /** Set while time is applied, so a read the sweep makes does not start it again. */
  settling: boolean;
}

const stored = (document: SeedDocument): StoredDocument => ({
  item: document.item,
  receivedOn: document.received?.on ?? null,
  receivedAt: null,
  file: document.received?.file ?? null,
});

const claimId = (kind: ClaimKind, layer: RightsLayer) => `${layer}-${kind}`;

/** The console's moves of an application the boards draw none for: what its portal history says for certain. */
function derivedTransitions(record: ApplicationRecord, by: Actor): CaseTransition[] {
  const started = record.history.find((entry) => entry.event === "STARTED");
  return started !== undefined ? [{ at: started.at, from: null, to: "DRAFT", cause: "START", by }] : [];
}

function fromSeed(seed: RegistrationSeed, review: ReviewSeed, world: string): State {
  const premises = new Map<string, WorldPremises>();
  for (const entry of seed.premises) premises.set(entry.id, { ...entry, party: "tcv" });
  for (const entry of review.premises) premises.set(entry.id, entry);
  const trang: Actor = { name: "Đỗ Thu Trang", role: "PRINCIPAL", party: review.parties.tcv?.name ?? null };

  const applications = new Map<string, Application>();
  const add = (
    record: ApplicationRecord,
    premisesId: string,
    more: { startedByRightOne: boolean; claimDocuments: readonly (readonly SeedDocument[])[]; draft: RegistrationSeed["applications"][number]["draft"]; console: SeedReview | null; prior: string | null; by: Actor },
  ) => {
    const detail = more.console;
    const portalRequest = record.evidenceRequest;
    const requests: Request[] =
      detail?.requests !== null && detail?.requests !== undefined
        ? detail.requests.map((request) => ({ ...request, items: request.items.map((item) => ({ ...item, file: null })) }))
        : portalRequest !== null
          ? [
              {
                askedBy: portalRequest.askedBy,
                by: { name: null, role: "SYSTEM", party: null },
                askedAt: null,
                askedOn: portalRequest.askedOn,
                dueOn: portalRequest.dueOn ?? portalRequest.askedOn,
                state: portalRequest.closed ? "LAPSED" : portalRequest.dueOn === null ? "ANSWERED" : "OPEN",
                items: portalRequest.items.map((entry) => ({ code: entry.item, document: entry.document, description: entry.description, receivedOn: entry.receivedOn, file: null })),
              },
            ]
          : [];
    const draft = more.draft;
    applications.set(record.reference, {
      reference: record.reference,
      premisesId,
      kind: record.kind,
      startedByRightOne: more.startedByRightOne,
      status: record.status,
      savedAt: record.savedAt,
      sentAt: record.sentAt,
      review: record.review,
      requests,
      dates: record.dates,
      claims: record.claims.map((claim, index) => ({
        id: claimId(claim.kind, claim.layer),
        kind: claim.kind,
        layer: claim.layer,
        period: claim.period,
        state: claim.state,
        raisedAt: detail?.claimsRaisedAt[index] ?? null,
        documents: (more.claimDocuments[index] ?? []).map(stored),
        outcome: null,
      })),
      history: [...record.history],
      decision: record.decision,
      ended: record.ended,
      work:
        draft === null
          ? null
          : {
              period: draft.period,
              prior: draft.prior,
              cause: draft.cause,
              known: draft.known,
              questions: draft.questions,
              answers: { ...draft.answers },
              copied: draft.copied === null ? null : { ...draft.copied },
              documents: draft.documents.map(stored),
              presentation: null,
              attestation: null,
            },
      period: draft?.period ?? detail?.period ?? null,
      prior: draft?.prior ?? more.prior,
      reviewType: detail?.reviewType ?? null,
      route: detail?.route ?? null,
      rulebook: detail?.rulebook ?? RULEBOOK,
      facts: detail?.facts === null || detail?.facts === undefined ? null : detail.facts.map((entry) => ({ ...entry })),
      evidence: detail?.evidence === null || detail?.evidence === undefined ? null : [...detail.evidence],
      attestations: detail?.attestations === null || detail?.attestations === undefined ? null : [...detail.attestations],
      statements: [...(detail?.statements ?? [])],
      transitions: detail !== null && detail.transitions.length > 0 ? [...detail.transitions] : derivedTransitions(record, more.by),
      proposals: (detail?.proposals ?? []).map((proposal) => ({ ...proposal, unmet: [...proposal.unmet], effectiveFrom: null, verdict: null, fee: null })),
      answers: null,
    });
  };
  for (const application of seed.applications) {
    add(application.record, application.premisesId, {
      startedByRightOne: application.startedByRightOne,
      claimDocuments: application.claimDocuments,
      draft: application.draft,
      console: review.thenCua[application.reference] ?? null,
      prior: null,
      by: application.startedByRightOne ? { name: null, role: "SYSTEM", party: null } : trang,
    });
  }
  for (const other of review.others) {
    add(other.record, other.premisesId, {
      startedByRightOne: false,
      claimDocuments: [],
      draft: null,
      console: other.review,
      prior: other.prior,
      by: { name: null, role: "PRINCIPAL", party: null },
    });
  }
  return {
    seed,
    review,
    premises,
    order: [...seed.applications.map((application) => application.reference), ...review.others.map((other) => other.record.reference)],
    applications,
    // Each world's own copy of every row: superseding a decision changes its row, never the canvas's.
    decisions: seed.decisions.map((decision) => ({ summary: { ...decision.summary }, record: decision.record === null ? null : { ...decision.record } })),
    decisionFacts: new Map(Object.entries(seed.decisionFacts)),
    useStarts: seededUseStarts(review.useStarts),
    outcomes: [],
    world,
    amendments: new Map([
      ...seed.applications.flatMap((entry): [string, Amendment][] =>
        entry.draft?.cause !== null && entry.draft?.cause !== undefined && entry.draft.prior !== null
          ? [[entry.reference, { cause: entry.draft.cause, caseRef: null, decision: entry.draft.prior, initiatedBy: entry.startedByRightOne ? "SYSTEM" : "APPLICANT", by: entry.startedByRightOne ? { name: null, role: "SYSTEM", party: null } : trang }]]
          : [],
      ),
      // Another party's change in review is its own report of a changed fee-determining fact (the Mây Sông hotel's
      // customer area, which the inspection board draws as a reported change waiting for its decision, FR-REG-040).
      ...review.others.flatMap((other): [string, Amendment][] =>
        other.record.kind === "AMENDMENT" && other.prior !== null
          ? [[other.record.reference, { cause: "FACT_CHANGE_REPORTED", caseRef: null, decision: other.prior, initiatedBy: "APPLICANT", by: { name: null, role: "PRINCIPAL", party: null } }]]
          : [],
      ),
    ]),
    firstSaved: new Map(),
    steps: new Map(),
    claimStatements: new Map(),
    notices: [],
    withdrawalReasons: new Map(),
    settling: false,
  };
}

/**
 * The world's registration state, seeded from the canvas the first time it is read, with what has arrived since it
 * was last read applied (`settle`).
 */
function state(key: string): State {
  const s = table(key, "registration", () => fromSeed(registrationSeed(), reviewSeed(), sessions().get(key)?.world ?? key));
  settle(s);
  return s;
}

// ---------------------------------------------------------------- answers

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const accept = <T,>(accepted: T): CommandAnswer<T> => ({ accepted, refusal: null });

function refuse(code: string, more: Partial<Omit<CommandRefusal, "code">> = {}): CommandAnswer<never> {
  return {
    accepted: null,
    refusal: { code, field: null, openApplication: null, governingDecision: null, missing: [], fieldErrors: {}, ...more },
  };
}

const premisesOption = (s: State, id: string): PremisesOption => ({ id, name: s.premises.get(id)?.name ?? id });
const premisesName = (s: State, id: string): string => premisesOption(s, id).name;
const partyOfPremises = (s: State, id: string): string | null => s.premises.get(id)?.party ?? null;

// ---------------------------------------------------------------- who is asking

/**
 * The party the signed-in principal acts for, read from the session as the API reads the token: the premises
 * portal reads and acts only for that party's premises (SEC-285).
 */
function actingParty(sessionId: string): string | null {
  return sessions().get(sessionId)?.organisation ?? null;
}

/**
 * The premises the person signed in may act for: the party's premises that PTY's register lets them read now (DR-201) -
 * every one its party operates for the principal, the ones a delegate's authority names for a delegate.
 */
function actsFor(s: State, sessionId: string): ReadonlySet<string> {
  const party = actingParty(sessionId);
  const actable = new Set(premisesActableBy(sessionId).flatMap((premises) => premises.ids));
  return new Set([...s.premises.values()].filter((entry) => entry.party === party && actable.has(entry.id)).map((entry) => entry.id));
}

/** The principal as the record names them: the account's name, for the party they act for. */
function principalOf(sessionId: string): Actor {
  const session = sessions().get(sessionId);
  const name = session !== undefined ? (findAccount(session.email)?.name ?? null) : null;
  const party = session?.organisation ?? null;
  return { name, role: "PRINCIPAL", party: party !== null ? organisationName(party) : null };
}

const holds = (staff: Staff, ...roles: readonly StaffRole[]): boolean => roles.some((role) => staff.roles.includes(role));
const memberOf = (staff: Staff): Member => ({ name: staff.account, email: staff.email, position: staff.position });
const officer = (staff: Staff): Actor => ({ name: staff.account, role: "OFFICER", party: null });
const RIGHTONE: Actor = { name: null, role: "SYSTEM", party: null };

// ---------------------------------------------------------------- finding records

/** The application, or why it cannot be read: a reference the world does not hold is not found. */
function find(s: State, ref: string): Application | null {
  return s.applications.get(ref) ?? null;
}

/** The principal's application: one of another party's premises is not found, never disclosed. */
function findMine(s: State, sessionId: string, ref: string): Application | null {
  const application = find(s, ref);
  return application !== null && actsFor(s, sessionId).has(application.premisesId) ? application : null;
}

/**
 * The application SCR-REG-07 reads and withdraws, with the contract's two refusals kept apart: not found for a
 * reference the world does not hold or another party's application, which is never disclosed; NOT_AUTHORISED_FOR_PREMISES
 * for one of the party's own premises PTY does not let this person act for, a delegate outside the delegation (R4.5).
 */
function ownApplication(s: State, sessionId: string, ref: string): Application | { code: "APPLICATION_NOT_FOUND" | "NOT_AUTHORISED_FOR_PREMISES" } {
  const application = find(s, ref);
  if (application === null || partyOfPremises(s, application.premisesId) !== actingParty(sessionId)) return { code: "APPLICATION_NOT_FOUND" };
  return actsFor(s, sessionId).has(application.premisesId) ? application : { code: "NOT_AUTHORISED_FOR_PREMISES" };
}

/** A draft and its steps, or the refusal a step answers: not found, or not editable once sent. */
function draftOf(s: State, sessionId: string, ref: string): { application: Application; work: Work } | { code: string } {
  const application = findMine(s, sessionId, ref);
  if (application === null) return { code: "APPLICATION_NOT_FOUND" };
  if (application.status !== "DRAFT" || application.work === null) return { code: "APPLICATION_NOT_EDITABLE" };
  return { application, work: application.work };
}

const decisionOf = (s: State, ref: string): DecisionEntry | null => s.decisions.find((entry) => entry.summary.reference === ref) ?? null;
const latestRequest = (application: Application): Request | null => application.requests[application.requests.length - 1] ?? null;
const openRequest = (application: Application): Request | null => application.requests.find((request) => request.state === "OPEN") ?? null;
const pendingProposal = (application: Application): Proposal | null => application.proposals.find((proposal) => proposal.status === "PENDING_APPROVAL") ?? null;

// ---------------------------------------------------------------- notices, steps, and what arrives with time

/**
 * The event each notice is raised on, under the class `CFG-161` names for it (frd/08): the acknowledgement, the
 * evidence request, the decision, the expected decision date, and the decision class again for a closure.
 */
const NOTICE_EVENTS: Readonly<Record<NoticeKind, string>> = {
  "NTF-REG-01": "application_submitted",
  "NTF-REG-02": "application_evidence_requested",
  "NTF-REG-03": "application_decided",
  "NTF-REG-04": "decision_date_expected",
  "NTF-REG-05": "application_closed_incomplete",
};

/**
 * Raises a notice through COM (`INoticeObligations.Raise`), after the act it tells of, keyed by the notice and the
 * row it tells about, to the party operating the premises. COM answers with the notice it issued, or none where the
 * policy in force states no class for the event: that is EXC-REG-02, the reference stays null and the act stands.
 */
function raiseNotice(s: State, application: Application, kind: NoticeKind, occurrence: string, facts: Readonly<Record<string, string | number>> & { by: string }): string | null {
  const at = now();
  const notice = recordNoticeEvent(s.world, {
    sourceModule: "REG",
    eventKind: NOTICE_EVENTS[kind],
    occurrenceRef: `${kind}/${occurrence}`,
    occurredAt: at,
    subjectKind: "application",
    subjectRef: application.reference,
    recipientPartyId: partyOfPremises(s, application.premisesId),
    destination: null,
    facts: { application: application.reference, premises: premisesName(s, application.premisesId), ...facts },
  });
  s.notices.push({ kind, occurrence, application: application.reference, at, reference: notice });
  return notice;
}

/** NTF-REG-04: the completeness date and the expected decision date of a statement just made (DR-41 rows 1 to 3 and 5). */
function tellDates(s: State, application: Application, row: CaseStatement): void {
  const restated = application.statements.length > 1;
  raiseNotice(s, application, "NTF-REG-04", `${application.reference}@${row.statedAt ?? now()}`, {
    completeOn: row.completeOn ?? "",
    expectedOn: row.expectedOn ?? "",
    reviewType: row.reviewType ?? "",
    deadline: row.deadline,
    afterDeadline: row.expectedOn !== null && row.expectedOn > row.deadline ? "yes" : "no",
    restated: restated ? "yes" : "no",
    by: row.expectedOn ?? row.deadline,
  });
}

/**
 * NTF-REG-02 for an open request: each item and the due date. A notice first raised on a later day than the request
 * gives the applicant the whole response period from that day, so the due date is restated (Q-REG-13); a raise COM
 * answers with no notice leaves the request untold, to be tried again the next day.
 */
function tellOfRequest(s: State, application: Application, request: Request): void {
  const day = today();
  const dueOn = day > request.askedOn ? addDays(day, RESPONSE_DAYS) : request.dueOn;
  const index = application.requests.indexOf(request) + 1;
  const notice = raiseNotice(s, application, "NTF-REG-02", `${application.reference}/request-${String(index)}`, {
    items: request.items.map((item) => item.description ?? item.document ?? item.code).join("; "),
    dueOn,
    by: dueOn,
  });
  request.notice = { reference: notice, triedOn: day };
  if (notice !== null) request.dueOn = dueOn;
}

/** The notices a submission raises once it has committed: the acknowledgement, then the dates of one routed to review, or the request of one waiting on evidence. */
function noticesOnSubmission(s: State, application: Application): void {
  const latest = application.statements[0] ?? null;
  const open = openRequest(application);
  raiseNotice(s, application, "NTF-REG-01", application.reference, {
    status: application.status,
    receivedAt: application.sentAt ?? now(),
    queue: application.reviewType ?? "",
    by: latest?.expectedOn ?? open?.dueOn ?? today(),
  });
  if (application.status === "UNDER_REVIEW" && latest !== null) tellDates(s, application, latest);
  if (application.status === "EVIDENCE_REQUIRED" && open !== null && open.notice === undefined) tellOfRequest(s, application, open);
}

/** A step event of an application (`registration.step_events`): the steps its time is measured and named by (FR-REG-015). */
function recordStep(s: State, application: Application, code: StepCode, at: string): void {
  const steps = s.steps.get(application.reference) ?? [];
  steps.push({ code, at });
  s.steps.set(application.reference, steps);
}

/** An input the applicant saved: the first one starts the clock, and is kept once, whatever is saved after it (FR-REG-002, FR-REG-015). */
function saved(s: State, application: Application, code: StepCode, at: string): void {
  if (!s.firstSaved.has(application.reference)) s.firstSaved.set(application.reference, at);
  application.savedAt = at;
  recordStep(s, application, code, at);
}

/** 00:00 Vietnam time on a day, as an instant. */
const startOfDay = (day: string): string => new Date(`${day}T00:00:00+07:00`).toISOString();

/**
 * SM-01 transition 7 with SM-267 transition 3, as `Registration.LapseEvidenceRequests` applies them at its first run on
 * the day after the due date: the request lapses, the application closes incomplete (counted apart from refusals and
 * withdrawals), the wait on the applicant ends, and NTF-REG-05 names what was not supplied. A claim under review
 * keeps its state: no withdrawal was made.
 */
function lapse(s: State, application: Application, request: Request): void {
  const on = addDays(`${request.dueOn}T12:00:00+07:00`, 1);
  const at = startOfDay(on);
  request.state = "LAPSED";
  application.status = "CLOSED_INCOMPLETE";
  application.ended = { kind: "CLOSED_INCOMPLETE", on };
  application.history.unshift({ at, event: "CLOSED" });
  application.transitions.unshift({ at, from: "EVIDENCE_REQUIRED", to: "CLOSED_INCOMPLETE", cause: "LAPSE", by: RIGHTONE });
  recordStep(s, application, "EVIDENCE_WAIT_END", at);
  s.outcomes.push({ on, kind: "CLOSED", withAdverse: false, reference: application.reference, split: null });
  const missing = request.items.filter((item) => item.receivedOn === null).map((item) => item.description ?? item.document ?? item.code);
  raiseNotice(s, application, "NTF-REG-05", `${application.reference}/CLOSED_INCOMPLETE`, { missing: missing.join("; "), dueOn: request.dueOn, by: on });
}

/**
 * What arrives with time, applied when the tables are read, as the two jobs would have applied it: a request whose
 * notice COM did not issue is raised again, once a day (`Registration.WatchReviewPeriods`); a request past its due
 * date that the applicant was told of lapses (`Registration.LapseEvidenceRequests`). A request the applicant was never
 * told of does not lapse (@AC-FR-REG-037-07).
 */
function settle(s: State): void {
  if (s.settling) return;
  s.settling = true;
  try {
    const day = today();
    for (const application of s.applications.values()) {
      const request = application.status === "EVIDENCE_REQUIRED" ? openRequest(application) : null;
      if (request?.notice === undefined) continue;
      if (request.notice.reference === null && request.notice.triedOn < day) tellOfRequest(s, application, request);
      if (request.notice.reference !== null && day > request.dueOn) lapse(s, application, request);
    }
  } finally {
    s.settling = false;
  }
}

// ---------------------------------------------------------------- dates

/** The day before the same date a year later: a period of one year, as SCR-REG-02 prefills it. */
function yearFrom(from: string): string {
  const [y, m, d] = from.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return from;
  return addDays(new Date(Date.UTC(y + 1, m - 1, d)).toISOString(), -1);
}

const overlaps = (a: Period, b: Period) => a.from <= b.to && a.to >= b.from;

/** Calendar days from one ISO date to another, counting both. */
function daysIn(period: Period): number {
  const from = Date.parse(`${period.from}T00:00:00Z`);
  const to = Date.parse(`${period.to}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000) + 1;
}

/**
 * The first decision of the premises that governs a day of the period: a current decision governs its period, a
 * replaced one the days before its successor takes effect (ALG-262 g3).
 */
function governingDecision(s: State, premisesId: string, period: Period): string | null {
  for (const { summary } of s.decisions) {
    if (summary.premises.id !== premisesId) continue;
    const governs =
      summary.status === "CURRENT"
        ? summary.period
        : summary.replacedBy !== null
          ? { from: summary.period.from, to: addDays(summary.replacedBy.from, -1) }
          : null;
    if (governs !== null && governs.from <= governs.to && overlaps(period, governs)) return summary.reference;
  }
  return null;
}

// ---------------------------------------------------------------- the steps' rules

const answerOf = (answers: FactAnswers, question: FactQuestion): string | number | null => {
  switch (question) {
    case "premises_class":
      return answers.premisesClass;
    case "customer_area":
      return answers.customerArea;
    case "days_open":
      return answers.daysOpen;
    case "music_method":
      return answers.musicMethod;
    case "use_began_on":
      return answers.useBeganOn;
  }
};

/** Every item still needed before the review (ALG-260 `remaining`): unanswered facts, then documents, then claims'. */
function missingItems(application: Application, work: Work): MissingItem[] {
  return [
    ...work.questions.filter((question) => answerOf(work.answers, question) === null).map((question) => ({ for: "FACTS" as const, question })),
    ...work.documents.filter((document) => document.receivedOn === null).map((document) => ({ for: "RULES" as const, item: document.item })),
    ...application.claims
      .filter((claim) => claim.state === "DRAFT")
      .flatMap((claim) =>
        claim.documents.filter((document) => document.receivedOn === null).map((document) => ({ for: "CLAIM" as const, item: document.item, layer: claim.layer })),
      ),
  ];
}

/** The digest of the answers a review showed and a confirmation confirms (`facts_digest`). */
function digest(work: Work): string {
  return createHash("sha256").update(JSON.stringify({ answers: work.answers, copied: work.copied })).digest("hex");
}

// ---------------------------------------------------------------- the rule versions, the time before registration, the fee

/** The version of a registration rule in force on a day (`IRuleVersionResolver.Resolve`), or none approved. */
function versionAt(s: State, rule: RuleCode, day: string): SeedRuleVersion | null {
  return [...s.review.policy].filter((entry) => entry.rule === rule && entry.from <= day).sort((a, b) => a.from.localeCompare(b.from)).pop() ?? null;
}

/** `REG-OBLIGATION-RULEBOOK` on a governing date (CFG-325): 2026.2 from 1 September 2026, 2026.3 from 1 November. */
const rulebookAt = (s: State, day: string): string | null => versionAt(s, "REG-OBLIGATION-RULEBOOK", day)?.id ?? null;

/** `REG-EXPLANATION` on a governing date (CFG-326), by its number; null while none is approved. */
function explanationAt(s: State, day: string): number | null {
  const id = versionAt(s, "REG-EXPLANATION", day)?.id ?? null;
  return id !== null && /^\d+$/.test(id) ? Number(id) : null;
}

/** The governing date (DR-288 row 3): the first day the application covers, on which every version is resolved. */
const governingOn = (work: Work): string => work.period.from;

/**
 * What the rulebook asks once an application is sent (`AFTER_SUBMISSION`, DR-01 row 8): nothing in 2026.2, whose
 * documents the Sala draft asks before sending, nor in 2026.3, whose content no board draws, so it asks what 2026.2 asks.
 */
const AFTER_SUBMISSION: readonly DocumentItem[] = [];

/**
 * DR-22 for an application on the day it is registered: a renewal or an amendment, and use that began on or after
 * registration, have no earlier time to decide (row 1); a first registration inside the amnesty in force that day owes
 * nothing for it, and the amnesty version is recorded (row 2); otherwise, with no `REG-PRE-REGISTRATION` version
 * approved, nothing is raised for that time and the use-start date is kept (row 3). The registration date is the day
 * the premises' first new application was sent, or this one's.
 */
function preRegistrationOf(s: State, application: Application, useBeganOn: string, day: string): PreRegistration {
  const sentOn = [...s.applications.values()]
    .filter((entry) => entry.premisesId === application.premisesId && entry.kind === "NEW" && entry.status === "DECIDED" && entry.sentAt !== null && entry !== application)
    .map((entry) => addDays(entry.sentAt ?? day, 0))
    .sort();
  const registeredOnDay = sentOn[0] ?? day;
  if (application.kind !== "NEW" || useBeganOn >= registeredOnDay) return { treatment: "NO_PRE_REGISTRATION_PERIOD", amnesty: null };
  const first = !s.decisions.some((entry) => entry.summary.premises.id === application.premisesId);
  const amnesty = versionAt(s, "REG-AMNESTY-PERIOD", registeredOnDay)?.amnesty ?? null;
  const version = versionAt(s, "REG-AMNESTY-PERIOD", registeredOnDay)?.id ?? null;
  if (first && amnesty !== null && version !== null && amnesty.period.from <= registeredOnDay && registeredOnDay <= amnesty.period.to) {
    return { treatment: "AMNESTY_APPLIED", amnesty: { version, period: amnesty.period } };
  }
  // Row 4 waits for a REG-PRE-REGISTRATION version (DEC-13), and none is approved.
  return { treatment: "DEC13_NOT_EFFECTIVE", amnesty: null };
}

/**
 * The facts REG sends TAR (srs/07): the register's area and class, with their provenance, then what the premises
 * declared. A class the register answers is the register's; one it does not is the declared one (DR-285 row 5).
 */
function feeInputs(s: State, premisesId: string, answers: FactAnswers, declaredClass: boolean): CalculationInput[] {
  const register = s.seed.register.premises[premisesId] ?? null;
  const inputs: CalculationInput[] = [];
  if (register !== null) inputs.push({ fact: "admin_area", value: register.administrativeArea, source: "register" });
  if (!declaredClass && register?.premisesClass !== null && register?.premisesClass !== undefined) {
    inputs.push({ fact: "premises_class", value: register.premisesClass, source: "register" });
  } else if (answers.premisesClass !== null) inputs.push({ fact: "premises_class", value: answers.premisesClass, source: "declared" });
  if (answers.customerArea !== null) inputs.push({ fact: "customer_area", value: answers.customerArea, source: "declared" });
  if (answers.daysOpen !== null) inputs.push({ fact: "days_open", value: answers.daysOpen, source: "declared" });
  if (answers.musicMethod !== null) inputs.push({ fact: "music_method", value: answers.musicMethod, source: "declared" });
  if (answers.useBeganOn !== null) inputs.push({ fact: "use_began_on", value: answers.useBeganOn, source: "declared" });
  return inputs;
}

/**
 * The claims as the calculator reads them. A drafted claim is the one a submission sends to review under the tested
 * default of `CFG-08` (no straight-through rule), so a review shows it as the decision will treat it: pending.
 */
function feeClaims(application: Application): FeeClaim[] {
  return application.claims
    .filter((claim) => claim.state !== "WITHDRAWN")
    .map((claim) => ({
      ref: `${application.reference}/${claim.id}`,
      layer: claim.layer,
      period: claim.period,
      state: claim.state === "DRAFT" ? "UNDER_REVIEW" : claim.state,
      accepted: claim.outcome?.scope ?? null,
    }));
}

/** TAR's calculator for an application's facts on its governing date; `record` false asks without recording (a form's figures). */
function askTariff(s: State, application: Application, answers: FactAnswers, declaredClass: boolean, period: Period, record = true, claims: readonly FeeClaim[] = feeClaims(application)): FeeAnswer {
  const question = {
    application: application.reference,
    premisesId: application.premisesId,
    decisionDate: period.from,
    obligationPeriod: period,
    inputs: feeInputs(s, application.premisesId, answers, declaredClass),
    claims,
  };
  return record ? calculateFee(s.world, question) : indicateFee(s.world, question);
}

/** A share of an amount for each part of a period, by its days, the dong left over to the longest part. */
function splitByDays(amountMinor: number, parts: readonly Period[]): number[] {
  const days = parts.map((part) => daysIn(part));
  const total = days.reduce((sum, value) => sum + value, 0);
  if (total === 0) return parts.map(() => 0);
  const shares = days.map((value) => Math.floor((amountMinor * value) / total));
  const longest = days.indexOf(Math.max(...days));
  shares[longest] = (shares[longest] ?? 0) + amountMinor - shares.reduce((sum, value) => sum + value, 0);
  return shares;
}

/**
 * The fee TAR's calculation comes to, each component's treatment applied as DR-289 reads it: a pending claim's layer
 * charged and marked so (row 2); an exempt or mandate-stopped component kept as calculated whatever the claim (row
 * 1b); a whole acceptance at 0 (row 3); a partial one as the accepted scope at 0 beside the rest charged at TAR's
 * amount (row 5). Null where TAR gave no amount: the premises not classified by the tariff (DR-01 row 7).
 */
function feeOf(calc: Calculation, application: Application, period: Period): Fee | null {
  const declaredClass = calc.classification.premisesClass.basis === "DECLARED";
  const base = { currency: "VND", tariffVersion: calc.version, calculation: calc.reference === "" ? null : calc.reference, declaredClass, transitionRule: calc.transitionRule };
  if (calc.classification.scope === "OUT_OF_SCOPE") {
    return { ...base, lines: LAYERS.map((layer) => ({ layer, amountMinor: 0, treatment: null, scope: null })), totalMinor: 0, basis: "OUT_OF_SCOPE" };
  }
  if (calc.classification.scope !== "IN_SCOPE" || calc.amountMinor === null) return null;
  const lines = calc.components.flatMap((component): FeeLine[] => {
    const charged: FeeLine = { layer: component.layer, amountMinor: component.amountMinor, treatment: component.claimPending ? "CLAIM_PENDING" : null, scope: null };
    switch (component.treatment) {
      case "EXEMPT":
        return [{ ...charged, amountMinor: 0, treatment: "EXEMPT" }];
      case "EXCLUDED_MANDATE_STOPPED":
        return [{ ...charged, amountMinor: 0, treatment: "MANDATE_STOPPED" }];
      case "EXCLUDED_CLAIM_ACCEPTED":
        return [{ ...charged, amountMinor: 0, treatment: "CLAIM_ACCEPTED" }];
      case "REDUCED_CLAIM_ACCEPTED": {
        const claim = application.claims.find((entry) => entry.layer === component.layer && (entry.state === "ACCEPTED" || entry.state === "PARTLY_ACCEPTED"));
        const scope = claim?.state === "PARTLY_ACCEPTED" ? (claim.outcome?.scope ?? claim.period) : (claim?.period ?? null);
        if (scope === null) return [charged];
        const accepted: Period = { from: scope.from > period.from ? scope.from : period.from, to: scope.to < period.to ? scope.to : period.to };
        const rest: Period[] = [
          ...(accepted.from > period.from ? [{ from: period.from, to: addDays(accepted.from, -1) }] : []),
          ...(accepted.to < period.to ? [{ from: addDays(accepted.to, 1), to: period.to }] : []),
        ];
        const amounts = splitByDays(component.amountMinor, rest);
        const restLines = rest.map((part, i): FeeLine => ({ ...charged, amountMinor: amounts[i] ?? 0, scope: part }));
        // In the order of the period: what is charged before the accepted scope, the scope at 0, what is charged after.
        return [...restLines, { ...charged, amountMinor: 0, treatment: "CLAIM_ACCEPTED" as const, scope: accepted }].sort((a, b) => (a.scope?.from ?? "").localeCompare(b.scope?.from ?? ""));
      }
      default:
        return [charged];
    }
  });
  const totalMinor = calc.amountMinor;
  const micro = calc.exemptions.find((exemption) => exemption.code === "MICRO_BUSINESS" && exemption.applied) !== undefined;
  // DR-01 row 4: owing nothing under a valid rule names the exemption it rests on.
  const basis: DecisionRecord["basis"] = totalMinor > 0 ? "TARIFF" : micro ? "MICRO_BUSINESS_EXEMPTION" : "EXEMPTION";
  return { ...base, lines, totalMinor, basis };
}

/** DR-285's answer for a submission: the route, the review type and the reason (rows 1, 3, 3b, 5 and 6; DR-01 row 7 first). */
interface RouteAnswer {
  route: Route;
  reviewType: ReviewType | null;
  reason: "INDETERMINATE_FACTS" | "CLAIM_NEEDS_REVIEW" | "OFFICER_AMENDMENT" | "RULEBOOK_TRIGGER" | "DECLARED_CLASSIFICATION" | "STRAIGHT_THROUGH";
}

/**
 * Which route a submitted application takes. A premises the tariff could not classify goes to the rulebook-exception
 * queue whatever else sent it there (DR-01 row 7, DR-285 row 3b); a claim no straight-through rule of `CFG-08` covers
 * goes to claim review (row 1, the tested default for every claim); a review trigger of the rulebook goes to the
 * rulebook-exception queue (row 3: rulebook 2026.2's CLASSIFICATION_CHANGED, the register having changed the class
 * since the decision renewed). Anything else is decided at once, a declared class included (rows 5 and 6).
 */
function routeOf(application: Application, work: Work, calc: Calculation): RouteAnswer {
  if (calc.classification.scope === "INDETERMINATE") return { route: "MANUAL", reviewType: "RULEBOOK_EXCEPTION", reason: "INDETERMINATE_FACTS" };
  if (application.claims.some((claim) => claim.state === "DRAFT")) return { route: "MANUAL", reviewType: "ASSERTION", reason: "CLAIM_NEEDS_REVIEW" };
  // Row 2: an officer's amendment keeps the route and review type stamped when it was started, whoever sends it.
  if (application.kind === "AMENDMENT" && application.route === "MANUAL" && application.reviewType === "AMENDMENT") return { route: "MANUAL", reviewType: "AMENDMENT", reason: "OFFICER_AMENDMENT" };
  if (work.known.classChanged) return { route: "MANUAL", reviewType: "RULEBOOK_EXCEPTION", reason: "RULEBOOK_TRIGGER" };
  return { route: "AUTOMATED", reviewType: null, reason: calc.classification.premisesClass.basis === "DECLARED" ? "DECLARED_CLASSIFICATION" : "STRAIGHT_THROUGH" };
}

/** DR-01 as a review shows it: what a submission now comes to. */
function outcomeOf(route: RouteAnswer, fee: Fee | null): ReviewOutcome {
  if (route.reason === "INDETERMINATE_FACTS" || route.reason === "CLAIM_NEEDS_REVIEW" || route.reason === "OFFICER_AMENDMENT" || route.reason === "RULEBOOK_TRIGGER") return { kind: "UNDER_REVIEW", reason: route.reason };
  if (fee === null || fee.totalMinor > 0) return { kind: "PAYABLE" };
  return { kind: "NO_PAYABLE_OBLIGATION", basis: fee.basis === "OUT_OF_SCOPE" || fee.basis === "MICRO_BUSINESS_EXEMPTION" ? fee.basis : "EXEMPTION" };
}

/** The micro-business criteria a review shows: those of an exemption that applied, so nothing is owed (DR-291 row 1). */
function exemptionShown(calc: Calculation): ReviewStep["exemption"] {
  const micro = calc.exemptions.find((exemption) => exemption.code === "MICRO_BUSINESS") ?? null;
  return micro !== null && micro.applied ? micro.criteria.map((criterion) => ({ criterion: criterion.fact, met: criterion.met, atMost: criterion.atMost, value: criterion.value })) : null;
}

const toRequired = (document: StoredDocument): RequiredDocument =>
  document.receivedOn !== null && document.file !== null
    ? { item: document.item, status: { state: "RECEIVED", receivedOn: document.receivedOn, file: { name: document.file.name, sizeBytes: document.file.sizeBytes } } }
    : { item: document.item, status: { state: "NEEDED", refusal: null } };

/** A file the document store would refuse: empty, or of no media type (SEC-290). The mock keeps no content to check further. */
const invalidFile = (file: ChosenFile) => file.sizeBytes <= 0 || file.type.trim() === "" || file.name.trim() === "";

/**
 * The last four characters of a document's SHA-256 digest. The mock keeps no file, only what the browser said of
 * it, so the digest is of that: a reference that tells one document from another on the case file.
 */
function fileDigest(ref: string, slot: string, file: ChosenFile, at: string): string {
  return createHash("sha256").update([ref, slot, file.name, file.type, String(file.sizeBytes), at].join("|")).digest("hex").slice(-4);
}

/** The expected-date statement for an application complete on a day (DR-41 rows 1 to 3). */
function statement(completeOn: string, useBeganOn: string): Dates {
  const paymentDeadline = addDays(useBeganOn, DEADLINE_DAYS);
  const decisionExpectedBy = addDays(completeOn, REVIEW_DAYS);
  const passedWhenComplete = completeOn > paymentDeadline;
  return {
    completeOn,
    decisionExpectedBy,
    reset: false,
    paymentDeadline,
    useBeganOn,
    // Row 2: told on the day of the statement, before the deadline passes. Row 3 says so in its own words.
    toldOn: !passedWhenComplete && decisionExpectedBy > paymentDeadline ? today() : null,
    passedWhenComplete,
  };
}

/** The console's row of a statement just made: when, the dates, and whether the applicant was told. */
function statementRow(application: Application, dates: Dates, at: string): CaseStatement {
  return {
    statedAt: at,
    completeOn: dates.completeOn,
    expectedOn: dates.decisionExpectedBy,
    reviewType: application.reviewType,
    periodDays: REVIEW_DAYS,
    deadline: dates.paymentDeadline,
    toldAt: dates.toldOn !== null ? at : null,
    restatedOnAnswer: false,
  };
}

// ---------------------------------------------------------------- the premises portal: reads

/**
 * The premises a principal acts for: their party's. Other families ask it with a world or a staff session, which
 * acts for no party; they read the premises of the canvas's principal, as they always have.
 */
export function premisesActedFor(key: string): LoadOutcome<readonly PremisesOption[]> {
  const s = state(key);
  const party = actingParty(key);
  if (party === null) return ok(s.seed.premises);
  const mine = actsFor(s, key);
  return ok(s.seed.premises.filter((premises) => partyOfPremises(s, premises.id) === party && mine.has(premises.id)));
}

function summary(s: State, application: Application): ApplicationSummary {
  const request = latestRequest(application);
  return {
    reference: application.reference,
    premises: premisesOption(s, application.premisesId),
    kind: application.kind,
    status: application.status,
    startedByRightOne: application.startedByRightOne,
    savedAt: application.savedAt,
    sentAt: application.sentAt,
    evidence: application.status === "EVIDENCE_REQUIRED" && request !== null && request.state === "OPEN" ? { askedOn: request.askedOn, dueOn: request.dueOn } : null,
    decision: application.decision?.reference ?? null,
  };
}

/** GET /applications: newest first, for one premises or every premises the person acts for. */
export function applicationList(sessionId: string, premisesId: string | null): LoadOutcome<ApplicationList> {
  const s = state(sessionId);
  const mine = actsFor(s, sessionId);
  const items = s.order
    .map((ref) => s.applications.get(ref))
    .filter((application): application is Application => application !== undefined && mine.has(application.premisesId) && (premisesId === null || application.premisesId === premisesId))
    .map((application) => summary(s, application));
  return ok({ items, hasMore: false, moreRefused: null });
}

/** GET /obligation-decisions. A claim decided since the decision no longer reads as pending. */
export function decisionList(sessionId: string, premisesId: string | null): LoadOutcome<DecisionList> {
  const s = state(sessionId);
  const mine = actsFor(s, sessionId);
  const items = s.decisions
    .filter(({ summary }) => mine.has(summary.premises.id) && (premisesId === null || summary.premises.id === premisesId))
    .map((decision) => summaryNow(s, decision));
  return ok({ items, hasMore: false });
}

/** GET /obligation-decisions/{id}. The canvas draws OBD-2YDA7KMS5X only as a list row, so its record cannot be read. */
export function decisionRecord(sessionId: string, ref: string): LoadOutcome<DecisionRecord> {
  const s = state(sessionId);
  const decision = decisionOf(s, ref);
  const record = decision !== null && actsFor(s, sessionId).has(decision.summary.premises.id) ? decision.record : null;
  return record !== null && decision !== null ? ok(recordNow(s, decision, record)) : refusedRead("DECISION_NOT_FOUND");
}

/** DR-23: the deadline counted from the use-start date (row 1), and whether a day falls within it (row 2) or after it (row 3). */
function deadlineOf(record: Pick<DecisionRecord, "useBeganOn" | "payBy">, day: string): DecisionRecord["deadline"] {
  const on = record.useBeganOn !== null ? addDays(record.useBeganOn, DEADLINE_DAYS) : record.payBy;
  return on === null ? null : { on, state: day <= on ? "WITHIN_DEADLINE" : "PAST_DEADLINE" };
}

/**
 * The claim a decision charged pending, as it stands now (`claim_pending` is the claim's current SM-266 state, the
 * record keeping what it was at issue): still pending while the claim is in review; once not accepted, the statement
 * DR-289 row 6 wrote; once accepted, nothing, for the amendment that superseded the decision carries it.
 */
function claimNow(s: State, record: DecisionRecord): DecisionRecord["claim"] {
  if (record.claim?.state !== "UNDER_REVIEW") return record.claim;
  const application = record.application !== null ? find(s, record.application) : null;
  // A decision the canvas draws without its application keeps the claim as it was issued.
  if (application === null) return record.claim;
  if (application.claims.some((claim) => claim.state === "UNDER_REVIEW")) return record.claim;
  const statement = s.claimStatements.get(record.reference);
  return statement !== undefined
    ? { state: "NOT_ACCEPTED", kind: statement.kind, layer: statement.layer, period: statement.period, reason: reasonWords(statement.reason), on: statement.on }
    : null;
}

/** A decision as it reads now: what was decided, with its claim, its deadline state today and the decision it follows. */
function recordNow(s: State, entry: DecisionEntry, record: DecisionRecord): DecisionRecord {
  return { ...record, claim: claimNow(s, record), deadline: deadlineOf(record, today()), prior: record.prior ?? entry.summary.replaces };
}

/** A list row as it reads now: a claim decided since is no longer pending, and one not accepted makes the decision otherwise than applied for. */
function summaryNow(s: State, entry: DecisionEntry): DecisionSummary {
  if (entry.summary.note !== "CLAIM_PENDING" || entry.record === null) return entry.summary;
  const claim = claimNow(s, entry.record);
  return claim?.state === "UNDER_REVIEW" ? entry.summary : { ...entry.summary, note: claim?.state === "NOT_ACCEPTED" ? "OTHERWISE" : null };
}

/** SCR-REG-02's form: a first registration from today for a year, or as the last attempt left it. */
export function startForm(sessionId: string, party: string, attempt: StartAttempt | null): LoadOutcome<StartApplication> {
  const s = state(sessionId);
  const mine = actsFor(s, sessionId);
  const premises = s.seed.premises.filter((entry) => mine.has(entry.id));
  const day = today();
  const only = premises.length === 1 ? (premises[0]?.id ?? null) : null;
  return ok({
    today: day,
    party,
    premises,
    values: attempt?.values ?? { premisesId: only, kind: "NEW", prior: null, cause: null, period: { from: day, to: yearFrom(day) } },
    refusal: attempt?.refusal ?? null,
    fieldError: attempt?.fieldError ?? null,
  });
}

/**
 * The form SCR-REG-08's Renew or Report a change opens SCR-REG-02 with: the decision's premises, the kind, and
 * the period the specification prefills (a renewal from the day after the decision ends, for a year; a change
 * from today to the decision's end).
 */
export function startValuesFrom(sessionId: string, decisionRef: string, kind: "RENEWAL" | "AMENDMENT"): LoadOutcome<StartValues> {
  const s = state(sessionId);
  const decision = decisionOf(s, decisionRef)?.summary;
  if (decision === undefined || !actsFor(s, sessionId).has(decision.premises.id)) return refusedRead("DECISION_NOT_FOUND");
  const from = kind === "RENEWAL" ? addDays(decision.period.to, 1) : today();
  return ok({
    premisesId: decision.premises.id,
    kind,
    prior: { reference: decision.reference, period: decision.period },
    cause: null,
    period: { from, to: kind === "RENEWAL" ? yearFrom(from) : decision.period.to },
  });
}

export function applicationDraft(sessionId: string, ref: string): LoadOutcome<ApplicationDraft> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { application, work } = draft;
  return ok({ reference: ref, premises: premisesName(s, application.premisesId), kind: application.kind, period: work.period, savedAt: application.savedAt });
}

/** GET /applications/{id}/requirements, as SCR-REG-03 reads it. */
export function factsStep(sessionId: string, ref: string): LoadOutcome<FactsStep> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { work } = draft;
  return ok({
    today: today(),
    known: work.known,
    // DR-286 row 1: no rulebook in force on the governing date has no questions to ask.
    blocked: rulebookAt(s, governingOn(work)) === null ? "RULEBOOK_NOT_APPROVED" : null,
    questions: work.questions,
    answers: work.answers,
    copied: work.copied,
    fieldErrors: {},
    saveRefusal: null,
  });
}

/** GET /applications/{id}/requirements, as SCR-REG-04 reads it. */
export function evidenceStep(sessionId: string, ref: string): LoadOutcome<EvidenceStep> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { application, work } = draft;
  return ok({
    today: today(),
    blocked: rulebookAt(s, governingOn(work)) === null ? "RULEBOOK_NOT_APPROVED" : null,
    documents: work.documents.map(toRequired),
    afterSending: AFTER_SUBMISSION,
    claims: application.claims.map((claim) => ({ kind: claim.kind, layer: claim.layer, period: claim.period, documents: claim.documents.map(toRequired) })),
    claimAttempt: null,
    stillNeeded: missingItems(application, work),
  });
}

/**
 * POST /applications/{id}/previews: the review SCR-REG-05 opens with, checked in the contract's order. No rulebook in
 * force on the governing date stops it (DR-01 row 1); items missing refuse it; TAR answering no approved version is
 * TARIFF_NOT_APPROVED and records nothing (row 2). Otherwise it shows what a submission now comes to (rows 3 to 7):
 * the fee TAR worked out on the governing date, a no-fee outcome with its basis, or the review the application goes
 * to; the time before registration (DR-22); and the explanation, with the change-report period it quotes. The
 * presentation is recorded with the versions it rests on, and the confirmation that follows rests on it.
 */
export function previewApplication(sessionId: string, ref: string): LoadOutcome<ReviewStep> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { application, work } = draft;
  const day = governingOn(work);
  const rulebook = rulebookAt(s, day);
  const explained = explanationAt(s, day);
  const changeReportDays = changeReportPeriodAt(day).days;
  const explanation = { version: explained ?? EXPLANATION, published: explained !== null, changeReportDays };
  const declaredClass = work.questions.includes("premises_class");
  const nothing = { missing: [], told: null, fee: null, feeRefusal: null, declaredClass, exemption: null, payBy: null, explanation, outcome: null, preRegistration: null, calculation: null };
  if (rulebook === null) return ok({ ...nothing, blocked: "RULEBOOK_NOT_APPROVED" });
  const missing = missingItems(application, work);
  const { premisesClass, customerArea, daysOpen, musicMethod, useBeganOn } = work.answers;
  if (missing.length > 0 || customerArea === null || daysOpen === null || musicMethod === null || useBeganOn === null) {
    return ok({ ...nothing, blocked: "REQUIRED_ITEMS_MISSING", missing });
  }
  const told = { premisesClass: declaredClass ? premisesClass : null, customerArea, daysOpen, musicMethod, useBeganOn };
  const payBy = addDays(useBeganOn, DEADLINE_DAYS);
  const answer = askTariff(s, application, work.answers, declaredClass, work.period);
  if (answer.outcome === "NO_APPROVED_VERSION") return ok({ ...nothing, blocked: null, told, payBy, feeRefusal: "TARIFF_NOT_APPROVED" });
  if (answer.outcome !== "CALCULATED") return refusedRead("TARIFF_UNAVAILABLE");
  const calc = answer.calculation;
  const fee = feeOf(calc, application, work.period);
  const route = routeOf(application, work, calc);
  // With no explanation approved nothing is recorded, and the confirmation is refused (CFG-326).
  if (explanation.published) {
    work.presentation = { id: randomUUID(), digest: digest(work) };
    work.shown = { rulebook, explanation: explanation.version, changeReportDays, calculation: calc.reference };
    recordStep(s, application, "PREVIEW", now());
  }
  return ok({
    blocked: null,
    missing: [],
    told,
    fee:
      fee === null || fee.basis === "OUT_OF_SCOPE"
        ? null
        : {
            period: work.period,
            // Per layer, as the decision will charge it: a split layer reads as its charged total.
            lines: LAYERS.map((layer) => {
              const parts = fee.lines.filter((line) => line.layer === layer);
              const kept = parts.find((line) => line.treatment === "EXEMPT" || line.treatment === "MANDATE_STOPPED" || (line.treatment === "CLAIM_ACCEPTED" && parts.length === 1));
              return {
                layer,
                amountMinor: parts.reduce((sum, line) => sum + line.amountMinor, 0),
                claimPending: parts.some((line) => line.treatment === "CLAIM_PENDING"),
                treatment: kept === undefined ? null : kept.treatment === "EXEMPT" ? "EXEMPT" : kept.treatment === "MANDATE_STOPPED" ? "MANDATE_STOPPED" : "CLAIM_ACCEPTED",
              };
            }),
            totalMinor: fee.totalMinor,
            currency: fee.currency,
            tariffVersion: fee.tariffVersion,
            workedOutAt: calc.createdAt,
          },
    feeRefusal: null,
    declaredClass: declaredClass || calc.classification.premisesClass.basis === "DECLARED",
    exemption: exemptionShown(calc),
    payBy,
    explanation,
    outcome: outcomeOf(route, fee),
    preRegistration: preRegistrationOf(s, application, useBeganOn, today()),
    calculation: calc.reference,
  });
}

/** SCR-REG-06: the boxes unticked each time the page opens, and the review the confirmation rests on. */
export function attestationStep(sessionId: string, party: string, ref: string): LoadOutcome<AttestationStep> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refusedRead(draft.code);
  const shown = draft.work.presentation;
  return ok({
    party,
    confirmed: false,
    changeDutyAcknowledged: false,
    refusal: null,
    missing: [],
    sendPending: false,
    shown: shown === null ? null : { presentation: shown.id, factsDigest: shown.digest },
    changeReportDays: draft.work.shown?.changeReportDays ?? changeReportPeriodAt(governingOn(draft.work)).days,
  });
}

/** GET /applications/{id}, as SCR-REG-07 reads it. */
export function applicationRecord(sessionId: string, ref: string): LoadOutcome<ApplicationRecord> {
  const s = state(sessionId);
  const application = ownApplication(s, sessionId, ref);
  if ("code" in application) return refusedRead(application.code);
  const request = latestRequest(application);
  return ok({
    reference: application.reference,
    premises: premisesName(s, application.premisesId),
    kind: application.kind,
    status: application.status,
    savedAt: application.savedAt,
    sentAt: application.sentAt,
    review: application.review,
    evidenceRequest:
      request === null
        ? null
        : {
            askedBy: request.askedBy,
            askedOn: request.askedOn,
            // Once every item has arrived the request has no date left to meet.
            dueOn: request.state === "ANSWERED" ? null : request.dueOn,
            closed: request.state === "LAPSED" || request.state === "WITHDRAWN",
            items: request.items.map((entry) => ({ item: entry.code, document: entry.document, description: entry.description, receivedOn: entry.receivedOn, refusal: null })),
          },
    dates: application.dates,
    claims: application.claims.map(({ kind, layer, period, state: claimState }) => ({ kind, layer, period, state: claimState })),
    history: application.history,
    decision: application.decision,
    ended: application.ended,
    canWithdraw: OPEN.includes(application.status),
    withdrawRefusal: null,
  });
}

// ---------------------------------------------------------------- the premises portal: commands

/** A calendar date as the API takes it (2026-08-03); null when it is not one. */
function isoDate(text: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text) ? text : null;
}

/** A whole number of square metres as typed in either language (64, 1.200, 1,200); null when it is not one. */
function readWholeNumber(text: string): number | null {
  const value = text.replace(/\s/g, "");
  if (!/^\d+$/.test(value) && !/^\d{1,3}([.,]\d{3})+$/.test(value)) return null;
  const number = Number(value.replace(/[.,]/g, ""));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** POST /applications: checks in the contract's order; a draft with its new reference when every one passes. */
export function startApplication(sessionId: string, input: StartInput): CommandAnswer<{ application: string }> {
  const s = state(sessionId);
  const mine = actsFor(s, sessionId);
  if (!mine.has(input.premisesId) || !s.seed.premises.some((premises) => premises.id === input.premisesId)) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  // PTY decides whether this person may start one here (PERM-590), and the premises is not told why not.
  if (!mayActFor(sessionId, input.premisesId, "PERM-590")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  // A premises actor giving one of the officer's two causes (PERM-590).
  if ((OFFICER_CAUSES as readonly string[]).includes(input.cause ?? "")) return refuse("NOT_AUTHORISED", { field: "cause" });
  const day = today();
  const { kind, from, to } = input;
  if (kind !== "AMENDMENT") {
    if (from === null || to === null || to <= from) return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
    const governing = governingDecision(s, input.premisesId, { from, to });
    if (governing !== null) return refuse("INTENDED_PERIOD_INVALID", { field: "period", governingDecision: governing });
    if (kind === "NEW" && from < day) return refuse("PRE_REGISTRATION_OBLIGATION_RESERVED", { field: "period" });
  }
  const prior = kind === "NEW" ? null : (s.decisions.find((entry) => entry.summary.reference === input.prior && entry.summary.premises.id === input.premisesId) ?? null);
  if (kind !== "NEW") {
    if (prior === null) return refuse("PRIOR_DECISION_NOT_FOUND");
    if (prior.summary.status === "SUPERSEDED") return refuse("PRIOR_DECISION_SUPERSEDED");
  }
  let period: Period;
  let change: Work["change"] = undefined;
  if (kind === "AMENDMENT") {
    // A change runs to the end of the decision it changes, and must start before that end (ALG-266 step 2a).
    const end = prior?.summary.period.to ?? null;
    if (from === null || end === null || from >= end) return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
    if (!(CAUSES as readonly string[]).includes(input.cause ?? "")) return refuse("AMENDMENT_CAUSE_REQUIRED", { field: "cause" });
    period = { from, to: end };
    if (input.cause === "FACT_CHANGE_REPORTED" && prior !== null) {
      // FR-TAR-016: a reported change takes effect from the date the tariff's transition rule gives, counted from the
      // day the change occurred and never from the day it was reported; the report is held against the period then in force.
      const answer = changeEffectiveOn({ changeOccurredOn: from, reportedOn: day < from ? from : day, periodEndsOn: end });
      if (answer.outcome === "EFFECTIVE_ON") {
        const effectiveOn = answer.effectiveOn < prior.summary.period.from ? prior.summary.period.from : answer.effectiveOn;
        if (effectiveOn >= end) return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
        period = { from: effectiveOn, to: end };
        change = { occurredOn: from, reportedOn: day, effectiveOn, transitionRule: answer.transitionRule, withinPeriod: answer.reportedWithinPeriod, periodDays: answer.periodDays };
      }
    }
  } else if (from !== null && to !== null) {
    period = { from, to };
  } else {
    return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
  }
  const open = [...s.applications.values()].find(
    (application) => application.premisesId === input.premisesId && application.kind === kind && OPEN.includes(application.status),
  );
  if (open !== undefined) return refuse("OPEN_APPLICATION_EXISTS", { openApplication: open.reference });

  let ref = reference("REG");
  while (s.applications.has(ref)) ref = reference("REG");
  const register = s.seed.register.premises[input.premisesId] ?? null;
  const knownClass = register?.premisesClass ?? null;
  const questions: readonly FactQuestion[] = knownClass === null ? QUESTIONS : QUESTIONS.filter((question) => question !== "premises_class");
  // A renewal or a change copies the facts its decision rests on, where the canvas draws them (FR-REG-012); each
  // copied answer waits for the person to confirm it is still true.
  const copiedFacts = prior !== null ? (s.decisionFacts.get(prior.summary.reference) ?? null) : null;
  const answers: FactAnswers = copiedFacts ?? { premisesClass: null, customerArea: null, daysOpen: null, musicMethod: null, useBeganOn: null };
  const copied =
    copiedFacts === null ? null : Object.fromEntries(questions.filter((question) => answerOf(answers, question) !== null).map((question) => [question, false]));
  const at = now();
  s.applications.set(ref, {
    reference: ref,
    premisesId: input.premisesId,
    kind,
    startedByRightOne: false,
    status: "DRAFT",
    savedAt: null,
    sentAt: null,
    review: null,
    requests: [],
    dates: null,
    claims: [],
    history: [{ at, event: "STARTED" }],
    decision: null,
    ended: null,
    work: {
      period,
      prior: prior?.summary.reference ?? null,
      cause: kind === "AMENDMENT" ? input.cause : null,
      known: {
        businessRegistration: s.seed.register.businessRegistration,
        administrativeArea: register?.administrativeArea ?? null,
        premisesClass: knownClass,
        classChanged: kind !== "NEW" && (register?.classChanged ?? false),
      },
      questions,
      answers: { ...answers, premisesClass: knownClass === null ? answers.premisesClass : null },
      copied,
      documents: s.seed.rulebook.documents.map((item) => ({ item, receivedOn: null, receivedAt: null, file: null })),
      presentation: null,
      attestation: null,
      ...(change !== undefined ? { change } : {}),
    },
    period,
    prior: prior?.summary.reference ?? null,
    reviewType: null,
    route: null,
    // The rulebook in force on the governing date (DR-288 row 3); none approved reads as none until the review refuses.
    rulebook: rulebookAt(s, period.from) ?? "",
    facts: null,
    evidence: null,
    attestations: null,
    statements: [],
    transitions: [{ at, from: null, to: "DRAFT", cause: "START", by: principalOf(sessionId) }],
    proposals: [],
    answers: null,
  });
  s.order.unshift(ref);
  const started = s.applications.get(ref);
  if (started !== undefined) recordStep(s, started, "START", at);
  if (kind === "AMENDMENT" && prior !== null) {
    s.amendments.set(ref, { cause: input.cause ?? "", caseRef: null, decision: prior.summary.reference, initiatedBy: "APPLICANT", by: principalOf(sessionId) });
  }
  recordActUnderAuthority(sessionId, input.premisesId, "PERM-590", { kind: "STARTED_APPLICATION", subject: ref });
  return accept({ application: ref });
}

/**
 * POST /applications/{id}/fact-declarations: every answer sent is checked, and one refused answer refuses the
 * save, so nothing half-saves. A copied answer the person changes is theirs from then on, not a copy to confirm.
 */
export function declareFacts(sessionId: string, ref: string, input: FactsInput): CommandAnswer<{ complete: boolean }> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refuse(draft.code);
  if (!mayActFor(sessionId, draft.application.premisesId, "PERM-593")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { application, work } = draft;
  const next: FactAnswers = { ...work.answers };
  const fieldErrors: Partial<Record<FactQuestion, string>> = {};
  for (const question of QUESTIONS) {
    const raw = input.values[question];
    if (raw === undefined) continue;
    if (!work.questions.includes(question)) {
      if (question === "premises_class" && raw !== "") fieldErrors[question] = "FACT_DERIVED_NOT_DECLARABLE";
      continue;
    }
    const answer = readAnswer(question, raw.trim());
    if (answer === null) fieldErrors[question] = "FACT_VALUE_INVALID";
    setAnswer(next, question, answer?.value ?? null);
  }
  const first = Object.values(fieldErrors)[0];
  if (first !== undefined) return refuse(first, { fieldErrors });
  if (work.copied !== null) {
    const copied: Partial<Record<FactQuestion, boolean>> = {};
    for (const question of Object.keys(work.copied) as FactQuestion[]) {
      if (answerOf(next, question) !== answerOf(work.answers, question)) continue;
      // The box on the page is the answer: ticked, the copied value is confirmed as still true.
      copied[question] = input.reconfirmed.includes(question);
    }
    work.copied = copied;
  }
  work.answers = next;
  saved(s, application, "FACTS", now());
  return accept({ complete: work.questions.every((question) => answerOf(next, question) !== null) });
}

/** One answer as typed: its value (null for an empty field), or null when it is not a valid answer. A date later than today is not one. */
function readAnswer(question: FactQuestion, text: string): { value: string | number | null } | null {
  if (text === "") return { value: null };
  const valid = (value: string | number | null | undefined) => (value === null || value === undefined ? null : { value });
  switch (question) {
    case "premises_class":
      return valid(CLASSES.find((option) => option === text));
    case "customer_area":
      return valid(readWholeNumber(text));
    case "days_open":
      return /^[1-7]$/.test(text) ? { value: Number(text) } : null;
    case "music_method":
      return valid(METHODS.find((option) => option === text));
    case "use_began_on": {
      const value = isoDate(text);
      return value === null || value > today() ? null : { value };
    }
  }
}

function setAnswer(answers: FactAnswers, question: FactQuestion, value: string | number | null): void {
  switch (question) {
    case "premises_class":
      answers.premisesClass = CLASSES.find((option) => option === value) ?? null;
      return;
    case "customer_area":
      answers.customerArea = typeof value === "number" ? value : null;
      return;
    case "days_open":
      answers.daysOpen = typeof value === "number" ? value : null;
      return;
    case "music_method":
      answers.musicMethod = METHODS.find((option) => option === value) ?? null;
      return;
    case "use_began_on":
      answers.useBeganOn = typeof value === "string" ? value : null;
      return;
  }
}

/**
 * Where a document goes on SCR-REG-04: `rules:<item>` for a document the rules ask for, `claim:<kind>:<layer>:<item>`
 * for one a claim asks for.
 */
function slotOf(application: Application, work: Work, target: string): StoredDocument | null {
  const [where, ...rest] = target.split(":");
  if (where === "rules") return work.documents.find((document) => document.item === rest[0]) ?? null;
  if (where === "claim") {
    const [kind, layer, item] = rest;
    const claim = application.claims.find((entry) => entry.kind === kind && entry.layer === layer && entry.state === "DRAFT");
    return claim?.documents.find((document) => document.item === item) ?? null;
  }
  return null;
}

/** POST /applications/{id}/evidence-items on a draft: the file's name, type and size are recorded; no file is kept. */
export function addEvidenceItem(sessionId: string, ref: string, target: string, file: ChosenFile): CommandAnswer<{ receivedOn: string }> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refuse(draft.code);
  if (!mayActFor(sessionId, draft.application.premisesId, "PERM-594")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { application, work } = draft;
  const slot = slotOf(application, work, target);
  if (slot === null) return refuse("EVIDENCE_NOT_REQUESTED");
  if (invalidFile(file)) return refuse("DOCUMENT_INVALID");
  const receivedOn = today();
  slot.file = { name: file.name, type: file.type, sizeBytes: file.sizeBytes };
  slot.receivedOn = receivedOn;
  slot.receivedAt = now();
  saved(s, application, "EVIDENCE", slot.receivedAt);
  return accept({ receivedOn });
}

/** POST /applications/{id}/assertions: a claim on one rights layer, within the registered period. */
export function raiseAssertion(sessionId: string, ref: string, input: ClaimInput): CommandAnswer<{ layer: RightsLayer }> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refuse(draft.code);
  if (!mayActFor(sessionId, draft.application.premisesId, "PERM-595")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { application, work } = draft;
  const kind: ClaimKind = input.kind === "DIRECT_LICENCE" ? "DIRECT_LICENCE" : "NON_USE";
  const layer = LAYERS.find((option) => option === input.layer);
  if (layer === undefined) return refuse("RIGHTS_LAYER_UNKNOWN", { field: "layer" });
  const { from, to } = input;
  if (from === null || to === null || to < from || from < work.period.from || to > work.period.to) return refuse("ASSERTION_PERIOD_INVALID", { field: "period" });
  if (application.claims.some((claim) => claim.kind === kind && claim.layer === layer && claim.state !== "WITHDRAWN")) {
    return refuse("ASSERTION_DUPLICATE", { field: "layer" });
  }
  application.claims.push({
    id: claimId(kind, layer),
    kind,
    layer,
    period: { from, to },
    state: "DRAFT",
    raisedAt: now(),
    documents: [{ item: s.seed.rulebook.claimEvidence, receivedOn: null, receivedAt: null, file: null }],
    outcome: null,
  });
  saved(s, application, "EVIDENCE", now());
  return accept({ layer });
}

/** The requirement code a document the rules ask for answers, as the case file lists it. */
const REQUIREMENT: Readonly<Record<DocumentItem, string>> = {
  USE_START_PROOF: "USE-START",
  LEASE: "TENURE",
  SUPPLIER_INVOICE: "SUPPLIER-INVOICE",
  MUSIC_INVOICE_Q3: "SUPPLIER-INVOICE",
  EQUIPMENT_PHOTO: "EQUIPMENT-PHOTO",
};

/** A document received, as the case file lists it. */
function evidenceOf(ref: string, key: string, title: EvidenceTitle, answers: CaseEvidence["answers"], document: { receivedOn: string; receivedAt: string | null; file: ChosenFile }): CaseEvidence {
  return {
    key,
    title,
    answers,
    receivedAt: document.receivedAt,
    receivedOn: document.receivedOn,
    file: { mediaType: document.file.type, sizeBytes: document.file.sizeBytes },
    digest: fileDigest(ref, key, document.file, document.receivedAt ?? document.receivedOn),
  };
}

/**
 * The case file of an application the moment it is sent: each fact with its FR-REG-007 label (the register's
 * values, the answers declared, the use-start date with its proof), the documents received, and the
 * confirmation. What the record holds from then on is the console's to read.
 */
function caseFromWork(s: State, application: Application, work: Work, principal: Actor, confirmedAt: string): void {
  const party = partyOfPremises(s, application.premisesId);
  const register = party !== null ? (s.review.parties[party] ?? null) : null;
  const startedAt = application.history.find((entry) => entry.event === "STARTED")?.at ?? confirmedAt;
  const source = register?.registerVersion !== null && register?.registerVersion !== undefined ? { at: startedAt ?? confirmedAt, version: register.registerVersion } : null;
  const priorApplication = work.prior !== null ? (decisionOf(s, work.prior)?.record?.application ?? null) : null;
  const base = { version: 1, current: true, correction: null, replaced: null, document: null, copiedFrom: null, source: null } as const;
  const facts: CaseFact[] = [
    { ...base, code: "business_registration", value: work.known.businessRegistration, label: "registry-sourced", cls: "authoritative", source },
  ];
  if (work.known.premisesClass !== null) {
    facts.push({ ...base, code: "premises_class", value: work.known.premisesClass, label: "registry-sourced", cls: "authoritative", source });
  }
  const proved = work.documents.some((document) => document.item === "USE_START_PROOF" && document.receivedOn !== null);
  for (const question of work.questions) {
    const value = answerOf(work.answers, question);
    if (value === null) continue;
    const copied = work.copied !== null && question in work.copied;
    const withProof = question === "use_began_on" && proved;
    facts.push({
      ...base,
      code: question,
      value,
      label: withProof ? "evidenced" : "declared",
      cls: "declared",
      document: withProof ? { document: "USE_START_PROOF" } : null,
      copiedFrom: copied ? priorApplication : null,
    });
  }
  application.facts = facts;
  const received = (document: StoredDocument) =>
    document.receivedOn !== null && document.file !== null ? { receivedOn: document.receivedOn, receivedAt: document.receivedAt, file: document.file } : null;
  const evidence: CaseEvidence[] = [];
  for (const document of work.documents) {
    const got = received(document);
    if (got !== null) evidence.push(evidenceOf(application.reference, `rules-${document.item}`, { document: document.item }, { requirement: REQUIREMENT[document.item] }, got));
  }
  for (const claim of application.claims) {
    for (const document of claim.documents) {
      const got = received(document);
      if (got !== null) evidence.push(evidenceOf(application.reference, `claim-${claim.id}-${document.item}`, { document: document.item }, { claim: claim.kind }, got));
    }
  }
  application.evidence = evidence;
  const earlier = application.attestations ?? [];
  application.attestations = [
    ...earlier.map((entry) => ({ ...entry, superseded: true })),
    // The versions the review it confirms showed (DR-286 row 5), which the submission checked are those in force.
    { version: earlier.length + 1, at: confirmedAt, by: principal, explanation: work.shown?.explanation ?? EXPLANATION, rulebook: application.rulebook, superseded: false },
  ];
}

/**
 * POST /applications/{id}/attestations, then /submissions (SCR-REG-06's one act). The confirmation must name
 * the latest review and the answers it showed; sending then checks what the contract checks, in its order, and
 * DR-285 routes it (ALG-261). Decided by the rules, it is decided now, on TAR's calculation for the governing date
 * (DR-01 rows 3 to 5), or waits for what the rulebook asks after sending (row 8). Otherwise it goes to review -
 * the rulebook-exception queue for a premises the tariff could not classify or a review trigger, claim review for a
 * claim - and waits there for an officer.
 */
export function attestAndSubmit(sessionId: string, ref: string, input: AttestInput): CommandAnswer<{ status: ApplicationStatus }> {
  const s = state(sessionId);
  const draft = draftOf(s, sessionId, ref);
  if ("code" in draft) return refuse(draft.code);
  if (!mayActFor(sessionId, draft.application.premisesId, "PERM-599")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { application, work } = draft;
  const current = digest(work);
  if (work.presentation === null || work.presentation.id !== input.presentation) return refuse("EXPLANATION_SUPERSEDED");
  if (input.factsDigest !== current || work.presentation.digest !== current) return refuse("FACTS_CHANGED_SINCE_PREVIEW");
  if (!input.confirmed || !input.changeDutyAcknowledged) return refuse("ATTESTATION_NOT_CONFIRMED");
  // Recorded once for these answers: sending again reuses it.
  if (work.attestation?.digest !== current) {
    work.attestation = { digest: current, at: now() };
    application.history.unshift({ at: work.attestation.at, event: "CONFIRMED" });
  }
  const confirmedAt = work.attestation.at;

  const day = governingOn(work);
  const rulebook = rulebookAt(s, day);
  if (rulebook === null) return refuse("RULEBOOK_NOT_APPROVED");
  const missing = missingItems(application, work);
  if (missing.length > 0) return refuse("REQUIRED_ITEMS_MISSING", { missing });
  if (work.copied !== null && Object.values(work.copied).some((confirmed) => !confirmed)) return refuse("RECONFIRMATION_REQUIRED");
  // DR-286 row 5: the review the confirmation rests on showed the versions in force on the governing date.
  if (work.shown === undefined || work.shown.rulebook !== rulebook || work.shown.explanation !== explanationAt(s, day)) return refuse("EXPLANATION_SUPERSEDED");
  const declaredClass = work.questions.includes("premises_class");
  const answer = askTariff(s, application, work.answers, declaredClass, work.period);
  if (answer.outcome === "NO_APPROVED_VERSION") return refuse("TARIFF_NOT_APPROVED");
  if (answer.outcome !== "CALCULATED") return refuse("TARIFF_UNAVAILABLE");
  const calc = answer.calculation;
  const governing = application.kind === "AMENDMENT" ? null : governingDecision(s, application.premisesId, work.period);
  if (governing !== null) return refuse("INTENDED_PERIOD_INVALID", { governingDecision: governing });
  // Never null here: an unanswered date is a missing item, refused above.
  const useBeganOn = work.answers.useBeganOn ?? today();
  const route = routeOf(application, work, calc);
  const fee = feeOf(calc, application, work.period);

  const sentAt = now();
  const principal = principalOf(sessionId);
  // CFG-08 holds no straight-through rule (its tested default): every claim drafted goes to review.
  const claimed = application.claims.filter((claim) => claim.state === "DRAFT");
  for (const claim of claimed) claim.state = "UNDER_REVIEW";
  application.sentAt = sentAt;
  application.savedAt = null;
  application.rulebook = rulebook;
  application.route = route.route;
  application.reviewType = route.reviewType;
  application.period = work.period;
  application.prior = work.prior;
  application.transitions.unshift({ at: sentAt, from: "DRAFT", to: "SUBMITTED", cause: "SUBMISSION", by: principal });

  if (route.route === "MANUAL" || fee === null) {
    // Complete on the day the application and its last document were both in: the canvas's Sala draft was sent
    // the day its last document arrived.
    const arrived = [...work.documents, ...claimed.flatMap((claim) => claim.documents)].map((document) => document.receivedOn ?? "");
    const completeOn = [today(), ...arrived].reduce((latest, entry) => (entry > latest ? entry : latest));
    const byClaim = route.reviewType === "ASSERTION";
    application.status = "UNDER_REVIEW";
    application.route = "MANUAL";
    application.reviewType = route.reviewType ?? "RULEBOOK_EXCEPTION";
    const byOfficer = route.reason === "OFFICER_AMENDMENT";
    application.review = byClaim ? "CLAIM" : byOfficer ? "AMENDMENT" : "RULEBOOK";
    application.dates = statement(completeOn, useBeganOn);
    application.statements.unshift(statementRow(application, application.dates, sentAt));
    application.history.unshift({ at: sentAt, event: "SENT", route: byClaim ? "CLAIM_REVIEW" : byOfficer ? "AMENDMENT_REVIEW" : "RULEBOOK_REVIEW", claim: claimed[0]?.kind ?? null });
    application.transitions.unshift({ at: sentAt, from: "SUBMITTED", to: "UNDER_REVIEW", cause: "ROUTING", by: RIGHTONE });
    caseFromWork(s, application, work, principal, confirmedAt);
    application.answers = { ...work.answers, premisesClass: work.known.premisesClass ?? work.answers.premisesClass };
    application.work = null;
    submitted(s, application, confirmedAt, sentAt);
    return accept({ status: application.status });
  }

  // The automated route: no review, so the dates are the payment deadline alone, as the canvas's Pasteur reads.
  application.review = "NONE";
  application.dates = {
    completeOn: null,
    decisionExpectedBy: null,
    reset: false,
    paymentDeadline: addDays(useBeganOn, DEADLINE_DAYS),
    useBeganOn,
    toldOn: null,
    passedWhenComplete: false,
  };
  application.history.unshift({ at: sentAt, event: "SENT", route: "RULES", claim: null });
  caseFromWork(s, application, work, principal, confirmedAt);
  application.answers = { ...work.answers, premisesClass: work.known.premisesClass ?? work.answers.premisesClass };
  if (AFTER_SUBMISSION.length > 0) {
    // DR-01 row 8: what the rulebook asks once sent is asked now, and the decision follows the last item.
    application.status = "EVIDENCE_REQUIRED";
    application.requests.push({
      askedBy: "RIGHTONE",
      by: RIGHTONE,
      askedAt: sentAt,
      askedOn: today(),
      dueOn: addDays(today(), RESPONSE_DAYS),
      state: "OPEN",
      items: AFTER_SUBMISSION.map((item) => ({ code: REQUIREMENT[item], document: item, description: null, receivedOn: null, file: null })),
    });
    application.history.unshift({ at: sentAt, event: "EVIDENCE_ASKED", by: "RIGHTONE" });
    application.transitions.unshift({ at: sentAt, from: "SUBMITTED", to: "EVIDENCE_REQUIRED", cause: "EVIDENCE_REQUEST", by: RIGHTONE });
    recordStep(s, application, "EVIDENCE_WAIT_START", sentAt);
  } else {
    application.status = "SUBMITTED";
    issueDecision(s, application, null, fee, RIGHTONE, sentAt);
  }
  application.work = null;
  submitted(s, application, confirmedAt, sentAt);
  return accept({ status: application.status });
}

/**
 * What every submission records once it has committed, whoever sends it: the attestation and submission steps
 * (FR-REG-015), then its notices (NTF-REG-01, and NTF-REG-04 or NTF-REG-02 as it was routed).
 */
function submitted(s: State, application: Application, confirmedAt: string, sentAt: string): void {
  recordStep(s, application, "ATTESTATION", confirmedAt);
  recordStep(s, application, "SUBMISSION", sentAt);
  noticesOnSubmission(s, application);
}

/**
 * POST /applications/{id}/evidence-items for an item a request asks for (SCR-REG-07). The last item puts a
 * reviewed application back in review with its dates stated again; on the automated route it decides it, on TAR's
 * calculation for the governing date (ALG-261 `resume`), and TAR answering no approved version refuses the item.
 */
export function addRequestedDocument(sessionId: string, ref: string, item: string, file: ChosenFile): CommandAnswer<{ status: ApplicationStatus }> {
  const s = state(sessionId);
  const application = findMine(s, sessionId, ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  if (!mayActFor(sessionId, application.premisesId, "PERM-594")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const request = latestRequest(application);
  // A request that has ended (lapsed, or withdrawn with its application) answers for its items (@AC-FR-REG-037-06).
  const ended = request !== null && (request.state === "LAPSED" || request.state === "WITHDRAWN") && request.items.some((candidate) => candidate.code === item);
  if (ended) return refuse("EVIDENCE_REQUEST_CLOSED");
  if (application.status !== "EVIDENCE_REQUIRED" || request === null) return refuse("APPLICATION_NOT_EDITABLE");
  const index = request.items.findIndex((candidate) => candidate.code === item);
  const entry = request.items[index];
  if (entry === undefined) return refuse("EVIDENCE_NOT_REQUESTED");
  // A request the applicant was told of has lapsed by the day after its due date (`settle`); one never told of stays
  // open and is answered (SM-267 transition 3).
  if (request.state !== "OPEN" || entry.receivedOn !== null) return refuse("EVIDENCE_REQUEST_CLOSED");
  if (invalidFile(file)) return refuse("DOCUMENT_INVALID");
  const last = request.items.every((candidate) => candidate === entry || candidate.receivedOn !== null);
  const resumed = last && request.askedBy === "RIGHTONE" ? feeOnOutcome(s, application, "DECIDED_AS_APPLIED") : null;
  if (last && request.askedBy === "RIGHTONE" && resumed === null) return refuse("TARIFF_NOT_APPROVED");
  const day = today();
  const at = now();
  entry.receivedOn = day;
  entry.file = { name: file.name, type: file.type, sizeBytes: file.sizeBytes };
  application.evidence?.push(
    evidenceOf(
      application.reference,
      `request-${String(application.requests.length)}-${entry.code}`,
      entry.description !== null ? { described: entry.description } : entry.document !== null ? { document: entry.document } : { described: entry.code },
      { requestItem: index + 1 },
      { receivedOn: day, receivedAt: at, file: entry.file },
    ),
  );
  if (last && resumed !== null) {
    request.state = "ANSWERED";
    application.history.unshift({ at, event: "EVIDENCE_COMPLETE" });
    recordStep(s, application, "EVIDENCE_WAIT_END", at);
    issueDecision(s, application, null, resumed, RIGHTONE, at);
    return accept({ status: application.status });
  }
  if (last) {
    request.state = "ANSWERED";
    application.status = "UNDER_REVIEW";
    if (application.dates !== null) {
      application.dates = statement(day, application.dates.useBeganOn);
      application.statements.unshift(statementRow(application, application.dates, at));
    }
    application.history.unshift({ at, event: "EVIDENCE_COMPLETE" });
    application.transitions.unshift({ at, from: "EVIDENCE_REQUIRED", to: "UNDER_REVIEW", cause: "EVIDENCE_ANSWERED", by: principalOf(sessionId) });
    recordStep(s, application, "EVIDENCE_WAIT_END", at);
    // DR-41 row 5: the restated dates, told as the first were (NTF-REG-04).
    const restated = application.statements[0];
    if (application.dates !== null && restated !== undefined) tellDates(s, application, restated);
  }
  return accept({ status: application.status });
}

/**
 * The withdrawal's consequences, whoever records it (DR-287): the claims and any open request end with the
 * application, and a proposal still waiting closes unissued, which the outcomes report shows beside the withdrawal.
 */
function withdraw(s: State, application: Application, at: string, instruction: string | null, by: Actor): void {
  const adverse = pendingProposal(application);
  application.status = "WITHDRAWN";
  application.ended = { kind: "WITHDRAWN", on: today(), at, instruction };
  for (const claim of application.claims) if (claim.state === "DRAFT" || claim.state === "UNDER_REVIEW") claim.state = "WITHDRAWN";
  const open = openRequest(application);
  if (open !== null) {
    open.state = "WITHDRAWN";
    recordStep(s, application, "EVIDENCE_WAIT_END", at);
  }
  if (adverse !== null) adverse.status = "CLOSED_BY_WITHDRAWAL";
  const from = application.transitions[0]?.to ?? null;
  application.history.unshift({ at, event: instruction === null ? "WITHDRAWN" : "WITHDRAWN_ON_INSTRUCTION" });
  application.transitions.unshift({ at, from, to: "WITHDRAWN", cause: "WITHDRAWAL", by });
  s.outcomes.push({
    on: today(),
    kind: "WITHDRAWN",
    withAdverse: adverse !== null && adverse.outcome !== "DECIDED_AS_APPLIED",
    reference: application.reference,
    split: instruction === null ? "OWN" : "ON_INSTRUCTION",
  });
}

/**
 * POST /applications/{id}/withdrawals: the applicant's own, a draft (DR-287 row 1) or one sent (row 2); an application
 * that has ended cannot be withdrawn (row 5). Authority comes first, so a person without it learns nothing of the state.
 */
export function withdrawApplication(sessionId: string, ref: string): CommandAnswer<{ status: ApplicationStatus }> {
  const s = state(sessionId);
  const application = ownApplication(s, sessionId, ref);
  if ("code" in application) return refuse(application.code);
  if (!mayActFor(sessionId, application.premisesId, "PERM-600")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  if (!OPEN.includes(application.status)) return refuse("APPLICATION_ALREADY_FINAL");
  withdraw(s, application, now(), null, principalOf(sessionId));
  recordActUnderAuthority(sessionId, application.premisesId, "PERM-600", { kind: "WITHDREW_APPLICATION", subject: ref });
  return accept({ status: application.status });
}

// ---------------------------------------------------------------- the console: the fee on an outcome

/** The current value of each fact the case file holds, by code. */
function currentFacts(application: Application): Map<FactCode, string | number> {
  return new Map((application.facts ?? []).filter((entry) => entry.current).map((entry) => [entry.code, entry.value]));
}

/**
 * The facts an outcome rests on, as the case file holds them: as applied for, each fact's latest version the
 * applicant gave; otherwise, each fact's current version, an officer's correction included. Null where the case file
 * holds no facts (an application the boards list only).
 */
function caseAnswers(application: Application, outcome: "DECIDED_AS_APPLIED" | "DECIDED_OTHERWISE"): { answers: FactAnswers; declaredClass: boolean } | null {
  const facts = application.facts;
  if (facts === null) return null;
  const valueOf = (code: FactCode): string | number | null => {
    const versions = facts.filter((entry) => entry.code === code && (outcome === "DECIDED_OTHERWISE" ? entry.current : entry.label !== "corrected"));
    return versions.reduce<CaseFact | null>((latest, entry) => (latest === null || entry.version > latest.version ? entry : latest), null)?.value ?? null;
  };
  const text = (code: FactCode) => {
    const value = valueOf(code);
    return typeof value === "string" ? value : null;
  };
  const number = (code: FactCode) => {
    const value = valueOf(code);
    return typeof value === "number" ? value : null;
  };
  const classFact = facts.find((entry) => entry.code === "premises_class" && entry.current) ?? null;
  return {
    answers: {
      premisesClass: CLASSES.find((option) => option === text("premises_class")) ?? null,
      customerArea: number("customer_area"),
      daysOpen: number("days_open"),
      musicMethod: METHODS.find((option) => option === text("music_method")) ?? null,
      useBeganOn: text("use_began_on"),
    },
    declaredClass: classFact !== null && classFact.label !== "registry-sourced",
  };
}

/**
 * The fee on an outcome: TAR's calculation for the facts that outcome rests on, on the governing date, each claim's
 * treatment applied as DR-289 reads it (`feeOf`). Null where TAR answers no approved version or cannot classify the
 * premises on those facts. `record` false works the figure out without recording a calculation, for a form.
 */
function feeOnOutcome(s: State, application: Application, outcome: "DECIDED_AS_APPLIED" | "DECIDED_OTHERWISE", record = true): Fee | null {
  const period = application.period;
  const facts = caseAnswers(application, outcome);
  if (period === null || facts === null) return null;
  const answer = askTariff(s, application, facts.answers, facts.declaredClass, period, record);
  return answer.outcome === "CALCULATED" ? feeOf(answer.calculation, application, period) : null;
}

// ---------------------------------------------------------------- the console: issuing

const both = (text: string): CaseText => ({ vi: text, en: text });

/** A proposal's reason, for a statement the applicant reads: the review trigger's name, or the short code the officer typed. */
function reasonWords(code: string | null): CaseText {
  const named = code !== null ? (REASON_NAMES[code] ?? null) : null;
  return named ?? both(code ?? "");
}


/**
 * Issues a decision (ALG-261 `issue`): the one a proposal carries, or, with no proposal, the one the rules reached at
 * submission or on the last item RightOne asked for. A new obligation decision in the registration state, which the
 * premises reads on SCR-REG-01 and 08, FIN collects and CER certifies, naming TAR's calculation, its basis and the
 * time before registration (DR-22); the use-start date it records; the application decided. A change supersedes the
 * decision it amends from its effective date.
 */
function issueDecision(s: State, application: Application, proposal: Proposal | null, fee: Fee, by: Actor, at: string): string {
  const fromStatus = application.status;
  const period = application.period ?? { from: today(), to: yearFrom(today()) };
  let ref = reference("OBD");
  while (decisionOf(s, ref) !== null) ref = reference("OBD");
  const facts = currentFacts(application);
  const began = facts.get("use_began_on");
  const useBeganOn = typeof began === "string" ? began : (application.dates?.useBeganOn ?? null);
  const payable = fee.totalMinor > 0;
  const payBy = payable && useBeganOn !== null ? addDays(useBeganOn, DEADLINE_DAYS) : null;
  const otherwise = proposal?.outcome === "DECIDED_OTHERWISE";
  const pending = application.claims.some((claim) => claim.state === "UNDER_REVIEW");
  const basis = fee.basis ?? "TARIFF";
  // DR-22 on the day the application was registered: the day it was sent.
  const preRegistration = useBeganOn !== null ? preRegistrationOf(s, application, useBeganOn, addDays(application.sentAt ?? at, 0)) : null;
  const partly = application.claims.find((claim) => claim.state === "PARTLY_ACCEPTED" && claim.outcome?.scope !== null) ?? null;
  const dayBefore = addDays(period.from, -1);
  const before = useBeganOn !== null && useBeganOn < period.from ? (useBeganOn === dayBefore ? useBeganOn : { from: useBeganOn, to: dayBefore }) : null;
  const amended = application.kind === "AMENDMENT" && application.prior !== null ? decisionOf(s, application.prior) : null;
  const effectiveFrom = amended !== null ? (proposal?.effectiveFrom ?? period.from) : period.from;
  const premises = premisesOption(s, application.premisesId);
  const summaryRow: DecisionSummary = {
    reference: ref,
    premises,
    status: "CURRENT",
    outcome: payable ? "PAYABLE" : "NO_PAYABLE_OBLIGATION",
    note: otherwise ? "OTHERWISE" : pending ? "CLAIM_PENDING" : basis === "OUT_OF_SCOPE" ? "OUT_OF_SCOPE" : null,
    feeMinor: fee.totalMinor,
    currency: fee.currency,
    payBy,
    period: { from: effectiveFrom, to: period.to },
    replaces: amended?.summary.reference ?? null,
    replacedBy: null,
  };
  const record: DecisionRecord = {
    reference: ref,
    premises: premises.name,
    status: "CURRENT",
    outcome: summaryRow.outcome,
    issuedAt: at,
    period: summaryRow.period,
    basis,
    lines: fee.lines,
    currency: fee.currency,
    tariffVersion: fee.tariffVersion,
    payBy,
    useBeganOn,
    confirmedAt: application.attestations?.find((entry) => !entry.superseded)?.at ?? at,
    explanationVersion: explanationAt(s, period.from) ?? EXPLANATION,
    rulebookVersion: application.rulebook,
    beforeRegistration: before,
    claim: pending ? { state: "UNDER_REVIEW" } : partly?.outcome?.scope ? { state: "PARTLY_ACCEPTED", accepted: partly.outcome.scope } : null,
    otherwise:
      otherwise && proposal !== null
        ? { aspect: "STATEMENT", reason: both(proposal.text ?? ""), notMet: both(proposal.unmet.join(" ")), youCan: both(proposal.actionOpen ?? "") }
        : null,
    replacedBy: null,
    application: application.reference,
    deadline: null,
    // A renewal names the decision it renews, an amendment the one it replaces (FR-REG-014).
    prior: application.prior,
    lateStatement: lateStatementOf(application),
    calculation: fee.calculation ?? null,
    declaredClassification: fee.declaredClass ?? false,
    route: proposal === null ? "AUTOMATED" : "MANUAL",
    preRegistration,
    // DR-288 row 3: every version resolved on the day the application takes effect, with the tariff's transition rule.
    governingOn: period.from,
    transitionRule: fee.transitionRule ?? null,
  };
  if (amended !== null) {
    amended.summary.status = "SUPERSEDED";
    amended.summary.replacedBy = { reference: ref, from: effectiveFrom };
    if (amended.record !== null) amended.record = { ...amended.record, status: "SUPERSEDED", replacedBy: { reference: ref, from: effectiveFrom } };
  }
  s.decisions.unshift({ summary: summaryRow, record });
  // The facts as the decision rests on them, an officer's correction included, which a renewal copies (AC-FR-REG-012-07).
  const answers = factsAsDecided(application);
  if (answers !== null) s.decisionFacts.set(ref, answers);
  if (useBeganOn !== null) recordUseStart(s, application, useBeganOn);
  application.status = "DECIDED";
  application.decision = { reference: ref, issuedAt: at };
  // On the automated route after the last item RightOne asked for, the decision followed that document.
  application.history.unshift({ at, event: "DECIDED", decision: ref, afterDocument: fromStatus === "EVIDENCE_REQUIRED" });
  application.transitions.unshift(
    proposal === null
      ? { at, from: fromStatus === "EVIDENCE_REQUIRED" ? "EVIDENCE_REQUIRED" : "SUBMITTED", to: "DECIDED", cause: "AUTOMATED_DECISION", by }
      : { at, from: "UNDER_REVIEW", to: "DECIDED", cause: "MANUAL_DECISION", by },
  );
  s.outcomes.push({ on: today(), kind: "DECIDED", withAdverse: false, reference: application.reference, split: otherwise ? "OTHERWISE" : "AS_APPLIED" });
  recordStep(s, application, "DECISION", at);
  tellDecision(s, application, summaryRow, record);
  return ref;
}

/**
 * The latest statement's dates where the expected decision date fell after the payment deadline: the decision carries
 * it, as `expected_after_deadline` with the statement that recorded it (FR-REG-030, ALG-263).
 */
function lateStatementOf(application: Application): DecisionRecord["lateStatement"] {
  const latest = application.statements[0] ?? null;
  if (latest?.expectedOn === null || latest?.expectedOn === undefined || latest.expectedOn <= latest.deadline) return null;
  return { expectedOn: latest.expectedOn, deadline: latest.deadline, toldOn: latest.toldAt !== null ? addDays(latest.toldAt, 0) : null };
}

/** The current value of each declared fact, as the decision rests on them; null where the case file holds none. */
function factsAsDecided(application: Application): FactAnswers | null {
  if (application.facts === null) return application.answers;
  const facts = currentFacts(application);
  const text = (code: FactCode) => {
    const value = facts.get(code);
    return typeof value === "string" ? value : null;
  };
  const number = (code: FactCode) => {
    const value = facts.get(code);
    return typeof value === "number" ? value : null;
  };
  return {
    premisesClass: CLASSES.find((option) => option === text("premises_class")) ?? application.answers?.premisesClass ?? null,
    customerArea: number("customer_area"),
    daysOpen: number("days_open"),
    musicMethod: METHODS.find((option) => option === text("music_method")) ?? null,
    useBeganOn: text("use_began_on"),
  };
}

/**
 * A use-start date the decision records (FR-REG-027): a new row only for a first date or a corrected one, which
 * names the row it corrects and keeps the class of the fact it comes from.
 */
function recordUseStart(s: State, application: Application, date: string): void {
  const earlier = s.useStarts.filter((entry) => entry.premisesId === application.premisesId).at(-1) ?? null;
  if (earlier !== null && earlier.date === date) return;
  const fact = application.facts?.find((entry) => entry.code === "use_began_on" && entry.current) ?? null;
  s.useStarts.push({
    premisesId: application.premisesId,
    date,
    source: application.reference,
    recordedOn: today(),
    cls: fact?.cls ?? "declared",
    corrects: earlier !== null ? { source: earlier.source, date: earlier.date } : null,
  });
}

/** NTF-REG-03 for a decision just issued: its outcome, basis, period, amount, a claim pending, and the appeal route. */
function tellDecision(s: State, application: Application, summaryRow: DecisionSummary, record: DecisionRecord): void {
  raiseNotice(s, application, "NTF-REG-03", summaryRow.reference, {
    decision: summaryRow.reference,
    outcome: summaryRow.note === "OTHERWISE" ? "DECIDED_OTHERWISE" : "DECIDED_AS_APPLIED",
    basis: record.basis,
    from: summaryRow.period.from,
    to: summaryRow.period.to,
    amount: summaryRow.feeMinor,
    currency: summaryRow.currency,
    claimPending: record.claim?.state === "UNDER_REVIEW" ? "yes" : "no",
    // Whether it rests on a class the applicant declared, which a reconciliation may later amend (frd/08, DR-285 row 5).
    declaredClassification: record.declaredClassification === true ? "yes" : "no",
    expectedAfterDeadline: record.lateStatement !== null ? "yes" : "no",
    appealRoute: `explanation-${String(record.explanationVersion)}`,
    by: summaryRow.payBy ?? summaryRow.period.from,
  });
}

/** An approved refusal: the application ends refused with its statement; no decision is made (FR-REG-031). */
function refuseApplication(s: State, application: Application, proposal: Proposal, by: Actor, at: string): void {
  const statementOf: RefusalStatement = {
    outcome: both(proposal.text ?? ""),
    reason: reasonWords(proposal.reason),
    notMet: both(proposal.unmet.join(" ")),
    youCan: both(proposal.actionOpen ?? ""),
  };
  application.status = "REFUSED";
  application.ended = { kind: "REFUSED", on: today(), statement: statementOf };
  application.history.unshift({ at, event: "REFUSED" });
  application.transitions.unshift({ at, from: "UNDER_REVIEW", to: "REFUSED", cause: "REFUSAL", by });
  s.outcomes.push({ on: today(), kind: "REFUSED", withAdverse: false, reference: application.reference, split: null });
  // NTF-REG-03 with the statement and the appeal route; no decision is named.
  raiseNotice(s, application, "NTF-REG-03", `${application.reference}/REFUSED`, {
    outcome: "REFUSED",
    reason: proposal.reason ?? "",
    notMet: proposal.unmet.join(" "),
    actionOpen: proposal.actionOpen ?? "",
    // The appeal route of the explanation in force on the governing date, as a decision's notice names it.
    appealRoute: `explanation-${String(explanationAt(s, application.period?.from ?? today()) ?? EXPLANATION)}`,
    by: today(),
  });
}

// ---------------------------------------------------------------- the console: reads

const isReviewType = (value: string | null): value is ReviewType => value !== null && (REVIEW_TYPES as readonly string[]).includes(value);
const isReviewState = (value: string | null): value is ReviewState => value !== null && (REVIEW_STATES as readonly string[]).includes(value);

const notAuthorised = refusedRead("NOT_AUTHORISED");

function queueRow(s: State, application: Application): QueueRow {
  const latest = application.statements[0] ?? null;
  const expectedOn = latest?.expectedOn ?? application.dates?.decisionExpectedBy ?? null;
  const toldOn = application.dates?.toldOn ?? (latest?.toldAt !== null && latest?.toldAt !== undefined ? latest.toldAt.slice(0, 10) : null);
  const status = application.status as ReviewState;
  return {
    reference: application.reference,
    premises: premisesOption(s, application.premisesId),
    reviewType: application.reviewType,
    status,
    completeOn: latest?.completeOn ?? application.dates?.completeOn ?? null,
    expectedOn,
    restatedOnAnswer: status === "EVIDENCE_REQUIRED" && application.reviewType !== null,
    pastExpected: expectedOn !== null && expectedOn < today() && status !== "EVIDENCE_REQUIRED",
    deadline: latest?.deadline ?? application.dates?.paymentDeadline ?? null,
    risk: application.dates?.passedWhenComplete === true ? { kind: "PASSED" } : toldOn !== null ? { kind: "TOLD", toldOn } : null,
  };
}

/** The filter a cursor was issued for, so a cursor presented with another filter is refused. */
const filterKey = (filter: ReviewQueue["filter"]) => [filter.queue ?? "", filter.status ?? "", filter.premises ?? ""].join("|");

function readCursor(cursor: string, filter: ReviewQueue["filter"]): number | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown; f?: unknown };
    return typeof parsed.o === "number" && Number.isSafeInteger(parsed.o) && parsed.o > 0 && parsed.f === filterKey(filter) ? parsed.o : null;
  } catch {
    return null;
  }
}

/** GET /applications as the review queue: every application in review, the oldest completeness first, a page at a time. */
export function reviewQueue(staff: Staff, asked: { queue: string | null; status: string | null; premises: string | null }, cursor: string | null): LoadOutcome<ReviewQueue> {
  if (!holds(staff, "ACT-OPS")) return notAuthorised;
  const s = state(staff.sessionId);
  // A filter value outside its set is CURSOR_INVALID, as the contract answers it.
  if ((asked.queue !== null && !isReviewType(asked.queue)) || (asked.status !== null && !isReviewState(asked.status))) return refusedRead("CURSOR_INVALID");
  const filter = { queue: isReviewType(asked.queue) ? asked.queue : null, status: isReviewState(asked.status) ? asked.status : null, premises: asked.premises };
  const offset = cursor === null ? 0 : readCursor(cursor, filter);
  if (offset === null) return refusedRead("CURSOR_INVALID");
  const inReview = [...s.applications.values()].filter((application) => IN_REVIEW.includes(application.status));
  const all = inReview
    .filter(
      (application) =>
        (filter.queue === null || application.reviewType === filter.queue) &&
        (filter.status === null || application.status === filter.status) &&
        (filter.premises === null || application.premisesId === filter.premises),
    )
    .map((application) => queueRow(s, application))
    .sort((a, b) => (a.completeOn ?? "9999") .localeCompare(b.completeOn ?? "9999") || a.reference.localeCompare(b.reference));
  const rows = all.slice(offset, offset + PAGE_SIZE);
  const next = offset + PAGE_SIZE < all.length ? Buffer.from(JSON.stringify({ o: offset + PAGE_SIZE, f: filterKey(filter) })).toString("base64url") : null;
  const seen = new Map<string, PremisesOption>();
  for (const application of inReview) seen.set(application.premisesId, premisesOption(s, application.premisesId));
  return ok({ asOf: now(), filter, rows, total: all.length, offset, nextCursor: next, premisesOptions: [...seen.values()] });
}

/** Convention 14: what holds each act of the case file, by the refusal its endpoint answers in this state. */
function actsOf(application: Application): CaseActs {
  const status = application.status;
  const draft = status === "DRAFT" ? "DRAFT" : null;
  const notInReview = draft ?? "APPLICATION_NOT_UNDER_REVIEW";
  const open = openRequest(application) !== null;
  const pending = pendingProposal(application) !== null;
  return {
    requestEvidence: status === "UNDER_REVIEW" ? (pending ? "PROPOSAL_PENDING" : null) : open ? "EVIDENCE_REQUEST_OPEN" : notInReview,
    propose: status === "UNDER_REVIEW" ? (pending ? "PROPOSAL_PENDING" : null) : notInReview,
    withdraw: IN_REVIEW.includes(status) ? null : (draft ?? "APPLICATION_ALREADY_FINAL"),
    correct: status === "UNDER_REVIEW" && application.facts !== null ? null : notInReview,
  };
}

function caseClaim(claim: Claim): CaseClaim {
  return { id: claim.id, kind: claim.kind, layer: claim.layer, period: claim.period, state: claim.state, raisedAt: claim.raisedAt, outcome: claim.outcome };
}

function caseProposal(proposal: Proposal): CaseProposal {
  return {
    id: proposal.id,
    outcome: proposal.outcome,
    status: proposal.status,
    reason: proposal.reason,
    text: proposal.text,
    unmet: proposal.unmet,
    actionOpen: proposal.actionOpen,
    preparedBy: { name: proposal.preparedBy.name, position: proposal.preparedBy.position },
    preparedAt: proposal.preparedAt,
    verdict: proposal.verdict === null ? null : { by: proposal.verdict.by.name, position: proposal.verdict.by.position, at: proposal.verdict.at, note: proposal.verdict.note },
    feeMinor: proposal.fee?.totalMinor ?? null,
    currency: proposal.fee?.currency ?? "VND",
    tariffVersion: proposal.fee?.tariffVersion ?? null,
  };
}

function caseRequest(request: Request): CaseRequest {
  return {
    state: request.state,
    by: request.askedBy === "RIGHTONE" ? RIGHTONE : request.by,
    at: request.askedAt,
    dueOn: request.dueOn,
    items: request.items.map((item) => ({
      code: item.code,
      title: item.description !== null ? { described: item.description } : item.document !== null ? { document: item.document } : { described: item.code },
      receivedOn: item.receivedOn,
    })),
    notice: request.notice === undefined ? null : request.notice.reference !== null ? "SENT" : "NOT_SENT",
  };
}

/** What Send the amendment would be refused with now, in the contract's order, or null when it can be sent. */
function sendHeld(s: State, application: Application): string | null {
  const work = application.work;
  if (application.status !== "DRAFT" || work === null) return "APPLICATION_NOT_EDITABLE";
  // DR-286 row 1, on the day the change takes effect.
  if (rulebookAt(s, governingOn(work)) === null) return "RULEBOOK_NOT_APPROVED";
  if (missingItems(application, work).length > 0) return "REQUIRED_ITEMS_MISSING";
  const amendment = s.amendments.get(application.reference) ?? null;
  const decided = amendment !== null ? (s.decisionFacts.get(amendment.decision) ?? null) : null;
  const unchanged = decided !== null && work.questions.every((question) => answerOf(decided, question) === answerOf(work.answers, question));
  if (!unchanged && work.attestation?.digest !== digest(work)) return "ATTESTATION_REQUIRED";
  return null;
}

/** An amendment's cause and who started it, as the case file's header says it, with what holds an officer's draft. */
function amendmentOf(s: State, application: Application): CaseFile["amendment"] {
  const amendment = s.amendments.get(application.reference);
  if (amendment === undefined) return null;
  const officerDraft = amendment.initiatedBy === "OFFICER" && application.status === "DRAFT";
  return { cause: amendment.cause, caseRef: amendment.caseRef, decision: amendment.decision, initiatedBy: amendment.initiatedBy, sendHeld: officerDraft ? sendHeld(s, application) : null };
}

/**
 * The reason code an application ended with: DR-287 row 1 for a draft the applicant withdrew, row 2 for one withdrawn
 * after it was sent, row 3 for one an officer recorded on the applicant's instruction; the closure reason of SM-01
 * transition 7. A refusal carries its statement instead.
 */
function endCauseOf(application: Application): EndCause | null {
  const ended = application.ended;
  if (ended?.kind === "CLOSED_INCOMPLETE") return "EVIDENCE_NOT_SUPPLIED";
  if (ended?.kind !== "WITHDRAWN") return null;
  if (ended.instruction !== null) return "WITHDRAWN_ON_INSTRUCTION";
  return application.transitions.find((entry) => entry.to === "WITHDRAWN")?.from === "DRAFT" ? "DRAFT_WITHDRAWN" : "APPLICANT_WITHDREW";
}

/** GET /applications/{id} for the console: the whole case file, read by an officer or the data owner. */
export function caseFile(staff: Staff, ref: string): LoadOutcome<CaseFile> {
  if (!holds(staff, "ACT-OPS", "ACT-DAT")) return notAuthorised;
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refusedRead("APPLICATION_NOT_FOUND");
  const decision = application.decision !== null ? decisionOf(s, application.decision.reference) : null;
  const ended = application.ended;
  return ok({
    reference: application.reference,
    premises: premisesOption(s, application.premisesId),
    status: application.status,
    kind: application.kind,
    reviewType: application.reviewType,
    route: application.route,
    submittedAt: application.sentAt,
    rulebook: application.rulebook,
    facts: application.facts,
    evidence: application.evidence,
    claims: application.claims.map(caseClaim),
    attestations: application.attestations,
    requests: application.requests.length > 0 || application.facts !== null ? application.requests.map(caseRequest) : null,
    statements: application.statements,
    noStatement: application.statements.length > 0 ? null : application.status === "DRAFT" ? "DRAFT" : application.route === "AUTOMATED" ? "AUTOMATED" : null,
    proposals: application.proposals.map(caseProposal),
    decision:
      decision !== null && application.decision !== null
        ? {
            reference: decision.summary.reference,
            status: decision.summary.status,
            outcome: decision.summary.outcome,
            asApplied: decision.summary.note !== "OTHERWISE",
            issuedAt: application.decision.issuedAt ?? decision.record?.issuedAt ?? "",
            feeMinor: decision.summary.feeMinor,
            currency: decision.summary.currency,
            period: decision.summary.period,
          }
        : null,
    ended:
      ended === null
        ? null
        : {
            kind: ended.kind,
            on: ended.on,
            instruction: ended.kind === "WITHDRAWN" ? ended.instruction : null,
            reason: s.withdrawalReasons.get(application.reference) ?? null,
            cause: endCauseOf(application),
          },
    transitions: application.transitions,
    acts: actsOf(application),
    firstSavedAt: s.firstSaved.get(application.reference) ?? null,
    amendment: amendmentOf(s, application),
    // An officer starts a change of a decision still current (SCR-REG-10, spine amendment A6-2).
    amend:
      decision !== null && decision.summary.status === "CURRENT" && decision.summary.period.to > today()
        ? { decision: decision.summary.reference, to: decision.summary.period.to, today: today() }
        : null,
    correctionDocuments: (application.evidence ?? []).map((entry) => ({ key: entry.key, title: entry.title, digest: entry.digest })),
    dataOwner: holds(staff, "ACT-DAT") && !holds(staff, "ACT-OPS"),
  });
}

const claimUnderReview = (application: Application) => {
  const claim = application.claims.find((entry) => entry.state === "UNDER_REVIEW");
  return claim !== undefined ? { kind: claim.kind, layer: claim.layer } : null;
};

/** SCR-REG-11's read: the application, its claim under review, and the due date a request sent today would carry. */
export function evidenceRequestForm(staff: Staff, ref: string): LoadOutcome<EvidenceRequestForm> {
  if (!holds(staff, "ACT-OPS")) return notAuthorised;
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refusedRead("APPLICATION_NOT_FOUND");
  const latest = application.statements[0] ?? null;
  return ok({
    reference: application.reference,
    premises: premisesOption(s, application.premisesId),
    status: application.status,
    reviewType: application.reviewType,
    completeOn: latest?.completeOn ?? null,
    expectedOn: latest?.expectedOn ?? null,
    claimUnderReview: claimUnderReview(application),
    dueOn: addDays(today(), RESPONSE_DAYS),
    responseVersion: 1,
    blocked: actsOf(application).requestEvidence,
  });
}

/** SCR-REG-12's read: one claim and its evidence, for an officer or the legal authority. */
export function claimReview(staff: Staff, ref: string, claimKey: string): LoadOutcome<ClaimReviewView> {
  if (!holds(staff, "ACT-OPS", "ACT-LGL")) return notAuthorised;
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refusedRead("APPLICATION_NOT_FOUND");
  const claim = application.claims.find((entry) => entry.id === claimKey);
  if (claim === undefined) return refusedRead("ASSERTION_NOT_FOUND");
  const decision = application.decision !== null && decisionOf(s, application.decision.reference)?.summary.status === "CURRENT" ? application.decision.reference : null;
  return ok({
    reference: application.reference,
    premises: premisesOption(s, application.premisesId),
    status: application.status,
    reviewType: application.reviewType,
    completeOn: application.statements[0]?.completeOn ?? null,
    decision,
    claim: caseClaim(claim),
    evidence: (application.evidence ?? []).filter((entry) => "claim" in entry.answers && entry.answers.claim === claim.kind),
    legalReader: holds(staff, "ACT-LGL"),
    blocked: claim.state === "UNDER_REVIEW" ? null : "ASSERTION_NOT_UNDER_REVIEW",
  });
}

/** The registration date an amendment's Effective from may not precede: the premises' first decision's start. */
function registeredOn(s: State, premisesId: string): string | null {
  const starts = s.decisions.filter((entry) => entry.summary.premises.id === premisesId).map((entry) => entry.summary.period.from);
  return starts.length > 0 ? starts.reduce((first, day) => (day < first ? day : first)) : null;
}

/** SCR-REG-13's read: the application, TAR's fee on each outcome, and its dates. */
export function proposalForm(staff: Staff, ref: string): LoadOutcome<ProposalForm> {
  if (!holds(staff, "ACT-OPS")) return notAuthorised;
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refusedRead("APPLICATION_NOT_FOUND");
  const latest = application.statements[0] ?? null;
  // The figures the form shows are worked out, not recorded: the outcome proposed records its own (TAR's Indicate).
  const asApplied = feeOnOutcome(s, application, "DECIDED_AS_APPLIED", false);
  const otherwise = feeOnOutcome(s, application, "DECIDED_OTHERWISE", false);
  const registered = application.kind === "AMENDMENT" && application.prior !== null ? registeredOn(s, application.premisesId) : null;
  return ok({
    reference: application.reference,
    premises: premisesOption(s, application.premisesId),
    status: application.status,
    kind: application.kind,
    reviewType: application.reviewType,
    rulebook: application.rulebook,
    amends: application.prior !== null && registered !== null ? { decision: application.prior, registeredOn: registered } : null,
    fees: { asApplied: asApplied?.totalMinor ?? null, otherwise: otherwise?.totalMinor ?? null, currency: "VND", tariffVersion: asApplied?.tariffVersion ?? otherwise?.tariffVersion ?? "2026.1" },
    dates: {
      completeOn: latest?.completeOn ?? null,
      expectedOn: latest?.expectedOn ?? null,
      deadline: latest?.deadline ?? null,
      toldOn: latest?.toldAt !== null && latest?.toldAt !== undefined ? latest.toldAt.slice(0, 10) : (application.dates?.toldOn ?? null),
    },
    explanationVersion: EXPLANATION,
    blocked: actsOf(application).propose,
  });
}

/** Every proposal of the world with its application. */
function everyProposal(s: State): { application: Application; proposal: Proposal }[] {
  return [...s.applications.values()].flatMap((application) => application.proposals.map((proposal) => ({ application, proposal })));
}

/**
 * SCR-REG-14's reads: GET /applications with awaiting_approval=true, the proposals waiting that the reader did not
 * prepare, oldest first; and the proposal opened, read through its application (spine amendment A6-1).
 */
export function approvals(staff: Staff, proposalId: string | null): LoadOutcome<Approvals> {
  if (!holds(staff, "ACT-BIZ-APR", "ACT-OPS")) return notAuthorised;
  const s = state(staff.sessionId);
  const awaiting: AwaitingRow[] = everyProposal(s)
    .filter(({ proposal }) => proposal.status === "PENDING_APPROVAL" && proposal.preparedBy.email !== staff.email)
    .sort((a, b) => a.proposal.preparedAt.localeCompare(b.proposal.preparedAt))
    .map(({ application, proposal }) => ({
      proposal: proposal.id,
      reference: application.reference,
      premises: premisesOption(s, application.premisesId),
      outcome: proposal.outcome,
      preparedBy: proposal.preparedBy.name,
      preparedAt: proposal.preparedAt,
    }));
  let opened: Approvals["opened"] = null;
  if (proposalId !== null) {
    const found = everyProposal(s).find(({ proposal }) => proposal.id === proposalId);
    if (found === undefined) opened = refusedRead("PROPOSAL_NOT_FOUND");
    else {
      const { application, proposal } = found;
      const detail: ProposalDetail = {
        proposal: caseProposal(proposal),
        reference: application.reference,
        premises: premisesOption(s, application.premisesId),
        applicationStatus: application.status,
        explanationVersion: EXPLANATION,
        fromList: awaiting.some((row) => row.proposal === proposal.id),
        readerIsPreparer: proposal.preparedBy.email === staff.email,
        readerMayDecide: holds(staff, "ACT-BIZ-APR"),
        withdrawal: proposal.status === "CLOSED_BY_WITHDRAWAL" && application.ended?.kind === "WITHDRAWN" && application.ended.instruction !== null ? { instruction: application.ended.instruction } : null,
        issued: proposal.status === "APPROVED" ? (application.decision?.reference ?? null) : null,
      };
      opened = ok(detail);
    }
  }
  return ok({ asOf: now(), awaiting, opened });
}

/** SCR-REG-15's read: the application and what a withdrawal on instruction would close. */
export function withdrawalForm(staff: Staff, ref: string): LoadOutcome<WithdrawalForm> {
  if (!holds(staff, "ACT-OPS")) return notAuthorised;
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refusedRead("APPLICATION_NOT_FOUND");
  const latest = application.statements[0] ?? null;
  const pending = pendingProposal(application);
  return ok({
    reference: application.reference,
    premises: premisesOption(s, application.premisesId),
    status: application.status,
    reviewType: application.reviewType,
    completeOn: latest?.completeOn ?? null,
    expectedOn: latest?.expectedOn ?? null,
    pendingAdverse: pending !== null && pending.outcome !== "DECIDED_AS_APPLIED" ? { outcome: pending.outcome, since: pending.preparedAt } : null,
    openRequest: openRequest(application) !== null,
    blocked: application.status === "DRAFT" ? "NOT_AUTHORISED" : IN_REVIEW.includes(application.status) ? null : "APPLICATION_ALREADY_FINAL",
  });
}

// ---------------------------------------------------------------- the console: commands

const FACT_CODES: readonly FactQuestion[] = QUESTIONS;

/**
 * POST /applications/{id}/fact-declarations by an officer while the application is in review: a new version of
 * one declared fact, labelled corrected and RightOne's; the applicant's value stays as the earlier version.
 */
export function recordCorrection(staff: Staff, ref: string, input: CorrectionInput): CommandAnswer<{ version: number }> {
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  if (application.status !== "UNDER_REVIEW") return refuse("APPLICATION_NOT_UNDER_REVIEW");
  const code = FACT_CODES.find((entry) => entry === input.code);
  const current = application.facts?.find((entry) => entry.code === code && entry.current) ?? null;
  // Only a fact the rules ask the premises to declare is corrected here; the register's are PTY's.
  if (code === undefined || current === null || current.label === "registry-sourced") return refuse("FACT_NOT_IN_RULEBOOK", { field: "value" });
  const value = readAnswer(code, input.value.trim())?.value ?? null;
  if (value === null) return refuse("FACT_VALUE_INVALID", { field: "value" });
  const document = input.document !== null ? (application.evidence?.find((entry) => entry.key === input.document) ?? null) : null;
  const facts = application.facts ?? [];
  const version = facts.filter((entry) => entry.code === code).reduce((latest, entry) => Math.max(latest, entry.version), 0) + 1;
  const on = today();
  current.current = false;
  current.replaced = { by: version, on };
  const index = facts.indexOf(current);
  facts.splice(index, 0, {
    code,
    value,
    version,
    label: "corrected",
    cls: current.cls,
    current: true,
    correction: { corrects: current.version, by: staff.account, on, document: document?.title ?? null },
    replaced: null,
    document: null,
    copiedFrom: null,
    source: null,
  });
  return accept({ version });
}

/** An item code as the request stores it: capitals and hyphens. */
const itemCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "-");

/** POST /applications/{id}/evidence-requests: the items, with one due date; the application waits for them. */
export function requestEvidence(staff: Staff, ref: string, items: readonly EvidenceRequestItem[]): CommandAnswer<{ dueOn: string }> {
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  if (application.status !== "UNDER_REVIEW") return refuse(openRequest(application) !== null ? "EVIDENCE_REQUEST_OPEN" : "APPLICATION_NOT_UNDER_REVIEW");
  if (openRequest(application) !== null) return refuse("EVIDENCE_REQUEST_OPEN");
  if (pendingProposal(application) !== null) return refuse("PROPOSAL_PENDING");
  const asked = items.map((item) => ({ code: itemCode(item.code), description: item.description.trim() }));
  if (asked.length === 0 || asked.some((item) => item.code === "" || item.description === "")) return refuse("EVIDENCE_ITEMS_EMPTY", { field: "items" });
  const at = now();
  const dueOn = addDays(today(), RESPONSE_DAYS);
  application.requests.push({
    askedBy: "REVIEWER",
    by: officer(staff),
    askedAt: at,
    askedOn: today(),
    dueOn,
    state: "OPEN",
    items: asked.map((item) => ({ code: item.code, document: null, description: item.description, receivedOn: null, file: null })),
  });
  application.status = "EVIDENCE_REQUIRED";
  application.history.unshift({ at, event: "EVIDENCE_ASKED", by: "REVIEWER" });
  application.transitions.unshift({ at, from: "UNDER_REVIEW", to: "EVIDENCE_REQUIRED", cause: "EVIDENCE_REQUEST", by: officer(staff) });
  recordStep(s, application, "EVIDENCE_WAIT_START", at);
  // NTF-REG-02 after the request is recorded: until COM issues it, the request does not lapse.
  const request = latestRequest(application);
  if (request !== null) tellOfRequest(s, application, request);
  return accept({ dueOn });
}

/**
 * POST /assertions/{id}/outcomes: the claim's outcome. Before the decision it is applied when the officer decides
 * (DR-289 rows 3, 5 and 6). After it, an acceptance amends the decision from today (row 4); a claim not accepted
 * changes no amount. No outcome moves the payment deadline (FR-REG-035).
 */
export function recordClaimOutcome(staff: Staff, ref: string, claimKey: string, input: ClaimOutcomeInput): CommandAnswer<{ state: ClaimState; decision: string | null }> {
  const s = state(staff.sessionId);
  const application = find(s, ref);
  const claim = application?.claims.find((entry) => entry.id === claimKey) ?? null;
  if (application === null || claim === null) return refuse("ASSERTION_NOT_FOUND");
  if (claim.state !== "UNDER_REVIEW") return refuse("ASSERTION_NOT_UNDER_REVIEW");
  if (!holds(staff, "ACT-OPS", "ACT-LGL")) return refuse("NOT_AUTHORISED");
  const legal = holds(staff, "ACT-LGL");
  if (input.withLegal && !legal) return refuse("NOT_AUTHORISED");
  const outcome = CLAIM_OUTCOMES.find((entry) => entry === input.outcome);
  const reason = input.reason.trim();
  if (outcome === undefined || reason === "") return refuse("OUTCOME_REASON_REQUIRED", { field: "reason" });
  let scope: Period | null = null;
  if (outcome === "PARTLY_ACCEPTED") {
    const { scopeFrom, scopeTo } = input;
    if (scopeFrom === null || scopeTo === null || scopeTo < scopeFrom || scopeFrom < claim.period.from || scopeTo > claim.period.to) {
      return refuse("ACCEPTED_SCOPE_INVALID", { field: "scope" });
    }
    scope = { from: scopeFrom, to: scopeTo };
  }
  const decided = application.decision !== null ? decisionOf(s, application.decision.reference) : null;
  const at = now();
  const recorded = { reason, scope, recordedBy: staff.account, recordedAt: at, legal: legal ? staff.account : null };
  if (decided === null || decided.summary.status !== "CURRENT" || outcome === "NOT_ACCEPTED") {
    claim.state = outcome;
    claim.outcome = recorded;
    // DR-289 row 6: not accepted after the decision, the decision stands and a statement tells the applicant why.
    if (decided !== null && outcome === "NOT_ACCEPTED") notAcceptedAfterDecision(s, application, decided, claim, reason);
    return accept({ state: claim.state, decision: null });
  }
  // After the decision: the acceptance is a change of the decision from today (from its first day, for a decision not
  // yet in effect) to its end, decided by the system on TAR's calculation for those days with the claim as decided
  // (DR-289 row 4, FR-TAR-009). A decision already ended has no day left to change.
  const whole = decided.summary.period;
  const from = today() > whole.from ? today() : whole.from;
  const window: Period | null = from <= whole.to ? { from, to: whole.to } : null;
  const accepted = { state: outcome, scope };
  // Asked first without recording, so a refusal records no calculation (DR-01 row 2).
  const trial = window !== null ? askClaimAmendment(s, application, claim, accepted, window, false) : null;
  if (window !== null && (trial?.outcome !== "CALCULATED" || trial.calculation.classification.scope === "INDETERMINATE")) return refuse("TARIFF_NOT_APPROVED");
  claim.state = outcome;
  claim.outcome = recorded;
  const answer = window !== null ? askClaimAmendment(s, application, claim, accepted, window, true) : null;
  const fee = window !== null && answer?.outcome === "CALCULATED" ? feeOf(answer.calculation, application, window) : null;
  const amendment = window !== null && fee !== null ? amendForClaim(s, application, decided, claim, fee, window, at) : null;
  return accept({ state: claim.state, decision: amendment });
}

/**
 * TAR's question for the system's amendment after a claim is decided (DR-289 row 4): the facts the decision rests on,
 * the days the amendment covers, and every claim of the application, the one decided with its outcome and accepted
 * scope, so the calculator removes the component for the days the acceptance covers (DR-322 rows 3 and 4).
 */
function askClaimAmendment(
  s: State,
  application: Application,
  claim: Claim,
  decided: { state: "ACCEPTED" | "PARTLY_ACCEPTED"; scope: Period | null },
  window: Period,
  record: boolean,
): FeeAnswer | null {
  const facts = caseAnswers(application, "DECIDED_AS_APPLIED");
  if (facts === null) return null;
  const named = `${application.reference}/${claim.id}`;
  const claims = feeClaims(application).map((entry): FeeClaim => (entry.ref === named ? { ...entry, state: decided.state, accepted: decided.scope } : entry));
  return askTariff(s, application, facts.answers, facts.declaredClass, window, record, claims);
}

/**
 * DR-289 row 4: the system's change after a claim is accepted on a decided application. It covers the days of the
 * window, to the end of the decision it amends, at TAR's calculation for them: the accepted layer at 0 for the days the
 * acceptance covers and charged for the rest, every other layer as calculated. The amended decision is superseded from
 * the window's first day and the payment deadline stays where it was.
 */
function amendForClaim(s: State, application: Application, decided: DecisionEntry, claim: Claim, fee: Fee, window: Period, at: string): string | null {
  const record = decided.record;
  if (record === null) return null;
  const { from } = window;
  const remaining = window;
  const scope = claim.state === "PARTLY_ACCEPTED" ? (claim.outcome?.scope ?? null) : null;
  const lines = fee.lines;
  let ref = reference("REG");
  while (s.applications.has(ref)) ref = reference("REG");
  let obd = reference("OBD");
  while (decisionOf(s, obd) !== null) obd = reference("OBD");
  const total = fee.totalMinor;
  const summaryRow: DecisionSummary = {
    ...decided.summary,
    reference: obd,
    outcome: total > 0 ? "PAYABLE" : "NO_PAYABLE_OBLIGATION",
    note: null,
    feeMinor: total,
    period: remaining,
    replaces: decided.summary.reference,
    replacedBy: null,
  };
  const amended: DecisionRecord = {
    ...record,
    reference: obd,
    outcome: summaryRow.outcome,
    issuedAt: at,
    period: remaining,
    basis: fee.basis ?? "TARIFF",
    lines,
    tariffVersion: fee.tariffVersion,
    claim: claim.state === "PARTLY_ACCEPTED" && scope !== null ? { state: "PARTLY_ACCEPTED", accepted: scope } : null,
    otherwise: null,
    replacedBy: null,
    application: ref,
    prior: decided.summary.reference,
    lateStatement: null,
    // The calculation TAR recorded for the window, with the claim as decided (FR-TAR-009, FR-TAR-010).
    calculation: fee.calculation ?? null,
    declaredClassification: fee.declaredClass ?? record.declaredClassification ?? false,
    route: "AUTOMATED",
    governingOn: remaining.from,
    transitionRule: fee.transitionRule ?? null,
  };
  decided.summary.status = "SUPERSEDED";
  decided.summary.replacedBy = { reference: obd, from };
  decided.record = { ...record, status: "SUPERSEDED", replacedBy: { reference: obd, from } };
  s.decisions.unshift({ summary: summaryRow, record: amended });
  const facts = s.decisionFacts.get(decided.summary.reference);
  if (facts !== undefined) s.decisionFacts.set(obd, facts);
  s.applications.set(ref, {
    reference: ref,
    premisesId: application.premisesId,
    kind: "AMENDMENT",
    startedByRightOne: true,
    status: "DECIDED",
    savedAt: null,
    sentAt: at,
    review: "NONE",
    requests: [],
    dates: application.dates,
    claims: [],
    history: [
      { at, event: "DECIDED", decision: obd, afterDocument: false },
      { at, event: "SENT", route: "RULES", claim: null },
      { at, event: "STARTED" },
    ],
    decision: { reference: obd, issuedAt: at },
    ended: null,
    work: null,
    period: remaining,
    prior: decided.summary.reference,
    reviewType: null,
    route: "AUTOMATED",
    rulebook: application.rulebook,
    facts: application.facts?.map((entry) => ({ ...entry, copiedFrom: entry.current ? application.reference : entry.copiedFrom })) ?? null,
    evidence: [],
    attestations: application.attestations,
    statements: [],
    transitions: [
      { at, from: "SUBMITTED", to: "DECIDED", cause: "CLAIM_OUTCOME", by: RIGHTONE },
      { at, from: "DRAFT", to: "SUBMITTED", cause: "SUBMISSION", by: RIGHTONE },
      { at, from: null, to: "DRAFT", cause: "START", by: RIGHTONE },
    ],
    proposals: [],
    answers: application.answers,
  });
  s.order.unshift(ref);
  s.amendments.set(ref, { cause: "CLAIM_OUTCOME", caseRef: null, decision: decided.summary.reference, initiatedBy: "SYSTEM", by: RIGHTONE });
  const made = s.applications.get(ref);
  if (made !== undefined) {
    for (const code of ["START", "SUBMISSION", "DECISION"] as const) recordStep(s, made, code, at);
    s.outcomes.push({ on: today(), kind: "DECIDED", withAdverse: false, reference: ref, split: "AS_APPLIED" });
    tellDecision(s, made, summaryRow, amended);
  }
  return obd;
}

/**
 * DR-289 row 6, after the decision: the claim is not accepted, so the component stays charged and the decision
 * stands, now otherwise than applied for. The statement says why, what was not shown, what the applicant can do and
 * the appeal route, and NTF-REG-03 carries it; the decision reads the claim as decided from then on.
 */
function notAcceptedAfterDecision(s: State, application: Application, decided: DecisionEntry, claim: Claim, reason: string): void {
  const ref = decided.summary.reference;
  s.claimStatements.set(ref, { claim: claim.id, kind: claim.kind, layer: claim.layer, period: claim.period, reason, on: today() });
  raiseNotice(s, application, "NTF-REG-03", `${ref}/${claim.id}`, {
    decision: ref,
    outcome: "DECIDED_OTHERWISE",
    reason,
    claim: claim.kind,
    layer: claim.layer,
    appealRoute: `explanation-${String(decided.record?.explanationVersion ?? EXPLANATION)}`,
    by: decided.summary.payBy ?? today(),
  });
}

/**
 * POST /applications/{id}/decision-proposals: an outcome decided as applied for is issued at once; a refusal or a
 * decision otherwise than applied for waits for a business approver other than the officer (CFG-329, DR-290).
 * Checked in the contract's order; nothing is recorded by a refusal.
 */
export function recordProposal(staff: Staff, ref: string, input: ProposalInput): CommandAnswer<{ proposal: string; decision: string | null }> {
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  if (application.status !== "UNDER_REVIEW") return refuse("APPLICATION_NOT_UNDER_REVIEW");
  if (pendingProposal(application) !== null) return refuse("PROPOSAL_PENDING");
  const outcome = OUTCOMES.find((entry) => entry === input.outcome);
  if (outcome === undefined) return refuse("STATEMENT_INCOMPLETE", { field: "outcome" });
  const unmet = input.unmet.map((line) => line.trim()).filter((line) => line !== "");
  const adverse = outcome !== "DECIDED_AS_APPLIED";
  if (adverse) {
    const missing = input.reason.trim() === "" ? "reason" : input.text.trim() === "" ? "text" : unmet.length === 0 ? "unmet" : input.actionOpen.trim() === "" ? "actionOpen" : null;
    if (missing !== null) return refuse("STATEMENT_INCOMPLETE", { field: missing });
  }
  const registered = application.kind === "AMENDMENT" ? registeredOn(s, application.premisesId) : null;
  if (input.effectiveFrom !== null && registered !== null && input.effectiveFrom < registered) return refuse("PRE_REGISTRATION_OBLIGATION_RESERVED", { field: "effectiveFrom" });
  const fee = outcome === "REFUSED" ? null : feeOnOutcome(s, application, outcome);
  if (outcome !== "REFUSED" && fee === null) return refuse("TARIFF_NOT_APPROVED");
  if (outcome === "DECIDED_AS_APPLIED") {
    const period = application.period;
    const governing = period === null ? null : governingDecision(s, application.premisesId, period);
    if (period === null || (application.kind !== "AMENDMENT" && governing !== null)) return refuse("INTENDED_PERIOD_INVALID", { governingDecision: governing });
  }
  const at = now();
  const proposal: Proposal = {
    id: randomUUID(),
    outcome,
    status: adverse ? "PENDING_APPROVAL" : "ISSUED_WITHOUT_APPROVAL",
    reason: adverse ? input.reason.trim() : null,
    text: adverse ? input.text.trim() : null,
    unmet: adverse ? unmet : [],
    actionOpen: adverse ? input.actionOpen.trim() : null,
    effectiveFrom: input.effectiveFrom,
    preparedBy: memberOf(staff),
    preparedAt: at,
    verdict: null,
    fee,
  };
  application.proposals.push(proposal);
  const decision = !adverse && fee !== null ? issueDecision(s, application, proposal, fee, officer(staff), at) : null;
  return accept({ proposal: proposal.id, decision });
}

/**
 * POST /decision-proposals/{id}/verdicts: approved, which issues the outcome, or returned with the note. The
 * preparer is told SEGREGATION_REQUIRED before the authority is read, so the reason that applies is the one said
 * (DR-290 rows 6 and 7).
 */
export function recordVerdict(staff: Staff, proposalId: string, input: VerdictInput): CommandAnswer<{ status: ProposalStatus; decision: string | null }> {
  const s = state(staff.sessionId);
  const found = everyProposal(s).find(({ proposal }) => proposal.id === proposalId);
  if (found === undefined) return refuse("PROPOSAL_NOT_FOUND");
  const { application, proposal } = found;
  if (proposal.status !== "PENDING_APPROVAL") return refuse("PROPOSAL_NOT_PENDING");
  if (proposal.preparedBy.email === staff.email) return refuse("SEGREGATION_REQUIRED");
  if (!holds(staff, "ACT-BIZ-APR")) return refuse("NOT_AUTHORISED");
  const note = input.note.trim();
  if (input.verdict === "RETURNED") {
    if (note === "") return refuse("VERDICT_NOTE_REQUIRED", { field: "note" });
    proposal.status = "RETURNED";
    proposal.verdict = { by: memberOf(staff), at: now(), note };
    return accept({ status: proposal.status, decision: null });
  }
  if (input.verdict !== "APPROVED") return refuse("VERDICT_NOTE_REQUIRED", { field: "note" });
  const approver: Actor = { name: staff.account, role: "APPROVER", party: null };
  const at = now();
  if (proposal.outcome === "REFUSED") {
    proposal.status = "APPROVED";
    proposal.verdict = { by: memberOf(staff), at, note: note === "" ? null : note };
    refuseApplication(s, application, proposal, approver, at);
    return accept({ status: proposal.status, decision: null });
  }
  // An approval issues the decision, so TAR's arithmetic is reproduced for the same facts first.
  const fee = feeOnOutcome(s, application, proposal.outcome === "DECIDED_OTHERWISE" ? "DECIDED_OTHERWISE" : "DECIDED_AS_APPLIED");
  if (fee === null) return refuse("TARIFF_NOT_APPROVED");
  const period = application.period;
  const governing = period === null ? null : governingDecision(s, application.premisesId, period);
  if (period === null || (application.kind !== "AMENDMENT" && governing !== null)) return refuse("INTENDED_PERIOD_INVALID", { governingDecision: governing });
  proposal.status = "APPROVED";
  proposal.verdict = { by: memberOf(staff), at, note: note === "" ? null : note };
  proposal.fee = fee;
  const decision = issueDecision(s, application, proposal, fee, approver, at);
  return accept({ status: proposal.status, decision });
}

/**
 * POST /applications/{id}/withdrawals by an officer: only on the applicant's recorded instruction, never on a
 * draft (the applicant's alone), and never on an application that has ended - a refusal is never recorded as a
 * withdrawal (FR-REG-032, SEC-288).
 */
export function recordOfficerWithdrawal(staff: Staff, ref: string, input: WithdrawalInput): CommandAnswer<{ status: ApplicationStatus }> {
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  if (!OPEN.includes(application.status)) return refuse("APPLICATION_ALREADY_FINAL");
  if (application.status === "DRAFT") return refuse("NOT_AUTHORISED");
  const instruction = input.instruction.trim();
  if (instruction === "") return refuse("WITHDRAWAL_INSTRUCTION_REQUIRED", { field: "instruction" });
  withdraw(s, application, now(), instruction, officer(staff));
  // The applicant's reason, as given: kept with the act, never a column of its own (`reason_text`).
  const reason = input.reason.trim();
  if (reason !== "") s.withdrawalReasons.set(application.reference, reason);
  return accept({ status: application.status });
}

// ---------------------------------------------------------------- the console: the officer's amendment

/**
 * POST /applications by an operations officer (PERM-590, spine amendment A6-2): an amendment of a decision for an
 * appeal outcome or a reconciled classification only, checked in the contract's order. The draft runs from the day
 * given to the end of the decision it changes (ALG-261 step 7) and is routed to review as an amendment from its start
 * (DR-285 row 2). It copies the facts the decision rests on with their documents (ALG-266), so nothing is asked of the
 * premises unless an answer in it changes; the officer sends it from the case file.
 */
export function startOfficerAmendment(staff: Staff, decisionRef: string, input: AmendmentInput): CommandAnswer<{ application: string }> {
  const s = state(staff.sessionId);
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const cause = input.cause.trim();
  // A premises cause is the premises' to give (PERM-590).
  if ((CAUSES as readonly string[]).includes(cause)) return refuse("NOT_AUTHORISED", { field: "cause" });
  const prior = decisionOf(s, decisionRef);
  if (prior === null) return refuse("PRIOR_DECISION_NOT_FOUND");
  if (prior.summary.status === "SUPERSEDED") return refuse("PRIOR_DECISION_SUPERSEDED");
  const { from } = input;
  const end = prior.summary.period.to;
  if (from === null || from >= end) return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
  const officerCause = OFFICER_CAUSES.find((entry) => entry === cause);
  const caseRef = input.caseRef.trim().toUpperCase();
  if (officerCause === undefined) return refuse("AMENDMENT_CAUSE_REQUIRED", { field: "cause" });
  if (officerCause === "APPEAL_OUTCOME" && caseRef === "") return refuse("AMENDMENT_CAUSE_REQUIRED", { field: "caseRef" });
  // ICaseStatus.StateAsOf: the case must exist and be decided.
  if (officerCause === "APPEAL_OUTCOME" && caseDecisionFor(s.world, caseRef)?.decided !== true) return refuse("APPEAL_CASE_NOT_FOUND", { field: "caseRef" });
  const premisesId = prior.summary.premises.id;
  const open = [...s.applications.values()].find((application) => application.premisesId === premisesId && application.kind === "AMENDMENT" && OPEN.includes(application.status));
  if (open !== undefined) return refuse("OPEN_APPLICATION_EXISTS", { openApplication: open.reference });

  let ref = reference("REG");
  while (s.applications.has(ref)) ref = reference("REG");
  const register = s.seed.register.premises[premisesId] ?? null;
  const knownClass = register?.premisesClass ?? null;
  const questions: readonly FactQuestion[] = knownClass === null ? QUESTIONS : QUESTIONS.filter((question) => question !== "premises_class");
  const copiedFacts = s.decisionFacts.get(prior.summary.reference) ?? null;
  const answers: FactAnswers = copiedFacts ?? { premisesClass: null, customerArea: null, daysOpen: null, musicMethod: null, useBeganOn: null };
  // Carried as decided, as a claim-outcome amendment carries them: confirmed already, unless the premises changes one.
  const copied = copiedFacts === null ? null : Object.fromEntries(questions.filter((question) => answerOf(answers, question) !== null).map((question) => [question, true]));
  const period: Period = { from, to: end };
  const at = now();
  const by = officer(staff);
  const party = partyOfPremises(s, premisesId);
  s.applications.set(ref, {
    reference: ref,
    premisesId,
    kind: "AMENDMENT",
    startedByRightOne: true,
    status: "DRAFT",
    savedAt: null,
    sentAt: null,
    review: null,
    requests: [],
    dates: null,
    claims: [],
    history: [{ at, event: "STARTED" }],
    decision: null,
    ended: null,
    work: {
      period,
      prior: prior.summary.reference,
      cause: officerCause,
      known: {
        // The register's answer for the party; none where it holds none, which the case file then leaves out.
        businessRegistration: (party !== null ? s.review.parties[party]?.businessRegistration : null) ?? "",
        administrativeArea: register?.administrativeArea ?? null,
        premisesClass: knownClass,
        classChanged: register?.classChanged ?? false,
      },
      questions,
      answers: { ...answers, premisesClass: knownClass === null ? answers.premisesClass : null },
      copied,
      documents: [],
      presentation: null,
      attestation: null,
    },
    period,
    prior: prior.summary.reference,
    reviewType: "AMENDMENT",
    route: "MANUAL",
    // The rulebook in force on the day the change takes effect, not the day it was started (DR-288 row 3, FR-REG-013).
    rulebook: rulebookAt(s, period.from) ?? "",
    facts: null,
    evidence: null,
    attestations: null,
    statements: [],
    transitions: [{ at, from: null, to: "DRAFT", cause: "START", by }],
    proposals: [],
    answers: null,
  });
  s.order.unshift(ref);
  s.amendments.set(ref, { cause: officerCause, caseRef: officerCause === "APPEAL_OUTCOME" ? caseRef : null, decision: prior.summary.reference, initiatedBy: "OFFICER", by });
  const started = s.applications.get(ref);
  if (started !== undefined) recordStep(s, started, "START", at);
  return accept({ application: ref });
}

/**
 * POST /applications/{id}/submissions by an operations officer, for an amendment an officer started (PERM-599, spine
 * amendment A6-2), checked in the contract's order. Its facts unchanged, it carries the attestation of the decision
 * it amends (DR-286 row 4); an answer the premises changed needs the premises' own confirmation first
 * (ATTESTATION_REQUIRED). Sent, it is in the amendment review queue with its dates stated, and the premises is told.
 */
export function sendOfficerAmendment(staff: Staff, ref: string): CommandAnswer<{ status: ApplicationStatus }> {
  const s = state(staff.sessionId);
  const application = find(s, ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const work = application.work;
  const held = sendHeld(s, application);
  if (held !== null || work === null) return refuse(held ?? "APPLICATION_NOT_EDITABLE", work !== null && held === "REQUIRED_ITEMS_MISSING" ? { missing: missingItems(application, work) } : {});
  const amendment = s.amendments.get(ref) ?? null;
  if (amendment?.initiatedBy !== "OFFICER") return refuse("NOT_AUTHORISED");
  const attested = work.attestation !== null && work.attestation.digest === digest(work);

  const sentAt = now();
  const amended = decisionOf(s, amendment.decision);
  const carried = amended?.record?.application !== null && amended?.record?.application !== undefined ? find(s, amended.record.application) : null;
  const party = partyOfPremises(s, application.premisesId);
  const principal: Actor = { name: null, role: "PRINCIPAL", party: party !== null ? organisationName(party) : null };
  const confirmedAt = attested && work.attestation !== null ? work.attestation.at : (carried?.attestations?.find((entry) => !entry.superseded)?.at ?? sentAt);
  // Never null here: an unanswered date is a missing item, refused above.
  const useBeganOn = work.answers.useBeganOn ?? today();
  application.status = "UNDER_REVIEW";
  application.sentAt = sentAt;
  application.savedAt = null;
  application.review = "AMENDMENT";
  application.rulebook = rulebookAt(s, governingOn(work)) ?? application.rulebook;
  application.period = work.period;
  application.prior = work.prior;
  application.dates = statement(today(), useBeganOn);
  application.statements.unshift(statementRow(application, application.dates, sentAt));
  application.history.unshift({ at: sentAt, event: "SENT", route: "AMENDMENT_REVIEW", claim: null });
  application.transitions.unshift(
    { at: sentAt, from: "SUBMITTED", to: "UNDER_REVIEW", cause: "ROUTING", by: RIGHTONE },
    { at: sentAt, from: "DRAFT", to: "SUBMITTED", cause: "SUBMISSION", by: officer(staff) },
  );
  caseFromWork(s, application, work, principal, confirmedAt);
  application.facts = application.facts?.filter((fact) => fact.code !== "business_registration" || fact.value !== "") ?? null;
  // DR-286 row 4: the facts unchanged, the amended decision's attestation is the one this amendment rests on.
  if (!attested && carried?.attestations !== null && carried?.attestations !== undefined) application.attestations = carried.attestations.map((entry) => ({ ...entry }));
  application.answers = { ...work.answers, premisesClass: work.known.premisesClass ?? work.answers.premisesClass };
  application.work = null;
  submitted(s, application, confirmedAt, sentAt);
  return accept({ status: application.status });
}

// ---------------------------------------------------------------- reporting and policy

/** The first and last day of the calendar month a day falls in. */
function monthOf(day: string): ReportPeriodValue {
  const [y, m] = day.split("-").map(Number);
  if (y === undefined || m === undefined) return { from: day, to: day };
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${String(y)}-${mm}-01`, to: `${String(y)}-${mm}-${String(last).padStart(2, "0")}` };
}

type ReportPeriodValue = { from: string; to: string };

/** The two readings `GET /reports/completion-times` takes as `measure`; any other is CURSOR_INVALID (@AC-FR-REG-039-03). */
const MEASURES = ["CONFIRMATION_RECORD", "INTERIM_TO_DECISION"] as const;

/** An ordinary registration (DR-285): a first registration the rules decided on the automated route, which a premises started. */
const ordinary = (application: Application) => application.kind === "NEW" && application.route === "AUTOMATED" && !application.startedByRightOne;

/** The local day an application was decided on, from its history. */
function decidedOn(application: Application): string | null {
  const decided = application.history.find((entry) => entry.event === "DECIDED");
  return decided?.at !== null && decided?.at !== undefined ? addDays(decided.at, 0) : null;
}

/** Nearest rank, without interpolation, so each figure is one of the recorded values (ALG-264 step 8). */
function nearestRank(sorted: readonly number[], share: number): number | null {
  return sorted.length === 0 ? null : (sorted[Math.ceil(share * sorted.length) - 1] ?? null);
}

/**
 * ALG-264 steps 10 and 11 for one registration: from its START step to its DECISION step, each interval named by the
 * step it led to, a wait on the applicant named as such rather than left out; the step with the largest total is
 * where the time accrued, a tie going to the step that began earliest. Null where the steps do not bound it.
 */
function interimOf(s: State, application: Application): { seconds: number; step: string } | null {
  const steps = [...(s.steps.get(application.reference) ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  const start = steps.find((entry) => entry.code === "START");
  const stop = steps.find((entry) => entry.code === "DECISION");
  if (start === undefined || stop === undefined) return null;
  const totals = new Map<string, { seconds: number; first: number }>();
  const [begin, end] = [Date.parse(start.at), Date.parse(stop.at)];
  let previous = begin;
  let waiting = false;
  for (const entry of steps) {
    const at = Date.parse(entry.at);
    if (entry === start || at < begin || at > end) continue;
    // The interval up to the start of a wait runs on into the wait, which is named when it ends.
    if (entry.code === "EVIDENCE_WAIT_START") {
      waiting = true;
      continue;
    }
    const name = waiting || entry.code === "EVIDENCE_WAIT_END" ? "EVIDENCE_WAIT" : entry.code;
    if (entry.code === "EVIDENCE_WAIT_END") waiting = false;
    const total = totals.get(name) ?? { seconds: 0, first: previous };
    totals.set(name, { seconds: total.seconds + (at - previous) / 1000, first: total.first });
    previous = at;
    if (entry === stop) break;
  }
  const seconds = Math.floor((Date.parse(stop.at) - Date.parse(start.at)) / 1000);
  const accrual = [...totals.entries()].sort(([, a], [, b]) => b.seconds - a.seconds || a.first - b.first)[0]?.[0] ?? "DECISION";
  return { seconds, step: accrual };
}

/**
 * GET /reports/completion-times and /reports/outcomes for a period: the board's September figures where the
 * period covers that whole month, and every application of this world that ended in the period. Nothing is
 * measured while CER's record event is not consumed (the P1 state): each ordinary registration decided in the period
 * is not yet measured, its own figure and never 0, and the interim reading to the decision is worked out from its
 * step events (ALG-264 steps 10 to 12), the board's month standing in only where the world decided none.
 */
export function registrationReports(staff: Staff, fromText: string | null, toText: string | null, measure: string | null = null): LoadOutcome<RegistrationReports> {
  if (!holds(staff, "ACT-REP", "ACT-OPS")) return notAuthorised;
  const s = state(staff.sessionId);
  const month = monthOf(today());
  const from = fromText === null ? month.from : isoDate(fromText);
  const to = toText === null ? month.to : isoDate(toText);
  if (from === null || to === null || to < from || daysIn({ from, to }) > 366) return refusedRead("REPORT_PERIOD_INVALID");
  if (measure !== null && !(MEASURES as readonly string[]).includes(measure)) return refusedRead("CURSOR_INVALID");
  const months = s.review.reports.filter((entry) => {
    const whole = monthOf(`${entry.month}-01`);
    return whole.from >= from && whole.to <= to;
  });
  const live = s.outcomes.filter((event) => event.on >= from && event.on <= to);
  const count = (kind: OutcomeEvent["kind"]) => live.filter((event) => event.kind === kind).length;
  const sum = (pick: (entry: (typeof months)[number]) => number) => months.reduce((total, entry) => total + pick(entry), 0);
  const known = (reference: string) => s.applications.has(reference);
  const row = (entry: (typeof months)[number]["interim"]["rows"][number]): OverBaselineRow => ({ ...entry, caseFile: known(entry.reference) });
  const single = months.length === 1 ? months[0] : undefined;
  // The ordinary registrations of this world decided in the period: none has a confirmation record yet.
  const decided = [...s.applications.values()].filter((application) => {
    const on = application.status === "DECIDED" && ordinary(application) ? decidedOn(application) : null;
    return on !== null && on >= from && on <= to;
  });
  const fallback = decided.filter((application) => application.facts?.some((fact) => fact.code === "premises_class" && fact.cls === "declared") === true).length;
  const readings = decided.flatMap((application) => {
    const reading = interimOf(s, application);
    return reading === null ? [] : [{ application, ...reading }];
  });
  const sorted = readings.map((reading) => reading.seconds).sort((a, b) => a - b);
  const median = nearestRank(sorted, 0.5);
  const p90 = nearestRank(sorted, 0.9);
  const overRows = readings
    .filter((reading) => reading.seconds > BASELINE_SECONDS)
    .map((reading): OverBaselineRow => ({ reference: reading.application.reference, premises: premisesName(s, reading.application.premisesId), seconds: reading.seconds, excludedSeconds: null, step: reading.step, caseFile: true }));
  const notYet = sum((entry) => entry.ordinaryDecided) + decided.length;
  return ok({
    period: { from, to },
    asOf: now(),
    completion: {
      baselineSeconds: BASELINE_SECONDS,
      measured: 0,
      medianSeconds: null,
      p90Seconds: null,
      over: null,
      notYetMeasured: notYet,
      declaredFallback: sum((entry) => entry.declaredFallback) + fallback,
      rows: [],
      interim:
        median !== null && p90 !== null
          ? { decided: readings.length, medianSeconds: median, p90Seconds: p90, over: overRows.length, rows: overRows }
          : single !== undefined && single.ordinaryDecided > 0
            ? { decided: single.ordinaryDecided, medianSeconds: single.interim.medianSeconds, p90Seconds: single.interim.p90Seconds, over: single.interim.over, rows: single.interim.rows.map(row) }
            : null,
    },
    outcomes: {
      decided: sum((entry) => entry.outcomes.decided) + count("DECIDED"),
      refused: sum((entry) => entry.outcomes.refused) + count("REFUSED"),
      withdrawn: sum((entry) => entry.outcomes.withdrawn) + count("WITHDRAWN"),
      closed: sum((entry) => entry.outcomes.closed) + count("CLOSED"),
      withdrawnWithAdverse: sum((entry) => entry.outcomes.withdrawnWithAdverse) + live.filter((event) => event.withAdverse).length,
      withdrawnWithAdverseRefs: live.filter((event) => event.withAdverse).map((event) => event.reference),
    },
  });
}

const RULES: readonly RuleCode[] = [
  "REG-OBLIGATION-RULEBOOK",
  "REG-EXPLANATION",
  "REG-REVIEW-PERIODS",
  "REG-EVIDENCE-RESPONSE",
  "REG-DECISION-RESERVATION",
  "REG-AMNESTY-PERIOD",
  "REG-PRE-REGISTRATION",
];

/** An instant as the API takes it: ISO 8601 with its offset. */
const isInstant = (text: string) => !Number.isNaN(Date.parse(text)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text);

/** GET /policies/effective at an instant: each rule's version in force then, or none and its default, and any later one approved. */
export function registrationPolicy(staff: Staff, asOf: string | null): LoadOutcome<RegistrationPolicy> {
  if (!holds(staff, "ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS")) return notAuthorised;
  const s = state(staff.sessionId);
  const instant = asOf ?? now();
  if (!isInstant(instant)) return refusedRead("AS_OF_REQUIRED");
  const day = addDays(instant, 0);
  const rows: PolicyRow[] = RULES.map((rule) => {
    const versions = s.review.policy.filter((entry) => entry.rule === rule).sort((a, b) => a.from.localeCompare(b.from));
    const inForce = versions.filter((entry) => entry.from <= day).pop() ?? null;
    const later = versions.find((entry) => entry.from > day) ?? null;
    return {
      rule,
      // An amnesty version names its first and last day (FR-REG-021).
      version: inForce !== null ? { id: inForce.id, from: inForce.from, ...(inForce.amnesty !== undefined ? { amnesty: { ...inForce.amnesty.period } } : {}) } : null,
      later: later !== null ? { id: later.id, from: later.from, ...(later.amnesty !== undefined ? { amnesty: { ...later.amnesty.period } } : {}) } : null,
      // `default_in_force`: the configuration point whose tested default applies while no version is approved.
      defaultInForce: inForce === null ? DEFAULTS[rule] : null,
      // The pre-registration entry says which DR-22 row applies: row 3 until DEC-13 approves a rule, row 4 then.
      ...(rule === "REG-PRE-REGISTRATION" ? { preRegistrationRow: inForce === null ? (3 as const) : (4 as const) } : {}),
    };
  });
  return ok({ asOf: instant, rows });
}

/** The configuration point each rule code resolves under (frd/13): its tested default is what applies without a version. */
const DEFAULTS: Readonly<Record<RuleCode, string>> = {
  "REG-OBLIGATION-RULEBOOK": "CFG-325",
  "REG-EXPLANATION": "CFG-326",
  "REG-REVIEW-PERIODS": "CFG-327",
  "REG-EVIDENCE-RESPONSE": "CFG-328",
  "REG-DECISION-RESERVATION": "CFG-329",
  "REG-AMNESTY-PERIOD": "CFG-12",
  "REG-PRE-REGISTRATION": "CFG-12",
};

/** GET /premises/{premisesId}/use-starts: every date recorded for a premises, newest first, the newest in force. */
export function useStartRecord(staff: Staff, premisesId: string | null, applicationRef: string | null): LoadOutcome<UseStartRecord> {
  if (!holds(staff, "ACT-DAT", "ACT-OPS", "ACT-POL-APR")) return notAuthorised;
  const s = state(staff.sessionId);
  const fromCase = applicationRef !== null ? find(s, applicationRef) : null;
  if (applicationRef !== null && fromCase === null) return refusedRead("APPLICATION_NOT_FOUND");
  const chosen = fromCase?.premisesId ?? premisesId;
  const options = [...s.premises.values()].map(({ id, name }) => ({ id, name }));
  const premises = chosen !== null && s.premises.has(chosen) ? premisesOption(s, chosen) : null;
  const recorded = premises === null ? [] : s.useStarts.filter((entry) => entry.premisesId === premises.id);
  const rows: UseStartRow[] = recorded
    .map((entry, index) => ({
      key: `${entry.source}-${String(index)}`,
      date: entry.date,
      inForce: index === recorded.length - 1,
      cls: entry.cls,
      source: entry.source,
      recordedOn: entry.recordedOn,
      // A correction is a new row: it names the row it corrects, which stays as it was (SEC-287).
      corrects: entry.corrects?.date ?? null,
    }))
    .reverse();
  return ok({ premises, asOf: now(), rows, options, application: fromCase?.reference ?? null });
}

// ---------------------------------------------------------------- what other families read

/*
 * The decisions as other families need them: FIN collects the fee a decision sets, CER issues the status record a
 * decision leads to. Every decision counts, the seeded ones and those issued or approved on the operations console,
 * so a decision recorded today is payable and certifiable like one the canvas draws. These signatures are the
 * contract between the families; the body follows wherever this family keeps its decisions.
 */

/** Every decision's reference, the latest first. */
export function decisionReferences(key: string): readonly string[] {
  return state(key).decisions.map((decision) => decision.summary.reference);
}

/** One decision with its list row, as it reads now, or null when there is none (or the data draws it only as a row). */
export function decisionForCollection(key: string, ref: string): { summary: DecisionSummary; record: DecisionRecord } | null {
  const s = state(key);
  const decision = decisionOf(s, ref);
  return decision !== null && decision.record !== null ? { summary: summaryNow(s, decision), record: recordNow(s, decision, decision.record) } : null;
}

/**
 * Whether a decision rests on a declared classification (`rests_on_declared_classification`): the premises class
 * TAR's calculation used was the applicant's declaration, not the register's. A decision the canvas draws carries no
 * calculation, so it is read from its application having gone to a rulebook-exception review. CER's `DR-431` (row 1)
 * routes the status record such a decision calls for to an independent approver.
 */
export function restsOnDeclaredClassification(key: string, ref: string): boolean {
  const s = state(key);
  const record = decisionOf(s, ref)?.record ?? null;
  if (record?.declaredClassification !== undefined) return record.declaredClassification;
  const application = record?.application ?? null;
  return application !== null && find(s, application)?.review === "RULEBOOK";
}

/**
 * The facts a decision's fee rests on, as the premises answered them: TAR shows them as the calculation's inputs
 * (SCR-TAR-08, 09, 14). Null for a decision whose facts the data does not hold.
 */
export function decisionFactsOf(key: string, ref: string): FactAnswers | null {
  return state(key).decisionFacts.get(ref) ?? null;
}

/*
 * What CAS and VER read of registration (srs/07: `IObligationDecisionReader.DeadlineStateAt`,
 * `IRegistrationReader.OpenFactChangeReportsAt`). They name a premises by its trading name, as PTY and VER join this
 * family; a premises the world's registration does not hold is answered for by nobody here.
 */

/** The most premises one call of `openFactChangeReportsAt` answers (srs/07, @AC-FR-REG-040-03). */
const REPORTS_BATCH = 500;

const premisesNamed = (s: State, name: string): readonly string[] => [...s.premises.values()].filter((entry) => entry.name === name).map((entry) => entry.id);

/**
 * DR-23 at an instant (ALG-262 steps 4 to 7): the decision that governs the local date of `at` - a current one over
 * its period, a replaced one over the days before its successor takes effect - and whether that date falls within its
 * statutory deadline or after it. Null is NONE: no decision governs that day. Reading changes nothing and raises
 * nothing (@AC-FR-REG-023-04).
 */
export function deadlineStateAt(key: string, premises: string, at: string): { state: "WITHIN_DEADLINE" | "PAST_DEADLINE"; on: string } | null {
  const s = state(key);
  const day = addDays(at, 0);
  const ids = premisesNamed(s, premises);
  const governs = ({ summary }: DecisionEntry) =>
    ids.includes(summary.premises.id) &&
    summary.period.from <= day &&
    day <= summary.period.to &&
    (summary.status === "CURRENT" || (summary.replacedBy !== null && day < summary.replacedBy.from));
  const entry = s.decisions.find(governs) ?? null;
  if (entry === null) return null;
  const deadline = entry.record !== null ? deadlineOf(entry.record, day) : deadlineOf({ useBeganOn: null, payBy: entry.summary.payBy }, day);
  return deadline === null ? null : { state: deadline.state, on: deadline.on };
}

/**
 * Per premises, the open reports of a changed fee-determining fact at an instant (FR-REG-040): the amendments with the
 * cause FACT_CHANGE_REPORTED submitted by then that have produced no re-decided obligation, each with its reference
 * and the day it was submitted. A draft is not a report. A premises this world holds answers an empty list when it has
 * none; one it does not hold is left out. More premises than one batch holds is refused, and nothing is answered.
 */
export function openFactChangeReportsAt(key: string, premises: readonly string[], at: string): ReadonlyMap<string, readonly { application: string; submittedOn: string }[]> {
  if (premises.length > REPORTS_BATCH) throw new RangeError(`openFactChangeReportsAt answers at most ${String(REPORTS_BATCH)} premises a call`);
  const s = state(key);
  const answer = new Map<string, { application: string; submittedOn: string }[]>();
  for (const name of premises) {
    const ids = premisesNamed(s, name);
    if (ids.length === 0) continue;
    const open = s.order
      .map((ref) => s.applications.get(ref))
      .filter(
        (application): application is Application =>
          application !== undefined &&
          ids.includes(application.premisesId) &&
          application.kind === "AMENDMENT" &&
          s.amendments.get(application.reference)?.cause === "FACT_CHANGE_REPORTED" &&
          (application.status === "SUBMITTED" || application.status === "UNDER_REVIEW" || application.status === "EVIDENCE_REQUIRED") &&
          application.sentAt !== null &&
          Date.parse(application.sentAt) <= Date.parse(at),
      )
      .map((application) => ({ application: application.reference, submittedOn: addDays(application.sentAt ?? at, 0) }));
    answer.set(name, open);
  }
  return answer;
}
