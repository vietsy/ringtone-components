import type { LoadOutcome } from "@rightone/ui";
import type {
  AboutPage,
  AboutPageAnswer,
  AdminArea,
  AssumedPremises,
  ClassificationPath,
  DeclaredPremises,
  ExemptionTested,
  HelpRoute,
  IndicativeAmountPage,
  ParticipatingOrganisation,
  PremisesClass,
  RightsKind,
  ScopeAssessmentPage,
  ScopeQuestions,
} from "@/lib/api/public";
import type { VerificationOutcome } from "@/lib/api/verification";

/** The view states SCR-PUB-01 was drawn in on the design canvas. */
export const PUB01_VIEWS = ["p1", "populated", "superseded", "empty", "instant-invalid", "loading", "error"] as const;
export type Pub01View = (typeof PUB01_VIEWS)[number];

/** The view states SCR-PUB-02 was drawn in. */
export const PUB02_VIEWS = ["p1-not-offered", "form", "checking", "in-scope", "input-invalid", "no-rules-for-date", "loading"] as const;
export type Pub02View = (typeof PUB02_VIEWS)[number];

/** The view states SCR-PUB-03 was drawn in. */
export const PUB03_VIEWS = [
  "not-offered",
  "guidance-not-offered",
  "form",
  "indicated",
  "no-amount",
  "no-tariff-for-date",
  "tariff-unavailable",
  "loading",
] as const;
export type Pub03View = (typeof PUB03_VIEWS)[number];

/** The view states SCR-PUB-04 was drawn in. */
export const PUB04_VIEWS = ["form", "checking", "unable", "absent", "identifier-not-accepted", "rate-limited", "enumeration", "error"] as const;
export type Pub04View = (typeof PUB04_VIEWS)[number];

/** The view states SCR-PUB-05 was drawn in. */
export const PUB05_VIEWS = [
  "unable",
  "absent",
  "record",
  "record-suspended",
  "checking",
  "identifier-not-accepted",
  "rate-limited",
  "enumeration",
  "error",
] as const;
export type Pub05View = (typeof PUB05_VIEWS)[number];

/** The views of a verification the register answers, as opposed to the page asking it. */
export type VerificationView = Exclude<Pub05View, "checking">;

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({
  data: null,
  failure: { code, traceId, retryable },
});

// ---------------------------------------------------------------- help routes

/** The help route register as the canvas reads it: the support line and the authoritative contact. */
export const HELP_ROUTES: readonly HelpRoute[] = [
  { kind: "support_line", value: "1900 2468 13", confirmedOn: "2026-09-12" },
  { kind: "contact_email", value: "lienhe@rightone.vn", confirmedOn: "2026-09-01" },
];

// ---------------------------------------------------------------- SCR-PUB-01

const ORGANISATIONS: readonly ParticipatingOrganisation[] = [
  { key: "lh", name: "Hội Quyền tác giả Âm nhạc Lam Hồng", shortName: "Lam Hồng", rights: "works" },
  { key: "tx", name: "Hiệp hội Nhà sản xuất Bản ghi Trường Xuân", shortName: "Trường Xuân", rights: "producers" },
  { key: "hb", name: "Trung tâm Quyền biểu diễn Hạc Bạch", shortName: "Hạc Bạch", rights: "performers" },
];

/**
 * Version 2026.2 is in effect from 15 September 2026 and 2026.3 is approved for 24 October. At P1 the
 * legal basis and the participant list are not offered yet, so the page says so rather than showing an
 * older text; the "populated" view is the target, with both sections and a newer approved participant list.
 */
export const ABOUT_IN_EFFECT: AboutPage = {
  version: "2026.2",
  effectiveFrom: "2026-09-15",
  asAt: null,
  current: null,
  upcoming: { version: "2026.3", effectiveFrom: "2026-10-24" },
  newerApprovedVersionExists: false,
  operator: "RightOne",
  collector: null,
  basis: null,
  participants: null,
};

export function mockAboutPage(view: Exclude<Pub01View, "loading">): LoadOutcome<AboutPageAnswer> {
  switch (view) {
    case "p1":
      return { data: { page: ABOUT_IN_EFFECT }, failure: null };
    case "populated":
      return {
        data: {
          page: {
            ...ABOUT_IN_EFFECT,
            newerApprovedVersionExists: true,
            basis: { instrumentSignedOn: "2026-06-02", coverage: ORGANISATIONS },
            participants: ORGANISATIONS,
          },
        },
        failure: null,
      };
    case "superseded":
      // Read as at 1 August 2026: version 2026.1, with the version now current beside it.
      return {
        data: {
          page: {
            ...ABOUT_IN_EFFECT,
            version: "2026.1",
            effectiveFrom: null,
            asAt: "2026-08-01",
            current: { version: "2026.2", effectiveFrom: "2026-09-15" },
            upcoming: null,
          },
        },
        failure: null,
      };
    case "empty":
      // NO_VERSION_AT_INSTANT is an answer, not a failure: nothing was published for that instant.
      return { data: { page: null }, failure: null };
    case "instant-invalid":
      return failure("INSTANT_INVALID", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "3f6b0d29c8a14e57");
  }
}

// ---------------------------------------------------------------- the tariff the public guidance reads

/** Factors in hundredths, so every figure of a calculation is a ratio of integers (TAR's ALG-295). */
export interface TariffContent {
  baseAmountMinor: number;
  currency: string;
  /** In component-code order, the order ALG-295 processes them in. */
  components: readonly { code: string; right: RightsKind; shareHundredths: number }[];
  /** The provinces and cities the questions offer, in the canvas's order. */
  adminAreas: readonly AdminArea[];
  /** The locality class of each area; an area the tariff gives no class is absent. */
  localityOf: Readonly<Partial<Record<AdminArea, number>>>;
  localityFactorHundredths: Readonly<Record<number, number>>;
  premisesClassFactorHundredths: Readonly<Record<PremisesClass, number>>;
  bands: readonly { fromM2: number; toM2: number | null; factorHundredths: number }[];
  capMinor: number;
  roundingUnitMinor: number;
  /** MICRO_BUSINESS, effect ALL_COMPONENTS: applied when every criterion is met. */
  microBusiness: { floorAtMostM2: number; seatsAtMost: number };
}

export interface TariffVersion {
  version: string;
  effectiveFrom: string;
  /** The last day it applies; null while no later version is approved. */
  effectiveTo: string | null;
  /** Null for a version whose content the canvas does not write: the mock cannot calculate under it. */
  content: TariffContent | null;
}

/**
 * TV-2026.1 as the canvas states it, completed from TAR's fixture content "TC-T1" where the canvas is silent.
 * From the canvas: the version, in effect from 1 July 2026 (SCR-PUB-11); locality factors 1.2, 1.0 and 0.8
 * (SCR-PUB-11); Ho Chi Minh City in locality class 1 (SCR-PUB-02); the yearly cap of 12,000,000 VND and the
 * rounding down to 1,000 VND (SCR-PUB-03, SCR-PUB-11); the micro-business exemption at 30 m² or less
 * (SCR-PUB-11). From "TC-T1" (TAR `frd/02-acceptance-criteria.md`): the base amount 2,530,000 VND, the shares
 * 0.5, 0.25 and 0.25, the premises-class factors, the floor-area bands, and the seating criterion of the
 * exemption (20 or fewer). The canvas's worked example comes out of these exactly: a café in Ho Chi Minh City
 * of 85 m² is 2,530,000 x 0.5 x 1.2 x 1.0 x 1.5 = 2,277,000 VND for authors' rights, 1,138,500 VND for each
 * related right, 4,554,000 VND in all. No locality class is written for Hà Nội, Đà Nẵng, Cần Thơ or Huế, so
 * the tariff gives them none, and a premises there is not shown to be in scope (TAR `ALG-296`, row 6).
 */
const TV_2026_1: TariffContent = {
  baseAmountMinor: 2_530_000,
  currency: "VND",
  components: [
    { code: "CMP-PERF", right: "performers", shareHundredths: 25 },
    { code: "CMP-REC", right: "producers", shareHundredths: 25 },
    { code: "CMP-WORK", right: "works", shareHundredths: 50 },
  ],
  adminAreas: ["hcm", "hn", "dn", "ct", "hue"],
  localityOf: { hcm: 1 },
  localityFactorHundredths: { 1: 120, 2: 100, 3: 80 },
  premisesClassFactorHundredths: { cafe: 100, bar: 200, shop: 61 },
  bands: [
    { fromM2: 0, toM2: 50, factorHundredths: 100 },
    { fromM2: 50, toM2: 200, factorHundredths: 150 },
    { fromM2: 200, toM2: null, factorHundredths: 250 },
  ],
  capMinor: 12_000_000,
  roundingUnitMinor: 1_000,
  microBusiness: { floorAtMostM2: 30, seatsAtMost: 20 },
};

/**
 * The tariff versions TAR answers for a date. TV-2026.0 applied from 1 March to 30 June 2026 (SCR-PUB-11's
 * superseded view) and the canvas writes none of its content; before 1 March 2026 no tariff was approved, as
 * SCR-PUB-03's 30 June 2025 shows.
 */
export const TARIFF_VERSIONS: readonly TariffVersion[] = [
  { version: "TV-2026.0", effectiveFrom: "2026-03-01", effectiveTo: "2026-06-30", content: null },
  { version: "TV-2026.1", effectiveFrom: "2026-07-01", effectiveTo: null, content: TV_2026_1 },
];

/**
 * Whether `PUB-INDICATIVE` (CFG-519) offers the indicative amount. At P1 no version is approved and the tested
 * default offers none (the canvas's "not-offered" view); the demonstration walks the target, where it is offered.
 */
export const INDICATIVE_OFFERED = true;

// ---------------------------------------------------------------- SCR-PUB-02 and SCR-PUB-03

/** The sample premises the canvas declares on both forms: a café in Ho Chi Minh City, 85 m², 40 seats. */
const DECLARED: DeclaredPremises = { assessmentDate: "2026-09-30", premisesClass: "cafe", adminArea: "hcm", floorAreaM2: "85", seats: "40" };

const ASSESSMENT_DATE = "2026-09-30";

const ASSUMED: AssumedPremises = { premisesClass: "cafe", adminArea: "hcm", floorAreaM2: 85, seats: 40 };

/** "Quán cà phê, đồ uống; TP. Hồ Chí Minh thuộc khu vực 1; diện tích từ 50 đến dưới 200 m²". */
const BASIS: ClassificationPath = { premisesClass: "cafe", adminArea: "hcm", localityClass: 1, band: { fromM2: 50, toM2: 200 }, unclassified: [] };

/** "Cơ sở siêu nhỏ: không áp dụng, vì diện tích trên 30 m²". */
const EXEMPTIONS: readonly ExemptionTested[] = [
  {
    code: "MICRO_BUSINESS",
    applied: false,
    criteria: [
      { fact: "FLOOR_AREA_M2", atMost: TV_2026_1.microBusiness.floorAtMostM2, value: 85, met: false },
      { fact: "SEATING_CAPACITY", atMost: TV_2026_1.microBusiness.seatsAtMost, value: 40, met: false },
    ],
  },
];

function questions(adminAreas: readonly AdminArea[], date = ASSESSMENT_DATE): ScopeQuestions {
  return { assessmentDate: date, questions: { premisesClasses: ["cafe", "bar", "shop"], adminAreas } };
}

export function mockScopeAssessment(view: Exclude<Pub02View, "loading" | "checking">): LoadOutcome<ScopeAssessmentPage> {
  const asked = questions(["hcm", "hn", "dn", "ct", "hue"]);
  switch (view) {
    case "p1-not-offered":
      return failure("GUIDANCE_UNAVAILABLE", false);
    case "form":
      return { data: { questions: asked, declared: DECLARED, assessment: null, invalid: [] }, failure: null };
    case "in-scope":
      return {
        data: {
          questions: asked,
          declared: DECLARED,
          assessment: {
            data: {
              outcome: "in_scope",
              cause: null,
              assessmentDate: ASSESSMENT_DATE,
              tariffVersion: "TV-2026.1",
              basis: BASIS,
              assumed: ASSUMED,
              exemptions: EXEMPTIONS,
              nextAction: "register",
            },
            failure: null,
          },
          invalid: [],
        },
        failure: null,
      };
    case "input-invalid":
      return {
        data: {
          questions: asked,
          declared: { ...DECLARED, floorAreaM2: "85m" },
          assessment: failure("ASSESSMENT_INPUT_INVALID", false),
          invalid: ["floor_area_m2"],
        },
        failure: null,
      };
    case "no-rules-for-date":
      return {
        data: { questions: { assessmentDate: ASSESSMENT_DATE, questions: null }, declared: DECLARED, assessment: null, invalid: [] },
        failure: null,
      };
  }
}

/**
 * SCR-PUB-03's answers. The indicative amount for the sample café is 4,554,000 VND for October 2026 to
 * September 2027 under TV-2026.1: authors' rights half, performers' and producers' rights a quarter each,
 * below the 12,000,000 VND cap, rounded down to the thousand.
 */
export function mockIndicativeAmount(view: Exclude<Pub03View, "loading">): LoadOutcome<IndicativeAmountPage> {
  const asked = questions(["hcm", "hn", "dn"]);
  const page = (calculation: IndicativeAmountPage["calculation"], declared = DECLARED): LoadOutcome<IndicativeAmountPage> => ({
    data: { questions: asked, declared, calculation, invalid: [] },
    failure: null,
  });
  switch (view) {
    case "not-offered":
      return failure("INDICATIVE_NOT_OFFERED", false);
    case "guidance-not-offered":
      return failure("GUIDANCE_UNAVAILABLE", false);
    case "form":
      return page(null);
    case "indicated":
      return page({
        data: {
          outcome: "indicated",
          tariffVersion: "TV-2026.1",
          assessmentDate: ASSESSMENT_DATE,
          period: { from: "2026-10-01", to: "2027-09-30" },
          transitionRule: "FROM_NEXT_MONTH",
          currency: "VND",
          basis: BASIS,
          assumed: ASSUMED,
          exemptions: EXEMPTIONS,
          components: [
            { right: "works", treatment: "charged", amountMinor: 2277000 },
            { right: "performers", treatment: "charged", amountMinor: 1138500 },
            { right: "producers", treatment: "charged", amountMinor: 1138500 },
          ],
          amountBeforeCapMinor: 4554000,
          capMinor: 12000000,
          capApplied: false,
          roundingUnitMinor: 1000,
          amountBeforeRoundingMinor: 4554000,
          amountMinor: 4554000,
        },
        failure: null,
      });
    case "no-amount":
      return page({ data: { outcome: "no_amount", treatment: "indeterminate", nextAction: "apply" }, failure: null });
    case "no-tariff-for-date":
      // The reader chose 30 June 2025, before any approved tariff.
      return page(failure("NO_TARIFF_FOR_DATE", false), { ...DECLARED, assessmentDate: "2025-06-30" });
    case "tariff-unavailable":
      return page(failure("TARIFF_UNAVAILABLE", true));
  }
}

// ---------------------------------------------------------------- SCR-PUB-04 and SCR-PUB-05

/**
 * The data sheet: the inspector scans the printout of Then Cửa Coffee & Tea – Pasteur, whose status record
 * is CER's R1-CER-2026-T7QM4BWJ (printout CRP-4WTN8QHC2K). R1-CER-2026-Q4RT8XZW is suspended since
 * 26 September 2026.
 */
const PASTEUR = "R1-CER-2026-T7QM4BWJ";
const PASTEUR_PRINTOUT = "CRP-4WTN8QHC2K";
const SUSPENDED = "R1-CER-2026-Q4RT8XZW";
const ANSWERED_AT = "2026-09-30T10:14:07+07:00";

/** A status record as the register publishes it: the fields the public may read (R19.3). */
export interface PublishedRecord {
  reference: string;
  status: "active" | "suspended";
  statusSince: string;
  validFrom: string;
  validTo: string;
  /** The current printout's reference, when the record has been printed. */
  printout: string | null;
}

/**
 * Every status record the canvas draws with a reference, in its state: the issued records of the premises
 * register (SCR-CER-01, all active; Pasteur's printed on 19 September, SCR-CER-12), the suspended record
 * SCR-PUB-05 answers, and the suspended record the field client answers (SCR-VER-02). R1-CER-2026-H8WX2DQR,
 * which the canvas answers as no record, is not among them.
 */
export const PUBLISHED_RECORDS: readonly PublishedRecord[] = [
  { reference: "R1-CER-2026-N6PZ2RKE", status: "active", statusSince: "2026-09-24T16:52:00+07:00", validFrom: "2026-09-24", validTo: "2027-09-23", printout: null },
  { reference: "R1-CER-2026-P3HV9XFT", status: "active", statusSince: "2026-09-20T09:44:00+07:00", validFrom: "2026-09-20", validTo: "2027-09-19", printout: null },
  { reference: PASTEUR, status: "active", statusSince: "2026-09-18T11:40:00+07:00", validFrom: "2026-09-18", validTo: "2027-09-17", printout: PASTEUR_PRINTOUT },
  { reference: "R1-CER-2026-H3NV6PXA", status: "active", statusSince: "2026-09-12T03:10:00+07:00", validFrom: "2026-09-12", validTo: "2027-09-11", printout: null },
  { reference: "R1-CER-2026-F9RB2KXN", status: "active", statusSince: "2026-09-11T10:02:00+07:00", validFrom: "2026-09-11", validTo: "2027-09-10", printout: null },
  { reference: "R1-CER-2026-D4KX7MQA", status: "active", statusSince: "2026-09-10T15:02:00+07:00", validFrom: "2026-09-10", validTo: "2027-09-09", printout: null },
  { reference: "R1-CER-2026-M2QT7VHD", status: "active", statusSince: "2026-09-05T08:47:00+07:00", validFrom: "2026-09-05", validTo: "2027-09-04", printout: null },
  { reference: "R1-CER-2026-W5HK8TQM", status: "active", statusSince: "2026-09-02T16:24:00+07:00", validFrom: "2026-09-02", validTo: "2027-09-01", printout: null },
  // Amended on 28 September by a change of the same holder: active since its issue, its period the new decision's.
  { reference: "R1-CER-2026-K9TE4WQC", status: "active", statusSince: "2026-09-02T15:05:00+07:00", validFrom: "2026-09-28", validTo: "2027-09-01", printout: null },
  { reference: SUSPENDED, status: "suspended", statusSince: "2026-09-26", validFrom: "2026-08-03", validTo: "2027-08-02", printout: null },
  { reference: "R1-CER-2026-V8JD3MRA", status: "suspended", statusSince: "2026-09-22T16:30:00+07:00", validFrom: "2026-06-15", validTo: "2027-06-14", printout: null },
];

/** The reference SCR-PUB-04 shows typed into its field, per view. */
const PUB04_TYPED: Readonly<Record<Pub04View, string>> = {
  form: "",
  checking: PASTEUR,
  unable: PASTEUR,
  absent: "R1-CER-2026-H8WX2DQR",
  "identifier-not-accepted": "R1-CER-2026-T7QM4BW",
  "rate-limited": "R1-CER-2026-N6PZ2RKE",
  enumeration: "",
  error: PASTEUR,
};

export function pub04Typed(view: Pub04View): string {
  return PUB04_TYPED[view];
}

const answered = (outcome: LoadOutcome<NonNullable<VerificationOutcome["data"]>>): VerificationOutcome => ({ ...outcome, retryAfter: null });

/** The canvas's answers, per view; a view drawn on one record shows that record whatever the address names. */
export function mockVerification(reference: string, view: VerificationView): VerificationOutcome {
  switch (view) {
    case "record":
      return answered({
        data: {
          outcome: "record",
          reference: PASTEUR,
          sourceAnsweredAt: ANSWERED_AT,
          attemptEndedAt: null,
          record: {
            status: "active",
            statusSince: "2026-09-18",
            validFrom: "2026-09-18",
            validTo: "2027-09-17",
            printout: PASTEUR_PRINTOUT,
            answerRef: "VA-7Q2K9MXD",
          },
        },
        failure: null,
      });
    case "record-suspended":
      return answered({
        data: {
          outcome: "record",
          reference: SUSPENDED,
          sourceAnsweredAt: ANSWERED_AT,
          attemptEndedAt: null,
          record: {
            status: "suspended",
            statusSince: "2026-09-26",
            validFrom: "2026-08-03",
            validTo: "2027-08-02",
            printout: null,
            answerRef: "VA-3HN8WQTB",
          },
        },
        failure: null,
      });
    case "absent":
      return answered({ data: { outcome: "absent", reference, sourceAnsweredAt: ANSWERED_AT, attemptEndedAt: null, record: null }, failure: null });
    case "unable":
      return answered({
        data: { outcome: "unable", reference, sourceAnsweredAt: null, attemptEndedAt: "2026-09-30T10:14:09+07:00", record: null },
        failure: null,
      });
    case "identifier-not-accepted":
      return answered(failure("IDENTIFIER_NOT_ACCEPTED", false));
    case "rate-limited":
      // The canvas's "Hãy thử lại sau 10:24 (GMT+7)".
      return { ...failure("VERIFICATION_RATE_LIMITED", true), retryAfter: "2026-09-30T10:24:00+07:00" };
    case "enumeration":
      return answered(failure("ENUMERATION_NOT_PERMITTED", false));
    case "error":
      return answered(failure("INTERNAL_ERROR", true, "5e2a91c07d4b8f36"));
  }
}
