import { redirect } from "next/navigation";
import { Button, PageHeader, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { principalCovers } from "@/lib/api/premises";
import type { Principal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";
import { premisesRefusal, premisesTranslator } from "./premises-copy";

/**
 * The premises portal's answer to a premises actor who opens a premises on the console's address: a premises their
 * authority covers opens on their own portal (SCR-PTY-07 there); any other premises is NOT_YOUR_PREMISES, with the way
 * back to their portfolio (SCR-PTY-19, FR-PTY-007). SCR-PTY-10 answers the same.
 */
export async function NotYourPremises({ principal, record, query, screen }: { principal: Principal; record: string; query: Readonly<Record<string, string | string[] | undefined>>; screen: "pty07" | "pty10" }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = premisesTranslator(locale);
  const answer = await principalCovers(principal, record);
  if (answer === "OWN") redirect(routes.portfolioPremises(record));
  const refusal = premisesRefusal(t, answer);
  return (
    <PortalShell fill layout={frame === "phone" ? "phone" : "desktop"} nav={premisesNav("premises", frame, locale)} account={principal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("pty07.crumbPremises"), href: routes.premisesPortfolio() }]} title={t(screen === "pty07" ? "pty07.titleGeneric" : "pty10.titleGeneric")} locale={locale} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
          <ViewState view="refused" refusal={{ ...refusal, family: "attention" }} density="portal" locale={locale} />
          <Button variant="secondary" size="md" href={routes.premisesPortfolio()} fullWidth={frame === "phone"} locale={locale}>
            {t("pty07.myPremises")}
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}
