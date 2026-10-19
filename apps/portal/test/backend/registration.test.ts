import { afterEach, describe, expect, it, vi } from "vitest";
import type { FactQuestion, StartInput } from "@/lib/api/registration";
import type { Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import type * as Cases from "@/lib/mock/backend/cases";
import { addDays } from "@/lib/mock/backend/clock";
import type * as Notices from "@/lib/mock/backend/notices";
import {
  addEvidenceItem,
  addRequestedDocument,
  applicationDraft,
  applicationList,
  applicationRecord,
  attestAndSubmit,
  attestationStep,
  caseFile,
  deadlineStateAt,
  decisionFactsOf,
  decisionList,
  decisionRecord,
  declareFacts,
  evidenceStep,
  factsStep,
  openFactChangeReportsAt,
  previewApplication,
  raiseAssertion,
  recordClaimOutcome,
  recordCorrection,
  recordOfficerWithdrawal,
  recordProposal,
  recordVerdict,
  registrationPolicy,
  registrationReports,
  requestEvidence,
  reviewQueue,
  sendOfficerAmendment,
  startApplication,
  startOfficerAmendment,
  useStartRecord,
  withdrawApplication,
} from "@/lib/mock/backend/registration";
import { listSupplyOf, requestInspectionList } from "@/lib/mock/backend/inspection";
// After registration: COM's module imports registration's, so registration is loaded first and reads the stand-in.
import { recordNoticeEvent, type NoticeEvent } from "@/lib/mock/backend/notices";
import { sessions } from "@/lib/mock/backend/store";
import { PEOPLE, signIn, signInBeside } from "./harness";

/**
 * COM and CAS answer REG through their contract functions. Two behaviours below need an answer their seeds do not
 * give - COM issuing (or not issuing) the notice an event asks for, and a CAS appeal case that is decided - so the
 * test gives it in their place through the same functions, and leaves every other answer theirs.
 */
const comAnswers = new Map<string, "ISSUE" | "NONE">();

// A world's first read seeds every family it touches, which takes seconds; the walks below read several.
vi.setConfig({ testTimeout: 30_000 });
const decidedCases = new Set<string>();

vi.mock("@/lib/mock/backend/notices", async (importOriginal) => {
  const actual = await importOriginal<typeof Notices>();
  return {
    ...actual,
    recordNoticeEvent: vi.fn((key: string, event: NoticeEvent) => {
      const answer = comAnswers.get(event.eventKind);
      if (answer === "NONE") return null;
      return actual.recordNoticeEvent(key, event) ?? (answer === "ISSUE" ? `COM-TEST-${event.occurrenceRef}` : null);
    }),
  };
});

vi.mock("@/lib/mock/backend/cases", async (importOriginal) => {
  const actual = await importOriginal<typeof Cases>();
  return {
    ...actual,
    caseDecisionFor: (key: string, reference: string) =>
      decidedCases.has(reference) ? { state: "DECIDED" as const, decided: true, correctionRequired: false, decidedAt: "2026-10-15T09:00:00+07:00" } : actual.caseDecisionFor(key, reference),
  };
});

/** The canvas's Bùi Viện lounge, in rulebook review with a tariff for its facts. */
const LOUNGE = "REG-D2VL7KQE3S";
/** The Sala draft: every answer and document in, a fee for its answers. */
const SALA = "REG-P5TJ4BXC7M";
/** Pasteur's decision, the one whose facts the canvas draws, so a change or an amendment copies them. */
const PASTEUR = "OBD-3FJW6NRA5C";
const PASTEUR_NAME = "Then Cửa Coffee & Tea – Pasteur";
/** Pasteur's application, decided on the automated route. */
const PASTEUR_APPLICATION = "REG-Y6TN4JHA8D";
/** Nguyễn Huệ's decision: its use began on 1 September 2026, so it is payable by 29 November. */
const NGUYEN_HUE = "OBD-8KWT2PZH6M";
const NGUYEN_HUE_NAME = "Then Cửa Coffee & Tea – Nguyễn Huệ";
const FILE = { name: "giay-to.pdf", type: "application/pdf", sizeBytes: 48_213 };
const ITEMS = [
  { code: "FIRE-SAFETY", description: "Giấy chứng nhận an toàn phòng cháy" },
  { code: "SEATING-PLAN", description: "Sơ đồ chỗ ngồi có chữ ký" },
];

/** The member of staff a session names, as `requireStaff` hands them to the backend. */
function staffOf(sessionId: string): Staff {
  const account = findAccount(sessions().get(sessionId)?.email ?? "");
  if (account === null) throw new Error(`no staff session ${sessionId}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

/** A world with the principal and the operations officer signed in from the same browser. */
function world(): { principal: string; officer: Staff } {
  const principal = signIn(PEOPLE.principal);
  return { principal, officer: staffOf(signInBeside(principal, PEOPLE.operations)) };
}

/** Moves the clock the mock backend reads, leaving timers alone. */
function at(instant: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

/** The events REG raised through COM since the test began, by their kind. */
const raised = (eventKind: string): NoticeEvent[] =>
  vi
    .mocked(recordNoticeEvent)
    .mock.calls.map(([, event]) => event)
    .filter((event) => event.eventKind === eventKind);

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(recordNoticeEvent).mockClear();
  comAnswers.clear();
  decidedCases.clear();
});

/** Answers every question, confirms what was copied and adds every document still needed; the refusal of the save, or null. */
function completeDraft(principal: string, ref: string, answers: Partial<Record<FactQuestion, string>> = {}): string | null {
  const facts = factsStep(principal, ref).data;
  if (facts === null) throw new Error(`no draft ${ref}`);
  const given = facts.answers;
  const held: Record<FactQuestion, string | number | null> = {
    premises_class: given.premisesClass,
    customer_area: given.customerArea,
    days_open: given.daysOpen,
    music_method: given.musicMethod,
    use_began_on: given.useBeganOn,
  };
  const values = Object.fromEntries(facts.questions.map((question) => [question, answers[question] ?? String(held[question] ?? "")]));
  const saved = declareFacts(principal, ref, { values, reconfirmed: Object.keys(facts.copied ?? {}) as FactQuestion[] });
  if (saved.refusal !== null) return saved.refusal.code;
  const step = evidenceStep(principal, ref).data;
  for (const missing of step?.stillNeeded ?? []) {
    if (missing.for === "RULES") addEvidenceItem(principal, ref, `rules:${missing.item}`, FILE);
    if (missing.for === "CLAIM") {
      const claim = step?.claims.find((entry) => entry.layer === missing.layer);
      if (claim !== undefined) addEvidenceItem(principal, ref, `claim:${claim.kind}:${claim.layer}:${missing.item}`, FILE);
    }
  }
  return null;
}

/** A draft completed, reviewed, confirmed and sent; the state it reached, or the code that refused it. */
function sendDraft(principal: string, ref: string, answers: Partial<Record<FactQuestion, string>> = {}): string {
  const incomplete = completeDraft(principal, ref, answers);
  if (incomplete !== null) return incomplete;
  const review = previewApplication(principal, ref);
  if (review.data === null) return review.failure?.code ?? "NO_REVIEW";
  const shown = attestationStep(principal, "", ref).data?.shown ?? null;
  if (shown === null) return review.data.feeRefusal ?? review.data.blocked ?? "NOT_SHOWN";
  const sent = attestAndSubmit(principal, ref, { presentation: shown.presentation, factsDigest: shown.factsDigest, confirmed: true, changeDutyAcknowledged: true });
  return sent.accepted?.status ?? sent.refusal?.code ?? "NO_ANSWER";
}

// ---------------------------------------------------------------- evidence requests (FR-REG-037)

describe("evidence requests (FR-REG-037)", () => {
  it("@AC-FR-REG-037-01 an officer's request opens due in fourteen days and NTF-REG-02 tells the applicant each item and the due date", () => {
    at("2026-10-20T03:00:00Z");
    const { officer } = world();
    const asked = requestEvidence(officer, LOUNGE, ITEMS);
    expect(asked.accepted?.dueOn).toBe("2026-11-03");
    const file = caseFile(officer, LOUNGE).data;
    expect(file?.status).toBe("EVIDENCE_REQUIRED");
    expect(file?.requests?.at(-1)).toMatchObject({ state: "OPEN", dueOn: "2026-11-03" });
    const [notice] = raised("application_evidence_requested");
    expect(notice).toMatchObject({ sourceModule: "REG", subjectRef: LOUNGE, recipientPartyId: "tcv" });
    expect(notice?.facts.dueOn).toBe("2026-11-03");
    expect(String(notice?.facts.items)).toContain("Sơ đồ chỗ ngồi có chữ ký");
  });

  it("@AC-FR-REG-037-02 the last item supplied answers the request and returns the application to review, complete on that day", () => {
    at("2026-10-20T03:00:00Z");
    const { principal, officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    at("2026-10-22T03:00:00Z");
    addRequestedDocument(principal, LOUNGE, "FIRE-SAFETY", FILE);
    at("2026-10-24T03:00:00Z");
    expect(addRequestedDocument(principal, LOUNGE, "SEATING-PLAN", FILE).accepted?.status).toBe("UNDER_REVIEW");
    const file = caseFile(officer, LOUNGE).data;
    expect(file?.requests?.at(-1)?.state).toBe("ANSWERED");
    expect(file?.statements[0]?.completeOn).toBe("2026-10-24");
  });

  it("the restated dates are told to the applicant again (NTF-REG-04, DR-41 row 5)", () => {
    at("2026-10-20T03:00:00Z");
    const { principal, officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    addRequestedDocument(principal, LOUNGE, "FIRE-SAFETY", FILE);
    addRequestedDocument(principal, LOUNGE, "SEATING-PLAN", FILE);
    const told = raised("decision_date_expected");
    expect(told).toHaveLength(1);
    expect(told[0]?.facts).toMatchObject({ completeOn: "2026-10-20", expectedOn: "2026-11-10", restated: "yes" });
  });

  it("@AC-FR-REG-037-03 a request past its due date that the applicant was told of lapses, and the application closes incomplete with NTF-REG-05", () => {
    comAnswers.set("application_evidence_requested", "ISSUE");
    at("2026-10-20T03:00:00Z");
    const { principal, officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    addRequestedDocument(principal, LOUNGE, "FIRE-SAFETY", FILE);
    at("2026-11-03T17:15:00Z");
    const file = caseFile(officer, LOUNGE).data;
    expect(file?.status).toBe("CLOSED_INCOMPLETE");
    expect(file?.requests?.at(-1)?.state).toBe("LAPSED");
    expect(file?.ended).toMatchObject({ kind: "CLOSED_INCOMPLETE", on: "2026-11-04" });
    expect(file?.transitions[0]).toMatchObject({ from: "EVIDENCE_REQUIRED", to: "CLOSED_INCOMPLETE", cause: "LAPSE" });
    const [closed] = raised("application_closed_incomplete");
    expect(String(closed?.facts.missing)).toBe("Sơ đồ chỗ ngồi có chữ ký");
  });

  it("a closure is counted as closed, apart from refusals and withdrawals (RPT-REG-03)", () => {
    comAnswers.set("application_evidence_requested", "ISSUE");
    at("2026-10-20T03:00:00Z");
    const { officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    at("2026-11-10T03:00:00Z");
    const outcomes = registrationReports(officer, "2026-11-01", "2026-11-30").data?.outcomes;
    expect(outcomes).toMatchObject({ closed: 1, refused: 0, withdrawn: 0 });
  });

  it("@AC-FR-REG-037-06 a document supplied after the request lapsed is refused, and nothing is written", () => {
    comAnswers.set("application_evidence_requested", "ISSUE");
    at("2026-10-20T03:00:00Z");
    const { principal, officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    at("2026-11-05T03:00:00Z");
    expect(addRequestedDocument(principal, LOUNGE, "SEATING-PLAN", FILE).refusal?.code).toBe("EVIDENCE_REQUEST_CLOSED");
    const file = caseFile(officer, LOUNGE).data;
    expect(file?.status).toBe("CLOSED_INCOMPLETE");
    expect(file?.requests?.at(-1)?.items.every((item) => item.receivedOn === null)).toBe(true);
  });

  it("@AC-FR-REG-037-07 a request the applicant was never told of does not lapse", () => {
    comAnswers.set("application_evidence_requested", "NONE");
    at("2026-10-20T03:00:00Z");
    const { officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    at("2026-11-04T03:00:00Z");
    const file = caseFile(officer, LOUNGE).data;
    expect(file?.status).toBe("EVIDENCE_REQUIRED");
    expect(file?.requests?.at(-1)).toMatchObject({ state: "OPEN", notice: "NOT_SENT" });
  });

  it("@AC-FR-REG-037-08 a notice first raised on a later day gives the whole response period from that day", () => {
    comAnswers.set("application_evidence_requested", "NONE");
    at("2026-10-20T03:00:00Z");
    const { officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    comAnswers.set("application_evidence_requested", "ISSUE");
    at("2026-11-05T03:00:00Z");
    expect(caseFile(officer, LOUNGE).data?.requests?.at(-1)).toMatchObject({ state: "OPEN", dueOn: "2026-11-19", notice: "SENT" });
    expect(raised("application_evidence_requested").at(-1)?.facts.dueOn).toBe("2026-11-19");
    at("2026-11-06T03:00:00Z");
    expect(caseFile(officer, LOUNGE).data?.status).toBe("EVIDENCE_REQUIRED");
  });

  it("an officer without the operations role cannot request evidence", () => {
    const { principal } = world();
    const approver = staffOf(signInBeside(principal, PEOPLE.approver));
    expect(requestEvidence(approver, LOUNGE, ITEMS).refusal?.code).toBe("NOT_AUTHORISED");
    expect(raised("application_evidence_requested")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- decisions as they read now

describe("decisions as they read now", () => {
  it("a decision issued tells the applicant with NTF-REG-03, naming the appeal route", () => {
    const { officer } = world();
    const proposal = recordProposal(officer, LOUNGE, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null });
    const decision = proposal.accepted?.decision ?? null;
    expect(decision).not.toBeNull();
    const [told] = raised("application_decided");
    expect(told).toMatchObject({ occurrenceRef: `NTF-REG-03/${decision ?? ""}`, recipientPartyId: "tcv" });
    expect(told?.facts).toMatchObject({ outcome: "DECIDED_AS_APPLIED", appealRoute: "explanation-3" });
  });

  it("a decision carries the statement that its expected date fell after the payment deadline (FR-REG-030)", () => {
    const { principal, officer } = world();
    const decision = recordProposal(officer, LOUNGE, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null }).accepted?.decision ?? "";
    expect(decisionRecord(principal, decision).data?.lateStatement).toMatchObject({ expectedOn: "2026-10-06", deadline: "2026-10-02" });
  });

  it("@AC-FR-REG-023-01 the deadline state of a premises inside its ninety days is within the deadline", () => {
    const { principal } = world();
    expect(deadlineStateAt(principal, PASTEUR_NAME, "2026-12-14T08:00:00+07:00")).toEqual({ state: "WITHIN_DEADLINE", on: "2026-12-14" });
  });

  it("@AC-FR-REG-023-02 the deadline state of a premises after its ninety days is past the deadline", () => {
    const { principal } = world();
    expect(deadlineStateAt(principal, PASTEUR_NAME, "2026-12-15T00:00:00+07:00")).toEqual({ state: "PAST_DEADLINE", on: "2026-12-14" });
  });

  it("@AC-FR-REG-023-05 a premises with no decision answers none", () => {
    const { principal } = world();
    expect(deadlineStateAt(principal, "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ", "2026-12-01T10:00:00+07:00")).toBeNull();
  });

  it("the decision read states its deadline even where it reads no payment (FR-REG-022)", () => {
    at("2026-12-20T03:00:00Z");
    const { principal } = world();
    expect(decisionRecord(principal, PASTEUR).data?.deadline).toEqual({ on: "2026-12-14", state: "PAST_DEADLINE" });
  });
});

// ---------------------------------------------------------------- a claim decided after its decision (DR-289 row 6)

/** Sala sent on 16 October with a non-use claim on producers' rights, in claim review and not yet decided. */
function sentWithClaim(): { principal: string; officer: Staff } {
  at("2026-10-16T03:00:00Z");
  const { principal, officer } = world();
  // The canvas's Sala draft may carry the claim already; otherwise it is raised here.
  if (!(evidenceStep(principal, SALA).data?.claims.some((claim) => claim.kind === "NON_USE" && claim.layer === "PRODUCERS") ?? false)) {
    expect(raiseAssertion(principal, SALA, { kind: "NON_USE", layer: "PRODUCERS", from: "2026-10-16", to: "2027-09-30" }).refusal).toBeNull();
  }
  expect(sendDraft(principal, SALA)).toBe("UNDER_REVIEW");
  return { principal, officer };
}

/** Sala sent with a non-use claim on producers' rights and decided as applied for, the claim still in review. */
function decidedWithClaim(): { principal: string; officer: Staff; decision: string } {
  const { principal, officer } = sentWithClaim();
  const proposal = recordProposal(officer, SALA, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null });
  const decision = proposal.accepted?.decision ?? null;
  if (decision === null) throw new Error(`not decided: ${JSON.stringify(proposal.refusal)}`);
  return { principal, officer, decision };
}

describe("a claim decided after its decision (DR-289 row 6)", () => {
  it("while the claim is in review, the decision reads it as pending", () => {
    const { principal, decision } = decidedWithClaim();
    expect(decisionRecord(principal, decision).data?.claim).toEqual({ state: "UNDER_REVIEW" });
    expect(decisionList(principal, null).data?.items.find((row) => row.reference === decision)?.note).toBe("CLAIM_PENDING");
  });

  it("not accepted, the decision stops reading the claim as pending and carries the statement, the deadline unchanged", () => {
    const { principal, officer, decision } = decidedWithClaim();
    const before = decisionRecord(principal, decision).data;
    const answer = recordClaimOutcome(officer, SALA, "PRODUCERS-NON_USE", { outcome: "NOT_ACCEPTED", reason: "EVIDENCE_PART_PERIOD", scopeFrom: null, scopeTo: null, withLegal: false });
    expect(answer.accepted).toEqual({ state: "NOT_ACCEPTED", decision: null });
    const after = decisionRecord(principal, decision).data;
    expect(after?.claim).toMatchObject({ state: "NOT_ACCEPTED", kind: "NON_USE", layer: "PRODUCERS", on: "2026-10-16" });
    expect(after?.payBy).toBe(before?.payBy);
    expect(decisionList(principal, null).data?.items.find((row) => row.reference === decision)?.note).toBe("OTHERWISE");
  });

  it("not accepted, NTF-REG-03 tells the applicant the decision stands otherwise than applied for, with the appeal route", () => {
    const { officer, decision } = decidedWithClaim();
    recordClaimOutcome(officer, SALA, "PRODUCERS-NON_USE", { outcome: "NOT_ACCEPTED", reason: "EVIDENCE_PART_PERIOD", scopeFrom: null, scopeTo: null, withLegal: false });
    const told = raised("application_decided").find((event) => event.occurrenceRef === `NTF-REG-03/${decision}/PRODUCERS-NON_USE`);
    expect(told?.facts).toMatchObject({ outcome: "DECIDED_OTHERWISE", reason: "EVIDENCE_PART_PERIOD", appealRoute: "explanation-3" });
  });

  it("@AC-FR-REG-035-02 a claim accepted after the decision amends it from that day, and the deadline stays where it was", () => {
    const { principal, officer, decision } = decidedWithClaim();
    const before = decisionRecord(principal, decision).data;
    const answer = recordClaimOutcome(officer, SALA, "PRODUCERS-NON_USE", { outcome: "ACCEPTED", reason: "NON_USE_SHOWN", scopeFrom: null, scopeTo: null, withLegal: false });
    const amendment = answer.accepted?.decision ?? "";
    expect(answer.accepted?.state).toBe("ACCEPTED");
    expect(decisionRecord(principal, decision).data).toMatchObject({ status: "SUPERSEDED", replacedBy: { reference: amendment, from: "2026-10-16" } });
    const after = decisionRecord(principal, amendment).data;
    expect(after).toMatchObject({ status: "CURRENT", prior: decision, payBy: before?.payBy, useBeganOn: before?.useBeganOn });
    expect(after?.lines.filter((line) => line.layer === "PRODUCERS").every((line) => line.amountMinor === 0 && line.treatment === "CLAIM_ACCEPTED")).toBe(true);
  });
});

// ---------------------------------------------------------------- a claim decided before its decision (DR-289 rows 3 and 6)

describe("a claim decided before its decision", () => {
  it("@AC-FR-REG-035-03 not accepted, the layer stays charged, the deadline counts from the use-start date and the decision is otherwise than applied for, with its statement", () => {
    const { principal, officer } = sentWithClaim();
    const approver = staffOf(signInBeside(principal, PEOPLE.approver));
    const outcome = recordClaimOutcome(officer, SALA, "PRODUCERS-NON_USE", { outcome: "NOT_ACCEPTED", reason: "EVIDENCE_PART_PERIOD", scopeFrom: null, scopeTo: null, withLegal: false });
    expect(outcome.accepted).toEqual({ state: "NOT_ACCEPTED", decision: null });
    const statement = { reason: "CLAIM_NOT_ACCEPTED", text: "Giấy tờ gửi kèm không cho thấy cơ sở ngừng phát bản ghi âm.", unmet: ["Xác nhận ngừng phát nhạc của nhà cung cấp"], actionOpen: "Gửi yêu cầu mới kèm xác nhận của nhà cung cấp." };
    const proposal = recordProposal(officer, SALA, { outcome: "DECIDED_OTHERWISE", ...statement, effectiveFrom: null }).accepted?.proposal ?? "";
    const decision = recordVerdict(approver, proposal, { verdict: "APPROVED", note: "" }).accepted?.decision ?? "";
    const record = decisionRecord(principal, decision).data;
    expect(record?.outcome).toBe("PAYABLE");
    const producers = record?.lines.filter((line) => line.layer === "PRODUCERS") ?? [];
    expect(producers.length).toBeGreaterThan(0);
    expect(producers.every((line) => line.amountMinor > 0 && line.treatment === null)).toBe(true);
    expect(record?.claim).toBeNull();
    expect(record?.payBy).toBe(addDays(`${record?.useBeganOn ?? ""}T12:00:00+07:00`, 89));
    expect(record?.otherwise).toMatchObject({ reason: { vi: statement.text }, notMet: { vi: statement.unmet[0] }, youCan: { vi: statement.actionOpen } });
    expect(decisionList(principal, null).data?.items.find((row) => row.reference === decision)?.note).toBe("OTHERWISE");
    const told = raised("application_decided").find((event) => event.occurrenceRef === `NTF-REG-03/${decision}`);
    expect(told?.facts).toMatchObject({ outcome: "DECIDED_OTHERWISE", appealRoute: "explanation-3" });
  });

  it("@AC-FR-REG-036-03 an outcome on the claim of a withdrawn application is refused, and no amendment is started", () => {
    const { principal, officer } = sentWithClaim();
    expect(withdrawApplication(principal, SALA).accepted?.status).toBe("WITHDRAWN");
    const before = applicationList(principal, null).data?.items.length;
    const answer = recordClaimOutcome(officer, SALA, "PRODUCERS-NON_USE", { outcome: "ACCEPTED", reason: "NON_USE_SHOWN", scopeFrom: null, scopeTo: null, withLegal: false });
    expect(answer.refusal?.code).toBe("ASSERTION_NOT_UNDER_REVIEW");
    expect(caseFile(officer, SALA).data?.claims.find((claim) => claim.id === "PRODUCERS-NON_USE")?.state).toBe("WITHDRAWN");
    expect(applicationList(principal, null).data?.items.length).toBe(before);
  });

  it("@AC-FR-REG-036-05 a partial acceptance with no accepted scope is refused, and the claim stays in review", () => {
    const { officer } = sentWithClaim();
    const answer = recordClaimOutcome(officer, SALA, "PRODUCERS-NON_USE", { outcome: "PARTLY_ACCEPTED", reason: "NON_USE_SHOWN", scopeFrom: null, scopeTo: null, withLegal: false });
    expect(answer.refusal?.code).toBe("ACCEPTED_SCOPE_INVALID");
    expect(caseFile(officer, SALA).data?.claims.find((claim) => claim.id === "PRODUCERS-NON_USE")?.state).toBe("UNDER_REVIEW");
  });
});

// ---------------------------------------------------------------- the officer's amendment (FR-REG-038, spine amendment A6-2)

describe("the officer's amendment", () => {
  it("@AC-FR-REG-038-04 an officer starts an amendment for a decided appeal, routed to review as an amendment from its start", () => {
    decidedCases.add("CAS-2026-0192");
    at("2026-10-16T03:00:00Z");
    const { officer } = world();
    const started = startOfficerAmendment(officer, PASTEUR, { cause: "APPEAL_OUTCOME", caseRef: "CAS-2026-0192", from: "2026-11-01" });
    const ref = started.accepted?.application ?? "";
    const file = caseFile(officer, ref).data;
    expect(file).toMatchObject({ status: "DRAFT", kind: "AMENDMENT", route: "MANUAL", reviewType: "AMENDMENT" });
    expect(file?.amendment).toMatchObject({ cause: "APPEAL_OUTCOME", caseRef: "CAS-2026-0192", decision: PASTEUR, initiatedBy: "OFFICER" });
    expect(file?.transitions[0]?.by.role).toBe("OFFICER");
  });

  it("@AC-FR-REG-038-05 an appeal amendment naming a case CAS does not hold decided is refused, and no application is written", () => {
    const { principal, officer } = world();
    const before = applicationList(principal, null).data?.items.length;
    expect(startOfficerAmendment(officer, PASTEUR, { cause: "APPEAL_OUTCOME", caseRef: "CAS-2026-9999", from: "2026-11-01" }).refusal?.code).toBe("APPEAL_CASE_NOT_FOUND");
    expect(applicationList(principal, null).data?.items.length).toBe(before);
  });

  it("an appeal outcome with no case reference is refused AMENDMENT_CAUSE_REQUIRED", () => {
    const { officer } = world();
    expect(startOfficerAmendment(officer, PASTEUR, { cause: "APPEAL_OUTCOME", caseRef: " ", from: "2026-11-01" }).refusal).toMatchObject({ code: "AMENDMENT_CAUSE_REQUIRED", field: "caseRef" });
  });

  it("an officer giving a cause that is the premises' is refused NOT_AUTHORISED", () => {
    const { officer } = world();
    expect(startOfficerAmendment(officer, PASTEUR, { cause: "FACT_CHANGE_REPORTED", caseRef: "", from: "2026-11-01" }).refusal?.code).toBe("NOT_AUTHORISED");
  });

  it("a premises actor giving an officer's cause is refused NOT_AUTHORISED", () => {
    const { principal } = world();
    const answer = startApplication(principal, { premisesId: "pasteur", kind: "AMENDMENT", prior: PASTEUR, cause: "APPEAL_OUTCOME", from: "2026-11-01", to: null });
    expect(answer.refusal?.code).toBe("NOT_AUTHORISED");
  });

  it("a member of staff without the operations role cannot start one", () => {
    const { principal } = world();
    const approver = staffOf(signInBeside(principal, PEOPLE.approver));
    expect(startOfficerAmendment(approver, PASTEUR, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-11-01" }).refusal?.code).toBe("NOT_AUTHORISED");
  });

  it("a replaced decision is refused PRIOR_DECISION_SUPERSEDED", () => {
    const { officer } = world();
    expect(startOfficerAmendment(officer, "OBD-6RHC4WNE9B", { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-11-01" }).refusal?.code).toBe("PRIOR_DECISION_SUPERSEDED");
  });

  it("a start on or after the decision's end is refused INTENDED_PERIOD_INVALID", () => {
    const { officer } = world();
    expect(startOfficerAmendment(officer, PASTEUR, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2027-09-17" }).refusal?.code).toBe("INTENDED_PERIOD_INVALID");
  });

  it("sent with its facts unchanged, it goes to the amendment review with its dates, and the premises is told (NTF-REG-01, NTF-REG-04)", () => {
    at("2026-10-16T03:00:00Z");
    const { officer } = world();
    const ref = startOfficerAmendment(officer, PASTEUR, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-11-01" }).accepted?.application ?? "";
    expect(sendOfficerAmendment(officer, ref).accepted?.status).toBe("UNDER_REVIEW");
    const file = caseFile(officer, ref).data;
    expect(file).toMatchObject({ status: "UNDER_REVIEW", reviewType: "AMENDMENT" });
    expect(file?.statements[0]).toMatchObject({ completeOn: "2026-10-16", expectedOn: "2026-11-06" });
    expect(reviewQueue(officer, { queue: "AMENDMENT", status: null, premises: null }, null).data?.rows.map((row) => row.reference)).toContain(ref);
    expect(raised("application_submitted").map((event) => event.subjectRef)).toContain(ref);
    expect(raised("decision_date_expected").map((event) => event.subjectRef)).toContain(ref);
  });

  it("an answer the premises changed must be confirmed by the premises before it is sent: ATTESTATION_REQUIRED", () => {
    const { principal, officer } = world();
    const ref = startOfficerAmendment(officer, PASTEUR, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-11-01" }).accepted?.application ?? "";
    expect(declareFacts(principal, ref, { values: { days_open: "5" }, reconfirmed: [] }).refusal).toBeNull();
    expect(caseFile(officer, ref).data?.amendment?.sendHeld).toBe("ATTESTATION_REQUIRED");
    expect(sendOfficerAmendment(officer, ref).refusal?.code).toBe("ATTESTATION_REQUIRED");
    expect(caseFile(officer, ref).data?.status).toBe("DRAFT");
  });

  it("an officer cannot send an amendment the premises started: NOT_AUTHORISED", () => {
    const { principal, officer } = world();
    const ref = startApplication(principal, { premisesId: "pasteur", kind: "AMENDMENT", prior: PASTEUR, cause: "FACT_CHANGE_REPORTED", from: "2026-11-01", to: null }).accepted?.application ?? "";
    expect(completeDraft(principal, ref)).toBeNull();
    expect(sendOfficerAmendment(officer, ref).refusal?.code).toBe("NOT_AUTHORISED");
  });

  it("is governed by the rulebook in force on the day it takes effect, not on the day it was started (FR-REG-013)", () => {
    at("2026-10-16T03:00:00Z");
    const { officer } = world();
    const early = startOfficerAmendment(officer, PASTEUR, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-10-20" }).accepted?.application ?? "";
    const late = startOfficerAmendment(officer, NGUYEN_HUE, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-11-15" }).accepted?.application ?? "";
    expect(caseFile(officer, early).data?.rulebook).toBe("2026.2");
    expect(caseFile(officer, late).data?.rulebook).toBe("2026.3");
  });

  it("decided as applied for, it supersedes the decision from the day it takes effect and records that day's rulebook (FR-REG-014)", () => {
    at("2026-10-16T03:00:00Z");
    const { principal, officer } = world();
    const ref = startOfficerAmendment(officer, PASTEUR, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-11-15" }).accepted?.application ?? "";
    expect(sendOfficerAmendment(officer, ref).accepted?.status).toBe("UNDER_REVIEW");
    const decision = recordProposal(officer, ref, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null }).accepted?.decision ?? "";
    expect(decisionRecord(principal, PASTEUR).data).toMatchObject({ status: "SUPERSEDED", replacedBy: { reference: decision, from: "2026-11-15" } });
    expect(decisionRecord(principal, decision).data).toMatchObject({ status: "CURRENT", prior: PASTEUR, rulebookVersion: "2026.3", period: { from: "2026-11-15", to: "2027-09-17" } });
    expect(raised("application_decided").find((event) => event.subjectRef === ref)?.facts).toMatchObject({ decision, declaredClassification: "no" });
  });

  it("sent by the premises once it changed an answer, it goes to the amendment review it was started for, not to a decision (DR-285 row 2)", () => {
    at("2026-10-16T03:00:00Z");
    const { principal, officer } = world();
    const ref = startOfficerAmendment(officer, PASTEUR, { cause: "CLASSIFICATION_RECONCILED", caseRef: "", from: "2026-11-01" }).accepted?.application ?? "";
    expect(completeDraft(principal, ref, { days_open: "5" })).toBeNull();
    expect(previewApplication(principal, ref).data?.outcome).toEqual({ kind: "UNDER_REVIEW", reason: "OFFICER_AMENDMENT" });
    const shown = attestationStep(principal, "", ref).data?.shown ?? null;
    const sent = attestAndSubmit(principal, ref, { presentation: shown?.presentation ?? "", factsDigest: shown?.factsDigest ?? "", confirmed: true, changeDutyAcknowledged: true });
    expect(sent.accepted?.status).toBe("UNDER_REVIEW");
    const file = caseFile(officer, ref).data;
    expect(file).toMatchObject({ status: "UNDER_REVIEW", route: "MANUAL", reviewType: "AMENDMENT", decision: null });
    expect(file?.attestations?.at(-1)).toMatchObject({ by: { role: "PRINCIPAL" }, superseded: false });
    expect(applicationRecord(principal, ref).data?.review).toBe("AMENDMENT");
    expect(reviewQueue(officer, { queue: "AMENDMENT", status: null, premises: null }, null).data?.rows.map((row) => row.reference)).toContain(ref);
  });
});

// ---------------------------------------------------------------- what VER reads (FR-REG-040)

describe("open reports of a changed fact, for inspection (FR-REG-040)", () => {
  it("@AC-FR-REG-040-01 a draft is not a report: the premises answers none", () => {
    const { principal } = world();
    expect(startApplication(principal, { premisesId: "pasteur", kind: "AMENDMENT", prior: PASTEUR, cause: "FACT_CHANGE_REPORTED", from: "2026-11-01", to: null }).refusal).toBeNull();
    expect(openFactChangeReportsAt(principal, [PASTEUR_NAME], new Date().toISOString()).get(PASTEUR_NAME)).toEqual([]);
  });

  it("a reported change sent and not yet decided is listed with the day it was submitted", () => {
    at("2026-10-16T03:00:00Z");
    const { principal } = world();
    const ref = startApplication(principal, { premisesId: "pasteur", kind: "AMENDMENT", prior: PASTEUR, cause: "FACT_CHANGE_REPORTED", from: "2026-11-01", to: null }).accepted?.application ?? "";
    // A claim sends it to review (DR-285 row 1), so it stays open.
    raiseAssertion(principal, ref, { kind: "NON_USE", layer: "PRODUCERS", from: "2026-11-01", to: "2027-01-31" });
    expect(sendDraft(principal, ref, { customer_area: "70" })).toBe("UNDER_REVIEW");
    expect(openFactChangeReportsAt(principal, [PASTEUR_NAME], "2026-10-16T10:00:00+07:00").get(PASTEUR_NAME)).toEqual([{ application: ref, submittedOn: "2026-10-16" }]);
    expect(raised("application_submitted").map((event) => event.subjectRef)).toContain(ref);
  });

  it("@AC-FR-REG-040-03 more premises than one batch holds is refused, and nothing is answered", () => {
    const { principal } = world();
    const names = Array.from({ length: 501 }, (_, index) => `PM-${String(index)}`);
    expect(() => openFactChangeReportsAt(principal, names, new Date().toISOString())).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------- reports, policy and the record of use-start dates

describe("reports, policy and use-starts", () => {
  it("@AC-FR-REG-039-03 a completion-time report asked for a measure that does not exist is refused", () => {
    const { officer } = world();
    expect(registrationReports(officer, "2026-10-01", "2026-10-31", "TO_PAYMENT").failure?.code).toBe("CURSOR_INVALID");
    expect(registrationReports(officer, "2026-10-01", "2026-10-31", "INTERIM_TO_DECISION").failure).toBeNull();
  });

  it("a withdrawal that closed an adverse proposal is named beside the count (RPT-REG-03)", () => {
    at("2026-10-16T03:00:00Z");
    const { officer } = world();
    expect(
      recordProposal(officer, LOUNGE, { outcome: "REFUSED", reason: "CHANGE_NOT_EVIDENCED", text: "Không đủ giấy tờ.", unmet: ["Sơ đồ mặt bằng"], actionOpen: "Nộp đơn mới.", effectiveFrom: null }).refusal,
    ).toBeNull();
    recordOfficerWithdrawal(officer, LOUNGE, { instruction: "TCV-THU-2026-118", reason: "Cơ sở tạm ngừng kinh doanh" });
    const outcomes = registrationReports(officer, "2026-10-01", "2026-10-31").data?.outcomes;
    expect(outcomes?.withdrawnWithAdverseRefs).toEqual([LOUNGE]);
  });

  it("an officer's withdrawal keeps the applicant's reason with the act", () => {
    const { officer } = world();
    recordOfficerWithdrawal(officer, LOUNGE, { instruction: "TCV-THU-2026-118", reason: "Cơ sở tạm ngừng kinh doanh" });
    expect(caseFile(officer, LOUNGE).data?.ended).toMatchObject({ kind: "WITHDRAWN", instruction: "TCV-THU-2026-118", reason: "Cơ sở tạm ngừng kinh doanh" });
  });

  it("the policy read names the configuration point whose default applies while no version is approved", () => {
    const { officer } = world();
    const rows = registrationPolicy(officer, "2026-10-16T10:00:00+07:00").data?.rows ?? [];
    expect(rows.find((row) => row.rule === "REG-PRE-REGISTRATION")).toMatchObject({ version: null, defaultInForce: "CFG-12", preRegistrationRow: 3 });
    expect(rows.find((row) => row.rule === "REG-OBLIGATION-RULEBOOK")?.defaultInForce).toBeNull();
  });

  it("a corrected use-start date names the row it corrects, which stays as it was (FR-REG-027)", () => {
    const { officer } = world();
    const rows = useStartRecord(officer, "ltt", null).data?.rows ?? [];
    expect(rows[0]).toMatchObject({ date: "2026-07-28", inForce: true, corrects: "2026-08-14" });
    expect(rows[1]).toMatchObject({ date: "2026-08-14", inForce: false, corrects: null });
  });

  it("@AC-FR-REG-039-01 while no confirmation record is reported, the interim time to the decision names the step where it went and is not measured", () => {
    at("2026-10-16T02:00:00Z");
    const { principal, officer } = world();
    const ref = startApplication(principal, { premisesId: "dakao", kind: "NEW", prior: null, cause: null, from: "2027-09-10", to: "2028-09-09" }).accepted?.application ?? "";
    at("2026-10-16T02:07:30Z");
    expect(completeDraft(principal, ref, { customer_area: "60", days_open: "7", music_method: "speakers", use_began_on: "2026-10-01", premises_class: "cafe" })).toBeNull();
    at("2026-10-16T02:11:00Z");
    expect(sendDraft(principal, ref)).toBe("DECIDED");
    const completion = registrationReports(officer, "2026-10-01", "2026-10-31", "INTERIM_TO_DECISION").data?.completion;
    expect(completion?.measured).toBe(0);
    expect(completion?.notYetMeasured).toBe(1);
    expect(completion?.interim).toMatchObject({ decided: 1, medianSeconds: 660, over: 1 });
    expect(completion?.interim?.rows).toEqual([expect.objectContaining({ reference: ref, seconds: 660, step: "FACTS" })]);
  });

  it("a decision rests on the facts as corrected in review, the values a renewal copies (FR-REG-012)", () => {
    const { principal, officer } = world();
    expect(recordCorrection(officer, LOUNGE, { code: "customer_area", value: "90", document: null }).refusal).toBeNull();
    const decision = recordProposal(officer, LOUNGE, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null }).accepted?.decision ?? "";
    expect(decisionFactsOf(principal, decision)?.customerArea).toBe(90);
  });

  it("@AC-FR-REG-002-03 the first save stamps the start of the clock and a later save does not move it", () => {
    at("2026-10-16T02:01:00Z");
    const { principal, officer } = world();
    declareFacts(principal, SALA, { values: { days_open: "6" }, reconfirmed: [] });
    at("2026-10-16T02:04:00Z");
    declareFacts(principal, SALA, { values: { days_open: "7" }, reconfirmed: [] });
    expect(caseFile(officer, SALA).data?.firstSavedAt).toBe("2026-10-16T02:01:00.000Z");
  });
});

// ---------------------------------------------------------------- withdrawal (FR-REG-004, FR-REG-032)

describe("withdrawal", () => {
  it("@AC-FR-REG-004-01 the applicant withdraws a draft: withdrawn as a draft, by them, and the premises holds no open new application", () => {
    at("2026-10-16T03:00:00Z");
    const { principal, officer } = world();
    const start: StartInput = { premisesId: "dakao", kind: "NEW", prior: null, cause: null, from: "2027-09-10", to: "2028-09-09" };
    const ref = startApplication(principal, start).accepted?.application ?? "";
    expect(withdrawApplication(principal, ref).accepted?.status).toBe("WITHDRAWN");
    const file = caseFile(officer, ref).data;
    expect(file?.ended).toMatchObject({ kind: "WITHDRAWN", cause: "DRAFT_WITHDRAWN", instruction: null });
    expect(file?.transitions[0]).toMatchObject({ from: "DRAFT", to: "WITHDRAWN", cause: "WITHDRAWAL", by: { name: findAccount(PEOPLE.principal)?.name, role: "PRINCIPAL" } });
    expect(startApplication(principal, start).refusal).toBeNull();
  });

  it("@AC-FR-REG-004-02 withdrawn while documents are asked for, the request is withdrawn and what was sent stays recorded", () => {
    at("2026-10-20T03:00:00Z");
    const { principal, officer } = world();
    requestEvidence(officer, LOUNGE, ITEMS);
    const before = caseFile(officer, LOUNGE).data;
    expect(withdrawApplication(principal, LOUNGE).accepted?.status).toBe("WITHDRAWN");
    const after = caseFile(officer, LOUNGE).data;
    expect(after?.ended).toMatchObject({ kind: "WITHDRAWN", cause: "APPLICANT_WITHDREW" });
    expect(after?.requests?.at(-1)?.state).toBe("WITHDRAWN");
    expect(after?.facts).toEqual(before?.facts);
    expect(after?.evidence).toEqual(before?.evidence);
    expect(after?.attestations).toEqual(before?.attestations);
  });

  it("@AC-FR-REG-004-03 an officer records a withdrawal on the applicant's instruction, which names the officer and the instruction", () => {
    const { officer } = world();
    expect(recordOfficerWithdrawal(officer, LOUNGE, { instruction: "TCV-THU-2026-118", reason: "" }).accepted?.status).toBe("WITHDRAWN");
    const file = caseFile(officer, LOUNGE).data;
    expect(file?.ended).toMatchObject({ kind: "WITHDRAWN", cause: "WITHDRAWN_ON_INSTRUCTION", instruction: "TCV-THU-2026-118" });
    expect(file?.transitions[0]).toMatchObject({ to: "WITHDRAWN", cause: "WITHDRAWAL", by: { name: officer.account, role: "OFFICER" } });
  });

  it("@AC-FR-REG-004-05 a decided application cannot be withdrawn, and its decision stays current", () => {
    const { principal } = world();
    expect(withdrawApplication(principal, PASTEUR_APPLICATION).refusal?.code).toBe("APPLICATION_ALREADY_FINAL");
    expect(applicationRecord(principal, PASTEUR_APPLICATION).data?.status).toBe("DECIDED");
    expect(decisionRecord(principal, PASTEUR).data?.status).toBe("CURRENT");
  });

  it("a delegate is refused an application of the party's premises outside her delegation, and the application is unchanged", () => {
    const { principal, officer } = world();
    const delegate = signInBeside(principal, PEOPLE.delegate);
    expect(withdrawApplication(delegate, LOUNGE).refusal?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(applicationRecord(delegate, LOUNGE).failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(caseFile(officer, LOUNGE).data?.status).toBe("UNDER_REVIEW");
  });

  it("another party's application is not found, and never disclosed", () => {
    const { principal } = world();
    expect(withdrawApplication(principal, "REG-M6FA3YWN5T").refusal?.code).toBe("APPLICATION_NOT_FOUND");
    expect(applicationRecord(principal, "REG-M6FA3YWN5T").failure?.code).toBe("APPLICATION_NOT_FOUND");
  });

  it("@AC-FR-REG-032-01 an approved refusal is recorded as refused, writes no decision, and is counted as a refusal and never as a withdrawal", () => {
    at("2026-10-16T03:00:00Z");
    const { principal, officer } = world();
    const approver = staffOf(signInBeside(principal, PEOPLE.approver));
    const decisions = decisionList(principal, null).data?.items.length;
    const proposal = recordProposal(officer, LOUNGE, { outcome: "REFUSED", reason: "CHANGE_NOT_EVIDENCED", text: "Không đủ giấy tờ.", unmet: ["Sơ đồ mặt bằng"], actionOpen: "Nộp đơn mới.", effectiveFrom: null });
    expect(recordVerdict(approver, proposal.accepted?.proposal ?? "", { verdict: "APPROVED", note: "" }).accepted).toEqual({ status: "APPROVED", decision: null });
    const file = caseFile(officer, LOUNGE).data;
    expect(file).toMatchObject({ status: "REFUSED", decision: null, ended: { kind: "REFUSED", cause: null } });
    expect(file?.transitions[0]).toMatchObject({ to: "REFUSED", cause: "REFUSAL" });
    expect(decisionList(principal, null).data?.items.length).toBe(decisions);
    expect(registrationReports(officer, "2026-10-01", "2026-10-31").data?.outcomes).toMatchObject({ refused: 1, withdrawn: 0 });
  });

  it("@AC-FR-REG-032-02 a refused application cannot be withdrawn, by the applicant or on its instruction", () => {
    const { principal, officer } = world();
    const approver = staffOf(signInBeside(principal, PEOPLE.approver));
    const proposal = recordProposal(officer, LOUNGE, { outcome: "REFUSED", reason: "CHANGE_NOT_EVIDENCED", text: "Không đủ giấy tờ.", unmet: ["Sơ đồ mặt bằng"], actionOpen: "Nộp đơn mới.", effectiveFrom: null });
    recordVerdict(approver, proposal.accepted?.proposal ?? "", { verdict: "APPROVED", note: "" });
    expect(withdrawApplication(principal, LOUNGE).refusal?.code).toBe("APPLICATION_ALREADY_FINAL");
    expect(recordOfficerWithdrawal(officer, LOUNGE, { instruction: "TCV-THU-2026-118", reason: "" }).refusal?.code).toBe("APPLICATION_ALREADY_FINAL");
    expect(caseFile(officer, LOUNGE).data?.status).toBe("REFUSED");
  });

  it("@AC-FR-REG-032-03 an officer cannot withdraw an application in review without the applicant's instruction, and the refusal proposal stays pending", () => {
    const { officer } = world();
    recordProposal(officer, LOUNGE, { outcome: "REFUSED", reason: "CHANGE_NOT_EVIDENCED", text: "Không đủ giấy tờ.", unmet: ["Sơ đồ mặt bằng"], actionOpen: "Nộp đơn mới.", effectiveFrom: null });
    const before = caseFile(officer, LOUNGE).data?.transitions.length;
    expect(recordOfficerWithdrawal(officer, LOUNGE, { instruction: " ", reason: "" }).refusal).toMatchObject({ code: "WITHDRAWAL_INSTRUCTION_REQUIRED", field: "instruction" });
    const file = caseFile(officer, LOUNGE).data;
    expect(file?.status).toBe("UNDER_REVIEW");
    expect(file?.transitions.length).toBe(before);
    expect(file?.proposals.at(-1)?.status).toBe("PENDING_APPROVAL");
  });
});

// ---------------------------------------------------------------- the ten-minute measure while CER's event is not settled (FR-REG-015)

/** A first registration of Đa Kao the rules decide at once on 16 October: started, answered and sent five minutes later. */
function ordinaryDecided(): { principal: string; officer: Staff; ref: string } {
  at("2026-10-16T02:00:00Z");
  const { principal, officer } = world();
  const ref = startApplication(principal, { premisesId: "dakao", kind: "NEW", prior: null, cause: null, from: "2027-09-10", to: "2028-09-09" }).accepted?.application ?? "";
  at("2026-10-16T02:03:00Z");
  expect(completeDraft(principal, ref, { customer_area: "60", days_open: "7", music_method: "speakers", use_began_on: "2026-10-01", premises_class: "cafe" })).toBeNull();
  at("2026-10-16T02:05:00Z");
  expect(sendDraft(principal, ref)).toBe("DECIDED");
  return { principal, officer, ref };
}

describe("the completion time while no confirmation record is reported", () => {
  it("@AC-FR-REG-015-04 an ordinary registration counts as not yet measured, never as zero, and the median and 90th percentile leave it out", () => {
    const { officer } = ordinaryDecided();
    const completion = registrationReports(officer, "2026-10-01", "2026-10-31").data?.completion;
    expect(completion).toMatchObject({ measured: 0, medianSeconds: null, p90Seconds: null, over: null, notYetMeasured: 1, rows: [] });
  });

  it("@AC-FR-REG-015-03 an application decided in review is not ordinary, and is counted neither as measured nor as not yet measured", () => {
    at("2026-10-16T03:00:00Z");
    const { officer } = world();
    expect(recordProposal(officer, LOUNGE, { outcome: "DECIDED_AS_APPLIED", reason: "", text: "", unmet: [], actionOpen: "", effectiveFrom: null }).accepted?.decision).toMatch(/^OBD-/);
    const completion = registrationReports(officer, "2026-10-01", "2026-10-31", "INTERIM_TO_DECISION").data?.completion;
    expect(completion).toMatchObject({ measured: 0, notYetMeasured: 0, interim: null });
  });

  it("the decision's notice says it rests on a class the premises declared (NTF-REG-03)", () => {
    const { ref } = ordinaryDecided();
    expect(raised("application_decided").find((event) => event.subjectRef === ref)?.facts.declaredClassification).toBe("yes");
  });
});

// ---------------------------------------------------------------- the deadline state, read and never acted on (FR-REG-023)

describe("the deadline state at an instant", () => {
  it("@AC-FR-REG-023-04 passing the deadline changes no status and raises nothing", () => {
    at("2026-12-14T16:00:00Z");
    const { principal, officer } = world();
    expect(decisionRecord(principal, PASTEUR).data?.deadline).toEqual({ on: "2026-12-14", state: "WITHIN_DEADLINE" });
    const transitions = caseFile(officer, PASTEUR_APPLICATION).data?.transitions.length;
    vi.mocked(recordNoticeEvent).mockClear();
    at("2026-12-14T17:30:00Z");
    expect(deadlineStateAt(principal, PASTEUR_NAME, new Date().toISOString())).toEqual({ state: "PAST_DEADLINE", on: "2026-12-14" });
    expect(decisionRecord(principal, PASTEUR).data).toMatchObject({ status: "CURRENT", deadline: { on: "2026-12-14", state: "PAST_DEADLINE" } });
    expect(decisionList(principal, null).data?.items.find((row) => row.reference === PASTEUR)?.status).toBe("CURRENT");
    expect(caseFile(officer, PASTEUR_APPLICATION).data?.transitions.length).toBe(transitions);
    expect(vi.mocked(recordNoticeEvent).mock.calls.filter(([, event]) => event.sourceModule === "REG")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- the inspector's list reads registration (FR-REG-023, FR-REG-040)

/** The inspector, signed in on the principal's browser, asks KTVH-KV1's list of premises not current with their decision. */
function notCurrentList(principal: string) {
  const inspector = signInBeside(principal, PEOPLE.inspector);
  const supply = requestInspectionList(inspector, { appointment: "kv1", kind: "NOT_CURRENT_WITH_DECISION", areas: [] });
  const entries = listSupplyOf(inspector, supply.data?.supply ?? "").data?.entries;
  if (entries === undefined) throw new Error(`no list: ${JSON.stringify(supply.failure)}`);
  return entries;
}

describe("the inspector's list, from registration's record", () => {
  it("a change Nguyễn Huệ reported and REG has not decided is listed with its reference, the day it was sent and REG's deadline state", () => {
    at("2026-10-16T03:00:00Z");
    const { principal } = world();
    const ref = startApplication(principal, { premisesId: "nh", kind: "AMENDMENT", prior: NGUYEN_HUE, cause: "FACT_CHANGE_REPORTED", from: "2026-10-16", to: null }).accepted?.application ?? "";
    const period = applicationDraft(principal, ref).data?.period;
    if (period === undefined) throw new Error(`no draft ${ref}`);
    // A claim sends it to review (DR-285 row 1), so it stays open.
    expect(raiseAssertion(principal, ref, { kind: "NON_USE", layer: "PRODUCERS", from: period.from, to: period.to }).refusal).toBeNull();
    expect(sendDraft(principal, ref, { premises_class: "cafe", customer_area: "64", days_open: "7", music_method: "speakers", use_began_on: "2026-09-01" })).toBe("UNDER_REVIEW");
    const change = notCurrentList(principal).find((entry) => entry.premises === NGUYEN_HUE_NAME && entry.class === "REPORTED_CHANGE_UNDECIDED");
    expect(change).toMatchObject({ detail: { kind: "CHANGE", reference: ref }, since: "2026-10-16", deadline: { kind: "WITHIN", date: "2026-11-29" } });
  });

  it("another party's change in review is listed as REG holds it, not as the canvas copied it", () => {
    at("2026-10-16T03:00:00Z");
    const { principal } = world();
    const changes = notCurrentList(principal).filter((entry) => entry.class === "REPORTED_CHANGE_UNDECIDED");
    expect(changes).toEqual([expect.objectContaining({ premises: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng", detail: { kind: "CHANGE", reference: "REG-M6FA3YWN5T" }, since: "2026-09-10" })]);
  });

  it("@AC-FR-REG-023-02 the inspection function reads an obligation past its deadline from registration", () => {
    at("2026-12-02T03:00:00Z");
    const { principal } = world();
    const entry = notCurrentList(principal).find((candidate) => candidate.premises === NGUYEN_HUE_NAME);
    expect(entry?.deadline).toEqual({ kind: "PAST", date: "2026-11-29" });
  });
});
