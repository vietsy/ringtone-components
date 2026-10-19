import type { Route } from "next";
import { Banner, Button, Columns, PageHeader, Panel, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ListPager } from "@/features/venue/ListPager";
import { createMood } from "@/features/venue/console-actions";
import { moodState, refusal, sentence } from "@/features/venue/console-copy";
import { ConsoleFilter } from "@/features/venue/ConsoleFilter";
import { day, venTranslator } from "@/features/venue/copy";
import { MoodForm } from "@/features/venue/MoodForm";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import { loadMoodLibrary, MOOD_VERSION_STATES, type MoodAttempt, type MoodLibrary, type MoodVersionSummary } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN17_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The rows the skeleton draws while the library is read (design/03, SCR-VEN-17 Loading). */
const LOADING_ROWS = 10;

/**
 * SCR-VEN-17 Shared mood library, the Shared moods workspace's landing: every mood with the state of its versions,
 * filtered by version state in the address; a row opens the mood's newest version. The moderator creates a mood with
 * its version 1; operations read, and see the new-mood panel unavailable with the role that holds it.
 */
export default async function SharedMoodLibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-MOD", "ACT-OPS");
  const params = await searchParams;
  const locale = await getLocale();
  const t = venTranslator(locale);
  const status = typeof params.status === "string" && params.status !== "" ? params.status : null;
  const view = reviewView(params, VEN17_VIEWS);
  const kept = readForPage<MoodAttempt>(params);
  const attempt = kept?.form === "create" ? kept : null;
  const after = typeof params.after === "string" && params.after !== "" ? params.after : null;
  const outcome = view === "loading" ? null : await loadMoodLibrary(staff, status, view, after);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const moderator = holds(staff, "ACT-MOD");

  return (
    <OpsFrame
      console="operations"
      current="content"
      staff={staff}
      searchLabel={t("venops.searchMoods")}
      // The rows' keys are listed only while the table that binds them is on the page.
      keyMap={
        failure === null && data?.refusal !== "CURSOR_INVALID"
          ? [
              { keys: ["J", "K"], label: t("ven17.kMove") },
              { keys: ["Enter"], label: t("ven17.kOpen") },
            ]
          : []
      }
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("venops.contentArea") }]} title={t("ven17.title")} meta={t("ven17.meta")} locale={locale}>
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("ven17.close")}
          </Button>
        </PageHeader>
        {attempt?.code === "NOT_AUTHORISED" ? (
          <Banner family="neutral" title={refusal(attempt.code, t).title} code={attempt.code} level={2} density="console" live locale={locale}>
            {refusal(attempt.code, t).text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("ven.errTitle")}
            errorText={t("ven.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="console"
            level={2}
            locale={locale}
          />
        ) : (
          <Columns>
            <Moods data={data} status={status} t={t} locale={locale} />
            <Panel as="aside" title={t("ven17.newTitle")} level={2} gap="lg" density="console" locale={locale}>
              {moderator ? (
                <MoodForm
                  mode="create"
                  copy={{
                    name: t("ven17.name"),
                    owner: t("ven17.owner"),
                    ownerSO: t("venops.ownerSO"),
                    from: t("ven17.from"),
                    tracks: t("ven17.tracks"),
                    picked: t("venops.picked"),
                    pickedOne: t("venops.pickedOne"),
                    addTracks: t("venops.addTracks"),
                    search: t("venops.trackSearch"),
                    searchHelp: t("venops.trackSearchHelp"),
                    noResults: t("venops.trackNoResults"),
                    add: t("venops.trackAdd"),
                    submit: t("ven17.create"),
                    fillFirst: t("ven17.fillFirst"),
                  }}
                  initial={attempt?.values ?? { name: "", effectiveFrom: "", tracks: [] }}
                  errors={fieldErrors(attempt, t)}
                  refusal={attempt?.code === "TRACK_NOT_ELIGIBLE" && attempt.track !== null ? { track: attempt.track, sentence: sentence(attempt.code, t) } : null}
                  action={createMood}
                  locale={locale}
                />
              ) : (
                <Button variant="primary" size="sm" fullWidth disabled disabledReason={t("ven17.modOnly")} locale={locale}>
                  {t("ven17.create")}
                </Button>
              )}
            </Panel>
          </Columns>
        )}
      </div>
    </OpsFrame>
  );
}

/** FIELD_MISSING beside the field it names (design/03, SCR-VEN-17 Refused). */
function fieldErrors(attempt: MoodAttempt | null, t: Translate): { name?: string; effectiveFrom?: string; tracks?: string } {
  if (attempt?.code !== "FIELD_MISSING") return {};
  const words = sentence(attempt.code, t);
  return attempt.field === "name" ? { name: words } : attempt.field === "effective_from" ? { effectiveFrom: words } : attempt.field === "tracks" ? { tracks: words } : {};
}

function Moods({ data, status, t, locale }: { data: MoodLibrary | null; status: string | null; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const known = MOOD_VERSION_STATES.find((state) => state === status) ?? null;
  const chips: { label: string; href: Route }[] = known !== null ? [{ label: t("ven17.chip", { s: t(`venops.mood.${known}`) }), href: routes.opsMoods() }] : [];
  const entry = (version: MoodVersionSummary) => ({
    code: `v${String(version.no)}`,
    status: moodState(version.state, t),
    text:
      version.state === "WITHDRAWN" && version.withdrawnReason !== null
        ? version.withdrawnReason[locale]
        : t("ven17.versionFrom", { d: day(`${version.effectiveFrom}T12:00:00+07:00`, locale) }),
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      <ConsoleFilter
        label={t("ven17.filterBar")}
        fields={[
          {
            kind: "select",
            label: t("ven17.filter"),
            name: "status",
            value: known ?? "all",
            width: "var(--space-60)",
            options: [
              { value: "all", label: t("ven17.all"), href: routes.opsMoods() },
              ...MOOD_VERSION_STATES.map((state) => ({ value: state, label: t(`venops.mood.${state}`), href: routes.opsMoods(state) })),
            ],
          },
        ]}
        chips={chips}
        clearHref={routes.opsMoods()}
        summary={null}
        locale={locale}
      />
      {data?.refusal === "CURSOR_INVALID" ? (
        <Banner
          family="neutral"
          title={refusal("CURSOR_INVALID", t).title}
          code="CURSOR_INVALID"
          action={{ label: t("ven17.reload"), icon: "refresh-cw", variant: "secondary", href: routes.opsMoods() }}
          density="console"
          locale={locale}
        >
          {refusal("CURSOR_INVALID", t).text}
        </Banner>
      ) : (
        <>
          <Table
            columns={[
              { key: "mood", label: t("ven17.cMood"), kind: "strong" },
              { key: "versions", label: t("ven17.cVersions"), kind: "entries" },
              { key: "owner", label: t("ven17.cOwner") },
              { key: "retired", label: t("ven17.cRetired"), kind: "muted", missing: t("venops.none") },
              { key: "open", kind: "actions" },
            ]}
            rows={rows.map((row) => ({
              _key: row.id,
              ...(row.versions[0] !== undefined ? { _href: routes.opsMoodVersion(row.versions[0].id) } : {}),
              mood: row.name,
              // The two newest versions, as the library draws them; the mood's every version is on SCR-VEN-18.
              versions: row.versions.slice(0, 2).map(entry),
              owner: t("venops.ownerSO"),
              retired: row.retiredAt === null ? null : t("ven17.retired", { d: day(row.retiredAt, locale) }),
              // Open (row) reads the newest version; each version shown opens on its own.
              open: row.versions.slice(0, 2).map((version) => ({
                label: t("ven17.openVersion", { n: String(version.no) }),
                href: routes.opsMoodVersion(version.id),
                variant: "quiet",
                ariaLabel: `${t("ven17.openVersion", { n: String(version.no) })} ${row.name}`,
              })),
            }))}
            density="console"
            caption={t("ven17.listTitle")}
            rowFocus
            loading={data === null ? LOADING_ROWS : false}
            empty={known === null ? { variant: "not-started", title: t("ven17.emptyTitle"), action: false } : { variant: "filtered", title: t("ven17.filteredEmpty"), action: false }}
            locale={locale}
          />
          {data !== null ? <ListPager paging={data.paging} href={(cursor) => routes.opsMoods(status, cursor)} density="console" always t={t} locale={locale} /> : null}
        </>
      )}
    </div>
  );
}
