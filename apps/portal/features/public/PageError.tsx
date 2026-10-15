import type { LoadOutcome } from "@rightone/ui";
import { ViewState } from "@/components/r1";
import type { Locale, Translate } from "@/lib/i18n/translate";

type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;

/**
 * The public web's error state, worded once (PUB convention 2): the page did not load, try again, and the
 * reference support can search for. Any failure a page does not place as a refusal reads as this.
 */
export function PageError({ failure, level = 2, t, locale }: { failure: Failure; level?: 2 | 3; t: Translate; locale: Locale }) {
  return (
    <ViewState
      view="error"
      errorTitle={t("pub.errTitle")}
      errorText={t("pub.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      level={level}
      density="portal"
      locale={locale}
    />
  );
}
