import { Button, ButtonRow, Combobox, EmptyState, PageHeader, Panel, Table, Tabs } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { moment, regOpsTranslator } from "@/features/registration/console-copy";
import { reportingTabs } from "@/features/registration/reporting";
import { loadUseStartRecord, type UseStartRecord } from "@/lib/api/registration-review";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG18_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-REG-18 Premises use-start record. The date a premises began playing music, as first recorded and as
 * corrected since, newest first with the one in force marked; a correction is a new row and the original is never
 * changed. Opened from a case file it reads that application's premises and leads back; from the surface, the
 * reader chooses the premises.
 */
export default async function UseStartRecordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DAT", "ACT-OPS", "ACT-POL-APR");
  const query = await searchParams;
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG18_VIEWS);
  const application = text(query.application);
  const outcome = asked === "loading" ? null : await loadUseStartRecord(staff, text(query.premises_id) ?? text(query.premises), application, reviewViewOf("18", asked));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const fromCase = application !== null;

  return (
    <OpsFrame console="operations" current="reports" staff={staff} searchLabel={t("regops.searchReports")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("regops.reportsArea") }]}
          title={data?.premises !== null && data?.premises !== undefined ? t("reg18.titleOf", { p: data.premises.name }) : t("reg18.title")}
          {...(data !== null && data.premises !== null ? { meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        {!fromCase ? <Tabs tabs={reportingTabs(staff, t)} value="useStarts" label={t("regrep.tabs")} density="console" locale={locale} /> : null}
        {!fromCase && failure === null ? (
          <Panel as="div" locale={locale}>
            <form action={routes.opsUseStarts()} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Combobox
                label={t("reg18.premises")}
                name="premises_id"
                options={(data?.options ?? []).map((option) => ({ value: option.id, label: option.name }))}
                {...(data?.premises !== null && data?.premises !== undefined ? { value: data.premises.id } : {})}
                placeholder={t("reg18.premisesPick")}
                wrap
                required
                density="console"
                width="var(--container-md)"
                locale={locale}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <Button type="submit" variant="primary" size="sm" locale={locale}>
                  {t("reg18.show")}
                </Button>
              </div>
            </form>
          </Panel>
        ) : null}
        {failure !== null ? <ConsoleFailure failure={failure} screen="reg18" t={t} locale={locale} /> : <UseStarts data={data} loading={asked === "loading"} t={t} locale={locale} />}
        <ButtonRow>
          {failure === null || failure.code !== "NOT_AUTHORISED" ? (
            <Button variant="secondary" size="sm" icon="refresh-cw" href={routes.opsUseStarts({ premises: data?.premises?.id ?? null, application })} locale={locale}>
              {t("regops.reload")}
            </Button>
          ) : null}
          {fromCase && application !== null ? (
            <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsApplication(application)} locale={locale}>
              {t("regops.backCase")}
            </Button>
          ) : null}
        </ButtonRow>
      </div>
    </OpsFrame>
  );
}

function meta(data: UseStartRecord, t: Translate, locale: Locale): string {
  const at = moment(data.asOf, locale);
  return data.rows.length === 1 ? t("reg18.metaOne", { at }) : t("reg18.meta", { n: String(data.rows.length), at });
}

function UseStarts({ data, loading, t, locale }: { data: UseStartRecord | null; loading: boolean; t: Translate; locale: Locale }) {
  if (!loading && (data === null || data.premises === null)) {
    return (
      <Panel as="div" density="console" locale={locale}>
        <EmptyState variant="not-started" title={t("reg18.choose")} level={2} density="console" locale={locale} />
      </Panel>
    );
  }
  const rows = data?.rows ?? [];
  return (
    <>
      <Panel title={t("reg18.tableTitle")} level={2} density="console" locale={locale}>
        <Table
          columns={[
            { key: "date", label: t("reg18.cDate"), kind: "date" },
            { key: "state", label: t("reg18.cState"), kind: "status", missing: t("reg18.notInForce") },
            { key: "cls", label: t("reg18.cClass") },
            { key: "source", label: t("reg18.cSource"), kind: "id" },
            { key: "recorded", label: t("reg18.cRecorded"), kind: "date" },
            { key: "corrects", label: t("reg18.cCorrects"), kind: "date", missing: t("reg18.original") },
          ]}
          rows={rows.map((row) => ({
            _key: row.key,
            date: row.date,
            state: row.inForce ? { family: "neutral", label: t("reg18.inForce") } : null,
            cls: t(`reg18.cls.${row.cls}`),
            source: row.source,
            recorded: row.recordedOn,
            corrects: row.corrects,
          }))}
          density="console"
          caption={t("reg18.tableTitle")}
          {...(rows.length > 0 ? { sort: { key: "recorded", dir: "desc" as const }, sortNote: t("reg18.sortNote") } : {})}
          loading={loading ? 2 : false}
          empty={{ variant: "governed", title: t("reg18.emptyTitle"), text: t("reg18.emptyText"), action: false }}
          locale={locale}
        />
      </Panel>
      {rows.length > 0 ? (
        <Panel title={t("reg18.useTitle")} level={2} density="console" locale={locale}>
          <Text size="sm">{t("reg18.use1")}</Text>
          <Text size="sm">{t("reg18.use2")}</Text>
          <Text size="sm">{t("reg18.use3")}</Text>
        </Panel>
      ) : null}
    </>
  );
}
