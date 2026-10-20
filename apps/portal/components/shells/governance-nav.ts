import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/screens/mandate-register.en.json";
import vi from "@/messages/screens/mandate-register.vi.json";

export type GovernanceCurrent = "mandates" | "coverage";

/** The governance console's fixed rail, in the order specified by the GOV boards. */
const WORKSPACES = [
  ["mandates", "key-round"],
  ["coverage", "search"],
  ["rules", "scale"],
  ["appointments", "users"],
  ["separation", "shield-check"],
  ["projectGateway", "route"],
  ["coordination", "layout-dashboard"],
  ["recordDefinitions", "file-check"],
  ["collector", "banknote"],
  ["publicInformation", "file-text"],
  ["technicalStandards", "link"],
  ["reviewAuthority", "eye"],
] as const;

const words = (locale: Locale) => translator({ vi, en }, locale);

export const governanceArea = (locale: Locale): string => words(locale)("register.crumb.governance");

/** The GOV search label is shared by every screen in this console. */
export const governanceSearchLabel = (locale: Locale): string => words(locale)("register.search.label");

/** The fixed GOV rail; only delivered routes navigate, while planned entries explain their unavailability. */
export function governanceRail(current: GovernanceCurrent, locale: Locale, onUnavailable: (label: string) => void) {
  const t = words(locale);
  return WORKSPACES.map(([key, icon]) => ({
    label: t(`register.nav.${key}`),
    icon,
    ...((key === "mandates" || key === "coverage")
      ? { href: key === "mandates" ? "/ops/governance/mandates" : "/ops/governance/coverage", current: key === current }
      : { onClick: () => onUnavailable(t(`register.nav.${key}`)) }),
  }));
}
