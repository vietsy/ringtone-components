import { Button, PageHeader, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import type { Staff } from "@/lib/api/session";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { partyTranslator } from "./copy";

/**
 * SCR-PTY-12 for the security admin, on the security console: POST /authorities admits the principal alone, so the
 * screen is refused with the design system's not-authorised wording, which names no code of this family (finding F-3),
 * and leads back to the authorities they read.
 */
export function SecurityRefusal({ staff, locale }: { staff: Staff; locale: Locale }) {
  const t = partyTranslator(locale);
  return (
    <OpsFrame console="security" current="authorities" staff={staff} searchLabel={t("party.secSearch")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("party.secArea") }, { label: t("pty11.title"), href: routes.securityPartyAuthorities() }]} title={t("pty12.secTitle")} locale={locale} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
          <ViewState view="refused" refusal={{ code: "NOT_AUTHORISED", title: t("pty12.secRefTitle"), text: t("pty12.secRefText"), family: "attention" }} density="console" locale={locale} />
          <Button variant="secondary" size="sm" href={routes.securityPartyAuthorities()} locale={locale}>
            {t("pty12.secBack")}
          </Button>
        </div>
      </div>
    </OpsFrame>
  );
}
