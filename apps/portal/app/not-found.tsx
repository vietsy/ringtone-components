import { EmptyState, PageHeader } from "@/components/r1";
import { PublicShell } from "@/components/shells/PublicShell";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import en from "@/messages/screens/page.en.json";
import vi from "@/messages/screens/page.vi.json";

/** An address with no page: what happened and the one way on, in the reader's language. */
export default async function NotFound() {
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  return (
    <PublicShell fill locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader title={t("notFound.title")} size="public" locale={locale} />
        <EmptyState
          variant="not-started"
          icon="search"
          title={t("notFound.text")}
          level={2}
          action={{ label: t("notFound.home"), href: routes.home(), icon: "arrow-left", variant: "secondary" }}
          density="portal"
          locale={locale}
        >
          {t("notFound.hint")}
        </EmptyState>
      </div>
    </PublicShell>
  );
}
