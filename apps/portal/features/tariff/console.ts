import { R1_FORMAT } from "@rightone/formatting";
import type { AppliedFactor, CalculationInput, ClassBasis, TariffLayer } from "@/lib/api/tariff";
import { holds, type Staff } from "@/lib/api/session";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import en from "@/messages/screens/tar.en.json";
import vi from "@/messages/screens/tar.vi.json";

/** The tariff catalogue's translator. */
export const tarTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

export const money = (amountMinor: number, locale: Locale) => R1_FORMAT.formatMoney(amountMinor, "VND", locale) ?? "";
export const day = (value: string, locale: Locale) => R1_FORMAT.formatDate(value, locale) ?? "";
export const moment = (value: string, locale: Locale) => R1_FORMAT.formatTimestamp(value, locale) ?? "";
export const period = (from: string, to: string, locale: Locale) => R1_FORMAT.formatPeriod(from, to, locale, true) ?? "";

/** The component codes of the tariff's content, as the console names each layer (convention 5). */
export const COMPONENT_CODE: Readonly<Record<TariffLayer, string>> = { AUTHORS: "CMP-WORK", PERFORMERS: "CMP-PERF", PRODUCERS: "CMP-REC" };

/** A class as the console codes it: `LC-1`, `PC-CAFE`. */
export const localityCode = (value: number) => `LC-${value}`;
export const premisesClassCode = (value: string) => `PC-${value.toUpperCase()}`;

/** A basis in `attention` when it rests on a declaration, as convention 6 draws it. */
export const basisFamily = (basis: ClassBasis) => (basis === "DECLARED" ? ("attention" as const) : ("neutral" as const));

/** A fact's value in words, the way REG's questions wrote it. */
export function factValue(input: CalculationInput, t: Translate, locale: Locale): string {
  switch (input.fact) {
    case "admin_area":
      return input.value;
    case "premises_class":
      return t(`tar.class.${input.value}`);
    case "customer_area":
      return t("tar.squareMetres", { n: R1_FORMAT.formatCount(input.value, locale) ?? String(input.value) });
    case "days_open":
      return t("tar.days", { n: input.value });
    case "music_method":
      return t(`tar.music.${input.value}`);
    case "use_began_on":
      return day(input.value, locale);
    case "seating_capacity":
      return t("tar.seats", { n: R1_FORMAT.formatCount(input.value, locale) ?? String(input.value) });
  }
}

/** A share or a factor kept in hundredths, read as the decimal it is: 0,25 and 1,2 in Vietnamese, 0.25 and 1.2 in English. */
export const hundredths = (value: number, locale: Locale) => R1_FORMAT.formatCount(value / 100, locale) ?? "";

/** A factor the calculator applied, as the console names it: its kind, its key in the content and its value. */
export function factorLine(factor: AppliedFactor, t: Translate, locale: Locale): string {
  return t(`tar.factor.${factor.kind}`, { key: factor.kind === "SIZE_BAND" ? bandWords(factor.key, t) : factor.key, value: hundredths(factor.factorHundredths, locale) });
}

/** A size band's key ("50-200", "200-") in words: from 50 to below 200 m², or from 200 m². */
function bandWords(key: string, t: Translate): string {
  const [from = "", to = ""] = key.split("-");
  return to === "" ? t("tar.bandFrom", { from }) : t("tar.band", { from, to });
}

export type TariffTab = "calculations" | "declared";

/**
 * The tariff workspace's link tabs: the calculations, read by the operations officer, the finance operator and the
 * auditor; and the declared classifications under reconciliation, read by the operations officer, the data owner and
 * the auditor (PERM-661).
 */
export function tariffTabs(staff: Staff, t: Translate) {
  return [
    ...(holds(staff, "ACT-OPS", "ACT-FIN-OP", "ACT-AUD") ? [{ id: "calculations", label: t("tar.tab.calculations"), href: routes.opsTariff() }] : []),
    ...(holds(staff, "ACT-OPS", "ACT-DAT", "ACT-AUD") ? [{ id: "declared", label: t("tar.tab.declared"), href: routes.opsDeclaredClasses() }] : []),
  ];
}

/**
 * A day from the request: an ISO date from a link, or the day/month/year the date field writes. Null when it is
 * neither, so a malformed day reads as no day chosen rather than as some other day.
 */
export function askedDay(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  const [y, m, d] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (y === undefined || m === undefined || d === undefined) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? date.toISOString().slice(0, 10) : null;
}
