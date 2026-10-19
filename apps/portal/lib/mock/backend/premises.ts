import type { LoadOutcome } from "@rightone/ui";
import { EVIDENCE_KINDS, type PartyAnswer } from "@/lib/api/parties";
import {
  CHANGE_CAUSES,
  OVERRIDABLE_FIELDS,
  type AreaValue,
  type ChangeCause,
  type PortalPremises,
  type Portfolio,
  type PremisesTimeline,
  type RelationshipAtView,
  type RelationshipRow,
  PREMISES_CLASSES,
  REGISTER_LICENSING,
  type AdmitInput,
  type ChangeDispositions,
  type ChangeForm,
  type ChangeInput,
  type ChangeView,
  type DecisionInput,
  type DifferenceView,
  type DispositionQueue,
  type DispositionRow,
  type DispositionState,
  type Entitlement,
  type ExceptionKind,
  type ExceptionQueue,
  type ExceptionRow,
  type FieldFact,
  type GeographyView,
  type HistoryRow,
  type LicensingView,
  type Limitation,
  type OverridableField,
  type OverrideInput,
  type PartyNow,
  type PremisesClass,
  type PremisesDetail,
  type PremisesHistory,
  type PremisesProvenance,
  type PremisesRegister,
  type PremisesState,
  type ProposalInput,
  type ProvenanceRoute,
  type ProvenanceRow,
  type ProvenanceValue,
  type PublishedFact,
  type ReconciliationView,
  type RecordedChange,
  type RegisterLicensing,
  type RelationshipInput,
  type RepointAnswer,
  type RepointInput,
  type RepointingList,
  type RunRow,
  type SourceName,
  type Written,
} from "@/lib/api/premises";
import type { Principal, Staff } from "@/lib/api/session";
import {
  GEOGRAPHY_SUCCESSORS,
  GEOGRAPHY_VERSION,
  GEOGRAPHY_VERSIONS,
  POPULATION,
  RECONCILIATION_INTERVAL_DAYS,
  RUN_DURATION_MS,
  SCHEME_VERSION,
  WARDS,
  premisesSeed,
  type SeedEntry,
} from "../premises";
import { partiesSeed, type SeedRelationship } from "../parties";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { actingAs, authorityToActAt, partyRegister, premisesRecordOf, recordChange, type PartyRegister } from "./parties";
import { decisionForCollection, decisionReferences } from "./registration";
import { consoleRecord, consoleRecordList, recordHistory } from "./status-records";
import { table, type StaffRole } from "./store";

/*
 * The premises register's backend (PTY), as the API will behave for the screens of the register, its
 * reconciliation and the entitlements a premises change leaves behind: one function per endpoint of
 * `srs/02-api-contracts.md` sections 2, 5 and 6. A command checks what the contract checks, in the order the
 * decision rules give (DR-204 for an admission, DR-205 for a difference, DR-206 for a change, DR-207 for a licensing
 * status), and answers with the codes of `design/04-refusal-codes.md`; a refused command records nothing.
 *
 * The party relationships are the party register's own (`partyRegister`): a change recorded here ends and starts the
 * relationships the party detail lists and an authority lapses with. A licensing status is never set here: it is
 * derived from the status records CER holds for the premises (DR-207), read through CER's exported functions.
 *
 * Three things happen with nobody acting, as the sweeps do (ACT-SYS), each the moment the register is next read: a
 * pending change applies on its date (SM-191 transitions 3 to 5), a run started on the console completes, and the
 * hourly check raises RECONCILIATION_OVERDUE once the interval has passed with no completed run (SM-194 transition 3).
 */

// ---------------------------------------------------------------- the state

interface Value {
  value: string;
  route: ProvenanceRoute;
  source: SourceName | null;
  at: string;
  by: string | null;
  authority: string | null;
  /** The geography version an area belongs to. */
  version: string | null;
}

interface Identification {
  evidenceKind: string;
  evidenceRef: string;
  reason: string;
}

interface Entry {
  record: string;
  /** Every value each field has had, oldest first; the last is the register's value now. */
  fields: Record<OverridableField, Value[]>;
  admittedAt: string;
  admittedBy: "FIRST_LOAD" | "RUN_OF_1_OCTOBER" | { operator: string };
  identification: Identification | null;
  /** Masked to its last four characters, as the register shows every identifying number. */
  identifyingReference: string | null;
  /** A derivation that lags its record; null once the register derives as the record changes. */
  derivedAt: string | null;
}

interface Run {
  id: string;
  startedAt: string;
  dueAt: string | null;
  startedBy: string | null;
  state: "RUNNING" | "COMPLETED" | "INCOMPLETE" | "REFUSED";
  completedAt: string | null;
  stoppedAt: string | null;
  stoppedPoint: string | null;
  firstLoad: boolean;
  compared: number | null;
  found: number | null;
}

interface Difference {
  id: string;
  run: string;
  premises: string;
  field: "classification" | "trading_name" | "address" | "administrative_area" | "party";
  fieldClass: "DESCRIPTIVE" | "STATUS_OR_RELATIONSHIP";
  registerValue: ProvenanceValue;
  sourceValue: ProvenanceValue;
  reason: "DISPOSITION_AWAITED" | "OVERRIDE_CONFLICT";
}

interface Change {
  id: string;
  premises: string;
  cause: (typeof CHANGE_CAUSES)[number];
  effectiveOn: string;
  outgoing: string;
  incoming: string | null;
  recordedAt: string;
  recordedBy: string;
  basis: Written | null;
  appliedAt: string | null;
  contradicted: PublishedFact[];
}

interface Disposition {
  id: string;
  change: string;
  entitlement: Entitlement;
  issuedTo: string;
  state: DispositionState;
  proposal: { outcome: "TRANSFER" | "CLOSE"; receiving: string | null; ground: Written; by: string; role: string; at: string } | null;
  decision: { outcome: "TRANSFER" | "CLOSE" | "LEAVE_IN_PLACE"; by: string; role: string; at: string; ground: Written } | null;
  heldBy: string | null;
}

interface RegisterException {
  id: string;
  kind: Exclude<ExceptionKind, "REVOCATION_NOT_PROPAGATED">;
  premises: string | null;
  /** NO_SUCCESSOR_AREA: the withdrawn area and the geography version it belonged to. */
  area: { name: string; version: string } | null;
  raisedAt: string;
  acknowledged: { by: string; at: string } | null;
  resolved: { by: string; at: string; resolution: string | null } | null;
}

/** One premises re-pointed to a successor area (`party.geography_repointings`), from the instant it applies. */
interface Repointing {
  id: string;
  premises: string;
  fromArea: string;
  fromVersion: string;
  toArea: string;
  toVersion: string;
  effectiveAt: string;
  by: string;
}

interface Event {
  premises: string;
  at: string;
  what: Written;
  /** The party operating the premises when it was recorded, by party record; null where none did. */
  partyThen: string | null;
}

interface State {
  entries: Map<string, Entry>;
  runs: Run[];
  differences: Difference[];
  changes: Change[];
  dispositions: Disposition[];
  exceptions: RegisterException[];
  repointings: Repointing[];
  /** What this register has done with the late revocations the party register raised: taken, closed. */
  revocations: Map<string, { acknowledged: { by: string; at: string } | null; resolved: { by: string; at: string; resolution: string } | null }>;
  published: readonly PublishedFact[];
  events: Event[];
  prompts: Readonly<Record<string, Written>>;
  sourceParties: Readonly<Record<string, { party: string; from: string }>>;
  /** CFG-244: the approved connection answers, and no alternative route is configured. */
  connection: "AVAILABLE" | "UNAVAILABLE";
}

// ---------------------------------------------------------------- time

const VN = "+07:00";
const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (instant: string): string => addDays(instant, 0);
const startOf = (day: string): string => `${day}T00:00:00${VN}`;
const time = (instant: string): number => Date.parse(instant);
const daysBetween = (from: string, to: string): number => Math.round((time(startOf(dayOf(to))) - time(startOf(dayOf(from)))) / DAY_MS);
const plusDays = (instant: string, days: number): string => new Date(time(instant) + days * DAY_MS).toISOString();

// ---------------------------------------------------------------- the seed

/** Which party operated a premises at an instant, by the relationships given. */
function partyAt(relationships: readonly SeedRelationship[], record: string, instant: string): string | null {
  const day = dayOf(instant);
  return relationships.find((entry) => entry.premises.record === record && (entry.from === null || entry.from <= day) && (entry.to === null || entry.to >= day))?.party ?? null;
}

function fieldsOf(seed: SeedEntry): Record<OverridableField, Value[]> {
  const sourced = (value: string, at: string, source: SourceName = "NATIONAL_REGISTER"): Value => ({
    value,
    route: source === "NATIONAL_REGISTER" ? "AUTHORITATIVE_SOURCE" : "ALTERNATIVE_ROUTE",
    source,
    at,
    by: null,
    authority: null,
    version: null,
  });
  const classification: Value[] = seed.classification !== null ? [sourced(seed.classification, seed.admittedAt)] : [];
  if (seed.classOverride !== null) {
    classification.push({ value: seed.classOverride.value, route: "MANUAL_OVERRIDE", source: null, at: seed.classOverride.at, by: seed.classOverride.by, authority: seed.classOverride.authority, version: null });
  }
  return {
    trading_name: [sourced(seed.name, seed.nameRoute.at, seed.nameRoute.source)],
    address: seed.address !== null ? [sourced(seed.address, seed.admittedAt)] : [],
    classification,
    administrative_area: seed.area !== null ? [{ ...sourced(seed.area, seed.admittedAt), version: seed.areaVersion }] : [],
  };
}

/** The register's own log of what happened to each premises, from the seed, each event with the party then. */
function seedEvents(seed: ReturnType<typeof premisesSeed>, relationships: readonly SeedRelationship[]): Event[] {
  const events: Event[] = [];
  const add = (premises: string, at: string, what: Written, partyThen: string | null = partyAt(relationships, premises, at)) => events.push({ premises, at, what, partyThen });
  for (const entry of seed.entries) {
    const since = relationships.find((rel) => rel.premises.record === entry.record && rel.from !== null && rel.from <= dayOf(entry.admittedAt))?.from ?? null;
    if (entry.admittedBy === "RUN_OF_1_OCTOBER") add(entry.record, entry.admittedAt, { code: "ADMITTED_RUN", values: { run: dayOf(entry.admittedAt) } });
    else add(entry.record, entry.admittedAt, since !== null ? { code: "ADMITTED_SOURCE_SINCE", values: { since } } : { code: "ADMITTED_SOURCE" });
    if (entry.classOverride !== null) {
      add(entry.record, entry.classOverride.at, { code: "OVERRIDDEN", values: { field: "classification", value: entry.classOverride.value, authority: entry.classOverride.authority } });
    }
    // A relationship the source gave after the premises was admitted began on its first day.
    for (const rel of relationships) {
      if (rel.premises.record !== entry.record || rel.from === null || (rel.recorded ?? null) !== null || rel.from <= dayOf(entry.admittedAt)) continue;
      add(entry.record, startOf(rel.from), { code: "RELATIONSHIP_BEGAN" }, rel.party);
    }
  }
  for (const change of seed.changes) {
    add(change.premises, change.recordedAt, { code: "CHANGE_RECORDED", values: { cause: change.cause, effectiveOn: change.effectiveOn, by: change.recordedBy } }, change.outgoing);
    if (change.appliedAt !== null) {
      add(change.premises, change.appliedAt, { code: "RELATIONSHIP_ENDED", values: { cause: change.cause } }, change.outgoing);
      if (change.incoming !== null) add(change.premises, change.appliedAt, { code: "RELATIONSHIP_BEGAN" }, change.incoming);
    }
  }
  for (const disposition of seed.dispositions) {
    const premises = seed.changes.find((change) => change.id === disposition.change)?.premises ?? "";
    const entitlement = entitlementValues({ kind: disposition.kind, reference: disposition.reference, period: disposition.period, amountMinor: disposition.amountMinor });
    if (disposition.proposal !== null) add(premises, disposition.proposal.at, { code: "PROPOSED", values: { ...entitlement, outcome: disposition.proposal.outcome, by: disposition.proposal.by } });
    if (disposition.decision !== null) add(premises, disposition.decision.at, { code: "DECIDED", values: { ...entitlement, outcome: disposition.decision.outcome, by: disposition.decision.by } });
  }
  for (const event of seed.events) add(event.premises, event.at, event.what);
  return events;
}

/** An entitlement as an event's values: what it is, and the reference or period that names it. */
function entitlementValues(entitlement: Entitlement): Record<string, string> {
  return {
    kind: entitlement.kind,
    reference: entitlement.reference ?? "",
    from: entitlement.period?.from ?? "",
    to: entitlement.period?.to ?? "",
  };
}

/** A run's figures as recorded: how many records it compared before it stopped, and the differences it found. */
function seedRuns(seed: ReturnType<typeof premisesSeed>): Run[] {
  const records = seed.entries.map((entry) => entry.record).sort();
  return seed.runs.map((run) => {
    const reached = run.firstLoad
      ? seed.entries.filter((entry) => entry.admittedAt <= (run.completedAt ?? run.startedAt)).length
      : records.filter((record) => run.stoppedPoint === null || record <= run.stoppedPoint).length;
    return {
      id: run.id,
      startedAt: run.startedAt,
      dueAt: run.dueAt,
      startedBy: null,
      state: run.state,
      completedAt: run.completedAt,
      stoppedAt: run.stoppedAt,
      stoppedPoint: run.stoppedPoint,
      firstLoad: run.firstLoad,
      compared: reached,
      found: seed.differences.filter((difference) => difference.run === run.id).length,
    };
  });
}

function fromSeed(): State {
  const seed = premisesSeed();
  const relationships = partiesSeed().relationships;
  const entries = new Map(
    seed.entries.map((entry): [string, Entry] => [
      entry.record,
      { record: entry.record, fields: fieldsOf(entry), admittedAt: entry.admittedAt, admittedBy: entry.admittedBy, identification: null, identifyingReference: null, derivedAt: entry.derivedAt },
    ]),
  );
  const differences = seed.differences.map((difference): Difference => {
    const entry = entries.get(difference.premises);
    if (difference.field === "party") {
      const registerParty = partyAt(relationships, difference.premises, now()) ?? "";
      const sourceParty = seed.sourceParties[difference.premises]?.party ?? "";
      return { ...difference, fieldClass: "STATUS_OR_RELATIONSHIP", registerValue: { kind: "party", record: registerParty, legalName: "" }, sourceValue: { kind: "party", record: sourceParty, legalName: "" }, reason: "DISPOSITION_AWAITED" };
    }
    const rows = entry?.fields.classification ?? [];
    return {
      ...difference,
      fieldClass: "DESCRIPTIVE",
      registerValue: { kind: "class", code: rows.at(-1)?.value ?? "" },
      sourceValue: { kind: "class", code: rows.find((row) => row.route !== "MANUAL_OVERRIDE")?.value ?? "" },
      reason: "OVERRIDE_CONFLICT",
    };
  });
  return {
    entries,
    runs: seedRuns(seed),
    differences,
    changes: seed.changes.map((change) => ({ ...change, contradicted: [] })),
    dispositions: seed.dispositions.map((disposition) => ({
      id: disposition.id,
      change: disposition.change,
      entitlement: { kind: disposition.kind, reference: disposition.reference, period: disposition.period, amountMinor: disposition.amountMinor },
      issuedTo: disposition.issuedTo,
      state: disposition.state,
      proposal: disposition.proposal,
      decision: disposition.decision,
      heldBy: null,
    })),
    exceptions: seed.exceptions.map((exception) => ({ ...exception, area: null })),
    repointings: [],
    revocations: new Map(),
    published: seed.published,
    events: seedEvents(seed, relationships),
    prompts: seed.prompts,
    sourceParties: seed.sourceParties,
    connection: "AVAILABLE",
  };
}

const own = (key: string): State => table(key, "premises-register", fromSeed);

// ---------------------------------------------------------------- answers

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const accept = <T,>(accepted: T): PartyAnswer<T> => ({ accepted, refusal: null });
const refuse = (code: string, field: string | null = null, values: Readonly<Record<string, string>> = {}): PartyAnswer<never> => ({
  accepted: null,
  refusal: { code, field, values },
});
const holds = (staff: Staff, ...roles: readonly StaffRole[]): boolean => roles.some((role) => staff.roles.includes(role));

// ---------------------------------------------------------------- the world as one register

interface World {
  key: string;
  s: State;
  p: PartyRegister;
}

/** The register at the moment of the read, after the sweeps that run with nobody acting have run. */
function world(key: string): World {
  const w = { key, s: own(key), p: partyRegister(key) };
  applyDueChanges(w);
  completeRuns(w);
  raiseOverdue(w);
  return w;
}

const partyName = (w: World, record: string | null): string => (record === null ? "" : (w.p.parties.get(record)?.legalName ?? record));
const partyRef = (w: World, record: string | null) => (record === null ? null : { record, legalName: partyName(w, record) });
const current = (rows: readonly Value[]): Value | null => rows.at(-1) ?? null;
const nameOf = (entry: Entry): string => current(entry.fields.trading_name)?.value ?? current(entry.fields.address)?.value ?? entry.record;

function relationshipsOf(w: World, record: string): SeedRelationship[] {
  return w.p.relationships.filter((entry) => entry.premises.record === record);
}

/** The relationship in force today, if one is. */
function currentRelationship(w: World, record: string, day: string = today()): SeedRelationship | null {
  return relationshipsOf(w, record).find((entry) => (entry.from === null || entry.from <= day) && (entry.to === null || entry.to >= day)) ?? null;
}

const partyThenAt = (w: World, record: string, instant: string): string | null => partyAt(w.p.relationships, record, instant);

function logEvent(w: World, premises: string, what: Written, at: string = now(), partyThen: string | null = partyThenAt(w, premises, at)): void {
  w.s.events.push({ premises, at, what, partyThen });
}

// ---------------------------------------------------------------- SM-191 and the change sweep

const pendingChange = (w: World, record: string): Change | null => w.s.changes.find((change) => change.premises === record && change.appliedAt === null) ?? null;

function premisesState(w: World, record: string): PremisesState {
  if (pendingChange(w, record) !== null) return "CHANGE_PENDING";
  if (currentRelationship(w, record) !== null) return "OPERATED";
  const terminal = [...w.s.changes].reverse().find((change) => change.premises === record && change.appliedAt !== null && change.cause !== "OPERATOR_CHANGE");
  if (terminal !== undefined) return terminal.cause === "CLOSURE" ? "CLOSED" : "CEASED";
  return "IN_REGISTER";
}

/**
 * A change takes effect: the outgoing relationship ends the day before, and an incoming one starts on the day. The
 * relationship-ended event is what every consumer reads from then on: VEN, IAM and the verification route ask the
 * register (`premisesRelationshipAt`, `authorityToActAt`) rather than keep a flag of their own (FR-PTY-039).
 */
function applyChange(w: World, change: Change, at: string, by: Staff | null = null): void {
  const before = addDays(startOf(change.effectiveOn), -1);
  const outgoing = relationshipsOf(w, change.premises).find((entry) => entry.party === change.outgoing && (entry.to === null || entry.to >= change.effectiveOn));
  if (outgoing !== undefined) {
    outgoing.to = before;
    outgoing.endCause = change.cause;
  }
  logEvent(w, change.premises, { code: "RELATIONSHIP_ENDED", values: { cause: change.cause } }, startOf(change.effectiveOn), change.outgoing);
  if (change.cause === "OPERATOR_CHANGE" && change.incoming !== null) {
    const entry = w.s.entries.get(change.premises);
    w.p.relationships.push({
      party: change.incoming,
      premises: { record: change.premises, name: entry !== undefined ? nameOf(entry) : change.premises },
      from: change.effectiveOn,
      to: null,
      application: null,
      endCause: null,
      recorded: { by: change.recordedBy, at },
    });
    logEvent(w, change.premises, { code: "RELATIONSHIP_BEGAN" }, startOf(change.effectiveOn), change.incoming);
  }
  change.appliedAt = at;
  recordChange(w.p, {
    subject: { kind: "PREMISES", reference: change.premises },
    change: "RELATIONSHIP_ENDED",
    values: { cause: change.cause, effectiveOn: change.effectiveOn, party: change.outgoing, incoming: change.incoming ?? "" },
    // Applied when recorded, under the officer's permission row; on its date, by the sweep under SM-191 (@AC-FR-PTY-048-02).
    actor: by !== null ? { kind: "PERSON", name: by.account, person: null } : { kind: "PROCESS", name: "CHANGE_SWEEP" },
    reliedOn: by !== null ? { kind: "PERMISSION", row: "RECORD_CHANGE" } : { kind: "RULE", rule: "SM-191" },
    at,
  });
}

/** POST /premises/{id}/changes/{change_id}/apply, as the change sweep calls it on the effective date (ACT-SYS). */
function applyDueChanges(w: World): void {
  const day = today();
  for (const change of w.s.changes) if (change.appliedAt === null && change.effectiveOn <= day) applyChange(w, change, startOf(change.effectiveOn));
}

/** The change sweep, as the party register runs it before it is read (`parties.ts`), so both answer the same day. */
export function applyDuePremisesChanges(key: string): void {
  applyDueChanges({ key, s: own(key), p: partyRegister(key) });
}

// ---------------------------------------------------------------- DR-207

const CURRENT_RECORD = new Set(["ACTIVE", "EXPIRING", "REINSTATED"]);

interface IssuedRecord {
  reference: string;
  status: string;
  holder: string;
  issuedAt: string | null;
  lastChangedAt: string;
}

/** The status records CER holds for a premises, every holder's, the latest change first. */
function recordsOf(key: string, record: string): IssuedRecord[] {
  const rows = consoleRecordList(key, { status: null, premises: record, waiting: false }, null).data?.rows ?? [];
  return rows
    .filter((row): row is typeof row & { reference: string } => row.reference !== null && row.status !== "PENDING_ISSUE")
    .map((row) => {
      const history = recordHistory(key, row.reference).data;
      const issue = history?.changes.find((change) => change.from === "PENDING_ISSUE");
      return {
        reference: row.reference,
        status: row.status,
        holder: consoleRecord(key, row.reference).data?.holder ?? "",
        issuedAt: issue?.effectiveAt ?? null,
        lastChangedAt: history?.latest.at ?? row.since,
      };
    })
    .sort((a, b) => time(b.lastChangedAt) - time(a.lastChangedAt));
}

function licensingOf(w: World, entry: Entry): LicensingView {
  const records = recordsOf(w.key, entry.record);
  const latest = records[0];
  if (latest === undefined) return { status: "UNREGISTERED", derivedAt: entry.derivedAt ?? entry.admittedAt, record: null, stale: null, atAdmission: true };
  const live = records.find((record) => CURRENT_RECORD.has(record.status)) ?? null;
  const relied = live ?? latest;
  // DR-207 row 4 before rows 1 and 3: a derivation older than the record's last change is wrong, not old.
  if (entry.derivedAt !== null && time(entry.derivedAt) < time(latest.lastChangedAt)) {
    return { status: "STALE", derivedAt: entry.derivedAt, record: relied.reference, stale: { checkedOn: dayOf(entry.derivedAt), changedOn: dayOf(latest.lastChangedAt) }, atAdmission: false };
  }
  return { status: live !== null ? "LICENSED" : "LAPSED", derivedAt: relied.lastChangedAt, record: relied.reference, stale: null, atAdmission: false };
}

// ---------------------------------------------------------------- FR-PTY-043

const completedRuns = (w: World) => w.s.runs.filter((run) => run.state === "COMPLETED" && run.completedAt !== null);
const lastCompleted = (w: World): string | null => completedRuns(w).map((run) => run.completedAt as string).sort((a, b) => time(a) - time(b)).at(-1) ?? null;
const nextDue = (w: World): string | null => {
  const last = lastCompleted(w);
  return last !== null ? plusDays(last, RECONCILIATION_INTERVAL_DAYS) : null;
};
const overdue = (w: World): boolean => {
  const due = nextDue(w);
  return due === null || time(due) <= Date.now();
};

function limitationOf(w: World): Limitation {
  const last = lastCompleted(w);
  const everyByHand = [...w.s.entries.values()].every((entry) => typeof entry.admittedBy === "object");
  return {
    route: last === null && everyByHand ? "MANUAL_ADMISSION" : "AUTHORITATIVE_SOURCE",
    lastCompleted: last,
    daysSince: last !== null ? daysBetween(last, now()) : null,
    intervalDays: RECONCILIATION_INTERVAL_DAYS,
    scope: last === null ? "WHOLE_REGISTER" : "NONE",
  };
}

// ---------------------------------------------------------------- SCR-PTY-06

const wardOf = (entry: Entry): string | null => current(entry.fields.administrative_area)?.value ?? null;
const cityOf = (ward: string): string => WARDS.find((entry) => entry.ward === ward)?.city ?? POPULATION.city;
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");
const collator = new Intl.Collator("vi", { sensitivity: "variant" });

function partyNow(w: World, record: string): PartyNow | null {
  const relationship = currentRelationship(w, record);
  return relationship !== null ? { record: relationship.party, legalName: partyName(w, relationship.party), since: relationship.from } : null;
}

const admitOptions = () => ({
  classes: PREMISES_CLASSES,
  schemeVersion: SCHEME_VERSION,
  areas: WARDS,
  geographyVersion: GEOGRAPHY_VERSION,
  evidenceKinds: EVIDENCE_KINDS,
});

/** GET /premises: the register for an area, its coverage over every entry of the area, and the limitation. */
export function premisesRegister(staff: Staff, asked: { area: string | null; q: string | null; licensing: string | null }): LoadOutcome<PremisesRegister> {
  if (!holds(staff, "ACT-OPS", "ACT-DAT", "ACT-AUD", "ACT-REP")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const entries = [...w.s.entries.values()];
  const wards = [...new Set(entries.map(wardOf).filter((ward): ward is string => ward !== null))].sort((a, b) => collator.compare(a, b));
  const area = asked.area !== null && wards.includes(asked.area) ? asked.area : null;
  const licensing = (REGISTER_LICENSING as readonly string[]).includes(asked.licensing ?? "") ? (asked.licensing as RegisterLicensing) : null;
  const q = asked.q?.trim() ?? "";
  const inArea = entries.filter((entry) => area === null || wardOf(entry) === area);
  const rows = inArea
    .map((entry) => ({ entry, licensing: licensingOf(w, entry) }))
    .sort((a, b) => collator.compare(nameOf(a.entry), nameOf(b.entry)));
  const counts = { LICENSED: 0, UNREGISTERED: 0, LAPSED: 0, STALE: 0 };
  for (const row of rows) counts[row.licensing.status] += 1;
  return ok({
    asOf: now(),
    area: area !== null ? { ward: area, city: cityOf(area) } : null,
    areas: wards.map((ward) => ({ ward, city: cityOf(ward) })),
    filter: { q: q === "" ? null : q, licensing },
    populationDefined: POPULATION.defined,
    limitation: limitationOf(w),
    coverage: { inScope: rows.length, counts },
    rows: rows
      .filter((row) => licensing === null || row.licensing.status === licensing)
      .filter((row) => q === "" || fold(nameOf(row.entry)).includes(fold(q)) || row.entry.record.toLowerCase() === q.toLowerCase())
      .map((row) => {
        const classification = current(row.entry.fields.classification)?.value ?? null;
        return {
          record: row.entry.record,
          name: nameOf(row.entry),
          classification: (PREMISES_CLASSES as readonly string[]).includes(classification ?? "") ? (classification as PremisesClass) : null,
          state: premisesState(w, row.entry.record),
          party: partyNow(w, row.entry.record),
          licensing: row.licensing,
        };
      }),
    mayAdmit: holds(staff, "ACT-OPS", "ACT-DAT"),
    admit: admitOptions(),
  });
}

/** PRM- and eight characters from the reference alphabet, which no entry carries yet. */
function premisesRecord(s: State): string {
  for (;;) {
    const candidate = `PRM-${reference("X").slice(2, 10)}`;
    if (!s.entries.has(candidate)) return candidate;
  }
}

/**
 * POST /premises by an officer, by DR-204: the population first, then the classification and the geography version
 * against their references, then whether the premises lies inside the population, then the identifying reference,
 * the address and the manual identification (DR-200's manual fields and CFG-246's kinds), and last whether another
 * entry carries the same reference. The entry starts IN_REGISTER and UNREGISTERED, each field admitted by hand.
 */
export function admitPremises(staff: Staff, input: AdmitInput): PartyAnswer<{ record: string }> {
  if (!holds(staff, "ACT-OPS", "ACT-DAT")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  if (!POPULATION.defined) return refuse("NO_POPULATION_DEFINED");
  const classification = input.classification.trim();
  if (!(PREMISES_CLASSES as readonly string[]).includes(classification)) return refuse("CLASSIFICATION_NOT_IN_SCHEME", "classification", { version: SCHEME_VERSION, value: classification });
  const version = input.geographyVersion.trim();
  if (!(GEOGRAPHY_VERSIONS as readonly string[]).includes(version)) return refuse("GEOGRAPHY_VERSION_UNKNOWN", "geography_version", { version });
  const ward = WARDS.find((entry) => entry.ward === input.area.trim());
  if (ward === undefined) return refuse("FIELD_MISSING", "administrative_area_key");
  if (version !== GEOGRAPHY_VERSION) return refuse("OUTSIDE_POPULATION", "geography_version", { part: "VERSION", version: GEOGRAPHY_VERSION });
  if (ward.city !== POPULATION.city) return refuse("OUTSIDE_POPULATION", "administrative_area_key", { part: "CITY", city: POPULATION.city, ward: ward.ward });
  const typed = input.identifyingReference.replace(/\s/g, "");
  if (typed === "") return refuse("IDENTIFYING_REFERENCE_MISSING", "identifying_reference");
  if (input.address.trim() === "") return refuse("FIELD_MISSING", "address");
  if (input.evidenceKind.trim() === "") return refuse("MANUAL_FIELDS_INCOMPLETE", "evidence_kind");
  if (input.evidenceRef.trim() === "") return refuse("MANUAL_FIELDS_INCOMPLETE", "evidence_ref");
  if (input.reason.trim() === "") return refuse("MANUAL_FIELDS_INCOMPLETE", "reason");
  if (!(EVIDENCE_KINDS as readonly string[]).includes(input.evidenceKind)) return refuse("EVIDENCE_KIND_NOT_PERMITTED", "evidence_kind");
  const masked = `******${typed.slice(-4)}`;
  const holder = [...w.s.entries.values()].find((entry) => entry.identifyingReference === masked);
  if (holder !== undefined) return refuse("IDENTIFYING_REFERENCE_TAKEN", "identifying_reference", { record: holder.record, name: nameOf(holder) });
  const at = now();
  const record = premisesRecord(w.s);
  const admitted = (value: string, versionOf: string | null = null): Value => ({ value, route: "MANUAL_ADMISSION", source: null, at, by: staff.account, authority: null, version: versionOf });
  const name = input.tradingName.trim();
  w.s.entries.set(record, {
    record,
    fields: {
      trading_name: name !== "" ? [admitted(name)] : [],
      address: [admitted(input.address.trim())],
      classification: [admitted(classification)],
      administrative_area: [admitted(ward.ward, version)],
    },
    admittedAt: at,
    admittedBy: { operator: staff.account },
    identification: { evidenceKind: input.evidenceKind, evidenceRef: input.evidenceRef.trim(), reason: input.reason.trim() },
    identifyingReference: masked,
    derivedAt: null,
  });
  logEvent(w, record, { code: "ADMITTED_BY_HAND", values: { by: staff.account } }, at, null);
  recordChange(w.p, { subject: { kind: "PREMISES", reference: record }, change: "PREMISES_ADMITTED", values: { route: "MANUAL_ADMISSION" }, actor: { kind: "PERSON", name: staff.account, person: null }, reliedOn: { kind: "PERMISSION", row: "ADMIT_PREMISES" }, at });
  return accept({ record });
}

// ---------------------------------------------------------------- SCR-PTY-07

function fieldFact<T>(row: Value | null, value: (row: Value) => T | null): FieldFact<T> {
  return row === null ? { value: null, route: null, source: null, authority: null } : { value: value(row), route: row.route, source: row.source, authority: row.authority };
}

const asClass = (value: string): PremisesClass | null => ((PREMISES_CLASSES as readonly string[]).includes(value) ? (value as PremisesClass) : null);

function changeView(w: World, change: Change): ChangeView {
  return {
    id: change.id,
    cause: change.cause,
    effectiveOn: change.effectiveOn,
    outgoing: { record: change.outgoing, legalName: partyName(w, change.outgoing) },
    incoming: partyRef(w, change.incoming),
    recordedAt: change.recordedAt,
    recordedBy: change.recordedBy,
    basis: change.basis,
    applied: change.appliedAt !== null,
    contradicted: change.contradicted,
    dispositions: w.s.dispositions.filter((disposition) => disposition.change === change.id).length,
  };
}

/** The latest run that reached a premises (completed, or stopped after it), whose differences are the ones outstanding. */
function latestRunCovering(w: World, record: string): Run | null {
  return (
    [...w.s.runs]
      .filter((run) => run.state === "COMPLETED" || (run.state === "INCOMPLETE" && run.stoppedPoint !== null && record <= run.stoppedPoint))
      .sort((a, b) => time(b.startedAt) - time(a.startedAt))[0] ?? null
  );
}

function differenceView(w: World, difference: Difference): DifferenceView {
  const run = w.s.runs.find((entry) => entry.id === difference.run);
  const named = (value: ProvenanceValue): ProvenanceValue => (value.kind === "party" ? { ...value, legalName: partyName(w, value.record) } : value);
  return {
    id: difference.id,
    run: { id: difference.run, startedAt: run?.startedAt ?? "" },
    field: difference.field,
    fieldClass: difference.fieldClass,
    registerValue: named(difference.registerValue),
    sourceValue: named(difference.sourceValue),
    reason: difference.reason,
  };
}

function outstandingDifferences(w: World, record: string): DifferenceView[] {
  const run = latestRunCovering(w, record);
  return run === null ? [] : w.s.differences.filter((difference) => difference.run === run.id && difference.premises === record).map((difference) => differenceView(w, difference));
}

const partyOptions = (w: World) =>
  [...w.p.parties.values()]
    .filter((party) => party.state !== "SUPERSEDED")
    .map((party) => ({ record: party.record, legalName: party.legalName, businessRegistration: party.businessRegistration }))
    .sort((a, b) => collator.compare(a.legalName, b.legalName));

/** GET /premises/{id}: the entry with where its fields came from, the party now, the licensing status, what is open. */
export function premisesDetail(staff: Staff, record: string): LoadOutcome<PremisesDetail> {
  if (!holds(staff, "ACT-OPS", "ACT-DAT", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(record.toUpperCase());
  if (entry === undefined) return refusedRead("PREMISES_NOT_FOUND");
  const relationship = currentRelationship(w, entry.record);
  const pending = pendingChange(w, entry.record);
  return ok({
    asOf: now(),
    record: entry.record,
    name: nameOf(entry),
    state: premisesState(w, entry.record),
    party:
      relationship !== null
        ? { record: relationship.party, legalName: partyName(w, relationship.party), since: relationship.from, route: (relationship.recorded ?? null) !== null ? "RECORDED" : "AUTHORITATIVE_SOURCE" }
        : null,
    licensing: licensingOf(w, entry),
    classification: fieldFact(current(entry.fields.classification), (row) => asClass(row.value)),
    area: fieldFact(current(entry.fields.administrative_area), (row) => ({ ward: row.value, city: cityOf(row.value), version: row.version ?? GEOGRAPHY_VERSION })),
    tradingName: fieldFact(current(entry.fields.trading_name), (row) => row.value),
    address: fieldFact(current(entry.fields.address), (row) => row.value),
    neverOperated: relationshipsOf(w, entry.record).length === 0,
    pending: pending !== null ? changeView(w, pending) : null,
    differences: outstandingDifferences(w, entry.record),
    parties: partyOptions(w),
    mayAct: holds(staff, "ACT-OPS"),
    mayReadProvenance: holds(staff, "ACT-DAT", "ACT-OPS", "ACT-AUD"),
    limitation: limitationOf(w),
  });
}

/**
 * POST /premises/{id}/relationships: the party operating the premises from an effective day. Another party already
 * operating it on that day is RELATIONSHIP_OVERLAPS, naming that party and since when; an admitted premises becomes
 * OPERATED once the day arrives.
 */
export function recordPremisesParty(staff: Staff, record: string, input: RelationshipInput): PartyAnswer<{ party: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(record);
  if (entry === undefined) return refuse("PREMISES_NOT_FOUND");
  const party = w.p.parties.get(input.party.trim());
  if (party === undefined || party.state === "SUPERSEDED") return refuse("PARTY_NOT_FOUND", "party_id", { party: input.party.trim() });
  if (input.effectiveFrom === null) return refuse("FIELD_MISSING", "effective_from", { value: input.effectiveFromText });
  const day = input.effectiveFrom;
  // One in force on the day, or one with no end, which the new relationship would run into.
  const overlapping = relationshipsOf(w, record).find((rel) => rel.to === null || ((rel.from === null || rel.from <= day) && rel.to >= day));
  if (overlapping !== undefined) return refuse("RELATIONSHIP_OVERLAPS", "party_id", { party: partyName(w, overlapping.party), record: overlapping.party, since: overlapping.from ?? "" });
  const at = now();
  w.p.relationships.push({ party: party.record, premises: { record, name: nameOf(entry) }, from: day, to: null, application: null, endCause: null, recorded: { by: staff.account, at } });
  logEvent(w, record, { code: "RELATIONSHIP_RECORDED", values: { from: day, by: staff.account } }, at, party.record);
  recordChange(w.p, { subject: { kind: "PREMISES", reference: record }, change: "RELATIONSHIP_RECORDED", values: { party: party.record, from: day }, actor: { kind: "PERSON", name: staff.account, person: null }, reliedOn: { kind: "PERMISSION", row: "RECORD_RELATIONSHIP" }, at });
  return accept({ party: party.record });
}

// ---------------------------------------------------------------- SCR-PTY-08

function valueOf(field: OverridableField, row: Value): ProvenanceValue {
  if (field === "classification") return { kind: "class", code: row.value };
  if (field === "administrative_area") return { kind: "area", ward: row.value, city: cityOf(row.value), version: row.version ?? GEOGRAPHY_VERSION };
  return { kind: "text", text: row.value };
}

function provenanceRow(entry: Entry, field: OverridableField): ProvenanceRow | null {
  const rows = entry.fields[field];
  const last = current(rows);
  if (last === null) return null;
  const earlier = last.route === "MANUAL_OVERRIDE" ? (rows.at(-2) ?? null) : null;
  return {
    field,
    value: valueOf(field, last),
    route: last.route,
    source: last.source,
    statusRecord: null,
    at: last.at,
    by: last.by,
    authority: last.authority,
    identification: last.route === "MANUAL_ADMISSION" ? entry.identification : null,
    before: earlier !== null ? { value: valueOf(field, earlier), route: earlier.route } : null,
    overridable: true,
  };
}

/** GET /premises/{id}/provenance: each field with its route, source, instant and authority. */
export function premisesProvenance(staff: Staff, record: string): LoadOutcome<PremisesProvenance> {
  if (!holds(staff, "ACT-DAT", "ACT-OPS", "ACT-AUD", "ACT-REP")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(record.toUpperCase());
  if (entry === undefined) return refusedRead("PREMISES_NOT_FOUND");
  const fields = OVERRIDABLE_FIELDS.map((field) => provenanceRow(entry, field)).filter((row): row is ProvenanceRow => row !== null);
  // FR-PTY-049: an entry with no provenance at all is an error of the register, and the read is refused.
  if (fields.length === 0) return refusedRead("NO_PROVENANCE");
  const relationship = currentRelationship(w, entry.record);
  const licensing = licensingOf(w, entry);
  const partyRow: ProvenanceRow | null =
    relationship !== null
      ? {
          field: "party",
          value: { kind: "party", record: relationship.party, legalName: partyName(w, relationship.party) },
          route: (relationship.recorded ?? null) !== null ? "RECORDED" : "AUTHORITATIVE_SOURCE",
          source: (relationship.recorded ?? null) !== null ? null : "NATIONAL_REGISTER",
          statusRecord: null,
          at: relationship.recorded?.at ?? (relationship.from !== null && relationship.from > dayOf(entry.admittedAt) ? startOf(relationship.from) : entry.admittedAt),
          by: relationship.recorded?.by ?? null,
          authority: null,
          identification: null,
          before: null,
          overridable: false,
        }
      : null;
  return ok({
    asOf: now(),
    record: entry.record,
    name: nameOf(entry),
    rows: [
      ...fields,
      ...(partyRow !== null ? [partyRow] : []),
      {
        field: "licensing_status",
        value: { kind: "licensing", status: licensing.status },
        route: "DERIVED",
        source: null,
        statusRecord: licensing.record,
        at: licensing.derivedAt,
        by: null,
        authority: null,
        identification: null,
        before: null,
        overridable: false,
      },
    ],
    mayOverride: holds(staff, "ACT-DAT"),
    options: { classes: PREMISES_CLASSES, areas: WARDS.filter((ward) => ward.city === POPULATION.city) },
  });
}

/**
 * POST /premises/{id}/overrides, by the data owner alone: a field an override can reach (FIELD_NOT_OVERRIDABLE names
 * the four), a value, and the authority acted under (OVERRIDE_AUTHORITY_REQUIRED). The earlier value stays readable;
 * a new trading name follows the premises into the party register's relationships and authorities.
 */
export function overridePremisesField(staff: Staff, record: string, input: OverrideInput): PartyAnswer<{ field: string; at: string }> {
  if (!holds(staff, "ACT-DAT")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(record);
  if (entry === undefined) return refuse("PREMISES_NOT_FOUND");
  if (!(OVERRIDABLE_FIELDS as readonly string[]).includes(input.field)) return refuse("FIELD_NOT_OVERRIDABLE", "field_name");
  const field = input.field as OverridableField;
  const value = input.value.trim();
  if (value === "") return refuse("FIELD_MISSING", "field_value");
  if (input.authority.trim() === "") return refuse("OVERRIDE_AUTHORITY_REQUIRED", "override_authority_ref");
  if (field === "classification" && asClass(value) === null) return refuse("CLASSIFICATION_NOT_IN_SCHEME", "field_value", { version: SCHEME_VERSION, value });
  if (field === "administrative_area" && !WARDS.some((ward) => ward.ward === value)) return refuse("FIELD_MISSING", "field_value");
  const at = now();
  entry.fields[field].push({
    value,
    route: "MANUAL_OVERRIDE",
    source: null,
    at,
    by: staff.account,
    authority: input.authority.trim(),
    version: field === "administrative_area" ? GEOGRAPHY_VERSION : null,
  });
  if (field === "trading_name") renamePremises(w, record, value);
  logEvent(w, record, { code: "OVERRIDDEN", values: { field, value, authority: input.authority.trim() } }, at);
  recordChange(w.p, { subject: { kind: "PREMISES", reference: record }, change: "FIELD_OVERRIDDEN", values: { field, authority: input.authority.trim() }, actor: { kind: "PERSON", name: staff.account, person: null }, reliedOn: { kind: "PERMISSION", row: "OVERRIDE_FIELD" }, at });
  return accept({ field, at });
}

/** The party register names a premises in its relationships and authorities: they follow the new trading name. */
function renamePremises(w: World, record: string, name: string): void {
  const previous = new Set(relationshipsOf(w, record).map((entry) => entry.premises.name));
  for (const entry of relationshipsOf(w, record)) entry.premises.name = name;
  for (const authority of w.p.authorities.values()) if (authority.premises !== null && previous.has(authority.premises)) authority.premises = name;
}

// ---------------------------------------------------------------- SCR-PTY-09

/** The published facts a change effective on a day would contradict: published since that day, naming this premises. */
function contradictedBy(w: World, entry: Entry, effectiveOn: string): PublishedFact[] {
  return w.s.published.filter((fact) => {
    const publishedOn = fact.timed ? dayOf(fact.publishedAt) : fact.publishedAt;
    if (publishedOn < effectiveOn) return false;
    if (time(entry.admittedAt) > time(fact.timed ? fact.publishedAt : startOf(fact.publishedAt))) return false;
    return fact.kind === "PUBLIC_PREMISES_LIST" || fact.area === wardOf(entry);
  });
}

/** SCR-PTY-09: the premises, what prompted the change, and the published facts the date given would contradict. */
export function changeForm(staff: Staff, record: string, effectiveOn: string | null): LoadOutcome<ChangeForm> {
  if (!holds(staff, "ACT-OPS")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(record.toUpperCase());
  if (entry === undefined) return refusedRead("PREMISES_NOT_FOUND");
  const day = today();
  const pending = pendingChange(w, entry.record);
  return ok({
    asOf: now(),
    today: day,
    record: entry.record,
    name: nameOf(entry),
    state: premisesState(w, entry.record),
    party: partyNow(w, entry.record),
    prompt: w.s.prompts[entry.record] ?? null,
    parties: partyOptions(w),
    check: effectiveOn !== null ? { effectiveOn, facts: effectiveOn < day ? contradictedBy(w, entry, effectiveOn) : [] } : null,
    pending: pending !== null ? changeView(w, pending) : null,
  });
}

/** Status records CER issued to the outgoing party for this premises before the change, which stay with it. */
function issuedBefore(w: World, entry: Entry, outgoing: string, effectiveOn: string): Entitlement[] {
  const holder = partyName(w, outgoing);
  const records = recordsOf(w.key, entry.record)
    .filter((record) => record.holder === holder && record.issuedAt !== null && time(record.issuedAt) < time(startOf(effectiveOn)))
    .filter((record) => record.status !== "REPLACED" && record.status !== "CANCELLED" && record.status !== "REVOKED")
    .map((record): Entitlement => ({ kind: "STATUS_RECORD", reference: record.reference, period: null, amountMinor: null }));
  // REG's decisions on this premises, which name it by its trading name.
  const decisions = decisionReferences(w.key)
    .map((ref) => decisionForCollection(w.key, ref)?.record ?? null)
    .filter((decision): decision is NonNullable<typeof decision> => decision !== null && decision.premises === nameOf(entry) && decision.status === "CURRENT")
    .filter((decision) => time(decision.issuedAt) < time(startOf(effectiveOn)) && partyThenAt(w, entry.record, decision.issuedAt) === outgoing)
    .map((decision): Entitlement => ({ kind: "OBLIGATION_DECISION", reference: decision.reference, period: { from: decision.period.from, to: decision.period.to }, amountMinor: null }));
  return [...records, ...decisions];
}

/** A change used to move what was issued: the party it names already operates the premises after an earlier change. */
function transferAttempt(w: World, record: string, incoming: string): { change: Change; disposition: Disposition } | null {
  const earlier = [...w.s.changes].reverse().find((change) => change.premises === record && change.appliedAt !== null && change.cause === "OPERATOR_CHANGE" && change.incoming === incoming);
  if (earlier === undefined) return null;
  const staying = w.s.dispositions.find((disposition) => disposition.change === earlier.id && disposition.state !== "TRANSFERRED" && disposition.entitlement.kind === "STATUS_RECORD");
  return staying !== undefined ? { change: earlier, disposition: staying } : null;
}

const dispositionId = (s: State): string => {
  for (;;) {
    const candidate = reference("DSP");
    if (!s.dispositions.some((entry) => entry.id === candidate)) return candidate;
  }
};

/**
 * POST /premises/{id}/changes, by DR-206: the effective date first (row 6), then the incoming party a change of
 * operator needs (row 5), then a change that would only move what was already issued (row 8), then the contradiction
 * check a backdated change needs (row 7). A later date holds the premises in CHANGE_PENDING under the outgoing party
 * until the sweep applies it; today or earlier applies now, and a backdated change names the published facts it
 * contradicts. Every record issued to the outgoing party before the date raises a disposition, and stays with it.
 */
export function recordPremisesChange(staff: Staff, record: string, input: ChangeInput): PartyAnswer<RecordedChange> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(record);
  if (entry === undefined) return refuse("PREMISES_NOT_FOUND");
  if (pendingChange(w, record) !== null) return refuse("CHANGE_ALREADY_PENDING", null, { on: pendingChange(w, record)?.effectiveOn ?? "" });
  const outgoing = currentRelationship(w, record);
  if (outgoing === null) return refuse("NOT_OPERATED");
  if (!(CHANGE_CAUSES as readonly string[]).includes(input.cause)) return refuse("FIELD_MISSING", "cause");
  const cause = input.cause as Change["cause"];
  if (input.effectiveOn === null) return refuse("EFFECTIVE_DATE_REQUIRED", "effective_on");
  const effectiveOn = input.effectiveOn;
  let incoming: string | null = null;
  if (cause === "OPERATOR_CHANGE") {
    const party = w.p.parties.get(input.incoming.trim());
    if (party === undefined || party.state === "SUPERSEDED") return refuse("INCOMING_PARTY_REQUIRED", "incoming_party_id");
    if (party.record === outgoing.party) {
      const attempt = transferAttempt(w, record, party.record);
      if (attempt !== null) {
        return refuse("TRANSFER_DECISION_REQUIRED", null, {
          record: attempt.disposition.entitlement.reference ?? "",
          holder: partyName(w, attempt.disposition.issuedTo),
          change: attempt.change.id,
          disposition: attempt.disposition.id,
        });
      }
      return refuse("INCOMING_PARTY_REQUIRED", "incoming_party_id");
    }
    incoming = party.record;
  }
  const day = today();
  const backdated = effectiveOn < day;
  if (backdated && input.checkedFor !== effectiveOn) return refuse("CONTRADICTION_CHECK_INCOMPLETE", "effective_on");
  const at = now();
  const change: Change = {
    id: reference("CHG"),
    premises: record,
    cause,
    effectiveOn,
    outgoing: outgoing.party,
    incoming,
    recordedAt: at,
    recordedBy: staff.account,
    basis: null,
    appliedAt: null,
    contradicted: backdated ? contradictedBy(w, entry, effectiveOn) : [],
  };
  const raised = issuedBefore(w, entry, outgoing.party, effectiveOn).map(
    (entitlement): Disposition => ({ id: dispositionId(w.s), change: change.id, entitlement, issuedTo: outgoing.party, state: "RAISED", proposal: null, decision: null, heldBy: null }),
  );
  w.s.changes.push(change);
  w.s.dispositions.push(...raised);
  logEvent(w, record, { code: "CHANGE_RECORDED", values: { cause, effectiveOn, by: staff.account } }, at, outgoing.party);
  recordChange(w.p, { subject: { kind: "PREMISES", reference: record }, change: "PREMISES_CHANGE_RECORDED", values: { cause, effectiveOn }, actor: { kind: "PERSON", name: staff.account, person: null }, reliedOn: { kind: "PERMISSION", row: "RECORD_CHANGE" }, at });
  if (effectiveOn <= day) applyChange(w, change, at, staff);
  return accept({ change: changeView(w, change), dispositions: raised.map((disposition) => dispositionRow(w, disposition)) });
}

// ---------------------------------------------------------------- SCR-PTY-10

/** Every event of a premises: the register's own, the status records CER issued for it, and REG's decisions on it. */
export function premisesHistory(staff: Staff, record: string): LoadOutcome<PremisesHistory> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(record.toUpperCase());
  if (entry === undefined) return refusedRead("PREMISES_NOT_FOUND");
  const logged = w.s.events.filter((event) => event.premises === entry.record);
  const issued = recordsOf(w.key, entry.record)
    .filter((issuedRecord): issuedRecord is IssuedRecord & { issuedAt: string } => issuedRecord.issuedAt !== null)
    .map((issuedRecord): Event => ({ premises: entry.record, at: issuedRecord.issuedAt, what: { code: "RECORD_ISSUED", values: { reference: issuedRecord.reference } }, partyThen: partyThenAt(w, entry.record, issuedRecord.issuedAt) }));
  const decided = decisionReferences(w.key)
    .map((ref) => decisionForCollection(w.key, ref)?.record ?? null)
    .filter((decision): decision is NonNullable<typeof decision> => decision !== null && decision.premises === nameOf(entry))
    .map((decision): Event => ({ premises: entry.record, at: decision.issuedAt, what: { code: "DECISION_ISSUED", values: { reference: decision.reference } }, partyThen: partyThenAt(w, entry.record, decision.issuedAt) }));
  // Newest first; of two events at the same instant the one logged later comes first (a relationship ends, then the next begins).
  const events = [...logged, ...issued, ...decided]
    .map((event, order) => ({ event, order }))
    .sort((a, b) => time(b.event.at) - time(a.event.at) || b.order - a.order)
    .map(({ event }) => event);
  const changes = w.s.changes.filter((change) => change.premises === entry.record && change.cause === "OPERATOR_CHANGE" && change.appliedAt !== null);
  const refiled = w.s.dispositions.some((disposition) => changes.some((change) => change.id === disposition.change) && disposition.state === "TRANSFERRED");
  return ok({
    asOf: now(),
    record: entry.record,
    name: nameOf(entry),
    rows: events.map((event, index): HistoryRow => ({ key: `${event.at}-${String(index)}`, at: event.at, what: event.what, partyThen: partyRef(w, event.partyThen) })),
    noRefile: changes.length > 0 && !refiled,
    onlyAdmission: events.length === 1 && dayOf(entry.admittedAt) === today(),
  });
}

// ---------------------------------------------------------------- SCR-PTY-14 and the run sweep

/** What the national source states for a field of an entry: the value the source or the alternative route gave last. */
function sourceValue(entry: Entry, field: OverridableField): Value | null {
  return [...entry.fields[field]].reverse().find((row) => row.route === "AUTHORITATIVE_SOURCE" || row.route === "ALTERNATIVE_ROUTE") ?? null;
}

/**
 * A run compares every entry with the source, by DR-205: a descriptive field the register took from the source and
 * the source now states otherwise is applied; one a person overrode waits (OVERRIDE_CONFLICT); a party relationship
 * the source states otherwise waits for a decision (DISPOSITION_AWAITED) and is never applied by the run.
 */
function compare(w: World, run: Run): Difference[] {
  const found: Difference[] = [];
  for (const entry of w.s.entries.values()) {
    for (const field of OVERRIDABLE_FIELDS) {
      const held = current(entry.fields[field]);
      const said = sourceValue(entry, field);
      if (held === null || said === null || held.value === said.value) continue;
      if (held.route === "MANUAL_OVERRIDE") {
        found.push({ id: `DIF-${entry.record.slice(4)}-${run.id.slice(-4)}-${field}`, run: run.id, premises: entry.record, field, fieldClass: "DESCRIPTIVE", registerValue: valueOf(field, held), sourceValue: valueOf(field, said), reason: "OVERRIDE_CONFLICT" });
      }
    }
    const stated = w.s.sourceParties[entry.record];
    const operating = currentRelationship(w, entry.record);
    if (stated !== undefined && operating !== null && operating.party !== stated.party) {
      found.push({
        id: `DIF-${entry.record.slice(4)}-${run.id.slice(-4)}-party`,
        run: run.id,
        premises: entry.record,
        field: "party",
        fieldClass: "STATUS_OR_RELATIONSHIP",
        registerValue: { kind: "party", record: operating.party, legalName: "" },
        sourceValue: { kind: "party", record: stated.party, legalName: "" },
        reason: "DISPOSITION_AWAITED",
      });
    }
  }
  return found;
}

/**
 * POST /reconciliation-runs/{id}/completion, as the sweep records it once a run has compared every record: the run
 * COMPLETED with its counts, from which the next interval is measured, and every licensing status derived again.
 */
function completeRuns(w: World): void {
  for (const run of w.s.runs) {
    if (run.state !== "RUNNING" || time(run.startedAt) + RUN_DURATION_MS > Date.now()) continue;
    const found = compare(w, run);
    w.s.differences.push(...found);
    run.state = "COMPLETED";
    run.completedAt = new Date(time(run.startedAt) + RUN_DURATION_MS).toISOString();
    run.compared = w.s.entries.size;
    run.found = found.length;
    for (const entry of w.s.entries.values()) entry.derivedAt = null;
  }
}

/** The hourly check (SM-194 transition 3): the interval passed with no completed run raises one exception at a time. */
function raiseOverdue(w: World): void {
  const due = nextDue(w);
  if (due !== null && time(due) > Date.now()) return;
  const open = w.s.exceptions.some((exception) => exception.kind === "RECONCILIATION_OVERDUE" && exception.resolved === null);
  if (open) return;
  w.s.exceptions.push({ id: reference("EXC"), kind: "RECONCILIATION_OVERDUE", premises: null, area: null, raisedAt: due ?? now(), acknowledged: null, resolved: null });
}

function runRow(w: World, run: Run): RunRow {
  return {
    id: run.id,
    state: run.state,
    startedAt: run.startedAt,
    dueAt: run.dueAt ?? run.startedAt,
    startedBy: run.startedBy,
    firstLoad: run.firstLoad,
    route: run.state === "REFUSED" ? null : "AUTHORITATIVE_SOURCE",
    completedAt: run.completedAt,
    stoppedAt: run.stoppedAt,
    compared: run.state === "RUNNING" ? null : run.compared,
    differences: run.state === "RUNNING" ? null : run.found,
    awaiting: run.state === "RUNNING" ? null : w.s.differences.filter((difference) => difference.run === run.id).length,
  };
}

/** GET /reconciliation-runs: the interval from the last completion, the run not started yet, and every run. */
export function reconciliationRuns(staff: Staff): LoadOutcome<ReconciliationView> {
  if (!holds(staff, "ACT-DAT", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const running = w.s.runs.find((run) => run.state === "RUNNING") ?? null;
  const due = nextDue(w);
  const late = overdue(w);
  const runs = [...w.s.runs].sort((a, b) => time(b.startedAt) - time(a.startedAt)).map((run) => runRow(w, run));
  const notStarted: RunRow | null =
    running === null
      ? { id: "next", state: late ? "OVERDUE" : "DUE", startedAt: null, dueAt: due ?? now(), startedBy: null, firstLoad: false, route: null, completedAt: null, stoppedAt: null, compared: null, differences: null, awaiting: null }
      : null;
  const withDifferences = [...w.s.runs]
    .filter((run) => run.state === "COMPLETED" || run.state === "INCOMPLETE")
    .sort((a, b) => time(b.startedAt) - time(a.startedAt))[0];
  const differences = withDifferences !== undefined ? w.s.differences.filter((difference) => difference.run === withDifferences.id) : [];
  const relationship = differences.filter((difference) => difference.field === "party");
  return ok({
    asOf: now(),
    state: running !== null ? "RUNNING" : late ? "OVERDUE" : "DUE",
    limitation: limitationOf(w),
    nextDue: due,
    connection: w.s.connection,
    runs: notStarted !== null ? [notStarted, ...runs] : runs,
    differences:
      withDifferences !== undefined
        ? {
            run: { id: withDifferences.id, startedAt: withDifferences.startedAt, completedAt: withDifferences.completedAt },
            licensing: 0,
            relationship: relationship.length,
            overridden: differences.filter((difference) => difference.reason === "OVERRIDE_CONFLICT").length,
            relationshipNames: relationship.map((difference) => {
              const entry = w.s.entries.get(difference.premises);
              return entry !== undefined ? nameOf(entry) : difference.premises;
            }),
          }
        : null,
    overdueException: w.s.exceptions.find((exception) => exception.kind === "RECONCILIATION_OVERDUE" && exception.resolved === null)?.id ?? null,
    running: running !== null ? runRow(w, running) : null,
    mayStart: holds(staff, "ACT-DAT"),
    geography: geographyOf(w, staff),
  });
}

/**
 * POST /reconciliation-runs by the data owner: one run at a time (RUN_ALREADY_RUNNING), and none without a route to
 * the source (NO_POPULATION_ROUTE), which leaves a REFUSED run on the list rather than a partial one. The run is due
 * from the last completed run, not from the last attempt.
 */
export function startReconciliationRun(staff: Staff): PartyAnswer<{ run: string }> {
  if (!holds(staff, "ACT-DAT")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const running = w.s.runs.find((run) => run.state === "RUNNING");
  if (running !== undefined) return refuse("RUN_ALREADY_RUNNING", null, { since: running.startedAt });
  const at = now();
  const run: Run = { id: reference("RUN"), startedAt: at, dueAt: nextDue(w), startedBy: staff.account, state: "RUNNING", completedAt: null, stoppedAt: null, stoppedPoint: null, firstLoad: false, compared: null, found: null };
  if (w.s.connection === "UNAVAILABLE") {
    w.s.runs.push({ ...run, state: "REFUSED" });
    return refuse("NO_POPULATION_ROUTE");
  }
  w.s.runs.push(run);
  return accept({ run: run.id });
}

// ---------------------------------------------------------------- SCR-PTY-15

const revocationKey = (authority: string) => `EXC-${authority}`;

/** The late revocations the party register raised (FR-PTY-028), with what this register has done with each. */
function revocationRows(w: World): ExceptionRow[] {
  const rows: ExceptionRow[] = [];
  for (const authority of w.p.authorities.values()) {
    // The point that raised the exception, which stays on the queue once it has stopped until someone resolves it.
    const late = authority.revocation?.propagation?.find((point) => point.exception !== null);
    if (authority.revocation === null || late === undefined || late.exception === null) continue;
    const id = revocationKey(authority.reference);
    const kept = w.s.revocations.get(id);
    const acknowledged = kept?.acknowledged ?? { by: late.exception.acknowledgedBy, at: late.exception.acknowledgedAt };
    const resolved = kept?.resolved ?? null;
    rows.push({
      id,
      kind: "REVOCATION_NOT_PROPAGATED",
      subject: { kind: "AUTHORITY", reference: authority.reference, person: w.p.persons.get(authority.person)?.name ?? authority.person, party: partyName(w, authority.party) },
      raisedAt: late.exception.raisedAt,
      state: resolved !== null ? "RESOLVED" : "ACKNOWLEDGED",
      acknowledged,
      resolved,
      condition: {
        kind: "REVOCATION",
        revokedAt: authority.revocation.at,
        stopped: (authority.revocation.propagation ?? []).filter((point) => point.stoppedAt !== null).map((point) => ({ point: point.point, at: point.stoppedAt ?? "" })),
        // The condition is the point that has not stopped; once every point has, the exception may be resolved.
        holds: (authority.revocation.propagation ?? []).some((point) => point.stoppedAt === null),
      },
    });
  }
  return rows;
}

function registerExceptionRow(w: World, exception: RegisterException): ExceptionRow {
  const entry = exception.premises !== null ? w.s.entries.get(exception.premises) : undefined;
  const last = lastCompleted(w);
  const completedSince = last !== null && time(last) > time(exception.raisedAt) ? last : null;
  const area = exception.area;
  // NO_SUCCESSOR_AREA holds while any premises still carries the withdrawn area under its version (FR-PTY-040).
  const left = area !== null ? carrying(w, area.version, area.name).length : 0;
  return {
    id: exception.id,
    kind: exception.kind,
    subject: area !== null ? { kind: "AREA", area: area.name, version: area.version } : entry !== undefined ? { kind: "PREMISES", record: entry.record, name: nameOf(entry) } : { kind: "REGISTER" },
    raisedAt: exception.raisedAt,
    state: exception.resolved !== null ? "RESOLVED" : exception.acknowledged !== null ? "ACKNOWLEDGED" : "OPEN",
    acknowledged: exception.acknowledged,
    resolved: exception.resolved,
    condition:
      exception.kind === "RECONCILIATION_OVERDUE"
        ? { kind: "OVERDUE", lastCompleted: last, daysSince: last !== null ? daysBetween(last, now()) : null, holds: completedSince === null, completedSince }
        : exception.kind === "NO_SUCCESSOR_AREA"
          ? { kind: "AREA", premises: left, holds: left > 0 }
          : { kind: "DERIVATION", holds: false },
  };
}

function allExceptions(w: World): ExceptionRow[] {
  return [...w.s.exceptions.map((exception) => registerExceptionRow(w, exception)), ...revocationRows(w)].sort((a, b) => time(b.raisedAt) - time(a.raisedAt));
}

/** GET /exceptions: every exception this family raised, the most recently raised first. */
export function exceptionQueue(staff: Staff): LoadOutcome<ExceptionQueue> {
  if (!holds(staff, "ACT-DAT", "ACT-SEC", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  return ok({ asOf: now(), rows: allExceptions(w), intervalDays: RECONCILIATION_INTERVAL_DAYS, mayAct: holds(staff, "ACT-DAT", "ACT-SEC"), me: staff.account });
}

/** POST /exceptions/{id}/acknowledgement: the reader's name on it; one already taken says by whom. */
export function acknowledgeException(staff: Staff, id: string): PartyAnswer<{ at: string }> {
  if (!holds(staff, "ACT-DAT", "ACT-SEC")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const row = allExceptions(w).find((entry) => entry.id === id);
  if (row === undefined) return refuse("EXCEPTION_NOT_FOUND");
  if (row.resolved !== null) return refuse("EXCEPTION_RESOLVED");
  if (row.acknowledged !== null) return refuse("ALREADY_ACKNOWLEDGED", null, { name: row.acknowledged.by, at: row.acknowledged.at });
  const at = now();
  const exception = w.s.exceptions.find((entry) => entry.id === id);
  if (exception !== undefined) exception.acknowledged = { by: staff.account, at };
  else w.s.revocations.set(id, { acknowledged: { by: staff.account, at }, resolved: null });
  return accept({ at });
}

/**
 * POST /exceptions/{id}/resolution: refused while the condition holds, naming the figure that has not changed (for
 * an overdue register, the last completed run), so closing an exception never stands in for fixing what raised it.
 */
export function resolveException(staff: Staff, id: string, resolution: string): PartyAnswer<{ at: string }> {
  if (!holds(staff, "ACT-DAT", "ACT-SEC")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const row = allExceptions(w).find((entry) => entry.id === id);
  if (row === undefined) return refuse("EXCEPTION_NOT_FOUND");
  if (row.resolved !== null) return refuse("EXCEPTION_RESOLVED");
  if (row.condition.holds) {
    const figure =
      row.condition.kind === "OVERDUE"
        ? (row.condition.lastCompleted ?? "")
        : row.condition.kind === "REVOCATION"
          ? row.condition.revokedAt
          : row.condition.kind === "AREA"
            ? String(row.condition.premises)
            : "";
    return refuse("CONDITION_STILL_HOLDS", null, { kind: row.condition.kind, figure });
  }
  if (resolution.trim() === "") return refuse("RESOLUTION_REQUIRED", "resolution");
  const at = now();
  const exception = w.s.exceptions.find((entry) => entry.id === id);
  const resolved = { by: staff.account, at, resolution: resolution.trim() };
  if (exception !== undefined) exception.resolved = resolved;
  // A late revocation is the party register's; what this register did with it is kept beside it.
  else w.s.revocations.set(id, { acknowledged: row.acknowledged, resolved });
  return accept({ at });
}

// ---------------------------------------------------------------- FR-PTY-040: re-pointing to a new geography version

/** The area a premises carries now, with the geography version it belongs to; null where the register records none. */
function areaNow(entry: Entry): { area: string; version: string } | null {
  const row = current(entry.fields.administrative_area);
  return row === null ? null : { area: row.value, version: row.version ?? GEOGRAPHY_VERSION };
}

/** The entries carrying an area of a geography version now. */
function carrying(w: World, version: string, area: string): Entry[] {
  return [...w.s.entries.values()].filter((entry) => {
    const now = areaNow(entry);
    return now !== null && now.version === version && now.area === area;
  });
}

/** The successor of an area under a table: the area it maps to, null where it was withdrawn, itself where unnamed. */
const successorOf = (areas: Readonly<Record<string, string | null>>, area: string): string | null => (area in areas ? (areas[area] ?? null) : area);

/** The open exception raised for an area left with no successor, where one is. */
const openAreaException = (w: World, area: string, version: string): RegisterException | null =>
  w.s.exceptions.find((exception) => exception.kind === "NO_SUCCESSOR_AREA" && exception.resolved === null && exception.area?.name === area && exception.area.version === version) ?? null;

/** Each published table whose earlier version some premises still carry, with what re-pointing under it would do now. */
function geographyOf(w: World, staff: Staff): GeographyView {
  const pending = Object.entries(GEOGRAPHY_SUCCESSORS)
    .map(([from, table]) => {
      const entries = [...w.s.entries.values()].filter((entry) => areaNow(entry)?.version === from);
      const withdrawn = [...new Set(entries.map((entry) => areaNow(entry)?.area ?? ""))]
        .filter((area) => successorOf(table.areas, area) === null)
        .sort((a, b) => collator.compare(a, b))
        .map((area) => ({ area, premises: carrying(w, from, area).length, exception: openAreaException(w, area, from)?.id ?? null }));
      return { from, to: table.to, premises: entries.filter((entry) => successorOf(table.areas, areaNow(entry)?.area ?? "") !== null).length, withdrawn };
    })
    .filter((row) => row.premises > 0 || row.withdrawn.length > 0);
  return { current: GEOGRAPHY_VERSION, pending, mayRepoint: holds(staff, "ACT-DAT") };
}

/**
 * POST /geography-repointings by the data owner, at the instant the successor is to apply from, so the re-pointing is
 * prospective by construction: each premises carrying an area of the earlier version takes its successor from now, the
 * earlier area staying on its provenance, its history and every record made before (FR-PTY-040). Both versions must be
 * ones the service holds, with a published table leading from one to the other (GEOGRAPHY_VERSION_UNKNOWN). Each
 * premises is its own transaction: an area withdrawn with no successor keeps its premises where they are, raises
 * NO_SUCCESSOR_AREA on the exception queue (once while it stays open) and is written to the audit log; the refusal is
 * the answer only where nothing could be re-pointed, and otherwise the areas left behind are named beside the count.
 */
export function repointGeography(staff: Staff, input: RepointInput): PartyAnswer<RepointAnswer> {
  if (!holds(staff, "ACT-DAT")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const at = now();
  const audit = (code: string, subject: string) => w.p.audit.push({ code, person: null, subject, at });
  const held = GEOGRAPHY_VERSIONS as readonly string[];
  const from = input.fromVersion.trim();
  const to = input.toVersion.trim();
  if (!held.includes(from)) {
    audit("GEOGRAPHY_VERSION_UNKNOWN", from);
    return refuse("GEOGRAPHY_VERSION_UNKNOWN", "from_geography_version", { version: from });
  }
  const table = GEOGRAPHY_SUCCESSORS[from];
  if (!held.includes(to) || table === undefined || table.to !== to) {
    audit("GEOGRAPHY_VERSION_UNKNOWN", to);
    return refuse("GEOGRAPHY_VERSION_UNKNOWN", "to_geography_version", { version: to });
  }
  let repointed = 0;
  const left = new Map<string, number>();
  for (const entry of w.s.entries.values()) {
    const area = areaNow(entry);
    if (area === null || area.version !== from) continue;
    const successor = successorOf(table.areas, area.area);
    if (successor === null) {
      left.set(area.area, (left.get(area.area) ?? 0) + 1);
      continue;
    }
    entry.fields.administrative_area.push({ value: successor, route: "AUTHORITATIVE_SOURCE", source: null, at, by: staff.account, authority: null, version: to });
    w.s.repointings.push({ id: reference("GRP"), premises: entry.record, fromArea: area.area, fromVersion: from, toArea: successor, toVersion: to, effectiveAt: at, by: staff.account });
    logEvent(w, entry.record, { code: "REPOINTED", values: { from: area.area, to: successor, fromVersion: from, toVersion: to } }, at);
    recordChange(w.p, {
      subject: { kind: "PREMISES", reference: entry.record },
      change: "AREA_REPOINTED",
      values: { from: area.area, to: successor, fromVersion: from, toVersion: to },
      actor: { kind: "PERSON", name: staff.account, person: null },
      reliedOn: { kind: "PERMISSION", row: "REPOINT_GEOGRAPHY" },
      at,
    });
    repointed += 1;
  }
  const withdrawn = [...left.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([area, premises]) => {
      let exception = openAreaException(w, area, from);
      if (exception === null) {
        exception = { id: reference("EXC"), kind: "NO_SUCCESSOR_AREA", premises: null, area: { name: area, version: from }, raisedAt: at, acknowledged: null, resolved: null };
        w.s.exceptions.push(exception);
      }
      audit("NO_SUCCESSOR_AREA", area);
      return { area, premises, exception: exception.id };
    });
  const first = withdrawn[0];
  if (repointed === 0 && first !== undefined) return refuse("NO_SUCCESSOR_AREA", null, { area: first.area, version: from, premises: String(first.premises), exception: first.exception });
  return accept({ repointed, withdrawn });
}

/** GET /premises/{id}/geography-repointings: each re-pointing, newest first, for the data owner and assurance. */
export function geographyRepointings(staff: Staff, record: string): LoadOutcome<RepointingList> {
  if (!holds(staff, "ACT-DAT", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const entry = w.s.entries.get(premisesRecordOf(record));
  if (entry === undefined) return refusedRead("PREMISES_NOT_FOUND");
  const rows = w.s.repointings
    .filter((row) => row.premises === entry.record)
    .sort((a, b) => time(b.effectiveAt) - time(a.effectiveAt))
    .map((row) => ({ id: row.id, fromArea: row.fromArea, fromVersion: row.fromVersion, toArea: row.toArea, toVersion: row.toVersion, effectiveAt: row.effectiveAt, by: row.by }));
  return ok({ record: entry.record, rows });
}

// ---------------------------------------------------------------- SCR-PTY-16

function dispositionRow(w: World, disposition: Disposition): DispositionRow {
  return {
    id: disposition.id,
    entitlement: disposition.entitlement,
    issuedTo: { record: disposition.issuedTo, legalName: partyName(w, disposition.issuedTo) },
    state: disposition.state,
    proposal: disposition.proposal !== null ? { ...disposition.proposal, receiving: partyRef(w, disposition.proposal.receiving) } : null,
    decision: disposition.decision,
    heldBy: partyRef(w, disposition.heldBy),
  };
}

/** The premises changes that left records behind, the one with records awaiting a decision first. */
export function dispositionQueue(staff: Staff): LoadOutcome<DispositionQueue> {
  if (!holds(staff, "ACT-OPS", "ACT-BIZ-APR", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const rows = w.s.changes
    .map((change) => {
      const dispositions = w.s.dispositions.filter((disposition) => disposition.change === change.id);
      const entry = w.s.entries.get(change.premises);
      return {
        change: change.id,
        premises: { record: change.premises, name: entry !== undefined ? nameOf(entry) : change.premises },
        cause: change.cause,
        effectiveOn: change.effectiveOn,
        outgoing: partyName(w, change.outgoing),
        incoming: change.incoming !== null ? partyName(w, change.incoming) : null,
        recordedAt: change.recordedAt,
        recordedBy: change.recordedBy,
        total: dispositions.length,
        awaiting: dispositions.filter((disposition) => disposition.state === "AWAITING_APPROVAL").length,
        raised: dispositions.filter((disposition) => disposition.state === "RAISED").length,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.awaiting - a.awaiting || time(b.recordedAt) - time(a.recordedAt));
  return ok({ asOf: now(), rows });
}

/** GET /entitlement-dispositions?premises_change_id=: each record the change left, with its proposal and decision. */
export function dispositionsOfChange(staff: Staff, id: string): LoadOutcome<ChangeDispositions> {
  if (!holds(staff, "ACT-OPS", "ACT-BIZ-APR", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  const change = w.s.changes.find((entry) => entry.id === id);
  if (change === undefined) return refusedRead("DISPOSITION_NOT_FOUND");
  const entry = w.s.entries.get(change.premises);
  return ok({
    asOf: now(),
    change: { ...changeView(w, change), premises: { record: change.premises, name: entry !== undefined ? nameOf(entry) : change.premises } },
    rows: w.s.dispositions.filter((disposition) => disposition.change === id).map((disposition) => dispositionRow(w, disposition)),
    mayDecide: holds(staff, "ACT-BIZ-APR"),
    mayPropose: holds(staff, "ACT-OPS"),
    me: staff.account,
  });
}

function changeOf(w: World, disposition: Disposition): Change | null {
  return w.s.changes.find((change) => change.id === disposition.change) ?? null;
}

/**
 * POST /entitlement-dispositions/{id}/proposals by an officer: a transfer to the incoming party or a closure, with a
 * ground. Only a RAISED record takes a proposal (DISPOSITION_NOT_RAISED), and a transfer needs a party to receive it.
 */
export function proposeDisposition(staff: Staff, id: string, input: ProposalInput): PartyAnswer<{ state: DispositionState }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const w = world(staff.sessionId);
  const disposition = w.s.dispositions.find((entry) => entry.id === id);
  const change = disposition !== undefined ? changeOf(w, disposition) : null;
  if (disposition === undefined || change === null) return refuse("DISPOSITION_NOT_FOUND");
  if (disposition.state !== "RAISED") return refuse("DISPOSITION_NOT_RAISED", null, { state: disposition.state });
  if (input.outcome !== "TRANSFER" && input.outcome !== "CLOSE") return refuse("FIELD_MISSING", "proposed_outcome");
  if (input.ground.trim() === "") return refuse("GROUND_REQUIRED", "ground");
  if (input.outcome === "TRANSFER" && change.incoming === null) return refuse("RECEIVING_PARTY_REQUIRED", "receiving_party_id");
  const at = now();
  disposition.state = "AWAITING_APPROVAL";
  disposition.proposal = { outcome: input.outcome, receiving: input.outcome === "TRANSFER" ? change.incoming : null, ground: { text: input.ground.trim() }, by: staff.account, role: "OPS", at };
  logEvent(w, change.premises, { code: "PROPOSED", values: { ...entitlementValues(disposition.entitlement), outcome: input.outcome, by: staff.account } }, at);
  return accept({ state: disposition.state });
}

/**
 * POST /entitlement-dispositions/{id}/decisions by a business approver (FR-PTY-036): only an approving authority
 * decides (APPROVING_AUTHORITY_REQUIRED), only a record awaiting approval is decided, never by the person who proposed
 * it (SAME_ACTOR_AS_PROPOSER), and always with a ground. Approving moves it to the party the proposal names, or
 * closes it; leaving it in place is an outcome with the approver's name, not the absence of one.
 */
export function decideDisposition(staff: Staff, id: string, input: DecisionInput): PartyAnswer<{ state: DispositionState }> {
  if (!holds(staff, "ACT-BIZ-APR")) return refuse("APPROVING_AUTHORITY_REQUIRED");
  const w = world(staff.sessionId);
  const disposition = w.s.dispositions.find((entry) => entry.id === id);
  const change = disposition !== undefined ? changeOf(w, disposition) : null;
  if (disposition === undefined || change === null) return refuse("DISPOSITION_NOT_FOUND");
  if (disposition.state !== "AWAITING_APPROVAL" || disposition.proposal === null) {
    return refuse("DISPOSITION_NOT_AWAITING_APPROVAL", null, { state: disposition.state, at: disposition.decision?.at ?? "", by: disposition.decision?.by ?? "" });
  }
  if (disposition.proposal.by === staff.account) return refuse("SAME_ACTOR_AS_PROPOSER");
  if (input.ground.trim() === "") return refuse("GROUND_REQUIRED", "ground");
  if (input.decision !== "APPROVE" && input.decision !== "LEAVE_IN_PLACE") return refuse("FIELD_MISSING", "decision");
  const at = now();
  const outcome = input.decision === "LEAVE_IN_PLACE" ? "LEAVE_IN_PLACE" : disposition.proposal.outcome;
  disposition.decision = { outcome, by: staff.account, role: "BIZ_APR", at, ground: { text: input.ground.trim() } };
  disposition.state = outcome === "TRANSFER" ? "TRANSFERRED" : outcome === "CLOSE" ? "CLOSED" : "LEFT_IN_PLACE";
  disposition.heldBy = outcome === "TRANSFER" ? disposition.proposal.receiving : null;
  logEvent(w, change.premises, { code: "DECIDED", values: { ...entitlementValues(disposition.entitlement), outcome, by: staff.account, receiving: partyName(w, disposition.proposal.receiving) } }, at);
  return accept({ state: disposition.state });
}

// ---------------------------------------------------------------- the premises portal

/**
 * GET /premises/{id} for a premises actor: theirs where their authority covers reading it now (DR-201 through
 * `authorityToActAt`: the principal's party operates it, or a delegate's scope names it), otherwise NOT_YOUR_PREMISES.
 */
export function premisesOfPrincipal(principal: Principal, record: string): "OWN" | "NOT_YOUR_PREMISES" | "PREMISES_NOT_FOUND" {
  const w = world(principal.sessionId);
  const entry = w.s.entries.get(premisesRecordOf(record));
  if (entry === undefined) return "PREMISES_NOT_FOUND";
  return authorityToActAt(principal.sessionId, entry.record, "READ").kind === "GRANT" ? "OWN" : "NOT_YOUR_PREMISES";
}

/** The relationships of a premises, oldest first, each with its party, its period and what ended it. */
function relationshipRows(w: World, record: string): RelationshipRow[] {
  const day = today();
  return relationshipsOf(w, record)
    .map((entry) => ({
      party: { record: entry.party, legalName: partyName(w, entry.party) },
      from: entry.from,
      to: entry.to,
      endCause: entry.endCause ?? null,
      recorded: entry.recorded ?? null,
      inForce: (entry.from === null || entry.from <= day) && (entry.to === null || entry.to >= day),
    }))
    .sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
}

/**
 * GET /premises/{id}/relationship-at's answer at an instant already validated: the relationship in force then, the
 * last one that had ended before it, or none - with the day a later one starts, where one does (FR-PTY-045).
 */
function relationshipAtInstant(w: World, record: string, at: string, organisation: string | null = null): RelationshipAtView {
  const day = dayOf(at);
  const parties = organisation === null ? null : new Set([...w.p.parties.values()].filter((party) => party.organisation === organisation).map((party) => party.record));
  const held = relationshipsOf(w, record).filter((entry) => parties === null || parties.has(entry.party));
  const base = { at, requestedAt: now(), endedOn: null, cause: null, startsOn: null };
  const effective = held.find((entry) => (entry.from === null || entry.from <= day) && (entry.to === null || entry.to >= day));
  if (effective !== undefined) return { ...base, answer: "AUTHORITY_EFFECTIVE", party: partyRef(w, effective.party), from: effective.from, to: effective.to };
  const ended = held.filter((entry) => entry.to !== null && entry.to < day).sort((a, b) => (a.to ?? "").localeCompare(b.to ?? "")).at(-1);
  if (ended !== undefined) return { ...base, answer: "RELATIONSHIP_ENDED", party: partyRef(w, ended.party), from: ended.from, to: ended.to, endedOn: ended.to, cause: ended.endCause ?? null };
  const later = held.filter((entry) => entry.from !== null && entry.from > day).sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""))[0];
  return { ...base, answer: "NO_RELATIONSHIP", party: null, from: null, to: null, startsOn: later?.from ?? null };
}

function timelineOf(w: World, entry: Entry, asked: RelationshipAtView | null): PremisesTimeline {
  return {
    asOf: now(),
    record: entry.record,
    name: nameOf(entry),
    relationships: relationshipRows(w, entry.record),
    changes: w.s.changes
      .filter((change) => change.premises === entry.record)
      .sort((a, b) => time(b.recordedAt) - time(a.recordedAt))
      .map((change) => changeView(w, change)),
    asked,
  };
}

/**
 * SCR-PTY-07's relationships and changes for the console (GET /premises/{id}/relationships and /changes), and, where
 * the officer asks one, GET /premises/{id}/relationship-at: a moment later than now is INSTANT_IN_FUTURE naming both,
 * never answered from the present (FR-PTY-046); a question with no premises is PREMISES_REQUIRED.
 */
export function premisesTimeline(staff: Staff, record: string, at: string | null = null): LoadOutcome<PremisesTimeline> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const w = world(staff.sessionId);
  if (record.trim() === "") return refusedRead("PREMISES_REQUIRED");
  const entry = w.s.entries.get(premisesRecordOf(record));
  if (entry === undefined) return refusedRead("PREMISES_NOT_FOUND");
  if (at === null) return ok(timelineOf(w, entry, null));
  if (Number.isNaN(time(at))) return refusedRead("FIELD_MISSING");
  // The page names the moment asked and the time of the request (`asOf`) beside the refusal.
  if (time(at) > Date.now()) return refusedRead("INSTANT_IN_FUTURE");
  return ok(timelineOf(w, entry, relationshipAtInstant(w, entry.record, at)));
}

/** The canvas's scope keys a premises actor may hold, in the order the screens list them. */
const PORTAL_ACTS = ["READ", "SUBMIT", "APPROVE"] as const;

/** What the person a session signs in as may do at a premises now: the scope keys DR-201 grants them there. */
const actsAt = (sessionId: string, record: string) => PORTAL_ACTS.filter((act) => authorityToActAt(sessionId, record, act).kind === "GRANT");

function areaOf(entry: Entry): AreaValue | null {
  const row = current(entry.fields.administrative_area);
  return row === null ? null : { ward: row.value, city: cityOf(row.value), version: row.version ?? GEOGRAPHY_VERSION };
}

/**
 * GET /portfolio (SCR-PTY-19): the party the session acts for, and the premises the person's authority covers now -
 * every premises the party operates for its principal, the premises a delegate's scope names for a delegate - each with
 * its state (SM-191), licensing status (DR-207) and what the person may do there, and the limitation every register read
 * carries (FR-PTY-043). The other parties the person holds an authority for are named, never listed in this view; a
 * party asked for that no authority of the person covers is NOT_YOUR_PARTY, and nothing of it is listed (FR-PTY-007).
 */
export function portfolio(principal: Principal, asked: string | null): LoadOutcome<Portfolio> {
  const w = world(principal.sessionId);
  const acting = actingAs(principal.sessionId);
  if (acting === null) return refusedRead("NOT_YOUR_PARTY");
  if (asked !== null && asked.trim().toUpperCase() !== acting.party) return refusedRead(w.p.parties.has(asked.trim().toUpperCase()) ? "NOT_YOUR_PARTY" : "PARTY_NOT_FOUND");
  const day = today();
  const operated = w.p.relationships.filter((entry) => entry.party === acting.party && entry.premises.record !== null && (entry.from === null || entry.from <= day) && (entry.to === null || entry.to >= day));
  const rows = operated
    .map((relationship) => w.s.entries.get(relationship.premises.record ?? ""))
    .filter((entry): entry is Entry => entry !== undefined)
    .map((entry) => ({ entry, acts: actsAt(principal.sessionId, entry.record) }))
    .filter((row) => row.acts.includes("READ"))
    .sort((a, b) => collator.compare(nameOf(a.entry), nameOf(b.entry)))
    .map(({ entry, acts }) => ({ record: entry.record, name: nameOf(entry), state: premisesState(w, entry.record), licensing: licensingOf(w, entry), area: areaOf(entry), acts }));
  const others = [...new Set([...w.p.authorities.values()].filter((authority) => authority.person === acting.person && authority.party !== acting.party).map((authority) => authority.party))];
  return ok({
    asOf: now(),
    party: { record: acting.party, legalName: partyName(w, acting.party) },
    actor: acting.actor,
    person: { reference: acting.person, name: acting.name },
    rows,
    others: others.map((record) => ({ record, legalName: partyName(w, record) })),
    limitation: limitationOf(w),
  });
}

/**
 * GET /premises/{id} for a premises actor (SCR-PTY-07 on the premises portal): the entry with its own classification,
 * address and area, the party in force, its state, what the reader may do there, its relationships and changes, and the
 * limitation. A premises the reader's authority does not cover is NOT_YOUR_PREMISES and discloses nothing (FR-PTY-007).
 */
export function portalPremises(principal: Principal, record: string): LoadOutcome<PortalPremises> {
  const w = world(principal.sessionId);
  const entry = w.s.entries.get(premisesRecordOf(record));
  if (entry === undefined) return refusedRead("PREMISES_NOT_FOUND");
  const acting = actingAs(principal.sessionId);
  const acts = actsAt(principal.sessionId, entry.record);
  if (acting === null || !acts.includes("READ")) return refusedRead("NOT_YOUR_PREMISES");
  const classification = current(entry.fields.classification)?.value ?? null;
  return ok({
    asOf: now(),
    record: entry.record,
    name: nameOf(entry),
    state: premisesState(w, entry.record),
    party: partyNow(w, entry.record),
    licensing: licensingOf(w, entry),
    classification: classification !== null ? asClass(classification) : null,
    area: areaOf(entry),
    address: current(entry.fields.address)?.value ?? null,
    acts,
    actor: acting.actor,
    timeline: timelineOf(w, entry, null),
    limitation: limitationOf(w),
  });
}

// ================================================================== what other families read (srs/07 §1, IPartyReader)

/*
 * The premises half of IPartyReader. A premises is named by its register record or by the id its family gives it
 * (`PREMISES_IDS`); one the register does not hold is NOT_FOUND. The register's answer is the only one: no family keeps
 * a flag of its own for whether a premises is operated. `parties.ts` offers the decision (`authorityToActAt`).
 */

/**
 * IPartyReader.PremisesRelationshipEffectiveAt(premisesId, at): EFFECTIVE with the party and its period, ENDED with the
 * last day and the cause, or NONE (with the day a later one starts, where one does) - ENDED and NONE being two answers
 * IAM branches on differently (FR-PTY-045). With `organisation` (RightOne ID's id of a party) the question is that
 * party's own relationship: a premises another party took over is ENDED for the one that operated it before. An instant
 * later than the call is INSTANT_IN_FUTURE (FR-PTY-046).
 */
export type RelationshipAnswer =
  | { kind: "EFFECTIVE"; party: string; organisation: string | null; legalName: string; from: string | null; to: string | null }
  | { kind: "ENDED"; party: string; organisation: string | null; legalName: string; endedOn: string; cause: ChangeCause | null }
  | { kind: "NONE"; startsOn: string | null }
  | { kind: "NOT_FOUND" }
  | { kind: "INSTANT_IN_FUTURE"; at: string; requestedAt: string };

export function premisesRelationshipAt(key: string, premisesId: string, options: { at?: string; organisation?: string } = {}): RelationshipAnswer {
  const w = world(key);
  const requestedAt = now();
  const at = options.at ?? requestedAt;
  if (time(at) > time(requestedAt)) return { kind: "INSTANT_IN_FUTURE", at, requestedAt };
  const entry = w.s.entries.get(premisesRecordOf(premisesId));
  if (entry === undefined) return { kind: "NOT_FOUND" };
  const answer = relationshipAtInstant(w, entry.record, at, options.organisation ?? null);
  const party = answer.party !== null ? w.p.parties.get(answer.party.record) : undefined;
  const who = { party: answer.party?.record ?? "", organisation: party?.organisation ?? null, legalName: answer.party?.legalName ?? "" };
  if (answer.answer === "AUTHORITY_EFFECTIVE") return { kind: "EFFECTIVE", ...who, from: answer.from, to: answer.to };
  if (answer.answer === "RELATIONSHIP_ENDED") return { kind: "ENDED", ...who, endedOn: answer.endedOn ?? "", cause: answer.cause };
  return { kind: "NONE", startsOn: answer.startsOn };
}

/** `premisesRelationshipAt` as a guard: whether the organisation operates the premises now, by the register. */
export function operatesNow(key: string, organisation: string, premisesId: string): boolean {
  return premisesRelationshipAt(key, premisesId, { organisation }).kind === "EFFECTIVE";
}

/** srs/07's PremisesField: one registry fact, its value at the instant and where it came from. */
export interface PremisesField {
  name: "IDENTIFYING_REFERENCE" | "TRADING_NAME" | "ADDRESS" | "ADMINISTRATIVE_AREA_KEY" | "GEOGRAPHY_VERSION";
  value: string;
  provenance: {
    sourceVersionRef: string;
    route: ProvenanceRoute;
    sourceKey: SourceName | null;
    retrievedAt: string | null;
    identificationRef: string | null;
    overrideAuthorityRef: string | null;
    effectiveFrom: string;
  };
}

export type PremisesProfileAnswer = { kind: "FOUND"; record: string; fields: readonly PremisesField[] } | { kind: "NOT_FOUND" } | { kind: "INSTANT_IN_FUTURE"; at: string; requestedAt: string };

/**
 * IPartyReader.PremisesProfileAt(premisesId, at): every registry fact as it stood at the instant - for each field the
 * last value applied by then, so a later refresh, override or re-pointing never rewrites an answer already given - each
 * with its provenance stamp: the route, the source and when it answered, the manual identification that admitted it,
 * or the authority an override rests on (FR-PTY-025). A field with no value at the instant is absent, never guessed.
 */
export function premisesProfileAt(key: string, premisesId: string, at: string = now()): PremisesProfileAnswer {
  const w = world(key);
  const requestedAt = now();
  if (time(at) > time(requestedAt)) return { kind: "INSTANT_IN_FUTURE", at, requestedAt };
  const entry = w.s.entries.get(premisesRecordOf(premisesId));
  if (entry === undefined || time(entry.admittedAt) > time(at)) return { kind: "NOT_FOUND" };
  const stamp = (field: OverridableField, index: number, row: Value): PremisesField["provenance"] => ({
    sourceVersionRef: `${entry.record}/${field}/${String(index + 1)}`,
    route: row.route,
    sourceKey: row.source,
    retrievedAt: row.route === "AUTHORITATIVE_SOURCE" || row.route === "ALTERNATIVE_ROUTE" ? row.at : null,
    identificationRef: row.route === "MANUAL_ADMISSION" ? (entry.identification?.evidenceRef ?? null) : null,
    overrideAuthorityRef: row.route === "MANUAL_OVERRIDE" ? row.authority : null,
    effectiveFrom: row.at,
  });
  const valueAt = (field: OverridableField): { row: Value; index: number } | null => {
    let found: { row: Value; index: number } | null = null;
    entry.fields[field].forEach((row, index) => {
      if (time(row.at) <= time(at)) found = { row, index };
    });
    return found;
  };
  const fields: PremisesField[] = [];
  const admitted = entry.fields.trading_name[0] ?? entry.fields.address[0] ?? null;
  if (entry.identifyingReference !== null && admitted !== null) fields.push({ name: "IDENTIFYING_REFERENCE", value: entry.identifyingReference, provenance: stamp("trading_name", 0, admitted) });
  const name = valueAt("trading_name");
  if (name !== null) fields.push({ name: "TRADING_NAME", value: name.row.value, provenance: stamp("trading_name", name.index, name.row) });
  const address = valueAt("address");
  if (address !== null) fields.push({ name: "ADDRESS", value: address.row.value, provenance: stamp("address", address.index, address.row) });
  const area = valueAt("administrative_area");
  if (area !== null) {
    fields.push({ name: "ADMINISTRATIVE_AREA_KEY", value: area.row.value, provenance: stamp("administrative_area", area.index, area.row) });
    fields.push({ name: "GEOGRAPHY_VERSION", value: area.row.version ?? GEOGRAPHY_VERSION, provenance: stamp("administrative_area", area.index, area.row) });
  }
  return { kind: "FOUND", record: entry.record, fields };
}

/** One entry of the register as a consumer lists it: its record, name, ward and state now. */
export interface RegisterEntry {
  record: string;
  name: string;
  ward: string | null;
  state: PremisesState;
}

/** Every entry of the register now, by name: the list the verification route offers an enquirer (FR-PTY-047). */
export function registerEntries(key: string): RegisterEntry[] {
  const w = world(key);
  return [...w.s.entries.values()]
    .map((entry) => ({ record: entry.record, name: nameOf(entry), ward: wardOf(entry), state: premisesState(w, entry.record) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** The register's name for a premises now (a trading name an override changed included), or null where it holds none. */
export function premisesNameOf(key: string, premisesId: string): string | null {
  const entry = world(key).s.entries.get(premisesRecordOf(premisesId));
  return entry !== undefined ? nameOf(entry) : null;
}
