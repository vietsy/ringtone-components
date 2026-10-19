import { afterEach, describe, expect, it, vi } from "vitest";
import { findAccount } from "@/lib/mock/backend/accounts";
import {
  applyHeldAmount,
  applyOutstandingConsequence,
  authorisePayment,
  closeCorrection,
  corrections,
  decideRefund,
  invoiceList,
  invoiceRead,
  outstandingAmounts,
  payInstructionByCard,
  paymentConditionFor,
  paymentPosition,
  payObligation,
  proposeWriteOff,
  approveWriteOff,
  recordChargeback,
  recordCorrection,
  recordRefund,
  sendRefund,
  settlementOf,
  suspense,
  writeOff,
  type FinanceActor,
} from "@/lib/mock/backend/finance";
import type * as Cases from "@/lib/mock/backend/cases";
import { noticesTo } from "@/lib/mock/backend/notices";
import type * as Registration from "@/lib/mock/backend/registration";
import { decideReview } from "@/lib/mock/backend/status-records";
import { PEOPLE, signIn, signInBeside } from "./harness";

/**
 * REG and CAS answer FIN through their contract reads. Some of the behaviours below need an answer the seed never
 * gives - a decision REG replaces after its fee was authorised, one whose fee REG splits again between the rights
 * layers at the same total, a case decided with a refund of a payment - so the test gives it in their place, through
 * the same reads, and leaves every other answer theirs.
 */
const replaced = new Map<string, { reference: string; from: string }>();
const resplit = new Set<string>();
const decidedCases = new Map<string, string>();

/** The decision's lines with 1,000 VND moved from the authors' layer to the performers': the same fee, split otherwise. */
function moved<T extends { layer: string; amountMinor: number }>(lines: readonly T[]): T[] {
  const from = lines.findIndex((line) => line.layer === "AUTHORS" && line.amountMinor > 1000);
  const to = lines.findIndex((line) => line.layer === "PERFORMERS");
  return lines.map((line, index) => (index === from ? { ...line, amountMinor: line.amountMinor - 1000 } : index === to ? { ...line, amountMinor: line.amountMinor + 1000 } : line));
}

vi.mock("@/lib/mock/backend/registration", async (importOriginal) => {
  const actual = await importOriginal<typeof Registration>();
  return {
    ...actual,
    decisionForCollection: (key: string, ref: string) => {
      const found = actual.decisionForCollection(key, ref);
      if (found === null) return null;
      const by = replaced.get(ref);
      if (by !== undefined) {
        return { summary: { ...found.summary, status: "SUPERSEDED" as const, replacedBy: by }, record: { ...found.record, status: "SUPERSEDED" as const, replacedBy: by } };
      }
      return resplit.has(ref) ? { summary: found.summary, record: { ...found.record, lines: moved(found.record.lines) } } : found;
    },
  };
});

vi.mock("@/lib/mock/backend/cases", async (importOriginal) => {
  const actual = await importOriginal<typeof Cases>();
  return {
    ...actual,
    caseRemedyFor: (key: string, reference: string) => {
      const subject = decidedCases.get(reference);
      return subject !== undefined
        ? { reference, state: "DECIDED" as const, decided: true, requires: ["refund" as const], subject }
        : actual.caseRemedyFor(key, reference);
    },
  };
});

const PASTEUR = "OBD-3FJW6NRA5C";
const NGUYEN_HUE = "OBD-8KWT2PZH6M";
const PASTEUR_OWED = "OUT-3RVD8MKW5T";

/** The member of staff a session names, as the seam hands them to the backend. */
function actorOf(email: string): FinanceActor {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { name: account.name, email: account.email, roles: account.staffRoles };
}

const officer = actorOf(PEOPLE.operations);
const approver = actorOf(PEOPLE.approver);

/** Moves the clock the mock backend reads, leaving timers alone. */
function at(instant: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

afterEach(() => {
  vi.useRealTimers();
  replaced.clear();
  resplit.clear();
  decidedCases.clear();
  delete process.env.MOCK_BANK_SETTLE_SECONDS;
  delete process.env.MOCK_BANK_DUPLICATE_TRANSFER;
  delete process.env.MOCK_CARD_SETTLE_SECONDS;
  delete process.env.MOCK_EINVOICE_UNAVAILABLE;
});

/** The fee Pasteur's decision carries now, as SCR-FIN-01 reads it. */
function pasteurFee(key: string): number {
  return (payObligation(key, PASTEUR).data?.decision.components ?? []).reduce((sum, component) => sum + component.amountMinor, 0);
}

/** The principal authorises Pasteur's fee again and pays it by card; the payment's reference. */
function paidByCard(key: string): string {
  expect(authorisePayment(key, PASTEUR).failure).toBeNull();
  const paid = payInstructionByCard(key, PASTEUR);
  if (paid.data === null) throw new Error(`not paid: ${JSON.stringify(paid.failure)}`);
  return paid.data.payment;
}

describe("authorising payment (SCR-FIN-01)", () => {
  it("creates one instruction for the fee the decision carries, and refuses the repeat", () => {
    const key = signIn(PEOPLE.principal);
    const answer = authorisePayment(key, PASTEUR);
    expect(answer.failure).toBeNull();
    const read = payObligation(key, PASTEUR).data;
    const fee = (read?.decision.components ?? []).reduce((sum, component) => sum + component.amountMinor, 0);
    expect(fee).toBeGreaterThan(0);
    expect(read?.instruction?.reference).toBe(answer.data?.instruction);
    // The bank's code carries the amount the authorisation covered (EMVCo tag 54).
    expect(read?.instruction?.qrPayload).toContain(`54${String(String(fee).length).padStart(2, "0")}${fee}`);
    expect(authorisePayment(key, PASTEUR).failure?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
  });

  it("refuses a delegate whose authority does not cover payment with FIN_PAYMENT_NOT_AUTHORISED, by card too", () => {
    const principal = signIn(PEOPLE.principal);
    const delegate = signInBeside(principal, PEOPLE.delegate, "tcv");
    expect(authorisePayment(delegate, NGUYEN_HUE).failure?.code).toBe("FIN_PAYMENT_NOT_AUTHORISED");
    expect(payInstructionByCard(delegate, NGUYEN_HUE).failure?.code).toBe("FIN_PAYMENT_NOT_AUTHORISED");
  });

  it("lets a delegate read only the premises her authority reaches, and a revoked delegate nothing", () => {
    const principal = signIn(PEOPLE.principal);
    const delegate = signInBeside(principal, PEOPLE.delegate, "tcv");
    expect(payObligation(delegate, PASTEUR).failure?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
    expect(paymentPosition(delegate, PASTEUR).failure?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
    const premises = new Set(invoiceList(delegate).data?.invoices.map((invoice) => invoice.premises));
    expect([...premises]).toEqual(["Then Cửa Coffee & Tea – Nguyễn Huệ"]);
    const revoked = signInBeside(principal, PEOPLE.revokedDelegate, "tcv");
    expect(invoiceList(revoked).failure?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
  });

  it("invalidates an open instruction once REG replaces its decision, so the transfer never settles it", () => {
    at("2026-10-16T09:00:00+07:00");
    const key = signIn(PEOPLE.principal);
    expect(authorisePayment(key, PASTEUR).failure).toBeNull();
    replaced.set(PASTEUR, { reference: "OBD-7RPL4CEM2T", from: "2026-10-16" });
    // Well past the moment the mock bank's transfer would have arrived.
    at("2026-10-16T09:05:00+07:00");
    expect(payObligation(key, PASTEUR).data?.refusal?.code).toBe("FIN_DECISION_NOT_CURRENT");
    expect(payInstructionByCard(key, PASTEUR).failure?.code).toBe("FIN_DECISION_NOT_CURRENT");
    expect(settlementOf(key, PASTEUR)).toBeNull();
  });

  it("@AC-FR-FIN-003-01 invalidates an instruction still unpaid after its last day, and Authorise again makes a new one", () => {
    // No transfer arrives under the instruction while it is valid.
    process.env.MOCK_BANK_SETTLE_SECONDS = "100000000";
    at("2026-10-16T09:00:00+07:00");
    const key = signIn(PEOPLE.principal);
    const first = authorisePayment(key, PASTEUR).data?.instruction;
    expect(payObligation(key, PASTEUR).data?.instruction).toMatchObject({ reference: first, state: "created", validTo: "2026-10-23" });
    at("2026-10-23T23:30:00+07:00");
    expect(payObligation(key, PASTEUR).data?.instruction?.state).toBe("created");
    at("2026-10-24T08:00:00+07:00");
    expect(payObligation(key, PASTEUR).data?.instruction).toMatchObject({ reference: first, state: "expired" });
    expect(payInstructionByCard(key, PASTEUR).failure?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
    const again = authorisePayment(key, PASTEUR).data?.instruction;
    expect(again).toBeDefined();
    expect(again).not.toBe(first);
  });

  it("@AC-FR-FIN-039-01 refuses to settle an instruction for components its decision no longer carries as covered, even at the same fee", () => {
    at("2026-10-16T09:00:00+07:00");
    const key = signIn(PEOPLE.principal);
    const fee = pasteurFee(key);
    const first = authorisePayment(key, PASTEUR).data?.instruction;
    resplit.add(PASTEUR);
    // Past the moment the mock bank's transfer would have arrived.
    at("2026-10-16T09:05:00+07:00");
    expect(pasteurFee(key)).toBe(fee);
    expect(payObligation(key, PASTEUR).data?.instruction).toMatchObject({ reference: first, state: "expired" });
    expect(settlementOf(key, PASTEUR)).toBeNull();
    expect(payInstructionByCard(key, PASTEUR).failure?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
    // Authorised again, the new instruction covers the components as the decision now splits them, and settles.
    expect(authorisePayment(key, PASTEUR).failure).toBeNull();
    const paid = payInstructionByCard(key, PASTEUR).data?.payment;
    expect(settlementOf(key, PASTEUR)?.payment).toBe(paid);
  });
});

describe("invoices (SCR-FIN-03)", () => {
  it("issues the invoice of a settled payment recording its payment, decision, components and collection authority", () => {
    const key = signIn(PEOPLE.principal);
    const payment = paidByCard(key);
    const listed = invoiceList(key).data?.invoices.find((invoice) => invoice.payment === payment);
    expect(listed?.decision).toBe(PASTEUR);
    const read = invoiceRead(key, `${listed?.series ?? ""}-${listed?.number ?? ""}`).data;
    if (read?.kind !== "issued") throw new Error("not issued");
    expect(read.invoice.payment).toBe(payment);
    expect(read.invoice.issuer).toBe("Lam Hồng");
    expect(read.invoice.components?.reduce((sum, component) => sum + component.amountMinor, 0)).toBe(read.invoice.amountMinor);
    expect(read.invoice.keptUntil).toBeNull();
  });

  it("keeps the original of a corrected invoice retrievable beside its corrective document", () => {
    const key = signIn(PEOPLE.principal);
    const original = invoiceRead(key, "1C26TRO-00000418").data;
    if (original?.kind !== "issued") throw new Error("not issued");
    expect(original.invoice.correction).toMatchObject({ number: "00000511", chargebackOn: "2026-09-30", case: null });
    const corrective = invoiceRead(key, "1C26TRO 00000511").data;
    if (corrective?.kind !== "issued") throw new Error("not issued");
    expect(corrective.invoice.corrects).toBe("00000418");
  });

  it("refuses an invoice of a premises the reader may not see", () => {
    const principal = signIn(PEOPLE.principal);
    const delegate = signInBeside(principal, PEOPLE.delegate, "tcv");
    expect(invoiceRead(delegate, "1C26TRO-00000418").failure?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
    expect(invoiceRead(delegate, "1C26TRO-00000431").data?.kind).toBe("issued");
    expect(invoiceRead(principal, "1C26TRO-99999999").failure?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
  });

  it("refuses the invoice of a card payment not settled yet with FIN_PAYMENT_NOT_SETTLED, and issues it once settled", () => {
    process.env.MOCK_CARD_SETTLE_SECONDS = "60";
    at("2026-10-16T09:00:00+07:00");
    const key = signIn(PEOPLE.principal);
    const payment = paidByCard(key);
    const unissued = invoiceRead(key, payment).data;
    if (unissued?.kind !== "unissued") throw new Error("issued too early");
    expect(unissued.invoice.reason).toBe("FIN_PAYMENT_NOT_SETTLED");
    expect(invoiceList(key).data?.pending.map((entry) => entry.payment)).toContain(payment);
    // Paid and settling: there is nothing left to pay meanwhile.
    expect(authorisePayment(key, PASTEUR).failure?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
    at("2026-10-16T09:01:01+07:00");
    expect(invoiceRead(key, payment).data?.kind).toBe("issued");
  });

  it("keeps the unissued position while the e-invoice service is down, and issues it when the service is back", () => {
    process.env.MOCK_EINVOICE_UNAVAILABLE = "1";
    const key = signIn(PEOPLE.principal);
    const payment = paidByCard(key);
    const unissued = invoiceRead(key, payment).data;
    if (unissued?.kind !== "unissued") throw new Error("issued while the service was down");
    expect(unissued.invoice.reason).toBe("FIN_EINVOICE_UNAVAILABLE");
    expect(unissued.invoice.payment.reconciledAt).not.toBeNull();
    expect(paymentPosition(key, PASTEUR).data?.checks.some((check) => check.check === "invoice-unavailable")).toBe(true);
    // The payment stands while the invoice waits: CER sees the fee settled.
    expect(settlementOf(key, PASTEUR)?.payment).toBe(payment);
    delete process.env.MOCK_EINVOICE_UNAVAILABLE;
    const issued = invoiceRead(key, payment).data;
    expect(issued?.kind).toBe("issued");
    expect(invoiceList(key).data?.pending).toEqual([]);
  });
});

describe("corrections and the owning service's review (SCR-FIN-10)", () => {
  it("opens CER's review on a chargeback, and keeps the correction open while it runs", () => {
    const key = signIn(PEOPLE.principal);
    const payment = paidByCard(key);
    const staff = signInBeside(key, PEOPLE.operations);
    const charged = recordChargeback(staff, officer, { payment, evidence: "FIN-EV-4120", amountMinor: 986000 });
    const correction = charged.accepted?.correction ?? "";
    expect(recordCorrection(staff, officer, correction).accepted?.state).toBe("OWNING_REVIEW_OPEN");
    const detail = corrections(staff, officer, correction).data?.selected;
    expect(detail?.review?.reference).toMatch(/^CSR-/);
    expect(closeCorrection(staff, officer, correction).refusal?.code).toBe("FIN_OWNING_REVIEW_OPEN");
  });

  it("agrees the Pasteur correction once CER's review is approved, so it can close", () => {
    const key = signIn(PEOPLE.operations);
    const reviewer = signInBeside(key, PEOPLE.approver);
    const decided = decideReview(reviewer, { name: approver.name, position: "", roles: approver.roles }, "CSR-4TN7QK2MVD", { decision: "APPROVE", reason: "" });
    expect(decided.failure).toBeNull();
    expect(corrections(key, officer, "COR-7MXK2PVT9D").data?.selected?.state).toBe("AGREED");
    expect(closeCorrection(key, officer, "COR-7MXK2PVT9D").accepted?.closedOn).not.toBeNull();
  });

  it("@AC-FR-FIN-076-01 keeps the original payment and its invoice as recorded when a chargeback's consequences are determined", () => {
    const key = signIn(PEOPLE.principal);
    const payment = paidByCard(key);
    const fee = pasteurFee(key);
    const invoice = invoiceList(key).data?.invoices.find((entry) => entry.payment === payment);
    if (invoice === undefined) throw new Error("not invoiced");
    const before = paymentPosition(key, PASTEUR).data;
    const staff = signInBeside(key, PEOPLE.operations);
    const correction = recordChargeback(staff, officer, { payment, evidence: "FIN-EV-4121", amountMinor: fee }).accepted?.correction ?? "";
    expect(recordCorrection(staff, officer, correction).accepted).not.toBeNull();
    const detail = corrections(staff, officer, correction).data?.selected;
    const received = before?.checks.find((check) => check.check === "received");
    expect(detail?.original).toMatchObject({ method: "card", amountMinor: fee, paidAt: received?.check === "received" ? received.at : "" });
    expect(detail?.original.reconciledAt).not.toBeNull();
    // The original invoice is kept as issued, beside the corrective document that reverses it.
    const original = invoiceRead(key, `${invoice.series} ${invoice.number}`).data;
    if (original?.kind !== "issued") throw new Error("original not retrievable");
    expect(original.invoice.amountMinor).toBe(fee);
    const corrective = detail?.consequences.invoice;
    expect(corrective !== null && corrective !== undefined && corrective.corrective !== null ? corrective.corrective : null).toBe(`${invoice.series} ${original.invoice.correction?.number ?? ""}`);
  });

  it("takes back a card payment not settled yet, cancelling the invoice it waited for", () => {
    process.env.MOCK_CARD_SETTLE_SECONDS = "600";
    at("2026-10-16T09:00:00+07:00");
    const key = signIn(PEOPLE.principal);
    const payment = paidByCard(key);
    const staff = signInBeside(key, PEOPLE.operations);
    expect(corrections(staff, officer, null).data?.payments.map((entry) => entry.reference)).toContain(payment);
    const correction = recordChargeback(staff, officer, { payment, evidence: "FIN-EV-5120", amountMinor: pasteurFee(key) }).accepted?.correction ?? "";
    expect(correction).toMatch(/^COR-/);
    // Past the moment the scheme would have settled it: the payment stays disputed, and no invoice is issued.
    at("2026-10-16T09:20:00+07:00");
    expect(paymentPosition(key, PASTEUR).data?.checks.some((check) => check.check === "invoice-cancelled")).toBe(true);
    expect(invoiceList(key).data?.invoices.some((entry) => entry.payment === payment)).toBe(false);
    expect(invoiceList(key).data?.pending).toEqual([]);
    expect(settlementOf(key, PASTEUR)).toBeNull();
    expect(paymentConditionFor(key, PASTEUR)).toBe("IN_SUSPENSE_OR_DISPUTED");
    expect(recordCorrection(staff, officer, correction).accepted).not.toBeNull();
    expect(corrections(staff, officer, correction).data?.selected?.consequences.invoice).toEqual({ corrective: null, stands: null });
    // A payment taken back is not taken back twice.
    expect(recordChargeback(staff, officer, { payment, evidence: "FIN-EV-5121", amountMinor: 1000 }).refusal?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
  });

  it("raises the exception naming the record and the event once the review is past its period, and refuses the close", () => {
    at("2026-10-16T09:00:00+07:00");
    const key = signIn(PEOPLE.operations);
    const detail = corrections(key, officer, "COR-7MXK2PVT9D").data?.selected;
    expect(detail?.exception).toMatchObject({ record: "R1-CER-2026-T7QM4BWJ", event: "FIN-EV-3114" });
    expect(closeCorrection(key, officer, "COR-7MXK2PVT9D").refusal?.code).toBe("FIN_OWNING_REVIEW_OVERDUE");
  });
});

describe("held amounts (SCR-FIN-04)", () => {
  /** A refund of Nguyễn Huệ's transfer recorded under a case decided with a refund; the correction's reference. */
  function refundSought(key: string): string {
    decidedCases.set("CAS-2026-0777", "PAY-2NVK6TXH8B");
    const answer = recordRefund(key, officer, { payment: "PAY-2NVK6TXH8B", caseRef: "CAS-2026-0777", amountMinor: 500000 });
    if (answer.accepted === null) throw new Error(`not recorded: ${JSON.stringify(answer.refusal)}`);
    return answer.accepted.correction;
  }

  it("holds the amount a refund seeks for its payer, with the ground the case relied on", () => {
    const key = signIn(PEOPLE.operations);
    const correction = refundSought(key);
    const detail = corrections(key, officer, correction).data?.selected;
    expect(detail?.held?.state).toBe("PROPOSED");
    expect(detail?.groundsReserved).toBe(true);
    const queue = suspense(key, officer).data;
    const held = queue?.rows.find((row) => row.reference === detail?.held?.reference);
    expect(held).toMatchObject({ reason: "REFUND_SOUGHT", payer: "Công ty TNHH Then Cửa Việt", amountMinor: 500000, groundsReserved: true });
    expect(queue?.grounds).toContainEqual(expect.objectContaining({ case: "CAS-2026-0777", held: detail?.held?.reference }));
  });

  it("refuses the refund's approval with FIN_GROUNDS_RESERVED while DEC-32 is not decided, and the amount stays held", () => {
    const key = signIn(PEOPLE.operations);
    const correction = refundSought(key);
    const reviewer = signInBeside(key, PEOPLE.approver);
    expect(decideRefund(reviewer, approver, correction, "approve", "").refusal?.code).toBe("FIN_GROUNDS_RESERVED");
    const detail = corrections(reviewer, approver, correction).data?.selected;
    expect(detail?.refund?.approval).toBeNull();
    expect(detail?.held?.state).toBe("PROPOSED");
  });

  it("releases the held amount back to its payment when the refund is declined", () => {
    const key = signIn(PEOPLE.operations);
    const correction = refundSought(key);
    const reviewer = signInBeside(key, PEOPLE.approver);
    expect(decideRefund(reviewer, approver, correction, "decline", "Không có căn cứ hoàn trả").accepted).not.toBeNull();
    const held = corrections(key, officer, correction).data?.selected?.held;
    expect(held?.state).toBe("RELEASED");
    expect(suspense(key, officer).data?.rows.some((row) => row.reference === held?.reference)).toBe(false);
  });

  it("refuses to apply an amount held under the reserved grounds to another obligation (FIN_GROUNDS_RESERVED)", () => {
    const key = signIn(PEOPLE.operations);
    expect(applyHeldAmount(key, officer, "HLD-8RKQ4WNC7T", "OBD-2RKD8MXT4Q").refusal?.code).toBe("FIN_GROUNDS_RESERVED");
    expect(suspense(key, officer).data?.rows.find((row) => row.reference === "HLD-8RKQ4WNC7T")?.state).toBe("HELD");
    const auditor = signIn(PEOPLE.supervisor);
    expect(applyHeldAmount(auditor, actorOf(PEOPLE.supervisor), "HLD-8RKQ4WNC7T", "OBD-2RKD8MXT4Q").refusal?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
  });

  it("lists the canvas's held amounts oldest first, the Áp Mái refund identified to its payer and reserved", () => {
    const key = signIn(PEOPLE.operations);
    const rows = suspense(key, officer).data?.rows ?? [];
    expect(rows.map((row) => row.reference)).toEqual(["HLD-6PMV2RTK9A", "HLD-3TWQ8KXN5F", "HLD-8RKQ4WNC7T"]);
    expect(rows[2]).toMatchObject({ payer: "Công ty TNHH Áp Mái", groundsReserved: true });
    expect(rows[1]?.groundsReserved).toBe(false);
  });
});

describe("a second payment of a fee already paid (FR-FIN-010)", () => {
  /**
   * The principal pays Pasteur's fee by card at 09:00 on 16 October, having sent its bank transfer as well; read at
   * 09:01, the transfer has arrived. The card payment's reference.
   */
  function paidTwice(key: string): string {
    process.env.MOCK_BANK_DUPLICATE_TRANSFER = "1";
    at("2026-10-16T09:00:00+07:00");
    const payment = paidByCard(key);
    at("2026-10-16T09:01:00+07:00");
    return payment;
  }

  /** The correction RightOne opened on the second payment. */
  function remedyOf(staff: string): string {
    const row = corrections(staff, officer, null).data?.rows.find((entry) => entry.kind === "duplicate");
    if (row === undefined) throw new Error("no remedy opened");
    return row.reference;
  }

  it("@AC-FR-FIN-010-01 holds the transfer that pays the fee again for its payer, with its return proposed, and confers nothing more", () => {
    const key = signIn(PEOPLE.principal);
    const payment = paidTwice(key);
    const position = paymentPosition(key, PASTEUR).data;
    expect(position).toMatchObject({ status: "held", condition: "duplicate", decision: PASTEUR, related: { relation: "already-paid-by", payment } });
    expect(position?.checks.map((check) => check.check)).toEqual(["received", "matched-as-duplicate", "refund-proposed"]);
    const second = position?.subject.reference ?? "";
    expect(second).toMatch(/^HLD-/);
    // No second entitlement: CER still reads the card payment, and nothing is invoiced or owed for the transfer.
    expect(settlementOf(key, PASTEUR)?.payment).toBe(payment);
    expect(paymentConditionFor(key, PASTEUR)).toBe("RECONCILED_IN_FULL");
    const invoices = invoiceList(key).data?.invoices ?? [];
    expect(invoices.filter((entry) => entry.payment === payment)).toHaveLength(1);
    expect(invoices.some((entry) => entry.payment === second)).toBe(false);
    expect(invoiceList(key).data?.pending).toEqual([]);
    const staff = signInBeside(key, PEOPLE.operations);
    const held = suspense(staff, officer).data?.rows.find((row) => row.reference === second);
    expect(held).toMatchObject({ reason: "DUPLICATE", state: "PROPOSED", payer: "Công ty TNHH Then Cửa Việt", groundsReserved: false, proposal: { kind: "return", by: "RightOne" } });
    const remedy = corrections(staff, officer, held?.correction ?? null).data?.selected;
    expect(remedy).toMatchObject({ kind: "duplicate", payment: second, state: "RAISED", duplicates: { payment }, refund: { preparer: "system", approval: null } });
  });

  it("pays the instruction once when the payer did not send the transfer as well", () => {
    const key = signIn(PEOPLE.principal);
    at("2026-10-16T09:00:00+07:00");
    const payment = paidByCard(key);
    at("2026-10-16T09:01:00+07:00");
    expect(paymentPosition(key, PASTEUR).data?.subject).toEqual({ kind: "payment", reference: payment });
    const staff = signInBeside(key, PEOPLE.operations);
    expect(corrections(staff, officer, null).data?.rows.some((row) => row.kind === "duplicate")).toBe(false);
  });

  it("@AC-FR-FIN-052-01 returns the second payment once, after a finance approver approves it, and leaves the fee's invoice standing", () => {
    const key = signIn(PEOPLE.principal);
    const payment = paidTwice(key);
    const invoice = invoiceList(key).data?.invoices.find((entry) => entry.payment === payment);
    const staff = signInBeside(key, PEOPLE.operations);
    const remedy = remedyOf(staff);
    expect(sendRefund(staff, officer, remedy).refusal?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
    const reviewer = signInBeside(key, PEOPLE.approver);
    // A return is not held back by the reserved grounds for refunds: it pays nothing.
    expect(decideRefund(reviewer, approver, remedy, "approve", "").accepted).not.toBeNull();
    expect(paymentPosition(key, PASTEUR).data?.checks.at(-1)?.check).toBe("refund-approved");
    expect(sendRefund(staff, officer, remedy).accepted).toEqual({ invoice: null });
    expect(sendRefund(staff, officer, remedy).refusal?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
    const detail = corrections(staff, officer, remedy).data?.selected;
    expect(detail?.state).toBe("AGREED");
    expect(detail?.consequences.invoice).toEqual({ corrective: null, stands: `${invoice?.series ?? ""} ${invoice?.number ?? ""}` });
    expect(detail?.held?.state).toBe("DISPOSED");
    expect(invoiceList(key).data?.invoices.find((entry) => entry.payment === payment)?.correctedBy).toBeNull();
    expect(closeCorrection(staff, officer, remedy).accepted).not.toBeNull();
    // Returned, the decision's position is the card payment that paid it again.
    expect(paymentPosition(key, PASTEUR).data?.subject).toEqual({ kind: "payment", reference: payment });
  });

  it("keeps the second payment held for its payer when a finance approver declines its return, and lets no one else decide it", () => {
    const key = signIn(PEOPLE.principal);
    paidTwice(key);
    const staff = signInBeside(key, PEOPLE.operations);
    const remedy = remedyOf(staff);
    // The finance officer is no approver.
    expect(decideRefund(staff, officer, remedy, "approve", "").refusal?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
    const reviewer = signInBeside(key, PEOPLE.approver);
    expect(decideRefund(reviewer, approver, remedy, "decline", "  ").refusal).toEqual({ code: "SRS_PAYLOAD_INVALID", field: "reason" });
    expect(decideRefund(reviewer, approver, remedy, "decline", "Chờ người trả xác nhận tài khoản nhận").accepted).not.toBeNull();
    const held = corrections(staff, officer, remedy).data?.selected?.held;
    expect(held?.state).toBe("HELD");
    expect(suspense(staff, officer).data?.rows.find((row) => row.reference === held?.reference)).toMatchObject({ state: "HELD", proposal: null });
    expect(paymentPosition(key, PASTEUR).data?.condition).toBe("duplicate");
  });
});

// COM seeds its world's notices up to the day read, which on a December day takes several seconds.
describe("amounts owed and write-offs (SCR-FIN-14, 15)", { timeout: 60_000 }, () => {
  /** Pasteur's fee, owed again after the chargeback and due on 14 December, read on 16 December: its amount's reference. */
  function outstandingAgain(key: string): string {
    at("2026-12-16T09:00:00+07:00");
    const row = outstandingAmounts(key, officer, { state: null, premises: null }, null).data?.rows.find((entry) => entry.reference === PASTEUR_OWED);
    expect(row?.state).toBe("OUTSTANDING");
    return PASTEUR_OWED;
  }

  it("lets the finance officer propose a write-off on any outstanding amount, which another approver then approves", () => {
    const key = signIn(PEOPLE.operations);
    const amount = outstandingAgain(key);
    expect(proposeWriteOff(key, officer, amount, "Khoản chênh nhỏ hơn chi phí thu hồi").accepted?.amount).toBe(amount);
    const reviewer = signInBeside(key, PEOPLE.approver);
    const read = writeOff(reviewer, approver, amount).data;
    expect(read).toMatchObject({ reader: "approver", decision: PASTEUR, received: null, leftMinor: 986000 });
    expect(read?.proposal.ground).toBe("Khoản chênh nhỏ hơn chi phí thu hồi");
    expect(read?.proposal.authority).not.toBeNull();
    expect(approveWriteOff(reviewer, approver, amount, "").accepted).not.toBeNull();
    expect(writeOff(reviewer, approver, amount).data?.state).toBe("WRITTEN_OFF");
  });

  it("refuses a write-off proposed again while one waits, on an amount not yet due, without a ground, or by an approver", () => {
    const key = signIn(PEOPLE.operations);
    expect(proposeWriteOff(key, officer, "OUT-7KXN3QDW2H", "Phí ngân hàng").refusal?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
    expect(proposeWriteOff(key, officer, "OUT-6ZPH2NXQ9C", "Phí ngân hàng").refusal?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
    const amount = outstandingAgain(key);
    expect(proposeWriteOff(key, officer, amount, "  ").refusal).toEqual({ code: "SRS_PAYLOAD_INVALID", field: "ground" });
    expect(proposeWriteOff(key, approver, amount, "Phí ngân hàng").refusal?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
  });

  it("@AC-FR-FIN-030-03 refuses a consequence beyond the notices on an outstanding amount with FIN_CONSEQUENCE_RESERVED", () => {
    const key = signIn(PEOPLE.operations);
    const amount = outstandingAgain(key);
    const reviewer = signInBeside(key, PEOPLE.approver);
    expect(outstandingAmounts(reviewer, approver, { state: null, premises: null }, null).data?.consequenceReserved).toBe(true);
    expect(applyOutstandingConsequence(reviewer, approver, amount).refusal?.code).toBe("FIN_CONSEQUENCE_RESERVED");
    // The amount stays outstanding with the notices sent, and nothing else applied.
    const row = outstandingAmounts(key, officer, { state: null, premises: null }, null).data?.rows.find((entry) => entry.reference === amount);
    expect(row).toMatchObject({ state: "OUTSTANDING", notices: { overdue: "2026-12-16" } });
    expect(applyOutstandingConsequence(key, officer, amount).refusal?.code).toBe("SRS_RESOURCE_NOT_ACCESSIBLE");
    // An amount not yet due has no consequence to follow.
    expect(applyOutstandingConsequence(reviewer, approver, "OUT-6ZPH2NXQ9C").refusal?.code).toBe("FIN_IDEMPOTENCY_CONFLICT");
  });

  it("marks an outstanding amount adjusted once a later decision replaces the one it was owed under", () => {
    const key = signIn(PEOPLE.operations);
    const amount = outstandingAgain(key);
    replaced.set(PASTEUR, { reference: "OBD-5ADJ8KQW2R", from: "2026-12-16" });
    const row = outstandingAmounts(key, officer, { state: null, premises: null }, null).data?.rows.find((entry) => entry.reference === amount);
    expect(row).toMatchObject({ state: "ADJUSTED", adjustedBy: { decision: "OBD-5ADJ8KQW2R", from: "2026-12-16" }, writeOffOpen: false });
  });

  it("raises the reminder ahead of the due date, which COM issues on its schedule and the amount shows", () => {
    at("2026-10-16T09:00:00+07:00");
    const key = signIn(PEOPLE.operations);
    const read = () => outstandingAmounts(key, officer, { state: null, premises: null }, null).data?.rows.find((entry) => entry.reference === PASTEUR_OWED);
    // COM's payment reminder falls due 30 days before the due date of 14 December.
    expect(read()?.notices.reminder).toBeNull();
    at("2026-11-15T09:00:00+07:00");
    expect(read()?.notices).toEqual({ reminder: "2026-11-15", overdue: null });
  });

  it("sends the premises the overdue notice through COM once, and shows the day it was issued", () => {
    const key = signIn(PEOPLE.operations);
    const amount = outstandingAgain(key);
    const read = () => outstandingAmounts(key, officer, { state: null, premises: null }, null).data?.rows.find((entry) => entry.reference === amount);
    expect(read()?.notices.overdue).toBe("2026-12-16");
    read();
    const sent = (noticesTo(key, "tcv").data ?? []).filter((notice) => notice.classCode === "outstanding_amount" && notice.content?.values.decision === PASTEUR);
    expect(sent.filter((notice) => notice.issuedAt !== null && notice.issuedAt >= "2026-12-16")).toHaveLength(1);
  });
});
