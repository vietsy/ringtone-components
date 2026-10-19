import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type { CaseText, RightsLayer } from "@/lib/api/registration";
import type { Actor, CaseFact, EvidenceTitle, ReviewType } from "@/lib/api/registration-review";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { REASON_NAMES } from "@/lib/mock/registration-review";
import en from "@/messages/screens/regops.en.json";
import vi from "@/messages/screens/regops.vi.json";

/** The registration console's translator: `regops.*` is shared by its screens, `regNN.*` belongs to one. */
export const regOpsTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/*
 * Values put into a sentence go through the formatting layer. A value the API always sends is never missing, so
 * the empty string below is a type guard rather than a rendering.
 */
export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
/** The short month a dense console column writes a date in: "29 thg 9, 2026". */
export const shortDay = (iso: string, locale: Locale) => R1_FORMAT.formatDateShort(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const money = (amountMinor: number, currency: string, locale: Locale) => R1_FORMAT.formatMoney(amountMinor, currency, locale) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

/** On the console the states are codes (convention 5); in review every row is, so the badge is quiet. */
const STATE_FAMILY: Readonly<Record<string, Family>> = {
  DRAFT: "neutral",
  SUBMITTED: "neutral",
  UNDER_REVIEW: "attention",
  EVIDENCE_REQUIRED: "attention",
  DECIDED: "neutral",
  REFUSED: "danger",
  WITHDRAWN: "info",
  CLOSED_INCOMPLETE: "attention",
  PENDING_APPROVAL: "attention",
  APPROVED: "positive",
  RETURNED: "attention",
  ISSUED_WITHOUT_APPROVAL: "positive",
  CLOSED_BY_WITHDRAWAL: "neutral",
  OPEN: "attention",
  ANSWERED: "neutral",
  LAPSED: "attention",
  ACCEPTED: "neutral",
  PARTLY_ACCEPTED: "neutral",
  NOT_ACCEPTED: "attention",
};

export const codeStatus = (code: string, quiet = false): StatusValue => ({ family: STATE_FAMILY[code] ?? "neutral", label: code, ...(quiet ? { quiet: true } : {}) });

/** A refusal's title and sentence, from `04-refusal-codes.md`; a screen may word the title for its own act. */
export function refusal(t: Translate, code: string, screen?: string): { code: string; title: string; text: string } {
  const own = screen !== undefined ? `${screen}.refusal.${code}.title` : null;
  const title = own !== null && hasKey(own) ? t(own) : t(`regops.refusal.${code}.title`);
  return { code, title, text: t(`regops.refusal.${code}.text`) };
}

const KEYS = new Set(Object.keys(vi));
const hasKey = (key: string) => KEYS.has(key);

/** Whether the family's catalogue words this code as a refusal; any other failure is our outage. */
export const knownRefusal = (code: string) => hasKey(`regops.refusal.${code}.text`);

/** The sentence that holds a disabled act (convention 14): the refusal's own wording, or the draft's. */
export const holdSentence = (t: Translate, code: string, act: "act" | "withdraw" = "act") =>
  code === "DRAFT" ? t(act === "withdraw" ? "regops.why.DRAFT_WITHDRAW" : "regops.why.DRAFT") : t(`regops.refusal.${code}.text`);

/** The review type as the console writes it, or the words for the automated route. */
export const reviewTypeWords = (type: ReviewType | null, t: Translate) => type ?? t("regops.automated");

export const layerWords = (layer: RightsLayer, t: Translate) => t(`regops.layer.${layer}`);

/** A name inside a Vietnamese sentence is lower case ("vì không sử dụng quyền của..."); English keeps its capital. */
export const inLine = (words: string, locale: Locale) => (locale === "vi" ? words.charAt(0).toLowerCase() + words.slice(1) : words);

/** A document's name on the console. */
export function documentTitle(title: EvidenceTitle, t: Translate): string {
  if ("described" in title) return title.described;
  if ("document" in title) return t(`regops.doc.${title.document}`);
  return t(`regops.drawn.${title.drawn}`);
}

/** A document named inside a sentence starts in lower case, as the board writes "kèm giấy tờ..." / "with proof of...". */
export function documentInLine(title: EvidenceTitle, t: Translate): string {
  const words = documentTitle(title, t);
  return words.charAt(0).toLowerCase() + words.slice(1);
}

/** "PDF, 1,2 MB": a file's kind and size as the case file lists it. */
export function fileWords(file: { mediaType: string; sizeBytes: number }, t: Translate, locale: Locale): string {
  const kind = (file.mediaType.split("/")[1] ?? file.mediaType).toUpperCase();
  const size =
    file.sizeBytes < 1_000_000
      ? t("regops.sizeKb", { n: count(Math.max(1, Math.round(file.sizeBytes / 1_000)), locale) })
      : t("regops.sizeMb", { n: count(Math.round(file.sizeBytes / 100_000) / 10, locale) });
  return t("regops.file", { kind, size });
}

/** Who acted: the person's name, or the role the record names instead. */
export function actorWords(actor: Actor, t: Translate): string {
  if (actor.name !== null) return actor.name;
  return t(`regops.actor.${actor.role}`);
}

/** A fact's value in words: m², days, the class, the way music is played, a date, a masked registration. */
export function factValue(fact: CaseFact, t: Translate, locale: Locale): string {
  switch (fact.code) {
    case "customer_area":
      return t("regops.m2", { n: count(Number(fact.value), locale) });
    case "days_open":
      return t("regops.days", { n: count(Number(fact.value), locale) });
    case "premises_class":
      return t(`regops.class.${String(fact.value)}`);
    case "music_method":
      return t(`regops.music.${String(fact.value)}`);
    case "use_began_on":
      return day(String(fact.value), locale);
    case "business_registration":
      return String(fact.value);
  }
}

/** A reason by its code: the review trigger's or the claims standard's name, or the short code the officer typed. */
export function reasonWords(code: string | null, locale: Locale): string {
  if (code === null) return "";
  const named: CaseText | undefined = REASON_NAMES[code];
  return named !== undefined ? named[locale] : code;
}

/** Seconds as minutes and seconds, as the report writes them: "6 phút 48 giây" / "6 min 48 s". */
export function duration(seconds: number, t: Translate): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return t("regops.duration", { m: String(minutes), s: String(rest).padStart(2, "0") });
}
