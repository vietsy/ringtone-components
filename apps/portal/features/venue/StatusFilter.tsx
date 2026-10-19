"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FilterBar, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** SCR-VEN-06's filter by state: choosing one reloads the list for it, kept in the address for the session. */
export function StatusFilter({
  label,
  field,
  options,
  value,
  hrefFor,
  locale,
}: {
  label: string;
  field: string;
  options: { value: string; label: string }[];
  value: string;
  /** The list's address for each choice, built on the server. */
  hrefFor: Readonly<Record<string, Route>>;
  locale: Locale;
}) {
  const router = useRouter();
  return (
    <FilterBar label={label} locale={locale}>
      <Select
        label={field}
        name="status"
        options={options}
        value={value}
        onChange={(next) => {
          const href = hrefFor[next];
          if (href !== undefined) router.push(href);
        }}
        density="portal"
        width="var(--space-60)"
        locale={locale}
      />
    </FilterBar>
  );
}
