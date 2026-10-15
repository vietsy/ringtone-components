import type { LoadOutcome } from "@rightone/ui";
import type {
  PremisesStatusRecords,
  PrintoutSummary,
  StatusRecord,
  StatusRecordPage,
  StatusRecordPrintout,
} from "@/lib/api/status-records";
import { MOCK_PRINCIPAL } from "./session";

/** The view states SCR-CER-11 was drawn in on the design canvas. */
export const CER11_VIEWS = [
  "one",
  "amended",
  "empty",
  "premises-required",
  "not-authorised",
  "unavailable",
  "loading",
  "error",
] as const;
export type Cer11View = (typeof CER11_VIEWS)[number];

/** When the canvas reads the list: 1 October 2026, 10:14 in Ho Chi Minh. */
const AS_OF = "2026-10-01T10:14:00+07:00";

const PASTEUR = "Then Cửa Coffee & Tea – Pasteur";
const LE_THANH_TON = "Then Cửa Coffee & Tea – Lê Thánh Tôn";
const SALA = "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ";

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({
  data: null,
  failure: { code, traceId, retryable },
});

/**
 * SCR-CER-11's answers, per view. Pasteur holds one active record since its issue on 18 September 2026;
 * Lê Thánh Tôn keeps one record amended by the change decided on 28 September (the holder stayed, so the
 * record was amended rather than replaced); Sala has none yet.
 */
export function mockPremisesStatusRecords(view: Exclude<Cer11View, "loading">): LoadOutcome<PremisesStatusRecords> {
  switch (view) {
    case "one":
      return {
        data: {
          premises: PASTEUR,
          party: MOCK_PRINCIPAL.party,
          asOf: AS_OF,
          records: [
            { reference: "R1-CER-2026-T7QM4BWJ", premises: null, state: "active", since: "2026-09-18", from: "2026-09-18", to: "2027-09-17", followsChangeOn: null },
          ],
        },
        failure: null,
      };
    case "amended":
      return {
        data: {
          premises: LE_THANH_TON,
          party: MOCK_PRINCIPAL.party,
          asOf: AS_OF,
          records: [
            { reference: "R1-CER-2026-K9TE4WQC", premises: null, state: "active", since: "2026-09-02", from: "2026-09-28", to: "2027-09-01", followsChangeOn: "2026-09-28" },
          ],
        },
        failure: null,
      };
    case "empty":
      return { data: { premises: SALA, party: MOCK_PRINCIPAL.party, asOf: AS_OF, records: [] }, failure: null };
    case "premises-required":
      return failure("PREMISES_FILTER_REQUIRED", false);
    case "not-authorised":
      return failure("NOT_AUTHORISED_FOR_PREMISES", false);
    case "unavailable":
      return failure("REFERENCE_DATA_UNAVAILABLE", true);
    case "error":
      return failure("INTERNAL_ERROR", true, "3e8b51d7a04c9f26");
  }
}

// ------------------------------------------------------------------ SCR-CER-12 and SCR-CER-13

/** The view states SCR-CER-12 was drawn in. */
export const CER12_VIEWS = [
  "active",
  "printing",
  "printed",
  "suspended",
  "not-current-print",
  "signing-unavailable",
  "not-printable",
  "printout-not-found",
  "not-authorised",
  "not-found",
  "unavailable",
  "loading",
  "error",
] as const;
export type Cer12View = (typeof CER12_VIEWS)[number];

/** The view states SCR-CER-13, the printed sheet, was drawn in. */
export const CER13_VIEWS = ["printout", "household", "error"] as const;
export type Cer13View = (typeof CER13_VIEWS)[number];

const NGUYEN_HUE = "Then Cửa Coffee & Tea – Nguyễn Huệ";
const SIGNING_KEY = "CK-2026-01";

function printout(reference: string, printedAt: string): PrintoutSummary {
  return { reference, printedAt, stateWhenPrinted: "active", signingKey: SIGNING_KEY };
}

/**
 * The records SCR-CER-12 opens, from the data sheet: Pasteur's, issued at 11:40 on 18 September once its fee
 * was reconciled and printed the next morning; and Nguyễn Huệ's, issued on 24 September and never printed.
 * Each carries the printout a Print would make.
 */
const RECORDS: Readonly<Record<string, { record: StatusRecord; made: PrintoutSummary; views: readonly Cer12View[] }>> = {
  "R1-CER-2026-T7QM4BWJ": {
    record: {
      reference: "R1-CER-2026-T7QM4BWJ",
      premises: PASTEUR,
      holder: MOCK_PRINCIPAL.party,
      state: "active",
      since: "2026-09-18T11:40:00+07:00",
      period: { from: "2026-09-18", to: "2027-09-17", decision: "OBD-3FJW6NRA5C" },
      earlierPeriods: [],
      suspension: null,
      printouts: [printout("CRP-4WTN8QHC2K", "2026-09-19T08:30:00+07:00")],
    },
    made: printout("CRP-7DQM3XRK2W", AS_OF),
    views: ["active", "printing", "printed", "suspended", "not-current-print", "signing-unavailable", "not-printable", "printout-not-found"],
  },
  // The board draws Nguyễn Huệ's record for the delegate; its suspended and not-current views are Pasteur's.
  "R1-CER-2026-N6PZ2RKE": {
    record: {
      reference: "R1-CER-2026-N6PZ2RKE",
      premises: NGUYEN_HUE,
      holder: MOCK_PRINCIPAL.party,
      state: "active",
      since: "2026-09-24T16:52:00+07:00",
      period: { from: "2026-09-24", to: "2027-09-23", decision: "OBD-8KWT2PZH6M" },
      earlierPeriods: [],
      suspension: null,
      printouts: [],
    },
    made: printout("CRP-2VJH8MTC5Q", AS_OF),
    views: ["active", "printing", "printed", "signing-unavailable", "not-printable", "printout-not-found"],
  },
};

/**
 * SCR-CER-12's answers, by record and view. Pasteur's record is suspended from 14:00 on 1 October, after the
 * chargeback of its whole fee; a view drawn for another record falls back to this record's own page.
 */
export function mockStatusRecord(reference: string, view: Exclude<Cer12View, "loading">): LoadOutcome<StatusRecordPage> {
  switch (view) {
    case "error":
      return failure("INTERNAL_ERROR", true, "c71f0a4d2e98b635");
    case "unavailable":
      return failure("REFERENCE_DATA_UNAVAILABLE", true);
    case "not-authorised":
      return failure("NOT_AUTHORISED_FOR_PREMISES", false);
    case "not-found":
      return failure("CERTIFICATE_NOT_FOUND", false);
  }
  const drawn = RECORDS[reference];
  if (drawn === undefined) return failure("CERTIFICATE_NOT_FOUND", false);
  const page: StatusRecordPage = { record: drawn.record, printAnswer: null, printoutRefusal: null };
  switch (drawn.views.includes(view) ? view : "active") {
    case "suspended":
      return {
        data: {
          ...page,
          record: {
            ...drawn.record,
            state: "suspended",
            since: "2026-10-01T14:00:00+07:00",
            suspension: { ground: "payment-reversed", amountMinor: 986000, appealBy: "2026-10-22" },
          },
        },
        failure: null,
      };
    case "printed":
      return {
        data: {
          record: { ...drawn.record, printouts: [drawn.made, ...drawn.record.printouts] },
          printAnswer: { outcome: "made", printout: drawn.made },
          printoutRefusal: null,
        },
        failure: null,
      };
    case "signing-unavailable":
      return { data: { ...page, printAnswer: { outcome: "refused", code: "SIGNING_UNAVAILABLE" } }, failure: null };
    case "not-current-print":
      return { data: { ...page, printAnswer: { outcome: "refused", code: "RECORD_NOT_CURRENT" } }, failure: null };
    case "not-printable":
      return { data: { ...page, printoutRefusal: "NOT_A_PRINTABLE_REPRESENTATION" }, failure: null };
    case "printout-not-found":
      return { data: { ...page, printoutRefusal: "REPRESENTATION_NOT_FOUND" }, failure: null };
    default:
      return { data: page, failure: null };
  }
}

/** Pasteur's printout of 19 September 2026, 08:30, the one the sheet on the canvas shows. */
const PASTEUR_PRINTOUT: StatusRecordPrintout = {
  record: "R1-CER-2026-T7QM4BWJ",
  premises: PASTEUR,
  address: { vi: "Phường Sài Gòn, TP. Hồ Chí Minh", en: "Sài Gòn Ward, Hồ Chí Minh City" },
  operator: MOCK_PRINCIPAL.party,
  period: { from: "2026-09-18", to: "2027-09-17" },
  decision: "OBD-3FJW6NRA5C",
  stateWhenPrinted: "active",
  printedAt: "2026-09-19T08:30:00+07:00",
  printout: "CRP-4WTN8QHC2K",
  signingKey: SIGNING_KEY,
  verifyUrl: "rightone.vn/v/R1-CER-2026-T7QM4BWJ",
};

/**
 * SCR-CER-13's answers. The household view is the same sheet for a household business, whose owner's name is
 * never printed. A record the canvas drew no printout for has none to open.
 */
export function mockStatusRecordPrintout(reference: string, view: Cer13View): LoadOutcome<StatusRecordPrintout> {
  if (view === "error") return failure("INTERNAL_ERROR", true, "9c41e07b2d5a8f36");
  if (reference !== PASTEUR_PRINTOUT.record) return failure("REPRESENTATION_NOT_FOUND", false);
  return { data: view === "household" ? { ...PASTEUR_PRINTOUT, operator: null } : PASTEUR_PRINTOUT, failure: null };
}

// ------------------------------------------------------------------ the seed of the mock backend

/**
 * What a signed-in session starts from (`lib/mock/backend/status-records.ts`): the records the canvas draws a
 * holder's page for, each with its printouts and what its printed sheet carries. Pasteur's sheet is the one
 * SCR-CER-13 draws; the canvas draws no address for Nguyễn Huệ, so its sheet has none. Lê Thánh Tôn's amended
 * record, R1-CER-2026-K9TE4WQC, is drawn only in SCR-CER-11's list, with no page of its own, so it stays a review
 * state rather than a record whose page would have to be made up.
 */
export const STATUS_RECORDS_SEED = {
  party: MOCK_PRINCIPAL.party,
  /** The key the canvas's printouts are signed with. */
  signingKey: SIGNING_KEY,
  /** Where the code on a printout leads: the public verification page of the record, as the sheet prints it. */
  verifyBase: "rightone.vn/v/",
  records: Object.values(RECORDS).map(({ record }) => ({
    record,
    sheet:
      record.reference === PASTEUR_PRINTOUT.record
        ? { address: PASTEUR_PRINTOUT.address, operator: PASTEUR_PRINTOUT.operator }
        : { address: null, operator: record.holder },
  })),
};
