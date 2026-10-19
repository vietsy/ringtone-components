import type { LoadOutcome } from "@rightone/ui";
import { ROUTE_KINDS, type DisclosureProfile, type OutcomeCount, type OutcomeCounts, type RecordType, type RouteKind } from "@/lib/api/oversight";
import { TALLY_HISTORY, TALLY_HISTORY_PERIOD } from "@/lib/mock/oversight";
import { addDays, now, today } from "./clock";
import { disclosureProfileAt } from "./public";
import { table, type StaffRole } from "./store";

/**
 * PUB's side of the oversight console, played by the mock backend: the outcome tallies of the public routes
 * (`public_view.verification_tallies`, `ALG-463`) and the disclosure profile those routes apply (`ALG-458`, read by
 * `GET /disclosure-profile`). The tallies are a world's own, so what this browser's public pages answered is what its
 * oversight officer counts; they hold no reference and no requester, only the route, the outcome and the cause.
 */

interface Tally {
  /** The Vietnam day of the minute the answer was sent in, which the period selects on. */
  day: string;
  minute: string;
  routeKind: RouteKind;
  outcome: string;
  cause: string | null;
  refused: boolean;
  count: number;
}

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const holds = (roles: readonly StaffRole[], ...allowed: readonly StaffRole[]) => allowed.some((role) => roles.includes(role));

/** Refusals of the public routes, as their codes; everything else counted is an outcome the route answered. */
const REFUSALS: readonly string[] = [
  "IDENTIFIER_NOT_ACCEPTED",
  "VERIFICATION_RATE_LIMITED",
  "ENUMERATION_NOT_PERMITTED",
  "ASSESSMENT_INPUT_INVALID",
  "INDICATIVE_NOT_OFFERED",
  "NO_TARIFF_FOR_DATE",
  "TARIFF_UNAVAILABLE",
];
const OUTCOMES: readonly string[] = ["RECORD", "ABSENT", "UNABLE", "IN_SCOPE", "OUT_OF_SCOPE", "INDETERMINATE", "INDICATED", "NO_AMOUNT"];

/** The minute an instant falls in, in Vietnam time (a whole number of hours from UTC): "2026-10-15T09:41". */
const vietnamMinute = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 16);

/**
 * The board's counts of 1 to 29 September 2026 as a world's first tallies, spread evenly over the days so a shorter
 * period reads its share; the remainder of a division falls on the first days.
 */
function history(): Tally[] {
  const days: string[] = [];
  for (let day: string = TALLY_HISTORY_PERIOD.from; day <= TALLY_HISTORY_PERIOD.to; day = addDays(`${day}T12:00:00+07:00`, 1)) days.push(day);
  return TALLY_HISTORY.flatMap((line) =>
    days
      .map((day, index) => ({
        day,
        minute: `${day}T10:00`,
        routeKind: line.routeKind,
        outcome: line.outcome,
        cause: line.cause,
        refused: REFUSALS.includes(line.outcome),
        count: Math.floor(line.count / days.length) + (index < line.count % days.length ? 1 : 0),
      }))
      .filter((tally) => tally.count > 0),
  );
}

const talliesOf = (key: string): Tally[] => table(key, "verification-tallies", history);

/** `ALG-463` per answer: one more for the route, the outcome and the cause, in the minute it was sent. */
function count(world: string, routeKind: RouteKind, outcome: string, cause: string | null): void {
  const minute = vietnamMinute(now());
  const tallies = talliesOf(world);
  const same = tallies.find((t) => t.minute === minute && t.routeKind === routeKind && t.outcome === outcome && t.cause === cause);
  if (same !== undefined) same.count += 1;
  else tallies.push({ day: minute.slice(0, 10), minute, routeKind, outcome, cause, refused: REFUSALS.includes(outcome), count: 1 });
}

/** What a route's answer or refusal is counted under: the refusal's code, or the outcome with its cause. */
type Countable = { data: { outcome: string; cause?: string | null } | null; failure: { code: string } | null };

/**
 * Counts a verification route's answer in the world it was given in (`ALG-455` step 8, and every refusal of steps 1
 * to 3 under its own code), and hands the answer back unchanged.
 */
export function countVerification<T extends Countable>(world: string, routeKind: RouteKind, answer: T): T {
  if (answer.failure !== null) count(world, routeKind, answer.failure.code, null);
  else if (answer.data !== null) count(world, routeKind, answer.data.outcome.toUpperCase(), answer.data.cause ?? null);
  return answer;
}

/** Counts the scope guidance's or the indicative amount's answer to declared facts (`ALG-463`'s other callers). */
export function countAssessment<T extends { answer: Countable }>(world: string, routeKind: "SCOPE_ASSESSMENT" | "INDICATIVE_AMOUNT", attempt: T): T {
  countVerification(world, routeKind, attempt.answer);
  return attempt;
}

const order = (row: OutcomeCount) => {
  const answered = OUTCOMES.indexOf(row.outcome);
  const refusal = REFUSALS.indexOf(row.outcome);
  return ROUTE_KINDS.indexOf(row.routeKind) * 100 + (answered >= 0 ? answered : OUTCOMES.length + (refusal >= 0 ? refusal : REFUSALS.length));
};

/**
 * `GET /verification-outcome-counts` (PERM-876): the tallies of a period summed per route, outcome and cause, by route
 * and then by outcome, refusals after the outcomes. An inability and an absence are never one figure.
 */
export function verificationOutcomeCounts(
  key: string,
  roles: readonly StaffRole[],
  asked: { from: string; to: string; routeKind: RouteKind | null },
): LoadOutcome<OutcomeCounts> {
  if (!holds(roles, "ACT-REP", "ACT-SEC")) return refused("NOT_AUTHORISED");
  if (asked.to < asked.from) return refused("PERIOD_INVALID");
  const sums = new Map<string, OutcomeCount>();
  for (const tally of talliesOf(key)) {
    if (tally.day < asked.from || tally.day > asked.to) continue;
    if (asked.routeKind !== null && tally.routeKind !== asked.routeKind) continue;
    const id = `${tally.routeKind}|${tally.outcome}|${tally.cause ?? ""}`;
    const sum = sums.get(id) ?? { routeKind: tally.routeKind, outcome: tally.outcome, cause: tally.cause, refused: tally.refused, count: 0 };
    sum.count += tally.count;
    sums.set(id, sum);
  }
  const rows = [...sums.values()].sort((a, b) => order(a) - order(b) || (a.cause ?? "").localeCompare(b.cause ?? ""));
  return ok({ period: { from: asked.from, to: asked.to }, routeKind: asked.routeKind, granularity: asked.from === asked.to ? "HOUR" : "DAY", asOf: now(), rows });
}

/**
 * `GET /disclosure-profile` (PERM-877) for one record type, now or at a day that has come: the version of
 * `PUB-DISCLOSURE-PROFILE` GOV approved that is in effect at that instant, every field it admits with the version or the
 * decision that admits it, and each entry `DR-486` does not apply with its finding; or the minimum profile while no
 * version is in effect (row 6), which is what the public verification pages then carry (SCR-PUB-05, 06). The profile is
 * read from the public service's register (`public.ts`, `ALG-458`). A day not yet come is INSTANT_INVALID.
 */
export function disclosureProfile(key: string, roles: readonly StaffRole[], recordType: RecordType, at: string | null): LoadOutcome<DisclosureProfile> {
  if (!holds(roles, "ACT-DPO", "ACT-SEC")) return refused("NOT_AUTHORISED");
  if (at !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(at) || at > today())) return refused("INSTANT_INVALID");
  // A day asked is read at its end, or now when it is today.
  const instant = at === null ? Date.now() : Math.min(Date.parse(`${at}T23:59:59.999+07:00`), Date.now());
  const profile = disclosureProfileAt(key, recordType, instant);
  return ok({ recordType, state: profile.state, version: profile.version, asAt: at, readAt: now(), entries: profile.entries });
}
