import { Button, DateField, FactList, FilterBar, PageHeader, Panel, Select, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { askedDay, COMPONENT_CODE, day, moment, tarTranslator } from "@/features/tariff/console";
import { requireStaff } from "@/lib/api/session";
import { loadMandateScopeChanges, type MandateScopeChange, type MandateScopeChanges } from "@/lib/api/tariff";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { TAR_VIEWS } from "@/lib/mock/tariff";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const CHANGES: readonly MandateScopeChange["change"][] = ["STOPPED", "RESTORED", "NONE"];

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-TAR-13 Mandate scope changes, on the policy console. No board draws it: it is built from TAR's specification
 * and wireframe on the console pattern of the finance lists. Each state change of a rights organisation's mandate the
 * tariff recorded, newest first, what it stopped or restored and from when; none creates a tariff version. The
 * finance operator reaches the policy console for this screen only.
 */
export default async function MandateScopeChangesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-POL-APR", "ACT-FIN-OP", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = tarTranslator(locale);
  const view = reviewView(params, TAR_VIEWS);
  const asked = text(params.change);
  const filter = {
    change: CHANGES.find((change) => change === asked) ?? null,
    from: askedDay(params["period-from"] ?? params.from),
    to: askedDay(params["period-to"] ?? params.to),
  };
  const outcome = view === "loading" ? null : await loadMandateScopeChanges(staff, filter, text(params.opened), view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="policy"
      current="mandates"
      staff={staff}
      searchLabel={t("tar13.search")}
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
        <PageHeader title={t("tar13.title")} {...(data !== null ? { meta: t("tar.asOf", { ts: moment(data.asOf, locale) }) } : {})} locale={locale} />
        {failure !== null && failure.code !== "CURSOR_INVALID" ? (
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
          <Changes data={data} asked={filter} cursorRefused={failure?.code === "CURSOR_INVALID"} t={t} locale={locale} />
        )}
        <Text size="sm" tone="secondary">
          {t("tar13.foot")}
        </Text>
      </div>
    </OpsFrame>
  );
}

function Changes({
  data,
  asked,
  cursorRefused,
  t,
  locale,
}: {
  data: MandateScopeChanges | null;
  asked: { change: MandateScopeChange["change"] | null; from: string | null; to: string | null };
  cursorRefused: boolean;
  t: Translate;
  locale: Locale;
}) {
  const filter = data?.filter ?? asked;
  const opened = data?.opened ?? null;
  return (
    <>
      <form action={routes.policyMandateChanges()}>
        <FilterBar label={t("tar13.filters")} shortcut="/" locale={locale}>
          <Select
            label={t("tar13.change")}
            name="change"
            options={[{ value: "", label: t("tar13.anyChange") }, ...CHANGES.map((change) => ({ value: change, label: change }))]}
            value={filter.change ?? ""}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <DateField
            label={t("tar.period")}
            name="period"
            range
            fromLabel={t("tar.from")}
            toLabel={t("tar.to")}
            {...(filter.from !== null ? { value: filter.from } : {})}
            {...(filter.to !== null ? { to: filter.to } : {})}
            {...(cursorRefused ? { error: t("tar.refusal.CURSOR_INVALID.title") } : {})}
            helper={false}
            density="console"
            locale={locale}
          />
          <Button variant="primary" size="sm" type="submit" loading={data === null && !cursorRefused} locale={locale}>
            {t("tar.show")}
          </Button>
        </FilterBar>
      </form>
      <Panel compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "effective", label: t("tar13.cEffective"), kind: "datetime" },
            { key: "mandate", label: t("tar13.cMandate") },
            { key: "state", label: t("tar13.cState"), kind: "mono" },
            { key: "change", label: t("tar13.cChange"), kind: "mono" },
            { key: "components", label: t("tar13.cComponents"), kind: "mono" },
            { key: "reason", label: t("tar13.cReason"), kind: "mono" },
          ]}
          rows={(data?.rows ?? []).map((row) => ({
            _key: row.key,
            _href: routes.policyMandateChanges({ change: filter.change, from: filter.from, to: filter.to, opened: row.key }),
            ...(row.key === opened?.key ? { _selected: true } : {}),
            effective: row.effectiveAt,
            mandate: row.organisation,
            state: row.newState,
            change: row.change,
            components: row.components.length > 0 ? row.components.map((layer) => COMPONENT_CODE[layer]).join(", ") : null,
            reason: row.reason,
          }))}
          loading={data === null && !cursorRefused ? 10 : false}
          density="console"
          rowFocus
          {...(data !== null && data.rows.length > 0 ? { sortNote: t("tar13.sortNote") } : {})}
          empty={{ variant: "governed", title: t("tar13.empty"), action: false }}
          caption={t("tar13.title")}
          locale={locale}
        />
      </Panel>
      {opened !== null ? <Opened change={opened} t={t} locale={locale} /> : null}
    </>
  );
}

function Opened({ change, t, locale }: { change: MandateScopeChange; t: Translate; locale: Locale }) {
  const components = change.components.map((layer) => COMPONENT_CODE[layer]).join(", ");
  const effect =
    change.change === "STOPPED"
      ? `${t("tar13.stopped", { components, d: day(change.effectiveAt, locale) })}${change.restoredOn !== null ? ` ${t("tar13.until", { d: day(change.restoredOn, locale) })}` : ""}`
      : change.change === "NONE"
        ? t("tar13.none")
        : null;
  return (
    <Panel title={t("tar13.openedTitle", { at: moment(change.effectiveAt, locale), mandate: change.organisation, state: change.newState })} level={2} density="console" locale={locale}>
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          { label: t("tar13.version"), value: change.version, kind: "mono" },
          { label: t("tar13.recorded"), value: change.recordedAt, kind: "datetime" },
          { label: t("tar13.event"), value: change.change === "NONE" ? t("tar13.nothingPublished") : t("tar13.published") },
        ]}
      />
      {effect !== null ? <Text size="base">{effect}</Text> : null}
    </Panel>
  );
}
