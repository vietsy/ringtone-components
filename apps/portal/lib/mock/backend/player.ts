import { createHash, randomInt } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  AcceptanceView,
  ApplyInput,
  AssessInput,
  AssuranceConsoleView,
  AssuranceInput,
  AssurancePart,
  AssurancePolicyView,
  AssuranceRecord,
  AssuranceVersion,
  CertificationRegisterView,
  CertificationRow,
  CertificationStatus,
  ConditionInput,
  ConditionRow,
  CredentialRecordView,
  CredentialRow,
  CredentialState,
  DecisionKind,
  DecisionsView,
  DeviceEstate,
  DeviceRecord,
  DeviceRegisterView,
  DeviceStatus,
  EnrolFormData,
  EvidenceDecision,
  EnrolInput,
  EstateFilter,
  EstateRow,
  OfflineInput,
  OfflinePart,
  OfflinePolicyView,
  OfflineVersion,
  Officer,
  PremisesOption,
  RegisterFilter,
  RegisterFilterInput,
  RuleSetField,
  RuleSetInput,
  RuleSetVersion,
  RuleSetView,
  SnapshotStatus,
  SupplierCertification,
  SyncProgress,
  TransferEvidence,
} from "@/lib/api/player";
import type { ChangeCause } from "@/lib/api/premises-terms";
import type { Staff } from "@/lib/api/session";
import type {
  CaseText,
  CommandAnswer,
  DeviceCondition,
  DeviceRow,
  EntitlementStatus,
  GuestViewData,
  PairingRow,
  PairingState,
  PairingStep,
  PremisesRef,
  ServiceViewData,
  VenueViewData,
} from "@/lib/api/venue";
import {
  ASSURANCE_VERSIONS,
  BATCHES,
  CAUSES,
  CERTIFICATIONS,
  CREDENTIALS,
  CRITERIA,
  DECISION_DAYS,
  OFFLINE_VERSIONS,
  OTHER_PREMISES,
  PLR_DEVICES,
  RULE_SET_VERSIONS,
  SNAPSHOTS,
  type SeedAssuranceVersion,
  type SeedBatch,
  type SeedCertification,
  type SeedCondition,
  type SeedCredential,
  type SeedDecisionDay,
  type SeedPlrDevice,
  type SeedRuleSetVersion,
  type SeedSession,
  type SeedSnapshot,
} from "../player";
import { EVIDENCE_CEILING, OFFLINE_LIMIT_HOURS, PAIRINGS, PREMISES, TRACKS, type SeedPairing } from "../venue";
import { findAccount } from "./accounts";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { officeDestinationOf, recordNoticeEvent } from "./notices";
import { actingAs, mayActFor, premisesActableBy, recordActUnderAuthority } from "./parties";
import { operatesNow, premisesRelationshipAt } from "./premises";
import { printedCodeOf } from "./public";
import { sessions, table } from "./store";
import { currentDocument, periodAt, premisesName, servicePublicStatus } from "./venue";

/*
 * Two families the Player device belongs to, each in its own tables. PLR ("plr"): the device estate and each
 * device's conditions (SM-200), the device-assurance certifications (SM-202), the evidence batches a device sent,
 * its playback decisions and the offline-continuity policy. IAM ("iam-pairing", "iam-credentials"): the pairing
 * authorisations a premises principal issues (SCR-IAM-06), and the credential a device holds once it has paired
 * (SM-152, SCR-IAM-07 and 08).
 *
 * The device itself never acts in the mock: its screens (SCR-PLR-16 to 18, pairing among them) are the Android
 * app's, so a code a principal issues stays waiting, and each device keeps the report its board draws. Delivery to a device stops whenever the premises' Player service is not ACTIVE, which PLR
 * reads from VEN at every delivery (IServiceEntitlementReader.StatusAt, srs/06): a device that is offline plays on
 * from what it holds until its offline limit, as SCR-PLR-04 draws.
 */

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const accept = <T,>(accepted: T): CommandAnswer<T> => ({ accepted, refusal: null });
const refuse = (code: string, field: string | null = null, item: number | null = null): CommandAnswer<never> => ({ accepted: null, refusal: { code, field, item } });

const holds = (staff: Staff, ...roles: readonly string[]) => roles.some((role) => (staff.roles as readonly string[]).includes(role));
/** Who recorded an act: the operations officer, or the security officer where that is the role they hold (PERM-473). */
const officer = (staff: Staff): Officer => ({ name: staff.account, role: !holds(staff, "ACT-OPS") && holds(staff, "ACT-SEC") ? "security" : "operations" });
const same = (value: string): CaseText => ({ vi: value, en: value });

// ---------------------------------------------------------------- the premises, as PTY answers

/** A premises' name: Then Cửa Việt's from the registration family, another operator's from PTY's register. */
function premisesRef(key: string, id: string): PremisesRef {
  return { id, name: premisesName(key, id) ?? OTHER_PREMISES.find((premises) => premises.id === id)?.name ?? id };
}

function premisesOption(key: string, id: string): PremisesOption {
  const area = PREMISES.find((premises) => premises.id === id)?.area ?? OTHER_PREMISES.find((premises) => premises.id === id)?.area ?? null;
  return { ...premisesRef(key, id), area };
}

const partyOf = (id: string): string | null => PREMISES.find((premises) => premises.id === id)?.party ?? OTHER_PREMISES.find((premises) => premises.id === id)?.party ?? null;

/**
 * The premises relationship of the party the device was paired for has ended in PTY's register (DR-201 row 7): a
 * closure, a cessation or a change of operator recorded on SCR-PTY-09 (FR-PTY-039). A premises the party never operated
 * is NONE, an enquiry about the wrong premises, and not this (FR-IAM-020).
 */
const relationshipEnded = (key: string, id: string): boolean => {
  const party = partyOf(id);
  return party !== null && premisesRelationshipAt(key, id, { organisation: party }).kind === "ENDED";
};

/** IServiceEntitlementReader.StatusAt, now: delivery is permitted only while the premises' Player service is ACTIVE. */
const serviceInForce = (key: string, premisesId: string): boolean => servicePublicStatus(key, premisesId)?.status === "ACTIVE";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "vi");

// ---------------------------------------------------------------- PLR's tables

/**
 * A condition as PLR holds it (`player.device_conditions`): besides the seed's, when a loss was reported, where a
 * transfer goes and what it decided for the evidence the device held. Its effects - IAM's revocation, the quarantine,
 * the move - are applied once it is in force, and only once: a condition recorded for a time still to come leaves the
 * one before it in force until then, as venue.ts plays VEN's due transitions on every read.
 */
interface Condition extends SeedCondition {
  reportedAt: string | null;
  premisesTo: string | null;
  evidence: { decision: EvidenceDecision; count: number | null; ground: string | null; former: string } | null;
  settled: boolean;
}

interface Device extends Omit<SeedPlrDevice, "conditions" | "session"> {
  conditions: Condition[];
  session: SeedSession | null;
}

type Certification = SeedCertification;
/** A batch, attributed to the premises its events were played at, which a transfer does not change. */
type Batch = SeedBatch & { premisesId: string };
/** A snapshot a device holds or is receiving (SM-203), for the premises it was issued for. */
type Snapshot = SeedSnapshot & { premisesId: string; status: SnapshotStatus };
/** A device-assurance policy version as the evidence operator holds it; the seed's versions are approved and published. */
type Assurance = Omit<SeedAssuranceVersion, "sections"> &
  Pick<AssuranceRecord, "status" | "published" | "preparedBy" | "preparedAt" | "approvedBy" | "approvedAt"> & { sections: SeedAssuranceVersion["sections"] };
type RuleSet = SeedRuleSetVersion & { effectiveTo: string | null };

/**
 * The module's audit log (frd/11): who did what and when, what the act must carry (the device identity, premises and
 * supplier of an enrolment; the condition, cause, effective and reported instants of a condition; the applicant,
 * version, outcome and criterion of an assessment; the cause and count of a quarantine), and an approval's note, which
 * no column holds. Null actor where RightOne acted on a recorded event.
 */
export interface PlayerAuditRow {
  at: string;
  actor: string | null;
  act: string;
  subject: string;
  note: string | null;
  detail: Readonly<Record<string, string>>;
}

type AuditRow = PlayerAuditRow;

interface PlrState {
  devices: Map<string, Device>;
  certifications: Map<string, Certification>;
  batches: Batch[];
  snapshots: Snapshot[];
  decisions: SeedDecisionDay[];
  offline: OfflineVersion[];
  assurance: Assurance[];
  rules: RuleSet[];
  /** The last disposition number raised, for the next quarantine. */
  dispositions: number;
  audit: AuditRow[];
}

const seededCondition = (condition: SeedCondition): Condition => ({ ...condition, reportedAt: null, premisesTo: null, evidence: null, settled: true });

/** The seed's snapshots: a device's latest whole one is in force, an earlier one superseded, one still arriving received. */
function seededSnapshots(): Snapshot[] {
  return SNAPSHOTS.map((snapshot) => {
    const premisesId = PLR_DEVICES.find((device) => device.id === snapshot.device)?.premisesId ?? "";
    const whole = SNAPSHOTS.filter((other) => other.device === snapshot.device && other.receivedMb === other.sizeMb);
    const status: SnapshotStatus =
      snapshot.receivedMb < snapshot.sizeMb ? "SYNCED" : whole.every((other) => other.version <= snapshot.version) ? "IN_FORCE" : "SUPERSEDED";
    return { ...snapshot, premisesId, status };
  });
}

function seedPlr(): PlrState {
  return {
    devices: new Map(
      PLR_DEVICES.map((device) => [device.id, { ...device, conditions: device.conditions.map(seededCondition), session: device.session === null ? null : { ...device.session } }]),
    ),
    certifications: new Map(CERTIFICATIONS.map((certification) => [certification.id, { ...certification }])),
    batches: BATCHES.map((batch) => ({ ...batch, premisesId: PLR_DEVICES.find((device) => device.id === batch.device)?.premisesId ?? "" })),
    snapshots: seededSnapshots(),
    decisions: [...DECISION_DAYS],
    offline: OFFLINE_VERSIONS.map((version) => ({ ...version })),
    assurance: ASSURANCE_VERSIONS.map((version) => ({
      ...version,
      status: "APPROVED" as const,
      published: true,
      preparedBy: null,
      preparedAt: null,
      approvedBy: null,
      approvedAt: null,
    })),
    rules: RULE_SET_VERSIONS.map((version) => ({ ...version, effectiveTo: null })),
    dispositions: 103,
    audit: [],
  };
}

/** PLR's tables in the world, with every condition that has come due since the last read in force. */
function playerState(key: string): PlrState {
  const s = table(key, "plr", seedPlr);
  settle(key, s, now());
  return s;
}

const ms = (instant: string) => Date.parse(instant);

/** The condition in force at an instant: the latest recorded whose effective time has come. */
function inForceAt(device: Device, instant: string): Condition {
  const due = device.conditions.filter((condition) => ms(condition.effectiveFrom) <= ms(instant));
  const found = due[due.length - 1] ?? device.conditions[0];
  if (found === undefined) throw new Error(`${device.id} holds no condition`);
  return found;
}

const inForce = (device: Device): Condition => inForceAt(device, now());

/** The latest condition recorded, in force or still to come: the next one follows it and may not reach back before it. */
function latest(device: Device): Condition {
  const last = device.conditions[device.conditions.length - 1];
  if (last === undefined) throw new Error(`${device.id} holds no condition`);
  return last;
}

const statusOf = (device: Device): DeviceStatus => inForce(device).status;

/** A condition RightOne records itself, as a device becoming active is. */
const systemCondition = (status: DeviceStatus, instant: string, by: Officer | null): Condition => ({
  status,
  effectiveFrom: instant,
  recordedAt: instant,
  recordedBy: by,
  cause: null,
  reportedBy: null,
  reportedAt: null,
  premisesTo: null,
  evidence: null,
  settled: true,
});

// ---------------------------------------------------------------- IAM's tables

/** Who asked for an authorisation (`issued_by`): the principal or the delegate signed in when it was issued. */
export interface PairingIssuer {
  name: string;
  person: string;
  actor: "PRINCIPAL" | "DELEGATE";
}

interface Authorisation extends SeedPairing {
  /** SHA-256 of the value; the value itself is never held. */
  hash: string | null;
  purpose: "PLAYBACK";
  issuedBy: PairingIssuer;
}

interface PairingTable {
  authorisations: Map<string, Authorisation>;
  /** Every issue, for the per-premises limit. */
  issued: { at: string; premisesId: string }[];
  /** Every request to issue, a refused one included, with the origin it came from: what CFG-196 counts. */
  attempts: { at: string; origin: string }[];
}

/** The board's codes for Pasteur were issued by Then Cửa Việt's principal, the person the business register names. */
const BOARD_ISSUER: PairingIssuer = { name: "Đỗ Thu Trang", person: "PPN-PTY-2201", actor: "PRINCIPAL" };

const pairingState = (key: string): PairingTable =>
  table(key, "iam-pairing", () => ({
    authorisations: new Map(PAIRINGS.map((pairing) => [pairing.id, { ...pairing, hash: null, purpose: "PLAYBACK" as const, issuedBy: BOARD_ISSUER }])),
    issued: [],
    attempts: [],
  }));

type Credential = SeedCredential;

/**
 * A refusal of a pairing entry point, as `identity.identity_refusals` keeps it: the code and the condition, the
 * origin and how many attempts it had made inside the CFG-196 window, who asked and for which premises. Never the
 * value, a hash or anything presented. Append-only.
 */
export interface PairingRefusal {
  occurredAt: string;
  reasonCode: string;
  route: "POST /identity/pairing-authorisations";
  origin: string;
  /** The attempts from the origin inside the window, this one included. */
  count: number;
  actor: string | null;
  premisesId: string;
}

/** An act of IAM's on an authorisation or a credential (`identity.audit_log`), performed or refused, and by whom. */
export interface IdentityAuditRow {
  at: string;
  action: "PAIRING_ISSUED" | "PAIRING_REVOKED" | "CREDENTIAL_SUSPENDED" | "CREDENTIAL_REINSTATED" | "CREDENTIAL_REVOKED" | "EVIDENCE_CHANGE";
  /** The officer or person who acted; null where RightOne acted on a recorded event. */
  actor: string | null;
  target: string;
  outcome: "performed" | "refused";
  /** What changed, or the refusal code and what it rested on; never a credential or a code. */
  detail: Readonly<Record<string, string>>;
}

/**
 * NTF-IAM-01 and NTF-IAM-02 as IAM raised them through COM (`INoticeObligations.Raise`): COM's notice where its policy
 * holds a class for the event, otherwise recorded as issued and undelivered (srs/07: COM's raising-module list does not
 * name IAM yet), the outbox row unpublished with the attempt counted. Nothing IAM did waits on it.
 */
export interface IdentityNotice {
  notice: "NTF-IAM-01" | "NTF-IAM-02";
  occurrenceRef: string;
  raisedAt: string;
  reference: string | null;
  delivery: "RAISED" | "UNDELIVERED";
  attempts: number;
  facts: Readonly<Record<string, string>>;
}

interface IdentityRecords {
  refusals: PairingRefusal[];
  audit: IdentityAuditRow[];
  notices: IdentityNotice[];
}

const identityRecords = (key: string): IdentityRecords => table(key, "iam-audit", () => ({ refusals: [], audit: [], notices: [] }));

const auditIdentity = (key: string, row: Omit<IdentityAuditRow, "at">): void => {
  identityRecords(key).audit.push({ at: now(), ...row });
};

/** NTF-IAM-01 or 02, raised with COM now, and kept with what COM answered. */
function notifyIdentity(
  key: string,
  notice: IdentityNotice["notice"],
  event: { kind: string; occurrence: string; subject: { kind: string; ref: string }; recipient: string | null },
  facts: Readonly<Record<string, string>>,
): void {
  const instant = now();
  const reference = recordNoticeEvent(key, {
    sourceModule: "IAM",
    eventKind: event.kind,
    occurrenceRef: event.occurrence,
    occurredAt: instant,
    subjectKind: event.subject.kind,
    subjectRef: event.subject.ref,
    recipientPartyId: event.recipient,
    destination: null,
    facts: { ...facts, by: today() },
  });
  identityRecords(key).notices.push({ notice, occurrenceRef: event.occurrence, raisedAt: instant, reference, delivery: reference === null ? "UNDELIVERED" : "RAISED", attempts: 1, facts });
}

/** The premises event a revocation names (FR-IAM-020), as the register records its cause. */
const PREMISES_EVENT: Readonly<Record<ChangeCause, CaseText>> = {
  OPERATOR_CHANGE: { vi: "Cơ sở thay đổi người vận hành, theo sổ đăng ký cơ sở", en: "The premises changed operator, as the premises register records" },
  CLOSURE: { vi: "Cơ sở đóng cửa, theo sổ đăng ký cơ sở", en: "The premises closed, as the premises register records" },
  CESSATION: { vi: "Cơ sở chấm dứt hoạt động, theo sổ đăng ký cơ sở", en: "The premises ceased trading, as the premises register records" },
};
const RELATIONSHIP_ENDED: CaseText = { vi: "Quan hệ với cơ sở đã kết thúc, theo sổ đăng ký cơ sở", en: "The premises relationship ended, as the premises register records" };

/**
 * A credential reaches REVOKED (SM-152): from the effective time, with its cause, by the officer or by RightOne on a
 * recorded event; the audit row and NTF-IAM-02 to the premises follow. No evidence row is touched.
 */
function revokeWith(key: string, credential: Credential, revocation: { cause: CaseText; effectiveAt: string; by: string | null; event: string }): void {
  credential.state = "REVOKED";
  credential.since = revocation.effectiveAt;
  credential.revocation = { cause: revocation.cause, effectiveAt: revocation.effectiveAt, by: revocation.by };
  auditIdentity(key, { action: "CREDENTIAL_REVOKED", actor: revocation.by, target: credential.id, outcome: "performed", detail: { event: revocation.event, effective_at: revocation.effectiveAt } });
  notifyIdentity(
    key,
    "NTF-IAM-02",
    { kind: "device_credential_revoked", occurrence: `${credential.id}:REVOKED`, subject: { kind: "device_credential", ref: credential.id }, recipient: partyOf(credential.premisesId) },
    { device: credential.device, premises: premisesRef(key, credential.premisesId).name, effective: revocation.effectiveAt, event: revocation.event },
  );
}

/**
 * FR-IAM-020, played on every read as the premises register's events are: an active credential issued on a premises
 * relationship that has since ended (a change of operator, a closure, a cessation recorded on SCR-PTY-09) is revoked
 * from the first instant after the relationship's last day, naming the event; never before that day has come. A
 * suspended credential stays suspended, and its reinstatement is refused PREMISES_RELATIONSHIP_ENDED, as
 * @AC-FR-IAM-008-06 reads a credential held across the end of its relationship. Every credential is marked before any
 * notice is raised, so a read the notice makes finds nothing left to revoke.
 */
function revokeOnPremisesEvents(key: string, credentials: Map<string, Credential>): void {
  const due: { credential: Credential; cause: ChangeCause | null; effectiveAt: string }[] = [];
  for (const credential of credentials.values()) {
    const party = credential.state === "ACTIVE" ? partyOf(credential.premisesId) : null;
    if (party === null) continue;
    const relationship = premisesRelationshipAt(key, credential.premisesId, { organisation: party });
    if (relationship.kind !== "ENDED" || relationship.endedOn === "") continue;
    const effectiveAt = new Date(`${addDays(relationship.endedOn, 1)}T00:00:00+07:00`).toISOString();
    if (ms(credential.pairedAt) >= ms(effectiveAt)) continue;
    credential.state = "REVOKED";
    due.push({ credential, cause: relationship.cause, effectiveAt });
  }
  for (const { credential, cause, effectiveAt } of due) {
    revokeWith(key, credential, { cause: cause === null ? RELATIONSHIP_ENDED : PREMISES_EVENT[cause], effectiveAt, by: null, event: cause ?? "RELATIONSHIP_ENDED" });
  }
}

/** IAM's credentials in the world, with each one whose premises relationship has ended since the last read revoked. */
function credentialState(key: string): Map<string, Credential> {
  const credentials = table(key, "iam-credentials", () => new Map(CREDENTIALS.map((credential) => [credential.id, { ...credential }])));
  revokeOnPremisesEvents(key, credentials);
  return credentials;
}

/** The device's latest credential: the one it pairs under now, or the one last revoked. */
function credentialOf(key: string, device: string): Credential | null {
  const all = [...credentialState(key).values()].filter((credential) => credential.device === device);
  return all.sort((a, b) => b.pairedAt.localeCompare(a.pairedAt))[0] ?? null;
}

/**
 * The credential a device acts under, as PLR and VEN read it: its state, and whether delivery reaches it now. Exported
 * for the premises pages, which say a device revoked or held where they draw it (SCR-PLR-04).
 */
export function deviceCredentialState(key: string, device: string): { credential: CredentialState | null; delivery: "PERMITTED" | "STOPPED" } {
  const found = playerState(key).devices.get(device);
  const credential = credentialOf(key, device)?.state ?? null;
  const permitted = found !== undefined && credential === "ACTIVE" && serviceInForce(key, found.premisesId);
  return { credential, delivery: permitted ? "PERMITTED" : "STOPPED" };
}

// ---------------------------------------------------------------- SM-202, certification as it stands today

function certificationStatus(certification: Certification, day: string): CertificationStatus {
  return certification.status === "CERTIFIED" && certification.validTo !== null && certification.validTo < day ? "EXPIRED" : certification.status;
}

const lastTouched = (certification: Certification) => certification.decidedOn ?? certification.lodgedOn;

/** A supplier's standing: a certification in force if it holds one, else its latest application's outcome. */
function supplierCertification(s: PlrState, supplier: string): SupplierCertification {
  const day = today();
  const mine = [...s.certifications.values()].filter((certification) => certification.supplier === supplier);
  const current = mine.find((certification) => certificationStatus(certification, day) === "CERTIFIED");
  const latest = current ?? mine.sort((a, b) => lastTouched(b).localeCompare(lastTouched(a)))[0];
  if (latest === undefined) return { supplier, status: null, validTo: null, decidedOn: null, criterion: null };
  return { supplier, status: certificationStatus(latest, day), validTo: latest.validTo, decidedOn: latest.decidedOn, criterion: latest.criterion };
}

const certified = (s: PlrState, supplier: string) => supplierCertification(s, supplier).status === "CERTIFIED";

/**
 * DR-215: an enrolled (or transferred) device becomes ACTIVE once its supplier holds a current certification and the
 * device is paired with the premises it is enrolled at. RightOne records the change, not an officer.
 */
function activate(key: string, s: PlrState, device: Device, instant: string): void {
  const status = statusOf(device);
  if (status !== "ENROLLED" && status !== "TRANSFERRED") return;
  const credential = credentialOf(key, device.id);
  if (credential?.state !== "ACTIVE" || credential.premisesId !== device.premisesId || !certified(s, device.supplier)) return;
  device.conditions.push(systemCondition("ACTIVE", instant, null));
}

// ---------------------------------------------------------------- the offline limit (DR-218)

/** A version of a governed policy, whose approved versions never share a day. */
interface Governed {
  no: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "DRAFT" | "APPROVED";
}

/** The approved version of a governed policy in effect on a day, if any. */
function versionOn<T extends Governed>(versions: readonly T[], day: string): T | null {
  return versions.find((version) => version.status === "APPROVED" && version.effectiveFrom <= day && (version.effectiveTo === null || day < version.effectiveTo)) ?? null;
}

/**
 * The approved version a candidate would share a day with: one starting on or after it (the candidate's period runs
 * open from its start), or one whose closed period runs past its start. An open period before it is not an overlap:
 * approving closes it.
 */
function overlapping<T extends Governed>(versions: readonly T[], candidate: T): T | null {
  return (
    versions.find(
      (version) =>
        version.status === "APPROVED" &&
        version.no !== candidate.no &&
        (version.effectiveFrom >= candidate.effectiveFrom || (version.effectiveTo !== null && version.effectiveTo > candidate.effectiveFrom)),
    ) ?? null
  );
}

/** Approving a version closes the open period of the one before it at the new version's start. */
function closePrevious<T extends Governed>(versions: readonly T[], candidate: T): void {
  for (const version of versions) {
    if (version.status === "APPROVED" && version.no !== candidate.no && version.effectiveTo === null && version.effectiveFrom < candidate.effectiveFrom) {
      version.effectiveTo = candidate.effectiveFrom;
    }
  }
}

/** The day of an instant in Vietnam time. */
const dayOf = (instant: string) => addDays(instant, 0);

/**
 * DR-218 by ALG-196: a session is bounded by the approved offline-continuity version in force when it opened, its
 * maximum plus its grace, from the policy; before one is in force, by the shortest limit the snapshot carries (the
 * interim rule of BR-PLR-19, CFG-258's 72 hours in every seeded snapshot).
 */
function offlineLimit(s: PlrState, opened: string): { hours: number; source: "policy" | "snapshot"; version: number | null } {
  const policy = versionOn(s.offline, dayOf(opened));
  return policy === null
    ? { hours: OFFLINE_LIMIT_HOURS, source: "snapshot", version: null }
    : { hours: policy.maxOfflineHours + policy.graceHours, source: "policy", version: policy.no };
}

// ---------------------------------------------------------------- the premises portal: SCR-PLR-04, 05, 06 and VEN-10

const trackOf = (id: string | null) => (id === null ? null : (TRACKS.find((track) => track.id === id) ?? null));

/** The portal's four conditions: a device playing, synchronising or reporting a fault is connected. */
function venueCondition(session: SeedSession): DeviceCondition {
  if (session.state === "OFFLINE" || session.state === "CEILING" || session.state === "LIMIT_REACHED") return session.state;
  return "ONLINE";
}

const connected = (session: SeedSession) => session.state !== "OFFLINE" && session.state !== "LIMIT_REACHED";

/**
 * Nothing reaches the device: its credential is held or revoked, or, while it is connected, the premises' service is
 * not ACTIVE. An offline device plays on from what it holds until its limit.
 */
function deliveryStopped(key: string, device: Device, session: SeedSession): boolean {
  if (credentialOf(key, device.id)?.state !== "ACTIVE") return true;
  return connected(session) && !serviceInForce(key, device.premisesId);
}

/** The premises of a party that the reader may see devices of. */
const premisesIds = (organisation: string) => new Set(PREMISES.filter((premises) => premises.party === organisation).map((premises) => premises.id));

/** The devices that report, each with its report. */
function reporting(s: PlrState): (Device & { session: SeedSession })[] {
  return [...s.devices.values()].filter((device): device is Device & { session: SeedSession } => device.session !== null);
}

/** The devices of the premises the party acts for, as each last reported. */
export function deviceList(key: string, organisation: string): LoadOutcome<readonly DeviceRow[]> {
  const mine = premisesIds(organisation);
  return ok(
    reporting(playerState(key))
      .filter((device) => mine.has(device.premisesId))
      .map((device) => ({ id: device.id, name: device.name, premises: premisesRef(key, device.premisesId), condition: venueCondition(device.session), asOf: device.session.asOf })),
  );
}

/** Hours of offline playback left at the device's report, against the policy's limit. */
function remainingHours(session: SeedSession): number {
  if (session.stopsAt === null) return 0;
  return Math.max(0, Math.round(((Date.parse(session.stopsAt) - Date.parse(session.asOf)) / 3_600_000) * 10) / 10);
}

/**
 * An offline session against the limit DR-218 derives for it: it opened when the device last had contact, and the limit
 * runs from there, with its source and the policy version applied as the session records them (AC-FR-PLR-050-02).
 */
function offlineWindow(
  s: PlrState,
  session: SeedSession,
): { limitHours: number; source: "policy" | "snapshot"; version: number | null; graceHours: number; stopsAt: string; remainingHours: number } {
  const limit = offlineLimit(s, session.lastContact);
  const graceHours = s.offline.find((version) => version.no === limit.version)?.graceHours ?? 0;
  const stopsAt = new Date(Date.parse(session.lastContact) + limit.hours * 3_600_000).toISOString();
  return { limitHours: limit.hours, source: limit.source, version: limit.version, graceHours, stopsAt, remainingHours: remainingHours({ ...session, stopsAt }) };
}

/** GET /devices/{id}/venue-view: the session state, the limit remaining and the evidence backlog. */
export function venueView(key: string, organisation: string, id: string): LoadOutcome<VenueViewData> {
  const s = playerState(key);
  const device = s.devices.get(id);
  // A device of another party is refused as one the reader may not see (PERM-502).
  if (device === undefined || device.session === null || !premisesIds(organisation).has(device.premisesId)) return refusedRead("NOT_AUTHORISED");
  const session = device.session;
  const condition = venueCondition(session);
  const stopped = deliveryStopped(key, device, session);
  const track = stopped || condition === "LIMIT_REACHED" ? null : trackOf(session.playing);
  const period = condition === "ONLINE" && !stopped ? periodAt(key, device.premisesId, session.asOf) : null;
  return ok({
    device: { id: device.id, name: device.name },
    premises: premisesRef(key, device.premisesId),
    condition,
    asOf: session.asOf,
    evidence: { waiting: session.waiting, oldest: session.oldest, ceiling: EVIDENCE_CEILING },
    offline:
      condition === "OFFLINE" || condition === "LIMIT_REACHED"
        ? { ...offlineWindow(s, session), lastContact: session.lastContact, reachedAt: session.reachedAt }
        : null,
    lastSynced: session.lastSynced,
    playing:
      track === null
        ? null
        : {
            title: track.title,
            by: track.by,
            credits: track.credits,
            period: period === null || period.playlist === null ? null : { playlist: period.playlist, start: period.start, end: period.end },
          },
  });
}

// ---------------------------------------------------------------- SCR-PLR-04's synchronisation (GET /sync/progress)

/**
 * The share of a snapshot's audio a connected device receives between two reads. The device never acts in the mock,
 * so its transfer moves on each time the premises reads it, as if it had been running in between.
 */
const TRANSFER_STEP = 0.2;

const snapshotsOf = (s: PlrState, device: string) => s.snapshots.filter((snapshot) => snapshot.device === device);

/**
 * GET /sync/progress for a device of the premises the reader acts for: the snapshot arriving, how much of its audio
 * has, what is left and where an interrupted transfer resumes. The device plays from the snapshot it holds until all
 * of the next has arrived (AC-FR-PLR-027-02, -03): a part-arrived track is never played. A transfer moves only while
 * the device is connected and delivery reaches it; otherwise it waits where it stopped, never starting again.
 */
export function syncProgress(key: string, organisation: string, id: string): LoadOutcome<SyncProgress> {
  const s = playerState(key);
  const device = s.devices.get(id);
  // PERM-481 names the premises principal alone, where the venue view (PERM-502) admits a delegate too; and the
  // principal reads their own devices only, as the venue view does.
  if (actingAs(key)?.actor !== "PRINCIPAL") return refusedRead("NOT_AUTHORISED");
  if (device === undefined || device.session === null || !premisesIds(organisation).has(device.premisesId)) return refusedRead("NOT_AUTHORISED");
  const session = device.session;
  const held = snapshotsOf(s, id).find((snapshot) => snapshot.status === "IN_FORCE") ?? null;
  const arriving = snapshotsOf(s, id).find((snapshot) => snapshot.status === "SYNCED") ?? null;
  const playableTracks = held?.tracks ?? 0;
  if (arriving === null) {
    const size = held?.sizeMb ?? 0;
    return ok({
      device: id,
      state: "COMPLETE",
      snapshot: held?.version ?? 0,
      percent: 100,
      receivedMb: size,
      sizeMb: size,
      remainingMb: 0,
      resumeFromMb: null,
      playableTracks,
      arrivingTracks: null,
      lastSynced: session.lastSynced,
    });
  }
  const moving = connected(session) && !deliveryStopped(key, device, session);
  const answer: SyncProgress = {
    device: id,
    state: moving ? "IN_PROGRESS" : "INTERRUPTED",
    snapshot: arriving.version,
    percent: Math.floor((arriving.receivedMb / arriving.sizeMb) * 100),
    receivedMb: arriving.receivedMb,
    sizeMb: arriving.sizeMb,
    remainingMb: arriving.sizeMb - arriving.receivedMb,
    resumeFromMb: moving ? null : arriving.receivedMb,
    playableTracks,
    arrivingTracks: arriving.tracks,
    lastSynced: session.lastSynced,
  };
  // Read, then move on: the reader sees where the transfer stood, the next read finds it further on.
  if (moving) advance(session, arriving, held);
  return ok(answer);
}

/** The transfer moves on by a step; complete, the snapshot comes into force and the one it replaces is superseded. */
function advance(session: SeedSession, arriving: Snapshot, held: Snapshot | null): void {
  arriving.receivedMb = Math.min(arriving.sizeMb, arriving.receivedMb + Math.ceil(arriving.sizeMb * TRANSFER_STEP));
  if (arriving.receivedMb < arriving.sizeMb) return;
  arriving.status = "IN_FORCE";
  if (held !== null) held.status = "SUPERSEDED";
  session.lastSynced = now();
  if (session.state === "SYNCING") session.state = "PLAYING";
}

/**
 * The device a premises' guest display and service view speak for: one that still holds its credential, playing
 * if any is, else the latest to report.
 */
function deviceAt(key: string, premisesId: string): (Device & { session: SeedSession }) | null {
  const rank = (device: Device & { session: SeedSession }) => (credentialOf(key, device.id)?.state === "ACTIVE" ? 0 : 1) * 2 + (device.session.playing !== null ? 0 : 1);
  return (
    reporting(playerState(key))
      .filter((device) => device.premisesId === premisesId)
      .sort((a, b) => rank(a) - rank(b) || b.session.asOf.localeCompare(a.session.asOf))[0] ?? null
  );
}

/** The device line of SCR-VEN-10 (GET /premises/{id}/service-view's `device` and `now_playing`), read by VEN. */
export function deviceSummary(key: string, premisesId: string): ServiceViewData["device"] {
  const device = deviceAt(key, premisesId);
  if (device === null) return null;
  const session = device.session;
  const stopped = deliveryStopped(key, device, session) || session.state === "LIMIT_REACHED";
  const track = stopped ? null : trackOf(session.playing);
  return {
    id: device.id,
    freshness: "CURRENT",
    asAt: session.asOf,
    connection: stopped ? "STOPPED" : session.state === "OFFLINE" ? "OFFLINE" : "ONLINE",
    playing: track === null ? null : { title: track.title, by: track.by },
  };
}

/**
 * GET /now-playing/{premisesId}: the guest's view of what the premises plays. Only the premises name, the track and
 * its four credit roles, never an address, an operator or anything protected. Each optional surface answers on its
 * own: the mock holds no lyrics and connects no tip provider; verification needs the device online and a current
 * verification document, whose printed code PUB's page verifies. Nothing plays once delivery has stopped.
 */
export function nowPlaying(key: string, premisesId: string): LoadOutcome<GuestViewData> {
  const venue = premisesName(key, premisesId);
  if (venue === null) return refusedRead("NOT_FOUND");
  const unavailable = { lyrics: "unavailable", verification: "unavailable", support: "unavailable" } as const;
  const device = deviceAt(key, premisesId);
  if (device === null) return ok({ state: "NOT_PAIRED", venue: null, track: null, surfaces: unavailable, verification: null });
  const service = servicePublicStatus(key, premisesId);
  const document = currentDocument(key, premisesId);
  const verification = document === null ? null : { printedCode: printedCodeOf(document) };
  const session = device.session;
  const track = trackOf(session.playing);
  if (track === null || session.state === "LIMIT_REACHED" || deliveryStopped(key, device, session)) {
    return ok({ state: "STOPPED", venue, track: null, surfaces: { ...unavailable, verification: verification === null ? "unavailable" : "available" }, verification });
  }
  const online = session.state !== "OFFLINE";
  const active = service?.status === "ACTIVE";
  return ok({
    state: online ? "PLAYING" : "OFFLINE",
    venue,
    track: { title: track.title, by: track.by, credits: track.credits },
    surfaces: { ...unavailable, verification: online && active && verification !== null ? "available" : "unavailable" },
    verification,
  });
}

// ---------------------------------------------------------------- IAM: SCR-IAM-06, pairing authorisations

/** CFG-195: an authorisation lasts 15 minutes from issue. */
const LIFETIME_MS = 15 * 60 * 1000;
/** CFG-196: five attempts per origin per ten minutes; and the contract's 20 an hour per premises. */
const ORIGIN_LIMIT = { count: 5, windowMs: 10 * 60 * 1000 } as const;
const PREMISES_LIMIT = { count: 20, windowMs: 60 * 60 * 1000 } as const;

/** SM-151 as at now: an issued authorisation past its expiry is expired. */
function pairingStateAt(authorisation: Authorisation, instant: string): PairingState {
  if (authorisation.revokedAt !== null) return "REVOKED";
  if (authorisation.consumedAt !== null) return "CONSUMED";
  return authorisation.expiresAt <= instant ? "EXPIRED" : "ISSUED";
}

/**
 * The premises a device may be paired to by the person signed in: those the party operates in PTY's register, where PTY
 * grants that person PERM-365 - every one for the principal, those in a delegate's scope for a delegate (FR-IAM-016).
 */
const pairable = (key: string, organisation: string) => {
  const granted = new Set(premisesActableBy(key, "PERM-365").flatMap((premises) => premises.ids));
  return PREMISES.filter((premises) => premises.party === organisation && granted.has(premises.id)).map((premises) => premisesRef(key, premises.id));
};

function pairingRow(key: string, authorisation: Authorisation, instant: string): PairingRow {
  const device = authorisation.device === null ? undefined : playerState(key).devices.get(authorisation.device);
  return {
    id: authorisation.id,
    premises: premisesRef(key, authorisation.premisesId),
    purpose: authorisation.purpose,
    issuedAt: authorisation.issuedAt,
    issuedBy: { name: authorisation.issuedBy.name, actor: authorisation.issuedBy.actor },
    expiresAt: authorisation.expiresAt,
    state: pairingStateAt(authorisation, instant),
    consumedAt: authorisation.consumedAt,
    device: device === undefined ? null : { id: device.id, name: device.name },
    revokedAt: authorisation.revokedAt,
    reason: authorisation.reason,
  };
}

/** GET /identity/pairing-authorisations for one premises the reader may pair for: never the value or its hash. */
export function pairingStep(key: string, organisation: string, premises: string | null): LoadOutcome<PairingStep> {
  const options = pairable(key, organisation);
  const chosen = options.find((option) => option.id === premises) ?? options[0];
  if (chosen === undefined) return refusedRead("AUTHORITY_NOT_IN_FORCE");
  const instant = now();
  return ok({
    premises: options,
    chosen: chosen.id,
    purposes: ["PLAYBACK"],
    items: [...pairingState(key).authorisations.values()]
      .filter((authorisation) => authorisation.premisesId === chosen.id)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .map((authorisation) => pairingRow(key, authorisation, instant)),
  });
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A pairing value: twelve characters in three blocks of four, read aloud to the installer. */
function pairingValue(): string {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return [block(), block(), block()].join(" ");
}

const hashOf = (value: string) => createHash("sha256").update(value.replace(/\s/g, "").toUpperCase()).digest("hex");

/** The origin a request comes from: in the mock, the browser, whose world every session signed in from it shares. */
const originOf = (key: string): string => sessions().get(key)?.world ?? key;

/**
 * The classes of action CFG-193 holds back until the contact channel is verified (`Q-IAM-09`, in force since 16
 * October 2026). Asking to be linked to a party is the one class P1 delivers; issuing a pairing authorisation is not
 * named, so `POST /pairing-authorisations` asks for no verified channel until the service owner adds the class.
 */
type ChannelClass = "LINK_REQUEST" | "PAIRING_AUTHORISATION";
const CHANNEL_CLASSES: readonly ChannelClass[] = ["LINK_REQUEST"];

/** DR-163: an action of a class CFG-193 names needs the address RightOne ID holds for the person to be verified now. */
function channelVerifiedFor(key: string, actionClass: ChannelClass): boolean {
  if (!CHANNEL_CLASSES.includes(actionClass)) return true;
  const email = sessions().get(key)?.email;
  return email !== undefined && findAccount(email)?.state === "active";
}

/**
 * POST /identity/pairing-authorisations, in ALG-144's order. CFG-196 counts every attempt from the origin, refused ones
 * included, before anything in the request is examined: the sixth inside ten minutes is PAIRING_RATE_LIMIT_EXCEEDED,
 * whatever it asked for, so the answer says nothing about the premises or the purpose. Then the issuing actor's
 * authority over the premises, the purpose, the relationship, a delegate's grant of PERM-365, a verified channel where
 * CFG-193 names the class, and the contract's twenty an hour per premises. Issued: one row at ISSUED holding a hash of
 * the value and who asked, the value answered once, the audit row, and NTF-IAM-01 to the premises with the premises,
 * the purpose, the expiry and who asked, never the code. A refusal writes none of them and generates no value; it is
 * recorded as a refusal with the origin and the attempt count.
 */
export function issuePairing(key: string, organisation: string, premises: string, purpose: string): CommandAnswer<{ id: string; value: string }> {
  const s = pairingState(key);
  const instant = now();
  const origin = originOf(key);
  const within = (at: string, windowMs: number) => Date.parse(instant) - Date.parse(at) < windowMs;
  s.attempts.push({ at: instant, origin });
  const count = s.attempts.filter((attempt) => attempt.origin === origin && within(attempt.at, ORIGIN_LIMIT.windowMs)).length;
  const refused = (code: string, field: string | null = null): CommandAnswer<never> => {
    identityRecords(key).refusals.push({ occurredAt: instant, reasonCode: code, route: "POST /identity/pairing-authorisations", origin, count, actor: actingAs(key)?.name ?? null, premisesId: premises });
    return refuse(code, field);
  };
  if (count > ORIGIN_LIMIT.count) return refused("PAIRING_RATE_LIMIT_EXCEEDED");
  if (!PREMISES.some((candidate) => candidate.id === premises && candidate.party === organisation)) return refused("AUTHORITY_NOT_IN_FORCE");
  if (purpose !== "PLAYBACK") return refused("FIELD_INVALID", "purpose");
  if (!operatesNow(key, organisation, premises)) return refused("FIELD_INVALID", "premises_id");
  // A delegate needs PTY's grant of PERM-365 for this premises now; any other answer is not told (@AC-FR-IAM-016-06).
  if (!mayActFor(key, premises, "PERM-365")) return refused("AUTHORITY_NOT_IN_FORCE");
  if (!channelVerifiedFor(key, "PAIRING_AUTHORISATION")) return refused("CONTACT_CHANNEL_NOT_VERIFIED");
  if (s.issued.filter((entry) => entry.premisesId === premises && within(entry.at, PREMISES_LIMIT.windowMs)).length >= PREMISES_LIMIT.count) return refused("PAIRING_RATE_LIMIT_EXCEEDED");
  const acting = actingAs(key);
  const issuedBy: PairingIssuer = { name: acting?.name ?? sessions().get(key)?.email ?? "", person: acting?.person ?? "", actor: acting?.actor ?? "PRINCIPAL" };
  let id = reference("PAU");
  while (s.authorisations.has(id)) id = reference("PAU");
  const value = pairingValue();
  const expiresAt = new Date(Date.parse(instant) + LIFETIME_MS).toISOString();
  s.authorisations.set(id, {
    id,
    premisesId: premises,
    issuedAt: instant,
    expiresAt,
    consumedAt: null,
    device: null,
    revokedAt: null,
    reason: null,
    hash: hashOf(value),
    purpose: "PLAYBACK",
    issuedBy,
  });
  s.issued.push({ at: instant, premisesId: premises });
  recordActUnderAuthority(key, premises, "PERM-365", { kind: "ISSUED_PAIRING", subject: id });
  auditIdentity(key, { action: "PAIRING_ISSUED", actor: issuedBy.name, target: id, outcome: "performed", detail: { premises, purpose: "PLAYBACK", expires_at: expiresAt } });
  notifyIdentity(
    key,
    "NTF-IAM-01",
    { kind: "pairing_authorisation_issued", occurrence: id, subject: { kind: "pairing_authorisation", ref: id }, recipient: partyOf(premises) },
    { premises: premisesRef(key, premises).name, purpose: "PLAYBACK", expires: expiresAt, asked: issuedBy.name },
  );
  return accept({ id, value });
}

/** POST /identity/pairing-authorisations/{id}/revoke: only an authorisation still issued, and with a reason. */
export function revokePairing(key: string, organisation: string, id: string, reason: string): CommandAnswer<{ id: string }> {
  // PERM-366 names the principal alone: a delegate who issued a code does not revoke one.
  if (actingAs(key)?.actor !== "PRINCIPAL") return refuse("AUTHORITY_NOT_IN_FORCE");
  const authorisation = pairingState(key).authorisations.get(id);
  if (authorisation === undefined || !pairable(key, organisation).some((premises) => premises.id === authorisation.premisesId)) return refuse("AUTHORITY_NOT_IN_FORCE");
  if (reason.trim() === "") return refuse("FIELD_MISSING", "reason");
  const instant = now();
  const current = pairingStateAt(authorisation, instant);
  if (current === "CONSUMED") return refuse("PAIRING_AUTHORISATION_CONSUMED");
  if (current === "EXPIRED") return refuse("PAIRING_AUTHORISATION_EXPIRED");
  if (current === "REVOKED") return accept({ id });
  authorisation.revokedAt = instant;
  authorisation.reason = same(reason.trim());
  auditIdentity(key, { action: "PAIRING_REVOKED", actor: actingAs(key)?.name ?? null, target: id, outcome: "performed", detail: { reason: reason.trim() } });
  return accept({ id });
}

// ---------------------------------------------------------------- SCR-PLR-01 Device estate

const notAuthorised = refusedRead("NOT_AUTHORISED");

function estateRow(key: string, s: PlrState, device: Device): EstateRow {
  const status = statusOf(device);
  const session = device.session;
  return {
    id: device.id,
    premises: premisesRef(key, device.premisesId),
    supplier: device.supplier,
    status,
    // The hours left against DR-218's limit for the session, as the venue view counts them: the policy in force when it opened.
    session: session === null ? null : { state: session.state, hoursLeft: session.state === "OFFLINE" ? Math.round(offlineWindow(s, session).remainingHours) : null },
    certification: status === "RETIRED" ? null : supplierCertification(s, device.supplier),
    waiting: status === "LOST" || status === "COMPROMISED" ? null : (session?.waiting ?? 0),
    held: device.held,
    lastContact: session?.lastContact ?? device.lastContact,
  };
}

/** The estate's order: certification end, soonest first; an ended one before none, a retired device last. */
function certificationRank(row: EstateRow): string {
  const certification = row.certification;
  if (certification === null) return "4";
  if (certification.status === "EXPIRED") return `0${certification.validTo ?? ""}`;
  if (certification.status !== "CERTIFIED") return "1";
  return `2${certification.validTo ?? ""}`;
}

/** GET /player/devices: every device with the condition in force, the filter applied. */
export function deviceEstate(staff: Staff, filter: EstateFilter): LoadOutcome<DeviceEstate> {
  if (!holds(staff, "ACT-OPS")) return notAuthorised;
  const key = staff.sessionId;
  const s = playerState(key);
  const all = [...s.devices.values()].map((device) => estateRow(key, s, device));
  const asked = filter.device?.trim().toUpperCase() ?? "";
  const rows = all
    .filter((row) => asked === "" || row.id.includes(asked))
    .filter((row) => filter.premises === null || row.premises.id === filter.premises)
    .filter((row) => filter.status === null || row.status === filter.status)
    .filter((row) => filter.supplier === null || row.supplier === filter.supplier)
    .map((row, index) => ({ row, index }))
    .sort((a, b) => certificationRank(a.row).localeCompare(certificationRank(b.row)) || a.index - b.index)
    .map(({ row }) => row);
  const counts: Partial<Record<DeviceStatus, number>> = {};
  for (const row of all) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const premises = new Map(all.map((row) => [row.premises.id, premisesOption(key, row.premises.id)]));
  return ok({
    asOf: now(),
    total: all.length,
    counts,
    rows,
    expired: all
      .filter((row) => row.status === "ACTIVE" && row.certification?.status === "EXPIRED")
      .map((row) => ({ device: row.id, supplier: row.supplier, on: row.certification?.validTo ?? "" })),
    premisesOptions: [...premises.values()].sort(byName),
    suppliers: [...new Set([...s.certifications.values()].map((certification) => certification.supplier).concat(all.map((row) => row.supplier)))].sort((a, b) => a.localeCompare(b, "vi")),
    filter,
  });
}

// ---------------------------------------------------------------- SCR-PLR-02 Device record

/** SM-200: the conditions that may follow the one in force. */
const NEXT: Readonly<Record<DeviceStatus, readonly DeviceStatus[]>> = {
  ENROLLED: [],
  ACTIVE: ["SUSPENDED", "LOST", "COMPROMISED", "TRANSFERRED", "RETIRED"],
  SUSPENDED: ["ACTIVE"],
  LOST: [],
  COMPROMISED: [],
  TRANSFERRED: [],
  RETIRED: [],
};

/** The premises of the same operator a device may move to: a transfer is between branches. */
function transferTargets(key: string, device: Device): PremisesOption[] {
  const party = partyOf(device.premisesId);
  const ids = [
    ...PREMISES.filter((premises) => premises.party === party && operatesNow(key, party, premises.id)).map((premises) => premises.id),
    ...OTHER_PREMISES.filter((premises) => premises.party === party).map((premises) => premises.id),
  ];
  return ids.filter((id) => id !== device.premisesId).map((id) => premisesOption(key, id)).sort(byName);
}

/** A transfer's decision as the record shows it, with the premises the events were played at. */
function evidenceOf(key: string, condition: Condition): TransferEvidence | null {
  const evidence = condition.evidence;
  return evidence === null ? null : { decision: evidence.decision, count: evidence.count, ground: evidence.ground, former: premisesRef(key, evidence.former) };
}

/**
 * GET /player/devices/{id}: the device, the condition in force and every other at its own dates, one recorded for a
 * time still to come among them. PERM-472 gives the read to the operations officer and the auditor; the security
 * officer, who records a loss or a compromise here (PERM-473), reads the record it is recorded on.
 */
export function deviceRecord(staff: Staff, id: string): LoadOutcome<DeviceRecord> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD", "ACT-SEC")) return notAuthorised;
  const key = staff.sessionId;
  const s = playerState(key);
  const device = s.devices.get(id);
  if (device === undefined) return refusedRead("NOT_FOUND");
  const status = statusOf(device);
  const instant = now();
  const conditions: ConditionRow[] = device.conditions
    .map((condition, index) => ({
      status: condition.status,
      from: device.conditions[index - 1]?.status ?? null,
      effectiveFrom: condition.effectiveFrom,
      effectiveTo: device.conditions[index + 1]?.effectiveFrom ?? null,
      pending: ms(condition.effectiveFrom) > ms(instant),
      recordedAt: condition.recordedAt,
      recordedBy: condition.recordedBy,
      reportedAt: condition.reportedAt,
      cause: condition.cause,
      reportedBy: condition.reportedBy,
      premisesTo: condition.premisesTo === null ? null : premisesRef(key, condition.premisesTo),
      evidence: evidenceOf(key, condition),
    }))
    .reverse();
  const credential = credentialOf(key, id);
  const next = NEXT[latest(device).status];
  const causes: Partial<Record<DeviceStatus, readonly { id: string; text: CaseText }[]>> = {};
  for (const condition of next) if (condition !== "ENROLLED") causes[condition] = CAUSES[condition];
  // The snapshot the device plays from; once a transfer superseded them all, the last it held whole, never one still arriving.
  const newest = snapshotsOf(s, id).sort((a, b) => b.version - a.version);
  const held = newest.find((snapshot) => snapshot.status === "IN_FORCE") ?? newest.find((snapshot) => snapshot.receivedMb === snapshot.sizeMb) ?? newest[0] ?? null;
  return ok({
    id: device.id,
    identity: device.identity,
    supplier: device.supplier,
    premises: premisesRef(key, device.premisesId),
    status,
    enrolledAt: device.enrolledAt,
    enrolledBy: device.enrolledBy,
    conditions,
    scheduled: conditions.find((row) => row.pending) ?? null,
    snapshot: held === null ? null : { version: held.version, status: held.status },
    waiting: device.session?.waiting ?? null,
    offlineSince: device.session?.state === "OFFLINE" ? device.session.lastContact : null,
    held: device.held,
    disposition: device.disposition,
    credentialRevokedAt: (status === "LOST" || status === "COMPROMISED") && credential?.state === "REVOKED" ? credential.since : null,
    paired: credential !== null && credential.state !== "REVOKED" && credential.premisesId === device.premisesId,
    certification: supplierCertification(s, device.supplier),
    next,
    acts: { record: holds(staff, "ACT-OPS", "ACT-SEC"), transfer: holds(staff, "ACT-OPS") },
    causes,
    transferTo: transferTargets(key, device),
  });
}

/** IAM revokes a device's credential on a recorded PLR event (a loss, a compromise, a transfer, a retirement). */
function revokeOnEvent(key: string, device: string, cause: CaseText, instant: string, event: DeviceStatus): void {
  const credential = credentialOf(key, device);
  if (credential === null || credential.state === "REVOKED") return;
  revokeWith(key, credential, { cause, effectiveAt: instant, by: null, event });
}

const STATUSES: readonly DeviceStatus[] = ["ENROLLED", "ACTIVE", "SUSPENDED", "LOST", "COMPROMISED", "TRANSFERRED", "RETIRED"];

/** A time the form sent, as an instant; null when there is none or it is no time at all. */
function instantOf(value: string): string | null {
  const typed = value.trim();
  if (typed === "" || Number.isNaN(Date.parse(typed))) return null;
  return new Date(typed).toISOString();
}

const later = (a: string, b: string) => (ms(a) >= ms(b) ? a : b);

/**
 * A notice the family's event requires, raised through COM; an event no notice class answers is kept in the audit log.
 * A notice `frd/08` addresses to the gateway's roles rather than to a party (`office`) is sent to the office COM's
 * contact register names for its class, so it is issued there rather than left UNMET for want of a party's address.
 */
function notify(
  key: string,
  s: PlrState,
  event: { kind: string; occurrence: string; subject: { kind: string; ref: string }; recipient: string | null; office?: boolean },
  facts: Readonly<Record<string, string | number>>,
): void {
  const instant = now();
  const notice = recordNoticeEvent(key, {
    sourceModule: "PLR",
    eventKind: event.kind,
    occurrenceRef: event.occurrence,
    occurredAt: instant,
    subjectKind: event.subject.kind,
    subjectRef: event.subject.ref,
    recipientPartyId: event.recipient,
    destination: event.office === true ? officeDestinationOf(key, event.kind) : null,
    facts: { ...facts, by: today() },
  });
  if (notice === null) s.audit.push({ at: instant, actor: null, act: "NOTICE_NOT_RAISED", subject: event.occurrence, note: event.kind, detail: {} });
}

/**
 * A lost or compromised device: the accepted evidence from the reported instant is quarantined under a disposition,
 * never deleted (FR-PLR-036), and NTF-PLR-03 tells the premises it is held. The mock keeps a batch's span rather than
 * each event's time, so a batch with any event at or after the instant is held whole and one wholly before it is not.
 */
function quarantine(key: string, s: PlrState, device: Device, condition: Condition): void {
  const since = s.batches.filter((batch) => batch.device === device.id && ms(batch.eventsTo) >= ms(condition.effectiveFrom));
  const accepted = since.reduce((sum, batch) => sum + (batch.outcomes.find((outcome) => outcome.kind === "ACCEPTED")?.count ?? 0), 0);
  s.dispositions += 1;
  const disposition = `DSP-${String(s.dispositions).padStart(4, "0")}`;
  device.held += accepted;
  device.disposition = disposition;
  s.audit.push({
    at: now(),
    actor: null,
    act: "QUARANTINE_RAISED",
    subject: disposition,
    note: null,
    detail: { device: device.id, cause: condition.status, from: condition.effectiveFrom, events: String(accepted) },
  });
  notify(
    key,
    s,
    { kind: "evidence_quarantined", occurrence: disposition, subject: { kind: "player_device", ref: device.id }, recipient: partyOf(device.premisesId) },
    { device: device.id, disposition, events: accepted, from: condition.effectiveFrom },
  );
}

/** The evidence policy version every seeded batch was judged under (SCR-PLR-07). */
const EVIDENCE_POLICY_VERSION = 2;

/**
 * FR-PLR-038 at the transfer time: the events the device still holds were played at the premises it leaves. Submitted,
 * they are accepted against that premises' record as one batch; discarded, they are counted on the decision with
 * its ground. Either way none becomes the new premises'. The device's report does not change in the mock, so what
 * waits at the transfer time is what waited when the decision was recorded.
 */
function settleEvidence(s: PlrState, device: Device, condition: Condition): void {
  const evidence = condition.evidence;
  const session = device.session;
  if (evidence === null) return;
  const count = session?.waiting ?? 0;
  evidence.count = count;
  if (evidence.decision !== "SUBMITTED_TO_FORMER" || count === 0 || session === null) return;
  const previous = s.batches.filter((batch) => batch.device === device.id).sort((a, b) => b.lastSequence - a.lastSequence)[0];
  const first = (previous?.lastSequence ?? 0) + 1;
  const snapshot = snapshotsOf(s, device.id).find((candidate) => candidate.status === "IN_FORCE");
  s.batches.push({
    id: reference("BAT"),
    device: device.id,
    premisesId: evidence.former,
    receivedAt: later(condition.effectiveFrom, condition.recordedAt),
    firstSequence: first,
    lastSequence: first + count - 1,
    policyVersion: previous?.policyVersion ?? EVIDENCE_POLICY_VERSION,
    entitlementVersion: snapshot?.version ?? previous?.entitlementVersion ?? 0,
    eventsFrom: session.oldest ?? session.lastContact,
    eventsTo: session.lastContact,
    outcomes: [
      {
        kind: "ACCEPTED",
        count,
        why: {
          vi: "Gửi về hồ sơ của cơ sở nơi đã phát, theo quyết định khi chuyển thiết bị",
          en: "Submitted to the record of the premises where they were played, as decided at the transfer",
        },
        code: null,
      },
    ],
    held: [],
    disposition: null,
  });
  device.accepted += count;
}

/**
 * A condition comes into force: IAM revokes the credential from then (a loss reported for a time already past is
 * revoked when it is recorded, as SCR-IAM-08 draws PLY-0009), the evidence is quarantined or decided on, and a
 * transferred device leaves its premises with its snapshot superseded, so no entitlement crosses (FR-PLR-037).
 */
function takeEffect(key: string, s: PlrState, device: Device, condition: Condition): void {
  condition.settled = true;
  const status = condition.status;
  if (status === "LOST" || status === "COMPROMISED") quarantine(key, s, device, condition);
  if (status === "TRANSFERRED") settleEvidence(s, device, condition);
  if (status === "LOST" || status === "COMPROMISED" || status === "TRANSFERRED" || status === "RETIRED") {
    revokeOnEvent(key, device.id, condition.cause ?? same(""), later(condition.effectiveFrom, condition.recordedAt), status);
    device.lastContact = device.session?.lastContact ?? device.lastContact;
    device.session = null;
  }
  if (status === "TRANSFERRED" && condition.premisesTo !== null) {
    for (const snapshot of snapshotsOf(s, device.id)) if (snapshot.status !== "SUPERSEDED") snapshot.status = "SUPERSEDED";
    device.premisesId = condition.premisesTo;
  }
}

/** ApplyDueTransitions, played on every read: each condition whose effective time has come takes effect, once. */
function settle(key: string, s: PlrState, instant: string): void {
  for (const device of s.devices.values()) {
    for (const condition of device.conditions) if (!condition.settled && ms(condition.effectiveFrom) <= ms(instant)) takeEffect(key, s, device, condition);
  }
}

/** A transfer's decision as the form sends it (`pending_evidence_decision`). */
const DECISIONS: Readonly<Record<string, EvidenceDecision>> = { submit_to_former: "SUBMITTED_TO_FORMER", discard: "DISCARDED" };

/**
 * POST /player/devices/{id}/conditions (and /transfer for a transfer), its refusals in the contract's order once the
 * reader and the device are known: a condition that would reach back before the latest one recorded
 * (CONDITION_OVERLAPS, @AC-FR-PLR-004-04, whatever it is), one SM-200 does not let follow it, a cause not from the list
 * (NO_CAUSE), and a time that is never taken to be now - a condition's effective time (NO_EFFECTIVE_TIME), a loss's or
 * a compromise's time it is reported to have happened (NO_REPORTED_TIME), the evidence accepted from then quarantined
 * rather than deleted. A time still to come leaves the condition before it in force until then. A transfer is the
 * operations officer's alone (PERM-474), decides under the officer's name what becomes of the evidence the device still
 * holds, and carries no entitlement across; asked again for the premises it went to, it answers as it did.
 */
export function recordCondition(staff: Staff, id: string, input: ConditionInput): CommandAnswer<{ status: DeviceStatus; effectiveFrom: string; inForce: boolean }> {
  if (!holds(staff, "ACT-OPS", "ACT-SEC")) return refuse("NOT_AUTHORISED");
  const key = staff.sessionId;
  const s = playerState(key);
  const device = s.devices.get(id);
  if (device === undefined) return refuse("NOT_FOUND");
  const condition = STATUSES.find((status) => status === input.condition);
  if (condition === undefined || condition === "ENROLLED") return refuse("FIELD_INVALID", "condition");
  if (condition === "TRANSFERRED" && !holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const last = latest(device);
  // Idempotent: the transfer already recorded to this premises is the answer to the same transfer asked again.
  if (condition === "TRANSFERRED" && last.status === "TRANSFERRED" && last.premisesTo === input.premises) {
    return accept({ status: last.status, effectiveFrom: last.effectiveFrom, inForce: last.settled });
  }
  const lossLike = condition === "LOST" || condition === "COMPROMISED";
  const effectiveFrom = instantOf(input.effectiveFrom);
  // Two conditions are never in force at one instant; the record names the one it would cut into.
  if (effectiveFrom !== null && ms(effectiveFrom) < ms(last.effectiveFrom)) return refuse("CONDITION_OVERLAPS", "effective_from");
  if (!NEXT[last.status].includes(condition)) return refuse("FIELD_INVALID", "condition");
  const cause = CAUSES[condition].find((entry) => entry.id === input.cause);
  if (cause === undefined) return refuse("NO_CAUSE", "cause");
  if (effectiveFrom === null) return refuse(lossLike ? "NO_REPORTED_TIME" : "NO_EFFECTIVE_TIME", "effective_from");
  const reportedAt = lossLike ? instantOf(input.reportedAt) : null;
  if (lossLike && input.reportedAt.trim() !== "" && reportedAt === null) return refuse("FIELD_INVALID", "reported_at");

  let premisesTo: string | null = null;
  let evidence: Condition["evidence"] = null;
  if (condition === "TRANSFERRED") {
    const target = transferTargets(key, device).find((premises) => premises.id === input.premises);
    if (target === undefined) return refuse("FIELD_INVALID", "premises_id");
    const waiting = device.session?.waiting ?? 0;
    const decision = DECISIONS[input.pending];
    if (waiting > 0 && decision === undefined) return refuse("PENDING_EVIDENCE_UNDECIDED", "pending_evidence_decision");
    if (decision === "DISCARDED" && input.ground.trim() === "") return refuse("NO_CAUSE", "discard_ground");
    premisesTo = target.id;
    if (waiting > 0 && decision !== undefined) {
      evidence = { decision, count: null, ground: decision === "DISCARDED" ? input.ground.trim() : null, former: device.premisesId };
    }
  }

  const instant = now();
  const row: Condition = {
    status: condition,
    effectiveFrom,
    recordedAt: instant,
    recordedBy: officer(staff),
    cause: cause.text,
    reportedBy: null,
    reportedAt,
    premisesTo,
    evidence,
    settled: false,
  };
  device.conditions.push(row);
  s.audit.push({
    at: instant,
    actor: staff.account,
    act: `CONDITION_${condition}`,
    subject: id,
    note: null,
    detail: {
      condition,
      cause: cause.id,
      effective_from: effectiveFrom,
      ...(reportedAt !== null ? { reported_at: reportedAt } : {}),
      ...(premisesTo !== null ? { premises_to: premisesTo } : {}),
      ...(evidence !== null ? { pending_evidence_decision: evidence.decision, ...(evidence.ground !== null ? { discard_ground: evidence.ground } : {}) } : {}),
    },
  });
  const heldBefore = device.held;
  settle(key, s, instant);
  if (lossLike) {
    // NTF-PLR-04, to security, operations and the evidence owner (ACT-SEC, ACT-OPS, ACT-EVD) at the office COM names for
    // the class: the reported instant, the count held, IAM's revocation.
    const credential = credentialOf(key, id);
    notify(
      key,
      s,
      { kind: "device_reported_lost_or_compromised", occurrence: `${id}:${condition}:${effectiveFrom}`, subject: { kind: "player_device", ref: id }, recipient: null, office: true },
      {
        device: id,
        condition,
        reported: effectiveFrom,
        recorded: instant,
        quarantined: device.held - heldBefore,
        revoked: row.settled && credential?.state === "REVOKED" ? credential.since : "",
      },
    );
  }
  return accept({ status: condition, effectiveFrom, inForce: row.settled });
}

// ---------------------------------------------------------------- SCR-PLR-03 Enrol a device

/** SM-10's ended states: a premises whose service ended takes no new device. */
const ENDED: readonly EntitlementStatus[] = ["REVOKED", "ENDED_AT_REQUEST", "ENDED_OUT_OF_SCOPE"];

/** The premises with a Player service in being (not ended), which a device may be enrolled for. */
function enrollable(key: string): PremisesOption[] {
  return PREMISES.filter((premises) => {
    const service = servicePublicStatus(key, premises.id);
    return service !== null && !ENDED.includes(service.status);
  })
    .map((premises) => premisesOption(key, premises.id))
    .sort(byName);
}

const suppliersOf = (s: PlrState) => [...new Set([...s.certifications.values()].map((certification) => certification.supplier))].sort((a, b) => a.localeCompare(b, "vi"));

/** SCR-PLR-03's choices: every supplier in the register with its standing, and the premises a device may serve. */
export function enrolForm(staff: Staff): LoadOutcome<EnrolFormData> {
  if (!holds(staff, "ACT-OPS")) return notAuthorised;
  const s = playerState(staff.sessionId);
  return ok({ suppliers: suppliersOf(s).map((supplier) => supplierCertification(s, supplier)), premises: enrollable(staff.sessionId) });
}

const IDENTITY = /^dev-[0-9a-z]{4}-[0-9a-z]{2}$/;

/** POST /player/devices: one device at ENROLLED; it accepts no evidence until DR-215 makes it ACTIVE. */
export function enrolDevice(staff: Staff, input: EnrolInput): CommandAnswer<{ device: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const key = staff.sessionId;
  const s = playerState(key);
  const identity = input.identity.trim().toLowerCase();
  if (!IDENTITY.test(identity)) return refuse("FIELD_INVALID", "device_identity");
  const existing = [...s.devices.values()].find((device) => device.identity === identity);
  if (existing !== undefined) return refuse("DEVICE_ALREADY_ENROLLED", existing.id);
  if (!suppliersOf(s).includes(input.supplier)) return refuse("FIELD_INVALID", "supplier_name");
  if (!enrollable(key).some((premises) => premises.id === input.premises)) return refuse("FIELD_INVALID", "premises_id");
  const next = Math.max(...[...s.devices.keys()].map((id) => Number(id.slice(4)))) + 1;
  const id = `PLY-${String(next).padStart(4, "0")}`;
  const instant = now();
  const enrolledBy = officer(staff);
  s.devices.set(id, {
    id,
    identity,
    supplier: input.supplier,
    premisesId: input.premises,
    name: null,
    enrolledAt: instant,
    enrolledBy,
    conditions: [systemCondition("ENROLLED", instant, enrolledBy)],
    session: null,
    lastContact: null,
    held: 0,
    disposition: null,
    accepted: 0,
  });
  s.audit.push({ at: instant, actor: staff.account, act: "DEVICE_ENROLLED", subject: id, note: null, detail: { device_identity: identity, premises: input.premises, supplier: input.supplier } });
  return accept({ device: id });
}

// ---------------------------------------------------------------- SCR-PLR-07 Evidence acceptance

const deviceChoices = (key: string, s: PlrState) =>
  [...s.devices.values()].map((device) => ({ id: device.id, premises: premisesRef(key, device.premisesId).name })).sort((a, b) => a.id.localeCompare(b.id));

/** GET /player/playback-events for one device, by the evidence operator or the auditor (PERM-484): its latest batch, each event's outcome, and what is quarantined. */
export function acceptanceView(staff: Staff, asked: string | null): LoadOutcome<AcceptanceView> {
  if (!holds(staff, "ACT-EVD", "ACT-AUD")) return notAuthorised;
  const key = staff.sessionId;
  const s = playerState(key);
  const latest = [...s.batches].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const id = asked ?? latest[0]?.device ?? [...s.devices.keys()][0];
  const device = id === undefined ? undefined : s.devices.get(id);
  if (device === undefined) return refusedRead("NOT_FOUND");
  const batch = latest.find((candidate) => candidate.device === device.id) ?? null;
  return ok({
    devices: deviceChoices(key, s),
    device: { id: device.id, premises: premisesRef(key, device.premisesId), enrolledAt: device.enrolledAt },
    batch:
      batch === null
        ? null
        : {
            id: batch.id,
            receivedAt: batch.receivedAt,
            firstSequence: batch.firstSequence,
            lastSequence: batch.lastSequence,
            events: batch.outcomes.reduce((sum, outcome) => sum + outcome.count, 0),
            policyVersion: batch.policyVersion,
            entitlementVersion: batch.entitlementVersion,
            outcomes: batch.outcomes,
            held: batch.held.map((event) => ({ ...event, driftSeconds: Math.round((Date.parse(event.deviceTime) - Date.parse(event.trustedTime)) / 1000) })),
            disposition: batch.disposition,
          },
  });
}

// ---------------------------------------------------------------- SCR-PLR-15 Playback decisions

const KINDS: readonly DecisionKind[] = ["FROM_SCHEDULE", "FROM_DEFAULT_PLAYLIST", "CYCLE_RESTARTED"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A device's decisions on one local day, as POST /player/playback-decisions recorded them, with the rules applied. */
export function decisionsView(staff: Staff, asked: { device: string | null; day: string | null; kind: string | null }): LoadOutcome<DecisionsView> {
  if (!holds(staff, "ACT-EVD")) return notAuthorised;
  const key = staff.sessionId;
  const s = playerState(key);
  const days = [...s.decisions].sort((a, b) => b.day.localeCompare(a.day));
  const id = asked.device ?? days[0]?.device ?? [...s.devices.keys()][0];
  const device = id === undefined ? undefined : s.devices.get(id);
  if (device === undefined) return refusedRead("NOT_FOUND");
  const day = asked.day !== null && DAY.test(asked.day) ? asked.day : (days.find((entry) => entry.device === device.id)?.day ?? today());
  const record = s.decisions.find((entry) => entry.device === device.id && entry.day === day) ?? null;
  const all = record?.decisions ?? [];
  const kind = KINDS.find((candidate) => candidate === asked.kind) ?? null;
  // Oldest first, the titles played before the first restart: a repeat there is what the no-repeat rule forbids.
  const ordered = [...all].reverse();
  const firstRestart = ordered.findIndex((decision) => decision.kind === "CYCLE_RESTARTED");
  const before = (firstRestart === -1 ? ordered : ordered.slice(0, firstRestart)).filter((decision) => decision.kind !== "CYCLE_RESTARTED").map((decision) => decision.title.vi);
  return ok({
    devices: deviceChoices(key, s),
    device: device.id,
    premises: premisesRef(key, device.premisesId),
    day,
    eligibleTracks: record?.eligibleTracks ?? null,
    kind,
    rows: all.filter((decision) => kind === null || decision.kind === kind),
    counts: {
      ALL: all.length,
      FROM_SCHEDULE: all.filter((decision) => decision.kind === "FROM_SCHEDULE").length,
      FROM_DEFAULT_PLAYLIST: all.filter((decision) => decision.kind === "FROM_DEFAULT_PLAYLIST").length,
      CYCLE_RESTARTED: all.filter((decision) => decision.kind === "CYCLE_RESTARTED").length,
    },
    restarts: all.filter((decision) => decision.kind === "CYCLE_RESTARTED").length,
    repeatsBefore: before.length - new Set(before).size,
    rules: rulesOn(s, day),
  });
}

/** AC-FR-PLR-022-02, 045-02: the rule-set version in force on the day a decision was made, not the one in force now. */
function rulesOn(s: PlrState, day: string): DecisionsView["rules"] {
  const version = versionOn(s.rules, day);
  return version === null ? null : { version: version.no, effectiveFrom: version.effectiveFrom };
}

// ---------------------------------------------------------------- the rule set SCR-PLR-15 names (FR-PLR-045)

function ruleSetRow(version: RuleSet, day: string): RuleSetVersion {
  return { ...version, inEffect: versionOn([version], day) !== null };
}

const nextNumber = (versions: readonly { no: number }[]) => Math.max(0, ...versions.map((version) => version.no)) + 1;

/** The loudness and transition rule set's versions, newest first, for the evidence operator who drafts and approves them. */
export function ruleSetView(staff: Staff): LoadOutcome<RuleSetView> {
  if (!holds(staff, "ACT-EVD")) return notAuthorised;
  const s = playerState(staff.sessionId);
  const day = today();
  return ok({ versions: [...s.rules].sort((a, b) => b.no - a.no).map((version) => ruleSetRow(version, day)), nextNo: nextNumber(s.rules), today: day });
}

/**
 * POST /player/playback-rule-set-versions: a version in DRAFT with its loudness and transition rules and the day it
 * takes effect. The rules are one set for every premises (BR-PLR-18): a version set for one premises is refused.
 */
export function draftRuleSet(staff: Staff, input: RuleSetInput): CommandAnswer<{ no: number }> {
  if (!holds(staff, "ACT-EVD")) return refuse("NOT_AUTHORISED");
  if (input.premises.trim() !== "") return refuse("RULES_NOT_PREMISES_SCOPED", "premises_id");
  const missing: RuleSetField | null = input.loudness.trim() === "" ? "loudness" : input.transitions.trim() === "" ? "transitions" : null;
  if (missing !== null) return refuse("FIELD_MISSING", missing);
  if (input.effectiveFrom.trim() === "") return refuse("NO_EFFECTIVE_PERIOD", "from");
  if (!DAY.test(input.effectiveFrom) || input.effectiveFrom < today()) return refuse("FIELD_INVALID", "from");
  const s = playerState(staff.sessionId);
  const no = nextNumber(s.rules);
  s.rules.push({
    no,
    loudness: same(input.loudness.trim()),
    transitions: same(input.transitions.trim()),
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    status: "DRAFT",
    preparedBy: staff.account,
    preparedAt: now(),
    approvedBy: null,
    approvedAt: null,
  });
  s.audit.push({ at: now(), actor: staff.account, act: "RULE_SET_DRAFTED", subject: `rules:${no}`, note: null, detail: { effective_from: input.effectiveFrom } });
  return accept({ no });
}

/** An approval note goes to the audit record (frd/11), under 2,000 characters. */
const NOTE_LIMIT = 2000;

/**
 * POST /player/playback-rule-set-versions/{id}/approve: a version with no effective period is refused, and so is one
 * that would share a day with an approved version (the refusal names it); approved, it closes the period of the one
 * before it, and the decisions made from its first day name it.
 */
export function approveRuleSet(staff: Staff, no: number, note: string): CommandAnswer<{ no: number; effectiveFrom: string }> {
  if (!holds(staff, "ACT-EVD")) return refuse("NOT_AUTHORISED");
  const s = playerState(staff.sessionId);
  const version = s.rules.find((candidate) => candidate.no === no);
  if (version === undefined) return refuse("NOT_FOUND");
  if (note.length >= NOTE_LIMIT) return refuse("FIELD_INVALID", "approval_note");
  if (version.status === "APPROVED") return accept({ no, effectiveFrom: version.effectiveFrom });
  if (!DAY.test(version.effectiveFrom)) return refuse("NO_EFFECTIVE_PERIOD", "from");
  const overlap = overlapping(s.rules, version);
  if (overlap !== null) return refuse("EFFECTIVE_PERIOD_OVERLAPS", "from", overlap.no);
  approve(s, staff, version, `rules:${no}`, note);
  closePrevious(s.rules, version);
  return accept({ no, effectiveFrom: version.effectiveFrom });
}

/** A version approved under the evidence operator's name, the note in the audit record. */
function approve(
  s: PlrState,
  staff: Staff,
  version: { no: number; effectiveFrom: string; status: "DRAFT" | "APPROVED"; approvedBy: string | null; approvedAt: string | null },
  subject: string,
  note: string,
): void {
  const instant = now();
  version.status = "APPROVED";
  version.approvedBy = staff.account;
  version.approvedAt = instant;
  s.audit.push({
    at: instant,
    actor: staff.account,
    act: "POLICY_VERSION_APPROVED",
    subject,
    note: note.trim() === "" ? null : note.trim(),
    detail: { version: String(version.no), effective_from: version.effectiveFrom },
  });
}

// ---------------------------------------------------------------- SCR-PLR-13 Offline-continuity policy

/**
 * The version in effect today, if one was approved; the approved ones still to take effect; the latest draft; and what
 * DR-218 would bound a session opening now by. An approved version governs from its effective date, not from approval.
 */
export function offlinePolicy(staff: Staff): LoadOutcome<OfflinePolicyView> {
  if (!holds(staff, "ACT-EVD")) return notAuthorised;
  const s = playerState(staff.sessionId);
  const day = today();
  return ok({
    effective: versionOn(s.offline, day),
    approved: s.offline.filter((version) => version.status === "APPROVED" && version.effectiveFrom > day).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
    draft: [...s.offline].filter((version) => version.status === "DRAFT").sort((a, b) => b.no - a.no)[0] ?? null,
    nextNo: nextNumber(s.offline),
    limitNow: offlineLimit(s, now()),
    today: day,
  });
}

/** The first of the four parts a version leaves out, POLICY_INCOMPLETE naming it; null when it has all four. */
function offlineGap(version: { maxOfflineHours: number; exceeded: string; propagation: string; graceHours: number }): OfflinePart | null {
  if (!Number.isInteger(version.maxOfflineHours) || version.maxOfflineHours <= 0) return "max";
  if (version.exceeded !== "STOP") return "exceeded";
  if (version.propagation !== "NEXT_SYNC") return "propagation";
  if (!Number.isInteger(version.graceHours) || version.graceHours < 0) return "grace";
  return null;
}

/**
 * POST /player/offline-continuity-policy-versions/{id}/approve: the four parts checked again (POLICY_INCOMPLETE names
 * the one missing), then the period against the approved versions (EFFECTIVE_PERIOD_OVERLAPS names the one in the
 * way). Approved, it closes the open period before it and, from its effective date, DR-218 reads it rather than the
 * snapshot: until then the interim rule stays in force.
 */
export function approveOfflinePolicy(staff: Staff, no: number, note: string): CommandAnswer<{ no: number; effectiveFrom: string }> {
  if (!holds(staff, "ACT-EVD")) return refuse("NOT_AUTHORISED");
  const s = playerState(staff.sessionId);
  const version = s.offline.find((candidate) => candidate.no === no);
  if (version === undefined) return refuse("NOT_FOUND");
  if (note.length >= NOTE_LIMIT) return refuse("FIELD_INVALID", "approval_note");
  if (version.status === "APPROVED") return accept({ no, effectiveFrom: version.effectiveFrom });
  const gap = offlineGap(version);
  if (gap !== null) return refuse("POLICY_INCOMPLETE", gap);
  const overlap = overlapping(s.offline, version);
  if (overlap !== null) return refuse("EFFECTIVE_PERIOD_OVERLAPS", "from", overlap.no);
  approve(s, staff, version, `offline:${no}`, note);
  closePrevious(s.offline, version);
  return accept({ no, effectiveFrom: version.effectiveFrom });
}

const WHOLE = /^\d+$/;

/**
 * POST /player/offline-continuity-policy-versions: a new version in DRAFT, which needs all four parts - the maximum
 * offline period, what happens when it is exceeded, how a change reaches a device, and the grace period (0 is a
 * grace period: none). Until a version is approved the interim rule stays in force.
 */
export function draftOfflinePolicy(staff: Staff, input: OfflineInput): CommandAnswer<{ no: number }> {
  if (!holds(staff, "ACT-EVD")) return refuse("NOT_AUTHORISED");
  const s = playerState(staff.sessionId);
  const missing: OfflinePart | null =
    !WHOLE.test(input.maxOfflineHours.trim()) || Number(input.maxOfflineHours) === 0
      ? "max"
      : input.exceeded !== "STOP"
        ? "exceeded"
        : input.propagation !== "NEXT_SYNC"
          ? "propagation"
          : !WHOLE.test(input.graceHours.trim())
            ? "grace"
            : null;
  if (missing !== null) return refuse("POLICY_INCOMPLETE", missing);
  if (!DAY.test(input.effectiveFrom) || input.effectiveFrom < today()) return refuse("FIELD_INVALID", "from");
  const no = nextNumber(s.offline);
  s.offline.push({
    no,
    maxOfflineHours: Number(input.maxOfflineHours),
    exceeded: "STOP",
    propagation: "NEXT_SYNC",
    graceHours: Number(input.graceHours),
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    status: "DRAFT",
    preparedBy: staff.account,
    preparedAt: now(),
    approvedBy: null,
    approvedAt: null,
  });
  s.audit.push({ at: now(), actor: staff.account, act: "OFFLINE_VERSION_DRAFTED", subject: `offline:${no}`, note: null, detail: { effective_from: input.effectiveFrom } });
  return accept({ no });
}

// ---------------------------------------------------------------- SCR-PLR-10 and 11, certification and the policy

/** The register's order: certified, then in progress, then refused, then ended; by supplier within each. */
const OUTCOME_RANK: Readonly<Record<CertificationStatus, number>> = { CERTIFIED: 0, UNDER_REVIEW: 1, APPLIED: 2, REFUSED: 3, EXPIRED: 4, WITHDRAWN: 5 };
const GROUP: Readonly<Record<CertificationStatus, Exclude<RegisterFilter, "all">>> = {
  CERTIFIED: "certified",
  UNDER_REVIEW: "open",
  APPLIED: "open",
  REFUSED: "closed",
  EXPIRED: "closed",
  WITHDRAWN: "closed",
};

/** The device-assurance versions anyone may read and apply against: approved and published (FR-PLR-032). */
const published = (s: PlrState) => s.assurance.filter((version) => version.status === "APPROVED" && version.published);

const inEffectOn = (s: PlrState, no: number, day: string) => {
  const version = s.assurance.find((candidate) => candidate.no === no);
  return version !== undefined && versionOn([version], day) !== null;
};

/** GET /player/certifications: every application, a refusal with the criterion it did not meet. */
export function certificationRegister(key: string, asked: string | null): LoadOutcome<CertificationRegisterView> {
  const s = playerState(key);
  const day = today();
  const all: CertificationRow[] = [...s.certifications.values()]
    .map((certification) => ({ ...certification, status: certificationStatus(certification, day) }))
    .sort((a, b) => OUTCOME_RANK[a.status] - OUTCOME_RANK[b.status] || a.supplier.localeCompare(b.supplier, "vi"));
  const filter: RegisterFilter = asked === "certified" || asked === "open" || asked === "closed" ? asked : "all";
  const count = (group: Exclude<RegisterFilter, "all">) => all.filter((row) => GROUP[row.status] === group).length;
  const touched = all.map((row) => row.decidedOn ?? row.lodgedOn).sort();
  return ok({
    rows: filter === "all" ? all : all.filter((row) => GROUP[row.status] === filter),
    counts: { all: all.length, certified: count("certified"), open: count("open"), closed: count("closed") },
    filter,
    versions: published(s).map((version) => ({ no: version.no, inEffect: inEffectOn(s, version.no, day), validityMonths: version.validityMonths })),
    updatedOn: touched[touched.length - 1] ?? null,
    criteria: CRITERIA,
  });
}

/**
 * POST /player/certifications, by any supplier on equal terms: an application against one published criteria
 * version, the one in effect.
 */
export function applyForCertification(key: string, input: ApplyInput): CommandAnswer<{ id: string }> {
  const applicant = input.applicant.trim();
  if (applicant === "") return refuse("FIELD_MISSING", "applicant_name");
  if (input.version.trim() === "") return refuse("NO_CRITERIA_VERSION", "assurance_policy_version_id");
  const no = Number(input.version);
  const s = playerState(key);
  // AC-FR-PLR-032-03: a version drafted, or approved and kept unpublished, cannot be applied against.
  if (!published(s).some((version) => version.no === no)) return refuse("CRITERIA_VERSION_NOT_PUBLISHED", "assurance_policy_version_id");
  const day = today();
  if (!inEffectOn(s, no, day)) return refuse("POLICY_VERSION_NOT_EFFECTIVE", "assurance_policy_version_id");
  let id = reference("CRT");
  while (s.certifications.has(id)) id = reference("CRT");
  s.certifications.set(id, { id, supplier: applicant, version: no, status: "APPLIED", lodgedOn: day, decidedOn: null, validTo: null, criterion: null });
  s.audit.push({ at: now(), actor: null, act: "CERTIFICATION_APPLIED", subject: id, note: null, detail: { applicant, version: String(no) } });
  return accept({ id });
}

/** The last day of a validity counted in months from the day of certification. */
function validUntil(from: string, months: number): string {
  const [year, month, day] = from.split("-").map(Number);
  const end = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, day ?? 1));
  return addDays(end.toISOString(), -1);
}

/**
 * POST /player/certifications/{id}/assess, the evidence operator's: certified against every criterion of the version,
 * or refused with the criterion not met (a refusal with no ground is itself refused). A version no longer in effect
 * cannot be assessed against. A supplier certified, its paired devices are read against DR-215 again.
 */
export function assessCertification(staff: Staff, id: string, input: AssessInput): CommandAnswer<{ status: CertificationStatus }> {
  if (!holds(staff, "ACT-EVD")) return refuse("NOT_AUTHORISED");
  const key = staff.sessionId;
  const s = playerState(key);
  const certification = s.certifications.get(id);
  if (certification === undefined) return refuse("NOT_FOUND");
  if (input.outcome !== "certified" && input.outcome !== "refused") return refuse("FIELD_INVALID", "outcome");
  const outcome: CertificationStatus = input.outcome === "certified" ? "CERTIFIED" : "REFUSED";
  if (certification.status !== "APPLIED" && certification.status !== "UNDER_REVIEW") {
    return certification.status === outcome ? accept({ status: outcome }) : refuse("FIELD_INVALID", "outcome");
  }
  if (outcome === "REFUSED" && !CRITERIA.includes(input.criterion)) return refuse("NO_REFUSAL_GROUND", "refusal_criterion");
  const day = today();
  if (!inEffectOn(s, certification.version, day)) return refuse("POLICY_VERSION_NOT_EFFECTIVE");
  const months = s.assurance.find((version) => version.no === certification.version)?.validityMonths ?? 12;
  certification.status = outcome;
  certification.decidedOn = day;
  certification.validTo = outcome === "CERTIFIED" ? validUntil(day, months) : null;
  certification.criterion = outcome === "REFUSED" ? input.criterion : null;
  s.audit.push({
    at: now(),
    actor: staff.account,
    act: "CERTIFICATION_ASSESSED",
    subject: id,
    note: null,
    detail: { applicant: certification.supplier, version: String(certification.version), outcome, ...(outcome === "REFUSED" ? { criterion: input.criterion } : {}) },
  });
  if (outcome === "CERTIFIED") {
    const instant = now();
    for (const device of s.devices.values()) if (device.supplier === certification.supplier) activate(key, s, device, instant);
  } else {
    // NTF-PLR-05: the version, the criterion not met, and that the applicant may apply again. Its recipients are the
    // applicant and ACT-EVD (frd/08); the application records the applicant's name alone (srs/02, `applicant_name`) and
    // no account or address, so the notice is issued to the evidence owner's office, which answers the applicant.
    notify(
      key,
      s,
      { kind: "certification_refused", occurrence: id, subject: { kind: "device_certification", ref: id }, recipient: null, office: true },
      { certification: id, supplier: certification.supplier, version: certification.version, criterion: input.criterion },
    );
  }
  return accept({ status: outcome });
}

function assuranceVersion(version: Assurance, day: string): AssuranceVersion {
  return {
    no: version.no,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    publishedOn: version.publishedOn,
    validityMonths: version.validityMonths,
    criteria: version.criteria,
    authority: version.authority,
    withdrawal: version.withdrawal,
    sections: version.sections,
    inEffect: versionOn([version], day) !== null,
  };
}

/**
 * GET /player/assurance-policy-versions, public: the version asked, else the one in effect, and the others still
 * readable. Only a published version is read; a draft or a version approved unpublished is answered as not published.
 */
export function assurancePolicy(key: string, asked: string | null): LoadOutcome<AssurancePolicyView> {
  const day = today();
  const all = published(playerState(key));
  const current = versionOn(all, day) ?? all[all.length - 1];
  const no = asked === null ? (current?.no ?? 0) : Number(asked);
  const found = all.find((candidate) => candidate.no === no);
  if (found === undefined) return refusedRead("CRITERIA_VERSION_NOT_PUBLISHED");
  const others = all
    .filter((candidate) => candidate.no !== no)
    .map((candidate) => assuranceVersion(candidate, day))
    .sort((a, b) => b.no - a.no);
  return ok({ version: assuranceVersion(found, day), others });
}

function assuranceRecord(version: Assurance, day: string): AssuranceRecord {
  return {
    no: version.no,
    status: version.status,
    published: version.published,
    publishedOn: version.publishedOn,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    validityMonths: version.validityMonths,
    criteria: version.criteria,
    authority: version.authority,
    withdrawal: version.withdrawal,
    preparedBy: version.preparedBy,
    preparedAt: version.preparedAt,
    approvedBy: version.approvedBy,
    approvedAt: version.approvedAt,
    inEffect: versionOn([version], day) !== null,
  };
}

/** Every device-assurance version, drafts and unpublished ones included, for the evidence operator (PERM-491, 492). */
export function assuranceConsole(staff: Staff): LoadOutcome<AssuranceConsoleView> {
  if (!holds(staff, "ACT-EVD")) return notAuthorised;
  const s = playerState(staff.sessionId);
  const day = today();
  return ok({ versions: [...s.assurance].sort((a, b) => b.no - a.no).map((version) => assuranceRecord(version, day)), nextNo: nextNumber(s.assurance), today: day });
}

/** The first of the four parts a version leaves out, POLICY_VERSION_INCOMPLETE naming it; null when it has all four. */
function assuranceGap(version: { criteria: string; authority: string; validityMonths: number; withdrawal: string }): Exclude<AssurancePart, "from"> | null {
  if (version.criteria.trim() === "") return "criteria";
  if (version.authority.trim() === "") return "authority";
  if (!Number.isInteger(version.validityMonths) || version.validityMonths <= 0) return "validity";
  if (version.withdrawal.trim() === "") return "withdrawal";
  return null;
}

/**
 * POST /player/assurance-policy-versions: a version in DRAFT carrying the four parts FR-PLR-043 names - its criteria,
 * its issuing authority, its validity in months and its withdrawal grounds - and the day it takes effect. Nothing of
 * it is public until it is approved and published.
 */
export function draftAssurancePolicy(staff: Staff, input: AssuranceInput): CommandAnswer<{ no: number }> {
  if (!holds(staff, "ACT-EVD")) return refuse("NOT_AUTHORISED");
  const months = WHOLE.test(input.validityMonths.trim()) ? Number(input.validityMonths) : 0;
  const gap = assuranceGap({ criteria: input.criteria, authority: input.authority, validityMonths: months, withdrawal: input.withdrawal });
  if (gap !== null) return refuse("POLICY_VERSION_INCOMPLETE", gap);
  if (!DAY.test(input.effectiveFrom) || input.effectiveFrom < today()) return refuse("FIELD_INVALID", "from");
  const s = playerState(staff.sessionId);
  const no = nextNumber(s.assurance);
  const instant = now();
  const criteria = same(input.criteria.trim());
  s.assurance.push({
    no,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    publishedOn: null,
    validityMonths: months,
    criteria,
    authority: same(input.authority.trim()),
    withdrawal: same(input.withdrawal.trim()),
    // The full text a published version shows is the criteria as written.
    sections: [{ id: "criteria", heading: { vi: "Tiêu chí", en: "Criteria" }, body: [criteria] }],
    status: "DRAFT",
    published: false,
    preparedBy: staff.account,
    preparedAt: instant,
    approvedBy: null,
    approvedAt: null,
  });
  s.audit.push({ at: instant, actor: staff.account, act: "ASSURANCE_VERSION_DRAFTED", subject: `assurance:${no}`, note: null, detail: { effective_from: input.effectiveFrom } });
  return accept({ no });
}

/**
 * POST /player/assurance-policy-versions/{id}/approve: refused while a part is missing (POLICY_VERSION_INCOMPLETE names
 * it) or where an approved version is in force for part of the period (EFFECTIVE_PERIOD_OVERLAPS names it, and both
 * stay as they were). Approved, it closes the period before it; published, its criteria are public from that day.
 * Approving again an approved version left unpublished publishes it.
 */
export function approveAssurancePolicy(staff: Staff, no: number, publish: boolean): CommandAnswer<{ no: number; published: boolean }> {
  if (!holds(staff, "ACT-EVD")) return refuse("NOT_AUTHORISED");
  const s = playerState(staff.sessionId);
  const version = s.assurance.find((candidate) => candidate.no === no);
  if (version === undefined) return refuse("NOT_FOUND");
  if (version.status === "APPROVED") {
    if (publish && !version.published) {
      version.published = true;
      version.publishedOn = today();
      s.audit.push({ at: now(), actor: staff.account, act: "POLICY_VERSION_PUBLISHED", subject: `assurance:${no}`, note: null, detail: { version: String(no) } });
    }
    return accept({ no, published: version.published });
  }
  const gap = assuranceGap({ criteria: version.criteria.vi, authority: version.authority.vi, validityMonths: version.validityMonths, withdrawal: version.withdrawal.vi });
  if (gap !== null) return refuse("POLICY_VERSION_INCOMPLETE", gap);
  const overlap = overlapping(s.assurance, version);
  if (overlap !== null) return refuse("EFFECTIVE_PERIOD_OVERLAPS", "from", overlap.no);
  approve(s, staff, version, `assurance:${no}`, "");
  closePrevious(s.assurance, version);
  version.published = publish;
  version.publishedOn = publish ? today() : null;
  return accept({ no, published: publish });
}

// ---------------------------------------------------------------- SCR-IAM-07 and 08, device credentials

const authority = refusedRead("AUTHORITY_NOT_IN_FORCE");
const STATE_RANK: Readonly<Record<CredentialState, number>> = { ACTIVE: 0, SUSPENDED: 1, REVOKED: 2 };

function credentialRow(key: string, credential: Credential): CredentialRow {
  const device = playerState(key).devices.get(credential.device);
  return {
    id: credential.id,
    device: credential.device,
    name: device?.name ?? null,
    premises: premisesRef(key, credential.premisesId),
    purpose: "PLAYBACK",
    state: credential.state,
    since: credential.since,
    pairedAt: credential.pairedAt,
    lastUsedAt: credential.lastUsedAt,
    reason: credential.reason,
    revocation: credential.revocation,
  };
}

/** GET /identity/devices: every credential, a revoked one kept because its evidence stays attributable to it. */
export function deviceRegister(staff: Staff, filter: RegisterFilterInput): LoadOutcome<DeviceRegisterView> {
  if (!holds(staff, "ACT-OPS", "ACT-SEC")) return authority;
  const key = staff.sessionId;
  const all = [...credentialState(key).values()].map((credential) => credentialRow(key, credential));
  const totals = { ACTIVE: 0, SUSPENDED: 0, REVOKED: 0 };
  for (const row of all) totals[row.state] += 1;
  const premises = new Map(all.map((row) => [row.premises.id, premisesOption(key, row.premises.id)]));
  return ok({
    asOf: now(),
    rows: all
      .filter((row) => filter.premises === null || row.premises.id === filter.premises)
      .filter((row) => filter.state === null || row.state === filter.state)
      .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "")),
    totals,
    premisesOptions: [...premises.values()].sort(byName),
    filter,
  });
}

/** One credential, and the count of evidence periods accepted from the device, kept whatever happens to it. */
export function credentialRecord(staff: Staff, id: string): LoadOutcome<CredentialRecordView> {
  if (!holds(staff, "ACT-OPS", "ACT-SEC")) return authority;
  const key = staff.sessionId;
  const credential = credentialState(key).get(id);
  if (credential === undefined) return refusedRead("NOT_FOUND");
  return ok({
    ...credentialRow(key, credential),
    asOf: now(),
    accepted: playerState(key).devices.get(credential.device)?.accepted ?? 0,
    relationshipEnded: relationshipEnded(key, credential.premisesId),
  });
}

function actOn(staff: Staff, id: string): { credential: Credential } | CommandAnswer<never> {
  if (!holds(staff, "ACT-OPS")) return refuse("AUTHORITY_NOT_IN_FORCE");
  const credential = credentialState(staff.sessionId).get(id);
  if (credential === undefined) return refuse("AUTHORITY_NOT_IN_FORCE");
  return { credential };
}

/** POST /identity/devices/{id}/suspend: requests from the device are refused while it is held; the credential survives. */
export function suspendCredential(staff: Staff, id: string, reason: string): CommandAnswer<{ state: CredentialState }> {
  const found = actOn(staff, id);
  if (!("credential" in found)) return found;
  const { credential } = found;
  if (reason.trim() === "") return refuse("FIELD_MISSING", "reason");
  if (credential.state === "REVOKED") return refuse("DEVICE_CREDENTIAL_REVOKED");
  if (credential.state === "SUSPENDED") return accept({ state: "SUSPENDED" });
  credential.state = "SUSPENDED";
  credential.since = now();
  credential.reason = same(reason.trim());
  auditIdentity(staff.sessionId, { action: "CREDENTIAL_SUSPENDED", actor: staff.account, target: id, outcome: "performed", detail: { reason: reason.trim() } });
  return accept({ state: "SUSPENDED" });
}

/**
 * POST /identity/devices/{id}/reinstate: never for a revoked credential, nor under a premises relationship that ended,
 * the refusal recorded against the officer with the relationship's end and its cause (@AC-FR-IAM-008-06).
 */
export function reinstateCredential(staff: Staff, id: string, reason: string): CommandAnswer<{ state: CredentialState }> {
  const found = actOn(staff, id);
  if (!("credential" in found)) return found;
  const { credential } = found;
  if (reason.trim() === "") return refuse("FIELD_MISSING", "reason");
  if (credential.state === "REVOKED") return refuse("DEVICE_CREDENTIAL_REVOKED");
  if (relationshipEnded(staff.sessionId, credential.premisesId)) {
    const party = partyOf(credential.premisesId);
    const ended = party === null ? null : premisesRelationshipAt(staff.sessionId, credential.premisesId, { organisation: party });
    const detail = ended?.kind === "ENDED" ? { code: "PREMISES_RELATIONSHIP_ENDED", ended_on: ended.endedOn, cause: ended.cause ?? "" } : { code: "PREMISES_RELATIONSHIP_ENDED" };
    auditIdentity(staff.sessionId, { action: "CREDENTIAL_REINSTATED", actor: staff.account, target: id, outcome: "refused", detail });
    return refuse("PREMISES_RELATIONSHIP_ENDED");
  }
  if (credential.state === "ACTIVE") return accept({ state: "ACTIVE" });
  credential.state = "ACTIVE";
  credential.since = now();
  credential.reason = same(reason.trim());
  auditIdentity(staff.sessionId, { action: "CREDENTIAL_REINSTATED", actor: staff.account, target: id, outcome: "performed", detail: { reason: reason.trim() } });
  return accept({ state: "ACTIVE" });
}

/** What a revocation request may also ask of the evidence the device produced; RightOne does neither (FR-IAM-021). */
export type EvidenceChange = "REMOVE" | "AMEND";

/**
 * POST /identity/devices/{id}/revoke: with a cause, from the time given (now when none), never before the pairing.
 * Every accepted evidence period stays retained, unaltered and attributable: nothing of PLR's is touched. A request
 * that also asks for the evidence to be removed or amended is answered EVIDENCE_RETENTION_IN_FORCE: the revocation it
 * asked for happens, or has already happened, and the refused change to the evidence is recorded on its own against
 * the officer (@AC-FR-IAM-008-04, @AC-FR-IAM-021-03).
 */
export function revokeCredential(staff: Staff, id: string, cause: string, effectiveAt: string, evidence: EvidenceChange | null = null): CommandAnswer<{ state: CredentialState }> {
  const found = actOn(staff, id);
  if (!("credential" in found)) return found;
  const { credential } = found;
  const key = staff.sessionId;
  if (cause.trim() === "") return refuse("FIELD_MISSING", "cause");
  const refuseEvidence = (): CommandAnswer<never> => {
    auditIdentity(key, { action: "EVIDENCE_CHANGE", actor: staff.account, target: id, outcome: "refused", detail: { code: "EVIDENCE_RETENTION_IN_FORCE", asked: evidence ?? "" } });
    return refuse("EVIDENCE_RETENTION_IN_FORCE");
  };
  if (credential.state === "REVOKED") return evidence !== null ? refuseEvidence() : refuse("DEVICE_CREDENTIAL_REVOKED");
  const effective = effectiveAt.trim() === "" ? now() : instantOf(effectiveAt);
  if (effective === null || Date.parse(effective) < Date.parse(credential.pairedAt)) return refuse("FIELD_INVALID", "effective_at");
  revokeWith(key, credential, { cause: same(cause.trim()), effectiveAt: effective, by: staff.account, event: "OFFICER" });
  return evidence !== null ? refuseEvidence() : accept({ state: "REVOKED" });
}

// ---------------------------------------------------------------- what the assurance console and the tests read

/**
 * PLR's audit log, oldest first, for the auditor and the security officer (frd/11): enrolments, conditions with their
 * cause and instants, a transfer's decision on the evidence, assessments, quarantines raised, policy versions drafted,
 * approved with their note and published, and an event no notice class answered. No screen of the portal reads it.
 */
export function playerAuditOf(staff: Staff): LoadOutcome<readonly PlayerAuditRow[]> {
  if (!holds(staff, "ACT-AUD", "ACT-SEC")) return notAuthorised;
  return ok([...playerState(staff.sessionId).audit]);
}

/**
 * IAM's own records of the pairing entry points and the credentials: the refused attempts with their origin and count,
 * the audit log, and NTF-IAM-01 and 02 as raised (ACT-SEC, ACT-AUD; the screens that read them are not on the portal).
 */
export function identityRecordsOf(staff: Staff): LoadOutcome<{ refusals: readonly PairingRefusal[]; audit: readonly IdentityAuditRow[]; notices: readonly IdentityNotice[] }> {
  if (!holds(staff, "ACT-SEC", "ACT-AUD")) return authority;
  const records = identityRecords(staff.sessionId);
  return ok({ refusals: [...records.refusals], audit: [...records.audit], notices: [...records.notices] });
}

// ---------------------------------------------------------------- what other families read

/** The premises a device plays at, by the portal's id, or null for one the estate does not hold: CAS reads it for a case about the device. */
export function devicePremisesOf(key: string, device: string): string | null {
  return playerState(key).devices.get(device.trim())?.premisesId ?? null;
}
