import { randomInt, randomUUID } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  AcknowledgeAnswer,
  CancelAnswer,
  ClaimPage,
  ClaimRecord,
  Completeness,
  ExchangeFormat,
  OrgReader,
  SharesAt,
  ShareRecord,
  StageAnswer,
  SubmitAnswer,
  SubmitEntered,
  SubmitFormPage,
  SubmitRefusalCode,
  Submission,
} from "@/lib/api/submissions";
import {
  CHANNELS,
  CLAIMS_SEED,
  COMPLETENESS_RULES,
  RECORD_CEILING,
  SUBMISSIONS_SEED,
  type CompletenessRule,
} from "../submissions";
import { now, today } from "./clock";
import { table } from "./store";

/*
 * The catalogue's submissions and claims (CAT), as the API will behave for an organisation's administrator:
 * submissions keyed by reference with their SM-23 state, claims with their dated shares, and one function per
 * command of `srs/02-api-contracts.md`, refusing with the codes of `design/04-refusal-codes.md`. Every
 * organisation's records are held, each with its organisation, so a reference of another organisation is
 * refused as the contract says rather than found. What a person does happens now; the seed keeps the canvas's
 * moments.
 *
 * Processing is the gateway's record processor (SM-23 transitions 1 and 2, ACT-SYS), which is not built: DR-33
 * classifies each record against the catalogue's existing records and DR-30 and DR-32 answers, none of which the
 * mock holds. So a new submission stays RECEIVED, with the checks the contract makes at the boundary recorded
 * against it, until a processor exists; no outcome is ever made up. Claims are recorded and validated by the
 * gateway's catalogue officer (SCR-CAT-06, 19), also not built, so a claim keeps the state it was seeded with.
 */

interface StoredSubmission {
  organisation: string;
  submission: Submission;
  /**
   * What the boundary check of `srs/07` found in each record of a JSON payload: the fields that failed, by
   * record index. DR-33 row 1 classifies those records once processing runs; until then nothing is shown.
   */
  boundary: readonly { index: number; fields: readonly string[] }[] | null;
}

interface Staged {
  parts: Uint8Array[];
  size: number;
}

interface AuditEntry {
  at: string;
  actor: string;
  organisation: string;
  act: string;
  reference: string | null;
  code: string | null;
}

interface State {
  submissions: Map<string, StoredSubmission>;
  claims: Map<string, { organisation: string; claim: ClaimRecord }>;
  /** Files on their way in, by upload id, oldest first. */
  staged: Map<string, Staged>;
  audit: AuditEntry[];
}

/** A file larger than this is refused before it is read: 50,000 records of the canvas's size are about 15 MB. */
const MAX_FILE_BYTES = 64 * 1024 * 1024;
/** Files kept on their way in per session; an older one is dropped and must be chosen again. */
const MAX_STAGED = 3;

const seed = (): State => ({
  submissions: new Map(
    SUBMISSIONS_SEED.map(({ organisation, submission }) => [submission.reference, { organisation, submission: structuredClone(submission), boundary: null }]),
  ),
  claims: new Map(CLAIMS_SEED.map(({ organisation, claim }) => [claim.reference, { organisation, claim: structuredClone(claim) }])),
  staged: new Map(),
  audit: [],
});

const stateOf = (sessionId: string): State => table(sessionId, "submissions", seed);

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });

function record(s: State, entry: Omit<AuditEntry, "at">): void {
  s.audit.push({ at: now(), ...entry });
}

/** The organisation's own submission, or why it cannot be read: unknown (the contract's 404), or another's. */
function ownSubmission(s: State, organisation: string, reference: string): StoredSubmission | "SUBMISSION_NOT_FOUND" | "NOT_YOUR_SUBMISSION" {
  const entry = s.submissions.get(reference);
  if (entry === undefined) return "SUBMISSION_NOT_FOUND";
  return entry.organisation === organisation ? entry : "NOT_YOUR_SUBMISSION";
}

// ------------------------------------------------------------------ reads

/** SCR-CAT-04's form: the channels offered and the ceiling, with what a refused attempt kept. */
export function submitForm(sessionId: string, reader: OrgReader, entered: SubmitEntered | null): LoadOutcome<SubmitFormPage> {
  const s = stateOf(sessionId);
  // A kept file can be sent again only while it is still held on its way in.
  const file = entered?.file ?? null;
  const kept = file !== null && file.upload !== null && !s.staged.has(file.upload) ? { ...file, upload: null } : file;
  return ok({ reader, channels: CHANNELS, ceiling: RECORD_CEILING, entered: entered === null ? null : { ...entered, file: kept }, sending: null });
}

/** GET /submissions/{reference}: the submission with its outcomes, or NOT_YOUR_SUBMISSION, or SUBMISSION_NOT_FOUND. */
export function getSubmission(sessionId: string, organisation: string, reference: string): LoadOutcome<Submission> {
  const entry = ownSubmission(stateOf(sessionId), organisation, reference);
  return typeof entry === "string" ? refused(entry) : ok(entry.submission);
}

/**
 * The submission the nav's Submissions opens (G-11): the earliest completed one not yet acknowledged, which is
 * what NTF-CAT-01 sends the organisation to; otherwise the latest received; null when there is none.
 */
export function submissionForNav(sessionId: string, organisation: string): string | null {
  const own = [...stateOf(sessionId).submissions.values()].filter((entry) => entry.organisation === organisation).map((entry) => entry.submission);
  const waiting = own
    .filter((submission) => submission.state === "COMPLETED")
    .sort((a, b) => Date.parse(a.completedAt ?? a.receivedAt) - Date.parse(b.completedAt ?? b.receivedAt))[0];
  if (waiting !== undefined) return waiting.reference;
  return own.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))[0]?.reference ?? null;
}

/** The claim the nav's Claims opens (G-11): the organisation's latest recorded claim, or null. */
export function claimForNav(sessionId: string, organisation: string): string | null {
  const own = [...stateOf(sessionId).claims.values()].filter((entry) => entry.organisation === organisation).map((entry) => entry.claim);
  return own.sort((a, b) => b.recordedOn.localeCompare(a.recordedOn))[0]?.reference ?? null;
}

/**
 * GET /claims/{id}/shares and /completeness at `asOf`: the organisation's own claim, or ROLE_OUT_OF_SCOPE for
 * another organisation's (the board's refusal), or CLAIM_NOT_FOUND. A null date is the reader's cleared date.
 */
export function getClaim(sessionId: string, organisation: string, reference: string, asOf: string | null): LoadOutcome<Omit<ClaimPage, "reader">> {
  const entry = stateOf(sessionId).claims.get(reference);
  if (entry === undefined) return refused("CLAIM_NOT_FOUND");
  if (entry.organisation !== organisation) return refused("ROLE_OUT_OF_SCOPE");
  return ok(claimAt(entry.claim, asOf, COMPLETENESS_RULES));
}

// ------------------------------------------------------------------ DR-30, shares as at a date (FR-CAT-022)

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

function sharesAt(claim: ClaimRecord, date: string): SharesAt {
  const effective = (share: ShareRecord) => share.from <= date && (share.to === null || date <= share.to);
  const largestFirst = (a: ShareRecord, b: ShareRecord) => (b.percent ?? -1) - (a.percent ?? -1);
  const ownership = claim.shares.filter((share) => share.kind === "ownership" && effective(share)).sort(largestFirst);
  const beneficiary = claim.shares.filter((share) => share.kind === "beneficiary" && effective(share)).sort(largestFirst);
  const later = claim.shares.map((share) => share.from).filter((from) => from > date).sort()[0];
  return { ownership, beneficiary, nextFrom: ownership.length + beneficiary.length === 0 ? (later ?? null) : null };
}

/** The CFG-29 version in force on the date: the latest begun by then. */
function ruleAt(rules: readonly CompletenessRule[], date: string): CompletenessRule | null {
  return rules.filter((rule) => rule.from === null || rule.from <= date).sort((a, b) => (a.from ?? "").localeCompare(b.from ?? "")).at(-1) ?? null;
}

const totalOf = (shares: readonly ShareRecord[]) => round4(shares.reduce((sum, share) => sum + (share.percent ?? 0), 0));

/**
 * DR-30 on the ownership kind. A whole-interest claim records no share and has nothing to add up (the screen's
 * governed state). Otherwise the rule is read in its rows' intent: no rule version in force (row 7), no share
 * effective (row 6), a share not stated (row 4), then the sum against the required total (rows 1 to 3).
 */
function ownershipCompleteness(claim: ClaimRecord, at: SharesAt, rule: CompletenessRule | null): Completeness {
  if (claim.wholeInterest) return { code: "WHOLE_INTEREST" };
  if (rule === null) return { code: "COMPLETENESS_RULE_ABSENT" };
  if (at.ownership.length === 0) return { code: "SHARES_ABSENT" };
  if (at.ownership.some((share) => share.percent === null)) return { code: "SHARE_NOT_STATED" };
  const total = totalOf(at.ownership);
  if (total === rule.requiredTotal) return { code: "SHARES_COMPLETE", total };
  return total < rule.requiredTotal ? { code: "SHARES_SHORT", total } : { code: "SHARES_OVER", total };
}

/**
 * DR-30 on the beneficiary kind. No beneficiary share is the ordinary claim (row 5), and the canvas draws it so
 * even when no rule version is in force, although row 5 asks for one; the canvas is followed and the conflict is
 * the BA's to settle. A partial assignment is complete (row 8): the owner collects the rest.
 */
function beneficiaryCompleteness(at: SharesAt, rule: CompletenessRule | null): Completeness {
  if (at.beneficiary.length === 0) return { code: "NO_BENEFICIARY_STATED" };
  if (rule === null) return { code: "COMPLETENESS_RULE_ABSENT" };
  if (at.beneficiary.some((share) => share.percent === null)) return { code: "SHARE_NOT_STATED" };
  const total = totalOf(at.beneficiary);
  if (total === rule.requiredTotal) return { code: "SHARES_COMPLETE", total };
  if (total > rule.requiredTotal) return { code: "SHARES_OVER", total };
  return { code: "BENEFICIARY_PARTIAL", assigned: total, kept: round4(rule.requiredTotal - total) };
}

/** A claim read at a date under the rule versions given; with no date, AS_OF_REQUIRED and nothing computed. */
export function claimAt(claim: ClaimRecord, asOf: string | null, rules: readonly CompletenessRule[]): Omit<ClaimPage, "reader"> {
  if (asOf === null) return { claim, asOf: null, asOfRefusal: "AS_OF_REQUIRED", shares: null, completeness: null };
  const shares = sharesAt(claim, asOf);
  const rule = ruleAt(rules, asOf);
  return {
    claim,
    asOf,
    asOfRefusal: null,
    shares,
    completeness: { ownership: ownershipCompleteness(claim, shares, rule), beneficiary: beneficiaryCompleteness(shares, rule) },
  };
}

// ------------------------------------------------------------------ reading a payload (srs/07, exchange channels)

const KINDS = ["work", "recording", "release", "party", "role_link", "claim"] as const;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown) => typeof value === "string" && value.trim() !== "";
const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const isWhole = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** The fields of one record that fail the record shape of `srs/07`, typed by its entity kind. */
function failingFields(value: unknown): string[] {
  if (!isObject(value)) return ["record"];
  const failing: string[] = [];
  if (!isWhole(value.record_index)) failing.push("record_index");
  const kind = KINDS.find((candidate) => candidate === value.entity_kind);
  if (kind === undefined) failing.push("entity_kind");
  const identifiers = value.identifiers;
  if (!Array.isArray(identifiers) || !identifiers.every((id) => isObject(id) && isText(id.scheme) && isText(id.value))) failing.push("identifiers");
  const a = value.attributes;
  if (!isObject(a)) return [...failing, "attributes"];
  const need = (field: string, valid: boolean) => {
    if (!valid) failing.push(`attributes.${field}`);
  };
  switch (kind) {
    case "work":
    case "release":
      need("title", isText(a.title));
      need("created_on", isDate(a.created_on));
      break;
    case "recording":
      need("title", isText(a.title));
      need("created_on", isDate(a.created_on));
      need("work_id", a.work_id === undefined || isUuid(a.work_id));
      need("is_instrumental", typeof a.is_instrumental === "boolean");
      need("duration_seconds", a.duration_seconds === undefined || isWhole(a.duration_seconds));
      break;
    case "party":
      need("legal_name", isText(a.legal_name));
      need("party_kind", isText(a.party_kind));
      break;
    case "role_link": {
      need("credit_kind", isText(a.credit_kind));
      const claim = a.claim;
      if (claim !== undefined) {
        const valid =
          isObject(claim) &&
          ["rights_layer", "rights_source", "claim_kind", "territory"].every((field) => isText(claim[field])) &&
          isDate(claim.effective_from) &&
          (claim.effective_to === undefined || isDate(claim.effective_to)) &&
          (claim.share_percent === undefined || (typeof claim.share_percent === "number" && claim.share_percent >= 0 && claim.share_percent <= 100)) &&
          (claim.share_kind === undefined || isText(claim.share_kind));
        need("claim", valid);
      }
      break;
    }
    case "claim":
    case undefined:
      // srs/07 names no attributes for a claim record, so only its envelope is checked.
      break;
  }
  return failing;
}

type Payload =
  | { kind: "unreadable" }
  | { kind: "read"; records: number; boundary: StoredSubmission["boundary"] }
  | { kind: "uncounted" };

/**
 * The file read by its channel's profile. JSON carries `records[]` (or is the array itself) in the record shape
 * of `srs/07`: the records are counted and each is checked at the boundary. The CSV profile's columns are not
 * specified anywhere (WI-CAT-120 is still to do), so a CSV file is recorded by name, type and size, uncounted.
 */
function readPayload(bytes: Uint8Array, format: ExchangeFormat): Payload {
  if (format === "csv") return { kind: "uncounted" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, ""));
  } catch {
    return { kind: "unreadable" };
  }
  const records = Array.isArray(parsed) ? parsed : isObject(parsed) && Array.isArray(parsed.records) ? parsed.records : null;
  if (records === null || records.length === 0) return { kind: "unreadable" };
  if (records.length > RECORD_CEILING) return { kind: "read", records: records.length, boundary: null };
  const boundary = records.flatMap((item: unknown, position) => {
    const fields = failingFields(item);
    const index = isObject(item) && isWhole(item.record_index) ? Number(item.record_index) : position;
    return fields.length > 0 ? [{ index, fields }] : [];
  });
  return { kind: "read", records: records.length, boundary };
}

// ------------------------------------------------------------------ commands

/**
 * One part of a file on its way in (see `stageSubmissionFile` in the seam). A file larger than any submission
 * can be is refused PAYLOAD_TOO_LARGE before it is all sent.
 */
export function stageFile(sessionId: string, upload: string | null, bytes: Uint8Array): StageAnswer {
  const s = stateOf(sessionId);
  const id = upload !== null && s.staged.has(upload) ? upload : randomUUID();
  const staged = s.staged.get(id) ?? { parts: [], size: 0 };
  if (staged.size + bytes.byteLength > MAX_FILE_BYTES) {
    s.staged.delete(id);
    return { upload: null, refusal: "PAYLOAD_TOO_LARGE" };
  }
  staged.parts.push(bytes);
  staged.size += bytes.byteLength;
  s.staged.set(id, staged);
  while (s.staged.size > MAX_STAGED) {
    const oldest = s.staged.keys().next().value;
    if (oldest === undefined || oldest === id) break;
    s.staged.delete(oldest);
  }
  return { upload: id, refusal: null };
}

/** A new reference in the canvas's form, SUB-<the day received>-<four digits>, never one already issued. */
function newReference(s: State): string {
  for (;;) {
    const candidate = `SUB-${today()}-${String(randomInt(1, 10_000)).padStart(4, "0")}`;
    if (!s.submissions.has(candidate)) return candidate;
  }
}

/**
 * POST /submissions (FR-CAT-009, SM-23 RECEIVED). In the contract's order: an active participation
 * (403 PARTICIPATION_SUSPENDED; PARTICIPATION_NOT_ACTIVE without one), the channel and format present and agreed
 * (422 FIELD_MISSING, CHANNEL_NOT_AGREED naming the agreed set), the file present and readable by the channel's
 * profile (FIELD_MISSING), at most 50,000 records (413 PAYLOAD_TOO_LARGE). Accepted, the reference is issued
 * before any record is judged and the submission waits, RECEIVED, for the processor.
 */
export function submit(
  sessionId: string,
  input: {
    organisation: string;
    account: string;
    participation: string | null;
    channel: string;
    format: string;
    upload: string | null;
    name: string;
    type: string;
  },
): SubmitAnswer {
  const s = stateOf(sessionId);
  const staged = input.upload !== null ? (s.staged.get(input.upload) ?? null) : null;
  const fileOf = (records: number | null): SubmitEntered["file"] =>
    staged === null ? null : { name: input.name, type: input.type, sizeBytes: staged.size, records, upload: input.upload };
  const refuse = (code: SubmitRefusalCode, field: "channel" | "format" | "file" | null, records: number | null = null): SubmitAnswer => {
    record(s, { actor: input.account, organisation: input.organisation, act: "POST /submissions", reference: null, code });
    return { outcome: "refused", code, field, file: fileOf(records) };
  };

  if (input.participation === "SUSPENDED") return refuse("PARTICIPATION_SUSPENDED", null);
  if (input.participation !== "ACTIVE") return refuse("PARTICIPATION_NOT_ACTIVE", null);
  if (input.channel === "") return refuse("FIELD_MISSING", "channel");
  const channel = CHANNELS.find((candidate) => candidate.code === input.channel);
  if (channel === undefined || !channel.agreed || channel.format === null) return refuse("CHANNEL_NOT_AGREED", "channel");
  // The format is the channel's profile; any other is no format the channel takes.
  if (input.format !== channel.format) return refuse("FIELD_MISSING", "format");
  if (staged === null || staged.size === 0) return refuse("FIELD_MISSING", "file");

  const bytes = new Uint8Array(staged.size);
  let offset = 0;
  for (const part of staged.parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  const payload = readPayload(bytes, channel.format);
  if (payload.kind === "unreadable") return refuse("FIELD_MISSING", "file");
  const records = payload.kind === "read" ? payload.records : null;
  if (records !== null && records > RECORD_CEILING) return refuse("PAYLOAD_TOO_LARGE", "file", records);

  const reference = newReference(s);
  const submission: Submission = {
    reference,
    state: "RECEIVED",
    channel: channel.code,
    format: channel.format,
    records,
    file: { name: input.name, type: input.type, sizeBytes: staged.size },
    receivedAt: now(),
    submittedBy: input.account,
    processing: null,
    completedAt: null,
    counts: null,
    outcomes: [],
    acknowledged: null,
    cancelled: null,
  };
  s.submissions.set(reference, { organisation: input.organisation, submission, boundary: payload.kind === "read" ? payload.boundary : null });
  if (input.upload !== null) s.staged.delete(input.upload);
  record(s, { actor: input.account, organisation: input.organisation, act: "POST /submissions", reference, code: null });
  return { outcome: "received", reference };
}

/**
 * POST /submissions/{reference}/cancel (FR-CAT-028, SM-23 transition 4): only while RECEIVED (409
 * SUBMISSION_NOT_RECEIVED once processing has begun), with a reason of 1 to 500 characters (422 FIELD_MISSING).
 * The reference is kept: it still finds the submission, marked cancelled, and is never issued again.
 */
export function cancel(sessionId: string, organisation: string, account: string, reference: string, reason: string): CancelAnswer {
  const s = stateOf(sessionId);
  const entry = ownSubmission(s, organisation, reference);
  const refuse = (code: Extract<CancelAnswer, { outcome: "refused" }>["code"]): CancelAnswer => {
    record(s, { actor: account, organisation, act: "POST /submissions/{reference}/cancel", reference, code });
    return { outcome: "refused", code };
  };
  if (typeof entry === "string") return refuse(entry);
  if (entry.submission.state !== "RECEIVED") return refuse("SUBMISSION_NOT_RECEIVED");
  const text = reason.trim();
  if (text === "" || text.length > 500) return refuse("FIELD_MISSING");
  entry.submission = { ...entry.submission, state: "CANCELLED", cancelled: { by: account, at: now(), reason: text } };
  record(s, { actor: account, organisation, act: "POST /submissions/{reference}/cancel", reference, code: null });
  return { outcome: "cancelled" };
}

/**
 * POST /submissions/{reference}/acknowledge for every outcome (FR-CAT-024, SM-23 transition 3): only a completed
 * submission (409 SUBMISSION_NOT_COMPLETED), once (409 ALREADY_ACKNOWLEDGED), and only outcomes that were issued
 * (422 OUTCOME_NEVER_ISSUED).
 */
export function acknowledge(sessionId: string, organisation: string, account: string, reference: string): AcknowledgeAnswer {
  const s = stateOf(sessionId);
  const entry = ownSubmission(s, organisation, reference);
  const refuse = (code: Extract<AcknowledgeAnswer, { outcome: "refused" }>["code"]): AcknowledgeAnswer => {
    record(s, { actor: account, organisation, act: "POST /submissions/{reference}/acknowledge", reference, code });
    return { outcome: "refused", code };
  };
  if (typeof entry === "string") return refuse(entry);
  if (entry.submission.state === "ACKNOWLEDGED") return refuse("ALREADY_ACKNOWLEDGED");
  if (entry.submission.state !== "COMPLETED") return refuse("SUBMISSION_NOT_COMPLETED");
  if (entry.submission.counts === null) return refuse("OUTCOME_NEVER_ISSUED");
  entry.submission = { ...entry.submission, state: "ACKNOWLEDGED", acknowledged: { by: account, at: now() } };
  record(s, { actor: account, organisation, act: "POST /submissions/{reference}/acknowledge", reference, code: null });
  return { outcome: "acknowledged" };
}
