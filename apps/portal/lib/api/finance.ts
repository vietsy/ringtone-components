import type { LoadOutcome } from "@rightone/ui";
import {
  applyHeldAmount,
  applyOutstandingConsequence,
  approveWriteOff,
  authorisePayment,
  closeCorrection,
  corrections,
  declineWriteOff,
  decideRefund,
  invoiceList,
  invoiceRead,
  outstandingAmounts,
  payInstructionByCard,
  paymentPosition,
  payObligation,
  proposeWriteOff,
  recordChargeback,
  recordCorrection,
  recordRefund,
  sendRefund,
  suspense,
  writeOff,
  type FinanceActor,
} from "@/lib/mock/backend/finance";
import {
  mockConsoleFailure,
  mockInvoice,
  mockInvoiceList,
  mockPaymentPosition,
  mockPayObligation,
  type Fin01View,
  type Fin02View,
  type Fin03InvoiceView,
  type Fin03ListView,
} from "@/lib/mock/finance";
import type { Principal, Staff } from "./session";
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
  /** The e-invoice service was down when the invoice fell due: the position is kept, and the invoice issued once it is back. */
  | { check: "invoice-unavailable"; issuer: string; since: string }
  /** The payment was taken back before its invoice was issued: the request is cancelled and none is issued (SM-326 transition 6). */
  | { check: "invoice-cancelled" }
  | { check: "chargeback"; at: string }
  | { check: "new-payment-awaited"; instruction: string; validTo: string }
  | { check: "record-review"; record: string; dueBy: string }
  | { check: "record-suspended"; record: string; from: string; decidedAt: string }
  | { check: "card-declined"; at: string }
  | { check: "unmatched" }
  | { check: "matched-as-duplicate"; on: string; decision: string; paidBy: string }
  | { check: "refund-proposed"; on: string }
  | { check: "refund-approved"; on: string }
  | { check: "refunded"; amountMinor: number; at: string; case: string | null };

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
  /** For a corrective document made under a case's remedy, the case it names. */
  case: string | null;
  /** The payment it records (FR-FIN-013); null where the canvas draws the invoice without naming its payment. */
  payment: string | null;
  /** The obligation decision it records; null where the canvas names none. */
  decision: string | null;
}

/**
 * An invoice that fell due and is not issued yet (SM-326): its payment is not settled, or the e-invoice service was
 * down when it fell due and the position is kept until it is back (FR-FIN-070).
 */
export interface PendingInvoice {
  payment: string;
  instruction: string;
  premises: string;
  amountMinor: number;
  /** When the invoice fell due, or was asked for. */
  since: string;
  reason: "FIN_PAYMENT_NOT_SETTLED" | "FIN_EINVOICE_UNAVAILABLE";
}

export interface InvoiceList {
  party: string;
  /** The premises the list is for; null for every premises of the party. */
  premises: string | null;
  asOf: string;
  /** The latest first. */
  invoices: readonly InvoiceSummary[];
  /** The invoices not issued yet, the latest first. */
  pending: readonly PendingInvoice[];
  /** For a list with nothing in it: the decision with no fee, which is why there is nothing to invoice. */
  decisionWithoutFee: string | null;
}

/** An issued invoice or corrective document, with the documents of its payment. */
export interface IssuedInvoice extends InvoiceNumber {
  premises: string;
  issuedAt: string;
  issuer: string;
  payer: string;
  /** Null where the canvas draws the invoice without naming its payment. */
  payment: string | null;
  decision: string | null;
  /** The components it settles; null where the canvas gives only the amount. */
  components: readonly FeeComponent[] | null;
  /** The amount it states: negative for a corrective document. */
  amountMinor: number;
  /** For a corrective document, the invoice it corrects, which stays retrievable (FR-FIN-082). */
  corrects: string | null;
  /** Null while no retention period is approved (CFG-406's safe default keeps it within reach). */
  keptUntil: string | null;
  /**
   * The corrective document that reversed it, when one did: after a card chargeback (the day the payment was taken
   * back) or a refund a case decided (the case).
   */
  correction: { number: string; issuedOn: string; chargebackOn: string | null; case: string | null } | null;
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
  /** When the e-invoice service was found down, the invoice fell due; it is issued when the service is back. */
  failedAt: string | null;
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
 * SCR-FIN-03, one invoice: the issued invoice or corrective document a number names ("1C26TRO 00000418"), the
 * original of a corrected one included, or the invoice of a payment (PAY-) not issued yet. With `view`, the state
 * the canvas drew. An invoice of another party, or of a premises the reader may not see, is SRS_RESOURCE_NOT_ACCESSIBLE.
 */
export function loadInvoice(sessionId: string, reference: string, view: Fin03InvoiceView | null): Promise<LoadOutcome<InvoiceRead>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockInvoice(view) : invoiceRead(sessionId, reference));
}

// ------------------------------------------------------------------ acts

/**
 * Authorise payment of a decision (FR-FIN-037): the authorisation is recorded against the covered components
 * and RightOne creates the payment instruction (FR-FIN-001). Refused with FIN_DECISION_NOT_CURRENT,
 * FIN_NO_PAYABLE_COMPONENT, FIN_PAYMENT_NOT_AUTHORISED for a reader whose authority does not cover payment, or
 * FIN_IDEMPOTENCY_CONFLICT when the decision already has an instruction to pay or is paid: the request repeats one
 * already answered. The session says who authorises.
 */
export function recordPaymentAuthorisation(principal: Principal, decision: string): Promise<LoadOutcome<{ instruction: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(authorisePayment(principal.sessionId, decision));
}

/**
 * Pay the decision's instruction by card (FR-FIN-002): the card payment page is outside RightOne and hands the
 * payer back to the payment position. Refused with FIN_PAYMENT_NOT_AUTHORISED for a reader whose authority does
 * not cover payment, and with FIN_IDEMPOTENCY_CONFLICT when the instruction is no longer open to pay (paid
 * meanwhile, past its last day, or invalidated because its decision was replaced).
 */
export function startCardPayment(sessionId: string, decision: string): Promise<LoadOutcome<{ payment: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(payInstructionByCard(sessionId, decision));
}

// ------------------------------------------------------------------ the operations console (SCR-FIN-10, 14, 15)

/** A premises as the console shows it: its name, and its register record (PRM-) where PTY's register holds one. */
export interface ConsolePremises {
  name: string;
  record: string | null;
}

/** SM-331, a correction from the moment it is raised to its close. */
export type CorrectionState = "RAISED" | "CONSEQUENCES_DETERMINED" | "OWNING_REVIEW_OPEN" | "AGREED" | "CLOSED";

/**
 * A refund a correction makes against its original payment (FR-FIN-052): prepared by the finance officer, approved by
 * a finance approver who did not prepare it, then sent once to the account the money came from.
 */
export interface RefundStep {
  amountMinor: number;
  preparedBy: string;
  /** Who prepared it: the finance officer, or RightOne itself on a second payment of a fee already paid (FR-FIN-010). */
  preparer: "officer" | "system";
  preparedAt: string;
  approval: { decision: "approved" | "declined"; by: string; at: string; comment: string } | null;
  sent: { at: string; by: string } | null;
}

/** One row of SCR-FIN-10's list. */
export interface CorrectionRow {
  reference: string;
  /**
   * A card chargeback on a payment, a corrected transfer reference, a refund a case decided, or the return of a second
   * payment of a fee already paid, the remedy RightOne opens on it (FR-FIN-010).
   */
  kind: "chargeback" | "transfer-reference" | "refund" | "duplicate";
  payment: string;
  /** The case the correction was made under, which it names from its own side (CAS DR-51); null for none. */
  case: string | null;
  refund: RefundStep | null;
  premises: ConsolePremises;
  amountMinor: number;
  state: CorrectionState;
  raised: { at: string; by: string } | null;
  closedOn: string | null;
  /** The owning service's review the correction waits for, while it is open, and the business approver who decides it. */
  review: { reference: string | null; dueBy: string; overdueSince: string | null; approver: string } | null;
}

/** What a correction found for one area the original event touched; null while nobody has decided it. */
export interface CorrectionConsequences {
  /**
   * The corrective document that corrected the invoice; or, for the return of a second payment, which was never
   * invoiced, the invoice of the payment that paid the fee, which stands (null where none was issued).
   */
  invoice: { corrective: string; original: string; producedAt: string; producedBy: string } | { corrective: null; stands: string | null } | null;
  settlement: { debitMinor: number; recovery: { amountMinor: number; recipients: readonly string[] } | null } | null;
  /**
   * The status record the payment bears on, and the review the owning service opened, or none when there is no
   * record. A record agreed with no review stands as it is.
   */
  record: { record: string; review: string | null; openedAt: string | null; proposedAt: string | null; agreed: boolean } | { record: null } | null;
}

/** One rights layer of the fee as it was settled before the chargeback. */
export interface SettledComponent {
  layer: RightsLayer;
  recipient: string;
  amountMinor: number;
  remittance: { reference: string; state: "confirmed" | "suspended"; on: string | null } | null;
  /** What happens to it now: nobody has decided a recovery, or it is still held for its recipient. */
  recovery: "not-decided" | "held";
}

/** The correction SCR-FIN-10 opens under its list. */
export interface CorrectionDetail extends CorrectionRow {
  decision: string;
  original: {
    method: PaymentMethod;
    amountMinor: number;
    paidAt: string;
    reconciledAt: string | null;
    settlementConfirmation: string | null;
    invoice: { number: string; issuedAt: string; correctedBy: string | null } | null;
  };
  chargeback: { amountMinor: number; whole: boolean; recordedAt: string; recordedBy: string; notice: string } | null;
  consequencesSet: { at: string; by: string } | null;
  consequences: CorrectionConsequences;
  components: readonly SettledComponent[];
  /** The review: its due date in working days, and the suspension it proposes, waiting for the business approver. */
  review: (NonNullable<CorrectionRow["review"]> & { record: string; workingDays: number; proposedAt: string | null }) | null;
  /** The calculation the correction linked (FR-FIN-011): the fee before and after it. */
  recalculation: { reference: string; feeBeforeMinor: number; feeAfterMinor: number; at: string; by: string } | null;
  /** Who reads a refund waiting for approval, as segregation of duties decides what they may do there. */
  approvalReader: "approver" | "same-actor" | "reader";
  /**
   * The amount a refund sought holds in suspense, identified to its payer (FR-FIN-031), and the ground the case
   * relied on (FR-FIN-032); null for a correction that seeks no refund.
   */
  held: { reference: string; state: HeldState; ground: string | null } | null;
  /**
   * The grounds for a refund, transfer or retention are not decided (DEC-32, CFG-401), so no refund can be approved
   * and the amount stays held (DR-366 row 1, FIN_GROUNDS_RESERVED).
   */
  groundsReserved: boolean;
  /** The exception raised once the owning service's review passed its period (FR-FIN-055), naming the record and the event. */
  exception: { raisedAt: string; record: string; event: string } | null;
  /** For the return of a second payment: the payment that had already paid the fee, and when it was reconciled. */
  duplicates: { payment: string; reconciledAt: string | null } | null;
}

/** A payment the chargeback form can name. */
export interface ChargeablePayment {
  reference: string;
  premises: ConsolePremises;
  method: PaymentMethod;
  amountMinor: number;
  paidOn: string;
}

/** The finance workspace's tabs and what each holds open, for the counts on the tabs. */
export interface FinanceCounts {
  suspense: number;
  corrections: number;
  outstanding: number;
}

/** SCR-FIN-10 Corrections, refunds and chargebacks. */
export interface Corrections {
  asOf: string;
  rows: readonly CorrectionRow[];
  /** The correction opened under the list: the one asked for, else the first open one. */
  selected: CorrectionDetail | null;
  payments: readonly ChargeablePayment[];
  counts: FinanceCounts;
}

/** A refusal of an act on SCR-FIN-10, drawn where the act was, and the values the form held. */
export interface CorrectionAttempt {
  page: "corrections";
  act: "chargeback" | "correction" | "close" | "refund" | "approval" | "send";
  code: string;
  /** The chargeback or refund form as it was sent, so a refused value is shown as entered. */
  form: { payment: string; evidence: string; case: string; amountMinor: number | null } | null;
  /** A refusal that belongs to one field of the form it was sent from. */
  field: CorrectionField | null;
  /** What the refusal names: the correction a case's refund is already recorded under. */
  subject: string | null;
  /** The approver's reason as typed, kept when a decline is refused for want of one. */
  reason: string;
}

/** The fields of the console's forms a refusal can belong to: SCR-FIN-10's, and the ground of a write-off proposed on SCR-FIN-14. */
export type CorrectionField = "payment" | "evidence" | "amount" | "case" | "reason" | "ground";

/** SM-330, an amount owed from before its due date to settled or written off. */
export type OutstandingState = "NOT_YET_DUE" | "OUTSTANDING" | "SETTLED" | "ADJUSTED" | "WRITTEN_OFF";

/** One amount owed, as SCR-FIN-14 lists it and its side panel opens it. */
export interface OutstandingRow {
  reference: string;
  premises: ConsolePremises;
  /** The filter's key for the premises: its register record, or the premises' own id where it has none. */
  premisesKey: string;
  decision: string;
  amountMinor: number;
  dueOn: string;
  /** Days past the due date while it is outstanding. */
  daysPastDue: number | null;
  outstandingSince: string | null;
  notices: { reminder: string | null; overdue: string | null };
  state: OutstandingState;
  /** Owed again after a chargeback, with the instruction that pays it again while one is open. */
  owedAgain: { chargebackOn: string; instruction: { reference: string; validTo: string } | null } | null;
  /** A write-off proposed and not decided yet, with its ground: the canvas's bank charge, or the officer's words. */
  proposal: {
    by: string;
    at: string;
    approver: string;
    bankCharge: { amountMinor: number; payment: string; on: string } | null;
    ground: string | null;
  } | null;
  /** For an amount ADJUSTED (SM-330 transition 3): the decision that replaced the one it was owed under, and from when. */
  adjustedBy: { decision: string; from: string } | null;
  /** Whether a write-off can be proposed on it now: outstanding, and with no proposal waiting or approved. */
  writeOffOpen: boolean;
}

export interface OutstandingAmounts {
  asOf: string;
  rows: readonly OutstandingRow[];
  filter: { state: OutstandingState | null; premises: string | null };
  premises: readonly { key: string; name: string; record: string | null }[];
  /** The amount whose side panel is open. */
  opened: OutstandingRow | null;
  /**
   * What follows an outstanding amount beyond the notices is reserved to DEC-13 (CFG-400) and not in force: no
   * consequence applies (DR-365 row 3, FIN_CONSEQUENCE_RESERVED), which the page states over the table.
   */
  consequenceReserved: boolean;
  counts: FinanceCounts;
}

/** Who reads SCR-FIN-15, as segregation of duties decides what they may do there. */
export type WriteOffReader = "approver" | "proposer" | "same-actor" | "reader";

/** SCR-FIN-15 Write-off approval: the amount, its age, the proposal, and the decision once taken. */
export interface WriteOff {
  reference: string;
  premises: ConsolePremises;
  payer: string;
  decision: string;
  state: OutstandingState;
  /** The fee the decision set, and the period it covers where the decision states one. */
  fee: { amountMinor: number; period: { from: string; to: string } | null };
  /** What was received towards it: the canvas's transfer short by a bank charge; null when nothing was. */
  received: { payment: string; on: string; amountMinor: number; bankChargeMinor: number } | null;
  leftMinor: number;
  dueOn: string;
  /** The day use began, where the canvas gives it. */
  useBeganOn: string | null;
  outstandingSince: string;
  daysPastDue: number;
  notices: { reminder: string | null; overdue: string | null };
  proposal: {
    by: string;
    at: string;
    /** Null when the proposal names no authority: it cannot be approved until it does. */
    authority: { threshold: { amountMinor: number; recordedOn: string } } | null;
    /** The officer's ground in their words; null for the canvas's bank charge, which the page words. */
    ground: string | null;
  };
  outcome: { decision: "approved" | "declined"; by: string; at: string; comment: string } | null;
  reader: WriteOffReader;
}

/** What Approve or Decline hands back to SCR-FIN-15. */
export interface WriteOffAttempt {
  page: "write-off";
  amount: string;
  /** A decline sent without a reason, or a refusal of the act with its code. */
  refusal: { field: "reason" } | { code: string };
  reason: string;
}

/** What Propose a write-off hands back to SCR-FIN-14 when it is refused: the code, its field, and the ground as typed. */
export interface WriteOffProposalAttempt {
  page: "propose-write-off";
  amount: string;
  code: string;
  field: "ground" | null;
  ground: string;
}

// ------------------------------------------------------------------ held amounts (SCR-FIN-04)

/** SM-328, a held amount from the moment it is held to its disposal or release. */
export type HeldState = "HELD" | "PROPOSED" | "DISPOSED" | "RELEASED";

/** Why an amount is held: money matching no record, a fee paid twice, or a refund, transfer or retention sought. */
export type HeldReason = "UNMATCHED" | "DUPLICATE" | "REFUND_SOUGHT";

/** One held amount, as SCR-FIN-04 lists it. */
export interface HeldAmountRow {
  reference: string;
  amountMinor: number;
  reason: HeldReason;
  /**
   * Where the money came from: a transfer that arrived, with its content as the bank wrote it where the canvas gives
   * it; a payment made here, whose refund is sought; or the unexpired part of a paid term, asked back when the premises
   * changed operator on the day after `endedOn`.
   */
  source:
    | { kind: "transfer"; receivedOn: string; content: string | null }
    | { kind: "payment"; payment: string }
    | { kind: "unexpired-term"; endedOn: string };
  /** The payer it is identified to; null while it matches no payer. */
  payer: string | null;
  premises: ConsolePremises | null;
  /** The decision it paid, where it is identified to one. */
  decision: string | null;
  heldSince: string;
  /** Whole days held, counted to today. */
  daysHeld: number;
  state: HeldState;
  /** The disposition proposed on it, and by whom, while it waits for a finance approver. */
  proposal: { kind: "return" | "refund"; by: string; at: string } | null;
  /** The correction that sought its refund, on SCR-FIN-10. */
  correction: string | null;
  /** The grounds for refunding, transferring or retaining it are reserved: it stays held for its payer (DR-366 row 1). */
  groundsReserved: boolean;
}

/** One ground a case relied on when it decided on a held amount, reportable as a set (FR-FIN-032). */
export interface RecordedGround {
  held: string;
  case: string;
  ground: string;
  amountMinor: number;
  recordedAt: string;
}

/** SCR-FIN-04 Suspense: the held amounts, oldest first, the account they are held in, and the grounds recorded on them. */
export interface Suspense {
  asOf: string;
  rows: readonly HeldAmountRow[];
  holdingAccount: { holder: string; arrangement: string; acceptedOn: string };
  grounds: readonly RecordedGround[];
  counts: FinanceCounts;
}

/** The act just recorded on SCR-FIN-15, which the page confirms in a toast. */
export interface WriteOffDone {
  page: "write-off";
  amount: string;
  done: "approved" | "declined";
}

/**
 * The answer to a console act: what it recorded, or the refusal with its code, the field it belongs to, and the
 * record it names where its sentence names one.
 */
export type FinanceAnswer<T> =
  | { accepted: T; refusal: null }
  | { accepted: null; refusal: { code: string; field: CorrectionField | null; subject?: string } };

// ------------------------------------------------------------------ the console's reads and acts

const actor = (staff: Staff): FinanceActor => ({ name: staff.account, email: staff.email, roles: staff.roles });

/**
 * SCR-FIN-10: the corrections, with `selected` opened under the list. `view` draws the board's outage or its read
 * that cannot complete safely, for review.
 */
export function loadCorrections(staff: Staff, selected: string | null, view: "error" | "unavailable" | null): Promise<LoadOutcome<Corrections>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockConsoleFailure("fin10", view) : corrections(staff.sessionId, actor(staff), selected));
}

/** Record a chargeback (FR-FIN-053), refused with its code and the field it belongs to. */
export function recordChargebackOn(
  staff: Staff,
  input: { payment: string; evidence: string; amountMinor: number | null },
): Promise<FinanceAnswer<{ correction: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(recordChargeback(staff.sessionId, actor(staff), input));
}

/** Record a correction: its consequences, decided once without changing the original event (FR-FIN-011, 012). */
export function recordCorrectionOf(staff: Staff, correction: string): Promise<FinanceAnswer<{ state: CorrectionState }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(recordCorrection(staff.sessionId, actor(staff), correction));
}

/**
 * Record a correction that refunds part of a payment under the case that decided it (FR-FIN-011): the payment, the
 * case, the amount. The case is read in CAS first, and a case that did not decide a refund of this payment is refused.
 */
export function recordRefundOf(
  staff: Staff,
  input: { payment: string; caseRef: string; amountMinor: number | null },
): Promise<FinanceAnswer<{ correction: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(recordRefund(staff.sessionId, actor(staff), input));
}

/** Approve the refund, or Decline it with a reason (FR-FIN-052, PERM-710): a finance approver who did not prepare it. */
export function decideRefundOf(staff: Staff, correction: string, decision: "approve" | "decline", reason: string): Promise<FinanceAnswer<{ at: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(decideRefund(staff.sessionId, actor(staff), correction, decision, reason));
}

/** Send the approved refund, once, to the account the payment came from (FR-FIN-052, PERM-709). */
export function sendRefundOf(staff: Staff, correction: string): Promise<FinanceAnswer<{ invoice: string | null }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(sendRefund(staff.sessionId, actor(staff), correction));
}

/** Close the correction once every consequence agrees (SM-331 transition 5). */
export function closeCorrectionOf(staff: Staff, correction: string): Promise<FinanceAnswer<{ closedOn: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(closeCorrection(staff.sessionId, actor(staff), correction));
}

/** SCR-FIN-14: the amounts owed under the filter, with `opened` in the side panel. */
export function loadOutstandingAmounts(
  staff: Staff,
  filter: { state: OutstandingState | null; premises: string | null },
  opened: string | null,
  view: "error" | null,
): Promise<LoadOutcome<OutstandingAmounts>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockConsoleFailure("fin14", view) : outstandingAmounts(staff.sessionId, actor(staff), filter, opened));
}

/**
 * Apply a consequence to an outstanding amount beyond its notices (FR-FIN-030, PERM-703): refused with
 * FIN_CONSEQUENCE_RESERVED while DEC-13 is not in force, once the notices the policy fixes have been sent.
 */
export function applyOutstandingConsequenceTo(staff: Staff, amount: string): Promise<FinanceAnswer<{ applied: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(applyOutstandingConsequence(staff.sessionId, actor(staff), amount));
}

/** SCR-FIN-15: the write-off proposed on an amount, as the reader may act on it. */
export function loadWriteOff(staff: Staff, amount: string, view: "error" | null): Promise<LoadOutcome<WriteOff>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockConsoleFailure("fin15", view) : writeOff(staff.sessionId, actor(staff), amount));
}

/** Approve the write-off (FR-FIN-071), or Decline it with a reason. */
export function decideWriteOff(staff: Staff, amount: string, decision: "approve" | "decline", reason: string): Promise<FinanceAnswer<{ at: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  const decide = decision === "approve" ? approveWriteOff : declineWriteOff;
  return Promise.resolve(decide(staff.sessionId, actor(staff), amount, reason));
}

/**
 * Propose a write-off of an outstanding amount (SCR-FIN-14, FR-FIN-071): the finance officer gives its ground, and the
 * proposal names the authority in force, the finance approver under the segregation safe default. A finance approver
 * other than the proposer then decides it on SCR-FIN-15.
 */
export function proposeWriteOffOn(staff: Staff, amount: string, ground: string): Promise<FinanceAnswer<{ amount: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(proposeWriteOff(staff.sessionId, actor(staff), amount, ground));
}

/** SCR-FIN-04 Suspense: the held amounts, the account they are held in and the grounds recorded on them. */
export function loadSuspense(staff: Staff, view: "error" | "unavailable" | null): Promise<LoadOutcome<Suspense>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockConsoleFailure("fin04", view) : suspense(staff.sessionId, actor(staff)));
}

/**
 * Apply a held amount to an obligation decision (FR-FIN-073): refused while the grounds for refunding, transferring or
 * retaining a paid amount are reserved (FIN_GROUNDS_RESERVED), since the amount is held for its payer alone.
 */
export function applyHeldAmountTo(staff: Staff, held: string, decision: string): Promise<FinanceAnswer<{ applied: string }>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null } });
  return Promise.resolve(applyHeldAmount(staff.sessionId, actor(staff), held, decision));
}
