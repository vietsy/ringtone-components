import type { LoadOutcome } from "@rightone/ui";
import {
  calculation,
  calculationsOf,
  declaredClassifications,
  feeCalculation,
  mandateScopeChanges,
  reproduce,
  reviewFeeCalculation,
  type TariffActor,
} from "@/lib/mock/backend/tariff";
import { mockTariffFailure } from "@/lib/mock/tariff";
import type { MusicMethod, PremisesClass } from "./registration";
import type { Principal, Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/** The three rights layers a fee is split into, one component each. */
export type TariffLayer = "AUTHORS" | "PERFORMERS" | "PRODUCERS";

/** `tariff.calculations.purpose`: a calculation a fee rests on, the proof of one, or a trial that answers nothing. */
export type CalculationPurpose = "PRODUCTION" | "REPRODUCTION" | "TRIAL";

/** Where a class came from (convention 6): the register, what the premises declared, or a classification decision. */
export type ClassBasis = "AUTHORITATIVE" | "DECLARED" | "EXCEPTION";

/** What happened to a component (convention 6); every treatment but CHARGED names its authority. */
export type Treatment = "CHARGED" | "EXEMPT" | "EXCLUDED_MANDATE_STOPPED" | "EXCLUDED_CLAIM_ACCEPTED" | "REDUCED_CLAIM_ACCEPTED";

/**
 * `DR-322`'s reason code for a component's treatment: a stopped mandate (row 1), an exemption met (row 2), a claim
 * accepted for the whole period or a part of it (rows 3 and 4), a claim on the layer that removed nothing (row 5), or
 * nothing bearing on it (row 6).
 */
export type ComponentReason = "MANDATE_STOPPED" | "EXEMPTION_MET" | "CLAIM_ACCEPTED" | "CLAIM_PARTLY_ACCEPTED" | "CLAIM_NOT_ACCEPTED" | "CHARGED";

/** One fact the calculator read, with where it came from. */
export type CalculationInput =
  | { fact: "admin_area"; value: string; source: "register" | "declared" }
  | { fact: "premises_class"; value: PremisesClass; source: "register" | "declared" }
  | { fact: "customer_area"; value: number; source: "declared" }
  | { fact: "days_open"; value: number; source: "declared" }
  | { fact: "music_method"; value: MusicMethod; source: "declared" }
  | { fact: "use_began_on"; value: string; source: "declared" }
  /** Read only by the micro-business exemption; REG's rulebook 2026.2 does not ask it. */
  | { fact: "seating_capacity"; value: number; source: "declared" };

/** `DR-321`: the premises inside the tariff, outside it, or not classified by it. */
export type ScopeOutcome = "IN_SCOPE" | "OUT_OF_SCOPE" | "INDETERMINATE";

/** `transition_rule` (`DEC-04`): from which date a change takes effect under a version. */
export type TransitionRule = "FROM_CHANGE_DATE" | "FROM_NEXT_MONTH" | "FROM_NEXT_PERIOD";

/** A factor the inputs selected for a component: its kind, its key in the content and its value, in hundredths. */
export interface AppliedFactor {
  kind: "LOCALITY" | "PREMISES_CLASS" | "SIZE_BAND";
  key: string;
  factorHundredths: number;
}

/** A claim the premises raised against a rights layer, as REG recorded it. */
export interface CalculationClaim {
  layer: TariffLayer;
  state: "UNDER_REVIEW" | "ACCEPTED" | "PARTLY_ACCEPTED" | "NOT_ACCEPTED";
  /** The days accepted: the claim's period for an acceptance, its accepted scope for a partial one. */
  accepted: { from: string; to: string } | null;
}

export interface CalculationComponent {
  layer: TariffLayer;
  amountBeforeCapMinor: number;
  amountMinor: number;
  treatment: Treatment;
  /** The record the treatment rests on: the claim, the exemption or the mandate event; null for CHARGED. */
  authority: string | null;
  /** Why it was treated so (`DR-322`), shown beside the treatment on SCR-TAR-09. */
  reason: ComponentReason;
  /** Still charged while a claim on the layer is reviewed. */
  claimPending: boolean;
  /** The component's share of the base amount, in hundredths; null where the calculation recorded none (a canvas decision). */
  shareHundredths: number | null;
  /** Each factor the inputs selected for the component, in the order the calculator applied them; empty where none was recorded. */
  factors: readonly AppliedFactor[];
}

/**
 * The micro-business exemption the version's content defines, criterion by criterion: the fact read, the limit it is
 * held to (at most) and whether it was met. A fact absent from the inputs is read as no value and not met.
 */
export interface ExemptionTested {
  code: "MICRO_BUSINESS";
  applied: boolean;
  criteria: readonly { criterion: "MB-1" | "MB-2"; fact: "FLOOR_AREA_M2" | "SEATING_CAPACITY"; atMost: number; value: number | null; met: boolean }[];
}

/** A reproduction of a calculation: who asked, when, and whether the amount still follows from what was recorded. */
export interface Reproduction {
  reference: string;
  createdAt: string;
  requestedBy: "ACT-FIN-OP" | "ACT-AUD";
  outcome: "MATCH" | "DIFFERENCE";
  differences: readonly { field: string; recorded: string; reproduced: string }[];
}

/** One recorded calculation, every figure the calculator kept. */
export interface Calculation {
  reference: string;
  purpose: CalculationPurpose;
  decisionDate: string;
  version: string;
  /** The approving instrument of the version (`instrument_ref`), by which a premises knows the tariff; null where none is published. */
  instrument: string | null;
  /** The content's base amount, the first figure of every component; null where the calculation recorded none (a canvas decision). */
  baseAmountMinor: number | null;
  premises: { id: string; name: string };
  /**
   * What it answered: an obligation decision, the review of an application before it was sent, or a financial
   * correction of a decision's fee, with the case the correction was made under (FR-FIN-011).
   */
  answered:
    | { kind: "decision"; reference: string }
    | { kind: "review"; application: string }
    | { kind: "correction"; reference: string; decision: string; case: string | null };
  /** The module that asked for it: REG for a fee, FIN for a correction's linked calculation. */
  requestedBy: "registration" | "finance";
  createdAt: string;
  inputs: readonly CalculationInput[];
  claims: readonly CalculationClaim[];
  classification: {
    locality: { class: number | null; basis: ClassBasis | null };
    premisesClass: { class: PremisesClass | null; basis: ClassBasis | null };
    scope: ScopeOutcome;
  };
  /** Empty when the premises is outside the tariff. */
  components: readonly CalculationComponent[];
  exemptions: readonly ExemptionTested[];
  /** The cap of the content; `applied` when the components were reduced pro rata to it (`DR-323`). */
  cap: { capMinor: number; applied: boolean };
  rounding: { rule: "DOWN_TO_UNIT"; unitMinor: number; beforeMinor: number };
  amountBeforeCapMinor: number;
  /** Null when no amount was computed (outside the tariff, or not classified by it). */
  amountMinor: number | null;
  /** The version's transition rule, which a reported change's effective date follows; null where none was recorded. */
  transitionRule: TransitionRule | null;
  /** For a reproduction, the calculation it reproduces and its outcome. */
  reproduces: { reference: string; outcome: Reproduction["outcome"] } | null;
}

/** SCR-TAR-08's list: the premises chosen, its calculations in the period, newest decision date first. */
export interface PremisesCalculations {
  asOf: string;
  premisesOptions: readonly { id: string; name: string }[];
  filter: { premises: string | null; from: string; to: string };
  /** Null until a premises is chosen: the list is never read unfiltered. */
  rows: readonly Calculation[] | null;
}

/** SCR-TAR-09: one calculation, its reproductions, and what the reader may do with it. */
export interface CalculationPage {
  calculation: Calculation;
  reproductions: readonly Reproduction[];
  /** The finance operator and the auditor reproduce; the operations officer reads (PERM-657). */
  mayReproduce: boolean;
  /** A class rests on a declaration, and the reader may open the watch on it. */
  declaredWatch: boolean;
}

/** SM-298: a declared class the sweep watches until the register answers. */
export type WatchStatus = "WATCHING" | "RESOLVED_SAME" | "RESOLVED_DIFFERENT" | "CLOSED";

export interface DeclaredWatch {
  key: string;
  premises: { id: string; name: string };
  kind: "PREMISES_CLASS";
  declared: PremisesClass | null;
  status: WatchStatus;
  createdAt: string;
  ageDays: number;
  firstCalculation: string;
  /** The decision in force a different answer would amend, read now. */
  decisionInForce: string | null;
  lastCheckedAt: string | null;
  /** Why the sweep left it as it is (`DR-328`); null before the first sweep. */
  reason: "STILL_UNRESOLVED" | "SAME_AS_DECLARED" | "DIFFERENT_FROM_DECLARED" | "DECISION_NO_LONGER_DECLARED" | "NO_DECISION_IN_PERIOD" | null;
  /** The class the register answered, once it answered. */
  resolvedClass: PremisesClass | null;
  resolvedAt: string | null;
  /** RESOLVED_DIFFERENT: the decision `tariff.classification_resolved` named for REG to amend. */
  resolvedDecision: string | null;
}

export interface DeclaredClassifications {
  asOf: string;
  filter: { status: WatchStatus | null; premises: string | null };
  premisesOptions: readonly { id: string; name: string }[];
  rows: readonly DeclaredWatch[];
  opened: DeclaredWatch | null;
  /** Operations officers read calculations; the data owner reads the watch only. */
  mayOpenCalculation: boolean;
}

/** One state change of a mandate the tariff recorded, and what it did to the version in force. */
export interface MandateScopeChange {
  key: string;
  effectiveAt: string;
  organisation: string;
  newState: "EFFECTIVE" | "SUSPENDED" | "WITHDRAWN";
  change: "STOPPED" | "RESTORED" | "NONE";
  components: readonly TariffLayer[];
  reason: "SCOPE_STOPPED" | "SCOPE_RESTORED" | "NO_COMPONENT_AFFECTED" | "FIRST_EFFECT";
  version: string;
  recordedAt: string;
  /** For a stop, the later restoration of the same mandate's scope, when there is one. */
  restoredOn: string | null;
}

export interface MandateScopeChanges {
  asOf: string;
  filter: { change: MandateScopeChange["change"] | null; from: string; to: string };
  rows: readonly MandateScopeChange[];
  opened: MandateScopeChange | null;
}

/** SCR-TAR-14: the calculation of the premises' own decision, for the person acting for it. */
export interface FeeExplanation {
  decision: string;
  calculation: Calculation;
}

/** SCR-TAR-14 opened from the review (SCR-REG-05): the calculation the review of a draft recorded, for the person acting for it. */
export interface ReviewFeeExplanation {
  application: string;
  calculation: Calculation;
}

/** A refusal of Reproduce, drawn in place of the Reproductions panel's result with its code. */
export interface ReproduceAttempt {
  page: "calculation";
  calculation: string;
  code: string;
}

const actor = (staff: Staff): TariffActor => ({ roles: staff.roles });

/** SCR-TAR-08: the calculations of one premises between two dates; nothing is read until a premises is chosen. */
export function loadPremisesCalculations(
  staff: Staff,
  filter: { premises: string | null; from: string | null; to: string | null },
  view: "error" | null,
): Promise<LoadOutcome<PremisesCalculations>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockTariffFailure("tar08") : calculationsOf(staff.sessionId, actor(staff), filter));
}

/** SCR-TAR-09: one calculation by its reference (CALCULATION_NOT_FOUND for one the reader may not see). */
export function loadCalculation(staff: Staff, reference: string, view: "error" | null): Promise<LoadOutcome<CalculationPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockTariffFailure("tar09") : calculation(staff.sessionId, actor(staff), reference));
}

/** Reproduce a calculation with its recorded version, content and inputs (PERM-657): a new REPRODUCTION row. */
export function reproduceCalculation(staff: Staff, reference: string): Promise<LoadOutcome<{ reproduction: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(reproduce(staff.sessionId, actor(staff), reference));
}

/** SCR-TAR-12: the declared classes under reconciliation, with one watch opened. */
export function loadDeclaredClassifications(
  staff: Staff,
  filter: { status: WatchStatus | null; premises: string | null },
  opened: string | null,
  view: "error" | null,
): Promise<LoadOutcome<DeclaredClassifications>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockTariffFailure("tar12") : declaredClassifications(staff.sessionId, actor(staff), filter, opened));
}

/** SCR-TAR-13: the mandate state changes the tariff recorded in the period, newest first. */
export function loadMandateScopeChanges(
  staff: Staff,
  filter: { change: MandateScopeChange["change"] | null; from: string | null; to: string | null },
  opened: string | null,
  view: "error" | null,
): Promise<LoadOutcome<MandateScopeChanges>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockTariffFailure("tar13") : mandateScopeChanges(staff.sessionId, actor(staff), filter, opened));
}

/** SCR-TAR-14: how the fee on the premises' decision was calculated, for a person acting for that premises. */
export function loadFeeExplanation(principal: Principal, decision: string, view: "error" | null): Promise<LoadOutcome<FeeExplanation>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockTariffFailure("tar14") : feeCalculation(principal.sessionId, principal.party, decision));
}

/** SCR-TAR-14 from the review: how the fee a draft's review showed was calculated (`GET /calculations/{ref}`, PERM-656). */
export function loadReviewFeeExplanation(principal: Principal, application: string, reference: string, view: "error" | null): Promise<LoadOutcome<ReviewFeeExplanation>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockTariffFailure("tar14") : reviewFeeCalculation(principal.sessionId, application, reference));
}
