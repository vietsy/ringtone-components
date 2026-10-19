import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaseReader } from "@/lib/api/cases";
import type { Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import {
  addEvidence,
  addParty,
  addRegisterEntry,
  answerEvidenceRequest,
  appealPage,
  approvalsQueue,
  approveIntakeVersion,
  approvePolicyItem,
  askReopening,
  authoriseReopening,
  cancelEvidenceRequest,
  caseQueue,
  caseRead,
  casesRaisedBy,
  casesTable,
  classifyCase,
  classifyProtected,
  closeCase,
  consoleCase,
  evidencePage,
  intakeForm,
  linkCase,
  lodgeAppeal,
  openCase,
  policyRegister,
  prepareCategoryPolicy,
  preparePeriod,
  progressCase,
  proposeReopening,
  raiseCase,
  recordCallerCase,
  recordDecision,
  recordEvidenceResponse,
  referCase,
  reopeningPage,
  requestEvidence,
  saveIntakeVersion,
  supplyEvidence,
  withdrawCase,
  type ClassifyInput,
  type CloseInput,
} from "@/lib/mock/backend/cases";
import { addDays, today } from "@/lib/mock/backend/clock";
import { sessions } from "@/lib/mock/backend/store";
import { SEED_CASES } from "@/lib/mock/cases";
import { PEOPLE, signIn, signInBeside } from "./harness";

afterEach(() => {
  vi.useRealTimers();
});

/** The member of staff a session names, as `requireStaff` hands them to the backend. */
function staffOf(sessionId: string): Staff {
  const account = findAccount(sessions().get(sessionId)?.email ?? "");
  if (account === null) throw new Error(`no staff session ${sessionId}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

/**
 * One browser's world: the premises principal who raises the cases (Công ty TNHH Then Cửa Việt), two case officers
 * - Phan Gia Lượng, who also holds the support line, and Quan Ngọc Trâm - the business approver and dispute authority
 * Thạch Minh Khải, and Lê Văn Cường, the security owner and data protection officer.
 */
interface World {
  key: string;
  raiser: CaseReader;
  officer: Staff;
  second: Staff;
  authority: Staff;
  security: Staff;
}

function world(): World {
  const key = signIn(PEOPLE.principal);
  return {
    key,
    raiser: { party: sessions().get(key)?.organisation ?? null, account: findAccount(PEOPLE.principal)?.name ?? null },
    officer: staffOf(signInBeside(key, PEOPLE.operations)),
    second: staffOf(signInBeside(key, PEOPLE.preparer)),
    authority: staffOf(signInBeside(key, PEOPLE.approver)),
    security: staffOf(signInBeside(key, PEOPLE.supervisor)),
  };
}

const NO_PERIOD = { from: null, to: null, unreadable: false };
const lastAudit = (key: string) => casesTable(key).auditLog.at(-1);
const noticeKinds = (w: World, reference: string) => consoleCase(w.key, w.second, reference).data?.notices.map((notice) => notice.kind) ?? [];

/** POST /cases from the principal's account route, RECEIVED and acknowledged. */
function raise(w: World): string {
  const form = intakeForm(w.key, w.raiser, null, null, null).data;
  const answer = raiseCase(w.key, w.raiser, {
    group: form?.group ?? "",
    routeId: form?.formRoute?.id ?? "",
    matter: "Hoá đơn tháng 9 tính trùng một kỳ phí.",
    subject: "INV-2026-0042",
    period: NO_PERIOD,
    remedy: "",
    contact: "trang.do@thencuaviet.vn",
  });
  if (answer.accepted === null) throw new Error(`not raised: ${answer.refusal.code}`);
  return answer.accepted.reference;
}

const classification = (owner: string, overrides: Partial<ClassifyInput> = {}): ClassifyInput => ({
  caseType: "billing",
  subjectKind: "invoice",
  subjectRef: "INV-2026-0042",
  period: NO_PERIOD,
  remedy: "explanation",
  owner,
  severity: "medium",
  impact: "minor",
  vulnerability: "no",
  ...overrides,
});

/** A case classified by its owner, Phan Gia Lượng: TRIAGED. */
function triaged(w: World): string {
  const reference = raise(w);
  const answer = classifyCase(w.key, w.officer, reference, classification(w.officer.email));
  if (answer.accepted === null) throw new Error(`not classified: ${answer.refusal.code}`);
  return reference;
}

function investigating(w: World): string {
  const reference = triaged(w);
  progressCase(w.key, w.officer, reference, "investigating");
  return reference;
}

/** A case waiting on one request addressed to the raiser's party, due today. */
function awaiting(w: World, disclosure = "open"): { reference: string; request: string } {
  const reference = investigating(w);
  const answer = requestEvidence(w.key, w.officer, reference, { item: "Sao kê ngân hàng tháng 9", addressee: "party:tcv", deadline: today(), deadlineUnreadable: false, disclosure });
  if (answer.accepted === null) throw new Error(`not requested: ${answer.refusal.code}`);
  return { reference, request: answer.accepted.request };
}

/** A case decided by Quan Ngọc Trâm, who does not own it, with an explanation, which links nothing: CLOSED at once. */
function decidedAndClosed(w: World): string {
  const reference = investigating(w);
  progressCase(w.key, w.officer, reference, "decision_pending");
  const values = {
    facts: "Kỳ phí tháng 9 được tính một lần.",
    authority: "Biểu phí đã duyệt",
    reasoning: "Hoá đơn khớp với biểu phí.",
    remedy: "explanation",
    effective: today(),
    appealRoute: "Gửi khiếu nại trên RightOne.",
    ground: "approved_tariff",
  };
  const answer = recordDecision(w.key, w.second, reference, values, today());
  if (answer.accepted === null) throw new Error(`not decided: ${answer.refusal.code}`);
  return reference;
}

const inadmissible = (overrides: Partial<CloseInput> = {}): CloseInput => ({
  disposition: "inadmissible",
  reason: "Nội dung thuộc thẩm quyền của toà án.",
  route: "Toà án nhân dân nơi cơ sở đặt trụ sở",
  unestablished: "",
  approver: "",
  ...overrides,
});

function closedInadmissible(w: World): string {
  const reference = triaged(w);
  const answer = closeCase(w.key, w.officer, reference, inadmissible());
  if (answer.accepted === null) throw new Error(`not closed: ${answer.refusal.code}`);
  return reference;
}

const newEvidence = (overrides: Partial<Parameters<typeof askReopening>[3]> = {}) => ({
  groundKind: "new_evidence",
  groundRef: "Biên bản đối soát ngày hôm nay của ngân hàng",
  evidenceOn: today(),
  evidenceUnreadable: false,
  displaced: [] as string[],
  nothing: true,
  ...overrides,
});

/** Moves the clock the mock backend reads, leaving timers alone. */
function travel(days: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + days * 86_400_000);
}

describe("POST /cases/{id}/classify leaves the case TRIAGED (SM-05 transition 1)", () => {
  it("records the classification and its owner and rests the case in TRIAGED, not ASSIGNED", () => {
    const w = world();
    const reference = triaged(w);
    const read = consoleCase(w.key, w.officer, reference).data;
    expect(read?.state).toBe("TRIAGED");
    expect(read?.owner?.email).toBe(w.officer.email);
    expect(read?.history.map((entry) => entry.to)).toEqual(["RECEIVED", "TRIAGED"]);
  });

  it("@AC-FR-CAS-003-03 refuses a triage with no owner with FIELD_MISSING naming the owner, and the case stays RECEIVED", () => {
    const w = world();
    const reference = raise(w);
    const answer = classifyCase(w.key, w.officer, reference, classification(""));
    expect(answer.refusal?.code).toBe("FIELD_MISSING");
    expect(answer.refusal?.fields.owner).toBe("FIELD_MISSING");
    expect(consoleCase(w.key, w.officer, reference).data?.state).toBe("RECEIVED");
  });

  it("takes transitions 2 and 5 when investigation starts from TRIAGED, writing both history rows", () => {
    const w = world();
    const reference = triaged(w);
    expect(progressCase(w.key, w.officer, reference, "investigating").accepted?.state).toBe("INVESTIGATING");
    expect(consoleCase(w.key, w.officer, reference).data?.history.map((entry) => entry.to)).toEqual(["RECEIVED", "TRIAGED", "ASSIGNED", "INVESTIGATING"]);
  });

  it("assigns the case first when evidence is requested from TRIAGED (transitions 2 and 6)", () => {
    const w = world();
    const reference = triaged(w);
    requestEvidence(w.key, w.officer, reference, { item: "Sao kê", addressee: "party:tcv", deadline: today(), deadlineUnreadable: false, disclosure: "open" });
    expect(consoleCase(w.key, w.officer, reference).data?.history.map((entry) => entry.to)).toEqual(["RECEIVED", "TRIAGED", "ASSIGNED", "AWAITING_EVIDENCE"]);
  });

  it("@AC-FR-CAS-003-05 refuses an inverted classification period with PERIOD_INVALID, writes no period, and records the attempt", () => {
    const w = world();
    const reference = raise(w);
    const answer = classifyCase(w.key, w.officer, reference, classification(w.officer.email, { period: { from: today(), to: addDays(today(), -30), unreadable: false } }));
    expect(answer.refusal?.code).toBe("PERIOD_INVALID");
    const read = consoleCase(w.key, w.officer, reference).data;
    expect(read?.caseType).toBeNull();
    expect(read?.period).toEqual({ from: null, to: null });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "classify", code: "PERIOD_INVALID" });
  });

  it("@AC-FR-CAS-003-11 refuses a step the case cannot reach, naming its state and where it can go, and records the attempt", () => {
    const w = world();
    const reference = raise(w);
    const answer = progressCase(w.key, w.officer, reference, "decision_pending");
    expect(answer.refusal?.code).toBe("TRANSITION_NOT_PERMITTED");
    expect(answer.refusal?.detail).toEqual({ state: "RECEIVED", permitted: "TRIAGED, WITHDRAWN" });
    expect(consoleCase(w.key, w.officer, reference).data?.history).toHaveLength(1);
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, code: "TRANSITION_NOT_PERMITTED" });
  });
});

describe("POST /cases/{id}/refer (SM-05 transition 3)", () => {
  it("refers a TRIAGED case to the process named, and tells the raiser which process has it", () => {
    const w = world();
    const reference = triaged(w);
    const answer = referCase(w.key, w.officer, reference, { process: "Thanh tra Sở Văn hoá và Thể thao", reason: "Nội dung là khiếu nại hành chính." });
    expect(answer.accepted?.state).toBe("REFERRED");
    expect(consoleCase(w.key, w.officer, reference).data?.referral).toMatchObject({ process: "Thanh tra Sở Văn hoá và Thể thao" });
    expect(caseRead(w.key, reference, w.raiser).data?.referral?.process).toBe("Thanh tra Sở Văn hoá và Thể thao");
    expect(noticeKinds(w, reference)).toContain("case_status_changed");
  });

  it("refuses a referral naming no process with FIELD_MISSING beside it, and records the attempt", () => {
    const w = world();
    const reference = triaged(w);
    const answer = referCase(w.key, w.officer, reference, { process: " ", reason: "Không thuộc phạm vi." });
    expect(answer.refusal?.code).toBe("FIELD_MISSING");
    expect(answer.refusal?.fields).toEqual({ process: "FIELD_MISSING" });
    expect(consoleCase(w.key, w.officer, reference).data?.state).toBe("TRIAGED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "refer", code: "FIELD_MISSING" });
  });

  it("refuses to refer a decided case with CASE_ALREADY_DECIDED", () => {
    const w = world();
    const decided = SEED_CASES[0]?.reference ?? "";
    expect(referCase(w.key, w.officer, decided, { process: "Toà án", reason: "Không thuộc phạm vi." }).refusal?.code).toBe("CASE_ALREADY_DECIDED");
  });

  it("refuses to refer a case that is not TRIAGED with TRANSITION_NOT_PERMITTED", () => {
    const w = world();
    const reference = raise(w);
    expect(referCase(w.key, w.officer, reference, { process: "Toà án", reason: "Không thuộc phạm vi." }).refusal?.code).toBe("TRANSITION_NOT_PERMITTED");
  });
});

describe("POST /cases/{id}/close (SM-05 transitions 4 and 9)", () => {
  it("@AC-FR-CAS-003-10 refuses a disposition the state does not permit, names the state and what it permits, and records the attempt", () => {
    const w = world();
    const reference = investigating(w);
    const answer = closeCase(w.key, w.officer, reference, inadmissible({ disposition: "withdrawn" }));
    expect(answer.refusal?.code).toBe("DISPOSITION_NOT_PERMITTED_FROM_STATE");
    expect(answer.refusal?.detail).toEqual({ state: "INVESTIGATING", permitted: "" });
    const read = consoleCase(w.key, w.officer, reference).data;
    expect(read?.state).toBe("INVESTIGATING");
    expect(read?.closure).toBeNull();
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "close", code: "DISPOSITION_NOT_PERMITTED_FROM_STATE" });
  });

  it("names inadmissible as the closure a TRIAGED case permits when it is asked to close as incomplete", () => {
    const w = world();
    const reference = triaged(w);
    const answer = closeCase(w.key, w.officer, reference, inadmissible({ disposition: "incomplete" }));
    expect(answer.refusal?.detail).toEqual({ state: "TRIAGED", permitted: "inadmissible" });
  });

  it("closes a TRIAGED case as inadmissible with its reason and route, and tells the raiser until when it can reopen", () => {
    const w = world();
    const reference = closedInadmissible(w);
    const read = consoleCase(w.key, w.officer, reference).data;
    expect(read?.state).toBe("CLOSED_INADMISSIBLE");
    expect(read?.closure).toMatchObject({ disposition: "inadmissible", route: "Toà án nhân dân nơi cơ sở đặt trụ sở", approver: null });
    expect(caseRead(w.key, reference, w.raiser).data?.closure?.windowEnds).not.toBeNull();
    expect(noticeKinds(w, reference)).toContain("case_status_changed");
  });

  it("refuses an inadmissible closure naming no route with FIELD_MISSING beside the route", () => {
    const w = world();
    const reference = triaged(w);
    const answer = closeCase(w.key, w.officer, reference, inadmissible({ route: "" }));
    expect(answer.refusal?.fields).toEqual({ route: "FIELD_MISSING" });
    expect(consoleCase(w.key, w.officer, reference).data?.state).toBe("TRIAGED");
  });

  it("closes a case awaiting evidence as incomplete on a second officer's approval, the open request ending NOT_SUPPLIED", () => {
    const w = world();
    const { reference } = awaiting(w);
    const answer = closeCase(w.key, w.officer, reference, { disposition: "incomplete", reason: "Không nhận được sao kê.", route: "", unestablished: "", approver: w.second.email });
    expect(answer.accepted?.state).toBe("CLOSED_INCOMPLETE");
    const read = consoleCase(w.key, w.officer, reference).data;
    expect(read?.closure).toMatchObject({ disposition: "incomplete", unestablished: "Sao kê ngân hàng tháng 9", approver: { email: w.second.email } });
    expect(evidencePage(w.key, w.officer, reference).data?.rows[0]?.state).toBe("NOT_SUPPLIED");
  });

  it("refuses an incomplete closure approved by the case owner with SEG_SAME_ACTOR", () => {
    const w = world();
    const { reference } = awaiting(w);
    const answer = closeCase(w.key, w.second, reference, { disposition: "incomplete", reason: "Không nhận được sao kê.", route: "", unestablished: "", approver: w.officer.email });
    expect(answer.refusal?.code).toBe("SEG_SAME_ACTOR");
    expect(consoleCase(w.key, w.officer, reference).data?.state).toBe("AWAITING_EVIDENCE");
  });

  it("refuses an incomplete closure with no approver with FIELD_MISSING beside the approver", () => {
    const w = world();
    const { reference } = awaiting(w);
    const answer = closeCase(w.key, w.officer, reference, { disposition: "incomplete", reason: "Không nhận được sao kê.", route: "", unestablished: "", approver: "" });
    expect(answer.refusal?.fields).toEqual({ approver: "FIELD_MISSING" });
  });
});

describe("evidence on SCR-CAS-06: what arrived another way, the items held, the deadline", () => {
  it("@AC-FR-CAS-006-01 issues a request with its item, party, deadline and disclosure, the receipt outcome empty until something arrives", () => {
    const w = world();
    const { reference } = awaiting(w, "confidential_to_case_team");
    const row = evidencePage(w.key, w.officer, reference).data?.rows[0];
    expect(row).toMatchObject({ item: "Sao kê ngân hàng tháng 9", deadline: today(), disclosure: "confidential_to_case_team", state: "ISSUED", receiptOutcome: null });
    expect(row?.party).not.toBe("");
  });

  it("records a response that arrived another way, the officer named as who recorded it, and the case returns to investigation", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    const answer = recordEvidenceResponse(w.key, w.officer, reference, request, { outcome: "supplied", supplied: "Sao kê nộp tại quầy" });
    expect(answer.accepted?.outcome).toBe("supplied");
    const page = evidencePage(w.key, w.officer, reference).data;
    expect(page?.rows[0]).toMatchObject({ state: "RESPONDED", receiptOutcome: "supplied", recordedBy: w.officer.account });
    expect(page?.held).toEqual([expect.objectContaining({ item: "Sao kê nộp tại quầy", via: "request", disclosure: "open" })]);
    expect(page?.state).toBe("INVESTIGATING");
  });

  it("@AC-FR-CAS-006-07 refuses a response recorded with no outcome with RECEIPT_OUTCOME_REQUIRED, writing no receipt, and records the attempt", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    const answer = recordEvidenceResponse(w.key, w.officer, reference, request, { outcome: "", supplied: "" });
    expect(answer.refusal?.code).toBe("RECEIPT_OUTCOME_REQUIRED");
    expect(evidencePage(w.key, w.officer, reference).data?.rows[0]).toMatchObject({ state: "ISSUED", receiptOutcome: null, recordedBy: null });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "record response", code: "RECEIPT_OUTCOME_REQUIRED" });
  });

  it("@AC-FR-CAS-006-08 refuses a response recorded against a withdrawn request with REQUEST_CANCELLED, and records the attempt", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    cancelEvidenceRequest(w.key, w.officer, reference, request, "Đã có bản sao từ ngân hàng.");
    const answer = recordEvidenceResponse(w.key, w.officer, reference, request, { outcome: "supplied", supplied: "Sao kê" });
    expect(answer.refusal?.code).toBe("REQUEST_CANCELLED");
    expect(evidencePage(w.key, w.officer, reference).data?.rows[0]?.state).toBe("CANCELLED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, code: "REQUEST_CANCELLED" });
  });

  it("@AC-FR-CAS-006-09 refuses to cancel a request something was supplied against with RECEIPT_ALREADY_RECORDED, and records the attempt", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    recordEvidenceResponse(w.key, w.officer, reference, request, { outcome: "supplied", supplied: "Sao kê" });
    const answer = cancelEvidenceRequest(w.key, w.officer, reference, request, "Không cần nữa.");
    expect(answer.refusal?.code).toBe("RECEIPT_ALREADY_RECORDED");
    expect(evidencePage(w.key, w.officer, reference).data?.rows[0]?.state).toBe("RESPONDED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, code: "RECEIPT_ALREADY_RECORDED" });
  });

  it("refuses a cancellation by an officer who neither sent the request nor owns the case with ROLE_NOT_ASSIGNED", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    expect(cancelEvidenceRequest(w.key, w.second, reference, request, "Không cần nữa.").refusal?.code).toBe("ROLE_NOT_ASSIGNED");
    expect(evidencePage(w.key, w.second, reference).data?.rows[0]?.mayCancel).toBe(false);
  });

  it("@AC-FR-CAS-006-03 records a passed deadline as not supplied by the deadline and tells the case officer once", () => {
    const w = world();
    const { reference } = awaiting(w);
    travel(3);
    evidencePage(w.key, w.officer, reference);
    const row = evidencePage(w.key, w.officer, reference).data?.rows[0];
    expect(row).toMatchObject({ state: "OVERDUE", receiptOutcome: "not_supplied_by_deadline" });
    expect(noticeKinds(w, reference).filter((kind) => kind === "evidence_deadline_passed")).toHaveLength(1);
  });

  it("records an answer that arrives after the deadline as a late answer, not a refused one", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    travel(3);
    const answer = answerEvidenceRequest(w.key, w.raiser, reference, request, { outcome: "supplied", supplied: "Sao kê gửi muộn" });
    expect(answer.accepted?.outcome).toBe("supplied");
    expect(evidencePage(w.key, w.officer, reference).data?.rows[0]).toMatchObject({ state: "RESPONDED", late: true });
  });

  it("@AC-FR-CAS-006-05 refuses a request without a disclosure status with DISCLOSURE_STATUS_REQUIRED, writing none, and records the attempt", () => {
    const w = world();
    const reference = investigating(w);
    const answer = requestEvidence(w.key, w.officer, reference, { item: "Sao kê", addressee: "party:tcv", deadline: today(), deadlineUnreadable: false, disclosure: "" });
    expect(answer.refusal?.code).toBe("DISCLOSURE_STATUS_REQUIRED");
    expect(evidencePage(w.key, w.officer, reference).data?.rows).toEqual([]);
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, code: "DISCLOSURE_STATUS_REQUIRED" });
  });

  it("@AC-FR-CAS-006-06 refuses a deadline outside the approved response period with DEADLINE_BEYOND_POLICY, naming the period", () => {
    const w = world();
    const reference = investigating(w);
    const answer = requestEvidence(w.key, w.officer, reference, { item: "Sao kê", addressee: "party:tcv", deadline: addDays(today(), 90), deadlineUnreadable: false, disclosure: "open" });
    expect(answer.refusal?.code).toBe("DEADLINE_BEYOND_POLICY");
    expect(answer.refusal?.detail.period).toBe("10");
    expect(evidencePage(w.key, w.officer, reference).data?.rows).toEqual([]);
    expect(lastAudit(w.key)).toMatchObject({ code: "DEADLINE_BEYOND_POLICY" });
  });

  it("holds an item an officer adds on its own, with its status and who supplied it (POST /cases/{id}/evidence)", () => {
    const w = world();
    const reference = investigating(w);
    const answer = addEvidence(w.key, w.officer, reference, { itemRef: "Biên bản làm việc ngày 15/10", disclosure: "sealed", suppliedBy: "team" });
    expect(answer.accepted?.item).toBe("Biên bản làm việc ngày 15/10");
    expect(evidencePage(w.key, w.officer, reference).data?.held).toEqual([
      expect.objectContaining({ item: "Biên bản làm việc ngày 15/10", disclosure: "sealed", suppliedBy: w.officer.account, via: "added" }),
    ]);
  });

  it("refuses an item with no disclosure status with DISCLOSURE_STATUS_REQUIRED, holding nothing", () => {
    const w = world();
    const reference = investigating(w);
    expect(addEvidence(w.key, w.officer, reference, { itemRef: "Biên bản", disclosure: "", suppliedBy: "team" }).refusal?.code).toBe("DISCLOSURE_STATUS_REQUIRED");
    expect(evidencePage(w.key, w.officer, reference).data?.held).toEqual([]);
  });

  it("holds an item the raiser adds to their own case, shown to them in full", () => {
    const w = world();
    const reference = investigating(w);
    expect(supplyEvidence(w.key, w.raiser, reference, { itemRef: "Hợp đồng dịch vụ 2026", disclosure: "confidential_to_case_team" }).accepted?.item).toBe("Hợp đồng dịch vụ 2026");
    expect(caseRead(w.key, reference, w.raiser).data?.evidence).toEqual([expect.objectContaining({ item: "Hợp đồng dịch vụ 2026", own: true })]);
  });

  it("refuses an item from someone the case was not raised by with ROLE_OUT_OF_SCOPE, and records the attempt", () => {
    const w = world();
    const reference = investigating(w);
    const stranger: CaseReader = { party: "lamhong", account: "Lã Bảo Trân" };
    expect(supplyEvidence(w.key, stranger, reference, { itemRef: "Thư", disclosure: "open" }).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(lastAudit(w.key)).toMatchObject({ actor: "Lã Bảo Trân", act: "evidence", code: "ROLE_OUT_OF_SCOPE" });
  });

  it("@AC-FR-CAS-006-02 shows the raiser an item another party supplied in confidence as existing, its content withheld", () => {
    const w = world();
    const reference = investigating(w);
    addParty(w.key, w.officer, reference, { party: "qnh", role: "respondent" });
    addEvidence(w.key, w.officer, reference, { itemRef: "Sổ thu tiền của Quán Nướng Hẻm 214", disclosure: "confidential_to_case_team", suppliedBy: "party:qnh" });
    expect(caseRead(w.key, reference, w.raiser).data?.evidence).toEqual([expect.objectContaining({ item: null, disclosure: "confidential_to_case_team", own: false })]);
  });
});

describe("reopenings: refused with a reason, and asked for by the raiser (SM-31 transitions 4 to 7)", () => {
  it("refuses a reopening with its reason: REOPEN_REFUSED, the case stays closed, and the raiser reads the reason", () => {
    const w = world();
    const reference = closedInadmissible(w);
    const proposal = proposeReopening(w.key, w.officer, reference, newEvidence()).accepted?.reopening ?? "";
    const answer = authoriseReopening(w.key, w.authority, proposal, "refuse", "Biên bản không liên quan đến nội dung vụ việc.");
    expect(answer.accepted?.state).toBe("REOPEN_REFUSED");
    expect(consoleCase(w.key, w.officer, reference).data?.state).toBe("CLOSED_INADMISSIBLE");
    expect(caseRead(w.key, reference, w.raiser).data?.reopening).toMatchObject({ state: "REOPEN_REFUSED", refusedReason: "Biên bản không liên quan đến nội dung vụ việc." });
    expect(reopeningPage(w.key, w.officer, reference).data?.history[0]?.refusedReason).toBe("Biên bản không liên quan đến nội dung vụ việc.");
  });

  it("refuses a refusal with no reason with FIELD_MISSING beside the reason, the proposal still waiting", () => {
    const w = world();
    const reference = closedInadmissible(w);
    const proposal = proposeReopening(w.key, w.officer, reference, newEvidence()).accepted?.reopening ?? "";
    expect(authoriseReopening(w.key, w.authority, proposal, "refuse", " ").refusal?.fields).toEqual({ reason: "FIELD_MISSING" });
    expect(reopeningPage(w.key, w.officer, reference).data?.open?.state).toBe("REOPEN_PROPOSED");
  });

  it("@AC-FR-CAS-016-08 refuses to authorise a reopening already decided with REOPEN_ALREADY_DECIDED, and records the attempt", () => {
    const w = world();
    const reference = closedInadmissible(w);
    const proposal = proposeReopening(w.key, w.officer, reference, newEvidence()).accepted?.reopening ?? "";
    authoriseReopening(w.key, w.authority, proposal, "refuse", "Căn cứ chưa đủ.");
    const answer = authoriseReopening(w.key, w.authority, proposal);
    expect(answer.refusal?.code).toBe("REOPEN_ALREADY_DECIDED");
    expect(reopeningPage(w.key, w.officer, reference).data?.history[0]?.state).toBe("REOPEN_REFUSED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.authority.email, code: "REOPEN_ALREADY_DECIDED" });
  });

  it("lets the raiser ask for a reopening of a case closed without a decision; it waits for an authority as an officer's proposal does", () => {
    const w = world();
    const reference = closedInadmissible(w);
    expect(caseRead(w.key, reference, w.raiser).data?.canReopen).toBe(true);
    const answer = askReopening(w.key, w.raiser, reference, newEvidence());
    expect(answer.accepted?.reopening).toMatch(/^ROP-/);
    expect(reopeningPage(w.key, w.officer, reference).data?.open).toMatchObject({ state: "REOPEN_PROPOSED", proposer: "raiser" });
    expect(approvalsQueue(w.key, w.authority).data?.reopenings[0]).toMatchObject({ caseReference: reference, proposer: "raiser" });
    expect(caseRead(w.key, reference, w.raiser).data?.canReopen).toBe(false);
  });

  it("returns the case to investigation when the raiser's reopening is authorised, and tells the raiser it moved", () => {
    const w = world();
    const reference = closedInadmissible(w);
    const proposal = askReopening(w.key, w.raiser, reference, newEvidence()).accepted?.reopening ?? "";
    expect(authoriseReopening(w.key, w.authority, proposal).accepted?.state).toBe("REOPENED");
    expect(consoleCase(w.key, w.officer, reference).data?.state).toBe("INVESTIGATING");
    expect(noticeKinds(w, reference).filter((kind) => kind === "case_status_changed")).toHaveLength(2);
  });

  it("@AC-FR-CAS-016-07 refuses a raiser's proposal naming an outcome not on the decision with OUTCOME_NOT_ON_DECISION, and records the attempt", () => {
    const w = world();
    const reference = decidedAndClosed(w);
    const answer = askReopening(w.key, w.raiser, reference, newEvidence({ displaced: ["refund"], nothing: false }));
    expect(answer.refusal?.code).toBe("OUTCOME_NOT_ON_DECISION");
    expect(answer.refusal?.fields).toEqual({ displaced: "OUTCOME_NOT_ON_DECISION" });
    const page = reopeningPage(w.key, w.officer, reference).data;
    expect(page?.open).toBeNull();
    expect(page?.history).toEqual([]);
    expect(caseRead(w.key, reference, w.raiser).data?.decision?.remedy).toBe("explanation");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.raiser.account, act: "reopen", code: "OUTCOME_NOT_ON_DECISION" });
  });

  it("refuses a reopening asked for by someone the case was not raised by with ROLE_OUT_OF_SCOPE", () => {
    const w = world();
    const reference = closedInadmissible(w);
    expect(askReopening(w.key, { party: "lamhong", account: "Lã Bảo Trân" }, reference, newEvidence()).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
  });
});

/** CFG-48 unset for billing in this world: the seeded approved version taken away, the state the criterion starts from. */
function withoutApprovedAppealPeriod(key: string): void {
  const cases = casesTable(key);
  cases.policyPeriods = cases.policyPeriods.filter((period) => !(period.kind === "appeal_decision" && period.caseType === "billing" && period.state === "APPROVED"));
}

function prepareAppealPeriod(w: World, effectiveFrom: string): string {
  const answer = preparePeriod(w.key, w.second, "appeal_decision", { caseType: "billing", amount: "15", effectiveFrom, effectiveUnreadable: false });
  if (answer.accepted === null) throw new Error(`not prepared: ${answer.refusal.code}`);
  return answer.accepted.period;
}

function unmeasuredAppeal(w: World): { reference: string; appeal: string } {
  withoutApprovedAppealPeriod(w.key);
  prepareAppealPeriod(w, addDays(today(), 1));
  const reference = decidedAndClosed(w);
  const answer = lodgeAppeal(w.key, w.raiser, reference, { grounds: "Hoá đơn vẫn tính trùng.", contact: "trang.do@thencuaviet.vn" });
  if (answer.accepted === null) throw new Error(`not lodged: ${answer.refusal.code}`);
  return { reference, appeal: answer.accepted.appeal };
}

describe("the appeal period the case owner approves (FR-CAS-021, CFG-48)", () => {
  it("@AC-FR-CAS-021-03 lodges an appeal whose only period nobody approved without a due date, measured PERIOD_VERSION_NOT_APPROVED", () => {
    const w = world();
    const { reference } = unmeasuredAppeal(w);
    const appeal = caseRead(w.key, reference, w.raiser).data?.appeal;
    expect(appeal).toMatchObject({ state: "UNDER_APPEAL", dueAt: null, measurement: "PERIOD_VERSION_NOT_APPROVED" });
    expect(appeal?.dueAt).not.toBe(appeal?.receivedAt);
  });

  it("never lapses an appeal nothing measured, and names it on the appeal-period register", () => {
    const w = world();
    const { reference, appeal } = unmeasuredAppeal(w);
    travel(60);
    expect(caseRead(w.key, reference, w.raiser).data?.appeal?.state).toBe("UNDER_APPEAL");
    expect(policyRegister(w.key, w.authority, "appeal_decision").data?.unmeasured).toEqual([expect.objectContaining({ appeal, caseReference: reference, caseType: "billing" })]);
  });

  it("refuses to approve a version that would reach back over an unmeasured appeal with PERIOD_VERSION_NOT_APPROVED, naming the appeal", () => {
    const w = world();
    withoutApprovedAppealPeriod(w.key);
    const reference = decidedAndClosed(w);
    const appeal = lodgeAppeal(w.key, w.raiser, reference, { grounds: "Hoá đơn vẫn tính trùng.", contact: "trang.do@thencuaviet.vn" }).accepted?.appeal ?? "";
    const period = prepareAppealPeriod(w, today());
    const answer = approvePolicyItem(w.key, w.authority, period);
    expect(answer.refusal?.code).toBe("PERIOD_VERSION_NOT_APPROVED");
    expect(answer.refusal?.detail).toEqual({ reference: appeal, date: today() });
    expect(policyRegister(w.key, w.authority, "appeal_decision").data?.periods.find((entry) => entry.id === period)?.state).toBe("PREPARED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.authority.email, code: "PERIOD_VERSION_NOT_APPROVED" });
  });

  it("approves a version that starts after the unmeasured appeal's decision, and the appeal stays unmeasured", () => {
    const w = world();
    const { reference } = unmeasuredAppeal(w);
    const period = prepareAppealPeriod(w, addDays(today(), 2));
    expect(approvePolicyItem(w.key, w.authority, period).accepted?.effectiveFrom).toBe(addDays(today(), 2));
    expect(caseRead(w.key, reference, w.raiser).data?.appeal?.measurement).toBe("PERIOD_VERSION_NOT_APPROVED");
  });

  it("refuses a version with the reason the approver gives, leaving it prepared with the reason for its preparer", () => {
    const w = world();
    const period = prepareAppealPeriod(w, addDays(today(), 30));
    expect(approvePolicyItem(w.key, w.authority, period, "refuse", "Mười lăm ngày là quá ngắn.").accepted).not.toBeNull();
    expect(policyRegister(w.key, w.second, "appeal_decision").data?.periods.find((entry) => entry.id === period)).toMatchObject({
      state: "PREPARED",
      refused: { reason: "Mười lăm ngày là quá ngắn.", by: { email: w.authority.email } },
    });
  });
});

/** A category policy the security owner prepared and the business approver approved: in force from today. */
function approvedPolicy(w: World, category: string, access: readonly string[]): void {
  const prepared = prepareCategoryPolicy(w.key, w.security, {
    category,
    specialistProcess: "Quy trình xử lý sự cố dữ liệu cá nhân",
    access,
    primary: w.security.email,
    alternate: w.authority.email,
    effectiveFrom: today(),
    effectiveUnreadable: false,
  });
  if (prepared.accepted === null) throw new Error(`not prepared: ${prepared.refusal.code}`);
  const approved = approvePolicyItem(w.key, w.authority, prepared.accepted.policy);
  if (approved.accepted === null) throw new Error(`not approved: ${approved.refusal.code}`);
}

describe("protected matters (FR-CAS-010, DR-50, CFG-50)", () => {
  it("@AC-FR-CAS-010-07 refuses a category outside the five with CATEGORY_UNKNOWN, applies no restriction, and records the attempt", () => {
    const w = world();
    const reference = investigating(w);
    const answer = classifyProtected(w.key, w.officer, reference, { category: "misconduct", reason: "Nghi có sai phạm.", subjects: [] });
    expect(answer.refusal?.code).toBe("CATEGORY_UNKNOWN");
    expect(consoleCase(w.key, w.officer, reference).data?.protection).toBeNull();
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "protect", code: "CATEGORY_UNKNOWN" });
  });

  it("refuses a classification into a category whose policy nobody approved with CATEGORY_UNKNOWN", () => {
    const w = world();
    const reference = investigating(w);
    expect(classifyProtected(w.key, w.officer, reference, { category: "privacy", reason: "Lộ dữ liệu khách hàng.", subjects: [] }).refusal?.code).toBe("CATEGORY_UNKNOWN");
    expect(consoleCase(w.key, w.officer, reference).data?.options.categories).toEqual([]);
  });

  it("@AC-FR-CAS-010-10 refuses a category policy whose two addressees are one person with ADDRESSEES_NOT_DISTINCT, and records the attempt", () => {
    const w = world();
    const answer = prepareCategoryPolicy(w.key, w.security, {
      category: "fraud",
      specialistProcess: "Quy trình chống gian lận",
      access: [w.security.email],
      primary: w.security.email,
      alternate: w.security.email,
      effectiveFrom: today(),
      effectiveUnreadable: false,
    });
    expect(answer.refusal?.code).toBe("ADDRESSEES_NOT_DISTINCT");
    expect(answer.refusal?.fields).toEqual({ alternate: "ADDRESSEES_NOT_DISTINCT" });
    expect(policyRegister(w.key, w.security, "protected_category").data?.categoryPolicies).toEqual([]);
    expect(lastAudit(w.key)).toMatchObject({ actor: w.security.email, code: "ADDRESSEES_NOT_DISTINCT" });
  });

  it("refuses the policy's own preparer its approval with SEG_SAME_ACTOR, though they are the data protection officer", () => {
    const w = world();
    const prepared = prepareCategoryPolicy(w.key, w.security, {
      category: "privacy",
      specialistProcess: "Quy trình xử lý sự cố dữ liệu cá nhân",
      access: [w.second.email],
      primary: w.security.email,
      alternate: w.authority.email,
      effectiveFrom: today(),
      effectiveUnreadable: false,
    });
    expect(approvePolicyItem(w.key, w.security, prepared.accepted?.policy ?? "").refusal?.code).toBe("SEG_SAME_ACTOR");
  });

  it("@AC-FR-CAS-010-01 restricts the case at classification: an officer outside the access list can no longer read it", () => {
    const w = world();
    approvedPolicy(w, "privacy", [w.second.email]);
    const reference = investigating(w);
    expect(classifyProtected(w.key, w.officer, reference, { category: "privacy", reason: "Lộ dữ liệu khách hàng.", subjects: [] }).accepted?.matter).toMatch(/^PRM-/);
    expect(consoleCase(w.key, w.officer, reference).failure?.code).toBe("PROTECTED_MATTER_NO_ACCESS");
    expect(consoleCase(w.key, w.second, reference).data?.reference).toBe(reference);
    expect(caseRead(w.key, reference, w.raiser).failure?.code).toBe("PROTECTED_MATTER_NO_ACCESS");
  });

  it("@AC-FR-CAS-010-02 routes the matter to the specialist process the policy names, with the category and the instant", () => {
    const w = world();
    approvedPolicy(w, "privacy", [w.second.email]);
    const reference = investigating(w);
    classifyProtected(w.key, w.officer, reference, { category: "privacy", reason: "Lộ dữ liệu khách hàng.", subjects: [] });
    const read = consoleCase(w.key, w.second, reference).data;
    expect(read?.protection).toMatchObject({ category: "privacy", state: "ROUTED", process: "Quy trình xử lý sự cố dữ liệu cá nhân" });
    expect(read?.protection?.since).toBeTruthy();
    expect(read?.state).toBe("SPECIALIST_ESCALATION");
  });

  it("@AC-FR-CAS-010-03 refuses a read by an officer outside the access list with PROTECTED_MATTER_NO_ACCESS, returning nothing, and records it", () => {
    const w = world();
    approvedPolicy(w, "privacy", [w.second.email]);
    const reference = investigating(w);
    classifyProtected(w.key, w.officer, reference, { category: "privacy", reason: "Lộ dữ liệu khách hàng.", subjects: [] });
    const read = evidencePage(w.key, w.officer, reference);
    expect(read).toMatchObject({ data: null, failure: { code: "PROTECTED_MATTER_NO_ACCESS" } });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, subject: reference, code: "PROTECTED_MATTER_NO_ACCESS" });
  });

  it("@AC-FR-CAS-010-04 refuses a person the matter names with PROTECTED_MATTER_SUBJECT_EXCLUDED, though they are on the access list", () => {
    const w = world();
    approvedPolicy(w, "security", [w.officer.email, w.second.email]);
    const reference = investigating(w);
    classifyProtected(w.key, w.officer, reference, { category: "security", reason: "Tài khoản nội bộ bị dùng sai.", subjects: [w.second.email] });
    expect(consoleCase(w.key, w.second, reference).failure?.code).toBe("PROTECTED_MATTER_SUBJECT_EXCLUDED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.second.email, code: "PROTECTED_MATTER_SUBJECT_EXCLUDED" });
    expect(policyRegister(w.key, w.security, "protected_category").data?.categoryPolicies[0]?.access.map((person) => person.email)).toEqual([w.officer.email, w.second.email]);
    expect(consoleCase(w.key, w.officer, reference).data?.reference).toBe(reference);
  });

  it("leaves a protected case out of the queue of an officer outside its access list, and in the queue of one on it", () => {
    const w = world();
    approvedPolicy(w, "privacy", [w.second.email]);
    const reference = investigating(w);
    classifyProtected(w.key, w.officer, reference, { category: "privacy", reason: "Lộ dữ liệu khách hàng.", subjects: [] });
    const filter = { state: null, caseType: null, owner: null };
    expect(caseQueue(w.key, w.officer, filter, null).data?.rows.map((row) => row.reference)).not.toContain(reference);
    expect(caseQueue(w.key, w.second, filter, null).data?.rows.map((row) => row.reference)).toContain(reference);
  });
});

describe("console refusals recorded with the actor, the time and the code", () => {
  it("@AC-FR-CAS-003-07 refuses the case list to a reader with no case role with ROLE_NOT_ASSIGNED, disclosing no case, and records it", () => {
    const w = world();
    const read = caseQueue(w.key, w.security, { state: null, caseType: null, owner: null }, null);
    expect(read).toMatchObject({ data: null, failure: { code: "ROLE_NOT_ASSIGNED" } });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.security.email, act: "list", code: "ROLE_NOT_ASSIGNED" });
  });

  it("@AC-FR-CAS-003-06 refuses an expired page link with CURSOR_INVALID rather than answering with the first page, and records it", () => {
    const w = world();
    const read = caseQueue(w.key, w.officer, { state: null, caseType: null, owner: null }, "7.CAS-2026-000000");
    expect(read).toMatchObject({ data: null, failure: { code: "CURSOR_INVALID" } });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, code: "CURSOR_INVALID" });
  });

  it("@AC-FR-CAS-003-08 refuses a link kind outside the four with LINK_KIND_UNKNOWN, writes no link, and records the attempt", () => {
    const w = world();
    const first = triaged(w);
    const second = triaged(w);
    expect(linkCase(w.key, w.officer, first, { to: second, kind: "related_background" }).refusal?.code).toBe("LINK_KIND_UNKNOWN");
    expect(consoleCase(w.key, w.officer, first).data?.links).toEqual([]);
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "link", code: "LINK_KIND_UNKNOWN" });
  });

  it("@AC-FR-CAS-003-09 refuses a party role outside the four with PARTY_ROLE_UNKNOWN, writes no party, and records the attempt", () => {
    const w = world();
    const reference = triaged(w);
    expect(addParty(w.key, w.officer, reference, { party: "qnh", role: "witness" }).refusal?.code).toBe("PARTY_ROLE_UNKNOWN");
    expect(consoleCase(w.key, w.officer, reference).data?.parties.map((party) => party.party)).toEqual(["tcv"]);
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "party", code: "PARTY_ROLE_UNKNOWN" });
  });

  it("@AC-FR-CAS-003-12 refuses an entry to a register this module does not hold with REGISTER_UNKNOWN, and records the attempt", () => {
    const w = world();
    const answer = addRegisterEntry(w.key, w.officer, "severity-bands", { code: "urgent", label: "Khẩn", authority: "", effectiveFrom: today(), effectiveUnreadable: false });
    expect(answer.refusal?.code).toBe("REGISTER_UNKNOWN");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, code: "REGISTER_UNKNOWN" });
  });

  it("@AC-FR-CAS-018-04 refuses a route given to a group not in the register with ROUTE_GROUP_UNKNOWN, writes no version, and records it", () => {
    const w = world();
    const before = casesTable(w.key).intakeMatrixVersions.length;
    const answer = saveIntakeVersion(w.key, w.officer, {
      versionId: null,
      effectiveFrom: addDays(today(), 30),
      effectiveUnreadable: false,
      routes: [{ group: "broadcast_aggregators", kind: "portal_form", requiresAccount: false }],
    });
    expect(answer.refusal?.code).toBe("ROUTE_GROUP_UNKNOWN");
    expect(casesTable(w.key).intakeMatrixVersions).toHaveLength(before);
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, code: "ROUTE_GROUP_UNKNOWN" });
  });

  it("@AC-FR-CAS-018-06 refuses to approve a version approved already with VERSION_ALREADY_APPROVED, and records the attempt", () => {
    const w = world();
    expect(approveIntakeVersion(w.key, w.authority, "intake-matrix-3").refusal?.code).toBe("VERSION_ALREADY_APPROVED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.authority.email, code: "VERSION_ALREADY_APPROVED" });
  });

  it("@AC-FR-CAS-002-05 refuses a reference that names no case with CASE_NOT_FOUND, disclosing nothing, and records the attempt", () => {
    const w = world();
    expect(caseRead(w.key, "CAS-2027-005912", w.raiser)).toMatchObject({ data: null, failure: { code: "CASE_NOT_FOUND" } });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.raiser.account, subject: "CAS-2027-005912", code: "CASE_NOT_FOUND" });
  });

  it("@AC-FR-CAS-002-06 refuses a withdrawal by someone the case was not raised by with ROLE_OUT_OF_SCOPE, writing no row, and records it", () => {
    const w = world();
    const reference = raise(w);
    const answer = withdrawCase(w.key, reference, { party: "lamhong", account: "Lã Bảo Trân" });
    expect(answer.refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(caseRead(w.key, reference, w.raiser).data?.state).toBe("RECEIVED");
    expect(lastAudit(w.key)).toMatchObject({ actor: "Lã Bảo Trân", act: "withdraw", code: "ROLE_OUT_OF_SCOPE" });
  });

  it("@AC-FR-CAS-008-06 refuses a second challenge to one decision with APPEAL_ALREADY_LODGED naming the answer date, and records it", () => {
    const w = world();
    const reference = decidedAndClosed(w);
    const first = lodgeAppeal(w.key, w.raiser, reference, { grounds: "Không đồng ý.", contact: "trang.do@thencuaviet.vn" }).accepted;
    const answer = lodgeAppeal(w.key, w.raiser, reference, { grounds: "Vẫn không đồng ý.", contact: "trang.do@thencuaviet.vn" });
    expect(answer.refusal?.code).toBe("APPEAL_ALREADY_LODGED");
    expect(answer.refusal?.detail.date).toBe(first?.dueAt);
    expect(approvalsQueue(w.key, w.authority).data?.appeals.filter((appeal) => appeal.caseReference === reference)).toHaveLength(1);
    expect(lastAudit(w.key)).toMatchObject({ actor: w.raiser.account, act: "appeal", code: "APPEAL_ALREADY_LODGED" });
  });

  it("@AC-FR-CAS-008-07 refuses an appeal reference that names no appeal with APPEAL_NOT_FOUND, disclosing nothing, and records it", () => {
    const w = world();
    expect(appealPage(w.key, w.authority, "AP-2027-0099")).toMatchObject({ data: null, failure: { code: "APPEAL_NOT_FOUND" } });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.authority.email, code: "APPEAL_NOT_FOUND" });
  });
});

describe("a case recorded on the support line for a caller (SCR-CAS-01, ACT-SUP)", () => {
  it("records the caller as the raiser on their group's support line, the agent beside them, and acknowledges the caller", () => {
    const w = world();
    const answer = recordCallerCase(w.key, w.officer, {
      group: "public",
      routeId: "",
      matter: "Quán cà phê gần nhà mở nhạc quá giờ.",
      subject: "",
      period: NO_PERIOD,
      remedy: "",
      contact: "0903 111 222",
    });
    const reference = answer.accepted?.reference ?? "";
    expect(answer.accepted?.contact).toBe("0903 111 222");
    expect(answer.accepted?.notice).not.toBeNull();
    const read = consoleCase(w.key, w.officer, reference).data;
    expect(read).toMatchObject({ state: "RECEIVED", group: "public", contact: "0903 111 222", agent: { email: w.officer.email }, route: { kind: "support_line", versionNo: 3 } });
    expect(read?.raiser).toEqual({ party: null, name: null, account: null });
  });

  it("refuses a member of staff without the support-line role with ROLE_NOT_ASSIGNED, and records the attempt", () => {
    const w = world();
    const answer = recordCallerCase(w.key, w.authority, { group: "public", routeId: "", matter: "Nhạc to.", subject: "", period: NO_PERIOD, remedy: "", contact: "0903 111 222" });
    expect(answer.refusal?.code).toBe("ROLE_NOT_ASSIGNED");
    expect(lastAudit(w.key)).toMatchObject({ actor: w.authority.email, act: "raise", code: "ROLE_NOT_ASSIGNED" });
  });
});

describe("openCase, the case another module opens (ICaseIntake.OpenCase)", () => {
  it("opens an inspection's follow-up with the premises as respondent and no remedy asked, and a repeated key opens no second case", () => {
    const w = world();
    const input = {
      subjectKind: "INSPECTION_REFERRAL" as const,
      subjectRef: "IRC-2026-0042",
      raiser: { account: "Âu Ngọc Diệp", contact: "ngocdiep.au@kiemtra.example" },
      onBehalfOfParty: "tcv",
      grounds: "Cơ sở phát nhạc ngoài danh mục đã đăng ký.",
      idempotencyKey: "ver-follow-up-1",
    };
    const reference = openCase(w.key, input);
    expect(openCase(w.key, input)).toBe(reference);
    const read = consoleCase(w.key, w.officer, reference).data;
    expect(read).toMatchObject({ state: "RECEIVED", subjectRef: "IRC-2026-0042", requestedRemedy: null, contact: "ngocdiep.au@kiemtra.example" });
    expect(read?.parties).toEqual([expect.objectContaining({ party: "tcv", role: "respondent" })]);
  });
});

describe("SM-40: a request for evidence is cancelled while ISSUED, and only then (transition 5)", () => {
  it("cancels an ISSUED request with its reason, tells the party, and returns the case to investigation", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    expect(cancelEvidenceRequest(w.key, w.officer, reference, request, "Đã có bản sao từ ngân hàng.").accepted).toEqual({ cancelled: request });
    const page = evidencePage(w.key, w.officer, reference).data;
    expect(page?.rows[0]).toMatchObject({ state: "CANCELLED", cancelled: { reason: "Đã có bản sao từ ngân hàng." } });
    expect(page?.state).toBe("INVESTIGATING");
    expect(noticeKinds(w, reference)).toContain("evidence_request_cancelled");
  });

  it("refuses to cancel an OVERDUE request with TRANSITION_NOT_PERMITTED, naming where it can still go, and records the attempt", () => {
    const w = world();
    const { reference, request } = awaiting(w);
    travel(3);
    const answer = cancelEvidenceRequest(w.key, w.officer, reference, request, "Không cần nữa.");
    expect(answer.refusal).toMatchObject({ code: "TRANSITION_NOT_PERMITTED", detail: { state: "OVERDUE", permitted: "RESPONDED, NOT_SUPPLIED" } });
    expect(lastAudit(w.key)).toMatchObject({ actor: w.officer.email, act: "cancel request", code: "TRANSITION_NOT_PERMITTED" });
    const page = evidencePage(w.key, w.officer, reference).data;
    expect(page?.rows[0]).toMatchObject({ state: "OVERDUE", cancelled: null });
    expect(page?.state).toBe("AWAITING_EVIDENCE");
    expect(noticeKinds(w, reference)).not.toContain("evidence_request_cancelled");
  });
});

/** Nguyễn Huệ's decision, of the premises Hầu Ngọc Ánh's delegation names, and Pasteur's, which it does not. */
const NGUYEN_HUE_DECISION = "OBD-8KWT2PZH6M";
const PASTEUR_DECISION = "OBD-3FJW6NRA5C";

/** Someone else signed in on the world's browser for Then Cửa Việt, as the case pages hand them to the backend. */
function besideAs(w: World, email: string): { key: string; reader: CaseReader } {
  return { key: signInBeside(w.key, email), reader: { party: "tcv", account: findAccount(email)?.name ?? null } };
}

/** POST /cases from the account route by the session given, about the subject named. */
function raiseAbout(key: string, reader: CaseReader, subject: string) {
  const form = intakeForm(key, reader, null, null, null).data;
  return raiseCase(key, reader, {
    group: form?.group ?? "",
    routeId: form?.formRoute?.id ?? "",
    matter: "Quyết định ghi sai diện tích phục vụ.",
    subject,
    period: NO_PERIOD,
    remedy: "",
    contact: "anh.hau@thencuaviet.vn",
  });
}

describe("a delegate acts on the party's cases within her delegation (PTY, DR-201)", () => {
  it("lets the delegate raise, read, list and withdraw a case about the premises her delegation names", () => {
    const w = world();
    const delegate = besideAs(w, PEOPLE.delegate);
    const reference = raiseAbout(delegate.key, delegate.reader, NGUYEN_HUE_DECISION).accepted?.reference ?? "";
    expect(reference).toMatch(/^CAS-/);
    expect(caseRead(delegate.key, reference, delegate.reader).data).toMatchObject({ reference, own: true, subject: NGUYEN_HUE_DECISION });
    expect(casesRaisedBy(delegate.key, "tcv").data?.map((row) => row.reference)).toEqual([reference]);
    expect(withdrawCase(delegate.key, reference, delegate.reader).accepted?.state).toBe("WITHDRAWN");
  });

  it("refuses the delegate a case about another premises, or about none, with ROLE_OUT_OF_SCOPE, and lists neither", () => {
    const w = world();
    const delegate = besideAs(w, PEOPLE.delegate);
    expect(raiseAbout(delegate.key, delegate.reader, PASTEUR_DECISION).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    const pasteur = raiseAbout(w.key, w.raiser, PASTEUR_DECISION).accepted?.reference ?? "";
    const invoice = raise(w);
    for (const reference of [pasteur, invoice]) {
      expect(caseRead(delegate.key, reference, delegate.reader).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
      expect(withdrawCase(delegate.key, reference, delegate.reader).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    }
    expect(lastAudit(w.key)).toMatchObject({ act: "withdraw", code: "ROLE_OUT_OF_SCOPE" });
    expect(casesRaisedBy(delegate.key, "tcv").data).toEqual([]);
    expect(casesRaisedBy(w.key, "tcv").data?.map((row) => row.reference)).toEqual(expect.arrayContaining([pasteur, invoice]));
    const decided = decidedAndClosed(w);
    expect(lodgeAppeal(delegate.key, delegate.reader, decided, { grounds: "Hoá đơn tính trùng.", contact: "anh.hau@thencuaviet.vn" }).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(askReopening(delegate.key, delegate.reader, decided, newEvidence()).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
  });

  it("lets the delegate answer a request on a case about her premises, and refuses her one on a case about none", () => {
    const w = world();
    const delegate = besideAs(w, PEOPLE.delegate);
    const own = raiseAbout(w.key, w.raiser, NGUYEN_HUE_DECISION).accepted?.reference ?? "";
    expect(classifyCase(w.key, w.officer, own, classification(w.officer.email, { subjectKind: "decision", subjectRef: NGUYEN_HUE_DECISION })).refusal).toBeNull();
    progressCase(w.key, w.officer, own, "investigating");
    const asked = requestEvidence(w.key, w.officer, own, { item: "Bản vẽ mặt bằng", addressee: "party:tcv", deadline: today(), deadlineUnreadable: false, disclosure: "open" }).accepted?.request ?? "";
    expect(answerEvidenceRequest(delegate.key, delegate.reader, own, asked, { outcome: "supplied", supplied: "Bản vẽ mặt bằng tầng 1" }).accepted?.outcome).toBe("supplied");
    const { reference, request } = awaiting(w);
    expect(answerEvidenceRequest(delegate.key, delegate.reader, reference, request, { outcome: "supplied", supplied: "Sao kê" }).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(supplyEvidence(delegate.key, delegate.reader, reference, { itemRef: "Sao kê", disclosure: "open" }).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
  });

  it("refuses a delegate whose authority was revoked every case of the party, even one about Nguyễn Huệ", () => {
    const w = world();
    const reference = raiseAbout(w.key, w.raiser, NGUYEN_HUE_DECISION).accepted?.reference ?? "";
    const revoked = besideAs(w, PEOPLE.revokedDelegate);
    expect(raiseAbout(revoked.key, revoked.reader, NGUYEN_HUE_DECISION).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(caseRead(revoked.key, reference, revoked.reader).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(withdrawCase(revoked.key, reference, revoked.reader).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(casesRaisedBy(revoked.key, "tcv").data).toEqual([]);
    expect(caseRead(w.key, reference, w.raiser).data?.state).toBe("RECEIVED");
  });
});
