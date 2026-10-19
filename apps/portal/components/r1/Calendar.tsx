"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { daysIn, ymd, ymdKey } from "./lib/dates";
import { dtf, formatDate } from "./lib/formatting";
import { cx, focusEl, lang, useSynced } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

function addDays(k: string, n: number): string {
  const o = ymd(k)!;
  const d = new Date(Date.UTC(o.y, o.m - 1, o.d + n));
  return ymdKey({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
}

function addMonths(k: string, n: number): string {
  const o = ymd(k)!;
  const d = new Date(Date.UTC(o.y, o.m - 1 + n, 1));
  const y = d.getUTCFullYear(),
    m = d.getUTCMonth() + 1;
  return ymdKey({ y: y, m: m, d: Math.min(o.d, daysIn(y, m)) });
}

function weekday(k: string): number {
  return (new Date(k + "T00:00:00Z").getUTCDay() + 6) % 7;
}

export type CalendarProps = {
  value?: string | null | undefined;
  to?: string | null | undefined;
  month?: string | undefined;
  today?: string | undefined;
  min?: string | undefined;
  max?: string | undefined;
  density?: "console" | "portal" | "premises" | "org" | undefined;
  onPick?: ((ymd: string) => void) | undefined;
  onMonthChange?: ((month: string) => void) | undefined;
  onPrevMonth?: (() => void) | undefined;
  onNextMonth?: (() => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// One month, weeks from Monday. Days outside min and max cannot be picked; a range tints the days between.
// One day is the tab stop: the focused day, else the chosen day, else today, else the first day that can
// be picked. Arrows move by a day or a week and cross into the next month; Page Up and Page Down move by a
// month; Home and End go to the start and end of the week.
export function Calendar(p: CalendarProps) {
  const t = tx(p.locale).date;
  const first = p.month ? p.month + "-01" : ymd(p.value) ? p.value! : ymd(p.today) ? p.today! : "2026-01-01";
  const ms = useSynced(p.month, first.slice(0, 7));
  const month = ms[0];
  const fk = useState<string | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const pending = useRef<string | null>(null);
  const base = ymd(month + "-01")!;
  const y = base.y,
    m = base.m;
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const n = daysIn(y, m);
  const from = p.value || "",
    to = p.to || "";
  const cells: Array<string | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= n; d++) cells.push(ymdKey({ y: y, m: m, d: d }));
  while (cells.length % 7) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let w = 0; w < cells.length; w += 7) weeks.push(cells.slice(w, w + 7));
  let title = dtf(p.locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  title = title.charAt(0).toUpperCase() + title.slice(1);
  const heads =
    lang(p.locale) === "en" ? ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] : ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  function allowed(k: string): boolean {
    return !((p.min && k < p.min) || (p.max && k > p.max));
  }
  function inMonth(k: string | null | undefined): k is string {
    return !!k && String(k).slice(0, 7) === month;
  }
  let firstOk: string | null = null;
  for (let dd = 1; dd <= n && !firstOk; dd++) {
    const kk = ymdKey({ y: y, m: m, d: dd });
    if (allowed(kk)) firstOk = kk;
  }
  const stop =
    [fk[0], p.value, p.today].filter(function (k) {
      return inMonth(k) && allowed(k);
    })[0] || firstOk;
  function goMonth(mk: string): void {
    ms[1](mk);
    if (p.onMonthChange) p.onMonthChange(mk);
  }
  useEffect(function () {
    if (!pending.current || !gridRef.current) return;
    const b = gridRef.current.querySelector('[data-day="' + pending.current + '"]');
    pending.current = null;
    focusEl(b);
  });
  function onKey(e: React.KeyboardEvent<HTMLTableElement>): void {
    const at = document.activeElement && document.activeElement.getAttribute("data-day");
    if (!at) return;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[e.key];
    const next = step
      ? addDays(at, step)
      : e.key === "PageUp"
        ? addMonths(at, -1)
        : e.key === "PageDown"
          ? addMonths(at, 1)
          : e.key === "Home"
            ? addDays(at, -weekday(at))
            : e.key === "End"
              ? addDays(at, 6 - weekday(at))
              : null;
    if (!next) return;
    e.preventDefault();
    if (!allowed(next)) return;
    fk[1](next);
    pending.current = next;
    if (next.slice(0, 7) !== month) goMonth(next.slice(0, 7));
  }
  // On the premises portal every day and both month buttons are 44 px targets or more.
  const touch = p.density === "premises";
  return (
    <div
      className={cx("r1-cal", touch && "r1-cal--premises", p.className)}
      role="group"
      aria-label={title}
      style={p.style}
    >
      <div className="r1-cal__head">
        <Button
          variant="quiet"
          size={touch ? "md" : "sm"}
          iconOnly={true}
          icon="chevron-left"
          aria-label={t.prevMonth}
          onClick={function () {
            goMonth(addMonths(month + "-01", -1).slice(0, 7));
            if (p.onPrevMonth) p.onPrevMonth();
          }}
          locale={p.locale}
        />
        <span className="r1-cal__title" aria-live="polite">
          {title}
        </span>
        <Button
          variant="quiet"
          size={touch ? "md" : "sm"}
          iconOnly={true}
          icon="chevron-right"
          aria-label={t.nextMonth}
          onClick={function () {
            goMonth(addMonths(month + "-01", 1).slice(0, 7));
            if (p.onNextMonth) p.onNextMonth();
          }}
          locale={p.locale}
        />
      </div>
      <table ref={gridRef} className="r1-cal__grid" onKeyDown={onKey}>
        <thead>
          <tr>
            {heads.map(function (x) {
              return (
                <th key={x} scope="col">
                  {x}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {weeks.map(function (wk, wi) {
            return (
              <tr key={wi}>
                {wk.map(function (k, di) {
                  if (!k) return <td key={di} />;
                  const off = !allowed(k);
                  const start = k === from,
                    end = to && k === to,
                    inside = to && from && k > from && k < to;
                  const label = formatDate(k, p.locale);
                  return (
                    <td
                      key={di}
                      className={cx(inside && "r1-cal__in", start && to && "r1-cal__from", end && "r1-cal__to")}
                    >
                      <button
                        type="button"
                        className={cx(
                          "r1-cal__day",
                          (start || end) && "r1-cal__day--on",
                          k === p.today && "r1-cal__day--today",
                        )}
                        disabled={off}
                        aria-pressed={start || end ? "true" : "false"}
                        aria-label={label + (k === p.today ? ", " + t.today : "")}
                        data-day={k}
                        tabIndex={k === stop ? 0 : -1}
                        onClick={function () {
                          fk[1](k);
                          if (p.onPick) p.onPick(k);
                        }}
                      >
                        {String(+k.slice(8))}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
