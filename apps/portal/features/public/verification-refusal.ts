import type { LoadOutcome } from "@rightone/ui";
import type { Translate } from "@/lib/i18n/translate";
import { rateLimitedText } from "./rate-limited";

type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;

/** The refusals every verification route renders in place of the answer, by the sentence that opens each. */
const TITLES: Readonly<Record<string, string>> = {
  IDENTIFIER_NOT_ACCEPTED: "pub.idTitle",
  VERIFICATION_RATE_LIMITED: "pub.rateTitle",
  ENUMERATION_NOT_PERMITTED: "pub.enumTitle",
};

/**
 * A verification route's refusal as SCR-PUB-05, 06 and 07 draw it, worded from `04-refusal-codes.md`: the sentence,
 * then what to do, which for IDENTIFIER_NOT_ACCEPTED is the hint of the route that refused (`hint`, a catalogue
 * key). Null for a failure that is not one of the three: the page draws its error state for it.
 */
export function verificationRefusal(failure: Failure, retryAfter: string | null, hint: string, t: Translate) {
  const title = TITLES[failure.code];
  if (title === undefined) return null;
  const text =
    failure.code === "VERIFICATION_RATE_LIMITED" ? rateLimitedText(retryAfter, t) : failure.code === "ENUMERATION_NOT_PERMITTED" ? t("pub.enumText") : t(hint);
  return { code: failure.code, title: t(title), text, family: "attention" as const };
}
