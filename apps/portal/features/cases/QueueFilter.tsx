"use client";

import { useRouter } from "next/navigation";
import { FilterBar, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** The value of each filter's first option: every state, every type, every owner. */
export const ANY = "any";

interface Choice {
  value: string;
  label: string;
}

type Value = { state: string | null; type: string | null; owner: string | null };

/**
 * SCR-CAS-03's filter row: state, case type and owner, each a field of the request (the client never filters a page
 * itself). A choice reloads the queue from its first page; a chip names each filter in force and removes it.
 */
export function QueueFilter({
  words,
  states,
  types,
  owners,
  value,
  summary,
  locale,
}: {
  words: { filters: string; state: string; type: string; owner: string };
  states: readonly Choice[];
  types: readonly Choice[];
  owners: readonly Choice[];
  value: Value;
  summary: string;
  locale: Locale;
}) {
  const router = useRouter();
  const go = (next: Value) => router.push(routes.opsCases(next));
  const pick = (choice: string) => (choice === ANY || choice === "" ? null : choice);
  const label = (choices: readonly Choice[], chosen: string) => choices.find((choice) => choice.value === chosen)?.label ?? chosen;
  const chips = [
    ...(value.state !== null ? [{ label: `${words.state}: ${label(states, value.state)}`, onRemove: () => go({ ...value, state: null }) }] : []),
    ...(value.type !== null ? [{ label: `${words.type}: ${label(types, value.type)}`, onRemove: () => go({ ...value, type: null }) }] : []),
    ...(value.owner !== null ? [{ label: `${words.owner}: ${label(owners, value.owner)}`, onRemove: () => go({ ...value, owner: null }) }] : []),
  ];
  return (
    <FilterBar
      label={words.filters}
      chips={chips}
      summary={summary}
      active={chips.length > 0}
      onClear={() => go({ state: null, type: null, owner: null })}
      shortcut="/"
      locale={locale}
    >
      <Select label={words.state} name="state" options={[...states]} value={value.state ?? ANY} onChange={(choice) => go({ ...value, state: pick(choice) })} density="console" width="var(--space-64)" locale={locale} />
      <Select label={words.type} name="case_type" options={[...types]} value={value.type ?? ANY} onChange={(choice) => go({ ...value, type: pick(choice) })} density="console" width="var(--space-60)" locale={locale} />
      <Select label={words.owner} name="owner_actor_id" options={[...owners]} value={value.owner ?? ANY} onChange={(choice) => go({ ...value, owner: pick(choice) })} density="console" width="var(--space-64)" locale={locale} />
    </FilterBar>
  );
}
