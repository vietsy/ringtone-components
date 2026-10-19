import { afterEach, describe, expect, it, vi } from "vitest";
import type { Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import {
  credentialRecord,
  deviceCredentialState,
  identityRecordsOf,
  issuePairing,
  pairingStep,
  reinstateCredential,
  revokeCredential,
} from "@/lib/mock/backend/player";
import { approvePolicyVersion, preparePolicyVersion } from "@/lib/mock/backend/notices";
import { recordPremisesChange } from "@/lib/mock/backend/premises";
import { sessions } from "@/lib/mock/backend/store";
import { PEOPLE, signIn, signInBeside } from "./harness";

/*
 * IAM's pairing authorisations (SCR-IAM-06) and device credentials (SCR-IAM-07, 08), as Then Cửa Việt's principal Đỗ
 * Thu Trang and the operations officer Phan Gia Lượng use them; Lê Văn Cường, the security officer and auditor, reads
 * what IAM recorded. Pasteur (PRM-5PSR9VJA) holds DCR-3HWT6KQZ9P, Đa Kao (PRM-4DKX7WNP) DCR-7K2MQXB4TA, and the Áp Mái
 * Bar credential DCR-7D40HQXA2G has been suspended since 28 September, before its operator changed on 1 October.
 */

const PASTEUR = "PRM-5PSR9VJA";
const DAKAO = "PRM-4DKX7WNP";
const LINTEL = "PTY-127730";

afterEach(() => {
  vi.useRealTimers();
});

function staffOf(sessionId: string, email: string): Staff {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

/** What IAM recorded in the world, as the security officer beside reads it. */
function records(key: string) {
  const read = identityRecordsOf(staffOf(signInBeside(key, PEOPLE.supervisor), PEOPLE.supervisor)).data;
  if (read === null) throw new Error("the security officer could not read IAM's records");
  return read;
}

/**
 * The P1 world the revocation's criterion below starts from, in which COM cannot raise the notice: a COM notice policy
 * version in force from today that states no class at all, prepared by operations and approved by the business approver.
 */
function comCannotRaise(key: string): void {
  const officerOf = (email: string) => {
    const account = findAccount(email);
    if (account === null) throw new Error(`no seed account ${email}`);
    return { name: account.name, roles: account.staffRoles };
  };
  const prepared = preparePolicyVersion(key, officerOf(PEOPLE.operations), { effectiveFrom: dayFromToday(0), effectiveTo: null, unreadable: false, restate: false });
  expect(approvePolicyVersion(key, officerOf(PEOPLE.approver), prepared.accepted?.versionNo ?? 0, "").refusal).toBeNull();
}

const issue = (key: string, premises = "pasteur", purpose = "PLAYBACK") => issuePairing(key, "tcv", premises, purpose);
const codes = (key: string, premises = "pasteur") => pairingStep(key, "tcv", premises).data?.items ?? [];
const worldOf = (key: string) => sessions().get(key)?.world ?? "";

/** The Vietnam day `days` after today, as the register takes an effective date. */
function dayFromToday(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function recordChange(key: string, record: string, cause: string, effectiveOn: string, incoming = "") {
  const officer = staffOf(signInBeside(key, PEOPLE.operations), PEOPLE.operations);
  const answer = recordPremisesChange(officer, record, { cause, effectiveOn, effectiveOnText: effectiveOn, incoming, checkedFor: null });
  expect(answer.refusal).toBeNull();
}

describe("POST /identity/pairing-authorisations", { timeout: 60_000 }, () => {
  it("@AC-FR-IAM-009-01 issues a code for fifteen minutes and one use, the record naming the premises, the purpose and who asked", () => {
    const key = signIn(PEOPLE.principal);
    const answer = issue(key);
    expect(answer.refusal).toBeNull();
    expect(answer.accepted?.value).toMatch(/^[2-9A-HJKMNP-TV-Z]{4} [2-9A-HJKMNP-TV-Z]{4} [2-9A-HJKMNP-TV-Z]{4}$/);
    const row = codes(key).find((item) => item.id === answer.accepted?.id);
    expect(row).toMatchObject({ premises: { id: "pasteur" }, purpose: "PLAYBACK", state: "ISSUED", issuedBy: { name: "Đỗ Thu Trang", actor: "PRINCIPAL" } });
    expect(Date.parse(row?.expiresAt ?? "") - Date.parse(row?.issuedAt ?? "")).toBe(15 * 60 * 1000);
    expect(records(key).audit.at(-1)).toMatchObject({ action: "PAIRING_ISSUED", actor: "Đỗ Thu Trang", target: answer.accepted?.id, outcome: "performed" });
  });

  it("raises NTF-IAM-01 through COM with the premises, the purpose, the expiry and who asked, never the code", () => {
    const key = signIn(PEOPLE.principal);
    const value = issue(key).accepted?.value ?? "";
    const notice = records(key).notices.at(-1);
    // COM's policy in force states a class for the issue (`pairing_authorisation`), so the notice is COM's to send.
    expect(notice).toMatchObject({ notice: "NTF-IAM-01", delivery: "RAISED", attempts: 1, facts: { purpose: "PLAYBACK", asked: "Đỗ Thu Trang" } });
    expect(notice?.reference).toMatch(/^COM-/);
    expect(notice?.facts.premises).not.toBe("");
    expect(JSON.stringify(notice)).not.toContain(value.replace(/\s/g, "").slice(0, 4));
  });

  it("answers the fifth attempt from one origin on its merits, counting the refused attempts before it", () => {
    const key = signIn(PEOPLE.principal);
    for (let n = 0; n < 4; n += 1) expect(issue(key, "pasteur", "KIOSK").refusal?.code).toBe("FIELD_INVALID");
    expect(issue(key).refusal).toBeNull();
    expect(issue(key).refusal?.code).toBe("PAIRING_RATE_LIMIT_EXCEEDED");
  });

  it("@AC-FR-IAM-010-03 refuses the sixth attempt inside ten minutes whatever it asks, issues nothing, and records the origin and the count", () => {
    const key = signIn(PEOPLE.principal);
    for (let n = 0; n < 5; n += 1) expect(issue(key).refusal).toBeNull();
    const before = codes(key).length;
    // A request that would be issued and one that would be refused on its merits read the same.
    expect(issue(key).refusal).toEqual({ code: "PAIRING_RATE_LIMIT_EXCEEDED", field: null, item: null });
    expect(issue(key, "pasteur", "KIOSK").refusal).toEqual({ code: "PAIRING_RATE_LIMIT_EXCEEDED", field: null, item: null });
    expect(codes(key)).toHaveLength(before);
    const refused = records(key).refusals.filter((row) => row.reasonCode === "PAIRING_RATE_LIMIT_EXCEEDED");
    expect(refused.map((row) => [row.origin, row.count])).toEqual([
      [worldOf(key), 6],
      [worldOf(key), 7],
    ]);
    expect(records(key).notices.filter((notice) => notice.notice === "NTF-IAM-01")).toHaveLength(5);
  });

  it("answers again once the attempts are ten minutes old, and from another browser at once", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T10:00:00+07:00"));
    const key = signIn(PEOPLE.principal);
    for (let n = 0; n < 5; n += 1) issue(key);
    expect(issue(key).refusal?.code).toBe("PAIRING_RATE_LIMIT_EXCEEDED");
    expect(issue(signIn(PEOPLE.principal)).refusal).toBeNull();
    vi.setSystemTime(new Date("2026-10-17T10:10:01+07:00"));
    expect(issue(key).refusal).toBeNull();
  });

  it("records a refused issue against the person who asked, with the premises asked for, and raises no notice", () => {
    const key = signIn(PEOPLE.delegate);
    expect(issue(key).refusal?.code).toBe("AUTHORITY_NOT_IN_FORCE");
    const read = records(key);
    expect(read.refusals.at(-1)).toMatchObject({ reasonCode: "AUTHORITY_NOT_IN_FORCE", actor: "Hầu Ngọc Ánh", premisesId: "pasteur", count: 1 });
    expect(read.notices).toEqual([]);
    expect(read.audit).toEqual([]);
  });

  it("asks no verified address of the person issuing a code, since CFG-193 names only asking to be linked in P1", () => {
    const account = findAccount(PEOPLE.principal);
    if (account === null) throw new Error("no principal");
    const key = signIn(PEOPLE.principal);
    account.state = "unconfirmed";
    try {
      expect(issue(key).refusal).toBeNull();
    } finally {
      account.state = "active";
    }
  });

  it("is read by the security officer and the auditor alone", () => {
    const key = signIn(PEOPLE.operations);
    expect(identityRecordsOf(staffOf(key, PEOPLE.operations)).failure?.code).toBe("AUTHORITY_NOT_IN_FORCE");
  });
});

describe("device credentials", { timeout: 60_000 }, () => {
  it("@AC-FR-IAM-008-07 revokes with its cause and keeps NTF-IAM-02 as issued and undelivered, nothing waiting on it", () => {
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    comCannotRaise(key);
    expect(revokeCredential(officer, "DCR-7K2MQXB4TA", "Thiết bị hỏng không sửa được", "").accepted).toEqual({ state: "REVOKED" });
    expect(credentialRecord(officer, "DCR-7K2MQXB4TA").data).toMatchObject({ state: "REVOKED", revocation: { by: "Phan Gia Lượng" } });
    expect(deviceCredentialState(key, "PLY-0035")).toEqual({ credential: "REVOKED", delivery: "STOPPED" });
    expect(records(key).notices.at(-1)).toMatchObject({
      notice: "NTF-IAM-02",
      delivery: "UNDELIVERED",
      attempts: 1,
      facts: { device: "PLY-0035", event: "OFFICER" },
    });
  });

  it("@AC-FR-IAM-008-04 refuses to remove a revoked device's evidence, leaves it as it was, and records the refusal against the officer", () => {
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    revokeCredential(officer, "DCR-7K2MQXB4TA", "Thiết bị hỏng", "");
    const accepted = credentialRecord(officer, "DCR-7K2MQXB4TA").data?.accepted;
    expect(revokeCredential(officer, "DCR-7K2MQXB4TA", "Xoá dữ liệu cũ", "", "REMOVE").refusal?.code).toBe("EVIDENCE_RETENTION_IN_FORCE");
    expect(credentialRecord(officer, "DCR-7K2MQXB4TA").data?.accepted).toBe(accepted);
    expect(records(key).audit.at(-1)).toMatchObject({ action: "EVIDENCE_CHANGE", actor: "Phan Gia Lượng", outcome: "refused", detail: { code: "EVIDENCE_RETENTION_IN_FORCE", asked: "REMOVE" } });
  });

  it("@AC-FR-IAM-021-03 revokes and refuses the amendment to the evidence asked in the same request, recording it on its own", () => {
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    expect(revokeCredential(officer, "DCR-9E15TQWZ3B", "Thiết bị bị thay", "", "AMEND").refusal?.code).toBe("EVIDENCE_RETENTION_IN_FORCE");
    expect(credentialRecord(officer, "DCR-9E15TQWZ3B").data?.state).toBe("REVOKED");
    expect(records(key).audit.map((row) => [row.action, row.outcome])).toEqual([
      ["CREDENTIAL_REVOKED", "performed"],
      ["EVIDENCE_CHANGE", "refused"],
    ]);
  });

  it("refuses an effective time that is no time at all, revoking nothing", () => {
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    expect(revokeCredential(officer, "DCR-9E15TQWZ3B", "Thiết bị bị thay", "không phải ngày").refusal).toEqual({ code: "FIELD_INVALID", field: "effective_at", item: null });
    expect(credentialRecord(officer, "DCR-9E15TQWZ3B").data?.state).toBe("ACTIVE");
  });

  it("@AC-FR-IAM-008-06 refuses to reinstate a credential held across the end of its relationship, keeps it suspended and records the end", () => {
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    expect(reinstateCredential(officer, "DCR-7D40HQXA2G", "Đã kiểm tra lại").refusal?.code).toBe("PREMISES_RELATIONSHIP_ENDED");
    expect(credentialRecord(officer, "DCR-7D40HQXA2G").data?.state).toBe("SUSPENDED");
    expect(records(key).audit.at(-1)).toMatchObject({
      action: "CREDENTIAL_REINSTATED",
      actor: "Phan Gia Lượng",
      outcome: "refused",
      detail: { code: "PREMISES_RELATIONSHIP_ENDED", cause: "OPERATOR_CHANGE" },
    });
  });
});

describe("a premises relationship that ends revokes its credentials (FR-IAM-020)", { timeout: 60_000 }, () => {
  it("@AC-FR-IAM-020-01 revokes the credentials of a change of operator from its effective day, naming the change", () => {
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    recordChange(key, DAKAO, "OPERATOR_CHANGE", dayFromToday(0), LINTEL);
    const record = credentialRecord(officer, "DCR-7K2MQXB4TA").data;
    expect(record).toMatchObject({ state: "REVOKED", revocation: { by: null, cause: { en: "The premises changed operator, as the premises register records" } } });
    expect(Date.parse(record?.since ?? "")).toBe(Date.parse(`${dayFromToday(0)}T00:00:00+07:00`));
    expect(records(key).notices.at(-1)).toMatchObject({ notice: "NTF-IAM-02", facts: { device: "PLY-0035", event: "OPERATOR_CHANGE" } });
  });

  it("@AC-FR-IAM-020-02 revokes on a closure's effective day and not the day before", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T10:00:00+07:00"));
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    recordChange(key, PASTEUR, "CLOSURE", "2026-10-18");
    expect(credentialRecord(officer, "DCR-3HWT6KQZ9P").data?.state).toBe("ACTIVE");
    expect(deviceCredentialState(key, "PLY-0023").credential).toBe("ACTIVE");
    vi.setSystemTime(new Date("2026-10-18T08:00:00+07:00"));
    const record = credentialRecord(officer, "DCR-3HWT6KQZ9P").data;
    expect(record).toMatchObject({ state: "REVOKED", revocation: { cause: { en: "The premises closed, as the premises register records" } } });
    expect(Date.parse(record?.since ?? "")).toBe(Date.parse("2026-10-18T00:00:00+07:00"));
  });

  it("revokes the active credential of a premises that ceases, leaves another premises' alone, and refuses a later revocation", () => {
    const key = signIn(PEOPLE.operations);
    const officer = staffOf(key, PEOPLE.operations);
    recordChange(key, "PRM-6BVK3RQT", "CESSATION", dayFromToday(0));
    expect(credentialRecord(officer, "DCR-9E15TQWZ3B").data).toMatchObject({ state: "REVOKED", revocation: { cause: { en: "The premises ceased trading, as the premises register records" } } });
    // The credential the theft revoked in September keeps its own cause.
    expect(credentialRecord(officer, "DCR-8F21MZKT5H").data?.revocation?.cause.en).toBe("Reported stolen by the premises principal");
    expect(credentialRecord(officer, "DCR-7K2MQXB4TA").data?.state).toBe("ACTIVE");
    expect(revokeCredential(officer, "DCR-9E15TQWZ3B", "Kết thúc", "").refusal?.code).toBe("DEVICE_CREDENTIAL_REVOKED");
  });
});
