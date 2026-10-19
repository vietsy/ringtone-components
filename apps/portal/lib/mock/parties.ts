import type { LoadOutcome } from "@rightone/ui";
import type { Act, ActKind, IdentificationView, IdentifierKind, PartyKind, PartyOrigin, PartyState, ReviewKind } from "@/lib/api/parties";

/*
 * The party family's data, from the premises canvas's PTY boards (SCR-PTY-01 to 05, 11 to 13) and the data sheet on
 * its index frame: the parties of the register, the persons of the party register, Then Cửa Việt's eight premises and
 * four authorities, and the duplicate review of its two records. Each party is one organisation of the world, keyed
 * by its party record, with the id the other families give it (`tcv`, `ap-mai`, ...). What the boards leave out is
 * left out here rather than made up; where a record needs a reference the boards do not draw, it is named below.
 */

// ---------------------------------------------------------------- review views

/** The failures a reviewer can draw on any PTY screen with `?view=`: the reads' outage, and a list's stale cursor. */
export const PARTIES_VIEWS = ["loading", "error", "cursor-invalid", "not-found"] as const;
export type PartiesView = Exclude<(typeof PARTIES_VIEWS)[number], "loading">;

/** The source conditions SCR-PTY-03 draws besides the one the world has: the P1 frame with no source, and an outage. */
export const PTY03_SOURCE_VIEWS = ["no-source", "source-unreachable"] as const;

/** The trace each screen's broken state prints, as its board draws it. */
export const PARTIES_TRACES = {
  "01": "2f9c4e71a0b6d853",
  "02": "7a3d0c95e2b41f68",
  "04": "91e4b2d07c3f5a86",
  "05": "c8f05a3e91d27b46",
  "11": "9a4c2e71b05d3f86",
  "12": "2f7d0b93c6e14a58",
  "13": "6b1e8d40a7c35f92",
} as const;

export function mockPartiesFailure(view: PartiesView, trace: string): LoadOutcome<never> {
  switch (view) {
    case "error":
      return { data: null, failure: { code: "INTERNAL_ERROR", traceId: trace, retryable: true } };
    case "cursor-invalid":
      return { data: null, failure: { code: "CURSOR_INVALID", traceId: null, retryable: false } };
    case "not-found":
      return { data: null, failure: { code: "PARTY_NOT_FOUND", traceId: null, retryable: false } };
  }
}

// ---------------------------------------------------------------- the seed's shapes

export interface SeedParty {
  record: string;
  /** The id the other families and RightOne ID give the organisation; null for a record no other family knows. */
  organisation: string | null;
  legalName: string;
  kind: PartyKind;
  businessRegistration: string | null;
  state: PartyState;
  origin: PartyOrigin;
  /** The principal, with the person record they are where the register holds one. */
  principal: { name: string; fromRegister: boolean; person?: string | null } | null;
  identification: IdentificationView | null;
  supersededBy: { record: string; on: string; by: string } | null;
  /** References other modules hold to the record, which a linkage disposes of: counted, not stored here. */
  licenceHistory: number;
  verificationReads: number;
  changeRecords: { count: number; since: string } | null;
}

export interface SeedRelationship {
  party: string;
  premises: { record: string | null; name: string };
  from: string | null;
  /** The last day the party operated it; null while it still does. */
  to: string | null;
  /** How far the premises' application has gone, where it holds no status record yet (the board's words). */
  application: "IN_REVIEW" | "DRAFT" | null;
  /** Why it ended, where a recorded premises change ended it (SM-191). */
  endCause?: "OPERATOR_CHANGE" | "CLOSURE" | "CESSATION" | null;
  /** An operator who recorded it, or the change whose sweep started it; absent for one the source gave. */
  recorded?: { by: string; at: string } | null;
}

export interface SeedPerson {
  reference: string;
  name: string;
  /** The RightOne ID account linked to the person, where the register knows its reference. */
  account: string | null;
  hasAccount: boolean;
  createdBy: string | null;
  /** A day, or an instant where the board gives the time. */
  createdAt: string | null;
}

export interface SeedVersion {
  /** The instant the version starts to apply; it applies until the next version starts. */
  from: string;
  acts: readonly Act[];
}

export interface SeedAuthority {
  reference: string;
  party: string;
  person: string;
  /** The premises the authority is scoped to, by name; null for the whole party. */
  premises: string | null;
  basis: string | null;
  evidence: string | null;
  granted: { at: string; by: string } | null;
  /** A principal recorded on the console rather than granted on the portal. */
  recorded: { by: string; at: string } | null;
  versions: readonly SeedVersion[];
  /** The last day the authority grants; null for no end date. */
  to: string | null;
  revocation: {
    at: string;
    by: string;
    ground: string;
    propagation: readonly {
      point: "PORTAL_SESSIONS" | "API_TOKENS" | "PLAYER";
      stoppedAt: string | null;
      afterSeconds: number | null;
      exception: { raisedAt: string; acknowledgedBy: string; acknowledgedAt: string } | null;
    }[];
  } | null;
  performed: readonly { at: string; kind: ActKind; subject: string }[];
}

export interface SeedReview {
  id: string;
  kind: ReviewKind;
  /** Duplicate candidacy: the record identified first, then the other. Identification: the party. */
  records: readonly string[];
  openedAt: string;
}

export interface SeedSearch {
  party: string;
  identifierKind: IdentifierKind;
  identifier: string;
  matched: boolean;
  at: string;
}

/** A record the national business-registration source holds, by its number masked as the register keeps it. */
export interface SourceRecord {
  identifier: string;
  legalName: string;
  kind: PartyKind;
}

export interface PartiesSeed {
  /** What the source (CFG-241) answers a search with: the records it holds. */
  source: readonly SourceRecord[];
  parties: readonly SeedParty[];
  relationships: readonly SeedRelationship[];
  persons: readonly SeedPerson[];
  personParties: Readonly<Record<string, readonly string[]>>;
  authorities: readonly SeedAuthority[];
  reviews: readonly SeedReview[];
  searches: readonly SeedSearch[];
}

// ---------------------------------------------------------------- the data sheet

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;

const TRANG = "Đỗ Thu Trang";
const LUONG = "Phan Gia Lượng";
const QUY = "Lê Đăng Quý";

const THEN_CUA = "PTY-118342";
const THEN_CUA_IMPORTED = "PTY-326915";
const HEM_214 = "PTY-120587";
const LINTEL = "PTY-127730";

/** A party the source identified; the boards give the time for Then Cửa Việt only. */
const sourced = (on: string | null, identifierKind: IdentifierKind | null): IdentificationView => ({
  route: "SOURCED",
  at: on,
  identifierKind,
  declaration: null,
  decided: null,
});

const party = (
  record: string,
  organisation: string | null,
  legalName: string,
  kind: PartyKind,
  businessRegistration: string | null,
  more: Partial<Omit<SeedParty, "record" | "organisation" | "legalName" | "kind" | "businessRegistration">> = {},
): SeedParty => ({
  record,
  organisation,
  legalName,
  kind,
  businessRegistration,
  state: "IDENTIFIED",
  origin: { kind: "SOURCE", on: null },
  principal: null,
  identification: sourced(null, businessRegistration !== null ? "BUSINESS_REGISTRATION_NUMBER" : null),
  supersededBy: null,
  licenceHistory: 0,
  verificationReads: 0,
  changeRecords: null,
  ...more,
});

/**
 * The register's parties: SCR-PTY-01's eleven, and Khách sạn Nắng Xiên, an organisation of the world the registration
 * console reads (business registration ******3307, register version 3) which no PTY board lists; its party record
 * PTY-146215 is set here because no board gives one. Lam Hồng and Hạc Bạch are not here: the catalogue holds no party
 * record for either (CAT's seed), so neither is in the register yet. Dây Đàn's record is IDENTIFIED as SCR-PTY-01
 * draws it; the identification review SCR-PTY-04 also lists for it is left out, since an open review would make the
 * record REFERRED (SM-190) and no board draws that declaration.
 */
const PARTIES: readonly SeedParty[] = [
  party(THEN_CUA_IMPORTED, null, "CÔNG TY TNHH THEN CỬA VIỆT", "ORGANISATION", "******6041", {
    state: "REFERRED",
    origin: { kind: "IMPORTED", on: "2026-09-12" },
    identification: null,
    licenceHistory: 2,
    verificationReads: 5,
    changeRecords: { count: 14, since: "2026-09-12" },
  }),
  party("PTY-131958", "ap-mai", "Công ty TNHH Áp Mái", "ORGANISATION", "******2958"),
  party("PTY-135204", "hat-me", "Công ty TNHH Chay Hạt Mè", "ORGANISATION", "******7314"),
  party("PTY-142273", "may-song", "Công ty TNHH Khách sạn Mây Sông", "ORGANISATION", "******8150"),
  party("PTY-146215", "nang-xien", "Công ty TNHH Khách sạn Nắng Xiên", "ORGANISATION", "******3307"),
  party("PTY-139861", null, "Công ty TNHH Nhà hàng Chái Bếp Quê", "ORGANISATION", "******2719"),
  party(LINTEL, "lintel", "Công ty TNHH The Lintel", "ORGANISATION", "******5382"),
  party(THEN_CUA, "tcv", "Công ty TNHH Then Cửa Việt", "ORGANISATION", "******6041", {
    origin: { kind: "SOURCE", on: "2026-08-31" },
    principal: { name: TRANG, fromRegister: true, person: "PPN-PTY-2201" },
    identification: sourced(at("2026-08-31", "02:40"), "BUSINESS_REGISTRATION_NUMBER"),
  }),
  party("PTY-331274", "dayan", "Dây Đàn Rights Agency", "ORGANISATION", "******9046"),
  // Before its identification: SCR-PTY-02's empty view and SCR-PTY-03 draw it as DRAFT, the source searched and no match.
  party(HEM_214, "qnh", "Hộ kinh doanh Quán Nướng Hẻm 214", "HOUSEHOLD_BUSINESS", "******0583", {
    state: "DRAFT",
    origin: { kind: "DECLARED" },
    identification: null,
  }),
  party("PTY-219604", null, "Phan Gia Huy", "NATURAL_PERSON", null),
  party("PTY-301446", null, "The Lintel Coffee", "ORGANISATION", null, {
    state: "SUPERSEDED",
    supersededBy: { record: LINTEL, on: "2026-09-18", by: QUY },
  }),
];

/**
 * Who operates which premises. Then Cửa Việt's eight are SCR-PTY-02's, in its order, with the dates they are
 * operated from; the imported record's two ended relationships are SCR-PTY-05's. The other parties' premises are the
 * ones the world's other families give them, with their register records, and the start the PTY boards draw where
 * they draw one: Mây Sông's since 14 March 2019 (SCR-PTY-07), Áp Mái's since 2 March 2022 (SCR-PTY-10), The Lintel's
 * Lý Tự Trọng since 23 September (the register's P1 frame). Áp Mái Bar – Thảo Điền changed hands to The Lintel on 1
 * October (the data sheet's second story), by the change Lê Đăng Quý recorded and the sweep applied at midnight.
 */
const RELATIONSHIPS: readonly SeedRelationship[] = [
  ...(
    [
      ["PRM-3NHZ6PKW", "Then Cửa Coffee & Tea – Nguyễn Huệ", "2026-09-01", null],
      ["PRM-8RTN5QZD", "Then Cửa Coffee & Tea – Lê Thánh Tôn", "2026-07-28", null],
      ["PRM-5PSR9VJA", "Then Cửa Coffee & Tea – Pasteur", "2026-09-16", null],
      ["PRM-7PXK4TDM", "Then Cửa Kitchen – Phan Xích Long", "2026-09-20", null],
      ["PRM-4DKX7WNP", "Then Cửa Bakery – Đa Kao", "2026-09-09", null],
      ["PRM-2HWT8MCY", "Then Cửa Bakery – Hai Bà Trưng", "2026-07-20", "IN_REVIEW"],
      ["PRM-6BVK3RQT", "Then Cửa Lounge & Karaoke – Bùi Viện", "2026-07-05", "IN_REVIEW"],
      ["PRM-9VB5HJ2E", "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ", "2026-08-03", "DRAFT"],
    ] as const
  ).map(([record, name, from, application]) => ({ party: THEN_CUA, premises: { record, name }, from, to: null, application })),
  { party: THEN_CUA_IMPORTED, premises: { record: "PRM-3NHZ6PKW", name: "Then Cửa Coffee & Tea – Nguyễn Huệ" }, from: null, to: "2025-12-31", application: null },
  { party: THEN_CUA_IMPORTED, premises: { record: "PRM-5PSR9VJA", name: "Then Cửa Coffee & Tea – Pasteur" }, from: null, to: "2025-12-31", application: null },
  {
    party: "PTY-131958",
    premises: { record: "PRM-7KD2WQ9M", name: "Áp Mái Bar – Thảo Điền" },
    from: "2022-03-02",
    to: "2026-09-30",
    application: null,
    endCause: "OPERATOR_CHANGE",
  },
  {
    party: LINTEL,
    premises: { record: "PRM-7KD2WQ9M", name: "Áp Mái Bar – Thảo Điền" },
    from: "2026-10-01",
    to: null,
    application: null,
    recorded: { by: "Lê Đăng Quý", at: at("2026-10-01", "00:00") },
  },
  { party: LINTEL, premises: { record: "PRM-9NTR4KBE", name: "The Lintel Coffee – Nguyễn Trãi" }, from: null, to: null, application: null },
  { party: LINTEL, premises: { record: "PRM-5JZT3HQV", name: "The Lintel Coffee – Lý Tự Trọng" }, from: "2026-09-23", to: null, application: null },
  { party: LINTEL, premises: { record: "PRM-2MX6PC8T", name: "The Lintel Coffee – Thảo Điền" }, from: null, to: null, application: null },
  { party: "PTY-142273", premises: { record: "PRM-4MSG8TDX", name: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng" }, from: "2019-03-14", to: null, application: null },
  { party: "PTY-135204", premises: { record: "PRM-3RT8XN4C", name: "Nhà hàng Chay Hạt Mè – Chi nhánh Khu đô thị Sala" }, from: null, to: null, application: null },
  { party: "PTY-146215", premises: { record: "PRM-6HNX2QWD", name: "Khách sạn Nắng Xiên" }, from: null, to: null, application: null },
];

/**
 * The party register's persons, as Record principal on SCR-PTY-02 lists them. Lục Bảo Ngân and Giang Thục Quyên hold
 * Then Cửa Việt's authorities and no board gives their person references; PPN-PTY-2219 and PPN-PTY-2207 are set here.
 * An account is named by the address RightOne ID signs it in with: Đỗ Thu Trang's, and Hầu Ngọc Ánh's, the delegate
 * who signs in to the premises portal for Nguyễn Huệ (the boards print her account as ACC-PTY-1101).
 */
const PERSONS: readonly SeedPerson[] = [
  { reference: "PPN-PTY-2201", name: TRANG, account: "trang.do@thencuaviet.vn", hasAccount: true, createdBy: null, createdAt: null },
  { reference: "PPN-PTY-2207", name: "Giang Thục Quyên", account: null, hasAccount: false, createdBy: null, createdAt: null },
  { reference: "PPN-PTY-2212", name: "Hầu Ngọc Ánh", account: "anh.hau@thencuaviet.vn", hasAccount: true, createdBy: null, createdAt: null },
  { reference: "PPN-PTY-2219", name: "Lục Bảo Ngân", account: null, hasAccount: false, createdBy: null, createdAt: null },
  { reference: "PPN-PTY-2486", name: "Giáp Thanh Tùng", account: null, hasAccount: false, createdBy: QUY, createdAt: "2026-09-30" },
  { reference: "PPN-PTY-2491", name: "Giáp Thanh Tùng", account: null, hasAccount: false, createdBy: LUONG, createdAt: at("2026-10-01", "10:02") },
];

/** Whose record each person is on: the party they act for, or were added for. */
const PERSON_PARTIES: Readonly<Record<string, readonly string[]>> = {
  "PPN-PTY-2201": [THEN_CUA],
  "PPN-PTY-2207": [THEN_CUA],
  "PPN-PTY-2212": [THEN_CUA],
  "PPN-PTY-2219": [THEN_CUA],
  "PPN-PTY-2486": [THEN_CUA],
  "PPN-PTY-2491": [THEN_CUA],
};

const READ_SUBMIT: readonly Act[] = ["READ", "SUBMIT"];

/**
 * Then Cửa Việt's four authorities, as SCR-PTY-11 and 13 draw them. Hầu Ngọc Ánh's at Nguyễn Huệ read only for its
 * first week and was amended on 22 September to read and submit; two acts were performed under it. The data sheet
 * gives no basis, evidence or grant time for the revoked one, and no evidence or grant time for the ended one.
 */
const AUTHORITIES: readonly SeedAuthority[] = [
  {
    reference: "AUT-3KQ8MW2T",
    party: THEN_CUA,
    person: "PPN-PTY-2212",
    premises: "Then Cửa Coffee & Tea – Nguyễn Huệ",
    basis: "BRANCH_MANAGER",
    evidence: "QĐ-TCV-2026-031",
    granted: { at: at("2026-09-15", "09:10"), by: TRANG },
    recorded: null,
    versions: [
      { from: at("2026-09-15", "00:00"), acts: ["READ"] },
      { from: at("2026-09-22", "00:00"), acts: READ_SUBMIT },
    ],
    to: "2027-09-14",
    revocation: null,
    performed: [
      { at: at("2026-09-22", "15:40"), kind: "UPLOADED_FLOOR_PLAN", subject: "REG-K7QM2XT4PB" },
      { at: at("2026-09-24", "16:20"), kind: "OPENED_DECISION", subject: "OBD-8KWT2PZH6M" },
    ],
  },
  {
    reference: "AUT-6NBX4RTZ",
    party: THEN_CUA,
    person: "PPN-PTY-2219",
    premises: "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ",
    basis: "DIRECTOR_LETTER",
    evidence: "GUQ-TCV-2026-012",
    granted: { at: at("2026-09-30", "17:05"), by: TRANG },
    recorded: null,
    versions: [{ from: at("2026-10-15", "00:00"), acts: READ_SUBMIT }],
    to: "2027-10-14",
    revocation: null,
    performed: [],
  },
  {
    reference: "AUT-2PWC7HDY",
    party: THEN_CUA,
    person: "PPN-PTY-2212",
    premises: "Then Cửa Coffee & Tea – Pasteur",
    basis: "PASTEUR_OPENING",
    evidence: null,
    granted: null,
    recorded: null,
    versions: [{ from: at("2026-09-16", "00:00"), acts: READ_SUBMIT }],
    to: "2026-09-30",
    revocation: null,
    performed: [],
  },
  {
    reference: "AUT-7RJ4KQ2N",
    party: THEN_CUA,
    person: "PPN-PTY-2207",
    premises: null,
    basis: null,
    evidence: null,
    granted: null,
    recorded: null,
    versions: [{ from: at("2026-09-01", "00:00"), acts: READ_SUBMIT }],
    to: "2027-08-31",
    revocation: {
      at: at("2026-09-28", "16:00"),
      by: TRANG,
      ground: "LEFT_THE_COMPANY",
      propagation: [
        { point: "PORTAL_SESSIONS", stoppedAt: "2026-09-28T16:00:04+07:00", afterSeconds: 4, exception: null },
        { point: "API_TOKENS", stoppedAt: "2026-09-28T16:00:39+07:00", afterSeconds: 39, exception: null },
        { point: "PLAYER", stoppedAt: null, afterSeconds: null, exception: { raisedAt: at("2026-09-28", "16:16"), acknowledgedBy: "Kiều Minh Triết", acknowledgedAt: at("2026-09-28", "16:40") } },
      ],
    },
    performed: [{ at: at("2026-09-24", "11:20"), kind: "UPLOADED_PHOTO", subject: "REG-W3HN6DRZ2Q" }],
  },
];

/**
 * The open reviews SCR-PTY-04 draws that this world holds: the duplicate candidacy of Then Cửa Việt's two records.
 * Hẻm 214's identification review opens when its declaration is made on SCR-PTY-03; the Mây Sông premises candidacy
 * is the premises register's and no board draws its records, so it is not here.
 */
const REVIEWS: readonly SeedReview[] = [{ id: "IDR-7KQ2MXT4WN", kind: "DUPLICATE_CANDIDACY", records: [THEN_CUA, THEN_CUA_IMPORTED], openedAt: at("2026-09-12", "00:00") }];

/** The search SCR-PTY-03 draws: by business registration number, no match, on 29 September at 14:52. */
const SEARCHES: readonly SeedSearch[] = [
  { party: HEM_214, identifierKind: "BUSINESS_REGISTRATION_NUMBER", identifier: "******0583", matched: false, at: at("2026-09-29", "14:52") },
];

/**
 * The records of the national business-registration source the register holds no party for: the two rights
 * organisations the catalogue names (the registration numbers are this world's; no board draws them). A party created
 * with one of these numbers is identified from the source; any other number finds no match, as Hẻm 214's did.
 */
const SOURCE: readonly SourceRecord[] = [
  { identifier: "******2107", legalName: "Hội Quyền tác giả Âm nhạc Lam Hồng", kind: "ORGANISATION" },
  { identifier: "******6630", legalName: "Trung tâm Quyền biểu diễn Hạc Bạch", kind: "ORGANISATION" },
];

/** The party register as every world starts it. */
export function partiesSeed(): PartiesSeed {
  return {
    source: SOURCE,
    parties: PARTIES,
    relationships: RELATIONSHIPS,
    persons: PERSONS,
    personParties: PERSON_PARTIES,
    authorities: AUTHORITIES,
    reviews: REVIEWS,
    searches: SEARCHES,
  };
}
