import { redirect } from "next/navigation";
import { EmptyState, PageHeader, Panel, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { capital, count, day, moment, premisesTranslator, shortDay } from "@/features/parties/premises-copy";
import { dispositionOfRecord, loadDispositionQueue, type DispositionQueueRow } from "@/lib/api/premises";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-16's queue, the business approvals console's landing for the approver: every premises change that left
 * records behind, the one with a record awaiting a decision first, each opening the change's records. An operations
 * officer reads it on the operations console. `?record=` opens the change a status record waits on, as SCR-CER-03's
 * Open the transfer does.
 */
export default async function DispositionQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS", "ACT-AUD");
  const query = await searchParams;
  if (typeof query.record === "string") {
    const found = await dispositionOfRecord(staff, query.record);
    if (found !== null) redirect(routes.opsChangeDispositions(found.change, found.disposition));
  }
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const outcome = asked === "loading" ? null : await loadDispositionQueue(staff, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const approver = holds(staff, "ACT-BIZ-APR");

  return (
    <OpsFrame
      console={approver ? "approvals" : "operations"}
      current={approver ? "dispositions" : "parties"}
      staff={staff}
      searchLabel={approver ? t("prm.searchApprovals") : t("party.search")}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={approver ? [{ label: t("prm.crumbApprovals") }] : [{ label: t("party.crumb"), href: routes.opsParties() }, { label: t("prm.register"), href: routes.opsPremisesRegister() }]}
          title={t("pty16.listTitlePage")}
          {...(data !== null ? { meta: t("pty16.listMeta", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        {failure !== null ? (
          <ViewState view="error" errorTitle={t("pty16.errTitle")} errorText={t("prm.errText")} {...(failure.traceId !== null ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
        ) : data !== null && data.rows.length === 0 ? (
          <EmptyState variant="governed" title={t("pty16.emptyTitle")} action={false} density="console" locale={locale}>
            {t("pty16.emptyText")}
          </EmptyState>
        ) : (
          <Panel title={t("pty16.queueTitle")} description={t("pty16.queueDesc")} compact locale={locale}>
            <Table
              columns={[
                { key: "premises", label: t("pty16.cPremises"), kind: "stack", minWidth: "var(--space-56)" },
                { key: "change", label: t("pty16.cChange"), kind: "stack", minWidth: "var(--space-64)" },
                { key: "records", label: t("pty16.cRecords"), kind: "stack" },
                { key: "awaiting", label: t("pty16.cAwaiting"), kind: "count" },
              ]}
              rows={(data?.rows ?? []).map((row) => queueRow(row, t, locale))}
              loading={data === null ? 3 : false}
              density="console"
              rowFocus
              caption={t("pty16.queueTitle")}
              locale={locale}
            />
          </Panel>
        )}
      </div>
    </OpsFrame>
  );
}

function queueRow(row: DispositionQueueRow, t: Translate, locale: Locale): Record<string, unknown> {
  const cause = t(`prm.cause.${row.cause}`);
  return {
    _key: row.change,
    _href: routes.opsChangeDispositions(row.change),
    premises: { text: row.premises.name, detail: row.premises.record },
    change: {
      text: row.incoming !== null ? t("pty16.changeOperator", { cause, incoming: row.incoming, d: shortDay(row.effectiveOn, locale) }) : t("pty16.changeEnd", { cause: capital(cause), d: shortDay(row.effectiveOn, locale) }),
      detail: t("pty16.recordedOn", { p: row.recordedBy, d: day(row.recordedAt, locale) }),
    },
    records: { text: t("pty16.recordsCount", { n: count(row.total, locale) }), ...(row.raised > 0 ? { detail: t("pty16.raisedCount", { n: count(row.raised, locale) }) } : {}) },
    awaiting: row.awaiting,
  };
}
