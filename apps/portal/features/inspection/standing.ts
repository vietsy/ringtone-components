import { R1_FORMAT } from "@rightone/formatting";
import type { RefusalCode, Standing, StaffStamp } from "@/lib/api/inspection";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { refusalOf, splitSentence } from "./words";

/**
 * What the operations console's inspection pages share (SCR-VER-09 to 12): the words of a standing, the tabs,
 * and the refusals whose sentence names a date or a case. Pure functions, safe on the server.
 */

/** A designation's or an appointment's state in its family: in force positive, waiting attention (section 5c). */
const FAMILY: Readonly<Record<Standing, "positive" | "attention" | "danger" | "neutral">> = {
  PENDING_APPROVAL: "attention",
  ACTIVE: "positive",
  SUSPENDED: "danger",
  REFUSED: "danger",
  ENDED: "neutral",
};

export function standingStatus(t: Translate, state: Standing, detail: string | null): { family: "positive" | "attention" | "danger" | "neutral"; label: string; detail?: string } {
  return { family: FAMILY[state], label: t(`console.standing.${state}`), ...(detail !== null ? { detail } : {}) };
}

/** "Ghi nhận bởi Phan Gia Lượng lúc 29 thg 9, 2026, 15:20 (GMT+7)". */
export function recordedBy(t: Translate, stamp: StaffStamp, locale: Locale): string {
  return t("ver09.recordedBy", { name: stamp.name, t: R1_FORMAT.formatTimestamp(stamp.at, locale) ?? "" });
}

/**
 * A refusal whose sentence names something - END_DATE_EXTENDS_PERIOD the approved end, CHALLENGE_ALREADY_OPEN the
 * case, SUBJECT_SUPERSEDED the version - with the value written in; any other refusal as the catalogue gives it.
 */
export function refusalNaming(t: Translate, code: RefusalCode, detail: string | null, locale: Locale): { code: RefusalCode; title: string; text: string } {
  if (detail === null) return refusalOf(t, code);
  const value = /^\d{4}-\d{2}-\d{2}$/.test(detail) ? (R1_FORMAT.formatDate(detail, locale) ?? detail) : detail;
  return { code, ...splitSentence(t(`refusal.${code}`, { date: value, case: value, version: value })) };
}

/** The whole sentence of such a refusal, for a field's error. */
export function sentenceNaming(t: Translate, code: RefusalCode, detail: string | null, locale: Locale): string {
  const { title, text } = refusalNaming(t, code, detail, locale);
  return text === "" ? title : `${title} ${text}`;
}

/** The last day of the month an instant falls in, in Vietnam time: the end date an ending dialog opens on. */
export function endOfMonth(iso: string): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const [year, month] = day.split("-").map(Number);
  if (year === undefined || month === undefined) return day;
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}

/** SCR-VER-09 and 11's tabs: the authorities and the appointments, each a page. */
export function standingTabs(t: Translate) {
  return [
    { id: "authorities", label: t("ver09.tabAuth"), href: routes.opsInspectionAuthorities() },
    { id: "appointments", label: t("ver09.tabAppt"), href: routes.opsInspectorAppointments() },
  ];
}

/** SCR-VER-10 and 12's tabs: what waits for a decision, designations and appointments, with their counts. */
export function decisionTabs(t: Translate, designations: number, appointments: number) {
  return [
    { id: "designations", label: t("ver10.tabDes"), count: designations, href: routes.opsDesignationDecisions() },
    { id: "appointments", label: t("ver10.tabAppt"), count: appointments, href: routes.opsAppointmentDecisions() },
  ];
}

/** A month ("2026-09") in words: "tháng 9, 2026" in a sentence, "Tháng 9, 2026" as a choice ("September 2026"). */
export function monthWords(t: Translate, period: string, place: "in-sentence" | "option"): string {
  const [year, month] = period.split("-");
  return t(place === "option" ? "ver16.monthOption" : "ver16.month", { m: t(`ver16.m${String(Number(month))}`), y: year ?? "" });
}
