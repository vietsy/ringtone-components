import { ViewState } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { refusalWords } from "./copy";

/**
 * A read that failed, in place of a page's body: a refusal in its family's words with its code (a record the reader
 * may not see, or one that does not exist), or our outage with the trace support can search for. Only the outage
 * carries a trace: a refusal that showed one would invite a call about a decision that was correct.
 */
export function Failure({
  failure,
  errorText,
  prefix,
  density = "console",
  action,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  errorText: string;
  prefix: "plrops" | "iamops";
  density?: "console" | "portal";
  /** The way back a refusal offers. */
  action?: { label: string; href: string };
  t: Translate;
  locale: Locale;
}) {
  if (failure.code !== "INTERNAL_ERROR" && failure.code !== "SERVICE_NOT_CONFIGURED") {
    const words = refusalWords(failure.code, t, prefix);
    return (
      <ViewState
        view="refused"
        refusal={{ code: failure.code, title: words.title, text: words.text, family: "neutral", ...(action !== undefined ? { action } : {}) }}
        density={density}
        level={2}
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      view="error"
      errorText={errorText}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density={density}
      level={2}
      locale={locale}
    />
  );
}
