import { headers } from "next/headers";
import { Button, Divider, Icon, NowPlaying, QrCode, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { Ambient, Cover } from "@/features/venue/Cover";
import { creditsOf, plrTranslator } from "@/features/venue/copy";
import { LoadError } from "@/features/venue/Frame";
import { currentWorld } from "@/lib/api/session";
import { loadNowPlaying, type GuestViewData } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR06_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-06 Now playing, which needs no account: the guest display a room reads at three metres, and the same view
 * on a guest's phone. The display's code opens the guest actions (SCR-PLR-19) on the phone. The title and the four credit roles are the layout and never
 * give way to an optional surface; each optional surface says when it is unavailable rather than leaving a gap.
 * Nothing about the premises is shown but its name.
 */
export default async function NowPlayingPage({ params, searchParams }: { params: Promise<{ premises: string }>; searchParams: Promise<SearchParams> }) {
  const [{ premises }, query] = await Promise.all([params, searchParams]);
  const [locale, frame, world, host] = await Promise.all([getLocale(), getFrame(query), currentWorld(), headers()]);
  const t = plrTranslator(locale);
  const view = reviewView(query, PLR06_VIEWS);
  const outcome = view === "loading" ? null : await loadNowPlaying(world, premises, view);
  const guest = outcome?.data ?? null;
  // The display's code opens the guest actions (SCR-PLR-19) on a guest's phone: the inventory's way from this screen to that one.
  const here = `${host.get("x-forwarded-proto") ?? "http"}://${host.get("host") ?? ""}${routes.guestActions(premises)}`;

  if (frame === "phone") {
    return (
      <PublicShell variant="verification" fill locale={locale}>
        {view === "loading" ? <ViewState view="loading" skeleton="card" rows={4} density="portal" locale={locale} /> : null}
        {outcome !== null && outcome.failure !== null ? <LoadError failure={outcome.failure} locale={locale} /> : null}
        {guest !== null ? <Phone guest={guest} t={t} locale={locale} /> : null}
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
        padding: "var(--space-16) var(--space-24) var(--space-10)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
      }}
    >
      {view === "loading" ? <ViewState view="loading" skeleton="card" rows={4} locale={locale} /> : null}
      {outcome !== null && outcome.failure !== null ? <LoadError failure={outcome.failure} locale={locale} /> : null}
      {guest !== null ? <Display guest={guest} here={here} t={t} locale={locale} /> : null}
    </div>
  );
}

/**
 * The guest display at the installed screen: the poster over the cover's ambient ground while music plays, the
 * venue and the code otherwise.
 */
function Display({ guest, here, t, locale }: { guest: GuestViewData; here: string; t: Translate; locale: Locale }) {
  const track = guest.track;
  const playing = track !== null && (guest.state === "PLAYING" || guest.state === "OFFLINE" || guest.state === "PAUSED");
  const scan = playing ? (guest.surfaces.verification === "available" ? t("plr06.scan") : t("plr06.scanOffline")) : t("plr06.scanIdle");
  return (
    <>
      {playing ? <Ambient title={track.title} /> : null}
      {playing ? (
        <div style={{ flexGrow: 1, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "var(--space-24)", alignItems: "center" }}>
          <Cover variant="groove" title={track.title} by={track.by} size={520} scale="display" {...(guest.state === "PAUSED" ? { state: "paused" as const } : {})} locale={locale} />
          <NowPlaying
            scale="display"
            layout="poster"
            level={1}
            title={track.title}
            credits={creditsOf(track.credits)}
            {...(guest.state === "PAUSED" ? { paused: true } : {})}
            optional={[
              { label: t("plr06.lyricsLabel"), state: guest.surfaces.lyrics },
              { label: t("plr06.verifyLabel"), state: guest.surfaces.verification },
              { label: t("plr06.supportLabel"), state: guest.surfaces.support },
            ]}
            locale={locale}
          />
        </div>
      ) : (
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
      )}
      {guest.venue !== null ? (
        <>
          <Divider />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--space-16)", alignItems: "center" }}>
            <Text size="guest" tone="secondary">
              {scan}
            </Text>
            <QrCode value={here} size={184} label={t("plr06.qrLabel")} />
          </div>
        </>
      ) : null}
    </>
  );
}

/** The same view on a guest's phone: the track, its credits, and the optional surfaces as buttons that say when they cannot open. */
function Phone({ guest, t, locale }: { guest: GuestViewData; t: Translate; locale: Locale }) {
  const track = guest.track;
  if (track === null) {
    return (
      <ViewState view="empty" empty={{ variant: "not-started", title: t("plr06.idle"), ...(guest.venue !== null ? { text: guest.venue } : {}) }} density="portal" locale={locale} />
    );
  }
  const verification = guest.verification;
  return (
    <>
      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
        <Cover variant="groove" title={track.title} by={track.by} size={64} {...(guest.state === "PAUSED" ? { state: "paused" as const } : {})} locale={locale} />
        {guest.venue !== null ? (
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <Icon name="building-2" size={16} />
            <Text size="sm" tone="secondary">
              {guest.venue}
            </Text>
          </div>
        ) : null}
      </div>
      <NowPlaying
        scale="phone"
        level={1}
        title={track.title}
        byline={track.by}
        credits={creditsOf(track.credits)}
        {...(guest.state === "PAUSED" ? { paused: true } : {})}
        optional={[{ label: t("plr06.supportLabel"), state: guest.surfaces.support }]}
        locale={locale}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Button
          variant="primary"
          size="lg"
          icon="file-text"
          fullWidth
          {...(guest.surfaces.lyrics === "available" ? {} : { disabled: true, disabledReason: t("plr06.lyricsWhy") })}
          locale={locale}
        >
          {t("plr06.lyrics")}
        </Button>
        <Button
          variant="secondary"
          size="md"
          icon="shield-check"
          fullWidth
          {...(guest.surfaces.verification === "available" && verification !== null
            ? { href: routes.verifyPlayer(verification.printedCode) }
            : { disabled: true, disabledReason: t("plr06.verifyWhy") })}
          locale={locale}
        >
          {t("plr06.verify")}
        </Button>
      </div>
    </>
  );
}
