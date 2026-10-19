import type { LoadOutcome } from "@rightone/ui";
import type { Translate } from "@/lib/i18n/translate";

type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;

/**
 * The refusal of a page another family's source answers (SCR-PUB-08, 09), as the boards draw it. SOURCE_UNAVAILABLE
 * is two answers: a source that offers no reader yet, which retrying will not change (not retryable), says so with
 * nothing older shown; a source that could not be read offers "Thử lại", to this same address. The page's own
 * not-public code (ARTIST_NOT_PUBLIC, TRACK_NOT_PUBLIC) is a neutral sentence. Null for any other failure: the page
 * draws its error state for it.
 */
export function sourceRefusal(failure: Failure, notPublic: { code: string; title: string }, here: string, t: Translate) {
  if (failure.code === "SOURCE_UNAVAILABLE") {
    return failure.retryable
      ? { code: failure.code, title: t("pub.unTitle"), text: t("pub.unText"), family: "info" as const, action: { label: t("pub.retry"), icon: "refresh-cw", href: here } }
      : { code: failure.code, title: t("pub.naTitle"), text: t("pub.naText"), family: "info" as const };
  }
  return failure.code === notPublic.code ? { code: failure.code, title: t(notPublic.title), text: "", family: "neutral" as const } : null;
}
