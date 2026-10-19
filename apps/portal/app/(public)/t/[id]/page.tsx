import { AudioPreview, FactList, Link, NavList, PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { publicLayout } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { sourceRefusal } from "@/features/public/source-refusal";
import { trackLength } from "@/features/public/track-length";
import { loadPublicTrack } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { PUB09_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PUB-09 Public track page (D-PUB-09): a track's public information and its public preview, the artist and the
 * track's direct licence one step away. At P1 TRK offers no public reader, so the page says that RightOne does not
 * offer this information yet and shows nothing older; "Trợ giúp" stays.
 */
export default async function PublicTrackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the track TRK answers for the address.
  const view = reviewView(query, PUB09_VIEWS);
  const { gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadPublicTrack(id, view);
  const track = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const refusal = failure !== null ? sourceRefusal(failure, { code: "TRACK_NOT_PUBLIC", title: "pub09.notPublic" }, routes.track(id), t) : null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={track?.title ?? t("pub09.title")} {...(track !== null ? { meta: track.artist.displayName } : {})} size="public" locale={locale} />

        {track !== null && (
          <>
            {/* ASSET_NOT_PUBLIC refuses the preview alone (Partial): the track stays. */}
            <AudioPreview
              title={track.title}
              by={track.artist.displayName}
              duration={track.previewSeconds}
              elapsed={0}
              clip={t("pub09.clip", { seconds: track.previewSeconds })}
              {...(track.previewPublic ? {} : { unavailable: t("pub09.noPreview") })}
              locale={locale}
            />
            <Panel inset={inset} density="portal" locale={locale}>
              <FactList
                items={[
                  { label: t("pub09.fArtist"), value: track.artist.displayName },
                  { label: t("pub09.fLength"), value: trackLength(track.durationSeconds) },
                ]}
                locale={locale}
              />
            </Panel>
            <NavList
              title={t("pub.goTitle")}
              items={[
                { label: t("pub09.artist"), detail: t("pub09.artistD", { artist: track.artist.displayName }), icon: "user", href: routes.artist(track.artist.slug) },
                { label: t("pub09.licence"), detail: t("pub09.licenceD"), icon: "file-check", href: routes.verifyLicence(track.licenceReference) },
              ]}
              locale={locale}
            />
          </>
        )}

        {refusal !== null && <ViewState view="refused" refusal={refusal} level={2} density="portal" locale={locale} />}
        {failure !== null && refusal === null && <PageError failure={failure} t={t} locale={locale} />}

        {view === "loading" && (
          <>
            <Skeleton variant="card" rows={2} density="portal" locale={locale} />
            <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
          </>
        )}

        <Link href={routes.help({ from: routes.track(id) })} variant="standalone" size="touch" icon="circle-help" locale={locale}>
          {t("pub.help")}
        </Link>
      </div>
    </PublicShell>
  );
}
