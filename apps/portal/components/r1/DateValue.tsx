"use client";

import { R1_FORMAT } from "@rightone/formatting";
import {
  formatDate,
  formatPeriod,
  formatStamp,
  formatTime,
  formatTimestamp,
  offsetLabel,
  toDate,
} from "./lib/formatting";
import { cx, lang, pad2 } from "./lib/helpers";
import { tx } from "./lib/strings";
import { keepTogether, missingValue, valueSizeClass } from "./lib/value-atoms";
import type { ValueSize } from "./lib/value-atoms";
import type { Locale } from "./lib/types";

// The format rules live in @rightone/formatting (R23.7).
const TZ = R1_FORMAT.TZ;

export const formatDateShort: typeof R1_FORMAT.formatDateShort = R1_FORMAT.formatDateShort;

/** The fields vnParts fills: formatToParts gives every one of them for the options it is called with. */
type VnParts = Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;

// The day and the clock in Vietnam time, whatever zone the value was written in: a timestamp at 00:30 on the
// 17th in Hà Nội is the 17th, even though it is still the 16th in UTC.
function vnParts(d: Date): VnParts {
  const o: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(d)
    .forEach(function (x) {
      if (x.type !== "literal") o[x.type] = Number(x.value);
    });
  return o as VnParts;
}

// The machine value of a <time>: the Vietnam calendar day for a date, the Vietnam wall clock with its offset for a moment.
function machineDate(d: Date, withTime: boolean): string {
  const o = vnParts(d);
  const day = o.year + "-" + pad2(o.month) + "-" + pad2(o.day);
  if (!withTime) return day;
  const z = /GMT([+-])(\d+)(?::(\d+))?/.exec(offsetLabel(d));
  return (
    day +
    "T" +
    pad2(o.hour % 24) +
    ":" +
    pad2(o.minute) +
    ":" +
    pad2(o.second) +
    (z ? z[1] + pad2(Number(z[2])) + ":" + pad2(Number(z[3] || 0)) : "+07:00")
  );
}

// The Vietnamese administrative form (Nghị định 30/2020/NĐ-CP): "ngày 05 tháng 02 năm 2026", with a zero before
// a day under 10 and before the months 1 and 2.
function legalDate(d: Date): string {
  const o = vnParts(d);
  return "ngày " + pad2(o.day) + " tháng " + (o.month < 3 ? pad2(o.month) : o.month) + " năm " + o.year;
}

export type DateValueProps = {
  value: string | Date | null;
  to?: string | Date | undefined;
  mode?: "date" | "timestamp" | "stamp" | "period" | "time" | undefined;
  /** 'legal': the Vietnamese administrative form, "ngày 05 tháng 02 năm 2026" (vi only) */ form?:
    "default" | "legal" | undefined;
  /** time mode: false drops "(GMT+7)" under a header that states the zone */ zone?: boolean | undefined;
  /** date and period modes: the short month, "24 thg 9, 2026" / "24 Sep 2026" */ short?: boolean | undefined;
  missing?: string | undefined;
  /** Figma's Size: md is text-base, sm text-sm, each with its leading; left out, the date takes its container's type */ size?:
    ValueSize | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
};

export function DateValue(p: DateValueProps) {
  const t = tx(p.locale);
  const mode = p.mode || "date";
  const legal = p.form === "legal" && lang(p.locale) === "vi";
  const d = toDate(p.value),
    e = toDate(p.to);
  let s: string | null;
  if (mode === "period")
    s = legal
      ? d && e
        ? "từ " + legalDate(d) + " đến " + legalDate(e)
        : null
      : formatPeriod(p.value, p.to, p.locale, !!p.short);
  else if (mode === "timestamp")
    s =
      legal && d
        ? formatTime(d) + " " + legalDate(d) + " (" + offsetLabel(d) + ")"
        : formatTimestamp(p.value, p.locale);
  else if (mode === "stamp") s = formatStamp(p.value, p.locale);
  else if (mode === "time") s = d ? formatTime(d) + (p.zone === false ? "" : " (" + offsetLabel(d) + ")") : null;
  else s = legal && d ? legalDate(d) : p.short ? formatDateShort(p.value, p.locale) : formatDate(p.value, p.locale);
  const size = valueSizeClass(p.size);
  if (s === null) return missingValue(p.missing, t.noDate, cx(size, p.className));
  s = keepTogether(s);
  // A period is two days; it reads as one phrase and carries no single machine value.
  if (mode === "period") return <span className={cx("r1-date", size, p.className)}>{s}</span>;
  return (
    <time className={cx("r1-date", size, p.className)} dateTime={machineDate(d!, mode !== "date")}>
      {s}
    </time>
  );
}
