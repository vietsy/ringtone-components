import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngagementAnswer, Recorded } from "@/lib/api/engagement";
import { findAccount } from "@/lib/mock/backend/accounts";
import {
  approveDisclosure,
  approveRuleVersion,
  assuranceBalance,
  authoriseCorrection,
  balanceOf,
  correctionView,
  defineMetric,
  disclosureFor,
  disclosureVersions,
  endDisclosure,
  engagementAudit,
  ledgerEventFor,
  participationOf,
  pointDisposition,
  prepareRuleVersion,
  proposeCorrection,
  qualifyingActionForm,
  recordQualifyingAction,
  recordRelease,
  referralReference,
  requestReferralReference,
  stopTakingPart,
  submitRuleVersion,
  supportRead,
  suspendRelease,
  takePart,
  withdrawRelease,
  type EngagementReader,
} from "@/lib/mock/backend/engagement";
import { noticeQueue, officeDestinationOf } from "@/lib/mock/backend/notices";
import { MOCK_ARTIST } from "@/lib/mock/session";
import { PEOPLE, signIn, signInBeside } from "./harness";

/*
 * ENG, played by the mock backend: the capability released under `CG-ENG`, the artist and the premises principal taking
 * part, awards under the version governing their instant with the four-column receipt, corrections by two people, the
 * as-at reconstruction and its assurance read, the reserved dispositions, the referral reference, the disclosure and
 * its lapse, and the notices the capability's transitions and a new disclosure raise through COM. The clock is fixed at
 * 09:00 on 17 October 2026, Vietnam time, and moved where a test says so.
 */

const T0 = "2026-10-17T09:00:00+07:00";
const at = (offsetMinutes: number) => new Date(Date.parse(T0) + offsetMinutes * 60_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(T0));
});

afterEach(() => {
  vi.useRealTimers();
});

/** A member of staff as the seam hands them to the backend. */
function staff(email: string): EngagementReader {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { kind: "staff", name: account.name, email: account.email, roles: account.staffRoles };
}

const PRINCIPAL: EngagementReader = { kind: "participant", organisation: "tcv", name: "Đỗ Thu Trang" };
/** Đỗ Thu Trang signed in on the same browser: PTY answers for the participant from her session, as the seam asks it. */
const asPrincipal = (key: string) => signInBeside(key, PEOPLE.principal);
const ARTIST: EngagementReader = { kind: "artist", account: MOCK_ARTIST.email, name: MOCK_ARTIST.name };
/** Phan Gia Lượng: records actions by hand (ACT-MKT-OP), owns the metrics (ACT-REP), approves policy (ACT-POL-APR). */
const LUONG = staff(PEOPLE.operations);
/** Quan Ngọc Trâm: reads balances for support and proposes corrections (ACT-OPS), prepares policy (ACT-POL-PRE). */
const TRAM = staff(PEOPLE.preparer);
/** Thạch Minh Khải: the independent business approver (ACT-BIZ-APR). */
const KHAI = staff(PEOPLE.approver);
/** Lê Văn Cường: the auditor (ACT-AUD) and the data protection officer (ACT-DPO). */
const CUONG = staff(PEOPLE.supervisor);

const ARTIST_PARTY = MOCK_ARTIST.party;

/** A world with the capability released to both classes from a minute before now, its four conditions evidenced. */
function released(): string {
  const key = signIn(PEOPLE.operations);
  const from = at(-1);
  expect(defineMetric(key, LUONG, "POINTS_AWARDED", "Tổng giá trị các sự kiện có thời điểm ghi trong kỳ.", from).refusal).toBeNull();
  expect(defineMetric(key, LUONG, "PARTICIPANTS_ENROLLED", "Số người đang tham gia lúc đóng kỳ.", from).refusal).toBeNull();
  expect(recordRelease(key, KHAI, { scope: ["artist", "premises"], effectiveFrom: from }).refusal).toBeNull();
  return key;
}

/** A released world in which the artist takes part. */
function artistTakingPart(): string {
  const key = released();
  expect(takePart(key, ARTIST).refusal).toBeNull();
  return key;
}

function accepted<T>(answer: EngagementAnswer<T>): T {
  if (answer.accepted === null) throw new Error(`refused: ${JSON.stringify(answer.refusal)}`);
  return answer.accepted;
}

/** An action recorded by hand for the artist, occurring a minute before now unless said otherwise. */
const award = (key: string, code: string, extra: { at?: string; subject?: string; profile?: string; digest?: string } = {}): EngagementAnswer<Recorded> =>
  recordQualifyingAction(key, LUONG, { participant: ARTIST_PARTY, code, at: extra.at ?? at(-1), subject: extra.subject ?? null, profile: extra.profile ?? null, digest: extra.digest ?? null });

const balance = (key: string, reader: EngagementReader = ARTIST) => balanceOf(key, reader, null, null);
const audit = (key: string) => engagementAudit(key, CUONG).data ?? [];

describe("FR-ENG-002: the artist baseline of version 1", () => {
  it("@AC-FR-ENG-002-01 awards 20 points for a completed onboarding, naming version 1", () => {
    const key = artistTakingPart();
    const recorded = accepted(award(key, "ONBOARDING_COMPLETED"));
    expect(recorded).toMatchObject({ points: 20, replay: false });
    expect(ledgerEventFor(key, ARTIST, recorded.event, null).data).toMatchObject({ points: 20, governing: { no: 1 }, kind: "award" });
  });

  it("@AC-FR-ENG-002-02 awards 50 points for a published track, and the balance rises by 50", () => {
    const key = artistTakingPart();
    accepted(award(key, "ONBOARDING_COMPLETED"));
    const before = balance(key).data?.points ?? 0;
    expect(accepted(award(key, "TRACK_PUBLISHED", { subject: "TRK-5518" })).points).toBe(50);
    expect(balance(key).data?.points).toBe(before + 50);
  });

  it("@AC-FR-ENG-002-03 awards 10 points for a completed profile, and the balance rises by 10", () => {
    const key = artistTakingPart();
    expect(accepted(award(key, "PROFILE_COMPLETED")).points).toBe(10);
    expect(balance(key).data).toMatchObject({ points: 10, eventCount: 1 });
  });
});

describe("POST /qualifying-actions: the four-column receipt and the payload digest", () => {
  it("@AC-FR-ENG-003-04 awards two tracks published at the same instant twice, the receipts differing in their subject", () => {
    const key = artistTakingPart();
    const instant = at(-5);
    const first = accepted(award(key, "TRACK_PUBLISHED", { at: instant, subject: "TRK-5518" }));
    const second = accepted(award(key, "TRACK_PUBLISHED", { at: instant, subject: "TRK-5519" }));
    expect(first.event).not.toBe(second.event);
    expect([first.points, second.points, first.replay, second.replay]).toEqual([50, 50, false, false]);
    expect(balance(key).data).toMatchObject({ points: 100, eventCount: 2 });
  });

  it("@AC-FR-ENG-003-02 returns the event recorded the first time when the identical action is redelivered", () => {
    const key = artistTakingPart();
    const instant = at(-5);
    const first = accepted(award(key, "ONBOARDING_COMPLETED", { at: instant }));
    const again = accepted(award(key, "ONBOARDING_COMPLETED", { at: instant }));
    expect(again).toEqual({ event: first.event, points: 20, replay: true });
    expect(balance(key).data).toMatchObject({ points: 20, eventCount: 1 });
  });

  it("@AC-FR-ENG-003-03 refuses the same action identity with a different payload, naming the event recorded and recording no second", () => {
    const key = artistTakingPart();
    const instant = at(-5);
    const first = accepted(award(key, "ONBOARDING_COMPLETED", { at: instant, digest: "sha256:20-points" }));
    const conflict = award(key, "ONBOARDING_COMPLETED", { at: instant, digest: "sha256:50-points" });
    expect(conflict.refusal).toEqual({ code: "QUALIFYING_ACTION_CONFLICT", values: { event: first.event } });
    expect(balance(key).data).toMatchObject({ points: 20, eventCount: 1 });
    expect(audit(key).find((row) => row.code === "QUALIFYING_ACTION_CONFLICT")).toMatchObject({ actor: "Phan Gia Lượng", subject: ARTIST_PARTY, detail: first.event });
  });

  it("refuses an act recorded by hand a second time under the artist's other display profile as a conflict", () => {
    const key = artistTakingPart();
    const instant = at(-5);
    accepted(award(key, "TRACK_PUBLISHED", { at: instant, subject: "TRK-5518", profile: "DPF-207415-1" }));
    expect(award(key, "TRACK_PUBLISHED", { at: instant, subject: "TRK-5518", profile: "DPF-207415-2" }).refusal?.code).toBe("QUALIFYING_ACTION_CONFLICT");
    expect(balance(key).data?.eventCount).toBe(1);
  });

  it("@AC-FR-ENG-011-02 attributes a track published under the artist's second profile to that profile, not to the participation's", () => {
    const key = artistTakingPart();
    const recorded = accepted(award(key, "TRACK_PUBLISHED", { subject: "TRK-5520", profile: "DPF-207415-2" }));
    const event = ledgerEventFor(key, ARTIST, recorded.event, null).data;
    expect(event?.displayProfile).toEqual({ ref: "DPF-207415-2", name: "Uyên và Gió Bấc" });
    expect(JSON.stringify(event)).not.toContain(MOCK_ARTIST.email);
  });

  it("refuses a display profile the participant does not hold with FIELD_MISSING, recording nothing", () => {
    const key = artistTakingPart();
    expect(award(key, "PROFILE_COMPLETED", { profile: "DPF-118342-1" }).refusal).toEqual({ code: "FIELD_MISSING", values: { field: "display_profile_ref" } });
    expect(balance(key).data?.eventCount).toBe(0);
  });

  it("offers SCR-ENG-08 the participant's display profiles once the participant resolves", () => {
    const key = artistTakingPart();
    const form = qualifyingActionForm(key, LUONG, { participant: ARTIST_PARTY, at: at(-1) }).data;
    expect(form?.profiles.map((profile) => profile.ref)).toEqual(["DPF-207415-1", "DPF-207415-2"]);
    expect(form?.resolution?.codes.map((code) => code.code)).toEqual(["ONBOARDING_COMPLETED", "TRACK_PUBLISHED", "PROFILE_COMPLETED"]);
  });
});

describe("POST /point-dispositions: every disposition is reserved by DEC-30", () => {
  it("@AC-FR-ENG-008-01 refuses a premises principal's exchange naming DEC-30, and the balance and ledger stay as they were", () => {
    const principal = asPrincipal(released());
    expect(takePart(principal, PRINCIPAL).refusal).toBeNull();
    const before = balance(principal, PRINCIPAL).data;
    expect(pointDisposition(principal, PRINCIPAL, "exchange").refusal).toEqual({ code: "POINT_DISPOSITION_RESERVED", values: { decision: "DEC-30" } });
    expect(balance(principal, PRINCIPAL).data).toMatchObject({ points: before?.points, eventCount: before?.eventCount });
  });

  it("@AC-FR-ENG-008-02 refuses an artist's transfer to another participant, and neither balance changes", () => {
    const key = artistTakingPart();
    const principal = asPrincipal(key);
    expect(takePart(principal, PRINCIPAL).refusal).toBeNull();
    accepted(award(key, "ONBOARDING_COMPLETED"));
    expect(pointDisposition(key, ARTIST, "transfer").refusal?.code).toBe("POINT_DISPOSITION_RESERVED");
    expect(balance(key, ARTIST).data).toMatchObject({ points: 20, eventCount: 1 });
    expect(balance(principal, PRINCIPAL).data).toMatchObject({ points: 0, eventCount: 0 });
  });

  it("@AC-FR-ENG-008-03 refuses an operations officer's expiry with POINT_EXPIRY_RESERVED and records the attempt", () => {
    const key = artistTakingPart();
    expect(pointDisposition(key, TRAM, "expiry").refusal).toEqual({ code: "POINT_EXPIRY_RESERVED", values: { decision: "DEC-30" } });
    expect(audit(key)[0]).toMatchObject({ actor: "Quan Ngọc Trâm", act: "submit_point_disposition", code: "POINT_EXPIRY_RESERVED", detail: "expiry", at: new Date(T0).toISOString() });
  });

  it("@AC-FR-ENG-018-03 leaves an aged balance unchanged when an expiry routine is triggered, recording no ledger event", () => {
    const key = artistTakingPart();
    accepted(award(key, "TRACK_PUBLISHED", { subject: "TRK-5518" }));
    vi.setSystemTime(new Date(Date.parse(T0) + 2 * 366 * 24 * 60 * 60_000));
    expect(pointDisposition(key, TRAM, "expiry").refusal?.code).toBe("POINT_EXPIRY_RESERVED");
    expect(balance(key).data).toMatchObject({ points: 50, eventCount: 1 });
  });

  it("records an attempt naming no kind as FIELD_MISSING, and refuses a member of staff who is no operations officer", () => {
    const key = artistTakingPart();
    expect(pointDisposition(key, ARTIST, "redeem").refusal).toEqual({ code: "FIELD_MISSING", values: { field: "disposition_kind" } });
    expect(audit(key)[0]).toMatchObject({ actor: MOCK_ARTIST.name, subject: ARTIST_PARTY, code: "FIELD_MISSING" });
    expect(pointDisposition(key, KHAI, "expiry").refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
  });
});

/** Trâm's support read of the artist, a correction of the event she proposes from it, and Khải's authorisation. */
function corrected(key: string, event: string, delta: string): string {
  const read = accepted(supportRead(key, TRAM, ARTIST_PARTY, "CAS-2027-000812")).read;
  const correction = accepted(proposeCorrection(key, TRAM, read, { event, ground: "ACTION_DID_NOT_OCCUR", delta })).correction;
  accepted(authoriseCorrection(key, KHAI, correction));
  return correction;
}

describe("GET /balance/as-at (FR-ENG-014)", () => {
  it("@AC-FR-ENG-014-01 reproduces the balance as at a past instant, listing the events recorded up to it", () => {
    const key = artistTakingPart();
    accepted(award(key, "ONBOARDING_COMPLETED"));
    vi.setSystemTime(new Date(at(1)));
    accepted(award(key, "TRACK_PUBLISHED", { subject: "TRK-5518" }));
    const cutOff = at(30);
    vi.setSystemTime(new Date(at(60)));
    accepted(award(key, "TRACK_PUBLISHED", { subject: "TRK-5519", at: at(59) }));
    const past = balanceOf(key, ARTIST, cutOff, null).data;
    expect(past).toMatchObject({ points: 70, eventCount: 2, asAt: cutOff, computedAt: cutOff });
    expect(past?.history.rows.map((row) => row.actionCode)).toEqual(["ONBOARDING_COMPLETED", "TRACK_PUBLISHED"]);
    expect(balance(key).data?.points).toBe(120);
  });

  it("@AC-FR-ENG-014-02 leaves a correction recorded later out of a past answer, naming the cut-off it was computed at", () => {
    const key = artistTakingPart();
    const event = accepted(award(key, "TRACK_PUBLISHED", { subject: "TRK-5518" })).event;
    const cutOff = at(30);
    vi.setSystemTime(new Date(at(120)));
    corrected(key, event, "-50");
    const past = balanceOf(key, ARTIST, cutOff, null).data;
    expect(past).toMatchObject({ points: 50, eventCount: 1, computedAt: cutOff });
    expect(past?.history.rows[0]?.correctedBy).toBeNull();
    const today = balance(key).data;
    expect(today).toMatchObject({ points: 0, eventCount: 2 });
    expect(today?.history.rows[0]?.correctedBy).not.toBeNull();
  });

  it("@AC-FR-ENG-014-03 returns the first event alone at the instant it was recorded", () => {
    const key = artistTakingPart();
    const first = accepted(award(key, "ONBOARDING_COMPLETED"));
    const recordedAt = ledgerEventFor(key, ARTIST, first.event, null).data?.recordedAt ?? "";
    vi.setSystemTime(new Date(at(10)));
    accepted(award(key, "PROFILE_COMPLETED", { at: at(9) }));
    expect(balanceOf(key, ARTIST, recordedAt, null).data).toMatchObject({ points: 20, eventCount: 1 });
  });

  it("@AC-FR-ENG-014-04 refuses an instant in the future, naming now as the latest that may be asked, and returns no figure", () => {
    const key = artistTakingPart();
    accepted(award(key, "ONBOARDING_COMPLETED"));
    const refused = balanceOf(key, ARTIST, "2027-10-17T09:00:00+07:00", null);
    expect(refused.data).toBeNull();
    expect(refused.failure?.code).toBe("AS_AT_IN_FUTURE");
    expect(refused.named).toEqual({ latest: new Date(T0).toISOString() });
    expect(balance(key).data?.points).toBe(20);
  });

  it("answers an auditor under an assurance engagement and records the read with the participant, the engagement and the instant", () => {
    const key = artistTakingPart();
    accepted(award(key, "ONBOARDING_COMPLETED"));
    const answer = assuranceBalance(key, CUONG, { participant: ARTIST_PARTY, engagement: "ASR-2026-07", asAt: at(0) }, null);
    expect(answer.data).toMatchObject({ points: 20, eventCount: 1 });
    expect(audit(key).find((row) => row.act === "read_balance_as_at")).toMatchObject({ actor: "Lê Văn Cường", subject: ARTIST_PARTY, code: null, detail: `engagement ASR-2026-07; as_at ${at(0)}` });
  });

  it("refuses an auditor naming no engagement, and a member of staff who is no auditor, with PARTICIPANT_NOT_SELF, recording both", () => {
    const key = artistTakingPart();
    expect(assuranceBalance(key, CUONG, { participant: ARTIST_PARTY, engagement: " ", asAt: at(0) }, null).failure?.code).toBe("PARTICIPANT_NOT_SELF");
    expect(assuranceBalance(key, TRAM, { participant: ARTIST_PARTY, engagement: "ASR-2026-07", asAt: at(0) }, null).failure?.code).toBe("PARTICIPANT_NOT_SELF");
    const reads = audit(key).filter((row) => row.act === "read_balance_as_at");
    expect(reads.map((row) => [row.actor, row.code])).toEqual([
      ["Quan Ngọc Trâm", "PARTICIPANT_NOT_SELF"],
      ["Lê Văn Cường", "PARTICIPANT_NOT_SELF"],
    ]);
  });
});

describe("SCR-ENG-09: no correction is recorded while the capability is withheld", () => {
  it("refuses an authorisation after the release was withdrawn with CAPABILITY_WITHHELD, recording no ledger event", () => {
    const key = artistTakingPart();
    const event = accepted(award(key, "TRACK_PUBLISHED", { subject: "TRK-5518" })).event;
    const read = accepted(supportRead(key, TRAM, ARTIST_PARTY, "CAS-2027-000812")).read;
    const correction = accepted(proposeCorrection(key, TRAM, read, { event, ground: "ACTION_DID_NOT_OCCUR", delta: "-50" })).correction;
    accepted(withdrawRelease(key, KHAI, "Bằng chứng về quyền sở hữu chỉ số đã hết hiệu lực."));
    expect(correctionView(key, KHAI, correction).data?.capability.state).toBe("WITHHELD");
    expect(authoriseCorrection(key, KHAI, correction).refusal?.code).toBe("CAPABILITY_WITHHELD");
    expect(correctionView(key, KHAI, correction).data).toMatchObject({ authorisedBy: null, correctingEvent: null });
  });
});

describe("the disclosure version and its lapse (FR-ENG-019)", () => {
  it("@AC-FR-ENG-019-03 refuses the balance once no version is effective, naming no figure, and the points are unchanged once one is", () => {
    const key = artistTakingPart();
    accepted(award(key, "ONBOARDING_COMPLETED"));
    expect(accepted(endDisclosure(key, CUONG)).no).toBe(1);
    const refused = balance(key);
    expect(refused.data).toBeNull();
    expect(refused.failure?.code).toBe("DISCLOSURE_VERSION_NOT_EFFECTIVE");
    expect(disclosureFor(key).failure?.code).toBe("DISCLOSURE_VERSION_NOT_EFFECTIVE");
    accepted(approveDisclosure(key, CUONG, { textEn: "Your points confer no entitlement.", textVi: "Điểm của bạn không đem lại quyền lợi nào.", reservingDecision: "DEC-30", effectiveFrom: at(5) }));
    vi.setSystemTime(new Date(at(6)));
    expect(balance(key).data).toMatchObject({ points: 20, eventCount: 1, disclosure: { no: 2 } });
  });

  it("keeps the ended version readable with its period as ENDED, and refuses ending one when none is effective", () => {
    const key = released();
    accepted(endDisclosure(key, CUONG));
    const versions = disclosureVersions(key, CUONG).data;
    expect(versions?.lapsed).toBe(true);
    expect(versions?.versions[0]).toMatchObject({ no: 1, state: "ENDED", effectiveTo: new Date(T0).toISOString() });
    expect(endDisclosure(key, CUONG).refusal?.code).toBe("DISCLOSURE_VERSION_NOT_EFFECTIVE");
    expect(audit(key)[0]).toMatchObject({ actor: "Lê Văn Cường", act: "end_disclosure_version", subject: "DSC-1" });
  });

  it("refuses anyone but the DPO an end to the effective version, and the version stays effective", () => {
    const key = released();
    expect(endDisclosure(key, TRAM).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(disclosureFor(key).data?.effective.no).toBe(1);
  });

  it("names a version superseded by its successor SUPERSEDED, not ENDED", () => {
    const key = released();
    accepted(approveDisclosure(key, CUONG, { textEn: "Version two.", textVi: "Phiên bản hai.", reservingDecision: "DEC-30", effectiveFrom: at(5) }));
    vi.setSystemTime(new Date(at(6)));
    expect(disclosureFor(key).data?.earlier.map((version) => [version.no, version.state])).toEqual([[1, "SUPERSEDED"]]);
  });
});

/** Notices COM raised for one class of the engagement family's events. */
const noticesOfClass = (key: string, classCode: string) => noticeQueue(key, { name: "Phan Gia Lượng", roles: ["ACT-OPS"] }, { classCode, state: null, dueFrom: null, dueTo: null }, null).data?.rows ?? [];

describe("NTF-ENG-01 and NTF-ENG-02 through COM", () => {
  it("raises NTF-ENG-01 on a release, and on a suspension to every participant taking part as well as the operations role", () => {
    const key = released();
    const afterRelease = noticesOfClass(key, "engagement_capability_change").length;
    expect(afterRelease).toBeGreaterThan(0);
    expect(takePart(key, ARTIST).refusal).toBeNull();
    expect(takePart(asPrincipal(key), PRINCIPAL).refusal).toBeNull();
    accepted(suspendRelease(key, KHAI, "Kiểm tra lại bằng chứng về điều chỉnh."));
    expect(noticesOfClass(key, "engagement_capability_change").length).toBe(afterRelease * 2 + 2);
  });

  it("issues NTF-ENG-01's copy to the operations role at the office COM's contact register names, rather than leaving it UNMET", () => {
    const key = released();
    // Nobody takes part at the release, so its one NTF-ENG-01 is the copy to ACT-OPS.
    const copies = noticesOfClass(key, "engagement_capability_change");
    expect(copies).toHaveLength(1);
    expect(copies[0]?.state).not.toBe("UNMET");
    expect(copies[0]?.issuedAt).not.toBeNull();
    const opened = noticeQueue(key, { name: "Phan Gia Lượng", roles: ["ACT-OPS"] }, { classCode: null, state: null, dueFrom: null, dueTo: null }, copies[0]?.reference ?? "").data?.opened;
    expect(opened?.destination).toBe(officeDestinationOf(key, "engagement_capability_changed"));
    expect(opened?.destination).not.toBeNull();
  });

  it("raises NTF-ENG-01 again when the release is withdrawn, one notice per transition and recipient", () => {
    const key = artistTakingPart();
    const before = noticesOfClass(key, "engagement_capability_change").length;
    accepted(withdrawRelease(key, KHAI, "Bằng chứng về quyền sở hữu chỉ số đã hết hiệu lực."));
    expect(noticesOfClass(key, "engagement_capability_change").length).toBe(before * 2 + 1);
  });

  it("raises NTF-ENG-02 to each participant taking part when a new disclosure version is approved", () => {
    const key = artistTakingPart();
    expect(takePart(asPrincipal(key), PRINCIPAL).refusal).toBeNull();
    expect(noticesOfClass(key, "engagement_disclosure")).toHaveLength(0);
    accepted(approveDisclosure(key, CUONG, { textEn: "Version two.", textVi: "Phiên bản hai.", reservingDecision: "DEC-30", effectiveFrom: at(5) }));
    expect(noticesOfClass(key, "engagement_disclosure")).toHaveLength(2);
  });
});

/** Version 2, prepared by Trâm with a referral programme, approved by Lượng effective an hour from now. */
function referralVersion(key: string): void {
  const no = accepted(prepareRuleVersion(key, TRAM)).no;
  accepted(submitRuleVersion(key, TRAM, no, { effectiveFrom: at(60), referral: true }));
  accepted(approveRuleVersion(key, LUONG, no, null));
}

describe("GET and POST /referral-reference (SCR-ENG-05)", () => {
  it("@AC-FR-ENG-006-04 refuses a reference while no programme is enabled, naming DEC-30, and stores none", () => {
    const key = artistTakingPart();
    expect(requestReferralReference(key, ARTIST).refusal).toEqual({ code: "REFERRAL_PROGRAMME_NOT_ENABLED", values: { decision: "DEC-30" } });
    const read = referralReference(key, ARTIST);
    expect(read.failure?.code).toBe("REFERRAL_PROGRAMME_NOT_ENABLED");
    expect(read.named).toEqual({ decision: "DEC-30" });
  });

  it("@AC-FR-ENG-006-03 issues an opaque twelve-character reference against the display profile once a version enables a programme", () => {
    const key = artistTakingPart();
    referralVersion(key);
    vi.setSystemTime(new Date(at(61)));
    const issued = accepted(requestReferralReference(key, ARTIST));
    expect(issued.reference).toMatch(/^[A-Z0-9]{12}$/);
    expect(issued.reference).not.toContain("207415");
    expect(referralReference(key, ARTIST).data).toMatchObject({ programme: { version: 2 }, reference: { value: issued.reference, displayProfile: { ref: "DPF-207415-1" } }, takingPart: true });
  });

  it("returns the reference already issued to a repeat request rather than a second one", () => {
    const key = artistTakingPart();
    referralVersion(key);
    vi.setSystemTime(new Date(at(61)));
    const first = accepted(requestReferralReference(key, ARTIST));
    expect(accepted(requestReferralReference(key, ARTIST))).toEqual({ ...first, replay: true });
  });

  it("refuses an artist who does not take part with PARTICIPATION_NOT_ENROLLED, and a premises principal with ROLE_OUT_OF_SCOPE", () => {
    const key = released();
    referralVersion(key);
    vi.setSystemTime(new Date(at(61)));
    expect(requestReferralReference(key, ARTIST).refusal?.code).toBe("PARTICIPATION_NOT_ENROLLED");
    expect(referralReference(key, ARTIST).data).toMatchObject({ reference: null, takingPart: false });
    expect(requestReferralReference(key, PRINCIPAL).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
  });

  it("refuses a reference with CAPABILITY_WITHHELD where a programme is enabled and the capability is not released", () => {
    const key = signIn(PEOPLE.artist);
    const beside = signInBeside(key, PEOPLE.preparer);
    referralVersion(beside);
    vi.setSystemTime(new Date(at(61)));
    expect(requestReferralReference(key, ARTIST).refusal?.code).toBe("CAPABILITY_WITHHELD");
    expect(referralReference(key, ARTIST).failure?.code).toBe("CAPABILITY_WITHHELD");
  });
});

describe("the premises side of ENG is the principal's alone (PERM-129, 132 to 135, 138 name no delegate)", () => {
  /** Hầu Ngọc Ánh and Giang Thục Quyên, as the seam hands a premises-portal participant to the backend. */
  const DELEGATE: EngagementReader = { kind: "participant", organisation: "tcv", name: "Hầu Ngọc Ánh" };
  const REVOKED: EngagementReader = { kind: "participant", organisation: "tcv", name: "Giang Thục Quyên" };

  it("answers the principal, and refuses the delegate every act and read for the organisation with ROLE_OUT_OF_SCOPE", () => {
    const key = released();
    const principal = asPrincipal(key);
    const delegate = signInBeside(key, PEOPLE.delegate);
    expect(participationOf(principal, PRINCIPAL).data?.state).toBe("NOT_ENROLLED");
    expect(disclosureFor(principal, PRINCIPAL).data?.effective.no).toBe(1);
    expect(takePart(delegate, DELEGATE).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(participationOf(delegate, DELEGATE).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(disclosureFor(delegate, DELEGATE).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(takePart(principal, PRINCIPAL).refusal).toBeNull();
    // Taking part is the principal's, and so are the balance, the disposition and the withdrawal.
    expect(balanceOf(delegate, DELEGATE, null, null).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(pointDisposition(delegate, DELEGATE, "exchange").refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(stopTakingPart(delegate, DELEGATE).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(participationOf(principal, PRINCIPAL).data?.state).toBe("ENROLLED");
  });

  it("refuses a delegate whose authority was revoked as it refuses any delegate", () => {
    const key = released();
    const revoked = signInBeside(key, PEOPLE.revokedDelegate);
    expect(takePart(revoked, REVOKED).refusal?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(balanceOf(revoked, REVOKED, null, null).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
    expect(disclosureFor(revoked, REVOKED).failure?.code).toBe("ROLE_OUT_OF_SCOPE");
  });
});
