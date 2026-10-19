import type { LoadOutcome } from "@rightone/ui";
import {
  addRuleAction,
  approveDisclosure,
  approveRuleVersion,
  authoriseCorrection,
  awardRuleEditor,
  awardRuleVersions,
  capabilityRelease,
  changeRuleActionValue,
  correctionDraft,
  correctionView,
  defineMetric,
  disclosureFor,
  disclosureVersions,
  endDisclosure,
  engagementHome,
  engagementMetrics,
  ledgerEventFor,
  balanceOf,
  assuranceBalance,
  engagementAudit,
  participationOf,
  pointDisposition,
  referralReference,
  requestReferralReference,
  prepareRuleVersion,
  prepareSnapshot,
  proposeCorrection,
  publishSnapshot,
  qualifyingActionForm,
  recordQualifyingAction,
  recordRelease,
  removeRuleAction,
  resumeRelease,
  stopTakingPart,
  submitRuleVersion,
  supportRead,
  supportView,
  suspendRelease,
  takePart,
  withdrawRelease,
  withdrawRuleVersion,
  type EngagementReader,
} from "@/lib/mock/backend/engagement";
import { mockEngagementFailure, type EngagementScreen } from "@/lib/mock/engagement";
import type { Artist, Principal, Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The engagement family's seam (ENG, `/api/v1/marketplace/engagement/`): what a participant reads and chooses about
 * their own participation, and what the gateway's staff read and do on the operations and policy consoles. Every read
 * is scoped by the backend to its reader: a participant to their own record, a member of staff by the spec roles they
 * hold, a support read to the participant it was recorded for.
 */

/** The participant classes `CFG-64` can release the capability to. */
export type ParticipantClass = "artist" | "premises";

/** `SM-51`, a participation; `NOT_ENROLLED` is every party's state before a row exists. */
export type ParticipationState = "NOT_ENROLLED" | "ENROLLED" | "WITHDRAWN" | "SUSPENDED";

/** `SM-52`, the capability as a whole. */
export type CapabilityState = "WITHHELD" | "RELEASED" | "SUSPENDED";

/** `SM-50`, an award rule version. */
export type RuleVersionState = "PREPARED" | "APPROVED" | "EFFECTIVE" | "SUPERSEDED" | "WITHDRAWN";

/** The grounds `CFG-65` approves for a correction, and no third. */
export type CorrectionGround = "ACTION_DID_NOT_OCCUR" | "VALUE_NOT_CARRIED_BY_VERSION";
export const CORRECTION_GROUNDS: readonly CorrectionGround[] = ["ACTION_DID_NOT_OCCUR", "VALUE_NOT_CARRIED_BY_VERSION"];

/** The four conditions of `CG-ENG` a release evidences. */
export type ConditionCode = "AWARD_RULES" | "PRIVACY_DISCLOSURE" | "CORRECTION_TREATMENT" | "METRIC_OWNERSHIP";

/** The two metrics `CFG-63` approves, both aggregates with no participant dimension. */
export type MetricCode = "POINTS_AWARDED" | "PARTICIPANTS_ENROLLED";

/** A `DR-66` outcome of a snapshot, and what became of it. */
export type SnapshotOutcome = "RECONCILED_EMPTY" | "RECONCILED" | "METRIC_RECONCILIATION_VARIANCE";
export type SnapshotState = "PREPARED" | "PUBLISHED" | "REFUSED";

/** Who did something, as a record attributes it: a person by name, or the migration or handler that did it. */
export interface Actor {
  name: string;
  kind: "person" | "system";
}

/** A refusal with its spec code, and what the response names (a field, a condition, the classes in scope). */
export interface Refusal {
  code: string;
  values: Readonly<Record<string, string | number>>;
}

export type EngagementAnswer<T> = { accepted: T; refusal: null } | { accepted: null; refusal: Refusal };

/**
 * A read's answer, where a refusal names something the reader needs: AS_AT_IN_FUTURE names the latest instant that
 * may be asked for, REFERRAL_PROGRAMME_NOT_ENABLED the decision that would enable one.
 */
export type NamedOutcome<T> = LoadOutcome<T> & { named?: Readonly<Record<string, string>> };

/** Who reads their own engagement record: a premises principal for the organisation they act for, or an artist. */
export type Participant = Principal | Artist;

/**
 * The capability as a participant or an operator reads it. While withheld, `withheld` says why: never released, or
 * released and since withdrawn (`SCR-ENG-01`'s two sentences).
 */
export interface CapabilitySummary {
  state: CapabilityState;
  withheld: "never" | "withdrawn" | null;
  scope: readonly ParticipantClass[];
  effectiveFrom: string | null;
}

export interface Party {
  ref: string;
  name: string;
  participantClass: ParticipantClass;
}

/** SCR-ENG-01: the reader's own participation, and the capability that conditions it. */
export interface ParticipationView {
  state: ParticipationState;
  participant: Party;
  /** The profile the participation attaches to, by `FR-ART-006`. */
  displayProfile: { ref: string; name: string };
  lastTransitionAt: string | null;
  capability: CapabilitySummary;
}

/** One row of a history: an award, or a correction naming the event it corrects. */
export interface LedgerRow {
  id: string;
  recordedAt: string;
  kind: "award" | "correction";
  actionCode: string | null;
  /** The instant the action happened, for an award: two awards of one action differ by it. */
  occurredAt: string | null;
  points: number;
  corrects: { id: string; recordedAt: string } | null;
  correctedBy: { id: string; recordedAt: string } | null;
}

/** A page of history, keyset-paginated: `next` is the cursor of the page after, null on the last. */
export interface LedgerPage {
  rows: readonly LedgerRow[];
  total: number;
  shownTo: number;
  next: string | null;
}

export interface DisclosureVersion {
  no: number;
  textEn: string;
  textVi: string;
  reservingDecision: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedBy: Actor;
  approvedAt: string;
  /** ENDED: its end passed with no version to follow it, so what a participant reads has lapsed. */
  state: "APPROVED" | "EFFECTIVE" | "SUPERSEDED" | "ENDED";
}

/** SCR-ENG-02: the derived figure, the disclosure in the same view, and a page of history. */
export interface BalanceView {
  points: number;
  eventCount: number;
  /** The instant asked for; null for now. */
  asAt: string | null;
  /** The cut-off the figure and the history were computed at: the instant asked for, or now. */
  computedAt: string;
  disclosure: DisclosureVersion;
  history: LedgerPage;
  /** The figure is below zero because a correction took back more than the events since. */
  negative: boolean;
  /** A premises principal can earn nothing while the effective rule lists no premises-class action. */
  noPremisesAction: boolean;
}

/** SCR-ENG-03: the effective statement, and the versions shown before it with their periods. */
export interface DisclosureView {
  effective: DisclosureVersion;
  earlier: readonly DisclosureVersion[];
}

/** SCR-ENG-04: the seven elements `FR-ENG-011` requires, and the correcting event where one exists. */
export interface LedgerEventView {
  id: string;
  participant: Party;
  displayProfile: { ref: string; name: string };
  kind: "award" | "correction";
  action: { code: string; occurredAt: string } | null;
  governing: { no: number; effectiveFrom: string };
  points: number;
  recordedAt: string;
  recordedBy: Actor;
  corrects: { id: string; ground: CorrectionGround } | null;
  correctedBy: { id: string; ground: CorrectionGround; recordedAt: string } | null;
}

export interface RuleAction {
  code: string;
  value: number;
  participantClass: ParticipantClass;
}

export interface RuleVersion {
  no: number;
  state: RuleVersionState;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  referral: boolean;
  actions: readonly RuleAction[];
  preparedBy: Actor;
  preparedAt: string;
  submittedAt: string | null;
  approvedBy: Actor | null;
  approvedAt: string | null;
  withdrawnBy: Actor | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

/** SCR-ENG-06: every version, the one selected, and what the reader may do with it. */
export interface RuleVersionsView {
  versions: readonly RuleVersion[];
  selected: RuleVersion | null;
  mayPrepare: boolean;
  mayApprove: boolean;
  /** The reader prepared the selected version: approval is refused to them by `DR-67` row 2. */
  preparedSelected: boolean;
}

/** SCR-ENG-07: one version and whether the reader may change it. */
export interface RuleEditorView {
  version: RuleVersion;
  mayEdit: boolean;
}

/** SCR-ENG-08: the capability, and the governing version resolved for the participant and the instant asked. */
export interface QualifyingActionForm {
  capability: CapabilitySummary;
  mayRecord: boolean;
  asked: { participant: string; at: string } | null;
  participant: Party | null;
  /** The participant's display profiles, the act's attribution chosen among them; the first is the participation's. */
  profiles: readonly { ref: string; name: string }[];
  resolution: { version: { no: number; effectiveFrom: string }; codes: readonly { code: string; value: number }[] } | null;
  refusal: Refusal | null;
}

export interface Recorded {
  event: string;
  points: number;
  replay: boolean;
}

/** SCR-ENG-10: a support read, recorded with its purpose before anything was shown. */
export interface SupportViewData {
  read: { id: string; purpose: string; at: string };
  participant: Party;
  participation: { state: ParticipationState; enrolledAt: string | null } | null;
  points: number;
  eventCount: number;
  history: LedgerPage;
  selected: LedgerEventView | null;
}

/** SCR-ENG-09 before a proposal: the event, its participant and balance, and the grounds. */
export interface CorrectionDraftView {
  read: string;
  event: LedgerEventView;
  balance: number;
  capability: CapabilitySummary;
  mayPropose: boolean;
}

/** Where a reader stands to a correction's authorisation (`DR-64` rows 4 and 7, and the role). */
export type CorrectionReader = "proposer" | "recorder" | "approver" | "no-role";

/** SCR-ENG-09 after a proposal: both actors, and the correcting event once authorised. */
export interface CorrectionViewData {
  id: string;
  /** While withheld, no correction can be recorded: Authorise is disabled with that sentence (SCR-ENG-09). */
  capability: CapabilitySummary;
  event: LedgerEventView;
  balance: number;
  ground: CorrectionGround;
  delta: number;
  resulting: number;
  proposedBy: Actor;
  proposedAt: string;
  authorisedBy: Actor | null;
  authorisedAt: string | null;
  correctingEvent: string | null;
  reader: CorrectionReader;
  /** The proposer's support read, so they can go back to it; null for anyone else. */
  read: string | null;
}

export interface CorrectionSummary {
  id: string;
  participant: Party;
  event: string;
  delta: number;
  ground: CorrectionGround;
  proposedBy: Actor;
  proposedAt: string;
}

/** The engagement workspace's home: the capability, and the corrections waiting for a second person. */
export interface EngagementHomeView {
  capability: CapabilitySummary;
  awaiting: readonly CorrectionSummary[] | null;
}

export interface ReleaseCondition {
  code: ConditionCode;
  /** The evidence that satisfies it, as words are built from it on the page; null when nothing does. */
  evidence: { kind: "rule-version"; no: number } | { kind: "disclosure"; no: number } | { kind: "config"; ref: string } | { kind: "metric-definitions"; points: number; enrolled: number } | null;
  effectiveFrom: string | null;
  effective: boolean;
}

export interface ReleaseTransition {
  from: CapabilityState | null;
  to: CapabilityState;
  actor: Actor;
  ground: string | null;
  at: string;
}

/** SCR-ENG-12: the `SM-52` state, every condition with its evidence, the release on record and its transitions. */
export interface CapabilityReleaseView {
  capability: CapabilitySummary;
  release: { id: string; state: CapabilityState; scope: readonly ParticipantClass[]; effectiveFrom: string; approvedBy: Actor; approvedAt: string } | null;
  conditions: readonly ReleaseCondition[];
  history: readonly ReleaseTransition[];
  mayAct: boolean;
}

export interface MetricDefinition {
  code: MetricCode;
  no: number;
  statement: string;
  ownerRole: string;
  effectiveFrom: string;
  /** The person holding the owner role who approved it; null for the version `MIG-ENG-03` loaded. */
  approvedBy: Actor | null;
  approvedAt: string | null;
}

export interface MetricSnapshot {
  id: string;
  metric: MetricCode;
  definitionNo: number;
  period: { from: string; to: string };
  cutOff: string;
  figure: number;
  ledgerFigure: number;
  variance: number;
  outcome: SnapshotOutcome;
  state: SnapshotState;
  publishedBy: Actor | null;
}

/** SCR-ENG-11: the definitions, every snapshot with both figures and its variance, the months a snapshot can be for. */
export interface MetricsView {
  definitions: readonly MetricDefinition[];
  snapshots: readonly MetricSnapshot[];
  filter: MetricCode | null;
  selected: MetricSnapshot | null;
  /** The months a snapshot can be asked for, this one first, with their first and last day. */
  months: readonly { value: string; from: string; to: string }[];
  owner: boolean;
}

/** SCR-ENG-13: every disclosure version with its period, and whether the reader approves one. */
export interface DisclosureVersionsView {
  versions: readonly DisclosureVersion[];
  dpo: boolean;
  /** No version is effective now: what a participant reads has lapsed. */
  lapsed: boolean;
}

/** SCR-ENG-05: the referral programme the governing version enables, and the reference issued, if any. */
export interface ReferralView {
  /** The award rule version whose referral programme is enabled. */
  programme: { version: number };
  /** The live reference, attached to the display profile; null until one is issued. */
  reference: { value: string; issuedAt: string; displayProfile: { ref: string; name: string } } | null;
  /** Whether the reader takes part, which a reference is issued only to. */
  takingPart: boolean;
}

/** What `POST /engagement/point-dispositions` may be asked: every kind is reserved by `DEC-30`. */
export type DispositionKind = "exchange" | "transfer" | "expiry";
export const DISPOSITION_KINDS: readonly DispositionKind[] = ["exchange", "transfer", "expiry"];

/** A row of `marketplace.audit_log`, as an auditor reads it. */
export interface AuditEntry {
  at: string;
  actor: string;
  act: string;
  subject: string;
  code: string | null;
  detail: string | null;
}

/** What a page kept from a refused or completed act, by the page it is drawn on. */
export interface EngagementAttempt {
  page: string;
  refusal: Refusal | null;
  done: string | null;
  /** What the reader typed, given back so a refusal costs them nothing. */
  form: Readonly<Record<string, string>>;
}

const read = <O extends LoadOutcome<unknown>>(screen: EngagementScreen, view: "error" | null, run: () => O): Promise<O | LoadOutcome<never>> =>
  Promise.resolve(!usesMockData() ? NOT_CONFIGURED : view !== null ? mockEngagementFailure(screen) : run());

const notWired = { accepted: null, refusal: { code: "SERVICE_NOT_CONFIGURED", values: {} } } as const;
const act = <T>(run: () => EngagementAnswer<T>): Promise<EngagementAnswer<T>> => Promise.resolve(usesMockData() ? run() : notWired);

/** A participant as the backend knows them: a principal by the organisation they act for, an artist by their account. */
const participant = (who: Participant): EngagementReader =>
  "organisation" in who ? { kind: "participant", organisation: who.organisation, name: who.account } : { kind: "artist", account: who.email, name: who.account };
const officer = (staff: Staff): EngagementReader => ({ kind: "staff", name: staff.account, email: staff.email, roles: staff.roles });

// ------------------------------------------------------------------ the participant portals (SCR-ENG-01 to 05)

/** SCR-ENG-01: GET /engagement/participation with GET /engagement/capability-release. */
export const loadParticipation = (who: Participant, view: "error" | null) => read("eng01", view, () => participationOf(who.sessionId, participant(who)));

/** POST /engagement/participation. */
export const sendTakePart = (who: Participant) => act(() => takePart(who.sessionId, participant(who)));

/** POST /engagement/participation/withdrawal: refused by nothing but not taking part. */
export const sendStopTakingPart = (who: Participant) => act(() => stopTakingPart(who.sessionId, participant(who)));

/** SCR-ENG-02: GET /engagement/balance and /ledger, or /balance/as-at for a past instant. */
export const loadBalance = (who: Participant, asAt: string | null, cursor: string | null, view: "error" | null): Promise<NamedOutcome<BalanceView>> =>
  read("eng02", view, () => balanceOf(who.sessionId, participant(who), asAt, cursor));

/** SCR-ENG-03: GET /engagement/disclosure, with the versions shown before it. */
export const loadDisclosure = (who: Participant, view: "error" | null) => read("eng03", view, () => disclosureFor(who.sessionId, participant(who)));

/** POST /engagement/point-dispositions: refused while `DEC-30` is not effective, and the attempt recorded. */
export const sendPointDisposition = (who: Participant | Staff, kind: string) =>
  act(() => pointDisposition(who.sessionId, "roles" in who ? officer(who) : participant(who), kind));

/** SCR-ENG-04: GET /engagement/ledger/{eventId}, for the participant or under a recorded support read. */
export const loadLedgerEvent = (reader: { participant: Participant } | { staff: Staff; read: string | null }, event: string, view: "error" | null) =>
  read("eng04", view, () =>
    "participant" in reader
      ? ledgerEventFor(reader.participant.sessionId, participant(reader.participant), event, null)
      : ledgerEventFor(reader.staff.sessionId, officer(reader.staff), event, reader.read),
  );

/** SCR-ENG-05: GET /engagement/referral-reference, the artist's own. */
export const loadReferral = (artist: Artist, view: "error" | null): Promise<NamedOutcome<ReferralView>> =>
  read("eng05", view, () => referralReference(artist.sessionId, participant(artist)));

/** POST /engagement/referral-reference: a repeat returns the reference already issued. */
export const sendReferralRequest = (artist: Artist) => act(() => requestReferralReference(artist.sessionId, participant(artist)));

/**
 * GET /engagement/balance/as-at for an auditor, under the assurance engagement they name (`PERM-136`, `PERM-138`): the
 * console's assurance read, which ENG's inventory gives no screen of its own.
 */
export const loadAssuranceBalance = (staff: Staff, asked: { participant: string; engagement: string; asAt: string }, cursor: string | null, view: "error" | null): Promise<NamedOutcome<BalanceView>> =>
  read("eng02", view, () => assuranceBalance(staff.sessionId, officer(staff), asked, cursor));

/** `marketplace.audit_log`, read by an auditor beside the assurance read: every recorded attempt and read, newest first. */
export const loadEngagementAudit = (staff: Staff, view: "error" | null) => read("home", view, () => engagementAudit(staff.sessionId, officer(staff)));

// ------------------------------------------------------------------ policy operations (SCR-ENG-06, 07, 13)

/** SCR-ENG-06: GET /engagement/award-rule-versions, one selected. */
export const loadRuleVersions = (staff: Staff, selected: number | null, view: "error" | null) =>
  read("eng06", view, () => awardRuleVersions(staff.sessionId, officer(staff), selected));

/** POST /engagement/award-rule-versions: a version PREPARED, starting from the actions in effect. */
export const sendPrepareVersion = (staff: Staff) => act(() => prepareRuleVersion(staff.sessionId, officer(staff)));

/** POST /engagement/award-rule-versions/{versionId}/approve. */
export const sendApproveVersion = (staff: Staff, no: number, effectiveFrom: string | null) =>
  act(() => approveRuleVersion(staff.sessionId, officer(staff), no, effectiveFrom));

/** POST /engagement/award-rule-versions/{versionId}/withdraw. */
export const sendWithdrawVersion = (staff: Staff, no: number, reason: string) => act(() => withdrawRuleVersion(staff.sessionId, officer(staff), no, reason));

/** SCR-ENG-07: GET /engagement/award-rule-versions/{versionId}. */
export const loadRuleEditor = (staff: Staff, no: number, view: "error" | null) => read("eng07", view, () => awardRuleEditor(staff.sessionId, officer(staff), no));

/** PUT /engagement/award-rule-versions/{versionId}/actions/{actionCode}, a new row. */
export const sendAddAction = (staff: Staff, no: number, action: { code: string; value: string; participantClass: string }) =>
  act(() => addRuleAction(staff.sessionId, officer(staff), no, action));

/** PUT /engagement/award-rule-versions/{versionId}/actions/{actionCode}, the value of a row already listed. */
export const sendActionValue = (staff: Staff, no: number, code: string, value: string) =>
  act(() => changeRuleActionValue(staff.sessionId, officer(staff), no, code, value));

/** DELETE /engagement/award-rule-versions/{versionId}/actions/{actionCode}. */
export const sendRemoveAction = (staff: Staff, no: number, code: string) => act(() => removeRuleAction(staff.sessionId, officer(staff), no, code));

/** Submit for approval: the version's effective instant and referral setting, recorded with the submission. */
export const sendSubmitVersion = (staff: Staff, no: number, terms: { effectiveFrom: string | null; referral: boolean }) =>
  act(() => submitRuleVersion(staff.sessionId, officer(staff), no, terms));

/** SCR-ENG-13: every disclosure version with its period. */
export const loadDisclosureVersions = (staff: Staff, view: "error" | null) => read("eng13", view, () => disclosureVersions(staff.sessionId, officer(staff)));

/** POST /engagement/disclosure-versions. */
export const sendDisclosureVersion = (staff: Staff, draft: { textEn: string; textVi: string; reservingDecision: string; effectiveFrom: string | null }) =>
  act(() => approveDisclosure(staff.sessionId, officer(staff), draft));

/** The DPO ends the effective disclosure version with none to follow (UAT-ENG-07): no figure is shown until one is. */
export const sendEndDisclosure = (staff: Staff) => act(() => endDisclosure(staff.sessionId, officer(staff)));

// ------------------------------------------------------------------ engagement operations (SCR-ENG-08 to 12)

/** The engagement workspace's home on the operations console. */
export const loadEngagementHome = (staff: Staff, view: "error" | null) => read("home", view, () => engagementHome(staff.sessionId, officer(staff)));

/** SCR-ENG-08: the governing version resolved for a participant and an instant, before anything can be recorded. */
export const loadQualifyingActionForm = (staff: Staff, asked: { participant: string; at: string } | null, view: "error" | null) =>
  read("eng08", view, () => qualifyingActionForm(staff.sessionId, officer(staff), asked));

/**
 * POST /engagement/qualifying-actions, recorded by hand: the subject is what tells two acts of one instant apart, and the
 * display profile is the one the act happened under.
 */
export const sendQualifyingAction = (staff: Staff, action: { participant: string; code: string; at: string | null; subject: string; profile: string }) =>
  act(() => recordQualifyingAction(staff.sessionId, officer(staff), action));

/** GET /engagement/participants/{participantRef}/balance: the purpose is recorded before the read. */
export const sendSupportRead = (staff: Staff, participantRef: string, purpose: string) => act(() => supportRead(staff.sessionId, officer(staff), participantRef, purpose));

/** SCR-ENG-10: what a recorded support read shows, with one event selected. */
export const loadSupportView = (staff: Staff, readId: string, cursor: string | null, selected: string | null, view: "error" | null) =>
  read("eng10", view, () => supportView(staff.sessionId, officer(staff), readId, cursor, selected));

/** SCR-ENG-09 before a proposal. */
export const loadCorrectionDraft = (staff: Staff, readId: string, event: string, view: "error" | null) =>
  read("eng09", view, () => correctionDraft(staff.sessionId, officer(staff), readId, event));

/** POST /engagement/corrections. */
export const sendCorrection = (staff: Staff, readId: string, proposal: { event: string; ground: string; delta: string }) =>
  act(() => proposeCorrection(staff.sessionId, officer(staff), readId, proposal));

/** SCR-ENG-09 after a proposal. */
export const loadCorrection = (staff: Staff, id: string, view: "error" | null) => read("eng09", view, () => correctionView(staff.sessionId, officer(staff), id));

/** POST /engagement/corrections/{correctionId}/authorise. */
export const sendAuthorisation = (staff: Staff, id: string) => act(() => authoriseCorrection(staff.sessionId, officer(staff), id));

/** SCR-ENG-12: GET /engagement/capability-release. */
export const loadCapabilityRelease = (staff: Staff, view: "error" | null) => read("eng12", view, () => capabilityRelease(staff.sessionId, officer(staff)));

/** POST /engagement/capability-release. */
export const sendRelease = (staff: Staff, release: { scope: readonly string[]; effectiveFrom: string | null }) =>
  act(() => recordRelease(staff.sessionId, officer(staff), release));

/** POST /engagement/capability-release/{releaseId}/suspend. */
export const sendSuspension = (staff: Staff, ground: string) => act(() => suspendRelease(staff.sessionId, officer(staff), ground));

/** POST /engagement/capability-release/{releaseId}/resume. */
export const sendResumption = (staff: Staff) => act(() => resumeRelease(staff.sessionId, officer(staff)));

/** POST /engagement/capability-release/{releaseId}/withdraw. */
export const sendReleaseWithdrawal = (staff: Staff, ground: string) => act(() => withdrawRelease(staff.sessionId, officer(staff), ground));

// ------------------------------------------------------------------ reporting (SCR-ENG-11)

/** SCR-ENG-11: GET /engagement/metrics, one metric or all, one snapshot opened. */
export const loadMetrics = (staff: Staff, metric: string | null, snapshot: string | null, view: "error" | null) =>
  read("eng11", view, () => engagementMetrics(staff.sessionId, officer(staff), metric, snapshot));

/** POST /engagement/metric-definitions: a definition version approved by the holder of its owner role. */
export const sendMetricDefinition = (staff: Staff, metric: string, statement: string, effectiveFrom: string | null) =>
  act(() => defineMetric(staff.sessionId, officer(staff), metric, statement, effectiveFrom));

/** POST /engagement/metric-snapshots, for a month. */
export const sendSnapshot = (staff: Staff, metric: string, month: string) => act(() => prepareSnapshot(staff.sessionId, officer(staff), metric, month));

/** POST /engagement/metric-snapshots/{snapshotId}/publish. */
export const sendPublication = (staff: Staff, snapshot: string) => act(() => publishSnapshot(staff.sessionId, officer(staff), snapshot));
