import type { LoadOutcome } from "@rightone/ui";
import type {
  DecisionToPay,
  InvoiceList,
  InvoiceNumber,
  InvoiceSummary,
  PaymentCheck,
  PaymentInstruction,
  PaymentMethod,
  PaymentPosition,
  PayObligation,
  PayRefusal,
} from "@/lib/api/finance";
import { COLLECTION_ACCOUNT_CODE, FINANCE_SEED } from "@/lib/mock/finance";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { table } from "./store";

/**
 * FIN's behaviour, played by the mock backend for one signed-in session: obligation decisions to pay, the
 * payment instructions the payer authorises, the payments made under them, and the invoices issued for them.
 * Commands are named after the API's operations (`srs/02-api-contracts.md`) and refuse with the codes of
 * `design/04-refusal-codes.md`.
 *
 * There is no bank and no card scheme behind the mock, so the backend plays them, and plays the payer's own
 * banking app as well:
 *
 * - a bank transfer of the instruction's exact amount, with its reference as the transfer content, arrives
 *   `MOCK_BANK_SETTLE_SECONDS` seconds (20 unless set) after the instruction is created, and is reconciled at
 *   once. Nothing runs on a timer: the arrival is applied the next time the session's finance is read or acted
 *   on, stamped with the moment the bank would have reported it;
 * - a card payment is authorised, settled and reconciled the moment the payer chooses the card, since there is
 *   no card payment page to wait for.
 *
 * Either way the payment is recorded, reconciled and invoiced in that order, as the API will do it on the
 * bank's and the e-invoice service's answers.
 */

const DEFAULT_SETTLE_SECONDS = 20;

/**
 * How long an instruction can be paid. The spec leaves it to configuration (`valid_until` from CFG-391) and no
 * value is approved; the canvas draws INS-9RFD3KQW6T authorised on 1 October and valid to the end of 8 October.
 */
const VALIDITY_DAYS = 7;

function settleSeconds(): number {
  const configured = Number.parseInt(process.env.MOCK_BANK_SETTLE_SECONDS ?? "", 10);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_SETTLE_SECONDS;
}

// ------------------------------------------------------------------ the table

interface Entry {
  at: string;
  event: string;
  /** The person who acted; null for RightOne itself or the bank. */
  by: string | null;
}

/** `finance.payment_instruction`: CREATED until paid or past its last day; PENDING while a card page is open. */
interface InstructionRecord {
  reference: string;
  decision: string;
  amountMinor: number;
  authorisedAt: string;
  authorisedBy: string;
  validTo: string;
  accountHolder: string;
  transferContent: string;
  qrPayload: string;
  state: "CREATED" | "PENDING" | "USED" | "EXPIRED";
  history: Entry[];
}

/** `finance.payment`, as SM-325 moves it: PAID on the source's result, RECONCILED once its evidence matches. */
interface PaymentRecord {
  reference: string;
  decision: string;
  instruction: string;
  method: PaymentMethod;
  amountMinor: number;
  state: "PAID" | "RECONCILED";
  receivedAt: string;
  settlementConfirmedAt: string | null;
  reconciledAt: string | null;
  invoice: (InvoiceNumber & { issuedAt: string }) | null;
  history: Entry[];
}

interface FinanceTable {
  party: string;
  decisions: Map<string, DecisionToPay>;
  /** Each decision's authorisations to pay (FR-FIN-037), the latest last. */
  authorisations: Map<string, Entry[]>;
  /** The status record each decision's fee bears on. */
  records: Map<string, string>;
  /** Where each decision's payment stood on the canvas, until a payment made here takes its place. */
  drawnPositions: Map<string, PaymentPosition>;
  instructions: Map<string, InstructionRecord>;
  payments: Map<string, PaymentRecord>;
  /** Invoices and corrective documents, in no order; a read sorts them. */
  invoices: InvoiceSummary[];
}

/**
 * The canvas's Pasteur position is drawn at 10:14, after INS-9RFD3KQW6T was made at 10:06. A session starts at
 * 10:05, before the payer authorised it, so the seed has the chargeback and no new instruction yet.
 */
function beforeInstruction(position: PaymentPosition): PaymentPosition {
  return {
    ...position,
    checks: position.checks.filter((check) => check.check !== "new-payment-awaited"),
    chargeback: position.chargeback !== null ? { ...position.chargeback, instruction: null } : null,
  };
}

function seed(): FinanceTable {
  return {
    party: FINANCE_SEED.party,
    decisions: new Map(FINANCE_SEED.decisions.map((decision) => [decision.reference, decision])),
    authorisations: new Map(),
    records: new Map(Object.entries(FINANCE_SEED.records)),
    drawnPositions: new Map(Object.entries(FINANCE_SEED.positions).map(([decision, position]) => [decision, beforeInstruction(position)])),
    instructions: new Map(),
    payments: new Map(),
    invoices: [...FINANCE_SEED.invoices],
  };
}

/** The session's finance, with whatever the bank reported since it was last read applied first. */
function financeOf(sessionId: string): FinanceTable {
  const finance = table(sessionId, "finance", seed);
  applyBankReports(finance);
  return finance;
}

const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });

/** A decision the session does not hold reads the same as one it may not see (convention 5). */
const NOT_ACCESSIBLE = refused("SRS_RESOURCE_NOT_ACCESSIBLE");

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

const total = (decision: DecisionToPay) => decision.components.reduce((sum, component) => sum + component.amountMinor, 0);

function instructionsOf(finance: FinanceTable, decision: string): InstructionRecord[] {
  return [...finance.instructions.values()].filter((instruction) => instruction.decision === decision);
}

function paymentsOf(finance: FinanceTable, decision: string): PaymentRecord[] {
  return [...finance.payments.values()].filter((payment) => payment.decision === decision);
}

/** The instruction the payer can pay now: created, or with a card payment open. */
function openInstruction(finance: FinanceTable, decision: string): InstructionRecord | null {
  return instructionsOf(finance, decision).find((instruction) => instruction.state === "CREATED" || instruction.state === "PENDING") ?? null;
}

/** Paid and reconciled here, or drawn so on the canvas (Nguyễn Huệ's transfer of 24 September). */
function isPaid(finance: FinanceTable, decision: string): boolean {
  if (paymentsOf(finance, decision).some((payment) => payment.state === "RECONCILED")) return true;
  return finance.drawnPositions.get(decision)?.status === "reconciled";
}

/** DR-355: a decision no longer in force, or one with nothing to pay, cannot be paid. */
function decisionRefusal(decision: DecisionToPay): PayRefusal | null {
  if (decision.replacedBy !== null) return { code: "FIN_DECISION_NOT_CURRENT" };
  if (decision.outsideObligation || total(decision) === 0) return { code: "FIN_NO_PAYABLE_COMPONENT" };
  return null;
}

// ------------------------------------------------------------------ the bank's transfer code

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE, the checksum EMVCo closes a QR payload with (tag 63). */
function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * The instruction's bank transfer code, field for field as the board's QR_PAYLOAD is written (EMVCo,
 * merchant-presented, dynamic): the collection account, the currency (704, VND), the amount in whole dong,
 * the country and the transfer content. Given the board's amount and content it gives the board's payload.
 */
function transferCode(amountMinor: number, content: string): string {
  const { application, bank, account, service } = COLLECTION_ACCOUNT_CODE;
  const merchant = tlv("00", application) + tlv("01", tlv("00", bank) + tlv("01", account)) + tlv("02", service);
  const body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merchant) +
    tlv("53", "704") +
    tlv("54", String(amountMinor)) +
    tlv("58", "VN") +
    tlv("62", tlv("08", content)) +
    "6304";
  return body + crc16(body);
}

// ------------------------------------------------------------------ what RightOne does on the bank's answers

/**
 * The mock bank's reports: a transfer that has arrived by now is recorded and settled; an instruction still
 * unpaid after its last day is invalidated (FR-FIN-003).
 */
function applyBankReports(finance: FinanceTable): void {
  const moment = Date.now();
  for (const instruction of finance.instructions.values()) {
    if (instruction.state !== "CREATED") continue;
    const arrives = Date.parse(instruction.authorisedAt) + settleSeconds() * 1000;
    if (moment >= arrives) settle(finance, instruction, "transfer", new Date(arrives).toISOString());
    else if (today() > instruction.validTo) invalidateInstruction(instruction);
  }
}

/** FR-FIN-003: an unused instruction past its last day can no longer be paid; the payer authorises again. */
function invalidateInstruction(instruction: InstructionRecord): void {
  instruction.state = "EXPIRED";
  instruction.history.push({ at: now(), event: "INVALIDATED_EXPIRED", by: null });
}

/** The money arrived, matched and reconciled, and invoiced: the three acts the bank's answers set off. */
function settle(finance: FinanceTable, instruction: InstructionRecord, method: PaymentMethod, at: string): PaymentRecord {
  const payment = recordSourceResult(finance, instruction, method, at);
  recordPaymentReconciled(payment, instruction, at);
  issuePayerInvoice(finance, payment, at);
  return payment;
}

/** The source's result (aLG-331): the payment is created PAID under its instruction, which is now used. */
function recordSourceResult(finance: FinanceTable, instruction: InstructionRecord, method: PaymentMethod, at: string): PaymentRecord {
  const payment: PaymentRecord = {
    reference: reference("PAY"),
    decision: instruction.decision,
    instruction: instruction.reference,
    method,
    amountMinor: instruction.amountMinor,
    state: "PAID",
    receivedAt: at,
    settlementConfirmedAt: null,
    reconciledAt: null,
    invoice: null,
    history: [{ at, event: method === "card" ? "CARD_AUTHORISED" : "TRANSFER_RECEIVED", by: null }],
  };
  finance.payments.set(payment.reference, payment);
  instruction.state = "USED";
  instruction.history.push({ at, event: "PAID", by: null });
  return payment;
}

/**
 * FR-FIN-006: a paid outcome becomes reconciled once amount, reference and beneficiary match. The mock bank
 * sends the exact amount with the instruction's content, so it matches; a card is settled by the scheme's
 * confirmation, recorded at the same moment.
 */
function recordPaymentReconciled(payment: PaymentRecord, instruction: InstructionRecord, at: string): void {
  if (payment.amountMinor !== instruction.amountMinor) return;
  if (payment.method === "card") payment.settlementConfirmedAt = at;
  payment.state = "RECONCILED";
  payment.reconciledAt = at;
  payment.history.push({ at, event: "RECONCILED", by: null });
}

/**
 * FR-FIN-025: the invoice for a settled payment, numbered next in the collection authority's series (the
 * canvas's 1C26TRO, whose last number is 00000511): e-invoice numbers run on without a gap within a series.
 */
function issuePayerInvoice(finance: FinanceTable, payment: PaymentRecord, at: string): void {
  if (payment.state !== "RECONCILED") return;
  const decision = finance.decisions.get(payment.decision);
  if (decision === undefined) return;
  const series = FINANCE_SEED.series;
  const last = Math.max(0, ...finance.invoices.filter((invoice) => invoice.series === series).map((invoice) => Number(invoice.number)));
  const number = String(last + 1).padStart(8, "0");
  finance.invoices.push({ series, number, premises: decision.premises, issuedOn: addDays(at, 0), amountMinor: payment.amountMinor, corrects: null, correctedBy: null });
  payment.invoice = { series, number, issuedAt: at };
  payment.history.push({ at, event: "INVOICE_ISSUED", by: null });
}

// ------------------------------------------------------------------ commands

/**
 * POST /payments/{id}/record-authorisation-covered then create-payment-instruction, the one act SCR-FIN-01
 * offers: the payer authorises the covered components and RightOne makes the instruction at once. A decision
 * that already has an instruction to pay, or is paid, refuses the repeat with FIN_IDEMPOTENCY_CONFLICT and
 * writes nothing.
 */
export function authorisePayment(sessionId: string, decision: string, actor: string): LoadOutcome<{ instruction: string }> {
  const finance = financeOf(sessionId);
  const subject = finance.decisions.get(decision);
  if (subject === undefined || subject.payer !== finance.party) return NOT_ACCESSIBLE;
  const refusal = decisionRefusal(subject);
  if (refusal !== null) return refused(refusal.code);
  if (openInstruction(finance, decision) !== null || isPaid(finance, decision)) return refused("FIN_IDEMPOTENCY_CONFLICT");
  const at = now();
  recordAuthorisationCovered(finance, subject, actor, at);
  return ok({ instruction: createPaymentInstruction(finance, subject, actor, at).reference });
}

/** FR-FIN-037: the authorisation, against the decision's components, before any instruction is issued. */
function recordAuthorisationCovered(finance: FinanceTable, decision: DecisionToPay, actor: string, at: string): void {
  const entries = finance.authorisations.get(decision.reference) ?? [];
  entries.push({ at, event: "AUTHORISED", by: actor });
  finance.authorisations.set(decision.reference, entries);
}

/**
 * FR-FIN-001: one instruction for the payable components. Its transfer content is its own reference, as the
 * board writes INS-9RFD3KQW6T's; it is valid to the end of the seventh day after it is made.
 */
function createPaymentInstruction(finance: FinanceTable, decision: DecisionToPay, actor: string, at: string): InstructionRecord {
  const ref = reference("INS");
  const amountMinor = total(decision);
  const instruction: InstructionRecord = {
    reference: ref,
    decision: decision.reference,
    amountMinor,
    authorisedAt: at,
    authorisedBy: actor,
    validTo: addDays(at, VALIDITY_DAYS),
    accountHolder: decision.collectionAuthority,
    transferContent: ref,
    qrPayload: transferCode(amountMinor, ref),
    state: "CREATED",
    history: [{ at, event: "CREATED", by: actor }],
  };
  finance.instructions.set(ref, instruction);
  return instruction;
}

/**
 * Pay by card (FR-FIN-002): the instruction is PENDING while the card payment page is open, and the mock card
 * scheme answers at once, so the payment is recorded, reconciled and invoiced before the payer is back.
 * An instruction no longer open to pay (paid meanwhile, or past its last day) refuses the stale request.
 */
export function payInstructionByCard(sessionId: string, decision: string): LoadOutcome<{ payment: string }> {
  const finance = financeOf(sessionId);
  const subject = finance.decisions.get(decision);
  if (subject === undefined || subject.payer !== finance.party) return NOT_ACCESSIBLE;
  const instruction = openInstruction(finance, decision);
  if (instruction === null) return refused("FIN_IDEMPOTENCY_CONFLICT");
  const at = now();
  instruction.state = "PENDING";
  instruction.history.push({ at, event: "CARD_PAGE_OPENED", by: null });
  return ok({ payment: settle(finance, instruction, "card", at).reference });
}

// ------------------------------------------------------------------ reads

function asPaymentInstruction(instruction: InstructionRecord): PaymentInstruction {
  return {
    reference: instruction.reference,
    state: instruction.state === "PENDING" ? "pending" : instruction.state === "EXPIRED" ? "expired" : "created",
    authorisedAt: instruction.authorisedAt,
    authorisedBy: instruction.authorisedBy,
    validTo: instruction.validTo,
    accountHolder: instruction.accountHolder,
    transferContent: instruction.transferContent,
    qrPayload: instruction.qrPayload,
  };
}

/**
 * SCR-FIN-01's decision as the session holds it: refused for a decision no longer in force or without a fee;
 * paid, once a payment settled it; otherwise with the latest instruction not yet used, or none.
 */
export function payObligation(sessionId: string, decision: string): LoadOutcome<PayObligation> {
  const finance = financeOf(sessionId);
  const subject = finance.decisions.get(decision);
  if (subject === undefined || subject.payer !== finance.party) return NOT_ACCESSIBLE;
  const base = { asOf: now(), decision: subject, instruction: null, refusal: decisionRefusal(subject), reader: null, paid: false };
  if (base.refusal !== null) return ok(base);
  if (isPaid(finance, decision)) return ok({ ...base, paid: true });
  const latest = instructionsOf(finance, decision).filter((instruction) => instruction.state !== "USED").at(-1);
  return ok({ ...base, instruction: latest !== undefined ? asPaymentInstruction(latest) : null });
}

/** A payment made here, as SCR-FIN-02 reads it. */
function positionOfPayment(finance: FinanceTable, payment: PaymentRecord, decision: DecisionToPay): PaymentPosition {
  const checks: PaymentCheck[] = [{ check: "received", method: payment.method, at: payment.receivedAt }];
  checks.push(
    payment.reconciledAt !== null
      ? { check: "reconciled", at: payment.reconciledAt, settlementConfirmedAt: payment.settlementConfirmedAt }
      : { check: "awaiting-settlement" },
  );
  checks.push(
    payment.invoice !== null
      ? { check: "invoice-issued", invoice: { series: payment.invoice.series, number: payment.invoice.number }, at: payment.invoice.issuedAt }
      : { check: "invoice-requested", issuer: decision.collectionAuthority },
  );
  const earlier = decision.earlierPayment;
  return {
    subject: { kind: "payment", reference: payment.reference },
    status: payment.state === "RECONCILED" ? "reconciled" : "paid",
    premises: decision.premises,
    party: finance.party,
    asOf: now(),
    amountMinor: payment.amountMinor,
    method: payment.method,
    transferContent: null,
    decision: decision.reference,
    invoice: payment.invoice !== null ? { series: payment.invoice.series, number: payment.invoice.number, correctedBy: null } : null,
    // The payment made again points at the one taken back, as the canvas draws it (FIN F-3).
    related: earlier !== null ? { relation: "replaces", payment: earlier.reference, takenBackOn: earlier.takenBackOn } : null,
    checks,
    chargeback: null,
    condition: null,
    record: finance.records.get(decision.reference) ?? null,
  };
}

/**
 * The canvas's position of a decision, read now: once the payer has authorised payment again after a
 * chargeback, the position waits for the new payment under that instruction, as the board's 10:14 drawing.
 */
function positionAsDrawn(finance: FinanceTable, decision: string, position: PaymentPosition): PaymentPosition {
  const open = openInstruction(finance, decision);
  if (open === null || position.chargeback === null) return { ...position, asOf: now() };
  const awaited: PaymentCheck = { check: "new-payment-awaited", instruction: open.reference, validTo: open.validTo };
  const review = position.checks.findIndex((check) => check.check === "record-review");
  const checks = review === -1 ? [...position.checks, awaited] : [...position.checks.slice(0, review), awaited, ...position.checks.slice(review)];
  return { ...position, asOf: now(), checks, chargeback: { ...position.chargeback, instruction: open.reference } };
}

/**
 * SCR-FIN-02: where the decision's payment stands. The latest payment made here, or the position the canvas
 * drew for the decision. A decision with neither (Lê Thánh Tôn's and Phan Xích Long's: the canvas draws no
 * payment of theirs) has no position to show.
 */
export function paymentPosition(sessionId: string, decision: string): LoadOutcome<PaymentPosition> {
  const finance = financeOf(sessionId);
  const latest = paymentsOf(finance, decision).at(-1);
  const subject = finance.decisions.get(decision);
  if (latest !== undefined && subject !== undefined) return ok(positionOfPayment(finance, latest, subject));
  const drawn = finance.drawnPositions.get(decision);
  if (drawn === undefined || drawn.party !== finance.party) return NOT_ACCESSIBLE;
  return ok(positionAsDrawn(finance, decision, drawn));
}

/** SCR-FIN-03: the party's invoices and corrective documents, the latest first. */
export function invoiceList(sessionId: string): LoadOutcome<InvoiceList> {
  const finance = financeOf(sessionId);
  const invoices = [...finance.invoices].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.number.localeCompare(a.number));
  return ok({ party: finance.party, premises: null, asOf: now(), invoices, decisionWithoutFee: null });
}
