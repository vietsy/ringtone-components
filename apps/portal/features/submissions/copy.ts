import { R1_FORMAT } from "@rightone/formatting";
import type { Family } from "@/components/r1";
import type {
  Completeness,
  CorrectionRoute,
  OrgReader,
  OutcomeClass,
  RecordReason,
  Submission,
  SubmissionState,
} from "@/lib/api/submissions";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import en from "@/messages/screens/sub.en.json";
import vi from "@/messages/screens/sub.vi.json";
import { sizeParts } from "./sizes";

/*
 * The words of the submission and claim screens, built from the catalogue pair `messages/screens/sub.*.json`:
 * the shell's participation line, channel names, a record's reason and correction route, a submission's state
 * and meta line, a claim's completeness. Values in a sentence go through R1_FORMAT.
 */

export const subTranslator = (locale: Locale): Translate => translator({ vi, en }, locale);

/** The shell's context line under the organisation, as the CAT boards draw it. */
export function participationLine(t: Translate, participation: OrgReader["participation"]): string {
  const { reference, state } = participation;
  if (reference === null) return t("sub.contextNone");
  return state === "SUSPENDED" ? t("sub.contextSuspended", { reference }) : t("sub.context", { reference });
}

export const channelName = (t: Translate, code: string) => t(`sub.channel.${code}`);

/** "Direct API, JSON", as the boards write a submission's channel. */
export const channelAndFormat = (t: Translate, submission: Pick<Submission, "channel" | "format">) =>
  t("sub.channelFormat", { channel: channelName(t, submission.channel), format: t(`sub.format.${submission.format}`) });

export function fileSize(t: Translate, bytes: number, locale: Locale): string {
  const { value, unit } = sizeParts(bytes, locale);
  return t(unit === "MB" ? "sub.sizeMb" : "sub.sizeKb", { size: value });
}

const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

/** A record's reason: the refusal catalogue's sentence for its code, with the values it names. */
export function reasonText(t: Translate, reason: RecordReason): string {
  switch (reason.code) {
    case "IDENTIFIER_FORMAT":
      return t("sub.reason.IDENTIFIER_FORMAT", { scheme: reason.scheme });
    case "RECORD_DUPLICATE":
      return t("sub.reason.RECORD_DUPLICATE", { heldAs: reason.heldAs });
    case "CREDIT_KIND_UNRECOGNISED":
      return t("sub.reason.CREDIT_KIND_UNRECOGNISED", { credit: t(`sub.credit.${reason.credit}`) });
    case "ROLE_MISSING":
      return t("sub.reason.ROLE_MISSING", { role: t(`sub.role.${reason.role}`) });
    default:
      return t(`sub.reason.${reason.code}`);
  }
}

/** A record's correction route (FR-CAT-020): what to do, and who does it. */
export function routeText(t: Translate, route: CorrectionRoute): { text: string; detail: string } {
  const values =
    route.kind === "correct-identifier" ? { scheme: route.scheme } : route.kind === "supplement-role" ? { role: t(`sub.role.${route.role}`) } : {};
  return { text: t(`sub.route.${route.kind}`, values), detail: t(`sub.route.${route.kind}.who`) };
}

/** DR-33's classes in the status families of SCR-CAT-05's list definition. */
export const OUTCOME_FAMILY: Readonly<Record<OutcomeClass, Family>> = {
  ACCEPTED: "neutral",
  WARNING: "attention",
  REJECTED: "danger",
  DUPLICATE: "attention",
  CONFLICT: "danger",
};

export function submissionStatus(t: Translate, state: SubmissionState): { family: Family; label: string } {
  const inFlight = state === "RECEIVED" || state === "PROCESSING";
  return { family: inFlight ? "info" : "neutral", label: t(`cat05.state.${state}`) };
}

const sameDay = (a: string, b: string, locale: Locale) => R1_FORMAT.formatDate(a, locale) === R1_FORMAT.formatDate(b, locale);

/** The header's line under a submission's title, as SCR-CAT-05 and SCR-CAT-24 write it for each state. */
export function submissionMeta(t: Translate, submission: Submission, locale: Locale): string {
  const time = (at: string) => R1_FORMAT.formatTime(at) ?? "";
  const date = (at: string) => R1_FORMAT.formatDate(at, locale) ?? "";
  const received = { time: time(submission.receivedAt), date: date(submission.receivedAt), channel: t(`sub.channelInText.${submission.channel}`) };
  const { completedAt, acknowledged, cancelled } = submission;
  if (cancelled !== null) {
    return t("cat05.metaCancelled", { ...received, name: cancelled.by, cancelledTime: time(cancelled.at), cancelledDate: date(cancelled.at) });
  }
  if (completedAt === null) return t("cat05.metaReceived", received);
  const finished = { finished: time(completedAt), finishedDate: date(completedAt) };
  if (acknowledged !== null) {
    const total = submission.counts === null ? 0 : Object.values(submission.counts).reduce((sum, n) => sum + n, 0);
    const values = { ...finished, name: acknowledged.by, count: count(total, locale), time: time(acknowledged.at), date: date(acknowledged.at) };
    return t(sameDay(completedAt, acknowledged.at, locale) ? "cat05.metaAcknowledged" : "cat05.metaAcknowledgedOtherDay", values);
  }
  return t(sameDay(submission.receivedAt, completedAt, locale) ? "cat05.metaCompleted" : "cat05.metaCompletedOtherDay", { ...received, ...finished });
}

/** A percentage of a share in a sentence: at most four decimals, as numeric(7,4) stores it. */
export const percentText = (value: number, locale: Locale) => R1_FORMAT.nf(locale, { maximumFractionDigits: 4 }).format(value);

/** The status family each completeness outcome is drawn in on SCR-CAT-07: opposite problems, opposite colours. */
const COMPLETENESS_FAMILY: Readonly<Record<Completeness["code"], Family>> = {
  COMPLETENESS_RULE_ABSENT: "attention",
  SHARES_COMPLETE: "neutral",
  SHARES_SHORT: "attention",
  SHARES_OVER: "danger",
  BENEFICIARY_PARTIAL: "neutral",
  SHARE_NOT_STATED: "attention",
  SHARES_ABSENT: "neutral",
  WHOLE_INTEREST: "neutral",
  NO_BENEFICIARY_STATED: "neutral",
};

/** One row of the completeness panel: the outcome as a word and its sentence, never a colour alone. */
export function completenessValue(t: Translate, kind: "ownership" | "beneficiary", outcome: Completeness, locale: Locale) {
  const sentence = (): string => {
    switch (outcome.code) {
      case "SHARES_COMPLETE":
        return t(`cat07.c.SHARES_COMPLETE.${kind}`, { total: percentText(outcome.total, locale) });
      case "SHARES_SHORT":
      case "SHARES_OVER":
        return t(`cat07.c.${outcome.code}.text`, { total: percentText(outcome.total, locale) });
      case "BENEFICIARY_PARTIAL":
        return t("cat07.c.BENEFICIARY_PARTIAL.text", { assigned: percentText(outcome.assigned, locale), kept: percentText(outcome.kept, locale) });
      case "COMPLETENESS_RULE_ABSENT":
        return t("sub.reason.COMPLETENESS_RULE_ABSENT");
      default:
        return t(`cat07.c.${outcome.code}.text`);
    }
  };
  return { family: COMPLETENESS_FAMILY[outcome.code], plain: true, label: t(`cat07.c.${outcome.code}`), detail: sentence() };
}
