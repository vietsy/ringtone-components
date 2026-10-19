import { R1_FORMAT } from "@rightone/formatting";
import {
  Button,
  ButtonRow,
  Columns,
  FactList,
  Meter,
  NowPlaying,
  PageHeader,
  Panel,
  PlayerStatusBlock,
  StatusBadge,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { Cover } from "@/features/venue/Cover";
import { count, creditsOf, moment, plrTranslator, serviceStatus, stopKey, venTranslator } from "@/features/venue/copy";
import { LoadError, VenueShell } from "@/features/venue/Frame";
import { loadSyncProgress, type SyncProgress } from "@/lib/api/player";
import { requirePrincipal } from "@/lib/api/session";
import { loadVenueView, type DeliveryStop, type VenueViewData } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR04_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-04 Venue view, and SCR-PLR-05 Offline limit reached: one device as the venue sees it, read from
 * GET /devices/{id}/venue-view. Offline with time left, the music plays from what the device holds (04); once the
 * limit runs out, it has stopped under a condition of the licence, and the page says that is not a fault (05). The
 * evidence waiting is shown in both, and nothing on either page discards it. A device that nothing reaches, its
 * credential held or revoked or its premises' service not active, says so with why; the spec names no such state.
 * While the music plays, GET /sync/progress says how far the next snapshot has arrived, what is left and, for a
 * transfer the connection cut, where it resumes: online and synchronising is told apart from online and settled.
 */
export default async function DevicePage({ params, searchParams }: { params: Promise<{ device: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ device }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = plrTranslator(locale);
  const view = reviewView(query, PLR04_VIEWS);
  const outcome = view === "loading" ? null : await loadVenueView(principal, device, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The transfer is read only where the music plays (SCR-PLR-04): a stopped device receives nothing.
  const running = data !== null && data.stop === null && data.condition !== "LIMIT_REACHED";
  const sync = running && view === null ? (await loadSyncProgress(principal, device)).data : null;
  const phone = frame === "phone";
  const support = (
    <Button variant="primary" size="md" icon="circle-help" href={routes.raiseCase(device)} fullWidth={phone} locale={locale}>
      {t("plr04.support")}
    </Button>
  );
  const close = (
    <Button variant="quiet" size="md" href={routes.player()} fullWidth={phone} locale={locale}>
      {t("plr04.close")}
    </Button>
  );

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={data !== null ? { premises: data.premises.name, period: data.device.id } : null}>
      <PageHeader title={t("plr04.title")} {...(data !== null ? { meta: t("plr04.meta", { ts: moment(data.asOf, locale) }) } : {})} locale={locale} />
      {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={4} density="portal" locale={locale} /> : null}
      {failure !== null && failure.code === "NOT_AUTHORISED" ? (
        <ViewState view="refused" refusal={{ code: failure.code, title: t("plr04.refTitle"), family: "neutral" }} density="portal" locale={locale} />
      ) : failure !== null ? (
        <LoadError failure={failure} locale={locale} />
      ) : null}
      {data !== null ? (
        data.stop !== null ? (
          <NoDelivery data={data} stop={data.stop} frame={frame} t={t} locale={locale} />
        ) : data.condition === "LIMIT_REACHED" ? (
          <Stopped data={data} frame={frame} t={t} locale={locale} />
        ) : (
          <Running data={data} sync={sync} frame={frame} t={t} locale={locale} />
        )
      ) : null}
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {support}
          {close}
        </div>
      ) : (
        <ButtonRow>
          {support}
          {close}
        </ButtonRow>
      )}
    </VenueShell>
  );
}

/**
 * The evidence a device holds until it can send it: the backlog against the ceiling on the device, and, while the
 * music plays, that reaching the ceiling does not stop it.
 */
function Evidence({ data, inset, playing, t, locale }: { data: VenueViewData; inset: "sm" | "md"; playing: boolean; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("plr04.evTitle")} level={2} inset={inset} density="portal" locale={locale}>
      <FactList
        items={[
          { label: t("plr04.fWaiting"), value: data.evidence.waiting, kind: "count" },
          { label: t("plr04.fOldest"), value: data.evidence.oldest, kind: "datetime", missing: t("plr04.none") },
          { label: t("plr04.fCeiling"), value: data.evidence.ceiling, kind: "count" },
        ]}
        locale={locale}
      />
      {playing ? (
        <Text size="base" tone="secondary">
          {t("plr04.evNote")}
        </Text>
      ) : null}
    </Panel>
  );
}

/**
 * The synchronisation of the device's next snapshot: how much has arrived against the whole, what is left, and that
 * the music plays from what the device already holds until all of it has. A transfer the connection cut resumes from
 * where it stopped, never from the start.
 */
function Sync({ sync, inset, t, locale }: { sync: SyncProgress; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const percent = R1_FORMAT.formatPercent(sync.percent, locale, 0) ?? "";
  return (
    <Panel title={t(`plr04.sync.title.${sync.state}`)} level={2} inset={inset} density="portal" locale={locale}>
      {sync.state !== "COMPLETE" ? (
        <Meter
          value={sync.percent}
          max={100}
          family={sync.state === "INTERRUPTED" ? "attention" : "info"}
          label={t("plr04.sync.meter")}
          valueText={t("plr04.sync.of", { p: percent, r: count(sync.receivedMb, locale), s: count(sync.sizeMb, locale) })}
          caption={t("plr04.sync.of", { p: percent, r: count(sync.receivedMb, locale), s: count(sync.sizeMb, locale) })}
          locale={locale}
        />
      ) : null}
      <FactList
        items={[
          ...(sync.state !== "COMPLETE"
            ? [
                { label: t("plr04.sync.fRemaining"), value: t("plr04.sync.mb", { n: count(sync.remainingMb, locale) }) },
                ...(sync.resumeFromMb !== null ? [{ label: t("plr04.sync.fResume"), value: t("plr04.sync.mb", { n: count(sync.resumeFromMb, locale) }) }] : []),
                { label: t("plr04.sync.fArriving"), value: t("plr04.sync.tracks", { n: count(sync.arrivingTracks ?? 0, locale), v: sync.snapshot }) },
              ]
            : [{ label: t("plr04.sync.fHeld"), value: t("plr04.sync.tracks", { n: count(sync.playableTracks, locale), v: sync.snapshot }) }]),
          { label: t("plr04.sync.fPlayable"), value: sync.playableTracks, kind: "count" as const },
          { label: t("plr04.fSynced"), value: sync.lastSynced, kind: "datetime" as const, missing: t("plr04.none") },
        ]}
        locale={locale}
      />
      <Text size="base" tone="secondary">
        {t(`plr04.sync.text.${sync.state}`)}
      </Text>
    </Panel>
  );
}

/**
 * Whose the offline limit is (DR-218): the approved offline-continuity version in force when the device lost contact,
 * with its grace period or none, or, before one is in force, the shortest limit of the snapshot it holds (BR-PLR-19).
 */
function limitKey(sentence: "plr04.limitText" | "plr05.why", offline: VenueViewData["offline"]): string {
  if (offline === null || offline.source === "snapshot" || offline.version === null) return `${sentence}.snapshot`;
  return offline.graceHours > 0 ? `${sentence}.policyGrace` : `${sentence}.policy`;
}

const limitValues = (offline: VenueViewData["offline"], locale: Locale) => ({ n: offline?.version ?? 0, g: count(offline?.graceHours ?? 0, locale) });

/** SCR-PLR-04: online, offline with time left, or at the evidence ceiling; the music plays in all three. */
function Running({ data, sync, frame, t, locale }: { data: VenueViewData; sync: SyncProgress | null; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const stamp = (iso: string | null) => (iso === null ? "" : (R1_FORMAT.formatStamp(iso, locale) ?? ""));
  const playing = data.playing;
  return (
    <Columns layout="halves" single={phone}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        {data.condition === "OFFLINE" && data.offline !== null ? (
          <>
            <PlayerStatusBlock
              condition="offline"
              remaining={{ value: data.offline.remainingHours, total: data.offline.limitHours }}
              facts={[
                { label: t("plr04.fWaiting"), value: count(data.evidence.waiting, locale) },
                { label: t("plr04.fContact"), value: stamp(data.offline.lastContact) },
              ]}
              locale={locale}
            >
              <Text>{t("plr04.offDetail")}</Text>
            </PlayerStatusBlock>
            <Panel title={t("plr04.limitTitle", { ts: moment(data.offline.stopsAt, locale) })} level={2} variant="plain" gap="sm" density="portal" locale={locale}>
              <Text size="base" tone="secondary">
                {t(limitKey("plr04.limitText", data.offline), limitValues(data.offline, locale))}
              </Text>
            </Panel>
          </>
        ) : null}
        {data.condition === "CEILING" ? (
          <>
            <PlayerStatusBlock
              condition="ceiling"
              facts={[
                { label: t("plr04.fWaiting"), value: count(data.evidence.waiting, locale) },
                { label: t("plr04.fCeiling"), value: count(data.evidence.ceiling, locale) },
              ]}
              locale={locale}
            >
              <Text>{t("plr04.ceilDetail", { n: count(data.evidence.ceiling, locale) })}</Text>
            </PlayerStatusBlock>
            <Panel title={t("plr04.ceilWhat")} level={2} variant="plain" gap="sm" density="portal" locale={locale}>
              <Text size="base" tone="secondary">
                {t("plr04.ceilText")}
              </Text>
            </Panel>
          </>
        ) : null}
        {data.condition === "ONLINE" ? (
          <>
            <PlayerStatusBlock
              condition="online"
              {...(sync?.state === "IN_PROGRESS" ? { headline: t("plr04.sync.headline") } : {})}
              facts={[
                { label: t("plr04.fWaiting"), value: count(data.evidence.waiting, locale) },
                sync?.state === "IN_PROGRESS"
                  ? { label: t("plr04.sync.fState"), value: R1_FORMAT.formatPercent(sync.percent, locale, 0) ?? "" }
                  : { label: t("plr04.fSynced"), value: stamp(data.lastSynced) },
              ]}
              locale={locale}
            />
            {playing !== null ? (
              <>
                <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
                  <Cover variant="groove" title={playing.title} by={playing.by} size={64} locale={locale} />
                  {playing.period !== null ? (
                    <Text size="base" tone="secondary">
                      {t("plr04.schedule", { playlist: playing.period.playlist, from: playing.period.start, to: playing.period.end })}
                    </Text>
                  ) : null}
                </div>
                <NowPlaying scale="phone" level={2} title={playing.title} byline={playing.by} credits={creditsOf(playing.credits)} locale={locale} />
              </>
            ) : null}
          </>
        ) : null}
        {sync !== null ? <Sync sync={sync} inset={inset} t={t} locale={locale} /> : null}
      </div>
      <Evidence data={data} inset={inset} playing t={t} locale={locale} />
    </Columns>
  );
}

/** SCR-PLR-05: the offline limit was reached, so playback stopped; the held evidence waits for the connection. */
function Stopped({ data, frame, t, locale }: { data: VenueViewData; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const offline = data.offline;
  return (
    <Columns layout="halves" single={phone}>
      <PlayerStatusBlock
        condition="limit-reached"
        headline={t("plr05.headline")}
        subject={t("plr05.subject", { ts: moment(offline?.reachedAt ?? data.asOf, locale) })}
        locale={locale}
      >
        <Text>{t(limitKey("plr05.why", offline), { hours: count(offline?.limitHours ?? 0, locale), ...limitValues(offline, locale) })}</Text>
        <Text weight="medium">{t("plr05.do")}</Text>
      </PlayerStatusBlock>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel title={t("plr05.heldTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("plr05.fHeld"), value: data.evidence.waiting, kind: "count", note: t("plr05.fHeldNote") },
              ...(offline !== null ? [{ label: t("plr04.fContact"), value: offline.lastContact, kind: "datetime" as const }] : []),
              { label: t("plr05.fLimit"), value: t("plr05.hours", { hours: count(offline?.limitHours ?? 0, locale) }) },
            ]}
            locale={locale}
          />
        </Panel>
        <Panel title={t("plr05.condTitle")} level={2} variant="plain" gap="sm" density="portal" locale={locale}>
          <Text size="base" tone="secondary">
            {t("plr05.condText")}
          </Text>
        </Panel>
      </div>
    </Columns>
  );
}

/**
 * Nothing reaches the device: PLR-06's words for a display with nothing to play, why (the premises' service in its
 * state's word and shape, or the device's credential), and what brings the music back. A stopped service is not a
 * fault of the device, and the page says so; the evidence waiting stays beside it.
 */
function NoDelivery({ data, stop, frame, t, locale }: { data: VenueViewData; stop: DeliveryStop; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const key = stopKey(stop);
  const service = stop.cause === "SERVICE" && stop.status !== null ? serviceStatus(stop.status, venTranslator(locale)) : null;
  return (
    <Columns layout="halves" single={phone}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PlayerStatusBlock
          condition="stopped"
          headline={t("plr.condition.STOPPED")}
          subject={t(`plr.stop.${key}`)}
          facts={[
            ...(service !== null
              ? [{ label: t("plr04.fService"), value: <StatusBadge family={service.family} label={service.label} {...(service.icon !== undefined ? { icon: service.icon } : {})} /> }]
              : []),
            { label: t("plr04.fWaiting"), value: count(data.evidence.waiting, locale) },
          ]}
          locale={locale}
        >
          <Text>{t(`plr04.stopText.${key}`)}</Text>
          <Text weight="medium">{t(`plr04.stopDo.${key}`)}</Text>
        </PlayerStatusBlock>
        {stop.cause === "SERVICE" ? (
          <Panel title={t("plr05.condTitle")} level={2} variant="plain" gap="sm" density="portal" locale={locale}>
            <Text size="base" tone="secondary">
              {t("plr04.stopFine")}
            </Text>
          </Panel>
        ) : null}
      </div>
      <Evidence data={data} inset={phone ? "sm" : "md"} playing={false} t={t} locale={locale} />
    </Columns>
  );
}
