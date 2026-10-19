"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FilterBar, SegmentedControl } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * R1's FilterBar over a list whose filter is its address: removing a chip or clearing the filters opens the list's
 * address without them, so a reload or a shared link keeps what is shown. The fields inside belong to the page's GET
 * form.
 */
export function LinkFilter({
  chips,
  clearHref,
  summary,
  label,
  locale,
  children,
}: {
  chips: readonly { label: string; href: Route }[];
  clearHref: Route;
  summary: string | null;
  label: string;
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <FilterBar
      chips={chips.map((chip) => ({ label: chip.label, onRemove: () => router.push(chip.href) }))}
      {...(summary !== null ? { summary } : {})}
      active={chips.length > 0}
      onClear={() => router.push(clearHref)}
      label={label}
      shortcut="/"
      locale={locale}
    >
      {children}
    </FilterBar>
  );
}

/** A choice of one view of a list, each its own address: choosing a segment opens it. */
export function SegmentLinks({
  label,
  options,
  value,
  density,
  locale,
}: {
  label: string;
  options: readonly { value: string; label: string; count: number; href: Route }[];
  value: string;
  density: "console" | "portal";
  locale: Locale;
}) {
  const router = useRouter();
  return (
    <SegmentedControl
      label={label}
      options={options.map((option) => ({ value: option.value, label: option.label, count: option.count }))}
      value={value}
      onChange={(chosen) => {
        const href = options.find((option) => option.value === chosen)?.href;
        if (href !== undefined) router.push(href);
      }}
      density={density}
      locale={locale}
    />
  );
}
