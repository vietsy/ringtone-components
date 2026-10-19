"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { StatusIcon } from "./StatusIcon";
import { formatStamp, formatTimestamp, toDate } from "./lib/formatting";
import { announce, cx, isNil, textOf } from "./lib/helpers";
import { tx } from "./lib/strings";
import { formatDuration } from "./lib/time-limits";
import type { Family, Locale } from "./lib/types";

type DeadlineState = "on-track" | "soon" | "overdue" | "met" | "late" | "paused" | "none";

const DEADLINE_FAMILY: Record<DeadlineState, Family> = {
  "on-track": "neutral",
  soon: "attention",
  overdue: "danger",
  met: "positive",
  late: "attention",
  paused: "info",
  none: "neutral",
};

export type DeadlineClockProps = {
  due?: string | undefined;
  now?: string | undefined;
  start?: string | undefined;
  soonHours?: number | undefined;
  metAt?: string | undefined;
  paused?: boolean | undefined;
  pausedReason?: string | undefined;
  label?: string | undefined;
  size?: "sm" | "md" | undefined;
  /** minutes left at which the clock speaks once each through the polite live region, [30, 5]; marks already passed when it appears stay silent */ announceAt?:
    number | number[] | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Time left to a deadline, in words and a shape, with the deadline itself. Colour is never the only signal.
// No due date: "No deadline set", never a countdown. Without a fixed now it ticks once a minute. The small size
// keeps the deadline on a second line, not only in a tooltip.
export function DeadlineClock(p: DeadlineClockProps) {
  const t = tx(p.locale).deadline;
  const tick = useState(0);
  useEffect(
    function () {
      if (p.now) return undefined;
      const timer = setInterval(function () {
        tick[1](function (n) {
          return n + 1;
        });
      }, 60000);
      return function () {
        clearInterval(timer);
      };
    },
    [!!p.now],
  );
  const due = toDate(p.due),
    now = toDate(p.now) || new Date(),
    met = toDate(p.metAt);
  const left = due ? due.getTime() - now.getTime() : 0;
  const state: DeadlineState = !due
    ? "none"
    : met
      ? met > due
        ? "late"
        : "met"
      : p.paused
        ? "paused"
        : left < 0
          ? "overdue"
          : left <= (p.soonHours || 24) * 3600000
            ? "soon"
            : "on-track";
  // announceAt (minutes, [30, 5]): each mark is said once through the polite live region as the time left reaches it.
  // Marks already passed when the clock appears are not said: nothing drawn with the page is announced on load.
  // A clock that is done, paused or past due says nothing. Without a fixed now the clock ticks once a minute.
  const marks = (Array.isArray(p.announceAt) ? p.announceAt : isNil(p.announceAt) ? [] : [p.announceAt])
    .map(Number)
    .filter(function (m) {
      return m > 0;
    });
  const said = useRef<{ due: number; done: Record<number, boolean> } | null>(null);
  const dueKey = due ? due.getTime() : 0;
  useEffect(function () {
    if (!marks.length) return;
    const counting = state === "soon" || state === "on-track";
    if (!said.current || said.current.due !== dueKey) {
      said.current = { due: dueKey, done: {} };
      marks.forEach(function (m) {
        if (!counting || left <= m * 60000) said.current!.done[m] = true;
      });
      return;
    }
    if (!counting) return;
    const reached = marks.filter(function (m) {
      return !said.current!.done[m] && left <= m * 60000;
    });
    if (!reached.length) return;
    reached.forEach(function (m) {
      said.current!.done[m] = true;
    });
    const d = formatDuration(left, p.locale);
    announce(
      p.label ? t.announce.replace("{label}", textOf(p.label)).replace("{d}", d) : t.announceBare.replace("{d}", d),
      "polite",
    );
  });
  const main =
    state === "none"
      ? t.none
      : state === "met"
        ? t.met
        : state === "late"
          ? t.late.replace("{d}", formatDuration(met!.getTime() - due!.getTime(), p.locale))
          : state === "paused"
            ? t.paused
            : (state === "overdue" ? t.overdue : t.left).replace("{d}", formatDuration(left, p.locale));
  const start = toDate(p.start);
  const pct =
    start && due && !met
      ? Math.max(
          0,
          Math.min(100, Math.round(((now.getTime() - start.getTime()) / (due.getTime() - start.getTime())) * 100)),
        )
      : null;
  const fam = DEADLINE_FAMILY[state];
  if (p.size === "sm") {
    return (
      <span className={cx("r1-deadline r1-deadline--sm", "r1-deadline--" + state, p.className)} style={p.style}>
        <span className="r1-deadline__main">
          <StatusIcon family={fam} size={16} cutout="surface" />
          <span>{main}</span>
        </span>
        {due ? (
          <time
            className="r1-deadline__due"
            dateTime={due.toISOString()}
            title={t.due + " " + formatTimestamp(due, p.locale)}
          >
            {t.due + " " + formatStamp(due, p.locale)}
          </time>
        ) : null}
      </span>
    );
  }
  return (
    <div
      className={cx("r1-deadline", "r1-deadline--" + state, p.className)}
      role="group"
      aria-label={p.label}
      style={p.style}
    >
      {p.label ? <span className="r1-deadline__label">{p.label}</span> : null}
      <span className="r1-deadline__main">
        <StatusIcon family={fam} size={20} cutout="surface" />
        <span>{main}</span>
      </span>
      {state === "paused" && p.pausedReason ? <span className="r1-deadline__why">{p.pausedReason}</span> : null}
      {pct !== null && state !== "paused" ? (
        <span className="r1-deadline__bar" aria-hidden="true">
          <span className="r1-deadline__fill" style={{ width: pct + "%" }} />
        </span>
      ) : null}
      {due || met ? (
        <span className="r1-deadline__due">
          {(met ? t.doneAt + " " + formatTimestamp(met, p.locale) + (due ? ". " : "") : "") +
            (due ? t.due + " " + formatTimestamp(due, p.locale) : "")}
        </span>
      ) : null}
    </div>
  );
}
