import { Button, EmptyState, FactList, PageHeader, Panel, SidePanel, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { OversightFilter } from "@/features/inspection/Filters";
import { monthWords } from "@/features/inspection/standing";
import { joined, refusalOf, timestamp } from "@/features/inspection/words";
import { loadInspectionOversight, type InspectionOversight, type OversightSupply, type SupplyState } from "@/lib/api/inspection";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);
/** A supply's state in its family: only a ready one is positive, one that failed is danger (as SCR-VER-07). */
const STATE_FAMILY: Readonly<Record<SupplyState, "info" | "positive" | "danger" | "neutral">> = { REQUESTED: "info", READY: "positive", FAILED: "danger", DISPOSED: "neutral" };
const COUNTS = ["open", "concluded", "abandoned", "compliant", "nothingFound", "guidance", "referred", "undelivered"] as const;

/**
 * SCR-VER-16 Oversight of inspections and supplies. The supervising authority and the auditor read a month's
 * supplies - headers and counts, never an entry - and the inspections counted per authority by state, outcome and
 * delivery, with no person named; the auditor also reads who requested a supply. Nothing here acts.
 */
export default async function InspectionOversightPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The supervising authority (ACT-REG) and the auditor (ACT-AUD) read here; anyone else goes to their own work.
  const staff = await requireStaff("ACT-REG", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const loading = reviewView(params, ["loading"] as const) === "loading";
  const outcome = loading ? null : await loadInspectionOversight(staff, text(params.period), text(params.authority), text(params.supply));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const total = data === null ? 0 : data.counts.reduce((sum, row) => sum + row.open + row.concluded + row.abandoned, 0);
  const empty = data !== null && data.supplies.length === 0 && total === 0;

  return (
    <OpsFrame
      console="oversight"
      current="inspections"
      staff={staff}
      searchLabel={t("ver16.search")}
      keyMap={[
        { keys: ["J", "K"], label: t("ver.kRows") },
        { keys: ["Enter"], label: t("ver16.kOpen") },
        { keys: ["Esc"], label: t("ver18.kClose") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("ver16.crumb") }]}
          title={data !== null ? t("ver16.title", { p: monthWords(t, data.period, "in-sentence") }) : t("ver16.titleGeneric")}
          {...(data !== null ? { meta: t("ver16.meta", { t: timestamp(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          {data !== null && (
            <Button
              variant="secondary"
              size="sm"
              icon="download"
              {...(empty
                ? { disabled: true, disabledReason: t("ver16.exportWhy") }
                : { href: routes.oversightInspectionsExport({ period: data.period, authority: data.authority ?? undefined }), download: true })}
              locale={locale}
            >
              {t("ver16.export")}
            </Button>
          )}
        </PageHeader>
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("ver.errTitle")}
            errorText={t("ver.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="console"
            level={2}
            locale={locale}
          />
        ) : (
          <Oversight data={data} total={total} empty={empty} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Oversight({ data, total, empty, t, locale }: { data: InspectionOversight | null; total: number; empty: boolean; t: Translate; locale: Locale }) {
  const supplies = data?.supplies ?? [];
  const sum = (field: (typeof COUNTS)[number]) => (data?.counts ?? []).reduce((acc, row) => acc + row[field], 0);

  return (
    <>
      {data !== null && (
        <OversightFilter
          periods={data.periods.map((period) => ({ value: period, label: monthWords(t, period, "option") }))}
          period={data.period}
          authorities={[{ value: "", label: t("ver16.any") }, ...data.authorities.map((authority) => ({ value: authority.id, label: `${authority.code} – ${authority.name}` }))]}
          authority={data.authority ?? ""}
          words={{ filters: t("ver16.filters"), period: t("ver16.period"), authority: t("ver16.authorities") }}
          summary={empty ? null : t("ver16.summary", { s: supplies.length, i: total })}
          locale={locale}
        />
      )}
      {empty ? (
        <EmptyState variant="governed" title={t("ver16.emptyTitle")} level={2} action={false} density="console" locale={locale} />
      ) : (
        <>
          <Panel title={t("ver16.supplies")} level={2} density="console" locale={locale}>
            <Table
              columns={[
                { key: "ref", label: t("ver16.cRef"), kind: "id" },
                { key: "auth", label: t("ver16.cAuth"), kind: "mono" },
                { key: "kind", label: t("ver16.cKind") },
                { key: "st", label: t("ver16.cState"), kind: "status" },
                { key: "gen", label: t("ver16.cGen"), kind: "datetime", missing: t("ver16.notGenerated") },
                { key: "listed", label: t("ver16.cListed"), kind: "count" },
                ...(data?.requesterShown === true ? [{ key: "by", label: t("ver16.cBy") }] : []),
                { key: "act", kind: "actions" as const },
              ]}
              rows={supplies.map((supply) => supplyRow(supply, data, t))}
              loading={data === null ? 4 : false}
              density="console"
              rowFocus
              caption={t("ver16.supplies")}
              {...(supplies.length > 0 ? { sortNote: t("ver16.supSort") } : {})}
              empty={{ variant: "governed", title: t("ver16.noSupplies"), action: false }}
              locale={locale}
            />
          </Panel>
          <Panel title={t("ver16.inspections")} description={t("ver16.inspNote")} level={2} density="console" locale={locale}>
            <Table
              columns={[
                { key: "auth", label: t("ver16.cAuth"), kind: "mono" },
                ...COUNTS.map((field) => ({ key: field, label: t(`ver16.count.${field}`), kind: "count" as const })),
              ]}
              rows={(data?.counts ?? []).map((row) => ({ _key: row.authorityCode, auth: row.authorityCode, ...Object.fromEntries(COUNTS.map((field) => [field, row[field]])) }))}
              loading={data === null ? 3 : false}
              density="console"
              caption={t("ver16.inspections")}
              rowHeaders
              {...(data !== null && data.counts.length > 0
                ? { totals: { label: t("ver16.total"), values: Object.fromEntries(COUNTS.map((field) => [field, sum(field)])) } }
                : {})}
              empty={{ variant: "governed", title: t("ver16.noInspections"), action: false }}
              locale={locale}
            />
          </Panel>
        </>
      )}
      {data !== null && data.openedRefusal !== null && (
        <ViewState view="refused" refusal={{ ...refusalOf(t, data.openedRefusal), family: "attention" }} density="console" level={2} locale={locale} />
      )}
      <div style={{ display: "flex" }}>
        <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
          {t("ver.close")}
        </Button>
      </div>
      {data !== null && data.opened !== null && <Opened data={data} t={t} locale={locale} />}
    </>
  );
}

function supplyRow(supply: OversightSupply, data: InspectionOversight | null, t: Translate): Record<string, unknown> {
  const href = routes.oversightInspections({ period: data?.period, authority: data?.authority ?? undefined, supply: supply.reference });
  return {
    _key: supply.reference,
    _href: href,
    ...(data?.opened?.supply.reference === supply.reference ? { _selected: true } : {}),
    ref: supply.reference,
    auth: supply.authorityCode,
    kind: t(`console.listKind.${supply.kind}`),
    st: { family: STATE_FAMILY[supply.state], label: t(`console.supplyState.${supply.state}`), ...(supply.state === "REQUESTED" ? { working: true } : {}) },
    gen: supply.generatedAt,
    listed: supply.listed,
    ...(supply.requester !== null ? { by: supply.requester } : {}),
    act: [{ label: t("ver16.open"), ariaLabel: `${t("ver16.open")} ${supply.reference}`, variant: "quiet", href }],
  };
}

/** One supply's header (GET /inspection-lists/{id}): never its entries. */
function Opened({ data, t, locale }: { data: InspectionOversight; t: Translate; locale: Locale }) {
  const opened = data.opened;
  if (opened === null) return null;
  const { supply, register } = opened;
  return (
    <SidePanel
      title={supply.reference}
      eyebrow={t("ver16.supplyEyebrow")}
      status={{ family: STATE_FAMILY[supply.state], label: t(`console.supplyState.${supply.state}`) }}
      open
      density="console"
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <FactList
          items={[
            { label: t("ver16.lKind"), value: t(`console.listKind.${supply.kind}`) },
            { label: t("ver16.lAuth"), value: opened.authority },
            { label: t("ver16.lAreas"), value: joined(t, opened.areas) },
            { label: t("ver16.lGen"), value: supply.generatedAt, kind: "datetime", missing: t("ver16.notGenerated") },
            ...(supply.requester !== null ? [{ label: t("ver16.cBy"), value: supply.requester }] : []),
            {
              label: t("ver16.lRegister"),
              value:
                register === null
                  ? null
                  : t("ver16.registerLine", {
                      route: t(`ver08.route.${register.route}`),
                      t: register.reconciledAt !== null ? timestamp(register.reconciledAt, locale) : "",
                      n: register.reconciledDaysAgo,
                      scope: register.scope === "AREAS" ? t("ver16.scopeAreas", { a: joined(t, register.limitedAreas) }) : t(`ver16.scope.${register.scope}`),
                    }),
              missing: t("ver06.none"),
            },
            { label: t("ver16.lStatement"), value: t(`ver08.statement.${supply.kind}`) },
          ]}
          density="console"
          locale={locale}
        />
        <Table
          columns={[
            { key: "area", label: t("ver16.cArea"), kind: "strong" },
            { key: "listed", label: t("ver16.cListed"), kind: "count" },
          ]}
          rows={opened.byArea.map((row) => ({ _key: row.area, area: row.area, listed: row.listed }))}
          density="console"
          caption={t("ver16.byArea")}
          empty={{ variant: "governed", title: t("ver16.noAreas"), action: false }}
          locale={locale}
        />
      </div>
    </SidePanel>
  );
}
