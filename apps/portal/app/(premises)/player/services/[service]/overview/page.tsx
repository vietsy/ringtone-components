import { R1_FORMAT } from "@rightone/formatting";
import {
  Button,
  ButtonRow,
  Columns,
  FactList,
  FreshnessLine,
  MetricValue,
  PageHeader,
  Panel,
  Table,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { moment, periodOutcome, serviceStatus, venTranslator } from "@/features/venue/copy";
import { LoadError, RefusedBody, VenueShell } from "@/features/venue/Frame";
import { requirePrincipal } from "@/lib/api/session";
import { loadServiceView, type ServiceViewData } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN10_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** The device line's connection, as the venue reads it: offline and stopped never look like online. */
const CONNECTION = { ONLINE: "neutral", OFFLINE: "attention", STOPPED: "danger" } as const;

/**
 * SCR-VEN-10 Premises service view: one page that says whether the service is running. The entitlement, a one-line
 * summary of the device, what plays today and the governed figures, each with its own freshness; a figure that
 * could not be read says so and is never a zero. Sync progress and the offline limit are the device's own page.
 */
export default async function ServiceViewPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN10_VIEWS);
  const outcome = view === "loading" ? null : await loadServiceView(principal, service, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const refused = failure !== null && (failure.code === "ENTITLEMENT_NOT_FOUND" || failure.code === "NOT_AUTHORISED_FOR_PREMISES");
  const phone = frame === "phone";
  const refresh = (
    <Button variant="secondary" size="md" icon="refresh-cw" href={routes.playerServiceView(service)} fullWidth={phone} locale={locale}>
      {t("ven10.refresh")}
    </Button>
  );
  const back = (
    <Button variant="quiet" size="md" href={routes.playerService(service)} fullWidth={phone} locale={locale}>
      {t("ven.backService")}
    </Button>
  );

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={data !== null ? { premises: data.service.premises.name, period: data.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(data !== null ? [{ label: data.service.premises.name, href: routes.playerService(service) }] : []),
        ]}
        title={t("ven10.title")}
        {...(data !== null ? { meta: t("ven10.meta", { ts: moment(data.asOf, locale) }) } : {})}
        locale={locale}
      />
      {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={8} density="portal" locale={locale} /> : null}
      {failure !== null && refused ? <RefusedBody code={failure.code} back={{ label: t("ven.backService"), href: routes.playerService(service) }} t={t} locale={locale} /> : null}
      {failure !== null && !refused ? <LoadError failure={failure} locale={locale} /> : null}
      {data !== null ? <Panels data={data} frame={frame} t={t} locale={locale} /> : null}
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {refresh}
          {back}
        </div>
      ) : (
        <ButtonRow>
          {refresh}
          {back}
        </ButtonRow>
      )}
    </VenueShell>
  );
}

function Panels({ data, frame, t, locale }: { data: ServiceViewData; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const device = data.device;
  const activity = data.activity;
  const now = R1_FORMAT.formatTime(data.asOf) ?? "";
  const since = data.service.status === "ACTIVE" ? data.service.activatedAt : null;
  return (
    <Columns layout="halves" single={phone}>
      <Panel title={t("ven10.service")} level={2} inset={inset} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("ven10.code"), value: data.service.code, kind: "id" },
            { label: t("ven10.state"), value: serviceStatus(data.service.status, t), kind: "status" },
            ...(since !== null ? [{ label: t("ven10.since"), value: since, kind: "date" as const }] : []),
          ]}
          locale={locale}
        />
        <Text size="base">{t("ven.line")}</Text>
      </Panel>
      <Panel
        title={t("ven10.device")}
        level={2}
        {...(device !== null ? { meta: t("ven10.deviceAt", { time: R1_FORMAT.formatStamp(device.asAt, locale) ?? "" }), actions: [{ kind: "link" as const, label: t("ven10.openDevice"), href: routes.playerDevice(device.id) }] } : {})}
        // The device read's own label (ALG-235): a late or failed read says so, never passing for a current one.
        {...(device !== null && device.freshness !== "CURRENT" ? { status: { family: "attention" as const, label: t(device.freshness === "STALE" ? "ven10.stale" : "ven10.unavailable") } } : {})}
        inset={inset}
        density="portal"
        locale={locale}
      >
        {device !== null ? (
          <FactList
            items={[
              { label: t("ven10.deviceId"), value: device.id, kind: "id" },
              { label: t("ven10.connection"), value: { family: CONNECTION[device.connection], label: t(`ven10.conn.${device.connection}`) }, kind: "status" },
              {
                label: t("ven10.playing"),
                value: device.playing !== null ? { text: device.playing.title, detail: device.playing.by } : null,
                kind: "stack",
                missing: t("ven10.nothingPlaying"),
              },
            ]}
            locale={locale}
          />
        ) : (
          <Text size="base">{t("ven10.noDevice")}</Text>
        )}
      </Panel>
      <Panel
        title={data.today !== null ? t("ven10.today", { weekday: t(`ven.dayLong.${weekdayOf(data.today.date)}`), date: R1_FORMAT.formatDate(`${data.today.date}T12:00:00+07:00`, locale) ?? "" }) : t("ven10.todayNone")}
        level={2}
        actions={[{ kind: "link", label: t("ven10.schedule"), href: routes.playerSchedule(data.service.code) }]}
        inset={inset}
        density="portal"
        locale={locale}
      >
        {data.today !== null ? (
          <Table
            columns={[
              { key: "time", label: t("ven10.cTime"), nowrap: true, num: true },
              { key: "list", label: t("ven10.cList"), kind: "stack" },
              { key: "outcome", label: t("ven10.cOutcome"), kind: "status" },
            ]}
            rows={data.today.periods.map((period) => {
              const current = period.start <= now && now < period.end;
              return {
                _key: period.start,
                ...(current ? { _selected: true } : {}),
                time: `${period.start}-${period.end}`,
                list: { text: period.playlist ?? "–", ...(current ? { detail: t("ven10.now") } : {}) },
                outcome: periodOutcome(period, t),
              };
            })}
            layout={phone ? "cards" : "table"}
            density="portal"
            caption={t("ven10.todayCaption")}
            locale={locale}
          />
        ) : (
          <Text size="base">{t("ven.refusal.RULES_NOT_APPROVED")}</Text>
        )}
      </Panel>
      <Panel
        title={t("ven10.activity")}
        level={2}
        {...(activity.freshness === "STALE" ? { status: { family: "attention" as const, label: t("ven10.stale") } } : {})}
        inset={inset}
        density="portal"
        locale={locale}
      >
        <Columns layout="halves" gap={4}>
          <MetricValue label={t("ven10.hours")} value={activity.hours} kind="count" {...(activity.freshness === "UNAVAILABLE" ? { missing: t("ven10.unavailable") } : {})} locale={locale} />
          <MetricValue label={t("ven10.tracks")} value={activity.plays} kind="count" {...(activity.freshness === "UNAVAILABLE" ? { missing: t("ven10.unavailable") } : {})} locale={locale} />
        </Columns>
        {activity.period !== null && activity.asAt !== null ? <FreshnessLine period={activity.period} asOf={activity.asAt} locale={locale} /> : null}
        {activity.freshness === "STALE" ? <Text size="base">{t("ven10.staleNote")}</Text> : null}
        {activity.freshness === "UNAVAILABLE" ? <Text size="base">{t("ven10.unavailableNote")}</Text> : null}
      </Panel>
    </Columns>
  );
}

/** The ISO weekday of a calendar date, Monday 1 to Sunday 7. */
function weekdayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}
