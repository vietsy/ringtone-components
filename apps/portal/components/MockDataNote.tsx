import { Divider, Link, StatusLine } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/**
 * Said at the foot of every page while the seams answer from the mock backend, so nobody mistakes its sample
 * premises, people and amounts for records; with the way back to the seed, since everyone signing in from this
 * browser acts on the same copy of the data.
 */
export function MockDataNote({ locale }: { locale: Locale }) {
  const t = translator({ vi, en }, locale);
  return (
    <footer>
      <Divider />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-4) var(--space-6)" }}>
        <StatusLine family="info" text={t("mock.data")} locale={locale} />
        <Link href={routes.resetData()} label={t("mock.reset")} variant="quiet" size="sm" />
      </div>
    </footer>
  );
}
