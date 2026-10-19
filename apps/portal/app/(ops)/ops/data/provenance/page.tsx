import {
  Banner,
  Button,
  Columns,
  DateField,
  EmptyState,
  FactList,
  FilterBar,
  ItemList,
  PageHeader,
  Panel,
  Select,
  StatusLine,
  Table,
  TextField,
  ViewState,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { recordClassAct } from "@/features/data-governance/actions";
import { askedDay, datTranslator, day, moment } from "@/features/data-governance/console";
import { SubmitButton } from "@/features/data-governance/SubmitButton";
import { loadProvenance, type ProvenanceAttempt, type ProvenanceLookup, type ProvenancePage } from "@/lib/api/data-governance";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { DAT_VIEWS } from "@/lib/mock/data-governance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * SCR-DAT-04 Provenance classification, in the data governance workspace of the operations console. The data
 * governance owner looks up a value a report shows and reads the class it carries and what decided it: the value
 * itself, recorded with its class, or for a derived value the weakest of its inputs. A value with no class on record
 * can have one recorded here, refused without a class or with one outside the six. A caller that asked for the value
 * without its class (`fields=value`, a figure's link) is refused, told the refused request was recorded with who asked
 * and when, and shown the two together. A past day (`as-of`) reads the class each value carried at the end of it.
 */
export default async function ProvenanceClassificationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DAT");
  const params = await searchParams;
  const locale = await getLocale();
  const t = datTranslator(locale);
  const view = reviewView(params, DAT_VIEWS);
  const valueRef = text(params.value);
  const typedDay = text(params["as-of"]);
  const asOfDay = typedDay === null ? null : askedDay(typedDay);
  const attempt = readForPage<ProvenanceAttempt>(params);
  const outcome = view === "loading" ? null : await loadProvenance(staff, valueRef, params.fields !== "value", asOfDay, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const lookup = data?.lookup ?? null;

  return (
    <OpsFrame
      console="operations"
      current="data"
      staff={staff}
      searchLabel={t("dat04.search")}
      keyMap={lookup !== null && lookup.inputs !== null ? [{ keys: ["J", "K"], label: t("dat04.kNext") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader crumbs={[{ label: t("dat04.crumb") }]} title={t("dat04.title")} meta={t("dat04.meta")} locale={locale}>
          {valueRef !== null && (
            <Button variant="quiet" size="sm" icon="refresh-cw" href={routes.opsProvenance({ value: valueRef, "as-of": asOfDay })} locale={locale}>
              {t("dat.refresh")}
            </Button>
          )}
          {lookup !== null && lookup.provenanceClass !== null && (
            // The export carries the class of every value as a column; a value without one has nothing to export.
            <Button variant="secondary" size="sm" icon="download" href={routes.opsProvenanceExport({ value: lookup.valueRef, "as-of": asOfDay })} download locale={locale}>
              {t("dat04.export")}
            </Button>
          )}
        </PageHeader>
        {data?.omitted !== null && data?.omitted !== undefined && (
          <Banner family="neutral" title={t("dat04.omTitle")} code="CLASS_CANNOT_BE_OMITTED" density="console" locale={locale}>
            {t("dat04.omText", { who: data.omitted.by, at: moment(data.omitted.at, locale) })}
          </Banner>
        )}
        <form action={routes.opsProvenance()}>
          <FilterBar label={t("dat04.fBar")} shortcut="/" locale={locale}>
            <TextField
              label={t("dat04.fValue")}
              name="value"
              {...(valueRef !== null ? { value: valueRef } : {})}
              placeholder={t("dat04.fHint")}
              mono
              width="var(--space-96)"
              density="console"
              locale={locale}
            />
            <DateField
              label={t("dat04.fAsOf")}
              name="as-of"
              {...(asOfDay !== null ? { value: asOfDay } : {})}
              helper={t("dat04.asOfHelp")}
              {...(typedDay !== null && asOfDay === null ? { error: t("dat04.asOfInvalid") } : {})}
              density="console"
              locale={locale}
            />
            <Button variant="secondary" size="sm" icon="search" type="submit" locale={locale}>
              {t("dat04.lookUp")}
            </Button>
          </FilterBar>
        </form>
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("dat04.errTitle")}
            errorText={t("dat04.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            level={2}
            density="console"
            locale={locale}
          />
        ) : data === null ? (
          <ViewState view="loading" skeleton="facts" rows={4} density="console" locale={locale} />
        ) : lookup === null ? (
          <EmptyState variant="not-started" title={t("dat04.nsTitle")} icon="search" level={2} action={false} density="console" locale={locale}>
            {t("dat04.nsText")}
          </EmptyState>
        ) : (
          <Lookup data={data} lookup={lookup} attempt={attempt?.valueRef === lookup.valueRef ? attempt : null} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Lookup({ data, lookup, attempt, t, locale }: { data: ProvenancePage; lookup: ProvenanceLookup; attempt: ProvenanceAttempt | null; t: Translate; locale: Locale }) {
  const derived = lookup.inputs !== null;
  const className = (value: string) => t(`dat.class.${value}`);
  const decided = lookup.decidedBy;
  const ownMissing = lookup.missing !== null && lookup.missing === lookup.valueRef;
  // A class is recorded now, so the form is offered only when the reader looks at the present; a past day's gap is history.
  const recordable = ownMissing && data.asOfDay === null;

  return (
    <Columns>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        {attempt !== null && attempt.recorded !== null && <StatusLine family="positive" text={t("dat04.recorded", { c: className(attempt.recorded) })} live locale={locale} />}
        {lookup.missing !== null && !recordable && (
          <Banner
            family="neutral"
            title={ownMissing ? t("dat04.valueMissingTitle", { day: data.asOfDay !== null ? day(data.asOfDay, locale) : "" }) : t("dat04.inputMissingTitle", { input: lookup.missing })}
            code="PROVENANCE_CLASS_MISSING"
            density="console"
            locale={locale}
          >
            {t("dat.refusal.PROVENANCE_CLASS_MISSING")}
          </Banner>
        )}
        <Panel title={t("dat04.classTitle")} level={2} density="console" locale={locale}>
          <FactList
            items={[
              { label: t("dat04.fRef"), value: lookup.valueRef, kind: "mono", ...(lookup.note !== null ? { note: lookup.note[locale] } : {}) },
              { label: t("dat04.fClass"), value: lookup.provenanceClass !== null ? className(lookup.provenanceClass) : null, kind: "strong", missing: t("dat04.noClass") },
              {
                label: t("dat04.fDecided"),
                value: decided === null ? null : decided.kind === "INPUT" ? t("dat04.decidedInput", { input: decided.input }) : t("dat04.decidedSelf"),
                missing: t("dat04.notDecided"),
                ...(decided?.kind === "RECORD"
                  ? { note: t("dat04.recordedBy", { who: decided.recordedBy ?? t("dat04.system"), at: moment(decided.recordedAt, locale) }) }
                  : {}),
              },
              { label: t("dat04.fAsOfFact"), value: lookup.asOf, kind: "datetime" },
              { label: t("dat04.fAt"), value: lookup.lookedUpAt, kind: "datetime" },
            ]}
            density="console"
            locale={locale}
          />
          {decided?.kind === "INPUT" && decided.reason === "WEAKEST_INPUT_IMPUTED" && lookup.inputs !== null && (
            <StatusLine
              family="info"
              text={t("dat04.ruleImputed", {
                measured: lookup.inputs.filter((input) => input.provenanceClass === "authoritative").reduce((sum, input) => sum + input.venues, 0),
                weighted: lookup.inputs.filter((input) => input.provenanceClass === "imputed").reduce((sum, input) => sum + input.venues, 0),
              })}
              detail={t("dat04.ruleImputedDetail")}
              locale={locale}
            />
          )}
        </Panel>
        {derived && lookup.inputs !== null && (
          <Panel title={t("dat04.inputsTitle")} description={t("dat04.inputsNote")} level={2} density="console" locale={locale}>
            <Table
              columns={[
                { key: "input", label: t("dat04.cInput"), kind: "mono" },
                { key: "cls", label: t("dat04.cClass"), kind: "strong" },
                { key: "venues", label: t("dat04.cVenues"), kind: "count", align: "end" },
              ]}
              rows={lookup.inputs.map((input) => ({
                _key: input.input,
                ...(input.weakest ? { _message: { severity: "neutral", text: t("dat04.weakest") } } : {}),
                input: input.input,
                cls: className(input.provenanceClass),
                venues: input.venues,
              }))}
              density="console"
              caption={t("dat04.inputsTitle")}
              sortNote={t("dat04.sortNote")}
              rowFocus
              locale={locale}
            />
          </Panel>
        )}
        {recordable && (
          <Panel title={t("dat04.recTitle")} description={t("dat04.recNote")} level={2} density="console" locale={locale}>
            <form action={recordClassAct} noValidate style={{ display: "contents" }}>
              <input type="hidden" name="value_ref" value={lookup.valueRef} />
              <Columns layout="halves" gap={4}>
                <TextField label={t("dat04.recValue")} value={lookup.valueRef} readOnly mono density="console" locale={locale} />
                <Select
                  label={t("dat04.recClass")}
                  name="provenance_class"
                  options={data.order.map((value) => ({ value, label: className(value) }))}
                  placeholder={t("dat04.recPick")}
                  required
                  error={t(`dat.refusal.${attempt?.refusal ?? "PROVENANCE_CLASS_MISSING"}`)}
                  density="console"
                  locale={locale}
                />
              </Columns>
              <div style={{ display: "flex" }}>
                <SubmitButton variant="primary" size="sm" locale={locale}>
                  {t("dat04.recDo")}
                </SubmitButton>
              </div>
            </form>
          </Panel>
        )}
      </div>
      <Panel as="aside" title={t("dat04.orderTitle")} description={t("dat04.orderNote")} level={2} density="console" locale={locale}>
        <ItemList
          items={data.order.map((value) => ({ key: value, title: className(value), ...(value === lookup.provenanceClass ? { selected: true } : {}) }))}
          numbered
          readOnly
          density="console"
          label={t("dat04.orderTitle")}
          locale={locale}
        />
      </Panel>
    </Columns>
  );
}
