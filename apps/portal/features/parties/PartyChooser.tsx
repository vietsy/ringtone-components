"use client";

import { useRouter } from "next/navigation";
import { Combobox, FilterBar } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/**
 * The security console's choice of party: authorities belong to a party, so the console reads one party's at a time,
 * picked by name or record from those that have any. A choice reads the list again.
 */
export function PartyChooser({
  words,
  parties,
  value,
  locale,
}: {
  words: { filters: string; party: string; placeholder: string };
  parties: readonly { record: string; legalName: string }[];
  value: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  return (
    <FilterBar label={words.filters} shortcut="/" locale={locale}>
      <Combobox
        label={words.party}
        name="party"
        options={parties.map((party) => ({ value: party.record, label: party.legalName, detail: party.record }))}
        {...(value !== null ? { value } : {})}
        placeholder={words.placeholder}
        wrap
        onChange={(choice) => {
          if (typeof choice === "string" && choice !== "") router.push(routes.securityPartyAuthorities(choice));
        }}
        density="console"
        width="var(--space-96)"
        locale={locale}
      />
    </FilterBar>
  );
}
