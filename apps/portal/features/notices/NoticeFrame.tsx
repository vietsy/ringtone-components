import type { ComponentProps, ReactNode } from "react";
import { PageHeader, Tabs, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import type { Staff } from "@/lib/api/session";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { noticeTabs, tableKeys, type NoticeTab } from "./console";

type Header = Omit<ComponentProps<typeof PageHeader>, "locale">;

/**
 * Every page of the notice workspace: the operations console with Notices marked in the rail, the page's header, the
 * workspace's tabs the member's roles open (the spec's menu entries Notices and Notice policy, and the screens they
 * lead to), then the page. No board draws this workspace; it is the console pattern of the finished pages.
 */
export function NoticeFrame({
  staff,
  tab,
  header,
  keys = true,
  t,
  locale,
  children,
}: {
  staff: Staff;
  /** The tab the page belongs to: a version belongs to Policy, a run to Track changes. */
  tab: NoticeTab;
  header: Header;
  /** Whether the page's table answers to the row keys. */
  keys?: boolean;
  t: Translate;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <OpsFrame console="operations" current="notices" staff={staff} searchLabel={t("comOps.search")} {...(keys ? { keyMap: tableKeys(t) } : {})} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader {...header} locale={locale} />
        <Tabs tabs={noticeTabs(staff, t)} value={tab} label={t("comOps.tabs")} density="console" locale={locale} />
        {children}
      </div>
    </OpsFrame>
  );
}

/**
 * A read that did not answer: a refusal the family names (a version or a run that does not exist, a role not
 * assigned) in its own words and code, anything else our outage with its trace id.
 */
export function NoticeFailure({
  failure,
  errTitle,
  values = {},
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  errTitle: string;
  /** What the refusal's sentence names: the class asked for. */
  values?: Readonly<Record<string, string>>;
  t: Translate;
  locale: Locale;
}) {
  const refusal = ["ROLE_NOT_ASSIGNED", "POLICY_VERSION_NOT_FOUND", "TRACK_CHANGE_RUN_NOT_FOUND", "NOTICE_NOT_FOUND", "NOTICE_CLASS_UNKNOWN", "POLICY_NOT_CONFIGURED"].includes(failure.code);
  if (refusal) {
    return (
      <ViewState
        view="refused"
        refusal={{
          code: failure.code,
          title: t(`com.refusal.${failure.code}.title`),
          text: t(`com.refusal.${failure.code}.text`, { authority: t("com.serviceOwner"), ...values }),
          family: "attention",
        }}
        level={2}
        density="console"
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={errTitle}
      errorText={t("comOps.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      level={2}
      density="console"
      locale={locale}
    />
  );
}
