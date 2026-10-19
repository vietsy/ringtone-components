"use client";

import type * as React from "react";
import { StatusIcon } from "./StatusIcon";
import { formatTime, toDate } from "./lib/formatting";
import { cx, isNil } from "./lib/helpers";
import { dayOf } from "./lib/player-parts";
import type { Family, Locale } from "./lib/types";

export type DeviceBarProps = {
  premises?: string | undefined;
  device?: string | undefined;
  family?: Family | undefined;
  state?: string | undefined;
  detail?: string | undefined;
  time?: string | number | Date | undefined;
  day?: string | number | Date | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function DeviceBar(p: DeviceBarProps) {
  const family = p.family || "positive";
  const time = typeof p.time === "string" ? p.time : formatTime(p.time);
  const day =
    typeof p.day === "string"
      ? p.day
      : !isNil(p.day) || (!isNil(p.time) && typeof p.time !== "string")
        ? dayOf(toDate(isNil(p.day) ? p.time : p.day), p.locale)
        : null;
  return (
    <header className={cx("r1-devbar", p.className)} style={p.style}>
      <div className="r1-devbar__where">
        <span className="r1-devbar__premises">{p.premises || "RightOne Player"}</span>
        {p.device ? <span className="r1-devbar__device r1-mono">{p.device}</span> : null}
      </div>
      {p.state || p.detail ? (
        <div className="r1-devbar__health">
          {p.state ? (
            <span className={"r1-devbar__state r1-devbar__state--" + family} role="status">
              <StatusIcon family={family} size={24} cutout={family + "-tint"} />
              <span>{p.state}</span>
            </span>
          ) : null}
          {p.detail ? <span className="r1-devbar__detail">{p.detail}</span> : null}
        </div>
      ) : null}
      {time ? (
        <div className="r1-devbar__clock">
          <span className="r1-devbar__time r1-num">{time}</span>
          {day ? <span className="r1-devbar__day">{day}</span> : null}
        </div>
      ) : null}
    </header>
  );
}
