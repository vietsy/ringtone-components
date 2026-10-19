"use client";

import * as React from "react";
import { formatCount, formatDate, formatStamp, formatTime } from "./formatting";
import { isNil } from "./helpers";
import { tx } from "./strings";
import { formatDuration } from "./time-limits";
import type { Family, Locale, PlayerCondition, PlayerLine, PlayerValue } from "./types";

// One list of Player conditions and their families, shared by PlayerStatusBlock, PlayerRail and PlayerAlert.
export const PLAYER_FAMILY: Record<PlayerCondition, Family> = {
  online: "positive",
  offline: "info",
  "limit-reached": "danger",
  stopped: "danger",
  "cannot-continue": "danger",
  ceiling: "attention",
  syncing: "info",
  fault: "danger",
  paused: "neutral",
  unpaired: "neutral",
};

// A value on the Player: a string passes through; a Date or a timestamp becomes a time or a stamp, a number a count.
// kind "time": a Date or a timestamp is written as the time of day.
export function playerValue(
  v: React.ReactNode | PlayerValue,
  locale: Locale | undefined,
  kind?: "time",
): React.ReactNode {
  if (isNil(v) || typeof v === "string" || React.isValidElement(v)) return v;
  if (kind === "time") return formatTime(v as PlayerValue) || (v as React.ReactNode);
  if (v instanceof Date) return formatStamp(v, locale);
  return typeof v === "number" ? formatCount(v, locale) : v;
}

// A span of hours in words, in hours and minutes only, as the licence counts it: "18 giờ 12 phút", "72 giờ".
export function hoursText(hours: number, locale: Locale | undefined): string {
  const u = tx(locale).units,
    mins = Math.max(0, Math.round((hours || 0) * 60)),
    hr = Math.floor(mins / 60),
    mn = mins % 60;
  function part(n: number, one: string, many: string) {
    return formatCount(n, locale) + " " + (n === 1 ? one : many);
  }
  return hr && mn
    ? part(hr, u.hour, u.hours) + " " + part(mn, u.minute, u.minutes)
    : hr
      ? part(hr, u.hour, u.hours)
      : part(mn, u.minute, u.minutes);
}

// A line with its values apart, so they follow the locale: { text: 'Đồng bộ lúc {at:time}', at: new Date(...) }.
// {key} formats a Date as a stamp and a number as a count; {key:time}, {key:date} and {key:duration} (ms) say how.
export function playerLine(
  line: PlayerLine | React.ReactElement | null | undefined,
  locale: Locale | undefined,
): React.ReactNode {
  if (isNil(line) || typeof line !== "object" || React.isValidElement(line)) return line;
  return String(line.text || "").replace(/\{(\w+)(?::(\w+))?\}/g, function (m: string, k: string, f: string | undefined) {
    const v = line[k];
    if (isNil(v)) return m;
    if (f === "time") return formatTime(v) || String(v);
    if (f === "date") return formatDate(v, locale) || String(v);
    if (f === "duration") return formatDuration(v as number, locale);
    // a string stays itself; a Date becomes a stamp and a number a count (playerValue)
    return String(playerValue(v, locale) as string | null);
  });
}
