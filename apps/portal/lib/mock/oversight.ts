import type { LoadOutcome } from "@rightone/ui";
import type { RouteKind } from "@/lib/api/oversight";

/**
 * The oversight console's sample data for the public service (SCR-PUB-19, 20). The verification counts the PUB board
 * draws for 1 to 29 September 2026 are the history the world starts from: the certificate route could not read VER's
 * status source then, and the Player route had no document to match. Every answer the public pages give in this
 * browser's world is counted on top of them (`lib/mock/backend/oversight.ts`). Invented figures; nothing here is a
 * real record.
 */

/** One line of the board's counts: a route, an outcome or a refusal, its cause, and how many over the period. */
export interface TallyLine {
  routeKind: RouteKind;
  outcome: string;
  cause: string | null;
  count: number;
}

/** The period the board's counts cover, Vietnam days, both ends included. */
export const TALLY_HISTORY_PERIOD = { from: "2026-09-01", to: "2026-09-29" } as const;

/** SCR-PUB-19 on the board, row by row. */
export const TALLY_HISTORY: readonly TallyLine[] = [
  { routeKind: "AUTHORITATIVE_PREMISES_STATUS", outcome: "UNABLE", cause: "STATUS_SOURCE_UNAVAILABLE", count: 1137 },
  { routeKind: "AUTHORITATIVE_PREMISES_STATUS", outcome: "IDENTIFIER_NOT_ACCEPTED", cause: null, count: 64 },
  { routeKind: "AUTHORITATIVE_PREMISES_STATUS", outcome: "VERIFICATION_RATE_LIMITED", cause: null, count: 9 },
  { routeKind: "AUTHORITATIVE_PREMISES_STATUS", outcome: "ENUMERATION_NOT_PERMITTED", cause: null, count: 3 },
  { routeKind: "PLAYER_SERVICE_ENTITLEMENT", outcome: "ABSENT", cause: null, count: 212 },
  { routeKind: "PLAYER_SERVICE_ENTITLEMENT", outcome: "IDENTIFIER_NOT_ACCEPTED", cause: null, count: 17 },
  { routeKind: "DIRECT_LICENCE", outcome: "UNABLE", cause: "SOURCE_NOT_OFFERED", count: 23 },
  { routeKind: "EVIDENCE_PROOF", outcome: "UNABLE", cause: "SOURCE_NOT_OFFERED", count: 6 },
  { routeKind: "SCOPE_ASSESSMENT", outcome: "INDETERMINATE", cause: "GUIDANCE_UNAVAILABLE", count: 358 },
  { routeKind: "INDICATIVE_AMOUNT", outcome: "INDICATIVE_NOT_OFFERED", cause: null, count: 41 },
];

/** The review states the boards draw that the live data never reaches: loading, our outage, and GOV's read failing. */
export const PUB19_VIEWS = ["loading", "error"] as const;
export const PUB20_VIEWS = ["loading", "error", "policy-read-unavailable"] as const;
export type Pub19View = (typeof PUB19_VIEWS)[number];
export type Pub20View = (typeof PUB20_VIEWS)[number];

/** The outage a board draws for each screen, with its trace identifier. */
export function mockOversightFailure(screen: "pub19" | "pub20"): LoadOutcome<never> {
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: screen === "pub19" ? "a4e8170c5b2d93f6" : "5c93d0e8f1a27b46", retryable: true } };
}

/** SCR-PUB-20 when GOV's read of `PUB-DISCLOSURE-PROFILE` raises: the public routes meanwhile apply the minimum. */
export const POLICY_READ_UNAVAILABLE: LoadOutcome<never> = { data: null, failure: { code: "POLICY_READ_UNAVAILABLE", traceId: null, retryable: true } };
