import { R1_FORMAT } from "@rightone/formatting";
import type { Family, StatusValue } from "@/components/r1";
import type {
  Actor,
  CapabilityState,
  CapabilitySummary,
  LedgerRow,
  ParticipantClass,
  ParticipationState,
  Refusal,
  ReleaseCondition,
  RuleVersionState,
  SnapshotState,
} from "@/lib/api/engagement";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/eng.en.json";
import vi from "@/messages/screens/eng.vi.json";

/** The engagement family's translator: `eng.*` is shared by its screens, `engNN.*` belongs to one. */
export const engTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

export const day = (iso: string, locale: Locale) => R1_FORMAT.formatDate(iso, locale) ?? "";
export const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

/** A signed value, the sign written out ("+50", "−50"), so a correction never reads as an award. */
export const signed = (value: number, locale: Locale) => (value > 0 ? `+${count(value, locale)}` : count(value, locale));

/** "120 điểm, tính từ 5 sự kiện đã ghi": a derived figure always says it is derived (convention 6). */
export const derived = (points: number, events: number, t: Translate, locale: Locale) =>
  t(events === 1 ? "eng.derivedOne" : "eng.derived", { points: count(points, locale), events: count(events, locale) });

/** An actor as a record attributes them; a migration or the handler by its name, marked as not a person. */
export const actorName = (actor: Actor, t: Translate) => (actor.kind === "system" ? t("eng.system", { name: actor.name }) : actor.name);

const NAMED_ACTIONS: readonly string[] = ["ONBOARDING_COMPLETED", "TRACK_PUBLISHED", "PROFILE_COMPLETED"];

/** An action code in words where the family names it (the three `BR-ENG-04` settles), else null. */
export const actionNote = (code: string, t: Translate): string | null => (NAMED_ACTIONS.includes(code) ? t(`eng.action.${code}`) : null);

/** An action code in words where the family names it, else the code itself, as the preparer typed it. */
export const actionWords = (code: string, t: Translate): string => actionNote(code, t) ?? code;

/** What a history row was for: the action, or the event it corrects. */
export const rowWords = (row: LedgerRow, t: Translate, locale: Locale) =>
  row.kind === "correction" && row.corrects !== null ? t("eng.correctionOf", { d: moment(row.corrects.recordedAt, locale) }) : actionWords(row.actionCode ?? "", t);

/** Status colour is the only colour that carries meaning, and every status carries its word (conventions 7 and 8). */
const PARTICIPATION_FAMILY: Readonly<Record<ParticipationState, Family>> = { NOT_ENROLLED: "neutral", ENROLLED: "positive", WITHDRAWN: "neutral", SUSPENDED: "attention" };
export const participationStatus = (state: ParticipationState, t: Translate): StatusValue => ({ family: PARTICIPATION_FAMILY[state], label: t(`eng.participation.${state}`) });

/** A withheld capability is info, not danger: nothing has gone wrong. */
const CAPABILITY_FAMILY: Readonly<Record<CapabilityState, Family>> = { WITHHELD: "info", RELEASED: "positive", SUSPENDED: "attention" };
export const capabilityStatus = (state: CapabilityState, t: Translate): StatusValue => ({ family: CAPABILITY_FAMILY[state], label: t(`eng.capability.${state}`) });

const VERSION_FAMILY: Readonly<Record<RuleVersionState, Family>> = { PREPARED: "neutral", APPROVED: "info", EFFECTIVE: "positive", SUPERSEDED: "neutral", WITHDRAWN: "neutral" };
export const versionStatus = (state: RuleVersionState, t: Translate): StatusValue => ({ family: VERSION_FAMILY[state], label: t(`eng.version.${state}`) });

/** A refused publication is danger; a published one positive. */
const SNAPSHOT_FAMILY: Readonly<Record<SnapshotState, Family>> = { PREPARED: "neutral", PUBLISHED: "positive", REFUSED: "danger" };
export const snapshotStatus = (state: SnapshotState, t: Translate): StatusValue => ({ family: SNAPSHOT_FAMILY[state], label: t(`eng.snapshot.${state}`) });

export const classWords = (classes: readonly ParticipantClass[], t: Translate) => classes.map((value) => t(`eng.class.${value}`)).join(", ");

/** The sentences SCR-ENG-01 gives a withheld capability, by its cause: never released, or released and since withdrawn. */
export function withheldWords(capability: CapabilitySummary, t: Translate): { title: string; text: string } {
  const cause = capability.withheld === "withdrawn" ? "withdrawn" : "never";
  return { title: t(`eng.withheld.${cause}Title`), text: t(`eng.withheld.${cause}`) };
}

/** The same, whole, for the line beside a control it disables. */
export const withheldSentence = (capability: CapabilitySummary, t: Translate) => {
  const words = withheldWords(capability, t);
  return `${words.title} ${words.text}`;
};

/** The refusals `04-refusal-codes.md` words in one sentence: their catalogue entry has a title and no text. */
const ONE_SENTENCE = new Set([
  "ROLE_OUT_OF_SCOPE",
  "AWARD_RULE_NOT_EFFECTIVE",
  "PARTICIPATION_ALREADY_ENROLLED",
  "PARTICIPATION_NOT_ENROLLED",
  "CORRECTION_ALREADY_AUTHORISED",
  "FIELD_MISSING",
  "CORRECTION_TARGET_NOT_FOUND",
  "AS_AT_IN_FUTURE",
  "POINT_EXPIRY_RESERVED",
  "RELEASE_CONDITION_NOT_EVIDENCED",
  "DISCLOSURE_TEXT_INCOMPLETE",
  "AWARD_RULE_VERSION_NOT_FOUND",
  "METRIC_NOT_FOUND",
]);

/** A refusal in its two halves as `04-refusal-codes.md` words it: what happened (the title) and what to do (the text). */
export function refusalWords(code: string, t: Translate): { title: string; text: string } {
  return { title: t(`eng.refusal.${code}.title`), text: ONE_SENTENCE.has(code) ? "" : t(`eng.refusal.${code}.text`) };
}

/** A refusal's whole sentence, for the line under a field it is drawn beside. */
export function refusalSentence(code: string, t: Translate): string {
  const words = refusalWords(code, t);
  return words.text === "" ? words.title : `${words.title} ${words.text}`;
}

/**
 * What the response names beside a refusal (`FIELD_MISSING` names its field, `RELEASE_CONDITION_NOT_EVIDENCED` its
 * condition, `PARTICIPANT_NOT_ELIGIBLE` the classes in scope), as one line, or null where the code names nothing.
 */
export function refusalDetail(refusal: Refusal, t: Translate, locale: Locale): string | null {
  const value = (name: string) => String(refusal.values[name] ?? "");
  switch (refusal.code) {
    case "FIELD_MISSING":
      return t("eng.named.field", { field: t(`eng.field.${value("field")}`) });
    case "RELEASE_CONDITION_NOT_EVIDENCED":
      return t("eng.named.condition", { condition: t(`eng.condition.${value("condition")}`) });
    case "PARTICIPANT_NOT_ELIGIBLE":
      return t("eng.named.classes", { classes: classWords(value("classes").split(",").filter((c): c is ParticipantClass => c === "artist" || c === "premises"), t) });
    case "QUALIFYING_ACTION_NOT_RECOGNISED":
      return t("eng.named.codes", { n: value("version"), codes: value("codes") });
    case "CORRECTION_GROUND_NOT_APPROVED":
      return t("eng.named.grounds", { grounds: value("grounds").split(", ").map((ground) => t(`eng.ground.${ground}`)).join(", ") });
    case "CORRECTION_TARGET_ALREADY_CORRECTED":
      return value("next") !== "" ? t("eng.named.next", { event: value("next") }) : null;
    case "QUALIFYING_ACTION_CONFLICT":
      return value("event") !== "" ? t("eng.named.recorded", { event: value("event") }) : null;
    case "DISCLOSURE_TEXT_INCOMPLETE":
      return t(`eng.missing.${value("missing")}`);
    case "METRIC_PERIOD_NOT_CLOSED":
      return t("eng.named.closes", { ts: moment(value("closes"), locale) });
    case "METRIC_RECONCILIATION_VARIANCE":
      return t("eng.named.variance", { figure: count(Number(value("figure")), locale), ledger: count(Number(value("ledger")), locale), variance: signed(Number(value("variance")), locale) });
    case "METRIC_DEFINITION_NOT_OWNER":
      return t("eng.named.owner", { role: value("owner") });
    case "AWARD_RULE_WITHDRAWN":
      return t("eng.named.withdrawn", { n: value("version"), ts: moment(value("withdrawnAt"), locale), name: value("withdrawnBy") });
    case "EFFECTIVE_PERIOD_OVERLAP":
      return t("eng.named.overlap", { n: value("version") });
    default:
      return null;
  }
}

/** A condition's evidence in words: the version or the configuration that satisfies it, or that nothing does. */
export function evidenceWords(condition: ReleaseCondition, t: Translate): string {
  const evidence = condition.evidence;
  if (evidence === null) return t("eng12.noEvidence");
  switch (evidence.kind) {
    case "rule-version":
      return t("eng12.evRule", { n: evidence.no });
    case "disclosure":
      return t("eng12.evDisclosure", { n: evidence.no });
    case "config":
      return evidence.ref;
    case "metric-definitions":
      return t("eng12.evMetrics", { a: evidence.points, b: evidence.enrolled });
  }
}

/** A day-and-time a form field writes ("2026-10-15T09:30+07:00") as the instant it names, or null when it names none. */
export function readInstant(value: string): string | null {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})\+07:00$/.exec(value.trim());
  if (parts === null) return null;
  const [, date = "", hours = "", minutes = ""] = parts;
  const instant = `${date}T${hours}:${minutes}:00+07:00`;
  const calendar = new Date(`${date}T00:00:00Z`);
  const real = !Number.isNaN(calendar.getTime()) && calendar.toISOString().slice(0, 10) === date && Number(hours) < 24 && Number(minutes) < 60;
  return real ? instant : null;
}

/** An instant as the date field takes it back: its day and its time, in Vietnam time. */
export function fieldParts(iso: string | null): { date: string; time: string } {
  if (iso === null) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}
