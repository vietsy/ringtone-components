import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConclusionAttempt, ScannedCode } from "@/lib/api/inspection";
import { findAccount } from "@/lib/mock/backend/accounts";
import { caseRead, caseRemedyFor, lodgeAppeal, recordAppealOutcome } from "@/lib/mock/backend/cases";
import {
  authorityWorkOf,
  carryAnswerIntoInspection,
  challengeSnapshotFor,
  checkOffline,
  chooseActingFor,
  concludeInspection,
  conclusionOf,
  correctRecord,
  endAppointment,
  inspectionOf,
  inspectionRecordOf,
  openInspection,
  premisesRecordOf,
  premisesRecordsOf,
  receiveOfflineResult,
  reconsiderationOf,
  recordDelivery,
  refreshVerificationKeys,
  requestReconsideration,
  scanAndVerifyOf,
  scanCode,
  suspendAppointment,
  uploadOfflineResult,
  verificationAnswerOf,
  verify,
} from "@/lib/mock/backend/inspection";
import { today } from "@/lib/mock/backend/clock";
import { noticeStateOf, noticesTo } from "@/lib/mock/backend/notices";
import { verifyCertificate } from "@/lib/mock/backend/public";
import { createRepresentation, decideReview, publishedRecord, registerKey, retireKey, revokeKey } from "@/lib/mock/backend/status-records";
import { sessions } from "@/lib/mock/backend/store";
import { PEOPLE, signIn, signInBeside } from "./harness";

/*
 * VER, played by the mock backend: the inspector route reads CER's live register and keys, a scanned code is
 * authenticated by its signature, a result checked offline is uploaded and checked again, a record carries the limits
 * of the answers it cites, is raised to the party through COM and opens its referral's case in CAS, and a challenge
 * carries what its subject showed. The inspector holds KTVH-KV1 (Sài Gòn, Bến Thành, Tân Định, Cầu Ông Lãnh) and
 * KTVH-KV3 (Xuân Hoà, where Pasteur is); the phone acts for KV1 until told otherwise.
 */

const PASTEUR_RECORD = "R1-CER-2026-T7QM4BWJ";
const PASTEUR_PRINTOUT = "CRP-4WTN8QHC2K";
const PASTEUR_INSPECTION = "ISP-2QK7TM4W8E";
const HEM_214_INSPECTION = "ISP-5H3WQ8KM2A";
const SECURITY = { name: "Lê Văn Cường", position: "Cán bộ giám sát", roles: ["ACT-SEC" as const] };
const APPROVER = { name: "Thạch Minh Khải", position: "Người duyệt nghiệp vụ", roles: ["ACT-BIZ-APR" as const] };
const OPERATIONS = { name: "Phan Gia Lương", email: PEOPLE.operations, roles: ["ACT-OPS" as const] };
const TCV = { party: "tcv", name: "Đỗ Thu Trang" };

// A world is seeded on its first read in each test, across several families: slower than one family's call.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.useRealTimers();
});

/** The inspector signed in, acting for KTVH-KV3, whose jurisdiction holds Pasteur. */
function atPasteur(): string {
  const session = signIn(PEOPLE.inspector);
  chooseActingFor(session, "kv3");
  return session;
}

function answerOf(session: string, reference: string) {
  const read = verificationAnswerOf(session, reference);
  if (read.data === null) throw new Error(`answer ${reference}: ${read.failure?.code ?? ""}`);
  return read.data;
}

function codeOf(session: string, printout: string): ScannedCode {
  const read = scanCode(session, printout);
  if (read.data === null) throw new Error(`no code on ${printout}`);
  return read.data;
}

/** A code whose payload was altered after it was signed: the period runs two years longer. */
function altered(code: ScannedCode): ScannedCode {
  const body = JSON.parse(Buffer.from(code.payload, "base64url").toString("utf8")) as Record<string, unknown>;
  return { ...code, payload: Buffer.from(JSON.stringify({ ...body, to: "2029-02-28" })).toString("base64url") };
}

const conclusion = (over: Partial<Omit<ConclusionAttempt, "refusal" | "notSent">> = {}): Omit<ConclusionAttempt, "refusal" | "notSent"> => ({
  outcome: "COMPLIANT",
  guidance: "",
  route: "CASE_FOLLOW_UP",
  referralNote: "",
  representativeRole: "MANAGER",
  acknowledgement: "ACKNOWLEDGED",
  statement: "",
  delayReason: "",
  followUp: "NONE",
  followUpBy: "",
  ...over,
});

/** A day some days from now, as a date field sends it. */
const daysAhead = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** An inspection of Pasteur opened from a verification of its record, observed at the instant given. */
function openAtPasteur(session: string, observedAt: string, delayReason = ""): string {
  carryAnswerIntoInspection(session, verify(session, { value: PASTEUR_RECORD, identifierType: null, inspection: null, code: null }).data?.answer ?? "");
  const opened = openInspection(session, { withAnswer: true, locationContext: "REGISTER_ADDRESS", purpose: "ROUTINE", basis: "", observedAt, delayReason });
  if (opened.data === null) throw new Error(`not opened: ${opened.failure?.code ?? ""}`);
  return opened.data.inspection;
}

/** Nothing found, with nobody of the premises present. */
const nobodyPresent = conclusion({ outcome: "NOTHING_FOUND", acknowledgement: "NO_REPRESENTATIVE_PRESENT", representativeRole: null });

describe("the inspector route reads CER's live register", () => {
  it("answers a printout CER makes in the session, and says the one it replaces is superseded, as the public route does", () => {
    const session = atPasteur();
    const made = createRepresentation(session, null, PASTEUR_RECORD).data?.printout ?? "";
    const fresh = answerOf(session, verify(session, { value: made, identifierType: null, inspection: null, code: null }).data?.answer ?? "");
    const old = answerOf(session, verify(session, { value: PASTEUR_PRINTOUT, identifierType: null, inspection: null, code: null }).data?.answer ?? "");
    expect(fresh.outcome).toMatchObject({ kind: "CURRENT_RESULT", state: "IN_FORCE", record: PASTEUR_RECORD, representationCurrent: true });
    expect(old.outcome).toMatchObject({ kind: "CURRENT_RESULT", record: PASTEUR_RECORD, representationCurrent: false });
    expect(publishedRecord(session, made)?.reference).toBe(PASTEUR_RECORD);
  });

  it("answers NO_RECORD for a reference CER does not hold, as the public route answers it absent", () => {
    const session = signIn(PEOPLE.inspector);
    const answer = answerOf(session, verify(session, { value: "R1-CER-2026-V8JD3MRA", identifierType: null, inspection: null, code: null }).data?.answer ?? "");
    expect(answer.outcome).toEqual({ kind: "NO_RECORD" });
    expect(publishedRecord(session, "R1-CER-2026-V8JD3MRA")).toBeNull();
  });

  it("reads the record current for a premises named by its register reference, within the jurisdiction only", () => {
    const session = atPasteur();
    const inKv3 = answerOf(session, verify(session, { value: "PRM-5PSR9VJA", identifierType: null, inspection: null, code: null }).data?.answer ?? "");
    chooseActingFor(session, "kv1");
    const inKv1 = answerOf(session, verify(session, { value: "PRM-5PSR9VJA", identifierType: null, inspection: null, code: null }).data?.answer ?? "");
    expect(inKv3.outcome).toMatchObject({ kind: "CURRENT_RESULT", record: PASTEUR_RECORD, premises: { name: "Then Cửa Coffee & Tea – Pasteur" } });
    expect(inKv1.outcome).toEqual({ kind: "NO_PREMISES_IN_JURISDICTION" });
  });

  it("answers a certificate suspended in the session as suspended, as the public route does", () => {
    const session = atPasteur();
    // The approver decides the suspension CER's review of Pasteur proposed.
    expect(decideReview(session, APPROVER, "CSR-4TN7QK2MVD", { decision: "APPROVE", reason: "" }).failure).toBeNull();
    const world = sessions().get(session)?.world ?? "";
    expect(verifyCertificate(PASTEUR_RECORD, "198.51.100.30", world).data?.record?.status).toBe("suspended");
    const answer = answerOf(session, verify(session, { value: PASTEUR_RECORD, identifierType: null, inspection: null, code: null }).data?.answer ?? "");
    expect(answer.outcome).toMatchObject({ kind: "CURRENT_RESULT", state: "SUSPENDED", record: PASTEUR_RECORD });
  });

  it("@AC-FR-VER-025-02 reads a stored answer back as it was given, with the identifier presented, nothing recomputed", () => {
    const session = atPasteur();
    const reference = verify(session, { value: PASTEUR_PRINTOUT, identifierType: null, inspection: null, code: null }).data?.answer ?? "";
    // CER prints a newer copy afterwards: the stored answer still shows what it showed.
    createRepresentation(session, null, PASTEUR_RECORD);
    const read = answerOf(session, reference);
    expect(read.identifier).toEqual({ type: "REPRESENTATION_REFERENCE", value: PASTEUR_PRINTOUT });
    expect(read.outcome).toMatchObject({ kind: "CURRENT_RESULT", representationCurrent: true });
  });
});

describe("signed codes and verification keys (FR-VER-017)", () => {
  it("verifies a genuine scanned code against CER's keys and reads its record", () => {
    const session = atPasteur();
    const reference = verify(session, { value: PASTEUR_PRINTOUT, identifierType: null, inspection: null, code: codeOf(session, PASTEUR_PRINTOUT) }).data?.answer ?? "";
    expect(answerOf(session, reference).outcome).toMatchObject({ kind: "CURRENT_RESULT", state: "IN_FORCE", record: PASTEUR_RECORD });
  });

  it("@AC-FR-VER-017-03 answers NOT_AUTHENTICATED online for a code whose signature does not verify, and stores the answer", () => {
    const session = atPasteur();
    const reference = verify(session, { value: PASTEUR_PRINTOUT, identifierType: null, inspection: null, code: altered(codeOf(session, PASTEUR_PRINTOUT)) }).data?.answer;
    expect(reference).toMatch(/^VRA-/);
    expect(answerOf(session, reference ?? "").outcome).toEqual({ kind: "NOT_AUTHENTICATED", reason: "SIGNATURE_NOT_VERIFIED" });
  });

  it("@AC-FR-VER-017-05 does not authenticate a code issued after its key stopped signing KEY_NOT_VALID_AT_ISSUE", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = atPasteur();
    const code = codeOf(session, PASTEUR_PRINTOUT);
    const real = Date.now();
    // CER retires CK-2026-01 on 12 September 2026; Pasteur's printout says it was signed under it on the 19th.
    vi.setSystemTime(new Date("2026-09-12T09:00:00+07:00"));
    const jwk = JSON.stringify(generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ format: "jwk" }));
    expect(registerKey(session, SECURITY, { kid: "CK-2026-02", handle: "hsm/ck-2026-02", jwk, validFrom: new Date(Date.now() + 1000).toISOString() }).failure).toBeNull();
    vi.setSystemTime(Date.now() + 5000);
    expect(retireKey(session, SECURITY, "CK-2026-01").failure).toBeNull();
    vi.setSystemTime(real);
    const reference = verify(session, { value: PASTEUR_PRINTOUT, identifierType: null, inspection: null, code }).data?.answer ?? "";
    expect(answerOf(session, reference).outcome).toEqual({ kind: "NOT_AUTHENTICATED", reason: "KEY_NOT_VALID_AT_ISSUE" });
  });

  it("refuses PAYLOAD_REFERENCE_MISMATCH when the reference sent is not the one the code signs", () => {
    const session = atPasteur();
    const sent = verify(session, { value: "R1-CER-2026-K9TE4WQC", identifierType: null, inspection: null, code: codeOf(session, PASTEUR_PRINTOUT) });
    expect(sent.failure?.code).toBe("PAYLOAD_REFERENCE_MISMATCH");
  });

  it("answers the camera with no code for a printout CER never made", () => {
    const session = atPasteur();
    expect(scanCode(session, "CRP-7QX2M4KD9A").failure?.code).toBe("NO_CODE_READ");
  });

  it("serves CER's key set on refresh: a key revoked on the console leaves the phone's set", () => {
    const session = atPasteur();
    expect(refreshVerificationKeys(session).data?.keys).toEqual(["CK-2026-01", "CK-2027-01"]);
    revokeKey(session, SECURITY, "CK-2027-01", "Khoá bị lộ");
    expect(refreshVerificationKeys(session).data?.keys).toEqual(["CK-2026-01"]);
  });

  it("@AC-FR-VER-017-07 refuses the refresh KEYS_UNAVAILABLE while CER publishes no key, and the phone keeps its keys", () => {
    const session = atPasteur();
    const before = scanAndVerifyOf(session, null).data?.device.verificationKey;
    revokeKey(session, SECURITY, "CK-2026-01", "Khoá bị lộ");
    revokeKey(session, SECURITY, "CK-2027-01", "Khoá bị lộ");
    expect(refreshVerificationKeys(session).failure?.code).toBe("KEYS_UNAVAILABLE");
    expect(scanAndVerifyOf(session, null).data?.device.verificationKey).toEqual(before);
  });
});

describe("a check without a network, and its upload (FR-VER-004, FR-VER-017)", () => {
  it("@AC-FR-VER-004-01 states the payload, its issue instant and the keys' refresh, and waits to upload", () => {
    const session = atPasteur();
    const result = checkOffline(session, { printout: PASTEUR_PRINTOUT, code: codeOf(session, PASTEUR_PRINTOUT), inspection: null }).data?.result ?? "";
    const read = answerOf(session, result);
    expect(read.reference).toBeNull();
    expect(read.outcome).toMatchObject({ kind: "LIMITED_OFFLINE", record: PASTEUR_RECORD, printedState: "IN_FORCE", printedAt: "2026-09-19T08:30:00+07:00", keyId: "CK-2026-01" });
    expect(scanAndVerifyOf(session, null).data?.waiting[0]).toMatchObject({ id: result, representation: PASTEUR_PRINTOUT, outcome: "LIMITED_OFFLINE" });
  });

  it("@AC-FR-VER-004-03 gives no offline answer once the keys are older than 7 days", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = atPasteur();
    const code = codeOf(session, PASTEUR_PRINTOUT);
    vi.setSystemTime(Date.now() + 8 * 86_400_000);
    const result = checkOffline(session, { printout: PASTEUR_PRINTOUT, code, inspection: null }).data?.result ?? "";
    expect(answerOf(session, result).outcome).toEqual({ kind: "UNABLE_TO_VERIFY", cause: "NO_KEY" });
  });

  it("@AC-FR-VER-017-02 does not authenticate offline a code altered after it was signed", () => {
    const session = atPasteur();
    const result = checkOffline(session, { printout: PASTEUR_PRINTOUT, code: altered(codeOf(session, PASTEUR_PRINTOUT)), inspection: null }).data?.result ?? "";
    expect(answerOf(session, result).outcome).toEqual({ kind: "NOT_AUTHENTICATED", reason: "SIGNATURE_NOT_VERIFIED" });
  });

  it("@AC-FR-VER-017-01 still authenticates a code printed under a key since retired, and says so", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = atPasteur();
    const jwk = JSON.stringify(generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey.export({ format: "jwk" }));
    expect(registerKey(session, SECURITY, { kid: "CK-2026-02", handle: "hsm/ck-2026-02", jwk, validFrom: new Date(Date.now() + 1000).toISOString() }).failure).toBeNull();
    vi.setSystemTime(Date.now() + 5000);
    expect(retireKey(session, SECURITY, "CK-2026-01").failure).toBeNull();
    refreshVerificationKeys(session);
    const result = checkOffline(session, { printout: PASTEUR_PRINTOUT, code: codeOf(session, PASTEUR_PRINTOUT), inspection: null }).data?.result ?? "";
    const outcome = answerOf(session, result).outcome;
    expect(outcome).toMatchObject({ kind: "LIMITED_OFFLINE", keyId: "CK-2026-01" });
    expect(outcome.kind === "LIMITED_OFFLINE" && outcome.keyRetiredAt !== null).toBe(true);
  });

  it("uploads a result for real: RightOne verifies it again and stores it LIMITED_OFFLINE", () => {
    const session = atPasteur();
    checkOffline(session, { printout: PASTEUR_PRINTOUT, code: codeOf(session, PASTEUR_PRINTOUT), inspection: null });
    const waiting = scanAndVerifyOf(session, null).data?.waiting[0];
    const uploaded = uploadOfflineResult(session, `${waiting?.representation ?? ""}-${waiting?.checkedAt ?? ""}`);
    expect(uploaded.failure).toBeNull();
    const row = scanAndVerifyOf(session, null).data?.uploaded[0];
    expect(row).toMatchObject({ answer: uploaded.data?.answer, state: "LIMITED_OFFLINE", differsFromDevice: false });
    expect(answerOf(session, uploaded.data?.answer ?? "").outcome).toMatchObject({ kind: "LIMITED_OFFLINE", record: PASTEUR_RECORD });
  });

  it("@AC-FR-VER-017-04 does not trust the phone's verdict: a key revoked before upload gives NOT_AUTHENTICATED, which differs", () => {
    const session = atPasteur();
    checkOffline(session, { printout: PASTEUR_PRINTOUT, code: codeOf(session, PASTEUR_PRINTOUT), inspection: null });
    const waiting = scanAndVerifyOf(session, null).data?.waiting[0];
    revokeKey(session, SECURITY, "CK-2026-01", "Khoá bị lộ");
    uploadOfflineResult(session, `${waiting?.representation ?? ""}-${waiting?.checkedAt ?? ""}`);
    expect(scanAndVerifyOf(session, null).data?.uploaded[0]).toMatchObject({ state: "NOT_AUTHENTICATED", differsFromDevice: true });
  });

  it("@AC-FR-VER-017-08 refuses a payload that does not decode PAYLOAD_UNREADABLE; the result moves to Could not upload", () => {
    const session = signIn(PEOPLE.inspector);
    const seeded = scanAndVerifyOf(session, null).data?.waiting.find((row) => row.representation === "CRP-7QX2M4KD9A");
    const sent = uploadOfflineResult(session, `${seeded?.representation ?? ""}-${seeded?.checkedAt ?? ""}`);
    expect(sent.failure?.code).toBe("PAYLOAD_UNREADABLE");
    const after = scanAndVerifyOf(session, null).data;
    expect(after?.failed.some((row) => row.representation === "CRP-7QX2M4KD9A" && row.refusal === "PAYLOAD_UNREADABLE")).toBe(true);
    expect(after?.waiting.some((row) => row.representation === "CRP-7QX2M4KD9A")).toBe(false);
  });

  it("@AC-FR-VER-017-06 refuses an upload whose representation reference is not the one its code signs", () => {
    const session = atPasteur();
    const code = codeOf(session, PASTEUR_PRINTOUT);
    const sent = receiveOfflineResult(session, {
      ...code,
      representation: "CRP-6KD3QW8T2M",
      deviceCheckedAt: new Date().toISOString(),
      deviceKeysRefreshedAt: new Date().toISOString(),
      deviceVerdict: "LIMITED_OFFLINE",
      appointment: "kv3",
      inspection: null,
    });
    expect(sent.failure?.code).toBe("PAYLOAD_REFERENCE_MISMATCH");
  });

  it("@AC-FR-VER-004-04 refuses an upload checked later than RightOne's clock DEVICE_TIME_IN_FUTURE", () => {
    const session = atPasteur();
    const code = codeOf(session, PASTEUR_PRINTOUT);
    const sent = receiveOfflineResult(session, {
      ...code,
      representation: PASTEUR_PRINTOUT,
      deviceCheckedAt: new Date(Date.now() + 3 * 60_000).toISOString(),
      deviceKeysRefreshedAt: new Date().toISOString(),
      deviceVerdict: "LIMITED_OFFLINE",
      appointment: "kv3",
      inspection: null,
    });
    expect(sent.failure?.code).toBe("DEVICE_TIME_IN_FUTURE");
  });

  it("stores a result sent again under the key the phone gave it once, answering the answer already stored", () => {
    const session = atPasteur();
    const checkedAt = new Date().toISOString();
    const upload = {
      ...codeOf(session, PASTEUR_PRINTOUT),
      representation: PASTEUR_PRINTOUT,
      deviceCheckedAt: checkedAt,
      deviceKeysRefreshedAt: checkedAt,
      deviceVerdict: "LIMITED_OFFLINE" as const,
      appointment: "kv3",
      inspection: null,
      idempotencyKey: "6f1d2c9e-offline-check",
    };
    const first = receiveOfflineResult(session, upload);
    expect(first.data?.answer).toMatch(/^VRA-/);
    expect(receiveOfflineResult(session, upload).data?.answer).toBe(first.data?.answer);
    expect(receiveOfflineResult(session, { ...upload, idempotencyKey: "a-second-check" }).data?.answer).not.toBe(first.data?.answer);
  });
});

describe("a record cites its answers with their limits (FR-VER-037)", () => {
  it("holds a result checked offline from an inspection as its evidence waiting, and says so on the conclusion", () => {
    const session = atPasteur();
    checkOffline(session, { printout: PASTEUR_PRINTOUT, code: codeOf(session, PASTEUR_PRINTOUT), inspection: PASTEUR_INSPECTION });
    const attached = inspectionOf(session, PASTEUR_INSPECTION, "vi", null).data?.attached ?? [];
    expect(attached.some((row) => row.answer === PASTEUR_PRINTOUT && row.result.kind === "WAITING_OFFLINE")).toBe(true);
    expect(conclusionOf(session, PASTEUR_INSPECTION, "vi", null).data?.offlineResultWaiting).toBe(PASTEUR_PRINTOUT);
  });

  it("@AC-FR-VER-037-02 issues a compliant record citing the online and the offline answer, each with its own limits", () => {
    const session = atPasteur();
    checkOffline(session, { printout: PASTEUR_PRINTOUT, code: codeOf(session, PASTEUR_PRINTOUT), inspection: PASTEUR_INSPECTION });
    const waiting = scanAndVerifyOf(session, null).data?.waiting[0];
    const uploaded = uploadOfflineResult(session, `${waiting?.representation ?? ""}-${waiting?.checkedAt ?? ""}`).data?.answer ?? "";
    const issued = concludeInspection(session, "Âu Thị Ngọc Diệp", PASTEUR_INSPECTION, conclusion());
    const record = inspectionRecordOf(session, issued.data?.record ?? "", "vi", null).data;
    expect(record?.whole?.verified).toEqual([
      expect.objectContaining({ answer: "VRA-4TW9KQ3MXA", channel: "ONLINE", state: "IN_FORCE" }),
      expect.objectContaining({ answer: uploaded, channel: "OFFLINE_UPLOAD", printedState: "IN_FORCE", printedAt: "2026-09-19T08:30:00+07:00" }),
    ]);
    expect(record?.whole?.recordStateAtObservation).toBe("IN_FORCE");
  });

  it("@AC-FR-VER-011-03 refuses a compliant outcome with no verification attached OUTCOME_NOT_SUPPORTED", () => {
    const session = atPasteur();
    const answer = verify(session, { value: PASTEUR_RECORD, identifierType: null, inspection: null, code: null }).data?.answer ?? "";
    carryAnswerIntoInspection(session, answer);
    const opened = openInspection(session, { withAnswer: false, locationContext: "REGISTER_ADDRESS", purpose: "ROUTINE", basis: "", observedAt: new Date().toISOString(), delayReason: "" });
    expect(concludeInspection(session, "Âu Thị Ngọc Diệp", opened.data?.inspection ?? "", conclusion()).failure?.code).toBe("OUTCOME_NOT_SUPPORTED");
  });

  it("refuses a compliant outcome RECORD_NOT_CURRENT_AT_INSPECTION where CER held no current record when the inspection took place", () => {
    const session = atPasteur();
    const answer = verify(session, { value: PASTEUR_RECORD, identifierType: null, inspection: null, code: null }).data?.answer ?? "";
    carryAnswerIntoInspection(session, answer);
    // Pasteur's record was issued on 18 September 2026; KTVH-KV3's appointment runs from 15 September.
    const opened = openInspection(session, {
      withAnswer: false,
      locationContext: "REGISTER_ADDRESS",
      purpose: "ROUTINE",
      basis: "",
      observedAt: "2026-09-16T10:00:00+07:00",
      delayReason: "Ghi nhận muộn vì thiết bị hỏng",
    });
    const inspection = opened.data?.inspection ?? "";
    verify(session, { value: PASTEUR_RECORD, identifierType: null, inspection, code: null });
    expect(concludeInspection(session, "Âu Thị Ngọc Diệp", inspection, conclusion()).failure?.code).toBe("RECORD_NOT_CURRENT_AT_INSPECTION");
  });
});

describe("opening an inspection (FR-VER-005, DR-740 row 8)", () => {
  function carried(): string {
    const session = atPasteur();
    carryAnswerIntoInspection(session, verify(session, { value: PASTEUR_RECORD, identifierType: null, inspection: null, code: null }).data?.answer ?? "");
    return session;
  }

  it("@AC-FR-VER-005-02 refuses a scan offered as the location LOCATION_CONTEXT_NOT_PERMITTED, and opens nothing", () => {
    const session = carried();
    const opened = openInspection(session, { withAnswer: true, locationContext: "SCANNED_AT_PREMISES", purpose: "ROUTINE", basis: "", observedAt: new Date().toISOString(), delayReason: "" });
    expect(opened.failure?.code).toBe("LOCATION_CONTEXT_NOT_PERMITTED");
    expect(openInspection(session, { withAnswer: true, locationContext: "REGISTER_ADDRESS", purpose: "ROUTINE", basis: "", observedAt: new Date().toISOString(), delayReason: "" }).data?.inspection).toMatch(/^ISP-/);
  });

  it("refuses an instant before the appointment took effect OBSERVED_OUTSIDE_AUTHORITY", () => {
    const session = carried();
    const opened = openInspection(session, {
      withAnswer: false,
      locationContext: "REGISTER_ADDRESS",
      purpose: "ROUTINE",
      basis: "",
      observedAt: "2026-09-10T10:00:00+07:00",
      delayReason: "Ghi nhận muộn",
    });
    expect(opened.failure?.code).toBe("OBSERVED_OUTSIDE_AUTHORITY");
  });
});

describe("issuing, delivering and correcting a record (FR-VER-007, 012, 026, 034, 035)", () => {
  it("@AC-FR-VER-007-02 opens the referral's case in CAS, on the record that carries it", () => {
    const session = signIn(PEOPLE.inspector);
    const issued = concludeInspection(
      session,
      "Âu Thị Ngọc Diệp",
      HEM_214_INSPECTION,
      conclusion({
        outcome: "REFERRED",
        route: "CASE_FOLLOW_UP",
        referralNote: "Cơ sở không đồng ý là có sử dụng nhạc nền",
        delayReason: "Thiết bị mất kết nối",
        followUp: "CASE",
        followUpBy: daysAhead(30),
      }),
    );
    const record = issued.data?.record ?? "";
    const caseRef = inspectionRecordOf(session, record, "vi", null).data?.whole?.referralCase ?? "";
    expect(caseRef).toMatch(/^CAS-/);
    expect(caseRemedyFor(session, caseRef)?.subject).toBe(record);
  });

  it("@AC-FR-VER-012-01 raises the issued record as a notice to the party operating the premises", () => {
    const session = atPasteur();
    const record = concludeInspection(session, "Âu Thị Ngọc Diệp", PASTEUR_INSPECTION, conclusion()).data?.record ?? "";
    const notice = inspectionRecordOf(session, record, "vi", null).data?.whole?.delivery.notice?.reference ?? "";
    expect(noticeStateOf(session, notice)).not.toBeNull();
    expect((noticesTo(session, "tcv").data ?? []).some((sent) => sent.reference === notice)).toBe(true);
  });

  it("@AC-FR-VER-012-02 records the notice reaching the party as the delivery, by the notice route", () => {
    const session = atPasteur();
    const record = concludeInspection(session, "Âu Thị Ngọc Diệp", PASTEUR_INSPECTION, conclusion()).data?.record ?? "";
    const delivery = inspectionRecordOf(session, record, "vi", null).data?.whole?.delivery;
    expect(delivery).toMatchObject({ state: "NOTICE_DELIVERED", route: "NOTICE" });
    expect(delivery?.deliveredAt).not.toBeNull();
  });

  it("@AC-FR-VER-034-04 refuses a handover of a record the notice already reached ALREADY_DELIVERED", () => {
    const session = atPasteur();
    const record = concludeInspection(session, "Âu Thị Ngọc Diệp", PASTEUR_INSPECTION, conclusion()).data?.record ?? "";
    expect(recordDelivery(session, record, { handedOverAt: new Date().toISOString(), recipient: "MANAGER" }).failure?.code).toBe("ALREADY_DELIVERED");
  });

  it("@AC-FR-VER-035-03 records a late handover and keeps the instant the record became undelivered", () => {
    const session = signIn(PEOPLE.inspector);
    // Then Cửa Lounge & Karaoke – Bùi Viện's record was due by 27 September 2026 and reached nobody.
    const flagged = authorityWorkOf(session, "UNDELIVERED", null, null, null, "vi").data?.rows ?? [];
    expect(flagged.some((row) => row.reference === "IRC-8KT3QW5MXA")).toBe(true);
    const before = inspectionRecordOf(session, "IRC-8KT3QW5MXA", "vi", null).data?.whole?.delivery;
    expect(before?.state).toBe("UNDELIVERED");
    expect(recordDelivery(session, "IRC-8KT3QW5MXA", { handedOverAt: new Date(Date.now() - 60_000).toISOString(), recipient: "OWNER" }).failure).toBeNull();
    const after = inspectionRecordOf(session, "IRC-8KT3QW5MXA", "vi", null).data?.whole?.delivery;
    expect(after).toMatchObject({ state: "HANDED_OVER", route: "ON_SITE", undeliveredAt: before?.undeliveredAt });
  });

  it("@AC-FR-VER-026-01 issues version 2 under the case that requires it, and version 1 stays readable whole on request", () => {
    const session = signIn(PEOPLE.inspector);
    const corrected = correctRecord(session, "Âu Thị Ngọc Diệp", "IRC-4M8QK2TW7C", {
      caseRef: "CAS-2026-000412",
      outcome: "GUIDANCE_GIVEN",
      findings: [],
      guidance: "Đăng ký qua Cổng một cửa trước khi tiếp tục phát nhạc nền",
      route: "CASE_FOLLOW_UP",
      referralNote: "",
      followUp: "NONE",
      followUpBy: "",
      reason: "Nội dung hướng dẫn ghi chưa đầy đủ",
    });
    expect(corrected.data?.version).toBe(2);
    const inForce = inspectionRecordOf(session, "IRC-4M8QK2TW7C", "vi", null).data;
    const first = inspectionRecordOf(session, "IRC-4M8QK2TW7C", "vi", null, 1).data;
    expect(inForce?.earlier.map((entry) => entry.version)).toEqual([1]);
    expect(first?.version).toBe(1);
    expect(first?.supersededAt).not.toBeNull();
    expect(inspectionRecordOf(session, "IRC-4M8QK2TW7C", "vi", null, 7).failure?.code).toBe("RECORD_NOT_FOUND");
  });

  it("@AC-FR-VER-026-10 issues a further version under the same case once an appeal sets a new remedy, and not before", () => {
    const session = signIn(PEOPLE.inspector);
    const correction = (outcome: "GUIDANCE_GIVEN" | "NOTHING_FOUND", reason: string) =>
      correctRecord(session, "Âu Thị Ngọc Diệp", "IRC-4M8QK2TW7C", {
        caseRef: "CAS-2026-000412",
        outcome,
        findings: [],
        guidance: outcome === "GUIDANCE_GIVEN" ? "Đăng ký qua Cổng một cửa trước khi tiếp tục phát nhạc nền" : "",
        route: "CASE_FOLLOW_UP",
        referralNote: "",
        followUp: "NONE",
        followUpBy: "",
        reason,
      });
    expect(correction("GUIDANCE_GIVEN", "Nội dung hướng dẫn ghi chưa đầy đủ").data?.version).toBe(2);
    expect(correction("NOTHING_FOUND", "Sửa thêm").failure?.code).toBe("CORRECTION_ALREADY_RECORDED");
    // The premises appeals the decision, and the dispute authority varies it with a new correction.
    const appeal = lodgeAppeal(signInBeside(session, PEOPLE.principal, "tcv"), { party: "tcv", account: "Đỗ Thu Trang" }, "CAS-2026-000412", { grounds: "Hôm đó cơ sở không phát nhạc", contact: "trang.do@thencuaviet.vn" });
    const account = findAccount(PEOPLE.approver);
    const authority = { sessionId: signInBeside(session, PEOPLE.approver), account: account?.name ?? "", email: PEOPLE.approver, position: account?.position ?? "", roles: account?.staffRoles ?? [] };
    const varied = recordAppealOutcome(session, authority, appeal.accepted?.appeal ?? "", {
      outcome: "varied",
      facts: "Nhạc phát từ cơ sở bên cạnh",
      authority: "Quy định về biên bản kiểm tra và việc xem xét lại",
      reasoning: "Biên bản phải ghi không có vấn đề",
      remedy: "correction",
      effective: today(),
      furtherRoute: "Toà án nhân dân nơi cơ sở đặt trụ sở",
      ground: "inspection_rules",
    });
    expect(varied.accepted?.state).toBe("APPEAL_DECIDED");
    expect(correction("NOTHING_FOUND", "Sửa theo kết quả khiếu nại").data?.version).toBe(3);
    expect(inspectionRecordOf(session, "IRC-4M8QK2TW7C", "vi", null).data?.earlier.map((entry) => entry.version)).toEqual([1, 2]);
  });
});

describe("what an issued record says, and to whom (FR-VER-007, 008, 027, 038)", () => {
  it("@AC-FR-VER-007-01 issues a guidance record naming the location context, the purpose, the guidance and what the representative said", () => {
    const session = atPasteur();
    const inspection = openAtPasteur(session, new Date(Date.now() - 20 * 60_000).toISOString());
    const issued = concludeInspection(
      session,
      "Âu Thị Ngọc Diệp",
      inspection,
      conclusion({
        outcome: "GUIDANCE_GIVEN",
        guidance: "Đăng ký qua Cổng một cửa RightOne trước ngày 14 tháng 11",
        statement: "Nhạc phát từ danh sách riêng của chủ cơ sở",
        followUp: "RE_VISIT",
        followUpBy: daysAhead(30),
      }),
    );
    const whole = inspectionRecordOf(session, issued.data?.record ?? "", "vi", null).data?.whole;
    expect(whole).toMatchObject({
      locationContext: "REGISTER_ADDRESS",
      purpose: "ROUTINE",
      guidance: "Đăng ký qua Cổng một cửa RightOne trước ngày 14 tháng 11",
      statement: "Nhạc phát từ danh sách riêng của chủ cơ sở",
      representative: { role: "MANAGER", acknowledgement: "ACKNOWLEDGED" },
      followUp: "RE_VISIT",
      referral: null,
      delayReason: null,
    });
  });

  it("@AC-FR-VER-038-02 issues a late inspection's record with the reason for the delay, which the premises reads too", () => {
    const session = atPasteur();
    const reason = "Không có sóng tại khu vực; ghi nhận khi về trụ sở";
    const inspection = openAtPasteur(session, new Date(Date.now() - 30 * 3_600_000).toISOString(), reason);
    const record = concludeInspection(session, "Âu Thị Ngọc Diệp", inspection, nobodyPresent).data?.record ?? "";
    expect(inspectionRecordOf(session, record, "vi", null).data?.whole?.delayReason).toBe(reason);
    const principal = signInBeside(session, PEOPLE.principal, "tcv");
    expect(premisesRecordsOf(principal, TCV, "pasteur", record, "vi").data?.opened).toMatchObject({ reference: record, delayReason: reason });
  });

  it("@AC-FR-VER-008-03 refuses the challenge of a record made before the party operated the premises NOT_PARTY_TO_SUBJECT, and lists it nowhere", () => {
    const session = atPasteur();
    // PTY's register has Then Cửa Việt operating Pasteur from 16 September 2026; this visit took place on the 15th.
    const inspection = openAtPasteur(session, "2026-09-15T10:00:00+07:00", "Ghi nhận muộn vì thiết bị hỏng");
    const record = concludeInspection(session, "Âu Thị Ngọc Diệp", inspection, nobodyPresent).data?.record ?? "";
    expect(record).toMatch(/^IRC-/);
    const principal = signInBeside(session, PEOPLE.principal, "tcv");
    const sent = requestReconsideration(principal, TCV, { subject: record, versionNo: 1, premises: null, grounds: "Hôm đó cơ sở chưa hoạt động" });
    expect(sent.failure?.code).toBe("NOT_PARTY_TO_SUBJECT");
    expect(premisesRecordsOf(principal, TCV, "pasteur", null, "vi").data?.records.some((entry) => entry.reference === record)).toBe(false);
    expect(premisesRecordsOf(principal, TCV, "pasteur", record, "vi").data?.openedRefusal).toBe("RECORD_NOT_FOUND");
  });

  it("@AC-FR-VER-027-01 tells an inspector of another authority that the record is under challenge, and nothing of the case", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const session = signIn(PEOPLE.inspector);
    const principal = signInBeside(session, PEOPLE.principal, "tcv");
    expect(requestReconsideration(principal, TCV, { subject: "IRC-6KD2TW8QMX", versionNo: 1, premises: null, grounds: "Hôm đó cơ sở không phát nhạc" }).data?.case).toMatch(/^CAS-/);
    // KTVH-KV1's appointment ends today; two days on the inspector reads its record under KTVH-KV3 alone.
    expect(endAppointment(session, OPERATIONS, "kv1", today(), "Chuyển công tác").failure).toBeNull();
    vi.setSystemTime(Date.now() + 2 * 86_400_000);
    const read = inspectionRecordOf(session, "IRC-6KD2TW8QMX", "vi", null).data;
    expect(read?.whole).toBeNull();
    expect(read?.reconsideration).toEqual({ case: null });
    expect(authorityWorkOf(session, null, "IRC-6KD2TW8QMX", null, null, "vi").data?.opened).toMatchObject({ whole: false, record: { challenge: { case: null } } });
  });

  it("names the case to the issuing authority of a record under challenge", () => {
    const session = signIn(PEOPLE.inspector);
    const principal = signInBeside(session, PEOPLE.principal, "tcv");
    const opened = requestReconsideration(principal, TCV, { subject: "IRC-6KD2TW8QMX", versionNo: 1, premises: null, grounds: "Hôm đó cơ sở không phát nhạc" }).data?.case ?? "";
    expect(inspectionRecordOf(session, "IRC-6KD2TW8QMX", "vi", null).data?.reconsideration).toEqual({ case: opened });
  });
});

describe("reads under DR-740 rows 1 to 3", () => {
  it("says the suspension in the header of the issuing authority's record while another appointment is in force", () => {
    const session = signIn(PEOPLE.inspector);
    suspendAppointment(session, OPERATIONS, "kv1", "Đang xem xét phản ánh");
    const read = inspectionRecordOf(session, "IRC-6KD2TW8QMX", "vi", null).data;
    expect(read?.refusal).toBe("APPOINTMENT_SUSPENDED");
  });

  it("reads nothing but the last-day allowance's own records once every other appointment is suspended", () => {
    const session = signIn(PEOPLE.inspector);
    suspendAppointment(session, OPERATIONS, "kv1", "Đang xem xét phản ánh");
    suspendAppointment(session, OPERATIONS, "kv3", "Đang xem xét phản ánh");
    // KTVH-KV2's allowance admits only what was observed under it (DR-740); a record of KTVH-KV1 is not found.
    const read = inspectionRecordOf(session, "IRC-6KD2TW8QMX", "vi", null);
    expect(read.data).toBeNull();
    expect(read.failure?.code).toBe("RECORD_NOT_FOUND");
  });

  it("refuses the stored answer of a suspended appointment APPOINTMENT_SUSPENDED", () => {
    const session = signIn(PEOPLE.inspector);
    const reference = verify(session, { value: "R1-CER-2026-K9TE4WQC", identifierType: null, inspection: null, code: null }).data?.answer ?? "";
    suspendAppointment(session, OPERATIONS, "kv1", "Đang xem xét phản ánh");
    expect(verificationAnswerOf(session, reference).failure?.code).toBe("APPOINTMENT_SUSPENDED");
  });
});

describe("requests to reconsider carry what their subject showed (FR-VER-008, FR-VER-025)", () => {
  const worldOf = (session: string): string => sessions().get(session)?.world ?? "";

  it("@AC-FR-VER-008-01 records the challenge of a record with its version, outcome, digest and issue instant", () => {
    const session = signIn(PEOPLE.inspector);
    const principal = signInBeside(session, PEOPLE.principal, "tcv");
    const sent = requestReconsideration(principal, TCV, { subject: "IRC-6KD2TW8QMX", versionNo: 1, premises: null, grounds: "Hôm đó cơ sở không phát nhạc" });
    const snapshot = challengeSnapshotFor(principal, sent.data?.case ?? "")?.snapshot;
    expect(snapshot).toMatchObject({ kind: "INSPECTION_RECORD", version: 1, outcome: "GUIDANCE_GIVEN" });
    expect(snapshot?.kind === "INSPECTION_RECORD" ? snapshot.digest : "").not.toBe("");
  });

  it("@AC-FR-VER-008-09 records the challenge of a public answer that found no record, naming the premises", () => {
    const session = signIn(PEOPLE.principal, { organisation: "tcv" });
    const looked = verifyCertificate("R1-CER-2026-ZZZZZZZZ", "198.51.100.17", worldOf(session));
    const answerRef = looked.data?.answerRef ?? "";
    const sent = requestReconsideration(session, TCV, { subject: answerRef, versionNo: null, premises: "pasteur", grounds: "Mã trên biên lai bị gõ nhầm" });
    expect(sent.data?.case).toMatch(/^CAS-/);
    expect(challengeSnapshotFor(session, sent.data?.case ?? "")?.snapshot).toMatchObject({
      kind: "ANSWER",
      identifier: { value: "R1-CER-2026-ZZZZZZZZ" },
      outcome: { kind: "NO_RECORD" },
    });
  });

  it("@AC-FR-VER-008-10 refuses the challenge of an answer naming no premises PREMISES_REQUIRED when none is named", () => {
    const session = signIn(PEOPLE.principal, { organisation: "tcv" });
    const answerRef = verifyCertificate("R1-CER-2026-YYYYYYYY", "198.51.100.18", worldOf(session)).data?.answerRef ?? "";
    expect(requestReconsideration(session, TCV, { subject: answerRef, versionNo: null, premises: null, grounds: "Mã bị gõ nhầm" }).failure?.code).toBe("PREMISES_REQUIRED");
  });

  it("reads a public answer that found a record on the reconsideration form, about that record's premises", () => {
    const session = signIn(PEOPLE.principal, { organisation: "tcv" });
    const answerRef = verifyCertificate(PASTEUR_RECORD, "198.51.100.19", worldOf(session)).data?.record?.answerRef ?? "";
    const subject = reconsiderationOf(session, TCV, answerRef, null, "vi").data?.subject;
    expect(subject).toMatchObject({ kind: "ANSWER", reference: answerRef, premises: { id: "pasteur" }, outcome: { kind: "CURRENT_RESULT", record: PASTEUR_RECORD } });
  });
});

describe("the authority's console pages its rows", () => {
  it("reads the first page again, with the filter kept, for a cursor it did not issue", () => {
    const session = signIn(PEOPLE.inspector);
    const first = authorityWorkOf(session, null, null, null, null, "vi").data;
    const stale = authorityWorkOf(session, null, null, null, null, "vi", "bm90LWEtY3Vyc29y").data;
    expect(stale?.rowsRefusal).toBe("CURSOR_INVALID");
    expect(stale?.rows).toEqual(first?.rows);
    expect(first?.nextCursor).toBeNull();
  });
});

describe("a delegate reads and challenges only within her delegation (SEC-745, DR-201)", () => {
  /** Hầu Ngọc Ánh, whose delegation names Nguyễn Huệ alone, and Giang Thục Quyên, whose authority was revoked. */
  const DELEGATE = { party: "tcv", name: "Hầu Ngọc Ánh" };
  const REVOKED = { party: "tcv", name: "Giang Thục Quyên" };
  const worldOf = (session: string): string => sessions().get(session)?.world ?? "";

  it("opens the delegate's records at Nguyễn Huệ, which her delegation names, and refuses Lê Thánh Tôn NOT_AUTHORISED_FOR_PREMISES", () => {
    const delegate = signIn(PEOPLE.delegate);
    const own = premisesRecordsOf(delegate, DELEGATE, null, null, "vi").data;
    expect(own).toMatchObject({ premises: { id: "nh" }, records: [], opened: null, openedRefusal: null });
    expect(own?.options.map((option) => option.id)).toEqual(["nh"]);
    expect(premisesRecordsOf(delegate, DELEGATE, "ltt", null, "vi").failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });

  it("answers the delegate RECORD_NOT_FOUND and ANSWER_NOT_FOUND for what a premises outside her delegation holds, as the principal reads it", () => {
    const principal = signIn(PEOPLE.principal, { organisation: "tcv" });
    const delegate = signInBeside(principal, PEOPLE.delegate);
    expect(premisesRecordOf(principal, TCV, "IRC-6KD2TW8QMX", "vi").data?.reference).toBe("IRC-6KD2TW8QMX");
    expect(premisesRecordOf(delegate, DELEGATE, "IRC-6KD2TW8QMX", "vi").failure?.code).toBe("RECORD_NOT_FOUND");
    expect(premisesRecordsOf(delegate, DELEGATE, null, "IRC-6KD2TW8QMX", "vi").data).toMatchObject({ premises: { id: "nh" }, opened: null, openedRefusal: "RECORD_NOT_FOUND" });
    expect(reconsiderationOf(delegate, DELEGATE, "IRC-6KD2TW8QMX", null, "vi").data?.subjectRefusal).toBe("RECORD_NOT_FOUND");
    expect(reconsiderationOf(principal, TCV, "VRA-9KD4QW7M2T", null, "vi").data?.subjectRefusal).toBeNull();
    expect(reconsiderationOf(delegate, DELEGATE, "VRA-9KD4QW7M2T", null, "vi").data?.subjectRefusal).toBe("ANSWER_NOT_FOUND");
  });

  it("lets the delegate challenge an answer for Nguyễn Huệ and read the case it opens, and refuses her Lê Thánh Tôn's record NOT_PARTY_TO_SUBJECT", () => {
    const delegate = signIn(PEOPLE.delegate);
    const answerRef = verifyCertificate("R1-CER-2026-ZZZZZZZZ", "198.51.100.21", worldOf(delegate)).data?.answerRef ?? "";
    const opened = requestReconsideration(delegate, DELEGATE, { subject: answerRef, versionNo: null, premises: "nh", grounds: "Mã trên biên lai bị gõ nhầm" }).data?.case ?? "";
    expect(opened).toMatch(/^CAS-/);
    expect(caseRead(delegate, opened, { party: "tcv", account: DELEGATE.name }).data).toMatchObject({ reference: opened, own: true });
    expect(requestReconsideration(delegate, DELEGATE, { subject: answerRef, versionNo: null, premises: "pasteur", grounds: "Mã bị gõ nhầm" }).failure?.code).toBe("NOT_PARTY_TO_SUBJECT");
    expect(requestReconsideration(delegate, DELEGATE, { subject: "IRC-6KD2TW8QMX", versionNo: 1, premises: null, grounds: "Hôm đó cơ sở không phát nhạc" }).failure?.code).toBe("NOT_PARTY_TO_SUBJECT");
  });

  it("refuses a delegate whose authority was revoked the records, the printout and the challenge", () => {
    const revoked = signIn(PEOPLE.revokedDelegate);
    expect(premisesRecordsOf(revoked, REVOKED, "nh", null, "vi").failure?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
    expect(premisesRecordOf(revoked, REVOKED, "IRC-6KD2TW8QMX", "vi").failure?.code).toBe("RECORD_NOT_FOUND");
    expect(requestReconsideration(revoked, REVOKED, { subject: "IRC-6KD2TW8QMX", versionNo: 1, premises: null, grounds: "Hôm đó cơ sở không phát nhạc" }).failure?.code).toBe("NOT_PARTY_TO_SUBJECT");
  });
});
