import { Button, DateField, FilterBar, FreshnessLine, PageHeader, Select, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { askedDay, codeWords, oversightTranslator } from "@/features/oversight/console";
import { loadVerificationCounts, ROUTE_KINDS, type OutcomeCount, type OutcomeCounts, type RouteKind } from "@/lib/api/oversight";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PUB19_VIEWS } from "@/lib/mock/oversight";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The rows the skeleton draws while the counts are read: the board's ten. */
const LOADING_ROWS = 10;

/**
 * SCR-PUB-19 Verification outcome counts, on the oversight console. The reporting owner and the security officer read,
 * for a period, how each public route answered and refused, an inability apart from an absence, with no reference
 * looked up and no requester. The counts are the world's own: every lookup made on the public pages of this browser
 * moves them. Anyone else on the gateway's staff is refused NOT_AUTHORISED in the header, with nothing read.
 */
export default async function VerificationCountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff();
  const params = await searchParams;
  const locale = await getLocale();
  const t = oversightTranslator(locale);
  const view = reviewView(params, PUB19_VIEWS);
  const asked = {
    from: askedDay(params["period-from"]),
    to: askedDay(params["period-to"]),
    routeKind: ROUTE_KINDS.find((kind) => kind === params.route) ?? null,
  };
  const outcome = view === "loading" ? null : await loadVerificationCounts(staff, asked, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const notAuthorised = failure?.code === "NOT_AUTHORISED";
  // The rows' keys are listed only while the table that binds them is on the page.
  const tableShown = !notAuthorised && failure?.code !== "PERIOD_INVALID";

  return (
    <OpsFrame
      console="oversight"
      current="verification"
      staff={staff}
      searchLabel={t("pubov.search")}
      keyMap={tableShown ? [{ keys: ["J", "K"], label: t("pubov.kRows") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader crumbs={[{ label: t("pubov.crumb") }]} title={t("pub19.title")} meta={t("pub19.meta")} locale={locale}>
          {/* The disclosure profile admits the security officer, not the reporting owner, so only they are offered it. */}
          {holds(staff, "ACT-SEC") && (
            <Button variant="secondary" size="sm" icon="shield-check" href={routes.oversightDisclosureProfile()} locale={locale}>
              {t("pubov.profile")}
            </Button>
          )}
        </PageHeader>
        {notAuthorised ? (
          <ViewState view="refused" refusal={{ code: "NOT_AUTHORISED", title: t("pubov.naTitle"), text: t("pubov.naText"), family: "attention" }} level={2} density="console" locale={locale} />
        ) : (
          <Counts data={data} failure={failure} asked={asked} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Counts({
  data,
  failure,
  asked,
  t,
  locale,
}: {
  data: OutcomeCounts | null;
  failure: { code: string; traceId: string | null; retryable: boolean } | null;
  asked: { from: string | null; to: string | null; routeKind: RouteKind | null };
  t: Translate;
  locale: Locale;
}) {
  const periodRefused = failure?.code === "PERIOD_INVALID";
  const outage = failure !== null && !periodRefused ? failure : null;
  const from = data?.period.from ?? asked.from;
  const to = data?.period.to ?? asked.to;
  const routeKind = data?.routeKind ?? asked.routeKind;
  const rows = data?.rows ?? [];

  return (
    <>
      <form action={routes.oversightVerificationCounts()} noValidate>
        <FilterBar label={t("pub19.filterLabel")} shortcut="/" {...(data !== null ? { summary: t("pub19.rows", { n: rows.length }) } : {})} locale={locale}>
          <DateField
            label={t("pub19.fPeriod")}
            name="period"
            range
            {...(from !== null ? { value: from } : {})}
            {...(to !== null ? { to } : {})}
            fromLabel={t("pub19.from")}
            toLabel={t("pub19.to")}
            required
            helper={false}
            {...(periodRefused ? { error: t("pubov.refusal.PERIOD_INVALID") } : {})}
            density="console"
            locale={locale}
          />
          <Select
            label={t("pub19.fRoute")}
            name="route"
            options={[{ value: "", label: t("pub19.all") }, ...ROUTE_KINDS.map((kind) => ({ value: kind, label: t(`pubov.route.${kind}`) }))]}
            value={routeKind ?? ""}
            width="var(--space-64)"
            density="console"
            locale={locale}
          />
          <Button variant="primary" size="sm" type="submit" locale={locale}>
            {t("pub19.show")}
          </Button>
        </FilterBar>
      </form>
      {data !== null && <FreshnessLine period={data.period} asOf={data.asOf} cadence={t(`pub19.cadence.${data.granularity}`)} locale={locale} />}
      {/* A refused period returns no count, so no table stands under the field that says why. */}
      {!periodRefused && (
        <Table
          columns={[
            { key: "route", label: t("pub19.cRoute"), kind: "strong", minWidth: "var(--space-56)" },
            { key: "outcome", label: t("pub19.cOutcome"), kind: "stack" },
            { key: "cause", label: t("pub19.cCause"), kind: "stack", missing: t("pub19.noCause") },
            { key: "count", label: t("pub19.cCount"), kind: "count" },
          ]}
          rows={rows.map((row) => countRow(row, t))}
          density="console"
          caption={t("pub19.title")}
          rowFocus
          loading={data === null && outage === null ? LOADING_ROWS : false}
          {...(rows.length > 0 ? { sortNote: t("pub19.sortNote") } : {})}
          empty={{ variant: "governed", title: t("pub19.emptyTitle"), action: false }}
          {...(outage !== null
            ? { error: { text: t("pubov.errText"), ...(outage.traceId !== null ? { traceId: outage.traceId } : {}), retryable: outage.retryable } }
            : {})}
          locale={locale}
        />
      )}
    </>
  );
}

/** One count: the route, the outcome or refusal in words with its code under it, the cause likewise, the figure. */
function countRow(row: OutcomeCount, t: Translate): Record<string, unknown> {
  return {
    _key: `${row.routeKind}-${row.outcome}-${row.cause ?? ""}`,
    route: t(`pubov.route.${row.routeKind}`),
    outcome: { text: codeWords(t, "outcome", row.outcome), detail: row.outcome },
    cause: row.cause !== null ? { text: codeWords(t, "cause", row.cause), detail: row.cause } : null,
    count: row.count,
  };
}
