import { notFound } from "next/navigation";
import { loadCoverage } from "@/lib/api/coverage";
import { usesMockData } from "@/lib/api/source";
import { getLocale } from "@/lib/i18n/locale";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { CoveragePageClient } from "./CoveragePageClient";
import { coverageSearchParams, readCoverageQuery } from "./query";
import { COVERAGE_VIEWS, type CoverageSearchParams } from "./types";

export async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<CoverageSearchParams>;
}) {
  if (!usesMockData()) notFound();
  const params = await searchParams;
  const view = reviewView(params, COVERAGE_VIEWS);
  const [locale, frame, outcome] = await Promise.all([
    getLocale(),
    getFrame(params),
    loadCoverage(readCoverageQuery(params), view === "loading" ? "form" : view),
  ]);
  const search = coverageSearchParams(params);

  return (
    <CoveragePageClient
      key={`${locale}:${search}`}
      locale={locale}
      frame={frame}
      view={view}
      outcome={outcome}
      search={search}
    />
  );
}
