import type { ReactNode } from "react";
import { ViewState } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { refusalWords } from "./copy";

/** The refusals a console read can answer with, each said in the family's words in place of the page. */
const READ_REFUSALS = new Set([
  "ROLE_NOT_ASSIGNED",
  "CASE_NOT_FOUND",
  "PROTECTED_MATTER_NO_ACCESS",
  "PROTECTED_MATTER_SUBJECT_EXCLUDED",
  "APPEAL_NOT_FOUND",
  "DECISION_NOT_FOUND",
  "REGISTER_UNKNOWN",
  "CURSOR_INVALID",
]);

/**
 * A console read that failed, in place of the page: a refusal in the family's words with its code (a fact about the
 * record or the reader, never drawn as an outage), or our error with its trace and whether trying again helps
 * (conventions 1 and 2). The error's sentence is the screen's own: what could not be loaded.
 */
export function ConsoleFailure({
  failure,
  errorTitle,
  errorText,
  action,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  errorTitle: string;
  /** "We could not load this case. Reference {trace} - quote it to support." */
  errorText: string;
  /** The way on under a refusal: back to the queue. */
  action?: ReactNode | { label: string; href?: string };
  t: Translate;
  locale: Locale;
}) {
  if (READ_REFUSALS.has(failure.code)) {
    const words = refusalWords(t, failure.code, locale);
    return (
      <ViewState
        view="refused"
        refusal={{ code: words.code, title: words.title, text: words.text, family: "attention", ...(action !== undefined ? { action } : {}) }}
        density="console"
        level={2}
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={errorTitle}
      errorText={errorText}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density="console"
      level={2}
      locale={locale}
    />
  );
}
