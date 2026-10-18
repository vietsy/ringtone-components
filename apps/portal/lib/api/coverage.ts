import type { LoadOutcome } from "@rightone/ui";
import { invalidCoverageFields } from "@/features/coverage/query";
import { COVERAGE_OPTIONS, COVERAGE_REVIEW_QUERY, mockCoverageForm, mockCoverageResult } from "@/lib/mock/coverage";
import type { CoverageDataView, CoveragePageData, CoverageQuery } from "@/features/coverage/types";
import { NOT_CONFIGURED, usesMockData } from "./source";

export function loadCoverage(
  query: CoverageQuery | null = null,
  view: CoverageDataView | null = null,
): Promise<LoadOutcome<CoveragePageData>> {
  return Promise.resolve(coverageOutcome(query, view));
}

function coverageOutcome(query: CoverageQuery | null, view: CoverageDataView | null): LoadOutcome<CoveragePageData> {
  if (!usesMockData()) return NOT_CONFIGURED;

  if (view === "error") {
    return { data: null, failure: { code: "COVERAGE_UNAVAILABLE", traceId: null, retryable: true } };
  }
  if (view === "form") return { data: mockCoverageForm(), failure: null };
  if (view === "not-covered" || view === "empty") {
    return { data: mockCoverageResult({ ...COVERAGE_REVIEW_QUERY }), failure: null };
  }
  if (query === null) return { data: mockCoverageForm(), failure: null };

  const normalised: CoverageQuery = {
    rightType: query.rightType.trim(),
    repertoireKey: query.repertoireKey.trim(),
    territoryCode: query.territoryCode.trim(),
    asOf: query.asOf.trim(),
  };
  const invalidFields = invalidCoverageFields(normalised, COVERAGE_OPTIONS);
  if (invalidFields.length > 0) {
    return {
      data: {
        options: COVERAGE_OPTIONS,
        query: normalised,
        lookup: {
          outcome: { data: null, failure: { code: "COVERAGE_INPUT_INVALID", traceId: null, retryable: false } },
          invalidFields,
        },
      },
      failure: null,
    };
  }
  return { data: mockCoverageResult(normalised), failure: null };
}

