import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessIssue,
  certificateExceptions,
  certificateForDecision,
  consoleRecord,
  consoleRecordList,
  createRepresentation,
  decideIssue,
  decideReview,
  followUpList,
  followUpPage,
  getCertificate,
  getRepresentationDocument,
  holderPremises,
  issueApproval,
  openStatusReview,
  premisesStatusRecords,
  proposalForm,
  proposeChange,
  recordHistory,
  registerKey,
  retireKey,
  reviewList,
  reviewPage,
  revokeKey,
  signedCodeOf,
  statusReviewState,
  verificationKeysAt,
  type Actor,
} from "@/lib/mock/backend/status-records";
import { PEOPLE, signIn, signInBeside } from "./harness";
import type * as registrationModule from "@/lib/mock/backend/registration";
import type * as financeModule from "@/lib/mock/backend/finance";
import type * as seedModule from "@/lib/mock/status-records";

/*
 * CER's rules against the families it reads. REG's decisions and FIN's payment condition are the real modules',
 * with what a test adds: a decision REG would record (a renewal, a re-decision, a decision for a premises with no
 * record) and the condition FIN answers for it. Everything else - the seed, COM's notices, the key service - is
 * the portal's own. Time is fixed per test, since every answer here is the answer at an instant.
 *
 * COM's notices are read by a dynamic import: a module importing REG ahead of CER would have CER bound to REG's own
 * functions rather than to the ones this file adds decisions through, because REG reaches CER through PTY.
 */

/** The notices COM sent the holder of the canvas's premises (RightOne ID's organisation `tcv`). */
async function sentToHolder(key: string) {
  const { noticesTo } = await import("@/lib/mock/backend/notices");
  return noticesTo(key, "tcv").data ?? [];
}

type Decision = { summary: Record<string, unknown>; record: Record<string, unknown> };

const added = vi.hoisted(() => ({
  decisions: new Map<string, Decision>(),
  declared: new Set<string>(),
  payments: new Map<string, { condition: string; reconciledAt: string | null }>(),
}));

vi.mock("@/lib/mock/backend/registration", async (importOriginal) => {
  const real = await importOriginal<typeof registrationModule>();
  type Found = ReturnType<typeof real.decisionForCollection>;
  return {
    ...real,
    decisionReferences: (key: string) => [...[...added.decisions.keys()].reverse(), ...real.decisionReferences(key)],
    decisionForCollection: (key: string, ref: string): Found => (added.decisions.get(ref) as unknown as Found | undefined) ?? real.decisionForCollection(key, ref),
    restsOnDeclaredClassification: (key: string, ref: string) => added.declared.has(ref) || real.restsOnDeclaredClassification(key, ref),
  };
});

/*
 * What GOV and DAT answer is the boards' seed (`lib/mock/status-records.ts`): one definition, one published policy
 * version, the purpose register from 1 September 2026. A test that needs a later definition, a draft or a later policy
 * version, or a purpose not yet permitted adds it here, and every test starts from the seed again.
 */
const seeded = vi.hoisted(() => ({
  definitions: [] as unknown[],
  policies: [] as unknown[],
  purposes: [] as unknown[],
  original: { definitions: [] as unknown[], policies: [] as unknown[], purposes: [] as unknown[] },
}));

vi.mock("@/lib/mock/status-records", async (importOriginal) => {
  const real = await importOriginal<typeof seedModule>();
  seeded.original = { definitions: [...real.CER_DEFINITIONS], policies: [...real.CER_POLICY_VERSIONS], purposes: [...real.PROCESSING_PURPOSES] };
  seeded.definitions.push(...real.CER_DEFINITIONS);
  seeded.policies.push(...real.CER_POLICY_VERSIONS);
  seeded.purposes.push(...real.PROCESSING_PURPOSES);
  return { ...real, CER_DEFINITIONS: seeded.definitions, CER_POLICY_VERSIONS: seeded.policies, PROCESSING_PURPOSES: seeded.purposes };
});

type SeedDefinition = (typeof seedModule.CER_DEFINITIONS)[number];
type SeedPolicyVersion = (typeof seedModule.CER_POLICY_VERSIONS)[number];

/** A definition GOV approves after the boards' one, identical but for what a test names. */
function laterDefinition(changes: Partial<SeedDefinition>): void {
  const first = seeded.original.definitions[0] as SeedDefinition;
  seeded.definitions.push({ ...first, ...changes });
}

/** A version of `CER-ENFORCEMENT` beside the boards' version 1. */
function policyVersion(version: Partial<SeedPolicyVersion>): void {
  const first = seeded.original.policies[0] as SeedPolicyVersion;
  seeded.policies.push({ ...first, ...version });
}

vi.mock("@/lib/mock/backend/finance", async (importOriginal) => {
  const real = await importOriginal<typeof financeModule>();
  return {
    ...real,
    paymentConditionFor: (key: string, ref: string) => (added.payments.get(ref)?.condition as ReturnType<typeof real.paymentConditionFor> | undefined) ?? real.paymentConditionFor(key, ref),
    settlementOf: (key: string, ref: string) => {
      const paid = added.payments.get(ref);
      if (paid === undefined) return real.settlementOf(key, ref);
      return paid.condition === "RECONCILED_IN_FULL" && paid.reconciledAt !== null ? { payment: "PAY-2TESTPAY2T", reconciledAt: paid.reconciledAt, invoice: null } : null;
    },
  };
});

const THEN_CUA = "Công ty TNHH Then Cửa Việt";
const PASTEUR = "R1-CER-2026-T7QM4BWJ";
const PASTEUR_DECISION = "OBD-3FJW6NRA5C";
const AP_MAI = "R1-CER-2026-W5HK8TQM";
const NGUYEN_HUE = "R1-CER-2026-N6PZ2RKE";
const NGUYEN_TRAI_DECISION = "OBD-2RKD8MXT4Q";

const OFFICER: Actor = { name: "Phan Gia Lượng", position: "Cán bộ vận hành", roles: ["ACT-OPS"] };
const SECOND_OFFICER: Actor = { name: "Hứa Minh Quân", position: "Cán bộ vận hành", roles: ["ACT-OPS"] };
const APPROVER: Actor = { name: "Thạch Minh Khải", position: "Người duyệt nghiệp vụ", roles: ["ACT-BIZ-APR"] };
const SECURITY: Actor = { name: "Lò Văn Thịnh", position: "Cán bộ an ninh", roles: ["ACT-SEC"] };

const at = (instant: string) => vi.setSystemTime(new Date(instant));

/** A decision REG records, as `decisionForCollection` answers it. */
function decide(
  ref: string,
  premises: { id: string; name: string },
  period: { from: string; to: string },
  options: { issuedAt: string; outcome?: "PAYABLE" | "NO_PAYABLE_OBLIGATION"; replaces?: string; prior?: string },
): void {
  const outcome = options.outcome ?? "PAYABLE";
  const feeMinor = outcome === "PAYABLE" ? 986_000 : 0;
  added.decisions.set(ref, {
    summary: { reference: ref, premises, status: "CURRENT", outcome, note: null, feeMinor, currency: "VND", payBy: null, period, replaces: options.replaces ?? null, replacedBy: null },
    record: {
      reference: ref,
      premises: premises.name,
      status: "CURRENT",
      outcome,
      issuedAt: options.issuedAt,
      period,
      basis: "TARIFF",
      lines: [],
      currency: "VND",
      tariffVersion: "TAR-TEST",
      payBy: null,
      useBeganOn: null,
      confirmedAt: options.issuedAt,
      explanationVersion: 1,
      rulebookVersion: "RB-TEST",
      beforeRegistration: null,
      claim: null,
      otherwise: null,
      replacedBy: null,
      application: null,
      prior: options.prior ?? options.replaces ?? null,
    },
  });
}

const pay = (ref: string, condition: string, reconciledAt: string | null = null) => added.payments.set(ref, { condition, reconciledAt });

const SALA = { id: "sala", name: "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ" };
const PASTEUR_PREMISES = { id: "pasteur", name: "Then Cửa Coffee & Tea – Pasteur" };

// A test moves the clock months ahead, and COM composes every notice that fell due meanwhile on its next read.
vi.setConfig({ testTimeout: 120_000 });

let key: string;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at("2026-10-16T10:00:00+07:00");
  key = signIn(PEOPLE.principal);
});

afterEach(() => {
  added.decisions.clear();
  added.declared.clear();
  added.payments.clear();
  seeded.definitions.splice(0, seeded.definitions.length, ...seeded.original.definitions);
  seeded.policies.splice(0, seeded.policies.length, ...seeded.original.policies);
  seeded.purposes.splice(0, seeded.purposes.length, ...seeded.original.purposes);
  vi.useRealTimers();
});

describe("DR-430: every issue condition, evaluated at the assessment", () => {
  it("names every condition that fails at once, in the rule's row order", () => {
    at("2026-08-31T09:00:00+07:00");
    decide("OBD-2SALATEST2", SALA, { from: "2026-09-01", to: "2027-08-31" }, { issuedAt: "2026-08-31T08:00:00+07:00" });
    pay("OBD-2SALATEST2", "PART_PAID");
    const record = consoleRecord(key, "OBD-2SALATEST2").data;
    expect(record?.assessment?.unmet).toEqual(["AUTHORITY_NOT_RIGHTONE", "DEFINITION_NOT_APPROVED", "PAYMENT_PART_PAID", "PROCESSING_NOT_PERMITTED"]);
  });

  it("@AC-FR-CER-001-05 while the legacy system is the authoritative issuer, a paid decision's record does not issue", () => {
    at("2026-08-31T09:00:00+07:00");
    decide("OBD-2SALATEST2", SALA, { from: "2026-09-01", to: "2027-08-31" }, { issuedAt: "2026-08-31T08:00:00+07:00" });
    pay("OBD-2SALATEST2", "RECONCILED_IN_FULL", "2026-08-31T08:30:00+07:00");
    const record = consoleRecord(key, "OBD-2SALATEST2").data;
    expect(record?.assessment?.unmet).toContain("AUTHORITY_NOT_RIGHTONE");
    expect(record?.status).toBe("PENDING_ISSUE");
    expect(record?.reference).toBeNull();
  });

  it("@AC-FR-CER-019-03 with no approved definition the assessment records DEFINITION_NOT_APPROVED and nothing issues", () => {
    at("2026-08-31T09:00:00+07:00");
    decide("OBD-2SALATEST2", SALA, { from: "2026-09-01", to: "2027-08-31" }, { issuedAt: "2026-08-31T08:00:00+07:00", outcome: "NO_PAYABLE_OBLIGATION" });
    const record = consoleRecord(key, "OBD-2SALATEST2").data;
    expect(record?.assessment?.unmet).toContain("DEFINITION_NOT_APPROVED");
    expect(certificateForDecision(key, "OBD-2SALATEST2")).toBeNull();
  });

  it("@AC-FR-CER-002-04 an approval is refused when the payment was reversed after the assessment, naming PAYMENT_REVERSED", () => {
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-16", to: "2027-10-15" }, { issuedAt: "2026-10-16T08:00:00+07:00" });
    added.declared.add("OBD-2SALATEST2");
    pay("OBD-2SALATEST2", "RECONCILED_IN_FULL", "2026-10-16T08:30:00+07:00");
    expect(consoleRecord(key, "OBD-2SALATEST2").data?.assessment?.route).toBe("DECLARED_CLASSIFICATION");
    pay("OBD-2SALATEST2", "REVERSED");
    const answer = decideIssue(key, APPROVER, "OBD-2SALATEST2", { decision: "APPROVE", reason: "", evidence: [] });
    expect(answer.failure?.code).toBe("ISSUE_CONDITIONS_NOT_MET");
    expect(answer.unmet).toEqual(["PAYMENT_REVERSED"]);
    expect(consoleRecord(key, "OBD-2SALATEST2").data?.status).toBe("PENDING_ISSUE");
  });

  it("@AC-FR-CER-002-03 an operations officer cannot approve an issue", () => {
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-16", to: "2027-10-15" }, { issuedAt: "2026-10-16T08:00:00+07:00" });
    added.declared.add("OBD-2SALATEST2");
    pay("OBD-2SALATEST2", "RECONCILED_IN_FULL", "2026-10-16T08:30:00+07:00");
    expect(decideIssue(key, OFFICER, "OBD-2SALATEST2", { decision: "APPROVE", reason: "", evidence: [] }).failure?.code).toBe("NOT_AUTHORISED");
    expect(issueApproval(key, "OBD-2SALATEST2").data?.decided).toBeNull();
  });

  it("@AC-FR-CER-001-08 a record that no longer waits to issue is not assessed again", () => {
    expect(assessIssue(key, OFFICER, PASTEUR).failure?.code).toBe("NOT_PENDING_ISSUE");
  });
});

describe("issue: the definition's texts, the rule as authority, the holder's notice", () => {
  function issueSala(): string {
    at("2026-10-20T09:00:00+07:00");
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-20", to: "2027-10-19" }, { issuedAt: "2026-10-20T09:00:00+07:00", outcome: "NO_PAYABLE_OBLIGATION" });
    const ref = certificateForDecision(key, "OBD-2SALATEST2");
    if (ref === null) throw new Error("the no-fee decision issues straight through");
    return ref;
  }

  it("@AC-FR-CER-019-01 an issued record carries the legal nature, legal effect and issuer of the definition in force on its issue day", () => {
    const definition = consoleRecord(key, issueSala()).data?.definition;
    expect(definition?.id).toBe("SRD-2026.1");
    expect(definition?.legalNature).toEqual({ vi: "Xác nhận trạng thái tuân thủ tại một thời điểm", en: "Confirmation of compliance status at a point in time" });
    expect(definition?.issuer).toEqual({ vi: "Cổng một cửa về quyền tác giả âm nhạc", en: "The one-stop gateway for music copyright" });
  });

  it("@AC-FR-CER-023-01 a straight-through issue records the rule and the decision that required it as its authority", () => {
    const history = recordHistory(key, issueSala()).data;
    expect(history?.changes[0]?.authority).toEqual({ kind: "ROUTE", straight: true, decision: "OBD-2SALATEST2" });
  });

  it("raises the holder's notice of the issue through COM", async () => {
    const ref = issueSala();
    const sent = await sentToHolder(key);
    expect(sent.some((notice) => notice.classCode === "status_change" && notice.content?.values.record === ref && notice.content.values.status === "ACTIVE")).toBe(true);
  });
});

describe("DR-434: the expiring state at the instant COM gives, and the lapse", () => {
  function issueSala(): string {
    at("2026-10-20T09:00:00+07:00");
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-20", to: "2027-10-19" }, { issuedAt: "2026-10-20T09:00:00+07:00", outcome: "NO_PAYABLE_OBLIGATION" });
    return certificateForDecision(key, "OBD-2SALATEST2") ?? "";
  }

  it("@AC-FR-CER-016-04 a record does not become expiring before its expiry notice falls due", () => {
    const ref = issueSala();
    at("2027-09-19T23:59:00+07:00");
    expect(consoleRecord(key, ref).data?.status).toBe("ACTIVE");
  });

  it("@AC-FR-CER-016-01 the record enters the expiring state at the due instant of the expiry notice, and the entry names the notice", () => {
    const ref = issueSala();
    at("2027-09-20T00:01:00+07:00");
    expect(consoleRecord(key, ref).data?.status).toBe("EXPIRING");
    const entry = recordHistory(key, ref).data?.changes.find((change) => change.to === "EXPIRING");
    expect(Date.parse(entry?.effectiveAt ?? "")).toBe(Date.parse("2027-09-20T00:00:00+07:00"));
    expect(entry?.authority).toMatchObject({ kind: "NOTICE", fallback: false });
    expect(entry?.authority.kind === "NOTICE" ? entry.authority.notice : null).not.toBeNull();
  });

  it("@AC-FR-CER-009-01 a record not renewed expires at the end of its period, and the lapse is recorded and noticed", async () => {
    const ref = issueSala();
    at("2027-10-20T00:05:00+07:00");
    expect(consoleRecord(key, ref).data?.status).toBe("EXPIRED");
    const lapse = recordHistory(key, ref).data?.changes.find((change) => change.to === "EXPIRED");
    expect(Date.parse(lapse?.effectiveAt ?? "")).toBe(Date.parse("2027-10-20T00:00:00+07:00"));
    const sent = await sentToHolder(key);
    expect(sent.some((notice) => notice.classCode === "status_change" && notice.content?.values.record === ref && notice.content.values.status === "EXPIRED")).toBe(true);
  });
});

describe("DR-432 and ALG-405 step 6: a renewal adds a period to the holder's record", () => {
  const RENEWAL = "OBD-2RENEWAL22";

  function renewPasteur(condition: string): void {
    at("2027-08-25T09:00:00+07:00");
    decide(RENEWAL, PASTEUR_PREMISES, { from: "2027-09-18", to: "2028-09-17" }, { issuedAt: "2027-08-25T08:30:00+07:00" });
    pay(RENEWAL, condition);
    consoleRecordList(key, { status: null, premises: null, waiting: false }, null);
  }

  it("@AC-FR-CER-010-01 a paid renewal decision adds its period under the same reference and the record becomes active", () => {
    renewPasteur("PENDING");
    const before = consoleRecordList(key, { status: null, premises: null, waiting: false }, null).data?.total;
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("EXPIRING");
    at("2027-08-26T09:00:00+07:00");
    pay(RENEWAL, "RECONCILED_IN_FULL", "2027-08-26T09:00:00+07:00");
    expect(certificateForDecision(key, RENEWAL)).toBe(PASTEUR);
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("ACTIVE");
    expect(recordHistory(key, PASTEUR).data?.periods.at(-1)).toMatchObject({ decision: RENEWAL, cause: "RENEWAL" });
    expect(consoleRecordList(key, { status: null, premises: null, waiting: false }, null).data?.total).toBe(before);
  });

  it("@AC-FR-CER-009-03 a record with a renewal period does not expire at the old period's end", () => {
    renewPasteur("RECONCILED_IN_FULL");
    at("2027-09-18T00:05:00+07:00");
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("ACTIVE");
    expect(recordHistory(key, PASTEUR).data?.changes.some((change) => change.to === "EXPIRED")).toBe(false);
  });

  it("keeps the earlier period and the decision that governed it as they were", () => {
    renewPasteur("RECONCILED_IN_FULL");
    const periods = recordHistory(key, PASTEUR).data?.periods ?? [];
    expect(periods[0]).toMatchObject({ decision: PASTEUR_DECISION, cause: "ISSUE", to: null });
    expect(periods).toHaveLength(2);
  });

  it("@AC-FR-CER-010-04 a renewal whose payment is not reconciled adds no period, and the record expires at the old end", () => {
    renewPasteur("PENDING");
    at("2027-09-18T00:05:00+07:00");
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("EXPIRED");
    expect(consoleRecord(key, PASTEUR).data?.renewal?.assessment?.unmet).toEqual(["PAYMENT_PENDING"]);
    expect(certificateForDecision(key, RENEWAL)).toBeNull();
  });

  it("routes a renewal on a declared classification to an approver, whose approval adds the period", () => {
    added.declared.add(RENEWAL);
    renewPasteur("RECONCILED_IN_FULL");
    const approval = issueApproval(key, PASTEUR).data;
    expect(approval?.renewal).toEqual({ record: PASTEUR });
    expect(approval?.awaitsApprover).toBe(true);
    const answer = decideIssue(key, APPROVER, PASTEUR, { decision: "APPROVE", reason: "Lớp cơ sở đã khai, phí đã trả", evidence: [] });
    expect(answer.data?.renewed).toEqual({ from: "2027-09-18", to: "2028-09-17" });
    expect(consoleRecord(key, PASTEUR).data?.renewal).toBeNull();
  });

  it("@AC-FR-CER-010-05 a decision that overlaps the holder's record adds no period and creates no second record", () => {
    decide("OBD-2OVERLAP22", PASTEUR_PREMISES, { from: "2027-01-01", to: "2027-12-31" }, { issuedAt: "2026-10-16T09:00:00+07:00" });
    const before = consoleRecordList(key, { status: null, premises: null, waiting: false }, null).data?.total ?? 0;
    expect(certificateForDecision(key, "OBD-2OVERLAP22")).toBeNull();
    expect(consoleRecord(key, PASTEUR).data?.renewal).toBeNull();
    expect(certificateExceptions(key).some((entry) => entry.code === "EXC-CER-05" && entry.detail.decision === "OBD-2OVERLAP22")).toBe(true);
    expect(consoleRecordList(key, { status: null, premises: null, waiting: false }, null).data?.total).toBe(before);
  });

  it("@AC-FR-CER-001-06 a pending record whose decision is superseded follows the successor decision, with no second record", () => {
    const before = consoleRecordList(key, { status: null, premises: null, waiting: false }, null).data?.total;
    decide("OBD-2NEWBASIS2", { id: "x", name: "The Lintel Coffee – Nguyễn Trãi" }, { from: "2026-10-20", to: "2027-09-24" }, { issuedAt: "2026-10-16T09:30:00+07:00", replaces: NGUYEN_TRAI_DECISION });
    pay("OBD-2NEWBASIS2", "PENDING");
    const record = consoleRecord(key, NGUYEN_TRAI_DECISION).data;
    expect(record?.decision).toBe("OBD-2NEWBASIS2");
    expect(record?.assessment?.decision).toBe("OBD-2NEWBASIS2");
    expect(consoleRecordList(key, { status: null, premises: null, waiting: false }, null).data?.total).toBe(before);
  });
});

describe("FR-CER-025: the enforcement policy in force, recorded on each change", () => {
  it("@AC-FR-CER-025-01 an approved suspension records the CER-ENFORCEMENT version it relied on", () => {
    expect(decideReview(key, APPROVER, "CSR-4TN7QK2MVD", { decision: "APPROVE", reason: "" }).failure).toBeNull();
    const change = consoleRecord(key, PASTEUR).data?.lastChange;
    expect(change).toMatchObject({ kind: "status", to: "SUSPENDED", policyVersion: "1" });
  });

  it("@AC-FR-CER-025-03 with no version in force, a cancellation is refused NO_ENFORCEMENT_POLICY", () => {
    at("2026-08-31T09:00:00+07:00");
    const answer = proposeChange(key, OFFICER, {
      record: NGUYEN_TRAI_DECISION,
      review: null,
      act: "CANCEL",
      ground: "GR-ISSUED-IN-ERROR",
      reason: "Cấp nhầm",
      evidence: ["REG-2026-0001"],
      effectiveAt: null,
      conditions: [],
    });
    expect(answer.failure?.code).toBe("NO_ENFORCEMENT_POLICY");
    expect(proposalForm(key, NGUYEN_TRAI_DECISION, null).data?.policy).toBeNull();
  });

  it("@AC-FR-CER-014-01 a suspension shows its holder the ground, the reinstatement condition and the appeal's closing date", () => {
    decideReview(key, APPROVER, "CSR-4TN7QK2MVD", { decision: "APPROVE", reason: "" });
    const standing = getCertificate(key, THEN_CUA, PASTEUR).data?.record.standing;
    expect(standing).toMatchObject({ kind: "suspended", ground: "GR-PAYMENT-REVERSED", condition: "RC-SETTLED" });
    // Friday 16 October 2026 and fifteen Vietnamese working days on.
    expect(standing?.remedy).toEqual({ kind: "APPEAL", route: "CAS", closesOn: "2026-11-06" });
  });

  it("raises the holder's notice of the suspension through COM with its ground, condition and remedy", async () => {
    decideReview(key, APPROVER, "CSR-4TN7QK2MVD", { decision: "APPROVE", reason: "" });
    const notice = (await sentToHolder(key)).find((entry) => entry.classCode === "status_change" && entry.content?.values.status === "SUSPENDED");
    expect(notice?.content?.values).toMatchObject({ record: PASTEUR, ground: "GR-PAYMENT-REVERSED", condition: "RC-SETTLED", remedy: "APPEAL", remedyClosesOn: "2026-11-06", policy: "CER-ENFORCEMENT 1" });
  });

  it("states a complaint with no closing date for a reinstatement, which rests on no ground", () => {
    decideReview(key, APPROVER, "CSR-4TN7QK2MVD", { decision: "APPROVE", reason: "" });
    at("2026-10-20T10:00:00+07:00");
    pay(PASTEUR_DECISION, "RECONCILED_IN_FULL", "2026-10-19T15:00:00+07:00");
    const proposed = proposeChange(key, SECOND_OFFICER, {
      record: PASTEUR,
      review: null,
      act: "REINSTATE",
      ground: null,
      reason: "Đã thu lại khoản phí",
      evidence: ["PAY-2TESTPAY2T"],
      effectiveAt: null,
      conditions: [{ condition: "RC-SETTLED", howMet: "PAY-2TESTPAY2T" }],
    });
    expect(decideReview(key, APPROVER, proposed.data?.review ?? "", { decision: "APPROVE", reason: "" }).failure).toBeNull();
    expect(consoleRecord(key, PASTEUR).data?.lastChange).toMatchObject({ kind: "status", to: "REINSTATED", policyVersion: null, remedy: { kind: "COMPLAINT", route: "CAS", closesOn: null } });
  });
});

describe("DR-437: a review an event opens, and its conclusion", () => {
  it("@AC-FR-CER-008-06 a second reversal while a review is open joins that review", () => {
    const review = openStatusReview(key, PASTEUR, { kind: "PAYMENT_REVERSAL", event: "FIN-EV-9001", at: "2026-10-16T09:50:00+07:00" });
    expect(review).toBe("CSR-4TN7QK2MVD");
    expect(reviewPage(key, APPROVER, "CSR-4TN7QK2MVD").data?.joined).toMatchObject([{ kind: "PAYMENT_REVERSAL", event: "FIN-EV-9001" }]);
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("ACTIVE");
  });

  it("@AC-FR-CER-008-05 a case decision opens a review naming the case, and a second delivery opens nothing", () => {
    const trigger = { kind: "CASE" as const, caseRef: "CAS-2026-0512", letter: null, letterOn: null };
    const first = openStatusReview(key, NGUYEN_HUE, trigger);
    const open = reviewList(key, "ALL").data?.total;
    expect(openStatusReview(key, NGUYEN_HUE, trigger)).toBe(first);
    expect(reviewList(key, "ALL").data?.total).toBe(open);
    expect(statusReviewState(key, first ?? "")?.state).toBe("OPEN");
    expect(certificateExceptions(key).some((entry) => entry.code === "EXC-CER-06")).toBe(true);
  });

  it("@AC-FR-CER-008-01 a review a chargeback opened is concluded by an approved suspension that records everything a reviewer needs", () => {
    const review = openStatusReview(key, NGUYEN_HUE, { kind: "PAYMENT_REVERSAL", event: "FIN-EV-9002", at: "2026-10-16T09:40:00+07:00" }) ?? "";
    proposeChange(key, OFFICER, {
      record: NGUYEN_HUE,
      review,
      act: "SUSPEND",
      ground: "GR-PAYMENT-REVERSED",
      reason: "Chủ thẻ đòi lại toàn bộ khoản phí",
      evidence: ["FIN-EV-9002"],
      effectiveAt: "2026-10-16T14:00:00+07:00",
      conditions: [],
    });
    at("2026-10-16T13:40:00+07:00");
    decideReview(key, APPROVER, review, { decision: "APPROVE", reason: "" });
    expect(statusReviewState(key, review)).toMatchObject({ state: "APPROVED", act: "SUSPEND", effectiveAt: "2026-10-16T14:00:00+07:00" });
    at("2026-10-16T14:00:00+07:00");
    expect(consoleRecord(key, NGUYEN_HUE).data?.lastChange).toMatchObject({
      kind: "status",
      to: "SUSPENDED",
      reason: "Chủ thẻ đòi lại toàn bộ khoản phí",
      evidence: ["FIN-EV-9002"],
      proposer: { name: OFFICER.name },
      approver: { name: APPROVER.name },
      policyVersion: "1",
      noticeRaised: true,
    });
  });

  it("opens no review for a reference that names no issued record", () => {
    expect(openStatusReview(key, "R1-CER-2026-XXXXXXXX", { kind: "PAYMENT_REVERSAL", event: "FIN-EV-9003", at: "2026-10-16T09:00:00+07:00" })).toBeNull();
  });
});

describe("ALG-407: a printout's payload signed with the key that signs then", () => {
  it("@AC-FR-CER-021-01 the payload is signed with the signing key, and the published key verifies it", () => {
    const printout = createRepresentation(key, null, PASTEUR).data?.printout ?? "";
    const code = signedCodeOf(key, printout);
    const payload = JSON.parse(Buffer.from(code?.payload ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    expect(payload).toMatchObject({ v: 1, ref: PASTEUR, rep: printout, kid: "CK-2026-01", st: "ACTIVE", iss: "R1-OSG" });
    const published = verificationKeysAt(key, "2026-10-16T10:00:00+07:00").find((entry) => entry.kid === "CK-2026-01");
    const publicKey = createPublicKey({ key: published?.publicKeyJwk ?? {}, format: "jwk" });
    expect(verify("sha256", Buffer.from(code?.payload ?? "", "base64url"), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(code?.signature ?? "", "base64url"))).toBe(true);
  });

  it("prints on the sheet the code with the signed payload and its signature", () => {
    const printout = createRepresentation(key, null, PASTEUR).data?.printout ?? "";
    const sheet = getRepresentationDocument(key, null, PASTEUR, printout).data;
    const code = signedCodeOf(key, printout);
    expect(sheet?.code).toBe(`rightone.vn/v/${PASTEUR}?r=${printout}&p=${code?.payload}&s=${code?.signature}`);
    expect(sheet?.definition?.id).toBe("SRD-2026.1");
  });

  it("@AC-FR-CER-021-03 a revoked key is not published, and EXC-CER-07 names each record whose current printout it signed", () => {
    expect(revokeKey(key, SECURITY, "CK-2026-01", "Sự cố dịch vụ khoá KSI-17").failure).toBeNull();
    expect(verificationKeysAt(key, "2026-10-16T10:01:00+07:00").some((entry) => entry.kid === "CK-2026-01")).toBe(false);
    const raised = certificateExceptions(key).find((entry) => entry.code === "EXC-CER-07");
    expect(raised?.detail.records).toContain(PASTEUR);
  });

  it("records nothing unsigned when no key signs: SIGNING_UNAVAILABLE", () => {
    revokeKey(key, SECURITY, "CK-2026-01", "Sự cố dịch vụ khoá KSI-17");
    expect(createRepresentation(key, null, PASTEUR).failure?.code).toBe("SIGNING_UNAVAILABLE");
  });

  it("@AC-FR-CER-021-11 a revoked key is not revoked again", () => {
    revokeKey(key, SECURITY, "CK-2026-01", "Sự cố dịch vụ khoá KSI-17");
    expect(revokeKey(key, SECURITY, "CK-2026-01", "Lần nữa").failure?.code).toBe("KEY_ALREADY_REVOKED");
  });
});

describe("SEC-434: a premises actor reads the records of a premises it acts for", () => {
  it("@AC-FR-CER-003-07 a premises actor who names no premises is shown no record", () => {
    expect(premisesStatusRecords(key, THEN_CUA, null, null).failure?.code).toBe("PREMISES_FILTER_REQUIRED");
  });

  it("lists one premises' records, the party's own", () => {
    const list = premisesStatusRecords(key, THEN_CUA, "pasteur", null).data;
    expect(list?.premises).toBe(PASTEUR_PREMISES.name);
    expect(list?.records.map((record) => record.reference)).toEqual([PASTEUR]);
    expect(list?.nextCursor).toBeNull();
  });

  it("refuses a premises the person does not act for, and a cursor of another premises", () => {
    expect(premisesStatusRecords(key, THEN_CUA, "nowhere", null).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(premisesStatusRecords(key, THEN_CUA, "pasteur", "bm90LWEtY3Vyc29y").failure?.code).toBe("CURSOR_INVALID");
  });

  it("@AC-FR-CER-003-03 a person who may not act for the premises cannot read or print its record", () => {
    const read = getCertificate(key, THEN_CUA, AP_MAI);
    expect(read.failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(read.data).toBeNull();
    expect(createRepresentation(key, THEN_CUA, AP_MAI).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });
});

describe("FR-CER-026 and the consoles' lists", () => {
  it("@AC-FR-CER-026-01 a follow-up still open past its due instant is raised to the certificate authority, naming the record and the decision", () => {
    expect(followUpPage(key, "CFU-8WN3KT6QPA").data?.exceptionRaisedAt).not.toBeNull();
    expect(certificateExceptions(key).find((entry) => entry.code === "EXC-CER-04" && entry.detail.followUp === "CFU-8WN3KT6QPA")).toMatchObject({
      subject: "R1-CER-2026-F9RB2KXN",
      detail: { decision: "OBD-8NQV4TRC6W" },
    });
  });

  it("refuses a page cursor the review and follow-up lists did not give", () => {
    expect(reviewList(key, "ALL", "bm90LWEtY3Vyc29y").failure?.code).toBe("CURSOR_INVALID");
    expect(followUpList(key, "ALL", "bm90LWEtY3Vyc29y").failure?.code).toBe("CURSOR_INVALID");
  });
});

describe("DR-430: FIN's answer and DAT's purpose register, each named as it fails", () => {
  it("names each of FIN's answers short of reconciled in full as its own unmet condition", () => {
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-20", to: "2027-10-19" }, { issuedAt: "2026-10-16T09:00:00+07:00" });
    const answers = {
      PENDING: "PAYMENT_PENDING",
      PART_PAID: "PAYMENT_PART_PAID",
      REVERSED: "PAYMENT_REVERSED",
      IN_SUSPENSE_OR_DISPUTED: "PAYMENT_IN_SUSPENSE_OR_DISPUTED",
    } as const;
    for (const [answer, condition] of Object.entries(answers)) {
      pay("OBD-2SALATEST2", answer);
      expect(assessIssue(key, OFFICER, "OBD-2SALATEST2").data?.issued).toBeNull();
      expect(consoleRecord(key, "OBD-2SALATEST2").data?.assessment?.unmet).toEqual([condition]);
    }
    expect(consoleRecord(key, "OBD-2SALATEST2").data).toMatchObject({ status: "PENDING_ISSUE", reference: null });
  });

  it("@AC-FR-CER-001-07 a purpose the data protection register does not permit blocks issue", () => {
    seeded.purposes.splice(0, seeded.purposes.length, { activity: "certificate issue", from: "2026-11-01" });
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-20", to: "2027-10-19" }, { issuedAt: "2026-10-16T09:00:00+07:00", outcome: "NO_PAYABLE_OBLIGATION" });
    expect(consoleRecord(key, "OBD-2SALATEST2").data?.assessment?.unmet).toEqual(["PROCESSING_NOT_PERMITTED"]);
    expect(certificateForDecision(key, "OBD-2SALATEST2")).toBeNull();
  });

  it("refuses a request to assess to anyone but an operations officer", () => {
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-20", to: "2027-10-19" }, { issuedAt: "2026-10-16T09:00:00+07:00" });
    pay("OBD-2SALATEST2", "PENDING");
    expect(assessIssue(key, APPROVER, "OBD-2SALATEST2").failure?.code).toBe("NOT_AUTHORISED");
    expect(assessIssue(key, OFFICER, PASTEUR).failure?.code).toBe("NOT_PENDING_ISSUE");
  });
});

describe("FR-CER-001: a record waiting to issue, as its holder reads it", () => {
  function pendingSala(condition: string, reconciledAt: string | null = null): void {
    decide("OBD-2SALATEST2", SALA, { from: "2026-10-20", to: "2027-10-19" }, { issuedAt: "2026-10-16T09:00:00+07:00" });
    pay("OBD-2SALATEST2", condition, reconciledAt);
  }

  it("@AC-FR-CER-001-02 an unpaid decision's record stays pending, and its holder reads that it waits for the payment", () => {
    pendingSala("PENDING");
    expect(assessIssue(key, OFFICER, "OBD-2SALATEST2").data?.issued).toBeNull();
    const officer = consoleRecord(key, "OBD-2SALATEST2").data;
    expect(officer).toMatchObject({ status: "PENDING_ISSUE", reference: null, assessment: { trigger: "OPERATOR_REQUEST", unmet: ["PAYMENT_PENDING"] } });
    expect(officer?.fee?.amountMinor).toBe(986_000);
    const listed = premisesStatusRecords(key, THEN_CUA, "sala", null).data;
    expect(listed?.records).toEqual([]);
    expect(listed?.pending).toEqual([expect.objectContaining({ key: "OBD-2SALATEST2", from: "2026-10-20", to: "2027-10-19", waitingOn: ["PAYMENT_PENDING"] })]);
    const read = getCertificate(key, THEN_CUA, "OBD-2SALATEST2").data?.record;
    expect(read).toMatchObject({ reference: null, key: "OBD-2SALATEST2", state: "pending", waitingOn: ["PAYMENT_PENDING"], current: false, printouts: [], definition: null });
    expect(read?.period).toEqual({ from: "2026-10-20", to: "2027-10-19", decision: "OBD-2SALATEST2" });
  });

  it("does not tell the holder that a record waits for an approver, which is the staff's to read", () => {
    added.declared.add("OBD-2SALATEST2");
    pendingSala("RECONCILED_IN_FULL", "2026-10-16T09:30:00+07:00");
    expect(issueApproval(key, "OBD-2SALATEST2").data?.awaitsApprover).toBe(true);
    expect(getCertificate(key, THEN_CUA, "OBD-2SALATEST2").data?.record).toMatchObject({ state: "pending", waitingOn: [] });
    expect(premisesStatusRecords(key, THEN_CUA, "sala", null).data?.pending[0]?.waitingOn).toEqual([]);
  });

  it("prints nothing of a record waiting to issue, which holds no reference", () => {
    pendingSala("PENDING");
    expect(createRepresentation(key, THEN_CUA, "OBD-2SALATEST2").failure?.code).toBe("CERTIFICATE_NOT_FOUND");
    expect(getCertificate(key, THEN_CUA, "OBD-2NOSUCHONE2").failure?.code).toBe("CERTIFICATE_NOT_FOUND");
  });
});

describe("SEC-434 through PTY: a premises actor acts within her authority", () => {
  it("@AC-FR-CER-003-02 the principal and the delegate within her delegation read the same record", () => {
    const delegate = signInBeside(key, PEOPLE.delegate);
    const principal = getCertificate(key, THEN_CUA, NGUYEN_HUE).data?.record;
    const hers = getCertificate(delegate, THEN_CUA, NGUYEN_HUE).data?.record;
    expect(hers).toMatchObject({ reference: NGUYEN_HUE, state: "active", current: true, premisesId: "nh" });
    expect(hers?.definition).toEqual(principal?.definition);
    expect(hers?.period).toEqual(principal?.period);
    expect(premisesStatusRecords(delegate, THEN_CUA, "nh", null).data?.records.map((record) => record.reference)).toEqual([NGUYEN_HUE]);
    expect(createRepresentation(delegate, THEN_CUA, NGUYEN_HUE).failure).toBeNull();
  });

  it("refuses the delegate the records of a premises outside her delegation, to list, read, print and open", () => {
    const delegate = signInBeside(key, PEOPLE.delegate);
    expect(premisesStatusRecords(delegate, THEN_CUA, "pasteur", null).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    const read = getCertificate(delegate, THEN_CUA, PASTEUR);
    expect(read.failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(read.data).toBeNull();
    expect(createRepresentation(delegate, THEN_CUA, PASTEUR).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    const printout = createRepresentation(key, THEN_CUA, PASTEUR).data?.printout ?? "";
    expect(getRepresentationDocument(delegate, THEN_CUA, PASTEUR, printout).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(getRepresentationDocument(key, THEN_CUA, PASTEUR, printout).data?.printout).toBe(printout);
  });

  it("refuses a delegate whose authority was revoked every premises of the party", () => {
    const revoked = signInBeside(key, PEOPLE.revokedDelegate);
    expect(getCertificate(revoked, THEN_CUA, NGUYEN_HUE).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(premisesStatusRecords(revoked, THEN_CUA, "nh", null).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(holderPremises(revoked)).toEqual([]);
  });

  it("offers each person, when no premises is named, the premises PTY answers they may read the records of", () => {
    expect(holderPremises(key).map((premises) => premises.id)).toEqual(expect.arrayContaining(["pasteur", "nh", "sala"]));
    expect(holderPremises(signInBeside(key, PEOPLE.delegate))).toEqual([{ id: "nh", name: "Then Cửa Coffee & Tea – Nguyễn Huệ", register: "PRM-3NHZ6PKW" }]);
    // A premises named by its register record lists as when named by REG's id.
    expect(premisesStatusRecords(key, THEN_CUA, "PRM-5PSR9VJA", null).data).toMatchObject({ premisesId: "pasteur", register: "PRM-5PSR9VJA" });
  });
});

describe("FR-CER-010 and FR-CER-024: a renewal adds a linked period, and the past stays as it was", () => {
  const RENEWAL = "OBD-2RENEWAL22";

  it("@AC-FR-CER-024-01 the renewal period names the decision it renews and the period before it, which stays unchanged", () => {
    at("2027-08-25T09:00:00+07:00");
    decide(RENEWAL, PASTEUR_PREMISES, { from: "2027-09-18", to: "2028-09-17" }, { issuedAt: "2027-08-25T08:30:00+07:00", prior: PASTEUR_DECISION });
    pay(RENEWAL, "RECONCILED_IN_FULL", "2027-08-25T08:45:00+07:00");
    const periods = recordHistory(key, PASTEUR).data?.periods ?? [];
    expect(periods[0]).toMatchObject({ decision: PASTEUR_DECISION, cause: "ISSUE", to: null, follows: null });
    expect(periods[1]).toMatchObject({ decision: RENEWAL, cause: "RENEWAL", follows: { decision: PASTEUR_DECISION, from: "2026-09-18", to: "2027-09-17" } });
    expect(getCertificate(key, THEN_CUA, PASTEUR).data?.record.reference).toBe(PASTEUR);
  });

  it("@AC-FR-CER-010-02 a renewal after the record lapsed adds a period with the gap visible, and no second lapse", () => {
    at("2027-10-20T09:00:00+07:00");
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("EXPIRED");
    decide(RENEWAL, PASTEUR_PREMISES, { from: "2027-11-01", to: "2028-10-31" }, { issuedAt: "2027-10-20T08:00:00+07:00", prior: PASTEUR_DECISION });
    pay(RENEWAL, "RECONCILED_IN_FULL", "2027-10-20T08:30:00+07:00");
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("EXPIRED");
    expect(certificateForDecision(key, RENEWAL)).toBe(PASTEUR);
    at("2027-11-01T00:05:00+07:00");
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("ACTIVE");
    const changes = recordHistory(key, PASTEUR).data?.changes ?? [];
    expect(changes.filter((change) => change.to === "EXPIRED")).toHaveLength(1);
    const back = changes.find((change) => change.from === "EXPIRED" && change.to === "ACTIVE");
    expect(Date.parse(back?.effectiveAt ?? "")).toBe(Date.parse("2027-11-01T00:00:00+07:00"));
    expect(back?.authority).toEqual({ kind: "PERIOD", decision: RENEWAL });
  });

  it("@AC-FR-CER-010-06 a renewal of a record that lapsed while suspended adds the period and leaves the suspension standing", () => {
    expect(decideReview(key, APPROVER, "CSR-4TN7QK2MVD", { decision: "APPROVE", reason: "" }).failure).toBeNull();
    at("2027-10-20T09:00:00+07:00");
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("EXPIRED");
    decide(RENEWAL, PASTEUR_PREMISES, { from: "2027-11-01", to: "2028-10-31" }, { issuedAt: "2027-10-20T08:00:00+07:00", prior: PASTEUR_DECISION });
    pay(RENEWAL, "RECONCILED_IN_FULL", "2027-10-20T08:30:00+07:00");
    expect(certificateForDecision(key, RENEWAL)).toBe(PASTEUR);
    at("2027-11-01T00:05:00+07:00");
    expect(consoleRecord(key, PASTEUR).data?.status).toBe("SUSPENDED");
    expect(getCertificate(key, THEN_CUA, PASTEUR).data?.record.standing).toMatchObject({ kind: "suspended", ground: "GR-PAYMENT-REVERSED", condition: "RC-SETTLED" });
  });

  it("places REG's renewal of the holder's decision on the record that decision governs, and its approval adds the linked period", async () => {
    const reg = await import("@/lib/mock/backend/registration");
    const total = () => consoleRecordList(key, { status: null, premises: null, waiting: false }, null).data?.total;
    const before = total();
    const started = reg.startApplication(key, { premisesId: "nh", kind: "RENEWAL", prior: "OBD-8KWT2PZH6M", cause: null, from: "2027-09-24", to: "2028-09-22" });
    const application = started.accepted?.application ?? "";
    const step = reg.factsStep(key, application).data;
    const facts: Readonly<Record<string, string>> = { customer_area: "64", days_open: "7", music_method: "speakers", use_began_on: "2026-09-01", premises_class: "cafe" };
    const values = Object.fromEntries((step?.questions ?? []).filter((question) => facts[question] !== undefined).map((question) => [question, facts[question]]));
    expect(reg.declareFacts(key, application, { values, reconfirmed: Object.keys(step?.copied ?? {}) as never[] }).refusal).toBeNull();
    for (const item of ["USE_START_PROOF", "LEASE"]) reg.addEvidenceItem(key, application, `rules:${item}`, { name: "giay-to.pdf", type: "application/pdf", sizeBytes: 120_000 });
    reg.previewApplication(key, application);
    const shown = reg.attestationStep(key, THEN_CUA, application).data?.shown;
    const sent = reg.attestAndSubmit(key, application, { presentation: shown?.presentation ?? "", factsDigest: shown?.factsDigest ?? "", confirmed: true, changeDutyAcknowledged: true });
    expect(sent.accepted?.status).toBe("DECIDED");
    const decided = reg.decisionList(key, "nh").data?.items.find((item) => item.period.from === "2027-09-24")?.reference ?? "";
    expect(consoleRecord(key, NGUYEN_HUE).data?.renewal).toMatchObject({ decision: decided, assessment: { unmet: ["PAYMENT_PENDING"] } });
    pay(decided, "RECONCILED_IN_FULL", "2026-10-16T10:30:00+07:00");
    at("2026-10-16T10:40:00+07:00");
    expect(issueApproval(key, NGUYEN_HUE).data).toMatchObject({ awaitsApprover: true, renewal: { record: NGUYEN_HUE }, decision: decided });
    expect(decideIssue(key, APPROVER, NGUYEN_HUE, { decision: "APPROVE", reason: "Lớp cơ sở đã khai, phí đã trả", evidence: [] }).data?.renewed).toEqual({ from: "2027-09-24", to: "2028-09-22" });
    expect(recordHistory(key, NGUYEN_HUE).data?.periods.at(-1)).toMatchObject({ decision: decided, cause: "RENEWAL", follows: { decision: "OBD-8KWT2PZH6M", from: "2026-09-24", to: "2027-09-23" } });
    expect(certificateForDecision(key, decided)).toBe(NGUYEN_HUE);
    expect(total()).toBe(before);
  });
});

describe("GOV's definitions and policy versions, each as it was in force", () => {
  it("@AC-FR-CER-019-02 a later definition does not rewrite an issued record, and a record issued under it carries its texts", () => {
    laterDefinition({ id: "SRD-2027.1", version: "2027.1", effectiveFrom: "2027-01-01", legalEffect: { vi: "Giá trị pháp lý theo mẫu mới", en: "The new definition's effect" } });
    at("2027-01-02T09:00:00+07:00");
    expect(getCertificate(key, THEN_CUA, PASTEUR).data?.record.definition?.id).toBe("SRD-2026.1");
    decide("OBD-2SALATEST2", SALA, { from: "2027-01-02", to: "2027-12-31" }, { issuedAt: "2027-01-02T08:00:00+07:00", outcome: "NO_PAYABLE_OBLIGATION" });
    const ref = certificateForDecision(key, "OBD-2SALATEST2") ?? "";
    expect(consoleRecord(key, ref).data?.definition).toMatchObject({ id: "SRD-2027.1", legalEffect: { en: "The new definition's effect" } });
  });

  it("@AC-FR-CER-015-02 a definition whose validity reaches past the decision leaves the record pending", () => {
    laterDefinition({ id: "SRD-2027.1", version: "2027.1", effectiveFrom: "2027-01-01", validityMonths: 24 });
    at("2027-01-02T09:00:00+07:00");
    decide("OBD-2SALATEST2", SALA, { from: "2027-01-02", to: "2027-12-31" }, { issuedAt: "2027-01-02T08:00:00+07:00", outcome: "NO_PAYABLE_OBLIGATION" });
    expect(consoleRecord(key, "OBD-2SALATEST2").data?.assessment?.unmet).toEqual(["PERIOD_EXCEEDS_DECISION"]);
    expect(certificateForDecision(key, "OBD-2SALATEST2")).toBeNull();
  });

  it("@AC-FR-CER-015-04 a validity rule shorter than the decision governs the record's period", () => {
    laterDefinition({ id: "SRD-2027.1", version: "2027.1", effectiveFrom: "2027-01-01", validityMonths: 6 });
    at("2027-01-02T09:00:00+07:00");
    decide("OBD-2SALATEST2", SALA, { from: "2027-01-02", to: "2027-12-31" }, { issuedAt: "2027-01-02T08:00:00+07:00", outcome: "NO_PAYABLE_OBLIGATION" });
    const ref = certificateForDecision(key, "OBD-2SALATEST2") ?? "";
    expect(consoleRecord(key, ref).data?.period).toEqual({ from: "2027-01-02", to: "2027-07-01" });
    expect(consoleRecord(key, ref).data?.definition?.id).toBe("SRD-2027.1");
  });

  it("@AC-FR-CER-025-02 a draft policy version answers no ground: only the version in force is read", () => {
    const lateGround = { code: "GR-LATE-PAYMENT", acts: ["SUSPEND"], condition: null } as unknown as SeedPolicyVersion["grounds"][number];
    policyVersion({ version: "2", effective: "2026-10-01", state: "DRAFT", grounds: [lateGround] });
    const answer = proposeChange(key, OFFICER, {
      record: NGUYEN_HUE,
      review: null,
      act: "SUSPEND",
      ground: "GR-LATE-PAYMENT",
      reason: "Trả phí muộn",
      evidence: ["FIN-EV-9005"],
      effectiveAt: null,
      conditions: [],
    });
    expect(answer.failure?.code).toBe("GROUND_NOT_IN_POLICY");
    expect(reviewList(key, "ALL").data?.rows.some((row) => row.record.reference === NGUYEN_HUE)).toBe(false);
    expect(proposalForm(key, NGUYEN_HUE, null).data?.policy?.version).toBe("1");
  });

  it("@AC-FR-CER-013-05 a ground withdrawn from the policy before the decision cannot be applied", () => {
    const proposed = proposeChange(key, OFFICER, {
      record: NGUYEN_HUE,
      review: null,
      act: "SUSPEND",
      ground: "GR-FALSE-FACT",
      reason: "Diện tích khai thấp hơn thực tế",
      evidence: ["INS-2026-0042"],
      effectiveAt: null,
      conditions: [],
    });
    const first = seeded.original.policies[0] as SeedPolicyVersion;
    policyVersion({ version: "2", effective: "2026-10-17", grounds: first.grounds.filter((ground) => ground.code !== "GR-FALSE-FACT") });
    at("2026-10-18T09:00:00+07:00");
    expect(decideReview(key, APPROVER, proposed.data?.review ?? "", { decision: "APPROVE", reason: "" }).failure?.code).toBe("GROUND_NOT_IN_POLICY");
    expect(consoleRecord(key, NGUYEN_HUE).data?.status).toBe("ACTIVE");
  });

  it("records on the change the version in force at the decision, which the proposal's version gave way to", () => {
    const proposed = proposeChange(key, OFFICER, {
      record: NGUYEN_HUE,
      review: null,
      act: "SUSPEND",
      ground: "GR-PAYMENT-REVERSED",
      reason: "Khoản phí bị đòi lại",
      evidence: ["FIN-EV-9006"],
      effectiveAt: null,
      conditions: [],
    });
    expect(reviewPage(key, APPROVER, proposed.data?.review ?? "").data?.proposal?.policyVersion).toBe("1");
    policyVersion({ version: "2", effective: "2026-10-17" });
    at("2026-10-18T09:00:00+07:00");
    expect(decideReview(key, APPROVER, proposed.data?.review ?? "", { decision: "APPROVE", reason: "" }).failure).toBeNull();
    expect(consoleRecord(key, NGUYEN_HUE).data?.lastChange).toMatchObject({ kind: "status", to: "SUSPENDED", policyVersion: "2" });
  });
});

describe("DR-437: the conclusion a review reports to the family whose event opened it", () => {
  it("reports no conclusion after a decline, and one once a proposal of no change is approved", () => {
    const review = openStatusReview(key, NGUYEN_HUE, { kind: "PAYMENT_REVERSAL", event: "FIN-EV-9004", at: "2026-10-16T09:30:00+07:00" }) ?? "";
    expect(statusReviewState(key, review)).toMatchObject({ state: "OPEN", proposedAt: null, act: null, closedAt: null });
    const noChange = { record: NGUYEN_HUE, review, act: "NO_CHANGE" as const, ground: null, reason: "Ngân hàng đã trả lại khoản phí", evidence: [], effectiveAt: null, conditions: [] };
    expect(proposeChange(key, OFFICER, noChange).failure).toBeNull();
    expect(statusReviewState(key, review)?.state).toBe("PROPOSED");
    expect(decideReview(key, APPROVER, review, { decision: "DECLINE", reason: "Cần chứng từ của ngân hàng" }).failure).toBeNull();
    expect(statusReviewState(key, review)).toMatchObject({ state: "OPEN", act: null, closedAt: null });
    expect(proposeChange(key, OFFICER, { ...noChange, evidence: ["BNK-2026-7781"] }).failure).toBeNull();
    expect(decideReview(key, APPROVER, review, { decision: "APPROVE", reason: "" }).failure).toBeNull();
    const concluded = statusReviewState(key, review);
    expect(concluded).toMatchObject({ state: "APPROVED", act: "NO_CHANGE", effectiveAt: null });
    expect(concluded?.closedAt).not.toBeNull();
    expect(consoleRecord(key, NGUYEN_HUE).data?.status).toBe("ACTIVE");
  });

  it("refuses the approval of a proposal to the officer who made it, whatever else they hold (SEC-430)", () => {
    const review = openStatusReview(key, NGUYEN_HUE, { kind: "PAYMENT_REVERSAL", event: "FIN-EV-9007", at: "2026-10-16T09:30:00+07:00" }) ?? "";
    const both: Actor = { ...OFFICER, roles: ["ACT-OPS", "ACT-BIZ-APR"] };
    proposeChange(key, both, { record: NGUYEN_HUE, review, act: "NO_CHANGE", ground: null, reason: "Không cần thay đổi", evidence: [], effectiveAt: null, conditions: [] });
    expect(decideReview(key, both, review, { decision: "APPROVE", reason: "" }).failure?.code).toBe("SEGREGATION_REQUIRED");
    expect(statusReviewState(key, review)?.state).toBe("PROPOSED");
  });
});

describe("SCR-CER-10: the signing keys", () => {
  const jwkOn = (curve: "P-256" | "P-384") => JSON.stringify(generateKeyPairSync("ec", { namedCurve: curve }).publicKey.export({ format: "jwk" }));
  const keyOf = (kid: string, validFrom = "2026-10-16T10:00:00+07:00") => ({ kid, handle: `kms://r1/cert/${kid}`, jwk: jwkOn("P-256"), validFrom });

  it("@AC-FR-CER-021-02 a retired key still verifies what it signed, and the key that signs next signs the next printout", () => {
    const printout = createRepresentation(key, null, PASTEUR).data?.printout ?? "";
    expect(registerKey(key, SECURITY, keyOf("CK-2026-02")).failure).toBeNull();
    at("2026-10-16T10:05:00+07:00");
    expect(retireKey(key, SECURITY, "CK-2026-01").failure).toBeNull();
    const published = verificationKeysAt(key, "2026-10-16T10:06:00+07:00").find((entry) => entry.kid === "CK-2026-01");
    expect(published?.retiredAt).not.toBeNull();
    const code = signedCodeOf(key, printout);
    const publicKey = createPublicKey({ key: published?.publicKeyJwk ?? {}, format: "jwk" });
    expect(verify("sha256", Buffer.from(code?.payload ?? "", "base64url"), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(code?.signature ?? "", "base64url"))).toBe(true);
    const next = createRepresentation(key, null, PASTEUR).data?.printout ?? "";
    expect(signedCodeOf(key, next)?.keyId).toBe("CK-2026-02");
  });

  it("@AC-FR-CER-021-05 retiring the only key that signs is refused, and the key stays active", () => {
    expect(retireKey(key, SECURITY, "CK-2026-01").failure?.code).toBe("LAST_SIGNING_KEY");
    expect(createRepresentation(key, null, PASTEUR).failure).toBeNull();
  });

  it("@AC-FR-CER-021-06 a key id already registered is not registered again", () => {
    expect(registerKey(key, SECURITY, keyOf("CK-2026-01")).failure?.code).toBe("KID_EXISTS");
  });

  it("@AC-FR-CER-021-07 a public key that is not on P-256 is not registered", () => {
    const answer = registerKey(key, SECURITY, { ...keyOf("CK-2029-01"), jwk: jwkOn("P-384") });
    expect(answer.failure?.code).toBe("KEY_INVALID");
    expect(verificationKeysAt(key, "2026-10-16T10:00:00+07:00").some((entry) => entry.kid === "CK-2029-01")).toBe(false);
  });

  it("@AC-FR-CER-021-08 a key cannot sign from an instant already past", () => {
    expect(registerKey(key, SECURITY, keyOf("CK-2029-01", "2026-10-01T00:00:00+07:00")).failure?.code).toBe("VALID_FROM_IN_PAST");
  });

  it("@AC-FR-CER-021-09 a key id nobody holds is not retired", () => {
    expect(retireKey(key, SECURITY, "CK-1999-99").failure?.code).toBe("KEY_NOT_FOUND");
  });

  it("@AC-FR-CER-021-10 a key that no longer signs is not retired again", () => {
    registerKey(key, SECURITY, keyOf("CK-2026-02"));
    retireKey(key, SECURITY, "CK-2026-01");
    const retiredAt = verificationKeysAt(key, "2026-10-16T10:00:00+07:00").find((entry) => entry.kid === "CK-2026-01")?.retiredAt;
    at("2026-10-16T11:00:00+07:00");
    expect(retireKey(key, SECURITY, "CK-2026-01").failure?.code).toBe("KEY_NOT_ACTIVE");
    expect(verificationKeysAt(key, "2026-10-16T11:00:00+07:00").find((entry) => entry.kid === "CK-2026-01")?.retiredAt).toBe(retiredAt);
  });

  it("refuses key management to anyone but the security officer", () => {
    expect(registerKey(key, OFFICER, keyOf("CK-2026-02")).failure?.code).toBe("NOT_AUTHORISED");
    expect(retireKey(key, APPROVER, "CK-2026-01").failure?.code).toBe("NOT_AUTHORISED");
    expect(revokeKey(key, OFFICER, "CK-2026-01", "Thử").failure?.code).toBe("NOT_AUTHORISED");
  });
});
