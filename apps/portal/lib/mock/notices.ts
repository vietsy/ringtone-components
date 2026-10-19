import type { LoadOutcome } from "@rightone/ui";
import en from "@/messages/screens/com.en.json";
import vi from "@/messages/screens/com.vi.json";

/*
 * The notice family's sample data (COM). No canvas board and no Figma frame draws a notice screen, so the data is
 * the specification's: the classes `CFG-161` defaults to and the optional class SCR-COM-12's drawing switches off,
 * the authoritative contact register `CFG-164` defaults to (a role, never a person, reached on the support line and
 * the address the help route register publishes), the wording of each class as an approved template, and what the
 * delivery treatment `CFG-43` reported. The notices themselves are raised by the other families' events: a case
 * received, decided or appealed (CAS), an amount a decision sets (FIN under BR-FIN-15), an act on a Player service
 * (VEN), a pairing code issued or a device credential revoked (IAM), and CAT's revocation of "Chủ nhật lười", which
 * SCR-VEN-07 already refuses and whose run reached one of the two premises playing it.
 *
 * Version 1 of every class's wording is the catalogue's `com.tpl.<class>.*` text, written into a template body once,
 * here; from then on what a recipient reads is the approved template version in force when the notice was composed,
 * and the catalogue plays no part in it.
 */

export const COM10_VIEWS = ["loading", "error"] as const;
export type Com10View = (typeof COM10_VIEWS)[number];

export const NOTICES_VIEWS = ["loading", "error"] as const;
export type NoticesView = (typeof NOTICES_VIEWS)[number];

export const COM12_VIEWS = ["loading", "error"] as const;
export type Com12View = (typeof COM12_VIEWS)[number];

/** The states of the notice console no act in the mock reaches: loading, and the console's own outage. */
export const CONSOLE_VIEWS = ["loading", "error"] as const;
export type ConsoleView = (typeof CONSOLE_VIEWS)[number];

/** Who a class is addressed to, as `CFG-161` names the recipient of each obligation. */
export type RecipientRole =
  | "raiser"
  | "premises_party"
  | "applicant"
  | "artist"
  | "payee"
  | "purchaser"
  | "affected_person"
  | "figure_recipient"
  /** A member of the gateway's staff a family's act tells: a case officer, operations, the evidence owner. */
  | "operations_officer";

/** A channel a class may use (`notice_classes.channels`); the API's `postal` is `post` here. */
export type Channel = "email" | "sms" | "post" | "portal";

export interface SeedNoticeClass {
  classCode: string;
  eventKind: string;
  recipientRole: RecipientRole;
  channels: readonly Channel[];
  subjectKinds: readonly string[];
  isRequired: boolean;
  requiresProof: boolean;
  leadTimeDays: number | null;
  requiredActionRule: "states_action" | "states_no_action";
  retentionMonths: number;
}

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;

/**
 * The classes `CFG-161` defaults to (fifteen, each required and requiring proof), the newsletter SCR-COM-12's
 * drawing lets a recipient switch off, and a class for each further event the other families raise, so none of
 * their notices is lost to NO_CLASS_FOR_EVENT: what "Add a class" on SCR-COM-02 offers, with the event that raises
 * each, the module that sends it, and whether its subject carries a date (a lead time is then stated, DR-132).
 */
export interface RegisterClass {
  classCode: string;
  eventKind: string;
  sourceModule: string;
  recipientRole: RecipientRole;
  channels: readonly Channel[];
  subjectKinds: readonly string[];
  subjectDate: boolean;
}

export const CLASS_REGISTER: readonly RegisterClass[] = [
  { classCode: "acknowledgement", eventKind: "case_received", sourceModule: "CAS", recipientRole: "raiser", channels: ["email", "sms"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "evidence_request", eventKind: "evidence_requested", sourceModule: "CAS", recipientRole: "raiser", channels: ["email", "sms"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "decision", eventKind: "case_decided", sourceModule: "CAS", recipientRole: "raiser", channels: ["email", "sms", "post"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "outstanding_amount", eventKind: "obligation_outstanding", sourceModule: "FIN", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["obligation"], subjectDate: false },
  { classCode: "status_change", eventKind: "status_record_changed", sourceModule: "CER", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["certificate"], subjectDate: false },
  { classCode: "expiry", eventKind: "certificate_expiring", sourceModule: "CER", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["certificate", "obligation"], subjectDate: true },
  { classCode: "track_change", eventKind: "track_changed", sourceModule: "CAT", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["track"], subjectDate: false },
  { classCode: "schedule_fallback", eventKind: "schedule_fell_back", sourceModule: "VEN", recipientRole: "premises_party", channels: ["email"], subjectKinds: ["playlist"], subjectDate: false },
  { classCode: "expected_decision_date", eventKind: "decision_date_expected", sourceModule: "REG", recipientRole: "applicant", channels: ["email"], subjectKinds: ["application"], subjectDate: true },
  { classCode: "inspection_record", eventKind: "inspection_recorded", sourceModule: "VER", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["inspection"], subjectDate: false },
  { classCode: "held_amount", eventKind: "amount_held", sourceModule: "FIN", recipientRole: "payee", channels: ["email", "post"], subjectKinds: ["amount"], subjectDate: false },
  { classCode: "personal_data_breach", eventKind: "personal_data_breach_found", sourceModule: "DAT", recipientRole: "affected_person", channels: ["email", "sms", "post"], subjectKinds: ["personal_data"], subjectDate: false },
  { classCode: "moderation_action", eventKind: "moderation_acted", sourceModule: "MOD", recipientRole: "artist", channels: ["email"], subjectKinds: ["submission"], subjectDate: false },
  { classCode: "restated_figure", eventKind: "figure_restated", sourceModule: "STA", recipientRole: "figure_recipient", channels: ["email"], subjectKinds: ["figure"], subjectDate: false },
  { classCode: "entitlement_withdrawal", eventKind: "entitlement_withdrawn", sourceModule: "MKT", recipientRole: "purchaser", channels: ["email"], subjectKinds: ["entitlement"], subjectDate: false },
  { classCode: "newsletter", eventKind: "newsletter_published", sourceModule: "COM", recipientRole: "premises_party", channels: ["email"], subjectKinds: ["publication"], subjectDate: false },
  // The events the other families raise that CFG-161's fifteen do not name, each its own class so its wording is its
  // own: a request cancelled and an appeal decided (CAS, NTF-CAS-04), an enforcement action, a reinstatement and an
  // ending outside the direct-licence scope on a Player service (VEN, NTF-VEN-02 and 04).
  { classCode: "evidence_request_cancellation", eventKind: "evidence_request_cancelled", sourceModule: "CAS", recipientRole: "raiser", channels: ["email", "sms"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "appeal_outcome", eventKind: "appeal_decided", sourceModule: "CAS", recipientRole: "raiser", channels: ["email", "sms", "post"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "service_enforcement", eventKind: "service_entitlement_enforced", sourceModule: "VEN", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["service_entitlement"], subjectDate: false },
  { classCode: "service_reinstatement", eventKind: "service_entitlement_reinstated", sourceModule: "VEN", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["service_entitlement"], subjectDate: false },
  { classCode: "service_scope_exit", eventKind: "service_entitlement_out_of_scope", sourceModule: "VEN", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["service_entitlement"], subjectDate: false },
  // CAS: an appeal that lapsed (NTF-CAS-06), a case closed or referred, and the case team told a request was answered
  // or its deadline passed.
  { classCode: "appeal_lapse", eventKind: "appeal_lapsed", sourceModule: "CAS", recipientRole: "raiser", channels: ["email", "sms", "post"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "case_status_change", eventKind: "case_status_changed", sourceModule: "CAS", recipientRole: "raiser", channels: ["email", "sms", "post"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "evidence_deadline_alert", eventKind: "evidence_deadline_passed", sourceModule: "CAS", recipientRole: "operations_officer", channels: ["email"], subjectKinds: ["case"], subjectDate: false },
  { classCode: "evidence_response", eventKind: "evidence_answered", sourceModule: "CAS", recipientRole: "operations_officer", channels: ["email"], subjectKinds: ["case"], subjectDate: false },
  // VEN: the ending a premises asked for, confirmed (NTF-VEN-03).
  { classCode: "service_ending_confirmation", eventKind: "service_entitlement_ending", sourceModule: "VEN", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["service_entitlement"], subjectDate: false },
  // REG: NTF-REG-01 to 05 beside expected_decision_date (NTF-REG-04).
  { classCode: "application_acknowledgement", eventKind: "application_submitted", sourceModule: "REG", recipientRole: "applicant", channels: ["email"], subjectKinds: ["application"], subjectDate: false },
  { classCode: "application_evidence_request", eventKind: "application_evidence_requested", sourceModule: "REG", recipientRole: "applicant", channels: ["email"], subjectKinds: ["application"], subjectDate: false },
  { classCode: "application_decision", eventKind: "application_decided", sourceModule: "REG", recipientRole: "applicant", channels: ["email", "post"], subjectKinds: ["application"], subjectDate: false },
  { classCode: "application_closure", eventKind: "application_closed_incomplete", sourceModule: "REG", recipientRole: "applicant", channels: ["email"], subjectKinds: ["application"], subjectDate: false },
  // FIN: the reminder of an amount not yet due, counted back from its due date (NTF-FIN-01).
  { classCode: "payment_reminder", eventKind: "obligation_due", sourceModule: "FIN", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["obligation"], subjectDate: true },
  // PLR: evidence held from a lost or compromised device (NTF-PLR-03, 04), and a certification refused (NTF-PLR-05).
  { classCode: "evidence_quarantine", eventKind: "evidence_quarantined", sourceModule: "PLR", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["player_device"], subjectDate: false },
  { classCode: "device_loss_alert", eventKind: "device_reported_lost_or_compromised", sourceModule: "PLR", recipientRole: "operations_officer", channels: ["email"], subjectKinds: ["player_device"], subjectDate: false },
  { classCode: "certification_refusal", eventKind: "certification_refused", sourceModule: "PLR", recipientRole: "applicant", channels: ["email"], subjectKinds: ["device_certification"], subjectDate: false },
  // ENG: a capability transition (NTF-ENG-01) and a new disclosure version (NTF-ENG-02) to every party taking part.
  { classCode: "engagement_capability_change", eventKind: "engagement_capability_changed", sourceModule: "ENG", recipientRole: "premises_party", channels: ["email"], subjectKinds: ["capability_release"], subjectDate: false },
  { classCode: "engagement_disclosure", eventKind: "engagement_disclosure_changed", sourceModule: "ENG", recipientRole: "premises_party", channels: ["email"], subjectKinds: ["disclosure_version"], subjectDate: false },
  // IAM: a device pairing code issued (NTF-IAM-01: the premises, the purpose, the expiry and who asked, never the code)
  // and a device credential revoked (NTF-IAM-02: the device, the premises, the effective time and the causing event).
  { classCode: "pairing_authorisation", eventKind: "pairing_authorisation_issued", sourceModule: "IAM", recipientRole: "premises_party", channels: ["email"], subjectKinds: ["pairing_authorisation"], subjectDate: false },
  { classCode: "credential_revocation", eventKind: "device_credential_revoked", sourceModule: "IAM", recipientRole: "premises_party", channels: ["email", "post"], subjectKinds: ["device_credential"], subjectDate: false },
];

/** The roles a party's notices reach it under: SCR-COM-12 offers a party these classes, and an address alone a raiser's. */
export const PARTY_ROLES: readonly RecipientRole[] = ["raiser", "premises_party", "applicant"];

/**
 * The events the policy in force deliberately states no class for: PUB's currency exception to the policy owner
 * (NTF-PUB-01), which COM's raising modules do not include in P1 (PUB `CR-PUB-02`, pending). It is recorded with
 * NO_CLASS_FOR_EVENT and listed on SCR-COM-16, as PUB's `@AC-FR-PUB-032-04` expects.
 */
export const UNCLASSED_EVENTS: readonly string[] = ["publication_overdue"];

/** The classes whose notice tells the recipient that nothing is asked of them (BR-COM-02's "no action is required"). */
const NO_ACTION: readonly string[] = [
  "acknowledgement",
  "evidence_request_cancellation",
  "service_reinstatement",
  "service_scope_exit",
  "appeal_lapse",
  "service_ending_confirmation",
  "application_acknowledgement",
  "expected_decision_date",
  "evidence_quarantine",
  "engagement_capability_change",
  "credential_revocation",
];

const required = (classCode: string, leadTimeDays: number | null = null): SeedNoticeClass => {
  const entry = CLASS_REGISTER.find((candidate) => candidate.classCode === classCode);
  if (entry === undefined) throw new Error(`No register class ${classCode}`);
  return {
    classCode,
    eventKind: entry.eventKind,
    recipientRole: entry.recipientRole,
    channels: entry.channels,
    subjectKinds: entry.subjectKinds,
    isRequired: true,
    requiresProof: true,
    leadTimeDays,
    requiredActionRule: NO_ACTION.includes(classCode) ? "states_no_action" : "states_action",
    retentionMonths: 24,
  };
};

/**
 * Notice policy version 3, in force from 1 July 2026, prepared by Quan Ngọc Trâm and approved by Thạch Minh Khải:
 * the required classes the world's events raise and the newsletter a recipient may refuse. A class whose subject
 * carries a date falls due `CFG-162`'s thirty days before it.
 */
export const NOTICE_POLICY_SEED = {
  versionNo: 3,
  state: "EFFECTIVE" as const,
  effectiveFrom: "2026-07-01",
  effectiveTo: null,
  preparedBy: "Quan Ngọc Trâm",
  preparedAt: at("2026-06-18", "16:20"),
  approvedBy: "Thạch Minh Khải",
  approvedAt: at("2026-06-22", "10:05"),
  classes: [
    required("acknowledgement"),
    required("evidence_request"),
    required("decision"),
    required("outstanding_amount"),
    required("status_change"),
    required("expiry", 30),
    required("track_change"),
    // VER raises an issued inspection record to the inspected party (BR-VER-07, CR-VER-02).
    required("inspection_record"),
    required("evidence_request_cancellation"),
    required("appeal_outcome"),
    required("service_enforcement"),
    required("service_reinstatement"),
    required("service_scope_exit"),
    required("schedule_fallback"),
    required("expected_decision_date", 30),
    required("appeal_lapse"),
    required("case_status_change"),
    required("evidence_deadline_alert"),
    required("evidence_response"),
    required("service_ending_confirmation"),
    required("application_acknowledgement"),
    required("application_evidence_request"),
    required("application_decision"),
    required("application_closure"),
    required("payment_reminder", 30),
    required("evidence_quarantine"),
    required("device_loss_alert"),
    required("certification_refusal"),
    required("engagement_capability_change"),
    required("engagement_disclosure"),
    required("pairing_authorisation"),
    required("credential_revocation"),
    {
      ...required("newsletter"),
      isRequired: false,
      requiresProof: false,
      requiredActionRule: "states_no_action",
    },
  ] satisfies readonly SeedNoticeClass[],
};

/**
 * The authoritative contact register (`CFG-164`): an office per class, from 1 July 2026. The default is the
 * programme support line for every class until the service owner names one, so each class has an entry.
 */
const OFFICE: Readonly<Record<string, string>> = {
  acknowledgement: "case_office",
  evidence_request: "case_office",
  decision: "case_office",
  outstanding_amount: "collection_office",
  status_change: "certificate_office",
  expiry: "certificate_office",
  track_change: "service_office",
  newsletter: "service_office",
  evidence_request_cancellation: "case_office",
  appeal_outcome: "case_office",
  service_enforcement: "service_office",
  service_reinstatement: "service_office",
  service_scope_exit: "service_office",
  schedule_fallback: "service_office",
  appeal_lapse: "case_office",
  case_status_change: "case_office",
  evidence_deadline_alert: "case_office",
  evidence_response: "case_office",
  service_ending_confirmation: "service_office",
  application_acknowledgement: "registration_office",
  application_evidence_request: "registration_office",
  application_decision: "registration_office",
  application_closure: "registration_office",
  expected_decision_date: "registration_office",
  payment_reminder: "collection_office",
  evidence_quarantine: "service_office",
  device_loss_alert: "service_office",
  certification_refusal: "service_office",
  engagement_capability_change: "service_office",
  engagement_disclosure: "service_office",
  pairing_authorisation: "service_office",
  credential_revocation: "service_office",
};

export const CONTACT_REGISTER_SEED: readonly { classCode: string; contactRole: string; effectiveFrom: string }[] = CLASS_REGISTER.map((entry) => ({
  classCode: entry.classCode,
  contactRole: OFFICE[entry.classCode] ?? "support_line",
  effectiveFrom: "2026-07-01",
}));

/** The six elements every template carries a placeholder for (BR-COM-02), in the order the specification lists them. */
export const NOTICE_ELEMENTS = ["subject", "action", "deadline", "consequence", "reference", "contact"] as const;
export type NoticeElement = (typeof NOTICE_ELEMENTS)[number];

/**
 * The three elements whose words a template writes. The other three are filled at composition from what the notice
 * holds: the deadline the event recorded, the notice's own reference, and the office the contact register names.
 */
export const WORDED_ELEMENTS = ["subject", "action", "consequence"] as const satisfies readonly NoticeElement[];
export type WordedElement = (typeof WORDED_ELEMENTS)[number];

/**
 * A template body, element by element. Each element begins its own line with its placeholder, and the words after it,
 * down to the next element's line, are that element's text; `{name}` inside the words is a value of the record the
 * notice is about (`{case}`, `{amount}`, `{playlists}`). An element whose placeholder is absent is null.
 */
export type TemplateSections = Readonly<Record<NoticeElement, string | null>>;

const ELEMENT_LINE = /^\s*\{(subject|action|deadline|consequence|reference|contact)\}\s*(.*)$/;

export function templateSections(body: string): TemplateSections {
  const sections: Record<NoticeElement, string | null> = { subject: null, action: null, deadline: null, consequence: null, reference: null, contact: null };
  let current: NoticeElement | null = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = ELEMENT_LINE.exec(line);
    const element = NOTICE_ELEMENTS.find((candidate) => candidate === marker?.[1]);
    if (element !== undefined) {
      current = element;
      sections[element] = (marker?.[2] ?? "").trim();
    } else if (current !== null && line.trim() !== "") {
      sections[current] = `${sections[current] ?? ""} ${line.trim()}`.trim();
    }
  }
  return sections;
}

/**
 * The elements a body leaves out (`NOTICE_ELEMENT_MISSING`): a placeholder that is not there, or one of the three
 * worded elements with no words after it.
 */
export function templateGaps(body: string): NoticeElement[] {
  const sections = templateSections(body);
  return NOTICE_ELEMENTS.filter((element) => {
    const text = sections[element];
    return text === null || ((WORDED_ELEMENTS as readonly NoticeElement[]).includes(element) && text === "");
  });
}

/** The values a text names: `{case}` names `case`. */
export const valueNames = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");

/** An empty body in each language: the six placeholders, each on its own line, waiting for the words of a new class. */
export const TEMPLATE_SKELETON = NOTICE_ELEMENTS.map((element) => `{${element}}`).join("\n");

const CATALOGUES: Readonly<Record<"vi" | "en", Readonly<Record<string, string>>>> = { vi, en };

/**
 * The values the words of a coded value name, in either language: a change "revoked" is worded by
 * `com.value.change.revoked`, and a fallback to the default playlist by words naming `{instead}`, the playlist that
 * played. A notice whose record lacks one of them would show the placeholder where the value belongs (DR-134).
 */
export function valueWordNames(name: string, value: string | number): string[] {
  const key = `com.value.${name}.${String(value)}`;
  return [...new Set((["vi", "en"] as const).flatMap((language) => valueNames(CATALOGUES[language][key] ?? "")))];
}

/**
 * Version 1 of a class's wording in a language: the catalogue's three sentences for the class written into a body, the
 * deadline, the reference and the contact left for composition. A class the catalogue has no words for cannot be
 * seeded, and says so when the module loads rather than composing a notice with nothing in it.
 */
export function seedTemplateBody(classCode: string, language: "vi" | "en"): string {
  const words = (element: WordedElement): string => {
    const text = CATALOGUES[language][`com.tpl.${classCode}.${element}`];
    if (text === undefined) throw new Error(`No ${language} wording com.tpl.${classCode}.${element} to seed the template from`);
    return text;
  };
  return [`{subject} ${words("subject")}`, `{action} ${words("action")}`, "{deadline}", `{consequence} ${words("consequence")}`, "{reference}", "{contact}"].join("\n");
}

export interface SeedTemplateVersion {
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

/** Version 1 of every class version 3 states, in both languages, prepared and approved with the policy. */
export const TEMPLATE_SEED: readonly SeedTemplateVersion[] = NOTICE_POLICY_SEED.classes.flatMap((entry) =>
  (["vi", "en"] as const).map((language) => ({
    classCode: entry.classCode,
    versionNo: 1,
    language,
    body: seedTemplateBody(entry.classCode, language),
    effectiveFrom: "2026-07-01",
    effectiveTo: null,
    preparedBy: "Quan Ngọc Trâm",
    preparedAt: at("2026-06-19", "09:40"),
    approvedBy: "Thạch Minh Khải",
    approvedAt: at("2026-06-22", "10:30"),
  })),
);

/**
 * The party the canvas's decisions belong to (RightOne ID's organisation `tcv`, Công ty TNHH Then Cửa Việt), and
 * the address its notices go to: its principal's, Đỗ Thu Trang's.
 */
export const DECISION_PAYER = { party: "tcv", destination: "trang.do@thencuaviet.vn" } as const;

/** One report of the delivery treatment, as the provider gave it. */
export interface SeedReport {
  attemptNo: number;
  route: "primary" | "secondary";
  outcome: "attempted" | "pending" | "delivered" | "failed";
  response: string;
  at: string;
  exhausted: boolean;
}

/**
 * What the delivery treatment reported for the notice of an amount, by the decision it is about, where it did not
 * deliver at once. Đa Kao's amount went out while the payer's mailbox was full: five attempts over twenty-four hours
 * across the primary and the secondary route (`CFG-43`'s default), then the treatment gave up.
 */
export const SEED_DELIVERY: Readonly<Record<string, readonly SeedReport[]>> = {
  "OBD-4NPV8CRA2J": [
    { attemptNo: 1, route: "primary", outcome: "failed", response: "452 4.2.2 Mailbox full", at: at("2026-09-10", "14:06"), exhausted: false },
    { attemptNo: 2, route: "primary", outcome: "failed", response: "452 4.2.2 Mailbox full", at: at("2026-09-10", "15:06"), exhausted: false },
    { attemptNo: 3, route: "primary", outcome: "failed", response: "452 4.2.2 Mailbox full", at: at("2026-09-10", "20:06"), exhausted: false },
    { attemptNo: 4, route: "secondary", outcome: "failed", response: "452 4.2.2 Mailbox full", at: at("2026-09-11", "04:06"), exhausted: false },
    { attemptNo: 5, route: "secondary", outcome: "failed", response: "452 4.2.2 Mailbox full", at: at("2026-09-11", "14:06"), exhausted: true },
  ],
};

/**
 * CAT's revocation of "Chủ nhật lười" (Lầu 3 Studio), the track SCR-VEN-07 refuses and Pasteur's weekend schedule
 * fell back from on 25 September, and the run it raised (SM-124). The premises are resolved as any run resolves them,
 * from the playlists and schedules VEN held at the change instant: Pasteur and Nguyễn Huệ. Pasteur was told at once;
 * the run ended before Nguyễn Huệ's notice was issued, so it is INCOMPLETE. Hai Bà Trưng's playlists hold the track
 * too, but its service was enrolled three days later.
 */
export const TRACK_CHANGE_SEED = {
  trackRef: "TRK-CNL-LAU3",
  changeKind: "revoked" as const,
  changeRecordedAt: at("2026-09-25", "09:10"),
  effectiveAt: at("2026-09-25", "09:10"),
  /** The premises the run resolved and did not reach before it ended. */
  untold: ["nh"],
};

/** A review state's failure: the page's own outage. */
export function mockNoticeFailure(): LoadOutcome<never> {
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: "7c2a90e4b1f35d08", retryable: true } };
}
