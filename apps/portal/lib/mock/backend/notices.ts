import { randomUUID } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  ApprovalReader,
  ClassInput,
  DeviceCondition,
  NoticeAnswer,
  NoticeClassView,
  NoticeContent,
  NoticeDetail,
  NoticeOfficer,
  NoticePreferences,
  NoticeQueue,
  NoticeReader,
  NoticeState,
  NoticeSummary,
  NoticeView,
  NoticeWording,
  OutcomeKind,
  OutcomeRow,
  PolicyApproval,
  PolicyState,
  PolicyVersionRow,
  PolicyVersions,
  PolicyVersionView,
  QueueFilter,
  QueueRow,
  RecoveryQueue,
  RecoveryRow,
  RunRow,
  RunState,
  ServiceInput,
  ServiceView,
  TemplateInput,
  TemplatesView,
  TemplateVersionRow,
  Timeliness,
  TrackChangeInput,
  TrackChangeRuns,
  TrackChangeRunView,
  UnmetObligations,
} from "@/lib/api/notices";
import {
  CLASS_REGISTER,
  CONTACT_REGISTER_SEED,
  DECISION_PAYER,
  NOTICE_POLICY_SEED,
  PARTY_ROLES,
  SEED_DELIVERY,
  TEMPLATE_SEED,
  TRACK_CHANGE_SEED,
  WORDED_ELEMENTS,
  templateGaps,
  templateSections,
  valueNames,
  valueWordNames,
  type Channel,
  type RecipientRole,
  type SeedNoticeClass,
  type SeedReport,
} from "../notices";
import { accountBook, organisationName } from "./accounts";
import { addDays, now, today } from "./clock";
import { reference as newReference } from "./ids";
import { actingAs, mayActFor, premisesActableBy } from "./parties";
import { deviceSummary } from "./player";
import { helpRoutes } from "./public";
import { decisionForCollection, decisionReferences, premisesActedFor } from "./registration";
import { table, type StaffRole } from "./store";
import { premisesHoldingTrack, type TrackHolder } from "./venue";

/*
 * The notice family's backend (COM), as the API will behave: one table, `notices`, holding the schema's entities by
 * their names - the policy versions and their classes, the template versions, the contact register, the events
 * other families record, the notices with their content, state history, delivery outcomes and alternative services,
 * the track-change runs and their recipients, the recipients' suppressions and the audit log - and one function per
 * operation of `srs/02-api-contracts.md`, refusing with the codes of `design/04-refusal-codes.md`. A refused act
 * records nothing but its audit row.
 *
 * There is no mail server behind the mock, so it plays the delivery treatment `OPS` owns (`CFG-43`), and the play
 * is decided by the address, never by a timer: an email address or a mobile number is delivered when the notice is
 * issued, as the provider reports it; an address under `.invalid` (RFC 6761: such a domain cannot exist) and an SMS
 * to a number that is not a mobile one fail permanently, so the treatment gives up at once; a letter is handed to the
 * post and stays issued until the post reports through the treatment's own endpoints (`reportDeliveryOutcome`,
 * `reportDeliveryExhausted`), which no page offers an officer. What the treatment reported before the world began is
 * seed data (`SEED_DELIVERY`). Dates that arrive - a version's effective date, a notice's due instant - are applied
 * when the table is next read.
 *
 * What a recipient reads is the approved template version in force when the notice was composed: its words are kept
 * with the content, and the record's values fill them when the notice is read, in the reader's language. The party
 * record a contact point is resolved from is RightOne ID's organisation, through the active principal who answers for
 * it; a premises' device is read from PLR and the playlists and schedules holding a track from VEN, each through the
 * function its family exports.
 */

// ---------------------------------------------------------------- the table

/** `cases.notice_policy_versions`, SM-122. */
interface NoticePolicyVersion {
  id: string;
  versionNo: number;
  state: PolicyState;
  effectiveFrom: string;
  effectiveTo: string | null;
  preparedBy: string;
  preparedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  withdrawnReason: string | null;
}

/** `cases.notice_classes`. */
interface NoticeClassRow extends SeedNoticeClass {
  id: string;
  noticePolicyVersionId: string;
}

/** `cases.notice_template_versions`. */
interface TemplateVersion {
  id: string;
  classCode: string;
  versionNo: number;
  language: "vi" | "en";
  body: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  preparedBy: string;
  preparedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

/** `cases.contact_register_entries`: a role, never a person. */
interface ContactRegisterEntry {
  id: string;
  classCode: string;
  contactRole: string;
  contactAddress: string;
  contactPhone: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/** `cases.notice_events`, append-only: every event recorded, whether or not it raised a notice. */
interface NoticeEventRow {
  id: string;
  occurredAt: string;
  sourceModule: string;
  eventKind: string;
  occurrenceRef: string;
  subjectKind: string;
  subjectRef: string;
  recipientPartyId: string | null;
  raisedNotice: boolean;
  noObligationReason: string | null;
}

/** `cases.notices`, SM-121. */
interface NoticeRow {
  id: string;
  reference: string;
  noticeClassCode: string;
  noticePolicyVersionId: string;
  noticeEventId: string | null;
  occurrenceRef: string;
  subjectKind: string;
  subjectRef: string;
  recipientPartyId: string | null;
  recipientRole: RecipientRole;
  /**
   * The contact point the raising module holds for the recipient (the party record, or the address a raiser gave).
   * `destination` is resolved from it once, at composition, and frozen.
   */
  contactPoint: string | null;
  destination: string | null;
  channel: Channel | null;
  state: NoticeState;
  unmetReason: string | null;
  /** Why a notice due now is still DUE: the wording or the register entry it needs is not in force, or the content would leave an element empty (DR-134). */
  waitingReason: string | null;
  /** NOTICE_ELEMENT_MISSING's element: the content element, or the record's value, the composition found empty. */
  waitingElement: string | null;
  dueAt: string;
  issuedAt: string | null;
  deliveredAt: string | null;
  isRequired: boolean;
  requiresProof: boolean;
  supersedesNoticeId: string | null;
  reissueReason: string | null;
  withdrawnReason: string | null;
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  /** A track-change notice: the premises' device as it stood when the notice was issued (ALG-114 step 4). */
  deviceCondition: DeviceCondition | null;
  /** The values the content is generated from, as the event recorded them; `by` is the deadline element. */
  facts: Readonly<Record<string, string | number>> & { by: string };
  /** The version of each record the values were read from, as the raising module gave it. */
  recordVersions: Readonly<Record<string, string | number>>;
}

/**
 * `cases.notice_content`, append-only: the template version it was generated from in the notice's language, the one in
 * force in the other language beside it, and their words as they stood, so nothing approved later reaches it.
 */
interface NoticeContentRow {
  noticeId: string;
  templateVersionId: string;
  contactRegisterEntryId: string;
  wording: { vi: NoticeWording; en: NoticeWording | null };
  values: Readonly<Record<string, string | number>>;
  deadline: string;
  recordVersions: Readonly<Record<string, string | number>>;
  composedAt: string;
}

/** `cases.notice_state_history`. */
interface NoticeStateHistoryRow {
  noticeId: string;
  fromState: NoticeState | null;
  toState: NoticeState;
  transitionNo: number | null;
  actor: string | null;
  reasonCode: string | null;
  occurredAt: string;
}

/** `cases.notice_delivery_outcomes`. */
interface DeliveryOutcomeRow {
  noticeId: string;
  outcome: OutcomeKind;
  attemptNo: number;
  route: "primary" | "secondary";
  providerResponse: string;
  reportedBy: "provider" | "operations" | "recipient";
  reportedSourceRef: string;
  treatmentExhausted: boolean;
  reportedAt: string;
}

/** `cases.alternative_services`: one per notice. */
interface AlternativeServiceRow {
  noticeId: string;
  route: string;
  servedOn: string;
  servingActor: string;
  evidenceRef: string | null;
  recordedAt: string;
}

/** `cases.notice_suppressions`: in force while `releasedAt` is null. */
interface SuppressionRow {
  id: string;
  partyId: string;
  noticeClassCode: string;
  recordedAt: string;
  releasedAt: string | null;
}

/** `cases.track_change_notifications`, SM-124. */
interface TrackChangeRun {
  id: string;
  ref: string;
  trackRef: string;
  /** The track as CAT recorded the change: its title and who performs it, for the notice's subject. */
  title: string;
  by: string;
  changeKind: "revoked" | "expired" | "taken_down";
  changeRecordedAt: string;
  effectiveAt: string;
  state: RunState;
  resolvedCount: number;
  issuedCount: number;
  resolutionError: string | null;
}

/** `cases.track_change_recipients`: the playlists and the schedules of the premises that held the track. */
interface TrackChangeRecipient {
  runId: string;
  premisesId: string;
  partyId: string | null;
  playlists: readonly { id: string; name: string }[];
  /** Each schedule by the playlist it plays and its hours: "Chill tối 18:00-22:00". */
  schedules: readonly string[];
  noticeId: string | null;
  resolvedAt: string;
}

/** `cases.audit_log`: every act and read worth answering for, and every refused attempt with its code. */
interface AuditRow {
  at: string;
  actor: string | null;
  act: string;
  subject: string;
  code: string | null;
  detail: Readonly<Record<string, string | number>>;
}

export interface NoticesTable {
  noticePolicyVersions: NoticePolicyVersion[];
  noticeClasses: NoticeClassRow[];
  templateVersions: TemplateVersion[];
  contactRegisterEntries: ContactRegisterEntry[];
  noticeEvents: NoticeEventRow[];
  notices: Map<string, NoticeRow>;
  noticeContent: Map<string, NoticeContentRow>;
  noticeStateHistory: NoticeStateHistoryRow[];
  noticeDeliveryOutcomes: DeliveryOutcomeRow[];
  alternativeServices: AlternativeServiceRow[];
  noticeSuppressions: SuppressionRow[];
  trackChangeRuns: TrackChangeRun[];
  trackChangeRecipients: TrackChangeRecipient[];
  auditLog: AuditRow[];
}

/** An event another family records, as `POST /notice-events` takes it, with the facts its template is filled from. */
export interface NoticeEvent {
  sourceModule: string;
  eventKind: string;
  occurrenceRef: string;
  occurredAt: string;
  subjectKind: string;
  subjectRef: string;
  recipientPartyId: string | null;
  /** The address the recipient gave, or the party's recorded one. */
  destination: string | null;
  /** The values the content is generated from; `by` is the deadline element. */
  facts: Readonly<Record<string, string | number>> & { by: string };
  /** The class the raising module names (`class_code`), where it names one; otherwise the class stating the event. */
  classCode?: string;
  /** The version of each record the values were read from (`source_record_versions`), by record kind. */
  recordVersions?: Readonly<Record<string, string | number>>;
}

/**
 * What `POST /notice-events` answers (DR-131): the notice and its due instant, with the rule's reason - CLASS_REQUIRED
 * or CLASS_OPTIONAL where one was raised, POLICY_NOT_CONFIGURED, NOTICE_CLASS_UNKNOWN, NO_CLASS_FOR_EVENT,
 * NOTICE_ALREADY_ISSUED (with the notice already issued) or SUPPRESSED_BY_PREFERENCE where none was - or the refusal
 * that recorded no event: OCCURRENCE_REF_MISSING, SUBJECT_KIND_UNKNOWN.
 */
export interface NoticeEventAnswer {
  reference: string | null;
  dueAt: string | null;
  reasonCode: string;
  refused: boolean;
}

/** The language a notice is composed in: the product's. */
const NOTICE_LANGUAGE = "vi";
/** `GET /notice-timeliness`: a class with fewer notices than this in the period shows its count with no breakdown. */
const BREAKDOWN_THRESHOLD = 5;

const nameOfPremises = (key: string, premisesId: string): string =>
  (premisesActedFor(key).data ?? []).find((premises) => premises.id === premisesId)?.name ?? premisesId;

function emptyTable(key: string): NoticesTable {
  const versionId = randomUUID();
  const { classes, ...version } = NOTICE_POLICY_SEED;
  const help = helpRoutes(key).data ?? [];
  const phone = help.find((route) => route.kind === "support_line")?.value ?? "";
  const address = help.find((route) => route.kind === "contact_email")?.value ?? "";
  return {
    noticePolicyVersions: [{ id: versionId, ...version, withdrawnReason: null }],
    noticeClasses: classes.map((entry) => ({ id: randomUUID(), noticePolicyVersionId: versionId, ...entry })),
    templateVersions: TEMPLATE_SEED.map((entry) => ({ id: randomUUID(), ...entry })),
    contactRegisterEntries: CONTACT_REGISTER_SEED.map((entry) => ({
      id: randomUUID(),
      ...entry,
      contactAddress: address,
      contactPhone: phone,
      effectiveTo: null,
    })),
    noticeEvents: [],
    notices: new Map(),
    noticeContent: new Map(),
    noticeStateHistory: [],
    noticeDeliveryOutcomes: [],
    alternativeServices: [],
    noticeSuppressions: [],
    trackChangeRuns: [],
    trackChangeRecipients: [],
    auditLog: [],
  };
}

/**
 * The world's notices: the notice of the amount each current decision sets, issued to the payer when the decision
 * was (BR-FIN-15), with what the delivery treatment reported; and the run CAT's revocation of "Chủ nhật lười"
 * raised, as far as it got. A decision or a change recorded later raises its own.
 */
function seed(key: string): NoticesTable {
  const notices = emptyTable(key);
  for (const ref of decisionReferences(key)) {
    const decision = decisionForCollection(key, ref);
    if (decision === null) continue;
    const { summary, record } = decision;
    if (summary.status !== "CURRENT" || summary.outcome !== "PAYABLE" || summary.payBy === null) continue;
    raise(
      notices,
      {
        sourceModule: "FIN",
        eventKind: "obligation_outstanding",
        occurrenceRef: ref,
        occurredAt: record.issuedAt,
        subjectKind: "obligation",
        subjectRef: ref,
        recipientPartyId: DECISION_PAYER.party,
        destination: DECISION_PAYER.destination,
        facts: { decision: ref, premises: summary.premises.name, amount: summary.feeMinor, currency: summary.currency, by: summary.payBy },
        recordVersions: { decision: ref },
      },
      { reports: SEED_DELIVERY[ref] ?? null },
    );
  }
  const change = TRACK_CHANGE_SEED;
  startRun(key, notices, { trackRef: change.trackRef, changeKind: change.changeKind, changeRecordedAt: change.changeRecordedAt, effectiveAt: change.effectiveAt }, null, change.untold);
  return notices;
}

/**
 * The table, with every date that has arrived since it was last read applied. Exported for the family's own tests,
 * which read its audit log; another family reads COM only through the functions under "what other families call".
 */
export function noticesTable(key: string): NoticesTable {
  const notices = table(key, "notices", () => seed(key));
  settle(notices);
  return notices;
}

// ---------------------------------------------------------------- rules

const dayOf = (instant: string): string => addDays(instant, 0);

/**
 * Two instants compared as instants: the seed writes them with the Vietnam offset and an act stamps them in UTC, so
 * their text does not sort.
 */
const notAfter = (a: string, b: string): boolean => Date.parse(a) <= Date.parse(b);
const laterOf = (a: string, b: string): string => (notAfter(a, b) ? b : a);

/**
 * The policy version in force at an instant: an approved version from its effective date to its last day. A version
 * superseded since still answers for its own period, as it governed the notices raised in it.
 */
function policyAt(notices: NoticesTable, at: string): NoticePolicyVersion | null {
  const day = dayOf(at);
  const governs: readonly PolicyState[] = ["EFFECTIVE", "APPROVED", "SUPERSEDED"];
  return (
    notices.noticePolicyVersions.find(
      (version) => governs.includes(version.state) && version.effectiveFrom <= day && (version.effectiveTo === null || day <= version.effectiveTo),
    ) ?? null
  );
}

const classesOf = (notices: NoticesTable, version: NoticePolicyVersion) => notices.noticeClasses.filter((entry) => entry.noticePolicyVersionId === version.id);

const suppressionOf = (notices: NoticesTable, party: string, classCode: string) =>
  notices.noticeSuppressions.find((entry) => entry.partyId === party && entry.noticeClassCode === classCode && entry.releasedAt === null) ?? null;

/** The template version that composes a class in a language on a day: approved, and its period covers the day. */
function templateAt(notices: NoticesTable, classCode: string, language: "vi" | "en", day: string): TemplateVersion | null {
  return (
    notices.templateVersions.find(
      (version) =>
        version.classCode === classCode &&
        version.language === language &&
        version.approvedBy !== null &&
        version.effectiveFrom <= day &&
        (version.effectiveTo === null || day <= version.effectiveTo),
    ) ?? null
  );
}

function registerEntryAt(notices: NoticesTable, classCode: string, day: string): ContactRegisterEntry | null {
  return (
    notices.contactRegisterEntries.find(
      (entry) => entry.classCode === classCode && entry.effectiveFrom <= day && (entry.effectiveTo === null || day <= entry.effectiveTo),
    ) ?? null
  );
}

/**
 * The channel a contact point is reached on: an email address, a telephone number by message, and anything else
 * written as a postal address. Null where nothing was given.
 */
function channelOf(contactPoint: string | null): Channel | null {
  if (contactPoint === null || contactPoint.trim() === "") return null;
  if (contactPoint.includes("@")) return "email";
  const digits = contactPoint.replace(/\D/g, "");
  return /^[\d\s().+-]+$/.test(contactPoint.trim()) && digits.length >= 8 && digits.length <= 15 ? "sms" : "post";
}

/**
 * The delivery treatment's first answer, played from the address (see the head of this file): delivered, a
 * permanent failure the treatment does not retry, or a letter handed to the post with nothing reported yet.
 */
function providerAnswer(channel: Channel, destination: string): { outcome: OutcomeKind; response: string; source: string } {
  if (channel === "email") {
    const domain = destination.split("@").at(-1)?.trim().toLowerCase() ?? "";
    return domain === "invalid" || domain.endsWith(".invalid")
      ? { outcome: "failed", response: `550 5.1.2 Host or domain name not found: ${domain}`, source: "email-provider" }
      : { outcome: "delivered", response: "250 2.0.0 Delivered", source: "email-provider" };
  }
  if (channel === "sms") {
    const digits = destination.replace(/\D/g, "").replace(/^84/, "0");
    return /^0[35789]\d{8}$/.test(digits)
      ? { outcome: "delivered", response: "DELIVRD", source: "sms-provider" }
      : { outcome: "failed", response: "UNDELIV 1: not a mobile number", source: "sms-provider" };
  }
  return { outcome: "pending", response: "Đã giao cho bưu chính", source: "postal-service" };
}

function transition(notices: NoticesTable, notice: NoticeRow, to: NoticeState, at: string, transitionNo: number, actor: string | null = null, reasonCode: string | null = null): void {
  notices.noticeStateHistory.push({ noticeId: notice.id, fromState: notice.state, toState: to, transitionNo, actor, reasonCode, occurredAt: at });
  notice.state = to;
}

function audit(notices: NoticesTable, actor: string | null, act: string, subject: string, code: string | null, detail: Readonly<Record<string, string | number>> = {}): void {
  notices.auditLog.push({ at: now(), actor, act, subject, code, detail });
}

/**
 * The delivery treatment's reports for a notice just issued: the seed's, where the world began with them, or the
 * provider's answer played from the address. A delivered outcome moves the notice to DELIVERED (transition 5); an
 * exhausted treatment to UNDELIVERED (transition 6), and the obligation stays open.
 */
function deliver(notices: NoticesTable, notice: NoticeRow, at: string, reports: readonly SeedReport[] | null): void {
  const channel = notice.channel;
  const destination = notice.destination;
  if (channel === null || destination === null) return;
  const answers: SeedReport[] =
    reports !== null
      ? [...reports]
      : (() => {
          const answer = providerAnswer(channel, destination);
          if (answer.outcome === "delivered") {
            return [
              { attemptNo: 1, route: "primary", outcome: "attempted", response: "250 2.0.0 Queued", at, exhausted: false },
              { attemptNo: 1, route: "primary", outcome: "delivered", response: answer.response, at, exhausted: false },
            ];
          }
          if (answer.outcome === "failed") return [{ attemptNo: 1, route: "primary", outcome: "failed", response: answer.response, at, exhausted: true }];
          return [
            { attemptNo: 1, route: "primary", outcome: "attempted", response: answer.response, at, exhausted: false },
            { attemptNo: 1, route: "primary", outcome: "pending", response: answer.response, at, exhausted: false },
          ];
        })();
  const source = sourceOf(channel);
  for (const report of answers) {
    if (applyReport(notices, notice, report, "provider", source)) return;
  }
}

/** The delivery treatment's source for a channel, as the runtime stamps it on an outcome. */
const sourceOf = (channel: Channel): string => (channel === "email" ? "email-provider" : channel === "sms" ? "sms-provider" : "postal-service");

/**
 * One report written to `cases.notice_delivery_outcomes`, and what it moves on a notice still ISSUED: a delivered
 * outcome is transition 5, an exhausted treatment transition 6. A notice in any other state keeps it, the report
 * standing beside it as evidence. Answers whether the notice moved.
 */
function applyReport(notices: NoticesTable, notice: NoticeRow, report: SeedReport, reportedBy: DeliveryOutcomeRow["reportedBy"], source: string): boolean {
  notices.noticeDeliveryOutcomes.push({
    noticeId: notice.id,
    outcome: report.outcome,
    attemptNo: report.attemptNo,
    route: report.route,
    providerResponse: report.response,
    reportedBy,
    reportedSourceRef: source,
    treatmentExhausted: report.exhausted,
    reportedAt: report.at,
  });
  if (notice.state !== "ISSUED") return false;
  if (report.outcome === "delivered") {
    notice.deliveredAt = report.at;
    transition(notices, notice, "DELIVERED", report.at, 5, null, "DELIVERED");
    return true;
  }
  if (report.exhausted) {
    transition(notices, notice, "UNDELIVERED", report.at, 6, null, "TREATMENT_EXHAUSTED");
    return true;
  }
  return false;
}

/**
 * The contact point the authoritative record holds for a party now (FR-COM-009): the party is RightOne ID's
 * organisation, and its address is the one of the active principal who answers for it. Null where the organisation
 * has no active principal, which leaves a notice to it UNMET rather than sent nowhere.
 */
function partyContactPoint(party: string | null): string | null {
  if (party === null) return null;
  const principal = [...accountBook().values()].find((account) => account.role === "principal" && account.state === "active" && account.organisations.includes(party));
  return principal?.email ?? null;
}

/** Where a notice is sent: the address the raiser gave, else the one the party record holds at this instant. */
const contactPointOf = (notice: NoticeRow): string | null => notice.contactPoint ?? partyContactPoint(notice.recipientPartyId);

const wordingOf = (version: TemplateVersion): NoticeWording => {
  const sections = templateSections(version.body);
  return { templateVersion: version.versionNo, subject: sections.subject ?? "", action: sections.action ?? "", consequence: sections.consequence ?? "" };
};

/**
 * DR-134 row 1 before anything is written: the first element the content would leave empty. A worded element with no
 * words, or naming a value the event did not record, is named - by the value where the value is what is missing, so
 * a track-change notice with no playlist names `playlists` (AC-FR-COM-007-06), and a value given as a code whose words
 * name another value the event did not record names that one; then the deadline, then the contact.
 */
function emptyElement(wordings: readonly NoticeWording[], facts: NoticeRow["facts"], entry: ContactRegisterEntry): string | null {
  const absent = (name: string): boolean => facts[name] === undefined || String(facts[name]).trim() === "";
  for (const wording of wordings) {
    for (const element of WORDED_ELEMENTS) {
      const text = wording[element];
      if (text.trim() === "") return element;
      const missing = valueNames(text)
        .flatMap((name) => {
          const value = facts[name];
          return value === undefined || absent(name) ? [name] : valueWordNames(name, value).filter(absent);
        })
        .at(0);
      if (missing !== undefined) return missing;
    }
  }
  if (facts.by.trim() === "") return "deadline";
  if (entry.contactPhone.trim() === "" && entry.contactAddress.trim() === "") return "contact";
  return null;
}

/**
 * DR-134 (ALG-112) for a notice that is due: the template and the register entry in force at `at` are found, or it
 * waits DUE; it is left UNMET where the party record holds no contact point on a channel its class permits
 * (transition 2, or it stays UNMET); it waits DUE with NOTICE_ELEMENT_MISSING where the content would leave an element
 * empty; otherwise the content is written with the template's words in both languages (transition 1, or 11 from
 * UNMET), the notice is issued and the treatment reports.
 */
function composeAndIssue(notices: NoticesTable, notice: NoticeRow, noticeClass: SeedNoticeClass, at: string, reports: readonly SeedReport[] | null): void {
  const day = dayOf(at);
  const template = templateAt(notices, notice.noticeClassCode, NOTICE_LANGUAGE, day);
  if (template === null) {
    notice.waitingReason = "TEMPLATE_VERSION_NOT_EFFECTIVE";
    notice.waitingElement = null;
    return;
  }
  const entry = registerEntryAt(notices, notice.noticeClassCode, day);
  if (entry === null) {
    notice.waitingReason = "CONTACT_REGISTER_ENTRY_MISSING";
    notice.waitingElement = null;
    return;
  }
  const contactPoint = contactPointOf(notice);
  const channel = channelOf(contactPoint);
  if (channel === null || !noticeClass.channels.includes(channel)) {
    notice.waitingReason = null;
    notice.waitingElement = null;
    if (notice.state === "UNMET") return;
    notice.unmetReason = "CONTACT_POINT_ABSENT";
    transition(notices, notice, "UNMET", at, 2, null, "CONTACT_POINT_ABSENT");
    return;
  }
  const english = templateAt(notices, notice.noticeClassCode, "en", day);
  const wording = { vi: wordingOf(template), en: english !== null ? wordingOf(english) : null };
  const empty = emptyElement(wording.en !== null ? [wording.vi, wording.en] : [wording.vi], notice.facts, entry);
  if (empty !== null) {
    notice.waitingReason = "NOTICE_ELEMENT_MISSING";
    notice.waitingElement = empty;
    return;
  }
  notice.waitingReason = null;
  notice.waitingElement = null;
  const { by, ...values } = notice.facts;
  notice.destination = contactPoint;
  notice.channel = channel;
  notices.noticeContent.set(notice.id, {
    noticeId: notice.id,
    templateVersionId: template.id,
    contactRegisterEntryId: entry.id,
    wording,
    values,
    deadline: by,
    recordVersions: { [notice.subjectKind]: notice.subjectRef, ...notice.recordVersions },
    composedAt: at,
  });
  const from = notice.state;
  transition(notices, notice, "COMPOSED", at, from === "UNMET" ? 11 : 1, null, noticeClass.requiredActionRule === "states_action" ? "READY_TO_DISPATCH" : "NO_ACTION_REQUIRED_STATED");
  if (from === "UNMET") notice.unmetReason = null;
  notice.issuedAt = at;
  transition(notices, notice, "ISSUED", at, 4, null, "DISPATCHABLE");
  deliver(notices, notice, at, reports);
}

/**
 * DR-132 rows 1 to 3: a class with a lead time falls due that many days before the date its subject carries, or
 * when the subject was recorded where that has already passed; any other falls due at the event.
 */
function dueInstant(noticeClass: SeedNoticeClass, event: NoticeEvent): string {
  if (noticeClass.leadTimeDays === null || !/^\d{4}-\d{2}-\d{2}$/.test(event.facts.by)) return event.occurredAt;
  const lead = new Date(`${event.facts.by}T00:00:00+07:00`);
  lead.setUTCDate(lead.getUTCDate() - noticeClass.leadTimeDays);
  return laterOf(lead.toISOString(), event.occurredAt);
}

const classOfNotice = (notices: NoticesTable, notice: NoticeRow): NoticeClassRow | undefined =>
  notices.noticeClasses.find((entry) => entry.noticePolicyVersionId === notice.noticePolicyVersionId && entry.classCode === notice.noticeClassCode);

/** A new reference in the notice's form, never one the world already holds. */
function freshReference(notices: NoticesTable): string {
  let reference = newReference("COM");
  while (notices.notices.has(reference)) reference = newReference("COM");
  return reference;
}

const answer = (reasonCode: string, reference: string | null = null, dueAt: string | null = null, refused = false): NoticeEventAnswer => ({ reference, dueAt, reasonCode, refused });

/**
 * DR-131 to DR-134 for one event (ALG-111). An event with no occurrence reference, or about a subject its class is not
 * about, is refused and records nothing but the attempt (a 422 rolls the event row back). Otherwise the event is
 * recorded, and the class is the one the caller names or the one stating the event in the policy in force at the
 * event; a class named that the policy does not state is NOTICE_CLASS_UNKNOWN, an event no class states
 * NO_CLASS_FOR_EVENT - both kept in the audit log, so an event that raised nothing is never lost from sight. A replay
 * of an occurrence already noticed returns that notice; an optional class the recipient has suppressed is not raised;
 * otherwise the notice falls due (DR-132) and, once due, is composed and issued. `issueAt` is the instant it is
 * issued where that comes after the event (a run continued later); `device` is the premises' device a track-change
 * notice records beside it.
 */
function raise(
  notices: NoticesTable,
  event: NoticeEvent,
  options: { reports?: readonly SeedReport[] | null; issueAt?: string; device?: DeviceCondition } = {},
): NoticeEventAnswer {
  if (event.occurrenceRef.trim() === "") {
    // OCCURRENCE_REF_MISSING: nothing could tell a repeat of this event from a second one, so it raises nothing.
    audit(notices, null, "record_event", event.eventKind, "OCCURRENCE_REF_MISSING", { module: event.sourceModule });
    return answer("OCCURRENCE_REF_MISSING", null, null, true);
  }
  const version = policyAt(notices, event.occurredAt);
  const asserted = event.classCode !== undefined && event.classCode.trim() !== "" ? event.classCode.trim() : null;
  const noticeClass =
    version === null ? undefined : classesOf(notices, version).find((entry) => (asserted !== null ? entry.classCode === asserted : entry.eventKind === event.eventKind));
  if (noticeClass !== undefined && !noticeClass.subjectKinds.includes(event.subjectKind)) {
    audit(notices, null, "record_event", event.eventKind, "SUBJECT_KIND_UNKNOWN", { module: event.sourceModule, class: noticeClass.classCode, subject_kind: event.subjectKind });
    return answer("SUBJECT_KIND_UNKNOWN", null, null, true);
  }
  const recorded: NoticeEventRow = {
    id: randomUUID(),
    occurredAt: event.occurredAt,
    sourceModule: event.sourceModule,
    eventKind: event.eventKind,
    occurrenceRef: event.occurrenceRef,
    subjectKind: event.subjectKind,
    subjectRef: event.subjectRef,
    recipientPartyId: event.recipientPartyId,
    raisedNotice: false,
    noObligationReason: null,
  };
  notices.noticeEvents.push(recorded);
  const noIssue = (reason: string, reference: string | null = null): NoticeEventAnswer => {
    recorded.noObligationReason = reason;
    if (reason !== "NOTICE_ALREADY_ISSUED" && reason !== "SUPPRESSED_BY_PREFERENCE") {
      audit(notices, null, "record_event", event.eventKind, reason, { module: event.sourceModule, ...(asserted !== null ? { class: asserted } : {}) });
    }
    return answer(reason, reference);
  };
  if (version === null) return noIssue("POLICY_NOT_CONFIGURED");
  if (noticeClass === undefined) return noIssue(asserted !== null ? "NOTICE_CLASS_UNKNOWN" : "NO_CLASS_FOR_EVENT");
  const existing = [...notices.notices.values()].find(
    (notice) => notice.noticeClassCode === noticeClass.classCode && notice.occurrenceRef === event.occurrenceRef && notice.state !== "SUPERSEDED",
  );
  if (existing !== undefined) return noIssue("NOTICE_ALREADY_ISSUED", existing.reference);
  if (!noticeClass.isRequired && event.recipientPartyId !== null && suppressionOf(notices, event.recipientPartyId, noticeClass.classCode) !== null) {
    return noIssue("SUPPRESSED_BY_PREFERENCE");
  }
  recorded.raisedNotice = true;
  const reference = freshReference(notices);
  const notice: NoticeRow = {
    id: randomUUID(),
    reference,
    noticeClassCode: noticeClass.classCode,
    noticePolicyVersionId: version.id,
    noticeEventId: recorded.id,
    occurrenceRef: event.occurrenceRef,
    subjectKind: event.subjectKind,
    subjectRef: event.subjectRef,
    recipientPartyId: event.recipientPartyId,
    recipientRole: noticeClass.recipientRole,
    contactPoint: event.destination,
    destination: null,
    channel: null,
    state: "DUE",
    unmetReason: null,
    waitingReason: null,
    waitingElement: null,
    dueAt: dueInstant(noticeClass, event),
    issuedAt: null,
    deliveredAt: null,
    isRequired: noticeClass.isRequired,
    requiresProof: noticeClass.requiresProof,
    supersedesNoticeId: null,
    reissueReason: null,
    withdrawnReason: null,
    withdrawnBy: null,
    withdrawnAt: null,
    deviceCondition: options.device ?? null,
    facts: event.facts,
    recordVersions: event.recordVersions ?? {},
  };
  notices.notices.set(reference, notice);
  const reason = noticeClass.isRequired ? "CLASS_REQUIRED" : "CLASS_OPTIONAL";
  notices.noticeStateHistory.push({ noticeId: notice.id, fromState: null, toState: "DUE", transitionNo: null, actor: null, reasonCode: reason, occurredAt: event.occurredAt });
  audit(notices, null, "raise_notice", reference, null, { module: event.sourceModule, class: noticeClass.classCode, occurrence: event.occurrenceRef });
  // A notice not yet due waits for its instant (`settle`); one due is issued then, or later where a run continues.
  const issueAt = options.issueAt ?? event.occurredAt;
  if (notAfter(notice.dueAt, now())) composeAndIssue(notices, notice, noticeClass, laterOf(issueAt, notice.dueAt), options.reports ?? null);
  return answer(reason, reference, notice.dueAt);
}

/** The open states of an obligation: owed and not yet discharged (SM-121). */
const OPEN: readonly NoticeState[] = ["DUE", "COMPOSED", "UNMET", "UNDELIVERED"];

/** The SM-121 transition that closes an open notice unserved, by the state it leaves. */
const WITHDRAWAL_TRANSITION: Readonly<Partial<Record<NoticeState, number>>> = { DUE: 3, COMPOSED: 13, UNMET: 14, UNDELIVERED: 8 };

function closeUnserved(notices: NoticesTable, notice: NoticeRow, by: string, reason: string, at: string): void {
  transition(notices, notice, "WITHDRAWN", at, WITHDRAWAL_TRANSITION[notice.state] ?? 3, by, "CLASS_WITHDRAWN");
  notice.withdrawnBy = by;
  notice.withdrawnReason = reason;
  notice.withdrawnAt = at;
}

/** Whether the policy in force now states a class as required (DR-135's "class still required"). */
function requiredNow(notices: NoticesTable, classCode: string): boolean {
  const version = policyAt(notices, now());
  return version !== null && classesOf(notices, version).some((entry) => entry.classCode === classCode && entry.isRequired);
}

/**
 * What arrives with time, applied when the table is read: an approved policy version whose effective date has come
 * takes effect and the one it ends is superseded (SM-122 transitions 3 and 5); a required notice still owed whose
 * class the version taking effect no longer states as required is closed unserved, under its approver (SM-121
 * transitions 3, 13, 14 and 8, AC-FR-COM-013-05); a notice that has fallen due is composed from whatever is in force
 * now (the composition run), and one UNMET is sent once the party record holds an address (transition 11).
 */
function settle(notices: NoticesTable): void {
  const day = today();
  const instant = now();
  for (const version of notices.noticePolicyVersions) {
    if (version.state !== "APPROVED" || version.effectiveFrom > day) continue;
    version.state = "EFFECTIVE";
    const required = new Set(classesOf(notices, version).filter((entry) => entry.isRequired).map((entry) => entry.classCode));
    for (const notice of notices.notices.values()) {
      if (!notice.isRequired || !OPEN.includes(notice.state) || required.has(notice.noticeClassCode)) continue;
      closeUnserved(notices, notice, version.approvedBy ?? "", `POLICY_VERSION_${version.versionNo}`, instant);
      audit(notices, version.approvedBy, "withdraw_notice", notice.reference, null, { policy_version: version.versionNo });
    }
  }
  for (const version of notices.noticePolicyVersions) {
    if (version.state === "EFFECTIVE" && version.effectiveTo !== null && version.effectiveTo < day) version.state = "SUPERSEDED";
  }
  for (const notice of notices.notices.values()) {
    if ((notice.state !== "DUE" && notice.state !== "UNMET") || !notAfter(notice.dueAt, instant)) continue;
    const noticeClass = classOfNotice(notices, notice);
    if (noticeClass !== undefined) composeAndIssue(notices, notice, noticeClass, instant, null);
  }
}

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const accept = <T>(accepted: T): NoticeAnswer<T> => ({ accepted, refusal: null });
const refuse = (code: string, field: string | null = null, values: Readonly<Record<string, string | number>> = {}): NoticeAnswer<never> => ({
  accepted: null,
  refusal: { code, field, values },
});

/** A refused act, recorded with the reader and the instant before it is answered: the attempt is the evidence. */
function refusedAct(
  notices: NoticesTable,
  actor: string | null,
  act: string,
  subject: string,
  code: string,
  field: string | null = null,
  values: Readonly<Record<string, string | number>> = {},
): NoticeAnswer<never> {
  audit(notices, actor, act, subject, code);
  return refuse(code, field, values);
}

/** A refused read, recorded the same way: a refused read of a notice is what an assurance reader most wants to see. */
function refusedReadOf(notices: NoticesTable, actor: string | null, act: string, subject: string, code: string): LoadOutcome<never> {
  audit(notices, actor, act, subject, code);
  return refusedRead(code);
}

function contentOf(notices: NoticesTable, notice: NoticeRow): NoticeContent | null {
  const content = notices.noticeContent.get(notice.id);
  if (content === undefined) return null;
  const entry = notices.contactRegisterEntries.find((candidate) => candidate.id === content.contactRegisterEntryId);
  const template = notices.templateVersions.find((candidate) => candidate.id === content.templateVersionId);
  if (entry === undefined || template === undefined) return null;
  return {
    classCode: notice.noticeClassCode,
    templateVersion: template.versionNo,
    wording: content.wording,
    values: content.values,
    deadline: content.deadline,
    contact: { role: entry.contactRole, phone: entry.contactPhone, address: entry.contactAddress },
    recordVersions: content.recordVersions,
    composedAt: content.composedAt,
  };
}

/** What the recipient was sent: a notice issued, whatever happened to it since. */
const SENT: readonly NoticeState[] = ["ISSUED", "DELIVERED", "UNDELIVERED", "SERVED_ALTERNATIVELY", "SUPERSEDED"];

function summaryOf(notices: NoticesTable, notice: NoticeRow): NoticeSummary {
  return { reference: notice.reference, classCode: notice.noticeClassCode, state: notice.state, issuedAt: notice.issuedAt, content: contentOf(notices, notice) };
}

const serviceOf = (notices: NoticesTable, notice: NoticeRow) => notices.alternativeServices.find((entry) => entry.noticeId === notice.id) ?? null;

const noticeById = (notices: NoticesTable, id: string): NoticeRow | undefined => [...notices.notices.values()].find((candidate) => candidate.id === id);

/** The reissue that replaced a notice, and the instant it did (the original's move to SUPERSEDED). */
const successorOf = (notices: NoticesTable, notice: NoticeRow): NoticeRow | undefined => [...notices.notices.values()].find((candidate) => candidate.supersedesNoticeId === notice.id);
const successorOn = (notices: NoticesTable, successor: NoticeRow): string =>
  notices.noticeStateHistory.find((row) => row.noticeId === successor.id && row.fromState === null)?.occurredAt ?? successor.dueAt;

/** When the obligation was first issued: the notice's own issue, or that of the notice it was reissued in place of. */
function firstIssueOf(notices: NoticesTable, notice: NoticeRow): string | null {
  let issued = notice.issuedAt;
  let current = notice;
  while (current.supersedesNoticeId !== null) {
    const previous = noticeById(notices, current.supersedesNoticeId);
    if (previous === undefined) break;
    current = previous;
    issued = previous.issuedAt ?? issued;
  }
  return issued;
}

/** Whole calendar days from one ISO day to another. */
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// ---------------------------------------------------------------- what other families call

/**
 * POST /notice-events, as another family raises it in process (RightOne.Modules.Cases.Contracts): the event is
 * recorded, and the notice its class requires is raised and issued. Returns the notice's reference (the one already
 * issued, where the occurrence was noticed before), or null when the policy in force requires none. An event that
 * raised nothing is kept in the audit log with its reason and shown on SCR-COM-16; `raiseNoticeEvent` gives the
 * reason to a caller that branches on it.
 */
export function recordNoticeEvent(key: string, event: NoticeEvent): string | null {
  return raise(noticesTable(key), event).reference;
}

/** POST /notice-events with DR-131's answer: the notice and its due instant, or the reason none was raised. */
export function raiseNoticeEvent(key: string, event: NoticeEvent): NoticeEventAnswer {
  return raise(noticesTable(key), event);
}

/**
 * `INoticeObligations.StateOf`, for the family that raised a notice: its state and the instant it falls due (CER
 * enters a record into the expiring state at its expiry notice's due instant, `DR-434`), and the instant the provider
 * reported it delivered (VER records that as its record's delivery, `DR-744` row 2). Null for no such notice.
 */
export function noticeStateOf(key: string, reference: string): { state: NoticeState; dueAt: string; deliveredAt: string | null } | null {
  const notice = noticesTable(key).notices.get(reference);
  return notice === undefined ? null : { state: notice.state, dueAt: notice.dueAt, deliveredAt: notice.deliveredAt };
}

/**
 * Where a notice to a role of the gateway rather than to a party is sent (FR-COM-018, `CFG-164`): the address of the
 * office the authoritative contact register names now for the class the policy in force states the event with. A
 * family raising a notice its specification addresses to ACT-OPS, ACT-SEC or ACT-EVD passes it as the destination, so
 * the notice is issued to that office; with no party and no address it would wait UNMET for an address no party record
 * holds. Null where the policy states no class for the event, or the register holds no address for it.
 */
export function officeDestinationOf(key: string, eventKind: string): string | null {
  const notices = noticesTable(key);
  const instant = now();
  const version = policyAt(notices, instant);
  const noticeClass = version === null ? undefined : classesOf(notices, version).find((entry) => entry.eventKind === eventKind);
  const address = noticeClass === undefined ? "" : (registerEntryAt(notices, noticeClass.classCode, dayOf(instant))?.contactAddress.trim() ?? "");
  return address !== "" ? address : null;
}

// ---------------------------------------------------------------- the recipient's reads

/** The notices a party was sent, newest first: what the families that raised them read back. */
export function noticesTo(key: string, party: string): LoadOutcome<readonly NoticeSummary[]> {
  const notices = noticesTable(key);
  const sent = [...notices.notices.values()].filter((notice) => notice.recipientPartyId === party && SENT.includes(notice.state));
  return ok(sent.sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? "")).map((notice) => summaryOf(notices, notice)));
}

/**
 * The premises a notice is about, where its raiser names one: the premises a track-change run told, by its id, or the
 * premises the facts name, by its trading name as the raising families write it. Null for a notice about the party as
 * a whole - a case, a newsletter - or one whose raiser names no premises.
 */
function premisesOfNotice(notices: NoticesTable, notice: NoticeRow): { id: string } | { name: string } | null {
  const told = notices.trackChangeRecipients.find((recipient) => recipient.noticeId === notice.id);
  if (told !== undefined) return { id: told.premisesId };
  const name = notice.facts.premises;
  return typeof name === "string" && name.trim() !== "" ? { name } : null;
}

/**
 * Whether the person a premises-portal session signs in as may read a notice to their party, as PTY answers now
 * (DR-201): its principal every one; a delegate one about a premises her delegation lets her read, and none about
 * another premises or about the party as a whole. Reading a notice has no permission entry of its own (FR-COM-017;
 * PERM-296 is the statement), so the scope a delegation names for reading is asked. A session PTY answers for nobody
 * - a revoked delegate - reads none; a reader with no account reads on the reference alone.
 */
function readsUnderAuthority(key: string, notices: NoticesTable, notice: NoticeRow, reader: NoticeReader): boolean {
  if (reader.party === null) return true;
  const acting = actingAs(key);
  if (acting === null) return false;
  if (acting.actor === "PRINCIPAL") return true;
  const about = premisesOfNotice(notices, notice);
  if (about === null) return false;
  return "id" in about ? mayActFor(key, about.id, "READ") : premisesActableBy(key, "READ").some((premises) => premises.name === about.name);
}

/**
 * The premises portal's Notices: the notices the party was sent, newest first, that PTY lets the person signed in read
 * - every one for the principal, a delegate's about her premises. A session PTY answers for nobody is ROLE_OUT_OF_SCOPE,
 * recorded.
 */
export function noticesFor(sessionId: string, party: string): LoadOutcome<readonly NoticeSummary[]> {
  const notices = noticesTable(sessionId);
  if (actingAs(sessionId) === null) return refusedReadOf(notices, null, "list", party, "ROLE_OUT_OF_SCOPE");
  const reader = { party, account: null };
  const sent = [...notices.notices.values()].filter((notice) => notice.recipientPartyId === party && SENT.includes(notice.state) && readsUnderAuthority(sessionId, notices, notice, reader));
  return ok(sent.sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? "")).map((notice) => summaryOf(notices, notice)));
}

/**
 * GET /notices/{reference}: the reference is the credential, so anyone holding it reads the notice, and the read
 * is recorded either way. A reference that names no notice the recipient was sent is NOTICE_NOT_FOUND; a
 * signed-in reader it was not addressed to is ROLE_OUT_OF_SCOPE. The address it went to is the recipient's to read.
 */
export function noticeRead(key: string, reference: string, reader: NoticeReader): LoadOutcome<NoticeView> {
  const notices = noticesTable(key);
  const notice = notices.notices.get(reference.trim().toUpperCase());
  if (notice === undefined || !SENT.includes(notice.state)) {
    audit(notices, reader.account, "read", reference, "NOTICE_NOT_FOUND");
    return refusedRead("NOTICE_NOT_FOUND");
  }
  if (reader.party !== null && (notice.recipientPartyId !== reader.party || !readsUnderAuthority(key, notices, notice, reader))) {
    audit(notices, reader.account, "read", reference, "ROLE_OUT_OF_SCOPE");
    return refusedRead("ROLE_OUT_OF_SCOPE");
  }
  audit(notices, reader.account, "read", reference, null);
  const successor = successorOf(notices, notice);
  const original = notice.supersedesNoticeId !== null ? noticeById(notices, notice.supersedesNoticeId) : undefined;
  const service = serviceOf(notices, notice);
  const deadline = notices.noticeContent.get(notice.id)?.deadline ?? null;
  const issuedOn = notice.issuedAt !== null ? dayOf(notice.issuedAt) : null;
  return ok({
    ...summaryOf(notices, notice),
    supersededBy: successor !== undefined ? { reference: successor.reference, on: successorOn(notices, successor) } : null,
    replaces: original !== undefined ? { reference: original.reference, reason: notice.reissueReason ?? "" } : null,
    remainingDays: deadline !== null && issuedOn !== null && /^\d{4}-\d{2}-\d{2}$/.test(deadline) && deadline >= issuedOn ? daysBetween(issuedOn, deadline) : null,
    own: reader.party !== null,
    delivery: {
      channel: notice.channel,
      destination: notice.destination,
      deliveredAt: notice.deliveredAt,
      service: service !== null ? { route: service.route, servedOn: service.servedOn } : null,
    },
  });
}

/**
 * Whose preferences a reader may see and change: their own party, signed in; otherwise the party of the notice
 * they hold the reference of (null for a recipient known only by the address they gave). A suppression is held for
 * the party as a whole (PERM-291), and a delegation names premises, so signed in only the party's principal, as PTY
 * answers now, sees and changes them; a delegate, or a session PTY answers for nobody, is ROLE_OUT_OF_SCOPE.
 */
function recipientOf(key: string, notices: NoticesTable, reader: NoticeReader, noticeRef: string | null): { party: string | null } | { refusal: string } {
  if (reader.party !== null && actingAs(key)?.actor !== "PRINCIPAL") return { refusal: "ROLE_OUT_OF_SCOPE" };
  if (noticeRef === null) return reader.party !== null ? { party: reader.party } : { refusal: "NOTICE_NOT_FOUND" };
  const notice = notices.notices.get(noticeRef.trim().toUpperCase());
  if (notice === undefined || !SENT.includes(notice.state)) return { refusal: "NOTICE_NOT_FOUND" };
  if (reader.party !== null && notice.recipientPartyId !== reader.party) return { refusal: "ROLE_OUT_OF_SCOPE" };
  return { party: notice.recipientPartyId };
}

/**
 * GET /suppressions, as SCR-COM-12 reads it: every class of the policy in force that can reach this recipient - a
 * party is sent the classes addressed to a raiser, a premises' party or an applicant; an address alone, a raiser's -
 * each required or not, and whether it reaches them now.
 */
export function noticePreferences(key: string, reader: NoticeReader, noticeRef: string | null): LoadOutcome<NoticePreferences> {
  const notices = noticesTable(key);
  const subject = noticeRef ?? reader.party ?? "*";
  const recipient = recipientOf(key, notices, reader, noticeRef);
  if ("refusal" in recipient) return refusedReadOf(notices, reader.account, "read_suppressions", subject, recipient.refusal);
  const version = policyAt(notices, now());
  if (version === null) return refusedReadOf(notices, reader.account, "read_suppressions", subject, "NOTICE_CLASS_UNKNOWN");
  const { party } = recipient;
  const classes = classesOf(notices, version)
    .filter((entry) => (party !== null ? PARTY_ROLES.includes(entry.recipientRole) : entry.recipientRole === "raiser"))
    .map((entry) => ({
      classCode: entry.classCode,
      required: entry.isRequired,
      receiving: entry.isRequired || party === null || suppressionOf(notices, party, entry.classCode) === null,
    }));
  return ok({ party, classes });
}

/**
 * Save on SCR-COM-12: for each class whose choice differs from what is in force, a suppression recorded or
 * released. A required class is refused SUPPRESSION_NOT_PERMITTED naming it, the attempt is recorded and no
 * suppression row is written (AC-FR-COM-010-03, -04).
 */
export function recordPreferences(
  key: string,
  reader: NoticeReader,
  noticeRef: string | null,
  receive: Readonly<Record<string, boolean>>,
): LoadOutcome<{ refused: readonly string[] }> {
  const notices = noticesTable(key);
  const subject = noticeRef ?? reader.party ?? "*";
  const recipient = recipientOf(key, notices, reader, noticeRef);
  if ("refusal" in recipient) return refusedReadOf(notices, reader.account, "suppress", subject, recipient.refusal);
  const version = policyAt(notices, now());
  if (version === null) return refusedReadOf(notices, reader.account, "suppress", subject, "NOTICE_CLASS_UNKNOWN");
  const classes = classesOf(notices, version);
  const { party } = recipient;
  const refused: string[] = [];
  for (const [classCode, wanted] of Object.entries(receive)) {
    const noticeClass = classes.find((entry) => entry.classCode === classCode);
    if (noticeClass === undefined) return refusedReadOf(notices, reader.account, "suppress", classCode, "NOTICE_CLASS_UNKNOWN");
    if (party === null) continue;
    const inForce = suppressionOf(notices, party, classCode);
    if (!wanted && noticeClass.isRequired) {
      audit(notices, reader.account, "suppress", classCode, "SUPPRESSION_NOT_PERMITTED");
      refused.push(classCode);
    } else if (!wanted && inForce === null) {
      notices.noticeSuppressions.push({ id: randomUUID(), partyId: party, noticeClassCode: classCode, recordedAt: now(), releasedAt: null });
      audit(notices, reader.account, "suppress", classCode, null);
    } else if (wanted && inForce !== null) {
      inForce.releasedAt = now();
      audit(notices, reader.account, "release", classCode, null);
    }
  }
  return ok({ refused });
}

// ---------------------------------------------------------------- the console: who may

const holds = (officer: NoticeOfficer, ...roles: readonly StaffRole[]) => roles.some((role) => officer.roles.includes(role));

/** ROLE_NOT_ASSIGNED for a reader holding none of the roles, recorded; null when they hold one. */
function unassigned(notices: NoticesTable, officer: NoticeOfficer, act: string, subject: string, roles: readonly StaffRole[]): string | null {
  if (holds(officer, ...roles)) return null;
  audit(notices, officer.name, act, subject, "ROLE_NOT_ASSIGNED");
  return "ROLE_NOT_ASSIGNED";
}

// ---------------------------------------------------------------- policy versions (SCR-COM-01, 02, 03)

const versionByNo = (notices: NoticesTable, versionNo: number) => notices.noticePolicyVersions.find((version) => version.versionNo === versionNo) ?? null;

const sentAtOf = (notices: NoticesTable, version: NoticePolicyVersion): string | null =>
  notices.auditLog.filter((row) => row.act === "send_for_approval" && row.subject === String(version.versionNo) && row.code === null).at(-1)?.at ?? null;

function versionRow(notices: NoticesTable, version: NoticePolicyVersion): PolicyVersionRow {
  return {
    versionNo: version.versionNo,
    state: version.state,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    classCount: classesOf(notices, version).length,
    preparedBy: version.preparedBy,
    preparedAt: version.preparedAt,
    approvedBy: version.approvedBy,
    approvedAt: version.approvedAt,
    sentAt: sentAtOf(notices, version),
    withdrawnReason: version.withdrawnReason,
  };
}

function classView(entry: SeedNoticeClass): NoticeClassView {
  return {
    classCode: entry.classCode,
    eventKind: entry.eventKind,
    recipientRole: entry.recipientRole,
    channels: entry.channels,
    subjectKinds: entry.subjectKinds,
    isRequired: entry.isRequired,
    requiresProof: entry.requiresProof,
    leadTimeDays: entry.leadTimeDays,
    requiredActionRule: entry.requiredActionRule,
  };
}

/** The day `as_of` asks for (R1.11's explicit evaluation instant); null where none was, or it is no day. */
const asOfDay = (asOf: string | null): string | null => (asOf !== null && /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : null);

/**
 * GET /notice-policy-versions: every version, newest first, and the one in force on the day `as_of` names - today
 * where none is asked. A notice issued last year is explained by the version in force on its day, not today's.
 */
export function policyVersions(key: string, officer: NoticeOfficer, asOf: string | null = null): LoadOutcome<PolicyVersions> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_policy_versions", "*", ["ACT-OPS", "ACT-BIZ-APR"]);
  if (role !== null) return refusedRead(role);
  const versions = [...notices.noticePolicyVersions].sort((a, b) => b.versionNo - a.versionNo).map((version) => versionRow(notices, version));
  const day = asOfDay(asOf);
  const inForce = policyAt(notices, day !== null ? `${day}T12:00:00+07:00` : now());
  return ok({ versions, inForce: inForce?.versionNo ?? null, asOf: day, canPrepare: holds(officer, "ACT-OPS") });
}

/**
 * POST /notice-policy-versions: a version PREPARED for its period. Where the preparer asks, the classes of the
 * version in force are restated on it, one POST /classes each, so a version that changes one class does not have
 * to be typed out again.
 */
export function preparePolicyVersion(
  key: string,
  officer: NoticeOfficer,
  input: { effectiveFrom: string | null; effectiveTo: string | null; unreadable: boolean; restate: boolean },
): NoticeAnswer<{ versionNo: number }> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "prepare_policy_version", "*", ["ACT-OPS"]);
  if (role !== null) return refuse(role);
  if (input.unreadable || input.effectiveFrom === null) return refusedAct(notices, officer.name, "prepare_policy_version", "*", "PERIOD_INVALID", "from");
  if (input.effectiveTo !== null && input.effectiveTo < input.effectiveFrom) {
    return refusedAct(notices, officer.name, "prepare_policy_version", "*", "PERIOD_INVALID", "to", { from: input.effectiveFrom, to: input.effectiveTo });
  }
  const versionNo = Math.max(0, ...notices.noticePolicyVersions.map((version) => version.versionNo)) + 1;
  const version: NoticePolicyVersion = {
    id: randomUUID(),
    versionNo,
    state: "PREPARED",
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    preparedBy: officer.name,
    preparedAt: now(),
    approvedBy: null,
    approvedAt: null,
    withdrawnReason: null,
  };
  notices.noticePolicyVersions.push(version);
  audit(notices, officer.name, "prepare_policy_version", String(versionNo), null, { from: input.effectiveFrom });
  const inForce = policyAt(notices, now());
  if (input.restate && inForce !== null) {
    for (const entry of classesOf(notices, inForce)) {
      notices.noticeClasses.push({ ...entry, id: randomUUID(), noticePolicyVersionId: version.id });
      audit(notices, officer.name, "add_class", `${versionNo}:${entry.classCode}`, null);
    }
  }
  return accept({ versionNo });
}

/** GET /notice-policy-versions/{id}/classes: the version and its classes, and what the reader may do to it. */
export function policyVersion(key: string, officer: NoticeOfficer, versionNo: number): LoadOutcome<PolicyVersionView> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_policy_version", String(versionNo), ["ACT-OPS", "ACT-BIZ-APR"]);
  if (role !== null) return refusedRead(role);
  const version = versionByNo(notices, versionNo);
  if (version === null) return refusedReadOf(notices, officer.name, "read_policy_version", String(versionNo), "POLICY_VERSION_NOT_FOUND");
  const classes = classesOf(notices, version);
  return ok({
    version: versionRow(notices, version),
    classes: classes.map(classView),
    addable: CLASS_REGISTER.filter((entry) => !classes.some((stated) => stated.classCode === entry.classCode)),
    preparer: holds(officer, "ACT-OPS"),
    approver: holds(officer, "ACT-BIZ-APR"),
    inForceClasses: (() => {
      const inForce = policyAt(notices, now());
      return inForce !== null ? classesOf(notices, inForce).map((entry) => entry.classCode) : [];
    })(),
  });
}

const RECIPIENT_ROLES: readonly RecipientRole[] = ["raiser", "premises_party", "applicant", "artist", "payee", "purchaser", "affected_person", "figure_recipient", "operations_officer"];
const CHANNELS: readonly Channel[] = ["email", "sms", "post", "portal"];

/**
 * POST /notice-policy-versions/{id}/classes. Both designations have no default and a class with either unstated
 * is refused CLASS_DESIGNATION_MISSING beside it; a negative lead time LEAD_TIME_INVALID; a version past PREPARED
 * POLICY_VERSION_NOT_PREPARED naming its state. A class already stated is returned as it is.
 */
export function addPolicyClass(key: string, officer: NoticeOfficer, versionNo: number, input: ClassInput): NoticeAnswer<{ classCode: string }> {
  const notices = noticesTable(key);
  const subject = `${versionNo}:${input.classCode}`;
  const role = unassigned(notices, officer, "add_class", subject, ["ACT-OPS"]);
  if (role !== null) return refuse(role);
  const version = versionByNo(notices, versionNo);
  // AC-FR-COM-008-11: nothing is disclosed about any other version, and the attempt is recorded.
  if (version === null) return refusedAct(notices, officer.name, "add_class", subject, "POLICY_VERSION_NOT_FOUND");
  if (version.state !== "PREPARED") return refusedAct(notices, officer.name, "add_class", subject, "POLICY_VERSION_NOT_PREPARED", null, { state: version.state });
  const register = CLASS_REGISTER.find((entry) => entry.classCode === input.classCode);
  if (register === undefined) return refusedAct(notices, officer.name, "add_class", subject, "NOTICE_CLASS_UNKNOWN", "class", { class_name: input.classCode });
  if (classesOf(notices, version).some((entry) => entry.classCode === input.classCode)) return accept({ classCode: input.classCode });
  const fail = (code: string, field: string) => {
    audit(notices, officer.name, "add_class", subject, code);
    return refuse(code, field, { class_name: input.classCode });
  };
  if (input.isRequired === null) return fail("CLASS_DESIGNATION_MISSING", "required");
  if (input.requiresProof === null) return fail("CLASS_DESIGNATION_MISSING", "proof");
  const lead = input.leadTimeDays.trim();
  if (lead !== "" && (!/^-?\d+$/.test(lead) || Number(lead) < 0)) return fail("LEAD_TIME_INVALID", "lead");
  if (register.subjectDate && lead === "") return fail("CLASS_DESIGNATION_MISSING", "lead");
  const recipientRole = RECIPIENT_ROLES.find((entry) => entry === input.recipientRole);
  const channels = CHANNELS.filter((channel) => input.channels.includes(channel));
  const actionRule = input.requiredActionRule === "states_action" || input.requiredActionRule === "states_no_action" ? input.requiredActionRule : null;
  if (recipientRole === undefined) return fail("CLASS_DESIGNATION_MISSING", "recipient");
  if (channels.length === 0) return fail("CLASS_DESIGNATION_MISSING", "channels");
  if (input.subjectKinds.length === 0) return fail("CLASS_DESIGNATION_MISSING", "subjects");
  if (actionRule === null) return fail("CLASS_DESIGNATION_MISSING", "action");
  notices.noticeClasses.push({
    id: randomUUID(),
    noticePolicyVersionId: version.id,
    classCode: input.classCode,
    eventKind: input.eventKind.trim() !== "" ? input.eventKind.trim() : register.eventKind,
    recipientRole,
    channels,
    subjectKinds: input.subjectKinds,
    isRequired: input.isRequired,
    requiresProof: input.requiresProof,
    leadTimeDays: lead === "" ? null : Number(lead),
    requiredActionRule: actionRule,
    retentionMonths: 24,
  });
  audit(notices, officer.name, "add_class", subject, null);
  return accept({ classCode: input.classCode });
}

/** The first class of a version that does not state both designations, or a lead time its dated subject needs. */
function undesignated(notices: NoticesTable, version: NoticePolicyVersion): string | null {
  for (const entry of classesOf(notices, version)) {
    const register = CLASS_REGISTER.find((candidate) => candidate.classCode === entry.classCode);
    if (register?.subjectDate === true && entry.leadTimeDays === null) return entry.classCode;
  }
  return null;
}

/** Send for approval on SCR-COM-02: refused CLASS_DESIGNATION_MISSING naming the class; recorded for the approver. */
export function sendForApproval(key: string, officer: NoticeOfficer, versionNo: number): NoticeAnswer<{ sentAt: string }> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "send_for_approval", String(versionNo), ["ACT-OPS"]);
  if (role !== null) return refuse(role);
  const version = versionByNo(notices, versionNo);
  if (version === null) return refusedAct(notices, officer.name, "send_for_approval", String(versionNo), "POLICY_VERSION_NOT_FOUND");
  if (version.state !== "PREPARED") return refusedAct(notices, officer.name, "send_for_approval", String(versionNo), "POLICY_VERSION_NOT_PREPARED", null, { state: version.state });
  const missing = undesignated(notices, version);
  if (missing !== null) {
    audit(notices, officer.name, "send_for_approval", String(versionNo), "CLASS_DESIGNATION_MISSING");
    return refuse("CLASS_DESIGNATION_MISSING", null, { class_name: missing });
  }
  audit(notices, officer.name, "send_for_approval", String(versionNo), null);
  return accept({ sentAt: now() });
}

const dayBefore = (day: string): string => addDays(`${day}T12:00:00+07:00`, -1);

/**
 * The version a new period collides with: any approved or effective version whose period it shares a day with. The
 * latest version, open-ended and starting earlier, is not a collision: approving the new one ends it the day before.
 */
function collision(notices: NoticesTable, candidate: { versionNo: number; effectiveFrom: string; effectiveTo: string | null }): NoticePolicyVersion | null {
  return (
    notices.noticePolicyVersions.find((other) => {
      if (other.versionNo === candidate.versionNo || (other.state !== "APPROVED" && other.state !== "EFFECTIVE")) return false;
      const otherTo = other.effectiveTo === null && other.effectiveFrom < candidate.effectiveFrom ? dayBefore(candidate.effectiveFrom) : other.effectiveTo;
      return candidate.effectiveFrom <= (otherTo ?? "9999-12-31") && other.effectiveFrom <= (candidate.effectiveTo ?? "9999-12-31");
    }) ?? null
  );
}

/** The open-ended version an approval would end, and its last day. */
function endedBy(notices: NoticesTable, version: NoticePolicyVersion): { versionNo: number; lastDay: string } | null {
  const open = notices.noticePolicyVersions.find(
    (other) => other.versionNo !== version.versionNo && (other.state === "APPROVED" || other.state === "EFFECTIVE") && other.effectiveTo === null && other.effectiveFrom < version.effectiveFrom,
  );
  return open !== undefined ? { versionNo: open.versionNo, lastDay: dayBefore(version.effectiveFrom) } : null;
}

const readerOfApproval = (officer: NoticeOfficer, preparedBy: string): ApprovalReader =>
  preparedBy === officer.name ? "preparer" : holds(officer, "ACT-BIZ-APR") ? "approver" : "no-role";

/** SCR-COM-03's read: the version, its classes, where the reader stands, and the version approving it would end. */
export function policyApproval(key: string, officer: NoticeOfficer, versionNo: number): LoadOutcome<PolicyApproval> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_policy_version", String(versionNo), ["ACT-OPS", "ACT-BIZ-APR"]);
  if (role !== null) return refusedRead(role);
  const version = versionByNo(notices, versionNo);
  if (version === null) return refusedReadOf(notices, officer.name, "read_policy_version", String(versionNo), "POLICY_VERSION_NOT_FOUND");
  return ok({
    version: versionRow(notices, version),
    classes: classesOf(notices, version).map(classView),
    reader: readerOfApproval(officer, version.preparedBy),
    ends: version.state === "PREPARED" ? endedBy(notices, version) : null,
  });
}

/**
 * POST /notice-policy-versions/{id}/approve, in SM-122 transition 1's order: the preparer is refused SEG_SAME_ACTOR
 * naming themselves, whatever roles they hold; a reader without ACT-BIZ-APR ROLE_NOT_ASSIGNED; a version past
 * PREPARED POLICY_VERSION_NOT_PREPARED; a class missing a designation CLASS_DESIGNATION_MISSING; a period sharing a
 * day with another version's POLICY_PERIOD_OVERLAP naming it. Approved, the version it ends gets its last day, and
 * it takes effect when its date arrives.
 */
export function approvePolicyVersion(key: string, officer: NoticeOfficer, versionNo: number, note: string): NoticeAnswer<{ state: PolicyState }> {
  const notices = noticesTable(key);
  const subject = String(versionNo);
  const version = versionByNo(notices, versionNo);
  if (version === null) return refusedAct(notices, officer.name, "approve_policy_version", subject, "POLICY_VERSION_NOT_FOUND");
  const fail = (code: string, values: Readonly<Record<string, string | number>>) => refusedAct(notices, officer.name, "approve_policy_version", subject, code, null, values);
  if (version.preparedBy === officer.name) return fail("SEG_SAME_ACTOR", { preparer: version.preparedBy });
  const role = unassigned(notices, officer, "approve_policy_version", subject, ["ACT-BIZ-APR"]);
  if (role !== null) return refuse(role);
  if (version.state !== "PREPARED") return fail("POLICY_VERSION_NOT_PREPARED", { state: version.state });
  const missing = undesignated(notices, version);
  if (missing !== null) return fail("CLASS_DESIGNATION_MISSING", { class_name: missing });
  const other = collision(notices, version);
  if (other !== null) return fail("POLICY_PERIOD_OVERLAP", { other: other.versionNo });
  const ends = endedBy(notices, version);
  if (ends !== null) {
    const ended = versionByNo(notices, ends.versionNo);
    if (ended !== null) ended.effectiveTo = ends.lastDay;
  }
  version.state = "APPROVED";
  version.approvedBy = officer.name;
  version.approvedAt = now();
  audit(notices, officer.name, "approve_policy_version", subject, null, note.trim() !== "" ? { note: note.trim() } : {});
  settle(notices);
  return accept({ state: version.state });
}

/**
 * POST /notice-policy-versions/{id}/withdraw: a version that has not taken effect, with its reason. One already in
 * effect, or already withdrawn, is refused POLICY_VERSION_NOT_PREPARED naming its state.
 */
export function withdrawPolicyVersion(key: string, officer: NoticeOfficer, versionNo: number, reason: string): NoticeAnswer<{ state: PolicyState }> {
  const notices = noticesTable(key);
  const subject = String(versionNo);
  const role = unassigned(notices, officer, "withdraw_policy_version", subject, ["ACT-BIZ-APR"]);
  if (role !== null) return refuse(role);
  const version = versionByNo(notices, versionNo);
  if (version === null) return refusedAct(notices, officer.name, "withdraw_policy_version", subject, "POLICY_VERSION_NOT_FOUND");
  if (version.state !== "PREPARED" && version.state !== "APPROVED") {
    return refusedAct(notices, officer.name, "withdraw_policy_version", subject, "POLICY_VERSION_NOT_PREPARED", null, { state: version.state });
  }
  if (reason.trim() === "") return refusedAct(notices, officer.name, "withdraw_policy_version", subject, "REASON_MISSING", "reason");
  if (version.state === "APPROVED") {
    // The version it would have ended stays open again.
    const ended = notices.noticePolicyVersions.find((other) => other.effectiveTo === dayBefore(version.effectiveFrom) && other.state === "EFFECTIVE");
    if (ended !== undefined) ended.effectiveTo = null;
  }
  version.state = "WITHDRAWN";
  version.withdrawnReason = reason.trim();
  audit(notices, officer.name, "withdraw_policy_version", subject, null);
  return accept({ state: version.state });
}

// ---------------------------------------------------------------- templates (SCR-COM-04)


function templateState(version: TemplateVersion, day: string): TemplateVersionRow["state"] {
  if (version.approvedBy === null) return "PREPARED";
  return version.effectiveTo !== null && version.effectiveTo < day ? "SUPERSEDED" : "APPROVED";
}

/** The template version a new period collides with, in the same class and language; the open latest one is ended instead. */
function templateCollision(notices: NoticesTable, candidate: { id: string | null; classCode: string; language: string; effectiveFrom: string; effectiveTo: string | null }): TemplateVersion | null {
  return (
    notices.templateVersions.find((other) => {
      if (other.id === candidate.id || other.approvedBy === null || other.classCode !== candidate.classCode || other.language !== candidate.language) return false;
      const otherTo = other.effectiveTo === null && other.effectiveFrom < candidate.effectiveFrom ? dayBefore(candidate.effectiveFrom) : other.effectiveTo;
      return candidate.effectiveFrom <= (otherTo ?? "9999-12-31") && other.effectiveFrom <= (candidate.effectiveTo ?? "9999-12-31");
    }) ?? null
  );
}

/**
 * GET /notice-template-versions for one class of the policy in force (the first when none is asked for): its
 * versions in both languages, newest first, the one composing on the day `as_of` names (today where none is asked) in
 * each, the latest notice of the class for the preview, and how many of its notices are waiting for wording in force.
 */
export function templateVersions(key: string, officer: NoticeOfficer, asked: string | null, asOf: string | null = null): LoadOutcome<TemplatesView> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_templates", asked ?? "*", ["ACT-OPS", "ACT-BIZ-APR"]);
  if (role !== null) return refusedRead(role);
  const version = policyAt(notices, now());
  const classes = version !== null ? classesOf(notices, version).map((entry) => entry.classCode) : [];
  if (asked !== null && !classes.includes(asked)) return refusedReadOf(notices, officer.name, "read_templates", asked, "NOTICE_CLASS_UNKNOWN");
  const classCode = asked ?? classes[0] ?? null;
  if (classCode === null) return refusedReadOf(notices, officer.name, "read_templates", "*", "POLICY_NOT_CONFIGURED");
  const askedDay = asOfDay(asOf);
  const day = askedDay ?? today();
  const rows = notices.templateVersions
    .filter((entry) => entry.classCode === classCode)
    .sort((a, b) => b.versionNo - a.versionNo || a.language.localeCompare(b.language))
    .map((entry) => ({
      id: entry.id,
      classCode: entry.classCode,
      versionNo: entry.versionNo,
      language: entry.language,
      body: entry.body,
      effectiveFrom: entry.effectiveFrom,
      effectiveTo: entry.effectiveTo,
      state: templateState(entry, day),
      inForce: templateAt(notices, classCode, entry.language, day)?.id === entry.id,
      preparedBy: entry.preparedBy,
      preparedAt: entry.preparedAt,
      approvedBy: entry.approvedBy,
      approvedAt: entry.approvedAt,
      missing: templateGaps(entry.body),
      reader: readerOfApproval(officer, entry.preparedBy),
    }));
  const composed = [...notices.notices.values()]
    .filter((notice) => notice.noticeClassCode === classCode && notices.noticeContent.has(notice.id))
    .sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""))[0];
  const sampleContent = composed !== undefined ? contentOf(notices, composed) : null;
  return ok({
    classes,
    classCode,
    versions: rows,
    inForce: { vi: templateAt(notices, classCode, "vi", day)?.versionNo ?? null, en: templateAt(notices, classCode, "en", day)?.versionNo ?? null },
    asOf: askedDay,
    sample: composed !== undefined && sampleContent !== null ? { reference: composed.reference, content: sampleContent } : null,
    waiting: [...notices.notices.values()].filter((notice) => notice.noticeClassCode === classCode && notice.state === "DUE" && notice.waitingReason === "TEMPLATE_VERSION_NOT_EFFECTIVE").length,
    canPrepare: holds(officer, "ACT-OPS"),
  });
}

/**
 * POST /notice-template-versions: refused NOTICE_CLASS_UNKNOWN for a class the policy in force does not state,
 * PERIOD_INVALID for an end before the start, NOTICE_ELEMENT_MISSING naming the placeholders the body does not
 * carry (or carries with no words for the subject, the action or the consequence), and TEMPLATE_PERIOD_OVERLAP
 * naming the version it collides with. A version starting after the open-ended one in force is not a collision: its
 * approval ends the one before on the day before it starts, the one write `cases.notice_template_versions` allows on
 * an approved row (srs/03). AC-FR-COM-003-05 refuses that case instead, which would leave no way to bring a second
 * version of a class into effect; the data model's rule is kept.
 */
export function prepareTemplateVersion(key: string, officer: NoticeOfficer, input: TemplateInput): NoticeAnswer<{ versionNo: number }> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "prepare_template", input.classCode, ["ACT-OPS"]);
  if (role !== null) return refuse(role);
  const version = policyAt(notices, now());
  const fail = (code: string, field: string, values: Readonly<Record<string, string | number>> = {}) => refusedAct(notices, officer.name, "prepare_template", input.classCode, code, field, values);
  if (version === null || !classesOf(notices, version).some((entry) => entry.classCode === input.classCode)) return fail("NOTICE_CLASS_UNKNOWN", "class", { class_name: input.classCode });
  const language = input.language === "en" ? "en" : input.language === "vi" ? "vi" : null;
  if (language === null) return fail("FIELD_MISSING", "language");
  if (input.unreadable || input.effectiveFrom === null) return fail("PERIOD_INVALID", "from");
  if (input.effectiveTo !== null && input.effectiveTo < input.effectiveFrom) return fail("PERIOD_INVALID", "to", { from: input.effectiveFrom, to: input.effectiveTo });
  const missing = templateGaps(input.body);
  if (input.body.trim() === "" || missing.length > 0) return fail("NOTICE_ELEMENT_MISSING", "body", { element: missing.join(", ") });
  const other = templateCollision(notices, { id: null, classCode: input.classCode, language, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo });
  if (other !== null) return fail("TEMPLATE_PERIOD_OVERLAP", "from", { class_name: input.classCode, other: other.versionNo });
  const versionNo = Math.max(0, ...notices.templateVersions.filter((entry) => entry.classCode === input.classCode).map((entry) => entry.versionNo)) + 1;
  notices.templateVersions.push({
    id: randomUUID(),
    classCode: input.classCode,
    versionNo,
    language,
    body: input.body,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    preparedBy: officer.name,
    preparedAt: now(),
    approvedBy: null,
    approvedAt: null,
  });
  audit(notices, officer.name, "prepare_template", input.classCode, null, { version: versionNo, language });
  return accept({ versionNo });
}

/**
 * POST /notice-template-versions/{id}/approve: the preparer is refused SEG_SAME_ACTOR naming themselves; a reader
 * without ACT-BIZ-APR ROLE_NOT_ASSIGNED. Approved, the version in force it follows gets its last day, and from its
 * date it composes: a notice waiting for wording is composed on the next read.
 */
export function approveTemplateVersion(key: string, officer: NoticeOfficer, id: string): NoticeAnswer<{ classCode: string; versionNo: number; language: string }> {
  const notices = noticesTable(key);
  const version = notices.templateVersions.find((entry) => entry.id === id);
  if (version === undefined) return refusedAct(notices, officer.name, "approve_template", id, "POLICY_VERSION_NOT_FOUND");
  const subject = `${version.classCode}:${version.versionNo}:${version.language}`;
  if (version.preparedBy === officer.name) return refusedAct(notices, officer.name, "approve_template", subject, "SEG_SAME_ACTOR", null, { preparer: version.preparedBy });
  const role = unassigned(notices, officer, "approve_template", subject, ["ACT-BIZ-APR"]);
  if (role !== null) return refuse(role);
  if (version.approvedBy !== null) return accept({ classCode: version.classCode, versionNo: version.versionNo, language: version.language });
  const other = templateCollision(notices, version);
  if (other !== null) return refusedAct(notices, officer.name, "approve_template", subject, "TEMPLATE_PERIOD_OVERLAP", null, { class_name: version.classCode, other: other.versionNo });
  const open = notices.templateVersions.find(
    (entry) =>
      entry.id !== version.id &&
      entry.approvedBy !== null &&
      entry.classCode === version.classCode &&
      entry.language === version.language &&
      entry.effectiveTo === null &&
      entry.effectiveFrom < version.effectiveFrom,
  );
  if (open !== undefined) open.effectiveTo = dayBefore(version.effectiveFrom);
  version.approvedBy = officer.name;
  version.approvedAt = now();
  audit(notices, officer.name, "approve_template", subject, null);
  settle(notices);
  return accept({ classCode: version.classCode, versionNo: version.versionNo, language: version.language });
}

// ---------------------------------------------------------------- the queue and one notice (SCR-COM-06, 07's content)

function replayOf(notices: NoticesTable, notice: NoticeRow): { count: number; lastAt: string } | null {
  const replays = notices.noticeEvents.filter((event) => event.noObligationReason === "NOTICE_ALREADY_ISSUED" && event.occurrenceRef === notice.occurrenceRef && event.eventKind === classOfNotice(notices, notice)?.eventKind);
  const last = replays.at(-1);
  return last !== undefined ? { count: replays.length, lastAt: last.occurredAt } : null;
}

const recipientName = (notice: NoticeRow): string | null => (notice.recipientPartyId !== null ? organisationName(notice.recipientPartyId) : null);

function outcomesOf(notices: NoticesTable, notice: NoticeRow): OutcomeRow[] {
  return notices.noticeDeliveryOutcomes
    .filter((row) => row.noticeId === notice.id)
    .map((row) => ({
      outcome: row.outcome,
      attemptNo: row.attemptNo,
      route: row.route,
      providerResponse: row.providerResponse,
      reportedBy: row.reportedBy,
      reportedSourceRef: row.reportedSourceRef,
      reportedAt: row.reportedAt,
      exhausted: row.treatmentExhausted,
    }));
}

/** Issued after its due instant: by how many minutes, measured from the first notice issued for the obligation. */
function lateMinutesOf(notices: NoticesTable, notice: NoticeRow): number | null {
  const issued = firstIssueOf(notices, notice);
  if (issued === null || notAfter(issued, notice.dueAt)) return null;
  return Math.floor((Date.parse(issued) - Date.parse(notice.dueAt)) / 60_000);
}

function detailOf(notices: NoticesTable, notice: NoticeRow, officer: NoticeOfficer): NoticeDetail {
  const service = serviceOf(notices, notice);
  const run = notices.trackChangeRecipients.find((entry) => entry.noticeId === notice.id);
  const version = notices.noticePolicyVersions.find((entry) => entry.id === notice.noticePolicyVersionId);
  const event = notice.noticeEventId !== null ? notices.noticeEvents.find((entry) => entry.id === notice.noticeEventId) : undefined;
  return {
    reference: notice.reference,
    classCode: notice.noticeClassCode,
    state: notice.state,
    dueAt: notice.dueAt,
    issuedAt: notice.issuedAt,
    deliveredAt: notice.deliveredAt,
    recipient: recipientName(notice),
    channel: notice.channel,
    destination: notice.destination,
    content: contentOf(notices, notice),
    policyVersion: version?.versionNo ?? 0,
    occurrence: { ref: notice.occurrenceRef, module: event?.sourceModule ?? null, eventKind: event?.eventKind ?? null },
    outcomes: outcomesOf(notices, notice),
    service: service !== null ? { route: service.route, servedOn: service.servedOn, servedBy: service.servingActor, evidence: service.evidenceRef, recordedAt: service.recordedAt } : null,
    run: run !== undefined ? (notices.trackChangeRuns.find((entry) => entry.id === run.runId)?.ref ?? null) : null,
    unmetReason: notice.unmetReason,
    replay: replayOf(notices, notice),
    waiting: notice.state === "DUE" && notice.waitingReason !== null ? { reason: notice.waitingReason, element: notice.waitingElement } : null,
    lateMinutes: lateMinutesOf(notices, notice),
    device: notice.deviceCondition,
    supersedes: notice.supersedesNoticeId !== null ? (noticeById(notices, notice.supersedesNoticeId)?.reference ?? null) : null,
    supersededBy: successorOf(notices, notice)?.reference ?? null,
    reissueReason: notice.reissueReason,
    withdrawn: notice.state === "WITHDRAWN" && notice.withdrawnAt !== null ? { by: notice.withdrawnBy ?? "", reason: notice.withdrawnReason ?? "", at: notice.withdrawnAt } : null,
    canReissue: holds(officer, "ACT-OPS"),
  };
}

const vnDay = (instant: string) => dayOf(instant);

/**
 * GET /notices: every notice under the filter, the latest due first, UNMET and UNDELIVERED among them rather than
 * filtered out; the destination is not in a row. The notice opened beside the list is read with its outcomes, and
 * the read is recorded (GET /notices/{id}/delivery-outcomes).
 */
export function noticeQueue(key: string, officer: NoticeOfficer, filter: QueueFilter, opened: string | null): LoadOutcome<NoticeQueue> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_notices", "*", ["ACT-OPS", "ACT-AUD"]);
  if (role !== null) return refusedRead(role);
  const all = [...notices.notices.values()];
  const rows: QueueRow[] = all
    .filter(
      (notice) =>
        (filter.classCode === null || notice.noticeClassCode === filter.classCode) &&
        (filter.state === null || notice.state === filter.state) &&
        (filter.dueFrom === null || vnDay(notice.dueAt) >= filter.dueFrom) &&
        (filter.dueTo === null || vnDay(notice.dueAt) <= filter.dueTo),
    )
    .sort((a, b) => b.dueAt.localeCompare(a.dueAt))
    .map((notice) => ({
      reference: notice.reference,
      classCode: notice.noticeClassCode,
      state: notice.state,
      dueAt: notice.dueAt,
      issuedAt: notice.issuedAt,
      replay: replayOf(notices, notice),
    }));
  const openedRow = opened !== null ? (notices.notices.get(opened.trim().toUpperCase()) ?? null) : null;
  if (opened !== null) audit(notices, officer.name, "read_delivery_outcomes", opened, openedRow === null ? "NOTICE_NOT_FOUND" : null);
  const classes = [...new Set([...notices.noticeClasses.map((entry) => entry.classCode)])];
  return ok({ rows, total: all.length, classes, opened: openedRow !== null ? detailOf(notices, openedRow, officer) : null, asOf: now() });
}

// ---------------------------------------------------------------- recovery (SCR-COM-08, 09)

/**
 * Who reads the recovery queue and a notice from it: operations and support, who serve a notice by another route, and
 * the business approver, who closes one unserved once its class is no longer required (POST /notices/{id}/withdraw,
 * which SCR-COM-09's states place on that page). The queue is the approver's way to the notices they act on.
 */
const RECOVERY_READERS: readonly StaffRole[] = ["ACT-OPS", "ACT-SUP", "ACT-BIZ-APR"];

/** A required notice issued with no delivered outcome: the treatment is still running, or has given up. */
const awaitingDelivery = (notice: NoticeRow) => notice.isRequired && (notice.state === "ISSUED" || notice.state === "UNDELIVERED");

function recoveryRow(notices: NoticesTable, notice: NoticeRow): RecoveryRow {
  const outcomes = notices.noticeDeliveryOutcomes.filter((row) => row.noticeId === notice.id);
  const last = outcomes.at(-1);
  return {
    reference: notice.reference,
    classCode: notice.noticeClassCode,
    state: notice.state,
    issuedAt: notice.issuedAt ?? notice.dueAt,
    firstFailureAt: outcomes.find((row) => row.outcome === "failed")?.reportedAt ?? null,
    attempts: last?.attemptNo ?? 0,
    lastResponse: last?.providerResponse ?? null,
    exhausted: notice.state === "UNDELIVERED",
  };
}

/** GET /notices/recovery-queue: a depth per class, deepest first, and the notices, oldest failure first. */
export function recoveryQueue(key: string, officer: NoticeOfficer, classCode: string | null): LoadOutcome<RecoveryQueue> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_recovery_queue", classCode ?? "*", RECOVERY_READERS);
  if (role !== null) return refusedRead(role);
  const waiting = [...notices.notices.values()].filter(awaitingDelivery).map((notice) => recoveryRow(notices, notice));
  const classes = [...new Set(waiting.map((row) => row.classCode))];
  const depths = classes
    .map((code) => {
      const members = waiting.filter((row) => row.classCode === code);
      const failures = members.map((row) => row.firstFailureAt).filter((at): at is string => at !== null).sort();
      return { classCode: code, depth: members.length, oldestFailureAt: failures[0] ?? null };
    })
    .sort((a, b) => b.depth - a.depth || (a.oldestFailureAt ?? "9").localeCompare(b.oldestFailureAt ?? "9"));
  const order = depths.map((depth) => depth.classCode);
  const rows = waiting
    .filter((row) => classCode === null || row.classCode === classCode)
    .sort((a, b) => order.indexOf(a.classCode) - order.indexOf(b.classCode) || (a.firstFailureAt ?? "9").localeCompare(b.firstFailureAt ?? "9"));
  return ok({ depths, rows, asOf: now() });
}

function dischargedOf(notices: NoticesTable, notice: NoticeRow): ServiceView["discharged"] {
  if (notice.state === "DELIVERED" && notice.deliveredAt !== null) return { on: notice.deliveredAt, by: "delivered" };
  const service = serviceOf(notices, notice);
  if (notice.state === "SERVED_ALTERNATIVELY" && service !== null) return { on: service.servedOn, by: "served" };
  return null;
}

/**
 * Where a withdrawal of the notice stands: sent (a reissue replaces what the recipient holds), discharged, still owed
 * because its class is still required (DR-135 rows 5 and 6), closable unserved (row 4), or closed.
 */
function withdrawalOf(notices: NoticesTable, notice: NoticeRow): ServiceView["withdrawal"] {
  if (notice.state === "WITHDRAWN") return { kind: "withdrawn", by: notice.withdrawnBy ?? "", reason: notice.withdrawnReason ?? "", at: notice.withdrawnAt ?? "" };
  const discharged = dischargedOf(notices, notice);
  if (notice.state === "SERVED_ALTERNATIVELY" && discharged !== null) return { kind: "discharged", on: discharged.on };
  if (!OPEN.includes(notice.state)) return { kind: "sent", on: notice.issuedAt ?? notice.dueAt };
  if (requiredNow(notices, notice.noticeClassCode)) return { kind: "open", reason: notice.state === "UNDELIVERED" ? "TREATMENT_EXHAUSTED" : "TREATMENT_RUNNING" };
  return { kind: "withdrawable" };
}

/**
 * SCR-COM-09's read: the notice, every attempt, whether it is still owed, and what the reader may do about it -
 * record a service (operations, support) or withdraw it (the business approver).
 */
export function serviceForm(key: string, officer: NoticeOfficer, reference: string): LoadOutcome<ServiceView> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_service", reference, RECOVERY_READERS);
  if (role !== null) return refusedRead(role);
  const notice = notices.notices.get(reference.trim().toUpperCase());
  if (notice === undefined) return refusedReadOf(notices, officer.name, "read_service", reference, "NOTICE_NOT_FOUND");
  return ok({
    reference: notice.reference,
    classCode: notice.noticeClassCode,
    state: notice.state,
    issuedAt: notice.issuedAt,
    channel: notice.channel,
    destination: notice.destination,
    recipient: recipientName(notice),
    attempts: outcomesOf(notices, notice),
    exhausted: outcomesOf(notices, notice).some((outcome) => outcome.exhausted),
    discharged: dischargedOf(notices, notice),
    servedBy: officer.name,
    today: today(),
    canServe: holds(officer, "ACT-OPS", "ACT-SUP"),
    canWithdraw: holds(officer, "ACT-BIZ-APR"),
    withdrawal: withdrawalOf(notices, notice),
  });
}

/**
 * POST /notices/{id}/withdraw: the obligation closed without the notice ever being served (SM-121 transitions 3, 13,
 * 14 and 8). Refused, in the contract's order: NOTICE_ALREADY_SENT naming the state and the recipient where it was
 * dispatched - a reissue replaces what they hold (AC-FR-COM-008-12); NOTICE_ALREADY_DISCHARGED naming the date where
 * it was served; ROLE_NOT_ASSIGNED for a reader without ACT-BIZ-APR; NOTICE_NOT_FOUND. A notice whose class the
 * policy in force still requires stays owed (DR-135 rows 5 and 6) and is refused with that row's reason; a reason is
 * required, since the record keeps why it was never served. A withdrawn notice answers as it is.
 */
export function withdrawNotice(key: string, officer: NoticeOfficer, reference: string, reason: string): NoticeAnswer<{ state: NoticeState }> {
  const notices = noticesTable(key);
  const notice = notices.notices.get(reference.trim().toUpperCase());
  const subject = notice?.reference ?? reference;
  const fail = (code: string, values: Readonly<Record<string, string | number>> = {}, field: string | null = null) => {
    audit(notices, officer.name, "withdraw_notice", subject, code);
    return refuse(code, field, values);
  };
  if (notice !== undefined && notice.state !== "WITHDRAWN") {
    const discharged = dischargedOf(notices, notice);
    if (notice.state === "SERVED_ALTERNATIVELY" && discharged !== null) return fail("NOTICE_ALREADY_DISCHARGED", { date: discharged.on });
    if (!OPEN.includes(notice.state)) return fail("NOTICE_ALREADY_SENT", { state: notice.state, recipient: recipientName(notice) ?? notice.destination ?? "", date: notice.issuedAt ?? "" });
  }
  const role = unassigned(notices, officer, "withdraw_notice", subject, ["ACT-BIZ-APR"]);
  if (role !== null) return refuse(role);
  if (notice === undefined) return fail("NOTICE_NOT_FOUND");
  if (notice.state === "WITHDRAWN") return accept({ state: notice.state });
  if (requiredNow(notices, notice.noticeClassCode)) return fail(notice.state === "UNDELIVERED" ? "TREATMENT_EXHAUSTED" : "TREATMENT_RUNNING", { class_name: notice.noticeClassCode });
  if (reason.trim() === "") return fail("REASON_MISSING", {}, "reason");
  closeUnserved(notices, notice, officer.name, reason.trim().slice(0, 500), now());
  audit(notices, officer.name, "withdraw_notice", notice.reference, null, { reason: reason.trim().slice(0, 500) });
  return accept({ state: notice.state });
}

/**
 * POST /notices/{id}/reissue (DR-136): a reader without ACT-OPS is refused REISSUE_NOT_AUTHORISED naming the
 * authority; NOTICE_NOT_FOUND; a notice neither issued nor delivered NOTICE_NOT_REISSUABLE naming its state and, where
 * it was already replaced, the notice that replaced it; no reason REISSUE_REASON_MISSING. Every refusal is recorded.
 * Recorded, a new notice for the same obligation (class and occurrence) is composed from the template in force now and
 * sent to the contact point the party record holds now, carrying the reason and the notice it replaces; the original
 * moves to SUPERSEDED in the same act (transitions 9 and 10), unchanged otherwise.
 */
export function reissueNotice(key: string, officer: NoticeOfficer, reference: string, reason: string): NoticeAnswer<{ reference: string; state: NoticeState }> {
  const notices = noticesTable(key);
  const original = notices.notices.get(reference.trim().toUpperCase());
  const subject = original?.reference ?? reference;
  const fail = (code: string, values: Readonly<Record<string, string | number>> = {}, field: string | null = null) => {
    audit(notices, officer.name, "reissue_notice", subject, code);
    return refuse(code, field, values);
  };
  if (!holds(officer, "ACT-OPS")) return fail("REISSUE_NOT_AUTHORISED", original !== undefined ? { class_name: original.noticeClassCode } : {});
  if (original === undefined) return fail("NOTICE_NOT_FOUND");
  if (original.state !== "ISSUED" && original.state !== "DELIVERED") {
    return fail("NOTICE_NOT_REISSUABLE", { state: original.state, reference: successorOf(notices, original)?.reference ?? "" });
  }
  if (reason.trim() === "") return fail("REISSUE_REASON_MISSING", {}, "reason");
  const noticeClass = classOfNotice(notices, original);
  if (noticeClass === undefined) return fail("NOTICE_NOT_REISSUABLE", { state: original.state, reference: "" });
  const at = now();
  transition(notices, original, "SUPERSEDED", at, original.state === "ISSUED" ? 9 : 10, officer.name, "REISSUE_RECORDED");
  const reissue: NoticeRow = {
    ...original,
    id: randomUUID(),
    reference: freshReference(notices),
    destination: null,
    channel: null,
    state: "DUE",
    unmetReason: null,
    waitingReason: null,
    waitingElement: null,
    issuedAt: null,
    deliveredAt: null,
    // The reissue resolves its own address at composition: the party record's now, the raiser's own where there is none.
    contactPoint: partyContactPoint(original.recipientPartyId) !== null ? null : original.contactPoint,
    supersedesNoticeId: original.id,
    reissueReason: reason.trim().slice(0, 500),
    withdrawnReason: null,
    withdrawnBy: null,
    withdrawnAt: null,
  };
  notices.notices.set(reissue.reference, reissue);
  notices.noticeStateHistory.push({ noticeId: reissue.id, fromState: null, toState: "DUE", transitionNo: null, actor: officer.name, reasonCode: "REISSUE_RECORDED", occurredAt: at });
  composeAndIssue(notices, reissue, noticeClass, at, null);
  audit(notices, officer.name, "reissue_notice", original.reference, null, { reissue: reissue.reference, reason: reissue.reissueReason ?? "" });
  return accept({ reference: reissue.reference, state: reissue.state });
}

/**
 * POST /notices/{id}/alternative-service: the route and the date, not after today, are refused
 * ALTERNATIVE_SERVICE_INCOMPLETE naming what is missing; a notice delivered or already served
 * NOTICE_ALREADY_DISCHARGED naming the date. Recorded, the reader is the serving actor and the notice is discharged
 * (SM-121 transition 7 from UNDELIVERED, 15 from ISSUED).
 */
export function recordAlternativeService(key: string, officer: NoticeOfficer, reference: string, input: ServiceInput): NoticeAnswer<{ servedOn: string }> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "record_alternative_service", reference, ["ACT-OPS", "ACT-SUP"]);
  if (role !== null) return refuse(role);
  const notice = notices.notices.get(reference.trim().toUpperCase());
  const fail = (code: string, field: string | null = null, values: Readonly<Record<string, string | number>> = {}) =>
    refusedAct(notices, officer.name, "record_alternative_service", notice?.reference ?? reference, code, field, values);
  if (notice === undefined || notice.issuedAt === null) return fail("NOTICE_NOT_FOUND");
  const discharged = dischargedOf(notices, notice);
  if (discharged !== null) return fail("NOTICE_ALREADY_DISCHARGED", null, { date: discharged.on });
  if (notice.state !== "UNDELIVERED" && notice.state !== "ISSUED") return fail("NOTICE_NOT_FOUND");
  const incomplete = (field: string, element: string) => fail("ALTERNATIVE_SERVICE_INCOMPLETE", field, { element });
  if (input.route.trim() === "") return incomplete("route", "route");
  if (input.unreadable || input.servedOn === null || input.servedOn > today()) return incomplete("servedOn", "date");
  const at = now();
  notices.alternativeServices.push({
    noticeId: notice.id,
    route: input.route.trim().slice(0, 200),
    servedOn: input.servedOn,
    servingActor: officer.name,
    evidenceRef: input.evidence.trim() !== "" ? input.evidence.trim() : null,
    recordedAt: at,
  });
  transition(notices, notice, "SERVED_ALTERNATIVELY", at, notice.state === "UNDELIVERED" ? 7 : 15, officer.name, "SERVED_ALTERNATIVELY");
  audit(notices, officer.name, "record_alternative_service", notice.reference, null, { route: input.route.trim(), servedOn: input.servedOn });
  return accept({ servedOn: input.servedOn });
}

// ---------------------------------------------------------------- what the delivery treatment reports (ACT-SYS)

/**
 * Who reports to the delivery endpoints, as the runtime authenticates them: the delivery treatment as itself, with the
 * source it is (`ACT-SYS`); a member of staff; or a route that carries no identity the runtime can stamp. The source of
 * an outcome is never a field of the report.
 */
export type OutcomeReporter =
  | { kind: "treatment"; source: "email-provider" | "sms-provider" | "postal-service" }
  | { kind: "staff"; officer: NoticeOfficer }
  | { kind: "unauthenticated" };

/** A report as the treatment sends it: the outcome, the attempt and its route, what the provider said, and when. */
export interface OutcomeReport {
  outcome: string;
  attemptNo: number;
  route: "primary" | "secondary";
  providerResponse: string;
  reportedAt: string;
}

const OUTCOME_KINDS: readonly OutcomeKind[] = ["attempted", "pending", "delivered", "failed"];

const actorOf = (reporter: OutcomeReporter): string | null => (reporter.kind === "staff" ? reporter.officer.name : reporter.kind === "treatment" ? reporter.source : null);

/**
 * POST /notices/{id}/delivery-outcomes (ALG-113), the treatment's report of one attempt. No page offers it: in the mock
 * the treatment plays at issue (`deliver`), and SCR-COM-08 offers an officer only a service of their own. Refused, in
 * the contract's order and each recorded: an outcome none of the four kinds is OUTCOME_KIND_UNKNOWN naming them; a
 * report with no provider response on a class that requires proof PROOF_OUTCOME_MISSING; a route with no identity to
 * stamp PROOF_SOURCE_MISSING; a member of staff asserting a delivery NOTICE_NOT_DELIVERED naming the alternative
 * service - the prohibition PERM-293 puts above every ordinary authority - and any other report of theirs
 * ROLE_NOT_ASSIGNED; a reference that names no notice issued NOTICE_NOT_FOUND. A repeat of an attempt reported at the
 * same instant adds no row. Recorded, a delivered outcome moves an issued notice to DELIVERED (transition 5).
 */
export function reportDeliveryOutcome(key: string, reporter: OutcomeReporter, reference: string, report: OutcomeReport): NoticeAnswer<{ state: NoticeState }> {
  const notices = noticesTable(key);
  const notice = notices.notices.get(reference.trim().toUpperCase());
  const fail = (code: string, values: Readonly<Record<string, string | number>> = {}) =>
    refusedAct(notices, actorOf(reporter), "record_delivery_outcome", notice?.reference ?? reference, code, null, values);
  const kind = OUTCOME_KINDS.find((entry) => entry === report.outcome);
  if (kind === undefined) return fail("OUTCOME_KIND_UNKNOWN", { kinds: OUTCOME_KINDS.join(", ") });
  if (notice?.requiresProof === true && report.providerResponse.trim() === "") return fail("PROOF_OUTCOME_MISSING");
  if (reporter.kind === "unauthenticated") return fail("PROOF_SOURCE_MISSING");
  if (reporter.kind === "staff") return kind === "delivered" ? fail("NOTICE_NOT_DELIVERED", { route: "alternative_service" }) : fail("ROLE_NOT_ASSIGNED");
  if (notice === undefined || notice.issuedAt === null) return fail("NOTICE_NOT_FOUND");
  const repeat = notices.noticeDeliveryOutcomes.some((row) => row.noticeId === notice.id && row.attemptNo === report.attemptNo && row.reportedAt === report.reportedAt);
  if (!repeat) {
    applyReport(notices, notice, { attemptNo: report.attemptNo, route: report.route, outcome: kind, response: report.providerResponse.trim(), at: report.reportedAt, exhausted: false }, "provider", reporter.source);
    audit(notices, reporter.source, "record_delivery_outcome", notice.reference, null, { outcome: kind, attempt: report.attemptNo });
  }
  return accept({ state: notice.state });
}

/**
 * POST /notices/{id}/delivery-exhausted (FR-COM-005, 013): the treatment's last failed attempt, reported by the treatment
 * or by operations recording `FR-OPS-024`'s exception. Refused, in the contract's order and each recorded: a notice
 * delivered or served NOTICE_ALREADY_DISCHARGED naming the date (AC-FR-COM-005-05), writing no row; a reference that
 * names no notice issued NOTICE_NOT_FOUND; a reporter who is neither the treatment nor operations ROLE_NOT_ASSIGNED.
 * Recorded, the row is a failed attempt with the treatment exhausted, and an issued notice moves to UNDELIVERED
 * (transition 6) with its obligation still open; a repeat answers the state it is in.
 */
export function reportDeliveryExhausted(
  key: string,
  reporter: OutcomeReporter,
  reference: string,
  report: Omit<OutcomeReport, "outcome">,
): NoticeAnswer<{ state: NoticeState; open: boolean }> {
  const notices = noticesTable(key);
  const notice = notices.notices.get(reference.trim().toUpperCase());
  const subject = notice?.reference ?? reference;
  const fail = (code: string, values: Readonly<Record<string, string | number>> = {}) => refusedAct(notices, actorOf(reporter), "record_delivery_exhausted", subject, code, null, values);
  const discharged = notice !== undefined ? dischargedOf(notices, notice) : null;
  if (discharged !== null) return fail("NOTICE_ALREADY_DISCHARGED", { date: discharged.on });
  if (notice === undefined || notice.issuedAt === null) return fail("NOTICE_NOT_FOUND");
  if (reporter.kind === "unauthenticated" || (reporter.kind === "staff" && !holds(reporter.officer, "ACT-OPS"))) return fail("ROLE_NOT_ASSIGNED");
  if (notice.state === "UNDELIVERED") return accept({ state: notice.state, open: true });
  const source = reporter.kind === "treatment" ? reporter.source : "operations";
  applyReport(
    notices,
    notice,
    { attemptNo: report.attemptNo, route: report.route, outcome: "failed", response: report.providerResponse.trim(), at: report.reportedAt, exhausted: true },
    reporter.kind === "treatment" ? "provider" : "operations",
    source,
  );
  audit(notices, actorOf(reporter), "record_delivery_exhausted", notice.reference, null, { attempt: report.attemptNo });
  return accept({ state: notice.state, open: OPEN.includes(notice.state) });
}

// ---------------------------------------------------------------- track-change runs (SCR-COM-13)

const CHANGE_KINDS: readonly TrackChangeRun["changeKind"][] = ["revoked", "expired", "taken_down"];

/** The device of a premises as PLR reports it now: what a track-change notice records beside it, and never waits for. */
function deviceConditionOf(key: string, premisesId: string): DeviceCondition {
  const device = deviceSummary(key, premisesId);
  return device === null ? { condition: "NO_DEVICE", asAt: null } : { condition: device.connection, asAt: device.asAt };
}

/** A schedule as a notice names it: the playlist it plays and its hours. */
const scheduleLabel = (schedule: TrackHolder["schedules"][number]): string => `${schedule.playlist} ${schedule.start}-${schedule.end}`;

/**
 * One notice of a run to one premises (ALG-114 step 4): the class is the run's, `track_change`, named because a run
 * carries no event to read one from; the obligation falls due at the change instant (`CFG-165`) and goes to the
 * premises' party, never its device, whose condition is recorded beside the notice and holds nothing up
 * (FR-COM-016). The notice names the change as it was recorded - revoked, expired or taken down - whether it is
 * already in effect, and the playlists and the schedules of that premises that held the track. It is issued at
 * `issueAt`, and the run's issued count moves with it.
 */
function issueToRecipient(key: string, notices: NoticesTable, run: TrackChangeRun, recipient: TrackChangeRecipient, issueAt: string): void {
  const answered = raise(
    notices,
    {
      sourceModule: "CAT",
      eventKind: "track_changed",
      occurrenceRef: `${run.ref}/${recipient.premisesId}`,
      occurredAt: run.changeRecordedAt,
      subjectKind: "track",
      subjectRef: run.trackRef,
      recipientPartyId: recipient.partyId,
      destination: null,
      classCode: "track_change",
      facts: {
        track: run.title,
        artist: run.by,
        premises: nameOfPremises(key, recipient.premisesId),
        playlists: recipient.playlists.map((playlist) => playlist.name).join(", "),
        schedules: recipient.schedules.length > 0 ? recipient.schedules.join(", ") : "none",
        change: run.changeKind,
        effect: notAfter(run.effectiveAt, run.changeRecordedAt) ? "in_effect" : "upcoming",
        effectiveAt: run.effectiveAt,
        by: dayOf(run.effectiveAt),
      },
      recordVersions: { track: run.trackRef, playlists: recipient.playlists.map((playlist) => playlist.id).join(", ") },
    },
    { issueAt, device: deviceConditionOf(key, recipient.premisesId) },
  );
  const notice = answered.reference !== null ? notices.notices.get(answered.reference) : undefined;
  if (notice === undefined || notice.issuedAt === null) return;
  recipient.noticeId = notice.id;
  run.issuedCount += 1;
}

/**
 * ALG-114 for one change: the run is recorded RESOLVING; VEN is asked once which enrolled premises held the track in
 * a playlist or a schedule at the change instant (`premisesHoldingTrack`), and a premises with neither is refused into
 * the run (AFFECTED_SET_EMPTY), its attempt recorded and not counted; the resolved count is written, then one notice
 * per premises (`untold` names the premises the run did not reach, as the seed's run ended). A run that resolved
 * nobody for a change already in effect is held INCOMPLETE for somebody to check (TRACK_CHANGE_RUN_EMPTY); one that
 * resolved nobody before the change takes effect is COMPLETE, and that is recorded.
 */
function startRun(
  key: string,
  notices: NoticesTable,
  change: { trackRef: string; changeKind: TrackChangeRun["changeKind"]; changeRecordedAt: string; effectiveAt: string },
  actor: string | null,
  untold: readonly string[] = [],
): TrackChangeRun {
  const resolution = premisesHoldingTrack(key, change.trackRef, change.changeRecordedAt);
  let ref = newReference("TCN");
  while (notices.trackChangeRuns.some((entry) => entry.ref === ref)) ref = newReference("TCN");
  const run: TrackChangeRun = {
    id: randomUUID(),
    ref,
    trackRef: change.trackRef,
    title: resolution.track?.title ?? change.trackRef,
    by: resolution.track?.by ?? "",
    changeKind: change.changeKind,
    changeRecordedAt: change.changeRecordedAt,
    effectiveAt: change.effectiveAt,
    state: "RESOLVING",
    resolvedCount: 0,
    issuedCount: 0,
    resolutionError: null,
  };
  notices.trackChangeRuns.push(run);
  const affected = resolution.holders.filter((holder) => {
    if (holder.playlists.length > 0 || holder.schedules.length > 0) return true;
    audit(notices, actor, "resolve_track_change", `${run.ref}/${holder.premisesId}`, "AFFECTED_SET_EMPTY", { premises: holder.premisesId });
    return false;
  });
  run.resolvedCount = affected.length;
  audit(notices, actor, "record_track_change", run.ref, null, { track: run.trackRef, change: run.changeKind, resolved: run.resolvedCount });
  if (run.resolvedCount === 0) {
    const live = notAfter(run.effectiveAt, run.changeRecordedAt);
    run.state = live ? "INCOMPLETE" : "COMPLETE";
    if (live) audit(notices, actor, "record_track_change", run.ref, "TRACK_CHANGE_RUN_EMPTY");
    return run;
  }
  run.state = "ISSUING";
  for (const holder of affected) {
    const recipient: TrackChangeRecipient = {
      runId: run.id,
      premisesId: holder.premisesId,
      partyId: holder.party,
      playlists: holder.playlists,
      schedules: holder.schedules.map(scheduleLabel),
      noticeId: null,
      resolvedAt: run.changeRecordedAt,
    };
    notices.trackChangeRecipients.push(recipient);
    if (!untold.includes(holder.premisesId)) issueToRecipient(key, notices, run, recipient, run.changeRecordedAt);
  }
  run.state = run.issuedCount === run.resolvedCount ? "COMPLETE" : "INCOMPLETE";
  return run;
}

/**
 * POST /track-change-notifications, as CAT raises it in process when a revocation, an expiry or a takedown of a track
 * is recorded: the run for that change, resolved and issued (ALG-114). A repeat of the same change - the track and the
 * instant it was recorded - returns the run already created. A run that resolved nobody while the change was already in
 * effect is held, and answers TRACK_CHANGE_RUN_EMPTY with its reference.
 */
export function recordTrackChange(
  key: string,
  change: { trackRef: string; changeKind: TrackChangeRun["changeKind"]; changeRecordedAt: string; effectiveAt: string },
  actor: string | null = null,
): NoticeAnswer<{ run: string; resolved: number; issued: number }> {
  const notices = noticesTable(key);
  const existing = notices.trackChangeRuns.find((entry) => entry.trackRef === change.trackRef && entry.changeRecordedAt === change.changeRecordedAt);
  const run = existing ?? startRun(key, notices, change, actor);
  if (run.resolvedCount === 0 && notAfter(run.effectiveAt, run.changeRecordedAt)) return refuse("TRACK_CHANGE_RUN_EMPTY", null, { run: run.ref });
  return accept({ run: run.ref, resolved: run.resolvedCount, issued: run.issuedCount });
}

/**
 * The console's stand-in for CAT on SCR-COM-13: the portal holds no catalogue surface where a revocation, an expiry or
 * a takedown is recorded, so an operations officer records the change CAT reported, now, and the run it raises goes
 * through the same contract (`recordTrackChange`). The track and the kind of change are required (FIELD_MISSING); a
 * track the catalogue does not hold resolves nobody, as it would for CAT.
 */
export function recordReportedTrackChange(key: string, officer: NoticeOfficer, input: TrackChangeInput): NoticeAnswer<{ run: string; resolved: number; issued: number }> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "record_track_change", input.trackRef || "*", ["ACT-OPS"]);
  if (role !== null) return refuse(role);
  const trackRef = input.trackRef.trim().toUpperCase();
  if (trackRef === "") return refusedAct(notices, officer.name, "record_track_change", "*", "FIELD_MISSING", "track");
  const changeKind = CHANGE_KINDS.find((kind) => kind === input.changeKind);
  if (changeKind === undefined) return refusedAct(notices, officer.name, "record_track_change", trackRef, "FIELD_MISSING", "kind");
  const at = now();
  return recordTrackChange(key, { trackRef, changeKind, changeRecordedAt: at, effectiveAt: input.effectiveAt ?? at }, officer.name);
}

function runRow(run: TrackChangeRun): RunRow {
  return {
    ref: run.ref,
    trackRef: run.trackRef,
    title: run.title,
    by: run.by,
    changeKind: run.changeKind,
    changeRecordedAt: run.changeRecordedAt,
    effectiveAt: run.effectiveAt,
    state: run.state,
    resolvedCount: run.resolvedCount,
    issuedCount: run.issuedCount,
  };
}

/** The runs, newest first. */
export function trackChangeRuns(key: string, officer: NoticeOfficer): LoadOutcome<TrackChangeRuns> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_track_change_runs", "*", ["ACT-OPS"]);
  if (role !== null) return refusedRead(role);
  return ok({ runs: [...notices.trackChangeRuns].sort((a, b) => Date.parse(b.changeRecordedAt) - Date.parse(a.changeRecordedAt)).map(runRow) });
}

/**
 * GET /track-change-notifications/{id}/recipients: the run, both counts as recorded, and every premises it resolved
 * with its playlists, its schedules, its notice and the device condition recorded beside it. A reference that names no
 * run discloses nothing, and the attempt is recorded (AC-FR-COM-015-06).
 */
export function trackChangeRun(key: string, officer: NoticeOfficer, ref: string): LoadOutcome<TrackChangeRunView> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_track_change_run", ref, ["ACT-OPS"]);
  if (role !== null) return refusedRead(role);
  const run = notices.trackChangeRuns.find((entry) => entry.ref === ref);
  if (run === undefined) {
    audit(notices, officer.name, "read_track_change_run", ref, "TRACK_CHANGE_RUN_NOT_FOUND");
    return refusedRead("TRACK_CHANGE_RUN_NOT_FOUND");
  }
  const recipients = notices.trackChangeRecipients
    .filter((entry) => entry.runId === run.id)
    .map((entry) => {
      const notice = entry.noticeId !== null ? noticeById(notices, entry.noticeId) : undefined;
      return {
        premises: nameOfPremises(key, entry.premisesId),
        playlists: entry.playlists.map((playlist) => playlist.name),
        schedules: entry.schedules,
        notice: notice !== undefined ? { reference: notice.reference, state: notice.state } : null,
        device: notice?.deviceCondition ?? null,
      };
    });
  return ok({ ...runRow(run), recipients, alreadyInEffect: notAfter(run.effectiveAt, run.changeRecordedAt) });
}

/**
 * POST /track-change-notifications/{id}/continue: each premises with no notice is issued one now (SM-124
 * transition 5), and the run closes COMPLETE when the counts meet (3). A run that resolved nobody for a change
 * already in effect is refused TRACK_CHANGE_RUN_EMPTY; one with premises still untold TRACK_CHANGE_RUN_INCOMPLETE.
 */
export function continueTrackChangeRun(key: string, officer: NoticeOfficer, ref: string): NoticeAnswer<{ issued: number; outstanding: number }> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "continue_track_change_run", ref, ["ACT-OPS"]);
  if (role !== null) return refuse(role);
  const run = notices.trackChangeRuns.find((entry) => entry.ref === ref);
  if (run === undefined) return refusedAct(notices, officer.name, "continue_track_change_run", ref, "TRACK_CHANGE_RUN_NOT_FOUND");
  if (run.resolvedCount === 0 && notAfter(run.effectiveAt, run.changeRecordedAt)) return refusedAct(notices, officer.name, "continue_track_change_run", ref, "TRACK_CHANGE_RUN_EMPTY");
  if (run.state === "COMPLETE") return accept({ issued: 0, outstanding: 0 });
  run.state = "ISSUING";
  const before = run.issuedCount;
  const at = now();
  for (const recipient of notices.trackChangeRecipients.filter((entry) => entry.runId === run.id && entry.noticeId === null)) {
    issueToRecipient(key, notices, run, recipient, at);
  }
  const outstanding = run.resolvedCount - run.issuedCount;
  run.state = outstanding === 0 ? "COMPLETE" : "INCOMPLETE";
  audit(notices, officer.name, "continue_track_change_run", ref, outstanding === 0 ? null : "TRACK_CHANGE_RUN_INCOMPLETE", { issued: run.issuedCount - before });
  if (outstanding > 0) {
    // AC-FR-COM-015-03: the refusal names the premises still untold.
    const untold = notices.trackChangeRecipients.filter((entry) => entry.runId === run.id && entry.noticeId === null).map((entry) => nameOfPremises(key, entry.premisesId));
    return refuse("TRACK_CHANGE_RUN_INCOMPLETE", null, { issued: run.issuedCount, resolved: run.resolvedCount, premises: untold.join(", ") });
  }
  return accept({ issued: run.issuedCount - before, outstanding });
}

// ---------------------------------------------------------------- timeliness (SCR-COM-15)

const monthOf = (instant: string) => vnDay(instant).slice(0, 7);
const lastDayOf = (month: string): string => {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, mon ?? 1, 0)).toISOString().slice(0, 10);
};

/**
 * GET /notice-timeliness for a calendar month: per class of the policy in force over the month, the notices that fell
 * due in it (the denominator), those issued before their due instant, those issued after it, and those not issued -
 * which keeps a notice the treatment could not deliver until it is served (DR-132 row 8). A class with nothing due is
 * a row of zeros; a class with fewer than five shows its count with no breakdown. A period re-produced because a
 * notice due in it was issued after it closed says when.
 */
export function noticeTimeliness(key: string, officer: NoticeOfficer, asked: string | null): LoadOutcome<Timeliness> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_timeliness", asked ?? "*", ["ACT-OPS", "ACT-AUD"]);
  if (role !== null) return refusedRead(role);
  const all = [...notices.notices.values()].filter((notice) => notice.state !== "SUPERSEDED");
  const current = monthOf(now());
  const periods = [...new Set([current, ...all.map((notice) => monthOf(notice.dueAt))])].sort().reverse();
  const period = asked !== null && /^\d{4}-\d{2}$/.test(asked) ? asked : current;
  const first = `${period}-01`;
  const last = lastDayOf(period);
  const versions = notices.noticePolicyVersions.filter(
    (version) => (version.state === "EFFECTIVE" || version.state === "SUPERSEDED" || version.state === "APPROVED") && version.effectiveFrom <= last && (version.effectiveTo === null || version.effectiveTo >= first),
  );
  const classCodes = [...new Set(versions.flatMap((version) => classesOf(notices, version).map((entry) => entry.classCode)))];
  const due = all.filter((notice) => monthOf(notice.dueAt) === period);
  const open: readonly NoticeState[] = ["DUE", "COMPOSED", "UNMET", "UNDELIVERED", "WITHDRAWN"];
  const rows = classCodes.map((classCode) => {
    const members = due.filter((notice) => notice.noticeClassCode === classCode);
    // A reissue stands for its obligation and counts from the first notice issued for it.
    const issued = members.filter((notice) => notice.issuedAt !== null && !open.includes(notice.state));
    const before = issued.filter((notice) => notAfter(firstIssueOf(notices, notice) ?? "", notice.dueAt)).length;
    const after = issued.length - before;
    const shown = members.length === 0 || members.length >= BREAKDOWN_THRESHOLD;
    return {
      classCode,
      fellDue: members.length,
      beforeDue: shown ? before : null,
      afterDue: shown ? after : null,
      notIssued: shown ? members.length - issued.length : null,
    };
  });
  const lateAfterClose = due
    .map((notice) => firstIssueOf(notices, notice))
    .filter((issuedAt): issuedAt is string => issuedAt !== null && vnDay(issuedAt) > last)
    .sort()
    .at(-1);
  return ok({ period, periods, rows, restatedOn: lateAfterClose ?? null, threshold: BREAKDOWN_THRESHOLD, asOf: now() });
}

// ---------------------------------------------------------------- unmet obligations (SCR-COM-16)

/**
 * GET /notices in state UNMET: who has no address on any channel the class permits, since when; the events refused
 * before they were recorded, by the module that sent them and the code; and the events recorded that raised nothing
 * because no class of the policy in force states them, or the class they named, or no policy was in force - by module
 * and event, so an event a family raises with nothing to say it is never silent.
 */
export function unmetObligations(key: string, officer: NoticeOfficer): LoadOutcome<UnmetObligations> {
  const notices = noticesTable(key);
  const role = unassigned(notices, officer, "read_unmet", "*", ["ACT-OPS"]);
  if (role !== null) return refusedRead(role);
  const instant = now();
  const rows = [...notices.notices.values()]
    .filter((notice) => notice.state === "UNMET")
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .map((notice) => ({
      reference: notice.reference,
      classCode: notice.noticeClassCode,
      recipient: recipientName(notice),
      channels: classOfNotice(notices, notice)?.channels ?? [],
      dueAt: notice.dueAt,
      waitingDays: Math.max(0, Math.floor((Date.parse(instant) - Date.parse(notice.dueAt)) / 86_400_000)),
    }));
  const refusedCodes = ["OCCURRENCE_REF_MISSING", "SUBJECT_KIND_UNKNOWN"] as const;
  const refusedEvents = refusedCodes.flatMap((code) => {
    const refused = notices.auditLog.filter((row) => row.act === "record_event" && row.code === code);
    return [...new Set(refused.map((row) => String(row.detail.module ?? "")))].map((module) => ({ module, code, count: refused.filter((row) => row.detail.module === module).length }));
  });
  const reasons = ["NO_CLASS_FOR_EVENT", "NOTICE_CLASS_UNKNOWN", "POLICY_NOT_CONFIGURED"] as const;
  const unclassified = reasons.flatMap((reason) => {
    const events = notices.noticeEvents.filter((event) => event.noObligationReason === reason);
    const keys = [...new Set(events.map((event) => `${event.sourceModule}|${event.eventKind}`))];
    return keys.map((entry) => {
      const [module = "", eventKind = ""] = entry.split("|");
      const these = events.filter((event) => event.sourceModule === module && event.eventKind === eventKind);
      const lastAt = these.map((event) => event.occurredAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? instant;
      return { module, eventKind, reason, count: these.length, lastAt };
    });
  });
  return ok({ rows, refusedEvents, unclassified, asOf: instant });
}
