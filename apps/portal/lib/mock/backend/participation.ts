import type { LoadOutcome } from "@rightone/ui";
import type {
  AmendmentRefusal,
  AmendmentStep,
  Answer,
  ApplicationContact,
  ApplicationField,
  ApplicationFields,
  ApplicationForm,
  ApplicationRefusal,
  EvidenceFile,
  MyParticipation,
  NotifiedDecision,
  ObjectionKind,
  ObjectionRecord,
  ObjectionRefusal,
  ObjectionStep,
  ScopeKey,
} from "@/lib/api/participation";
import { CANVAS_REFERENCES, participationSeed, scopeAsAt } from "../participation";
import { addDays, now, today } from "./clock";
import { table } from "./store";

/**
 * The catalogue's participations of the rights organisations (CAT, SM-21), as the API will behave, for the
 * organisation portal: each organisation's draft application, its participation with its approved scope and
 * pending amendments, the decisions notified to it and the objections it lodged. One function per command of
 * `srs/02-api-contracts.md`, checking what the contract checks and answering with the codes of
 * `design/04-refusal-codes.md`; a refused command records nothing. What the person does happens now.
 *
 * The other side is not built: the eight approvals of SCR-CAT-20, the approval of an amendment, the stops of
 * SCR-CAT-21 and 22 and the decision on an objection (SCR-CAT-26). So an application stays APPLIED, an
 * amendment stays pending and an objection stays open, as the boards draw each waiting. Nothing is approved
 * here.
 *
 * Seeded from the canvas (`lib/mock/participation.ts`): Lam Hồng participates under PTC-2026-0107; Dây Đàn has a
 * draft; Hạc Bạch has nothing the catalogue holds. Kept per session; every sign-in starts from the seed.
 */

export type ParticipationState = "APPLIED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "WITHDRAWN";

export interface ParticipationStanding {
  reference: string | null;
  state: ParticipationState | null;
}

/** A participation with what its application asked for, which the approval would judge. */
interface ParticipationRecord extends MyParticipation {
  requested: ApplicationFields | null;
}

interface OrganisationState {
  legalName: string;
  shortName: string;
  partyRecord: string | null;
  partyKind: "organisation" | null;
  draft: { savedAt: string; fields: ApplicationFields } | null;
  /** Oldest first; the last is the organisation's current participation. */
  participations: ParticipationRecord[];
  decisions: NotifiedDecision[];
  objections: ObjectionRecord[];
}

interface ParticipationTables {
  organisations: Map<string, OrganisationState>;
  /** References issued in this session, so the next one follows them. */
  issued: string[];
}

function tables(sessionId: string): ParticipationTables {
  return table(sessionId, "participation", () => {
    const seed = structuredClone(participationSeed());
    const organisations = new Map<string, OrganisationState>();
    for (const [id, organisation] of Object.entries(seed)) {
      organisations.set(id, {
        legalName: organisation.legalName,
        shortName: organisation.shortName,
        partyRecord: organisation.partyRecord,
        partyKind: organisation.partyKind,
        draft: organisation.draft,
        participations: organisation.participation !== null ? [{ ...organisation.participation, requested: null }] : [],
        decisions: [...organisation.decisions],
        objections: [...organisation.objections],
      });
    }
    return { organisations, issued: [] };
  });
}

const current = (organisation: OrganisationState): ParticipationRecord | null => organisation.participations.at(-1) ?? null;

/**
 * A new reference in the canvas's form (PTC-2026-0107): the prefix, the year, and the next number after every
 * one the canvas draws and this session issued.
 */
function nextReference(state: ParticipationTables, prefix: "PTC" | "AMD" | "OBJ"): string {
  const year = today().slice(0, 4);
  const pattern = new RegExp(`^${prefix}-${year}-(\\d{4})$`);
  const numbers = [...CANVAS_REFERENCES, ...state.issued].map((ref) => Number(pattern.exec(ref)?.[1] ?? 0));
  const next = `${prefix}-${year}-${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}`;
  state.issued.push(next);
  return next;
}

/** The organisation's participation standing, read by every page of the portal for its nav and context line. */
export function participationStanding(sessionId: string, organisation: string): ParticipationStanding {
  const mine = tables(sessionId).organisations.get(organisation);
  const participation = mine !== undefined ? current(mine) : null;
  return participation !== null ? { reference: participation.reference, state: participation.state } : { reference: null, state: null };
}

const NOT_YOURS = { data: null, failure: { code: "ROLE_OUT_OF_SCOPE", traceId: null, retryable: false } } as const;

// ---------------------------------------------------------------- SCR-CAT-01, POST /participations

/** A new application: one contact row to fill, as the board draws one; nothing chosen on the person's behalf. */
const EMPTY: ApplicationFields = {
  applyingAs: null,
  evidenceRef: "",
  evidenceFiles: [],
  contacts: [{ name: "", role: null, address: "" }],
  layers: [],
  repertoires: [],
  territories: [],
  periodFrom: null,
  periodTo: null,
};

/**
 * The fields a submission would be refused for with FIELD_MISSING, in the form's order: every mandatory field
 * of SCR-CAT-01's item definition, and each contact's name, role and address.
 */
export function missingFields(fields: ApplicationFields): ApplicationField[] {
  const contactGaps = (contact: ApplicationContact, index: number) => [
    ...(contact.name.trim() === "" ? [`contact_name.${String(index)}`] : []),
    ...(contact.role === null ? [`contact_role.${String(index)}`] : []),
    ...(contact.address.trim() === "" ? [`contact_address.${String(index)}`] : []),
  ];
  return [
    ...(fields.applyingAs === null ? ["applying_as"] : []),
    ...(fields.evidenceRef.trim() === "" ? ["authority_evidence_ref"] : []),
    ...(fields.contacts.length === 0 ? ["contacts"] : fields.contacts.flatMap(contactGaps)),
    ...(fields.layers.length === 0 ? ["rights_layer"] : []),
    ...(fields.repertoires.length === 0 ? ["repertoire"] : []),
    ...(fields.territories.length === 0 ? ["territory"] : []),
    ...(fields.periodFrom === null ? ["period"] : []),
  ];
}

/** Files chosen since the last save are recorded now, by the person saving. */
function stamped(files: readonly EvidenceFile[], by: string): EvidenceFile[] {
  const at = now();
  return files.map((file) => (file.at === null ? { ...file, at, by } : file));
}

export function applicationForm(sessionId: string, organisation: string): LoadOutcome<ApplicationForm> {
  const mine = tables(sessionId).organisations.get(organisation);
  if (mine === undefined) return NOT_YOURS;
  const fields = mine.draft?.fields ?? EMPTY;
  return {
    data: {
      organisation: { legalName: mine.legalName, partyRecord: mine.partyRecord, partyKind: mine.partyKind },
      savedAt: mine.draft?.savedAt ?? null,
      fields,
      // A saved draft is checked as a submission would be; a form nobody has saved yet is not.
      missing: mine.draft !== null ? missingFields(fields) : [],
    },
    failure: null,
  };
}

/** Save draft (SCR-CAT-01): everything as entered, whatever is missing, and the time it was saved. */
export function saveParticipationDraft(sessionId: string, organisation: string, fields: ApplicationFields, by: string): { savedAt: string } {
  const mine = tables(sessionId).organisations.get(organisation);
  const savedAt = now();
  if (mine !== undefined) mine.draft = { savedAt, fields: { ...fields, evidenceFiles: stamped(fields.evidenceFiles, by) } };
  return { savedAt };
}

/** The period a participation holds or asks for, as [from, to) with an open end as null. */
function heldPeriod(participation: ParticipationRecord): { from: string; to: string | null } | null {
  const from = participation.effectiveFrom ?? participation.requested?.periodFrom ?? null;
  if (from === null) return null;
  const to = participation.stop?.kind === "withdrawal" ? participation.stop.effectiveFrom : (participation.requested?.periodTo ?? null);
  return { from, to };
}

const overlaps = (a: { from: string; to: string | null }, b: { from: string; to: string | null }) =>
  (a.to === null || b.from < a.to) && (b.to === null || a.from < b.to);

/**
 * POST /participations. Refusals in the contract's order: FIELD_MISSING naming every missing field, then
 * RANGE_OVERLAP where the party already participates for the period. PERIOD_INVALID (an end before the start)
 * is the family's code for a period that cannot be read as one; the contract does not list it (reported).
 * Accepted, the participation is APPLIED with what was asked for; it confers nothing, and its eight approvals
 * wait for SCR-CAT-20, which is not built.
 */
export function submitParticipation(
  sessionId: string,
  organisation: string,
  fields: ApplicationFields,
  by: string,
): Answer<{ reference: string }, ApplicationRefusal> {
  const state = tables(sessionId);
  const mine = state.organisations.get(organisation);
  if (mine === undefined) return { accepted: null, refusal: { code: "FIELD_MISSING", fields: [] } };
  const missing = missingFields(fields);
  if (missing.length > 0) return { accepted: null, refusal: { code: "FIELD_MISSING", fields: missing } };
  const asked = { from: fields.periodFrom ?? "", to: fields.periodTo };
  if (asked.to !== null && asked.to < asked.from) return { accepted: null, refusal: { code: "PERIOD_INVALID", fields: ["period"] } };
  const held = mine.participations.map(heldPeriod).filter((period) => period !== null);
  if (held.some((period) => overlaps(period, asked))) return { accepted: null, refusal: { code: "RANGE_OVERLAP", fields: ["period"] } };

  const reference = nextReference(state, "PTC");
  mine.participations.push({
    reference,
    organisation: mine.legalName,
    shortName: mine.shortName,
    kind: null,
    state: "APPLIED",
    appliedAt: now(),
    approvedOn: null,
    effectiveFrom: null,
    lastReviewedOn: null,
    stop: null,
    // Requested is not granted (@AC-FR-CAT-001-03): the approved scope is written by the approval, not here.
    scope: [],
    amendments: [],
    decision: null,
    requested: { ...fields, evidenceFiles: stamped(fields.evidenceFiles, by) },
  });
  mine.draft = null;
  return { accepted: { reference }, refusal: null };
}

// ---------------------------------------------------------------- SCR-CAT-02

/** The organisation's current participation; null data when it has none. */
export function myParticipation(sessionId: string, organisation: string): LoadOutcome<MyParticipation | null> {
  const mine = tables(sessionId).organisations.get(organisation);
  if (mine === undefined) return NOT_YOURS;
  const participation = current(mine);
  // What was asked for stays with the approval; the organisation reads the participation as it stands.
  return { data: participation, failure: null };
}

// ---------------------------------------------------------------- SCR-CAT-03

/** A new amendment of the organisation's active participation; null data when it has none active. */
export function amendmentStep(sessionId: string, organisation: string, preparer: string): LoadOutcome<AmendmentStep | null> {
  const mine = tables(sessionId).organisations.get(organisation);
  if (mine === undefined) return NOT_YOURS;
  const participation = current(mine);
  if (participation?.state !== "ACTIVE") return { data: null, failure: null };
  const day = today();
  return {
    data: {
      participation: { reference: participation.reference, organisation: participation.organisation, shortName: participation.shortName },
      today: day,
      current: scopeAsAt(participation, day).rows,
      amendment: null,
      preparer,
      legalReader: null,
      draft: null,
    },
    failure: null,
  };
}

const sameKey = (a: ScopeKey, b: ScopeKey) => a.right === b.right && a.repertoire === b.repertoire && a.territory === b.territory;

/**
 * POST /participations/{id}/scope-amendments. PARTICIPATION_NOT_ACTIVE first, then the effective date (missing,
 * or not after today: EFFECTIVE_FROM_IN_PAST, "future only"), then FIELD_MISSING for an addition row left
 * incomplete or for no change at all. Accepted, one pending amendment and no scope row changes: the approval
 * (ACT-LGL, not the proposer) is not built.
 */
export function proposeScopeAmendment(
  sessionId: string,
  organisation: string,
  proposal: { additions: readonly ScopeKey[]; incomplete: string | null; removals: readonly string[]; effectiveFrom: string | null },
  by: string,
): Answer<{ reference: string }, AmendmentRefusal> {
  const state = tables(sessionId);
  const mine = state.organisations.get(organisation);
  const participation = mine !== undefined ? current(mine) : null;
  if (participation?.state !== "ACTIVE") return { accepted: null, refusal: { code: "PARTICIPATION_NOT_ACTIVE", field: null } };
  const { effectiveFrom } = proposal;
  if (effectiveFrom === null) return { accepted: null, refusal: { code: "FIELD_MISSING", field: "effective_from" } };
  if (effectiveFrom <= today()) return { accepted: null, refusal: { code: "EFFECTIVE_FROM_IN_PAST", field: "effective_from" } };
  if (proposal.incomplete !== null) return { accepted: null, refusal: { code: "FIELD_MISSING", field: proposal.incomplete } };
  // A closing names a row in force today; anything else names no row of this scope and closes nothing.
  const inForce = scopeAsAt(participation, today()).rows;
  const removals = inForce.filter((row) => proposal.removals.includes(`${row.right}-${row.repertoire}-${row.territory}`));
  const additions = proposal.additions.filter((key, index, all) => all.findIndex((other) => sameKey(other, key)) === index);
  if (additions.length === 0 && removals.length === 0) return { accepted: null, refusal: { code: "FIELD_MISSING", field: "changes" } };

  const reference = nextReference(state, "AMD");
  participation.amendments = [
    ...participation.amendments,
    {
      reference,
      additions,
      removals: removals.map(({ right, repertoire, territory }) => ({ right, repertoire, territory })),
      effectiveFrom,
      preparedBy: by,
      preparedAt: now(),
    },
  ];
  return { accepted: { reference }, refusal: null };
}

// ---------------------------------------------------------------- SCR-CAT-25, POST /objections

/** CFG-35's answering periods, in days, for the kinds an organisation may lodge about a decision. */
const ANSWER_DAYS: Readonly<Record<ObjectionKind, number>> = { correction: 10, erasure: 20, objection: 15 };

const answerDue = (from: string): Record<ObjectionKind, string> => ({
  objection: addDays(from, ANSWER_DAYS.objection),
  correction: addDays(from, ANSWER_DAYS.correction),
  erasure: addDays(from, ANSWER_DAYS.erasure),
});

/**
 * The decision the reference names, with the objection already lodged about it. A reference that names no
 * decision notified to this organisation answers as the board's not-found state draws it (OBJECTION_UNKNOWN):
 * it does not say whether the reference exists for someone else.
 */
export function objectionStep(sessionId: string, organisation: string, decision: string): LoadOutcome<ObjectionStep> {
  const mine = tables(sessionId).organisations.get(organisation);
  const notified = mine?.decisions.find((entry) => entry.reference === decision);
  const participation = mine !== undefined ? current(mine) : null;
  if (mine === undefined || notified === undefined || participation === null) {
    return { data: null, failure: { code: "OBJECTION_UNKNOWN", traceId: null, retryable: false } };
  }
  return {
    data: {
      decision: notified,
      participation: { reference: participation.reference, organisation: participation.organisation, state: participation.state },
      objection: mine.objections.findLast((entry) => entry.decision === decision) ?? null,
      dueBy: answerDue(now()),
      ground: "",
    },
    failure: null,
  };
}

/**
 * POST /objections. FIELD_MISSING (the kind, the ground), SUBJECT_UNKNOWN where the reference names no decision
 * notified to this organisation, OBJECTION_ALREADY_OPEN for a second while the first is open. Accepted, the
 * objection is open with its due date stamped from CFG-35; the decision stays in force, and its answer waits
 * for SCR-CAT-26, which is not built.
 */
export function lodgeObjection(
  sessionId: string,
  organisation: string,
  request: { decision: string; requested: ObjectionKind | null; ground: string },
): Answer<{ reference: string }, ObjectionRefusal> {
  const state = tables(sessionId);
  const mine = state.organisations.get(organisation);
  const missing = [...(request.requested === null ? (["request_kind"] as const) : []), ...(request.ground.trim() === "" ? (["ground"] as const) : [])];
  if (missing.length > 0) return { accepted: null, refusal: { code: "FIELD_MISSING", fields: missing } };
  if (mine?.decisions.some((entry) => entry.reference === request.decision) !== true) {
    return { accepted: null, refusal: { code: "SUBJECT_UNKNOWN", fields: [] } };
  }
  if (mine.objections.some((entry) => entry.decision === request.decision && entry.outcome === null)) {
    return { accepted: null, refusal: { code: "OBJECTION_ALREADY_OPEN", fields: [] } };
  }
  const requested = request.requested ?? "objection";
  const lodgedAt = now();
  const reference = nextReference(state, "OBJ");
  mine.objections.push({
    reference,
    decision: request.decision,
    requested,
    ground: request.ground.trim(),
    lodgedAt,
    dueAt: answerDue(lodgedAt)[requested],
    outcome: null,
  });
  return { accepted: { reference }, refusal: null };
}
