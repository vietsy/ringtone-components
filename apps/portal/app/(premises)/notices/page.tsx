import { Button, EmptyState, NoticeList, PageHeader, Panel, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { comTranslator, elementsOf } from "@/features/notices/copy";
import { loadNoticesTo } from "@/lib/api/notices";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { NOTICES_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The premises portal's Notices: SCR-COM-10 for an account holder, as the list of every notice RightOne sent the
 * party, newest first, each opening the notice by its reference. Change what you receive opens SCR-COM-12.
 */
export default async function MyNoticesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = comTranslator(locale);
  const view = reviewView(params, NOTICES_VIEWS);
  const outcome = view === "loading" ? null : await loadNoticesTo(principal.sessionId, principal.organisation, view);
  const notices = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("notices", frame, locale)} account={principal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0, maxWidth: phone ? "100%" : "var(--container-3xl)" }}>
        <PageHeader title={t("comMine.title")} meta={t("comMine.meta", { party: principal.party })} locale={locale}>
          <Button variant="secondary" size="md" icon="settings" href={routes.noticePreferences()} fullWidth={phone} locale={locale}>
            {t("com.change")}
          </Button>
        </PageHeader>

        {failure !== null ? (
          <ViewState
            level={2}
            view="error"
            errorTitle={t("comMine.errTitle")}
            errorText={t("comMine.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="portal"
            locale={locale}
          />
        ) : null}

        {notices !== null && notices.length === 0 ? (
          <EmptyState variant="governed" icon="bell" title={t("comMine.emptyTitle")} level={2} density="portal" locale={locale}>
            {t("comMine.emptyText", { party: principal.party })}
          </EmptyState>
        ) : null}

        {failure === null && (notices === null || notices.length > 0) ? (
          <Panel inset={phone ? "sm" : "md"} density="portal" locale={locale}>
            <NoticeList
              title={t("comMine.listTitle")}
              level={2}
              items={(notices ?? []).map((notice) => {
                const elements = notice.content !== null ? elementsOf(notice.content, t, locale) : null;
                return {
                  id: notice.reference,
                  family: notice.state === "UNDELIVERED" ? ("attention" as const) : notice.state === "SUPERSEDED" ? ("neutral" as const) : ("info" as const),
                  title: elements?.subject ?? notice.reference,
                  ...(elements !== null ? { body: t("comMine.body", { state: t(`com10.state.${notice.state}`), action: elements.action, d: elements.deadline }) } : {}),
                  ...(notice.issuedAt !== null ? { at: notice.issuedAt } : {}),
                  href: routes.myNotice(notice.reference),
                };
              })}
              onMarkAll={false}
              loading={notices === null}
              density="portal"
              locale={locale}
            />
          </Panel>
        ) : null}
      </div>
    </PortalShell>
  );
}
