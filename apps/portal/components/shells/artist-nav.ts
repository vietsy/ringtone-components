import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";
import { routes } from "@/lib/routes";
import en from "@/messages/screens/art.en.json";
import vi from "@/messages/screens/art.vi.json";

/** The artist portal's sections that have screens: the artist's engagement, and where their works were used. */
export type ArtistSection = "engagement" | "geography";

const SECTIONS: readonly { key: ArtistSection; icon: string; href: string }[] = [
  { key: "engagement", icon: "hand-heart", href: routes.artistEngagement() },
  { key: "geography", icon: "chart-column", href: routes.artistGeography() },
];

/**
 * The nav of `PortalShell` on every page of the artist portal, with `current` marked and still a link. Only the
 * sections whose screens exist are drawn; the portal's other screens are reserved until their specification opens.
 * Labels come from the artist portal's catalogue (`art.nav.*`); on a phone each item carries its icon.
 */
export function artistNav(current: ArtistSection, frame: Frame, locale: Locale) {
  const t = translator({ vi, en }, locale);
  return SECTIONS.map(({ key, icon, href }) => ({
    label: t(`art.nav.${key}`),
    href,
    ...(key === current ? { current: true } : {}),
    ...(frame === "phone" ? { icon } : {}),
  }));
}
