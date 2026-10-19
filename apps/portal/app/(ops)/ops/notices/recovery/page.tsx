import { Banner, Button, FilterBar, Panel, Table, Toast, ViewState } from "@/components/r1";
import { className, count, day, hoursBetween, moment, noticeStateValue, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadRecoveryQueue, type ConsoleAttempt, type RecoveryQueue } from "@/lib/api/notices";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * SCR-COM-08 Recovery queue: the required notices with no delivered outcome, a depth per class above, deepest and
 * oldest first. There is no "mark as delivered" control and the page says why; a notice whose delivery treatment
 * has given up offers Record a service (SCR-COM-09), which keeps the reader's name with the record. The business
 * approver reads the queue to reach the notices they may close unserved, and each row opens SCR-COM-09 for them.
 */
export default async function RecoveryQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("recovery"));
  const params = await searchParams;
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const classCode = text(params.class);
  const kept = readForPage<ConsoleAttempt>(params);
  const served = kept?.page === "served" ? kept : null;
  const outcome = view === "loading" ? null : await loadRecoveryQueue(staff, classCode, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <NoticeFrame
      staff={staff}
      tab="recovery"
      keys={failure === null && (data === null || data.depths.length > 0)}
      header={{ title: t("com08.title"), ...(data !== null ? { meta: t("com08.meta", { ts: moment(data.asOf, locale) }) } : {}) }}
      t={t}
      locale={locale}
    >
      {served !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t("com08.servedTitle", { ref: served.reference })} locale={locale}>
            {t("com08.servedText", { d: day(served.servedOn, locale) })}
          </Toast>
        </div>
      ) : null}
      <Banner family="info" title={t("com08.whyTitle")} density="console" locale={locale}>
        {t("com08.whyText")}
      </Banner>
      {failure !== null ? (
        <NoticeFailure failure={failure} errTitle={t("com08.errTitle")} t={t} locale={locale} />
      ) : (
        <Recovery data={data} classCode={classCode} operator={holds(staff, "ACT-OPS", "ACT-SUP")} t={t} locale={locale} />
      )}
    </NoticeFrame>
  );
}

function Recovery({ data, classCode, operator, t, locale }: { data: RecoveryQueue | null; classCode: string | null; operator: boolean; t: Translate; locale: Locale }) {
  if (data !== null && data.depths.length === 0) {
    return <ViewState view="empty" empty={{ variant: "governed", title: t("com08.emptyTitle"), text: t("com08.emptyText"), action: false }} level={2} density="console" locale={locale} />;
  }
  const asOf = data?.asOf ?? "";
  const hours = (at: string | null) => (at !== null ? t("com08.oldestValue", { n: count(hoursBetween(at, asOf), locale) }) : t("com08.noFailure"));
  return (
    <>
      <Panel title={t("com08.depthTitle")} level={2} compact gap="md" density="console" locale={locale}>
        <Table
          columns={[
            { key: "cls", label: t("com08.cClass"), kind: "stack" },
            { key: "depth", label: t("com08.cDepth"), kind: "count" },
            { key: "oldest", label: t("com08.cOldest") },
          ]}
          rows={(data?.depths ?? []).map((depth) => ({
            _key: depth.classCode,
            _href: routes.opsNoticeRecovery(depth.classCode),
            ...(depth.classCode === classCode ? { _selected: true } : {}),
            cls: className(depth.classCode, t),
            depth: depth.depth,
            oldest: hours(depth.oldestFailureAt),
          }))}
          loading={data === null ? 2 : false}
          density="console"
          rowFocus
          caption={t("com08.depthTitle")}
          locale={locale}
        />
      </Panel>
      {classCode !== null ? (
        <FilterBar chips={[{ label: t("com08.chipClass", { c: className(classCode, t) }) }]} active label={t("com08.listTitle")} locale={locale}>
          <Button variant="quiet" size="sm" href={routes.opsNoticeRecovery()} locale={locale}>
            {t("com08.allClasses")}
          </Button>
        </FilterBar>
      ) : null}
      <Panel title={t("com08.listTitle")} level={2} compact gap="md" density="console" locale={locale}>
        <Table
          columns={[
            { key: "ref", label: t("com08.cRef"), kind: "id" },
            { key: "cls", label: t("com08.cClass"), minWidth: "var(--space-32)" },
            { key: "st", label: t("com08.cState"), kind: "status" },
            { key: "first", label: t("com08.cFirst"), kind: "stack", nowrap: true },
            { key: "attempts", label: t("com08.cAttempts"), kind: "stack", maxWidth: "var(--space-48)" },
            { key: "act", label: t("com08.cActions"), kind: "actions" },
          ]}
          rows={(data?.rows ?? []).map((row) => ({
            _key: row.reference,
            ref: row.reference,
            cls: className(row.classCode, t),
            st: noticeStateValue(row.state, t),
            first: row.firstFailureAt !== null ? { text: moment(row.firstFailureAt, locale), detail: hours(row.firstFailureAt) } : { text: t("com08.noFailure"), muted: true },
            attempts: { text: count(row.attempts, locale), ...(row.lastResponse !== null ? { detail: t("com08.lastValue", { r: row.lastResponse }) } : {}) },
            act: operator
              ? [
                  { label: t("com08.open"), ariaLabel: t("com08.openLabel", { ref: row.reference }), href: routes.opsNotices({ notice: row.reference }), variant: "quiet" },
                  {
                    label: t("com08.record"),
                    ariaLabel: t("com08.recordLabel", { ref: row.reference }),
                    variant: "secondary",
                    ...(row.exhausted ? { href: routes.opsNoticeService(row.reference) } : { disabled: true, disabledReason: t("com08.running") }),
                  },
                ]
              : [{ label: t("com08.openWithdraw"), ariaLabel: t("com08.openWithdrawLabel", { ref: row.reference }), href: routes.opsNoticeService(row.reference), variant: "secondary" }],
          }))}
          loading={data === null ? 3 : false}
          density="console"
          caption={t("com08.listTitle")}
          locale={locale}
        />
      </Panel>
    </>
  );
}
