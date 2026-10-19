"use client";

import { tx } from "./strings";
import type { Locale } from "./types";

export function formatDuration(ms: number, locale: Locale | undefined): string {
  const u = tx(locale).units;
  const mins = Math.max(1, Math.round(Math.abs(ms) / 60000));
  const d = Math.floor(mins / 1440),
    hr = Math.floor((mins % 1440) / 60),
    mn = mins % 60;
  function part(n: number, one: string, many: string) {
    return n + " " + (n === 1 ? one : many);
  }
  if (d) return part(d, u.day, u.days) + (hr ? " " + part(hr, u.hour, u.hours) : "");
  if (hr) return part(hr, u.hour, u.hours) + (mn ? " " + part(mn, u.minute, u.minutes) : "");
  return part(mn, u.minute, u.minutes);
}
