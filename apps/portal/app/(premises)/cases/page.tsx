import { Button, EmptyState, PageHeader, Panel, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { casTranslator, caseStatus, nextStep } from "@/features/cases/copy";
import { loadCasesRaisedBy, type CaseSummary } from "@/lib/api/cases";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CASES_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The premises portal's Cases: SCR-CAS-02 for an account holder, as a list of the cases their party raised from
 * its account, newest first, each opening its own page. A case raised without an account is read by its
 * reference instead and does not appear here.
 */
export default async function MyCasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = casTranslator(locale);
  const view = reviewView(params, CASES_VIEWS);
  const outcome = view === "loading" ? null : await loadCasesRaisedBy(principal.sessionId, principal.organisation, view);
  const cases = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const empty = cases !== null && cases.length === 0;

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("cases", frame, locale)} account={principal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("casMine.title")} meta={t("casMine.meta", { party: principal.party })} locale={locale}>
          {!empty ? (
            <Button variant="primary" size="md" icon="plus" href={routes.raiseCase()} fullWidth={phone} locale={locale}>
              {t("casMine.raise")}
            </Button>
          ) : null}
        </PageHeader>

        {failure !== null ? (
          <ViewState
            level={2}
            view="error"
            errorTitle={t("casMine.errTitle")}
            errorText={t("casMine.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="portal"
            locale={locale}
          />
        ) : null}

        {empty ? (
          <EmptyState
            variant="not-started"
            title={t("casMine.emptyTitle")}
            level={2}
            action={{ label: t("casMine.raise"), href: routes.raiseCase(), icon: "plus", variant: "primary" }}
            density="portal"
            locale={locale}
          >
            {t("casMine.emptyText")}
          </EmptyState>
        ) : null}

        {failure === null && !empty ? (
          <Panel inset={phone ? "sm" : "md"} density="portal" locale={locale}>
            <CaseTable cases={cases} phone={phone} t={t} locale={locale} />
          </Panel>
        ) : null}
      </div>
    </PortalShell>
  );
}

function CaseTable({ cases, phone, t, locale }: { cases: readonly CaseSummary[] | null; phone: boolean; t: Translate; locale: Locale }) {
  return (
    <Table
      columns={[
        { key: "ref", label: t("casMine.cRef"), kind: "id" },
        { key: "raised", label: t("casMine.cRaised"), kind: "datetime" },
        { key: "subject", label: t("casMine.cSubject"), kind: "mono", missing: t("casMine.noSubject") },
        { key: "state", label: t("casMine.cState"), kind: "status", minWidth: "var(--space-40)" },
        { key: "next", label: t("casMine.cNext"), kind: "text", minWidth: "var(--space-64)" },
      ]}
      rows={(cases ?? []).map((summary) => ({
        _key: summary.reference,
        _href: routes.myCase(summary.reference),
        ref: summary.reference,
        raised: summary.submittedAt,
        subject: summary.subject,
        state: { ...caseStatus(summary.state, t), plain: true },
        next: nextStep(summary, t, locale),
      }))}
      loading={cases === null ? 3 : false}
      density="portal"
      layout={phone ? "cards" : "table"}
      caption={t("casMine.title")}
      locale={locale}
    />
  );
}
