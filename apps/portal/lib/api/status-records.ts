import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import { createRepresentation, getCertificate, getRepresentationDocument, listCertificates } from "@/lib/mock/backend/status-records";
import {
  mockPremisesStatusRecords,
  mockStatusRecord,
  mockStatusRecordPrintout,
  type Cer11View,
  type Cer12View,
  type Cer13View,
} from "@/lib/mock/status-records";
import { NOT_CONFIGURED, usesMockData } from "./source";

/** One status record of a premises, as SCR-CER-11 lists it. */
export interface StatusRecordSummary {
  reference: string;
  /** The record's premises when the list spans the party's premises; null in a list of one premises, which its title names. */
  premises: string | null;
  /** SM-03: active, pending_issue, expiring, suspended, revoked, expired, replaced, cancelled. */
  state: "active" | "pending_issue" | "expiring" | "suspended" | "revoked" | "expired" | "replaced" | "cancelled";
  /** The day the current state began; the list is ordered by it. */
  since: string;
  from: string;
  to: string;
  /** The day an obligation change amended this record, when one did. */
  followsChangeOn: string | null;
}

export interface PremisesStatusRecords {
  /** Null when no premises is chosen; the page names the party instead. */
  premises: string | null;
  party: string;
  /** When the list was read, for the meta line. */
  asOf: string;
  records: readonly StatusRecordSummary[];
}

/**
 * SCR-CER-11 reads status records: with `view`, one premises' as the canvas drew them; otherwise every record
 * the session's party holds, as no premises is chosen in the address yet. A refusal (no premises chosen, not
 * the reader's premises, reference data unreadable) is a failure with its code, never an empty list.
 */
export function loadPremisesStatusRecords(
  sessionId: string,
  view: Exclude<Cer11View, "loading"> | null,
): Promise<LoadOutcome<PremisesStatusRecords>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockPremisesStatusRecords(view) : listCertificates(sessionId));
}

/** One printout of a record: the status it states is the status at the instant it was printed. */
export interface PrintoutSummary {
  reference: string;
  printedAt: string;
  /** Only a current record prints, so a printout states Active. */
  stateWhenPrinted: "active";
  signingKey: string;
}

/** A status record as its holder reads it, SCR-CER-12. */
export interface StatusRecord {
  reference: string;
  premises: string;
  holder: string;
  /** SM-03, as the holder's page draws it: active, or suspended with its ground and its remedy. */
  state: "active" | "suspended";
  /** The instant the current state began. */
  since: string;
  /** The period in force, under its decision. */
  period: { from: string; to: string; decision: string };
  earlierPeriods: readonly { from: string; to: string; decision: string }[];
  /** Why the record is suspended and until when it may be appealed; null while it is not. */
  suspension: { ground: "payment-reversed"; amountMinor: number; appealBy: string } | null;
  /** The latest first. */
  printouts: readonly PrintoutSummary[];
}

/** The refusals of Print the page draws beside Print. */
export type PrintRefusal = "SIGNING_UNAVAILABLE" | "RECORD_NOT_CURRENT";

/**
 * What the page says beside Print, after the reader pressed it: a printout made, or the act refused with its
 * code. Null when the page answers no act.
 */
export type PrintAnswer = { outcome: "made"; printout: PrintoutSummary } | { outcome: "refused"; code: PrintRefusal };

/** What Print hands back to SCR-CER-12 when it is refused. */
export interface PrintAttempt {
  refusal: PrintRefusal;
}

export interface StatusRecordPage {
  record: StatusRecord;
  printAnswer: PrintAnswer | null;
  /** A printout link that led nowhere and brought the reader here instead, with its code. */
  printoutRefusal: "NOT_A_PRINTABLE_REPRESENTATION" | "REPRESENTATION_NOT_FOUND" | null;
}

/**
 * SCR-CER-12 reads one status record, as the session holds it or, with `view`, as the canvas drew it. A record
 * that does not exist (CERTIFICATE_NOT_FOUND), one the reader does not act for, or reference data that cannot
 * be read is a failure with its code, never another premises' record.
 */
export function loadStatusRecord(
  sessionId: string,
  record: string,
  view: Exclude<Cer12View, "loading"> | null,
): Promise<LoadOutcome<StatusRecordPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockStatusRecord(record, view) : getCertificate(sessionId, record));
}

/** The printed record, SCR-CER-13: what the sheet carries, copied at the instant it was printed. */
export interface StatusRecordPrintout {
  record: string;
  premises: string;
  /**
   * The premises' address as the record carries it, in each language the sheet is printed in; null where the
   * canvas draws no address for the premises, and the sheet then has no address line.
   */
  address: Readonly<Record<Locale, string>> | null;
  /** The operator, printed only for an organisation; a household business owner's name is never printed (SEC-436). */
  operator: string | null;
  period: { from: string; to: string };
  decision: string;
  stateWhenPrinted: "active";
  printedAt: string;
  printout: string;
  signingKey: string;
  /** The verification route the code opens, printed beside it. */
  verifyUrl: string;
}

/**
 * SCR-CER-13 reads one printout of a record, the latest when none is named (the one Print just made), or, with
 * `view`, the sheet the canvas drew. A printout the reader may not open is REPRESENTATION_NOT_FOUND.
 */
export function loadStatusRecordPrintout(
  sessionId: string,
  record: string,
  view: Cer13View | null,
  printout: string | null = null,
): Promise<LoadOutcome<StatusRecordPrintout>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockStatusRecordPrintout(record, view) : getRepresentationDocument(sessionId, record, printout));
}

/**
 * Print the record (FR-CER-005, POST /certificates/{id}/representations): RightOne signs a printout of its
 * current status and answers with the printout's reference. Refused with RECORD_NOT_CURRENT for a record not
 * in force, CERTIFICATE_NOT_FOUND for one the reader does not hold.
 */
export function makeStatusRecordPrintout(sessionId: string, record: string): Promise<LoadOutcome<{ printout: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(createRepresentation(sessionId, record));
}
