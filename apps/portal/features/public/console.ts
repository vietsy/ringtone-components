import { R1_FORMAT } from "@rightone/formatting";
import type { StatusValue } from "@/components/r1";
import type { DocumentClass, DocumentKind, PolicyReader, PolicyRefusal, VersionLine, VersionPhase, VersionStatus } from "@/lib/api/public";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/pub.en.json";
import vi from "@/messages/screens/pub.vi.json";

/**
 * What the policy console's screens and the help route register share (SCR-PUB-14 to 18): their catalogue, the
 * refusal sentences of `04-refusal-codes.md`, how an instant and a version's state are written, and what the reader's
 * roles let them do.
 */

export const pubTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/**
 * The refusal of a command as a banner writes it: the code's first sentence as the title, the rest as its text, with
 * the values it names (the missing sections, the version a date does not follow).
 */
export function refusalWords(refusal: Pick<PolicyRefusal, "code"> & { values?: Readonly<Record<string, string>> }, t: Translate): { title: string; text: string | null } {
  const key = `pubc.refusal.${refusal.code}`;
  const values = refusal.values ?? {};
  return { title: t(`${key}.title`, values), text: `${key}.text` in vi ? t(`${key}.text`, values) : null };
}

/** An instant with its time and zone, or a day the canvas gives without a time, as a day. */
export function moment(value: string, locale: Locale): string {
  return (value.includes("T") ? R1_FORMAT.formatTimestamp(value, locale) : R1_FORMAT.formatDate(value, locale)) ?? "-";
}

export const day = (value: string, locale: Locale): string => R1_FORMAT.formatDate(value, locale) ?? "-";
export const shortDay = (value: string, locale: Locale): string => R1_FORMAT.formatDateShort(value, locale) ?? "-";

export const documentTitle = (kind: DocumentKind, t: Translate): string => t(`pubc.doc.${kind}`);

/** A version's title in the console's header: "RightOne là gì, phiên bản 2026.4". */
export const versionTitle = (kind: DocumentKind, label: string, t: Translate): string => t("pub15.title", { doc: documentTitle(kind, t), version: label });

/** A version's state as its badge: open versions by their status, a published one by where it stands now. */
export function versionState(version: { status: VersionStatus; phase: VersionPhase | null }, t: Translate): StatusValue {
  if (version.status === "PUBLISHED") {
    const phase = version.phase ?? "IN_EFFECT";
    return { family: phase === "UPCOMING" ? "info" : phase === "IN_EFFECT" ? "positive" : "neutral", label: t(`pubc.phase.${phase}`) };
  }
  return { family: version.status === "SUBMITTED" ? "attention" : "neutral", label: t(`pubc.status.${version.status}`) };
}

/** "2026.2, từ 15 tháng 9, 2026", or "Chưa có". */
export const versionFrom = (line: VersionLine | null, t: Translate, locale: Locale): string =>
  line === null || line.effectiveFrom === null ? t("pubc.none") : t("pubc.versionFrom", { version: line.label, date: day(line.effectiveFrom, locale) });

export const drafts = (reader: PolicyReader, documentClass: DocumentClass): boolean => reader.drafts.includes(documentClass);

/** Decides a version of the class: its approver role, and for a legal document GOV's release decision too. */
export const decides = (reader: PolicyReader, documentClass: DocumentClass): boolean =>
  reader.approves.includes(documentClass) && (documentClass === "PAGE" || reader.releasesLegal);

/** A duration in days, hours and minutes, the largest two that apply ("4 ngày 2 giờ", "5 phút"). */
export function duration(seconds: number, t: Translate): string {
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts = [
    ...(days > 0 ? [days === 1 ? t("pub17.dayOne") : t("pub17.day", { n: days })] : []),
    ...(hours > 0 ? [t("pub17.hour", { n: hours })] : []),
    ...(rest > 0 && days === 0 ? [t("pub17.minute", { n: rest })] : []),
  ];
  return parts.length > 0 ? parts.join(" ") : t("pub17.minute", { n: 0 });
}

/** A form's text field, trimmed; empty when it was not sent. */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** What a console form kept for the page it redirects to: where it acted, the act, its refusal, what was typed. */
export interface PolicyAttempt {
  /** The page the attempt belongs to: a version's id, "new:<document>", or "routes". */
  on: string;
  act: string;
  refusal: PolicyRefusal | null;
  /** A field the form found missing before anything was sent, by its name. */
  missing: string | null;
  typed: Readonly<Record<string, string | readonly string[]>>;
  /** What the done act's sentence names. */
  values: Readonly<Record<string, string>>;
}

/** A typed value the attempt drew back into its form, or the fallback. */
export function typedText(attempt: PolicyAttempt | null, name: string, fallback: string): string {
  const value = attempt?.typed[name];
  return typeof value === "string" ? value : fallback;
}
