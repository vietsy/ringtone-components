import { R1_FORMAT } from "@rightone/formatting";
import type { HelpRouteItem } from "@/lib/api/public";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/**
 * A help route as a line of SCR-PUB-12 or SCR-PUB-13: what it is for and where it goes, who answers it, the day
 * it was last confirmed, and, where the authoritative contact stands in for a route still being confirmed, a line
 * that says so. Each page words the purposes its own way (`pub12` or `pub13`, as each board writes them). On a
 * phone the day joins the line of who answers: beside the title it would leave the title a word per line.
 */
export function helpItem(item: HelpRouteItem, page: "pub12" | "pub13", narrow: boolean, t: Translate, locale: Locale) {
  const destination =
    item.destinationKind === "PHONE"
      ? t(`${page}.call`, { line: item.destination })
      : item.destinationKind === "NOTICE"
        ? t("pub.privacyNotice")
        : item.destination;
  const href = hrefOf(item);
  const answerer = typeof item.responsible === "string" ? t(`pub.responsible.${item.responsible}`) : item.responsible.name;
  // A route that needs a sign-in is shown, saying so (FR-PUB-008).
  const who = item.publicAccess ? answerer : `${answerer}, ${t("pub.signInNeeded")}`;
  const date = R1_FORMAT.formatDate(item.confirmedOn, locale) ?? "-";
  return {
    key: `${item.purpose}-${item.destination}`,
    title: t(`${page}.purpose.${item.purpose}`, { destination }),
    ...(narrow ? { detail: t("pub.answeredBy", { who, date }) } : { detail: who, meta: t("pub.confirmedOn", { date }) }),
    ...(href !== null ? { href } : {}),
    ...(item.replacedByAuthoritativeContact ? { message: { text: t("pub.replaced"), severity: "info" as const } } : {}),
  };
}

/**
 * Where a route opens: an email address or a web address as it is written, the published notice at its page; a line
 * is called and a postal address is written to, so neither is a link.
 */
function hrefOf(item: HelpRouteItem): string | null {
  switch (item.destinationKind) {
    case "EMAIL":
      return `mailto:${item.destination}`;
    case "URL":
      return `https://${item.destination}`;
    case "NOTICE":
      return routes.legalDocument("privacy-notice");
    case "PHONE":
    case "POSTAL":
      return null;
  }
}
