import { describe, expect, it } from "vitest";
import { isAnswered, toViewState, type LoadOutcome } from "../src/index.js";

const ok = (rows: readonly string[]): LoadOutcome<readonly string[]> => ({ data: rows, failure: null });
const failed = (code: string, retryable = true): LoadOutcome<readonly string[]> => ({
  data: null,
  failure: { code, traceId: "trace-123", retryable },
});

describe("a failure never becomes an empty state", () => {
  it("renders an error when the request failed, even though there are no rows", () => {
    // The tempting shape is `data ?? []` and then "no results". That tells a premises it has no
    // evidence when in fact the evidence service is down.
    const state = toViewState(failed("INTERNAL_ERROR"), "governed", "No accepted evidence in this period.");
    expect(state.kind).toBe("error");
  });

  it("keeps the code and the trace identifier so support can find the request", () => {
    const state = toViewState(failed("ENTITLEMENT_NOT_FOUND", false), "governed", "x");
    expect(state).toMatchObject({ kind: "error", code: "ENTITLEMENT_NOT_FOUND", traceId: "trace-123", retryable: false });
  });

  it("says whether retrying is worthwhile", () => {
    expect(toViewState(failed("RATE_LIMITED", true), "governed", "x")).toMatchObject({ retryable: true });
    expect(toViewState(failed("FORBIDDEN", false), "governed", "x")).toMatchObject({ retryable: false });
  });
});

describe("empty says which kind of empty it is", () => {
  it("marks a governed outcome as governed, not as missing data", () => {
    const state = toViewState(ok([]), "governed", "No obligation is payable for this period.");
    expect(state).toMatchObject({ kind: "empty", outcome: "governed" });
  });

  it("distinguishes a period that has not started from a rule that produced nothing", () => {
    expect(toViewState(ok([]), "not-started", "x")).toMatchObject({ outcome: "not-started" });
    expect(toViewState(ok([]), "governed", "x")).toMatchObject({ outcome: "governed" });
  });

  it("distinguishes a filter that excluded everything, which the user can act on", () => {
    expect(toViewState(ok([]), "filtered", "x")).toMatchObject({ outcome: "filtered" });
  });

  it("always carries an explanation, because 'No results' alone is a dead end", () => {
    const state = toViewState(ok([]), "governed", "No accepted evidence in this period.");
    if (state.kind !== "empty") throw new Error("expected empty");
    expect(state.explanation.length).toBeGreaterThan(0);
  });
});

describe("populated", () => {
  it("returns the rows", () => {
    expect(toViewState(ok(["a", "b"]), "governed", "x")).toMatchObject({ kind: "populated", data: ["a", "b"] });
  });
});

describe("answered", () => {
  it("counts a governed empty as an answer, and an error as not one", () => {
    expect(isAnswered(toViewState(ok([]), "governed", "x"))).toBe(true);
    expect(isAnswered(toViewState(ok(["a"]), "governed", "x"))).toBe(true);
    expect(isAnswered(toViewState(failed("INTERNAL_ERROR"), "governed", "x"))).toBe(false);
  });
});
