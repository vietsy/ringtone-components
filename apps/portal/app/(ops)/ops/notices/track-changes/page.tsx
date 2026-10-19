import { Banner, ButtonRow, DateField, Panel, Select, Table, TextField, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { ActButton } from "@/features/notices/ActButton";
import { recordTrackChangeAct } from "@/features/notices/console-actions";
import { askedDay, tabRoles, runStateValue } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadTrackChangeRuns, type ConsoleAttempt, type TrackChangeRuns } from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;
type RecordAttempt = Extract<ConsoleAttempt, { page: "track-change" }>;

const KINDS = ["revoked", "expired", "taken_down"] as const;

/**
 * SCR-COM-13 Track change runs: each recorded change to a track, with the two counts that matter side by side - how
 * many premises held it at the change instant and how many have been told. A run opens with every premises it
 * resolved. The specification enters the screen from a notice of the run; the console lists the runs as well, so an
 * officer can reach one that never issued a notice to open it from.
 *
 * A run is raised by CAT recording a revocation, an expiry or a takedown (POST /track-change-notifications). The
 * portal has no catalogue screen where that is recorded, so the page takes the change CAT reported from an operations
 * officer and passes it through the same contract; the run resolves its premises from VEN at that instant.
 */
export default async function TrackChangeRunsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("runs"));
  const params = await searchParams;
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const kept = readForPage<ConsoleAttempt>(params);
  const attempt = kept?.page === "track-change" ? kept : null;
  const outcome = view === "loading" ? null : await loadTrackChangeRuns(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <NoticeFrame staff={staff} tab="runs" keys={failure === null && (data === null || data.runs.length > 0)} header={{ title: t("com13.title"), meta: t("com13.meta") }} t={t} locale={locale}>
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com13.listErrTitle")} t={t} locale={locale} /> : <Runs data={data} t={t} locale={locale} />}
      {failure === null ? <RecordChange attempt={attempt} t={t} locale={locale} /> : null}
    </NoticeFrame>
  );
}

function Runs({ data, t, locale }: { data: TrackChangeRuns | null; t: Translate; locale: Locale }) {
  if (data !== null && data.runs.length === 0) {
    return <ViewState view="empty" empty={{ variant: "governed", title: t("com13.emptyTitle"), text: t("com13.emptyText"), action: false }} level={2} density="console" locale={locale} />;
  }
  return (
    <Panel compact density="console" locale={locale}>
      <Table
        columns={[
          { key: "run", label: t("com13.cRun"), kind: "id" },
          { key: "track", label: t("com13.cTrack"), kind: "stack" },
          { key: "change", label: t("com13.cChange") },
          { key: "recorded", label: t("com13.cRecorded"), kind: "datetime", nowrap: true },
          { key: "resolved", label: t("com13.cResolved"), kind: "count" },
          { key: "issued", label: t("com13.cIssued"), kind: "count" },
          { key: "st", label: t("com13.cState"), kind: "status" },
        ]}
        rows={(data?.runs ?? []).map((run) => ({
          _key: run.ref,
          _href: routes.opsTrackChange(run.ref),
          run: run.ref,
          track: { text: t("com13.trackValue", { title: run.title, by: run.by }), detail: run.trackRef, detailSize: "sm" },
          change: t(`com.change.${run.changeKind}`),
          recorded: run.changeRecordedAt,
          resolved: run.resolvedCount,
          issued: run.issuedCount,
          st: runStateValue(run.state, t),
        }))}
        loading={data === null ? 3 : false}
        density="console"
        rowFocus
        caption={t("com13.title")}
        locale={locale}
      />
    </Panel>
  );
}

/** The change CAT reported: the track, revoked, expired or taken down, and from when; the run opens once recorded. */
function RecordChange({ attempt, t, locale }: { attempt: RecordAttempt | null; t: Translate; locale: Locale }) {
  const refusal = attempt?.refusal ?? null;
  const when = attempt !== null ? askedDay(attempt.typed.when) : null;
  return (
    <Panel title={t("com13.recordTitle")} level={2} gap="lg" density="console" locale={locale}>
      <Text size="sm" tone="secondary">
        {t("com13.recordText")}
      </Text>
      {refusal !== null && refusal.code !== "FIELD_MISSING" ? (
        <Banner family="attention" title={t(`com.refusal.${refusal.code}.title`)} code={refusal.code} live density="console" locale={locale}>
          {t(`com.refusal.${refusal.code}.text`)}
        </Banner>
      ) : null}
      <form action={recordTrackChangeAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: "var(--container-2xl)" }}>
        <TextField
          label={t("com13.fTrackRef")}
          helper={t("com13.trackHelp")}
          name="track"
          value={attempt?.typed.track ?? ""}
          maxLength={60}
          required
          {...(refusal?.field === "track" ? { error: t("com13.trackMissing") } : {})}
          density="console"
          locale={locale}
        />
        <Select
          label={t("com13.fKind")}
          name="kind"
          options={[{ value: "", label: t("com13.chooseKind") }, ...KINDS.map((kind) => ({ value: kind, label: t(`com.change.${kind}`) }))]}
          value={attempt?.typed.kind ?? ""}
          required
          {...(refusal?.field === "kind" ? { error: t("com13.kindMissing") } : {})}
          density="console"
          width="var(--space-64)"
          locale={locale}
        />
        <DateField label={t("com13.fWhen")} helper={t("com13.whenHelp")} name="when" {...(when !== null ? { value: when } : {})} density="console" locale={locale} />
        <ButtonRow>
          <ActButton variant="primary" size="sm" icon="file-plus" locale={locale}>
            {t("com13.record")}
          </ActButton>
        </ButtonRow>
      </form>
    </Panel>
  );
}
