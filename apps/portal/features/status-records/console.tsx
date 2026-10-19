import { Button, Tabs, ViewState } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/**
 * The three lists an officer moves between, as link tabs over SCR-CER-01, 04 and 07 (design/03 convention 11), with
 * the reviews open or proposed and the follow-ups open or overdue counted.
 */
export function CerTabs({
  current,
  counts,
  t,
  locale,
}: {
  current: "records" | "reviews" | "followUps";
  counts: { reviews: number; followUps: number } | null;
  t: Translate;
  locale: Locale;
}) {
  return (
    <Tabs
      tabs={[
        { id: "records", label: t("cer.tabRecords"), href: routes.opsStatusRecords() },
        { id: "reviews", label: t("cer.tabReviews"), href: routes.opsStatusReviews(), ...(counts !== null ? { count: counts.reviews } : {}) },
        { id: "followUps", label: t("cer.tabFollow"), href: routes.opsFollowUps(), ...(counts !== null ? { count: counts.followUps } : {}) },
      ]}
      value={current}
      label={t("cer.tabsLabel")}
      density="console"
      locale={locale}
    />
  );
}

/**
 * A failure that replaces a console page: a refusal in the catalogue's words with its code (a way back, or Try again
 * where retrying can help), or our outage with its trace.
 */
export function ConsoleFailure({
  failure,
  refusals,
  back,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  /** The codes this page draws as a refusal, each with its title key and its sentence key. */
  refusals: Readonly<Record<string, { title: string; text: string; retry?: string }>>;
  back: { label: string; href: string } | null;
  t: Translate;
  locale: Locale;
}) {
  const refusal = refusals[failure.code];
  if (refusal === undefined) {
    return (
      <ViewState
        view="error"
        errorTitle={t("cer.errTitle")}
        errorText={t("cer.errText")}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        density="console"
        level={2}
        locale={locale}
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
      <ViewState
        view="refused"
        refusal={{
          code: failure.code,
          title: t(refusal.title),
          text: t(refusal.text),
          family: "attention",
          ...(refusal.retry !== undefined ? { action: { label: t("cer02.tryAgain"), icon: "refresh-cw", href: refusal.retry } } : {}),
        }}
        density="console"
        level={2}
        locale={locale}
      />
      {back !== null && (
        <Button variant="secondary" size="sm" href={back.href} locale={locale}>
          {back.label}
        </Button>
      )}
    </div>
  );
}
