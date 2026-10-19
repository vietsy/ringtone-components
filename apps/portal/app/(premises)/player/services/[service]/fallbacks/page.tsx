import { Button, Divider, EmptyState, Link, PageHeader, Panel, Table, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { day, venTranslator } from "@/features/venue/copy";
import { LoadError, RefusedBody, VenueShell } from "@/features/venue/Frame";
import { ListPager } from "@/features/venue/ListPager";
import { requirePrincipal } from "@/lib/api/session";
import { loadFallbacks, type FallbackList, type FallbackRow } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN09_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-09 Fallbacks. Every period in which a scheduled playlist could not play, what played instead and whether
 * the premises was told, from a record nobody edits; a playlist that lost its eligible tracks opens in the editor
 * to be repaired, and the schedule plays it again from the next period.
 */
export default async function FallbacksPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN09_VIEWS);
  const after = typeof query.after === "string" ? query.after : null;
  const outcome = view === "loading" ? null : await loadFallbacks(principal, service, view, after);
  const list = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={list !== null ? { premises: list.service.premises.name, period: list.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(list !== null ? [{ label: list.service.premises.name, href: routes.playerService(service) }] : []),
        ]}
        title={t("ven09.title")}
        meta={t("ven09.meta")}
        locale={locale}
      >
        <Button variant="secondary" size="md" icon="calendar" href={routes.playerSchedule(service)} fullWidth={phone} locale={locale}>
          {t("ven09.schedule")}
        </Button>
      </PageHeader>
      {view === "loading" ? <ViewState view="loading" skeleton={phone ? "card" : "table"} rows={6} density="portal" locale={locale} /> : null}
      {failure !== null && failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? (
        <RefusedBody code={failure.code} back={{ label: t("ven.backServices"), href: routes.player() }} t={t} locale={locale} />
      ) : failure !== null ? (
        <LoadError failure={failure} locale={locale} />
      ) : null}
      {list !== null && list.items.length === 0 ? (
        <EmptyState variant="governed" title={t("ven09.emptyTitle")} level={2} action={false} density="portal" locale={locale} />
      ) : null}
      {list !== null && list.items.length > 0 ? <Fallbacks list={list} frame={frame} t={t} locale={locale} /> : null}
      {failure?.code !== "NOT_AUTHORISED_FOR_PREMISES" ? (
        <div>
          <Link back href={routes.playerService(service)} variant="standalone" size="touch" locale={locale}>
            {t("ven.backService")}
          </Link>
        </div>
      ) : null}
    </VenueShell>
  );
}

function Fallbacks({ list, frame, t, locale }: { list: FallbackList; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  return (
    <Panel title={t("ven09.listTitle")} level={2} inset={phone ? "sm" : "md"} gap="lg" density="portal" locale={locale}>
      <Table
        columns={[
          { key: "period", label: t("ven09.cPeriod"), kind: "stack", nowrap: true },
          { key: "list", label: t("ven09.cList"), kind: "strong" },
          { key: "cause", label: t("ven09.cCause") },
          { key: "inst", label: t("ven09.cInstead"), kind: "status" },
          { key: "seen", label: t("ven09.cSeen"), kind: "stamp", nowrap: true },
          { key: "notice", label: t("ven09.cNotice"), kind: "status" },
          { key: "act", kind: "actions" },
        ]}
        rows={list.items.map((row, index) => fallbackRow(row, index, list.service.code, t, locale))}
        layout={phone ? "cards" : "table"}
        density="portal"
        caption={t("ven09.listTitle")}
        locale={locale}
      />
      <ListPager paging={list.paging} href={(cursor) => routes.playerFallbacks(list.service.code, cursor)} density="portal" t={t} locale={locale} />
      <Divider />
      <Text size="base">{t("ven09.again")}</Text>
    </Panel>
  );
}

function fallbackRow(row: FallbackRow, index: number, service: string, t: Translate, locale: Locale): Record<string, unknown> {
  const weekday = new Date(`${row.date}T00:00:00Z`).getUTCDay();
  return {
    _key: `f${String(index)}`,
    period: { text: t("ven09.period", { day: t(`ven.day.${weekday === 0 ? 7 : weekday}`), date: day(`${row.date}T12:00:00+07:00`, locale) }), detail: `${row.start}-${row.end}`, plain: true },
    list: row.playlist.name,
    cause: t(`ven09.cause.${row.cause}`),
    inst:
      row.resolvedTo === "NO_PLAYABLE_SCHEDULE"
        ? { family: "danger", label: t("ven09.nothing") }
        : { family: "neutral", label: t(row.resolvedTo === "FALLBACK_MOOD" ? "ven09.mood" : "ven09.default"), plain: true },
    seen: row.detectedAt,
    // An empty reference is EXC-VEN-06: the sweep could not raise the notice when it recorded the period.
    notice: row.notice !== null ? { family: "neutral", label: t("ven09.sent"), plain: true } : { family: "attention", label: t("ven09.notSent") },
    act: [
      row.playlist.archived
        ? { label: t("ven09.open"), variant: "quiet", disabled: true, disabledReason: t("ven.refusal.PLAYLIST_ARCHIVED") }
        : { label: t("ven09.open"), variant: "quiet", href: routes.playerPlaylist(service, row.playlist.id), ariaLabel: `${t("ven09.open")} ${row.playlist.name}` },
    ],
  };
}
