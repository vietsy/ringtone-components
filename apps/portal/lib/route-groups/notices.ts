import { enc, route } from "./route";

/**
 * COM on the notice console (SCR-COM-01 to 04, 06, 08, 09, 13, 15, 16).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string from the values given, leaving out the empty ones. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const pairs = Object.entries(values).filter((pair): pair is [string, string] => typeof pair[1] === "string" && pair[1] !== "");
  return pairs.length > 0 ? `?${new URLSearchParams(pairs).toString()}` : "";
}

export const noticesRoutes = {
  /** SCR-COM-06 Notice queue, under its filter, with one notice opened beside it (SCR-COM-07's content) */
  opsNotices: (filter: { classCode?: string | null; state?: string | null; from?: string | null; to?: string | null; notice?: string | null } = {}) =>
    route(`/ops/notices${query({ class: filter.classCode, state: filter.state, from: filter.from, to: filter.to, notice: filter.notice })}`),
  /** SCR-COM-08 Recovery queue */
  opsNoticeRecovery: (classCode?: string | null) => route(`/ops/notices/recovery${query({ class: classCode })}`),
  /** SCR-COM-09 Record an alternative service */
  opsNoticeService: (notice: string) => route(`/ops/notices/recovery/${enc(notice)}`),
  /** SCR-COM-13 Track change runs: the runs */
  opsTrackChanges: () => route("/ops/notices/track-changes"),
  /** SCR-COM-13 Track change runs: one run and the premises it resolved */
  opsTrackChange: (run: string) => route(`/ops/notices/track-changes/${enc(run)}`),
  /** SCR-COM-15 Notice timeliness position, for a calendar month (YYYY-MM) */
  opsNoticeTimeliness: (period?: string | null) => route(`/ops/notices/timeliness${query({ period })}`),
  /** SCR-COM-16 Unmet obligations */
  opsUnmetNotices: () => route("/ops/notices/unmet"),
  /** SCR-COM-01 Notice policy versions */
  opsNoticePolicies: () => route("/ops/notices/policy"),
  /** SCR-COM-02 Policy version and its classes */
  opsNoticePolicy: (version: number) => route(`/ops/notices/policy/${version}`),
  /** SCR-COM-03 Approve a policy version */
  opsNoticePolicyApproval: (version: number) => route(`/ops/notices/policy/${version}/approve`),
  /** SCR-COM-04 Notice templates, filtered to one class */
  opsNoticeTemplates: (classCode?: string | null) => route(`/ops/notices/templates${query({ class: classCode })}`),
} as const;
