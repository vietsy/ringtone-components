"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { formatTime, toDate } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { dayOf } from "./lib/player-parts";
import type { Locale, PlayerValue } from "./lib/types";

export type ClockProps = {
  time?: PlayerValue | undefined;
  day?: PlayerValue | undefined;
  live?: boolean | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The device clock, in Vietnam time. Pass a Date or a timestamp and it writes the time and the day for the
// locale; with live and no time it follows the device clock. Strings still pass through as they are.
export function Clock(p: ClockProps) {
  const nowSt = useState(function () {
    return new Date();
  });
  const live = !!p.live && isNil(p.time);
  useEffect(
    function () {
      if (!live) return undefined;
      const id = setInterval(function () {
        nowSt[1](new Date());
      }, 15000);
      return function () {
        clearInterval(id);
      };
    },
    [live],
  );
  const v = live ? nowSt[0] : p.time;
  const d = typeof v === "string" ? null : toDate(v);
  const time = d ? formatTime(d) : v;
  const day = typeof p.day === "string" ? p.day : dayOf(isNil(p.day) ? d : toDate(p.day), p.locale);
  return (
    <div className={cx("r1-clock", p.className)} style={p.style}>
      <time className="r1-clock__time r1-num" dateTime={d ? d.toISOString() : undefined}>
        {time as React.ReactNode}
      </time>
      {day ? <span className="r1-clock__day">{day}</span> : null}
    </div>
  );
}
