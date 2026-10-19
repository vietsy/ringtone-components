import { R1_FORMAT } from "@rightone/formatting";
import type { FinanceCounts } from "@/lib/api/finance";
import { holds, type Staff } from "@/lib/api/session";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import en from "@/messages/screens/fin.en.json";
import vi from "@/messages/screens/fin.vi.json";

/** The finance catalogue's translator for a console page. */
export const finTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/** The shared format's words for a value inside a sentence; every value on a page is written the design system's way. */
export const money = (amountMinor: number, locale: Locale) => R1_FORMAT.formatMoney(amountMinor, "VND", locale) ?? "";
export const day = (value: string, locale: Locale) => R1_FORMAT.formatDate(value, locale) ?? "";
export const shortDay = (value: string, locale: Locale) => R1_FORMAT.formatDateShort(value, locale) ?? "";
export const moment = (value: string, locale: Locale) => R1_FORMAT.formatTimestamp(value, locale) ?? "";
export const period = (from: string, to: string, locale: Locale) => R1_FORMAT.formatPeriod(from, to, locale, true) ?? "";

/** A premises as the console writes it: its name, then its register record where PTY's register holds one. */
export const premisesLine = (premises: { name: string; record: string | null }) =>
  premises.record !== null ? `${premises.name}, ${premises.record}` : premises.name;

export type FinanceTab = "suspense" | "corrections" | "outstanding";

/**
 * The finance workspace's link tabs, the ones built of the board's five (Remittances and Period close have no page
 * yet, and a tab that leads nowhere is worse than none), each with the count of what is open. Suspense and
 * Corrections are the finance officer's, the finance approver's for what he decides, and the auditor's to read;
 * Outstanding is every finance reader's.
 */
export function financeTabs(staff: Staff, counts: FinanceCounts | null, t: Translate) {
  const count = (n: number | undefined) => (n !== undefined && n > 0 ? { count: n } : {});
  const reads = holds(staff, "ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD");
  return [
    ...(reads ? [{ id: "suspense", label: t("fin.tab.suspense"), href: routes.opsSuspense(), ...count(counts?.suspense) }] : []),
    ...(reads ? [{ id: "corrections", label: t("fin.tab.corrections"), href: routes.opsCorrections(), ...count(counts?.corrections) }] : []),
    { id: "outstanding", label: t("fin.tab.outstanding"), href: routes.opsFinance(), ...count(counts?.outstanding) },
  ];
}
