import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptanceView,
  applyForCertification,
  approveAssurancePolicy,
  approveOfflinePolicy,
  approveRuleSet,
  assessCertification,
  assuranceConsole,
  assurancePolicy,
  decisionsView,
  deviceCredentialState,
  deviceEstate,
  deviceRecord,
  draftAssurancePolicy,
  draftOfflinePolicy,
  draftRuleSet,
  enrolDevice,
  offlinePolicy,
  playerAuditOf,
  recordCondition,
  ruleSetView,
  suspendCredential,
  syncProgress,
  venueView,
} from "@/lib/mock/backend/player";
import type { ConditionInput, DeviceRecord } from "@/lib/api/player";
import type { Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import type * as Notices from "@/lib/mock/backend/notices";
import { noticeQueue, officeDestinationOf, type NoticeEvent } from "@/lib/mock/backend/notices";
import type { StaffRole } from "@/lib/mock/backend/store";
import { PEOPLE, signIn, signInBeside } from "./harness";

/*
 * PLR on the consoles and the premises portal, as its people use it: Phan Gia Lượng, the operations officer who is also
 * the evidence operator (ACT-OPS, ACT-EVD); Quan Ngọc Trâm, an operations officer without ACT-EVD; Lê Văn Cường read as
 * the auditor (ACT-AUD) or as the security officer (ACT-SEC); and Then Cửa Việt's principal Đỗ Thu Trang with her
 * delegate Hầu Ngọc Ánh. Pasteur's PLY-0023 plays and is receiving snapshot 12 (313 of 504 MB); Lê Thánh Tôn's PLY-0031
 * went offline on 28 September with 614 events waiting and its transfer cut at 196 of 490 MB; Bùi Viện's PLY-0038 holds
 * all of its snapshot; The Lintel's PLY-0027 is offline since 01:40 on 30 September. The device never acts in the mock,
 * so its reports are those of 30 September at 12:36.
 */

/** Every notice PLR asks COM to raise, as COM is asked. */
const raised = vi.hoisted(
  () => [] as { key: string; event: { sourceModule: string; eventKind: string; recipientPartyId: string | null; destination: string | null; facts: Readonly<Record<string, string | number>> } }[],
);

vi.mock("@/lib/mock/backend/notices", async (importOriginal) => {
  const actual = await importOriginal<typeof Notices>();
  return {
    ...actual,
    recordNoticeEvent: vi.fn((key: string, event: NoticeEvent) => {
      raised.push({ key, event });
      return actual.recordNoticeEvent(key, event);
    }),
  };
});

// A world's first read seeds the families PLR reads, VEN's and PTY's among them.
vi.setConfig({ testTimeout: 30_000 });

const TCV = "tcv";
const PASTEUR_DEVICE = "PLY-0023";
const LTT_DEVICE = "PLY-0031";
const BUIVIEN_DEVICE = "PLY-0038";
const LINTEL_DEVICE = "PLY-0027";
const PASTEUR_CREDENTIAL = "DCR-3HWT6KQZ9P";

/** A Monday in October, after every seeded report, before the seeded offline draft takes effect on 1 November. */
const NOW = "2026-10-05T10:00:00+07:00";

/** Moves the clock the mock backend reads, leaving timers alone. */
function at(instant: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

beforeEach(() => {
  at(NOW);
  raised.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

/** A member of staff as `requireStaff` hands them to the backend; `roles` narrows them to the roles a scenario reads. */
function staffOf(sessionId: string, email: string, roles?: readonly StaffRole[]): Staff {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: roles ?? account.staffRoles };
}

/** The operations officer, who is the evidence operator as well, in a world of their own. */
const officer = () => {
  const key = signIn(PEOPLE.operations);
  return staffOf(key, PEOPLE.operations);
};

/** Someone else signed in on the same browser, holding only the roles named. */
const beside = (staff: Staff, email: string, roles?: readonly StaffRole[]) => staffOf(signInBeside(staff.sessionId, email), email, roles);
const auditor = (staff: Staff) => beside(staff, PEOPLE.supervisor, ["ACT-AUD"]);
const security = (staff: Staff) => beside(staff, PEOPLE.supervisor, ["ACT-SEC"]);
/** Quan Ngọc Trâm: an operations officer who does not hold ACT-EVD. */
const notEvidence = (staff: Staff) => beside(staff, PEOPLE.preparer);

/** A condition as SCR-PLR-02's form sends it, every field the form leaves empty empty. */
const condition = (values: Partial<ConditionInput>): ConditionInput => ({
  condition: "",
  cause: "",
  effectiveFrom: "",
  reportedAt: "",
  premises: "",
  pending: "",
  ground: "",
  ...values,
});

function record(staff: Staff, device: string): DeviceRecord {
  const read = deviceRecord(staff, device);
  if (read.data === null) throw new Error(`${device} not read: ${read.failure?.code ?? ""}`);
  return read.data;
}

function mustRecord(staff: Staff, device: string, values: Partial<ConditionInput>) {
  const answer = recordCondition(staff, device, condition(values));
  expect(answer.refusal).toBeNull();
  return answer.accepted;
}

const plrNotices = (kind: string) => raised.filter((entry) => entry.event.sourceModule === "PLR" && entry.event.eventKind === kind).map((entry) => entry.event);

describe("GET /player/devices/{id}, the device record (SCR-PLR-02)", () => {
  it("@AC-FR-PLR-040-01 each condition carries its cause and effective time, and the auditor reads the sequence", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "SUSPENDED", cause: "moved", effectiveFrom: "2026-10-01T09:00+07:00" });
    mustRecord(ops, PASTEUR_DEVICE, { condition: "ACTIVE", cause: "checked", effectiveFrom: "2026-10-02T09:00+07:00" });
    mustRecord(ops, PASTEUR_DEVICE, { condition: "RETIRED", cause: "broken", effectiveFrom: "2026-10-03T09:00+07:00" });
    const read = record(auditor(ops), PASTEUR_DEVICE);
    expect(read.status).toBe("RETIRED");
    expect(read.conditions.map((row) => row.status)).toEqual(["RETIRED", "ACTIVE", "SUSPENDED", "ACTIVE", "ENROLLED"]);
    for (const row of read.conditions.slice(0, 3)) {
      expect(row.cause?.vi).not.toBe("");
      expect(row.effectiveFrom).not.toBe("");
      expect(row.recordedBy).toEqual({ name: "Phan Gia Lượng", role: "operations" });
    }
  });

  it("@AC-FR-PLR-040-02 shows exactly one condition in force and the others with their periods", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "SUSPENDED", cause: "moved", effectiveFrom: "2026-10-01T09:00+07:00" });
    mustRecord(ops, PASTEUR_DEVICE, { condition: "ACTIVE", cause: "checked", effectiveFrom: "2026-10-02T09:00+07:00" });
    const read = record(auditor(ops), PASTEUR_DEVICE);
    const inForce = read.conditions.filter((row) => !row.pending && row.effectiveTo === null);
    expect(inForce).toHaveLength(1);
    expect(inForce[0]).toMatchObject({ status: "ACTIVE", from: "SUSPENDED", effectiveFrom: new Date("2026-10-02T09:00+07:00").toISOString() });
    expect(read.conditions.find((row) => row.status === "SUSPENDED")?.effectiveTo).toBe(new Date("2026-10-02T09:00+07:00").toISOString());
  });

  it("opens read-only to the auditor (PERM-472) and to the security officer, who records a condition but not a transfer", () => {
    const ops = officer();
    expect(record(auditor(ops), PASTEUR_DEVICE).acts).toEqual({ record: false, transfer: false });
    expect(record(security(ops), PASTEUR_DEVICE).acts).toEqual({ record: true, transfer: false });
    expect(record(ops, PASTEUR_DEVICE).acts).toEqual({ record: true, transfer: true });
  });

  it("is refused NOT_AUTHORISED to a member of staff who holds none of PERM-472's or PERM-473's roles", () => {
    const ops = officer();
    const evidenceOnly = beside(ops, PEOPLE.operations, ["ACT-EVD"]);
    expect(deviceRecord(evidenceOnly, PASTEUR_DEVICE)).toEqual({ data: null, failure: { code: "NOT_AUTHORISED", traceId: null, retryable: false } });
  });

  it("@AC-FR-PLR-040-05 refuses an identifier that names no device NOT_FOUND, returning nothing of a device", () => {
    const ops = officer();
    expect(deviceRecord(auditor(ops), "PLY-9999")).toEqual({ data: null, failure: { code: "NOT_FOUND", traceId: null, retryable: false } });
  });
});

describe("POST /player/devices/{id}/conditions", () => {
  it("@AC-FR-PLR-004-03 refuses a condition with no effective time NO_EFFECTIVE_TIME, the device unchanged", () => {
    const ops = officer();
    const answer = recordCondition(ops, PASTEUR_DEVICE, condition({ condition: "SUSPENDED", cause: "moved" }));
    expect(answer.refusal).toEqual({ code: "NO_EFFECTIVE_TIME", field: "effective_from", item: null });
    const read = record(ops, PASTEUR_DEVICE);
    expect(read.status).toBe("ACTIVE");
    expect(read.conditions).toHaveLength(2);
  });

  it("leaves the condition before a time still to come in force until that time, then applies it", () => {
    const ops = officer();
    const answer = mustRecord(ops, PASTEUR_DEVICE, { condition: "SUSPENDED", cause: "moved", effectiveFrom: "2026-10-05T14:00+07:00" });
    expect(answer).toEqual({ status: "SUSPENDED", effectiveFrom: new Date("2026-10-05T14:00+07:00").toISOString(), inForce: false });
    const before = record(ops, PASTEUR_DEVICE);
    expect(before.status).toBe("ACTIVE");
    expect(before.scheduled).toMatchObject({ status: "SUSPENDED", pending: true });
    at("2026-10-05T14:30:00+07:00");
    const after = record(ops, PASTEUR_DEVICE);
    expect(after.status).toBe("SUSPENDED");
    expect(after.scheduled).toBeNull();
  });

  it("revokes a retired device's credential only once its retirement takes effect, not when it is recorded", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "RETIRED", cause: "broken", effectiveFrom: "2026-10-05T14:00+07:00" });
    expect(deviceCredentialState(ops.sessionId, PASTEUR_DEVICE).credential).toBe("ACTIVE");
    at("2026-10-05T14:30:00+07:00");
    expect(deviceCredentialState(ops.sessionId, PASTEUR_DEVICE).credential).toBe("REVOKED");
  });

  it("@AC-FR-PLR-004-04 refuses a retirement reaching back before the suspension in force CONDITION_OVERLAPS", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "SUSPENDED", cause: "moved", effectiveFrom: "2026-10-01T09:00+07:00" });
    const answer = recordCondition(ops, PASTEUR_DEVICE, condition({ condition: "RETIRED", cause: "broken", effectiveFrom: "2026-09-25T09:00+07:00" }));
    expect(answer.refusal?.code).toBe("CONDITION_OVERLAPS");
    const read = record(ops, PASTEUR_DEVICE);
    expect(read.status).toBe("SUSPENDED");
    expect(read.conditions[0]?.status).toBe("SUSPENDED");
  });

  it("@AC-FR-PLR-040-04 refuses a retirement dated before the condition in force CONDITION_OVERLAPS, which the record names", () => {
    const ops = officer();
    const answer = recordCondition(ops, PASTEUR_DEVICE, condition({ condition: "RETIRED", cause: "broken", effectiveFrom: "2026-09-10T09:00+07:00" }));
    expect(answer.refusal).toEqual({ code: "CONDITION_OVERLAPS", field: "effective_from", item: null });
    expect(record(ops, PASTEUR_DEVICE).conditions[0]).toMatchObject({ status: "ACTIVE", pending: false, effectiveTo: null });
  });

  it("@AC-FR-PLR-040-03 refuses a condition with no cause NO_CAUSE", () => {
    const ops = officer();
    const answer = recordCondition(ops, PASTEUR_DEVICE, condition({ condition: "SUSPENDED", effectiveFrom: "2026-10-01T09:00+07:00" }));
    expect(answer.refusal).toEqual({ code: "NO_CAUSE", field: "cause", item: null });
    expect(record(ops, PASTEUR_DEVICE).status).toBe("ACTIVE");
  });

  it("refuses a condition SM-200 does not let follow the one in force, and a member of staff without PERM-473", () => {
    const ops = officer();
    expect(recordCondition(ops, PASTEUR_DEVICE, condition({ condition: "ENROLLED", cause: "checked", effectiveFrom: "2026-10-01T09:00+07:00" })).refusal?.code).toBe("FIELD_INVALID");
    expect(recordCondition(ops, PASTEUR_DEVICE, condition({ condition: "ACTIVE", cause: "checked", effectiveFrom: "2026-10-01T09:00+07:00" })).refusal).toEqual({
      code: "FIELD_INVALID",
      field: "condition",
      item: null,
    });
    const evidenceOnly = beside(ops, PEOPLE.operations, ["ACT-EVD"]);
    expect(recordCondition(evidenceOnly, PASTEUR_DEVICE, condition({ condition: "SUSPENDED", cause: "moved", effectiveFrom: "2026-10-01T09:00+07:00" })).refusal?.code).toBe(
      "NOT_AUTHORISED",
    );
  });

  it("writes the condition to the audit log with its cause, its instants and who recorded it", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "SUSPENDED", cause: "moved", effectiveFrom: "2026-10-01T09:00+07:00" });
    const audit = playerAuditOf(auditor(ops)).data ?? [];
    expect(audit.at(-1)).toMatchObject({
      actor: "Phan Gia Lượng",
      act: "CONDITION_SUSPENDED",
      subject: PASTEUR_DEVICE,
      detail: { condition: "SUSPENDED", cause: "moved", effective_from: new Date("2026-10-01T09:00+07:00").toISOString() },
    });
  });
});

describe("a loss or a compromise (FR-PLR-036)", () => {
  it("@AC-FR-PLR-036-04 refuses a loss report with no reported time NO_REPORTED_TIME, the device unchanged", () => {
    const ops = officer();
    const answer = recordCondition(ops, PASTEUR_DEVICE, condition({ condition: "LOST", cause: "stolen" }));
    expect(answer.refusal).toEqual({ code: "NO_REPORTED_TIME", field: "effective_from", item: null });
    expect(record(ops, PASTEUR_DEVICE).status).toBe("ACTIVE");
    expect(deviceCredentialState(ops.sessionId, PASTEUR_DEVICE).credential).toBe("ACTIVE");
  });

  it("@AC-FR-PLR-036-01 revokes a lost device and quarantines the evidence from the reported time, raising NTF-PLR-03 and 04", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "LOST", cause: "stolen", effectiveFrom: "2026-09-30T06:00+07:00" });
    const read = record(ops, PASTEUR_DEVICE);
    expect(read.status).toBe("LOST");
    // The 431 events accepted from the batch the device sent at 07:02 on 30 September, beside the 4 held before.
    expect(read.held).toBe(435);
    expect(read.disposition).toBe("DSP-0104");
    expect(read.credentialRevokedAt).not.toBeNull();
    expect(deviceCredentialState(ops.sessionId, PASTEUR_DEVICE).credential).toBe("REVOKED");
    const quarantined = plrNotices("evidence_quarantined");
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]).toMatchObject({ recipientPartyId: TCV, facts: { disposition: "DSP-0104", events: 431 } });
    const reported = plrNotices("device_reported_lost_or_compromised");
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ facts: { device: PASTEUR_DEVICE, quarantined: 431 } });
  });

  it("leaves evidence accepted before the reported time where it was", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "LOST", cause: "missing", effectiveFrom: "2026-10-01T09:00+07:00" });
    expect(record(ops, PASTEUR_DEVICE).held).toBe(4);
    expect(plrNotices("evidence_quarantined")[0]?.facts.events).toBe(0);
  });

  it("@AC-FR-PLR-036-02 quarantines from the reported time, not from when the loss was discovered and recorded", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "LOST", cause: "stolen", effectiveFrom: "2026-09-29T08:00+07:00", reportedAt: "2026-10-02T10:00+07:00" });
    const current = record(ops, PASTEUR_DEVICE).conditions[0];
    expect(current).toMatchObject({ status: "LOST", effectiveFrom: new Date("2026-09-29T08:00+07:00").toISOString(), reportedAt: new Date("2026-10-02T10:00+07:00").toISOString() });
    expect(record(ops, PASTEUR_DEVICE).held).toBe(435);
  });

  it("@AC-FR-PLR-036-03 treats a compromised device the same way, recorded by the security officer under that role", () => {
    const ops = officer();
    const officerOfSecurity = security(ops);
    mustRecord(officerOfSecurity, PASTEUR_DEVICE, { condition: "COMPROMISED", cause: "copied", effectiveFrom: "2026-09-30T06:00+07:00" });
    const read = record(ops, PASTEUR_DEVICE);
    expect(read.status).toBe("COMPROMISED");
    expect(read.held).toBe(435);
    expect(read.conditions[0]?.recordedBy).toEqual({ name: "Lê Văn Cường", role: "security" });
    expect(deviceCredentialState(ops.sessionId, PASTEUR_DEVICE).credential).toBe("REVOKED");
  });
});

describe("POST /player/devices/{id}/transfer (FR-PLR-037, 038)", () => {
  const transfer = (values: Partial<ConditionInput>) => condition({ condition: "TRANSFERRED", cause: "branch", premises: "pasteur", effectiveFrom: "2026-10-01T09:00+07:00", ...values });

  it("@AC-FR-PLR-038-03 refuses a transfer of a device holding unsent evidence with no decision PENDING_EVIDENCE_UNDECIDED", () => {
    const ops = officer();
    const answer = recordCondition(ops, LTT_DEVICE, transfer({}));
    expect(answer.refusal).toEqual({ code: "PENDING_EVIDENCE_UNDECIDED", field: "pending_evidence_decision", item: null });
    const read = record(ops, LTT_DEVICE);
    expect(read).toMatchObject({ status: "ACTIVE", premises: { id: "ltt" }, waiting: 614 });
  });

  it("@AC-FR-PLR-038-01 submits the unsent events to the former premises, the decision recorded with the officer and the instant", () => {
    const ops = officer();
    mustRecord(ops, LTT_DEVICE, transfer({ pending: "submit_to_former" }));
    const current = record(ops, LTT_DEVICE).conditions[0];
    expect(current).toMatchObject({
      status: "TRANSFERRED",
      recordedBy: { name: "Phan Gia Lượng", role: "operations" },
      recordedAt: new Date(NOW).toISOString(),
      premisesTo: { id: "pasteur" },
      evidence: { decision: "SUBMITTED_TO_FORMER", count: 614, ground: null, former: { id: "ltt" } },
    });
    const batch = acceptanceView(ops, LTT_DEVICE).data?.batch;
    expect(batch?.outcomes).toEqual([expect.objectContaining({ kind: "ACCEPTED", count: 614 })]);
    expect(playerAuditOf(auditor(ops)).data?.at(-1)?.detail).toMatchObject({ premises_to: "pasteur", pending_evidence_decision: "SUBMITTED_TO_FORMER" });
  });

  it("@AC-FR-PLR-038-02 discards the unsent events by an attributable decision carrying its ground and the count", () => {
    const ops = officer();
    mustRecord(ops, LTT_DEVICE, transfer({ pending: "discard", ground: "Thiết bị ghi trùng giờ phát" }));
    expect(record(ops, LTT_DEVICE).conditions[0]).toMatchObject({
      recordedBy: { name: "Phan Gia Lượng" },
      recordedAt: new Date(NOW).toISOString(),
      evidence: { decision: "DISCARDED", count: 614, ground: "Thiết bị ghi trùng giờ phát", former: { id: "ltt" } },
    });
    expect(acceptanceView(ops, LTT_DEVICE).data?.batch).toBeNull();
    expect(playerAuditOf(auditor(ops)).data?.at(-1)?.detail).toMatchObject({ pending_evidence_decision: "DISCARDED", discard_ground: "Thiết bị ghi trùng giờ phát" });
  });

  it("refuses a discard that carries no ground NO_CAUSE", () => {
    const ops = officer();
    expect(recordCondition(ops, LTT_DEVICE, transfer({ pending: "discard" })).refusal).toEqual({ code: "NO_CAUSE", field: "discard_ground", item: null });
    expect(record(ops, LTT_DEVICE).status).toBe("ACTIVE");
  });

  it("@AC-FR-PLR-037-02 supersedes the snapshot the device held, so none of the former premises' entitlement crosses", () => {
    const ops = officer();
    mustRecord(ops, LTT_DEVICE, transfer({ pending: "submit_to_former" }));
    const read = record(ops, LTT_DEVICE);
    expect(read.snapshot).toEqual({ version: 9, status: "SUPERSEDED" });
    expect(read.paired).toBe(false);
    expect(deviceCredentialState(ops.sessionId, LTT_DEVICE).credential).toBe("REVOKED");
  });

  it("@AC-FR-PLR-037-01 ends the association with the former premises at the effective time, not before", () => {
    const ops = officer();
    mustRecord(ops, LTT_DEVICE, transfer({ pending: "submit_to_former", effectiveFrom: "2026-10-05T14:00+07:00" }));
    expect(record(ops, LTT_DEVICE)).toMatchObject({ status: "ACTIVE", premises: { id: "ltt" }, scheduled: { status: "TRANSFERRED" } });
    at("2026-10-05T14:30:00+07:00");
    const read = record(ops, LTT_DEVICE);
    expect(read).toMatchObject({ status: "TRANSFERRED", premises: { id: "pasteur" }, scheduled: null });
    expect(read.conditions[0]?.evidence?.count).toBe(614);
  });

  it("answers the same transfer asked again with the same result", () => {
    const ops = officer();
    const first = mustRecord(ops, LTT_DEVICE, transfer({ pending: "submit_to_former" }));
    const again = mustRecord(ops, LTT_DEVICE, transfer({ pending: "submit_to_former" }));
    expect(again).toEqual(first);
    expect(record(ops, LTT_DEVICE).conditions.filter((row) => row.status === "TRANSFERRED")).toHaveLength(1);
  });

  it("is the operations officer's alone: the security officer's transfer is refused NOT_AUTHORISED (PERM-474)", () => {
    const ops = officer();
    expect(recordCondition(security(ops), LTT_DEVICE, transfer({ pending: "submit_to_former" })).refusal?.code).toBe("NOT_AUTHORISED");
    expect(record(ops, LTT_DEVICE).status).toBe("ACTIVE");
  });

  it("@AC-FR-PLR-039-02 retires a device and keeps every event it produced, attributable to it, for the auditor", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "RETIRED", cause: "broken", effectiveFrom: "2026-10-01T09:00+07:00" });
    const read = acceptanceView(auditor(ops), PASTEUR_DEVICE).data;
    expect(read?.device.id).toBe(PASTEUR_DEVICE);
    expect(read?.batch?.outcomes.find((outcome) => outcome.kind === "ACCEPTED")?.count).toBe(431);
  });
});

describe("GET /sync/progress, the venue view's synchronisation (SCR-PLR-04)", () => {
  const principal = () => signIn(PEOPLE.principal, { organisation: TCV });

  it("@AC-FR-PLR-027-01 shows a synchronisation at 62 per cent with the remaining size", () => {
    const key = principal();
    expect(syncProgress(key, TCV, PASTEUR_DEVICE).data).toEqual({
      device: PASTEUR_DEVICE,
      state: "IN_PROGRESS",
      snapshot: 12,
      percent: 62,
      receivedMb: 313,
      sizeMb: 504,
      remainingMb: 191,
      resumeFromMb: null,
      playableTracks: 64,
      arrivingTracks: 72,
      lastSynced: "2026-09-30T12:28:00+07:00",
    });
  });

  it("@AC-FR-PLR-027-03 plays from the snapshot held until all of the next has arrived, which then comes into force", () => {
    const key = principal();
    const reads = [1, 2, 3].map(() => syncProgress(key, TCV, PASTEUR_DEVICE).data);
    expect(reads.map((read) => read?.state)).toEqual(["IN_PROGRESS", "IN_PROGRESS", "COMPLETE"]);
    expect(reads.map((read) => read?.playableTracks)).toEqual([64, 64, 72]);
    expect(reads[2]).toMatchObject({ snapshot: 12, percent: 100, remainingMb: 0, lastSynced: new Date(NOW).toISOString() });
    expect(record(staffOf(signInBeside(key, PEOPLE.operations), PEOPLE.operations), PASTEUR_DEVICE).snapshot).toEqual({ version: 12, status: "IN_FORCE" });
  });

  it("@AC-FR-PLR-014-01 shows an interrupted synchronisation with its percentage and where it resumes, never restarting", () => {
    const key = principal();
    const first = syncProgress(key, TCV, LTT_DEVICE).data;
    expect(first).toMatchObject({ state: "INTERRUPTED", percent: 40, receivedMb: 196, resumeFromMb: 196, playableTracks: 64 });
    expect(syncProgress(key, TCV, LTT_DEVICE).data).toEqual(first);
  });

  it("@AC-FR-PLR-024-01 tells a device online and synchronising from one settled, the last synchronisation shown", () => {
    const key = principal();
    expect(venueView(key, TCV, PASTEUR_DEVICE).data).toMatchObject({ condition: "ONLINE", lastSynced: "2026-09-30T12:28:00+07:00" });
    expect(syncProgress(key, TCV, PASTEUR_DEVICE).data?.state).toBe("IN_PROGRESS");
    expect(syncProgress(key, TCV, BUIVIEN_DEVICE).data).toMatchObject({ state: "COMPLETE", snapshot: 7, percent: 100, remainingMb: 0, resumeFromMb: null });
  });

  it("waits where it stopped while nothing reaches the device, its credential held", () => {
    const key = principal();
    const ops = staffOf(signInBeside(key, PEOPLE.operations), PEOPLE.operations);
    expect(suspendCredential(ops, PASTEUR_CREDENTIAL, "Đang kiểm tra").refusal).toBeNull();
    const reads = [1, 2].map(() => syncProgress(key, TCV, PASTEUR_DEVICE).data);
    expect(reads.map((read) => [read?.state, read?.receivedMb, read?.resumeFromMb])).toEqual([
      ["INTERRUPTED", 313, 313],
      ["INTERRUPTED", 313, 313],
    ]);
  });

  it("refuses the principal a device of another party NOT_AUTHORISED", () => {
    expect(syncProgress(principal(), TCV, LINTEL_DEVICE).failure?.code).toBe("NOT_AUTHORISED");
  });

  it("refuses a delegate NOT_AUTHORISED, PERM-481 naming the principal alone, while the venue view answers them", () => {
    const key = signIn(PEOPLE.delegate, { organisation: TCV });
    expect(syncProgress(key, TCV, PASTEUR_DEVICE).failure?.code).toBe("NOT_AUTHORISED");
    expect(venueView(key, TCV, PASTEUR_DEVICE).data?.device.id).toBe(PASTEUR_DEVICE);
  });
});

describe("the offline-continuity policy and DR-218 (SCR-PLR-13)", () => {
  const draft = (staff: Staff, max: string, from: string, grace = "0") =>
    draftOfflinePolicy(staff, { maxOfflineHours: max, exceeded: "STOP", propagation: "NEXT_SYNC", graceHours: grace, effectiveFrom: from });

  it("approves the draft, which governs from its effective date while the interim rule stays in force until then", () => {
    const ops = officer();
    expect(approveOfflinePolicy(ops, 1, "")).toEqual({ accepted: { no: 1, effectiveFrom: "2026-11-01" }, refusal: null });
    const before = offlinePolicy(ops).data;
    expect(before).toMatchObject({ effective: null, draft: null, limitNow: { hours: 72, source: "snapshot", version: null } });
    expect(before?.approved.map((version) => version.no)).toEqual([1]);
    at("2026-11-01T08:00:00+07:00");
    expect(offlinePolicy(ops).data).toMatchObject({ effective: { no: 1, status: "APPROVED", approvedBy: "Phan Gia Lượng" }, limitNow: { hours: 72, source: "policy", version: 1 } });
  });

  it("@AC-FR-PLR-050-01 holds an approved version with its maximum period, exceeded treatment, propagation rule and grace", () => {
    const ops = officer();
    approveOfflinePolicy(ops, 1, "");
    at("2026-11-01T08:00:00+07:00");
    expect(offlinePolicy(ops).data?.effective).toMatchObject({ no: 1, maxOfflineHours: 72, exceeded: "STOP", propagation: "NEXT_SYNC", graceHours: 0, effectiveFrom: "2026-11-01" });
  });

  it("@AC-FR-PLR-029-01 applies the approved policy's maximum to a device gone offline, its time remaining shown", () => {
    at("2026-09-01T09:00:00+07:00");
    const ops = officer();
    draft(ops, "96", "2026-09-15");
    approveOfflinePolicy(ops, 2, "");
    at(NOW);
    const key = signInBeside(ops.sessionId, PEOPLE.principal, TCV);
    // Offline since 06:48 on 28 September, last read at 12:36 on 30 September: 96 hours less 53.8.
    expect(venueView(key, TCV, LTT_DEVICE).data?.offline).toMatchObject({
      limitHours: 96,
      source: "policy",
      version: 2,
      remainingHours: 42.2,
      stopsAt: new Date("2026-10-02T06:48:00+07:00").toISOString(),
    });
  });

  it("@AC-FR-PLR-050-03 applies an approved policy's period over the snapshot's shorter limit, the source recorded as policy", () => {
    at("2026-09-01T09:00:00+07:00");
    const ops = officer();
    expect(draft(ops, "96", "2026-09-15").accepted).toEqual({ no: 2 });
    expect(approveOfflinePolicy(ops, 2, "").refusal).toBeNull();
    at(NOW);
    expect(offlinePolicy(ops).data?.limitNow).toEqual({ hours: 96, source: "policy", version: 2 });
    const key = signInBeside(ops.sessionId, PEOPLE.principal, TCV);
    expect(venueView(key, TCV, LTT_DEVICE).data?.offline?.limitHours).toBe(96);
  });

  it("@AC-FR-PLR-050-02 bounds a session by the version in force when it opened, on the venue view and the estate", () => {
    at("2026-09-01T09:00:00+07:00");
    const ops = officer();
    expect(draft(ops, "48", "2026-09-15").accepted).toEqual({ no: 2 });
    expect(approveOfflinePolicy(ops, 2, "").refusal).toBeNull();
    expect(draft(ops, "96", "2026-10-01").accepted).toEqual({ no: 3 });
    expect(approveOfflinePolicy(ops, 3, "").refusal).toBeNull();
    at(NOW);
    // Both went offline in September, under version 2; a session opening now gets version 3.
    const key = signInBeside(ops.sessionId, PEOPLE.principal, TCV);
    expect(venueView(key, TCV, LTT_DEVICE).data?.offline).toMatchObject({ limitHours: 48, source: "policy", version: 2, stopsAt: new Date("2026-09-30T06:48:00+07:00").toISOString() });
    const lintel = deviceEstate(ops, { device: LINTEL_DEVICE, premises: null, status: null, supplier: null }).data?.rows[0];
    // Offline since 01:40 on 30 September, last reported at 12:36: 48 hours less 10.9.
    expect(lintel?.session).toEqual({ state: "OFFLINE", hoursLeft: 37 });
    expect(offlinePolicy(ops).data?.limitNow).toEqual({ hours: 96, source: "policy", version: 3 });
  });

  it("counts a session against the interim 72 hours while no version is in force, on the venue view and the estate", () => {
    const ops = officer();
    const key = signInBeside(ops.sessionId, PEOPLE.principal, TCV);
    expect(venueView(key, TCV, LTT_DEVICE).data?.offline).toMatchObject({ limitHours: 72, source: "snapshot", version: null, graceHours: 0, remainingHours: 18.2 });
    expect(deviceEstate(ops, { device: LINTEL_DEVICE, premises: null, status: null, supplier: null }).data?.rows[0]?.session).toEqual({ state: "OFFLINE", hoursLeft: 61 });
  });

  it("refuses an approval whose period an approved version already covers EFFECTIVE_PERIOD_OVERLAPS, naming it", () => {
    const ops = officer();
    expect(draft(ops, "48", "2026-12-01").accepted).toEqual({ no: 2 });
    expect(approveOfflinePolicy(ops, 2, "").refusal).toBeNull();
    expect(approveOfflinePolicy(ops, 1, "")).toEqual({ accepted: null, refusal: { code: "EFFECTIVE_PERIOD_OVERLAPS", field: "from", item: 2 } });
    expect(offlinePolicy(ops).data?.draft?.no).toBe(1);
  });

  it("refuses a draft missing one of the four parts POLICY_INCOMPLETE, naming it", () => {
    const ops = officer();
    expect(draft(ops, "", "2026-11-15").refusal).toEqual({ code: "POLICY_INCOMPLETE", field: "max", item: null });
    expect(draft(ops, "72", "2026-11-15", "").refusal).toEqual({ code: "POLICY_INCOMPLETE", field: "grace", item: null });
    expect(draftOfflinePolicy(ops, { maxOfflineHours: "72", exceeded: "", propagation: "NEXT_SYNC", graceHours: "0", effectiveFrom: "2026-11-15" }).refusal?.field).toBe("exceeded");
  });

  it("keeps the approval note in the audit record, and refuses a note of 2,000 characters", () => {
    const ops = officer();
    expect(approveOfflinePolicy(ops, 1, "x".repeat(2000)).refusal).toEqual({ code: "FIELD_INVALID", field: "approval_note", item: null });
    expect(approveOfflinePolicy(ops, 1, "Đã đối chiếu với ý kiến pháp chế").refusal).toBeNull();
    expect(playerAuditOf(auditor(ops)).data?.at(-1)).toMatchObject({
      actor: "Phan Gia Lượng",
      act: "POLICY_VERSION_APPROVED",
      subject: "offline:1",
      note: "Đã đối chiếu với ý kiến pháp chế",
      detail: { version: "1", effective_from: "2026-11-01" },
    });
  });

  it("is the evidence operator's alone: draft and approval are refused NOT_AUTHORISED to an officer without ACT-EVD", () => {
    const other = notEvidence(officer());
    expect(draft(other, "72", "2026-11-15").refusal?.code).toBe("NOT_AUTHORISED");
    expect(approveOfflinePolicy(other, 1, "").refusal?.code).toBe("NOT_AUTHORISED");
    expect(offlinePolicy(other).failure?.code).toBe("NOT_AUTHORISED");
  });
});

describe("the device-assurance policy on the evidence console (SCR-PLR-11)", () => {
  const draft = (staff: Staff, from: string, values: Partial<{ criteria: string; authority: string; validityMonths: string; withdrawal: string }> = {}) =>
    draftAssurancePolicy(staff, {
      criteria: "Thiết bị ký từng sự kiện bằng khoá riêng do RightOne cấp",
      authority: "Hội đồng chứng nhận thiết bị RightOne",
      validityMonths: "24",
      withdrawal: "Khoá riêng bị lộ, hoặc thiết bị không còn đạt tiêu chí 4.2",
      effectiveFrom: from,
      ...values,
    });

  it("@AC-FR-PLR-043-01 holds a drafted version with its criteria, issuing authority, validity and withdrawal grounds", () => {
    const ops = officer();
    expect(draft(ops, "2026-11-01").accepted).toEqual({ no: 3 });
    expect(assuranceConsole(ops).data?.versions[0]).toMatchObject({
      no: 3,
      status: "DRAFT",
      published: false,
      effectiveFrom: "2026-11-01",
      validityMonths: 24,
      criteria: { vi: "Thiết bị ký từng sự kiện bằng khoá riêng do RightOne cấp" },
      authority: { vi: "Hội đồng chứng nhận thiết bị RightOne" },
      withdrawal: { vi: "Khoá riêng bị lộ, hoặc thiết bị không còn đạt tiêu chí 4.2" },
      preparedBy: "Phan Gia Lượng",
    });
  });

  it("refuses a draft with no withdrawal grounds POLICY_VERSION_INCOMPLETE, naming them", () => {
    const ops = officer();
    expect(draft(ops, "2026-11-01", { withdrawal: " " }).refusal).toEqual({ code: "POLICY_VERSION_INCOMPLETE", field: "withdrawal", item: null });
    expect(draft(ops, "2026-11-01", { validityMonths: "0" }).refusal?.field).toBe("validity");
  });

  it("@AC-FR-PLR-032-03 refuses an application citing a version drafted or kept unpublished CRITERIA_VERSION_NOT_PUBLISHED", () => {
    const ops = officer();
    draft(ops, "2026-11-01");
    const apply = () => applyForCertification(ops.sessionId, { applicant: "Âm Thanh Phố Cổ", version: "3" }).refusal?.code;
    expect(apply()).toBe("CRITERIA_VERSION_NOT_PUBLISHED");
    expect(approveAssurancePolicy(ops, 3, false)).toEqual({ accepted: { no: 3, published: false }, refusal: null });
    expect(apply()).toBe("CRITERIA_VERSION_NOT_PUBLISHED");
    expect(assurancePolicy(ops.sessionId, "3").failure?.code).toBe("CRITERIA_VERSION_NOT_PUBLISHED");
  });

  it("@AC-FR-PLR-032-04 refuses an approval whose period overlaps the version in force EFFECTIVE_PERIOD_OVERLAPS, both left as they were", () => {
    const ops = officer();
    draft(ops, "2026-11-01");
    draft(ops, "2026-12-01");
    expect(approveAssurancePolicy(ops, 4, true).refusal).toBeNull();
    expect(approveAssurancePolicy(ops, 3, true)).toEqual({ accepted: null, refusal: { code: "EFFECTIVE_PERIOD_OVERLAPS", field: "from", item: 2 } });
    const versions = assuranceConsole(ops).data?.versions ?? [];
    expect(versions.find((version) => version.no === 3)).toMatchObject({ status: "DRAFT", published: false });
    expect(versions.find((version) => version.no === 2)).toMatchObject({ status: "APPROVED", published: true, effectiveFrom: "2026-04-01", effectiveTo: "2026-12-01", inEffect: true });
  });

  it("@AC-FR-PLR-032-02 publishes an approved version from its day, the version it supersedes still readable with its own period", () => {
    const ops = officer();
    draft(ops, "2026-11-01");
    expect(approveAssurancePolicy(ops, 3, true)).toEqual({ accepted: { no: 3, published: true }, refusal: null });
    at("2026-11-02T09:00:00+07:00");
    expect(assurancePolicy(ops.sessionId, null).data?.version).toMatchObject({ no: 3, inEffect: true, publishedOn: "2026-10-05" });
    expect(assurancePolicy(ops.sessionId, "2").data?.version).toMatchObject({ no: 2, effectiveFrom: "2026-04-01", effectiveTo: "2026-11-01", inEffect: false });
  });

  it("publishes, on a later approval, a version approved and kept unpublished, and records it", () => {
    const ops = officer();
    draft(ops, "2026-11-01");
    approveAssurancePolicy(ops, 3, false);
    expect(approveAssurancePolicy(ops, 3, true)).toEqual({ accepted: { no: 3, published: true }, refusal: null });
    expect(assurancePolicy(ops.sessionId, "3").data?.version.no).toBe(3);
    expect(playerAuditOf(auditor(ops)).data?.at(-1)).toMatchObject({ act: "POLICY_VERSION_PUBLISHED", subject: "assurance:3", actor: "Phan Gia Lượng" });
  });

  it("@AC-FR-PLR-043-04 refuses an application against a published version whose period has not begun POLICY_VERSION_NOT_EFFECTIVE", () => {
    const ops = officer();
    draft(ops, "2026-11-01");
    approveAssurancePolicy(ops, 3, true);
    expect(applyForCertification(ops.sessionId, { applicant: "Âm Thanh Phố Cổ", version: "3" }).refusal?.code).toBe("POLICY_VERSION_NOT_EFFECTIVE");
  });

  it("is the evidence operator's alone: draft and approval are refused NOT_AUTHORISED to an officer without ACT-EVD", () => {
    const ops = officer();
    const other = notEvidence(ops);
    expect(draft(other, "2026-11-01").refusal?.code).toBe("NOT_AUTHORISED");
    draft(ops, "2026-11-01");
    expect(approveAssurancePolicy(other, 3, true).refusal?.code).toBe("NOT_AUTHORISED");
    expect(assuranceConsole(ops).data?.versions[0]).toMatchObject({ no: 3, status: "DRAFT" });
  });
});

describe("the loudness and transition rule set (FR-PLR-045)", () => {
  const draft = (staff: Staff, from: string, premises = "") =>
    draftRuleSet(staff, { loudness: "Chuẩn hoá về -14 LUFS", transitions: "Chuyển bài mờ dần 3 giây", effectiveFrom: from, premises });

  it("@AC-FR-PLR-045-01 holds an approved version with its rules and its effective period, closing the one before it", () => {
    const ops = officer();
    expect(draft(ops, "2026-11-01").accepted).toEqual({ no: 3 });
    expect(approveRuleSet(ops, 3, "Theo biên bản họp ngày 2 tháng 10")).toEqual({ accepted: { no: 3, effectiveFrom: "2026-11-01" }, refusal: null });
    const versions = ruleSetView(ops).data?.versions ?? [];
    expect(versions[0]).toMatchObject({
      no: 3,
      status: "APPROVED",
      loudness: { vi: "Chuẩn hoá về -14 LUFS" },
      transitions: { vi: "Chuyển bài mờ dần 3 giây" },
      effectiveFrom: "2026-11-01",
      effectiveTo: null,
      approvedBy: "Phan Gia Lượng",
      inEffect: false,
    });
    expect(versions[1]).toMatchObject({ no: 2, effectiveTo: "2026-11-01", inEffect: true });
  });

  it("@AC-FR-PLR-045-02 names, for each day's decisions, the version in force on that day", () => {
    const ops = officer();
    draft(ops, "2026-11-01");
    approveRuleSet(ops, 3, "");
    expect(decisionsView(ops, { device: PASTEUR_DEVICE, day: "2026-09-29", kind: null }).data?.rules).toEqual({ version: 2, effectiveFrom: "2026-04-01" });
    expect(decisionsView(ops, { device: PASTEUR_DEVICE, day: "2026-11-02", kind: null }).data?.rules).toEqual({ version: 3, effectiveFrom: "2026-11-01" });
  });

  it("@AC-FR-PLR-022-03 refuses a version set for one premises RULES_NOT_PREMISES_SCOPED", () => {
    const ops = officer();
    expect(draft(ops, "2026-11-01", "pasteur").refusal).toEqual({ code: "RULES_NOT_PREMISES_SCOPED", field: "premises_id", item: null });
    expect(ruleSetView(ops).data?.versions).toHaveLength(1);
  });

  it("refuses a draft with no start day NO_EFFECTIVE_PERIOD", () => {
    const ops = officer();
    expect(draft(ops, "").refusal).toEqual({ code: "NO_EFFECTIVE_PERIOD", field: "from", item: null });
  });

  it("refuses an approval sharing a day with an approved version EFFECTIVE_PERIOD_OVERLAPS, naming it", () => {
    const ops = officer();
    draft(ops, "2026-11-01");
    draft(ops, "2026-12-01");
    expect(approveRuleSet(ops, 4, "").refusal).toBeNull();
    expect(approveRuleSet(ops, 3, "")).toEqual({ accepted: null, refusal: { code: "EFFECTIVE_PERIOD_OVERLAPS", field: "from", item: 2 } });
    expect(ruleSetView(ops).data?.versions.find((version) => version.no === 3)?.status).toBe("DRAFT");
  });

  it("is the evidence operator's alone: draft and approval are refused NOT_AUTHORISED to an officer without ACT-EVD", () => {
    const ops = officer();
    const other = notEvidence(ops);
    expect(draft(other, "2026-11-01").refusal?.code).toBe("NOT_AUTHORISED");
    draft(ops, "2026-11-01");
    expect(approveRuleSet(other, 3, "").refusal?.code).toBe("NOT_AUTHORISED");
  });
});

describe("what PLR records and raises beside the acts", () => {
  it("raises NTF-PLR-05 through COM when a certification is refused, and audits the assessment", () => {
    const ops = officer();
    expect(assessCertification(ops, "CRT-MH2Q7VKA5N", { outcome: "refused", criterion: "4.2" }).accepted).toEqual({ status: "REFUSED" });
    const refused = plrNotices("certification_refused");
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ facts: { supplier: "Mái Hiên Sound", version: 2, criterion: "4.2" } });
    expect(playerAuditOf(auditor(ops)).data?.at(-1)).toMatchObject({
      act: "CERTIFICATION_ASSESSED",
      subject: "CRT-MH2Q7VKA5N",
      detail: { applicant: "Mái Hiên Sound", version: "2", outcome: "REFUSED", criterion: "4.2" },
    });
  });

  it("issues NTF-PLR-04 and NTF-PLR-05 to the office COM's contact register names for each class, rather than leaving them UNMET", () => {
    const ops = officer();
    mustRecord(ops, PASTEUR_DEVICE, { condition: "LOST", cause: "stolen", effectiveFrom: "2026-09-30T06:00+07:00" });
    expect(assessCertification(ops, "CRT-MH2Q7VKA5N", { outcome: "refused", criterion: "4.2" }).refusal).toBeNull();
    const queue = (classCode: string) => noticeQueue(ops.sessionId, { name: ops.account, roles: ["ACT-OPS"] }, { classCode, state: null, dueFrom: null, dueTo: null }, null).data?.rows ?? [];
    for (const [kind, classCode] of [
      ["device_reported_lost_or_compromised", "device_loss_alert"],
      ["certification_refused", "certification_refusal"],
    ] as const) {
      expect(plrNotices(kind)[0]).toMatchObject({ recipientPartyId: null, destination: officeDestinationOf(ops.sessionId, kind) });
      expect(plrNotices(kind)[0]?.destination).not.toBeNull();
      const rows = queue(classCode);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.state).not.toBe("UNMET");
      expect(rows[0]?.issuedAt).not.toBeNull();
    }
  });

  it("audits an enrolment with the device identity, the premises, the supplier and who enrolled it", () => {
    const ops = officer();
    const answer = enrolDevice(ops, { identity: "dev-ab12-cd", supplier: "Hạt Âm Devices", premises: "pasteur" });
    expect(answer.refusal).toBeNull();
    expect(playerAuditOf(auditor(ops)).data?.at(-1)).toMatchObject({
      actor: "Phan Gia Lượng",
      act: "DEVICE_ENROLLED",
      subject: answer.accepted?.device,
      detail: { device_identity: "dev-ab12-cd", premises: "pasteur", supplier: "Hạt Âm Devices" },
    });
  });

  it("@AC-FR-PLR-003-05 refuses an identity already enrolled DEVICE_ALREADY_ENROLLED, naming the device whose record holds its premises", () => {
    const ops = officer();
    const total = deviceEstate(ops, { device: null, premises: null, status: null, supplier: null }).data?.total;
    expect(enrolDevice(ops, { identity: "DEV-4A9C-23", supplier: "Hạt Âm Devices", premises: "nh" }).refusal).toEqual({ code: "DEVICE_ALREADY_ENROLLED", field: PASTEUR_DEVICE, item: null });
    expect(record(ops, PASTEUR_DEVICE)).toMatchObject({ premises: { id: "pasteur" }, status: "ACTIVE" });
    expect(deviceEstate(ops, { device: null, premises: null, status: null, supplier: null }).data?.total).toBe(total);
  });

  it("refuses an enrolment by a member of staff without PERM-470 NOT_AUTHORISED, writing no device", () => {
    const ops = officer();
    const evidenceOnly = beside(ops, PEOPLE.operations, ["ACT-EVD"]);
    const estate = () => deviceEstate(ops, { device: null, premises: null, status: null, supplier: null }).data?.total;
    const total = estate();
    expect(enrolDevice(evidenceOnly, { identity: "dev-ab12-cd", supplier: "Hạt Âm Devices", premises: "pasteur" }).refusal?.code).toBe("NOT_AUTHORISED");
    expect(estate()).toBe(total);
  });

  it("keeps its audit log from a member of staff who is neither the auditor nor the security officer", () => {
    expect(playerAuditOf(officer()).failure?.code).toBe("NOT_AUTHORISED");
  });
});
