import { ItemList, Panel } from "@/components/r1";
import type { AuthorityRow } from "@/lib/api/parties";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { authorityWords, partyTranslator } from "./copy";

/** The authorities the party has already granted, beside the grant and amend form; the one being amended is marked. */
export function GrantedAside({ authorities, selected, phone, locale }: { authorities: readonly AuthorityRow[]; selected: string | null; phone: boolean; locale: Locale }) {
  const t = partyTranslator(locale);
  return (
    <Panel as="aside" title={t("pty12.asideTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      <ItemList
        items={authorities.map((row) => ({
          key: row.reference,
          title: row.person,
          href: routes.partyAuthority(row.reference),
          detail: row.premises?.name ?? t("pty11.partyWide"),
          status: authorityWords(row.state, row.from, t, locale),
          ...(row.reference === selected ? { selected: true } : {}),
        }))}
        readOnly
        label={t("pty12.asideTitle")}
        emptyText={t("pty12.asideEmpty")}
        density="portal"
        locale={locale}
      />
    </Panel>
  );
}
