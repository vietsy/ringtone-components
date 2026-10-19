"use client";

import type * as React from "react";
import { FreshnessLine } from "./FreshnessLine";
import { formatCount } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { tx } from "./lib/strings";
import { missingValue } from "./lib/value-atoms";
import type { Locale } from "./lib/types";

export type ChartProps = {
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
  title?: string | undefined;
  summary?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  freshness?: object | undefined;
  showTable?: boolean | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function Chart(p: ChartProps) {
  const t = tx(p.locale);
  const series = p.series || [];
  const cats = p.categories || [];
  const W = p.width || 560,
    H = p.height || 220,
    padL = 48,
    padB = 28,
    padT = 8;
  let top = 0;
  series.forEach(function (s) {
    s.values.forEach(function (v) {
      if (!isNil(v) && v > top) top = v;
    });
  });
  // The axis runs to a round number, so the gridlines read 0, 200, 400 rather than 0, 178, 355.
  const half = Math.max(top, 1) / 2,
    mag = Math.pow(10, Math.floor(Math.log10(half)));
  let step = mag;
  [1, 2, 2.5, 5, 10].some(function (f) {
    step = f * mag;
    return half <= step;
  });
  if (step < 1) step = 1;
  const max = step * 2;
  const plotW = W - padL - 8,
    plotH = H - padB - padT;
  const groupW = plotW / Math.max(1, cats.length);
  const barW = Math.min(28, (groupW - 12) / Math.max(1, series.length));
  const ticks = [0, step, max];
  // The series colours are chart-1 to chart-3, which the Player theme re-points at its light hues, so a chart on the
  // dark Player surface keeps its bars legible (every series clears 3:1 against the ground on both themes).
  return (
    <figure className={cx("r1-chart", p.className)} style={p.style}>
      {p.title ? <figcaption className="r1-chart__title">{p.title}</figcaption> : null}
      <svg width={W} height={H} viewBox={"0 0 " + W + " " + H} role="img" aria-label={p.summary || p.title}>
        {ticks.map(function (v, i) {
          const y = padT + plotH - (v / max) * plotH;
          return (
            <g key={"t" + i}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} style={{ stroke: "var(--border)" }} />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="r1-chart__tick">
                {formatCount(v, p.locale)}
              </text>
            </g>
          );
        })}
        {cats.map(function (c, ci) {
          const gx = padL + ci * groupW + (groupW - barW * series.length) / 2;
          return (
            <g key={"c" + ci}>
              {series.map(function (s, si) {
                const v = s.values[ci];
                if (isNil(v)) return null;
                const bh = (v / max) * plotH;
                return (
                  <rect
                    key={si}
                    x={gx + si * barW}
                    y={padT + plotH - bh}
                    width={barW - 4}
                    height={bh}
                    rx={2}
                    style={{ fill: "var(--chart-" + ((si % 3) + 1) + ")" }}
                  />
                );
              })}
              <text x={padL + ci * groupW + groupW / 2} y={H - 8} textAnchor="middle" className="r1-chart__tick">
                {c}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="r1-chart__legend">
        {series.map(function (s, si) {
          return (
            <li key={si}>
              <span className="r1-chart__swatch" style={{ background: "var(--chart-" + ((si % 3) + 1) + ")" }} />
              {s.name}
            </li>
          );
        })}
      </ul>
      <table className={p.showTable ? "r1-chart__table" : "r1-sr"}>
        <caption>{p.title || p.summary}</caption>
        <thead>
          <tr>
            <th scope="col">{t.chart.category}</th>
            {series.map(function (s, si) {
              return (
                <th key={si} scope="col" className="r1-end">
                  {s.name}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {cats.map(function (c, ci) {
            return (
              <tr key={ci}>
                <th scope="row">{c}</th>
                {series.map(function (s, si) {
                  const v = s.values[ci];
                  return (
                    <td key={si} className="r1-end r1-num">
                      {isNil(v) ? missingValue(null, t.noValue) : formatCount(v, p.locale)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {p.freshness ? <FreshnessLine locale={p.locale} {...p.freshness} /> : null}
    </figure>
  );
}
