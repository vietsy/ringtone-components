"use client";

import type * as React from "react";
import { Icon } from "./Icon";
import { formatCount } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { typedValue } from "./lib/side-by-side-lineage";
import { tx } from "./lib/strings";
import { NUMERIC } from "./lib/table";
import type { Locale } from "./lib/types";

export type ComparisonProps = {
  columns: { key: string; label: string; meta?: string | undefined }[];
  rows: {
    key?: string | undefined;
    label: string;
    values: Record<string, React.ReactNode>;
    changed?: boolean | undefined;
    /** how the values are written: money (minor units), count, percent, date, datetime, period ({from, to}), id; text by default */ kind?:
      "text" | "money" | "count" | "percent" | "date" | "datetime" | "period" | "id" | undefined;
    currency?: string | undefined;
    /** count: the unit after the figure; money: the currency written once after the row's label, the cells bare */ unit?:
      string | undefined;
    missing?: string | undefined;
    /** percent: a fixed number of decimals */ decimals?: number | undefined;
    /** money, count and percent rows end at the right of their cells; start keeps one at the left */ align?:
      "start" | "end" | undefined;
  }[];
  /** the currency of every money row, written once after each row's label (a row's own unit wins) */ unit?:
    string | undefined;
  onlyChanges?: boolean | undefined;
  caption?: string | undefined;
  /** the first column's header; default "Trường" / "Field" */ rowLabel?: string | undefined;
  /** the line above the table; default counts the changed rows */ summary?: React.ReactNode | undefined;
  density?: "console" | "portal" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

type ComparisonRow = ComparisonProps["rows"][number];

// Two or three versions or records side by side, with the fields that differ marked in words.
export function Comparison(p: ComparisonProps) {
  const t = tx(p.locale).compare;
  const cols = p.columns || [];
  const all = p.rows || [];
  const rows = all.filter(function (r) {
    return !p.onlyChanges || r.changed;
  });
  const nChanged = all.filter(function (r) {
    return r.changed;
  }).length;
  // A figure row ends at the right of its cells unless it asks for align: 'start', as a Table column may.
  function atEnd(r: ComparisonRow): boolean {
    return !!(NUMERIC as Partial<Record<string, number>>)[String(r.kind)] && r.align !== "start";
  }
  // unit (opt-in, on the comparison or on a money row): the currency is written once, after the row's label, and the
  // amounts in its cells are bare, as a Table money column with a unit in its header draws them.
  function moneyUnit(r: ComparisonRow): string | null {
    return r.kind === "money" ? r.unit || p.unit || null : null;
  }
  const allNum = rows.length > 0 && rows.every(atEnd);
  return (
    <div className={cx("r1-compare", p.className)} style={p.style}>
      <p className="r1-compare__summary">
        {!isNil(p.summary)
          ? p.summary
          : nChanged === 1
            ? t.changedOne
            : nChanged
              ? t.changed.replace("{n}", formatCount(nChanged, p.locale)!)
              : t.same}
      </p>
      {
        // Only the changes, and nothing changed: the summary says so and no empty table is drawn under it.
        rows.length ? (
          <div className="r1-table-wrap">
            <table className={cx("r1-table", "r1-table--" + (p.density || "console"), "r1-compare__table")}>
              {p.caption ? <caption className="r1-sr">{p.caption}</caption> : null}
              <thead>
                <tr>
                  <th scope="col">{p.rowLabel || t.field}</th>
                  {cols.map(function (c) {
                    // When every row shown is a figure, the version headers end where the figures end.
                    return (
                      <th key={c.key} scope="col" className={allNum ? "r1-end" : undefined}>
                        <span className="r1-compare__col">{c.label}</span>
                        {c.meta ? <span className="r1-compare__colmeta">{c.meta}</span> : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(function (r, i) {
                  return (
                    <tr key={r.key || i} className={cx(r.changed && "r1-compare__row--changed")}>
                      <th scope="row">
                        <span className="r1-compare__label">
                          {r.label}
                          {moneyUnit(r) ? <span className="r1-th__unit">{" " + moneyUnit(r)}</span> : null}
                        </span>
                        {r.changed ? (
                          <span className="r1-compare__mark">
                            <Icon name="arrow-right-left" size={16} />
                            {t.differs}
                          </span>
                        ) : null}
                      </th>
                      {
                        // Amounts, counts and percentages sit at the end of their cell, tabular and on one line, as a Table's numeric
                        // columns do, so the figures of two versions line up digit under digit.
                        cols.map(function (c) {
                          return (
                            <td
                              key={c.key}
                              className={cx(
                                (NUMERIC as Partial<Record<string, number>>)[String(r.kind)] && "r1-num r1-nowrap",
                                atEnd(r) && "r1-end",
                              )}
                            >
                              {typedValue(
                                r.kind,
                                (r.values || {})[c.key],
                                moneyUnit(r) ? Object.assign({}, r, { bareMoney: true }) : r,
                                p.locale,
                              )}
                            </td>
                          );
                        })
                      }
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null
      }
    </div>
  );
}
