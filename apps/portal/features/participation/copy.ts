import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type { ParticipationState, PendingAmendment, ScopeKey } from "@/lib/api/participation";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/part.en.json";
import vi from "@/messages/screens/part.vi.json";

/** The participation screens' translator: `part.*` is shared by SCR-CAT-01, 02, 03 and 25, `partNN.*` belongs to one. */
export const partTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/*
 * Values put into a sentence go through the formatting layer. A value the API always sends is never missing,
 * so the empty string below is a type guard rather than a rendering.
 */
export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const time = (iso: string) => R1_FORMAT.formatTime(iso) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

/** SM-21's badge (SCR-CAT-02 list definition): ACTIVE is neutral, a fact rather than an achievement. */
const STATE_FAMILY: Readonly<Record<ParticipationState, Family>> = {
  APPLIED: "attention",
  APPROVED: "attention",
  ACTIVE: "neutral",
  SUSPENDED: "danger",
  WITHDRAWN: "danger",
};

export const participationStatus = (state: ParticipationState, t: Translate): StatusValue => ({ family: STATE_FAMILY[state], label: t(`part.state.${state}`) });

/** The shell's line under the organisation: its participation, as each board draws it, or that it has none. */
export function contextLine(standing: { reference: string | null; state: ParticipationState | null }, t: Translate): string {
  if (standing.reference === null) return t("part.contextNone");
  return t(standing.state === "SUSPENDED" ? "part.contextSuspended" : "part.context", { reference: standing.reference });
}

/** "Mechanical, domestic, Hải Phòng": a scope row named in full, as SCR-CAT-03's choices and summary write it. */
export const rowLabel = (key: ScopeKey, t: Translate) =>
  t("part.rowLabel", { right: t(`part.right.${key.right}`), repertoire: t(`part.repLower.${key.repertoire}`), territory: t(`part.terr.${key.territory}`) });

/** "Mechanical, Hải Phòng": a row of the comparison, which the board names without the domestic repertoire. */
export const comparisonLabel = (key: ScopeKey, t: Translate) =>
  key.repertoire === "dom" ? t("part.cmpLabel", { right: t(`part.right.${key.right}`), territory: t(`part.terr.${key.territory}`) }) : rowLabel(key, t);

/** "mechanical rights in Hải Phòng": a scope row inside a sentence. */
export const rowPhrase = (key: ScopeKey, t: Translate) =>
  t(key.repertoire === "dom" ? `part.phrase.${key.right}` : `part.phraseInt.${key.right}`, { territory: t(`part.terr.${key.territory}`) });

/** Several phrases in one sentence, joined as the language joins a list ("A, B và C", "A, B and C"). */
export const listOf = (items: readonly string[], locale: Locale) =>
  new Intl.ListFormat(locale === "en" ? "en-GB" : "vi", { type: "conjunction" }).format(items);

/** "Adds mechanical rights in Hải Phòng from 1 November 2026": a pending amendment's line on SCR-CAT-02. */
export function amendmentDetail(amendment: PendingAmendment, t: Translate, locale: Locale): string {
  const date = day(amendment.effectiveFrom, locale);
  const adds = listOf(amendment.additions.map((key) => rowPhrase(key, t)), locale);
  const closes = listOf(amendment.removals.map((key) => rowPhrase(key, t)), locale);
  if (amendment.removals.length === 0) return t("part02.adds", { rows: adds, date });
  if (amendment.additions.length === 0) return t("part02.closes", { rows: closes, date });
  return t("part02.addsCloses", { adds, closes, date });
}

/** A field's FIELD_MISSING sentence, "Territory is required.", from the family's refusal codes. */
export const fieldMissing = (label: string, t: Translate) => t("part.refusal.FIELD_MISSING", { field: label });

/** "418 KB": a document's size as the board writes it. */
export const sizeLabel = (bytes: number, t: Translate, locale: Locale) => t("part01.sizeKb", { n: count(Math.max(1, Math.round(bytes / 1024)), locale) });
