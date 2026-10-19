"use client";

/** A calendar day: the year, the month (1 to 12) and the day of the month. */
export type Ymd = { y: number; m: number; d: number };

export function ymd(v: string | null | undefined): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return m ? { y: +m[1]!, m: +m[2]!, d: +m[3]! } : null;
}

export function ymdKey(o: Ymd): string {
  return o.y + "-" + (o.m < 10 ? "0" : "") + o.m + "-" + (o.d < 10 ? "0" : "") + o.d;
}

export function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
