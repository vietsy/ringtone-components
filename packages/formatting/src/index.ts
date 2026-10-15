/**
 * @rightone/formatting
 *
 * Every money amount, date, period, percentage and identifier in the product is rendered here.
 * R23.7 bans an inline `toLocaleString` elsewhere, and the reason is not tidiness: the null-money
 * rule, the time zone on a timestamp and the basis on a percentage are each a correctness rule
 * that gets forgotten the moment it is a matter of remembering.
 */
export { formatMoney, isUnknown, isZero, NO_VALUE, type Locale, type Money } from "./money.js";
export { formatDate, formatPeriod, formatTimestamp, PREMISES_TIME_ZONE } from "./dates.js";
export { formatCount, formatIdentifier, formatPercentage } from "./values.js";
export { R1_FORMAT } from "./r1.js";
