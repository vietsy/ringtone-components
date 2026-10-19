import { createHash, randomBytes } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type { FactAnswers, Period, PremisesClass } from "@/lib/api/registration";
import type {
  AppliedFactor,
  Calculation,
  CalculationClaim,
  CalculationComponent,
  CalculationInput,
  CalculationPage,
  ClassBasis,
  ComponentReason,
  DeclaredClassifications,
  DeclaredWatch,
  ExemptionTested,
  FeeExplanation,
  MandateScopeChange,
  MandateScopeChanges,
  PremisesCalculations,
  Reproduction,
  ReviewFeeExplanation,
  ScopeOutcome,
  TariffLayer,
  TransitionRule,
  Treatment,
  WatchStatus,
} from "@/lib/api/tariff";
import { TARIFF_VERSIONS, type TariffContent, type TariffVersion } from "@/lib/mock/public";
import { registrationSeed } from "@/lib/mock/registration";
import { reviewSeed } from "@/lib/mock/registration-review";
import {
  areaKeyOf,
  CHANGE_REPORT_DEFAULT_DAYS,
  CHANGE_REPORT_PERIODS,
  SALA_REVIEW_CALCULATION,
  TARIFF,
  TRANSITION_RULES,
  versionNamed,
} from "@/lib/mock/tariff";
import { ORGANISATIONS, organisationName } from "./accounts";
import { addDays, now, today } from "./clock";
import { mandateOf } from "./governance";
import { mayActFor } from "./parties";
import { decisionFactsOf, decisionForCollection, decisionReferences, restsOnDeclaredClassification } from "./registration";
import { table, type StaffRole } from "./store";

/**
 * TAR's behaviour, played by the mock backend. The calculator (`ALG-295`, `ALG-296`) works a fee out from the facts
 * REG sends and a decision date, under the version effective that day: the classes and their basis, each component
 * with its share, factors, treatment and authority, the micro-business exemption criterion by criterion, the cap and
 * the rounding. Every production calculation is recorded, and a declared class opens a watch the reconciliation sweep
 * asks about again (`ALG-300`). A mandate that stops removes its component from every calculation dated on or after
 * the stop (`ALG-301`), and a reproduction recomputes a recorded calculation from the version, inputs and date it
 * recorded (`ALG-299`). The canvas's decisions keep the amounts the canvas drew, read from REG's record.
 */

/** The member of staff a read or a reproduction is for, by the spec roles they hold. */
export interface TariffActor {
  roles: readonly StaffRole[];
}

const LAYERS: readonly TariffLayer[] = ["AUTHORS", "PERFORMERS", "PRODUCERS"];

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const holds = (actor: TariffActor, ...roles: readonly StaffRole[]) => roles.some((role) => actor.roles.includes(role));

/** `DR-322`'s reason code for a treatment; a component charged with a claim on its layer that removed nothing is row 5. */
function reasonOf(treatment: Treatment, claimed: boolean): ComponentReason {
  switch (treatment) {
    case "EXCLUDED_MANDATE_STOPPED":
      return "MANDATE_STOPPED";
    case "EXEMPT":
      return "EXEMPTION_MET";
    case "EXCLUDED_CLAIM_ACCEPTED":
      return "CLAIM_ACCEPTED";
    case "REDUCED_CLAIM_ACCEPTED":
      return "CLAIM_PARTLY_ACCEPTED";
    case "CHARGED":
      return claimed ? "CLAIM_NOT_ACCEPTED" : "CHARGED";
  }
}

/** The approving instrument a version is published with (`instrument_ref`): how a premises knows the tariff. */
const instrumentOf = (version: string): string | null => TARIFF_VERSIONS.find((entry) => entry.version === versionNamed(version))?.publication.instrumentNumber ?? null;

// ------------------------------------------------------------------ references

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** `TCL-` and ten characters of 50 bits in RFC 4648 base32, upper case, as ALG-303 writes a calculation reference. */
function tcl(bits: Buffer): string {
  let out = "";
  let value = 0n;
  for (const byte of bits.subarray(0, 7)) value = (value << 8n) | BigInt(byte);
  value >>= 6n;
  for (let i = 9; i >= 0; i--) out += BASE32[Number((value >> BigInt(i * 5)) & 31n)];
  return `TCL-${out}`;
}

/** The reference of the calculation a canvas decision or review rests on: the same in every world, so a link to it holds. */
const referenceOf = (subject: string) => tcl(createHash("sha256").update(`tariff-calculation:${subject}`).digest());

// ------------------------------------------------------------------ the table

/** A production calculation the calculator recorded, with the question it answered, which a reproduction asks again. */
interface Recorded {
  calculation: Calculation;
  question: FeeQuestion;
}

/** SM-298: a declared class the sweep asks about until the register answers. */
interface Watch {
  premises: { id: string; name: string };
  declared: PremisesClass;
  status: WatchStatus;
  reason: DeclaredWatch["reason"];
  createdAt: string;
  firstCalculation: string;
  lastCheckedAt: string | null;
  resolvedClass: PremisesClass | null;
  resolvedAt: string | null;
  resolvedDecision: string | null;
}

/** A mandate state change as `ALG-301` recorded it: the API's row, with the mandate it is about. */
interface ScopeChangeRow extends MandateScopeChange {
  mandate: string;
}

interface TariffTable {
  /** The reproductions of each calculation, the latest first. */
  reproductions: Map<string, (Reproduction & { calculation: Calculation })[]>;
  /** The calculations financial corrections linked, by reference. */
  linked: Map<string, Calculation>;
  /** The production calculations the calculator recorded, by reference, in the order made. */
  calculations: Map<string, Recorded>;
  watches: Watch[];
  /** The mandate state changes the handler recorded, oldest first. */
  scopeChanges: ScopeChangeRow[];
  /** The Vietnam day of the last reconciliation sweep. */
  sweptOn: string | null;
}

function tariffOf(key: string): TariffTable {
  const book = table<TariffTable>(key, "tariff", () => ({
    reproductions: new Map(),
    linked: new Map(),
    calculations: new Map(),
    watches: [],
    scopeChanges: [],
    sweptOn: null,
  }));
  // A world begun before the calculator recorded anything has none of its tables.
  book.linked ??= new Map();
  book.calculations ??= new Map();
  book.watches ??= [];
  book.scopeChanges ??= [];
  book.sweptOn ??= null;
  return book;
}

// ------------------------------------------------------------------ the premises the calculations are of

const THEN_CUA = () => registrationSeed();

/** The premises PTY holds: Then Cửa Việt's, then the other parties' in REG's review queue. */
function premisesOptions(): { id: string; name: string }[] {
  return [...THEN_CUA().premises, ...reviewSeed().premises].map((premises) => ({ id: premises.id, name: premises.name }));
}

const premisesNamed = (id: string) => premisesOptions().find((premises) => premises.id === id) ?? { id, name: id };

/** The register's class of a premises, as REG's register answers it: `IPartyReader.PremisesClassificationAt`. */
function registerClassOf(premisesId: string): PremisesClass | null {
  return THEN_CUA().register.premises[premisesId]?.premisesClass ?? null;
}

// ------------------------------------------------------------------ the arithmetic (ALG-295, money as integers)

/** Calendar days from one ISO date to another, counting both. */
function daysIn(period: Period): number {
  return Math.round((Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000) + 1;
}

const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);

/** The days of `period` that a set of ranges covers, each day once. */
function coveredDays(period: Period, ranges: readonly Period[]): number {
  const inside = ranges
    .map((range) => ({ from: later(range.from, period.from), to: earlier(range.to, period.to) }))
    .filter((range) => range.from <= range.to)
    .sort((a, b) => a.from.localeCompare(b.from));
  let total = 0;
  let reached: string | null = null;
  for (const range of inside) {
    const from = reached !== null && range.from <= reached ? addDays(`${reached}T00:00:00Z`, 1) : range.from;
    if (from <= range.to) total += daysIn({ from, to: range.to });
    reached = reached === null ? range.to : later(reached, range.to);
  }
  return total;
}

/** `apportion` of ALG-295: each part its whole-dong floor, the remainder to the largest part, ties to the smallest code. */
function apportion(target: bigint, parts: readonly bigint[]): bigint[] {
  const sum = parts.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return parts.map(() => 0n);
  const shares = parts.map((part) => (target * part) / sum);
  const remainder = target - shares.reduce((a, b) => a + b, 0n);
  const largest = parts.reduce((best, part, i) => (part > (parts[best] ?? 0n) ? i : best), 0);
  shares[largest] = (shares[largest] ?? 0n) + remainder;
  return shares;
}

// ------------------------------------------------------------------ the version and the classes (ALG-296)

const RIGHT_LAYER: Readonly<Record<string, TariffLayer>> = { works: "AUTHORS", performers: "PERFORMERS", producers: "PRODUCERS" };

/** The version `TAR-TARIFF` has in effect on a day (`IRuleVersionResolver.Resolve`), or none. */
function versionOn(day: string): TariffVersion | null {
  return TARIFF_VERSIONS.find((version) => version.effectiveFrom <= day && (version.effectiveTo === null || day <= version.effectiveTo)) ?? null;
}

type ClassReason = "RESOLVED_FROM_REFERENCE" | "DECLARED_CLASSIFICATION" | "NOT_IN_TARIFF" | "DECLARED_CLASS_NOT_IN_TARIFF" | "CLASS_MISSING";

interface PremisesClassEntry {
  class: PremisesClass | null;
  basis: ClassBasis | null;
  reason: ClassReason;
}

interface LocalityEntry {
  class: number | null;
  basis: ClassBasis | null;
  reason: ClassReason;
}

/** The factor of a premises class in the content, or none where the content does not list it. */
const classFactor = (content: TariffContent, premisesClass: string): number | null =>
  (content.premisesClassFactorHundredths as Readonly<Partial<Record<string, number>>>)[premisesClass] ?? null;

/** PREMISES_CLASS, `ALG-296` p2 to p5: the register's class where it answers, else the declared one. */
function premisesClassOf(content: TariffContent, inputs: readonly CalculationInput[]): PremisesClassEntry {
  const input = inputs.find((entry) => entry.fact === "premises_class");
  if (input === undefined || input.fact !== "premises_class") return { class: null, basis: null, reason: "CLASS_MISSING" };
  const assigned = classFactor(content, input.value) !== null;
  if (input.source === "register") return assigned ? { class: input.value, basis: "AUTHORITATIVE", reason: "RESOLVED_FROM_REFERENCE" } : { class: null, basis: null, reason: "NOT_IN_TARIFF" };
  return assigned ? { class: input.value, basis: "DECLARED", reason: "DECLARED_CLASSIFICATION" } : { class: null, basis: null, reason: "DECLARED_CLASS_NOT_IN_TARIFF" };
}

/** LOCALITY, `ALG-296` l2 to l5: the class the content assigns the area's province. */
function localityOf(content: TariffContent, inputs: readonly CalculationInput[]): LocalityEntry {
  const input = inputs.find((entry) => entry.fact === "admin_area");
  if (input === undefined || input.fact !== "admin_area") return { class: null, basis: null, reason: "CLASS_MISSING" };
  const key = areaKeyOf(input.value);
  const locality = key !== null ? (content.localityOf[key] ?? null) : null;
  const assigned = locality !== null && content.localityFactorHundredths[locality] !== undefined;
  if (input.source === "register") return assigned ? { class: locality, basis: "AUTHORITATIVE", reason: "RESOLVED_FROM_REFERENCE" } : { class: null, basis: null, reason: "NOT_IN_TARIFF" };
  return assigned ? { class: locality, basis: "DECLARED", reason: "DECLARED_CLASSIFICATION" } : { class: null, basis: null, reason: "DECLARED_CLASS_NOT_IN_TARIFF" };
}

/** `DR-321`: only an authoritative class the content does not list takes a premises out; a missing class leaves it open. */
function scopeOf(premisesClass: PremisesClassEntry, locality: LocalityEntry): ScopeOutcome {
  if (premisesClass.reason === "NOT_IN_TARIFF") return "OUT_OF_SCOPE";
  return premisesClass.class === null || locality.class === null ? "INDETERMINATE" : "IN_SCOPE";
}

const floorAreaOf = (inputs: readonly CalculationInput[]): number | null => {
  const input = inputs.find((entry) => entry.fact === "customer_area");
  return input !== undefined && input.fact === "customer_area" ? input.value : null;
};

const seatsOf = (inputs: readonly CalculationInput[]): number | null => {
  const input = inputs.find((entry) => entry.fact === "seating_capacity");
  return input !== undefined && input.fact === "seating_capacity" ? input.value : null;
};

/**
 * `ALG-295` step 4, on every call: MICRO_BUSINESS, effect ALL_COMPONENTS, with its two criteria, each held to at most
 * the content's limit. REG's customer area is the floor area the content reads. An absent fact is not met.
 */
function exemptionOf(content: TariffContent, inputs: readonly CalculationInput[]): ExemptionTested {
  const floor = floorAreaOf(inputs);
  const seats = seatsOf(inputs);
  const { floorAtMostM2, seatsAtMost } = content.microBusiness;
  const criteria: ExemptionTested["criteria"] = [
    { criterion: "MB-1", fact: "FLOOR_AREA_M2", atMost: floorAtMostM2, value: floor, met: floor !== null && floor <= floorAtMostM2 },
    { criterion: "MB-2", fact: "SEATING_CAPACITY", atMost: seatsAtMost, value: seats, met: seats !== null && seats <= seatsAtMost },
  ];
  return { code: "MICRO_BUSINESS", applied: criteria.every((criterion) => criterion.met), criteria };
}

// ------------------------------------------------------------------ mandate coverage (ALG-301's record, read by ALG-295)

/** The rights layer a mandate's scope row names, as the tariff's components are split. */
const LAYER_OF_RIGHT: Readonly<Record<string, TariffLayer>> = { performing: "AUTHORS", mechanical: "AUTHORS", performers: "PERFORMERS", producers: "PRODUCERS" };

const localDay = (instant: string) => addDays(instant, 0);

/**
 * Every mandate state change the tariff knows: those the handler recorded, then GOV's mandates as they stand where no
 * event was recorded for them - a mandate in effect from a recorded day is its first effect, a suspended or withdrawn
 * one stops the layers its scope covers from the day it stopped.
 */
function scopeChangeRows(key: string): ScopeChangeRow[] {
  const recorded = tariffOf(key).scopeChanges;
  const derived = ORGANISATIONS.flatMap((organisation): ScopeChangeRow[] => {
    const mandate = mandateOf(key, organisation.id, organisation.name).data?.mandate ?? null;
    if (mandate === null) return [];
    if (mandate.state === "EFFECTIVE" && mandate.effectiveFrom !== null) {
      const at = `${mandate.effectiveFrom}T00:00:00+07:00`;
      return [
        { key: `${organisation.id}-${mandate.effectiveFrom}`, mandate: organisation.id, effectiveAt: at, organisation: organisation.name, newState: "EFFECTIVE", change: "NONE", components: [], reason: "FIRST_EFFECT", version: versionOn(mandate.effectiveFrom)?.version ?? TARIFF.version, recordedAt: at, restoredOn: null },
      ];
    }
    if ((mandate.state === "SUSPENDED" || mandate.state === "WITHDRAWN") && mandate.stoppedOn !== null) {
      const at = `${mandate.stoppedOn}T00:00:00+07:00`;
      const components = layersOfRights(mandate.scope.map((row) => row.rightType));
      return [
        {
          key: `${organisation.id}-${mandate.stoppedOn}`,
          mandate: organisation.id,
          effectiveAt: at,
          organisation: organisation.name,
          newState: mandate.state,
          change: components.length > 0 ? "STOPPED" : "NONE",
          components,
          reason: components.length > 0 ? "SCOPE_STOPPED" : "NO_COMPONENT_AFFECTED",
          version: versionOn(mandate.stoppedOn)?.version ?? TARIFF.version,
          recordedAt: at,
          restoredOn: null,
        },
      ];
    }
    return [];
  });
  return [...recorded, ...derived.filter((row) => !recorded.some((entry) => entry.key === row.key))];
}

const layersOfRights = (rights: readonly string[]): TariffLayer[] =>
  LAYERS.filter((layer) => rights.some((right) => LAYER_OF_RIGHT[right] === layer));

/** The API's row of a recorded change: everything but the mandate it is keyed by. */
const changeOf = (row: ScopeChangeRow): MandateScopeChange => ({
  key: row.key,
  effectiveAt: row.effectiveAt,
  organisation: row.organisation,
  newState: row.newState,
  change: row.change,
  components: row.components,
  reason: row.reason,
  version: row.version,
  recordedAt: row.recordedAt,
  restoredOn: row.restoredOn,
});

/**
 * `IMandateCoverage` for a component on a decision date, as the record answers it: the latest stop of a mandate whose
 * scope carried the layer, effective on or before the date and recorded by `knownAt`, that no restoration of the same
 * mandate effective by the date undid. Its key is the authority of the exclusion (`mandateAuthority`).
 */
function stopOf(rows: readonly ScopeChangeRow[], layer: TariffLayer, decisionDate: string, knownAt: string): ScopeChangeRow | null {
  const known = rows.filter((row) => Date.parse(row.recordedAt) <= Date.parse(knownAt));
  const stops = known
    .filter((row) => row.change === "STOPPED" && row.components.includes(layer) && localDay(row.effectiveAt) <= decisionDate)
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
  return (
    stops.find(
      (stop) =>
        !known.some((row) => row.mandate === stop.mandate && row.change === "RESTORED" && localDay(row.effectiveAt) > localDay(stop.effectiveAt) && localDay(row.effectiveAt) <= decisionDate),
    ) ?? null
  );
}

// ------------------------------------------------------------------ the calculation (ALG-295 steps 1 to 9)

/** What the calculator works out before it is recorded. */
interface Worked {
  version: string;
  content: TariffContent;
  premisesClass: PremisesClassEntry;
  locality: LocalityEntry;
  scope: ScopeOutcome;
  exemption: ExemptionTested;
  components: CalculationComponent[];
  capApplied: boolean;
  amountBeforeCapMinor: number;
  beforeRoundingMinor: number;
  amountMinor: number | null;
}

type WorkAnswer = { worked: Worked } | Exclude<FeeAnswer, { outcome: "CALCULATED" }>;

const sizeBandKey = (band: TariffContent["bands"][number]) => `${String(band.fromM2)}-${band.toM2 !== null ? String(band.toM2) : ""}`;

/**
 * Steps 1 to 9 for a question: the version effective on the decision date (or, for a reproduction, the version the
 * original recorded), the classes, the exemption, each component's exact amount as a ratio of integers, its
 * treatment, then the one fraction dropped, the cap and the rounding. Nothing is recorded here.
 */
function work(key: string, question: FeeQuestion, recordedVersion: string | null, knownAt: string): WorkAnswer {
  const version = recordedVersion !== null ? (TARIFF_VERSIONS.find((entry) => entry.version === recordedVersion) ?? null) : versionOn(question.decisionDate);
  if (version === null) return { outcome: "NO_APPROVED_VERSION", reason: "NO_EFFECTIVE_VERSION" };
  const content = version.content;
  if (content === null) return { outcome: "NO_APPROVED_VERSION", reason: "CONTENT_MISSING" };
  // Step 2: an accepted claim needs a period to count its days in, and a period runs forward.
  const accepting = question.claims.some((claim) => claim.state === "ACCEPTED" || claim.state === "PARTLY_ACCEPTED");
  if (accepting && question.obligationPeriod === null) return { outcome: "CALCULATION_INPUT_INVALID", field: "obligationPeriod" };
  if (question.obligationPeriod !== null && question.obligationPeriod.to < question.obligationPeriod.from) return { outcome: "CALCULATION_INPUT_INVALID", field: "obligationPeriod" };

  const premisesClass = premisesClassOf(content, question.inputs);
  const locality = localityOf(content, question.inputs);
  const scope = scopeOf(premisesClass, locality);
  const exemption = exemptionOf(content, question.inputs);
  const nothing = { version: version.version, content, premisesClass, locality, scope, exemption, components: [], capApplied: false, amountBeforeCapMinor: 0, beforeRoundingMinor: 0 };
  if (scope !== "IN_SCOPE" || premisesClass.class === null || locality.class === null) return { worked: { ...nothing, amountMinor: null } };
  const floor = floorAreaOf(question.inputs);
  if (floor === null) return { outcome: "CALCULATION_INPUT_INVALID", field: "customer_area" };
  const band = content.bands.find((entry) => entry.fromM2 <= floor && (entry.toM2 === null || floor < entry.toM2));
  if (band === undefined) return { outcome: "CALCULATION_INPUT_INVALID", field: "customer_area" };

  const factors: AppliedFactor[] = [
    { kind: "LOCALITY", key: `LC-${String(locality.class)}`, factorHundredths: content.localityFactorHundredths[locality.class] ?? 0 },
    { kind: "PREMISES_CLASS", key: `PC-${premisesClass.class.toUpperCase()}`, factorHundredths: classFactor(content, premisesClass.class) ?? 0 },
    { kind: "SIZE_BAND", key: sizeBandKey(band), factorHundredths: band.factorHundredths },
  ];
  const period = question.obligationPeriod;
  const whole = BigInt(period !== null ? daysIn(period) : 1);
  const rows = scopeChangeRows(key);
  // Each exact amount is base x share x the factors, every one in hundredths: a whole number of 10^-8 dong, times
  // the days of the period it is charged for, so that a claim's share of the period stays an integer too.
  const planned = content.components.map((component) => {
    const layer = RIGHT_LAYER[component.right] ?? "AUTHORS";
    const exact = factors.reduce((product, factor) => product * BigInt(factor.factorHundredths), BigInt(content.baseAmountMinor) * BigInt(component.shareHundredths));
    const claims = question.claims.filter((claim) => claim.layer === layer);
    const acceptedBy = claims.filter((claim) => (claim.state === "ACCEPTED" || (claim.state === "PARTLY_ACCEPTED" && claim.accepted !== null)));
    const acceptedDays = period === null ? 0 : coveredDays(period, acceptedBy.map((claim) => (claim.state === "ACCEPTED" ? claim.period : (claim.accepted ?? claim.period))));
    const claimAuthority = acceptedBy.map((claim) => claim.ref).sort().join(",");
    const stop = stopOf(rows, layer, question.decisionDate, knownAt);
    let treatment: Treatment;
    let authority: string | null = null;
    let charged: bigint;
    if (stop !== null) {
      treatment = "EXCLUDED_MANDATE_STOPPED";
      authority = stop.key;
      charged = 0n;
    } else if (exemption.applied) {
      treatment = "EXEMPT";
      authority = exemption.code;
      charged = 0n;
    } else if (acceptedDays > 0 && BigInt(acceptedDays) >= whole) {
      treatment = "EXCLUDED_CLAIM_ACCEPTED";
      authority = claimAuthority;
      charged = 0n;
    } else if (acceptedDays > 0) {
      treatment = "REDUCED_CLAIM_ACCEPTED";
      authority = claimAuthority;
      charged = exact * (whole - BigInt(acceptedDays));
    } else {
      treatment = "CHARGED";
      charged = exact * whole;
    }
    const claimPending = treatment === "CHARGED" && claims.some((claim) => claim.state === "UNDER_REVIEW");
    return { component, layer, treatment, authority, charged, claimPending, reason: reasonOf(treatment, claims.length > 0) };
  });

  // Step 7: the one fraction dropped, then the whole-dong parts.
  const denominator = 100n ** BigInt(1 + factors.length) * whole;
  const beforeCap = planned.reduce((sum, part) => sum + part.charged, 0n) / denominator;
  const partsBeforeCap = apportion(beforeCap, planned.map((part) => part.charged));
  // Step 8: the cap reduces the parts pro rata.
  const cap = BigInt(content.capMinor);
  const capApplied = beforeCap > cap;
  const parts = capApplied ? apportion(cap, partsBeforeCap) : [...partsBeforeCap];
  const beforeRounding = parts.reduce((a, b) => a + b, 0n);
  // Step 9: DOWN_TO_UNIT on the capped total; the largest charged component takes the difference.
  const unit = BigInt(content.roundingUnitMinor);
  const chargedIndex = planned
    .map((part, i) => ({ i, charged: part.treatment === "CHARGED" || part.treatment === "REDUCED_CLAIM_ACCEPTED", value: parts[i] ?? 0n }))
    .filter((entry) => entry.charged)
    .reduce<{ i: number; value: bigint } | null>((best, entry) => (best === null || entry.value > best.value ? entry : best), null);
  const amount = chargedIndex === null ? 0n : (beforeRounding / unit) * unit;
  if (chargedIndex !== null) parts[chargedIndex.i] = (parts[chargedIndex.i] ?? 0n) + (amount - beforeRounding);

  const components: CalculationComponent[] = planned.map((part, i) => ({
    layer: part.layer,
    amountBeforeCapMinor: Number(partsBeforeCap[i] ?? 0n),
    amountMinor: Number(parts[i] ?? 0n),
    treatment: part.treatment,
    authority: part.authority,
    reason: part.reason,
    claimPending: part.claimPending,
    shareHundredths: part.component.shareHundredths,
    factors,
  }));
  return {
    worked: {
      ...nothing,
      components,
      capApplied,
      amountBeforeCapMinor: Number(beforeCap),
      beforeRoundingMinor: Number(beforeRounding),
      amountMinor: Number(amount),
    },
  };
}

/** The claims a calculation lists: each one REG holds a state for that bears on the fee. */
function claimsListed(claims: readonly FeeClaim[]): CalculationClaim[] {
  return claims.flatMap((claim): CalculationClaim[] => {
    switch (claim.state) {
      case "UNDER_REVIEW":
      case "NOT_ACCEPTED":
        return [{ layer: claim.layer, state: claim.state, accepted: null }];
      case "ACCEPTED":
        return [{ layer: claim.layer, state: "ACCEPTED", accepted: claim.period }];
      case "PARTLY_ACCEPTED":
        return [{ layer: claim.layer, state: "PARTLY_ACCEPTED", accepted: claim.accepted }];
      default:
        return [];
    }
  });
}

/** The calculation as the record keeps it, from what was worked out. */
function calculationOf(question: FeeQuestion, worked: Worked, reference: string, createdAt: string): Calculation {
  return {
    reference,
    purpose: "PRODUCTION",
    decisionDate: question.decisionDate,
    version: worked.version,
    instrument: instrumentOf(worked.version),
    baseAmountMinor: worked.content.baseAmountMinor,
    premises: premisesNamed(question.premisesId),
    answered: { kind: "review", application: question.application },
    requestedBy: "registration",
    createdAt,
    inputs: question.inputs,
    claims: claimsListed(question.claims),
    classification: {
      locality: { class: worked.locality.class, basis: worked.locality.basis },
      premisesClass: { class: worked.premisesClass.class, basis: worked.premisesClass.basis },
      scope: worked.scope,
    },
    components: worked.components,
    exemptions: [worked.exemption],
    cap: { capMinor: worked.content.capMinor, applied: worked.capApplied },
    rounding: { rule: "DOWN_TO_UNIT", unitMinor: worked.content.roundingUnitMinor, beforeMinor: worked.beforeRoundingMinor },
    amountBeforeCapMinor: worked.amountBeforeCapMinor,
    amountMinor: worked.amountMinor,
    transitionRule: TRANSITION_RULES[worked.version] ?? null,
    reproduces: null,
  };
}

/** What a calculation answers, for comparing two: every figure, not the reference or the moment. */
function figuresOf(calc: Calculation): string {
  return JSON.stringify([
    calc.decisionDate,
    calc.version,
    calc.premises.id,
    calc.inputs,
    calc.claims,
    calc.classification,
    calc.components,
    calc.exemptions,
    calc.cap,
    calc.rounding,
    calc.amountBeforeCapMinor,
    calc.amountMinor,
    calc.transitionRule,
  ]);
}

/**
 * Step 10 for a production: the row, and a watch for a declared premises class that none watches yet (SM-298 t1). A
 * question asked again with nothing changed answers with the row already recorded rather than a copy of it.
 */
function recordProduction(key: string, question: FeeQuestion, worked: Worked): Calculation {
  const book = tariffOf(key);
  const at = now();
  const fresh = calculationOf(question, worked, "", at);
  const same = [...book.calculations.values()]
    .reverse()
    .find((entry) => entry.question.application === question.application && figuresOf(entry.calculation) === figuresOf(fresh));
  if (same !== undefined) return same.calculation;
  let reference = tcl(randomBytes(8));
  while (book.calculations.has(reference)) reference = tcl(randomBytes(8));
  const calculation = { ...fresh, reference };
  book.calculations.set(reference, { calculation, question });
  if (worked.premisesClass.basis === "DECLARED" && worked.premisesClass.class !== null) {
    const watching = book.watches.some((watch) => watch.premises.id === question.premisesId && watch.status === "WATCHING");
    if (!watching) {
      book.watches.push({
        premises: calculation.premises,
        declared: worked.premisesClass.class,
        status: "WATCHING",
        reason: null,
        createdAt: at,
        firstCalculation: reference,
        lastCheckedAt: null,
        resolvedClass: null,
        resolvedAt: null,
        resolvedDecision: null,
      });
    }
  }
  return calculation;
}

// ------------------------------------------------------------------ the calculations the world's fees rest on

/**
 * The facts a canvas decision's fee rests on: the answers REG kept with the decision, else none.
 */
const factsOf = (key: string, ref: string): FactAnswers | null => decisionFactsOf(key, ref);

/** The facts the calculator read: the register's area and class, then what the premises answered. */
function inputsOf(premisesId: string, answers: FactAnswers | null, declaredClass: boolean): CalculationInput[] {
  const register = THEN_CUA().register.premises[premisesId] ?? null;
  const inputs: CalculationInput[] = [];
  if (register !== null) inputs.push({ fact: "admin_area", value: register.administrativeArea, source: "register" });
  const declared = answers?.premisesClass ?? null;
  if (register !== null && register.premisesClass !== null && !declaredClass) inputs.push({ fact: "premises_class", value: register.premisesClass, source: "register" });
  else if (declared !== null) inputs.push({ fact: "premises_class", value: declared, source: "declared" });
  if (answers === null) return inputs;
  if (answers.customerArea !== null) inputs.push({ fact: "customer_area", value: answers.customerArea, source: "declared" });
  if (answers.daysOpen !== null) inputs.push({ fact: "days_open", value: answers.daysOpen, source: "declared" });
  if (answers.musicMethod !== null) inputs.push({ fact: "music_method", value: answers.musicMethod, source: "declared" });
  if (answers.useBeganOn !== null) inputs.push({ fact: "use_began_on", value: answers.useBeganOn, source: "declared" });
  return inputs;
}

/** The classes of a canvas calculation, from its inputs, with the scope the decision records. */
function classificationOf(inputs: readonly CalculationInput[], scope: ScopeOutcome): Calculation["classification"] {
  const area = inputs.find((input) => input.fact === "admin_area");
  const premisesClass = inputs.find((input) => input.fact === "premises_class");
  const basis = (source: "register" | "declared"): ClassBasis => (source === "register" ? "AUTHORITATIVE" : "DECLARED");
  return {
    locality: area !== undefined && area.fact === "admin_area" ? { class: TARIFF.localityClass(area.value), basis: basis(area.source) } : { class: null, basis: null },
    premisesClass: premisesClass !== undefined && premisesClass.fact === "premises_class" ? { class: premisesClass.value, basis: basis(premisesClass.source) } : { class: null, basis: null },
    scope,
  };
}

/** TV-2026.1's content, which every canvas decision names (as "2026.1"). */
function canvasContent(): TariffContent {
  const content = TARIFF_VERSIONS.find((version) => version.version === versionNamed(TARIFF.version))?.content ?? null;
  if (content === null) throw new Error("TV-2026.1's content is written on the public pages");
  return content;
}

/** The cap applied to a canvas calculation's amounts, then the rounding of the capped total (DR-323). */
function canvasFigures(components: readonly CalculationComponent[]) {
  const total = components.reduce((sum, component) => sum + component.amountMinor, 0);
  const applied = total > TARIFF.capMinor;
  const capped = applied ? apportion(BigInt(TARIFF.capMinor), components.map((component) => BigInt(component.amountMinor))).map(Number) : components.map((component) => component.amountMinor);
  const beforeRounding = capped.reduce((sum, amount) => sum + amount, 0);
  return {
    components: components.map((component, i) => ({ ...component, amountBeforeCapMinor: component.amountMinor, amountMinor: capped[i] ?? component.amountMinor })),
    cap: { capMinor: TARIFF.capMinor, applied },
    rounding: { rule: "DOWN_TO_UNIT" as const, unitMinor: TARIFF.roundingUnitMinor, beforeMinor: beforeRounding },
    amountBeforeCapMinor: total,
    amountMinor: Math.floor(beforeRounding / TARIFF.roundingUnitMinor) * TARIFF.roundingUnitMinor,
  };
}

/**
 * The calculation a canvas decision rests on, read from the decision REG recorded: each layer's amount and treatment
 * as the canvas drew them, the exemption tested on the facts the decision rests on.
 */
function canvasDecisionCalculation(key: string, ref: string): Calculation | null {
  const found = decisionForCollection(key, ref);
  if (found === null) return null;
  const { summary, record } = found;
  const inputs = inputsOf(summary.premises.id, factsOf(key, ref), restsOnDeclaredClassification(key, ref));
  const inScope = record.basis !== "OUT_OF_SCOPE";
  const claims: CalculationClaim[] = [];
  const components: CalculationComponent[] = inScope
    ? LAYERS.map((layer) => {
        const lines = record.lines.filter((line) => line.layer === layer);
        const amountMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
        const accepted = lines.find((line) => line.treatment === "CLAIM_ACCEPTED") ?? null;
        const pending = lines.some((line) => line.treatment === "CLAIM_PENDING");
        if (pending) claims.push({ layer, state: "UNDER_REVIEW", accepted: null });
        if (accepted !== null) claims.push({ layer, state: lines.length > 1 ? "PARTLY_ACCEPTED" : "ACCEPTED", accepted: accepted.scope ?? record.period });
        const treatment: Treatment = lines.every((line) => line.treatment === "EXEMPT")
          ? "EXEMPT"
          : lines.every((line) => line.treatment === "MANDATE_STOPPED")
            ? "EXCLUDED_MANDATE_STOPPED"
            : accepted !== null
              ? lines.length > 1
                ? "REDUCED_CLAIM_ACCEPTED"
                : "EXCLUDED_CLAIM_ACCEPTED"
              : "CHARGED";
        return {
          layer,
          amountBeforeCapMinor: amountMinor,
          amountMinor,
          treatment,
          authority: treatment === "CHARGED" ? null : treatment === "EXEMPT" ? "MICRO_BUSINESS" : (record.application ?? null),
          reason: reasonOf(treatment, pending || accepted !== null),
          claimPending: pending,
          shareHundredths: null,
          factors: [],
        };
      })
    : [];
  const figures = canvasFigures(components);
  return {
    reference: referenceOf(ref),
    purpose: "PRODUCTION",
    decisionDate: record.period.from,
    version: record.tariffVersion,
    instrument: instrumentOf(record.tariffVersion),
    baseAmountMinor: null,
    premises: summary.premises,
    answered: { kind: "decision", reference: ref },
    requestedBy: "registration",
    createdAt: record.issuedAt,
    inputs,
    claims,
    classification: classificationOf(inputs, inScope ? "IN_SCOPE" : "OUT_OF_SCOPE"),
    exemptions: [exemptionOf(canvasContent(), inputs)],
    ...figures,
    components: inScope ? figures.components : [],
    ...(inScope ? {} : { amountMinor: null }),
    transitionRule: TRANSITION_RULES[versionNamed(record.tariffVersion)] ?? null,
    reproduces: null,
  };
}

/** The calculation the Sala draft's review rests on (SCR-REG-05), recorded before the draft was sent. */
function salaReviewCalculation(): Calculation {
  const sala = SALA_REVIEW_CALCULATION;
  const premises = THEN_CUA().premises.find((entry) => entry.id === sala.premisesId) ?? { id: sala.premisesId, name: sala.premisesId };
  const inputs = inputsOf(sala.premisesId, sala.answers, false);
  const components: CalculationComponent[] = LAYERS.map((layer) => ({
    layer,
    amountBeforeCapMinor: sala.lines[layer],
    amountMinor: sala.lines[layer],
    treatment: "CHARGED",
    authority: null,
    reason: layer === sala.claimPendingOn ? "CLAIM_NOT_ACCEPTED" : "CHARGED",
    claimPending: layer === sala.claimPendingOn,
    shareHundredths: null,
    factors: [],
  }));
  return {
    reference: referenceOf(sala.application),
    purpose: "PRODUCTION",
    decisionDate: sala.decisionDate,
    version: TARIFF.version,
    instrument: instrumentOf(TARIFF.version),
    baseAmountMinor: null,
    premises,
    answered: { kind: "review", application: sala.application },
    requestedBy: "registration",
    createdAt: sala.workedOutAt,
    inputs,
    claims: [{ layer: sala.claimPendingOn, state: "UNDER_REVIEW", accepted: null }],
    classification: classificationOf(inputs, "IN_SCOPE"),
    exemptions: [exemptionOf(canvasContent(), inputs)],
    ...canvasFigures(components),
    transitionRule: TRANSITION_RULES[versionNamed(TARIFF.version)] ?? null,
    reproduces: null,
  };
}

/** The decision that names each recorded calculation, by the calculation's reference. */
function decisionsByCalculation(key: string): Map<string, string> {
  const named = new Map<string, string>();
  for (const ref of decisionReferences(key)) {
    const calculation = decisionForCollection(key, ref)?.record.calculation ?? null;
    if (calculation !== null) named.set(calculation, ref);
  }
  return named;
}

/** A recorded calculation, answering the decision that names it, else the review of its application. */
function recordedProductions(key: string): Calculation[] {
  const named = decisionsByCalculation(key);
  return [...tariffOf(key).calculations.values()].map(({ calculation }) => {
    const decision = named.get(calculation.reference);
    return decision !== undefined ? { ...calculation, answered: { kind: "decision" as const, reference: decision } } : calculation;
  });
}

/** The calculation a decision rests on: the one the calculator recorded for it, else the canvas's record. */
function decisionCalculation(key: string, ref: string): Calculation | null {
  const named = decisionForCollection(key, ref)?.record.calculation ?? null;
  if (named !== null) return recordedProductions(key).find((entry) => entry.reference === named) ?? null;
  return canvasDecisionCalculation(key, ref);
}

/** Every production calculation of the world: those the calculator recorded, each canvas decision's, and the Sala review's. */
function productions(key: string): Calculation[] {
  const canvas = decisionReferences(key)
    .filter((ref) => (decisionForCollection(key, ref)?.record.calculation ?? null) === null)
    .map((ref) => canvasDecisionCalculation(key, ref))
    .filter((entry): entry is Calculation => entry !== null);
  return [...recordedProductions(key), ...canvas, salaReviewCalculation()];
}

/** The reproductions recorded here, as calculations of their own. */
function reproductionsOf(key: string): Calculation[] {
  return [...tariffOf(key).reproductions.values()].flat().map((entry) => entry.calculation);
}

/** The calculations corrections linked, each answering the correction it was made for. */
const linkedOf = (key: string): Calculation[] => [...tariffOf(key).linked.values()];

function find(key: string, ref: string): Calculation | null {
  return [...productions(key), ...reproductionsOf(key), ...linkedOf(key)].find((entry) => entry.reference === ref) ?? null;
}

/** The decision a calculation's fee belongs to: the one it answered, or the one the correction it answered corrects. */
const decisionOfCalculation = (entry: Calculation): string | null =>
  entry.answered.kind === "decision" ? entry.answered.reference : entry.answered.kind === "correction" ? entry.answered.decision : null;

// ------------------------------------------------------------------ reads

/** The last three months to today, the list's period until the reader chooses another. */
const lastMonths = (months: number) => addDays(`${today()}T12:00:00+07:00`, -Math.round(months * 30.4));

/**
 * SCR-TAR-08 (PERM-655): the calculations of the premises chosen between the two dates, a reproduction under the
 * calculation it reproduces, the latest decision date first. Nothing is read before a premises is chosen.
 */
export function calculationsOf(
  key: string,
  actor: TariffActor,
  asked: { premises: string | null; from: string | null; to: string | null },
): LoadOutcome<PremisesCalculations> {
  if (!holds(actor, "ACT-OPS", "ACT-FIN-OP", "ACT-AUD")) return refused("NOT_AUTHORISED");
  const options = premisesOptions();
  const filter = { premises: options.some((entry) => entry.id === asked.premises) ? asked.premises : null, from: asked.from ?? lastMonths(3), to: asked.to ?? today() };
  if (filter.to < filter.from) return refused("CURSOR_INVALID");
  if (filter.premises === null) return ok({ asOf: now(), premisesOptions: options, filter, rows: null });
  const inPeriod = (entry: Calculation) => entry.premises.id === filter.premises && entry.decisionDate >= filter.from && entry.decisionDate <= filter.to;
  const reproductions = reproductionsOf(key).filter(inPeriod);
  const linked = linkedOf(key).filter(inPeriod);
  // Under each production its reproductions, then the calculations corrections of the same fee linked.
  const rows = productions(key)
    .filter(inPeriod)
    .sort((a, b) => b.decisionDate.localeCompare(a.decisionDate) || b.createdAt.localeCompare(a.createdAt))
    .flatMap((entry) => [
      entry,
      ...reproductions.filter((reproduction) => reproduction.reproduces?.reference === entry.reference),
      ...linked.filter((correction) => entry.answered.kind === "decision" && decisionOfCalculation(correction) === entry.answered.reference),
    ]);
  return ok({ asOf: now(), premisesOptions: options, filter, rows });
}

/** SCR-TAR-09 (PERM-656): one calculation with its reproductions; the finance operator and the auditor may reproduce it. */
export function calculation(key: string, actor: TariffActor, ref: string): LoadOutcome<CalculationPage> {
  if (!holds(actor, "ACT-OPS", "ACT-FIN-OP", "ACT-AUD")) return refused("NOT_AUTHORISED");
  const found = find(key, ref);
  if (found === null) return refused("CALCULATION_NOT_FOUND");
  const declared = found.classification.premisesClass.basis === "DECLARED" || found.classification.locality.basis === "DECLARED";
  return ok({
    calculation: found,
    reproductions: (tariffOf(key).reproductions.get(found.reference) ?? []).map((entry) => ({
      reference: entry.reference,
      createdAt: entry.createdAt,
      requestedBy: entry.requestedBy,
      outcome: entry.outcome,
      differences: entry.differences,
    })),
    // A correction's linked calculation is reproduced through the fee it corrects, never on its own.
    mayReproduce: holds(actor, "ACT-FIN-OP", "ACT-AUD") && found.answered.kind !== "correction",
    declaredWatch: declared && holds(actor, "ACT-OPS"),
  });
}

/** `ALG-299` step 3: every field the comparison walks, the original's value beside the recomputed one. */
function differencesOf(original: Calculation, again: Calculation): Reproduction["differences"] {
  const text = (value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value.toString();
    return JSON.stringify(value);
  };
  const fields: [string, unknown, unknown][] = [
    ["scope", original.classification.scope, again.classification.scope],
    ["locality_class", original.classification.locality.class, again.classification.locality.class],
    ["locality_basis", original.classification.locality.basis, again.classification.locality.basis],
    ["premises_class", original.classification.premisesClass.class, again.classification.premisesClass.class],
    ["premises_class_basis", original.classification.premisesClass.basis, again.classification.premisesClass.basis],
    ["amount_before_cap", original.amountBeforeCapMinor, again.amountBeforeCapMinor],
    ["cap_applied", original.cap.applied, again.cap.applied],
    ["cap_amount", original.cap.capMinor, again.cap.capMinor],
    ["amount_before_rounding", original.rounding.beforeMinor, again.rounding.beforeMinor],
    ["rounding_unit", original.rounding.unitMinor, again.rounding.unitMinor],
    ["amount", original.amountMinor, again.amountMinor],
    ["transition_rule", original.transitionRule, again.transitionRule],
  ];
  for (const layer of LAYERS) {
    const a = original.components.find((component) => component.layer === layer);
    const b = again.components.find((component) => component.layer === layer);
    fields.push(
      [`${layer}.share`, a?.shareHundredths, b?.shareHundredths],
      [`${layer}.factors`, a?.factors, b?.factors],
      [`${layer}.amount_before_cap`, a?.amountBeforeCapMinor, b?.amountBeforeCapMinor],
      [`${layer}.amount`, a?.amountMinor, b?.amountMinor],
      [`${layer}.treatment`, a?.treatment, b?.treatment],
      [`${layer}.authority`, a?.authority, b?.authority],
      [`${layer}.reason`, a?.reason, b?.reason],
    );
  }
  for (const exemption of original.exemptions) {
    const other = again.exemptions.find((entry) => entry.code === exemption.code);
    fields.push([`${exemption.code}.criteria`, exemption.criteria, other?.criteria], [`${exemption.code}.applied`, exemption.applied, other?.applied]);
  }
  return fields.filter(([, a, b]) => text(a) !== text(b)).map(([field, a, b]) => ({ field, recorded: text(a), reproduced: text(b) }));
}

/**
 * POST /calculations/{ref}/reproductions (PERM-657, ALG-299): the calculation again, as a new REPRODUCTION row that
 * never changes the original. One the calculator recorded is recomputed with the version, inputs and decision date
 * it recorded, reading the mandate changes known when it was made; a canvas decision's is read from REG's record,
 * which holds no content to recompute from. A calculation that is not a production is not found.
 */
export function reproduce(key: string, actor: TariffActor, ref: string): LoadOutcome<{ reproduction: string }> {
  if (!holds(actor, "ACT-FIN-OP", "ACT-AUD")) return refused("NOT_AUTHORISED");
  const original = productions(key).find((entry) => entry.reference === ref) ?? null;
  if (original === null) return refused("CALCULATION_NOT_FOUND");
  const recorded = tariffOf(key).calculations.get(ref) ?? null;
  let replayed: Calculation | null;
  if (recorded !== null) {
    const answer = work(key, recorded.question, recorded.calculation.version, recorded.calculation.createdAt);
    replayed = "worked" in answer ? calculationOf(recorded.question, answer.worked, ref, recorded.calculation.createdAt) : null;
  } else {
    replayed = original.answered.kind === "decision" ? canvasDecisionCalculation(key, original.answered.reference) : salaReviewCalculation();
  }
  if (replayed === null) return refused("REFERENCE_DATA_UNAVAILABLE");
  const differences = differencesOf(original, replayed);
  const at = now();
  const reference = tcl(randomBytes(8));
  const outcome = differences.length === 0 ? ("MATCH" as const) : ("DIFFERENCE" as const);
  const reproduction = {
    reference,
    createdAt: at,
    requestedBy: holds(actor, "ACT-FIN-OP") ? ("ACT-FIN-OP" as const) : ("ACT-AUD" as const),
    outcome,
    differences,
    calculation: { ...replayed, reference, purpose: "REPRODUCTION" as const, answered: original.answered, createdAt: at, reproduces: { reference: original.reference, outcome } },
  };
  const book = tariffOf(key);
  book.reproductions.set(original.reference, [reproduction, ...(book.reproductions.get(original.reference) ?? [])]);
  return ok({ reproduction: reference });
}

/** The CFG-364 default: a watch whose decision never came closes after ninety days. */
const WATCH_DAYS = 90;

/**
 * The decision in force for a premises on a day (`IObligationDecisionReader.DecisionInForceAt`), from REG's decisions:
 * a current one whose period covers the day, or a replaced one for the days before its successor took effect.
 */
function decisionInForce(key: string, premisesId: string, day: string): string | null {
  return (
    decisionReferences(key).find((ref) => {
      const found = decisionForCollection(key, ref);
      if (found === null || found.summary.premises.id !== premisesId) return false;
      const { period, status, replacedBy } = found.summary;
      const to = status === "CURRENT" ? period.to : replacedBy !== null ? addDays(`${replacedBy.from}T00:00:00Z`, -1) : null;
      return to !== null && period.from <= day && day <= to;
    }) ?? null
  );
}

/** Today's run of the reconciliation sweep, once: the job runs daily, and a world read after its hour sees the run. */
function sweepDue(key: string): void {
  const book = tariffOf(key);
  if (book.sweptOn === today()) return;
  reconcileDeclaredClassifications(key);
}

/**
 * SCR-TAR-12 (PERM-661): every declared class a production calculation opened a watch for, with what the sweep made
 * of it and the decision in force now. The sweep's run of the day has run before the list is read.
 */
export function declaredClassifications(
  key: string,
  actor: TariffActor,
  filter: { status: WatchStatus | null; premises: string | null },
  opened: string | null,
): LoadOutcome<DeclaredClassifications> {
  if (!holds(actor, "ACT-OPS", "ACT-DAT", "ACT-AUD")) return refused("NOT_AUTHORISED");
  sweepDue(key);
  const day = today();
  const watches: DeclaredWatch[] = tariffOf(key)
    .watches.map((watch) => ({
      key: watch.firstCalculation,
      premises: watch.premises,
      kind: "PREMISES_CLASS" as const,
      declared: watch.declared,
      status: watch.status,
      createdAt: watch.createdAt,
      ageDays: Math.max(0, Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${localDay(watch.createdAt)}T00:00:00Z`)) / 86_400_000)),
      firstCalculation: watch.firstCalculation,
      decisionInForce: decisionInForce(key, watch.premises.id, day),
      lastCheckedAt: watch.lastCheckedAt,
      reason: watch.reason,
      resolvedClass: watch.resolvedClass,
      resolvedAt: watch.resolvedAt,
      resolvedDecision: watch.resolvedDecision,
    }))
    // WATCHING first, the oldest first.
    .sort((a, b) => Number(a.status !== "WATCHING") - Number(b.status !== "WATCHING") || a.createdAt.localeCompare(b.createdAt));
  const rows = watches.filter((watch) => (filter.status === null || watch.status === filter.status) && (filter.premises === null || watch.premises.id === filter.premises));
  return ok({
    asOf: now(),
    filter,
    premisesOptions: premisesOptions(),
    rows,
    opened: watches.find((watch) => watch.key === opened) ?? null,
    mayOpenCalculation: holds(actor, "ACT-OPS", "ACT-FIN-OP", "ACT-AUD"),
  });
}

/**
 * SCR-TAR-13 (PERM-662): each state change of a rights organisation's mandate that the tariff recorded, newest first,
 * a stop showing the restoration that later undid it. No change creates a tariff version.
 */
export function mandateScopeChanges(
  key: string,
  actor: TariffActor,
  asked: { change: MandateScopeChange["change"] | null; from: string | null; to: string | null },
  opened: string | null,
): LoadOutcome<MandateScopeChanges> {
  if (!holds(actor, "ACT-POL-PRE", "ACT-POL-APR", "ACT-FIN-OP", "ACT-AUD")) return refused("NOT_AUTHORISED");
  const filter = { change: asked.change, from: asked.from ?? lastMonths(6), to: asked.to ?? today() };
  if (filter.to < filter.from) return refused("CURSOR_INVALID");
  const all = scopeChangeRows(key);
  const changes: MandateScopeChange[] = all
    .map((row) => ({
      ...changeOf(row),
      restoredOn:
        row.change === "STOPPED"
          ? (all
              .filter((other) => other.mandate === row.mandate && other.change === "RESTORED" && other.effectiveAt > row.effectiveAt)
              .map((other) => localDay(other.effectiveAt))
              .sort()[0] ?? null)
          : null,
    }))
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
  const rows = changes.filter((change) => (filter.change === null || change.change === filter.change) && localDay(change.effectiveAt) >= filter.from && localDay(change.effectiveAt) <= filter.to);
  return ok({ asOf: now(), filter, rows, opened: changes.find((change) => change.key === opened) ?? null });
}

/**
 * SCR-TAR-14 (PERM-656, SEC-324): the calculation of a decision, for a person acting for its premises. A decision that
 * does not exist is not found; one of a premises PTY does not let the reader act for with PERM-656 now - a delegate
 * whose authority names another premises, a revoked one - is NOT_AUTHORISED_FOR_PREMISES.
 */
export function feeCalculation(key: string, _party: string, decision: string): LoadOutcome<FeeExplanation> {
  const found = decisionForCollection(key, decision);
  if (found === null) return refused("CALCULATION_NOT_FOUND");
  if (!mayActFor(key, found.summary.premises.id, "PERM-656")) return refused("NOT_AUTHORISED_FOR_PREMISES");
  const calc = decisionCalculation(key, decision);
  return calc === null ? refused("CALCULATION_NOT_FOUND") : ok({ decision, calculation: calc });
}

/** The application a calculation's fee was worked out for: its review's, its decision's, or the corrected decision's. */
function applicationAnswered(key: string, calc: Calculation): string | null {
  switch (calc.answered.kind) {
    case "review":
      return calc.answered.application;
    case "decision":
      return decisionForCollection(key, calc.answered.reference)?.record.application ?? null;
    case "correction":
      return decisionForCollection(key, calc.answered.decision)?.record.application ?? null;
  }
}

/**
 * SCR-TAR-14 opened from the review (`GET /calculations/{ref}`, PERM-656, SEC-324): the calculation a draft's review
 * recorded, for a person acting for its premises, refused in the contract's order. A reference no calculation of that
 * application carries is not found; a reproduction or a correction's linked calculation is NOT_AUTHORISED to a premises
 * actor, who reads production calculations only; a premises PTY does not let the reader act for now is
 * NOT_AUTHORISED_FOR_PREMISES.
 */
export function reviewFeeCalculation(key: string, application: string, ref: string): LoadOutcome<ReviewFeeExplanation> {
  const found = find(key, ref);
  if (found === null || applicationAnswered(key, found) !== application) return refused("CALCULATION_NOT_FOUND");
  if (found.purpose !== "PRODUCTION" || found.answered.kind === "correction") return refused("NOT_AUTHORISED");
  if (!mayActFor(key, found.premises.id, "PERM-656")) return refused("NOT_AUTHORISED_FOR_PREMISES");
  return ok({ application, calculation: found });
}

// ------------------------------------------------------------------ what other families call

/*
 * The contract between TAR and the families that ask it: REG's fee (`ITariffCalculator.Calculate`), the effective
 * date of a reported change and the change-report period (`ITariffReader`), the mandate handler GOV's event reaches,
 * the reconciliation sweep ACT-SYS runs, and FIN's linked calculation. The signatures are the contract; the bodies
 * follow wherever this family keeps its rows.
 */

/** A claim REG holds on the application, with the state that decides its treatment (DR-289, DR-322). */
export interface FeeClaim {
  /** The assertion, named as the authority of the treatment it gives. */
  ref: string;
  layer: TariffLayer;
  period: Period;
  state: "DRAFT" | "UNDER_REVIEW" | "ACCEPTED" | "PARTLY_ACCEPTED" | "NOT_ACCEPTED" | "WITHDRAWN";
  /** A partial acceptance's scope. */
  accepted: Period | null;
}

/** What REG asks the calculator: the facts with their provenance, the claims, the period, and the governing date. */
export interface FeeQuestion {
  /** The application the fee is worked out for: its review, its submission or an officer's outcome on it. */
  application: string;
  premisesId: string;
  /** The governing date: the first day the obligation covers (DR-288 row 3). */
  decisionDate: string;
  obligationPeriod: Period | null;
  inputs: readonly CalculationInput[];
  claims: readonly FeeClaim[];
}

/** The calculator's answer: a recorded production calculation, or why there is none. */
export type FeeAnswer =
  | { outcome: "CALCULATED"; calculation: Calculation }
  | { outcome: "NO_APPROVED_VERSION"; reason: "NO_EFFECTIVE_VERSION" | "CONTENT_MISSING" }
  | { outcome: "CALCULATION_INPUT_INVALID"; field: string };

/**
 * `ITariffCalculator.Calculate`, purpose PRODUCTION (ALG-295, ALG-296): the fee for a premises on a governing date
 * under the version effective that day, recorded with every figure that produced it. An answer that is OUT_OF_SCOPE
 * or INDETERMINATE carries its classes and exemption and no amount, which REG never reads as a fee.
 */
export function calculateFee(key: string, question: FeeQuestion): FeeAnswer {
  const answer = work(key, question, null, now());
  if (!("worked" in answer)) return answer;
  return { outcome: "CALCULATED", calculation: recordProduction(key, question, answer.worked) };
}

/**
 * `ITariffCalculator.Indicate`: the same calculation, recorded nowhere and naming no reference, for a figure a form
 * shows before anyone acts on it (the officer's fee on each outcome, the public guidance's indicative amount).
 */
export function indicateFee(key: string, question: FeeQuestion): FeeAnswer {
  const answer = work(key, question, null, now());
  if (!("worked" in answer)) return answer;
  return { outcome: "CALCULATED", calculation: { ...calculationOf(question, answer.worked, "", now()), purpose: "TRIAL" } };
}

/**
 * `TAR-CHANGE-REPORT-PERIOD` on a day (CFG-360): the version effective then, or the thirty-day default while none is
 * approved. REG's explanation quotes it, and ALG-302 holds a reported change to it.
 */
export function changeReportPeriodAt(day: string): { days: number; version: string | null } {
  const version = CHANGE_REPORT_PERIODS.filter((entry) => entry.from <= day).sort((a, b) => a.from.localeCompare(b.from)).pop() ?? null;
  return version !== null ? { days: version.days, version: version.id } : { days: CHANGE_REPORT_DEFAULT_DAYS, version: null };
}

/**
 * `ITariffReader.ChangeEffectiveOn` (ALG-302, DR-327): the date a change in a fee-determining fact takes effect, by the
 * transition rule of the version in force on the day it occurred and never from the day it was reported, and whether
 * the report came inside the change-report period in force that day.
 */
export function changeEffectiveOn(input: {
  changeOccurredOn: string;
  reportedOn: string;
  periodEndsOn: string | null;
}): { outcome: "EFFECTIVE_ON"; effectiveOn: string; transitionRule: TransitionRule; reportedWithinPeriod: boolean; periodDays: number } | { outcome: "NO_APPROVED_VERSION" } | { outcome: "CALCULATION_INPUT_INVALID" } {
  const { changeOccurredOn, reportedOn, periodEndsOn } = input;
  if (reportedOn < changeOccurredOn) return { outcome: "CALCULATION_INPUT_INVALID" };
  const version = versionOn(changeOccurredOn);
  const rule = version !== null && version.content !== null ? (TRANSITION_RULES[version.version] ?? null) : null;
  if (rule === null) return { outcome: "NO_APPROVED_VERSION" };
  let effectiveOn: string;
  if (rule === "FROM_CHANGE_DATE") effectiveOn = changeOccurredOn;
  else if (rule === "FROM_NEXT_MONTH") {
    const [year = 0, month = 1] = changeOccurredOn.split("-").map(Number);
    effectiveOn = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  } else {
    if (periodEndsOn === null) return { outcome: "CALCULATION_INPUT_INVALID" };
    effectiveOn = addDays(`${periodEndsOn}T00:00:00Z`, 1);
  }
  const period = changeReportPeriodAt(changeOccurredOn);
  const lastDay = addDays(`${changeOccurredOn}T00:00:00Z`, period.days);
  return { outcome: "EFFECTIVE_ON", effectiveOn, transitionRule: rule, reportedWithinPeriod: reportedOn <= lastDay, periodDays: period.days };
}

/**
 * `MandateStateChangedHandler` (ALG-301, DR-329) for `governance.mandate_state_changed`: the components the mandate's
 * scope carried, recorded as stopped or restored from the instant the change took effect, with the event as their
 * authority. A mandate that covers no component is recorded as NONE; an event delivered twice is recorded once
 * (EXC-TAR-06). No tariff version is created.
 */
export function recordMandateStateChange(
  key: string,
  event: { eventId: string; organisation: string; newState: MandateScopeChange["newState"]; effectiveAt: string; rights: readonly string[] },
): { recorded: MandateScopeChange } | { duplicate: true } {
  const book = tariffOf(key);
  if (book.scopeChanges.some((row) => row.key === event.eventId)) return { duplicate: true };
  const touched = layersOfRights(event.rights);
  const effectiveOn = localDay(event.effectiveAt);
  let change: MandateScopeChange["change"];
  let reason: MandateScopeChange["reason"];
  let components: TariffLayer[];
  if (touched.length === 0) {
    change = "NONE";
    reason = "NO_COMPONENT_AFFECTED";
    components = [];
  } else if (event.newState !== "EFFECTIVE") {
    change = "STOPPED";
    reason = "SCOPE_STOPPED";
    components = touched;
  } else {
    const rows = scopeChangeRows(key).filter((row) => row.mandate === event.organisation);
    const stop = rows.filter((row) => row.change === "STOPPED").sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0] ?? null;
    const restoredSince = stop !== null && rows.some((row) => row.change === "RESTORED" && row.effectiveAt > stop.effectiveAt);
    if (stop !== null && !restoredSince) {
      change = "RESTORED";
      reason = "SCOPE_RESTORED";
      components = stop.components.filter((layer) => touched.includes(layer));
    } else {
      change = "NONE";
      reason = "FIRST_EFFECT";
      components = [];
    }
  }
  const row: ScopeChangeRow = {
    key: event.eventId,
    mandate: event.organisation,
    effectiveAt: event.effectiveAt,
    organisation: organisationName(event.organisation),
    newState: event.newState,
    change,
    components,
    reason,
    version: versionOn(effectiveOn)?.version ?? TARIFF.version,
    recordedAt: now(),
    restoredOn: null,
  };
  book.scopeChanges.push(row);
  return { recorded: changeOf(row) };
}


/**
 * `Tariff.ReconcileDeclaredClassifications` (ALG-300, DR-328), the job ACT-SYS runs daily: each watch still WATCHING
 * is closed when its decision has gone or no longer rests on a declared class (row 4), or ninety days passed with no
 * decision; otherwise the register is asked again, and a class it answers resolves the watch the same (row 1) or
 * different (row 2), the second naming the decision in force for REG to amend (`tariff.classification_resolved`).
 * A register that does not answer leaves it watching (row 3). The register reader is the party register's answer.
 */
export function reconcileDeclaredClassifications(key: string, readClass: (premisesId: string) => PremisesClass | null = registerClassOf): { checked: number } {
  const book = tariffOf(key);
  const at = now();
  const day = today();
  let checked = 0;
  for (const watch of book.watches) {
    if (watch.status !== "WATCHING") continue;
    checked += 1;
    watch.lastCheckedAt = at;
    const decision = decisionInForce(key, watch.premises.id, day);
    if (decision === null) {
      const age = (Date.parse(at) - Date.parse(watch.createdAt)) / 86_400_000;
      if (age > WATCH_DAYS) {
        watch.status = "CLOSED";
        watch.reason = "NO_DECISION_IN_PERIOD";
      } else watch.reason = "STILL_UNRESOLVED";
      continue;
    }
    if (!restsOnDeclaredClassification(key, decision)) {
      watch.status = "CLOSED";
      watch.reason = "DECISION_NO_LONGER_DECLARED";
      continue;
    }
    const answered = readClass(watch.premises.id);
    if (answered === null) {
      watch.reason = "STILL_UNRESOLVED";
      continue;
    }
    watch.resolvedClass = answered;
    watch.resolvedAt = at;
    if (answered === watch.declared) {
      watch.status = "RESOLVED_SAME";
      watch.reason = "SAME_AS_DECLARED";
    } else {
      watch.status = "RESOLVED_DIFFERENT";
      watch.reason = "DIFFERENT_FROM_DECLARED";
      watch.resolvedDecision = decision;
    }
  }
  book.sweptOn = day;
  return { checked };
}

/**
 * POST /financial-corrections/{id}/create-linked-calculation, TAR's part (FR-FIN-011): the calculation a financial
 * correction links, recorded as a new row that never changes the calculation of the decision it corrects. It is that
 * calculation with the amount the correction refunds taken off the components in proportion to their share, the
 * dong the division leaves on the component it rounded down most, so the components add up to the fee less the
 * refund. It answers the correction, under the case the correction names, which is how the case's linkage reads it
 * back (CAS DR-51). Null when the decision has no calculation to correct, or the refund is more than its fee.
 */
export function recordLinkedCalculation(
  key: string,
  input: { decision: string; correction: string; caseRef: string | null; refundMinor: number },
): { reference: string; feeBeforeMinor: number; feeAfterMinor: number } | null {
  const original = decisionCalculation(key, input.decision);
  if (original === null || original.amountMinor === null || input.refundMinor <= 0 || input.refundMinor > original.amountMinor) return null;
  const before = original.components.reduce((sum, component) => sum + component.amountMinor, 0);
  const shares = original.components.map((component) => (before === 0 ? 0 : (component.amountMinor * input.refundMinor) / before));
  const taken = shares.map(Math.floor);
  const fractions = shares.map((share, index) => share - (taken[index] ?? 0));
  const largest = fractions.indexOf(Math.max(...fractions));
  taken[largest] = (taken[largest] ?? 0) + input.refundMinor - taken.reduce((sum, part) => sum + part, 0);
  const components = original.components.map((component, index) => {
    const amountMinor = component.amountMinor - (taken[index] ?? 0);
    return { ...component, amountBeforeCapMinor: amountMinor, amountMinor };
  });
  const after = original.amountMinor - input.refundMinor;
  const at = now();
  const reference = tcl(randomBytes(8));
  const linked: Calculation = {
    ...original,
    reference,
    answered: { kind: "correction", reference: input.correction, decision: input.decision, case: input.caseRef },
    requestedBy: "finance",
    createdAt: at,
    components,
    cap: { capMinor: original.cap.capMinor, applied: false },
    rounding: { ...original.rounding, beforeMinor: after },
    amountBeforeCapMinor: after,
    amountMinor: after,
    reproduces: null,
  };
  tariffOf(key).linked.set(reference, linked);
  return { reference, feeBeforeMinor: original.amountMinor, feeAfterMinor: after };
}
