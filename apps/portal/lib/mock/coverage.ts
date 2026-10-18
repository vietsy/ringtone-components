import type { CoverageOptions, CoveragePageData, CoverageQuery } from "@/features/coverage/types";

export const COVERAGE_OPTIONS: CoverageOptions = {
  rightTypes: ["performers"],
  territories: ["VN-DN"],
};

export const COVERAGE_REVIEW_QUERY: CoverageQuery = {
  rightType: "performers",
  repertoireKey: "*",
  territoryCode: "VN-DN",
  asOf: "2026-06-15",
};

export function mockCoverageForm(): CoveragePageData {
  return {
    options: COVERAGE_OPTIONS,
    query: { rightType: "", repertoireKey: "", territoryCode: "", asOf: "" },
    lookup: null,
  };
}

export function mockCoverageResult(query: CoverageQuery): CoveragePageData {
  const matchesSample = query.rightType === COVERAGE_REVIEW_QUERY.rightType
    && query.repertoireKey === COVERAGE_REVIEW_QUERY.repertoireKey
    && query.territoryCode === COVERAGE_REVIEW_QUERY.territoryCode
    && query.asOf === COVERAGE_REVIEW_QUERY.asOf;

  return {
    options: COVERAGE_OPTIONS,
    query,
    lookup: {
      outcome: matchesSample
        ? { data: { status: "NOT_COVERED", query }, failure: null }
        : { data: null, failure: { code: "COVERAGE_SAMPLE_NOT_AVAILABLE", traceId: null, retryable: false } },
      invalidFields: [],
    },
  };
}
