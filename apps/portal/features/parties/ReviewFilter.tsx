"use client";

import { useRouter } from "next/navigation";
import { FilterBar, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

const ANY = "all";

/** SCR-PTY-04's filter row: the kind of review and its age in whole days, each read again from the queue. */
export function ReviewFilter({
  words,
  kinds,
  ages,
  value,
  summary,
  locale,
}: {
  words: { filters: string; kind: string; allKinds: string; age: string; anyAge: string; chipKind: string; chipAge: string };
  kinds: readonly { value: string; label: string }[];
  ages: readonly { value: string; label: string }[];
  value: { kind: string | null; age: string | null };
  summary: string;
  locale: Locale;
}) {
  const router = useRouter();
  const go = (next: { kind: string | null; age: string | null }) => router.push(routes.opsIdentificationReviews(next));
  const label = (choices: readonly { value: string; label: string }[], chosen: string) => choices.find((choice) => choice.value === chosen)?.label ?? chosen;
  const chips = [
    ...(value.kind !== null ? [{ label: words.chipKind.replace("{k}", label(kinds, value.kind)), onRemove: () => go({ ...value, kind: null }) }] : []),
    ...(value.age !== null ? [{ label: words.chipAge.replace("{a}", label(ages, value.age)), onRemove: () => go({ ...value, age: null }) }] : []),
  ];
  return (
    <FilterBar label={words.filters} chips={chips} summary={summary} active={chips.length > 0} onClear={() => go({ kind: null, age: null })} shortcut="/" locale={locale}>
      <Select
        label={words.kind}
        name="review_kind"
        options={[{ value: ANY, label: words.allKinds }, ...kinds]}
        value={value.kind ?? ANY}
        onChange={(choice) => go({ ...value, kind: choice === ANY ? null : choice })}
        density="console"
        width="var(--space-60)"
        locale={locale}
      />
      <Select
        label={words.age}
        name="age"
        options={[{ value: ANY, label: words.anyAge }, ...ages]}
        value={value.age ?? ANY}
        onChange={(choice) => go({ ...value, age: choice === ANY ? null : choice })}
        density="console"
        width="var(--space-48)"
        locale={locale}
      />
    </FilterBar>
  );
}
