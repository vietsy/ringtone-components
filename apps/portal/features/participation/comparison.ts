import type { Repertoire, Right, ScopeKey, Territory } from "@/lib/api/participation";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { comparisonLabel, count, listOf, rowPhrase } from "./copy";

/** The registers in their own order, handed down by the page so the browser need not import the seam. */
export interface Registers {
  rights: readonly Right[];
  repertoires: readonly Repertoire[];
  territories: readonly Territory[];
}

export interface ComparisonRow {
  key: string;
  label: string;
  values: { now: string; after: string };
  changed?: boolean;
}

const keyOf = (key: ScopeKey) => `${key.right}-${key.repertoire}-${key.territory}`;

/**
 * SCR-CAT-03's "Scope now and after the amendment": for every right the amendment touches, each combination
 * the scope holds or the amendment adds, represented now and after; the changed ones marked, and named in the
 * summary line. Nothing touched: no rows and no summary of its own, so the comparison says nothing changes.
 */
export function scopeComparison(
  registers: Registers,
  current: readonly ScopeKey[],
  additions: readonly ScopeKey[],
  removals: readonly ScopeKey[],
  t: Translate,
  locale: Locale,
): { rows: ComparisonRow[]; summary: string | null } {
  const now = new Set(current.map(keyOf));
  const added = new Set(additions.map(keyOf));
  const closed = new Set(removals.map(keyOf));
  const touched = new Set([...additions, ...removals].map((key) => key.right));
  const shown: ScopeKey[] = [];
  for (const right of registers.rights) {
    if (!touched.has(right)) continue;
    for (const repertoire of registers.repertoires) {
      for (const territory of registers.territories) {
        const key = { right, repertoire, territory };
        if (now.has(keyOf(key)) || added.has(keyOf(key))) shown.push(key);
      }
    }
  }
  const word = (represented: boolean) => t(represented ? "part03.represented" : "part03.notRepresented");
  const rows = shown.map((key) => {
    const before = now.has(keyOf(key));
    const after = (before && !closed.has(keyOf(key))) || added.has(keyOf(key));
    return { key: keyOf(key), label: comparisonLabel(key, t), values: { now: word(before), after: word(after) }, ...(before !== after ? { changed: true } : {}) };
  });
  const changed = shown.filter((key) => {
    const before = now.has(keyOf(key));
    return before !== ((before && !closed.has(keyOf(key))) || added.has(keyOf(key)));
  });
  if (changed.length === 0) return { rows, summary: null };
  const phrases = listOf(
    changed.map((key) => rowPhrase(key, t)),
    locale,
  );
  return {
    rows,
    summary: changed.length === 1 ? t("part03.cmpSummaryOne", { rows: phrases }) : t("part03.cmpSummaryMany", { count: count(changed.length, locale), rows: phrases }),
  };
}
