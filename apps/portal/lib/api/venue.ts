import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import type { CredentialState } from "./player";
import type { Staff } from "./session";
import {
  approveMoodVersion,
  archivePlaylist,
  caseFile,
  createMood,
  createPlaylist,
  defaultPlaylistSet,
  documentFile,
  documentStep,
  endingStep,
  enforcementStep,
  enrolForm,
  enrolPremises,
  fallbackList,
  issueDocument,
  moodLibrary,
  moodTrackSearch,
  moodVersion,
  playlistEditor,
  playlistList,
  prepareMoodVersion,
  recordEnforcement,
  recordReinstatement,
  recordScopeExit,
  register,
  reinstatementStep,
  requestEnding,
  revisePlaylist,
  saveSchedule,
  scheduleStep,
  scopeExitStep,
  serviceList,
  servicePublicStatus,
  serviceRecord,
  serviceView,
  acceptTerms,
  termsStep,
  trackSearch,
  withdrawMoodVersion,
  withdrawSchedule,
} from "@/lib/mock/backend/venue";
import {
  deviceCredentialState,
  deviceList,
  issuePairing,
  nowPlaying,
  pairingStep,
  revokePairing,
  venueView,
} from "@/lib/mock/backend/player";
import { legalDocument } from "@/lib/mock/backend/public";
import { reviewOutcome, TERMS, type VenueView } from "@/lib/mock/venue";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * RightOne Player for the premises: the service entitlement and what plays (VEN), the device as the venue sees it and
 * the guest's now-playing view (PLR), and the pairing authorisation a device is set up with (IAM). Each loader is one
 * screen's read for the signed-in session, scoped to the party it acts for; given a review view it answers the state
 * a board drew instead. A refusal is a failure with its code, never an empty answer. Each command answers whether
 * RightOne accepted the act, with the refusal code of the family's `design/04-refusal-codes.md` when it did not.
 */

/** Words a person at RightOne wrote about one case - an enforcement ground, a remedy - in each language read. */
export type CaseText = Readonly<Record<Locale, string>>;

export interface PremisesRef {
  id: string;
  name: string;
}

/** The person reading, and the party they act for: every read and act is scoped to it. */
export interface Reader {
  sessionId: string;
  party: string;
  /** The organisation's id at RightOne ID, the key the premises are held under. */
  organisation: string;
  account: string;
}

/** SM-10, the service entitlement's states. */
export type EntitlementStatus =
  | "PENDING_TERMS"
  | "ACTIVE"
  | "SUSPENDED"
  | "RESTRICTED"
  | "REVOKED"
  | "ENDED_AT_REQUEST"
  | "ENDED_OUT_OF_SCOPE";

export const TERMINAL: readonly EntitlementStatus[] = ["REVOKED", "ENDED_AT_REQUEST", "ENDED_OUT_OF_SCOPE"];

/**
 * Where one page of a list stands (convention 11): the positions of its rows, from 1, and the opaque cursors of the
 * next and the previous page. A cursor the read did not issue - tampered with, or issued for another list or filter -
 * is refused CURSOR_INVALID, and the first page is answered with the refusal, so the page offers to reload from the
 * start. Twenty-five rows a page.
 */
export interface Paging {
  /** 0 and 0 for an empty page. */
  from: number;
  to: number;
  /** Null on the last page. */
  next: string | null;
  /** Null on the first page; empty when the previous page is the first, which needs no cursor. */
  previous: string | null;
  refused: "CURSOR_INVALID" | null;
}

/** A service as a screen header names it: its code, premises and state. */
export interface ServiceHead {
  code: string;
  premises: PremisesRef;
  status: EntitlementStatus;
}

// ---------------------------------------------------------------- SCR-VEN-03

export interface ServiceSummary extends ServiceHead {
  /** Activated for an active service, enrolled while awaiting terms, ended once ended (the spec's Since). */
  since: string;
}

export interface ServiceList {
  items: readonly ServiceSummary[];
  paging: Paging;
}

// ---------------------------------------------------------------- SCR-VEN-01

export interface EnrolForm {
  party: string;
  /** The premises PTY records the person may act for, with the ward where the register gives one. */
  premises: readonly (PremisesRef & { area: string | null })[];
}

/** What the enrolment answered, kept for the page it was asked on. */
export interface EnrolAttempt {
  page: "enrol";
  premisesId: string;
  code: string;
}

// ---------------------------------------------------------------- SCR-VEN-04

export type HistoryCause = "ENROLMENT" | "TERMS_ACCEPTED" | "ENFORCEMENT" | "REINSTATEMENT" | "ENDING_REQUESTED" | "ENDING" | "SCOPE_EXIT";

/** Who recorded a change: a person by name (with the gateway role when it is RightOne's), or RightOne's schedule. */
export type RecordedBy = { kind: "PERSON"; name: string; operations: boolean } | { kind: "SYSTEM" };

export interface HistoryRow {
  at: string;
  /** Null for the enrolment and for a request that changes no state yet. */
  from: EntitlementStatus | null;
  to: EntitlementStatus;
  cause: HistoryCause;
  recordedBy: RecordedBy;
  /** The terms version an acceptance names. */
  termsVersion: string | null;
  /** The date a requested ending takes effect from. */
  endingFrom: string | null;
}

export interface Enforcement {
  kind: "SUSPENDED" | "RESTRICTED" | "REVOKED";
  ground: CaseText;
  /** The enforcement policy version the ground is read from. */
  policy: CaseText;
  effectiveAt: string;
  remedy: CaseText | null;
  conditions: readonly CaseText[];
}

export interface Ending {
  cause: "PREMISES_REQUEST" | "SCOPE_EXIT";
  effectiveAt: string;
  requestedBy: string | null;
  requestedAt: string | null;
  /** The state changed at the effective instant; a pending ending has not. */
  applied: boolean;
  /** A scope exit: the causing family and event, and the reference of the record that caused it. */
  scopeExit: { family: ScopeFamily; event: ScopeDetail; reference: string } | null;
}

/** The three enforcement actions (`player.enforcement_actions.action`). */
export type EnforcementKind = "SUSPEND" | "RESTRICT" | "REVOKE";

/** The family whose event takes a premises out of the scope (`cause_family`: REG, CER, PTY), and its detail. */
export type ScopeFamily = "REGISTRATION" | "CERTIFICATE" | "PREMISES";
export type ScopeDetail = "OBLIGATION_REDECIDED" | "CERTIFICATE_STATUS" | "CLOSURE" | "OPERATOR_CHANGE" | "CESSATION";

/** Which details pair with which family (SCR-VEN-16, CAUSE_NOT_RECOGNISED). */
export const SCOPE_DETAILS: Readonly<Record<ScopeFamily, readonly ScopeDetail[]>> = {
  REGISTRATION: ["OBLIGATION_REDECIDED"],
  CERTIFICATE: ["CERTIFICATE_STATUS"],
  PREMISES: ["CLOSURE", "OPERATOR_CHANGE", "CESSATION"],
};

export interface ServiceRecord extends ServiceHead {
  /** The effective instant of the latest history row. */
  since: string;
  enrolledAt: string;
  /** The version accepted; `acceptedOn` is its day in Vietnam time, the day PUB's page shows that version for. */
  terms: { version: string; acceptedAt: string; acceptedOn: string; acceptedBy: string } | null;
  enforcement: Enforcement | null;
  ending: Ending | null;
  /** Newest first, every row kept, those before a terminal state included. */
  history: readonly HistoryRow[];
}

// ---------------------------------------------------------------- SCR-VEN-02

/** PUB's premises service terms in the version in effect: the request's terms_document_id and terms_version. */
export interface TermsDocument {
  version: string;
  documentId: string;
  effective: string;
  title: CaseText;
  sections: readonly { id: string; heading: CaseText; body: CaseText }[];
}

/** GET /schedule-rules/effective: the baseline that decides what plays, disclosed. */
export interface RulesDisclosure {
  version: string;
  effectiveFrom: string;
  timezone: string;
}

export interface TermsStep {
  service: ServiceHead & { enrolledAt: string };
  party: string;
  /** Null when PUB's read is unavailable: the page shows the error state and Accept stays unavailable. */
  terms: TermsDocument | null;
  /** The baseline, or its refusal (RULES_NOT_APPROVED) in place of the panel. */
  rules: { disclosure: RulesDisclosure; refusal: null } | { disclosure: null; refusal: string };
  /** A usable default playlist is set: the step the stepper marks done. */
  defaultSet: boolean;
}

export interface TermsAttempt {
  page: "terms";
  service: string;
  code: string;
  /** The tick as it was sent; TERMS_VERSION_SUPERSEDED clears it. */
  ticked: boolean;
}

// ---------------------------------------------------------------- SCR-VEN-05

export interface VerificationDocument {
  reference: string;
  /** The service it was issued for, by code. */
  service: string;
  premises: string;
  statusAtIssue: EntitlementStatus;
  issuedAt: string;
  format: "pdf" | "html";
  /** The `VEN-ENTITLEMENT-WORDING` version (CFG-16) it was issued under. */
  wordingVersion: string;
  /** When a newer document replaced it; PUB's page verifies only the current one. Null while it is current. */
  supersededAt: string | null;
  /** The code printed on the document (ALG-234): its reference, the key and the tag, which PUB's page verifies. */
  printedCode: string;
}

export interface DocumentStep {
  service: ServiceHead;
  /** The service's current document; null while none is issued (the governed empty). */
  document: VerificationDocument | null;
}

export interface DocumentAttempt {
  page: "document";
  service: string;
  code: string;
}

// ---------------------------------------------------------------- SCR-VEN-06 and 07

export type PlaylistStatus = "USABLE" | "NO_ELIGIBLE_TRACK" | "ARCHIVED";

export interface PlaylistRow {
  id: string;
  name: string;
  revision: number;
  status: PlaylistStatus;
  isDefault: boolean;
}

export interface PlaylistsStep {
  service: ServiceHead;
  defaultPlaylist: PlaylistRow | null;
  items: readonly PlaylistRow[];
  paging: Paging;
}

export interface PlaylistsAttempt {
  page: "playlists";
  service: string;
  playlist: string | null;
  code: string;
}

export type ItemKind = "TRACK" | "SHARED_MOOD";

/** An item as the editor holds it: what it is, and whether it can play at the request instant. */
export interface EditorItem {
  kind: ItemKind;
  /** The track or the shared mood, by id. */
  ref: string;
  title: string;
  /** The performer of a track; null for a shared mood, which reads "shared by RightOne". */
  by: string | null;
  eligible: boolean;
}

export interface PlaylistEditor {
  service: ServiceHead;
  /** Null for a new playlist. */
  playlist: { id: string; name: string; revision: number; status: PlaylistStatus; archivedOn: string | null } | null;
  items: readonly EditorItem[];
  /** GET /shared-moods with status EFFECTIVE. */
  moods: readonly { id: string; name: string }[];
}

export interface TrackResult {
  id: string;
  title: string;
  by: string;
}

export interface EditorAttempt {
  page: "editor";
  service: string;
  playlist: string | null;
  name: string;
  items: readonly EditorItem[];
  code: string;
  /** The item a refusal names, by position. */
  item: number | null;
}

// ---------------------------------------------------------------- SCR-VEN-08

export type ScheduleStatus = "ACTIVE" | "SUPERSEDED" | "WITHDRAWN";

export interface ScheduleRow {
  id: string;
  playlist: string;
  /** ISO weekdays, 1 Monday to 7 Sunday. */
  days: readonly number[];
  start: string;
  end: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  savedAt: string;
  status: ScheduleStatus;
  withdrawnAt: string | null;
  /** The saved day of the schedule it replaces. */
  replaces: string | null;
  /** The schedule's playlist has no eligible track now. */
  playlistUnusable: boolean;
}

export type PeriodOutcome = "SCHEDULED" | "DEFAULT_PLAYLIST" | "FALLBACK_MOOD" | "NO_PLAYABLE_SCHEDULE";
export type PeriodReason = "SCHEDULE_APPLIES" | "SCHEDULED_PLAYLIST_UNUSABLE" | "NO_SCHEDULE_MATCHES" | "DEFAULT_REPLACED_BY_MOOD" | "NO_PLAYABLE_CONTENT";

export interface ResolvedPeriod {
  date: string;
  start: string;
  end: string;
  outcome: PeriodOutcome;
  reason: PeriodReason;
  /** What plays, by name: the playlist, or the fallback mood (row 4); null when nothing can. */
  playlist: string | null;
  /** The playlist that plays, by id; null for the fallback mood and when nothing can. */
  playlistId: string | null;
  /** The latest-created schedule that applied, whatever the outcome; null when none did. */
  schedule: string | null;
  /** The schedule that lost: its playlist could not play (row 2). */
  lost: string | null;
  /** Another schedule overlapping part of this one, which the later-saved won: its playlist and the overlap. */
  overlap: { playlist: string; start: string; end: string } | null;
  /** The revision of the playlist that plays, the one in force when the period began as known at the as-at instant. */
  revision: number | null;
  /** The fallback mood's version that plays (row 4). */
  mood: { id: string; version: string; no: number } | null;
  ruleVersion: string;
}

export interface WeekQuery {
  from: string;
  to: string;
  /** The instant the result is worked out for, as typed (YYYY-MM-DDTHH:MM, Vietnam time); empty when cleared. */
  asOf: string;
}

export interface ScheduleStep {
  service: ServiceHead;
  /** The business day in Vietnam, the grid's current day. */
  today: string;
  defaultPlaylist: PlaylistRow | null;
  /** One page of the schedules, in precedence order (GET /schedules). */
  schedules: readonly ScheduleRow[];
  schedulesPaging: Paging;
  /** The schedules in force, every one of them, which Replaces offers. */
  replaceable: readonly ScheduleRow[];
  /** The playlists a schedule may name (status USABLE). */
  usable: readonly { id: string; name: string }[];
  week: WeekQuery;
  /** The resolved periods, or the refusal beside the week controls or in place of the week. */
  resolution: { periods: readonly ResolvedPeriod[]; refusal: null } | { periods: null; refusal: string };
  rules: RulesDisclosure | null;
}

export interface ScheduleAttempt {
  page: "schedule";
  service: string;
  values: { playlist: string; days: readonly number[]; start: string; end: string; from: string; to: string; replaces: string };
  code: string;
  field: "playlist" | "days" | "end" | "from" | "replaces" | null;
  /** A withdrawal refused beside its row. */
  schedule: string | null;
}

// ---------------------------------------------------------------- SCR-VEN-09

/** What a fallen-back period played instead: the outcome `DR-15` gave it. */
export type FallbackOutcome = "DEFAULT_PLAYLIST" | "FALLBACK_MOOD" | "NO_PLAYABLE_SCHEDULE";

/** One row of `player.schedule_fallbacks`, which the eligibility sweep writes and nobody edits. */
export interface FallbackRow {
  date: string;
  start: string;
  end: string;
  /** The schedule whose playlist could not play. */
  schedule: string;
  playlist: { id: string; name: string; archived: boolean };
  cause: "PLAYLIST_NO_ELIGIBLE_TRACK";
  resolvedTo: FallbackOutcome;
  detectedAt: string;
  /** The notice COM issued for it (NTF-VEN-01); null when none could be raised (EXC-VEN-06). */
  notice: string | null;
}

export interface FallbackList {
  service: ServiceHead;
  items: readonly FallbackRow[];
  paging: Paging;
}

// ---------------------------------------------------------------- SCR-VEN-10

export type Freshness = "CURRENT" | "STALE" | "UNAVAILABLE";

export interface ServiceViewData {
  asOf: string;
  service: ServiceHead & { activatedAt: string | null };
  /** PLR's read of the premises' device; null when no device is paired. */
  device: {
    id: string;
    freshness: Freshness;
    asAt: string;
    connection: "ONLINE" | "OFFLINE" | "STOPPED";
    playing: { title: string; by: string } | null;
  } | null;
  today: { date: string; periods: readonly ResolvedPeriod[] } | null;
  /** STA's governed figures for the last seven days. */
  activity: { freshness: Freshness; hours: number | null; plays: number | null; period: { from: string; to: string } | null; asAt: string | null };
}

// ---------------------------------------------------------------- SCR-VEN-11

export interface EndingStep {
  service: ServiceHead;
  /** The earliest date the ending policy allows (CFG-291: the day after the request). */
  earliest: string;
  /** Ended, or an ending already waiting: the form is unavailable (ALREADY_ENDED). */
  ended: boolean;
}

export interface EndingAttempt {
  page: "ending";
  service: string;
  date: string;
  reason: string;
  code: string;
}

// ---------------------------------------------------------------- SCR-PLR-04, 05, and the device list

/** STOPPED: nothing reaches the device, and `Delivery.stop` says why. PLR reports the other four. */
export type DeviceCondition = "ONLINE" | "OFFLINE" | "CEILING" | "LIMIT_REACHED" | "STOPPED";

/**
 * Why nothing reaches a device: its credential is held or revoked, or it holds none (IAM); or, while it is connected,
 * the premises' Player service is not ACTIVE (VEN), `status` null when the premises holds no service.
 */
export type DeliveryStop =
  | { cause: "DEVICE"; credential: Exclude<CredentialState, "ACTIVE"> | null }
  | { cause: "SERVICE"; status: Exclude<EntitlementStatus, "ACTIVE"> | null };

/** What the portal adds to a device's report: why delivery stopped, null while it reaches the device. */
export interface Delivery {
  stop: DeliveryStop | null;
}

export interface DeviceRow {
  id: string;
  name: string | null;
  premises: PremisesRef;
  condition: DeviceCondition;
  asOf: string;
}

export interface VenueViewData {
  device: { id: string; name: string | null };
  premises: PremisesRef;
  condition: DeviceCondition;
  asOf: string;
  evidence: { waiting: number; oldest: string | null; ceiling: number };
  offline: {
    limitHours: number;
    /** DR-218's source of the limit: the approved offline-continuity version in force when the session opened, or the snapshot's. */
    source: "policy" | "snapshot";
    /** The policy version applied; null for the snapshot's limit. */
    version: number | null;
    /** The policy's grace period, part of the limit; 0 for the snapshot's. */
    graceHours: number;
    /** Hours of offline playback left, against the limit. */
    remainingHours: number;
    lastContact: string;
    stopsAt: string;
    reachedAt: string | null;
  } | null;
  lastSynced: string | null;
  playing: { title: string; by: string; credits: Credits; period: { playlist: string; start: string; end: string } | null } | null;
}

// ---------------------------------------------------------------- SCR-PLR-06

export interface Credits {
  composer: string | null;
  lyricist: string | null;
  performer: string | null;
  producer: string | null;
}

export type SurfaceState = "available" | "unavailable";

export interface GuestViewData {
  /** What the guest display shows: the six device states it renders, as the guest sees them. */
  state: "PLAYING" | "PAUSED" | "OFFLINE" | "STOPPED" | "NOT_PAIRED";
  /** The premises name, never more about the premises (no address, operator or contact). */
  venue: string | null;
  track: { title: string; by: string; credits: Credits } | null;
  surfaces: { lyrics: SurfaceState; verification: SurfaceState; support: SurfaceState };
  /** The printed code of the premises' current verification document, which Verify this venue opens on PUB's page. */
  verification: { printedCode: string } | null;
}

// ---------------------------------------------------------------- SCR-IAM-06

export type PairingState = "ISSUED" | "CONSUMED" | "EXPIRED" | "REVOKED";

export interface PairingRow {
  id: string;
  premises: PremisesRef;
  purpose: "PLAYBACK";
  issuedAt: string;
  /** Who asked for it (`issued_by`): the principal, or a delegate inside the scope PTY records. */
  issuedBy: { name: string; actor: "PRINCIPAL" | "DELEGATE" };
  expiresAt: string;
  state: PairingState;
  consumedAt: string | null;
  device: { id: string; name: string | null } | null;
  revokedAt: string | null;
  reason: CaseText | null;
}

export interface PairingStep {
  /** The premises the person holds an effective relationship for. */
  premises: readonly PremisesRef[];
  chosen: string;
  purposes: readonly "PLAYBACK"[];
  /** The chosen premises' authorisations, latest first; never the value or its hash. */
  items: readonly PairingRow[];
}

/** What a pairing act hands its page: the value once, or the refusal. */
export interface PairingAttempt {
  page: "pairing";
  premises: string;
  /** The value, shown once on the page the issue redirects to; RightOne holds only its hash. */
  issued: { id: string; value: string } | null;
  code: string | null;
  /** The authorisation a revocation named, and the reason as typed. */
  revoke: { id: string; reason: string } | null;
}

// ---------------------------------------------------------------- the operations console (SCR-VEN-12 to 16)

/** The premises class a service records at enrolment, as PTY answered it (`premises_classification`). */
export type Classification = "cafe" | "restaurant" | "bakery" | "tea" | "spa" | "karaoke";

/** SCR-VEN-12's filter, as the address carries it: a state of SM-10 and a premises, each optional. */
export interface RegisterFilter {
  status: string | null;
  premises: string | null;
}

export interface RegisterRow extends ServiceHead {
  classification: Classification | null;
  enrolledAt: string;
  endedAt: string | null;
}

export interface Register {
  rows: readonly RegisterRow[];
  /** Every premises that holds a service, for the premises filter. */
  premisesOptions: readonly PremisesRef[];
  /** The register's whole count, which a filtered list is shown against. */
  total: number;
  /** How many rows the filter matches, across every page. */
  matching: number;
  /** CURSOR_INVALID: a filter value the register does not accept, said in place of the rows. */
  refusal: string | null;
  paging: Paging;
}

/** One enforcement action as the case file reads it, each condition with the evidence its reinstatement recorded. */
export interface CaseAction {
  id: string;
  action: EnforcementKind;
  ground: CaseText;
  /** The policy version it was recorded under, named. */
  policy: CaseText;
  decidedBy: string;
  effectiveAt: string;
  /** False while its effective time is still ahead. */
  applied: boolean;
  /** The notice COM issued; null when none could be raised (EXC-VEN-06). */
  notice: string | null;
  remedy: CaseText;
  conditions: readonly { code: string; text: CaseText; evidence: string | null }[];
}

export interface CaseReinstatement {
  id: string;
  /** The action it lifted. */
  lifted: { action: EnforcementKind; effectiveAt: string };
  conditionsMet: readonly { code: string; evidence: string }[];
  by: string;
  effectiveAt: string;
}

export interface CaseEnding {
  id: string;
  cause: "PREMISES_REQUEST" | "SCOPE_EXIT";
  effectiveAt: string;
  applied: boolean;
  /** Who asked for it, or recorded the scope exit. */
  requestedBy: string | null;
  requestedAt: string | null;
  scopeExit: { family: ScopeFamily; event: ScopeDetail; reference: string; evidence: string } | null;
  /** Replaced by an earlier scope exit (DR-254 row 5). */
  superseded: boolean;
}

export interface CaseHead extends ServiceHead {
  /** The effective instant of the latest history row. */
  since: string;
  classification: Classification | null;
  enrolledAt: string;
  /** When PTY answered the class (`scope_answer_at`). */
  classConfirmedAt: string;
}

export interface CaseFile {
  head: CaseHead;
  /** Newest first. */
  actions: readonly CaseAction[];
  reinstatements: readonly CaseReinstatement[];
  endings: readonly CaseEnding[];
  terms: { version: string; acceptedBy: string; actingFor: string; acceptedAt: string; digest: string } | null;
  /** Newest first. */
  history: readonly HistoryRow[];
  /** The period read for the week asked (null until one is asked), or withheld from a reader the read does not admit. */
  periods: { withheld: true } | { withheld: false; week: WeekQuery; resolution: ScheduleStep["resolution"] | null };
  /** GET /fallbacks, newest first, one page of them, or withheld. */
  fallbacks: { withheld: true } | { withheld: false; items: readonly FallbackRow[]; paging: Paging };
  /** Each act control's refusal while the state forbids it (convention 12), or null where it is open. */
  acts: { enforce: string | null; reinstate: string | null; exit: string | null };
}

/** The `VEN-ENFORCEMENT` rule version in force, as GOV answers it: its grounds and what each permits. */
export interface EnforcementPolicy {
  name: CaseText;
  title: CaseText;
  version: string;
  effectiveFrom: string;
  grounds: readonly { code: string; words: CaseText; actions: readonly EnforcementKind[]; notice: boolean }[];
}

export interface EnforcementStep {
  head: CaseHead & { device: string | null };
  /** Null while no version is in force (CFG-290's tested default): every submission is refused POLICY_NOT_APPROVED. */
  policy: EnforcementPolicy | null;
  /** The notices COM issued to the premises' party, newest first. */
  notices: readonly { reference: string; issuedAt: string | null }[];
}

export interface EnforcementInput {
  action: string;
  ground: string;
  /**
   * When the action takes effect, as the choice sent it: NOW is the instant the service records the command, read
   * there and not in the browser, so time spent on the form never makes it past; AT is the time in `effectiveAt`.
   */
  when: string;
  /** With AT, the time as the field sent it (Vietnam, YYYY-MM-DDTHH:MM); empty when it was left blank. */
  effectiveAt: string;
  notice: string;
  remedy: string;
  conditions: readonly { code: string; text: string }[];
}

export interface EnforcementAttempt {
  page: "enforcement";
  service: string;
  values: EnforcementInput;
  code: string;
}

export interface ReinstatementStep {
  head: CaseHead;
  /** The latest action, the one a reinstatement lifts; null when there is none. */
  action: CaseAction | null;
  /** NOT_REINSTATABLE while the state is neither suspended nor restricted. */
  refusal: string | null;
  now: string;
}

export interface ReinstatementAttempt {
  page: "reinstatement";
  service: string;
  evidence: Readonly<Record<string, string>>;
  effectiveAt: string;
  code: string;
}

export interface ScopeExitStep {
  head: CaseHead;
  /** ALREADY_ENDED while the service is terminal. */
  refusal: string | null;
}

export interface ScopeExitInput {
  family: string;
  detail: string;
  event: string;
  effectiveAt: string;
  evidence: string;
}

export interface ScopeExitAttempt {
  page: "scope-exit";
  service: string;
  values: ScopeExitInput;
  /** The refusal, or null when the exit was recorded (a reader who cannot read the case file stays here). */
  code: string | null;
  field: "detail" | "event" | "effectiveAt" | "evidence" | null;
  recorded: { effectiveAt: string } | null;
}

// ---------------------------------------------------------------- content operations (SCR-VEN-17, 18)

/** SM-236, as a version reads on a day: a draft, approved ahead of its date, in effect, superseded, withdrawn. */
export type MoodVersionState = "DRAFT" | "APPROVED" | "EFFECTIVE" | "SUPERSEDED" | "WITHDRAWN";
export const MOOD_VERSION_STATES: readonly MoodVersionState[] = ["DRAFT", "APPROVED", "EFFECTIVE", "SUPERSEDED", "WITHDRAWN"];

export interface MoodVersionSummary {
  id: string;
  no: number;
  state: MoodVersionState;
  effectiveFrom: string;
  effectiveTo: string | null;
  withdrawnReason: CaseText | null;
}

export interface MoodRow {
  id: string;
  name: string;
  owner: "SERVICE_OWNER";
  retiredAt: string | null;
  /** Newest first. */
  versions: readonly MoodVersionSummary[];
}

export interface MoodLibrary {
  rows: readonly MoodRow[];
  /** CURSOR_INVALID for a state filter outside SM-236. */
  refusal: string | null;
  paging: Paging;
}

export interface TrackOption {
  id: string;
  title: string;
  by: string;
}

export interface MoodVersionView {
  mood: { id: string; name: string; owner: "SERVICE_OWNER"; retiredAt: string | null };
  version: MoodVersionSummary & { preparedBy: string; preparedAt: string; approvedBy: string | null; approvedAt: string | null };
  /** Each track with whether CAT holds it eligible now: a draft's track that is not yet dropped may already not be. */
  tracks: readonly (TrackOption & { position: number; admittedAt: string; droppedAt: string | null; eligible: boolean })[];
  /** Every version of the mood, newest first. */
  versions: readonly MoodVersionSummary[];
  /** Approving this draft sets the end of the version in force or approved before it: its number and new last day. */
  ends: { no: number; on: string } | null;
  /** Withdrawing this approved version, not yet in effect, clears the end it set on the version before it. */
  clears: { no: number } | null;
  /** The signed-in member prepared it, so another officer approves it. */
  preparedByReader: boolean;
}

/** What a mood form hands back to its page: the refusal, the field or track it names, the values as typed. */
export interface MoodAttempt {
  page: "mood";
  /** Which form: a new mood, the next version, an approval, a withdrawal. */
  form: "create" | "prepare" | "approve" | "withdraw";
  code: string;
  field: string | null;
  /** The track a refusal names, by id. */
  track: string | null;
  values: { name: string; effectiveFrom: string; tracks: readonly TrackOption[]; reason: string };
}

// ---------------------------------------------------------------- the loaders

type Refusals = Partial<Record<"not-found" | "not-authorised" | "refused", string>>;

/**
 * One loader's answer: the session's data, or, for a reviewer's view, the state the board drew. A view that draws
 * data from the session (an empty list, a paused display) is `drawn`; a failure comes from `reviewOutcome` with
 * the codes this read refuses with.
 */
function answer<T>(
  view: VenueView | null,
  read: () => LoadOutcome<T>,
  refusals: Refusals = {},
  drawn: (view: VenueView, data: T) => T | null = () => null,
): Promise<LoadOutcome<T>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === null) return Promise.resolve(read());
  const failure = reviewOutcome<T>(view, refusals);
  if (failure !== null) return Promise.resolve(failure);
  const outcome = read();
  const data = outcome.data === null ? null : drawn(view, outcome.data);
  return Promise.resolve(data === null ? outcome : { data, failure: null });
}

const NOT_AUTHORISED = { "not-authorised": "NOT_AUTHORISED_FOR_PREMISES" } as const;

/** The paging of a list a review view draws empty. */
const NO_PAGE: Paging = { from: 0, to: 0, next: null, previous: null, refused: null };

/** SCR-VEN-03: every Player service of the premises the person may act for. */
export function loadServices(reader: Reader, view: VenueView | null, cursor: string | null = null): Promise<LoadOutcome<ServiceList>> {
  return answer(view, () => serviceList(reader.sessionId, reader.organisation, cursor), {}, (v, data) => (v === "empty" ? { ...data, items: [], paging: NO_PAGE } : null));
}

/** SCR-VEN-01: the party and the premises it may enrol. */
export function loadEnrolForm(reader: Reader, view: VenueView | null): Promise<LoadOutcome<EnrolForm>> {
  return answer(view, () => enrolForm(reader.sessionId, reader.organisation, reader.party), {}, (v, data) => (v === "empty" ? { ...data, premises: [] } : null));
}

/** SCR-VEN-04: one service, its state, cause and history. */
export function loadService(reader: Reader, code: string, view: VenueView | null): Promise<LoadOutcome<ServiceRecord>> {
  return answer(view, () => serviceRecord(reader.sessionId, reader.organisation, code), { "not-found": "ENTITLEMENT_NOT_FOUND", ...NOT_AUTHORISED });
}

/** SCR-VEN-02: the terms in force, the baseline, and whether a default is set. */
export function loadTermsStep(reader: Reader, code: string, view: VenueView | null): Promise<LoadOutcome<TermsStep>> {
  return answer(view, () => termsStep(reader.sessionId, reader.organisation, reader.party, code, effectiveTerms(reader)), NOT_AUTHORISED);
}

/**
 * IPublicDocumentReader.EffectiveDocument(PREMISES_SERVICE_TERMS, now): the version of the premises service terms
 * PUB has in effect today, in this browser's world, so a version staff publish on PUB is the one offered from the day
 * it takes effect. Null when PUB answers no version or cannot answer (CR-VEN-01): the page then shows the Error
 * state and the acceptance is refused TERMS_VERSION_SUPERSEDED. The name is the document's, not the version's.
 */
function effectiveTerms(reader: Reader): TermsDocument | null {
  const version = legalDocument(reader.sessionId, "PREMISES_SERVICE_TERMS", null).data?.version ?? null;
  return version === null
    ? null
    : { version: version.label, documentId: TERMS.documentId, effective: version.effectiveFrom, title: TERMS.title, sections: version.sections };
}

/** SCR-VEN-05: the service and its current verification document. */
export function loadDocumentStep(reader: Reader, code: string, view: VenueView | null): Promise<LoadOutcome<DocumentStep>> {
  return answer(view, () => documentStep(reader.sessionId, reader.organisation, code), NOT_AUTHORISED);
}

/** SCR-VEN-05 Download: GET /verification-documents/{id}. */
export function loadDocumentFile(reader: Reader, reference: string): Promise<LoadOutcome<VerificationDocument>> {
  return answer(null, () => documentFile(reader.sessionId, reader.organisation, reference));
}

/** SCR-VEN-06: the playlists, filtered by state, and the default. */
export function loadPlaylists(reader: Reader, code: string, status: PlaylistStatus | null, view: VenueView | null, cursor: string | null = null): Promise<LoadOutcome<PlaylistsStep>> {
  return answer(view, () => playlistList(reader.sessionId, reader.organisation, code, status, cursor), NOT_AUTHORISED);
}

/** SCR-VEN-07: one playlist with its items' eligibility now, or a new one; the shared moods to add. */
export function loadPlaylistEditor(reader: Reader, code: string, playlist: string | null, view: VenueView | null): Promise<LoadOutcome<PlaylistEditor>> {
  return answer(view, () => playlistEditor(reader.sessionId, reader.organisation, code, playlist), { "not-found": "PLAYLIST_NOT_FOUND", ...NOT_AUTHORISED });
}

/** SCR-VEN-07 Search eligible tracks: CAT's read of the tracks eligible for this premises now. */
export function loadTrackSearch(reader: Reader, code: string, query: string): Promise<LoadOutcome<readonly TrackResult[]>> {
  return answer(null, () => trackSearch(reader.sessionId, reader.organisation, code, query));
}

/** SCR-VEN-08: the schedules, the form's playlists and the resolved week for the week and instant asked. */
export function loadSchedule(reader: Reader, code: string, week: WeekQuery | null, view: VenueView | null, cursor: string | null = null): Promise<LoadOutcome<ScheduleStep>> {
  return answer(view, () => scheduleStep(reader.sessionId, reader.organisation, code, week, cursor), NOT_AUTHORISED);
}

/** SCR-VEN-09: every period of the service that fell back, newest first. */
export function loadFallbacks(reader: Reader, code: string, view: VenueView | null, cursor: string | null = null): Promise<LoadOutcome<FallbackList>> {
  return answer(view, () => fallbackList(reader.sessionId, reader.organisation, code, cursor), NOT_AUTHORISED, (v, data) => (v === "empty" ? { ...data, items: [], paging: NO_PAGE } : null));
}

/** SCR-VEN-10: GET /premises/{premisesId}/service-view, now. */
export function loadServiceView(reader: Reader, code: string, view: VenueView | null): Promise<LoadOutcome<ServiceViewData>> {
  return answer(view, () => serviceView(reader.sessionId, reader.organisation, code), { "not-found": "ENTITLEMENT_NOT_FOUND", ...NOT_AUTHORISED });
}

/** SCR-VEN-11: the service and the earliest date it can end. */
export function loadEndingStep(reader: Reader, code: string, view: VenueView | null): Promise<LoadOutcome<EndingStep>> {
  return answer(view, () => endingStep(reader.sessionId, reader.organisation, code), NOT_AUTHORISED);
}

/**
 * Whether delivery reaches a device, from the two families that decide it: IAM's credential, which stops a device
 * held or revoked whether it is connected or not, and VEN's service, which stops a connected device while the service
 * is not ACTIVE. An offline device plays on from what it holds, and one past its offline limit has stopped already
 * under SCR-PLR-05, so the service does not decide for either.
 */
function stopOf(key: string, device: string, premisesId: string, condition: DeviceCondition): DeliveryStop | null {
  const { credential, delivery } = deviceCredentialState(key, device);
  if (delivery === "PERMITTED") return null;
  if (credential !== "ACTIVE") return { cause: "DEVICE", credential };
  if (condition !== "ONLINE" && condition !== "CEILING") return null;
  const service = servicePublicStatus(key, premisesId);
  if (service === null) return { cause: "SERVICE", status: null };
  return service.status === "ACTIVE" ? null : { cause: "SERVICE", status: service.status };
}

/** A device's report with why delivery stopped, its condition STOPPED when it did. */
function withDelivery<T extends { condition: DeviceCondition }>(key: string, device: string, premisesId: string, report: T): T & Delivery {
  const stop = stopOf(key, device, premisesId, report.condition);
  return { ...report, condition: stop === null ? report.condition : "STOPPED", stop };
}

/** The Player devices of the premises the person acts for, each with whether delivery reaches it. */
export function loadDevices(reader: Reader, view: VenueView | null): Promise<LoadOutcome<readonly (DeviceRow & Delivery)[]>> {
  return answer(
    view,
    () => {
      const outcome = deviceList(reader.sessionId, reader.organisation);
      if (outcome.data === null) return { data: null, failure: outcome.failure };
      return { data: outcome.data.map((row) => withDelivery(reader.sessionId, row.id, row.premises.id, row)), failure: null };
    },
    {},
    (v) => (v === "empty" ? [] : null),
  );
}

/** SCR-PLR-04 and 05: GET /devices/{id}/venue-view, with the sync progress and whether delivery reaches the device. */
export function loadVenueView(reader: Reader, device: string, view: VenueView | null): Promise<LoadOutcome<VenueViewData & Delivery>> {
  return answer(
    view,
    () => {
      const outcome = venueView(reader.sessionId, reader.organisation, device);
      if (outcome.data === null) return { data: null, failure: outcome.failure };
      return { data: withDelivery(reader.sessionId, outcome.data.device.id, outcome.data.premises.id, outcome.data), failure: null };
    },
    { refused: "NOT_AUTHORISED" },
  );
}

/** SCR-PLR-06: GET /now-playing/{premisesId}, read by anyone in the browser's world; the board's paused display on review. */
export function loadNowPlaying(world: string, premises: string, view: VenueView | null): Promise<LoadOutcome<GuestViewData>> {
  return answer(view, () => nowPlaying(world, premises), {}, (v, data) => (v === "paused" && data.track !== null ? { ...data, state: "PAUSED" } : null));
}

/** SCR-IAM-06: the premises to pair for and the chosen one's authorisations. */
export function loadPairing(reader: Reader, premises: string | null, view: VenueView | null): Promise<LoadOutcome<PairingStep>> {
  return answer(view, () => pairingStep(reader.sessionId, reader.organisation, premises), { refused: "AUTHORITY_NOT_IN_FORCE" }, (v, data) =>
    v === "empty" ? { ...data, items: [] } : null,
  );
}

// ---------------------------------------------------------------- the commands

/** A command's answer: accepted with what it made, or refused with its code; a refused command records nothing. */
export type CommandAnswer<T> = { accepted: T; refusal: null } | { accepted: null; refusal: { code: string; field: string | null; item: number | null } };

const command = <T,>(run: () => CommandAnswer<T>): Promise<LoadOutcome<CommandAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/** POST /service-entitlements: the new service awaiting terms, or the DR-250 refusal. */
export function sendEnrolment(reader: Reader, premises: string): Promise<LoadOutcome<CommandAnswer<{ code: string }>>> {
  return command(() => enrolPremises(reader.sessionId, reader.organisation, reader.account, premises));
}

/** POST /service-entitlements/{id}/terms-acceptances: the service active, or the DR-251 refusal. */
export function sendTermsAcceptance(
  reader: Reader,
  code: string,
  input: { termsVersion: string; termsDocumentId: string; shownTextDigest: string; attestationConfirmed: boolean },
): Promise<LoadOutcome<CommandAnswer<{ activatedAt: string }>>> {
  return command(() => acceptTerms(reader.sessionId, reader.organisation, reader.account, code, input, effectiveTerms(reader), reader.party));
}

/** POST /service-entitlements/{id}/verification-documents. */
export function sendDocumentIssue(reader: Reader, code: string, format: string): Promise<LoadOutcome<CommandAnswer<{ reference: string }>>> {
  return command(() => issueDocument(reader.sessionId, reader.organisation, code, format));
}

/** POST /service-entitlements/{id}/default-playlist. */
export function sendDefaultPlaylist(reader: Reader, code: string, playlist: string): Promise<LoadOutcome<CommandAnswer<{ playlist: string }>>> {
  return command(() => defaultPlaylistSet(reader.sessionId, reader.organisation, code, playlist));
}

/** POST /playlists/{id}/archive, with the optional reason the module audit log keeps. */
export function sendArchive(reader: Reader, code: string, playlist: string, reason: string): Promise<LoadOutcome<CommandAnswer<{ playlist: string }>>> {
  return command(() => archivePlaylist(reader.sessionId, reader.organisation, code, playlist, reason));
}

export interface ItemInput {
  kind: string;
  ref: string;
}

/** POST /playlists: a new playlist at revision 1. */
export function sendNewPlaylist(reader: Reader, code: string, name: string, items: readonly ItemInput[]): Promise<LoadOutcome<CommandAnswer<{ playlist: string }>>> {
  return command(() => createPlaylist(reader.sessionId, reader.organisation, code, name, items));
}

/** POST /playlists/{id}/revisions: the next revision. */
export function sendRevision(reader: Reader, code: string, playlist: string, items: readonly ItemInput[]): Promise<LoadOutcome<CommandAnswer<{ revision: number }>>> {
  return command(() => revisePlaylist(reader.sessionId, reader.organisation, code, playlist, items));
}

export interface ScheduleInput {
  playlist: string;
  days: readonly number[];
  start: string;
  end: string;
  /** Blank means today, Vietnam time. */
  from: string | null;
  /** Blank means open-ended. */
  to: string | null;
  replaces: string | null;
}

/** POST /schedules. */
export function sendSchedule(reader: Reader, code: string, input: ScheduleInput): Promise<LoadOutcome<CommandAnswer<{ schedule: string }>>> {
  return command(() => saveSchedule(reader.sessionId, reader.organisation, code, input));
}

/** POST /schedules/{id}/withdraw. */
export function sendScheduleWithdrawal(reader: Reader, code: string, schedule: string, reason: string): Promise<LoadOutcome<CommandAnswer<{ schedule: string }>>> {
  return command(() => withdrawSchedule(reader.sessionId, reader.organisation, code, schedule, reason));
}

/** POST /service-entitlements/{id}/endings: the ending recorded, from the date the policy allows or later. */
export function sendEnding(reader: Reader, code: string, date: string | null, reason: string): Promise<LoadOutcome<CommandAnswer<{ effectiveAt: string }>>> {
  return command(() => requestEnding(reader.sessionId, reader.organisation, reader.account, code, date, reason));
}

/** POST /identity/pairing-authorisations: the value once, its expiry and state. */
export function sendPairingIssue(reader: Reader, premises: string, purpose: string): Promise<LoadOutcome<CommandAnswer<{ id: string; value: string }>>> {
  return command(() => issuePairing(reader.sessionId, reader.organisation, premises, purpose));
}

/** POST /identity/pairing-authorisations/{id}/revoke. */
export function sendPairingRevocation(reader: Reader, authorisation: string, reason: string): Promise<LoadOutcome<CommandAnswer<{ id: string }>>> {
  return command(() => revokePairing(reader.sessionId, reader.organisation, authorisation, reason));
}

// ---------------------------------------------------------------- the consoles: who reads and acts, and what

/*
 * The operations console and content operations act as a member of the gateway's staff. Each read and command is
 * scoped by the member's roles in the backend as the contract's permission entries scope it; the page's guard only
 * keeps a member who holds none of them on My work.
 */

/** SCR-VEN-12: GET /service-entitlements, every premises' service, filtered by state and premises. */
export function loadRegister(staff: Staff, filter: RegisterFilter, view: VenueView | null, cursor: string | null = null): Promise<LoadOutcome<Register>> {
  return answer(view, () => register(staff.sessionId, staff, filter, cursor), {}, (v, data) => (v === "empty" ? { ...data, rows: [], paging: NO_PAGE } : null));
}

/** SCR-VEN-13: the case file, the periods of the week asked, and the fallbacks. */
export function loadCaseFile(staff: Staff, code: string, week: WeekQuery | null, view: VenueView | null, cursor: string | null = null): Promise<LoadOutcome<CaseFile>> {
  return answer(view, () => caseFile(staff.sessionId, staff, code, week, cursor), { "not-found": "ENTITLEMENT_NOT_FOUND" });
}

/** SCR-VEN-14: the service, the enforcement policy in force and the notices COM issued. */
export function loadEnforcementStep(staff: Staff, code: string, view: VenueView | null): Promise<LoadOutcome<EnforcementStep>> {
  return answer(view, () => enforcementStep(staff.sessionId, staff, code), { "not-found": "ENTITLEMENT_NOT_FOUND" });
}

/** SCR-VEN-15: the service and the action a reinstatement lifts. */
export function loadReinstatementStep(staff: Staff, code: string, view: VenueView | null): Promise<LoadOutcome<ReinstatementStep>> {
  return answer(view, () => reinstatementStep(staff.sessionId, staff, code), { "not-found": "ENTITLEMENT_NOT_FOUND" });
}

/** SCR-VEN-16: the service a scope exit is recorded against. */
export function loadScopeExitStep(staff: Staff, code: string, view: VenueView | null): Promise<LoadOutcome<ScopeExitStep>> {
  return answer(view, () => scopeExitStep(staff.sessionId, staff, code), { "not-found": "ENTITLEMENT_NOT_FOUND" });
}

/** SCR-VEN-17: GET /shared-moods, every mood with its versions, filtered by version state. */
export function loadMoodLibrary(staff: Staff, filter: string | null, view: VenueView | null, cursor: string | null = null): Promise<LoadOutcome<MoodLibrary>> {
  return answer(view, () => moodLibrary(staff.sessionId, staff, filter, cursor), {}, (v, data) => (v === "empty" ? { ...data, rows: [], paging: NO_PAGE } : null));
}

/** SCR-VEN-18: GET /shared-mood-versions/{id}. */
export function loadMoodVersion(staff: Staff, version: string, view: VenueView | null): Promise<LoadOutcome<MoodVersionView>> {
  return answer(view, () => moodVersion(staff.sessionId, staff, version), { "not-found": "VERSION_NOT_FOUND" });
}

/** The track picker of SCR-VEN-17 and 18: CAT's tracks eligible now. */
export function loadMoodTrackSearch(staff: Staff, query: string): Promise<LoadOutcome<readonly TrackOption[]>> {
  return answer(null, () => moodTrackSearch(staff, query));
}

/** POST /service-entitlements/{id}/enforcement-actions. */
export function sendEnforcement(staff: Staff, code: string, input: EnforcementInput): Promise<LoadOutcome<CommandAnswer<{ effectiveAt: string }>>> {
  return command(() => recordEnforcement(staff.sessionId, staff, code, input));
}

/** POST /service-entitlements/{id}/reinstatements. */
export function sendReinstatement(
  staff: Staff,
  code: string,
  input: { action: string; evidence: Readonly<Record<string, string>>; effectiveAt: string },
): Promise<LoadOutcome<CommandAnswer<{ effectiveAt: string }>>> {
  return command(() => recordReinstatement(staff.sessionId, staff, code, input));
}

/** POST /service-entitlements/{id}/scope-exits. */
export function sendScopeExit(staff: Staff, code: string, input: ScopeExitInput): Promise<LoadOutcome<CommandAnswer<{ effectiveAt: string }>>> {
  return command(() => recordScopeExit(staff.sessionId, staff, code, input));
}

/** POST /shared-moods: the mood with its version 1, a draft. */
export function sendNewMood(
  staff: Staff,
  input: { name: string; owner: string; effectiveFrom: string; tracks: readonly string[] },
): Promise<LoadOutcome<CommandAnswer<{ version: string }>>> {
  return command(() => createMood(staff.sessionId, staff, input));
}

/** POST /shared-moods/{id}/versions: the next version, a draft. */
export function sendMoodVersion(staff: Staff, mood: string, input: { effectiveFrom: string; tracks: readonly string[] }): Promise<LoadOutcome<CommandAnswer<{ version: string }>>> {
  return command(() => prepareMoodVersion(staff.sessionId, staff, mood, input));
}

/** POST /shared-mood-versions/{id}/approve. */
export function sendMoodApproval(staff: Staff, version: string): Promise<LoadOutcome<CommandAnswer<{ state: MoodVersionState }>>> {
  return command(() => approveMoodVersion(staff.sessionId, staff, version));
}

/** POST /shared-mood-versions/{id}/withdraw. */
export function sendMoodWithdrawal(staff: Staff, version: string, reason: string): Promise<LoadOutcome<CommandAnswer<{ state: MoodVersionState }>>> {
  return command(() => withdrawMoodVersion(staff.sessionId, staff, version, reason));
}
