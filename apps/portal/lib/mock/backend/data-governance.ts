import type { LoadOutcome } from "@rightone/ui";
import type {
  DerivationReason,
  GeographyApproval,
  GeographyDraft,
  GeographyDraftInput,
  GeographyLevel,
  GeographyPolicyPage,
  GeographyPolicyVersion,
  PreviewRow,
  ProvenanceClass,
  ProvenanceExport,
  ProvenanceExportRow,
  ProvenanceLookupAnswer,
  ProvenanceRefusalRecord,
  ProvenanceResolution,
  ResolveRequest,
  ResolvedInput,
} from "@/lib/api/data-governance";
import {
  APPROVED_LEVELS,
  PREVIEW_SCOPES,
  PROVENANCE_ORDER,
  SEED_GEOGRAPHY_POLICY,
  SEED_PROVENANCE,
  SEED_VALUES,
  type PreviewScope,
} from "@/lib/mock/data-governance";
import { addDays, now, today } from "./clock";
import { table, type StaffRole } from "./store";
import type { GeographyAnswer, GeographyArea, GeographyAsk, GeographyBasis, GeographyChild, GeographyPeriod, GeographyReason, GeographyRelease, GeographyTerms } from "@/lib/api/artist-geography";
import { GEOGRAPHY_AREAS, GEOGRAPHY_ARTISTS, GEOGRAPHY_BASES, GEOGRAPHY_PERIODS, geographyUse } from "@/lib/mock/artist-geography";

/**
 * DAT's behaviour for SCR-DAT-04 and 16, played by the mock backend: the provenance records of governed values,
 * append-only, with `DR-96` resolving a derived value's class from its inputs at the instant it is asked; and the
 * geography policies, immutable versions with their effective periods, with `DR-92` answering the preview. A world's
 * own state, seeded from the DAT boards.
 */

interface ProvenanceRecord {
  valueRef: string;
  provenanceClass: ProvenanceClass;
  recordedAt: string;
  /** The member of staff who recorded it; null for a job (ACT-SYS). */
  recordedBy: string | null;
}

interface StoredPolicy {
  version: number;
  permittedLevels: readonly GeographyLevel[];
  defaultLevel: GeographyLevel;
  minimumPopulation: number;
  differencingAcrossPeriods: boolean;
  effectiveFrom: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

interface DataGovernanceState {
  /** `reporting.provenance_records`: append-only; the last row of a value recorded by an instant is its class then. */
  provenance: ProvenanceRecord[];
  /** `reporting.geography_policies`, oldest first. */
  policies: StoredPolicy[];
  /**
   * The audit rows of a prohibition that fired (§3.1 of the contracts): each request for a governed value without its
   * class, refused CLASS_CANNOT_BE_OMITTED, with the caller and the instant. Append-only.
   */
  refusals: ProvenanceRefusalRecord[];
}

const stateOf = (key: string): DataGovernanceState =>
  table(key, "data-governance", () => ({
    provenance: SEED_PROVENANCE.map((record) => ({ ...record })),
    policies: [{ ...SEED_GEOGRAPHY_POLICY, approvedBy: null, approvedAt: null }],
    refusals: [],
  }));

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const holds = (roles: readonly StaffRole[], role: StaffRole) => roles.includes(role);

/** The member of staff who acts, as the session names them. */
export interface DataActor {
  roles: readonly StaffRole[];
  name: string;
}

// ---------------------------------------------------------------- provenance (SCR-DAT-04)

const CLASSES: readonly string[] = PROVENANCE_ORDER;
const strength = (provenanceClass: ProvenanceClass) => PROVENANCE_ORDER.indexOf(provenanceClass);
const isClass = (value: string): value is ProvenanceClass => CLASSES.includes(value);

/** The class a value carried at an instant: its last row recorded by then (`ALG-61` step 1). */
function recordAt(state: DataGovernanceState, valueRef: string, asOf: number): ProvenanceRecord | null {
  return state.provenance.filter((record) => record.valueRef === valueRef && Date.parse(record.recordedAt) <= asOf).at(-1) ?? null;
}

/** `DR-96` rows 5 to 7: a computed value is never stronger than its weakest input; all authoritative is derived. */
function derivedClass(weakest: ProvenanceClass): { provenanceClass: ProvenanceClass; reason: DerivationReason } {
  if (weakest === "authoritative") return { provenanceClass: "derived", reason: "DERIVED_FROM_AUTHORITATIVE" };
  if (weakest === "estimated") return { provenanceClass: "estimated", reason: "WEAKEST_INPUT_ESTIMATED" };
  if (weakest === "imputed") return { provenanceClass: "imputed", reason: "WEAKEST_INPUT_IMPUTED" };
  return { provenanceClass: weakest, reason: "WEAKEST_INPUT" };
}

/**
 * `DR-96` row 8, the prohibition: the caller who asked for a governed value without its class gets nothing, and the
 * attempt is recorded with the caller and the instant, because the attempt is the evidence that the control fired.
 */
function refuseOmitted(state: DataGovernanceState, actor: DataActor, valueRefs: readonly string[]): ProvenanceResolution {
  const record: ProvenanceRefusalRecord = { code: "CLASS_CANNOT_BE_OMITTED", caller: actor.name, valueRefs: [...valueRefs], attemptedAt: now() };
  state.refusals.push(record);
  return { resolved: null, refusal: { code: record.code, input: null, attempt: { by: record.caller, at: record.attemptedAt } } };
}

const refuseResolve = (code: "FIELD_MISSING" | "PROVENANCE_CLASS_MISSING" | "PROVENANCE_CLASS_UNKNOWN", input: string): ProvenanceResolution => ({
  resolved: null,
  refusal: { code, input, attempt: null },
});

/**
 * `POST /provenance/resolve` (ACT-DAT), `ALG-61`: the class a value derived from these inputs carries at `as_of`, and
 * the input that decided it. Each input carries the class its caller states for it, which a recorded one never
 * overrides, or else the class recorded for it by `as_of`. Boundary checks first (no inputs, no instant: FIELD_MISSING,
 * since `as_of` is never defaulted), then `DR-96` in its evaluation order: an input with neither class is
 * PROVENANCE_CLASS_MISSING and a class outside the six PROVENANCE_CLASS_UNKNOWN, each naming the input (rows 1, 2); then
 * a caller asking without the class is refused and recorded (row 8); then the weakest input decides (rows 5 to 7).
 * Nothing is stored but the refused attempt.
 */
export function resolveProvenance(key: string, actor: DataActor, request: ResolveRequest): LoadOutcome<ProvenanceResolution> {
  if (!holds(actor.roles, "ACT-DAT")) return refused("NOT_AUTHORISED");
  if (request.inputs.length === 0 || request.inputs.some((input) => input.valueRef.trim() === "")) return ok(refuseResolve("FIELD_MISSING", "input_value_refs"));
  if (request.asOf === null || Number.isNaN(Date.parse(request.asOf))) return ok(refuseResolve("FIELD_MISSING", "as_of"));
  const state = stateOf(key);
  const asOf = Date.parse(request.asOf);
  const read = request.inputs.map((input) => {
    const stated = input.provenanceClass?.trim() ?? "";
    const record = stated === "" ? recordAt(state, input.valueRef, asOf) : null;
    return { valueRef: input.valueRef, stated, record };
  });
  const unclassed = read.find((input) => input.stated === "" && input.record === null);
  if (unclassed !== undefined) return ok(refuseResolve("PROVENANCE_CLASS_MISSING", unclassed.valueRef));
  const unknown = read.find((input) => input.stated !== "" && !isClass(input.stated));
  if (unknown !== undefined) return ok(refuseResolve("PROVENANCE_CLASS_UNKNOWN", unknown.valueRef));
  if (!request.withClass) return ok(refuseOmitted(state, actor, request.inputs.map((input) => input.valueRef)));

  const classed = read.map((input) => ({
    valueRef: input.valueRef,
    provenanceClass: input.record?.provenanceClass ?? (input.stated as ProvenanceClass),
    stated: input.record === null,
    recordedAt: input.record?.recordedAt ?? null,
  }));
  const weakest = classed.reduce((weak, input) => (strength(input.provenanceClass) > strength(weak.provenanceClass) ? input : weak));
  const decided = derivedClass(weakest.provenanceClass);
  const inputs: ResolvedInput[] = [...classed]
    .sort((a, b) => strength(a.provenanceClass) - strength(b.provenanceClass))
    .map((input) => ({ ...input, weakest: input.valueRef === weakest.valueRef }));
  return ok({ resolved: { provenanceClass: decided.provenanceClass, reason: decided.reason, decidedBy: weakest.valueRef, inputs, asOf: request.asOf }, refusal: null });
}

/**
 * SCR-DAT-04's lookup of one value at `as_of`: a value a report derives is resolved from its inputs through
 * `POST /provenance/resolve`; a stored value answers with the row recorded for it by then (`IProvenance.ProvenanceOf`).
 * Either way the class goes with the value: a caller that asked for the value alone (`fields=value`) is refused
 * CLASS_CANNOT_BE_OMITTED and the attempt recorded, and a value with no class at that instant names what has none.
 */
export function lookUpProvenance(key: string, actor: DataActor, valueRef: string, asOf: string, withClass: boolean): LoadOutcome<ProvenanceLookupAnswer> {
  if (!holds(actor.roles, "ACT-DAT")) return refused("NOT_AUTHORISED");
  const state = stateOf(key);
  const seed = SEED_VALUES.find((value) => value.valueRef === valueRef) ?? null;
  const base = { valueRef, note: seed?.note ?? null, asOf, lookedUpAt: now() };
  const unclassed = (missing: string): ProvenanceLookupAnswer => ({ lookup: { ...base, provenanceClass: null, decidedBy: null, inputs: null, missing }, omitted: null });

  if (seed !== null && seed.derivedFrom !== null) {
    const venues = new Map(seed.derivedFrom.map((input) => [input.input, input.venues]));
    const answer = resolveProvenance(key, actor, { inputs: seed.derivedFrom.map((input) => ({ valueRef: input.input })), asOf, withClass });
    if (answer.data === null) return { data: null, failure: answer.failure };
    const { resolved, refusal } = answer.data;
    if (refusal !== null) {
      if (refusal.code === "CLASS_CANNOT_BE_OMITTED" && refusal.attempt !== null) return ok({ lookup: null, omitted: refusal.attempt });
      if (refusal.code === "PROVENANCE_CLASS_MISSING" && refusal.input !== null) return ok(unclassed(refusal.input));
      throw new Error(`Resolving ${valueRef} was refused ${refusal.code}.`);
    }
    return ok({
      lookup: {
        ...base,
        provenanceClass: resolved.provenanceClass,
        decidedBy: { kind: "INPUT", input: resolved.decidedBy, reason: resolved.reason },
        inputs: resolved.inputs.map((input) => ({ input: input.valueRef, provenanceClass: input.provenanceClass, venues: venues.get(input.valueRef) ?? 0, weakest: input.weakest })),
        missing: null,
      },
      omitted: null,
    });
  }

  const record = recordAt(state, valueRef, Date.parse(asOf));
  if (record === null) return ok(unclassed(valueRef));
  if (!withClass) {
    const refusal = refuseOmitted(state, actor, [valueRef]).refusal;
    return ok({ lookup: null, omitted: refusal?.attempt ?? null });
  }
  return ok({
    lookup: { ...base, provenanceClass: record.provenanceClass, decidedBy: { kind: "RECORD", recordedAt: record.recordedAt, recordedBy: record.recordedBy }, inputs: null, missing: null },
    omitted: null,
  });
}

/** The refused requests for a value without its class, newest first: the evidence the control fired (ACT-DAT, ACT-AUD). */
export function provenanceRefusals(key: string, roles: readonly StaffRole[]): LoadOutcome<readonly ProvenanceRefusalRecord[]> {
  if (!holds(roles, "ACT-DAT") && !holds(roles, "ACT-AUD")) return refused("NOT_AUTHORISED");
  return ok([...stateOf(key).refusals].reverse());
}

/**
 * A governed export of one figure at `as_of` (FR-DAT-026, `@AC-FR-DAT-026-04`): the figure, then for a derived figure
 * every input it was derived from, strongest first, each row carrying its class as a column rather than a note. The
 * class goes with every value or nothing leaves: a figure with no class at that instant, or derived from an input with
 * none, is refused PROVENANCE_CLASS_MISSING and no row is exported (ACT-DAT).
 */
export function exportProvenance(key: string, actor: DataActor, valueRef: string, asOf: string): LoadOutcome<ProvenanceExport> {
  const answer = lookUpProvenance(key, actor, valueRef, asOf, true);
  if (answer.data === null) return { data: null, failure: answer.failure };
  const lookup = answer.data.lookup;
  if (lookup === null || lookup.provenanceClass === null) return refused("PROVENANCE_CLASS_MISSING");
  const figure: ProvenanceExportRow = {
    valueRef: lookup.valueRef,
    role: "FIGURE",
    provenanceClass: lookup.provenanceClass,
    decidedBy: lookup.decidedBy?.kind === "INPUT" ? lookup.decidedBy.input : null,
    venues: null,
  };
  const inputs = (lookup.inputs ?? []).map((input): ProvenanceExportRow => ({ valueRef: input.input, role: "INPUT", provenanceClass: input.provenanceClass, decidedBy: null, venues: input.venues }));
  return ok({ rows: [figure, ...inputs], asOf, exportedAt: now() });
}

/**
 * `POST /provenance-records` (ACT-DAT): the class of one value, appended; a reclassified value is a new row. No class
 * is PROVENANCE_CLASS_MISSING and one outside the six PROVENANCE_CLASS_UNKNOWN (`DR-96` rows 1, 2), and nothing is
 * stored. A derived value takes its class from its inputs, so it is not recorded here.
 */
export function recordProvenanceClass(key: string, actor: DataActor, valueRef: string, asked: string): LoadOutcome<{ recorded: ProvenanceClass }> {
  if (!holds(actor.roles, "ACT-DAT")) return refused("NOT_AUTHORISED");
  if (asked === "") return refused("PROVENANCE_CLASS_MISSING");
  if (!CLASSES.includes(asked)) return refused("PROVENANCE_CLASS_UNKNOWN");
  if (SEED_VALUES.some((value) => value.valueRef === valueRef && value.derivedFrom !== null)) throw new Error("A derived value takes its class from its inputs.");
  const provenanceClass = asked as ProvenanceClass;
  stateOf(key).provenance.push({ valueRef, provenanceClass, recordedAt: now(), recordedBy: actor.name });
  return ok({ recorded: provenanceClass });
}

// ---------------------------------------------------------------- geography policy (SCR-DAT-16)

/** The versions with their periods: each ends the day before the next one takes effect. */
function versionsOf(state: DataGovernanceState): GeographyPolicyVersion[] {
  return state.policies.map((policy, index) => {
    const next = state.policies[index + 1];
    return { ...policy, effectiveTo: next !== undefined ? addDays(`${next.effectiveFrom}T12:00:00+07:00`, -1) : null };
  });
}

/** The version governing a day. The seed's first version governs from before any day a reader can ask. */
function inForceOn(versions: readonly GeographyPolicyVersion[], day: string): GeographyPolicyVersion {
  const found = [...versions].reverse().find((version) => version.effectiveFrom <= day) ?? versions[0];
  if (found === undefined) throw new Error("A geography policy is always in force.");
  return found;
}

/** The first day of the month after today: the day a new version takes effect unless the officer says otherwise. */
function firstOfNextMonth(): string {
  const [year = 0, month = 1] = today().split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

/** The policy terms a preview evaluates under. */
interface Terms {
  defaultLevel: GeographyLevel;
  minimumPopulation: number;
  differencingAcrossPeriods: boolean;
}

/**
 * `DR-92` for each scope, in its order: differencing first (row 7; across areas always, across periods only where the
 * policy says so), then the population against the minimum, inclusive (rows 1, 2), then the default level (row 3).
 * A suppressed scope stays a row of its own and is never added to its neighbour (row 8).
 */
function evaluate(scope: PreviewScope, terms: Terms): PreviewRow {
  const row = { key: scope.key, area: scope.area, period: scope.period, level: scope.level, venues: scope.venues };
  if (scope.differsByPeriod && terms.differencingAcrossPeriods) return { ...row, outcome: "REFUSE", reason: "DIFFERENCING_WOULD_DISCLOSE" };
  if (scope.venues < terms.minimumPopulation) return { ...row, outcome: "SUPPRESS", reason: "GEOGRAPHY_BELOW_MINIMUM" };
  if (scope.venues === terms.minimumPopulation) return { ...row, outcome: "RELEASE", reason: "AT_MINIMUM_INCLUSIVE" };
  return { ...row, outcome: "RELEASE", reason: "DEFAULT_LEVEL" };
}

const LEVELS: readonly string[] = ["province", "ward"];
const isLevel = (value: string): value is GeographyLevel => LEVELS.includes(value);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The checks `POST /geography-policies` makes, field by field, before anything is written: every field present
 * (FIELD_MISSING); only levels approved for artist analytics (LEVEL_NOT_PERMITTED); a default among the permitted
 * levels (DEFAULT_LEVEL_NOT_PERMITTED); a minimum of two or more (MINIMUM_POPULATION_INVALID); and no day already
 * governed by another version (EFFECTIVE_PERIOD_OVERLAP), listing those days.
 */
function check(state: DataGovernanceState, input: GeographyDraftInput): GeographyDraft {
  const refusals: GeographyDraft["refusals"] = {};
  const levels = input.levels.filter(isLevel);
  if (input.levels.length === 0) refusals.levels = "FIELD_MISSING";
  else if (levels.length !== input.levels.length || levels.some((level) => !APPROVED_LEVELS.includes(level))) refusals.levels = "LEVEL_NOT_PERMITTED";
  if (input.defaultLevel === "") refusals.defaultLevel = "FIELD_MISSING";
  else if (!levels.some((level) => level === input.defaultLevel)) refusals.defaultLevel = "DEFAULT_LEVEL_NOT_PERMITTED";
  const minimum = input.minimum.trim();
  if (minimum === "") refusals.minimum = "FIELD_MISSING";
  else if (!/^\d+$/.test(minimum) || Number(minimum) < 2) refusals.minimum = "MINIMUM_POPULATION_INVALID";
  let overlap: GeographyDraft["overlap"] = null;
  if (!DAY.test(input.effectiveFrom)) refusals.effectiveFrom = "FIELD_MISSING";
  else {
    const latest = state.policies.at(-1);
    const governedTo = latest !== undefined && latest.effectiveFrom > today() ? latest.effectiveFrom : today();
    if (input.effectiveFrom <= governedTo) {
      refusals.effectiveFrom = "EFFECTIVE_PERIOD_OVERLAP";
      overlap = { from: input.effectiveFrom, to: governedTo };
    }
  }
  return { input, refusals, overlap, previewed: Object.keys(refusals).length === 0 };
}

/** "Xem trước" (ACT-DPO): the draft checked, nothing written. */
export function checkGeographyDraft(key: string, roles: readonly StaffRole[], input: GeographyDraftInput): LoadOutcome<GeographyDraft> {
  if (!holds(roles, "ACT-DPO")) return refused("NOT_AUTHORISED");
  return ok(check(stateOf(key), input));
}

/**
 * The geography policy for the data protection officer (ACT-DPO): the version in force, an approved one still to
 * take effect, and the preview of the scopes under the version in force, or under the draft once it passes its checks.
 */
export function geographyPolicy(
  key: string,
  roles: readonly StaffRole[],
  filter: { area: string; period: "q3" | "sep" },
  draft: GeographyDraft | null,
): LoadOutcome<GeographyPolicyPage> {
  if (!holds(roles, "ACT-DPO")) return refused("NOT_AUTHORISED");
  const state = stateOf(key);
  const versions = versionsOf(state);
  const inForce = inForceOn(versions, today());
  const next = versions.find((version) => version.effectiveFrom > today()) ?? null;
  const underDraft = draft !== null && draft.previewed;
  const terms: Terms = underDraft
    ? { defaultLevel: draft.input.defaultLevel as GeographyLevel, minimumPopulation: Number(draft.input.minimum), differencingAcrossPeriods: draft.input.differencing }
    : inForce;
  const wanted = filter.area.trim().toLocaleLowerCase("vi");
  const rows = PREVIEW_SCOPES.filter((scope) => (filter.period === "q3" || scope.period === "2026-09") && (wanted === "" || scope.area.toLocaleLowerCase("vi").includes(wanted)))
    .map((scope) => evaluate(scope, terms))
    .sort((a, b) => b.venues - a.venues);
  return ok({
    inForce,
    next,
    nextVersionNo: (state.policies.at(-1)?.version ?? 0) + 1,
    approvedLevels: APPROVED_LEVELS,
    preview: { period: filter.period, area: filter.area, under: underDraft ? "DRAFT" : "IN_FORCE", rows },
    draft,
    defaultEffectiveFrom: firstOfNextMonth(),
  });
}

/**
 * `POST /geography-policies` (ACT-DPO), confirmed: the draft checked again and, when it passes, written as the next
 * version with the officer who approved it. The version before it ends the day before; nothing already released is
 * retracted.
 */
export function approveGeographyPolicy(key: string, actor: DataActor, input: GeographyDraftInput): LoadOutcome<GeographyApproval> {
  if (!holds(actor.roles, "ACT-DPO")) return refused("NOT_AUTHORISED");
  const state = stateOf(key);
  const draft = check(state, input);
  if (!draft.previewed) return ok({ approved: null, draft });
  const version = (state.policies.at(-1)?.version ?? 0) + 1;
  state.policies.push({
    version,
    permittedLevels: input.levels.filter(isLevel),
    defaultLevel: input.defaultLevel as GeographyLevel,
    minimumPopulation: Number(input.minimum),
    differencingAcrossPeriods: input.differencing,
    effectiveFrom: input.effectiveFrom,
    approvedBy: actor.name,
    approvedAt: now(),
  });
  return ok({ approved: { version, effectiveFrom: input.effectiveFrom }, draft });
}

// ---------------------------------------------------------------- the artist's location view (GET /artist-geography)

/** A scope as `DR-92` weighs it: an area over a period, the premises it covers and the plays of the artist's works there. */
interface GeographyScope {
  area: GeographyArea;
  period: GeographyPeriod;
  premises: ReadonlySet<string>;
  plays: number;
}

/**
 * `reporting.geography_releases`: every answer an artist was given, released, suppressed or refused, append-only, in a
 * table of its own beside the console's. A scope is kept by its area and period and the signature of the premises set
 * it covered; the set is derived again from them for the differencing check and is never returned.
 */
interface StoredGeographyRelease {
  artist: string;
  by: string;
  policyVersion: number;
  signature: string;
  premisesCount: number;
  answer: GeographyAnswer;
}

const releaseLog = (key: string): { releases: StoredGeographyRelease[] } => table(key, "artist-geography", () => ({ releases: [] }));

/** The terms of the geography policy in force today, which bound every answer an artist is given. */
export function geographyTermsInForce(key: string): GeographyTerms {
  const policy = inForceOn(versionsOf(stateOf(key)), today());
  return {
    version: policy.version,
    permittedLevels: [...policy.permittedLevels],
    defaultLevel: policy.defaultLevel,
    minimum: policy.minimumPopulation,
    differencingAcrossPeriods: policy.differencingAcrossPeriods,
  };
}

/** What `DR-92` is asked: the scope and the level, the basis effective for the artist, and what they already hold. */
export interface GeographyQuestion {
  terms: GeographyTerms;
  scope: GeographyScope;
  requestedLevel: string;
  identify: boolean;
  /** The basis effective for this artist now, and the latest one that has lapsed. */
  basis: GeographyBasis | null;
  lapsed: GeographyBasis | null;
  /** The scopes already released to this artist. */
  prior: readonly GeographyScope[];
  /** The areas of the scope at the level asked, where it is finer than the default. */
  children: readonly GeographyScope[];
}

export type GeographyDecision = Pick<GeographyAnswer, "outcome" | "reason" | "level" | "plays" | "basis" | "lapsedBasis" | "children" | "compared">;

const outside = (set: ReadonlySet<string>, other: ReadonlySet<string>) => [...set].filter((premises) => !other.has(premises)).length;

/**
 * `DR-92` in `ALG-66`'s order: a level the policy does not permit, then a request for a premises identity (row 6),
 * then the differencing check against every answer already released to the artist (row 7), before the population:
 * two answers whose premises overlap and differ by fewer premises than the minimum, either way round, would disclose
 * those premises, by area always and by period where the policy says so. Then the population, inclusive at the
 * minimum (rows 1, 2), and the level: the default needs no basis (row 3), a finer level needs one effective for it
 * (row 4), and without one the answer falls back to the default and says the finer basis is not effective (row 5). A
 * finer answer shows each area below the minimum as suppressed and adds its figure to no neighbour (row 8).
 */
export function decideGeography(question: GeographyQuestion): GeographyDecision {
  const { terms, scope } = question;
  const nothing = { level: null, plays: null, basis: null, lapsedBasis: null, children: [], compared: null };
  const refuse = (reason: GeographyReason): GeographyDecision => ({ outcome: "REFUSE", reason, ...nothing });
  if (!terms.permittedLevels.some((level) => level === question.requestedLevel)) return refuse("LEVEL_NOT_PERMITTED");
  if (question.identify) return refuse("PREMISES_IDENTITY_NOT_DISCLOSABLE");
  for (const prior of question.prior) {
    const acrossPeriods = prior.area.code === scope.area.code && prior.period.code !== scope.period.code;
    if (acrossPeriods && !terms.differencingAcrossPeriods) continue;
    if (![...scope.premises].some((premises) => prior.premises.has(premises))) continue;
    const discloses = [outside(scope.premises, prior.premises), outside(prior.premises, scope.premises)].some((count) => count > 0 && count < terms.minimum);
    if (discloses) return { ...refuse("DIFFERENCING_WOULD_DISCLOSE"), compared: { area: prior.area, period: prior.period } };
  }
  const population = scope.premises.size;
  if (population < terms.minimum) return { outcome: "SUPPRESS", reason: "GEOGRAPHY_BELOW_MINIMUM", ...nothing };
  const atMinimum = population === terms.minimum;
  if (question.requestedLevel === terms.defaultLevel) {
    return { ...nothing, outcome: "RELEASE", reason: atMinimum ? "AT_MINIMUM_INCLUSIVE" : "DEFAULT_LEVEL", level: terms.defaultLevel, plays: scope.plays };
  }
  const basis = question.basis;
  if (basis !== null && basis.level === question.requestedLevel) {
    const children: GeographyChild[] = question.children.map((child) => {
      const suppressed = child.premises.size < terms.minimum;
      return { area: child.area, plays: suppressed ? null : child.plays, suppressed };
    });
    return { ...nothing, outcome: "RELEASE", reason: "BASIS_PERMITS_FINER_LEVEL", level: basis.level, plays: scope.plays, basis, children };
  }
  return { ...nothing, outcome: "RELEASE", reason: "BASIS_NOT_EFFECTIVE", level: terms.defaultLevel, plays: scope.plays, lapsedBasis: question.lapsed };
}

/** A stable signature of a premises set, the same for the same scope and period, that discloses none of its members. */
function signatureOf(premises: ReadonlySet<string>): string {
  let hash = 0x811c9dc5;
  for (const char of [...premises].sort().join("|")) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

function scopeOf(area: GeographyArea, period: GeographyPeriod): GeographyScope {
  const use = geographyUse(area.code, period.code);
  return { area, period, premises: use.premises, plays: use.plays };
}

/** The artist's party, for the read is of their own works only (ACT-ART). */
const artistParty = (artist: { email: string }) => GEOGRAPHY_ARTISTS.find((candidate) => candidate.email === artist.email.trim().toLowerCase())?.party ?? null;

/**
 * `GET /api/v1/reporting/artist-geography` (ACT-ART, for their own works): one province, the level of detail asked and
 * a period, answered under the geography policy in force and the disclosure basis effective for the artist today, as
 * `DR-92` decides. Every answer, released, suppressed or refused, is written to the release log with the artist and the
 * instant before it is returned, because an answer nothing recorded makes the differencing check unenforceable from
 * then on. A suppressed figure says it is suppressed rather than that there was no use; no premises identity and no
 * premises count is ever returned.
 */
export function artistGeography(key: string, artist: { email: string; name: string }, asked: GeographyAsk): LoadOutcome<GeographyAnswer> {
  const party = artistParty(artist);
  if (party === null) return refused("NOT_AUTHORISED");
  const area = GEOGRAPHY_AREAS.find((candidate) => candidate.code === asked.area && candidate.parent === null);
  const period = GEOGRAPHY_PERIODS.find((candidate) => candidate.code === asked.period);
  if (area === undefined || period === undefined) return refused("FIELD_MISSING");
  const terms = geographyTermsInForce(key);
  const log = releaseLog(key);
  const day = today();
  const bases = GEOGRAPHY_BASES.filter((basis) => basis.artist === party && basis.effectiveFrom <= day);
  const effective = bases.find((basis) => basis.effectiveTo === null || basis.effectiveTo >= day) ?? null;
  const lapsed = bases.filter((basis) => basis.effectiveTo !== null && basis.effectiveTo < day).sort((a, b) => (b.effectiveTo ?? "").localeCompare(a.effectiveTo ?? ""))[0] ?? null;
  const asBasis = (basis: (typeof GEOGRAPHY_BASES)[number] | null): GeographyBasis | null => (basis === null ? null : { ref: basis.ref, level: basis.level, effectiveTo: basis.effectiveTo });
  const prior = log.releases
    .filter((release) => release.artist === party && release.answer.outcome === "RELEASE")
    .flatMap((release) => [
      scopeOf(release.answer.area, release.answer.period),
      ...release.answer.children.filter((child) => !child.suppressed).map((child) => scopeOf(child.area, release.answer.period)),
    ]);
  const scope = scopeOf(area, period);
  const children = GEOGRAPHY_AREAS.filter((candidate) => candidate.parent === area.code && candidate.level === asked.level).map((child) => scopeOf(child, period));
  const decision = decideGeography({ terms, scope, requestedLevel: asked.level, identify: asked.identify, basis: asBasis(effective), lapsed: asBasis(lapsed), prior, children });
  const answer: GeographyAnswer = { ...decision, area, period, requestedLevel: asked.level, terms, recordedAt: now() };
  log.releases.push({ artist: party, by: artist.name, policyVersion: terms.version, signature: signatureOf(scope.premises), premisesCount: scope.premises.size, answer });
  return ok(answer);
}

/** The artist's own release log, newest first: each answer they were given and when, refused attempts among them. */
export function artistGeographyReleases(key: string, artist: { email: string; name: string }): LoadOutcome<readonly GeographyRelease[]> {
  const party = artistParty(artist);
  if (party === null) return refused("NOT_AUTHORISED");
  return ok(
    releaseLog(key)
      .releases.filter((release) => release.artist === party)
      .map(({ answer, by }) => ({
        area: answer.area,
        period: answer.period,
        requestedLevel: answer.requestedLevel,
        outcome: answer.outcome,
        reason: answer.reason,
        compared: answer.compared,
        by,
        recordedAt: answer.recordedAt,
      }))
      .reverse(),
  );
}
