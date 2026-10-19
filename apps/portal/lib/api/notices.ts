import type { LoadOutcome } from "@rightone/ui";
import {
  addPolicyClass,
  approvePolicyVersion,
  approveTemplateVersion,
  continueTrackChangeRun,
  noticePreferences,
  noticeQueue,
  noticeRead,
  noticesFor,
  noticeTimeliness,
  policyApproval,
  policyVersion,
  policyVersions,
  preparePolicyVersion,
  prepareTemplateVersion,
  recordAlternativeService,
  recordPreferences,
  recordReportedTrackChange,
  recoveryQueue,
  reissueNotice,
  sendForApproval,
  serviceForm,
  templateVersions,
  trackChangeRun,
  trackChangeRuns,
  unmetObligations,
  withdrawNotice,
  withdrawPolicyVersion,
} from "@/lib/mock/backend/notices";
import type { StaffRole } from "@/lib/mock/backend/store";
import { mockNoticeFailure, type Channel, type Com10View, type Com12View, type ConsoleView, type NoticeElement, type NoticesView, type RecipientRole } from "@/lib/mock/notices";

/** How a template body reads element by element, and the empty body a new class starts from: the console renders both. */
export { TEMPLATE_SKELETON, templateSections, type TemplateSections } from "@/lib/mock/notices";
import type { Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The notice family's seam (COM, `/api/v1/cases/`): what a recipient reads and decides, and what the gateway's
 * notice console reads and does. A notice is read by its reference, which needs no account; the preferences are
 * recorded against a party; every console read and act is a member of staff's, and the backend decides by their
 * roles what they may see and do.
 */

/** `SM-121`, one notice obligation. */
export type NoticeState =
  | "DUE"
  | "COMPOSED"
  | "UNMET"
  | "ISSUED"
  | "DELIVERED"
  | "UNDELIVERED"
  | "SERVED_ALTERNATIVELY"
  | "SUPERSEDED"
  | "WITHDRAWN";

/** `SM-122`, one notice policy version. */
export type PolicyState = "PREPARED" | "APPROVED" | "EFFECTIVE" | "SUPERSEDED" | "WITHDRAWN";

/** `SM-124`, one track-change notification run. */
export type RunState = "RESOLVING" | "ISSUING" | "INCOMPLETE" | "COMPLETE";

/** The four outcomes `BR-COM-03` names. */
export type OutcomeKind = "attempted" | "pending" | "delivered" | "failed";

/**
 * The words of one approved template version, kept with a notice composed from it: its number, and the subject, the
 * required action and the consequence as the version writes them, with the record's values still named (`{case}`).
 */
export interface NoticeWording {
  templateVersion: number;
  subject: string;
  action: string;
  consequence: string;
}

/**
 * The content a notice was composed with (`cases.notice_content`): the wording of the template version in force at
 * composition in each language (null where none was approved in that language, and the notice then reads in the
 * language it was composed in), the values it was filled with, the deadline and the office the register named, and the
 * version of each record the values were read from. A template version approved later changes none of it.
 */
export interface NoticeContent {
  classCode: string;
  /** The version the notice was composed from, in the notice's language (Vietnamese). */
  templateVersion: number;
  wording: { vi: NoticeWording | null; en: NoticeWording | null };
  values: Readonly<Record<string, string | number>>;
  deadline: string;
  contact: { role: string; phone: string; address: string };
  /** `source_record_versions`: each record the content drew on, by its kind, with the version or reference read. */
  recordVersions: Readonly<Record<string, string | number>>;
  composedAt: string;
}

export interface NoticeSummary {
  reference: string;
  classCode: string;
  state: NoticeState;
  /** When it was handed to delivery; null before it was issued. */
  issuedAt: string | null;
  /** Null while nothing is composed (DUE, UNMET). */
  content: NoticeContent | null;
}

/** How the notice reached the recipient, as the recipient may read it: the route it went by, and a service by another. */
export interface NoticeDelivery {
  channel: Channel | null;
  /** The address it went to: shown only to the recipient it was addressed to. */
  destination: string | null;
  deliveredAt: string | null;
  service: { route: string; servedOn: string } | null;
}

export interface NoticeView extends NoticeSummary {
  /** The reissue that replaced it, and when. */
  supersededBy: { reference: string; on: string } | null;
  /** The notice this one was reissued in place of, and why (FR-COM-006, FR-COM-017). */
  replaces: { reference: string; reason: string } | null;
  /** Whole days from the day it was issued to its deadline, where the deadline is not yet past at issue (FR-COM-011). */
  remainingDays: number | null;
  /** Addressed to the reader's own party: read in their portal. */
  own: boolean;
  delivery: NoticeDelivery;
}

/** Who reads: the party a signed-in principal acts for, or nobody, with the notice's reference as the credential. */
export interface NoticeReader {
  party: string | null;
  account: string | null;
}

export interface NoticeClassPreference {
  classCode: string;
  required: boolean;
  /** Whether notices of this class reach the party now: always for a required class. */
  receiving: boolean;
}

export interface NoticePreferences {
  /** The party the preferences are recorded against; null for a recipient known only by an address. */
  party: string | null;
  /** The classes of the policy in force that can be addressed to this recipient, in the policy's order. */
  classes: readonly NoticeClassPreference[];
}

/** What Save hands back to SCR-COM-12: what was recorded, and each class refused SUPPRESSION_NOT_PERMITTED. */
export interface PreferencesAttempt {
  page: "preferences";
  saved: boolean;
  refused: readonly string[];
}

/** The notices addressed to a party, newest first, that the person signed in may read: a delegate's about her premises. */
export function loadNoticesTo(sessionId: string, party: string, view: Exclude<NoticesView, "loading"> | null): Promise<LoadOutcome<readonly NoticeSummary[]>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockNoticeFailure() : noticesFor(sessionId, party));
}

/** GET /notices/{reference}: NOTICE_NOT_FOUND, or ROLE_OUT_OF_SCOPE for a signed-in reader it was not addressed to. */
export function loadNotice(key: string, reference: string, reader: NoticeReader, view: Exclude<Com10View, "loading"> | null): Promise<LoadOutcome<NoticeView>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockNoticeFailure() : noticeRead(key, reference, reader));
}

/**
 * GET /suppressions for SCR-COM-12: the reader's party, or the party of the notice they opened it from; a
 * recipient known only by an address is offered the classes addressed to a raiser.
 */
export function loadNoticePreferences(
  key: string,
  reader: NoticeReader,
  notice: string | null,
  view: Exclude<Com12View, "loading"> | null,
): Promise<LoadOutcome<NoticePreferences>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockNoticeFailure() : noticePreferences(key, reader, notice));
}

/**
 * POST /suppressions and POST /suppressions/{id}/release, one per class whose choice changed. A required class is
 * refused SUPPRESSION_NOT_PERMITTED, recorded as an attempt, and nothing is written for it.
 */
export function sendPreferences(
  key: string,
  reader: NoticeReader,
  notice: string | null,
  receive: Readonly<Record<string, boolean>>,
): Promise<LoadOutcome<{ refused: readonly string[] }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(recordPreferences(key, reader, notice, receive));
}

// ------------------------------------------------------------------ the notice console

/** A member of staff on the notice console: the name a record keeps, and the roles the backend decides by. */
export interface NoticeOfficer {
  name: string;
  roles: readonly StaffRole[];
}

/**
 * The answer to a console act: what it recorded, or the refusal with its code, the field it belongs to where it
 * belongs to one, and the values its sentence names (the version it collides with, the preparer, the date).
 */
export type NoticeAnswer<T> =
  | { accepted: T; refusal: null }
  | { accepted: null; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> } };

/** Where a reader stands to an approval: the approver, the person who prepared it, or one holding no approving role. */
export type ApprovalReader = "approver" | "preparer" | "no-role";

export interface PolicyVersionRow {
  versionNo: number;
  state: PolicyState;
  effectiveFrom: string;
  effectiveTo: string | null;
  classCount: number;
  preparedBy: string;
  preparedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  /** When the preparer sent it for approval; null while it is still being prepared. */
  sentAt: string | null;
  withdrawnReason: string | null;
}

/** SCR-COM-01: every version, the one in force today or on the day asked, and whether the reader may prepare one. */
export interface PolicyVersions {
  versions: readonly PolicyVersionRow[];
  /** The version in force on the day asked, today where none was; null is `POLICY_NOT_CONFIGURED`. */
  inForce: number | null;
  /** The day asked (`as_of`); null for today. */
  asOf: string | null;
  canPrepare: boolean;
}

/** A class as a version states it (`cases.notice_classes`). */
export interface NoticeClassView {
  classCode: string;
  eventKind: string;
  recipientRole: RecipientRole;
  channels: readonly Channel[];
  subjectKinds: readonly string[];
  isRequired: boolean;
  requiresProof: boolean;
  leadTimeDays: number | null;
  requiredActionRule: "states_action" | "states_no_action";
}

/** A class `CFG-161` lists, with the facts "Add a class" starts from. */
export interface RegisterClassView {
  classCode: string;
  eventKind: string;
  recipientRole: RecipientRole;
  channels: readonly Channel[];
  subjectKinds: readonly string[];
  subjectDate: boolean;
}

/** SCR-COM-02: one version, its classes, and what the reader may do to it. */
export interface PolicyVersionView {
  version: PolicyVersionRow;
  classes: readonly NoticeClassView[];
  /** The register's classes this version does not state yet: what "Add a class" offers. */
  addable: readonly RegisterClassView[];
  /** The reader holds ACT-OPS: Add a class and Send for approval are theirs while the version is prepared. */
  preparer: boolean;
  /** The reader holds ACT-BIZ-APR: the approval page is theirs to open. */
  approver: boolean;
  /** The classes of the policy in force: the ones SCR-COM-04 opens templates for. */
  inForceClasses: readonly string[];
}

/** What "Add a class" sends: each designation is null until the preparer states it. */
export interface ClassInput {
  classCode: string;
  eventKind: string;
  recipientRole: string;
  channels: readonly string[];
  subjectKinds: readonly string[];
  isRequired: boolean | null;
  requiresProof: boolean | null;
  requiredActionRule: string | null;
  leadTimeDays: string;
}

/** SCR-COM-03: the version to approve, and the reader's standing to it. */
export interface PolicyApproval {
  version: PolicyVersionRow;
  classes: readonly NoticeClassView[];
  reader: ApprovalReader;
  /** The version in force that this one ends, and its last day, once approved. */
  ends: { versionNo: number; lastDay: string } | null;
}

export type TemplateState = "PREPARED" | "APPROVED" | "SUPERSEDED";

export interface TemplateVersionRow {
  id: string;
  classCode: string;
  versionNo: number;
  language: "vi" | "en";
  body: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  state: TemplateState;
  /** Composes notices of the class today. */
  inForce: boolean;
  preparedBy: string;
  preparedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  /** The placeholders the body does not carry (`NOTICE_ELEMENT_MISSING`). */
  missing: readonly NoticeElement[];
  reader: ApprovalReader;
}

/** SCR-COM-04: the templates of one class of the policy in force. */
export interface TemplatesView {
  /** The classes of the policy in force, in its order. */
  classes: readonly string[];
  classCode: string;
  versions: readonly TemplateVersionRow[];
  /** The version composing the class on the day asked, today where none was, in each language; null is `TEMPLATE_VERSION_NOT_EFFECTIVE`. */
  inForce: { vi: number | null; en: number | null };
  /** The day asked (`as_of`); null for today. Each row's `inForce` is read on that day too. */
  asOf: string | null;
  /** The latest notice of the class as it was composed, for the preview; null while none was. */
  sample: { reference: string; content: NoticeContent } | null;
  /** Notices of the class waiting for wording in force. */
  waiting: number;
  canPrepare: boolean;
}

export interface TemplateInput {
  classCode: string;
  language: string;
  body: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /** A date was typed and could not be read. */
  unreadable: boolean;
}

/** SCR-COM-06's row: never the destination, which a list of would be a directory of who was told what. */
export interface QueueRow {
  reference: string;
  classCode: string;
  state: NoticeState;
  dueAt: string;
  issuedAt: string | null;
  /** `NOTICE_ALREADY_ISSUED`: the event arrived again, and the notice shown is the one already sent. */
  replay: { count: number; lastAt: string } | null;
}

/** One report of the delivery treatment, with who reported it. */
export interface OutcomeRow {
  outcome: OutcomeKind;
  attemptNo: number;
  route: "primary" | "secondary";
  providerResponse: string;
  reportedBy: "provider" | "operations" | "recipient";
  reportedSourceRef: string;
  reportedAt: string;
  exhausted: boolean;
}

/** One notice opened beside the queue: what was sent, where, and everything reported about its delivery. */
export interface NoticeDetail {
  reference: string;
  classCode: string;
  state: NoticeState;
  dueAt: string;
  issuedAt: string | null;
  deliveredAt: string | null;
  /** The party addressed, by name; null where the recipient is known only by the address they gave. */
  recipient: string | null;
  channel: Channel | null;
  destination: string | null;
  content: NoticeContent | null;
  policyVersion: number;
  /**
   * The event occurrence that required it, as the raising module supplied it, with that module and the event's kind
   * (AC-FR-COM-001-05): with the class, the identity of its obligation. A reissue carries its original's.
   */
  occurrence: { ref: string; module: string | null; eventKind: string | null };
  outcomes: readonly OutcomeRow[];
  service: { route: string; servedOn: string; servedBy: string; evidence: string | null; recordedAt: string } | null;
  /** The track-change run that raised it. */
  run: string | null;
  unmetReason: string | null;
  replay: { count: number; lastAt: string } | null;
  /** Why a notice due now is still DUE: the wording, the register entry or an element is missing, and which element. */
  waiting: { reason: string; element: string | null } | null;
  /** Issued after it fell due: by how many minutes (FR-COM-011); null when on time or not issued. */
  lateMinutes: number | null;
  /** A track-change notice: the condition of the premises' device when it was issued, recorded beside it (FR-COM-016). */
  device: DeviceCondition | null;
  /** The notice this one replaced, and the one that replaced it. */
  supersedes: string | null;
  supersededBy: string | null;
  reissueReason: string | null;
  withdrawn: { by: string; reason: string; at: string } | null;
  /** The reader holds ACT-OPS: Reissue is theirs while the notice is issued or delivered. */
  canReissue: boolean;
}

/** The device of a premises as a track-change notice records it: online, offline, stopped, or none at all. */
export interface DeviceCondition {
  condition: "ONLINE" | "OFFLINE" | "STOPPED" | "NO_DEVICE";
  /** When the device last reported; null without a device. */
  asAt: string | null;
}

export interface QueueFilter {
  classCode: string | null;
  state: NoticeState | null;
  dueFrom: string | null;
  dueTo: string | null;
}

export interface NoticeQueue {
  rows: readonly QueueRow[];
  /** Every notice the world holds, before the filter. */
  total: number;
  classes: readonly string[];
  opened: NoticeDetail | null;
  asOf: string;
}

export interface RecoveryDepth {
  classCode: string;
  depth: number;
  /** The first failure among the class's undelivered notices; null while none has failed yet. */
  oldestFailureAt: string | null;
}

export interface RecoveryRow {
  reference: string;
  classCode: string;
  state: NoticeState;
  issuedAt: string;
  firstFailureAt: string | null;
  attempts: number;
  lastResponse: string | null;
  /** The delivery treatment has given up: Record a service is open. */
  exhausted: boolean;
}

/** SCR-COM-08: the required notices with no delivered outcome, deepest and oldest first. */
export interface RecoveryQueue {
  depths: readonly RecoveryDepth[];
  rows: readonly RecoveryRow[];
  asOf: string;
}

/** SCR-COM-09: the notice, its attempts, and whether anything is still owed on it. */
export interface ServiceView {
  reference: string;
  classCode: string;
  state: NoticeState;
  issuedAt: string | null;
  channel: Channel | null;
  destination: string | null;
  recipient: string | null;
  attempts: readonly OutcomeRow[];
  exhausted: boolean;
  /** `NOTICE_ALREADY_DISCHARGED`: delivered or served, and when. */
  discharged: { on: string; by: "delivered" | "served" } | null;
  /** The reader, who is recorded as having served it. */
  servedBy: string;
  today: string;
  /** The reader holds ACT-OPS or ACT-SUP: Record the service is theirs. */
  canServe: boolean;
  /** The reader holds ACT-BIZ-APR: Withdraw is theirs. */
  canWithdraw: boolean;
  /**
   * Where a withdrawal stands (POST /notices/{id}/withdraw): the notice was sent and is replaced only by a reissue;
   * it is discharged; its class is still required, so the obligation stays open (DR-135 rows 5 and 6, with the
   * reason); it may be closed unserved; or it was.
   */
  withdrawal:
    | { kind: "sent"; on: string }
    | { kind: "discharged"; on: string }
    | { kind: "open"; reason: "TREATMENT_RUNNING" | "TREATMENT_EXHAUSTED" }
    | { kind: "withdrawable" }
    | { kind: "withdrawn"; by: string; reason: string; at: string };
}

export interface ServiceInput {
  route: string;
  servedOn: string | null;
  /** A date was typed and could not be read. */
  unreadable: boolean;
  evidence: string;
}

export interface RunRow {
  ref: string;
  trackRef: string;
  title: string;
  by: string;
  changeKind: "revoked" | "expired" | "taken_down";
  changeRecordedAt: string;
  effectiveAt: string;
  state: RunState;
  resolvedCount: number;
  issuedCount: number;
}

export interface RunRecipient {
  premises: string;
  playlists: readonly string[];
  /** The schedules in force at the change instant that play one of those playlists, by playlist and hours. */
  schedules: readonly string[];
  notice: { reference: string; state: NoticeState } | null;
  /** The device's condition recorded beside the notice when it was issued; null while no notice was. */
  device: DeviceCondition | null;
}

/** SCR-COM-13: the runs, and the one opened with every premises it resolved. */
export interface TrackChangeRuns {
  runs: readonly RunRow[];
}

export interface TrackChangeRunView extends RunRow {
  recipients: readonly RunRecipient[];
  /** The change was in effect when the run resolved. */
  alreadyInEffect: boolean;
}

/** A change CAT records to a track (POST /track-change-notifications): the run resolves its premises at the instant. */
export interface TrackChangeInput {
  trackRef: string;
  changeKind: string;
  /** When the change takes effect; null is at once, the instant it is recorded. */
  effectiveAt: string | null;
}

/** A class's four figures for a period; the three after the first are null where fewer than five fell due. */
export interface TimelinessRow {
  classCode: string;
  fellDue: number;
  beforeDue: number | null;
  afterDue: number | null;
  notIssued: number | null;
}

/** SCR-COM-15: one calendar month, a row per class, and when the position was restated. */
export interface Timeliness {
  period: string;
  periods: readonly string[];
  rows: readonly TimelinessRow[];
  restatedOn: string | null;
  /** Below this many notices a class shows its count with no breakdown. */
  threshold: number;
  asOf: string;
}

export interface UnmetRow {
  reference: string;
  classCode: string;
  recipient: string | null;
  channels: readonly Channel[];
  dueAt: string;
  waitingDays: number;
}

/**
 * SCR-COM-16: the obligations with no address; the events refused before they were recorded - nothing to identify
 * them (OCCURRENCE_REF_MISSING), or a subject the class is not about (SUBJECT_KIND_UNKNOWN); and the events recorded
 * that raised no notice because no class of the policy in force states them, or the class they named does not exist.
 */
export interface UnmetObligations {
  rows: readonly UnmetRow[];
  refusedEvents: readonly { module: string; code: "OCCURRENCE_REF_MISSING" | "SUBJECT_KIND_UNKNOWN"; count: number }[];
  unclassified: readonly { module: string; eventKind: string; reason: "NO_CLASS_FOR_EVENT" | "NOTICE_CLASS_UNKNOWN" | "POLICY_NOT_CONFIGURED"; count: number; lastAt: string }[];
  asOf: string;
}

/** What a console act hands back to the page it redirects to: the refusal where the act was, or what it did. */
export type ConsoleAttempt =
  | { page: "policy"; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> }; typed: { from: string; to: string } }
  | { page: "class"; version: number; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> }; typed: ClassInput }
  | { page: "class-added"; version: number; classCode: string }
  | { page: "send"; version: number; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> } }
  | { page: "approval"; version: number; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> }; note: string; reason: string }
  | { page: "approved"; version: number; act: "approve" | "withdraw" | "send" }
  | { page: "template"; classCode: string; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> }; typed: { language: string; body: string; from: string; to: string } }
  | { page: "template-done"; classCode: string; act: "prepare" | "approve"; versionNo: number; language: string }
  | { page: "template-approval"; classCode: string; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> } }
  | { page: "service"; reference: string; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> }; typed: { route: string; servedOn: string; evidence: string } }
  | { page: "served"; reference: string; servedOn: string }
  | { page: "run"; run: string; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> } | null; issued: number }
  | { page: "track-change"; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> }; typed: { track: string; kind: string; when: string } }
  | { page: "reissue"; reference: string; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> } | null; reissued: string | null; reason: string }
  | { page: "withdraw"; reference: string; refusal: { code: string; field: string | null; values: Readonly<Record<string, string | number>> } | null; reason: string };

const officer = (staff: Staff): NoticeOfficer => ({ name: staff.account, roles: staff.roles });
const failed = <T>(view: Exclude<ConsoleView, "loading"> | null, read: () => LoadOutcome<T>): Promise<LoadOutcome<T>> =>
  Promise.resolve(!usesMockData() ? NOT_CONFIGURED : view !== null ? mockNoticeFailure() : read());
const notWired = { accepted: null, refusal: { code: NOT_CONFIGURED.failure.code, field: null, values: {} } } as const;
const act = <T>(run: () => NoticeAnswer<T>): Promise<NoticeAnswer<T>> => Promise.resolve(usesMockData() ? run() : notWired);

/** GET /notice-policy-versions (SCR-COM-01), with the version in force on the day `asOf` names, today where none. */
export function loadPolicyVersions(staff: Staff, view: Exclude<ConsoleView, "loading"> | null, asOf: string | null = null): Promise<LoadOutcome<PolicyVersions>> {
  return failed(view, () => policyVersions(staff.sessionId, officer(staff), asOf));
}

/** POST /notice-policy-versions, and the classes of the version in force restated on it where the preparer asks. */
export function sendPolicyVersion(
  staff: Staff,
  input: { effectiveFrom: string | null; effectiveTo: string | null; unreadable: boolean; restate: boolean },
): Promise<NoticeAnswer<{ versionNo: number }>> {
  return act(() => preparePolicyVersion(staff.sessionId, officer(staff), input));
}

/** GET /notice-policy-versions/{id}/classes (SCR-COM-02). */
export function loadPolicyVersion(staff: Staff, versionNo: number, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<PolicyVersionView>> {
  return failed(view, () => policyVersion(staff.sessionId, officer(staff), versionNo));
}

/** POST /notice-policy-versions/{id}/classes. */
export function sendPolicyClass(staff: Staff, versionNo: number, input: ClassInput): Promise<NoticeAnswer<{ classCode: string }>> {
  return act(() => addPolicyClass(staff.sessionId, officer(staff), versionNo, input));
}

/** Send for approval on SCR-COM-02: every class states both designations, and the approver is told. */
export function sendVersionForApproval(staff: Staff, versionNo: number): Promise<NoticeAnswer<{ sentAt: string }>> {
  return act(() => sendForApproval(staff.sessionId, officer(staff), versionNo));
}

/** SCR-COM-03's read: the version and where the reader stands to it. */
export function loadPolicyApproval(staff: Staff, versionNo: number, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<PolicyApproval>> {
  return failed(view, () => policyApproval(staff.sessionId, officer(staff), versionNo));
}

/** POST /notice-policy-versions/{id}/approve. */
export function sendPolicyApproval(staff: Staff, versionNo: number, note: string): Promise<NoticeAnswer<{ state: PolicyState }>> {
  return act(() => approvePolicyVersion(staff.sessionId, officer(staff), versionNo, note));
}

/** POST /notice-policy-versions/{id}/withdraw. */
export function sendPolicyWithdrawal(staff: Staff, versionNo: number, reason: string): Promise<NoticeAnswer<{ state: PolicyState }>> {
  return act(() => withdrawPolicyVersion(staff.sessionId, officer(staff), versionNo, reason));
}

/** GET /notice-template-versions for one class (SCR-COM-04), with the versions composing on the day `asOf` names. */
export function loadTemplates(staff: Staff, classCode: string | null, view: Exclude<ConsoleView, "loading"> | null, asOf: string | null = null): Promise<LoadOutcome<TemplatesView>> {
  return failed(view, () => templateVersions(staff.sessionId, officer(staff), classCode, asOf));
}

/** POST /notice-template-versions. */
export function sendTemplateVersion(staff: Staff, input: TemplateInput): Promise<NoticeAnswer<{ versionNo: number }>> {
  return act(() => prepareTemplateVersion(staff.sessionId, officer(staff), input));
}

/** POST /notice-template-versions/{id}/approve. */
export function sendTemplateApproval(staff: Staff, id: string): Promise<NoticeAnswer<{ classCode: string; versionNo: number; language: string }>> {
  return act(() => approveTemplateVersion(staff.sessionId, officer(staff), id));
}

/** GET /notices under the filter (SCR-COM-06), with one notice opened beside it. */
export function loadNoticeQueue(staff: Staff, filter: QueueFilter, opened: string | null, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<NoticeQueue>> {
  return failed(view, () => noticeQueue(staff.sessionId, officer(staff), filter, opened));
}

/** GET /notices/recovery-queue (SCR-COM-08). */
export function loadRecoveryQueue(staff: Staff, classCode: string | null, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<RecoveryQueue>> {
  return failed(view, () => recoveryQueue(staff.sessionId, officer(staff), classCode));
}

/** SCR-COM-09's read: the notice and its attempts. */
export function loadServiceForm(staff: Staff, reference: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<ServiceView>> {
  return failed(view, () => serviceForm(staff.sessionId, officer(staff), reference));
}

/** POST /notices/{id}/alternative-service. */
export function sendAlternativeService(staff: Staff, reference: string, input: ServiceInput): Promise<NoticeAnswer<{ servedOn: string }>> {
  return act(() => recordAlternativeService(staff.sessionId, officer(staff), reference, input));
}

/** The track-change runs (SCR-COM-13's list). */
export function loadTrackChangeRuns(staff: Staff, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<TrackChangeRuns>> {
  return failed(view, () => trackChangeRuns(staff.sessionId, officer(staff)));
}

/** GET /track-change-notifications/{id}/recipients (SCR-COM-13). */
export function loadTrackChangeRun(staff: Staff, run: string, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<TrackChangeRunView>> {
  return failed(view, () => trackChangeRun(staff.sessionId, officer(staff), run));
}

/**
 * POST /track-change-notifications, from the console standing in for CAT (SCR-COM-13): the change recorded now, and
 * the run it raises, resolved and issued.
 */
export function sendTrackChange(staff: Staff, input: TrackChangeInput): Promise<NoticeAnswer<{ run: string; resolved: number; issued: number }>> {
  return act(() => recordReportedTrackChange(staff.sessionId, officer(staff), input));
}

/** POST /notices/{id}/reissue (SCR-COM-07): a new notice for the obligation, the one it replaces SUPERSEDED. */
export function sendNoticeReissue(staff: Staff, reference: string, reason: string): Promise<NoticeAnswer<{ reference: string; state: NoticeState }>> {
  return act(() => reissueNotice(staff.sessionId, officer(staff), reference, reason));
}

/** POST /notices/{id}/withdraw (SCR-COM-09): the obligation closed unserved, once its class is no longer required. */
export function sendNoticeWithdrawal(staff: Staff, reference: string, reason: string): Promise<NoticeAnswer<{ state: NoticeState }>> {
  return act(() => withdrawNotice(staff.sessionId, officer(staff), reference, reason));
}

/** POST /track-change-notifications/{id}/continue. */
export function sendRunContinuation(staff: Staff, run: string): Promise<NoticeAnswer<{ issued: number; outstanding: number }>> {
  return act(() => continueTrackChangeRun(staff.sessionId, officer(staff), run));
}

/** GET /notice-timeliness for a calendar month (SCR-COM-15). */
export function loadTimeliness(staff: Staff, period: string | null, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<Timeliness>> {
  return failed(view, () => noticeTimeliness(staff.sessionId, officer(staff), period));
}

/** GET /notices in state UNMET (SCR-COM-16). */
export function loadUnmetObligations(staff: Staff, view: Exclude<ConsoleView, "loading"> | null): Promise<LoadOutcome<UnmetObligations>> {
  return failed(view, () => unmetObligations(staff.sessionId, officer(staff)));
}
