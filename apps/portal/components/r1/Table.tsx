"use client";

import type * as React from "react";
import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import type { EmptyStateProps } from "./EmptyState";
import { Icon } from "./Icon";
import { Identifier } from "./Identifier";
import { Toggletip } from "./Toggletip";
import { choiceMark } from "./lib/choice-controls";
import { formatCount } from "./lib/formatting";
import { announce, cx, focusEl, isNil, textOf, useSynced, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import { NUMERIC, renderCell, rowMsg } from "./lib/table";
import type { CellKind, Locale, StatusValue } from "./lib/types";

const NOWRAP: Record<string, number> = {
  id: 1,
  status: 1,
  count: 1,
  money: 1,
  date: 1,
  datetime: 1,
  stamp: 1,
  mono: 1,
  link: 1,
  unavailable: 1,
  actions: 1,
  percent: 1,
  deadline: 1,
  menu: 1,
  period: 1,
};

const KEEP_UNSTRUCK: Record<string, number> = { status: 1, actions: 1, menu: 1, deadline: 1, entries: 1 };

const SKEL_WIDTH: Record<string, number> = {
  id: 70,
  status: 50,
  count: 40,
  money: 55,
  percent: 35,
  date: 60,
  datetime: 75,
  stamp: 55,
  actions: 45,
  menu: 20,
  deadline: 60,
};

const TONES: Record<string, number> = { attention: 1, danger: 1, positive: 1, info: 1 };

// Amounts, counts and percentages align right by their kind; align 'start' keeps one on the left.
function alignEnd(c: Column): boolean {
  return (
    c.align === "end" || (c.align !== "start" && !!(NUMERIC as Partial<Record<string, number>>)[String(c.kind)])
  );
}

const SEV_TONE: Record<string, string> = { error: "danger", warning: "attention", info: "info" };

export type TableProps = {
  columns: {
    key: string;
    label?: React.ReactNode | undefined;
    kind?: CellKind | undefined;
    align?: "start" | "end" | undefined;
    unit?: string | undefined;
    help?: string | undefined;
    sortable?: boolean | undefined;
    width?: number | string | undefined;
    minWidth?: string | undefined;
    maxWidth?: string | undefined;
    /** cut with an ellipsis, the whole value on hover and on keyboard focus; without maxWidth a table cuts it at space-64 (a card at the fact's width) */ truncate?:
      boolean | undefined;
    nowrap?: boolean | undefined;
    num?: boolean | undefined;
    sticky?: boolean | undefined;
    priority?: "high" | "low" | undefined;
    hidden?: boolean | undefined;
    hideOnCards?: boolean | undefined;
    /** sm: a stack cell's detail line at text-sm */ detailSize?: "xs" | "sm" | undefined;
    /** what a screen reader hears for a missing value; a cell may give its own as { missing } */ missing?:
      string | undefined;
    /** date and period columns: the short month, "24 thg 9, 2026" / "24 Sep 2026", for a dense console column */ short?:
      boolean | undefined;
    /** percent columns: a fixed number of decimals, "14,00 %"; without it at most one */ decimals?: number | undefined;
    /** id columns: lg sets the reference at text-lg, for reading aloud over the phone */ size?:
      "sm" | "lg" | undefined;
  }[];
  /** row fields: _key, _href, _checked, _selected, _tone, _message ({severity: 'error' | 'warning' | 'info' | 'neutral', text, code}; neutral is a plain fact with no tint; code is the refusal code, on the line after the sentence as a Banner without a title writes it), _disabled, _disabledReason, _unselectable, _unselectableReason, _busy, _changed, _expanded, _quarantined, _dropped (true, or the reason as a sentence; muted and struck through, the reason on a neutral line under the row) with _droppedReason, _group... */ rows: Record<
    string,
    unknown
  >[];
  density?: "console" | "org" | "portal" | undefined;
  layout?: "table" | "cards" | undefined;
  caption?: string | undefined;
  sort?: { key: string; dir: "asc" | "desc" } | undefined;
  onSort?: ((key: string) => void) | undefined;
  sortNote?: string | undefined;
  selectable?: boolean | undefined;
  selected?: string[] | undefined;
  onSelectionChange?: ((keys: string[], rows: Record<string, unknown>[]) => void) | undefined;
  selectAcross?:
    | { total: number; noun?: string | undefined; selected?: boolean | undefined; onToggle?: (() => void) | undefined }
    | undefined;
  /** one tab stop across the rows: arrows or J and K move, Enter opens, X ticks */ rowFocus?: boolean | undefined;
  onOpen?: ((row: Record<string, unknown>, index: number) => void) | undefined;
  /** columns with priority 'low' wait behind an expander per row, and a line under the table names them ("Đang ẩn: …" / "Hidden: …"). Without expandable, priority does nothing at any width */ expandable?:
    boolean | undefined;
  totals?: { label?: string | undefined; values: Record<string, unknown> } | undefined;
  loading?: boolean | number | undefined;
  loadingMore?: boolean | undefined;
  empty?:
    | {
        variant?: string | undefined;
        title?: string | undefined;
        text?: string | undefined;
        action?: React.ReactNode | false | undefined;
        /** filtered: draws Clear filters */ onClear?: (() => void) | undefined;
        /** the heading level of the empty state (2 to 6, default 3); a page may pass a plain number */
        level?: number | undefined;
      }
    | undefined;
  /** with rows on screen it shows above them */ error?:
    | {
        text?: string | undefined;
        traceId?: string | undefined;
        retryable?: boolean | undefined;
        onRetry?: (() => void) | undefined;
      }
    | undefined;
  maxHeight?: string | undefined;
  stickyFirst?: boolean | undefined;
  rowCount?: number | undefined;
  rowOffset?: number | undefined;
  footer?: React.ReactNode | undefined;
  /** the first cell of each row is its header; it takes the row's tint, hover and state as the other cells do */ rowHeaders?:
    boolean | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  locale?: Locale | undefined;
};

type Column = TableProps["columns"][number];

// A row message: the sentence under the row, its severity and its refusal code.
type RowMessage = {
  severity?: "error" | "warning" | "info" | "neutral" | undefined;
  text: string;
  code?: string | undefined;
};

// The row fields the table reads (TableProps rows); every other key holds a cell value.
type Row = Record<string, unknown> & {
  _key?: string | number | undefined;
  _href?: string | undefined;
  _checked?: boolean | undefined;
  _selected?: boolean | undefined;
  _tone?: string | undefined;
  _message?: RowMessage | undefined;
  _disabled?: boolean | undefined;
  _disabledReason?: string | undefined;
  _unselectable?: boolean | undefined;
  _unselectableReason?: string | undefined;
  _busy?: boolean | undefined;
  _changed?: boolean | undefined;
  _expanded?: boolean | undefined;
  _quarantined?: boolean | undefined;
  _dropped?: boolean | string | undefined;
  _droppedReason?: string | undefined;
  _group?: React.ReactNode;
  _groupCode?: React.ReactNode;
  _groupCount?: number | undefined;
  _groupNote?: React.ReactNode;
};

// The attributes of a header or data cell, as att() extends them. `key` may ride in the object only where it goes
// to createElement; a JSX cell takes its key as its own attribute, because React warns when a spread carries `key`.
type CellAttrs = React.ThHTMLAttributes<HTMLTableCellElement> & { key?: React.Key | undefined };

// Rows of records with typed cells, so amounts align, identifiers copy and a missing value never reads as zero.
// Everything a table in this product needs lives here: sorting, units and definitions in the header, selection
// with its scope, rows that wait behind an expander, row messages, totals, and the loading, empty and error states
// drawn in the table's own shape. layout="cards" is the same table at phone width.
// Selection: rows start ticked from _checked (or the selected keys); the boxes then work, the header box ticks
// or clears every row that can be ticked, and onSelectionChange(keys, rows) reports each change.
// Measured after each render: whether the table scrolls in its container (then the container takes focus and is
// named), which truncated cells are cut (only those take focus), the offsets of the sticky columns, and the
// heading of the panel around it when no caption is given.
export function Table(p: TableProps) {
  const t = tx(p.locale);
  const tid = useUid("r1-tbl");
  const exState = useState<Record<string, boolean>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrolls = useState(false);
  const named = useState<string | null>(null);
  const said = useRef<Record<string, string> | null>(null);
  const measure = useRef<(() => void) | null>(null);
  const SEP = "\u0001";
  function keyOf(r: Row, i: number): string {
    return isNil(r._key) ? "row-" + i : String(r._key);
  }
  const density = p.density || "portal";
  const allCols = (p.columns || []).filter(function (c) {
    return !c.hidden;
  });
  const rows = (p.rows || []) as Row[];
  const selectable = !!p.selectable;
  const expandable = !!p.expandable && p.layout !== "cards";
  const hiddenCols = expandable
    ? allCols.filter(function (c) {
        return c.priority === "low";
      })
    : [];
  const cols = expandable
    ? allCols.filter(function (c) {
        return c.priority !== "low";
      })
    : allCols;
  const span = cols.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);
  const dataRows = rows.filter(function (r) {
    return !r._group;
  });
  const loading = !!p.loading && !dataRows.length;
  const nLoading = p.loading === true ? 5 : p.loading || 0;
  const btnSize = density === "portal" ? "md" : "sm";
  // rowFocus: the rows take one tab stop between them; arrows or J and K move, Enter opens (onOpen, else the row's link),
  // X ticks. Keys are handled on the table itself, and only while a row, not a control inside it, has focus.
  const rowFocus = !!p.rowFocus && p.layout !== "cards";
  const cur = useState<string | null>(null);
  function colStyle(c: Column): React.CSSProperties {
    const s: React.CSSProperties = {};
    if (c.width) s.width = c.width;
    if (c.minWidth) s.minWidth = c.minWidth;
    if (c.maxWidth) s.maxWidth = c.maxWidth;
    return s;
  }
  function nameOf(r: Row, i: number): string {
    const v = r[String(cols[0] && cols[0].key)];
    return typeof v === "string"
      ? v
      : v && typeof v === "object" && typeof (v as { text?: unknown }).text === "string"
        ? (v as { text: string }).text
        : String(i + 1);
  }
  // link: the cell is the row's link. A link holds no other control, so a reference there (kind id) is drawn without
  // its copy button; the record it opens has the reference with its copy button.
  // truncate without maxWidth cuts at space-64 in a table, so the column does not widen to the whole text; on a card
  // the fact's own width cuts it.
  function cell(c: Column, r: Row, i: number, link?: string | boolean): React.ReactNode {
    const v = r[c.key];
    let content: React.ReactNode =
      link && c.kind === "id" && !(v && typeof v === "object") ? (
        <Identifier
          value={v as string | null}
          size={c.size === "lg" ? "lg" : "sm"}
          copy={false}
          locale={p.locale}
        />
      ) : (
        renderCell(c, v, p.locale, density, c.kind === "menu" ? t.table.rowActions + " " + nameOf(r, i) : null)
      );
    const cap = c.maxWidth || (p.layout === "cards" ? null : "var(--space-64)");
    if (c.truncate && typeof v === "string")
      content = (
        <span className="r1-trunc" title={v} style={cap ? { maxWidth: cap } : undefined}>
          {content}
        </span>
      );
    // A dropped row strikes through its values; a state, an action or a deadline keeps its own look.
    if (r._dropped && !KEEP_UNSTRUCK[String(c.kind)]) content = <span className="r1-dropped">{content}</span>;
    return content;
  }
  // _dropped: the row was taken out of the set it belonged to (a line dropped from a distribution, a premises dropped
  // from a batch). It stays in the list, muted and struck through, with its reason on the line under it
  // (_droppedReason, or _dropped itself when it is a sentence) and "dropped" for a screen reader after its first cell.
  function droppedWhy(r: Row): string | undefined {
    return typeof r._dropped === "string" ? r._dropped : r._droppedReason;
  }
  function droppedWords(r: Row) {
    return r._dropped ? <span className="r1-sr">{" (" + t.table.dropped + ")"}</span> : null;
  }
  // The tint: an explicit _tone first, else the message's severity (a message without one is a warning), else held.
  function tone(r: Row): string | null | undefined {
    return TONES[String(r._tone)]
      ? r._tone
      : r._message
        ? SEV_TONE[r._message.severity || "warning"] || null
        : r._quarantined
          ? "attention"
          : null;
  }
  // _disabled: the row cannot be ticked or opened. _unselectable: it cannot be ticked but keeps its link.
  function noTick(r: Row): boolean {
    return !!(r._disabled || r._unselectable);
  }
  function msgOf(r: Row): RowMessage | null {
    return (
      r._message ||
      (r._dropped && droppedWhy(r)
        ? { severity: "neutral", text: droppedWhy(r)! }
        : r._disabled && r._disabledReason
          ? { severity: "info", text: r._disabledReason }
          : r._unselectable && r._unselectableReason
            ? { severity: "info", text: r._unselectableReason }
            : null)
    );
  }
  function stateWords(r: Row) {
    return r._changed ? <span className="r1-row__changed">{t.table.changed}</span> : null;
  }
  // The record open beside the table: the tint and a heavier leading cell, and the words for screen readers.
  function openWords(r: Row) {
    return r._selected ? <span className="r1-sr">{" (" + t.table.open + ")"}</span> : null;
  }
  const keyed = rows
    .map(function (r, i) {
      return { r: r, k: keyOf(r, i) };
    })
    .filter(function (x) {
      return !x.r._group;
    });
  const seed = p.selected
    ? p.selected.join(SEP)
    : keyed
        .filter(function (x) {
          return x.r._checked;
        })
        .map(function (x) {
          return x.k;
        })
        .join(SEP);
  const selSt = useSynced(seed, seed);
  const picked: Record<string, boolean> = {};
  selSt[0].split(SEP).forEach(function (k) {
    if (k) picked[k] = true;
  });
  function isOn(r: Row, i: number): boolean {
    return !!picked[keyOf(r, i)];
  }
  const enabledKeys = keyed
    .filter(function (x) {
      return !noTick(x.r);
    })
    .map(function (x) {
      return x.k;
    });
  const enabled = dataRows.filter(function (r) {
    return !noTick(r);
  });
  const nChecked = enabledKeys.filter(function (k) {
    return picked[k];
  }).length;
  const allChecked = enabledKeys.length > 0 && nChecked === enabledKeys.length;
  function setPicked(keys: string[]) {
    selSt[1](keys.join(SEP));
    if (p.onSelectionChange)
      p.onSelectionChange(
        keys,
        keyed
          .filter(function (x) {
            return keys.indexOf(x.k) >= 0;
          })
          .map(function (x) {
            return x.r;
          }),
      );
  }
  function toggleRow(r: Row, i: number) {
    const k = keyOf(r, i);
    const keys = keyed
      .map(function (x) {
        return x.k;
      })
      .filter(function (x) {
        return x === k ? !picked[k] : picked[x];
      });
    setPicked(keys);
  }
  function toggleAll() {
    setPicked(
      allChecked
        ? keyed
            .filter(function (x) {
              return noTick(x.r) && picked[x.k];
            })
            .map(function (x) {
              return x.k;
            })
        : keyed
            .filter(function (x) {
              return picked[x.k] || !noTick(x.r);
            })
            .map(function (x) {
              return x.k;
            }),
    );
  }
  const stopKey =
    cur[0] !== null &&
    keyed.some(function (x) {
      return x.k === cur[0];
    })
      ? cur[0]
      : keyed[0] && keyed[0].k;
  function onRowKey(e: React.KeyboardEvent<HTMLTableElement>) {
    const tr = e.target as HTMLElement;
    if (!rowFocus || !tr || tr.tagName !== "TR" || !tr.hasAttribute("data-row") || e.ctrlKey || e.metaKey || e.altKey)
      return;
    const list = Array.prototype.slice.call<NodeListOf<HTMLElement>, [], HTMLElement[]>(
      e.currentTarget.querySelectorAll<HTMLElement>("tbody > tr[data-row]"),
    );
    const at = list.indexOf(tr),
      key = e.key;
    let go: HTMLElement | null | undefined = null;
    const hit = keyed.filter(function (x) {
      return x.k === tr.getAttribute("data-row");
    })[0];
    if (key === "ArrowDown" || key === "j" || key === "J") go = list[Math.min(list.length - 1, at + 1)];
    else if (key === "ArrowUp" || key === "k" || key === "K") go = list[Math.max(0, at - 1)];
    else if (key === "Home") go = list[0];
    else if (key === "End") go = list[list.length - 1];
    else if (key === "Enter" && hit) {
      e.preventDefault();
      if (p.onOpen) p.onOpen(hit.r, rows.indexOf(hit.r));
      else {
        const link = tr.querySelector<HTMLElement>("a.r1-rowlink");
        if (link) link.click();
      }
      return;
    } else if ((key === "x" || key === "X") && selectable && hit && !noTick(hit.r)) {
      e.preventDefault();
      toggleRow(hit.r, rows.indexOf(hit.r));
      return;
    }
    if (go) {
      e.preventDefault();
      focusEl(go);
    }
  }
  function rowOpen(r: Row, i: number) {
    const k = keyOf(r, i);
    return isNil(exState[0][k]) ? !!r._expanded : exState[0][k];
  }
  // The name: the caption, else the heading of the panel the table sits in, else the column names.
  const caption = p.caption || null;
  const labelledBy = !caption && named[0] ? named[0] : null;
  const derived =
    !caption && !labelledBy
      ? t.table.captionFrom.replace(
          "{cols}",
          allCols
            .map(function (c) {
              return typeof c.label === "string" ? c.label : "";
            })
            .filter(Boolean)
            .join(", "),
        )
      : null;
  measure.current = function () {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const over =
      p.layout !== "cards" &&
      (wrap.scrollWidth > wrap.clientWidth + 1 || (!!p.maxHeight && wrap.scrollHeight > wrap.clientHeight + 1));
    if (over !== scrolls[0]) scrolls[1](over);
    if (!p.caption && !named[0] && wrap.parentElement) {
      const host = wrap.parentElement.closest("[aria-labelledby]");
      const hid = host && host.getAttribute("aria-labelledby");
      if (hid && document.getElementById(hid)) named[1](hid);
    }
    Array.prototype.forEach.call(wrap.querySelectorAll(".r1-trunc"), function (el: Element) {
      if (el === document.activeElement) return;
      if (el.scrollWidth > el.clientWidth + 1) el.setAttribute("tabindex", "0");
      else el.removeAttribute("tabindex");
    });
    if (p.stickyFirst) {
      let left = 0;
      const at: Record<string, number> = {};
      Array.prototype.forEach.call(
        wrap.querySelectorAll("thead > tr:first-child > [data-sticky]"),
        function (th: Element) {
          at[th.getAttribute("data-sticky")!] = left;
          left += th.getBoundingClientRect().width;
        },
      );
      Array.prototype.forEach.call(wrap.querySelectorAll<HTMLElement>("[data-sticky]"), function (el: HTMLElement) {
        el.style.left = (at[el.getAttribute("data-sticky")!] || 0) + "px";
      });
    }
  };
  useLayoutEffect(function () {
    measure.current!();
  });
  useEffect(function () {
    const wrap = wrapRef.current;
    if (typeof ResizeObserver === "undefined" || !wrap) return undefined;
    const ro = new ResizeObserver(function () {
      if (measure.current) measure.current();
    });
    ro.observe(wrap);
    if (wrap.firstElementChild) ro.observe(wrap.querySelector("table") || wrap.firstElementChild);
    return function () {
      ro.disconnect();
    };
  }, []);
  // Row messages: the ones present when the table loads are read with their rows; a new or changed one is said once.
  useEffect(function () {
    const now: Record<string, RowMessage> = {},
      fresh: string[] = [];
    let urgent = false;
    rows.forEach(function (r, i) {
      if (r._group) return;
      const m = msgOf(r);
      if (m) now[keyOf(r, i)] = m;
    });
    const before = said.current;
    said.current = {};
    Object.keys(now).forEach(function (k) {
      const txt = textOf(now[k]!.text);
      said.current![k] = txt;
      if (before && before[k] !== txt) {
        fresh.push(txt);
        if (now[k]!.severity === "error") urgent = true;
      }
    });
    if (fresh.length) announce(fresh.join(" "), urgent ? "assertive" : "polite");
  });
  const foot = p.footer ? <div className="r1-table__foot">{p.footer}</div> : null;
  const err = p.error || null;
  // A load that failed while rows are shown keeps the rows and says so above them, with the way to try again.
  const errorBar =
    err && dataRows.length ? (
      <div className="r1-table__error">
        <Banner
          family="danger"
          compact={true}
          title={t.couldNotLoad}
          locale={p.locale}
          actions={
            err.retryable === false ? null : (
              <Button icon="refresh-cw" size={btnSize} onClick={err.onRetry} locale={p.locale}>
                {t.retry}
              </Button>
            )
          }
        >
          {err.text ? <span>{err.text + " "}</span> : null}
          {err.retryable === false ? <span>{t.retryNoHelp + " "}</span> : null}
          {err.traceId ? (
            <span className="r1-table__trace">
              {t.traceRef + " "}
              <Identifier value={err.traceId} size="sm" locale={p.locale} />
              {", " + t.quoteSupport}
            </span>
          ) : null}
        </Banner>
      </div>
    ) : null;
  // Empty: nothing yet unless the page says why. A list emptied by filters offers Clear filters only when it can act.
  const em: NonNullable<TableProps["empty"]> = p.empty || {};
  const emVariant = em.variant || "not-started";
  const emAction =
    em.action === false ? (
      false
    ) : em.action ? (
      em.action
    ) : emVariant === "filtered" && em.onClear ? (
      <Button variant="quiet" icon="x" size={btnSize} onClick={em.onClear} locale={p.locale}>
        {t.empty.clearFilters}
      </Button>
    ) : (
      false
    );
  const emTitle =
    em.title || (emVariant === "filtered" ? t.table.noRows : emVariant === "not-started" ? t.table.none : undefined);
  const stateBlock =
    !dataRows.length && !loading ? (
      err ? (
        <EmptyState
          variant="error"
          traceId={err.traceId}
          retryable={err.retryable}
          onRetry={err.onRetry}
          density={density}
          locale={p.locale}
        >
          {err.text}
        </EmptyState>
      ) : (
        <EmptyState
          variant={emVariant as EmptyStateProps["variant"]}
          title={emTitle}
          action={emAction}
          level={em.level as EmptyStateProps["level"]}
          locale={p.locale}
        >
          {em.text}
        </EmptyState>
      )
    ) : null;
  if (p.layout === "cards") {
    const titleCol = allCols[0];
    const statusCol = allCols.filter(function (c) {
      return c.kind === "status";
    })[0];
    const actionCol = allCols.filter(function (c) {
      return c.kind === "actions" || c.kind === "menu";
    })[0];
    const factCols = allCols.slice(1).filter(function (c) {
      return c !== statusCol && c !== actionCol && !c.hideOnCards;
    });
    const skel: React.ReactElement[] = [];
    for (let s = 0; s < nLoading; s++)
      skel.push(
        <li key={"s" + s} className="r1-card r1-card--skel" aria-hidden="true">
          <span className="r1-skel" style={{ width: "60%" }} />
          <span className="r1-skel" style={{ width: "40%" }} />
          <span className="r1-skel" style={{ width: "80%" }} />
        </li>,
      );
    return (
      <div
        ref={wrapRef}
        className={cx("r1-cards", "r1-cards--" + density, p.className)}
        style={p.style}
        aria-busy={loading ? "true" : undefined}
      >
        {caption || derived ? <p className="r1-sr">{caption || derived}</p> : null}
        {loading ? (
          <span className="r1-sr" role="status">
            {t.loading}
          </span>
        ) : null}
        {errorBar}
        {stateBlock ? <div className="r1-cards__state">{stateBlock}</div> : null}
        <ul className="r1-cards__list" aria-label={caption || undefined} aria-labelledby={labelledBy || undefined}>
          {loading
            ? skel
            : rows
                .map(function (r, i) {
                  if (r._group)
                    return (
                      <li key={r._key || "g" + i} className="r1-cards__group">
                        {r._groupCode ? <span className="r1-mono r1-table__groupcode">{r._groupCode}</span> : null}
                        {r._group}
                        {!isNil(r._groupCount) ? (
                          <span className="r1-cards__groupnote r1-num">{formatCount(r._groupCount, p.locale)}</span>
                        ) : null}
                        {r._groupNote ? <span className="r1-cards__groupnote">{r._groupNote}</span> : null}
                      </li>
                    );
                  const title = cell(titleCol!, r, i, !!r._href);
                  const m = msgOf(r);
                  const tn = tone(r);
                  return (
                    <li
                      key={keyOf(r, i)}
                      className={cx(
                        "r1-card",
                        r._selected && "r1-card--selected",
                        isOn(r, i) && "r1-card--checked",
                        tn && "r1-card--" + tn,
                        r._disabled && "r1-card--disabled",
                        r._changed && "r1-card--changed",
                        r._dropped && "r1-card--dropped",
                      )}
                      aria-busy={r._busy ? "true" : undefined}
                      aria-current={r._selected ? "true" : undefined}
                    >
                      <div className="r1-card__head">
                        {selectable ? (
                          <label className="r1-choice r1-choice--bare r1-card__check">
                            {choiceMark("checkbox", {
                              checked: isOn(r, i),
                              onChange: function () {
                                toggleRow(r, i);
                              },
                              disabled: noTick(r),
                              "aria-label": t.selectRow + " " + nameOf(r, i),
                            })}
                          </label>
                        ) : null}
                        <div className="r1-card__main">
                          <span className={cx("r1-card__title", titleCol!.kind === "id" && "r1-card__title--id")}>
                            {r._busy ? <Icon name="loader-circle" size={16} spin={true} label={t.loading} /> : null}
                            {r._href ? (
                              <a className="r1-link r1-rowlink" href={r._href}>
                                {title}
                              </a>
                            ) : (
                              title
                            )}
                            {stateWords(r)}
                            {openWords(r)}
                            {droppedWords(r)}
                          </span>
                          {statusCol ? (
                            <span
                              className={cx(
                                "r1-card__status",
                                (r[statusCol.key] as StatusValue | null | undefined) &&
                                  (r[statusCol.key] as StatusValue).detail &&
                                  "r1-card__status--below",
                              )}
                            >
                              {cell(statusCol, r, i)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {factCols.length ? (
                        <dl className="r1-card__facts">
                          {factCols.map(function (c) {
                            return (
                              <div key={c.key} className="r1-card__fact">
                                <dt>
                                  {c.label}
                                  {c.unit ? " (" + c.unit + ")" : ""}
                                </dt>
                                <dd
                                  className={cx(
                                    ((NUMERIC as Partial<Record<string, number>>)[String(c.kind)] || c.num) && "r1-num",
                                  )}
                                >
                                  {cell(c, r, i)}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      ) : null}
                      {m ? rowMsg(m.severity || "warning", m.text, undefined, m.code, p.locale) : null}
                      {actionCol && r[actionCol.key] ? (
                        <div className="r1-card__actions">
                          {renderCell(
                            actionCol,
                            r[actionCol.key],
                            p.locale,
                            density === "portal" ? "touch" : density,
                            t.table.rowActions + " " + nameOf(r, i),
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })
                .concat(
                  p.totals && !loading
                    ? [
                        <li key="__total" className="r1-card r1-card--total">
                          <span className="r1-card__title">{p.totals.label || t.table.total}</span>
                          <dl className="r1-card__facts">
                            {allCols
                              .filter(function (c) {
                                return !isNil((p.totals!.values || {})[c.key]);
                              })
                              .map(function (c) {
                                return (
                                  <div key={c.key} className="r1-card__fact">
                                    <dt>{c.label}</dt>
                                    <dd className="r1-num">
                                      {renderCell(c, p.totals!.values[c.key], p.locale, density)}
                                    </dd>
                                  </div>
                                );
                              })}
                          </dl>
                        </li>,
                      ]
                    : [],
                )}
        </ul>
        {p.loadingMore ? (
          <p className="r1-table__more" role="status">
            <Icon name="loader-circle" size={16} spin={true} />
            <span>{t.table.loadingMore}</span>
          </p>
        ) : null}
        {foot}
      </div>
    );
  }
  // stickyFirst: the expander, the tick box and every column marked sticky stay at the left edge, in that order.
  const sticky: Record<string, number> = {};
  let nSticky = 0;
  if (p.stickyFirst) {
    if (expandable) sticky.__exp = nSticky++;
    if (selectable) sticky.__sel = nSticky++;
    cols.forEach(function (c) {
      if (c.sticky) sticky[c.key] = nSticky++;
    });
  }
  function stick(k: string) {
    const v = sticky[k];
    return isNil(v) ? null : { "data-sticky": String(v), "data-sticky-last": v === nSticky - 1 ? "" : undefined };
  }
  function att(base: CellAttrs, k: string): CellAttrs {
    const st = stick(k);
    return st ? Object.assign(base, st) : base;
  }
  function header(c: Column) {
    const sorted = p.sort && p.sort.key === c.key;
    const dir = sorted ? (p.sort!.dir === "desc" ? "desc" : "asc") : null;
    const label =
      c.kind === "actions" || c.kind === "menu" ? (
        c.label ? (
          c.label
        ) : (
          <span className="r1-sr">{t.actionsCol}</span>
        )
      ) : (
        c.label
      );
    const text = (
      <span className="r1-th__text">
        {label}
        {c.unit ? <span className="r1-th__unit">{c.unit}</span> : null}
      </span>
    );
    const body =
      c.sortable || sorted ? (
        <button
          type="button"
          className={cx("r1-th__sort", sorted && "r1-th__sort--on")}
          onClick={
            p.onSort
              ? function () {
                  p.onSort!(c.key);
                }
              : undefined
          }
        >
          {text}
          <Icon
            name={dir === "asc" ? "arrow-up" : dir === "desc" ? "arrow-down" : "chevrons-up-down"}
            size={16}
            className="r1-th__icon"
          />
          {sorted ? <span className="r1-sr">{dir === "desc" ? t.sortDesc : t.sortAsc}</span> : null}
        </button>
      ) : (
        text
      );
    return (
      <th
        key={c.key}
        {...att(
          {
            scope: "col",
            style: colStyle(c),
            className: cx(
              alignEnd(c) && "r1-end",
              c.sticky && "r1-col--sticky",
              (c.sortable || sorted) && "r1-th--sortable",
            ),
            "aria-sort": sorted ? (dir === "desc" ? "descending" : "ascending") : undefined,
          },
          c.key,
        )}
      >
        <span className="r1-th">
          {body}
          {c.help ? (
            <Toggletip
              label={t.tip.explain + ": " + (typeof c.label === "string" ? c.label : "")}
              title={typeof c.label === "string" ? c.label : undefined}
              text={c.help}
              density={density === "portal" ? "portal" : "console"}
              locale={p.locale}
            />
          ) : null}
        </span>
      </th>
    );
  }
  const skeletonRows: React.ReactElement[] = [];
  for (let k = 0; k < nLoading; k++) {
    skeletonRows.push(
      <tr key={"sk" + k} className="r1-row--skel" aria-hidden="true">
        {expandable ? <td {...att({ className: "r1-table__exp" }, "__exp")} /> : null}
        {selectable ? (
          <td {...att({ className: "r1-table__select" }, "__sel")}>
            <span className="r1-skel r1-skel--box" />
          </td>
        ) : null}
        {cols.map(function (c, j) {
          const w = SKEL_WIDTH[String(c.kind)] || (j === 0 ? 75 : 60 - (k % 3) * 10);
          if (c.kind === "menu")
            return (
              <td key={c.key} {...att({ className: "r1-end" }, c.key)}>
                <span className="r1-skel r1-skel--box" />
              </td>
            );
          return (
            <td key={c.key} {...att({ className: cx(alignEnd(c) && "r1-end") }, c.key)}>
              <span className="r1-skel" style={{ width: w + "%" }} />
            </td>
          );
        })}
      </tr>,
    );
  }
  const selectAcross =
    selectable && p.selectAcross && allChecked ? (
      <tr className="r1-table__across">
        <td colSpan={span}>
          <span>
            {p.selectAcross.selected
              ? t.table.selectedAll.replace(
                  "{total}",
                  formatCount(p.selectAcross.total, p.locale) + (p.selectAcross.noun ? " " + p.selectAcross.noun : ""),
                )
              : t.table.selectPage.replace("{n}", formatCount(enabled.length, p.locale)!)}
          </span>{" "}
          <button type="button" className="r1-link r1-table__acrossbtn" onClick={p.selectAcross.onToggle}>
            {p.selectAcross.selected
              ? t.table.clearAll
              : t.table.selectAll.replace(
                  "{total}",
                  formatCount(p.selectAcross.total, p.locale) + (p.selectAcross.noun ? " " + p.selectAcross.noun : ""),
                )}
          </button>
        </td>
      </tr>
    ) : null;
  let bodyRows: React.ReactElement[] = [];
  if (loading) bodyRows = skeletonRows;
  else if (stateBlock)
    bodyRows = [
      <tr key="state" className="r1-table__state">
        <td colSpan={span}>{stateBlock}</td>
      </tr>,
    ];
  else
    rows.forEach(function (r, i) {
      if (r._group) {
        bodyRows.push(
          <tr key={r._key || "g" + i} className="r1-table__group">
            <th scope="rowgroup" colSpan={span}>
              {r._groupCode ? <span className="r1-mono r1-table__groupcode">{r._groupCode}</span> : null}
              {r._group}
              {!isNil(r._groupCount) ? (
                <span className="r1-table__groupcount r1-num">{formatCount(r._groupCount, p.locale)}</span>
              ) : null}
              {r._groupNote ? <span className="r1-table__groupnote">{r._groupNote}</span> : null}
            </th>
          </tr>,
        );
        return;
      }
      const open = expandable && rowOpen(r, i);
      const name = nameOf(r, i);
      const m = msgOf(r);
      const tn = tone(r);
      const msgId = tid + "-m" + i;
      bodyRows.push(
        <tr
          key={keyOf(r, i) + "-r"}
          className={cx(
            r._selected && "r1-row--selected",
            isOn(r, i) && "r1-row--checked",
            tn && "r1-row--" + tn,
            r._quarantined && "r1-row--held",
            r._busy && "r1-row--busy",
            open && "r1-row--open",
            r._disabled && "r1-row--disabled",
            r._changed && "r1-row--changed",
            r._dropped && "r1-row--dropped",
            m && "r1-row--hasmsg",
          )}
          aria-current={r._selected ? "true" : undefined}
          aria-busy={r._busy ? "true" : undefined}
          aria-rowindex={p.rowCount ? (p.rowOffset || 0) + i + 2 : undefined}
          aria-describedby={m ? msgId : undefined}
          data-row={rowFocus ? keyOf(r, i) : undefined}
          tabIndex={rowFocus ? (keyOf(r, i) === stopKey ? 0 : -1) : undefined}
          onFocus={
            rowFocus
              ? function (e) {
                  if (e.target === e.currentTarget) cur[1](keyOf(r, i));
                }
              : undefined
          }
        >
          {expandable ? (
            <td {...att({ className: "r1-table__exp" }, "__exp")}>
              {hiddenCols.length ? (
                <button
                  type="button"
                  className="r1-table__expbtn"
                  aria-expanded={open ? "true" : "false"}
                  aria-controls={tid + "-d" + i}
                  aria-label={(open ? t.table.collapse : t.table.expand) + ": " + name}
                  onClick={function () {
                    const n = Object.assign({}, exState[0]);
                    n[keyOf(r, i)] = !open;
                    exState[1](n);
                  }}
                >
                  <Icon name="chevron-right" size={16} />
                </button>
              ) : null}
            </td>
          ) : null}
          {selectable ? (
            <td {...att({ className: "r1-table__select" }, "__sel")}>
              <label className="r1-choice r1-choice--bare">
                {choiceMark("checkbox", {
                  checked: isOn(r, i),
                  onChange: function () {
                    toggleRow(r, i);
                  },
                  disabled: noTick(r),
                  "aria-label": t.selectRow + " " + name,
                  "aria-describedby": noTick(r) && m ? msgId : undefined,
                })}
              </label>
            </td>
          ) : null}
          {cols.map(function (c, j) {
            const lead = j === 0 && r._href && !r._disabled;
            let content = cell(c, r, i, lead);
            if (lead)
              content = (
                <a className="r1-link r1-rowlink" href={r._href}>
                  {content}
                </a>
              );
            if (j === 0 && r._busy)
              content = (
                <span className="r1-row__busy">
                  <Icon name="loader-circle" size={16} spin={true} label={t.loading} />
                  {content}
                </span>
              );
            if (j === 0 && r._changed)
              content = (
                <span className="r1-row__first">
                  {content}
                  {stateWords(r)}
                </span>
              );
            if (j === 0 && r._selected)
              content = (
                <>
                  {content}
                  {openWords(r)}
                </>
              );
            if (j === 0 && r._dropped)
              content = (
                <>
                  {content}
                  {droppedWords(r)}
                </>
              );
            return createElement(
              j === 0 && p.rowHeaders ? "th" : "td",
              att(
                {
                  key: c.key,
                  scope: j === 0 && p.rowHeaders ? "row" : undefined,
                  style: colStyle(c),
                  className: cx(
                    alignEnd(c) && "r1-end",
                    ((NUMERIC as Partial<Record<string, number>>)[String(c.kind)] || c.num) && "r1-num",
                    (NOWRAP[String(c.kind)] || c.nowrap) && "r1-nowrap",
                    c.sticky && "r1-col--sticky",
                    j === 0 && "r1-cell--lead",
                  ),
                },
                c.key,
              ),
              content,
            );
          })}
        </tr>,
      );
      if (m)
        bodyRows.push(
          <tr key={keyOf(r, i) + "-m"} className={cx("r1-table__msgrow", tn && "r1-row--" + tn)}>
            {expandable ? <td {...att({ className: "r1-table__exp" }, "__exp")} /> : null}
            {selectable ? <td {...att({ className: "r1-table__select" }, "__sel")} /> : null}
            <td colSpan={cols.length}>{rowMsg(m.severity || "warning", m.text, msgId, m.code, p.locale)}</td>
          </tr>,
        );
      if (open)
        bodyRows.push(
          <tr key={keyOf(r, i) + "-d"} id={tid + "-d" + i} className="r1-table__detail">
            <td colSpan={span}>
              <dl className="r1-table__facts">
                {hiddenCols.map(function (c) {
                  return (
                    <div key={c.key} className="r1-table__fact">
                      <dt>
                        {c.label}
                        {c.unit ? " (" + c.unit + ")" : ""}
                      </dt>
                      <dd
                        className={cx(
                          ((NUMERIC as Partial<Record<string, number>>)[String(c.kind)] || c.num) && "r1-num",
                        )}
                      >
                        {cell(c, r, i)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </td>
          </tr>,
        );
    });
  if (p.loadingMore && !loading)
    bodyRows.push(
      <tr key="more" className="r1-table__morerow">
        <td colSpan={span}>
          <span className="r1-table__more" role="status">
            <Icon name="loader-circle" size={16} spin={true} />
            <span>{t.table.loadingMore}</span>
          </span>
        </td>
      </tr>,
    );
  const totals =
    p.totals && dataRows.length && !loading ? (
      <tfoot>
        <tr className="r1-table__total">
          {expandable ? <td {...att({ className: "r1-table__exp" }, "__exp")} /> : null}
          {selectable ? <td {...att({ className: "r1-table__select" }, "__sel")} /> : null}
          {cols.map(function (c, j) {
            const v = (p.totals!.values || {})[c.key];
            return createElement(
              j === 0 ? "th" : "td",
              att(
                {
                  key: c.key,
                  scope: j === 0 ? "row" : undefined,
                  className: cx(
                    alignEnd(c) && "r1-end",
                    ((NUMERIC as Partial<Record<string, number>>)[String(c.kind)] || c.num) && "r1-num",
                    "r1-nowrap",
                    c.sticky && "r1-col--sticky",
                  ),
                },
                c.key,
              ),
              j === 0 && isNil(v)
                ? p.totals!.label || t.table.total
                : isNil(v)
                  ? null
                  : renderCell(c, v, p.locale, density),
            );
          })}
        </tr>
      </tfoot>
    ) : null;
  const wrapStyle = Object.assign({}, p.style || {}, p.maxHeight ? { maxHeight: p.maxHeight } : {});
  const region = scrolls[0];
  return (
    <div
      ref={wrapRef}
      className={cx("r1-table-wrap", p.maxHeight && "r1-table-wrap--scroll", p.className)}
      style={wrapStyle}
      tabIndex={region ? 0 : undefined}
      role={region ? "region" : undefined}
      aria-label={region && !labelledBy ? (caption || derived)! : undefined}
      aria-labelledby={region && labelledBy ? labelledBy : undefined}
    >
      {loading ? (
        <span className="r1-sr" role="status">
          {t.loading}
        </span>
      ) : null}
      {errorBar}
      <table
        className={cx(
          "r1-table",
          "r1-table--" + density,
          p.stickyFirst && "r1-table--stickyfirst",
          rowFocus && "r1-table--rowfocus",
        )}
        aria-busy={loading ? "true" : undefined}
        aria-rowcount={p.rowCount ? p.rowCount + 1 : undefined}
        aria-labelledby={labelledBy || undefined}
        onKeyDown={rowFocus ? onRowKey : undefined}
        data-r1-focus-keys={rowFocus ? "arrowup arrowdown j k home end enter" + (selectable ? " x" : "") : undefined}
      >
        {caption || derived ? (
          <caption className="r1-sr">
            {caption || derived}
            {caption && p.sort && p.sortNote ? ". " + p.sortNote : ""}
          </caption>
        ) : null}
        <thead>
          <tr aria-rowindex={p.rowCount ? 1 : undefined}>
            {expandable ? (
              <th {...att({ scope: "col", className: "r1-table__exp" }, "__exp")}>
                <span className="r1-sr">{t.table.details}</span>
              </th>
            ) : null}
            {selectable ? (
              <th {...att({ scope: "col", className: "r1-table__select" }, "__sel")}>
                <label className="r1-choice r1-choice--bare">
                  {choiceMark(
                    "checkbox",
                    {
                      checked: allChecked,
                      onChange: toggleAll,
                      disabled: loading || !enabled.length,
                      "aria-label": t.selectAll,
                    },
                    nChecked > 0 && !allChecked,
                  )}
                </label>
              </th>
            ) : null}
            {cols.map(header)}
          </tr>
          {selectAcross}
        </thead>
        <tbody>{bodyRows}</tbody>
        {totals}
      </table>
      {
        // expandable: the columns waiting behind the expander are named under the table, so a sighted reader knows what
        // opening a row shows ("Đang ẩn: Ngày nộp, Người lập. Mở một dòng để xem.").
        hiddenCols.length && dataRows.length && !loading ? (
          <p className="r1-table__foot r1-table__hidden">
            <Icon name="eye-off" size={16} />
            <span>
              {t.table.hidden.replace(
                "{cols}",
                hiddenCols
                  .map(function (c) {
                    return textOf(c.label);
                  })
                  .filter(Boolean)
                  .join(", "),
              )}
            </span>
          </p>
        ) : null
      }
      {p.sortNote ? (
        <div className="r1-table__foot r1-table__sortnote">
          {p.sortNote}
          {p.footer ? <span>{p.footer}</span> : null}
        </div>
      ) : (
        foot
      )}
    </div>
  );
}
