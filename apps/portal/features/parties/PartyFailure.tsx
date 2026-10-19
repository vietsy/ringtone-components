import { ViewState } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { knownRefusal, refusal } from "./copy";

/**
 * A read that failed in place of a page or a panel: a refusal in the family's words with its code - information about
 * the record or the reader's authority, never drawn as an outage - or our error, titled for what did not load, with
 * its trace and the instruction to try again (convention 2).
 */
export function PartyFailure({
  failure,
  screen,
  errorTitle,
  density,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  /** The screen whose own title the refusal takes, where it words one. */
  screen?: string;
  /** What did not load: "The party list did not load." */
  errorTitle: string;
  density: "console" | "portal";
  t: Translate;
  locale: Locale;
}) {
  if (!knownRefusal(failure.code)) {
    return (
      <ViewState
        view="error"
        errorTitle={errorTitle}
        errorText={t("party.errText")}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        density={density}
        locale={locale}
      />
    );
  }
  return <ViewState view="refused" refusal={{ ...refusal(t, failure.code, screen), family: "attention" }} density={density} locale={locale} />;
}
