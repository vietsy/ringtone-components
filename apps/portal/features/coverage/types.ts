import type { LoadOutcome } from "@rightone/ui";

export const COVERAGE_VIEWS = ["form", "loading", "not-covered", "empty", "error"] as const;

export type CoverageView = (typeof COVERAGE_VIEWS)[number];
export type CoverageDataView = Exclude<CoverageView, "loading">;
export type CoverageRightType = "performers";
export type CoverageTerritory = "VN-DN";

export interface CoverageQuery {
  readonly rightType: string;
  readonly repertoireKey: string;
  readonly territoryCode: string;
  readonly asOf: string;
}

export type CoverageField = keyof CoverageQuery;
export type CoverageSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export interface CoverageOptions {
  readonly rightTypes: readonly CoverageRightType[];
  readonly territories: readonly CoverageTerritory[];
}

export interface CoverageResult {
  readonly status: "NOT_COVERED";
  readonly query: CoverageQuery;
}

export interface CoverageLookup {
  readonly outcome: LoadOutcome<CoverageResult>;
  readonly invalidFields: readonly CoverageField[];
}

export interface CoveragePageData {
  readonly options: CoverageOptions;
  readonly query: CoverageQuery;
  readonly lookup: CoverageLookup | null;
}
