import type { NextAction } from "@/lib/api/public";
import type { Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/**
 * "Việc tiếp theo" of a guidance answer, as a fact's value. Registering and applying both start with signing in
 * to RightOne, so those two lead there; "no registration is needed" leads nowhere. The support line is shown by
 * the page itself when the guidance has no answer.
 */
export function nextActionFact(next: NextAction, t: Translate): { value: unknown; kind?: "link" } {
  switch (next) {
    case "register":
      return { value: { label: t("pub.nextRegister"), href: routes.signIn() }, kind: "link" };
    case "apply":
      return { value: { label: t("pub.nextApply"), href: routes.signIn() }, kind: "link" };
    case "no-registration":
      return { value: t("pub.nextNoRegistration") };
    case "support":
      return { value: t("pub.guidanceText") };
  }
}
