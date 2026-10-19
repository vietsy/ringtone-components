import type {
  MandateRegisterEntry,
  MandateRegisterFilters,
  MandateRegisterSnapshot,
  MandateRegisterSort,
  MandateRegisterSortKey,
  MandateRegisterStatus,
} from "@/lib/api/mandate-register";
import type { Locale, Translate } from "@/lib/i18n/translate";

export const REGISTER_STATUSES: readonly MandateRegisterStatus[] = ["SUBMITTED", "SUSPENDED", "EFFECTIVE", "EXPIRED"];
export const REGISTER_SORT_OPTIONS: readonly MandateRegisterSort[] = [
  { key: "effectiveFrom", direction: "desc" },
  { key: "effectiveFrom", direction: "asc" },
  { key: "grantee", direction: "asc" },
  { key: "grantee", direction: "desc" },
  { key: "status", direction: "asc" },
  { key: "status", direction: "desc" },
];
export const REGISTER_QUERY_KEYS = ["grantee", "kind", "status", "asOf", "sort", "dir"] as const;
export type RegisterQueryKey = (typeof REGISTER_QUERY_KEYS)[number];

export function isRegisterSortKey(value: string): value is MandateRegisterSortKey {
  return value === "grantee" || value === "status" || value === "effectiveFrom";
}

export function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

/** DateField emits only complete valid dates; validate unfinished/invalid text when it loses focus. */
export function isDateFieldText(value: string): boolean {
  const text = value.trim();
  const parts = /^(\d{1,2})\s*[/\s.-]\s*(\d{1,2})\s*[/\s.-]\s*(\d{4})$/.exec(text)
    ?? /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  if (!parts?.[1] || !parts[2] || !parts[3]) return false;
  return isIsoDay(`${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`);
}

/** Unknown/repeated query values cannot introduce an unsupported state or an invalid date. */
export function readRegisterQuery(query: Pick<URLSearchParams, "get" | "getAll">, snapshot: MandateRegisterSnapshot) {
  const single = (key: RegisterQueryKey) => query.getAll(key).length === 1 ? query.get(key) : null;
  const grantee = single("grantee");
  const kind = single("kind");
  const status = single("status");
  const asOf = single("asOf");
  const sort = single("sort");
  const direction = single("dir");
  const filters: MandateRegisterFilters = {
    grantee: snapshot.entries.some((entry) => entry.granteeId === grantee) ? grantee : null,
    kind: kind === "portal" || kind === "organisation" ? kind : null,
    status: REGISTER_STATUSES.find((candidate) => candidate === status) ?? null,
    asOf: asOf !== null && isIsoDay(asOf) ? asOf : snapshot.asOf,
  };
  const sorting: MandateRegisterSort = {
    key: sort !== null && isRegisterSortKey(sort) ? sort : "effectiveFrom",
    direction: direction === "asc" || direction === "desc" ? direction : "desc",
  };
  return { filters, sorting };
}

export function selectRegisterEntries(
  snapshot: MandateRegisterSnapshot,
  filters: MandateRegisterFilters,
  sort: MandateRegisterSort,
  locale: Locale,
  t: Translate,
): MandateRegisterEntry[] {
  // Only one dated snapshot is supplied. Do not claim to reconstruct historical statuses.
  if (filters.asOf !== snapshot.asOf) return [];
  const entries = snapshot.entries.filter((entry) =>
    (filters.grantee === null || entry.granteeId === filters.grantee)
    && (filters.kind === null || entry.kind === filters.kind)
    && (filters.status === null || entry.status === filters.status),
  );
  const compare = new Intl.Collator(locale);
  const value = (entry: MandateRegisterEntry) => sort.key === "grantee" ? entry.grantee[locale]
    : sort.key === "status" ? t(`register.status.${entry.status}`) : entry.effectiveFrom;
  return entries.sort((left, right) => {
    const ordered = compare.compare(value(left), value(right));
    return (sort.direction === "asc" ? ordered : -ordered) || compare.compare(left.id, right.id);
  });
}

/** Work from the latest URL so a filter never drops locale/view/frame or unrelated parameters. */
export function updateRegisterUrl(url: URL, changes: Partial<Record<RegisterQueryKey, string | null>>): string {
  const next = new URL(url);
  for (const key of REGISTER_QUERY_KEYS) {
    const value = changes[key];
    if (value === undefined) continue;
    if (value === null) next.searchParams.delete(key);
    else next.searchParams.set(key, value);
  }
  return `${next.pathname}${next.search}${next.hash}`;
}
