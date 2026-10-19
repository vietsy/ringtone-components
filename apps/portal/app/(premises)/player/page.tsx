import { Button, EmptyState, Link, PageHeader, Table, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { serviceStatus, venTranslator } from "@/features/venue/copy";
import { LoadError, VenueShell } from "@/features/venue/Frame";
import { ListPager } from "@/features/venue/ListPager";
import { requirePrincipal } from "@/lib/api/session";
import { loadServices, type ServiceSummary } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Translate } from "@/lib/i18n/translate";
import { VEN03_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-03 My premises services, the Player section's landing. The Player service of every premises the person
 * may act for, ended ones kept with their code, and the way to enrol another. A principal of one premises lands
 * here too, so the route never changes with the count.
 */
export default async function PlayerServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = venTranslator(locale);
  const view = reviewView(params, VEN03_VIEWS);
  const after = typeof params.after === "string" ? params.after : null;
  const outcome = view === "loading" ? null : await loadServices(principal, view, after);
  const phone = frame === "phone";
  const list = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <VenueShell
      account={principal.account}
      frame={frame}
      locale={locale}
      context={{ premises: principal.party, period: t("ven.role"), label: t("ven.actingFor") }}
    >
      <PageHeader title={t("ven03.title")} meta={t("ven03.meta")} locale={locale}>
        <Button variant="primary" size="md" icon="plus" href={routes.playerEnrol()} fullWidth={phone} locale={locale}>
          {t("ven03.enrol")}
        </Button>
      </PageHeader>
      <Text size="base">{t("ven.line")}</Text>
      {failure !== null ? <LoadError failure={failure} locale={locale} /> : null}
      {view === "loading" ? <ViewState view="loading" skeleton={phone ? "card" : "table"} rows={5} density="portal" locale={locale} /> : null}
      {list !== null && list.items.length === 0 ? (
        <EmptyState variant="not-started" title={t("ven03.emptyTitle")} level={2} action={false} density="portal" locale={locale}>
          {t("ven03.emptyText")}
        </EmptyState>
      ) : null}
      {list !== null && list.items.length > 0 ? (
        <>
          <Table
            columns={[
              { key: "premises", label: t("ven03.cPremises"), kind: "strong", ...(phone ? {} : { truncate: true, maxWidth: "var(--space-80)" }) },
              { key: "code", label: t("ven03.cCode"), kind: "id" },
              { key: "state", label: t("ven03.cState"), kind: "status" },
              { key: "since", label: t("ven03.cSince"), kind: "date", nowrap: true },
              { key: "act", kind: "actions" },
            ]}
            rows={list.items.map((service) => row(service, t))}
            layout={phone ? "cards" : "table"}
            density="portal"
            caption={t("ven03.caption")}
            locale={locale}
          />
          <ListPager paging={list.paging} href={(cursor) => (cursor === "" ? routes.player() : routes.playerServices(cursor))} density="portal" t={t} locale={locale} />
          <Text size="base" tone="secondary">
            {t("ven03.foot")}
          </Text>
        </>
      ) : null}
      {list !== null || view === "loading" ? (
        <div>
          <Link href={routes.playerDevices()} variant="standalone" size="touch" icon="speaker" locale={locale}>
            {t("ven03.devices")}
          </Link>
        </div>
      ) : null}
    </VenueShell>
  );
}

function row(service: ServiceSummary, t: Translate): Record<string, unknown> {
  return {
    _key: service.code,
    _href: routes.playerService(service.code),
    premises: service.premises.name,
    code: service.code,
    state: serviceStatus(service.status, t),
    since: service.since,
    // A service awaiting terms is accepted from its row; no other state has a row action.
    act: service.status === "PENDING_TERMS" ? [{ label: t("ven03.accept"), href: routes.playerTerms(service.code), variant: "secondary", ariaLabel: `${t("ven03.accept")} ${service.code}` }] : null,
  };
}
