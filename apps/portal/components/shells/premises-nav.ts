import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";
import { routes } from "@/lib/routes";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/** The premises portal's sections, in R1's order. Premises, Cases and Notices open with their families. */
export type PremisesSection = "premises" | "applications" | "payments" | "records" | "player" | "cases" | "notices";

const SECTIONS: readonly { key: PremisesSection; icon: string; href: string | null }[] = [
  { key: "premises", icon: "building-2", href: null },
  { key: "applications", icon: "file-text", href: routes.applications() },
  { key: "payments", icon: "banknote", href: routes.payments() },
  { key: "records", icon: "shield-check", href: routes.statusRecords() },
  { key: "player", icon: "music", href: routes.player() },
  { key: "cases", icon: "scale", href: null },
  { key: "notices", icon: "bell", href: null },
];

/**
 * The nav of `PortalShell` on every premises page, with `current` marked. A section with no screen yet is
 * drawn without a link, as R1's canvas draws it; the labels come from the shared catalogue
 * (`nav.premises.*`), so a screen never spells them itself. On a phone each item carries its icon.
 */
export function premisesNav(current: PremisesSection, frame: Frame, locale: Locale) {
  const t = translator({ vi, en }, locale);
  return SECTIONS.map(({ key, icon, href }) => ({
    label: t(`nav.premises.${key}`),
    ...(href !== null ? { href } : {}),
    ...(key === current ? { current: true } : {}),
    ...(frame === "phone" ? { icon } : {}),
  }));
}
