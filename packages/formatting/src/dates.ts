import { NO_VALUE, type Locale } from "./money.js";
import { dateIn, periodIn, timestampIn, TZ } from "./r1.js";

/**
 * Dates are never numeric-only. `09/07/2026` is July in one country and September in another, and
 * this product is read by inspectors, auditors and overseas rights organisations.
 *
 * The premises time zone is the default because every schedule and every evidence boundary in this
 * product is evaluated in Vietnam time (BR-VEN-11).
 */
export const PREMISES_TIME_ZONE = TZ;

export function formatDate(instant: Date, locale: Locale = "vi", timeZone = PREMISES_TIME_ZONE): string {
  return dateIn(instant, locale, timeZone) ?? NO_VALUE;
}

/**
 * A timestamp carries its zone whenever it could be misread - which, for anything an auditor
 * reads, is always. The offset is shown rather than the zone name because "GMT+7" survives a
 * photocopy and "Asia/Ho_Chi_Minh" means nothing to a reader outside engineering.
 */
export function formatTimestamp(instant: Date, locale: Locale = "vi", timeZone = PREMISES_TIME_ZONE): string {
  return timestampIn(instant, locale, timeZone) ?? NO_VALUE;
}

/** An explicit range. "September 2026" hides whether the last day is included. */
export function formatPeriod(from: Date, to: Date, locale: Locale = "vi", timeZone = PREMISES_TIME_ZONE): string {
  return periodIn(from, to, locale, false, timeZone) ?? NO_VALUE;
}
