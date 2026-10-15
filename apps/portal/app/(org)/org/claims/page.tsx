import { redirect } from "next/navigation";
import { EmptyState, PageHeader, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { participationLine, subTranslator } from "@/features/submissions/copy";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { findClaimForNav } from "@/lib/api/submissions";
import { getLocale } from "@/lib/i18n/locale";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The nav's Claims. SCR-CAT-07 is entered from "the claim list", which no screen inventory holds (G-11,
 * Q-CMO-10), and every board's nav opens one claim, so this opens the organisation's latest recorded claim. An
 * organisation with none reads the board's words for that.
 */
export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing, found] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo), findClaimForNav(cmo)]);
  if (found.data !== null) redirect(routes.orgClaim(found.data));
  const t = subTranslator(locale);
  const phone = frame === "phone";
  const failure = found.failure;
  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("claims", standing.open, locale)}
      account={cmo.account}
      context={orgContext(cmo.organisationName, participationLine(t, { reference: standing.reference, state: standing.state }), locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("cat07.crumb") }]} title={t("cat07.titleGeneric")} locale={locale} />
        <ViewState
          view={failure === null ? "populated" : "error"}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorText={t("cat07.errorText")}
          density="portal"
          locale={locale}
        >
          <EmptyState variant="not-started" title={t(standing.active ? "cat07.none" : "cat07.noneNotActive")} level={2} action={false} density="portal" locale={locale} />
        </ViewState>
      </div>
    </PortalShell>
  );
}
