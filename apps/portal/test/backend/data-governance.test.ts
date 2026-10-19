import { afterEach, describe, expect, it, vi } from "vitest";
import { exportProvenance, lookUpProvenance, provenanceRefusals, recordProvenanceClass, resolveProvenance, type DataActor } from "@/lib/mock/backend/data-governance";
import { findAccount } from "@/lib/mock/backend/accounts";
import { PEOPLE, signIn, signInBeside } from "./harness";

/** The member of staff a session names, as the seam hands them to the backend. */
function actorOf(email: string): DataActor {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { roles: account.staffRoles, name: account.name };
}

const officer = actorOf(PEOPLE.operations);
const NOW = "2026-10-16T09:00:00+07:00";

afterEach(() => {
  vi.useRealTimers();
});

/** A resolution that must have answered with a class. */
function resolved(key: string, inputs: readonly { valueRef: string; provenanceClass?: string }[], asOf = NOW) {
  const answer = resolveProvenance(key, officer, { inputs, asOf, withClass: true });
  if (answer.data?.resolved === undefined || answer.data.resolved === null) throw new Error(`not resolved: ${JSON.stringify(answer)}`);
  return answer.data.resolved;
}

describe("POST /provenance/resolve", () => {
  it("@AC-FR-DAT-026-01 gives a sum of three authoritative inputs the class derived, naming the three inputs", () => {
    const key = signIn(PEOPLE.operations);
    const answer = resolved(key, [
      { valueRef: "fee/2026-Q3/hcm", provenanceClass: "authoritative" },
      { valueRef: "fee/2026-Q3/hn", provenanceClass: "authoritative" },
      { valueRef: "fee/2026-Q3/ct", provenanceClass: "authoritative" },
    ]);
    expect(answer.provenanceClass).toBe("derived");
    expect(answer.reason).toBe("DERIVED_FROM_AUTHORITATIVE");
    expect(answer.inputs.map((input) => input.valueRef).sort()).toEqual(["fee/2026-Q3/ct", "fee/2026-Q3/hcm", "fee/2026-Q3/hn"]);
  });

  it("@AC-FR-DAT-026-02 lets the one estimated input of three decide the class, and names it", () => {
    const key = signIn(PEOPLE.operations);
    const answer = resolved(key, [
      { valueRef: "fee/2026-Q3/hcm", provenanceClass: "authoritative" },
      { valueRef: "fee/2026-Q3/hn", provenanceClass: "estimated" },
      { valueRef: "fee/2026-Q3/ct", provenanceClass: "authoritative" },
    ]);
    expect(answer.provenanceClass).toBe("estimated");
    expect(answer.reason).toBe("WEAKEST_INPUT_ESTIMATED");
    expect(answer.decidedBy).toBe("fee/2026-Q3/hn");
    expect(answer.inputs.filter((input) => input.weakest).map((input) => input.valueRef)).toEqual(["fee/2026-Q3/hn"]);
  });

  it("@AC-FR-DAT-026-03 makes one measured premises and nine area-weighted ones an imputed figure", () => {
    const key = signIn(PEOPLE.operations);
    const weighted = Array.from({ length: 9 }, (_, n) => ({ valueRef: `area-weighting/ben-thanh/venue-${n + 1}`, provenanceClass: "imputed" }));
    // The measurement is recorded here (authoritative, by the job that produced it), so it is named by its reference alone.
    const answer = resolved(key, [{ valueRef: "measured/venue-114" }, ...weighted]);
    expect(answer.provenanceClass).toBe("imputed");
    expect(answer.reason).toBe("WEAKEST_INPUT_IMPUTED");
    expect(["authoritative", "derived"]).not.toContain(answer.provenanceClass);
    expect(answer.inputs.find((input) => input.valueRef === "measured/venue-114")).toMatchObject({ provenanceClass: "authoritative", stated: false });
  });

  it("@AC-FR-DAT-026-05 refuses a caller who asks without the class, returns nothing and records the attempt with the caller and the instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const key = signIn(PEOPLE.operations);
    const answer = resolveProvenance(key, officer, { inputs: [{ valueRef: "measured/venue-114" }, { valueRef: "area-weighting/ben-thanh" }], asOf: NOW, withClass: false });
    expect(answer.failure).toBeNull();
    expect(answer.data?.resolved).toBeNull();
    expect(answer.data?.refusal).toMatchObject({ code: "CLASS_CANNOT_BE_OMITTED", attempt: { by: "Phan Gia Lượng" } });
    const recorded = provenanceRefusals(key, officer.roles).data ?? [];
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ code: "CLASS_CANNOT_BE_OMITTED", caller: "Phan Gia Lượng", valueRefs: ["measured/venue-114", "area-weighting/ben-thanh"] });
    expect(Date.parse(recorded[0]?.attemptedAt ?? "")).toBe(Date.parse(NOW));
  });

  it("refuses an input with no class stated or recorded with PROVENANCE_CLASS_MISSING, naming it", () => {
    const key = signIn(PEOPLE.operations);
    const answer = resolveProvenance(key, officer, { inputs: [{ valueRef: "measured/venue-114" }, { valueRef: "premises/114/floor_area_m2" }], asOf: NOW, withClass: true });
    expect(answer.data).toEqual({ resolved: null, refusal: { code: "PROVENANCE_CLASS_MISSING", input: "premises/114/floor_area_m2", attempt: null } });
  });

  it("refuses a stated class outside the six with PROVENANCE_CLASS_UNKNOWN, naming the input", () => {
    const key = signIn(PEOPLE.operations);
    const answer = resolveProvenance(key, officer, { inputs: [{ valueRef: "measured/venue-114" }, { valueRef: "survey/hn", provenanceClass: "verified" }], asOf: NOW, withClass: true });
    expect(answer.data?.refusal).toMatchObject({ code: "PROVENANCE_CLASS_UNKNOWN", input: "survey/hn" });
  });

  it("answers a missing class before the prohibition, and records no refused attempt for it", () => {
    const key = signIn(PEOPLE.operations);
    const answer = resolveProvenance(key, officer, { inputs: [{ valueRef: "premises/114/floor_area_m2" }], asOf: NOW, withClass: false });
    expect(answer.data?.refusal?.code).toBe("PROVENANCE_CLASS_MISSING");
    expect(provenanceRefusals(key, officer.roles).data).toEqual([]);
  });

  it("never lets a recorded class override the one the caller states", () => {
    const key = signIn(PEOPLE.operations);
    const answer = resolved(key, [{ valueRef: "measured/venue-114", provenanceClass: "estimated" }, { valueRef: "fee/2026-Q3/hn", provenanceClass: "authoritative" }]);
    expect(answer.provenanceClass).toBe("estimated");
    expect(answer.inputs.find((input) => input.valueRef === "measured/venue-114")).toMatchObject({ provenanceClass: "estimated", stated: true, recordedAt: null });
  });

  it("reads each recorded class as it stood at as_of, so a class recorded later does not reach an earlier instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const key = signIn(PEOPLE.operations);
    const before = "2026-09-15T12:00:00+07:00";
    // The seed's classes were recorded on 30 September; on 15 September the measurement had none.
    expect(resolveProvenance(key, officer, { inputs: [{ valueRef: "measured/venue-114" }], asOf: before, withClass: true }).data?.refusal).toMatchObject({
      code: "PROVENANCE_CLASS_MISSING",
      input: "measured/venue-114",
    });
    expect(recordProvenanceClass(key, officer, "premises/114/floor_area_m2", "declared").data).toEqual({ recorded: "declared" });
    expect(resolveProvenance(key, officer, { inputs: [{ valueRef: "premises/114/floor_area_m2" }], asOf: "2026-10-16T08:59:00+07:00", withClass: true }).data?.refusal?.code).toBe(
      "PROVENANCE_CLASS_MISSING",
    );
    expect(resolved(key, [{ valueRef: "premises/114/floor_area_m2" }, { valueRef: "measured/venue-114" }]).provenanceClass).toBe("declared");
  });

  it("refuses a request with no instant or no inputs with FIELD_MISSING, since as_of is never defaulted", () => {
    const key = signIn(PEOPLE.operations);
    expect(resolveProvenance(key, officer, { inputs: [{ valueRef: "measured/venue-114" }], asOf: null, withClass: true }).data?.refusal).toMatchObject({ code: "FIELD_MISSING", input: "as_of" });
    expect(resolveProvenance(key, officer, { inputs: [], asOf: NOW, withClass: true }).data?.refusal).toMatchObject({ code: "FIELD_MISSING", input: "input_value_refs" });
  });

  it("is refused to a member of staff who is not the data governance owner", () => {
    const key = signIn(PEOPLE.preparer);
    expect(resolveProvenance(key, actorOf(PEOPLE.preparer), { inputs: [{ valueRef: "measured/venue-114" }], asOf: NOW, withClass: true }).failure?.code).toBe("NOT_AUTHORISED");
  });

  it("shows the refused attempts to the auditor beside, and to nobody without the role", () => {
    const key = signIn(PEOPLE.operations);
    resolveProvenance(key, officer, { inputs: [{ valueRef: "measured/venue-114" }], asOf: NOW, withClass: false });
    const auditor = signInBeside(key, PEOPLE.supervisor);
    expect(provenanceRefusals(auditor, actorOf(PEOPLE.supervisor).roles).data).toHaveLength(1);
    expect(provenanceRefusals(key, actorOf(PEOPLE.preparer).roles).failure?.code).toBe("NOT_AUTHORISED");
  });
});

describe("SCR-DAT-04's lookup", () => {
  it("resolves the ward's third-quarter use from its inputs as imputed, decided by the area weighting", () => {
    const key = signIn(PEOPLE.operations);
    const lookup = lookUpProvenance(key, officer, "ward-usage/2026-Q3/ben-thanh", NOW, true).data?.lookup;
    expect(lookup).toMatchObject({ provenanceClass: "imputed", decidedBy: { kind: "INPUT", input: "area-weighting/ben-thanh", reason: "WEAKEST_INPUT_IMPUTED" }, missing: null });
    expect(lookup?.inputs?.map((input) => [input.input, input.venues])).toEqual([
      ["measured/venue-114", 1],
      ["area-weighting/ben-thanh", 9],
    ]);
  });

  it("refuses a figure's link that asks for the value alone, and records it, for a stored value as for a derived one", () => {
    const key = signIn(PEOPLE.operations);
    expect(lookUpProvenance(key, officer, "ward-usage/2026-Q3/ben-thanh", NOW, false).data).toMatchObject({ lookup: null, omitted: { by: "Phan Gia Lượng" } });
    expect(lookUpProvenance(key, officer, "measured/venue-114", NOW, false).data).toMatchObject({ lookup: null, omitted: { by: "Phan Gia Lượng" } });
    expect((provenanceRefusals(key, officer.roles).data ?? []).map((row) => row.valueRefs)).toEqual([["measured/venue-114"], ["measured/venue-114", "area-weighting/ben-thanh"]]);
  });

  it("names the stored value itself as missing its class, and reads it once one is recorded", () => {
    const key = signIn(PEOPLE.operations);
    expect(lookUpProvenance(key, officer, "premises/114/floor_area_m2", new Date().toISOString(), true).data?.lookup).toMatchObject({ provenanceClass: null, missing: "premises/114/floor_area_m2" });
    recordProvenanceClass(key, officer, "premises/114/floor_area_m2", "declared");
    expect(lookUpProvenance(key, officer, "premises/114/floor_area_m2", new Date().toISOString(), true).data?.lookup).toMatchObject({
      provenanceClass: "declared",
      decidedBy: { kind: "RECORD", recordedBy: "Phan Gia Lượng" },
    });
  });
});

describe("SCR-DAT-04's export", () => {
  it("@AC-FR-DAT-026-04 exports the ward's figure and its inputs, every value with its class in a column of its own", () => {
    const key = signIn(PEOPLE.operations);
    const exported = exportProvenance(key, officer, "ward-usage/2026-Q3/ben-thanh", NOW).data;
    expect(exported?.rows.map((row) => [row.valueRef, row.role, row.provenanceClass, row.decidedBy, row.venues])).toEqual([
      ["ward-usage/2026-Q3/ben-thanh", "FIGURE", "imputed", "area-weighting/ben-thanh", null],
      ["measured/venue-114", "INPUT", "authoritative", null, 1],
      ["area-weighting/ben-thanh", "INPUT", "imputed", null, 9],
    ]);
    expect(exported?.asOf).toBe(NOW);
  });

  it("exports nothing for a value with no class at the instant asked, refusing PROVENANCE_CLASS_MISSING", () => {
    const key = signIn(PEOPLE.operations);
    expect(exportProvenance(key, officer, "premises/114/floor_area_m2", NOW)).toEqual({ data: null, failure: { code: "PROVENANCE_CLASS_MISSING", traceId: null, retryable: false } });
    // On 15 September the ward's inputs had no class yet, so neither had the figure.
    expect(exportProvenance(key, officer, "ward-usage/2026-Q3/ben-thanh", "2026-09-15T23:59:59.999+07:00").failure?.code).toBe("PROVENANCE_CLASS_MISSING");
  });

  it("is refused to a member of staff who is not the data governance owner", () => {
    const key = signIn(PEOPLE.preparer);
    expect(exportProvenance(key, actorOf(PEOPLE.preparer), "ward-usage/2026-Q3/ben-thanh", NOW).failure?.code).toBe("NOT_AUTHORISED");
  });
});
