import { Banner, Button, DateField, EmptyState, PageHeader, Panel, Select, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { askedDay, day, percent, period, svcTranslator } from "@/features/continuity/console";
import { loadAvailability, type Availability, type AvailabilityPeriod, type AvailabilityQuery, type ProcessKey } from "@/lib/api/continuity";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { SVC_VIEWS } from "@/lib/mock/continuity";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const PROCESSES: readonly ProcessKey[] = ["certificate-issue", "premises-register", "public-verification"];

/**
 * SCR-SVC-13 Availability by period, in service continuity on the security console. The operations and the security
 * officer read each critical process's closed monthly periods for a period they choose, which has no default: a
 * measurement or "not taken" (never 0), the objective it was judged against or none, and the verdict. No objective is
 * in force yet, so no period reads as met or missed. Nothing is read until a period is asked for.
 */
export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-SEC");
  const params = await searchParams;
  const locale = await getLocale();
  const t = svcTranslator(locale);
  const view = reviewView(params, SVC_VIEWS);
  // The form always sends its process, so a request without one is the page opened, not a period left out.
  const asked: AvailabilityQuery =
    params.process === undefined
      ? null
      : { processKey: typeof params.process === "string" ? params.process : null, from: askedDay(params["period-from"]), to: askedDay(params["period-to"]) };
  const outcome = view === "loading" ? null : await loadAvailability(staff, asked, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const periodMissing = failure?.code === "PERIOD_REQUIRED";
  const processUnknown = failure?.code === "PROCESS_NOT_FOUND";
  const outage = failure !== null && !periodMissing && !processUnknown ? failure : null;
  const processValue = typeof params.process === "string" ? params.process : "";

  return (
    <OpsFrame
      console="security"
      current="availability"
      staff={staff}
      searchLabel={t("svc.search")}
      keyMap={data !== null && data.periods.length > 0 ? [{ keys: ["J", "K"], label: t("svc13.kNext") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader crumbs={[{ label: t("svc.area") }, { label: t("svc.section") }]} title={t("svc13.title")} meta={t("svc13.metaNone")} locale={locale} />
        <form action={routes.securityAvailability()} noValidate>
          <Panel as="div" density="console" locale={locale}>
            <div style={{ display: "grid", gridTemplateColumns: "var(--space-72) minmax(0, 1fr)", gap: "var(--space-4)", alignItems: "start" }}>
              <Select
                label={t("svc13.process")}
                name="process"
                options={[{ value: "", label: t("svc13.allProcesses") }, ...PROCESSES.map((key) => ({ value: key, label: t(`svc.process.${key}`) }))]}
                value={processValue}
                density="console"
                locale={locale}
              />
              <DateField
                label={t("svc13.period")}
                name="period"
                range
                {...(asked !== null && asked.from !== null ? { value: asked.from } : {})}
                {...(asked !== null && asked.to !== null ? { to: asked.to } : {})}
                fromLabel={t("svc13.from")}
                toLabel={t("svc13.to")}
                helper={t("svc13.periodHelp")}
                required
                {...(periodMissing ? { error: t("svc13.periodField") } : {})}
                density="console"
                locale={locale}
              />
            </div>
            <div style={{ display: "flex" }}>
              <Button variant="primary" size="sm" type="submit" locale={locale}>
                {t("svc13.show")}
              </Button>
            </div>
          </Panel>
        </form>
        {periodMissing && (
          <Banner family="neutral" title={t("svc13.notShown")} code="PERIOD_REQUIRED" density="console" locale={locale}>
            {t("svc.refusal.PERIOD_REQUIRED")}
          </Banner>
        )}
        {processUnknown && (
          <Banner family="neutral" title={t("svc13.notShown")} code="PROCESS_NOT_FOUND" density="console" locale={locale}>
            {t("svc.refusal.PROCESS_NOT_FOUND")}
          </Banner>
        )}
        {outage !== null ? (
          <ViewState
            view="error"
            errorTitle={t("svc13.errorTitle")}
            errorText={t("svc.errorText")}
            {...(outage.traceId !== null ? { traceId: outage.traceId } : {})}
            retryable={outage.retryable}
            level={2}
            density="console"
            locale={locale}
          />
        ) : view === "loading" ? (
          <ViewState view="loading" skeleton="table" rows={6} columns={4} density="console" locale={locale} />
        ) : data !== null && data.periods.length === 0 ? (
          <EmptyState variant="governed" title={t(data.processKey === null ? "svc13.emptyAllTitle" : "svc13.emptyTitle")} level={2} action={false} density="console" locale={locale}>
            {data.lastMeasuredEnd === null
              ? t("svc13.emptyNever", { d: day(data.designatedOn, locale) })
              : t("svc13.emptySince", { d: day(data.lastMeasuredEnd, locale) })}
          </EmptyState>
        ) : data !== null ? (
          <Periods data={data} t={t} locale={locale} />
        ) : null}
        <div style={{ display: "flex" }}>
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("svc.close")}
          </Button>
        </div>
      </div>
    </OpsFrame>
  );
}

/** The periods, grouped under their process; a period not measured says so in words and never sorts with one met. */
function Periods({ data, t, locale }: { data: Availability; t: Translate; locale: Locale }) {
  const groups = PROCESSES.map((key) => ({ key, rows: data.periods.filter((row) => row.processKey === key) })).filter((group) => group.rows.length > 0);
  const rows = groups.flatMap((group) => [
    { _key: `g-${group.key}`, _group: t(`svc.process.${group.key}`), _groupCode: group.key, _groupCount: group.rows.length },
    ...group.rows.map((row) => periodRow(row, t, locale)),
  ]);
  const caption = t("svc13.caption", { p: period(data.period.from, data.period.to, locale) });
  return (
    <Table
      columns={[
        { key: "period", label: t("svc13.cPeriod"), nowrap: true },
        { key: "measured", label: t("svc13.cMeasured"), kind: "stack", align: "end" },
        { key: "objective", label: t("svc13.cObjective") },
        { key: "verdict", label: t("svc13.cVerdict"), kind: "status", width: "var(--space-80)" },
      ]}
      rows={rows}
      density="console"
      caption={caption}
      sortNote={t("svc13.sortNote")}
      rowFocus
      locale={locale}
    />
  );
}

function periodRow(row: AvailabilityPeriod, t: Translate, locale: Locale): Record<string, unknown> {
  const verdict =
    row.outcome === "MET"
      ? { family: "positive", label: t("svc13.verdict.MET") }
      : row.outcome === "NOT_MET"
        ? { family: "danger", label: t("svc13.verdict.NOT_MET") }
        : row.outcome === "NO_OBJECTIVE"
          ? { family: "attention", label: t("svc13.verdict.NO_OBJECTIVE"), detail: t("svc13.noObjectiveDetail") }
          : {
              family: "attention",
              label: t("svc13.verdict.UNMEASURED"),
              detail: row.gap !== null ? t("svc13.gapDetail", { p: period(row.gap.from, row.gap.to, locale) }) : t("svc13.unmeasuredDetail"),
            };
  return {
    _key: `${row.processKey}-${row.periodStart}`,
    period: period(row.periodStart, row.periodEnd, locale),
    measured: row.measuredValue !== null ? { text: percent(row.measuredValue, locale), num: true } : { text: t("svc13.notTaken"), muted: true },
    objective: row.objectiveVersion ?? t("svc13.none"),
    verdict,
  };
}
