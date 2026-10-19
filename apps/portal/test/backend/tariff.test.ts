import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalculationInput, TariffLayer } from "@/lib/api/tariff";
import type { Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import { indicateAmount } from "@/lib/mock/backend/public";
import {
  addEvidenceItem,
  attestationStep,
  attestAndSubmit,
  decisionList,
  declareFacts,
  previewApplication,
  startApplication,
} from "@/lib/mock/backend/registration";
import { sessions } from "@/lib/mock/backend/store";
import {
  calculateFee,
  calculation,
  changeEffectiveOn,
  changeReportPeriodAt,
  declaredClassifications,
  feeCalculation,
  mandateScopeChanges,
  reconcileDeclaredClassifications,
  recordMandateStateChange,
  reproduce,
  reviewFeeCalculation,
  type FeeAnswer,
  type FeeClaim,
  type FeeQuestion,
} from "@/lib/mock/backend/tariff";
import { PEOPLE, signIn, signInBeside } from "./harness";
import type * as noticesModule from "@/lib/mock/backend/notices";

/*
 * TAR's calculator and the reads built on it, called as REG and the consoles call them. The tariff is TV-2026.1 as the
 * public pages state it: the base amount, shares, premises-class factors and floor-area bands of TAR's fixture TC-T1,
 * Hồ Chí Minh City in locality class 1 (factor 1.2), a cap of 12,000,000 VND, rounding down to 1,000 VND and the
 * micro-business exemption at 30 m² or less and 20 seats or fewer. A café of 85 m² in the city therefore comes to the
 * fixture's own 4,554,000 VND, which is why several acceptance criteria are proved here with their own figures.
 */

vi.setConfig({ testTimeout: 30_000 });

/* COM's notices, which REG raises on the way, are answered here with a reference of their own: they are not tested. */
vi.mock("@/lib/mock/backend/notices", async (importOriginal) => {
  const actual = await importOriginal<typeof noticesModule>();
  return { ...actual, recordNoticeEvent: vi.fn((_key: string, event: { occurrenceRef: string }) => `COM-TEST-${event.occurrenceRef}`) };
});

const HCM = "Phường Sài Gòn, TP. Hồ Chí Minh";

function staffOf(sessionId: string): Staff {
  const account = findAccount(sessions().get(sessionId)?.email ?? "");
  if (account === null) throw new Error(`no staff session ${sessionId}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

/** A question about a premises of the world: a register area in the city, the class and the area given. */
function question(more: Partial<FeeQuestion> & { inputs?: CalculationInput[] } = {}): FeeQuestion {
  return {
    application: "REG-TEST000001",
    premisesId: "nh",
    decisionDate: "2027-04-01",
    obligationPeriod: { from: "2027-04-01", to: "2028-03-31" },
    inputs: [
      { fact: "admin_area", value: HCM, source: "register" },
      { fact: "premises_class", value: "cafe", source: "register" },
      { fact: "customer_area", value: 85, source: "declared" },
    ],
    claims: [],
    ...more,
  };
}

function calculated(answer: FeeAnswer) {
  if (answer.outcome !== "CALCULATED") throw new Error(`expected a calculation, got ${answer.outcome}`);
  return answer.calculation;
}

const component = (answer: FeeAnswer, layer: TariffLayer) => calculated(answer).components.find((entry) => entry.layer === layer);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T10:00:00+07:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the calculator (ALG-295, ALG-296)", () => {
  it("@AC-FR-TAR-006-02 records each component's share and every factor applied, and the amount they come to", () => {
    const key = signIn(PEOPLE.principal);
    const calc = calculated(calculateFee(key, question()));
    expect(calc.version).toBe("TV-2026.1");
    expect(calc.classification).toEqual({ locality: { class: 1, basis: "AUTHORITATIVE" }, premisesClass: { class: "cafe", basis: "AUTHORITATIVE" }, scope: "IN_SCOPE" });
    const works = calc.components.find((entry) => entry.layer === "AUTHORS");
    expect(works).toMatchObject({ shareHundredths: 50, amountMinor: 2_277_000, treatment: "CHARGED" });
    expect(works?.factors).toEqual([
      { kind: "LOCALITY", key: "LC-1", factorHundredths: 120 },
      { kind: "PREMISES_CLASS", key: "PC-CAFE", factorHundredths: 100 },
      { kind: "SIZE_BAND", key: "50-200", factorHundredths: 150 },
    ]);
    expect(calc.components.filter((entry) => entry.layer !== "AUTHORS").map((entry) => [entry.shareHundredths, entry.amountMinor])).toEqual([
      [25, 1_138_500],
      [25, 1_138_500],
    ]);
    expect(calc.amountMinor).toBe(4_554_000);
    expect(calc.transitionRule).toBe("FROM_NEXT_MONTH");
    expect(calc.baseAmountMinor).toBe(2_530_000);
    expect(calc.instrument).toBe("07/2026");
  });

  it("@AC-FR-TAR-021-02 leaves an amount already on the rounding unit unchanged, and shows the rule and its unit", () => {
    const key = signIn(PEOPLE.principal);
    const calc = calculated(calculateFee(key, question()));
    expect(calc.rounding).toEqual({ rule: "DOWN_TO_UNIT", unitMinor: 1_000, beforeMinor: 4_554_000 });
    expect(calc.amountMinor).toBe(4_554_000);
    expect(calc.components.every((entry) => entry.treatment === "CHARGED" && entry.reason === "CHARGED")).toBe(true);
  });

  it("reduces a sum above the cap to the cap, pro rata, and rounds the capped amount (DR-323)", () => {
    const key = signIn(PEOPLE.principal);
    const calc = calculated(
      calculateFee(key, question({ inputs: [{ fact: "admin_area", value: HCM, source: "register" }, { fact: "premises_class", value: "bar", source: "register" }, { fact: "customer_area", value: 250, source: "declared" }] })),
    );
    expect(calc.amountBeforeCapMinor).toBe(15_180_000);
    expect(calc.cap).toEqual({ capMinor: 12_000_000, applied: true });
    expect(calc.components.map((entry) => [entry.layer, entry.amountBeforeCapMinor, entry.amountMinor])).toEqual([
      ["PERFORMERS", 3_795_000, 3_000_000],
      ["PRODUCERS", 3_795_000, 3_000_000],
      ["AUTHORS", 7_590_000, 6_000_000],
    ]);
    expect(calc.rounding.beforeMinor).toBe(12_000_000);
    expect(calc.amountMinor).toBe(12_000_000);
  });

  it("rounds down to the unit and lets the largest charged component carry the difference, so the components sum to the amount", () => {
    const key = signIn(PEOPLE.principal);
    const calc = calculated(
      calculateFee(key, question({ inputs: [{ fact: "admin_area", value: HCM, source: "register" }, { fact: "premises_class", value: "shop", source: "register" }, { fact: "customer_area", value: 30, source: "declared" }] })),
    );
    expect(calc.rounding.beforeMinor).toBe(1_851_960);
    expect(calc.amountMinor).toBe(1_851_000);
    expect(calc.components.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(1_851_000);
    // The seating capacity is not in REG's facts, so the micro-business exemption is tested and not applied.
    expect(calc.exemptions[0]).toEqual({
      code: "MICRO_BUSINESS",
      applied: false,
      criteria: [
        { criterion: "MB-1", fact: "FLOOR_AREA_M2", atMost: 30, value: 30, met: true },
        { criterion: "MB-2", fact: "SEATING_CAPACITY", atMost: 20, value: null, met: false },
      ],
    });
  });

  it("@AC-FR-TAR-020-01 exempts every component under MICRO_BUSINESS when each criterion is met, showing each, and the amount is 0", () => {
    const key = signIn(PEOPLE.principal);
    const answer = calculateFee(
      key,
      question({
        inputs: [
          { fact: "admin_area", value: HCM, source: "register" },
          { fact: "premises_class", value: "shop", source: "register" },
          { fact: "customer_area", value: 30, source: "declared" },
          { fact: "seating_capacity", value: 12, source: "declared" },
        ],
      }),
    );
    const calc = calculated(answer);
    expect(calc.exemptions[0]?.applied).toBe(true);
    expect(calc.exemptions[0]?.criteria.map((criterion) => [criterion.criterion, criterion.value, criterion.met])).toEqual([
      ["MB-1", 30, true],
      ["MB-2", 12, true],
    ]);
    expect(calc.components.every((entry) => entry.treatment === "EXEMPT" && entry.authority === "MICRO_BUSINESS" && entry.reason === "EXEMPTION_MET" && entry.amountMinor === 0)).toBe(true);
    expect(calc.amountMinor).toBe(0);
  });

  it("puts a premises whose register class the tariff does not list out of scope, with no component", () => {
    const key = signIn(PEOPLE.principal);
    const calc = calculated(
      calculateFee(key, question({ inputs: [{ fact: "admin_area", value: HCM, source: "register" }, { fact: "premises_class", value: "karaoke", source: "register" }, { fact: "customer_area", value: 85, source: "declared" }] })),
    );
    expect(calc.classification.scope).toBe("OUT_OF_SCOPE");
    expect(calc.components).toEqual([]);
    expect(calc.amountMinor).toBeNull();
  });

  it("@AC-FR-TAR-012-06 leaves a declared class the tariff does not list indeterminate, never out of scope, with no watch and no component", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    const calc = calculated(
      calculateFee(key, question({ premisesId: "pxl", inputs: [{ fact: "admin_area", value: HCM, source: "register" }, { fact: "premises_class", value: "restaurant", source: "declared" }, { fact: "customer_area", value: 85, source: "declared" }] })),
    );
    expect(calc.classification.scope).toBe("INDETERMINATE");
    expect(calc.components).toEqual([]);
    expect(declaredClassifications(key, operations, { status: null, premises: "pxl" }, null).data?.rows).toEqual([]);
  });

  it("@AC-FR-TAR-012-01 calculates on a class the premises declared, on the basis DECLARED, and opens a watch", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    // Sala has no decision in force, so the sweep the list runs first keeps the watch open (DR-328 row 3).
    const calc = calculated(calculateFee(key, question({ premisesId: "sala", inputs: [{ fact: "admin_area", value: HCM, source: "register" }, { fact: "premises_class", value: "cafe", source: "declared" }, { fact: "customer_area", value: 85, source: "declared" }] })));
    expect(calc.amountMinor).toBe(4_554_000);
    expect(calc.classification.premisesClass).toEqual({ class: "cafe", basis: "DECLARED" });
    const rows = declaredClassifications(key, operations, { status: null, premises: "sala" }, null).data?.rows ?? [];
    expect(rows.map((row) => [row.kind, row.declared, row.status, row.firstCalculation])).toEqual([["PREMISES_CLASS", "cafe", "WATCHING", calc.reference]]);
  });

  it("@AC-FR-TAR-012-04 opens no second watch for a second calculation on the same declared class", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    const declared: CalculationInput[] = [{ fact: "admin_area", value: HCM, source: "register" }, { fact: "premises_class", value: "cafe", source: "declared" }, { fact: "customer_area", value: 85, source: "declared" }];
    const first = calculated(calculateFee(key, question({ premisesId: "sala", inputs: declared })));
    calculated(calculateFee(key, question({ premisesId: "sala", inputs: declared, decisionDate: "2027-05-01", obligationPeriod: { from: "2027-05-01", to: "2028-03-31" } })));
    const rows = declaredClassifications(key, operations, { status: null, premises: "sala" }, null).data?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.firstCalculation).toBe(first.reference);
  });

  it("@AC-FR-TAR-010-02 charges a partly accepted claim's layer for the days not accepted, naming the claim", () => {
    const key = signIn(PEOPLE.principal);
    const claim: FeeClaim = { ref: "ASR-02", layer: "PERFORMERS", period: { from: "2027-10-01", to: "2028-03-31" }, state: "PARTLY_ACCEPTED", accepted: { from: "2027-10-01", to: "2028-03-31" } };
    const answer = calculateFee(key, question({ claims: [claim] }));
    expect(component(answer, "PERFORMERS")).toMatchObject({ treatment: "REDUCED_CLAIM_ACCEPTED", amountBeforeCapMinor: 569_250, authority: "ASR-02", reason: "CLAIM_PARTLY_ACCEPTED" });
    expect(calculated(answer).amountMinor).toBe(3_984_000);
  });

  it("@AC-FR-TAR-010-01 removes a component whose claim is accepted for the whole period, naming the claim, and charges the rest", () => {
    const key = signIn(PEOPLE.principal);
    const claim: FeeClaim = { ref: "ASR-01", layer: "PRODUCERS", period: { from: "2027-04-01", to: "2028-03-31" }, state: "ACCEPTED", accepted: null };
    const answer = calculateFee(key, question({ claims: [claim] }));
    expect(component(answer, "PRODUCERS")).toMatchObject({ treatment: "EXCLUDED_CLAIM_ACCEPTED", amountMinor: 0, authority: "ASR-01", reason: "CLAIM_ACCEPTED" });
    expect(component(answer, "AUTHORS")).toMatchObject({ treatment: "CHARGED", amountBeforeCapMinor: 2_277_000 });
    expect(component(answer, "PERFORMERS")).toMatchObject({ treatment: "CHARGED", amountBeforeCapMinor: 1_138_500 });
    expect(calculated(answer).rounding.beforeMinor).toBe(3_415_500);
    expect(calculated(answer).amountMinor).toBe(3_415_000);
  });

  it("@AC-FR-TAR-010-04 charges half a component whose claim is accepted for the second half of the period", () => {
    const key = signIn(PEOPLE.principal);
    const claim: FeeClaim = { ref: "ASR-03", layer: "PRODUCERS", period: { from: "2027-10-01", to: "2028-03-31" }, state: "ACCEPTED", accepted: null };
    const answer = calculateFee(key, question({ claims: [claim] }));
    expect(component(answer, "PRODUCERS")).toMatchObject({ treatment: "REDUCED_CLAIM_ACCEPTED", amountMinor: 569_250, authority: "ASR-03", reason: "CLAIM_PARTLY_ACCEPTED" });
    expect(calculated(answer).amountMinor).toBe(3_984_000);
  });

  it("@AC-FR-TAR-009-03 never excludes a component whose claim was not accepted: charged in full, with no authority", () => {
    const key = signIn(PEOPLE.principal);
    const claim: FeeClaim = { ref: "ASR-01", layer: "PRODUCERS", period: { from: "2027-04-01", to: "2028-03-31" }, state: "NOT_ACCEPTED", accepted: null };
    const answer = calculateFee(key, question({ claims: [claim] }));
    expect(component(answer, "PRODUCERS")).toMatchObject({ treatment: "CHARGED", amountMinor: 1_138_500, authority: null, reason: "CLAIM_NOT_ACCEPTED", claimPending: false });
    expect(calculated(answer).amountMinor).toBe(4_554_000);
  });

  it("@AC-FR-TAR-009-01 charges a layer in full while its claim is reviewed, as if there were no claim, and marks it pending", () => {
    const key = signIn(PEOPLE.principal);
    const claim: FeeClaim = { ref: "ASR-01", layer: "PRODUCERS", period: { from: "2027-04-01", to: "2028-03-31" }, state: "UNDER_REVIEW", accepted: null };
    const answer = calculateFee(key, question({ claims: [claim] }));
    expect(component(answer, "PRODUCERS")).toMatchObject({ treatment: "CHARGED", claimPending: true, amountMinor: 1_138_500, reason: "CLAIM_NOT_ACCEPTED" });
    expect(calculated(answer).amountMinor).toBe(4_554_000);
  });

  it("answers no approved version for a date before any tariff was approved, and records nothing", () => {
    const key = signIn(PEOPLE.principal);
    expect(calculateFee(key, question({ decisionDate: "2026-02-01", obligationPeriod: { from: "2026-02-01", to: "2027-01-31" } }))).toEqual({ outcome: "NO_APPROVED_VERSION", reason: "NO_EFFECTIVE_VERSION" });
    // TV-2026.0 is approved, but the canvas writes none of its content: the calculator cannot use it.
    expect(calculateFee(key, question({ decisionDate: "2026-04-01", obligationPeriod: { from: "2026-04-01", to: "2027-03-31" } }))).toEqual({ outcome: "NO_APPROVED_VERSION", reason: "CONTENT_MISSING" });
  });

  it("gives the public indicative amount the same figures for the same facts, under the same content", () => {
    const key = signIn(PEOPLE.principal);
    const facts = { assessmentDate: "2026-10-16", premisesClass: "bar", adminArea: "hcm", floorAreaM2: "120", seats: "30" };
    const indicated = indicateAmount(facts).answer.data;
    if (indicated === null || indicated.outcome !== "indicated") throw new Error("PUB indicates an amount for a bar in the city");
    const ours = calculated(
      calculateFee(
        key,
        question({
          decisionDate: "2026-10-16",
          obligationPeriod: null,
          inputs: [
            { fact: "admin_area", value: "hcm", source: "declared" },
            { fact: "premises_class", value: "bar", source: "declared" },
            { fact: "customer_area", value: 120, source: "declared" },
            { fact: "seating_capacity", value: 30, source: "declared" },
          ],
        }),
      ),
    );
    expect(ours.amountMinor).toBe(indicated.amountMinor);
    expect(ours.amountBeforeCapMinor).toBe(indicated.amountBeforeCapMinor);
    expect(ours.rounding.beforeMinor).toBe(indicated.amountBeforeRoundingMinor);
    expect(ours.exemptions[0]?.criteria.map((criterion) => [criterion.fact, criterion.atMost, criterion.value, criterion.met])).toEqual(
      indicated.exemptions[0]?.criteria.map((criterion) => [criterion.fact, criterion.atMost, criterion.value, criterion.met]),
    );
  });
});

describe("a stopped mandate (ALG-301, DR-322 row 1)", () => {
  const withdrawn = { eventId: "GEV-01", organisation: "dayan", newState: "WITHDRAWN" as const, effectiveAt: "2027-05-01T00:00:00+07:00", rights: ["producers"] };

  it("@AC-FR-TAR-017-01 excludes the component of a calculation dated after the stop, naming the mandate event", () => {
    const key = signIn(PEOPLE.principal);
    recordMandateStateChange(key, withdrawn);
    const answer = calculateFee(key, question({ decisionDate: "2027-05-02", obligationPeriod: { from: "2027-05-02", to: "2028-05-01" } }));
    expect(component(answer, "PRODUCERS")).toMatchObject({ treatment: "EXCLUDED_MANDATE_STOPPED", amountMinor: 0, authority: "GEV-01", reason: "MANDATE_STOPPED" });
    expect(calculated(answer).rounding.beforeMinor).toBe(3_415_500);
    expect(calculated(answer).amountMinor).toBe(3_415_000);
  });

  it("@AC-FR-TAR-017-03 still charges the component on the day before the stop", () => {
    const key = signIn(PEOPLE.principal);
    recordMandateStateChange(key, withdrawn);
    const answer = calculateFee(key, question({ decisionDate: "2027-04-30", obligationPeriod: { from: "2027-04-30", to: "2028-04-29" } }));
    expect(component(answer, "PRODUCERS")).toMatchObject({ treatment: "CHARGED", amountMinor: 1_138_500, reason: "CHARGED" });
    expect(calculated(answer).amountMinor).toBe(4_554_000);
  });

  it("records a restoration against the stop, which charges the component again from its date and lists the stop as restored", () => {
    const key = signIn(PEOPLE.principal);
    const policy = staffOf(signInBeside(key, PEOPLE.preparer));
    recordMandateStateChange(key, withdrawn);
    const restored = recordMandateStateChange(key, { ...withdrawn, eventId: "GEV-02", newState: "EFFECTIVE", effectiveAt: "2027-08-01T00:00:00+07:00" });
    expect("recorded" in restored && restored.recorded).toMatchObject({ change: "RESTORED", components: ["PRODUCERS"], reason: "SCOPE_RESTORED" });
    const answer = calculateFee(key, question({ decisionDate: "2027-08-01", obligationPeriod: { from: "2027-08-01", to: "2028-07-31" } }));
    expect(component(answer, "PRODUCERS")).toMatchObject({ treatment: "CHARGED", amountMinor: 1_138_500 });
    const rows = mandateScopeChanges(key, policy, { change: null, from: "2027-01-01", to: "2027-12-31" }, null).data?.rows ?? [];
    expect(rows.find((row) => row.key === "GEV-01")?.restoredOn).toBe("2027-08-01");
  });

  it("@AC-FR-TAR-018-04 records a mandate's first effect, with no stop before it, as NONE, publishing nothing", () => {
    const key = signIn(PEOPLE.principal);
    const first = recordMandateStateChange(key, { eventId: "GEV-04", organisation: "dayan", newState: "EFFECTIVE", effectiveAt: "2027-01-01T00:00:00+07:00", rights: ["performing"] });
    expect("recorded" in first && first.recorded).toMatchObject({ change: "NONE", reason: "FIRST_EFFECT", components: [] });
    // Nothing stopped, so a calculation on the day charges every component.
    const answer = calculateFee(key, question({ decisionDate: "2027-01-01", obligationPeriod: { from: "2027-01-01", to: "2027-12-31" } }));
    expect(calculated(answer).components.every((entry) => entry.treatment === "CHARGED")).toBe(true);
  });

  it("records a mandate event delivered twice once, and a mandate covering no component as NONE", () => {
    const key = signIn(PEOPLE.principal);
    recordMandateStateChange(key, withdrawn);
    expect(recordMandateStateChange(key, withdrawn)).toEqual({ duplicate: true });
    const none = recordMandateStateChange(key, { ...withdrawn, eventId: "GEV-03", rights: ["av"] });
    expect("recorded" in none && none.recorded).toMatchObject({ change: "NONE", reason: "NO_COMPONENT_AFFECTED", components: [] });
  });
});

describe("reproduction (ALG-299)", () => {
  it("recomputes a recorded calculation from what it recorded, so a later mandate stop does not change it: MATCH", () => {
    const key = signIn(PEOPLE.principal);
    const finance = staffOf(signInBeside(key, PEOPLE.operations));
    const original = calculated(calculateFee(key, question({ decisionDate: "2027-05-02", obligationPeriod: { from: "2027-05-02", to: "2028-05-01" } })));
    vi.setSystemTime(new Date("2026-10-17T10:00:00+07:00"));
    // A stop GOV reports after the calculation was made, effective before its decision date.
    recordMandateStateChange(key, { eventId: "GEV-09", organisation: "dayan", newState: "WITHDRAWN", effectiveAt: "2027-05-01T00:00:00+07:00", rights: ["producers"] });
    const made = reproduce(key, finance, original.reference).data;
    expect(made).not.toBeNull();
    const page = calculation(key, finance, original.reference).data;
    expect(page?.reproductions.map((entry) => [entry.outcome, entry.differences.length])).toEqual([["MATCH", 0]]);
  });

  it("@AC-FR-TAR-007-04 refuses a reproduction to a premises principal, and records none", () => {
    const key = signIn(PEOPLE.principal);
    const original = calculated(calculateFee(key, question()));
    expect(reproduce(key, { roles: [] }, original.reference).failure?.code).toBe("NOT_AUTHORISED");
    expect(calculation(key, staffOf(signInBeside(key, PEOPLE.operations)), original.reference).data?.reproductions).toEqual([]);
  });

  it("answers CALCULATION_NOT_FOUND for a reproduction, which is not a production to reproduce", () => {
    const key = signIn(PEOPLE.principal);
    const finance = staffOf(signInBeside(key, PEOPLE.operations));
    const original = calculated(calculateFee(key, question()));
    const first = reproduce(key, finance, original.reference).data?.reproduction ?? "";
    expect(reproduce(key, finance, first).failure?.code).toBe("CALCULATION_NOT_FOUND");
  });
});

describe("a reported change (ALG-302) and its period (CFG-360)", () => {
  it("@AC-FR-TAR-016-01 takes a change from the first day of the next month, never from the day it was reported", () => {
    expect(changeEffectiveOn({ changeOccurredOn: "2027-03-12", reportedOn: "2027-04-20", periodEndsOn: null })).toEqual({
      outcome: "EFFECTIVE_ON",
      effectiveOn: "2027-04-01",
      transitionRule: "FROM_NEXT_MONTH",
      reportedWithinPeriod: false,
      periodDays: 30,
    });
  });

  it("holds a report inside the thirty days the default period gives, counted from the day after the change", () => {
    const answer = changeEffectiveOn({ changeOccurredOn: "2027-04-12", reportedOn: "2027-05-12", periodEndsOn: null });
    expect(answer).toMatchObject({ effectiveOn: "2027-05-01", reportedWithinPeriod: true });
    expect(changeEffectiveOn({ changeOccurredOn: "2027-04-12", reportedOn: "2027-05-13", periodEndsOn: null })).toMatchObject({ reportedWithinPeriod: false });
  });

  it("@AC-FR-TAR-016-04 refuses an effective date for a change that occurred when no version was in force", () => {
    expect(changeEffectiveOn({ changeOccurredOn: "2026-02-20", reportedOn: "2026-03-05", periodEndsOn: null })).toEqual({ outcome: "NO_APPROVED_VERSION" });
  });

  it("refuses a report dated before the change", () => {
    expect(changeEffectiveOn({ changeOccurredOn: "2027-03-12", reportedOn: "2027-03-11", periodEndsOn: null })).toEqual({ outcome: "CALCULATION_INPUT_INVALID" });
  });

  it("quotes the thirty-day default while no change-report period version is approved", () => {
    expect(changeReportPeriodAt("2027-04-01")).toEqual({ days: 30, version: null });
  });
});

/**
 * A renewal of Nguyễn Huệ's decision on a declared class, sent and decided at submission (DR-285 row 5): the decision
 * rests on the declaration. Its reference.
 */
function decidedOnDeclaredClass(key: string): string {
  const ref = startApplication(key, { premisesId: "nh", kind: "RENEWAL", prior: "OBD-8KWT2PZH6M", cause: null, from: "2027-09-24", to: "2028-09-22" }).accepted?.application ?? "";
  expect(declareFacts(key, ref, { values: { premises_class: "cafe", customer_area: "64", days_open: "7", music_method: "speakers", use_began_on: "2026-09-01" }, reconfirmed: [] }).refusal).toBeNull();
  for (const item of ["USE_START_PROOF", "LEASE"]) addEvidenceItem(key, ref, `rules:${item}`, { name: `${item}.pdf`, type: "application/pdf", sizeBytes: 1000 });
  expect(previewApplication(key, ref).data?.outcome).toEqual({ kind: "PAYABLE" });
  const shown = attestationStep(key, "Công ty TNHH Then Cửa Việt", ref).data?.shown ?? null;
  if (shown === null) throw new Error(`no review recorded for ${ref}`);
  expect(attestAndSubmit(key, ref, { presentation: shown.presentation, factsDigest: shown.factsDigest, confirmed: true, changeDutyAcknowledged: true }).accepted?.status).toBe("DECIDED");
  const decided = decisionList(key, "nh").data?.items.find((item) => item.period.from === "2027-09-24");
  if (decided === undefined) throw new Error("the renewal was decided");
  return decided.reference;
}

describe("the reconciliation sweep (ALG-300) and the premises' read (SCR-TAR-14)", () => {
  it("@AC-FR-TAR-013-01 resolves a watch the register now answers the same, with no amendment of the decision", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    decidedOnDeclaredClass(key);
    vi.setSystemTime(new Date("2027-10-02T02:00:00+07:00"));
    reconcileDeclaredClassifications(key, () => "cafe");
    const row = declaredClassifications(key, operations, { status: null, premises: "nh" }, null).data?.rows[0];
    expect(row).toMatchObject({ status: "RESOLVED_SAME", reason: "SAME_AS_DECLARED", resolvedClass: "cafe", resolvedDecision: null });
  });

  it("resolves a watch the register answers differently, naming the decision in force for REG to amend", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    const decision = decidedOnDeclaredClass(key);
    vi.setSystemTime(new Date("2027-10-02T02:00:00+07:00"));
    reconcileDeclaredClassifications(key, () => "bar");
    const row = declaredClassifications(key, operations, { status: null, premises: "nh" }, null).data?.rows[0];
    expect(row).toMatchObject({ status: "RESOLVED_DIFFERENT", reason: "DIFFERENT_FROM_DECLARED", resolvedClass: "bar", resolvedDecision: decision });
  });

  it("closes a watch when the decision in force does not rest on a declared class (DR-328 row 4)", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    // The renewal takes effect on 24 September 2027; until then the canvas's decision, on the register's facts, governs.
    decidedOnDeclaredClass(key);
    const row = declaredClassifications(key, operations, { status: null, premises: "nh" }, null).data?.rows[0];
    expect(row).toMatchObject({ status: "CLOSED", reason: "DECISION_NO_LONGER_DECLARED" });
    expect(row?.lastCheckedAt).not.toBeNull();
  });

  it("keeps a watch with no decision in force open, and closes it once ninety days pass with none", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    calculateFee(key, question({ premisesId: "sala", inputs: [{ fact: "admin_area", value: HCM, source: "register" }, { fact: "premises_class", value: "cafe", source: "declared" }, { fact: "customer_area", value: 85, source: "declared" }] }));
    expect(declaredClassifications(key, operations, { status: null, premises: "sala" }, null).data?.rows[0]).toMatchObject({ status: "WATCHING", reason: "STILL_UNRESOLVED" });
    vi.setSystemTime(new Date("2027-01-20T02:00:00+07:00"));
    expect(declaredClassifications(key, operations, { status: null, premises: "sala" }, null).data?.rows[0]).toMatchObject({ status: "CLOSED", reason: "NO_DECISION_IN_PERIOD" });
  });

  it("refuses the list of declared classifications to a member of staff with no tariff role", () => {
    const key = signIn(PEOPLE.principal);
    expect(declaredClassifications(key, staffOf(signInBeside(key, PEOPLE.approver)), { status: null, premises: null }, null).failure?.code).toBe("NOT_AUTHORISED");
    expect(declaredClassifications(key, staffOf(signInBeside(key, PEOPLE.supervisor)), { status: null, premises: null }, null).failure).toBeNull();
  });

  it("shows the premises the calculation its decision rests on, with shares and factors, and refuses one of a premises it does not act for", () => {
    const key = signIn(PEOPLE.principal);
    const decided = decidedOnDeclaredClass(key);
    const explained = feeCalculation(key, "", decided).data;
    expect(explained?.calculation.components.every((entry) => entry.shareHundredths !== null && entry.factors.length === 3)).toBe(true);
    expect(explained?.calculation.amountMinor).toBe(4_554_000);
    expect(explained?.calculation.answered).toEqual({ kind: "decision", reference: decided });
    const outsider = signInBeside(key, PEOPLE.cmo);
    expect(feeCalculation(outsider, "", decided).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });
});

/** A renewal the principal started, answered, documented and reviewed (SCR-REG-02 to 05): its reference and the review. */
function reviewed(key: string, start: { premisesId: string; prior: string; from: string; to: string }, premisesClass: string | null) {
  const ref = startApplication(key, { kind: "RENEWAL", cause: null, ...start }).accepted?.application ?? "";
  const values = { customer_area: "64", days_open: "7", music_method: "speakers", use_began_on: "2026-09-01", ...(premisesClass !== null ? { premises_class: premisesClass } : {}) };
  expect(declareFacts(key, ref, { values, reconfirmed: [] }).refusal).toBeNull();
  for (const item of ["USE_START_PROOF", "LEASE"]) addEvidenceItem(key, ref, `rules:${item}`, { name: `${item}.pdf`, type: "application/pdf", sizeBytes: 1000 });
  const review = previewApplication(key, ref).data;
  if (review?.calculation === undefined || review.calculation === null) throw new Error(`no calculation recorded for the review of ${ref}`);
  return { ref, review, calculation: review.calculation };
}

describe("SCR-TAR-14 for a delegate, and opened from the review (PERM-656, SEC-324)", () => {
  it("lets the delegate read the calculation of a decision of the premises her authority names, and refuses her every other", () => {
    const key = signIn(PEOPLE.principal);
    const delegate = signInBeside(key, PEOPLE.delegate);
    expect(feeCalculation(delegate, "", "OBD-8KWT2PZH6M").data?.calculation.premises.id).toBe("nh");
    expect(feeCalculation(key, "", "OBD-3FJW6NRA5C").failure).toBeNull();
    expect(feeCalculation(delegate, "", "OBD-3FJW6NRA5C").failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });

  it("refuses the revoked delegate the calculation of the premises she once acted for", () => {
    const key = signIn(PEOPLE.principal);
    expect(feeCalculation(signInBeside(key, PEOPLE.revokedDelegate), "", "OBD-8KWT2PZH6M").failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });

  it("shows the calculation a draft's review recorded, by its reference, with the amount the review showed", () => {
    const key = signIn(PEOPLE.principal);
    const { ref, review, calculation: reference } = reviewed(key, { premisesId: "pasteur", prior: "OBD-3FJW6NRA5C", from: "2027-09-18", to: "2028-09-16" }, null);
    const read = reviewFeeCalculation(key, ref, reference).data?.calculation;
    expect(read).toMatchObject({ reference, purpose: "PRODUCTION", answered: { kind: "review", application: ref }, amountMinor: review.fee?.totalMinor, instrument: "07/2026" });
    expect(read?.components.every((entry) => entry.shareHundredths !== null && entry.factors.length === 3)).toBe(true);
  });

  it("answers CALCULATION_NOT_FOUND for a reference no calculation of the application carries", () => {
    const key = signIn(PEOPLE.principal);
    const { ref, calculation } = reviewed(key, { premisesId: "pasteur", prior: "OBD-3FJW6NRA5C", from: "2027-09-18", to: "2028-09-16" }, null);
    expect(reviewFeeCalculation(key, ref, "TCL-N4VB7XQ3ZD").failure?.code).toBe("CALCULATION_NOT_FOUND");
    expect(reviewFeeCalculation(key, "REG-P5TJ4BXC7M", calculation).failure?.code).toBe("CALCULATION_NOT_FOUND");
  });

  it("refuses a premises actor a reproduction of the review's calculation: NOT_AUTHORISED", () => {
    const key = signIn(PEOPLE.principal);
    const finance = staffOf(signInBeside(key, PEOPLE.operations));
    const { ref, calculation } = reviewed(key, { premisesId: "pasteur", prior: "OBD-3FJW6NRA5C", from: "2027-09-18", to: "2028-09-16" }, null);
    const made = reproduce(key, finance, calculation).data?.reproduction ?? "";
    expect(reviewFeeCalculation(key, ref, made).failure?.code).toBe("NOT_AUTHORISED");
  });

  it("lets the delegate read the review of a draft of her premises, and refuses her the review of another premises", () => {
    const key = signIn(PEOPLE.principal);
    const delegate = signInBeside(key, PEOPLE.delegate);
    const own = reviewed(key, { premisesId: "nh", prior: "OBD-8KWT2PZH6M", from: "2027-09-24", to: "2028-09-22" }, "cafe");
    expect(reviewFeeCalculation(delegate, own.ref, own.calculation).data?.calculation.premises.id).toBe("nh");
    const other = reviewed(key, { premisesId: "pasteur", prior: "OBD-3FJW6NRA5C", from: "2027-09-18", to: "2028-09-16" }, null);
    expect(reviewFeeCalculation(delegate, other.ref, other.calculation).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });
});
