import { R1_FORMAT } from "@rightone/formatting";
import type { GeographyLevel } from "@/lib/api/data-governance";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/dat.en.json";
import vi from "@/messages/screens/dat.vi.json";

/** The DAT catalogue's translator (SCR-DAT-04, 16). */
export const datTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

export const day = (value: string, locale: Locale) => R1_FORMAT.formatDate(value, locale) ?? "";
export const moment = (value: string, locale: Locale) => R1_FORMAT.formatTimestamp(value, locale) ?? "";

/** Levels in words, joined as a list ("Tỉnh, thành"); `form` picks the field's label, the sentence's or the summary's. */
export function levelWords(t: Translate, levels: readonly GeographyLevel[], form: "label" | "in" | "short"): string {
  return levels.map((level) => t(`dat16.level.${form}.${level}`)).join(t("dat16.levelJoin"));
}

/**
 * A day from a form or a link: an ISO date, or the day/month/year the date field writes. Null when it is neither, so
 * a malformed day reads as no day rather than as some other day.
 */
export function askedDay(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  const [y, m, d] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (y === undefined || m === undefined || d === undefined) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? date.toISOString().slice(0, 10) : null;
}
