import type { LoadOutcome } from "@rightone/ui";
import { today } from "@/lib/mock/backend/clock";
import { disclosureProfile, verificationOutcomeCounts } from "@/lib/mock/backend/oversight";
import { mockOversightFailure, POLICY_READ_UNAVAILABLE, type Pub19View, type Pub20View } from "@/lib/mock/oversight";
import type { Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/**
 * The oversight console's reads of the public service: how the public routes answered (`GET /verification-outcome-
 * counts`, SCR-PUB-19) and the disclosure profile they apply (`GET /disclosure-profile`, SCR-PUB-20). Both are reads;
 * nothing here acts on a record.
 */

/** The public routes a count belongs to: the four verification routes, and the scope guidance and the amount. */
export type RouteKind =
  | "AUTHORITATIVE_PREMISES_STATUS"
  | "PLAYER_SERVICE_ENTITLEMENT"
  | "DIRECT_LICENCE"
  | "EVIDENCE_PROOF"
  | "SCOPE_ASSESSMENT"
  | "INDICATIVE_AMOUNT";

/** In the order the counts list them (RPT-PUB-01). */
export const ROUTE_KINDS: readonly RouteKind[] = [
  "AUTHORITATIVE_PREMISES_STATUS",
  "PLAYER_SERVICE_ENTITLEMENT",
  "DIRECT_LICENCE",
  "EVIDENCE_PROOF",
  "SCOPE_ASSESSMENT",
  "INDICATIVE_AMOUNT",
];

/**
 * One count: a route, the outcome it answered or the code it refused with, the cause where an inability or an
 * indeterminate answer names one, and how many over the period. `refused` sets a refusal apart from the outcomes.
 */
export interface OutcomeCount {
  routeKind: RouteKind;
  outcome: string;
  cause: string | null;
  refused: boolean;
  count: number;
}

/** The counts of a period (RPT-PUB-01): no identifier and no requester, only the figures. */
export interface OutcomeCounts {
  period: { from: string; to: string };
  routeKind: RouteKind | null;
  /** The tallies' interval: the hour for a period of one day or less, the day otherwise. */
  granularity: "HOUR" | "DAY";
  /** The instant the counts were read. */
  asOf: string;
  rows: readonly OutcomeCount[];
}

/** The record types a public answer can be, each with its own admitted fields. */
export type RecordType =
  | "AUTHORITATIVE_PREMISES_STATUS"
  | "PLAYER_SERVICE_ENTITLEMENT"
  | "DIRECT_LICENCE"
  | "EVIDENCE_PROOF"
  | "ARTIST_PROFILE"
  | "TRACK";

export const RECORD_TYPES: readonly RecordType[] = [
  "AUTHORITATIVE_PREMISES_STATUS",
  "PLAYER_SERVICE_ENTITLEMENT",
  "DIRECT_LICENCE",
  "EVIDENCE_PROOF",
  "ARTIST_PROFILE",
  "TRACK",
];

/** One field of a record type and what `DR-486` does with it: carried, or withheld with the finding that withholds it. */
export interface ProfileEntry {
  field: string;
  /** The minimum profile, the version that admits the field, or the decision that admits a protected one. */
  admittedBy: { kind: "MINIMUM" } | { kind: "VERSION"; version: string } | { kind: "DECISION"; decision: string };
  state: "ADMITTED" | "WITHHELD";
  finding: "DECISION_REF_MISSING" | "NOT_ATTRIBUTED" | null;
}

/** The disclosure profile in effect for one record type, now or at the day asked. */
export interface DisclosureProfile {
  recordType: RecordType;
  /** `APPLIED` when an approved version of `PUB-DISCLOSURE-PROFILE` is in effect; the minimum profile otherwise. */
  state: "APPLIED" | "MINIMUM_PROFILE";
  version: { ref: string; approvedOn: string } | null;
  /** The day asked, or null for the profile in effect now. */
  asAt: string | null;
  readAt: string;
  /** Admitted fields first, then withheld ones. */
  entries: readonly ProfileEntry[];
}

/**
 * SCR-PUB-19: the counts of a period and, if asked, of one route; refused to a reader without PERM-876. The API needs
 * both ends; the screen opens on the first day of last month to today, which holds last month's whole and this month's
 * answers so far, and an end left empty takes that day.
 */
export function loadVerificationCounts(
  staff: Staff,
  asked: { from: string | null; to: string | null; routeKind: RouteKind | null },
  view: Pub19View | null,
): Promise<LoadOutcome<OutcomeCounts>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockOversightFailure("pub19"));
  const [year = 0, month = 1] = today().split("-").map(Number);
  const firstOfLastMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
  const period = { from: asked.from ?? firstOfLastMonth, to: asked.to ?? today(), routeKind: asked.routeKind };
  return Promise.resolve(verificationOutcomeCounts(staff.sessionId, staff.roles, period));
}

/** SCR-PUB-20: the profile for a record type, now or at a past day; refused to a reader without PERM-877. */
export function loadDisclosureProfile(staff: Staff, recordType: RecordType, at: string | null, view: Pub20View | null): Promise<LoadOutcome<DisclosureProfile>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockOversightFailure("pub20"));
  if (view === "policy-read-unavailable") return Promise.resolve(POLICY_READ_UNAVAILABLE);
  return Promise.resolve(disclosureProfile(staff.sessionId, staff.roles, recordType, at));
}
