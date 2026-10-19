import type { LoadOutcome } from "@rightone/ui";
import type { Staff } from "@/lib/api/session";
import { shownTermsDigest } from "@/lib/api/venue-terms";
import {
  MOOD_VERSION_STATES,
  SCOPE_DETAILS,
  TERMINAL,
  type CaseAction,
  type CaseFile,
  type CaseHead,
  type Classification,
  type CommandAnswer,
  type DocumentStep,
  type EditorItem,
  type EndingStep,
  type EnforcementInput,
  type EnforcementKind,
  type EnforcementStep,
  type EnrolForm,
  type EntitlementStatus,
  type FallbackList,
  type FallbackOutcome,
  type FallbackRow,
  type Freshness,
  type HistoryRow,
  type ItemInput,
  type MoodLibrary,
  type MoodRow,
  type MoodVersionState,
  type MoodVersionSummary,
  type MoodVersionView,
  type PlaylistEditor,
  type PlaylistRow,
  type Paging,
  type PlaylistsStep,
  type PlaylistStatus,
  type PremisesRef,
  type Register,
  type RegisterFilter,
  type ReinstatementStep,
  type ResolvedPeriod,
  type ScheduleInput,
  type ScheduleRow,
  type ScheduleStep,
  type ScopeExitInput,
  type ScopeDetail,
  type ScopeExitStep,
  type ScopeFamily,
  type ServiceHead,
  type ServiceList,
  type ServiceRecord,
  type ServiceViewData,
  type TermsDocument,
  type TermsStep,
  type TrackOption,
  type TrackResult,
  type VerificationDocument,
  type WeekQuery,
} from "@/lib/api/venue";
import {
  ANALYTICS,
  DOCUMENTS,
  ENFORCEMENT_POLICY,
  ENTITLEMENTS,
  FALLBACK_MOOD_RULE,
  MOOD_VERSIONS,
  MOODS,
  PLAYLISTS,
  PREMISES,
  RULES,
  SCHEDULES,
  TERMS,
  TRACKS,
  VEN03_ORDER,
  WORDING_RULE,
  type SeedAction,
  type SeedEnding,
  type SeedItem,
  type SeedMood,
  type SeedMoodVersion,
  type SeedReinstatement,
} from "../venue";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { noticesTo, recordNoticeEvent } from "./notices";
import { actingAs, mayActFor, premisesActableBy, premisesRecordOf } from "./parties";
import { deviceSummary } from "./player";
import { operatesNow, premisesNameOf, premisesRelationshipAt } from "./premises";
import { printedCodeOf } from "./public";
import { premisesActedFor } from "./registration";
import { sessions, table, type StaffRole } from "./store";

/*
 * The service entitlement family's backend (VEN), as the API will behave: a premises' Player service with its state
 * and history (SM-10), its playlists and default, its schedules and what they resolve to (DR-15), its verification
 * documents; the operations console's acts on a service (enforcement DR-252, reinstatement DR-253, a scope exit
 * DR-254) and content operations' shared moods (SM-236, DR-256); one function per operation of
 * `srs/02-api-contracts.md`. A command checks what its decision rule checks, in the rule's order, and answers with the
 * codes of `design/04-refusal-codes.md`; a refused command records nothing. What a person does happens now
 * (`clock.ts`); the seed keeps the boards' moments.
 *
 * Reads the API takes from other families are played here as the boards draw them: PTY's answers about a premises
 * (its relationship and class, which a recorded scope exit changes, since the event that caused it happened in that
 * family), CAT's eligibility of a track over time, GOV's rule versions (`VEN-SCHEDULE-RESOLUTION`, `VEN-ENFORCEMENT`,
 * `VEN-FALLBACK-MOOD`, `VEN-ENTITLEMENT-WORDING`). PUB's effective terms are read by the seam from PUB's own backend
 * and handed to the terms step and the acceptance, since PUB's backend already reads this one. A notice the use case
 * raises (NTF-VEN-01 to 04) goes to COM through its exported `recordNoticeEvent`; COM answers with the notice it
 * issued, or none, and none is recorded as EXC-VEN-06 rather than retried (a fallback's is raised again by the next
 * sweep while its period has not ended).
 *
 * Nothing that decides a past period is overwritten (FR-VEN-015): a playlist keeps every revision, a default every
 * designation, a schedule its saved and withdrawn instants, a shared mood version its approval and withdrawal, and a
 * track its eligibility over time, so DR-15 resolves a past period from what was known then (ALG-230). The two jobs
 * that run without a person are played when the state is read: `Venue.ApplyDueTransitions` (with
 * `Venue.ApplySupersededSchedules`) on every read, `Venue.ReevaluateEligibility` (ALG-231) once per 15-minute run.
 */

// ---------------------------------------------------------------- the state

interface Action extends SeedAction {
  applied: boolean;
}

interface Ending extends SeedEnding {
  /** Who recorded a scope exit, from the gateway's staff. */
  operations: boolean;
}

interface Entitlement {
  code: string;
  premisesId: string;
  status: EntitlementStatus;
  enrolledAt: string;
  activatedAt: string | null;
  endedAt: string | null;
  classification: Classification | null;
  classConfirmedAt: string;
  terms: { version: string; acceptedAt: string; acceptedBy: string; actingFor: string; digest: string } | null;
  actions: Action[];
  reinstatements: SeedReinstatement[];
  endings: Ending[];
  history: HistoryRow[];
  /** The default now, `player.service_entitlements.default_playlist_id`; `designations` keeps when each took effect. */
  defaultPlaylist: string | null;
  /** `player.default_playlist_designations`, oldest first and only appended, which DR-15 reads a past default from. */
  designations: Designation[];
  document: string | null;
}

interface Designation {
  playlist: string;
  effectiveFrom: string;
  createdAt: string;
}

/** `player.playlist_revisions` with its items: a revision writes the whole list again and is never changed. */
interface Revision {
  no: number;
  createdAt: string;
  items: readonly SeedItem[];
}

interface Playlist {
  id: string;
  service: string;
  name: string;
  /** Oldest first; the last is the current revision. */
  revisions: Revision[];
  archivedAt: string | null;
}

interface Schedule {
  id: string;
  service: string;
  playlist: string;
  days: readonly number[];
  start: string;
  end: string;
  effectiveFrom: string;
  /** The first local date it no longer applies on, `[effective_from, effective_to)`; null while open-ended. */
  effectiveTo: string | null;
  createdAt: string;
  status: "ACTIVE" | "SUPERSEDED" | "WITHDRAWN";
  withdrawnAt: string | null;
  supersedes: string | null;
}

interface Document {
  reference: string;
  service: string;
  statusAtIssue: EntitlementStatus;
  issuedAt: string;
  format: "pdf" | "html";
  wordingVersion: string;
  supersededAt: string | null;
}

interface MoodVersion extends Omit<SeedMoodVersion, "tracks"> {
  /** When it was withdrawn, which bounds the periods an approved version governs (ALG-230 `moodUsable`). */
  withdrawnAt: string | null;
  tracks: { track: string; admittedAt: string; droppedAt: string | null }[];
}

/** `player.schedule_fallbacks`, append-only (SEC-252): a scheduled period whose playlist could not play. */
interface Fallback {
  service: string;
  schedule: string;
  playlist: string;
  date: string;
  start: string;
  end: string;
  cause: "PLAYLIST_NO_ELIGIBLE_TRACK";
  resolvedTo: FallbackOutcome;
  /** What played instead, by name: the default playlist or the fallback mood; null when nothing could. */
  instead: string | null;
  /** Written once, at the insert: a notice raised by a later run is found by its occurrence, not written back. */
  notice: string | null;
  detectedAt: string;
}

/** The module audit log: a reason the contract keeps out of a column (spine amendment A6), and EXC-VEN-05 and 06. */
interface AuditEntry {
  at: string;
  act: "PLAYLIST_ARCHIVED" | "SCHEDULE_WITHDRAWN" | "ENDING_REQUESTED" | "NOTICE_NOT_RAISED" | "SCOPE_EXIT_EVENT_REFUSED";
  subject: string;
  reason: string;
}

/** PTY's answer about a premises, as an enrolment or an activation reads it now. */
interface ScopeAnswer {
  relationshipEffective: boolean;
  classInScope: boolean | null;
}

interface State {
  /** Service codes in SCR-VEN-03's order; a new enrolment goes first. */
  order: string[];
  entitlements: Map<string, Entitlement>;
  playlists: Map<string, Playlist>;
  schedules: Map<string, Schedule>;
  documents: Map<string, Document>;
  scope: Map<string, ScopeAnswer>;
  /** Moods in the library's order; a new one goes first. */
  moods: SeedMood[];
  versions: Map<string, MoodVersion>;
  /** Newest first. */
  fallbacks: Fallback[];
  /** The start of the eligibility sweep's last run; null until the world's first read replays the runs before it. */
  sweptAt: string | null;
  audit: AuditEntry[];
}

/** The digest of version 3's text, the version this world holds (`TERMS`). */
function heldDigest(): string {
  const terms: TermsDocument = { version: TERMS.version, documentId: TERMS.documentId, effective: TERMS.effective, title: TERMS.title, sections: TERMS.sections };
  return shownTermsDigest(terms, "vi");
}

function seed(): State {
  const classOf = (premisesId: string) => PREMISES.find((premises) => premises.id === premisesId)?.classification ?? null;
  const ordered = [...VEN03_ORDER, ...ENTITLEMENTS.map((entitlement) => entitlement.code).filter((code) => !VEN03_ORDER.includes(code))];
  return {
    order: ordered,
    entitlements: new Map(
      ENTITLEMENTS.map((entitlement) => [
        entitlement.code,
        {
          code: entitlement.code,
          premisesId: entitlement.premisesId,
          status: entitlement.status,
          enrolledAt: entitlement.enrolledAt,
          activatedAt: entitlement.activatedAt,
          endedAt: entitlement.endedAt,
          classification: classOf(entitlement.premisesId),
          classConfirmedAt: entitlement.enrolledAt,
          terms: entitlement.terms === null ? null : { ...entitlement.terms, digest: entitlement.terms.digest ?? heldDigest() },
          actions: entitlement.actions.map((action) => ({ ...action, applied: true })),
          reinstatements: [...entitlement.reinstatements],
          endings: entitlement.endings.map((ending) => ({ ...ending, operations: ending.cause === "SCOPE_EXIT" })),
          history: [...entitlement.history],
          defaultPlaylist: entitlement.defaultPlaylist,
          // The boards give the default, not when it was set: before activation, which needs it (DR-251 row 4).
          designations: entitlement.defaultPlaylist === null ? [] : [{ playlist: entitlement.defaultPlaylist, effectiveFrom: entitlement.enrolledAt, createdAt: entitlement.enrolledAt }],
          document: entitlement.document,
        },
      ]),
    ),
    // The boards give each playlist's current revision only, saved by the time the service enrolled.
    playlists: new Map(
      PLAYLISTS.map((playlist) => [
        playlist.id,
        {
          id: playlist.id,
          service: playlist.service,
          name: playlist.name,
          revisions: [{ no: playlist.revision, createdAt: enrolledAtOf(playlist.service), items: [...playlist.items] }],
          archivedAt: playlist.archivedAt,
        },
      ]),
    ),
    schedules: new Map(SCHEDULES.map((schedule) => [schedule.id, { ...schedule }])),
    documents: new Map(DOCUMENTS.map((document) => [document.reference, { ...document, wordingVersion: WORDING_RULE.version, supersededAt: null }])),
    // VEN's own record of a scope exit VEN-16 recorded; whether the party operates the premises is PTY's answer (premisesOf).
    scope: new Map(PREMISES.map((premises) => [premises.id, { relationshipEffective: true, classInScope: premises.classInScope }])),
    moods: MOODS.map((mood) => ({ ...mood })),
    // The seeded withdrawals were never approved, so when they were withdrawn decides no period.
    versions: new Map(MOOD_VERSIONS.map((version) => [version.id, { ...version, withdrawnAt: null, tracks: version.tracks.map((entry) => ({ ...entry })) }])),
    fallbacks: [],
    sweptAt: null,
    audit: [],
  };
}

const enrolledAtOf = (code: string) => ENTITLEMENTS.find((entitlement) => entitlement.code === code)?.enrolledAt ?? `${RULES.effectiveFrom}T00:00:00+07:00`;

/**
 * Two instants compared as instants: the seed writes them with the Vietnam offset, an act stamps them in UTC, so their
 * text does not sort.
 */
const notAfter = (a: string, b: string) => Date.parse(a) <= Date.parse(b);
const newestFirst = (a: string, b: string) => Date.parse(b) - Date.parse(a);

/** An enforcement action takes its state when due: suspended, restricted or revoked. */
const ENFORCED: Readonly<Record<EnforcementKind, EntitlementStatus>> = { SUSPEND: "SUSPENDED", RESTRICT: "RESTRICTED", REVOKE: "REVOKED" };

/** A world whose sweep is running: a read made from inside it (COM answering a raise) does not start another. */
const sweeping = new WeakSet<State>();

/**
 * The world's VEN state as a read or a command finds it: what has fallen due applied (`settled`), and the eligibility
 * sweep run for each 15-minute run that has come round since the last one played (`runsDue`). The world's first read
 * replays the runs the job would have made since the baseline took effect, so its fallbacks and drops are those the
 * resolution gives.
 */
function state(key: string): State {
  const s = settled(key);
  if (sweeping.has(s)) return s;
  const runs = runsDue(s, now());
  if (runs.length === 0) return s;
  sweeping.add(s);
  try {
    s.sweptAt = runs[runs.length - 1] ?? s.sweptAt;
    for (const run of runs) sweep(key, s, run);
  } finally {
    sweeping.delete(s);
  }
  return s;
}

/**
 * PTY's `party.premises_relationship_ended`, as the scope-exit consumer takes it (FR-VEN-020, DR-254 row 3): a service
 * whose party's relationship with the premises ended in the register - a closure, a cessation or a change of operator
 * recorded on SCR-PTY-09 - ends out of scope from the first day the party no longer operated it, recorded by RightOne
 * rather than by a person, through the same use case as a recorded scope exit (a later pending request ending is
 * superseded, NTF-VEN-04 is raised). PTY publishes on effect, so the register answers ENDED only from that day. The
 * event's key is srs/06's: the premises, the party and the instant in UTC. A service already ended, or holding a scope
 * exit, is left as it is (EXC-VEN-05).
 */
function scopeExitsFromRegister(key: string, s: State): void {
  for (const entitlement of s.entitlements.values()) {
    if (TERMINAL.includes(entitlement.status) || entitlement.endings.some((ending) => ending.cause === "SCOPE_EXIT" && ending.supersededBy === null)) continue;
    const party = PREMISES.find((premises) => premises.id === entitlement.premisesId)?.party;
    if (party === undefined) continue;
    const answer = premisesRelationshipAt(key, entitlement.premisesId, { organisation: party });
    if (answer.kind !== "ENDED" || answer.cause === null) continue;
    const effectiveAt = startOfDay(addDays(`${answer.endedOn}T12:00:00+07:00`, 1));
    const event = `${premisesRecordOf(entitlement.premisesId)}/${answer.party}/${effectiveAt}`;
    exitScope(key, s, entitlement, { family: "PREMISES", detail: answer.cause, event, evidence: "", effectiveAt }, null);
  }
}

/**
 * The world's VEN state with every transition that has fallen due applied in the order it fell due
 * (`Venue.ApplyDueTransitions`): an enforcement action at its effective time, an ending at its own. Each is
 * conditional on the state it finds, so a transition that no longer applies (an ending after a revocation) is not.
 * A schedule whose successor has taken effect is then marked superseded (`Venue.ApplySupersededSchedules`, SM-237
 * transition 2), only while it is still active.
 */
function settled(key: string): State {
  const s = table(key, "ven", seed);
  const instant = now();
  scopeExitsFromRegister(key, s);
  for (const entitlement of s.entitlements.values()) {
    const due = [
      ...entitlement.actions.filter((action) => !action.applied && notAfter(action.effectiveAt, instant)).map((action) => ({ at: action.effectiveAt, action, ending: null })),
      ...entitlement.endings
        .filter((ending) => !ending.applied && ending.supersededBy === null && notAfter(ending.effectiveAt, instant))
        .map((ending) => ({ at: ending.effectiveAt, action: null, ending })),
    ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    for (const event of due) {
      if (event.action !== null) applyAction(entitlement, event.action);
      if (event.ending !== null) applyEnding(entitlement, event.ending);
    }
  }
  const all = [...s.schedules.values()];
  for (const schedule of all) if (schedule.status === "ACTIVE" && supersededAt(all, schedule, instant, instant)) schedule.status = "SUPERSEDED";
  return s;
}

function applyAction(entitlement: Entitlement, action: Action): void {
  action.applied = true;
  if (!enforceable(entitlement.status, action.action)) return;
  const to = ENFORCED[action.action];
  entitlement.history.unshift(historyRow(action.effectiveAt, entitlement.status, to, "ENFORCEMENT", { kind: "PERSON", name: action.decidedBy, operations: true }));
  entitlement.status = to;
  if (to === "REVOKED") entitlement.endedAt = action.effectiveAt;
}

function applyEnding(entitlement: Entitlement, ending: Ending): void {
  ending.applied = true;
  if (TERMINAL.includes(entitlement.status)) return;
  const to: EntitlementStatus = ending.cause === "SCOPE_EXIT" ? "ENDED_OUT_OF_SCOPE" : "ENDED_AT_REQUEST";
  const by: HistoryRow["recordedBy"] = ending.cause === "SCOPE_EXIT" && ending.requestedBy !== null ? { kind: "PERSON", name: ending.requestedBy, operations: ending.operations } : { kind: "SYSTEM" };
  entitlement.history.unshift(historyRow(ending.effectiveAt, entitlement.status, to, ending.cause === "SCOPE_EXIT" ? "SCOPE_EXIT" : "ENDING", by));
  entitlement.status = to;
  entitlement.endedAt = ending.effectiveAt;
}

// ---------------------------------------------------------------- answers

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });

/** Every list reads twenty-five rows a page (`page_size` default, convention 11). */
const PAGE_SIZE = 25;

/** An opaque cursor: the list and filter it was issued for, and where its page starts. */
const cursorOf = (list: string, offset: number) => Buffer.from(JSON.stringify({ l: list, o: offset })).toString("base64url");

/** Where a cursor this list issued starts; null for one it did not issue. */
function offsetOf(cursor: string, list: string): number | null {
  try {
    const read = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { l?: unknown; o?: unknown };
    return read.l === list && typeof read.o === "number" && Number.isInteger(read.o) && read.o > 0 && read.o % PAGE_SIZE === 0 ? read.o : null;
  } catch {
    return null;
  }
}

/**
 * One page of a list in its order, from the cursor asked with (none, or empty, for the first page). `list` names the
 * list and its filter, so a cursor of another list or filter, or one tampered with, is CURSOR_INVALID and the first
 * page is answered with the refusal.
 */
function paged<T>(rows: readonly T[], cursor: string | null, list: string): { items: T[]; paging: Paging } {
  const asked = cursor === null || cursor === "" ? 0 : offsetOf(cursor, list);
  const offset = asked ?? 0;
  const items = rows.slice(offset, offset + PAGE_SIZE);
  return {
    items,
    paging: {
      from: items.length === 0 ? 0 : offset + 1,
      to: offset + items.length,
      next: offset + PAGE_SIZE < rows.length ? cursorOf(list, offset + PAGE_SIZE) : null,
      previous: offset === 0 ? null : offset === PAGE_SIZE ? "" : cursorOf(list, offset - PAGE_SIZE),
      refused: asked === null ? "CURSOR_INVALID" : null,
    },
  };
}
const accept = <T,>(accepted: T): CommandAnswer<T> => ({ accepted, refusal: null });
const refuse = (code: string, field: string | null = null, item: number | null = null): CommandAnswer<never> => ({ accepted: null, refusal: { code, field, item } });

function historyRow(
  at: string,
  from: EntitlementStatus | null,
  to: EntitlementStatus,
  cause: HistoryRow["cause"],
  recordedBy: HistoryRow["recordedBy"],
  more: { termsVersion?: string; endingFrom?: string } = {},
): HistoryRow {
  return { at, from, to, cause, recordedBy, termsVersion: more.termsVersion ?? null, endingFrom: more.endingFrom ?? null };
}

const holds = (staff: Staff, ...roles: readonly StaffRole[]) => roles.some((role) => staff.roles.includes(role));

// ---------------------------------------------------------------- the premises, as PTY answers

/** The premises' name as PTY holds it: the register's, else the registration family's, else the one the boards give. */
function nameOf(key: string, premisesId: string): string | null {
  return (
    premisesNameOf(key, premisesId) ??
    (premisesActedFor(key).data ?? []).find((premises) => premises.id === premisesId)?.name ??
    PREMISES.find((premises) => premises.id === premisesId)?.name ??
    null
  );
}

/**
 * The premises of a party a premises actor may read, with PTY's answers now: whether the party operates it (the
 * register's relationship, so a closure or a change of operator recorded on SCR-PTY-09 reaches the service), the ward
 * and the class read against the scope. A delegate's list holds only the premises their authority covers (DR-201).
 */
function premisesOf(key: string, organisation: string): (PremisesRef & { area: string | null } & ScopeAnswer & { classification: Classification | null })[] {
  const s = table(key, "ven", seed);
  const actable = new Set(premisesActableBy(key).flatMap((premises) => premises.ids));
  return PREMISES.filter((premises) => premises.party === organisation && actable.has(premises.id)).map((premises) => {
    const answer = s.scope.get(premises.id) ?? { relationshipEffective: true, classInScope: premises.classInScope };
    const relationshipEffective = answer.relationshipEffective && operatesNow(key, organisation, premises.id);
    return { id: premises.id, name: nameOf(key, premises.id) ?? premises.id, area: premises.area, ...answer, relationshipEffective, classification: premises.classification };
  });
}

/** The premises' name, as PTY holds it, for a premises of any party (the guest view reads it by premises). */
export function premisesName(key: string, premisesId: string): string | null {
  return nameOf(key, premisesId);
}

const premisesRef = (key: string, premisesId: string): PremisesRef => ({ id: premisesId, name: nameOf(key, premisesId) ?? premisesId });

/**
 * The service the reader may see, by code: one of a premises the party acts for. A service of another party is
 * answered as one that does not exist, so its existence is not disclosed.
 */
function visible(key: string, organisation: string, code: string): { s: State; entitlement: Entitlement; premises: PremisesRef } | null {
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return null;
  const premises = premisesOf(key, organisation).find((candidate) => candidate.id === entitlement.premisesId);
  return premises === undefined ? null : { s, entitlement, premises: { id: premises.id, name: premises.name } };
}

const head = (entitlement: Entitlement, premises: PremisesRef): ServiceHead => ({ code: entitlement.code, premises, status: entitlement.status });

/** Playlists, the default and schedules can change only while the service awaits terms or is active (spine A1). */
const mutable = (entitlement: Entitlement) => entitlement.status === "PENDING_TERMS" || entitlement.status === "ACTIVE";

// ---------------------------------------------------------------- shared moods (SM-236), as a premises reads them

/** A version's state on a day: its stored state, and for an approved one where the day falls against its dates. */
function versionState(version: MoodVersion, day: string): MoodVersionState {
  if (version.stored !== "APPROVED") return version.stored;
  if (day < version.effectiveFrom) return "APPROVED";
  return version.effectiveTo !== null && day > version.effectiveTo ? "SUPERSEDED" : "EFFECTIVE";
}

const versionsOf = (s: State, mood: string) => [...s.versions.values()].filter((version) => version.mood === mood).sort((a, b) => b.no - a.no);

/** The mood has a version in effect today: a premises may add it, and the editor offers it. */
const moodEffective = (s: State, mood: string) => versionsOf(s, mood).some((version) => versionState(version, today()) === "EFFECTIVE");

const trackOf = (id: string) => TRACKS.find((candidate) => candidate.id === id) ?? null;
const moodOf = (s: State, id: string) => s.moods.find((candidate) => candidate.id === id) ?? null;

/**
 * CAT's `ICatalogueReader.EntitlementsFor` at `t` as known at `k`: the track is eligible under the direct licence at
 * `t`, or its eligibility had not yet ended by `k`. CAT records the end at the instant it takes effect (the seed's
 * revocation of "Chủ nhật lười" was recorded and notified at 09:10 on 25 September 2026), so an earlier sweep looking a
 * day ahead, or a period asked about as of an earlier instant, reads the track as eligible, as it was known then.
 */
function eligibleAt(id: string, t: string, k: string = t): boolean {
  const track = trackOf(id);
  if (track === null) return false;
  return track.eligibleUntil === null || Date.parse(t) < Date.parse(track.eligibleUntil) || Date.parse(k) < Date.parse(track.eligibleUntil);
}

const eligibleNow = (id: string) => eligibleAt(id, now());

/** 00:00 Vietnam time on a local date, as an instant. */
const startOfDay = (date: string) => instantOf(date, "00:00");

/**
 * ALG-230 `moodUsable`'s version: the one that governs `t` as known at `k`. The versions approved by `k`, less any
 * withdrawn by `k` before it took effect, each from 00:00 of its effective date until the next one's, its own
 * withdrawal by `k`, or the mood's retirement. Derived this way rather than from the stored end, which approving and
 * withdrawing a successor change after the fact.
 */
function moodVersionAt(s: State, moodId: string, t: string, k: string): MoodVersion | null {
  const mood = moodOf(s, moodId);
  if (mood === null) return null;
  const known = versionsOf(s, moodId)
    .filter((version) => version.approvedAt !== null && notAfter(version.approvedAt, k))
    .filter((version) => !(version.withdrawnAt !== null && notAfter(version.withdrawnAt, k) && Date.parse(version.withdrawnAt) < Date.parse(startOfDay(version.effectiveFrom))))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (const [index, version] of known.entries()) {
    const next = known[index + 1];
    const ends = [
      next === undefined ? null : startOfDay(next.effectiveFrom),
      version.withdrawnAt !== null && notAfter(version.withdrawnAt, k) ? version.withdrawnAt : null,
      mood.retiredAt !== null && notAfter(mood.retiredAt, k) ? mood.retiredAt : null,
    ].filter((end): end is string => end !== null);
    if (notAfter(startOfDay(version.effectiveFrom), t) && ends.every((end) => Date.parse(t) < Date.parse(end))) return version;
  }
  return null;
}

/** The tracks of the governing version admitted by `k`, not dropped by `k` and eligible at `t`, in position order. */
function moodTracksAt(s: State, moodId: string, t: string, k: string): string[] {
  const version = moodVersionAt(s, moodId, t, k);
  if (version === null) return [];
  return version.tracks
    .filter((entry) => notAfter(entry.admittedAt, k) && (entry.droppedAt === null || !notAfter(entry.droppedAt, k)) && eligibleAt(entry.track, t, k))
    .map((entry) => entry.track);
}

const moodUsable = (s: State, moodId: string, t: string, k: string) => moodTracksAt(s, moodId, t, k).length > 0;

// ---------------------------------------------------------------- playlists (SM-235)

const current = (playlist: Playlist): Revision => playlist.revisions[playlist.revisions.length - 1] ?? { no: 0, createdAt: "", items: [] };

/** The revision in force as known at `k`: the highest number saved by then (ALG-230 `usable`). */
const revisionAt = (playlist: Playlist, k: string): Revision | null => [...playlist.revisions].reverse().find((revision) => notAfter(revision.createdAt, k)) ?? null;

/** An item can play at `t`, as known at `k`: an eligible track, or a shared mood whose governing version keeps one. */
const playableAt = (s: State, item: SeedItem, t: string, k: string) => (item.kind === "TRACK" ? eligibleAt(item.ref, t, k) : moodUsable(s, item.ref, t, k));

/**
 * ALG-230 `usable(playlistId, t, k)`: not archived by `k`, and the revision in force at `k` holds an item that can play
 * at `t`. Answers that revision, or null.
 */
function usableAt(s: State, id: string | null, t: string, k: string): { playlist: Playlist; revision: Revision } | null {
  const playlist = id === null ? undefined : s.playlists.get(id);
  if (playlist === undefined || (playlist.archivedAt !== null && notAfter(playlist.archivedAt, k))) return null;
  const revision = revisionAt(playlist, k);
  return revision !== null && revision.items.some((item) => playableAt(s, item, t, k)) ? { playlist, revision } : null;
}

/** An item can play now. */
const playable = (s: State, item: SeedItem) => playableAt(s, item, now(), now());

/** SM-235 now: what `Venue.ReevaluateEligibility` keeps current for the premises' screens, read here when asked. */
function statusOf(s: State, playlist: Playlist): PlaylistStatus {
  if (playlist.archivedAt !== null) return "ARCHIVED";
  return usableAt(s, playlist.id, now(), now()) !== null ? "USABLE" : "NO_ELIGIBLE_TRACK";
}

function playlistRow(s: State, playlist: Playlist, entitlement: Entitlement): PlaylistRow {
  return { id: playlist.id, name: playlist.name, revision: current(playlist).no, status: statusOf(s, playlist), isDefault: entitlement.defaultPlaylist === playlist.id };
}

const playlistsOf = (s: State, code: string) => [...s.playlists.values()].filter((playlist) => playlist.service === code);

function defaultRow(s: State, entitlement: Entitlement): PlaylistRow | null {
  const playlist = entitlement.defaultPlaylist === null ? undefined : s.playlists.get(entitlement.defaultPlaylist);
  return playlist === undefined ? null : playlistRow(s, playlist, entitlement);
}

/** ALG-230 `defaultAt(t, k)`: the designation with the latest effective time at or before `t`, among those made by `k`. */
function defaultAt(entitlement: Entitlement, t: string, k: string): string | null {
  const known = entitlement.designations.filter((designation) => notAfter(designation.createdAt, k) && notAfter(designation.effectiveFrom, t));
  // Oldest first, so of two taking effect at one instant the later designation wins.
  return known.reduce<Designation | null>((latest, designation) => (latest === null || notAfter(latest.effectiveFrom, designation.effectiveFrom) ? designation : latest), null)?.playlist ?? null;
}

/** GOV's `VEN-FALLBACK-MOOD` version in force on a local date (CFG-292): the designated mood, or none. */
function fallbackMoodOn(date: string): string | null {
  return [...FALLBACK_MOOD_RULE].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).find((version) => version.effectiveFrom <= date)?.mood ?? null;
}

/**
 * DR-251 row 4 at an instant: default content resolves, meaning DR-15 rows 1 to 4 can answer, which is the default
 * in force usable then or, failing it, the designated fallback mood (ALG-230's note on activation).
 */
function defaultContentResolves(s: State, entitlement: Entitlement, instant: string): boolean {
  if (usableAt(s, defaultAt(entitlement, instant, instant), instant, instant) !== null) return true;
  const mood = fallbackMoodOn(local(instant).date);
  return mood !== null && moodUsable(s, mood, instant, instant);
}

function editorItem(s: State, item: SeedItem): EditorItem {
  if (item.kind === "TRACK") {
    const found = trackOf(item.ref);
    return { kind: "TRACK", ref: item.ref, title: found?.title ?? item.ref, by: found?.by ?? null, eligible: eligibleNow(item.ref) };
  }
  return { kind: "SHARED_MOOD", ref: item.ref, title: moodOf(s, item.ref)?.name ?? item.ref, by: null, eligible: playable(s, item) };
}

// ---------------------------------------------------------------- DR-15

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** The ISO weekday of a calendar date, Monday 1 to Sunday 7. */
function weekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** An instant as a local date and time in Vietnam (CFG-18). */
function local(instant: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** A local date and time in Vietnam as an instant. */
const instantOf = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();

/** Now in Vietnam as a date and time field takes it (YYYY-MM-DDTHH:MM). */
function nowLocal(): string {
  const current = local(now());
  return `${current.date}T${current.time}`;
}

const hhmm = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

/** The instant a period of a date starts or ends: 24:00 is 00:00 of the next day. */
const momentOf = (date: string, time: string) => (time === "24:00" ? startOfDay(addDays(`${date}T12:00:00+07:00`, 1)) : instantOf(date, time));

/** When a successor takes the place of the schedule it names: 00:00 of its first date, or its saving if later (ALG-230 `sup`). */
const takesEffect = (successor: Schedule) => (notAfter(successor.createdAt, startOfDay(successor.effectiveFrom)) ? startOfDay(successor.effectiveFrom) : successor.createdAt);

/**
 * ALG-230 step 13: the schedule is superseded at `t` as known at `k` when a successor saved by `k` has taken effect by
 * `t`, unless that successor was withdrawn, as known at `k`, before it took effect.
 */
function supersededAt(all: readonly Schedule[], schedule: Schedule, t: string, k: string): boolean {
  return all.some((successor) => {
    if (successor.supersedes !== schedule.id || !notAfter(successor.createdAt, k)) return false;
    const from = takesEffect(successor);
    return notAfter(from, t) && !(successor.withdrawnAt !== null && notAfter(successor.withdrawnAt, k) && Date.parse(successor.withdrawnAt) < Date.parse(from));
  });
}

/** ALG-230 step 5: the schedules of a service saved by `asOf`, in force on the date (`[from, to)`) and on its weekday. */
function candidates(s: State, code: string, date: string, asOf: string): Schedule[] {
  return [...s.schedules.values()].filter(
    (schedule) =>
      schedule.service === code &&
      notAfter(schedule.createdAt, asOf) &&
      schedule.effectiveFrom <= date &&
      (schedule.effectiveTo === null || date < schedule.effectiveTo) &&
      schedule.days.includes(weekday(date)),
  );
}

/** The local time on `date` of an instant that falls on it, to the next whole minute (a cut of the day), or none. */
function cutOn(date: string, instant: string | null): string[] {
  if (instant === null) return [];
  const minute = new Date(Math.ceil(Date.parse(instant) / 60_000) * 60_000).toISOString();
  const at = local(minute);
  return at.date === date ? [at.time] : [];
}

/** One slice of a day as resolved, with the schedules it beat, before adjacent equal slices are joined. */
interface Slice extends ResolvedPeriod {
  beat: string[];
}

/**
 * ALG-230 for one local date: the day is cut at every schedule boundary and at every saving, withdrawal and
 * supersession that falls on it, and each period resolved at its start `t` with what was known at
 * `k = least(t, asOf)`: the latest-created applicable schedule wins, and when its playlist (the revision in force at
 * `k`, against eligibility at `t`) cannot play the period falls to the default designated then, never to an older
 * schedule (row 2); with no usable default, to the CFG-292 fallback mood (row 4); else nothing plays (row 5). Adjacent
 * periods with the same answer are joined. Nothing is stored, so asking again at the same `asOf` gives the same answer.
 */
function resolveDay(s: State, entitlement: Entitlement, date: string, asOf: string): ResolvedPeriod[] {
  const all = [...s.schedules.values()].filter((schedule) => schedule.service === entitlement.code);
  const found = candidates(s, entitlement.code, date, asOf);
  const cuts = [
    ...new Set([
      "00:00",
      "24:00",
      ...found.flatMap((schedule) => [schedule.start, schedule.end, ...cutOn(date, schedule.createdAt), ...cutOn(date, schedule.withdrawnAt)]),
      ...all.filter((successor) => found.some((schedule) => successor.supersedes === schedule.id)).flatMap((successor) => cutOn(date, takesEffect(successor))),
    ]),
  ].sort((a, b) => minutes(a) - minutes(b));
  const name = (id: string) => s.playlists.get(id)?.name ?? id;
  const slices: Slice[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const start = cuts[i] ?? "00:00";
    const end = cuts[i + 1] ?? "24:00";
    const t = instantOf(date, start);
    const k = notAfter(t, asOf) ? t : asOf;
    const applicable = found
      .filter(
        (schedule) =>
          minutes(schedule.start) <= minutes(start) &&
          minutes(start) < minutes(schedule.end) &&
          notAfter(schedule.createdAt, k) &&
          (schedule.withdrawnAt === null || !notAfter(schedule.withdrawnAt, k)) &&
          !supersededAt(all, schedule, t, k),
      )
      .sort((a, b) => newestFirst(a.createdAt, b.createdAt));
    const top = applicable[0] ?? null;
    const base = { date, start, end, ruleVersion: RULES.version, overlap: null, schedule: top?.id ?? null, lost: top === null ? null : name(top.playlist), beat: applicable.slice(1).map((schedule) => schedule.id) };
    const scheduled = top === null ? null : usableAt(s, top.playlist, t, k);
    const byDefault = scheduled !== null ? null : usableAt(s, defaultAt(entitlement, t, k), t, k);
    const moodId = scheduled !== null || byDefault !== null ? null : fallbackMoodOn(date);
    const mood = moodId === null || !moodUsable(s, moodId, t, k) ? null : moodVersionAt(s, moodId, t, k);
    if (scheduled !== null) {
      slices.push({ ...base, outcome: "SCHEDULED", reason: "SCHEDULE_APPLIES", playlist: scheduled.playlist.name, playlistId: scheduled.playlist.id, revision: scheduled.revision.no, mood: null, lost: null });
    } else if (byDefault !== null) {
      slices.push({
        ...base,
        outcome: "DEFAULT_PLAYLIST",
        reason: top !== null ? "SCHEDULED_PLAYLIST_UNUSABLE" : "NO_SCHEDULE_MATCHES",
        playlist: byDefault.playlist.name,
        playlistId: byDefault.playlist.id,
        revision: byDefault.revision.no,
        mood: null,
      });
    } else if (moodId !== null && mood !== null) {
      slices.push({ ...base, outcome: "FALLBACK_MOOD", reason: "DEFAULT_REPLACED_BY_MOOD", playlist: moodOf(s, moodId)?.name ?? moodId, playlistId: null, revision: null, mood: { id: moodId, version: mood.id, no: mood.no } });
    } else {
      slices.push({ ...base, outcome: "NO_PLAYABLE_SCHEDULE", reason: "NO_PLAYABLE_CONTENT", playlist: null, playlistId: null, revision: null, mood: null });
    }
  }
  const joined: Slice[] = [];
  for (const slice of slices) {
    const last = joined[joined.length - 1];
    const same =
      last !== undefined &&
      last.outcome === slice.outcome &&
      last.reason === slice.reason &&
      last.schedule === slice.schedule &&
      last.playlistId === slice.playlistId &&
      last.playlist === slice.playlist &&
      last.revision === slice.revision &&
      last.mood?.version === slice.mood?.version &&
      last.lost === slice.lost;
    if (same) {
      last.end = slice.end;
      last.beat = [...new Set([...last.beat, ...slice.beat])];
    } else {
      joined.push({ ...slice, beat: [...slice.beat] });
    }
  }
  return joined.map(({ beat, ...period }) => {
    // The schedule that lost to the one playing in part of the period, which the person reads as "the later-saved plays".
    const beaten = period.outcome === "SCHEDULED" ? s.schedules.get(beat[0] ?? "") : undefined;
    if (beaten === undefined) return period;
    const from = Math.max(minutes(beaten.start), minutes(period.start));
    const to = Math.min(minutes(beaten.end), minutes(period.end));
    return { ...period, overlap: { playlist: name(beaten.playlist), start: hhmm(from), end: hhmm(to) } };
  });
}

/** The days of a window, both ends included. */
function daysOf(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length <= 31; day = addDays(`${day}T12:00:00+07:00`, 1)) days.push(day);
  return days;
}

/** This week in Vietnam, Monday to Sunday, and now as the as-at instant (convention 5). */
export function defaultWeek(): WeekQuery {
  const day = today();
  const monday = addDays(`${day}T12:00:00+07:00`, 1 - weekday(day));
  return { from: monday, to: addDays(`${monday}T12:00:00+07:00`, 6), asOf: nowLocal() };
}

const isDate = (text: string) => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(new Date(`${text}T00:00:00Z`).getTime());
const isTime = (text: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);

/** A date and time as the field sends it (YYYY-MM-DDTHH:MM, Vietnam time) as an instant; null when it is not one. */
function localInstant(value: string): string | null {
  const [date, time] = value.split("T");
  return date !== undefined && time !== undefined && isDate(date) && isTime(time) ? instantOf(date, time) : null;
}

/** The start of an instant's minute, as milliseconds: a time typed to the minute is "now" until the minute is over. */
const minuteOf = (instant: string) => Math.floor(Date.parse(instant) / 60_000) * 60_000;
const thisMinute = () => minuteOf(now());

/** GET /schedule-resolutions: the window and the as-at instant checked, then every day resolved. */
function resolveWeek(s: State, entitlement: Entitlement, week: WeekQuery): ScheduleStep["resolution"] {
  const asOf = localInstant(week.asOf);
  if (asOf === null) return { periods: null, refusal: "AS_OF_REQUIRED" };
  if (!isDate(week.from) || !isDate(week.to) || week.to < week.from || daysOf(week.from, week.to).length > 31) return { periods: null, refusal: "WINDOW_TOO_LONG" };
  if (week.asOf.slice(0, 10) < RULES.effectiveFrom) return { periods: null, refusal: "RULES_NOT_APPROVED" };
  return { periods: daysOf(week.from, week.to).flatMap((date) => resolveDay(s, entitlement, date, asOf)), refusal: null };
}

function scheduleRow(s: State, schedule: Schedule): ScheduleRow {
  const playlist = s.playlists.get(schedule.playlist);
  const replaced = schedule.supersedes === null ? undefined : s.schedules.get(schedule.supersedes);
  return {
    id: schedule.id,
    playlist: playlist?.name ?? schedule.playlist,
    days: schedule.days,
    start: schedule.start,
    end: schedule.end,
    effectiveFrom: schedule.effectiveFrom,
    effectiveTo: schedule.effectiveTo,
    savedAt: schedule.createdAt,
    status: schedule.status,
    withdrawnAt: schedule.withdrawnAt,
    replaces: replaced === undefined ? null : local(replaced.createdAt).date,
    playlistUnusable: playlist !== undefined && statusOf(s, playlist) !== "USABLE",
  };
}

/** GET /service-entitlements/{id}/fallbacks: the rows the sweep recorded, newest period first. */
function fallbackRows(s: State, code: string): FallbackRow[] {
  return s.fallbacks
    .filter((fallback) => fallback.service === code)
    .sort((a, b) => newestFirst(momentOf(a.date, a.start), momentOf(b.date, b.start)))
    .map((fallback) => {
      const playlist = s.playlists.get(fallback.playlist);
      return {
        date: fallback.date,
        start: fallback.start,
        end: fallback.end,
        schedule: fallback.schedule,
        playlist: { id: fallback.playlist, name: playlist?.name ?? fallback.playlist, archived: playlist !== undefined && playlist.archivedAt !== null },
        cause: fallback.cause,
        resolvedTo: fallback.resolvedTo,
        detectedAt: fallback.detectedAt,
        notice: fallback.notice,
      };
    });
}

// ---------------------------------------------------------------- the eligibility sweep (ALG-231)

/** `Venue.ReevaluateEligibility` runs every 15 minutes; a run is the 15-minute slot an instant falls in. */
const SWEEP_MS = 15 * 60 * 1000;
const runOf = (instant: string) => Math.floor(Date.parse(instant) / SWEEP_MS);

/** `IServiceEntitlementReader.StatusAt` from the history: the state the latest row by the instant moved it to. */
function statusAt(entitlement: Entitlement, instant: string): EntitlementStatus | null {
  return [...entitlement.history].filter((row) => notAfter(row.at, instant)).sort((a, b) => newestFirst(a.at, b.at))[0]?.to ?? null;
}

/**
 * One run of ALG-231 at `run`: pass 1 drops, from every shared mood version in effect, each track no longer eligible
 * (DR-256 row 2, for good: a new version admits it again); pass 3 resolves today and tomorrow for every service whose
 * state lets delivery through (ACTIVE: a restriction stops delivery as a suspension does, Q-VEN-01) and records each
 * scheduled period not yet ended whose playlist cannot play, keyed by service, schedule, date and start, raising
 * NTF-VEN-01 for it; a notice that cannot be raised leaves the row's reference empty (EXC-VEN-06), and the next run
 * raises it again while the period has not ended, COM answering a repeat with the notice it already holds. Pass 2,
 * the playlists' stored status, is read when asked (`statusOf`). A second run over the same inputs writes nothing.
 */
function sweep(key: string, s: State, run: string): void {
  for (const version of [...s.versions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (moodVersionAt(s, version.mood, run, run)?.id !== version.id) continue;
    for (const entry of version.tracks) if (entry.droppedAt === null && !eligibleAt(entry.track, run)) entry.droppedAt = run;
  }
  const day = local(run).date;
  for (const entitlement of [...s.entitlements.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    if (statusAt(entitlement, run) !== "ACTIVE") continue;
    for (const date of [day, addDays(`${day}T12:00:00+07:00`, 1)]) {
      if (date < RULES.effectiveFrom) continue;
      for (const period of resolveDay(s, entitlement, date, run)) {
        if (period.schedule === null || period.outcome === "SCHEDULED" || notAfter(momentOf(date, period.end), run)) continue;
        if (s.fallbacks.some((fallback) => fallback.service === entitlement.code && fallback.schedule === period.schedule && fallback.date === date && fallback.start === period.start)) continue;
        const schedule = s.schedules.get(period.schedule);
        if (schedule === undefined) continue;
        const fallback: Fallback = {
          service: entitlement.code,
          schedule: schedule.id,
          playlist: schedule.playlist,
          date,
          start: period.start,
          end: period.end,
          cause: "PLAYLIST_NO_ELIGIBLE_TRACK",
          resolvedTo: period.outcome,
          instead: period.playlist,
          notice: null,
          detectedAt: run,
        };
        fallback.notice = raiseFallbackNotice(key, s, entitlement, fallback, run);
        s.fallbacks.unshift(fallback);
      }
    }
    for (const fallback of s.fallbacks) {
      if (fallback.service === entitlement.code && fallback.notice === null && fallback.detectedAt !== run && !notAfter(momentOf(fallback.date, fallback.end), run)) {
        raiseFallbackNotice(key, s, entitlement, fallback, run);
      }
    }
  }
}

/**
 * NTF-VEN-01 through COM, class `schedule fallback`: the period, the schedule's playlist, the cause and what plays
 * instead, keyed by the fallback's business key so a repeat raises nothing twice; a raise retried by a later run
 * carries the same facts. Answers the notice, or none (EXC-VEN-06, kept in the module audit log).
 */
function raiseFallbackNotice(key: string, s: State, entitlement: Entitlement, fallback: Fallback, run: string): string | null {
  const occurrence = `${fallback.service}/${fallback.schedule}/${fallback.date}/${fallback.start}`;
  const notice = recordNoticeEvent(key, {
    sourceModule: "VEN",
    eventKind: "schedule_fell_back",
    occurrenceRef: occurrence,
    occurredAt: run,
    subjectKind: "playlist",
    subjectRef: fallback.playlist,
    recipientPartyId: partyOf(entitlement.premisesId),
    destination: null,
    facts: {
      service: entitlement.code,
      premises: premisesName(key, entitlement.premisesId) ?? entitlement.premisesId,
      playlist: s.playlists.get(fallback.playlist)?.name ?? fallback.playlist,
      period: `${fallback.date} ${fallback.start}-${fallback.end}`,
      cause: fallback.cause,
      resolvedTo: fallback.resolvedTo,
      ...(fallback.instead !== null ? { instead: fallback.instead } : {}),
      by: fallback.date,
    },
  });
  if (notice === null) s.audit.push({ at: run, act: "NOTICE_NOT_RAISED", subject: occurrence, reason: "schedule_fell_back" });
  return notice;
}

/** The run an instant falls in, and the first run at or after it, each as the instant the run starts. */
const runAt = (instant: string) => new Date(runOf(instant) * SWEEP_MS).toISOString();
const firstRunAfter = (instant: string) => new Date(Math.ceil(Date.parse(instant) / SWEEP_MS) * SWEEP_MS).toISOString();

/**
 * The sweep's runs that have come round since the last one played (`sweptAt`), or, on a world's first read, since the
 * baseline took effect, in order, up to the run now falls in. The job's answer changes only when the day turns or an
 * input changes, so the runs played are 00:00 of each day, the first run after each change, and the run of now; each
 * is played at the instant it starts, so a fallback is detected, and its notice raised, at the run that would have
 * found it, and a second play of one run writes nothing.
 */
function runsDue(s: State, instant: string): string[] {
  const after = s.sweptAt === null ? Date.parse(startOfDay(RULES.effectiveFrom)) - 1 : Date.parse(s.sweptAt);
  const latest = Date.parse(runAt(instant));
  if (latest <= after) return [];
  const changes = [
    ...TRACKS.flatMap((track) => (track.eligibleUntil === null ? [] : [track.eligibleUntil])),
    ...[...s.schedules.values()].flatMap((schedule) => [schedule.createdAt, takesEffect(schedule), ...(schedule.withdrawnAt === null ? [] : [schedule.withdrawnAt])]),
    ...[...s.playlists.values()].flatMap((playlist) => [...playlist.revisions.map((revision) => revision.createdAt), ...(playlist.archivedAt === null ? [] : [playlist.archivedAt])]),
    ...[...s.entitlements.values()].flatMap((entitlement) => [...entitlement.history.map((row) => row.at), ...entitlement.designations.map((designation) => designation.createdAt)]),
    ...[...s.versions.values()].flatMap((version) => [
      startOfDay(version.effectiveFrom),
      ...(version.approvedAt === null ? [] : [version.approvedAt]),
      ...(version.withdrawnAt === null ? [] : [version.withdrawnAt]),
    ]),
    ...s.moods.flatMap((mood) => (mood.retiredAt === null ? [] : [mood.retiredAt])),
  ].map(firstRunAfter);
  const runs = new Set([...changes, runAt(instant)]);
  const from = s.sweptAt === null ? RULES.effectiveFrom : local(s.sweptAt).date;
  for (let day = from; Date.parse(startOfDay(day)) <= latest; day = addDays(`${day}T12:00:00+07:00`, 1)) runs.add(startOfDay(day));
  return [...runs].filter((run) => after < Date.parse(run) && Date.parse(run) <= latest).sort((a, b) => Date.parse(a) - Date.parse(b));
}

// ---------------------------------------------------------------- reads

/** The latest ending that stands: not replaced by an earlier scope exit. */
const currentEnding = (entitlement: Entitlement): Ending | null => entitlement.endings.find((ending) => ending.supersededBy === null) ?? null;

/** The latest applied action whose effect stands, as the premises reads why its service is enforced. */
function standingAction(entitlement: Entitlement): Action | null {
  return entitlement.status === "SUSPENDED" || entitlement.status === "RESTRICTED" || entitlement.status === "REVOKED"
    ? (entitlement.actions.find((action) => action.applied) ?? null)
    : null;
}

const groundOf = (code: string) => ENFORCEMENT_POLICY.grounds.find((ground) => ground.code === code) ?? null;

/** GET /service-entitlements: every service of the premises the party acts for, ended ones included, a page at a time. */
export function serviceList(key: string, organisation: string, cursor: string | null = null): LoadOutcome<ServiceList> {
  const s = state(key);
  const premises = premisesOf(key, organisation);
  const items = s.order
    .map((code) => s.entitlements.get(code))
    .filter((entitlement): entitlement is Entitlement => entitlement !== undefined)
    .flatMap((entitlement) => {
      const where = premises.find((candidate) => candidate.id === entitlement.premisesId);
      if (where === undefined) return [];
      const since =
        entitlement.status === "ACTIVE"
          ? (entitlement.history.find((row) => row.from !== null && row.to === "ACTIVE")?.at ?? entitlement.activatedAt ?? entitlement.enrolledAt)
          : entitlement.status === "PENDING_TERMS"
            ? entitlement.enrolledAt
            : TERMINAL.includes(entitlement.status)
              ? (entitlement.endedAt ?? entitlement.enrolledAt)
              : (entitlement.history[0]?.at ?? entitlement.enrolledAt);
      return [{ ...head(entitlement, { id: where.id, name: where.name }), since }];
    });
  return ok(paged(items, cursor, `services/${organisation}`));
}

/** SCR-VEN-01's form: the party and the premises it acts for, with the ward PTY gives. */
export function enrolForm(key: string, organisation: string, party: string): LoadOutcome<EnrolForm> {
  return ok({ party, premises: premisesOf(key, organisation).map(({ id, name, area }) => ({ id, name, area })) });
}

/** GET /service-entitlements/{id}. */
export function serviceRecord(key: string, organisation: string, code: string): LoadOutcome<ServiceRecord> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const { entitlement, premises } = found;
  const action = standingAction(entitlement);
  const ending = currentEnding(entitlement);
  return ok({
    ...head(entitlement, premises),
    since: entitlement.history[0]?.at ?? entitlement.enrolledAt,
    enrolledAt: entitlement.enrolledAt,
    terms:
      entitlement.terms === null
        ? null
        : { version: entitlement.terms.version, acceptedAt: entitlement.terms.acceptedAt, acceptedBy: entitlement.terms.acceptedBy, acceptedOn: local(entitlement.terms.acceptedAt).date },
    enforcement:
      action === null
        ? null
        : {
            kind: ENFORCED[action.action] as "SUSPENDED" | "RESTRICTED" | "REVOKED",
            ground: groundOf(action.ground)?.words ?? { vi: action.ground, en: action.ground },
            policy: ENFORCEMENT_POLICY.title,
            effectiveAt: action.effectiveAt,
            remedy: action.remedy,
            conditions: action.conditions.map((condition) => condition.text),
          },
    ending:
      ending === null
        ? null
        : {
            cause: ending.cause,
            effectiveAt: ending.effectiveAt,
            requestedBy: ending.requestedBy,
            requestedAt: ending.requestedAt,
            applied: ending.applied,
            scopeExit: ending.scopeExit === null ? null : { family: ending.scopeExit.family, event: ending.scopeExit.event, reference: ending.scopeExit.reference },
          },
    history: entitlement.history,
  });
}

/**
 * SCR-VEN-02: the effective terms, as PUB answered the seam (null when PUB could not answer), the baseline
 * (GET /schedule-rules/effective) and the default's state.
 */
export function termsStep(key: string, organisation: string, party: string, code: string, terms: TermsDocument | null): LoadOutcome<TermsStep> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement, premises } = found;
  return ok({
    service: { ...head(entitlement, premises), enrolledAt: entitlement.enrolledAt },
    party,
    terms,
    rules: local(now()).date < RULES.effectiveFrom ? { disclosure: null, refusal: "RULES_NOT_APPROVED" } : { disclosure: RULES, refusal: null },
    defaultSet: usableAt(s, entitlement.defaultPlaylist, now(), now()) !== null,
  });
}

function documentOf(document: Document, premises: string): VerificationDocument {
  return { ...document, premises, printedCode: printedCodeOf(document.reference) };
}

/** SCR-VEN-05: the service and its current document (F-2: GET /service-entitlements/{id} returns it). */
export function documentStep(key: string, organisation: string, code: string): LoadOutcome<DocumentStep> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement, premises } = found;
  const current = entitlement.document === null ? undefined : s.documents.get(entitlement.document);
  return ok({ service: head(entitlement, premises), document: current === undefined ? null : documentOf(current, premises.name) });
}

/** GET /verification-documents/{id}: a document of a service the reader may see. */
export function documentFile(key: string, organisation: string, ref: string): LoadOutcome<VerificationDocument> {
  const s = state(key);
  const document = s.documents.get(ref);
  const found = document === undefined ? null : visible(key, organisation, document.service);
  if (document === undefined || found === null) return refusedRead("DOCUMENT_NOT_FOUND");
  return ok(documentOf(document, found.premises.name));
}

/** SM-235's states, the values GET /playlists filters by. */
const PLAYLIST_STATES: readonly PlaylistStatus[] = ["USABLE", "NO_ELIGIBLE_TRACK", "ARCHIVED"];

/**
 * GET /playlists for one service, filtered by state, newest first and a page at a time; a state outside SM-235 is
 * CURSOR_INVALID (srs/02).
 */
export function playlistList(key: string, organisation: string, code: string, filter: string | null, cursor: string | null = null): LoadOutcome<PlaylistsStep> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement, premises } = found;
  if (filter !== null && !PLAYLIST_STATES.includes(filter as PlaylistStatus)) return refusedRead("CURSOR_INVALID");
  const created = (playlist: Playlist) => playlist.revisions[0]?.createdAt ?? "";
  const rows = playlistsOf(s, code)
    .sort((a, b) => newestFirst(created(a), created(b)))
    .map((playlist) => playlistRow(s, playlist, entitlement))
    .filter((row) => filter === null || row.status === filter);
  const page = paged(rows, cursor, `playlists/${code}/${filter ?? ""}`);
  return ok({ service: head(entitlement, premises), defaultPlaylist: defaultRow(s, entitlement), ...page });
}

/**
 * GET /playlists/{id} with each item's eligibility now, or a new playlist; and GET /shared-moods as a premises reads
 * it: the moods with a version in effect today, so a version approved for today is offered from today and a mood
 * whose version was withdrawn is offered no more.
 */
export function playlistEditor(key: string, organisation: string, code: string, id: string | null): LoadOutcome<PlaylistEditor> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement, premises } = found;
  const moods = s.moods.filter((mood) => mood.retiredAt === null && moodEffective(s, mood.id)).map(({ id: moodId, name }) => ({ id: moodId, name }));
  if (id === null) return ok({ service: head(entitlement, premises), playlist: null, items: [], moods });
  const playlist = s.playlists.get(id);
  if (playlist === undefined || playlist.service !== code) return refusedRead("PLAYLIST_NOT_FOUND");
  return ok({
    service: head(entitlement, premises),
    playlist: {
      id: playlist.id,
      name: playlist.name,
      revision: current(playlist).no,
      status: statusOf(s, playlist),
      archivedOn: playlist.archivedAt === null ? null : local(playlist.archivedAt).date,
    },
    items: current(playlist).items.map((item) => editorItem(s, item)),
    moods,
  });
}

/** CAT's eligible tracks whose title or performer holds the words searched. */
function eligibleTracks(query: string): TrackResult[] {
  const words = query.trim().toLocaleLowerCase("vi");
  if (words === "") return [];
  return TRACKS.filter((candidate) => eligibleNow(candidate.id) && `${candidate.title} ${candidate.by}`.toLocaleLowerCase("vi").includes(words)).map(({ id, title, by }) => ({ id, title, by }));
}

/** CAT's tracks eligible for this premises now whose title or performer holds the words searched. */
export function trackSearch(key: string, organisation: string, code: string, query: string): LoadOutcome<readonly TrackResult[]> {
  if (visible(key, organisation, code) === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  return ok(eligibleTracks(query));
}

/**
 * SCR-VEN-08: a page of the schedules (GET /schedules, those in force first, newest first), every schedule in force
 * for Replaces, the playlists a schedule may name, and the week resolved for the window and instant asked.
 */
export function scheduleStep(key: string, organisation: string, code: string, week: WeekQuery | null, cursor: string | null = null): LoadOutcome<ScheduleStep> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement, premises } = found;
  const asked = week ?? defaultWeek();
  const schedules = [...s.schedules.values()]
    .filter((schedule) => schedule.service === code)
    .sort((a, b) => ((a.status === "ACTIVE") === (b.status === "ACTIVE") ? newestFirst(a.createdAt, b.createdAt) : a.status === "ACTIVE" ? -1 : 1))
    .map((schedule) => scheduleRow(s, schedule));
  const page = paged(schedules, cursor, `schedules/${code}`);
  return ok({
    service: head(entitlement, premises),
    today: today(),
    defaultPlaylist: defaultRow(s, entitlement),
    schedules: page.items,
    schedulesPaging: page.paging,
    replaceable: schedules.filter((schedule) => schedule.status === "ACTIVE"),
    usable: playlistsOf(s, code)
      .filter((playlist) => statusOf(s, playlist) === "USABLE")
      .map(({ id, name }) => ({ id, name })),
    week: asked,
    resolution: resolveWeek(s, entitlement, asked),
    rules: RULES,
  });
}

/** GET /service-entitlements/{id}/fallbacks, newest first, a page at a time. */
export function fallbackList(key: string, organisation: string, code: string, cursor: string | null = null): LoadOutcome<FallbackList> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement, premises } = found;
  return ok({ service: head(entitlement, premises), ...paged(fallbackRows(s, code), cursor, `fallbacks/${code}`) });
}

/** STA's figures are stale once older than 24 hours (NFR-336). */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * GET /premises/{premisesId}/service-view, now (ALG-235): the service, PLR's device line, today's periods from the one
 * now falls in to 24:00, and STA's figures with their freshness.
 */
export function serviceView(key: string, organisation: string, code: string): LoadOutcome<ServiceViewData> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const { s, entitlement, premises } = found;
  const asOf = now();
  const day = local(asOf).date;
  const figures = ANALYTICS.find((entry) => entry.service === code);
  const freshness: Freshness = figures === undefined ? "UNAVAILABLE" : Date.parse(asOf) - Date.parse(figures.asAt) > STALE_AFTER_MS ? "STALE" : "CURRENT";
  const periods = day < RULES.effectiveFrom ? null : resolveDay(s, entitlement, day, asOf).filter((period) => !notAfter(momentOf(day, period.end), asOf));
  return ok({
    asOf,
    service: { ...head(entitlement, premises), activatedAt: entitlement.activatedAt },
    device: deviceSummary(key, premises.id),
    today: periods === null ? null : { date: day, periods },
    activity:
      figures === undefined
        ? { freshness, hours: null, plays: null, period: null, asAt: null }
        : { freshness, hours: figures.hours, plays: figures.plays, period: figures.period, asAt: figures.asAt },
  });
}

/** SCR-VEN-11: the service and the earliest date CFG-291 allows for a request made now. */
export function endingStep(key: string, organisation: string, code: string): LoadOutcome<EndingStep> {
  const found = visible(key, organisation, code);
  if (found === null) return refusedRead("NOT_AUTHORISED_FOR_PREMISES");
  const { entitlement, premises } = found;
  return ok({ service: head(entitlement, premises), earliest: earliestEnd(), ended: ended(entitlement) });
}

/** CFG-291's tested default: 00:00 Vietnam time on the day after the request is recorded. */
const earliestEnd = () => addDays(now(), 1);
const ended = (entitlement: Entitlement) => TERMINAL.includes(entitlement.status) || entitlement.endings.some((ending) => !ending.applied && ending.supersededBy === null);

// ---------------------------------------------------------------- commands

/** POST /service-entitlements: DR-250, rows in its evaluation order (6, 2, 3, 4, 5, then 1). */
export function enrolPremises(key: string, organisation: string, account: string, premisesId: string): CommandAnswer<{ code: string }> {
  const s = state(key);
  // Row 6: PTY's and LIC's reads are played from the boards' data, so they are always available here.
  const premises = premisesOf(key, organisation).find((candidate) => candidate.id === premisesId);
  if (premises === undefined || !mayActFor(key, premisesId, "PERM-535")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  if (!premises.relationshipEffective) return refuse("PREMISES_RELATIONSHIP_NOT_EFFECTIVE");
  // A register with no class cannot say whether the licence covers the premises: the board's own answer, not row 4.
  if (premises.classInScope === null) return refuse("PREMISES_CLASS_UNRESOLVED");
  if (!premises.classInScope) return refuse("PREMISES_CLASS_OUT_OF_SCOPE");
  if ([...s.entitlements.values()].some((entitlement) => entitlement.premisesId === premisesId && !TERMINAL.includes(entitlement.status))) {
    return refuse("ALREADY_ENROLLED");
  }
  let code = reference("RPS");
  while (s.entitlements.has(code)) code = reference("RPS");
  const at = now();
  s.entitlements.set(code, {
    code,
    premisesId,
    status: "PENDING_TERMS",
    enrolledAt: at,
    activatedAt: null,
    endedAt: null,
    classification: premises.classification,
    classConfirmedAt: at,
    terms: null,
    actions: [],
    reinstatements: [],
    endings: [],
    history: [historyRow(at, null, "PENDING_TERMS", "ENROLMENT", { kind: "PERSON", name: account, operations: false })],
    defaultPlaylist: null,
    designations: [],
    document: null,
  });
  s.order.unshift(code);
  return accept({ code });
}

/** A digest is 64 hexadecimal characters; anything else is malformed (SEC control on the acceptance). */
const DIGEST = /^[0-9a-f]{64}$/;

/**
 * POST /service-entitlements/{id}/terms-acceptances: DR-251, rows in order. `effective` is the version PUB answers
 * in effect at the acceptance instant, read by the seam (null when PUB could not answer). A refusal records no
 * acceptance. Row 2 takes an unticked box and a malformed digest; row 3 takes a document or version that is not the
 * effective one, none named, and a digest that is not of the effective text: the text the person attested to is not
 * the text in force. CFG-293: an active service keeps the version it accepted, so only a pending one reaches here.
 * Rows 4 to 7 exclude each other through their last two columns, so the class PTY answers now is read first (row 7
 * unresolved, row 6 out of scope), then the baseline (row 5), then whether default content resolves (row 4).
 */
export function acceptTerms(
  key: string,
  organisation: string,
  account: string,
  code: string,
  input: { termsVersion: string; termsDocumentId: string; shownTextDigest: string; attestationConfirmed: boolean },
  effective: TermsDocument | null,
  party: string,
): CommandAnswer<{ activatedAt: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-536")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  if (entitlement.status !== "PENDING_TERMS") return refuse("ENTITLEMENT_NOT_PENDING");
  if (!input.attestationConfirmed || !DIGEST.test(input.shownTextDigest)) return refuse("ATTESTATION_NOT_CONFIRMED", "attestation_confirmed");
  if (
    effective === null ||
    input.termsVersion !== effective.version ||
    input.termsDocumentId !== effective.documentId ||
    ![shownTermsDigest(effective, "vi"), shownTermsDigest(effective, "en")].includes(input.shownTextDigest)
  )
    return refuse("TERMS_VERSION_SUPERSEDED");
  const inScope = s.scope.get(entitlement.premisesId)?.classInScope ?? null;
  if (inScope === null) return refuse("PREMISES_CLASS_UNRESOLVED");
  if (!inScope) return refuse("PREMISES_CLASS_OUT_OF_SCOPE");
  if (local(now()).date < RULES.effectiveFrom) return refuse("RULES_NOT_APPROVED");
  if (!defaultContentResolves(s, entitlement, now())) return refuse("NO_DEFAULT_CONTENT");
  const at = now();
  entitlement.status = "ACTIVE";
  entitlement.activatedAt = at;
  entitlement.terms = { version: effective.version, acceptedAt: at, acceptedBy: account, actingFor: party, digest: input.shownTextDigest };
  entitlement.history.unshift(historyRow(at, "PENDING_TERMS", "ACTIVE", "TERMS_ACCEPTED", { kind: "PERSON", name: account, operations: false }, { termsVersion: effective.version }));
  return accept({ activatedAt: at });
}

/** A document's public reference: 26 characters from the references' alphabet. */
function documentReference(): string {
  return [0, 1, 2].map(() => reference("D").slice(2)).join("").slice(0, 26);
}

/** GOV's `VEN-ENTITLEMENT-WORDING` version in force at an instant (CFG-16), or none. */
const wordingAt = (instant: string) => (local(instant).date >= WORDING_RULE.effectiveFrom ? WORDING_RULE : null);

/**
 * POST /service-entitlements/{id}/verification-documents: issued under the entitlement wording in force (none
 * approved is WORDING_NOT_APPROVED, and nothing is issued); the new document supersedes the one before it, which
 * keeps its record with the instant it was replaced.
 */
export function issueDocument(key: string, organisation: string, code: string, format: string): CommandAnswer<{ reference: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-543")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  if (format !== "pdf" && format !== "html") return refuse("FIELD_MISSING", "format");
  if (entitlement.status === "PENDING_TERMS") return refuse("ENTITLEMENT_PENDING");
  const at = now();
  const wording = wordingAt(at);
  if (wording === null) return refuse("WORDING_NOT_APPROVED");
  let ref = documentReference();
  while (s.documents.has(ref)) ref = documentReference();
  const previous = entitlement.document === null ? undefined : s.documents.get(entitlement.document);
  if (previous !== undefined && previous.supersededAt === null) previous.supersededAt = at;
  s.documents.set(ref, { reference: ref, service: code, statusAtIssue: entitlement.status, issuedAt: at, format, wordingVersion: wording.version, supersededAt: null });
  entitlement.document = ref;
  return accept({ reference: ref });
}

/**
 * POST /service-entitlements/{id}/default-playlist: the default now, and a designation appended with the instant it
 * takes effect, so a period before the change still resolves to the default it had (ALG-230 `defaultAt`).
 */
export function defaultPlaylistSet(key: string, organisation: string, code: string, id: string): CommandAnswer<{ playlist: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-550")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  if (!mutable(entitlement)) return refuse("ENTITLEMENT_NOT_ACTIVE");
  const playlist = s.playlists.get(id);
  if (playlist === undefined || playlist.service !== code) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const status = statusOf(s, playlist);
  if (status === "ARCHIVED") return refuse("PLAYLIST_ARCHIVED");
  if (status === "NO_ELIGIBLE_TRACK") return refuse("PLAYLIST_NO_ELIGIBLE_TRACK");
  const at = now();
  entitlement.defaultPlaylist = id;
  entitlement.designations.push({ playlist: id, effectiveFrom: at, createdAt: at });
  return accept({ playlist: id });
}

/** A playlist is in use while it is the default or a schedule in force names it. */
const inUse = (s: State, entitlement: Entitlement, id: string) =>
  entitlement.defaultPlaylist === id || [...s.schedules.values()].some((schedule) => schedule.playlist === id && schedule.status === "ACTIVE");

/** POST /playlists/{id}/archive, the reason kept in the module audit log. */
export function archivePlaylist(key: string, organisation: string, code: string, id: string, reason: string): CommandAnswer<{ playlist: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-547")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  const playlist = s.playlists.get(id);
  if (playlist === undefined || playlist.service !== code) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  if (playlist.archivedAt !== null) return refuse("PLAYLIST_ARCHIVED");
  if (inUse(s, entitlement, id)) return refuse("PLAYLIST_IN_USE");
  playlist.archivedAt = now();
  if (reason.trim() !== "") s.audit.push({ at: playlist.archivedAt, act: "PLAYLIST_ARCHIVED", subject: id, reason: reason.trim() });
  return accept({ playlist: id });
}

/** The items as sent, checked one by one: each carries the id of its own kind, and each can play now. */
function checkItems(s: State, items: readonly ItemInput[]): { items: SeedItem[] } | { code: string; item: number } {
  const checked: SeedItem[] = [];
  for (const [index, item] of items.entries()) {
    if (item.kind !== "TRACK" && item.kind !== "SHARED_MOOD") return { code: "FIELD_NOT_PERMITTED", item: index };
    if (item.ref.trim() === "") return { code: "FIELD_MISSING", item: index };
    if (item.kind === "TRACK" && trackOf(item.ref) === null) return { code: "FIELD_NOT_PERMITTED", item: index };
    if (item.kind === "SHARED_MOOD" && moodOf(s, item.ref) === null) return { code: "FIELD_NOT_PERMITTED", item: index };
    checked.push({ kind: item.kind, ref: item.ref });
  }
  const notEligible = checked.findIndex((item) => item.kind === "TRACK" && !eligibleNow(item.ref));
  if (notEligible >= 0) return { code: "TRACK_NOT_ELIGIBLE", item: notEligible };
  const notEffective = checked.findIndex((item) => item.kind === "SHARED_MOOD" && !moodEffective(s, item.ref));
  if (notEffective >= 0) return { code: "MOOD_NOT_EFFECTIVE", item: notEffective };
  return { items: checked };
}

/** A new playlist's id, in the references' form. */
function playlistId(s: State): string {
  let id = reference("PLS");
  while (s.playlists.has(id)) id = reference("PLS");
  return id;
}

/** POST /playlists: revision 1, usable or with no eligible track as its items make it. */
export function createPlaylist(key: string, organisation: string, code: string, name: string, items: readonly ItemInput[]): CommandAnswer<{ playlist: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-545")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  if (!mutable(entitlement)) return refuse("ENTITLEMENT_NOT_ACTIVE");
  if (name.trim() === "") return refuse("FIELD_MISSING", "name");
  const checked = checkItems(s, items);
  if ("code" in checked) return refuse(checked.code, "items", checked.item);
  const id = playlistId(s);
  s.playlists.set(id, { id, service: code, name: name.trim(), revisions: [{ no: 1, createdAt: now(), items: checked.items }], archivedAt: null });
  return accept({ playlist: id });
}

/**
 * POST /playlists/{id}/revisions: the next revision with the whole item list, unless a playlist in use would be left
 * with nothing to play. Earlier revisions and their items are never changed, so a past period still reads the
 * revision it played.
 */
export function revisePlaylist(key: string, organisation: string, code: string, id: string, items: readonly ItemInput[]): CommandAnswer<{ revision: number }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-546")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  const playlist = s.playlists.get(id);
  if (playlist === undefined || playlist.service !== code) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  if (playlist.archivedAt !== null) return refuse("PLAYLIST_ARCHIVED");
  if (!mutable(entitlement)) return refuse("ENTITLEMENT_NOT_ACTIVE");
  const checked = checkItems(s, items);
  if ("code" in checked) return refuse(checked.code, "items", checked.item);
  if (inUse(s, entitlement, id) && !checked.items.some((item) => playable(s, item))) return refuse("PLAYLIST_IN_USE_WOULD_BE_EMPTY", "items");
  const no = current(playlist).no + 1;
  playlist.revisions.push({ no, createdAt: now(), items: checked.items });
  return accept({ revision: no });
}

/**
 * POST /schedules: DR-255 rows in order, then the replaced schedule, which must still be in force. The replaced one
 * stays ACTIVE until the new one takes effect (SM-237 transition 2, applied on read).
 */
export function saveSchedule(key: string, organisation: string, code: string, input: ScheduleInput): CommandAnswer<{ schedule: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-551")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  if (!mutable(entitlement)) return refuse("ENTITLEMENT_NOT_ACTIVE");
  const playlist = s.playlists.get(input.playlist);
  if (playlist === undefined || playlist.service !== code) return refuse("NOT_AUTHORISED_FOR_PREMISES", "playlist");
  const status = statusOf(s, playlist);
  if (status === "NO_ELIGIBLE_TRACK") return refuse("PLAYLIST_NO_ELIGIBLE_TRACK", "playlist");
  if (status === "ARCHIVED") return refuse("PLAYLIST_ARCHIVED", "playlist");
  // The period runs from the start up to, not including, the end, within one local day; 24:00 is the day's end (A8).
  const end = input.end === "24:00" ? 24 * 60 : isTime(input.end) ? minutes(input.end) : -1;
  if (!isTime(input.start) || end <= minutes(input.start)) return refuse("INVALID_TIME_RANGE", "end");
  if (input.days.length === 0) return refuse("NO_DAYS", "days");
  const day = today();
  const from = input.from ?? day;
  if (from < day) return refuse("EFFECTIVE_FROM_IN_PAST", "from");
  if (input.to !== null && input.to <= from) return refuse("INVALID_TIME_RANGE", "end");
  const replaced = input.replaces === null ? null : (s.schedules.get(input.replaces) ?? null);
  if (input.replaces !== null && (replaced === null || replaced.service !== code || replaced.status !== "ACTIVE")) return refuse("SCHEDULE_NOT_ACTIVE", "replaces");
  let id = reference("SCH");
  while (s.schedules.has(id)) id = reference("SCH");
  s.schedules.set(id, {
    id,
    service: code,
    playlist: input.playlist,
    days: [...new Set(input.days)].sort(),
    start: input.start,
    end: input.end,
    effectiveFrom: from,
    effectiveTo: input.to,
    createdAt: now(),
    status: "ACTIVE",
    withdrawnAt: null,
    supersedes: replaced?.id ?? null,
  });
  return accept({ schedule: id });
}

/** POST /schedules/{id}/withdraw, the reason kept in the module audit log. */
export function withdrawSchedule(key: string, organisation: string, code: string, id: string, reason: string): CommandAnswer<{ schedule: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-552")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s } = found;
  const schedule = s.schedules.get(id);
  if (schedule === undefined || schedule.service !== code) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  if (schedule.status !== "ACTIVE") return refuse("SCHEDULE_NOT_ACTIVE");
  schedule.status = "WITHDRAWN";
  schedule.withdrawnAt = now();
  if (reason.trim() !== "") s.audit.push({ at: schedule.withdrawnAt, act: "SCHEDULE_WITHDRAWN", subject: id, reason: reason.trim() });
  return accept({ schedule: id });
}

/**
 * POST /service-entitlements/{id}/endings: DR-254 for a premises' request. A second request while one waits is a
 * duplicate (ALREADY_ENDED); the state changes only when the ending falls due. NTF-VEN-03, keyed by the ending,
 * confirms the effective date to the premises' party before it takes effect, and to the delegate who asked where a
 * delegate did, at the address they sign in with (frd/08).
 */
export function requestEnding(key: string, organisation: string, account: string, code: string, date: string | null, reason: string): CommandAnswer<{ effectiveAt: string }> {
  const found = visible(key, organisation, code);
  if (found === null || !mayActFor(key, found.entitlement.premisesId, "PERM-541")) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const { s, entitlement } = found;
  if (ended(entitlement)) return refuse("ALREADY_ENDED");
  const earliest = earliestEnd();
  const on = date ?? earliest;
  if (!isDate(on) || on < earliest) return refuse("EFFECTIVE_DATE_BEFORE_POLICY", "requested_effective_date");
  const at = now();
  const effectiveAt = instantOf(on, "00:00");
  const id = reference("END");
  entitlement.endings.unshift({
    id,
    cause: "PREMISES_REQUEST",
    effectiveAt,
    requestedBy: account,
    requestedAt: at,
    applied: false,
    scopeExit: null,
    supersededBy: null,
    operations: false,
  });
  entitlement.history.unshift(historyRow(at, null, entitlement.status, "ENDING_REQUESTED", { kind: "PERSON", name: account, operations: false }, { endingFrom: on }));
  if (reason.trim() !== "") s.audit.push({ at, act: "ENDING_REQUESTED", subject: code, reason: reason.trim() });
  raiseNotice(key, s, entitlement, "service_entitlement_ending", id, { by: on, requestedBy: account });
  const requester = sessions().get(key)?.email ?? null;
  if (actingAs(key)?.actor === "DELEGATE" && requester !== null) {
    raiseNotice(key, s, entitlement, "service_entitlement_ending", `${id}/requester`, { by: on, requestedBy: account }, requester);
  }
  return accept({ effectiveAt });
}

// ---------------------------------------------------------------- the operations console (SCR-VEN-12 to 16)

/** The SM-10 states the register filters by. */
const STATES: readonly EntitlementStatus[] = ["PENDING_TERMS", "ACTIVE", "SUSPENDED", "RESTRICTED", "REVOKED", "ENDED_AT_REQUEST", "ENDED_OUT_OF_SCOPE"];

/** DR-252 row 5: a suspension or restriction needs an active service; a revocation one active, suspended or restricted. */
function enforceable(status: EntitlementStatus, action: EnforcementKind): boolean {
  return status === "ACTIVE" || (action === "REVOKE" && (status === "SUSPENDED" || status === "RESTRICTED"));
}

/** The party a premises belongs to, the recipient of a notice about its service. */
const partyOf = (premisesId: string) => PREMISES.find((premises) => premises.id === premisesId)?.party ?? null;

function caseHead(key: string, entitlement: Entitlement): CaseHead {
  return {
    ...head(entitlement, premisesRef(key, entitlement.premisesId)),
    since: entitlement.history[0]?.at ?? entitlement.enrolledAt,
    classification: entitlement.classification,
    enrolledAt: entitlement.enrolledAt,
    classConfirmedAt: entitlement.classConfirmedAt,
  };
}

function caseAction(entitlement: Entitlement, action: Action): CaseAction {
  const lifted = entitlement.reinstatements.find((reinstatement) => reinstatement.action === action.id);
  return {
    id: action.id,
    action: action.action,
    ground: groundOf(action.ground)?.words ?? { vi: action.ground, en: action.ground },
    policy: ENFORCEMENT_POLICY.title,
    decidedBy: action.decidedBy,
    effectiveAt: action.effectiveAt,
    applied: action.applied,
    notice: action.notice,
    remedy: action.remedy,
    conditions: action.conditions.map((condition) => ({
      code: condition.code,
      text: condition.text,
      evidence: lifted?.conditionsMet.find((met) => met.code === condition.code)?.evidence ?? null,
    })),
  };
}

/** GET /service-entitlements as the register reads it (PERM-537, ACT-OPS): every service, latest enrolment first, a page at a time. */
export function register(key: string, staff: Staff, filter: RegisterFilter, cursor: string | null = null): LoadOutcome<Register> {
  if (!holds(staff, "ACT-OPS")) return refusedRead("NOT_AUTHORISED");
  const s = state(key);
  const all = [...s.entitlements.values()].sort((a, b) => newestFirst(a.enrolledAt, b.enrolledAt));
  const premisesOptions = [...new Set(all.map((entitlement) => entitlement.premisesId))].map((id) => premisesRef(key, id));
  // CURSOR_INVALID also answers a status outside the SM-10 set (srs/02).
  if (filter.status !== null && !STATES.includes(filter.status as EntitlementStatus)) return ok({ rows: [], premisesOptions, total: all.length, matching: 0, refusal: "CURSOR_INVALID", paging: { from: 0, to: 0, next: null, previous: null, refused: null } });
  const rows = all
    .filter((entitlement) => (filter.status === null || entitlement.status === filter.status) && (filter.premises === null || entitlement.premisesId === filter.premises))
    .map((entitlement) => ({
      ...head(entitlement, premisesRef(key, entitlement.premisesId)),
      classification: entitlement.classification,
      enrolledAt: entitlement.enrolledAt,
      endedAt: entitlement.endedAt,
    }));
  const page = paged(rows, cursor, `register/${filter.status ?? ""}/${filter.premises ?? ""}`);
  return ok({ rows: page.items, premisesOptions, total: all.length, matching: rows.length, refusal: null, paging: page.paging });
}

/**
 * SCR-VEN-13: GET /service-entitlements/{id} with its whole case file (PERM-538: operations and evidence), the periods
 * of the week asked (PERM-554) and the fallbacks (PERM-556). The screen gives both of those to operations alone and
 * says so to an evidence reader, as its specification and board draw it.
 */
export function caseFile(key: string, staff: Staff, code: string, week: WeekQuery | null, cursor: string | null = null): LoadOutcome<CaseFile> {
  if (!holds(staff, "ACT-OPS", "ACT-EVD")) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const operations = holds(staff, "ACT-OPS");
  const status = entitlement.status;
  return ok({
    head: caseHead(key, entitlement),
    actions: entitlement.actions.map((action) => caseAction(entitlement, action)),
    reinstatements: entitlement.reinstatements.map((reinstatement) => {
      const action = entitlement.actions.find((candidate) => candidate.id === reinstatement.action);
      return {
        id: reinstatement.id,
        lifted: { action: action?.action ?? "SUSPEND", effectiveAt: action?.effectiveAt ?? reinstatement.effectiveAt },
        conditionsMet: reinstatement.conditionsMet,
        by: reinstatement.by,
        effectiveAt: reinstatement.effectiveAt,
      };
    }),
    endings: entitlement.endings.map((ending) => ({
      id: ending.id,
      cause: ending.cause,
      effectiveAt: ending.effectiveAt,
      applied: ending.applied,
      requestedBy: ending.requestedBy,
      requestedAt: ending.requestedAt,
      scopeExit: ending.scopeExit,
      superseded: ending.supersededBy !== null,
    })),
    terms:
      entitlement.terms === null
        ? null
        : { version: entitlement.terms.version, acceptedBy: entitlement.terms.acceptedBy, actingFor: entitlement.terms.actingFor, acceptedAt: entitlement.terms.acceptedAt, digest: entitlement.terms.digest },
    history: entitlement.history,
    periods: operations
      ? { withheld: false, week: week ?? { from: "", to: "", asOf: nowLocal() }, resolution: week === null ? null : resolveWeek(s, entitlement, week) }
      : { withheld: true },
    fallbacks: operations ? { withheld: false, ...paged(fallbackRows(s, code), cursor, `fallbacks/${code}`) } : { withheld: true },
    acts: {
      enforce: enforceable(status, "REVOKE") ? null : "STATE_NOT_ENFORCEABLE",
      reinstate: status === "SUSPENDED" || status === "RESTRICTED" ? null : "NOT_REINSTATABLE",
      exit: TERMINAL.includes(status) ? "ALREADY_ENDED" : null,
    },
  });
}

/** GOV's `GET /governance/rules/VEN-ENFORCEMENT/effective` at an instant: the version in force, or none. */
function policyAt(instant: string) {
  return local(instant).date >= ENFORCEMENT_POLICY.effectiveFrom ? ENFORCEMENT_POLICY : null;
}

/** SCR-VEN-14: the service as it stands, the policy in force, and the notices COM issued to the premises' party. */
export function enforcementStep(key: string, staff: Staff, code: string): LoadOutcome<EnforcementStep> {
  if (!holds(staff, "ACT-OPS")) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const party = partyOf(entitlement.premisesId);
  const policy = policyAt(now());
  return ok({
    head: { ...caseHead(key, entitlement), device: deviceSummary(key, entitlement.premisesId)?.id ?? null },
    policy: policy === null ? null : { name: policy.name, title: policy.title, version: policy.version, effectiveFrom: policy.effectiveFrom, grounds: policy.grounds },
    notices: party === null ? [] : (noticesTo(key, party).data ?? []).map((notice) => ({ reference: notice.reference, issuedAt: notice.issuedAt })),
  });
}

/**
 * Raises a notice through COM (`INoticeObligations.Raise`), keyed by the act's identifier, to the premises' party at
 * the address its record holds, or at the one given. COM answers with the notice it issued, or none when its policy in
 * force requires none for the event; none is EXC-VEN-06, kept in the module audit log, and the act stands.
 */
function raiseNotice(
  key: string,
  s: State,
  entitlement: Entitlement,
  eventKind: string,
  occurrence: string,
  facts: Readonly<Record<string, string>>,
  destination: string | null = null,
): string | null {
  const party = partyOf(entitlement.premisesId);
  const at = now();
  const notice = recordNoticeEvent(key, {
    sourceModule: "VEN",
    eventKind,
    occurrenceRef: occurrence,
    occurredAt: at,
    subjectKind: "service_entitlement",
    subjectRef: entitlement.code,
    recipientPartyId: party,
    destination,
    facts: { service: entitlement.code, by: facts.by ?? local(at).date, ...facts },
  });
  if (notice === null) s.audit.push({ at, act: "NOTICE_NOT_RAISED", subject: occurrence, reason: eventKind });
  return notice;
}

/**
 * POST /service-entitlements/{id}/enforcement-actions: the authority (SEC-254) and a time in the past first, as the
 * rule's note puts them outside the table, then DR-252 rows 2 to 6 in order. Recorded, the action takes the service
 * to its state at the effective time, at once when that is now.
 */
export function recordEnforcement(key: string, staff: Staff, code: string, input: EnforcementInput): CommandAnswer<{ effectiveAt: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return refuse("ENTITLEMENT_NOT_FOUND");
  // Now is the instant this command runs; only a time typed before the current minute is in the past.
  const effectiveAt = input.when === "NOW" ? now() : input.when === "AT" && input.effectiveAt !== "" ? localInstant(input.effectiveAt) : null;
  if (effectiveAt !== null && Date.parse(effectiveAt) < thisMinute()) return refuse("EFFECTIVE_AT_IN_PAST", "effective_at");
  const policy = policyAt(now());
  if (policy === null) return refuse("POLICY_NOT_APPROVED");
  const ground = policy.grounds.find((candidate) => candidate.code === input.ground);
  if (ground === undefined) return refuse("GROUND_NOT_LISTED", "ground_code");
  const action = (["SUSPEND", "RESTRICT", "REVOKE"] as const).find((candidate) => candidate === input.action);
  if (action === undefined || !ground.actions.includes(action)) return refuse("ACTION_NOT_PERMITTED_FOR_GROUND", "action");
  if (!enforceable(entitlement.status, action)) return refuse("STATE_NOT_ENFORCEABLE");
  const party = partyOf(entitlement.premisesId);
  const issued = party === null ? [] : (noticesTo(key, party).data ?? []).map((notice) => notice.reference);
  const conditions = input.conditions.filter((condition) => condition.code.trim() !== "" || condition.text.trim() !== "");
  const incomplete =
    input.remedy.trim() === "" ||
    (input.notice === "" ? !ground.notice : !issued.includes(input.notice)) ||
    (action !== "REVOKE" && (conditions.length === 0 || conditions.some((condition) => condition.code.trim() === "" || condition.text.trim() === "")));
  if (effectiveAt === null || incomplete) return refuse("RECORD_INCOMPLETE");
  const id = reference("ENF");
  const remedy = input.remedy.trim();
  const recorded: Action = {
    id,
    action,
    ground: ground.code,
    policyVersion: policy.version,
    decidedBy: staff.account,
    effectiveAt,
    notice: input.notice === "" ? null : input.notice,
    // A revocation has no route back: conditions sent with it are ignored (srs/02).
    remedy: { vi: remedy, en: remedy },
    conditions: action === "REVOKE" ? [] : conditions.map((condition) => ({ code: condition.code.trim(), text: { vi: condition.text.trim(), en: condition.text.trim() } })),
    recordedAt: now(),
    applied: false,
  };
  // NTF-VEN-02 carries what frd/08 lists: the action, the ground and its policy version, the remedy, the conditions.
  if (recorded.notice === null) {
    recorded.notice = raiseNotice(key, s, entitlement, "service_entitlement_enforced", id, {
      action,
      ground: ground.code,
      policyVersion: policy.version,
      effectiveAt,
      remedy,
      ...(recorded.conditions.length > 0 ? { conditions: recorded.conditions.map((condition) => condition.code).join(", ") } : {}),
      by: local(effectiveAt).date,
    });
  }
  entitlement.actions.unshift(recorded);
  if (notAfter(effectiveAt, now())) applyAction(entitlement, recorded);
  return accept({ effectiveAt });
}

/** SCR-VEN-15: the service, the latest action, the one a reinstatement lifts, and whether the state admits one. */
export function reinstatementStep(key: string, staff: Staff, code: string): LoadOutcome<ReinstatementStep> {
  if (!holds(staff, "ACT-OPS")) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const latest = entitlement.actions.find((action) => action.applied) ?? null;
  return ok({
    head: caseHead(key, entitlement),
    action: latest === null ? null : caseAction(entitlement, latest),
    refusal: entitlement.status === "SUSPENDED" || entitlement.status === "RESTRICTED" ? null : "NOT_REINSTATABLE",
    now: nowLocal(),
  });
}

/**
 * POST /service-entitlements/{id}/reinstatements: DR-253. Every condition of the latest action needs its evidence, and
 * the time lies between that action's effect and now; a reinstatement is recorded and applied at once (SM-10 t5).
 */
export function recordReinstatement(
  key: string,
  staff: Staff,
  code: string,
  input: { action: string; evidence: Readonly<Record<string, string>>; effectiveAt: string },
): CommandAnswer<{ effectiveAt: string }> {
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return refuse("ENTITLEMENT_NOT_FOUND");
  if (entitlement.status !== "SUSPENDED" && entitlement.status !== "RESTRICTED") return refuse("NOT_REINSTATABLE");
  const latest = entitlement.actions.find((action) => action.applied);
  const effectiveAt = localInstant(input.effectiveAt);
  const met = latest?.conditions.map((condition) => ({ code: condition.code, evidence: (input.evidence[condition.code] ?? "").trim() })) ?? [];
  if (
    latest === undefined ||
    latest.id !== input.action ||
    met.some((condition) => condition.evidence === "") ||
    effectiveAt === null ||
    Date.parse(effectiveAt) < minuteOf(latest.effectiveAt) ||
    !notAfter(effectiveAt, now())
  ) {
    return refuse("CONDITIONS_NOT_MET");
  }
  const id = reference("RIN");
  entitlement.reinstatements.unshift({ id, action: latest.id, conditionsMet: met, by: staff.account, effectiveAt, recordedAt: now() });
  entitlement.history.unshift(historyRow(effectiveAt, entitlement.status, "ACTIVE", "REINSTATEMENT", { kind: "PERSON", name: staff.account, operations: true }));
  entitlement.status = "ACTIVE";
  raiseNotice(key, s, entitlement, "service_entitlement_reinstated", id, { by: local(effectiveAt).date });
  return accept({ effectiveAt });
}

/** SCR-VEN-16: the service the exit is recorded against (PERM-538 grants legal the read), and whether it can be. */
export function scopeExitStep(key: string, staff: Staff, code: string): LoadOutcome<ScopeExitStep> {
  if (!holds(staff, "ACT-OPS", "ACT-LGL")) return refusedRead("ENTITLEMENT_NOT_FOUND");
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return refusedRead("ENTITLEMENT_NOT_FOUND");
  return ok({ head: caseHead(key, entitlement), refusal: TERMINAL.includes(entitlement.status) ? "ALREADY_ENDED" : null });
}

const FAMILY: Readonly<Record<string, ScopeFamily>> = { REG: "REGISTRATION", CER: "CERTIFICATE", PTY: "PREMISES" };

/** The detail an event of a family may carry (`cause_detail` paired with `cause_family`), or none. */
const detailOf = (family: ScopeFamily | undefined, detail: string): ScopeDetail | null => (family === undefined ? null : (SCOPE_DETAILS[family].find((candidate) => candidate === detail) ?? null));

/** The causing event is already on the service's record: a second record of one event (`uq_entitlement_endings__cause_event`). */
const recorded = (entitlement: Entitlement, family: ScopeFamily | undefined, event: string) =>
  entitlement.endings.some((ending) => ending.cause === "SCOPE_EXIT" && ending.scopeExit !== null && ending.scopeExit.family === family && ending.scopeExit.reference === event);

/**
 * DR-254 rows 5 and 3 for a scope exit whose cause is checked: a request ending pending at a later instant is replaced
 * (both stay on the record), the ending is recorded and applied at once when its instant has come, and NTF-VEN-04 is
 * raised. The causing event happened in REG, CER or PTY, so recording it also plays that family's answer from now on:
 * a premises out of scope is refused on re-enrolment (PREMISES_CLASS_OUT_OF_SCOPE), one whose operator changed or that
 * closed is no longer operated by the party. `by` is the person who recorded it; null for the consumer.
 */
function exitScope(
  key: string,
  s: State,
  entitlement: Entitlement,
  cause: { family: ScopeFamily; detail: ScopeDetail; event: string; evidence: string; effectiveAt: string },
  by: { name: string; operations: boolean } | null,
): void {
  const id = reference("END");
  for (const pending of entitlement.endings) {
    if (pending.cause === "PREMISES_REQUEST" && !pending.applied && pending.supersededBy === null && !notAfter(pending.effectiveAt, cause.effectiveAt)) pending.supersededBy = id;
  }
  const ending: Ending = {
    id,
    cause: "SCOPE_EXIT",
    effectiveAt: cause.effectiveAt,
    requestedBy: by?.name ?? null,
    requestedAt: now(),
    applied: false,
    scopeExit: { family: cause.family, event: cause.detail, reference: cause.event, evidence: cause.evidence },
    supersededBy: null,
    operations: by?.operations ?? false,
  };
  entitlement.endings.unshift(ending);
  const answer = s.scope.get(entitlement.premisesId);
  if (answer !== undefined) {
    if (cause.family === "PREMISES") answer.relationshipEffective = false;
    else answer.classInScope = false;
  }
  if (notAfter(cause.effectiveAt, now())) applyEnding(entitlement, ending);
  raiseNotice(key, s, entitlement, "service_entitlement_out_of_scope", id, { by: local(cause.effectiveAt).date });
}

/**
 * POST /service-entitlements/{id}/scope-exits: DR-254 row 4 first (a terminal service, or a second record of one
 * event), then the fields, then rows 5 and 3. A scope exit is not refused because another is pending: the first to
 * fall due ends the service and the later one finds it ended.
 */
export function recordScopeExit(key: string, staff: Staff, code: string, input: ScopeExitInput): CommandAnswer<{ effectiveAt: string }> {
  if (!holds(staff, "ACT-OPS", "ACT-LGL")) return refuse("NOT_AUTHORISED");
  const s = state(key);
  const entitlement = s.entitlements.get(code);
  if (entitlement === undefined) return refuse("ENTITLEMENT_NOT_FOUND");
  const family = FAMILY[input.family];
  if (TERMINAL.includes(entitlement.status) || recorded(entitlement, family, input.event.trim())) return refuse("ALREADY_ENDED");
  if (input.detail === "") return refuse("FIELD_MISSING", "detail");
  if (input.event.trim() === "") return refuse("FIELD_MISSING", "event");
  const effectiveAt = localInstant(input.effectiveAt);
  if (effectiveAt === null) return refuse("FIELD_MISSING", "effectiveAt");
  // A scope exit a person records carries its evidence (@AC-FR-VEN-021-03).
  if (input.evidence.trim() === "") return refuse("FIELD_MISSING", "evidence");
  const detail = detailOf(family, input.detail);
  if (family === undefined || detail === null) return refuse("CAUSE_NOT_RECOGNISED", "detail");
  // The history names an operations officer as RightOne operations; legal records it under its own name.
  exitScope(key, s, entitlement, { family, detail, event: input.event.trim(), evidence: input.evidence.trim(), effectiveAt }, { name: staff.account, operations: holds(staff, "ACT-OPS") });
  return accept({ effectiveAt });
}

// ---------------------------------------------------------------- content operations (SCR-VEN-17, 18)

function versionSummary(version: MoodVersion, day: string): MoodVersionSummary {
  return {
    id: version.id,
    no: version.no,
    state: versionState(version, day),
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    withdrawnReason: version.withdrawnReason,
  };
}

/** GET /shared-moods as content operations reads it (PERM-561): every mood with every version, filtered by state, a page at a time. */
export function moodLibrary(key: string, staff: Staff, filter: string | null, cursor: string | null = null): LoadOutcome<MoodLibrary> {
  if (!holds(staff, "ACT-MOD", "ACT-OPS")) return refusedRead("NOT_AUTHORISED");
  const s = state(key);
  if (filter !== null && !MOOD_VERSION_STATES.includes(filter as MoodVersionState)) return ok({ rows: [], refusal: "CURSOR_INVALID", paging: { from: 0, to: 0, next: null, previous: null, refused: null } });
  const day = today();
  const rows: MoodRow[] = s.moods
    .map((mood) => ({ id: mood.id, name: mood.name, owner: mood.owner, retiredAt: mood.retiredAt, versions: versionsOf(s, mood.id).map((version) => versionSummary(version, day)) }))
    .filter((mood) => filter === null || mood.versions.some((version) => version.state === filter));
  const page = paged(rows, cursor, `moods/${filter ?? ""}`);
  return ok({ rows: page.items, refusal: null, paging: page.paging });
}

/** The version in force or approved before this one, whose end approving this one sets (spine amendment A7). */
function versionBefore(s: State, version: MoodVersion): MoodVersion | null {
  return (
    versionsOf(s, version.mood).find(
      (candidate) =>
        candidate.id !== version.id && candidate.stored === "APPROVED" && candidate.effectiveFrom < version.effectiveFrom && (candidate.effectiveTo === null || candidate.effectiveTo >= version.effectiveFrom),
    ) ?? null
  );
}

const dayBefore = (date: string) => addDays(`${date}T12:00:00+07:00`, -1);

/** GET /shared-mood-versions/{id} (PERM-562): one version with its tracks, the mood's other versions, and what acting on it changes. */
export function moodVersion(key: string, staff: Staff, id: string): LoadOutcome<MoodVersionView> {
  if (!holds(staff, "ACT-MOD", "ACT-OPS")) return refusedRead("VERSION_NOT_FOUND");
  const s = state(key);
  const version = s.versions.get(id);
  const mood = version === undefined ? null : moodOf(s, version.mood);
  if (version === undefined || mood === null) return refusedRead("VERSION_NOT_FOUND");
  const day = today();
  const before = version.stored === "DRAFT" ? versionBefore(s, version) : null;
  // The version whose end this approved one set, while it has not yet taken effect.
  const cut =
    versionState(version, day) === "APPROVED"
      ? (versionsOf(s, version.mood).find((candidate) => candidate.id !== version.id && candidate.effectiveTo === dayBefore(version.effectiveFrom)) ?? null)
      : null;
  return ok({
    mood: { id: mood.id, name: mood.name, owner: mood.owner, retiredAt: mood.retiredAt },
    version: { ...versionSummary(version, day), preparedBy: version.preparedBy, preparedAt: version.preparedAt, approvedBy: version.approvedBy, approvedAt: version.approvedAt },
    tracks: version.tracks.map((entry, index) => {
      const track = trackOf(entry.track);
      return {
        id: entry.track,
        title: track?.title ?? entry.track,
        by: track?.by ?? "",
        position: index + 1,
        admittedAt: entry.admittedAt,
        droppedAt: entry.droppedAt,
        eligible: eligibleNow(entry.track),
      };
    }),
    versions: versionsOf(s, version.mood).map((candidate) => versionSummary(candidate, day)),
    ends: before === null ? null : { no: before.no, on: dayBefore(version.effectiveFrom) },
    clears: cut === null ? null : { no: cut.no },
    preparedByReader: version.preparedBy === staff.account,
  });
}

/** CAT's eligible-track read for a mood: tracks eligible under the direct licence now. */
export function moodTrackSearch(staff: Staff, query: string): LoadOutcome<readonly TrackOption[]> {
  if (!holds(staff, "ACT-MOD")) return refusedRead("NOT_AUTHORISED");
  return ok(eligibleTracks(query));
}

/** DR-256 row 3 at preparation: every track is eligible when it is added; the first that is not is named. */
function checkTracks(tracks: readonly string[]): { refusal: CommandAnswer<never> } | { tracks: string[] } {
  if (tracks.length === 0) return { refusal: refuse("FIELD_MISSING", "tracks") };
  const unknown = tracks.findIndex((id) => !eligibleNow(id));
  if (unknown >= 0) return { refusal: refuse("TRACK_NOT_ELIGIBLE", "tracks", unknown) };
  return { tracks: [...tracks] };
}

function draft(s: State, staff: Staff, mood: string, no: number, effectiveFrom: string, tracks: readonly string[]): string {
  let id = reference("SMV");
  while (s.versions.has(id)) id = reference("SMV");
  const at = now();
  s.versions.set(id, {
    id,
    mood,
    no,
    stored: "DRAFT",
    effectiveFrom,
    effectiveTo: null,
    preparedBy: staff.account,
    preparedAt: at,
    approvedBy: null,
    approvedAt: null,
    withdrawnReason: null,
    withdrawnAt: null,
    tracks: tracks.map((track) => ({ track, admittedAt: at, droppedAt: null })),
  });
  return id;
}

/** POST /shared-moods (PERM-557, the moderator): the mood and its version 1 as a draft. */
export function createMood(key: string, staff: Staff, input: { name: string; owner: string; effectiveFrom: string; tracks: readonly string[] }): CommandAnswer<{ version: string }> {
  if (!holds(staff, "ACT-MOD")) return refuse("NOT_AUTHORISED");
  const s = state(key);
  if (input.name.trim() === "") return refuse("FIELD_MISSING", "name");
  if (input.owner !== "SERVICE_OWNER") return refuse("FIELD_MISSING", "owner_role");
  if (!isDate(input.effectiveFrom)) return refuse("FIELD_MISSING", "effective_from");
  const checked = checkTracks(input.tracks);
  if ("refusal" in checked) return checked.refusal;
  let id = reference("MOD");
  while (s.moods.some((mood) => mood.id === id)) id = reference("MOD");
  s.moods.unshift({ id, name: input.name.trim(), owner: "SERVICE_OWNER", retiredAt: null });
  return accept({ version: draft(s, staff, id, 1, input.effectiveFrom, checked.tracks) });
}

/** POST /shared-moods/{id}/versions (PERM-558, the moderator): the next version as a draft, unless the mood is retired. */
export function prepareMoodVersion(key: string, staff: Staff, moodId: string, input: { effectiveFrom: string; tracks: readonly string[] }): CommandAnswer<{ version: string }> {
  if (!holds(staff, "ACT-MOD")) return refuse("NOT_AUTHORISED");
  const s = state(key);
  const mood = moodOf(s, moodId);
  if (mood === null) return refuse("VERSION_NOT_FOUND");
  if (mood.retiredAt !== null) return refuse("MOOD_RETIRED");
  if (!isDate(input.effectiveFrom)) return refuse("FIELD_MISSING", "effective_from");
  const checked = checkTracks(input.tracks);
  if ("refusal" in checked) return checked.refusal;
  const next = Math.max(0, ...versionsOf(s, moodId).map((version) => version.no)) + 1;
  return accept({ version: draft(s, staff, moodId, next, input.effectiveFrom, checked.tracks) });
}

/**
 * POST /shared-mood-versions/{id}/approve (PERM-559): operations, never the person who prepared it (R4.3), a draft,
 * an eligible track left, a start not before today and no overlap with a version approved, in effect or superseded.
 * A track no longer eligible is dropped now (DR-256), and the version before it ends the day before this one starts.
 */
export function approveMoodVersion(key: string, staff: Staff, id: string): CommandAnswer<{ state: MoodVersionState }> {
  if (!holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const s = state(key);
  const version = s.versions.get(id);
  if (version === undefined) return refuse("VERSION_NOT_FOUND");
  if (version.stored !== "DRAFT") return refuse("VERSION_NOT_DRAFT");
  if (version.preparedBy === staff.account) return refuse("NOT_AUTHORISED");
  if (!version.tracks.some((entry) => entry.droppedAt === null && eligibleNow(entry.track))) return refuse("VERSION_HAS_NO_ELIGIBLE_TRACK");
  if (version.effectiveFrom < today()) return refuse("EFFECTIVE_FROM_IN_PAST");
  const overlaps = versionsOf(s, version.mood).some(
    (other) => other.id !== version.id && other.stored === "APPROVED" && (other.effectiveFrom >= version.effectiveFrom || (other.effectiveTo !== null && other.effectiveTo >= version.effectiveFrom && versionState(other, today()) === "SUPERSEDED")),
  );
  if (overlaps) return refuse("RANGE_OVERLAP");
  const at = now();
  for (const entry of version.tracks) if (entry.droppedAt === null && !eligibleNow(entry.track)) entry.droppedAt = at;
  const before = versionBefore(s, version);
  if (before !== null) before.effectiveTo = dayBefore(version.effectiveFrom);
  version.stored = "APPROVED";
  version.approvedBy = staff.account;
  version.approvedAt = at;
  return accept({ state: versionState(version, today()) });
}

/**
 * POST /shared-mood-versions/{id}/withdraw (PERM-560): the moderator withdraws a draft, operations an approved or
 * effective version, always with a reason. Withdrawn before it took effect, it gives back the end it set.
 */
export function withdrawMoodVersion(key: string, staff: Staff, id: string, reason: string): CommandAnswer<{ state: MoodVersionState }> {
  const s = state(key);
  const version = s.versions.get(id);
  if (version === undefined) return refuse("VERSION_NOT_FOUND");
  const current = versionState(version, today());
  if (current === "SUPERSEDED" || current === "WITHDRAWN") return refuse("VERSION_NOT_WITHDRAWABLE");
  if (current === "DRAFT" ? !holds(staff, "ACT-MOD") : !holds(staff, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  if (reason.trim() === "") return refuse("FIELD_MISSING", "reason");
  if (current === "APPROVED") {
    const cut = versionsOf(s, version.mood).find((candidate) => candidate.id !== version.id && candidate.effectiveTo === dayBefore(version.effectiveFrom));
    if (cut !== undefined) cut.effectiveTo = null;
  }
  // Withdrawn while in effect, it was in effect up to today; the record keeps that period.
  if (current === "EFFECTIVE") version.effectiveTo = today();
  version.stored = "WITHDRAWN";
  version.withdrawnAt = now();
  version.withdrawnReason = { vi: reason.trim(), en: reason.trim() };
  return accept({ state: "WITHDRAWN" });
}

// ---------------------------------------------------------------- what other families read

/*
 * The service as PLR reads it in process: IScheduleResolver for the period a device is playing in, and the public
 * status the guest view's "Verify this venue" and PLR's delivery read (IServiceEntitlementReader.PublicStatus).
 */

/** The non-terminal service of a premises, else its latest one; null when it never enrolled. */
export function servicePublicStatus(key: string, premisesId: string): { code: string; status: EntitlementStatus } | null {
  const s = state(key);
  const all = [...s.entitlements.values()].filter((entitlement) => entitlement.premisesId === premisesId).sort((a, b) => newestFirst(a.enrolledAt, b.enrolledAt));
  const current = all.find((entitlement) => !TERMINAL.includes(entitlement.status)) ?? all[0];
  return current === undefined ? null : { code: current.code, status: current.status };
}

/** The public reference of the current verification document of a premises' service, the one its QR code verifies. */
export function currentDocument(key: string, premisesId: string): string | null {
  const status = servicePublicStatus(key, premisesId);
  return status === null ? null : (state(key).entitlements.get(status.code)?.document ?? null);
}

/** DR-15 at one instant for a premises: the period it falls in, or null without a non-terminal service. */
export function periodAt(key: string, premisesId: string, instant: string): ResolvedPeriod | null {
  const s = state(key);
  const entitlement = [...s.entitlements.values()].find((candidate) => candidate.premisesId === premisesId && !TERMINAL.includes(candidate.status));
  if (entitlement === undefined) return null;
  const when = local(instant);
  return resolveDay(s, entitlement, when.date, instant).find((period) => minutes(period.start) <= minutes(when.time) && minutes(when.time) < minutes(period.end)) ?? null;
}

/**
 * PUB's Player route (SCR-PUB-06) asks VEN for the service a verification document names: the service of the
 * document with this public reference, while it is the service's current document (each new document replaces the
 * one before it), with its status now; null for any other reference, so an unknown and a replaced document answer
 * alike. The printed code's tag is checked by PUB before it asks.
 */
export function entitlementForDocument(key: string, publicReference: string): { code: string; status: EntitlementStatus; premisesId: string; premisesName: string } | null {
  const s = state(key);
  const document = s.documents.get(publicReference);
  const entitlement = document === undefined ? undefined : s.entitlements.get(document.service);
  if (entitlement === undefined || entitlement.document !== publicReference) return null;
  return { code: entitlement.code, status: entitlement.status, premisesId: entitlement.premisesId, premisesName: premisesName(key, entitlement.premisesId) ?? entitlement.premisesId };
}

/** A premises a track change reaches, as COM's run records it: the playlists and the schedules that held the track. */
export interface TrackHolder {
  premisesId: string;
  party: string | null;
  playlists: readonly { id: string; name: string }[];
  schedules: readonly { id: string; playlist: string; days: readonly number[]; start: string; end: string }[];
}

/**
 * COM's track-change run (ALG-114 step 2, FR-COM-015) asks VEN which premises held a track when CAT recorded a change
 * to it: every service enrolled by that instant and not ended before it, with each playlist that held the track then -
 * as an item, or through the version in effect of a shared mood it places - and each schedule in force that day which
 * plays one of those playlists. The track is named as CAT's read names it, null for a track the catalogue does not
 * hold. A premises holding the track nowhere is not returned; the set is read once, at the instant asked.
 */
export function premisesHoldingTrack(key: string, trackRef: string, at: string): { track: { title: string; by: string } | null; holders: readonly TrackHolder[] } {
  // Read without the sweep: COM asks from inside its own run, and the sweep raises notices through COM.
  const s = settled(key);
  const day = local(at).date;
  const inMood = (mood: string) =>
    versionsOf(s, mood).some(
      (version) =>
        versionState(version, day) === "EFFECTIVE" &&
        version.tracks.some((entry) => entry.track === trackRef && notAfter(entry.admittedAt, at) && (entry.droppedAt === null || !notAfter(entry.droppedAt, at))),
    );
  const holding = (playlist: Playlist) =>
    (playlist.archivedAt === null || !notAfter(playlist.archivedAt, at)) && (revisionAt(playlist, at)?.items ?? []).some((item) => (item.kind === "TRACK" ? item.ref === trackRef : inMood(item.ref)));
  const inForce = (all: readonly Schedule[], schedule: Schedule) => {
    if (!notAfter(schedule.createdAt, at) || day < schedule.effectiveFrom || (schedule.effectiveTo !== null && day >= schedule.effectiveTo)) return false;
    if (schedule.withdrawnAt !== null && notAfter(schedule.withdrawnAt, at)) return false;
    const successor = all.find((candidate) => candidate.supersedes === schedule.id && notAfter(candidate.createdAt, at));
    return successor === undefined || day < successor.effectiveFrom;
  };
  const holders = [...s.entitlements.values()]
    .filter((entitlement) => notAfter(entitlement.enrolledAt, at) && (entitlement.endedAt === null || !notAfter(entitlement.endedAt, at)))
    .map((entitlement): TrackHolder => {
      const playlists = playlistsOf(s, entitlement.code).filter(holding);
      const all = [...s.schedules.values()].filter((schedule) => schedule.service === entitlement.code);
      const schedules = all
        .filter((schedule) => inForce(all, schedule) && playlists.some((playlist) => playlist.id === schedule.playlist))
        .map((schedule) => ({ id: schedule.id, playlist: s.playlists.get(schedule.playlist)?.name ?? schedule.playlist, days: schedule.days, start: schedule.start, end: schedule.end }));
      return { premisesId: entitlement.premisesId, party: partyOf(entitlement.premisesId), playlists: playlists.map((playlist) => ({ id: playlist.id, name: playlist.name })), schedules };
    })
    .filter((holder) => holder.playlists.length > 0);
  const track = trackOf(trackRef);
  return { track: track === null ? null : { title: track.title, by: track.by }, holders };
}
