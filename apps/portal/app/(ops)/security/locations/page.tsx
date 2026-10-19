import { Banner, Button, DateField, FilterBar, PageHeader, Panel, StatusLine, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { askedInstant, day, moment, svcTranslator, time } from "@/features/continuity/console";
import { loadRouteDependencies, loadServiceLocations, type RouteDependency, type ServiceLocation, type ServiceLocations } from "@/lib/api/continuity";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { SVC_VIEWS } from "@/lib/mock/continuity";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-SVC-14 Locations and route dependencies, in service continuity on the security console. For one 15-minute
 * recording interval, the last one recorded unless another is asked, each critical service with the failure domains it
 * was served from (two machines in one domain are one), since when one with fewer than two has been so, and the
 * exception open about it; then what the public verification route depends on and whether each part is shown to answer
 * while the rest is down. The dependencies are the security officer's read alone: an operations officer is told so.
 */
export default async function LocationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-SEC");
  const params = await searchParams;
  const locale = await getLocale();
  const t = svcTranslator(locale);
  const view = reviewView(params, SVC_VIEWS);
  const at = askedInstant(params.at);
  const [locations, dependencies] = view === "loading" ? [null, null] : await Promise.all([loadServiceLocations(staff, at, view), loadRouteDependencies(staff)]);
  const data = locations?.data ?? null;
  const failure = locations?.failure ?? null;

  return (
    <OpsFrame
      console="security"
      current="locations"
      staff={staff}
      searchLabel={t("svc.search")}
      keyMap={data !== null ? [{ keys: ["J", "K"], label: t("svc14.kRows") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader crumbs={[{ label: t("svc.area") }, { label: t("svc.section") }]} title={t("svc14.title")} meta={t("svc14.meta")} locale={locale} />
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("svc14.errorTitle")}
            errorText={t("svc.errorText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            level={2}
            density="console"
            locale={locale}
          />
        ) : data === null ? (
          <ViewState view="loading" skeleton="table" rows={9} columns={5} density="console" locale={locale} />
        ) : (
          <>
            <form action={routes.securityLocations()}>
              <FilterBar label={t("svc14.fBar")} locale={locale}>
                <DateField
                  label={t("svc14.fAt")}
                  name="at"
                  withTime
                  value={data.interval.from.slice(0, 10)}
                  time={data.interval.from.slice(11, 16)}
                  step={15}
                  helper={t("svc14.fAtHelp", { t: moment(data.lastRecorded, locale) })}
                  density="console"
                  locale={locale}
                />
                <Button variant="secondary" size="sm" type="submit" locale={locale}>
                  {t("svc14.show")}
                </Button>
              </FilterBar>
            </form>
            <Locations data={data} t={t} locale={locale} />
            <Panel title={t("svc14.depTitle")} meta={t("svc14.depMeta")} level={2} density="console" locale={locale}>
              {dependencies === null || dependencies.data === null ? (
                <Banner family="neutral" title={t("svc14.depNotShown")} code={dependencies?.failure?.code ?? "ROLE_NOT_ASSIGNED"} level={3} density="console" locale={locale}>
                  {t("svc.refusal.ROLE_NOT_ASSIGNED")}
                </Banner>
              ) : (
                <Dependencies rows={dependencies.data} t={t} locale={locale} />
              )}
            </Panel>
          </>
        )}
        <div style={{ display: "flex" }}>
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("svc.close")}
          </Button>
        </div>
      </div>
    </OpsFrame>
  );
}

function Locations({ data, t, locale }: { data: ServiceLocations; t: Translate; locale: Locale }) {
  const span = t("svc14.span", { from: time(data.interval.from), to: time(data.interval.to) });
  return (
    <Panel title={t("svc14.locTitle", { span, d: day(data.interval.from, locale) })} meta={t("svc14.locMeta")} level={2} density="console" locale={locale}>
      <Table
        columns={[
          { key: "service", label: t("svc14.cService"), kind: "stack" },
          { key: "domains", label: t("svc14.cDomains"), kind: "stack", missing: t("svc14.none") },
          { key: "at", label: t("svc14.cAt"), kind: "datetime", missing: t("svc14.notRecordedYet"), nowrap: true },
          { key: "state", label: t("svc14.cState"), kind: "status", width: "var(--space-80)" },
          { key: "exc", label: t("svc14.cExc"), kind: "stack", missing: t("svc14.none") },
        ]}
        rows={data.services.map((row) => locationRow(row, span, data.interval.from, t, locale))}
        density="console"
        caption={t("svc14.locTitle", { span, d: day(data.interval.from, locale) })}
        sortNote={t("svc14.locSort")}
        rowFocus
        locale={locale}
      />
    </Panel>
  );
}

/** A service in the interval: two domains or more, one (and since when, under which incident), or none recorded. */
function locationRow(row: ServiceLocation, span: string, intervalStart: string, t: Translate, locale: Locale): Record<string, unknown> {
  const domains = row.domains.length;
  const since = row.singleSince;
  const state =
    domains === 0
      ? { family: "attention", label: t("svc14.state.none"), detail: t("svc14.noneDetail", { span }) }
      : domains === 1
        ? {
            family: "danger",
            label: t("svc14.state.one"),
            ...(since !== null
              ? {
                  detail: t(since.incident !== null ? "svc14.oneDetailIncident" : "svc14.oneDetail", {
                    place: t(`svc.domain.${row.domains[0] ?? ""}`),
                    at: since.at.slice(0, 10) === intervalStart.slice(0, 10) ? time(since.at) : moment(since.at, locale),
                    incident: since.incident ?? "",
                  }),
                }
              : {}),
          }
        : { family: "positive", label: domains === 2 ? t("svc14.state.two") : t("svc14.state.many", { n: domains }) };
  return {
    _key: row.service,
    service: { text: t(`svc.process.${row.service}`), detail: row.service },
    domains: domains === 0 ? null : { text: row.domains.join(", "), detail: t("svc14.machines", { m: row.machines, d: domains }) },
    at: row.recordedAt,
    state,
    exc: row.exception === null ? null : exceptionCell(row.exception, t, locale),
  };
}

/** The exception open about a row: who has taken it and when, or that nobody has yet, since it was raised. */
function exceptionCell(exception: { raisedAt?: string; takenBy: string | null; takenAt: string | null }, t: Translate, locale: Locale) {
  if (exception.takenBy !== null && exception.takenAt !== null) return { text: t("svc14.taken"), detail: t("svc14.takenBy", { who: exception.takenBy, at: moment(exception.takenAt, locale) }) };
  return { text: t("svc14.notTaken"), ...(exception.raisedAt !== undefined ? { detail: t("svc14.raisedAt", { at: moment(exception.raisedAt, locale) }) } : {}) };
}

function Dependencies({ rows, t, locale }: { rows: readonly RouteDependency[]; t: Translate; locale: Locale }) {
  const unproven = rows.filter((row) => !row.independentlyAvailable).length;
  const open = rows.filter((row) => row.exception !== null).length;
  return (
    <>
      {unproven > 0 && (
        <StatusLine family="attention" text={t("svc14.depLine", { n: unproven, total: rows.length })} detail={t("svc14.depDetail", { n: open })} locale={locale} />
      )}
      <Table
        columns={[
          { key: "comp", label: t("svc14.cComp"), kind: "mono" },
          { key: "kind", label: t("svc14.cKind") },
          { key: "indep", label: t("svc14.cIndep"), kind: "status", width: "var(--space-72)" },
          { key: "at", label: t("svc14.cEval"), kind: "datetime", nowrap: true },
          { key: "ev", label: t("svc14.cEvidence"), missing: t("svc14.noEvidence") },
          { key: "exc", label: t("svc14.cExc"), kind: "stack", missing: t("svc14.none") },
        ]}
        rows={rows.map((row) => ({
          _key: row.component,
          comp: row.component,
          kind: t(`svc14.kind.${row.kind}`),
          indep: row.independentlyAvailable ? { family: "positive", label: t("svc14.indep") } : { family: "attention", label: t("svc14.notIndep") },
          at: row.evaluatedAt,
          ev: row.evidenceRef,
          exc: row.exception === null ? null : exceptionCell(row.exception, t, locale),
        }))}
        density="console"
        caption={t("svc14.depTitle")}
        sortNote={t("svc14.depSort")}
        rowFocus
        locale={locale}
      />
    </>
  );
}
