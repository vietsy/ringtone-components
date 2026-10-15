import type { LoadOutcome } from "@rightone/ui";
import {
  aboutPage,
  assessScope,
  helpRoutes,
  indicateAmount,
  indicativeOffered,
  scopeQuestions,
} from "@/lib/mock/backend/public";
import {
  mockAboutPage,
  mockIndicativeAmount,
  mockScopeAssessment,
  type Pub01View,
  type Pub02View,
  type Pub03View,
} from "@/lib/mock/public";
import { NOT_CONFIGURED, usesMockData } from "./source";

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
  /** The instant asked for, when the page is read in its history; null for the version in effect. */
  asAt: string | null;
  /** The version now in effect, when the one shown has been superseded. */
  current: PageVersion | null;
  upcoming: PageVersion | null;
  /** An approved version of a source (the participant list) exists that this text does not describe yet. */
  newerApprovedVersionExists: boolean;
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

/** The questions the tariff in effect on the assessment date asks (`GET /scope-questions`). */
export interface ScopeQuestions {
  assessmentDate: string;
  /** Null when no approved tariff applies on the date: there is nothing to ask. */
  questions: { premisesClasses: readonly PremisesClass[]; adminAreas: readonly AdminArea[] } | null;
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
  nextAction: NextAction;
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

/** The help route register (SCR-PUB-18), read by the public pages that offer a way to help. */
export function loadHelpRoutes(): Promise<LoadOutcome<readonly HelpRoute[]>> {
  return Promise.resolve(usesMockData() ? helpRoutes() : NOT_CONFIGURED);
}

/**
 * SCR-PUB-01 reads `GET /pages/ABOUT` at the request instant. A review `view` returns the canvas's state for
 * it; null reads the version in effect today. A request for an invalid instant is a refusal with its code.
 */
export function loadAboutPage(view: Exclude<Pub01View, "loading"> | null): Promise<LoadOutcome<AboutPageAnswer>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockAboutPage(view) : aboutPage());
}

const blank = (assessmentDate: string): DeclaredPremises => ({
  assessmentDate,
  premisesClass: null,
  adminArea: null,
  floorAreaM2: "",
  seats: "",
});

/**
 * SCR-PUB-02 reads the scope questions for today (`GET /scope-questions`), with the reader's last assessment
 * kept by the form. The self-assessment not being offered (GUIDANCE_UNAVAILABLE) is a failure with its code,
 * never an empty form.
 */
export function loadScopeAssessment(
  view: Exclude<Pub02View, "loading" | "checking"> | null,
  last: Attempt<ScopeAnswer> | null,
): Promise<LoadOutcome<ScopeAssessmentPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view !== null) return Promise.resolve(mockScopeAssessment(view));
  const questions = scopeQuestions();
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

/** "Xem kết quả": `POST /scope-assessments` with the facts as declared. Nothing declared is kept by the service. */
export function requestScopeAssessment(facts: FormFacts): Promise<LoadOutcome<Attempt<ScopeAnswer>>> {
  return Promise.resolve(usesMockData() ? { data: assessScope(facts), failure: null } : NOT_CONFIGURED);
}

/** "Tính số tiền": `POST /indicative-amounts` with the facts as declared. Nothing declared is kept by the service. */
export function requestIndicativeAmount(facts: FormFacts): Promise<LoadOutcome<Attempt<IndicativeResult>>> {
  return Promise.resolve(usesMockData() ? { data: indicateAmount(facts), failure: null } : NOT_CONFIGURED);
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

