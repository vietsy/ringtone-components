import { Tabs } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/**
 * The engagement workspace of the policy console, as two link tabs: the award rule versions (SCR-ENG-06, with its
 * editor) and the disclosure versions (SCR-ENG-13), each a controlled version of what a point is and earns.
 */
export function PolicyTabs({ current, t, locale }: { current: "rules" | "disclosure"; t: Translate; locale: Locale }) {
  return (
    <Tabs
      tabs={[
        { id: "rules", label: t("engPolicy.rules"), href: routes.policyAwardRules() },
        { id: "disclosure", label: t("engPolicy.disclosure"), href: routes.policyDisclosure() },
      ]}
      value={current}
      label={t("engPolicy.tabs")}
      density="console"
      locale={locale}
    />
  );
}
