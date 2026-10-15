import { Divider, StatusLine } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

/**
 * Said at the foot of every page while the seams answer from the mock backend, so nobody mistakes its sample
 * premises, people and amounts for records.
 */
export function MockDataNote({ locale }: { locale: Locale }) {
  const t = translator({ vi, en }, locale);
  return (
    <footer>
      <Divider />
      <div style={{ padding: "var(--space-4) var(--space-6)" }}>
        <StatusLine family="info" text={t("mock.data")} locale={locale} />
      </div>
    </footer>
  );
}
