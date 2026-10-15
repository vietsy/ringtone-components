import type { LoadOutcome } from "@rightone/ui";
import type { CmoAdministrator } from "@/lib/api/session";
import type { Locale } from "@/lib/i18n/translate";
import { keepMandateDraft, mandateOf, recordParticipationTerms, shortNameOf, submitMandate, termsOf } from "@/lib/mock/backend/governance";
import { mockOurMandate, mockParticipationTerms, type Gov14View, type Gov15View } from "@/lib/mock/governance";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * The governance family (GOV) on the organisation portal: the organisation's own mandate (SCR-GOV-14) and its
 * participation terms (SCR-GOV-15). Every read and act is scoped to the signed-in administrator's organisation;
 * the organisation is never a field, so one organisation cannot read or write another's (`ROLE_OUT_OF_SCOPE`
 * has nothing to answer here). Given a view, a loader answers the state the design canvas drew instead (design
 * review). The commands are the API's (`srs/02-api-contracts.md`): each answers whether RightOne accepted the
 * act, and a refused act carries its code and what its sentence names.
 */

/** A value the canvas writes in each language: a document's title, a reviewer's reason, an authority's name. */
export type Localised = Readonly<Record<Locale, string>>;

/** SM-19, a mandate's states. A draft is not one of them: it is held on the device until it is submitted. */
export type MandateState = "SUBMITTED" | "APPROVED" | "EFFECTIVE" | "SUSPENDED" | "EXPIRED" | "WITHDRAWN";

/** What the browser says of a chosen file. The mock keeps no file: there is no document store to hand it to. */
export interface ChosenFile {
  name: string;
  type: string;
  sizeBytes: number;
}

/** The authority evidence: a document the canvas names by its title, or the file the administrator attached. */
export type Evidence = { kind: "document"; title: Localised } | { kind: "file"; file: ChosenFile };

/** One represented component (`gov.mandate_scopes`): a right type, a repertoire key (`*` for all), a province. */
export interface ScopeRow {
  rightType: string;
  repertoire: string;
  territory: string;
}

export interface Mandate {
  state: MandateState;
  /** The day it was submitted; null where nothing records it (a mandate the canvas implies but never draws). */
  submittedOn: string | null;
  /** The granting authority's id in the authority register; null where nothing records it. */
  grantingAuthority: string | null;
  evidence: Evidence | null;
  scope: readonly ScopeRow[];
  effectiveFrom: string | null;
  /** Null: open-ended, or not recorded when `effectiveFrom` is null too. */
  effectiveTo: string | null;
  /** SUSPENDED or WITHDRAWN: the business date collection and licensing stopped for this scope. */
  stoppedOn: string | null;
  /** The latest review that recorded insufficient evidence; the reviewing officer is never named (`NTF-GOV-01`). */
  review: { reason: Localised } | null;
}

/** The mandate form as entered: dates as ISO dates, or null when none or none readable was entered. */
export interface MandateForm {
  authority: string;
  evidence: ChosenFile | null;
  rows: readonly ScopeRow[];
  from: string | null;
  to: string | null;
}

/** A draft saved on this device (the session plays the device). Nothing is submitted by saving. */
export interface MandateDraft extends MandateForm {
  savedAt: string;
}

/** The registers the form chooses from, as far as the canvas draws them. */
export interface MandateRegister {
  authorities: readonly { id: string; name: Localised }[];
  /** The right types the form offers; a recorded row may carry another type of the controlled set. */
  rightTypes: readonly string[];
  provinces: readonly { code: string; name: string }[];
}

export interface Organisation {
  /** The registered name, as the shell and the read-only Organisation field show it. */
  name: string;
  /** The name a sentence uses ("Hạc Bạch is recognised ..."); the registered name where the canvas draws no shorter one. */
  shortName: string;
}

/** SCR-GOV-14: the organisation's current mandate, or the draft it is preparing when it has none. */
export interface OurMandate {
  organisation: Organisation;
  mandate: Mandate | null;
  draft: MandateDraft | null;
  register: MandateRegister;
}

/** A version of the recorded participation terms. */
export interface TermsVersion {
  version: string;
  from: string;
}

/** `gov.participation_terms`: the retained direct-licensing right is always true and never a choice. */
export interface RecordedTerms {
  version: TermsVersion;
  effectiveFrom: string;
  recordedAt: string;
  state: "EFFECTIVE" | "ENDED";
  directLicensingRetained: true;
}

/** SCR-GOV-15: the terms the organisation has recorded, or the current version it would record. */
export interface TermsPage {
  organisation: Organisation;
  current: TermsVersion;
  terms: RecordedTerms | null;
  /** The date typed in the form as the canvas draws it (review states); null in a person's session. */
  entered: string | null;
}

/** The fields a refusal can name, by the API's names; a row's field carries the row's index. */
export type GovField =
  | "granting_authority_id"
  | "authority_evidence_ref"
  | "scope"
  | "right_type"
  | "repertoire_key"
  | "territory_code"
  | "effective_from"
  | "effective_to";

export interface GovRefusal {
  code: string;
  field: GovField | null;
  /** The represented-rights row a field belongs to, counted from 0. */
  row: number | null;
  /** RANGE_OVERLAP: the existing record's range, which its sentence names. */
  range: { from: string; to: string | null } | null;
}

export type CommandAnswer<T> = { accepted: T; refusal: null } | { accepted: null; refusal: GovRefusal };

export interface MandateInput extends MandateForm {
  /** `Idempotency-Key`: the same submission sent twice records one mandate. */
  idempotencyKey: string;
}

export interface TermsInput {
  termsVersion: string;
  effectiveFrom: string | null;
  directLicensingRetained: boolean;
  idempotencyKey: string;
}

/** What a refused act hands back to its page (`lib/api/flash.ts`): the values as entered and the refusal. */
export interface MandateAttempt {
  page: "mandate";
  organisation: string;
  values: MandateForm;
  refusal: GovRefusal;
}

export interface TermsAttempt {
  page: "terms";
  organisation: string;
  values: { effectiveFrom: string | null };
  refusal: GovRefusal;
}

const command = <T,>(run: () => CommandAnswer<T>): Promise<LoadOutcome<CommandAnswer<T>>> =>
  Promise.resolve(usesMockData() ? { data: run(), failure: null } : NOT_CONFIGURED);

/**
 * SCR-GOV-14 reads `GET /mandates` for the session's organisation: its current mandate, and the draft saved on
 * this device while it has none. With a view, the state the canvas drew.
 */
export function loadOurMandate(cmo: CmoAdministrator, view: Exclude<Gov14View, "loading"> | null, locale: Locale): Promise<LoadOutcome<OurMandate>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockOurMandate(view, locale) : mandateOf(cmo.sessionId, cmo.organisation, cmo.organisationName));
}

/** POST /mandates: the mandate recorded as SUBMITTED, or the refusal naming what is missing or what it overlaps. */
export function sendMandate(cmo: CmoAdministrator, input: MandateInput): Promise<LoadOutcome<CommandAnswer<{ state: MandateState }>>> {
  return command(() => submitMandate(cmo.sessionId, cmo.organisation, input));
}

/** Save draft: held on this device, nothing submitted (SCR-GOV-14, Actions). The API has no draft. */
export function saveMandateDraft(cmo: CmoAdministrator, form: MandateForm): Promise<LoadOutcome<{ savedAt: string }>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve({ data: keepMandateDraft(cmo.sessionId, cmo.organisation, form), failure: null });
}

/**
 * The name a sentence gives the session's organisation ("Hạc Bạch keeps its own direct-licensing right"), known
 * before its terms are read, so SCR-GOV-15's statement stands while they load or cannot be read. The registered
 * name where the canvas draws no shorter one, and outside mock data.
 */
export function loadShortName(cmo: CmoAdministrator): Promise<string> {
  return Promise.resolve((usesMockData() ? shortNameOf(cmo.sessionId, cmo.organisation) : null) ?? cmo.organisationName);
}

/** SCR-GOV-15 reads `GET /participation-terms` for the session's organisation. With a view, the state the canvas drew. */
export function loadParticipationTerms(cmo: CmoAdministrator, view: Exclude<Gov15View, "loading"> | null): Promise<LoadOutcome<TermsPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(view !== null ? mockParticipationTerms(view) : termsOf(cmo.sessionId, cmo.organisation, cmo.organisationName));
}

/** POST /participation-terms: the terms recorded, or the refusal. */
export function sendParticipationTerms(cmo: CmoAdministrator, input: TermsInput): Promise<LoadOutcome<CommandAnswer<{ effectiveFrom: string }>>> {
  return command(() => recordParticipationTerms(cmo.sessionId, cmo.organisation, input));
}
