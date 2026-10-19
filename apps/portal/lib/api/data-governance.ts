import type { LoadOutcome } from "@rightone/ui";
import { approveGeographyPolicy, checkGeographyDraft, exportProvenance, geographyPolicy, lookUpProvenance, recordProvenanceClass } from "@/lib/mock/backend/data-governance";
import { mockDataGovernanceFailure, PROVENANCE_ORDER, type DatView } from "@/lib/mock/data-governance";
import type { Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/**
 * DAT's seam for the two screens built here: the provenance class of a governed value (`POST /provenance/resolve`,
 * `POST /provenance-records`, SCR-DAT-04) and the artist-facing geography policy (`POST /geography-policies`,
 * SCR-DAT-16).
 */

/** The six classes of `BR-DAT-02`; `CFG-102` orders them. */
export type ProvenanceClass = "authoritative" | "declared" | "derived" | "estimated" | "imputed" | "illustrative";

/** `DR-96`'s reason for a derived value's class: every input authoritative, or the weakest input's class. */
export type DerivationReason = "DERIVED_FROM_AUTHORITATIVE" | "WEAKEST_INPUT_ESTIMATED" | "WEAKEST_INPUT_IMPUTED" | "WEAKEST_INPUT";

export interface ProvenanceInput {
  input: string;
  provenanceClass: ProvenanceClass;
  /** How many premises the input covers. */
  venues: number;
  /** The weakest of the inputs, which decides the derived value's class. */
  weakest: boolean;
}

/** One value's class at an instant, as SCR-DAT-04 draws it. */
export interface ProvenanceLookup {
  valueRef: string;
  note: { vi: string; en: string } | null;
  /** Null when no class is on record at `asOf`: PROVENANCE_CLASS_MISSING, naming `missing`. */
  provenanceClass: ProvenanceClass | null;
  /** The value itself, recorded with its class, or the input that decided a derived value's class. */
  decidedBy: { kind: "RECORD"; recordedAt: string; recordedBy: string | null } | { kind: "INPUT"; input: string; reason: DerivationReason } | null;
  /** The inputs of a derived value, strongest first; null for a value that was not derived. */
  inputs: readonly ProvenanceInput[] | null;
  /** What PROVENANCE_CLASS_MISSING names: the value itself, or the input of a derived value that has no class. */
  missing: string | null;
  /** The instant the class is read at (`as_of`). */
  asOf: string;
  lookedUpAt: string;
}

/** The refused attempt the prohibition recorded: who asked for the value without its class, and when. */
export interface OmittedAttempt {
  by: string;
  at: string;
}

/** The backend's answer to SCR-DAT-04's lookup: the value with its class, or the refused request for it without one. */
export type ProvenanceLookupAnswer = { lookup: ProvenanceLookup; omitted: null } | { lookup: null; omitted: OmittedAttempt | null };

export interface ProvenancePage {
  order: readonly ProvenanceClass[];
  /** Null until a value is asked for. */
  lookup: ProvenanceLookup | null;
  /**
   * The caller asked for the value without its class (CLASS_CANNOT_BE_OMITTED): the attempt as recorded. The page then
   * asks again with the class and shows the two together.
   */
  omitted: OmittedAttempt | null;
  /** The day the reader asked the class as at; null for now. */
  asOfDay: string | null;
}

/** One input of `POST /provenance/resolve`: its reference and, for a value this module holds no record of, its class. */
export interface ResolveInput {
  valueRef: string;
  /** The class the caller states, which a recorded class never overrides; absent to read the recorded one. */
  provenanceClass?: string | null;
}

/** `POST /provenance/resolve`'s request: the inputs, the instant (required, never defaulted), and whether the class is asked. */
export interface ResolveRequest {
  inputs: readonly ResolveInput[];
  asOf: string | null;
  /** False where the caller asks for the value without its class (`fields=value`). */
  withClass: boolean;
}

/** An input as the resolution read it: stated by the caller or recorded here, and whether it is the weakest. */
export interface ResolvedInput {
  valueRef: string;
  provenanceClass: ProvenanceClass;
  stated: boolean;
  recordedAt: string | null;
  weakest: boolean;
}

/** The class a derived value carries at `asOf`, with the input that decided it and every input, strongest first. */
export interface ResolvedClass {
  provenanceClass: ProvenanceClass;
  reason: DerivationReason;
  decidedBy: string;
  inputs: readonly ResolvedInput[];
  asOf: string;
}

export type ResolveRefusal = "FIELD_MISSING" | "PROVENANCE_CLASS_MISSING" | "PROVENANCE_CLASS_UNKNOWN" | "CLASS_CANNOT_BE_OMITTED";

/** `POST /provenance/resolve`'s answer: the class, or the refusal with the input or field it names and, for the prohibition, the attempt recorded. */
export type ProvenanceResolution =
  | { resolved: ResolvedClass; refusal: null }
  | { resolved: null; refusal: { code: ResolveRefusal; input: string | null; attempt: OmittedAttempt | null } };

/** A refused request for a governed value without its class, as the audit keeps it. */
export interface ProvenanceRefusalRecord {
  code: "CLASS_CANNOT_BE_OMITTED";
  caller: string;
  valueRefs: readonly string[];
  attemptedAt: string;
}

export type ProvenanceRefusal = "PROVENANCE_CLASS_MISSING" | "PROVENANCE_CLASS_UNKNOWN";

/** What "Ghi phân loại" left for the page: the class recorded, or the refusal at the class field. */
export interface ProvenanceAttempt {
  valueRef: string;
  recorded: ProvenanceClass | null;
  refusal: ProvenanceRefusal | null;
}

/** The levels a geography policy may name; only the approved ones may be released to artists. */
export type GeographyLevel = "province" | "ward";

export interface GeographyPolicyVersion {
  version: number;
  permittedLevels: readonly GeographyLevel[];
  defaultLevel: GeographyLevel;
  minimumPopulation: number;
  differencingAcrossPeriods: boolean;
  effectiveFrom: string;
  /** The day before the next version took effect; null while it is the last. */
  effectiveTo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

/** `DR-92` for one scope of the preview: released, suppressed below the minimum, or refused for differencing. */
export interface PreviewRow {
  key: string;
  area: string;
  period: "2026-Q3" | "2026-09";
  level: GeographyLevel;
  venues: number;
  outcome: "RELEASE" | "SUPPRESS" | "REFUSE";
  reason: "DEFAULT_LEVEL" | "AT_MINIMUM_INCLUSIVE" | "GEOGRAPHY_BELOW_MINIMUM" | "DIFFERENCING_WOULD_DISCLOSE";
}

export type GeographyRefusal = "FIELD_MISSING" | "MINIMUM_POPULATION_INVALID" | "LEVEL_NOT_PERMITTED" | "DEFAULT_LEVEL_NOT_PERMITTED" | "EFFECTIVE_PERIOD_OVERLAP";

/** A new version as the form sends it, every field as typed. */
export interface GeographyDraftInput {
  levels: readonly string[];
  defaultLevel: string;
  minimum: string;
  differencing: boolean;
  effectiveFrom: string;
}

/** A new version as the form sent it, and each field's refusal; `overlap` lists the days another version governs. */
export interface GeographyDraft {
  input: GeographyDraftInput;
  refusals: Partial<Record<"levels" | "defaultLevel" | "minimum" | "effectiveFrom", GeographyRefusal>>;
  overlap: { from: string; to: string } | null;
  /** Whether this is the version previewed below and offered for approval. */
  previewed: boolean;
}

export interface GeographyPolicyPage {
  inForce: GeographyPolicyVersion;
  /** An approved version that has not taken effect yet. */
  next: GeographyPolicyVersion | null;
  nextVersionNo: number;
  approvedLevels: readonly GeographyLevel[];
  preview: { period: "q3" | "sep"; area: string; under: "IN_FORCE" | "DRAFT"; rows: readonly PreviewRow[] };
  draft: GeographyDraft | null;
  /** The first day a new version may take effect by default: the first of next month. */
  defaultEffectiveFrom: string;
}

/** What the geography form left for the page: the draft previewed or refused, or the version approved. */
export type GeographyAttempt = { act: "preview" | "approve"; draft: GeographyDraft } | { act: "approved"; version: number; effectiveFrom: string };

/** One row of a governed export of a figure (`@AC-FR-DAT-026-04`): a value with its class in a column of its own. */
export interface ProvenanceExportRow {
  valueRef: string;
  /** The figure the export is of, or one of the inputs it was derived from. */
  role: "FIGURE" | "INPUT";
  provenanceClass: ProvenanceClass;
  /** For the figure, the input that decided its class; null for an input, or a figure stored with its own class. */
  decidedBy: string | null;
  /** How many premises an input covers; null for the figure. */
  venues: number | null;
}

/** A governed export at `as_of`: the figure first, then its inputs, strongest first; every row carries its class. */
export interface ProvenanceExport {
  rows: readonly ProvenanceExportRow[];
  asOf: string;
  exportedAt: string;
}

/** The answer to an approval: the version approved, or the draft with the refusals that stopped it. */
export interface GeographyApproval {
  approved: { version: number; effectiveFrom: string } | null;
  draft: GeographyDraft;
}

/** The instant a day is asked as at: the end of that day in Vietnam time; the moment of asking when no day is given. */
const instantOf = (day: string | null): string => (day === null ? new Date().toISOString() : `${day}T23:59:59.999+07:00`);

/**
 * SCR-DAT-04's read: the value's class at the day asked, with its inputs. A caller that asked for the value alone is
 * refused CLASS_CANNOT_BE_OMITTED, the attempt recorded, and is given it with its class, which is what the refusal
 * asks for.
 */
export function loadProvenance(staff: Staff, valueRef: string | null, withClass: boolean, asOfDay: string | null, view: DatView | null): Promise<LoadOutcome<ProvenancePage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockDataGovernanceFailure("dat04"));
  const page = { order: PROVENANCE_ORDER, asOfDay };
  if (valueRef === null) return Promise.resolve({ data: { ...page, lookup: null, omitted: null }, failure: null });
  const actor = { roles: staff.roles, name: staff.account };
  const asOf = instantOf(asOfDay);
  const asked = lookUpProvenance(staff.sessionId, actor, valueRef, asOf, withClass);
  if (asked.data === null) return Promise.resolve({ data: null, failure: asked.failure });
  if (asked.data.lookup !== null) return Promise.resolve({ data: { ...page, lookup: asked.data.lookup, omitted: null }, failure: null });
  const answered = lookUpProvenance(staff.sessionId, actor, valueRef, asOf, true);
  if (answered.data === null) return Promise.resolve({ data: null, failure: answered.failure });
  return Promise.resolve({ data: { ...page, lookup: answered.data.lookup, omitted: asked.data.omitted }, failure: null });
}

/**
 * SCR-DAT-04's export: the figure looked up and the inputs it was derived from at the day asked, every value with its
 * class. A figure whose class cannot be resolved is refused PROVENANCE_CLASS_MISSING and nothing is exported.
 */
export function loadProvenanceExport(staff: Staff, valueRef: string, asOfDay: string | null): Promise<LoadOutcome<ProvenanceExport>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(exportProvenance(staff.sessionId, { roles: staff.roles, name: staff.account }, valueRef, instantOf(asOfDay)));
}

/** "Ghi phân loại" on SCR-DAT-04: `POST /provenance-records` for one value. */
export function sendProvenanceClass(staff: Staff, valueRef: string, provenanceClass: string): Promise<LoadOutcome<{ recorded: ProvenanceClass }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(recordProvenanceClass(staff.sessionId, { roles: staff.roles, name: staff.account }, valueRef, provenanceClass));
}

/** SCR-DAT-16's read: the policy in force, the preview under it or under the draft being prepared, and that draft. */
export function loadGeographyPolicy(
  staff: Staff,
  filter: { area: string; period: "q3" | "sep" },
  draft: GeographyDraft | null,
  view: DatView | null,
): Promise<LoadOutcome<GeographyPolicyPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockDataGovernanceFailure("dat16"));
  return Promise.resolve(geographyPolicy(staff.sessionId, staff.roles, filter, draft));
}

/** "Xem trước" on SCR-DAT-16: the new version checked as `POST /geography-policies` would check it, nothing written. */
export function previewGeographyDraft(staff: Staff, input: GeographyDraftInput): Promise<LoadOutcome<GeographyDraft>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(checkGeographyDraft(staff.sessionId, staff.roles, input));
}

/** "Phê duyệt phiên bản" on SCR-DAT-16, confirmed: `POST /geography-policies` with the version previewed. */
export function sendGeographyPolicy(staff: Staff, input: GeographyDraftInput): Promise<LoadOutcome<GeographyApproval>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(approveGeographyPolicy(staff.sessionId, { roles: staff.roles, name: staff.account }, input));
}
