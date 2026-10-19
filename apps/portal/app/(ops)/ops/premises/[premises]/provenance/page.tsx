import { Button, PageHeader, Panel, Skeleton, Table, Toast, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { OverrideForm } from "@/features/parties/OverrideForm";
import { overrideAction } from "@/features/parties/premises-actions";
import { clock, evidenceWordsOf, moment, premisesRefusal, premisesTranslator, valueWords } from "@/features/parties/premises-copy";
import { readForPage } from "@/lib/api/flash";
import { loadGeographyRepointings, loadPremisesProvenance, type PremisesAttempt, type PremisesProvenance, type ProvenanceRow, type RepointingList } from "@/lib/api/premises";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS, UNNAMED_ENTRY } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-08 Provenance and override. Two readers: the data owner reads where each field came from on the register
 * data console and overrides one, with the authority acted under; the operations officer reads the same table on the
 * operations console, told that overrides are the data owner's (finding F-10). The route is a word, never an icon,
 * because a contract consumer receives the same label (FR-PTY-025). An entry with no provenance at all is refused in
 * place of the table (FR-PTY-049). The data owner and assurance also read each re-pointing of the premises to a successor
 * area, with the area it left, which stays on every record made before (FR-PTY-040).
 */
export default async function ProvenancePage({ params, searchParams }: { params: Promise<{ premises: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DAT", "ACT-OPS", "ACT-AUD", "ACT-REP");
  const [{ premises }, query] = await Promise.all([params, searchParams]);
  const record = decodeURIComponent(premises);
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const outcome = asked === "loading" ? null : await loadPremisesProvenance(staff, record, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const owner = holds(staff, "ACT-DAT");
  const attempt = readForPage<PremisesAttempt>(query);
  const kept = attempt?.form === "override" && attempt.subject === record ? attempt : null;
  const done = typeof kept?.done === "string" ? kept.done.split("|") : null;
  const name = data?.name ?? (failure?.code === "NO_PROVENANCE" ? UNNAMED_ENTRY.name : null);
  const repointings = data !== null && holds(staff, "ACT-DAT", "ACT-AUD") ? ((await loadGeographyRepointings(staff, data.record)).data ?? null) : null;

  return (
    <OpsFrame
      console={owner ? "registerData" : "operations"}
      current={owner ? "premises" : "parties"}
      staff={staff}
      searchLabel={owner ? t("prm.searchData") : t("party.search")}
      keyMap={owner ? [{ keys: ["Esc"], label: t("pty08.kEsc") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            ...(owner ? [] : [{ label: t("party.crumb"), href: routes.opsParties() }]),
            { label: t("prm.register"), href: routes.opsPremisesRegister() },
            ...(name !== null ? [{ label: name, href: routes.opsPremises(data?.record ?? record) }] : []),
          ]}
          title={data !== null ? t("pty08.title", { p: data.name }) : t("pty08.titleGeneric")}
          {...(data !== null ? { meta: t(owner ? "pty08.meta" : "pty08.metaOps", { r: data.record, ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        {done !== null && data !== null ? (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Toast family="positive" title={t("pty08.toastTitle", { f: t(`prm.fieldLower.${done[0] ?? ""}`), F: t(`prm.field.${done[0] ?? ""}`) })} locale={locale}>
              {t("pty08.toastText", { t: `${clock(done[1] ?? "")} (GMT+7)`, a: typeof kept?.values.override_authority_ref === "string" ? kept.values.override_authority_ref : "" })}
            </Toast>
          </div>
        ) : null}
        {asked === "loading" ? (
          <Panel title={t("pty08.provTitle")} level={2} compact locale={locale}>
            <Skeleton variant="table" rows={5} density="console" locale={locale} />
          </Panel>
        ) : failure?.code === "NO_PROVENANCE" || failure?.code === "PREMISES_NOT_FOUND" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={refusalOf(failure.code, t)} density="console" locale={locale} />
            <Button variant="secondary" size="sm" href={routes.opsPremisesRegister()} locale={locale}>
              {t("pty08.back")}
            </Button>
          </div>
        ) : failure !== null || data === null ? (
          <ViewState view="error" errorTitle={t("pty08.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
        ) : (
          <>
            <Provenance data={data} t={t} locale={locale} />
            {repointings !== null && repointings.rows.length > 0 ? <Repointings list={repointings} t={t} locale={locale} /> : null}
            {data.mayOverride ? (
              <OverrideForm name={data.name} rows={data.rows} options={data.options} action={overrideAction.bind(null, data.record)} attempt={kept !== null && kept.refusal !== null ? kept : null} locale={locale} />
            ) : null}
          </>
        )}
      </div>
    </OpsFrame>
  );
}

/** A read refused: a premises the register does not hold, or an entry with no provenance, which has no code (finding F-7). */
function refusalOf(code: string, t: Translate) {
  const refusal = premisesRefusal(t, code, { name: UNNAMED_ENTRY.name, record: UNNAMED_ENTRY.record });
  return code === "NO_PROVENANCE" ? { title: refusal.title, text: refusal.text, family: "attention" as const } : { ...refusal, family: "attention" as const };
}

function Provenance({ data, t, locale }: { data: PremisesProvenance; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("pty08.provTitle")} level={2} compact locale={locale}>
      <Table
        columns={[
          { key: "field", label: t("pty08.cField"), kind: "stack" },
          { key: "value", label: t("pty08.cValue"), kind: "stack", minWidth: "var(--space-56)" },
          { key: "route", label: t("pty08.cRoute"), kind: "stack", minWidth: "var(--space-48)" },
          { key: "when", label: t("pty08.cWhen"), kind: "stack", nowrap: true },
          { key: "auth", label: t("pty08.cAuth"), kind: "id", missing: t("pty08.noAuth") },
        ]}
        rows={data.rows.map((row) => provenanceRow(row, t, locale))}
        density="console"
        caption={t("pty08.provTitle")}
        locale={locale}
      />
    </Panel>
  );
}

/** GET /premises/{id}/geography-repointings: each move to a successor area, newest first, the area it left beside it. */
function Repointings({ list, t, locale }: { list: RepointingList; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("pty08.rpTitle")} description={t("pty08.rpDesc")} level={2} compact locale={locale}>
      <Table
        columns={[
          { key: "from", label: t("pty08.rpFrom"), kind: "stack" },
          { key: "to", label: t("pty08.rpTo"), kind: "stack" },
          { key: "when", label: t("pty08.rpWhen"), kind: "stack", nowrap: true },
        ]}
        rows={list.rows.map((row) => ({
          _key: row.id,
          from: { text: row.fromArea, detail: t("pty07.geo", { v: row.fromVersion }) },
          to: { text: row.toArea, detail: t("pty07.geo", { v: row.toVersion }) },
          when: { text: moment(row.effectiveAt, locale), detail: t("pty08.by", { p: row.by }) },
        }))}
        density="console"
        caption={t("pty08.rpTitle")}
        locale={locale}
      />
    </Panel>
  );
}

/** One field: its value, the route as a word with the source behind it, when, and the authority of an override. */
function provenanceRow(row: ProvenanceRow, t: Translate, locale: Locale): Record<string, unknown> {
  const valueDetail =
    row.before !== null
      ? row.before.route === "AUTHORITATIVE_SOURCE"
        ? t("pty08.sourceSaid", { v: valueWords(row.before.value, t) })
        : t("pty08.before", { v: valueWords(row.before.value, t), r: t(`prm.routeLower.${row.before.route}`) })
      : row.value?.kind === "area"
        ? t("pty07.geo", { v: row.value.version })
        : null;
  const routeDetail =
    row.route === "DERIVED"
      ? row.statusRecord
      : row.source !== null
        ? t(`prm.source.${row.source}`)
        : row.identification !== null && row.by !== null
          ? t("pty08.admittedBy", { p: row.by, kind: evidenceWordsOf(row.identification.evidenceKind, t), ref: row.identification.evidenceRef })
          : null;
  return {
    _key: row.field,
    field: { text: t(`prm.field.${row.field}`), ...(row.overridable ? {} : { detail: t("pty08.notOverridable") }) },
    value: { text: valueWords(row.value, t), ...(valueDetail !== null ? { detail: valueDetail } : {}) },
    route: { text: t(`prm.route.${row.route}`), ...(routeDetail !== null ? { detail: routeDetail } : {}) },
    when: { text: moment(row.at, locale), ...(row.by !== null && row.route !== "MANUAL_ADMISSION" ? { detail: t("pty08.by", { p: row.by }) } : {}) },
    auth: row.authority,
  };
}
