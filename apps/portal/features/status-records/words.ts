import { R1_FORMAT } from "@rightone/formatting";
import type { FollowUpState, KeyState, RecordStatus, ReviewState, Written } from "@/lib/api/status-records";
import type { Locale, Translate } from "@/lib/i18n/translate";

/*
 * How the CER screens say things: a status as its word on a badge of its family (design/03 convention 7), a
 * reason as the person wrote it, a time in Vietnam time, a delay in hours and minutes.
 */

type Family = "positive" | "attention" | "danger" | "neutral" | "info";

const RECORD_FAMILY: Readonly<Record<RecordStatus, Family>> = {
  PENDING_ISSUE: "attention",
  ACTIVE: "info",
  EXPIRING: "attention",
  EXPIRED: "neutral",
  SUSPENDED: "danger",
  REINSTATED: "info",
  REVOKED: "danger",
  CANCELLED: "neutral",
  REPLACED: "neutral",
};

/** A record's status on its badge: Active and Reinstated wear the seal; every other status its family's badge. */
export function recordStatus(t: Translate, status: RecordStatus): { family: Family; label: string; variant?: "seal" } {
  const badge = { family: RECORD_FAMILY[status], label: t(`cer.status.${status}`) };
  return status === "ACTIVE" || status === "REINSTATED" ? { ...badge, variant: "seal" } : badge;
}

export function reviewStatus(t: Translate, state: ReviewState): { family: Family; label: string } {
  return { family: state === "OPEN" || state === "PROPOSED" ? "attention" : "neutral", label: t(`cer.review.${state}`) };
}

export function followUpStatus(t: Translate, state: FollowUpState): { family: Family; label: string } {
  const family: Family = state === "OVERDUE" ? "danger" : state === "OPEN" ? "attention" : "neutral";
  return { family, label: t(`cer.followUp.${state}`) };
}

export function keyStatus(t: Translate, state: KeyState): { family: Family; label: string } {
  const family: Family = state === "ACTIVE" ? "positive" : state === "REVOKED" ? "danger" : "neutral";
  return { family, label: t(`cer.key.${state}`) };
}

/** Words a person wrote: the canvas's in the reader's language, a typed reason as typed. */
export const written = (text: Written | null, locale: Locale): string | null => (text === null ? null : typeof text === "string" ? text : text[locale]);

/** "1 thg 10, 2026, 14:00 (GMT+7)": an instant with its date. */
export const timestamp = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? iso;

/** "1 tháng 10, 2026": a date in words. */
export const date = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? iso;

/** "18 Sep, 11:40": an instant in a dense cell, without the year. */
export const stamp = (iso: string, locale: Locale) => R1_FORMAT.formatStamp(iso, locale) ?? iso;

/** "1 thg 10, 2026, 00:00": an instant in a column whose header states the zone once. */
export const columnTime = (iso: string, locale: Locale) => `${R1_FORMAT.formatDateShort(iso, locale) ?? iso}, ${R1_FORMAT.formatTime(iso) ?? ""}`;

/** "986.000 VND". */
export const money = (amountMinor: number, locale: Locale) => R1_FORMAT.formatMoney(amountMinor, "VND", locale) ?? "";

/** A delay in hours and minutes, as the follow-ups count it: "10 giờ 14 phút". */
export function duration(t: Translate, ms: number, locale: Locale): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return t("cer.dur", { h: R1_FORMAT.formatCount(hours, locale) ?? String(hours), m: String(minutes % 60) });
}

/** The decision's fee as a record page notes it: paid by card or transfer and when, or by when it is to be paid. */
export function feeNote(
  fee: { amountMinor: number; paid: { at: string; method: "card" | "transfer" | null } | null; payBy: string | null } | null,
  t: Translate,
  locale: Locale,
): string | null {
  if (fee === null) return null;
  const amount = money(fee.amountMinor, locale);
  if (fee.paid !== null) {
    // A payment the data dates without a time is said by its day.
    const at = fee.paid.at.length === 10 ? date(fee.paid.at, locale) : timestamp(fee.paid.at, locale);
    const key = fee.paid.method === "card" ? "cer02.paidCard" : fee.paid.method === "transfer" ? "cer02.paidTransfer" : "cer02.paid";
    return t(key, { fee: amount, ts: at });
  }
  return fee.payBy !== null ? t("cer02.unpaid", { fee: amount, d: date(fee.payBy, locale) }) : t("cer02.unpaidNoDate", { fee: amount });
}
