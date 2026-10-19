import { Banner, Button, ButtonRow, Checkbox, DateField, FilterBar, Panel, Table, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { ActButton } from "@/features/notices/ActButton";
import { preparePolicyAct } from "@/features/notices/console-actions";
import { askedDay, day, moment, periodWords, policyStateValue, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadPolicyVersions, type ConsoleAttempt, type PolicyVersions } from "@/lib/api/notices";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;
type PolicyAttempt = Extract<ConsoleAttempt, { page: "policy" }>;

/**
 * SCR-COM-01 Notice policy versions, the spec's "Notice policy" menu entry: every version, the one in force marked
 * and the others left readable (a superseded version is what last year's notice cites), each opening SCR-COM-02.
 * An operations officer prepares a version for its period, starting from the classes in force where they ask; a
 * business approver finds here the versions waiting for them.
 */
export default async function PolicyVersionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("policy"));
  const params = await searchParams;
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const kept = readForPage<ConsoleAttempt>(params);
  const attempt = kept?.page === "policy" ? kept : null;
  // `as_of`: the version in force on another day than today, as a notice issued that day was governed.
  const asOf = askedDay(params["as-of"]);
  const outcome = view === "loading" ? null : await loadPolicyVersions(staff, view, asOf);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const meta = data === null || data.inForce === null ? null : data.asOf !== null ? t("com01.metaOn", { n: data.inForce, d: day(data.asOf, locale) }) : t("com01.meta", { n: data.inForce });

  return (
    <NoticeFrame
      staff={staff}
      tab="policy"
      keys={failure === null && (data === null || data.versions.length > 0)}
      header={{ title: t("com01.title"), ...(meta !== null ? { meta } : {}) }}
      t={t}
      locale={locale}
    >
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com01.errTitle")} t={t} locale={locale} /> : <Versions data={data} asOf={asOf} staff={staff} attempt={attempt} t={t} locale={locale} />}
    </NoticeFrame>
  );
}

function Versions({ data, asOf, staff, attempt, t, locale }: { data: PolicyVersions | null; asOf: string | null; staff: Staff; attempt: PolicyAttempt | null; t: Translate; locale: Locale }) {
  const approver = holds(staff, "ACT-BIZ-APR");
  const versions = data?.versions ?? [];
  const inForce = versions.find((version) => version.versionNo === data?.inForce) ?? null;
  return (
    <>
      <form action={routes.opsNoticePolicies()}>
        <FilterBar
          label={t("com01.asOfLabel")}
          chips={asOf !== null ? [{ label: t("com01.chipAsOf", { d: day(asOf, locale) }) }] : []}
          active={asOf !== null}
          locale={locale}
        >
          <DateField label={t("com01.fAsOf")} name="as-of" {...(asOf !== null ? { value: asOf } : {})} helper={false} density="console" locale={locale} />
          <Button variant="primary" size="sm" type="submit" loading={data === null} locale={locale}>
            {t("comOps.show")}
          </Button>
          {asOf !== null ? (
            <Button variant="quiet" size="sm" href={routes.opsNoticePolicies()} locale={locale}>
              {t("com01.asOfToday")}
            </Button>
          ) : null}
        </FilterBar>
      </form>
      {data !== null && versions.length > 0 && data.inForce === null ? (
        <Banner family="danger" title={data.asOf !== null ? t("com01.noneOnTitle", { d: day(data.asOf, locale) }) : t("com01.noneTitle")} code="POLICY_NOT_CONFIGURED" density="console" locale={locale}>
          {t("com01.noneText")}
        </Banner>
      ) : null}
      {data !== null && versions.length === 0 ? (
        <ViewState view="empty" empty={{ variant: "governed", title: t("com01.emptyTitle"), text: t("com01.emptyText"), action: false }} level={2} density="console" locale={locale} />
      ) : (
        <Panel title={t("com01.listTitle")} level={2} compact gap="md" density="console" locale={locale}>
          <Table
            columns={[
              { key: "no", label: t("com01.cVersion"), kind: "strong" },
              { key: "period", label: t("com01.cPeriod") },
              { key: "st", label: t("com01.cState"), kind: "status" },
              { key: "classes", label: t("com01.cClasses"), kind: "count" },
              { key: "prepared", label: t("com01.cPrepared"), kind: "stack" },
              { key: "approved", label: t("com01.cApproved"), kind: "stack" },
            ]}
            rows={versions.map((version) => {
              const waiting = version.state === "PREPARED" && version.sentAt !== null;
              return {
                _key: String(version.versionNo),
                _href: routes.opsNoticePolicy(version.versionNo),
                no: t("comOps.version", { n: version.versionNo }),
                period: periodWords(version.effectiveFrom, version.effectiveTo, t, locale),
                st: {
                  ...policyStateValue(version.state, t),
                  ...(waiting
                    ? { detail: approver && version.preparedBy !== staff.account ? t("com01.waitingYou") : t("com01.sentNote", { ts: moment(version.sentAt ?? "", locale) }) }
                    : data !== null && data.asOf !== null && version.versionNo === data.inForce
                      ? { detail: t("com01.inForceOn", { d: day(data.asOf, locale) }) }
                      : {}),
                },
                classes: version.classCount,
                prepared: { text: version.preparedBy, detail: moment(version.preparedAt, locale) },
                approved: version.approvedBy !== null ? { text: version.approvedBy, detail: moment(version.approvedAt ?? "", locale) } : { text: t("com01.notApproved"), muted: true },
              };
            })}
            loading={data === null ? 3 : false}
            density="console"
            rowFocus
            caption={t("com01.listTitle")}
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("com01.openHint")}
          </Text>
        </Panel>
      )}
      {/* A version is prepared from today's list: the classes it restates are the ones in force today. */}
      {data?.canPrepare === true && asOf === null ? <Prepare inForce={inForce} attempt={attempt} t={t} locale={locale} /> : null}
    </>
  );
}

/** Prepare a version: its period, and whether it starts from the classes of the version in force. */
function Prepare({
  inForce,
  attempt,
  t,
  locale,
}: {
  inForce: PolicyVersions["versions"][number] | null;
  attempt: PolicyAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const refusal = attempt?.refusal ?? null;
  const error =
    refusal === null ? null : refusal.code === "PERIOD_INVALID" && refusal.field === "from" ? t("com01.fromMissing") : t(`com.refusal.${refusal.code}.text`, refusal.values);
  const from = attempt !== null ? askedDay(attempt.typed.from) : null;
  const to = attempt !== null ? askedDay(attempt.typed.to) : null;
  return (
    <Panel title={t("com01.prepareTitle")} level={2} gap="lg" density="console" locale={locale}>
      <form action={preparePolicyAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: "var(--container-xl)" }}>
        <DateField
          label={t("com01.fPeriod")}
          helper={t("com01.periodHelp")}
          name="period"
          range
          fromLabel={t("comOps.from")}
          toLabel={t("comOps.to")}
          toPlaceholder={t("comOps.toOpen")}
          {...(from !== null ? { value: from } : {})}
          {...(to !== null ? { to } : {})}
          required
          {...(error !== null ? { error } : {})}
          density="console"
          locale={locale}
        />
        {inForce !== null ? (
          <Checkbox
            label={t("com01.restate", { n: inForce.classCount, v: inForce.versionNo })}
            helper={t("com01.restateHelp")}
            name="restate"
            checked
            density="console"
            locale={locale}
          />
        ) : null}
        <ButtonRow>
          <ActButton variant="primary" size="sm" icon="file-plus" locale={locale}>
            {t("com01.prepare")}
          </ActButton>
        </ButtonRow>
      </form>
    </Panel>
  );
}
