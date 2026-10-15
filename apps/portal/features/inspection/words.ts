import { R1_FORMAT } from "@rightone/formatting";
import type { PremisesName, RefusalCode } from "@/lib/api/inspection";
import type { Locale, Translate } from "@/lib/i18n/translate";

/**
 * The way the inspector's boards turn catalogue sentences into what a Banner or an answer shows. Pure functions,
 * safe on the server: a page calls them with its translator.
 */

/**
 * A refusal sentence split as a Banner splits it: the first sentence is the title, the rest the text. The canvas
 * splits at the first full stop followed by a space, so a refusal reads the same here as on the board.
 */
export function splitSentence(sentence: string): { title: string; text: string } {
  const at = sentence.indexOf(". ");
  return at < 0 ? { title: sentence, text: "" } : { title: sentence.slice(0, at + 1), text: sentence.slice(at + 2) };
}

/** A refusal from the family's catalogue (design/04), word for word, with its code. */
export function refusalOf(t: Translate, code: RefusalCode): { code: RefusalCode; title: string; text: string } {
  return { code, ...splitSentence(t(`refusal.${code}`)) };
}

/** The whole refusal sentence, for a field error or a row message. */
export function refusalSentence(t: Translate, code: RefusalCode): string {
  return t(`refusal.${code}`);
}

/** A section title with its count after it, as the boards write "Chờ tải lên (1)". */
export function counted(t: Translate, label: string, count: number): string {
  return t("ver.counted", { label, n: R1_FORMAT.formatCount(count) ?? String(count) });
}

/** A premises named with its register address; by its name alone where the canvas gives no address. */
export function premisesAt(t: Translate, premises: PremisesName): string {
  return premises.address === null ? premises.name : t("ver.premisesAt", { name: premises.name, address: premises.address });
}

/** Words joined as the boards join a list of wards or kinds. */
export function joined(t: Translate, items: readonly string[]): string {
  return items.join(t("ver.separator"));
}

/** A timestamp in the shared format; the empty string for a value the formatter cannot read. */
export function timestamp(iso: string, locale: Locale): string {
  return R1_FORMAT.formatTimestamp(iso, locale) ?? "";
}

/** A date in the shared format; the empty string for a value the formatter cannot read. */
export function date(iso: string, locale: Locale): string {
  return R1_FORMAT.formatDate(iso, locale) ?? "";
}

/**
 * A read instant to the second (design/03 SCR-VER-02): the shared timestamp with its seconds written in after
 * the minutes, "30 thg 9, 2026, 10:14:03 (GMT+7)". Seconds are the same in every zone, so they are read in UTC.
 */
export function timestampToSecond(iso: string, locale: Locale): string {
  const shared = timestamp(iso, locale);
  const instant = R1_FORMAT.toDate(iso);
  if (shared === "" || instant === null) return shared;
  const seconds = String(instant.getUTCSeconds()).padStart(2, "0");
  return shared.replace(/(\d\d:\d\d)( \()/, `$1:${seconds}$2`);
}
