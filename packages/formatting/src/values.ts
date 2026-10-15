import { NO_VALUE, type Locale } from "./money.js";
import { formatCount as r1Count } from "./r1.js";

/**
 * A percentage without its basis is a number nobody can check. The frontend standard requires the
 * basis to be stated wherever it is not obvious, so this function makes it a parameter rather than
 * an optional afterthought.
 */
export function formatPercentage(value: number | null, basis: string | null = null): string {
  if (value === null) return NO_VALUE;
  const rendered = `${(Math.round(value * 10) / 10).toString()}%`;
  return basis === null ? rendered : `${rendered} ${basis}`;
}

/**
 * Identifiers are rendered monospace with a copy control - the component supplies both; this
 * normalises the text. They are never lower-cased or re-spaced: an identifier a user reads off a
 * certificate must match the one on screen character for character.
 */
export function formatIdentifier(value: string | null): string {
  return value === null || value.trim().length === 0 ? NO_VALUE : value.trim();
}

/**
 * A count of zero is a fact and renders as 0. This is the opposite of money, and the difference is
 * deliberate: a zero count means "none, and we counted", which is exactly what the reader needs.
 */
export function formatCount(value: number | null, locale: Locale = "vi"): string {
  return r1Count(value, locale) ?? NO_VALUE;
}
