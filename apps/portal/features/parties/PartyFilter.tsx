"use client";

import { useRouter } from "next/navigation";
import { FilterBar, SearchField, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** The state filter's first option: every state. */
const ANY = "all";

/**
 * SCR-PTY-01's filter row: a name, a party record or a registration number, and a state. Each is a field of the
 * request, so the list is read again from the register; a chip names each filter in force and removes it.
 */
export function PartyFilter({
  words,
  states,
  value,
  summary,
  locale,
}: {
  words: { filters: string; search: string; placeholder: string; state: string; allStates: string; chipSearch: string; chipState: string };
  /** The states, each by its code with the catalogue's words. */
  states: readonly { value: string; label: string }[];
  value: { q: string | null; state: string | null };
  summary: string;
  locale: Locale;
}) {
  const router = useRouter();
  const go = (next: { q: string | null; state: string | null }) => router.push(routes.opsParties(next));
  const chips = [
    ...(value.q !== null ? [{ label: words.chipSearch.replace("{q}", value.q), onRemove: () => go({ ...value, q: null }) }] : []),
    ...(value.state !== null
      ? [{ label: words.chipState.replace("{s}", states.find((state) => state.value === value.state)?.label ?? value.state), onRemove: () => go({ ...value, state: null }) }]
      : []),
  ];
  return (
    <FilterBar label={words.filters} chips={chips} summary={summary} active={chips.length > 0} onClear={() => go({ q: null, state: null })} locale={locale}>
      <SearchField
        label={words.search}
        placeholder={words.placeholder}
        name="q"
        value={value.q ?? ""}
        onSearch={(typed) => go({ ...value, q: typed.trim() === "" ? null : typed.trim() })}
        shortcut="/"
        density="console"
        width="var(--container-md)"
        locale={locale}
      />
      <Select
        label={words.state}
        name="party_state"
        options={[{ value: ANY, label: words.allStates }, ...states]}
        value={value.state ?? ANY}
        onChange={(choice) => go({ ...value, state: choice === ANY ? null : choice })}
        density="console"
        width="var(--space-56)"
        locale={locale}
      />
    </FilterBar>
  );
}
