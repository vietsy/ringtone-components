"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * SCR-CAS-01's I am a. Choosing a group reads its routes again (GET /intake-routes with that group), so the line
 * under the field says whether this way needs an account, and the remedy options are the group's. The page
 * reloads with `?group=`, keeping the subject the reader came with.
 */
export function GroupChoice({
  label,
  options,
  value,
  hrefs,
  density = "portal",
  locale,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  /** The form's address for each group, built by the page from `routes`. */
  hrefs: Readonly<Record<string, string>>;
  /** The public form's, or the console's where the support-line agent records a caller's case. */
  density?: "portal" | "console";
  locale: Locale;
}) {
  const router = useRouter();
  const choose = (group: string) => {
    const href = hrefs[group];
    if (href !== undefined) router.push(href as Route);
  };
  return <Select label={label} name="stakeholder_group" options={options} value={value} onChange={choose} required width="100%" density={density} locale={locale} />;
}
