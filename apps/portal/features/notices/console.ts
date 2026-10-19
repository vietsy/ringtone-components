import { R1_FORMAT } from "@rightone/formatting";
import type { Route } from "next";
import type { StatusValue } from "@/components/r1";
import type { NoticeState, PolicyState, RunState, TemplateState } from "@/lib/api/notices";
import { holds, type Staff } from "@/lib/api/session";
import type { Locale, Translate } from "@/lib/i18n/translate";
import type { StaffRole } from "@/lib/mock/backend/store";
import { routes } from "@/lib/routes";

/*
 * What the notice console's pages share: the workspace's tabs, each state's words and family, and the shared
 * format's words for a value inside a sentence.
 */

export const NOTICE_STATES: readonly NoticeState[] = ["DUE", "COMPOSED", "UNMET", "ISSUED", "DELIVERED", "UNDELIVERED", "SERVED_ALTERNATIVELY", "SUPERSEDED", "WITHDRAWN"];

/** SM-121's states in their families: UNMET and UNDELIVERED are danger and carry their word, never a dot alone. */
const NOTICE_FAMILY = {
  DUE: "info",
  COMPOSED: "info",
  UNMET: "danger",
  ISSUED: "info",
  DELIVERED: "positive",
  UNDELIVERED: "danger",
  SERVED_ALTERNATIVELY: "positive",
  SUPERSEDED: "neutral",
  WITHDRAWN: "neutral",
} as const;

export const noticeStateValue = (state: NoticeState, t: Translate): StatusValue => ({ family: NOTICE_FAMILY[state], label: t(`com.state.${state}`) });

/** SM-122's states: the version in force is marked; the others stay readable, never greyed (SCR-COM-01). */
const POLICY_FAMILY = { PREPARED: "attention", APPROVED: "info", EFFECTIVE: "positive", SUPERSEDED: "neutral", WITHDRAWN: "neutral" } as const;

export const policyStateValue = (state: PolicyState, t: Translate): StatusValue => ({ family: POLICY_FAMILY[state], label: t(`com.pstate.${state}`) });

const RUN_FAMILY = { RESOLVING: "info", ISSUING: "info", INCOMPLETE: "danger", COMPLETE: "positive" } as const;

export const runStateValue = (state: RunState, t: Translate): StatusValue => ({ family: RUN_FAMILY[state], label: t(`com.rstate.${state}`) });

export const templateStateValue = (state: TemplateState, inForce: boolean, t: Translate): StatusValue =>
  inForce
    ? { family: "positive", label: t("com04.inForce") }
    : { family: state === "PREPARED" ? "attention" : "neutral", label: t(`com.tstate.${state}`) };

/** The words for a class, by its code. */
export const className = (classCode: string, t: Translate) => t(`com.class.${classCode}`);

export const day = (value: string, locale: Locale) => R1_FORMAT.formatDate(value, locale) ?? "";
export const shortDay = (value: string, locale: Locale) => R1_FORMAT.formatDateShort(value, locale) ?? "";
export const moment = (value: string, locale: Locale) => R1_FORMAT.formatTimestamp(value, locale) ?? "";
export const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";

/** A period in words: "1 thg 7, 2026 đến 31 thg 12, 2026", or open-ended. */
export function periodWords(from: string, to: string | null, t: Translate, locale: Locale): string {
  return to === null ? t("comOps.periodOpen", { from: shortDay(from, locale) }) : t("comOps.periodValue", { from: shortDay(from, locale), to: shortDay(to, locale) });
}

/** A calendar month (YYYY-MM) in words: "tháng 9 năm 2026", "September 2026". */
export function monthWords(period: string, t: Translate): string {
  const [year, month] = period.split("-");
  return t("comOps.period", { month: t(`com.month.${Number(month)}`), y: year ?? "" });
}

/** Whole hours between two instants, never negative. */
export const hoursBetween = (from: string, to: string) => Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 3_600_000));

/** A day typed into a DateField (day/month/year) or sent as ISO, as an ISO date; null when it is not a day. */
export function askedDay(value: FormDataEntryValue | string | string[] | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  const [y, m, d] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (y === undefined || m === undefined || d === undefined) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? date.toISOString().slice(0, 10) : null;
}

export type NoticeTab = "queue" | "recovery" | "unmet" | "runs" | "timeliness" | "policy" | "templates";

/**
 * The notice workspace's pages and who opens each, as `03-screen-specifications.md` names the actors: the queue
 * and the position for operations and the auditor, recovery for operations and support, the unmet list and the
 * runs for operations, the policy and its templates for operations and the business approver. Recovery opens to the
 * business approver too: SCR-COM-09 carries the withdrawal (POST /notices/{id}/withdraw, ACT-BIZ-APR), and the
 * recovery queue is the approver's way to the notices still owed.
 */
const TABS: readonly { id: NoticeTab; href: () => Route; roles: readonly StaffRole[] }[] = [
  { id: "queue", href: () => routes.opsNotices(), roles: ["ACT-OPS", "ACT-AUD"] },
  { id: "recovery", href: () => routes.opsNoticeRecovery(), roles: ["ACT-OPS", "ACT-SUP", "ACT-BIZ-APR"] },
  { id: "unmet", href: () => routes.opsUnmetNotices(), roles: ["ACT-OPS"] },
  { id: "runs", href: () => routes.opsTrackChanges(), roles: ["ACT-OPS"] },
  { id: "timeliness", href: () => routes.opsNoticeTimeliness(), roles: ["ACT-OPS", "ACT-AUD"] },
  { id: "policy", href: () => routes.opsNoticePolicies(), roles: ["ACT-OPS", "ACT-BIZ-APR"] },
  { id: "templates", href: () => routes.opsNoticeTemplates(), roles: ["ACT-OPS", "ACT-BIZ-APR"] },
];

/** The roles that open a tab: what its page asks `requireStaff` for. */
export const tabRoles = (tab: NoticeTab): readonly StaffRole[] => TABS.find((entry) => entry.id === tab)?.roles ?? [];

/** The link tabs the member's roles open, in the workspace's order. */
export function noticeTabs(staff: Staff, t: Translate) {
  return TABS.filter((tab) => holds(staff, ...tab.roles)).map((tab) => ({ id: tab.id, label: t(`comOps.tab.${tab.id}`), href: tab.href() }));
}

/** The first page of the workspace the member's roles open: where the workspace's rail entry lands them. */
export function firstTab(staff: Staff): Route {
  return (TABS.find((tab) => holds(staff, ...tab.roles)) ?? TABS[0])?.href() ?? routes.ops();
}

/** The keys a console table answers to. */
export const tableKeys = (t: Translate) => [
  { keys: ["↑", "↓"], label: t("comOps.kMove") },
  { keys: ["Enter"], label: t("comOps.kOpen") },
];

/** A late interval in words: hours under two days, whole days from then on. */
export function lateWords(minutes: number, t: Translate): string {
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? t("com06.lateHours", { h: hours }) : t("com06.lateDays", { d: Math.floor(hours / 24) });
}

/** NOTICE_ELEMENT_MISSING's element in words: a content element by its name, a record's value by its placeholder. */
export function elementWords(element: string, t: Translate): string {
  return ["subject", "action", "deadline", "consequence", "reference", "contact"].includes(element) ? t(`com.element.${element}`) : `{${element}}`;
}
