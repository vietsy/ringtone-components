import { FactList, Panel } from "@/components/r1";
import type { HelpRoute } from "@/lib/api/public";
import type { Locale, Translate } from "@/lib/i18n/translate";
import type { LoadOutcome } from "@rightone/ui";
import { PageError } from "./PageError";

/**
 * The support line a public page offers when it cannot guide the reader itself (GUIDANCE_UNAVAILABLE).
 * The line comes from the help route register; when the register cannot be read, the panel says it did not
 * load rather than offering no line.
 */
export function SupportPanel({
  helpRoutes,
  withConfirmed,
  inset,
  t,
  locale,
}: {
  helpRoutes: LoadOutcome<readonly HelpRoute[]>;
  /** SCR-PUB-02 states the day the line was confirmed; SCR-PUB-03 does not. */
  withConfirmed: boolean;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  const line = helpRoutes.data?.find((route) => route.kind === "support_line") ?? null;
  // A register that lists no support line leaves nothing to offer; a failure to read it is said.
  if (line === null && helpRoutes.failure === null) return null;
  return (
    <Panel title={t("pub.supportTitle")} level={2} inset={inset} density="portal" locale={locale}>
      {line !== null ? (
        <FactList
          items={[
            { label: t("pub.fLine"), value: line.value },
            { label: t("pub.fWho"), value: t("pub.who") },
            ...(withConfirmed ? [{ label: t("pub.fConfirmed"), value: line.confirmedOn, kind: "date" as const }] : []),
          ]}
          locale={locale}
        />
      ) : (
        helpRoutes.failure !== null && <PageError failure={helpRoutes.failure} level={3} t={t} locale={locale} />
      )}
    </Panel>
  );
}
