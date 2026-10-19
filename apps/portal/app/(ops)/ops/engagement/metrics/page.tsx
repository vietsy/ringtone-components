import { R1_FORMAT } from "@rightone/formatting";
import { Button, ButtonRow, DateField, FactList, FilterBar, PageHeader, Panel, Select, Skeleton, Table, TextField, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { defineMetricAct, prepareSnapshotAct, publishSnapshotAct } from "@/features/engagement/actions";
import { actorName, count, engTranslator, fieldParts, moment, readInstant, refusalWords, signed, snapshotStatus } from "@/features/engagement/copy";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { RowActs } from "@/features/engagement/RowActs";
import { readForPage } from "@/lib/api/flash";
import { loadMetrics, type EngagementAttempt, type MetricCode, type MetricSnapshot, type MetricsView } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const METRICS: readonly MetricCode[] = ["POINTS_AWARDED", "PARTICIPANTS_ENROLLED"];
const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);
const period = (snapshot: MetricSnapshot, locale: Locale) => R1_FORMAT.formatPeriod(snapshot.period.from, snapshot.period.to, locale, true) ?? "";

/**
 * SCR-ENG-11 Engagement metrics. No board or Figma frame draws it: it is built from ENG's specification and wireframe
 * on the console pattern. Every snapshot shows its figure beside the ledger's and the variance, zero written as 0; a
 * refused publication stays on the table as a refused row. The Reporting owner (`ACT-REP`) approves the two metric
 * definitions (`POST /metric-definitions`, which FR-ENG-020 places on this screen), prepares a snapshot for a closed
 * month and publishes it; the auditor reads, and each act is disabled for them with the owner named.
 */
export default async function MetricsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const metric = text(params.metric);
  const outcome = view === "loading" ? null : await loadMetrics(staff, metric, text(params.snapshot), view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept !== null && kept.page.startsWith("eng11-") ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("engHome.title"), href: routes.opsEngagement() }]} title={t("eng11.title")} meta={t("eng11.meta")} locale={locale} />
        {attempt?.done === "published" || attempt?.done === "defined" ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family="positive" title={t(`eng11.done.${attempt.done}`)} locale={locale}>
              {t(`eng11.doneText.${attempt.done}`)}
            </Toast>
          </div>
        ) : null}
        {attempt?.refusal && !(attempt.page === "eng11-define" && attempt.refusal.code === "FIELD_MISSING") ? (
          <RefusalBanner refusal={attempt.refusal} family={attempt.refusal.code === "METRIC_RECONCILIATION_VARIANCE" ? "danger" : "attention"} t={t} locale={locale} density="console" />
        ) : null}
        <form action={routes.opsEngagementMetrics()}>
          <FilterBar label={t("eng11.filter")} locale={locale}>
            <Select
              label={t("eng11.metric")}
              name="metric"
              options={[{ value: "", label: t("eng11.allMetrics") }, ...METRICS.map((code) => ({ value: code, label: t(`eng.metric.${code}`) }))]}
              value={data?.filter ?? metric ?? ""}
              density="console"
              width="var(--container-xs)"
              locale={locale}
            />
            <Button type="submit" variant="secondary" size="sm" locale={locale}>
              {t("eng11.show")}
            </Button>
          </FilterBar>
        </form>
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="table" rows={3} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng11.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {data !== null ? <Metrics data={data} define={text(params.define)} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Metrics({ data, define, attempt, t, locale }: { data: MetricsView; define: string | null; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const notOwner = data.owner ? undefined : refusalWords("METRIC_DEFINITION_NOT_OWNER", t).title;
  const selected = data.selected;
  return (
    <>
      <Panel title={t("eng11.snapshotsTitle")} level={2} compact density="console" locale={locale}>
        <RowActs
          columns={[
            { key: "metric", label: t("eng11.cMetric"), kind: "strong" },
            { key: "period", label: t("eng11.cPeriod") },
            { key: "figure", label: t("eng11.cFigure"), kind: "count", align: "end" },
            { key: "ledger", label: t("eng11.cLedger"), kind: "count", align: "end" },
            { key: "variance", label: t("eng11.cVariance"), align: "end" },
            { key: "state", label: t("eng11.cState"), kind: "status" },
            { key: "act", label: t("eng11.cAct"), kind: "actions" },
          ]}
          rows={data.snapshots.map((snapshot) => ({
            key: snapshot.id,
            cells: {
              _href: routes.opsEngagementMetrics({ metric: data.filter, snapshot: snapshot.id }),
              ...(snapshot.id === selected?.id ? { _selected: true } : {}),
              metric: t(`eng.metric.${snapshot.metric}`),
              period: period(snapshot, locale),
              figure: snapshot.figure,
              ledger: snapshot.ledgerFigure,
              variance: signed(snapshot.variance, locale),
              state: snapshotStatus(snapshot.state, t),
            },
            act:
              snapshot.state === "PREPARED"
                ? { label: t("eng11.publish"), ariaLabel: t("eng11.publishAria", { metric: t(`eng.metric.${snapshot.metric}`), period: period(snapshot, locale) }), icon: "check", variant: "secondary", ...(notOwner !== undefined ? { disabledReason: notOwner } : {}) }
                : null,
          }))}
          action={publishSnapshotAct}
          caption={t("eng11.snapshotsTitle")}
          empty={{ variant: "governed", title: t("eng11.empty"), action: false }}
          footer={t("eng.showing", { shown: count(data.snapshots.length, locale), total: count(data.snapshots.length, locale) })}
          locale={locale}
        />
      </Panel>
      {selected !== null ? <Opened snapshot={selected} t={t} locale={locale} /> : null}
      <Prepare data={data} notOwner={notOwner} attempt={attempt} t={t} locale={locale} />
      <Definitions data={data} define={define} notOwner={notOwner} attempt={attempt} t={t} locale={locale} />
    </>
  );
}

/** One snapshot opened: both figures and the variance, the definition version and the cut-off they were computed at. */
function Opened({ snapshot, t, locale }: { snapshot: MetricSnapshot; t: Translate; locale: Locale }) {
  return (
    <Panel
      title={t(snapshot.state === "REFUSED" ? "eng11.refusedTitle" : "eng11.openedTitle", { metric: t(`eng.metric.${snapshot.metric}`), period: period(snapshot, locale) })}
      level={2}
      status={snapshotStatus(snapshot.state, t)}
      {...(snapshot.state === "REFUSED" ? { family: "danger" as const } : {})}
      density="console"
      locale={locale}
    >
      {snapshot.state === "REFUSED" ? (
        <Text>{t("eng11.refusedText", { figure: count(snapshot.figure, locale), ledger: count(snapshot.ledgerFigure, locale), ts: moment(snapshot.cutOff, locale), n: snapshot.definitionNo })}</Text>
      ) : null}
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          { label: t("eng11.fDefinition"), value: t("eng11.definitionValue", { n: snapshot.definitionNo }) },
          { label: t("eng11.fCutOff"), value: snapshot.cutOff, kind: "datetime" },
          { label: t("eng11.cFigure"), value: snapshot.figure, kind: "count" },
          { label: t("eng11.cLedger"), value: snapshot.ledgerFigure, kind: "count" },
          { label: t("eng11.cVariance"), value: signed(snapshot.variance, locale) },
          { label: t("eng11.fOutcome"), value: t(`eng11.outcome.${snapshot.outcome}`) },
          ...(snapshot.publishedBy !== null ? [{ label: t("eng11.fPublished"), value: actorName(snapshot.publishedBy, t) }] : []),
        ]}
      />
    </Panel>
  );
}

/** Prepare a snapshot for a closed month; an open one is refused with the instant it closes. */
function Prepare({ data, notOwner, attempt, t, locale }: { data: MetricsView; notOwner: string | undefined; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const typed = attempt?.page === "eng11-prepare" ? attempt.form : null;
  return (
    <Panel title={t("eng11.prepareTitle")} level={2} density="console" locale={locale}>
      <form action={prepareSnapshotAct} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-4)" }}>
        <Select
          label={t("eng11.metric")}
          name="metric"
          options={METRICS.map((code) => ({ value: code, label: t(`eng.metric.${code}`) }))}
          value={typed?.metric ?? data.filter ?? "POINTS_AWARDED"}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <Select
          label={t("eng11.month")}
          helper={t("eng11.monthHelp")}
          name="month"
          options={data.months.map((month) => ({ value: month.value, label: R1_FORMAT.formatPeriod(month.from, month.to, locale) ?? month.value }))}
          value={typed?.month ?? data.months[1]?.value ?? ""}
          density="console"
          width="var(--container-xs)"
          locale={locale}
        />
        <Button type="submit" variant="primary" size="sm" {...(notOwner !== undefined ? { disabled: true, disabledReason: notOwner } : {})} locale={locale}>
          {t("eng11.prepare")}
        </Button>
      </form>
    </Panel>
  );
}

/** The two definitions `CFG-63` approves and their versions; a version approved by the owner is metric ownership's evidence. */
function Definitions({
  data,
  define,
  notOwner,
  attempt,
  t,
  locale,
}: {
  data: MetricsView;
  define: string | null;
  notOwner: string | undefined;
  attempt: EngagementAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const latest = (code: MetricCode) => data.definitions.find((definition) => definition.code === code) ?? null;
  const defining = METRICS.find((code) => code === define) ?? null;
  const current = defining !== null ? latest(defining) : null;
  const typed = attempt?.page === "eng11-define" ? attempt.form : null;
  const field = attempt?.page === "eng11-define" && attempt.refusal?.code === "FIELD_MISSING" ? String(attempt.refusal.values.field ?? "") : null;
  const at = fieldParts(readInstant(typed?.effective_from ?? ""));
  return (
    <Panel title={t("eng11.definitionsTitle")} level={2} compact density="console" locale={locale}>
      <Table
        columns={[
          { key: "metric", label: t("eng11.cMetric"), kind: "strong", minWidth: "var(--space-48)" },
          { key: "no", label: t("eng11.cVersion"), kind: "count" },
          { key: "statement", label: t("eng11.cStatement"), truncate: true, maxWidth: "var(--container-xs)" },
          { key: "owner", label: t("eng11.cOwner"), kind: "mono" },
          { key: "from", label: t("eng11.cFrom"), kind: "datetime" },
          { key: "approved", label: t("eng11.cApproved") },
          // Approving a version is the owner's; anyone else reads the definitions, the reason said once below.
          ...(notOwner === undefined ? [{ key: "act", label: t("eng11.cAct"), kind: "actions" as const }] : []),
        ]}
        rows={data.definitions.map((definition) => ({
          _key: `${definition.code}-${definition.no}`,
          metric: t(`eng.metric.${definition.code}`),
          no: definition.no,
          statement: definition.statement,
          owner: definition.ownerRole,
          from: definition.effectiveFrom,
          approved: definition.approvedBy !== null ? actorName(definition.approvedBy, t) : t("eng11.notApproved"),
          act:
            latest(definition.code)?.no === definition.no
              ? [
                  {
                    label: t("eng11.define"),
                    ariaLabel: t("eng11.defineAria", { metric: t(`eng.metric.${definition.code}`) }),
                    variant: "quiet" as const,
                    href: routes.opsEngagementMetrics({ metric: data.filter, define: definition.code }),
                  },
                ]
              : [],
        }))}
        density="console"
        caption={t("eng11.definitionsTitle")}
        locale={locale}
      />
      {notOwner !== undefined ? (
        <Text size="sm" tone="secondary">
          {notOwner} {t("eng.named.owner", { role: data.definitions[0]?.ownerRole ?? "" })}
        </Text>
      ) : null}
      {defining !== null && current !== null && notOwner === undefined ? (
        <form action={defineMetricAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <input type="hidden" name="metric" value={defining} />
          <Text size="sm" weight="semibold">
            {t("eng11.defineTitle", { metric: t(`eng.metric.${defining}`), n: current.no + 1 })}
          </Text>
          <TextField
            label={t("eng11.statement")}
            helper={t("eng11.statementHelp")}
            name="statement"
            value={typed?.statement ?? current.statement}
            multiline
            rows={2}
            maxLength={500}
            required
            {...(field === "statement" ? { error: t("eng11.statementMissing") } : {})}
            density="console"
            locale={locale}
          />
          <DateField
            label={t("eng11.effective")}
            helper={t("eng11.effectiveHelp")}
            name="effective_from"
            {...(at.date !== "" ? { value: at.date, time: at.time } : {})}
            withTime
            required
            {...(field === "effective_from" ? { error: t("eng11.effectiveMissing") } : {})}
            density="console"
            width="var(--container-xs)"
            locale={locale}
          />
          <ButtonRow>
            <Button type="submit" variant="primary" size="sm" locale={locale}>
              {t("eng11.approveDefinition")}
            </Button>
            <Button variant="quiet" size="sm" href={routes.opsEngagementMetrics({ metric: data.filter })} locale={locale}>
              {t("eng11.cancel")}
            </Button>
          </ButtonRow>
        </form>
      ) : null}
    </Panel>
  );
}
