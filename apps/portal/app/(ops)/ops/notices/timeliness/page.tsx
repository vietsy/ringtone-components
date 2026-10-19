import { Banner, Button, ButtonRow, FilterBar, Panel, Select, Table } from "@/components/r1";
import { Text } from "@/components/Text";
import { className, day, moment, monthWords, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { loadTimeliness, type Timeliness } from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : null);

/**
 * SCR-COM-15 Notice timeliness position for a calendar month: a row per class with four figures that add to the
 * first - fell due, which is the denominator, then issued before due, after due, and not issued - and a class with
 * nothing due is a row of zeros rather than an absence. A class with one to four notices shows its count with no
 * breakdown (the contract's personal data rule). A month produced again after a late issue says when.
 */
export default async function TimelinessPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("timeliness"));
  const params = await searchParams;
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const outcome = view === "loading" ? null : await loadTimeliness(staff, text(params.period), view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <NoticeFrame
      staff={staff}
      tab="timeliness"
      keys={false}
      header={{
        title: data !== null ? t("com15.title", { period: monthWords(data.period, t) }) : t("comOps.tab.timeliness"),
        ...(data !== null ? { meta: t("com15.meta", { ts: moment(data.asOf, locale) }) } : {}),
      }}
      t={t}
      locale={locale}
    >
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com15.errTitle")} t={t} locale={locale} /> : <Position data={data} t={t} locale={locale} />}
      <ButtonRow>
        <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsNotices()} locale={locale}>
          {t("com15.back")}
        </Button>
      </ButtonRow>
    </NoticeFrame>
  );
}

function Position({ data, t, locale }: { data: Timeliness | null; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const nothingDue = data !== null && rows.every((row) => row.fellDue === 0);
  return (
    <>
      <form action={routes.opsNoticeTimeliness()}>
        <FilterBar label={t("com15.filters")} locale={locale}>
          <Select
            label={t("com15.fPeriod")}
            name="period"
            options={(data?.periods ?? []).map((period) => ({ value: period, label: monthWords(period, t) }))}
            {...(data !== null ? { value: data.period } : {})}
            loading={data === null}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <Button variant="primary" size="sm" type="submit" loading={data === null} locale={locale}>
            {t("comOps.show")}
          </Button>
        </FilterBar>
      </form>
      {data !== null && data.restatedOn !== null ? (
        <Banner family="info" title={t("com15.restatedTitle", { d: day(data.restatedOn, locale) })} density="console" locale={locale}>
          {t("com15.restatedText")}
        </Banner>
      ) : null}
      {nothingDue ? <Banner family="neutral" title={t("com15.emptyTitle")} compact density="console" locale={locale} /> : null}
      <Panel title={t("com15.panel")} level={2} compact gap="md" density="console" locale={locale}>
        <Table
          columns={[
            { key: "cls", label: t("com15.cClass") },
            { key: "due", label: t("com15.cDue"), kind: "count" },
            { key: "before", label: t("com15.cBefore"), kind: "count", missing: t("comOps.small") },
            { key: "after", label: t("com15.cAfter"), kind: "count", missing: t("comOps.small") },
            { key: "not", label: t("com15.cNot"), kind: "count", missing: t("comOps.small") },
          ]}
          rows={rows.map((row) => ({
            _key: row.classCode,
            cls: className(row.classCode, t),
            due: row.fellDue,
            before: row.beforeDue,
            after: row.afterDue,
            not: row.notIssued,
          }))}
          loading={data === null ? 6 : false}
          density="console"
          caption={t("com15.panel")}
          locale={locale}
        />
        <Text size="sm" tone="secondary">
          {t("com15.notIssuedNote")}
        </Text>
        <Text size="sm" tone="secondary">
          {t("com15.smallNote")}
        </Text>
      </Panel>
    </>
  );
}
