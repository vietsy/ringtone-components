import type { LoadOutcome } from "@rightone/ui";
import type {
  ChargeablePayment,
  ConsolePremises,
  CorrectionConsequences,
  CorrectionDetail,
  CorrectionRow,
  Corrections,
  CorrectionState,
  DecisionToPay,
  FeeComponent,
  FinanceAnswer,
  FinanceCounts,
  HeldAmountRow,
  HeldReason,
  HeldState,
  InvoiceList,
  InvoiceNumber,
  InvoiceRead,
  InvoiceSummary,
  OutstandingAmounts,
  OutstandingRow,
  OutstandingState,
  PaymentCheck,
  PaymentInstruction,
  PaymentMethod,
  PaymentPosition,
  PayObligation,
  PayRefusal,
  PendingInvoice,
  RecordedGround,
  RefundStep,
  RightsLayer,
  SettledComponent,
  Suspense,
  WriteOff,
  WriteOffReader,
} from "@/lib/api/finance";
import {
  CANVAS_CORRECTIONS,
  CANVAS_HELD,
  CANVAS_OUTSTANDING,
  CANVAS_PAYMENTS,
  COLLECTION_ACCOUNT_CODE,
  FINANCE_APPROVER,
  FINANCE_OFFICER,
  FINANCE_SEED,
  HOLDING_ACCOUNT,
  INVOICE_ISSUED_AT,
  RECIPIENTS,
  SEGREGATION_THRESHOLD,
  SETTLED_BEFORE,
} from "@/lib/mock/finance";
import { registrationSeed } from "@/lib/mock/registration";
import { PARTIES, reviewSeed } from "@/lib/mock/registration-review";
import { accountBook, ORGANISATIONS, organisationName } from "./accounts";
import { caseRemedyFor } from "./cases";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { noticesTo, recordNoticeEvent } from "./notices";
import { actingAs, premisesActableBy } from "./parties";
import { decisionForCollection, decisionReferences } from "./registration";
import { certificateForDecision, openStatusReview, statusReviewState } from "./status-records";
import { sessions, table, type StaffRole } from "./store";
import { recordLinkedCalculation } from "./tariff";

/**
 * FIN's behaviour, played by the mock backend for one world: obligation decisions to pay, the payment instructions
 * the payer authorises, the payments made under them, the invoices issued for them, and, on the operations console,
 * the held amounts, the corrections, the amounts owed and their write-offs. Commands are named after the API's
 * operations (`srs/02-api-contracts.md`) and refuse with the codes of `design/04-refusal-codes.md`; every command on
 * either side writes a row to the family's audit, a refused one with its code.
 *
 * Every decision REG holds can be collected, for whatever fee REG's decision carries: the canvas's decisions as the
 * finance boards draw them, and any other decision `decisionForCollection` returns (one approved on the operations
 * console today), with its fee split into the three components the canvas's fees are split into. A payer reads and
 * pays only the decisions of the party their session acts for.
 *
 * There is no bank, no card scheme and no e-invoice service behind the mock, so the backend plays them, and plays the
 * payer's own banking app as well:
 *
 * - a bank transfer of the instruction's exact amount, with its reference as the transfer content, arrives
 *   `MOCK_BANK_SETTLE_SECONDS` seconds (20 unless set) after the instruction is created, and is reconciled at
 *   once. Nothing runs on a timer: the arrival is applied the next time the world's finance is read or acted
 *   on, stamped with the moment the bank would have reported it;
 * - a card payment is authorised the moment the payer chooses the card, since there is no card payment page to wait
 *   for, and the scheme confirms its settlement `MOCK_CARD_SETTLE_SECONDS` seconds later (at once unless set); until
 *   then the payment is paid and not settled, and its invoice is refused (FIN_PAYMENT_NOT_SETTLED);
 * - the e-invoice service accepts every invoice, unless `MOCK_EINVOICE_UNAVAILABLE` is set: an invoice falling due
 *   then is not issued, its unissued position is kept (FIN_EINVOICE_UNAVAILABLE), and it is issued on the first read
 *   after the service is back;
 * - a payer pays an instruction one way, unless `MOCK_BANK_DUPLICATE_TRANSFER` is set when they pay it by card: they
 *   had sent its bank transfer as well, which still arrives when the transfer would have, and is a second payment of
 *   a fee already paid. It confers nothing, and RightOne holds it and opens its return (FR-FIN-010).
 *
 * Either way the payment is recorded, reconciled and invoiced in that order, as the API will do it on the
 * bank's and the e-invoice service's answers. A card payment can later be taken back by the scheme, which the
 * finance officer records on SCR-FIN-10; CER opens a review of the status record the payment bears on, and the
 * correction agrees once that review reports.
 */

const DEFAULT_SETTLE_SECONDS = 20;

/**
 * How long an instruction can be paid. The spec leaves it to configuration (`valid_until` from CFG-391) and no
 * value is approved; the canvas draws INS-9RFD3KQW6T authorised on 1 October and valid to the end of 8 October.
 */
const VALIDITY_DAYS = 7;

/** The owning service's review period for a correction's consequence on a status record (DR-368): 5 working days. */
const REVIEW_WORKING_DAYS = 5;

/** The version of FIN's decision rules every act applies and its audit row records: `frd/05-decision-rules.md` 0.1. */
const RULES_VERSION = "0.1";

/**
 * DEC-32, the grounds on which a paid amount may be refunded, transferred or retained, is a decision the sponsor has
 * reserved (CFG-401). Until it is approved and effective no ground is listed, and every such amount stays held in
 * suspense identified to its payer (DR-366 row 1).
 */
const GROUNDS_DECISION: { effective: boolean; grounds: readonly string[] } = { effective: false, grounds: [] };

/** The ground a case relies on when it decides a refund of a held amount, recorded on that amount (FR-FIN-032). */
const CASE_GROUND = "CASE_DECIDED_REFUND";

const seconds = (name: string, fallback: number): number => {
  const configured = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
};

const settleSeconds = () => seconds("MOCK_BANK_SETTLE_SECONDS", DEFAULT_SETTLE_SECONDS);
const cardSettleSeconds = () => seconds("MOCK_CARD_SETTLE_SECONDS", 0);

/** Whether a mock switch is set: `1`, `true` or `yes`. */
function switchedOn(name: string): boolean {
  const flag = (process.env[name] ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** Whether the mock e-invoice service answers now: it does unless `MOCK_EINVOICE_UNAVAILABLE` says otherwise. */
const einvoiceAvailable = () => !switchedOn("MOCK_EINVOICE_UNAVAILABLE");

/** Whether a payer who pays by card had sent the instruction's bank transfer as well (`MOCK_BANK_DUPLICATE_TRANSFER`). */
const transfersAsWell = () => switchedOn("MOCK_BANK_DUPLICATE_TRANSFER");

/**
 * DEC-13, what follows an outstanding amount beyond the notices, is reserved (CFG-400). Until it is approved and
 * effective no consequence is applied to an outstanding amount (DR-365 row 3, FR-FIN-030).
 */
const CONSEQUENCE_DECISION: { effective: boolean } = { effective: false };

/** RightOne itself, as the one who acts where the solution does: the remedy it opens on a second payment (PERM-712). */
const SYSTEM = { name: "RightOne", email: "" } as const;

// ------------------------------------------------------------------ the table

interface Entry {
  at: string;
  event: string;
  /** The person who acted; null for RightOne itself or the bank. */
  by: string | null;
}

/** `finance.finance_audit`: one append-only row per act, accepted or refused, with the rule and its version. */
interface AuditRow {
  at: string;
  actor: string;
  act: string;
  subject: string;
  /** The refusal's code; null for an act that was accepted. */
  code: string | null;
  rule: string | null;
  version: string;
}

/** `finance.payment_instruction`: CREATED until paid, past its last day or overtaken by its decision; PENDING while a card page is open. */
interface InstructionRecord {
  reference: string;
  decision: string;
  premises: string;
  payer: string;
  /** The components the authorisation covered, which the instruction collects. */
  components: readonly FeeComponent[];
  amountMinor: number;
  authorisedAt: string;
  authorisedBy: string;
  validTo: string;
  accountHolder: string;
  transferContent: string;
  qrPayload: string;
  state: "CREATED" | "PENDING" | "USED" | "EXPIRED" | "INVALIDATED";
  /**
   * The bank transfer the payer sent as well as paying the instruction by card (`MOCK_BANK_DUPLICATE_TRANSFER`), on its
   * way; false once it has arrived, or when there was none.
   */
  transferInFlight: boolean;
  history: Entry[];
}

/** FR-FIN-037: an authorisation to pay, recorded against the components it covers and their amount before any instruction. */
interface AuthorisationRecord {
  at: string;
  by: string;
  components: readonly FeeComponent[];
  amountMinor: number;
  tariffVersion: string;
  /** The instruction made under it; null until one is. */
  instruction: string | null;
}

/**
 * `finance.payment`, as SM-325 moves it: PAID on the source's result, RECONCILED once its evidence matches, DISPUTED
 * once the card scheme takes it back.
 */
interface PaymentRecord {
  reference: string;
  decision: string;
  premises: string;
  payer: string;
  instruction: string;
  method: PaymentMethod;
  amountMinor: number;
  components: readonly FeeComponent[];
  collectionAuthority: string;
  state: "PAID" | "RECONCILED" | "DISPUTED";
  receivedAt: string;
  /** When the card scheme confirms the settlement of a card payment not settled yet; null once it has, or for a transfer. */
  settlementDueAt: string | null;
  settlementConfirmedAt: string | null;
  reconciledAt: string | null;
  invoice: (InvoiceNumber & { issuedAt: string; correctedBy: InvoiceNumber | null; correctedOn: string | null }) | null;
  chargeback: { at: string; by: string; notice: string; amountMinor: number } | null;
  history: Entry[];
}

/** An invoice or corrective document in the series, with what it records (FR-FIN-013, 025). */
interface InvoiceRecord extends InvoiceSummary {
  payer: string;
  issuedAt: string;
  issuer: string;
  components: readonly FeeComponent[] | null;
}

/**
 * SM-326: one request to invoice a payment. A request that failed stays as it was; the invoice is asked for again. A
 * replacement invoice (transition 5) is never issued here: no act of the mock replaces an issued invoice.
 */
interface InvoiceRequest {
  payment: string;
  state: "REQUESTED" | "PENDING" | "ISSUED" | "FAILED" | "CORRECTED" | "CANCELLED";
  requestedAt: string;
  /** What the last attempt met: a payment not settled (the request waits), or the e-invoice service down (it failed). */
  reason: "FIN_PAYMENT_NOT_SETTLED" | "FIN_EINVOICE_UNAVAILABLE" | null;
  failedAt: string | null;
  invoice: InvoiceNumber | null;
}

/** The refund a correction makes (FR-FIN-052): who prepared it, the approver's decision, and its sending, once. */
interface RefundRecord {
  amountMinor: number;
  /** The finance officer, or RightOne (`SYSTEM`) for the return of a second payment. */
  preparedBy: { name: string; email: string };
  preparedAt: string;
  approval: RefundStep["approval"];
  sent: RefundStep["sent"];
  /** The corrective document the refund produced once sent. */
  corrective: InvoiceNumber | null;
}

/** `finance.financial_correction`, as SCR-FIN-10 reads it. */
interface CorrectionRecord {
  reference: string;
  kind: CorrectionRow["kind"];
  payment: string;
  decision: string;
  /**
   * The case the correction was made under. `finance.financial_correction` has no column for it; CAS's DR-51 reads
   * it as the correction naming the case from its own side, and AC-FR-CAS-009-02 puts it on the refund.
   */
  case: string | null;
  refund: RefundRecord | null;
  /** The calculation the correction linked in TAR (FR-FIN-011), with the fee before and after it. */
  recalculation: CorrectionDetail["recalculation"];
  premises: ConsolePremises;
  amountMinor: number;
  state: CorrectionState;
  raised: { at: string; by: string } | null;
  closedOn: string | null;
  original: CorrectionDetail["original"];
  chargeback: CorrectionDetail["chargeback"];
  consequencesSet: { at: string; by: string } | null;
  consequences: CorrectionConsequences;
  components: SettledComponent[];
  /** The owning service's review, from the moment CER opened it on the payment event; `reference` null while none is open. */
  review: { reference: string | null; record: string; dueBy: string; workingDays: number; proposedAt: string | null; openedAt: string | null } | null;
  /** The amount a refund sought holds in suspense (FR-FIN-031). */
  held: string | null;
  /** EXC-FIN-04, raised once the review passed its period (FR-FIN-055). */
  exception: CorrectionDetail["exception"];
  /** For the return of a second payment (FR-FIN-010): the payment that had already paid the fee. */
  duplicates: CorrectionDetail["duplicates"];
  history: Entry[];
}

/** A write-off proposed on an outstanding amount, and the approver's decision once taken. */
interface WriteOffRecord {
  proposal: { by: { name: string; email: string }; at: string; authority: WriteOff["proposal"]["authority"]; ground: string | null };
  outcome: WriteOff["outcome"];
}

/** `finance.held_amount` with its disposition (`finance.disposition`), as SM-328 moves it. */
interface HeldRecord {
  reference: string;
  amountMinor: number;
  reason: HeldReason;
  source: HeldAmountRow["source"];
  /** The party it is identified to (`payer_party_id`); null while it matches no payer. */
  payer: string | null;
  premises: ConsolePremises | null;
  decision: string | null;
  heldSince: string;
  state: HeldState;
  proposal: { kind: "return" | "refund"; by: { name: string; email: string }; at: string } | null;
  correction: string | null;
  /** `finance.disposition.ground`: the ground a case relied on when it decided on the amount (FR-FIN-032). */
  ground: { case: string; ground: string; recordedAt: string; by: string } | null;
  history: Entry[];
}

/** An exception FIN raised (EXC-FIN-04): what it names and when. */
interface ExceptionRow {
  kind: "EXC-FIN-04";
  raisedAt: string;
  correction: string;
  record: string;
  event: string;
}

/** The notices FIN raised on an amount owed (FR-FIN-029): the reminder before its due date and the overdue notice after it. */
interface NoticeMarks {
  reminder: { notice: string | null } | null;
  overdue: { notice: string | null } | null;
}

interface FinanceTable {
  decisions: Map<string, DecisionToPay>;
  /** Each decision's authorisations to pay (FR-FIN-037), the latest last. */
  authorisations: Map<string, AuthorisationRecord[]>;
  /** The status record each decision's fee bears on. */
  records: Map<string, string>;
  /** Where each decision's payment stood on the canvas, until a payment made here takes its place. */
  drawnPositions: Map<string, PaymentPosition>;
  instructions: Map<string, InstructionRecord>;
  payments: Map<string, PaymentRecord>;
  /** Invoices and corrective documents, in no order; a read sorts them. */
  invoices: InvoiceRecord[];
  invoiceRequests: InvoiceRequest[];
  /** SCR-FIN-10's corrections, the latest raised first. */
  corrections: CorrectionRecord[];
  /** Write-offs by the outstanding amount they are proposed on. */
  writeOffs: Map<string, WriteOffRecord>;
  /** The reference of each amount owed under a decision the canvas draws no outstanding amount for. */
  owedReferences: Map<string, string>;
  /** The due date each such amount was recorded with, which a later decision replacing its own does not change. */
  owedDueOn: Map<string, string>;
  /** The notices raised on each amount owed, by its reference. */
  notices: Map<string, NoticeMarks>;
  held: HeldRecord[];
  exceptions: ExceptionRow[];
  audit: AuditRow[];
}

/**
 * The canvas's Pasteur position is drawn at 10:14, after INS-9RFD3KQW6T was made at 10:06. A world starts at
 * 10:05, before the payer authorised it, so the seed has the chargeback and no new instruction yet.
 */
function beforeInstruction(position: PaymentPosition): PaymentPosition {
  return {
    ...position,
    checks: position.checks.filter((check) => check.check !== "new-payment-awaited"),
    chargeback: position.chargeback !== null ? { ...position.chargeback, instruction: null } : null,
  };
}

const LAYERS: readonly RightsLayer[] = ["authors", "performers", "producers"];

/** SCR-FIN-10's corrections as the board draws them at 10:14 on 1 October. */
function canvasCorrections(): CorrectionRecord[] {
  const { pasteur, daKao } = CANVAS_CORRECTIONS;
  const pasteurFee = FINANCE_SEED.decisions.find((decision) => decision.reference === pasteur.decision);
  const daKaoPayment = CANVAS_PAYMENTS.find((payment) => payment.reference === daKao.payment);
  if (pasteurFee === undefined || daKaoPayment === undefined) throw new Error("the canvas draws both corrections");
  const corrective = `${pasteur.corrective.series} ${pasteur.corrective.number}`;
  const original = `${pasteur.original.invoice.series} ${pasteur.original.invoice.number}`;
  return [
    {
      reference: pasteur.reference,
      kind: "chargeback",
      payment: pasteur.payment,
      decision: pasteur.decision,
      case: null,
      refund: null,
      recalculation: null,
      premises: pasteur.premises,
      amountMinor: pasteur.amountMinor,
      state: "OWNING_REVIEW_OPEN",
      raised: { at: pasteur.raisedAt, by: FINANCE_OFFICER.name },
      closedOn: null,
      original: {
        method: pasteur.original.method,
        amountMinor: pasteur.original.amountMinor,
        paidAt: pasteur.original.paidAt,
        reconciledAt: pasteur.original.reconciledAt,
        settlementConfirmation: pasteur.original.settlementConfirmation,
        invoice: { number: original, issuedAt: pasteur.original.invoice.issuedAt, correctedBy: corrective },
      },
      chargeback: {
        amountMinor: pasteur.chargeback.amountMinor,
        whole: pasteur.chargeback.amountMinor === pasteur.original.amountMinor,
        recordedAt: pasteur.chargeback.recordedAt,
        recordedBy: FINANCE_OFFICER.name,
        notice: pasteur.chargeback.notice,
      },
      consequencesSet: { at: pasteur.consequencesSetAt, by: FINANCE_OFFICER.name },
      consequences: {
        invoice: { corrective, original, producedAt: pasteur.consequencesSetAt, producedBy: FINANCE_OFFICER.name },
        settlement: {
          debitMinor: pasteur.chargeback.amountMinor,
          recovery: { amountMinor: pasteur.recoveryOpenMinor, recipients: [RECIPIENTS.authors, RECIPIENTS.producers] },
        },
        record: {
          record: pasteur.review.record,
          review: pasteur.review.reference,
          openedAt: pasteur.review.openedAt,
          proposedAt: pasteur.review.proposedAt,
          agreed: false,
        },
      },
      components: pasteurFee.components.map((component) => {
        const remittance = pasteur.remittances[component.layer];
        return {
          layer: component.layer,
          recipient: component.recipient,
          amountMinor: component.amountMinor,
          remittance: { reference: remittance.reference, state: remittance.state, on: remittance.on },
          recovery: remittance.state === "suspended" ? "held" : "not-decided",
        };
      }),
      review: {
        reference: pasteur.review.reference,
        record: pasteur.review.record,
        dueBy: pasteur.review.dueBy,
        workingDays: pasteur.review.workingDays,
        proposedAt: pasteur.review.proposedAt,
        openedAt: pasteur.review.openedAt,
      },
      held: null,
      exception: null,
      duplicates: null,
      history: [],
    },
    {
      reference: daKao.reference,
      kind: "transfer-reference",
      payment: daKao.payment,
      decision: daKao.decision,
      case: null,
      refund: null,
      recalculation: null,
      premises: daKao.premises,
      amountMinor: 0,
      state: "CLOSED",
      raised: null,
      closedOn: daKao.closedOn,
      original: {
        method: daKaoPayment.method,
        amountMinor: daKaoPayment.amountMinor,
        paidAt: daKaoPayment.paidOn,
        reconciledAt: SETTLED_BEFORE[daKao.decision]?.reconciledAt ?? null,
        settlementConfirmation: null,
        invoice: null,
      },
      chargeback: null,
      consequencesSet: null,
      consequences: { invoice: null, settlement: null, record: null },
      components: [],
      review: null,
      held: null,
      exception: null,
      duplicates: null,
      history: [],
    },
  ];
}

/** SCR-FIN-04's held amounts as the board draws them; the Đa Kao return proposed by the finance officer. */
function canvasHeld(): HeldRecord[] {
  const { unmatched, daKao, apMai } = CANVAS_HELD;
  const base = { correction: null, ground: null, history: [] };
  return [
    { ...base, ...unmatched, source: { ...unmatched.source }, state: "HELD", proposal: null },
    {
      ...base,
      ...daKao,
      source: { ...daKao.source },
      state: "PROPOSED",
      proposal: { kind: daKao.proposal.kind, by: FINANCE_OFFICER, at: daKao.proposal.at },
    },
    { ...base, ...apMai, source: { ...apMai.source }, state: "HELD", proposal: null },
  ];
}

/** The canvas's invoices, each with the payer, the issuer and the moment the canvas gives, and the components its decision split. */
function canvasInvoices(): InvoiceRecord[] {
  return FINANCE_SEED.invoices.map((invoice) => {
    const decision = FINANCE_SEED.decisions.find((entry) => entry.reference === invoice.decision);
    return {
      ...invoice,
      payer: FINANCE_SEED.party,
      issuer: FINANCE_SEED.collectionAuthority,
      issuedAt: INVOICE_ISSUED_AT[invoice.number] ?? invoice.issuedOn,
      // A fee paid in full is invoiced component by component; the canvas gives no split for a part of one.
      components: decision !== undefined && invoice.amountMinor === total(decision) ? decision.components : null,
    };
  });
}

function seed(): FinanceTable {
  const { nangXien } = CANVAS_OUTSTANDING;
  return {
    decisions: new Map(FINANCE_SEED.decisions.map((decision) => [decision.reference, decision])),
    authorisations: new Map(),
    records: new Map(Object.entries(FINANCE_SEED.records)),
    drawnPositions: new Map(Object.entries(FINANCE_SEED.positions).map(([decision, position]) => [decision, beforeInstruction(position)])),
    instructions: new Map(),
    payments: new Map(),
    invoices: canvasInvoices(),
    invoiceRequests: [],
    corrections: canvasCorrections(),
    writeOffs: new Map([
      [
        nangXien.reference,
        {
          proposal: { by: FINANCE_OFFICER, at: nangXien.proposal.at, authority: { threshold: nangXien.proposal.threshold }, ground: null },
          outcome: null,
        },
      ],
    ]),
    owedReferences: new Map(),
    owedDueOn: new Map(),
    notices: new Map(),
    held: canvasHeld(),
    exceptions: [],
    audit: [],
  };
}

/**
 * The world's finance, with whatever the bank, the card scheme and the e-invoice service reported since it was last
 * read applied first. Reads nothing of CER's, COM's or CAS's: CER reads `settlementOf` while it settles its own state.
 */
function financeOf(key: string): FinanceTable {
  const finance = table(key, "finance", seed);
  applyBankReports(finance, key);
  return finance;
}

const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });

/** A decision the world does not hold reads the same as one it may not see (convention 5). */
const NOT_ACCESSIBLE = refused("SRS_RESOURCE_NOT_ACCESSIBLE");

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

const accept = <T>(accepted: T): FinanceAnswer<T> => ({ accepted, refusal: null });
const refuse = <T>(code: string, field: NonNullable<FinanceAnswer<T>["refusal"]>["field"] = null, subject?: string): FinanceAnswer<T> => ({
  accepted: null,
  refusal: { code, field, ...(subject !== undefined ? { subject } : {}) },
});

/** Writes the act's audit row, accepted or refused, and hands its answer back unchanged. */
function audited<T extends LoadOutcome<unknown> | FinanceAnswer<unknown>>(
  finance: FinanceTable,
  entry: { actor: string; act: string; subject: string; rule?: string },
  answer: T,
): T {
  const code = "failure" in answer ? (answer.failure?.code ?? null) : (answer.refusal?.code ?? null);
  finance.audit.push({ at: now(), actor: entry.actor, act: entry.act, subject: entry.subject, code, rule: entry.rule ?? null, version: RULES_VERSION });
  return answer;
}

const total = (decision: { components: readonly FeeComponent[] }) => decision.components.reduce((sum, component) => sum + component.amountMinor, 0);

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

/** Paid and reconciled here and not taken back, or drawn so on the canvas (Nguyễn Huệ's and Đa Kao's transfers): SM-330's settled. */
function isSettled(finance: FinanceTable, decision: string): boolean {
  if (paymentsOf(finance, decision).some((payment) => payment.state === "RECONCILED")) return true;
  return SETTLED_BEFORE[decision] !== undefined || finance.drawnPositions.get(decision)?.status === "reconciled";
}

/** Nothing is left for the payer to pay: settled, or paid by card and waiting for the scheme's settlement. */
function isPaid(finance: FinanceTable, decision: string): boolean {
  return isSettled(finance, decision) || paymentsOf(finance, decision).some((payment) => payment.state === "PAID");
}

/** DR-355 rows 1 and 2: a decision no longer in force, or one with nothing to pay, cannot be paid. */
function decisionRefusal(decision: DecisionToPay): PayRefusal | null {
  if (decision.replacedBy !== null) return { code: "FIN_DECISION_NOT_CURRENT" };
  if (decision.outsideObligation || total(decision) === 0) return { code: "FIN_NO_PAYABLE_COMPONENT" };
  return null;
}

// ------------------------------------------------------------------ who reads and acts for the payer

/**
 * Who reads or acts on the payer's side, as PTY answers for the session (`actingAs`, `premisesActableBy`): the party
 * it acts for (by name, as FIN records a payer), the premises its authority lets it read FIN's records of
 * (PERM-696, PERM-697) and those it lets it authorise payment for (PERM-695, which PTY's scope keys file under
 * approving). The principal of the party reads and pays for every premises: the canvas draws the principal
 * authorising, the one class of payer CFG-391 is drawn with. A delegate reads and pays only where an authority of
 * theirs in force grants it; Hầu Ngọc Ánh reads Nguyễn Huệ and pays nowhere. Null for a session PTY holds no
 * premises actor for, a revoked delegate's included.
 */
interface PayerReader {
  party: string;
  account: string;
  /** The premises, by name, the reader may read FIN's records of; null for every premises of the party. */
  premises: readonly string[] | null;
  /** The premises, by name, the reader may authorise payment for; null for every premises of the party. */
  paysFor: readonly string[] | null;
  /** The principal to ask when the reader's authority does not cover payment. */
  principal: string;
}

/** The principal of an organisation: the first active RightOne ID account that signs in for it, Đỗ Thu Trang for Then Cửa Việt. */
function principalOf(organisation: string): string | null {
  const account = [...accountBook().values()].find((entry) => entry.role === "principal" && entry.state === "active" && entry.organisations.includes(organisation));
  return account?.name ?? null;
}

function payerReader(key: string): PayerReader | null {
  const acting = actingAs(key);
  if (acting === null) return null;
  const party = organisationName(acting.organisation);
  if (acting.actor === "PRINCIPAL") return { party, account: acting.name, premises: null, paysFor: null, principal: acting.name };
  const names = (permission: string) => premisesActableBy(key, permission).map((premises) => premises.name);
  return { party, account: acting.name, premises: names("PERM-696"), paysFor: names("PERM-695"), principal: principalOf(acting.organisation) ?? acting.name };
}

/** Whether the reader's authority covers paying for a premises (DR-355 row 3). */
const pays = (reader: PayerReader, premises: string) => reader.paysFor === null || reader.paysFor.includes(premises);

/** Whether a member of staff reads every party's invoices: CAS's remedy linkage looks an invoice up by its number. */
function staffSession(key: string): boolean {
  return sessions().get(key)?.role === "staff";
}

/** Whether the reader may see what a payer and a premises hold: their party, and a premises their authority reaches. */
const reaches = (reader: PayerReader, payer: string, premises: string | null) =>
  payer === reader.party && (reader.premises === null || (premises !== null && reader.premises.includes(premises)));

/** RightOne ID's id of the organisation a payer is, where RightOne ID knows it, for the notices COM sends it. */
function partyIdOf(payer: string): string | null {
  return ORGANISATIONS.find((organisation) => organisation.name === payer)?.id ?? null;
}

// ------------------------------------------------------------------ the decisions FIN collects

/** The latest payment of a decision made here and taken back, which a new payment replaces. */
function chargedBack(finance: FinanceTable, decision: string): PaymentRecord | null {
  return (
    paymentsOf(finance, decision)
      .filter((payment) => payment.state === "DISPUTED")
      .at(-1) ?? null
  );
}

/**
 * The party PTY records as operating a premises of REG's: Then Cửa Việt for its own premises, and for the premises of
 * the other parties in the review queue the party the queue names, by its name where a canvas gives one.
 */
function payerOf(premisesId: string): string {
  if (registrationSeed().premises.some((premises) => premises.id === premisesId)) return FINANCE_SEED.party;
  const other = reviewSeed().premises.find((premises) => premises.id === premisesId);
  if (other === undefined) return premisesId;
  return PARTIES[other.party]?.name ?? other.party;
}

/**
 * A decision REG holds, as FIN collects it: one layer per component, each to the recipient the canvas's fees name, a
 * split layer summed, paid by the party that operates the premises, for the fee the decision carries.
 */
function fromRegistration(key: string, ref: string): DecisionToPay | null {
  const found = decisionForCollection(key, ref);
  if (found === null) return null;
  const { record, summary } = found;
  const components: FeeComponent[] = LAYERS.map((layer) => ({
    layer,
    recipient: RECIPIENTS[layer],
    amountMinor: record.lines.filter((line) => line.layer.toLowerCase() === layer).reduce((sum, line) => sum + line.amountMinor, 0),
  }));
  return {
    reference: record.reference,
    premises: record.premises,
    payer: payerOf(summary.premises.id),
    issuedAt: record.issuedAt,
    payBy: record.payBy,
    collectionAuthority: FINANCE_SEED.collectionAuthority,
    tariffVersion: record.tariffVersion,
    outsideObligation: record.outcome === "NO_PAYABLE_OBLIGATION",
    components,
    replacedBy: record.replacedBy,
    earlierPayment: null,
  };
}

/**
 * A decision as FIN collects it: REG's decision, for the fee it carries, with the canvas's own drawing of it where
 * there is one (the payer, and the earlier payment taken back, which REG does not hold); a decision only the canvas
 * draws as it draws it; and any payment taken back here.
 */
function decisionOf(finance: FinanceTable, key: string, ref: string): DecisionToPay | null {
  const drawn = finance.decisions.get(ref);
  const held = fromRegistration(key, ref);
  const decision =
    held === null
      ? (drawn ?? null)
      : drawn === undefined
        ? held
        : { ...drawn, components: held.components, outsideObligation: held.outsideObligation, payBy: held.payBy, replacedBy: held.replacedBy, tariffVersion: held.tariffVersion };
  if (decision === null) return null;
  const back = chargedBack(finance, ref);
  return back !== null && back.chargeback !== null
    ? { ...decision, earlierPayment: { reference: back.reference, takenBackOn: addDays(back.chargeback.at, 0) } }
    : decision;
}

/** The period a decision's fee covers, as REG's decision states it; null for one REG does not hold. */
function periodOf(key: string, ref: string): { from: string; to: string } | null {
  const found = decisionForCollection(key, ref);
  return found !== null ? { from: found.record.period.from, to: found.record.period.to } : null;
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
 * The mock bank's, card scheme's and e-invoice service's reports, applied in the order they would have arrived: an
 * instruction whose decision was replaced or changed since it was made, or no longer carries a component it covers,
 * is invalidated before any transfer can settle it (FR-FIN-003, 039); a transfer that has arrived by now is recorded
 * and settled; an instruction still unpaid after its last day is invalidated; a transfer that arrives for an
 * instruction a card already paid is a second payment, held with its remedy (FR-FIN-010); a card payment whose
 * settlement the scheme has confirmed by now is reconciled; and an invoice the e-invoice service could not issue is
 * issued once the service is back (FR-FIN-070).
 */
function applyBankReports(finance: FinanceTable, key: string): void {
  const moment = Date.now();
  for (const instruction of finance.instructions.values()) {
    const arrives = Date.parse(instruction.authorisedAt) + settleSeconds() * 1000;
    if (instruction.state === "USED" && instruction.transferInFlight && moment >= arrives) {
      openRemedyCase(finance, instruction, new Date(arrives).toISOString());
      continue;
    }
    if (instruction.state !== "CREATED") continue;
    const decision = decisionOf(finance, key, instruction.decision);
    if (decision === null || decisionRefusal(decision) !== null || !coversNow(instruction, decision)) {
      invalidateInstruction(finance, instruction, "INVALIDATED_DECISION_CHANGED");
      continue;
    }
    if (moment >= arrives) settle(finance, instruction, "transfer", new Date(arrives).toISOString());
    else if (today() > instruction.validTo) invalidateInstruction(finance, instruction, "INVALIDATED_EXPIRED");
  }
  for (const payment of finance.payments.values()) {
    if (payment.state === "PAID" && payment.settlementDueAt !== null && moment >= Date.parse(payment.settlementDueAt)) {
      reconcile(finance, payment, payment.settlementDueAt);
    }
  }
  if (!einvoiceAvailable()) return;
  for (const payment of finance.payments.values()) {
    const latest = requestsOf(finance, payment.reference).at(-1);
    if (payment.state !== "RECONCILED" || payment.invoice !== null || latest?.state !== "FAILED") continue;
    requestInvoice(finance, payment, now());
    issuePayerInvoice(finance, payment, now());
  }
}

/**
 * POST /payments/{id}/invalidate-instruction (FR-FIN-003): an unused instruction can no longer be paid once its
 * decision is replaced or its fee changed, or once its last day has passed. The first reads as the decision no longer
 * in force; after either the payer authorises again. RightOne acts, and writes the act's audit row.
 */
function invalidateInstruction(finance: FinanceTable, instruction: InstructionRecord, event: "INVALIDATED_EXPIRED" | "INVALIDATED_DECISION_CHANGED"): void {
  const at = now();
  instruction.state = event === "INVALIDATED_EXPIRED" ? "EXPIRED" : "INVALIDATED";
  instruction.history.push({ at, event, by: null });
  finance.audit.push({ at, actor: SYSTEM.name, act: "invalidate-instruction", subject: instruction.reference, code: null, rule: null, version: RULES_VERSION });
}

/**
 * FR-FIN-039: an instruction settles exactly the components it covers, each for the amount its decision carries for
 * it now. A decision that no longer covers one of them, or now carries it at another amount, refuses the settlement,
 * and the instruction is invalidated as its decision changed, even where the fee's total is the same.
 */
function coversNow(instruction: InstructionRecord, decision: DecisionToPay): boolean {
  const payable = decision.components.filter((component) => component.amountMinor > 0);
  const same = (a: FeeComponent, b: FeeComponent) => a.layer === b.layer && a.recipient === b.recipient && a.amountMinor === b.amountMinor;
  return payable.length === instruction.components.length && instruction.components.every((covered) => payable.some((component) => same(covered, component)));
}

/**
 * The money arrived: the payment is recorded and its invoice requested. A transfer is reconciled at once, as is a
 * card the scheme settles at once; a card it settles later is reconciled when it does.
 */
function settle(finance: FinanceTable, instruction: InstructionRecord, method: PaymentMethod, at: string): PaymentRecord {
  const payment = recordSourceResult(finance, instruction, method, at);
  requestInvoice(finance, payment, at);
  const delay = method === "card" ? cardSettleSeconds() : 0;
  if (delay === 0) reconcile(finance, payment, at);
  else {
    payment.settlementDueAt = new Date(Date.parse(at) + delay * 1000).toISOString();
    // The invoice is asked for at once and refused while the payment is not settled (DR-367 row 1).
    issuePayerInvoice(finance, payment, at);
  }
  return payment;
}

/** The source's result (ALG-331): the payment is created PAID under its instruction, which is now used. */
function recordSourceResult(finance: FinanceTable, instruction: InstructionRecord, method: PaymentMethod, at: string): PaymentRecord {
  const payment: PaymentRecord = {
    reference: reference("PAY"),
    decision: instruction.decision,
    premises: instruction.premises,
    payer: instruction.payer,
    instruction: instruction.reference,
    method,
    amountMinor: instruction.amountMinor,
    components: instruction.components,
    collectionAuthority: instruction.accountHolder,
    state: "PAID",
    receivedAt: at,
    settlementDueAt: null,
    settlementConfirmedAt: null,
    reconciledAt: null,
    invoice: null,
    chargeback: null,
    history: [{ at, event: method === "card" ? "CARD_AUTHORISED" : "TRANSFER_RECEIVED", by: null }],
  };
  finance.payments.set(payment.reference, payment);
  instruction.state = "USED";
  instruction.history.push({ at, event: "PAID", by: null });
  return payment;
}

/** The payment's evidence matched (FR-FIN-006), and the invoice it waited for is issued. */
function reconcile(finance: FinanceTable, payment: PaymentRecord, at: string): void {
  recordPaymentReconciled(payment, at);
  issuePayerInvoice(finance, payment, at);
}

/**
 * FR-FIN-006: a paid outcome becomes reconciled once amount, reference and beneficiary match. The mock bank
 * sends the exact amount with the instruction's content, so it matches; a card is settled by the scheme's
 * confirmation, recorded at the same moment.
 */
function recordPaymentReconciled(payment: PaymentRecord, at: string): void {
  if (payment.state !== "PAID") return;
  if (payment.method === "card") payment.settlementConfirmedAt = at;
  payment.settlementDueAt = null;
  payment.state = "RECONCILED";
  payment.reconciledAt = at;
  payment.history.push({ at, event: "RECONCILED", by: null });
}

/**
 * The next number in the collection authority's series (the canvas's 1C26TRO, whose last number is 00000511):
 * e-invoice numbers run on without a gap within a series, corrective documents included.
 */
function nextInvoiceNumber(finance: FinanceTable): InvoiceNumber {
  const series = FINANCE_SEED.series;
  const last = Math.max(0, ...finance.invoices.filter((invoice) => invoice.series === series).map((invoice) => Number(invoice.number)));
  return { series, number: String(last + 1).padStart(8, "0") };
}

const requestsOf = (finance: FinanceTable, payment: string) => finance.invoiceRequests.filter((request) => request.payment === payment);

/** SM-326 transition 1's first half: the invoice of a payment is requested the moment the payment is recorded. */
function requestInvoice(finance: FinanceTable, payment: PaymentRecord, at: string): void {
  finance.invoiceRequests.push({ payment: payment.reference, state: "REQUESTED", requestedAt: at, reason: null, failedAt: null, invoice: null });
}

/**
 * POST /invoices/{id}/issue-payer-invoice (FR-FIN-025), on the open request of a payment, as DR-367 decides it: a
 * payment not settled is refused and the request waits (FIN_PAYMENT_NOT_SETTLED); with the e-invoice service down
 * the request fails, and the unissued position is kept without asserting issuance (FIN_EINVOICE_UNAVAILABLE);
 * otherwise the invoice is issued, recording the decision, the components it settles, the collection authority and
 * the payment. Answers the code it met, or null once issued.
 */
function issuePayerInvoice(finance: FinanceTable, payment: PaymentRecord, at: string): string | null {
  const request = requestsOf(finance, payment.reference).find((entry) => entry.state === "REQUESTED");
  if (request === undefined) return null;
  const outcome = ((): "FIN_PAYMENT_NOT_SETTLED" | "FIN_EINVOICE_UNAVAILABLE" | null => {
    if (payment.state !== "RECONCILED") return "FIN_PAYMENT_NOT_SETTLED";
    request.state = "PENDING";
    return einvoiceAvailable() ? null : "FIN_EINVOICE_UNAVAILABLE";
  })();
  finance.audit.push({ at, actor: "RightOne", act: "issue-payer-invoice", subject: payment.reference, code: outcome, rule: "DR-367", version: RULES_VERSION });
  if (outcome === "FIN_PAYMENT_NOT_SETTLED") {
    request.reason = outcome;
    return outcome;
  }
  if (outcome === "FIN_EINVOICE_UNAVAILABLE") {
    request.state = "FAILED";
    request.reason = outcome;
    request.failedAt = at;
    payment.history.push({ at, event: "INVOICE_FAILED", by: null });
    return outcome;
  }
  const { series, number } = nextInvoiceNumber(finance);
  finance.invoices.push({
    series,
    number,
    premises: payment.premises,
    issuedOn: addDays(at, 0),
    amountMinor: payment.amountMinor,
    corrects: null,
    correctedBy: null,
    case: null,
    payment: payment.reference,
    decision: payment.decision,
    payer: payment.payer,
    issuedAt: at,
    issuer: payment.collectionAuthority,
    components: payment.components,
  });
  request.state = "ISSUED";
  request.reason = null;
  request.invoice = { series, number };
  payment.invoice = { series, number, issuedAt: at, correctedBy: null, correctedOn: null };
  payment.history.push({ at, event: "INVOICE_ISSUED", by: null });
  return null;
}

/**
 * A corrective document for part or all of an invoice (FR-FIN-027): numbered on in the series, naming the invoice it
 * corrects, which is marked corrected and kept (SM-326 transition 4). Answers the corrective's number.
 */
function produceCorrective(
  finance: FinanceTable,
  original: InvoiceNumber,
  input: { amountMinor: number; premises: string; payment: string | null; decision: string; case: string | null; at: string },
): InvoiceNumber {
  const corrective = nextInvoiceNumber(finance);
  const corrected = finance.invoices.find((invoice) => invoice.series === original.series && invoice.number === original.number);
  if (corrected !== undefined) corrected.correctedBy = corrective.number;
  finance.invoices.push({
    ...corrective,
    premises: input.premises,
    issuedOn: addDays(input.at, 0),
    amountMinor: -input.amountMinor,
    corrects: original.number,
    correctedBy: null,
    case: input.case,
    payment: input.payment,
    decision: input.decision,
    payer: corrected?.payer ?? FINANCE_SEED.party,
    issuedAt: input.at,
    issuer: corrected?.issuer ?? FINANCE_SEED.collectionAuthority,
    components: null,
  });
  for (const request of finance.invoiceRequests) {
    if (request.invoice?.series === original.series && request.invoice.number === original.number && request.state === "ISSUED") request.state = "CORRECTED";
  }
  return corrective;
}

/**
 * SM-326 transition 6: a payment taken back before its invoice was issued cancels the request that waits for it, and no
 * invoice is issued for it. An issued invoice is corrected instead (transition 4), by the correction.
 */
function cancelInvoiceRequest(finance: FinanceTable, payment: PaymentRecord, at: string): void {
  if (payment.invoice !== null) return;
  for (const request of requestsOf(finance, payment.reference)) {
    if (request.state !== "REQUESTED") continue;
    request.state = "CANCELLED";
    request.reason = null;
    payment.history.push({ at, event: "INVOICE_REQUEST_CANCELLED", by: null });
  }
}

// ------------------------------------------------------------------ the payer's commands

/**
 * POST /payments/{id}/record-authorisation-covered then create-payment-instruction, the one act SCR-FIN-01
 * offers: the payer authorises the covered components and RightOne makes the instruction at once. DR-355 in its
 * order: a decision no longer in force (FIN_DECISION_NOT_CURRENT), one with nothing to pay (FIN_NO_PAYABLE_COMPONENT),
 * a reader whose authority does not cover payment, for whom no authorisation can be recorded
 * (FIN_PAYMENT_NOT_AUTHORISED). A decision that already has an instruction to pay, or is paid, refuses the repeat
 * with FIN_IDEMPOTENCY_CONFLICT. A refusal writes nothing but its audit row.
 */
export function authorisePayment(sessionId: string, decision: string): LoadOutcome<{ instruction: string }> {
  const finance = financeOf(sessionId);
  const reader = payerReader(sessionId);
  return audited(
    finance,
    { actor: reader?.account ?? sessionId, act: "record-authorisation-covered", subject: decision, rule: "DR-355" },
    ((): LoadOutcome<{ instruction: string }> => {
      const subject = decisionOf(finance, sessionId, decision);
      if (reader === null || subject === null || !reaches(reader, subject.payer, subject.premises)) return NOT_ACCESSIBLE;
      const refusal = decisionRefusal(subject);
      if (refusal !== null) return refused(refusal.code);
      if (!pays(reader, subject.premises)) return refused("FIN_PAYMENT_NOT_AUTHORISED");
      if (openInstruction(finance, decision) !== null || isPaid(finance, decision)) return refused("FIN_IDEMPOTENCY_CONFLICT");
      const at = now();
      const authorisation = recordAuthorisationCovered(finance, subject, reader.account, at);
      const instruction = createPaymentInstruction(finance, subject, authorisation, at);
      return "failure" in instruction ? instruction : ok({ instruction: instruction.reference });
    })(),
  );
}

/** FR-FIN-037: the authorisation, against the decision's components and their amount, before any instruction is issued. */
function recordAuthorisationCovered(finance: FinanceTable, decision: DecisionToPay, actor: string, at: string): AuthorisationRecord {
  const entries = finance.authorisations.get(decision.reference) ?? [];
  const payable = decision.components.filter((component) => component.amountMinor > 0);
  const authorisation: AuthorisationRecord = { at, by: actor, components: payable, amountMinor: total({ components: payable }), tariffVersion: decision.tariffVersion, instruction: null };
  entries.push(authorisation);
  finance.authorisations.set(decision.reference, entries);
  return authorisation;
}

/**
 * FR-FIN-001: one instruction for the payable components the authorisation covers, and only on an authorisation not
 * used yet (DR-355 row 3: with none recorded, FIN_PAYMENT_NOT_AUTHORISED). Its transfer content is its own reference,
 * as the board writes INS-9RFD3KQW6T's; it is valid to the end of the seventh day after it is made.
 */
function createPaymentInstruction(
  finance: FinanceTable,
  decision: DecisionToPay,
  authorisation: AuthorisationRecord | undefined,
  at: string,
): InstructionRecord | LoadOutcome<never> {
  if (authorisation === undefined || authorisation.instruction !== null) return refused("FIN_PAYMENT_NOT_AUTHORISED");
  const ref = reference("INS");
  const amountMinor = authorisation.amountMinor;
  const instruction: InstructionRecord = {
    reference: ref,
    decision: decision.reference,
    premises: decision.premises,
    payer: decision.payer,
    components: authorisation.components,
    amountMinor,
    authorisedAt: at,
    authorisedBy: authorisation.by,
    validTo: addDays(at, VALIDITY_DAYS),
    accountHolder: decision.collectionAuthority,
    transferContent: ref,
    qrPayload: transferCode(amountMinor, ref),
    state: "CREATED",
    transferInFlight: false,
    history: [{ at, event: "CREATED", by: authorisation.by }],
  };
  authorisation.instruction = ref;
  finance.instructions.set(ref, instruction);
  return instruction;
}

/**
 * Pay by card (FR-FIN-002): the instruction is PENDING while the card payment page is open, and the mock card
 * scheme authorises at once, so the payment is recorded before the payer is back. A reader whose authority does not
 * cover payment is refused (FIN_PAYMENT_NOT_AUTHORISED), a decision no longer payable answers its own refusal, and
 * an instruction no longer open to pay (paid meanwhile, past its last day, invalidated) refuses the stale request. A
 * payer who had sent the instruction's bank transfer as well (`MOCK_BANK_DUPLICATE_TRANSFER`) pays it twice: the
 * transfer is on its way.
 */
export function payInstructionByCard(sessionId: string, decision: string): LoadOutcome<{ payment: string }> {
  const finance = financeOf(sessionId);
  const reader = payerReader(sessionId);
  return audited(
    finance,
    { actor: reader?.account ?? sessionId, act: "show-payer-collection", subject: decision, rule: "DR-355" },
    ((): LoadOutcome<{ payment: string }> => {
      const subject = decisionOf(finance, sessionId, decision);
      if (reader === null || subject === null || !reaches(reader, subject.payer, subject.premises)) return NOT_ACCESSIBLE;
      const refusal = decisionRefusal(subject);
      if (refusal !== null) return refused(refusal.code);
      if (!pays(reader, subject.premises)) return refused("FIN_PAYMENT_NOT_AUTHORISED");
      const instruction = openInstruction(finance, decision);
      if (instruction === null) return refused("FIN_IDEMPOTENCY_CONFLICT");
      const at = now();
      instruction.state = "PENDING";
      instruction.transferInFlight = transfersAsWell();
      instruction.history.push({ at, event: "CARD_PAGE_OPENED", by: reader.account });
      return ok({ payment: settle(finance, instruction, "card", at).reference });
    })(),
  );
}

// ------------------------------------------------------------------ the payer's reads

function asPaymentInstruction(instruction: InstructionRecord): PaymentInstruction {
  return {
    reference: instruction.reference,
    state: instruction.state === "PENDING" ? "pending" : instruction.state === "EXPIRED" || instruction.state === "INVALIDATED" ? "expired" : "created",
    authorisedAt: instruction.authorisedAt,
    authorisedBy: instruction.authorisedBy,
    validTo: instruction.validTo,
    accountHolder: instruction.accountHolder,
    transferContent: instruction.transferContent,
    qrPayload: instruction.qrPayload,
  };
}

/**
 * SCR-FIN-01's decision as the world holds it: refused for a decision no longer in force or without a fee; paid,
 * once a payment settled it or is settling; refused for a reader whose authority does not cover payment, naming the
 * principal to ask; otherwise with the latest instruction not yet used, or none.
 */
export function payObligation(sessionId: string, decision: string): LoadOutcome<PayObligation> {
  const finance = financeOf(sessionId);
  const reader = payerReader(sessionId);
  const subject = decisionOf(finance, sessionId, decision);
  if (reader === null || subject === null || !reaches(reader, subject.payer, subject.premises)) return NOT_ACCESSIBLE;
  const base = { asOf: now(), decision: subject, instruction: null, refusal: decisionRefusal(subject), reader: null, paid: false };
  if (base.refusal !== null) return ok(base);
  if (isPaid(finance, decision)) return ok({ ...base, paid: true });
  if (!pays(reader, subject.premises)) {
    return ok({ ...base, refusal: { code: "FIN_PAYMENT_NOT_AUTHORISED", principal: reader.principal }, reader: { account: reader.account, authority: "read-and-submit" } });
  }
  const latest = instructionsOf(finance, decision).filter((instruction) => instruction.state !== "USED").at(-1);
  return ok({ ...base, instruction: latest !== undefined ? asPaymentInstruction(latest) : null });
}

/**
 * What the position says of a payment's invoice: issued, corrected, asked for and waiting, not issued while the service
 * was down, or never to be issued, the payment taken back before it was.
 */
function invoiceCheck(finance: FinanceTable, payment: PaymentRecord): PaymentCheck {
  const invoice = payment.invoice;
  if (invoice === null) {
    if (payment.state === "DISPUTED") return { check: "invoice-cancelled" };
    const latest = requestsOf(finance, payment.reference).at(-1);
    return latest?.state === "FAILED" && latest.failedAt !== null
      ? { check: "invoice-unavailable", issuer: payment.collectionAuthority, since: latest.failedAt }
      : { check: "invoice-requested", issuer: payment.collectionAuthority };
  }
  if (invoice.correctedBy !== null) {
    return { check: "invoice-corrected", invoice: { series: invoice.series, number: invoice.number }, correctedOn: invoice.correctedOn ?? today(), corrective: invoice.correctedBy };
  }
  return { check: "invoice-issued", invoice: { series: invoice.series, number: invoice.number }, at: invoice.issuedAt };
}

/** A payment made here, as SCR-FIN-02 reads it: paid, reconciled and invoiced, or taken back by the card scheme. */
function positionOfPayment(finance: FinanceTable, key: string, payment: PaymentRecord, decision: DecisionToPay): PaymentPosition {
  const checks: PaymentCheck[] = [{ check: "received", method: payment.method, at: payment.receivedAt }];
  checks.push(
    payment.reconciledAt !== null
      ? { check: "reconciled", at: payment.reconciledAt, settlementConfirmedAt: payment.settlementConfirmedAt }
      : { check: "awaiting-settlement" },
  );
  checks.push(invoiceCheck(finance, payment));
  const invoice = payment.invoice;
  const open = openInstruction(finance, decision.reference);
  if (payment.chargeback !== null) {
    checks.push({ check: "chargeback", at: payment.chargeback.at });
    if (open !== null) checks.push({ check: "new-payment-awaited", instruction: open.reference, validTo: open.validTo });
  }
  const earlier = decision.earlierPayment;
  return {
    subject: { kind: "payment", reference: payment.reference },
    status: payment.state === "DISPUTED" ? "disputed" : payment.state === "RECONCILED" ? "reconciled" : "paid",
    premises: decision.premises,
    party: payment.payer,
    asOf: now(),
    amountMinor: payment.amountMinor,
    method: payment.method,
    transferContent: null,
    decision: decision.reference,
    invoice: invoice !== null ? { series: invoice.series, number: invoice.number, correctedBy: invoice.correctedBy } : null,
    // The payment made again points at the one taken back, as the canvas draws it (FIN F-3).
    related: earlier !== null && earlier.reference !== payment.reference ? { relation: "replaces", payment: earlier.reference, takenBackOn: earlier.takenBackOn } : null,
    checks,
    chargeback:
      payment.chargeback !== null && decision.payBy !== null
        ? { takenBackOn: addDays(payment.chargeback.at, 0), dueAgainBy: decision.payBy, instruction: open?.reference ?? null }
        : null,
    condition: null,
    record: finance.records.get(decision.reference) ?? certificateForDecision(key, decision.reference),
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
 * A second payment of the decision that is still held or not returned yet, the latest first, with the correction that
 * returns it: the payer's position shows it until the return is sent.
 */
function secondPaymentOf(finance: FinanceTable, decision: string): { held: HeldRecord; correction: CorrectionRecord } | null {
  for (const correction of finance.corrections) {
    if (correction.kind !== "duplicate" || correction.decision !== decision || correction.refund?.sent !== null) continue;
    const held = finance.held.find((entry) => entry.reference === correction.held);
    if (held !== undefined) return { held, correction };
  }
  return null;
}

/**
 * A second payment as SCR-FIN-02 reads it, the board's duplicate: the transfer held, identified as paying a decision the
 * payment it names had already paid, so it creates no further obligation; its return follows from its correction.
 */
function secondPaymentPosition(held: HeldRecord, correction: CorrectionRecord, decision: DecisionToPay): PaymentPosition {
  const paidBy = correction.duplicates;
  const arrived = addDays(held.heldSince, 0);
  const checks: PaymentCheck[] = [{ check: "received", method: "transfer", at: held.heldSince }];
  if (paidBy !== null) checks.push({ check: "matched-as-duplicate", on: arrived, decision: decision.reference, paidBy: paidBy.payment });
  return {
    subject: { kind: "transfer", reference: held.reference, receivedOn: arrived },
    status: "held",
    premises: decision.premises,
    party: held.payer ?? decision.payer,
    asOf: now(),
    amountMinor: held.amountMinor,
    method: null,
    transferContent: held.source.kind === "transfer" ? held.source.content : null,
    decision: decision.reference,
    invoice: null,
    related: paidBy !== null ? { relation: "already-paid-by", payment: paidBy.payment, reconciledOn: addDays(paidBy.reconciledAt ?? held.heldSince, 0) } : null,
    checks,
    chargeback: null,
    condition: "duplicate",
    record: null,
  };
}

/**
 * SCR-FIN-02: where the decision's payment stands. A second payment still held or not returned yet (FR-FIN-010), else
 * the latest payment made here, or the position the canvas drew for the decision. A decision with none of these (Lê
 * Thánh Tôn's and Phan Xích Long's: the canvas draws no payment of theirs, nor one approved today and not paid yet)
 * has no position to show. The reader sees only their party's payments, of a premises their authority reaches.
 */
export function paymentPosition(sessionId: string, decision: string): LoadOutcome<PaymentPosition> {
  const finance = financeOf(sessionId);
  const reader = payerReader(sessionId);
  if (reader === null) return NOT_ACCESSIBLE;
  const latest = paymentsOf(finance, decision).at(-1);
  const subject = decisionOf(finance, sessionId, decision);
  const second = secondPaymentOf(finance, decision);
  if (second !== null && subject !== null) {
    if (!reaches(reader, second.held.payer ?? "", subject.premises)) return NOT_ACCESSIBLE;
    return ok(withRefund(finance, secondPaymentPosition(second.held, second.correction, subject)));
  }
  if (latest !== undefined && subject !== null) {
    if (!reaches(reader, latest.payer, latest.premises)) return NOT_ACCESSIBLE;
    return ok(withRefund(finance, positionOfPayment(finance, sessionId, latest, subject)));
  }
  const drawn = finance.drawnPositions.get(decision);
  if (drawn === undefined || !reaches(reader, drawn.party, drawn.premises)) return NOT_ACCESSIBLE;
  return ok(withRefund(finance, positionAsDrawn(finance, decision, drawn)));
}

/** A payment's invoice not issued yet, as the payer's list and its page show it; null once it is issued, or never asked for. */
function pendingOf(finance: FinanceTable, payment: PaymentRecord): PendingInvoice | null {
  if (payment.invoice !== null || payment.state === "DISPUTED") return null;
  const latest = requestsOf(finance, payment.reference).at(-1);
  if (latest === undefined || latest.state === "ISSUED") return null;
  const reason = latest.state === "FAILED" ? "FIN_EINVOICE_UNAVAILABLE" : "FIN_PAYMENT_NOT_SETTLED";
  return { payment: payment.reference, instruction: payment.instruction, premises: payment.premises, amountMinor: payment.amountMinor, since: latest.failedAt ?? latest.requestedAt, reason };
}

/**
 * SCR-FIN-03: the party's invoices and corrective documents, the latest first, and the invoices not issued yet; for a
 * delegate, only those of the premises their authority reaches. A member of staff reads every party's: CAS's remedy
 * linkage looks an invoice up by its number.
 */
export function invoiceList(sessionId: string): LoadOutcome<InvoiceList> {
  const finance = financeOf(sessionId);
  const reader = payerReader(sessionId);
  if (reader === null && !staffSession(sessionId)) return NOT_ACCESSIBLE;
  const mine = (payer: string, premises: string) => reader === null || reaches(reader, payer, premises);
  const invoices: InvoiceSummary[] = finance.invoices
    .filter((invoice) => mine(invoice.payer, invoice.premises))
    .map((invoice): InvoiceSummary => ({
      series: invoice.series,
      number: invoice.number,
      premises: invoice.premises,
      issuedOn: invoice.issuedOn,
      amountMinor: invoice.amountMinor,
      corrects: invoice.corrects,
      correctedBy: invoice.correctedBy,
      case: invoice.case,
      payment: invoice.payment,
      decision: invoice.decision,
    }))
    .sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.number.localeCompare(a.number));
  const pending = [...finance.payments.values()]
    .filter((payment) => mine(payment.payer, payment.premises))
    .map((payment) => pendingOf(finance, payment))
    .filter((entry): entry is PendingInvoice => entry !== null)
    .sort((a, b) => b.since.localeCompare(a.since));
  return ok({ party: reader?.party ?? FINANCE_SEED.party, premises: null, asOf: now(), invoices, pending, decisionWithoutFee: null });
}

/** The day a payment was taken back, for the corrective document that followed it: one made here, or the canvas's Pasteur chargeback. */
function chargebackDayOf(finance: FinanceTable, payment: string | null): string | null {
  if (payment === null) return null;
  const here = finance.payments.get(payment)?.chargeback ?? null;
  if (here !== null) return addDays(here.at, 0);
  const drawn = finance.corrections.find((correction) => correction.kind === "chargeback" && correction.payment === payment)?.chargeback ?? null;
  return drawn !== null ? addDays(drawn.recordedAt, 0) : null;
}

/** An invoice as the one-invoice page reads it: its documents, what it records, and the corrective document that reversed it. */
function issuedRead(finance: FinanceTable, key: string, invoice: InvoiceRecord): InvoiceRead {
  const corrective = invoice.correctedBy !== null ? finance.invoices.find((entry) => entry.series === invoice.series && entry.number === invoice.correctedBy) : undefined;
  // Components the canvas does not record on the invoice are its decision's, where the invoice settles the whole fee.
  const decision = invoice.decision !== null ? decisionOf(finance, key, invoice.decision) : null;
  const components = invoice.components ?? (decision !== null && invoice.corrects === null && total(decision) === invoice.amountMinor ? decision.components : null);
  return {
    kind: "issued",
    invoice: {
      series: invoice.series,
      number: invoice.number,
      premises: invoice.premises,
      issuedAt: invoice.issuedAt,
      issuer: invoice.issuer,
      payer: invoice.payer,
      payment: invoice.payment,
      decision: invoice.decision,
      components,
      amountMinor: invoice.amountMinor,
      corrects: invoice.corrects,
      // CFG-406: no retention period is approved, so no invoice leaves the payer's reach.
      keptUntil: null,
      correction:
        corrective !== undefined
          ? { number: corrective.number, issuedOn: corrective.issuedOn, chargebackOn: corrective.case === null ? chargebackDayOf(finance, invoice.payment) : null, case: corrective.case }
          : null,
    },
  };
}

/**
 * POST /invoices/{id}/return-invoice and keep-original-invoice (FR-FIN-026, 082), SCR-FIN-03's one invoice: an
 * issued invoice or corrective document by its number ("1C26TRO 00000418", or with a hyphen as an address writes
 * it), a corrected original as much as any other; or, by a payment's reference, the invoice of that payment, issued,
 * or not issued yet with the reason DR-367 gives. Anything of another party, or of a premises a delegate's authority
 * does not reach, is not found.
 */
export function invoiceRead(sessionId: string, asked: string): LoadOutcome<InvoiceRead> {
  const finance = financeOf(sessionId);
  const reader = payerReader(sessionId);
  if (reader === null) return NOT_ACCESSIBLE;
  const ref = asked.trim().toUpperCase().replace(/^([0-9A-Z]+)[-\s]+(\d{8})$/, "$1 $2");
  const invoice = finance.invoices.find((entry) => `${entry.series} ${entry.number}` === ref);
  if (invoice !== undefined) return reaches(reader, invoice.payer, invoice.premises) ? ok(issuedRead(finance, sessionId, invoice)) : NOT_ACCESSIBLE;
  const payment = finance.payments.get(ref);
  if (payment === undefined || !reaches(reader, payment.payer, payment.premises)) return NOT_ACCESSIBLE;
  if (payment.invoice !== null) {
    const issued = finance.invoices.find((entry) => entry.series === payment.invoice?.series && entry.number === payment.invoice.number);
    return issued !== undefined ? ok(issuedRead(finance, sessionId, issued)) : NOT_ACCESSIBLE;
  }
  const pending = pendingOf(finance, payment);
  if (pending === null) return NOT_ACCESSIBLE;
  const failed = requestsOf(finance, payment.reference).at(-1)?.failedAt ?? null;
  return ok({
    kind: "unissued",
    invoice: {
      instruction: payment.instruction,
      premises: payment.premises,
      series: FINANCE_SEED.series,
      issuer: payment.collectionAuthority,
      payer: payment.payer,
      decision: payment.decision,
      asOf: now(),
      payment: { method: payment.method, paidAt: payment.receivedAt, reconciledAt: payment.reconciledAt },
      reason: pending.reason,
      failedAt: pending.reason === "FIN_EINVOICE_UNAVAILABLE" ? failed : null,
    },
  });
}

// ------------------------------------------------------------------ the console: who acts

/** The member of staff a console read or act is for: who they are, and the spec roles they hold. */
export interface FinanceActor {
  name: string;
  email: string;
  roles: readonly StaffRole[];
}

const holds = (actor: FinanceActor, ...roles: readonly StaffRole[]) => roles.some((role) => actor.roles.includes(role));

// ------------------------------------------------------------------ the console: working days

/**
 * Vietnam's public holidays that fall on a fixed day of the Gregorian calendar (Labour Code 2019, art. 112): New
 * Year's Day, Reunification Day, Labour Day and the two days of National Day. The lunar holidays (Tết, the Hùng
 * Kings' day) move each year and are not modelled; none falls in the review periods the boards draw.
 */
const FIXED_HOLIDAYS = new Set(["01-01", "04-30", "05-01", "09-01", "09-02"]);

/** The working day `count` working days after an ISO date: the day itself is not counted (DR-368). */
function addWorkingDays(from: string, count: number): string {
  let day = from;
  for (let left = count; left > 0; ) {
    day = addDays(`${day}T12:00:00+07:00`, 1);
    const weekday = new Date(`${day}T12:00:00+07:00`).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !FIXED_HOLIDAYS.has(day.slice(5))) left -= 1;
  }
  return day;
}

/** Whole days from one ISO date to another. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// ------------------------------------------------------------------ the console: corrections (SCR-FIN-10)

/** The status record a decision's fee bears on: the canvas's, or the one CER issued under the decision. */
const recordOf = (finance: FinanceTable, key: string, decision: string) => finance.records.get(decision) ?? certificateForDecision(key, decision);

/**
 * ALG-339 steps 2 to 4, applied when the console reads or acts on the corrections: each review a correction waits
 * for is read from CER (`statusReviewState`). A review CER reports an outcome on (approved, or superseded by a
 * terminal status) agrees the correction (SM-331 transition 3); one still open is never timed out, and once it is past
 * its period the exception naming the record and the event is raised, once (EXC-FIN-04, FR-FIN-055).
 */
function agreeReviews(finance: FinanceTable, key: string): void {
  for (const correction of finance.corrections) {
    const review = correction.review;
    if (correction.state !== "OWNING_REVIEW_OPEN" || review === null || review.reference === null) continue;
    const reported = statusReviewState(key, review.reference);
    if (reported === null) continue;
    review.proposedAt = reported.proposedAt;
    const record = correction.consequences.record;
    if (record !== null && record.record !== null) correction.consequences.record = { ...record, proposedAt: reported.proposedAt };
    if (reported.state === "APPROVED" || reported.state === "SUPERSEDED") {
      const at = reported.closedAt ?? now();
      correction.state = "AGREED";
      if (record !== null && record.record !== null) correction.consequences.record = { ...record, proposedAt: reported.proposedAt, agreed: true };
      correction.history.push({ at, event: `REVIEW_REPORTED ${reported.state} AGREED`, by: null });
      continue;
    }
    if (today() > review.dueBy && correction.exception === null) {
      const raisedAt = `${addDays(`${review.dueBy}T12:00:00+07:00`, 1)}T00:00:00+07:00`;
      const event = correction.chargeback?.notice ?? correction.payment;
      correction.exception = { raisedAt, record: review.record, event };
      finance.exceptions.push({ kind: "EXC-FIN-04", raisedAt, correction: correction.reference, record: review.record, event });
      correction.history.push({ at: now(), event: "EXC-FIN-04 RAISED", by: null });
    }
  }
}

/** A review past its due date is overdue from the next day (DR-368 row 3). */
function reviewOf(correction: CorrectionRecord): CorrectionRow["review"] {
  if (correction.review === null || correction.state !== "OWNING_REVIEW_OPEN") return null;
  const overdue = today() > correction.review.dueBy;
  return {
    reference: correction.review.reference,
    dueBy: correction.review.dueBy,
    overdueSince: overdue ? addDays(`${correction.review.dueBy}T12:00:00+07:00`, 1) : null,
    approver: FINANCE_APPROVER.name,
  };
}

/** Whether RightOne itself acted, rather than a member of staff. */
const bySystem = (who: { name: string; email: string }) => who.name === SYSTEM.name && who.email === SYSTEM.email;

/** A refund as the console shows it: the preparer by name, and whether RightOne prepared it. */
function refundStep(refund: RefundRecord | null): RefundStep | null {
  if (refund === null) return null;
  return {
    amountMinor: refund.amountMinor,
    preparedBy: refund.preparedBy.name,
    preparer: bySystem(refund.preparedBy) ? "system" : "officer",
    preparedAt: refund.preparedAt,
    approval: refund.approval,
    sent: refund.sent,
  };
}

function correctionRow(correction: CorrectionRecord): CorrectionRow {
  return {
    reference: correction.reference,
    kind: correction.kind,
    payment: correction.payment,
    case: correction.case,
    refund: refundStep(correction.refund),
    premises: correction.premises,
    amountMinor: correction.amountMinor,
    state: correction.state,
    raised: correction.raised,
    closedOn: correction.closedOn,
    review: reviewOf(correction),
  };
}

/**
 * Who reads a refund waiting for approval: a finance approver who did not prepare it decides it; one who did meets the
 * segregation refusal (SOD_PREPARER_IS_APPROVER); anyone else reads it.
 */
function approvalReaderOf(actor: FinanceActor, correction: CorrectionRecord): CorrectionDetail["approvalReader"] {
  if (correction.refund === null || !holds(actor, "ACT-FIN-APR")) return "reader";
  return correction.refund.preparedBy.email === actor.email ? "same-actor" : "approver";
}

/** DR-366 for a held amount: whether a refund, transfer or retention of it waits on the reserved grounds decision. */
const reservedGrounds = (held: HeldRecord) => held.reason === "REFUND_SOUGHT" && (held.state === "HELD" || held.state === "PROPOSED") && !GROUNDS_DECISION.effective;

function correctionDetail(finance: FinanceTable, correction: CorrectionRecord, actor: FinanceActor): CorrectionDetail {
  const row = correctionRow(correction);
  const held = correction.held !== null ? finance.held.find((entry) => entry.reference === correction.held) : undefined;
  return {
    ...row,
    decision: correction.decision,
    original: correction.original,
    chargeback: correction.chargeback,
    consequencesSet: correction.consequencesSet,
    consequences: correction.consequences,
    components: correction.components,
    review:
      row.review !== null && correction.review !== null
        ? { ...row.review, record: correction.review.record, workingDays: correction.review.workingDays, proposedAt: correction.review.proposedAt }
        : null,
    recalculation: correction.recalculation,
    approvalReader: approvalReaderOf(actor, correction),
    held: held !== undefined ? { reference: held.reference, state: held.state, ground: held.ground?.ground ?? null } : null,
    groundsReserved: held !== undefined && reservedGrounds(held),
    exception: correction.state === "OWNING_REVIEW_OPEN" ? correction.exception : null,
    duplicates: correction.duplicates,
  };
}

/** A payment made here that was reconciled, or paid by card and not settled yet, as the chargeback form offers it. */
function chargeableOf(payment: PaymentRecord): ChargeablePayment {
  return {
    reference: payment.reference,
    premises: { name: payment.premises, record: null },
    method: payment.method,
    amountMinor: payment.amountMinor,
    paidOn: addDays(payment.receivedAt, 0),
  };
}

/** The payments the chargeback form names: the canvas's, then those made here, a disputed one left out. */
function chargeablePayments(finance: FinanceTable): ChargeablePayment[] {
  const disputed = new Set(finance.corrections.filter((correction) => correction.kind === "chargeback").map((correction) => correction.payment));
  const canvas = CANVAS_PAYMENTS.filter((payment) => !disputed.has(payment.reference)).map((payment) => ({
    reference: payment.reference,
    premises: payment.premises,
    method: payment.method,
    amountMinor: payment.amountMinor,
    paidOn: payment.paidOn,
  }));
  const here = [...finance.payments.values()].filter((payment) => payment.state === "RECONCILED" || (payment.state === "PAID" && payment.method === "card")).map(chargeableOf);
  return [...canvas, ...here];
}

/** The workspace's open work: amounts held, corrections not closed, amounts past their due date. */
function counts(finance: FinanceTable, key: string): FinanceCounts {
  return {
    suspense: finance.held.filter((held) => held.state === "HELD" || held.state === "PROPOSED").length,
    corrections: finance.corrections.filter((correction) => correction.state !== "CLOSED").length,
    outstanding: outstandingRows(finance, key).filter((row) => row.state === "OUTSTANDING").length,
  };
}

/** The open corrections first, the latest raised first within each; then the closed ones. */
function ordered(corrections: readonly CorrectionRecord[]): CorrectionRecord[] {
  const rank = (correction: CorrectionRecord) => (correction.state === "CLOSED" ? 1 : 0);
  return [...corrections].sort((a, b) => rank(a) - rank(b) || (b.raised?.at ?? "").localeCompare(a.raised?.at ?? ""));
}

/**
 * SCR-FIN-10: the corrections, the one asked for opened under them (else the first open one), and the payments a
 * chargeback or a refund can be recorded on. The finance officer works the corrections; the finance approver decides
 * the refunds they make (PERM-710); the auditor reads them.
 */
export function corrections(key: string, actor: FinanceActor, selected: string | null): LoadOutcome<Corrections> {
  if (!holds(actor, "ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD")) return NOT_ACCESSIBLE;
  const finance = financeOf(key);
  agreeReviews(finance, key);
  const list = ordered(finance.corrections);
  const open = list.find((correction) => correction.reference === selected) ?? list.find((correction) => correction.state !== "CLOSED") ?? list[0] ?? null;
  return ok({
    asOf: now(),
    rows: list.map(correctionRow),
    selected: open !== null ? correctionDetail(finance, open, actor) : null,
    payments: chargeablePayments(finance),
    counts: counts(finance, key),
  });
}

/**
 * POST /financial-corrections/{id}/record-chargeback-original (FR-FIN-053): the card scheme took a payment back. A
 * chargeback is a card scheme's act, so the acquirer's notice is outside the approved scope of a bank transfer
 * (FIN_EVIDENCE_OUT_OF_SCOPE); a payment already taken back refuses the repeat. A card payment can be taken back once
 * reconciled or while it is paid and not settled yet (SM-325 transitions 10 and 9); the second cancels the invoice
 * asked for and not issued (SM-326 transition 6). The payment is disputed, a correction is raised for it, its
 * components stay held for their recipients, and the fee is owed again. The payment event opens CER's review of the
 * status record the payment bears on (SM-400 transition 1), which the correction then waits for.
 */
export function recordChargeback(
  key: string,
  actor: FinanceActor,
  input: { payment: string; evidence: string; amountMinor: number | null },
): FinanceAnswer<{ correction: string }> {
  const finance = financeOf(key);
  return audited(finance, { actor: actor.name, act: "record-chargeback-original", subject: input.payment, rule: "DR-357" }, chargebackIn(finance, key, actor, input));
}

function chargebackIn(finance: FinanceTable, key: string, actor: FinanceActor, input: { payment: string; evidence: string; amountMinor: number | null }): FinanceAnswer<{ correction: string }> {
  if (!holds(actor, "ACT-FIN-OP")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const canvas = CANVAS_PAYMENTS.find((payment) => payment.reference === input.payment);
  const here = finance.payments.get(input.payment);
  if (canvas === undefined && here === undefined) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE", "payment");
  const taken = finance.corrections.some((correction) => correction.kind === "chargeback" && correction.payment === input.payment);
  if (taken || here?.state === "DISPUTED") return refuse("FIN_IDEMPOTENCY_CONFLICT");
  if (input.evidence.trim() === "") return refuse("SRS_PAYLOAD_INVALID", "evidence");
  if ((canvas?.method ?? here?.method) !== "card") return refuse("FIN_EVIDENCE_OUT_OF_SCOPE", "evidence");
  // Only a payment made here can still be taken back: the canvas's one card payment is Pasteur's, taken back already.
  if (here === undefined || (here.state !== "RECONCILED" && here.state !== "PAID")) return refuse("FIN_IDEMPOTENCY_CONFLICT");
  if (input.amountMinor === null || input.amountMinor <= 0 || input.amountMinor > here.amountMinor) return refuse("SRS_PAYLOAD_INVALID", "amount");
  const decision = decisionOf(finance, key, here.decision);
  if (decision === null) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE", "payment");
  const at = now();
  const notice = input.evidence.trim();
  here.state = "DISPUTED";
  here.settlementDueAt = null;
  here.chargeback = { at, by: actor.name, notice, amountMinor: input.amountMinor };
  here.history.push({ at, event: "CHARGEBACK_RECORDED", by: actor.name });
  cancelInvoiceRequest(finance, here, at);
  const record = recordOf(finance, key, here.decision);
  const review = record !== null ? openStatusReview(key, record, { kind: "PAYMENT_REVERSAL", event: notice, at }) : null;
  const correction: CorrectionRecord = {
    reference: reference("COR"),
    kind: "chargeback",
    payment: here.reference,
    decision: here.decision,
    case: null,
    refund: null,
    recalculation: null,
    premises: { name: here.premises, record: null },
    amountMinor: -input.amountMinor,
    state: "RAISED",
    raised: { at, by: actor.name },
    closedOn: null,
    original: {
      method: here.method,
      amountMinor: here.amountMinor,
      paidAt: here.receivedAt,
      reconciledAt: here.reconciledAt,
      settlementConfirmation: null,
      invoice: here.invoice !== null ? { number: `${here.invoice.series} ${here.invoice.number}`, issuedAt: here.invoice.issuedAt, correctedBy: null } : null,
    },
    chargeback: { amountMinor: input.amountMinor, whole: input.amountMinor === here.amountMinor, recordedAt: at, recordedBy: actor.name, notice },
    consequencesSet: null,
    consequences: { invoice: null, settlement: null, record: null },
    // The mock remits nothing, so every component of a payment made here is still held for its recipient.
    components: decision.components.map((component) => ({ ...component, remittance: null, recovery: "held" })),
    // DR-368's period runs from the day the owning service opened the review.
    review:
      record !== null && review !== null
        ? { reference: review, record, dueBy: addWorkingDays(addDays(at, 0), REVIEW_WORKING_DAYS), workingDays: REVIEW_WORKING_DAYS, proposedAt: null, openedAt: at }
        : null,
    held: null,
    exception: null,
    duplicates: null,
    history: [{ at, event: "RAISED", by: actor.name }, ...(review !== null ? [{ at, event: `OWNING_REVIEW_OPENED ${review}`, by: null }] : [])],
  };
  finance.corrections.unshift(correction);
  return accept({ correction: correction.reference });
}

/**
 * POST /financial-corrections/{id}/create-linked-calculation and determine-invoice-settlement (FR-FIN-011, 012): the
 * correction's consequences, decided once, without changing the original event. The invoice is corrected by a
 * corrective document for the amount taken back; nothing was remitted, so the debit is booked to the collection
 * account and nothing is to recover; a status record the payment bears on waits for the review its owning service
 * opened on the payment event (SM-331 transitions 1 and 2), due in 5 working days from its opening, and with no
 * record, or no review opened on it, the correction is agreed at once (transition 4).
 */
export function recordCorrection(key: string, actor: FinanceActor, ref: string): FinanceAnswer<{ state: CorrectionState }> {
  const finance = financeOf(key);
  return audited(finance, { actor: actor.name, act: "determine-invoice-settlement", subject: ref, rule: "DR-368" }, correctionIn(finance, key, actor, ref));
}

function correctionIn(finance: FinanceTable, key: string, actor: FinanceActor, ref: string): FinanceAnswer<{ state: CorrectionState }> {
  if (!holds(actor, "ACT-FIN-OP")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const correction = finance.corrections.find((entry) => entry.reference === ref);
  if (correction === undefined) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  if (correction.state !== "RAISED" || correction.chargeback === null) return refuse("FIN_IDEMPOTENCY_CONFLICT");
  const payment = finance.payments.get(correction.payment);
  if (payment === undefined) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const at = now();
  if (payment.invoice !== null) {
    const original = payment.invoice;
    const corrective = produceCorrective(finance, original, {
      amountMinor: correction.chargeback.amountMinor,
      premises: payment.premises,
      payment: payment.reference,
      decision: payment.decision,
      case: null,
      at,
    });
    original.correctedBy = corrective;
    original.correctedOn = addDays(at, 0);
    correction.original = { ...correction.original, invoice: { number: `${original.series} ${original.number}`, issuedAt: original.issuedAt, correctedBy: `${corrective.series} ${corrective.number}` } };
    correction.consequences.invoice = {
      corrective: `${corrective.series} ${corrective.number}`,
      original: `${original.series} ${original.number}`,
      producedAt: at,
      producedBy: actor.name,
    };
  } else {
    // Taken back before an invoice was issued: there is none to correct, and none is issued for it.
    correction.consequences.invoice = { corrective: null, stands: null };
  }
  correction.consequences.settlement = { debitMinor: correction.chargeback.amountMinor, recovery: null };
  correction.consequencesSet = { at, by: actor.name };
  const review = correction.review;
  if (review !== null && review.reference !== null) {
    correction.consequences.record = { record: review.record, review: review.reference, openedAt: review.openedAt, proposedAt: review.proposedAt, agreed: false };
    correction.state = "OWNING_REVIEW_OPEN";
  } else {
    correction.consequences.record = { record: null };
    correction.state = "AGREED";
  }
  correction.history.push({ at, event: `CONSEQUENCES_DETERMINED ${correction.state}`, by: actor.name });
  // A review the owning service has already decided agrees the correction straight away (transition 3).
  agreeReviews(finance, key);
  return accept({ state: correction.state });
}

/**
 * Close the correction (SM-331 transition 5): only once every consequence agrees with the financial result. While
 * the owning service reviews it, the close is refused with FIN_OWNING_REVIEW_OPEN, or FIN_OWNING_REVIEW_OVERDUE once
 * its period has passed (DR-368).
 */
export function closeCorrection(key: string, actor: FinanceActor, ref: string): FinanceAnswer<{ closedOn: string }> {
  const finance = financeOf(key);
  agreeReviews(finance, key);
  return audited(finance, { actor: actor.name, act: "raise-exception-naming", subject: ref, rule: "DR-368" }, closeIn(finance, actor, ref));
}

function closeIn(finance: FinanceTable, actor: FinanceActor, ref: string): FinanceAnswer<{ closedOn: string }> {
  if (!holds(actor, "ACT-FIN-OP")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const correction = finance.corrections.find((entry) => entry.reference === ref);
  if (correction === undefined) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  if (correction.state === "OWNING_REVIEW_OPEN") return refuse((reviewOf(correction)?.overdueSince ?? null) !== null ? "FIN_OWNING_REVIEW_OVERDUE" : "FIN_OWNING_REVIEW_OPEN");
  if (correction.state !== "AGREED") return refuse("FIN_IDEMPOTENCY_CONFLICT");
  const at = now();
  correction.state = "CLOSED";
  correction.closedOn = today();
  correction.history.push({ at, event: "CLOSED", by: actor.name });
  return accept({ closedOn: correction.closedOn });
}

// ------------------------------------------------------------------ the console: a refund a case decided (SCR-FIN-10)

/** A payment a refund can be made against: reconciled and not taken back, with what its correction shows of it. */
interface RefundablePayment {
  reference: string;
  decision: string;
  premises: ConsolePremises;
  payer: string;
  amountMinor: number;
  original: CorrectionDetail["original"];
  /** The invoice issued for it, which the refund's corrective document corrects. */
  invoice: InvoiceNumber | null;
}

/** An invoice reference as one string ("1C26TRO 00000431") split into its series and number. */
function invoiceNumberOf(text: string): InvoiceNumber | null {
  const [series, number] = text.split(" ");
  return series !== undefined && number !== undefined ? { series, number } : null;
}

/** The corrective document that corrected an invoice, as one reference, or null while none has. */
function correctedByOf(finance: FinanceTable, invoice: InvoiceNumber): string | null {
  const correctedBy = finance.invoices.find((entry) => entry.series === invoice.series && entry.number === invoice.number)?.correctedBy ?? null;
  return correctedBy !== null ? `${invoice.series} ${correctedBy}` : null;
}

/**
 * A payment made here and reconciled, or one the canvas draws paid before the session (Nguyễn Huệ's and Đa Kao's
 * transfers), as the original event of a refund. The canvas's times are its drawn position's where it draws this
 * payment, else the day it gives.
 */
function refundable(finance: FinanceTable, ref: string): RefundablePayment | null {
  const here = finance.payments.get(ref);
  if (here !== undefined) {
    if (here.state !== "RECONCILED") return null;
    const invoice = here.invoice !== null ? { series: here.invoice.series, number: here.invoice.number } : null;
    return {
      reference: here.reference,
      decision: here.decision,
      premises: { name: here.premises, record: null },
      payer: here.payer,
      amountMinor: here.amountMinor,
      original: {
        method: here.method,
        amountMinor: here.amountMinor,
        paidAt: here.receivedAt,
        reconciledAt: here.reconciledAt,
        settlementConfirmation: null,
        invoice: here.invoice !== null && invoice !== null ? { number: `${invoice.series} ${invoice.number}`, issuedAt: here.invoice.issuedAt, correctedBy: correctedByOf(finance, invoice) } : null,
      },
      invoice,
    };
  }
  const canvas = CANVAS_PAYMENTS.find((payment) => payment.reference === ref);
  const settled = canvas !== undefined ? SETTLED_BEFORE[canvas.decision] : undefined;
  if (canvas === undefined || settled === undefined || settled.payment !== ref) return null;
  if (finance.corrections.some((correction) => correction.kind === "chargeback" && correction.payment === ref)) return null;
  const drawn = finance.drawnPositions.get(canvas.decision);
  const checks = drawn !== undefined && drawn.subject.reference === ref ? drawn.checks : [];
  const received = checks.find((check) => check.check === "received");
  const issued = checks.find((check) => check.check === "invoice-issued");
  const invoice = invoiceNumberOf(settled.invoice);
  const issuedOn = invoice !== null ? (finance.invoices.find((entry) => entry.number === invoice.number)?.issuedOn ?? null) : null;
  const issuedAt = issued !== undefined && issued.check === "invoice-issued" ? issued.at : issuedOn;
  return {
    reference: canvas.reference,
    decision: canvas.decision,
    premises: canvas.premises,
    payer: FINANCE_SEED.party,
    amountMinor: canvas.amountMinor,
    original: {
      method: canvas.method,
      amountMinor: canvas.amountMinor,
      paidAt: received !== undefined && received.check === "received" ? received.at : canvas.paidOn,
      reconciledAt: settled.reconciledAt,
      settlementConfirmation: null,
      invoice: invoice !== null && issuedAt !== null ? { number: settled.invoice, issuedAt, correctedBy: correctedByOf(finance, invoice) } : null,
    },
    invoice,
  };
}

/** Whether a case is about this payment: it names the payment, the decision it paid, or the invoice issued for it. */
function caseIsAbout(subject: string | null, payment: RefundablePayment): boolean {
  if (subject === null) return false;
  const named = subject.trim().toUpperCase();
  const invoice = payment.invoice;
  return [payment.reference, payment.decision, ...(invoice !== null ? [`${invoice.series} ${invoice.number}`, invoice.number] : [])].includes(named);
}

/**
 * Record a correction that refunds part of a payment under the case that decided it (FR-FIN-011 with FR-FIN-052's
 * policy basis): the correction is raised against the payment and links its calculation in TAR, the fee less the
 * refund; the refund waits for a finance approver. The form's own refusals come first. Then CAS is read for the
 * case, in the order VER's DR-747 reads it for a correction VER makes under a case, since FIN's specification names
 * no case on a correction and no rule for it: no case (CASE_NOT_FOUND), a case not decided (CASE_NOT_DECIDED), a
 * remedy that requires no refund (REFUND_NOT_REQUIRED), a case about another payment (CASE_NOT_FOR_PAYMENT), a refund
 * already recorded under the case and not declined (REFUND_ALREADY_RECORDED, naming it). A refusal writes nothing.
 *
 * A refund of a paid amount is sought, so the amount is held in controlled suspense identified to its payer
 * (POST /held-amounts/{id}/hold-paid-amount, FR-FIN-031), with the ground the case relied on recorded on it
 * (FR-FIN-032): until DEC-32 lists the grounds it is applied to nothing else, and no refund is approved.
 */
export function recordRefund(key: string, actor: FinanceActor, input: { payment: string; caseRef: string; amountMinor: number | null }): FinanceAnswer<{ correction: string }> {
  const finance = financeOf(key);
  return audited(finance, { actor: actor.name, act: "create-linked-calculation", subject: input.payment, rule: "DR-366" }, refundIn(finance, key, actor, input));
}

function refundIn(finance: FinanceTable, key: string, actor: FinanceActor, input: { payment: string; caseRef: string; amountMinor: number | null }): FinanceAnswer<{ correction: string }> {
  if (!holds(actor, "ACT-FIN-OP")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  if (input.payment.trim() === "") return refuse("SRS_PAYLOAD_INVALID", "payment");
  const payment = refundable(finance, input.payment.trim());
  if (payment === null) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE", "payment");
  if (input.caseRef.trim() === "") return refuse("SRS_PAYLOAD_INVALID", "case");
  const amountMinor = input.amountMinor;
  if (amountMinor === null || amountMinor <= 0 || amountMinor > payment.amountMinor) return refuse("SRS_PAYLOAD_INVALID", "amount");
  const named = caseRemedyFor(key, input.caseRef);
  if (named === null) return refuse("CASE_NOT_FOUND", "case");
  if (!named.decided) return refuse("CASE_NOT_DECIDED", "case");
  if (!named.requires.includes("refund")) return refuse("REFUND_NOT_REQUIRED", "case");
  if (!caseIsAbout(named.subject, payment)) return refuse("CASE_NOT_FOR_PAYMENT", "case");
  const earlier = finance.corrections.find((entry) => entry.case === named.reference && entry.refund !== null && entry.refund.approval?.decision !== "declined");
  if (earlier !== undefined) return refuse("REFUND_ALREADY_RECORDED", "case", earlier.reference);
  const at = now();
  let ref = reference("COR");
  while (finance.corrections.some((entry) => entry.reference === ref)) ref = reference("COR");
  const linked = recordLinkedCalculation(key, { decision: payment.decision, correction: ref, caseRef: named.reference, refundMinor: amountMinor });
  const held = holdPaidAmount(finance, { payment, amountMinor, correction: ref, by: actor, at });
  recordGroundRelied(held, { case: named.reference, ground: CASE_GROUND, by: actor.name, at });
  finance.corrections.unshift({
    reference: ref,
    kind: "refund",
    payment: payment.reference,
    decision: payment.decision,
    case: named.reference,
    refund: { amountMinor, preparedBy: { name: actor.name, email: actor.email }, preparedAt: at, approval: null, sent: null, corrective: null },
    recalculation: linked !== null ? { ...linked, at, by: actor.name } : null,
    premises: payment.premises,
    amountMinor: -amountMinor,
    state: "RAISED",
    raised: { at, by: actor.name },
    closedOn: null,
    original: payment.original,
    chargeback: null,
    consequencesSet: null,
    consequences: { invoice: null, settlement: null, record: null },
    components: [],
    review: null,
    held: held.reference,
    exception: null,
    duplicates: null,
    history: [{ at, event: `RAISED under ${named.reference}, ${held.reference} HELD`, by: actor.name }],
  });
  return accept({ correction: ref });
}

/** The rule a refund's disposition answers to: DR-359 for the return of a second payment, DR-366 for a refund sought. */
const ruleOfRefund = (finance: FinanceTable, ref: string) => (finance.corrections.find((entry) => entry.reference === ref)?.kind === "duplicate" ? "DR-359" : "DR-366");

/**
 * Approve the refund, or Decline it (PERM-710): by a finance approver who did not prepare it
 * (SOD_PREPARER_IS_APPROVER), once. A decline states its reason; without one nothing is recorded. An approval is a
 * disposition of the amount the refund holds. A refund sought of a paid amount is DR-366's: while the grounds are
 * reserved it is refused (FIN_GROUNDS_RESERVED), and once DEC-32 lists them, a ground it does not list is refused
 * (FIN_GROUND_NOT_LISTED). The return of a second payment is DR-359's, money that pays nothing: approved by someone
 * other than its proposer, it applies once. An approved refund waits to be sent. A declined one makes no refund: a
 * refund sought goes back to the payment it came from, and the case's refund can be recorded again; a second payment
 * stays held for its payer (SM-328 transition 3).
 */
export function decideRefund(key: string, actor: FinanceActor, ref: string, decision: "approve" | "decline", reason: string): FinanceAnswer<{ at: string }> {
  const finance = financeOf(key);
  const rule = ruleOfRefund(finance, ref);
  return audited(finance, { actor: actor.name, act: decision === "approve" ? "record-ground-relied" : "refuse-disposition", subject: ref, rule }, decideIn(finance, actor, ref, decision, reason));
}

function decideIn(finance: FinanceTable, actor: FinanceActor, ref: string, decision: "approve" | "decline", reason: string): FinanceAnswer<{ at: string }> {
  const correction = finance.corrections.find((entry) => entry.reference === ref);
  const refund = correction?.refund ?? null;
  if (correction === undefined || refund === null || !holds(actor, "ACT-FIN-APR")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  if (refund.preparedBy.email === actor.email) return refuse("SOD_PREPARER_IS_APPROVER");
  if (refund.approval !== null) return refuse("FIN_IDEMPOTENCY_CONFLICT");
  if (decision === "decline" && reason.trim() === "") return refuse("SRS_PAYLOAD_INVALID", "reason");
  const held = correction.held !== null ? finance.held.find((entry) => entry.reference === correction.held) : undefined;
  if (decision === "approve" && held !== undefined && held.reason === "REFUND_SOUGHT") {
    const rule = groundsRule(held.ground?.ground ?? null);
    if (rule !== "LISTED") return refuse(rule === "RESERVED" ? "FIN_GROUNDS_RESERVED" : "FIN_GROUND_NOT_LISTED");
  }
  const at = now();
  refund.approval = { decision: decision === "approve" ? "approved" : "declined", by: actor.name, at, comment: reason.trim() };
  correction.history.push({ at, event: decision === "approve" ? "REFUND_APPROVED" : "REFUND_DECLINED", by: actor.name });
  if (held !== undefined) {
    // Approved, the amount is disposed of (SM-328 transition 2). Declined, a second payment stays held with no
    // proposal (transition 3); a refund no longer sought is matched back to the payment it paid (transition 4).
    const after = decision === "approve" ? "DISPOSED" : held.reason === "DUPLICATE" ? "HELD" : "RELEASED";
    held.state = after;
    if (after === "HELD") held.proposal = null;
    held.history.push({ at, event: after, by: actor.name });
  }
  return accept({ at });
}

/**
 * Send the approved refund (FR-FIN-052, PERM-709), once, to the account the payment came from. Sent, the correction's
 * consequences follow at once (SM-331 transitions 1 and 4): the invoice is corrected by a corrective document for the
 * amount refunded, which names the case as the refund does; the refund is booked to the collection account; and a
 * status record the payment bears on stands, since the fee less the refund is still paid, so no review is opened. The
 * return of a second payment corrects no invoice: it was never invoiced, and the invoice of the payment that paid the
 * fee stands, as does the record.
 */
export function sendRefund(key: string, actor: FinanceActor, ref: string): FinanceAnswer<{ invoice: string | null }> {
  const finance = financeOf(key);
  return audited(finance, { actor: actor.name, act: "execute-once-original", subject: ref, rule: ruleOfRefund(finance, ref) }, sendIn(finance, key, actor, ref));
}

function sendIn(finance: FinanceTable, key: string, actor: FinanceActor, ref: string): FinanceAnswer<{ invoice: string | null }> {
  if (!holds(actor, "ACT-FIN-OP")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const correction = finance.corrections.find((entry) => entry.reference === ref);
  const refund = correction?.refund ?? null;
  if (correction === undefined || refund === null) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  if (refund.approval?.decision !== "approved" || refund.sent !== null) return refuse("FIN_IDEMPOTENCY_CONFLICT");
  const at = now();
  refund.sent = { at, by: actor.name };
  const original = correction.kind === "duplicate" ? null : (refundable(finance, correction.payment)?.invoice ?? null);
  if (correction.kind === "duplicate") {
    const paid = correction.duplicates !== null ? (finance.payments.get(correction.duplicates.payment)?.invoice ?? null) : null;
    correction.consequences.invoice = { corrective: null, stands: paid !== null ? `${paid.series} ${paid.number}` : null };
  }
  if (original !== null) {
    const corrective = produceCorrective(finance, original, {
      amountMinor: refund.amountMinor,
      premises: correction.premises.name,
      payment: correction.payment,
      decision: correction.decision,
      case: correction.case,
      at,
    });
    const here = finance.payments.get(correction.payment)?.invoice ?? null;
    if (here !== null) {
      here.correctedBy = corrective;
      here.correctedOn = addDays(at, 0);
    }
    refund.corrective = corrective;
    const originalText = `${original.series} ${original.number}`;
    const correctiveText = `${corrective.series} ${corrective.number}`;
    if (correction.original.invoice !== null) correction.original = { ...correction.original, invoice: { ...correction.original.invoice, correctedBy: correctiveText } };
    correction.consequences.invoice = { corrective: correctiveText, original: originalText, producedAt: at, producedBy: actor.name };
  }
  correction.consequences.settlement = { debitMinor: refund.amountMinor, recovery: null };
  const record = recordOf(finance, key, correction.decision);
  correction.consequences.record = record !== null ? { record, review: null, openedAt: null, proposedAt: null, agreed: true } : { record: null };
  correction.consequencesSet = { at, by: actor.name };
  correction.state = "AGREED";
  correction.history.push({ at, event: "REFUND_SENT CONSEQUENCES_DETERMINED AGREED", by: actor.name });
  return accept({ invoice: refund.corrective !== null ? `${refund.corrective.series} ${refund.corrective.number}` : null });
}

/** The refund made against a payment, the latest first, unless the approver declined it. */
function refundOf(finance: FinanceTable, payment: string): { correction: CorrectionRecord; refund: RefundRecord } | null {
  for (const correction of finance.corrections) {
    const refund = correction.refund;
    if (correction.payment === payment && refund !== null && refund.approval?.decision !== "declined") return { correction, refund };
  }
  return null;
}

/**
 * SCR-FIN-02 with a refund of the payment in it: proposed, approved and waiting to be sent, or sent, after which the
 * invoice reads as corrected by the corrective document the refund produced.
 */
function withRefund(finance: FinanceTable, position: PaymentPosition): PaymentPosition {
  const found = refundOf(finance, position.subject.reference);
  if (found === null) return position;
  const { correction, refund } = found;
  const step: PaymentCheck =
    refund.sent !== null
      ? { check: "refunded", amountMinor: refund.amountMinor, at: refund.sent.at, case: correction.case }
      : refund.approval !== null
        ? { check: "refund-approved", on: addDays(refund.approval.at, 0) }
        : { check: "refund-proposed", on: addDays(refund.preparedAt, 0) };
  const corrective = refund.corrective;
  const correctedOn = refund.sent !== null ? addDays(refund.sent.at, 0) : null;
  const checks = position.checks.map((check): PaymentCheck =>
    check.check === "invoice-issued" && corrective !== null && correctedOn !== null ? { check: "invoice-corrected", invoice: check.invoice, correctedOn, corrective } : check,
  );
  return {
    ...position,
    checks: [...checks, step],
    invoice: position.invoice !== null && corrective !== null ? { ...position.invoice, correctedBy: corrective } : position.invoice,
  };
}

// ------------------------------------------------------------------ the console: held amounts (SCR-FIN-04)

/** DR-366 in its order: while DEC-32 is not in effect every ground is reserved; once it is, a ground it does not list is refused. */
function groundsRule(ground: string | null): "RESERVED" | "NOT_LISTED" | "LISTED" {
  if (!GROUNDS_DECISION.effective) return "RESERVED";
  return ground !== null && GROUNDS_DECISION.grounds.includes(ground) ? "LISTED" : "NOT_LISTED";
}

/**
 * POST /held-amounts/{id}/hold-paid-amount (FR-FIN-031): a paid amount whose refund is sought goes into controlled
 * suspense, identified to the payer who paid it, in the collection account, with the refund it waits on.
 */
function holdPaidAmount(
  finance: FinanceTable,
  input: { payment: RefundablePayment; amountMinor: number; correction: string; by: FinanceActor; at: string },
): HeldRecord {
  let ref = reference("HLD");
  while (finance.held.some((entry) => entry.reference === ref)) ref = reference("HLD");
  const held: HeldRecord = {
    reference: ref,
    amountMinor: input.amountMinor,
    reason: "REFUND_SOUGHT",
    source: { kind: "payment", payment: input.payment.reference },
    payer: input.payment.payer,
    premises: input.payment.premises,
    decision: input.payment.decision,
    heldSince: input.at,
    state: "PROPOSED",
    proposal: { kind: "refund", by: { name: input.by.name, email: input.by.email }, at: input.at },
    correction: input.correction,
    ground: null,
    history: [{ at: input.at, event: "HELD FIN_GROUNDS_RESERVED", by: input.by.name }],
  };
  finance.held.push(held);
  return held;
}

/** POST /held-amounts/{id}/record-ground-relied (FR-FIN-032): the ground the case relied on, kept on the amount and reportable with the others. */
function recordGroundRelied(held: HeldRecord, input: { case: string; ground: string; by: string; at: string }): void {
  held.ground = { case: input.case, ground: input.ground, recordedAt: input.at, by: input.by };
  held.history.push({ at: input.at, event: `GROUND_RECORDED ${input.ground} under ${input.case}`, by: input.by });
}

/** A new reference in the canvas's form that no record of the table holds yet. */
function unusedReference(prefix: string, taken: readonly string[]): string {
  let ref = reference(prefix);
  while (taken.includes(ref)) ref = reference(prefix);
  return ref;
}

/**
 * POST /financial-corrections/{id}/open-remedy-case (FR-FIN-010, PERM-712, ALG-331 step 5): a transfer that arrives
 * under an instruction a card already paid pays the decision a second time. It creates no further entitlement: no
 * payment is recorded for it, so the settlement CER reads, the invoice and the amount owed stay the first payment's.
 * RightOne holds it in suspense identified to its payer, its return proposed (SM-328), and opens the remedy: a
 * correction that returns it to the account it came from, once a finance approver approves the return and the finance
 * officer sends it.
 */
function openRemedyCase(finance: FinanceTable, instruction: InstructionRecord, at: string): void {
  instruction.transferInFlight = false;
  instruction.history.push({ at, event: "TRANSFER_RECEIVED_AFTER_USE", by: null });
  const paidBy = paymentsOf(finance, instruction.decision).find((payment) => payment.instruction === instruction.reference) ?? null;
  const correction = unusedReference("COR", finance.corrections.map((entry) => entry.reference));
  const held: HeldRecord = {
    reference: unusedReference("HLD", finance.held.map((entry) => entry.reference)),
    amountMinor: instruction.amountMinor,
    reason: "DUPLICATE",
    source: { kind: "transfer", receivedOn: addDays(at, 0), content: instruction.transferContent },
    payer: instruction.payer,
    premises: { name: instruction.premises, record: null },
    decision: instruction.decision,
    heldSince: at,
    state: "PROPOSED",
    proposal: { kind: "return", by: { ...SYSTEM }, at },
    correction,
    ground: null,
    history: [{ at, event: `HELD DUPLICATE of ${paidBy?.reference ?? instruction.reference}, RETURN_PROPOSED`, by: null }],
  };
  finance.held.push(held);
  finance.corrections.unshift({
    reference: correction,
    kind: "duplicate",
    payment: held.reference,
    decision: instruction.decision,
    case: null,
    refund: { amountMinor: held.amountMinor, preparedBy: { ...SYSTEM }, preparedAt: at, approval: null, sent: null, corrective: null },
    recalculation: null,
    premises: { name: instruction.premises, record: null },
    amountMinor: -held.amountMinor,
    state: "RAISED",
    raised: { at, by: SYSTEM.name },
    closedOn: null,
    original: { method: "transfer", amountMinor: held.amountMinor, paidAt: at, reconciledAt: null, settlementConfirmation: null, invoice: null },
    chargeback: null,
    consequencesSet: null,
    consequences: { invoice: null, settlement: null, record: null },
    components: [],
    review: null,
    held: held.reference,
    exception: null,
    duplicates: paidBy !== null ? { payment: paidBy.reference, reconciledAt: paidBy.reconciledAt } : null,
    history: [{ at, event: `RAISED on the second payment ${held.reference}`, by: null }],
  });
  finance.audit.push({ at, actor: SYSTEM.name, act: "open-remedy-case", subject: held.reference, code: null, rule: "ALG-331", version: RULES_VERSION });
}

function heldRow(held: HeldRecord): HeldAmountRow {
  return {
    reference: held.reference,
    amountMinor: held.amountMinor,
    reason: held.reason,
    source: held.source,
    payer: held.payer,
    premises: held.premises,
    decision: held.decision,
    heldSince: held.heldSince,
    daysHeld: daysBetween(addDays(held.heldSince.length > 10 ? held.heldSince : `${held.heldSince}T12:00:00+07:00`, 0), today()),
    state: held.state,
    proposal: held.proposal !== null ? { kind: held.proposal.kind, by: held.proposal.by.name, at: held.proposal.at } : null,
    correction: held.correction,
    groundsReserved: reservedGrounds(held),
  };
}

/**
 * SCR-FIN-04: the amounts held in suspense, oldest first, with the account they are held in, and the grounds cases
 * relied on when they decided on held amounts, reportable as a set (FR-FIN-032) so each can be reconciled against
 * the approved rule once DEC-32 takes effect. The finance officer works the queue; the approver and the auditor read it.
 */
export function suspense(key: string, actor: FinanceActor): LoadOutcome<Suspense> {
  if (!holds(actor, "ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD")) return NOT_ACCESSIBLE;
  const finance = financeOf(key);
  const rows = finance.held
    .filter((held) => held.state === "HELD" || held.state === "PROPOSED")
    .map(heldRow)
    .sort((a, b) => b.daysHeld - a.daysHeld || a.heldSince.localeCompare(b.heldSince));
  const grounds: RecordedGround[] = finance.held.flatMap((held) =>
    held.ground !== null ? [{ held: held.reference, case: held.ground.case, ground: held.ground.ground, amountMinor: held.amountMinor, recordedAt: held.ground.recordedAt }] : [],
  );
  return ok({ asOf: now(), rows, holdingAccount: { ...HOLDING_ACCOUNT }, grounds, counts: counts(finance, key) });
}

/**
 * FR-FIN-073: an amount held because its refund, transfer or retention is sought, submitted for application to an
 * obligation, is refused while the grounds are reserved (DR-366 row 1, FIN_GROUNDS_RESERVED): it is held for its
 * payer and applied to nothing else (PERM-730 lets nobody apply it). The match of money that is held for any other
 * reason is SCR-FIN-04's own act (FR-FIN-008), which this mock does not offer, so such an amount is not found here.
 */
export function applyHeldAmount(key: string, actor: FinanceActor, ref: string, decision: string): FinanceAnswer<{ applied: string }> {
  const finance = financeOf(key);
  return audited(finance, { actor: actor.name, act: "apply-held-amount", subject: `${ref} to ${decision}`, rule: "DR-366" }, applyIn(finance, actor, ref));
}

function applyIn(finance: FinanceTable, actor: FinanceActor, ref: string): FinanceAnswer<{ applied: string }> {
  if (!holds(actor, "ACT-FIN-OP", "ACT-FIN-APR")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const held = finance.held.find((entry) => entry.reference === ref && entry.reason === "REFUND_SOUGHT");
  if (held === undefined) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  if (held.state !== "HELD" && held.state !== "PROPOSED") return refuse("FIN_IDEMPOTENCY_CONFLICT");
  const rule = groundsRule(held.ground?.ground ?? null);
  return refuse(rule === "NOT_LISTED" ? "FIN_GROUND_NOT_LISTED" : "FIN_GROUNDS_RESERVED");
}

// ------------------------------------------------------------------ the console: amounts owed (SCR-FIN-14, 15)

/**
 * The later decision that adjusted an amount owed (SM-330 transition 3): REG replaced the decision it was owed under
 * after the amount fell outstanding and before it was settled. A decision replaced before its due date was never
 * outstanding, so nothing adjusted it.
 */
function adjustmentOf(finance: FinanceTable, key: string, decision: string, dueOn: string): { decision: string; from: string } | null {
  const replaced = decisionOf(finance, key, decision)?.replacedBy ?? null;
  if (replaced === null || replaced.from <= dueOn || isSettled(finance, decision)) return null;
  return { decision: replaced.reference, from: replaced.from };
}

/** SM-330: written off, settled, adjusted by a later decision, past its due date, or owed with the due date ahead. */
function stateOf(finance: FinanceTable, key: string, amount: string, decision: string, dueOn: string): OutstandingState {
  if (finance.writeOffs.get(amount)?.outcome?.decision === "approved") return "WRITTEN_OFF";
  if (isSettled(finance, decision)) return "SETTLED";
  if (adjustmentOf(finance, key, decision, dueOn) !== null) return "ADJUSTED";
  return today() > dueOn ? "OUTSTANDING" : "NOT_YET_DUE";
}

function aged(state: OutstandingState, dueOn: string): Pick<OutstandingRow, "daysPastDue" | "outstandingSince"> {
  return state === "OUTSTANDING"
    ? { daysPastDue: daysBetween(dueOn, today()), outstandingSince: addDays(`${dueOn}T12:00:00+07:00`, 1) }
    : { daysPastDue: null, outstandingSince: null };
}

/** The day, in Vietnam, a payment made here was taken back; null for one that was not. */
const chargebackDay = (payment: PaymentRecord | null): string | null => {
  const chargeback = payment?.chargeback ?? null;
  return chargeback !== null ? addDays(chargeback.at, 0) : null;
};

/** The open instruction that pays a decision again, for the owed-again line. */
function payingAgain(finance: FinanceTable, decision: string): { reference: string; validTo: string } | null {
  const open = openInstruction(finance, decision);
  return open !== null ? { reference: open.reference, validTo: open.validTo } : null;
}

/** A write-off proposed on an amount and not decided yet, as its row's message and side panel show it. */
function rowProposal(finance: FinanceTable, amount: string): OutstandingRow["proposal"] {
  const record = finance.writeOffs.get(amount);
  if (record === undefined || record.outcome !== null) return null;
  const { nangXien } = CANVAS_OUTSTANDING;
  return {
    by: record.proposal.by.name,
    at: record.proposal.at,
    approver: FINANCE_APPROVER.name,
    bankCharge: amount === nangXien.reference && record.proposal.ground === null ? { amountMinor: nangXien.received.bankChargeMinor, payment: nangXien.received.payment, on: nangXien.received.on } : null,
    ground: record.proposal.ground,
  };
}

/** Whether a write-off can be proposed on an amount now: outstanding, with no proposal waiting and none approved. */
function writeOffOpen(finance: FinanceTable, amount: string, state: OutstandingState): boolean {
  const record = finance.writeOffs.get(amount);
  return state === "OUTSTANDING" && (record === undefined || record.outcome?.decision === "declined");
}

/** The notices FIN raised on an amount, by the day COM issued each; the canvas's for Khách sạn Nắng Xiên. */
function noticeDays(finance: FinanceTable, key: string, amount: string, payer: string): OutstandingRow["notices"] {
  const { nangXien } = CANVAS_OUTSTANDING;
  if (amount === nangXien.reference) return { reminder: nangXien.notices.reminder, overdue: nangXien.notices.overdue };
  const marks = finance.notices.get(amount);
  const party = partyIdOf(payer);
  if (marks === undefined || party === null) return { reminder: null, overdue: null };
  const sent = noticesTo(key, party).data ?? [];
  const issuedOn = (notice: string | null) => {
    const issuedAt = notice !== null ? (sent.find((entry) => entry.reference === notice)?.issuedAt ?? null) : null;
    return issuedAt !== null ? addDays(issuedAt, 0) : null;
  };
  return { reminder: issuedOn(marks.reminder?.notice ?? null), overdue: issuedOn(marks.overdue?.notice ?? null) };
}

/** The three amounts the boards draw. */
function canvasRows(finance: FinanceTable, key: string): OutstandingRow[] {
  const { nangXien, pasteur, nguyenTrai } = CANVAS_OUTSTANDING;
  const nangXienState = stateOf(finance, key, nangXien.reference, nangXien.decision, nangXien.dueOn);
  const pasteurState = stateOf(finance, key, pasteur.reference, pasteur.decision, pasteur.dueOn);
  const nguyenTraiState = stateOf(finance, key, nguyenTrai.reference, nguyenTrai.decision, nguyenTrai.dueOn);
  return [
    {
      reference: nangXien.reference,
      premises: nangXien.premises,
      premisesKey: nangXien.premises.record,
      decision: nangXien.decision,
      amountMinor: nangXien.feeMinor - nangXien.received.amountMinor,
      dueOn: nangXien.dueOn,
      ...aged(nangXienState, nangXien.dueOn),
      notices: noticeDays(finance, key, nangXien.reference, nangXien.payer),
      state: nangXienState,
      owedAgain: null,
      proposal: rowProposal(finance, nangXien.reference),
      adjustedBy: adjustmentOf(finance, key, nangXien.decision, nangXien.dueOn),
      writeOffOpen: writeOffOpen(finance, nangXien.reference, nangXienState),
    },
    {
      reference: pasteur.reference,
      premises: pasteur.premises,
      premisesKey: pasteur.premises.record,
      decision: pasteur.decision,
      amountMinor: pasteur.amountMinor,
      dueOn: pasteur.dueOn,
      ...aged(pasteurState, pasteur.dueOn),
      notices: noticeDays(finance, key, pasteur.reference, pasteur.payer),
      state: pasteurState,
      // Owed again after the canvas's chargeback, or after a later one recorded here on the payment made again.
      owedAgain: {
        chargebackOn: chargebackDay(chargedBack(finance, pasteur.decision)) ?? pasteur.chargebackOn,
        instruction: payingAgain(finance, pasteur.decision),
      },
      proposal: rowProposal(finance, pasteur.reference),
      adjustedBy: adjustmentOf(finance, key, pasteur.decision, pasteur.dueOn),
      writeOffOpen: writeOffOpen(finance, pasteur.reference, pasteurState),
    },
    {
      reference: nguyenTrai.reference,
      premises: nguyenTrai.premises,
      premisesKey: nguyenTrai.premises.record,
      decision: nguyenTrai.decision,
      amountMinor: nguyenTrai.amountMinor,
      dueOn: nguyenTrai.dueOn,
      ...aged(nguyenTraiState, nguyenTrai.dueOn),
      notices: noticeDays(finance, key, nguyenTrai.reference, nguyenTrai.payer),
      state: nguyenTraiState,
      owedAgain: null,
      proposal: rowProposal(finance, nguyenTrai.reference),
      adjustedBy: adjustmentOf(finance, key, nguyenTrai.decision, nguyenTrai.dueOn),
      writeOffOpen: writeOffOpen(finance, nguyenTrai.reference, nguyenTraiState),
    },
  ];
}

/** The reference an amount owed under a decision is kept under, and its due date, given the first time the amount is read. */
function owedReference(finance: FinanceTable, decision: string, dueOn: string): string {
  const amount = finance.owedReferences.get(decision) ?? reference("OUT");
  finance.owedReferences.set(decision, amount);
  finance.owedDueOn.set(decision, finance.owedDueOn.get(decision) ?? dueOn);
  return amount;
}

/**
 * The decisions the boards' outstanding amounts and settled payments do not cover: a decision REG approved today,
 * owed until the payer pays it; a decision whose payment made here was taken back, owed again; and an amount already
 * recorded under a decision REG then replaced after it fell outstanding, which the replacing decision adjusted (SM-330
 * transition 3; one replaced before its due date was never outstanding and leaves no amount). Each keeps the
 * reference it was first given.
 */
function owedRows(finance: FinanceTable, key: string): OutstandingRow[] {
  const drawn = new Set<string>(Object.values(CANVAS_OUTSTANDING).map((amount) => amount.decision));
  const covered = new Set<string>([...FINANCE_SEED.decisions.map((decision) => decision.reference), ...Object.keys(SETTLED_BEFORE)]);
  const rows: OutstandingRow[] = [];
  for (const ref of decisionReferences(key)) {
    const back = chargedBack(finance, ref);
    // A decision the boards draw an amount for is that amount; one they draw paid is owed only once taken back here.
    if (drawn.has(ref) || (covered.has(ref) && back === null)) continue;
    const decision = decisionOf(finance, key, ref);
    if (decision === null || decision.outsideObligation || total(decision) === 0) continue;
    if (decision.replacedBy !== null) {
      const amount = finance.owedReferences.get(ref);
      const dueOn = finance.owedDueOn.get(ref);
      const adjusted = dueOn !== undefined ? adjustmentOf(finance, key, ref, dueOn) : null;
      if (amount === undefined || dueOn === undefined || adjusted === null) continue;
      rows.push({
        reference: amount,
        premises: { name: decision.premises, record: null },
        premisesKey: decision.premises,
        decision: ref,
        amountMinor: total(decision),
        dueOn,
        daysPastDue: null,
        outstandingSince: null,
        notices: noticeDays(finance, key, amount, decision.payer),
        state: "ADJUSTED",
        owedAgain: null,
        proposal: null,
        adjustedBy: adjusted,
        writeOffOpen: false,
      });
      continue;
    }
    if (decision.payBy === null) continue;
    const amount = owedReference(finance, ref, decision.payBy);
    const state = stateOf(finance, key, amount, ref, decision.payBy);
    rows.push({
      reference: amount,
      premises: { name: decision.premises, record: null },
      premisesKey: decision.premises,
      decision: ref,
      amountMinor: total(decision),
      dueOn: decision.payBy,
      ...aged(state, decision.payBy),
      notices: noticeDays(finance, key, amount, decision.payer),
      state,
      owedAgain: back !== null && back.chargeback !== null ? { chargebackOn: addDays(back.chargeback.at, 0), instruction: payingAgain(finance, ref) } : null,
      proposal: rowProposal(finance, amount),
      adjustedBy: null,
      writeOffOpen: writeOffOpen(finance, amount, state),
    });
  }
  return rows;
}

const STATE_ORDER: readonly OutstandingState[] = ["OUTSTANDING", "NOT_YET_DUE", "SETTLED", "ADJUSTED", "WRITTEN_OFF"];

/** Every amount owed in the world: the groups in SM-330's order, the soonest due first within each. */
function outstandingRows(finance: FinanceTable, key: string): OutstandingRow[] {
  return [...canvasRows(finance, key), ...owedRows(finance, key)].sort(
    (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || a.dueOn.localeCompare(b.dueOn),
  );
}

/** The payer of an amount owed, as FIN records it: the canvas's for the boards' amounts, the decision's otherwise. */
function payerOfAmount(finance: FinanceTable, key: string, row: OutstandingRow): string {
  const drawn = Object.values(CANVAS_OUTSTANDING).find((amount) => amount.reference === row.reference);
  return drawn?.payer ?? decisionOf(finance, key, row.decision)?.payer ?? row.premises.name;
}

/**
 * POST /outstanding-amounts/{id}/send-premises-notices (FR-FIN-029, DR-365 rows 1 and 2): FIN says when a notice of
 * an amount owed is owed, and COM's approved notice policy decides which notice, when and how (NTF-FIN-01). An amount
 * not yet due raises the reminder event once, with its due date as the date COM's schedule counts back from; an
 * amount past its due date raises the overdue event once. Each is raised under the amount's own occurrence, and the
 * notice COM answers is kept on the amount, so its row shows the day COM issued it. The canvas's Khách sạn Nắng Xiên
 * was sent both before the world began. No consequence beyond these notices is applied (FR-FIN-030).
 */
function sendPremisesNotices(finance: FinanceTable, key: string): void {
  const { nangXien } = CANVAS_OUTSTANDING;
  for (const row of outstandingRows(finance, key)) {
    if (row.reference === nangXien.reference || (row.state !== "NOT_YET_DUE" && row.state !== "OUTSTANDING")) continue;
    const marks = finance.notices.get(row.reference) ?? { reminder: null, overdue: null };
    finance.notices.set(row.reference, marks);
    const payer = payerOfAmount(finance, key, row);
    const party = partyIdOf(payer);
    const principal = party !== null ? [...accountBook().values()].find((entry) => entry.role === "principal" && entry.state === "active" && entry.organisations.includes(party)) : undefined;
    const event = (eventKind: string, occurrence: string) =>
      recordNoticeEvent(key, {
        sourceModule: "FIN",
        eventKind,
        occurrenceRef: `${row.reference}-${occurrence}`,
        occurredAt: now(),
        subjectKind: "obligation",
        subjectRef: row.decision,
        recipientPartyId: party,
        destination: principal?.email ?? null,
        facts: { decision: row.decision, premises: row.premises.name, amount: row.amountMinor, currency: "VND", by: row.dueOn },
      });
    if (row.state === "NOT_YET_DUE" && marks.reminder === null) marks.reminder = { notice: event("obligation_due", "REMINDER") };
    if (row.state === "OUTSTANDING" && marks.overdue === null) marks.overdue = { notice: event("obligation_outstanding", "OVERDUE") };
  }
}

/**
 * SCR-FIN-14: the amounts owed, filtered by state and premises, and the one opened in the side panel. The officer
 * proposes write-offs and the approver decides them from here, so both read it, and the auditor. Reading it raises
 * the notices the amounts owe first.
 */
export function outstandingAmounts(
  key: string,
  actor: FinanceActor,
  filter: { state: OutstandingState | null; premises: string | null },
  opened: string | null,
): LoadOutcome<OutstandingAmounts> {
  if (!holds(actor, "ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD")) return NOT_ACCESSIBLE;
  const finance = financeOf(key);
  sendPremisesNotices(finance, key);
  const all = outstandingRows(finance, key);
  const premises = [...new Map(all.map((row) => [row.premisesKey, { key: row.premisesKey, name: row.premises.name, record: row.premises.record }])).values()];
  // Every premises the boards name, so a premises with nothing owed can still be chosen (the empty view's Nguyễn Huệ).
  const named = [CANVAS_CORRECTIONS.pasteur.premises, ...CANVAS_PAYMENTS.map((payment) => payment.premises)];
  for (const entry of named) if (!premises.some((known) => known.key === entry.record)) premises.push({ key: entry.record, name: entry.name, record: entry.record });
  const rows = all.filter((row) => (filter.state === null || row.state === filter.state) && (filter.premises === null || row.premisesKey === filter.premises));
  return ok({
    asOf: now(),
    rows,
    filter,
    premises,
    opened: all.find((row) => row.reference === opened) ?? null,
    consequenceReserved: !CONSEQUENCE_DECISION.effective,
    counts: counts(finance, key),
  });
}

/**
 * POST /outstanding-amounts/{id}/apply-consequence-outstanding (FR-FIN-030, DR-365): a consequence beyond the notices,
 * asked for by a finance approver (PERM-703). The notices the policy fixes are sent first (row 2); with them sent, it
 * is refused with FIN_CONSEQUENCE_RESERVED and nothing is applied (row 3), since DEC-13 is not in force and names no
 * consequence yet. An amount that is not outstanding (not yet due, settled, adjusted, written off) has none to follow.
 */
export function applyOutstandingConsequence(key: string, actor: FinanceActor, ref: string): FinanceAnswer<{ applied: string }> {
  const finance = financeOf(key);
  return audited(finance, { actor: actor.name, act: "apply-consequence-outstanding", subject: ref, rule: "DR-365" }, consequenceIn(finance, key, actor, ref));
}

function consequenceIn(finance: FinanceTable, key: string, actor: FinanceActor, ref: string): FinanceAnswer<{ applied: string }> {
  if (!holds(actor, "ACT-FIN-APR")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const row = outstandingRows(finance, key).find((entry) => entry.reference === ref);
  if (row === undefined) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  if (row.state !== "OUTSTANDING") return refuse("FIN_IDEMPOTENCY_CONFLICT");
  sendPremisesNotices(finance, key);
  // Row 4 would apply the approved consequence; until DEC-13 is approved and names one, row 3 answers.
  return refuse("FIN_CONSEQUENCE_RESERVED");
}

function readerOf(actor: FinanceActor, record: WriteOffRecord): WriteOffReader {
  const proposer = actor.email === record.proposal.by.email;
  const approver = holds(actor, "ACT-FIN-APR");
  if (approver && proposer) return "same-actor";
  if (approver) return "approver";
  return proposer ? "proposer" : "reader";
}

/**
 * SCR-FIN-15: the write-off proposed on an amount, for the approver who decides it and the officer who proposed it: the
 * canvas's Khách sạn Nắng Xiên, short by a bank charge, or any amount owed a write-off has been proposed on.
 */
export function writeOff(key: string, actor: FinanceActor, ref: string): LoadOutcome<WriteOff> {
  if (!holds(actor, "ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD")) return NOT_ACCESSIBLE;
  const finance = financeOf(key);
  sendPremisesNotices(finance, key);
  const record = finance.writeOffs.get(ref);
  const row = outstandingRows(finance, key).find((entry) => entry.reference === ref);
  if (record === undefined || row === undefined) return NOT_ACCESSIBLE;
  const { nangXien } = CANVAS_OUTSTANDING;
  const canvas = ref === nangXien.reference;
  const decision = decisionOf(finance, key, row.decision);
  return ok({
    reference: ref,
    premises: row.premises,
    payer: payerOfAmount(finance, key, row),
    decision: row.decision,
    state: row.state,
    fee: canvas
      ? { amountMinor: nangXien.feeMinor, period: nangXien.feePeriod }
      : { amountMinor: decision !== null ? total(decision) : row.amountMinor, period: periodOf(key, row.decision) },
    received: canvas ? nangXien.received : null,
    leftMinor: row.amountMinor,
    dueOn: row.dueOn,
    useBeganOn: canvas ? nangXien.useBeganOn : (decisionForCollection(key, row.decision)?.record.useBeganOn ?? null),
    outstandingSince: addDays(`${row.dueOn}T12:00:00+07:00`, 1),
    // Its age stops the day it was written off.
    daysPastDue: daysBetween(row.dueOn, record.outcome?.decision === "approved" ? addDays(record.outcome.at, 0) : today()),
    notices: row.notices,
    proposal: { by: record.proposal.by.name, at: record.proposal.at, authority: record.proposal.authority, ground: record.proposal.ground },
    outcome: record.outcome,
    reader: readerOf(actor, record),
  });
}

/**
 * Propose a write-off (SCR-FIN-14's Propose a write-off, FR-FIN-071), in the contract's order: an amount the reader
 * may propose on (the finance officer, PERM-720 as SCR-FIN-14 cites it), one with no write-off already waiting or
 * approved (FIN_IDEMPOTENCY_CONFLICT), one past its due date and not settled, the only state SM-330 writes off from,
 * and a ground. The proposal names the authority in force, the segregation threshold recorded on 22 September and
 * awaiting approval, so a finance approver other than the proposer decides it.
 */
export function proposeWriteOff(key: string, actor: FinanceActor, ref: string, ground: string): FinanceAnswer<{ amount: string }> {
  const finance = financeOf(key);
  return audited(finance, { actor: actor.name, act: "refuse-write-off", subject: ref, rule: "SM-330" }, proposeIn(finance, key, actor, ref, ground));
}

function proposeIn(finance: FinanceTable, key: string, actor: FinanceActor, ref: string, ground: string): FinanceAnswer<{ amount: string }> {
  if (!holds(actor, "ACT-FIN-OP")) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const row = outstandingRows(finance, key).find((entry) => entry.reference === ref);
  if (row === undefined) return refuse("SRS_RESOURCE_NOT_ACCESSIBLE");
  const existing = finance.writeOffs.get(ref);
  if (existing !== undefined && existing.outcome?.decision !== "declined") return refuse("FIN_IDEMPOTENCY_CONFLICT");
  if (row.state !== "OUTSTANDING") return refuse("FIN_IDEMPOTENCY_CONFLICT");
  if (ground.trim() === "") return refuse("SRS_PAYLOAD_INVALID", "ground");
  finance.writeOffs.set(ref, {
    proposal: { by: { name: actor.name, email: actor.email }, at: now(), authority: { threshold: { ...SEGREGATION_THRESHOLD } }, ground: ground.trim() },
    outcome: null,
  });
  return accept({ amount: ref });
}

/**
 * The checks every decision on a write-off makes, in the contract's order: the record exists for this reader, the
 * reader holds the finance approver's role (PERM-720), did not propose it (SOD_PREPARER_IS_APPROVER), it is still
 * waiting for a decision, and the amount is still outstanding (SM-330 transition 4).
 */
function decidable(finance: FinanceTable, key: string, actor: FinanceActor, ref: string): { record: WriteOffRecord } | { code: string } {
  const record = finance.writeOffs.get(ref);
  if (record === undefined || !holds(actor, "ACT-FIN-APR")) return { code: "SRS_RESOURCE_NOT_ACCESSIBLE" };
  if (actor.email === record.proposal.by.email) return { code: "SOD_PREPARER_IS_APPROVER" };
  if (record.outcome !== null) return { code: "FIN_IDEMPOTENCY_CONFLICT" };
  if (outstandingRows(finance, key).find((entry) => entry.reference === ref)?.state !== "OUTSTANDING") return { code: "FIN_IDEMPOTENCY_CONFLICT" };
  return { record };
}

/**
 * Approve the write-off (FR-FIN-071, SM-330 transition 4): the amount is written off with the approver's name, the
 * proposal's authority and its ground. A proposal that names no authority is not an attributable decision, and the
 * write-off is refused; the contract names no code of its own for it.
 */
export function approveWriteOff(key: string, actor: FinanceActor, ref: string, reason: string): FinanceAnswer<{ at: string }> {
  const finance = financeOf(key);
  return audited(
    finance,
    { actor: actor.name, act: "refuse-write-off", subject: ref, rule: "SM-330" },
    ((): FinanceAnswer<{ at: string }> => {
      const check = decidable(finance, key, actor, ref);
      if ("code" in check) return refuse(check.code);
      if (check.record.proposal.authority === null) return refuse("SRS_PAYLOAD_INVALID");
      const at = now();
      check.record.outcome = { decision: "approved", by: actor.name, at, comment: reason.trim() };
      return accept({ at });
    })(),
  );
}

/** Decline the write-off: recorded with its reason, and the amount stays outstanding. A decline without a reason records nothing. */
export function declineWriteOff(key: string, actor: FinanceActor, ref: string, reason: string): FinanceAnswer<{ at: string }> {
  const finance = financeOf(key);
  return audited(
    finance,
    { actor: actor.name, act: "refuse-write-off", subject: ref, rule: "SM-330" },
    ((): FinanceAnswer<{ at: string }> => {
      const check = decidable(finance, key, actor, ref);
      if ("code" in check) return refuse(check.code);
      if (reason.trim() === "") return refuse("SRS_PAYLOAD_INVALID", "reason");
      const at = now();
      check.record.outcome = { decision: "declined", by: actor.name, at, comment: reason.trim() };
      return accept({ at });
    })(),
  );
}

// ------------------------------------------------------------------ what other families read

/**
 * A decision's fee as collected: the reconciled payment and its invoice, or null while nothing is reconciled or the
 * payment was taken back. CER reads it to know a decision's status record may issue. The signature is the contract
 * between the families. The canvas's payments made before the session answer too: Đa Kao's carries the day the
 * canvas gives, without a time.
 */
export function settlementOf(key: string, decision: string): { payment: string; reconciledAt: string; invoice: string | null } | null {
  const reconciled = paymentsOf(financeOf(key), decision)
    .filter((payment) => payment.state === "RECONCILED")
    .at(-1);
  if (reconciled === undefined || reconciled.reconciledAt === null) return SETTLED_BEFORE[decision] ?? null;
  return {
    payment: reconciled.reference,
    reconciledAt: reconciled.reconciledAt,
    invoice: reconciled.invoice !== null ? `${reconciled.invoice.series} ${reconciled.invoice.number}` : null,
  };
}

/**
 * `IPaymentReader.PaymentConditionFor`: how a payable decision's fee stands now, as CER's `DR-430` row 4 reads it. The
 * latest payment answers: reconciled in full, taken back by the card scheme and so disputed, or still on its way;
 * with none, a payment the canvas draws reconciled before the session, or pending. The mock's payments are always
 * the instruction's whole amount, so a part payment is never answered.
 */
export function paymentConditionFor(key: string, decision: string): "RECONCILED_IN_FULL" | "PENDING" | "IN_SUSPENSE_OR_DISPUTED" {
  const latest = paymentsOf(financeOf(key), decision)
    .sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt))
    .at(-1);
  if (latest === undefined) return SETTLED_BEFORE[decision] !== undefined ? "RECONCILED_IN_FULL" : "PENDING";
  return latest.state === "RECONCILED" ? "RECONCILED_IN_FULL" : latest.state === "DISPUTED" ? "IN_SUSPENSE_OR_DISPUTED" : "PENDING";
}
