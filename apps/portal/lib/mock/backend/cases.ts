import { randomUUID } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  AppealForm,
  AppealPage,
  AppealState,
  AppealSummary,
  ApprovalsQueue,
  AnswerOutcome,
  ArtefactKind,
  BusinessImpact,
  CaseAnswer,
  CaseDecision,
  CaseQueue,
  CaseReader,
  CaseState,
  CaseSummary,
  CaseView,
  CategoryPolicyView,
  CommandAnswer,
  ConsoleCaseView,
  DecisionPage,
  DecisionValues,
  Derivation,
  DisclosureStatus,
  Disposition,
  EvidenceHeld,
  EvidenceItemRow,
  EvidencePage,
  EvidenceRequestState,
  GroundKind,
  IntakeAttempt,
  IntakeField,
  IntakeForm,
  IntakeInput,
  IntakeMatrixPage,
  IntakeRoute,
  LinkKind,
  MatrixRoute,
  MatrixVersionView,
  PartyRole,
  PeriodKind,
  PolicyRegisterCode,
  PolicyRegisterPage,
  ProtectedCategory,
  ProtectedMatterState,
  QueueFilter,
  QueueRow,
  ReceiptOutcome,
  Refusal,
  RemedyKind,
  RemedyPage,
  ReopeningPage,
  ReopeningState,
  ReopeningSummary,
  RouteKind,
  Severity,
  StaffName,
  UnmeasuredAppeal,
  Vulnerability,
} from "@/lib/api/cases";
import {
  ANSWER_OUTCOMES,
  APPEAL_OUTCOMES,
  DISCLOSURES,
  DISPOSITIONS,
  GROUND_KINDS,
  LINK_KINDS,
  PARTY_ROLES,
  POLICY_REGISTERS,
  PROTECTED_CATEGORIES,
  ROUTE_KINDS,
  VULNERABILITIES,
} from "@/lib/api/cases";
import type { Staff } from "@/lib/api/session";
import {
  APPROVER,
  CASE_TYPE_REMEDIES,
  CASE_TYPES,
  GOVERNING_GROUNDS,
  IMPACTS,
  INTAKE_MATRIX_SEED,
  PERIOD_SEED,
  PREPARER,
  REGISTER_SEED,
  SEED_CASES,
  SEEDED_APPROVED_AT,
  SEEDED_SINCE,
  SERVICE_OBJECTIVES,
  SEVERITIES,
  STAKEHOLDER_GROUPS,
  SUBJECT_KINDS,
} from "../cases";
import { accountBook, ORGANISATIONS, organisationName } from "./accounts";
import { addDays, now, today } from "./clock";
import { corrections, invoiceList } from "./finance";
import { reference as newReference } from "./ids";
import { noticeRead, recordNoticeEvent } from "./notices";
import { recordVersions, subjectPremisesOf } from "./inspection";
import { actingAs, mayActFor } from "./parties";
import { devicePremisesOf } from "./player";
import { helpRoutes } from "./public";
import { decisionForCollection } from "./registration";
import { statusReviewState } from "./status-records";
import { table, type StaffRole } from "./store";
import { calculation } from "./tariff";

/*
 * The case family's backend (CAS), as the API will behave: one table, `cases`, holding the schema's entities by
 * their names - the intake matrix versions and their routes, the registers and the period versions, the cases with
 * their parties, links, state history and targets, the evidence requests and what answered them, the decisions,
 * their remedy links, the appeals and the reopenings - and one function per operation of `srs/02-api-contracts.md`,
 * refusing with the codes of `design/04-refusal-codes.md`. A refused command records nothing but its audit row.
 *
 * The premises screens raise, read, answer a request, withdraw and appeal; the case console triages, asks for
 * evidence, decides, links the remedy, decides the appeal and reopens. Both work on this same table, so what one
 * side does is what the other reads next.
 *
 * Three readings this mock has to make where the seed and the specification part:
 *
 * - SCR-CAS-07 gives recording a decision to the business approver (ACT-BIZ-APR). The seed's only business approver,
 *   Thạch Minh Khải, is also its only dispute authority (ACT-DSP), and ALG-23 bars whoever made or approved a
 *   decision from deciding its appeal, so a decision he recorded could never be appealed to anyone. A case officer
 *   who did not investigate the case records it as well (PERM-86's separation), and the business approver still may.
 * - The case officer opens SCR-CAS-09 as `GET /appeals/{id}` and the eligibility call allow (ACT-CAS), so the officer
 *   who decided a case reaches its appeal and is refused there, as ALG-23 says; only ACT-DSP records an outcome.
 * - A reopening is authorised by ACT-DSP, as `POST /reopenings/{id}/authorise` and PERM-91 say; SCR-CAS-15's table
 *   names ACT-CAS, and the API wins where the two differ.
 *
 * Four more where the specification parts from itself, or leaves a reading open:
 *
 * - `POST /policy-periods/{id}/approve` lists PERIOD_VERSION_NOT_APPROVED "where an appeal is measured against a
 *   version this call has not approved", while AC-FR-CAS-021-03 raises it where the appeal is lodged. Both are
 *   kept: an appeal lodged under no approved period is admitted with no due date and that code, and approving a
 *   version whose effective date would cover its decision date is refused with it, naming the appeal, because the
 *   version would then read as having governed an appeal it never measured (DR-48 row 6).
 * - `POST /classify` says it performs SM-05 transitions 1 and 2 together, while the state model, SCR-CAS-04 ("Owner:
 *   yes to leave TRIAGED") and the referral and inadmissible closure, both taken from TRIAGED, need the case to rest
 *   there. Classification leaves it TRIAGED with its owner recorded (AC-FR-CAS-003-03 still refuses it without one),
 *   and transition 2 is taken by the first act that needs an assigned owner: Start investigating, or a request for
 *   evidence, each writing both history rows.
 * - ALG-26's sweep A leaves a case AWAITING_EVIDENCE when a deadline passes (the overdue request is still open), so
 *   SM-05 transition 8's "or the deadline passes" is not taken by the clock: were it, transition 9 (closed as
 *   incomplete from AWAITING_EVIDENCE when the period ends) could never be reached.
 * - A protected category's policy is approved by ACT-DPO under `POST /category-policies/{id}/approve`, and SCR-CAS-18
 *   gives Approve and publish to ACT-BIZ-APR. The seed's only data-protection officer, Lê Văn Cường, is also its only
 *   security owner, who prepares the policy, so the DPO alone could never approve one; the business approver, who
 *   did not prepare it, approves it as well.
 */

// ---------------------------------------------------------------- the table

/** `cases.intake_matrix_versions`: PREPARED until the case owner approves it, and never edited after. */
interface IntakeMatrixVersion {
  id: string;
  versionNo: number;
  state: "PREPARED" | "APPROVED";
  effectiveFrom: string;
  effectiveTo: string | null;
  preparedBy: StaffName;
  approvedBy: StaffName | null;
  approvedAt: string | null;
}

/** `cases.intake_routes`. */
interface IntakeRouteRow extends IntakeRoute {
  intakeMatrixVersionId: string;
}

/** `cases.register_entries`, with `cases.statutory_limits` and `cases.remedy_requirements` folded in by register. */
interface RegisterEntryRow {
  id: string;
  register: "pause_ground" | "protected_category" | "reopen_ground" | "statutory_limit" | "remedy_requirement";
  code: string;
  label: string | null;
  requiredAuthority: StaffRole | null;
  limit: { caseType: string; instrument: string; days: number } | null;
  requires: { remedyKind: RemedyKind; artefactKinds: readonly ArtefactKind[] } | null;
  isActive: boolean;
  state: "PREPARED" | "APPROVED";
  effectiveFrom: string;
  preparedBy: StaffName;
  approvedBy: StaffName | null;
  approvedAt: string | null;
  /** The approver's last refusal, with its reason; the entry stays PREPARED (`decision = refuse`). */
  refused: { reason: string; by: StaffName } | null;
}

/** `cases.policy_periods`: one version of one period kind for one case type. */
interface PolicyPeriodRow {
  id: string;
  kind: PeriodKind;
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

/** `cases.protected_category_policies` (CFG-50): one version of one category, PREPARED until approved. */
interface CategoryPolicyRow {
  id: string;
  category: ProtectedCategory;
  versionNo: number;
  specialistProcess: string;
  access: readonly StaffName[];
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

/** `cases.protected_matters` with `cases.protected_matter_subjects`: one case classified into a protected category. */
interface ProtectedMatterRow {
  id: string;
  caseId: string;
  category: ProtectedCategory;
  /** The policy version ALG-25 routed it under, once, at classification. */
  policyVersion: number;
  specialistProcess: string;
  /** The independent addressee, recorded whether or not the route is used; null where every addressee is a subject. */
  escalationAddressee: StaffName | null;
  escalationAddresseeState: "resolved" | "none_independent";
  /** The staff the matter names, each excluded from reading it whatever list they are on (DR-50 row 5). */
  subjects: readonly string[];
  state: ProtectedMatterState;
  reason: string;
  classifiedAt: string;
  classifiedBy: StaffName;
}

/** `cases.cases`. */
interface CaseRow {
  id: string;
  reference: string;
  stakeholderGroup: string;
  matter: string;
  /** Null until the case is classified. */
  caseType: string | null;
  subjectKind: string | null;
  subjectRef: string | null;
  affectedPeriodFrom: string | null;
  affectedPeriodTo: string | null;
  requestedRemedyKind: RemedyKind | null;
  state: CaseState;
  /** The responsible owner's account; null until assigned. */
  ownerActorId: string | null;
  /** Null where the raiser holds no account. */
  raiserPartyId: string | null;
  raiserContact: string;
  raiserVulnerability: Vulnerability | null;
  severity: Severity | null;
  businessImpact: BusinessImpact | null;
  intakeRouteId: string;
  submittedAt: string;
  /** The person who raised it from an account; null on the account-free route. */
  recordedBy: string | null;
  /** The date the next step names: classification while RECEIVED; the target or the evidence deadline once set. */
  nextStepBy: string | null;
  /** Classified into a protected category: no read outside the matter's access list (SCR-CAS-11). */
  protectedMatter: boolean;
  /** The support-line agent who recorded it for a caller (ACT-SUP), beside the caller's own contact. */
  agent: StaffName | null;
  /** The version of the record the case is about and what the opening module saw of it, where a module opened it. */
  subjectVersion: number | null;
  subjectSnapshot: Readonly<Record<string, unknown>> | null;
  /** SM-05 transition 3: the process the matter went to, and why. */
  referral: { process: string; reason: string; at: string } | null;
  /** SM-05 transitions 4 and 9: the closure without a decision, its reason and what it names. */
  closure: { disposition: Disposition; reason: string; route: string | null; unestablished: string | null; approver: StaffName | null; at: string } | null;
}

/** `cases.case_parties`. */
interface CasePartyRow {
  caseId: string;
  partyId: string;
  partyRole: PartyRole;
}

/** `cases.case_links`: one row, readable from both cases. */
interface CaseLinkRow {
  fromCaseId: string;
  toCaseId: string;
  linkKind: LinkKind;
  at: string;
}

/** `cases.case_state_history`, append-only. */
interface CaseStateHistoryRow {
  caseId: string;
  fromState: CaseState | null;
  toState: CaseState;
  occurredAt: string;
  reason: string | null;
}

/** `cases.sla_targets`, append-only: a row per target, the original and every revision. */
interface SlaTargetRow {
  caseId: string;
  targetOn: string;
  priority: number;
  severity: Severity;
  impact: BusinessImpact;
  vulnerability: Vulnerability;
  objectiveVersion: string;
  statutoryLimit: { on: string; instrument: string } | null;
  reason: Derivation["reason"];
  inForceFrom: string;
}

/** `cases.evidence_requests`, SM-40, with what the party supplied against it. */
interface EvidenceRequestRow {
  id: string;
  caseId: string;
  requestedItem: string;
  responsiblePartyId: string | null;
  responsibleContact: string | null;
  deadline: string;
  disclosureStatus: DisclosureStatus;
  state: EvidenceRequestState;
  receiptOutcome: ReceiptOutcome | null;
  issuedAt: string;
  issuedBy: StaffName;
  supplied: string | null;
  respondedAt: string | null;
  /** Answered after the deadline (SM-40 transition 3). */
  late: boolean;
  /** Who recorded the answer: the party's account or contact, or the case officer for one that arrived another way. */
  recordedBy: string | null;
  cancelled: { on: string; reason: string } | null;
  /** The one notice to the case officer that the deadline passed with nothing supplied has been raised (AC-FR-CAS-006-03). */
  overdueNoticed: boolean;
}

/** `cases.case_evidence`: one item held against a case, with the status it was asked under. */
interface CaseEvidenceRow {
  caseId: string;
  itemRef: string;
  suppliedByPartyId: string | null;
  /** Who supplied it in words: the party's name, the raiser's contact, or the officer who added it. */
  suppliedBy: string;
  disclosureStatus: DisclosureStatus;
  receivedAt: string;
  /** Against a request, or added on its own (POST /cases/{id}/evidence). */
  via: "request" | "added";
}

/** `cases.decisions`, append-only, with the seven elements of FR-CAS-007 and the governing ground of DEC-32. */
interface DecisionRow {
  id: string;
  caseId: string;
  facts: string;
  authorityRef: string;
  reasoning: string;
  remedyKind: RemedyKind;
  effectiveDate: string;
  maker: StaffName;
  /** The maker again where no second actor is required, never null (`cases.decisions.approver_actor_id`). */
  approver: StaffName;
  appealRoute: string;
  appealDeadline: string | null;
  governingGround: string;
  issuedAt: string;
}

/** A decision being written on SCR-CAS-07 and not yet issued. */
interface DecisionDraftRow {
  caseId: string;
  values: DecisionValues;
  savedAt: string;
  by: string;
}

/** `cases.appeals`, with the outcome's elements as their own columns. */
interface AppealRow {
  id: string;
  decisionId: string;
  caseId: string;
  grounds: string;
  appellantContact: string;
  receivedAt: string;
  period: { amount: number; versionNo: number; effectiveFrom: string } | null;
  /** Null where no period was approved for the case type at the decision date, and nothing measures the appeal. */
  dueAt: string | null;
  measurement: "PERIOD_VERSION_NOT_APPROVED" | null;
  late: boolean;
  state: AppealState;
  outcome: NonNullable<AppealSummary["outcome"]> | null;
  outcomeGround: string | null;
  decidedBy: StaffName | null;
}

/** `cases.appeal_state_history` and `cases.reopening_state_history`, a refused attempt included. */
interface Sm31HistoryRow {
  subjectId: string;
  fromState: string | null;
  toState: string;
  actor: string | null;
  occurredAt: string;
}

/** `cases.reopenings`. */
interface ReopeningRow {
  id: string;
  caseId: string;
  /** The decision it reopens; null on a case closed without one (inadmissible or incomplete). */
  decisionId: string | null;
  groundKind: GroundKind;
  groundRef: string;
  evidenceOn: string | null;
  displaced: readonly string[];
  /** The proposer: a case officer, or the raiser on their own case, named by their account or their contact. */
  proposedBy: StaffName;
  proposer: "officer" | "raiser";
  authorisedBy: StaffName | null;
  state: ReopeningState;
  recordedAt: string;
  decidedAt: string | null;
  /** SM-31 transition 7: the authority's reason, mandatory on a refusal. */
  refusedReason: string | null;
}

/** `cases.remedy_links`, append-only: the latest link of a kind is the one ALG-24 reads. */
interface RemedyLinkRow {
  decisionId: string;
  appealId: string | null;
  artefactKind: ArtefactKind;
  artefactRef: string;
  backReferencePresent: boolean;
  linkedAt: string;
  linkedBy: string;
  checkedAt: string;
}

/** The notices a case act raised, so the console can name and link them. */
interface CaseNoticeRow {
  caseId: string;
  reference: string;
  kind: string;
  at: string;
}

/** A refused attempt or a protected read, recorded with the actor, the time and the code. */
interface AuditRow {
  at: string;
  actor: string | null;
  act: string;
  subject: string;
  code: string;
}

export interface CasesTable {
  intakeMatrixVersions: IntakeMatrixVersion[];
  intakeRoutes: IntakeRouteRow[];
  registerEntries: RegisterEntryRow[];
  policyPeriods: PolicyPeriodRow[];
  cases: Map<string, CaseRow>;
  caseParties: CasePartyRow[];
  caseLinks: CaseLinkRow[];
  caseStateHistory: CaseStateHistoryRow[];
  slaTargets: SlaTargetRow[];
  evidenceRequests: EvidenceRequestRow[];
  caseEvidence: CaseEvidenceRow[];
  decisions: DecisionRow[];
  decisionDrafts: Map<string, DecisionDraftRow>;
  appeals: AppealRow[];
  appealStateHistory: Sm31HistoryRow[];
  reopenings: ReopeningRow[];
  reopeningStateHistory: Sm31HistoryRow[];
  remedyLinks: RemedyLinkRow[];
  caseNotices: CaseNoticeRow[];
  categoryPolicies: CategoryPolicyRow[];
  protectedMatters: ProtectedMatterRow[];
  /** The cases a module opened, by the idempotency key it sent (`ICaseIntake.OpenCase`): a repeat opens no second case. */
  intakeKeys: Map<string, string>;
  auditLog: AuditRow[];
}

const routeId = (version: string, group: string, kind: RouteKind) => `${version}-${group}-${kind}`;

/**
 * The seeded matrix carries the same identifiers in every world: a form read in the shared seed and sent from a
 * world made at that moment (the first act without an account) names a route both know.
 */
function seed(): CasesTable {
  const versions: IntakeMatrixVersion[] = [];
  const routes: IntakeRouteRow[] = [];
  for (const version of INTAKE_MATRIX_SEED) {
    const id = `intake-matrix-${String(version.versionNo)}`;
    const { routes: seeded, ...rest } = version;
    versions.push({ id, ...rest });
    for (const route of seeded) routes.push({ id: routeId(id, route.group, route.kind), intakeMatrixVersionId: id, ...route });
  }
  const approved = { state: "APPROVED" as const, effectiveFrom: SEEDED_SINCE, preparedBy: PREPARER, approvedBy: APPROVER, approvedAt: SEEDED_APPROVED_AT };
  const seeded = seedCases();
  return {
    intakeMatrixVersions: versions,
    intakeRoutes: routes,
    registerEntries: REGISTER_SEED.map((entry) => ({ id: `${entry.register}-${entry.code}`, ...entry, label: null, isActive: true, ...approved, refused: null })),
    policyPeriods: PERIOD_SEED.map((period) => ({ id: `${period.kind}-${period.caseType}-1`, ...period, versionNo: 1, effectiveTo: null, ...approved, refused: null })),
    cases: new Map(seeded.map(({ row }) => [row.reference, row])),
    caseParties: seeded.map(({ row }) => ({ caseId: row.id, partyId: row.raiserPartyId ?? "", partyRole: "raiser" as const })),
    caseLinks: [],
    caseStateHistory: seeded.flatMap(({ history }) => history),
    slaTargets: [],
    evidenceRequests: [],
    caseEvidence: [],
    decisions: seeded.map(({ decision }) => decision),
    decisionDrafts: new Map(),
    appeals: [],
    appealStateHistory: [],
    reopenings: [],
    reopeningStateHistory: [],
    remedyLinks: [],
    caseNotices: [],
    // CFG-50's safe default: no protected category is approved, so a classification into one is refused until one is.
    categoryPolicies: [],
    protectedMatters: [],
    intakeKeys: new Map(),
    auditLog: [],
  };
}

/**
 * The requests to reconsider an inspection record the seed holds, decided with a correction of the record: the case
 * waits on that correction (REMEDY_IN_PROGRESS), which VER issues and SCR-CAS-10 links.
 */
function seedCases(): { row: CaseRow; history: CaseStateHistoryRow[]; decision: DecisionRow }[] {
  return SEED_CASES.map((seeded) => {
    const id = `case-${seeded.reference}`;
    const decided = seeded.decision.decidedAt;
    const row: CaseRow = {
      id,
      reference: seeded.reference,
      stakeholderGroup: "premises_principal",
      matter: seeded.decision.facts,
      caseType: "inspection",
      subjectKind: "inspection_record",
      subjectRef: seeded.subjectRef,
      affectedPeriodFrom: null,
      affectedPeriodTo: null,
      requestedRemedyKind: "correction",
      state: "REMEDY_IN_PROGRESS",
      ownerActorId: seeded.owner.email,
      raiserPartyId: seeded.party,
      raiserContact: seeded.contact,
      raiserVulnerability: "not_asked",
      severity: null,
      businessImpact: null,
      intakeRouteId: routeId("intake-matrix-3", "premises_principal", "portal_form"),
      submittedAt: seeded.submittedAt,
      recordedBy: seeded.recordedBy,
      nextStepBy: null,
      protectedMatter: false,
      agent: null,
      subjectVersion: null,
      subjectSnapshot: null,
      referral: null,
      closure: null,
    };
    const history: CaseStateHistoryRow[] = [
      { caseId: id, fromState: null, toState: "RECEIVED", occurredAt: seeded.submittedAt, reason: null },
      { caseId: id, fromState: "RECEIVED", toState: "DECIDED", occurredAt: decided, reason: null },
      { caseId: id, fromState: "DECIDED", toState: "REMEDY_IN_PROGRESS", occurredAt: decided, reason: "REMEDY_LINKAGE_INCOMPLETE" },
    ];
    const decision: DecisionRow = {
      id: `${id}-decision`,
      caseId: id,
      facts: seeded.decision.facts,
      authorityRef: seeded.decision.authority,
      reasoning: seeded.decision.reasoning,
      remedyKind: "correction",
      effectiveDate: dayOf(decided),
      maker: seeded.decision.maker,
      approver: seeded.decision.maker,
      appealRoute: seeded.decision.appealRoute,
      appealDeadline: addWorkingDays(decided, 15),
      governingGround: "inspection_rules",
      issuedAt: decided,
    };
    return { row, history, decision };
  });
}

/**
 * The family's table in the world of `key`: a session, or a world for a reader with none. A world seeded by an
 * earlier build of this module - the development server keeps worlds across a module reload - gains what the seed
 * now holds (the console's tables, the seeded cases, the registers' entries as seeded) and keeps what was done in it.
 */
export function casesTable(key: string): CasesTable {
  const cases = table(key, "cases", seed);
  if (!Array.isArray((cases as Partial<CasesTable>).registerEntries) || SEED_CASES.some((seeded) => !cases.cases.has(seeded.reference))) {
    const fresh = seed();
    const kept = Array.isArray((cases as Partial<CasesTable>).registerEntries) ? cases : { ...fresh, cases: cases.cases, caseParties: cases.caseParties, caseStateHistory: cases.caseStateHistory, auditLog: cases.auditLog };
    const seededIds = new Set(fresh.registerEntries.map((entry) => entry.id));
    Object.assign(cases, kept, {
      registerEntries: [...fresh.registerEntries, ...kept.registerEntries.filter((entry) => !seededIds.has(entry.id))],
      cases: new Map([...fresh.cases, ...kept.cases]),
      caseParties: [...fresh.caseParties.filter((party) => ![...kept.cases.values()].some((row) => row.id === party.caseId)), ...kept.caseParties],
      caseStateHistory: [...fresh.caseStateHistory.filter((entry) => ![...kept.cases.values()].some((row) => row.id === entry.caseId)), ...kept.caseStateHistory],
      decisions: [...fresh.decisions.filter((decision) => !kept.decisions.some((entry) => entry.id === decision.id)), ...kept.decisions],
    });
  }
  // The tables this module added since the world was seeded (the protected matters, the intake keys) start as the seed has them.
  if (!((cases as Partial<CasesTable>).intakeKeys instanceof Map)) {
    const fresh = seed();
    for (const name of Object.keys(fresh) as (keyof CasesTable)[]) {
      if ((cases as Partial<CasesTable>)[name] === undefined) Object.assign(cases, { [name]: fresh[name] });
    }
  }
  return cases;
}

// ---------------------------------------------------------------- rules

/**
 * The period the acknowledgement names for classification (AC-FR-CAS-002-03). The specification names the step
 * and approves no period for it; five working days stands in until the case owner sets one.
 */
const CLASSIFY_WORKING_DAYS = 5;

/** The states the raiser may still withdraw from (SM-05 transition 16). */
const WITHDRAWABLE: readonly CaseState[] = ["RECEIVED", "TRIAGED", "ASSIGNED"];
/** The states a decision has been issued in: a withdrawal is CASE_ALREADY_DECIDED. */
const DECIDED: readonly CaseState[] = ["DECIDED", "REMEDY_IN_PROGRESS", "CLOSED"];
/** The states a case can no longer be classified, linked or asked for evidence in. */
const SETTLED: readonly CaseState[] = ["DECIDED", "REMEDY_IN_PROGRESS", "CLOSED", "CLOSED_INADMISSIBLE", "CLOSED_INCOMPLETE", "REFERRED", "WITHDRAWN"];
/** The closed states transition 17 leaves (BR-CAS-09). */
const REOPENABLE: readonly CaseState[] = ["CLOSED", "CLOSED_INADMISSIBLE", "CLOSED_INCOMPLETE"];

/** SM-05's permitted transitions, for the sentence that names where a case can go from where it is. */
const REACHABLE: Readonly<Record<CaseState, readonly CaseState[]>> = {
  RECEIVED: ["TRIAGED", "WITHDRAWN"],
  TRIAGED: ["ASSIGNED", "REFERRED", "CLOSED_INADMISSIBLE", "WITHDRAWN"],
  ASSIGNED: ["INVESTIGATING", "AWAITING_EVIDENCE", "WITHDRAWN"],
  INVESTIGATING: ["AWAITING_EVIDENCE", "DECISION_PENDING"],
  AWAITING_EVIDENCE: ["INVESTIGATING", "CLOSED_INCOMPLETE"],
  SPECIALIST_ESCALATION: ["INVESTIGATING"],
  DECISION_PENDING: ["DECIDED"],
  DECIDED: ["REMEDY_IN_PROGRESS", "CLOSED"],
  REMEDY_IN_PROGRESS: ["CLOSED"],
  CLOSED: ["INVESTIGATING", "REMEDY_IN_PROGRESS"],
  CLOSED_INADMISSIBLE: ["INVESTIGATING"],
  CLOSED_INCOMPLETE: ["INVESTIGATING"],
  REFERRED: [],
  WITHDRAWN: [],
};

/** The artefact kinds that carry money, which the finance operator links; a correction or a notice is the case officer's. */
const FINANCIAL: readonly ArtefactKind[] = ["recalculation", "invoice", "refund", "status_change"];
const ARTEFACT_KINDS: readonly ArtefactKind[] = ["recalculation", "invoice", "refund", "status_change", "correction", "notice"];

const MATTER_LIMIT = 4000;
const ITEM_LIMIT = 500;
const QUEUE_PAGE = 20;

/** Working days after an ISO date, Monday to Friday, in Vietnam time. */
function addWorkingDays(from: string, days: number): string {
  let day = addDays(from, 0);
  let left = days;
  while (left > 0) {
    day = addDays(`${day}T12:00:00+07:00`, 1);
    const weekday = new Date(`${day}T12:00:00+07:00`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return day;
}

/** Calendar months after an ISO date, as an ISO date. */
function addMonths(from: string, months: number): string {
  const date = new Date(`${from.slice(0, 10)}T12:00:00+07:00`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return addDays(date.toISOString(), 0);
}

/** Whole days from one ISO date to another. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const dayOf = (instant: string) => addDays(instant, 0);

/** A version in force on a day: approved, and that day inside its period (R1.9: resolved by date, not by newness). */
const inForceOn = (version: { state: string; effectiveFrom: string; effectiveTo: string | null }, day: string) =>
  version.state === "APPROVED" && version.effectiveFrom <= day && (version.effectiveTo === null || day < version.effectiveTo);

function effectiveVersion(cases: CasesTable, day: string): IntakeMatrixVersion | null {
  return cases.intakeMatrixVersions.find((version) => inForceOn(version, day)) ?? null;
}

const routesOf = (cases: CasesTable, version: IntakeMatrixVersion) => cases.intakeRoutes.filter((route) => route.intakeMatrixVersionId === version.id);

const asRoute = ({ id, group, kind, requiresAccount, caseTypes }: IntakeRouteRow): IntakeRoute => ({ id, group, kind, requiresAccount, caseTypes });

/** The web form a reader may send on for a group: one that needs no account, or one that does, to a signed-in account. */
function formRouteFor(routes: readonly IntakeRouteRow[], group: string, signedIn: boolean): IntakeRouteRow | null {
  const forms = routes.filter((route) => route.group === group && route.kind === "portal_form");
  return forms.find((route) => !route.requiresAccount) ?? (signedIn ? forms[0] : undefined) ?? null;
}

/** The remedy kinds the route's case types admit, in the register's order. */
function remediesOf(route: IntakeRoute | null): RemedyKind[] {
  const admitted = new Set((route?.caseTypes ?? []).flatMap((type) => CASE_TYPE_REMEDIES[type] ?? []));
  return (["refund", "correction", "explanation"] as const).filter((kind) => admitted.has(kind));
}

/**
 * Whether a group is the account's own: a principal acting for a premises raises as a premises principal. The
 * account route is the web form of that group alone.
 */
const accountGroup = (reader: CaseReader): string | null => (reader.party !== null ? "premises_principal" : null);

/** The support line as the help route register of this world publishes it (SCR-PUB-18). */
const supportLine = (key: string): string => helpRoutes(key).data?.find((route) => route.kind === "support_line")?.value ?? "";

/** The period of a kind in force for a case type on a day, or null when none is approved (the act is then refused). */
const periodOn = (cases: CasesTable, kind: PeriodKind, caseType: string | null, day: string): PolicyPeriodRow | null =>
  cases.policyPeriods.find((period) => period.kind === kind && period.caseType === caseType && inForceOn(period, day)) ?? null;

/** The approved entries of a register readable on a day. */
const entriesOn = (cases: CasesTable, register: RegisterEntryRow["register"], day: string) =>
  cases.registerEntries.filter((entry) => entry.register === register && entry.isActive && entry.state === "APPROVED" && entry.effectiveFrom <= day);

function statutoryLimitOf(cases: CasesTable, caseType: string, day: string): { days: number; instrument: string } | null {
  const limit = entriesOn(cases, "statutory_limit", day).find((entry) => entry.limit?.caseType === caseType)?.limit;
  return limit !== undefined && limit !== null ? { days: limit.days, instrument: limit.instrument } : null;
}

/** ALG-24 step 1: the artefact kinds a remedy kind requires, from the register `remedy_requirement`. */
const requiredFor = (cases: CasesTable, remedy: RemedyKind): readonly ArtefactKind[] =>
  entriesOn(cases, "remedy_requirement", today()).find((entry) => entry.requires?.remedyKind === remedy)?.requires?.artefactKinds ?? [];

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const accept = <T>(accepted: T): CommandAnswer<T> => ({ accepted, refusal: null });
const refuse = (code: string, fieldErrors: Partial<Record<IntakeField, string>> = {}): CommandAnswer<never> => ({
  accepted: null,
  refusal: { code, fieldErrors },
});
const done = <T>(accepted: T): CaseAnswer<T> => ({ accepted, refusal: null });
function refused(code: string, fields: Readonly<Record<string, string>> = {}, detail: Readonly<Record<string, string>> = {}): CaseAnswer<never> {
  const refusal: Refusal = { code, fields, detail };
  return { accepted: null, refusal };
}

function audit(cases: CasesTable, actor: string | null, act: string, subject: string, code: string): void {
  cases.auditLog.push({ at: now(), actor, act, subject, code });
}

/** A refusal that is recorded before it is answered: the actor, the time, the act and the code (the ACs' last line). */
type Refuse = (code: string, fields?: Readonly<Record<string, string>>, detail?: Readonly<Record<string, string>>) => CaseAnswer<never>;

function refuser(cases: CasesTable, actor: string | null, act: string, subject: string): Refuse {
  return (code, fields = {}, detail = {}) => {
    audit(cases, actor, act, subject, code);
    return refused(code, fields, detail);
  };
}

/** A read refused and recorded, so a refused attempt to read leaves its trace as a refused act does. */
function refusedReadBy(cases: CasesTable, actor: string | null, act: string, subject: string, code: string): LoadOutcome<never> {
  audit(cases, actor, act, subject, code);
  return refusedRead(code);
}

/** A raiser-side refusal (`CommandAnswer`), recorded the same way. */
function refuseBy(cases: CasesTable, actor: string | null, act: string, subject: string, code: string): CommandAnswer<never> {
  audit(cases, actor, act, subject, code);
  return refuse(code);
}

const holds = (staff: Staff, ...roles: readonly StaffRole[]) => roles.some((role) => staff.roles.includes(role));
const nameOf = (staff: Staff): StaffName => ({ name: staff.account, email: staff.email });

/** The case officers a case may be owned by: every account holding ACT-CAS. */
const caseOfficers = (): StaffName[] =>
  [...accountBook().values()].filter((account) => account.staffRoles.includes("ACT-CAS")).map((account) => ({ name: account.name, email: account.email }));

/** Every member of the gateway's staff, for the lists a protected category names. */
const staffAccounts = (): StaffName[] =>
  [...accountBook().values()].filter((account) => account.role === "staff").map((account) => ({ name: account.name, email: account.email }));

function staffName(email: string | null): StaffName | null {
  if (email === null) return null;
  const account = accountBook().get(email);
  return account !== undefined ? { name: account.name, email } : null;
}

function transition(cases: CasesTable, row: CaseRow, to: CaseState, reason: string | null = null): void {
  cases.caseStateHistory.push({ caseId: row.id, fromState: row.state, toState: to, occurredAt: now(), reason });
  row.state = to;
}

const findCase = (cases: CasesTable, reference: string): CaseRow | undefined => cases.cases.get(reference.trim().toUpperCase());
const caseById = (cases: CasesTable, id: string): CaseRow | undefined => [...cases.cases.values()].find((row) => row.id === id);
const currentTarget = (cases: CasesTable, row: CaseRow): SlaTargetRow | null => cases.slaTargets.filter((target) => target.caseId === row.id).at(-1) ?? null;
const latestDecision = (cases: CasesTable, row: CaseRow): DecisionRow | null => cases.decisions.filter((decision) => decision.caseId === row.id).at(-1) ?? null;
const appealsOf = (cases: CasesTable, decision: DecisionRow) => cases.appeals.filter((appeal) => appeal.decisionId === decision.id);
const openRequests = (cases: CasesTable, row: CaseRow) =>
  cases.evidenceRequests.filter((request) => request.caseId === row.id && (request.state === "ISSUED" || request.state === "OVERDUE"));

/** The day a case last closed, from its history. */
function closedOn(cases: CasesTable, row: CaseRow): string | null {
  const entry = cases.caseStateHistory.filter((history) => history.caseId === row.id && REOPENABLE.includes(history.toState)).at(-1);
  return entry !== undefined ? dayOf(entry.occurredAt) : null;
}

function stateSince(cases: CasesTable, row: CaseRow): string {
  return cases.caseStateHistory.filter((entry) => entry.caseId === row.id).at(-1)?.occurredAt ?? row.submittedAt;
}

/**
 * ALG-26 sweep A, played on the next read as the schedule would have run it: a request whose deadline passed with
 * nothing recorded is OVERDUE (SM-40 transition 2), its receipt outcome is recorded as not supplied by the deadline,
 * and the case officer is told, once (AC-FR-CAS-006-03). The case stays AWAITING_EVIDENCE: the request is still
 * open, a late answer is still an answer, and the closure as incomplete is taken from there.
 */
function sweepOverdue(key: string, cases: CasesTable): void {
  const day = today();
  for (const request of cases.evidenceRequests) {
    if (request.state !== "ISSUED" || day <= request.deadline) continue;
    request.state = "OVERDUE";
    request.receiptOutcome = "not_supplied_by_deadline";
    const row = caseById(cases, request.caseId);
    if (row === undefined || request.overdueNoticed) continue;
    request.overdueNoticed = true;
    const officer = staffName(row.ownerActorId) ?? request.issuedBy;
    notifyStaff(key, cases, row, officer, "evidence_deadline_passed", request.id, { item: request.requestedItem, by: request.deadline });
  }
}

/**
 * ALG-26 sweep B: an appeal past its due date with no outcome lapses (SM-31 transition 3); it is escalated, never
 * refused, and the party that appealed is told the period ended with no outcome (NTF-CAS-06). An appeal nothing
 * measured has no due date and never lapses.
 */
function sweepLapsed(key: string, cases: CasesTable): void {
  for (const appeal of cases.appeals) {
    if (appeal.state !== "UNDER_APPEAL" || appeal.dueAt === null || now() <= appeal.dueAt) continue;
    cases.appealStateHistory.push({ subjectId: appeal.id, fromState: appeal.state, toState: "APPEAL_LAPSED", actor: null, occurredAt: now() });
    appeal.state = "APPEAL_LAPSED";
    const row = caseById(cases, appeal.caseId);
    if (row !== undefined) notify(key, cases, row, "appeal_lapsed", appeal.id, { appeal: appeal.id, by: dayOf(appeal.dueAt) }, appeal.appellantContact);
  }
}

/** Keeps a notice's reference against the case, so the console names and links it. */
function keepNotice(cases: CasesTable, row: CaseRow, notice: string | null, kind: string, at: string): string | null {
  if (notice !== null) cases.caseNotices.push({ caseId: row.id, reference: notice, kind, at });
  return notice;
}

/** Raises a notice for a case act through COM to the raiser, at the contact the case holds unless another is given. */
function notify(
  key: string,
  cases: CasesTable,
  row: CaseRow,
  eventKind: string,
  occurrenceRef: string,
  facts: Readonly<Record<string, string>> & { by: string },
  destination: string = row.raiserContact,
): string | null {
  const at = now();
  const notice = recordNoticeEvent(key, {
    sourceModule: "CAS",
    eventKind,
    occurrenceRef,
    occurredAt: at,
    subjectKind: "case",
    subjectRef: row.reference,
    recipientPartyId: row.raiserPartyId,
    destination,
    facts: { case: row.reference, ...facts },
  });
  return keepNotice(cases, row, notice, eventKind, at);
}

/**
 * The same, to a party on the case other than the raiser: the mock holds no contact register for it, so the
 * destination is left for COM to resolve, and a party it cannot reach is an unmet obligation rather than silence.
 */
function notifyParty(key: string, cases: CasesTable, row: CaseRow, party: string, eventKind: string, occurrenceRef: string, facts: Readonly<Record<string, string>> & { by: string }): string | null {
  const at = now();
  const notice = recordNoticeEvent(key, {
    sourceModule: "CAS",
    eventKind,
    occurrenceRef,
    occurredAt: at,
    subjectKind: "case",
    subjectRef: row.reference,
    recipientPartyId: party,
    destination: null,
    facts: { case: row.reference, ...facts },
  });
  return keepNotice(cases, row, notice, eventKind, at);
}

/** A notice to a member of the case team (the officer told a deadline passed), at their account's address. */
function notifyStaff(key: string, cases: CasesTable, row: CaseRow, to: StaffName, eventKind: string, occurrenceRef: string, facts: Readonly<Record<string, string>> & { by: string }): string | null {
  const at = now();
  const notice = recordNoticeEvent(key, {
    sourceModule: "CAS",
    eventKind,
    occurrenceRef,
    occurredAt: at,
    subjectKind: "case",
    subjectRef: row.reference,
    recipientPartyId: null,
    destination: to.email,
    facts: { case: row.reference, officer: to.name, ...facts },
  });
  return keepNotice(cases, row, notice, eventKind, at);
}

// ---------------------------------------------------------------- protected matters (DR-50, ALG-25)

/** The matter a case is restricted under: the latest not corrected away. */
const matterOf = (cases: CasesTable, row: CaseRow): ProtectedMatterRow | null =>
  cases.protectedMatters.filter((matter) => matter.caseId === row.id && matter.state !== "RECLASSIFIED").at(-1) ?? null;

/** The policy version of a category in force on a day, or null while none is approved (CFG-50's safe default). */
const categoryPolicyOn = (cases: CasesTable, category: string, day: string): CategoryPolicyRow | null =>
  cases.categoryPolicies.find((policy) => policy.category === category && inForceOn(policy, day)) ?? null;

/**
 * DR-50 rows 4, 5 and 9, judged at the moment of the read against the category's policy in force now (ALG-25): a
 * reader named in the matter is excluded whatever list they are on, a reader off the list is refused, and anyone
 * else may read it. Every read of a protected case is recorded, permitted or refused (`cases.protected_access_log`).
 */
function protectedAccess(cases: CasesTable, row: CaseRow, actor: string | null, act: string): "ACCESS_PERMITTED" | "PROTECTED_MATTER_NO_ACCESS" | "PROTECTED_MATTER_SUBJECT_EXCLUDED" | null {
  if (!row.protectedMatter) return null;
  const matter = matterOf(cases, row);
  const policy = matter !== null ? categoryPolicyOn(cases, matter.category, today()) : null;
  const listed = actor !== null && policy !== null && policy.access.some((reader) => reader.email === actor);
  const outcome = !listed ? "PROTECTED_MATTER_NO_ACCESS" : matter?.subjects.includes(actor ?? "") === true ? "PROTECTED_MATTER_SUBJECT_EXCLUDED" : "ACCESS_PERMITTED";
  audit(cases, actor, act, row.reference, outcome);
  return outcome;
}

/**
 * The remedy in force on a case: the latest decision's, unless an appeal outcome on it set a remedy of its own
 * (SM-05 transition 18), which ALG-24 then evaluates in its place.
 */
function remedyInForce(cases: CasesTable, row: CaseRow): { decision: DecisionRow; appeal: AppealRow | null; remedy: RemedyKind } | null {
  const decision = latestDecision(cases, row);
  if (decision === null) return null;
  const varied = appealsOf(cases, decision)
    .filter((appeal) => appeal.state === "APPEAL_DECIDED" && (appeal.outcome?.remedy ?? null) !== null)
    .at(-1);
  const remedy = varied?.outcome?.remedy;
  return varied !== undefined && remedy !== null && remedy !== undefined ? { decision, appeal: varied, remedy } : { decision, appeal: null, remedy: decision.remedyKind };
}

/** The links ALG-24 reads for the remedy in force: the latest of each kind. */
function linksInForce(cases: CasesTable, inForce: { decision: DecisionRow; appeal: AppealRow | null }): Map<ArtefactKind, RemedyLinkRow> {
  const latest = new Map<ArtefactKind, RemedyLinkRow>();
  for (const link of cases.remedyLinks) {
    if (link.decisionId === inForce.decision.id && link.appealId === (inForce.appeal?.id ?? null)) latest.set(link.artefactKind, link);
  }
  return latest;
}

/** DR-51's answer for the remedy in force, without moving anything. */
function linkageOf(cases: CasesTable, row: CaseRow): { required: readonly ArtefactKind[]; missing: ArtefactKind[]; absent: string[] } | null {
  const inForce = remedyInForce(cases, row);
  if (inForce === null) return null;
  const required = requiredFor(cases, inForce.remedy);
  const links = linksInForce(cases, inForce);
  return {
    required,
    missing: required.filter((kind) => !links.has(kind)),
    absent: required.flatMap((kind) => {
      const link = links.get(kind);
      return link !== undefined && !link.backReferencePresent ? [link.artefactRef] : [];
    }),
  };
}

/**
 * ALG-24, DR-51: complete when every kind the remedy requires is linked and names the case from its own side, or
 * when the remedy requires nothing. It is what moves a decided case: incomplete puts it in REMEDY_IN_PROGRESS,
 * complete closes it.
 */
function evaluateLinkage(cases: CasesTable, row: CaseRow): RemedyPage["linkage"] {
  const linkage = linkageOf(cases, row);
  if (linkage === null) return { complete: false, missing: [], absent: [] };
  const { required, missing, absent } = linkage;
  if (missing.length === 0 && absent.length === 0) {
    if (row.state === "DECIDED" || row.state === "REMEDY_IN_PROGRESS") {
      transition(cases, row, "CLOSED", required.length === 0 ? "NO_FINANCIAL_EFFECT" : "ALL_REQUIRED_LINKED");
      row.nextStepBy = null;
    }
    return { complete: true, closedOn: closedOn(cases, row) };
  }
  if (row.state === "DECIDED") transition(cases, row, "REMEDY_IN_PROGRESS", missing.length > 0 ? "REMEDY_LINKAGE_INCOMPLETE" : "BACK_REFERENCE_ABSENT");
  return { complete: false, missing, absent };
}

/**
 * ALG-24 step 3 and SCR-CAS-10's "Names the case": the artefact is read in the module that holds it, through that
 * module's own exported read, and it names the case when the case's reference appears in what the module answers
 * for it. Null when the module holds no artefact by that reference.
 */
function readArtefact(key: string, staff: Staff, kind: ArtefactKind, reference: string, caseRef: string): { namesCase: boolean } | null {
  const names = (artefact: unknown) => ({ namesCase: JSON.stringify(artefact).includes(caseRef) });
  const ref = reference.trim();
  switch (kind) {
    case "recalculation": {
      const found = calculation(key, { roles: staff.roles }, ref).data;
      return found !== null ? names(found.calculation) : null;
    }
    case "invoice": {
      const invoice = invoiceList(key).data?.invoices.find((entry) => `${entry.series} ${entry.number}` === ref || entry.number === ref);
      return invoice !== undefined ? names(invoice) : null;
    }
    case "refund":
    case "correction": {
      // An inspection record is corrected in VER: the record, with the case each of its versions was corrected under.
      if (kind === "correction" && ref.toUpperCase().startsWith("IRC-")) {
        const versions = recordVersions(key, ref);
        return versions !== null ? names(versions) : null;
      }
      // A refund and a financial correction are FIN's corrections of that kind, found by their reference.
      const row = corrections(key, { name: staff.account, email: staff.email, roles: staff.roles }, ref).data?.rows.find(
        (entry) => entry.reference === ref && String(entry.kind) === kind,
      );
      return row !== undefined ? names(row) : null;
    }
    case "status_change": {
      const review = statusReviewState(key, ref);
      return review !== null ? names(review) : null;
    }
    case "notice": {
      const notice = noticeRead(key, ref, { party: null, account: staff.account }).data;
      return notice !== null ? names(notice.content) : null;
    }
  }
}

// ---------------------------------------------------------------- who acts for the raising party (PTY, DR-201)

/**
 * The permission each act of the party's side asks PTY for (`frd/09-permission-entries.md`): raising a case (PERM-77),
 * reading one's own (PERM-79), withdrawing it (PERM-80), lodging an appeal (PERM-87) and asking for a reopening
 * (PERM-90). Answering a request and adding an item have no entry of their own - PERM-84 is the officer's recording -
 * so they ask for the scope a delegation names for sending, SUBMIT.
 */
type PartyPermission = "PERM-77" | "PERM-79" | "PERM-80" | "PERM-87" | "PERM-90" | "SUBMIT";

/**
 * The premises a case's subject is about, as the family holding the subject answers: a decision's (REG), an inspection
 * record's or a stored answer's (VER), a device's (PLR). Null where the subject names none of them - an invoice, a
 * matter with no subject - which leaves the case the party's own.
 */
function premisesOfSubject(key: string, subject: string | null): string | null {
  const ref = subject?.trim() ?? "";
  if (ref === "") return null;
  return decisionForCollection(key, ref.toUpperCase())?.summary.premises.id ?? subjectPremisesOf(key, ref) ?? devicePremisesOf(key, ref);
}

/**
 * Whether the person a premises-portal session signs in as may act for the raising party on a case about `subject`,
 * as PTY answers now: its principal on every case of the party; a delegate only on a case about a premises her
 * delegation covers for the act (`mayActFor`), so one about another premises, or about none, is not hers. A session
 * PTY answers for nobody - a revoked delegate - acts on nothing; a reader with no account acts on the reference alone.
 */
function actsUnderAuthority(key: string, reader: CaseReader, subject: string | null, permission: PartyPermission): boolean {
  if (reader.party === null) return true;
  const acting = actingAs(key);
  if (acting === null) return false;
  if (acting.actor === "PRINCIPAL") return true;
  const premises = premisesOfSubject(key, subject);
  return premises !== null && mayActFor(key, premises, permission);
}

// ---------------------------------------------------------------- GET /intake-routes, as SCR-CAS-01 reads it

/**
 * The form of SCR-CAS-01: the groups of the version in force, and for the chosen group its routes and the web form
 * this reader may use. A group no version lists is GROUP_NOT_IN_MATRIX; a group only a prepared version lists is
 * MATRIX_VERSION_NOT_APPROVED, since the route the reader followed is not open yet. The values are the last
 * attempt's, or the subject the reader came with.
 */
export function intakeForm(
  key: string,
  reader: CaseReader,
  asked: string | null,
  subject: string | null,
  attempt: IntakeAttempt | null,
): LoadOutcome<IntakeForm> {
  const cases = casesTable(key);
  const day = today();
  const version = effectiveVersion(cases, day);
  if (version === null) return refusedRead("MATRIX_VERSION_NOT_APPROVED");
  const routes = routesOf(cases, version);
  const groups = STAKEHOLDER_GROUPS.filter((group) => routes.some((route) => route.group === group));
  const own = accountGroup(reader);
  const group = own ?? attempt?.values.group ?? asked ?? "public";
  const listed = groups.includes(group as (typeof groups)[number]);
  const elsewhere = !listed && cases.intakeRoutes.some((route) => route.group === group);
  const signedIn = own !== null && own === group;
  const formRoute = listed ? formRouteFor(routes, group, signedIn) : null;
  const values = attempt?.values ?? {
    group,
    matter: "",
    subject: subject ?? "",
    periodFrom: "",
    periodTo: "",
    remedy: "",
    contact: "",
  };
  return ok({
    today: day,
    version: version.versionNo,
    groups,
    group,
    signedIn,
    routes: routes.filter((route) => route.group === group).map(asRoute),
    formRoute: formRoute !== null ? asRoute(formRoute) : null,
    remedies: remediesOf(formRoute),
    supportLine: supportLine(key),
    values,
    refusal: attempt?.refusal ?? (listed ? null : elsewhere ? "MATRIX_VERSION_NOT_APPROVED" : "GROUP_NOT_IN_MATRIX"),
    fieldErrors: attempt?.fieldErrors ?? {},
  });
}

// ---------------------------------------------------------------- POST /cases

/**
 * POST /cases: the contract's checks in its order - the group against the matrix in force, the route against the
 * group and the account, then every field at once - and on success the case RECEIVED with its reference, its
 * raiser, its first history row, and its acknowledgement raised with the notice family (NTF-CAS-01). The
 * reference comes from the identifier alphabet, never from a counter, and is never reissued.
 */
export function raiseCase(
  key: string,
  reader: CaseReader,
  input: IntakeInput,
  agent: StaffName | null = null,
): CommandAnswer<{ reference: string; contact: string; notice: string | null }> {
  const cases = casesTable(key);
  const day = today();
  const version = effectiveVersion(cases, day);
  if (version === null) return refuseBy(cases, agent?.email ?? reader.account, "raise", input.group, "MATRIX_VERSION_NOT_APPROVED");
  const routes = routesOf(cases, version);
  if (!routes.some((route) => route.group === input.group)) {
    const elsewhere = cases.intakeRoutes.some((route) => route.group === input.group);
    return refuseBy(cases, agent?.email ?? reader.account, "raise", input.group, elsewhere ? "MATRIX_VERSION_NOT_APPROVED" : "GROUP_NOT_IN_MATRIX");
  }
  const route = routes.find((candidate) => candidate.id === input.routeId && candidate.group === input.group);
  if (route === undefined) return refuseBy(cases, agent?.email ?? reader.account, "raise", input.group, "MATRIX_VERSION_NOT_APPROVED");
  if (route.requiresAccount && accountGroup(reader) !== route.group) return refuseBy(cases, agent?.email ?? reader.account, "raise", input.group, "ROLE_NOT_ASSIGNED");
  // From the party's account, a delegate raises a case only about a premises her delegation covers (PERM-77).
  if (!actsUnderAuthority(key, reader, input.subject, "PERM-77")) return refuseBy(cases, reader.account, "raise", input.group, "ROLE_OUT_OF_SCOPE");

  const fieldErrors: Partial<Record<IntakeField, string>> = {};
  const matter = input.matter.slice(0, MATTER_LIMIT);
  if (matter.trim() === "") fieldErrors.matter = "FIELD_MISSING";
  const { from, to, unreadable } = input.period;
  // The end before the start, or after today: a case is about what has happened (PERIOD_INVALID).
  if (unreadable || (from !== null && to !== null && to < from) || (to !== null && to > day) || (from !== null && from > day)) {
    fieldErrors.period = "PERIOD_INVALID";
  }
  const remedies = remediesOf(route);
  const remedy = remedies.find((kind) => kind === input.remedy) ?? null;
  if (input.remedy !== "" && remedy === null) fieldErrors.remedy = "REMEDY_KIND_UNKNOWN";
  if (input.contact.trim() === "") fieldErrors.contact = "FIELD_MISSING";
  if (Object.keys(fieldErrors).length > 0) return refuse(Object.values(fieldErrors)[0] ?? "FIELD_MISSING", fieldErrors);

  let reference = newReference("CAS");
  while (cases.cases.has(reference)) reference = newReference("CAS");
  const at = now();
  const row: CaseRow = {
    id: randomUUID(),
    reference,
    stakeholderGroup: input.group,
    matter,
    caseType: null,
    subjectKind: null,
    subjectRef: input.subject.trim() !== "" ? input.subject.trim() : null,
    affectedPeriodFrom: from,
    affectedPeriodTo: to,
    requestedRemedyKind: remedy,
    state: "RECEIVED",
    ownerActorId: null,
    raiserPartyId: reader.party,
    raiserContact: input.contact.trim(),
    raiserVulnerability: null,
    severity: null,
    businessImpact: null,
    intakeRouteId: route.id,
    submittedAt: at,
    recordedBy: reader.account,
    nextStepBy: addWorkingDays(at, CLASSIFY_WORKING_DAYS),
    protectedMatter: false,
    agent,
    subjectVersion: null,
    subjectSnapshot: null,
    referral: null,
    closure: null,
  };
  cases.cases.set(reference, row);
  if (reader.party !== null) cases.caseParties.push({ caseId: row.id, partyId: reader.party, partyRole: "raiser" });
  cases.caseStateHistory.push({ caseId: row.id, fromState: null, toState: "RECEIVED", occurredAt: at, reason: null });
  // The acknowledgement is issued on entry to RECEIVED, before anything else can fail (SM-05).
  const notice = notify(key, cases, row, "case_received", reference, { submittedAt: at, by: row.nextStepBy ?? day });
  return accept({ reference, contact: row.raiserContact, notice });
}

/**
 * POST /cases by a support-line agent recording a case for a caller (ACT-SUP, SCR-CAS-01's other entry point): the
 * caller's group and its support line, which needs no account, and the caller's own words and contact. Both
 * identities are stored - the caller as the raiser at the contact they gave, the agent beside them - and the
 * acknowledgement goes to the caller, never only to the agent's screen.
 */
export function recordCallerCase(key: string, staff: Staff, input: IntakeInput): CommandAnswer<{ reference: string; contact: string; notice: string | null }> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-SUP")) return refuseBy(cases, staff.email, "raise", input.group, "ROLE_NOT_ASSIGNED");
  const version = effectiveVersion(cases, today());
  const line = version !== null ? routesOf(cases, version).find((route) => route.group === input.group && route.kind === "support_line") : undefined;
  return raiseCase(key, { party: null, account: null }, { ...input, routeId: line?.id ?? "" }, nameOf(staff));
}

/** SCR-CAS-01 as the support-line agent reads it: the groups of the matrix in force, and the remedies their support line admits. */
export function callerIntakeForm(key: string, staff: Staff, asked: string | null, attempt: IntakeAttempt | null): LoadOutcome<IntakeForm> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-SUP")) return refusedReadBy(cases, staff.email, "read intake", "support line", "ROLE_NOT_ASSIGNED");
  const form = intakeForm(key, { party: null, account: null }, asked, null, attempt);
  if (form.data === null) return form;
  const line = form.data.routes.find((route) => route.kind === "support_line") ?? null;
  return ok({ ...form.data, signedIn: false, formRoute: line, remedies: remediesOf(line) });
}

// ---------------------------------------------------------------- GET /cases/{reference}, the raiser's reads

/** The raiser's own case: one their party raised from its account. */
const raisedBy = (cases: CasesTable, row: CaseRow, party: string | null): boolean =>
  party !== null && cases.caseParties.some((entry) => entry.caseId === row.id && entry.partyRole === "raiser" && entry.partyId === party);

/** The party a case's raiser acts for may act on it; on the account-free route the reference is the credential. */
const actsForRaiser = (row: CaseRow, reader: CaseReader): boolean => (row.raiserPartyId !== null ? row.raiserPartyId === reader.party : reader.party === null);

function summaryOf(cases: CasesTable, row: CaseRow): CaseSummary {
  return {
    reference: row.reference,
    submittedAt: row.submittedAt,
    state: row.state,
    subject: row.subjectRef,
    nextBy: row.nextStepBy,
    stateSince: stateSince(cases, row),
  };
}

function decisionOf(decision: DecisionRow): CaseDecision {
  return {
    facts: decision.facts,
    authority: decision.authorityRef,
    reasoning: decision.reasoning,
    remedy: decision.remedyKind,
    effectiveDate: decision.effectiveDate,
    decisionMaker: decision.maker.name,
    appealRoute: decision.appealRoute,
    appealDeadline: decision.appealDeadline,
    issuedAt: decision.issuedAt,
  };
}

const appealSummary = (appeal: AppealRow): AppealSummary => ({
  reference: appeal.id,
  receivedAt: appeal.receivedAt,
  dueAt: appeal.dueAt,
  measurement: appeal.measurement,
  late: appeal.late,
  state: appeal.state,
  outcome: appeal.outcome,
});

const reopeningSummary = (entry: ReopeningRow): ReopeningSummary => ({
  state: entry.state,
  proposedAt: entry.recordedAt,
  decidedAt: entry.decidedAt,
  refusedReason: entry.refusedReason,
});

/**
 * AC-FR-CAS-006-02: an item is shown to the party side in full only where its status is open, or where the reader's
 * own party supplied it; a confidential or sealed item another party supplied is shown to exist, its content withheld.
 */
function heldFor(cases: CasesTable, row: CaseRow, reader: CaseReader): EvidenceHeld[] {
  return cases.caseEvidence
    .filter((item) => item.caseId === row.id)
    .map((item) => {
      const own = item.suppliedByPartyId !== null ? item.suppliedByPartyId === reader.party : item.via === "request" && item.suppliedBy === row.raiserContact && actsForRaiser(row, reader);
      return { item: own || item.disclosureStatus === "open" ? item.itemRef : null, disclosure: item.disclosureStatus, receivedAt: item.receivedAt, own };
    });
}

/** Whether a case may be asked to reopen now: closed, inside its CFG-51 window, and with no proposal waiting. */
function reopenable(cases: CasesTable, row: CaseRow): boolean {
  if (!REOPENABLE.includes(row.state) || cases.reopenings.some((entry) => entry.caseId === row.id && entry.state === "REOPEN_PROPOSED")) return false;
  const windowEnds = windowEndOf(cases, row);
  return windowEnds !== null && today() <= windowEnds;
}

/** Whether a request is addressed to the reader: their party, or, on a case raised without an account, its raiser's contact. */
const addressedTo = (row: CaseRow, request: EvidenceRequestRow, reader: CaseReader): boolean =>
  request.responsiblePartyId !== null ? request.responsiblePartyId === reader.party : request.responsibleContact === row.raiserContact && actsForRaiser(row, reader);

/**
 * GET /cases/{reference}: the reference is the credential, so anyone holding it reads the case; nothing about
 * another party is in the answer. A reference that names no case is CASE_NOT_FOUND, recorded, and says nothing
 * of what exists; a case classified as protected is PROTECTED_MATTER_NO_ACCESS here.
 */
export function caseRead(key: string, reference: string, reader: CaseReader): LoadOutcome<CaseView> {
  const cases = casesTable(key);
  sweepOverdue(key, cases);
  sweepLapsed(key, cases);
  const row = findCase(cases, reference);
  if (row === undefined) {
    audit(cases, reader.account, "read", reference, "CASE_NOT_FOUND");
    return refusedRead("CASE_NOT_FOUND");
  }
  // A party is never on a matter's access list: the raiser's own read is refused, and recorded, like anyone else's.
  if (row.protectedMatter) {
    protectedAccess(cases, row, reader.account, "read");
    return refusedRead("PROTECTED_MATTER_NO_ACCESS");
  }
  // A case the reader's party raised is read under PTY's answer for the reader (PERM-79): a delegate's within her delegation.
  if (raisedBy(cases, row, reader.party) && !actsUnderAuthority(key, reader, row.subjectRef, "PERM-79")) {
    audit(cases, reader.account, "read", reference, "ROLE_OUT_OF_SCOPE");
    return refusedRead("ROLE_OUT_OF_SCOPE");
  }
  const decision = latestDecision(cases, row);
  const appeal = decision !== null ? (appealsOf(cases, decision).at(-1) ?? null) : null;
  const proposals = cases.reopenings.filter((entry) => entry.caseId === row.id);
  const reopened = proposals.filter((entry) => entry.state === "REOPENED").at(-1);
  const proposed = proposals.at(-1);
  const raiser = actsForRaiser(row, reader);
  return ok({
    ...summaryOf(cases, row),
    owner: staffName(row.ownerActorId)?.name ?? null,
    evidenceRequests: cases.evidenceRequests
      .filter((entry) => entry.caseId === row.id)
      .map((request) => ({
        id: request.id,
        item: request.requestedItem,
        deadline: request.deadline,
        state: request.state,
        receiptOutcome: request.receiptOutcome,
        disclosure: request.disclosureStatus,
        answerable: (request.state === "ISSUED" || request.state === "OVERDUE") && addressedTo(row, request, reader),
        cancelledOn: request.cancelled?.on ?? null,
        late: request.late,
      })),
    decision: decision !== null ? decisionOf(decision) : null,
    appeal: appeal !== null ? appealSummary(appeal) : null,
    reopenedOn: reopened !== undefined && reopened.decidedAt !== null ? dayOf(reopened.decidedAt) : null,
    reopening: proposed !== undefined ? reopeningSummary(proposed) : null,
    evidence: heldFor(cases, row, reader),
    referral: row.state === "REFERRED" && row.referral !== null ? { process: row.referral.process, at: row.referral.at } : null,
    closure:
      (row.state === "CLOSED_INADMISSIBLE" || row.state === "CLOSED_INCOMPLETE") && row.closure !== null
        ? { disposition: row.closure.disposition, reason: row.closure.reason, route: row.closure.route, windowEnds: windowEndOf(cases, row) }
        : null,
    own: raisedBy(cases, row, reader.party),
    canWithdraw: WITHDRAWABLE.includes(row.state),
    canAppeal: decision !== null && appeal === null && raiser,
    canAddEvidence: raiser && row.state !== "WITHDRAWN" && row.state !== "REFERRED",
    // SCR-CAS-08 offers the reopening where its appeal form is not the reader's route: never both at once.
    canReopen: raiser && !(decision !== null && appeal === null) && reopenable(cases, row),
    supportLine: supportLine(key),
  });
}

/**
 * The cases a party raised from its account, newest first: `cases.case_parties` read by party, and of them those PTY
 * lets the person signed in read (PERM-79) - every one for the principal, a delegate's about her premises.
 */
export function casesRaisedBy(key: string, party: string): LoadOutcome<readonly CaseSummary[]> {
  const cases = casesTable(key);
  const reader = { party, account: null };
  const mine = [...cases.cases.values()].filter((row) => raisedBy(cases, row, party) && actsUnderAuthority(key, reader, row.subjectRef, "PERM-79"));
  return ok(mine.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((row) => summaryOf(cases, row)));
}

// ---------------------------------------------------------------- POST /cases/{id}/withdraw

/**
 * POST /cases/{id}/withdraw, by the party that raised the case: on the account-free route the reference is that
 * party's credential; a case raised from an account is withdrawn from that account only, and anyone else is
 * ROLE_OUT_OF_SCOPE (AC-FR-CAS-002-06). A decided case is CASE_ALREADY_DECIDED and keeps its decision; any other
 * state past ASSIGNED has no withdrawal (SM-05 transition 16).
 */
export function withdrawCase(key: string, reference: string, reader: CaseReader, reason = ""): CommandAnswer<{ state: CaseState }> {
  const cases = casesTable(key);
  const row = cases.cases.get(reference);
  if (row === undefined) return refuseBy(cases, reader.account, "withdraw", reference, "CASE_NOT_FOUND");
  if (!actsForRaiser(row, reader) || !actsUnderAuthority(key, reader, row.subjectRef, "PERM-80")) return refuseBy(cases, reader.account, "withdraw", reference, "ROLE_OUT_OF_SCOPE");
  if (DECIDED.includes(row.state)) return refuseBy(cases, reader.account, "withdraw", reference, "CASE_ALREADY_DECIDED");
  if (!WITHDRAWABLE.includes(row.state)) return refuseBy(cases, reader.account, "withdraw", reference, "TRANSITION_NOT_PERMITTED");
  // The withdrawing party and the instant are the history row; the reason, where one is given, goes with it.
  transition(cases, row, "WITHDRAWN", reason.trim() !== "" ? reason.trim().slice(0, ITEM_LIMIT) : null);
  row.nextStepBy = null;
  audit(cases, reader.account, "withdraw", reference, "WITHDRAWN");
  return accept({ state: row.state });
}

// ---------------------------------------------------------------- POST /evidence-requests/{id}/responses, by the party

/**
 * POST /evidence-requests/{id}/responses from SCR-CAS-02: the party the request addresses records what they supply,
 * or that they will not; a cancelled request is REQUEST_CANCELLED, anyone else ROLE_OUT_OF_SCOPE. What is supplied
 * is held against the case under the disclosure status chosen before the request was sent, and once no request is
 * open the case returns to investigation (SM-05 transition 8). A late answer is an answer, recorded late.
 */
export function answerEvidenceRequest(
  key: string,
  reader: CaseReader,
  reference: string,
  requestId: string,
  input: { outcome: string; supplied: string },
): CaseAnswer<{ outcome: ReceiptOutcome }> {
  const cases = casesTable(key);
  sweepOverdue(key, cases);
  const no = refuser(cases, reader.account, "answer", requestId);
  const row = findCase(cases, reference);
  const request = row !== undefined ? cases.evidenceRequests.find((entry) => entry.id === requestId && entry.caseId === row.id) : undefined;
  if (row === undefined || request === undefined) return no("CASE_NOT_FOUND");
  if (!addressedTo(row, request, reader) || !actsUnderAuthority(key, reader, row.subjectRef, "SUBMIT")) return no("ROLE_OUT_OF_SCOPE");
  const answer = responseOf(no, request, input);
  if ("refusal" in answer) return answer.refusal;
  if ("recorded" in answer) return done({ outcome: answer.recorded });
  recordResponse(cases, row, request, answer.outcome, answer.supplied, reader.account ?? row.raiserContact);
  // The case officer is told an answer arrived (SCR-CAS-06's Answer this request).
  const officer = staffName(row.ownerActorId) ?? request.issuedBy;
  notifyStaff(key, cases, row, officer, "evidence_answered", request.id, { item: request.requestedItem, by: today() });
  return done({ outcome: answer.outcome });
}

/**
 * POST /evidence-requests/{id}/responses checked in the contract's order: a cancelled request records nothing
 * (REQUEST_CANCELLED), an answered one is answered already, and what arrived is stated, including that nothing did
 * (RECEIPT_OUTCOME_REQUIRED), with what was supplied unless the party refused. A request past its deadline still
 * takes an answer, recorded late.
 */
function responseOf(
  no: Refuse,
  request: EvidenceRequestRow,
  input: { outcome: string; supplied: string },
): { refusal: CaseAnswer<never> } | { recorded: ReceiptOutcome } | { outcome: AnswerOutcome; supplied: string } {
  if (request.state === "CANCELLED") return { refusal: no("REQUEST_CANCELLED", {}, { date: request.cancelled?.on ?? "" }) };
  if ((request.state === "RESPONDED" || request.state === "NOT_SUPPLIED") && request.receiptOutcome !== null) return { recorded: request.receiptOutcome };
  const outcome = ANSWER_OUTCOMES.find((value) => value === input.outcome);
  if (outcome === undefined) return { refusal: no("RECEIPT_OUTCOME_REQUIRED", { outcome: "RECEIPT_OUTCOME_REQUIRED" }) };
  const supplied = input.supplied.trim().slice(0, ITEM_LIMIT);
  if (outcome !== "refused" && supplied === "") return { refusal: no("FIELD_MISSING", { supplied: "FIELD_MISSING" }) };
  return { outcome, supplied };
}

/**
 * What arrived against a request, recorded (SM-40 transition 1, or 3 when late): the item held against the case under
 * the disclosure status chosen before the request was sent, as supplied by the party the request addressed, and the
 * case back to investigation once no request is open (SM-05 transition 8).
 */
function recordResponse(cases: CasesTable, row: CaseRow, request: EvidenceRequestRow, outcome: ReceiptOutcome, supplied: string, recordedBy: string): void {
  const at = now();
  if (outcome !== "refused" && supplied !== "") {
    cases.caseEvidence.push({
      caseId: row.id,
      itemRef: supplied,
      suppliedByPartyId: request.responsiblePartyId,
      suppliedBy: request.responsiblePartyId !== null ? organisationName(request.responsiblePartyId) : (request.responsibleContact ?? row.raiserContact),
      disclosureStatus: request.disclosureStatus,
      receivedAt: at,
      via: "request",
    });
  }
  request.late = request.state === "OVERDUE";
  request.state = "RESPONDED";
  request.receiptOutcome = outcome;
  request.supplied = supplied !== "" ? supplied : null;
  request.respondedAt = at;
  request.recordedBy = recordedBy;
  if (row.state === "AWAITING_EVIDENCE" && openRequests(cases, row).length === 0) {
    transition(cases, row, "INVESTIGATING", "RESPONSE_RECORDED");
    row.nextStepBy = currentTarget(cases, row)?.targetOn ?? null;
  }
}

/**
 * POST /cases/{id}/evidence by the raiser, on their own case (SCR-CAS-02): an item and the status it carries, chosen
 * before it is supplied (DISCLOSURE_STATUS_REQUIRED), held against the case and recorded. Anyone else holding the
 * reference is ROLE_OUT_OF_SCOPE.
 */
export function supplyEvidence(key: string, reader: CaseReader, reference: string, input: { itemRef: string; disclosure: string }): CaseAnswer<{ item: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, reader.account, "evidence", reference);
  const row = findCase(cases, reference);
  if (row === undefined) return no("CASE_NOT_FOUND");
  if (!actsForRaiser(row, reader) || !actsUnderAuthority(key, reader, row.subjectRef, "SUBMIT") || row.protectedMatter) return no("ROLE_OUT_OF_SCOPE");
  if (row.state === "WITHDRAWN" || row.state === "REFERRED") return no("TRANSITION_NOT_PERMITTED", {}, { state: row.state, permitted: "" });
  const held = evidenceOf(no, input);
  if ("refusal" in held) return held.refusal;
  cases.caseEvidence.push({
    caseId: row.id,
    itemRef: held.item,
    suppliedByPartyId: reader.party,
    suppliedBy: reader.party !== null ? organisationName(reader.party) : row.raiserContact,
    disclosureStatus: held.disclosure,
    receivedAt: now(),
    via: "added",
  });
  audit(cases, reader.account, "evidence", reference, "EVIDENCE_HELD");
  return done({ item: held.item });
}

/** The item and its disclosure status, in the contract's order: the status first, then the item it is about. */
function evidenceOf(no: Refuse, input: { itemRef: string; disclosure: string }): { refusal: CaseAnswer<never> } | { item: string; disclosure: DisclosureStatus } {
  const fields: Record<string, string> = {};
  const disclosure = DISCLOSURES.find((value) => value === input.disclosure) ?? null;
  if (disclosure === null) fields.disclosure = "DISCLOSURE_STATUS_REQUIRED";
  const item = input.itemRef.trim().slice(0, ITEM_LIMIT);
  if (item === "") fields.itemRef = "FIELD_MISSING";
  if (disclosure === null || item === "") return { refusal: no(disclosure === null ? "DISCLOSURE_STATUS_REQUIRED" : "FIELD_MISSING", fields) };
  return { item, disclosure };
}

// ---------------------------------------------------------------- SCR-CAS-08 Lodge an appeal

/** SCR-CAS-08's read: the decision on the case the reference names, today beside its deadline, an appeal already open. */
export function appealForm(key: string, reference: string, reader: CaseReader): LoadOutcome<AppealForm> {
  const read = caseRead(key, reference, reader);
  if (read.data === null) return { data: null, failure: read.failure };
  const cases = casesTable(key);
  const row = findCase(cases, reference);
  // The reopening block shows where the appeal form does not - the decision was challenged already, or the case was
  // closed without one - and the case is closed: SCR-CAS-08 never offers both routes at once.
  const appealRoute = read.data.decision !== null && read.data.appeal === null;
  const decision = row !== undefined ? latestDecision(cases, row) : null;
  const waiting = row !== undefined ? cases.reopenings.filter((entry) => entry.caseId === row.id && entry.state === "REOPEN_PROPOSED").at(-1) : undefined;
  const reopen =
    row !== undefined && !appealRoute && REOPENABLE.includes(row.state) && actsForRaiser(row, reader)
      ? { outcomes: decision !== null ? outcomesOf(cases, decision) : [], windowEnds: windowEndOf(cases, row), waiting: waiting !== undefined ? reopeningSummary(waiting) : null }
      : null;
  return ok({
    reference: read.data.reference,
    today: today(),
    decision: read.data.decision,
    open: read.data.appeal?.state === "UNDER_APPEAL" ? read.data.appeal : null,
    decided: read.data.appeal !== null && read.data.appeal.state !== "UNDER_APPEAL" ? read.data.appeal : null,
    reopen,
    supportLine: read.data.supportLine,
    contact: row?.raiserContact ?? "",
  });
}

/**
 * POST /decisions/{id}/appeals: the party the decision went against lodges an appeal; it is measured from receipt,
 * against the CFG-48 period in force at the decision date (DR-48 row 6), and one received after the date the
 * decision stated is admitted and recorded late (row 2). NO_DECISION_TO_APPEAL with no decision, APPEAL_ALREADY_LODGED
 * when the decision has been challenged already, open or decided.
 */
export function lodgeAppeal(
  key: string,
  reader: CaseReader,
  reference: string,
  input: { grounds: string; contact: string },
): CaseAnswer<{ appeal: string; dueAt: string | null; late: boolean; measurement: "PERIOD_VERSION_NOT_APPROVED" | null }> {
  const cases = casesTable(key);
  const no = refuser(cases, reader.account, "appeal", reference);
  const row = findCase(cases, reference);
  if (row === undefined) return no("CASE_NOT_FOUND");
  if (!actsForRaiser(row, reader) || !actsUnderAuthority(key, reader, row.subjectRef, "PERM-87")) return no("ROLE_OUT_OF_SCOPE");
  const decision = latestDecision(cases, row);
  if (decision === null) return no("NO_DECISION_TO_APPEAL");
  // AC-FR-CAS-008-06: a decision is challenged once. While that appeal is open the refusal names its answer date;
  // once it is decided the outcome names the route beyond RightOne, and a second appeal is refused the same way.
  const earlier = appealsOf(cases, decision).at(-1);
  if (earlier !== undefined) return no("APPEAL_ALREADY_LODGED", {}, { date: earlier.outcome?.decidedAt ?? earlier.dueAt ?? "" });
  const fields: Record<string, string> = {};
  if (input.grounds.trim() === "") fields.grounds = "FIELD_MISSING";
  if (input.contact.trim() === "") fields.contact = "FIELD_MISSING";
  if (Object.keys(fields).length > 0) return no("FIELD_MISSING", fields);
  const at = now();
  // DR-48 row 6: the CFG-48 version in force when the decision was issued, whatever was approved since. Where none was
  // approved for the case type, measuring the appeal is refused (AC-FR-CAS-021-03): it is lodged, since the party's
  // challenge does not wait on the organisation's period, and no due date is set from a version nobody approved.
  const period = periodOn(cases, "appeal_decision", row.caseType, dayOf(decision.issuedAt));
  const appeal: AppealRow = {
    id: newReference("APL"),
    decisionId: decision.id,
    caseId: row.id,
    grounds: input.grounds.trim().slice(0, MATTER_LIMIT),
    appellantContact: input.contact.trim(),
    receivedAt: at,
    period: period !== null ? { amount: period.amount, versionNo: period.versionNo, effectiveFrom: period.effectiveFrom } : null,
    dueAt: period !== null ? `${addWorkingDays(at, period.amount)}T23:59:59+07:00` : null,
    measurement: period !== null ? null : "PERIOD_VERSION_NOT_APPROVED",
    late: decision.appealDeadline !== null && dayOf(at) > decision.appealDeadline,
    state: "UNDER_APPEAL",
    outcome: null,
    outcomeGround: null,
    decidedBy: null,
  };
  cases.appeals.push(appeal);
  cases.appealStateHistory.push({ subjectId: appeal.id, fromState: null, toState: "UNDER_APPEAL", actor: reader.account, occurredAt: at });
  if (appeal.measurement !== null) audit(cases, reader.account, "appeal", appeal.id, appeal.measurement);
  return done({ appeal: appeal.id, dueAt: appeal.dueAt, late: appeal.late, measurement: appeal.measurement });
}

/**
 * POST /cases/{id}/reopenings by the raiser, on their own case (SCR-CAS-08's Ask for a reopening): new evidence,
 * described, with the date it came to exist and what it would displace, answered as an officer's proposal is
 * (DR-49 in its order, every refusal recorded, AC-FR-CAS-016-07). It waits for an authority, as any proposal does.
 */
export function askReopening(key: string, reader: CaseReader, reference: string, input: ReopeningInput): CaseAnswer<{ reopening: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, reader.account, "reopen", reference);
  const row = findCase(cases, reference);
  if (row === undefined) return no("CASE_NOT_FOUND");
  if (!actsForRaiser(row, reader) || !actsUnderAuthority(key, reader, row.subjectRef, "PERM-90")) return no("ROLE_OUT_OF_SCOPE");
  return propose(cases, no, row, { name: reader.account ?? row.raiserContact, email: "" }, "raiser", input, supportLine(key));
}

// ---------------------------------------------------------------- the case console: reads

/** Whole days past a due date, or null while it is not passed or the case no longer runs against it. */
function overdue(row: CaseRow, due: string | null): number | null {
  if (due === null || SETTLED.includes(row.state)) return null;
  const late = daysBetween(due, today());
  return late > 0 ? late : null;
}

/** A cursor names the position and the case at it, so a page whose rows moved is CURSOR_INVALID rather than wrong. */
const cursorOf = (offset: number, reference: string) => `${String(offset)}.${reference}`;

/**
 * GET /cases for SCR-CAS-03: the cases in the reader's scope, filtered by state, type and owner, the soonest due
 * first and the cases that run no more after them, a keyset page at a time. A protected matter is left out
 * entirely rather than shown and refused.
 */
export function caseQueue(key: string, staff: Staff, filter: QueueFilter, cursor: string | null): LoadOutcome<CaseQueue> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-CAS")) return refusedReadBy(cases, staff.email, "list", "cases", "ROLE_NOT_ASSIGNED");
  sweepOverdue(key, cases);
  // A protected matter is in the list only of a reader its category's access list admits; for anyone else it is
  // left out rather than shown and refused, and the omission is recorded.
  const all = [...cases.cases.values()].filter((row) => !row.protectedMatter || protectedAccess(cases, row, staff.email, "list") === "ACCESS_PERMITTED");
  const rows = all
    .filter(
      (row) =>
        (filter.state === null || row.state === filter.state) &&
        (filter.caseType === null || row.caseType === filter.caseType) &&
        (filter.owner === null || (filter.owner === "none" ? row.ownerActorId === null : row.ownerActorId === filter.owner)),
    )
    .map((row): QueueRow => {
      const due = SETTLED.includes(row.state) ? null : row.nextStepBy;
      return {
        reference: row.reference,
        caseType: row.caseType,
        state: row.state,
        submittedAt: row.submittedAt,
        due,
        overdueDays: overdue(row, due),
        owner: staffName(row.ownerActorId),
        priority: currentTarget(cases, row)?.priority ?? null,
      };
    })
    .sort((a, b) => (a.due === null ? 1 : 0) - (b.due === null ? 1 : 0) || (a.due ?? "").localeCompare(b.due ?? "") || b.submittedAt.localeCompare(a.submittedAt));
  let offset = 0;
  if (cursor !== null) {
    const match = /^(\d+)\.(.+)$/.exec(cursor);
    const at = match !== null ? Number(match[1]) : Number.NaN;
    if (match === null || !Number.isInteger(at) || at <= 0 || rows[at - 1]?.reference !== match[2]) return refusedReadBy(cases, staff.email, "list", cursor, "CURSOR_INVALID");
    offset = at;
  }
  const page = rows.slice(offset, offset + QUEUE_PAGE);
  const last = page.at(-1);
  return ok({
    asOf: now(),
    rows: page,
    total: rows.length,
    offset,
    nextCursor: offset + page.length < rows.length && last !== undefined ? cursorOf(offset + page.length, last.reference) : null,
    filter,
    owners: caseOfficers(),
    states: [...new Set(all.map((row) => row.state))],
  });
}

function derivationOf(target: SlaTargetRow | null): Derivation | null {
  if (target === null) return null;
  return {
    priority: target.priority,
    targetOn: target.targetOn,
    objectiveVersion: target.objectiveVersion,
    statutoryLimit: target.statutoryLimit,
    reason: target.reason,
    severity: target.severity,
    impact: target.impact,
    vulnerability: target.vulnerability,
    derivedAt: target.inForceFrom,
  };
}

/** GET /cases/{reference} for SCR-CAS-04: the case, its classification and derivation inputs, its links and parties. */
export function consoleCase(key: string, staff: Staff, reference: string): LoadOutcome<ConsoleCaseView> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-CAS")) return refusedReadBy(cases, staff.email, "read", reference, "ROLE_NOT_ASSIGNED");
  sweepOverdue(key, cases);
  sweepLapsed(key, cases);
  const row = findCase(cases, reference);
  if (row === undefined) return refusedReadBy(cases, staff.email, "read", reference, "CASE_NOT_FOUND");
  const access = protectedAccess(cases, row, staff.email, "read");
  if (access !== null && access !== "ACCESS_PERMITTED") return refusedRead(access);
  const day = today();
  const decision = latestDecision(cases, row);
  const appeal = decision !== null ? (appealsOf(cases, decision).at(-1) ?? null) : null;
  const reopening = cases.reopenings.filter((entry) => entry.caseId === row.id).at(-1) ?? null;
  const requests = cases.evidenceRequests.filter((request) => request.caseId === row.id);
  const limits: Record<string, { days: number; instrument: string }> = {};
  for (const type of CASE_TYPES) {
    const limit = statutoryLimitOf(cases, type, day);
    if (limit !== null) limits[type] = limit;
  }
  return ok({
    asOf: now(),
    today: day,
    reference: row.reference,
    state: row.state,
    stateSince: stateSince(cases, row),
    submittedAt: row.submittedAt,
    group: row.stakeholderGroup,
    raiser: { party: row.raiserPartyId, name: row.raiserPartyId !== null ? organisationName(row.raiserPartyId) : null, account: row.recordedBy },
    agent: row.agent,
    route: routeOf(cases, row),
    contact: row.raiserContact,
    matter: row.matter,
    caseType: row.caseType,
    subjectKind: row.subjectKind,
    subjectRef: row.subjectRef,
    period: { from: row.affectedPeriodFrom, to: row.affectedPeriodTo },
    requestedRemedy: row.requestedRemedyKind,
    owner: staffName(row.ownerActorId),
    severity: row.severity,
    impact: row.businessImpact,
    vulnerability: row.raiserVulnerability,
    derivation: derivationOf(currentTarget(cases, row)),
    statutoryLimits: limits,
    links: cases.caseLinks
      .filter((link) => link.fromCaseId === row.id || link.toCaseId === row.id)
      .flatMap((link) => {
        const other = caseById(cases, link.fromCaseId === row.id ? link.toCaseId : link.fromCaseId);
        return other !== undefined ? [{ reference: other.reference, kind: link.linkKind, state: other.state }] : [];
      }),
    parties: cases.caseParties.filter((party) => party.caseId === row.id).map((party) => ({ party: party.partyId, name: organisationName(party.partyId), role: party.partyRole })),
    history: cases.caseStateHistory.filter((entry) => entry.caseId === row.id).map((entry) => ({ from: entry.fromState, to: entry.toState, at: entry.occurredAt, reason: entry.reason })),
    notices: cases.caseNotices.filter((notice) => notice.caseId === row.id).map((notice) => ({ reference: notice.reference, kind: notice.kind, at: notice.at })),
    evidence: { open: requests.filter((request) => request.state === "ISSUED" || request.state === "OVERDUE").length, total: requests.length },
    decision: decision !== null ? { issuedAt: decision.issuedAt, remedy: decision.remedyKind, maker: decision.maker } : null,
    appeal: appeal !== null ? { reference: appeal.id, state: appeal.state, dueAt: appeal.dueAt } : null,
    reopening: reopening !== null ? { reference: reopening.id, state: reopening.state } : null,
    referral: row.referral,
    closure: row.closure,
    protection: protectionOf(cases, row),
    options: {
      caseTypes: CASE_TYPES,
      remediesByType: CASE_TYPE_REMEDIES,
      subjectKinds: SUBJECT_KINDS,
      owners: caseOfficers(),
      parties: ORGANISATIONS.map((organisation) => ({ id: organisation.id, name: organisation.name })),
      closeApprovers: caseOfficers().filter((officer) => officer.email !== row.ownerActorId && officer.email !== staff.email),
      categories: PROTECTED_CATEGORIES.filter((category) => categoryPolicyOn(cases, category, day) !== null),
      staff: staffAccounts(),
    },
  });
}

/** The protected matter a case is restricted under, as a reader on its access list sees it; null where it is not one. */
function protectionOf(cases: CasesTable, row: CaseRow): ConsoleCaseView["protection"] {
  const matter = row.protectedMatter ? matterOf(cases, row) : null;
  return matter !== null ? { category: matter.category, state: matter.state, since: matter.classifiedAt, process: matter.specialistProcess } : null;
}

/** The intake route a case arrived on, with the matrix version that route belongs to; null where a module opened it. */
function routeOf(cases: CasesTable, row: CaseRow): ConsoleCaseView["route"] {
  const route = cases.intakeRoutes.find((candidate) => candidate.id === row.intakeRouteId);
  const version = route !== undefined ? cases.intakeMatrixVersions.find((candidate) => candidate.id === route.intakeMatrixVersionId) : undefined;
  return route !== undefined && version !== undefined ? { versionNo: version.versionNo, kind: route.kind } : null;
}

/** Who a request may address: every party on the case, and the raiser's contact where they hold no account. */
function addresseesOf(cases: CasesTable, row: CaseRow): { value: string; label: string }[] {
  const parties = cases.caseParties
    .filter((party) => party.caseId === row.id && party.partyId !== "")
    .filter((party, index, all) => all.findIndex((other) => other.partyId === party.partyId) === index)
    .map((party) => ({ value: `party:${party.partyId}`, label: organisationName(party.partyId) }));
  return row.raiserPartyId === null ? [{ value: "contact", label: row.raiserContact }, ...parties] : parties;
}

/** SM-40's cancel and POST /evidence-requests/{id}/cancel: the officer who issued the request, or the case owner. */
const mayCancel = (row: CaseRow, request: EvidenceRequestRow, staff: Staff) => request.issuedBy.email === staff.email || row.ownerActorId === staff.email;

/** GET /cases/{id}/evidence-requests for SCR-CAS-06, with the CFG-49 period a new request is held to and every item held. */
export function evidencePage(key: string, staff: Staff, reference: string): LoadOutcome<EvidencePage> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-CAS")) return refusedReadBy(cases, staff.email, "read evidence", reference, "ROLE_NOT_ASSIGNED");
  sweepOverdue(key, cases);
  const row = findCase(cases, reference);
  if (row === undefined) return refusedReadBy(cases, staff.email, "read evidence", reference, "CASE_NOT_FOUND");
  const access = protectedAccess(cases, row, staff.email, "read evidence");
  if (access !== null && access !== "ACCESS_PERMITTED") return refusedRead(access);
  const day = today();
  const period = periodOn(cases, "evidence_response", row.caseType, day);
  return ok({
    reference: row.reference,
    state: row.state,
    caseType: row.caseType,
    today: day,
    rows: cases.evidenceRequests
      .filter((request) => request.caseId === row.id)
      .map((request) => ({
        id: request.id,
        item: request.requestedItem,
        party: request.responsiblePartyId !== null ? organisationName(request.responsiblePartyId) : (request.responsibleContact ?? ""),
        deadline: request.deadline,
        disclosure: request.disclosureStatus,
        state: request.state,
        receiptOutcome: request.receiptOutcome,
        issuedAt: request.issuedAt,
        issuedBy: request.issuedBy.name,
        supplied: request.supplied,
        respondedAt: request.respondedAt,
        late: request.late,
        recordedBy: request.recordedBy,
        cancelled: request.cancelled,
        mayCancel: mayCancel(row, request, staff),
      })),
    held: cases.caseEvidence
      .filter((item) => item.caseId === row.id)
      .map((item): EvidenceItemRow => ({ item: item.itemRef, disclosure: item.disclosureStatus, receivedAt: item.receivedAt, suppliedBy: item.suppliedBy, via: item.via })),
    addressees: addresseesOf(cases, row),
    suppliers: [{ value: "team", label: staff.account }, ...addresseesOf(cases, row)],
    policy: period !== null && period.unit === "working_days" ? { workingDays: period.amount, latest: addWorkingDays(day, period.amount) } : null,
  });
}

/** The deadline a decision issued on a day gives the party: the CFG-48 period in force for the case type. */
function appealDeadlineFrom(cases: CasesTable, row: CaseRow, day: string): string | null {
  const period = periodOn(cases, "appeal_decision", row.caseType, day);
  return period !== null ? addWorkingDays(day, period.amount) : null;
}

/** GET /cases/{id}/decisions for SCR-CAS-07: the case to decide, the draft, or the decision issued, read-only. */
export function decisionPage(key: string, staff: Staff, reference: string): LoadOutcome<DecisionPage> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-CAS", "ACT-BIZ-APR", "ACT-DSP")) return refusedReadBy(cases, staff.email, "read decision", reference, "ROLE_NOT_ASSIGNED");
  sweepOverdue(key, cases);
  const row = findCase(cases, reference);
  if (row === undefined) return refusedReadBy(cases, staff.email, "read decision", reference, "CASE_NOT_FOUND");
  const access = protectedAccess(cases, row, staff.email, "read decision");
  if (access !== null && access !== "ACCESS_PERMITTED") return refusedRead(access);
  const day = today();
  const decision = latestDecision(cases, row);
  const inForce = remedyInForce(cases, row);
  return ok({
    reference: row.reference,
    state: row.state,
    caseType: row.caseType,
    today: day,
    matter: row.matter,
    requestedRemedy: row.requestedRemedyKind,
    owner: staffName(row.ownerActorId),
    raiserLabel: row.raiserPartyId !== null ? organisationName(row.raiserPartyId) : row.raiserContact,
    remedies: row.caseType !== null ? (CASE_TYPE_REMEDIES[row.caseType] ?? []) : [],
    grounds: GOVERNING_GROUNDS,
    evidence: cases.evidenceRequests
      .filter((request) => request.caseId === row.id)
      .map((request) => ({ item: request.requestedItem, state: request.state, receiptOutcome: request.receiptOutcome })),
    appealDeadline: appealDeadlineFrom(cases, row, day),
    draft: cases.decisionDrafts.get(row.id) ?? null,
    issued: decision !== null ? { ...decisionOf(decision), governingGround: decision.governingGround, maker: decision.maker } : null,
    financial: inForce !== null && requiredFor(cases, inForce.remedy).length > 0,
  });
}

/** GET /decisions/{id}/remedy-links for SCR-CAS-10: every kind the remedy in force requires, what is linked, and the answer. */
export function remedyPage(key: string, staff: Staff, reference: string): LoadOutcome<RemedyPage> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-CAS", "ACT-FIN-OP")) return refusedReadBy(cases, staff.email, "read remedy", reference, "ROLE_NOT_ASSIGNED");
  const row = findCase(cases, reference);
  if (row === undefined) return refusedReadBy(cases, staff.email, "read remedy", reference, "CASE_NOT_FOUND");
  const access = protectedAccess(cases, row, staff.email, "read remedy");
  if (access !== null && access !== "ACCESS_PERMITTED") return refusedRead(access);
  const inForce = remedyInForce(cases, row);
  const linkage = linkageOf(cases, row);
  if (inForce === null || linkage === null) return refusedReadBy(cases, staff.email, "read remedy", reference, "DECISION_NOT_FOUND");
  const links = linksInForce(cases, inForce);
  return ok({
    reference: row.reference,
    state: row.state,
    remedy: inForce.remedy,
    fromAppeal: inForce.appeal?.id ?? null,
    rows: linkage.required.map((kind) => {
      const link = links.get(kind);
      return {
        kind,
        link:
          link !== undefined
            ? { reference: link.artefactRef, namesCase: link.backReferencePresent, linkedAt: link.linkedAt, linkedBy: link.linkedBy, checkedAt: link.checkedAt }
            : null,
      };
    }),
    linkage:
      linkage.missing.length === 0 && linkage.absent.length === 0
        ? { complete: true, closedOn: row.state === "CLOSED" ? closedOn(cases, row) : null }
        : { complete: false, missing: linkage.missing, absent: linkage.absent },
    mayLink: ARTEFACT_KINDS.filter((kind) => (FINANCIAL.includes(kind) ? holds(staff, "ACT-FIN-OP") : holds(staff, "ACT-CAS", "ACT-FIN-OP"))),
  });
}

/** The approvals surface's queue: the appeals and the reopenings a dispute authority decides, the open ones first. */
export function approvalsQueue(key: string, staff: Staff): LoadOutcome<ApprovalsQueue> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-DSP")) return refusedReadBy(cases, staff.email, "list approvals", "approvals", "ROLE_NOT_ASSIGNED");
  sweepLapsed(key, cases);
  const caseRef = (id: string) => caseById(cases, id)?.reference ?? "";
  return ok({
    asOf: now(),
    appeals: cases.appeals
      .map((appeal) => ({ reference: appeal.id, caseReference: caseRef(appeal.caseId), receivedAt: appeal.receivedAt, dueAt: appeal.dueAt, late: appeal.late, state: appeal.state }))
      .sort((a, b) => (a.state === "UNDER_APPEAL" ? 0 : 1) - (b.state === "UNDER_APPEAL" ? 0 : 1) || b.receivedAt.localeCompare(a.receivedAt)),
    reopenings: cases.reopenings
      .map((entry) => ({
        reference: entry.id,
        caseReference: caseRef(entry.caseId),
        groundKind: entry.groundKind,
        proposedAt: entry.recordedAt,
        proposedBy: entry.proposedBy.name,
        proposer: entry.proposer,
        state: entry.state,
      }))
      .sort((a, b) => (a.state === "REOPEN_PROPOSED" ? 0 : 1) - (b.state === "REOPEN_PROPOSED" ? 0 : 1) || b.proposedAt.localeCompare(a.proposedAt)),
  });
}

/** ALG-23: the act that disqualifies the reader from deciding an appeal on this decision, or null when nothing does. */
function disqualifyingAct(decision: DecisionRow, email: string): "made" | "approved" | null {
  if (decision.maker.email === email) return "made";
  if (decision.approver.email === email) return "approved";
  return null;
}

/**
 * POST /appeals/{id}/eligibility then GET /appeals/{id}, for SCR-CAS-09. The eligibility answer comes first and
 * from the recorded people, never the roles held today: an ineligible reader is told why and shown nothing of the
 * file, and the attempt is recorded.
 */
export function appealPage(key: string, staff: Staff, appealRef: string): LoadOutcome<AppealPage> {
  const cases = casesTable(key);
  if (!holds(staff, "ACT-DSP", "ACT-CAS")) return refusedReadBy(cases, staff.email, "read appeal", appealRef, "ROLE_NOT_ASSIGNED");
  sweepLapsed(key, cases);
  const appeal = cases.appeals.find((entry) => entry.id === appealRef.trim().toUpperCase());
  const decision = appeal !== undefined ? cases.decisions.find((entry) => entry.id === appeal.decisionId) : undefined;
  const row = appeal !== undefined ? caseById(cases, appeal.caseId) : undefined;
  if (appeal === undefined || decision === undefined || row === undefined) return refusedReadBy(cases, staff.email, "read appeal", appealRef, "APPEAL_NOT_FOUND");
  const access = protectedAccess(cases, row, staff.email, "read appeal");
  if (access !== null && access !== "ACCESS_PERMITTED") return refusedRead(access);
  const head = { reference: appeal.id, caseReference: row.reference, receivedAt: appeal.receivedAt, dueAt: appeal.dueAt, period: appeal.period, measurement: appeal.measurement };
  const act = disqualifyingAct(decision, staff.email);
  if (act !== null) {
    audit(cases, staff.email, "eligibility", appeal.id, "APPEAL_DECIDER_CONFLICT");
    return ok({ ...head, eligibility: { eligible: false, act, on: dayOf(decision.issuedAt) } });
  }
  return ok({
    ...head,
    eligibility: { eligible: true },
    mayDecide: holds(staff, "ACT-DSP"),
    late: appeal.late,
    lapsed: appeal.state === "APPEAL_LAPSED",
    state: appeal.state,
    grounds: appeal.grounds,
    decision: { ...decisionOf(decision), governingGround: decision.governingGround },
    remedies: row.caseType !== null ? (CASE_TYPE_REMEDIES[row.caseType] ?? []) : [],
    governingGrounds: GOVERNING_GROUNDS,
    outcome: appeal.outcome,
    decidedBy: appeal.decidedBy?.name ?? null,
    today: today(),
  });
}

/** The outcomes a decision carried, which a reopening may displace: its remedy, and any remedy an appeal set. */
function outcomesOf(cases: CasesTable, decision: DecisionRow): RemedyKind[] {
  const set = new Set<RemedyKind>([decision.remedyKind]);
  for (const appeal of appealsOf(cases, decision)) {
    const remedy = appeal.outcome?.remedy ?? null;
    if (remedy !== null) set.add(remedy);
  }
  return [...set];
}

/** The last day new evidence may be offered on a closed case: the CFG-51 window in force at its closure. */
function windowEndOf(cases: CasesTable, row: CaseRow): string | null {
  const closed = closedOn(cases, row);
  if (closed === null) return null;
  const window = periodOn(cases, "reopen_window", row.caseType, closed);
  if (window === null) return null;
  return window.unit === "months" ? addMonths(closed, window.amount) : addWorkingDays(closed, window.amount);
}

/** GET /cases/{id}/reopenings for SCR-CAS-15: the closed decision, the proposal open on it, and every earlier one. */
export function reopeningPage(key: string, staff: Staff, reference: string): LoadOutcome<ReopeningPage> {
  const cases = casesTable(key);
  // ACT-AUD reads every case's reopenings, and acts on none of them (GET /cases/{id}/reopenings).
  if (!holds(staff, "ACT-CAS", "ACT-DSP", "ACT-AUD")) return refusedReadBy(cases, staff.email, "read reopenings", reference, "ROLE_NOT_ASSIGNED");
  const row = findCase(cases, reference);
  if (row === undefined) return refusedReadBy(cases, staff.email, "read reopenings", reference, "CASE_NOT_FOUND");
  const access = protectedAccess(cases, row, staff.email, "read reopenings");
  if (access !== null && access !== "ACCESS_PERMITTED") return refusedRead(access);
  const decision = latestDecision(cases, row);
  const all = cases.reopenings.filter((entry) => entry.caseId === row.id);
  const open = all.find((entry) => entry.state === "REOPEN_PROPOSED") ?? null;
  return ok({
    reference: row.reference,
    state: row.state,
    today: today(),
    closedOn: closedOn(cases, row),
    decision: decision !== null ? { issuedAt: decision.issuedAt, remedy: decision.remedyKind, outcomes: outcomesOf(cases, decision) } : null,
    open:
      open !== null
        ? {
            reference: open.id,
            groundKind: open.groundKind,
            groundRef: open.groundRef,
            evidenceOn: open.evidenceOn,
            displaced: open.displaced,
            proposedAt: open.recordedAt,
            proposedBy: open.proposedBy,
            proposer: open.proposer,
            state: open.state,
          }
        : null,
    history: all
      .filter((entry) => entry.state !== "REOPEN_PROPOSED")
      .map((entry) => ({
        reference: entry.id,
        groundKind: entry.groundKind,
        groundRef: entry.groundRef,
        state: entry.state,
        recordedAt: entry.recordedAt,
        decidedAt: entry.decidedAt,
        displaced: entry.displaced,
        refusedReason: entry.refusedReason,
      })),
    windowEnds: windowEndOf(cases, row),
  });
}

function matrixVersionView(cases: CasesTable, version: IntakeMatrixVersion): MatrixVersionView {
  const routes = routesOf(cases, version).map(({ group, kind, requiresAccount }) => ({ group, kind, requiresAccount }));
  return {
    id: version.id,
    versionNo: version.versionNo,
    state: version.state,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    preparedBy: version.preparedBy,
    approvedBy: version.approvedBy,
    approvedAt: version.approvedAt,
    routes,
    withoutAccountFree: groupWithoutAccountFreeRoute(routes),
  };
}

/** SCR-CAS-16: the version in force, and the one prepared, if any, with every route each lists. */
export function intakeMatrixPage(key: string, staff: Staff): LoadOutcome<IntakeMatrixPage> {
  if (!holds(staff, "ACT-CAS", "ACT-BIZ-APR")) return refusedRead("ROLE_NOT_ASSIGNED");
  const cases = casesTable(key);
  const day = today();
  const inForce = effectiveVersion(cases, day);
  const prepared = cases.intakeMatrixVersions.filter((version) => version.state === "PREPARED").at(-1) ?? null;
  return ok({
    today: day,
    inForce: inForce !== null ? matrixVersionView(cases, inForce) : null,
    prepared: prepared !== null ? matrixVersionView(cases, prepared) : null,
    groups: STAKEHOLDER_GROUPS,
  });
}

const isPeriodKind = (register: PolicyRegisterCode): register is PeriodKind =>
  register === "appeal_decision" || register === "evidence_response" || register === "reopen_window";

/** SCR-CAS-18: one register, its entries or period versions, the one in force and any being prepared. */
export function policyRegister(key: string, staff: Staff, register: string): LoadOutcome<PolicyRegisterPage> {
  const cases = casesTable(key);
  // The security owner prepares a protected category's policy and the data-protection officer approves it (CFG-50).
  if (!holds(staff, "ACT-CAS", "ACT-BIZ-APR", "ACT-SEC", "ACT-DPO")) return refusedReadBy(cases, staff.email, "read register", register, "ROLE_NOT_ASSIGNED");
  const code = POLICY_REGISTERS.find((candidate) => candidate === register);
  if (code === undefined) return refusedReadBy(cases, staff.email, "read register", register, "REGISTER_UNKNOWN");
  const counts = {} as Record<PolicyRegisterCode, number>;
  for (const candidate of POLICY_REGISTERS) {
    counts[candidate] = isPeriodKind(candidate)
      ? cases.policyPeriods.filter((period) => period.kind === candidate).length
      : candidate === "protected_category"
        ? cases.categoryPolicies.length
        : cases.registerEntries.filter((entry) => entry.register === candidate).length;
  }
  return ok({
    today: today(),
    register: code,
    entries: isPeriodKind(code)
      ? []
      : cases.registerEntries
          .filter((entry) => entry.register === code)
          .map((entry) => ({
            id: entry.id,
            code: entry.code,
            label: entry.label,
            requiredAuthority: entry.requiredAuthority,
            limit: entry.limit,
            requires: entry.requires,
            state: entry.state,
            effectiveFrom: entry.effectiveFrom,
            preparedBy: entry.preparedBy,
            approvedBy: entry.approvedBy,
            approvedAt: entry.approvedAt,
            refused: entry.refused,
          })),
    periods: isPeriodKind(code)
      ? cases.policyPeriods
          .filter((period) => period.kind === code)
          .sort((a, b) => a.caseType.localeCompare(b.caseType) || a.versionNo - b.versionNo)
          .map((period) => ({
            id: period.id,
            caseType: period.caseType,
            versionNo: period.versionNo,
            amount: period.amount,
            unit: period.unit,
            state: period.state,
            effectiveFrom: period.effectiveFrom,
            effectiveTo: period.effectiveTo,
            preparedBy: period.preparedBy,
            approvedBy: period.approvedBy,
            approvedAt: period.approvedAt,
            refused: period.refused,
          }))
      : [],
    categoryPolicies:
      code === "protected_category"
        ? cases.categoryPolicies
            .slice()
            .sort((a, b) => a.category.localeCompare(b.category) || a.versionNo - b.versionNo)
            .map(({ id, category, versionNo, specialistProcess, access, primary, alternate, state, effectiveFrom, effectiveTo, preparedBy, approvedBy, approvedAt, refused: refusal }): CategoryPolicyView => ({
              id,
              category,
              versionNo,
              specialistProcess,
              access,
              primary,
              alternate,
              state,
              effectiveFrom,
              effectiveTo,
              preparedBy,
              approvedBy,
              approvedAt,
              refused: refusal,
            }))
        : [],
    unmeasured: code === "appeal_decision" ? unmeasuredAppeals(cases) : [],
    caseTypes: CASE_TYPES,
    authorities: PAUSE_AUTHORITIES,
    staff: staffAccounts(),
    counts,
  });
}

/**
 * The appeals lodged while no appeal period was approved for their case type (AC-FR-CAS-021-03): an appeal is measured
 * against the version in force when its decision was issued, so approving one now does not measure them. SCR-CAS-18
 * names them beside Approve and publish, with PERIOD_VERSION_NOT_APPROVED, so the approver knows what the approval
 * does not reach.
 */
function unmeasuredAppeals(cases: CasesTable): UnmeasuredAppeal[] {
  return cases.appeals
    .filter((appeal) => appeal.measurement !== null && appeal.state === "UNDER_APPEAL")
    .flatMap((appeal) => {
      const row = caseById(cases, appeal.caseId);
      return row !== undefined ? [{ appeal: appeal.id, caseReference: row.reference, caseType: row.caseType, receivedAt: appeal.receivedAt }] : [];
    });
}

/**
 * The appeal an approval of this appeal-period version would reach back over, or null: one lodged while no period was
 * approved for its case type, on a decision issued on or after the version's effective date. DR-48 row 6 measures an
 * appeal by the version in force when its decision was issued, so approving this one would make it read as governing
 * an appeal that was measured against nothing anybody had approved - which is the measurement AC-FR-CAS-021-03
 * refuses. The approver is told which appeal, and the version is prepared again from a later day.
 */
function appealReachedBy(cases: CasesTable, period: PolicyPeriodRow): { appeal: string; issuedOn: string } | null {
  if (period.kind !== "appeal_decision") return null;
  for (const appeal of cases.appeals) {
    if (appeal.measurement === null) continue;
    const row = caseById(cases, appeal.caseId);
    const decision = cases.decisions.find((entry) => entry.id === appeal.decisionId);
    if (row === undefined || decision === undefined || row.caseType !== period.caseType) continue;
    const issuedOn = dayOf(decision.issuedAt);
    if (issuedOn >= period.effectiveFrom) return { appeal: appeal.id, issuedOn };
  }
  return null;
}

// ---------------------------------------------------------------- the case console: acts

/** The roles a pause ground may require: the permission entries that record a clock event (`frd/09`). */
const PAUSE_AUTHORITIES: readonly StaffRole[] = ["ACT-CAS", "ACT-BIZ-APR", "ACT-LGL"];

/**
 * The case a console act is on, or the refusal: the role first, then the case, then the matter's access list where
 * the case is protected. Every refusal of the act - these, and the ones its own checks give through `no` - is
 * recorded with the actor, the time and the code before it is answered.
 */
function actOn(
  key: string,
  staff: Staff,
  reference: string,
  act: string,
  ...roles: readonly StaffRole[]
): { cases: CasesTable; row: CaseRow; no: Refuse } | { refusal: CaseAnswer<never> } {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, act, reference);
  if (!holds(staff, ...roles)) return { refusal: no("ROLE_NOT_ASSIGNED") };
  sweepOverdue(key, cases);
  const row = findCase(cases, reference);
  if (row === undefined) return { refusal: no("CASE_NOT_FOUND", {}, { reference }) };
  // The access check records the attempt itself, permitted or refused.
  const access = protectedAccess(cases, row, staff.email, act);
  if (access !== null && access !== "ACCESS_PERMITTED") return { refusal: refused(access) };
  return { cases, row, no };
}

const notPermitted = (no: Refuse, row: CaseRow) => no("TRANSITION_NOT_PERMITTED", {}, { state: row.state, permitted: REACHABLE[row.state].join(", ") });

/** SM-05 transition 2, taken by the first act that needs an assigned owner: the owner classification recorded. */
function assign(cases: CasesTable, row: CaseRow): void {
  if (row.state === "TRIAGED") transition(cases, row, "ASSIGNED", staffName(row.ownerActorId)?.name ?? null);
}

/** An occurrence of a case's state change, unique to it, for COM's dedup: the case and the change's place in its history. */
const changeRef = (cases: CasesTable, row: CaseRow) => `${row.reference}:${String(cases.caseStateHistory.filter((entry) => entry.caseId === row.id).length)}`;

export interface ClassifyInput {
  caseType: string;
  subjectKind: string;
  subjectRef: string;
  period: { from: string | null; to: string | null; unreadable: boolean };
  remedy: string;
  owner: string;
  severity: string;
  impact: string;
  vulnerability: string;
}

/**
 * POST /cases/{id}/classify (SM-05 transition 1, DR-47 through ALG-21): every field at once, the owner among them
 * (AC-FR-CAS-003-03), then the two refusals of the derivation in DR-47's order - no objective version, no
 * vulnerability answer - and on success the target with the inputs it read, the case TRIAGED with its owner
 * recorded. It rests there, where it can still be referred or closed as inadmissible; the first act that needs the
 * owner assigned takes transition 2. A refused derivation leaves no provisional target. A case classified again
 * keeps its state and gains a new target row; the earlier one stays readable.
 */
export function classifyCase(key: string, staff: Staff, reference: string, input: ClassifyInput): CaseAnswer<{ targetOn: string }> {
  const found = actOn(key, staff, reference, "classify", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (SETTLED.includes(row.state)) return notPermitted(no, row);
  const fields: Record<string, string> = {};
  const caseType = CASE_TYPES.find((type) => type === input.caseType) ?? null;
  if (caseType === null) fields.caseType = "FIELD_MISSING";
  const subjectKind = SUBJECT_KINDS.find((kind) => kind === input.subjectKind) ?? null;
  if (subjectKind === null) fields.subjectKind = "FIELD_MISSING";
  const day = today();
  const { from, to, unreadable } = input.period;
  if (unreadable || (from !== null && to !== null && to < from) || (to !== null && to > day)) fields.period = "PERIOD_INVALID";
  const admitted = caseType !== null ? (CASE_TYPE_REMEDIES[caseType] ?? []) : [];
  const remedy = admitted.find((kind) => kind === input.remedy) ?? null;
  if (input.remedy === "") fields.remedy = "FIELD_MISSING";
  else if (caseType !== null && remedy === null) fields.remedy = "REMEDY_KIND_UNKNOWN";
  const owner = caseOfficers().find((officer) => officer.email === input.owner) ?? null;
  if (owner === null) fields.owner = "FIELD_MISSING";
  const severity = SEVERITIES.find((value) => value === input.severity) ?? null;
  if (severity === null) fields.severity = "FIELD_MISSING";
  const impact = IMPACTS.find((value) => value === input.impact) ?? null;
  if (impact === null) fields.impact = "FIELD_MISSING";
  if (caseType === null || subjectKind === null || remedy === null || owner === null || severity === null || impact === null || fields.period !== undefined) {
    const codes = Object.values(fields);
    return no(codes.find((code) => code !== "FIELD_MISSING") ?? "FIELD_MISSING", fields, { list: admitted.join(", ") });
  }
  // DR-47 row 1: the objective version effective at the case date, or no target at all.
  const caseDay = dayOf(row.submittedAt);
  if (caseDay < SERVICE_OBJECTIVES.effectiveFrom) return no("OBJECTIVES_NOT_CONFIGURED");
  // DR-47 row 2: a blank is never read as a no.
  const vulnerability = VULNERABILITIES.find((value) => value === input.vulnerability) ?? null;
  if (vulnerability === null) return no("VULNERABILITY_NOT_RECORDED", { vulnerability: "VULNERABILITY_NOT_RECORDED" });

  let band = SERVICE_OBJECTIVES.bandOf[severity];
  if (impact === "major") band = Math.max(1, band - 1);
  // ALG-21 step 3: a recorded vulnerability raises the band one step, and never lowers it.
  const raised = vulnerability === "yes" && band > 1;
  if (raised) band -= 1;
  let targetOn = addWorkingDays(caseDay, SERVICE_OBJECTIVES.workingDays[band] ?? 0);
  const limit = statutoryLimitOf(cases, caseType, caseDay);
  const limitOn = limit !== null ? addDays(`${caseDay}T12:00:00+07:00`, limit.days) : null;
  let reason: Derivation["reason"] = raised ? "VULNERABILITY_RAISED" : "DERIVED_FROM_OBJECTIVES";
  // ALG-21 step 5: the statutory limit caps the date and never shortens it.
  if (limitOn !== null && targetOn > limitOn) {
    targetOn = limitOn;
    reason = "STATUTORY_LIMIT_APPLIES";
  }
  cases.slaTargets.push({
    caseId: row.id,
    targetOn,
    priority: band,
    severity,
    impact,
    vulnerability,
    objectiveVersion: SERVICE_OBJECTIVES.version,
    statutoryLimit: limitOn !== null && limit !== null ? { on: limitOn, instrument: limit.instrument } : null,
    reason,
    inForceFrom: now(),
  });
  row.caseType = caseType;
  row.subjectKind = subjectKind;
  row.subjectRef = input.subjectRef.trim() !== "" ? input.subjectRef.trim() : null;
  row.affectedPeriodFrom = from;
  row.affectedPeriodTo = to;
  row.requestedRemedyKind = remedy;
  row.ownerActorId = owner.email;
  row.severity = severity;
  row.businessImpact = impact;
  row.raiserVulnerability = vulnerability;
  if (row.state === "RECEIVED") transition(cases, row, "TRIAGED", reason);
  if (row.state !== "AWAITING_EVIDENCE") row.nextStepBy = targetOn;
  return done({ targetOn });
}

/**
 * POST /cases/{id}/progress: the two transitions that record a judgement and nothing else - investigation starts
 * (SM-05 transition 5, after transition 2 where the case still rests TRIAGED) and the facts are sufficient (11).
 * Anything else is TRANSITION_NOT_PERMITTED, naming where the case can go.
 */
export function progressCase(key: string, staff: Staff, reference: string, to: string): CaseAnswer<{ state: CaseState }> {
  const found = actOn(key, staff, reference, "progress", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (to === "investigating" && (row.state === "TRIAGED" || row.state === "ASSIGNED")) {
    assign(cases, row);
    transition(cases, row, "INVESTIGATING");
  } else if (to === "decision_pending" && row.state === "INVESTIGATING") transition(cases, row, "DECISION_PENDING");
  else return notPermitted(no, row);
  return done({ state: row.state });
}

/** The closures each state admits (SM-05 transitions 4 and 9), named when another is asked for. */
const DISPOSITIONS_FROM: Partial<Record<CaseState, readonly Disposition[]>> = { TRIAGED: ["inadmissible"], AWAITING_EVIDENCE: ["incomplete"] };

/**
 * POST /cases/{id}/refer (SM-05 transition 3): a triaged case whose matter belongs to another process, named with the
 * reason. The referral is terminal here and is not a closure; the raiser is told which process has it. A decided case
 * is CASE_ALREADY_DECIDED; a case in any other state than TRIAGED cannot be referred from where it is.
 */
export function referCase(key: string, staff: Staff, reference: string, input: { process: string; reason: string }): CaseAnswer<{ state: CaseState }> {
  const found = actOn(key, staff, reference, "refer", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (DECIDED.includes(row.state)) return no("CASE_ALREADY_DECIDED");
  if (row.state !== "TRIAGED") return notPermitted(no, row);
  const fields: Record<string, string> = {};
  const process = input.process.trim().slice(0, ITEM_LIMIT);
  if (process === "") fields.process = "FIELD_MISSING";
  const reason = input.reason.trim().slice(0, ITEM_LIMIT);
  if (reason === "") fields.reason = "FIELD_MISSING";
  if (Object.keys(fields).length > 0) return no("FIELD_MISSING", fields);
  const at = now();
  row.referral = { process, reason, at };
  transition(cases, row, "REFERRED", reason);
  row.nextStepBy = null;
  notify(key, cases, row, "case_status_changed", changeRef(cases, row), { state: row.state, process, reason, by: dayOf(at) });
  return done({ state: row.state });
}

export interface CloseInput {
  disposition: string;
  reason: string;
  route: string;
  unestablished: string;
  approver: string;
}

/**
 * POST /cases/{id}/close: as inadmissible from TRIAGED (transition 4), with the reason and the route the matter should
 * take instead, or as incomplete from AWAITING_EVIDENCE (transition 9), approved by a second case officer who is not
 * the case owner (SEG_SAME_ACTOR) and naming what could not be established. Any other disposition, or one the state
 * does not admit, is DISPOSITION_NOT_PERMITTED_FROM_STATE naming the state and the dispositions it does admit
 * (AC-FR-CAS-003-10). Every request still open ends NOT_SUPPLIED with the closure as its ground, and the raiser is told
 * the reopening grounds and the last day of the window, because neither closure is an ending (BR-CAS-09).
 */
export function closeCase(key: string, staff: Staff, reference: string, input: CloseInput): CaseAnswer<{ state: CaseState }> {
  const found = actOn(key, staff, reference, "close", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  const permitted = DISPOSITIONS_FROM[row.state] ?? [];
  const disposition = DISPOSITIONS.find((value) => value === input.disposition && permitted.includes(value)) ?? null;
  if (disposition === null) return no("DISPOSITION_NOT_PERMITTED_FROM_STATE", {}, { state: row.state, permitted: permitted.join(", ") });
  const fields: Record<string, string> = {};
  const reason = input.reason.trim().slice(0, ITEM_LIMIT);
  if (reason === "") fields.reason = "FIELD_MISSING";
  const route = input.route.trim().slice(0, ITEM_LIMIT);
  if (disposition === "inadmissible" && route === "") fields.route = "FIELD_MISSING";
  const approver = disposition === "incomplete" ? (caseOfficers().find((officer) => officer.email === input.approver) ?? null) : null;
  if (disposition === "incomplete" && approver === null) fields.approver = "FIELD_MISSING";
  if (Object.keys(fields).length > 0) return no("FIELD_MISSING", fields);
  // A second case officer: neither the owner, whose target is running, nor the officer closing it.
  if (approver !== null && (approver.email === row.ownerActorId || approver.email === staff.email)) return no("SEG_SAME_ACTOR", { approver: "SEG_SAME_ACTOR" });
  const open = openRequests(cases, row);
  const typed = input.unestablished.trim().slice(0, ITEM_LIMIT);
  const unestablished = disposition === "incomplete" ? (typed !== "" ? typed : open.map((request) => request.requestedItem).join("; ") || null) : null;
  for (const request of open) request.state = "NOT_SUPPLIED";
  const at = now();
  row.closure = { disposition, reason, route: disposition === "inadmissible" ? route : null, unestablished, approver, at };
  transition(cases, row, disposition === "inadmissible" ? "CLOSED_INADMISSIBLE" : "CLOSED_INCOMPLETE", reason);
  row.nextStepBy = null;
  const grounds = entriesOn(cases, "reopen_ground", dayOf(at)).map((entry) => entry.code);
  notify(key, cases, row, "case_status_changed", changeRef(cases, row), {
    state: row.state,
    reason,
    ...(row.closure.route !== null ? { route: row.closure.route } : {}),
    ...(unestablished !== null ? { unestablished } : {}),
    grounds: grounds.join(", "),
    by: windowEndOf(cases, row) ?? dayOf(at),
  });
  return done({ state: row.state });
}

/** POST /cases/{id}/links: one row, readable from both cases; the kind from the four, the other case by its reference. */
export function linkCase(key: string, staff: Staff, reference: string, input: { to: string; kind: string }): CaseAnswer<{ linked: string }> {
  const found = actOn(key, staff, reference, "link", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (REOPENABLE.includes(row.state) || row.state === "WITHDRAWN" || row.state === "REFERRED") return notPermitted(no, row);
  const fields: Record<string, string> = {};
  const kind = LINK_KINDS.find((value) => value === input.kind) ?? null;
  if (kind === null) fields.kind = input.kind === "" ? "FIELD_MISSING" : "LINK_KIND_UNKNOWN";
  const typed = input.to.trim().toUpperCase();
  const other = typed !== "" ? findCase(cases, typed) : undefined;
  if (typed === "") fields.to = "FIELD_MISSING";
  else if (other === undefined || other.id === row.id) fields.to = "CASE_NOT_FOUND";
  if (kind === null || other === undefined || other.id === row.id) {
    const codes = Object.values(fields);
    return no(codes.find((code) => code !== "FIELD_MISSING") ?? "FIELD_MISSING", fields, { reference: typed });
  }
  if (other.protectedMatter !== row.protectedMatter) return no("PROTECTED_MATTER_NO_ACCESS");
  cases.caseLinks.push({ fromCaseId: row.id, toCaseId: other.id, linkKind: kind, at: now() });
  return done({ linked: other.reference });
}

/** POST /cases/{id}/parties: a party from the register, in one of the four roles. */
export function addParty(key: string, staff: Staff, reference: string, input: { party: string; role: string }): CaseAnswer<{ party: string }> {
  const found = actOn(key, staff, reference, "party", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  const fields: Record<string, string> = {};
  const party = ORGANISATIONS.find((organisation) => organisation.id === input.party) ?? null;
  if (party === null) fields.party = "FIELD_MISSING";
  const role = PARTY_ROLES.find((value) => value === input.role) ?? null;
  if (role === null) fields.role = input.role === "" ? "FIELD_MISSING" : "PARTY_ROLE_UNKNOWN";
  if (party === null || role === null) return no(fields.role === "PARTY_ROLE_UNKNOWN" ? "PARTY_ROLE_UNKNOWN" : "FIELD_MISSING", fields);
  if (!cases.caseParties.some((entry) => entry.caseId === row.id && entry.partyId === party.id && entry.partyRole === role)) {
    cases.caseParties.push({ caseId: row.id, partyId: party.id, partyRole: role });
  }
  return done({ party: party.id });
}

/** The states a request for evidence may be sent in: from TRIAGED it assigns the case first (transitions 2 and 6). */
const REQUESTABLE: readonly CaseState[] = ["TRIAGED", "ASSIGNED", "INVESTIGATING", "AWAITING_EVIDENCE"];

/**
 * POST /cases/{id}/evidence-requests (SM-40, SM-05 transition 6): an item, an addressee, a deadline inside the CFG-49
 * period for the case type and a disclosure status chosen before it is sent. The request is ISSUED, the case waits
 * on it, and the party it addresses is told (NTF-CAS-02) with the item and the date.
 */
export function requestEvidence(
  key: string,
  staff: Staff,
  reference: string,
  input: { item: string; addressee: string; deadline: string | null; deadlineUnreadable: boolean; disclosure: string },
): CaseAnswer<{ request: string }> {
  const found = actOn(key, staff, reference, "request evidence", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (!REQUESTABLE.includes(row.state)) return notPermitted(no, row);
  const day = today();
  const period = periodOn(cases, "evidence_response", row.caseType, day);
  const latest = period !== null && period.unit === "working_days" ? addWorkingDays(day, period.amount) : null;
  const fields: Record<string, string> = {};
  const item = input.item.trim().slice(0, ITEM_LIMIT);
  if (item === "") fields.item = "FIELD_MISSING";
  const addressee = addresseesOf(cases, row).find((entry) => entry.value === input.addressee) ?? null;
  if (addressee === null) fields.addressee = "FIELD_MISSING";
  const deadline = input.deadlineUnreadable ? null : input.deadline;
  if (deadline === null) fields.deadline = "FIELD_MISSING";
  else if (latest === null || deadline < day || deadline > latest) fields.deadline = "DEADLINE_BEYOND_POLICY";
  const disclosure = DISCLOSURES.find((value) => value === input.disclosure) ?? null;
  if (disclosure === null) fields.disclosure = "DISCLOSURE_STATUS_REQUIRED";
  if (item === "" || addressee === null || deadline === null || disclosure === null || fields.deadline !== undefined) {
    const codes = Object.values(fields);
    return no(codes.find((code) => code !== "FIELD_MISSING") ?? "FIELD_MISSING", fields, { period: String(period?.amount ?? ""), latest: latest ?? "" });
  }
  const party = addressee.value.startsWith("party:") ? addressee.value.slice("party:".length) : null;
  const request: EvidenceRequestRow = {
    id: newReference("EVR"),
    caseId: row.id,
    requestedItem: item,
    responsiblePartyId: party,
    responsibleContact: party === null ? row.raiserContact : null,
    deadline,
    disclosureStatus: disclosure,
    state: "ISSUED",
    receiptOutcome: null,
    issuedAt: now(),
    issuedBy: nameOf(staff),
    supplied: null,
    respondedAt: null,
    late: false,
    recordedBy: null,
    cancelled: null,
    overdueNoticed: false,
  };
  cases.evidenceRequests.push(request);
  assign(cases, row);
  if (row.state !== "AWAITING_EVIDENCE") transition(cases, row, "AWAITING_EVIDENCE", request.id);
  row.nextStepBy = openRequests(cases, row).map((open) => open.deadline).sort()[0] ?? deadline;
  // The party the request addresses is told: the raiser at the contact the case holds, another party through COM.
  if (party === null || party === row.raiserPartyId) notify(key, cases, row, "evidence_requested", request.id, { item, by: deadline });
  else notifyParty(key, cases, row, party, "evidence_requested", request.id, { item, by: deadline });
  return done({ request: request.id });
}

/** SM-40 from each state a request can be in now: where a cancellation is refused, what the request can still reach. */
const REQUEST_REACHABLE: Readonly<Record<EvidenceRequestState, readonly EvidenceRequestState[]>> = {
  ISSUED: ["RESPONDED", "OVERDUE", "CANCELLED", "NOT_SUPPLIED"],
  OVERDUE: ["RESPONDED", "NOT_SUPPLIED"],
  RESPONDED: [],
  NOT_SUPPLIED: [],
  CANCELLED: [],
};

/**
 * POST /evidence-requests/{id}/cancel: by the officer who issued it or the case owner, with a reason, while nothing
 * has been supplied against it; the party is told (SM-40 transition 5). SM-40 cancels an ISSUED request only: one
 * past its deadline waits for a late answer or for the case to be decided without it (transitions 3 and 4), so the
 * contract names no refusal for it and the family's state-conflict code answers, TRANSITION_NOT_PERMITTED, naming the
 * request's state and where it can go from there. Once no request is open, the case returns to investigation.
 */
export function cancelEvidenceRequest(key: string, staff: Staff, reference: string, requestId: string, reason: string): CaseAnswer<{ cancelled: string }> {
  const found = actOn(key, staff, reference, "cancel request", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  const request = cases.evidenceRequests.find((entry) => entry.id === requestId && entry.caseId === row.id);
  if (request === undefined) return no("CASE_NOT_FOUND", {}, { reference });
  if (!mayCancel(row, request, staff)) return no("ROLE_NOT_ASSIGNED");
  if (request.state === "CANCELLED") return no("REQUEST_CANCELLED", {}, { date: request.cancelled?.on ?? "" });
  if (request.state === "RESPONDED") return no("RECEIPT_ALREADY_RECORDED", {}, { item: request.supplied ?? "", date: request.respondedAt ?? "" });
  if (request.state !== "ISSUED") return no("TRANSITION_NOT_PERMITTED", {}, { state: request.state, permitted: REQUEST_REACHABLE[request.state].join(", ") });
  if (reason.trim() === "") return no("FIELD_MISSING", { reason: "FIELD_MISSING" });
  request.state = "CANCELLED";
  request.cancelled = { on: today(), reason: reason.trim() };
  const facts = { item: request.requestedItem, reason: request.cancelled.reason, by: today() };
  if (request.responsiblePartyId === null || request.responsiblePartyId === row.raiserPartyId) notify(key, cases, row, "evidence_request_cancelled", request.id, facts);
  else notifyParty(key, cases, row, request.responsiblePartyId, "evidence_request_cancelled", request.id, facts);
  if (row.state === "AWAITING_EVIDENCE" && openRequests(cases, row).length === 0) {
    transition(cases, row, "INVESTIGATING", "REQUEST_CANCELLED");
    row.nextStepBy = currentTarget(cases, row)?.targetOn ?? null;
  }
  return done({ cancelled: request.id });
}

/**
 * POST /evidence-requests/{id}/responses by a case officer, for an answer that arrived another way - by post, at the
 * counter, by telephone (SCR-CAS-06): the same checks and the same record as the party's own answer, the officer
 * named as who recorded it. Recording nothing that says what arrived is RECEIPT_OUTCOME_REQUIRED, and recording
 * against a withdrawn request is REQUEST_CANCELLED, each attempt recorded (AC-FR-CAS-006-07, 006-08).
 */
export function recordEvidenceResponse(
  key: string,
  staff: Staff,
  reference: string,
  requestId: string,
  input: { outcome: string; supplied: string },
): CaseAnswer<{ outcome: ReceiptOutcome }> {
  const found = actOn(key, staff, reference, "record response", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  const request = cases.evidenceRequests.find((entry) => entry.id === requestId && entry.caseId === row.id);
  if (request === undefined) return no("CASE_NOT_FOUND", {}, { reference });
  const answer = responseOf(no, request, input);
  if ("refusal" in answer) return answer.refusal;
  if ("recorded" in answer) return done({ outcome: answer.recorded });
  recordResponse(cases, row, request, answer.outcome, answer.supplied, staff.account);
  return done({ outcome: answer.outcome });
}

/**
 * POST /cases/{id}/evidence by a case officer (SCR-CAS-06): an item held against the case with the status it
 * carries, and who supplied it - a party on the case, the raiser at their contact, or the case team itself. The
 * status is stated first (DISCLOSURE_STATUS_REQUIRED), then the item (FIELD_MISSING); the item and an audit row are
 * written together.
 */
export function addEvidence(key: string, staff: Staff, reference: string, input: { itemRef: string; disclosure: string; suppliedBy: string }): CaseAnswer<{ item: string }> {
  const found = actOn(key, staff, reference, "evidence", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  const held = evidenceOf(no, input);
  if ("refusal" in held) return held.refusal;
  const supplier = addresseesOf(cases, row).find((entry) => entry.value === input.suppliedBy) ?? null;
  const party = supplier?.value.startsWith("party:") === true ? supplier.value.slice("party:".length) : null;
  cases.caseEvidence.push({
    caseId: row.id,
    itemRef: held.item,
    suppliedByPartyId: party,
    suppliedBy: supplier?.label ?? staff.account,
    disclosureStatus: held.disclosure,
    receivedAt: now(),
    via: "added",
  });
  audit(cases, staff.email, "evidence", reference, "EVIDENCE_HELD");
  return done({ item: held.item });
}

const DECISION_ELEMENTS = ["facts", "authority", "reasoning", "remedy", "effective", "appealRoute", "ground"] as const;

/** Save draft on SCR-CAS-07: the values as typed, kept against the case, and the time they were saved. */
export function saveDecisionDraft(key: string, staff: Staff, reference: string, values: DecisionValues): CaseAnswer<{ savedAt: string }> {
  const found = actOn(key, staff, reference, "draft decision", "ACT-CAS", "ACT-BIZ-APR");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (DECIDED.includes(row.state)) return notPermitted(no, row);
  const savedAt = now();
  cases.decisionDrafts.set(row.id, { caseId: row.id, values, savedAt, by: staff.account });
  return done({ savedAt });
}

/**
 * POST /cases/{id}/decisions (FR-CAS-007, SM-05 transition 12): on a case whose facts are sufficient, by someone
 * other than the officer who owns and investigated it (PERM-86), with every element present - DECISION_INCOMPLETE
 * names the first one missing - and an effective date on or after today. The decision is issued to the raiser with
 * its appeal deadline (NTF-CAS-03), a request still open is closed as not supplied (SM-40 transitions 4 and 6), and
 * ALG-24 then moves the case: a remedy with nothing to link closes it, one with artefacts to link waits for them.
 */
export function recordDecision(key: string, staff: Staff, reference: string, values: DecisionValues, effective: string | null): CaseAnswer<{ appealDeadline: string | null }> {
  const found = actOn(key, staff, reference, "decide", "ACT-CAS", "ACT-BIZ-APR");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (row.state !== "DECISION_PENDING") return notPermitted(no, row);
  if (row.ownerActorId === staff.email) return no("SEG_SAME_ACTOR");
  const day = today();
  const missing: Record<string, string> = {};
  for (const element of DECISION_ELEMENTS) if ((element === "effective" ? (effective ?? "") : values[element]).trim() === "") missing[element] = "DECISION_INCOMPLETE";
  const remedies = row.caseType !== null ? (CASE_TYPE_REMEDIES[row.caseType] ?? []) : [];
  const remedy = remedies.find((kind) => kind === values.remedy) ?? null;
  if (values.remedy !== "" && remedy === null) missing.remedy = "REMEDY_KIND_UNKNOWN";
  if (effective !== null && effective < day) missing.effective = "DECISION_INCOMPLETE";
  const ground = GOVERNING_GROUNDS.find((entry) => entry === values.ground) ?? null;
  if (values.ground !== "" && ground === null) missing.ground = "DECISION_INCOMPLETE";
  const first = DECISION_ELEMENTS.find((element) => missing[element] !== undefined);
  if (first !== undefined || remedy === null || ground === null || effective === null) {
    return no(first !== undefined ? (missing[first] ?? "DECISION_INCOMPLETE") : "DECISION_INCOMPLETE", missing, { element: first ?? "remedy", list: remedies.join(", ") });
  }
  const maker = nameOf(staff);
  const decision: DecisionRow = {
    id: newReference("DEC"),
    caseId: row.id,
    facts: values.facts.trim(),
    authorityRef: values.authority.trim(),
    reasoning: values.reasoning.trim(),
    remedyKind: remedy,
    effectiveDate: effective,
    maker,
    approver: maker,
    appealRoute: values.appealRoute.trim(),
    appealDeadline: appealDeadlineFrom(cases, row, day),
    governingGround: ground,
    issuedAt: now(),
  };
  cases.decisions.push(decision);
  cases.decisionDrafts.delete(row.id);
  for (const request of openRequests(cases, row)) request.state = "NOT_SUPPLIED";
  transition(cases, row, "DECIDED");
  row.nextStepBy = null;
  notify(key, cases, row, "case_decided", decision.id, { by: decision.appealDeadline ?? decision.effectiveDate });
  evaluateLinkage(cases, row);
  return done({ appealDeadline: decision.appealDeadline });
}

/**
 * POST /decisions/{id}/remedy-links (DR-51, ALG-24): the reference is looked for in the module that holds that kind of
 * artefact, through that module's own read - ARTEFACT_NOT_FOUND when it holds none - and its
 * back-reference is read there, never taken from the caller. The answer for the remedy as a whole comes back with
 * the link, and moves the case: incomplete keeps it in REMEDY_IN_PROGRESS, complete closes it.
 */
export function linkRemedyArtefact(key: string, staff: Staff, reference: string, input: { kind: string; artefact: string }): CaseAnswer<RemedyPage["linkage"]> {
  const found = actOn(key, staff, reference, "link remedy", "ACT-CAS", "ACT-FIN-OP");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  const inForce = remedyInForce(cases, row);
  if (inForce === null) return no("DECISION_NOT_FOUND");
  if (row.state !== "DECIDED" && row.state !== "REMEDY_IN_PROGRESS") return notPermitted(no, row);
  const kind = requiredFor(cases, inForce.remedy).find((required) => required === input.kind) ?? null;
  if (kind === null) return no("REMEDY_LINKAGE_INCOMPLETE", {}, { kind: input.kind });
  if (FINANCIAL.includes(kind) ? !holds(staff, "ACT-FIN-OP") : !holds(staff, "ACT-CAS", "ACT-FIN-OP")) return no("ROLE_NOT_ASSIGNED");
  const ref = input.artefact.trim();
  if (ref === "") return no("FIELD_MISSING", { [kind]: "FIELD_MISSING" });
  const artefact = readArtefact(key, staff, kind, ref, row.reference);
  if (artefact === null) return no("ARTEFACT_NOT_FOUND", { [kind]: "ARTEFACT_NOT_FOUND" }, { reference: ref });
  const at = now();
  cases.remedyLinks.push({
    decisionId: inForce.decision.id,
    appealId: inForce.appeal?.id ?? null,
    artefactKind: kind,
    artefactRef: ref,
    backReferencePresent: artefact.namesCase,
    linkedAt: at,
    linkedBy: staff.account,
    checkedAt: at,
  });
  return done(evaluateLinkage(cases, row));
}

/** Re-check linkage: every back-reference read again in its module, then ALG-24. */
export function recheckLinkage(key: string, staff: Staff, reference: string): CaseAnswer<RemedyPage["linkage"]> {
  const found = actOn(key, staff, reference, "recheck linkage", "ACT-CAS", "ACT-FIN-OP");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  const inForce = remedyInForce(cases, row);
  if (inForce === null) return no("DECISION_NOT_FOUND");
  const links = linksInForce(cases, inForce);
  if (links.size === 0) return no("REMEDY_LINKAGE_INCOMPLETE", {}, { kind: requiredFor(cases, inForce.remedy).join(", ") });
  const at = now();
  for (const link of links.values()) {
    link.backReferencePresent = readArtefact(key, staff, link.artefactKind, link.artefactRef, row.reference)?.namesCase ?? false;
    link.checkedAt = at;
  }
  return done(evaluateLinkage(cases, row));
}

export interface OutcomeInput {
  outcome: string;
  facts: string;
  authority: string;
  reasoning: string;
  remedy: string;
  effective: string | null;
  furtherRoute: string;
  ground: string;
}

const OUTCOME_ELEMENTS = ["outcome", "facts", "authority", "reasoning", "furtherRoute", "ground"] as const;

/**
 * POST /appeals/{id}/outcome (FR-CAS-013, 015, SM-31 transition 2): only a dispute authority whom ALG-23 finds
 * neither the maker nor the approver of the decision under appeal - anyone else is APPEAL_DECIDER_CONFLICT, and the
 * attempt is recorded - stating every element the decision stated (OUTCOME_INCOMPLETE). The outcome records whether
 * it was decided in time (AC-FR-CAS-014-03) and is issued to the party that appealed (NTF-CAS-04). An outcome that
 * sets a remedy re-enters ALG-24 through SM-05 transition 18. A lapsed appeal is APPEAL_LAPSED: escalated, never
 * decided by the clock.
 */
export function recordAppealOutcome(key: string, staff: Staff, appealRef: string, input: OutcomeInput): CaseAnswer<{ state: AppealState }> {
  const cases = casesTable(key);
  sweepLapsed(key, cases);
  const no = refuser(cases, staff.email, "appeal outcome", appealRef);
  if (!holds(staff, "ACT-DSP", "ACT-CAS")) return no("ROLE_NOT_ASSIGNED");
  const appeal = cases.appeals.find((entry) => entry.id === appealRef);
  const decision = appeal !== undefined ? cases.decisions.find((entry) => entry.id === appeal.decisionId) : undefined;
  const row = appeal !== undefined ? caseById(cases, appeal.caseId) : undefined;
  if (appeal === undefined || decision === undefined || row === undefined) return no("APPEAL_NOT_FOUND");
  // ALG-23 is asked before the role, so the person who decided is refused for who they are, whatever they hold.
  const act = disqualifyingAct(decision, staff.email);
  if (act !== null) {
    cases.appealStateHistory.push({ subjectId: appeal.id, fromState: appeal.state, toState: "REFUSED_ATTEMPT", actor: staff.email, occurredAt: now() });
    return no("APPEAL_DECIDER_CONFLICT", {}, { act, date: dayOf(decision.issuedAt) });
  }
  if (!holds(staff, "ACT-DSP")) return no("ROLE_NOT_ASSIGNED");
  if (appeal.state === "APPEAL_LAPSED") return no("APPEAL_LAPSED");
  if (appeal.state === "APPEAL_DECIDED") return done({ state: appeal.state });
  const missing: Record<string, string> = {};
  const outcome = APPEAL_OUTCOMES.find((value) => value === input.outcome) ?? null;
  for (const element of OUTCOME_ELEMENTS) if (input[element].trim() === "") missing[element] = "OUTCOME_INCOMPLETE";
  const remedies = row.caseType !== null ? (CASE_TYPE_REMEDIES[row.caseType] ?? []) : [];
  const remedy = input.remedy !== "" ? (remedies.find((kind) => kind === input.remedy) ?? null) : null;
  if (input.remedy !== "" && remedy === null) missing.remedy = "REMEDY_KIND_UNKNOWN";
  // A varied outcome is a new remedy, so it states its kind and when it takes effect, as the decision did.
  if (outcome === "varied" && input.remedy === "") missing.remedy = "OUTCOME_INCOMPLETE";
  if (remedy !== null && input.effective === null) missing.effective = "OUTCOME_INCOMPLETE";
  if (input.effective !== null && input.effective < today()) missing.effective = "OUTCOME_INCOMPLETE";
  const ground = GOVERNING_GROUNDS.find((entry) => entry === input.ground) ?? null;
  if (input.ground !== "" && ground === null) missing.ground = "OUTCOME_INCOMPLETE";
  const first = [...OUTCOME_ELEMENTS, "remedy", "effective"].find((element) => missing[element] !== undefined);
  if (first !== undefined || outcome === null || ground === null) {
    return no(first !== undefined ? (missing[first] ?? "OUTCOME_INCOMPLETE") : "OUTCOME_INCOMPLETE", missing, { element: first ?? "outcome", list: remedies.join(", ") });
  }
  const at = now();
  appeal.outcome = {
    outcome,
    facts: input.facts.trim(),
    authority: input.authority.trim(),
    reasoning: input.reasoning.trim(),
    remedy,
    effectiveDate: remedy !== null ? input.effective : null,
    furtherRoute: input.furtherRoute.trim(),
    decidedAt: at,
    inTime: appeal.dueAt !== null ? at <= appeal.dueAt : null,
  };
  appeal.outcomeGround = ground;
  appeal.decidedBy = nameOf(staff);
  cases.appealStateHistory.push({ subjectId: appeal.id, fromState: appeal.state, toState: "APPEAL_DECIDED", actor: staff.email, occurredAt: at });
  appeal.state = "APPEAL_DECIDED";
  notify(key, cases, row, "appeal_decided", appeal.id, { appeal: appeal.id, outcome, by: appeal.outcome.effectiveDate ?? dayOf(at) }, appeal.appellantContact);
  if (remedy !== null && (row.state === "DECIDED" || row.state === "CLOSED")) {
    transition(cases, row, "REMEDY_IN_PROGRESS", appeal.id);
    evaluateLinkage(cases, row);
  }
  return done({ state: appeal.state });
}

export interface ReopeningInput {
  groundKind: string;
  groundRef: string;
  evidenceOn: string | null;
  evidenceUnreadable: boolean;
  displaced: readonly string[];
  nothing: boolean;
}

/**
 * POST /cases/{id}/reopenings by a case officer (FR-CAS-016, 017, SM-31 transition 4 or 5). The raiser's own proposal
 * (`askReopening`) is answered the same way.
 */
export function proposeReopening(key: string, staff: Staff, reference: string, input: ReopeningInput): CaseAnswer<{ reopening: string }> {
  const found = actOn(key, staff, reference, "reopen", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  return propose(cases, no, row, nameOf(staff), "officer", input, supportLine(key));
}

/**
 * DR-49 in its order: the CFG-51 window, then a ground of the two the register admits with what it rests on, then
 * the displacement statement - empty is an answer only when it says so - naming only outcomes the decision carried,
 * then new evidence that post-dates the decision. A case closed without a decision (inadmissible, incomplete) is
 * reopened from its closure: it carried no outcome, so the statement can only be "nothing", and new evidence
 * post-dates the closure. The proposal waits for an authority other than the proposer.
 */
function propose(
  cases: CasesTable,
  no: Refuse,
  row: CaseRow,
  proposedBy: StaffName,
  proposer: "officer" | "raiser",
  input: ReopeningInput,
  number: string,
): CaseAnswer<{ reopening: string }> {
  if (!REOPENABLE.includes(row.state) || cases.reopenings.some((entry) => entry.caseId === row.id && entry.state === "REOPEN_PROPOSED")) return notPermitted(no, row);
  const closedWithout = row.state === "CLOSED_INADMISSIBLE" || row.state === "CLOSED_INCOMPLETE";
  const decision = closedWithout ? null : latestDecision(cases, row);
  if (decision === null && !closedWithout) return no("DECISION_NOT_FOUND");
  const day = today();
  const windowEnds = windowEndOf(cases, row);
  if (windowEnds === null || day > windowEnds) return no("REOPEN_WINDOW_CLOSED", {}, { date: windowEnds ?? "", number });
  const grounds = entriesOn(cases, "reopen_ground", day).map((entry) => entry.code);
  const groundKind = GROUND_KINDS.find((kind) => kind === input.groundKind && grounds.includes(kind)) ?? null;
  const fields: Record<string, string> = {};
  if (groundKind === null) fields.groundKind = "REOPEN_GROUND_ABSENT";
  if (input.groundRef.trim() === "") fields.groundRef = "REOPEN_GROUND_ABSENT";
  if (groundKind === "new_evidence" && (input.evidenceOn === null || input.evidenceUnreadable)) fields.evidenceOn = "REOPEN_GROUND_ABSENT";
  if (groundKind === null || Object.keys(fields).length > 0) return no("REOPEN_GROUND_ABSENT", fields);
  if (!input.nothing && input.displaced.length === 0) return no("DISPLACEMENT_NOT_STATED", { displaced: "DISPLACEMENT_NOT_STATED" });
  const outcomes = decision !== null ? outcomesOf(cases, decision) : [];
  const foreign = input.displaced.find((outcome) => !outcomes.some((carried) => carried === outcome));
  if (foreign !== undefined) return no("OUTCOME_NOT_ON_DECISION", { displaced: "OUTCOME_NOT_ON_DECISION" }, { kind: foreign });
  const since = decision !== null ? dayOf(decision.issuedAt) : (closedOn(cases, row) ?? day);
  if (groundKind === "new_evidence" && input.evidenceOn !== null && input.evidenceOn < since) {
    return no("EVIDENCE_NOT_NEW", { evidenceOn: "EVIDENCE_NOT_NEW" }, { date: input.evidenceOn });
  }
  const at = now();
  const proposal: ReopeningRow = {
    id: newReference("ROP"),
    caseId: row.id,
    decisionId: decision?.id ?? null,
    groundKind,
    groundRef: input.groundRef.trim().slice(0, ITEM_LIMIT),
    evidenceOn: groundKind === "new_evidence" ? input.evidenceOn : null,
    displaced: input.nothing ? [] : [...input.displaced],
    proposedBy,
    proposer,
    authorisedBy: null,
    state: "REOPEN_PROPOSED",
    recordedAt: at,
    decidedAt: null,
    refusedReason: null,
  };
  cases.reopenings.push(proposal);
  cases.reopeningStateHistory.push({ subjectId: proposal.id, fromState: null, toState: "REOPEN_PROPOSED", actor: proposedBy.email !== "" ? proposedBy.email : proposedBy.name, occurredAt: at });
  return done({ reopening: proposal.id });
}

/**
 * POST /reopenings/{id}/authorise (SM-31 transitions 6 and 7, SM-05 transition 17): a dispute authority who is not the
 * proposer - the proposer is REOPEN_AUTHORITY_CONFLICT, recorded - authorises it, and the case returns to
 * investigation with the earlier decision kept and what the reopening displaces; or refuses it, with the reason that
 * branch requires (FIELD_MISSING), and the earlier decision stands. A proposal decided already is
 * REOPEN_ALREADY_DECIDED, recorded (AC-FR-CAS-016-08).
 */
export function authoriseReopening(key: string, staff: Staff, reopeningRef: string, decision: "authorise" | "refuse" = "authorise", reason = ""): CaseAnswer<{ state: ReopeningState }> {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, decision, reopeningRef);
  const proposal = cases.reopenings.find((entry) => entry.id === reopeningRef);
  const row = proposal !== undefined ? caseById(cases, proposal.caseId) : undefined;
  if (proposal === undefined || row === undefined) return no("CASE_NOT_FOUND", {}, { reference: reopeningRef });
  if (proposal.proposedBy.email === staff.email) {
    cases.reopeningStateHistory.push({ subjectId: proposal.id, fromState: proposal.state, toState: "REFUSED_ATTEMPT", actor: staff.email, occurredAt: now() });
    return no("REOPEN_AUTHORITY_CONFLICT");
  }
  if (!holds(staff, "ACT-DSP")) return no("ROLE_NOT_ASSIGNED");
  if (proposal.state !== "REOPEN_PROPOSED") return no("REOPEN_ALREADY_DECIDED", {}, { date: proposal.decidedAt ?? "" });
  const at = now();
  if (decision === "refuse") {
    if (reason.trim() === "") return no("FIELD_MISSING", { reason: "FIELD_MISSING" });
    proposal.state = "REOPEN_REFUSED";
    proposal.decidedAt = at;
    proposal.refusedReason = reason.trim().slice(0, ITEM_LIMIT);
    cases.reopeningStateHistory.push({ subjectId: proposal.id, fromState: "REOPEN_PROPOSED", toState: "REOPEN_REFUSED", actor: staff.email, occurredAt: at });
    return done({ state: proposal.state });
  }
  if (!REOPENABLE.includes(row.state)) return notPermitted(no, row);
  proposal.state = "REOPENED";
  proposal.authorisedBy = nameOf(staff);
  proposal.decidedAt = at;
  cases.reopeningStateHistory.push({ subjectId: proposal.id, fromState: "REOPEN_PROPOSED", toState: "REOPENED", actor: staff.email, occurredAt: at });
  transition(cases, row, "INVESTIGATING", proposal.id);
  row.nextStepBy = null;
  // The case is open again: the raiser is told it moved, and on what it was reopened (a status-change notice).
  notify(key, cases, row, "case_status_changed", changeRef(cases, row), { state: row.state, reason: proposal.groundRef, by: dayOf(at) });
  return done({ state: proposal.state });
}

/** The categories a case may be classified into today: those with an approved policy in force (CFG-50). */
const approvedCategories = (cases: CasesTable, day: string) => PROTECTED_CATEGORIES.filter((category) => categoryPolicyOn(cases, category, day) !== null);

/**
 * POST /cases/{id}/protected-classification (FR-CAS-010, DR-50, ALG-25): a category with an approved policy in force -
 * any other, including one of the five whose policy nobody has approved, is CATEGORY_UNKNOWN naming the approved
 * ones - and the reason. The restriction attaches here, before anything else: the case is readable from this instant
 * only by the category's access list, less anyone the matter names, the officer who classified it included. The
 * routing is resolved once (the specialist process and the independent addressee, or the alternate where the first is
 * named, or none where both are, which EXC-CAS-03 records rather than refuses), the matter is ROUTED, and a case
 * being worked moves to SPECIALIST_ESCALATION (SM-05 transition 7).
 */
export function classifyProtected(key: string, staff: Staff, reference: string, input: { category: string; reason: string; subjects: readonly string[] }): CaseAnswer<{ matter: string }> {
  const found = actOn(key, staff, reference, "protect", "ACT-CAS");
  if ("refusal" in found) return found.refusal;
  const { cases, row, no } = found;
  if (row.protectedMatter || SETTLED.includes(row.state)) return notPermitted(no, row);
  const day = today();
  const approved = approvedCategories(cases, day);
  const category = approved.find((candidate) => candidate === input.category) ?? null;
  if (category === null) return no("CATEGORY_UNKNOWN", { category: "CATEGORY_UNKNOWN" }, { categories: approved.join(", ") });
  const reason = input.reason.trim().slice(0, ITEM_LIMIT);
  if (reason === "") return no("FIELD_MISSING", { reason: "FIELD_MISSING" });
  const policy = categoryPolicyOn(cases, category, day);
  if (policy === null) return no("CATEGORY_UNKNOWN", { category: "CATEGORY_UNKNOWN" }, { categories: approved.join(", ") });
  const subjects = staffAccounts()
    .map((person) => person.email)
    .filter((email) => input.subjects.includes(email));
  // DR-50 row 6: where the first addressee is named in the matter, the route resolves to the second.
  const addressee = [policy.primary, policy.alternate].find((person) => !subjects.includes(person.email)) ?? null;
  const at = now();
  const matter: ProtectedMatterRow = {
    id: newReference("PRM"),
    caseId: row.id,
    category,
    policyVersion: policy.versionNo,
    specialistProcess: policy.specialistProcess,
    escalationAddressee: addressee,
    escalationAddresseeState: addressee !== null ? "resolved" : "none_independent",
    subjects,
    state: "ROUTED",
    reason,
    classifiedAt: at,
    classifiedBy: nameOf(staff),
  };
  cases.protectedMatters.push(matter);
  row.protectedMatter = true;
  if (row.state === "ASSIGNED" || row.state === "INVESTIGATING") transition(cases, row, "SPECIALIST_ESCALATION", matter.id);
  audit(cases, staff.email, "protect", reference, "PROTECTED");
  return done({ matter: matter.id });
}

/** Which listed group has no route that works without an account (BR-CAS-01), or null when every one has. */
function groupWithoutAccountFreeRoute(routes: readonly MatrixRoute[]): string | null {
  const groups = [...new Set(routes.map((route) => route.group))];
  return groups.find((group) => !routes.some((route) => route.group === group && !route.requiresAccount)) ?? null;
}

/**
 * POST /intake-matrix-versions: the version prepared, with an effective date after the start of the version in force
 * and not in the past (EFFECTIVE_PERIOD_OVERLAP), and every route's group in the register (ROUTE_GROUP_UNKNOWN). A
 * version already prepared is written over while it is PREPARED; one approved meanwhile is VERSION_ALREADY_APPROVED.
 * The one who saves it is its preparer.
 */
export function saveIntakeVersion(
  key: string,
  staff: Staff,
  input: { versionId: string | null; effectiveFrom: string | null; effectiveUnreadable: boolean; routes: readonly { group: string; kind: string; requiresAccount: boolean | null }[] },
): CaseAnswer<{ version: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, "save matrix", input.versionId ?? "new");
  if (!holds(staff, "ACT-CAS")) return no("ROLE_NOT_ASSIGNED");
  const existing = input.versionId !== null ? cases.intakeMatrixVersions.find((version) => version.id === input.versionId) : undefined;
  if (existing?.state === "APPROVED") return no("VERSION_ALREADY_APPROVED");
  if (input.effectiveFrom === null || input.effectiveUnreadable) return no("FIELD_MISSING", { effectiveFrom: "FIELD_MISSING" });
  if (input.routes.length === 0) return no("FIELD_MISSING", { routes: "FIELD_MISSING" });
  const unknown = input.routes.find((route) => !STAKEHOLDER_GROUPS.some((group) => group === route.group));
  if (unknown !== undefined) return no("ROUTE_GROUP_UNKNOWN", { routes: "ROUTE_GROUP_UNKNOWN" }, { group: unknown.group });
  // Needs an account is yes or no: there is no third value and no default.
  const rows: MatrixRoute[] = input.routes.flatMap((route) => {
    const kind = ROUTE_KINDS.find((candidate) => candidate === route.kind);
    return kind !== undefined && route.requiresAccount !== null ? [{ group: route.group, kind, requiresAccount: route.requiresAccount }] : [];
  });
  if (rows.length !== input.routes.length) return no("FIELD_MISSING", { routes: "FIELD_MISSING" });
  const day = today();
  const inForce = effectiveVersion(cases, day);
  if (input.effectiveFrom < day || (inForce !== null && input.effectiveFrom <= inForce.effectiveFrom)) {
    return no("EFFECTIVE_PERIOD_OVERLAP", { effectiveFrom: "EFFECTIVE_PERIOD_OVERLAP" });
  }
  const next = Math.max(...cases.intakeMatrixVersions.map((entry) => entry.versionNo)) + 1;
  const version: IntakeMatrixVersion = existing ?? {
    id: `intake-matrix-${String(next)}`,
    versionNo: next,
    state: "PREPARED",
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    preparedBy: nameOf(staff),
    approvedBy: null,
    approvedAt: null,
  };
  if (existing === undefined) cases.intakeMatrixVersions.push(version);
  version.effectiveFrom = input.effectiveFrom;
  version.preparedBy = nameOf(staff);
  // One route per group and kind: a repeated row is the same route said twice.
  const unique = [...new Map(rows.map((route) => [`${route.group}-${route.kind}`, route])).values()];
  cases.intakeRoutes = [
    ...cases.intakeRoutes.filter((route) => route.intakeMatrixVersionId !== version.id),
    ...unique.map((route) => ({
      id: routeId(version.id, route.group, route.kind),
      intakeMatrixVersionId: version.id,
      group: route.group,
      kind: route.kind,
      requiresAccount: route.requiresAccount,
      caseTypes: CASE_TYPES,
    })),
  ];
  return done({ version: version.id });
}

/**
 * POST /intake-matrix-versions/{id}/approve (FR-CAS-018): by a business approver who did not prepare it
 * (SEG_SAME_ACTOR), on a version in which every listed group has a route that needs no account
 * (NO_ACCOUNT_FREE_ROUTE, against the routes themselves). The version governs cases from its effective date, and the
 * version it supersedes ends that day.
 */
export function approveIntakeVersion(key: string, staff: Staff, versionId: string): CaseAnswer<{ effectiveFrom: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, "approve matrix", versionId);
  if (!holds(staff, "ACT-BIZ-APR")) return no("ROLE_NOT_ASSIGNED");
  const version = cases.intakeMatrixVersions.find((entry) => entry.id === versionId);
  if (version === undefined) return no("FIELD_MISSING");
  if (version.state === "APPROVED") return no("VERSION_ALREADY_APPROVED");
  if (version.preparedBy.email === staff.email) return no("SEG_SAME_ACTOR");
  const without = matrixVersionView(cases, version).withoutAccountFree;
  if (without !== null) return no("NO_ACCOUNT_FREE_ROUTE", {}, { group: without });
  if (version.effectiveFrom < today()) return no("EFFECTIVE_PERIOD_OVERLAP");
  for (const other of cases.intakeMatrixVersions) {
    if (other.state === "APPROVED" && other.effectiveFrom < version.effectiveFrom && (other.effectiveTo === null || other.effectiveTo > version.effectiveFrom)) {
      other.effectiveTo = version.effectiveFrom;
    }
  }
  version.state = "APPROVED";
  version.approvedBy = nameOf(staff);
  version.approvedAt = now();
  return done({ effectiveFrom: version.effectiveFrom });
}

/** The registers whose entries are a code and a label (with the authority on a pause ground); the others are versioned. */
const ENTRY_REGISTERS = ["pause_ground", "reopen_ground"] as const;

/**
 * POST /registers/{register}/entries: a code in lower case with no spaces, unique in the register
 * (CODE_ALREADY_PRESENT), a label, the authority a pause ground requires, and the day it starts to govern. The entry
 * is prepared, and read by nobody until it is approved.
 */
export function addRegisterEntry(
  key: string,
  staff: Staff,
  register: string,
  input: { code: string; label: string; authority: string; effectiveFrom: string | null; effectiveUnreadable: boolean },
): CaseAnswer<{ entry: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, "add entry", register);
  if (!holds(staff, "ACT-CAS")) return no("ROLE_NOT_ASSIGNED");
  const target = ENTRY_REGISTERS.find((candidate) => candidate === register);
  if (target === undefined) return no("REGISTER_UNKNOWN");
  const fields: Record<string, string> = {};
  const code = input.code.trim();
  if (!/^[a-z][a-z0-9_]*$/.test(code)) fields.code = "FIELD_MISSING";
  else if (cases.registerEntries.some((entry) => entry.register === target && entry.code === code)) fields.code = "CODE_ALREADY_PRESENT";
  if (input.label.trim() === "") fields.label = "FIELD_MISSING";
  const authority = PAUSE_AUTHORITIES.find((role) => role === input.authority) ?? null;
  if (target === "pause_ground" && authority === null) fields.authority = "FIELD_MISSING";
  const effectiveFrom = input.effectiveUnreadable ? null : input.effectiveFrom;
  if (effectiveFrom === null) fields.effectiveFrom = "FIELD_MISSING";
  else if (effectiveFrom < today()) fields.effectiveFrom = "EFFECTIVE_PERIOD_OVERLAP";
  const codes = Object.values(fields);
  if (codes.length > 0 || effectiveFrom === null) return no(codes.find((value) => value !== "FIELD_MISSING") ?? "FIELD_MISSING", fields);
  const entry: RegisterEntryRow = {
    id: `${target}-${code}`,
    register: target,
    code,
    label: input.label.trim(),
    requiredAuthority: target === "pause_ground" ? authority : null,
    limit: null,
    requires: null,
    isActive: true,
    state: "PREPARED",
    effectiveFrom,
    preparedBy: nameOf(staff),
    approvedBy: null,
    approvedAt: null,
    refused: null,
  };
  cases.registerEntries.push(entry);
  return done({ entry: entry.id });
}

/**
 * POST /policy-periods: a period version for one case type, a whole number of days (or months for the reopening
 * window), from a date after the start of the version in force and not in the past (EFFECTIVE_PERIOD_OVERLAP). A
 * version already prepared for that type and kind is written over while it is PREPARED.
 */
export function preparePeriod(
  key: string,
  staff: Staff,
  kind: string,
  input: { caseType: string; amount: string; effectiveFrom: string | null; effectiveUnreadable: boolean },
): CaseAnswer<{ period: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, "prepare period", kind);
  if (!holds(staff, "ACT-CAS")) return no("ROLE_NOT_ASSIGNED");
  const periodKind = (["appeal_decision", "evidence_response", "reopen_window"] as const).find((candidate) => candidate === kind);
  if (periodKind === undefined) return no("REGISTER_UNKNOWN");
  const fields: Record<string, string> = {};
  const caseType = CASE_TYPES.find((type) => type === input.caseType) ?? null;
  if (caseType === null) fields.caseType = "FIELD_MISSING";
  const amount = /^\d+$/.test(input.amount.trim()) ? Number(input.amount.trim()) : 0;
  if (amount <= 0) fields.amount = "FIELD_MISSING";
  const day = today();
  const inForce = caseType !== null ? periodOn(cases, periodKind, caseType, day) : null;
  const effectiveFrom = input.effectiveUnreadable ? null : input.effectiveFrom;
  if (effectiveFrom === null) fields.effectiveFrom = "FIELD_MISSING";
  else if (effectiveFrom < day || (inForce !== null && effectiveFrom <= inForce.effectiveFrom)) fields.effectiveFrom = "EFFECTIVE_PERIOD_OVERLAP";
  const codes = Object.values(fields);
  if (codes.length > 0 || caseType === null || effectiveFrom === null) return no(codes.find((value) => value !== "FIELD_MISSING") ?? "FIELD_MISSING", fields);
  const prepared = cases.policyPeriods.find((period) => period.kind === periodKind && period.caseType === caseType && period.state === "PREPARED");
  const versionNo = Math.max(0, ...cases.policyPeriods.filter((period) => period.kind === periodKind && period.caseType === caseType).map((period) => period.versionNo)) + 1;
  const row: PolicyPeriodRow = prepared ?? {
    id: `${periodKind}-${caseType}-${String(versionNo)}`,
    kind: periodKind,
    caseType,
    versionNo,
    amount,
    unit: periodKind === "reopen_window" ? "months" : "working_days",
    state: "PREPARED",
    effectiveFrom,
    effectiveTo: null,
    preparedBy: nameOf(staff),
    approvedBy: null,
    approvedAt: null,
    refused: null,
  };
  if (prepared === undefined) cases.policyPeriods.push(row);
  row.amount = amount;
  row.effectiveFrom = effectiveFrom;
  row.preparedBy = nameOf(staff);
  row.refused = null;
  return done({ period: row.id });
}

export interface CategoryPolicyInput {
  category: string;
  specialistProcess: string;
  access: readonly string[];
  primary: string;
  alternate: string;
  effectiveFrom: string | null;
  effectiveUnreadable: boolean;
}

/**
 * POST /category-policies (CFG-50), by the security owner: one of the five categories (CATEGORY_UNKNOWN naming them),
 * the specialist process it routes to, the access list - named people, at least one - and two escalation addressees,
 * who must be two different people (ADDRESSEES_NOT_DISTINCT, beside the second), from a day after the start of the
 * version in force (EFFECTIVE_PERIOD_OVERLAP). The version governs nothing until it is approved; one already
 * prepared for the category is written over while it is PREPARED.
 */
export function prepareCategoryPolicy(key: string, staff: Staff, input: CategoryPolicyInput): CaseAnswer<{ policy: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, "prepare category policy", input.category);
  if (!holds(staff, "ACT-SEC")) return no("ROLE_NOT_ASSIGNED");
  const category = PROTECTED_CATEGORIES.find((candidate) => candidate === input.category) ?? null;
  if (category === null) return no("CATEGORY_UNKNOWN", {}, { categories: PROTECTED_CATEGORIES.join(", ") });
  const people = staffAccounts();
  const fields: Record<string, string> = {};
  const process = input.specialistProcess.trim().slice(0, ITEM_LIMIT);
  if (process === "") fields.specialistProcess = "FIELD_MISSING";
  const access = people.filter((person) => input.access.includes(person.email));
  if (access.length === 0) fields.access = "FIELD_MISSING";
  const primary = people.find((person) => person.email === input.primary) ?? null;
  if (primary === null) fields.primary = "FIELD_MISSING";
  const alternate = people.find((person) => person.email === input.alternate) ?? null;
  if (alternate === null) fields.alternate = "FIELD_MISSING";
  else if (primary !== null && alternate.email === primary.email) fields.alternate = "ADDRESSEES_NOT_DISTINCT";
  const day = today();
  const inForce = categoryPolicyOn(cases, category, day);
  const effectiveFrom = input.effectiveUnreadable ? null : input.effectiveFrom;
  if (effectiveFrom === null) fields.effectiveFrom = "FIELD_MISSING";
  else if (effectiveFrom < day || (inForce !== null && effectiveFrom <= inForce.effectiveFrom)) fields.effectiveFrom = "EFFECTIVE_PERIOD_OVERLAP";
  const codes = Object.values(fields);
  if (codes.length > 0 || primary === null || alternate === null || effectiveFrom === null) return no(codes.find((value) => value !== "FIELD_MISSING") ?? "FIELD_MISSING", fields);
  const prepared = cases.categoryPolicies.find((policy) => policy.category === category && policy.state === "PREPARED");
  const versionNo = Math.max(0, ...cases.categoryPolicies.filter((policy) => policy.category === category).map((policy) => policy.versionNo)) + 1;
  const policy: CategoryPolicyRow = prepared ?? {
    id: `category-${category}-${String(versionNo)}`,
    category,
    versionNo,
    specialistProcess: process,
    access,
    primary,
    alternate,
    state: "PREPARED",
    effectiveFrom,
    effectiveTo: null,
    preparedBy: nameOf(staff),
    approvedBy: null,
    approvedAt: null,
    refused: null,
  };
  if (prepared === undefined) cases.categoryPolicies.push(policy);
  Object.assign(policy, { specialistProcess: process, access, primary, alternate, effectiveFrom, preparedBy: nameOf(staff), refused: null });
  audit(cases, staff.email, "prepare category policy", policy.id, "PREPARED");
  return done({ policy: policy.id });
}

/**
 * Approve and publish (the approver's act on a register entry, a period version or a category policy,
 * POST /policy-periods/{id}/approve and its siblings): by someone who did not prepare it (SEG_SAME_ACTOR) - a business
 * approver, or for a category policy the data-protection officer as well (see the head of this module). An entry
 * governs from its effective date; a period version or a category policy does too, and the version it supersedes ends
 * that day, so two never govern the same day. `refuse` leaves the item PREPARED with the reason the approver gives
 * (FIELD_MISSING without one), for its preparer to read. An appeal-period version that would reach back over an
 * appeal lodged while no period was approved is PERIOD_VERSION_NOT_APPROVED, naming the appeal (`appealReachedBy`).
 */
export function approvePolicyItem(key: string, staff: Staff, id: string, decision: "approve" | "refuse" = "approve", reason = ""): CaseAnswer<{ effectiveFrom: string }> {
  const cases = casesTable(key);
  const no = refuser(cases, staff.email, decision, id);
  const entry = cases.registerEntries.find((candidate) => candidate.id === id);
  const period = cases.policyPeriods.find((candidate) => candidate.id === id);
  const policy = cases.categoryPolicies.find((candidate) => candidate.id === id);
  const approvers: readonly StaffRole[] = policy !== undefined ? ["ACT-DPO", "ACT-BIZ-APR"] : ["ACT-BIZ-APR"];
  if (!holds(staff, ...approvers)) return no("ROLE_NOT_ASSIGNED");
  const item = entry ?? period ?? policy;
  if (item === undefined) return no("REGISTER_UNKNOWN");
  if (item.state === "APPROVED") return no("VERSION_ALREADY_APPROVED");
  if (item.preparedBy.email === staff.email) return no("SEG_SAME_ACTOR");
  if (decision === "refuse") {
    if (reason.trim() === "") return no("FIELD_MISSING", { reason: "FIELD_MISSING" });
    item.refused = { reason: reason.trim().slice(0, ITEM_LIMIT), by: nameOf(staff) };
    audit(cases, staff.email, decision, id, "REFUSED");
    return done({ effectiveFrom: item.effectiveFrom });
  }
  const reached = period !== undefined ? appealReachedBy(cases, period) : null;
  if (reached !== null) return no("PERIOD_VERSION_NOT_APPROVED", {}, { reference: reached.appeal, date: reached.issuedOn });
  if (period !== undefined) {
    for (const other of cases.policyPeriods) {
      if (other !== period && other.kind === period.kind && other.caseType === period.caseType && other.state === "APPROVED" && (other.effectiveTo === null || other.effectiveTo > period.effectiveFrom)) {
        other.effectiveTo = period.effectiveFrom;
      }
    }
  }
  if (policy !== undefined) {
    for (const other of cases.categoryPolicies) {
      if (other !== policy && other.category === policy.category && other.state === "APPROVED" && (other.effectiveTo === null || other.effectiveTo > policy.effectiveFrom)) {
        other.effectiveTo = policy.effectiveFrom;
      }
    }
  }
  item.state = "APPROVED";
  item.approvedBy = nameOf(staff);
  item.approvedAt = now();
  item.refused = null;
  audit(cases, staff.email, decision, id, "APPROVED");
  return done({ effectiveFrom: item.effectiveFrom });
}

// ---------------------------------------------------------------- what other families call

/**
 * A request to reconsider an inspection record or a verification answer (VER's POST /verification-challenges, after
 * its own DR-745 checks): the case VER asks CAS to open, raised by the premises principal from their account,
 * RECEIVED and acknowledged (NTF-CAS-01), in the case officers' queue and readable on SCR-CAS-02. The grounds are
 * the matter; the remedy asked for is the record's correction. The version of the subject and what the opening
 * module saw of it are kept where it sends them, and a repeat of the same idempotency key opens no second case.
 * Returns the case's reference.
 */
export function openReconsideration(
  key: string,
  input: {
    party: string;
    account: string;
    contact: string;
    subjectKind: "INSPECTION_RECORD" | "ANSWER";
    subjectRef: string;
    grounds: string;
    subjectVersion?: number | null;
    snapshot?: Readonly<Record<string, unknown>> | null;
    idempotencyKey?: string | null;
  },
): string {
  return openFromModule(key, {
    subjectKind: input.subjectKind === "INSPECTION_RECORD" ? "inspection_record" : "verification_answer",
    subjectRef: input.subjectRef,
    subjectVersion: input.subjectVersion ?? null,
    snapshot: input.snapshot ?? null,
    remedy: input.subjectKind === "INSPECTION_RECORD" ? "correction" : "explanation",
    raiser: { party: input.party, account: input.account, contact: input.contact },
    respondent: null,
    grounds: input.grounds,
    idempotencyKey: input.idempotencyKey ?? null,
  });
}

/** A case another module opens in process: RECEIVED on the premises principal's account route, acknowledged, idempotent. */
function openFromModule(
  key: string,
  input: {
    subjectKind: string;
    subjectRef: string;
    subjectVersion: number | null;
    snapshot: Readonly<Record<string, unknown>> | null;
    remedy: RemedyKind | null;
    raiser: { party: string | null; account: string | null; contact: string };
    respondent: string | null;
    grounds: string;
    idempotencyKey: string | null;
  },
): string {
  const cases = casesTable(key);
  const opened = input.idempotencyKey !== null ? cases.intakeKeys.get(input.idempotencyKey) : undefined;
  if (opened !== undefined) return opened;
  const version = effectiveVersion(cases, today());
  const route = version !== null ? routesOf(cases, version).find((candidate) => candidate.group === "premises_principal" && candidate.kind === "portal_form") : undefined;
  let reference = newReference("CAS");
  while (cases.cases.has(reference)) reference = newReference("CAS");
  const at = now();
  const row: CaseRow = {
    id: randomUUID(),
    reference,
    stakeholderGroup: "premises_principal",
    matter: input.grounds.slice(0, MATTER_LIMIT),
    caseType: null,
    subjectKind: input.subjectKind,
    subjectRef: input.subjectRef,
    affectedPeriodFrom: null,
    affectedPeriodTo: null,
    requestedRemedyKind: input.remedy,
    state: "RECEIVED",
    ownerActorId: null,
    raiserPartyId: input.raiser.party,
    raiserContact: input.raiser.contact,
    raiserVulnerability: null,
    severity: null,
    businessImpact: null,
    intakeRouteId: route?.id ?? "",
    submittedAt: at,
    recordedBy: input.raiser.account,
    nextStepBy: addWorkingDays(at, CLASSIFY_WORKING_DAYS),
    protectedMatter: false,
    agent: null,
    subjectVersion: input.subjectVersion,
    subjectSnapshot: input.snapshot,
    referral: null,
    closure: null,
  };
  cases.cases.set(reference, row);
  if (input.raiser.party !== null) cases.caseParties.push({ caseId: row.id, partyId: input.raiser.party, partyRole: "raiser" });
  if (input.respondent !== null) cases.caseParties.push({ caseId: row.id, partyId: input.respondent, partyRole: "respondent" });
  cases.caseStateHistory.push({ caseId: row.id, fromState: null, toState: "RECEIVED", occurredAt: at, reason: null });
  if (input.idempotencyKey !== null) cases.intakeKeys.set(input.idempotencyKey, reference);
  notify(key, cases, row, "case_received", reference, { submittedAt: at, by: row.nextStepBy ?? today() });
  return reference;
}

/**
 * A case's decision as VER reads it for DR-747 (`ICaseStatus`): its state, whether a decision is in force, and
 * whether the remedy in force is a correction of the record. Null when no case has the reference.
 */
export function caseDecisionFor(key: string, reference: string): { state: CaseState; decided: boolean; correctionRequired: boolean; decidedAt: string | null } | null {
  const cases = casesTable(key);
  const row = findCase(cases, reference);
  if (row === undefined) return null;
  const inForce = remedyInForce(cases, row);
  const decided = inForce !== null && DECIDED.includes(row.state);
  return {
    state: row.state,
    decided,
    correctionRequired: decided && inForce.remedy === "correction",
    decidedAt: inForce !== null ? (inForce.appeal?.outcome?.decidedAt ?? inForce.decision.issuedAt) : null,
  };
}

/**
 * A case as a module that makes an artefact under its remedy reads it first (`ICaseStatus.StateAsOf` and
 * `ICaseLinkage.RequiredArtefacts`, srs/07-integration-protocols.md): its state, whether a decision is in force, the
 * artefact kinds the remedy in force requires, and what the case is about. FIN reads it before it records a refund
 * that names the case. A protected matter gives a consuming module nothing it could act on, so it reads as no case.
 * Null when no case has the reference.
 */
export function caseRemedyFor(
  key: string,
  reference: string,
): { reference: string; state: CaseState; decided: boolean; requires: readonly ArtefactKind[]; subject: string | null } | null {
  const cases = casesTable(key);
  const row = findCase(cases, reference);
  if (row === undefined || row.protectedMatter) return null;
  const inForce = remedyInForce(cases, row);
  const decided = inForce !== null && DECIDED.includes(row.state);
  return { reference: row.reference, state: row.state, decided, requires: decided ? requiredFor(cases, inForce.remedy) : [], subject: row.subjectRef };
}

/**
 * `ICaseIntake.OpenCase` (VER `srs/07`, asked under CR-VER-02): a case another module opens on a subject it holds -
 * a verification answer, an inspection record, or a referral an inspection makes for case follow-up - carrying the
 * subject's version and the snapshot the module saw. A challenge is raised by the person who made it, for the party
 * they act for (or the party a case officer names on an assisted challenge); a follow-up referral is raised by the
 * inspection's person at their contact, the premises' party recorded as the respondent, with no remedy asked for:
 * the case officer classifies it. A repeat of the idempotency key opens no second case and returns the first one's
 * reference.
 */
export function openCase(
  key: string,
  input: {
    subjectKind: "VERIFICATION_ANSWER" | "INSPECTION_RECORD" | "INSPECTION_REFERRAL";
    subjectRef: string;
    subjectVersion?: number | null;
    snapshot?: Readonly<Record<string, unknown>> | null;
    raiser: { account: string | null; contact: string };
    onBehalfOfParty: string | null;
    grounds: string;
    idempotencyKey?: string | null;
  },
): string {
  const referral = input.subjectKind === "INSPECTION_REFERRAL";
  return openFromModule(key, {
    subjectKind: input.subjectKind === "VERIFICATION_ANSWER" ? "verification_answer" : "inspection_record",
    subjectRef: input.subjectRef,
    subjectVersion: input.subjectVersion ?? null,
    snapshot: input.snapshot ?? null,
    remedy: referral ? null : input.subjectKind === "INSPECTION_RECORD" ? "correction" : "explanation",
    raiser: { party: referral ? null : input.onBehalfOfParty, account: input.raiser.account, contact: input.raiser.contact },
    respondent: referral ? input.onBehalfOfParty : null,
    grounds: input.grounds,
    idempotencyKey: input.idempotencyKey ?? null,
  });
}
