import { Button, ButtonRow, Checkbox, DateField, Divider, EmptyState, FreshnessLine, PageHeader, Panel, Skeleton, StatStrip, Table, Tabs } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { count, duration, refusal, regOpsTranslator } from "@/features/registration/console-copy";
import { reportingTabs } from "@/features/registration/reporting";
import { readDate } from "@/features/registration/fields";
import { loadRegistrationReports, type OverBaselineRow, type RegistrationReports } from "@/lib/api/registration-review";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG16_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-REG-16 Registration reports, the reports workspace's landing. For a period - the current calendar month
 * until another is chosen - how long ordinary registrations took against the ten-minute baseline, each one over
 * it with the step where the time went, and the applications decided, refused, withdrawn or closed, in separate
 * columns so a withdrawal never hides a refusal. While nothing is measured the figures say so, never zero.
 */
export default async function RegistrationReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-REP", "ACT-OPS", "ACT-AUD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG16_VIEWS);
  // The period as the form sends it (R1's date field, day first) or as a link carries it (ISO).
  const typedFrom = text(query["period-from"]) ?? text(query.from);
  const typedTo = text(query["period-to"]) ?? text(query.to);
  const from = typedFrom !== null ? (readDate(typedFrom) ?? typedFrom) : null;
  const to = typedTo !== null ? (readDate(typedTo) ?? typedTo) : null;
  const onlyOver = query.submitted === undefined || query.only_exceeded !== undefined;
  const outcome = asked === "loading" ? null : await loadRegistrationReports(staff, from, to, reviewViewOf("16", asked));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const officer = holds(staff, "ACT-OPS");
  const periodRefused = failure?.code === "REPORT_PERIOD_INVALID";
  // J, K and Enter move through the rows only while a table of the page holds some.
  const rowKeys = officer && data !== null && listedRows(data, onlyOver) > 0;

  return (
    <OpsFrame
      console="operations"
      current="reports"
      staff={staff}
      searchLabel={t("regops.searchReports")}
      {...(rowKeys ? { keyMap: [{ keys: ["J", "K"], label: t("reg16.kRows") }, { keys: ["Enter"], label: t("reg16.kOpen") }] } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("regops.reportsArea") }]} title={t("reg16.title")} locale={locale} />
        <Tabs tabs={reportingTabs(staff, t)} value="reports" label={t("regrep.tabs")} density="console" locale={locale} />
        {data !== null ? <FreshnessLine period={data.period} asOf={data.asOf} locale={locale} /> : null}
        {failure !== null && !periodRefused && failure.code === "NOT_AUTHORISED" ? (
          <ConsoleFailure failure={failure} screen="reg16" t={t} locale={locale} />
        ) : (
          <Panel as="div" locale={locale}>
            <form action={routes.opsRegistrationReports()} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <input type="hidden" name="submitted" value="1" />
              <DateField
                label={t("reg16.period")}
                name="period"
                range
                value={data?.period.from ?? typedFrom ?? ""}
                to={data?.period.to ?? typedTo ?? ""}
                fromLabel={t("reg16.from")}
                toLabel={t("reg16.to")}
                helper={t("reg16.periodHelp")}
                required
                {...(periodRefused ? { error: refusal(t, "REPORT_PERIOD_INVALID").text } : {})}
                density="console"
                locale={locale}
              />
              <Checkbox label={t("reg16.onlyOver")} name="only_exceeded" checked={onlyOver} density="console" locale={locale} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <Button type="submit" variant="primary" size="sm" locale={locale}>
                  {t("reg16.show")}
                </Button>
              </div>
            </form>
          </Panel>
        )}
        {asked === "loading" ? <Loading t={t} locale={locale} /> : null}
        {failure !== null && !periodRefused && failure.code !== "NOT_AUTHORISED" ? <ConsoleFailure failure={failure} screen="reg16" t={t} locale={locale} /> : null}
        {data !== null ? <Reports data={data} staff={staff} onlyOver={onlyOver} t={t} locale={locale} /> : null}
        <ButtonRow>
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("regops.close")}
          </Button>
        </ButtonRow>
      </div>
    </OpsFrame>
  );
}

function Loading({ t, locale }: { t: Translate; locale: Locale }) {
  return (
    <>
      <Panel title={t("reg16.compTitle")} level={2} density="console" locale={locale}>
        <Skeleton variant="card" rows={4} density="console" />
        <Skeleton variant="table" rows={2} columns={5} density="console" />
      </Panel>
      <Panel title={t("reg16.outTitle")} level={2} density="console" locale={locale}>
        <Skeleton variant="table" rows={1} columns={5} density="console" />
      </Panel>
    </>
  );
}

/** The registrations over the baseline the page lists: those measured (all, or only those over) and the interim ones. */
function shownMeasured(data: RegistrationReports, onlyOver: boolean): readonly OverBaselineRow[] {
  const c = data.completion;
  return onlyOver ? c.rows.filter((row) => row.seconds > c.baselineSeconds) : c.rows;
}

function nothingMeasured(data: RegistrationReports): boolean {
  const c = data.completion;
  const o = data.outcomes;
  return c.measured === 0 && c.notYetMeasured === 0 && o.decided + o.refused + o.withdrawn + o.closed === 0;
}

function listedRows(data: RegistrationReports, onlyOver: boolean): number {
  return nothingMeasured(data) ? 0 : shownMeasured(data, onlyOver).length + (data.completion.interim?.rows.length ?? 0);
}

function Reports({ data, staff, onlyOver, t, locale }: { data: RegistrationReports; staff: Staff; onlyOver: boolean; t: Translate; locale: Locale }) {
  const c = data.completion;
  const o = data.outcomes;
  const officer = holds(staff, "ACT-OPS");
  if (nothingMeasured(data)) {
    return (
      <Panel as="div" density="console" locale={locale}>
        <EmptyState variant="governed" title={t("reg16.emptyTitle")} level={2} density="console" locale={locale} />
      </Panel>
    );
  }
  const baseline = String(c.baselineSeconds);
  const unavailable = t("reg16.unavailable");
  const measuredRows = shownMeasured(data, onlyOver);
  return (
    <>
      <Panel title={t("reg16.compTitle")} description={t("reg16.baseline", { n: baseline })} level={2} density="console" locale={locale}>
        <StatStrip
          items={[
            { value: c.measured, label: t("reg16.measured") },
            { value: c.medianSeconds !== null ? duration(c.medianSeconds, t) : null, label: t("reg16.median"), missing: unavailable },
            { value: c.p90Seconds !== null ? duration(c.p90Seconds, t) : null, label: t("reg16.p90"), missing: unavailable },
            c.over !== null
              ? { value: c.over, label: t("reg16.over"), note: t("reg16.overNote", { n: baseline }), family: "attention", emphasis: true }
              : { value: null, label: t("reg16.over"), missing: unavailable },
            { value: c.notYetMeasured, label: t("reg16.notYet"), note: t("reg16.notYetNote"), ...(c.measured === 0 ? { emphasis: true } : {}) },
          ]}
          locale={locale}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <Text size="sm" tone="secondary">
            {t("reg16.excluded")}
          </Text>
          {c.declaredFallback > 0 ? (
            <Text size="sm" tone="secondary">
              {t("reg16.fallback", { n: count(c.declaredFallback, locale) })}
            </Text>
          ) : null}
        </div>
        <Table
          columns={overColumns(t, officer, "cTime", true)}
          rows={measuredRows.map((row) => overRow(row, officer, t))}
          density="console"
          caption={t("reg16.overCaption")}
          {...(measuredRows.length > 0 ? { sort: { key: "time", dir: "desc" as const }, sortNote: t("reg16.sortNote") } : {})}
          rowFocus={officer && measuredRows.length > 0}
          empty={{ variant: "governed", title: t("reg16.notMeasuredTitle"), text: t("reg16.notMeasuredText"), action: false }}
          locale={locale}
        />
        {c.interim !== null ? (
          <>
            <Divider />
            <Panel variant="plain" title={t("reg16.interimTitle")} description={t("reg16.interimDesc")} level={3} compact locale={locale}>
              <StatStrip
                items={[
                  { value: c.interim.decided, label: t("reg16.decided") },
                  { value: duration(c.interim.medianSeconds, t), label: t("reg16.median") },
                  { value: duration(c.interim.p90Seconds, t), label: t("reg16.p90") },
                  { value: c.interim.over, label: t("reg16.over"), note: t("reg16.overNote", { n: baseline }), family: "attention", emphasis: true },
                ]}
                locale={locale}
              />
              <Table
                columns={overColumns(t, officer, "toDecision", false)}
                rows={c.interim.rows.map((row) => overRow(row, officer, t))}
                density="console"
                caption={t("reg16.interimCaption")}
                sort={{ key: "time", dir: "desc" }}
                sortNote={t("reg16.interimSortNote")}
                rowFocus={officer}
                locale={locale}
              />
            </Panel>
          </>
        ) : null}
      </Panel>
      <Panel title={t("reg16.outTitle")} level={2} density="console" locale={locale}>
        <Table
          columns={[
            { key: "period", label: t("reg16.oPeriod"), kind: "period" },
            { key: "decided", label: t("reg16.oDecided"), kind: "count" },
            { key: "refused", label: t("reg16.oRefused"), kind: "count" },
            { key: "withdrawn", label: t("reg16.oWithdrawn"), kind: "count" },
            { key: "closed", label: t("reg16.oClosed"), kind: "count" },
          ]}
          rows={[{ _key: "period", period: { from: data.period.from, to: data.period.to }, decided: o.decided, refused: o.refused, withdrawn: o.withdrawn, closed: o.closed }]}
          density="console"
          caption={t("reg16.outTitle")}
          rowHeaders
          {...(o.withdrawnWithAdverse > 0 ? { footer: t("reg16.outNote", { w: count(o.withdrawn, locale), a: count(o.withdrawnWithAdverse, locale) }) } : {})}
          locale={locale}
        />
        {/* RPT-REG-03: each withdrawal that closed an adverse proposal is named, so no refusal hides behind it. */}
        {o.withdrawnWithAdverseRefs.length > 0 ? (
          <Text size="sm" tone="secondary">
            {t("reg16.outRefs", { refs: o.withdrawnWithAdverseRefs.join(", ") })}
          </Text>
        ) : null}
      </Panel>
    </>
  );
}

function overColumns(t: Translate, officer: boolean, time: "cTime" | "toDecision", withExcluded: boolean) {
  return [
    { key: "ref", label: t("reg16.cRef"), kind: "id" as const },
    { key: "premises", label: t("reg16.cPremises"), minWidth: "var(--space-48)" },
    { key: "time", label: t(`reg16.${time}`), align: "end" as const, num: true, nowrap: true },
    ...(withExcluded ? [{ key: "excl", label: t("reg16.cExcl"), align: "end" as const, num: true, nowrap: true }] : []),
    { key: "step", label: t("reg16.cStep") },
    ...(officer ? [{ key: "open", label: t("reg16.cOpen"), kind: "link" as const }] : []),
  ];
}

/** A registration over the baseline: its case file opens for an officer where this world holds the application. */
function overRow(row: OverBaselineRow, officer: boolean, t: Translate): Record<string, unknown> {
  const opens = officer && row.caseFile;
  return {
    _key: row.reference,
    ...(opens ? { _href: routes.opsApplication(row.reference) } : {}),
    ref: row.reference,
    premises: row.premises,
    time: duration(row.seconds, t),
    excl: row.excludedSeconds !== null ? duration(row.excludedSeconds, t) : null,
    step: t(`reg16.step.${row.step}`),
    ...(officer ? { open: opens ? { label: t("reg16.open"), href: routes.opsApplication(row.reference) } : null } : {}),
  };
}
