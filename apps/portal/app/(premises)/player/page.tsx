import { EmptyState, PageHeader } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/page.en.json";
import vi from "@/messages/screens/page.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * RESERVED. The premises portal's Player section, until its screens are specified. It keeps the portal's
 * shell and nav, so the Player item every premises page offers opens a page of the portal rather than a bare
 * one, and says plainly that nothing opens here yet.
 */
export default async function PlayerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  const principal = await requirePrincipal();
  const phone = frame === "phone";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("player", frame, locale)}
      {...(principal !== null ? { account: principal.account, context: { premises: principal.party } } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("player.title")} locale={locale} />
        <EmptyState variant="not-started" title={t("reserved.empty")} level={2} density="portal" locale={locale}>
          {t("player.text")}
        </EmptyState>
      </div>
    </PortalShell>
  );
}
