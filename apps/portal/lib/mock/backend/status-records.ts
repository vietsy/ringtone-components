import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import type { PremisesStatusRecords, PrintoutSummary, StatusRecord, StatusRecordPage, StatusRecordPrintout } from "@/lib/api/status-records";
import { STATUS_RECORDS_SEED } from "@/lib/mock/status-records";
import { now } from "./clock";
import { reference } from "./ids";
import { table } from "./store";

/**
 * CER's behaviour for the premises portal, played by the mock backend for one signed-in session: the status
 * records the party holds, and the printouts the holder makes of them. Commands are named after the API's
 * operations (`srs/02-api-contracts.md`) and refuse with the codes of `design/04-refusal-codes.md`.
 *
 * The mock has no signing service: a printout is recorded as signed with the key the canvas's printouts carry,
 * CK-2026-01, and SIGNING_UNAVAILABLE, which only the signing service can answer, is never given here.
 * Records change status only by CER's officers (a review, a suspension), who have no screens in the portal, so
 * a session's records keep the status they were seeded with.
 */

interface Entry {
  at: string;
  event: string;
}

interface CertificateRecord {
  record: Omit<StatusRecord, "printouts">;
  /** The latest first. */
  printouts: PrintoutSummary[];
  /** What a printed sheet carries beyond the record itself. */
  sheet: { address: Readonly<Record<Locale, string>> | null; operator: string | null };
  history: Entry[];
}

interface CertificateTable {
  party: string;
  records: Map<string, CertificateRecord>;
}

function seed(): CertificateTable {
  return {
    party: STATUS_RECORDS_SEED.party,
    records: new Map(
      STATUS_RECORDS_SEED.records.map(({ record, sheet }) => {
        const { printouts, ...rest } = record;
        return [record.reference, { record: rest, printouts: [...printouts], sheet, history: [{ at: record.since, event: "STATE_SET" }] }];
      }),
    ),
  };
}

const certificatesOf = (sessionId: string) => table(sessionId, "status-records", seed);

const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

/** A record of the session's party, or none: a record of another holder reads as one that does not exist. */
function holderRecord(certificates: CertificateTable, record: string): CertificateRecord | null {
  const entry = certificates.records.get(record);
  return entry !== undefined && entry.record.holder === certificates.party ? entry : null;
}

// ------------------------------------------------------------------ reads

/**
 * GET /certificates for the party: every record it holds, the latest change of status first. The portal's
 * address names no premises yet, so the list spans the party's premises and each row names its own.
 */
export function listCertificates(sessionId: string): LoadOutcome<PremisesStatusRecords> {
  const certificates = certificatesOf(sessionId);
  const records = [...certificates.records.values()]
    .filter((entry) => entry.record.holder === certificates.party)
    .map(({ record }) => ({
      reference: record.reference,
      premises: record.premises,
      state: record.state,
      since: record.since,
      from: record.period.from,
      to: record.period.to,
      followsChangeOn: null,
    }))
    .sort((a, b) => Date.parse(b.since) - Date.parse(a.since));
  return ok({ premises: null, party: certificates.party, asOf: now(), records });
}

/** GET /certificates/{id}: the record with its printouts, or CERTIFICATE_NOT_FOUND. */
export function getCertificate(sessionId: string, record: string): LoadOutcome<StatusRecordPage> {
  const entry = holderRecord(certificatesOf(sessionId), record);
  if (entry === null) return refused("CERTIFICATE_NOT_FOUND");
  return ok({ record: { ...entry.record, printouts: [...entry.printouts] }, printAnswer: null, printoutRefusal: null });
}

/**
 * GET /certificates/{id}/representations/{ref}/document: the sheet of one printout as it was printed, or the
 * record's latest when none is named. A record the reader does not hold, a printout that is not the record's,
 * or a record never printed has no printout to open.
 */
export function getRepresentationDocument(sessionId: string, record: string, printoutRef: string | null): LoadOutcome<StatusRecordPrintout> {
  const entry = holderRecord(certificatesOf(sessionId), record);
  const printout = printoutRef === null ? entry?.printouts[0] : entry?.printouts.find((made) => made.reference === printoutRef);
  if (entry === null || printout === undefined) return refused("REPRESENTATION_NOT_FOUND");
  const { record: held, sheet } = entry;
  return ok({
    record: held.reference,
    premises: held.premises,
    address: sheet.address,
    operator: sheet.operator,
    period: { from: held.period.from, to: held.period.to },
    decision: held.period.decision,
    stateWhenPrinted: printout.stateWhenPrinted,
    printedAt: printout.printedAt,
    printout: printout.reference,
    signingKey: printout.signingKey,
    verifyUrl: `${STATUS_RECORDS_SEED.verifyBase}${held.reference}`,
  });
}

// ------------------------------------------------------------------ commands

/**
 * POST /certificates/{id}/representations (FR-CER-005): a signed printout of the record's status now. Only a
 * record in force prints (RECORD_NOT_CURRENT otherwise); the printout states Active and the moment it was made.
 */
export function createRepresentation(sessionId: string, record: string): LoadOutcome<{ printout: string }> {
  const entry = holderRecord(certificatesOf(sessionId), record);
  if (entry === null) return refused("CERTIFICATE_NOT_FOUND");
  if (entry.record.state !== "active") return refused("RECORD_NOT_CURRENT");
  const at = now();
  const printout: PrintoutSummary = { reference: reference("CRP"), printedAt: at, stateWhenPrinted: "active", signingKey: STATUS_RECORDS_SEED.signingKey };
  entry.printouts.unshift(printout);
  entry.history.push({ at, event: `PRINTED ${printout.reference}` });
  return ok({ printout: printout.reference });
}
