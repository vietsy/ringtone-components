import { Banner, Panel, Table, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { className, count, moment, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { loadUnmetObligations, type UnmetObligations } from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-COM-16 Unmet obligations: the notices this gateway owes and cannot address, with the channels the class
 * permits and how long each has waited. Nothing here resolves anything, and that is correct: the fix is an address
 * in the party record, and the notice then goes with no act on this page (SM-121 transition 11). The events that
 * arrived with nothing to identify them, or about a subject their class is not about, are counted above by the module
 * that sent them; below, the events recorded that raised no notice because no class of the policy in force states
 * them, so an event a family raises with nothing to say it is seen rather than lost.
 */
export default async function UnmetObligationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("unmet"));
  const params = await searchParams;
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const outcome = view === "loading" ? null : await loadUnmetObligations(staff, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <NoticeFrame
      staff={staff}
      tab="unmet"
      keys={failure === null && (data === null || data.rows.length > 0)}
      header={{ title: t("com16.title"), ...(data !== null ? { meta: t("com16.meta", { n: data.rows.length, ts: moment(data.asOf, locale) }) } : {}) }}
      t={t}
      locale={locale}
    >
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com16.errTitle")} t={t} locale={locale} /> : <Unmet data={data} t={t} locale={locale} />}
    </NoticeFrame>
  );
}

function Unmet({ data, t, locale }: { data: UnmetObligations | null; t: Translate; locale: Locale }) {
  return (
    <>
      {(data?.refusedEvents ?? []).map((refused) => (
        <Banner
          key={`${refused.code}-${refused.module}`}
          family="attention"
          title={t(refused.code === "OCCURRENCE_REF_MISSING" ? "com16.refusedTitle" : "com16.subjectTitle", { count: refused.count })}
          code={refused.code}
          density="console"
          locale={locale}
        >
          {`${t("com16.refusedText", { module: refused.module })} ${refused.code === "OCCURRENCE_REF_MISSING" ? t("com.refusal.OCCURRENCE_REF_MISSING.text") : ""}`.trim()}
        </Banner>
      ))}
      {data !== null && data.rows.length === 0 ? (
        <ViewState view="empty" empty={{ variant: "governed", title: t("com16.emptyTitle"), text: t("com16.emptyText"), action: false }} level={2} density="console" locale={locale} />
      ) : (
        <Panel title={t("com16.title")} level={2} compact gap="md" density="console" locale={locale}>
          <Table
            columns={[
              { key: "ref", label: t("com16.cRef"), kind: "id" },
              { key: "cls", label: t("com16.cClass") },
              { key: "who", label: t("com16.cRecipient") },
              { key: "tried", label: t("com16.cTried") },
              { key: "waiting", label: t("com16.cWaiting"), kind: "stack", nowrap: true },
            ]}
            rows={(data?.rows ?? []).map((row) => {
              const recipient = row.recipient ?? t("comOps.raiser");
              return {
                _key: row.reference,
                _href: routes.opsNotices({ notice: row.reference }),
                _message: { severity: "warning", text: t("com.refusal.CONTACT_POINT_ABSENT.text", { recipient: row.recipient ?? t("comOps.raiserIn") }), code: "CONTACT_POINT_ABSENT" },
                ref: row.reference,
                cls: className(row.classCode, t),
                who: recipient,
                tried: row.channels.map((channel) => t(`com.channel.${channel}`)).join(", "),
                waiting: { text: t("comOps.days", { n: count(row.waitingDays, locale) }), detail: moment(row.dueAt, locale) },
              };
            })}
            loading={data === null ? 3 : false}
            density="console"
            rowFocus
            caption={t("com16.title")}
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("com16.foot")}
          </Text>
        </Panel>
      )}
      {data !== null && data.unclassified.length > 0 ? (
        <Panel title={t("com16.unclassifiedTitle")} description={t("com16.unclassifiedText")} level={2} compact gap="md" density="console" locale={locale}>
          <Table
            columns={[
              { key: "module", label: t("com16.cModule"), kind: "id" },
              { key: "event", label: t("com16.cEvent"), kind: "id" },
              { key: "reason", label: t("com16.cReason") },
              { key: "count", label: t("com16.cCount"), kind: "count" },
              { key: "last", label: t("com16.cLast"), kind: "datetime", nowrap: true },
            ]}
            rows={data.unclassified.map((row) => ({
              _key: `${row.reason}-${row.module}-${row.eventKind}`,
              module: row.module,
              event: row.eventKind,
              reason: t(`com16.reason.${row.reason}`),
              count: row.count,
              last: row.lastAt,
            }))}
            density="console"
            caption={t("com16.unclassifiedTitle")}
            locale={locale}
          />
        </Panel>
      ) : null}
    </>
  );
}
