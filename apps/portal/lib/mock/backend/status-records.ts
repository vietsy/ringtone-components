import { generateKeyPairSync, sign, type JsonWebKey, type KeyObject } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  AssessmentView,
  AutomaticCause,
  ChangeAuthority,
  ConditionCode,
  ConsoleRecord,
  ConsoleRecordList,
  ConsoleRecordRow,
  FollowUpFilter,
  FollowUpList,
  FollowUpOutcome,
  FollowUpPage,
  FollowUpRow,
  FollowUpState,
  GroundCode,
  HolderPremises,
  HolderState,
  IssueApproval,
  IssueCondition,
  LastChange,
  OpenReview,
  PendingRecordSummary,
  Period,
  PremisesStatusRecords,
  PrintoutSummary,
  Proposal,
  ProposalInput,
  ProposalPage,
  RecordDefinition,
  RecordFilter,
  RecordHistory,
  RecordStatus,
  Remedy,
  ReviewFilter,
  ReviewList,
  ReviewPage,
  ReviewRow,
  ReviewState,
  ReviewTrigger,
  RouteReason,
  SigningKeys,
  StatusAct,
  StatusRecordPage,
  StatusRecordPrintout,
  WaitingOn,
  Written,
} from "@/lib/api/status-records";
import { NOTICE_POLICY_SEED } from "@/lib/mock/notices";
import {
  CER_DECISIONS,
  CER_DEFINITIONS,
  CER_FOLLOW_UPS,
  CER_KEYS,
  CER_PAYMENTS,
  CER_POLICY_VERSIONS,
  CER_PREMISES,
  CER_RECORDS,
  CER_REVIEWS,
  HOLDER_CONTACTS,
  ISSUING_AUTHORITY,
  PROCESSING_PURPOSES,
  REGISTRATION_PREMISES,
  VERIFY_BASE,
  type SeedChange,
  type SeedDecision,
  type SeedDefinition,
  type SeedPeriod,
  type SeedPolicyVersion,
  type SeedPremises,
  type SeedProposal,
} from "@/lib/mock/status-records";
import { addDays, now } from "./clock";
import { paymentConditionFor, settlementOf } from "./finance";
import { recordReference, reference } from "./ids";
import { noticeStateOf, recordNoticeEvent } from "./notices";
import { mayActFor, premisesActableBy } from "./parties";
import { decisionForCollection, decisionReferences, restsOnDeclaredClassification } from "./registration";
import { table, type StaffRole } from "./store";

/*
 * CER's behaviour, as the API will hold it (`srs/02-api-contracts.md`), played for one world: every status record
 * of every premises, the reviews of their status, the follow-ups of re-decided obligations and the signing keys.
 * A command checks what its contract checks, in the contract's order, and refuses with the codes of
 * `design/04-refusal-codes.md`; a refused command records nothing.
 *
 * The record's status is never stored as a value that can go stale: it is derived from its decided status changes
 * and its periods at the instant asked (`DR-438`), so a change approved to take effect later takes effect then, a
 * record enters the expiring state at the instant COM says its expiry notice falls due, and it expires when its last
 * period ends. The changes no one decides are recorded afterwards, for the history and the notice, as the status job
 * does (`ALG-411`). Other families' state is read through their exported functions only: REG's decisions, FIN's
 * payment condition, COM's notices, and PTY's answer of who may act for a premises. A decision REG records is placed on a record the next time this family is read
 * (`DR-432`), and a fee FIN reconciles is assessed then, as the API does on their events; nothing runs on a timer.
 *
 * What the mock holds for the families it has no module of - GOV's status record definition and `CER-ENFORCEMENT`
 * versions, TRN's answer of the system that issues, DAT's purpose register - is the boards' (`lib/mock/
 * status-records.ts`). A printout is signed when it is made, by the key service at the end of this module, with the
 * key that signs at that instant; a notice is raised through COM; an appeal is a case the holder opens on the portal.
 */

// ================================================================== who acts

/** A member of staff acting: their name and position as an attribution shows them, and the spec roles they hold. */
export interface Actor {
  name: string;
  position: string;
  roles: readonly StaffRole[];
}

const holds = (actor: Actor, role: StaffRole) => actor.roles.includes(role);

// ================================================================== the table

interface PeriodRow extends SeedPeriod {
  /** When the period was written: no answer about an earlier instant reads it (`DR-438`). */
  recordedAt: string;
  /** The period a renewal adds a year to, by position (`FR-CER-024`). */
  follows: number | null;
  /** The decision a renewal renews, as REG's renewal decision names it (`prior_decision_id`, `FR-CER-010`). */
  renews: string | null;
}

/** Why a status change was recorded: what a decision or an issue made (the record's standing), or what no one decided. */
type ChangeCause = "ISSUE" | "ENFORCEMENT" | "REINSTATEMENT" | "REPLACEMENT" | AutomaticCause;

const AUTOMATIC: readonly ChangeCause[] = ["EXPIRY_NOTICE_DUE", "LAPSE", "RENEWAL", "PERIOD_IN_FORCE"];

interface ChangeRow extends Omit<SeedChange, "authority"> {
  cause: ChangeCause;
  authority:
    | { kind: "ROUTE"; straight: boolean; decision: string | null }
    | { kind: "APPROVAL"; approver: string }
    | { kind: "REVIEW"; review: string; proposer: { name: string; position: string; at: string }; approver: { name: string; position: string; at: string }; comment: Written | null }
    | { kind: "SUCCESSOR"; successor: string }
    | { kind: "NOTICE"; notice: string | null; dueAt: string | null; fallback: boolean }
    | { kind: "PERIOD"; decision: string | null };
  /** The `CER-ENFORCEMENT` version an enforcement relied on (`FR-CER-025`). */
  policyVersion: string | null;
  remedy: Remedy;
  /** COM's reference for the holder's notice of the change. */
  noticeRef: string | null;
}

interface AssessmentRow {
  at: string;
  trigger: AssessmentView["trigger"];
  /** What is assessed: the record's issue, or a renewal of its period. */
  kind: "ISSUE" | "RENEWAL";
  decision: string | null;
  unmet: IssueCondition[];
  route: RouteReason | null;
}

interface IssueDecisionRow {
  at: string;
  by: string;
  outcome: "APPROVE" | "DECLINE";
  evidence: string[];
  reason: Written | null;
  /** The assessment it answers, by position. */
  assessment: number;
}

/** A renewal `DR-432` row 2 placed on the holder's record: it adds its period once `DR-430` holds and the route allows. */
interface RenewalRow {
  decision: string;
  /** The decision REG's renewal names as the one it renews, null where it names none. */
  prior: string | null;
  period: Period;
  openedAt: string;
  addedAt: string | null;
  /** A later decision took its place before it was added (`DR-432` row 1, for a renewal). */
  replacedBy: string | null;
}

/** The expiry notice requested for one lapse (`DR-434`, `ALG-409`). */
interface ExpiryRequest {
  /** 00:00 the day after the period that ends there. */
  lapseAt: string;
  /** When that period was recorded. */
  periodRecordedAt: string;
  /** When COM's answer was recorded. */
  raisedAt: string;
  /** COM's notice; null where COM required none, or where it answered before this world began. */
  notice: string | null;
  dueAt: string | null;
  state: "RAISED" | "NOT_REQUIRED";
}

interface PrintoutRow extends PrintoutSummary {
  /** The payload `ALG-407` signed, as base64url of its canonical JSON; its ES256 signature (R and S, base64url); the code printed. */
  payload: string;
  signature: string;
  code: string;
}

interface RecordRow {
  id: string;
  reference: string | null;
  reserved: string | null;
  premises: SeedPremises;
  holder: string;
  opened: { decision: string | null; at: string };
  /** The decision a pending record now rests on: a later decision of its premises and holder takes its place (`DR-432` row 1). */
  decision: string | null;
  issued: { at: string; route: "STRAIGHT_THROUGH" | "APPROVED" | null } | null;
  /** The definition in force on the day it issued, copied whole (`FR-CER-019`); a later one never rewrites it. */
  definition: SeedDefinition | null;
  pendingPeriod: Period | null;
  periods: PeriodRow[];
  /** In the order they take effect. */
  changes: ChangeRow[];
  assessments: AssessmentRow[];
  issueDecisions: IssueDecisionRow[];
  renewals: RenewalRow[];
  expiries: ExpiryRequest[];
  /** The instant up to which the changes no one decides are recorded (`ALG-411`). */
  historyTo: string;
  predecessor: string | null;
  successor: string | null;
  /** The latest first. */
  printouts: PrintoutRow[];
  sheet: { address: Readonly<Record<"vi" | "en", string>> | null; operator: string | null };
}

interface ProposalStep extends Omit<SeedProposal, "by"> {
  kind: "PROPOSAL";
  by: { name: string; position: string; at: string } | null;
  conditions: { condition: ConditionCode; howMet: string }[];
  /** The `CER-ENFORCEMENT` version in force when it was proposed. */
  policyVersion: string | null;
}

interface DecisionStep {
  kind: "DECISION";
  at: string;
  by: { name: string; position: string; at: string };
  outcome: "APPROVE" | "DECLINE";
  reason: Written | null;
}

/** An event that joined a review already open (`DR-437` row 2). */
interface TriggerStep {
  kind: "TRIGGER";
  at: string;
  trigger: ReviewTrigger;
}

interface ReviewRecord {
  reference: string;
  record: string;
  trigger: ReviewTrigger;
  openedAt: string;
  state: ReviewState;
  closedAt: string | null;
  steps: (ProposalStep | DecisionStep | TriggerStep)[];
}

interface FollowUpRecord {
  reference: string;
  record: string;
  decision: string | null;
  superseded: string | null;
  change: Written | null;
  dueBy: string;
  state: "OPEN" | "APPLIED" | "SUPERSEDED";
  decisionUnreadable: boolean;
  applied: { outcome: FollowUpOutcome; at: string; by: string | null; reason: Written | null; inForceFrom: string } | null;
  lateWhy: Written | null;
}

interface KeyRecord {
  kid: string;
  handle: string | null;
  validFrom: string;
  state: "ACTIVE" | "RETIRED" | "REVOKED";
  signed: number;
  retiredAt: string | null;
  revokedAt: string | null;
  reason: string | null;
}

/** An exception this family raised to the certificate authority or the operators, naming what it is about. */
export interface CertificateException {
  code: "EXC-CER-02" | "EXC-CER-04" | "EXC-CER-05" | "EXC-CER-06" | "EXC-CER-07";
  at: string;
  subject: string;
  detail: Readonly<Record<string, string>>;
}

interface World {
  records: RecordRow[];
  /** Decisions this family has already read from REG: each is placed once. */
  seen: Set<string>;
  /** The decisions REG's world does not hold, as the CER boards draw them. */
  decisions: Map<string, SeedDecision>;
  reviews: ReviewRecord[];
  followUps: FollowUpRecord[];
  keys: KeyRecord[];
  /** The payment and case events already applied, with the review each opened or joined (`DR-437` row 5). */
  events: Map<string, string>;
  exceptions: CertificateException[];
}

/** A status change's cause, for a change the boards draw. */
function causeOf(change: SeedChange): ChangeCause {
  if (change.from === "PENDING_ISSUE") return "ISSUE";
  if (change.to === "REPLACED") return "REPLACEMENT";
  if (change.to === "REINSTATED") return "REINSTATEMENT";
  return "ENFORCEMENT";
}

/** `DR-439`: the remedy a change states, from its ground, the day it takes effect and the policy's lodging period. */
function remedyOf(ground: GroundCode | null, takesEffect: string, policy: SeedPolicyVersion | null): Remedy {
  if (ground === null || policy === null) return { kind: "COMPLAINT", route: "CAS", closesOn: null };
  return { kind: "APPEAL", route: "CAS", closesOn: workingDaysAfter(dayOf(takesEffect), policy.appealWorkingDays) };
}

function seed(): World {
  const records: RecordRow[] = CER_RECORDS.map((record) => {
    const changes: ChangeRow[] = record.changes.map((change) => ({
      ...change,
      evidence: [...change.evidence],
      cause: causeOf(change),
      authority: change.authority.kind === "ROUTE" ? { ...change.authority, decision: record.opened.decision } : change.authority,
      policyVersion: change.ground !== null ? (policyAt(change.effectiveAt)?.version ?? null) : null,
      remedy: change.ground !== null && change.appealBy !== null ? { kind: "APPEAL", route: "CAS", closesOn: change.appealBy } : { kind: "COMPLAINT", route: "CAS", closesOn: null },
      noticeRef: null,
    }));
    const periods: PeriodRow[] = record.periods.map((period) => ({ ...period, recordedAt: period.governedFrom, follows: null, renews: null }));
    const instants = [record.opened.at, ...changes.map((change) => change.effectiveAt), ...periods.map((period) => period.recordedAt)];
    return {
      id: record.id,
      reference: record.reference,
      reserved: record.reserved,
      premises: CER_PREMISES[record.premises],
      holder: record.holder,
      opened: { ...record.opened },
      decision: record.opened.decision,
      issued: record.issued !== null ? { ...record.issued } : null,
      definition: record.issued !== null ? definitionOn(dayOf(record.issued.at)) : null,
      pendingPeriod: record.pendingPeriod,
      periods,
      changes,
      assessments: record.assessments.map((assessment) => ({ ...assessment, kind: "ISSUE" as const, decision: record.opened.decision, unmet: [...assessment.unmet] })),
      issueDecisions: [],
      renewals: [],
      expiries: [],
      historyTo: instants.reduce((latest, instant) => (time(instant) > time(latest) ? instant : latest)),
      predecessor: record.predecessor,
      successor: record.successor,
      printouts: [],
      sheet: record.sheet,
    };
  });
  const seen = new Set<string>();
  for (const record of records) {
    if (record.opened.decision !== null) seen.add(record.opened.decision);
    for (const period of record.periods) if (period.decision !== null) seen.add(period.decision);
  }
  for (const followUp of CER_FOLLOW_UPS) if (followUp.decision !== null) seen.add(followUp.decision);
  const events = new Map<string, string>();
  for (const review of CER_REVIEWS) {
    const event = eventOf(review.trigger);
    if (event !== null) events.set(event, review.reference);
  }
  const world: World = {
    records,
    seen,
    decisions: new Map(CER_DECISIONS.map((decision) => [decision.reference, decision])),
    reviews: CER_REVIEWS.map((review) => ({
      reference: review.reference,
      record: review.record,
      trigger: review.trigger,
      openedAt: review.openedAt,
      state: review.state,
      closedAt: review.approval?.at ?? null,
      steps: [
        ...(review.proposal !== null
          ? [{ ...review.proposal, kind: "PROPOSAL" as const, conditions: [], policyVersion: review.proposal.ground !== null ? (policyAt(review.proposal.at)?.version ?? null) : null }]
          : []),
        ...(review.approval !== null ? [{ kind: "DECISION" as const, at: review.approval.at, by: review.approval, outcome: "APPROVE" as const, reason: null }] : []),
      ],
    })),
    followUps: CER_FOLLOW_UPS.map((followUp) => ({
      ...followUp,
      applied: followUp.applied !== null ? { ...followUp.applied, inForceFrom: followUp.applied.at } : null,
    })),
    keys: CER_KEYS.map((key) => ({ ...key, retiredAt: null, revokedAt: null, reason: null })),
    events,
    exceptions: [],
  };
  // The printouts the boards draw were signed when they were printed, with the key that signed then. COM answered
  // each record's expiry notice when it issued, before this world began: due its lead time before the lapse.
  const at = now();
  for (const [index, record] of records.entries()) {
    for (const made of CER_RECORDS[index]?.printouts ?? []) {
      if (record.reference !== null) record.printouts.push(signedPrintout(record, made.reference, made.printedAt, made.signingKey));
    }
    if (record.issued === null) continue;
    const lapse = nextLapse(record, at);
    const ending = lapse !== null ? periodEndingAt(record, lapse, at) : null;
    if (lapse !== null && ending !== null) {
      record.expiries.push({ lapseAt: lapse, periodRecordedAt: ending.recordedAt, raisedAt: ending.recordedAt, notice: null, dueAt: daysBefore(lapse, EXPIRY_LEAD_DAYS), state: "RAISED" });
    }
  }
  return world;
}

/** The world's status records, with what REG and FIN did since the last read applied first. */
function worldOf(key: string): World {
  const world = table(key, "status-records", seed);
  sync(key, world);
  return world;
}

// ================================================================== small helpers

type Refusal = LoadOutcome<never>;

const refused = (code: string, retryable = false): Refusal => ({ data: null, failure: { code, traceId: null, retryable } });

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

const time = (iso: string) => Date.parse(iso);

const later = (a: string, b: string) => (time(a) >= time(b) ? a : b);

/** The instant a millisecond before another: what every read answered just before it. */
const justBefore = (iso: string) => new Date(time(iso) - 1).toISOString();

/** Vietnam keeps UTC+07:00 all year, with no daylight saving: a day there is a UTC day seven hours on. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/**
 * The Vietnam calendar day of an instant or a date, as `clock.ts`'s `addDays(iso, 0)` answers it, worked out without
 * a date formatter: every status read asks it many times over.
 */
const dayOf = (iso: string) => new Date(time(iso) + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);

/** Midnight in Vietnam at the start of a day: the instant a decision dated that day takes effect. */
const startOf = (day: string) => `${day}T00:00:00+07:00`;

/** 00:00 the day after a period's last day: the instant it stops governing (`DR-433`: both days inclusive). */
function endOf(lastDay: string): string {
  const next = new Date(`${lastDay}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return startOf(next.toISOString().slice(0, 10));
}

const daysBefore = (instant: string, days: number) => new Date(time(instant) - days * 86_400_000).toISOString();

/** COM's lead time for the expiry class, as its policy answered the notices requested before this world began. */
const EXPIRY_LEAD_DAYS = NOTICE_POLICY_SEED.classes.find((entry) => entry.classCode === "expiry")?.leadTimeDays ?? 30;

/** `DR-434`'s F: thirty days before a lapse (`CFG-162`'s tested default), never sooner than fifteen minutes after the period was recorded. */
const FALLBACK_DAYS = 30;
const FALLBACK_AFTER_RECORDING_MS = 15 * 60_000;

/** The position of the last entry that answers yes, or -1. */
function lastIndexWhere<T>(entries: readonly T[], test: (entry: T) => boolean): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry !== undefined && test(entry)) return index;
  }
  return -1;
}

/**
 * A day `count` Vietnamese working days after `day` (`DR-439`: the appeal's closing date). The mock knows no public
 * holiday, so only Saturdays and Sundays are skipped; none falls in the boards' weeks.
 */
function workingDaysAfter(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  let left = count;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return date.toISOString().slice(0, 10);
}

/** The day a key is due for retirement: twelve months after it starts signing (`CFG-467`), the day before. */
function retireByOf(validFrom: string): string {
  const [year = 0, month = 1, day = 1] = dayOf(validFrom).split("-").map(Number);
  const date = new Date(Date.UTC(year + 1, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

const keyOf = (record: RecordRow) => record.reference ?? record.opened.decision ?? record.id;

/**
 * A record by the key the console addresses it with: its reference once issued, or the decision it was opened
 * under (which still finds it after it issues, so an address made while it waited keeps working).
 */
function findRecord(world: World, key: string): RecordRow | null {
  return (
    world.records.find((record) => record.reference === key) ??
    world.records.find((record) => record.opened.decision === key) ??
    world.records.find((record) => record.id === key) ??
    null
  );
}

const byId = (world: World, id: string | null) => (id === null ? null : (world.records.find((record) => record.id === id) ?? null));

/** One premises, named by its register record or, for one no board registers, by its name. */
const samePremises = (a: SeedPremises, b: SeedPremises) => (a.register !== null && b.register !== null ? a.register === b.register : a.name === b.name);

/** The identity of a payment or case event, which opens or joins a review once (`DR-437` row 5). */
function eventOf(trigger: ReviewTrigger): string | null {
  if (trigger.kind === "PAYMENT_REVERSAL") return trigger.event;
  if (trigger.kind === "CASE") return trigger.caseRef;
  return null;
}

function raiseException(world: World, code: CertificateException["code"], subject: string, detail: Readonly<Record<string, string>>, at: string = now()): void {
  world.exceptions.push({ code, at, subject, detail });
}

// ================================================================== what GOV, TRN and DAT answer

/** GOV's status record definition in force on a day, or null where none is approved (`DR-430` row 2). */
function definitionOn(day: string): SeedDefinition | null {
  return [...CER_DEFINITIONS].filter((definition) => definition.effectiveFrom <= day).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1) ?? null;
}

/** The `CER-ENFORCEMENT` version in force at an instant: the latest published one whose first day has come (`DR-40` row 1). */
function policyAt(at: string): SeedPolicyVersion | null {
  const day = dayOf(at);
  return (
    [...CER_POLICY_VERSIONS]
      .filter((version) => version.state === "PUBLISHED" && version.effective <= day)
      .sort((a, b) => a.effective.localeCompare(b.effective))
      .at(-1) ?? null
  );
}

/** TRN's `ResolveAuthority("CERTIFICATE", at)`: RightOne, or the legacy system before RightOne took over. */
function issuingSystemAt(at: string): "RIGHTONE" | "LEGACY" {
  return [...ISSUING_AUTHORITY].filter((entry) => time(entry.from) <= time(at)).at(-1)?.system ?? "LEGACY";
}

/** DAT's `IPurposeLimits.MayProcess("certificate issue")` on a day. */
const mayProcess = (day: string) => PROCESSING_PURPOSES.some((entry) => entry.activity === "certificate issue" && entry.from <= day);

/** `DR-433`: the record's period from the decision's and the definition's validity conditions; null where it would reach past the decision. */
function periodFor(decision: Period, definition: SeedDefinition | null): Period | null {
  const months = definition?.validityMonths ?? null;
  if (months === null) return { ...decision };
  const [year = 0, month = 1, day = 1] = decision.from.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1 + months, day));
  end.setUTCDate(end.getUTCDate() - 1);
  const to = end.toISOString().slice(0, 10);
  return to > decision.to ? null : { from: decision.from, to };
}

const definitionView = (definition: SeedDefinition | null): RecordDefinition | null =>
  definition === null
    ? null
    : { id: definition.id, version: definition.version, legalName: definition.legalName, legalNature: definition.legalNature, legalEffect: definition.legalEffect, issuer: definition.issuer };

// ================================================================== the status at an instant (DR-438, ALG-408)

const decided = (change: ChangeRow) => !AUTOMATIC.includes(change.cause);

/** The standing at an instant: the latest change a decision or an issue made that has taken effect by then. */
const standingAt = (record: RecordRow, at: string) => record.changes.filter((change) => decided(change) && time(change.effectiveAt) <= time(at)).at(-1);

/** The periods in force at an instant: begun, and not superseded by a period written for a follow-up. */
const inForce = (periods: readonly PeriodRow[], at: string) =>
  periods.filter((period) => time(period.governedFrom) <= time(at) && (period.governedTo === null || time(period.governedTo) > time(at)));

/** The period that governs an instant: among those in force, the latest written whose last day has not passed. */
function governingAmong(periods: readonly PeriodRow[], at: string): PeriodRow | null {
  const day = dayOf(at);
  return inForce(periods, at).filter((period) => period.to >= day).at(-1) ?? null;
}

const governing = (record: RecordRow, at: string = now()) => governingAmong(record.periods, at);

/** The period a page shows: the one that governs, or the latest that did, or the first, not yet in force. */
function governingPeriod(record: RecordRow, at: string = now()): PeriodRow | null {
  return governing(record, at) ?? record.periods.filter((period) => time(period.governedFrom) <= time(at)).at(-1) ?? record.periods[0] ?? null;
}

/** The record's next lapse after an instant, among the periods recorded by then: where the chain of governing periods ends. */
function nextLapse(record: RecordRow, at: string): string | null {
  const recorded = record.periods.filter((period) => time(period.recordedAt) <= time(at));
  let period = governingAmong(recorded, at);
  if (period === null) return null;
  for (let step = 0; step <= recorded.length; step += 1) {
    const next = governingAmong(recorded, endOf(period.to));
    if (next === null) break;
    period = next;
  }
  return endOf(period.to);
}

/** The period whose end is a lapse, among those recorded by `at`. */
function periodEndingAt(record: RecordRow, lapse: string, at: string): PeriodRow | null {
  return governingAmong(record.periods.filter((period) => time(period.recordedAt) <= time(at)), justBefore(lapse));
}

/**
 * `DR-434`: the instant the record enters the expiring state before a lapse. COM's answer recorded before F gives its
 * due instant (row 1), or the instant it was recorded where it fell due at once (row 2); with none in time, F (row 3).
 */
function expiringFor(record: RecordRow, lapse: string): { at: string; request: ExpiryRequest | null; fallback: boolean } {
  const request = record.expiries.find((entry) => time(entry.lapseAt) === time(lapse)) ?? null;
  const recordedAt = request?.periodRecordedAt ?? periodEndingAt(record, lapse, lapse)?.recordedAt ?? lapse;
  const f = later(daysBefore(lapse, FALLBACK_DAYS), new Date(time(recordedAt) + FALLBACK_AFTER_RECORDING_MS).toISOString());
  if (request !== null && request.state === "RAISED" && request.dueAt !== null && time(request.raisedAt) < time(f)) {
    return { at: time(request.dueAt) > time(request.raisedAt) ? request.dueAt : request.raisedAt, request, fallback: false };
  }
  return { at: f, request, fallback: true };
}

function statusOf(record: RecordRow, at: string = now()): RecordStatus {
  const standing = standingAt(record, at);
  if (standing === undefined) return "PENDING_ISSUE";
  const status = standing.to;
  if (status !== "ACTIVE" && status !== "REINSTATED" && status !== "SUSPENDED") return status;
  // Issued, and no period in force yet: the standing, not current (row 4).
  if (record.periods.every((period) => time(period.governedFrom) > time(at))) return status;
  // A period in force and none governs: a lapse, whatever the standing (row 3); a suspension outlasts it.
  if (governing(record, at) === null) return "EXPIRED";
  if (status === "SUSPENDED") return "SUSPENDED";
  const lapse = nextLapse(record, at);
  if (lapse !== null && time(expiringFor(record, lapse).at) <= time(at)) return "EXPIRING";
  return status;
}

/** The instants at which the answer can change: decided changes, the starts and ends of periods, their recording, the expiring instants. */
function candidates(record: RecordRow): string[] {
  const instants = [
    ...record.changes.filter(decided).map((change) => change.effectiveAt),
    ...record.periods.flatMap((period) => [period.governedFrom, period.recordedAt, endOf(period.to), ...(period.governedTo !== null ? [period.governedTo] : [])]),
    ...record.expiries.map((request) => expiringFor(record, request.lapseAt).at),
  ];
  const unique = new Map(instants.map((instant) => [time(instant), instant]));
  return [...unique.entries()].sort((a, b) => a[0] - b[0]).map(([, instant]) => instant);
}

/** Since when the answer at `at` has held without a break: the latest instant at which it changed to it. */
function sinceOf(record: RecordRow, at: string = now()): string {
  const answer = statusOf(record, at);
  const before = candidates(record)
    .filter((instant) => time(instant) <= time(at))
    .reverse();
  for (const instant of before) {
    if (statusOf(record, justBefore(instant)) !== answer) return instant;
  }
  return record.changes.find(decided)?.effectiveAt ?? record.opened.at;
}

/** Current: issued, not suspended, revoked or ended, and a period governs today (`DR-438` row 5). */
function isCurrent(record: RecordRow, at: string = now()): boolean {
  const status = statusOf(record, at);
  if (status !== "ACTIVE" && status !== "REINSTATED" && status !== "EXPIRING") return false;
  const period = governing(record, at);
  const today = dayOf(at);
  return period !== null && period.from <= today && today <= period.to;
}

/** The period a list shows: the governing one, or a pending record's decision's. */
function shownPeriod(record: RecordRow): Period | null {
  const period = governingPeriod(record);
  return period !== null ? { from: period.from, to: period.to } : record.pendingPeriod;
}

/** The decision that governs now, or the one a pending record waits under. */
const decisionNow = (record: RecordRow) => (record.periods.length > 0 ? (governingPeriod(record)?.decision ?? null) : record.decision);

/** The renewal waiting on an issued record to add its period. */
const waitingRenewal = (record: RecordRow) =>
  record.issued !== null ? (record.renewals.find((renewal) => renewal.addedAt === null && renewal.replacedBy === null) ?? null) : null;

const HOLDER_STATES: Readonly<Record<RecordStatus, HolderState | null>> = {
  PENDING_ISSUE: null,
  ACTIVE: "active",
  EXPIRING: "expiring",
  EXPIRED: "expired",
  SUSPENDED: "suspended",
  REINSTATED: "reinstated",
  REVOKED: "revoked",
  CANCELLED: "cancelled",
  REPLACED: "replaced",
};

const TERMINAL: readonly RecordStatus[] = ["REVOKED", "CANCELLED", "REPLACED"];

/** The acts SM-03 permits from a status, in the order the proposal form offers them. */
function actsFrom(status: RecordStatus): StatusAct[] {
  switch (status) {
    case "PENDING_ISSUE":
      return ["CANCEL"];
    case "ACTIVE":
    case "EXPIRING":
    case "REINSTATED":
      return ["NO_CHANGE", "SUSPEND", "REVOKE", "CANCEL"];
    case "SUSPENDED":
      return ["NO_CHANGE", "REINSTATE", "REVOKE", "CANCEL"];
    default:
      return [];
  }
}

// ================================================================== decisions, as REG and FIN answer them

/** FIN's `PaymentConditionFor`, as `DR-430` row 4 names what is unmet. */
type PaymentCondition = "RECONCILED_IN_FULL" | "PENDING" | "PART_PAID" | "REVERSED" | "IN_SUSPENSE_OR_DISPUTED";

const PAYMENT_UNMET: Readonly<Record<Exclude<PaymentCondition, "RECONCILED_IN_FULL">, IssueCondition>> = {
  PENDING: "PAYMENT_PENDING",
  PART_PAID: "PAYMENT_PART_PAID",
  REVERSED: "PAYMENT_REVERSED",
  IN_SUSPENSE_OR_DISPUTED: "PAYMENT_IN_SUSPENSE_OR_DISPUTED",
};

const PAYMENT_CONDITIONS: readonly IssueCondition[] = Object.values(PAYMENT_UNMET);

interface DecisionFacts {
  status: "CURRENT" | "SUPERSEDED";
  outcome: "PAYABLE" | "NO_PAYABLE_OBLIGATION";
  feeMinor: number | null;
  payBy: string | null;
  paid: { at: string; method: "card" | "transfer" | null } | null;
  payment: PaymentCondition;
  period: Period;
  claimPending: boolean;
}

/**
 * A decision's facts: REG's decision and FIN's payment for REG's decisions, the CER boards' for the decisions REG's
 * world does not hold. Null for a decision no family answers for.
 */
function decisionFacts(key: string, world: World, ref: string | null): DecisionFacts | null {
  if (ref === null) return null;
  const drawn = world.decisions.get(ref);
  if (drawn !== undefined) {
    return {
      status: drawn.status,
      outcome: drawn.outcome,
      feeMinor: drawn.feeMinor,
      payBy: drawn.payBy,
      paid: drawn.paid,
      payment: drawn.paid !== null ? "RECONCILED_IN_FULL" : "PENDING",
      period: drawn.period,
      claimPending: false,
    };
  }
  const decision = decisionForCollection(key, ref);
  if (decision === null) return null;
  const settled = settlementOf(key, ref);
  const board = CER_PAYMENTS[ref];
  const condition = paymentConditionFor(key, ref);
  return {
    status: decision.summary.status,
    outcome: decision.summary.outcome,
    feeMinor: decision.summary.outcome === "PAYABLE" ? decision.summary.feeMinor : null,
    payBy: decision.summary.payBy,
    // FIN's reconciled payment; for the payments the record pages draw, the method the board names with it.
    paid: settled !== null ? { at: settled.reconciledAt, method: board?.at === settled.reconciledAt ? board.method : null } : board !== undefined ? { ...board } : null,
    // A payment the record pages draw was reconciled before FIN's world began, unless FIN has since answered otherwise.
    payment: condition === "PENDING" && board !== undefined ? "RECONCILED_IN_FULL" : condition,
    period: decision.summary.period,
    claimPending: decision.record.claim?.state === "UNDER_REVIEW",
  };
}

/**
 * `DR-430` at an instant: every issue condition that does not hold for a decision, in row order - the issuing
 * system, the definition, the decision in force, its payment, the processing purpose and the period.
 */
function unmetConditions(key: string, world: World, decision: string | null, at: string): IssueCondition[] {
  const unmet: IssueCondition[] = [];
  const day = dayOf(at);
  if (issuingSystemAt(at) !== "RIGHTONE") unmet.push("AUTHORITY_NOT_RIGHTONE");
  const definition = definitionOn(day);
  if (definition === null) unmet.push("DEFINITION_NOT_APPROVED");
  const facts = decisionFacts(key, world, decision);
  if (facts !== null) {
    if (facts.status === "SUPERSEDED" || facts.period.to < day) unmet.push("DECISION_SUPERSEDED");
    // Row 4 reads the outcome, never the amount: a decision that owes nothing skips it.
    if (facts.outcome === "PAYABLE" && facts.payment !== "RECONCILED_IN_FULL") unmet.push(PAYMENT_UNMET[facts.payment]);
  }
  if (!mayProcess(day)) unmet.push("PROCESSING_NOT_PERMITTED");
  if (facts !== null && periodFor(facts.period, definition) === null) unmet.push("PERIOD_EXCEEDS_DECISION");
  return unmet;
}

/**
 * `DR-431`: an issuable record is issued straight through unless its decision rests on a declared classification
 * (REG reviewed it as a rulebook exception) or a claim is pending on it (row 1), or it succeeds a record of another
 * holder (row 2). A renewal lands only on its own holder's record, so row 2 never routes one.
 */
function routeOf(key: string, world: World, record: RecordRow, decision: string | null, kind: AssessmentRow["kind"]): RouteReason {
  const facts = decisionFacts(key, world, decision);
  if (facts?.claimPending === true) return "CLAIM_PENDING";
  if (decision !== null && !world.decisions.has(decision) && restsOnDeclaredClassification(key, decision)) return "DECLARED_CLASSIFICATION";
  const predecessor = kind === "ISSUE" ? byId(world, record.predecessor) : null;
  if (predecessor !== null && predecessor.holder !== record.holder) return "HOLDER_CHANGED";
  return "STRAIGHT_THROUGH";
}

/** The party PTY answers responsible for a premises: the holder the boards draw for it, on any day. */
const holderOf = (premises: SeedPremises) => premises.holder;

// ================================================================== the holder's notices, through COM

/**
 * Raises a notice through COM for the record's holder (`NTF-CER-01`, `NTF-CER-02`): COM answers with its notice, or
 * none where its policy in force requires none, which is EXC-CER-02 here; the act stands either way.
 */
function notify(
  key: string,
  world: World,
  record: RecordRow,
  eventKind: "status_record_changed" | "certificate_expiring",
  occurrence: string,
  at: string,
  facts: Readonly<Record<string, string>> & { by: string },
): string | null {
  const contact = HOLDER_CONTACTS[record.holder] ?? null;
  const subject = record.reference ?? keyOf(record);
  const notice = recordNoticeEvent(key, {
    sourceModule: "CER",
    eventKind,
    occurrenceRef: occurrence,
    occurredAt: at,
    subjectKind: "certificate",
    subjectRef: subject,
    recipientPartyId: contact?.party ?? record.holder,
    destination: contact?.address ?? null,
    facts: { record: subject, premises: record.premises.name, ...facts },
  });
  if (notice === null) raiseException(world, "EXC-CER-02", subject, { event: eventKind, occurrence }, at);
  return notice;
}

/**
 * `ALG-409`: the expiry notice of the record's next lapse, requested with the period that ends there. COM answers
 * when it falls due from its own lead time; this family keeps none. One request per lapse; one raised stays with COM.
 */
function requestExpiry(key: string, world: World, record: RecordRow, at: string): void {
  if (record.reference === null) return;
  const lapse = nextLapse(record, at);
  if (lapse === null || record.expiries.some((entry) => time(entry.lapseAt) === time(lapse))) return;
  const ending = periodEndingAt(record, lapse, at);
  const notice = notify(key, world, record, "certificate_expiring", `${record.reference}/${dayOf(lapse)}`, at, { by: dayOf(lapse), lastDay: ending?.to ?? "" });
  record.expiries.push({
    lapseAt: lapse,
    periodRecordedAt: ending?.recordedAt ?? at,
    raisedAt: at,
    notice,
    dueAt: notice !== null ? (noticeStateOf(key, notice)?.dueAt ?? null) : null,
    state: notice !== null ? "RAISED" : "NOT_REQUIRED",
  });
}

/** The facts a status change's notice carries: the change, its ground and condition, the remedy and its date, the policy. */
function changeFacts(change: ChangeRow): Readonly<Record<string, string>> & { by: string } {
  return {
    by: dayOf(change.effectiveAt),
    status: change.to,
    effectiveAt: change.effectiveAt,
    ...(change.ground !== null ? { ground: change.ground } : {}),
    ...(change.condition !== null ? { condition: change.condition } : {}),
    remedy: change.remedy.kind,
    ...(change.remedy.closesOn !== null ? { remedyClosesOn: change.remedy.closesOn } : {}),
    ...(change.policyVersion !== null ? { policy: `CER-ENFORCEMENT ${change.policyVersion}` } : {}),
  };
}

// ================================================================== issue (SM-03 transitions 1, 2 and 11)

function assess(key: string, world: World, record: RecordRow, at: string, trigger: AssessmentRow["trigger"], kind: AssessmentRow["kind"] = "ISSUE"): AssessmentRow {
  const decision = kind === "RENEWAL" ? (waitingRenewal(record)?.decision ?? null) : record.decision;
  const assessment: AssessmentRow = { at, trigger, kind, decision, unmet: unmetConditions(key, world, decision, at), route: routeOf(key, world, record, decision, kind) };
  record.assessments.push(assessment);
  return assessment;
}

/** A reference no record of the world carries yet. */
function freshReference(world: World, at: string): string {
  const year = Number(dayOf(at).slice(0, 4));
  for (;;) {
    const candidate = recordReference(year);
    if (!world.records.some((record) => record.reference === candidate || record.reserved === candidate)) return candidate;
  }
}

/** The predecessor already took another successor or ended: this record may not issue (`PREDECESSOR_ENDED`). */
function predecessorEnded(world: World, record: RecordRow): boolean {
  const predecessor = byId(world, record.predecessor);
  if (predecessor === null) return false;
  if (predecessor.successor !== null && predecessor.successor !== record.id) return true;
  const status = statusOf(predecessor);
  return status === "CANCELLED" || status === "REPLACED";
}

function newChange(from: RecordStatus, to: RecordStatus, at: string, cause: ChangeCause, authority: ChangeRow["authority"]): ChangeRow {
  return {
    from,
    to,
    effectiveAt: at,
    recordedAt: at,
    cause,
    authority,
    ground: null,
    condition: null,
    reason: null,
    evidence: [],
    appealBy: null,
    notice: false,
    policyVersion: null,
    remedy: remedyOf(null, at, null),
    noticeRef: null,
  };
}

/**
 * `ALG-405` step 5: the reference, the definition's texts, the first period in force from the later of its first
 * day and the issue, the status change with its authority (the rule and the decision, or the approver) and remedy,
 * the holder's notice and the expiry request; for a successor, the predecessor replaced at the same instant.
 */
function issue(key: string, world: World, record: RecordRow, at: string, route: "STRAIGHT_THROUGH" | "APPROVED", approver: string | null): void {
  const ref = record.reserved ?? freshReference(world, at);
  const definition = definitionOn(dayOf(at));
  const period = record.pendingPeriod !== null ? (periodFor(record.pendingPeriod, definition) ?? record.pendingPeriod) : null;
  record.reference = ref;
  record.issued = { at, route };
  record.definition = definition;
  if (period !== null) {
    record.periods.push({
      decision: record.decision,
      from: period.from,
      to: period.to,
      governedFrom: later(startOf(period.from), at),
      governedTo: null,
      cause: "ISSUE",
      followUp: null,
      recordedAt: at,
      follows: null,
      renews: null,
    });
  }
  const change = newChange(
    "PENDING_ISSUE",
    "ACTIVE",
    at,
    "ISSUE",
    route === "APPROVED" && approver !== null ? { kind: "APPROVAL", approver } : { kind: "ROUTE", straight: true, decision: record.decision },
  );
  record.changes.push(change);
  change.noticeRef = notify(key, world, record, "status_record_changed", `${ref}/ISSUE`, at, { ...changeFacts(change), by: period?.to ?? dayOf(at) });
  change.notice = change.noticeRef !== null;
  record.historyTo = at;
  requestExpiry(key, world, record, at);
  const predecessor = byId(world, record.predecessor);
  if (predecessor === null || statusOf(predecessor, at) === "CANCELLED") return;
  // A predecessor cancelled meanwhile has nothing left to replace; any other is replaced at the same instant.
  predecessor.successor = record.id;
  const governed = governing(predecessor, at) ?? governingPeriod(predecessor, at);
  if (governed !== null && governed.governedTo === null) governed.governedTo = at;
  const replaced = newChange(statusOf(predecessor, at), "REPLACED", at, "REPLACEMENT", { kind: "SUCCESSOR", successor: ref });
  predecessor.changes.push(replaced);
  replaced.noticeRef = notify(key, world, predecessor, "status_record_changed", `${predecessor.reference ?? predecessor.id}/REPLACED`, at, changeFacts(replaced));
  replaced.notice = replaced.noticeRef !== null;
  predecessor.historyTo = at;
  for (const review of world.reviews) {
    if (review.record === predecessor.id && (review.state === "OPEN" || review.state === "PROPOSED")) {
      review.state = "SUPERSEDED";
      review.closedAt = at;
    }
  }
}

/**
 * `ALG-405` step 6: a renewal adds its period to the holder's record under the same reference, in force from the
 * later of its first day and now, naming the period it follows and the decision it renews (`FR-CER-010`). No status
 * change is recorded here: from now every read answers what the period does, and the changes it makes are recorded as
 * they take effect.
 */
function addRenewalPeriod(key: string, world: World, record: RecordRow, at: string): Period | null {
  const renewal = waitingRenewal(record);
  if (renewal === null) return null;
  renewal.addedAt = at;
  if (record.periods.some((period) => period.decision === renewal.decision)) return null;
  const facts = decisionFacts(key, world, renewal.decision);
  const period = periodFor(facts?.period ?? renewal.period, definitionOn(dayOf(at))) ?? renewal.period;
  const follows = [...record.periods.entries()]
    .filter(([, entry]) => entry.governedTo === null)
    .sort((a, b) => a[1].to.localeCompare(b[1].to))
    .at(-1)?.[0];
  record.periods.push({
    decision: renewal.decision,
    from: period.from,
    to: period.to,
    governedFrom: later(startOf(period.from), at),
    governedTo: null,
    cause: "RENEWAL",
    followUp: null,
    recordedAt: at,
    follows: follows ?? null,
    renews: renewal.prior ?? (follows !== undefined ? (record.periods[follows]?.decision ?? null) : null),
  });
  requestExpiry(key, world, record, at);
  return period;
}

/** A pending record, opened when REG records a decision `DR-432` places on no record of its holder. */
function openPending(key: string, world: World, ref: string, premises: SeedPremises, holder: string, period: Period, at: string, predecessor: RecordRow | null): void {
  const record: RecordRow = {
    id: `cer-${ref}`,
    reference: null,
    reserved: null,
    premises,
    holder,
    opened: { decision: ref, at },
    decision: ref,
    issued: null,
    definition: null,
    pendingPeriod: period,
    periods: [],
    changes: [],
    assessments: [],
    issueDecisions: [],
    renewals: [],
    expiries: [],
    historyTo: at,
    predecessor: predecessor?.id ?? null,
    successor: null,
    printouts: [],
    sheet: { address: null, operator: holder },
  };
  world.records.push(record);
  const assessment = assess(key, world, record, at, "DECISION_RECORDED");
  if (assessment.unmet.length === 0 && assessment.route === "STRAIGHT_THROUGH" && !predecessorEnded(world, record)) issue(key, world, record, at, "STRAIGHT_THROUGH", null);
}

/** `DR-432` row 2: a renewal waits on the holder's record, and adds its period at once where nothing waits. */
function openRenewal(key: string, world: World, record: RecordRow, ref: string, period: Period, at: string, prior: string | null): void {
  record.renewals.push({ decision: ref, prior, period, openedAt: at, addedAt: null, replacedBy: null });
  const assessment = assess(key, world, record, at, "DECISION_RECORDED", "RENEWAL");
  if (assessment.unmet.length === 0 && assessment.route === "STRAIGHT_THROUGH") addRenewalPeriod(key, world, record, at);
}

/**
 * `DR-432` row 1: a later decision becomes the basis of what waits for an earlier one - a pending record, or a
 * renewal not yet added. The earlier decision's assessment records it superseded, and the later one is assessed.
 */
function rebase(key: string, world: World, record: RecordRow, ref: string, period: Period, at: string, prior: string | null = null): void {
  const renewal = waitingRenewal(record);
  if (renewal !== null) {
    record.assessments.push({ at, trigger: "DECISION_RECORDED", kind: "RENEWAL", decision: renewal.decision, unmet: ["DECISION_SUPERSEDED"], route: null });
    renewal.replacedBy = ref;
    // A re-decision of a waiting renewal renews what the renewal did.
    openRenewal(key, world, record, ref, period, at, prior ?? renewal.prior);
    return;
  }
  record.assessments.push({ at, trigger: "DECISION_RECORDED", kind: "ISSUE", decision: record.decision, unmet: ["DECISION_SUPERSEDED"], route: null });
  record.decision = ref;
  record.pendingPeriod = period;
  const assessment = assess(key, world, record, at, "DECISION_RECORDED");
  if (assessment.unmet.length === 0 && assessment.route === "STRAIGHT_THROUGH" && !predecessorEnded(world, record)) issue(key, world, record, at, "STRAIGHT_THROUGH", null);
}

/** The greatest last day among the record's periods that no later period supersedes (`DR-432`). */
function lastCoveredDay(record: RecordRow): string {
  return record.periods.filter((period) => period.governedTo === null).reduce((last, period) => (period.to > last ? period.to : last), "");
}

const RENEWABLE: readonly RecordStatus[] = ["ACTIVE", "EXPIRING", "SUSPENDED", "REINSTATED", "EXPIRED"];

/** Whether a decision is one a record was opened under, waits under or holds a period of. */
const holdsDecision = (record: RecordRow, decision: string) =>
  record.opened.decision === decision || record.decision === decision || record.periods.some((period) => period.decision === decision);

/**
 * `DR-432`: which record a decision of kind new or renewal lands on - a pending record's new basis (row 1), a
 * renewal of the holder's record (row 2), a successor of another holder's record or of a revoked one (rows 3 and 4),
 * nowhere where it overlaps the holder's record (row 5, EXC-CER-05), or a new record (row 6). `prior` is the decision
 * REG's renewal names as the one it renews: among the holder's renewable records, the one holding it takes the period.
 */
function place(key: string, world: World, ref: string, premises: SeedPremises, period: Period, at: string, prior: string | null = null): void {
  const holder = holderOf(premises);
  const ofPremises = world.records.filter((record) => samePremises(record.premises, premises));
  const pending = ofPremises.find((record) => record.holder === holder && record.issued === null && statusOf(record, at) === "PENDING_ISSUE");
  if (pending !== undefined) return rebase(key, world, pending, ref, period, at, prior);
  const issued = ofPremises.filter((record) => record.issued !== null).sort((a, b) => time(a.issued?.at ?? "") - time(b.issued?.at ?? ""));
  const mine = issued.filter((record) => record.holder === holder && !TERMINAL.includes(statusOf(record, at)));
  const renewables = mine.filter((record) => RENEWABLE.includes(statusOf(record, at)) && period.from > lastCoveredDay(record));
  const renewable = renewables.find((record) => prior !== null && holdsDecision(record, prior)) ?? renewables[0];
  if (renewable !== undefined) {
    if (waitingRenewal(renewable) !== null) return rebase(key, world, renewable, ref, period, at, prior);
    return openRenewal(key, world, renewable, ref, period, at, prior);
  }
  const another = issued.find((record) => record.holder !== holder && !TERMINAL.includes(statusOf(record, at)) && record.successor === null);
  if (another !== undefined) return openPending(key, world, ref, premises, holder, period, at, another);
  const latest = issued.at(-1);
  if (latest !== undefined && latest.successor === null) {
    const status = statusOf(latest, at);
    if (status === "REVOKED" || (status === "EXPIRED" && latest.holder !== holder)) return openPending(key, world, ref, premises, holder, period, at, latest);
  }
  if (mine.length > 0) {
    // Row 5: an obligation overlapping the holder's record reaches this family as a re-decision, never as a second record.
    raiseException(world, "EXC-CER-05", mine[0]?.reference ?? ref, { decision: ref, from: period.from }, at);
    return;
  }
  openPending(key, world, ref, premises, holder, period, at, null);
}

// ================================================================== re-decided obligations (DR-435)

/** The record an issued decision governs now, if any. */
function recordGovernedBy(world: World, decision: string): RecordRow | null {
  return world.records.find((record) => record.periods.length > 0 && governingPeriod(record)?.decision === decision) ?? null;
}

interface RuleAnswer {
  outcome: FollowUpOutcome;
  unmet: IssueCondition | null;
}

/** `DR-435`, now: what the follow-up does to the record so that it matches the decision in force. */
function ruleFor(key: string, world: World, followUp: FollowUpRecord): RuleAnswer {
  const record = byId(world, followUp.record);
  const facts = decisionFacts(key, world, followUp.decision);
  const governed = record !== null ? governingPeriod(record) : null;
  if (facts === null || governed === null) return { outcome: "AMEND", unmet: null };
  // Row 2: every condition of DR-430 for the new decision, when the follow-up is applied.
  const unmet = unmetConditions(key, world, followUp.decision, later(followUp.dueBy, now()))[0];
  if (unmet !== undefined) return { outcome: "END_AT_EFFECTIVE_DATE", unmet };
  const samePeriod = facts.period.from === governed.from && facts.period.to === governed.to;
  return { outcome: samePeriod ? "NO_CHANGE_NEEDED" : "AMEND", unmet: null };
}

/**
 * Applies a follow-up's outcome: a period of the new decision (or, when its conditions do not hold, of the old one
 * cut the day before the new one takes effect), in force from the later of the due instant and `at` (`FR-CER-027`),
 * and the expiry request of the lapse it moves.
 */
function applyFollowUp(key: string, world: World, followUp: FollowUpRecord, outcome: FollowUpOutcome, at: string, by: string | null, reason: Written | null): string {
  const record = byId(world, followUp.record);
  const inForceFrom = later(followUp.dueBy, at);
  if (record !== null) {
    const governed = governingPeriod(record, inForceFrom);
    const facts = decisionFacts(key, world, followUp.decision);
    if (governed !== null) governed.governedTo = inForceFrom;
    if (outcome === "END_AT_EFFECTIVE_DATE" && governed !== null) {
      record.periods.push({ ...governed, to: addDays(followUp.dueBy, -1), governedFrom: inForceFrom, governedTo: null, cause: "END", followUp: followUp.reference, recordedAt: at, follows: null, renews: null });
    } else if (facts !== null) {
      record.periods.push({
        decision: followUp.decision,
        from: facts.period.from,
        to: facts.period.to,
        governedFrom: inForceFrom,
        governedTo: null,
        cause: outcome === "NO_CHANGE_NEEDED" ? "NO_CHANGE" : "AMENDMENT",
        followUp: followUp.reference,
        recordedAt: at,
        follows: null,
        renews: null,
      });
    }
    requestExpiry(key, world, record, at);
  }
  followUp.state = "APPLIED";
  followUp.applied = { outcome, at, by, reason, inForceFrom };
  return inForceFrom;
}

// ================================================================== what no one decides (ALG-411)

/** The cause and authority of a change the read derives, from the answers either side of it. */
function automaticChange(record: RecordRow, x: string, before: RecordStatus, answer: RecordStatus): Pick<ChangeRow, "cause" | "authority"> {
  if (answer === "EXPIRING") {
    const lapse = nextLapse(record, x);
    const expiring = lapse !== null ? expiringFor(record, lapse) : null;
    return {
      cause: "EXPIRY_NOTICE_DUE",
      authority: { kind: "NOTICE", notice: expiring?.request?.notice ?? null, dueAt: expiring?.request?.dueAt ?? null, fallback: expiring?.fallback ?? true },
    };
  }
  if (answer === "EXPIRED") return { cause: "LAPSE", authority: { kind: "PERIOD", decision: governingAmong(record.periods, justBefore(x))?.decision ?? null } };
  return { cause: before === "EXPIRED" ? "PERIOD_IN_FORCE" : "RENEWAL", authority: { kind: "PERIOD", decision: governing(record, x)?.decision ?? null } };
}

/**
 * Records, for the history and the notices, each change every read had already answered with no decision behind it -
 * an entry into the expiring state, a lapse, a renewal or a period come into force - at the instant it took effect;
 * and, right after a decided change the read masks, the change that masks it (`DR-438`). Then the expiry of the next
 * lapse is requested where it was not.
 */
function advance(key: string, world: World, record: RecordRow, at: string): void {
  if (record.issued === null || time(at) <= time(record.historyTo)) return;
  const from = record.historyTo;
  for (const x of candidates(record).filter((instant) => time(instant) > time(from) && time(instant) <= time(at))) {
    const answer = statusOf(record, x);
    if (record.changes.some((change) => time(change.effectiveAt) === time(x) && change.to === answer)) continue;
    const decidedHere = record.changes.filter((change) => decided(change) && time(change.effectiveAt) === time(x)).at(-1);
    const before = decidedHere !== undefined ? decidedHere.to : statusOf(record, justBefore(x));
    if (before === answer) continue;
    const change: ChangeRow = { ...newChange(before, answer, x, "LAPSE", { kind: "PERIOD", decision: null }), recordedAt: at, ...automaticChange(record, x, before, answer) };
    const after = record.changes.findIndex((entry) => time(entry.effectiveAt) > time(x));
    record.changes.splice(after === -1 ? record.changes.length : after, 0, change);
    // The entry into the expiring state rests on the expiry notice already raised; every other change is noticed to the holder.
    if (change.cause !== "EXPIRY_NOTICE_DUE") {
      change.noticeRef = notify(key, world, record, "status_record_changed", `${record.reference ?? record.id}/${change.cause}/${dayOf(x)}`, at, changeFacts(change));
      change.notice = change.noticeRef !== null;
    }
  }
  record.historyTo = at;
  if (!TERMINAL.includes(statusOf(record, at))) requestExpiry(key, world, record, at);
}

// ================================================================== what REG and FIN did since the last read

/**
 * What the API does on REG's and FIN's events, done here when this family is read: a decision REG recorded is placed
 * (`DR-432`), or, where it re-decides one a record rests on, opens a follow-up of it or becomes the basis of what
 * waits for it; a fee FIN reconciled assesses the record or renewal that waits for it, which issues or adds its
 * period if nothing else waits; a follow-up whose due instant has come is applied by RightOne itself unless it could
 * not read the decision; one not applied by then is raised to the certificate authority; and the changes no one
 * decides are recorded.
 */
function sync(key: string, world: World): void {
  const at = now();
  for (const ref of [...decisionReferences(key)].reverse()) {
    if (world.seen.has(ref)) continue;
    world.seen.add(ref);
    const decision = decisionForCollection(key, ref);
    if (decision === null || decision.summary.status !== "CURRENT") continue;
    const opened = decision.record.issuedAt;
    const replaced = decision.summary.replaces;
    if (replaced !== null) {
      const governed = recordGovernedBy(world, replaced);
      if (governed !== null) {
        world.followUps.push({
          reference: reference("CFU"),
          record: governed.id,
          decision: ref,
          superseded: replaced,
          change: null,
          dueBy: startOf(decision.summary.period.from),
          state: "OPEN",
          decisionUnreadable: false,
          applied: null,
          lateWhy: null,
        });
        continue;
      }
      // A re-decision of what still waits becomes its basis; an amendment never opens a record of its own (AC-FR-CER-017-06).
      const waiting = world.records.find((record) => (record.issued === null && record.decision === replaced) || waitingRenewal(record)?.decision === replaced);
      if (waiting !== undefined) rebase(key, world, waiting, ref, decision.summary.period, opened);
      continue;
    }
    // A renewal names the decision it renews (`prior`): its record's premises is the renewal's where the boards
    // name the premises no other way, so the period lands on the record the premises already holds (FR-CER-010).
    const prior = decision.record.prior ?? null;
    const known = REGISTRATION_PREMISES[decision.summary.premises.id];
    const renewed = prior !== null ? world.records.find((record) => record.issued !== null && holdsDecision(record, prior)) : undefined;
    const premises: SeedPremises =
      known !== undefined
        ? CER_PREMISES[known]
        : (renewed?.premises ?? { register: null, name: decision.summary.premises.name, ward: null, holder: CER_PREMISES.pasteur.holder, premisesClass: null, closing: null });
    place(key, world, ref, premises, decision.summary.period, opened, prior);
  }

  for (const record of world.records) {
    const renewal = waitingRenewal(record);
    const kind = statusOf(record, at) === "PENDING_ISSUE" ? "ISSUE" : renewal !== null ? "RENEWAL" : null;
    if (kind === null) continue;
    const latest = [...record.assessments].reverse().find((assessment) => assessment.kind === kind);
    if (latest === undefined || !latest.unmet.some((condition) => PAYMENT_CONDITIONS.includes(condition))) continue;
    const facts = decisionFacts(key, world, kind === "ISSUE" ? record.decision : (renewal?.decision ?? null));
    if (facts === null || facts.payment !== "RECONCILED_IN_FULL" || facts.paid === null) continue;
    const assessment = assess(key, world, record, later(facts.paid.at, latest.at), "PAYMENT_RECONCILED", kind);
    if (assessment.unmet.length > 0 || assessment.route !== "STRAIGHT_THROUGH") continue;
    if (kind === "RENEWAL") addRenewalPeriod(key, world, record, assessment.at);
    else if (!predecessorEnded(world, record)) issue(key, world, record, assessment.at, "STRAIGHT_THROUGH", null);
  }

  for (const followUp of world.followUps) {
    if (followUp.state !== "OPEN" || followUp.decisionUnreadable || time(followUp.dueBy) > time(at)) continue;
    const rule = ruleFor(key, world, followUp);
    if (rule.outcome !== "REPLACE") applyFollowUp(key, world, followUp, rule.outcome, followUp.dueBy, null, null);
  }
  // FR-CER-026: a consequence not recorded by its due instant is raised to the certificate authority, once.
  for (const followUp of world.followUps) {
    const late = followUp.state === "OPEN" ? time(followUp.dueBy) < time(at) : lateness(followUp) !== null;
    if (!late || world.exceptions.some((entry) => entry.code === "EXC-CER-04" && entry.detail.followUp === followUp.reference)) continue;
    const record = byId(world, followUp.record);
    raiseException(world, "EXC-CER-04", record?.reference ?? followUp.record, { followUp: followUp.reference, decision: followUp.decision ?? "", dueBy: followUp.dueBy }, at);
  }

  for (const record of world.records) advance(key, world, record, at);
}

// ================================================================== SCR-CER-11 to 13: the holder's records

/** The holder's state of an issued record; a pending one is no record to its holder yet. */
const holderState = (record: RecordRow): HolderState | null => HOLDER_STATES[statusOf(record)];

/** The REG premises id of a record's premises, where REG knows the premises. */
const registrationIdOf = (premises: SeedPremises) => Object.entries(REGISTRATION_PREMISES).find(([, entry]) => samePremises(CER_PREMISES[entry], premises))?.[0] ?? null;

/** The id PTY is asked about a record's premises by: its register record, or REG's id where the boards name no record. */
const premisesIdOf = (premises: SeedPremises) => premises.register ?? registrationIdOf(premises);

/** The permission entries of the premises actor's acts (`frd/09-permission-entries.md`), which PTY's scopes cover. */
type HolderPermission = "PERM-770" | "PERM-771" | "PERM-775" | "PERM-776";

/**
 * `SEC-434`: a premises actor reads or prints a record only of a premises PTY answers they may act for, at this
 * instant and with the act's permission (`mayActFor`, DR-201: a delegate within her delegation only), and only one
 * its party holds now. A premises neither the register nor REG names is the holding party's alone.
 */
function actsForRecord(key: string, party: string, record: RecordRow, permission: HolderPermission): boolean {
  if (record.holder !== party) return false;
  const id = premisesIdOf(record.premises);
  return id === null || mayActFor(key, id, permission);
}

/** A record its holder reads by its key: an issued record by reference, or a pending one by the decision it waits under. */
function holderFind(world: World, ref: string): RecordRow | null {
  const issued = world.records.find((entry) => entry.reference === ref && holderState(entry) !== null);
  if (issued !== undefined) return issued;
  return world.records.find((entry) => entry.issued === null && entry.decision === ref && statusOf(entry) === "PENDING_ISSUE") ?? null;
}

/**
 * A record of `party` by its key: CERTIFICATE_NOT_FOUND where no record carries it, then NOT_AUTHORISED_FOR_PREMISES
 * where it is another holder's or of a premises the person may not act for with the permission.
 */
function holderRecord(key: string, world: World, party: string, ref: string, permission: HolderPermission): RecordRow | Refusal {
  const record = holderFind(world, ref);
  if (record === null) return refused("CERTIFICATE_NOT_FOUND");
  if (!actsForRecord(key, party, record, permission)) return refused("NOT_AUTHORISED_FOR_PREMISES");
  return record;
}

const isRefusal = (value: RecordRow | Refusal): value is Refusal => "failure" in value;

/** Why a record stands as it does, for its holder: the last decided change's ground, reason, condition, remedy and appeal. */
function standingOf(record: RecordRow): StatusRecordPage["record"]["standing"] {
  const status = statusOf(record);
  const change = standingAt(record, now());
  const kind = change?.to === "SUSPENDED" ? "suspended" : change?.to === "REVOKED" ? "revoked" : change?.to === "CANCELLED" ? "cancelled" : null;
  // A suspension still stands under a lapse: the holder reads its ground and condition beside the expiry.
  if (kind === null || change === undefined || (status !== "SUSPENDED" && status !== "REVOKED" && status !== "CANCELLED" && status !== "EXPIRED")) return null;
  return { kind, ground: change.ground, reason: change.reason, condition: change.condition, appealBy: change.appealBy, remedy: change.remedy };
}

/** One row of a holder's list; `spans` names the premises of each row in a list of several premises. */
function summaryOf(record: RecordRow, spans: boolean): PremisesStatusRecords["records"][number] {
  const period = shownPeriod(record) ?? { from: "", to: "" };
  const amended = [...record.periods].reverse().find((entry) => entry.cause === "AMENDMENT");
  return {
    reference: record.reference ?? "",
    premises: spans ? record.premises.name : null,
    state: holderState(record) ?? "active",
    since: sinceOf(record),
    from: period.from,
    to: period.to,
    followsChangeOn: amended !== undefined ? amended.from : null,
  };
}

/**
 * What a pending record waits on, as its holder reads it: every condition its latest assessment found unmet. An
 * approval wait or a decline is the staff's (`Q-CER-13`), so a record whose conditions all hold says none.
 */
const holderWaitingOn = (record: RecordRow): IssueCondition[] => [...(latestAssessment(record, "ISSUE")?.assessment.unmet ?? [])];

function pendingSummaryOf(record: RecordRow): PendingRecordSummary {
  const period = record.pendingPeriod ?? { from: "", to: "" };
  return { key: keyOf(record), since: record.opened.at, from: period.from, to: period.to, waitingOn: holderWaitingOn(record) };
}

/**
 * Every issued record `party` holds, the latest change of status first, each row naming its premises: what PTY's
 * party pages read (`parties.ts`). The premises portal reads one premises' records instead (`premisesStatusRecords`).
 */
export function listCertificates(key: string, party: string): LoadOutcome<PremisesStatusRecords> {
  const world = worldOf(key);
  const records = world.records
    .filter((record) => record.holder === party && holderState(record) !== null && record.reference !== null)
    .map((record) => summaryOf(record, true))
    .sort((a, b) => time(b.since) - time(a.since));
  return ok({ premises: null, premisesId: null, register: null, party, asOf: now(), records, pending: [], nextCursor: null });
}

const HOLDER_PAGE = 25;

/**
 * The premises a premises actor names, by REG's id or its register record: the boards' premises, or one PTY answers
 * the person may list records of that the boards hold no record for (with none, nothing of it is known here).
 */
function holderPremisesOf(key: string, asked: string): { id: string; premises: SeedPremises } | null {
  const named = asked.trim();
  const byId = REGISTRATION_PREMISES[named];
  if (byId !== undefined) return { id: named, premises: CER_PREMISES[byId] };
  const byRecord = Object.values(CER_PREMISES).find((premises) => premises.register !== null && premises.register === named.toUpperCase());
  if (byRecord !== undefined) return { id: registrationIdOf(byRecord) ?? named, premises: byRecord };
  const actable = premisesActableBy(key, "PERM-770").find((premises) => premises.record === named.toUpperCase() || premises.ids.includes(named));
  return actable !== undefined
    ? { id: named, premises: { register: actable.record, name: actable.name, ward: null, holder: actable.party, premisesClass: null, closing: null } }
    : null;
}

/**
 * GET /certificates for a premises actor (SCR-CER-11): the records `party` holds of one premises it acts for, the
 * latest change of status first, 25 a page, and those still waiting to issue, in the contract's order of refusals:
 * no premises named is PREMISES_FILTER_REQUIRED, a premises PTY does not answer the person may list records of
 * (`PERM-770`) NOT_AUTHORISED_FOR_PREMISES, a cursor of another premises CURSOR_INVALID. `premisesId` is the premises
 * as the portal names it, REG's id or its register record.
 */
export function premisesStatusRecords(key: string, party: string, premisesId: string | null, cursor: string | null): LoadOutcome<PremisesStatusRecords> {
  if (premisesId === null || premisesId.trim() === "") return refused("PREMISES_FILTER_REQUIRED");
  const found = holderPremisesOf(key, premisesId);
  const asked = found !== null ? premisesIdOf(found.premises) : null;
  if (found === null || asked === null || !mayActFor(key, asked, "PERM-770")) return refused("NOT_AUTHORISED_FOR_PREMISES");
  const filter = { holderPremises: found.id };
  const offset = cursor === null ? 0 : offsetFrom(cursor, filter);
  if (offset === null) return refused("CURSOR_INVALID");
  const world = worldOf(key);
  const ofPremises = world.records.filter((record) => samePremises(record.premises, found.premises) && record.holder === party);
  const rows = ofPremises
    .filter((record) => holderState(record) !== null && record.reference !== null)
    .map((record) => ({ id: record.id, row: summaryOf(record, false) }))
    .sort((a, b) => time(b.row.since) - time(a.row.since) || a.id.localeCompare(b.id))
    .map(({ row }) => row);
  const pending = ofPremises
    .filter((record) => record.issued === null && statusOf(record) === "PENDING_ISSUE")
    .map(pendingSummaryOf)
    .sort((a, b) => time(b.since) - time(a.since) || a.key.localeCompare(b.key));
  return ok({
    premises: found.premises.name,
    premisesId: found.id,
    register: found.premises.register,
    party,
    asOf: now(),
    records: rows.slice(offset, offset + HOLDER_PAGE),
    pending: offset === 0 ? pending : [],
    nextCursor: offset + HOLDER_PAGE < rows.length ? cursorOf(offset + HOLDER_PAGE, filter) : null,
  });
}

/**
 * The premises SCR-CER-11 offers when its address names none: those PTY answers the signed-in person may list the
 * records of now (`PERM-770`), a delegate's within her delegation, each by the id the portal names it with.
 */
export function holderPremises(key: string): readonly HolderPremises[] {
  return premisesActableBy(key, "PERM-770")
    .map((premises) => ({ id: premises.ids.find((id) => REGISTRATION_PREMISES[id] !== undefined) ?? premises.record, name: premises.name, register: premises.record }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

const printoutSummary = (made: PrintoutRow): PrintoutSummary => ({ reference: made.reference, printedAt: made.printedAt, stateWhenPrinted: made.stateWhenPrinted, signingKey: made.signingKey });

/**
 * GET /certificates/{id} for the holder (`PERM-771`): the record with its printouts, or a record still waiting to issue
 * with every condition it waits on (`AC-FR-CER-001-02`); CERTIFICATE_NOT_FOUND, then NOT_AUTHORISED_FOR_PREMISES.
 */
export function getCertificate(key: string, party: string, ref: string): LoadOutcome<StatusRecordPage> {
  const world = worldOf(key);
  const record = holderRecord(key, world, party, ref, "PERM-771");
  if (isRefusal(record)) return record;
  const pending = record.reference === null;
  const governed = pending ? null : governingPeriod(record);
  const earlier = record.periods.filter((period) => period !== governed && period.cause !== "END" && time(period.governedFrom) <= time(now()));
  const period = governed !== null ? { from: governed.from, to: governed.to, decision: governed.decision } : { ...(record.pendingPeriod ?? { from: "", to: "" }), decision: record.decision };
  return ok({
    record: {
      reference: record.reference,
      key: keyOf(record),
      premises: record.premises.name,
      premisesId: registrationIdOf(record.premises) ?? record.premises.register,
      holder: record.holder,
      state: pending ? "pending" : (holderState(record) ?? "active"),
      waitingOn: pending ? holderWaitingOn(record) : [],
      since: sinceOf(record),
      current: !pending && isCurrent(record),
      period,
      earlierPeriods: earlier.map((entry) => ({ from: entry.from, to: entry.to, decision: entry.decision })).reverse(),
      standing: standingOf(record),
      premisesClass: record.premises.premisesClass,
      printouts: record.printouts.map(printoutSummary),
      definition: definitionView(record.definition),
    },
    printAnswer: null,
    printoutRefusal: null,
  });
}

/**
 * GET /certificates/{id}/representations/{ref}/document: the sheet of one printout as it was printed, or the
 * record's latest when none is named, with the code it carries. A holder opens their own records' printouts
 * (REPRESENTATION_NOT_FOUND, then NOT_AUTHORISED_FOR_PREMISES, `PERM-776`); staff (`party` null) any.
 */
export function getRepresentationDocument(key: string, party: string | null, ref: string, printoutRef: string | null): LoadOutcome<StatusRecordPrintout> {
  const world = worldOf(key);
  const record = world.records.find((entry) => entry.reference === ref) ?? null;
  const made = printoutRef === null ? record?.printouts[0] : record?.printouts.find((entry) => entry.reference === printoutRef);
  if (record === null || made === undefined || record.reference === null) return refused("REPRESENTATION_NOT_FOUND");
  if (party !== null && !actsForRecord(key, party, record, "PERM-776")) return refused("NOT_AUTHORISED_FOR_PREMISES");
  // The sheet states the period that governed when it was printed.
  const period = governingPeriod(record, made.printedAt) ?? governingPeriod(record);
  return ok({
    record: record.reference,
    premises: record.premises.name,
    address: record.sheet.address,
    operator: record.sheet.operator,
    period: { from: period?.from ?? "", to: period?.to ?? "" },
    decision: period?.decision ?? null,
    premisesClass: record.premises.premisesClass,
    stateWhenPrinted: made.stateWhenPrinted,
    printedAt: made.printedAt,
    printout: made.reference,
    signingKey: made.signingKey,
    verifyUrl: `${VERIFY_BASE}${record.reference}`,
    code: made.code,
    definition: definitionView(record.definition),
  });
}

/** The key that signs at `at`: an active key whose start has come, the latest started first. */
function signingKeyAt(world: World, at: string): KeyRecord | null {
  const signing = world.keys.filter((entry) => entry.state === "ACTIVE" && time(entry.validFrom) <= time(at));
  return signing.sort((a, b) => time(b.validFrom) - time(a.validFrom))[0] ?? null;
}

/** `ALG-407` step 2: a payload's canonical form, keys sorted, no whitespace, UTF-8. */
const canonicalOf = (payload: Readonly<Record<string, string | number | null>>) =>
  JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map((name) => [name, payload[name] ?? null])));

/** The scope a period's payload names: every rights layer, as every record the boards draw covers all three. */
const SCOPE_CODE = "ALL-3";

/**
 * `ALG-407`: the payload of a printout, version 1 (`signedCodeOf` names its fields), signed ES256 by the key service
 * with the key that signs at the instant printed; and the code printed: the verification route with the printout,
 * the payload and the signature, which a verifier holding the published key checks with no call to RightOne.
 */
function signedPrintout(record: RecordRow, rep: string, at: string, kid: string): PrintoutRow {
  const period = governingPeriod(record, at);
  const body = {
    v: 1,
    ref: record.reference ?? "",
    rep,
    kid,
    iat: at,
    st: statusOf(record, at),
    from: period?.from ?? null,
    to: period?.to ?? null,
    pn: record.premises.name,
    iss: record.definition?.issuerCode ?? null,
    sc: SCOPE_CODE,
  };
  const bytes = Buffer.from(canonicalOf(body), "utf8");
  const payload = bytes.toString("base64url");
  const signature = sign("sha256", bytes, { key: keyPairOf(kid).privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return { reference: rep, printedAt: at, stateWhenPrinted: "active", signingKey: kid, payload, signature, code: `${VERIFY_BASE}${body.ref}?r=${rep}&p=${payload}&s=${signature}` };
}

/**
 * POST /certificates/{id}/representations (FR-CER-005, FR-CER-021): a printout of the record's status now, its
 * payload signed with the key that signs at this instant. The contract's order: CERTIFICATE_NOT_FOUND, then
 * NOT_AUTHORISED_FOR_PREMISES for a holder, RECORD_NOT_CURRENT, and SIGNING_UNAVAILABLE with no key that signs, when
 * nothing unsigned is recorded. The holder prints their own records, where PTY answers they may (`PERM-775`, a
 * delegate within her delegation); an operations officer (`party` null) any.
 */
export function createRepresentation(key: string, party: string | null, ref: string): LoadOutcome<{ printout: string; record: string }> {
  const world = worldOf(key);
  const record = world.records.find((entry) => entry.reference === ref) ?? null;
  if (record === null || record.reference === null || holderState(record) === null) return refused("CERTIFICATE_NOT_FOUND");
  if (party !== null && !actsForRecord(key, party, record, "PERM-775")) return refused("NOT_AUTHORISED_FOR_PREMISES");
  if (!isCurrent(record)) return refused("RECORD_NOT_CURRENT");
  const at = now();
  const signer = signingKeyAt(world, at);
  if (signer === null) return refused("SIGNING_UNAVAILABLE", true);
  const made = signedPrintout(record, reference("CRP"), at, signer.kid);
  record.printouts.unshift(made);
  signer.signed += 1;
  return ok({ printout: made.reference, record: record.reference });
}

// ================================================================== SCR-CER-01 Status records

const PAGE_SIZE = 25;

/** What waits to be issued or added: a pending record's issue, or a renewal of an issued one; null for neither. */
function waitingKind(record: RecordRow): AssessmentRow["kind"] | null {
  if (statusOf(record) === "PENDING_ISSUE") return "ISSUE";
  return waitingRenewal(record) !== null ? "RENEWAL" : null;
}

/** The latest assessment of a kind (by default of what waits), and whether an approver has answered it. */
function latestAssessment(record: RecordRow, kind: AssessmentRow["kind"] = waitingKind(record) ?? "ISSUE"): { assessment: AssessmentRow; index: number; decided: IssueDecisionRow | null } | null {
  const index = lastIndexWhere(record.assessments, (assessment) => assessment.kind === kind);
  const assessment = record.assessments[index];
  if (assessment === undefined) return null;
  return { assessment, index, decided: record.issueDecisions.find((decision) => decision.assessment === index) ?? null };
}

/** The latest assessment of what waits, of the decision it now rests on, waits for an approver and nobody has answered it. */
function awaitsApprover(record: RecordRow): boolean {
  const kind = waitingKind(record);
  if (kind === null) return false;
  const latest = latestAssessment(record, kind);
  const decision = kind === "ISSUE" ? record.decision : (waitingRenewal(record)?.decision ?? null);
  return (
    latest !== null &&
    latest.decided === null &&
    latest.assessment.decision === decision &&
    latest.assessment.unmet.length === 0 &&
    latest.assessment.route !== null &&
    latest.assessment.route !== "STRAIGHT_THROUGH"
  );
}

function waitingOn(record: RecordRow): WaitingOn | null {
  const kind = waitingKind(record);
  if (kind === null) return null;
  const latest = latestAssessment(record, kind);
  if (latest === null) return null;
  const condition = latest.assessment.unmet[0];
  if (condition !== undefined) return { kind: "condition", condition };
  if (latest.decided?.outcome === "DECLINE") return { kind: "declined" };
  const route = latest.assessment.route;
  return route !== null && route !== "STRAIGHT_THROUGH" ? { kind: "approver", reason: route } : null;
}

function counts(world: World): ConsoleRecordList["counts"] {
  return {
    reviews: world.reviews.filter((review) => review.state === "OPEN" || review.state === "PROPOSED").length,
    followUps: world.followUps.filter((followUp) => followUp.state === "OPEN").length,
  };
}

const filterKey = (filter: unknown) => JSON.stringify(filter);

/** An opaque cursor: where the next page starts, for this list and filter only. */
const cursorOf = (offset: number, filter: unknown) => Buffer.from(JSON.stringify({ o: offset, f: filterKey(filter) })).toString("base64url");

function offsetFrom(cursor: string, filter: unknown): number | null {
  try {
    const read = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown; f?: unknown };
    return typeof read.o === "number" && Number.isInteger(read.o) && read.o >= 0 && read.f === filterKey(filter) ? read.o : null;
  } catch {
    return null;
  }
}

/**
 * GET /certificates for staff: every record, the latest status change first, by status, premises and whether it
 * waits - to issue, or to add a renewal's period. The holder's name is never in this list (convention 5).
 */
export function consoleRecordList(key: string, filter: RecordFilter, cursor: string | null): LoadOutcome<ConsoleRecordList> {
  const world = worldOf(key);
  const offset = cursor === null ? 0 : offsetFrom(cursor, filter);
  if (offset === null) return refused("CURSOR_INVALID");
  // The record's id only breaks a tie in the order; it is no part of the row.
  const rows: ConsoleRecordRow[] = world.records
    .filter((record) => !filter.waiting || waitingKind(record) !== null)
    .map((record) => ({
      id: record.id,
      row: {
        key: keyOf(record),
        reference: record.reference,
        premises: { name: record.premises.name, register: record.premises.register },
        status: statusOf(record),
        since: sinceOf(record),
        period: shownPeriod(record),
        waitingOn: waitingOn(record),
        awaitsApprover: awaitsApprover(record),
      },
    }))
    .sort((a, b) => time(b.row.since) - time(a.row.since) || a.id.localeCompare(b.id))
    .map(({ row }) => row)
    .filter((row) => filter.status === null || row.status === filter.status)
    .filter((row) => filter.premises === null || row.premises.register === filter.premises);
  const premises = new Map<string, { value: string; label: string; detail: string | null }>();
  for (const record of world.records) {
    if (record.premises.register !== null) premises.set(record.premises.register, { value: record.premises.register, label: record.premises.name, detail: record.premises.register });
  }
  const page = rows.slice(offset, offset + PAGE_SIZE);
  return ok({
    asOf: now(),
    filter,
    premisesOptions: [...premises.values()].sort((a, b) => a.label.localeCompare(b.label, "vi")),
    rows: page,
    nextCursor: offset + PAGE_SIZE < rows.length ? cursorOf(offset + PAGE_SIZE, filter) : null,
    offset,
    total: rows.length,
    counts: counts(world),
  });
}

// ================================================================== SCR-CER-02 Status record

function proposalOf(step: ProposalStep): Proposal {
  const policy = policyAt(step.at);
  return {
    act: step.act,
    statusWhenProposed: step.statusWhenProposed,
    ground: step.ground,
    condition: step.ground !== null ? (policy?.grounds.find((ground) => ground.code === step.ground)?.condition ?? null) : null,
    reason: step.reason ?? "",
    evidence: [...step.evidence],
    effectiveAt: step.effectiveAt,
    conditionsAddressed: [...step.conditions],
    proposer: step.by ?? { name: "", position: "", at: step.at },
    policyVersion: step.policyVersion,
  };
}

/** A review's latest proposal and the decision on it, if any; an event that joined the review is neither. */
function latestSteps(review: ReviewRecord): { proposal: ProposalStep | null; decision: DecisionStep | null } {
  let proposal: ProposalStep | null = null;
  let decision: DecisionStep | null = null;
  for (const step of review.steps) {
    if (step.kind === "PROPOSAL") {
      proposal = step;
      decision = null;
    } else if (step.kind === "DECISION") {
      decision = step;
    }
  }
  return { proposal, decision };
}

function openReviewOf(world: World, record: RecordRow): ReviewRecord | null {
  return world.reviews.find((review) => review.record === record.id && (review.state === "OPEN" || review.state === "PROPOSED")) ?? null;
}

function lastChangeOf(world: World, record: RecordRow): LastChange {
  const change = record.changes.at(-1);
  if (change === undefined) return { kind: "opened", decision: record.decision ?? "", at: record.opened.at };
  if (change.cause === "EXPIRY_NOTICE_DUE" || change.cause === "LAPSE" || change.cause === "RENEWAL" || change.cause === "PERIOD_IN_FORCE") {
    return {
      kind: "automatic",
      cause: change.cause,
      to: change.to,
      at: change.effectiveAt,
      notice: change.authority.kind === "NOTICE" ? change.authority.notice : change.noticeRef,
      decision: change.authority.kind === "PERIOD" ? change.authority.decision : null,
    };
  }
  if (change.to === "REPLACED") {
    const successor = byId(world, record.successor);
    const approval = successor?.issueDecisions.filter((decision) => decision.outcome === "APPROVE").at(-1);
    return { kind: "replaced", at: change.effectiveAt, successor: successor?.reference ?? "", holder: successor?.holder ?? "", approver: approval?.by ?? null };
  }
  if (change.to === "SUSPENDED" || change.to === "REINSTATED" || change.to === "REVOKED" || change.to === "CANCELLED") {
    const authority = change.authority.kind === "REVIEW" ? change.authority : null;
    return {
      kind: "status",
      to: change.to,
      effectiveAt: change.effectiveAt,
      ground: change.ground,
      condition: change.condition,
      reason: change.reason,
      evidence: [...change.evidence],
      appealBy: change.appealBy,
      noticeRaised: change.notice,
      review: authority?.review ?? null,
      proposer: authority?.proposer ?? null,
      approver: authority?.approver ?? null,
      comment: authority?.comment ?? null,
      policyVersion: change.policyVersion,
      remedy: change.remedy,
      notice: change.noticeRef,
    };
  }
  return { kind: "issued", at: change.effectiveAt, route: record.issued?.route ?? null };
}

function assessmentView(record: RecordRow, kind?: AssessmentRow["kind"]): AssessmentView | null {
  const latest = latestAssessment(record, kind);
  if (latest === null) return null;
  return {
    kind: latest.assessment.kind,
    decision: latest.assessment.decision,
    at: latest.assessment.at,
    trigger: latest.assessment.trigger,
    unmet: [...latest.assessment.unmet],
    route: latest.assessment.route,
    decided: latest.decided !== null ? { outcome: latest.decided.outcome, by: latest.decided.by, at: latest.decided.at } : null,
  };
}

function feeOf(key: string, world: World, decision: string | null): ConsoleRecord["fee"] {
  const facts = decisionFacts(key, world, decision);
  if (facts === null || facts.outcome !== "PAYABLE" || facts.feeMinor === null) return null;
  return { amountMinor: facts.feeMinor, paid: facts.payment === "RECONCILED_IN_FULL" ? facts.paid : null, payBy: facts.payBy };
}

/** GET /certificates/{id} for staff: the record as the officer needs it, with its open review (finding F-2) and a renewal that waits. */
export function consoleRecord(key: string, ref: string): LoadOutcome<ConsoleRecord> {
  const world = worldOf(key);
  const record = findRecord(world, ref);
  if (record === null) return refused("CERTIFICATE_NOT_FOUND");
  const status = statusOf(record);
  const review = openReviewOf(world, record);
  const current = isCurrent(record);
  const predecessor = byId(world, record.predecessor);
  const successor = byId(world, record.successor);
  const decision = decisionNow(record);
  const renewal = waitingRenewal(record);
  return ok({
    key: keyOf(record),
    asOf: now(),
    reference: record.reference,
    status,
    since: sinceOf(record),
    current,
    premises: { name: record.premises.name, register: record.premises.register, ward: record.premises.ward },
    holder: record.holder,
    period: shownPeriod(record),
    decision,
    fee: feeOf(key, world, decision),
    issued: record.issued,
    predecessor: predecessor !== null && predecessor.reference !== null ? { reference: predecessor.reference, holder: predecessor.holder } : null,
    successor: successor !== null && successor.reference !== null ? { reference: successor.reference, holder: successor.holder } : null,
    openReview:
      review !== null
        ? ({
            reference: review.reference,
            state: review.state === "PROPOSED" ? "PROPOSED" : "OPEN",
            trigger: review.trigger,
            openedAt: review.openedAt,
            proposal: review.state === "PROPOSED" ? (latestSteps(review).proposal !== null ? proposalOf(latestSteps(review).proposal as ProposalStep) : null) : null,
          } satisfies OpenReview)
        : null,
    lastChange: lastChangeOf(world, record),
    assessment: status === "PENDING_ISSUE" ? assessmentView(record, "ISSUE") : null,
    printouts: record.printouts.map((made) => ({ ...printoutSummary(made), stillTheStatus: current })),
    proposable: actsFrom(status).length > 0,
    definition: definitionView(record.definition),
    renewal:
      renewal !== null
        ? { decision: renewal.decision, period: renewal.period, openedAt: renewal.openedAt, fee: feeOf(key, world, renewal.decision), assessment: assessmentView(record, "RENEWAL") }
        : null,
  });
}

/**
 * POST /certificates/{id}/issue-assessments (ACT-OPS): assess a pending record now and issue it where `DR-431`
 * answers straight through. A record no longer pending is NOT_PENDING_ISSUE; one whose predecessor took another
 * successor is PREDECESSOR_ENDED, with nothing written.
 */
export function assessIssue(key: string, actor: Actor, ref: string): LoadOutcome<{ issued: string | null }> {
  if (!holds(actor, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const world = worldOf(key);
  const record = findRecord(world, ref);
  if (record === null) return refused("CERTIFICATE_NOT_FOUND");
  if (statusOf(record) !== "PENDING_ISSUE") return refused("NOT_PENDING_ISSUE");
  if (predecessorEnded(world, record)) return refused("PREDECESSOR_ENDED");
  const at = now();
  const assessment = assess(key, world, record, at, "OPERATOR_REQUEST");
  if (assessment.unmet.length === 0 && assessment.route === "STRAIGHT_THROUGH") {
    issue(key, world, record, at, "STRAIGHT_THROUGH", null);
    return ok({ issued: record.reference });
  }
  return ok({ issued: null });
}

// ================================================================== SCR-CER-03 Approve an issue

/**
 * GET /certificates/{id} as the approver reads an issue waiting for approval, or a renewal of an issued record: then
 * the decision, fee and period are the renewal's, and an approval adds its period to the record named.
 */
export function issueApproval(key: string, ref: string): LoadOutcome<IssueApproval> {
  const world = worldOf(key);
  const record = findRecord(world, ref);
  if (record === null) return refused("CERTIFICATE_NOT_FOUND");
  const pending = statusOf(record) === "PENDING_ISSUE";
  // A renewal: the one that waits, or else the latest added, so the page still shows the decision made on it.
  const renewal = pending ? null : (waitingRenewal(record) ?? record.renewals.filter((entry) => entry.addedAt !== null).at(-1) ?? null);
  const kind: AssessmentRow["kind"] = renewal !== null ? "RENEWAL" : "ISSUE";
  const latest = latestAssessment(record, kind);
  const decision = record.issueDecisions.at(-1) ?? null;
  // The decision shown is the one that answers the latest assessment: an approval writes its own assessment first.
  const answered = decision !== null && latest !== null && decision.assessment >= latest.index - (decision.outcome === "APPROVE" ? 1 : 0) ? decision : null;
  const predecessor = renewal === null ? byId(world, record.predecessor) : null;
  return ok({
    key: keyOf(record),
    premises: { name: record.premises.name, register: record.premises.register, ward: record.premises.ward },
    holder: record.holder,
    status: statusOf(record),
    reference: record.reference,
    pendingSince: renewal?.openedAt ?? record.opened.at,
    route: latest?.assessment.route ?? null,
    decision: renewal?.decision ?? record.decision ?? "",
    fee: feeOf(key, world, renewal?.decision ?? record.decision),
    period: renewal?.period ?? record.pendingPeriod ?? shownPeriod(record),
    predecessor: predecessor !== null && predecessor.reference !== null ? { reference: predecessor.reference, key: keyOf(predecessor), holder: predecessor.holder } : null,
    assessment: assessmentView(record, kind),
    decided: answered !== null ? { outcome: answered.outcome, by: answered.by, at: answered.at, evidence: [...answered.evidence], reason: answered.reason } : null,
    awaitsApprover: awaitsApprover(record),
    renewal: renewal !== null && record.reference !== null ? { record: record.reference } : null,
  });
}

/**
 * POST /certificates/{id}/issue-decisions (ACT-BIZ-APR). An approval assesses again (`DR-430`) and, with every
 * condition met, issues a pending record, replacing the record of the outgoing holder, or adds a renewal's period to
 * the holder's record (`ALG-405` step 6); a decline answers the assessment for good, and only a new assessment offers
 * it to an approver again.
 */
export function decideIssue(
  key: string,
  actor: Actor,
  ref: string,
  input: { decision: "APPROVE" | "DECLINE"; reason: string; evidence: readonly string[] },
): LoadOutcome<{ issued: string | null; renewed: Period | null }> & { unmet?: readonly IssueCondition[] } {
  const world = worldOf(key);
  const record = findRecord(world, ref);
  if (record === null) return refused("CERTIFICATE_NOT_FOUND");
  if (!holds(actor, "ACT-BIZ-APR")) return refused("NOT_AUTHORISED");
  if (!awaitsApprover(record)) return refused("ISSUE_NOT_AWAITING_APPROVAL");
  const reason = input.reason.trim();
  if (input.decision === "DECLINE" && reason === "") return refused("REASON_REQUIRED");
  const at = now();
  const kind = waitingKind(record) ?? "ISSUE";
  const evidence = input.evidence.map((item) => item.trim()).filter((item) => item !== "");
  const answered = lastIndexWhere(record.assessments, (assessment) => assessment.kind === kind);
  if (input.decision === "DECLINE") {
    record.issueDecisions.push({ at, by: actor.name, outcome: "DECLINE", evidence, reason, assessment: answered });
    return ok({ issued: null, renewed: null });
  }
  // An approval refused for an unmet condition writes the new assessment and nothing else.
  const assessment = assess(key, world, record, at, "APPROVAL", kind);
  if (assessment.unmet.length > 0) return { ...refused("ISSUE_CONDITIONS_NOT_MET"), unmet: [...assessment.unmet] };
  if (kind === "ISSUE" && predecessorEnded(world, record)) {
    record.assessments.pop();
    return refused("PREDECESSOR_ENDED");
  }
  record.issueDecisions.push({ at, by: actor.name, outcome: "APPROVE", evidence, reason: reason === "" ? null : reason, assessment: answered });
  if (kind === "RENEWAL") return ok({ issued: null, renewed: addRenewalPeriod(key, world, record, at) });
  issue(key, world, record, at, "APPROVED", actor.name);
  return ok({ issued: record.reference, renewed: null });
}

// ================================================================== SCR-CER-04 Status reviews

function reviewRow(world: World, review: ReviewRecord): ReviewRow {
  const record = byId(world, review.record);
  const { proposal, decision } = latestSteps(review);
  return {
    reference: review.reference,
    record: { key: record !== null ? keyOf(record) : review.record, reference: record?.reference ?? null },
    premises: record?.premises.name ?? "",
    trigger: review.trigger,
    state: review.state,
    openedAt: review.openedAt,
    closedAt: review.closedAt,
    proposal: proposal !== null && (review.state !== "OPEN" || decision === null) ? proposalOf(proposal) : null,
    approved: review.state === "APPROVED" && decision !== null ? { by: decision.by.name, at: decision.at } : null,
  };
}

const REVIEW_FILTERS: Readonly<Record<ReviewFilter, readonly ReviewState[]>> = {
  OPEN_PROPOSED: ["OPEN", "PROPOSED"],
  OPEN: ["OPEN"],
  PROPOSED: ["PROPOSED"],
  APPROVED: ["APPROVED"],
  SUPERSEDED: ["SUPERSEDED"],
  ALL: ["OPEN", "PROPOSED", "APPROVED", "SUPERSEDED"],
};

/** GET /status-reviews: the questions about a record's status, the longest open first, 25 a page. */
export function reviewList(key: string, filter: ReviewFilter, cursor: string | null = null): LoadOutcome<ReviewList> {
  const offset = cursor === null ? 0 : offsetFrom(cursor, { reviews: filter });
  if (offset === null) return refused("CURSOR_INVALID");
  const world = worldOf(key);
  const states = REVIEW_FILTERS[filter];
  const rows = world.reviews
    .filter((review) => states.includes(review.state))
    .sort((a, b) => time(a.openedAt) - time(b.openedAt) || a.reference.localeCompare(b.reference))
    .map((review) => reviewRow(world, review));
  return ok({
    asOf: now(),
    filter,
    rows: rows.slice(offset, offset + PAGE_SIZE),
    counts: counts(world),
    nextCursor: offset + PAGE_SIZE < rows.length ? cursorOf(offset + PAGE_SIZE, { reviews: filter }) : null,
    offset,
    total: rows.length,
  });
}

// ================================================================== SCR-CER-05 Propose a status change

const ENFORCEMENT: readonly StatusAct[] = ["SUSPEND", "REVOKE", "CANCEL"];
const ACTS: readonly StatusAct[] = ["NO_CHANGE", "SUSPEND", "REVOKE", "CANCEL", "REINSTATE"];

/** GET /certificates/{id} with the grounds of the policy in force, and GET /status-reviews/{id} when the proposal joins a review. */
export function proposalForm(key: string, ref: string, reviewRef: string | null): LoadOutcome<ProposalPage> {
  const world = worldOf(key);
  const record = findRecord(world, ref);
  if (record === null) return refused("CERTIFICATE_NOT_FOUND");
  const review = reviewRef !== null ? (world.reviews.find((entry) => entry.reference === reviewRef && entry.record === record.id) ?? null) : null;
  if (reviewRef !== null && review === null) return refused("REVIEW_NOT_FOUND");
  const at = now();
  const status = statusOf(record, at);
  const suspension = status === "SUSPENDED" ? standingAt(record, at) : undefined;
  const successor = byId(world, record.successor);
  const decision = decisionNow(record);
  const open = openReviewOf(world, record);
  const policy = policyAt(at);
  return ok({
    record: {
      key: keyOf(record),
      reference: record.reference,
      status,
      premises: record.premises.name,
      period: shownPeriod(record),
      fee: feeOf(key, world, decision),
      closing: record.premises.closing,
      successor: successor !== null && successor.reference !== null ? { reference: successor.reference, since: successor.issued?.at ?? successor.opened.at } : null,
    },
    review:
      review !== null
        ? {
            reference: review.reference,
            state: review.state,
            trigger: review.trigger,
            openedAt: review.openedAt,
            proposal: latestSteps(review).proposal !== null ? proposalOf(latestSteps(review).proposal as ProposalStep) : null,
          }
        : null,
    openReview: open !== null ? { reference: open.reference, state: open.state === "PROPOSED" ? "PROPOSED" : "OPEN", trigger: open.trigger } : null,
    // With no policy in force no ground can be named: only no change and a reinstatement can be proposed.
    acts: actsFrom(status).filter((act) => policy !== null || !ENFORCEMENT.includes(act)),
    policy: policy !== null ? { code: policy.code, version: policy.version, effective: policy.effective, grounds: policy.grounds } : null,
    policyUnreadable: false,
    conditions: suspension !== undefined && suspension.condition !== null ? [suspension.condition] : [],
  });
}

type ProposalField = "act" | "ground" | "reason" | "evidence" | "effective" | "conditions";

const fieldRefusal = (code: string, field: ProposalField | null, openReview?: string): Refusal & { field?: ProposalField; openReview?: string } => ({
  ...refused(code),
  ...(field !== null ? { field } : {}),
  ...(openReview !== undefined ? { openReview } : {}),
});

/**
 * POST /status-reviews (a review opened with this proposal) or POST /status-reviews/{id}/proposals (a proposal on a
 * review an event opened), ACT-OPS only, checked in the contract's order. `DR-40` reads the `CER-ENFORCEMENT` version
 * in force at the proposal (NO_ENFORCEMENT_POLICY where none is), and the proposal records it.
 */
export function proposeChange(key: string, actor: Actor, input: ProposalInput): LoadOutcome<{ review: string }> & { field?: ProposalField; openReview?: string } {
  if (!holds(actor, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const world = worldOf(key);
  const record = findRecord(world, input.record);
  let review: ReviewRecord | null = null;
  if (input.review !== null) {
    review = world.reviews.find((entry) => entry.reference === input.review) ?? null;
    if (review === null || record === null || review.record !== record.id) return refused("REVIEW_NOT_FOUND");
    if (review.state !== "OPEN") return refused("REVIEW_NOT_OPEN");
  } else {
    if (record === null) return refused("CERTIFICATE_UNKNOWN");
    const open = openReviewOf(world, record);
    if (open !== null) return fieldRefusal("REVIEW_ALREADY_OPEN", null, open.reference);
  }
  if (record === null) return refused("CERTIFICATE_UNKNOWN");
  const at = now();
  const act = ACTS.includes(input.act) ? input.act : "NO_CHANGE";
  const reason = input.reason.trim();
  const evidence = input.evidence.map((item) => item.trim()).filter((item) => item !== "");
  if (reason === "") return fieldRefusal("REASON_REQUIRED", "reason");
  if (act !== "NO_CHANGE" && evidence.length === 0) return fieldRefusal("EVIDENCE_REQUIRED", "evidence");
  if (input.effectiveAt === "invalid" || (input.effectiveAt !== null && time(input.effectiveAt) < time(at))) return fieldRefusal("EFFECTIVE_TIME_IN_PAST", "effective");
  const status = statusOf(record, at);
  if (!actsFrom(status).includes(act)) return fieldRefusal("ACTION_NOT_PERMITTED_FROM_STATUS", "act");
  const policy = policyAt(at);
  let ground: GroundCode | null = null;
  if (ENFORCEMENT.includes(act)) {
    // DR-40 rows 1 to 4, against the version in force at the proposal.
    if (policy === null) return fieldRefusal("NO_ENFORCEMENT_POLICY", null);
    const cited = (input.ground ?? "").trim();
    if (cited === "") return fieldRefusal("GROUND_REQUIRED", "ground");
    const listed = policy.grounds.find((entry) => entry.code === cited);
    if (listed === undefined) return fieldRefusal("GROUND_NOT_IN_POLICY", "ground");
    if (!listed.acts.includes(act)) return fieldRefusal("GROUND_NOT_FOR_ACTION", "ground");
    ground = listed.code;
  }
  const conditions: { condition: ConditionCode; howMet: string }[] = [];
  if (act === "REINSTATE") {
    const stated = standingAt(record, at)?.condition ?? null;
    if (stated !== null) {
      const howMet = input.conditions.find((entry) => entry.condition === stated)?.howMet.trim() ?? "";
      if (howMet === "") return fieldRefusal("REINSTATEMENT_CONDITIONS_NOT_ADDRESSED", "conditions");
      conditions.push({ condition: stated, howMet });
    }
  }
  const step: ProposalStep = {
    kind: "PROPOSAL",
    at,
    by: { name: actor.name, position: actor.position, at },
    act,
    statusWhenProposed: status,
    ground,
    reason,
    evidence,
    effectiveAt: input.effectiveAt,
    conditions,
    policyVersion: ENFORCEMENT.includes(act) ? (policy?.version ?? null) : null,
  };
  if (review === null) {
    review = { reference: reference("CSR"), record: record.id, trigger: { kind: "OFFICER" }, openedAt: at, state: "PROPOSED", closedAt: null, steps: [step] };
    world.reviews.push(review);
  } else {
    review.steps.push(step);
    review.state = "PROPOSED";
  }
  return ok({ review: review.reference });
}

// ================================================================== SCR-CER-06 Decide a status change

const DECIDED: Readonly<Record<StatusAct, "SUSPENDED" | "REINSTATED" | "REVOKED" | "CANCELLED" | null>> = {
  NO_CHANGE: null,
  SUSPEND: "SUSPENDED",
  REINSTATE: "REINSTATED",
  REVOKE: "REVOKED",
  CANCEL: "CANCELLED",
};

/**
 * What an approval of a proposal records now (`DR-40`, `DR-439`): the instant it takes effect, the condition, the
 * remedy with its closing date, and the `CER-ENFORCEMENT` version in force at the decision.
 */
function recordedOn(proposal: ProposalStep, at: string): NonNullable<ReviewPage["recorded"]> {
  const takesEffect = proposal.effectiveAt !== null ? later(proposal.effectiveAt, at) : at;
  const policy = ENFORCEMENT.includes(proposal.act) ? policyAt(at) : null;
  const ground = proposal.ground !== null ? (policy?.grounds.find((entry) => entry.code === proposal.ground) ?? null) : null;
  const remedy = remedyOf(ground?.code ?? null, takesEffect, policy);
  return {
    status: DECIDED[proposal.act],
    takesEffect,
    condition: proposal.act === "SUSPEND" ? (ground?.condition ?? null) : null,
    appealBy: remedy.closesOn,
    notice: proposal.act !== "NO_CHANGE",
    policyVersion: policy?.version ?? null,
    remedy,
  };
}

/** GET /status-reviews/{id}: the review with its steps, and what an approval records. */
export function reviewPage(key: string, actor: Actor, ref: string): LoadOutcome<ReviewPage> {
  const world = worldOf(key);
  const review = world.reviews.find((entry) => entry.reference === ref);
  if (review === undefined) return refused("REVIEW_NOT_FOUND");
  const record = byId(world, review.record);
  const { proposal, decision } = latestSteps(review);
  const change = record?.changes.find((entry) => entry.authority.kind === "REVIEW" && entry.authority.review === review.reference);
  const recorded: ReviewPage["recorded"] =
    proposal === null
      ? null
      : change !== undefined
        ? {
            status: DECIDED[proposal.act],
            takesEffect: change.effectiveAt,
            condition: change.condition,
            appealBy: change.appealBy,
            notice: change.notice,
            policyVersion: change.policyVersion,
            remedy: change.remedy,
          }
        : recordedOn(proposal, now());
  return ok({
    reference: review.reference,
    state: review.state,
    record: { key: record !== null ? keyOf(record) : review.record, reference: record?.reference ?? null, status: record !== null ? statusOf(record) : "PENDING_ISSUE", premises: record?.premises.name ?? "" },
    trigger: review.trigger,
    openedAt: review.openedAt,
    proposal: proposal !== null ? proposalOf(proposal) : null,
    recorded,
    decision: decision !== null ? { outcome: decision.outcome, by: decision.by, reason: decision.reason } : null,
    readerProposed: review.state === "PROPOSED" && proposal?.by?.name === actor.name,
    joined: review.steps.flatMap((step) => (step.kind === "TRIGGER" ? [{ ...step.trigger, joinedAt: step.at }] : [])),
  });
}

/**
 * POST /status-reviews/{id}/decisions (ACT-BIZ-APR, and never the proposer), checked in the contract's order, `DR-40`
 * again against the version in force at the decision. An approval records the status change, effective at the later
 * of the proposed instant and now, with the ground, its condition, the remedy and its closing date and the policy
 * version; raises the holder's notice through COM; and records right after it any change that masks it. A decline
 * returns the review to open.
 */
export function decideReview(key: string, actor: Actor, ref: string, input: { decision: "APPROVE" | "DECLINE"; reason: string }): LoadOutcome<{ effectiveAt: string | null }> {
  const world = worldOf(key);
  const review = world.reviews.find((entry) => entry.reference === ref);
  if (review === undefined) return refused("REVIEW_NOT_FOUND");
  if (!holds(actor, "ACT-BIZ-APR")) return refused("NOT_AUTHORISED");
  const { proposal } = latestSteps(review);
  if (proposal?.by?.name === actor.name) return refused("SEGREGATION_REQUIRED");
  if (review.state !== "PROPOSED" || proposal === null) return refused("REVIEW_NOT_PROPOSED");
  const reason = input.reason.trim();
  if (input.decision === "DECLINE" && reason === "") return refused("REASON_REQUIRED");
  const record = byId(world, review.record);
  if (record === null) return refused("REVIEW_NOT_FOUND");
  const at = now();
  if (statusOf(record, at) !== proposal.statusWhenProposed) return refused("STATUS_CHANGED_SINCE_PROPOSAL");
  if (ENFORCEMENT.includes(proposal.act)) {
    const policy = policyAt(at);
    if (policy === null) return refused("NO_ENFORCEMENT_POLICY");
    const ground = policy.grounds.find((entry) => entry.code === proposal.ground);
    if (ground === undefined) return refused("GROUND_NOT_IN_POLICY");
    if (!ground.acts.includes(proposal.act)) return refused("GROUND_NOT_FOR_ACTION");
  }
  if (input.decision === "APPROVE" && proposal.act === "REINSTATE") {
    // RC-SETTLED is checkable: FIN reconciled the decision's fee again after the suspension took effect.
    const suspension = standingAt(record, at);
    if (suspension?.condition === "RC-SETTLED") {
      const facts = decisionFacts(key, world, decisionNow(record));
      const paid = facts?.payment === "RECONCILED_IN_FULL" ? facts.paid : null;
      if (paid === null || time(paid.at) <= time(suspension.effectiveAt)) return refused("REINSTATEMENT_CONDITIONS_NOT_MET");
    }
  }
  const by = { name: actor.name, position: actor.position, at };
  review.steps.push({ kind: "DECISION", at, by, outcome: input.decision, reason: reason === "" ? null : reason });
  if (input.decision === "DECLINE") {
    review.state = "OPEN";
    return ok({ effectiveAt: null });
  }
  review.state = "APPROVED";
  review.closedAt = at;
  const decided = DECIDED[proposal.act];
  if (decided === null) return ok({ effectiveAt: null });
  const recorded = recordedOn(proposal, at);
  const change: ChangeRow = {
    from: proposal.statusWhenProposed,
    to: decided,
    effectiveAt: recorded.takesEffect,
    recordedAt: at,
    cause: proposal.act === "REINSTATE" ? "REINSTATEMENT" : "ENFORCEMENT",
    authority: { kind: "REVIEW", review: review.reference, proposer: proposal.by ?? by, approver: by, comment: reason === "" ? null : reason },
    ground: proposal.ground,
    condition: recorded.condition,
    reason: proposal.reason,
    evidence: [...proposal.evidence],
    appealBy: recorded.appealBy,
    notice: false,
    policyVersion: recorded.policyVersion,
    remedy: recorded.remedy,
    noticeRef: null,
  };
  record.changes.push(change);
  record.changes.sort((a, b) => time(a.effectiveAt) - time(b.effectiveAt));
  change.noticeRef = notify(key, world, record, "status_record_changed", `${review.reference}/DECISION`, at, changeFacts(change));
  change.notice = change.noticeRef !== null;
  // A change that takes effect now and that the read masks - a reinstatement after the expiring instant - is followed
  // at once by the change that masks it.
  advance(key, world, record, at);
  // A terminal status ends every other open question about the record.
  if (decided === "REVOKED" || decided === "CANCELLED") {
    for (const other of world.reviews) {
      if (other !== review && other.record === record.id && (other.state === "OPEN" || other.state === "PROPOSED")) {
        other.state = "SUPERSEDED";
        other.closedAt = at;
      }
    }
  }
  return ok({ effectiveAt: recorded.takesEffect });
}

// ================================================================== SCR-CER-07 and 08, re-decided obligations

/**
 * How late a follow-up was applied: RightOne applies one by itself within five minutes of its due instant (NFR-513),
 * so only a delay beyond that is late. Null for one on time or not applied.
 */
function lateness(followUp: FollowUpRecord): number | null {
  if (followUp.applied === null) return null;
  const late = time(followUp.applied.at) - time(followUp.dueBy);
  return late > APPLY_WITHIN_MS ? late : null;
}

const APPLY_WITHIN_MS = 5 * 60_000;

function followUpState(followUp: FollowUpRecord, at: string = now()): FollowUpState {
  if (followUp.state === "OPEN" && time(followUp.dueBy) < time(at)) return "OVERDUE";
  return followUp.state;
}

function followUpRow(key: string, world: World, followUp: FollowUpRecord): FollowUpRow {
  const record = byId(world, followUp.record);
  const state = followUpState(followUp);
  return {
    reference: followUp.reference,
    lateMs: lateness(followUp),
    record: { key: record !== null ? keyOf(record) : followUp.record, reference: record?.reference ?? null },
    premises: { name: record?.premises.name ?? "", register: record?.premises.register ?? null },
    dueBy: followUp.dueBy,
    state,
    outcome: state === "APPLIED" ? (followUp.applied?.outcome ?? null) : state === "SUPERSEDED" ? null : ruleFor(key, world, followUp).outcome,
    appliedAt: followUp.applied?.at ?? null,
  };
}

/** GET /decision-follow-ups: overdue first, then by due instant, 25 a page. */
export function followUpList(key: string, filter: FollowUpFilter, cursor: string | null = null): LoadOutcome<FollowUpList> {
  const offset = cursor === null ? 0 : offsetFrom(cursor, { followUps: filter });
  if (offset === null) return refused("CURSOR_INVALID");
  const world = worldOf(key);
  const rows = world.followUps
    .map((followUp) => followUpRow(key, world, followUp))
    .filter((row) => filter === "ALL" || row.state === filter)
    .sort((a, b) => Number(b.state === "OVERDUE") - Number(a.state === "OVERDUE") || time(a.dueBy) - time(b.dueBy) || a.reference.localeCompare(b.reference));
  return ok({
    asOf: now(),
    filter,
    rows: rows.slice(offset, offset + PAGE_SIZE),
    counts: counts(world),
    nextCursor: offset + PAGE_SIZE < rows.length ? cursorOf(offset + PAGE_SIZE, { followUps: filter }) : null,
    offset,
    total: rows.length,
  });
}

/** One follow-up, with the outcome `DR-435` gives now, and when its lateness was raised to the certificate authority. */
export function followUpPage(key: string, ref: string): LoadOutcome<FollowUpPage> {
  const world = worldOf(key);
  const followUp = world.followUps.find((entry) => entry.reference === ref);
  if (followUp === undefined) return refused("FOLLOW_UP_NOT_FOUND");
  const record = byId(world, followUp.record);
  const facts = decisionFacts(key, world, followUp.decision);
  const rule = ruleFor(key, world, followUp);
  const governed = record !== null ? governingPeriod(record) : null;
  const raised = world.exceptions.find((entry) => entry.code === "EXC-CER-04" && entry.detail.followUp === followUp.reference);
  return ok({
    reference: followUp.reference,
    state: followUpState(followUp),
    record: {
      key: record !== null ? keyOf(record) : followUp.record,
      reference: record?.reference ?? null,
      premises: record?.premises.name ?? "",
      register: record?.premises.register ?? null,
      holder: record?.holder ?? "",
    },
    dueBy: followUp.dueBy,
    notApplied: followUp.decisionUnreadable ? "DECISION_UNREADABLE" : null,
    decision: { reference: followUp.decision, inForceFrom: facts !== null ? startOf(facts.period.from) : followUp.dueBy },
    superseded: followUp.superseded,
    change: followUp.change,
    holderChanged: false,
    periodInForce: governed !== null && followUp.state !== "APPLIED" ? { from: governed.from, to: governed.to } : null,
    rule: { outcome: rule.outcome, unmet: rule.unmet, cutOn: addDays(followUp.dueBy, -1) },
    applied: followUp.applied !== null ? { ...followUp.applied, lateMs: lateness(followUp) } : null,
    exceptionRaisedAt: raised?.at ?? null,
  });
}

const OUTCOMES: readonly FollowUpOutcome[] = ["AMEND", "REPLACE", "END_AT_EFFECTIVE_DATE", "NO_CHANGE_NEEDED"];

/**
 * POST /decision-follow-ups/{id}/resolutions (ACT-OPS): the outcome the rule gives, with a reason; a period recorded
 * late is in force from the moment it is recorded.
 */
export function resolveFollowUp(key: string, actor: Actor, ref: string, input: { outcome: string; reason: string }): LoadOutcome<{ inForceFrom: string }> {
  if (!holds(actor, "ACT-OPS")) return refused("NOT_AUTHORISED");
  const world = worldOf(key);
  const followUp = world.followUps.find((entry) => entry.reference === ref);
  if (followUp === undefined) return refused("FOLLOW_UP_NOT_FOUND");
  if (followUp.state !== "OPEN") return refused("FOLLOW_UP_CLOSED");
  const reason = input.reason.trim();
  if (reason === "") return refused("REASON_REQUIRED");
  const outcome = OUTCOMES.find((entry) => entry === input.outcome);
  const rule = ruleFor(key, world, followUp);
  if (outcome === undefined || outcome !== rule.outcome) return refused("RECORD_WOULD_NOT_MATCH_DECISION");
  const inForceFrom = applyFollowUp(key, world, followUp, outcome, now(), actor.name, reason);
  return ok({ inForceFrom });
}

// ================================================================== SCR-CER-09 Record history

/** GET /certificates/{id}/history: every period with the decision that governed it, every status change, every follow-up. */
export function recordHistory(key: string, ref: string): LoadOutcome<RecordHistory> {
  const world = worldOf(key);
  const record = findRecord(world, ref);
  if (record === null) return refused("CERTIFICATE_NOT_FOUND");
  const lastChange = record.changes.at(-1);
  const lastPeriod = record.periods.at(-1);
  const amendedLast =
    lastPeriod !== undefined && lastPeriod.cause !== "ISSUE" && (lastChange === undefined || time(lastPeriod.governedFrom) > time(lastChange.effectiveAt));
  return ok({
    key: keyOf(record),
    reference: record.reference,
    status: statusOf(record),
    since: sinceOf(record),
    premises: record.premises.name,
    register: record.premises.register,
    latest:
      amendedLast && lastPeriod !== undefined
        ? { kind: "amended", decision: lastPeriod.decision, at: lastPeriod.governedFrom }
        : { kind: "status", status: statusOf(record), ground: lastChange?.ground ?? null, at: lastChange?.effectiveAt ?? record.opened.at },
    periods:
      record.periods.length > 0
        ? record.periods.map((period) => ({ decision: period.decision, from: period.governedFrom, to: period.governedTo, cause: period.cause, follows: followsOf(record, period) }))
        : [{ decision: record.decision, from: null, to: null, cause: "ISSUE" as const, follows: null }],
    changes: record.changes.map((change) => ({
      from: change.from,
      to: change.to,
      effectiveAt: change.effectiveAt,
      recordedAt: change.recordedAt,
      authority: authorityOf(change),
      ground: change.ground,
      evidence: [...change.evidence],
      condition: change.condition,
      policyVersion: change.policyVersion,
    })),
    followUps: world.followUps
      .filter((followUp) => followUp.record === record.id)
      .map((followUp) => ({
        reference: followUp.reference,
        decision: followUp.decision,
        dueBy: followUp.dueBy,
        appliedAt: followUp.applied?.at ?? null,
        lateMs: followUp.applied !== null ? (lateness(followUp) ?? 0) : null,
        outcome: followUp.applied?.outcome ?? null,
        why: followUp.lateWhy,
      })),
  });
}

/**
 * What a renewal period follows (`FR-CER-024`): the decision it renews, as REG names it, and the days of the period
 * before it, kept as they were. Any other period follows none.
 */
function followsOf(record: RecordRow, period: PeriodRow): RecordHistory["periods"][number]["follows"] {
  if (period.cause !== "RENEWAL") return null;
  const before = period.follows !== null ? record.periods[period.follows] : undefined;
  if (before === undefined) return period.renews !== null ? { decision: period.renews, from: "", to: "" } : null;
  return { decision: period.renews ?? before.decision, from: before.from, to: before.to };
}

function authorityOf(change: ChangeRow): ChangeAuthority {
  switch (change.authority.kind) {
    case "ROUTE":
      return { kind: "ROUTE", straight: change.authority.straight, decision: change.authority.decision };
    case "APPROVAL":
      return { kind: "APPROVAL", approver: change.authority.approver };
    case "REVIEW":
      return { kind: "REVIEW", review: change.authority.review, proposer: change.authority.proposer.name, approver: change.authority.approver.name };
    case "SUCCESSOR":
      return { kind: "SUCCESSOR", successor: change.authority.successor };
    case "NOTICE":
      return { kind: "NOTICE", notice: change.authority.notice, dueAt: change.authority.dueAt, fallback: change.authority.fallback };
    case "PERIOD":
      return { kind: "PERIOD", decision: change.authority.decision };
  }
}

// ================================================================== SCR-CER-10 Signing keys

/** GET /signing-keys: the key that signs now first, then the latest start first. */
export function signingKeys(key: string): LoadOutcome<SigningKeys> {
  const world = worldOf(key);
  const at = now();
  const signer = signingKeyAt(world, at);
  const keys = world.keys
    .map((entry) => ({
      kid: entry.kid,
      state: entry.state,
      signsNow: entry === signer,
      validFrom: entry.validFrom,
      retireBy: retireByOf(entry.validFrom),
      signed: entry.signed,
      revokedAt: entry.revokedAt,
    }))
    .sort((a, b) => Number(b.signsNow) - Number(a.signsNow) || time(b.validFrom) - time(a.validFrom) || a.kid.localeCompare(b.kid));
  return ok({ asOf: at, today: dayOf(at), keys });
}

/** A public key the key service would check: a JSON Web Key on P-256 with both coordinates. */
function isP256(jwk: string): boolean {
  try {
    const parsed = JSON.parse(jwk) as Record<string, unknown>;
    const coordinate = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
    return parsed.kty === "EC" && parsed.crv === "P-256" && coordinate(parsed.x) && coordinate(parsed.y);
  } catch {
    return false;
  }
}

/**
 * POST /signing-keys (ACT-SEC): a key the key service holds, signing from `valid_from`. The mock's key service
 * checks the public key's form only, as a test signature would refuse any other.
 */
export function registerKey(key: string, actor: Actor, input: { kid: string; handle: string; jwk: string; validFrom: string | null }): LoadOutcome<{ kid: string; validFrom: string }> & { field?: string } {
  if (!holds(actor, "ACT-SEC")) return refused("NOT_AUTHORISED");
  const world = worldOf(key);
  const kid = input.kid.trim();
  if (world.keys.some((entry) => entry.kid === kid)) return { ...refused("KID_EXISTS"), field: "kid" };
  if (input.validFrom === null || time(input.validFrom) < time(now())) return { ...refused("VALID_FROM_IN_PAST"), field: "valid_from" };
  if (!isP256(input.jwk.trim())) return { ...refused("KEY_INVALID"), field: "public_key_jwk" };
  world.keys.push({ kid, handle: input.handle.trim(), validFrom: input.validFrom, state: "ACTIVE", signed: 0, retiredAt: null, revokedAt: null, reason: null });
  return ok({ kid, validFrom: input.validFrom });
}

/** POST /signing-keys/{kid}/retirements (ACT-SEC): it stops signing and still verifies what it signed. */
export function retireKey(key: string, actor: Actor, kid: string): LoadOutcome<{ kid: string }> {
  if (!holds(actor, "ACT-SEC")) return refused("NOT_AUTHORISED");
  const world = worldOf(key);
  const entry = world.keys.find((candidate) => candidate.kid === kid);
  if (entry === undefined) return refused("KEY_NOT_FOUND");
  if (entry.state !== "ACTIVE") return refused("KEY_NOT_ACTIVE");
  const at = now();
  const othersSign = world.keys.some((other) => other !== entry && other.state === "ACTIVE" && time(other.validFrom) <= time(at));
  if (!othersSign && time(entry.validFrom) <= time(at)) return refused("LAST_SIGNING_KEY");
  entry.state = "RETIRED";
  entry.retiredAt = at;
  return ok({ kid });
}

/**
 * POST /signing-keys/{kid}/revocations (ACT-SEC): nothing it signed verifies any more. Answers how many records'
 * current printout it signed, which their holders have to print again, and raises EXC-CER-07 naming each of them.
 */
export function revokeKey(key: string, actor: Actor, kid: string, reason: string): LoadOutcome<{ kid: string; reprint: number }> {
  if (!holds(actor, "ACT-SEC")) return refused("NOT_AUTHORISED");
  const world = worldOf(key);
  const entry = world.keys.find((candidate) => candidate.kid === kid);
  if (entry === undefined) return refused("KEY_NOT_FOUND");
  if (entry.state === "REVOKED") return refused("KEY_ALREADY_REVOKED");
  if (reason.trim() === "") return refused("REASON_REQUIRED");
  const at = now();
  entry.state = "REVOKED";
  entry.revokedAt = at;
  entry.reason = reason.trim();
  const reprint = world.records.filter((record) => record.printouts[0]?.signingKey === kid);
  raiseException(world, "EXC-CER-07", kid, { records: reprint.map((record) => record.reference ?? record.id).join(", "), reason: entry.reason }, at);
  return ok({ kid, reprint: reprint.length });
}

// ================================================================== what other families read

/**
 * The status record issued under a decision, by reference, or null while none is issued: FIN-02 links to it once
 * the fee is paid. The signature is the contract between the families.
 */
export function certificateForDecision(key: string, decision: string): string | null {
  const world = worldOf(key);
  const record = world.records.find(
    (entry) => entry.opened.decision === decision || entry.decision === decision || entry.periods.some((period) => period.decision === decision),
  );
  return record?.reference ?? null;
}

/** A record as the public register publishes it (R19.3): its status now, since when, and its period. */
export interface PublishedRecord {
  reference: string;
  status: HolderState;
  statusSince: string;
  validFrom: string;
  validTo: string;
}

/**
 * The public verification route's read (`ICertificateReader`): the record a public reference names, or the record a
 * printout reference names when the key that signed it is not revoked; `printout` is set only when it is the
 * record's current printout. A pending record holds no reference and answers as no record. Null when the register
 * holds neither.
 */
export function publishedRecord(key: string, asked: string): (PublishedRecord & { printout: string | null }) | null {
  const world = worldOf(key);
  const byPrintout = world.records.find((record) => record.printouts.some((made) => made.reference === asked));
  const record = byPrintout ?? world.records.find((entry) => entry.reference === asked);
  if (record === undefined || record.reference === null) return null;
  const made = byPrintout?.printouts.find((entry) => entry.reference === asked);
  if (made !== undefined && world.keys.find((entry) => entry.kid === made.signingKey)?.state === "REVOKED") return null;
  const status = holderState(record);
  const period = shownPeriod(record);
  if (status === null || period === null) return null;
  return { reference: record.reference, status, statusSince: sinceOf(record), validFrom: period.from, validTo: period.to, printout: record.printouts[0]?.reference === asked ? asked : null };
}

/**
 * SM-400 transition 1: a payment or case event opens a review of the record it bears on, with no proposal yet; an
 * officer then proposes on it (SCR-CER-05) and an approver decides, which is the review's conclusion
 * (`statusReviewState`). FIN calls it when a paid fee is taken back, CAS when a case decision calls for a status
 * change. `DR-437`, row 5 first: an event seen before opens nothing and answers the review it opened or joined
 * (EXC-CER-06); a reference that names no issued record opens nothing and answers null (row 1); a record with a
 * review open takes the event as a step of that review and answers it (row 2); otherwise a review opens (rows 3, 4).
 */
export function openStatusReview(
  key: string,
  record: string,
  trigger: { kind: "PAYMENT_REVERSAL"; event: string; at: string } | { kind: "CASE"; caseRef: string; letter: string | null; letterOn: string | null },
): string | null {
  const world = worldOf(key);
  const event = eventOf(trigger);
  const seen = event !== null ? world.events.get(event) : undefined;
  if (seen !== undefined) {
    raiseException(world, "EXC-CER-06", record, { event: event ?? "", review: seen });
    return seen;
  }
  const target = world.records.find((entry) => entry.reference === record);
  if (target === undefined) return null;
  const at = now();
  const open = openReviewOf(world, target);
  if (open !== null) {
    open.steps.push({ kind: "TRIGGER", at, trigger });
    if (event !== null) world.events.set(event, open.reference);
    return open.reference;
  }
  const review: ReviewRecord = { reference: reference("CSR"), record: target.id, trigger, openedAt: at, state: "OPEN", closedAt: null, steps: [] };
  world.reviews.push(review);
  if (event !== null) world.events.set(event, review.reference);
  return review.reference;
}

/**
 * A review's state and when it was proposed and closed, for the family whose event opened it: APPROVED or
 * SUPERSEDED is its conclusion. `act` is the act an approval decided (null before one, or for a decline) and
 * `effectiveAt` when the change it recorded takes effect. Null when there is no such review.
 */
export function statusReviewState(
  key: string,
  review: string,
): { state: ReviewState; proposedAt: string | null; closedAt: string | null; act: StatusAct | null; effectiveAt: string | null } | null {
  const world = worldOf(key);
  const found = world.reviews.find((entry) => entry.reference === review);
  if (found === undefined) return null;
  const { proposal } = latestSteps(found);
  const change = byId(world, found.record)?.changes.find((entry) => entry.authority.kind === "REVIEW" && entry.authority.review === found.reference);
  return {
    state: found.state,
    proposedAt: proposal?.at ?? null,
    closedAt: found.closedAt,
    act: found.state === "APPROVED" ? (proposal?.act ?? null) : null,
    effectiveAt: change?.effectiveAt ?? null,
  };
}

/** The exceptions this family raised in a world, the latest first: what the certificate authority and the operators are told. */
export function certificateExceptions(key: string): readonly CertificateException[] {
  return [...worldOf(key).exceptions].reverse();
}

// ================================================================== the inspector route's reads (VER's ICertificateReader)

/**
 * The key service the mock stands in for: one P-256 key pair per key identifier, made the first time the key signs
 * or is published and kept for the life of the server process, as a key service keeps its keys whatever world asks.
 * The private half never leaves this module; VER verifies with the public half it is served.
 */
const KEY_PAIRS = new Map<string, { privateKey: KeyObject; publicKey: KeyObject }>();

function keyPairOf(kid: string): { privateKey: KeyObject; publicKey: KeyObject } {
  const held = KEY_PAIRS.get(kid);
  if (held !== undefined) return held;
  const made = generateKeyPairSync("ec", { namedCurve: "P-256" });
  KEY_PAIRS.set(kid, made);
  return made;
}

/**
 * A verification key as `VerificationKeysAt` publishes it: every key not revoked, retired ones included, so a code
 * printed under a key since retired still verifies. `validTo` is the instant a retired key stopped signing.
 */
export interface VerificationKey {
  kid: string;
  publicKeyJwk: JsonWebKey;
  validFrom: string;
  validTo: string | null;
  retiredAt: string | null;
}

/** `ICertificateReader.VerificationKeysAt`: the keys published at the instant; a revoked key is absent. */
export function verificationKeysAt(key: string, at: string): readonly VerificationKey[] {
  return worldOf(key)
    .keys.filter((entry) => entry.state !== "REVOKED" || (entry.revokedAt !== null && time(entry.revokedAt) > time(at)))
    .map((entry) => ({
      kid: entry.kid,
      publicKeyJwk: keyPairOf(entry.kid).publicKey.export({ format: "jwk" }),
      validFrom: entry.validFrom,
      validTo: entry.retiredAt,
      retiredAt: entry.retiredAt,
    }));
}

/**
 * What the QR code on a printout carries (payload version 1): the record and the printout it names, the key that
 * signed it, the instant it was printed, the record's status and period then, the premises' name, and the issuer and the
 * scope (`iss`, `sc`, `ALG-407`); it is signed when the printout is made (`signedPrintout`). `payload` is
 * the base64url of that JSON; `signature` the base64url ECDSA P-256 signature over the JSON's bytes (IEEE P1363).
 */
export interface SignedCode {
  payload: string;
  signature: string;
  keyId: string;
}

/** The signed code a printout carries, as the camera reads it from the paper; null for a printout CER never made. */
export function signedCodeOf(key: string, printout: string): SignedCode | null {
  const world = worldOf(key);
  const record = world.records.find((entry) => entry.printouts.some((made) => made.reference === printout));
  const made = record?.printouts.find((entry) => entry.reference === printout);
  if (record === undefined || made === undefined || record.reference === null) return null;
  return { payload: made.payload, signature: made.signature, keyId: made.signingKey };
}

/**
 * A record as the inspector route reads it at an instant (`ResolveIdentifier`, `RecordAt`, `RepresentationAt`): its
 * status and whether it is current then, since when, its period, the premises as the register names it, and the
 * printout asked for with whether it is the record's latest.
 */
export interface InspectorRecordRead {
  reference: string;
  status: RecordStatus;
  current: boolean;
  since: string;
  period: Period | null;
  premises: { register: string | null; name: string; ward: string | null };
  printout: { reference: string; latest: boolean; signingKey: string } | null;
}

function inspectorRead(record: RecordRow, at: string, printout: PrintoutSummary | null): InspectorRecordRead | null {
  if (record.reference === null || statusOf(record, at) === "PENDING_ISSUE") return null;
  const period = governingPeriod(record, at);
  return {
    reference: record.reference,
    status: statusOf(record, at),
    current: isCurrent(record, at),
    since: sinceOf(record, at),
    period: period !== null ? { from: period.from, to: period.to } : null,
    premises: { register: record.premises.register, name: record.premises.name, ward: record.premises.ward },
    printout: printout !== null ? { reference: printout.reference, latest: record.printouts[0]?.reference === printout.reference, signingKey: printout.signingKey } : null,
  };
}

/**
 * The record a public or printout reference names at an instant, as the public route reads it: a printout signed by
 * a revoked key, and a record pending issue, answer as no record. Null when the register holds neither.
 */
export function inspectorRecordAt(key: string, asked: string, at: string): InspectorRecordRead | null {
  const world = worldOf(key);
  const byPrintout = world.records.find((record) => record.printouts.some((made) => made.reference === asked));
  if (byPrintout !== undefined) {
    const made = byPrintout.printouts.find((entry) => entry.reference === asked) ?? null;
    if (made !== null && world.keys.find((entry) => entry.kid === made.signingKey)?.state === "REVOKED") return null;
    return inspectorRead(byPrintout, at, made);
  }
  const record = world.records.find((entry) => entry.reference === asked);
  return record === undefined ? null : inspectorRead(record, at, null);
}

/**
 * `ICertificateReader.CurrentRecordsForPremisesAt` for one premises of the register: the record current at the
 * instant, or none with the last known status of the premises' latest record (null where none was ever issued).
 */
export function premisesRecordAt(key: string, register: string, at: string): { current: InspectorRecordRead | null; lastKnown: RecordStatus | null } {
  const issued = worldOf(key)
    .records.filter((record) => record.premises.register === register)
    .map((record) => inspectorRead(record, at, null))
    .filter((read): read is InspectorRecordRead => read !== null);
  const current = issued.find((read) => read.current) ?? null;
  const latest = [...issued].sort((a, b) => time(b.since) - time(a.since))[0];
  return { current, lastKnown: current !== null ? current.status : (latest?.status ?? null) };
}
