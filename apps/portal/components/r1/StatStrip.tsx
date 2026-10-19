"use client";

import type * as React from "react";
import { StatusIcon } from "./StatusIcon";
import { formatCount } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { tx } from "./lib/strings";
import { missingValue } from "./lib/value-atoms";
import type { Family, Locale } from "./lib/types";

export type StatStripProps = {
  items: {
    /** a number is formatted for the locale; a string is shown as passed; null is a dash read as words */ value:
      number | React.ReactNode | null;
    label: string;
    note?: string | undefined;
    /** adds the family's status shape before the label */ family?: Family | undefined;
    /** the count that decides the next step: the other values step back */ emphasis?: boolean | undefined;
    missing?: string | undefined;
  }[];
  columns?: 2 | 3 | 4 | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Counts that decide what the reader does next. A number is written in the reader's grouping; a count that is not
// known is a dash read as words; family adds the status shape before the label; emphasis keeps one value at full
// strength and steps the others back. The strip wraps onto more rows when the screen is narrow.
export function StatStrip(p: StatStripProps) {
  const t = tx(p.locale);
  const items = p.items || [];
  const lead = items.some(function (it) {
    return it && it.emphasis;
  });
  // Over several rows, the last count takes the cells left empty on its row, so the strip has no open cell.
  const left = p.columns ? (p.columns - (items.length % p.columns)) % p.columns : 0;
  return (
    <dl
      className={cx(
        "r1-stats",
        p.columns && "r1-stats--grid r1-stats--cols-" + p.columns,
        lead && "r1-stats--lead",
        p.className,
      )}
      style={p.style}
    >
      {items.map(function (it, i) {
        const v = it.value;
        const value =
          isNil(v) || v === ""
            ? missingValue(it.missing, t.noValue)
            : typeof v === "number"
              ? formatCount(v, p.locale)
              : v;
        return (
          <div
            key={i}
            className={cx(
              "r1-stats__item",
              it.emphasis && "r1-stats__item--emphasis",
              it.family && "r1-stats__item--" + it.family,
            )}
            style={left && i === items.length - 1 ? ({ "--stats-span": left + 1 } as React.CSSProperties) : undefined}
          >
            <dt className="r1-stats__label">
              {it.family ? (
                <span className="r1-stats__icon">
                  <StatusIcon family={it.family} size={16} cutout="surface" />
                </span>
              ) : null}
              <span>{it.label}</span>
            </dt>
            <dd className="r1-stats__value r1-num">{value}</dd>
            {it.note ? <dd className="r1-stats__note">{it.note}</dd> : null}
          </div>
        );
      })}
    </dl>
  );
}
