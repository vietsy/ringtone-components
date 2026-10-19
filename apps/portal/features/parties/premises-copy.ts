import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type {
  ChangeCause,
  DispositionState,
  Entitlement,
  ExceptionState,
  LicensingView,
  PremisesState,
  ProvenanceValue,
  PublishedFact,
  RegisterLicensing,
  RunState,
  Written,
} from "@/lib/api/premises";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import partyEn from "@/messages/screens/party.en.json";
import partyVi from "@/messages/screens/party.vi.json";
import en from "@/messages/screens/premises.en.json";
import vi from "@/messages/screens/premises.vi.json";

/**
 * The premises register's translator: its own catalogue (`prm.*`, `ptyNN.*` for SCR-PTY-06 to 10 and 14 to 16) over
 * the party family's (`party.*`), which the register's screens share where a word is the family's.
 */
export const premisesTranslator = (locale: Locale): Translate => translator({ vi: { ...partyVi, ...vi }, en: { ...partyEn, ...en } }, locale);

const KEYS = new Set([...Object.keys(vi), ...Object.keys(partyVi)]);
export const hasKey = (key: string) => KEYS.has(key);

export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const shortDay = (iso: string, locale: Locale) => R1_FORMAT.formatDateShort(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const stamp = (iso: string, locale: Locale) => R1_FORMAT.formatStamp(iso, locale) ?? "";
export const clock = (iso: string) => R1_FORMAT.formatTime(iso) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";
export const percent = (value: number, locale: Locale) => R1_FORMAT.formatPercent(value, locale) ?? "";
export const money = (amountMinor: number, locale: Locale) => R1_FORMAT.formatMoney(amountMinor, "VND", locale) ?? "";

/** A sentence's first letter in capitals, for a value that opens a sentence in English ("Operator change recorded"). */
export const capital = (text: string) => (text === "" ? text : `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}`);

// ---------------------------------------------------------------- states in words, colour as the second signal

const STATE_FAMILY: Readonly<Record<PremisesState, Family>> = { IN_REGISTER: "neutral", OPERATED: "positive", CHANGE_PENDING: "attention", CLOSED: "neutral", CEASED: "neutral" };
const LICENSING_FAMILY: Readonly<Record<RegisterLicensing, Family>> = { LICENSED: "positive", UNREGISTERED: "neutral", LAPSED: "attention", STALE: "attention" };
const RUN_FAMILY: Readonly<Record<RunState, Family>> = { DUE: "neutral", RUNNING: "neutral", COMPLETED: "positive", INCOMPLETE: "attention", OVERDUE: "attention", REFUSED: "danger" };
const DISPOSITION_FAMILY: Readonly<Record<DispositionState, Family>> = { RAISED: "neutral", AWAITING_APPROVAL: "attention", TRANSFERRED: "neutral", CLOSED: "neutral", LEFT_IN_PLACE: "neutral" };
const EXCEPTION_FAMILY: Readonly<Record<ExceptionState, Family>> = { OPEN: "attention", ACKNOWLEDGED: "neutral", RESOLVED: "positive" };

export const premisesStatus = (state: PremisesState, t: Translate): StatusValue => ({ family: STATE_FAMILY[state], label: t(`prm.state.${state}`) });
export const licensingStatus = (status: RegisterLicensing, t: Translate, detail?: string): StatusValue => ({
  family: LICENSING_FAMILY[status],
  label: t(`prm.licensing.${status}`),
  ...(detail !== undefined ? { detail } : {}),
});
export const runStatus = (state: RunState, t: Translate): StatusValue => ({ family: RUN_FAMILY[state], label: t(`prm.run.${state}`), ...(state === "RUNNING" ? { working: true } : {}) });
export const dispositionStatus = (state: DispositionState, t: Translate): StatusValue => ({ family: DISPOSITION_FAMILY[state], label: t(`prm.disp.${state}`) });
export const exceptionStatus = (state: ExceptionState, t: Translate): StatusValue => ({ family: EXCEPTION_FAMILY[state], label: t(`prm.exc.${state}`) });

/** The licensing column's help: each status in words with the catalogue's sentence (04-refusal-codes.md, status words). */
export function licensingHelp(t: Translate): string {
  return (["LICENSED", "UNREGISTERED", "LAPSED", "STALE"] as const).map((code) => t("prm.licensingHelp", { word: t(`prm.licensing.${code}`), sentence: t(`prm.licensingSentence.${code}`) })).join(" ");
}

/** The line under a licensing status: when it was derived and from which record, or why it is stale (DR-207). */
export function licensingLine(view: LicensingView, keys: { derived: string; derivedAdmit: string; stale: string }, t: Translate, locale: Locale): string {
  if (view.stale !== null) return t(keys.stale, { d: shortDay(view.stale.checkedOn, locale), r: view.record ?? "", d2: shortDay(view.stale.changedOn, locale) });
  if (view.record === null) return t(keys.derivedAdmit, { ts: moment(view.derivedAt, locale) });
  return t(keys.derived, { ts: moment(view.derivedAt, locale), r: view.record });
}

// ---------------------------------------------------------------- values in words

export const areaWords = (area: { ward: string; city: string }, t: Translate) => t("prm.area", { ward: area.ward, city: area.city });

export const classWords = (code: string | null, t: Translate) => (code === null ? "" : hasKey(`prm.class.${code}`) ? t(`prm.class.${code}`) : code);

/** An evidence kind from CFG-246 by its name, or as typed. */
export const evidenceWordsOf = (kind: string, t: Translate) => (hasKey(`party.evidence.${kind}`) ? t(`party.evidence.${kind}`) : kind);

export const causeWords = (cause: ChangeCause, t: Translate) => t(`prm.cause.${cause}`);

/** A value of a register field as a person reads it. */
export function valueWords(value: ProvenanceValue | null, t: Translate): string {
  if (value === null) return "";
  switch (value.kind) {
    case "text":
      return value.text;
    case "class":
      return classWords(value.code, t);
    case "area":
      return areaWords(value, t);
    case "party":
      return value.legalName;
    case "licensing":
      return t(`prm.licensing.${value.status}`);
  }
}

/** A sentence the data names by its code, with its dates written as convention 6 writes them, or the words typed. */
export function writtenWords(value: Written, t: Translate, locale: Locale): string {
  if ("text" in value) return value.text;
  const values = Object.fromEntries(Object.entries(value.values ?? {}).map(([name, raw]) => [name, /^\d{4}-\d{2}-\d{2}$/.test(raw) ? day(raw, locale) : raw]));
  return t(`prm.text.${value.code}`, values);
}

/** What an entitlement is: "Status record" with its reference, or the fee and its period. */
export function entitlementTitle(entitlement: Entitlement, t: Translate, locale: Locale): string {
  if (entitlement.kind === "FEE" && entitlement.period !== null) return t("prm.entitlement.FEE", { from: day(entitlement.period.from, locale), to: day(entitlement.period.to, locale) });
  return t(`prm.entitlement.${entitlement.kind}`);
}

/** An entitlement inside a sentence: "giấy xác nhận R1-CER-…", "phí tháng 9". */
export function entitlementInline(values: { kind: string; reference: string; from: string }, t: Translate, locale: Locale): string {
  if (values.kind === "FEE") return t("prm.entitlementLower.FEE", { month: values.from !== "" ? monthName(values.from, locale) : "" });
  return t(`prm.entitlementLower.${values.kind}`, { r: values.reference });
}

/** One line of a premises' history, from the event's code and values. */
export function eventWords(what: Written, t: Translate, locale: Locale): string {
  if ("text" in what) return what.text;
  const v = what.values ?? {};
  const date = (name: string) => (v[name] !== undefined && v[name] !== "" ? day(v[name] ?? "", locale) : "");
  switch (what.code) {
    case "ADMITTED_SOURCE_SINCE":
      return t("prm.event.ADMITTED_SOURCE_SINCE", { since: date("since") });
    case "ADMITTED_RUN":
      return t("prm.event.ADMITTED_RUN", { run: date("run") });
    case "OVERRIDDEN": {
      const field = v.field ?? "";
      const value = field === "classification" ? classWords(v.value ?? "", t) : (v.value ?? "");
      return t("prm.event.OVERRIDDEN", { field: t(`prm.field.${field}`), value, authority: v.authority ?? "" });
    }
    case "RELATIONSHIP_RECORDED":
      return t("prm.event.RELATIONSHIP_RECORDED", { from: date("from"), by: v.by ?? "" });
    case "RELATIONSHIP_ENDED":
      return t("prm.event.RELATIONSHIP_ENDED", { cause: t(`prm.causeLower.${v.cause ?? "OPERATOR_CHANGE"}`) });
    case "CHANGE_RECORDED": {
      const cause = t(`prm.causeLower.${v.cause ?? "OPERATOR_CHANGE"}`);
      return t("prm.event.CHANGE_RECORDED", { cause, Cause: capital(cause), effective: date("effectiveOn"), by: v.by ?? "" });
    }
    case "PROPOSED":
      return t(`prm.event.PROPOSED.${v.outcome ?? "TRANSFER"}`, { entitlement: entitlementInline({ kind: v.kind ?? "", reference: v.reference ?? "", from: v.from ?? "" }, t, locale), by: v.by ?? "" });
    case "DECIDED": {
      const entitlement = entitlementInline({ kind: v.kind ?? "", reference: v.reference ?? "", from: v.from ?? "" }, t, locale);
      return t(`prm.event.DECIDED.${v.outcome ?? "LEAVE_IN_PLACE"}`, { Entitlement: capital(entitlement), by: v.by ?? "", receiving: v.receiving ?? "" });
    }
    default:
      return t(`prm.event.${what.code}`, Object.fromEntries(Object.entries(v)));
  }
}

/** A published fact a backdated change contradicts, as SCR-PTY-09 names it. */
export function factItem(fact: PublishedFact, t: Translate, locale: Locale): { key: string; title: string; detail: string } {
  if (fact.kind === "PUBLIC_PREMISES_LIST") return { key: fact.key, title: t("pty09.fList"), detail: t("pty09.fListAt", { d: day(fact.publishedAt, locale) }) };
  return { key: fact.key, title: t("pty09.fCover", { area: fact.area ?? "", month: monthWords(fact.month, locale) }), detail: t("pty09.fCoverAt", { ts: moment(fact.publishedAt, locale) }) };
}

/** A month as the coverage report names it, from the shared date format: "tháng 9, 2026", "September 2026". */
function monthWords(month: string | null, locale: Locale): string {
  return month === null ? "" : day(`${month}-01`, locale).replace(/^1 /, "");
}

/** A month alone, as a fee is named by it: "9" (tháng 9), "September". */
function monthName(date: string, locale: Locale): string {
  const words = day(`${date.slice(0, 7)}-01`, locale);
  return (locale === "vi" ? /tháng (\d+)/.exec(words)?.[1] : /^1 (\S+)/.exec(words)?.[1]) ?? "";
}

// ---------------------------------------------------------------- refusals

/** A refusal's title and sentence: the register's own catalogue first, then the party family's. */
export function premisesRefusal(t: Translate, code: string, values: Readonly<Record<string, string>> = {}): { code: string; title: string; text: string } {
  const prefix = hasKey(`prm.refusal.${code}.text`) ? "prm" : hasKey(`party.refusal.${code}.text`) ? "party" : null;
  if (prefix === null) return { code, title: t("prm.refusal.FORBIDDEN.title"), text: t("prm.refusal.FORBIDDEN.text") };
  return { code, title: t(`${prefix}.refusal.${code}.title`, values), text: t(`${prefix}.refusal.${code}.text`, values) };
}

/** Whether the family words this code as a refusal; any other failure is our outage. */
export const knownPremisesRefusal = (code: string) => hasKey(`prm.refusal.${code}.text`) || hasKey(`party.refusal.${code}.text`);
