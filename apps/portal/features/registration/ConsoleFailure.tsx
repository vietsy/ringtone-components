import { ViewState } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { knownRefusal, refusal } from "./console-copy";

/**
 * A read that failed in place of a console page or panel: a refusal in the family's words with its code (it is
 * information about the record or the reader's authority, never drawn as an outage), or our error with its trace
 * and the instruction to try again (convention 2).
 */
export function ConsoleFailure({
  failure,
  screen,
  level = 2,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  /** The screen whose own title the refusal takes, where it words one. */
  screen?: string;
  level?: 2 | 3;
  t: Translate;
  locale: Locale;
}) {
  if (!knownRefusal(failure.code)) {
    return (
      <ViewState
        view="error"
        errorTitle={t("regops.errTitle")}
        errorText={t("regops.errText")}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        density="console"
        level={level}
        locale={locale}
      />
    );
  }
  return <ViewState view="refused" refusal={{ ...refusal(t, failure.code, screen), family: "attention" }} density="console" level={level} locale={locale} />;
}
