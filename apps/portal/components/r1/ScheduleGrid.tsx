"use client";

import type * as React from "react";
import { StatusIcon } from "./StatusIcon";
import { cx, fold } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Family, Locale, SlotKind } from "./lib/types";

// A week of the resolved schedule: one row per day, 24 hours across, each stretch coloured by what plays.
// kinds: scheduled (a schedule plays), default (the default playlist), fallback (a schedule cannot play, the default does), none (nothing plays).
const SLOT_KINDS: SlotKind[] = ["scheduled", "default", "fallback", "none"];

function slotOf(hm: string): number {
  const x = String(hm).split(":");
  return Math.round((Number(x[0]) * 60 + Number(x[1] || 0)) / 15);
}

export type ScheduleGridProps = {
  days: {
    label: string;
    current?: boolean | undefined;
    /** a stretch whose to is earlier than its from runs past midnight into the next day */ segments: {
      from: string;
      to: string;
      kind: SlotKind;
      label?: string | undefined;
      title?: string | undefined;
    }[];
  }[];
  kinds?: Partial<Record<SlotKind, string>> | undefined;
  caption?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A stretch as drawn: one that runs past midnight is split, each half marked with the side it continues on.
type DrawnSegment = ScheduleGridProps["days"][number]["segments"][number] & { cont?: "next" | "prev" | undefined };
type DrawnDay = { label: string; current: boolean | undefined; segments: DrawnSegment[] };

// Each stretch is named by what plays there (the kind's word), then its title, so a fallback or an empty hour
// is said even when the stretch has a title. A stretch that runs past midnight ends at 24:00 on its day and
// carries on from 00:00 on the next row. Fallback and nothing-can-play also differ by edge and shape.
export function ScheduleGrid(p: ScheduleGridProps) {
  const t = tx(p.locale).sched;
  const raw = p.days || [];
  const names = p.kinds || {};
  const ticks = ["00:00", "06:00", "12:00", "18:00", "24:00"];
  const days = raw.map(function (d): DrawnDay {
    return { label: d.label, current: d.current, segments: [] };
  });
  raw.forEach(function (d, i) {
    (d.segments || []).forEach(function (g) {
      const a = slotOf(g.from),
        b = slotOf(g.to);
      if (b === a) return;
      if (b > a) {
        days[i]!.segments.push(g);
        return;
      }
      days[i]!.segments.push(Object.assign({}, g, { to: "24:00", cont: "next" as const }));
      if (b > 0 && days[i + 1])
        days[i + 1]!.segments.unshift(Object.assign({}, g, { from: "00:00", cont: "prev" as const }));
    });
  });
  const used: Partial<Record<SlotKind, boolean>> = {};
  days.forEach(function (d) {
    d.segments.forEach(function (g) {
      used[g.kind] = true;
    });
  });
  function words(g: DrawnSegment): string {
    const kind = names[g.kind] || "";
    const own = g.title || g.label || "";
    const parts = [kind];
    if (own && fold(kind).indexOf(fold(own)) < 0) parts.push(own);
    if (g.cont) parts.push(t[g.cont]);
    return g.from + "–" + g.to + " " + parts.filter(Boolean).join(", ");
  }
  const mark: Partial<Record<SlotKind, Family>> = { fallback: "attention", none: "danger" };
  return (
    <figure className={cx("r1-sched", p.className)} style={p.style}>
      {p.caption ? <figcaption className="r1-sr">{p.caption}</figcaption> : null}
      <div className="r1-sched__row r1-sched__row--ticks" aria-hidden="true">
        <span />
        <div className="r1-sched__ticks r1-num">
          {ticks.map(function (x, i) {
            return (
              <span key={x} className="r1-sched__tick" style={{ left: (i * 100) / (ticks.length - 1) + "%" }}>
                {x}
              </span>
            );
          })}
        </div>
      </div>
      {days.map(function (d, i) {
        const segs = d.segments;
        return (
          <div key={i} className={cx("r1-sched__row", d.current && "r1-sched__row--current")}>
            <span className="r1-sched__day">{d.label}</span>
            <div className="r1-sched__track" role="img" aria-label={d.label + ": " + segs.map(words).join("; ")}>
              {segs.map(function (g, k) {
                const a = slotOf(g.from),
                  b = slotOf(g.to);
                const fam = mark[g.kind];
                return (
                  <span
                    key={k}
                    className={cx(
                      "r1-sched__seg",
                      "r1-sched__seg--" + (g.kind || "default"),
                      g.cont && "r1-sched__seg--" + g.cont,
                    )}
                    style={{ gridColumn: a + 1 + " / " + (b + 1) }}
                    title={words(g)}
                  >
                    {b - a >= 6 && g.label ? (
                      <span className="r1-sched__label">
                        {fam ? <StatusIcon family={fam} size={16} cutout={fam + "-tint"} /> : null}
                        <span>{g.label}</span>
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <ul className="r1-sched__legend">
        {SLOT_KINDS.filter(function (k) {
          return used[k] && names[k];
        }).map(function (k) {
          return (
            <li key={k}>
              <span className={"r1-sched__swatch r1-sched__seg--" + k} aria-hidden="true" />
              {names[k]}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
