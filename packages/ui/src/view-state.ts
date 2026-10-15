/**
 * Every view that loads data implements four states, and a pull request adding one with fewer does
 * not merge (R23.4).
 *
 * The empty state carries more weight in this product than in most, because "no data" is usually a
 * **governed outcome** rather than a gap: no accepted evidence yet for this period, no measurement
 * available, an analytical aggregate not refreshed, no payable obligation. The FRD requires several
 * of those to be shown explicitly.
 *
 * So the type makes the distinction impossible to skip: an empty state must say which kind it is,
 * and a failure is a different variant entirely. "Empty because nothing qualified" and "empty
 * because something is broken" cannot be rendered by the same branch.
 */

export type EmptyOutcome =
  /** A rule ran and produced nothing. This is a correct, complete answer. */
  | "governed"
  /** Nothing has happened yet in this period. Also correct, and different. */
  | "not-started"
  /** A filter excluded everything. The user can act on this one. */
  | "filtered";

export type ViewState<T> =
  | { kind: "loading" }
  | {
      kind: "empty";
      outcome: EmptyOutcome;
      /** Why it is empty and what the user can do. "No results" alone is a dead end. */
      explanation: string;
    }
  | {
      kind: "error";
      /** Stable code from the contract. The message is rendered from this, never from `detail`. */
      code: string;
      /** Shown to the user so support can find the request. */
      traceId: string | null;
      /** Whether retrying is worthwhile. Saying so spares a pointless retry, or prompts a useful one. */
      retryable: boolean;
    }
  | { kind: "populated"; data: T };

export interface LoadOutcome<T> {
  data: T | null;
  /** Present when the request failed. A failure never produces an empty state. */
  failure: { code: string; traceId: string | null; retryable: boolean } | null;
}

/**
 * Turns a load result into a view state.
 *
 * The rule this function exists to enforce: **a failure never becomes an empty state.** The
 * tempting shape - `data ?? []` then "no results" - tells a premises that it has no evidence when
 * in fact the evidence service is down. One of those is a governed answer about their business;
 * the other is our outage.
 */
export function toViewState<T>(
  outcome: LoadOutcome<readonly T[]>,
  emptyOutcome: EmptyOutcome,
  explanation: string,
): ViewState<readonly T[]> {
  if (outcome.failure !== null) {
    return {
      kind: "error",
      code: outcome.failure.code,
      traceId: outcome.failure.traceId,
      retryable: outcome.failure.retryable,
    };
  }

  if (outcome.data === null || outcome.data.length === 0) {
    return { kind: "empty", outcome: emptyOutcome, explanation };
  }

  return { kind: "populated", data: outcome.data };
}

export function isEmpty<T>(state: ViewState<T>): boolean {
  return state.kind === "empty";
}

/** True when the screen is showing a correct answer, whether or not it has rows. */
export function isAnswered<T>(state: ViewState<T>): boolean {
  return state.kind === "populated" || state.kind === "empty";
}
