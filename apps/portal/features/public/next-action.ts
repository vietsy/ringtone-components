import type { LocalizedText, NextAction } from "@/lib/api/public";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/**
 * "Việc tiếp theo" of a guidance answer, as a fact's value: the scope guide's approved text for the treatment where
 * the answer carries it (`DR-491`), otherwise the page's own words for it. Registering and applying both start with
 * signing in to RightOne, so those two lead there; "no registration is needed" leads nowhere. The support line is
 * shown by the page itself when the guidance sends the reader to it.
 */
export function nextActionFact(next: NextAction, text: LocalizedText | null, t: Translate, locale: Locale): { value: unknown; kind?: "link" } {
  const words = (key: string) => (text !== null ? text[locale] : t(key));
  switch (next) {
    case "register":
      return { value: { label: words("pub.nextRegister"), href: routes.signIn() }, kind: "link" };
    case "apply":
      return { value: { label: words("pub.nextApply"), href: routes.signIn() }, kind: "link" };
    case "no-registration":
      return { value: words("pub.nextNoRegistration") };
    case "support":
      return { value: t("pub.guidanceText") };
  }
}
