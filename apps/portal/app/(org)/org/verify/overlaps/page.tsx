import { Button, PageHeader, ViewState } from "@/components/r1";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { PortalShell } from "@/components/shells/PortalShell";
import { loadOverlapReport } from "@/lib/api/authorisation";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { PTY18_VIEWS } from "@/lib/mock/authorisation";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pty.en.json";
import vi from "@/messages/screens/pty.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-18 Verification overlap report, as a collecting organisation meets it on its portal: the report is
 * reserved to the register's data owner and assurance (FR-PTY-047, @AC-FR-PTY-047-05), so the organisation is
 * refused with OVERLAP_REPORT_RESERVED and the refusal's way out leads to Verify an authorisation, SCR-PTY-17.
 * The nav marks Verify an authorisation, the section this address belongs to.
 */
export default async function OverlapReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo)]);
  const t = translator({ vi, en }, locale);
  const outcome = await loadOverlapReport(cmo, reviewView(params, PTY18_VIEWS));
  const failure = outcome.failure;
  const trace = failure?.traceId ?? null;
  const line = standing.reference !== null ? t("pty.ptc", { reference: standing.reference }) : t("pty.noPtc");

  return (
    <PortalShell
      fill
      layout={frame === "phone" ? "phone" : "desktop"}
      nav={orgNav("verify", standing.open, locale)}
      account={cmo.account}
      context={orgContext(cmo.organisationName, line, locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("pty18.title")} locale={locale} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-4xl)" }}>
          {failure?.code === "OVERLAP_REPORT_RESERVED" ? (
            <ViewState
              view="refused"
              refusal={{ code: failure.code, title: t("pty18.reservedTitle"), text: t("pty18.reservedText"), family: "neutral" }}
              density="portal"
              locale={locale}
            />
          ) : (
            // A collecting organisation is never answered with a report; anything but the refusal is our outage.
            <ViewState
              view="error"
              errorTitle={t("pty18.errTitle")}
              errorText={t("pty18.errText")}
              {...(trace !== null ? { traceId: trace } : {})}
              retryable={failure?.retryable ?? true}
              density="portal"
              locale={locale}
            />
          )}
          <Button variant="secondary" size="md" href={routes.orgVerify()} locale={locale}>
            {t("pty18.toVerify")}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}
