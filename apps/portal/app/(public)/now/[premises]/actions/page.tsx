import { headers } from "next/headers";
import { Button, Divider, Icon, NowPlaying, QrCode, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { plropsTranslator } from "@/features/player-ops/copy";
import { Ambient, Cover } from "@/features/venue/Cover";
import { creditsOf, plrTranslator } from "@/features/venue/copy";
import { LoadError } from "@/features/venue/Frame";
import { currentWorld } from "@/lib/api/session";
import { loadNowPlaying, type GuestViewData } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR19_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-19 Guest actions, which needs no account (D-PLY-06, `/now/[venue]/actions`). At the installed display: the
 * title and the four credit roles on the left, each optional surface listed under them with its state word, and a
 * pane with the cover, the code and the scan line on the right. On a guest's phone, which that code opens: the track
 * and its credits, then Verify this venue, Read the lyrics and Support the artist, each kept and disabled with its
 * reason when it cannot open. It reads the same now-playing answer as SCR-PLR-06, so when delivery stops (the
 * premises' Player service is not ACTIVE, or the device holds no credential) nothing plays here either, and only
 * Verify this venue stays open.
 */
export default async function GuestActionsPage({ params, searchParams }: { params: Promise<{ premises: string }>; searchParams: Promise<SearchParams> }) {
  const [{ premises }, query] = await Promise.all([params, searchParams]);
  const [locale, frame, world, host] = await Promise.all([getLocale(), getFrame(query), currentWorld(), headers()]);
  const t = plrTranslator(locale);
  const own = plropsTranslator(locale);
  const view = reviewView(query, PLR19_VIEWS);
  const outcome = view === "loading" ? null : await loadNowPlaying(world, premises, view);
  const guest = outcome?.data ?? null;
  // The display's code opens this same page on a guest's phone.
  const here = `${host.get("x-forwarded-proto") ?? "http"}://${host.get("host") ?? ""}${routes.guestActions(premises)}`;

  if (frame === "phone") {
    return (
      <PublicShell variant="verification" fill locale={locale}>
        {view === "loading" ? <ViewState view="loading" skeleton="card" rows={4} density="portal" locale={locale} /> : null}
        {outcome !== null && outcome.failure !== null ? <LoadError failure={outcome.failure} locale={locale} /> : null}
        {guest !== null ? <Phone guest={guest} t={t} own={own} locale={locale} /> : null}
      </PublicShell>
    );
  }
  return (
    <div
      data-theme="player"
      lang={locale}
      style={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "var(--space-16) var(--space-24)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
      }}
    >
      {view === "loading" ? <ViewState view="loading" skeleton="card" rows={4} locale={locale} /> : null}
      {outcome !== null && outcome.failure !== null ? <LoadError failure={outcome.failure} locale={locale} /> : null}
      {guest !== null ? <Display guest={guest} here={here} t={t} own={own} locale={locale} /> : null}
    </div>
  );
}

/** Music the guest can open: playing, or playing on from what the device holds while it is offline. */
const sounding = (guest: GuestViewData) => guest.track !== null && (guest.state === "PLAYING" || guest.state === "OFFLINE" || guest.state === "PAUSED");

/**
 * The installed display. While music plays: the poster with its optional surfaces over the cover's ambient ground,
 * and the pane with the cover, the code and the scan line. When nothing plays: the venue and the words SCR-PLR-06
 * shows, with the code where Verify this venue can still open.
 */
function Display({ guest, here, t, own, locale }: { guest: GuestViewData; here: string; t: Translate; own: Translate; locale: Locale }) {
  const track = guest.track;
  if (track === null || !sounding(guest)) {
    return (
      <>
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "var(--space-6)" }}>
          {guest.venue !== null ? (
            <Text size="guest" tone="secondary">
              {guest.venue}
            </Text>
          ) : null}
          <Text as="h2" size="guest" weight="semibold">
            {t("plr06.idle")}
          </Text>
        </div>
        {guest.venue !== null && guest.surfaces.verification === "available" ? (
          <>
            <Divider />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--space-16)", alignItems: "center" }}>
              <Text size="guest" tone="secondary">
                {t("plr06.scanIdle")}
              </Text>
              <QrCode value={here} size={184} label={own("plr19.qrLabel")} />
            </div>
          </>
        ) : null}
      </>
    );
  }
  const paused = guest.state === "PAUSED";
  return (
    <>
      <Ambient title={track.title} />
      <div style={{ flexGrow: 1, display: "grid", gridTemplateColumns: "minmax(0, 1fr) var(--container-lg)", gap: "var(--space-16)", alignItems: "center" }}>
        <NowPlaying
          scale="display"
          layout="poster"
          level={1}
          title={track.title}
          credits={creditsOf(track.credits)}
          {...(paused ? { paused: true } : {})}
          optional={[
            { label: t("plr06.lyricsLabel"), state: guest.surfaces.lyrics },
            { label: t("plr06.supportLabel"), state: guest.surfaces.support },
            { label: t("plr06.verifyLabel"), state: guest.surfaces.verification },
          ]}
          locale={locale}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          <Cover variant="groove" title={track.title} by={track.by} size={400} scale="display" {...(paused ? { state: "paused" as const } : {})} locale={locale} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", alignItems: "flex-start" }}>
            <QrCode value={here} size={184} label={own("plr19.qrLabel")} />
            <Text size="guest" tone="secondary">
              {guest.surfaces.verification === "available" ? own("plr19.scan") : own("plr19.scanOffline")}
            </Text>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The guest-actions page on a guest's phone: the cover beside the venue line, the title and the four credits, then
 * the three actions as full-width buttons. One that cannot open stays, disabled with its reason; when nothing plays,
 * only Verify this venue can open.
 */
function Phone({ guest, t, own, locale }: { guest: GuestViewData; t: Translate; own: Translate; locale: Locale }) {
  const track = sounding(guest) ? guest.track : null;
  const verification = guest.verification;
  const venue =
    guest.venue !== null ? (
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <Icon name="building-2" size={16} />
        <Text size="sm" tone="secondary">
          {guest.venue}
        </Text>
      </div>
    ) : null;
  return (
    <>
      {track !== null ? (
        <>
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <Cover variant="groove" title={track.title} by={track.by} size={64} {...(guest.state === "PAUSED" ? { state: "paused" as const } : {})} locale={locale} />
            {venue}
          </div>
          <NowPlaying
            scale="phone"
            level={1}
            title={track.title}
            byline={track.by}
            credits={creditsOf(track.credits)}
            {...(guest.state === "PAUSED" ? { paused: true } : {})}
            locale={locale}
          />
        </>
      ) : (
        <>
          {venue}
          <ViewState view="empty" empty={{ variant: "not-started", title: t("plr06.idle") }} density="portal" locale={locale} />
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Button
          variant="primary"
          size="lg"
          icon="shield-check"
          fullWidth
          {...(guest.surfaces.verification === "available" && verification !== null
            ? { href: routes.verifyPlayer(verification.printedCode) }
            : { disabled: true, disabledReason: t("plr06.verifyWhy") })}
          locale={locale}
        >
          {t("plr06.verify")}
        </Button>
        <Button
          size="md"
          icon="file-text"
          fullWidth
          {...(track !== null && guest.surfaces.lyrics === "available"
            ? {}
            : { disabled: true, disabledReason: track === null ? own("plr19.quietWhy") : t("plr06.lyricsWhy") })}
          locale={locale}
        >
          {t("plr06.lyrics")}
        </Button>
        <Button
          size="md"
          icon="hand-heart"
          fullWidth
          {...(track !== null && guest.surfaces.support === "available"
            ? {}
            : { disabled: true, disabledReason: track === null ? own("plr19.quietWhy") : own("plr19.supportWhy") })}
          locale={locale}
        >
          {t("plr06.supportLabel")}
        </Button>
      </div>
    </>
  );
}
