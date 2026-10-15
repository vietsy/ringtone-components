import { Banner, ItemList } from "@/components/r1";
import { Text } from "@/components/Text";
import type { MissingItem } from "@/lib/api/registration";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { missingCount, missingFor, missingKey, missingTitle } from "./copy";

/** REQUIRED_ITEMS_MISSING with the items it names, and the way to add them, on SCR-REG-05 and 06. */
export function MissingBanner({ items, reference, t, locale }: { items: readonly MissingItem[]; reference: string; t: Translate; locale: Locale }) {
  return (
    <Banner
      family="attention"
      title={missingCount(items.length, t, locale)}
      code="REQUIRED_ITEMS_MISSING"
      action={{ label: t("reg.missing.add"), href: routes.applicationEvidence(reference), variant: "primary" }}
      density="portal"
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Text>{t("reg.missing.text")}</Text>
        <ItemList
          items={items.map((missing) => ({ key: missingKey(missing), title: missingTitle(missing, t), detail: missingFor(missing, t) }))}
          readOnly
          label={missingCount(items.length, t, locale)}
          density="portal"
          locale={locale}
        />
      </div>
    </Banner>
  );
}
