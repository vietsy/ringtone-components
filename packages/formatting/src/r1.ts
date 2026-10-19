import type { Locale } from "./money.js";

/**
 * The format rules of the design system R1, ported from the design system's component bundle so that
 * its components and this package render a value one way (R23.7). The portal's R1 components
 * (`apps/portal/components/r1`) take these functions through `lib/formatting.ts` instead of carrying a copy
 * of their own, so a change of a format rule in the design system is ported here.
 *
 * The exported functions keep the design system's signatures exactly, because the components and
 * the screens call them positionally. Every one returns `null` for a value it cannot render: a component
 * draws its own dash for a null, read aloud as "not calculated", and this package's older functions turn
 * it into `NO_VALUE`. The `*In` helpers take a time zone and serve those older functions.
 */

/** The premises time zone: every schedule and evidence boundary is evaluated in Vietnam time (BR-VEN-11). */
export const TZ = "Asia/Ho_Chi_Minh";

/** Currencies with no minor unit. Formatting the dong with decimals invents precision. */
export const ZERO_MINOR: Readonly<Record<string, 1>> = { VND: 1, JPY: 1, KRW: 1 };

/** The design system passes a locale through untyped; anything but "en" reads as Vietnamese. */
type LocaleInput = string | null | undefined;
type DateInput = string | number | Date | null | undefined;
type NumberInput = number | string | null | undefined;

function lang(locale: LocaleInput): Locale {
  return locale === "en" ? "en" : "vi";
}

function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function nf(locale: LocaleInput, opts?: Intl.NumberFormatOptions): Intl.NumberFormat {
  return new Intl.NumberFormat(lang(locale) === "en" ? "en-GB" : "vi-VN", opts ?? {});
}

/** A negative figure takes the minus sign U+2212, never the hyphen, in every value component. */
export function minus<T>(value: T): T {
  return (typeof value === "string" ? value.replace(/^-/, "−") : value) as T;
}

/** A count: zero renders as 0, because "none, and we counted" is what the reader needs. */
export function formatCount(value: NumberInput, locale?: LocaleInput): string | null {
  if (isNil(value)) return null;
  return minus(nf(locale).format(Number(value)));
}

/**
 * The digits of a percentage. Without `decimals` it keeps at most one decimal; `decimals` fixes the count,
 * for a figure stored to a set precision.
 */
export function percentDigits(value: number, locale?: LocaleInput, decimals?: NumberInput): string {
  const fixed =
    isNil(decimals) || decimals === "" || Number.isNaN(Number(decimals))
      ? null
      : Math.max(0, Math.min(20, Math.floor(Number(decimals))));
  return minus(
    nf(locale, fixed === null ? { maximumFractionDigits: 1 } : { minimumFractionDigits: fixed, maximumFractionDigits: fixed }).format(value),
  );
}

/** "96,4 %" in Vietnamese, with a no-break space before the sign; "96.4%" in English. */
export function formatPercent(
  value: NumberInput,
  locale?: LocaleInput,
  opts?: number | { decimals?: NumberInput } | null,
): string | null {
  if (isNil(value) || value === "" || Number.isNaN(Number(value))) return null;
  const decimals = typeof opts === "number" ? opts : opts?.decimals;
  return percentDigits(Number(value), locale, decimals) + (lang(locale) === "en" ? "%" : "\u00a0%");
}

/**
 * The dong is written with its code after the amount in every language: the amount, a no-break space,
 * then VND ("1.250.000 VND", "1,250,000 VND"). Other currencies follow the reader's language. `bare` gives
 * the digits alone, for a table column that names its currency in the header.
 */
export function formatMoney(
  amountMinor: NumberInput,
  currency?: string | null,
  locale?: LocaleInput,
  bare?: unknown,
): string | null {
  if (isNil(amountMinor)) return null;
  const code = currency ?? "VND";
  const digits = ZERO_MINOR[code] ? 0 : 2;
  const major = Number(amountMinor) / 10 ** digits;
  if (bare) return minus(nf(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major));
  if (code === "VND") return `${minus(nf(locale, { maximumFractionDigits: 0 }).format(major))}\u00a0VND`;
  try {
    return minus(
      nf(locale, {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(major),
    );
  } catch {
    return `${minus(nf(locale).format(major))} ${code}`;
  }
}

export function toDate(value: DateInput): Date | null {
  if (isNil(value) || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A date formatter in the premises time zone; an option may set another zone (the calendar's month title). */
export function dtf(locale: LocaleInput, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return dtfIn(locale, opts, TZ);
}

/** "GMT+7": an offset survives a photocopy, a zone name means nothing to a reader outside engineering. */
export function offsetLabel(date: Date): string {
  return offsetIn(date, TZ);
}

/** A date is never numeric-only: "17 tháng 9, 2026", "17 September 2026". */
export function formatDate(value: DateInput, locale?: LocaleInput): string | null {
  return dateIn(value, locale, TZ);
}

export function formatTime(value: DateInput): string | null {
  return timeIn(value, TZ);
}

/** ICU writes September's short form as "Sept"; R1 writes "Sep", like every other month. */
export function shortMonth(value: string): string {
  return value.replace(/\bSept\b/, "Sep");
}

/** A timestamp carries its offset: "17 thg 9, 2026, 08:15 (GMT+7)". */
export function formatTimestamp(value: DateInput, locale?: LocaleInput): string | null {
  return timestampIn(value, locale, TZ);
}

/** For a column whose header already states the zone: "28 Sep, 12:20". */
export function formatStamp(value: DateInput, locale?: LocaleInput): string | null {
  const date = toDate(value);
  if (date === null) return null;
  return `${shortMonth(dtf(locale, { day: "numeric", month: "short" }).format(date))}, ${formatTime(date) ?? ""}`;
}

/** The short month, for a dense console column: "24 thg 9, 2026", "24 Sep 2026". Still never numeric-only. */
export function formatDateShort(value: DateInput, locale?: LocaleInput): string | null {
  return dateShortIn(value, locale, TZ);
}

/**
 * An explicit range, so whether the last day is included is not in doubt. Within one month the first day
 * is written once ("1–30 tháng 9, 2026"); across months both ends are spelled. `short` uses the short month.
 */
export function formatPeriod(from: DateInput, to: DateInput, locale?: LocaleInput, short?: unknown): string | null {
  return periodIn(from, to, locale, Boolean(short), TZ);
}

// ----------------------------------------------------------------- with a time zone

export function dtfIn(locale: LocaleInput, opts: Intl.DateTimeFormatOptions | undefined, timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(lang(locale) === "en" ? "en-GB" : "vi-VN", { timeZone, ...opts });
}

export function offsetIn(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" }).formatToParts(date);
    const zone = parts.find((part) => part.type === "timeZoneName");
    if (zone !== undefined) return zone.value;
  } catch {
    // An engine without shortOffset falls back to the premises offset.
  }
  return "GMT+7";
}

export function dateIn(value: DateInput, locale: LocaleInput, timeZone: string): string | null {
  const date = toDate(value);
  return date === null ? null : dtfIn(locale, { day: "numeric", month: "long", year: "numeric" }, timeZone).format(date);
}

export function dateShortIn(value: DateInput, locale: LocaleInput, timeZone: string): string | null {
  const date = toDate(value);
  return date === null
    ? null
    : shortMonth(dtfIn(locale, { day: "numeric", month: "short", year: "numeric" }, timeZone).format(date));
}

export function timeIn(value: DateInput, timeZone: string): string | null {
  const date = toDate(value);
  return date === null
    ? null
    : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function timestampIn(value: DateInput, locale: LocaleInput, timeZone: string): string | null {
  const date = toDate(value);
  if (date === null) return null;
  const day = shortMonth(dtfIn(locale, { day: "numeric", month: "short", year: "numeric" }, timeZone).format(date));
  return `${day}, ${timeIn(date, timeZone) ?? ""} (${offsetIn(date, timeZone)})`;
}

export function periodIn(from: DateInput, to: DateInput, locale: LocaleInput, short: boolean, timeZone: string): string | null {
  const start = toDate(from);
  const end = toDate(to);
  if (start === null || end === null) return null;
  const day = (date: Date) => (short ? dateShortIn(date, locale, timeZone) : dateIn(date, locale, timeZone)) ?? "";
  const month = (date: Date) => dtfIn("en", { month: "2-digit", year: "numeric" }, timeZone).format(date);
  if (month(start) !== month(end)) return `${day(start)} – ${day(end)}`;
  return `${dtfIn("en", { day: "numeric" }, timeZone).format(start)}–${day(end)}`;
}

/**
 * The set the generated R1 component module imports, under the names the design system's bundle uses.
 * Adding or renaming a member is a change to that contract: the generator checks every name exists.
 */
export const R1_FORMAT = {
  TZ,
  ZERO_MINOR,
  nf,
  minus,
  formatCount,
  percentDigits,
  formatPercent,
  formatMoney,
  toDate,
  dtf,
  offsetLabel,
  formatDate,
  formatTime,
  shortMonth,
  formatTimestamp,
  formatStamp,
  formatDateShort,
  formatPeriod,
} as const;
