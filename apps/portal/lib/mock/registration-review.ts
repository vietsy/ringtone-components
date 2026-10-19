import type { LoadOutcome } from "@rightone/ui";
import type { ApplicationRecord, CaseText, DocumentItem, Period, PremisesOption, RightsLayer } from "@/lib/api/registration";
import type {
  Actor,
  CaseAttestation,
  CaseEvidence,
  CaseFact,
  CaseStatement,
  CaseTransition,
  ProposalStatus,
  ProposedOutcome,
  RequestState,
  ReviewType,
  Route,
  RuleCode,
} from "@/lib/api/registration-review";
import { AMNESTY } from "./public";

/*
 * The registration family's console and reporting data, from the premises canvas (SCR-REG-09 to 18) and its data
 * sheet. Today on those boards is Thursday 1 October 2026, 10:14 in Ho Chi Minh; what a person does in the portal
 * happens now (`backend/clock.ts`).
 *
 * The queue holds the board's eight applications in review: two of Then Cửa Việt's, already in the premises seed
 * (REG-D2VL7KQE3S, REG-W3HN6DRZ2Q), and six of other parties, which join the world here with their own premises
 * and parties. A part of a record the boards never draw (the facts of an application only listed in the queue) is
 * null, never made up.
 *
 * Two uses, as in `registration.ts`: the review states a reviewer forces with `?view=` (the failures the boards
 * draw), and `reviewSeed()`, which the backend starts every world from beside `registrationSeed()`.
 */

// ---------------------------------------------------------------- the contract's vocabularies

/** The review types, each the queue that reviews it (`REG-REVIEW-<type>`). */
export const REVIEW_TYPES = ["ASSERTION", "RULEBOOK_EXCEPTION", "AMENDMENT", "PRE_REGISTRATION"] as const;

/** The states of an application in review, the queue's State filter. */
export const REVIEW_STATES = ["SUBMITTED", "UNDER_REVIEW", "EVIDENCE_REQUIRED"] as const;

// ---------------------------------------------------------------- the review states each board drew

export const REG09_VIEWS = ["loading", "error", "cursor-invalid"] as const;
export const REG10_VIEWS = ["loading", "error", "not-found"] as const;
export const REG11_VIEWS = ["loading", "error", "not-found"] as const;
export const REG12_VIEWS = ["loading", "error", "not-found"] as const;
export const REG13_VIEWS = ["loading", "error", "not-found"] as const;
export const REG14_VIEWS = ["loading", "error"] as const;
export const REG15_VIEWS = ["loading", "error", "not-found"] as const;
export const REG16_VIEWS = ["loading", "error"] as const;
export const REG17_VIEWS = ["loading", "error", "unavailable"] as const;
export const REG18_VIEWS = ["loading", "error"] as const;

export type ReviewScreen = "09" | "10" | "11" | "12" | "13" | "14" | "15" | "16" | "17" | "18";
export type ReviewFailure = "error" | "cursor-invalid" | "not-found" | "unavailable";
/** A failure a board draws, on the screen it draws it: the trace the board prints goes with it. */
export interface ReviewView {
  screen: ReviewScreen;
  state: ReviewFailure;
}

/** The trace identifier each board's error state prints. */
const TRACES: Readonly<Record<ReviewScreen, string>> = {
  "09": "8d27f4c1a9e3b605",
  "10": "b64e0d3f7a1c9258",
  "11": "7d2b4e91c05a8f36",
  "12": "3a8f0c6e2d91b754",
  "13": "e41b7c09d5a2f683",
  "14": "92c5d18a4fe07b3d",
  "15": "c83a1f5e70b9d246",
  "16": "8e3d61b0a5c7f924",
  "17": "6a0c5e93f7b2d148",
  "18": "d47a1e8c30b6f925",
};

/** The view a page asks for, as the failure its board draws; loading is the page's own and never reaches here. */
export function reviewViewOf(screen: ReviewScreen, asked: string | null): ReviewView | null {
  return asked === "error" || asked === "cursor-invalid" || asked === "not-found" || asked === "unavailable" ? { screen, state: asked } : null;
}

export function mockReviewFailure(view: ReviewView): LoadOutcome<never> {
  switch (view.state) {
    case "error":
      return { data: null, failure: { code: "INTERNAL_ERROR", traceId: TRACES[view.screen], retryable: true } };
    case "cursor-invalid":
      return { data: null, failure: { code: "CURSOR_INVALID", traceId: null, retryable: false } };
    case "not-found":
      return { data: null, failure: { code: "APPLICATION_NOT_FOUND", traceId: null, retryable: false } };
    case "unavailable":
      return { data: null, failure: { code: "POLICY_READ_UNAVAILABLE", traceId: null, retryable: true } };
  }
}

// ---------------------------------------------------------------- the world beyond Then Cửa Việt

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;
const MB = 1_000_000;
const KB = 1_000;

/** A premises of the world, with the party PTY records as operating it. */
export interface WorldPremises extends PremisesOption {
  party: string;
}

/** A party as the console names it: its name where a canvas gives one, the business registration masked, the register's version. */
export interface WorldParty {
  name: string | null;
  businessRegistration: string | null;
  /** The register's answer the latest application read: the moment and the version. */
  registerVersion: number | null;
}

/** The parties of the board's queue. Then Cửa Việt's register answered version 8 once its class was reconciled on 1 October. */
export const PARTIES: Readonly<Record<string, WorldParty>> = {
  tcv: { name: "Công ty TNHH Then Cửa Việt", businessRegistration: "******6041", registerVersion: 8 },
  "ap-mai": { name: null, businessRegistration: null, registerVersion: null },
  "may-song": { name: null, businessRegistration: "******8150", registerVersion: 5 },
  "nang-xien": { name: null, businessRegistration: "******3307", registerVersion: 3 },
  lintel: { name: null, businessRegistration: null, registerVersion: null },
  "hat-me": { name: null, businessRegistration: null, registerVersion: null },
  qnh: { name: "Hộ kinh doanh Quán Nướng Hẻm 214", businessRegistration: null, registerVersion: null },
};

/** The premises of the other parties in the queue, by the name the queue gives them. */
const OTHERS: readonly WorldPremises[] = [
  { id: "ap-mai-bar", name: "Áp Mái Bar", party: "ap-mai" },
  { id: "may-song-tdt", name: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng", party: "may-song" },
  { id: "nang-xien", name: "Khách sạn Nắng Xiên", party: "nang-xien" },
  { id: "lintel-ly-tu-trong", name: "The Lintel Coffee – Lý Tự Trọng", party: "lintel" },
  { id: "hat-me-sala", name: "Nhà hàng Chay Hạt Mè – Chi nhánh Khu đô thị Sala", party: "hat-me" },
  { id: "hem-214", name: "Quán Nướng Hẻm 214", party: "qnh" },
];

const otherPremises = (id: string): PremisesOption => {
  const found = OTHERS.find((premises) => premises.id === id);
  if (found === undefined) throw new Error(`${id} is not a premises of the queue`);
  return { id: found.id, name: found.name };
};

// ---------------------------------------------------------------- people as the boards name them

const TRANG: Actor = { name: "Đỗ Thu Trang", role: "PRINCIPAL", party: "Công ty TNHH Then Cửa Việt" };
/** A principal of another party, whom the boards name by the role alone. */
const PRINCIPAL: Actor = { name: null, role: "PRINCIPAL", party: null };
const RIGHTONE: Actor = { name: null, role: "SYSTEM", party: null };
const LUONG: Actor = { name: "Phan Gia Lượng", role: "OFFICER", party: null };

/** The members of staff a seeded record names, as the accounts hold them. */
export const STAFF_OF_RECORD = {
  luong: { name: "Phan Gia Lượng", email: "phan.gialuong@rightone.example", position: "Cán bộ vận hành" },
  tram: { name: "Quan Ngọc Trâm", email: "quan.ngoctram@rightone.example", position: "Cán bộ vận hành" },
} as const;

// ---------------------------------------------------------------- the record's parts

type Fact = CaseFact;

const fact = (code: Fact["code"], value: string | number, label: Fact["label"], more: Partial<Fact> = {}): Fact => ({
  code,
  value,
  version: 1,
  label,
  cls: label === "registry-sourced" ? "authoritative" : label === "derived" ? "derived" : "declared",
  current: true,
  correction: null,
  replaced: null,
  document: null,
  copiedFrom: null,
  source: null,
  ...more,
});

/** A value the register answered, at the moment and version the board gives. */
const registry = (code: Fact["code"], value: string, answered: string, version: number) =>
  fact(code, value, "registry-sourced", { source: { at: answered, version } });

/** The use-start date declared with its proof. */
const began = (on: string) => fact("use_began_on", on, "evidenced", { document: { document: "USE_START_PROOF" } });

const evidence = (
  key: string,
  title: CaseEvidence["title"],
  answers: CaseEvidence["answers"],
  receivedAt: string,
  mediaType: string,
  sizeBytes: number,
  digest: string,
): CaseEvidence => ({ key, title, answers, receivedAt, receivedOn: receivedAt.slice(0, 10), file: { mediaType, sizeBytes }, digest });

const PDF = "application/pdf";
const JPEG = "image/jpeg";

const attestation = (when: string, by: Actor): CaseAttestation => ({ version: 1, at: when, by, explanation: 3, rulebook: "2026.2", superseded: false });

const stated = (
  when: string | null,
  completeOn: string | null,
  expectedOn: string | null,
  reviewType: ReviewType | null,
  deadline: string,
  more: Partial<CaseStatement> = {},
): CaseStatement => ({ statedAt: when, completeOn, expectedOn, reviewType, periodDays: 21, deadline, toldAt: null, restatedOnAnswer: false, ...more });

const move = (when: string | null, from: CaseTransition["from"], to: CaseTransition["to"], cause: string, by: Actor): CaseTransition => ({ at: when, from, to, cause, by });

/** The three moves of an application sent and routed to review, the newest first. */
const sentToReview = (started: string | null, sent: string | null, by: Actor): CaseTransition[] => [
  move(sent, "SUBMITTED", "UNDER_REVIEW", "ROUTING", RIGHTONE),
  move(sent, "DRAFT", "SUBMITTED", "SUBMISSION", by),
  move(started, null, "DRAFT", "START", by),
];

// ---------------------------------------------------------------- the console's part of each application

/** A reviewer's request as the console reads it: who asked and when, and each item by its code. */
export interface SeedRequest {
  askedBy: "REVIEWER" | "RIGHTONE";
  by: Actor;
  askedAt: string | null;
  askedOn: string;
  dueOn: string;
  state: RequestState;
  items: readonly { code: string; document: DocumentItem | null; description: string | null; receivedOn: string | null }[];
}

export interface SeedProposal {
  id: string;
  outcome: ProposedOutcome;
  status: ProposalStatus;
  reason: string | null;
  text: string | null;
  unmet: readonly string[];
  actionOpen: string | null;
  preparedBy: { name: string; email: string; position: string };
  preparedAt: string;
}

/** What the console reads of an application beyond what the premises reads: SCR-REG-10's panels. */
export interface SeedReview {
  reviewType: ReviewType | null;
  route: Route | null;
  rulebook: string;
  period: Period | null;
  facts: readonly Fact[] | null;
  evidence: readonly CaseEvidence[] | null;
  attestations: readonly CaseAttestation[] | null;
  /** Null where the console's request is the premises' own, read from its record. */
  requests: readonly SeedRequest[] | null;
  statements: readonly CaseStatement[];
  transitions: readonly CaseTransition[];
  proposals: readonly SeedProposal[];
  /** When each claim of the record was raised, in the record's order. */
  claimsRaisedAt: readonly (string | null)[];
}

const review = (more: Partial<SeedReview> & Pick<SeedReview, "reviewType" | "route">): SeedReview => ({
  rulebook: "2026.2",
  period: null,
  facts: null,
  evidence: null,
  attestations: null,
  requests: null,
  statements: [],
  transitions: [],
  proposals: [],
  claimsRaisedAt: [],
  ...more,
});

/**
 * The case files the boards draw for Then Cửa Việt's applications already in the premises seed: the Bùi Viện
 * lounge in rulebook review with its customer area corrected, Hai Bà Trưng waiting for documents, Pasteur decided
 * at once on the automated route.
 */
const THEN_CUA_REVIEWS: Readonly<Record<string, SeedReview>> = {
  "REG-D2VL7KQE3S": review({
    reviewType: "RULEBOOK_EXCEPTION",
    route: "MANUAL",
    period: { from: "2026-09-15", to: "2027-09-14" },
    facts: [
      registry("business_registration", "******6041", at("2026-09-15", "08:36"), 7),
      fact("customer_area", 85, "corrected", {
        version: 2,
        correction: { corrects: 1, by: "Phan Gia Lượng", on: "2026-09-28", document: { drawn: "PHOTOS" } },
      }),
      fact("customer_area", 120, "declared", { current: false, replaced: { by: 2, on: "2026-09-28" } }),
      fact("days_open", 6, "declared"),
      began("2026-07-05"),
      fact("premises_class", "bar", "declared"),
    ],
    evidence: [
      evidence("use-start", { document: "USE_START_PROOF" }, { requirement: "USE-START" }, at("2026-09-15", "08:33"), PDF, 1.2 * MB, "a41f"),
      evidence("photos", { drawn: "PHOTOS" }, { requirement: "PREMISES-PHOTOS" }, at("2026-09-15", "08:35"), JPEG, 4.8 * MB, "0c7d"),
    ],
    attestations: [attestation(at("2026-09-15", "08:38"), TRANG)],
    statements: [
      stated(at("2026-09-15", "08:41"), "2026-09-15", "2026-10-06", "RULEBOOK_EXCEPTION", "2026-10-02", { toldAt: at("2026-09-15", "08:41") }),
    ],
    transitions: sentToReview(at("2026-09-15", "08:21"), at("2026-09-15", "08:40"), TRANG),
  }),
  "REG-W3HN6DRZ2Q": review({
    reviewType: "ASSERTION",
    route: "MANUAL",
    period: { from: "2026-09-21", to: "2027-09-20" },
    facts: [
      registry("business_registration", "******6041", at("2026-09-21", "09:50"), 7),
      registry("premises_class", "bakery", at("2026-09-21", "09:50"), 7),
      fact("customer_area", 42, "declared"),
      fact("days_open", 7, "declared"),
      began("2026-07-20"),
    ],
    evidence: [
      evidence("use-start", { document: "USE_START_PROOF" }, { requirement: "USE-START" }, at("2026-09-21", "09:55"), PDF, 880 * KB, "3e9b"),
      evidence("equipment", { document: "EQUIPMENT_PHOTO" }, { requestItem: 2 }, at("2026-09-24", "17:42"), JPEG, 3.1 * MB, "d150"),
    ],
    attestations: [attestation(at("2026-09-21", "09:58"), TRANG)],
    requests: [
      {
        askedBy: "REVIEWER",
        by: LUONG,
        askedAt: at("2026-09-25", "14:20"),
        askedOn: "2026-09-25",
        dueOn: "2026-10-09",
        state: "OPEN",
        items: [
          { code: "SUPPLIER-INVOICE", document: "MUSIC_INVOICE_Q3", description: null, receivedOn: null },
          { code: "EQUIPMENT-PHOTO", document: "EQUIPMENT_PHOTO", description: null, receivedOn: "2026-09-24" },
        ],
      },
    ],
    statements: [stated(at("2026-09-21", "10:05"), "2026-09-21", "2026-10-12", "ASSERTION", "2026-10-17", { restatedOnAnswer: true })],
    transitions: [
      move(at("2026-09-25", "14:20"), "UNDER_REVIEW", "EVIDENCE_REQUIRED", "EVIDENCE_REQUEST", LUONG),
      ...sentToReview(at("2026-09-21", "09:51"), at("2026-09-21", "10:05"), TRANG),
    ],
    claimsRaisedAt: [at("2026-09-21", "09:54")],
  }),
  "REG-Y6TN4JHA8D": review({
    reviewType: null,
    route: "AUTOMATED",
    period: { from: "2026-09-18", to: "2027-09-17" },
    facts: [
      registry("business_registration", "******6041", at("2026-09-18", "11:10"), 7),
      fact("premises_class", "cafe", "declared"),
      fact("customer_area", 38, "declared"),
      fact("days_open", 7, "declared"),
      began("2026-09-16"),
    ],
    evidence: [
      evidence("use-start", { document: "USE_START_PROOF" }, { requirement: "USE-START" }, at("2026-09-18", "11:20"), PDF, 520 * KB, "b7c4"),
      evidence("tenure", { document: "LEASE" }, { requirement: "TENURE" }, at("2026-09-18", "11:24"), PDF, 2.4 * MB, "20fa"),
    ],
    attestations: [attestation(at("2026-09-18", "11:29"), TRANG)],
    transitions: [
      move(at("2026-09-18", "11:32"), "SUBMITTED", "DECIDED", "AUTOMATED_DECISION", RIGHTONE),
      move(at("2026-09-18", "11:32"), "DRAFT", "SUBMITTED", "SUBMISSION", TRANG),
      move(at("2026-09-18", "11:08"), null, "DRAFT", "START", TRANG),
    ],
  }),
};

/** The Sala draft's single move so far: started on 29 September. */
const SALA_REVIEW = review({
  reviewType: null,
  route: null,
  transitions: [move(at("2026-09-29", "16:42"), null, "DRAFT", "START", TRANG)],
});

// ---------------------------------------------------------------- the other parties' applications

/** A record of the queue's: the premises reads none of it, so only the parts the console reads are filled in. */
function queued(
  reference: string,
  premises: string,
  status: ApplicationRecord["status"],
  more: Partial<ApplicationRecord> = {},
): ApplicationRecord {
  return {
    reference,
    premises: otherPremises(premises).name,
    kind: "NEW",
    status,
    savedAt: null,
    sentAt: null,
    review: null,
    evidenceRequest: null,
    dates: null,
    claims: [],
    history: [],
    decision: null,
    ended: null,
    canWithdraw: true,
    withdrawRefusal: null,
    ...more,
  };
}

/** The statement's deadline and use-start, as the premises' record holds them. */
const dated = (completeOn: string | null, expectedOn: string | null, deadline: string, useBeganOn: string): ApplicationRecord["dates"] => ({
  completeOn,
  decisionExpectedBy: expectedOn,
  reset: false,
  paymentDeadline: deadline,
  useBeganOn,
  toldOn: null,
  passedWhenComplete: false,
});

const NANG_XIEN_CLAIM_PERIOD: Period = { from: "2026-09-22", to: "2027-09-21" };

/** One of the other parties' applications, with the console's part beside it. */
export interface OtherApplication {
  premisesId: string;
  record: ApplicationRecord;
  review: SeedReview;
  /** The decision a change amends, by reference: the record is another party's, which this world does not hold. */
  prior: string | null;
}

/**
 * Six applications of other parties, in the queue's order. The use-start date the statement counts from is
 * 89 days before each payment deadline (DR-23); where a board draws no case file, the record holds the queue's
 * columns and no more.
 */
const OTHER_APPLICATIONS: readonly OtherApplication[] = [
  {
    premisesId: "ap-mai-bar",
    record: queued("REG-Z2HY5MTE7K", "ap-mai-bar", "UNDER_REVIEW", { review: "RULEBOOK", dates: dated("2026-09-08", "2026-09-29", "2026-10-20", "2026-07-23") }),
    review: review({
      reviewType: "RULEBOOK_EXCEPTION",
      route: "MANUAL",
      statements: [stated(null, "2026-09-08", "2026-09-29", "RULEBOOK_EXCEPTION", "2026-10-20")],
      transitions: sentToReview(null, null, PRINCIPAL),
    }),
    prior: null,
  },
  {
    premisesId: "may-song-tdt",
    record: queued("REG-M6FA3YWN5T", "may-song-tdt", "UNDER_REVIEW", {
      kind: "AMENDMENT",
      review: "RULEBOOK",
      sentAt: at("2026-09-10", "11:15"),
      dates: dated("2026-09-10", "2026-10-01", "2026-11-01", "2026-08-04"),
    }),
    review: review({
      reviewType: "AMENDMENT",
      route: "MANUAL",
      facts: [
        registry("business_registration", "******8150", at("2026-09-10", "11:02"), 5),
        registry("premises_class", "hotel", at("2026-09-10", "11:02"), 5),
        fact("customer_area", 310, "declared"),
        fact("days_open", 7, "declared"),
        fact("use_began_on", "2026-08-04", "declared", { copiedFrom: "REG-L8VC3TPA6M" }),
      ],
      evidence: [evidence("floor-plan", { drawn: "FLOOR_PLAN" }, { requirement: "FLOOR-PLAN" }, at("2026-09-10", "11:09"), PDF, 1.6 * MB, "e6a3")],
      attestations: [attestation(at("2026-09-10", "11:12"), PRINCIPAL)],
      statements: [stated(at("2026-09-10", "11:15"), "2026-09-10", "2026-10-01", "AMENDMENT", "2026-11-01")],
      transitions: sentToReview(at("2026-09-09", "16:40"), at("2026-09-10", "11:15"), PRINCIPAL),
      proposals: [
        {
          id: "c4a7e2d1-5b38-4f9e-8a61-2d0f7b93e6c5",
          outcome: "REFUSED",
          status: "PENDING_APPROVAL",
          reason: "CHANGE_NOT_EVIDENCED",
          text: "Đề nghị thay đổi diện tích phục vụ bị từ chối.",
          unmet: ["Không có sơ đồ mặt bằng nào thể hiện diện tích phục vụ mới."],
          actionOpen: "Gửi đơn điều chỉnh mới kèm sơ đồ mặt bằng của cơ sở.",
          preparedBy: STAFF_OF_RECORD.tram,
          preparedAt: at("2026-09-28", "11:02"),
        },
      ],
    }),
    prior: "OBD-6WSN2LQB8H",
  },
  {
    premisesId: "nang-xien",
    record: queued("REG-C5TR8HWM2N", "nang-xien", "UNDER_REVIEW", {
      review: "CLAIM",
      sentAt: at("2026-09-22", "15:20"),
      dates: dated("2026-09-22", "2026-10-13", "2026-11-30", "2026-09-02"),
      claims: [{ kind: "NON_USE", layer: "PRODUCERS", period: NANG_XIEN_CLAIM_PERIOD, state: "UNDER_REVIEW" }],
    }),
    review: review({
      reviewType: "ASSERTION",
      route: "MANUAL",
      period: NANG_XIEN_CLAIM_PERIOD,
      facts: [
        registry("business_registration", "******3307", at("2026-09-22", "14:56"), 3),
        registry("premises_class", "hotel", at("2026-09-22", "14:56"), 3),
        fact("customer_area", 260, "declared"),
        fact("days_open", 7, "declared"),
        began("2026-09-02"),
      ],
      evidence: [
        evidence("use-start", { document: "USE_START_PROOF" }, { requirement: "USE-START" }, at("2026-09-22", "15:08"), PDF, 640 * KB, "5d21"),
        evidence("pianist", { drawn: "PIANIST" }, { claim: "NON_USE" }, at("2026-09-22", "15:12"), PDF, 2.1 * MB, "9c2e"),
        evidence("schedule", { drawn: "SCHEDULE" }, { claim: "NON_USE" }, at("2026-09-22", "15:13"), PDF, 310 * KB, "71b0"),
      ],
      attestations: [attestation(at("2026-09-22", "15:18"), PRINCIPAL)],
      statements: [stated(at("2026-09-22", "15:20"), "2026-09-22", "2026-10-13", "ASSERTION", "2026-11-30")],
      transitions: sentToReview(at("2026-09-22", "14:58"), at("2026-09-22", "15:20"), PRINCIPAL),
      claimsRaisedAt: [at("2026-09-22", "15:16")],
    }),
    prior: null,
  },
  {
    premisesId: "lintel-ly-tu-trong",
    record: queued("REG-J9PE3XKA4V", "lintel-ly-tu-trong", "UNDER_REVIEW", { review: "RULEBOOK", dates: dated("2026-09-25", "2026-10-16", "2026-11-12", "2026-08-15") }),
    review: review({
      reviewType: "PRE_REGISTRATION",
      route: "MANUAL",
      statements: [stated(null, "2026-09-25", "2026-10-16", "PRE_REGISTRATION", "2026-11-12")],
      transitions: sentToReview(null, null, PRINCIPAL),
    }),
    prior: null,
  },
  {
    premisesId: "hat-me-sala",
    record: queued("REG-V4QS6LDC9T", "hat-me-sala", "SUBMITTED", { review: "CLAIM", dates: dated("2026-09-30", "2026-10-21", "2027-01-08", "2026-10-11") }),
    review: review({
      reviewType: "ASSERTION",
      route: "MANUAL",
      statements: [stated(null, "2026-09-30", "2026-10-21", "ASSERTION", "2027-01-08")],
      transitions: [move(null, "DRAFT", "SUBMITTED", "SUBMISSION", PRINCIPAL), move(null, null, "DRAFT", "START", PRINCIPAL)],
    }),
    prior: null,
  },
  {
    premisesId: "hem-214",
    record: queued("REG-F7GU2NBY8R", "hem-214", "EVIDENCE_REQUIRED", {
      review: "NONE",
      dates: { completeOn: null, decisionExpectedBy: null, reset: false, paymentDeadline: "2026-12-05", useBeganOn: "2026-09-07", toldOn: null, passedWhenComplete: false },
    }),
    review: review({
      reviewType: null,
      route: "AUTOMATED",
      statements: [stated(null, null, null, null, "2026-12-05")],
      transitions: [move(null, "SUBMITTED", "EVIDENCE_REQUIRED", "EVIDENCE_REQUEST", RIGHTONE), move(null, "DRAFT", "SUBMITTED", "SUBMISSION", PRINCIPAL), move(null, null, "DRAFT", "START", PRINCIPAL)],
    }),
    prior: null,
  },
];

// ---------------------------------------------------------------- what TAR answers

/**
 * The fee TAR works out for an application's facts as the case file holds them, by layer. Sala's is the canvas's
 * (SCR-REG-05). The Bùi Viện lounge's are the two totals SCR-REG-13 draws, as applied for and decided as karaoke
 * with private rooms; split by layer in the share every canvas decision shows (performers and producers 1 part
 * each, authors the rest), rounded to the thousand dong.
 */
export interface SeedTariff {
  application: string;
  /** The facts the fee answers, by code; any other value (a correction) is a question TAR has not answered. */
  facts: Readonly<Record<string, string | number>>;
  outcome: "DECIDED_AS_APPLIED" | "DECIDED_OTHERWISE";
  lines: readonly { layer: RightsLayer; amountMinor: number }[];
  currency: string;
  tariffVersion: string;
}

const lines = (authors: number, performers: number, producers: number) => [
  { layer: "AUTHORS" as const, amountMinor: authors },
  { layer: "PERFORMERS" as const, amountMinor: performers },
  { layer: "PRODUCERS" as const, amountMinor: producers },
];

const SALA_FACTS = { premises_class: "cafe", customer_area: 64, days_open: 7, music_method: "speakers", use_began_on: "2026-08-03" };
const LOUNGE_FACTS = { premises_class: "bar", customer_area: 85, days_open: 6, use_began_on: "2026-07-05" };

const TARIFFS: readonly SeedTariff[] = [
  { application: "REG-P5TJ4BXC7M", facts: SALA_FACTS, outcome: "DECIDED_AS_APPLIED", lines: lines(742000, 322000, 322000), currency: "VND", tariffVersion: "2026.1" },
  { application: "REG-P5TJ4BXC7M", facts: SALA_FACTS, outcome: "DECIDED_OTHERWISE", lines: lines(742000, 322000, 322000), currency: "VND", tariffVersion: "2026.1" },
  { application: "REG-D2VL7KQE3S", facts: LOUNGE_FACTS, outcome: "DECIDED_AS_APPLIED", lines: lines(828000, 360000, 360000), currency: "VND", tariffVersion: "2026.1" },
  { application: "REG-D2VL7KQE3S", facts: LOUNGE_FACTS, outcome: "DECIDED_OTHERWISE", lines: lines(1158000, 503000, 503000), currency: "VND", tariffVersion: "2026.1" },
];

// ---------------------------------------------------------------- SCR-REG-16, 17 and 18

/** A registration over the baseline, as the report lists it. */
export interface SeedOverRow {
  reference: string;
  premises: string;
  seconds: number;
  excludedSeconds: number | null;
  step: "CONFIRMATION_RECORD" | "FACTS" | "EVIDENCE" | "EVIDENCE_WAIT";
}

/**
 * One calendar month's reports, as the board reads them for September 2026. While CER's record event is not
 * consumed (CR-REG-02, the P1 state), no ordinary registration is measured: every one decided is counted as not
 * yet measured, and the interim reading to the decision stands in its own panel.
 */
export interface SeedReportMonth {
  month: string;
  ordinaryDecided: number;
  declaredFallback: number;
  interim: { medianSeconds: number; p90Seconds: number; over: number; rows: readonly SeedOverRow[] };
  outcomes: { decided: number; refused: number; withdrawn: number; closed: number; withdrawnWithAdverse: number };
}

const REPORTS: readonly SeedReportMonth[] = [
  {
    month: "2026-09",
    ordinaryDecided: 449,
    declaredFallback: 5,
    interim: {
      medianSeconds: 425,
      p90Seconds: 574,
      over: 3,
      rows: [
        { reference: "REG-H4ZC2GPU7R", premises: "Then Cửa Coffee & Tea – Lê Thánh Tôn", seconds: 687, excludedSeconds: null, step: "EVIDENCE_WAIT" },
        { reference: "REG-G2LM9VCE6Q", premises: "Then Cửa Kitchen – Phan Xích Long", seconds: 641, excludedSeconds: null, step: "EVIDENCE" },
        { reference: "REG-B7NS2KWR5J", premises: "The Lintel Coffee – Lý Tự Trọng", seconds: 612, excludedSeconds: null, step: "FACTS" },
      ],
    },
    outcomes: { decided: 468, refused: 3, withdrawn: 17, closed: 6, withdrawnWithAdverse: 1 },
  },
];

/** A version of a registration rule, as GOV approved it. */
export interface SeedRuleVersion {
  rule: RuleCode;
  id: string;
  from: string;
  /** `REG-AMNESTY-PERIOD`: the amnesty's first and last day, both inclusive, and when the version was approved. */
  amnesty?: { period: Period; approvedAt: string };
}

/**
 * The versions SCR-REG-17 draws: five rules in force from 1 September 2026, the next rulebook from 1 November; and
 * the amnesty period approved on 25 September 2026, AMV-2026-1, which the public pages publish (`public.ts`), in
 * force from its first day. No `REG-PRE-REGISTRATION` version is approved (`CFG-12`).
 */
const POLICY: readonly SeedRuleVersion[] = [
  { rule: "REG-OBLIGATION-RULEBOOK", id: "2026.2", from: "2026-09-01" },
  { rule: "REG-OBLIGATION-RULEBOOK", id: "2026.3", from: "2026-11-01" },
  { rule: "REG-EXPLANATION", id: "3", from: "2026-09-01" },
  { rule: "REG-REVIEW-PERIODS", id: "1", from: "2026-09-01" },
  { rule: "REG-EVIDENCE-RESPONSE", id: "1", from: "2026-09-01" },
  { rule: "REG-DECISION-RESERVATION", id: "1", from: "2026-09-01" },
  { rule: "REG-AMNESTY-PERIOD", id: AMNESTY.version, from: AMNESTY.period.from, amnesty: { period: { ...AMNESTY.period }, approvedAt: AMNESTY.approvedAt } },
];

/** A recorded use-start date: the premises, the date, the application that gave it and when its decision recorded it. */
export interface SeedUseStart {
  premisesId: string;
  date: string;
  source: string;
  recordedOn: string;
}

/**
 * The dates the decisions of the world recorded, oldest first: Lê Thánh Tôn's corrected on 28 September (the board),
 * and each other decision's that names its application and its use-start date.
 */
const USE_STARTS: readonly SeedUseStart[] = [
  { premisesId: "may-song-tdt", date: "2026-08-04", source: "REG-L8VC3TPA6M", recordedOn: "2026-08-19" },
  { premisesId: "ltt", date: "2026-08-14", source: "REG-H4ZC2GPU7R", recordedOn: "2026-09-02" },
  { premisesId: "pasteur", date: "2026-09-16", source: "REG-Y6TN4JHA8D", recordedOn: "2026-09-18" },
  { premisesId: "nh", date: "2026-09-01", source: "REG-K7QM2XT4PB", recordedOn: "2026-09-24" },
  { premisesId: "ltt", date: "2026-07-28", source: "REG-R8BX5KDN3W", recordedOn: "2026-09-28" },
];

// ---------------------------------------------------------------- the reasons an officer chooses from

/**
 * The review triggers of rulebook 2026.2 and the reasons for a claim outcome the boards offer, with their names: a
 * reason is stored by its code, and the statement the applicant reads names it in their language.
 */
export const REASON_NAMES: Readonly<Record<string, CaseText>> = {
  CLASSIFICATION_CHANGED: { vi: "Thay đổi phân loại", en: "Classification changed" },
  AREA_DIFFERS_FROM_PLAN: { vi: "Diện tích phục vụ khác với sơ đồ mặt bằng", en: "Customer area differs from the floor plan" },
  USE_START_NOT_SHOWN: { vi: "Giấy tờ không cho thấy ngày bắt đầu sử dụng", en: "Use start not shown by the evidence" },
  CHANGE_NOT_EVIDENCED: { vi: "Thay đổi chưa có giấy tờ chứng minh", en: "Change not evidenced" },
  EVIDENCE_WHOLE_PERIOD: { vi: "Giấy tờ chứng minh cho cả thời gian của yêu cầu", en: "Evidence covers the whole period" },
  EVIDENCE_PART_PERIOD: { vi: "Giấy tờ chứng minh cho một phần thời gian", en: "Evidence covers part of the period" },
  EVIDENCE_NOT_SHOWN: { vi: "Giấy tờ không chứng minh được việc không sử dụng", en: "Evidence does not show non-use" },
  NO_EVIDENCE: { vi: "Chưa nhận được giấy tờ", en: "No evidence received" },
};

/** The reasons each act offers, in the boards' order. */
export const PROPOSAL_REASONS = ["CLASSIFICATION_CHANGED", "AREA_DIFFERS_FROM_PLAN", "USE_START_NOT_SHOWN"] as const;
export const CLAIM_REASONS = ["EVIDENCE_WHOLE_PERIOD", "EVIDENCE_PART_PERIOD", "EVIDENCE_NOT_SHOWN", "NO_EVIDENCE"] as const;

// ---------------------------------------------------------------- the seed

export interface ReviewSeed {
  premises: readonly WorldPremises[];
  parties: Readonly<Record<string, WorldParty>>;
  /** The console's part of each Then Cửa Việt application, by reference; one the boards do not draw has none. */
  thenCua: Readonly<Record<string, SeedReview>>;
  others: readonly OtherApplication[];
  tariffs: readonly SeedTariff[];
  reports: readonly SeedReportMonth[];
  policy: readonly SeedRuleVersion[];
  useStarts: readonly SeedUseStart[];
}

/** The console's starting state, beside the premises seed. */
export function reviewSeed(): ReviewSeed {
  return {
    premises: OTHERS,
    parties: PARTIES,
    thenCua: { ...THEN_CUA_REVIEWS, "REG-P5TJ4BXC7M": SALA_REVIEW },
    others: OTHER_APPLICATIONS,
    tariffs: TARIFFS,
    reports: REPORTS,
    policy: POLICY,
    useStarts: USE_STARTS,
  };
}
