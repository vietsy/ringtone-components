import { redirect } from "next/navigation";
import { EmptyState, PageHeader, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { participationLine, subTranslator } from "@/features/submissions/copy";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { findSubmissionForNav } from "@/lib/api/submissions";
import { getLocale } from "@/lib/i18n/locale";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The nav's Submissions. The specification has no list of an organisation's submissions (G-11, Q-CMO-10) and
 * every board's nav opens SCR-CAT-05 on one submission, so this opens one: the earliest completed submission not
 * yet acknowledged, the one NTF-CAT-01 sends the organisation to; otherwise the latest received. An organisation
 * with none reads the board's words for that: no submission yet, and why.
 */
export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing, found] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo), findSubmissionForNav(cmo)]);
  if (found.data !== null) redirect(routes.orgSubmission(found.data));
  const t = subTranslator(locale);
  const phone = frame === "phone";
  const failure = found.failure;
  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("submissions", standing.open, locale)}
      account={cmo.account}
      context={orgContext(cmo.organisationName, participationLine(t, { reference: standing.reference, state: standing.state }), locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("cat05.crumb") }]} title={t("cat05.titleGeneric")} locale={locale} />
        <ViewState
          view={failure === null ? "populated" : "error"}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorText={t("cat05.errorText")}
          density="portal"
          locale={locale}
        >
          <EmptyState
            variant="not-started"
            title={t(standing.active ? "cat05.none" : "cat05.noneNotActive")}
            level={2}
            action={standing.active ? { label: t("cat04.crumb"), href: routes.orgSubmit(), icon: "upload", variant: "primary" } : false}
            density="portal"
            locale={locale}
          />
        </ViewState>
      </div>
    </PortalShell>
  );
}
