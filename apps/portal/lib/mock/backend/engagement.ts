import type { LoadOutcome } from "@rightone/ui";
import type {
  Actor,
  AuditEntry,
  BalanceView,
  CapabilityReleaseView,
  CapabilityState,
  CapabilitySummary,
  ConditionCode,
  CorrectionDraftView,
  CorrectionGround,
  CorrectionReader,
  CorrectionSummary,
  CorrectionViewData,
  DisclosureVersion,
  DisclosureVersionsView,
  DisclosureView,
  EngagementAnswer,
  EngagementHomeView,
  LedgerEventView,
  LedgerPage,
  LedgerRow,
  MetricCode,
  MetricDefinition,
  MetricSnapshot,
  MetricsView,
  NamedOutcome,
  ParticipantClass,
  ParticipationState,
  ParticipationView,
  Party,
  QualifyingActionForm,
  Recorded,
  Refusal,
  ReleaseCondition,
  RuleAction,
  RuleEditorView,
  RuleVersion,
  RuleVersionState,
  RuleVersionsView,
  ReferralView,
  SnapshotOutcome,
  SupportViewData,
} from "@/lib/api/engagement";
import { CORRECTION_GROUNDS, DISPOSITION_KINDS } from "@/lib/api/engagement";
import {
  DISCLOSURE_MIGRATION,
  DISCLOSURE_ONE,
  METRIC_DEFINITIONS,
  METRIC_OWNER_ROLE,
  MIGRATED_AT,
  PARTICIPANTS,
  RESERVING_DECISION,
  RULE_MIGRATION,
  VERSION_ONE_ACTIONS,
} from "@/lib/mock/engagement";
import { addDays, now, today } from "./clock";
import { opaqueReference, reference } from "./ids";
import { officeDestinationOf, recordNoticeEvent } from "./notices";
import { actingAs } from "./parties";
import { table, type StaffRole } from "./store";

/**
 * ENG's behaviour, played by the mock backend: the award rule versions and their approval, the disclosure versions,
 * the capability release under `CG-ENG`, the participations, the append-only ledger with its receipts and corrections,
 * the support reads and the metric snapshots. Every command refuses with the family's codes in the order its decision
 * rule evaluates them (`DR-61` to `DR-67`), and a refusal of an actor whose role is correct is written to the audit log,
 * as the refusal tells them it is.
 *
 * Nothing here is computed by a clock job: a version becomes EFFECTIVE, and the one it supersedes SUPERSEDED, when a
 * read finds its instant has passed, and a balance is derived from the ledger on every read (`ALG-35`), never stored.
 */

/**
 * Who reads or acts: a premises principal by the organisation they act for, an artist by their own account, each with
 * the name an audit row gives them, or a member of staff by their spec roles.
 */
export type EngagementReader =
  | { kind: "participant"; organisation: string; name: string }
  | { kind: "artist"; account: string; name: string }
  | { kind: "staff"; name: string; email: string; roles: readonly StaffRole[] };

type Staff = Extract<EngagementReader, { kind: "staff" }>;

/** A record's actor: a person by name and address, or the migration or handler that did it (no address). */
interface ActorRef {
  name: string;
  email: string | null;
}

interface StoredVersion {
  no: number;
  preparedBy: ActorRef;
  preparedAt: string;
  submittedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  referral: boolean;
  actions: RuleAction[];
  approvedBy: ActorRef | null;
  approvedAt: string | null;
  withdrawnBy: ActorRef | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

interface StoredDisclosure {
  no: number;
  textEn: string;
  textVi: string;
  reservingDecision: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedBy: ActorRef;
  approvedAt: string;
}

interface StoredDefinition {
  code: MetricCode;
  no: number;
  statement: string;
  ownerRole: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedBy: ActorRef | null;
  approvedAt: string | null;
}

interface StoredSnapshot {
  id: string;
  metric: MetricCode;
  definitionNo: number;
  periodFrom: string;
  periodTo: string;
  cutOff: string;
  figure: number;
  ledgerFigure: number;
  outcome: SnapshotOutcome;
  state: MetricSnapshot["state"];
  publishedBy: ActorRef | null;
}

interface StoredRelease {
  id: string;
  state: CapabilityState;
  scope: ParticipantClass[];
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedBy: ActorRef;
  approvedAt: string;
  conditions: ReleaseCondition[];
}

interface StoredTransition {
  release: string;
  from: CapabilityState | null;
  to: CapabilityState;
  actor: ActorRef;
  ground: string | null;
  at: string;
}

interface StoredParticipation {
  id: string;
  party: Party;
  displayProfile: { ref: string; name: string };
  state: Exclude<ParticipationState, "NOT_ENROLLED">;
  enrolledAt: string | null;
  /** Every `SM-51` transition, so a suspended period stays readable afterwards. */
  history: { from: ParticipationState; to: ParticipationState; at: string }[];
}

interface StoredEvent {
  id: string;
  participation: string;
  displayProfile: { ref: string; name: string };
  kind: "award" | "correction";
  actionCode: string | null;
  occurredAt: string | null;
  governingNo: number;
  points: number;
  recordedAt: string;
  recordedBy: ActorRef;
  corrects: string | null;
  ground: CorrectionGround | null;
}

/** `marketplace.qualifying_action_receipts`: the four-column key, the event it produced and a digest of the payload. */
interface StoredReceipt {
  participation: string;
  code: string;
  subject: string;
  occurredAt: string;
  event: string;
  digest: string;
}

interface StoredCorrection {
  id: string;
  target: string;
  ground: CorrectionGround;
  delta: number;
  proposedBy: ActorRef;
  proposedAt: string;
  /** The support read the proposal was made from. */
  read: string;
  authorisedBy: ActorRef | null;
  authorisedAt: string | null;
  event: string | null;
}

/** `marketplace.referral_references`: one live reference per participation, attached to its display profile. */
interface StoredReferral {
  participation: string;
  displayProfile: { ref: string; name: string };
  /** Opaque, twelve characters, carrying no account identifier. */
  value: string;
  issuedAt: string;
  /** The award rule version whose programme it was issued under (`PERM-131`). */
  versionNo: number;
}

/**
 * A message `marketplace.outbox_messages` hands to COM for a notice (`NTF-ENG-01`, `NTF-ENG-02`), one per recipient,
 * with the notice COM raised for it, or null where its policy in force requires none.
 */
interface StoredMessage {
  notice: "NTF-ENG-01" | "NTF-ENG-02";
  occurrence: string;
  /** The party COM addresses, or null for the operations role. */
  recipient: string | null;
  raised: string | null;
  at: string;
}

/** A support read: who read whose balance, why, and when; recorded before anything was shown. */
interface StoredRead {
  id: string;
  by: ActorRef;
  party: string;
  purpose: string;
  at: string;
}

interface EngagementTable {
  versions: StoredVersion[];
  disclosures: StoredDisclosure[];
  definitions: StoredDefinition[];
  snapshots: StoredSnapshot[];
  releases: StoredRelease[];
  transitions: StoredTransition[];
  participations: StoredParticipation[];
  events: StoredEvent[];
  receipts: StoredReceipt[];
  corrections: StoredCorrection[];
  reads: StoredRead[];
  referrals: StoredReferral[];
  outbox: StoredMessage[];
  audit: { at: string; actor: string; act: string; subject: string; code: string | null; detail: string | null }[];
}

const migration = (name: string): ActorRef => ({ name, email: null });

function seed(): EngagementTable {
  return {
    versions: [
      {
        no: 1,
        preparedBy: migration(RULE_MIGRATION),
        preparedAt: MIGRATED_AT,
        submittedAt: MIGRATED_AT,
        effectiveFrom: MIGRATED_AT,
        effectiveTo: null,
        referral: false,
        actions: VERSION_ONE_ACTIONS.map((action) => ({ ...action })),
        approvedBy: migration(RULE_MIGRATION),
        approvedAt: MIGRATED_AT,
        withdrawnBy: null,
        withdrawnAt: null,
        withdrawalReason: null,
      },
    ],
    disclosures: [{ no: 1, ...DISCLOSURE_ONE, effectiveFrom: MIGRATED_AT, effectiveTo: null, approvedBy: migration(DISCLOSURE_MIGRATION), approvedAt: MIGRATED_AT }],
    definitions: METRIC_DEFINITIONS.map((definition) => ({
      code: definition.code,
      no: 1,
      statement: definition.statement,
      ownerRole: METRIC_OWNER_ROLE,
      effectiveFrom: MIGRATED_AT,
      effectiveTo: null,
      approvedBy: null,
      approvedAt: null,
    })),
    snapshots: [],
    releases: [],
    transitions: [],
    participations: [],
    events: [],
    receipts: [],
    corrections: [],
    reads: [],
    referrals: [],
    outbox: [],
    audit: [],
  };
}

const engagementOf = (key: string): EngagementTable => table(key, "engagement", seed);

// ------------------------------------------------------------------ answers

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
/** A refused read that names what the reader needs: the latest instant that may be asked, the reserving decision. */
const refusedNaming = (code: string, named: Readonly<Record<string, string>>): NamedOutcome<never> => ({ ...refused(code), named });
const accept = <T>(accepted: T): EngagementAnswer<T> => ({ accepted, refusal: null });
/** A refused command: assignable to every answer, and narrowed by `"refusal" in` where a helper returns one or a record. */
type Refused = { accepted: null; refusal: Refusal };
const refuse = (code: string, values: Readonly<Record<string, string | number>> = {}): Refused => ({ accepted: null, refusal: { code, values } });

const staffOf = (reader: EngagementReader): Staff | null => (reader.kind === "staff" ? reader : null);
const holds = (staff: Staff, ...roles: readonly StaffRole[]) => roles.some((role) => staff.roles.includes(role));
const actorOf = (staff: Staff): ActorRef => ({ name: staff.name, email: staff.email });
const same = (actor: ActorRef | null, staff: Staff) => actor?.email !== null && actor?.email === staff.email;
const shown = (actor: ActorRef): Actor => ({ name: actor.name, kind: actor.email === null ? "system" : "person" });

/** An attempt by someone whose role is correct, refused on the composition: recorded, as the refusal says. */
function audit(t: EngagementTable, staff: Staff, act: string, subject: string, code: string | null, detail: string | null = null): void {
  recordAttempt(t, staff.name, act, subject, code, detail);
}

/** A row of `marketplace.audit_log` for any actor: a member of staff, a participant, or the module itself. */
function recordAttempt(t: EngagementTable, actor: string, act: string, subject: string, code: string | null, detail: string | null = null): void {
  t.audit.push({ at: now(), actor, act, subject, code, detail });
}

const ms = (iso: string) => Date.parse(iso);
const blank = (value: string | null | undefined) => value === null || value === undefined || value.trim() === "";

// ------------------------------------------------------------------ SM-50 and DR-62

function stateOf(version: StoredVersion, at: number): RuleVersionState {
  if (version.withdrawnAt !== null) return "WITHDRAWN";
  if (version.approvedAt === null || version.effectiveFrom === null) return "PREPARED";
  if (ms(version.effectiveFrom) > at) return "APPROVED";
  if (version.effectiveTo !== null && ms(version.effectiveTo) <= at) return "SUPERSEDED";
  return "EFFECTIVE";
}

/**
 * `DR-62`: the approved versions whose period covers the instant, withdrawn ones included, because a version withdrawn
 * after approval keeps the instant it was approved with and covers it (row 3). Exactly one, or none.
 */
function governing(t: EngagementTable, at: number): { version: StoredVersion; withdrawn: boolean } | null {
  const covering = t.versions.filter(
    (version) =>
      version.approvedAt !== null &&
      version.effectiveFrom !== null &&
      ms(version.effectiveFrom) <= at &&
      (version.effectiveTo === null || at < ms(version.effectiveTo)),
  );
  const version = covering.sort((a, b) => ms(b.effectiveFrom ?? "") - ms(a.effectiveFrom ?? ""))[0];
  return version === undefined ? null : { version, withdrawn: version.withdrawnAt !== null };
}

const ruleVersionView = (version: StoredVersion, at: number): RuleVersion => ({
  no: version.no,
  state: stateOf(version, at),
  effectiveFrom: version.effectiveFrom,
  effectiveTo: version.effectiveTo,
  referral: version.referral,
  actions: version.actions.map((action) => ({ ...action })),
  preparedBy: shown(version.preparedBy),
  preparedAt: version.preparedAt,
  submittedAt: version.submittedAt,
  approvedBy: version.approvedBy !== null ? shown(version.approvedBy) : null,
  approvedAt: version.approvedAt,
  withdrawnBy: version.withdrawnBy !== null ? shown(version.withdrawnBy) : null,
  withdrawnAt: version.withdrawnAt,
  withdrawalReason: version.withdrawalReason,
});

// ------------------------------------------------------------------ disclosure and the capability

/**
 * A version's state at an instant. One whose end has passed is SUPERSEDED where another version took over at that
 * instant, and ENDED where the DPO ended it with none to follow, so a lapse reads as one (`DR-65` row 5).
 */
function disclosureState(version: StoredDisclosure, at: number, all: readonly StoredDisclosure[]): DisclosureVersion["state"] {
  if (ms(version.effectiveFrom) > at) return "APPROVED";
  if (version.effectiveTo === null || ms(version.effectiveTo) > at) return "EFFECTIVE";
  const end = ms(version.effectiveTo);
  return all.some((other) => other !== version && ms(other.effectiveFrom) === end) ? "SUPERSEDED" : "ENDED";
}

const disclosureView = (version: StoredDisclosure, at: number, all: readonly StoredDisclosure[]): DisclosureVersion => ({
  no: version.no,
  textEn: version.textEn,
  textVi: version.textVi,
  reservingDecision: version.reservingDecision,
  effectiveFrom: version.effectiveFrom,
  effectiveTo: version.effectiveTo,
  approvedBy: shown(version.approvedBy),
  approvedAt: version.approvedAt,
  state: disclosureState(version, at, all),
});

const effectiveDisclosure = (t: EngagementTable, at: number) => t.disclosures.find((version) => disclosureState(version, at, t.disclosures) === "EFFECTIVE") ?? null;

/** The release on record: the one with no end instant. */
const currentRelease = (t: EngagementTable) => t.releases.find((release) => release.effectiveTo === null) ?? null;

/**
 * `SM-52`, as a reader meets it: a release operates from its effective instant, so one recorded for later is still
 * withheld today. While withheld, whether a release ever existed decides which of SCR-ENG-01's sentences applies.
 */
function capabilityOf(t: EngagementTable, at: number): CapabilitySummary {
  const release = currentRelease(t);
  if (release === null || ms(release.effectiveFrom) > at) {
    return {
      state: "WITHHELD",
      withheld: t.releases.some((past) => past.effectiveTo !== null) ? "withdrawn" : "never",
      scope: release?.scope ?? [],
      effectiveFrom: release?.effectiveFrom ?? null,
    };
  }
  return { state: release.state, withheld: null, scope: [...release.scope], effectiveFrom: release.effectiveFrom };
}

/** Each condition of `CG-ENG` and the evidence that satisfies it now, if any. */
function conditionsOf(t: EngagementTable, at: number): ReleaseCondition[] {
  const rule = governing(t, at);
  const disclosure = effectiveDisclosure(t, at);
  const definitions = METRIC_DEFINITIONS.map((definition) => currentDefinition(t, definition.code, at));
  const owned = definitions.every((definition) => definition !== null && definition.approvedBy !== null);
  const condition = (code: ConditionCode, evidence: ReleaseCondition["evidence"], effectiveFrom: string | null): ReleaseCondition => ({
    code,
    evidence,
    effectiveFrom,
    effective: evidence !== null && effectiveFrom !== null && ms(effectiveFrom) <= at,
  });
  const points = definitions[0] ?? null;
  const enrolled = definitions[1] ?? null;
  return [
    condition(
      "AWARD_RULES",
      rule !== null && !rule.withdrawn ? { kind: "rule-version", no: rule.version.no } : null,
      rule !== null && !rule.withdrawn ? rule.version.effectiveFrom : null,
    ),
    condition("PRIVACY_DISCLOSURE", disclosure !== null ? { kind: "disclosure", no: disclosure.no } : null, disclosure?.effectiveFrom ?? null),
    condition("CORRECTION_TREATMENT", { kind: "config", ref: "CFG-65" }, MIGRATED_AT),
    condition(
      "METRIC_OWNERSHIP",
      owned && points !== null && enrolled !== null ? { kind: "metric-definitions", points: points.no, enrolled: enrolled.no } : null,
      owned && points !== null && enrolled !== null ? (ms(points.effectiveFrom) > ms(enrolled.effectiveFrom) ? points.effectiveFrom : enrolled.effectiveFrom) : null,
    ),
  ];
}

// ------------------------------------------------------------------ participants and the ledger

const asParty = (party: Party): Party => ({ ref: party.ref, name: party.name, participantClass: party.participantClass });

/**
 * Whether the premises-portal session acts as the principal of the organisation (ACT-PRE-PRI), as PTY answers now:
 * every premises-facing row of ENG's permission entries (PERM-129, 132 to 135, 138) names the principal and no
 * delegate, so a delegate (ACT-PRE-DEL) takes part, reads and withdraws for nobody, and neither does a session PTY
 * answers for nobody.
 */
function actsAsPrincipal(key: string, organisation: string): boolean {
  const acting = actingAs(key);
  return acting !== null && acting.actor === "PRINCIPAL" && acting.organisation === organisation;
}

/**
 * The party a participant acts as: a principal's, by the organisation they chose at sign-in, where PTY answers the
 * session as its principal; an artist's, by their account.
 */
function partyOfReader(key: string, reader: EngagementReader): Party | null {
  const party =
    reader.kind === "participant" && actsAsPrincipal(key, reader.organisation)
      ? PARTICIPANTS.find((candidate) => candidate.organisation === reader.organisation)
      : reader.kind === "artist"
        ? PARTICIPANTS.find((candidate) => candidate.account === reader.account)
        : undefined;
  return party !== undefined ? asParty(party) : null;
}

/** The display profiles a party holds (`FR-ART-006`), the first being the one its participation attaches to. */
function profilesOf(party: Party): readonly { ref: string; name: string }[] {
  const profiles = PARTICIPANTS.find((candidate) => candidate.ref === party.ref)?.profiles ?? [];
  return profiles.length > 0 ? profiles.map((profile) => ({ ...profile })) : [{ ref: party.ref, name: party.name }];
}

const firstProfile = (party: Party) => profilesOf(party)[0] ?? { ref: party.ref, name: party.name };

/** Who COM addresses a participant's notice to: a premises principal's organisation, as COM keys a party, or the party. */
const recipientOf = (party: Party) => PARTICIPANTS.find((candidate) => candidate.ref === party.ref)?.organisation ?? party.ref;

function partyByRef(t: EngagementTable, ref: string): Party | null {
  const known = t.participations.find((participation) => participation.party.ref === ref)?.party ?? PARTICIPANTS.find((party) => party.ref === ref);
  return known !== undefined ? asParty(known) : null;
}

const participationOfParty = (t: EngagementTable, ref: string) => t.participations.find((participation) => participation.party.ref === ref) ?? null;

/** Whether a participation takes part: enrolled, or enrolled and suspended with the capability. */
const takingPart = (participation: StoredParticipation | null) => participation !== null && (participation.state === "ENROLLED" || participation.state === "SUSPENDED");

const eventsOf = (t: EngagementTable, participation: string) =>
  t.events.filter((event) => event.participation === participation).sort((a, b) => ms(a.recordedAt) - ms(b.recordedAt) || a.id.localeCompare(b.id));

const correctingOf = (t: EngagementTable, event: string) => t.events.find((other) => other.corrects === event) ?? null;

const sum = (events: readonly StoredEvent[]) => events.reduce((total, event) => total + event.points, 0);

function transition(participation: StoredParticipation, to: StoredParticipation["state"], at: string): void {
  participation.history.push({ from: participation.state, to, at });
  participation.state = to;
}

const PAGE = 10;

/**
 * One page of history in recorded order, from after the cursor (the last event of the page before), as it stood at the
 * cut-off: a correction recorded after it is not yet there, so an as-at history says nothing it could not have said then.
 */
function pageOf(t: EngagementTable, events: readonly StoredEvent[], cursor: string | null, cutOff: number): LedgerPage {
  const start = cursor === null ? 0 : events.findIndex((event) => event.id === cursor) + 1;
  const rows = events.slice(start, start + PAGE);
  const row = (event: StoredEvent): LedgerRow => {
    const correcting = correctingOf(t, event.id);
    const corrected = correcting !== null && ms(correcting.recordedAt) <= cutOff ? correcting : null;
    const target = event.corrects !== null ? (t.events.find((other) => other.id === event.corrects) ?? null) : null;
    return {
      id: event.id,
      recordedAt: event.recordedAt,
      kind: event.kind,
      actionCode: event.actionCode,
      occurredAt: event.occurredAt,
      points: event.points,
      corrects: target !== null ? { id: target.id, recordedAt: target.recordedAt } : null,
      correctedBy: corrected !== null ? { id: corrected.id, recordedAt: corrected.recordedAt } : null,
    };
  };
  const last = rows.at(-1);
  return { rows: rows.map(row), total: events.length, shownTo: start + rows.length, next: start + rows.length < events.length && last !== undefined ? last.id : null };
}

function eventView(t: EngagementTable, event: StoredEvent): LedgerEventView {
  const participation = t.participations.find((candidate) => candidate.id === event.participation);
  const version = t.versions.find((candidate) => candidate.no === event.governingNo);
  const corrected = correctingOf(t, event.id);
  if (participation === undefined || version === undefined || version.effectiveFrom === null) throw new Error(`Ledger event ${event.id} names no participation or version`);
  return {
    id: event.id,
    participant: participation.party,
    displayProfile: event.displayProfile,
    kind: event.kind,
    action: event.actionCode !== null && event.occurredAt !== null ? { code: event.actionCode, occurredAt: event.occurredAt } : null,
    governing: { no: version.no, effectiveFrom: version.effectiveFrom },
    points: event.points,
    recordedAt: event.recordedAt,
    recordedBy: shown(event.recordedBy),
    corrects: event.corrects !== null && event.ground !== null ? { id: event.corrects, ground: event.ground } : null,
    correctedBy: corrected !== null && corrected.ground !== null ? { id: corrected.id, ground: corrected.ground, recordedAt: corrected.recordedAt } : null,
  };
}

/** Whether the version governing now lists any action for the class: a premises principal earns nothing until one does. */
function listsClass(t: EngagementTable, at: number, participantClass: ParticipantClass): boolean {
  const rule = governing(t, at);
  return rule !== null && !rule.withdrawn && rule.version.actions.some((action) => action.participantClass === participantClass);
}

// ------------------------------------------------------------------ SCR-ENG-01: participation

/** GET /engagement/participation, with the capability release a participant may read (`srs/02` 3.8). */
export function participationOf(key: string, reader: EngagementReader): LoadOutcome<ParticipationView> {
  const party = partyOfReader(key, reader);
  const t = engagementOf(key);
  const staff = staffOf(reader);
  if (party === null) {
    // AC-FR-ENG-009-05: a reader whose role covers no participation of their own is refused, and the attempt recorded.
    if (staff !== null) audit(t, staff, "read_participation", "-", "ROLE_OUT_OF_SCOPE");
    return refused("ROLE_OUT_OF_SCOPE");
  }
  const participation = participationOfParty(t, party.ref);
  return ok({
    state: participation?.state ?? "NOT_ENROLLED",
    participant: party,
    displayProfile: participation?.displayProfile ?? firstProfile(party),
    lastTransitionAt: participation?.history.at(-1)?.at ?? null,
    capability: capabilityOf(t, ms(now())),
  });
}

/**
 * POST /engagement/participation (`SM-51` transitions 1 and 3): the capability must operate, not be suspended, and
 * be released to the participant's class (`CFG-64`); one already taking part is told so.
 */
export function takePart(key: string, reader: EngagementReader): EngagementAnswer<{ state: ParticipationState }> {
  const party = partyOfReader(key, reader);
  if (party === null) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = now();
  const capability = capabilityOf(t, ms(at));
  if (capability.state === "WITHHELD") return refuse("CAPABILITY_WITHHELD");
  if (capability.state === "SUSPENDED") return refuse("CAPABILITY_SUSPENDED");
  const participation = participationOfParty(t, party.ref);
  if (participation?.state === "ENROLLED") return refuse("PARTICIPATION_ALREADY_ENROLLED");
  if (!capability.scope.includes(party.participantClass)) return refuse("PARTICIPANT_NOT_ELIGIBLE", { classes: capability.scope.join(",") });
  if (participation === null) {
    t.participations.push({
      id: reference("PTC"),
      party,
      displayProfile: firstProfile(party),
      state: "ENROLLED",
      enrolledAt: at,
      history: [{ from: "NOT_ENROLLED", to: "ENROLLED", at }],
    });
  } else {
    transition(participation, "ENROLLED", at);
    participation.enrolledAt = at;
  }
  return accept({ state: "ENROLLED" });
}

/** POST /engagement/participation/withdrawal: refused by nothing but not taking part, whatever the capability's state. */
export function stopTakingPart(key: string, reader: EngagementReader): EngagementAnswer<{ state: ParticipationState }> {
  const party = partyOfReader(key, reader);
  if (party === null) return refuse("ROLE_OUT_OF_SCOPE");
  const participation = participationOfParty(engagementOf(key), party.ref);
  if (participation === null || participation.state === "WITHDRAWN") return refuse("PARTICIPATION_NOT_ENROLLED");
  transition(participation, "WITHDRAWN", now());
  return accept({ state: "WITHDRAWN" });
}

// ------------------------------------------------------------------ SCR-ENG-02 to 04: what a participant reads

/**
 * GET /engagement/balance, /ledger and /balance/as-at (`ALG-35`): refused while the capability is withheld, and while
 * no disclosure version is effective (`DR-65` row 5), so a figure is never shown without what it is worth.
 */
export function balanceOf(key: string, reader: EngagementReader, asAt: string | null, cursor: string | null): NamedOutcome<BalanceView> {
  const party = partyOfReader(key, reader);
  if (party === null) return refused("ROLE_OUT_OF_SCOPE");
  return balanceAt(engagementOf(key), party, asAt, cursor);
}

/**
 * A party's balance and a page of its history as at an instant, from the ledger events alone (`ALG-35`). An instant
 * in the future is refused rather than clamped, and the refusal names now as the latest that may be asked
 * (`AC-FR-ENG-014-04`); everything recorded after the cut-off, corrections included, is left out of both.
 */
function balanceAt(t: EngagementTable, party: Party, asAt: string | null, cursor: string | null): NamedOutcome<BalanceView> {
  const instant = now();
  const at = ms(instant);
  if (capabilityOf(t, at).state === "WITHHELD") return refused("CAPABILITY_WITHHELD");
  const disclosure = effectiveDisclosure(t, at);
  if (disclosure === null) return refused("DISCLOSURE_VERSION_NOT_EFFECTIVE");
  if (asAt !== null && ms(asAt) > at) return refusedNaming("AS_AT_IN_FUTURE", { latest: instant });
  const cutOff = asAt ?? instant;
  const participation = participationOfParty(t, party.ref);
  const events = participation !== null ? eventsOf(t, participation.id).filter((event) => ms(event.recordedAt) <= ms(cutOff)) : [];
  const points = sum(events);
  return ok({
    points,
    eventCount: events.length,
    asAt,
    computedAt: cutOff,
    disclosure: disclosureView(disclosure, at, t.disclosures),
    history: pageOf(t, events, cursor, ms(cutOff)),
    negative: points < 0,
    noPremisesAction: party.participantClass === "premises" && !listsClass(t, at, "premises"),
  });
}

/**
 * GET /engagement/balance/as-at for an auditor (`PERM-136`, `PERM-138`): another participant's balance as at a past
 * instant, under the assurance engagement the auditor names. Anyone else, an auditor naming no engagement, or a
 * reference that names no participant is PARTICIPANT_NOT_SELF, which names nobody. The read is recorded against the
 * reader with the participant, the engagement and the instant asked, granted or refused, in a row of its own.
 */
export function assuranceBalance(
  key: string,
  reader: EngagementReader,
  asked: { participant: string; engagement: string; asAt: string },
  cursor: string | null,
): NamedOutcome<BalanceView> {
  const staff = staffOf(reader);
  const t = engagementOf(key);
  const ref = asked.participant.trim().toUpperCase();
  const party = partyByRef(t, ref);
  const detail = `engagement ${blank(asked.engagement) ? "-" : asked.engagement.trim()}; as_at ${asked.asAt}`;
  if (staff === null || !holds(staff, "ACT-AUD") || blank(asked.engagement) || party === null) {
    if (staff !== null) audit(t, staff, "read_balance_as_at", ref, "PARTICIPANT_NOT_SELF", detail);
    return refused("PARTICIPANT_NOT_SELF");
  }
  const outcome = balanceAt(t, party, asked.asAt, cursor);
  audit(t, staff, "read_balance_as_at", ref, outcome.failure?.code ?? null, detail);
  return outcome;
}

/** `marketplace.audit_log`, newest first, for an auditor (`ACT-AUD`): every recorded attempt and read. */
export function engagementAudit(key: string, reader: EngagementReader): LoadOutcome<readonly AuditEntry[]> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-AUD")) return refused("ROLE_OUT_OF_SCOPE");
  return ok([...engagementOf(key).audit].reverse().map((row) => ({ ...row })));
}

/**
 * GET /engagement/disclosure: the effective version, shown whatever the capability's state, and those before it. A
 * premises-portal reader is its organisation's principal (PERM-132 names no delegate); anyone else is ROLE_OUT_OF_SCOPE.
 */
export function disclosureFor(key: string, reader: EngagementReader | null = null): LoadOutcome<DisclosureView> {
  if (reader?.kind === "participant" && partyOfReader(key, reader) === null) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = ms(now());
  const effective = effectiveDisclosure(t, at);
  if (effective === null) return refused("DISCLOSURE_VERSION_NOT_EFFECTIVE");
  const earlier = t.disclosures.filter((version) => ["SUPERSEDED", "ENDED"].includes(disclosureState(version, at, t.disclosures))).sort((a, b) => b.no - a.no);
  return ok({ effective: disclosureView(effective, at, t.disclosures), earlier: earlier.map((version) => disclosureView(version, at, t.disclosures)) });
}

/**
 * POST /engagement/point-dispositions (`DR-65` rows 1 and 2, `PERM-133`): while `DEC-30` is not effective every
 * disposition is refused, an exchange or a transfer with POINT_DISPOSITION_RESERVED and an expiry with
 * POINT_EXPIRY_RESERVED, each naming the decision. The attempt, its kind and its refusal are the only thing written:
 * no field of the request is held, and no ledger event, balance or receipt changes. A participant and an operations
 * officer may attempt it; the right granted is the right to be refused.
 */
export function pointDisposition(key: string, reader: EngagementReader, kind: string): EngagementAnswer<never> {
  const staff = staffOf(reader);
  const party = partyOfReader(key, reader);
  if (staff !== null ? !holds(staff, "ACT-OPS") : party === null) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const subject = party?.ref ?? "-";
  const asked = DISPOSITION_KINDS.find((candidate) => candidate === kind.trim());
  if (asked === undefined) {
    recordAttempt(t, reader.name, "submit_point_disposition", subject, "FIELD_MISSING", "disposition_kind");
    return refuse("FIELD_MISSING", { field: "disposition_kind" });
  }
  const code = asked === "expiry" ? "POINT_EXPIRY_RESERVED" : "POINT_DISPOSITION_RESERVED";
  recordAttempt(t, reader.name, "submit_point_disposition", subject, code, asked);
  return refuse(code, { decision: RESERVING_DECISION });
}

/**
 * GET /engagement/ledger/{eventId}: the participant's own event, or another participant's for a member of staff under
 * the support read they recorded for that participant. Anything else is PARTICIPANT_NOT_SELF, which names nobody.
 */
export function ledgerEventFor(key: string, reader: EngagementReader, id: string, readId: string | null): LoadOutcome<LedgerEventView> {
  const t = engagementOf(key);
  const event = t.events.find((candidate) => candidate.id === id);
  if (event === undefined) return refused("LEDGER_EVENT_NOT_FOUND");
  const participation = t.participations.find((candidate) => candidate.id === event.participation);
  if (participation === undefined) return refused("LEDGER_EVENT_NOT_FOUND");
  const staff = staffOf(reader);
  if (staff === null) {
    if (partyOfReader(key, reader)?.ref !== participation.party.ref) return refused("PARTICIPANT_NOT_SELF");
    return ok(eventView(t, event));
  }
  const read = t.reads.find((candidate) => candidate.id === readId && same(candidate.by, staff) && candidate.party === participation.party.ref);
  if (!holds(staff, "ACT-OPS") || read === undefined) {
    audit(t, staff, "read_ledger_event", id, "PARTICIPANT_NOT_SELF");
    return refused("PARTICIPANT_NOT_SELF");
  }
  audit(t, staff, "read_ledger_event", id, null, read.id);
  return ok(eventView(t, event));
}

// ------------------------------------------------------------------ SCR-ENG-05: the referral reference

/** The version governing now, where it enables a referral programme (`CFG-60`); today none does. */
function referralProgramme(t: EngagementTable, at: number): StoredVersion | null {
  const rule = governing(t, at);
  return rule !== null && !rule.withdrawn && rule.version.referral ? rule.version : null;
}

/** The artist's party, or null: a referral reference is the artist's alone (`PERM-131`). */
const artistOf = (key: string, reader: EngagementReader): Party | null => {
  const party = partyOfReader(key, reader);
  return party?.participantClass === "artist" ? party : null;
};

/**
 * GET /engagement/referral-reference, in the contract's order: no programme enabled by the version governing now
 * (REFERRAL_PROGRAMME_NOT_ENABLED, naming the decision that would enable one), then the capability withheld. Once a
 * programme is enabled, the live reference and its instant, or none issued yet.
 */
export function referralReference(key: string, reader: EngagementReader): NamedOutcome<ReferralView> {
  const party = artistOf(key, reader);
  if (party === null) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = ms(now());
  const programme = referralProgramme(t, at);
  if (programme === null) return refusedNaming("REFERRAL_PROGRAMME_NOT_ENABLED", { decision: RESERVING_DECISION });
  if (capabilityOf(t, at).state === "WITHHELD") return refused("CAPABILITY_WITHHELD");
  const participation = participationOfParty(t, party.ref);
  const issued = participation !== null ? (t.referrals.find((referral) => referral.participation === participation.id) ?? null) : null;
  return ok({
    programme: { version: programme.no },
    reference: issued !== null ? { value: issued.value, issuedAt: issued.issuedAt, displayProfile: { ...issued.displayProfile } } : null,
    takingPart: takingPart(participation),
  });
}

/**
 * POST /engagement/referral-reference, in the contract's order: the programme, the capability, then the participation.
 * Issued, an opaque twelve-character reference is attached to the participation's display profile, never to the
 * account; a repeat returns the reference already issued rather than a second one.
 */
export function requestReferralReference(key: string, reader: EngagementReader): EngagementAnswer<{ reference: string; issuedAt: string; replay: boolean }> {
  const party = artistOf(key, reader);
  if (party === null) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = now();
  const programme = referralProgramme(t, ms(at));
  if (programme === null) return refuse("REFERRAL_PROGRAMME_NOT_ENABLED", { decision: RESERVING_DECISION });
  if (capabilityOf(t, ms(at)).state === "WITHHELD") return refuse("CAPABILITY_WITHHELD");
  const participation = participationOfParty(t, party.ref);
  if (participation === null || !takingPart(participation)) return refuse("PARTICIPATION_NOT_ENROLLED");
  const issued = t.referrals.find((referral) => referral.participation === participation.id);
  if (issued !== undefined) return accept({ reference: issued.value, issuedAt: issued.issuedAt, replay: true });
  let value = opaqueReference(12);
  while (t.referrals.some((referral) => referral.value === value)) value = opaqueReference(12);
  t.referrals.push({ participation: participation.id, displayProfile: { ...participation.displayProfile }, value, issuedAt: at, versionNo: programme.no });
  return accept({ reference: value, issuedAt: at, replay: false });
}

// ------------------------------------------------------------------ SCR-ENG-06 and 07: award rule versions

const RULE_READERS: readonly StaffRole[] = ["ACT-POL-PRE", "ACT-POL-APR", "ACT-AUD", "ACT-OPS"];

/** GET /engagement/award-rule-versions: every version in number order, and the one selected (the newest by default). */
export function awardRuleVersions(key: string, reader: EngagementReader, selected: number | null): LoadOutcome<RuleVersionsView> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, ...RULE_READERS)) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = ms(now());
  const versions = [...t.versions].sort((a, b) => a.no - b.no);
  const chosen = versions.find((version) => version.no === selected) ?? versions.at(-1) ?? null;
  return ok({
    versions: versions.map((version) => ruleVersionView(version, at)),
    selected: chosen !== null ? ruleVersionView(chosen, at) : null,
    mayPrepare: holds(staff, "ACT-POL-PRE"),
    mayApprove: holds(staff, "ACT-POL-APR"),
    preparedSelected: chosen !== null && same(chosen.preparedBy, staff),
  });
}

/** POST /engagement/award-rule-versions: a PREPARED version that starts from the actions of the version governing now. */
export function prepareRuleVersion(key: string, reader: EngagementReader): EngagementAnswer<{ no: number }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-POL-PRE")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = now();
  const from = governing(t, ms(at));
  const base = from !== null && !from.withdrawn ? from.version : null;
  const no = Math.max(0, ...t.versions.map((version) => version.no)) + 1;
  t.versions.push({
    no,
    preparedBy: actorOf(staff),
    preparedAt: at,
    submittedAt: null,
    effectiveFrom: null,
    effectiveTo: null,
    referral: base?.referral ?? false,
    actions: base !== null ? base.actions.map((action) => ({ ...action })) : [],
    approvedBy: null,
    approvedAt: null,
    withdrawnBy: null,
    withdrawnAt: null,
    withdrawalReason: null,
  });
  return accept({ no });
}

/** GET /engagement/award-rule-versions/{versionId}, for SCR-ENG-07. */
export function awardRuleEditor(key: string, reader: EngagementReader, no: number): LoadOutcome<RuleEditorView> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, ...RULE_READERS)) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const version = t.versions.find((candidate) => candidate.no === no);
  if (version === undefined) return refused("AWARD_RULE_VERSION_NOT_FOUND");
  const view = ruleVersionView(version, ms(now()));
  return ok({ version: view, mayEdit: holds(staff, "ACT-POL-PRE") && view.state === "PREPARED" });
}

/** The version a change names, if the preparer may still change it (`DR-67` row 5). */
function changeable(t: EngagementTable, staff: Staff | null, no: number): StoredVersion | Refused {
  if (staff === null || !holds(staff, "ACT-POL-PRE")) return refuse("ROLE_OUT_OF_SCOPE");
  const version = t.versions.find((candidate) => candidate.no === no);
  if (version === undefined) return refuse("AWARD_RULE_VERSION_NOT_FOUND");
  if (stateOf(version, ms(now())) !== "PREPARED") return refuse("AWARD_RULE_ALREADY_APPROVED");
  return version;
}

const ACTION_CODE = /^[A-Z][A-Z0-9_]*$/;
const CLASSES: readonly ParticipantClass[] = ["artist", "premises"];

/** A positive whole number as typed, or null. */
function wholePositive(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** PUT .../actions/{actionCode} as a new row: a code already listed is refused rather than overwritten. */
export function addRuleAction(
  key: string,
  reader: EngagementReader,
  no: number,
  input: { code: string; value: string; participantClass: string },
): EngagementAnswer<{ code: string }> {
  const t = engagementOf(key);
  const version = changeable(t, staffOf(reader), no);
  if ("refusal" in version) return version;
  const code = input.code.trim().toUpperCase();
  if (!ACTION_CODE.test(code)) return refuse("FIELD_MISSING", { field: "action_code" });
  const participantClass = CLASSES.find((candidate) => candidate === input.participantClass);
  if (participantClass === undefined) return refuse("FIELD_MISSING", { field: "participant_class" });
  if (version.actions.some((action) => action.code === code)) return refuse("AWARD_RULE_ACTION_DUPLICATE", { code });
  const value = wholePositive(input.value);
  if (value === null) return refuse("AWARD_VALUE_NOT_POSITIVE", { code });
  version.actions.push({ code, value, participantClass });
  return accept({ code });
}

/** PUT .../actions/{actionCode} on a row already listed: its value, and nothing else. */
export function changeRuleActionValue(key: string, reader: EngagementReader, no: number, code: string, input: string): EngagementAnswer<{ code: string }> {
  const t = engagementOf(key);
  const version = changeable(t, staffOf(reader), no);
  if ("refusal" in version) return version;
  const action = version.actions.find((candidate) => candidate.code === code);
  if (action === undefined) return refuse("FIELD_MISSING", { field: "action_code" });
  const value = wholePositive(input);
  if (value === null) return refuse("AWARD_VALUE_NOT_POSITIVE", { code });
  action.value = value;
  return accept({ code });
}

/** DELETE .../actions/{actionCode}, the only delete in the family: rule data on an unapproved version. */
export function removeRuleAction(key: string, reader: EngagementReader, no: number, code: string): EngagementAnswer<{ code: string }> {
  const t = engagementOf(key);
  const version = changeable(t, staffOf(reader), no);
  if ("refusal" in version) return version;
  version.actions = version.actions.filter((action) => action.code !== code);
  return accept({ code });
}

/**
 * Submit for approval (`PERM-126`): the version lists at least one action and names an effective instant in the
 * future. The instant and the referral setting are recorded with the submission; the version stays PREPARED.
 */
export function submitRuleVersion(
  key: string,
  reader: EngagementReader,
  no: number,
  terms: { effectiveFrom: string | null; referral: boolean },
): EngagementAnswer<{ no: number }> {
  const t = engagementOf(key);
  const version = changeable(t, staffOf(reader), no);
  if ("refusal" in version) return version;
  if (version.actions.length === 0) return refuse("FIELD_MISSING", { field: "actions" });
  if (terms.effectiveFrom === null) return refuse("FIELD_MISSING", { field: "effective_from" });
  if (ms(terms.effectiveFrom) <= ms(now())) return refuse("EFFECTIVE_FROM_IN_PAST");
  version.effectiveFrom = terms.effectiveFrom;
  version.referral = terms.referral;
  version.submittedAt = now();
  return accept({ no });
}

/**
 * POST .../approve, in `DR-67`'s order: the preparer is refused before the authority is read, because the composition
 * is what is refused (row 2); then the role, the state (row 5), the instant (row 3) and an approval taking the same
 * instant (row 4). Approved, the version ends the one it supersedes at its own effective instant, in the same act.
 */
export function approveRuleVersion(key: string, reader: EngagementReader, no: number, effectiveFrom: string | null): EngagementAnswer<{ effectiveFrom: string }> {
  const t = engagementOf(key);
  const staff = staffOf(reader);
  const version = t.versions.find((candidate) => candidate.no === no);
  if (version === undefined) return refuse("AWARD_RULE_VERSION_NOT_FOUND");
  if (staff === null) return refuse("ROLE_OUT_OF_SCOPE");
  const subject = `ARV-${no}`;
  if (same(version.preparedBy, staff)) {
    audit(t, staff, "approve_award_rule_version", subject, "AWARD_RULE_SELF_APPROVAL");
    return refuse("AWARD_RULE_SELF_APPROVAL");
  }
  if (!holds(staff, "ACT-POL-APR")) return refuse("ROLE_OUT_OF_SCOPE");
  const at = ms(now());
  if (stateOf(version, at) !== "PREPARED") return refuse("AWARD_RULE_ALREADY_APPROVED");
  if (version.actions.length === 0) return refuse("FIELD_MISSING", { field: "actions" });
  const instant = effectiveFrom ?? version.effectiveFrom;
  if (instant === null) return refuse("FIELD_MISSING", { field: "effective_from" });
  if (ms(instant) <= at) {
    audit(t, staff, "approve_award_rule_version", subject, "EFFECTIVE_FROM_IN_PAST");
    return refuse("EFFECTIVE_FROM_IN_PAST");
  }
  const rival = t.versions.find((other) => other !== version && other.approvedAt !== null && other.withdrawnAt === null && other.effectiveFrom !== null && ms(other.effectiveFrom) === ms(instant));
  if (rival !== undefined) {
    audit(t, staff, "approve_award_rule_version", subject, "EFFECTIVE_PERIOD_OVERLAP");
    return refuse("EFFECTIVE_PERIOD_OVERLAP", { version: rival.no });
  }
  const covering = governing(t, ms(instant));
  if (covering !== null) {
    version.effectiveTo = covering.version.effectiveTo;
    covering.version.effectiveTo = instant;
  } else {
    const later = t.versions
      .filter((other) => other.approvedAt !== null && other.effectiveFrom !== null && ms(other.effectiveFrom) > ms(instant))
      .sort((a, b) => ms(a.effectiveFrom ?? "") - ms(b.effectiveFrom ?? ""))[0];
    version.effectiveTo = later?.effectiveFrom ?? null;
  }
  version.effectiveFrom = instant;
  version.approvedBy = actorOf(staff);
  version.approvedAt = now();
  return accept({ effectiveFrom: instant });
}

/**
 * POST .../withdraw (`DR-67` rows 6 and 7): a PREPARED or APPROVED version, with a reason. An approved version keeps
 * the instant it was approved with, so once that instant passes it covers its period withdrawn (`DR-62` row 3).
 */
export function withdrawRuleVersion(key: string, reader: EngagementReader, no: number, reason: string): EngagementAnswer<{ no: number }> {
  const t = engagementOf(key);
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-POL-APR")) return refuse("ROLE_OUT_OF_SCOPE");
  const version = t.versions.find((candidate) => candidate.no === no);
  if (version === undefined) return refuse("AWARD_RULE_VERSION_NOT_FOUND");
  const state = stateOf(version, ms(now()));
  if (state !== "PREPARED" && state !== "APPROVED") return refuse("AWARD_RULE_NOT_PREPARED");
  if (blank(reason)) return refuse("FIELD_MISSING", { field: "reason" });
  version.withdrawnBy = actorOf(staff);
  version.withdrawnAt = now();
  version.withdrawalReason = reason.trim();
  return accept({ no });
}

// ------------------------------------------------------------------ SCR-ENG-13: disclosure versions

/** Every disclosure version with its period, for the policy console. */
export function disclosureVersions(key: string, reader: EngagementReader): LoadOutcome<DisclosureVersionsView> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-DPO", "ACT-POL-PRE", "ACT-POL-APR", "ACT-AUD")) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = ms(now());
  return ok({
    versions: [...t.disclosures].sort((a, b) => a.no - b.no).map((version) => disclosureView(version, at, t.disclosures)),
    dpo: holds(staff, "ACT-DPO"),
    lapsed: effectiveDisclosure(t, at) === null,
  });
}

/**
 * POST /engagement/disclosure-versions (`PERM-140`): the DPO's, with both languages and the reserving decision; the
 * refusal names what is missing rather than saying *incomplete*. The version it supersedes ends at its instant.
 */
export function approveDisclosure(
  key: string,
  reader: EngagementReader,
  draft: { textEn: string; textVi: string; reservingDecision: string; effectiveFrom: string | null },
): EngagementAnswer<{ no: number }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-DPO")) return refuse("ROLE_OUT_OF_SCOPE");
  if (blank(draft.textVi)) return refuse("DISCLOSURE_TEXT_INCOMPLETE", { missing: "vi" });
  if (blank(draft.textEn)) return refuse("DISCLOSURE_TEXT_INCOMPLETE", { missing: "en" });
  if (blank(draft.reservingDecision)) return refuse("DISCLOSURE_TEXT_INCOMPLETE", { missing: "decision" });
  if (draft.effectiveFrom === null) return refuse("FIELD_MISSING", { field: "effective_from" });
  const t = engagementOf(key);
  const instant = draft.effectiveFrom;
  for (const version of t.disclosures) {
    if (ms(version.effectiveFrom) < ms(instant) && (version.effectiveTo === null || ms(version.effectiveTo) > ms(instant))) version.effectiveTo = instant;
  }
  const later = t.disclosures.filter((version) => ms(version.effectiveFrom) > ms(instant)).sort((a, b) => ms(a.effectiveFrom) - ms(b.effectiveFrom))[0];
  const no = Math.max(0, ...t.disclosures.map((version) => version.no)) + 1;
  t.disclosures.push({
    no,
    textEn: draft.textEn.trim(),
    textVi: draft.textVi.trim(),
    reservingDecision: draft.reservingDecision.trim(),
    effectiveFrom: instant,
    effectiveTo: later?.effectiveFrom ?? null,
    approvedBy: actorOf(staff),
    approvedAt: now(),
  });
  // NTF-ENG-02, due at the instant the version becomes effective: `marketplace.engagement_disclosure_changed`.
  notify(
    key,
    t,
    "NTF-ENG-02",
    {
      eventKind: "engagement_disclosure_changed",
      occurrence: `DSC-${String(no)}`,
      occurredAt: instant,
      subjectKind: "disclosure_version",
      subjectRef: `DSC-${String(no)}`,
      facts: { disclosure: String(no), effectiveFrom: instant },
    },
    false,
  );
  return accept({ no });
}

/**
 * Ending the effective disclosure version with none to follow, the DPO's (`PERM-140`), as UAT-ENG-07 asks when it
 * expires the version and requests a balance: the end instant is the one column of a version that may change
 * (`marketplace.disclosure_versions`), so the text and the period it was shown for stay readable. From now no figure is
 * shown anywhere (`DR-65` row 5, DISCLOSURE_VERSION_NOT_EFFECTIVE) until a new version becomes effective; a version
 * already approved for later keeps its own instant. No point anybody holds changes, and the act is on the audit log.
 */
export function endDisclosure(key: string, reader: EngagementReader): EngagementAnswer<{ no: number; endedAt: string }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-DPO")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = now();
  const effective = effectiveDisclosure(t, ms(at));
  if (effective === null) return refuse("DISCLOSURE_VERSION_NOT_EFFECTIVE");
  effective.effectiveTo = at;
  audit(t, staff, "end_disclosure_version", `DSC-${String(effective.no)}`, null);
  return accept({ no: effective.no, endedAt: at });
}

// ------------------------------------------------------------------ the engagement workspace's home

const WORKSPACE: readonly StaffRole[] = ["ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD"];

/** The capability, and for the operations officer and the approver the corrections still waiting for a second person. */
export function engagementHome(key: string, reader: EngagementReader): LoadOutcome<EngagementHomeView> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, ...WORKSPACE)) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const awaiting = holds(staff, "ACT-OPS", "ACT-BIZ-APR")
    ? t.corrections
        .filter((correction) => correction.authorisedAt === null)
        .sort((a, b) => ms(b.proposedAt) - ms(a.proposedAt))
        .flatMap((correction): CorrectionSummary[] => {
          const target = t.events.find((event) => event.id === correction.target);
          const participation = t.participations.find((candidate) => candidate.id === target?.participation);
          if (target === undefined || participation === undefined) return [];
          return [{ id: correction.id, participant: participation.party, event: target.id, delta: correction.delta, ground: correction.ground, proposedBy: shown(correction.proposedBy), proposedAt: correction.proposedAt }];
        })
    : null;
  return ok({ capability: capabilityOf(t, ms(now())), awaiting });
}

// ------------------------------------------------------------------ SCR-ENG-08: a qualifying action recorded by hand

/** A party reference that resolves to a participation taking part, or the refusal that names the field. */
function enrolledParticipation(t: EngagementTable, ref: string): StoredParticipation | null {
  const participation = participationOfParty(t, ref.trim().toUpperCase());
  return participation !== null && participation.state !== "WITHDRAWN" ? participation : null;
}

/** `DR-62`'s refusals, with what SCR-ENG-08 names: the version and who withdrew it, or the gap in the rule set. */
function ruleRefusal(t: EngagementTable, at: number): Refused | StoredVersion {
  const rule = governing(t, at);
  if (rule === null) return refuse("AWARD_RULE_NOT_EFFECTIVE");
  if (rule.withdrawn) {
    return refuse("AWARD_RULE_WITHDRAWN", { version: rule.version.no, withdrawnAt: rule.version.withdrawnAt ?? "", withdrawnBy: rule.version.withdrawnBy?.name ?? "" });
  }
  return rule.version;
}

/**
 * SCR-ENG-08's read: the capability, and once a participant and an instant are asked, the version governing that
 * instant with the codes it lists for the participant's class. The value is resolved, never chosen.
 */
export function qualifyingActionForm(key: string, reader: EngagementReader, asked: { participant: string; at: string } | null): LoadOutcome<QualifyingActionForm> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-MKT-OP")) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = ms(now());
  const base: QualifyingActionForm = { capability: capabilityOf(t, at), mayRecord: true, asked, participant: null, profiles: [], resolution: null, refusal: null };
  if (asked === null) return ok(base);
  const participation = enrolledParticipation(t, asked.participant);
  if (participation === null) return ok({ ...base, refusal: { code: "FIELD_MISSING", values: { field: "participant" } } });
  const known = { ...base, participant: participation.party, profiles: profilesOf(participation.party) };
  const instant = ms(asked.at);
  if (Number.isNaN(instant) || instant > at) return ok({ ...known, refusal: { code: "FIELD_MISSING", values: { field: "action_occurred_at" } } });
  const version = ruleRefusal(t, instant);
  if ("refusal" in version) return ok({ ...known, refusal: version.refusal });
  const codes = version.actions.filter((action) => action.participantClass === participation.party.participantClass).map((action) => ({ code: action.code, value: action.value }));
  return ok({ ...known, resolution: { version: { no: version.no, effectiveFrom: version.effectiveFrom ?? "" }, codes } });
}

/**
 * POST /engagement/qualifying-actions, in `DR-61`, `DR-62` and `DR-63`'s order: the capability, the participant, the
 * governing version, whether it lists the code for the participant's class, then the receipt. The receipt's key has
 * four columns, the subject among them (the track a publication was of, or `-` for an act with no subject beyond the
 * participant), so two tracks published in one instant are two actions. The display profile the act happened under is
 * one of the participant's (`FR-ART-006`), the participation's own when none is named, and the event is attributed to
 * it rather than to the participation (`AC-FR-ENG-011-02`). A replay returns the event recorded the first time; the
 * same four values with a different payload digest are a conflict, never an overwrite (`DR-63` row 3). The event
 * consumer sends the digest of the payload it received; an action recorded by hand is digested from what it resolves
 * to: the governing version, the value and the display profile, so the same act claimed under another profile is one.
 */
export function recordQualifyingAction(
  key: string,
  reader: EngagementReader,
  input: { participant: string; code: string; at: string | null; subject?: string | null; profile?: string | null; digest?: string | null },
): EngagementAnswer<Recorded> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-MKT-OP")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = ms(now());
  const capability = capabilityOf(t, at);
  if (capability.state === "WITHHELD") return refuse("CAPABILITY_WITHHELD");
  if (capability.state === "SUSPENDED") return refuse("CAPABILITY_SUSPENDED");
  const participation = enrolledParticipation(t, input.participant);
  if (participation === null) return refuse("FIELD_MISSING", { field: "participant" });
  if (input.at === null || ms(input.at) > at) return refuse("FIELD_MISSING", { field: "action_occurred_at" });
  if (blank(input.code)) return refuse("FIELD_MISSING", { field: "action_code" });
  const asked = input.profile?.trim() ?? "";
  const profile = asked === "" ? participation.displayProfile : profilesOf(participation.party).find((candidate) => candidate.ref === asked);
  if (profile === undefined) return refuse("FIELD_MISSING", { field: "display_profile_ref" });
  const version = ruleRefusal(t, ms(input.at));
  if ("refusal" in version) {
    audit(t, staff, "record_qualifying_action", participation.party.ref, version.refusal.code, input.code);
    return version;
  }
  const action = version.actions.find((candidate) => candidate.code === input.code && candidate.participantClass === participation.party.participantClass);
  if (action === undefined) {
    return refuse("QUALIFYING_ACTION_NOT_RECOGNISED", {
      version: version.no,
      codes: version.actions.filter((candidate) => candidate.participantClass === participation.party.participantClass).map((candidate) => candidate.code).join(", "),
    });
  }
  const subject = input.subject?.trim() || "-";
  const digest = input.digest?.trim() || `${version.no}:${action.value}:${profile.ref}`;
  const receipt = t.receipts.find(
    (candidate) => candidate.participation === participation.id && candidate.code === action.code && candidate.subject === subject && ms(candidate.occurredAt) === ms(input.at ?? ""),
  );
  if (receipt !== undefined) {
    if (receipt.digest !== digest) {
      audit(t, staff, "record_qualifying_action", participation.party.ref, "QUALIFYING_ACTION_CONFLICT", receipt.event);
      return refuse("QUALIFYING_ACTION_CONFLICT", { event: receipt.event });
    }
    const first = t.events.find((event) => event.id === receipt.event);
    return accept({ event: receipt.event, points: first?.points ?? action.value, replay: true });
  }
  const event: StoredEvent = {
    id: reference("LDG"),
    participation: participation.id,
    displayProfile: { ...profile },
    kind: "award",
    actionCode: action.code,
    occurredAt: input.at,
    governingNo: version.no,
    points: action.value,
    recordedAt: now(),
    recordedBy: actorOf(staff),
    corrects: null,
    ground: null,
  };
  t.events.push(event);
  t.receipts.push({ participation: participation.id, code: action.code, subject, occurredAt: input.at, event: event.id, digest });
  return accept({ event: event.id, points: event.points, replay: false });
}

// ------------------------------------------------------------------ SCR-ENG-10: a support read

/**
 * GET /engagement/participants/{participantRef}/balance (`PERM-130`): the purpose is required before the read, and
 * the read is recorded against the officer with it, refused or not.
 */
export function supportRead(key: string, reader: EngagementReader, participantRef: string, purpose: string): EngagementAnswer<{ read: string }> {
  const staff = staffOf(reader);
  const t = engagementOf(key);
  if (staff === null || !holds(staff, "ACT-OPS")) {
    if (staff !== null) audit(t, staff, "read_participant_balance", participantRef, "ROLE_OUT_OF_SCOPE");
    return refuse("ROLE_OUT_OF_SCOPE");
  }
  const ref = participantRef.trim().toUpperCase();
  if (ref === "") return refuse("FIELD_MISSING", { field: "participant" });
  if (blank(purpose)) {
    audit(t, staff, "read_participant_balance", ref, "FIELD_MISSING", "purpose");
    return refuse("FIELD_MISSING", { field: "purpose" });
  }
  if (partyByRef(t, ref) === null) return refuse("FIELD_MISSING", { field: "participant" });
  const read: StoredRead = { id: reference("SRD"), by: actorOf(staff), party: ref, purpose: purpose.trim(), at: now() };
  t.reads.push(read);
  audit(t, staff, "read_participant_balance", ref, null, read.purpose);
  return accept({ read: read.id });
}

/** The support read the officer recorded, or PARTICIPANT_NOT_SELF for any read that is not theirs. */
function ownRead(t: EngagementTable, staff: Staff, readId: string): StoredRead | null {
  return t.reads.find((read) => read.id === readId && same(read.by, staff)) ?? null;
}

/** SCR-ENG-10's view of a recorded read: the same figure the participant sees, and a page of history. */
export function supportView(key: string, reader: EngagementReader, readId: string, cursor: string | null, selected: string | null): LoadOutcome<SupportViewData> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-OPS")) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const read = ownRead(t, staff, readId);
  const party = read !== null ? partyByRef(t, read.party) : null;
  if (read === null || party === null) return refused("PARTICIPANT_NOT_SELF");
  const participation = participationOfParty(t, party.ref);
  const events = participation !== null ? eventsOf(t, participation.id) : [];
  const chosen = events.find((event) => event.id === selected) ?? null;
  return ok({
    read: { id: read.id, purpose: read.purpose, at: read.at },
    participant: party,
    participation: participation !== null ? { state: participation.state, enrolledAt: participation.enrolledAt } : null,
    points: sum(events),
    eventCount: events.length,
    history: pageOf(t, events, cursor, ms(now())),
    selected: chosen !== null ? eventView(t, chosen) : null,
  });
}

// ------------------------------------------------------------------ SCR-ENG-09: corrections

/** The event a correction is proposed against, read under the officer's support read for its participant. */
function eventUnderRead(t: EngagementTable, read: StoredRead, eventId: string): StoredEvent | null {
  const event = t.events.find((candidate) => candidate.id === eventId);
  const participation = t.participations.find((candidate) => candidate.id === event?.participation);
  return event !== undefined && participation?.party.ref === read.party ? event : null;
}

const balanceOfParticipation = (t: EngagementTable, participation: string) => sum(eventsOf(t, participation));

/** SCR-ENG-09 before a proposal, reached from the support view only: the event, its participant and balance. */
export function correctionDraft(key: string, reader: EngagementReader, readId: string, eventId: string): LoadOutcome<CorrectionDraftView> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-OPS")) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const read = ownRead(t, staff, readId);
  if (read === null) return refused("PARTICIPANT_NOT_SELF");
  const event = eventUnderRead(t, read, eventId);
  if (event === null) return refused("LEDGER_EVENT_NOT_FOUND");
  const capability = capabilityOf(t, ms(now()));
  return ok({ read: read.id, event: eventView(t, event), balance: balanceOfParticipation(t, event.participation), capability, mayPropose: capability.state !== "WITHHELD" });
}

/** Whether an event already carries a correction, recorded or still waiting for its second person. */
const carriesCorrection = (t: EngagementTable, event: string) =>
  correctingOf(t, event) !== null || t.corrections.some((correction) => correction.target === event && correction.authorisedAt === null);

/**
 * POST /engagement/corrections, in `DR-64`'s order: the ground from `CFG-65` (row 3), the target (rows 5 and 6), and a
 * whole-number delta. A proposal records no ledger event; it waits for a second person.
 */
export function proposeCorrection(key: string, reader: EngagementReader, readId: string, input: { event: string; ground: string; delta: string }): EngagementAnswer<{ correction: string }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-OPS")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const read = ownRead(t, staff, readId);
  if (read === null) return refuse("PARTICIPANT_NOT_SELF");
  if (capabilityOf(t, ms(now())).state === "WITHHELD") return refuse("CAPABILITY_WITHHELD");
  const ground = CORRECTION_GROUNDS.find((candidate) => candidate === input.ground);
  if (ground === undefined) return refuse("CORRECTION_GROUND_NOT_APPROVED", { grounds: CORRECTION_GROUNDS.join(", ") });
  const event = eventUnderRead(t, read, input.event);
  if (event === null) return refuse("CORRECTION_TARGET_NOT_FOUND");
  if (carriesCorrection(t, event.id)) return refuse("CORRECTION_TARGET_ALREADY_CORRECTED", { next: correctingOf(t, event.id)?.id ?? "" });
  const delta = input.delta.trim().replace(/^[−–]/, "-");
  if (!/^[-+]?\d+$/.test(delta) || Number(delta) === 0) return refuse("FIELD_MISSING", { field: "point_delta" });
  const correction: StoredCorrection = {
    id: reference("ECR"),
    target: event.id,
    ground,
    delta: Number(delta),
    proposedBy: actorOf(staff),
    proposedAt: now(),
    read: read.id,
    authorisedBy: null,
    authorisedAt: null,
    event: null,
  };
  t.corrections.push(correction);
  return accept({ correction: correction.id });
}

function readerOfCorrection(staff: Staff, correction: StoredCorrection, target: StoredEvent): CorrectionReader {
  if (same(correction.proposedBy, staff)) return "proposer";
  if (same(target.recordedBy, staff)) return "recorder";
  return holds(staff, "ACT-BIZ-APR") ? "approver" : "no-role";
}

/** SCR-ENG-09 after a proposal: the event, both actors, and where the reader stands to the authorisation. */
export function correctionView(key: string, reader: EngagementReader, id: string): LoadOutcome<CorrectionViewData> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-OPS", "ACT-BIZ-APR")) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const correction = t.corrections.find((candidate) => candidate.id === id);
  const target = t.events.find((event) => event.id === correction?.target);
  if (correction === undefined || target === undefined) return refused("NOT_FOUND");
  const balance = balanceOfParticipation(t, target.participation);
  const standing = readerOfCorrection(staff, correction, target);
  return ok({
    id: correction.id,
    capability: capabilityOf(t, ms(now())),
    event: eventView(t, target),
    balance,
    ground: correction.ground,
    delta: correction.delta,
    resulting: correction.event !== null ? balance : balance + correction.delta,
    proposedBy: shown(correction.proposedBy),
    proposedAt: correction.proposedAt,
    authorisedBy: correction.authorisedBy !== null ? shown(correction.authorisedBy) : null,
    authorisedAt: correction.authorisedAt,
    correctingEvent: correction.event,
    reader: standing,
    read: standing === "proposer" ? correction.read : null,
  });
}

/**
 * POST /engagement/corrections/{correctionId}/authorise, in `DR-64`'s order: the proposer (row 4) and the recorder of
 * the event (row 7) are refused on the recorded actor before the role is read, then the role, the correction already
 * authorised, the capability and the target corrected meanwhile. While the capability is withheld no correction is
 * recorded, as SCR-ENG-09's governed-withheld state says, so a proposal made before a release was withdrawn waits
 * rather than writing to the ledger. Authorised, a correcting event names the event it corrects and keeps its
 * governing version and profile; the event corrected is never changed.
 */
export function authoriseCorrection(key: string, reader: EngagementReader, id: string): EngagementAnswer<{ event: string; balance: number }> {
  const staff = staffOf(reader);
  if (staff === null) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const correction = t.corrections.find((candidate) => candidate.id === id);
  const target = t.events.find((event) => event.id === correction?.target);
  if (correction === undefined || target === undefined) return refuse("CORRECTION_TARGET_NOT_FOUND");
  if (same(correction.proposedBy, staff)) {
    audit(t, staff, "authorise_correction", id, "CORRECTION_SELF_AUTHORISATION");
    return refuse("CORRECTION_SELF_AUTHORISATION");
  }
  if (same(target.recordedBy, staff)) {
    audit(t, staff, "authorise_correction", id, "CORRECTION_RECORDER_CONFLICT");
    return refuse("CORRECTION_RECORDER_CONFLICT");
  }
  if (!holds(staff, "ACT-BIZ-APR")) return refuse("ROLE_OUT_OF_SCOPE");
  if (correction.authorisedAt !== null) return refuse("CORRECTION_ALREADY_AUTHORISED");
  if (capabilityOf(t, ms(now())).state === "WITHHELD") return refuse("CAPABILITY_WITHHELD");
  const earlier = correctingOf(t, target.id);
  if (earlier !== null) return refuse("CORRECTION_TARGET_ALREADY_CORRECTED", { next: earlier.id });
  const at = now();
  const event: StoredEvent = {
    id: reference("LDG"),
    participation: target.participation,
    displayProfile: target.displayProfile,
    kind: "correction",
    actionCode: null,
    occurredAt: null,
    governingNo: target.governingNo,
    points: correction.delta,
    recordedAt: at,
    recordedBy: actorOf(staff),
    corrects: target.id,
    ground: correction.ground,
  };
  t.events.push(event);
  correction.authorisedBy = actorOf(staff);
  correction.authorisedAt = at;
  correction.event = event.id;
  return accept({ event: event.id, balance: balanceOfParticipation(t, target.participation) });
}

// ------------------------------------------------------------------ NTF-ENG-01 and 02: what COM is told

/** What a notice is about, as the outbox message carries it to COM. */
interface NoticeSubject {
  eventKind: string;
  /** The occurrence the notice is keyed on, before the recipient is added to it. */
  occurrence: string;
  occurredAt: string;
  subjectKind: string;
  subjectRef: string;
  facts: Readonly<Record<string, string>>;
}

/**
 * The outbox message a capability transition (`NTF-ENG-01`) or a new disclosure version (`NTF-ENG-02`) writes, handed
 * to COM once per recipient (`recordNoticeEvent`): every participant taking part and, for a transition, the operations
 * role. COM raises the notice its policy in force requires for the event. Where it requires none, the act stands and
 * the message is kept on the audit log as not raised, the operations exception `frd/08` names: the capability's state
 * and the version are facts whether or not a notice arrived.
 */
function notify(key: string, t: EngagementTable, notice: StoredMessage["notice"], subject: NoticeSubject, operations: boolean): void {
  const recipients: (string | null)[] = [...t.participations.filter(takingPart).map((participation) => recipientOf(participation.party)), ...(operations ? [null] : [])];
  for (const recipient of recipients) {
    const occurrence = `${subject.occurrence}/${recipient ?? "ACT-OPS"}`;
    const raised = recordNoticeEvent(key, {
      sourceModule: "ENG",
      eventKind: subject.eventKind,
      occurrenceRef: occurrence,
      occurredAt: subject.occurredAt,
      subjectKind: subject.subjectKind,
      subjectRef: subject.subjectRef,
      recipientPartyId: recipient,
      // NTF-ENG-01's operational recipient is ACT-OPS (frd/08), told at the office COM's contact register names for the
      // class; a participant is told at the address its party record holds.
      destination: recipient === null ? officeDestinationOf(key, subject.eventKind) : null,
      facts: { ...subject.facts, by: addDays(subject.occurredAt, 0) },
    });
    t.outbox.push({ notice, occurrence, recipient, raised, at: now() });
    if (raised === null) recordAttempt(t, "marketplace", "raise_notice", occurrence, "NOTICE_NOT_RAISED", subject.eventKind);
  }
}

/** `NTF-ENG-01` for the transition just written: `marketplace.engagement_capability_changed`, keyed on the release and its state. */
function notifyTransition(key: string, t: EngagementTable, release: StoredRelease, occurredAt: string): void {
  const count = t.transitions.filter((transition) => transition.release === release.id).length;
  notify(
    key,
    t,
    "NTF-ENG-01",
    {
      eventKind: "engagement_capability_changed",
      occurrence: `${release.id}/${release.state}/${String(count)}`,
      occurredAt,
      subjectKind: "capability_release",
      subjectRef: release.id,
      facts: { release: release.id, to: release.state, scope: release.scope.join(","), at: occurredAt },
    },
    true,
  );
}

// ------------------------------------------------------------------ SCR-ENG-12: the capability release

/** GET /engagement/capability-release for the operations console: the state, the conditions, the release and its history. */
export function capabilityRelease(key: string, reader: EngagementReader): LoadOutcome<CapabilityReleaseView> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-BIZ-APR", "ACT-OPS", "ACT-AUD")) return refused("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const at = ms(now());
  const release = currentRelease(t);
  return ok({
    capability: capabilityOf(t, at),
    release:
      release !== null
        ? { id: release.id, state: release.state, scope: [...release.scope], effectiveFrom: release.effectiveFrom, approvedBy: shown(release.approvedBy), approvedAt: release.approvedAt }
        : null,
    conditions: conditionsOf(t, at),
    history: t.transitions
      .slice()
      .sort((a, b) => ms(b.at) - ms(a.at))
      .map((entry) => ({ from: entry.from, to: entry.to, actor: shown(entry.actor), ground: entry.ground, at: entry.at })),
    mayAct: holds(staff, "ACT-BIZ-APR"),
  });
}

/** The first condition that carries no effective evidence, named, never counted. */
const unevidenced = (conditions: readonly ReleaseCondition[]) => conditions.find((condition) => !condition.effective) ?? null;

/**
 * POST /engagement/capability-release (`SM-52` transition 1, `PERM-142`): the independent approver, who did not
 * approve the disclosure the capability presents, names the scope and the instant; every condition must carry
 * evidence effective now, and the release records each with its evidence.
 */
export function recordRelease(key: string, reader: EngagementReader, input: { scope: readonly string[]; effectiveFrom: string | null }): EngagementAnswer<{ release: string }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-BIZ-APR")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const existing = currentRelease(t);
  if (existing !== null) return accept({ release: existing.id });
  const at = ms(now());
  const disclosure = effectiveDisclosure(t, at);
  if (disclosure !== null && same(disclosure.approvedBy, staff)) {
    audit(t, staff, "record_capability_release", "CG-ENG", "ROLE_OUT_OF_SCOPE", "approved the disclosure version");
    return refuse("ROLE_OUT_OF_SCOPE");
  }
  const scope = CLASSES.filter((candidate) => input.scope.includes(candidate));
  if (scope.length === 0) return refuse("FIELD_MISSING", { field: "scope" });
  if (input.effectiveFrom === null) return refuse("FIELD_MISSING", { field: "effective_from" });
  const conditions = conditionsOf(t, at);
  const missing = unevidenced(conditions);
  if (missing !== null) {
    audit(t, staff, "record_capability_release", "CG-ENG", "RELEASE_CONDITION_NOT_EVIDENCED", missing.code);
    return refuse("RELEASE_CONDITION_NOT_EVIDENCED", { condition: missing.code });
  }
  const release: StoredRelease = {
    id: reference("CRL"),
    state: "RELEASED",
    scope,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    approvedBy: actorOf(staff),
    approvedAt: now(),
    conditions,
  };
  t.releases.push(release);
  t.transitions.push({ release: release.id, from: "WITHHELD", to: "RELEASED", actor: actorOf(staff), ground: null, at: now() });
  // Participants are told when it starts to operate, which is the instant they can take part from.
  notifyTransition(key, t, release, release.effectiveFrom);
  return accept({ release: release.id });
}

/** POST .../suspend (transition 2): awards stop for every participant, and every participation taking part is SUSPENDED. */
export function suspendRelease(key: string, reader: EngagementReader, ground: string): EngagementAnswer<{ release: string }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-BIZ-APR")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const release = currentRelease(t);
  if (release === null || release.state !== "RELEASED") return refuse("CAPABILITY_WITHHELD");
  if (blank(ground)) return refuse("FIELD_MISSING", { field: "ground" });
  const at = now();
  release.state = "SUSPENDED";
  for (const participation of t.participations) if (participation.state === "ENROLLED") transition(participation, "SUSPENDED", at);
  t.transitions.push({ release: release.id, from: "RELEASED", to: "SUSPENDED", actor: actorOf(staff), ground: ground.trim(), at });
  notifyTransition(key, t, release, at);
  return accept({ release: release.id });
}

/** POST .../resume (transition 3): only once every condition is effective again; suspended participations take part again. */
export function resumeRelease(key: string, reader: EngagementReader): EngagementAnswer<{ release: string }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-BIZ-APR")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const release = currentRelease(t);
  if (release === null || release.state !== "SUSPENDED") return refuse("CAPABILITY_WITHHELD");
  const conditions = conditionsOf(t, ms(now()));
  const missing = unevidenced(conditions);
  if (missing !== null) return refuse("RELEASE_CONDITION_NOT_EVIDENCED", { condition: missing.code });
  const at = now();
  release.state = "RELEASED";
  release.conditions = conditions;
  for (const participation of t.participations) if (participation.state === "SUSPENDED") transition(participation, "ENROLLED", at);
  t.transitions.push({ release: release.id, from: "SUSPENDED", to: "RELEASED", actor: actorOf(staff), ground: null, at });
  notifyTransition(key, t, release, at);
  return accept({ release: release.id });
}

/** POST .../withdraw (transitions 4 and 5): the capability is withheld again; no recorded event is removed. */
export function withdrawRelease(key: string, reader: EngagementReader, ground: string): EngagementAnswer<{ release: string }> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, "ACT-BIZ-APR")) return refuse("ROLE_OUT_OF_SCOPE");
  const t = engagementOf(key);
  const release = currentRelease(t);
  if (release === null) return refuse("CAPABILITY_WITHHELD");
  if (blank(ground)) return refuse("FIELD_MISSING", { field: "ground" });
  const at = now();
  t.transitions.push({ release: release.id, from: release.state, to: "WITHHELD", actor: actorOf(staff), ground: ground.trim(), at });
  release.state = "WITHHELD";
  release.effectiveTo = at;
  notifyTransition(key, t, release, at);
  return accept({ release: release.id });
}

// ------------------------------------------------------------------ SCR-ENG-11: metrics

const METRICS: readonly MetricCode[] = METRIC_DEFINITIONS.map((definition) => definition.code);

/** The definition version in force for a metric: the newest whose effective instant has passed. */
function currentDefinition(t: EngagementTable, code: MetricCode, at: number): StoredDefinition | null {
  return (
    t.definitions
      .filter((definition) => definition.code === code && ms(definition.effectiveFrom) <= at && (definition.effectiveTo === null || at < ms(definition.effectiveTo)))
      .sort((a, b) => b.no - a.no)[0] ?? null
  );
}

const definitionView = (definition: StoredDefinition): MetricDefinition => ({
  code: definition.code,
  no: definition.no,
  statement: definition.statement,
  ownerRole: definition.ownerRole,
  effectiveFrom: definition.effectiveFrom,
  approvedBy: definition.approvedBy !== null ? shown(definition.approvedBy) : null,
  approvedAt: definition.approvedAt,
});

const snapshotView = (snapshot: StoredSnapshot): MetricSnapshot => ({
  id: snapshot.id,
  metric: snapshot.metric,
  definitionNo: snapshot.definitionNo,
  period: { from: snapshot.periodFrom, to: snapshot.periodTo },
  cutOff: snapshot.cutOff,
  figure: snapshot.figure,
  ledgerFigure: snapshot.ledgerFigure,
  variance: snapshot.figure - snapshot.ledgerFigure,
  outcome: snapshot.outcome,
  state: snapshot.state,
  publishedBy: snapshot.publishedBy !== null ? shown(snapshot.publishedBy) : null,
});

/** A month as "2026-09", its first and last day, and the instant it closes (the first moment of the next month). */
function monthOf(value: string): { from: string; to: string; closes: string } | null {
  const parts = /^(\d{4})-(\d{2})$/.exec(value);
  if (parts === null) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  if (month < 1 || month > 12) return null;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const from = `${value}-01`;
  return { from, to: addDays(`${next}-01T00:00:00+07:00`, -1), closes: `${next}-01T00:00:00+07:00` };
}

/** The months a snapshot can be asked for: this one and the five before it, newest first, with their first and last day. */
function recentMonths(): MetricsView["months"] {
  const [year = 0, month = 1] = today().split("-").map(Number);
  return Array.from({ length: 6 }, (_, back) => {
    const total = year * 12 + (month - 1) - back;
    const value = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
    const bounds = monthOf(value);
    return { value, from: bounds?.from ?? value, to: bounds?.to ?? value };
  });
}

/**
 * `ALG-37`: the figure as the definition reads it, and the same arithmetic run a second time from the ledger directly.
 * The two share no helper, so a reconciliation proves something; an empty period is told apart from a reconciled one.
 */
function measure(t: EngagementTable, metric: MetricCode, from: string, closes: string, cutOff: string): { figure: number; ledgerFigure: number; empty: boolean } {
  const start = ms(`${from}T00:00:00+07:00`);
  const end = ms(closes);
  const cut = ms(cutOff);
  if (metric === "POINTS_AWARDED") {
    const inPeriod = t.events.filter((event) => ms(event.recordedAt) >= start && ms(event.recordedAt) < end && ms(event.recordedAt) <= cut);
    const figure = inPeriod.map((event) => event.points).reduce((a, b) => a + b, 0);
    let ledgerFigure = 0;
    for (const event of t.events) if (ms(event.recordedAt) >= start && ms(event.recordedAt) < end && ms(event.recordedAt) <= cut) ledgerFigure += event.points;
    return { figure, ledgerFigure, empty: inPeriod.length === 0 };
  }
  const stateAt = (participation: StoredParticipation) => participation.history.filter((entry) => ms(entry.at) < end).at(-1)?.to ?? "NOT_ENROLLED";
  const figure = t.participations.filter((participation) => stateAt(participation) === "ENROLLED").length;
  let ledgerFigure = 0;
  for (const participation of t.participations) {
    let state: ParticipationState = "NOT_ENROLLED";
    for (const entry of participation.history) if (ms(entry.at) < end) state = entry.to;
    if (state === "ENROLLED") ledgerFigure += 1;
  }
  return { figure, ledgerFigure, empty: figure === 0 && ledgerFigure === 0 };
}

const METRIC_READERS: readonly StaffRole[] = ["ACT-REP", "ACT-AUD"];

/** GET /engagement/metrics: the definitions and every snapshot, refused or published, with both figures. */
export function engagementMetrics(key: string, reader: EngagementReader, metric: string | null, snapshot: string | null): LoadOutcome<MetricsView> {
  const staff = staffOf(reader);
  if (staff === null || !holds(staff, ...METRIC_READERS)) return refused("ROLE_OUT_OF_SCOPE");
  const filter = metric === null ? null : (METRICS.find((code) => code === metric) ?? undefined);
  if (filter === undefined) return refused("METRIC_NOT_FOUND");
  const t = engagementOf(key);
  const snapshots = t.snapshots
    .filter((candidate) => filter === null || candidate.metric === filter)
    .sort((a, b) => b.periodFrom.localeCompare(a.periodFrom) || a.metric.localeCompare(b.metric));
  const selected = snapshots.find((candidate) => candidate.id === snapshot) ?? null;
  return ok({
    definitions: [...t.definitions].sort((a, b) => a.code.localeCompare(b.code) || b.no - a.no).map(definitionView),
    snapshots: snapshots.map(snapshotView),
    filter,
    selected: selected !== null ? snapshotView(selected) : null,
    months: recentMonths(),
    owner: holds(staff, METRIC_OWNER_ROLE),
  });
}

/** The metric a definition or snapshot names, and whether the actor holds its owner role (`PERM-141`). */
function owned(t: EngagementTable, staff: Staff, metric: string, act: string): MetricCode | Refused {
  const code = METRICS.find((candidate) => candidate === metric);
  if (code === undefined) return refuse("METRIC_NOT_FOUND");
  if (!holds(staff, METRIC_OWNER_ROLE)) {
    audit(t, staff, act, code, "METRIC_DEFINITION_NOT_OWNER");
    return refuse("METRIC_DEFINITION_NOT_OWNER", { owner: METRIC_OWNER_ROLE });
  }
  return code;
}

/**
 * POST /engagement/metric-definitions: a new definition version, approved by the holder of the owner role; the version
 * in force ends at its instant. An approved version of both metrics is the evidence of `CG-ENG`'s metric ownership.
 */
export function defineMetric(key: string, reader: EngagementReader, metric: string, statement: string, effectiveFrom: string | null): EngagementAnswer<{ no: number }> {
  const t = engagementOf(key);
  const staff = staffOf(reader);
  if (staff === null) return refuse("ROLE_OUT_OF_SCOPE");
  const code = owned(t, staff, metric, "define_metric");
  if (typeof code !== "string") return code;
  if (blank(statement)) return refuse("FIELD_MISSING", { field: "statement" });
  if (effectiveFrom === null) return refuse("FIELD_MISSING", { field: "effective_from" });
  const versions = t.definitions.filter((definition) => definition.code === code);
  for (const definition of versions) if (definition.effectiveTo === null || ms(definition.effectiveTo) > ms(effectiveFrom)) definition.effectiveTo = effectiveFrom;
  const no = Math.max(0, ...versions.map((definition) => definition.no)) + 1;
  t.definitions.push({ code, no, statement: statement.trim(), ownerRole: METRIC_OWNER_ROLE, effectiveFrom, effectiveTo: null, approvedBy: actorOf(staff), approvedAt: now() });
  return accept({ no });
}

/**
 * POST /engagement/metric-snapshots (`DR-66` row 4 first): a closed month only, the response naming when an open one
 * closes. A snapshot already prepared for the metric and month is returned rather than made twice.
 */
export function prepareSnapshot(key: string, reader: EngagementReader, metric: string, month: string): EngagementAnswer<{ snapshot: string }> {
  const t = engagementOf(key);
  const staff = staffOf(reader);
  if (staff === null) return refuse("ROLE_OUT_OF_SCOPE");
  const code = owned(t, staff, metric, "prepare_metric_snapshot");
  if (typeof code !== "string") return code;
  const period = monthOf(month);
  if (period === null) return refuse("FIELD_MISSING", { field: "period" });
  if (period.to >= today()) return refuse("METRIC_PERIOD_NOT_CLOSED", { closes: period.closes });
  const existing = t.snapshots.find((snapshot) => snapshot.metric === code && snapshot.periodFrom === period.from && snapshot.state !== "REFUSED");
  if (existing !== undefined) return accept({ snapshot: existing.id });
  const definition = currentDefinition(t, code, ms(now()));
  if (definition === null) return refuse("METRIC_NOT_FOUND");
  const cutOff = now();
  const measured = measure(t, code, period.from, period.closes, cutOff);
  const outcome: SnapshotOutcome =
    measured.empty && measured.figure === 0 ? "RECONCILED_EMPTY" : measured.figure === measured.ledgerFigure ? "RECONCILED" : "METRIC_RECONCILIATION_VARIANCE";
  const snapshot: StoredSnapshot = {
    id: reference("SNP"),
    metric: code,
    definitionNo: definition.no,
    periodFrom: period.from,
    periodTo: period.to,
    cutOff,
    figure: measured.figure,
    ledgerFigure: measured.ledgerFigure,
    outcome,
    state: "PREPARED",
    publishedBy: null,
  };
  t.snapshots.push(snapshot);
  return accept({ snapshot: snapshot.id });
}

/**
 * POST /engagement/metric-snapshots/{snapshotId}/publish (`DR-66`): a snapshot that does not reconcile is refused and
 * stays on the table as a refused row, both figures and the variance on it, rather than disappearing.
 */
export function publishSnapshot(key: string, reader: EngagementReader, id: string): EngagementAnswer<{ snapshot: string }> {
  const t = engagementOf(key);
  const staff = staffOf(reader);
  if (staff === null) return refuse("ROLE_OUT_OF_SCOPE");
  const snapshot = t.snapshots.find((candidate) => candidate.id === id);
  if (snapshot === undefined) return refuse("METRIC_NOT_FOUND");
  const code = owned(t, staff, snapshot.metric, "publish_metric_snapshot");
  if (typeof code !== "string") return code;
  if (snapshot.periodTo >= today()) return refuse("METRIC_PERIOD_NOT_CLOSED", { closes: monthOf(snapshot.periodFrom.slice(0, 7))?.closes ?? "" });
  if (snapshot.state === "PUBLISHED") return accept({ snapshot: snapshot.id });
  if (snapshot.outcome === "METRIC_RECONCILIATION_VARIANCE") {
    snapshot.state = "REFUSED";
    return refuse("METRIC_RECONCILIATION_VARIANCE", { figure: snapshot.figure, ledger: snapshot.ledgerFigure, variance: snapshot.figure - snapshot.ledgerFigure });
  }
  snapshot.state = "PUBLISHED";
  snapshot.publishedBy = actorOf(staff);
  return accept({ snapshot: snapshot.id });
}
