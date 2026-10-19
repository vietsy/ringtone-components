import { CoveragePage } from "@/features/coverage/CoveragePage";
import type { CoverageSearchParams } from "@/features/coverage/types";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<CoverageSearchParams>;
}) {
  return <CoveragePage searchParams={searchParams} />;
}
