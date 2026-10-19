import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Button,
  Columns,
  Divider,
  EmptyState,
  FactList,
  PageHeader,
  Panel,
  Table,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { approveMoodVersion, prepareMoodVersion, withdrawMoodVersion } from "@/features/venue/console-actions";
import { moodState, refusal, sentence } from "@/features/venue/console-copy";
import { day, venTranslator } from "@/features/venue/copy";
import { MoodForm } from "@/features/venue/MoodForm";
import { VersionActions } from "@/features/venue/VersionActions";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { loadMoodVersion, type MoodAttempt, type MoodVersionSummary, type MoodVersionView } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN18_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** Refusals of an approval or a withdrawal said above the action row; the rest are the prepare panel's or the header's. */
const ACT_REFUSALS = ["VERSION_NOT_DRAFT", "VERSION_HAS_NO_ELIGIBLE_TRACK", "EFFECTIVE_FROM_IN_PAST", "RANGE_OVERLAP", "VERSION_NOT_WITHDRAWABLE"];
const ATTENTION = ["VERSION_HAS_NO_ELIGIBLE_TRACK", "EFFECTIVE_FROM_IN_PAST"];

/**
 * SCR-VEN-18 Shared mood version: one version with its tracks and the mood's other versions, and the act the reader's
 * role holds on it. The moderator prepares the next version and withdraws a draft; operations approve a draft they
 * did not prepare and withdraw an approved or effective version. A control the role does not hold stays on the row,
 * unavailable, naming the role that holds it.
 */
export default async function SharedMoodVersionPage({ params, searchParams }: { params: Promise<{ version: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-MOD", "ACT-OPS");
  const [{ version }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = venTranslator(locale);
  const view = reviewView(query, VEN18_VIEWS);
  const attempt = readForPage<MoodAttempt>(query);
  const outcome = view === "loading" ? null : await loadMoodVersion(staff, version, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const header = attempt?.code === "NOT_AUTHORISED" || attempt?.code === "MOOD_RETIRED" ? attempt.code : null;

  return (
    <OpsFrame
      console="operations"
      current="content"
      staff={staff}
      searchLabel={t("venops.searchMoods")}
      // The tracks' keys are listed only while the version's tracks are on the page.
      keyMap={[...(data !== null ? [{ keys: ["J", "K"], label: t("ven18.kTracks") }] : []), { keys: ["Esc"], label: t("venops.kEsc") }]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("venops.contentArea") }, { label: t("venops.moods"), href: routes.opsMoods() }]}
          title={data !== null ? t("ven18.title", { name: data.mood.name, n: data.version.no }) : t("ven18.titleFallback")}
          {...(data !== null ? { status: moodState(data.version.state, t) } : {})}
          locale={locale}
        />
        {header !== null ? (
          <Banner family="neutral" title={refusal(header, t).title} code={header} level={2} density="console" live locale={locale}>
            {refusal(header, t).text}
          </Banner>
        ) : null}
        {view === "loading" ? <ViewState view="loading" skeleton="table" rows={8} density="console" locale={locale} /> : null}
        {failure !== null ? (
          failure.code === "VERSION_NOT_FOUND" ? (
            <ViewState view="refused" refusal={{ ...refusal(failure.code, t), family: "neutral", action: { label: t("ven18.back"), href: routes.opsMoods() } }} density="console" level={2} locale={locale} />
          ) : (
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
          )
        ) : null}
        {data !== null ? <Version data={data} staff={staff} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** "từ 15 tháng 10, 2026", "1 tháng 7, 2026 – 31 tháng 8, 2026", or never in effect for a version withdrawn as a draft. */
function effectiveWords(version: MoodVersionSummary, t: Translate, locale: Locale): string {
  const at = (date: string) => `${date}T12:00:00+07:00`;
  if (version.state === "WITHDRAWN" && version.effectiveTo === null) return t("ven18.never");
  if (version.effectiveTo !== null) return R1_FORMAT.formatPeriod(at(version.effectiveFrom), at(version.effectiveTo), locale) ?? "";
  return t("ven18.from", { d: day(at(version.effectiveFrom), locale) });
}

function Version({ data, staff, attempt, t, locale }: { data: MoodVersionView; staff: Staff; attempt: MoodAttempt | null; t: Translate; locale: Locale }) {
  const version = data.version;
  const state = version.state;
  const moderator = holds(staff, "ACT-MOD");
  const operations = holds(staff, "ACT-OPS");
  const live = data.tracks.filter((track) => track.droppedAt === null);
  const allDropped = data.tracks.length > 0 && live.length === 0;
  const actCode = attempt !== null && ACT_REFUSALS.includes(attempt.code) ? attempt.code : null;
  const stamp = (iso: string) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
  const approveWhy = !operations ? t("ven18.approverOnly") : state !== "DRAFT" ? sentence("VERSION_NOT_DRAFT", t) : data.preparedByReader ? t("ven18.selfPrepared") : null;
  const withdrawWhy =
    state === "SUPERSEDED" || state === "WITHDRAWN"
      ? sentence("VERSION_NOT_WITHDRAWABLE", t)
      : state === "DRAFT"
        ? moderator
          ? null
          : t("ven18.draftByMod")
        : operations
          ? null
          : t("ven18.approvedByOps");
  const nextWhy = !moderator ? t("ven18.prepByMod") : data.mood.retiredAt !== null ? refusal("MOOD_RETIRED", t).title : null;
  const prepare = attempt?.form === "prepare" ? attempt : null;
  const withdrawing = attempt?.form === "withdraw" && attempt.code === "FIELD_MISSING" ? attempt : null;

  return (
    <Columns>
      <Panel gap="xl" density="console" locale={locale}>
        <FactList
          items={[
            { label: t("ven18.fOwner"), value: t("venops.ownerSO") },
            { label: t("ven18.fPrepared"), value: t("ven18.byAt", { name: version.preparedBy, ts: stamp(version.preparedAt) }) },
            {
              label: t("ven18.fApproved"),
              value: version.approvedBy !== null && version.approvedAt !== null ? t("ven18.byAt", { name: version.approvedBy, ts: stamp(version.approvedAt) }) : t("ven18.notYet"),
            },
            { label: t("ven18.fFrom"), value: version.effectiveFrom, kind: "date" },
            { label: t("ven18.fTo"), value: version.effectiveTo !== null ? day(`${version.effectiveTo}T12:00:00+07:00`, locale) : t("ven18.open") },
            ...(state === "WITHDRAWN" && version.withdrawnReason !== null ? [{ label: t("ven18.fWithdrawn"), value: version.withdrawnReason[locale] }] : []),
          ]}
          columns={2}
          density="console"
          locale={locale}
        />
        <Divider />
        <Panel variant="plain" level={2} title={t("ven18.tracksTitle")} gap="sm" density="console" locale={locale}>
          {allDropped ? (
            <EmptyState variant="governed" title={t("ven18.emptyTitle")} level={3} action={false} density="console" locale={locale}>
              {t("ven18.emptyText")}
            </EmptyState>
          ) : null}
          <Table
            columns={[
              { key: "pos", label: t("ven18.cPos"), num: true, align: "end" },
              { key: "track", label: t("ven18.cTrack"), kind: "stack" },
              { key: "admitted", label: t("ven18.cAdmitted"), kind: "date", short: true, nowrap: true },
              { key: "st", label: t("ven18.cState"), kind: "status" },
            ]}
            rows={data.tracks.map((track) => ({
              _key: track.id,
              ...(track.droppedAt !== null ? { _tone: "muted" } : {}),
              pos: String(track.position),
              track: { text: track.title, detail: track.by },
              admitted: track.admittedAt,
              st:
                track.droppedAt !== null
                  ? { family: "neutral", label: t("ven18.dropped", { d: day(track.droppedAt, locale) }), detail: t("ven18.dropReason") }
                  : track.eligible
                    ? { family: "neutral", label: t("ven18.eligible"), plain: true }
                    : { family: "attention", label: t("ven18.notEligible") },
            }))}
            density="console"
            caption={t("ven18.tracksTitle")}
            rowFocus
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("ven18.dropNote")}
          </Text>
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("ven18.versionsTitle")} gap="sm" density="console" locale={locale}>
          <Table
            columns={[
              { key: "v", label: t("ven18.cV"), num: true },
              { key: "s", label: t("ven18.cVs"), kind: "status" },
              { key: "w", label: t("ven18.cVw") },
            ]}
            rows={data.versions.map((other) => ({
              _key: other.id,
              _href: routes.opsMoodVersion(other.id),
              ...(other.id === version.id ? { _selected: true } : {}),
              v: String(other.no),
              s: moodState(other.state, t),
              w: effectiveWords(other, t, locale),
            }))}
            density="console"
            caption={t("ven18.versionsTitle")}
            locale={locale}
          />
        </Panel>
        <Divider />
        <section aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {actCode !== null ? (
            <Banner family={ATTENTION.includes(actCode) ? "attention" : "neutral"} title={refusal(actCode, t).title} code={actCode} level={2} density="console" locale={locale}>
              {refusal(actCode, t).text}
            </Banner>
          ) : null}
          {/* What approving changes is said beside Approve whoever reads it, the disabled reason beside it as well. */}
          {state === "DRAFT" && data.ends !== null ? (
            <Text size="sm" tone="secondary">
              {t("ven18.approveNote", { m: data.ends.no, d: day(`${data.ends.on}T12:00:00+07:00`, locale) })}
            </Text>
          ) : null}
        </section>
        <VersionActions
          approve={{ label: t("ven18.approve", { n: version.no }), reason: approveWhy, action: approveMoodVersion.bind(null, version.id) }}
          withdraw={{ label: t("ven18.withdraw"), reason: withdrawWhy, action: withdrawMoodVersion.bind(null, version.id) }}
          back={{ label: t("ven18.back"), href: routes.opsMoods() }}
          dialog={{
            title: t("ven18.dlgTitle", { n: version.no, mood: data.mood.name }),
            text: data.clears !== null ? `${t("ven18.dlgText")} ${t("ven18.dlgClears", { m: data.clears.no })}` : t("ven18.dlgText"),
            reason: t("ven18.reason"),
            yes: t("ven18.dlgYes", { n: version.no }),
            no: t("ven18.dlgNo"),
            open: withdrawing !== null,
            reasonError: withdrawing !== null ? sentence("FIELD_MISSING", t) : null,
            initialReason: withdrawing?.values.reason ?? "",
          }}
          locale={locale}
        />
      </Panel>
      <Panel as="aside" title={t("ven18.nextTitle")} level={2} gap="lg" density="console" locale={locale}>
        {nextWhy === null ? (
          <>
            {prepare?.code === "TRACK_NOT_ELIGIBLE" ? (
              <Banner family="attention" title={refusal(prepare.code, t).title} code={prepare.code} level={3} density="console" locale={locale}>
                {refusal(prepare.code, t).text}
              </Banner>
            ) : null}
            <MoodForm
              mode="prepare"
              copy={{
                name: t("ven17.name"),
                owner: t("ven17.owner"),
                ownerSO: t("venops.ownerSO"),
                from: t("ven18.nextFrom"),
                tracks: t("ven18.nextTracks"),
                picked: t("venops.picked"),
                pickedOne: t("venops.pickedOne"),
                addTracks: t("venops.addTracks"),
                search: t("venops.trackSearch"),
                searchHelp: t("venops.trackSearchHelp"),
                noResults: t("venops.trackNoResults"),
                add: t("venops.trackAdd"),
                submit: t("ven18.next"),
                fillFirst: t("ven18.nextFillFirst"),
              }}
              initial={prepare?.values ?? { name: "", effectiveFrom: "", tracks: data.tracks.map((track) => ({ id: track.id, title: track.title, by: track.by })) }}
              errors={
                prepare?.code === "FIELD_MISSING"
                  ? prepare.field === "tracks"
                    ? { tracks: sentence(prepare.code, t) }
                    : { effectiveFrom: sentence(prepare.code, t) }
                  : {}
              }
              refusal={prepare?.code === "TRACK_NOT_ELIGIBLE" && prepare.track !== null ? { track: prepare.track, sentence: sentence(prepare.code, t) } : null}
              action={prepareMoodVersion.bind(null, data.mood.id, version.id)}
              locale={locale}
            />
          </>
        ) : (
          <Button variant="secondary" size="sm" fullWidth disabled disabledReason={nextWhy} locale={locale}>
            {t("ven18.next")}
          </Button>
        )}
      </Panel>
    </Columns>
  );
}
