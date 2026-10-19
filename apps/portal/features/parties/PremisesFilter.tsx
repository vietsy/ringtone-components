"use client";

import { useRouter } from "next/navigation";
import { Combobox, FilterBar, SearchField, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** The area filter's choice for the whole register. */
const ALL = "all";

/**
 * SCR-PTY-06's filter row: a name or a premises record, the administrative area, and a licensing status. Each is a
 * field of the request, so the register is read again; a chip names each filter in force and removes it. The area
 * is not a chip: the register is always read for an area, or for all of them, and the coverage follows it.
 */
export function PremisesFilter({
  words,
  areas,
  statuses,
  value,
  summary,
  locale,
}: {
  words: { filters: string; search: string; placeholder: string; area: string; allAreas: string; licensing: string; allLicensing: string; chipSearch: string; chipLicensing: string };
  areas: readonly { value: string; label: string; detail: string }[];
  statuses: readonly { value: string; label: string }[];
  value: { area: string; q: string | null; licensing: string | null };
  summary: string;
  locale: Locale;
}) {
  const router = useRouter();
  const go = (next: { area: string; q: string | null; licensing: string | null }) => router.push(routes.opsPremisesRegister(next));
  const statusLabel = statuses.find((status) => status.value === value.licensing)?.label ?? value.licensing ?? "";
  const chips = [
    ...(value.q !== null ? [{ label: words.chipSearch.replace("{q}", value.q), onRemove: () => go({ ...value, q: null }) }] : []),
    ...(value.licensing !== null ? [{ label: words.chipLicensing.replace("{s}", statusLabel), onRemove: () => go({ ...value, licensing: null }) }] : []),
  ];
  return (
    <FilterBar label={words.filters} chips={chips} summary={summary} active={chips.length > 0} onClear={() => go({ ...value, q: null, licensing: null })} locale={locale}>
      <SearchField
        label={words.search}
        placeholder={words.placeholder}
        name="q"
        value={value.q ?? ""}
        onSearch={(typed) => go({ ...value, q: typed.trim() === "" ? null : typed.trim() })}
        shortcut="/"
        density="console"
        width="var(--space-80)"
        locale={locale}
      />
      <Combobox
        label={words.area}
        name="administrative_area"
        options={[{ value: ALL, label: words.allAreas }, ...areas]}
        value={value.area}
        onChange={(choice) => {
          if (typeof choice === "string") go({ ...value, area: choice });
        }}
        wrap
        density="console"
        width="var(--space-64)"
        locale={locale}
      />
      <Select
        label={words.licensing}
        name="licensing_status"
        options={[{ value: ALL, label: words.allLicensing }, ...statuses]}
        value={value.licensing ?? ALL}
        onChange={(choice) => go({ ...value, licensing: choice === ALL ? null : choice })}
        density="console"
        width="var(--space-56)"
        locale={locale}
      />
    </FilterBar>
  );
}
