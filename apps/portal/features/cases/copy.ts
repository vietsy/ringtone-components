import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type { CaseReader, CaseState, CaseSummary, Refusal } from "@/lib/api/cases";
import type { Principal } from "@/lib/api/session";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/cas.en.json";
import vi from "@/messages/screens/cas.vi.json";
import opsEn from "@/messages/screens/casops.en.json";
import opsVi from "@/messages/screens/casops.vi.json";

/** The case family's translator: `cas.*` is shared by its screens, `cas01.*`, `cas02.*`, `cas08.*`, `casMine.*` belong to one. */
export const casTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/** The case console's translator: the family's shared words and refusals, and `casops.*`, `cas03.*` to `cas18.*`. */
export const casOpsTranslator = (locale: Locale): Translate => translator({ vi: { ...vi, ...opsVi }, en: { ...en, ...opsEn } }, locale);

/** Who reads: the principal signed in, or nobody, on a page that needs no account. */
export const readerOf = (principal: Principal | null): CaseReader => ({
  party: principal?.organisation ?? null,
  account: principal?.account ?? null,
});

/**
 * Convention 7: info while the case is worked, attention while the raiser is waited on, neutral once it is
 * decided or has ended: a decision is a fact rather than an achievement, and green would read as somebody's win.
 */
const FAMILY: Readonly<Record<CaseState, Family>> = {
  RECEIVED: "info",
  TRIAGED: "info",
  ASSIGNED: "info",
  INVESTIGATING: "info",
  AWAITING_EVIDENCE: "attention",
  SPECIALIST_ESCALATION: "info",
  DECISION_PENDING: "info",
  DECIDED: "neutral",
  REMEDY_IN_PROGRESS: "neutral",
  CLOSED: "neutral",
  CLOSED_INADMISSIBLE: "neutral",
  CLOSED_INCOMPLETE: "neutral",
  REFERRED: "neutral",
  WITHDRAWN: "neutral",
};

/** Convention 6: on the public surface a state is said in words a person reads, never as its name. */
export function caseStatus(state: CaseState, t: Translate): StatusValue {
  return { family: FAMILY[state], label: t(`cas.state.${state}`) };
}

/** Convention 6 again: on the operations surface the state is its name, which means something precise to an officer. */
export function opsStatus(state: CaseState): StatusValue {
  return { family: FAMILY[state], label: state };
}

/** The states whose next step is somebody acting by a date; the others say when the case reached where it is. */
const AWAITED: readonly CaseState[] = ["RECEIVED", "TRIAGED", "ASSIGNED", "INVESTIGATING", "AWAITING_EVIDENCE", "DECISION_PENDING"];

/** What happens next, in one sentence naming who acts and by when (FR-CAS-002), or how the case ended and when. */
export function nextStep(summary: Pick<CaseSummary, "state" | "nextBy" | "stateSince">, t: Translate, locale: Locale): string {
  const { state, nextBy, stateSince } = summary;
  if (!AWAITED.includes(state)) return t(`cas.next.${state}`, { d: day(stateSince, locale) });
  return nextBy !== null ? t(`cas.next.${state}`, { d: day(nextBy, locale) }) : t(`cas.nextOpen.${state}`);
}

export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

/** A single query value; a repeated or absent one reads as none. */
export const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * A refusal's title and sentence: the sentence says what `04-refusal-codes.md` says, short for the screen, with the values it names
 * put in words - a date in the shared format, an element, an artefact kind, a group by its name.
 */
export function refusalWords(t: Translate, refusal: Refusal | string, locale: Locale): { code: string; title: string; text: string } {
  const { code, detail } = typeof refusal === "string" ? { code: refusal, detail: {} as Readonly<Record<string, string>> } : refusal;
  const value = (name: string) => detail[name] ?? "";
  const list = (name: string, key: (entry: string) => string) => (value(name) !== "" ? value(name).split(", ").map((entry) => t(key(entry))).join(", ") : "");
  // Only the values this code's sentence names are put in words: a detail another sentence would word differently -
  // a remedy kind where an artefact kind is read - is never looked up for a sentence that does not say it.
  const makers: Readonly<Record<string, () => string>> = {
    date: () => (value("date") !== "" ? day(value("date"), locale) : ""),
    element: () => (value("element") !== "" ? t(`casops.element.${value("element")}`) : ""),
    kind: () => list("kind", (kind) => `casops.artefact.${kind}`),
    group: () => (value("group") !== "" ? t(`cas.group.${value("group")}`) : ""),
    act: () => (value("act") !== "" ? t(`casops.act.${value("act")}`) : ""),
    list: () => list("list", (kind) => `cas.remedy.${kind}`),
    period: () => (value("period") !== "" ? t("casops.workingDays", { n: value("period") }) : ""),
    state: () => value("state"),
    // The dispositions a state admits are said in words; the steps a case can take are state names, as on the console.
    permitted: () =>
      code === "DISPOSITION_NOT_PERMITTED_FROM_STATE"
        ? value("permitted") !== ""
          ? list("permitted", (disposition) => `cas.disposition.${disposition}`)
          : t("cas.dispositionNone")
        : value("permitted"),
    reference: () => value("reference"),
    number: () => value("number"),
    field: () => "",
  };
  const sentence = t(`cas.refusal.${code}.text`);
  const words: Record<string, string> = {};
  for (const [, name] of sentence.matchAll(/\{(\w+)\}/g)) {
    const make = name !== undefined ? makers[name] : undefined;
    if (name !== undefined && make !== undefined) words[name] = make();
  }
  return { code, title: t(`cas.refusal.${code}.title`), text: t(`cas.refusal.${code}.text`, words) };
}

/** The sentence beside one field a refusal fell on: FIELD_MISSING names the field, any other code says its own. */
export function fieldRefusal(t: Translate, refusal: Refusal | null, field: string, label: string, locale: Locale): { error: string } | Record<string, never> {
  const code = refusal?.fields[field];
  if (code === undefined || refusal === null) return {};
  if (code === "FIELD_MISSING") return { error: t("cas.refusal.FIELD_MISSING.text", { field: label.toLowerCase() }) };
  return { error: refusalWords(t, { ...refusal, code }, locale).text };
}
