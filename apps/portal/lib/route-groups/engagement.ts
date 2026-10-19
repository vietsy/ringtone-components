import { enc, route } from "./route";

/**
 * ENG: the participant portal and engagement operations (SCR-ENG-01 to 13).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string from the values given, in the order given; empty when none is. */
function query(values: Readonly<Record<string, string | number | null | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

export const engagementRoutes = {
  // The premises portal: the participant's own record.
  /** SCR-ENG-01 Take part in engagement, the section's landing */
  engagement: () => route("/engagement"),
  /** SCR-ENG-02 Balance and history, as at an instant, from a page cursor */
  engagementBalance: (at?: { asAt?: string | null; after?: string | null }) => route(`/engagement/balance${query({ as_at: at?.asAt, after: at?.after })}`),
  /** SCR-ENG-03 What these points are */
  engagementPoints: () => route("/engagement/points"),
  /** SCR-ENG-04 One ledger event, the participant's own */
  engagementEvent: (event: string) => route(`/engagement/events/${enc(event)}`),

  // The operations console: the engagement workspace.
  /** The engagement workspace's home on the operations console, the "operations portal home" ENG-08, 10 and 12 open from */
  opsEngagement: () => route("/ops/engagement"),
  /** SCR-ENG-12 Capability release */
  opsEngagementRelease: () => route("/ops/engagement/release"),
  /** SCR-ENG-08 Record a qualifying action: the governing version resolved for a participant and an instant, the event recorded */
  opsQualifyingAction: (asked?: { participant?: string | null; at?: string | null; recorded?: string | null }) =>
    route(`/ops/engagement/qualifying-actions${query({ participant: asked?.participant, at: asked?.at, recorded: asked?.recorded })}`),
  /** SCR-ENG-10 Participant balance for support: a recorded read, a page of its history, one event selected */
  opsEngagementSupport: (read?: { read?: string | null; after?: string | null; event?: string | null }) =>
    route(`/ops/engagement/support${query({ read: read?.read, after: read?.after, event: read?.event })}`),
  /** SCR-ENG-04 One ledger event, read by an operations officer under the support read they recorded */
  opsEngagementEvent: (event: string, read: string) => route(`/ops/engagement/events/${enc(event)}${query({ read })}`),
  /** SCR-ENG-09 Correct a ledger event, proposed from the support read the event was selected in */
  opsCorrectionNew: (read: string, event: string) => route(`/ops/engagement/corrections/new${query({ read, event })}`),
  /** SCR-ENG-09 Correct a ledger event, once proposed: its authorisation */
  opsCorrection: (correction: string) => route(`/ops/engagement/corrections/${enc(correction)}`),
  /**
   * The assurance read of GET /balance/as-at: a participant's balance and history as at a past instant, under the
   * assurance engagement an auditor names, from a page cursor. ENG's inventory gives it no screen of its own
   */
  opsEngagementAssurance: (asked?: { participant?: string | null; engagement?: string | null; asAt?: string | null; after?: string | null }) =>
    route(`/ops/engagement/assurance${query({ participant: asked?.participant, engagement: asked?.engagement, as_at: asked?.asAt, after: asked?.after })}`),
  /** SCR-ENG-11 Engagement metrics: one metric or all, one snapshot opened, one definition being approved */
  opsEngagementMetrics: (filter?: { metric?: string | null; snapshot?: string | null; define?: string | null }) =>
    route(`/ops/engagement/metrics${query({ metric: filter?.metric, snapshot: filter?.snapshot, define: filter?.define })}`),

  // The policy console: the engagement workspace.
  /** SCR-ENG-06 Award rule versions, the policy workspace's landing, one version selected */
  policyAwardRules: (version?: number | null) => route(`/policy/engagement${query({ version })}`),
  /** SCR-ENG-07 Award rule version editor, one action's value being changed */
  policyAwardRuleEditor: (version: number, edit?: string | null) => route(`/policy/engagement/versions/${version}${query({ edit })}`),
  /** SCR-ENG-13 Disclosure version */
  policyDisclosure: () => route("/policy/engagement/disclosure"),
} as const;
