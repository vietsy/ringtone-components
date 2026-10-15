"use client";

import { R1_FORMAT } from "@rightone/formatting";
import { useState } from "react";
import { ChoiceList, Pagination, Table } from "@/components/r1";
import type { OutcomeClass } from "@/lib/api/submissions";
import type { Locale } from "@/lib/i18n/translate";
import { fill } from "./sizes";

/** One record of the list: its class, for the filter and the sort, and its cells as the page built them. */
export interface OutcomeRow {
  index: number;
  outcome: OutcomeClass;
  cells: Record<string, unknown>;
}

/**
 * SCR-CAT-05's records needing action: the outcome filter over the five classes (DR-33), the list sorted by record
 * number, or by outcome when the reader asks, and the end of the list. The filter starts on the four classes that
 * need action, as the board draws it; an accepted record never needs action, so the list holds none.
 *
 * Every record of a submission fits on one page here: the canvas's submission has seven that need action, and
 * the API's cursor (100 a page) is for the fifty thousand a submission may run to.
 */
export function OutcomeTable({
  rows,
  columns,
  filters,
  initial,
  allAccepted,
  copy,
  layout,
  locale,
}: {
  rows: readonly OutcomeRow[];
  columns: { key: string; label: string; kind?: "stack" | "status"; width?: string; sortable?: boolean; detailSize?: "sm" }[];
  filters: readonly { value: OutcomeClass; label: string }[];
  initial: readonly OutcomeClass[];
  /** Every record was accepted: the board's governed empty list. */
  allAccepted: string | null;
  copy: { legend: string; caption: string; sortNote: string; pager: string; endNote: string; pages: string; filteredEmpty: string };
  layout: "table" | "cards";
  locale: Locale;
}) {
  const [shown, setShown] = useState<readonly OutcomeClass[]>(initial);
  const [sort, setSort] = useState<"asc" | "desc" | null>(null);
  // The filter's options come in the classes' order (DR-33), which is also the order an outcome sort follows.
  const order = filters.map((filter) => filter.value);
  const rank = (outcome: OutcomeClass) => order.indexOf(outcome);
  const visible = rows
    .filter((row) => shown.includes(row.outcome))
    .sort((a, b) => (sort === null ? 0 : (rank(a.outcome) - rank(b.outcome)) * (sort === "asc" ? 1 : -1)) || a.index - b.index);
  const pick = (event: unknown) => {
    const target = (event as { target?: { value?: unknown; checked?: unknown } }).target;
    const value = order.find((outcome) => outcome === target?.value);
    if (value === undefined) return;
    setShown((before) => order.filter((outcome) => (outcome === value ? target?.checked === true : before.includes(outcome))));
  };
  const empty =
    allAccepted !== null
      ? { variant: "governed", action: false as const, title: allAccepted }
      : { variant: "filtered", title: copy.filteredEmpty, onClear: () => setShown(initial) };
  return (
    <>
      <ChoiceList
        legend={copy.legend}
        options={filters.map(({ value, label }) => ({ value, label }))}
        value={[...shown]}
        multiple
        layout="chips"
        name="outcome"
        density="portal"
        onChange={pick}
        locale={locale}
      />
      <Table
        layout={layout}
        columns={columns}
        rows={visible.map((row) => row.cells)}
        empty={empty}
        density="org"
        caption={copy.caption}
        {...(sort !== null ? { sort: { key: "outcome", dir: sort } } : visible.length > 0 ? { sortNote: copy.sortNote } : {})}
        onSort={() => setSort((before) => (before === "asc" ? "desc" : "asc"))}
        locale={locale}
      />
      {visible.length > 0 ? (
        <Pagination
          summary={fill(copy.pager, { count: R1_FORMAT.formatCount(visible.length, locale) ?? "" })}
          hasPrev={false}
          hasNext={false}
          endNote={copy.endNote}
          label={copy.pages}
          locale={locale}
        />
      ) : null}
    </>
  );
}
