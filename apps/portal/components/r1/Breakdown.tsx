"use client";

import type * as React from "react";
import { createElement } from "react";
import { Icon } from "./Icon";
import { StatusBadge } from "./StatusBadge";
import { formatMoney } from "./lib/formatting";
import { cx, isNil, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import { missingValue } from "./lib/value-atoms";
import type { Locale } from "./lib/types";

export type BreakdownProps = {
  title: string;
  level?: 2 | 3 | undefined;
  description?: React.ReactNode | undefined;
  lines: {
    label: string;
    detail?: string | undefined;
    basis?: string | undefined;
    source?: string | undefined;
    amountMinor: number | null;
    kind?: "line" | "subtract" | "subtotal" | "total" | undefined;
    missing?: string | undefined;
  }[];
  currency?: string | undefined;
  indicative?: boolean | undefined;
  note?: React.ReactNode | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// How an amount is reached, line by line: what each line is, its basis, the rule it comes from, and the total.
export function Breakdown(p: BreakdownProps) {
  const t = tx(p.locale).breakdown;
  const id = useUid("r1-bd");
  const lines = p.lines || [];
  const cur = p.currency || "VND";
  // A reduction and a negative amount take the minus sign U+2212 from formatMoney, as every value component does.
  function amount(ln: BreakdownProps["lines"][number]) {
    const v = ln.amountMinor;
    if (isNil(v) || typeof v !== "number" || isNaN(v)) return missingValue(ln.missing, tx(p.locale).notCalculated);
    return formatMoney(ln.kind === "subtract" ? -Math.abs(v) : v, cur, p.locale);
  }
  return (
    <section className={cx("r1-breakdown", p.className)} aria-labelledby={id} style={p.style}>
      <div className="r1-breakdown__head">
        {createElement(p.level === 3 ? "h3" : "h2", { id: id, className: "r1-breakdown__title" }, p.title)}
        {p.indicative ? <StatusBadge family="attention" label={t.indicative} size="sm" /> : null}
      </div>
      {p.description ? <p className="r1-breakdown__desc">{p.description}</p> : null}
      <table className="r1-breakdown__table">
        <caption className="r1-sr">{p.title}</caption>
        <thead className="r1-sr">
          <tr>
            <th scope="col">{t.item}</th>
            <th scope="col">{t.basis}</th>
            <th scope="col">{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(function (ln, i) {
            return (
              <tr key={i} className={cx("r1-breakdown__row", "r1-breakdown__row--" + (ln.kind || "line"))}>
                <th scope="row">
                  <span className="r1-breakdown__label">{ln.label}</span>
                  {ln.detail ? <span className="r1-breakdown__detail">{ln.detail}</span> : null}
                  {ln.source ? (
                    <span className="r1-breakdown__source">
                      <Icon name="scale" size={16} />
                      <span>{ln.source}</span>
                    </span>
                  ) : null}
                </th>
                <td className="r1-breakdown__basis r1-num">{ln.basis || ""}</td>
                <td className="r1-breakdown__amount r1-num">{amount(ln)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {p.note ? <p className="r1-breakdown__note">{p.note}</p> : null}
    </section>
  );
}
