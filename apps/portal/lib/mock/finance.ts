import type { LoadOutcome } from "@rightone/ui";
import type {
  DecisionToPay,
  FeeComponent,
  InvoiceList,
  InvoiceRead,
  InvoiceSummary,
  PaymentInstruction,
  PaymentPosition,
  PayObligation,
} from "@/lib/api/finance";
import { MOCK_PRINCIPAL } from "./session";

/** The view states SCR-FIN-01 was drawn in on the design canvas. */
export const FIN01_VIEWS = [
  "instruction",
  "authorise",
  "authorise-confirm",
  "repeated-request",
  "paying",
  "expired",
  "decision-not-current",
  "no-fee",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Fin01View = (typeof FIN01_VIEWS)[number];

/** The view states SCR-FIN-02 was drawn in. */
export const FIN02_VIEWS = [
  "disputed",
  "reconciled",
  "failed",
  "pending",
  "in-suspense",
  "duplicate",
  "not-found",
  "loading",
  "error",
] as const;
export type Fin02View = (typeof FIN02_VIEWS)[number];

/** The view states SCR-FIN-03 was drawn in: the list, one invoice, and an invoice not issued. */
export const FIN03_VIEWS = ["list", "one", "not-settled", "einvoice-unavailable", "empty", "loading", "error"] as const;
export type Fin03View = (typeof FIN03_VIEWS)[number];
/** The views that open one invoice rather than the list. */
export const FIN03_INVOICE_VIEWS = ["one", "not-settled", "einvoice-unavailable"] as const;
export type Fin03InvoiceView = (typeof FIN03_INVOICE_VIEWS)[number];
export type Fin03ListView = Exclude<Fin03View, Fin03InvoiceView | "loading">;

// ------------------------------------------------------------------ the data sheet

/** The sample moment of every board: Thursday 1 October 2026, 10:14 in Ho Chi Minh. */
const NOW = "2026-10-01T10:14:00+07:00";

const PARTY = MOCK_PRINCIPAL.party;
/** The delegate Hầu Ngọc Ánh acts for Nguyễn Huệ only, to read and submit; her authority does not cover payment. */
const DELEGATE = "Hầu Ngọc Ánh";

const PASTEUR = "Then Cửa Coffee & Tea – Pasteur";
const NGUYEN_HUE = "Then Cửa Coffee & Tea – Nguyễn Huệ";
const LE_THANH_TON = "Then Cửa Coffee & Tea – Lê Thánh Tôn";
const DA_KAO = "Then Cửa Bakery – Đa Kao";
const PHAN_XICH_LONG = "Then Cửa Kitchen – Phan Xích Long";

/** The designated collection authority, which also receives the authors' component. */
const COLLECTOR = "Lam Hồng";
const TARIFF_VERSION = "2026.1";
const SERIES = "1C26TRO";
const RECORD_PASTEUR = "R1-CER-2026-T7QM4BWJ";
const RECORD_HUE = "R1-CER-2026-N6PZ2RKE";

/** A fee in its three components, authors / performers / producers, in whole dong. */
function fee(authors: number, performers: number, producers: number): FeeComponent[] {
  return [
    { layer: "authors", recipient: COLLECTOR, amountMinor: authors },
    { layer: "performers", recipient: "Hạc Bạch", amountMinor: performers },
    { layer: "producers", recipient: "Trường Xuân", amountMinor: producers },
  ];
}

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({
  data: null,
  failure: { code, traceId, retryable },
});

/** A reference the reader may not see, or one that does not exist: the two read the same (convention 5). */
const NOT_ACCESSIBLE = failure("SRS_RESOURCE_NOT_ACCESSIBLE", false);

/**
 * The views a board drew for one reference. A view drawn for another reference falls back to this one's
 * first view, so a page never shows another premises' data under this reference's address.
 */
function drawnView<V extends string>(drawn: readonly V[], asked: V): V {
  return drawn.includes(asked) ? asked : (drawn[0] as V);
}

// ------------------------------------------------------------------ SCR-FIN-01

/** The decisions SCR-FIN-01 pays, from the data sheet. */
const DECISIONS = {
  pasteur: {
    reference: "OBD-3FJW6NRA5C",
    premises: PASTEUR,
    payer: PARTY,
    issuedAt: "2026-09-18T11:32:00+07:00",
    payBy: "2026-12-14",
    collectionAuthority: COLLECTOR,
    tariffVersion: TARIFF_VERSION,
    outsideObligation: false,
    components: fee(528000, 229000, 229000),
    replacedBy: null,
    // The first payment was taken back by a card chargeback on 30 September; the instruction pays it again.
    earlierPayment: { reference: "PAY-4HQT8WMZ2C", takenBackOn: "2026-09-30" },
  },
  leThanhTon: {
    reference: "OBD-6RHC4WNE9B",
    premises: LE_THANH_TON,
    payer: PARTY,
    issuedAt: "2026-09-02T09:24:00+07:00",
    payBy: null,
    collectionAuthority: COLLECTOR,
    tariffVersion: TARIFF_VERSION,
    outsideObligation: false,
    components: fee(742000, 322000, 322000),
    replacedBy: { reference: "OBD-2YDA7KMS5X", from: "2026-09-28" },
    earlierPayment: null,
  },
  phanXichLong: {
    reference: "OBD-9MZB3QFT4X",
    premises: PHAN_XICH_LONG,
    payer: PARTY,
    issuedAt: "2026-09-20T09:47:00+07:00",
    payBy: null,
    collectionAuthority: COLLECTOR,
    tariffVersion: TARIFF_VERSION,
    outsideObligation: true,
    components: fee(0, 0, 0),
    replacedBy: null,
    earlierPayment: null,
  },
  nguyenHue: {
    reference: "OBD-8KWT2PZH6M",
    premises: NGUYEN_HUE,
    payer: PARTY,
    issuedAt: "2026-09-24T16:05:00+07:00",
    payBy: "2026-11-29",
    collectionAuthority: COLLECTOR,
    tariffVersion: TARIFF_VERSION,
    outsideObligation: false,
    components: fee(1112000, 482000, 482000),
    replacedBy: null,
    earlierPayment: null,
  },
} as const satisfies Record<string, DecisionToPay>;

/** The decision each SCR-FIN-01 view was drawn on, the first being the one a view drawn on another decision falls back to. */
type Fin01Drawn = Exclude<Fin01View, "loading" | "error">;
const FIN01_DRAWN: Readonly<Record<string, { decision: DecisionToPay; views: readonly Fin01Drawn[] }>> = {
  [DECISIONS.pasteur.reference]: {
    decision: DECISIONS.pasteur,
    views: ["instruction", "authorise", "authorise-confirm", "repeated-request", "paying", "expired"],
  },
  [DECISIONS.leThanhTon.reference]: { decision: DECISIONS.leThanhTon, views: ["decision-not-current"] },
  [DECISIONS.phanXichLong.reference]: { decision: DECISIONS.phanXichLong, views: ["no-fee"] },
  // The board draws the Nguyễn Huệ decision only for the delegate, who is refused.
  [DECISIONS.nguyenHue.reference]: { decision: DECISIONS.nguyenHue, views: ["not-authorised"] },
};

/**
 * The bank-QR payload of INS-9RFD3KQW6T: the collection account, the amount and the transfer content, as
 * the board carries it. The bank identifier and the account are the canvas's placeholders, not a bank.
 */
export const QR_PAYLOAD =
  "00020101021238560010A0000007270126000699999901121903742855160208QRIBFTTA530370454069860005802VN62180814INS-9RFD3KQW6T6304AF0B";

function instruction(state: PaymentInstruction["state"]): PaymentInstruction {
  return {
    reference: "INS-9RFD3KQW6T",
    state,
    authorisedAt: "2026-10-01T10:06:00+07:00",
    authorisedBy: MOCK_PRINCIPAL.account,
    validTo: "2026-10-08",
    accountHolder: COLLECTOR,
    // The transfer content is the instruction's reference, as the board writes it and the code carries it.
    transferContent: "INS-9RFD3KQW6T",
    qrPayload: QR_PAYLOAD,
  };
}

/**
 * SCR-FIN-01's answers. Pasteur pays again after its chargeback: authorised at 10:05, the instruction made at
 * 10:06, the card page opened at 10:41, the instruction read after its last day on 9 October at 08:30. Lê
 * Thánh Tôn's decision was replaced on 28 September; Phan Xích Long's has no fee; the delegate reads the
 * Nguyễn Huệ decision on 24 September at 16:20, before its fee was paid.
 */
export function mockPayObligation(decision: string, view: Exclude<Fin01View, "loading">): LoadOutcome<PayObligation> {
  if (view === "error") return failure("INTERNAL_ERROR", true, "9b2e4c71f05ad386");
  const drawn = FIN01_DRAWN[decision];
  if (drawn === undefined) return NOT_ACCESSIBLE;
  const base = { decision: drawn.decision, instruction: null, refusal: null, reader: null, paid: false };
  switch (drawnView(drawn.views, view)) {
    case "instruction":
      return { data: { ...base, asOf: NOW, instruction: instruction("created") }, failure: null };
    case "paying":
      return { data: { ...base, asOf: "2026-10-01T10:41:00+07:00", instruction: instruction("pending") }, failure: null };
    case "expired":
      return { data: { ...base, asOf: "2026-10-09T08:30:00+07:00", instruction: instruction("expired") }, failure: null };
    case "authorise":
    case "authorise-confirm":
      return { data: { ...base, asOf: "2026-10-01T10:05:00+07:00" }, failure: null };
    case "repeated-request":
      return { data: { ...base, asOf: "2026-10-01T10:05:00+07:00", refusal: { code: "FIN_IDEMPOTENCY_CONFLICT" } }, failure: null };
    case "decision-not-current":
      return { data: { ...base, asOf: NOW, refusal: { code: "FIN_DECISION_NOT_CURRENT" } }, failure: null };
    case "no-fee":
      return { data: { ...base, asOf: NOW, refusal: { code: "FIN_NO_PAYABLE_COMPONENT" } }, failure: null };
    case "not-authorised":
      return {
        data: {
          ...base,
          asOf: "2026-09-24T16:20:00+07:00",
          refusal: { code: "FIN_PAYMENT_NOT_AUTHORISED", principal: MOCK_PRINCIPAL.account },
          reader: { account: DELEGATE, authority: "read-and-submit" },
        },
        failure: null,
      };
  }
}

// ------------------------------------------------------------------ SCR-FIN-02

const PASTEUR_RECONCILED: PaymentPosition = {
  subject: { kind: "payment", reference: "PAY-4HQT8WMZ2C" },
  status: "reconciled",
  premises: PASTEUR,
  party: PARTY,
  // The first Pasteur payment as it stood once its invoice was issued, before the chargeback of 30 September.
  asOf: "2026-09-18T11:44:00+07:00",
  amountMinor: 986000,
  method: "card",
  transferContent: null,
  decision: DECISIONS.pasteur.reference,
  invoice: { series: SERIES, number: "00000418", correctedBy: null },
  related: null,
  checks: [
    { check: "received", method: "card", at: "2026-09-18T11:34:00+07:00" },
    { check: "reconciled", at: "2026-09-18T11:38:00+07:00", settlementConfirmedAt: "2026-09-18T11:37:00+07:00" },
    { check: "invoice-issued", invoice: { series: SERIES, number: "00000418" }, at: "2026-09-18T11:44:00+07:00" },
  ],
  chargeback: null,
  condition: null,
  record: RECORD_PASTEUR,
};

const PASTEUR_DISPUTED: PaymentPosition = {
  subject: { kind: "payment", reference: "PAY-4HQT8WMZ2C" },
  status: "disputed",
  premises: PASTEUR,
  party: PARTY,
  asOf: NOW,
  amountMinor: 986000,
  method: "card",
  transferContent: null,
  decision: DECISIONS.pasteur.reference,
  invoice: { series: SERIES, number: "00000418", correctedBy: { series: SERIES, number: "00000511" } },
  related: null,
  checks: [
    { check: "received", method: "card", at: "2026-09-18T11:34:00+07:00" },
    { check: "reconciled", at: "2026-09-18T11:38:00+07:00", settlementConfirmedAt: "2026-09-18T11:37:00+07:00" },
    {
      check: "invoice-corrected",
      invoice: { series: SERIES, number: "00000418" },
      correctedOn: "2026-10-01",
      corrective: { series: SERIES, number: "00000511" },
    },
    { check: "chargeback", at: "2026-09-30T17:42:00+07:00" },
    { check: "new-payment-awaited", instruction: "INS-9RFD3KQW6T", validTo: "2026-10-08" },
    { check: "record-review", record: RECORD_PASTEUR, dueBy: "2026-10-07" },
  ],
  chargeback: { takenBackOn: "2026-09-30", dueAgainBy: "2026-12-14", instruction: "INS-9RFD3KQW6T" },
  condition: null,
  record: RECORD_PASTEUR,
};

const PASTEUR_PENDING: PaymentPosition = {
  subject: { kind: "instruction", reference: "INS-9RFD3KQW6T" },
  status: "paid",
  premises: PASTEUR,
  party: PARTY,
  // The card payment made again at 10:42 (SCR-FIN-01 paying, 10:41), read one minute after.
  asOf: "2026-10-01T10:43:00+07:00",
  amountMinor: 986000,
  method: "card",
  transferContent: null,
  decision: DECISIONS.pasteur.reference,
  invoice: null,
  related: { relation: "replaces", payment: "PAY-4HQT8WMZ2C", takenBackOn: "2026-09-30" },
  checks: [
    { check: "received", method: "card", at: "2026-10-01T10:42:00+07:00" },
    { check: "awaiting-settlement" },
    { check: "invoice-requested", issuer: COLLECTOR },
    // The suspension was decided at 10:31 and takes effect at 14:00 (SCR-CER-06).
    {
      check: "record-suspended",
      record: RECORD_PASTEUR,
      from: "2026-10-01T14:00:00+07:00",
      decidedAt: "2026-10-01T10:31:00+07:00",
    },
  ],
  chargeback: null,
  condition: null,
  record: RECORD_PASTEUR,
};

const HUE_RECONCILED: PaymentPosition = {
  subject: { kind: "payment", reference: "PAY-2NVK6TXH8B" },
  status: "reconciled",
  premises: NGUYEN_HUE,
  party: PARTY,
  asOf: NOW,
  amountMinor: 2076000,
  method: "transfer",
  transferContent: null,
  decision: DECISIONS.nguyenHue.reference,
  invoice: { series: SERIES, number: "00000431", correctedBy: null },
  related: { relation: "earlier-attempt", payment: "PAY-7XCM2DQN5V", declinedAt: "2026-09-24T16:41:00+07:00" },
  checks: [
    { check: "received", method: "transfer", at: "2026-09-24T16:50:00+07:00" },
    { check: "reconciled", at: "2026-09-24T16:51:00+07:00", settlementConfirmedAt: null },
    { check: "invoice-issued", invoice: { series: SERIES, number: "00000431" }, at: "2026-09-24T16:58:00+07:00" },
  ],
  chargeback: null,
  condition: null,
  record: RECORD_HUE,
};

const HUE_FAILED: PaymentPosition = {
  subject: { kind: "payment", reference: "PAY-7XCM2DQN5V" },
  status: "failed",
  premises: NGUYEN_HUE,
  party: PARTY,
  asOf: NOW,
  amountMinor: 2076000,
  method: "card",
  transferContent: null,
  decision: DECISIONS.nguyenHue.reference,
  invoice: null,
  related: { relation: "paid-by", payment: "PAY-2NVK6TXH8B", at: "2026-09-24T16:50:00+07:00" },
  checks: [{ check: "card-declined", at: "2026-09-24T16:41:00+07:00" }],
  chargeback: null,
  condition: null,
  record: null,
};

/** The Đa Kao transfer of 29 September, held: first unmatched, then found to pay OBD-4NPV8CRA2J twice. */
const DA_KAO_HELD = {
  subject: { kind: "transfer", reference: "HLD-3TWQ8KXN5F", receivedOn: "2026-09-29" },
  status: "held",
  party: PARTY,
  amountMinor: 1152000,
  method: null,
  transferContent: "THEN CUA DAKAO PHI BAN QUYEN",
  invoice: null,
  chargeback: null,
  record: null,
} as const;

const DA_KAO_IN_SUSPENSE: PaymentPosition = {
  ...DA_KAO_HELD,
  // Before it is identified the transfer belongs to no premises; it is read at 15:20 on the day it arrived.
  premises: null,
  asOf: "2026-09-29T15:20:00+07:00",
  decision: null,
  related: null,
  checks: [{ check: "received", method: "transfer", at: "2026-09-29T15:06:00+07:00" }, { check: "unmatched" }],
  condition: "in-suspense",
};

const DA_KAO_DUPLICATE: PaymentPosition = {
  ...DA_KAO_HELD,
  premises: DA_KAO,
  asOf: NOW,
  decision: "OBD-4NPV8CRA2J",
  related: { relation: "already-paid-by", payment: "PAY-6DKA3RWQ7M", reconciledOn: "2026-09-10" },
  checks: [
    { check: "received", method: "transfer", at: "2026-09-29T15:06:00+07:00" },
    { check: "matched-as-duplicate", on: "2026-09-30", decision: "OBD-4NPV8CRA2J", paidBy: "PAY-6DKA3RWQ7M" },
    { check: "refund-proposed", on: "2026-09-30" },
  ],
  condition: "duplicate",
};

/** The positions each decision was drawn in, the first being the one a view drawn on another decision falls back to. */
const FIN02_DRAWN: Readonly<Record<string, Partial<Record<Fin02View, PaymentPosition>>>> = {
  // Pasteur's reconciled review state is its first payment before the chargeback; the board draws that state on
  // the Nguyễn Huệ transfer, which is also the review state on Nguyễn Huệ's decision.
  [DECISIONS.pasteur.reference]: { reconciled: PASTEUR_RECONCILED, disputed: PASTEUR_DISPUTED, pending: PASTEUR_PENDING },
  [DECISIONS.nguyenHue.reference]: { reconciled: HUE_RECONCILED, failed: HUE_FAILED },
  "OBD-4NPV8CRA2J": { duplicate: DA_KAO_DUPLICATE, "in-suspense": DA_KAO_IN_SUSPENSE },
};

/** SCR-FIN-02's answers, by decision and view. */
export function mockPaymentPosition(decision: string, view: Exclude<Fin02View, "loading">): LoadOutcome<PaymentPosition> {
  if (view === "error") return failure("INTERNAL_ERROR", true, "4f8a17c2e39b60d5");
  const drawn = FIN02_DRAWN[decision];
  if (drawn === undefined || view === "not-found") return NOT_ACCESSIBLE;
  const views = Object.keys(drawn) as Fin02View[];
  const position = drawn[drawnView(views, view)];
  return position === undefined ? NOT_ACCESSIBLE : { data: position, failure: null };
}

// ------------------------------------------------------------------ SCR-FIN-03

/**
 * Then Cửa's invoices, the latest first. Amounts are whole dong; the corrective document reverses the whole fee. Each
 * records the payment and the decision the canvas pairs it with: Lê Thánh Tôn's 252,000 VND of 27 September is the
 * amended decision OBD-2YDA7KMS5X's 1,638,000 VND less the 1,386,000 VND already paid, and the canvas names no payment
 * for it or for the first Lê Thánh Tôn invoice.
 */
const INVOICES: readonly InvoiceSummary[] = [
  { series: SERIES, number: "00000511", premises: PASTEUR, issuedOn: "2026-10-01", amountMinor: -986000, corrects: "00000418", correctedBy: null, case: null, payment: "PAY-4HQT8WMZ2C", decision: DECISIONS.pasteur.reference },
  { series: SERIES, number: "00000489", premises: LE_THANH_TON, issuedOn: "2026-09-27", amountMinor: 252000, corrects: null, correctedBy: null, case: null, payment: null, decision: "OBD-2YDA7KMS5X" },
  { series: SERIES, number: "00000431", premises: NGUYEN_HUE, issuedOn: "2026-09-24", amountMinor: 2076000, corrects: null, correctedBy: null, case: null, payment: "PAY-2NVK6TXH8B", decision: DECISIONS.nguyenHue.reference },
  { series: SERIES, number: "00000418", premises: PASTEUR, issuedOn: "2026-09-18", amountMinor: 986000, corrects: null, correctedBy: "00000511", case: null, payment: "PAY-4HQT8WMZ2C", decision: DECISIONS.pasteur.reference },
  { series: SERIES, number: "00000362", premises: DA_KAO, issuedOn: "2026-09-10", amountMinor: 1152000, corrects: null, correctedBy: null, case: null, payment: "PAY-6DKA3RWQ7M", decision: "OBD-4NPV8CRA2J" },
  { series: SERIES, number: "00000297", premises: LE_THANH_TON, issuedOn: "2026-09-02", amountMinor: 1386000, corrects: null, correctedBy: null, case: null, payment: null, decision: DECISIONS.leThanhTon.reference },
];

/** The moments the canvas gives for its invoices beyond the day: Pasteur's first invoice and Nguyễn Huệ's. */
export const INVOICE_ISSUED_AT: Readonly<Record<string, string>> = {
  "00000418": "2026-09-18T11:44:00+07:00",
  "00000431": "2026-09-24T16:58:00+07:00",
};

/** SCR-FIN-03, the list: every invoice of the party; Phan Xích Long, whose decision has no fee, has none. */
export function mockInvoiceList(view: Fin03ListView): LoadOutcome<InvoiceList> {
  switch (view) {
    case "list":
      return { data: { party: PARTY, premises: null, asOf: NOW, invoices: INVOICES, pending: [], decisionWithoutFee: null }, failure: null };
    case "empty":
      return {
        data: { party: PARTY, premises: PHAN_XICH_LONG, asOf: NOW, invoices: [], pending: [], decisionWithoutFee: DECISIONS.phanXichLong.reference },
        failure: null,
      };
    case "error":
      return failure("INTERNAL_ERROR", true, "d06e3b9a72c418f5");
  }
}

/**
 * SCR-FIN-03, one invoice: the corrected Pasteur invoice, or the invoice for Pasteur's payment made again,
 * not issued at 10:43 because the payment was not settled, and at 11:20 because the e-invoice service was
 * down when it fell due after the payment was reconciled at 11:05.
 */
export function mockInvoice(view: Fin03InvoiceView): LoadOutcome<InvoiceRead> {
  const unissued = {
    instruction: "INS-9RFD3KQW6T",
    premises: PASTEUR,
    series: SERIES,
    issuer: COLLECTOR,
    payer: PARTY,
    decision: DECISIONS.pasteur.reference,
  };
  switch (view) {
    case "one":
      return {
        data: {
          kind: "issued",
          invoice: {
            series: SERIES,
            number: "00000418",
            premises: PASTEUR,
            issuedAt: "2026-09-18T11:44:00+07:00",
            issuer: COLLECTOR,
            payer: PARTY,
            payment: "PAY-4HQT8WMZ2C",
            decision: DECISIONS.pasteur.reference,
            components: DECISIONS.pasteur.components,
            amountMinor: 986000,
            corrects: null,
            keptUntil: null,
            correction: { number: "00000511", issuedOn: "2026-10-01", chargebackOn: "2026-09-30", case: null },
          },
        },
        failure: null,
      };
    case "not-settled":
      return {
        data: {
          kind: "unissued",
          invoice: {
            ...unissued,
            asOf: "2026-10-01T10:43:00+07:00",
            payment: { method: "card", paidAt: "2026-10-01T10:42:00+07:00", reconciledAt: null },
            reason: "FIN_PAYMENT_NOT_SETTLED",
            failedAt: null,
          },
        },
        failure: null,
      };
    case "einvoice-unavailable":
      return {
        data: {
          kind: "unissued",
          invoice: {
            ...unissued,
            asOf: "2026-10-01T11:20:00+07:00",
            payment: { method: "card", paidAt: "2026-10-01T10:42:00+07:00", reconciledAt: "2026-10-01T11:05:00+07:00" },
            reason: "FIN_EINVOICE_UNAVAILABLE",
            failedAt: "2026-10-01T11:05:00+07:00",
          },
        },
        failure: null,
      };
  }
}

// ------------------------------------------------------------------ the seed of the mock backend

/**
 * The collection account inside the board's transfer code (QR_PAYLOAD), field by field, so the mock bank
 * writes a new instruction's code the same way: the EMVCo application identifier, the canvas's placeholder bank
 * and account, and the transfer service. Placeholders, not a bank.
 */
export const COLLECTION_ACCOUNT_CODE = { application: "A000000727", bank: "999999", account: "190374285516", service: "QRIBFTTA" } as const;

/**
 * What a signed-in session starts from (`lib/mock/backend/finance.ts`): the canvas's decisions, the record
 * each fee bears on, the position each decision's payment was drawn in, and the party's invoices. Pasteur's
 * position is the canvas's 10:14 drawing, made after INS-9RFD3KQW6T; the backend takes the instruction out,
 * since the session starts at 10:05, before the payer authorised it.
 */
export const FINANCE_SEED = {
  party: PARTY,
  collectionAuthority: COLLECTOR,
  series: SERIES,
  decisions: [DECISIONS.pasteur, DECISIONS.leThanhTon, DECISIONS.phanXichLong, DECISIONS.nguyenHue] as readonly DecisionToPay[],
  records: {
    [DECISIONS.pasteur.reference]: RECORD_PASTEUR,
    [DECISIONS.nguyenHue.reference]: RECORD_HUE,
  } as Readonly<Record<string, string>>,
  positions: {
    [DECISIONS.pasteur.reference]: PASTEUR_DISPUTED,
    [DECISIONS.nguyenHue.reference]: HUE_RECONCILED,
    "OBD-4NPV8CRA2J": DA_KAO_DUPLICATE,
  } as Readonly<Record<string, PaymentPosition>>,
  invoices: INVOICES,
} as const;

// ------------------------------------------------------------------ the operations console (SCR-FIN-10, 14, 15)

/**
 * The finance officer the console boards draw is Bế Hồng Phúc; in the portal the operations officer Phan Gia Lượng
 * holds the finance officer's role (ACT-FIN-OP), so the acts the boards attribute to the officer are his here. The
 * finance approver is Thạch Minh Khải on both.
 */
export const FINANCE_OFFICER = { name: "Phan Gia Lượng", email: "phan.gialuong@rightone.example" } as const;
export const FINANCE_APPROVER = { name: "Thạch Minh Khải", email: "thach.minhkhai@rightone.example" } as const;

/** Each premises the console boards name, with its register record (PTY's PRM- reference). */
export const CONSOLE_PREMISES = {
  pasteur: { name: PASTEUR, record: "PRM-5PSR9VJA" },
  nguyenHue: { name: NGUYEN_HUE, record: "PRM-3NHZ6PKW" },
  daKao: { name: DA_KAO, record: "PRM-4DKX7WNP" },
  nangXien: { name: "Khách sạn Nắng Xiên", record: "PRM-6HNX2QWD" },
  nguyenTrai: { name: "The Lintel Coffee – Nguyễn Trãi", record: "PRM-9NTR4KBE" },
  apMai: { name: "Áp Mái Bar – Thảo Điền", record: "PRM-7KD2WQ9M" },
} as const;

/**
 * The payments the chargeback form offers on SCR-FIN-10, as the board lists them: the payment, its premises, how it
 * was paid, its amount and the day it was paid. A chargeback is a card scheme's act, so only a card payment can take
 * one; Pasteur's card payment is already disputed.
 */
export const CANVAS_PAYMENTS: readonly {
  reference: string;
  decision: string;
  premises: { name: string; record: string };
  method: "card" | "transfer";
  amountMinor: number;
  paidOn: string;
}[] = [
  { reference: "PAY-2NVK6TXH8B", decision: DECISIONS.nguyenHue.reference, premises: CONSOLE_PREMISES.nguyenHue, method: "transfer", amountMinor: 2076000, paidOn: "2026-09-24" },
  { reference: "PAY-4HQT8WMZ2C", decision: DECISIONS.pasteur.reference, premises: CONSOLE_PREMISES.pasteur, method: "card", amountMinor: 986000, paidOn: "2026-09-18" },
  { reference: "PAY-6DKA3RWQ7M", decision: "OBD-4NPV8CRA2J", premises: CONSOLE_PREMISES.daKao, method: "transfer", amountMinor: 1152000, paidOn: "2026-09-10" },
];

/**
 * The decisions the canvas draws as paid by a payment made before the session: Nguyễn Huệ's transfer, reconciled at
 * 16:51 on 24 September and invoiced as 00000431, and Đa Kao's PAY-6DKA3RWQ7M, which paid OBD-4NPV8CRA2J on
 * 10 September (SCR-FIN-02 and SCR-FIN-05; the canvas gives that day without a time) and was invoiced as 00000362.
 */
export const SETTLED_BEFORE: Readonly<Record<string, { payment: string; reconciledAt: string; invoice: string }>> = {
  [DECISIONS.nguyenHue.reference]: { payment: "PAY-2NVK6TXH8B", reconciledAt: "2026-09-24T16:51:00+07:00", invoice: `${SERIES} 00000431` },
  "OBD-4NPV8CRA2J": { payment: "PAY-6DKA3RWQ7M", reconciledAt: "2026-09-10", invoice: `${SERIES} 00000362` },
};

/** The rights layers, each with the recipient that collects it, as every fee on the canvas is split. */
export const RECIPIENTS: Readonly<Record<"authors" | "performers" | "producers", string>> = {
  authors: COLLECTOR,
  performers: "Hạc Bạch",
  producers: "Trường Xuân",
};

/**
 * SCR-FIN-10's corrections as the board draws them at 10:14 on 1 October. The Pasteur chargeback: the card payment of
 * 18 September (paid 11:34, settled on STL-6KQW2TDX8N at 11:37, reconciled 11:38, invoiced 11:44), taken back on the
 * acquirer's notice FIN-EV-3114 at 17:42 on 30 September, the correction raised at 17:43 and its consequences set at
 * 09:20 on 1 October; the status record's review CSR-4TN7QK2MVD was opened by the payment event at 17:45, is due
 * by 7 October (5 working days), and proposes suspending R1-CER-2026-T7QM4BWJ, waiting for the business approver.
 * The Đa Kao correction of a transfer reference closed on 11 September.
 */
export const CANVAS_CORRECTIONS = {
  pasteur: {
    reference: "COR-7MXK2PVT9D",
    payment: "PAY-4HQT8WMZ2C",
    decision: DECISIONS.pasteur.reference,
    premises: CONSOLE_PREMISES.pasteur,
    amountMinor: -986000,
    raisedAt: "2026-09-30T17:43:00+07:00",
    original: {
      method: "card" as const,
      amountMinor: 986000,
      paidAt: "2026-09-18T11:34:00+07:00",
      reconciledAt: "2026-09-18T11:38:00+07:00",
      settlementConfirmation: "STL-6KQW2TDX8N",
      invoice: { series: SERIES, number: "00000418", issuedAt: "2026-09-18T11:44:00+07:00" },
    },
    chargeback: { amountMinor: 986000, recordedAt: "2026-09-30T17:42:00+07:00", notice: "FIN-EV-3114" },
    consequencesSetAt: "2026-10-01T09:20:00+07:00",
    corrective: { series: SERIES, number: "00000511" },
    /** What was remitted to the recipients before the chargeback, and what stays held for Hạc Bạch. */
    remittances: {
      authors: { reference: "RMT-6TCH4WVN9Q", state: "confirmed" as const, on: "2026-09-24" },
      performers: { reference: "RMT-9MDV5RXK3T", state: "suspended" as const, on: null },
      producers: { reference: "RMT-3PFZ8KDQ2W", state: "confirmed" as const, on: "2026-09-25" },
    },
    recoveryOpenMinor: 757000,
    review: {
      reference: "CSR-4TN7QK2MVD",
      record: RECORD_PASTEUR,
      openedAt: "2026-09-30T17:45:00+07:00",
      dueBy: "2026-10-07",
      workingDays: 5,
      proposedAt: "2026-10-01T09:05:00+07:00",
    },
  },
  daKao: {
    reference: "COR-2PWD6KTN4R",
    payment: "PAY-6DKA3RWQ7M",
    decision: "OBD-4NPV8CRA2J",
    premises: CONSOLE_PREMISES.daKao,
    closedOn: "2026-09-11",
  },
} as const;

/**
 * SCR-FIN-14 and 15: the amounts owed, as the boards draw them. Khách sạn Nắng Xiên's 2,000 VND left unpaid when the
 * sender's bank took a transfer charge from PAY-5WGR9NDK4X (5,410,000 of the 5,412,000 VND fee), due on
 * 28 September after use began on 30 June, with a reminder on 21 September and an overdue notice on 29 September, and
 * the officer's write-off proposal of 15:40 on 30 September waiting for the finance approver. Pasteur's fee, owed
 * again after the chargeback. The Lintel Coffee's fee, due on 23 December.
 */
export const CANVAS_OUTSTANDING = {
  nangXien: {
    reference: "OUT-7KXN3QDW2H",
    premises: CONSOLE_PREMISES.nangXien,
    payer: "Công ty TNHH Khách sạn Nắng Xiên",
    decision: "OBD-3NXW8HFT6K",
    feeMinor: 5412000,
    feePeriod: { from: "2026-07-01", to: "2027-06-30" },
    received: { payment: "PAY-5WGR9NDK4X", on: "2026-09-15", amountMinor: 5410000, bankChargeMinor: 2000 },
    dueOn: "2026-09-28",
    useBeganOn: "2026-06-30",
    notices: { reminder: "2026-09-21", overdue: "2026-09-29" },
    proposal: {
      at: "2026-09-30T15:40:00+07:00",
      /** The segregation threshold recorded on 22 September 2026 and awaiting approval. */
      threshold: { amountMinor: 10000000, recordedOn: "2026-09-22" },
    },
  },
  pasteur: {
    reference: "OUT-3RVD8MKW5T",
    premises: CONSOLE_PREMISES.pasteur,
    payer: PARTY,
    decision: DECISIONS.pasteur.reference,
    amountMinor: 986000,
    dueOn: "2026-12-14",
    chargebackOn: "2026-09-30",
  },
  nguyenTrai: {
    reference: "OUT-6ZPH2NXQ9C",
    premises: CONSOLE_PREMISES.nguyenTrai,
    payer: "The Lintel Coffee",
    decision: "OBD-2RKD8MXT4Q",
    amountMinor: 1386000,
    dueOn: "2026-12-23",
  },
} as const;

/** The segregation threshold recorded on 22 September 2026 and awaiting approval: the authority a write-off proposal names. */
export const SEGREGATION_THRESHOLD = CANVAS_OUTSTANDING.nangXien.proposal.threshold;

/**
 * SCR-FIN-04's held amounts at 10:14 on 1 October, oldest first: 500,000 VND that matches no payer and no instruction,
 * held 12 days; Đa Kao's second transfer for OBD-4NPV8CRA2J, whose return the officer proposed at 11:20 on
 * 30 September; and Áp Mái's 13,786,000 VND, the unexpired part of its paid term asked back after Áp Mái Bar – Thảo
 * Điền changed hands on 1 October, held identified to its payer while the grounds are not decided. The canvas gives
 * no transfer content for the first, and no payment for the third.
 */
export const CANVAS_HELD = {
  unmatched: {
    reference: "HLD-6PMV2RTK9A",
    amountMinor: 500000,
    reason: "UNMATCHED" as const,
    source: { kind: "transfer" as const, receivedOn: "2026-09-19", content: null },
    payer: null,
    premises: null,
    decision: null,
    heldSince: "2026-09-19",
  },
  daKao: {
    reference: "HLD-3TWQ8KXN5F",
    amountMinor: 1152000,
    reason: "DUPLICATE" as const,
    source: { kind: "transfer" as const, receivedOn: "2026-09-29", content: "THEN CUA DAKAO PHI BAN QUYEN" },
    payer: PARTY,
    premises: CONSOLE_PREMISES.daKao,
    decision: "OBD-4NPV8CRA2J",
    heldSince: "2026-09-29T15:06:00+07:00",
    proposal: { kind: "return" as const, at: "2026-09-30T11:20:00+07:00" },
  },
  apMai: {
    reference: "HLD-8RKQ4WNC7T",
    amountMinor: 13786000,
    reason: "REFUND_SOUGHT" as const,
    source: { kind: "unexpired-term" as const, endedOn: "2026-09-30" },
    payer: "Công ty TNHH Áp Mái",
    premises: CONSOLE_PREMISES.apMai,
    decision: null,
    heldSince: "2026-10-01",
  },
} as const;

/** The account every held amount is held in: the collection account in the collection authority's name, under its arrangement. */
export const HOLDING_ACCOUNT = { holder: COLLECTOR, arrangement: "ARR-2026-01", acceptedOn: "2026-06-30" } as const;

/** The review states the console boards draw that the live data never reaches: loading, our outage, a read refused. */
export const FIN04_VIEWS = ["loading", "error", "unavailable"] as const;
export type Fin04View = (typeof FIN04_VIEWS)[number];
export const FIN10_VIEWS = ["loading", "error", "unavailable"] as const;
export type Fin10View = (typeof FIN10_VIEWS)[number];
export const FIN14_VIEWS = ["loading", "error"] as const;
export type Fin14View = (typeof FIN14_VIEWS)[number];
export const FIN15_VIEWS = ["loading", "error"] as const;
export type Fin15View = (typeof FIN15_VIEWS)[number];

/** Each console board's outage, with the trace identifier it draws, and SCR-FIN-10's read that cannot complete safely. */
export function mockConsoleFailure(screen: "fin04" | "fin10" | "fin14" | "fin15", view: "error" | "unavailable"): LoadOutcome<never> {
  if (view === "unavailable") return failure("SRS_SERVICE_UNAVAILABLE", true);
  const trace = { fin04: "8c41f7d2b09e3a65", fin10: "5e0b9c27a1d84f36", fin14: "5b93e7a20c4fd816", fin15: "e2c84f1b60a93d57" }[screen];
  return failure("INTERNAL_ERROR", true, trace);
}
