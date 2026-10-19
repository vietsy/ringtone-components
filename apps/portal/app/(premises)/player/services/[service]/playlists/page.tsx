import { Banner, Button, Link, PageHeader, Panel, StatusBadge, ViewState, EmptyState } from "@/components/r1";
import { Text } from "@/components/Text";
import { playlistStatus, refusalWords, venTranslator } from "@/features/venue/copy";
import { LoadError, RefusalBanner, RefusedBody, VenueShell } from "@/features/venue/Frame";
import { ListPager } from "@/features/venue/ListPager";
import { PlaylistTable, type PlaylistTableRow } from "@/features/venue/PlaylistTable";
import { StatusFilter } from "@/features/venue/StatusFilter";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadPlaylists, type PlaylistsAttempt, type PlaylistsStep, type PlaylistStatus } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN06_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import type { Route } from "next";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUSES: readonly PlaylistStatus[] = ["USABLE", "NO_ELIGIBLE_TRACK", "ARCHIVED"];

/** Refusals of setting the default that belong in the page header rather than beside the row. */
const HEADER: ReadonlySet<string> = new Set(["ENTITLEMENT_NOT_ACTIVE", "NOT_AUTHORISED_FOR_PREMISES"]);

/**
 * SCR-VEN-06 Playlists and the default playlist. The premises' playlists with their state, which one is the
 * default, and archiving one no longer wanted. A service awaiting terms keeps its playlists here too (spine A1), and
 * once its default can play, the page leads back to the terms.
 */
export default async function PlaylistsPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN06_VIEWS);
  const chosenState = STATUSES.find((status) => status === query.status) ?? null;
  const after = typeof query.after === "string" ? query.after : null;
  const outcome = view === "loading" ? null : await loadPlaylists(principal, service, chosenState, view, after);
  const last = readForPage<PlaylistsAttempt>(query);
  const attempt = last?.page === "playlists" && last.service === service ? last : null;
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const mutable = step !== null && (step.service.status === "PENDING_TERMS" || step.service.status === "ACTIVE");
  const next = step !== null && step.service.status === "PENDING_TERMS" && step.defaultPlaylist?.status === "USABLE";

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={step !== null ? { premises: step.service.premises.name, period: step.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(step !== null ? [{ label: step.service.premises.name, href: routes.playerService(service) }] : []),
        ]}
        title={t("ven06.title")}
        locale={locale}
      >
        {step !== null ? (
          <Button
            variant={next ? "secondary" : "primary"}
            size="md"
            icon="plus"
            fullWidth={phone}
            {...(mutable ? { href: routes.playerNewPlaylist(service) } : { disabled: true, disabledReason: refusalWords("ENTITLEMENT_NOT_ACTIVE", t).title })}
            locale={locale}
          >
            {t("ven06.new")}
          </Button>
        ) : null}
      </PageHeader>
      {step !== null && !mutable ? <RefusalBanner code="ENTITLEMENT_NOT_ACTIVE" t={t} locale={locale} /> : null}
      {attempt !== null && mutable && HEADER.has(attempt.code) ? <RefusalBanner code={attempt.code} t={t} locale={locale} /> : null}
      {view === "loading" ? <ViewState view="loading" skeleton={phone ? "card" : "table"} rows={6} density="portal" locale={locale} /> : null}
      {failure !== null && failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? (
        <RefusedBody code={failure.code} back={{ label: t("ven.backServices"), href: routes.player() }} t={t} locale={locale} />
      ) : failure !== null ? (
        <LoadError failure={failure} locale={locale} />
      ) : null}
      {step !== null ? <Playlists step={step} chosenState={chosenState} attempt={attempt} next={next} frame={frame} t={t} locale={locale} /> : null}
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

function Playlists({
  step,
  chosenState,
  attempt,
  next,
  frame,
  t,
  locale,
}: {
  step: PlaylistsStep;
  chosenState: PlaylistStatus | null;
  attempt: PlaylistsAttempt | null;
  next: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const code = step.service.code;
  const mutable = step.service.status === "PENDING_TERMS" || step.service.status === "ACTIVE";
  const fallback = step.defaultPlaylist;
  const rows: PlaylistTableRow[] = step.items.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    href: routes.playerPlaylist(code, playlist.id),
    revision: t("ven06.revision", { n: playlist.revision }),
    status: playlistStatus(playlist.status, t),
    isDefault: playlist.isDefault,
    canSetDefault: mutable && playlist.status === "USABLE" && !playlist.isDefault,
    canArchive: playlist.status !== "ARCHIVED",
    refusal: attempt !== null && attempt.playlist === playlist.id && !HEADER.has(attempt.code) ? { text: t(`ven.refusal.${attempt.code}`), code: attempt.code } : null,
  }));
  const hrefFor: Record<string, Route> = { all: routes.playerPlaylists(code) };
  for (const status of STATUSES) hrefFor[status] = routes.playerPlaylists(code, status);
  return (
    <>
      {next ? (
        <Banner family="info" title={t("ven06.nextTitle")} level={2} density="portal" action={{ label: t("ven06.accept"), href: routes.playerTerms(code), variant: "primary" }} locale={locale}>
          {t("ven06.nextText")}
        </Banner>
      ) : null}
      <Panel title={t("ven06.defaultLabel")} level={2} inset={inset} density="portal" locale={locale}>
        {fallback !== null ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
              <Text size="lg" weight="semibold">
                {fallback.name}
              </Text>
              <StatusBadge {...playlistStatus(fallback.status, t)} size="sm" />
            </div>
            <Text size="base" tone="secondary">
              {t("ven06.defaultNote")}
            </Text>
          </>
        ) : (
          <Text size="base">{t("ven06.noDefault")}</Text>
        )}
      </Panel>
      <Panel title={t("ven06.listTitle")} level={2} inset={inset} gap="lg" density="portal" locale={locale}>
        <StatusFilter
          label={t("ven06.filterBar")}
          field={t("ven06.filter")}
          options={[{ value: "all", label: t("ven06.all") }, ...STATUSES.map((status) => ({ value: status, label: t(`ven.playlist.${status}`) }))]}
          value={chosenState ?? "all"}
          hrefFor={hrefFor}
          locale={locale}
        />
        {step.items.length === 0 ? (
          <EmptyState
            variant={chosenState !== null ? "filtered" : "not-started"}
            title={chosenState !== null ? t("ven06.filteredTitle") : t("ven06.emptyTitle")}
            level={3}
            action={false}
            density="portal"
            locale={locale}
          >
            {chosenState !== null ? t("ven06.filteredText") : t("ven06.emptyText")}
          </EmptyState>
        ) : (
          <PlaylistTable
            service={code}
            rows={rows}
            copy={{
              caption: t("ven06.listTitle"),
              name: t("ven06.cName"),
              revision: t("ven06.cRev"),
              state: t("ven06.cState"),
              isDefault: t("ven06.cDefault"),
              defaultMark: t("ven06.defaultMark"),
              setDefault: t("ven06.setDefault"),
              archive: t("ven06.archive"),
              dialogTitle: t("ven06.dlgTitle"),
              dialogText: t("ven06.dlgText"),
              reason: t("ven06.reason"),
              reasonHelp: t("ven06.reasonHelp"),
              confirm: t("ven06.dlgYes"),
              keep: t("ven06.dlgNo"),
            }}
            phone={phone}
            locale={locale}
          />
        )}
        <ListPager paging={step.paging} href={(cursor) => routes.playerPlaylists(code, chosenState ?? undefined, cursor)} density="portal" t={t} locale={locale} />
        <Text size="base" tone="secondary">
          {t("ven06.foot")}
        </Text>
      </Panel>
    </>
  );
}
