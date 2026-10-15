"use client";

import { useState, type ComponentProps } from "react";
import { R1_FORMAT } from "@rightone/formatting";
import { FilterBar, Pagination, Select, Table } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Columns = ComponentProps<typeof Table>["columns"];
type Option = { value: string; label: string };

/** The value a filter holds when it filters nothing. */
const ANY = "any";

interface Row {
  /** The row as the server page builds it: its cells, link and message. */
  cells: Record<string, unknown>;
  kind: string;
  state: string;
}

interface Props {
  columns: Columns;
  rows: readonly Row[];
  /** The filter the page opens with: the read's own, which only a review state sets. */
  initial: { kind: string | null; state: string | null };
  words: {
    filters: string;
    kind: string;
    state: string;
    kinds: readonly Option[];
    states: readonly Option[];
    /** "Trạng thái: {s}", the chip a state filter draws. */
    chipState: string;
    /** "{n} danh sách", with `{n}` for the count shown. */
    pager: string;
    endNote: string;
    pages: string;
    caption: string;
    sortNote: string;
    empty: { title: string };
    filtered: { title: string; text: string };
  };
  loading: number | false;
  locale: Locale;
}

/**
 * SCR-VER-07's supplies with their kind and state filters. The page holds every supply of the authority (one
 * page of at most 25, design/03), so the filters choose among the rows here, as the API's would; only the
 * state filter draws a chip, the one the board words.
 */
export function SupplyList({ columns, rows, initial, words, loading, locale }: Props) {
  const [kind, setKind] = useState(initial.kind ?? ANY);
  const [state, setState] = useState(initial.state ?? ANY);
  const shown = rows.filter((row) => (kind === ANY || row.kind === kind) && (state === ANY || row.state === state));
  const filtered = kind !== ANY || state !== ANY;
  const stateLabel = words.states.find((option) => option.value === state)?.label ?? state;
  const pager = words.pager.replace("{n}", R1_FORMAT.formatCount(shown.length, locale) ?? String(shown.length));
  const clear = () => {
    setKind(ANY);
    setState(ANY);
  };

  return (
    <>
      <FilterBar
        {...(state !== ANY ? { chips: [{ label: words.chipState.replace("{s}", stateLabel), onRemove: () => setState(ANY) }] } : {})}
        {...(loading === false ? { summary: pager } : {})}
        active={filtered}
        onClear={clear}
        label={words.filters}
        shortcut="/"
        locale={locale}
      >
        <Select
          label={words.kind}
          name="f_kind"
          options={[...words.kinds]}
          value={kind}
          onChange={setKind}
          density="console"
          width="var(--space-80)"
          locale={locale}
        />
        <Select
          label={words.state}
          name="f_state"
          options={[...words.states]}
          value={state}
          onChange={setState}
          density="console"
          width="var(--space-48)"
          locale={locale}
        />
      </FilterBar>
      <Table
        columns={columns}
        rows={shown.map((row) => row.cells)}
        loading={loading}
        density="console"
        rowFocus
        caption={words.caption}
        {...(shown.length > 0 ? { sortNote: words.sortNote } : {})}
        empty={
          filtered
            ? { variant: "filtered", title: words.filtered.title, text: words.filtered.text, action: false, onClear: clear }
            : { variant: "not-started", title: words.empty.title, action: false }
        }
        locale={locale}
      />
      {shown.length > 0 && (
        <Pagination summary={pager} hasNext={false} endNote={words.endNote} density="console" label={words.pages} locale={locale} />
      )}
    </>
  );
}
