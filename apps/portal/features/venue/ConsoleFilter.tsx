"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Combobox, FilterBar, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** One field of the filter: its options, each with the address the list opens at when it is chosen. */
export interface FilterField {
  kind: "select" | "combobox";
  label: string;
  name: string;
  value: string | null;
  placeholder?: string;
  width: string;
  options: readonly { value: string; label: string; href: Route }[];
}

/**
 * R1's FilterBar over a console list whose filter is its address (SCR-VEN-12, 17): choosing a value opens the list
 * at that filter, and removing a chip or clearing opens it without, so a reload or a shared link keeps what is shown.
 */
export function ConsoleFilter({
  label,
  fields,
  chips,
  clearHref,
  summary,
  locale,
}: {
  label: string;
  fields: readonly FilterField[];
  chips: readonly { label: string; href: Route }[];
  clearHref: Route;
  summary: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  const go = (field: FilterField, value: string | null) => {
    const option = field.options.find((candidate) => candidate.value === value);
    if (option !== undefined) router.push(option.href);
  };
  return (
    <FilterBar
      label={label}
      shortcut="/"
      chips={chips.map((chip) => ({ label: chip.label, onRemove: () => router.push(chip.href) }))}
      active={chips.length > 0}
      onClear={() => router.push(clearHref)}
      {...(summary !== null ? { summary } : {})}
      locale={locale}
    >
      {fields.map((field) =>
        field.kind === "select" ? (
          <Select
            key={field.name}
            label={field.label}
            name={field.name}
            options={field.options.map(({ value, label: words }) => ({ value, label: words }))}
            {...(field.value !== null ? { value: field.value } : {})}
            onChange={(value) => go(field, value)}
            density="console"
            width={field.width}
            locale={locale}
          />
        ) : (
          <Combobox
            key={field.name}
            wrap
            label={field.label}
            name={field.name}
            options={field.options.map(({ value, label: words }) => ({ value, label: words }))}
            {...(field.value !== null ? { value: field.value } : {})}
            {...(field.placeholder !== undefined ? { placeholder: field.placeholder } : {})}
            onChange={(value) => go(field, typeof value === "string" ? value : null)}
            density="console"
            width={field.width}
            locale={locale}
          />
        ),
      )}
    </FilterBar>
  );
}
