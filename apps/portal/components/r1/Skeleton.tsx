"use client";

import type * as React from "react";
import { useEffect } from "react";
import { announce, cx, readerActed } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

// The loading state in the shape of what replaces it: table rows, lines of text, a fact list, a card or a chart.
// It is not a live region (its busy flag could never clear, since it leaves when the data comes): a load the
// reader started is said once, and ViewState says when it has finished.
const SKEL_BARS = [62, 84, 48, 72, 56, 90, 40, 66];

export type SkeletonProps = {
  variant?: "table" | "text" | "facts" | "card" | "chart" | undefined;
  rows?: number | undefined;
  columns?: number | undefined;
  density?: "console" | "org" | "portal" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function Skeleton(p: SkeletonProps) {
  const t = tx(p.locale);
  const rows = p.rows || 4;
  const variant = p.variant || "table";
  useEffect(function () {
    if (readerActed()) announce(t.loading, "polite");
  }, []);
  function line(i: number, cls?: string) {
    return (
      <span key={i} className="r1-skel__line">
        <span className={cx("r1-skel", cls || "r1-skel--text")} style={{ width: 92 - (i % 3) * 14 + "%" }} />
      </span>
    );
  }
  const list = [];
  if (variant === "chart") {
    const bars = [];
    for (let b = 0; b < (p.columns || 6); b++)
      bars.push(
        <span key={b} className="r1-skel r1-skel--bar" style={{ height: SKEL_BARS[b % SKEL_BARS.length] + "%" }} />,
      );
    list.push(
      <div key="c" className="r1-skel__chart">
        {bars}
      </div>,
    );
  } else if (variant === "card") {
    list.push(
      <span key="t" className="r1-skel__line r1-skel__line--title">
        <span className="r1-skel r1-skel--title" style={{ width: "40%" }} />
      </span>,
    );
    for (let c = 0; c < rows; c++) list.push(line(c));
  } else {
    for (let i = 0; i < rows; i++) {
      if (variant === "text") list.push(line(i));
      else if (variant === "facts") {
        list.push(
          <div key={i} className="r1-skel__fact">
            <span className="r1-skel__line">
              <span className="r1-skel r1-skel--label" style={{ width: 70 - (i % 2) * 20 + "%" }} />
            </span>
            {line(i)}
          </div>,
        );
      } else {
        // columns: as many cells as the table that will arrive, so the page does not shift when it does
        const widths = p.columns ? [] : [18, 34, 14, 20];
        for (let j = 0; p.columns && j < p.columns; j++)
          widths.push(j === 0 ? 18 : Math.max(8, Math.round(72 / p.columns) - (j % 3) * 4));
        const cells = widths.map(function (w, j) {
          return <span key={j} className="r1-skel r1-skel--cell" style={{ width: w + "%" }} />;
        });
        list.push(
          <div key={i} className={"r1-skel__row r1-skel__row--" + (p.density || "portal")}>
            {cells}
          </div>,
        );
      }
    }
  }
  return (
    <div className={cx("r1-skeleton", "r1-skeleton--" + variant, p.className)} style={p.style}>
      <span className="r1-sr">{t.loading}</span>
      {list}
    </div>
  );
}
