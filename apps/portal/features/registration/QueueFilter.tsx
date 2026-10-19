"use client";

import { useRouter } from "next/navigation";
import { Combobox, FilterBar, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** The value of each filter's first option: every queue, every state in review, every premises. */
export const ANY = "all";

interface Choice {
  value: string;
  label: string;
}

/**
 * SCR-REG-09's filter row: queue, state and premises, each a field of the request (the client never filters a page
 * itself). A choice reloads the queue from its first page; a chip names each filter in force and removes it.
 */
export function QueueFilter({
  words,
  queues,
  states,
  premises,
  value,
  summary,
  locale,
}: {
  words: { filters: string; queue: string; state: string; premises: string; anyPremises: string };
  queues: readonly Choice[];
  states: readonly Choice[];
  premises: readonly Choice[];
  value: { queue: string | null; status: string | null; premises: string | null };
  summary: string;
  locale: Locale;
}) {
  const router = useRouter();
  const go = (next: { queue: string | null; status: string | null; premises: string | null }) => router.push(routes.opsRegistration(next));
  const pick = (choice: string) => (choice === ANY || choice === "" ? null : choice);
  const label = (choices: readonly Choice[], chosen: string | null) => choices.find((choice) => choice.value === chosen)?.label ?? chosen ?? "";
  const chips = [
    ...(value.queue !== null ? [{ label: `${words.queue}: ${value.queue}`, onRemove: () => go({ ...value, queue: null }) }] : []),
    ...(value.status !== null ? [{ label: `${words.state}: ${value.status}`, onRemove: () => go({ ...value, status: null }) }] : []),
    ...(value.premises !== null ? [{ label: `${words.premises}: ${label(premises, value.premises)}`, onRemove: () => go({ ...value, premises: null }) }] : []),
  ];
  return (
    <FilterBar
      label={words.filters}
      chips={chips}
      summary={summary}
      active={chips.length > 0}
      onClear={() => go({ queue: null, status: null, premises: null })}
      shortcut="/"
      locale={locale}
    >
      <Select
        label={words.queue}
        name="responsible_queue"
        options={[...queues]}
        value={value.queue ?? ANY}
        onChange={(choice) => go({ ...value, queue: pick(choice) })}
        density="console"
        width="var(--space-96)"
        locale={locale}
      />
      <Select
        label={words.state}
        name="status"
        options={[...states]}
        value={value.status ?? ANY}
        onChange={(choice) => go({ ...value, status: pick(choice) })}
        density="console"
        width="var(--space-60)"
        locale={locale}
      />
      <Combobox
        label={words.premises}
        name="premises_id"
        options={[...premises]}
        {...(value.premises !== null ? { value: value.premises } : {})}
        placeholder={words.anyPremises}
        wrap
        onChange={(choice) => go({ ...value, premises: typeof choice === "string" && choice !== "" ? choice : null })}
        density="console"
        width="var(--space-72)"
        locale={locale}
      />
    </FilterBar>
  );
}
