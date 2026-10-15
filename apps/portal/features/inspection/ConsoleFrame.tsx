import type { ReactNode } from "react";
import { ViewState } from "@/components/r1";
import { ConsoleShell } from "@/components/shells/ConsoleShell";
import type { RefusalCode } from "@/lib/api/inspection";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { refusalOf } from "./words";

/**
 * The inspection console's frame: R1's ConsoleShell with the inspection area, its rail and the signed-in
 * inspector. The rail carries the lists only: "Inspections and records" (SCR-VER-18) and the queue that opens it
 * have no route yet, and a rail entry that leads nowhere is worse than none.
 */
export function ConsoleFrame({
  account,
  keyMap,
  t,
  locale,
  children,
}: {
  /** The inspector signed in; null draws no account. */
  account: string | null;
  /** The page's own keys, joined to the shell's list. */
  keyMap: { keys: string[]; label: string }[];
  t: Translate;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <ConsoleShell
      area={t("console.area")}
      searchLabel={t("console.search")}
      rail={[{ label: t("console.rail.lists"), icon: "file-spreadsheet", href: routes.inspectionLists(), current: true }]}
      {...(account !== null ? { account } : {})}
      keyMap={keyMap}
      fill
      locale={locale}
    >
      {children}
    </ConsoleShell>
  );
}

/** A failure that replaces a console page: a refusal in the family's words with its code, or our error with its trace. */
export function ConsoleFailure({
  failure,
  refusals,
  t,
  locale,
}: {
  failure: { code: string; traceId: string | null; retryable: boolean };
  /** The codes this page draws as a refusal in place of its content. */
  refusals: readonly RefusalCode[];
  t: Translate;
  locale: Locale;
}) {
  const code = refusals.find((known) => known === failure.code);
  if (code !== undefined) {
    return <ViewState view="refused" refusal={{ ...refusalOf(t, code), family: "attention" }} density="console" level={2} locale={locale} />;
  }
  return (
    <ViewState
      view="error"
      errorTitle={t("ver.errTitle")}
      errorText={t("ver.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density="console"
      level={2}
      locale={locale}
    />
  );
}
