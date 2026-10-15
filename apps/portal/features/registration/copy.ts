import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type { ApplicationStatus, MissingItem, Period } from "@/lib/api/registration";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/reg.en.json";
import vi from "@/messages/screens/reg.vi.json";

/** The registration family's translator: `reg.*` is shared by its screens, `regNN.*` belongs to one. */
export const regTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/** The data sheet's family for each application state; colour is only the second signal. */
const STATUS_FAMILY: Readonly<Record<ApplicationStatus, Family>> = {
  DRAFT: "neutral",
  SUBMITTED: "neutral",
  UNDER_REVIEW: "attention",
  EVIDENCE_REQUIRED: "attention",
  DECIDED: "neutral",
  REFUSED: "danger",
  WITHDRAWN: "info",
  CLOSED_INCOMPLETE: "attention",
};

export function applicationStatus(status: ApplicationStatus, t: Translate): StatusValue {
  return { family: STATUS_FAMILY[status], label: t(`reg.status.${status}`) };
}

/*
 * Values put into a sentence go through the formatting layer. A value the API always sends is never
 * missing, so the empty string below is a type guard rather than a rendering.
 */
export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const span = (period: Period, locale: Locale) => R1_FORMAT.formatPeriod(period.from, period.to, locale) ?? "";
export const money = (amountMinor: number, currency: string, locale: Locale) => R1_FORMAT.formatMoney(amountMinor, currency, locale) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";
export const percent = (value: number, locale: Locale) => R1_FORMAT.formatPercent(value, locale) ?? "";

/** "7 days" / "7 ngày": the days-open answer as the review and the select read it. */
export const daysOpen = (days: number, t: Translate, locale: Locale) =>
  days === 1 ? t("reg.dayOne") : t("reg.days", { n: count(days, locale) });

/** An item still needed, by name: the question for a fact, the document otherwise. */
export const missingTitle = (missing: MissingItem, t: Translate) =>
  missing.for === "FACTS" ? t(`reg.question.${missing.question}`) : t(`reg.doc.${missing.item}`);

/** What a missing item is for: the questions, the rules, or the claim on one rights layer. */
export const missingFor = (missing: MissingItem, t: Translate) =>
  missing.for === "CLAIM" ? t(`reg.missing.forClaim.${missing.layer}`) : t(`reg.missing.for.${missing.for}`);

/** A key for a missing item, unique within one list. */
export const missingKey = (missing: MissingItem) =>
  missing.for === "FACTS" ? `FACTS-${missing.question}` : missing.for === "RULES" ? `RULES-${missing.item}` : `CLAIM-${missing.layer}-${missing.item}`;

/** "Còn thiếu 3 mục" / "Three items still needed": the canvas's words for three, digits for any other count. */
export const missingCount = (count: number, t: Translate, locale: Locale) =>
  count === 1 ? t("reg.missing.titleOne") : count === 3 ? t("reg.missing.title") : t("reg.missing.titleMany", { count: R1_FORMAT.formatCount(count, locale) ?? "" });
