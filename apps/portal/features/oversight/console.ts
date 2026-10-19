import { R1_FORMAT } from "@rightone/formatting";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/pub-oversight.en.json";
import vi from "@/messages/screens/pub-oversight.vi.json";

/** The oversight catalogue's translator (SCR-PUB-19, 20). */
export const oversightTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/**
 * The words for a code the counts carry, or the code itself where the catalogue has none: a route that starts
 * answering with a new outcome is a compatible change of the API, and the count must still show.
 */
export function codeWords(t: Translate, group: "outcome" | "cause", code: string): string {
  const key = `pub19.${group}.${code}`;
  return key in vi ? t(key) : code;
}

export const moment = (value: string, locale: Locale) => R1_FORMAT.formatTimestamp(value, locale) ?? "";
export const day = (value: string, locale: Locale) => R1_FORMAT.formatDate(value, locale) ?? "";

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
