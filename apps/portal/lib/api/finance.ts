import type { LoadOutcome } from "@rightone/ui";
import { authorisePayment, invoiceList, payInstructionByCard, paymentPosition, payObligation } from "@/lib/mock/backend/finance";
import {
  mockInvoice,
  mockInvoiceList,
  mockPaymentPosition,
  mockPayObligation,
  type Fin01View,
  type Fin02View,
  type Fin03InvoiceView,
  type Fin03ListView,
} from "@/lib/mock/finance";
import type { Principal } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/** The three layers of rights a fee is split into, one component for each recipient. */
export type RightsLayer = "authors" | "performers" | "producers";

/** One component of a fee: its layer, the organisation that receives it, and the amount in whole dong. */
export interface FeeComponent {
  layer: RightsLayer;
  recipient: string;
  amountMinor: number;
}

/** An invoice number is its series and its number, one reference ("1C26TRO 00000418"). */
export interface InvoiceNumber {
  series: string;
  number: string;
}

// ------------------------------------------------------------------ SCR-FIN-01 Pay an obligation

/** The obligation decision a payer pays, as SCR-FIN-01 shows it. */
export interface DecisionToPay {
  reference: string;
  premises: string;
  payer: string;
  issuedAt: string;
  /** Null when the decision states no pay-by date (a replaced decision, a decision with no fee). */
  payBy: string | null;
  /** The organisation designated to collect the fee and issue its invoice. */
  collectionAuthority: string;
  tariffVersion: string;
  /** Every component exempt: the premises is outside the obligation. */
  outsideObligation: boolean;
  components: readonly FeeComponent[];
  /** The decision that replaced this one, and from which day; null while this one is in force. */
  replacedBy: { reference: string; from: string } | null;
  /** A payment of this decision taken back by a card chargeback, which a new payment replaces. */
  earlierPayment: { reference: string; takenBackOn: string } | null;
}

/** SM-325 as the payer sees an instruction: created, a card payment in progress, or past its last day. */
export type InstructionState = "created" | "pending" | "expired";

export interface PaymentInstruction {
  reference: string;
  state: InstructionState;
  authorisedAt: string;
  authorisedBy: string;
  /** The last day the instruction can be paid. */
  validTo: string;
  /** The holder of the collection account, as the bank writes it. No account number reaches the page. */
  accountHolder: string;
  /** What the payer writes as the transfer content, which matches the transfer to this instruction. */
  transferContent: string;
  /** The bank's transfer code (EMVCo, merchant-presented): drawn as a QR code, never printed as text. */
  qrPayload: string;
}

/** A refusal of the act SCR-FIN-01 offers, drawn where the act would be. */
export type PayRefusal =
  | { code: "FIN_DECISION_NOT_CURRENT" }
  | { code: "FIN_NO_PAYABLE_COMPONENT" }
  | { code: "FIN_PAYMENT_NOT_AUTHORISED"; principal: string }
  | { code: "FIN_IDEMPOTENCY_CONFLICT" };

export interface PayObligation {
  /** When the page was read. */
  asOf: string;
  decision: DecisionToPay;
  /** Null until the payment is authorised. */
  instruction: PaymentInstruction | null;
  refusal: PayRefusal | null;
  /**
   * Who the answer was given to, when it depends on it: a delegate whose authority does not cover
   * payment reads the refusal. Null for the principal.
   */
  reader: { account: string; authority: "read-and-submit" } | null;
  /** The fee is paid and reconciled: there is nothing left to pay, and the payment position says how it was paid. */
  paid: boolean;
}

/** What Authorise payment or Pay by card hands back to SCR-FIN-01 when the act is refused. */
export interface PayAttempt {
  refusal: "FIN_IDEMPOTENCY_CONFLICT";
}

/**
 * SCR-FIN-01 reads what a payer pays for one obligation decision: the session's decision as it stands, or,
 * with `view`, the state the canvas drew. A decision the reader may not see is a failure
 * (SRS_RESOURCE_NOT_ACCESSIBLE), never another premises' decision.
 */
export function loadPayObligation(
  sessionId: string,
  decision: string,
  view: Exclude<Fin01View, "loading"> | null,
): Promise<LoadOutcome<PayObligation>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockPayObligation(decision, view) : payObligation(sessionId, decision));
}

// ------------------------------------------------------------------ SCR-FIN-02 Payment position

export type PaymentMethod = "card" | "transfer";

/** One fact the position verifies, each with its own sentence. */
export type PaymentCheck =
  | { check: "received"; method: PaymentMethod; at: string }
  | { check: "reconciled"; at: string; settlementConfirmedAt: string | null }
  | { check: "awaiting-settlement" }
  | { check: "invoice-issued"; invoice: InvoiceNumber; at: string }
  | { check: "invoice-corrected"; invoice: InvoiceNumber; correctedOn: string; corrective: InvoiceNumber }
  | { check: "invoice-requested"; issuer: string }
  | { check: "chargeback"; at: string }
  | { check: "new-payment-awaited"; instruction: string; validTo: string }
  | { check: "record-review"; record: string; dueBy: string }
  | { check: "record-suspended"; record: string; from: string; decidedAt: string }
  | { check: "card-declined"; at: string }
  | { check: "unmatched" }
  | { check: "matched-as-duplicate"; on: string; decision: string; paidBy: string }
  | { check: "refund-proposed"; on: string };

/** A payment this one points at. The link to a payment taken back is the design's proposal (FIN F-3). */
export type RelatedPayment =
  | { relation: "earlier-attempt"; payment: string; declinedAt: string }
  | { relation: "paid-by"; payment: string; at: string }
  | { relation: "replaces"; payment: string; takenBackOn: string }
  | { relation: "already-paid-by"; payment: string; reconciledOn: string };

/** On the portal a reconciled payment reads Paid, and money of the payer's that is held reads Held. */
export type PaymentStatus = "disputed" | "reconciled" | "failed" | "paid" | "held";

export interface PaymentPosition {
  /** A payment, a payment under an instruction, or a transfer that arrived. */
  subject:
    | { kind: "payment"; reference: string }
    | { kind: "instruction"; reference: string }
    | { kind: "transfer"; reference: string; receivedOn: string };
  status: PaymentStatus;
  /** Null while a transfer matches no record: it belongs to no premises yet, so the page names the party. */
  premises: string | null;
  party: string;
  asOf: string;
  amountMinor: number;
  /** Null for a transfer, which is described by its content instead. */
  method: PaymentMethod | null;
  transferContent: string | null;
  decision: string | null;
  invoice: (InvoiceNumber & { correctedBy: InvoiceNumber | null }) | null;
  related: RelatedPayment | null;
  checks: readonly PaymentCheck[];
  /** A card chargeback: the fee is due again, under a new instruction (null until the payer authorises one). */
  chargeback: { takenBackOn: string; dueAgainBy: string; instruction: string | null } | null;
  /** The Design Brief's payer messages, which state a condition and carry no code. */
  condition: "in-suspense" | "duplicate" | null;
  /** The status record this payment bears on, when there is one. */
  record: string | null;
}

/**
 * SCR-FIN-02 reads where the payment of one obligation decision stands, live or, with `view`, as the canvas
 * drew it. A decision the reader may not see is SRS_RESOURCE_NOT_ACCESSIBLE, never an empty position.
 */
export function loadPaymentPosition(
  sessionId: string,
  decision: string,
  view: Exclude<Fin02View, "loading"> | null,
): Promise<LoadOutcome<PaymentPosition>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockPaymentPosition(decision, view) : paymentPosition(sessionId, decision));
}

// ------------------------------------------------------------------ SCR-FIN-03 Invoices and corrective documents

export interface InvoiceSummary extends InvoiceNumber {
  premises: string;
  issuedOn: string;
  /** Negative for a corrective document. */
  amountMinor: number;
  /** For a corrective document, the invoice it corrects. */
  corrects: string | null;
  /** For a corrected invoice, the corrective document that corrected it. */
  correctedBy: string | null;
}

export interface InvoiceList {
  party: string;
  /** The premises the list is for; null for every premises of the party. */
  premises: string | null;
  asOf: string;
  /** The latest first. */
  invoices: readonly InvoiceSummary[];
  /** For a list with nothing in it: the decision with no fee, which is why there is nothing to invoice. */
  decisionWithoutFee: string | null;
}

/** An issued invoice, with the documents of its payment. */
export interface IssuedInvoice extends InvoiceNumber {
  premises: string;
  issuedAt: string;
  issuer: string;
  payer: string;
  payment: string;
  decision: string;
  components: readonly FeeComponent[];
  /** Null while no retention period is approved (CFG-406's safe default keeps it within reach). */
  keptUntil: string | null;
  /** The corrective document that reversed it, when one did. */
  correction: { number: string; issuedOn: string; chargebackOn: string } | null;
}

/** An invoice that fell due and is not issued: its payment is not settled, or the e-invoice service was down. */
export interface UnissuedInvoice {
  instruction: string;
  premises: string;
  series: string;
  issuer: string;
  payer: string;
  decision: string;
  asOf: string;
  payment: { method: PaymentMethod; paidAt: string; reconciledAt: string | null };
  /** FIN_PAYMENT_NOT_SETTLED refuses the invoice; FIN_EINVOICE_UNAVAILABLE states a condition. */
  reason: "FIN_PAYMENT_NOT_SETTLED" | "FIN_EINVOICE_UNAVAILABLE";
}

export type InvoiceRead = { kind: "issued"; invoice: IssuedInvoice } | { kind: "unissued"; invoice: UnissuedInvoice };

/**
 * SCR-FIN-03, the list: every invoice and corrective document of the reader's party, the latest first, as the
 * session holds them or, with `view`, as the canvas drew them.
 */
export function loadInvoiceList(sessionId: string, view: Fin03ListView | null): Promise<LoadOutcome<InvoiceList>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockInvoiceList(view) : invoiceList(sessionId));
}

/**
 * SCR-FIN-03, one invoice. An invoice has no route of its own yet, so only a review state reaches it, by view;
 * the list cannot open one until it has.
 */
export function loadInvoice(view: Fin03InvoiceView): Promise<LoadOutcome<InvoiceRead>> {
  return Promise.resolve(usesMockData() ? mockInvoice(view) : NOT_CONFIGURED);
}

// ------------------------------------------------------------------ acts

/**
 * Authorise payment of a decision (FR-FIN-037): the authorisation is recorded against the covered components
 * and RightOne creates the payment instruction (FR-FIN-001). Refused with FIN_DECISION_NOT_CURRENT,
 * FIN_NO_PAYABLE_COMPONENT, or FIN_IDEMPOTENCY_CONFLICT when the decision already has an instruction to pay
 * or is paid: the request repeats one already answered.
 */
export function recordPaymentAuthorisation(principal: Principal, decision: string): Promise<LoadOutcome<{ instruction: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(authorisePayment(principal.sessionId, decision, principal.account));
}

/**
 * Pay the decision's instruction by card (FR-FIN-002): the card payment page is outside RightOne and hands the
 * payer back to the payment position. Refused with FIN_IDEMPOTENCY_CONFLICT when the instruction is no longer
 * open to pay (paid meanwhile, or past its last day).
 */
export function startCardPayment(sessionId: string, decision: string): Promise<LoadOutcome<{ payment: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(payInstructionByCard(sessionId, decision));
}
