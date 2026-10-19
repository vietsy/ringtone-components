import { ItemList, PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { Text } from "@/components/Text";
import { publicLayout } from "@/features/public/layout";
import { PageError } from "@/features/public/PageError";
import { sourceRefusal } from "@/features/public/source-refusal";
import { trackLength } from "@/features/public/track-length";
import { loadArtistProfile } from "@/lib/api/public";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { PUB08_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PUB-08 Public artist profile (D-PUB-08): the artist's display name and public repertoire, with the biography
 * and image only where an approved profile admits them. At P1 ART offers no public reader, so the page says that
 * RightOne does not offer this information yet, and shows nothing older in its place.
 */
export default async function ArtistProfilePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  // A reviewer's ?view= shows a drawn state; otherwise the profile ART answers for the address.
  const view = reviewView(query, PUB08_VIEWS);
  const { gap, inset } = publicLayout(frame);
  const outcome = view === "loading" ? null : await loadArtistProfile(slug, view);
  const profile = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const refusal = failure !== null ? sourceRefusal(failure, { code: "ARTIST_NOT_PUBLIC", title: "pub08.notPublic" }, routes.artist(slug), t) : null;

  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader title={profile?.displayName ?? t("pub08.title")} size="public" locale={locale} />

        {profile !== null && (
          <>
            {profile.biography !== null && (
              <Text size="base" measure="2xl">
                {profile.biography}
              </Text>
            )}
            <Panel
              title={t("pub08.repTitle")}
              meta={t("pub08.repMeta", { count: profile.repertoire.length })}
              level={2}
              inset={inset}
              density="portal"
              locale={locale}
            >
              <ItemList
                items={profile.repertoire.map((track) => ({
                  key: track.id,
                  title: track.title,
                  href: routes.track(track.id),
                  meta: t("pub.length", { length: trackLength(track.durationSeconds) }),
                }))}
                readOnly
                density="portal"
                label={t("pub08.repTitle")}
                locale={locale}
              />
            </Panel>
          </>
        )}

        {refusal !== null && <ViewState view="refused" refusal={refusal} level={2} density="portal" locale={locale} />}
        {failure !== null && refusal === null && <PageError failure={failure} t={t} locale={locale} />}

        {view === "loading" && (
          <>
            <Skeleton variant="text" rows={2} density="portal" locale={locale} />
            <Panel title={t("pub08.repTitle")} level={2} inset={inset} density="portal" locale={locale}>
              <Skeleton variant="table" rows={3} columns={2} density="portal" locale={locale} />
            </Panel>
          </>
        )}
      </div>
    </PublicShell>
  );
}
