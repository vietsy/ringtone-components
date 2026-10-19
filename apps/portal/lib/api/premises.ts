import type { LoadOutcome } from "@rightone/ui";
import {
  acknowledgeException,
  admitPremises,
  changeForm,
  decideDisposition,
  dispositionQueue,
  dispositionsOfChange,
  exceptionQueue,
  geographyRepointings,
  overridePremisesField,
  portalPremises,
  portfolio,
  premisesDetail,
  premisesHistory,
  premisesOfPrincipal,
  premisesTimeline,
  premisesProvenance,
  premisesRegister,
  proposeDisposition,
  reconciliationRuns,
  recordPremisesChange,
  recordPremisesParty,
  repointGeography,
  resolveException,
  startReconciliationRun,
} from "@/lib/mock/backend/premises";
import { decisionForCollection } from "@/lib/mock/backend/registration";
import { PREMISES_TRACES, mockPremisesFailure, type PremisesView } from "@/lib/mock/premises";
import type { PartyAnswer } from "./parties";
import type { ChangeCause, PremisesClass, PremisesState, RegisterField, RegisterLicensing } from "./premises-terms";
import { holds, type Principal, type Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The premises register of the party family (PTY) as the consoles read it: the register with its coverage and the
 * limitation every read carries, one premises with where each field came from, the changes recorded against it and
 * its history with the party then (SCR-PTY-06 to 10); the reconciliation runs and the exceptions this family raises
 * (SCR-PTY-14, 15); and what a premises change left behind, which a business approver decides (SCR-PTY-16). Every
 * command is the API's (`srs/02-api-contracts.md`, sections 2, 5 and 6), checked server side against the reader's
 * roles and the separations of duties, and refused with the codes of `design/04-refusal-codes.md`; a refused command
 * records nothing. A premises is the same record the party register, REG, CER, VEN and VER name: its `PRM-` record.
 */

// ---------------------------------------------------------------- vocabularies

export { CHANGE_CAUSES, OVERRIDABLE_FIELDS, PREMISES_CLASSES, PREMISES_STATES, REGISTER_FIELDS, REGISTER_LICENSING } from "./premises-terms";
export type { ChangeCause, OverridableField, PremisesClass, PremisesState, RegisterField, RegisterLicensing } from "./premises-terms";

/**
 * How a value reached the register (FR-PTY-025), a word on every screen and in every contract: from the source, the
 * alternative route, admitted by hand, overridden by hand; a party relationship an officer recorded; a licensing
 * status derived from the status record.
 */
export type ProvenanceRoute = "AUTHORITATIVE_SOURCE" | "ALTERNATIVE_ROUTE" | "MANUAL_ADMISSION" | "MANUAL_OVERRIDE" | "RECORDED" | "DERIVED";
/** The sources a value can come from: the national business-registration source, or Lam Hồng's licence list (the alternative route). */
export type SourceName = "NATIONAL_REGISTER" | "LAMHONG_LIST";

/** The population route every register read states (FR-PTY-043). */
export type PopulationRoute = "AUTHORITATIVE_SOURCE" | "ALTERNATIVE_ROUTE" | "MANUAL_ADMISSION";


/** SM-194. DUE and OVERDUE are a run nobody has started yet. */
export type RunState = "DUE" | "RUNNING" | "COMPLETED" | "INCOMPLETE" | "OVERDUE" | "REFUSED";

/** SM-195. */
export type DispositionState = "RAISED" | "AWAITING_APPROVAL" | "TRANSFERRED" | "CLOSED" | "LEFT_IN_PLACE";

export type ExceptionKind = "RECONCILIATION_OVERDUE" | "REVOCATION_NOT_PROPAGATED" | "DERIVATION_MISSING" | "NO_SUCCESSOR_AREA";
export type ExceptionState = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

/** A sentence the data names by its code (the canvas's), or the words a person typed. */
export type Written = { code: string; values?: Readonly<Record<string, string>> } | { text: string };

// ---------------------------------------------------------------- what every register read carries

/** FR-PTY-043: the population route, the last completed reconciliation and the scope it limits. */
export interface Limitation {
  route: PopulationRoute;
  /** Null where no run has ever completed: NEVER_RECONCILED, with the whole register limited. */
  lastCompleted: string | null;
  /** Whole days from the last completion to now, which the screens set beside it. */
  daysSince: number | null;
  intervalDays: number;
  scope: "NONE" | "WHOLE_REGISTER";
}

/** DR-207 at the moment of the read, with the instant it was derived and the record it rests on. */
export interface LicensingView {
  status: RegisterLicensing;
  derivedAt: string;
  /** The status record relied on; null where none was ever issued. */
  record: string | null;
  /** STALE: the day the register last checked, and the day the record changed after it. */
  stale: { checkedOn: string; changedOn: string } | null;
  /** UNREGISTERED: derived when the premises was admitted. */
  atAdmission: boolean;
}

export interface AreaValue {
  ward: string;
  city: string;
  version: string;
}

export interface PartyNow {
  record: string;
  legalName: string;
  since: string | null;
}

// ---------------------------------------------------------------- SCR-PTY-06

export interface RegisterRow {
  record: string;
  name: string;
  classification: PremisesClass | null;
  state: PremisesState;
  party: PartyNow | null;
  licensing: LicensingView;
}

export interface Coverage {
  inScope: number;
  counts: Readonly<Record<RegisterLicensing, number>>;
}

export interface AdmitOptions {
  classes: readonly PremisesClass[];
  schemeVersion: string;
  areas: readonly { ward: string; city: string }[];
  geographyVersion: string;
  evidenceKinds: readonly string[];
}

export interface PremisesRegister {
  asOf: string;
  /** The area in view; null for every area of the register. */
  area: { ward: string; city: string } | null;
  /** The areas the register's entries lie in, for the area filter. */
  areas: readonly { ward: string; city: string }[];
  filter: { q: string | null; licensing: RegisterLicensing | null };
  /** CFG-242: whether an in-scope population is defined; without one the register admits nothing. */
  populationDefined: boolean;
  limitation: Limitation;
  /** Over every entry of the area in view, whatever the search: the denominator is never filtered. */
  coverage: Coverage;
  rows: readonly RegisterRow[];
  mayAdmit: boolean;
  admit: AdmitOptions;
}

// ---------------------------------------------------------------- SCR-PTY-07

export interface FieldFact<T> {
  value: T | null;
  route: ProvenanceRoute | null;
  source: SourceName | null;
  authority: string | null;
}

export interface ChangeView {
  id: string;
  cause: ChangeCause;
  effectiveOn: string;
  outgoing: { record: string; legalName: string };
  incoming: { record: string; legalName: string } | null;
  recordedAt: string;
  recordedBy: string;
  basis: Written | null;
  applied: boolean;
  /** The published facts a backdated change named. */
  contradicted: readonly PublishedFact[];
  dispositions: number;
}

export interface DifferenceView {
  id: string;
  run: { id: string; startedAt: string };
  field: RegisterField;
  /** DR-205's class: a descriptive field, or a licensing status or party relationship. */
  fieldClass: "DESCRIPTIVE" | "STATUS_OR_RELATIONSHIP";
  registerValue: ProvenanceValue;
  sourceValue: ProvenanceValue;
  reason: "DISPOSITION_AWAITED" | "OVERRIDE_CONFLICT";
}

export interface PremisesDetail {
  asOf: string;
  record: string;
  name: string;
  state: PremisesState;
  party: (PartyNow & { route: ProvenanceRoute | null }) | null;
  licensing: LicensingView;
  classification: FieldFact<PremisesClass>;
  area: FieldFact<AreaValue>;
  tradingName: FieldFact<string>;
  address: FieldFact<string>;
  /** Never operated: IN_REGISTER with no relationship, which is a state and not a gap. */
  neverOperated: boolean;
  pending: ChangeView | null;
  differences: readonly DifferenceView[];
  /** The parties Record party may name: every record of the register not superseded. */
  parties: readonly { record: string; legalName: string; businessRegistration: string | null }[];
  /** ACT-OPS: Record party and Record change. */
  mayAct: boolean;
  /** ACT-DAT, ACT-OPS (read only), ACT-AUD: where each field came from. */
  mayReadProvenance: boolean;
  limitation: Limitation;
}

/** GET /premises/{id}/relationships: each relationship with its party, its period and what ended it. */
export interface RelationshipRow {
  party: { record: string; legalName: string };
  from: string | null;
  /** The last day the party operated it; null while it still does. */
  to: string | null;
  endCause: ChangeCause | null;
  /** An officer recorded it, or a change's sweep started it; null where the source gave it. */
  recorded: { by: string; at: string } | null;
  inForce: boolean;
}

/** GET /premises/{id}/relationship-at: DR-201's answer about the premises at the instant asked (FR-PTY-045). */
export interface RelationshipAtView {
  at: string;
  requestedAt: string;
  answer: "AUTHORITY_EFFECTIVE" | "RELATIONSHIP_ENDED" | "NO_RELATIONSHIP";
  party: { record: string; legalName: string } | null;
  from: string | null;
  to: string | null;
  /** RELATIONSHIP_ENDED: the last day, and the cause. NO_RELATIONSHIP: the day a later one starts, where one does. */
  endedOn: string | null;
  cause: ChangeCause | null;
  startsOn: string | null;
}

/** The relationships and the changes of one premises, which the console and the premises portal read (FR-PTY-002, 012). */
export interface PremisesTimeline {
  asOf: string;
  record: string;
  name: string;
  relationships: readonly RelationshipRow[];
  /** GET /premises/{id}/changes: every change recorded, newest first, pending or applied. */
  changes: readonly ChangeView[];
  /** The relationship question asked on the console, where one was. */
  asked: RelationshipAtView | null;
}

// ---------------------------------------------------------------- SCR-PTY-19 and the premises portal

/** One premises of the portfolio: what it is, how it stands, and what the reader may do there. */
export interface PortfolioRow {
  record: string;
  name: string;
  state: PremisesState;
  licensing: LicensingView;
  area: AreaValue | null;
  /** The scope the reader's authority gives them there; the principal acts for the whole party. */
  acts: readonly ("READ" | "SUBMIT" | "APPROVE")[];
}

/** GET /portfolio: the party the view is for, the premises the reader's authority covers, and the limitation. */
export interface Portfolio {
  asOf: string;
  party: { record: string; legalName: string };
  actor: "PRINCIPAL" | "DELEGATE";
  person: { reference: string; name: string };
  rows: readonly PortfolioRow[];
  /** The other parties the person holds an authority for: a view of their own, never merged into this one. */
  others: readonly { record: string; legalName: string }[];
  limitation: Limitation;
}

/** GET /premises/{id} for a premises actor: the entry, the party in force, its state and the limitation. */
export interface PortalPremises {
  asOf: string;
  record: string;
  name: string;
  state: PremisesState;
  party: PartyNow | null;
  licensing: LicensingView;
  classification: PremisesClass | null;
  area: AreaValue | null;
  address: string | null;
  acts: readonly ("READ" | "SUBMIT" | "APPROVE")[];
  actor: "PRINCIPAL" | "DELEGATE";
  timeline: PremisesTimeline;
  limitation: Limitation;
}

// ---------------------------------------------------------------- SCR-PTY-08

export type ProvenanceValue =
  | { kind: "text"; text: string }
  | { kind: "class"; code: string }
  | { kind: "area"; ward: string; city: string; version: string }
  | { kind: "party"; legalName: string; record: string }
  | { kind: "licensing"; status: RegisterLicensing };

export interface ProvenanceRow {
  field: RegisterField;
  value: ProvenanceValue | null;
  route: ProvenanceRoute;
  source: SourceName | null;
  /** DERIVED: the status record it was derived from. */
  statusRecord: string | null;
  at: string;
  by: string | null;
  authority: string | null;
  /** MANUAL_ADMISSION: the identification the value rests on. */
  identification: { evidenceKind: string; evidenceRef: string; reason: string } | null;
  /** An override: the value before it and the route it came by, which stays readable. */
  before: { value: ProvenanceValue; route: ProvenanceRoute } | null;
  overridable: boolean;
}

export interface PremisesProvenance {
  asOf: string;
  record: string;
  name: string;
  rows: readonly ProvenanceRow[];
  /** ACT-DAT: the data owner reads on the register data console and may override. */
  mayOverride: boolean;
  options: { classes: readonly PremisesClass[]; areas: readonly { ward: string; city: string }[] };
}

// ---------------------------------------------------------------- SCR-PTY-09

export interface PublishedFact {
  key: string;
  kind: "PUBLIC_PREMISES_LIST" | "COVERAGE_REPORT";
  /** COVERAGE_REPORT: the area and the month it reports. */
  area: string | null;
  month: string | null;
  publishedAt: string;
  /** The list states the day it was published, the report the time. */
  timed: boolean;
}

export interface ChangeForm {
  asOf: string;
  today: string;
  record: string;
  name: string;
  state: PremisesState;
  party: PartyNow | null;
  /** What prompted the change, where the register knows it: a run's difference or a letter. */
  prompt: Written | null;
  /** The parties a change of operator may name as incoming, with their records and masked numbers. */
  parties: readonly { record: string; legalName: string; businessRegistration: string | null }[];
  /** The check for the values in the address: the published facts a backdated change contradicts. */
  check: { effectiveOn: string; facts: readonly PublishedFact[] } | null;
  /** A change already pending blocks another until it applies. */
  pending: ChangeView | null;
}

export interface RecordedChange {
  change: ChangeView;
  dispositions: readonly DispositionRow[];
}

// ---------------------------------------------------------------- SCR-PTY-10

export interface HistoryRow {
  key: string;
  at: string;
  what: Written;
  /** The party operating the premises when it was recorded; null where none did (FR-PTY-022). */
  partyThen: { record: string; legalName: string } | null;
}

export interface PremisesHistory {
  asOf: string;
  record: string;
  name: string;
  rows: readonly HistoryRow[];
  /** A change of operator was recorded and nothing it left was moved to the incoming party. */
  noRefile: boolean;
  /** Admitted today with nothing else recorded. */
  onlyAdmission: boolean;
}

// ---------------------------------------------------------------- SCR-PTY-14

export interface RunRow {
  id: string;
  state: RunState;
  /** Null for the row of a run not started yet. */
  startedAt: string | null;
  dueAt: string;
  startedBy: string | null;
  firstLoad: boolean;
  route: "AUTHORITATIVE_SOURCE" | "ALTERNATIVE_ROUTE" | null;
  completedAt: string | null;
  stoppedAt: string | null;
  compared: number | null;
  differences: number | null;
  awaiting: number | null;
}

export interface ReconciliationView {
  asOf: string;
  state: RunState;
  limitation: Limitation;
  nextDue: string | null;
  /** CFG-244: whether the approved connection answers; no alternative route is configured. */
  connection: "AVAILABLE" | "UNAVAILABLE";
  runs: readonly RunRow[];
  /** The latest run that found differences, and its differences awaiting a decision by class. */
  differences: { run: { id: string; startedAt: string; completedAt: string | null }; licensing: number; relationship: number; overridden: number; relationshipNames: readonly string[] } | null;
  overdueException: string | null;
  running: RunRow | null;
  mayStart: boolean;
  geography: GeographyView;
}

/**
 * FR-PTY-040 on the register data console: the geography version the register's areas belong to, and each published
 * successor table leading to it with what re-pointing under it would do now - the premises it would move, and the
 * areas withdrawn with no successor, which keep their premises where they are.
 */
export interface GeographyView {
  current: string;
  pending: readonly {
    from: string;
    to: string;
    premises: number;
    withdrawn: readonly { area: string; premises: number; exception: string | null }[];
  }[];
  mayRepoint: boolean;
}

/** One re-pointing of a premises (GET /premises/{id}/geography-repointings): from where, to where, from when. */
export interface RepointingRow {
  id: string;
  fromArea: string;
  fromVersion: string;
  toArea: string;
  toVersion: string;
  effectiveAt: string;
  by: string;
}

export interface RepointingList {
  record: string;
  rows: readonly RepointingRow[];
}

/** POST /geography-repointings: the version re-pointed from and the one re-pointed to, from the instant it is run. */
export interface RepointInput {
  fromVersion: string;
  toVersion: string;
}

/** What a re-pointing did: the premises moved, and each area it left in place for want of a successor. */
export interface RepointAnswer {
  repointed: number;
  withdrawn: readonly { area: string; premises: number; exception: string }[];
}

// ---------------------------------------------------------------- SCR-PTY-15

export interface ExceptionRow {
  id: string;
  kind: ExceptionKind;
  subject:
    | { kind: "REGISTER" }
    | { kind: "AUTHORITY"; reference: string; person: string; party: string }
    | { kind: "PREMISES"; record: string; name: string }
    | { kind: "AREA"; area: string; version: string };
  raisedAt: string;
  state: ExceptionState;
  acknowledged: { by: string; at: string } | null;
  resolved: { by: string; at: string; resolution: string | null } | null;
  /** The figure the condition turns on: the last completed run, or the revocation and the points it reached. */
  condition:
    | { kind: "OVERDUE"; lastCompleted: string | null; daysSince: number | null; holds: boolean; completedSince: string | null }
    | { kind: "REVOCATION"; revokedAt: string; stopped: readonly { point: string; at: string }[]; holds: boolean }
    | { kind: "DERIVATION"; holds: boolean }
    | { kind: "AREA"; premises: number; holds: boolean };
}

export interface ExceptionQueue {
  asOf: string;
  rows: readonly ExceptionRow[];
  intervalDays: number;
  /** ACT-DAT and ACT-SEC act; ACT-AUD reads. */
  mayAct: boolean;
  me: string;
}

// ---------------------------------------------------------------- SCR-PTY-16

export interface Entitlement {
  kind: "STATUS_RECORD" | "OBLIGATION_DECISION" | "FEE";
  reference: string | null;
  period: { from: string; to: string } | null;
  amountMinor: number | null;
}

export interface DispositionRow {
  id: string;
  entitlement: Entitlement;
  issuedTo: { record: string; legalName: string };
  state: DispositionState;
  proposal: { outcome: "TRANSFER" | "CLOSE"; receiving: { record: string; legalName: string } | null; ground: Written; by: string; role: string; at: string } | null;
  decision: { outcome: "TRANSFER" | "CLOSE" | "LEAVE_IN_PLACE"; by: string; role: string; at: string; ground: Written } | null;
  /** TRANSFERRED: who holds it now. */
  heldBy: { record: string; legalName: string } | null;
}

export interface ChangeDispositions {
  asOf: string;
  change: ChangeView & { premises: { record: string; name: string } };
  rows: readonly DispositionRow[];
  /** ACT-BIZ-APR decides; ACT-OPS proposes and reads; ACT-AUD reads. */
  mayDecide: boolean;
  mayPropose: boolean;
  me: string;
}

export interface DispositionQueueRow {
  change: string;
  premises: { record: string; name: string };
  cause: ChangeCause;
  effectiveOn: string;
  outgoing: string;
  incoming: string | null;
  recordedAt: string;
  recordedBy: string;
  total: number;
  awaiting: number;
  raised: number;
}

export interface DispositionQueue {
  asOf: string;
  rows: readonly DispositionQueueRow[];
}

// ---------------------------------------------------------------- inputs and attempts

export interface AdmitInput {
  identifyingReference: string;
  tradingName: string;
  address: string;
  classification: string;
  area: string;
  geographyVersion: string;
  evidenceKind: string;
  evidenceRef: string;
  reason: string;
}

export interface RelationshipInput {
  party: string;
  effectiveFrom: string | null;
  effectiveFromText: string;
}

export interface OverrideInput {
  field: string;
  value: string;
  authority: string;
}

export interface ChangeInput {
  cause: string;
  effectiveOn: string | null;
  effectiveOnText: string;
  incoming: string;
  /** The effective date the published facts on the form were checked for; null when no check ran. */
  checkedFor: string | null;
}

export interface ProposalInput {
  outcome: string;
  ground: string;
}

export interface DecisionInput {
  decision: string;
  ground: string;
}

/** What a refused or completed form hands to the page it goes back to. */
export interface PremisesAttempt {
  form: "admit" | "relationship" | "override" | "change" | "run" | "acknowledge" | "resolve" | "propose" | "decide" | "repoint";
  /** The record the act was on: a premises, an exception or a disposition. */
  subject: string;
  values: Readonly<Record<string, string | readonly string[]>>;
  refusal: { code: string; field: string | null; values: Readonly<Record<string, string>> } | null;
  done: string | null;
}

// ---------------------------------------------------------------- the reads

const read = <T,>(view: PremisesView | null, screen: keyof typeof PREMISES_TRACES, run: () => LoadOutcome<T>): Promise<LoadOutcome<T>> => {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockPremisesFailure(view, PREMISES_TRACES[screen]) : run());
};

/** SCR-PTY-06: GET /premises for an area, by name or record and licensing status, with the limitation. */
export function loadPremisesRegister(staff: Staff, asked: { area: string | null; q: string | null; licensing: string | null }, view: PremisesView | null): Promise<LoadOutcome<PremisesRegister>> {
  return read(view, "06", () => premisesRegister(staff, asked));
}

/** SCR-PTY-07: GET /premises/{id} with its relationship, its licensing status, a pending change and open differences. */
export function loadPremisesDetail(staff: Staff, record: string, view: PremisesView | null): Promise<LoadOutcome<PremisesDetail>> {
  return read(view, "07", () => premisesDetail(staff, record));
}

/** SCR-PTY-08: GET /premises/{id}/provenance. */
export function loadPremisesProvenance(staff: Staff, record: string, view: PremisesView | null): Promise<LoadOutcome<PremisesProvenance>> {
  return read(view, "08", () => premisesProvenance(staff, record));
}

/** SCR-PTY-09: the premises, and the published facts a backdated change on that date would contradict. */
export function loadChangeForm(staff: Staff, record: string, effectiveOn: string | null, view: PremisesView | null): Promise<LoadOutcome<ChangeForm>> {
  return read(view, "09", () => changeForm(staff, record, effectiveOn));
}

/** SCR-PTY-10: GET /premises/{id}/history, each row with the party then. */
export function loadPremisesHistory(staff: Staff, record: string, view: PremisesView | null): Promise<LoadOutcome<PremisesHistory>> {
  return read(view, "10", () => premisesHistory(staff, record));
}

/** SCR-PTY-14: GET /reconciliation-runs, with the interval measured from the last completion. */
export function loadReconciliation(staff: Staff, view: PremisesView | null): Promise<LoadOutcome<ReconciliationView>> {
  return read(view, "14", () => reconciliationRuns(staff));
}

/** SCR-PTY-08's re-pointings: GET /premises/{id}/geography-repointings, for the data owner and assurance. */
export function loadGeographyRepointings(staff: Staff, record: string): Promise<LoadOutcome<RepointingList>> {
  return read(null, "08", () => geographyRepointings(staff, record));
}

/** SCR-PTY-15: GET /exceptions. */
export function loadExceptions(staff: Staff, view: PremisesView | null): Promise<LoadOutcome<ExceptionQueue>> {
  return read(view, "15", () => exceptionQueue(staff));
}

/** SCR-PTY-16's queue: the premises changes that left records behind. */
export function loadDispositionQueue(staff: Staff, view: PremisesView | null): Promise<LoadOutcome<DispositionQueue>> {
  return read(view, "16", () => dispositionQueue(staff));
}

/** SCR-PTY-16: GET /entitlement-dispositions for one premises change. */
export function loadChangeDispositions(staff: Staff, change: string, view: PremisesView | null): Promise<LoadOutcome<ChangeDispositions>> {
  return read(view, "16", () => dispositionsOfChange(staff, change));
}

/** The premises change and disposition a status record waits on, for CER-03's link; null where none does. */
export function dispositionOfRecord(staff: Staff, reference: string): Promise<{ change: string; disposition: string } | null> {
  if (!usesMockData()) return Promise.resolve(null);
  const queue = dispositionQueue(staff).data?.rows ?? [];
  for (const row of queue) {
    const found = dispositionsOfChange(staff, row.change).data?.rows.find((entry) => entry.entitlement.reference === reference);
    if (found !== undefined) return Promise.resolve({ change: row.change, disposition: found.id });
  }
  return Promise.resolve(null);
}

/**
 * The application an obligation decision decides, for a link to the registration console's case file (SCR-REG-10);
 * null where the decision was issued without one or the reader does not open that console.
 */
export function applicationOfDecision(staff: Staff, decision: string): Promise<string | null> {
  if (!usesMockData() || !holds(staff, "ACT-OPS", "ACT-DAT")) return Promise.resolve(null);
  return Promise.resolve(decisionForCollection(staff.sessionId, decision)?.record.application ?? null);
}

// ---------------------------------------------------------------- the commands

const command = <T,>(run: () => PartyAnswer<T>): Promise<LoadOutcome<PartyAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/** POST /premises: a premises admitted by hand, IN_REGISTER and UNREGISTERED. */
export function sendAdmission(staff: Staff, input: AdmitInput): Promise<LoadOutcome<PartyAnswer<{ record: string }>>> {
  return command(() => admitPremises(staff, input));
}

/** POST /premises/{id}/relationships: the party operating the premises from an instant. */
export function sendRelationship(staff: Staff, record: string, input: RelationshipInput): Promise<LoadOutcome<PartyAnswer<{ party: string }>>> {
  return command(() => recordPremisesParty(staff, record, input));
}

/** POST /premises/{id}/overrides. */
export function sendOverride(staff: Staff, record: string, input: OverrideInput): Promise<LoadOutcome<PartyAnswer<{ field: string; at: string }>>> {
  return command(() => overridePremisesField(staff, record, input));
}

/** POST /premises/{id}/changes. */
export function sendPremisesChange(staff: Staff, record: string, input: ChangeInput): Promise<LoadOutcome<PartyAnswer<RecordedChange>>> {
  return command(() => recordPremisesChange(staff, record, input));
}

/** POST /reconciliation-runs. */
export function sendRunStart(staff: Staff): Promise<LoadOutcome<PartyAnswer<{ run: string }>>> {
  return command(() => startReconciliationRun(staff));
}

/** POST /geography-repointings, by the data owner at the instant the successor is to apply from. */
export function sendRepointing(staff: Staff, input: RepointInput): Promise<LoadOutcome<PartyAnswer<RepointAnswer>>> {
  return command(() => repointGeography(staff, input));
}

/** POST /exceptions/{id}/acknowledgement. */
export function sendAcknowledgement(staff: Staff, exception: string): Promise<LoadOutcome<PartyAnswer<{ at: string }>>> {
  return command(() => acknowledgeException(staff, exception));
}

/** POST /exceptions/{id}/resolution. */
export function sendResolution(staff: Staff, exception: string, resolution: string): Promise<LoadOutcome<PartyAnswer<{ at: string }>>> {
  return command(() => resolveException(staff, exception, resolution));
}

/** POST /entitlement-dispositions/{id}/proposals. */
export function sendProposal(staff: Staff, disposition: string, input: ProposalInput): Promise<LoadOutcome<PartyAnswer<{ state: DispositionState }>>> {
  return command(() => proposeDisposition(staff, disposition, input));
}

/** POST /entitlement-dispositions/{id}/decisions. */
export function sendDispositionDecision(staff: Staff, disposition: string, input: DecisionInput): Promise<LoadOutcome<PartyAnswer<{ state: DispositionState }>>> {
  return command(() => decideDisposition(staff, disposition, input));
}

/**
 * GET /premises/{id} for a principal (FR-PTY-007): a premises their party operates is theirs, any other is
 * NOT_YOUR_PREMISES, and one the register does not hold is PREMISES_NOT_FOUND.
 */
export function principalCovers(principal: Principal, record: string): Promise<"OWN" | "NOT_YOUR_PREMISES" | "PREMISES_NOT_FOUND"> {
  return Promise.resolve(usesMockData() ? premisesOfPrincipal(principal, record) : "PREMISES_NOT_FOUND");
}

/** SCR-PTY-07's relationships and changes on the console, and the relationship at a day and time where one is asked. */
export function loadPremisesTimeline(staff: Staff, record: string, at: string | null): Promise<LoadOutcome<PremisesTimeline>> {
  return read(null, "07", () => premisesTimeline(staff, record, at));
}

/** SCR-PTY-19: GET /portfolio for the premises actor signed in. */
export function loadPortfolio(principal: Principal, party: string | null): Promise<LoadOutcome<Portfolio>> {
  return read(null, "07", () => portfolio(principal, party));
}

/** SCR-PTY-07 on the premises portal: GET /premises/{id} for a premises actor. */
export function loadPortalPremises(principal: Principal, record: string): Promise<LoadOutcome<PortalPremises>> {
  return read(null, "07", () => portalPremises(principal, record));
}
