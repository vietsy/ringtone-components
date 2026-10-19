"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { FilterBar } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * R1's FilterBar over a list whose filter is its address (design/03 convention 8): removing a chip or clearing the
 * filters opens the list's address without them, so a reload or a shared link keeps what is shown.
 */
export function ListFilter({
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
