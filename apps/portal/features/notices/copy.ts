import { R1_FORMAT } from "@rightone/formatting";
import { templateSections, type NoticeContent, type NoticeReader, type NoticeWording } from "@/lib/api/notices";
import type { Principal } from "@/lib/api/session";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/com.en.json";
import vi from "@/messages/screens/com.vi.json";

/** The notice family's translator: `com.*` is shared by its screens, `com10.*`, `com12.*`, `comMine.*` belong to one. */
export const comTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/** Who reads: the principal signed in, or nobody, holding the notice's reference. */
export const readerOf = (principal: Principal | null): NoticeReader => ({
  party: principal?.organisation ?? null,
  account: principal?.account ?? null,
});

export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";

/** The six elements of a notice, in the order a person reads them (SCR-COM-10), in the reader's language. */
export interface NoticeElements {
  subject: string;
  action: string;
  deadline: string;
  consequence: string;
  contact: string;
}

const CATALOGUES = { vi, en } as const;

/** A period of one day as a schedule records it: "2026-09-25 18:00-22:00". */
const SLOT = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})-(\d{2}:\d{2})$/;

/**
 * The record's values in the reader's language: an amount with its currency, an instant, a day, a period of a day, a
 * value the catalogue words by its code (`com.value.<name>.<code>`: a change "revoked", an action "SUSPEND", which may
 * name the other values), and anything else as it was recorded.
 */
function valuesIn(values: NoticeContent["values"], t: Translate, locale: Locale): Record<string, string> {
  const shown: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    const slot = typeof value === "string" ? SLOT.exec(value) : null;
    if (name === "amount" && typeof value === "number") shown[name] = R1_FORMAT.formatMoney(value, String(values.currency ?? "VND"), locale) ?? "";
    else if (slot !== null) shown[name] = t("com.slot", { day: day(slot[1] ?? "", locale), start: slot[2] ?? "", end: slot[3] ?? "" });
    else if (typeof value === "string" && (name.endsWith("At") || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value))) shown[name] = moment(value, locale);
    else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) shown[name] = day(value, locale);
    else shown[name] = String(value);
  }
  const words: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    const key = `com.value.${name}.${String(value)}`;
    if (Object.prototype.hasOwnProperty.call(CATALOGUES[locale], key)) words[name] = t(key, shown);
  }
  return { ...shown, ...words };
}

const fill = (text: string, values: Readonly<Record<string, string>>) => text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);

/**
 * The content as its template version composed it, in the reader's language: the version's own words (its subject,
 * what to do, what follows) with the record's values filled in, the deadline the event recorded, and the office the
 * register named. A notice composed while no version was approved in the reader's language reads in the language it
 * was composed in.
 */
export function elementsOf(content: NoticeContent, t: Translate, locale: Locale): NoticeElements {
  const wording: NoticeWording | null = content.wording[locale] ?? content.wording.vi ?? content.wording.en;
  const values = valuesIn(content.values, t, locale);
  return {
    subject: fill(wording?.subject ?? "", values),
    action: fill(wording?.action ?? "", values),
    deadline: day(content.deadline, locale),
    consequence: fill(wording?.consequence ?? "", values),
    contact: t("com.contact", { office: t(`com.office.${content.contact.role}`), phone: content.contact.phone, address: content.contact.address }),
  };
}

/**
 * A template body as a notice would read it (SCR-COM-04's preview): its words filled with the values of the latest
 * notice of its class where there is one, each value still named where there is none.
 */
export function previewOf(body: string, versionNo: number, sample: NoticeContent | null, t: Translate, locale: Locale): NoticeElements {
  const sections = templateSections(body);
  const words: NoticeWording = { templateVersion: versionNo, subject: sections.subject ?? "", action: sections.action ?? "", consequence: sections.consequence ?? "" };
  if (sample === null) return { subject: words.subject, action: words.action, deadline: "{deadline}", consequence: words.consequence, contact: "{contact}" };
  return elementsOf({ ...sample, wording: { vi: words, en: words } }, t, locale);
}

/** A single query value; a repeated or absent one reads as none. */
export const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
