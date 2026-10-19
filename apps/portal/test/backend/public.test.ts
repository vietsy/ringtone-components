import { afterEach, describe, expect, it, vi } from "vitest";
import { findAccount } from "@/lib/mock/backend/accounts";
import { unmetObligations } from "@/lib/mock/backend/notices";
import { disclosureProfile } from "@/lib/mock/backend/oversight";
import {
  aboutPage,
  approveDisclosureProfileVersion,
  assessScope,
  currencyWatches,
  decideVersion,
  pageVersions,
  printedCodeOf,
  publicPage,
  publicVerificationAnswer,
  saveVersion,
  scopeQuestions,
  submitVersion,
  verifyCertificate,
  verifyServiceEntitlement,
  withdrawVersion,
  type PolicyActor,
} from "@/lib/mock/backend/public";
import { PEOPLE, signIn } from "./harness";

/** The member of staff a session names, as the seam hands them to the backend. */
function actorOf(email: string): PolicyActor {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { email: account.email, name: account.name, roles: account.staffRoles };
}

/** Quan Ngọc Trâm drafts and submits pages (ACT-POL-PRE); Phan Gia Lượng approves them (ACT-POL-APR). */
const preparer = actorOf(PEOPLE.preparer);
const approver = actorOf(PEOPLE.operations);

/** The seed's documents and watches (`lib/mock/public.ts`). */
const ABOUT_2026_4 = "DV-ABT26C4N2X";
const SCOPE_GUIDE_DRAFT = "DV-SCG26C1H5P";
const PARTICIPANTS_WATCH = "CW-PL26C3";
const MANDATES_WATCH = "CW-MS26C2";
const PASTEUR = "R1-CER-2026-T7QM4BWJ";
const PASTEUR_DOCUMENT = "K3VQ7M2XRDZ5PWN4TB6HCJYLAE";

/** The query instant of most scenarios: a morning in October 2026, after the seed's watches fell due. */
const MORNING = "2026-10-16T09:00:00+07:00";

function at(instant: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

/** Each test asks from a network prefix of its own, so the volume controls of one never refuse another. */
let prefix = 0;
const address = () => `10.42.${(prefix += 1)}.7`;

const cafe = { assessmentDate: "", premisesClass: "cafe", adminArea: "hcm", floorAreaM2: "85", seats: "40" };

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The raises of NTF-PUB-01 COM recorded, as its console lists the events that raised nothing (SCR-COM-16): in P1 COM
 * holds no class for this family's event, so each raise is an event of its own with no notice.
 */
function overdueRaises(key: string): { count: number; lastAt: string } | null {
  const unmet = unmetObligations(key, { name: approver.name, roles: approver.roles }).data;
  const row = unmet?.unclassified.find((entry) => entry.module === "PUB" && entry.eventKind === "publication_overdue");
  return row === undefined ? null : { count: row.count, lastAt: row.lastAt };
}

/** "What RightOne is" 2026.4 approved and published, to take effect on 1 December 2026 (SCR-PUB-16). */
function publishAbout2026_4(key: string): void {
  const decided = decideVersion(key, approver, ABOUT_2026_4, { decision: "APPROVE", plainLanguageConfirmed: true, reason: "" });
  if (decided.refusal !== null) throw new Error(`not published: ${decided.refusal.code}`);
}

function watch(key: string, id: string) {
  const row = currencyWatches(key, approver, { status: null, from: null, to: null, cursor: null }).data?.rows.find((candidate) => candidate.id === id);
  if (row === undefined) throw new Error(`no watch ${id}`);
  return row;
}

describe("GET /pages/{kind}", () => {
  it("@AC-FR-PUB-001-11 serves the about page in effect with its own text, the sections GOV and CAT do not offer marked unavailable", () => {
    at(MORNING);
    const page = aboutPage(signIn(PEOPLE.principal)).data?.page;
    expect(page?.version).toBe("2026.2");
    expect(page?.sections.map((section) => section.heading.vi)).toEqual(["OPERATOR", "SCOPE", "ONE_LAWFUL_ROUTE"]);
    expect(page?.operator).toBe("RightOne");
    expect(page?.collector).toBeNull();
    expect(page?.basis).toBeNull();
    expect(page?.participants).toBeNull();
  });

  it("@AC-FR-PUB-001-04 refuses a page kind that names no document, revealing nothing", () => {
    const answer = publicPage(signIn(PEOPLE.principal), "PRICE_LIST", null);
    expect(answer.failure?.code).toBe("PAGE_KIND_UNKNOWN");
    expect(answer.data).toBeNull();
  });

  it("serves the tariff and help pages, which no screen of their own draws, in the version in effect", () => {
    at(MORNING);
    const key = signIn(PEOPLE.principal);
    expect(publicPage(key, "TARIFF", null).data?.text.version).toMatchObject({ label: "2026.1", state: "IN_EFFECT" });
    expect(publicPage(key, "HELP", null).data?.text.version).toMatchObject({ label: "2026.1", state: "IN_EFFECT" });
  });

  it("serves no version of a page whose only version is a draft, and never the draft's text", () => {
    at(MORNING);
    const answer = publicPage(signIn(PEOPLE.principal), "SCOPE_GUIDE", null);
    expect(answer.failure).toBeNull();
    expect(answer.data?.text.version).toBeNull();
  });

  it("@AC-FR-PUB-030-02 still serves the earlier edition one second before an approved one takes effect, announcing it", () => {
    at(MORNING);
    const key = signIn(PEOPLE.principal);
    publishAbout2026_4(key);
    at("2026-11-30T23:59:59+07:00");
    const page = aboutPage(key).data?.page;
    expect(page?.version).toBe("2026.3");
    expect(page?.upcoming).toEqual({ version: "2026.4", effectiveFrom: "2026-12-01T00:00:00+07:00" });
  });

  it("@AC-FR-PUB-030-01 serves the approved edition, with its own text, from its effective instant", () => {
    at(MORNING);
    const key = signIn(PEOPLE.principal);
    publishAbout2026_4(key);
    at("2026-12-01T00:00:01+07:00");
    const page = aboutPage(key).data?.page;
    expect(page?.version).toBe("2026.4");
    expect(page?.current).toBeNull();
    expect(page?.sections[0]?.body.vi).toContain("Đơn vị thu đang chờ chỉ định.");
  });

  it("@AC-FR-PUB-012-01 marks an edition read as at a past instant superseded, with its period and the version now current", () => {
    at(MORNING);
    const page = aboutPage(signIn(PEOPLE.principal), "2026-08-01T10:00:00+07:00").data?.page;
    expect(page?.version).toBe("2026.1");
    expect(page?.effectiveTo).toBe("2026-09-14");
    expect(page?.current).toEqual({ version: "2026.2", effectiveFrom: "2026-09-15T00:00:00+07:00" });
    expect(page?.newerApprovedSources).toEqual([]);
  });

  it("@AC-FR-PUB-011-03 answers no version for an instant before the first one, and no later version in its place", () => {
    at(MORNING);
    const answer = aboutPage(signIn(PEOPLE.principal), "2026-06-30T23:59:00+07:00");
    expect(answer.failure).toBeNull();
    expect(answer.data?.page).toBeNull();
  });

  it("@AC-FR-PUB-012-03 refuses an instant that has not come rather than answering it as current", () => {
    at(MORNING);
    expect(aboutPage(signIn(PEOPLE.principal), "2026-12-01T00:00:00+07:00").failure?.code).toBe("INSTANT_INVALID");
  });

  it("@AC-FR-PUB-032-02 names each source with an approved change the text does not describe yet", () => {
    at(MORNING);
    const page = aboutPage(signIn(PEOPLE.principal)).data?.page;
    expect(page?.newerApprovedVersionExists).toBe(true);
    expect(page?.newerApprovedSources).toEqual(["MANDATES", "PARTICIPANTS"]);
  });

  it("refuses the versions of a page kind that names no document", () => {
    expect(pageVersions(signIn(PEOPLE.principal), "PRICE_LIST").failure?.code).toBe("PAGE_KIND_UNKNOWN");
  });

  it("@AC-FR-PUB-002-05 refuses an about version without the one-lawful-route section, which stays a draft", () => {
    at(MORNING);
    const key = signIn(PEOPLE.preparer);
    // 2026.4 is returned to its author, who rewrites it without the statement.
    expect(decideVersion(key, approver, ABOUT_2026_4, { decision: "RETURN", plainLanguageConfirmed: false, reason: "Thiếu tên đơn vị thu" }).refusal).toBeNull();
    expect(saveVersion(key, preparer, ABOUT_2026_4, { label: "2026.4", body: "## OPERATOR\nRightOne.\n\n## SCOPE\nQuyền tác giả.", sources: [] }).refusal).toBeNull();
    const submitted = submitVersion(key, preparer, ABOUT_2026_4, "2026-12-01T00:00+07:00");
    expect(submitted.refusal).toMatchObject({ code: "SECTIONS_MISSING", values: { sections: "ONE_LAWFUL_ROUTE" } });
  });
});

describe("GET /scope-questions and POST /scope-assessments", () => {
  it("@AC-FR-PUB-003-05 refuses a malformed assessment date before the tariff is asked", () => {
    expect(scopeQuestions("2027-02-30").failure?.code).toBe("ASSESSMENT_INPUT_INVALID");
  });

  it("@AC-FR-PUB-003-01 asks only the facts the tariff classifies by, the floor area required and the seats not", () => {
    at(MORNING);
    const questions = scopeQuestions().data?.questions;
    expect(questions?.premisesClasses).toEqual(["cafe", "bar", "shop"]);
    expect(questions?.facts).toEqual([
      { key: "FLOOR_AREA_M2", required: true },
      { key: "SEATING_CAPACITY", required: false },
    ]);
  });

  it("derives the questions for the date stated, none before the first approved tariff", () => {
    expect(scopeQuestions("2026-02-01").data).toEqual({ assessmentDate: "2026-02-01", questions: null });
  });

  it("sends the reader to the support route while no scope guide is in effect", () => {
    at(MORNING);
    const answer = assessScope(signIn(PEOPLE.principal), cafe).answer.data;
    expect(answer?.outcome).toBe("in_scope");
    expect(answer?.nextAction).toBe("support");
    expect(answer?.nextActionText).toBeNull();
  });

  it("@AC-FR-PUB-004-01 states the next action of the IN_SCOPE section of the scope guide in effect", () => {
    at(MORNING);
    const key = signIn(PEOPLE.preparer);
    expect(submitVersion(key, preparer, SCOPE_GUIDE_DRAFT, "2026-10-16T10:00+07:00").refusal).toBeNull();
    expect(decideVersion(key, approver, SCOPE_GUIDE_DRAFT, { decision: "APPROVE", plainLanguageConfirmed: true, reason: "" }).refusal).toBeNull();
    at("2026-10-16T10:00:01+07:00");
    const answer = assessScope(key, cafe).answer.data;
    expect(answer).toMatchObject({ outcome: "in_scope", nextAction: "register", guideVersion: "2026.1" });
    expect(answer?.nextActionText?.vi).toBe("Đăng ký cơ sở với RightOne.");
  });
});

describe("GET /verifications/certificates/{reference}: the answer kept", () => {
  it("keeps a record answer by its reference: what it showed, the hour, the record resolved and no value typed", () => {
    at("2026-10-16T09:41:27+07:00");
    const key = signIn(PEOPLE.principal);
    const answer = verifyCertificate(PASTEUR, address(), key).data;
    const ref = answer?.record?.answerRef ?? "";
    expect(publicVerificationAnswer(key, ref)).toEqual({
      reference: ref,
      answeredHour: "2026-10-16T09:00:00+07:00",
      outcome: "RECORD",
      record: PASTEUR,
      presented: null,
      shown: { status: "active", statusSince: "2026-09-18T11:40:00+07:00", validFrom: "2026-09-18", validTo: "2027-09-17", printout: null },
    });
  });

  it("keeps an absence with the value presented, since no record was resolved", () => {
    at(MORNING);
    const key = signIn(PEOPLE.principal);
    const answer = verifyCertificate("R1-CER-2026-H8WX2DQR", address(), key).data;
    expect(answer?.outcome).toBe("absent");
    expect(publicVerificationAnswer(key, answer?.answerRef ?? "")).toMatchObject({ outcome: "ABSENT", record: null, presented: "R1-CER-2026-H8WX2DQR", shown: null });
  });

  it("@AC-FR-PUB-046-01 refuses a malformed reference before any read, with no outcome and no answer reference", () => {
    const key = signIn(PEOPLE.principal);
    const refused = verifyCertificate("R1-CER-2026-T7QM4BW", address(), key);
    expect(refused.failure?.code).toBe("IDENTIFIER_NOT_ACCEPTED");
    expect(refused.data).toBeNull();
  });

  it("answers no kept answer for a reference the public route never gave", () => {
    expect(publicVerificationAnswer(signIn(PEOPLE.principal), "VRA-6T2KQ9MW4A")).toBeNull();
  });
});

describe("the disclosure profile in effect (ALG-458)", () => {
  it("applies the minimum profile while GOV has approved no version, the tested default", () => {
    const key = signIn(PEOPLE.supervisor);
    const profile = disclosureProfile(key, actorOf(PEOPLE.supervisor).roles, "PLAYER_SERVICE_ENTITLEMENT", null).data;
    expect(profile?.state).toBe("MINIMUM_PROFILE");
    expect(profile?.entries.map((entry) => entry.field)).toEqual(["premises_name", "business_type", "locality_level", "service_entitlement_id", "status"]);
  });

  it("@AC-FR-PUB-043-01 withholds a protected field a version admits without its decision, and applies the rest", () => {
    at(MORNING);
    const key = signIn(PEOPLE.supervisor);
    approveDisclosureProfileVersion(key, {
      ref: "DP-2",
      approvedOn: "2026-10-01",
      effectiveFrom: "2026-10-02T00:00:00+07:00",
      entries: {
        PLAYER_SERVICE_ENTITLEMENT: [
          { field: "premises_name", decision: null },
          { field: "service_entitlement_id", decision: null },
          { field: "status", decision: null },
          { field: "premises_telephone", decision: null },
          { field: "owner_identity", decision: null },
        ],
      },
    });
    const profile = disclosureProfile(key, actorOf(PEOPLE.supervisor).roles, "PLAYER_SERVICE_ENTITLEMENT", null).data;
    expect(profile).toMatchObject({ state: "APPLIED", version: { ref: "DP-2" } });
    expect(profile?.entries.filter((entry) => entry.state === "WITHHELD")).toEqual([
      { field: "premises_telephone", admittedBy: { kind: "VERSION", version: "DP-2" }, state: "WITHHELD", finding: "DECISION_REF_MISSING" },
      { field: "owner_identity", admittedBy: { kind: "VERSION", version: "DP-2" }, state: "WITHHELD", finding: "DECISION_REF_MISSING" },
    ]);
    const entitlement = verifyServiceEntitlement(key, printedCodeOf(PASTEUR_DOCUMENT), address()).data?.entitlement;
    expect(Object.keys(entitlement ?? {})).not.toContain("ownerIdentity");
    expect(entitlement?.premisesName).toBeDefined();
  });

  it("@AC-FR-PUB-043-03 reports a street address admitted by decision as not attributed, while DAT offers no attribution", () => {
    at(MORNING);
    const key = signIn(PEOPLE.supervisor);
    approveDisclosureProfileVersion(key, {
      ref: "DP-3",
      approvedOn: "2026-10-01",
      effectiveFrom: "2026-10-02T00:00:00+07:00",
      entries: { PLAYER_SERVICE_ENTITLEMENT: [{ field: "status", decision: null }, { field: "premises_street_address", decision: "DEC23-01" }] },
    });
    const entries = disclosureProfile(key, actorOf(PEOPLE.supervisor).roles, "PLAYER_SERVICE_ENTITLEMENT", null).data?.entries ?? [];
    expect(entries.find((entry) => entry.field === "premises_street_address")).toEqual({
      field: "premises_street_address",
      admittedBy: { kind: "DECISION", decision: "DEC23-01" },
      state: "WITHHELD",
      finding: "NOT_ATTRIBUTED",
    });
  });

  it("@AC-FR-PUB-042-05 answers the record without a personal-data field whose attribution cannot be read", () => {
    at(MORNING);
    const key = signIn(PEOPLE.principal);
    approveDisclosureProfileVersion(key, {
      ref: "DP-3",
      approvedOn: "2026-10-01",
      effectiveFrom: "2026-10-02T00:00:00+07:00",
      entries: { PLAYER_SERVICE_ENTITLEMENT: [{ field: "service_entitlement_id", decision: null }, { field: "status", decision: null }, { field: "premises_street_address", decision: "DEC23-01" }] },
    });
    const answer = verifyServiceEntitlement(key, printedCodeOf(PASTEUR_DOCUMENT), address()).data;
    expect(answer?.outcome).toBe("record");
    expect(Object.keys(answer?.entitlement ?? {}).sort()).toEqual(["answerRef", "reference", "statusWord"]);
  });

  it("decides by the version in effect at the query instant, not the one approved for later", () => {
    at(MORNING);
    const key = signIn(PEOPLE.principal);
    approveDisclosureProfileVersion(key, {
      ref: "DP-4",
      approvedOn: "2026-10-15",
      effectiveFrom: "2026-10-17T00:00:00+07:00",
      entries: { AUTHORITATIVE_PREMISES_STATUS: [{ field: "reference", decision: null }, { field: "status", decision: null }, { field: "valid_from", decision: null }, { field: "valid_to", decision: null }] },
    });
    expect(verifyCertificate(PASTEUR, address(), key).data?.record?.statusSince).toBeDefined();
    at("2026-10-17T00:00:01+07:00");
    const record = verifyCertificate(PASTEUR, address(), key).data?.record;
    expect(record).toMatchObject({ status: "active", validFrom: "2026-09-18", validTo: "2027-09-17" });
    expect(record?.statusSince).toBeUndefined();
  });

  it("@AC-FR-PUB-043-04 refuses the profile to a reader without the privacy role", () => {
    const key = signIn(PEOPLE.operations);
    expect(disclosureProfile(key, approver.roles, "PLAYER_SERVICE_ENTITLEMENT", null).failure?.code).toBe("NOT_AUTHORISED");
  });
});

describe("currency watches: the exception and the notice when late (FR-PUB-032)", () => {
  it("@AC-FR-PUB-032-04 keeps a watch overdue with no notice reference when COM does not take the raise, and asks again on the next run", () => {
    at(MORNING);
    const key = signIn(PEOPLE.preparer);
    expect(watch(key, MANDATES_WATCH)).toMatchObject({ status: "OVERDUE", overdueAt: "2026-10-01T15:30:00+07:00", noticeRef: null });
    // Both overdue watches of the seed are raised once, the participant list's and the mandate set's.
    expect(overdueRaises(key)?.count).toBe(2);
    watch(key, MANDATES_WATCH);
    expect(overdueRaises(key)?.count).toBe(2);
    at("2026-10-16T09:05:01+07:00");
    watch(key, MANDATES_WATCH);
    expect(overdueRaises(key)?.count).toBe(4);
    expect(watch(key, MANDATES_WATCH).noticeRef).toBeNull();
  });

  it("@AC-FR-PUB-032-05 records a watch still open past its due instant late at once when an edition naming it is published, and raises no notice", () => {
    at(MORNING);
    const key = signIn(PEOPLE.preparer);
    publishAbout2026_4(key);
    expect(watch(key, MANDATES_WATCH)).toMatchObject({ status: "REACHED_LATE", overdueAt: "2026-10-01T15:30:00+07:00", reachedAt: new Date(MORNING).toISOString() });
    expect(overdueRaises(key)).toBeNull();
  });

  it("@AC-FR-PUB-031-13 reopens a watch reached late when its only edition is withdrawn, and tells the owner again under a new occurrence", () => {
    at(MORNING);
    const key = signIn(PEOPLE.preparer);
    publishAbout2026_4(key);
    const reopened = new Date("2026-10-20T10:00:00+07:00").toISOString();
    at(reopened);
    expect(withdrawVersion(key, approver, ABOUT_2026_4, "Sai tên tổ chức tham gia").refusal).toBeNull();
    expect(watch(key, PARTICIPANTS_WATCH)).toMatchObject({ status: "OVERDUE", overdueAt: "2026-09-29T08:00:00+07:00", reopenedAt: reopened, reachedAt: null, noticeRef: null });
    // The raise is the reopening's own occurrence: it happened at the reopening instant.
    expect(overdueRaises(key)?.lastAt).toBe(reopened);
  });
});
