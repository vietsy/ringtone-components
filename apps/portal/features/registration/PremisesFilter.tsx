"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

/** The value of the filter's first option, every premises the person acts for. */
export const ALL_PREMISES = "all";

/**
 * SCR-REG-01's premises filter. Choosing a premises reloads the page with `?premises=`, which the server
 * passes to both lists as the request's premises_id; the other query values (a demo view, a frame) stay.
 */
export function PremisesFilter({
  label,
  options,
  value,
  query,
  locale,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  /** The page's other query values, kept across a change of premises. */
  query: Readonly<Record<string, string>>;
  locale: Locale;
}) {
  const router = useRouter();
  const choose = (premises: string) => {
    const next = new URLSearchParams(query);
    if (premises !== ALL_PREMISES) next.set("premises", premises);
    const search = next.toString();
    const list = routes.applications();
    const href: Route = search === "" ? list : `${list}?${search}`;
    router.push(href);
  };
  return <Select label={label} name="premises_id" options={options} value={value} onChange={choose} density="portal" locale={locale} />;
}
