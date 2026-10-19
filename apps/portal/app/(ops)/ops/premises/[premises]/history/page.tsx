import { Button, PageHeader, Panel, StatusLine, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { NotYourPremises } from "@/features/parties/NotYourPremises";
import { eventWords, moment, premisesRefusal, premisesTranslator } from "@/features/parties/premises-copy";
import { ShortcutButton } from "@/features/parties/ShortcutButton";
import { loadPremisesHistory, type PremisesHistory } from "@/lib/api/premises";
import { currentPrincipal, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-10 Premises history: everything recorded against a premises, newest first, each row with the party that
 * operated it at the time (FR-PTY-022): the party-then column is never hidden or collapsed, because a history that
 * shows the party now against every row is the defect the requirement exists against. Export downloads it as shown.
 * A principal who opens a premises outside their authority meets NOT_YOUR_PREMISES on the premises portal.
 */
export default async function PremisesHistoryPage({ params, searchParams }: { params: Promise<{ premises: string }>; searchParams: Promise<SearchParams> }) {
  const { premises } = await params;
  const record = decodeURIComponent(premises);
  const query = await searchParams;
  const principal = await currentPrincipal();
  if (principal !== null) return <NotYourPremises principal={principal} record={record} query={query} screen="pty10" />;
  const staff = await requireStaff("ACT-OPS", "ACT-AUD");
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const outcome = asked === "loading" ? null : await loadPremisesHistory(staff, record, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const exportWhy = asked === "loading" ? t("pty10.exportLoading") : failure !== null ? t("pty10.exportError") : null;

  return (
    <OpsFrame console="operations" current="parties" staff={staff} searchLabel={t("party.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("party.crumb"), href: routes.opsParties() },
            { label: t("prm.register"), href: routes.opsPremisesRegister() },
            ...(data !== null ? [{ label: data.name, href: routes.opsPremises(data.record) }] : []),
          ]}
          title={data !== null ? t("pty10.title", { p: data.name }) : t("pty10.titleGeneric")}
          {...(data !== null ? { meta: t("pty10.meta", { r: data.record, ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          {failure?.code === "PREMISES_NOT_FOUND" ? null : exportWhy !== null || data === null ? (
            <Button variant="primary" size="sm" icon="download" disabled {...(exportWhy !== null ? { disabledReason: exportWhy } : {})} locale={locale}>
              {t("pty10.export")}
            </Button>
          ) : (
            <ShortcutButton variant="primary" size="sm" icon="download" shortcut="Alt+X" href={routes.opsPremisesHistoryExport(data.record)} download locale={locale}>
              {t("pty10.export")}
            </ShortcutButton>
          )}
        </PageHeader>
        {failure?.code === "PREMISES_NOT_FOUND" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={{ ...premisesRefusal(t, failure.code), family: "attention" }} density="console" locale={locale} />
            <Button variant="secondary" size="sm" href={routes.opsPremisesRegister()} locale={locale}>
              {t("pty10.back")}
            </Button>
          </div>
        ) : failure !== null ? (
          <ViewState view="error" errorTitle={t("pty10.errTitle")} errorText={t("prm.errText")} {...(failure.traceId !== null ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
        ) : (
          <History data={data} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function History({ data, t, locale }: { data: PremisesHistory | null; t: Translate; locale: Locale }) {
  // A premises nobody has ever operated reads None in Party then, with the reason (SCR-PTY-10's empty view).
  const neverOperated = data !== null && data.rows.every((row) => row.partyThen === null);
  return (
    <Panel title={t("pty10.historyTitle")} level={2} compact locale={locale}>
      <Table
        columns={[
          { key: "at", label: t("pty10.cWhen"), kind: "datetime" },
          { key: "what", label: t("pty10.cWhat"), minWidth: "var(--space-80)" },
          { key: "party", label: t("pty10.cParty"), kind: "stack", minWidth: "var(--space-56)" },
        ]}
        rows={(data?.rows ?? []).map((row) => ({
          _key: row.key,
          at: row.at,
          what: eventWords(row.what, t, locale),
          party: row.partyThen !== null ? { text: row.partyThen.legalName } : { text: t("prm.none"), muted: true, ...(neverOperated ? { detail: t("pty10.neverOp") } : {}) },
        }))}
        loading={data === null ? 6 : false}
        density="console"
        {...(data !== null ? { sortNote: t("pty10.sortNote") } : {})}
        caption={t("pty10.historyTitle")}
        locale={locale}
      />
      {data?.noRefile === true ? <StatusLine family="info" text={t("pty10.noRefile")} cutout="surface" locale={locale} /> : null}
      {data?.onlyAdmission === true ? <StatusLine family="neutral" text={t("pty10.onlyAdmission")} cutout="surface" locale={locale} /> : null}
    </Panel>
  );
}
