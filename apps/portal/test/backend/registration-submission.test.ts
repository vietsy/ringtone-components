import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationKind, FactQuestion } from "@/lib/api/registration";
import type { Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import {
  addEvidenceItem,
  applicationDraft,
  applicationRecord,
  attestAndSubmit,
  attestationStep,
  decisionList,
  decisionRecord,
  declareFacts,
  factsStep,
  previewApplication,
  proposalForm,
  recordClaimOutcome,
  recordCorrection,
  recordProposal,
  recordVerdict,
  registrationPolicy,
  restsOnDeclaredClassification,
  startApplication,
  withdrawApplication,
} from "@/lib/mock/backend/registration";
import { sessions } from "@/lib/mock/backend/store";
import { calculation, calculationsOf } from "@/lib/mock/backend/tariff";
import { PEOPLE, signIn, signInBeside } from "./harness";
import type * as noticesModule from "@/lib/mock/backend/notices";

/*
 * REG's submission path on TAR's calculator: the review works the fee out on the governing date, the submission
 * routes the application by DR-285 and, where the rules decide it, issues the decision at once; otherwise an officer
 * decides it on the console, on the calculator's fee too. Every walk starts where the principal starts, on SCR-REG-02,
 * on the canvas's 16 October 2026 unless a test moves the clock.
 */

vi.setConfig({ testTimeout: 60_000 });

/*
 * COM's notices are not what these walks test, and COM's first notice in a world dated months after the canvas
 * catches its own schedules up first, which takes seconds a walk does not need. REG raises them through the same
 * function; here it is answered with a reference of its own.
 */
vi.mock("@/lib/mock/backend/notices", async (importOriginal) => {
  const actual = await importOriginal<typeof noticesModule>();
  return { ...actual, recordNoticeEvent: vi.fn((_key: string, event: { occurrenceRef: string }) => `COM-TEST-${event.occurrenceRef}`) };
});

const PARTY = "Công ty TNHH Then Cửa Việt";
const FILE = { name: "giay-to.pdf", type: "application/pdf", sizeBytes: 120_000 };

function staffOf(sessionId: string): Staff {
  const account = findAccount(sessions().get(sessionId)?.email ?? "");
  if (account === null) throw new Error(`no staff session ${sessionId}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T10:00:00+07:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

interface Start {
  premisesId: string;
  kind: ApplicationKind;
  prior: string | null;
  cause?: string | null;
  from: string;
  to: string;
}

function start(key: string, input: Start): string {
  const answer = startApplication(key, { cause: null, ...input });
  if (answer.accepted === null) throw new Error(`start refused ${answer.refusal.code}`);
  return answer.accepted.application;
}

/** SCR-REG-03 and 04: every question the draft asks answered (a copied answer confirmed), every document added. */
function complete(key: string, ref: string, answers: Partial<Record<FactQuestion, string>>): void {
  const step = factsStep(key, ref).data;
  if (step === null) throw new Error(`no facts step for ${ref}`);
  const values: Partial<Record<FactQuestion, string>> = {};
  for (const question of step.questions) {
    const given = answers[question];
    if (given !== undefined) values[question] = given;
  }
  const reconfirmed = Object.keys(step.copied ?? {}) as FactQuestion[];
  const saved = declareFacts(key, ref, { values, reconfirmed });
  expect(saved.refusal).toBeNull();
  for (const item of ["USE_START_PROOF", "LEASE"]) addEvidenceItem(key, ref, `rules:${item}`, FILE);
}

/** SCR-REG-05 then 06: the review recorded, then confirmed and sent. */
function send(key: string, ref: string) {
  const review = previewApplication(key, ref).data;
  expect(review?.blocked).toBeNull();
  const shown = attestationStep(key, PARTY, ref).data?.shown ?? null;
  if (shown === null) throw new Error(`no review recorded for ${ref}`);
  return { review, sent: attestAndSubmit(key, ref, { presentation: shown.presentation, factsDigest: shown.factsDigest, confirmed: true, changeDutyAcknowledged: true }) };
}

const FACTS = { customer_area: "64", days_open: "7", music_method: "speakers", use_began_on: "2026-09-01" } as const;

describe("a submission the rules decide (DR-285 rows 5 and 6, DR-01 rows 3 to 5)", () => {
  it("decides a renewal on a declared class at submission, on TAR's calculation for the governing date", () => {
    const key = signIn(PEOPLE.principal);
    const ref = start(key, { premisesId: "nh", kind: "RENEWAL", prior: "OBD-8KWT2PZH6M", from: "2027-09-24", to: "2028-09-22" });
    complete(key, ref, { ...FACTS, premises_class: "cafe" });
    const { review, sent } = send(key, ref);
    expect(review?.outcome).toEqual({ kind: "PAYABLE" });
    expect(review?.fee?.totalMinor).toBe(4_554_000);
    expect(sent.accepted?.status).toBe("DECIDED");
    const decided = decisionList(key, "nh").data?.items.find((item) => item.period.from === "2027-09-24");
    const record = decisionRecord(key, decided?.reference ?? "").data;
    expect(record).toMatchObject({ outcome: "PAYABLE", basis: "TARIFF", route: "AUTOMATED", declaredClassification: true, tariffVersion: "TV-2026.1" });
    expect(record?.lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(4_554_000);
    expect(record?.calculation).toBe(review?.calculation);
    expect(restsOnDeclaredClassification(key, decided?.reference ?? "")).toBe(true);
  });

  it("resolves the rulebook by the governing date: 2026.2 for a period from 20 October 2026, 2026.3 for one from 1 November", () => {
    const key = signIn(PEOPLE.principal);
    // The Sala draft is withdrawn so a new registration can be started for the premises.
    expect(withdrawApplication(key, "REG-P5TJ4BXC7M").refusal).toBeNull();
    const october = start(key, { premisesId: "sala", kind: "NEW", prior: null, from: "2026-10-20", to: "2027-10-19" });
    complete(key, october, FACTS);
    expect(send(key, october).sent.accepted?.status).toBe("DECIDED");
    const first = decisionList(key, "sala").data?.items[0];
    expect(decisionRecord(key, first?.reference ?? "").data?.rulebookVersion).toBe("2026.2");
    const november = start(key, { premisesId: "sala", kind: "RENEWAL", prior: first?.reference ?? null, from: "2027-10-20", to: "2028-10-18" });
    complete(key, november, FACTS);
    expect(send(key, november).sent.accepted?.status).toBe("DECIDED");
    const second = decisionList(key, "sala").data?.items.find((item) => item.period.from === "2027-10-20");
    expect(decisionRecord(key, second?.reference ?? "").data?.rulebookVersion).toBe("2026.3");
  });

  it("@AC-FR-TAR-015-03 quotes the thirty-day change-report period in the explanation and holds the confirmation to it", () => {
    const key = signIn(PEOPLE.principal);
    const ref = start(key, { premisesId: "nh", kind: "RENEWAL", prior: "OBD-8KWT2PZH6M", from: "2027-09-24", to: "2028-09-22" });
    complete(key, ref, { ...FACTS, premises_class: "cafe" });
    expect(previewApplication(key, ref).data?.explanation).toEqual({ version: 3, published: true, changeReportDays: 30 });
    expect(attestationStep(key, PARTY, ref).data?.changeReportDays).toBe(30);
  });

  it("@AC-FR-TAR-015-04 refuses a confirmation without the change duty acknowledged, records no attestation and calculates no decision", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    const ref = start(key, { premisesId: "nh", kind: "RENEWAL", prior: "OBD-8KWT2PZH6M", from: "2027-09-24", to: "2028-09-22" });
    complete(key, ref, { ...FACTS, premises_class: "cafe" });
    expect(previewApplication(key, ref).data?.explanation.changeReportDays).toBe(30);
    const shown = attestationStep(key, PARTY, ref).data?.shown;
    const calculated = () => calculationsOf(key, operations, { premises: "nh", from: "2027-01-01", to: "2028-12-31" }).data?.rows ?? [];
    const before = calculated().length;
    const answer = attestAndSubmit(key, ref, { presentation: shown?.presentation ?? "", factsDigest: shown?.factsDigest ?? "", confirmed: true, changeDutyAcknowledged: false });
    expect(answer.refusal?.code).toBe("ATTESTATION_NOT_CONFIRMED");
    expect(applicationRecord(key, ref).data).toMatchObject({ status: "DRAFT" });
    expect(applicationRecord(key, ref).data?.history.some((entry) => entry.event === "CONFIRMED")).toBe(false);
    expect(calculated()).toHaveLength(before);
    expect(calculated().some((row) => row.answered.kind === "decision")).toBe(false);
  });

  it("refuses a confirmation made against a review that is no longer the latest, and records no decision", () => {
    const key = signIn(PEOPLE.principal);
    const ref = start(key, { premisesId: "nh", kind: "RENEWAL", prior: "OBD-8KWT2PZH6M", from: "2027-09-24", to: "2028-09-22" });
    complete(key, ref, { ...FACTS, premises_class: "cafe" });
    previewApplication(key, ref);
    const stale = attestationStep(key, PARTY, ref).data?.shown;
    previewApplication(key, ref);
    const answer = attestAndSubmit(key, ref, { presentation: stale?.presentation ?? "", factsDigest: stale?.factsDigest ?? "", confirmed: true, changeDutyAcknowledged: true });
    expect(answer.refusal?.code).toBe("EXPLANATION_SUPERSEDED");
    expect(decisionList(key, "nh").data?.items.some((item) => item.period.from === "2027-09-24")).toBe(false);
  });

  it("@AC-FR-TAR-014-02 works the fee of a reported change out on the changed fact, from the date the transition rule gives", () => {
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    // The customer area changed on 12 October; under TV-2026.1's FROM_NEXT_MONTH the change takes effect on 1 November.
    const ref = start(key, { premisesId: "ltt", kind: "AMENDMENT", prior: "OBD-2YDA7KMS5X", cause: "FACT_CHANGE_REPORTED", from: "2026-10-12", to: "2027-09-01" });
    expect(applicationDraft(key, ref).data?.period).toEqual({ from: "2026-11-01", to: "2027-09-01" });
    complete(key, ref, { ...FACTS, customer_area: "250", premises_class: "cafe" });
    const review = previewApplication(key, ref).data;
    expect(review?.fee?.totalMinor).toBe(7_590_000);
    const calc = calculation(key, operations, review?.calculation ?? "").data?.calculation;
    expect(calc?.decisionDate).toBe("2026-11-01");
    expect(calc?.inputs).toContainEqual({ fact: "customer_area", value: 250, source: "declared" });
    expect(calc?.components.find((entry) => entry.layer === "AUTHORS")?.factors).toContainEqual({ kind: "SIZE_BAND", key: "200-", factorHundredths: 250 });
    expect(send(key, ref).sent.accepted?.status).toBe("DECIDED");
    const amended = decisionList(key, "ltt").data?.items.find((item) => item.period.from === "2026-11-01");
    expect(amended).toMatchObject({ feeMinor: 7_590_000, replaces: "OBD-2YDA7KMS5X" });
  });
});

describe("the time before registration (DR-22) and the amnesty AMV-2026-1", () => {
  /** A first registration of Sala from the day given, music having begun on 1 December 2026. */
  function firstRegistration(day: string) {
    vi.setSystemTime(new Date(`${day}T10:00:00+07:00`));
    const key = signIn(PEOPLE.principal);
    expect(withdrawApplication(key, "REG-P5TJ4BXC7M").refusal).toBeNull();
    const ref = start(key, { premisesId: "sala", kind: "NEW", prior: null, from: day, to: `${String(Number(day.slice(0, 4)) + 1)}${day.slice(4)}` });
    complete(key, ref, { ...FACTS, use_began_on: "2026-12-01" });
    const { review, sent } = send(key, ref);
    const decided = decisionList(key, "sala").data?.items[0];
    return { review, sent, record: decisionRecord(key, decided?.reference ?? "").data };
  }

  it("@AC-FR-REG-020-01 raises nothing for the time before a first registration inside the amnesty, and records the amnesty version", () => {
    const { review, sent, record } = firstRegistration("2027-01-15");
    expect(review?.preRegistration).toEqual({ treatment: "AMNESTY_APPLIED", amnesty: { version: "AMV-2026-1", period: { from: "2027-01-01", to: "2027-06-30" } } });
    expect(sent.accepted?.status).toBe("DECIDED");
    expect(record?.preRegistration?.treatment).toBe("AMNESTY_APPLIED");
    expect(record?.preRegistration?.amnesty?.version).toBe("AMV-2026-1");
    expect(record?.period.from).toBe("2027-01-15");
  });

  it("@AC-FR-REG-020-02 still covers a first registration on the amnesty's last day", () => {
    expect(firstRegistration("2027-06-30").record?.preRegistration?.treatment).toBe("AMNESTY_APPLIED");
  });

  it("@AC-FR-REG-020-04 records no amnesty for a first registration the day after it ends, and raises nothing for the earlier time", () => {
    const { review, record } = firstRegistration("2027-07-01");
    expect(review?.preRegistration).toEqual({ treatment: "DEC13_NOT_EFFECTIVE", amnesty: null });
    expect(record?.preRegistration).toEqual({ treatment: "DEC13_NOT_EFFECTIVE", amnesty: null });
    expect(record?.route).toBe("AUTOMATED");
  });

  it("@AC-FR-REG-021-04 names the amnesty version with its first and last day in the effective policy set", () => {
    vi.setSystemTime(new Date("2027-03-01T09:00:00+07:00"));
    const key = signIn(PEOPLE.principal);
    const operations = staffOf(signInBeside(key, PEOPLE.operations));
    const rows = registrationPolicy(operations, "2027-03-01T09:00:00+07:00").data?.rows ?? [];
    expect(rows.find((row) => row.rule === "REG-AMNESTY-PERIOD")?.version).toEqual({ id: "AMV-2026-1", from: "2027-01-01", amnesty: { from: "2027-01-01", to: "2027-06-30" } });
    expect(rows.find((row) => row.rule === "REG-OBLIGATION-RULEBOOK")?.version?.id).toBe("2026.3");
  });
});

describe("a submission that goes to an officer, decided on the calculator's fee", () => {
  it("sends a premises the tariff cannot classify to review, and an officer decides it once the class is corrected", () => {
    const key = signIn(PEOPLE.principal);
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const approver = staffOf(signInBeside(key, PEOPLE.approver));
    const ref = start(key, { premisesId: "pxl", kind: "RENEWAL", prior: "OBD-9MZB3QFT4X", from: "2027-09-20", to: "2028-09-18" });
    complete(key, ref, { ...FACTS, premises_class: "restaurant" });
    const { review, sent } = send(key, ref);
    expect(review?.outcome).toEqual({ kind: "UNDER_REVIEW", reason: "INDETERMINATE_FACTS" });
    expect(review?.fee).toBeNull();
    expect(sent.accepted?.status).toBe("UNDER_REVIEW");
    // As applied for, the class still has no class in the tariff: no fee can be worked out for that outcome.
    const asApplied = recordProposal(officer, ref, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null });
    expect(asApplied.refusal?.code).toBe("TARIFF_NOT_APPROVED");
    expect(recordCorrection(officer, ref, { code: "premises_class", value: "cafe", document: null }).refusal).toBeNull();
    expect(proposalForm(officer, ref).data?.fees).toMatchObject({ asApplied: null, otherwise: 4_554_000 });
    const proposed = recordProposal(officer, ref, {
      outcome: "DECIDED_OTHERWISE",
      reason: "CLASSIFICATION_CHANGED",
      text: "Cơ sở phục vụ đồ uống nên được xếp loại quán cà phê.",
      unmet: ["Loại cơ sở khai không có trong biểu phí"],
      actionOpen: "Khiếu nại quyết định nếu bạn không đồng ý.",
      effectiveFrom: null,
    });
    expect(proposed.accepted?.decision).toBeNull();
    const verdict = recordVerdict(approver, proposed.accepted?.proposal ?? "", { verdict: "APPROVED", note: "" });
    expect(verdict.accepted?.status).toBe("APPROVED");
    const record = decisionRecord(key, verdict.accepted?.decision ?? "").data;
    expect(record).toMatchObject({ outcome: "PAYABLE", route: "MANUAL", declaredClassification: true });
    expect(record?.lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(4_554_000);
  });

  it("sends an application with a claim to claim review, and the officer's decision charges the claimed layer pending", () => {
    const key = signIn(PEOPLE.principal);
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    // The canvas's Sala draft: its lease and the claim's invoice were still to come.
    addEvidenceItem(key, "REG-P5TJ4BXC7M", "rules:LEASE", FILE);
    addEvidenceItem(key, "REG-P5TJ4BXC7M", "claim:NON_USE:PRODUCERS:SUPPLIER_INVOICE", FILE);
    const { review, sent } = send(key, "REG-P5TJ4BXC7M");
    expect(review?.outcome).toEqual({ kind: "UNDER_REVIEW", reason: "CLAIM_NEEDS_REVIEW" });
    expect(review?.fee?.lines.find((line) => line.layer === "PRODUCERS")).toMatchObject({ claimPending: true, amountMinor: 1_138_500 });
    expect(sent.accepted?.status).toBe("UNDER_REVIEW");
    const proposed = recordProposal(officer, "REG-P5TJ4BXC7M", { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null });
    const record = decisionRecord(key, proposed.accepted?.decision ?? "").data;
    expect(record?.lines.find((line) => line.layer === "PRODUCERS")).toMatchObject({ treatment: "CLAIM_PENDING", amountMinor: 1_138_500 });
    expect(record?.claim).toEqual({ state: "UNDER_REVIEW" });
    expect(record?.basis).toBe("TARIFF");
  });

  /** The Sala draft sent with its claim, decided as applied for with producers' rights pending: the decision's reference. */
  function decidedWithClaim(key: string, officer: Staff): string {
    addEvidenceItem(key, "REG-P5TJ4BXC7M", "rules:LEASE", FILE);
    addEvidenceItem(key, "REG-P5TJ4BXC7M", "claim:NON_USE:PRODUCERS:SUPPLIER_INVOICE", FILE);
    expect(send(key, "REG-P5TJ4BXC7M").sent.accepted?.status).toBe("UNDER_REVIEW");
    const decision = recordProposal(officer, "REG-P5TJ4BXC7M", { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null }).accepted?.decision ?? null;
    if (decision === null) throw new Error("the Sala draft was decided");
    return decision;
  }

  it("@AC-FR-TAR-009-02 a claim accepted after the decision removes its component in the calculation of the amendment", () => {
    const key = signIn(PEOPLE.principal);
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const decision = decidedWithClaim(key, officer);
    expect(decisionRecord(key, decision).data?.lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(4_554_000);
    const answer = recordClaimOutcome(officer, "REG-P5TJ4BXC7M", "PRODUCERS-NON_USE", { outcome: "ACCEPTED", reason: "NON_USE_SHOWN", scopeFrom: null, scopeTo: null, withLegal: false });
    const amendment = answer.accepted?.decision ?? "";
    const record = decisionRecord(key, amendment).data;
    expect(record).toMatchObject({ status: "CURRENT", prior: decision, route: "AUTOMATED", period: { from: "2026-10-16", to: "2027-09-30" }, governingOn: "2026-10-16", transitionRule: "FROM_NEXT_MONTH" });
    const calc = calculation(key, officer, record?.calculation ?? "").data?.calculation;
    expect(calc?.components.find((entry) => entry.layer === "PRODUCERS")).toMatchObject({ treatment: "EXCLUDED_CLAIM_ACCEPTED", amountMinor: 0, authority: "REG-P5TJ4BXC7M/PRODUCERS-NON_USE", reason: "CLAIM_ACCEPTED" });
    expect(calc?.rounding.beforeMinor).toBe(3_415_500);
    expect(calc?.amountMinor).toBe(3_415_000);
    expect(record?.lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(3_415_000);
    expect(record?.lines.find((line) => line.layer === "PRODUCERS")).toMatchObject({ amountMinor: 0, treatment: "CLAIM_ACCEPTED" });
  });

  it("a claim partly accepted after the decision charges the layer for the days outside the accepted scope, on TAR's calculation", () => {
    const key = signIn(PEOPLE.principal);
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const decision = decidedWithClaim(key, officer);
    const answer = recordClaimOutcome(officer, "REG-P5TJ4BXC7M", "PRODUCERS-NON_USE", { outcome: "PARTLY_ACCEPTED", reason: "EVIDENCE_PART_PERIOD", scopeFrom: "2027-04-01", scopeTo: "2027-09-30", withLegal: false });
    const record = decisionRecord(key, answer.accepted?.decision ?? "").data;
    expect(record?.prior).toBe(decision);
    const calc = calculation(key, officer, record?.calculation ?? "").data?.calculation;
    expect(calc?.components.find((entry) => entry.layer === "PRODUCERS")).toMatchObject({ treatment: "REDUCED_CLAIM_ACCEPTED", authority: "REG-P5TJ4BXC7M/PRODUCERS-NON_USE", reason: "CLAIM_PARTLY_ACCEPTED" });
    const producers = record?.lines.filter((line) => line.layer === "PRODUCERS") ?? [];
    expect(producers.map((line) => [line.treatment, line.scope])).toEqual([
      [null, { from: "2026-10-16", to: "2027-03-31" }],
      ["CLAIM_ACCEPTED", { from: "2027-04-01", to: "2027-09-30" }],
    ]);
    expect(record?.lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(calc?.amountMinor);
  });

  it("decides the canvas's Bùi Viện lounge on the declared class and the customer area as the officer corrected it", () => {
    const key = signIn(PEOPLE.principal);
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    expect(proposalForm(officer, "REG-D2VL7KQE3S").data?.fees).toMatchObject({ asApplied: 9_108_000, otherwise: 9_108_000, tariffVersion: "TV-2026.1" });
    const proposed = recordProposal(officer, "REG-D2VL7KQE3S", { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null });
    expect(proposed.refusal).toBeNull();
    const decision = proposed.accepted?.decision ?? "";
    expect(decisionRecord(key, decision).data).toMatchObject({ outcome: "PAYABLE", route: "MANUAL", declaredClassification: true });
    expect(restsOnDeclaredClassification(key, decision)).toBe(true);
  });

  it("refuses a proposal to a member of staff who is not an operations officer, and records none", () => {
    const key = signIn(PEOPLE.principal);
    const approver = staffOf(signInBeside(key, PEOPLE.approver));
    expect(recordProposal(approver, "REG-D2VL7KQE3S", { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null }).refusal?.code).toBe("NOT_AUTHORISED");
  });
});

describe("every premises a principal can start for on SCR-REG-02, sent end to end, reaches a decision", () => {
  /** What the principal can start for each premises on 16 October 2026: a renewal of the decision in force, or a first registration. */
  const STARTS: readonly (Start & { premises_class?: string; withdraw?: string })[] = [
    { premisesId: "sala", kind: "NEW", prior: null, from: "2026-10-20", to: "2027-10-19", withdraw: "REG-P5TJ4BXC7M" },
    { premisesId: "dakao", kind: "RENEWAL", prior: "OBD-4NPV8CRA2J", from: "2027-09-10", to: "2028-09-08", premises_class: "cafe" },
    { premisesId: "ltt", kind: "RENEWAL", prior: "OBD-2YDA7KMS5X", from: "2027-09-02", to: "2028-08-31", premises_class: "cafe" },
    { premisesId: "nh", kind: "RENEWAL", prior: "OBD-8KWT2PZH6M", from: "2027-09-24", to: "2028-09-22", premises_class: "cafe" },
    { premisesId: "pxl", kind: "RENEWAL", prior: "OBD-9MZB3QFT4X", from: "2027-09-20", to: "2028-09-18", premises_class: "restaurant" },
    { premisesId: "pasteur", kind: "RENEWAL", prior: "OBD-3FJW6NRA5C", from: "2027-09-18", to: "2028-09-16" },
  ];

  for (const entry of STARTS) {
    it(`${entry.premisesId}: a ${entry.kind.toLowerCase()} is decided, at submission or by an officer`, () => {
      const key = signIn(PEOPLE.principal);
      const officer = staffOf(signInBeside(key, PEOPLE.operations));
      const approver = staffOf(signInBeside(key, PEOPLE.approver));
      if (entry.withdraw !== undefined) withdrawApplication(key, entry.withdraw);
      const ref = start(key, entry);
      complete(key, ref, { ...FACTS, ...(entry.premises_class !== undefined ? { premises_class: entry.premises_class } : {}) });
      const { sent } = send(key, ref);
      expect(sent.refusal).toBeNull();
      let decision: string | null = null;
      if (sent.accepted?.status === "DECIDED") {
        decision = decisionList(key, entry.premisesId).data?.items[0]?.reference ?? null;
      } else {
        expect(sent.accepted?.status).toBe("UNDER_REVIEW");
        const asApplied = recordProposal(officer, ref, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null });
        if (asApplied.accepted !== null) decision = asApplied.accepted.decision;
        else {
          // A class the tariff does not list: the officer corrects it and decides otherwise, which a second person approves.
          recordCorrection(officer, ref, { code: "premises_class", value: "cafe", document: null });
          const proposed = recordProposal(officer, ref, { outcome: "DECIDED_OTHERWISE", reason: "CLASSIFICATION_CHANGED", text: "Xếp loại theo sổ đăng ký.", unmet: ["Loại cơ sở"], actionOpen: "Khiếu nại nếu không đồng ý.", effectiveFrom: null });
          decision = recordVerdict(approver, proposed.accepted?.proposal ?? "", { verdict: "APPROVED", note: "" }).accepted?.decision ?? null;
        }
      }
      const record = decisionRecord(key, decision ?? "").data;
      expect(record?.application).toBe(ref);
      expect(record?.tariffVersion).toBe("TV-2026.1");
      expect(record?.calculation).toMatch(/^TCL-/);
    });
  }
});
