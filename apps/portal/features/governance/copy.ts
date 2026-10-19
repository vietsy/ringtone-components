import { R1_FORMAT } from "@rightone/formatting";
import type { GovRefusal, Localised, MandateRegister, ScopeRow } from "@/lib/api/governance";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/gov.en.json";
import vi from "@/messages/screens/gov.vi.json";

/** The governance family's translator: `gov.*` is shared by its screens, `gov14.*` and `gov15.*` belong to one. */
export const govTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/*
 * Values put into a sentence go through the formatting layer. A value the API always sends is never missing,
 * so the empty string below is a type guard rather than a rendering.
 */
export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

export const localised = (value: Localised, locale: Locale) => value[locale];

/** "1,4 MB" / "1.4 MB", "418 KB": a chosen file's size as the boards write it. */
export function fileSize(bytes: number, t: Translate, locale: Locale): string {
  if (bytes < 1_000_000) return t("gov.sizeKb", { n: count(Math.max(1, Math.round(bytes / 1_000)), locale) });
  return t("gov.sizeMb", { n: count(Math.round(bytes / 100_000) / 10, locale) });
}

/** A right type's words; the set is the boards' (GOV-14 and CAT-02). */
export const rightLabel = (rightType: string, t: Translate) => t(`gov.right.${rightType}`);

/** A repertoire key's words: `*` is the whole repertoire, a key the boards name has its words, any other reads as itself. */
export function repertoireLabel(key: string, t: Translate): string {
  if (key === "*") return t("gov.repertoire.all");
  if (key === "domestic") return t("gov.repertoire.domestic");
  return key;
}

export const provinceName = (code: string, register: MandateRegister) =>
  register.provinces.find((province) => province.code === code)?.name ?? code;

/**
 * The represented rights as SCR-GOV-14 lists them: one item per row, the province first and the right and
 * repertoire under it. Keys are the rows' places, since two rows may share a province.
 */
export function scopeItems(rows: readonly ScopeRow[], register: MandateRegister, t: Translate) {
  return rows.map((row, index) => ({
    key: String(index),
    title: provinceName(row.territory, register),
    detail: t("gov14.scopeDetail", { right: rightLabel(row.rightType, t), repertoire: repertoireLabel(row.repertoire, t) }),
  }));
}

/** "4 dòng" / "4 rows". */
export const rowCount = (rows: number, t: Translate, locale: Locale) =>
  rows === 1 ? t("gov14.rowCountOne") : t("gov14.rowCount", { n: count(rows, locale) });

/**
 * A refusal's sentence, with the meaning of GOV `04-refusal-codes.md` written short for the screen, its placeholders filled with what the
 * refusal names. `fieldKey` names the field's words where the sentence names a field.
 */
export function refusalSentence(refusal: GovRefusal, fieldKey: string | null, t: Translate, locale: Locale): string {
  switch (refusal.code) {
    case "FIELD_MISSING": {
      const field = fieldKey !== null ? t(fieldKey) : "";
      return t("gov.refusal.FIELD_MISSING", { field });
    }
    case "RANGE_OVERLAP": {
      // A held range with no recorded start (a mandate the canvas implies but never draws) reads as R1's dash.
      const range = refusal.range;
      const to = range !== null ? range.to : null;
      return t("gov.refusal.RANGE_OVERLAP", {
        from: range !== null ? day(range.from, locale) : "–",
        to: to !== null ? day(to, locale) : t("gov.openEndedLower"),
      });
    }
    default:
      return t(`gov.refusal.${refusal.code}`);
  }
}
