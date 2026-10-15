import { presentStatus } from "@rightone/ui";
import { StatusBadge as R1StatusBadge } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/**
 * A state from the API, drawn as R1's badge. The family comes from `@rightone/ui`'s mapping, so the five
 * product-specific states keep their deliberate colour; the badge carries its label and the family's
 * shape as well as its tint, so it survives deuteranopia and a photocopied record.
 */
export function StatusBadge({ state, locale }: { state: string; locale: Locale }) {
  const presentation = presentStatus(state);

  if (presentation === null) {
    // An unmapped state is shown as its own code on a neutral badge rather than defaulted to "historical",
    // which would be a claim about the business instead of an admission that nobody mapped it.
    return <R1StatusBadge family="neutral" label={state} locale={locale} />;
  }

  const catalogue = locale === "en" ? en : vi;
  const label = presentation.labelKey in catalogue ? translator({ vi, en }, locale)(presentation.labelKey) : state;

  return <R1StatusBadge family={presentation.family} label={label} locale={locale} />;
}
