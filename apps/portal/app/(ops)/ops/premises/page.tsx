import {
  Banner,
  Button,
  Columns,
  Combobox,
  Divider,
  EmptyState,
  FactList,
  ItemList,
  PageHeader,
  Pagination,
  Panel,
  Skeleton,
  StatStrip,
  StatusLine,
  Table,
  TextField,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { PanelForm } from "@/features/parties/PanelForm";
import { PartyTabs } from "@/features/parties/PartyTabs";
import { PremisesFilter } from "@/features/parties/PremisesFilter";
import { admitPremisesAction } from "@/features/parties/premises-actions";
import { areaWords, classWords, count, licensingHelp, licensingLine, licensingStatus, moment, percent, premisesRefusal, premisesTranslator, shortDay } from "@/features/parties/premises-copy";
import { ShortcutButton } from "@/features/parties/ShortcutButton";
import { readForPage } from "@/lib/api/flash";
import { loadReviewQueue } from "@/lib/api/parties";
import { REGISTER_LICENSING, loadPremisesRegister, type PremisesAttempt, type PremisesRegister, type RegisterRow } from "@/lib/api/premises";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS, UNNAMED_ENTRY } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** The area the register opens on, as its board draws it; `all` reads every area. */
const DEFAULT_AREA = "Phường An Khánh";
const ALL = "all";

/**
 * SCR-PTY-06 Premises register and coverage, the third tab of Parties and premises. The coverage comes first: the
 * population route, the last completed reconciliation with its age against the interval, and the scope it limits
 * (FR-PTY-043), then In scope as the denominator of every other figure (FR-PTY-011); then the register of the area,
 * each premises with its record, class, party now and licensing status with the time it was derived. An officer or
 * the data owner admits a premises by hand beside the list; assurance and reporting read it.
 */
export default async function PremisesRegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-DAT", "ACT-AUD", "ACT-REP");
  const params = await searchParams;
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(params, PREMISES_VIEWS);
  const view = asked === "loading" ? null : asked;
  const areaAsked = text(params.area) ?? DEFAULT_AREA;
  const filter = { area: areaAsked === ALL ? null : areaAsked, q: text(params.q), licensing: text(params.licensing) };
  const outcome = asked === "loading" ? null : await loadPremisesRegister(staff, filter, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The review queue's tab counts the open reviews, for a reader the queue admits.
  const reviews = holds(staff, "ACT-OPS", "ACT-AUD") ? ((await loadReviewQueue(staff, { kind: null, age: null }, null)).data?.open ?? null) : null;
  const attempt = readForPage<PremisesAttempt>(params);
  const kept = attempt?.form === "admit" ? attempt : null;
  const noPopulation = failure?.code === "NO_POPULATION_DEFINED";
  const admitting = data !== null && data.mayAdmit && (params.panel === "admit" || (kept?.refusal ?? null) !== null);
  const areaValue = data !== null ? (data.area?.ward ?? ALL) : areaAsked;
  const reportWhy = noPopulation ? t("pty06.reportEmpty") : failure?.code === "POPULATION_ROUTE_UNKNOWN" ? t("pty06.reportRefused") : asked === "loading" ? t("pty06.reportLoading") : null;

  return (
    <OpsFrame
      console="operations"
      current="parties"
      staff={staff}
      searchLabel={t("party.search")}
      keyMap={[
        ...(data !== null && data.rows.length > 0
          ? [
              { keys: ["J", "K"], label: t("pty06.kMove") },
              { keys: ["Enter"], label: t("pty06.kOpen") },
            ]
          : []),
        { keys: ["/"], label: t("pty06.kFilter") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("party.crumb"), href: routes.opsParties() }]}
          title={t("pty06.title")}
          {...(data !== null ? { meta: data.area !== null ? t("pty06.meta", { area: areaWords(data.area, t), ts: moment(data.asOf, locale) }) : t("pty06.metaAll", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          <Button
            variant="secondary"
            size="sm"
            icon="chart-column"
            {...(reportWhy !== null || data === null ? { disabled: true, ...(reportWhy !== null ? { disabledReason: reportWhy } : {}) } : { href: routes.opsCoverageReport(data.area?.ward ?? ALL), download: true })}
            locale={locale}
          >
            {t("pty06.report")}
          </Button>
          {holds(staff, "ACT-OPS", "ACT-DAT") ? (
            noPopulation ? (
              <Button variant="primary" size="sm" icon="plus" disabled disabledReason={t("pty06.admitNoPopulation")} locale={locale}>
                {t("pty06.admit")}
              </Button>
            ) : (
              <ShortcutButton variant="primary" size="sm" icon="plus" shortcut="Alt+A" href={routes.opsPremisesRegister({ area: areaValue, q: filter.q, licensing: filter.licensing, panel: "admit" })} locale={locale}>
                {t("pty06.admit")}
              </ShortcutButton>
            )
          ) : null}
        </PageHeader>
        <PartyTabs current="register" openReviews={reviews} t={t} locale={locale} />
        {!noPopulation && failure?.code !== "INTERNAL_ERROR" ? (
          <PremisesFilter
            words={{
              filters: t("pty06.filters"),
              search: t("pty06.fSearch"),
              placeholder: t("pty06.searchPh"),
              area: t("pty06.fArea"),
              allAreas: t("pty06.allAreas"),
              licensing: t("pty06.fLic"),
              allLicensing: t("pty06.allLic"),
              chipSearch: t("pty06.chipSearch"),
              chipLicensing: t("pty06.chipLic"),
            }}
            areas={(data?.areas ?? [{ ward: DEFAULT_AREA, city: "TP. Hồ Chí Minh" }]).map((area) => ({ value: area.ward, label: area.ward, detail: area.city }))}
            statuses={REGISTER_LICENSING.map((code) => ({ value: code, label: t(`prm.licensing.${code}`) }))}
            value={{ area: areaValue, q: filter.q, licensing: data?.filter.licensing ?? filter.licensing }}
            summary={data !== null ? t("pty06.count", { n: count(data.rows.length, locale) }) : ""}
            locale={locale}
          />
        ) : null}
        <Columns side="md" single={!admitting}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
            {asked === "loading" ? (
              <Loading t={t} locale={locale} />
            ) : noPopulation ? (
              <EmptyState variant="governed" icon="building-2" title={t("pty06.emptyTitle")} level={2} density="console" locale={locale}>
                {t("pty06.emptyText")}
              </EmptyState>
            ) : failure?.code === "POPULATION_ROUTE_UNKNOWN" ? (
              <>
                <Banner family="attention" title={premisesRefusal(t, "POPULATION_ROUTE_UNKNOWN").title} code="POPULATION_ROUTE_UNKNOWN" density="console" locale={locale}>
                  {premisesRefusal(t, "POPULATION_ROUTE_UNKNOWN").text}
                </Banner>
                <Panel title={t("pty06.unnamedTitle")} level={2} compact locale={locale}>
                  <ItemList
                    items={[{ key: UNNAMED_ENTRY.record, title: UNNAMED_ENTRY.name, href: routes.opsPremisesProvenance(UNNAMED_ENTRY.record), detail: t("pty06.unnamedDetail", { r: UNNAMED_ENTRY.record }) }]}
                    readOnly
                    density="console"
                    label={t("pty06.unnamedTitle")}
                    locale={locale}
                  />
                </Panel>
              </>
            ) : failure !== null || data === null ? (
              <ViewState view="error" errorTitle={t("pty06.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
            ) : (
              <Register data={data} narrow={admitting} t={t} locale={locale} />
            )}
          </div>
          {admitting && data !== null ? <AdmitPanel data={data} attempt={kept} area={areaValue} t={t} locale={locale} /> : null}
        </Columns>
      </div>
    </OpsFrame>
  );
}

function Loading({ t, locale }: { t: Translate; locale: Locale }) {
  return (
    <>
      <Panel title={t("pty06.coverageAll")} level={2} compact locale={locale}>
        <Skeleton variant="facts" rows={2} density="console" locale={locale} />
        <Skeleton variant="card" rows={2} density="console" locale={locale} />
      </Panel>
      <Table columns={[{ key: "name", label: t("pty06.cPremises") }]} rows={[]} loading={5} density="console" caption={t("pty06.title")} locale={locale} />
    </>
  );
}

/** The coverage of the area in view, its denominator first, then the register's entries. */
function Register({ data, narrow, t, locale }: { data: PremisesRegister; narrow: boolean; t: Translate; locale: Locale }) {
  const limitation = data.limitation;
  const share = (n: number) => (data.coverage.inScope > 0 && n > 0 ? t("pty06.pct", { p: percent(Math.round((n / data.coverage.inScope) * 1000) / 10, locale) }) : null);
  const filtered = data.filter.q !== null || data.filter.licensing !== null;
  return (
    <>
      <Panel title={data.area !== null ? t("pty06.coverage", { area: data.area.ward }) : t("pty06.coverageAll")} level={2} compact locale={locale}>
        <FactList
          items={[
            { label: t("pty06.route"), value: t(`prm.popRoute.${limitation.route}`), note: t(`prm.popRoute.${limitation.route}.note`) },
            limitation.lastCompleted !== null
              ? {
                  label: t("pty06.lastRec"),
                  value: limitation.lastCompleted,
                  kind: "datetime" as const,
                  note: limitation.daysSince === 0 ? t("pty06.lastRecToday", { i: String(limitation.intervalDays) }) : t("pty06.lastRecNote", { n: count(limitation.daysSince ?? 0, locale), i: String(limitation.intervalDays) }),
                }
              : { label: t("pty06.lastRec"), value: null, missing: t("pty06.neverRec") },
            { label: t("pty06.scope"), value: t(`prm.scope.${limitation.scope}`) },
          ]}
          columns={narrow ? 1 : 2}
          density="console"
          locale={locale}
        />
        {limitation.lastCompleted === null ? <StatusLine family="attention" text={t("prm.neverReconciled")} detail={t("prm.neverReconciledText")} cutout="surface" locale={locale} /> : null}
        <StatStrip
          items={[
            { value: data.coverage.inScope, label: t("pty06.inScope"), note: t("pty06.inScopeNote") },
            ...REGISTER_LICENSING.map((code) => {
              const n = data.coverage.counts[code];
              const note = share(n);
              return { value: n, label: t(`prm.licensing.${code}`), family: licensingStatus(code, t).family, ...(note !== null ? { note } : {}) };
            }),
          ]}
          {...(narrow ? { columns: 3 as const } : {})}
          locale={locale}
        />
      </Panel>
      <Table
        columns={[
          { key: "name", label: t("pty06.cPremises"), kind: "strong", minWidth: "var(--space-56)" },
          { key: "rec", label: t("pty06.cRecord"), kind: "id" },
          { key: "cls", label: t("pty06.cClass"), minWidth: "var(--space-28)", missing: t("prm.notRecorded") },
          { key: "party", label: t("pty06.cParty"), kind: "stack", minWidth: "var(--space-44)" },
          { key: "lic", label: t("pty06.cLic"), kind: "status", help: licensingHelp(t), minWidth: "var(--space-60)" },
        ]}
        rows={data.rows.map((row) => registerRow(row, t, locale))}
        density="console"
        rowFocus
        sort={{ key: "name", dir: "asc" }}
        {...(data.rows.length > 0 ? { sortNote: t("pty06.sortNote") } : {})}
        empty={{ variant: "filtered", title: t("pty06.filteredTitle"), text: t("pty06.filteredText"), action: false }}
        caption={t("pty06.title")}
        locale={locale}
      />
      {data.rows.length > 0 ? (
        <Pagination summary={t("pty06.pager", { n: count(data.rows.length, locale) })} hasNext={false} endNote={t(filtered ? "pty06.endFiltered" : "pty06.endAll")} density="console" label={t("pty06.pages")} locale={locale} />
      ) : null}
    </>
  );
}

/** One premises: its party now and since when, and its licensing status with the time it was derived (DR-207). */
function registerRow(row: RegisterRow, t: Translate, locale: Locale): Record<string, unknown> {
  return {
    _key: row.record,
    _href: routes.opsPremises(row.record),
    name: row.name,
    rec: row.record,
    cls: row.classification !== null ? classWords(row.classification, t) : null,
    party:
      row.party !== null
        ? { text: row.party.legalName, ...(row.party.since !== null ? { detail: t("pty06.since", { d: shortDay(row.party.since, locale) }) } : {}) }
        : { text: t("prm.none"), detail: t("pty06.neverOp"), muted: true },
    lic: licensingStatus(row.licensing.status, t, licensingLine(row.licensing, { derived: "pty06.derived", derivedAdmit: "pty06.derivedAdmit", stale: "pty06.stale" }, t, locale)),
  };
}

/**
 * Admit premises, beside the list (P1): the identifying reference masked as it is typed, the address, the class
 * under the scheme in force, the area and its geography version, and the evidence, reason and operator of the manual
 * identification an admission by hand is (POST /premises). A refusal is said beside the field it names.
 */
function AdmitPanel({ data, attempt, area, t, locale }: { data: PremisesRegister; attempt: PremisesAttempt | null; area: string; t: Translate; locale: Locale }) {
  const value = (name: string) => {
    const typed = attempt?.values[name];
    return typeof typed === "string" ? typed : "";
  };
  const failed = attempt?.refusal ?? null;
  const at = (...fields: string[]) => failed !== null && failed.field !== null && fields.includes(failed.field);
  const sentence = () => {
    if (failed === null) return "";
    const refusal = premisesRefusal(t, failed.code, failed.values);
    if (failed.code === "OUTSIDE_POPULATION") return `${refusal.text} ${t(`prm.outsidePart.${failed.values.part ?? "CITY"}`, failed.values)}`;
    if (failed.code === "EVIDENCE_KIND_NOT_PERMITTED") return `${refusal.text} ${t("pty06.permitted", { kinds: data.admit.evidenceKinds.map((kind) => t(`party.evidence.${kind}`)).join(", ") })}`;
    if (failed.code === "FIELD_MISSING" && failed.field !== null) return `${refusal.text} ${t(`prm.fieldMissing.${failed.field}`)}`;
    if (failed.code === "CLASSIFICATION_NOT_IN_SCHEME") return `${refusal.text} ${refusal.title}.`;
    return refusal.text;
  };
  const error = (...fields: string[]) => (at(...fields) ? { error: sentence() } : {});
  const unplaced = failed !== null && (failed.field === null || failed.code === "IDENTIFYING_REFERENCE_TAKEN" || failed.code === "NO_POPULATION_DEFINED");
  return (
    <PanelForm action={admitPremisesAction} title={t("pty06.admit")} eyebrow={t("pty06.admitEyebrow")} submit={t("pty06.admit")} cancel={t("prm.cancel")} closeHref={routes.opsPremisesRegister({ area })} locale={locale}>
      <input type="hidden" name="return_area" value={area} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Text size="sm" tone="secondary">
          {t("pty06.admitDesc")}
        </Text>
        {unplaced && failed !== null ? (
          <Banner family="attention" title={premisesRefusal(t, failed.code, failed.values).title} code={failed.code} compact density="console" live locale={locale}>
            {premisesRefusal(t, failed.code, failed.values).text}
          </Banner>
        ) : null}
        <TextField label={t("pty06.fRef")} helper={t("pty06.fRefHelp")} name="identifying_reference" masked revealable inputMode="numeric" required {...error("identifying_reference")} density="console" width="var(--container-3xs)" locale={locale} />
        <TextField label={t("pty06.fName")} helper={t("pty06.fNameHelp")} name="trading_name" value={value("trading_name")} wrap density="console" width="100%" locale={locale} />
        <TextField label={t("pty06.fAddress")} name="address" value={value("address")} required {...error("address")} wrap density="console" width="100%" locale={locale} />
        <Combobox
          label={t("pty06.fClass")}
          helper={t("pty06.fClassHelp", { v: data.admit.schemeVersion })}
          name="classification"
          options={data.admit.classes.map((code) => ({ value: code, label: classWords(code, t) }))}
          value={value("classification")}
          allowCustom
          placeholder={t("pty06.fClassPh")}
          required
          {...error("classification")}
          density="console"
          width="100%"
          locale={locale}
        />
        <Combobox
          label={t("pty06.fAdmitArea")}
          name="administrative_area_key"
          options={data.admit.areas.map((entry) => ({ value: entry.ward, label: entry.ward, detail: entry.city }))}
          value={value("administrative_area_key") || (data.area?.ward ?? "")}
          placeholder={t("pty06.fAreaPh")}
          required
          {...error("administrative_area_key")}
          density="console"
          width="100%"
          locale={locale}
        />
        <TextField
          label={t("pty06.fVersion")}
          helper={t("pty06.fVersionHelp", { v: data.admit.geographyVersion })}
          name="geography_version"
          value={value("geography_version") || data.admit.geographyVersion}
          mono
          required
          {...error("geography_version")}
          density="console"
          width="var(--container-3xs)"
          locale={locale}
        />
        <Divider />
        <Text as="h3" size="base" weight="semibold">
          {t("pty06.sManual")}
        </Text>
        <Combobox
          label={t("pty03.fEvidence")}
          name="evidence_kind"
          options={data.admit.evidenceKinds.map((kind) => ({ value: kind, label: t(`party.evidence.${kind}`) }))}
          value={value("evidence_kind")}
          allowCustom
          placeholder={t("pty06.fEvidencePh")}
          required
          {...error("evidence_kind")}
          density="console"
          width="100%"
          locale={locale}
        />
        <TextField label={t("pty06.fEvidenceRef")} name="evidence_ref" value={value("evidence_ref")} mono required {...error("evidence_ref")} density="console" width="100%" locale={locale} />
        <TextField label={t("pty06.fReason")} name="reason" value={value("reason")} multiline rows={3} required {...error("reason")} density="console" width="100%" locale={locale} />
      </div>
    </PanelForm>
  );
}
