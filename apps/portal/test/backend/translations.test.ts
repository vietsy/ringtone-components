import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findAccount } from "@/lib/mock/backend/accounts";
import { recordTranslation, servedText, translationAttributions, translationRegister, type TranslationActor } from "@/lib/mock/backend/translations";
import { PEOPLE, signIn } from "./harness";

function actorOf(email: string): TranslationActor {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { roles: account.staffRoles, name: account.name };
}

const officer = actorOf(PEOPLE.operations);

/** 16 October 2026: the premises terms 3 in force since 1 September, "What RightOne is" 2026.2 until 2026.3 on 24 October. */
const TODAY = "2026-10-16T10:00:00+07:00";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TODAY));
});

afterEach(() => {
  vi.useRealTimers();
});

const record = (key: string, contentKey: string, languageCode: string, sourceVersion: string) => recordTranslation(key, officer, { contentKey, languageCode, sourceVersion }).data;
const register = (key: string, contentKey: string) => translationRegister(key, officer, contentKey);
const attributions = (key: string) => translationAttributions(key, officer.roles).data ?? [];

describe("POST /translations", () => {
  it("@AC-FR-SVC-006-01 records the Vietnamese version a translation was approved against, and the register shows it", () => {
    const key = signIn(PEOPLE.operations);
    expect(record(key, "PREMISES_SERVICE_TERMS", "en", "3")?.accepted).not.toBeNull();
    const read = register(key, "PREMISES_SERVICE_TERMS").data;
    expect(read?.inForce?.label).toBe("3");
    expect(read?.translations).toHaveLength(1);
    expect(read?.translations[0]).toMatchObject({ languageCode: "en", sourceVersion: "3", sourcePhase: "IN_EFFECT", state: "current", approvedBy: "Phan Gia Lượng" });
  });

  it("@AC-FR-SVC-006-03 does not publish a translation of a Vietnamese version awaiting approval, naming that version", () => {
    const key = signIn(PEOPLE.operations);
    const answer = record(key, "ABOUT", "en", "2026.4");
    expect(answer?.refusal).toMatchObject({ code: "SOURCE_VERSION_NOT_APPROVED", field: "source_version", values: { sourceVersion: "2026.4" } });
    expect(register(key, "ABOUT").data?.translations).toEqual([]);
  });

  it("@AC-FR-SVC-006-04 refuses a translation against a draft while an earlier version is approved, writes no row and attributes the refusal", () => {
    const key = signIn(PEOPLE.operations);
    // The Player guide: 2026.1 approved and in force, 2026.2 in draft.
    expect(record(key, "PLAYER_GUIDE", "en", "2026.2")?.refusal?.code).toBe("SOURCE_VERSION_NOT_APPROVED");
    expect(register(key, "PLAYER_GUIDE").data?.translations).toEqual([]);
    expect(attributions(key).at(-1)).toMatchObject({
      actionKey: "translations.record",
      objectRef: "PLAYER_GUIDE",
      outcome: "refused",
      actor: "Phan Gia Lượng",
      detail: { code: "SOURCE_VERSION_NOT_APPROVED", languageCode: "en", sourceVersion: "2026.2" },
    });
  });

  it("@AC-FR-SVC-006-05 refuses a second translation into one language against one version, keeping the first the only one", () => {
    const key = signIn(PEOPLE.operations);
    expect(record(key, "PLAYER_GUIDE", "en", "2026.1")?.accepted).not.toBeNull();
    expect(record(key, "PLAYER_GUIDE", "en", "2026.1")?.refusal).toMatchObject({ code: "TRANSLATION_ALREADY_RECORDED", field: null });
    expect(register(key, "PLAYER_GUIDE").data?.translations).toHaveLength(1);
    expect(attributions(key).map((row) => [row.outcome, row.detail.code ?? null])).toEqual([
      ["performed", null],
      ["refused", "TRANSLATION_ALREADY_RECORDED"],
    ]);
  });

  it("refuses a request without a language or a source version with FIELD_MISSING, naming the field, before any rule", () => {
    const key = signIn(PEOPLE.operations);
    expect(record(key, "PREMISES_SERVICE_TERMS", " ", "3")?.refusal).toMatchObject({ code: "FIELD_MISSING", field: "language_code" });
    expect(record(key, "PREMISES_SERVICE_TERMS", "en", "")?.refusal).toMatchObject({ code: "FIELD_MISSING", field: "source_version" });
    expect(record(key, "", "en", "3")?.refusal).toMatchObject({ code: "FIELD_MISSING", field: "content_key" });
    expect(attributions(key).filter((row) => row.outcome === "refused")).toHaveLength(3);
  });

  it("reads the content key as the publishing module writes it, whatever its case", () => {
    const key = signIn(PEOPLE.operations);
    expect(record(key, "premises_service_terms", "en", "3")?.accepted).not.toBeNull();
    expect(register(key, "Premises_Service_Terms").data?.translations).toHaveLength(1);
  });

  it("is refused to a member of staff who is not an operations officer", () => {
    const key = signIn(PEOPLE.approver);
    const approver = actorOf(PEOPLE.approver);
    expect(recordTranslation(key, approver, { contentKey: "PREMISES_SERVICE_TERMS", languageCode: "en", sourceVersion: "3" }).failure?.code).toBe("NOT_AUTHORISED");
    expect(translationRegister(key, approver, "PREMISES_SERVICE_TERMS").failure?.code).toBe("NOT_AUTHORISED");
  });
});

describe("GET /translations", () => {
  it("@AC-FR-SVC-006-06 refuses a key nothing is published under, returns nothing, creates nothing and attributes the refused read", () => {
    const key = signIn(PEOPLE.operations);
    expect(register(key, "CNT-SVC-6699")).toEqual({ data: null, failure: { code: "CONTENT_NOT_FOUND", traceId: null, retryable: false } });
    // The scope guide exists only as a draft: nothing is published under its key either.
    expect(register(key, "SCOPE_GUIDE").failure?.code).toBe("CONTENT_NOT_FOUND");
    expect(attributions(key).map((row) => [row.actionKey, row.objectRef, row.outcome, row.detail.code])).toEqual([
      ["translations.read", "CNT-SVC-6699", "refused", "CONTENT_NOT_FOUND"],
      ["translations.read", "SCOPE_GUIDE", "refused", "CONTENT_NOT_FOUND"],
    ]);
  });

  it("says when nothing is translated yet, with the Vietnamese version in force", () => {
    const key = signIn(PEOPLE.operations);
    const read = register(key, "ABOUT").data;
    expect(read?.translations).toEqual([]);
    expect(read?.inForce?.label).toBe("2026.2");
    expect(read?.versions.map((version) => [version.label, version.status, version.phase])).toEqual([
      ["2026.1", "PUBLISHED", "SUPERSEDED"],
      ["2026.2", "PUBLISHED", "IN_EFFECT"],
      ["2026.3", "PUBLISHED", "UPCOMING"],
      ["2026.4", "SUBMITTED", null],
    ]);
  });
});

describe("supersession", () => {
  it("@AC-FR-SVC-041-01 presents a translation whose source version is in force as current, naming that version", () => {
    const key = signIn(PEOPLE.operations);
    record(key, "ABOUT", "en", "2026.2");
    expect(register(key, "ABOUT").data?.translations[0]).toMatchObject({ sourceVersion: "2026.2", sourcePhase: "IN_EFFECT", state: "current", supersededAt: null });
    expect(servedText(key, "ABOUT", "en")).toEqual({ language: "en", vietnameseVersion: "2026.2", sourceVersion: "2026.2" });
  });

  it("@AC-FR-SVC-041-02 records the translation superseded at the instant the next Vietnamese version takes effect, naming it", () => {
    const key = signIn(PEOPLE.operations);
    record(key, "ABOUT", "en", "2026.2");
    vi.setSystemTime(new Date("2026-10-24T08:00:00+07:00"));
    const row = register(key, "ABOUT").data?.translations[0];
    expect(row).toMatchObject({ state: "superseded", supersededByVersion: "2026.3", sourcePhase: "SUPERSEDED" });
    expect(Date.parse(row?.supersededAt ?? "")).toBe(Date.parse("2026-10-24T00:00:00+07:00"));
  });

  it("serves the Vietnamese text in force, never a superseded translation, to a reader of the content in that language", () => {
    const key = signIn(PEOPLE.operations);
    record(key, "ABOUT", "en", "2026.2");
    vi.setSystemTime(new Date("2026-10-25T08:00:00+07:00"));
    expect(servedText(key, "ABOUT", "en")).toEqual({ language: "vi", vietnameseVersion: "2026.3", sourceVersion: null });
  });

  it("does not serve a translation approved against a version not yet in force", () => {
    const key = signIn(PEOPLE.operations);
    record(key, "ABOUT", "en", "2026.3");
    expect(register(key, "ABOUT").data?.translations[0]).toMatchObject({ sourcePhase: "UPCOMING", state: "current" });
    expect(servedText(key, "ABOUT", "en")?.language).toBe("vi");
  });

  it("marks a translation recorded against a version already superseded as superseded from its own approval", () => {
    const key = signIn(PEOPLE.operations);
    record(key, "PREMISES_SERVICE_TERMS", "en", "2");
    const row = register(key, "PREMISES_SERVICE_TERMS").data?.translations[0];
    expect(row).toMatchObject({ state: "superseded", supersededByVersion: "3" });
    expect(Date.parse(row?.supersededAt ?? "")).toBe(Date.parse(row?.approvedAt ?? ""));
  });

  it("lists current translations before superseded ones", () => {
    const key = signIn(PEOPLE.operations);
    record(key, "PREMISES_SERVICE_TERMS", "en", "2");
    record(key, "PREMISES_SERVICE_TERMS", "en", "3");
    expect(register(key, "PREMISES_SERVICE_TERMS").data?.translations.map((row) => [row.sourceVersion, row.state])).toEqual([
      ["3", "current"],
      ["2", "superseded"],
    ]);
  });
});
