import { formatMoney as r1Money } from "./r1.js";

export type Locale = "vi" | "en";

/**
 * Money always carries its currency, and is never rendered by an inline `toLocaleString` (R23.7).
 *
 * The rule that matters most is `formatMoney(null)`. A blank where an amount belongs reads as
 * zero, and in every finance screen in this product zero and unknown are different facts: zero
 * means the obligation was calculated and came to nothing, unknown means it has not been
 * calculated. A premises disputing a fee, and the officer answering them, need to tell those
 * apart.
 */
export interface Money {
  /** Minor units, as an integer. Never a float: currency arithmetic on floats loses money. */
  amountMinor: number;
  /** ISO 4217. */
  currency: string;
}

/** What a null amount renders as. Not "0", not "", not "N/A". */
export const NO_VALUE = "-";

export function formatMoney(value: Money | null, locale: Locale = "vi"): string {
  if (value === null) return NO_VALUE;
  // R1's rule: the dong carries its code after the amount ("1.250.000 VND"), other currencies their symbol.
  return r1Money(value.amountMinor, value.currency, locale) ?? NO_VALUE;
}

export function isZero(value: Money | null): boolean {
  return value !== null && value.amountMinor === 0;
}

/** Guards the distinction at the type level as well as at the screen. */
export function isUnknown(value: Money | null): value is null {
  return value === null;
}
