"use client";

import { createContext, useContext, useState, type ComponentProps, type FocusEvent, type ReactNode } from "react";
import { R1_FORMAT } from "@rightone/formatting";
import { FilterBar, Pagination, Select, Table } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { CopyButton } from "./CopyButton";

type Columns = ComponentProps<typeof Table>["columns"];
type Option = { value: string; label: string };

/** The value a filter holds when it filters nothing. */
const ANY = "any";

/** The entry in focus, whose premises reference Copy takes (design/03 SCR-VER-08, Copy the premises reference). */
const Selection = createContext<{ selected: string | null; select: (key: string) => void }>({ selected: null, select: () => undefined });

/** Holds the entry in focus for the entries table and the Copy button, which the page places apart. */
export function EntrySelection({ initial, children }: { initial: string | null; children: ReactNode }) {
  const [selected, select] = useState(initial);
  return <Selection.Provider value={{ selected, select }}>{children}</Selection.Provider>;
}

interface Entry {
  /** The premises reference: the row's key, and what Copy takes. */
  key: string;
  area: string;
  cls: string;
  cells: Record<string, unknown>;
}

interface Props {
  columns: Columns;
  entries: readonly Entry[];
  /** The supply's areas, in its order: the groups the entries are drawn in. */
  areas: readonly string[];
  words: {
    filters: string;
    area: string;
    cls: string;
    areaOptions: readonly Option[];
    classOptions: readonly Option[];
    /** "{n} cơ sở" with `{n}` for the count shown. */
    summary: string;
    pager: string;
    endNote: string;
    pages: string;
    caption: string;
    sortNote: string;
    empty: { title: string; text: string | null };
  };
  loading: number | false;
  locale: Locale;
}

/**
 * SCR-VER-08's entries: grouped by area in the supply's order, filtered by area and class among the rows the page
 * holds (one page of at most 100, design/03), and the entry in focus selected for Copy. A row is selected by
 * moving to it (J, K, a click) or by Enter.
 */
export function EntryList({ columns, entries, areas, words, loading, locale }: Props) {
  const { selected, select } = useContext(Selection);
  const [area, setArea] = useState(ANY);
  const [cls, setCls] = useState(ANY);
  const shown = entries.filter((entry) => (area === ANY || entry.area === area) && (cls === ANY || entry.cls === cls));
  const keys = new Set(shown.map((entry) => entry.key));
  const count = R1_FORMAT.formatCount(shown.length, locale) ?? String(shown.length);
  const rows = areas.flatMap((group, i) => {
    const inGroup = shown.filter((entry) => entry.area === group);
    if (inGroup.length === 0) return [];
    return [
      { _key: `area-${i}`, _group: group, _groupCount: inGroup.length },
      ...inGroup.map((entry) => ({ ...entry.cells, _key: entry.key, ...(entry.key === selected ? { _selected: true } : {}) })),
    ];
  });

  function onFocus(event: FocusEvent<HTMLDivElement>) {
    const row = event.target instanceof Element ? event.target.closest("tr[data-row]") : null;
    const key = row?.getAttribute("data-row") ?? null;
    if (key !== null && keys.has(key)) select(key);
  }

  return (
    <>
      <FilterBar
        {...(loading === false ? { summary: words.summary.replace("{n}", count) } : {})}
        active={area !== ANY || cls !== ANY}
        onClear={() => {
          setArea(ANY);
          setCls(ANY);
        }}
        label={words.filters}
        shortcut="/"
        locale={locale}
      >
        <Select
          label={words.area}
          name="area_key"
          options={[...words.areaOptions]}
          value={area}
          onChange={setArea}
          density="console"
          width="var(--space-56)"
          locale={locale}
        />
        <Select
          label={words.cls}
          name="entry_class"
          options={[...words.classOptions]}
          value={cls}
          onChange={setCls}
          density="console"
          width="var(--space-72)"
          locale={locale}
        />
      </FilterBar>
      <div onFocus={onFocus}>
        <Table
          columns={columns}
          rows={rows}
          loading={loading}
          density="console"
          rowFocus
          onOpen={(row) => {
            if (typeof row._key === "string" && keys.has(row._key)) select(row._key);
          }}
          caption={words.caption}
          sortNote={words.sortNote}
          empty={{ variant: "governed", title: words.empty.title, ...(words.empty.text !== null ? { text: words.empty.text } : {}), action: false }}
          locale={locale}
        />
      </div>
      {shown.length > 0 && (
        <Pagination
          summary={words.pager.replace(/\{n\}/g, count)}
          hasNext={false}
          endNote={words.endNote}
          density="console"
          label={words.pages}
          locale={locale}
        />
      )}
    </>
  );
}

/** SCR-VER-08 Copy the premises reference of the entry in focus; it waits, saying why, until one is selected. */
export function CopySelected({ label, waitingReason, locale }: { label: string; waitingReason: string; locale: Locale }) {
  const { selected } = useContext(Selection);
  return <CopyButton label={label} value={selected} waitingReason={waitingReason} locale={locale} />;
}
