import { Button, Combobox, FactList, FilterBar, PageHeader, Panel, Select, Table, Tabs, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { moment, premisesClassCode, tariffTabs, tarTranslator } from "@/features/tariff/console";
import { requireStaff } from "@/lib/api/session";
import { loadDeclaredClassifications, type DeclaredClassifications, type DeclaredWatch, type WatchStatus } from "@/lib/api/tariff";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { TAR_VIEWS } from "@/lib/mock/tariff";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUSES: readonly WatchStatus[] = ["WATCHING", "RESOLVED_SAME", "RESOLVED_DIFFERENT", "CLOSED"];
/** SM-298 on the console: a watch still open asks for attention; a resolved or closed one is a fact. */
const STATUS_FAMILY = { WATCHING: "attention", RESOLVED_SAME: "neutral", RESOLVED_DIFFERENT: "neutral", CLOSED: "neutral" } as const;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-TAR-12 Declared classifications under reconciliation. No board draws it: it is built from TAR's specification
 * and wireframe on the console pattern of the finance lists. Every premises whose fee rests on a class it declared,
 * watched until the register answers, the open watches first and the oldest first; a watch opens under the list
 * with the calculation that opened it. Only the sweep resolves or closes a watch, so the page offers no such act.
 */
export default async function DeclaredClassificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-DAT", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = tarTranslator(locale);
  const view = reviewView(params, TAR_VIEWS);
  const asked = text(params.status);
  const chosen = { status: STATUSES.find((status) => status === asked) ?? null, premises: text(params.premises) };
  const outcome = view === "loading" ? null : await loadDeclaredClassifications(staff, chosen, text(params.watch), view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="tariff"
      staff={staff}
      searchLabel={t("tar.search")}
      // The rows' keys are listed only while the table that binds them is on the page.
      keyMap={
        (data?.rows.length ?? 0) > 0
          ? [
              { keys: ["↑", "↓"], label: t("tar.kMove") },
              { keys: ["Enter"], label: t("tar.kOpen") },
            ]
          : []
      }
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          title={t("tar12.title")}
          {...(data !== null ? { meta: t("tar12.meta", { n: data.rows.filter((row) => row.status === "WATCHING").length, ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <Tabs tabs={tariffTabs(staff, t)} value="declared" label={t("tar.tabs")} density="console" locale={locale} />
        {failure !== null ? (
          failure.code === "NOT_AUTHORISED" ? (
            <ViewState
              view="refused"
              refusal={{ code: failure.code, title: t("tar.refusal.NOT_AUTHORISED.title"), text: t("tar.refusal.NOT_AUTHORISED.text"), family: "attention" }}
              level={2}
              density="console"
              locale={locale}
            />
          ) : (
            <ViewState
              view="error"
              errorTitle={t("tar.errTitle")}
              errorText={t("tar.errText")}
              {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
              retryable={failure.retryable}
              level={2}
              density="console"
              locale={locale}
            />
          )
        ) : (
          <Watches data={data} chosen={chosen} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Watches({
  data,
  chosen,
  t,
  locale,
}: {
  data: DeclaredClassifications | null;
  chosen: { status: WatchStatus | null; premises: string | null };
  t: Translate;
  locale: Locale;
}) {
  const opened = data?.opened ?? null;
  return (
    <>
      <form action={routes.opsDeclaredClasses()}>
        <FilterBar label={t("tar12.filters")} shortcut="/" locale={locale}>
          <Select
            label={t("tar12.status")}
            name="status"
            options={[{ value: "", label: t("tar12.anyStatus") }, ...STATUSES.map((status) => ({ value: status, label: status }))]}
            value={chosen.status ?? ""}
            density="console"
            width="var(--space-56)"
            locale={locale}
          />
          <Combobox
            wrap
            label={t("tar.premises")}
            name="premises"
            options={(data?.premisesOptions ?? []).map((entry) => ({ value: entry.id, label: entry.name }))}
            {...(chosen.premises !== null ? { value: chosen.premises } : {})}
            placeholder={t("tar.anyPremises")}
            density="console"
            width="var(--container-xs)"
            locale={locale}
          />
          <Button variant="primary" size="sm" type="submit" loading={data === null} locale={locale}>
            {t("tar.show")}
          </Button>
        </FilterBar>
      </form>
      <Panel compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "premises", label: t("tar12.cPremises"), kind: "stack" },
            { key: "kind", label: t("tar12.cKind"), kind: "mono" },
            { key: "declared", label: t("tar12.cDeclared"), kind: "mono" },
            { key: "status", label: t("tar12.cStatus"), kind: "status" },
            { key: "age", label: t("tar12.cAge") },
          ]}
          rows={(data?.rows ?? []).map((row) => watchRow(row, row.key === opened?.key, chosen, t))}
          loading={data === null ? 5 : false}
          density="console"
          rowFocus
          {...(data !== null && data.rows.length > 0 ? { sortNote: t("tar12.sortNote") } : {})}
          empty={{ variant: "filtered", title: t("tar12.empty"), action: false }}
          caption={t("tar12.title")}
          locale={locale}
        />
        <Text size="sm" tone="secondary">
          {t("tar12.sweepOnly")}
        </Text>
      </Panel>
      {opened !== null && data !== null ? <Opened watch={opened} mayOpen={data.mayOpenCalculation} t={t} locale={locale} /> : null}
    </>
  );
}

function watchRow(row: DeclaredWatch, selected: boolean, chosen: { status: WatchStatus | null; premises: string | null }, t: Translate): Record<string, unknown> {
  return {
    _key: row.key,
    _href: routes.opsDeclaredClasses({ ...chosen, watch: row.key }),
    ...(selected ? { _selected: true } : {}),
    premises: { text: row.premises.name },
    kind: row.kind,
    declared: row.declared !== null ? premisesClassCode(row.declared) : null,
    status: { family: STATUS_FAMILY[row.status], label: row.status },
    age: row.status === "WATCHING" ? t("tar.days", { n: row.ageDays }) : null,
  };
}

/** The watch opened under the list: the calculation that opened it, when it was last checked, the decision a different answer amends. */
function Opened({ watch, mayOpen, t, locale }: { watch: DeclaredWatch; mayOpen: boolean; t: Translate; locale: Locale }) {
  return (
    <Panel
      title={t("tar12.openedTitle", { premises: watch.premises.name, status: watch.status })}
      level={2}
      action={{
        label: t("tar12.openCalculation"),
        kind: "button",
        variant: "secondary",
        ...(mayOpen ? { href: routes.opsCalculation(watch.firstCalculation) } : { disabled: true, disabledReason: t("tar12.openWho") }),
      }}
      density="console"
      locale={locale}
    >
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          { label: t("tar12.firstCalculation"), value: watch.firstCalculation, kind: "id" },
          { label: t("tar12.opened"), value: watch.createdAt, kind: "datetime" },
          { label: t("tar12.checked"), value: watch.lastCheckedAt !== null ? moment(watch.lastCheckedAt, locale) : t("tar12.notChecked") },
          {
            label: t("tar12.reason"),
            value: watch.reason !== null ? t(`tar12.reason.${watch.reason}`) : t("tar12.notSwept"),
            ...(watch.resolvedClass !== null && watch.resolvedAt !== null
              ? { note: t("tar12.resolved", { class: t(`tar.class.${watch.resolvedClass}`), ts: moment(watch.resolvedAt, locale) }) }
              : {}),
          },
          ...(watch.resolvedDecision !== null ? [{ label: t("tar12.inForce"), value: watch.resolvedDecision, kind: "id" as const, note: t("tar12.inForceNote") }] : []),
          ...(watch.resolvedDecision === null && watch.decisionInForce !== null
            ? [{ label: t("tar12.inForce"), value: watch.decisionInForce, kind: "id" as const, note: t("tar12.inForceNote") }]
            : []),
        ]}
      />
    </Panel>
  );
}
