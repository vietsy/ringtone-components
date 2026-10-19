import { describe, expect, it } from "vitest";
import type { CoverageOptions } from "@/features/coverage/types";
import { coverageSearch, invalidCoverageFields, readCoverageQuery } from "@/features/coverage/query";

const sample = { rightType: "performers", repertoireKey: "*", territoryCode: "VN-DN", asOf: "2026-06-15" };
const options: CoverageOptions = { rightTypes: ["performers"], territories: ["VN-DN"] };

describe("coverage lookup query", () => {
  it("submits edited values without forcing the previous review result", () => {
    const edited = { ...sample, repertoireKey: "different-track", asOf: "2026-07-01" };
    const params = new URLSearchParams(coverageSearch(edited, "view=not-covered&view=empty&frame=phone&context=review"));
    expect(params.has("view")).toBe(false);
    expect(params.get("frame")).toBe("phone");
    expect(params.get("context")).toBe("review");
    expect(readCoverageQuery(Object.fromEntries(params))).toEqual(edited);
  });

  it("has no default date and rejects a missing date", () => {
    expect(readCoverageQuery({})).toBeNull();
    expect(invalidCoverageFields({ ...sample, asOf: "" }, options)).toEqual(["asOf"]);
  });

  it("rejects impossible dates while accepting valid leap days", () => {
    expect(invalidCoverageFields({ ...sample, asOf: "2026-02-29" }, options)).toEqual(["asOf"]);
    expect(invalidCoverageFields({ ...sample, asOf: "2028-02-29" }, options)).toEqual([]);
  });
});
