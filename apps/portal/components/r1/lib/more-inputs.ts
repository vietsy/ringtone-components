"use client";

import { isNil, pad2 } from "./helpers";

// A time as people type it: 18:30, 18h30, 18.30, or 1830 from a number pad that has no colon.
export function parseTime(s: string | null | undefined, endOfDay?: boolean): string | null {
  const str = String(isNil(s) ? "" : s).trim();
  if (!str) return null;
  let hh: number, mm: number;
  const m = /^(\d{1,2})\s*[:hH.,\s]\s*(\d{1,2})?$/.exec(str);
  if (m) {
    hh = +m[1]!;
    mm = m[2] ? +m[2] : 0;
  } else if (/^\d{1,4}$/.test(str)) {
    if (str.length <= 2) {
      hh = +str;
      mm = 0;
    } else {
      hh = +str.slice(0, -2);
      mm = +str.slice(-2);
    }
  } else return null;
  if (mm > 59) return null;
  if (hh === 24 && mm === 0) return endOfDay ? "24:00" : null;
  if (hh > 23) return null;
  return pad2(hh) + ":" + pad2(mm);
}

// A time on a step of minutes (step 15: 18:00, 18:15 ...): the nearest step, never past the end of the day.
export function snapTime(v: string | null, step: number | undefined, endOfDay: boolean | undefined): string | null {
  if (!v || !step || step <= 1) return v;
  const x = v.split(":"),
    mins = Number(x[0]) * 60 + Number(x[1]);
  const last = endOfDay ? 1440 : Math.floor(1439 / step) * step;
  const r = Math.min(Math.round(mins / step) * step, last);
  return pad2(Math.floor(r / 60)) + ":" + pad2(r % 60);
}
