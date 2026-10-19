import { afterEach, describe, expect, it, vi } from "vitest";
import type { GrantInput } from "@/lib/api/parties";
import type { Principal, Staff } from "@/lib/api/session";
import { findAccount } from "@/lib/mock/backend/accounts";
import { overlapReport, verifyAuthorityScope } from "@/lib/mock/backend/authorisation";
import {
  actingAs,
  addPartyPerson,
  amendPartyPerson,
  authorityDetail,
  authorityToActAt,
  changeRecords,
  createParty,
  grantAuthority,
  partyAuthorities,
  partyPerson,
  partyRegister,
  personExists,
  amendAuthority,
  premisesActableBy,
  raiseCandidacy,
  recordActUnderAuthority,
  recordPrincipal,
  reviewQueue,
  revokeAuthority,
  searchSource,
} from "@/lib/mock/backend/parties";
import { issuePairing, reinstateCredential, suspendCredential } from "@/lib/mock/backend/player";
import {
  exceptionQueue,
  geographyRepointings,
  overridePremisesField,
  portalPremises,
  portfolio,
  premisesProfileAt,
  premisesRelationshipAt,
  premisesTimeline,
  recordPremisesChange,
  repointGeography,
  resolveException,
} from "@/lib/mock/backend/premises";
import { addEvidenceItem, applicationList, startApplication } from "@/lib/mock/backend/registration";
import { enrolPremises, servicePublicStatus } from "@/lib/mock/backend/venue";
import { PEOPLE, signIn, signInBeside } from "./harness";

/*
 * PTY as the register every family asks who may act for a premises (DR-201, ALG-180), with the delegate Hầu Ngọc Ánh:
 * Then Cửa Việt's authority AUT-3KQ8MW2T lets her read and submit for Nguyễn Huệ (PRM-3NHZ6PKW, REG's `nh`) alone;
 * the one she held for Pasteur ended on 30 September. Đỗ Thu Trang is the principal the business register names.
 */

const NGUYEN_HUE = "PRM-3NHZ6PKW";
const LE_THANH_TON = "PRM-8RTN5QZD";
const PASTEUR = "PRM-5PSR9VJA";
const AP_MAI_BAR = "PRM-7KD2WQ9M";
/** The two premises the first load admitted with 2024-12 wards: Phường 22 has a successor, Phường 25 none. */
const GOC_SAU = "PRM-8GSK4VNR";
const MAI_HIEN_XANH = "PRM-5MHX2TQB";
const THEN_CUA = "PTY-118342";

afterEach(() => {
  vi.useRealTimers();
});

// The licensing status a portfolio carries is read from CER for every premises, which takes a few seconds in a world.

/** The member of staff a session is, as `requireStaff` hands them to the backend. */
function staffOf(sessionId: string, email: string): Staff {
  const account = findAccount(email);
  if (account === null) throw new Error(`no seed account ${email}`);
  return { sessionId, account: account.name, email: account.email, position: account.position ?? "", roles: account.staffRoles };
}

/** The premises actor a session is, as `requirePrincipal` hands them to the backend. */
function principalOf(sessionId: string): Principal {
  const acting = actingAs(sessionId);
  if (acting === null) throw new Error(`session ${sessionId} acts for nobody`);
  return { sessionId, account: acting.name, party: "Công ty TNHH Then Cửa Việt", organisation: acting.organisation, actor: acting.actor, person: acting.person };
}

function grant(more: Partial<GrantInput> = {}): GrantInput {
  return {
    person: "PPN-PTY-2486",
    scope: "premises",
    premises: LE_THANH_TON,
    acts: ["READ"],
    basis: "Quản lý ca tối",
    evidence: "QĐ-TCV-2026-044",
    file: null,
    from: "2026-11-02",
    fromText: "02/11/2026",
    to: "2027-11-01",
    toText: "01/11/2027",
    ...more,
  };
}

/** Records a closure of the premises, effective today, on the console. */
function closeToday(key: string, premises: string) {
  const officer = signInBeside(key, PEOPLE.operations);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const answer = recordPremisesChange(staffOf(officer, PEOPLE.operations), premises, { cause: "CLOSURE", effectiveOn: today, effectiveOnText: today, incoming: "", checkedFor: null });
  expect(answer.refusal).toBeNull();
}

describe("who acts for a party", () => {
  it("knows the principal the business register names, the delegate, and no one for a revoked authority", () => {
    const key = signIn(PEOPLE.principal);
    expect(actingAs(key)).toMatchObject({ actor: "PRINCIPAL", person: "PPN-PTY-2201", party: THEN_CUA });
    expect(actingAs(signInBeside(key, PEOPLE.delegate))).toMatchObject({ actor: "DELEGATE", person: "PPN-PTY-2212", party: THEN_CUA });
    expect(actingAs(signInBeside(key, PEOPLE.revokedDelegate))).toBeNull();
  });

  it("gives the principal every premises the party operates, and the delegate only the one her authority names", () => {
    const key = signIn(PEOPLE.principal);
    expect(premisesActableBy(key).map((premises) => premises.record)).toHaveLength(8);
    const delegate = premisesActableBy(signInBeside(key, PEOPLE.delegate));
    expect(delegate.map((premises) => premises.record)).toEqual([NGUYEN_HUE]);
    expect(delegate[0]?.ids).toContain("nh");
  });

  it("refuses the delegate the party's authorities, which are the principal's to read and grant", () => {
    const key = signIn(PEOPLE.delegate);
    const reader = { kind: "principal" as const, sessionId: key, organisation: "tcv", account: "Hầu Ngọc Ánh" };
    expect(partyAuthorities(reader, null).failure?.code).toBe("FORBIDDEN");
    expect(grantAuthority(principalOf(key), grant()).refusal?.code).toBe("FORBIDDEN");
  });
});

describe("authorityToActAt (DR-201)", { timeout: 60_000 }, () => {
  it("@AC-FR-PTY-021-01 grants the delegate an act at the premises her authority is scoped to, naming the authority and version", () => {
    const key = signIn(PEOPLE.delegate);
    const answer = authorityToActAt(key, "nh", "PERM-590");
    expect(answer).toMatchObject({ kind: "GRANT", reason: "AUTHORITY_EFFECTIVE", actor: "DELEGATE", party: THEN_CUA, authority: "AUT-3KQ8MW2T", version: 2 });
  });

  it("@AC-FR-PTY-021-03 refuses her another premises of the same party OUT_OF_SCOPE, naming only the premises she is scoped to", () => {
    const key = signIn(PEOPLE.delegate);
    const answer = authorityToActAt(key, LE_THANH_TON, "PERM-590");
    expect(answer).toMatchObject({ kind: "REFUSE", reason: "OUT_OF_SCOPE" });
    if (answer.kind !== "REFUSE") throw new Error("granted");
    expect(answer.values.scope).toBe("Then Cửa Coffee & Tea – Nguyễn Huệ");
    expect(JSON.stringify(answer)).not.toContain("Lê Thánh Tôn");
  });

  it("@AC-FR-PTY-027-02 refuses an act kind her scope excludes - authorising a payment - naming the scope it does cover", () => {
    const answer = authorityToActAt(signIn(PEOPLE.delegate), NGUYEN_HUE, "PERM-695");
    expect(answer).toMatchObject({ kind: "REFUSE", reason: "OUT_OF_SCOPE", values: { acts: "READ,SUBMIT", needed: "APPROVE" } });
  });

  it("@AC-FR-PTY-027-11 answers another family's out-of-scope question with the reason and no authority, version or person", () => {
    const answer = authorityToActAt(signIn(PEOPLE.operations), NGUYEN_HUE, "PERM-695", { person: "PPN-PTY-2212" });
    expect(answer.kind).toBe("REFUSE");
    expect(JSON.stringify(answer)).not.toMatch(/AUT-|PPN-|version/);
  });

  it("@AC-FR-PTY-027-10 answers another family asking with the party person reference: a grant naming the party, authority and version", () => {
    const answer = authorityToActAt(signIn(PEOPLE.operations), NGUYEN_HUE, "PERM-590", { person: "PPN-PTY-2212" });
    expect(answer).toMatchObject({ kind: "GRANT", party: THEN_CUA, authority: "AUT-3KQ8MW2T", version: 2 });
  });

  it("@AC-FR-PTY-030-02 refuses the authority that ended, naming the day it ended", () => {
    const answer = authorityToActAt(signIn(PEOPLE.delegate), PASTEUR, "PERM-590");
    expect(answer).toMatchObject({ kind: "REFUSE", reason: "AUTHORITY_EXPIRED", values: { to: "2026-09-30" } });
  });

  it("@AC-FR-PTY-030-01 refuses an authority whose period has not started, naming its start", () => {
    const key = signIn(PEOPLE.principal);
    expect(grantAuthority(principalOf(key), grant()).refusal).toBeNull();
    const answer = authorityToActAt(key, LE_THANH_TON, "READ", { person: "PPN-PTY-2486" });
    expect(answer).toMatchObject({ kind: "REFUSE", reason: "AUTHORITY_NOT_STARTED", values: { from: "2026-11-02T00:00:00+07:00" } });
  });

  it("@AC-FR-PTY-027-05 refuses an act under an authority the principal revoked, naming when and who, as settled", () => {
    const key = signIn(PEOPLE.principal);
    const revoked = revokeAuthority(principalOf(key), "AUT-3KQ8MW2T", { effective: "now", at: "", ground: "Chuyển sang chi nhánh khác" });
    expect(revoked.refusal).toBeNull();
    const delegate = signInBeside(key, PEOPLE.delegate);
    const answer = authorityToActAt(delegate, NGUYEN_HUE, "PERM-590");
    expect(answer).toMatchObject({ kind: "REFUSE", reason: "AUTHORITY_REVOKED", values: { by: "Đỗ Thu Trang", at: revoked.accepted?.at ?? "" } });
    expect(actingAs(delegate)).toBeNull();
  });

  it("@AC-FR-PTY-017-02 still grants at an instant before a revocation, the act performed then staying valid", () => {
    const key = signIn(PEOPLE.operations);
    const before = authorityToActAt(key, NGUYEN_HUE, "READ", { person: "PPN-PTY-2207", at: "2026-09-24T11:20:00+07:00" });
    expect(before).toMatchObject({ kind: "GRANT", reason: "AUTHORITY_EFFECTIVE_AT_INSTANT", authority: "AUT-7RJ4KQ2N" });
    expect(authorityToActAt(key, NGUYEN_HUE, "READ", { person: "PPN-PTY-2207" })).toMatchObject({ kind: "REFUSE", reason: "AUTHORITY_REVOKED" });
  });

  it("@AC-FR-PTY-027-09 refuses a person who holds no authority for the party NO_AUTHORITY, creating none", () => {
    const key = signIn(PEOPLE.operations);
    const before = partyRegister(key).authorities.size;
    expect(authorityToActAt(key, NGUYEN_HUE, "READ", { person: "PPN-PTY-2491" })).toMatchObject({ kind: "REFUSE", reason: "NO_AUTHORITY" });
    expect(partyRegister(key).authorities.size).toBe(before);
  });

  it("@AC-FR-PTY-027-08 refuses an act at a premises whose relationship with the party has ended, for the principal too", () => {
    const key = signIn(PEOPLE.principal);
    closeToday(key, NGUYEN_HUE);
    expect(authorityToActAt(signInBeside(key, PEOPLE.delegate), NGUYEN_HUE, "PERM-590")).toMatchObject({ kind: "REFUSE", reason: "RELATIONSHIP_ENDED" });
    expect(authorityToActAt(key, NGUYEN_HUE, "PERM-590")).toMatchObject({ kind: "REFUSE", reason: "RELATIONSHIP_ENDED" });
  });

  it("refuses the principal a premises their party never operated NO_RELATIONSHIP, which IAM tells apart from an ending", () => {
    expect(authorityToActAt(signIn(PEOPLE.principal), "PRM-9NTR4KBE", "READ")).toMatchObject({ kind: "REFUSE", reason: "NO_RELATIONSHIP" });
  });

  it("@AC-FR-PTY-046-04 refuses a question about a moment that has not arrived, in every contract read", () => {
    const key = signIn(PEOPLE.principal);
    const later = new Date(Date.now() + 86_400_000).toISOString();
    expect(authorityToActAt(key, NGUYEN_HUE, "READ", { at: later }).kind).toBe("INSTANT_IN_FUTURE");
    expect(premisesRelationshipAt(key, NGUYEN_HUE, { at: later }).kind).toBe("INSTANT_IN_FUTURE");
    expect(premisesProfileAt(key, NGUYEN_HUE, later).kind).toBe("INSTANT_IN_FUTURE");
  });
});

describe("the delegate in the other families", { timeout: 60_000 }, () => {
  it("@AC-FR-IAM-016-06 issues the delegate a pairing code for her premises, and none outside her scope", () => {
    const key = signIn(PEOPLE.delegate);
    expect(issuePairing(key, "tcv", "nh", "PLAYBACK").refusal).toBeNull();
    expect(issuePairing(key, "tcv", "pasteur", "PLAYBACK").refusal?.code).toBe("AUTHORITY_NOT_IN_FORCE");
    expect(issuePairing(key, "tcv", "ltt", "PLAYBACK").refusal?.code).toBe("AUTHORITY_NOT_IN_FORCE");
  });

  it("records the code the delegate issued against her authority and the version relied on (FR-PTY-018)", () => {
    const key = signIn(PEOPLE.delegate);
    const issued = issuePairing(key, "tcv", "nh", "PLAYBACK");
    const principal = signInBeside(key, PEOPLE.principal);
    const detail = authorityDetail({ kind: "principal", sessionId: principal, organisation: "tcv", account: "Đỗ Thu Trang" }, "AUT-3KQ8MW2T").data;
    expect(detail?.performed[0]).toMatchObject({ kind: "ISSUED_PAIRING", subject: issued.accepted?.id ?? "", version: { number: 2 } });
  });

  it("lists the delegate's applications for Nguyễn Huệ alone and refuses her a start elsewhere", () => {
    const key = signIn(PEOPLE.delegate);
    const listed = applicationList(key, null).data?.items ?? [];
    expect(listed.length).toBeGreaterThan(0);
    expect(new Set(listed.map((item) => item.premises.id))).toEqual(new Set(["nh"]));
    const refused = startApplication(key, { premisesId: "pasteur", kind: "NEW", from: "2026-11-01", to: "2027-10-31", prior: null, cause: null });
    expect(refused.refusal?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });

  it("refuses the delegate an enrolment in the Player service at a premises outside her scope", () => {
    expect(enrolPremises(signIn(PEOPLE.delegate), "tcv", "Hầu Ngọc Ánh", "pasteur").refusal?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });
});

describe("a premises change reaches every family that asks (FR-PTY-039)", { timeout: 60_000 }, () => {
  it("ends the Player service at a closed premises out of scope, and refuses the pairing and the credential's reinstatement", () => {
    const key = signIn(PEOPLE.principal);
    expect(servicePublicStatus(key, "pasteur")?.status).toBe("ACTIVE");
    const officer = signInBeside(key, PEOPLE.operations);
    const staff = staffOf(officer, PEOPLE.operations);
    expect(suspendCredential(staff, "DCR-3HWT6KQZ9P", "Kiểm tra thiết bị").refusal).toBeNull();
    closeToday(key, PASTEUR);
    expect(servicePublicStatus(key, "pasteur")?.status).toBe("ENDED_OUT_OF_SCOPE");
    expect(issuePairing(key, "tcv", "pasteur", "PLAYBACK").refusal?.code).toBe("FIELD_INVALID");
    expect(reinstateCredential(staff, "DCR-3HWT6KQZ9P", "Đã kiểm tra").refusal?.code).toBe("PREMISES_RELATIONSHIP_ENDED");
  });

  it("refuses the reinstatement of the credential at Áp Mái Bar, whose operator changed on 1 October", () => {
    const key = signIn(PEOPLE.operations);
    expect(reinstateCredential(staffOf(key, PEOPLE.operations), "DCR-7D40HQXA2G", "Đã kiểm tra").refusal?.code).toBe("PREMISES_RELATIONSHIP_ENDED");
  });

  it("answers the verification route about a premises admitted to the register from the register itself", () => {
    const key = signIn(PEOPLE.cmo);
    const answer = verifyAuthorityScope(key, { organisation: "lamhong", registered: true }, { premises: "prm-3nhz6pkw", at: "2026-10-10T10:00:00+07:00" });
    expect(answer).toMatchObject({ kind: "answered", verification: { answer: "NOT_EFFECTIVE", premises: { reference: NGUYEN_HUE } } });
  });
});

describe("premises relationships at an instant (FR-PTY-045)", () => {
  it("@AC-FR-PTY-045-01 answers a relationship effective at the instant, naming the party then", () => {
    expect(premisesRelationshipAt(signIn(PEOPLE.operations), AP_MAI_BAR, { at: "2026-09-15T12:00:00+07:00" })).toMatchObject({ kind: "EFFECTIVE", party: "PTY-131958" });
  });

  it("@AC-FR-PTY-045-02 answers a relationship that ended before the instant no, naming the day it ended and its cause", () => {
    const answer = premisesRelationshipAt(signIn(PEOPLE.operations), "ap-mai-bar", { organisation: "ap-mai" });
    expect(answer).toMatchObject({ kind: "ENDED", party: "PTY-131958", endedOn: "2026-09-30", cause: "OPERATOR_CHANGE" });
  });

  it("answers a premises nobody ever operated NONE, which is not an ending", () => {
    expect(premisesRelationshipAt(signIn(PEOPLE.operations), "PRM-8QNH6WZT")).toMatchObject({ kind: "NONE", startsOn: null });
  });

  it("@AC-FR-PTY-045-06 refuses a relationship question with no premises PREMISES_REQUIRED", () => {
    const key = signIn(PEOPLE.operations);
    expect(premisesTimeline(staffOf(key, PEOPLE.operations), "", "2026-09-15T09:00+07:00").failure?.code).toBe("PREMISES_REQUIRED");
  });

  it("@AC-FR-PTY-045-05 refuses a moment that has not arrived rather than answering from the present", () => {
    const key = signIn(PEOPLE.operations);
    expect(premisesTimeline(staffOf(key, PEOPLE.operations), AP_MAI_BAR, "2027-08-01T09:00+07:00").failure?.code).toBe("INSTANT_IN_FUTURE");
  });

  it("lists every relationship of a premises with its end cause, and every change recorded against it", () => {
    const key = signIn(PEOPLE.operations);
    const timeline = premisesTimeline(staffOf(key, PEOPLE.operations), AP_MAI_BAR, "2026-09-15T09:00+07:00").data;
    expect(timeline?.relationships.map((row) => [row.party.record, row.endCause])).toEqual([
      ["PTY-131958", "OPERATOR_CHANGE"],
      ["PTY-127730", null],
    ]);
    expect(timeline?.changes.map((change) => change.id)).toEqual(["CHG-7KD2QAPM4T"]);
    expect(timeline?.asked?.answer).toBe("AUTHORITY_EFFECTIVE");
  });

  it("@AC-FR-PTY-025-05 gives a premises' profile with each field's provenance", () => {
    const profile = premisesProfileAt(signIn(PEOPLE.operations), NGUYEN_HUE);
    if (profile.kind !== "FOUND") throw new Error(profile.kind);
    expect(profile.fields.find((field) => field.name === "ADDRESS")).toMatchObject({ value: "41 Nguyễn Huệ", provenance: { route: "AUTHORITATIVE_SOURCE", sourceKey: "NATIONAL_REGISTER" } });
  });
});

describe("the premises portfolio (FR-PTY-007)", { timeout: 60_000 }, () => {
  it("@AC-FR-PTY-007-01 lists the principal's party's premises and none of another party", () => {
    const view = portfolio(principalOf(signIn(PEOPLE.principal)), null).data;
    expect(view?.rows).toHaveLength(8);
    expect(view?.rows.some((row) => row.record === "PRM-9NTR4KBE")).toBe(false);
  });

  it("lists the delegate's one premises with what she may do there, and refuses her another premises' detail", () => {
    const key = signIn(PEOPLE.delegate);
    const view = portfolio(principalOf(key), null).data;
    expect(view?.rows.map((row) => [row.record, row.acts])).toEqual([[NGUYEN_HUE, ["READ", "SUBMIT"]]]);
    expect(portalPremises(principalOf(key), LE_THANH_TON).failure?.code).toBe("NOT_YOUR_PREMISES");
    expect(portalPremises(principalOf(key), NGUYEN_HUE).data?.acts).toEqual(["READ", "SUBMIT"]);
  });

  it("@AC-FR-PTY-007-04 refuses a portfolio asked for a party the person holds no authority for, listing nothing", () => {
    const answer = portfolio(principalOf(signIn(PEOPLE.principal)), "PTY-127730");
    expect(answer).toEqual({ data: null, failure: { code: "NOT_YOUR_PARTY", traceId: null, retryable: false } });
  });
});

describe("granting an authority (DR-202)", () => {
  it("@AC-FR-PTY-001-03 refuses a holder nobody has recorded PARTY_PERSON_NOT_FOUND, creating no person", () => {
    const key = signIn(PEOPLE.principal);
    const persons = partyRegister(key).persons.size;
    const answer = grantAuthority(principalOf(key), grant({ person: "Nguyễn Văn Mới" }));
    expect(answer.refusal).toMatchObject({ code: "PARTY_PERSON_NOT_FOUND", field: "party_person_id" });
    expect(partyRegister(key).persons.size).toBe(persons);
  });

  it("@AC-FR-PTY-005-06 refuses an authority with no end date while no delegation standard is set, whatever approval it carries", () => {
    const key = signIn(PEOPLE.principal);
    const answer = grantAuthority(principalOf(key), grant({ to: null, toText: "", approvalAuthority: "PPN-PTY-2201", approvalLevel: "PRINCIPAL" }));
    expect(answer.refusal?.code).toBe("NO_DELEGATION_STANDARD");
  });

  it("@AC-FR-PTY-005-05 asks for the approval the standard fixes, naming the level", () => {
    const key = signIn(PEOPLE.principal);
    partyRegister(key).delegationStandard = { level: "PRINCIPAL" };
    expect(grantAuthority(principalOf(key), grant({ to: null, toText: "" })).refusal).toMatchObject({ code: "OPEN_ENDED_APPROVAL_REQUIRED", values: { level: "PRINCIPAL" } });
  });

  it("@AC-FR-PTY-005-07 refuses an approval at a lower level than the standard fixes", () => {
    const key = signIn(PEOPLE.principal);
    partyRegister(key).delegationStandard = { level: "PRINCIPAL" };
    const answer = grantAuthority(principalOf(key), grant({ to: null, toText: "", approvalAuthority: "PPN-PTY-2212", approvalLevel: "BRANCH_MANAGER" }));
    expect(answer.refusal).toMatchObject({ code: "APPROVAL_LEVEL_INSUFFICIENT", values: { level: "PRINCIPAL" } });
  });

  it("@AC-FR-PTY-005-08 refuses an authority with no end date approved by the person it is granted to", () => {
    const key = signIn(PEOPLE.principal);
    partyRegister(key).delegationStandard = { level: "PRINCIPAL" };
    const answer = grantAuthority(principalOf(key), grant({ to: null, toText: "", approvalAuthority: "PPN-PTY-2486", approvalLevel: "PRINCIPAL" }));
    expect(answer.refusal?.code).toBe("SELF_APPROVAL_REFUSED");
  });

  it("@AC-FR-PTY-026-01 records an authority with no end date with the approval and the approver", () => {
    const key = signIn(PEOPLE.principal);
    partyRegister(key).delegationStandard = { level: "PRINCIPAL" };
    const answer = grantAuthority(principalOf(key), grant({ to: null, toText: "", approvalAuthority: "PPN-PTY-2201", approvalLevel: "PRINCIPAL" }));
    const reader = { kind: "principal" as const, sessionId: key, organisation: "tcv", account: "Đỗ Thu Trang" };
    const detail = authorityDetail(reader, answer.accepted?.authority ?? "").data;
    expect(detail).toMatchObject({ to: null, approval: { by: "PPN-PTY-2201", level: "PRINCIPAL" } });
  });

  it("@AC-FR-PTY-048-01 records the grant with the acting person, what she relied on, and the instant", () => {
    const key = signIn(PEOPLE.principal);
    const answer = grantAuthority(principalOf(key), grant());
    const auditor = signInBeside(key, PEOPLE.supervisor);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const rows = changeRecords(staffOf(auditor, PEOPLE.supervisor), { from: today, to: today, subjectKind: "AUTHORITY", subject: answer.accepted?.authority ?? "" }).data?.rows ?? [];
    expect(rows[0]).toMatchObject({ change: "AUTHORITY_GRANTED", actor: { kind: "PERSON", name: "Đỗ Thu Trang", person: "PPN-PTY-2201" }, reliedOn: { kind: "AUTHORITY", authority: null } });
  });

  it("propagates a revocation to every decision point at its instant, inside the interval", () => {
    const key = signIn(PEOPLE.principal);
    const revoked = revokeAuthority(principalOf(key), "AUT-3KQ8MW2T", { effective: "now", at: "", ground: "Nghỉ việc" });
    const reader = { kind: "principal" as const, sessionId: key, organisation: "tcv", account: "Đỗ Thu Trang" };
    const propagation = authorityDetail(reader, "AUT-3KQ8MW2T").data?.revocation?.propagation ?? [];
    expect(propagation.map((point) => [point.point, point.stoppedAt])).toEqual([
      ["PORTAL_SESSIONS", revoked.accepted?.at],
      ["API_TOKENS", revoked.accepted?.at],
      ["PLAYER", revoked.accepted?.at],
    ]);
  });
});

describe("the change record (FR-PTY-018, 048)", () => {
  it("@AC-FR-PTY-018-04 refuses a read with no period PERIOD_REQUIRED", () => {
    const key = signIn(PEOPLE.supervisor);
    expect(changeRecords(staffOf(key, PEOPLE.supervisor), { from: null, to: null, subjectKind: null, subject: null }).failure?.code).toBe("PERIOD_REQUIRED");
  });

  it("@AC-FR-PTY-048-04 records an operator's principal under the permission row, never a party authority", () => {
    const key = signIn(PEOPLE.preparer);
    const answer = recordPrincipal(staffOf(key, PEOPLE.preparer), "PTY-131958", {
      person: "PPN-PTY-2491",
      basis: "Giám đốc",
      evidence: "GPKD-0158",
      acts: ["READ", "SUBMIT", "MANAGE_AUTHORITIES"],
      from: "2026-11-01",
      fromText: "01/11/2026",
      to: "2027-10-31",
      toText: "31/10/2027",
    });
    expect(answer.refusal).toBeNull();
    const auditor = signInBeside(key, PEOPLE.supervisor);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const row = changeRecords(staffOf(auditor, PEOPLE.supervisor), { from: today, to: today, subjectKind: null, subject: answer.accepted?.authority ?? "" }).data?.rows[0];
    expect(row).toMatchObject({ change: "PRINCIPAL_RECORDED", actor: { kind: "PERSON", name: "Quan Ngọc Trâm", person: null }, reliedOn: { kind: "PERMISSION", row: "RECORD_PRINCIPAL" } });
  });
});

describe("the party person (FR-PTY-019, 044)", () => {
  it("@AC-FR-PTY-019-05 refuses a person reference that names no person", () => {
    const key = signIn(PEOPLE.operations);
    expect(partyPerson(staffOf(key, PEOPLE.operations), "PPN-PTY-2299").failure?.code).toBe("PARTY_PERSON_NOT_FOUND");
  });

  it("@AC-FR-PTY-019-02 links an account later and keeps the reference every act names", () => {
    const key = signIn(PEOPLE.operations);
    const staff = staffOf(key, PEOPLE.operations);
    expect(amendPartyPerson(staff, "PPN-PTY-2219", { reference: "", displayName: "", account: "ngan.luc@thencuaviet.vn" }).accepted).toEqual({ person: "PPN-PTY-2219" });
    expect(partyPerson(staff, "PPN-PTY-2219").data).toMatchObject({ reference: "PPN-PTY-2219", account: "ngan.luc@thencuaviet.vn", hasAccount: true });
  });

  it("@AC-FR-PTY-019-07 refuses a change of the person reference IDENTIFIER_IMMUTABLE", () => {
    const key = signIn(PEOPLE.operations);
    const answer = amendPartyPerson(staffOf(key, PEOPLE.operations), "PPN-PTY-2219", { reference: "PPN-PTY-2300", displayName: "", account: "x@thencuaviet.vn" });
    expect(answer.refusal?.code).toBe("IDENTIFIER_IMMUTABLE");
  });

  it("@AC-FR-PTY-019-06 refuses linking an account another person already holds, naming that person", () => {
    const key = signIn(PEOPLE.operations);
    const answer = addPartyPerson(staffOf(key, PEOPLE.operations), THEN_CUA, { displayName: "Hầu Ánh", account: "anh.hau@thencuaviet.vn" });
    expect(answer.refusal).toMatchObject({ code: "ACCOUNT_ALREADY_LINKED", values: { person: "PPN-PTY-2212" } });
  });

  it("@AC-FR-PTY-044-03 answers a reference no record ever carried as never existing, apart from a current one", () => {
    const key = signIn(PEOPLE.operations);
    expect(personExists(key, "PPN-PTY-2212")).toEqual({ kind: "CURRENT", person: "PPN-PTY-2212" });
    expect(personExists(key, "PPN-PTY-9999")).toEqual({ kind: "NEVER_EXISTED", person: "PPN-PTY-9999" });
  });
});

describe("identification and candidacy", () => {
  it("@AC-FR-PTY-003-01 identifies a party from the source with the source and the time it answered", () => {
    const key = signIn(PEOPLE.operations);
    const staff = staffOf(key, PEOPLE.operations);
    const record = createParty(staff, { kind: "ORGANISATION", legalName: "Hội Quyền tác giả Âm nhạc Lam Hồng", businessRegistration: "0318 552 107" }).accepted?.record ?? "";
    expect(searchSource(staff, record, "BUSINESS_REGISTRATION_NUMBER").accepted).toEqual({ matched: true });
    const party = partyRegister(key).parties.get(record);
    expect(party?.state).toBe("IDENTIFIED");
    expect(party?.identification).toMatchObject({ route: "SOURCED", reasonCode: "IDENTIFIED_FROM_SOURCE", source: { name: "NATIONAL_REGISTER" } });
    expect(party?.identification?.at).not.toBeNull();
  });

  it("@AC-FR-PTY-003-03 refuses a sourced identification with no source configured, naming the configuration point", () => {
    const key = signIn(PEOPLE.operations);
    partyRegister(key).source = "NOT_CONFIGURED";
    expect(searchSource(staffOf(key, PEOPLE.operations), "PTY-120587", "BUSINESS_REGISTRATION_NUMBER").refusal).toMatchObject({ code: "SOURCE_NOT_CONFIGURED", values: { config: "CFG-241" } });
  });

  it("@AC-FR-PTY-008-09 opens a review for a candidacy an officer raises, and links nothing", () => {
    const key = signIn(PEOPLE.operations);
    const staff = staffOf(key, PEOPLE.operations);
    const answer = raiseCandidacy(staff, { subjectKind: "PARTY", left: "PTY-139861", right: "PTY-135204", ground: "Cùng địa chỉ trụ sở" });
    expect(reviewQueue(staff, { kind: null, age: null }).data?.rows.some((row) => row.id === answer.accepted?.review)).toBe(true);
    expect(partyRegister(key).parties.get("PTY-139861")?.state).toBe("IDENTIFIED");
  });

  it("@AC-FR-PTY-008-10 refuses a candidacy naming one record twice", () => {
    const key = signIn(PEOPLE.operations);
    expect(raiseCandidacy(staffOf(key, PEOPLE.operations), { subjectKind: "PARTY", left: "PTY-139861", right: "pty-139861", ground: "x" }).refusal?.code).toBe("SAME_RECORD");
  });

  it("@AC-FR-PTY-008-11 refuses a candidacy naming a record that does not exist, naming it", () => {
    const key = signIn(PEOPLE.operations);
    expect(raiseCandidacy(staffOf(key, PEOPLE.operations), { subjectKind: "PARTY", left: "PTY-139861", right: "PTY-999999", ground: "x" }).refusal).toMatchObject({ code: "RECORD_NOT_FOUND", values: { record: "PTY-999999" } });
  });

  it("@AC-FR-PTY-008-12 refuses a second candidacy for a pair under review, naming the open review", () => {
    const key = signIn(PEOPLE.operations);
    const answer = raiseCandidacy(staffOf(key, PEOPLE.operations), { subjectKind: "PARTY", left: "PTY-326915", right: THEN_CUA, ground: "x" });
    expect(answer.refusal).toMatchObject({ code: "CANDIDACY_ALREADY_OPEN", values: { review: "IDR-7KQ2MXT4WN" } });
  });
});

describe("the overlap report (SCR-PTY-18)", () => {
  it("gives the data owner every organisation's verification reads of a premises, and refuses an officer without the role", () => {
    const key = signIn(PEOPLE.cmo);
    verifyAuthorityScope(key, { organisation: "lamhong", registered: true }, { premises: "PRM-6BVK3RQT", at: "2026-09-26T21:00:00+07:00" });
    const owner = signInBeside(key, PEOPLE.operations);
    const report = overlapReport(staffOf(owner, PEOPLE.operations), "PRM-6BVK3RQT", { from: null, to: null }).data;
    expect(report?.rows.map((row) => [row.organisation.id, row.answer])).toEqual([["lamhong", "ANOTHER_AUTHORITY_EXISTS"]]);
    expect(report?.toldAnother).toBe(1);
    const officer = signInBeside(key, PEOPLE.approver);
    expect(overlapReport(staffOf(officer, PEOPLE.approver), "PRM-6BVK3RQT", { from: null, to: null }).failure?.code).toBe("FORBIDDEN");
  });
});

describe("the delegate's act and its revocation (FR-PTY-029)", { timeout: 60_000 }, () => {
  it("@AC-FR-PTY-029-02 refuses an act prepared before the revocation and performed after it, naming the revocation, and keeps what was prepared", () => {
    const delegate = signIn(PEOPLE.delegate);
    const started = startApplication(delegate, { premisesId: "nh", kind: "RENEWAL", from: "2027-09-24", to: "2028-09-23", prior: "OBD-8KWT2PZH6M", cause: null });
    const reference = started.accepted?.application ?? "";
    expect(started.refusal).toBeNull();
    const principal = signInBeside(delegate, PEOPLE.principal);
    const revoked = revokeAuthority(principalOf(principal), "AUT-3KQ8MW2T", { effective: "now", at: "", ground: "Chuyển công tác" });
    const answer = recordActUnderAuthority(delegate, "nh", "PERM-599", { kind: "SUBMITTED_APPLICATION", subject: reference });
    expect(answer).toMatchObject({ kind: "REFUSE", reason: "AUTHORITY_REVOKED", values: { by: "Đỗ Thu Trang", at: revoked.accepted?.at ?? "" } });
    expect(applicationList(principal, null).data?.items.some((item) => item.reference === reference)).toBe(true);
  });

  it("refuses evidence attached by a delegate whose scope no longer covers sending, at the premises she still reads", () => {
    const delegate = signIn(PEOPLE.delegate);
    const reference = startApplication(delegate, { premisesId: "nh", kind: "RENEWAL", from: "2027-09-24", to: "2028-09-23", prior: "OBD-8KWT2PZH6M", cause: null }).accepted?.application ?? "";
    const principal = signInBeside(delegate, PEOPLE.principal);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const amended = amendAuthority(principalOf(principal), "AUT-3KQ8MW2T", { acts: ["READ"], from: today, fromText: today, to: "2027-06-30", toText: "30/06/2027" });
    expect(amended.refusal).toBeNull();
    expect(applicationList(delegate, null).data?.items.some((item) => item.reference === reference)).toBe(true);
    expect(addEvidenceItem(delegate, reference, "PHOTO", { name: "mat-tien.jpg", type: "image/jpeg", sizeBytes: 120_000 }).refusal?.code).toBe("NOT_AUTHORISED_FOR_PREMISES");
  });
});

describe("a revocation that reached a decision point late (FR-PTY-028)", { timeout: 60_000 }, () => {
  it("@AC-FR-PTY-028-02 refuses the late Player point's next request and records it stopped, after which the exception may be resolved", () => {
    const key = signIn(PEOPLE.supervisor);
    const security = staffOf(key, PEOPLE.supervisor);
    expect(resolveException(security, "EXC-AUT-7RJ4KQ2N", "Đã khởi động lại điểm quyết định").refusal?.code).toBe("CONDITION_STILL_HOLDS");
    expect(authorityToActAt(key, "pasteur", "PERM-365", { person: "PPN-PTY-2207" })).toMatchObject({ kind: "REFUSE", reason: "AUTHORITY_REVOKED" });
    const row = exceptionQueue(security).data?.rows.find((entry) => entry.id === "EXC-AUT-7RJ4KQ2N");
    expect(row?.condition).toMatchObject({ kind: "REVOCATION", holds: false });
    expect(resolveException(security, "EXC-AUT-7RJ4KQ2N", "Điểm quyết định của Player đã đọc lại thẩm quyền").refusal).toBeNull();
    expect(exceptionQueue(security).data?.rows.find((entry) => entry.id === "EXC-AUT-7RJ4KQ2N")?.state).toBe("RESOLVED");
  });
});

describe("re-pointing to a new geography version (FR-PTY-040)", { timeout: 60_000 }, () => {
  it("@AC-FR-PTY-040-01 re-points a premises to its successor area from the instant it is run", () => {
    const key = signIn(PEOPLE.operations);
    const owner = staffOf(key, PEOPLE.operations);
    const answer = repointGeography(owner, { fromVersion: "2024-12", toVersion: "2025-07" });
    expect(answer.accepted?.repointed).toBe(1);
    const profile = premisesProfileAt(key, GOC_SAU);
    if (profile.kind !== "FOUND") throw new Error(profile.kind);
    expect(profile.fields.filter((field) => field.name === "ADMINISTRATIVE_AREA_KEY" || field.name === "GEOGRAPHY_VERSION").map((field) => field.value)).toEqual(["Phường Thạnh Mỹ Tây", "2025-07"]);
    expect(geographyRepointings(owner, GOC_SAU).data?.rows).toMatchObject([{ fromArea: "Phường 22, quận Bình Thạnh", fromVersion: "2024-12", toArea: "Phường Thạnh Mỹ Tây", toVersion: "2025-07" }]);
  });

  it("@AC-FR-PTY-040-02 answers a question about an instant before the re-pointing with the area current then", () => {
    const key = signIn(PEOPLE.operations);
    const before = new Date(Date.now() - 60_000).toISOString();
    repointGeography(staffOf(key, PEOPLE.operations), { fromVersion: "2024-12", toVersion: "2025-07" });
    const profile = premisesProfileAt(key, GOC_SAU, before);
    if (profile.kind !== "FOUND") throw new Error(profile.kind);
    expect(profile.fields.find((field) => field.name === "ADMINISTRATIVE_AREA_KEY")?.value).toBe("Phường 22, quận Bình Thạnh");
  });

  it("@AC-FR-PTY-040-03 leaves the premises of an area with no successor where they are and raises an exception naming the area", () => {
    const key = signIn(PEOPLE.operations);
    const owner = staffOf(key, PEOPLE.operations);
    const answer = repointGeography(owner, { fromVersion: "2024-12", toVersion: "2025-07" });
    expect(answer.accepted?.withdrawn).toMatchObject([{ area: "Phường 25, quận Bình Thạnh", premises: 1 }]);
    const profile = premisesProfileAt(key, MAI_HIEN_XANH);
    if (profile.kind !== "FOUND") throw new Error(profile.kind);
    expect(profile.fields.find((field) => field.name === "ADMINISTRATIVE_AREA_KEY")?.value).toBe("Phường 25, quận Bình Thạnh");
    const raised = exceptionQueue(owner).data?.rows.find((row) => row.id === answer.accepted?.withdrawn[0]?.exception);
    expect(raised).toMatchObject({ kind: "NO_SUCCESSOR_AREA", state: "OPEN", subject: { kind: "AREA", area: "Phường 25, quận Bình Thạnh", version: "2024-12" }, condition: { premises: 1, holds: true } });
  });

  it("@AC-FR-PTY-040-04 refuses a re-pointing that can move nothing NO_SUCCESSOR_AREA, keeping one exception open for the area", () => {
    const key = signIn(PEOPLE.operations);
    const owner = staffOf(key, PEOPLE.operations);
    repointGeography(owner, { fromVersion: "2024-12", toVersion: "2025-07" });
    const again = repointGeography(owner, { fromVersion: "2024-12", toVersion: "2025-07" });
    expect(again.refusal).toMatchObject({ code: "NO_SUCCESSOR_AREA", values: { area: "Phường 25, quận Bình Thạnh", premises: "1" } });
    expect(exceptionQueue(owner).data?.rows.filter((row) => row.kind === "NO_SUCCESSOR_AREA")).toHaveLength(1);
  });

  it("@AC-FR-PTY-040-05 refuses a geography version the service does not hold, re-pointing nothing", () => {
    const key = signIn(PEOPLE.operations);
    const owner = staffOf(key, PEOPLE.operations);
    expect(repointGeography(owner, { fromVersion: "2024-12", toVersion: "2028-02" }).refusal).toMatchObject({ code: "GEOGRAPHY_VERSION_UNKNOWN", values: { version: "2028-02" } });
    expect(geographyRepointings(owner, GOC_SAU).data?.rows).toEqual([]);
  });

  it("closes the area's exception only once no premises carries the area, after the data owner overrides it", () => {
    const key = signIn(PEOPLE.operations);
    const owner = staffOf(key, PEOPLE.operations);
    const exception = repointGeography(owner, { fromVersion: "2024-12", toVersion: "2025-07" }).accepted?.withdrawn[0]?.exception ?? "";
    expect(resolveException(owner, exception, "Đã xác minh địa bàn").refusal).toMatchObject({ code: "CONDITION_STILL_HOLDS", values: { kind: "AREA", figure: "1" } });
    expect(overridePremisesField(owner, MAI_HIEN_XANH, { field: "administrative_area", value: "Phường Thạnh Mỹ Tây", authority: "MEMO-2026-0141" }).refusal).toBeNull();
    expect(resolveException(owner, exception, "Đã xác minh địa bàn").refusal).toBeNull();
  });

  it("refuses a re-pointing to a member of staff who is not the data owner", () => {
    const key = signIn(PEOPLE.approver);
    expect(repointGeography(staffOf(key, PEOPLE.approver), { fromVersion: "2024-12", toVersion: "2025-07" }).refusal?.code).toBe("FORBIDDEN");
    expect(geographyRepointings(staffOf(key, PEOPLE.approver), GOC_SAU).failure?.code).toBe("FORBIDDEN");
  });
});
