import { Button, DateField, PageHeader, Select, StatusLine, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { readDate } from "@/features/parties/fields";
import { count, moment, premisesRefusal, premisesTranslator } from "@/features/parties/premises-copy";
import { loadConsoleOverlapReport, type OverlapReport } from "@/lib/api/authorisation";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-PTY-18 on the register data console: the overlap report DA-66 commissions the verification route for. For one
 * premises, every verification read - which collecting organisation asked, about which moment, and what it was told -
 * with how many organisations asked and how many were told another authority exists, which is what double collection
 * looks like. Read only, for the data owner and assurance; reading it records nothing and changes nothing.
 */
export default async function OverlapReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DAT", "ACT-AUD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const premises = one(query.premises) ?? "";
  const from = readDate(one(query.from) ?? "");
  const to = readDate(one(query.to) ?? "");
  const outcome = await loadConsoleOverlapReport(staff, premises, { from, to });
  const data = outcome.data;
  const failure = outcome.failure;

  return (
    <OpsFrame console="registerData" current="overlap" staff={staff} searchLabel={t("prm.searchData")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("prm.crumbData") }]}
          title={data?.premises !== null && data !== null ? data.premises.name : t("pty18c.title")}
          meta={t("pty18c.readOnly")}
          locale={locale}
        />
        {failure !== null && failure.code !== "PREMISES_NOT_FOUND" ? (
          <ViewState view="error" errorTitle={t("pty18c.errTitle")} errorText={t("prm.errText")} {...(failure.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
        ) : (
          <>
            {data !== null ? <Ask data={data} premises={premises} from={from} to={to} t={t} locale={locale} /> : null}
            {failure?.code === "PREMISES_NOT_FOUND" ? (
              <ViewState view="refused" refusal={{ ...premisesRefusal(t, "PREMISES_NOT_FOUND"), family: "attention" }} density="console" locale={locale} />
            ) : data === null || data.premises === null ? (
              <ViewState view="empty" empty={{ variant: "not-started", title: t("pty18c.pickTitle"), text: t("pty18c.pickText") }} density="console" level={2} locale={locale} />
            ) : (
              <Reads data={data} t={t} locale={locale} />
            )}
          </>
        )}
      </div>
    </OpsFrame>
  );
}

function Ask({ data, premises, from, to, t, locale }: { data: OverlapReport; premises: string; from: string | null; to: string | null; t: Translate; locale: Locale }) {
  return (
    <form method="get" action={routes.opsOverlapReport()} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-4)" }}>
      <Select
        label={t("pty18c.fPremises")}
        name="premises"
        options={data.register.map((entry) => ({ value: entry.reference, label: t("pty18c.premisesOption", { name: entry.name, ref: entry.reference }) }))}
        value={premises}
        placeholder={t("pty18c.fPremisesPh")}
        density="console"
        width="var(--space-96)"
        locale={locale}
      />
      <DateField label={t("pty18c.fFrom")} name="from" value={from ?? ""} helper={false} density="console" width="var(--space-48)" locale={locale} />
      <DateField label={t("pty18c.fTo")} name="to" value={to ?? ""} helper={false} density="console" width="var(--space-48)" locale={locale} />
      <Button variant="secondary" size="sm" type="submit" locale={locale}>
        {t("pty18c.show")}
      </Button>
    </form>
  );
}

function Reads({ data, t, locale }: { data: OverlapReport; t: Translate; locale: Locale }) {
  return (
    <>
      {data.rows.length > 0 ? (
        <StatusLine
          family={data.toldAnother > 0 ? "attention" : "info"}
          text={t("pty18c.summary", { n: count(data.organisations, locale), m: count(data.toldAnother, locale) })}
          cutout="surface"
          locale={locale}
        />
      ) : null}
      <Table
        columns={[
          { key: "org", label: t("pty18c.cOrg"), kind: "strong" },
          { key: "asked", label: t("pty18c.cAsked"), kind: "text", nowrap: true },
          { key: "answer", label: t("pty18c.cAnswer"), kind: "status" },
          { key: "read", label: t("pty18c.cRead"), kind: "text", nowrap: true },
        ]}
        rows={data.rows.map((row) => ({
          _key: row.id,
          org: row.organisation.name,
          asked: moment(row.askedAt, locale),
          answer: { family: row.answer === "ANOTHER_AUTHORITY_EXISTS" ? "attention" : row.answer === "EFFECTIVE" ? "positive" : "neutral", label: t(`pty18c.answer.${row.answer}`), plain: true },
          read: moment(row.readAt, locale),
        }))}
        empty={{ variant: "governed", title: t("pty18c.emptyTitle"), text: t("pty18c.emptyText"), action: false }}
        density="console"
        caption={t("pty18c.title")}
        locale={locale}
      />
    </>
  );
}
