import { Banner, PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { PublicShell } from "@/components/shells/PublicShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { savePreferences } from "@/features/notices/actions";
import { comTranslator, one, readerOf } from "@/features/notices/copy";
import { PreferenceForm } from "@/features/notices/PreferenceForm";
import { readForPage } from "@/lib/api/flash";
import { loadNoticePreferences, type NoticePreferences, type PreferencesAttempt } from "@/lib/api/notices";
import { currentPrincipal, currentWorld } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { COM12_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-COM-12 Notice preferences: one row per class of the policy in force, the required ones marked and not
 * switchable, the others on or off. A principal sets their party's; anyone holding a notice's reference sets the
 * preferences of the recipient it was sent to, and nothing here requires an account.
 */
export default async function NoticePreferencesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // No guard turns a reader away: a session or a notice's reference says whose preferences these are.
  const principal = await currentPrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = comTranslator(locale);
  const view = reviewView(params, COM12_VIEWS);
  const notice = one(params.notice);
  const attempt = view === null ? readForPage<PreferencesAttempt>(params) : null;
  const saved = attempt?.page === "preferences" ? attempt : null;
  const key = principal?.sessionId ?? (await currentWorld());
  const outcome = view === "loading" ? null : await loadNoticePreferences(key, readerOf(principal), notice, view);
  const preferences = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const back = notice !== null ? routes.myNotice(notice) : routes.myNotices();

  const body = (
    <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0, maxWidth: phone ? "100%" : "var(--container-2xl)" }}>
      <PageHeader
        {...(principal !== null ? { crumbs: [{ label: t("comMine.crumb"), href: routes.myNotices() }] } : { size: "public" as const })}
        title={t("com12.title")}
        meta={t("com12.meta")}
        locale={locale}
      />
      {saved !== null && saved.saved && saved.refused.length === 0 ? (
        <Banner family="positive" title={t("com12.savedTitle")} live density="portal" locale={locale}>
          {t("com12.savedText")}
        </Banner>
      ) : null}
      {view === "loading" ? (
        <Panel inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={6} density="portal" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? (
        failure.code === "NOTICE_NOT_FOUND" || failure.code === "ROLE_OUT_OF_SCOPE" ? (
          <ViewState
            level={2}
            view="refused"
            refusal={{ code: failure.code, title: t(`com.refusal.${failure.code}.title`), text: t(`com.refusal.${failure.code}.text`), family: "attention" }}
            density="portal"
            locale={locale}
          />
        ) : (
          <ViewState
            level={2}
            view="error"
            errorTitle={t("com12.errTitle")}
            errorText={t("com12.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="portal"
            locale={locale}
          />
        )
      ) : null}
      {preferences !== null ? (
        <Preferences preferences={preferences} refused={saved?.refused ?? []} notice={notice} back={back} phone={phone} t={t} locale={locale} />
      ) : null}
    </div>
  );

  if (principal === null) {
    return (
      <PublicShell fill locale={locale}>
        {body}
      </PublicShell>
    );
  }
  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("notices", frame, locale)} account={principal.account} locale={locale}>
      {body}
    </PortalShell>
  );
}

function Preferences({
  preferences,
  refused,
  notice,
  back,
  phone,
  t,
  locale,
}: {
  preferences: NoticePreferences;
  refused: readonly string[];
  notice: string | null;
  back: string;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  return (
    <Panel inset={phone ? "sm" : "md"} gap="lg" density="portal" locale={locale}>
      <PreferenceForm
        action={savePreferences}
        notice={notice}
        rows={preferences.classes.map((entry) => ({
          classCode: entry.classCode,
          label: t(`com.class.${entry.classCode}`),
          fixed: entry.required ? { mark: t("com12.required"), reason: t("com12.fixed") } : null,
          receiving: entry.receiving,
          error: refused.includes(entry.classCode) ? t("com.refusal.SUPPRESSION_NOT_PERMITTED.text", { class_name: t(`com.class.${entry.classCode}`) }) : null,
        }))}
        copy={{ save: t("com12.save"), saving: t("com12.saving"), unchanged: t("com12.unchanged"), back: t(notice !== null ? "com12.backNotice" : "com12.backList") }}
        back={back}
        phone={phone}
        locale={locale}
      />
      <Text size="sm" tone="secondary" measure="2xl">
        {t(preferences.party !== null ? "com12.note" : "com12.noteAddress")}
      </Text>
    </Panel>
  );
}
