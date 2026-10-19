import { FactList, Panel } from "@/components/r1";
import type { Limitation } from "@/lib/api/premises";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { count } from "./premises-copy";

/** FR-PTY-043 on the portal: the route the register was filled by, its last reconciliation, and what that limits. */
export function LimitationFacts({ limitation, phone, t, locale }: { limitation: Limitation; phone: boolean; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("pty19.register")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      <FactList
        items={[
          { label: t("pty06.route"), value: t(`prm.popRoute.${limitation.route}`), note: t(`prm.popRoute.${limitation.route}.note`) },
          limitation.lastCompleted !== null
            ? {
                label: t("pty06.lastRec"),
                value: limitation.lastCompleted,
                kind: "datetime" as const,
                note: limitation.daysSince === 0 ? t("pty06.lastRecToday", { i: String(limitation.intervalDays) }) : t("pty06.lastRecNote", { n: count(limitation.daysSince ?? 0, locale), i: String(limitation.intervalDays) }),
              }
            : { label: t("pty06.lastRec"), value: null, missing: t("pty06.neverRec") },
        ]}
        columns={phone ? 1 : 2}
        density="portal"
        locale={locale}
      />
    </Panel>
  );
}
