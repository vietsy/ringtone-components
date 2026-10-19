import type { LoadOutcome } from "@rightone/ui";
import type {
  AboutPage,
  AboutPageAnswer,
  AdminArea,
  ArtistProfile,
  AssumedPremises,
  ClassificationPath,
  DeclaredPremises,
  DirectRecordAnswer,
  DirectRecordRoute,
  DisclosuresPage,
  DocumentClass,
  DocumentKind,
  ExemptionTested,
  HelpDestinationKind,
  HelpPurpose,
  HelpResponsible,
  HelpResponsibleDestination,
  HelpRouteItem,
  IndicativeAmountPage,
  LegalSection,
  LegalLibraryPage,
  LocalizedText,
  ParticipatingOrganisation,
  PlayerBusinessType,
  PlayerGuidePage,
  PremisesClass,
  PublicTrack,
  PublishedTariff,
  PublicVerificationOutcome,
  ReportDisclosure,
  ReportKind,
  RightsKind,
  ScopeAssessmentPage,
  ScopeQuestions,
  ServiceEntitlementAnswer,
  SourceKind,
  SourceRef,
  VersionedText,
  VersionPeriod,
  VersionStatus,
  WatchStatus,
} from "@/lib/api/public";
import { createHash } from "node:crypto";
import type { VerificationOutcome } from "@/lib/api/verification";
import type { HelpJourney } from "@/lib/route-groups/public-pages";
import { TERMS } from "./venue";

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

/** A route of the help route register (SCR-PUB-18) as the operations console keeps it (`public_view.help_routes`). */
export interface RegisteredHelpRoute {
  id: string;
  purpose: HelpPurpose;
  /** The public journeys whose pages show it. */
  journeys: readonly HelpJourney[];
  destinationKind: Exclude<HelpDestinationKind, "NOTICE">;
  /** A web address without its https:// scheme, as the public pages write it. */
  destination: string;
  responsible: HelpResponsibleDestination;
  publicAccess: boolean;
  /** When it was last confirmed: the canvas gives a day, taken as the start of that day in Vietnam time. */
  confirmedAt: string;
  /** Null where the canvas names nobody. */
  confirmedBy: string | null;
  /** Unconfirmed once the nightly check finds it more than 90 days since it was confirmed; retired when ended. */
  state: "active" | "unconfirmed" | "retired";
  unconfirmedReason: "CONFIRMATION_EXPIRED" | "CHECK_FAILED" | null;
  retiredAt: string | null;
  retiredBy: string | null;
  retirementReason: string | null;
}

const registered = (
  id: string,
  purpose: HelpPurpose,
  journeys: readonly HelpJourney[],
  destinationKind: RegisteredHelpRoute["destinationKind"],
  destination: string,
  responsible: HelpResponsible,
  confirmedOn: string,
): RegisteredHelpRoute => ({
  id,
  purpose,
  journeys,
  destinationKind,
  destination,
  responsible,
  publicAccess: true,
  confirmedAt: `${confirmedOn}T00:00:00+07:00`,
  confirmedBy: null,
  state: "active",
  unconfirmedReason: null,
  retiredAt: null,
  retiredBy: null,
  retirementReason: null,
});

/**
 * The register as SCR-PUB-18 draws it: seven routes, the complaint route unconfirmed since its confirmation of
 * 29 June 2026 is more than 90 days old, the old support page retired on 31 August 2026. No route serves privacy
 * information: it would link DAT's published notice, which is not offered yet, so the public pages show the
 * authoritative contact in its place (SCR-PUB-12's P1). The boards name nobody who confirmed or retired a route.
 */
export const HELP_ROUTE_REGISTER: readonly RegisteredHelpRoute[] = [
  { ...registered("HR-02", "complaint", ["complain", "verify"], "URL", "rightone.vn/khieu-nai", "complaints", "2026-06-29"), state: "unconfirmed", unconfirmedReason: "CONFIRMATION_EXPIRED" },
  registered("HR-01", "support", ["about", "scope", "tariff", "verify", "player"], "PHONE", "1900 2468 13", "support", "2026-09-12"),
  registered("HR-04", "correction", ["verify"], "URL", "rightone.vn/dinh-chinh", "corrections", "2026-09-15"),
  registered("HR-03", "privacy_rights", ["privacy"], "EMAIL", "baovedulieu@rightone.vn", "dpo", "2026-09-15"),
  registered("HR-05", "player_guide", ["player"], "URL", "rightone.vn/huong-dan/player", "support", "2026-09-20"),
  registered("HR-00", "authoritative", ["about", "legal"], "EMAIL", "lienhe@rightone.vn", "office", "2026-09-01"),
  { ...registered("HR-09", "support", ["about"], "URL", "rightone.vn/ho-tro-cu", "support", "2026-06-01"), state: "retired", retiredAt: "2026-08-31T00:00:00+07:00" },
];

/** `CFG-517`: a confirmation stays current for 90 days; the nightly check runs at 03:00 Vietnam time. */
export const ROUTE_CONFIRMATION_DAYS = 90;

/**
 * The journeys whose pages offer each purpose, a route or the authoritative contact in its place: the register's
 * own journeys, and privacy for privacy information, which no route serves yet. External escalation is offered on
 * the journeys its routes name, once the register holds one; no page stands the authoritative contact in for it.
 */
export const PURPOSE_JOURNEYS: Readonly<Record<HelpPurpose, readonly HelpJourney[]>> = {
  support: ["about", "scope", "tariff", "verify", "player"],
  complaint: ["complain", "verify"],
  correction: ["verify"],
  authoritative: ["about", "legal"],
  privacy_information: ["privacy"],
  privacy_rights: ["privacy"],
  external_escalation: [],
  player_guide: ["player"],
};

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
  effectiveTo: null,
  asAt: null,
  current: null,
  upcoming: { version: "2026.3", effectiveFrom: "2026-10-24" },
  sections: [],
  newerApprovedVersionExists: false,
  newerApprovedSources: [],
  servedAt: "2026-09-30T10:12:00+07:00",
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
            newerApprovedSources: ["PARTICIPANTS"],
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
            effectiveTo: "2026-09-14",
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

/** What TAR publishes of a version (`GET /tariff`): the decision, the components and factors, the cap, rounding, exemption. */
export type TariffPublication = Pick<PublishedTariff, "instrumentNumber" | "components" | "localityFactorsHundredths" | "capMinor" | "roundingUnitMinor" | "exemptionFloorAtMostM2">;

export interface TariffVersion {
  version: string;
  effectiveFrom: string;
  /** The last day it applies; null while no later version is approved. */
  effectiveTo: string | null;
  /** Null for a version whose content the canvas does not write: the mock cannot calculate under it. */
  content: TariffContent | null;
  publication: TariffPublication;
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

/** What SCR-PUB-11 publishes for TV-2026.1, from its content: decision No. 07/2026, the three rights, factors by class. */
const TV_2026_1_PUBLICATION: TariffPublication = {
  instrumentNumber: "07/2026",
  components: ["works", "performers", "producers"],
  localityFactorsHundredths: [1, 2, 3].map((locality) => TV_2026_1.localityFactorHundredths[locality] ?? 0),
  capMinor: TV_2026_1.capMinor,
  roundingUnitMinor: TV_2026_1.roundingUnitMinor,
  exemptionFloorAtMostM2: TV_2026_1.microBusiness.floorAtMostM2,
};

/**
 * The tariff versions TAR answers for a date. TV-2026.0 applied from 1 March to 30 June 2026: SCR-PUB-11's
 * superseded view publishes it with the same decision, factors, cap, rounding and exemption as TV-2026.1, but the
 * canvas writes none of the content a calculation needs (base amount, shares, bands), so SCR-PUB-02 and 03 cannot
 * calculate under it. Before 1 March 2026 no tariff was approved, as SCR-PUB-03's 30 June 2025 shows.
 */
export const TARIFF_VERSIONS: readonly TariffVersion[] = [
  { version: "TV-2026.0", effectiveFrom: "2026-03-01", effectiveTo: "2026-06-30", content: null, publication: TV_2026_1_PUBLICATION },
  { version: "TV-2026.1", effectiveFrom: "2026-07-01", effectiveTo: null, content: TV_2026_1, publication: TV_2026_1_PUBLICATION },
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
  const facts = [
    { key: "FLOOR_AREA_M2", required: true },
    { key: "SEATING_CAPACITY", required: false },
  ] as const;
  return { assessmentDate: date, questions: { premisesClasses: ["cafe", "bar", "shop"], adminAreas, facts } };
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
              // The board words the next action in the page's catalogue rather than from a published scope guide.
              nextAction: "register",
              nextActionText: null,
              guideVersion: null,
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

// ---------------------------------------------------------------- SCR-PUB-06 to 13: the public web beyond the certificate

/** The view states SCR-PUB-06 was drawn in; "absent" is P1's, the Player route answering that no record exists. */
export const PUB06_VIEWS = ["absent", "unable", "record", "record-suspended", "checking", "identifier-not-accepted", "rate-limited", "error"] as const;
export type Pub06View = (typeof PUB06_VIEWS)[number];

/** The view states SCR-PUB-07 was drawn in; both answers are P1's: neither LIC nor EVD offers a public reader. */
export const PUB07_VIEWS = ["licence-unable", "proof-unable", "checking", "identifier-not-accepted", "rate-limited", "error"] as const;
export type Pub07View = (typeof PUB07_VIEWS)[number];

/** The view states SCR-PUB-08 was drawn in; "p1-not-offered" is P1's: ART offers no public reader. */
export const PUB08_VIEWS = ["p1-not-offered", "populated", "source-unavailable", "not-public", "loading"] as const;
export type Pub08View = (typeof PUB08_VIEWS)[number];

/** The view states SCR-PUB-09 was drawn in; "p1-not-offered" is P1's: TRK offers no public reader. */
export const PUB09_VIEWS = ["p1-not-offered", "populated", "preview-not-public", "not-public", "source-unavailable", "loading"] as const;
export type Pub09View = (typeof PUB09_VIEWS)[number];

/** The view states SCR-PUB-10 was drawn in; "p1-no-version" is P1's: no legal document has a published version. */
export const PUB10_VIEWS = ["p1-no-version", "p1-privacy-not-offered", "in-effect", "superseded", "history", "page-history", "kind-unknown", "loading"] as const;
export type Pub10View = (typeof PUB10_VIEWS)[number];

/** The view states SCR-PUB-11 was drawn in; "p1": the tariff and the reports not offered, the amnesty announced. */
export const PUB11_VIEWS = ["p1", "populated", "superseded", "instant-invalid", "kind-unknown", "loading", "error"] as const;
export type Pub11View = (typeof PUB11_VIEWS)[number];

/** The view states SCR-PUB-12 was drawn in; "p1-partial": complaint and privacy information on the authoritative contact. */
export const PUB12_VIEWS = ["p1-partial", "populated", "journey-unknown", "loading", "error"] as const;
export type Pub12View = (typeof PUB12_VIEWS)[number];

/** The view states SCR-PUB-13 was drawn in; "populated" is P1's: guide 2026.1 in effect. */
export const PUB13_VIEWS = ["populated", "routes-unread", "empty", "instant-invalid", "loading", "error"] as const;
export type Pub13View = (typeof PUB13_VIEWS)[number];

/** A version of a public text as published: its label, the instant it takes effect, its text and digest. */
export interface PublishedVersion {
  label: string;
  effectiveFrom: string;
  sectionKeys: readonly string[];
  sections: readonly LegalSection[];
  digest: string | null;
}

const text = (vi: string, en: string) => ({ vi, en });

/** The premises service terms SCR-PUB-10 draws, four sections, the text of the versions before the current one. */
const BOARD_TERMS: readonly LegalSection[] = [
  {
    id: "scope",
    heading: text("1. Phạm vi dịch vụ", "1. Scope of the service"),
    body: text(
      "RightOne Player phát nhạc từ danh mục được cấp phép trực tiếp cho cơ sở đã chấp nhận điều khoản này, trên thiết bị đã ghép nối với cơ sở.",
      "RightOne Player plays music from the directly licensed catalogue to a premises that has accepted these terms, on a device paired with that premises.",
    ),
  },
  {
    id: "duties",
    heading: text("2. Nghĩa vụ của cơ sở", "2. What the premises does"),
    body: text(
      "Cơ sở chỉ phát nhạc của RightOne Player tại địa điểm đã đăng ký và giữ thiết bị kết nối để gửi minh chứng phát nhạc.",
      "The premises plays RightOne Player music only at the registered address and keeps the device connected so that playback evidence is sent.",
    ),
  },
  {
    id: "suspension",
    heading: text("3. Tạm dừng và chấm dứt", "3. Suspension and ending"),
    body: text(
      "RightOne báo trước cho cơ sở khi tạm dừng dịch vụ, nêu căn cứ và việc cần làm để dịch vụ được khôi phục.",
      "RightOne tells the premises in advance before it suspends the service, with the ground and what restores the service.",
    ),
  },
  {
    id: "complaints",
    heading: text("4. Khiếu nại", "4. Complaints"),
    body: text(
      "Cơ sở gửi khiếu nại qua kênh khiếu nại được công bố ở trang Trợ giúp.",
      "The premises sends a complaint through the complaint route published on the Help page.",
    ),
  },
];

/**
 * The digest of a version's text as RightOne shows it in Vietnamese, the formula SCR-VEN-02 attests acceptance with
 * (the title, then each heading and body, a line each), written in groups of four as SCR-PUB-10 draws it.
 */
function digestOf(title: string, sections: readonly LegalSection[]): string {
  const hex = createHash("sha256").update([title, ...sections.flatMap((section) => [section.heading.vi, section.body.vi])].join("\n")).digest("hex");
  return `sha256 ${hex.match(/.{4}/g)?.join(" ") ?? hex}`;
}

/** Version 3 of the terms is the text a premises accepts on SCR-VEN-02, as VEN holds it. */
const TERMS_3: readonly LegalSection[] = TERMS.sections.map((section) => ({ id: section.id, heading: section.heading, body: section.body }));

/** The amnesty period's version, as REG answers it (SCR-PUB-11, 17). */
const AMNESTY_VERSION = "AMV-2026-1";

/** The four parts of the Player guide 2026.1, each a numbered list of steps in the catalogue (`pub13.section.*`). */
export const PLAYER_GUIDE_SECTIONS = ["enrol", "pair", "sync", "recover"] as const;

// ---------------------------------------------------------------- SCR-PUB-14 to 17: the documents, their versions, the currency watches

/** A public document as `MIG-PUB-02` loads it: its class, the sections a version must carry, the sources it describes. */
export interface PublicDocument {
  kind: DocumentKind;
  documentClass: DocumentClass;
  requiredSections: readonly string[];
  sourceKinds: readonly SourceKind[];
}

/**
 * The nine documents, in SCR-PUB-14's order: the pages, then the legal documents. `PLAYER_GUIDE` requires its four
 * parts, `SCOPE_GUIDE` the three next actions of `DR-491` and `ABOUT` the statement that RightOne is one lawful route
 * and not the only one (`DR-494` row 7, carried for GOV's `FR-GOV-025`); `ABOUT` alone describes sources
 * (`public_view.documents`).
 */
export const DOCUMENTS: readonly PublicDocument[] = [
  { kind: "ABOUT", documentClass: "PAGE", requiredSections: ["ONE_LAWFUL_ROUTE"], sourceKinds: ["INSTRUMENT", "MANDATES", "PARTICIPANTS"] },
  { kind: "SCOPE_GUIDE", documentClass: "PAGE", requiredSections: ["IN_SCOPE", "OUT_OF_SCOPE", "INDETERMINATE"], sourceKinds: [] },
  { kind: "TARIFF", documentClass: "PAGE", requiredSections: [], sourceKinds: [] },
  { kind: "HELP", documentClass: "PAGE", requiredSections: [], sourceKinds: [] },
  { kind: "PLAYER_GUIDE", documentClass: "PAGE", requiredSections: ["ENROLMENT", "PAIRING", "SYNCHRONISATION", "RECOVERY"], sourceKinds: [] },
  { kind: "PREMISES_SERVICE_TERMS", documentClass: "LEGAL", requiredSections: [], sourceKinds: [] },
  { kind: "ARTIST_TERMS", documentClass: "LEGAL", requiredSections: [], sourceKinds: [] },
  { kind: "RIGHTS_WITHDRAWAL", documentClass: "LEGAL", requiredSections: [], sourceKinds: [] },
  { kind: "TAKEDOWN_PROCESS", documentClass: "LEGAL", requiredSections: [], sourceKinds: [] },
];

/** A member of staff as a version records them: the address RightOne ID knows them by, and their name. */
export interface StaffPerson {
  email: string;
  name: string;
}

/** Quan Ngọc Trâm, the policy preparer the boards draw drafting every open version (`lib/mock/backend/accounts.ts`). */
const TRAM: StaffPerson = { email: "quan.ngoctram@rightone.example", name: "Quan Ngọc Trâm" };

/** A version of a public document in one `SM-455` state, every column the console reads (`public_view.document_versions`). */
export interface DocumentVersionRecord {
  id: string;
  kind: DocumentKind;
  label: string;
  status: VersionStatus;
  /** The text as written, Markdown; null where the canvas writes a published version's text into the page's catalogue. */
  body: LocalizedText | null;
  sections: readonly LegalSection[];
  sectionKeys: readonly string[];
  digest: string | null;
  sourceRefs: readonly SourceRef[];
  /** An instant with its offset; a draft carries none. */
  effectiveFrom: string | null;
  /** Null for a published version the canvas names no author for. */
  draftedBy: StaffPerson | null;
  savedAt: string;
  submittedAt: string | null;
  decidedBy: StaffPerson | null;
  decidedAt: string | null;
  lastDecision: "APPROVE" | "RETURN" | null;
  decisionReason: string | null;
  plainLanguageConfirmed: boolean;
  /** Null for a published version the canvas gives no publication instant for. */
  publishedAt: string | null;
  withdrawnBy: StaffPerson | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

/** `ALG-462`: the text stored as Unicode NFC with line feeds, so its digest is one value however it was typed. */
export function normalisedBody(body: string): string {
  return body.normalize("NFC").replace(/\r\n?/g, "\n");
}

/** `ALG-462`: a section key per level-two heading, the text up to " - ", upper-cased with spaces as underscores. */
export function sectionKeysOf(body: string): string[] {
  return body
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => (line.slice(3).split(" - ")[0] ?? "").trim().toUpperCase().replace(/\s+/g, "_"));
}

/** The sections a reader is shown: each level-two heading with the text under it, in both languages as written. */
export function sectionsOf(body: LocalizedText): LegalSection[] {
  const split = (text: string) => {
    const parts: { heading: string; body: string }[] = [];
    for (const line of text.split("\n")) {
      if (line.startsWith("## ")) parts.push({ heading: line.slice(3).trim(), body: "" });
      else if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last !== undefined) last.body = last.body === "" ? line : `${last.body}\n${line}`;
      }
    }
    return parts.map((part) => ({ heading: part.heading, body: part.body.trim() }));
  };
  const vi = split(body.vi);
  const en = split(body.en);
  return vi.map((part, index) => ({
    id: `s${index + 1}`,
    heading: text(part.heading, en[index]?.heading ?? part.heading),
    body: text(part.body, en[index]?.body ?? part.body),
  }));
}

/** `ALG-462`'s digest: SHA-256 over the stored text, written in groups of four as SCR-PUB-10 draws a digest. */
export function bodyDigestOf(body: string): string {
  const hex = createHash("sha256").update(normalisedBody(body), "utf8").digest("hex");
  return `sha256 ${hex.match(/.{4}/g)?.join(" ") ?? hex}`;
}

/** A text written as Markdown from sections: each heading on a "## " line, its text under it. */
function markdownOf(sections: readonly LegalSection[]): LocalizedText {
  const write = (locale: "vi" | "en") => sections.map((section) => `## ${section.heading[locale]}\n${section.body[locale]}`).join("\n\n");
  return text(write("vi"), write("en"));
}

const at = (day: string) => `${day}T00:00:00+07:00`;

/** The columns a version has not filled yet. */
type Unrecorded = Pick<
  DocumentVersionRecord,
  "sourceRefs" | "submittedAt" | "decidedBy" | "decidedAt" | "lastDecision" | "decisionReason" | "plainLanguageConfirmed" | "withdrawnBy" | "withdrawnAt" | "withdrawalReason"
>;

const blank: Unrecorded = {
  sourceRefs: [],
  submittedAt: null,
  decidedBy: null,
  decidedAt: null,
  lastDecision: null,
  decisionReason: null,
  plainLanguageConfirmed: false,
  withdrawnBy: null,
  withdrawnAt: null,
  withdrawalReason: null,
};

/**
 * A version the canvas draws published: who drafted, decided and published it is not drawn, so none is named, and
 * its publication instant is not given either; a text held as sections is written back as the Markdown it came from.
 */
function published(id: string, kind: DocumentKind, label: string, effectiveOn: string, held: { sections: readonly LegalSection[]; digest: string | null } | { keys: readonly string[] } | null): DocumentVersionRecord {
  const sections = held !== null && "sections" in held ? held.sections : [];
  const body = sections.length > 0 ? markdownOf(sections) : null;
  return {
    ...blank,
    id,
    kind,
    label,
    status: "PUBLISHED",
    body,
    sections,
    sectionKeys: held !== null && "keys" in held ? held.keys : body !== null ? sectionKeysOf(body.vi) : [],
    digest: held !== null && "digest" in held ? held.digest : null,
    effectiveFrom: at(effectiveOn),
    draftedBy: null,
    savedAt: at(effectiveOn),
    publishedAt: null,
  };
}

/** A version written in the editor, held as its Markdown with the sections and keys `ALG-462` reads from it. */
function written(fields: Omit<DocumentVersionRecord, "sections" | "sectionKeys" | "digest" | keyof Unrecorded> & Partial<Unrecorded>, submitted: boolean): DocumentVersionRecord {
  const body = fields.body ?? text("", "");
  return {
    ...blank,
    ...fields,
    sections: sectionsOf(body),
    sectionKeys: sectionKeysOf(body.vi),
    digest: submitted ? bodyDigestOf(body.vi) : null,
  };
}

/** "What RightOne is" 2026.2 and 2026.4 as SCR-PUB-16 compares them: 2026.4 says the collection authority is pending. */
const ABOUT_2026_2 = text(
  "## OPERATOR\nRightOne do đơn vị vận hành hạ tầng RightOne vận hành.\n\n## SCOPE\nQuyền tác giả, quyền của người biểu diễn và quyền của nhà sản xuất bản ghi âm do các tổ chức tham gia đại diện.\n\n## ONE_LAWFUL_ROUTE\nCổng một cửa này là một con đường hợp pháp để đáp ứng nghĩa vụ, không phải con đường duy nhất.",
  "## OPERATOR\nRightOne is operated by its infrastructure operator.\n\n## SCOPE\nAuthors’, performers’ and producers’ rights that the participating organisations represent.\n\n## ONE_LAWFUL_ROUTE\nThis single window is one lawful route to meeting the obligation, and not the only one.",
);
const ABOUT_2026_4 = text(
  ABOUT_2026_2.vi.replace("vận hành.\n", "vận hành. Đơn vị thu đang chờ chỉ định.\n"),
  ABOUT_2026_2.en.replace("operator.\n", "operator. The collection authority is pending designation.\n"),
);

/**
 * The Player guide's draft 2026.2 as SCR-PUB-15 draws it: enrolment, pairing and synchronisation written, recovery
 * not yet, so submitting it is refused SECTIONS_MISSING. The board names its author Lê Văn Cường, who in the accounts
 * is the supervising authority's officer and drafts nothing (`ACT-REG`), so the policy preparer, Quan Ngọc Trâm,
 * holds it.
 */
const GUIDE_2026_2 = text(
  "## ENROLMENT\nMở cổng cơ sở và chọn Thiết bị.\n\n## PAIRING\nNhập mã ghép nối theo ba nhóm, mỗi nhóm bốn ký tự.\n\n## SYNCHRONISATION\nGiữ thiết bị kết nối internet khi tải danh sách phát lần đầu.",
  "## ENROLMENT\nOpen the premises portal and choose Devices.\n\n## PAIRING\nEnter the pairing code in three groups of four characters.\n\n## SYNCHRONISATION\nKeep the device online while it loads the playlists for the first time.",
);

/**
 * The scope guide's draft 2026.1 (SCR-PUB-14, saved 22 September 2026): its sections are the next actions of
 * `DR-491`, worded as SCR-PUB-02 words them; the canvas writes no other text for it.
 */
const SCOPE_2026_1 = text(
  "## IN_SCOPE\nĐăng ký cơ sở với RightOne.\n\n## OUT_OF_SCOPE\nKhông cần đăng ký; nếu cần, hãy đề nghị xác nhận bằng văn bản.\n\n## INDETERMINATE\nNộp đơn đăng ký; cán bộ RightOne sẽ quyết định.",
  "## IN_SCOPE\nRegister the premises with RightOne.\n\n## OUT_OF_SCOPE\nNo registration is needed; ask for a written confirmation if you want one.\n\n## INDETERMINATE\nApply to register; a RightOne officer decides.",
);

/**
 * Every version the canvas draws, in every state. Published: "What RightOne is" 2026.1 from 1 July, 2026.2 from
 * 15 September and 2026.3 from 24 October 2026 (SCR-PUB-10's page history, SCR-PUB-01); the tariff page, the help page
 * and the Player guide 2026.1 from 15 September (SCR-PUB-14); the RightOne Player terms for premises 1, 2 and 3, the
 * versions VEN's services were accepted under (accepted 3 June, 13 August, 2 and 6 September 2026), 3 in effect from
 * 1 September as SCR-VEN-02 states; the canvas gives no date for 1 and 2, so each is taken as the first of the month it
 * was first accepted in, with SCR-PUB-10's earlier text. Open: "What RightOne is" 2026.4 submitted by Quan Ngọc Trâm on
 * 29 September at 16:42 to take effect on 1 December, describing the participant list PL-2026-3 and the mandate set
 * MS-2026-2 (SCR-PUB-16); the scope guide 2026.1 and the Player guide 2026.2 in draft (SCR-PUB-14, 15). SCR-PUB-14 also
 * draws a version 2026.1 of the premises terms awaiting approval, which the published 1, 2 and 3 above replace: the
 * terms VEN's services accepted are the ones on record. No other legal document has a version; the canvas writes the
 * text of the unwritten published pages into their own catalogues.
 */
export const DOCUMENT_VERSIONS: readonly DocumentVersionRecord[] = [
  published("DV-ABT26C1Q7M", "ABOUT", "2026.1", "2026-07-01", null),
  { ...published("DV-ABT26C2K4R", "ABOUT", "2026.2", "2026-09-15", null), body: ABOUT_2026_2, sections: sectionsOf(ABOUT_2026_2), sectionKeys: sectionKeysOf(ABOUT_2026_2.vi) },
  published("DV-ABT26C3W8T", "ABOUT", "2026.3", "2026-10-24", null),
  written(
    {
      id: "DV-ABT26C4N2X",
      kind: "ABOUT",
      label: "2026.4",
      status: "SUBMITTED",
      body: ABOUT_2026_4,
      sourceRefs: [
        { kind: "PARTICIPANTS", ref: "PL-2026-3" },
        { kind: "MANDATES", ref: "MS-2026-2" },
      ],
      effectiveFrom: at("2026-12-01"),
      draftedBy: TRAM,
      savedAt: "2026-09-29T16:40:00+07:00",
      submittedAt: "2026-09-29T16:42:00+07:00",
      publishedAt: null,
    },
    true,
  ),
  written({ id: "DV-SCG26C1H5P", kind: "SCOPE_GUIDE", label: "2026.1", status: "DRAFT", body: SCOPE_2026_1, effectiveFrom: null, draftedBy: TRAM, savedAt: "2026-09-22", publishedAt: null }, false),
  published("DV-TRF26C1B3V", "TARIFF", "2026.1", "2026-09-15", null),
  published("DV-HLP26C1D9F", "HELP", "2026.1", "2026-09-15", null),
  published("DV-PLG26C1M6J", "PLAYER_GUIDE", "2026.1", "2026-09-15", { keys: PLAYER_GUIDE_SECTIONS }),
  written({ id: "DV-PLG26C2T8K", kind: "PLAYER_GUIDE", label: "2026.2", status: "DRAFT", body: GUIDE_2026_2, effectiveFrom: null, draftedBy: TRAM, savedAt: "2026-09-28", publishedAt: null }, false),
  published("DV-PST1C9R2WH", "PREMISES_SERVICE_TERMS", "1", "2026-06-01", { sections: BOARD_TERMS, digest: digestOf(TERMS.title.vi, BOARD_TERMS) }),
  published("DV-PST2C4V7QN", "PREMISES_SERVICE_TERMS", "2", "2026-08-01", { sections: BOARD_TERMS, digest: digestOf(TERMS.title.vi, BOARD_TERMS) }),
  published("DV-PST3C6K3MZ", "PREMISES_SERVICE_TERMS", TERMS.version, TERMS.effective, { sections: TERMS_3, digest: digestOf(TERMS.title.vi, TERMS_3) }),
];

/**
 * GOV's reserved decision `PUB-LEGAL-RELEASE` (`CFG-520`), which the mock plays: its default holds it for nobody, so
 * no legal document is released; the demonstration walks the target, where the sponsor has assigned it to the
 * independent legal approver, Thạch Minh Khải.
 */
export const LEGAL_RELEASE_HOLDERS: readonly string[] = ["thach.minhkhai@rightone.example"];

/** `CFG-515`: an approved change reaches the public service within 72 hours of its approval. */
export const PUBLICATION_PERIOD_HOURS = 72;

/** One approved change to a source, as the sweep recorded it (`public_view.currency_watches`). */
export interface CurrencyWatchRecord {
  id: string;
  sourceKind: SourceKind;
  versionRef: string;
  approvedAt: string | null;
  observedAt: string;
  measuredFrom: "APPROVAL" | "OBSERVATION" | "BASELINE";
  dueAt: string | null;
  status: WatchStatus;
  reachedAt: string | null;
  reachedByVersion: string | null;
  overdueAt: string | null;
  reopenedAt: string | null;
  cancelledAt: string | null;
  cancelReason: "SOURCE_WITHDRAWN" | "SUPERSEDED" | null;
  /** COM's reference for `NTF-PUB-01`; null while the raise has not succeeded. */
  noticeRef: string | null;
  /** When the sweep last asked COM to raise it, so a raise not taken is repeated once a run, not on every read. */
  noticeTriedAt: string | null;
}

const watch = (fields: Pick<CurrencyWatchRecord, "id" | "sourceKind" | "versionRef" | "approvedAt" | "observedAt" | "measuredFrom" | "dueAt" | "status"> & Partial<CurrencyWatchRecord>): CurrencyWatchRecord => ({
  reachedAt: null,
  reachedByVersion: null,
  overdueAt: null,
  reopenedAt: null,
  cancelledAt: null,
  cancelReason: null,
  noticeRef: null,
  noticeTriedAt: null,
  ...fields,
});

/**
 * The watches SCR-PUB-17 draws: the participant list PL-2026-3 approved on 26 September at 08:00 and overdue since
 * 29 September at 08:00; the mandate set MS-2026-2 approved on 28 September at 15:30, due on 1 October at 15:30 (the
 * read moves it to overdue once that has passed); the amnesty AMV-2026-1, read from REG at use, reached five minutes
 * after its approval of 25 September at 10:00; the tariff TV-2026.1, the baseline of its source kind, not measured.
 * The sweep runs every five minutes, so each change is taken as seen five minutes after its approval; the baseline,
 * on the first run after TV-2026.1 took effect.
 */
export const CURRENCY_WATCHES: readonly CurrencyWatchRecord[] = [
  watch({ id: "CW-PL26C3", sourceKind: "PARTICIPANTS", versionRef: "PL-2026-3", approvedAt: "2026-09-26T08:00:00+07:00", observedAt: "2026-09-26T08:05:00+07:00", measuredFrom: "APPROVAL", dueAt: "2026-09-29T08:00:00+07:00", status: "OVERDUE", overdueAt: "2026-09-29T08:00:00+07:00" }),
  watch({ id: "CW-MS26C2", sourceKind: "MANDATES", versionRef: "MS-2026-2", approvedAt: "2026-09-28T15:30:00+07:00", observedAt: "2026-09-28T15:35:00+07:00", measuredFrom: "APPROVAL", dueAt: "2026-10-01T15:30:00+07:00", status: "OPEN" }),
  watch({ id: "CW-AMV26C1", sourceKind: "AMNESTY", versionRef: AMNESTY_VERSION, approvedAt: "2026-09-25T10:00:00+07:00", observedAt: "2026-09-25T10:05:00+07:00", measuredFrom: "APPROVAL", dueAt: null, status: "REACHED", reachedAt: "2026-09-25T10:05:00+07:00" }),
  watch({ id: "CW-TV26C1", sourceKind: "TARIFF", versionRef: "TV-2026.1", approvedAt: null, observedAt: "2026-07-01T00:05:00+07:00", measuredFrom: "BASELINE", dueAt: null, status: "REACHED", reachedAt: "2026-07-01T00:05:00+07:00" }),
];

/** The review views of the console screens (SCR-PUB-14 to 18): loading, an outage, and a reader the endpoint refuses. */
export const POLICY_VIEWS = ["loading", "error", "not-authorised"] as const;

/**
 * The amnesty period REG approved on 25 September 2026 for 1 January to 30 June 2027 (AMV-2026-1). It is not
 * released before it begins, so SCR-PUB-11 announces it as upcoming (SCR-PUB-11's P1).
 */
export const AMNESTY = {
  version: AMNESTY_VERSION,
  period: { from: "2027-01-01", to: "2027-06-30" },
  approvedAt: "2026-09-25T10:00:00+07:00",
} as const;

/** The reports and disclosures SCR-PUB-11 lists, in its order. */
export const REPORT_KINDS: readonly ReportKind[] = ["AUDITED_FINANCIAL_REPORT", "PILOT_REPORT", "TARIFF_PUBLICATION", "MANDATE_LIST", "COST_POSITION"];

/** A source that offers no public reader yet: SOURCE_UNAVAILABLE that retrying will not change. */
export const NOT_OFFERED = failure("SOURCE_UNAVAILABLE", false);

const RATE_LIMITED_UNTIL = "2026-09-30T10:24:00+07:00";

/**
 * The classification VEN records for each Then Cửa premises at enrolment, which the Player route names: the mock's
 * VEN seed does not keep it, so it is read from the premises' trade names (Coffee & Tea and the Tea House are cafés,
 * as the registration seed classes Pasteur and Sala; Bakery, Lounge & Karaoke and Kitchen as named), and the wording
 * of each is SCR-PUB-06's for cafés and karaoke, SCR-VEN-01's for bakeries and restaurants. Every one is in Ho Chi
 * Minh City.
 */
export const PLAYER_BUSINESS_TYPES: Readonly<Record<string, PlayerBusinessType>> = {
  pasteur: "cafe",
  nh: "cafe",
  ltt: "cafe",
  sala: "cafe",
  hbt: "bakery",
  dakao: "bakery",
  buivien: "karaoke",
  pxl: "restaurant",
};

/** The printed code SCR-PUB-06 draws, which matches no entitlement. */
const UNKNOWN_PRINTED_CODE = "ZZQ7LUO2XKB4MWTR5NV3IAOEPL.K7MTRQ2ZUXLWO4BN5";
const PLAYER_ANSWERED_AT = "2026-09-30T10:31:42+07:00";

/** SCR-PUB-06's answers, per view; a view drawn on one entitlement shows it whatever the address names. */
export function mockServiceEntitlement(printedCode: string, view: Exclude<Pub06View, "checking">): PublicVerificationOutcome<ServiceEntitlementAnswer> {
  const answer = (data: ServiceEntitlementAnswer) => ({ data, failure: null, retryAfter: null });
  const asked = printedCode === "" ? UNKNOWN_PRINTED_CODE : printedCode;
  switch (view) {
    case "absent":
      return answer({ outcome: "absent", printedCode: asked, sourceAnsweredAt: PLAYER_ANSWERED_AT, attemptEndedAt: null, cause: null, entitlement: null });
    case "unable":
      return answer({ outcome: "unable", printedCode: asked, sourceAnsweredAt: null, attemptEndedAt: "2026-09-30T10:31:43+07:00", cause: "SOURCE_NOT_OFFERED", entitlement: null });
    case "record":
      return answer({
        outcome: "record",
        printedCode: asked,
        sourceAnsweredAt: PLAYER_ANSWERED_AT,
        attemptEndedAt: null,
        cause: null,
        entitlement: { statusWord: "SERVICE_ACTIVE", premisesName: "Then Cửa Coffee & Tea – Lê Thánh Tôn", businessType: "cafe", locality: "hcm", reference: "RPS-W5LQ3ZK7NA", answerRef: "VA-6TMR2KXP" },
      });
    case "record-suspended":
      return answer({
        outcome: "record",
        printedCode: asked,
        sourceAnsweredAt: PLAYER_ANSWERED_AT,
        attemptEndedAt: null,
        cause: null,
        entitlement: { statusWord: "SERVICE_SUSPENDED", premisesName: "Then Cửa Lounge & Karaoke – Bùi Viện", businessType: "karaoke", locality: "hcm", reference: "RPS-H3TC8MVQ2D", answerRef: "VA-9DQW4LHN" },
      });
    case "identifier-not-accepted":
      return { ...failure("IDENTIFIER_NOT_ACCEPTED", false), retryAfter: null };
    case "rate-limited":
      return { ...failure("VERIFICATION_RATE_LIMITED", true), retryAfter: RATE_LIMITED_UNTIL };
    case "error":
      return { ...failure("INTERNAL_ERROR", true, "b13f7a60e29c4d85"), retryAfter: null };
  }
}

/** SCR-PUB-07's answers, per view: the licence LIC-7HQ2MZ4WRT and the proof PRF-5NW8QJ2TLC, neither answerable at P1. */
export function mockDirectRecord(view: Exclude<Pub07View, "checking">): PublicVerificationOutcome<DirectRecordAnswer> {
  const unable = (route: DirectRecordRoute, reference: string, attemptEndedAt: string) => ({
    data: { route, outcome: "unable" as const, reference, attemptEndedAt, cause: "SOURCE_NOT_OFFERED" as const },
    failure: null,
    retryAfter: null,
  });
  switch (view) {
    case "licence-unable":
      return unable("licence", "LIC-7HQ2MZ4WRT", "2026-09-30T14:00:51+07:00");
    case "proof-unable":
      return unable("proof", "PRF-5NW8QJ2TLC", "2026-09-30T14:02:18+07:00");
    case "identifier-not-accepted":
      return { ...failure("IDENTIFIER_NOT_ACCEPTED", false), retryAfter: null };
    case "rate-limited":
      return { ...failure("VERIFICATION_RATE_LIMITED", true), retryAfter: RATE_LIMITED_UNTIL };
    case "error":
      return { ...failure("INTERNAL_ERROR", true, "7c40e5b2a8d1f963"), retryAfter: null };
  }
}

/** The licence of "Chủ nhật lười", which SCR-PUB-09's "Kiểm tra giấy phép" looks up (SCR-PUB-07's reference). */
const CHU_NHAT_LUOI_LICENCE = "LIC-7HQ2MZ4WRT";

/**
 * The artist SCR-PUB-08 and 09 draw beyond P1: Ngân Mộc and three public recordings. A display profile is the
 * artist's chosen public identity, written in their own words, so its biography is data, not interface copy.
 */
const NGAN_MOC: ArtistProfile = {
  slug: "ngan-moc",
  displayName: "Ngân Mộc",
  biography: "Ca sĩ và nhạc sĩ người Huế, hát pop và acoustic, phát hành bản ghi đầu tiên năm 2019.",
  repertoire: [
    { id: "chu-nhat-luoi", title: "Chủ nhật lười", durationSeconds: 222 },
    { id: "ve-di-troi-mua-roi-acoustic", title: "Về đi, trời mưa rồi (Acoustic)", durationSeconds: 245 },
    { id: "de-anh-noi-not", title: "Để anh nói nốt", durationSeconds: 198 },
  ],
};

export function mockArtistProfile(view: Exclude<Pub08View, "loading">): LoadOutcome<ArtistProfile> {
  switch (view) {
    case "p1-not-offered":
      return NOT_OFFERED;
    case "populated":
      return { data: NGAN_MOC, failure: null };
    case "source-unavailable":
      return failure("SOURCE_UNAVAILABLE", true);
    case "not-public":
      return failure("ARTIST_NOT_PUBLIC", false);
  }
}

export function mockPublicTrack(view: Exclude<Pub09View, "loading">): LoadOutcome<PublicTrack> {
  const track: PublicTrack = {
    id: "chu-nhat-luoi",
    title: "Chủ nhật lười",
    artist: { slug: NGAN_MOC.slug, displayName: NGAN_MOC.displayName },
    durationSeconds: 222,
    previewSeconds: 30,
    previewPublic: true,
    licenceReference: CHU_NHAT_LUOI_LICENCE,
  };
  switch (view) {
    case "p1-not-offered":
      return NOT_OFFERED;
    case "populated":
      return { data: track, failure: null };
    case "preview-not-public":
      return { data: { ...track, previewPublic: false }, failure: null };
    case "not-public":
      return failure("TRACK_NOT_PUBLIC", false);
    case "source-unavailable":
      return failure("SOURCE_UNAVAILABLE", true);
  }
}

/** The premises service terms beyond P1, as SCR-PUB-10 draws them: 2026.1, 2026.2 in effect, 2026.3 upcoming. */
const TERMS_DIGEST = "sha256 9c4e 71b0 2a6f d385 e1c7 40b9 6f2a 8d15";
const TERMS_2026_1: VersionPeriod = { label: "2026.1", state: "SUPERSEDED", effectiveFrom: "2026-07-01", effectiveTo: "2026-09-14" };
const TERMS_2026_2: VersionPeriod = { label: "2026.2", state: "IN_EFFECT", effectiveFrom: "2026-09-15", effectiveTo: null };
const TERMS_2026_3: VersionPeriod = { label: "2026.3", state: "UPCOMING", effectiveFrom: "2026-10-24", effectiveTo: null };

export function mockLegalLibrary(view: Exclude<Pub10View, "loading">): LoadOutcome<LegalLibraryPage> {
  const terms = (document: LoadOutcome<VersionedText>, history: LegalLibraryPage["history"] = null): LoadOutcome<LegalLibraryPage> => ({
    data: { kind: "PREMISES_SERVICE_TERMS", document, history },
    failure: null,
  });
  const none: VersionedText = { version: null, asAt: null, current: null, upcoming: null };
  switch (view) {
    case "p1-no-version":
      return terms({ data: none, failure: null });
    case "p1-privacy-not-offered":
      return { data: { kind: "PRIVACY_NOTICE", document: NOT_OFFERED, history: null }, failure: null };
    case "in-effect":
      return terms({
        data: { version: { ...TERMS_2026_2, sectionKeys: [], sections: BOARD_TERMS, digest: TERMS_DIGEST }, asAt: null, current: null, upcoming: TERMS_2026_3 },
        failure: null,
      });
    case "superseded":
      return terms({
        data: { version: { ...TERMS_2026_1, sectionKeys: [], sections: BOARD_TERMS, digest: TERMS_DIGEST }, asAt: "2026-08-01", current: TERMS_2026_2, upcoming: null },
        failure: null,
      });
    case "history":
      return terms({ data: none, failure: null }, { of: "document", versions: { data: [TERMS_2026_3, TERMS_2026_2, TERMS_2026_1], failure: null } });
    case "page-history":
      return terms(
        { data: none, failure: null },
        {
          of: "page",
          versions: {
            data: [
              { label: "2026.3", state: "UPCOMING", effectiveFrom: "2026-10-24", effectiveTo: null },
              { label: "2026.2", state: "IN_EFFECT", effectiveFrom: "2026-09-15", effectiveTo: null },
              { label: "2026.1", state: "SUPERSEDED", effectiveFrom: "2026-07-01", effectiveTo: "2026-09-14" },
            ],
            failure: null,
          },
        },
      );
    case "kind-unknown":
      return failure("DOCUMENT_KIND_UNKNOWN", false);
  }
}

const DISCLOSURES_SERVED_AT = "2026-09-30T10:20:00+07:00";
const SECTION_ANSWERED_AT = "2026-09-30T10:20:04+07:00";

/**
 * The reports and disclosures as their owners released them (SCR-PUB-11): the audited financial report for 2025 on
 * 15 April 2026, the tariff publication on 20 June, the mandate list on 1 July, the cost position to 30 June on
 * 20 July (12.1 % against a ceiling of 15 %); the pilot report is not released.
 */
const REPORT_RELEASES: Readonly<Record<ReportKind, Omit<ReportDisclosure, "state"> | null>> = {
  AUDITED_FINANCIAL_REPORT: { releasedOn: "2026-04-15", year: 2025, cost: null },
  PILOT_REPORT: null,
  TARIFF_PUBLICATION: { releasedOn: "2026-06-20", year: null, cost: null },
  MANDATE_LIST: { releasedOn: "2026-07-01", year: null, cost: null },
  COST_POSITION: { releasedOn: "2026-07-20", year: null, cost: { periodEnd: "2026-06-30", ratioPercent: 12.1, ceilingPercent: 15, approvedOn: "2026-07-20" } },
};

/** Each report as at a day: released when its owner released it on or before that day, else not released yet. */
export function reportsAsAt(day: string): DisclosuresPage["reports"] {
  return REPORT_KINDS.map((kind) => {
    const release = REPORT_RELEASES[kind];
    const data: ReportDisclosure =
      release !== null && release.releasedOn !== null && release.releasedOn <= day
        ? { state: "RELEASED", ...release }
        : { state: "NOT_RELEASED", releasedOn: null, year: null, cost: null };
    return { kind, answer: { data, failure: null } };
  });
}

/** SCR-PUB-11's populated and superseded views: TV-2026.1 (or TV-2026.0 as at 15 June 2026), the amnesty of 2026 released. */
function releasedDisclosures(asAt: string | null, superseded: boolean): DisclosuresPage {
  const version = TARIFF_VERSIONS[superseded ? 0 : 1];
  const current = TARIFF_VERSIONS[1];
  return {
    asAt,
    servedAt: DISCLOSURES_SERVED_AT,
    instantRefused: null,
    unknownDisclosure: null,
    tariff:
      version === undefined || current === undefined
        ? NOT_OFFERED
        : {
            data: {
              state: superseded ? "SUPERSEDED" : "IN_EFFECT",
              version: version.version,
              effectiveFrom: version.effectiveFrom,
              effectiveTo: version.effectiveTo,
              current: superseded ? { version: current.version, effectiveFrom: current.effectiveFrom } : null,
              ...version.publication,
              sourceAnsweredAt: "2026-09-30T10:20:02+07:00",
            },
            failure: null,
          },
    amnesty: {
      data: { state: "RELEASED", version: "AMV-2026-1", period: { from: "2026-07-01", to: "2026-12-31" }, approvedAt: null, sourceAnsweredAt: SECTION_ANSWERED_AT },
      failure: null,
    },
    reports: reportsAsAt("2026-09-30"),
  };
}

/** SCR-PUB-11's P1 view: the tariff and the reports not offered by their owners, the amnesty approved and announced. */
function p1Disclosures(): DisclosuresPage {
  return {
    asAt: null,
    servedAt: DISCLOSURES_SERVED_AT,
    instantRefused: null,
    unknownDisclosure: null,
    tariff: NOT_OFFERED,
    amnesty: { data: { state: "NOT_RELEASED", ...AMNESTY, sourceAnsweredAt: SECTION_ANSWERED_AT }, failure: null },
    reports: REPORT_KINDS.map((kind) => ({ kind, answer: NOT_OFFERED })),
  };
}

export function mockDisclosures(view: Exclude<Pub11View, "loading">): LoadOutcome<DisclosuresPage> {
  const p1 = p1Disclosures();
  switch (view) {
    case "p1":
      return { data: p1, failure: null };
    case "populated":
      return { data: releasedDisclosures(null, false), failure: null };
    case "superseded":
      return { data: releasedDisclosures("2026-06-15", true), failure: null };
    case "instant-invalid":
      return { data: { ...p1, instantRefused: "2026-10-15" }, failure: null };
    case "kind-unknown":
      return { data: { ...p1, unknownDisclosure: "annual-report" }, failure: null };
    case "error":
      return failure("INTERNAL_ERROR", true, "9a27c5e1f04b6d38");
  }
}

const route = (purpose: HelpPurpose, destinationKind: HelpRouteItem["destinationKind"], destination: string, responsible: HelpResponsible, confirmedOn: string, replaced = false): HelpRouteItem => ({
  purpose,
  destinationKind,
  destination,
  responsible,
  confirmedOn,
  replacedByAuthoritativeContact: replaced,
  publicAccess: true,
});

const OFFICE = route("authoritative", "EMAIL", "lienhe@rightone.vn", "office", "2026-09-01");

/** SCR-PUB-12 beyond P1: the complaint route confirmed again on 30 September and DAT's privacy notice offered. */
const CONFIRMED_ROUTES: readonly HelpRouteItem[] = [
  route("support", "PHONE", "1900 2468 13", "support", "2026-09-12"),
  route("complaint", "URL", "rightone.vn/khieu-nai", "complaints", "2026-09-30"),
  route("correction", "URL", "rightone.vn/dinh-chinh", "corrections", "2026-09-15"),
  OFFICE,
  route("privacy_information", "NOTICE", "privacy-notice", "dpo", "2026-09-15"),
  route("privacy_rights", "EMAIL", "baovedulieu@rightone.vn", "dpo", "2026-09-15"),
];

export function mockHelpJourney(view: Exclude<Pub12View, "loading">): LoadOutcome<readonly HelpRouteItem[]> {
  switch (view) {
    case "p1-partial":
      return {
        data: CONFIRMED_ROUTES.map((item) =>
          item.purpose === "complaint" || item.purpose === "privacy_information" ? { ...OFFICE, purpose: item.purpose, replacedByAuthoritativeContact: true } : item,
        ),
        failure: null,
      };
    case "populated":
      return { data: CONFIRMED_ROUTES, failure: null };
    case "journey-unknown":
      return failure("JOURNEY_UNKNOWN", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "41d8be03c7a5926f");
  }
}

const GUIDE_2026_1: VersionedText = {
  version: { label: "2026.1", state: "IN_EFFECT", effectiveFrom: "2026-09-15", effectiveTo: null, sectionKeys: PLAYER_GUIDE_SECTIONS, sections: [], digest: null },
  asAt: null,
  current: null,
  upcoming: null,
};

const PLAYER_ROUTES: readonly HelpRouteItem[] = [
  route("support", "PHONE", "1900 2468 13", "support", "2026-09-12"),
  route("player_guide", "URL", "rightone.vn/huong-dan/player", "support", "2026-09-20"),
];

export function mockPlayerGuide(view: Exclude<Pub13View, "loading">): PlayerGuidePage {
  const routes = { data: PLAYER_ROUTES, failure: null };
  switch (view) {
    case "populated":
      return { guide: { data: GUIDE_2026_1, failure: null }, routes };
    case "routes-unread":
      return { guide: { data: GUIDE_2026_1, failure: null }, routes: failure("INTERNAL_ERROR", true) };
    case "empty":
      return { guide: { data: { version: null, asAt: "2026-09-01", current: null, upcoming: null }, failure: null }, routes };
    case "instant-invalid":
      return { guide: failure("INSTANT_INVALID", false), routes };
    case "error":
      return { guide: failure("INTERNAL_ERROR", true, "c25e8f17a0d34b96"), routes };
  }
}
