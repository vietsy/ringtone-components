import { notFound } from "next/navigation";
import {
  loadMandateDetail,
  MANDATE_DETAIL_VIEWS,
} from "@/lib/api/mandate-detail";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { MandateDetailClient } from "./MandateDetailClient";
import type { MandateDetailPageProps } from "./types";
import styles from "./MandateDetail.module.css";

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

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else if (value !== undefined) search.append(key, value);
  }
  // The requested breadcrumb points to this detail page, retaining all current query parameters.
  const selfHref = `/org/mandate/detail/${encodeURIComponent(mandateId)}${search.size ? `?${search.toString()}` : ""}`;

  return (
    <div className={styles.page} data-frame={frame}>
      <MandateDetailClient
        outcome={outcome}
        loading={view === "loading"}
        selfHref={selfHref}
        locale={locale}
        frame={frame}
      />
    </div>
  );
}
