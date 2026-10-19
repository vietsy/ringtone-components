import { notFound } from "next/navigation";
import {
  loadMandateDetail,
  MANDATE_DETAIL_VIEWS,
} from "@/lib/api/mandate-detail";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { usesMockData } from "@/lib/api/source";
import { getLocale } from "@/lib/i18n/locale";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { MandateDetailClient } from "./MandateDetailClient";
import type { MandateDetailPageProps } from "./types";

export async function MandateDetailPage({
  params,
  searchParams,
}: MandateDetailPageProps) {
  const reader = await requireCmo();
  const [{ mandateId }, query] = await Promise.all([params, searchParams]);
  const view = reviewView(query, MANDATE_DETAIL_VIEWS);
  const [locale, frame, , outcome] = await Promise.all([
    getLocale(),
    getFrame(query),
    loadParticipationStanding(reader),
    // Validate the record even in the loading specimen: a query never makes an unknown ID valid.
    loadMandateDetail(mandateId, view === "loading" ? null : view),
  ]);
  if (outcome.failure?.code === "MANDATE_NOT_FOUND") notFound();

  return (
    <MandateDetailClient
      mock={usesMockData()}
      account={reader.account}
      outcome={outcome}
      loading={view === "loading"}
      registerHref="/org/mandate/register"
      locale={locale}
      frame={frame}
    />
  );
}
