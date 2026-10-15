import { EmptyState, PageHeader } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/screens/page.en.json";
import vi from "@/messages/screens/page.vi.json";

/**
 * A surface whose screens are not specified yet: its name and the plain fact that nothing opens here until
 * the specification is approved. Drawn with the design system so a reserved address looks like the product
 * rather than a bare page.
 */
export async function ReservedPage({ surface }: { surface: "artist" | "ops" }) {
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader title={t(`${surface}.title`)} size="public" locale={locale} />
        <EmptyState variant="not-started" title={t("reserved.empty")} level={2} density="portal" locale={locale}>
          {t("reserved.text")}
        </EmptyState>
      </div>
    </PublicShell>
  );
}
