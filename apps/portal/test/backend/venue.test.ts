import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// First: COM's module imports VEN's, so VEN is loaded before COM and reads the stand-in below rather than COM itself.
import {
  acceptTerms,
  approveMoodVersion,
  caseFile,
  createMood,
  createPlaylist,
  defaultPlaylistSet,
  documentFile,
  documentStep,
  enrolPremises,
  entitlementForDocument,
  fallbackList,
  issueDocument,
  moodVersion,
  playlistEditor,
  playlistList,
  register,
  requestEnding,
  revisePlaylist,
  saveSchedule,
  scheduleStep,
  serviceList,
  serviceRecord,
  withdrawSchedule,
} from "@/lib/mock/backend/venue";
import type { Staff } from "@/lib/api/session";
import type { ResolvedPeriod, TermsDocument } from "@/lib/api/venue";
import { shownTermsDigest } from "@/lib/api/venue-terms";
import { findAccount } from "@/lib/mock/backend/accounts";
import type * as Notices from "@/lib/mock/backend/notices";
import { noticesTo, recordNoticeEvent, type NoticeEvent } from "@/lib/mock/backend/notices";
import { recordPremisesChange } from "@/lib/mock/backend/premises";
import { sessions } from "@/lib/mock/backend/store";
import type * as VenueSeed from "@/lib/mock/venue";
import { RULES, TERMS } from "@/lib/mock/venue";
import { PEOPLE, signIn, signInBeside } from "./harness";

/**
 * Two of GOV's rule versions as the backend reads them. `VEN-FALLBACK-MOOD` (CFG-292): the seed designates no mood,
 * the tested default of Q-VEN-04, and a scenario that needs one approves it here. `VEN-ENTITLEMENT-WORDING` (CFG-16):
 * the seed's version, which a scenario may date later to have none in force.
 */
const gov = vi.hoisted(() => ({
  fallbackMood: [] as { version: string; effectiveFrom: string; mood: string }[],
  wording: { code: "VEN-ENTITLEMENT-WORDING", version: "", effectiveFrom: "" },
  seedWording: { code: "VEN-ENTITLEMENT-WORDING", version: "", effectiveFrom: "" },
}));

vi.mock("@/lib/mock/venue", async (importOriginal) => {
  const actual = await importOriginal<typeof VenueSeed>();
  Object.assign(gov.seedWording, actual.WORDING_RULE);
  Object.assign(gov.wording, actual.WORDING_RULE);
  return { ...actual, FALLBACK_MOOD_RULE: gov.fallbackMood, WORDING_RULE: gov.wording };
});

/** COM raises what VEN asks it to; a scenario that needs a raise to fail (EXC-VEN-06) names the event kind here. */
const failing = new Set<string>();

vi.mock("@/lib/mock/backend/notices", async (importOriginal) => {
  const actual = await importOriginal<typeof Notices>();
  return {
    ...actual,
    recordNoticeEvent: vi.fn((key: string, event: NoticeEvent) => (failing.has(event.eventKind) ? null : actual.recordNoticeEvent(key, event))),
  };
});

// A world's first read replays the eligibility sweep since the baseline took effect, and seeds the families it reads.
vi.setConfig({ testTimeout: 30_000 });

/** Then Cửa Việt, the party the principal acts for, and its services and playlists as the seed holds them. */
const TCV = "tcv";
const PASTEUR = "RPS-7K2MQXB4TD";
const NGUYEN_HUE = "RPS-W5LQ3ZK7NA";
const SALA = "RPS-B2XR6MJH5P";
const PASTEUR_RECORD = "PRM-5PSR9VJA";
/** Then Cửa Việt's record in PTY's party register, and The Lintel's. */
const THEN_CUA_PARTY = "PTY-118342";
const LINTEL_PARTY = "PTY-127730";
const PASTEUR_DOCUMENT = "K3VQ7M2XRDZ5PWN4TB6HCJYLAE";
/** Sáng mở cửa, Pasteur's default; Trưa văn phòng, its weekday lunch list; Acoustic cuối tuần, its weekend list. */
const SANG = "PLS-4MQXT7KD2B";
const TRUA = "PLS-7TRW2NVA5H";
const ACOUSTIC = "PLS-9ACW5QJR2D";
/** Trưa văn phòng on weekdays from 11:00 to 13:30, and Acoustic cuối tuần on Friday to Sunday from 20:00 to 23:00. */
const LUNCH = "SCH-8TRW4MQZ3N";
const WEEKEND = "SCH-6ACW9KTH2R";
/** Khách sớm, a shared mood in effect at version 2 since 15 August 2026, both of its tracks eligible. */
const KHACH_SOM = "MOD-KHACH-SOM";
const KHACH_SOM_V2 = "SMV-2KSM6TD9QH";
/** The one track CAT revoked: eligible under the direct licence until 09:10 on Friday 25 September 2026. */
const REVOKED_TRACK = "TRK-CNL-LAU3";
const ELIGIBLE_TRACK = "TRK-CNL-ACOUSTIC";

const vn = (instant: string) => new Date(instant).toISOString();

/** Moves the clock the mock backend reads, leaving timers alone. */
function at(instant: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

const nameOf = (email: string): string => findAccount(email)?.name ?? email;

/** The member of staff a session names, as `requireStaff` hands them to the backend. */
function staffOf(sessionId: string): Staff {
  const account = findAccount(sessions().get(sessionId)?.email ?? "");
  if (account === null) throw new Error(`no staff session ${sessionId}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

/** The principal of Then Cửa Việt signed in, in a world of their own. */
const principal = () => signIn(PEOPLE.principal, { organisation: TCV });

/** The periods GET /schedule-resolutions answers for a window, as of a Vietnam date and time (YYYY-MM-DDTHH:MM). */
function periods(key: string, code: string, from: string, to: string, asOf: string): readonly ResolvedPeriod[] {
  const step = scheduleStep(key, TCV, code, { from, to, asOf });
  if (step.data === null) throw new Error(`schedule of ${code} not read: ${step.failure?.code ?? ""}`);
  if (step.data.resolution.periods === null) throw new Error(`week refused: ${String(step.data.resolution.refusal)}`);
  return step.data.resolution.periods;
}

/** The period of a date a local time falls in. */
function periodOf(all: readonly ResolvedPeriod[], date: string, time: string): ResolvedPeriod {
  const found = all.find((period) => period.date === date && period.start <= time && time < (period.end === "24:00" ? "24:00" : period.end));
  if (found === undefined) throw new Error(`no period at ${date} ${time}`);
  return found;
}

/** The effective premises service terms as PUB answers them to the seam, and the digest of the text shown. */
const EFFECTIVE: TermsDocument = { version: TERMS.version, documentId: TERMS.documentId, effective: TERMS.effective, title: TERMS.title, sections: TERMS.sections };
const acceptance = { termsVersion: EFFECTIVE.version, termsDocumentId: EFFECTIVE.documentId, shownTextDigest: shownTermsDigest(EFFECTIVE, "vi"), attestationConfirmed: true };

/** The events VEN raised through COM since the test began, of one kind. */
const raised = (eventKind: string): NoticeEvent[] =>
  vi
    .mocked(recordNoticeEvent)
    .mock.calls.map(([, event]) => event)
    .filter((event) => event.eventKind === eventKind);

/** The notices COM sent the party of one class, with the values their content was composed from. */
const sent = (key: string, classCode: string) => (noticesTo(key, TCV).data ?? []).filter((notice) => notice.classCode === classCode);

beforeEach(() => {
  gov.fallbackMood.length = 0;
  Object.assign(gov.wording, gov.seedWording);
  failing.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(recordNoticeEvent).mockClear();
});

// ---------------------------------------------------------------- FR-VEN-015

describe("a past period resolves with what was in force then (FR-VEN-015, ALG-230)", () => {
  it("@AC-FR-VEN-015-02 reproduces a past period identically after its schedule was withdrawn and replaced and its playlist revised", () => {
    at("2026-10-12T12:00:00+07:00");
    const key = principal();
    const before = periodOf(periods(key, PASTEUR, "2026-10-12", "2026-10-12", "2026-10-12T12:00"), "2026-10-12", "11:00");
    expect(before).toMatchObject({ outcome: "SCHEDULED", reason: "SCHEDULE_APPLIES", schedule: LUNCH, playlistId: TRUA, revision: 2, ruleVersion: RULES.version });

    at("2026-10-14T10:00:00+07:00");
    expect(revisePlaylist(key, TCV, PASTEUR, TRUA, [{ kind: "TRACK", ref: ELIGIBLE_TRACK }]).accepted).toEqual({ revision: 3 });
    expect(withdrawSchedule(key, TCV, PASTEUR, LUNCH, "").refusal).toBeNull();
    const replaced = saveSchedule(key, TCV, PASTEUR, { playlist: SANG, days: [1, 2, 3, 4, 5], start: "11:00", end: "13:30", from: "2026-10-14", to: null, replaces: null });
    expect(replaced.refusal).toBeNull();

    // Asked as of the past instant, or as of now: a past period reads what was known when it began.
    expect(periodOf(periods(key, PASTEUR, "2026-10-12", "2026-10-12", "2026-10-12T12:00"), "2026-10-12", "11:00")).toEqual(before);
    expect(periodOf(periods(key, PASTEUR, "2026-10-12", "2026-10-12", "2026-10-14T10:00"), "2026-10-12", "11:00")).toEqual(before);
    expect(periodOf(periods(key, PASTEUR, "2026-10-15", "2026-10-15", "2026-10-14T10:00"), "2026-10-15", "11:00")).toMatchObject({
      outcome: "SCHEDULED",
      schedule: replaced.accepted?.schedule,
      playlistId: SANG,
    });
  });

  it("keeps every revision of a playlist: the editor shows the new one, and a period before it names the one it played", () => {
    at("2026-10-12T09:00:00+07:00");
    const key = principal();
    at("2026-10-13T10:00:00+07:00");
    expect(revisePlaylist(key, TCV, PASTEUR, TRUA, [{ kind: "TRACK", ref: ELIGIBLE_TRACK }]).accepted).toEqual({ revision: 3 });
    const editor = playlistEditor(key, TCV, PASTEUR, TRUA).data;
    expect(editor?.playlist?.revision).toBe(3);
    expect(editor?.items.map((item) => item.ref)).toEqual([ELIGIBLE_TRACK]);
    const week = periods(key, PASTEUR, "2026-10-12", "2026-10-14", "2026-10-13T10:00");
    expect(periodOf(week, "2026-10-12", "11:00")).toMatchObject({ playlistId: TRUA, revision: 2 });
    expect(periodOf(week, "2026-10-14", "11:00")).toMatchObject({ playlistId: TRUA, revision: 3 });
  });

  it("resolves a day before a change of default to the default it had then, and a later day to the new one", () => {
    at("2026-10-13T10:00:00+07:00");
    const key = principal();
    expect(defaultPlaylistSet(key, TCV, PASTEUR, TRUA).accepted).toEqual({ playlist: TRUA });
    expect(playlistList(key, TCV, PASTEUR, null).data?.defaultPlaylist?.id).toBe(TRUA);
    const week = periods(key, PASTEUR, "2026-10-12", "2026-10-14", "2026-10-13T10:00");
    expect(periodOf(week, "2026-10-12", "08:00")).toMatchObject({ outcome: "DEFAULT_PLAYLIST", reason: "NO_SCHEDULE_MATCHES", playlistId: SANG });
    expect(periodOf(week, "2026-10-14", "08:00")).toMatchObject({ outcome: "DEFAULT_PLAYLIST", reason: "NO_SCHEDULE_MATCHES", playlistId: TRUA });
  });

  it("@AC-FR-VEN-015-01 names the rule version applied on every period of the week", () => {
    at("2026-10-12T09:00:00+07:00");
    const week = periods(principal(), PASTEUR, "2026-10-12", "2026-10-18", "2026-10-12T09:00");
    expect(week.length).toBeGreaterThan(7);
    expect(new Set(week.map((period) => period.ruleVersion))).toEqual(new Set([RULES.version]));
  });
});

// ---------------------------------------------------------------- FR-VEN-016, FR-VEN-007

describe("the default playlist, then the designated fallback mood, then nothing (FR-VEN-016, DR-15 rows 2 to 5)", () => {
  /** GOV approves Khách sớm as the fallback mood from the day the baseline took effect. */
  const designate = () => gov.fallbackMood.push({ version: "1", effectiveFrom: "2026-09-01", mood: KHACH_SOM });

  /** Pasteur's default set, on 20 September, to the weekend list, whose only track stops being eligible on the 25th. */
  function defaultThatLosesItsTrack(): string {
    at("2026-09-20T10:00:00+07:00");
    const key = principal();
    expect(defaultPlaylistSet(key, TCV, PASTEUR, ACOUSTIC).refusal).toBeNull();
    at("2026-10-16T10:00:00+07:00");
    return key;
  }

  it("@AC-FR-VEN-016-01 plays the default the premises maintains ahead of a designated fallback mood", () => {
    designate();
    at("2026-10-16T10:00:00+07:00");
    const period = periodOf(periods(principal(), PASTEUR, "2026-10-16", "2026-10-16", "2026-10-16T10:00"), "2026-10-16", "08:00");
    expect(period).toMatchObject({ outcome: "DEFAULT_PLAYLIST", reason: "NO_SCHEDULE_MATCHES", playlistId: SANG, mood: null });
  });

  it("@AC-FR-VEN-016-02 gives a premises that never set a default the designated shared mood", () => {
    designate();
    at("2026-10-16T10:00:00+07:00");
    const key = principal();
    const code = enrolPremises(key, TCV, nameOf(PEOPLE.principal), "ltt").accepted?.code ?? "";
    expect(code).toMatch(/^RPS-/);
    const period = periodOf(periods(key, code, "2026-10-17", "2026-10-17", "2026-10-16T10:00"), "2026-10-17", "09:00");
    expect(period).toMatchObject({ outcome: "FALLBACK_MOOD", reason: "DEFAULT_REPLACED_BY_MOOD", playlist: "Khách sớm", playlistId: null, mood: { id: KHACH_SOM, version: KHACH_SOM_V2, no: 2 } });
  });

  it("@AC-FR-VEN-002-01 activates a premises with no default of its own on the designated mood, keeping the evidence of the acceptance", () => {
    designate();
    at("2026-10-16T10:15:00+07:00");
    const key = principal();
    const code = enrolPremises(key, TCV, nameOf(PEOPLE.principal), "ltt").accepted?.code ?? "";
    const answer = acceptTerms(key, TCV, nameOf(PEOPLE.principal), code, acceptance, EFFECTIVE, "Công ty TNHH Then Cửa Việt");
    expect(answer.accepted).toEqual({ activatedAt: vn("2026-10-16T10:15:00+07:00") });
    const record = serviceRecord(key, TCV, code).data;
    expect(record?.status).toBe("ACTIVE");
    expect(record?.terms).toMatchObject({ version: TERMS.version, acceptedBy: nameOf(PEOPLE.principal), acceptedAt: vn("2026-10-16T10:15:00+07:00") });
  });

  it("@AC-FR-VEN-002-04 refuses activation with no usable default while no fallback mood is designated (Q-VEN-04)", () => {
    at("2026-10-16T10:15:00+07:00");
    const key = principal();
    const code = enrolPremises(key, TCV, nameOf(PEOPLE.principal), "ltt").accepted?.code ?? "";
    expect(acceptTerms(key, TCV, nameOf(PEOPLE.principal), code, acceptance, EFFECTIVE, "Công ty TNHH Then Cửa Việt").refusal?.code).toBe("NO_DEFAULT_CONTENT");
    expect(serviceRecord(key, TCV, code).data).toMatchObject({ status: "PENDING_TERMS", terms: null });
  });

  it("@AC-FR-VEN-007-02 falls to the designated mood when the default has lost its last eligible track", () => {
    designate();
    const key = defaultThatLosesItsTrack();
    const period = periodOf(periods(key, PASTEUR, "2026-10-16", "2026-10-16", "2026-10-16T10:00"), "2026-10-16", "08:00");
    expect(period).toMatchObject({ outcome: "FALLBACK_MOOD", reason: "DEFAULT_REPLACED_BY_MOOD", playlist: "Khách sớm", mood: { version: KHACH_SOM_V2 } });
  });

  it("@AC-FR-VEN-016-04 resolves nothing playable where the default lost its last eligible track and no mood is designated", () => {
    const key = defaultThatLosesItsTrack();
    const period = periodOf(periods(key, PASTEUR, "2026-10-16", "2026-10-16", "2026-10-16T10:00"), "2026-10-16", "08:00");
    expect(period).toMatchObject({ outcome: "NO_PLAYABLE_SCHEDULE", reason: "NO_PLAYABLE_CONTENT", playlist: null, playlistId: null, mood: null });
  });

  it("@AC-FR-VEN-016-03 refuses a default playlist with no eligible track, and the default stays", () => {
    at("2026-10-16T10:00:00+07:00");
    const key = principal();
    expect(defaultPlaylistSet(key, TCV, PASTEUR, ACOUSTIC).refusal?.code).toBe("PLAYLIST_NO_ELIGIBLE_TRACK");
    expect(playlistList(key, TCV, PASTEUR, null).data?.defaultPlaylist?.id).toBe(SANG);
  });
});

// ---------------------------------------------------------------- FR-VEN-017

describe("a scheduled playlist that loses its last eligible track falls back, and the premises is told (FR-VEN-017, ALG-231)", () => {
  /** The weekend period of Friday 25 September: Chill tối plays to 22:00, then Acoustic cuối tuần is scheduled. */
  const FRIDAY = { date: "2026-09-25", start: "22:00", end: "23:00" };
  const RUN = vn("2026-09-25T09:15:00+07:00");

  it("records nothing before the sweep's run after the change", () => {
    at("2026-09-25T09:12:00+07:00");
    const key = principal();
    expect(fallbackList(key, TCV, PASTEUR).data?.items).toEqual([]);
  });

  it("@AC-FR-VEN-017-01 records the fallback of the period at the run after the track stopped being eligible, and the period plays the default", () => {
    at("2026-09-25T09:20:00+07:00");
    const key = principal();
    const items = fallbackList(key, TCV, PASTEUR).data?.items ?? [];
    expect(items).toContainEqual(
      expect.objectContaining({ ...FRIDAY, schedule: WEEKEND, playlist: { id: ACOUSTIC, name: "Acoustic cuối tuần", archived: false }, cause: "PLAYLIST_NO_ELIGIBLE_TRACK", resolvedTo: "DEFAULT_PLAYLIST", detectedAt: RUN }),
    );
    // The sweep looks one day ahead, and a second read of the same run records nothing twice.
    expect(items.map((item) => item.date)).toEqual(["2026-09-26", "2026-09-25"]);
    expect(fallbackList(key, TCV, PASTEUR).data?.items).toHaveLength(2);
    expect(periodOf(periods(key, PASTEUR, FRIDAY.date, FRIDAY.date, "2026-09-25T09:20"), FRIDAY.date, "22:00")).toMatchObject({
      outcome: "DEFAULT_PLAYLIST",
      reason: "SCHEDULED_PLAYLIST_UNUSABLE",
      schedule: WEEKEND,
      lost: "Acoustic cuối tuần",
      playlistId: SANG,
    });
    expect(playlistList(key, TCV, PASTEUR, null).data?.items.find((row) => row.id === ACOUSTIC)?.status).toBe("NO_ELIGIBLE_TRACK");
  });

  it("@AC-FR-VEN-017-02 tells the premises within fifteen minutes of the change, naming the period, the cause and what plays instead", () => {
    at("2026-09-25T09:20:00+07:00");
    const key = principal();
    const row = fallbackList(key, TCV, PASTEUR).data?.items.find((item) => item.date === FRIDAY.date);
    const notice = sent(key, "schedule_fallback").find((candidate) => candidate.content?.values.period === "2026-09-25 22:00-23:00");
    expect(notice?.reference).toBe(row?.notice);
    expect(notice?.issuedAt).toBe(RUN);
    expect(notice?.content?.values).toMatchObject({ playlist: "Acoustic cuối tuần", cause: "PLAYLIST_NO_ELIGIBLE_TRACK", resolvedTo: "DEFAULT_PLAYLIST", instead: "Sáng mở cửa" });
  });

  it("@AC-FR-VEN-017-03 plays the playlist again from the next period once it holds an eligible track, the recorded fallback unchanged", () => {
    at("2026-09-25T09:20:00+07:00");
    const key = principal();
    const recorded = fallbackList(key, TCV, PASTEUR).data?.items.find((item) => item.date === FRIDAY.date);
    at("2026-09-26T17:59:00+07:00");
    expect(revisePlaylist(key, TCV, PASTEUR, ACOUSTIC, [{ kind: "TRACK", ref: ELIGIBLE_TRACK }]).accepted).toEqual({ revision: 2 });
    expect(periodOf(periods(key, PASTEUR, "2026-09-26", "2026-09-26", "2026-09-26T17:59"), "2026-09-26", "20:00")).toMatchObject({
      outcome: "SCHEDULED",
      schedule: WEEKEND,
      playlistId: ACOUSTIC,
      revision: 2,
    });
    expect(fallbackList(key, TCV, PASTEUR).data?.items.find((item) => item.date === FRIDAY.date)).toEqual(recorded);
  });

  it("@AC-FR-VEN-017-04 refuses a new schedule naming the playlist that holds no eligible track", () => {
    at("2026-10-16T10:00:00+07:00");
    const key = principal();
    const before = scheduleStep(key, TCV, PASTEUR, null).data?.schedules.length;
    const answer = saveSchedule(key, TCV, PASTEUR, { playlist: ACOUSTIC, days: [6], start: "18:00", end: "22:00", from: null, to: null, replaces: null });
    expect(answer.refusal).toEqual({ code: "PLAYLIST_NO_ELIGIBLE_TRACK", field: "playlist", item: null });
    expect(scheduleStep(key, TCV, PASTEUR, null).data?.schedules.length).toBe(before);
  });

  it("@AC-FR-VEN-017-05 records the fallback with an empty notice reference when the notice cannot be raised, and operations sees it", () => {
    failing.add("schedule_fell_back");
    at("2026-09-25T09:20:00+07:00");
    const key = principal();
    const row = fallbackList(key, TCV, PASTEUR).data?.items.find((item) => item.date === FRIDAY.date);
    expect(row).toMatchObject({ ...FRIDAY, cause: "PLAYLIST_NO_ELIGIBLE_TRACK", resolvedTo: "DEFAULT_PLAYLIST", notice: null });
    expect(periodOf(periods(key, PASTEUR, FRIDAY.date, FRIDAY.date, "2026-09-25T09:20"), FRIDAY.date, "22:00")).toMatchObject({ outcome: "DEFAULT_PLAYLIST", playlistId: SANG });
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const file = caseFile(key, officer, PASTEUR, null).data?.fallbacks;
    expect(file?.withheld).toBe(false);
    expect(file !== undefined && !file.withheld ? file.items.find((item) => item.date === FRIDAY.date)?.notice : "absent").toBeNull();
  });

  it("raises the notice again at the next run while the period has not ended, with the same facts, and leaves the row as written", () => {
    failing.add("schedule_fell_back");
    at("2026-09-25T09:20:00+07:00");
    const key = principal();
    fallbackList(key, TCV, PASTEUR);
    failing.clear();
    vi.mocked(recordNoticeEvent).mockClear();
    at("2026-09-25T09:31:00+07:00");
    const row = fallbackList(key, TCV, PASTEUR).data?.items.find((item) => item.date === FRIDAY.date);
    const retried = raised("schedule_fell_back").find((event) => event.occurrenceRef === `${PASTEUR}/${WEEKEND}/2026-09-25/22:00`);
    expect(retried?.facts).toMatchObject({ period: "2026-09-25 22:00-23:00", instead: "Sáng mở cửa" });
    expect(retried?.occurredAt).toBe(vn("2026-09-25T09:30:00+07:00"));
    expect(row?.notice).toBeNull();
    expect(sent(key, "schedule_fallback").some((notice) => notice.content?.values.period === "2026-09-25 22:00-23:00")).toBe(true);
  });
});

// ---------------------------------------------------------------- FR-VEN-014

describe("a shared mood drops a track that stops being eligible (FR-VEN-014, ALG-231 pass 1)", () => {
  it("@AC-FR-VEN-014-03 marks the track dropped from the version in effect at the next run, keeping the version and its other tracks", () => {
    at("2026-09-20T10:00:00+07:00");
    const key = principal();
    const moderator = staffOf(signInBeside(key, PEOPLE.operations));
    const approver = staffOf(signInBeside(key, PEOPLE.preparer));
    const version = createMood(key, moderator, { name: "Mưa chiều", owner: "SERVICE_OWNER", effectiveFrom: "2026-09-21", tracks: [REVOKED_TRACK, ELIGIBLE_TRACK] }).accepted?.version ?? "";
    expect(approveMoodVersion(key, approver, version).accepted).toEqual({ state: "APPROVED" });

    at("2026-09-25T09:20:00+07:00");
    const view = moodVersion(key, moderator, version).data;
    expect(view?.version).toMatchObject({ no: 1, state: "EFFECTIVE" });
    expect(view?.tracks.map((entry) => [entry.id, entry.droppedAt])).toEqual([
      [REVOKED_TRACK, vn("2026-09-25T09:15:00+07:00")],
      [ELIGIBLE_TRACK, null],
    ]);
  });
});

// ---------------------------------------------------------------- FR-VEN-018

describe("an ending at the premises' request (FR-VEN-018, DR-254, NTF-VEN-03)", () => {
  it("@AC-FR-VEN-018-01 records the ending from 00:00 the next day, keeps the service active until then, and confirms the date by notice", () => {
    at("2026-10-20T16:30:00+07:00");
    const key = principal();
    expect(requestEnding(key, TCV, nameOf(PEOPLE.principal), PASTEUR, null, "").accepted).toEqual({ effectiveAt: vn("2026-10-21T00:00:00+07:00") });
    expect(raised("service_entitlement_ending")).toEqual([expect.objectContaining({ sourceModule: "VEN", subjectRef: PASTEUR, recipientPartyId: TCV, destination: null })]);
    const confirmation = sent(key, "service_ending_confirmation");
    expect(confirmation).toHaveLength(1);
    expect(confirmation[0]?.content?.deadline).toBe("2026-10-21");

    at("2026-10-20T23:59:00+07:00");
    expect(serviceRecord(key, TCV, PASTEUR).data?.status).toBe("ACTIVE");
    at("2026-10-21T00:00:00+07:00");
    expect(serviceRecord(key, TCV, PASTEUR).data).toMatchObject({ status: "ENDED_AT_REQUEST", ending: { cause: "PREMISES_REQUEST", applied: true } });
  });

  it("@AC-FR-VEN-018-03 lets a delegate end the service within the delegation, naming them, and confirms it to them as well", () => {
    at("2026-10-20T10:00:00+07:00");
    const key = signIn(PEOPLE.delegate, { organisation: TCV });
    const delegate = nameOf(PEOPLE.delegate);
    expect(requestEnding(key, TCV, delegate, NGUYEN_HUE, "2026-11-01", "").accepted).toEqual({ effectiveAt: vn("2026-11-01T00:00:00+07:00") });
    expect(serviceRecord(key, TCV, NGUYEN_HUE).data?.ending).toMatchObject({ cause: "PREMISES_REQUEST", requestedBy: delegate, applied: false });
    expect(raised("service_entitlement_ending").map((event) => event.destination)).toEqual([null, PEOPLE.delegate]);
  });

  it("@AC-FR-VEN-018-02 refuses a date earlier than the ending rule allows, recording no ending and raising no notice", () => {
    at("2026-10-20T16:30:00+07:00");
    const key = principal();
    expect(requestEnding(key, TCV, nameOf(PEOPLE.principal), PASTEUR, "2026-10-20", "").refusal).toEqual({ code: "EFFECTIVE_DATE_BEFORE_POLICY", field: "requested_effective_date", item: null });
    expect(serviceRecord(key, TCV, PASTEUR).data).toMatchObject({ status: "ACTIVE", ending: null });
    expect(raised("service_entitlement_ending")).toEqual([]);
  });

  it("@AC-FR-VEN-018-04 refuses to end a service that has ended, and a second request while one waits", () => {
    at("2026-10-20T16:30:00+07:00");
    const key = principal();
    expect(requestEnding(key, TCV, nameOf(PEOPLE.principal), SALA, null, "").refusal?.code).toBe("ALREADY_ENDED");
    expect(requestEnding(key, TCV, nameOf(PEOPLE.principal), PASTEUR, null, "").refusal).toBeNull();
    expect(requestEnding(key, TCV, nameOf(PEOPLE.principal), PASTEUR, "2026-11-01", "").refusal?.code).toBe("ALREADY_ENDED");
    expect(raised("service_entitlement_ending")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- FR-VEN-003, FR-VEN-010

describe("the verification document under the approved entitlement wording (FR-VEN-003, FR-VEN-010)", () => {
  it("@AC-FR-VEN-003-04 refuses a document while no entitlement wording is approved, issuing nothing", () => {
    gov.wording.effectiveFrom = "2026-11-01";
    at("2026-10-16T10:00:00+07:00");
    const key = principal();
    expect(issueDocument(key, TCV, PASTEUR, "pdf").refusal?.code).toBe("WORDING_NOT_APPROVED");
    expect(documentStep(key, TCV, PASTEUR).data?.document?.reference).toBe(PASTEUR_DOCUMENT);
  });

  it("issues a document under the wording in force, which replaces the current one; the replaced one keeps its record and no longer verifies", () => {
    at("2026-10-16T10:00:00+07:00");
    const key = principal();
    const reference = issueDocument(key, TCV, PASTEUR, "html").accepted?.reference ?? "";
    expect(reference).toMatch(/^[0-9A-Z]{26}$/);
    expect(documentFile(key, TCV, reference).data).toMatchObject({ statusAtIssue: "ACTIVE", format: "html", wordingVersion: "1", supersededAt: null });
    expect(documentFile(key, TCV, PASTEUR_DOCUMENT).data?.supersededAt).toBe(vn("2026-10-16T10:00:00+07:00"));
    expect(entitlementForDocument(key, PASTEUR_DOCUMENT)).toBeNull();
    expect(entitlementForDocument(key, reference)).toMatchObject({ code: PASTEUR, status: "ACTIVE" });
  });
});

// ---------------------------------------------------------------- FR-VEN-020, FR-VEN-021

describe("a closure or a change of operator recorded in the party register ends the service (FR-VEN-020, FR-VEN-021)", () => {
  /** Operations records on SCR-PTY-09 that Pasteur closes, or passes to The Lintel, from 25 October 2026. */
  function recordInRegister(key: string, cause: "CLOSURE" | "OPERATOR_CHANGE"): void {
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const answer = recordPremisesChange(officer, PASTEUR_RECORD, { cause, effectiveOn: "2026-10-25", effectiveOnText: "25/10/2026", incoming: cause === "OPERATOR_CHANGE" ? LINTEL_PARTY : "", checkedFor: null });
    expect(answer.refusal).toBeNull();
  }

  it("@AC-FR-VEN-020-01 ends the service out of scope from the closure's effective day, and it reads active until then", () => {
    at("2026-10-21T11:20:00+07:00");
    const key = principal();
    recordInRegister(key, "CLOSURE");
    expect(serviceRecord(key, TCV, PASTEUR).data).toMatchObject({ status: "ACTIVE", ending: null });
    at("2026-10-24T23:59:00+07:00");
    expect(serviceRecord(key, TCV, PASTEUR).data?.status).toBe("ACTIVE");
    at("2026-10-25T00:00:00+07:00");
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    expect(caseFile(key, officer, PASTEUR, null).data?.head.status).toBe("ENDED_OUT_OF_SCOPE");
    // The party no longer operates the premises, so PTY gives it no authority there: its list no longer holds it.
    expect(serviceList(key, TCV).data?.items.map((item) => item.code)).not.toContain(PASTEUR);
    expect(raised("service_entitlement_out_of_scope")).toEqual([expect.objectContaining({ subjectRef: PASTEUR, recipientPartyId: TCV })]);
  });

  it("@AC-FR-VEN-021-01 names the causing family, the event and the detail, and the effective instant", () => {
    at("2026-10-21T11:20:00+07:00");
    const key = principal();
    recordInRegister(key, "CLOSURE");
    at("2026-10-26T09:00:00+07:00");
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const file = caseFile(key, officer, PASTEUR, null).data;
    expect(file?.head.status).toBe("ENDED_OUT_OF_SCOPE");
    expect(file?.endings[0]).toMatchObject({
      cause: "SCOPE_EXIT",
      effectiveAt: vn("2026-10-25T00:00:00+07:00"),
      applied: true,
      requestedBy: null,
      scopeExit: { family: "PREMISES", event: "CLOSURE", reference: `${PASTEUR_RECORD}/${THEN_CUA_PARTY}/${vn("2026-10-25T00:00:00+07:00")}` },
    });
    expect(file?.history[0]).toMatchObject({ from: "ACTIVE", to: "ENDED_OUT_OF_SCOPE", cause: "SCOPE_EXIT", recordedBy: { kind: "SYSTEM" } });
  });

  it("@AC-FR-VEN-020-04 ends the service the same way when the register records a change of operator", () => {
    at("2026-10-21T11:20:00+07:00");
    const key = principal();
    recordInRegister(key, "OPERATOR_CHANGE");
    at("2026-10-25T08:00:00+07:00");
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const file = caseFile(key, officer, PASTEUR, null).data;
    expect(file?.head.status).toBe("ENDED_OUT_OF_SCOPE");
    expect(file?.endings[0]).toMatchObject({ cause: "SCOPE_EXIT", effectiveAt: vn("2026-10-25T00:00:00+07:00"), scopeExit: { family: "PREMISES", event: "OPERATOR_CHANGE" } });
  });

  it("@AC-FR-VEN-021-04 supersedes a later pending ending at request, which then cannot take effect", () => {
    at("2026-10-21T11:00:00+07:00");
    const key = principal();
    expect(requestEnding(key, TCV, nameOf(PEOPLE.principal), PASTEUR, "2026-11-01", "").refusal).toBeNull();
    recordInRegister(key, "CLOSURE");
    at("2026-11-02T09:00:00+07:00");
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const file = caseFile(key, officer, PASTEUR, null).data;
    expect(file?.head.status).toBe("ENDED_OUT_OF_SCOPE");
    const request = file?.endings.find((ending) => ending.cause === "PREMISES_REQUEST");
    expect(request).toMatchObject({ superseded: true, applied: false });
    expect(file?.history.filter((row) => row.to === "ENDED_AT_REQUEST")).toEqual([]);
  });
});

// ---------------------------------------------------------------- convention 11

describe("every list is read a page at a time with an opaque cursor (convention 11)", () => {
  it("pages the playlists newest first, twenty-five at a time, the next page from its cursor and back to the first", () => {
    at("2026-10-16T10:00:00+07:00");
    const key = principal();
    for (let i = 1; i <= 27; i++) {
      at(`2026-10-16T10:${String(i).padStart(2, "0")}:00+07:00`);
      expect(createPlaylist(key, TCV, PASTEUR, `Danh sách ${String(i)}`, [{ kind: "TRACK", ref: ELIGIBLE_TRACK }]).refusal).toBeNull();
    }
    const first = playlistList(key, TCV, PASTEUR, null).data;
    expect(first?.items).toHaveLength(25);
    expect(first?.items[0]?.name).toBe("Danh sách 27");
    expect(first?.paging).toMatchObject({ from: 1, to: 25, previous: null, refused: null });
    const second = playlistList(key, TCV, PASTEUR, null, first?.paging.next ?? null).data;
    // 27 new and the 5 the seed holds: the second page has the last 7, ending with the seed's.
    expect(second?.paging).toMatchObject({ from: 26, to: 32, next: null, previous: "", refused: null });
    expect(second?.items.slice(0, 2).map((row) => row.name)).toEqual(["Danh sách 2", "Danh sách 1"]);
    expect(new Set([...(first?.items ?? []), ...(second?.items ?? [])].map((row) => row.id)).size).toBe(32);
  });

  it("refuses a cursor it did not issue, or one issued for another filter, CURSOR_INVALID, and answers the first page with it", () => {
    at("2026-10-16T10:00:00+07:00");
    const key = principal();
    const forged = playlistList(key, TCV, PASTEUR, null, "not-a-cursor").data;
    expect(forged?.paging).toMatchObject({ refused: "CURSOR_INVALID", from: 1, previous: null });
    const officer = staffOf(signInBeside(key, PEOPLE.operations));
    const other = Buffer.from(JSON.stringify({ l: "register/ACTIVE/", o: 25 })).toString("base64url");
    expect(register(key, officer, { status: null, premises: null }, other).data?.paging.refused).toBe("CURSOR_INVALID");
  });
});
