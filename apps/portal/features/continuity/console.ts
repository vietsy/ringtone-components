import { R1_FORMAT } from "@rightone/formatting";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/svc.en.json";
import vi from "@/messages/screens/svc.vi.json";

/** The SVC catalogue's translator (SCR-SVC-13, 14). */
export const svcTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

export const day = (value: string, locale: Locale) => R1_FORMAT.formatDate(value, locale) ?? "";
export const time = (value: string) => R1_FORMAT.formatTime(value) ?? "";
export const moment = (value: string, locale: Locale) => R1_FORMAT.formatTimestamp(value, locale) ?? "";
export const period = (from: string, to: string, locale: Locale) => R1_FORMAT.formatPeriod(from, to, locale) ?? "";
/** An availability as the board writes it: two decimals, "99,72 %". */
export const percent = (value: number, locale: Locale) => R1_FORMAT.formatPercent(value, locale, { decimals: 2 }) ?? "";

/**
 * A day from the request: an ISO date from a link, or the day/month/year the date field writes. Null when it is
 * neither, so a malformed day reads as no day chosen rather than as some other day.
 */
export function askedDay(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  const [y, m, d] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (y === undefined || m === undefined || d === undefined) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? date.toISOString().slice(0, 10) : null;
}

/** An instant from the request, as the date-and-time field writes it ("2026-09-30T02:15+07:00"); null otherwise. */
export function askedInstant(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?\+07:00$/.exec(value.trim());
  return match === null ? null : `${match[1]}T${match[2]}:00+07:00`;
}
