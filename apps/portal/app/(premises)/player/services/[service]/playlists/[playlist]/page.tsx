import { Link, PageHeader, ViewState } from "@/components/r1";
import { savePlaylist } from "@/features/venue/actions";
import { day, playlistStatus, refusalWords, venTranslator } from "@/features/venue/copy";
import { LoadError, RefusalBanner, RefusedBody, VenueShell } from "@/features/venue/Frame";
import { PlaylistEditorForm } from "@/features/venue/PlaylistEditorForm";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadPlaylistEditor, type EditorAttempt, type PlaylistEditor } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN07_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** Where each save refusal is drawn: beside the item it names, above the items, under the name, or in the header. */
const PLACE: Readonly<Record<string, "item" | "items" | "name" | "header">> = {
  TRACK_NOT_ELIGIBLE: "item",
  MOOD_NOT_EFFECTIVE: "item",
  FIELD_NOT_PERMITTED: "items",
  PLAYLIST_IN_USE_WOULD_BE_EMPTY: "items",
  FIELD_MISSING: "name",
  ENTITLEMENT_NOT_ACTIVE: "header",
  PLAYLIST_ARCHIVED: "header",
  NOT_AUTHORISED_FOR_PREMISES: "header",
};

/**
 * SCR-VEN-07 Playlist editor: a new playlist (the address `…/playlists/new`), or the next revision of one, from
 * eligible tracks and shared moods in effect. An archived playlist is read-only; a playlist of another premises is
 * not found.
 */
export default async function PlaylistPage({ params, searchParams }: { params: Promise<{ service: string; playlist: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service, playlist }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN07_VIEWS);
  const id = playlist === "new" ? null : playlist;
  const outcome = view === "loading" ? null : await loadPlaylistEditor(principal, service, id, view);
  const last = readForPage<EditorAttempt>(query);
  const attempt = last?.page === "editor" && last.service === service && last.playlist === id ? last : null;
  const editor = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const backToList = { label: t("ven07.back"), href: routes.playerPlaylists(service) };

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={editor !== null ? { premises: editor.service.premises.name, period: editor.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(editor !== null ? [{ label: editor.service.premises.name, href: routes.playerService(service) }] : []),
          { label: t("ven07.lists"), href: routes.playerPlaylists(service) },
        ]}
        title={editor?.playlist?.name ?? t("ven07.newTitle")}
        {...(editor !== null && editor.playlist !== null ? { status: playlistStatus(editor.playlist.status, t) } : {})}
        {...(editor !== null ? { meta: meta(editor, t, locale) } : {})}
        locale={locale}
      />
      {view === "loading" ? <ViewState view="loading" skeleton="text" rows={8} density="portal" locale={locale} /> : null}
      {failure !== null && failure.code === "PLAYLIST_NOT_FOUND" ? <RefusedBody code={failure.code} back={backToList} t={t} locale={locale} /> : null}
      {failure !== null && failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? <RefusalBanner code={failure.code} t={t} locale={locale} /> : null}
      {failure !== null && failure.code !== "PLAYLIST_NOT_FOUND" && failure.code !== "NOT_AUTHORISED_FOR_PREMISES" ? <LoadError failure={failure} locale={locale} /> : null}
      {editor !== null ? <Editor editor={editor} attempt={attempt} frame={frame} t={t} locale={locale} /> : null}
      {failure !== null ? (
        <div>
          <Link back href={backToList.href} variant="standalone" size="touch" locale={locale}>
            {backToList.label}
          </Link>
        </div>
      ) : null}
    </VenueShell>
  );
}

function meta(editor: PlaylistEditor, t: Translate, locale: Locale): string {
  const playlist = editor.playlist;
  if (playlist === null) return t("ven07.metaNew");
  if (playlist.archivedOn !== null) return t("ven07.metaArchived", { n: playlist.revision, d: day(`${playlist.archivedOn}T12:00:00+07:00`, locale) });
  return t("ven07.meta", { n: playlist.revision, next: playlist.revision + 1 });
}

function Editor({ editor, attempt, frame, t, locale }: { editor: PlaylistEditor; attempt: EditorAttempt | null; frame: Frame; t: Translate; locale: Locale }) {
  const code = editor.service.code;
  const playlist = editor.playlist;
  const mutable = editor.service.status === "PENDING_TERMS" || editor.service.status === "ACTIVE";
  const archived = playlist?.status === "ARCHIVED";
  const items = attempt?.items ?? editor.items;
  const place = attempt !== null ? (PLACE[attempt.code] ?? "items") : null;
  const header = place === "header" ? (attempt?.code ?? null) : !mutable ? "ENTITLEMENT_NOT_ACTIVE" : archived ? "PLAYLIST_ARCHIVED" : null;
  const words = attempt !== null ? refusalWords(attempt.code, t) : null;
  return (
    <>
      {header !== null ? <RefusalBanner code={header} family={header === "PLAYLIST_ARCHIVED" ? "info" : "neutral"} t={t} locale={locale} /> : null}
      <PlaylistEditorForm
        service={code}
        playlist={playlist === null ? null : { id: playlist.id, name: playlist.name }}
        initialName={attempt?.name ?? ""}
        saved={editor.items}
        initialItems={items}
        moods={editor.moods}
        refusal={
          attempt !== null && words !== null && place !== null && place !== "header"
            ? {
                code: attempt.code,
                title: words.title,
                text: words.text,
                sentence: t(`ven.refusal.${attempt.code}`),
                ref: attempt.item !== null ? (items[attempt.item]?.ref ?? null) : null,
                place,
              }
            : null
        }
        readOnly={archived}
        stopped={mutable ? null : refusalWords("ENTITLEMENT_NOT_ACTIVE", t).title}
        copy={{
          items: t("ven07.items"),
          name: t("ven07.name"),
          noItemsTitle: t("ven07.noItemsTitle"),
          noItemsText: t("ven07.noItemsText"),
          addTitle: t("ven07.addTitle"),
          search: t("ven07.search"),
          searchHelp: t("ven07.searchHelp"),
          noResults: t("ven07.noResults"),
          add: t("ven07.add"),
          mood: t("ven07.mood"),
          moodPlaceholder: t("ven07.moodPh"),
          moodHelp: t("ven07.moodHelp"),
          back: t("ven07.back"),
          track: t("ven07.track"),
          moodKind: t("ven07.moodKind"),
          byRightOne: t("ven07.byRightOne"),
          eligible: t("ven07.eligible"),
          notEligible: t("ven07.notEligible"),
          inEffect: t("ven07.inEffect"),
          notInEffect: t("ven07.notInEffect"),
          added: t("ven07.added"),
          unsavedAdded: t("ven07.unsavedAdded"),
          unsavedRemoved: t("ven07.unsavedRemoved"),
          unsavedMoved: t("ven07.unsavedMoved"),
          nameFirst: t("ven07.nameFirst"),
          changeFirst: archived ? t("ven.refusal.PLAYLIST_ARCHIVED") : t("ven07.changeFirst"),
          leaveTitle: t("ven07.leaveTitle"),
          leaveText: t("ven07.leaveText"),
          leave: t("ven07.leave"),
          keepEditing: t("ven07.keepEditing"),
          save: playlist === null ? t("ven07.saveNew") : archived ? t("ven07.saveArchived") : t("ven07.save", { n: playlist.revision + 1 }),
        }}
        action={savePlaylist.bind(null, code, playlist?.id ?? null)}
        backHref={routes.playerPlaylists(code)}
        phone={frame === "phone"}
        locale={locale}
      />
    </>
  );
}
