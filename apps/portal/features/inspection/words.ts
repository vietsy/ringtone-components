import { R1_FORMAT } from "@rightone/formatting";
import { CURRENT_STATES, type PremisesName, type RecordDelivery, type RecordState, type RefusalCode, type VerifiedAnswer } from "@/lib/api/inspection";
import type { Locale, Translate } from "@/lib/i18n/translate";

/**
 * The way the inspector's boards turn catalogue sentences into what a Banner or an answer shows. Pure functions,
 * safe on the server: a page calls them with its translator.
 */

/**
 * A refusal sentence split as a Banner splits it: the first sentence is the title, the rest the text. The canvas
 * splits at the first full stop followed by a space, so a refusal reads the same here as on the board.
 */
export function splitSentence(sentence: string): { title: string; text: string } {
  const at = sentence.indexOf(". ");
  return at < 0 ? { title: sentence, text: "" } : { title: sentence.slice(0, at + 1), text: sentence.slice(at + 2) };
}

/** A refusal from the family's catalogue (design/04's meaning, short for the screen), with its code. */
export function refusalOf(t: Translate, code: RefusalCode): { code: RefusalCode; title: string; text: string } {
  return { code, ...splitSentence(t(`refusal.${code}`)) };
}

/** The whole refusal sentence, for a field error or a row message. */
export function refusalSentence(t: Translate, code: RefusalCode): string {
  return t(`refusal.${code}`);
}

/** A section title with its count after it, as the boards write "Chờ tải lên (1)". */
export function counted(t: Translate, label: string, count: number): string {
  return t("ver.counted", { label, n: R1_FORMAT.formatCount(count) ?? String(count) });
}

/** A premises named with its register address; by its name alone where the canvas gives no address. */
export function premisesAt(t: Translate, premises: PremisesName): string {
  return premises.address === null ? premises.name : t("ver.premisesAt", { name: premises.name, address: premises.address });
}

/** Words joined as the boards join a list of wards or kinds. */
export function joined(t: Translate, items: readonly string[]): string {
  return items.join(t("ver.separator"));
}

/** A timestamp in the shared format; the empty string for a value the formatter cannot read. */
export function timestamp(iso: string, locale: Locale): string {
  return R1_FORMAT.formatTimestamp(iso, locale) ?? "";
}

/** A date in the shared format; the empty string for a value the formatter cannot read. */
export function date(iso: string, locale: Locale): string {
  return R1_FORMAT.formatDate(iso, locale) ?? "";
}

/**
 * A read instant to the second (design/03 SCR-VER-02): the shared timestamp with its seconds written in after
 * the minutes, "30 thg 9, 2026, 10:14:03 (GMT+7)". Seconds are the same in every zone, so they are read in UTC.
 */
export function timestampToSecond(iso: string, locale: Locale): string {
  const shared = timestamp(iso, locale);
  const instant = R1_FORMAT.toDate(iso);
  if (shared === "" || instant === null) return shared;
  const seconds = String(instant.getUTCSeconds()).padStart(2, "0");
  return shared.replace(/(\d\d:\d\d)( \()/, `$1:${seconds}$2`);
}

/**
 * A record's findings in words (section 5c), each with its note: joined as sentences on the premises' pages
 * ("Có sử dụng nhạc. Việc sử dụng vượt phạm vi …: …."), or with semicolons on the console's ("…; …").
 */
export function findingsText(t: Translate, findings: readonly { kind: string; note: string | null }[], style: "sentences" | "list"): string | null {
  if (findings.length === 0) return null;
  const items = findings.map((finding) => (finding.note !== null ? t("ver06.finding", { kind: t(`ver.finding.${finding.kind}`), note: finding.note }) : t(`ver.finding.${finding.kind}`)));
  // In a list each finding after the first continues the clause, so it starts in lower case, as the boards write it.
  if (style === "list") return items.map((item, index) => (index === 0 ? item : item.charAt(0).toLocaleLowerCase() + item.slice(1))).join(t("ver.listSeparator"));
  // A note typed with its own full stop keeps one; the sentences are joined and closed once.
  return `${items.map((item) => item.replace(/\.+$/, "")).join(t("ver.sentenceSeparator"))}.`;
}

/** A follow-up in the words of section 5c, with its date where it runs to one. */
export function followUpText(t: Translate, followUp: string, by: string | null, locale: Locale): string {
  if (by !== null && followUp === "RE_VISIT") return t("ver05.reVisitBy", { d: date(by, locale) });
  if (by !== null && followUp === "AWAIT_REGISTRATION") return t("ver05.awaitBy", { d: date(by, locale) });
  return t(`ver.followUp.${followUp}`);
}

/**
 * Whether a record is under a request to reconsider: "Có, vụ việc CAS-…" or "Không"; for an inspector of another
 * authority, who is told nothing of the case, "Có" alone (FR-VER-027).
 */
export function challengeText(t: Translate, challenge: { case: string | null } | null): string {
  if (challenge === null) return t("ver06.no");
  return challenge.case === null ? t("ver06.yesWithheld") : t("ver13.yesCase", { c: challenge.case });
}

/** A record's state in the words of section 5b; NOT_YET_IN_FORCE says from when, where the period is known. */
export function stateWords(t: Translate, state: RecordState, from: string | null, locale: Locale): string {
  return state === "NOT_YET_IN_FORCE" && from !== null ? t("ver.state.NOT_YET_IN_FORCE_FROM", { d: date(from, locale) }) : t(`ver.state.${state}`);
}

/** Whether a state is one in which a record is current: only those are drawn in the info family (section 5b). */
export const isCurrentState = (state: RecordState): boolean => CURRENT_STATES.includes(state);

/**
 * An answer a record cites, with its own limits (FR-VER-037): online, the state read and when; offline, the state
 * printed and when, that the current state and any revocation since were not checked, and when the keys were refreshed.
 */
export function verifiedText(t: Translate, cited: VerifiedAnswer, locale: Locale): string {
  if (cited.channel === "ONLINE") return t("ver06.verifiedOnline", { a: cited.answer, s: stateWords(t, cited.state, null, locale), t: timestamp(cited.readAt, locale) });
  return t("ver06.verifiedOffline", {
    a: cited.answer,
    p: timestamp(cited.printedAt, locale),
    s: stateWords(t, cited.printedState, null, locale),
    k: timestamp(cited.keysRefreshedAt, locale),
  });
}

/** Where a record version's delivery stands, by its route and instant (SM-705), in a sentence. */
export function deliveryText(t: Translate, delivery: RecordDelivery, locale: Locale): string {
  if (delivery.state === "HANDED_OVER" && delivery.handedOverAt !== null) return t("ver06.handed", { t: timestamp(delivery.handedOverAt, locale) });
  if (delivery.state === "NOTICE_DELIVERED" && delivery.deliveredAt !== null) return t("ver06.noticeDelivered", { t: timestamp(delivery.deliveredAt, locale) });
  if (delivery.state === "UNDELIVERED") return t("ver06.undelivered", { t: timestamp(delivery.dueBy, locale) });
  return t("ver06.pending");
}
