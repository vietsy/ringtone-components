import type { LoadOutcome } from "@rightone/ui";
import {
  ACTS,
  APPROVAL_LEVELS,
  CANDIDACY_KINDS,
  CHANGE_SUBJECT_KINDS,
  EVIDENCE_KINDS,
  PARTY_KINDS,
  PARTY_STATES,
  REVIEW_KINDS,
  type Act,
  type ActKind,
  type AmendForm,
  type ApprovalLevel,
  type AmendInput,
  type AuthorityDetail,
  type AuthorityList,
  type AuthorityRow,
  type AuthorityState,
  type CandidacyInput,
  type CandidateRecord,
  type ChangeRecordList,
  type ChangeRecordRow,
  type ChangeSubjectKind,
  type DeclarationInput,
  type DecisionInput,
  type GrantForm,
  type GrantInput,
  type IdentificationForm,
  type IdentificationView,
  type LicensingStatus,
  type PartyAnswer,
  type PartyDetail,
  type PartyInput,
  type PartyKind,
  type PartyList,
  type PartyPersonView,
  type PartyState,
  type PersonAmendInput,
  type PersonInput,
  type PersonResolution,
  type PremisesRow,
  type PrincipalInput,
  type ReferenceClass,
  type ReferenceClassView,
  type ReviewDetail,
  type ReviewKind,
  type ReviewQueue,
  type ReviewState,
  type RevocationInput,
  type SourceCondition,
  type VersionView,
  type Words,
} from "@/lib/api/parties";
import type { Principal, Staff } from "@/lib/api/session";
import { partiesSeed, type SeedAuthority, type SeedParty, type SeedPerson, type SeedRelationship, type SeedReview, type SeedSearch, type SourceRecord } from "../parties";
import { PREMISES_IDS } from "../premises";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { applyDuePremisesChanges } from "./premises";
import { listCertificates } from "./status-records";
import { sessions, table, type StaffRole } from "./store";

/*
 * The party family's backend (PTY), as the API will behave for the screens of parties, identification and authority
 * to act: one function per endpoint of `srs/02-api-contracts.md` sections 1, 3 and 4. A command checks what the
 * contract checks, in the order the decision rules give (DR-200 for an identification, DR-202 for an authority,
 * DR-203 for a review), and answers with the codes of `design/04-refusal-codes.md`; a refused command records
 * nothing. The world holds every party; a read is scoped to its reader: the operations officer reads the register,
 * the principal only the party they act for, the security admin and assurance the authorities, read only.
 *
 * An authority's state is never stored: it is worked out at the moment it is read (SM-192), so an authority starts
 * and ends on its dates with nobody acting, and a revocation takes effect at its instant. The licensing status of a
 * premises is the status record's, read from CER (DR-207); this family never sets one.
 */

// ---------------------------------------------------------------- the state

interface Party extends SeedParty {
  /** The declarations made by hand, newest last; a returned one stays readable on its review. */
  declarations: IdentificationView[];
}

interface Authority extends Omit<SeedAuthority, "versions" | "revocation"> {
  versions: { from: string; acts: readonly Act[] }[];
  revocation: SeedAuthority["revocation"] | { at: string; by: string; ground: string; propagation: null };
  /** Free text a principal typed for the basis, where the seed names a basis by its code. */
  basisText: boolean;
  groundText: boolean;
  file: { name: string; sizeBytes: number } | null;
  /** DR-202: the approval an authority with no end date was recorded with. */
  approval: { by: string; level: ApprovalLevel } | null;
}

interface Review extends SeedReview {
  state: ReviewState;
  /** IDENTIFICATION: the declaration under review. */
  declaration: IdentificationView | null;
  decision: ReviewDetail["decision"];
}

interface Person extends SeedPerson {
  /** The record a linkage decision superseded this one with, and when; it stays resolvable (FR-PTY-044). */
  supersededBy: { person: string; at: string } | null;
}

interface State {
  parties: Map<string, Party>;
  relationships: SeedRelationship[];
  persons: Map<string, Person>;
  personParties: Map<string, Set<string>>;
  authorities: Map<string, Authority>;
  /** Authority references in the order a party's list shows them: the newest grant first. */
  order: string[];
  reviews: Map<string, Review>;
  searches: Map<string, SeedSearch>;
  /** How the national business-registration source stands (CFG-241); the mock's is configured and answers. */
  source: SourceCondition;
  /** What the source holds, which a search matches against. */
  sourceRecords: readonly SourceRecord[];
  /** CFG-240: no approved value yet (Q-PTY-01), so every authority with no end date is refused. */
  delegationStandard: { level: ApprovalLevel } | null;
  /** `party.change_records`: every change to the register, append-only, oldest first (FR-PTY-048). */
  changeRecords: ChangeRecord[];
  /** The module audit log: a refused act under an authority, with its code. */
  audit: { code: string; person: string | null; subject: string; at: string }[];
}

function fromSeed(): State {
  const seed = partiesSeed();
  return {
    parties: new Map(seed.parties.map((entry) => [entry.record, { ...entry, declarations: [] }])),
    relationships: seed.relationships.map((entry) => ({ ...entry, premises: { ...entry.premises } })),
    persons: new Map(seed.persons.map((person) => [person.reference, { ...person, supersededBy: null }])),
    personParties: new Map(Object.entries(seed.personParties).map(([person, parties]) => [person, new Set(parties)])),
    authorities: new Map(
      seed.authorities.map((entry) => [
        entry.reference,
        { ...entry, versions: entry.versions.map((version) => ({ ...version })), basisText: false, groundText: false, file: null, approval: null },
      ]),
    ),
    order: seed.authorities.map((entry) => entry.reference),
    reviews: new Map(seed.reviews.map((review) => [review.id, { ...review, state: "OPEN", declaration: null, decision: null }])),
    searches: new Map(seed.searches.map((search) => [search.party, { ...search }])),
    source: "REACHABLE",
    sourceRecords: seed.source,
    delegationStandard: null,
    changeRecords: [],
    audit: [],
  };
}

/**
 * The register as it stands when read, after what runs with nobody acting: the premises register's change sweep (a
 * change due today has ended its relationship before an authority is decided on it), and the revocation propagation
 * (ALG-185).
 */
function state(key: string): State {
  const s = table(key, "parties", fromSeed);
  applyDuePremisesChanges(key);
  propagateRevocations(s);
  return s;
}

/**
 * The party register's state as the premises register reads and writes it (`premises.ts`): one family, so a premises
 * change ends and starts the same relationships the party detail lists and an authority lapses with. It runs no sweep:
 * the premises register runs its own.
 */
export type PartyRegister = State;
export const partyRegister = (key: string): PartyRegister => table(key, "parties", fromSeed);

// ---------------------------------------------------------------- answers

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const accept = <T,>(accepted: T): PartyAnswer<T> => ({ accepted, refusal: null });
const refuse = (code: string, field: string | null = null, values: Readonly<Record<string, string>> = {}): PartyAnswer<never> => ({
  accepted: null,
  refusal: { code, field, values },
});

const holds = (staff: Staff, ...roles: readonly StaffRole[]): boolean => roles.some((role) => staff.roles.includes(role));

// ---------------------------------------------------------------- the change record (FR-PTY-048)

type ChangeRecord = ChangeRecordRow;

/**
 * One row appended to `party.change_records`: the subject, what changed, the acting person or process, and what the act
 * relied on - a premises actor's authority and its version, an operator's permission row, a sweep's rule. Rows are
 * never changed or removed; a revocation leaves the rows written under the authority as they are (FR-PTY-018).
 */
export function recordChange(s: PartyRegister, row: Omit<ChangeRecord, "id" | "at"> & { at?: string }): void {
  s.changeRecords.push({ ...row, id: reference("CHR"), at: row.at ?? now() });
}

/** An officer acts for the programme under a permission row of `frd/09`, never under a party's authority. */
const byOfficer = (staff: Staff): ChangeRecord["actor"] => ({ kind: "PERSON", name: staff.account, person: null });
const underRow = (row: string): ChangeRecord["reliedOn"] => ({ kind: "PERMISSION", row });

// ---------------------------------------------------------------- time

const VN = "+07:00";
const startOf = (day: string): number => Date.parse(`${day}T00:00:00${VN}`);
const DAY_MS = 24 * 60 * 60 * 1000;
/** The calendar day of an instant in Vietnam time. */
const dayOf = (instant: string): string => addDays(instant, 0);
/** Whole days from one instant to another, by calendar day in Vietnam time. */
const daysBetween = (from: string, to: string): number => Math.round((startOf(dayOf(to)) - startOf(dayOf(from))) / DAY_MS);

// ---------------------------------------------------------------- reading the register

function partyOfOrganisation(s: State, organisation: string): Party | null {
  return [...s.parties.values()].find((entry) => entry.organisation === organisation && entry.state !== "SUPERSEDED") ?? null;
}

const nameOfParty = (s: State, record: string): string => s.parties.get(record)?.legalName ?? record;
const personName = (s: State, ref: string): string => s.persons.get(ref)?.name ?? ref;

/** A relationship the party has at the end of today: started, and not ended before today. */
const isCurrent = (relationship: SeedRelationship, day: string): boolean =>
  (relationship.from === null || relationship.from <= day) && (relationship.to === null || relationship.to >= day);

function currentPremises(s: State, record: string): SeedRelationship[] {
  const day = today();
  return s.relationships.filter((entry) => entry.party === record && isCurrent(entry, day));
}

/** SM-192 at an instant: revoked from its instant, lapsed with its premises, pending before its start, ended after its last day. */
function authorityState(s: State, authority: Authority, at: number): AuthorityState {
  if (authority.revocation !== null && Date.parse(authority.revocation.at) <= at) return "REVOKED";
  const first = authority.versions[0];
  if (first !== undefined && at < Date.parse(first.from)) return "PENDING_START";
  if (authority.to !== null && at >= startOf(authority.to) + DAY_MS) return "EXPIRED";
  if (authority.premises !== null) {
    const day = dayOf(new Date(at).toISOString());
    const operated = s.relationships.some((entry) => entry.party === authority.party && entry.premises.name === authority.premises && isCurrent(entry, day));
    if (!operated) return "LAPSED";
  }
  return "EFFECTIVE";
}

/** The version in force at an instant; before the first starts, the first; after the last, the last. */
function versionAt(authority: Authority, at: number): { index: number; from: string; acts: readonly Act[] } {
  let index = 0;
  authority.versions.forEach((version, position) => {
    if (Date.parse(version.from) <= at) index = position;
  });
  const version = authority.versions[index] ?? { from: "", acts: [] };
  return { index, from: version.from, acts: version.acts };
}

function premisesOfAuthority(s: State, authority: Authority): { record: string | null; name: string } | null {
  if (authority.premises === null) return null;
  const relationship = s.relationships.find((entry) => entry.party === authority.party && entry.premises.name === authority.premises);
  return { record: relationship?.premises.record ?? null, name: authority.premises };
}

function authorityRow(s: State, authority: Authority, at: number): AuthorityRow {
  const first = authority.versions[0];
  const revocationAt = authority.revocation !== null ? Date.parse(authority.revocation.at) : null;
  return {
    reference: authority.reference,
    person: personName(s, authority.person),
    premises: premisesOfAuthority(s, authority),
    acts: versionAt(authority, revocationAt !== null && revocationAt <= at ? revocationAt - 1 : at).acts,
    from: first !== undefined ? dayOf(first.from) : "",
    to: authority.to,
    state: authorityState(s, authority, at),
    revoked: authority.revocation !== null ? { at: authority.revocation.at, by: authority.revocation.by } : null,
    unpropagated: unpropagatedOf(authority),
    recorded: authority.recorded,
  };
}

/** The first decision point a revocation has not reached, with the exception it raised (FR-PTY-028). */
function unpropagatedOf(authority: Authority): AuthorityRow["unpropagated"] {
  const late = authority.revocation?.propagation?.find((point) => point.stoppedAt === null && point.exception !== null);
  return late !== undefined && late.exception !== null ? { point: late.point, acknowledgedAt: late.exception.acknowledgedAt } : null;
}

const authoritiesOf = (s: State, record: string): Authority[] =>
  s.order.map((ref) => s.authorities.get(ref)).filter((entry): entry is Authority => entry !== undefined && entry.party === record);

/** DR-207 read from CER: the record the premises holds now, or the last it held, under the party's legal name. */
function licensingOf(key: string, holder: string, premises: string): { status: LicensingStatus; record: { reference: string; since: string } | null } {
  const records = (listCertificates(key, holder).data?.records ?? []).filter((record) => record.premises === premises);
  const current = records.find((record) => record.state === "active" || record.state === "expiring" || record.state === "reinstated");
  if (current !== undefined) return { status: "LICENSED", record: { reference: current.reference, since: dayOf(current.since) } };
  const last = records[0];
  return last !== undefined ? { status: "LAPSED", record: { reference: last.reference, since: dayOf(last.since) } } : { status: "UNREGISTERED", record: null };
}

function premisesRows(key: string, s: State, party: Party): PremisesRow[] {
  return currentPremises(s, party.record).map((entry) => {
    const licensing = licensingOf(key, party.legalName, entry.premises.name);
    return {
      record: entry.premises.record,
      name: entry.premises.name,
      since: entry.from,
      licensing: licensing.status,
      statusRecord: licensing.record,
      application: licensing.status === "UNREGISTERED" ? entry.application : null,
    };
  });
}

function supersededOf(s: State, party: Party): PartyList["rows"][number]["supersededBy"] {
  if (party.supersededBy === null) return null;
  return { record: party.supersededBy.record, legalName: nameOfParty(s, party.supersededBy.record), on: party.supersededBy.on, by: party.supersededBy.by };
}

const openReviews = (s: State) => [...s.reviews.values()].filter((review) => review.state === "OPEN");

/** The persons a party's own authorities name, or the register's principal: SEC-203's "its own authorised people". */
function namedByParty(s: State, record: string, staff: Staff): boolean {
  const at = Date.now();
  return authoritiesOf(s, record).some((authority) => {
    const state = authorityState(s, authority, at);
    return (state === "EFFECTIVE" || state === "PENDING_START") && s.persons.get(authority.person)?.account === staff.email;
  });
}

// ---------------------------------------------------------------- SCR-PTY-01

const collator = new Intl.Collator("vi", { sensitivity: "variant", caseFirst: "upper" });
const fold = (text: string) => text.normalize("NFC").toLocaleLowerCase("vi");

/** GET /parties: the whole national register, by name, party record or the last digits of the registration number. */
export function partyList(staff: Staff, asked: { q: string | null; state: string | null }): LoadOutcome<PartyList> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  const q = asked.q?.trim() ?? "";
  const wanted = (PARTY_STATES as readonly string[]).includes(asked.state ?? "") ? (asked.state as PartyState) : null;
  const digits = q.replace(/\D/g, "");
  const rows = [...s.parties.values()]
    .filter((entry) => wanted === null || entry.state === wanted)
    .filter((entry) => {
      if (q === "") return true;
      if (fold(entry.legalName).includes(fold(q)) || entry.record.toLowerCase() === q.toLowerCase()) return true;
      return digits.length >= 4 && entry.businessRegistration !== null && entry.businessRegistration.endsWith(digits.slice(-4));
    })
    .sort((a, b) => collator.compare(a.legalName, b.legalName))
    .map((entry) => ({
      record: entry.record,
      legalName: entry.legalName,
      businessRegistration: entry.businessRegistration,
      kind: entry.kind,
      state: entry.state,
      supersededBy: supersededOf(s, entry),
    }));
  return ok({ asOf: now(), filter: { q: q === "" ? null : q, state: wanted }, rows, openReviews: openReviews(s).length });
}

/** POST /parties: a party record in DRAFT, which an identification has to move on (SM-190). */
export function createParty(staff: Staff, input: PartyInput): PartyAnswer<{ record: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  if (!(PARTY_KINDS as readonly string[]).includes(input.kind)) return refuse("PARTY_KIND_NOT_PERMITTED", "party_kind");
  if (input.legalName.trim() === "") return refuse("FIELD_MISSING", "legal_name");
  // The number is kept as the register shows it everywhere: masked to its last four characters.
  const typed = input.businessRegistration.replace(/\s/g, "");
  const masked = typed === "" ? null : `******${typed.slice(-4)}`;
  const holder = masked === null ? undefined : [...s.parties.values()].find((entry) => entry.businessRegistration === masked && entry.state !== "SUPERSEDED");
  if (holder !== undefined) return refuse("IDENTIFYING_REFERENCE_TAKEN", "identifying_reference", { party: holder.legalName, record: holder.record });
  const record = nextPartyRecord(s);
  s.parties.set(record, {
    record,
    organisation: null,
    legalName: input.legalName.trim(),
    kind: input.kind as PartyKind,
    businessRegistration: masked,
    state: "DRAFT",
    origin: { kind: "CREATED", on: now(), by: staff.account },
    principal: null,
    identification: null,
    supersededBy: null,
    licenceHistory: 0,
    verificationReads: 0,
    changeRecords: null,
    declarations: [],
  });
  recordChange(s, { subject: { kind: "PARTY", reference: record }, change: "PARTY_CREATED", values: { legalName: input.legalName.trim() }, actor: byOfficer(staff), reliedOn: underRow("CREATE_PARTY") });
  return accept({ record });
}

/** A party record: PTY- and six digits, above every record the register holds. */
function nextPartyRecord(s: State): string {
  const highest = Math.max(...[...s.parties.keys()].map((record) => Number(record.slice(4))));
  return `PTY-${String(highest + 1)}`;
}

// ---------------------------------------------------------------- SCR-PTY-02

/** GET /parties/{id}: the party, how it was identified, its premises and who may act for it. */
export function partyDetail(staff: Staff, record: string): LoadOutcome<PartyDetail> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  const party = s.parties.get(record);
  if (party === undefined) return refusedRead("PARTY_NOT_FOUND");
  const at = Date.now();
  const open = openReviews(s);
  const duplicate = open.find((review) => review.kind === "DUPLICATE_CANDIDACY" && review.records.includes(record)) ?? null;
  const other = duplicate !== null ? s.parties.get(duplicate.records.find((entry) => entry !== record) ?? "") : undefined;
  return ok({
    asOf: now(),
    record: party.record,
    legalName: party.legalName,
    kind: party.kind,
    businessRegistration: party.businessRegistration,
    state: party.state,
    origin: party.origin,
    principal: party.principal,
    identification: party.identification,
    duplicate: duplicate !== null && other !== undefined ? { review: duplicate.id, other: { record: other.record, legalName: other.legalName, origin: other.origin } } : null,
    identificationReview: open.find((review) => review.kind === "IDENTIFICATION" && review.records.includes(record))?.id ?? null,
    supersededBy: supersededOf(s, party),
    premises: premisesRows(staff.sessionId, s, party),
    authorities: authoritiesOf(s, record).map((authority) => authorityRow(s, authority, at)),
    persons: [...s.persons.values()].map((person) => ({ reference: person.reference, name: person.name, hasAccount: person.hasAccount, createdBy: person.createdBy, createdAt: person.createdAt })),
    mayAct: holds(staff, "ACT-OPS"),
    officer: staff.account,
    today: today(),
  });
}

/** POST /party-persons: a person of the register, on the party's record; no account is needed (FR-PTY-019). */
export function addPartyPerson(staff: Staff, record: string, input: PersonInput): PartyAnswer<{ person: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  if (!s.parties.has(record)) return refuse("PARTY_NOT_FOUND");
  if (input.displayName.trim() === "") return refuse("FIELD_MISSING", "display_name");
  const account = input.account.trim();
  const linked = account === "" ? undefined : [...s.persons.values()].find((person) => person.account !== null && person.account.toLowerCase() === account.toLowerCase());
  if (linked !== undefined) return refuse("ACCOUNT_ALREADY_LINKED", "account_ref", { account, name: linked.name, person: linked.reference });
  const person = newPerson(s, input.displayName.trim(), account === "" ? null : account, staff.account, record);
  recordChange(s, { subject: { kind: "PARTY_PERSON", reference: person }, change: "PERSON_CREATED", values: { name: input.displayName.trim(), party: record }, actor: byOfficer(staff), reliedOn: underRow("CREATE_PERSON") });
  return accept({ person });
}

/** A person reference: PPN-PTY- and four digits, issued by this register and never by an account. */
function newPerson(s: State, name: string, account: string | null, by: string, party: string): string {
  const highest = Math.max(...[...s.persons.keys()].map((ref) => Number(ref.slice(8))));
  const ref = `PPN-PTY-${String(highest + 1)}`;
  s.persons.set(ref, { reference: ref, name, account, hasAccount: account !== null, createdBy: by, createdAt: now(), supersededBy: null });
  s.personParties.set(ref, new Set([party]));
  return ref;
}

/**
 * The principal recorded on the console: an authority for the whole party that includes granting, amending and
 * revoking. Only an identified party has one; an officer may not record a person they created, or themselves
 * (SELF_RECORDING_REFUSED, as the board draws it), and with no delegation standard every principal has an end date.
 */
export function recordPrincipal(staff: Staff, record: string, input: PrincipalInput): PartyAnswer<{ authority: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  const party = s.parties.get(record);
  if (party === undefined) return refuse("PARTY_NOT_FOUND");
  if (party.state !== "IDENTIFIED") return refuse("PARTY_NOT_IDENTIFIED");
  if (input.person.trim() === "") return refuse("FIELD_MISSING", "party_person_id");
  const person = s.persons.get(input.person.trim());
  if (person === undefined) return refuse("PARTY_PERSON_NOT_FOUND", "party_person_id");
  if (person.createdBy === staff.account || (person.account !== null && person.account === staff.email)) return refuse("SELF_RECORDING_REFUSED", null, { name: person.name });
  if (input.basis.trim() === "") return refuse("FIELD_MISSING", "basis");
  if (input.evidence.trim() === "") return refuse("EVIDENCE_REQUIRED", "evidence_ref");
  const acts = input.acts.filter((act): act is Act => (ACTS as readonly string[]).includes(act));
  if (acts.length === 0) return refuse("FIELD_MISSING", "scope_keys");
  const period = readPeriod(input);
  if ("refusal" in period) return period.refusal;
  // The officer is no party person, so no approver of theirs can be the person recorded.
  const approved = approvalFor(s, period.to, input, person.reference);
  if ("refusal" in approved) return approved.refusal;
  const ref = authorityReference(s);
  s.authorities.set(ref, {
    reference: ref,
    party: record,
    person: person.reference,
    premises: null,
    basis: input.basis.trim(),
    basisText: true,
    evidence: input.evidence.trim(),
    file: null,
    granted: null,
    recorded: { by: staff.account, at: now() },
    versions: [{ from: period.from, acts }],
    to: period.to,
    revocation: null,
    groundText: false,
    performed: [],
    approval: approved.approval,
  });
  s.order.unshift(ref);
  s.personParties.set(person.reference, new Set([...(s.personParties.get(person.reference) ?? []), record]));
  // The party's principal line names the person from now on, where no principal was named before (FR-PTY-050).
  party.principal ??= { name: person.name, fromRegister: false, person: person.reference };
  recordChange(s, {
    subject: { kind: "AUTHORITY", reference: ref },
    change: "PRINCIPAL_RECORDED",
    values: { party: record, person: person.reference },
    actor: byOfficer(staff),
    reliedOn: underRow("RECORD_PRINCIPAL"),
  });
  return accept({ authority: ref });
}

/**
 * The period of a new authority: a start, and an end not before it. A start of today takes effect now; one in the past
 * takes effect now too, since a grant is prospective (FR-PTY-006). No end at all is DR-202's question (`approvalFor`).
 */
function readPeriod(input: { from: string | null; fromText: string; to: string | null; toText: string }): { from: string; to: string | null } | { refusal: PartyAnswer<never> } {
  if (input.from === null) return { refusal: refuse(input.fromText === "" ? "FIELD_MISSING" : "PERIOD_INVALID", "effective_period", { from: input.fromText, to: input.toText }) };
  if (input.toText !== "" && input.to === null) return { refusal: refuse("PERIOD_INVALID", "effective_period", { from: input.fromText, to: input.toText }) };
  if (input.to !== null && input.to < input.from) return { refusal: refuse("PERIOD_INVALID", "effective_period", { from: input.fromText, to: input.toText }) };
  const from = input.from <= today() ? now() : `${input.from}T00:00:00${VN}`;
  return { from, to: input.to };
}

const levelRank = (level: string): number => (APPROVAL_LEVELS as readonly string[]).indexOf(level);

/**
 * DR-202, in its evaluation order: rows 6, 1, 5, 4, then 3 and 2. With no delegation standard (CFG-240 has no value,
 * its safe default) an authority with no end date is refused whatever approval it carries, and no level is assumed;
 * an end date needs no approval; otherwise the approval must be given, at the level the standard fixes or above, by
 * someone other than the person the authority is for. A refused authority is never held as pending (FR-PTY-026).
 */
function approvalFor(
  s: State,
  to: string | null,
  input: { approvalAuthority?: string; approvalLevel?: string },
  grantee: string,
): { approval: Authority["approval"] } | { refusal: PartyAnswer<never> } {
  if (to !== null) return { approval: null };
  const standard = s.delegationStandard;
  if (standard === null) return { refusal: refuse("NO_DELEGATION_STANDARD", null, { config: "CFG-240" }) };
  const approver = input.approvalAuthority?.trim() ?? "";
  const level = input.approvalLevel?.trim() ?? "";
  if (approver === "" || levelRank(level) < 0) return { refusal: refuse("OPEN_ENDED_APPROVAL_REQUIRED", "approval_authority_ref", { level: standard.level }) };
  if (levelRank(level) >= levelRank(standard.level) && approver === grantee) return { refusal: refuse("SELF_APPROVAL_REFUSED", "approval_authority_ref") };
  if (levelRank(level) < levelRank(standard.level)) return { refusal: refuse("APPROVAL_LEVEL_INSUFFICIENT", "approval_level", { level: standard.level, given: level }) };
  return { approval: { by: approver, level: level as ApprovalLevel } };
}

/** AUT- and eight characters from the reference alphabet. */
const authorityReference = (s: State): string => {
  for (;;) {
    const ref = reference("AUT").slice(0, 12);
    if (!s.authorities.has(ref)) return ref;
  }
};

// ---------------------------------------------------------------- SCR-PTY-03

/** The identification form: the party, how the source stands now, its last search, and whether the reader may run it. */
export function identificationForm(staff: Staff, record: string): LoadOutcome<IdentificationForm> {
  if (!holds(staff, "ACT-OPS")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  const party = s.parties.get(record);
  if (party === undefined) return refusedRead("PARTY_NOT_FOUND");
  const search = s.searches.get(record) ?? null;
  const review = openReviews(s).find((entry) => entry.kind === "IDENTIFICATION" && entry.records.includes(record)) ?? null;
  return ok({
    record: party.record,
    legalName: party.legalName,
    kind: party.kind,
    businessRegistration: party.businessRegistration,
    state: party.state,
    source: { condition: s.source, probedAt: now() },
    lastSearch: search !== null ? { identifierKind: search.identifierKind, identifier: search.identifier, matched: search.matched, at: search.at } : null,
    selfRefused: namedByParty(s, record, staff),
    officer: staff.account,
    declared: review !== null && review.declaration !== null ? { identification: review.declaration, review: review.id, openedAt: review.openedAt } : null,
  });
}

/**
 * POST /parties/{id}/identifications on the sourced route, by DR-200: with no source configured the route is refused
 * naming CFG-241 (row 9); the identifier is checked before anything leaves the service (row 5); the search is then
 * recorded with its answer. A match identifies a party still in DRAFT from the source, with the source and the time it
 * answered (row 1, IDENTIFIED_FROM_SOURCE); no match is what sends a manual declaration to review (row 2).
 */
export function searchSource(staff: Staff, record: string, identifierKind: string): PartyAnswer<{ matched: boolean }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  const party = s.parties.get(record);
  if (party === undefined) return refuse("PARTY_NOT_FOUND");
  if (namedByParty(s, record, staff)) return refuse("SELF_IDENTIFICATION_REFUSED");
  if (s.source === "NOT_CONFIGURED") return refuse("SOURCE_NOT_CONFIGURED", null, { config: "CFG-241" });
  if (identifierKind !== "BUSINESS_REGISTRATION_NUMBER") return refuse("IDENTIFIER_NOT_PERMITTED", "identifier_kind");
  if (party.businessRegistration === null) return refuse("FIELD_MISSING", "identifier_kind");
  const at = now();
  const found = s.sourceRecords.find((entry) => entry.identifier === party.businessRegistration) ?? null;
  s.searches.set(record, { party: record, identifierKind: "BUSINESS_REGISTRATION_NUMBER", identifier: party.businessRegistration, matched: found !== null, at });
  if (found !== null && party.state === "DRAFT") {
    party.state = "IDENTIFIED";
    party.origin = { kind: "SOURCE", on: dayOf(at) };
    party.identification = {
      route: "SOURCED",
      at,
      identifierKind: "BUSINESS_REGISTRATION_NUMBER",
      declaration: null,
      decided: null,
      reasonCode: "IDENTIFIED_FROM_SOURCE",
      source: { name: "NATIONAL_REGISTER", legalName: found.legalName },
    };
    recordChange(s, { subject: { kind: "PARTY", reference: record }, change: "IDENTIFIED", values: { route: "SOURCED", reason: "IDENTIFIED_FROM_SOURCE" }, actor: byOfficer(staff), reliedOn: underRow("RUN_IDENTIFICATION") });
  }
  return accept({ matched: found !== null });
}

/**
 * POST /parties/{id}/identifications on the manual route, by DR-200: the three manual fields first (row 7), then the
 * evidence kind against CFG-246 (row 8); then the route decides. A source that answered with no match sends the
 * declaration to review and the party is REFERRED (row 2); otherwise it stands at once with the condition recorded
 * (rows 3, 4 and 6). A party already past DRAFT answers with where it stands, as a repeated request would.
 */
export function declareIdentification(staff: Staff, record: string, input: DeclarationInput): PartyAnswer<{ state: PartyState; review: string | null }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  const party = s.parties.get(record);
  if (party === undefined) return refuse("PARTY_NOT_FOUND");
  if (namedByParty(s, record, staff)) return refuse("SELF_IDENTIFICATION_REFUSED");
  if (party.state !== "DRAFT") {
    const open = openReviews(s).find((review) => review.kind === "IDENTIFICATION" && review.records.includes(record));
    return accept({ state: party.state, review: open?.id ?? null });
  }
  if (input.evidenceKind.trim() === "") return refuse("MANUAL_FIELDS_INCOMPLETE", "evidence_kind");
  if (input.evidenceRef.trim() === "") return refuse("MANUAL_FIELDS_INCOMPLETE", "evidence_ref");
  if (input.reason.trim() === "") return refuse("MANUAL_FIELDS_INCOMPLETE", "reason");
  if (!(EVIDENCE_KINDS as readonly string[]).includes(input.evidenceKind)) return refuse("EVIDENCE_KIND_NOT_PERMITTED", "evidence_kind");
  const at = now();
  const search = s.searches.get(record) ?? null;
  const noMatch = s.source === "REACHABLE" && search !== null && !search.matched;
  // DR-200 rows 2, 3, 4 and 6: the same manual route, told apart by what the source was doing (FR-PTY-023).
  const reasonCode = noMatch ? "NO_MATCH_DECLARED" : s.source === "REACHABLE" ? "MANUAL_ROUTE_CHOSEN" : s.source === "UNREACHABLE" ? "MANUAL_ROUTE_FORCED" : "NO_SOURCE_CONFIGURED";
  const declaration: IdentificationView = {
    route: "MANUAL",
    at,
    identifierKind: null,
    declaration: {
      evidenceKind: input.evidenceKind,
      evidenceRef: input.evidenceRef.trim(),
      reason: input.reason.trim(),
      by: staff.account,
      scan: input.scan !== null ? { name: input.scan.name, at, by: staff.account } : null,
      source: s.source,
      search: noMatch && search !== null ? { identifier: search.identifier, at: search.at } : null,
    },
    decided: null,
    reasonCode,
  };
  party.declarations.push(declaration);
  recordChange(s, { subject: { kind: "PARTY", reference: record }, change: "IDENTIFICATION_DECLARED", values: { route: "MANUAL", reason: reasonCode }, actor: byOfficer(staff), reliedOn: underRow("RUN_IDENTIFICATION") });
  if (!noMatch) {
    party.state = "IDENTIFIED";
    party.identification = declaration;
    party.origin = { kind: "MANUAL", on: at };
    return accept({ state: party.state, review: null });
  }
  const id = reference("IDR");
  s.reviews.set(id, { id, kind: "IDENTIFICATION", records: [record], openedAt: at, state: "OPEN", declaration, decision: null });
  party.state = "REFERRED";
  return accept({ state: party.state, review: id });
}

// ---------------------------------------------------------------- SCR-PTY-04

/** GET /identification-reviews: the open ones, oldest first, by kind and by age in whole days. */
export function reviewQueue(staff: Staff, asked: { kind: string | null; age: string | null }): LoadOutcome<ReviewQueue> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  const kind = (REVIEW_KINDS as readonly string[]).includes(asked.kind ?? "") ? (asked.kind as ReviewKind) : null;
  const age = asked.age === "7" || asked.age === "14" ? Number(asked.age) : null;
  const instant = now();
  const open = openReviews(s);
  const rows = open
    .map((review) => ({
      id: review.id,
      kind: review.kind,
      names: review.records.map((record) => nameOfParty(s, record)),
      records: review.records,
      openedAt: review.openedAt,
      age: daysBetween(review.openedAt, instant),
    }))
    .filter((row) => (kind === null || row.kind === kind) && (age === null || row.age >= age))
    .sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt));
  return ok({ asOf: instant, filter: { kind, age }, rows, open: open.length });
}

// ---------------------------------------------------------------- SCR-PTY-05

/** What a linkage superseding this record would have to dispose of: every kind of reference that points at it. */
function referencesOf(s: State, party: Party): ReferenceClassView[] {
  const relationships = s.relationships.filter((entry) => entry.party === party.record);
  const ended = relationships.length > 0 && relationships.every((entry) => entry.to !== null) ? (relationships[0]?.to ?? null) : null;
  const authorities = authoritiesOf(s, party.record);
  const classes: ReferenceClassView[] = [
    { key: "PREMISES_RELATIONSHIPS", count: relationships.length, names: relationships.map((entry) => entry.premises.name), endedOn: ended, since: null },
    { key: "AUTHORITIES", count: authorities.length, names: [...new Set(authorities.map((authority) => personName(s, authority.person)))], endedOn: null, since: null },
    { key: "LICENCE_HISTORY", count: party.licenceHistory, names: [], endedOn: null, since: null },
    { key: "VERIFICATION_READS", count: party.verificationReads, names: [], endedOn: null, since: null },
    { key: "CHANGE_RECORDS", count: party.changeRecords?.count ?? 0, names: [], endedOn: null, since: party.changeRecords?.since ?? null },
  ];
  return classes.filter((entry) => entry.count > 0);
}

function candidate(s: State, party: Party): CandidateRecord {
  const relationships = s.relationships.filter((entry) => entry.party === party.record);
  const current = currentPremises(s, party.record).length;
  const allEnded = relationships.length > 0 && current === 0 && relationships.every((entry) => entry.to !== null);
  return {
    record: party.record,
    legalName: party.legalName,
    businessRegistration: party.businessRegistration,
    kind: party.kind,
    state: party.state,
    origin: party.origin,
    principal: party.principal?.name ?? null,
    premises: { current, ended: allEnded ? { names: relationships.map((entry) => entry.premises.name), on: relationships[0]?.to ?? "" } : null },
    authorities: authoritiesOf(s, party.record).length,
    references: referencesOf(s, party),
  };
}

/** GET /identification-reviews/{id}: both records with what a linkage would dispose of, or the declaration. */
export function reviewDetail(staff: Staff, id: string): LoadOutcome<ReviewDetail> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  const review = s.reviews.get(id);
  if (review === undefined) return refusedRead("REVIEW_NOT_FOUND");
  const parties = review.records.map((record) => s.parties.get(record)).filter((entry): entry is Party => entry !== undefined);
  const [a, b] = parties;
  const subject = parties[0];
  return ok({
    id: review.id,
    kind: review.kind,
    state: review.state,
    openedAt: review.openedAt,
    age: daysBetween(review.openedAt, now()),
    candidates: review.kind === "DUPLICATE_CANDIDACY" && a !== undefined && b !== undefined ? [candidate(s, a), candidate(s, b)] : null,
    identification:
      review.kind === "IDENTIFICATION" && subject !== undefined && review.declaration !== null
        ? { record: subject.record, legalName: subject.legalName, businessRegistration: subject.businessRegistration, view: review.declaration }
        : null,
    decision: review.decision,
    mayAct: holds(staff, "ACT-OPS"),
  });
}

/**
 * POST /identification-reviews/{id}/decision, by DR-203: a closed review first (REVIEW_NOT_OPEN, naming who decided
 * it), then a decision the review's kind admits (DECISION_REQUIRED), then on a linkage every kind of reference to the
 * superseded record disposed of (DISPOSITION_MISSING, naming the kind). The session always names the decider. Neither
 * record is deleted: a linkage supersedes one, and what pointed at it moves to the survivor where the officer says so.
 */
export function decideReview(staff: Staff, id: string, input: DecisionInput): PartyAnswer<{ outcome: ReviewState }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  const review = s.reviews.get(id);
  if (review === undefined) return refuse("REVIEW_NOT_FOUND");
  if (review.state !== "OPEN" && review.decision !== null) return refuse("REVIEW_NOT_OPEN", null, { name: review.decision.by, at: review.decision.at });
  const allowed: readonly string[] = review.kind === "DUPLICATE_CANDIDACY" ? ["LINKED", "NOT_LINKED"] : ["STANDS", "RETURNED"];
  if (!allowed.includes(input.outcome)) return refuse("DECISION_REQUIRED");
  const outcome = input.outcome as Exclude<ReviewState, "OPEN">;
  const at = now();
  const decided = { outcome, by: staff.account, at, survivor: null, superseded: null, dispositions: [] };

  if (review.kind === "IDENTIFICATION") {
    const party = s.parties.get(review.records[0] ?? "");
    if (party === undefined || review.declaration === null) return refuse("REVIEW_NOT_FOUND");
    if (outcome === "STANDS") {
      party.state = "IDENTIFIED";
      party.identification = { ...review.declaration, decided: { by: staff.account, at } };
      party.origin = { kind: "MANUAL", on: review.declaration.at ?? at };
    } else {
      party.state = "DRAFT";
    }
    review.declaration = { ...review.declaration, decided: { by: staff.account, at } };
    review.state = outcome;
    review.decision = decided;
    recordChange(s, { subject: { kind: "PARTY", reference: party.record }, change: "REVIEW_DECIDED", values: { review: id, outcome }, actor: byOfficer(staff), reliedOn: underRow("DECIDE_REVIEW") });
    return accept({ outcome });
  }

  if (outcome === "NOT_LINKED") {
    review.state = outcome;
    review.decision = decided;
    for (const subject of review.records) recordChange(s, { subject: { kind: "PARTY", reference: subject }, change: "REVIEW_DECIDED", values: { review: id, outcome }, actor: byOfficer(staff), reliedOn: underRow("DECIDE_REVIEW") });
    return accept({ outcome });
  }
  const survivor = s.parties.get(input.survivor);
  if (survivor === undefined || !review.records.includes(survivor.record)) return refuse("DECISION_REQUIRED");
  const superseded = s.parties.get(review.records.find((record) => record !== survivor.record) ?? "");
  if (superseded === undefined) return refuse("REVIEW_NOT_FOUND");
  const classes = referencesOf(s, superseded);
  const missing = classes.find((entry) => input.dispositions[entry.key] !== "MOVE" && input.dispositions[entry.key] !== "STAY");
  if (missing !== undefined) return refuse("DISPOSITION_MISSING", missing.key);
  const dispositions = classes.map((entry) => ({ key: entry.key, count: entry.count, to: input.dispositions[entry.key] === "MOVE" ? ("MOVE" as const) : ("STAY" as const) }));
  for (const disposition of dispositions) if (disposition.to === "MOVE") moveReferences(s, disposition.key, superseded, survivor);
  superseded.state = "SUPERSEDED";
  superseded.supersededBy = { record: survivor.record, on: dayOf(at), by: staff.account };
  // The organisation the other families know is the same one; it is now the surviving record's.
  if (survivor.organisation === null) survivor.organisation = superseded.organisation;
  review.state = outcome;
  review.decision = { ...decided, survivor: survivor.record, superseded: superseded.record, dispositions };
  recordChange(s, {
    subject: { kind: "PARTY", reference: superseded.record },
    change: "RECORDS_LINKED",
    values: { review: id, survivor: survivor.record },
    actor: byOfficer(staff),
    reliedOn: underRow("DECIDE_REVIEW"),
  });
  return accept({ outcome });
}

function moveReferences(s: State, key: ReferenceClass, from: Party, to: Party): void {
  switch (key) {
    case "PREMISES_RELATIONSHIPS":
      for (const entry of s.relationships) if (entry.party === from.record) entry.party = to.record;
      return;
    case "AUTHORITIES":
      for (const authority of s.authorities.values()) if (authority.party === from.record) authority.party = to.record;
      return;
    case "LICENCE_HISTORY":
      to.licenceHistory += from.licenceHistory;
      from.licenceHistory = 0;
      return;
    case "VERIFICATION_READS":
      to.verificationReads += from.verificationReads;
      from.verificationReads = 0;
      return;
    case "CHANGE_RECORDS":
      to.changeRecords = { count: (to.changeRecords?.count ?? 0) + (from.changeRecords?.count ?? 0), since: to.changeRecords?.since ?? from.changeRecords?.since ?? dayOf(now()) };
      from.changeRecords = null;
      return;
  }
}

// ---------------------------------------------------------------- SCR-PTY-11 to 13

/** Who reads authorities: the principal for the party they act for, or the security admin or assurance, read only. */
type AuthorityReader = { kind: "principal"; sessionId: string; organisation: string; account: string } | { kind: "staff"; staff: Staff };

const asReader = (principal: Principal): AuthorityReader => ({ kind: "principal", sessionId: principal.sessionId, organisation: principal.organisation, account: principal.account });

const keyOf = (reader: AuthorityReader) => (reader.kind === "principal" ? reader.sessionId : reader.staff.sessionId);

/**
 * The party a premises-portal reader acts for as its principal (ACT-PRE-PRI): the organisation's party, where the person
 * signed in is its principal. The authorities are the principal's to read and change (GET and POST /authorities), so a
 * delegate is FORBIDDEN; a person the register holds no authority of for the party is NOT_YOUR_PARTY (FR-PTY-007).
 */
function principalParty(s: State, sessionId: string, organisation: string): Party | { code: "NOT_YOUR_PARTY" | "FORBIDDEN" } {
  const party = partyOfOrganisation(s, organisation);
  if (party === null) return { code: "NOT_YOUR_PARTY" };
  const acting = actingIn(s, sessionId, Date.now());
  if (acting === null || acting.party !== party.record) return { code: "NOT_YOUR_PARTY" };
  if (acting.actor !== "PRINCIPAL") return { code: "FORBIDDEN" };
  return party;
}

/** GET /authorities for one party: the principal reads their own party's, and is refused any other's (FR-PTY-007). */
export function partyAuthorities(reader: AuthorityReader, asked: string | null): LoadOutcome<AuthorityList> {
  const s = state(keyOf(reader));
  let party: Party | null;
  if (reader.kind === "principal") {
    const own = principalParty(s, reader.sessionId, reader.organisation);
    if ("code" in own) return refusedRead(own.code);
    party = own;
    if (asked !== null && asked !== party.record) return refusedRead(s.parties.has(asked) ? "NOT_YOUR_PARTY" : "PARTY_NOT_FOUND");
  } else {
    if (!holds(reader.staff, "ACT-SEC", "ACT-AUD")) return refusedRead("FORBIDDEN");
    party = s.parties.get(asked ?? "") ?? null;
    if (party === null) return refusedRead("PARTY_NOT_FOUND");
  }
  const at = Date.now();
  return ok({
    asOf: now(),
    party: { record: party.record, legalName: party.legalName, principal: party.principal?.name ?? null },
    authorities: authoritiesOf(s, party.record).map((authority) => authorityRow(s, authority, at)),
  });
}

/** The parties the security console may pick from: those with an authority recorded. */
export function partiesWithAuthorities(staff: Staff): LoadOutcome<readonly { record: string; legalName: string }[]> {
  if (!holds(staff, "ACT-SEC", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  const records = new Set([...s.authorities.values()].map((authority) => authority.party));
  return ok([...records].map((record) => ({ record, legalName: nameOfParty(s, record) })).sort((a, b) => collator.compare(a.legalName, b.legalName)));
}

function findAuthority(s: State, reader: AuthorityReader, ref: string): Authority | { code: string } {
  const authority = s.authorities.get(ref);
  if (authority === undefined) return { code: "AUTHORITY_NOT_FOUND" };
  if (reader.kind === "principal") {
    const party = principalParty(s, reader.sessionId, reader.organisation);
    if ("code" in party) return party;
    if (authority.party !== party.record) return { code: "NOT_YOUR_PARTY" };
  } else if (!holds(reader.staff, "ACT-SEC", "ACT-AUD")) {
    return { code: "FORBIDDEN" };
  }
  return authority;
}

function versionsOf(s: State, authority: Authority, at: number): VersionView[] {
  const state = authorityState(s, authority, at);
  const current = versionAt(authority, at).index;
  const views = authority.versions.map((version, index): VersionView => {
    const next = authority.versions[index + 1];
    const last = index === authority.versions.length - 1;
    const role: VersionView["role"] =
      state === "REVOKED" && last
        ? "LAST"
        : Date.parse(version.from) > at
          ? "NOT_STARTED"
          : !last && next !== undefined && Date.parse(next.from) <= at
            ? "SUPERSEDED"
            : state === "EXPIRED" || state === "LAPSED"
              ? "ENDED"
              : index === current
                ? "CURRENT"
                : "SUPERSEDED";
    return { number: index + 1, from: dayOf(version.from), to: next !== undefined ? dayOf(next.from) : authority.to, acts: version.acts, role };
  });
  return views.reverse();
}

/** A phrase the canvas names by its code, or the principal's own words. */
const words = (value: string, typed: boolean): Words => (typed ? { text: value } : { code: value });

function detailOf(s: State, authority: Authority, reader: AuthorityReader): AuthorityDetail {
  const at = Date.now();
  const row = authorityRow(s, authority, at);
  const name = reader.kind === "principal" ? reader.account : null;
  return {
    reference: authority.reference,
    party: { record: authority.party, legalName: nameOfParty(s, authority.party) },
    person: row.person,
    premises: row.premises,
    acts: row.acts,
    from: row.from,
    to: authority.to,
    state: row.state,
    basis: authority.basis !== null ? words(authority.basis, authority.basisText) : null,
    evidence: authority.evidence,
    granted: authority.granted,
    versions: versionsOf(s, authority, at),
    performed: authority.performed
      .map((act) => {
        const version = versionAt(authority, Date.parse(act.at));
        return { at: act.at, kind: act.kind, subject: act.subject, version: { number: version.index + 1, from: dayOf(version.from), acts: version.acts } };
      })
      .sort((x, y) => Date.parse(y.at) - Date.parse(x.at)),
    revocation:
      authority.revocation !== null
        ? { at: authority.revocation.at, by: authority.revocation.by, ground: words(authority.revocation.ground, authority.groundText), propagation: authority.revocation.propagation }
        : null,
    approval: authority.approval,
    grantedByReader: name !== null && authority.granted?.by === name,
    revokedByReader: name !== null && authority.revocation?.by === name,
    now: now(),
  };
}

/** GET /authorities/{id}: every version with the period it covered, the acts performed under it, and its revocation. */
export function authorityDetail(reader: AuthorityReader, ref: string): LoadOutcome<AuthorityDetail> {
  const s = state(keyOf(reader));
  const found = findAuthority(s, reader, ref);
  if ("code" in found) return refusedRead(found.code);
  return ok(detailOf(s, found, reader));
}

function premisesOptions(s: State, record: string): { record: string; name: string }[] {
  return currentPremises(s, record)
    .filter((entry): entry is SeedRelationship & { premises: { record: string; name: string } } => entry.premises.record !== null)
    .map((entry) => ({ record: entry.premises.record, name: entry.premises.name }));
}

/** The persons on the party's record a principal may grant to: not the principal, nor someone holding only revoked authorities. */
function grantablePersons(s: State, party: Party): { reference: string; name: string }[] {
  const at = Date.now();
  return [...s.persons.values()]
    .filter((person) => s.personParties.get(person.reference)?.has(party.record) === true && person.name !== party.principal?.name)
    .filter((person) => {
      const held = authoritiesOf(s, party.record).filter((authority) => authority.person === person.reference);
      return held.length === 0 || held.some((authority) => authorityState(s, authority, at) !== "REVOKED");
    })
    .map((person) => ({ reference: person.reference, name: person.name }));
}

/** SCR-PTY-12 to grant: the principal's party, its premises and persons, and what it has granted so far. */
export function grantForm(principal: Principal): LoadOutcome<GrantForm> {
  const s = state(principal.sessionId);
  const party = principalParty(s, principal.sessionId, principal.organisation);
  if ("code" in party) return refusedRead(party.code);
  const at = Date.now();
  return ok({
    party: { record: party.record, legalName: party.legalName },
    premises: premisesOptions(s, party.record),
    persons: grantablePersons(s, party),
    existing: authoritiesOf(s, party.record).map((authority) => authorityRow(s, authority, at)),
    delegationStandard: s.delegationStandard,
    approvers: [...s.persons.values()].filter((person) => s.personParties.get(person.reference)?.has(party.record) === true).map((person) => ({ reference: person.reference, name: person.name })),
    today: today(),
  });
}

/** SCR-PTY-12 to amend: the authority, and the party's other authorities beside the form. */
export function authorityAmendment(principal: Principal, ref: string): LoadOutcome<AmendForm> {
  const s = state(principal.sessionId);
  const reader = asReader(principal);
  const found = findAuthority(s, reader, ref);
  if ("code" in found) return refusedRead(found.code);
  const at = Date.now();
  return ok({
    authority: detailOf(s, found, reader),
    existing: authoritiesOf(s, found.party).map((authority) => authorityRow(s, authority, at)),
    delegationStandard: s.delegationStandard,
    today: today(),
  });
}

/**
 * POST /authorities by the principal, by DR-202: the person, the scope and what they may do, the basis and its
 * evidence, a period whose end is not before its start, and no end only with the approval CFG-240 fixes; with no
 * standard approved an open-ended grant is refused, never held. The holder must already be a person of the register:
 * one nobody has recorded is PARTY_PERSON_NOT_FOUND, and no person is created as a side effect (@AC-FR-PTY-001-03).
 */
export function grantAuthority(principal: Principal, input: GrantInput): PartyAnswer<{ authority: string }> {
  const s = state(principal.sessionId);
  const party = principalParty(s, principal.sessionId, principal.organisation);
  if ("code" in party) return refuse(party.code);
  const typed = input.person.trim();
  if (typed === "") return refuse("FIELD_MISSING", "party_person_id");
  const existing = s.persons.get(typed.toUpperCase()) ?? null;
  if (existing === null) return refuse("PARTY_PERSON_NOT_FOUND", "party_person_id", { person: typed });
  let premises: string | null = null;
  if (input.scope === "premises") {
    const asked = input.premises.trim().toUpperCase();
    if (asked === "") return refuse("FIELD_MISSING", "premises_id");
    const operated = premisesOptions(s, party.record).find((entry) => entry.record === asked);
    if (operated === undefined) return refuse("PREMISES_NOT_OF_PARTY", "premises_id", { premises: asked });
    premises = operated.name;
  } else if (input.scope !== "party") {
    return refuse("FIELD_MISSING", "scope");
  }
  const acts = input.acts.filter((act): act is Act => act === "READ" || act === "SUBMIT" || act === "APPROVE");
  if (acts.length === 0) return refuse("FIELD_MISSING", "scope_keys");
  if (input.basis.trim() === "") return refuse("FIELD_MISSING", "basis");
  if (input.evidence.trim() === "") return refuse("EVIDENCE_REQUIRED", "evidence_ref");
  const period = readPeriod(input);
  if ("refusal" in period) return period.refusal;
  const approved = approvalFor(s, period.to, input, existing.reference);
  if ("refusal" in approved) return approved.refusal;
  const person = existing.reference;
  const ref = authorityReference(s);
  s.authorities.set(ref, {
    reference: ref,
    party: party.record,
    person,
    premises,
    basis: input.basis.trim(),
    basisText: true,
    evidence: input.evidence.trim(),
    file: input.file !== null ? { name: input.file.name, sizeBytes: input.file.sizeBytes } : null,
    granted: { at: now(), by: principal.account },
    recorded: null,
    versions: [{ from: period.from, acts }],
    to: period.to,
    revocation: null,
    groundText: false,
    performed: [],
    approval: approved.approval,
  });
  s.order.unshift(ref);
  s.personParties.set(person, new Set([...(s.personParties.get(person) ?? []), party.record]));
  recordChange(s, { subject: { kind: "AUTHORITY", reference: ref }, change: "AUTHORITY_GRANTED", values: { person, party: party.record, premises: premises ?? "" }, ...byPrincipal(s, principal.sessionId) });
  return accept({ authority: ref });
}

/**
 * POST /authorities/{id}/versions: the acts and the period from a date. The earlier version closes where the new one
 * starts and stays readable with the period it covered. A version backdated over an act already performed under the
 * current scope is refused, naming the act; one that would start before the current version is VERSION_OVERLAPS. An
 * authority that no longer grants cannot be amended: a revoked one says so, and an ended one asks for a new grant.
 */
export function amendAuthority(principal: Principal, ref: string, input: AmendInput): PartyAnswer<{ version: number }> {
  const s = state(principal.sessionId);
  const found = findAuthority(s, asReader(principal), ref);
  if ("code" in found) return refuse(found.code);
  const at = Date.now();
  const current = authorityState(s, found, at);
  if (current === "REVOKED" && found.revocation !== null) return refuse("ALREADY_REVOKED", null, { at: found.revocation.at });
  if (current === "EXPIRED" || current === "LAPSED") return refuse("AUTHORITY_EXPIRED", null, { to: found.to ?? "" });
  const acts = input.acts.filter((act): act is Act => act === "READ" || act === "SUBMIT" || act === "APPROVE");
  if (acts.length === 0) return refuse("FIELD_MISSING", "scope_keys");
  if (input.from === null) return refuse(input.fromText === "" ? "FIELD_MISSING" : "PERIOD_INVALID", "effective_period", { from: input.fromText, to: input.toText });
  if ((input.toText !== "" && input.to === null) || (input.to !== null && input.to < input.from)) return refuse("PERIOD_INVALID", "effective_period", { from: input.fromText, to: input.toText });
  // An amendment carries no approval, so an open end is refused: for want of a standard, or of the approval it fixes.
  const approved = approvalFor(s, input.to, {}, found.person);
  if ("refusal" in approved) return approved.refusal;
  const day = today();
  const from = input.from === day ? now() : `${input.from}T00:00:00${VN}`;
  if (input.from < day) {
    const over = found.performed.find((act) => Date.parse(act.at) >= Date.parse(from) && Date.parse(act.at) <= at);
    if (over !== undefined) return refuse("AMENDMENT_BACKDATED_OVER_PERFORMED_ACT", "effective_period", { act: over.kind, subject: over.subject, at: over.at });
  }
  const last = found.versions[found.versions.length - 1];
  if (last !== undefined && Date.parse(from) <= Date.parse(last.from)) return refuse("VERSION_OVERLAPS", "effective_period", { from: dayOf(last.from) });
  found.versions.push({ from, acts });
  found.to = input.to;
  recordChange(s, { subject: { kind: "AUTHORITY", reference: found.reference }, change: "AUTHORITY_AMENDED", values: { version: String(found.versions.length), from }, ...byPrincipal(s, principal.sessionId) });
  return accept({ version: found.versions.length });
}

/**
 * POST /authorities/{id}/revocation: from now or from a date and time, with a ground. An authority revoked already is
 * ALREADY_REVOKED with the instant; one that ended on its own needs none. A revocation backdated over an act performed
 * under the authority is refused naming the act, which stays valid (FR-PTY-017); the screen offers revoking from now.
 */
export function revokeAuthority(principal: Principal, ref: string, input: RevocationInput): PartyAnswer<{ at: string }> {
  const s = state(principal.sessionId);
  const found = findAuthority(s, asReader(principal), ref);
  if ("code" in found) return refuse(found.code);
  if (found.revocation !== null) return refuse("ALREADY_REVOKED", null, { at: found.revocation.at });
  const instant = Date.now();
  const current = authorityState(s, found, instant);
  if (current === "EXPIRED" || current === "LAPSED") return refuse("AUTHORITY_EXPIRED", null, { to: found.to ?? "" });
  if (input.ground.trim() === "") return refuse("GROUND_REQUIRED", "ground");
  let at = now();
  if (input.effective === "at") {
    if (input.at === "" || Number.isNaN(Date.parse(input.at))) return refuse("FIELD_MISSING", "effective_at");
    at = input.at;
    if (Date.parse(at) < instant) {
      const over = found.performed.find((act) => Date.parse(act.at) >= Date.parse(at) && Date.parse(act.at) <= instant);
      if (over !== undefined) {
        return refuse("REVOCATION_BACKDATED_OVER_PERFORMED_ACT", "effective_at", { act: over.kind, subject: over.subject, at: over.at, person: personName(s, found.person) });
      }
    }
  }
  found.revocation = { at, by: principal.account, ground: input.ground.trim(), propagation: null };
  found.groundText = true;
  recordChange(s, { subject: { kind: "AUTHORITY", reference: found.reference }, change: "AUTHORITY_REVOKED", values: { effectiveAt: at }, ...byPrincipal(s, principal.sessionId) });
  propagateRevocations(s);
  return accept({ at });
}

// ---------------------------------------------------------------- ALG-185: the revocation propagation

/** The decision points a revocation has to reach (FR-PTY-028). */
const DECISION_POINTS = ["PORTAL_SESSIONS", "API_TOKENS", "PLAYER"] as const;

/**
 * POST /authorities/{id}/revocation/propagation, as the sweep runs it once a revocation's instant has come (ACT-SYS).
 * Every decision point of this world asks the register at each act (`authorityToActAt`) and keeps no decision of its
 * own, so each stops granting at the revocation's instant, inside CFG-245's sixty seconds; the propagation is recorded
 * with that instant, under the sweep and its rule. A point the seed draws as never having confirmed keeps its exception.
 */
function propagateRevocations(s: State): void {
  const instant = Date.now();
  for (const authority of s.authorities.values()) {
    const revocation = authority.revocation;
    if (revocation === null || revocation.propagation !== null || Date.parse(revocation.at) > instant) continue;
    authority.revocation = { ...revocation, propagation: DECISION_POINTS.map((point) => ({ point, stoppedAt: revocation.at, afterSeconds: 0, exception: null })) };
    recordChange(s, {
      subject: { kind: "AUTHORITY", reference: authority.reference },
      change: "REVOCATION_PROPAGATED",
      values: { points: String(DECISION_POINTS.length) },
      actor: { kind: "PROCESS", name: "REVOCATION_PROPAGATION" },
      reliedOn: { kind: "RULE", rule: "ALG-185" },
      at: revocation.at,
    });
  }
}

// ---------------------------------------------------------------- the party person (FR-PTY-019, 044)

function resolutionOf(s: State, ref: string): PersonResolution {
  const person = s.persons.get(ref);
  if (person === undefined) return { kind: "NEVER_EXISTED", person: ref };
  if (person.supersededBy !== null) return { kind: "SUPERSEDED", person: ref, survivor: person.supersededBy.person, effectiveAt: person.supersededBy.at };
  return { kind: "CURRENT", person: ref };
}

/** GET /party-persons/{id}: the person, the account linked, every authority they hold with its party, and the survivor. */
export function partyPerson(staff: Staff, ref: string): LoadOutcome<PartyPersonView> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  const person = s.persons.get(ref.trim().toUpperCase());
  if (person === undefined) {
    s.audit.push({ code: "PARTY_PERSON_NOT_FOUND", person: null, subject: ref, at: now() });
    return refusedRead("PARTY_PERSON_NOT_FOUND");
  }
  const at = Date.now();
  return ok({
    reference: person.reference,
    name: person.name,
    account: person.account,
    hasAccount: person.hasAccount,
    createdBy: person.createdBy,
    createdAt: person.createdAt,
    parties: [...(s.personParties.get(person.reference) ?? [])].map((record) => ({ record, legalName: nameOfParty(s, record) })),
    authorities: s.order
      .map((entry) => s.authorities.get(entry))
      .filter((authority): authority is Authority => authority !== undefined && authority.person === person.reference)
      .map((authority) => ({ ...authorityRow(s, authority, at), party: { record: authority.party, legalName: nameOfParty(s, authority.party) } })),
    resolution: resolutionOf(s, person.reference),
  });
}

/** GET /party-persons/{id}/resolution: never refused, since a reference no record ever carried is the third answer. */
export function personResolution(staff: Staff, ref: string): LoadOutcome<PersonResolution> {
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) return refusedRead("FORBIDDEN");
  return ok(resolutionOf(state(staff.sessionId), ref.trim().toUpperCase()));
}

/**
 * PATCH /party-persons/{id}: a display name, or an account linked later. The reference the register issued never
 * changes (IDENTIFIER_IMMUTABLE where the request names another), so every act recorded under it still resolves to the
 * person (@AC-FR-PTY-019-02, -07); an account another person of the register holds is ACCOUNT_ALREADY_LINKED.
 */
export function amendPartyPerson(staff: Staff, ref: string, input: PersonAmendInput): PartyAnswer<{ person: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  const person = s.persons.get(ref.trim().toUpperCase());
  if (person === undefined) return refuse("PARTY_PERSON_NOT_FOUND", "party_person_id", { person: ref });
  const asked = input.reference.trim().toUpperCase();
  if (asked !== "" && asked !== person.reference) return refuse("IDENTIFIER_IMMUTABLE", "party_person_id", { person: person.reference });
  const name = input.displayName.trim();
  const account = input.account.trim();
  if (name === "" && account === "") return refuse("FIELD_MISSING", "display_name");
  if (account !== "") {
    const linked = [...s.persons.values()].find((other) => other.reference !== person.reference && other.account !== null && other.account.toLowerCase() === account.toLowerCase());
    if (linked !== undefined) return refuse("ACCOUNT_ALREADY_LINKED", "account_ref", { account, name: linked.name, person: linked.reference });
  }
  const values: Record<string, string> = {};
  if (name !== "" && name !== person.name) {
    values.name = name;
    person.name = name;
    for (const party of s.parties.values()) if (party.principal?.person === person.reference) party.principal = { ...party.principal, name };
  }
  if (account !== "") {
    values.account = account;
    person.account = account;
    person.hasAccount = true;
  }
  recordChange(s, { subject: { kind: "PARTY_PERSON", reference: person.reference }, change: "PERSON_AMENDED", values, actor: byOfficer(staff), reliedOn: underRow("CREATE_PERSON") });
  return accept({ person: person.reference });
}

// ---------------------------------------------------------------- SCR-PTY-04: raising a duplicate candidacy

/**
 * POST /duplicate-candidates by an officer: two distinct records of one kind and a ground open a review in OPEN
 * (SM-193), and nothing is linked (FR-PTY-031). Refused in the contract's order: SAME_RECORD, RECORD_NOT_FOUND naming
 * the reference, CANDIDACY_ALREADY_OPEN naming the open review, GROUND_REQUIRED. The two references are kept lower
 * first whichever order they were given. The review decides parties (SCR-PTY-05), so a candidacy names party records.
 */
export function raiseCandidacy(staff: Staff, input: CandidacyInput): PartyAnswer<{ review: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("FORBIDDEN");
  const s = state(staff.sessionId);
  if (!(CANDIDACY_KINDS as readonly string[]).includes(input.subjectKind)) return refuse("FIELD_MISSING", "subject_kind");
  const left = input.left.trim().toUpperCase();
  const right = input.right.trim().toUpperCase();
  if (left === "") return refuse("FIELD_MISSING", "left_ref");
  if (right === "") return refuse("FIELD_MISSING", "right_ref");
  if (left === right) return refuse("SAME_RECORD", "right_ref", { record: left });
  if (!s.parties.has(left)) return refuse("RECORD_NOT_FOUND", "left_ref", { record: left });
  if (!s.parties.has(right)) return refuse("RECORD_NOT_FOUND", "right_ref", { record: right });
  const open = openReviews(s).find((review) => review.kind === "DUPLICATE_CANDIDACY" && review.records.includes(left) && review.records.includes(right));
  if (open !== undefined) return refuse("CANDIDACY_ALREADY_OPEN", null, { review: open.id });
  const ground = input.ground.trim();
  if (ground === "") return refuse("GROUND_REQUIRED", "ground");
  const id = reference("IDR");
  s.reviews.set(id, { id, kind: "DUPLICATE_CANDIDACY", records: [left, right].sort(), openedAt: now(), state: "OPEN", declaration: null, decision: null });
  recordChange(s, { subject: { kind: "PARTY", reference: left }, change: "CANDIDACY_RAISED", values: { review: id, other: right, ground }, actor: byOfficer(staff), reliedOn: underRow("RAISE_CANDIDACY") });
  return accept({ review: id });
}

// ---------------------------------------------------------------- GET /change-records

const isSubjectKind = (value: string | null): value is ChangeSubjectKind => value !== null && (CHANGE_SUBJECT_KINDS as readonly string[]).includes(value);

/**
 * GET /change-records for assurance and the data owner. A period is required: the whole history is never read on the
 * caller's behalf (PERIOD_REQUIRED, @AC-FR-PTY-018-04). Each row names its subject, what changed, the person or the
 * process, what it relied on and when, rows written under an authority since revoked among them (FR-PTY-018).
 */
export function changeRecords(staff: Staff, asked: { from: string | null; to: string | null; subjectKind: string | null; subject: string | null }): LoadOutcome<ChangeRecordList> {
  if (!holds(staff, "ACT-AUD", "ACT-DAT")) return refusedRead("FORBIDDEN");
  const s = state(staff.sessionId);
  if (asked.from === null || asked.to === null || asked.to < asked.from) {
    s.audit.push({ code: "PERIOD_REQUIRED", person: null, subject: "change-records", at: now() });
    return refusedRead("PERIOD_REQUIRED");
  }
  const kind = isSubjectKind(asked.subjectKind) ? asked.subjectKind : null;
  const subject = asked.subject !== null && asked.subject.trim() !== "" ? asked.subject.trim().toUpperCase() : null;
  const from = startOf(asked.from);
  const until = startOf(asked.to) + DAY_MS;
  const rows = s.changeRecords
    .filter((row) => Date.parse(row.at) >= from && Date.parse(row.at) < until)
    .filter((row) => (kind === null || row.subject.kind === kind) && (subject === null || row.subject.reference === subject))
    .map((row, order) => ({ row, order }))
    .sort((a, b) => Date.parse(b.row.at) - Date.parse(a.row.at) || b.order - a.order)
    .map(({ row }) => row);
  return ok({ asOf: now(), filter: { from: asked.from, to: asked.to, subjectKind: kind, subject }, rows });
}

// ---------------------------------------------------------------- who acts for a party (ACT-PRE-PRI, ACT-PRE-DEL)

/** The person of the register an account is linked to: none for an account the register does not know. */
function personOfAccount(s: State, email: string): Person | null {
  const address = email.trim().toLowerCase();
  return [...s.persons.values()].find((person) => person.supersededBy === null && person.account !== null && person.account.toLowerCase() === address) ?? null;
}

/** The principal the business register names for the party, where the register holds them as a person. */
const registerPrincipal = (party: Party): string | null => (party.principal?.fromRegister === true ? (party.principal.person ?? null) : null);

/** By its dates and its revocation alone: started, not ended and not revoked at the instant (ALG-180's first rows). */
function inForce(authority: Authority, at: number): boolean {
  const first = authority.versions[0];
  if (first === undefined || at < Date.parse(first.from)) return false;
  if (authority.to !== null && at >= startOf(authority.to) + DAY_MS) return false;
  return authority.revocation === null || Date.parse(authority.revocation.at) > at;
}

/** A recorded principal's authority: the whole party, granting and revoking included, in force at the instant. */
function principalAuthorityOf(s: State, person: string, party: string, at: number): Authority | null {
  return authoritiesOf(s, party).find((authority) => authority.person === person && authority.premises === null && inForce(authority, at) && versionAt(authority, at).acts.includes("MANAGE_AUTHORITIES")) ?? null;
}

/** Who a premises-portal session is to the register: the person, the party of the organisation chosen. */
export interface PremisesActor {
  /** ACT-PRE-PRI acts for the whole party and grants; ACT-PRE-DEL acts only where an authority of theirs grants. */
  actor: "PRINCIPAL" | "DELEGATE";
  person: string;
  name: string;
  party: string;
  organisation: string;
}

/** The session's person and party, whatever their authorities say now: what a decision is asked about. */
function sessionPerson(s: State, sessionId: string): { person: Person; party: Party; organisation: string } | null {
  const session = sessions().get(sessionId);
  if (session?.role !== "principal" || session.organisation === null) return null;
  const person = personOfAccount(s, session.email);
  const party = partyOfOrganisation(s, session.organisation);
  return person !== null && party !== null ? { person, party, organisation: session.organisation } : null;
}

function actingIn(s: State, sessionId: string, at: number): PremisesActor | null {
  const found = sessionPerson(s, sessionId);
  if (found === null) return null;
  const { person, party, organisation } = found;
  const base = { person: person.reference, name: person.name, party: party.record, organisation };
  if (registerPrincipal(party) === person.reference || principalAuthorityOf(s, person.reference, party.record, at) !== null) return { ...base, actor: "PRINCIPAL" };
  const held = authoritiesOf(s, party.record).some((authority) => authority.person === person.reference && inForce(authority, at));
  return held ? { ...base, actor: "DELEGATE" } : null;
}

/** What a principal's act relies on: the principal the business register names on no authority record, else theirs. */
function byPrincipal(s: State, sessionId: string): Pick<ChangeRecord, "actor" | "reliedOn"> {
  const at = Date.now();
  const acting = actingIn(s, sessionId, at);
  const relied = acting !== null ? principalAuthorityOf(s, acting.person, acting.party, at) : null;
  return {
    actor: { kind: "PERSON", name: acting?.name ?? sessions().get(sessionId)?.email ?? "", person: acting?.person ?? null },
    reliedOn: { kind: "AUTHORITY", authority: relied?.reference ?? null, version: relied !== null ? versionAt(relied, at).index + 1 : null },
  };
}

// ================================================================== what other families read (srs/07 §1, IPartyReader)

/*
 * Every family asks PTY whether a person may act, and never keeps an answer of its own. The reads answer at a business
 * instant: one later than the call is refused (INSTANT_IN_FUTURE, FR-PTY-046), never answered from the present. A
 * premises is named by its register record or by the id its family gives it (`PREMISES_IDS`). `premises.ts` adds the
 * premises reads (`premisesRelationshipAt`, `premisesProfileAt`).
 */

/**
 * Who a premises-portal session acts as: the principal of the organisation's party (the person the business register
 * names, or a person holding a party-wide authority that grants and revokes), a delegate holding an authority in force,
 * or nobody (null) - a session whose person the register does not hold, or holds no authority of in force.
 */
export function actingAs(sessionId: string): PremisesActor | null {
  return actingIn(state(sessionId), sessionId, Date.now());
}

/** A premises named by the id another family gives it, or by its register record. */
export const premisesRecordOf = (premisesId: string): string => PREMISES_IDS[premisesId] ?? premisesId.trim().toUpperCase();

/** Every id the families give a register record, and the record itself. */
const idsOf = (record: string): string[] => [...Object.entries(PREMISES_IDS).filter(([, value]) => value === record).map(([id]) => id), record];

/**
 * The canvas's scope keys (`ACTS`) name groups of the permissions a delegation may cover: reading, sending, approving a
 * payment. srs/07 §1 lets a scope name any permission of the calling operation, and a version that names one covers it;
 * a permission listed nowhere here is covered only by a scope that names it, so an act nobody listed is refused.
 */
const PERMISSION_SCOPE: Readonly<Record<string, Act>> = {
  // REG: start, declare, attach, claim, preview, attest, submit and withdraw send; the lists and reads read.
  "PERM-590": "SUBMIT",
  "PERM-591": "READ",
  "PERM-592": "READ",
  "PERM-593": "SUBMIT",
  "PERM-594": "SUBMIT",
  "PERM-595": "SUBMIT",
  "PERM-596": "READ",
  "PERM-597": "SUBMIT",
  "PERM-598": "SUBMIT",
  "PERM-599": "SUBMIT",
  "PERM-600": "SUBMIT",
  "PERM-605": "READ",
  "PERM-606": "READ",
  // VEN: enrolling, accepting the terms, ending, documents, playlists and schedules send; the rest read.
  "PERM-535": "SUBMIT",
  "PERM-536": "SUBMIT",
  "PERM-537": "READ",
  "PERM-538": "READ",
  "PERM-541": "SUBMIT",
  "PERM-543": "SUBMIT",
  "PERM-544": "READ",
  "PERM-545": "SUBMIT",
  "PERM-546": "SUBMIT",
  "PERM-547": "SUBMIT",
  "PERM-548": "READ",
  "PERM-549": "READ",
  "PERM-550": "SUBMIT",
  "PERM-551": "SUBMIT",
  "PERM-552": "SUBMIT",
  "PERM-553": "READ",
  "PERM-554": "READ",
  "PERM-555": "READ",
  "PERM-556": "READ",
  "PERM-561": "READ",
  "PERM-562": "READ",
  "PERM-563": "READ",
  // IAM: issuing a device pairing authorisation.
  "PERM-365": "SUBMIT",
  // FIN: authorising a payment approves it; an instruction and an invoice are read.
  "PERM-695": "APPROVE",
  "PERM-696": "READ",
  "PERM-697": "READ",
  // CER, TAR, VER.
  "PERM-770": "READ",
  "PERM-771": "READ",
  "PERM-775": "SUBMIT",
  "PERM-776": "READ",
  "PERM-656": "READ",
  "PERM-1102": "READ",
  "PERM-1121": "READ",
  "PERM-1124": "READ",
  "PERM-1129": "SUBMIT",
  // CAS: raising, withdrawing, appealing and asking for a reopening send; reading one's own case reads.
  "PERM-77": "SUBMIT",
  "PERM-79": "READ",
  "PERM-80": "SUBMIT",
  "PERM-87": "SUBMIT",
  "PERM-90": "SUBMIT",
};

/** The scope key a permission falls under; a scope key asked for directly is itself. */
const scopeKeyOf = (permission: string): Act | null =>
  (ACTS as readonly string[]).includes(permission) ? (permission as Act) : (PERMISSION_SCOPE[permission] ?? null);

/** DR-201's seven refusals. */
export type AuthorityRefusal = "NO_AUTHORITY" | "AUTHORITY_NOT_STARTED" | "AUTHORITY_EXPIRED" | "AUTHORITY_REVOKED" | "OUT_OF_SCOPE" | "RELATIONSHIP_ENDED" | "NO_RELATIONSHIP";

/**
 * IPartyReader.AuthorityToActAt's answer. A grant names the party, the authority and the version relied on (none for
 * the principal the business register names). A refusal carries DR-201's code and what the code names - the scope, the
 * dates, who revoked and when - and never the authority, its version or another person (@AC-FR-PTY-027-11); a family
 * acting for a premises refuses its own act without disclosing the reason (srs/07 §1).
 */
export type AuthorityAnswer =
  | {
      kind: "GRANT";
      reason: "AUTHORITY_EFFECTIVE" | "AUTHORITY_EFFECTIVE_AT_INSTANT";
      actor: "PRINCIPAL" | "DELEGATE";
      person: string;
      party: string;
      authority: string | null;
      version: number | null;
    }
  | { kind: "REFUSE"; reason: AuthorityRefusal; values: Readonly<Record<string, string>> }
  | { kind: "INSTANT_IN_FUTURE"; at: string; requestedAt: string };

const refusal = (reason: AuthorityRefusal, values: Readonly<Record<string, string>> = {}): AuthorityAnswer => ({ kind: "REFUSE", reason, values });

/** DR-201 rows 7 and 8: the party's relationship with the premises at the instant, ended or never effective. */
function relationshipRefusal(s: State, premises: string, party: string, at: number): AuthorityAnswer | null {
  const day = dayOf(new Date(at).toISOString());
  const held = s.relationships.filter((entry) => entry.premises.record === premises && entry.party === party);
  if (held.some((entry) => isCurrent(entry, day))) return null;
  const ended = held.map((entry) => entry.to).filter((to): to is string => to !== null && to < day).sort().at(-1);
  return ended !== undefined ? refusal("RELATIONSHIP_ENDED", { on: ended }) : refusal("NO_RELATIONSHIP");
}

/**
 * DR-201 by ALG-180, for a person, a party, a premises (null for an act on the party itself) and a permission, at an
 * instant: the authorities of that person for that party whose scope is that premises or the whole party, the one
 * scoped to the premises first. Each is asked in the rule's order - exists, started, not ended, not revoked at the
 * instant, the scope covers the act, the relationship was effective - and the first that grants is the answer; else
 * the first's refusal. A person whose authorities for the party are all scoped to other premises is OUT_OF_SCOPE,
 * naming the premises they are scoped to (@AC-FR-PTY-021-03, -027-03). The authority's stored state is never read: a
 * revocation after the instant still grants (row 9).
 */
function decide(s: State, person: string, party: string, premises: string | null, permission: string, at: number): AuthorityAnswer {
  const record = s.parties.get(party);
  const key = scopeKeyOf(permission);
  const grant = (actor: "PRINCIPAL" | "DELEGATE", authority: Authority | null, revokedLater: boolean): AuthorityAnswer => ({
    kind: "GRANT",
    reason: revokedLater ? "AUTHORITY_EFFECTIVE_AT_INSTANT" : "AUTHORITY_EFFECTIVE",
    actor,
    person,
    party,
    authority: authority?.reference ?? null,
    version: authority !== null ? versionAt(authority, at).index + 1 : null,
  });
  // The principal the business register names acts for the whole party; only the premises' relationship can refuse it.
  if (record !== undefined && registerPrincipal(record) === person) return (premises !== null ? relationshipRefusal(s, premises, party, at) : null) ?? grant("PRINCIPAL", null, false);
  const held = authoritiesOf(s, party).filter((authority) => authority.person === person);
  if (held.length === 0) return refusal("NO_AUTHORITY");
  const recordOf = (authority: Authority) => premisesOfAuthority(s, authority)?.record ?? null;
  const covering = held
    .filter((authority) => authority.premises === null || (premises !== null && recordOf(authority) === premises))
    .sort((a, b) => Number(a.premises === null) - Number(b.premises === null));
  if (covering.length === 0) {
    const scoped = [...new Set(held.filter((authority) => inForce(authority, at) && authority.premises !== null).map((authority) => authority.premises as string))];
    return scoped.length > 0 ? refusal("OUT_OF_SCOPE", { scope: scoped.join("; "), needed: key ?? permission }) : refusal("NO_AUTHORITY");
  }
  let first: AuthorityAnswer | null = null;
  for (const authority of covering) {
    const answer = evaluate(s, authority, premises, permission, key, at, grant);
    if (answer.kind === "GRANT") return answer;
    first ??= answer;
  }
  return first ?? refusal("NO_AUTHORITY");
}

function evaluate(
  s: State,
  authority: Authority,
  premises: string | null,
  permission: string,
  key: Act | null,
  at: number,
  grant: (actor: "PRINCIPAL" | "DELEGATE", authority: Authority | null, revokedLater: boolean) => AuthorityAnswer,
): AuthorityAnswer {
  const first = authority.versions[0];
  if (first === undefined || at < Date.parse(first.from)) return refusal("AUTHORITY_NOT_STARTED", { from: first?.from ?? "" });
  if (authority.to !== null && at >= startOf(authority.to) + DAY_MS) return refusal("AUTHORITY_EXPIRED", { to: authority.to });
  const revocation = authority.revocation;
  if (revocation !== null && Date.parse(revocation.at) <= at) {
    stopLatePoint(authority, permission);
    return refusal("AUTHORITY_REVOKED", { at: revocation.at, by: revocation.by });
  }
  const version = versionAt(authority, at);
  const acts = version.acts as readonly string[];
  if (!(key !== null && acts.includes(key)) && !acts.includes(permission)) {
    return refusal("OUT_OF_SCOPE", { scope: authority.premises ?? "", acts: version.acts.join(","), needed: key ?? permission });
  }
  if (premises !== null) {
    const ended = relationshipRefusal(s, premises, authority.party, at);
    if (ended !== null) return ended;
  }
  const principal = authority.premises === null && version.acts.includes("MANAGE_AUTHORITIES");
  return grant(principal ? "PRINCIPAL" : "DELEGATE", authority, revocation !== null);
}

/** The decision point an act is asked from: the Player's (pairing a device, the Player service) or the portal's sessions. */
function pointOf(permission: string): (typeof DECISION_POINTS)[number] {
  const number = Number(/^PERM-(\d+)$/.exec(permission)?.[1] ?? "0");
  return number === 365 || (number >= 535 && number <= 563) ? "PLAYER" : "PORTAL_SESSIONS";
}

/**
 * @AC-FR-PTY-028-02: a decision point the propagation did not reach fails closed when it returns. Its next request
 * under the revoked authority is refused here, and by then it has re-read the authority, so it is recorded as having
 * stopped at that instant - late, past CFG-245's interval, which the exception it raised already says. The exception
 * stays on the queue until someone resolves it; its condition no longer holds (SCR-PTY-15).
 */
function stopLatePoint(authority: Authority, permission: string): void {
  const revocation = authority.revocation;
  if (revocation === null || revocation.propagation === null) return;
  const point = pointOf(permission);
  const late = revocation.propagation.find((entry) => entry.point === point && entry.stoppedAt === null);
  if (late === undefined) return;
  const at = now();
  const afterSeconds = Math.round((Date.parse(at) - Date.parse(revocation.at)) / 1000);
  authority.revocation = { ...revocation, propagation: revocation.propagation.map((entry) => (entry === late ? { ...entry, stoppedAt: at, afterSeconds } : entry)) };
}

/** The party a person is asked about for a premises: the one of theirs operating it at the instant, else their first. */
function partyOfPerson(s: State, person: string, premises: string, at: number): string | null {
  const parties = [...new Set([...(s.personParties.get(person) ?? []), ...[...s.authorities.values()].filter((authority) => authority.person === person).map((authority) => authority.party)])];
  return parties.find((party) => relationshipRefusal(s, premises, party, at) === null) ?? parties[0] ?? null;
}

/**
 * IPartyReader.AuthorityToActAt(partyPersonId, premisesId, permissionId, at): DR-201 for the person a premises-portal
 * session signs in as (`key` a session id), or for a party person named in `options.person` (`key` then any session or
 * world id). The premises is a register record or a family's id; the permission a `PERM-` id or a scope key; the
 * instant defaults to now. An act a family performs for a premises is asked here first, and refused unless it grants.
 */
export function authorityToActAt(key: string, premisesId: string, permission: string, options: { person?: string; at?: string } = {}): AuthorityAnswer {
  const s = state(key);
  const requestedAt = now();
  const at = options.at ?? requestedAt;
  if (Date.parse(at) > Date.parse(requestedAt)) return { kind: "INSTANT_IN_FUTURE", at, requestedAt };
  const premises = premisesRecordOf(premisesId);
  const instant = Date.parse(at);
  if (options.person !== undefined) {
    const person = options.person.trim().toUpperCase();
    const party = partyOfPerson(s, person, premises, instant);
    return party === null ? refusal("NO_AUTHORITY") : decide(s, person, party, premises, permission, instant);
  }
  const found = sessionPerson(s, key);
  return found === null ? refusal("NO_AUTHORITY") : decide(s, found.person.reference, found.party.record, premises, permission, instant);
}

/** `authorityToActAt` as a guard: whether the session's person may perform the permission for the premises now. */
export function mayActFor(sessionId: string, premisesId: string, permission: string): boolean {
  return authorityToActAt(sessionId, premisesId, permission).kind === "GRANT";
}

/** A premises the signed-in person may act for, by its record, every id the families give it, its name and party. */
export interface ActablePremises {
  record: string;
  ids: readonly string[];
  name: string;
  party: string;
  organisation: string | null;
}

/**
 * The premises the person a session signs in as may act for with a permission now (READ unless another is named): every
 * premises their party operates, for its principal; for a delegate, those their authorities grant the permission for.
 * Empty for a session that is no premises actor. A family scopes its premises-portal lists by it.
 */
export function premisesActableBy(sessionId: string, permission = "READ"): ActablePremises[] {
  const s = state(sessionId);
  const found = sessionPerson(s, sessionId);
  if (found === null) return [];
  const at = Date.now();
  const day = today();
  return s.relationships
    .filter((entry): entry is SeedRelationship & { premises: { record: string; name: string } } => entry.party === found.party.record && entry.premises.record !== null && isCurrent(entry, day))
    .filter((entry) => decide(s, found.person.reference, found.party.record, entry.premises.record, permission, at).kind === "GRANT")
    .map((entry) => ({ record: entry.premises.record, ids: idsOf(entry.premises.record), name: entry.premises.name, party: found.party.record, organisation: found.party.organisation }));
}

/**
 * POST /authorities/{id}/acts, called in process by the family whose act it was once the act is done: DR-201 decides at
 * the instant of performance (a revocation between preparing and performing refuses it, FR-PTY-029), and a granted act
 * is recorded against the authority and the version relied on, with the acting person, so it stays attributable after
 * the authority ends (FR-PTY-018). A refusal writes nothing but the module audit log's row.
 */
export function recordActUnderAuthority(key: string, premisesId: string, permission: string, act: { kind: ActKind; subject: string }): AuthorityAnswer {
  const answer = authorityToActAt(key, premisesId, permission);
  const s = state(key);
  const found = sessionPerson(s, key);
  if (answer.kind !== "GRANT") {
    s.audit.push({ code: answer.kind === "REFUSE" ? answer.reason : "INSTANT_IN_FUTURE", person: found?.person.reference ?? null, subject: premisesRecordOf(premisesId), at: now() });
    return answer;
  }
  const at = now();
  const authority = answer.authority !== null ? s.authorities.get(answer.authority) : undefined;
  if (authority !== undefined) authority.performed = [...authority.performed, { at, kind: act.kind, subject: act.subject }];
  recordChange(s, {
    subject: authority !== undefined ? { kind: "AUTHORITY", reference: authority.reference } : { kind: "PARTY", reference: answer.party },
    change: "ACT_PERFORMED",
    values: { act: act.kind, subject: act.subject, premises: premisesRecordOf(premisesId) },
    actor: { kind: "PERSON", name: found?.person.name ?? "", person: answer.person },
    reliedOn: { kind: "AUTHORITY", authority: answer.authority, version: answer.version },
    at,
  });
  return answer;
}

/** IPartyReader.PersonExists: CURRENT, SUPERSEDED with the survivor and the instant, or NEVER_EXISTED (FR-PTY-044). */
export function personExists(key: string, person: string): PersonResolution {
  return resolutionOf(state(key), person.trim().toUpperCase());
}
