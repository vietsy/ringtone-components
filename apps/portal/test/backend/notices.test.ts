import { describe, expect, it } from "vitest";
import { comTranslator, elementsOf } from "@/features/notices/copy";
import type { NoticeOfficer } from "@/lib/api/notices";
import type { Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import {
  addPolicyClass,
  approvePolicyVersion,
  approveTemplateVersion,
  continueTrackChangeRun,
  noticePreferences,
  noticeQueue,
  noticeRead,
  noticeTimeliness,
  noticesFor,
  noticesTable,
  noticesTo,
  policyVersion,
  policyVersions,
  preparePolicyVersion,
  prepareTemplateVersion,
  raiseNoticeEvent,
  recordAlternativeService,
  recordNoticeEvent,
  recordPreferences,
  recordReportedTrackChange,
  recordTrackChange,
  recoveryQueue,
  reissueNotice,
  reportDeliveryExhausted,
  reportDeliveryOutcome,
  serviceForm,
  templateVersions,
  trackChangeRun,
  trackChangeRuns,
  unmetObligations,
  withdrawNotice,
  withdrawPolicyVersion,
  type NoticeEvent,
  type OutcomeReporter,
} from "@/lib/mock/backend/notices";
import { addDays, today } from "@/lib/mock/backend/clock";
import { issuePairing, revokeCredential } from "@/lib/mock/backend/player";
import { createPlaylist } from "@/lib/mock/backend/venue";
import { CLASS_REGISTER, CONTACT_REGISTER_SEED, NOTICE_POLICY_SEED, TEMPLATE_SEED, UNCLASSED_EVENTS, templateGaps, templateSections } from "@/lib/mock/notices";
import comEn from "@/messages/screens/com.en.json";
import comVi from "@/messages/screens/com.vi.json";
import { PEOPLE, signIn, signInBeside } from "./harness";

/** A member of staff as the console's seam hands them to the backend: their name and their roles. */
function officer(email: string): NoticeOfficer {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { name: account.name, roles: account.staffRoles };
}

const OPS = officer(PEOPLE.operations);
const PREPARER = officer(PEOPLE.preparer);
const APPROVER = officer(PEOPLE.approver);
const AUDITOR = officer(PEOPLE.supervisor);

/** The principal's party, Công ty TNHH Then Cửa Việt, whose principal's address RightOne ID holds. */
const PARTY = "tcv";
const PARTY_ADDRESS = "trang.do@thencuaviet.vn";

let sequence = 0;
/** An event as another family raises it, with a fresh occurrence each time unless one is given. */
function event(overrides: Partial<NoticeEvent> = {}): NoticeEvent {
  sequence += 1;
  return {
    sourceModule: "CAS",
    eventKind: "case_received",
    occurrenceRef: `CAS-TEST-${sequence}`,
    occurredAt: new Date().toISOString(),
    subjectKind: "case",
    subjectRef: `CAS-TEST-${sequence}`,
    recipientPartyId: PARTY,
    destination: null,
    facts: { case: `CAS-TEST-${sequence}`, submittedAt: new Date().toISOString(), by: today() },
    ...overrides,
  };
}

const detail = (key: string, reference: string) => {
  const queue = noticeQueue(key, OPS, { classCode: null, state: null, dueFrom: null, dueTo: null }, reference);
  const opened = queue.data?.opened;
  if (opened === null || opened === undefined) throw new Error(`notice ${reference} not opened`);
  return opened;
};

/** Approves a policy version that states only the classes given, effective today, and returns its number. */
function approvePolicyStating(key: string, classes: readonly string[]): number {
  const prepared = preparePolicyVersion(key, OPS, { effectiveFrom: today(), effectiveTo: null, unreadable: false, restate: false });
  const versionNo = prepared.accepted?.versionNo ?? 0;
  for (const classCode of classes) {
    const register = CLASS_REGISTER.find((entry) => entry.classCode === classCode);
    if (register === undefined) throw new Error(`no register class ${classCode}`);
    const added = addPolicyClass(key, OPS, versionNo, {
      classCode,
      eventKind: register.eventKind,
      recipientRole: register.recipientRole,
      channels: register.channels,
      subjectKinds: register.subjectKinds,
      isRequired: true,
      requiresProof: true,
      requiredActionRule: "states_action",
      leadTimeDays: register.subjectDate ? "30" : "",
    });
    expect(added.refusal).toBeNull();
  }
  expect(approvePolicyVersion(key, APPROVER, versionNo, "").refusal).toBeNull();
  return versionNo;
}

describe("the seed's wording is the template's, written once from the catalogue", { timeout: 60_000 }, () => {
  it("gives every class of policy version 3 a version 1 in both languages that carries all six elements", () => {
    for (const entry of NOTICE_POLICY_SEED.classes) {
      for (const language of ["vi", "en"] as const) {
        const version = TEMPLATE_SEED.find((candidate) => candidate.classCode === entry.classCode && candidate.language === language);
        expect(version, `${entry.classCode} ${language}`).toBeDefined();
        expect(templateGaps(version?.body ?? "")).toEqual([]);
      }
    }
  });

  it("words every class the register offers in both catalogues: its name, its event, its recipient, its subjects and its office", () => {
    for (const [language, catalogue] of Object.entries({ vi: comVi, en: comEn }) as [string, Readonly<Record<string, string>>][]) {
      for (const entry of CLASS_REGISTER) {
        const office = CONTACT_REGISTER_SEED.find((candidate) => candidate.classCode === entry.classCode)?.contactRole ?? "";
        const keys = [`com.class.${entry.classCode}`, `com.event.${entry.eventKind}`, `com.role.${entry.recipientRole}`, `com.office.${office}`, ...entry.subjectKinds.map((kind) => `com.subject.${kind}`)];
        for (const key of keys) expect(catalogue[key], `${language} ${key}`).toBeDefined();
      }
    }
  });

  it("reads a body element by element, each from its placeholder at the start of a line", () => {
    const sections = templateSections("{subject} Vụ việc {case}.\n{action} Gửi {item}\ntrước hạn.\n{deadline}\n{consequence} Không có gì.\n{reference}\n{contact}");
    expect(sections.subject).toBe("Vụ việc {case}.");
    expect(sections.action).toBe("Gửi {item} trước hạn.");
    expect(sections.deadline).toBe("");
    expect(templateGaps("{subject} Vụ việc {case}.\n{action}\n{deadline}\n{consequence} x\n{reference}")).toEqual(["action", "contact"]);
  });
});

/** Every event kind the other families raise through `recordNoticeEvent`, as the tree held them on 17 October 2026. */
const RAISED: Readonly<Record<string, readonly string[]>> = {
  CAS: ["case_received", "evidence_requested", "evidence_request_cancelled", "case_decided", "appeal_decided", "appeal_lapsed", "case_status_changed", "evidence_deadline_passed", "evidence_answered"],
  FIN: ["obligation_outstanding", "obligation_due"],
  CER: ["status_record_changed", "certificate_expiring"],
  CAT: ["track_changed"],
  VEN: ["service_entitlement_enforced", "service_entitlement_reinstated", "service_entitlement_out_of_scope", "service_entitlement_ending", "schedule_fell_back"],
  IAM: ["pairing_authorisation_issued", "device_credential_revoked"],
  VER: ["inspection_recorded"],
  REG: ["application_submitted", "application_evidence_requested", "application_decided", "decision_date_expected", "application_closed_incomplete"],
  PLR: ["evidence_quarantined", "device_reported_lost_or_compromised", "certification_refused"],
  ENG: ["engagement_capability_changed", "engagement_disclosure_changed"],
  PUB: ["publication_overdue"],
};

describe("every event another family raises has a class in the policy in force", { timeout: 60_000 }, () => {
  it.each(Object.entries(RAISED))("%s's events are stated by a class of policy version 3, with its wording", (_module, kinds) => {
    for (const kind of kinds) {
      const stated = NOTICE_POLICY_SEED.classes.find((entry) => entry.eventKind === kind);
      if (UNCLASSED_EVENTS.includes(kind)) {
        expect(stated, kind).toBeUndefined();
        continue;
      }
      expect(stated, kind).toBeDefined();
      expect(TEMPLATE_SEED.filter((version) => version.classCode === stated?.classCode)).toHaveLength(2);
    }
  });
});

describe("POST /notice-events (DR-131, ALG-111)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-001-01 raises the acknowledgement the policy requires for a case received, against the occurrence", () => {
    const key = signIn(PEOPLE.principal);
    const raised = event();
    const answer = raiseNoticeEvent(key, raised);
    expect(answer.reasonCode).toBe("CLASS_REQUIRED");
    expect(answer.reference).toMatch(/^COM-/);
    const opened = detail(key, answer.reference ?? "");
    expect(opened.classCode).toBe("acknowledgement");
    expect(opened.state).toBe("DELIVERED");
  });

  it("@AC-FR-COM-001-03 records an event no class states as raising nothing, and keeps it in sight on SCR-COM-16", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ eventKind: "case_note_added" }));
    expect(answer).toMatchObject({ reference: null, reasonCode: "NO_CLASS_FOR_EVENT", refused: false });
    const unmet = unmetObligations(key, OPS).data;
    expect(unmet?.unclassified).toContainEqual(expect.objectContaining({ module: "CAS", eventKind: "case_note_added", reason: "NO_CLASS_FOR_EVENT", count: 1 }));
  });

  it("@AC-FR-COM-001-04 answers NOTICE_CLASS_UNKNOWN for a class the policy in force does not state, and creates no notice", () => {
    const key = signIn(PEOPLE.principal);
    const before = noticesTo(key, PARTY).data?.length ?? 0;
    const answer = raiseNoticeEvent(key, event({ classCode: "renewal_reminder" }));
    expect(answer).toMatchObject({ reference: null, reasonCode: "NOTICE_CLASS_UNKNOWN" });
    expect(noticesTo(key, PARTY).data?.length ?? 0).toBe(before);
    expect(unmetObligations(key, OPS).data?.unclassified).toContainEqual(expect.objectContaining({ reason: "NOTICE_CLASS_UNKNOWN" }));
  });

  it("@AC-FR-COM-001-06 refuses an expiry event about a playlist with SUBJECT_KIND_UNKNOWN, recording no event", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ sourceModule: "CER", eventKind: "certificate_expiring", subjectKind: "playlist", facts: { record: "R1-CER-1", premises: "Pasteur", by: today() } }));
    expect(answer).toMatchObject({ reference: null, reasonCode: "SUBJECT_KIND_UNKNOWN", refused: true });
    expect(unmetObligations(key, OPS).data?.refusedEvents).toContainEqual({ module: "CER", code: "SUBJECT_KIND_UNKNOWN", count: 1 });
  });

  it("@AC-FR-COM-020-02 resolves a replayed event to the notice already issued, keeping the old signature's answer", () => {
    const key = signIn(PEOPLE.principal);
    const raised = event();
    const first = recordNoticeEvent(key, raised);
    const replay = raiseNoticeEvent(key, { ...raised, occurredAt: new Date().toISOString() });
    expect(replay).toMatchObject({ reference: first, reasonCode: "NOTICE_ALREADY_ISSUED" });
    expect(recordNoticeEvent(key, raised)).toBe(first);
  });

  it("@AC-FR-COM-020-05 refuses an event with no occurrence reference, naming the module", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ sourceModule: "VEN", occurrenceRef: " " }));
    expect(answer).toMatchObject({ reference: null, reasonCode: "OCCURRENCE_REF_MISSING", refused: true });
    expect(unmetObligations(key, OPS).data?.refusedEvents).toContainEqual({ module: "VEN", code: "OCCURRENCE_REF_MISSING", count: 1 });
  });

  it("gives the events CAS and VEN raise a class each, so the notice reaches the party", () => {
    const key = signIn(PEOPLE.principal);
    const raised = [
      event({ eventKind: "evidence_request_cancelled", facts: { case: "CAS-1", item: "hợp đồng thuê", by: today() } }),
      event({ eventKind: "appeal_decided", facts: { case: "CAS-1", appeal: "APL-1", outcome: "upheld", by: today() } }),
      event({ sourceModule: "VEN", eventKind: "service_entitlement_enforced", subjectKind: "service_entitlement", subjectRef: "RPS-1", facts: { service: "RPS-1", action: "SUSPEND", by: today() } }),
      event({ sourceModule: "VEN", eventKind: "service_entitlement_reinstated", subjectKind: "service_entitlement", subjectRef: "RPS-1", facts: { service: "RPS-1", by: today() } }),
      event({ sourceModule: "VEN", eventKind: "service_entitlement_out_of_scope", subjectKind: "service_entitlement", subjectRef: "RPS-1", facts: { service: "RPS-1", by: today() } }),
    ];
    for (const entry of raised) {
      const answer = raiseNoticeEvent(key, entry);
      expect(answer.reasonCode, entry.eventKind).toBe("CLASS_REQUIRED");
      expect(detail(key, answer.reference ?? "").destination, entry.eventKind).toBe(PARTY_ADDRESS);
    }
  });
});

describe("composition from the approved template (FR-COM-003, DR-134)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-003-01 composes from the template version in force, its words kept with the content", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ eventKind: "case_decided", facts: { case: "CAS-9", by: today() } }));
    const content = detail(key, answer.reference ?? "").content;
    expect(content?.templateVersion).toBe(1);
    expect(content?.wording.vi?.subject).toBe("Vụ việc {case} đã có quyết định.");
    expect(content?.wording.en?.subject).toBe("Case {case} has been decided.");
    expect(Object.keys(content?.recordVersions ?? {})).toEqual(["case"]);
    expect(String(content?.recordVersions.case)).toMatch(/^CAS-TEST-/);
  });

  it("@AC-FR-COM-003-02 keeps a notice issued from version 1 reading version 1 after version 2 is approved", () => {
    const key = signIn(PEOPLE.operations);
    const issued = raiseNoticeEvent(key, event({ eventKind: "case_decided", facts: { case: "CAS-7", by: today() } }));
    const body = "{subject} Vụ việc {case}: quyết định mới.\n{action} Đọc quyết định.\n{deadline}\n{consequence} Khiếu nại muộn vẫn được nhận.\n{reference}\n{contact}";
    const prepared = prepareTemplateVersion(key, OPS, { classCode: "decision", language: "vi", body, effectiveFrom: today(), effectiveTo: null, unreadable: false });
    expect(prepared.accepted?.versionNo).toBe(2);
    const id = templateVersions(key, APPROVER, "decision").data?.versions.find((version) => version.versionNo === 2)?.id ?? "";
    expect(approveTemplateVersion(key, APPROVER, id).refusal).toBeNull();
    expect(detail(key, issued.reference ?? "").content?.wording.vi?.subject).toBe("Vụ việc {case} đã có quyết định.");
    const next = raiseNoticeEvent(key, event({ eventKind: "case_decided", facts: { case: "CAS-8", by: today() } }));
    const content = detail(key, next.reference ?? "").content;
    expect(content?.templateVersion).toBe(2);
    expect(content?.wording.vi?.subject).toBe("Vụ việc {case}: quyết định mới.");
  });

  it("@AC-FR-COM-007-06 holds a track-change notice naming no playlist DUE with NOTICE_ELEMENT_MISSING, writing no content", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(
      key,
      event({
        sourceModule: "CAT",
        eventKind: "track_changed",
        subjectKind: "track",
        facts: { track: "Chủ nhật lười", artist: "Lầu 3 Studio", premises: "Pasteur", playlists: "", schedules: "none", change: "taken_down", effect: "in_effect", effectiveAt: new Date().toISOString(), by: today() },
      }),
    );
    const opened = detail(key, answer.reference ?? "");
    expect(opened.state).toBe("DUE");
    expect(opened.content).toBeNull();
    expect(opened.waiting).toEqual({ reason: "NOTICE_ELEMENT_MISSING", element: "playlists" });
  });
});

describe("the contact point the party record holds (FR-COM-009)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-009-01 resolves a notice raised with no address to the party's principal's address", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ destination: null }));
    expect(detail(key, answer.reference ?? "")).toMatchObject({ channel: "email", destination: PARTY_ADDRESS });
  });

  it("@AC-FR-COM-009-03 records a party with no contact point as an unmet obligation, not as issued", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ recipientPartyId: "lintel", destination: null }));
    const opened = detail(key, answer.reference ?? "");
    expect(opened).toMatchObject({ state: "UNMET", issuedAt: null, unmetReason: "CONTACT_POINT_ABSENT" });
    expect(unmetObligations(key, OPS).data?.rows.map((row) => row.reference)).toContain(answer.reference);
  });
});


/** The notice of the amount Đa Kao's decision sets: the seed's, undelivered after five attempts (SEED_DELIVERY). */
function dakaoNotice(key: string): string {
  const row = noticeQueue(key, OPS, { classCode: "outstanding_amount", state: "UNDELIVERED", dueFrom: null, dueTo: null }, null).data?.rows[0];
  if (row === undefined) throw new Error("no undelivered outstanding-amount notice in the seed");
  return row.reference;
}

describe("POST /notices/{id}/withdraw (SM-121 transitions 3, 8, 13, 14)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-008-12 refuses to withdraw a notice already sent, naming the state, and records the attempt", () => {
    const key = signIn(PEOPLE.approver);
    const sent = raiseNoticeEvent(key, event()).reference ?? "";
    const refused = withdrawNotice(key, APPROVER, sent, "Không còn cần");
    expect(refused.refusal).toMatchObject({ code: "NOTICE_ALREADY_SENT", values: { state: "DELIVERED" } });
    expect(detail(key, sent).state).toBe("DELIVERED");
    expect(serviceForm(key, APPROVER, sent).data?.withdrawal).toMatchObject({ kind: "sent" });
  });

  it("refuses a reader without ACT-BIZ-APR with ROLE_NOT_ASSIGNED", () => {
    const key = signIn(PEOPLE.operations);
    const refused = withdrawNotice(key, OPS, dakaoNotice(key), "Không còn cần");
    expect(refused.refusal?.code).toBe("ROLE_NOT_ASSIGNED");
  });

  it("keeps an undelivered notice of a class still required open: DR-135 row 6 answers TREATMENT_EXHAUSTED", () => {
    const key = signIn(PEOPLE.approver);
    const reference = dakaoNotice(key);
    expect(serviceForm(key, APPROVER, reference).data).toMatchObject({ canWithdraw: true, canServe: false, withdrawal: { kind: "open", reason: "TREATMENT_EXHAUSTED" } });
    expect(withdrawNotice(key, APPROVER, reference, "Không gửi được").refusal?.code).toBe("TREATMENT_EXHAUSTED");
    expect(detail(key, reference).state).toBe("UNDELIVERED");
  });

  it("closes an open notice of a class no longer required unserved, with the reason and who withdrew it", () => {
    const key = signIn(PEOPLE.approver);
    // The newsletter is the one optional class: DR-135 row 4 reaches it whenever its notice is still owed.
    const unmet = raiseNoticeEvent(key, event({ sourceModule: "COM", eventKind: "newsletter_published", subjectKind: "publication", recipientPartyId: "lintel", facts: { title: "Tháng 10", by: today() } })).reference ?? "";
    expect(detail(key, unmet).state).toBe("UNMET");
    expect(withdrawNotice(key, APPROVER, unmet, " ").refusal).toMatchObject({ code: "REASON_MISSING", field: "reason" });
    const withdrawn = withdrawNotice(key, APPROVER, unmet, "Bản tin đã ngừng phát hành");
    expect(withdrawn.accepted).toEqual({ state: "WITHDRAWN" });
    expect(detail(key, unmet).withdrawn).toMatchObject({ by: APPROVER.name, reason: "Bản tin đã ngừng phát hành" });
    expect(withdrawNotice(key, APPROVER, unmet, "lần nữa").accepted).toEqual({ state: "WITHDRAWN" });
  });

  it("refuses a reference that names no notice with NOTICE_NOT_FOUND", () => {
    const key = signIn(PEOPLE.approver);
    expect(withdrawNotice(key, APPROVER, "COM-0000000000", "x").refusal?.code).toBe("NOTICE_NOT_FOUND");
  });

  it("@AC-FR-COM-013-05 closes an undelivered notice as withdrawn when a later version stops requiring its class, and still counts it as not issued", () => {
    const key = signIn(PEOPLE.operations);
    const reference = dakaoNotice(key);
    const versionNo = approvePolicyStating(key, ["acknowledgement", "decision"]);
    const opened = detail(key, reference);
    expect(opened.state).toBe("WITHDRAWN");
    expect(opened.withdrawn).toMatchObject({ by: APPROVER.name, reason: `POLICY_VERSION_${versionNo}` });
    expect(opened.service).toBeNull();
    const period = opened.dueAt.slice(0, 7);
    const row = noticeTimeliness(key, OPS, period).data?.rows.find((entry) => entry.classCode === "outstanding_amount");
    expect(row?.fellDue ?? 0).toBeGreaterThan(0);
    if (row !== undefined && row.notIssued !== null) expect(row.notIssued).toBeGreaterThan(0);
  });
});

describe("POST /notices/{id}/reissue (DR-136)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-020-04 creates a reissue for the same occurrence and reads the original back SUPERSEDED", () => {
    const key = signIn(PEOPLE.operations);
    const raised = event({ eventKind: "case_decided", facts: { case: "CAS-5", by: today() } });
    const original = raiseNoticeEvent(key, raised).reference ?? "";
    const reissued = reissueNotice(key, OPS, original, "Hạn khiếu nại ghi sai");
    expect(reissued.accepted?.reference).toMatch(/^COM-/);
    const fresh = reissued.accepted?.reference ?? "";
    expect(fresh).not.toBe(original);
    expect(detail(key, original)).toMatchObject({ state: "SUPERSEDED", supersededBy: fresh });
    expect(detail(key, fresh)).toMatchObject({ state: "DELIVERED", supersedes: original, reissueReason: "Hạn khiếu nại ghi sai" });
    // The replay of the event now resolves to the reissue, the obligation's one current notice.
    expect(recordNoticeEvent(key, raised)).toBe(fresh);
    // The recipient reads both, signed in as the party's principal on the same browser.
    const principal = signInBeside(key, PEOPLE.principal);
    const read = noticeRead(principal, original, { party: PARTY, account: PEOPLE.principal }).data;
    expect(read?.supersededBy?.reference).toBe(fresh);
    expect(noticeRead(principal, fresh, { party: PARTY, account: PEOPLE.principal }).data?.replaces).toEqual({ reference: original, reason: "Hạn khiếu nại ghi sai" });
  });

  it("@AC-FR-COM-006-04 refuses a reader without the reissue authority with REISSUE_NOT_AUTHORISED, creating nothing", () => {
    const key = signIn(PEOPLE.approver);
    const original = raiseNoticeEvent(key, event()).reference ?? "";
    expect(reissueNotice(key, APPROVER, original, "lý do").refusal?.code).toBe("REISSUE_NOT_AUTHORISED");
    expect(detail(key, original).state).toBe("DELIVERED");
  });

  it("@AC-FR-COM-006-05 refuses to reissue a notice already superseded, naming the notice that replaced it", () => {
    const key = signIn(PEOPLE.operations);
    const original = raiseNoticeEvent(key, event()).reference ?? "";
    const fresh = reissueNotice(key, OPS, original, "Sai tên cơ sở").accepted?.reference ?? "";
    expect(reissueNotice(key, OPS, original, "Lần nữa").refusal).toMatchObject({ code: "NOTICE_NOT_REISSUABLE", values: { state: "SUPERSEDED", reference: fresh } });
  });

  it("@AC-FR-COM-006-06 refuses a reissue with no reason, leaving the original unchanged", () => {
    const key = signIn(PEOPLE.operations);
    const original = raiseNoticeEvent(key, event()).reference ?? "";
    expect(reissueNotice(key, OPS, original, "  ").refusal).toMatchObject({ code: "REISSUE_REASON_MISSING", field: "reason" });
    expect(detail(key, original)).toMatchObject({ state: "DELIVERED", supersededBy: null });
  });
});

describe("track-change runs (FR-COM-007, 015, 016; ALG-114)", { timeout: 60_000 }, () => {
  it("resolves the seeded revocation from VEN's playlists and schedules at the change instant: Pasteur told, Nguyễn Huệ not", () => {
    const key = signIn(PEOPLE.operations);
    const run = trackChangeRuns(key, OPS).data?.runs[0];
    expect(run).toMatchObject({ trackRef: "TRK-CNL-LAU3", changeKind: "revoked", resolvedCount: 2, issuedCount: 1, state: "INCOMPLETE" });
    const view = trackChangeRun(key, OPS, run?.ref ?? "").data;
    const pasteur = view?.recipients.find((recipient) => recipient.notice !== null);
    expect(pasteur?.playlists).toEqual(expect.arrayContaining(["Chill tối", "Acoustic cuối tuần"]));
    expect(pasteur?.schedules.length).toBeGreaterThan(0);
  });

  it("@AC-FR-COM-007-01 @AC-FR-COM-015-01 issues one notice per premises holding a revoked track, naming its playlists only", () => {
    const key = signIn(PEOPLE.operations);
    const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-CNL-ACOUSTIC", changeKind: "revoked", effectiveAt: null });
    expect(recorded.refusal).toBeNull();
    const view = trackChangeRun(key, OPS, recorded.accepted?.run ?? "").data;
    expect(view?.resolvedCount).toBe(recorded.accepted?.resolved);
    expect(view?.issuedCount).toBe(view?.resolvedCount);
    expect(view?.state).toBe("COMPLETE");
    for (const recipient of view?.recipients ?? []) {
      const opened = detail(key, recipient.notice?.reference ?? "");
      expect(opened.content?.values).toMatchObject({ change: "revoked", playlists: recipient.playlists.join(", ") });
      expect(opened.run).toBe(view?.ref);
    }
  });

  it("@AC-FR-COM-007-02 @AC-FR-COM-007-03 names the change as it was recorded: an expiry, a takedown", () => {
    const key = signIn(PEOPLE.operations);
    for (const kind of ["expired", "taken_down"] as const) {
      const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-VEDI-VYSA", changeKind: kind, effectiveAt: null });
      const recipient = trackChangeRun(key, OPS, recorded.accepted?.run ?? "").data?.recipients[0];
      expect(recipient?.notice).not.toBeNull();
      expect(detail(key, recipient?.notice?.reference ?? "").content?.values.change).toBe(kind);
    }
  });

  it("@AC-FR-COM-007-04 states that a change recorded at its effective instant is already in effect, with the schedules", () => {
    const key = signIn(PEOPLE.operations);
    const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-DEANH-DUYKHE", changeKind: "taken_down", effectiveAt: null });
    const view = trackChangeRun(key, OPS, recorded.accepted?.run ?? "").data;
    expect(view?.alreadyInEffect).toBe(true);
    const pasteur = view?.recipients.find((recipient) => recipient.playlists.includes("Trưa văn phòng"));
    const values = detail(key, pasteur?.notice?.reference ?? "").content?.values;
    expect(values).toMatchObject({ effect: "in_effect" });
    expect(String(values?.schedules)).toContain("Trưa văn phòng");
  });

  it("states the interval left where the change takes effect later", () => {
    const key = signIn(PEOPLE.operations);
    const later = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-CNL-ACOUSTIC", changeKind: "expired", effectiveAt: later });
    const view = trackChangeRun(key, OPS, recorded.accepted?.run ?? "").data;
    expect(view?.alreadyInEffect).toBe(false);
    expect(detail(key, view?.recipients[0]?.notice?.reference ?? "").content?.values.effect).toBe("upcoming");
  });

  it("@AC-FR-COM-007-07 holds a run that resolved nobody for a change already in effect, refusing TRACK_CHANGE_RUN_EMPTY", () => {
    const key = signIn(PEOPLE.operations);
    const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-NOBODY-PLAYS", changeKind: "taken_down", effectiveAt: null });
    expect(recorded.refusal?.code).toBe("TRACK_CHANGE_RUN_EMPTY");
    const run = String(recorded.refusal?.values.run ?? "");
    expect(trackChangeRun(key, OPS, run).data).toMatchObject({ resolvedCount: 0, issuedCount: 0, state: "INCOMPLETE", recipients: [] });
    expect(continueTrackChangeRun(key, OPS, run).refusal?.code).toBe("TRACK_CHANGE_RUN_EMPTY");
  });

  it("closes a run that resolved nobody before the change takes effect as COMPLETE, recorded", () => {
    const key = signIn(PEOPLE.operations);
    const later = new Date(Date.now() + 86_400_000).toISOString();
    const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-NOBODY-PLAYS", changeKind: "expired", effectiveAt: later });
    expect(recorded.accepted).toMatchObject({ resolved: 0, issued: 0 });
    expect(trackChangeRun(key, OPS, recorded.accepted?.run ?? "").data?.state).toBe("COMPLETE");
  });

  it("returns the run already created for a repeat of the same change", () => {
    const key = signIn(PEOPLE.operations);
    const change = { trackRef: "TRK-CNL-ACOUSTIC", changeKind: "revoked" as const, changeRecordedAt: new Date().toISOString(), effectiveAt: new Date().toISOString() };
    const first = recordTrackChange(key, change);
    expect(recordTrackChange(key, change).accepted?.run).toBe(first.accepted?.run);
  });

  it("@AC-FR-COM-015-02 @AC-FR-COM-015-03 keeps the resolved count beside the issued count and refuses to close short", () => {
    const key = signIn(PEOPLE.operations);
    const seeded = trackChangeRuns(key, OPS).data?.runs.find((run) => run.trackRef === "TRK-CNL-LAU3");
    expect(seeded).toMatchObject({ resolvedCount: 2, issuedCount: 1 });
    const continued = continueTrackChangeRun(key, OPS, seeded?.ref ?? "");
    // Nguyễn Huệ's party holds an address, so the outstanding notice goes now and the run completes.
    expect(continued.accepted).toEqual({ issued: 1, outstanding: 0 });
  });

  it("@AC-FR-COM-015-06 discloses nothing for a run reference that names no run, and records the attempt", () => {
    const key = signIn(PEOPLE.operations);
    expect(trackChangeRun(key, OPS, "TCN-0000000000").failure?.code).toBe("TRACK_CHANGE_RUN_NOT_FOUND");
  });

  it("@AC-FR-COM-016-01 @AC-FR-COM-016-02 sends to the premises' party, never the device, and records the device's condition beside it", () => {
    const key = signIn(PEOPLE.operations);
    const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-CNL-ACOUSTIC", changeKind: "revoked", effectiveAt: null });
    const view = trackChangeRun(key, OPS, recorded.accepted?.run ?? "").data;
    expect(view?.recipients.length).toBeGreaterThan(0);
    for (const recipient of view?.recipients ?? []) {
      const opened = detail(key, recipient.notice?.reference ?? "");
      expect(opened.destination).toBe(PARTY_ADDRESS);
      expect(opened.device?.condition).toMatch(/^(ONLINE|OFFLINE|STOPPED|NO_DEVICE)$/);
      expect(recipient.device).toEqual(opened.device);
      expect(opened.issuedAt).not.toBeNull();
    }
  });

  it("@AC-FR-COM-015-04 leaves out of the run a premises that adds the track after the change instant", () => {
    const key = signIn(PEOPLE.operations);
    const recorded = recordReportedTrackChange(key, OPS, { trackRef: "TRK-CNL-ACOUSTIC", changeKind: "revoked", effectiveAt: null });
    const run = recorded.accepted?.run ?? "";
    const before = trackChangeRun(key, OPS, run).data;
    expect(before?.resolvedCount).toBeGreaterThan(0);
    // Hai Bà Trưng, whose playlists did not hold the track, puts it in a new one after the change was recorded.
    const principal = signInBeside(key, PEOPLE.principal);
    expect(createPlaylist(principal, "tcv", "RPS-Q4NDT7WZ2K", "Thêm sau", [{ kind: "TRACK", ref: "TRK-CNL-ACOUSTIC" }]).refusal).toBeNull();
    const after = trackChangeRun(key, OPS, run).data;
    expect(after?.resolvedCount).toBe(before?.resolvedCount);
    expect(after?.recipients.map((recipient) => recipient.premises)).toEqual(before?.recipients.map((recipient) => recipient.premises));
    expect(after?.recipients.some((recipient) => recipient.playlists.includes("Thêm sau"))).toBe(false);
  });

  it("refuses the console's record without ACT-OPS, and without a track or a kind of change", () => {
    const key = signIn(PEOPLE.approver);
    expect(recordReportedTrackChange(key, APPROVER, { trackRef: "TRK-CNL-ACOUSTIC", changeKind: "revoked", effectiveAt: null }).refusal?.code).toBe("ROLE_NOT_ASSIGNED");
    expect(recordReportedTrackChange(key, OPS, { trackRef: " ", changeKind: "revoked", effectiveAt: null }).refusal).toMatchObject({ code: "FIELD_MISSING", field: "track" });
    expect(recordReportedTrackChange(key, OPS, { trackRef: "TRK-CNL-ACOUSTIC", changeKind: "lost", effectiveAt: null }).refusal).toMatchObject({ code: "FIELD_MISSING", field: "kind" });
  });
});

describe("the recovery queue and SCR-COM-09 for the business approver", { timeout: 60_000 }, () => {
  it("lets the approver read a notice to withdraw it, and refuses a reader with none of the roles", () => {
    const key = signIn(PEOPLE.approver);
    expect(serviceForm(key, APPROVER, dakaoNotice(signInBeside(key, PEOPLE.operations))).data?.canWithdraw).toBe(true);
    expect(serviceForm(key, AUDITOR, "COM-0000000000").failure?.code).toBe("ROLE_NOT_ASSIGNED");
  });

  it("shows a notice not yet issued with nothing to serve", () => {
    const key = signIn(PEOPLE.operations);
    const unmet = raiseNoticeEvent(key, event({ recipientPartyId: "lintel" })).reference ?? "";
    expect(serviceForm(key, OPS, unmet).data).toMatchObject({ state: "UNMET", issuedAt: null, canServe: true, canWithdraw: false });
    expect(recordAlternativeService(key, OPS, unmet, { route: "Tận tay", servedOn: today(), unreadable: false, evidence: "" }).refusal?.code).toBe("NOTICE_NOT_FOUND");
  });
});

describe("timeliness and the recipient's read (FR-COM-011, 019)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-011-03 carries the late interval of a notice issued after it fell due", () => {
    const key = signIn(PEOPLE.operations);
    const seeded = trackChangeRuns(key, OPS).data?.runs.find((run) => run.trackRef === "TRK-CNL-LAU3");
    continueTrackChangeRun(key, OPS, seeded?.ref ?? "");
    const late = trackChangeRun(key, OPS, seeded?.ref ?? "").data?.recipients.find((recipient) => recipient.premises !== "" && recipient.notice !== null && detail(key, recipient.notice.reference).lateMinutes !== null);
    expect(late).toBeDefined();
  });

  it("counts a reissue from the first notice issued for its obligation", () => {
    const key = signIn(PEOPLE.operations);
    const original = raiseNoticeEvent(key, event()).reference ?? "";
    const fresh = reissueNotice(key, OPS, original, "Sai chính tả").accepted?.reference ?? "";
    expect(detail(key, fresh).lateMinutes).toBeNull();
    expect(policyVersion(key, PREPARER, NOTICE_POLICY_SEED.versionNo).data?.classes.length).toBe(NOTICE_POLICY_SEED.classes.length);
  });
});

describe("the classes of FR-COM-001 and the occurrence a notice is recorded against", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-001-02 states an acknowledgement, a decision, an evidence request, a status change, an expiry and an outstanding amount in the policy in force", () => {
    const key = signIn(PEOPLE.preparer);
    const classes = policyVersion(key, PREPARER, NOTICE_POLICY_SEED.versionNo).data?.classes.map((entry) => entry.classCode) ?? [];
    expect(classes).toEqual(expect.arrayContaining(["acknowledgement", "decision", "evidence_request", "status_change", "expiry", "outstanding_amount"]));
  });

  it("@AC-FR-COM-001-05 records a decision notice against the occurrence reference the raising module supplied", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ eventKind: "case_decided", occurrenceRef: "DEC-2026-0041", facts: { case: "CAS-41", by: today() } }));
    expect(detail(key, answer.reference ?? "").occurrence).toEqual({ ref: "DEC-2026-0041", module: "CAS", eventKind: "case_decided" });
  });

  it("issues CER's status change to the holder, its status worded from its code", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(
      key,
      event({ sourceModule: "CER", eventKind: "status_record_changed", subjectKind: "certificate", facts: { record: "R1-CER-2026-T7QM4BWJ", premises: "Pasteur", status: "SUSPENDED", effectiveAt: new Date().toISOString(), by: today() } }),
    );
    expect(answer.reasonCode).toBe("CLASS_REQUIRED");
    const opened = detail(key, answer.reference ?? "");
    expect(opened.state).toBe("DELIVERED");
    const words = elementsOf(opened.content ?? noContent(), comTranslator("vi"), "vi");
    expect(words.subject).toBe("Giấy xác nhận R1-CER-2026-T7QM4BWJ của Pasteur đã chuyển sang trạng thái: tạm đình chỉ.");
  });
});

/** The Vietnam day `days` after today. */
const dayAfter = (days: number): string => addDays(new Date().toISOString(), days);

/** No content where one was expected: the test stops there. */
function noContent(): never {
  throw new Error("the notice has no content");
}

describe("an expiry notice falls due at its lead time (FR-COM-011)", { timeout: 60_000 }, () => {
  const expiring = (by: string) =>
    event({ sourceModule: "CER", eventKind: "certificate_expiring", subjectKind: "certificate", facts: { record: "R1-CER-2026-T7QM4BWJ", premises: "Pasteur", lastDay: by, by } });

  it("@AC-FR-COM-011-05 leaves an expiry notice whose lead time has not been reached due later, and issues nothing yet", () => {
    const key = signIn(PEOPLE.principal);
    const by = dayAfter(60);
    const answer = raiseNoticeEvent(key, expiring(by));
    const opened = detail(key, answer.reference ?? "");
    expect(opened).toMatchObject({ state: "DUE", issuedAt: null, content: null });
    // CFG-162's thirty days before the expiry day, at the start of that day in Vietnam.
    expect(Date.parse(by) - Date.parse(opened.dueAt)).toBe((30 * 24 + 7) * 3_600_000);
  });

  it("@AC-FR-COM-011-04 makes an expiry inside the lead time due at once and states the days remaining", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, expiring(dayAfter(9)));
    expect(detail(key, answer.reference ?? "").state).toBe("DELIVERED");
    expect(noticeRead(key, answer.reference ?? "", { party: PARTY, account: PEOPLE.principal }).data?.remainingDays).toBe(9);
  });
});

describe("the wording of a value given as a code", { timeout: 60_000 }, () => {
  const fallback = (facts: Readonly<Record<string, string>>) =>
    event({
      sourceModule: "VEN",
      eventKind: "schedule_fell_back",
      subjectKind: "playlist",
      facts: { service: "RPS-1", premises: "Pasteur", playlist: "Chill tối", period: "2026-09-25 18:00-22:00", cause: "PLAYLIST_NO_ELIGIBLE_TRACK", by: today(), ...facts },
    });

  it("words VEN's fallback from its code with what played instead, and the period as a day and its hours", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, fallback({ resolvedTo: "DEFAULT_PLAYLIST", instead: "Nhạc nền chung" }));
    const content = detail(key, answer.reference ?? "").content ?? noContent();
    const vi = elementsOf(content, comTranslator("vi"), "vi").subject;
    expect(vi).toContain("không phát được danh sách Chill tối và đã chuyển sang danh sách mặc định “Nhạc nền chung”");
    expect(vi).toContain("18:00–22:00 ngày 25");
    expect(vi).not.toMatch(/\{|DEFAULT_PLAYLIST|2026-09-25/);
    expect(elementsOf(content, comTranslator("en"), "en").subject).toContain("and it fell back to the default playlist “Nhạc nền chung”");
  });

  it("says nothing plays where no playlist could, with no playlist to name", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, fallback({ resolvedTo: "NO_PLAYABLE_SCHEDULE" }));
    const content = detail(key, answer.reference ?? "").content ?? noContent();
    expect(elementsOf(content, comTranslator("vi"), "vi").subject).toContain("và khung giờ này không phát gì vì không còn danh sách nào phát được");
  });

  it("holds a fallback to the default playlist that does not name it DUE with NOTICE_ELEMENT_MISSING naming the value", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, fallback({ resolvedTo: "DEFAULT_PLAYLIST" }));
    expect(detail(key, answer.reference ?? "")).toMatchObject({ state: "DUE", content: null, waiting: { reason: "NOTICE_ELEMENT_MISSING", element: "instead" } });
  });

  it("names a track change as it was recorded and says when it took effect, rather than always calling it a revocation", () => {
    const key = signIn(PEOPLE.principal);
    const effectiveAt = new Date().toISOString();
    const answer = raiseNoticeEvent(
      key,
      event({
        sourceModule: "CAT",
        eventKind: "track_changed",
        subjectKind: "track",
        facts: { track: "Chủ nhật lười", artist: "Lầu 3 Studio", premises: "Pasteur", playlists: "Chill tối", schedules: "none", change: "taken_down", effect: "in_effect", effectiveAt, by: today() },
      }),
    );
    const words = elementsOf(detail(key, answer.reference ?? "").content ?? noContent(), comTranslator("vi"), "vi");
    expect(words.subject).toContain("Bản ghi Chủ nhật lười (Lầu 3 Studio) trong danh sách phát của Pasteur đã bị gỡ xuống. Thay đổi đã có hiệu lực từ");
    expect(words.subject).not.toContain("thu hồi");
    expect(words.action).toContain("Lịch phát dùng các danh sách này: không có.");
  });

  it("words a case's new state from its code rather than printing it", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ eventKind: "case_status_changed", facts: { case: "CAS-12", state: "REFERRED", process: "Hoà giải", reason: "Thuộc thẩm quyền hoà giải", by: today() } }));
    const content = detail(key, answer.reference ?? "").content ?? noContent();
    expect(elementsOf(content, comTranslator("vi"), "vi").subject).toBe("Vụ việc CAS-12 đã được chuyển sang quy trình khác.");
    expect(elementsOf(content, comTranslator("en"), "en").subject).toBe("Case CAS-12 has been referred to another process.");
  });
});

/** A member of staff as IAM's console hands them to its backend. */
function staffOf(key: string, email: string): Staff {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { sessionId: key, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

describe("IAM's notices (NTF-IAM-01, 02) have classes of their own", { timeout: 60_000 }, () => {
  it("issues the pairing code's notice to the premises' party, naming who asked and never the code", () => {
    const key = signIn(PEOPLE.principal);
    const code = issuePairing(key, "tcv", "pasteur", "PLAYBACK").accepted?.value ?? "";
    const row = noticeQueue(key, OPS, { classCode: "pairing_authorisation", state: null, dueFrom: null, dueTo: null }, null).data?.rows[0];
    const opened = detail(key, row?.reference ?? "");
    expect(opened).toMatchObject({ state: "DELIVERED", destination: PARTY_ADDRESS, occurrence: { module: "IAM", eventKind: "pairing_authorisation_issued" } });
    const words = elementsOf(opened.content ?? noContent(), comTranslator("vi"), "vi");
    expect(words.subject).toContain("theo yêu cầu của Đỗ Thu Trang, dùng để phát nhạc tại cơ sở");
    expect(JSON.stringify(opened)).not.toContain(code.replace(/\s/g, "").slice(0, 4));
  });

  it("issues the revocation's notice with its causing event worded", () => {
    const key = signIn(PEOPLE.operations);
    expect(revokeCredential(staffOf(key, PEOPLE.operations), "DCR-7K2MQXB4TA", "Thiết bị hỏng không sửa được", "").accepted).toEqual({ state: "REVOKED" });
    const row = noticeQueue(key, OPS, { classCode: "credential_revocation", state: null, dueFrom: null, dueTo: null }, null).data?.rows[0];
    const opened = detail(key, row?.reference ?? "");
    expect(opened.issuedAt).not.toBeNull();
    const words = elementsOf(opened.content ?? noContent(), comTranslator("vi"), "vi");
    expect(words.subject).toContain("Thông tin xác thực của thiết bị PLY-0035");
    expect(words.subject).toContain("Lý do: quyết định của cán bộ vận hành.");
  });
});

describe("as_of on the two policy reads (R1.11)", { timeout: 60_000 }, () => {
  it("reads the policy version in force on the day asked, and none before the first took effect", () => {
    const key = signIn(PEOPLE.operations);
    expect(policyVersions(key, OPS).data).toMatchObject({ inForce: NOTICE_POLICY_SEED.versionNo, asOf: null });
    const next = approvePolicyStating(key, ["acknowledgement"]);
    expect(policyVersions(key, OPS).data?.inForce).toBe(next);
    expect(policyVersions(key, OPS, "2026-08-01").data).toMatchObject({ inForce: NOTICE_POLICY_SEED.versionNo, asOf: "2026-08-01" });
    expect(policyVersions(key, OPS, "2026-06-15").data?.inForce).toBeNull();
  });

  it("marks the template version that composed a class on the day asked", () => {
    const key = signIn(PEOPLE.operations);
    const body = "{subject} Vụ việc {case}: quyết định mới.\n{action} Đọc quyết định.\n{deadline}\n{consequence} Khiếu nại muộn vẫn được nhận.\n{reference}\n{contact}";
    prepareTemplateVersion(key, OPS, { classCode: "decision", language: "vi", body, effectiveFrom: today(), effectiveTo: null, unreadable: false });
    const id = templateVersions(key, APPROVER, "decision").data?.versions.find((version) => version.versionNo === 2)?.id ?? "";
    expect(approveTemplateVersion(key, APPROVER, id).refusal).toBeNull();
    expect(templateVersions(key, OPS, "decision").data?.inForce.vi).toBe(2);
    const then = templateVersions(key, OPS, "decision", "2026-08-01").data;
    expect(then).toMatchObject({ asOf: "2026-08-01", inForce: { vi: 1, en: 1 } });
    expect(then?.versions.find((version) => version.inForce && version.language === "vi")?.versionNo).toBe(1);
  });
});

describe("every refused console act is recorded with its actor (srs/02, cases.audit_log)", { timeout: 60_000 }, () => {
  const lastAudit = (key: string) => noticesTable(key).auditLog.at(-1);

  it("@AC-FR-COM-008-11 refuses a class stated against a version that does not exist, disclosing nothing and recording the attempt", () => {
    const key = signIn(PEOPLE.operations);
    const refused = addPolicyClass(key, OPS, 99, {
      classCode: "expiry",
      eventKind: "certificate_expiring",
      recipientRole: "premises_party",
      channels: ["email"],
      subjectKinds: ["certificate"],
      isRequired: true,
      requiresProof: true,
      requiredActionRule: "states_action",
      leadTimeDays: "30",
    });
    expect(refused.refusal).toEqual({ code: "POLICY_VERSION_NOT_FOUND", field: null, values: {} });
    expect(lastAudit(key)).toMatchObject({ actor: OPS.name, act: "add_class", subject: "99:expiry", code: "POLICY_VERSION_NOT_FOUND" });
  });

  it("@AC-FR-COM-008-09 refuses a version whose period ends before it starts, naming the two dates, and records the attempt", () => {
    const key = signIn(PEOPLE.operations);
    const before = policyVersions(key, OPS).data?.versions.length;
    const refused = preparePolicyVersion(key, OPS, { effectiveFrom: "2027-06-01", effectiveTo: "2027-03-01", unreadable: false, restate: false });
    expect(refused.refusal).toEqual({ code: "PERIOD_INVALID", field: "to", values: { from: "2027-06-01", to: "2027-03-01" } });
    expect(policyVersions(key, OPS).data?.versions.length).toBe(before);
    expect(lastAudit(key)).toMatchObject({ actor: OPS.name, act: "prepare_policy_version", code: "PERIOD_INVALID" });
  });

  it("records the refusals of templates, services, runs and withdrawals that once went unrecorded", () => {
    const key = signIn(PEOPLE.operations);
    const attempts: readonly [() => { refusal: { code: string } | null }, string, string][] = [
      [() => prepareTemplateVersion(key, OPS, { classCode: "decision", language: "fr", body: "", effectiveFrom: today(), effectiveTo: null, unreadable: false }), "prepare_template", "FIELD_MISSING"],
      [() => approveTemplateVersion(key, APPROVER, "no-such-version"), "approve_template", "POLICY_VERSION_NOT_FOUND"],
      [() => recordAlternativeService(key, OPS, "COM-0000000000", { route: "Tận tay", servedOn: today(), unreadable: false, evidence: "" }), "record_alternative_service", "NOTICE_NOT_FOUND"],
      [() => continueTrackChangeRun(key, OPS, "TCN-0000000000"), "continue_track_change_run", "TRACK_CHANGE_RUN_NOT_FOUND"],
      [() => withdrawPolicyVersion(key, APPROVER, 99, "Không cần"), "withdraw_policy_version", "POLICY_VERSION_NOT_FOUND"],
    ];
    for (const [attempt, act, code] of attempts) {
      expect(attempt().refusal?.code, act).toBe(code);
      expect(lastAudit(key), act).toMatchObject({ act, code });
    }
  });
});

/** A postal address: the post reports nothing at issue, so the notice stays ISSUED until it does. */
const POSTAL = "12 Pasteur, phường Bến Nghé, Quận 1, TP. Hồ Chí Minh";
const POST: OutcomeReporter = { kind: "treatment", source: "postal-service" };
const outcomesOf = (key: string, reference: string) => detail(key, reference).outcomes;
/** The latest audit row of an act: a read of the notice records its own row after it. */
const lastOf = (key: string, act: string) => noticesTable(key).auditLog.filter((row) => row.act === act).at(-1);
const inRecovery = (key: string, reference: string) => (recoveryQueue(key, OPS, null).data?.rows ?? []).some((row) => row.reference === reference);

/** A decision notice sent by post, issued and waiting for the post to report. */
function postalNotice(key: string): string {
  const reference = raiseNoticeEvent(key, event({ eventKind: "case_decided", destination: POSTAL, facts: { case: "CAS-PO", by: today() } })).reference ?? "";
  expect(detail(key, reference)).toMatchObject({ state: "ISSUED", channel: "post" });
  return reference;
}

describe("what the delivery treatment reports (POST /notices/{id}/delivery-outcomes and /delivery-exhausted)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-004-08 discharges a notice the post reports delivered, and the recovery queue no longer holds it", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    expect(inRecovery(key, reference)).toBe(true);
    const reported = reportDeliveryOutcome(key, POST, reference, { outcome: "delivered", attemptNo: 2, route: "primary", providerResponse: "Đã phát tận tay", reportedAt: new Date().toISOString() });
    expect(reported.accepted).toEqual({ state: "DELIVERED" });
    expect(outcomesOf(key, reference).at(-1)).toMatchObject({ outcome: "delivered", reportedBy: "provider", reportedSourceRef: "postal-service" });
    expect(inRecovery(key, reference)).toBe(false);
  });

  it("@AC-FR-COM-005-03 refuses an officer recording as delivered a notice the queue holds with two failed attempts", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    for (const attemptNo of [2, 3]) {
      expect(reportDeliveryOutcome(key, POST, reference, { outcome: "failed", attemptNo, route: "primary", providerResponse: "Không có người nhận", reportedAt: new Date(Date.now() + attemptNo).toISOString() }).refusal).toBeNull();
    }
    const refused = reportDeliveryOutcome(key, { kind: "staff", officer: OPS }, reference, { outcome: "delivered", attemptNo: 4, route: "primary", providerResponse: "Đã giao", reportedAt: new Date().toISOString() });
    expect(refused.refusal?.code).toBe("NOTICE_NOT_DELIVERED");
    expect(inRecovery(key, reference)).toBe(true);
  });

  it("@AC-FR-COM-013-03 refuses an officer recording the exhausted notice as delivered, and the obligation stays open", () => {
    const key = signIn(PEOPLE.operations);
    const reference = dakaoNotice(key);
    const refused = reportDeliveryOutcome(key, { kind: "staff", officer: OPS }, reference, { outcome: "delivered", attemptNo: 6, route: "primary", providerResponse: "Đã giao", reportedAt: new Date().toISOString() });
    expect(refused.refusal?.code).toBe("NOTICE_NOT_DELIVERED");
    expect(detail(key, reference).state).toBe("UNDELIVERED");
    expect(serviceForm(key, APPROVER, reference).data?.withdrawal).toEqual({ kind: "open", reason: "TREATMENT_EXHAUSTED" });
  });

  it("@AC-FR-COM-004-05 names the alternative service to an officer reporting a delivery, writes no outcome and records the attempt", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    const before = outcomesOf(key, reference).length;
    const refused = reportDeliveryOutcome(key, { kind: "staff", officer: OPS }, reference, { outcome: "delivered", attemptNo: 2, route: "primary", providerResponse: "Đã giao", reportedAt: new Date().toISOString() });
    expect(refused.refusal).toEqual({ code: "NOTICE_NOT_DELIVERED", field: null, values: { route: "alternative_service" } });
    expect(outcomesOf(key, reference)).toHaveLength(before);
    expect(lastOf(key, "record_delivery_outcome")).toMatchObject({ actor: OPS.name, code: "NOTICE_NOT_DELIVERED" });
  });

  it("@AC-FR-COM-004-06 refuses an outcome of a kind the four do not name, naming them, and leaves the notice as it was", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    const refused = reportDeliveryOutcome(key, POST, reference, { outcome: "deferred", attemptNo: 2, route: "primary", providerResponse: "Hoãn", reportedAt: new Date().toISOString() });
    expect(refused.refusal).toMatchObject({ code: "OUTCOME_KIND_UNKNOWN", values: { kinds: "attempted, pending, delivered, failed" } });
    expect(detail(key, reference).state).toBe("ISSUED");
  });

  it("@AC-FR-COM-004-07 refuses an outcome reported by a route with no identity to stamp, keeping the outcomes already held", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    const held = outcomesOf(key, reference);
    expect(held.map((outcome) => outcome.outcome)).toEqual(["attempted", "pending"]);
    const refused = reportDeliveryOutcome(key, { kind: "unauthenticated" }, reference, { outcome: "delivered", attemptNo: 2, route: "primary", providerResponse: "Đã giao", reportedAt: new Date().toISOString() });
    expect(refused.refusal?.code).toBe("PROOF_SOURCE_MISSING");
    expect(outcomesOf(key, reference)).toEqual(held);
    expect(lastOf(key, "record_delivery_outcome")).toMatchObject({ actor: null, code: "PROOF_SOURCE_MISSING" });
  });

  it("@AC-FR-COM-004-03 refuses a delivery with no provider outcome for a class that requires proof", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    const refused = reportDeliveryOutcome(key, POST, reference, { outcome: "delivered", attemptNo: 2, route: "primary", providerResponse: " ", reportedAt: new Date().toISOString() });
    expect(refused.refusal?.code).toBe("PROOF_OUTCOME_MISSING");
    expect(detail(key, reference)).toMatchObject({ state: "ISSUED", deliveredAt: null });
  });

  it("adds no row for a repeat of an attempt already reported at that instant", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    const report = { outcome: "failed", attemptNo: 2, route: "primary" as const, providerResponse: "Không có người nhận", reportedAt: new Date().toISOString() };
    reportDeliveryOutcome(key, POST, reference, report);
    const after = outcomesOf(key, reference).length;
    expect(reportDeliveryOutcome(key, POST, reference, report).accepted).toEqual({ state: "ISSUED" });
    expect(outcomesOf(key, reference)).toHaveLength(after);
  });

  it("@AC-FR-COM-005-05 refuses an exhaustion reported against a discharged notice, naming the day, and writes no outcome", () => {
    const key = signIn(PEOPLE.operations);
    const reference = raiseNoticeEvent(key, event()).reference ?? "";
    const delivered = detail(key, reference);
    const refused = reportDeliveryExhausted(key, { kind: "treatment", source: "email-provider" }, reference, { attemptNo: 5, route: "secondary", providerResponse: "452 4.2.2 Mailbox full", reportedAt: new Date().toISOString() });
    expect(refused.refusal).toMatchObject({ code: "NOTICE_ALREADY_DISCHARGED", values: { date: delivered.deliveredAt } });
    expect(outcomesOf(key, reference)).toHaveLength(delivered.outcomes.length);
    expect(lastOf(key, "record_delivery_exhausted")).toMatchObject({ actor: "email-provider", code: "NOTICE_ALREADY_DISCHARGED" });
  });

  it("leaves an exhausted notice UNDELIVERED with its obligation open, for operations to serve, and refuses a reader without ACT-OPS", () => {
    const key = signIn(PEOPLE.operations);
    const reference = postalNotice(key);
    const report = { attemptNo: 3, route: "secondary" as const, providerResponse: "Không phát được, trả lại", reportedAt: new Date().toISOString() };
    expect(reportDeliveryExhausted(key, { kind: "staff", officer: APPROVER }, reference, report).refusal?.code).toBe("ROLE_NOT_ASSIGNED");
    expect(reportDeliveryExhausted(key, { kind: "staff", officer: OPS }, reference, report).accepted).toEqual({ state: "UNDELIVERED", open: true });
    expect(outcomesOf(key, reference).at(-1)).toMatchObject({ outcome: "failed", exhausted: true, reportedBy: "operations" });
    expect(recoveryQueue(key, OPS, null).data?.rows.find((row) => row.reference === reference)).toMatchObject({ state: "UNDELIVERED", exhausted: true });
  });
});

describe("the recovery queue counts what failed (FR-COM-005, 013)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-005-01 holds a required notice that failed on its first attempt, with its class, the age of the failure and a depth per class", () => {
    const key = signIn(PEOPLE.operations);
    const reference = raiseNoticeEvent(key, event({ destination: "trang.do@thencuaviet.invalid" })).reference ?? "";
    const queue = recoveryQueue(key, OPS, null).data;
    expect(queue?.rows.find((row) => row.reference === reference)).toMatchObject({ classCode: "acknowledgement", attempts: 1, firstFailureAt: expect.any(String) as unknown });
    expect(queue?.depths.find((depth) => depth.classCode === "acknowledgement")?.depth).toBeGreaterThan(0);
  });

  it("@AC-FR-COM-005-02 keeps each attempt on the secondary route as its own outcome beside the primary ones", () => {
    const key = signIn(PEOPLE.operations);
    const routes = serviceForm(key, OPS, dakaoNotice(key)).data?.attempts.map((attempt) => attempt.route) ?? [];
    expect(routes).toEqual(["primary", "primary", "primary", "secondary", "secondary"]);
  });

  it("@AC-FR-COM-005-04 records a failed notice of a class that is not required without putting it in the queue for required notices", () => {
    const key = signIn(PEOPLE.operations);
    const depth = () => (recoveryQueue(key, OPS, null).data?.rows ?? []).length;
    const before = depth();
    const reference = raiseNoticeEvent(key, event({ sourceModule: "COM", eventKind: "newsletter_published", subjectKind: "publication", destination: "trang.do@thencuaviet.invalid", facts: { title: "Tháng 10", by: today() } })).reference ?? "";
    expect(detail(key, reference).state).toBe("UNDELIVERED");
    expect(depth()).toBe(before);
  });

  it("@AC-FR-COM-013-02 closes the obligation of an undelivered notice served by hand, naming who served it", () => {
    const key = signIn(PEOPLE.operations);
    const reference = dakaoNotice(key);
    const served = recordAlternativeService(key, OPS, reference, { route: "Giao tận tay tại cơ sở", servedOn: today(), unreadable: false, evidence: "Biên nhận số 14" });
    expect(served.accepted).toEqual({ servedOn: today() });
    expect(detail(key, reference)).toMatchObject({ state: "SERVED_ALTERNATIVELY", service: { servedBy: OPS.name, route: "Giao tận tay tại cơ sở" } });
  });

  it("@AC-FR-COM-013-06 refuses a service with no date of service, naming the date, and the obligation stays open", () => {
    const key = signIn(PEOPLE.operations);
    const reference = dakaoNotice(key);
    const refused = recordAlternativeService(key, OPS, reference, { route: "Giao tận tay", servedOn: null, unreadable: false, evidence: "" });
    expect(refused.refusal).toEqual({ code: "ALTERNATIVE_SERVICE_INCOMPLETE", field: "servedOn", values: { element: "date" } });
    expect(detail(key, reference).state).toBe("UNDELIVERED");
  });
});

describe("a recipient's preferences (FR-COM-010)", { timeout: 60_000 }, () => {
  const reader = { party: PARTY, account: PEOPLE.principal };
  const newsletter = () => event({ sourceModule: "COM", eventKind: "newsletter_published", subjectKind: "publication", facts: { title: "Tháng 10", by: today() } });

  it("@AC-FR-COM-010-05 issues a class that is not required to a recipient who has not switched it off, on the optional branch", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, newsletter());
    expect(answer.reasonCode).toBe("CLASS_OPTIONAL");
    expect(detail(key, answer.reference ?? "").state).toBe("DELIVERED");
  });

  it("@AC-FR-COM-010-02 issues nothing of a class the recipient switched off, recording the suppression against the class", () => {
    const key = signIn(PEOPLE.principal);
    expect(recordPreferences(key, reader, null, { newsletter: false }).data).toEqual({ refused: [] });
    expect(noticePreferences(key, reader, null).data?.classes.find((entry) => entry.classCode === "newsletter")).toEqual({ classCode: "newsletter", required: false, receiving: false });
    expect(raiseNoticeEvent(key, newsletter())).toMatchObject({ reference: null, reasonCode: "SUPPRESSED_BY_PREFERENCE" });
  });

  it("@AC-FR-COM-010-03 refuses to switch off a required class, naming it, and writes no suppression", () => {
    const key = signIn(PEOPLE.principal);
    expect(recordPreferences(key, reader, null, { expiry: false }).data).toEqual({ refused: ["expiry"] });
    expect(noticesTable(key).noticeSuppressions.filter((entry) => entry.noticeClassCode === "expiry")).toEqual([]);
  });

  it("@AC-FR-COM-010-04 keeps the refused suppression as an attempt with the actor, the class and the instant", () => {
    const key = signIn(PEOPLE.principal);
    recordPreferences(key, reader, null, { expiry: false });
    expect(noticesTable(key).auditLog.at(-1)).toMatchObject({ actor: PEOPLE.principal, act: "suppress", subject: "expiry", code: "SUPPRESSION_NOT_PERMITTED", at: expect.any(String) as unknown });
  });

  it("@AC-FR-COM-010-01 issues a required class whatever the recipient asked to stop receiving", () => {
    const key = signIn(PEOPLE.principal);
    recordPreferences(key, reader, null, { newsletter: false, expiry: false });
    const answer = raiseNoticeEvent(key, event({ sourceModule: "CER", eventKind: "certificate_expiring", subjectKind: "certificate", facts: { record: "R1-CER-2026-T7QM4BWJ", premises: "Pasteur", lastDay: dayAfter(5), by: dayAfter(5) } }));
    expect(answer.reasonCode).toBe("CLASS_REQUIRED");
    expect(detail(key, answer.reference ?? "").state).toBe("DELIVERED");
  });
});

describe("the notice policy (FR-COM-008, 011)", { timeout: 60_000 }, () => {
  it("@AC-FR-COM-008-01 resolves a notice's class from the version in force at the event and records that version", () => {
    const key = signIn(PEOPLE.operations);
    const versionNo = approvePolicyStating(key, ["acknowledgement"]);
    expect(detail(key, raiseNoticeEvent(key, event()).reference ?? "").policyVersion).toBe(versionNo);
  });

  it("@AC-FR-COM-008-03 refuses to approve a version whose period overlaps the one in force, naming it", () => {
    const key = signIn(PEOPLE.operations);
    const inForce = approvePolicyStating(key, ["acknowledgement"]);
    const prepared = preparePolicyVersion(key, OPS, { effectiveFrom: dayAfter(-1), effectiveTo: null, unreadable: false, restate: false }).accepted?.versionNo ?? 0;
    expect(approvePolicyVersion(key, APPROVER, prepared, "").refusal).toMatchObject({ code: "POLICY_PERIOD_OVERLAP", values: { other: inForce } });
    expect(policyVersions(key, OPS).data?.inForce).toBe(inForce);
  });

  it("@AC-FR-COM-008-04 refuses an obligation raised when no version was in force with POLICY_NOT_CONFIGURED, creating no notice", () => {
    const key = signIn(PEOPLE.principal);
    const answer = raiseNoticeEvent(key, event({ occurredAt: "2026-06-01T09:00:00+07:00" }));
    expect(answer).toMatchObject({ reference: null, reasonCode: "POLICY_NOT_CONFIGURED" });
    expect(unmetObligations(key, OPS).data?.unclassified).toContainEqual(expect.objectContaining({ module: "CAS", reason: "POLICY_NOT_CONFIGURED" }));
  });

  it("@AC-FR-COM-008-06 refuses the preparer's own approval with SEG_SAME_ACTOR naming them, the version staying prepared", () => {
    const key = signIn(PEOPLE.operations);
    const prepared = preparePolicyVersion(key, OPS, { effectiveFrom: dayAfter(30), effectiveTo: null, unreadable: false, restate: true }).accepted?.versionNo ?? 0;
    expect(approvePolicyVersion(key, OPS, prepared, "").refusal).toMatchObject({ code: "SEG_SAME_ACTOR", values: { preparer: OPS.name } });
    expect(policyVersion(key, OPS, prepared).data?.version.state).toBe("PREPARED");
    expect(noticesTable(key).auditLog.at(-1)).toMatchObject({ actor: OPS.name, act: "approve_policy_version", code: "SEG_SAME_ACTOR" });
  });

  it("@AC-FR-COM-008-08 refuses the policy versions to a reader holding no notice role, disclosing nothing and recording the attempt", () => {
    const key = signIn(PEOPLE.supervisor);
    expect(policyVersions(key, AUDITOR)).toEqual({ data: null, failure: { code: "ROLE_NOT_ASSIGNED", traceId: null, retryable: false } });
    expect(noticesTable(key).auditLog.at(-1)).toMatchObject({ actor: AUDITOR.name, act: "read_policy_versions", code: "ROLE_NOT_ASSIGNED" });
  });

  it("@AC-FR-COM-008-10 refuses a further class on a version in force, naming its state", () => {
    const key = signIn(PEOPLE.operations);
    const refused = addPolicyClass(key, OPS, NOTICE_POLICY_SEED.versionNo, {
      classCode: "held_amount",
      eventKind: "amount_held",
      recipientRole: "payee",
      channels: ["email"],
      subjectKinds: ["amount"],
      isRequired: true,
      requiresProof: true,
      requiredActionRule: "states_action",
      leadTimeDays: "",
    });
    expect(refused.refusal).toMatchObject({ code: "POLICY_VERSION_NOT_PREPARED", values: { state: "EFFECTIVE" } });
    expect(policyVersion(key, OPS, NOTICE_POLICY_SEED.versionNo).data?.classes.some((entry) => entry.classCode === "held_amount")).toBe(false);
  });

  it("refuses a class stated with a negative lead time, and one leaving a designation unset", () => {
    const key = signIn(PEOPLE.operations);
    const prepared = preparePolicyVersion(key, OPS, { effectiveFrom: dayAfter(30), effectiveTo: null, unreadable: false, restate: false }).accepted?.versionNo ?? 0;
    const expiry = { classCode: "expiry", eventKind: "certificate_expiring", recipientRole: "premises_party", channels: ["email"], subjectKinds: ["certificate"], isRequired: true, requiresProof: true, requiredActionRule: "states_action", leadTimeDays: "-5" };
    expect(addPolicyClass(key, OPS, prepared, expiry).refusal).toMatchObject({ code: "LEAD_TIME_INVALID", field: "lead" });
    expect(addPolicyClass(key, OPS, prepared, { ...expiry, leadTimeDays: "30", requiresProof: null }).refusal).toMatchObject({ code: "CLASS_DESIGNATION_MISSING", field: "proof" });
    expect(policyVersion(key, OPS, prepared).data?.classes).toEqual([]);
  });

  it("@AC-FR-COM-011-08 makes a class whose subject carries no date due at the instant of the event", () => {
    const key = signIn(PEOPLE.principal);
    const occurredAt = new Date().toISOString();
    expect(raiseNoticeEvent(key, event({ occurredAt })).dueAt).toBe(occurredAt);
  });

  it("@AC-FR-COM-003-03 holds a notice of a class with no wording in force DUE with TEMPLATE_VERSION_NOT_EFFECTIVE, writing no content", () => {
    const key = signIn(PEOPLE.operations);
    approvePolicyStating(key, ["acknowledgement", "held_amount"]);
    const answer = raiseNoticeEvent(key, event({ sourceModule: "FIN", eventKind: "amount_held", subjectKind: "amount", facts: { amount: 1_500_000, currency: "VND", by: today() } }));
    expect(detail(key, answer.reference ?? "")).toMatchObject({ state: "DUE", content: null, waiting: { reason: "TEMPLATE_VERSION_NOT_EFFECTIVE", element: null } });
  });
});

describe("a delegate reads the notices of her premises only (PTY, DR-201)", { timeout: 60_000 }, () => {
  const NGUYEN_HUE = "Then Cửa Coffee & Tea – Nguyễn Huệ";
  const PASTEUR = "Then Cửa Coffee & Tea – Pasteur";
  /** Hầu Ngọc Ánh signed in for Then Cửa Việt, as the notice pages hand her to the backend. */
  const reader = { party: PARTY, account: "Hầu Ngọc Ánh" };
  const expiring = (premises: string) =>
    event({ sourceModule: "CER", eventKind: "certificate_expiring", subjectKind: "certificate", facts: { record: "R1-CER-2026-T7QM4BWJ", premises, lastDay: dayAfter(5), by: dayAfter(5) } });
  const listed = (key: string) => (noticesFor(key, PARTY).data ?? []).map((notice) => notice.reference);

  it("lists and opens for the delegate a notice about Nguyễn Huệ, and neither one about Pasteur nor one to the party as a whole", () => {
    const key = signIn(PEOPLE.principal);
    const own = raiseNoticeEvent(key, expiring(NGUYEN_HUE)).reference ?? "";
    const other = raiseNoticeEvent(key, expiring(PASTEUR)).reference ?? "";
    const party = raiseNoticeEvent(key, event()).reference ?? "";
    const delegate = signInBeside(key, PEOPLE.delegate);
    expect(listed(delegate)).toContain(own);
    expect(listed(delegate)).not.toContain(other);
    expect(listed(delegate)).not.toContain(party);
    expect(noticeRead(delegate, own, reader).data?.reference).toBe(own);
    expect(noticeRead(delegate, other, reader).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(noticeRead(delegate, party, reader).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(noticesTable(key).auditLog.at(-1)).toMatchObject({ actor: "Hầu Ngọc Ánh", act: "read", subject: party, code: "ROLE_OUT_OF_SCOPE" });
    expect(listed(key)).toEqual(expect.arrayContaining([own, other, party]));
  });

  it("refuses the delegate the party's preferences with ROLE_OUT_OF_SCOPE, which only its principal sets, and records nothing", () => {
    const key = signIn(PEOPLE.principal);
    const delegate = signInBeside(key, PEOPLE.delegate);
    expect(noticePreferences(delegate, reader, null).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(recordPreferences(delegate, reader, null, { newsletter: false }).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(noticesTable(key).noticeSuppressions).toEqual([]);
    expect(noticePreferences(key, { party: PARTY, account: PEOPLE.principal }, null).data?.party).toBe(PARTY);
  });

  it("refuses a delegate whose authority was revoked the list and every notice, even one about Nguyễn Huệ", () => {
    const key = signIn(PEOPLE.principal);
    const own = raiseNoticeEvent(key, expiring(NGUYEN_HUE)).reference ?? "";
    const revoked = signInBeside(key, PEOPLE.revokedDelegate);
    expect(noticesFor(revoked, PARTY).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(noticeRead(revoked, own, { party: PARTY, account: "Giang Thục Quyên" }).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
  });
});
