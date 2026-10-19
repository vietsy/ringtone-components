import { Tabs } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/**
 * The link tabs an operations officer moves between in Parties and premises: the party list, the identification
 * review queue and the premises register, each a page.
 */
export function PartyTabs({ current, openReviews, t, locale }: { current: "parties" | "reviews" | "register"; openReviews: number | null; t: Translate; locale: Locale }) {
  return (
    <Tabs
      tabs={[
        { id: "parties", label: t("party.tab.parties"), href: routes.opsParties() },
        { id: "reviews", label: t("party.tab.reviews"), ...(openReviews !== null ? { count: openReviews } : {}), href: routes.opsIdentificationReviews() },
        { id: "register", label: t("party.tab.register"), href: routes.opsPremisesRegister() },
      ]}
      value={current}
      label={t("party.crumb")}
      density="console"
      locale={locale}
    />
  );
}
