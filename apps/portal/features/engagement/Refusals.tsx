import { Banner, ViewState, type Family } from "@/components/r1";
import { Text } from "@/components/Text";
import type { Refusal } from "@/lib/api/engagement";
import type { Locale, Translate } from "@/lib/i18n/translate";
import type { LoadOutcome } from "@rightone/ui";
import { refusalDetail, refusalWords } from "./copy";

type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;
type Density = "console" | "portal";

/** Our outage, as against a refusal the family's catalogue words: only these two are ours. */
const OUTAGES = new Set(["INTERNAL_ERROR", "SERVICE_NOT_CONFIGURED"]);

/**
 * A refused act, drawn where the act was: the catalogue's two halves, the code on its line, and what the response
 * names (the field, the condition, the classes) under them. Never assembled in the page (design/03 convention 3).
 */
export function RefusalBanner({ refusal, family = "attention", t, locale, density }: { refusal: Refusal; family?: Family; t: Translate; locale: Locale; density: Density }) {
  const words = refusalWords(refusal.code, t);
  const detail = refusalDetail(refusal, t, locale);
  return (
    <Banner family={family} title={words.title} code={refusal.code} live density={density} locale={locale}>
      {words.text !== "" ? <Text>{words.text}</Text> : null}
      {detail !== null ? <Text size="sm">{detail}</Text> : null}
    </Banner>
  );
}

/**
 * A read that did not answer: a refusal in its own words, in place of the page's content, or our outage with R1's
 * retry (it reads the page again) and the trace identifier support can search for. One never stands in for the other.
 */
export function LoadFailure({
  failure,
  errTitle,
  errText,
  t,
  locale,
  density,
}: {
  failure: Failure;
  errTitle: string;
  errText: string;
  t: Translate;
  locale: Locale;
  density: Density;
}) {
  if (!OUTAGES.has(failure.code)) {
    const words = refusalWords(failure.code, t);
    return (
      <ViewState
        view="refused"
        refusal={{ code: failure.code, title: words.title, ...(words.text !== "" ? { text: words.text } : {}), family: failure.code === "ROLE_OUT_OF_SCOPE" ? "neutral" : "attention" }}
        level={2}
        density={density}
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={errTitle}
      errorText={errText}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      level={2}
      density={density}
      locale={locale}
    />
  );
}
