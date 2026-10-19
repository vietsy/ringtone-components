import type { LoadOutcome } from "@rightone/ui";
import type { GeographyLevel, ProvenanceClass } from "@/lib/api/data-governance";

/**
 * DAT's sample data for the two screens built here, word for word from the DAT boards (SCR-DAT-04, 16). The values are
 * named as the owning module names them (module, row and column); their figures live in that module, never here. The
 * seeds are a world's first state: what a person records or approves afterwards is the backend's
 * (`lib/mock/backend/data-governance.ts`). Invented figures; nothing here is a real record.
 */

/** `CFG-102`: the six classes of `BR-DAT-02`, strongest first, as the data governance owner ordered them. */
export const PROVENANCE_ORDER: readonly ProvenanceClass[] = ["authoritative", "declared", "derived", "estimated", "imputed", "illustrative"];

/** A value a report shows, in the domain it belongs to, and what it was derived from where it was. */
export interface SeedValue {
  valueRef: string;
  /** What the value is, for the reader who opened it from a figure. */
  note: { vi: string; en: string } | null;
  derivedFrom: readonly { input: string; venues: number }[] | null;
}

/** The values SCR-DAT-04 draws: the use in Bến Thành Ward for the third quarter, its two inputs, and a floor area. */
export const SEED_VALUES: readonly SeedValue[] = [
  {
    valueRef: "ward-usage/2026-Q3/ben-thanh",
    note: { vi: "Mức sử dụng của Phường Bến Thành, quý 3 năm 2026", en: "Use in Bến Thành Ward, third quarter of 2026" },
    derivedFrom: [
      { input: "measured/venue-114", venues: 1 },
      { input: "area-weighting/ben-thanh", venues: 9 },
    ],
  },
  { valueRef: "measured/venue-114", note: null, derivedFrom: null },
  { valueRef: "area-weighting/ben-thanh", note: null, derivedFrom: null },
  { valueRef: "premises/114/floor_area_m2", note: null, derivedFrom: null },
];

/**
 * The classes on record when the world starts (`reporting.provenance_records`): the measurement and the area weighting
 * the ward's figure was computed from, recorded by the jobs that produced them. The floor area has none yet, which is
 * the state the board draws for recording one.
 */
export const SEED_PROVENANCE: readonly { valueRef: string; provenanceClass: ProvenanceClass; recordedAt: string; recordedBy: null }[] = [
  { valueRef: "measured/venue-114", provenanceClass: "authoritative", recordedAt: "2026-09-30T06:00:00+07:00", recordedBy: null },
  { valueRef: "area-weighting/ben-thanh", provenanceClass: "imputed", recordedAt: "2026-09-30T06:00:00+07:00", recordedBy: null },
];

/**
 * `CFG-107`'s levels approved for artist analytics. `DEC-23` leaves the expansion open, so only the narrowest level the
 * programme has approved elsewhere, the province, may be released.
 */
export const APPROVED_LEVELS: readonly GeographyLevel[] = ["province"];

/**
 * The geography policy in force on the board: version 1, from 1 September 2026. The board does not say who approved
 * it or when, so the seed does not either.
 */
export const SEED_GEOGRAPHY_POLICY = {
  version: 1,
  permittedLevels: ["province"] as readonly GeographyLevel[],
  defaultLevel: "province" as GeographyLevel,
  minimumPopulation: 10,
  differencingAcrossPeriods: true,
  effectiveFrom: "2026-09-01",
};

/**
 * The scopes the preview releases or suppresses, as the board draws them for the third quarter: the number of
 * premises in each, and, for Cần Thơ in September, that the July and August figures already released to the artist
 * leave one premises between them and this one.
 */
export interface PreviewScope {
  key: string;
  area: string;
  level: GeographyLevel;
  venues: number;
  /** The quarter, or the month inside it, the figure is for. */
  period: "2026-Q3" | "2026-09";
  /** Whether a figure already released covers the same area over other months of the quarter. */
  differsByPeriod: boolean;
}

export const PREVIEW_SCOPES: readonly PreviewScope[] = [
  { key: "hcm", area: "TP. Hồ Chí Minh", level: "province", venues: 212, period: "2026-Q3", differsByPeriod: false },
  { key: "hn", area: "Hà Nội", level: "province", venues: 34, period: "2026-Q3", differsByPeriod: false },
  { key: "ct", area: "Cần Thơ", level: "province", venues: 11, period: "2026-09", differsByPeriod: true },
  { key: "dn", area: "Đồng Nai", level: "province", venues: 4, period: "2026-Q3", differsByPeriod: false },
];

/** The review states the boards draw that the live data never reaches: loading and our outage. */
export const DAT_VIEWS = ["loading", "error"] as const;
export type DatView = (typeof DAT_VIEWS)[number];

export function mockDataGovernanceFailure(screen: "dat04" | "dat16"): LoadOutcome<never> {
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: screen === "dat04" ? "c4a8e2071f9d35b6" : "a3c7f1e95b0d2648", retryable: true } };
}
