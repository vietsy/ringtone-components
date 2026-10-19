import type { LoadOutcome } from "@rightone/ui";
import type { HelpJourney, LegalDocumentSlug } from "@/lib/route-groups/public-pages";
import {
  aboutPage,
  artistProfile,
  assessScope,
  confirmHelpRoute,
  createHelpRoute,
  currencyWatches,
  decideVersion,
  disclosuresAt,
  documentList,
  documentVersion,
  draftVersion,
  editHelpRoute,
  helpRouteList,
  helpRouteRegister,
  helpRoutes,
  indicateAmount,
  indicativeOffered,
  legalDocument,
  legalDocumentVersions,
  newVersionForm,
  pageVersions,
  playerGuide,
  publicPage,
  publicTrack,
  retireHelpRoute,
  saveVersion,
  scopeQuestions,
  submitVersion,
  verifyDirectRecord,
  verifyServiceEntitlement,
  withdrawVersion,
  type PolicyActor,
} from "@/lib/mock/backend/public";
import { countAssessment, countVerification } from "@/lib/mock/backend/oversight";
import {
  mockAboutPage,
  mockArtistProfile,
  mockDirectRecord,
  mockDisclosures,
  mockHelpJourney,
  mockIndicativeAmount,
  mockLegalLibrary,
  mockPlayerGuide,
  mockPublicTrack,
  mockScopeAssessment,
  mockServiceEntitlement,
  type Pub01View,
  type Pub02View,
  type Pub03View,
  type Pub06View,
  type Pub07View,
  type Pub08View,
  type Pub09View,
  type Pub10View,
  type Pub11View,
  type Pub12View,
  type Pub13View,
} from "@/lib/mock/public";
import { currentWorld, type Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";
import { requesterAddress } from "./verification";

/** A route to help from the help route register, with the day RightOne last confirmed it. */
export interface HelpRoute {
  kind: "support_line" | "contact_email";
  value: string;
  confirmedOn: string;
}

/** The rights a participating organisation represents, and the tariff's component for each. */
export type RightsKind = "works" | "producers" | "performers";

export interface ParticipatingOrganisation {
  key: string;
  name: string;
  /** How the legal-basis section names it. */
  shortName: string;
  rights: RightsKind;
}

export interface PageVersion {
  version: string;
  effectiveFrom: string;
}

/** The "What RightOne is" page (`ABOUT`) in the version that applies at the instant read. */
export interface AboutPage {
  version: string;
  /** Null when the page is read as at an instant and the canvas gives only that instant. */
  effectiveFrom: string | null;
  /** The last day the version applied, for one superseded since; null while it is in effect. */
  effectiveTo: string | null;
  /** The instant asked for, when the page is read in its history; null for the version in effect. */
  asAt: string | null;
  /** The version now in effect, when the one shown has been superseded. */
  current: PageVersion | null;
  upcoming: PageVersion | null;
  /**
   * The edition's own text by its sections, as the policy console published it; empty for a version whose text the
   * canvas writes into the page's catalogue rather than into the register.
   */
  sections: readonly LegalSection[];
  /** An approved version of a source exists that this text does not describe yet (`newer_approved_version_exists`). */
  newerApprovedVersionExists: boolean;
  /** The source kinds with such a version, in the order the document names them; empty when read as at an instant. */
  newerApprovedSources: readonly SourceKind[];
  /** The instant the page was served. */
  servedAt: string;
  operator: string;
  /** Null while no organisation is designated as the collection authority. */
  collector: string | null;
  /** Null while RightOne does not offer the section; nothing older and no draft stands in for it. */
  basis: { instrumentSignedOn: string; coverage: readonly ParticipatingOrganisation[] } | null;
  participants: readonly ParticipatingOrganisation[] | null;
}

/** `page` is null when no version existed at the instant asked (NO_VERSION_AT_INSTANT): an answer, not a failure. */
export interface AboutPageAnswer {
  page: AboutPage | null;
}

export type PremisesClass = "cafe" | "bar" | "shop";
export type AdminArea = "hcm" | "hn" | "dn" | "ct" | "hue";

/** The two class kinds of the tariff, as TAR names them; either left without a class leaves the treatment open. */
export type ClassKind = "PREMISES_CLASS" | "ADMIN_AREA_KEY";

/** A question of the form, by the name the API takes it under. */
export type FactField = "assessment_date" | "premises_class" | "admin_area_key" | "floor_area_m2" | "seating_capacity";

/**
 * A question of the tariff beside its two class kinds, derived from the version (`GET /scope-questions`): the floor
 * area, required because the size bands use it, and the seating capacity, which only the exemption's criteria use.
 */
export interface ScopeFact {
  key: "FLOOR_AREA_M2" | "SEATING_CAPACITY";
  required: boolean;
}

/** The questions the tariff in effect on the assessment date asks (`GET /scope-questions`). */
export interface ScopeQuestions {
  assessmentDate: string;
  /** Null when no approved tariff applies on the date: there is nothing to ask. */
  questions: { premisesClasses: readonly PremisesClass[]; adminAreas: readonly AdminArea[]; facts: readonly ScopeFact[] } | null;
}

/** What the reader declared, drawn back into the form as typed; null or an empty string is a question left unanswered. */
export interface DeclaredPremises {
  /** An ISO date; empty when what was typed is not a date. */
  assessmentDate: string;
  premisesClass: PremisesClass | null;
  adminArea: AdminArea | null;
  floorAreaM2: string;
  seats: string;
}

/** The facts an answer was worked out from, as the service read them. */
export interface AssumedPremises {
  premisesClass: PremisesClass | null;
  adminArea: AdminArea | null;
  floorAreaM2: number;
  seats: number | null;
}

/** A floor-area band of the tariff: from its lower bound, up to but not including its upper one (none for the last). */
export interface SizeBand {
  fromM2: number;
  toM2: number | null;
}

/** How the tariff classified the declared facts: TAR's classification path, the basis of an answer. */
export interface ClassificationPath {
  premisesClass: PremisesClass | null;
  adminArea: AdminArea | null;
  /** The locality class the tariff gives the area; null when it gives none. */
  localityClass: number | null;
  band: SizeBand;
  /** The class kinds the tariff could not classify, which leave the treatment undetermined. */
  unclassified: readonly ClassKind[];
}

/** An exemption the tariff tested: each criterion with the fact read and whether it was met. */
export interface ExemptionTested {
  code: "MICRO_BUSINESS";
  applied: boolean;
  criteria: readonly { fact: "FLOOR_AREA_M2" | "SEATING_CAPACITY"; atMost: number; value: number | null; met: boolean }[];
}

/**
 * What to do next: the section of the scope guide for the treatment (register; no registration needed; apply
 * and an officer decides), or the support line when the guidance has no answer.
 */
export type NextAction = "register" | "no-registration" | "apply" | "support";

/** Guidance on whether the service applies (`POST /scope-assessments`). Never a decision about an obligation. */
export interface ScopeAnswer {
  outcome: "in_scope" | "out_of_scope" | "indeterminate";
  /** Why an indeterminate answer reached no tariff at all; null when the tariff's classes decided it. */
  cause: "NO_RULES_FOR_DATE" | "GUIDANCE_UNAVAILABLE" | null;
  assessmentDate: string;
  tariffVersion: string | null;
  /** Null when no tariff was reached. */
  basis: ClassificationPath | null;
  assumed: AssumedPremises | null;
  exemptions: readonly ExemptionTested[];
  /** The treatment's section of the scope guide in effect, or the support route where no guide is in effect (`DR-491`). */
  nextAction: NextAction;
  /** That section's approved text; null for the support route, and in a review view drawn with the catalogue's words. */
  nextActionText: LocalizedText | null;
  /** The label of the scope guide version the next action was read from. */
  guideVersion: string | null;
}

/** A refused or answered "Xem kết quả" or "Tính số tiền": what was declared, the answer, and the fields a refusal names. */
export interface Attempt<T> {
  declared: DeclaredPremises;
  answer: LoadOutcome<T>;
  /** With ASSESSMENT_INPUT_INVALID: the fields to correct. */
  invalid: readonly FactField[];
}

export interface ScopeAssessmentPage {
  questions: ScopeQuestions;
  declared: DeclaredPremises;
  /** The answer to the last "Xem kết quả", or its refusal; null before one is asked. */
  assessment: LoadOutcome<ScopeAnswer> | null;
  invalid: readonly FactField[];
}

export interface IndicatedAmount {
  outcome: "indicated";
  tariffVersion: string;
  assessmentDate: string;
  period: { from: string; to: string };
  transitionRule: "FROM_NEXT_MONTH";
  currency: string;
  basis: ClassificationPath;
  assumed: AssumedPremises;
  exemptions: readonly ExemptionTested[];
  components: readonly { right: RightsKind; treatment: "charged" | "exempt"; amountMinor: number }[];
  amountBeforeCapMinor: number;
  capMinor: number;
  capApplied: boolean;
  roundingUnitMinor: number;
  amountBeforeRoundingMinor: number;
  amountMinor: number;
}

export type IndicativeResult =
  | IndicatedAmount
  /** The premises is not shown to be in scope, so there is no amount to indicate, and never 0. */
  | { outcome: "no_amount"; treatment: "out_of_scope" | "indeterminate"; nextAction: NextAction };

export interface IndicativeAmountPage {
  questions: ScopeQuestions;
  declared: DeclaredPremises;
  /** The answer to the last "Tính số tiền", or its refusal; null before one is asked. */
  calculation: LoadOutcome<IndicativeResult> | null;
  invalid: readonly FactField[];
}

/** The facts as the form sends them: text as typed, an empty string for a question left unanswered. */
export interface FormFacts {
  assessmentDate: string;
  premisesClass: string;
  adminArea: string;
  floorAreaM2: string;
  seats: string;
}

/**
 * The support line and the authoritative contact of the help route register (SCR-PUB-18), read by the pages that
 * offer the one way to help they need (SCR-PUB-01, 02, 03), from the register as this browser's world holds it.
 */
export async function loadHelpRoutes(): Promise<LoadOutcome<readonly HelpRoute[]>> {
  return usesMockData() ? helpRoutes(await currentWorld()) : NOT_CONFIGURED;
}

/**
 * SCR-PUB-01 reads `GET /pages/ABOUT` from this browser's world, at the request instant or as at `at` (a date chosen in
 * the page's history, SCR-PUB-10): the version that applies, with its text, as the policy console published it. A
 * review `view` returns the canvas's state for it. A request for an invalid instant is a refusal with its code.
 */
export async function loadAboutPage(view: Exclude<Pub01View, "loading"> | null, at?: string): Promise<LoadOutcome<AboutPageAnswer>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  return view !== null ? mockAboutPage(view) : aboutPage(await currentWorld(), asked(at));
}

/**
 * `GET /pages/{kind}` for the pages no screen of their own draws whole: the tariff explanation SCR-PUB-11 shows above the
 * tariff, the help page SCR-PUB-12 shows above the routes; as in effect now, or as at `at`.
 */
export async function loadPublicPage(kind: PageKind, at?: string): Promise<LoadOutcome<PublicPageAnswer>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  return publicPage(await currentWorld(), kind, asked(at));
}

const blank = (assessmentDate: string): DeclaredPremises => ({
  assessmentDate,
  premisesClass: null,
  adminArea: null,
  floorAreaM2: "",
  seats: "",
});

/**
 * SCR-PUB-02 reads the scope questions (`GET /scope-questions`) for the assessment date of the reader's last assessment,
 * so the questions are those of the tariff that applies on the date they stated, or for today before one is asked;
 * the last assessment is kept by the form. The self-assessment not being offered (GUIDANCE_UNAVAILABLE) is a failure
 * with its code, never an empty form.
 */
export function loadScopeAssessment(
  view: Exclude<Pub02View, "loading" | "checking"> | null,
  last: Attempt<ScopeAnswer> | null,
): Promise<LoadOutcome<ScopeAssessmentPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view !== null) return Promise.resolve(mockScopeAssessment(view));
  const questions = scopeQuestions(last?.declared.assessmentDate ?? null);
  if (questions.data === null) return Promise.resolve({ data: null, failure: questions.failure });
  return Promise.resolve({
    data: {
      questions: questions.data,
      declared: last?.declared ?? blank(questions.data.assessmentDate),
      assessment: last?.answer ?? null,
      invalid: last?.invalid ?? [],
    },
    failure: null,
  });
}

/**
 * SCR-PUB-03 reads the same questions, with the last calculation kept by the form. A calculation the
 * configuration does not offer (INDICATIVE_NOT_OFFERED) refuses the page before any question is asked.
 */
export function loadIndicativeAmount(
  view: Exclude<Pub03View, "loading"> | null,
  last: Attempt<IndicativeResult> | null,
  carried: Readonly<Record<string, string | string[] | undefined>> = {},
): Promise<LoadOutcome<IndicativeAmountPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view !== null) return Promise.resolve(mockIndicativeAmount(view));
  if (!indicativeOffered()) return Promise.resolve({ data: null, failure: { code: "INDICATIVE_NOT_OFFERED", traceId: null, retryable: false } });
  const questions = scopeQuestions();
  if (questions.data === null) return Promise.resolve({ data: null, failure: questions.failure });
  return Promise.resolve({
    data: {
      questions: questions.data,
      declared: last?.declared ?? carriedFacts(carried, questions.data) ?? blank(questions.data.assessmentDate),
      calculation: last?.answer ?? null,
      invalid: last?.invalid ?? [],
    },
    failure: null,
  });
}

/**
 * "Xem kết quả": `POST /scope-assessments` with the facts as declared, answered with the next action of this browser's
 * scope guide in effect. Nothing declared is kept by the service.
 */
export async function requestScopeAssessment(facts: FormFacts): Promise<LoadOutcome<Attempt<ScopeAnswer>>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  const world = await currentWorld();
  // Counted, as every public answer is, for the oversight console's outcome counts (ALG-463, SCR-PUB-19).
  return { data: countAssessment(world, "SCOPE_ASSESSMENT", assessScope(world, facts)), failure: null };
}

/** "Tính số tiền": `POST /indicative-amounts` with the facts as declared. Nothing declared is kept by the service. */
export async function requestIndicativeAmount(facts: FormFacts): Promise<LoadOutcome<Attempt<IndicativeResult>>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  return { data: countAssessment(await currentWorld(), "INDICATIVE_AMOUNT", indicateAmount(facts)), failure: null };
}

/**
 * The facts a self-assessment carries to the indicative amount (SCR-PUB-02's "Ước tính số tiền"), so the reader
 * does not type them twice. Only answers the questions offer are taken; anything else leaves the question open.
 */
function carriedFacts(params: Readonly<Record<string, string | string[] | undefined>>, questions: ScopeQuestions): DeclaredPremises | null {
  const one = (name: string): string => {
    const value = params[name];
    return typeof value === "string" ? value : "";
  };
  if (one("premises_class") === "" && one("admin_area_key") === "") return null;
  const classes: readonly string[] = questions.questions?.premisesClasses ?? [];
  const areas: readonly string[] = questions.questions?.adminAreas ?? [];
  return {
    assessmentDate: /^\d{4}-\d{2}-\d{2}$/.test(one("assessment_date")) ? one("assessment_date") : questions.assessmentDate,
    premisesClass: classes.includes(one("premises_class")) ? (one("premises_class") as PremisesClass) : null,
    adminArea: areas.includes(one("admin_area_key")) ? (one("admin_area_key") as AdminArea) : null,
    floorAreaM2: one("floor_area_m2"),
    seats: one("seating_capacity"),
  };
}


// ---------------------------------------------------------------- the public web beyond the certificate (SCR-PUB-06 to 13)

/** Why a verification could not tell (`04-refusal-codes.md`, the causes of an inability), said in words after it. */
export type UnableCause = "SOURCE_NOT_OFFERED" | "STATUS_SOURCE_UNAVAILABLE" | "SOURCE_TIMEOUT";

/**
 * A verification route's answer, or its refusal with its code. Too many lookups (VERIFICATION_RATE_LIMITED) also
 * says when the requester may look up again; every other outcome carries null there.
 */
export interface PublicVerificationOutcome<T> extends LoadOutcome<T> {
  retryAfter: string | null;
}

/** The public word of a Player service entitlement's status (`DR-485`): never a word of the certificate's. */
export type ServiceStatusWord =
  | "SERVICE_ACTIVE"
  | "SERVICE_RESTRICTED"
  | "SERVICE_SUSPENDED"
  | "SERVICE_PENDING_TERMS"
  | "SERVICE_ENDED_AT_REQUEST"
  | "SERVICE_ENDED_OUT_OF_SCOPE"
  | "SERVICE_REVOKED";

/** The kind of business the Player route names, by VEN's classification of the premises. */
export type PlayerBusinessType = "cafe" | "karaoke" | "bakery" | "restaurant";

/**
 * The answer for the code printed on a RightOne Player verification document (`GET /verifications/
 * service-entitlements/{reference}`): the entitlement and its status, that no entitlement matches the code, or
 * that the service could not tell. The minimum profile of BR-PUB-11: premises name, business type, locality,
 * entitlement reference and status; never the telephone, the street address or the owner.
 */
export interface ServiceEntitlementAnswer {
  outcome: "record" | "absent" | "unable";
  /** The code as printed, which the reader checks against the paper. */
  printedCode: string;
  sourceAnsweredAt: string | null;
  attemptEndedAt: string | null;
  cause: UnableCause | null;
  /**
   * The status and the entitlement reference are the answer itself; each other field is carried only where the
   * disclosure profile in effect at the query instant admits it (`DR-486`), and a field withheld is absent, never empty.
   */
  entitlement: {
    statusWord: ServiceStatusWord;
    premisesName?: string;
    /** Null where VEN holds no classification for the premises (`NOT_AVAILABLE`). */
    businessType?: PlayerBusinessType | null;
    /** The province or city, the locality level the profile admits. */
    locality?: AdminArea;
    reference: string;
    /** The reference of this answer, for a person to quote in a correction request. */
    answerRef: string;
  } | null;
}

/** The two routes of SCR-PUB-07: a direct licence of a track (LIC), or the proof of an evidence set (EVD). */
export type DirectRecordRoute = "licence" | "proof";

/**
 * The answer for a direct licence or a proof. Neither owner offers a public reader yet (`CR-PUB-02`), so the
 * route answers that it could not tell, with the cause, and never that no record exists.
 */
export interface DirectRecordAnswer {
  route: DirectRecordRoute;
  outcome: "unable";
  reference: string;
  attemptEndedAt: string;
  cause: UnableCause;
}

/** What a lookup typed on SCR-PUB-04 for a Player document or a licence answered, kept for the page it lands on. */
export type DocumentLookupAttempt =
  | { route: "player"; typed: string; asked: string; outcome: PublicVerificationOutcome<ServiceEntitlementAnswer> }
  | { route: DirectRecordRoute; typed: string; asked: string; outcome: PublicVerificationOutcome<DirectRecordAnswer> };

/** An artist's display profile (`GET /artists/{slug}`): the fields `DR-486` admits, no legal name or contact. */
export interface ArtistProfile {
  slug: string;
  displayName: string;
  /** Beyond the minimum: shown only where an approved profile admits it. */
  biography: string | null;
  repertoire: readonly { id: string; title: string; durationSeconds: number }[];
}

/** A public track page (`GET /tracks/{id}`) with its preview; `previewPublic` false is ASSET_NOT_PUBLIC for the preview alone. */
export interface PublicTrack {
  id: string;
  title: string;
  artist: { slug: string; displayName: string };
  durationSeconds: number;
  previewSeconds: number;
  previewPublic: boolean;
  /** The direct licence of the track, which "Kiểm tra giấy phép" looks up. */
  licenceReference: string;
}

export type LegalDocumentKind = "PREMISES_SERVICE_TERMS" | "ARTIST_TERMS" | "RIGHTS_WITHDRAWAL" | "TAKEDOWN_PROCESS" | "PRIVACY_NOTICE";

/** A public page (`GET /pages/{kind}`): the five documents of class `PAGE`. */
export type PageKind = "ABOUT" | "SCOPE_GUIDE" | "TARIFF" | "HELP" | "PLAYER_GUIDE";

/** A published version and where it stands at the instant read (`SM-455`, `DR-487`). */
export interface VersionPeriod {
  label: string;
  state: "UPCOMING" | "IN_EFFECT" | "SUPERSEDED";
  effectiveFrom: string;
  /** The last day it applied; null while no later version is published. */
  effectiveTo: string | null;
}

/** Text a document carries in both languages, as its owner wrote it. */
export interface LocalizedText {
  vi: string;
  en: string;
}

/** A section of a legal document's text. */
export interface LegalSection {
  id: string;
  heading: LocalizedText;
  body: LocalizedText;
}

/**
 * A version's text: a legal document's sections as written, or a public page's parts by the keys the catalogue words
 * (the Player guide); with the digest of the text that took effect.
 */
export interface VersionText extends VersionPeriod {
  sectionKeys: readonly string[];
  sections: readonly LegalSection[];
  digest: string | null;
}

/**
 * A document or page in the version that applies at the instant asked. `version` is null when none applied then
 * (NO_VERSION_AT_INSTANT): an answer, not a failure.
 */
export interface VersionedText {
  version: VersionText | null;
  /** The instant asked for; null for the version in effect today. */
  asAt: string | null;
  /** The version in effect today, when the one shown has been superseded. */
  current: VersionPeriod | null;
  upcoming: VersionPeriod | null;
}

/**
 * `GET /pages/{kind}`: a public page in the version that applies at the instant asked (`text.version` null when none
 * did, NO_VERSION_AT_INSTANT), and the source kinds with an approved change its text does not describe yet, which is
 * empty when the page is read as at an instant (`ALG-464` step 4).
 */
export interface PublicPageAnswer {
  kind: PageKind;
  text: VersionedText;
  newerApprovedSources: readonly SourceKind[];
  servedAt: string;
}

/** SCR-PUB-10: one legal document, and the version list "Xem lịch sử" or "Lịch sử trang chính sách" asked for. */
export interface LegalLibraryPage {
  kind: LegalDocumentKind;
  document: LoadOutcome<VersionedText>;
  history: { of: "document" | "page"; versions: LoadOutcome<readonly VersionPeriod[]> } | null;
}

/**
 * The tariff as TAR publishes it (`GET /tariff`) for the day asked, with no premises and no calculation; or that no
 * tariff was approved for that day.
 */
export type PublicTariff = { state: "NO_APPROVED_TARIFF"; sourceAnsweredAt: string } | PublishedTariff;

export interface PublishedTariff {
  state: "IN_EFFECT" | "SUPERSEDED";
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** The version now in effect, when the one shown was asked for at an earlier date and has been replaced. */
  current: { version: string; effectiveFrom: string } | null;
  /** The number of the decision that approved the version. */
  instrumentNumber: string;
  components: readonly RightsKind[];
  /** By locality class, from class 1. */
  localityFactorsHundredths: readonly number[];
  capMinor: number;
  roundingUnitMinor: number;
  exemptionFloorAtMostM2: number;
  sourceAnsweredAt: string;
}

/** The amnesty period as REG releases it (`GET /disclosures/AMNESTY_PERIOD`). */
export interface AmnestyDisclosure {
  state: "RELEASED" | "NOT_RELEASED";
  version: string;
  period: { from: string; to: string };
  /** When the version was approved, for one announced before it is released. */
  approvedAt: string | null;
  sourceAnsweredAt: string;
}

export type ReportKind = "AUDITED_FINANCIAL_REPORT" | "PILOT_REPORT" | "TARIFF_PUBLICATION" | "MANDATE_LIST" | "COST_POSITION";

/** A report or another disclosure as its owner released it; the cost position carries its ratio to the ceiling. */
export interface ReportDisclosure {
  state: "RELEASED" | "NOT_RELEASED";
  releasedOn: string | null;
  /** For the audited financial report: the year it covers. */
  year: number | null;
  cost: { periodEnd: string; ratioPercent: number; ceilingPercent: number; approvedOn: string } | null;
}

/**
 * SCR-PUB-11. Each section is its owner's answer, so one owner that cannot answer leaves the others shown. `at` is
 * the date the page was asked as at; one that has not come yet or is not a date comes back as `instantRefused`,
 * and the sections are read as at today.
 */
export interface DisclosuresPage {
  asAt: string | null;
  servedAt: string;
  instantRefused: string | null;
  /** A disclosure the address asked to open that does not exist (DISCLOSURE_KIND_UNKNOWN), as asked. */
  unknownDisclosure: string | null;
  tariff: LoadOutcome<PublicTariff>;
  amnesty: LoadOutcome<AmnestyDisclosure>;
  reports: readonly { kind: ReportKind; answer: LoadOutcome<ReportDisclosure> }[];
}

/** What a help route is for, in the order the public pages list them. */
export type HelpPurpose =
  | "support"
  | "complaint"
  | "correction"
  | "authoritative"
  | "privacy_information"
  | "privacy_rights"
  | "external_escalation"
  | "player_guide";

/** Who answers a route: an organisation or a role, never a person. */
export type HelpResponsible = "support" | "complaints" | "corrections" | "office" | "dpo";

/**
 * The responsible destination a route names: one the catalogue words in both languages, or the name an operations
 * officer typed on SCR-PUB-18, shown as typed.
 */
export type HelpResponsibleDestination = HelpResponsible | { name: string };

/** How a route is reached; a notice is a published document the route opens (DAT's privacy notice). */
export type HelpDestinationKind = "PHONE" | "EMAIL" | "URL" | "POSTAL" | "NOTICE";

/**
 * One route a public journey offers (`GET /help-routes`), with the day it was last confirmed. Where the register
 * holds no confirmed route for a purpose, the authoritative contact stands in its place and says so.
 */
export interface HelpRouteItem {
  purpose: HelpPurpose;
  destinationKind: HelpDestinationKind;
  destination: string;
  responsible: HelpResponsibleDestination;
  confirmedOn: string;
  replacedByAuthoritativeContact: boolean;
  /** False for a route that needs a sign-in: it is shown, saying so (`public_access`). */
  publicAccess: boolean;
}

/** SCR-PUB-13: the Player guide in the version that applies, and the help routes of the journey PLAYER. */
export interface PlayerGuidePage {
  guide: LoadOutcome<VersionedText>;
  routes: LoadOutcome<readonly HelpRouteItem[]>;
}

const DMY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** A date as a date field sends it (an ISO date, or day/month/year as typed), as an ISO date; the text as given otherwise. */
function isoDate(text: string): string {
  const dmy = DMY_DATE.exec(text);
  return dmy === null ? text : `${dmy[3]}-${(dmy[2] ?? "").padStart(2, "0")}-${(dmy[1] ?? "").padStart(2, "0")}`;
}

const asked = (text: string | undefined): string | null => (text === undefined || text.trim() === "" ? null : isoDate(text.trim()));

/**
 * SCR-PUB-06 reads the code printed on a Player verification document once, counted against the requester's
 * volume, from this browser's world: an entitlement the premises portal issued a document for answers here.
 */
export async function lookUpPlayerCode(printedCode: string): Promise<PublicVerificationOutcome<ServiceEntitlementAnswer>> {
  if (!usesMockData()) return { ...NOT_CONFIGURED, retryAfter: null };
  // Every answer and refusal is counted for the oversight console's outcome counts (ALG-455 step 8, SCR-PUB-19).
  const world = await currentWorld();
  return countVerification(world, "PLAYER_SERVICE_ENTITLEMENT", verifyServiceEntitlement(world, printedCode, await requesterAddress()));
}

/** SCR-PUB-06's read. A review `view` returns the canvas's state for it; null looks the code up. */
export function loadPlayerVerification(printedCode: string, view: Exclude<Pub06View, "checking"> | null): Promise<PublicVerificationOutcome<ServiceEntitlementAnswer>> {
  if (!usesMockData()) return Promise.resolve({ ...NOT_CONFIGURED, retryAfter: null });
  return view !== null ? Promise.resolve(mockServiceEntitlement(printedCode, view)) : lookUpPlayerCode(printedCode);
}

/** SCR-PUB-07 asks the one route its address names, never both: each absence counts toward the pattern control. */
export async function lookUpDirectRecord(route: DirectRecordRoute, reference: string): Promise<PublicVerificationOutcome<DirectRecordAnswer>> {
  if (!usesMockData()) return { ...NOT_CONFIGURED, retryAfter: null };
  const answer = verifyDirectRecord(route, reference, await requesterAddress());
  return countVerification(await currentWorld(), route === "proof" ? "EVIDENCE_PROOF" : "DIRECT_LICENCE", answer);
}

/** SCR-PUB-07's read. A review `view` returns the canvas's state for it; null looks the reference up. */
export function loadDirectRecord(
  route: DirectRecordRoute,
  reference: string,
  view: Exclude<Pub07View, "checking"> | null,
): Promise<PublicVerificationOutcome<DirectRecordAnswer>> {
  if (!usesMockData()) return Promise.resolve({ ...NOT_CONFIGURED, retryAfter: null });
  return view !== null ? Promise.resolve(mockDirectRecord(view)) : lookUpDirectRecord(route, reference);
}

/** SCR-PUB-08 reads `GET /artists/{slug}`. A source that offers no reader is SOURCE_UNAVAILABLE, never an empty profile. */
export function loadArtistProfile(slug: string, view: Exclude<Pub08View, "loading"> | null): Promise<LoadOutcome<ArtistProfile>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockArtistProfile(view) : artistProfile(slug));
}

/** SCR-PUB-09 reads `GET /tracks/{id}`; the preview's own refusal (ASSET_NOT_PUBLIC) is part of the answer. */
export function loadPublicTrack(id: string, view: Exclude<Pub09View, "loading"> | null): Promise<LoadOutcome<PublicTrack>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockPublicTrack(view) : publicTrack(id));
}

/** Each legal document's address, in the order SCR-PUB-10's list names them. */
const LEGAL_SLUGS: Readonly<Record<LegalDocumentKind, LegalDocumentSlug>> = {
  PREMISES_SERVICE_TERMS: "premises-service-terms",
  ARTIST_TERMS: "artist-terms",
  RIGHTS_WITHDRAWAL: "rights-withdrawal",
  TAKEDOWN_PROCESS: "takedown-process",
  PRIVACY_NOTICE: "privacy-notice",
};

/** The documents SCR-PUB-10 offers, by address. */
export const LEGAL_DOCUMENTS: readonly LegalDocumentSlug[] = Object.values(LEGAL_SLUGS);

export const legalSlug = (kind: LegalDocumentKind): LegalDocumentSlug => LEGAL_SLUGS[kind];

export function isLegalDocument(slug: string): slug is LegalDocumentSlug {
  return (LEGAL_DOCUMENTS as readonly string[]).includes(slug);
}

/**
 * SCR-PUB-10 reads the document its address names (`GET /legal-documents/{kind}`), as in effect or as at `at`, and
 * the version list `history` asks for: the document's own, or the page "What RightOne is" (`GET /pages/ABOUT/versions`).
 * An address naming no document is DOCUMENT_KIND_UNKNOWN for the whole page.
 */
export async function loadLegalLibrary(
  slug: string,
  options: { at?: string | undefined; history?: string | undefined },
  view: Exclude<Pub10View, "loading"> | null,
): Promise<LoadOutcome<LegalLibraryPage>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  if (view !== null) return mockLegalLibrary(view);
  const kind = (Object.keys(LEGAL_SLUGS) as LegalDocumentKind[]).find((k) => LEGAL_SLUGS[k] === slug);
  if (kind === undefined) return { data: null, failure: { code: "DOCUMENT_KIND_UNKNOWN", traceId: null, retryable: false } };
  const world = await currentWorld();
  const history =
    options.history === "document"
      ? { of: "document" as const, versions: legalDocumentVersions(world, kind) }
      : options.history === "page"
        ? { of: "page" as const, versions: pageVersions(world, "ABOUT") }
        : null;
  return { data: { kind, document: legalDocument(world, kind, asked(options.at)), history }, failure: null };
}

/**
 * SCR-PUB-11 reads the tariff and each disclosure as at today, or as at the date asked; `open` is the disclosure
 * "Mở" asked for (`GET /disclosures/{kind}`), refused when no such disclosure exists.
 */
export function loadDisclosures(
  options: { at?: string | undefined; open?: string | undefined },
  view: Exclude<Pub11View, "loading"> | null,
): Promise<LoadOutcome<DisclosuresPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockDisclosures(view) : disclosuresAt(asked(options.at), options.open ?? null));
}

/** SCR-PUB-12 reads the routes of every journey, or of the one its address names (`GET /help-routes?journey=`). */
export async function loadHelpJourney(journey: string | undefined, view: Exclude<Pub12View, "loading"> | null): Promise<LoadOutcome<readonly HelpRouteItem[]>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  return view !== null ? mockHelpJourney(view) : helpRouteList(await currentWorld(), journey === undefined || journey === "" ? null : journey);
}

/** SCR-PUB-13 reads the guide (`GET /pages/PLAYER_GUIDE`) as in effect or as at `at`, and the routes of the journey PLAYER. */
export async function loadPlayerGuide(at: string | undefined, view: Exclude<Pub13View, "loading"> | null): Promise<LoadOutcome<PlayerGuidePage>> {
  if (!usesMockData()) return NOT_CONFIGURED;
  if (view !== null) return { data: mockPlayerGuide(view), failure: null };
  const world = await currentWorld();
  const journey: HelpJourney = "player";
  return { data: { guide: playerGuide(world, asked(at)), routes: helpRouteList(world, journey) }, failure: null };
}

// ---------------------------------------------------------------- the policy console and the help route register (SCR-PUB-14 to 18)

/** The nine public documents (`MIG-PUB-02`): five public pages and four RightOne Player legal documents. */
export type DocumentKind =
  | "ABOUT"
  | "SCOPE_GUIDE"
  | "TARIFF"
  | "HELP"
  | "PLAYER_GUIDE"
  | "PREMISES_SERVICE_TERMS"
  | "ARTIST_TERMS"
  | "RIGHTS_WITHDRAWAL"
  | "TAKEDOWN_PROCESS";

/** A page is written by the policy preparer and approved by the policy approver; a legal document by operations and legal. */
export type DocumentClass = "PAGE" | "LEGAL";

/** `SM-455`, stored. */
export type VersionStatus = "DRAFT" | "SUBMITTED" | "PUBLISHED" | "WITHDRAWN";

/** Where a published version stands at the instant read: derived from its effective instant (`ALG-457`), never stored. */
export type VersionPhase = "UPCOMING" | "IN_EFFECT" | "SUPERSEDED";

/** The sources whose approved changes the public service describes (`public_view.currency_watches`). */
export type SourceKind = "INSTRUMENT" | "MANDATES" | "PARTICIPANTS" | "TARIFF" | "AMNESTY";

/** A source version a document version describes. */
export interface SourceRef {
  kind: SourceKind;
  ref: string;
}

/** A version as a list names it. */
export interface VersionLine {
  id: string;
  label: string;
  status: VersionStatus;
  phase: VersionPhase | null;
  effectiveFrom: string | null;
  /** Null for a version the canvas gives no author for. */
  draftedBy: string | null;
  savedAt: string;
  submittedAt: string | null;
}

/**
 * A document with the versions `GET /documents` answers for it: in effect, upcoming (the next first; a version approved
 * while another is still upcoming waits behind it), and the one open (draft or submitted).
 */
export interface DocumentRow {
  kind: DocumentKind;
  documentClass: DocumentClass;
  inEffect: VersionLine | null;
  upcoming: readonly VersionLine[];
  open: VersionLine | null;
}

/** What the reader's roles let them do with a document of each class (`DR-494`, `PERM-864` to `PERM-869`). */
export interface PolicyReader {
  drafts: readonly DocumentClass[];
  approves: readonly DocumentClass[];
  /** GOV's reserved decision `PUB-LEGAL-RELEASE` (`CFG-520`), needed to release or withdraw a released legal document. */
  releasesLegal: boolean;
}

/** The version filter of SCR-PUB-14: documents with a version in that state. */
export type DocumentStatusFilter = "DRAFT" | "SUBMITTED" | "WITHDRAWN";

export interface DocumentList {
  rows: readonly DocumentRow[];
  documents: number;
  awaitingApproval: number;
  filter: { documentClass: DocumentClass | null; status: DocumentStatusFilter | null };
  reader: PolicyReader;
}

/** A change a document must describe that the public service does not serve yet: an open or overdue watch. */
export interface AwaitedChange {
  kind: SourceKind;
  ref: string;
  status: "OPEN" | "OVERDUE";
  dueAt: string;
}

/** A section of the difference between the version in effect and the one read, by section key. */
export interface DifferenceRow {
  key: string;
  heading: LocalizedText;
  inEffect: LocalizedText | null;
  read: LocalizedText | null;
  changed: boolean;
}

/** The document's versions beside the one read, as SCR-PUB-14 lists them. */
export type DocumentStanding = Omit<DocumentRow, "kind" | "documentClass">;

/** `GET /document-versions/{id}`: the version whole, its document's rules, the difference from the version in effect. */
export interface VersionDetail {
  id: string;
  kind: DocumentKind;
  documentClass: DocumentClass;
  label: string;
  status: VersionStatus;
  phase: VersionPhase | null;
  /** The text as written; null where the canvas holds a published version's text in the page's own catalogue. */
  body: LocalizedText | null;
  /** The text by its sections, as a reader of the version is shown it. */
  sections: readonly LegalSection[];
  sectionKeys: readonly string[];
  requiredSections: readonly string[];
  sourceKinds: readonly SourceKind[];
  sourceRefs: readonly SourceRef[];
  effectiveFrom: string | null;
  digest: string | null;
  draftedBy: string | null;
  savedAt: string;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  lastDecision: "APPROVE" | "RETURN" | null;
  decisionReason: string | null;
  publishedAt: string | null;
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  standing: DocumentStanding;
  /**
   * Against the version in effect at the read, or, for the version in effect, the one it followed; `against` is null
   * when there is none, and `held` false when that version's text is written in its page rather than held here.
   */
  difference: { against: string | null; held: boolean; rows: readonly DifferenceRow[] };
  awaiting: readonly AwaitedChange[];
  reader: PolicyReader & { isAuthor: boolean };
}

/** SCR-PUB-15 opened from "Soạn phiên bản mới": the document's rules and the text a new version starts from. */
export interface NewVersionForm {
  kind: DocumentKind;
  documentClass: DocumentClass;
  requiredSections: readonly string[];
  sourceKinds: readonly SourceKind[];
  /** The latest published text, which the new version starts from, with its label and section keys; null when none is held. */
  startFrom: { label: string; body: LocalizedText; sectionKeys: readonly string[] } | null;
  suggestedLabel: string;
  standing: DocumentStanding;
  awaiting: readonly AwaitedChange[];
  reader: PolicyReader;
}

/** A command's refusal: its code, the field it concerns, and the values its sentence names. */
export interface PolicyRefusal {
  code: string;
  field: string | null;
  values: Readonly<Record<string, string>>;
}

export type PolicyAnswer<T> = { accepted: T; refusal: null } | { accepted: null; refusal: PolicyRefusal };

/** What a version's form sends: its label, its text, and the source versions it describes. */
export interface VersionInput {
  label: string;
  body: string;
  sources: readonly SourceRef[];
}

/** `SM-457`. */
export type WatchStatus = "OPEN" | "OVERDUE" | "REACHED" | "REACHED_LATE" | "CANCELLED";

/** One approved change to a source, from the instant the sweep saw it to the instant the public service first served it. */
export interface CurrencyWatch {
  id: string;
  sourceKind: SourceKind;
  versionRef: string;
  approvedAt: string | null;
  observedAt: string;
  measuredFrom: "APPROVAL" | "OBSERVATION" | "BASELINE";
  /** Null for a change read at use, which no document describes, and for a baseline. */
  dueAt: string | null;
  status: WatchStatus;
  reachedAt: string | null;
  /** The published version that served it. */
  reachedBy: { id: string; kind: DocumentKind; label: string } | null;
  overdueAt: string | null;
  reopenedAt: string | null;
  cancelledAt: string | null;
  cancelReason: "SOURCE_WITHDRAWN" | "SUPERSEDED" | null;
  /**
   * The reference COM returned for `NTF-PUB-01` to the policy owner; null while the raise has not succeeded, which is
   * repeated on each run of the sweep, and emptied when a withdrawal reopens the watch past its due instant.
   */
  noticeRef: string | null;
  /** Reached, or now while not reached, minus the start of the measure, never below 0; null for a baseline or a cancelled watch. */
  elapsedSeconds: number | null;
}

export interface CurrencyList {
  rows: readonly CurrencyWatch[];
  /** `CFG-515`. */
  periodHours: number;
  /** The sweep runs as the list is read, so its last run is the read. */
  sweptAt: string;
  filter: { status: WatchStatus | null; from: string | null; to: string | null };
}

/** A route of the help route register, every column the officer keeps (`public_view.help_routes`). */
export interface RegisterRoute {
  id: string;
  purpose: HelpPurpose;
  journeys: readonly HelpJourney[];
  destinationKind: Exclude<HelpDestinationKind, "NOTICE">;
  /** A web address is held without its https:// scheme, as the public pages write it. */
  destination: string;
  responsible: HelpResponsibleDestination;
  publicAccess: boolean;
  state: "active" | "unconfirmed" | "retired";
  confirmedAt: string;
  confirmedBy: string | null;
  unconfirmedReason: "CONFIRMATION_EXPIRED" | "CHECK_FAILED" | null;
  retiredAt: string | null;
  retiredBy: string | null;
  retirementReason: string | null;
  /** The only authoritative contact not retired: retiring it is refused LAST_AUTHORITATIVE_CONTACT. */
  lastAuthoritative: boolean;
}

export interface HelpRouteRegister {
  routes: readonly RegisterRoute[];
  counts: { all: number; active: number; unconfirmed: number; retired: number };
  filter: { state: RegisterRoute["state"] | null; purpose: HelpPurpose | null };
  /** `CFG-517`. */
  confirmationDays: number;
}

/** What a route's form sends: its purpose (new routes only), journeys, destination and the destination's answerer. */
export interface RouteInput {
  purpose: string;
  journeys: readonly string[];
  destinationKind: string;
  destination: string;
  responsible: HelpResponsibleDestination | null;
  publicAccess: boolean;
}

/** The console's review views: a state a board drew that a read does not reach on its own. */
export type PolicyView = "loading" | "error" | "not-authorised";

const reviewFailure = (view: Exclude<PolicyView, "loading">): LoadOutcome<never> =>
  view === "error"
    ? { data: null, failure: { code: "INTERNAL_ERROR", traceId: "62e0a9d4b17c5f38", retryable: true } }
    : { data: null, failure: { code: "NOT_AUTHORISED", traceId: null, retryable: false } };

/** The member of staff as the public service's commands see them: who acts, and the roles they hold. */
const actorOf = (staff: Staff): PolicyActor => ({ email: staff.email, name: staff.account, roles: staff.roles });

function read<T>(view: Exclude<PolicyView, "loading"> | null, run: () => LoadOutcome<T>): Promise<LoadOutcome<T>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? reviewFailure(view) : run());
}

function command<T>(run: () => PolicyAnswer<T>): Promise<PolicyAnswer<T>> {
  if (!usesMockData()) return Promise.resolve({ accepted: null, refusal: { code: "SERVICE_NOT_CONFIGURED", field: null, values: {} } });
  return Promise.resolve(run());
}

/** SCR-PUB-14 reads `GET /documents` with its filters; a cursor this list never issued is CURSOR_INVALID. */
export function loadPublicDocuments(
  staff: Staff,
  filter: { documentClass: DocumentClass | null; status: DocumentStatusFilter | null; cursor: string | null },
  view: Exclude<PolicyView, "loading"> | null,
): Promise<LoadOutcome<DocumentList>> {
  return read(view, () => documentList(staff.sessionId, actorOf(staff), filter));
}

/** SCR-PUB-15 opened from "Soạn phiên bản mới": nothing is read but the document, until "Tạo phiên bản" drafts it. */
export function loadNewVersionForm(staff: Staff, kind: string, view: Exclude<PolicyView, "loading"> | null): Promise<LoadOutcome<NewVersionForm>> {
  return read(view, () => newVersionForm(staff.sessionId, actorOf(staff), kind));
}

/** SCR-PUB-15 and SCR-PUB-16 read `GET /document-versions/{id}`. */
export function loadDocumentVersion(staff: Staff, id: string, view: Exclude<PolicyView, "loading"> | null): Promise<LoadOutcome<VersionDetail>> {
  return read(view, () => documentVersion(staff.sessionId, actorOf(staff), id));
}

/** SCR-PUB-17 reads `GET /currency-watches`; the sweep runs as it reads. */
export function loadCurrencyWatches(
  staff: Staff,
  filter: { status: WatchStatus | null; from: string | null; to: string | null; cursor: string | null },
  view: Exclude<PolicyView, "loading"> | null,
): Promise<LoadOutcome<CurrencyList>> {
  return read(view, () => currencyWatches(staff.sessionId, actorOf(staff), filter));
}

/** SCR-PUB-18 reads `GET /help-route-register`; the nightly check is applied as it reads. */
export function loadHelpRouteRegister(
  staff: Staff,
  filter: { state: RegisterRoute["state"] | null; purpose: HelpPurpose | null; cursor: string | null },
  view: Exclude<PolicyView, "loading"> | null,
): Promise<LoadOutcome<HelpRouteRegister>> {
  return read(view, () => helpRouteRegister(staff.sessionId, actorOf(staff), filter));
}

/** "Tạo phiên bản": `POST /documents/{id}/versions`. */
export function sendNewVersion(staff: Staff, kind: string, input: VersionInput): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => draftVersion(staff.sessionId, actorOf(staff), kind, input));
}

/** "Lưu": `PUT /document-versions/{id}`. */
export function sendVersionEdit(staff: Staff, id: string, input: VersionInput): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => saveVersion(staff.sessionId, actorOf(staff), id, input));
}

/** "Gửi duyệt": `POST /document-versions/{id}/submissions`, with the instant the version takes effect. */
export function sendVersionSubmission(staff: Staff, id: string, effectiveFrom: string | null): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => submitVersion(staff.sessionId, actorOf(staff), id, effectiveFrom));
}

/** "Phê duyệt và công bố" or "Trả lại": `POST /document-versions/{id}/decisions`. */
export function sendVersionDecision(
  staff: Staff,
  id: string,
  decision: { decision: "APPROVE" | "RETURN"; plainLanguageConfirmed: boolean; reason: string },
): Promise<PolicyAnswer<{ id: string; status: VersionStatus }>> {
  return command(() => decideVersion(staff.sessionId, actorOf(staff), id, decision));
}

/** "Rút phiên bản": `POST /document-versions/{id}/withdrawals`. */
export function sendVersionWithdrawal(staff: Staff, id: string, reason: string): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => withdrawVersion(staff.sessionId, actorOf(staff), id, reason));
}

/** "Thêm kênh": `POST /help-routes`. */
export function sendNewHelpRoute(staff: Staff, input: RouteInput): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => createHelpRoute(staff.sessionId, actorOf(staff), input));
}

/** "Lưu kênh": `PUT /help-routes/{id}`; the edit confirms the route. */
export function sendHelpRouteEdit(staff: Staff, id: string, input: RouteInput): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => editHelpRoute(staff.sessionId, actorOf(staff), id, input));
}

/** "Xác nhận": `POST /help-routes/{id}/confirmations`. */
export function sendHelpRouteConfirmation(staff: Staff, id: string): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => confirmHelpRoute(staff.sessionId, actorOf(staff), id));
}

/** "Ngừng": `POST /help-routes/{id}/retirements`, with its reason. */
export function sendHelpRouteRetirement(staff: Staff, id: string, reason: string): Promise<PolicyAnswer<{ id: string }>> {
  return command(() => retireHelpRoute(staff.sessionId, actorOf(staff), id, reason));
}
