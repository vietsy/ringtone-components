import { randomUUID } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  CommandAnswer,
  GovField,
  GovRefusal,
  Mandate,
  MandateDraft,
  MandateForm,
  MandateInput,
  MandateState,
  OurMandate,
  RecordedTerms,
  TermsInput,
  TermsPage,
} from "@/lib/api/governance";
import { CURRENT_TERMS, GOVERNANCE_SEED, MANDATE_REGISTER, RIGHT_TYPES } from "@/lib/mock/governance";
import { now, today } from "./clock";
import { table } from "./store";

/**
 * GOV's behaviour for the organisation portal, played by the mock backend for one signed-in session: each rights
 * organisation's mandates and participation terms, and the draft of a mandate an administrator is preparing.
 * Commands are named after the API's operations (`srs/02-api-contracts.md`) and refuse with the codes of
 * `design/04-refusal-codes.md`. Every function takes the session's own organisation; nothing here can read or
 * write another organisation's records.
 *
 * The copyright authority's side (approve, review, suspend, withdraw on SCR-GOV-02) has no screen yet, so a
 * submitted mandate stays SUBMITTED, as the board draws it while the authority reviews: SM-19 forbids a mandate
 * going from SUBMITTED to EFFECTIVE without that approval.
 */

interface MandateRecord {
  id: string;
  mandate: Mandate;
  /** The `Idempotency-Key` it was submitted under; null for a seeded mandate. */
  idempotencyKey: string | null;
  /** `gov.mandate_state_history`: each state with the instant it began, where one is known. */
  history: { at: string | null; state: MandateState }[];
}

interface TermsRecord {
  id: string;
  terms: RecordedTerms;
  idempotencyKey: string | null;
}

interface OrganisationBook {
  shortName: string | null;
  /** The latest last. */
  mandates: MandateRecord[];
  /** The draft saved on this device; the spec holds it locally, and the session plays the device. */
  draft: MandateDraft | null;
  /** The latest last. */
  terms: TermsRecord[];
}

type GovernanceTable = Map<string, OrganisationBook>;

function seed(): GovernanceTable {
  return new Map(
    Object.entries(GOVERNANCE_SEED).map(([organisation, entry]) => [
      organisation,
      {
        shortName: entry.shortName,
        mandates: entry.mandate === null ? [] : [{ id: randomUUID(), mandate: entry.mandate, idempotencyKey: null, history: [{ at: null, state: entry.mandate.state }] }],
        draft: null,
        terms: entry.terms === null ? [] : [{ id: randomUUID(), terms: entry.terms, idempotencyKey: null }],
      },
    ]),
  );
}

/** The organisation's book in this session; an organisation the canvas draws nothing for starts empty. */
function bookOf(sessionId: string, organisation: string): OrganisationBook {
  const books = table(sessionId, "governance", seed);
  const found = books.get(organisation);
  if (found !== undefined) return found;
  const empty: OrganisationBook = { shortName: null, mandates: [], draft: null, terms: [] };
  books.set(organisation, empty);
  return empty;
}

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

const refused = (code: string, field: GovField | null = null, row: number | null = null, range: GovRefusal["range"] = null): CommandAnswer<never> => ({
  accepted: null,
  refusal: { code, field, row, range },
});

const organisationOf = (book: OrganisationBook, name: string) => ({ name, shortName: book.shortName ?? name });

/** States that no longer confer anything and no longer hold a period against a new mandate. */
const TERMINAL: ReadonlySet<MandateState> = new Set(["EXPIRED", "WITHDRAWN"]);

/** Whether two `[from, to)` ranges share a day; a missing start or end is unbounded on that side. */
function overlaps(a: { from: string | null; to: string | null }, b: { from: string | null; to: string | null }): boolean {
  const startsBeforeEnd = (from: string | null, to: string | null) => from === null || to === null || from < to;
  return startsBeforeEnd(a.from, b.to) && startsBeforeEnd(b.from, a.to);
}

/** The name the session's organisation goes by in a sentence; null where the canvas draws none. */
export function shortNameOf(sessionId: string, organisation: string): string | null {
  return bookOf(sessionId, organisation).shortName;
}

// ---------------------------------------------------------------- SCR-GOV-14

/** GET /mandates for the session's organisation: its latest mandate, and the draft saved on this device. */
export function mandateOf(sessionId: string, organisation: string, organisationName: string): LoadOutcome<OurMandate> {
  const book = bookOf(sessionId, organisation);
  return ok({
    organisation: organisationOf(book, organisationName),
    mandate: book.mandates.at(-1)?.mandate ?? null,
    draft: book.draft,
    register: MANDATE_REGISTER,
  });
}

/** Save draft: the form as entered, kept with the moment it was saved. Nothing is validated and nothing submitted. */
export function keepMandateDraft(sessionId: string, organisation: string, form: MandateForm): { savedAt: string } {
  const savedAt = now();
  bookOf(sessionId, organisation).draft = { ...form, savedAt };
  return { savedAt };
}

/** The first field of the form that is missing, in the screen's focus order (SCR-GOV-14, Accessibility). */
function firstMissing(input: MandateInput): CommandAnswer<never> | null {
  if (!MANDATE_REGISTER.authorities.some((authority) => authority.id === input.authority)) return refused("FIELD_MISSING", "granting_authority_id");
  const evidence = input.evidence;
  if (evidence === null || evidence.name.trim() === "" || evidence.sizeBytes <= 0) return refused("FIELD_MISSING", "authority_evidence_ref");
  if (input.rows.length === 0) return refused("FIELD_MISSING", "scope");
  for (const [index, row] of input.rows.entries()) {
    // A value outside the controlled set or the recorded geography is refused as absent (`06-data-validation.md`).
    if (!(RIGHT_TYPES as readonly string[]).includes(row.rightType)) return refused("FIELD_MISSING", "right_type", index);
    if (row.repertoire.trim() === "") return refused("FIELD_MISSING", "repertoire_key", index);
    if (!MANDATE_REGISTER.provinces.some((province) => province.code === row.territory)) return refused("FIELD_MISSING", "territory_code", index);
  }
  if (input.from === null) return refused("FIELD_MISSING", "effective_from");
  return null;
}

/**
 * POST /mandates for the session's organisation. Refused with `FIELD_MISSING` naming the first absent attribute,
 * `PERIOD_INVALID` when the end is not after the start, `RANGE_OVERLAP` when the range overlaps a mandate the
 * organisation already holds; otherwise recorded as SUBMITTED, conferring nothing until the authority approves.
 * The same `Idempotency-Key` sent again answers the mandate it recorded.
 */
export function submitMandate(sessionId: string, organisation: string, input: MandateInput): CommandAnswer<{ state: MandateState }> {
  const book = bookOf(sessionId, organisation);
  const again = book.mandates.find((record) => record.idempotencyKey === input.idempotencyKey);
  if (again !== undefined) return { accepted: { state: again.mandate.state }, refusal: null };

  const missing = firstMissing(input);
  if (missing !== null) return missing;
  // `06-data-validation.md` requires the end strictly after the start and names RANGE_OVERLAP for it, but that
  // code's sentence speaks of an existing record's range; the family's PERIOD_INVALID states this condition.
  if (input.to !== null && input.from !== null && input.to <= input.from) return refused("PERIOD_INVALID", "effective_to");
  const range = { from: input.from, to: input.to };
  const clash = book.mandates.find((record) => !TERMINAL.has(record.mandate.state) && overlaps(range, { from: record.mandate.effectiveFrom, to: record.mandate.effectiveTo }));
  if (clash !== undefined && clash.mandate.effectiveFrom !== null) {
    return refused("RANGE_OVERLAP", null, null, { from: clash.mandate.effectiveFrom, to: clash.mandate.effectiveTo });
  }
  if (clash !== undefined) return refused("RANGE_OVERLAP");

  const at = now();
  book.mandates.push({
    id: randomUUID(),
    mandate: {
      state: "SUBMITTED",
      submittedOn: today(),
      grantingAuthority: input.authority,
      evidence: input.evidence !== null ? { kind: "file", file: input.evidence } : null,
      scope: input.rows.map((row) => ({ rightType: row.rightType, repertoire: row.repertoire.trim(), territory: row.territory })),
      effectiveFrom: input.from,
      effectiveTo: input.to,
      stoppedOn: null,
      review: null,
    },
    idempotencyKey: input.idempotencyKey,
    history: [{ at, state: "SUBMITTED" }],
  });
  // What was drafted on this device is now the submission.
  book.draft = null;
  return { accepted: { state: "SUBMITTED" }, refusal: null };
}

// ---------------------------------------------------------------- SCR-GOV-15

/** GET /participation-terms for the session's organisation: the terms in effect, if any, and the current version. */
export function termsOf(sessionId: string, organisation: string, organisationName: string): LoadOutcome<TermsPage> {
  const book = bookOf(sessionId, organisation);
  const recorded = book.terms.filter((record) => record.terms.state === "EFFECTIVE").at(-1)?.terms ?? null;
  return ok({ organisation: organisationOf(book, organisationName), current: CURRENT_TERMS, terms: recorded, entered: null });
}

/**
 * POST /participation-terms for the session's organisation. A waiver is never recorded (`RIGHT_CANNOT_BE_WAIVED`),
 * a version other than the current one is refused (`TERMS_VERSION_SUPERSEDED`), the start is required
 * (`FIELD_MISSING`). Terms already in effect hold the organisation's range (`EXCLUDE` on `party_id`,
 * `srs/03-data-model.md`), so a second recording overlaps them; the endpoint lists no code for that, and the
 * family's `RANGE_OVERLAP` says it. The same `Idempotency-Key` sent again answers the terms it recorded.
 */
export function recordParticipationTerms(sessionId: string, organisation: string, input: TermsInput): CommandAnswer<{ effectiveFrom: string }> {
  const book = bookOf(sessionId, organisation);
  const again = book.terms.find((record) => record.idempotencyKey === input.idempotencyKey);
  if (again !== undefined) return { accepted: { effectiveFrom: again.terms.effectiveFrom }, refusal: null };

  if (!input.directLicensingRetained) return refused("RIGHT_CANNOT_BE_WAIVED");
  if (input.termsVersion !== CURRENT_TERMS.version) return refused("TERMS_VERSION_SUPERSEDED");
  if (input.effectiveFrom === null) return refused("FIELD_MISSING", "effective_from");
  const held = book.terms.find((record) => record.terms.state === "EFFECTIVE");
  if (held !== undefined) return refused("RANGE_OVERLAP", null, null, { from: held.terms.effectiveFrom, to: null });

  book.terms.push({
    id: randomUUID(),
    terms: { version: CURRENT_TERMS, effectiveFrom: input.effectiveFrom, recordedAt: now(), state: "EFFECTIVE", directLicensingRetained: true },
    idempotencyKey: input.idempotencyKey,
  });
  return { accepted: { effectiveFrom: input.effectiveFrom }, refusal: null };
}
