import type { LoadOutcome } from "@rightone/ui";
import {
  acceptanceView,
  applyForCertification,
  approveAssurancePolicy,
  approveOfflinePolicy,
  approveRuleSet,
  assessCertification,
  assuranceConsole,
  assurancePolicy,
  certificationRegister,
  credentialRecord,
  decisionsView,
  deviceEstate,
  deviceRecord,
  draftAssurancePolicy,
  draftOfflinePolicy,
  draftRuleSet,
  enrolDevice,
  enrolForm,
  offlinePolicy,
  recordCondition,
  reinstateCredential,
  revokeCredential,
  type EvidenceChange,
  ruleSetView,
  suspendCredential,
  deviceRegister,
  syncProgress,
} from "@/lib/mock/backend/player";
import { reviewFailure, type PlayerView } from "@/lib/mock/player";
import type { Staff } from "./session";
import type { CaseText, CommandAnswer, PremisesRef, Reader } from "./venue";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The Player device on the consoles and in public: PLR's estate, records, enrolment, evidence, playback decisions and
 * their rule set, offline-continuity policy, certification register and device-assurance policy (SCR-PLR-01, 02, 03,
 * 07, 10, 11, 13, 15), a premises device's synchronisation (SCR-PLR-04) and IAM's device credentials (SCR-IAM-07,
 * 08). The device's own screens (SCR-PLR-16 to 18) are the Android app's, not the portal's. Each loader is one screen's read for the signed-in member of staff, or for the
 * browser's world on a public page; given a review view it answers the state a board drew instead. Each command
 * answers whether RightOne accepted the act, with the refusal code of the family's `design/04-refusal-codes.md` when
 * it did not.
 */

export type DeviceStatus = "ENROLLED" | "ACTIVE" | "SUSPENDED" | "LOST" | "COMPROMISED" | "TRANSFERRED" | "RETIRED";
/** The device's last report of its playback session; STOPPED is delivery stopped because the service is not in force. */
export type SessionState = "PLAYING" | "OFFLINE" | "LIMIT_REACHED" | "CEILING" | "FAULT" | "SYNCING" | "STOPPED";
export type CertificationStatus = "APPLIED" | "UNDER_REVIEW" | "CERTIFIED" | "REFUSED" | "EXPIRED" | "WITHDRAWN";
export type CredentialState = "ACTIVE" | "SUSPENDED" | "REVOKED";
export type DecisionKind = "FROM_SCHEDULE" | "FROM_DEFAULT_PLAYLIST" | "CYCLE_RESTARTED";
export type OutcomeKind = "ACCEPTED" | "DUPLICATE" | "QUARANTINED" | "BELOW_THRESHOLD" | "REFUSED";

export const DEVICE_STATUSES: readonly DeviceStatus[] = ["ACTIVE", "ENROLLED", "SUSPENDED", "LOST", "COMPROMISED", "TRANSFERRED", "RETIRED"];
export const CREDENTIAL_STATES: readonly CredentialState[] = ["ACTIVE", "SUSPENDED", "REVOKED"];
export const DECISION_KINDS: readonly DecisionKind[] = ["FROM_SCHEDULE", "FROM_DEFAULT_PLAYLIST", "CYCLE_RESTARTED"];

export interface Officer {
  name: string;
  /** The operations officer, the premises principal who reported, or the security officer recording a loss (PERM-473). */
  role: "operations" | "principal" | "security";
}

/** A premises as a console picker offers it: its name and the ward the register gives. */
export interface PremisesOption extends PremisesRef {
  area: string | null;
}

/** A supplier's certification as it stands today (SM-202), read for a device or an enrolment. */
export interface SupplierCertification {
  supplier: string;
  /** Null when the supplier never applied. */
  status: CertificationStatus | null;
  validTo: string | null;
  decidedOn: string | null;
  criterion: string | null;
}

// ---------------------------------------------------------------- SCR-PLR-01

export interface EstateFilter {
  device: string | null;
  premises: string | null;
  status: DeviceStatus | null;
  supplier: string | null;
}

export interface EstateRow {
  id: string;
  premises: PremisesRef;
  supplier: string;
  status: DeviceStatus;
  session: { state: SessionState; hoursLeft: number | null } | null;
  /** Null for a retired device, which no longer needs one. */
  certification: SupplierCertification | null;
  waiting: number | null;
  held: number;
  lastContact: string | null;
}

export interface DeviceEstate {
  asOf: string;
  total: number;
  counts: Readonly<Partial<Record<DeviceStatus, number>>>;
  /** Every device the filter keeps, soonest certification end first. */
  rows: readonly EstateRow[];
  /** Active devices whose supplier's certification has ended: their evidence is refused DEVICE_NOT_CERTIFIED. */
  expired: readonly { device: string; supplier: string; on: string }[];
  premisesOptions: readonly PremisesOption[];
  suppliers: readonly string[];
  filter: EstateFilter;
}

// ---------------------------------------------------------------- SCR-PLR-02

/** A transfer's decision on the evidence the device still held, the officer's and never the receiving premises'. */
export type EvidenceDecision = "SUBMITTED_TO_FORMER" | "DISCARDED";

export interface TransferEvidence {
  decision: EvidenceDecision;
  /** The events decided on, counted when the transfer took effect; null while it waits for its time. */
  count: number | null;
  /** The ground of a discard, in the officer's words. */
  ground: string | null;
  /** The premises the events were played at. */
  former: PremisesRef;
}

/** SM-203's states of a snapshot a device holds. */
export type SnapshotStatus = "SYNCED" | "IN_FORCE" | "SUPERSEDED";

export interface ConditionRow {
  status: DeviceStatus;
  from: DeviceStatus | null;
  effectiveFrom: string;
  /** When the next condition took effect; null for the one in force. */
  effectiveTo: string | null;
  /** Recorded for a time still to come: the condition before it stays in force until then. */
  pending: boolean;
  recordedAt: string;
  recordedBy: Officer | null;
  /** When the loss or compromise was reported, where that differs from when it is said to have happened. */
  reportedAt: string | null;
  cause: CaseText | null;
  reportedBy: Officer | null;
  /** A transfer's premises, and its decision on the evidence the device held. */
  premisesTo: PremisesRef | null;
  evidence: TransferEvidence | null;
}

export interface DeviceRecord {
  id: string;
  identity: string;
  supplier: string;
  premises: PremisesRef;
  /** The condition in force now. */
  status: DeviceStatus;
  enrolledAt: string;
  enrolledBy: Officer;
  /** Newest first: a condition recorded for a time still to come first, then the one in force. */
  conditions: readonly ConditionRow[];
  /** The condition recorded for a time still to come, which takes effect then; null when none waits. */
  scheduled: ConditionRow | null;
  /** The snapshot the device plays from (SM-203); a transfer supersedes it, so nothing of it crosses. */
  snapshot: { version: number; status: SnapshotStatus } | null;
  waiting: number | null;
  /** The last contact of a device that is offline. */
  offlineSince: string | null;
  held: number;
  disposition: string | null;
  /** When IAM revoked the device's credential, for a device lost or compromised. */
  credentialRevokedAt: string | null;
  paired: boolean;
  certification: SupplierCertification;
  /** The conditions that may be recorded after the latest one (SM-200), whoever is reading. */
  next: readonly DeviceStatus[];
  /** What the reader may record: ACT-OPS any condition and a transfer, ACT-SEC a condition but not a transfer, ACT-AUD nothing. */
  acts: { record: boolean; transfer: boolean };
  causes: Readonly<Partial<Record<DeviceStatus, readonly { id: string; text: CaseText }[]>>>;
  /** The premises of the same operator a transfer may move the device to. */
  transferTo: readonly PremisesOption[];
}

export interface ConditionInput {
  condition: string;
  cause: string;
  /** YYYY-MM-DDTHH:MM+07:00: when the condition takes effect; for a loss or a compromise, when it is said to have happened. */
  effectiveFrom: string;
  /** When a loss or a compromise was reported, where that differs; empty for the record instant. */
  reportedAt: string;
  premises: string;
  /** A transfer's decision on the evidence the device holds: submit_to_former or discard. */
  pending: string;
  ground: string;
}

export interface ConditionAttempt {
  page: "condition";
  device: string;
  values: ConditionInput;
  code: string | null;
  /** A value the form left out that no refusal code names. */
  field: "condition" | "premises" | "reported" | null;
  done: DeviceStatus | null;
  /** When the condition recorded takes effect, and whether it already has. */
  doneFrom: string | null;
  doneInForce: boolean;
}

// ---------------------------------------------------------------- SCR-PLR-03

export interface EnrolFormData {
  suppliers: readonly SupplierCertification[];
  /** The premises with a Player service a device may be enrolled for. */
  premises: readonly PremisesOption[];
}

export interface EnrolInput {
  identity: string;
  supplier: string;
  premises: string;
}

export interface EnrolAttempt {
  page: "enrol";
  values: EnrolInput;
  code: string | null;
  field: "identity" | "supplier" | "premises" | null;
  /** The device an identity already enrolled belongs to (DEVICE_ALREADY_ENROLLED). */
  existing: string | null;
}

// ---------------------------------------------------------------- SCR-PLR-07

export interface BatchView {
  id: string;
  receivedAt: string;
  firstSequence: number;
  lastSequence: number;
  events: number;
  policyVersion: number;
  entitlementVersion: number;
  outcomes: readonly { kind: OutcomeKind; count: number; why: CaseText; code: string | null }[];
  held: readonly { event: string; deviceTime: string; trustedTime: string; driftSeconds: number }[];
  disposition: string | null;
}

export interface AcceptanceView {
  devices: readonly { id: string; premises: string }[];
  device: { id: string; premises: PremisesRef; enrolledAt: string };
  /** The latest batch from the device; null while none has arrived. */
  batch: BatchView | null;
}

// ---------------------------------------------------------------- SCR-PLR-15

export interface DecisionRow {
  at: string;
  kind: DecisionKind;
  title: CaseText;
  source: CaseText;
}

export interface DecisionsView {
  devices: readonly { id: string; premises: string }[];
  device: string;
  premises: PremisesRef;
  day: string;
  eligibleTracks: number | null;
  kind: DecisionKind | null;
  /** The day's decisions of the kind asked, newest first. */
  rows: readonly DecisionRow[];
  counts: Readonly<Record<"ALL" | DecisionKind, number>>;
  /** Restarts and repeats before the first restart, over the whole day. */
  restarts: number;
  repeatsBefore: number;
  /** The rule-set version in force on the day; null when none was. */
  rules: { version: number; effectiveFrom: string } | null;
}

// ---------------------------------------------------------------- SCR-PLR-13

export interface OfflineVersion {
  no: number;
  maxOfflineHours: number;
  exceeded: "STOP";
  propagation: "NEXT_SYNC";
  graceHours: number;
  effectiveFrom: string;
  /** The day the next approved version took effect; null while open. */
  effectiveTo: string | null;
  status: "DRAFT" | "APPROVED";
  preparedBy: string;
  preparedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface OfflinePolicyView {
  /** The approved version in effect today; null while the interim rule applies. */
  effective: OfflineVersion | null;
  /** Approved versions whose effective date is still to come, soonest first. */
  approved: readonly OfflineVersion[];
  /** The latest draft, which the form starts from and Approve acts on. */
  draft: OfflineVersion | null;
  /** The number the next draft takes. */
  nextNo: number;
  /** What DR-218 bounds a session opening now by: the policy's maximum plus its grace, or the snapshot's limit. */
  limitNow: { hours: number; source: "policy" | "snapshot"; version: number | null };
  today: string;
}

export interface OfflineInput {
  maxOfflineHours: string;
  exceeded: string;
  propagation: string;
  graceHours: string;
  effectiveFrom: string;
}

export type OfflinePart = "max" | "exceeded" | "propagation" | "grace" | "from";

export interface OfflineAttempt {
  page: "offline";
  values: OfflineInput;
  code: string | null;
  part: OfflinePart | null;
  saved: number | null;
}

/** The policies an evidence operator drafts and approves: the device-assurance policy, the offline-continuity policy, the rule set. */
export type GovernedPolicy = "assurance" | "offline" | "rules";

/** Approve, on the screen that shows the draft: the version approved, or the refusal with what it names. */
export interface ApproveAttempt {
  page: "approve";
  policy: GovernedPolicy;
  no: number;
  values: { note: string; publish: boolean };
  code: string | null;
  /** The part an incomplete version misses (POLICY_INCOMPLETE, POLICY_VERSION_INCOMPLETE). */
  part: string | null;
  /** The version in force for part of the period (EFFECTIVE_PERIOD_OVERLAPS). */
  overlaps: number | null;
  done: boolean;
}

// ---------------------------------------------------------------- the rule set SCR-PLR-15 names

export interface RuleSetVersion {
  no: number;
  /** Null where the record carries no text (version 2's board gives none). */
  loudness: CaseText | null;
  transitions: CaseText | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "DRAFT" | "APPROVED";
  preparedBy: string | null;
  preparedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  inEffect: boolean;
}

export interface RuleSetView {
  /** Newest first. */
  versions: readonly RuleSetVersion[];
  nextNo: number;
  today: string;
}

export interface RuleSetInput {
  loudness: string;
  transitions: string;
  effectiveFrom: string;
  /** A premises the rules would be set for alone: always refused, RULES_NOT_PREMISES_SCOPED. */
  premises: string;
}

export type RuleSetField = "loudness" | "transitions" | "from";

export interface RuleSetAttempt {
  page: "rules";
  values: RuleSetInput;
  code: string | null;
  field: RuleSetField | null;
  saved: number | null;
}

// ---------------------------------------------------------------- SCR-PLR-04's synchronisation (GET /sync/progress)

/**
 * COMPLETE: the device holds all of its snapshot. IN_PROGRESS: a newer snapshot is arriving while the device plays
 * from the one it holds. INTERRUPTED: the transfer stopped with the connection and resumes from where it stopped.
 */
export type SyncState = "COMPLETE" | "IN_PROGRESS" | "INTERRUPTED";

export interface SyncProgress {
  device: string;
  state: SyncState;
  /** The snapshot arriving, or the one held when nothing is. */
  snapshot: number;
  percent: number;
  receivedMb: number;
  sizeMb: number;
  remainingMb: number;
  /** Where an interrupted transfer picks up again. */
  resumeFromMb: number | null;
  /** The tracks the device plays from now: those of the snapshot in force, unchanged while the next one arrives. */
  playableTracks: number;
  /** The tracks of the snapshot arriving, playable only once all of it has. */
  arrivingTracks: number | null;
  lastSynced: string | null;
}

// ---------------------------------------------------------------- SCR-PLR-10 and 11

export interface CertificationRow {
  id: string;
  supplier: string;
  version: number;
  status: CertificationStatus;
  lodgedOn: string;
  decidedOn: string | null;
  validTo: string | null;
  criterion: string | null;
}

export type RegisterFilter = "all" | "certified" | "open" | "closed";

export interface CertificationRegisterView {
  rows: readonly CertificationRow[];
  counts: Readonly<Record<RegisterFilter, number>>;
  filter: RegisterFilter;
  /** The criteria versions published, the one in effect marked. */
  versions: readonly { no: number; inEffect: boolean; validityMonths: number }[];
  /** The last day the register changed. */
  updatedOn: string | null;
  criteria: readonly string[];
}

export interface ApplyInput {
  applicant: string;
  version: string;
}

export interface ApplyAttempt {
  page: "apply";
  values: ApplyInput;
  code: string | null;
  field: "applicant" | null;
  lodged: string | null;
}

export interface AssessInput {
  outcome: string;
  criterion: string;
}

export interface AssessAttempt {
  page: "assess";
  certification: string;
  values: AssessInput;
  code: string | null;
  field: "outcome" | null;
  done: CertificationStatus | null;
}

export interface AssuranceVersion {
  no: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  publishedOn: string | null;
  validityMonths: number;
  criteria: CaseText;
  authority: CaseText;
  withdrawal: CaseText;
  sections: readonly { id: string; heading: CaseText; body: readonly CaseText[] }[];
  inEffect: boolean;
}

export interface AssurancePolicyView {
  version: AssuranceVersion;
  /** The other published versions, newest first. */
  others: readonly AssuranceVersion[];
}

/** A version as the evidence console holds it: drafts and approved versions not published included. */
export interface AssuranceRecord {
  no: number;
  status: "DRAFT" | "APPROVED";
  published: boolean;
  publishedOn: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  validityMonths: number;
  criteria: CaseText;
  authority: CaseText;
  withdrawal: CaseText;
  preparedBy: string | null;
  preparedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  inEffect: boolean;
}

export interface AssuranceConsoleView {
  /** Newest first. */
  versions: readonly AssuranceRecord[];
  nextNo: number;
  today: string;
}

export interface AssuranceInput {
  criteria: string;
  authority: string;
  validityMonths: string;
  withdrawal: string;
  effectiveFrom: string;
}

/** What POLICY_VERSION_INCOMPLETE names, and the effective date a draft cannot do without. */
export type AssurancePart = "criteria" | "authority" | "validity" | "withdrawal" | "from";

export interface AssuranceAttempt {
  page: "assurance";
  values: AssuranceInput;
  code: string | null;
  part: AssurancePart | null;
  saved: number | null;
}

// ---------------------------------------------------------------- SCR-IAM-07 and 08

export interface CredentialRow {
  id: string;
  device: string;
  name: string | null;
  premises: PremisesRef;
  purpose: "PLAYBACK";
  state: CredentialState;
  since: string;
  pairedAt: string;
  lastUsedAt: string | null;
  reason: CaseText | null;
  revocation: { cause: CaseText; effectiveAt: string; by: string | null } | null;
}

export interface RegisterFilterInput {
  premises: string | null;
  state: CredentialState | null;
}

export interface DeviceRegisterView {
  asOf: string;
  /** Active first, then suspended, then revoked; the most recent use first in each. */
  rows: readonly CredentialRow[];
  totals: Readonly<Record<CredentialState, number>>;
  premisesOptions: readonly PremisesOption[];
  filter: RegisterFilterInput;
}

export interface CredentialRecordView extends CredentialRow {
  asOf: string;
  accepted: number;
  /** The premises relationship the device was paired under has ended: it cannot be reinstated. */
  relationshipEnded: boolean;
}

export type CredentialAct = "suspend" | "reinstate" | "revoke";

export interface CredentialAttempt {
  page: "credential";
  credential: string;
  act: CredentialAct;
  values: { text: string; effectiveAt: string };
  code: string | null;
  field: string | null;
  done: boolean;
}

// ---------------------------------------------------------------- the loaders

function answer<T>(view: PlayerView | null, read: () => LoadOutcome<T>, drawn: (view: PlayerView, data: T) => T | null = () => null): Promise<LoadOutcome<T>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === null) return Promise.resolve(read());
  const failure = reviewFailure<T>(view);
  if (failure !== null) return Promise.resolve(failure);
  const outcome = read();
  const data = outcome.data === null ? null : drawn(view, outcome.data);
  return Promise.resolve(data === null ? outcome : { data, failure: null });
}

/** SCR-PLR-01: GET /player/devices with the filter. */
export function loadDeviceEstate(staff: Staff, filter: EstateFilter, view: PlayerView | null): Promise<LoadOutcome<DeviceEstate>> {
  return answer(view, () => deviceEstate(staff, filter), (v, data) => (v === "empty" ? { ...data, rows: [], total: 0, counts: {}, expired: [] } : null));
}

/** SCR-PLR-02: GET /player/devices/{id}. */
export function loadDeviceRecord(staff: Staff, device: string, view: PlayerView | null): Promise<LoadOutcome<DeviceRecord>> {
  return answer(view, () => deviceRecord(staff, device));
}

/** SCR-PLR-03: the suppliers with their certification, and the premises a device may be enrolled for. */
export function loadEnrolForm(staff: Staff, view: PlayerView | null): Promise<LoadOutcome<EnrolFormData>> {
  return answer(view, () => enrolForm(staff));
}

/** SCR-PLR-07: GET /player/playback-events, the latest batch from a device. */
export function loadAcceptance(staff: Staff, device: string | null, view: PlayerView | null): Promise<LoadOutcome<AcceptanceView>> {
  return answer(view, () => acceptanceView(staff, device));
}

/** SCR-PLR-15: a device's playback decisions for one local day. */
export function loadDecisions(staff: Staff, asked: { device: string | null; day: string | null; kind: string | null }, view: PlayerView | null): Promise<LoadOutcome<DecisionsView>> {
  return answer(view, () => decisionsView(staff, asked));
}

/** SCR-PLR-13: the version in effect, those approved for later, the latest draft, and the limit a session opening now gets. */
export function loadOfflinePolicy(staff: Staff, view: PlayerView | null): Promise<LoadOutcome<OfflinePolicyView>> {
  return answer(view, () => offlinePolicy(staff));
}

/** SCR-PLR-15's rule set on the evidence console: every version, to draft the next and approve a draft. */
export function loadRuleSets(staff: Staff, view: PlayerView | null): Promise<LoadOutcome<RuleSetView>> {
  return answer(view, () => ruleSetView(staff));
}

/** SCR-PLR-11 on the evidence console: every version, drafts and unpublished ones included. */
export function loadAssuranceConsole(staff: Staff, view: PlayerView | null): Promise<LoadOutcome<AssuranceConsoleView>> {
  return answer(view, () => assuranceConsole(staff));
}

/** SCR-PLR-04: GET /sync/progress for a device of the premises the reader acts for. */
export function loadSyncProgress(reader: Reader, device: string): Promise<LoadOutcome<SyncProgress>> {
  return answer(null, () => syncProgress(reader.sessionId, reader.organisation, device));
}

/** SCR-PLR-10: GET /player/certifications, read by anyone in the browser's world. */
export function loadCertificationRegister(world: string, filter: string | null, view: PlayerView | null): Promise<LoadOutcome<CertificationRegisterView>> {
  return answer(view, () => certificationRegister(world, filter), (v, data) => (v === "empty" ? { ...data, rows: [], counts: { all: 0, certified: 0, open: 0, closed: 0 }, updatedOn: null } : null));
}

/** SCR-PLR-11: GET /player/assurance-policy-versions, the published version asked or the one in effect, in the browser's world. */
export function loadAssurancePolicy(world: string, version: string | null, view: PlayerView | null): Promise<LoadOutcome<AssurancePolicyView>> {
  return answer(view, () => assurancePolicy(world, version));
}

/** SCR-IAM-07: GET /identity/devices with the filter. */
export function loadDeviceRegister(staff: Staff, filter: RegisterFilterInput, view: PlayerView | null): Promise<LoadOutcome<DeviceRegisterView>> {
  return answer(view, () => deviceRegister(staff, filter), (v, data) => (v === "empty" ? { ...data, rows: [], totals: { ACTIVE: 0, SUSPENDED: 0, REVOKED: 0 } } : null));
}

/** SCR-IAM-08: one credential, with the evidence recorded against the device. */
export function loadCredential(staff: Staff, credential: string, view: PlayerView | null): Promise<LoadOutcome<CredentialRecordView>> {
  return answer(view, () => credentialRecord(staff, credential));
}

// ---------------------------------------------------------------- the commands

const command = <T,>(run: () => CommandAnswer<T>): Promise<LoadOutcome<CommandAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/** POST /player/devices: the device ENROLLED, or DEVICE_ALREADY_ENROLLED with the device it belongs to. */
export function sendEnrolment(staff: Staff, input: EnrolInput): Promise<LoadOutcome<CommandAnswer<{ device: string }>>> {
  return command(() => enrolDevice(staff, input));
}

/** POST /player/devices/{id}/conditions, or /transfer for a transfer: the condition, from when, and whether it is in force yet. */
export function sendCondition(
  staff: Staff,
  device: string,
  input: ConditionInput,
): Promise<LoadOutcome<CommandAnswer<{ status: DeviceStatus; effectiveFrom: string; inForce: boolean }>>> {
  return command(() => recordCondition(staff, device, input));
}

/** POST /player/offline-continuity-policy-versions: a new version in DRAFT. */
export function sendOfflineDraft(staff: Staff, input: OfflineInput): Promise<LoadOutcome<CommandAnswer<{ no: number }>>> {
  return command(() => draftOfflinePolicy(staff, input));
}

/** POST /player/offline-continuity-policy-versions/{id}/approve, with the note the audit record keeps. */
export function sendOfflineApproval(staff: Staff, no: number, note: string): Promise<LoadOutcome<CommandAnswer<{ no: number; effectiveFrom: string }>>> {
  return command(() => approveOfflinePolicy(staff, no, note));
}

/** POST /player/assurance-policy-versions: a new version in DRAFT. */
export function sendAssuranceDraft(staff: Staff, input: AssuranceInput): Promise<LoadOutcome<CommandAnswer<{ no: number }>>> {
  return command(() => draftAssurancePolicy(staff, input));
}

/** POST /player/assurance-policy-versions/{id}/approve: approved, and published or not. */
export function sendAssuranceApproval(staff: Staff, no: number, publish: boolean): Promise<LoadOutcome<CommandAnswer<{ no: number; published: boolean }>>> {
  return command(() => approveAssurancePolicy(staff, no, publish));
}

/** POST /player/playback-rule-set-versions: a new version in DRAFT. */
export function sendRuleSetDraft(staff: Staff, input: RuleSetInput): Promise<LoadOutcome<CommandAnswer<{ no: number }>>> {
  return command(() => draftRuleSet(staff, input));
}

/** POST /player/playback-rule-set-versions/{id}/approve, with the note the audit record keeps. */
export function sendRuleSetApproval(staff: Staff, no: number, note: string): Promise<LoadOutcome<CommandAnswer<{ no: number; effectiveFrom: string }>>> {
  return command(() => approveRuleSet(staff, no, note));
}

/** POST /player/certifications, by a supplier with no account, in the browser's world. */
export function sendApplication(world: string, input: ApplyInput): Promise<LoadOutcome<CommandAnswer<{ id: string }>>> {
  return command(() => applyForCertification(world, input));
}

/** POST /player/certifications/{id}/assess. */
export function sendAssessment(staff: Staff, certification: string, input: AssessInput): Promise<LoadOutcome<CommandAnswer<{ status: CertificationStatus }>>> {
  return command(() => assessCertification(staff, certification, input));
}

/** POST /identity/devices/{id}/suspend. */
export function sendSuspension(staff: Staff, credential: string, reason: string): Promise<LoadOutcome<CommandAnswer<{ state: CredentialState }>>> {
  return command(() => suspendCredential(staff, credential, reason));
}

/** POST /identity/devices/{id}/reinstate. */
export function sendReinstatement(staff: Staff, credential: string, reason: string): Promise<LoadOutcome<CommandAnswer<{ state: CredentialState }>>> {
  return command(() => reinstateCredential(staff, credential, reason));
}

/**
 * POST /identity/devices/{id}/revoke: the cause, and when it takes effect (now when left empty). A request that also
 * asks for the device's evidence to be removed or amended is revoked and answered EVIDENCE_RETENTION_IN_FORCE.
 */
export function sendRevocation(
  staff: Staff,
  credential: string,
  cause: string,
  effectiveAt: string,
  evidence: EvidenceChange | null = null,
): Promise<LoadOutcome<CommandAnswer<{ state: CredentialState }>>> {
  return command(() => revokeCredential(staff, credential, cause, effectiveAt, evidence));
}
