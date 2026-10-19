import type { LoadOutcome } from "@rightone/ui";
import type {
  ApplicationDraft,
  ApplicationKind,
  ApplicationList,
  ApplicationRecord,
  ApplicationSummary,
  AttestationStep,
  ChosenFile,
  DecisionList,
  DecisionRecord,
  DecisionSummary,
  DocumentItem,
  DraftStep,
  EvidenceItemRefusal,
  EvidenceStep,
  FactAnswers,
  FactQuestion,
  FactsStep,
  MissingItem,
  Period,
  PremisesClass,
  PremisesOption,
  RefusalStatement,
  RequiredDocument,
  ReviewStep,
  RightsLayer,
  StartApplication,
} from "@/lib/api/registration";
import { MOCK_PRINCIPAL } from "./session";
import { CHANGE_REPORT_DEFAULT_DAYS } from "./tariff";

/*
 * The registration family's answers, from the premises canvas (SCR-REG-01 to 08) and its data sheet. Today
 * on those screens is Thursday 1 October 2026, 10:14 in Ho Chi Minh. The ordinary route is the Sala draft
 * REG-P5TJ4BXC7M; REG-W3HN6DRZ2Q waits for documents; REG-D2VL7KQE3S is on the console.
 *
 * Two uses: each `mockX(view)` answers the state a board drew, for design review (`?view=`); `registrationSeed()`
 * is the session's starting state in the mock backend (`backend/registration.ts`), built from the same data.
 */

// ---------------------------------------------------------------- the view states each board drew

export const REG01_VIEWS = ["populated", "empty", "partial", "cursor-invalid", "premises-unavailable", "loading", "error"] as const;
export type Reg01View = (typeof REG01_VIEWS)[number];

export const REG02_VIEWS = [
  "first",
  "no-premises-chosen",
  "renewal",
  "change",
  "starting",
  "open-exists",
  "period-invalid",
  "pre-registration",
  "relationship",
  "not-authorised",
  "prior-not-found",
  "prior-superseded",
  "cause-required",
  "premises-unavailable",
  "governance-unavailable",
  "no-premises",
  "loading",
  "error",
] as const;
export type Reg02View = (typeof REG02_VIEWS)[number];

export const REG03_VIEWS = [
  "populated",
  "renewal",
  "class-unknown",
  "all-known",
  "saved",
  "use-start-missing",
  "field-invalid",
  "derived",
  "rulebook-not-approved",
  "exceeds-limit",
  "use-start-required",
  "unavailable",
  "premises-unavailable",
  "governance-unavailable",
  "processing-not-permitted",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Reg03View = (typeof REG03_VIEWS)[number];

export const REG04_VIEWS = [
  "populated",
  "uploading",
  "claim-form",
  "all-received",
  "after-submission",
  "empty",
  "document-invalid",
  "duplicate-claim",
  "period-invalid",
  "rulebook-not-approved",
  "loading",
  "error",
] as const;
export type Reg04View = (typeof REG04_VIEWS)[number];

export const REG05_VIEWS = [
  "populated",
  "section-open",
  "exemption-failed",
  "declared-class",
  "no-explanation",
  "tariff-not-approved",
  "missing-items",
  "rulebook-not-approved",
  "use-start-required",
  "exceeds-limit",
  "tariff-unavailable",
  "premises-unavailable",
  "policy-unavailable",
  "governance-unavailable",
  "loading",
  "error",
] as const;
export type Reg05View = (typeof REG05_VIEWS)[number];

export const REG06_VIEWS = [
  "ready",
  "unticked",
  "sending",
  "partial",
  "not-confirmed",
  "facts-changed",
  "explanation-superseded",
  "missing-items",
  "reconfirm",
  "period-invalid",
  "explanation-not-approved",
  "use-start-required",
  "exceeds-limit",
  "rulebook-not-approved",
  "tariff-not-approved",
  "processing-not-permitted",
] as const;
export type Reg06View = (typeof REG06_VIEWS)[number];

export const REG07_VIEWS = [
  "evidence",
  "received",
  "automated",
  "after-deadline",
  "in-review",
  "draft",
  "decided",
  "refused",
  "withdrawn",
  "closed",
  "withdraw-confirm",
  "doc-invalid",
  "request-closed",
  "tariff-not-approved",
  "already-final",
  "not-found",
  "not-authorised",
  "loading",
  "error",
] as const;
export type Reg07View = (typeof REG07_VIEWS)[number];

export const REG08_VIEWS = [
  "otherwise",
  "as-applied",
  "no-fee",
  "claim-pending",
  "claim-partly-accepted",
  "superseded",
  "appeal-open",
  "not-found",
  "loading",
  "error",
] as const;
export type Reg08View = (typeof REG08_VIEWS)[number];

export type DraftView = Reg03View | Reg04View | Reg05View | Reg06View;

// ---------------------------------------------------------------- the data sheet

const PREMISES = {
  sala: "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ",
  dakao: "Then Cửa Bakery – Đa Kao",
  buivien: "Then Cửa Lounge & Karaoke – Bùi Viện",
  hbt: "Then Cửa Bakery – Hai Bà Trưng",
  ltt: "Then Cửa Coffee & Tea – Lê Thánh Tôn",
  nh: "Then Cửa Coffee & Tea – Nguyễn Huệ",
  pxl: "Then Cửa Kitchen – Phan Xích Long",
  pasteur: "Then Cửa Coffee & Tea – Pasteur",
} as const;
type PremisesKey = keyof typeof PREMISES;

/** The eight premises Đỗ Thu Trang acts for, in the canvas's order; the key is the filter's premises_id. */
const ACTED_FOR: readonly PremisesOption[] = (Object.keys(PREMISES) as PremisesKey[]).map((id) => ({ id, name: PREMISES[id] }));
const premises = (id: PremisesKey): PremisesOption => ({ id, name: PREMISES[id] });

/** The Sala draft on the ordinary route, and Pasteur's renewal, the only drafts the canvas draws. */
const SALA_DRAFT = "REG-P5TJ4BXC7M";
const PASTEUR_RENEWAL = "REG-N4CT7WQA2H";

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;

/** Today on the canvas: Thursday 1 October 2026. */
const TODAY = "2026-10-01";

/** The Sala draft's period, and the answers SCR-REG-03 draws it with. */
const SALA_PERIOD: Period = { from: "2026-10-01", to: "2027-09-30" };
const SALA_ANSWERS: FactAnswers = { premisesClass: null, customerArea: 64, daysOpen: 7, musicMethod: "speakers", useBeganOn: "2026-08-03" };
const FOUR: readonly FactQuestion[] = ["customer_area", "days_open", "music_method", "use_began_on"];

/** The business registration of Công ty TNHH Then Cửa Việt, masked as the portal shows it, for every one of its premises. */
const BUSINESS_REGISTRATION = "******6041";

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({
  data: null,
  failure: { code, traceId, retryable },
});
const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

// ---------------------------------------------------------------- SCR-REG-01

const APPLICATIONS: readonly ApplicationSummary[] = [
  {
    reference: SALA_DRAFT, premises: premises("sala"), kind: "NEW", status: "DRAFT", startedByRightOne: false,
    savedAt: at("2026-09-29", "16:42"), sentAt: null, evidence: null, decision: null,
  },
  {
    reference: "REG-E3WK7PRY5C", premises: premises("dakao"), kind: "AMENDMENT", status: "DRAFT", startedByRightOne: true,
    savedAt: null, sentAt: null, evidence: null, decision: null,
  },
  {
    reference: "REG-D2VL7KQE3S", premises: premises("buivien"), kind: "NEW", status: "UNDER_REVIEW", startedByRightOne: false,
    savedAt: null, sentAt: at("2026-09-15", "08:40"), evidence: null, decision: null,
  },
  {
    reference: "REG-W3HN6DRZ2Q", premises: premises("hbt"), kind: "NEW", status: "EVIDENCE_REQUIRED", startedByRightOne: false,
    savedAt: null, sentAt: null, evidence: { askedOn: "2026-09-25", dueOn: "2026-10-09" }, decision: null,
  },
  // The decided rows name their decision as the data sheet pairs them: one decided application and one
  // decision per premises, and Lê Thánh Tôn's change is the decision that replaces OBD-6RHC4WNE9B.
  {
    reference: "REG-R8BX5KDN3W", premises: premises("ltt"), kind: "AMENDMENT", status: "DECIDED", startedByRightOne: false,
    savedAt: null, sentAt: null, evidence: null, decision: "OBD-2YDA7KMS5X",
  },
  {
    reference: "REG-K7QM2XT4PB", premises: premises("nh"), kind: "NEW", status: "DECIDED", startedByRightOne: false,
    savedAt: null, sentAt: null, evidence: null, decision: "OBD-8KWT2PZH6M",
  },
  {
    reference: "REG-G2LM9VCE6Q", premises: premises("pxl"), kind: "NEW", status: "DECIDED", startedByRightOne: false,
    savedAt: null, sentAt: null, evidence: null, decision: "OBD-9MZB3QFT4X",
  },
  {
    reference: "REG-Y6TN4JHA8D", premises: premises("pasteur"), kind: "NEW", status: "DECIDED", startedByRightOne: false,
    savedAt: null, sentAt: null, evidence: null, decision: "OBD-3FJW6NRA5C",
  },
];

const DECISIONS: readonly DecisionSummary[] = [
  {
    reference: "OBD-8KWT2PZH6M", premises: premises("nh"), status: "CURRENT", outcome: "PAYABLE", note: "OTHERWISE",
    feeMinor: 2076000, currency: "VND", payBy: "2026-11-29", period: { from: "2026-09-24", to: "2027-09-23" }, replaces: null, replacedBy: null,
  },
  {
    reference: "OBD-3FJW6NRA5C", premises: premises("pasteur"), status: "CURRENT", outcome: "PAYABLE", note: null,
    feeMinor: 986000, currency: "VND", payBy: "2026-12-14", period: { from: "2026-09-18", to: "2027-09-17" }, replaces: null, replacedBy: null,
  },
  {
    reference: "OBD-9MZB3QFT4X", premises: premises("pxl"), status: "CURRENT", outcome: "NO_PAYABLE_OBLIGATION", note: "OUT_OF_SCOPE",
    feeMinor: 0, currency: "VND", payBy: null, period: { from: "2026-09-20", to: "2027-09-19" }, replaces: null, replacedBy: null,
  },
  {
    reference: "OBD-4NPV8CRA2J", premises: premises("dakao"), status: "CURRENT", outcome: "PAYABLE", note: "CLAIM_PENDING",
    feeMinor: 1152000, currency: "VND", payBy: "2026-12-07", period: { from: "2026-09-10", to: "2027-09-09" }, replaces: null, replacedBy: null,
  },
  {
    reference: "OBD-2YDA7KMS5X", premises: premises("ltt"), status: "CURRENT", outcome: "PAYABLE", note: null,
    feeMinor: 1638000, currency: "VND", payBy: "2026-10-26", period: { from: "2026-09-28", to: "2027-09-01" },
    replaces: "OBD-6RHC4WNE9B", replacedBy: null,
  },
  {
    reference: "OBD-6RHC4WNE9B", premises: premises("ltt"), status: "SUPERSEDED", outcome: "PAYABLE", note: null,
    feeMinor: 1386000, currency: "VND", payBy: null, period: { from: "2026-09-02", to: "2027-09-01" },
    replaces: null, replacedBy: { reference: "OBD-2YDA7KMS5X", from: "2026-09-28" },
  },
];

const ofPremises = <T extends { premises: PremisesOption }>(rows: readonly T[], premisesId: string | null) =>
  premisesId === null ? rows : rows.filter((row) => row.premises.id === premisesId);

export function mockPremisesActedFor(view: Exclude<Reg01View, "loading">): LoadOutcome<readonly PremisesOption[]> {
  return view === "error" ? failure("INTERNAL_ERROR", true, "5c1e9a27d84f3b60") : ok(ACTED_FOR);
}

export function mockApplications(view: Exclude<Reg01View, "loading">, premisesId: string | null): LoadOutcome<ApplicationList> {
  switch (view) {
    case "error":
      return failure("INTERNAL_ERROR", true, "5c1e9a27d84f3b60");
    case "premises-unavailable":
      return failure("PREMISES_READ_UNAVAILABLE", true);
    case "empty":
      return ok({ items: [], hasMore: false, moreRefused: null });
    case "cursor-invalid":
      return ok({ items: ofPremises(APPLICATIONS, premisesId), hasMore: true, moreRefused: "CURSOR_INVALID" });
    default:
      return ok({ items: ofPremises(APPLICATIONS, premisesId), hasMore: false, moreRefused: null });
  }
}

export function mockDecisions(view: Exclude<Reg01View, "loading">, premisesId: string | null): LoadOutcome<DecisionList> {
  switch (view) {
    case "error":
      return failure("INTERNAL_ERROR", true, "5c1e9a27d84f3b60");
    case "partial":
      return failure("INTERNAL_ERROR", true, "8b3f61d0c2a94e75");
    case "empty":
      return ok({ items: [], hasMore: false });
    default:
      return ok({ items: ofPremises(DECISIONS, premisesId), hasMore: false });
  }
}

// ---------------------------------------------------------------- SCR-REG-02

const PRIOR_PERIODS: Readonly<Record<string, { from: string; to: string }>> = {
  "OBD-3FJW6NRA5C": { from: "2026-09-18", to: "2027-09-17" },
  "OBD-8KWT2PZH6M": { from: "2026-09-24", to: "2027-09-23" },
  "OBD-6RHC4WNE9B": { from: "2026-09-02", to: "2027-09-01" },
};
const prior = (reference: string) => ({ reference, period: PRIOR_PERIODS[reference] ?? null });

export function mockStartApplication(view: Exclude<Reg02View, "loading">): LoadOutcome<StartApplication> {
  if (view === "error") return failure("INTERNAL_ERROR", true, "e47b2c09a5d13f86");
  const base: StartApplication = {
    today: TODAY,
    party: MOCK_PRINCIPAL.party,
    premises: ACTED_FOR,
    values: { premisesId: "sala", kind: "NEW", prior: null, cause: null, period: { from: "2026-10-01", to: "2027-09-30" } },
    refusal: null,
    fieldError: null,
  };
  const refused = (code: string, openApplication: string | null = null): StartApplication => ({ ...base, refusal: { code, openApplication } });
  switch (view) {
    case "first":
    case "starting":
      return ok(base);
    case "no-premises":
      return ok({ ...base, premises: [], values: { ...base.values, premisesId: null } });
    case "no-premises-chosen":
      return ok({ ...base, values: { ...base.values, premisesId: null } });
    case "renewal":
      return ok({ ...base, values: { premisesId: "pasteur", kind: "RENEWAL", prior: prior("OBD-3FJW6NRA5C"), cause: null, period: { from: "2027-09-18", to: "2028-09-17" } } });
    case "change":
      return ok({
        ...base,
        values: { premisesId: "nh", kind: "AMENDMENT", prior: prior("OBD-8KWT2PZH6M"), cause: "FACT_CHANGE_REPORTED", period: { from: "2026-10-01", to: "2027-09-23" } },
      });
    case "cause-required":
      return ok({
        ...base,
        values: { premisesId: "nh", kind: "AMENDMENT", prior: prior("OBD-8KWT2PZH6M"), cause: null, period: { from: "2026-10-01", to: "2027-09-23" } },
        fieldError: { field: "cause", code: "AMENDMENT_CAUSE_REQUIRED", governingDecision: null },
      });
    case "open-exists":
      return ok({ ...refused("OPEN_APPLICATION_EXISTS", "REG-W3HN6DRZ2Q"), values: { ...base.values, premisesId: "hbt" } });
    case "period-invalid":
      return ok({
        ...base,
        values: { ...base.values, premisesId: "ltt" },
        fieldError: { field: "period", code: "INTENDED_PERIOD_INVALID", governingDecision: "OBD-2YDA7KMS5X" },
      });
    case "pre-registration":
      return ok({
        ...base,
        values: { ...base.values, period: { from: "2026-08-03", to: "2027-08-02" } },
        fieldError: { field: "period", code: "PRE_REGISTRATION_OBLIGATION_RESERVED", governingDecision: null },
      });
    case "relationship":
      return ok(refused("PREMISES_RELATIONSHIP_NOT_EFFECTIVE"));
    case "not-authorised":
      return ok(refused("NOT_AUTHORISED_FOR_PREMISES"));
    case "prior-superseded":
      return ok({
        ...refused("PRIOR_DECISION_SUPERSEDED"),
        values: { premisesId: "ltt", kind: "AMENDMENT", prior: prior("OBD-6RHC4WNE9B"), cause: "FACT_CHANGE_REPORTED", period: { from: "2026-10-01", to: "2027-09-01" } },
      });
    case "prior-not-found":
      // An old link names a decision RightOne no longer finds, so its period cannot be read.
      return ok({
        ...refused("PRIOR_DECISION_NOT_FOUND"),
        values: { premisesId: "pasteur", kind: "RENEWAL", prior: prior("OBD-7TCM4RVA8J"), cause: null, period: { from: "2027-09-18", to: "2028-09-17" } },
      });
    case "premises-unavailable":
      return ok(refused("PREMISES_READ_UNAVAILABLE"));
    case "governance-unavailable":
      return ok(refused("DATA_GOVERNANCE_UNAVAILABLE"));
  }
}

// ---------------------------------------------------------------- SCR-REG-03 to 06, the draft

const DRAFTS: Readonly<Record<string, Omit<ApplicationDraft, "savedAt">>> = {
  [SALA_DRAFT]: { reference: SALA_DRAFT, premises: PREMISES.sala, kind: "NEW", period: SALA_PERIOD },
  [PASTEUR_RENEWAL]: { reference: PASTEUR_RENEWAL, premises: PREMISES.pasteur, kind: "RENEWAL", period: { from: "2027-09-18", to: "2028-09-17" } },
};

/** When the draft was last saved, as each step's board says it: every step saves when the person moves on. */
function savedAt(step: DraftStep, view: DraftView): string {
  if (step === "facts") return view === "saved" ? at("2026-10-01", "10:14") : view === "renewal" ? at("2026-10-01", "09:52") : at("2026-09-29", "16:42");
  if (step === "evidence") return view === "all-received" || view === "after-submission" ? at("2026-10-01", "10:12") : at("2026-10-01", "10:09");
  return at("2026-10-01", "10:12");
}

/** The steps the canvas draws each draft on: Pasteur's renewal only on the facts and the confirmation. */
const STEPS_DRAWN: Readonly<Record<string, readonly DraftStep[]>> = {
  [SALA_DRAFT]: ["facts", "evidence", "review", "attestation"],
  [PASTEUR_RENEWAL]: ["facts", "attestation"],
};

export function mockApplicationDraft(reference: string, step: DraftStep, view: DraftView): LoadOutcome<ApplicationDraft> {
  if (!(STEPS_DRAWN[reference] ?? []).includes(step)) return failure("APPLICATION_NOT_FOUND", false);
  if (step === "facts" && view === "not-authorised") return failure("NOT_AUTHORISED_FOR_PREMISES", false);
  // The renewal views are Pasteur's renewal of OBD-3FJW6NRA5C; every other view is the Sala draft.
  const shown = view === "renewal" || view === "reconfirm" ? PASTEUR_RENEWAL : SALA_DRAFT;
  const draft = DRAFTS[shown];
  return draft !== undefined ? ok({ ...draft, savedAt: savedAt(step, view) }) : failure("APPLICATION_NOT_FOUND", false);
}

export function mockFactsStep(reference: string, view: Exclude<Reg03View, "loading">): LoadOutcome<FactsStep> {
  if (!(STEPS_DRAWN[reference] ?? []).includes("facts")) return failure("APPLICATION_NOT_FOUND", false);
  switch (view) {
    case "error":
      return failure("INTERNAL_ERROR", true, "5c1e9a27d84f3b60");
    case "not-authorised":
      return failure("NOT_AUTHORISED_FOR_PREMISES", false);
    case "unavailable":
      return failure("POLICY_READ_UNAVAILABLE", true);
    case "premises-unavailable":
      return failure("PREMISES_READ_UNAVAILABLE", true);
    default:
      break;
  }
  const base: FactsStep = {
    today: TODAY,
    known: { businessRegistration: BUSINESS_REGISTRATION, administrativeArea: "Phường An Khánh, TP. Hồ Chí Minh", premisesClass: "cafe", classChanged: false },
    blocked: null,
    questions: FOUR,
    answers: SALA_ANSWERS,
    copied: null,
    fieldErrors: {},
    saveRefusal: null,
  };
  const classAsked: FactsStep = { ...base, known: { ...base.known, premisesClass: null }, questions: ["premises_class", ...FOUR] };
  switch (view) {
    case "populated":
      return ok(base);
    case "saved":
      return ok(base);
    case "renewal":
      return ok({
        ...base,
        known: { businessRegistration: BUSINESS_REGISTRATION, administrativeArea: "Phường Sài Gòn, TP. Hồ Chí Minh", premisesClass: "cafe", classChanged: true },
        answers: { ...base.answers, customerArea: 58, useBeganOn: "2026-09-16" },
        copied: { customer_area: true, days_open: true, music_method: false, use_began_on: false },
      });
    case "class-unknown":
      return ok(classAsked);
    case "derived":
      return ok({ ...classAsked, answers: { ...base.answers, premisesClass: "cafe" }, fieldErrors: { premises_class: "FACT_DERIVED_NOT_DECLARABLE" } });
    case "all-known":
      return ok({ ...base, questions: [] });
    case "use-start-missing":
      return ok({ ...base, answers: { ...base.answers, useBeganOn: null } });
    case "field-invalid":
      return ok({ ...base, answers: { ...base.answers, customerArea: 64.5 }, fieldErrors: { customer_area: "FACT_VALUE_INVALID" } });
    case "rulebook-not-approved":
      return ok({ ...base, blocked: "RULEBOOK_NOT_APPROVED", questions: [] });
    case "exceeds-limit":
      return ok({ ...base, blocked: "RULEBOOK_EXCEEDS_FACT_LIMIT", questions: [] });
    case "use-start-required":
      return ok({ ...base, blocked: "USE_START_REQUIRED", questions: [] });
    case "governance-unavailable":
      return ok({ ...base, saveRefusal: "DATA_GOVERNANCE_UNAVAILABLE" });
    case "processing-not-permitted":
      return ok({ ...base, saveRefusal: "PROCESSING_NOT_PERMITTED" });
  }
}

const received = (item: DocumentItem, receivedOn: string, name: string, sizeBytes: number): RequiredDocument => ({
  item,
  status: { state: "RECEIVED", receivedOn, file: { name, sizeBytes } },
});
const needed = (item: DocumentItem, refusal: string | null = null): RequiredDocument => ({ item, status: { state: "NEEDED", refusal } });
const MB = 1_000_000;

export function mockEvidenceStep(reference: string, view: Exclude<Reg04View, "loading">): LoadOutcome<EvidenceStep> {
  if (!(STEPS_DRAWN[reference] ?? []).includes("evidence")) return failure("APPLICATION_NOT_FOUND", false);
  if (view === "error") return failure("INTERNAL_ERROR", true, "a83f0d6e21b7c954");
  const proof = received("USE_START_PROOF", "2026-09-29", "bien-ban-lap-dat-loa.pdf", 1.2 * MB);
  const claim = (documents: readonly RequiredDocument[]) => [{ kind: "NON_USE" as const, layer: "PRODUCERS" as const, period: SALA_PERIOD, documents }];
  const base: EvidenceStep = {
    today: TODAY,
    blocked: null,
    documents: [proof, needed("LEASE")],
    afterSending: [],
    claims: claim([needed("SUPPLIER_INVOICE")]),
    claimAttempt: null,
    stillNeeded: [{ for: "RULES", item: "LEASE" }, { for: "CLAIM", item: "SUPPLIER_INVOICE", layer: "PRODUCERS" }],
  };
  const invoiceIn = claim([received("SUPPLIER_INVOICE", "2026-10-01", "hoa-don-nha-cung-cap-nhac.pdf", 0.8 * MB)]);
  const attempt = { kind: "NON_USE" as const, from: "2026-10-01", to: "2027-09-30" };
  switch (view) {
    case "populated":
      return ok(base);
    case "uploading":
      return ok({ ...base, documents: [proof, { item: "LEASE", status: { state: "UPLOADING", file: { name: "hop-dong-thue-mat-bang.pdf", sizeBytes: 2.4 * MB }, percent: 41 } }] });
    case "claim-form":
      return ok({ ...base, claimAttempt: { ...attempt, layer: null, refusal: null } });
    case "duplicate-claim":
      return ok({ ...base, claimAttempt: { ...attempt, layer: "PRODUCERS", refusal: { field: "layer", code: "ASSERTION_DUPLICATE" } } });
    case "period-invalid":
      return ok({ ...base, claimAttempt: { ...attempt, layer: "PERFORMERS", from: "2026-09-01", refusal: { field: "period", code: "ASSERTION_PERIOD_INVALID" } } });
    case "document-invalid":
      return ok({ ...base, documents: [proof, needed("LEASE", "DOCUMENT_INVALID")] });
    case "all-received":
      return ok({
        ...base,
        documents: [proof, received("LEASE", "2026-10-01", "hop-dong-thue-mat-bang.pdf", 2.4 * MB)],
        claims: invoiceIn,
        stillNeeded: [],
      });
    case "after-submission":
      return ok({ ...base, documents: [proof], afterSending: ["LEASE"], claims: invoiceIn, stillNeeded: [] });
    case "empty":
      return ok({ ...base, documents: [], claims: [], stillNeeded: [] });
    case "rulebook-not-approved":
      return ok({ ...base, blocked: "RULEBOOK_NOT_APPROVED" });
  }
}

const MISSING: readonly MissingItem[] = [
  { for: "FACTS", question: "use_began_on" },
  { for: "RULES", item: "LEASE" },
  { for: "CLAIM", item: "SUPPLIER_INVOICE", layer: "PRODUCERS" },
];

export function mockReviewStep(reference: string, view: Exclude<Reg05View, "loading">): LoadOutcome<ReviewStep> {
  if (!(STEPS_DRAWN[reference] ?? []).includes("review")) return failure("APPLICATION_NOT_FOUND", false);
  switch (view) {
    case "error":
      return failure("INTERNAL_ERROR", true, "7d2b94e0c6a1f385");
    // Every 503 is a read RightOne could not make; the answers are kept.
    case "tariff-unavailable":
      return failure("TARIFF_UNAVAILABLE", true);
    case "premises-unavailable":
      return failure("PREMISES_READ_UNAVAILABLE", true);
    case "policy-unavailable":
      return failure("POLICY_READ_UNAVAILABLE", true);
    case "governance-unavailable":
      return failure("DATA_GOVERNANCE_UNAVAILABLE", true);
    default:
      break;
  }
  const base: ReviewStep = {
    blocked: null,
    missing: [],
    told: { premisesClass: null, customerArea: 64, daysOpen: 7, musicMethod: "speakers", useBeganOn: "2026-08-03" },
    fee: {
      period: SALA_PERIOD,
      lines: [
        { layer: "AUTHORS", amountMinor: 742000, claimPending: false },
        { layer: "PERFORMERS", amountMinor: 322000, claimPending: false },
        { layer: "PRODUCERS", amountMinor: 322000, claimPending: true },
      ],
      totalMinor: 1386000,
      currency: "VND",
      tariffVersion: "2026.1",
      workedOutAt: at("2026-10-01", "10:14"),
    },
    feeRefusal: null,
    declaredClass: false,
    exemption: null,
    payBy: "2026-10-31",
    // The canvas's states quote TAR's change-report period as it stands with no version approved (CFG-360).
    explanation: { version: 3, published: true, changeReportDays: CHANGE_REPORT_DEFAULT_DAYS },
  };
  switch (view) {
    case "populated":
    case "section-open":
      return ok(base);
    case "exemption-failed":
      return ok({
        ...base,
        exemption: [
          { criterion: "AREA_UNDER_100", met: true, declaredArea: 64 },
          { criterion: "ONE_PREMISES", met: false, premisesInRegister: 8, party: MOCK_PRINCIPAL.party },
          { criterion: "RECORDED_SPEAKERS_ONLY", met: true, declared: "speakers" },
        ],
      });
    case "declared-class":
      return ok({ ...base, told: base.told !== null ? { ...base.told, premisesClass: "cafe" } : null, declaredClass: true });
    case "no-explanation":
      return ok({ ...base, explanation: { version: 3, published: false, changeReportDays: CHANGE_REPORT_DEFAULT_DAYS } });
    case "tariff-not-approved":
      return ok({ ...base, fee: null, feeRefusal: "TARIFF_NOT_APPROVED" });
    case "missing-items":
      return ok({ ...base, blocked: "REQUIRED_ITEMS_MISSING", missing: MISSING });
    case "rulebook-not-approved":
      return ok({ ...base, blocked: "RULEBOOK_NOT_APPROVED" });
    case "use-start-required":
      return ok({ ...base, blocked: "USE_START_REQUIRED" });
    case "exceeds-limit":
      return ok({ ...base, blocked: "RULEBOOK_EXCEEDS_FACT_LIMIT" });
  }
}

export function mockAttestationStep(reference: string, view: Reg06View): LoadOutcome<AttestationStep> {
  if (!(STEPS_DRAWN[reference] ?? []).includes("attestation")) return failure("APPLICATION_NOT_FOUND", false);
  const base: AttestationStep = {
    party: MOCK_PRINCIPAL.party,
    confirmed: true,
    changeDutyAcknowledged: true,
    refusal: null,
    missing: [],
    sendPending: false,
    // A drawn state carries no review of its own; sending from it is answered as the session's draft stands.
    shown: null,
    changeReportDays: CHANGE_REPORT_DEFAULT_DAYS,
  };
  const refused = (code: string, governingDecision: string | null = null): AttestationStep => ({ ...base, refusal: { code, governingDecision } });
  switch (view) {
    case "ready":
    case "sending":
      return ok(base);
    case "unticked":
      return ok({ ...base, confirmed: false, changeDutyAcknowledged: false });
    case "not-confirmed":
      return ok({ ...base, changeDutyAcknowledged: false, refusal: { code: "ATTESTATION_NOT_CONFIRMED", governingDecision: null } });
    case "partial":
      // The confirmation is recorded; the fee read failed while sending, so the button sends again.
      return ok({ ...refused("TARIFF_UNAVAILABLE"), sendPending: true });
    case "facts-changed":
      return ok(refused("FACTS_CHANGED_SINCE_PREVIEW"));
    case "explanation-superseded":
      return ok(refused("EXPLANATION_SUPERSEDED"));
    case "missing-items":
      return ok({ ...refused("REQUIRED_ITEMS_MISSING"), missing: MISSING });
    case "reconfirm":
      return ok(refused("RECONFIRMATION_REQUIRED"));
    case "period-invalid":
      return ok(refused("INTENDED_PERIOD_INVALID", "OBD-2YDA7KMS5X"));
    case "explanation-not-approved":
      return ok(refused("EXPLANATION_NOT_APPROVED"));
    case "use-start-required":
      return ok(refused("USE_START_REQUIRED"));
    case "exceeds-limit":
      return ok(refused("RULEBOOK_EXCEEDS_FACT_LIMIT"));
    case "rulebook-not-approved":
      return ok(refused("RULEBOOK_NOT_APPROVED"));
    case "tariff-not-approved":
      return ok(refused("TARIFF_NOT_APPROVED"));
    case "processing-not-permitted":
      return ok(refused("PROCESSING_NOT_PERMITTED"));
  }
}

// ---------------------------------------------------------------- SCR-REG-07

type Event = ApplicationRecord["history"][number];

/**
 * The four applications SCR-REG-07 reads, as the canvas gives them: Hai Bà Trưng waiting for documents a
 * reviewer asked for, the Sala draft, the Bùi Viện lounge in rulebook review, and Pasteur on the automated
 * route. Each view of the board reads one of them.
 */
const HBT: ApplicationRecord = {
  reference: "REG-W3HN6DRZ2Q",
  premises: PREMISES.hbt,
  kind: "NEW",
  status: "EVIDENCE_REQUIRED",
  savedAt: null,
  sentAt: at("2026-09-21", "10:05"),
  review: "CLAIM",
  evidenceRequest: null,
  dates: null,
  claims: [{ kind: "NON_USE", layer: "PRODUCERS", period: { from: "2026-09-21", to: "2027-09-20" }, state: "UNDER_REVIEW" }],
  history: [
    { at: at("2026-09-21", "10:05"), event: "SENT", route: "CLAIM_REVIEW", claim: "NON_USE" },
    { at: at("2026-09-21", "09:58"), event: "CONFIRMED" },
    { at: at("2026-09-21", "09:51"), event: "STARTED" },
  ],
  decision: null,
  ended: null,
  canWithdraw: true,
  withdrawRefusal: null,
};
const HBT_DATES = { paymentDeadline: "2026-10-17", useBeganOn: "2026-07-20" };
const HBT_ASKED: Event = { at: at("2026-09-25", "14:20"), event: "EVIDENCE_ASKED", by: "REVIEWER" };
/** The reviewer's request of 25 September: the invoice is still awaited, the photo arrived on 24 September. */
const HBT_REQUEST: NonNullable<ApplicationRecord["evidenceRequest"]> = {
  askedBy: "REVIEWER",
  askedOn: "2026-09-25",
  dueOn: "2026-10-09",
  closed: false,
  items: [
    { item: "SUPPLIER-INVOICE", document: "MUSIC_INVOICE_Q3", description: null, receivedOn: null, refusal: null },
    { item: "EQUIPMENT-PHOTO", document: "EQUIPMENT_PHOTO", description: null, receivedOn: "2026-09-24", refusal: null },
  ],
};

const SALA: ApplicationRecord = {
  ...HBT,
  reference: SALA_DRAFT,
  premises: PREMISES.sala,
  status: "DRAFT",
  savedAt: at("2026-09-29", "16:42"),
  sentAt: null,
  review: null,
  claims: [{ kind: "NON_USE", layer: "PRODUCERS", period: SALA_PERIOD, state: "DRAFT" }],
  history: [{ at: at("2026-09-29", "16:42"), event: "STARTED" }],
};

/**
 * The Sala draft once SCR-REG-06 has sent it, at the canvas's moment (1 October 2026, 10:14). Every value is
 * the draft's own: its claim goes to claim review, as Hai Bà Trưng's did; completeness is the day its last
 * document arrived (SCR-REG-04, 10:12); the expected decision and the payment deadline follow the rule every
 * other application on the canvas follows (21 days after completeness; 89 days after use began).
 */
const SALA_SENT: ApplicationRecord = {
  ...SALA,
  status: "UNDER_REVIEW",
  savedAt: null,
  sentAt: at("2026-10-01", "10:14"),
  review: "CLAIM",
  claims: [{ kind: "NON_USE", layer: "PRODUCERS", period: SALA_PERIOD, state: "UNDER_REVIEW" }],
  dates: {
    completeOn: "2026-10-01",
    decisionExpectedBy: "2026-10-22",
    reset: false,
    paymentDeadline: "2026-10-31",
    useBeganOn: "2026-08-03",
    toldOn: null,
    passedWhenComplete: false,
  },
  history: [
    { at: at("2026-10-01", "10:14"), event: "SENT", route: "CLAIM_REVIEW", claim: "NON_USE" },
    { at: at("2026-10-01", "10:12"), event: "CONFIRMED" },
    { at: at("2026-09-29", "16:42"), event: "STARTED" },
  ],
};

const LOUNGE: ApplicationRecord = {
  ...HBT,
  reference: "REG-D2VL7KQE3S",
  premises: PREMISES.buivien,
  status: "UNDER_REVIEW",
  sentAt: at("2026-09-15", "08:40"),
  review: "RULEBOOK",
  claims: [],
  dates: {
    completeOn: "2026-09-15",
    decisionExpectedBy: "2026-10-06",
    reset: false,
    paymentDeadline: "2026-10-02",
    useBeganOn: "2026-07-05",
    toldOn: "2026-09-15",
    passedWhenComplete: false,
  },
  history: [
    { at: at("2026-09-15", "08:40"), event: "SENT", route: "RULEBOOK_REVIEW", claim: null },
    { at: at("2026-09-15", "08:38"), event: "CONFIRMED" },
    { at: at("2026-09-15", "08:29"), event: "STARTED" },
  ],
};

/** On the automated route no review takes place, so the dates are the payment deadline alone. */
const PASTEUR: ApplicationRecord = {
  ...HBT,
  reference: "REG-Y6TN4JHA8D",
  premises: PREMISES.pasteur,
  sentAt: at("2026-09-18", "11:29"),
  review: "NONE",
  claims: [],
  evidenceRequest: {
    askedBy: "RIGHTONE",
    askedOn: "2026-09-18",
    dueOn: "2026-10-02",
    closed: false,
    items: [{ item: "TENURE", document: "LEASE", description: null, receivedOn: null, refusal: null }],
  },
  dates: {
    completeOn: null,
    decisionExpectedBy: null,
    reset: false,
    paymentDeadline: "2026-12-14",
    useBeganOn: "2026-09-16",
    toldOn: null,
    passedWhenComplete: false,
  },
  history: [
    { at: at("2026-09-18", "11:29"), event: "EVIDENCE_ASKED", by: "RIGHTONE" },
    { at: at("2026-09-18", "11:29"), event: "SENT", route: "RULES", claim: null },
    { at: at("2026-09-18", "11:29"), event: "CONFIRMED" },
    { at: at("2026-09-18", "11:16"), event: "STARTED" },
  ],
};

/** The statement the reviewer wrote when refusing Hai Bà Trưng's application on 25 September. */
const HBT_REFUSAL: RefusalStatement = {
  outcome: {
    vi: "Bị từ chối: giấy tờ thuộc một cơ sở khác",
    en: "Refused: the documents are of another premises",
  },
  reason: {
    vi: "Ảnh chụp thiết bị phát nhạc cho thấy biển hiệu của Then Cửa Bakery – Đa Kao.",
    en: "The photo of the music equipment shows the shop sign of Then Cửa Bakery – Đa Kao.",
  },
  notMet: {
    vi: "Giấy tờ phải là của chính cơ sở ghi trong đơn.",
    en: "The documents must be of the premises the application is for.",
  },
  youCan: {
    vi: "Bắt đầu một đơn mới cho Then Cửa Bakery – Hai Bà Trưng, kèm ảnh chụp tại chính cơ sở này.",
    en: "Start a new application for Then Cửa Bakery – Hai Bà Trưng with a photo taken at this premises.",
  },
};

/**
 * The view SCR-REG-07 opens in: each application the canvas draws opens in its own state. The Sala draft
 * opens in review, the state the demo reaches once SCR-REG-06 has sent it.
 */
const REG07_DEFAULTS: Readonly<Record<string, Reg07View>> = {
  [SALA.reference]: "in-review",
  [HBT.reference]: "evidence",
  [LOUNGE.reference]: "after-deadline",
  [PASTEUR.reference]: "decided",
};
/**
 * The reference selects the application, as the finance screens do: a view the canvas draws on another
 * application opens this one in its own state instead, so one premises' application never appears under
 * another's reference, and a reference the canvas never draws is not found.
 */
export function mockApplicationRecord(reference: string, view: Exclude<Reg07View, "loading">): LoadOutcome<ApplicationRecord> {
  if (view === "error" || view === "not-found" || view === "not-authorised") return drawnApplication(view);
  const fallback = REG07_DEFAULTS[reference];
  if (fallback === undefined) return failure("APPLICATION_NOT_FOUND", false);
  if (reference === SALA.reference) return ok(view === "draft" ? SALA : SALA_SENT);
  const drawn = drawnApplication(view);
  return drawn.data?.reference === reference ? drawn : drawnApplication(fallback === "loading" ? "evidence" : fallback);
}

/** Each view as the canvas draws it, on the application it draws it on. */
function drawnApplication(view: Exclude<Reg07View, "loading">): LoadOutcome<ApplicationRecord> {
  const evidence: ApplicationRecord = {
    ...HBT,
    evidenceRequest: HBT_REQUEST,
    dates: { completeOn: "2026-09-21", decisionExpectedBy: "2026-10-12", reset: true, ...HBT_DATES, toldOn: null, passedWhenComplete: false },
    history: [HBT_ASKED, ...HBT.history],
  };
  /** The refusal the board draws beside the first item still awaited. */
  const firstAwaitedRefused = (record: ApplicationRecord, refusal: EvidenceItemRefusal, closed = false): ApplicationRecord => {
    const request = record.evidenceRequest;
    if (request === null) return record;
    const [first, ...rest] = request.items;
    return first === undefined ? record : { ...record, evidenceRequest: { ...request, closed, items: [{ ...first, refusal }, ...rest] } };
  };
  switch (view) {
    case "error":
      return failure("INTERNAL_ERROR", true, "3d7a0f52c9e1b846");
    case "not-found":
      return failure("APPLICATION_NOT_FOUND", false);
    case "not-authorised":
      return failure("NOT_AUTHORISED_FOR_PREMISES", false);
    case "evidence":
    case "withdraw-confirm":
      return ok(evidence);
    case "doc-invalid":
      return ok(firstAwaitedRefused(evidence, "DOCUMENT_INVALID"));
    case "request-closed":
      return ok(firstAwaitedRefused(evidence, "EVIDENCE_REQUEST_CLOSED", true));
    case "already-final":
      return ok({ ...evidence, canWithdraw: false, withdrawRefusal: "APPLICATION_ALREADY_FINAL" });
    case "received":
      // The invoice arrived at 10:14 on 1 October: the application is complete and back in review.
      return ok({
        ...HBT,
        status: "UNDER_REVIEW",
        evidenceRequest: {
          ...HBT_REQUEST,
          dueOn: null,
          items: [
            { item: "SUPPLIER-INVOICE", document: "MUSIC_INVOICE_Q3", description: null, receivedOn: "2026-10-01", refusal: null },
            { item: "EQUIPMENT-PHOTO", document: "EQUIPMENT_PHOTO", description: null, receivedOn: "2026-09-24", refusal: null },
          ],
        },
        dates: { completeOn: "2026-10-01", decisionExpectedBy: "2026-10-22", reset: false, ...HBT_DATES, toldOn: "2026-10-01", passedWhenComplete: false },
        history: [{ at: at("2026-10-01", "10:14"), event: "EVIDENCE_COMPLETE" }, HBT_ASKED, ...HBT.history],
      });
    case "automated":
      return ok(PASTEUR);
    case "tariff-not-approved":
      return ok(firstAwaitedRefused(PASTEUR, "TARIFF_NOT_APPROVED"));
    case "after-deadline":
      return ok(LOUNGE);
    case "in-review":
      return ok({
        ...HBT,
        status: "UNDER_REVIEW",
        dates: { completeOn: "2026-09-21", decisionExpectedBy: "2026-10-12", reset: false, ...HBT_DATES, toldOn: null, passedWhenComplete: false },
      });
    case "draft":
      return ok(SALA);
    case "decided":
      return ok({
        ...PASTEUR,
        status: "DECIDED",
        evidenceRequest: null,
        decision: { reference: "OBD-3FJW6NRA5C", issuedAt: at("2026-09-18", "11:32") },
        history: [{ at: at("2026-09-18", "11:32"), event: "DECIDED", decision: "OBD-3FJW6NRA5C", afterDocument: true }, ...PASTEUR.history],
        canWithdraw: false,
      });
    case "refused":
      return ok({
        ...HBT,
        status: "REFUSED",
        ended: { kind: "REFUSED", on: "2026-09-25", statement: HBT_REFUSAL },
        history: [{ at: at("2026-09-25", "14:20"), event: "REFUSED" }, ...HBT.history],
        canWithdraw: false,
      });
    case "withdrawn":
      return ok({
        ...HBT,
        status: "WITHDRAWN",
        ended: { kind: "WITHDRAWN", on: "2026-10-01", at: at("2026-10-01", "10:14"), instruction: null },
        claims: HBT.claims.map((claim) => ({ ...claim, state: "WITHDRAWN" as const })),
        history: [{ at: at("2026-10-01", "10:14"), event: "WITHDRAWN" }, HBT_ASKED, ...HBT.history],
        canWithdraw: false,
      });
    case "closed":
      // The request ended on its due date with the invoice never sent; the application closed the next day.
      return ok({
        ...HBT,
        status: "CLOSED_INCOMPLETE",
        evidenceRequest: { ...HBT_REQUEST, closed: true, items: [{ item: "SUPPLIER-INVOICE", document: "MUSIC_INVOICE_Q3", description: null, receivedOn: null, refusal: null }] },
        ended: { kind: "CLOSED_INCOMPLETE", on: "2026-10-10" },
        history: [{ at: at("2026-10-10", "00:00"), event: "CLOSED" }, HBT_ASKED, ...HBT.history],
        canWithdraw: false,
      });
  }
}

// ---------------------------------------------------------------- SCR-REG-08

const TARIFF = "2026.1";
const lines = (authors: number, performers: number, producers: number, producersTreatment: DecisionRecord["lines"][number]["treatment"] = null) => [
  { layer: "AUTHORS" as const, amountMinor: authors, treatment: null, scope: null },
  { layer: "PERFORMERS" as const, amountMinor: performers, treatment: null, scope: null },
  { layer: "PRODUCERS" as const, amountMinor: producers, treatment: producersTreatment, scope: null },
];
const decisionBase = {
  currency: "VND",
  tariffVersion: TARIFF,
  explanationVersion: 3,
  rulebookVersion: "2026.2",
  claim: null,
  otherwise: null,
  replacedBy: null,
  application: null,
  // Read at each read from the use-start date (DR-23): the backend works it out; a review state draws none.
  deadline: null,
  prior: null,
  lateStatement: null,
} as const;

/** One record per decision on the canvas. Amounts are whole dong. */
const DECISION_RECORDS: Readonly<Record<string, DecisionRecord>> = {
  // Nguyễn Huệ: decided on the customer area its floor plan shows, not the area declared.
  "OBD-8KWT2PZH6M": {
    ...decisionBase,
    reference: "OBD-8KWT2PZH6M", premises: PREMISES.nh, status: "CURRENT", outcome: "PAYABLE",
    issuedAt: at("2026-09-24", "16:05"), period: { from: "2026-09-24", to: "2027-09-23" }, basis: "TARIFF",
    lines: lines(1112000, 482000, 482000), payBy: "2026-11-29", useBeganOn: "2026-09-01",
    beforeRegistration: { from: "2026-09-01", to: "2026-09-23" }, confirmedAt: at("2026-09-12", "10:31"),
    otherwise: {
      aspect: "CUSTOMER_AREA",
      reason: {
        vi: "Sơ đồ mặt bằng bạn gửi cho thấy khu vực khách rộng 118 m², trong khi đơn khai 64 m², nên phí được tính theo mức từ 100 đến 150 m².",
        en: "The floor plan sent shows 118 m² of customer area; 64 m² was declared, so the fee uses the band for 100 to 150 m².",
      },
      notMet: { vi: "Diện tích khu vực khách dưới 100 m²", en: "Customer area under 100 m²" },
      youCan: {
        vi: "Báo thay đổi kèm sơ đồ mặt bằng mới nếu diện tích nhỏ hơn.",
        en: "Report a change with a new floor plan if the area is smaller.",
      },
    },
    application: "REG-K7QM2XT4PB",
  },
  "OBD-3FJW6NRA5C": {
    ...decisionBase,
    reference: "OBD-3FJW6NRA5C", premises: PREMISES.pasteur, status: "CURRENT", outcome: "PAYABLE",
    issuedAt: at("2026-09-18", "11:32"), period: { from: "2026-09-18", to: "2027-09-17" }, basis: "TARIFF",
    lines: lines(528000, 229000, 229000), payBy: "2026-12-14", useBeganOn: "2026-09-16",
    beforeRegistration: { from: "2026-09-16", to: "2026-09-17" }, confirmedAt: at("2026-09-18", "11:29"),
    application: "REG-Y6TN4JHA8D",
  },
  "OBD-9MZB3QFT4X": {
    ...decisionBase,
    reference: "OBD-9MZB3QFT4X", premises: PREMISES.pxl, status: "CURRENT", outcome: "NO_PAYABLE_OBLIGATION",
    issuedAt: at("2026-09-20", "09:47"), period: { from: "2026-09-20", to: "2027-09-19" }, basis: "OUT_OF_SCOPE",
    lines: lines(0, 0, 0).map((line) => ({ ...line, treatment: "EXEMPT" as const })), payBy: null, useBeganOn: null,
    beforeRegistration: null, confirmedAt: at("2026-09-20", "09:44"), application: "REG-G2LM9VCE6Q",
  },
  "OBD-4NPV8CRA2J": {
    ...decisionBase,
    reference: "OBD-4NPV8CRA2J", premises: PREMISES.dakao, status: "CURRENT", outcome: "PAYABLE",
    issuedAt: at("2026-09-10", "14:06"), period: { from: "2026-09-10", to: "2027-09-09" }, basis: "TARIFF",
    lines: lines(616000, 268000, 268000, "CLAIM_PENDING"), payBy: "2026-12-07", useBeganOn: "2026-09-09",
    beforeRegistration: "2026-09-09", confirmedAt: at("2026-09-10", "14:02"), claim: { state: "UNDER_REVIEW" },
  },
  "OBD-6RHC4WNE9B": {
    ...decisionBase,
    reference: "OBD-6RHC4WNE9B", premises: PREMISES.ltt, status: "SUPERSEDED", outcome: "PAYABLE",
    issuedAt: at("2026-09-02", "09:24"), period: { from: "2026-09-02", to: "2027-09-01" }, basis: "TARIFF",
    lines: lines(742000, 322000, 322000), payBy: null, useBeganOn: null,
    beforeRegistration: { from: "2026-08-14", to: "2026-09-01" }, confirmedAt: at("2026-09-02", "09:20"),
    replacedBy: { reference: "OBD-2YDA7KMS5X", from: "2026-09-28" },
  },
  // Khách sạn Mây Sông, read on the canvas by that hotel's delegate Khúc Minh Nhật.
  "OBD-6WSN2LQB8H": {
    ...decisionBase,
    reference: "OBD-6WSN2LQB8H", premises: "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng", status: "CURRENT", outcome: "PAYABLE",
    issuedAt: at("2026-08-19", "15:42"), period: { from: "2026-08-19", to: "2027-08-18" }, basis: "TARIFF",
    lines: [
      { layer: "AUTHORS", amountMinor: 2268000, treatment: null, scope: null },
      { layer: "PERFORMERS", amountMinor: 984000, treatment: null, scope: null },
      // The accepted scope at 0, then the rest charged, so the payable rows still sum to the fee.
      { layer: "PRODUCERS", amountMinor: 0, treatment: "CLAIM_ACCEPTED", scope: { from: "2026-08-19", to: "2026-12-31" } },
      { layer: "PRODUCERS", amountMinor: 620000, treatment: null, scope: { from: "2027-01-01", to: "2027-08-18" } },
    ],
    payBy: "2026-11-01", useBeganOn: "2026-08-04",
    beforeRegistration: { from: "2026-08-04", to: "2026-08-18" }, confirmedAt: at("2026-08-12", "09:15"),
    claim: { state: "PARTLY_ACCEPTED", accepted: { from: "2026-08-19", to: "2026-12-31" } },
    otherwise: {
      aspect: "PRODUCERS_CLAIM",
      reason: {
        vi: "Văn bản của nhà cung cấp nhạc xác nhận sảnh và nhà hàng của khách sạn ngừng phát nhạc thu sẵn từ 19 tháng 8 đến 31 tháng 12, 2026, nên phần phí quyền của nhà sản xuất bản ghi âm cho thời gian đó không tính.",
        en: "The music supplier’s statement shows no recorded music in the lobby and the restaurant from 19 August to 31 December 2026, so Producers’ rights are not charged for that time.",
      },
      notMet: { vi: "Không sử dụng nhạc thu sẵn trong cả thời gian đã yêu cầu", en: "Non-use for the whole period claimed" },
      youCan: {
        vi: "Báo thay đổi kèm văn bản của nhà cung cấp nếu sau ngày 31 tháng 12, 2026 khách sạn vẫn không phát nhạc thu sẵn.",
        en: "Report a change with the supplier’s statement if recorded music stays off after 31 December 2026.",
      },
    },
  },
};

/**
 * The reference selects the decision, as on SCR-REG-07 and the finance screens; each decision is drawn in
 * one state, so a view drawn on another decision shows this one as it is. A reference the canvas never
 * draws in full (OBD-2YDA7KMS5X appears only as a list row) is not found rather than shown as another.
 */
export function mockDecision(reference: string, view: Exclude<Reg08View, "loading">): LoadOutcome<DecisionRecord> {
  if (view === "error") return failure("INTERNAL_ERROR", true, "5c1e9a27d84f3b60");
  if (view === "not-found") return failure("DECISION_NOT_FOUND", false);
  const record = DECISION_RECORDS[reference];
  return record !== undefined ? ok(record) : failure("DECISION_NOT_FOUND", false);
}

// ---------------------------------------------------------------- the session's starting state

/** A document as the seed holds it: the item, and the file once received (its name, type and size; no content). */
export interface SeedDocument {
  item: DocumentItem;
  received: { on: string; file: ChosenFile } | null;
}

/** A draft's steps: its period, the decision it starts from, the register's facts, the answers and the documents. */
export interface SeedDraft {
  period: Period;
  prior: string | null;
  cause: string | null;
  known: FactsStep["known"];
  questions: readonly FactQuestion[];
  answers: FactAnswers;
  copied: Partial<Record<FactQuestion, boolean>> | null;
  documents: readonly SeedDocument[];
}

/** One application as the session starts with it: what SCR-REG-07 reads, and a draft's steps. */
export interface SeedApplication {
  reference: string;
  premisesId: string;
  kind: ApplicationKind;
  startedByRightOne: boolean;
  record: ApplicationRecord;
  /** Each claim's own documents, in the order of the record's claims. */
  claimDocuments: readonly (readonly SeedDocument[])[];
  draft: SeedDraft | null;
}

/** The fee the canvas works out for a draft it draws, for the answers it draws (SCR-REG-05). */
export interface SeedFee {
  application: string;
  answers: FactAnswers;
  lines: readonly { layer: RightsLayer; amountMinor: number }[];
  currency: string;
  tariffVersion: string;
}

export interface RegistrationSeed {
  premises: readonly PremisesOption[];
  /**
   * PTY's register: the company's business registration, and the area and class of each premises it answers; a class
   * of null is one the register holds in no class the registration rules ask about, so the premises declares it.
   */
  register: {
    businessRegistration: string;
    premises: Readonly<Record<string, { administrativeArea: string; premisesClass: PremisesClass | null; classChanged: boolean }>>;
  };
  /** The canvas's list order, newest first. */
  applications: readonly SeedApplication[];
  /** The decisions, in the canvas's list order; a record of null is a decision the canvas draws only as a list row. */
  decisions: readonly { summary: DecisionSummary; record: DecisionRecord | null }[];
  /** The facts each decision rests on, where the canvas draws them: a renewal or a change copies them. */
  decisionFacts: Readonly<Record<string, FactAnswers>>;
  fees: readonly SeedFee[];
  /** The documents the rulebook version asks of a registration, as the Sala draft shows them, and of a claim. */
  rulebook: { documents: readonly DocumentItem[]; claimEvidence: DocumentItem; explanationVersion: number };
}

const seeded = (
  record: ApplicationRecord,
  premisesId: PremisesKey,
  more: { startedByRightOne?: boolean; claimDocuments?: readonly (readonly SeedDocument[])[]; draft?: SeedDraft } = {},
): SeedApplication => ({
  reference: record.reference,
  premisesId,
  kind: record.kind,
  startedByRightOne: more.startedByRightOne ?? false,
  record,
  claimDocuments: more.claimDocuments ?? record.claims.map(() => []),
  draft: more.draft ?? null,
});

/**
 * An application the canvas draws only as a row of SCR-REG-01: its record holds the row's values and the
 * moments its decision gives; a moment the canvas does not give is null, never made up.
 */
function listedOnly(reference: string, decided: { reference: string; issuedAt: string | null; confirmedAt: string | null } | null): ApplicationRecord {
  const row = APPLICATIONS.find((application) => application.reference === reference);
  if (row === undefined) throw new Error(`${reference} is not a row of SCR-REG-01`);
  const history: ApplicationRecord["history"] = [
    ...(decided !== null ? [{ at: decided.issuedAt, event: "DECIDED" as const, decision: decided.reference, afterDocument: false }] : []),
    ...(decided !== null && decided.confirmedAt !== null ? [{ at: decided.confirmedAt, event: "CONFIRMED" as const }] : []),
    { at: null, event: "STARTED" },
  ];
  return {
    reference,
    premises: row.premises.name,
    kind: row.kind,
    status: row.status,
    savedAt: row.savedAt,
    sentAt: row.sentAt,
    review: null,
    evidenceRequest: null,
    dates: null,
    claims: [],
    history,
    decision: decided !== null ? { reference: decided.reference, issuedAt: decided.issuedAt } : null,
    ended: null,
    canWithdraw: row.status === "DRAFT",
    withdrawRefusal: null,
  };
}

const decidedBy = (decision: string) => {
  const record = DECISION_RECORDS[decision];
  return { reference: decision, issuedAt: record?.issuedAt ?? null, confirmedAt: record?.confirmedAt ?? null };
};

const notReceived = (item: DocumentItem): SeedDocument => ({ item, received: null });

/**
 * The session's starting state: SCR-REG-01's two lists as the canvas draws them, each application in the
 * state SCR-REG-07 draws it in, and the Sala draft with its answers, documents and claim as SCR-REG-03 and 04
 * draw them at the start of the ordinary route.
 */
export function registrationSeed(): RegistrationSeed {
  const proof: SeedDocument = {
    item: "USE_START_PROOF",
    received: { on: "2026-09-29", file: { name: "bien-ban-lap-dat-loa.pdf", type: "application/pdf", sizeBytes: 1.2 * MB } },
  };
  const evidence = drawnApplication("evidence").data;
  const lounge = drawnApplication("after-deadline").data;
  const pasteur = drawnApplication("decided").data;
  if (evidence === null || lounge === null || pasteur === null) throw new Error("the canvas's applications are drawn");
  // Đa Kao's change was started by RightOne from the outcome of the claim on OBD-4NPV8CRA2J, the premises'
  // only decision. A change runs to the end of the decision it changes (ALG-261 step 7); the canvas draws no
  // start, so it is taken as the decision's own, the claim having covered the whole period.
  const dakaoDecision = DECISIONS.find((decision) => decision.reference === "OBD-4NPV8CRA2J");
  if (dakaoDecision === undefined) throw new Error("OBD-4NPV8CRA2J is drawn");
  return {
    premises: ACTED_FOR,
    register: {
      businessRegistration: BUSINESS_REGISTRATION,
      // Sala and Pasteur as SCR-REG-03 draws them. The others' wards are the party register's (`premises.ts`, the
      // PTY boards); it names no ward for Hai Bà Trưng or Phan Xích Long, which the register answers by their city,
      // Hồ Chí Minh City, where every Then Cửa Việt premises is. Their classes are asked, as SCR-REG-03 asks Đa Kao's.
      premises: {
        sala: { administrativeArea: "Phường An Khánh, TP. Hồ Chí Minh", premisesClass: "cafe", classChanged: false },
        pasteur: { administrativeArea: "Phường Sài Gòn, TP. Hồ Chí Minh", premisesClass: "cafe", classChanged: true },
        dakao: { administrativeArea: "Phường Tân Định, TP. Hồ Chí Minh", premisesClass: null, classChanged: false },
        buivien: { administrativeArea: "Phường Bến Thành, TP. Hồ Chí Minh", premisesClass: null, classChanged: false },
        ltt: { administrativeArea: "Phường Bến Thành, TP. Hồ Chí Minh", premisesClass: null, classChanged: false },
        nh: { administrativeArea: "Phường Sài Gòn, TP. Hồ Chí Minh", premisesClass: null, classChanged: false },
        hbt: { administrativeArea: "TP. Hồ Chí Minh", premisesClass: null, classChanged: false },
        pxl: { administrativeArea: "TP. Hồ Chí Minh", premisesClass: null, classChanged: false },
      },
    },
    applications: [
      seeded(SALA, "sala", {
        claimDocuments: [[notReceived("SUPPLIER_INVOICE")]],
        draft: {
          period: SALA_PERIOD,
          prior: null,
          cause: null,
          known: { businessRegistration: BUSINESS_REGISTRATION, administrativeArea: "Phường An Khánh, TP. Hồ Chí Minh", premisesClass: "cafe", classChanged: false },
          questions: FOUR,
          answers: SALA_ANSWERS,
          copied: null,
          documents: [proof, notReceived("LEASE")],
        },
      }),
      seeded(listedOnly("REG-E3WK7PRY5C", null), "dakao", {
        startedByRightOne: true,
        draft: {
          period: dakaoDecision.period,
          prior: dakaoDecision.reference,
          cause: "CLAIM_OUTCOME",
          known: { businessRegistration: BUSINESS_REGISTRATION, administrativeArea: null, premisesClass: null, classChanged: false },
          questions: ["premises_class", ...FOUR],
          answers: { premisesClass: null, customerArea: null, daysOpen: null, musicMethod: null, useBeganOn: null },
          copied: null,
          documents: [notReceived("USE_START_PROOF"), notReceived("LEASE")],
        },
      }),
      seeded(lounge, "buivien"),
      seeded(evidence, "hbt"),
      seeded(listedOnly("REG-R8BX5KDN3W", decidedBy("OBD-2YDA7KMS5X")), "ltt"),
      seeded(listedOnly("REG-K7QM2XT4PB", decidedBy("OBD-8KWT2PZH6M")), "nh"),
      seeded(listedOnly("REG-G2LM9VCE6Q", decidedBy("OBD-9MZB3QFT4X")), "pxl"),
      seeded(pasteur, "pasteur"),
    ],
    decisions: DECISIONS.map((summary) => ({ summary, record: DECISION_RECORDS[summary.reference] ?? null })),
    // Pasteur's renewal (SCR-REG-03, renewal) shows the answers its decision rests on, copied.
    decisionFacts: { "OBD-3FJW6NRA5C": { premisesClass: null, customerArea: 58, daysOpen: 7, musicMethod: "speakers", useBeganOn: "2026-09-16" } },
    fees: [
      {
        application: SALA_DRAFT,
        answers: SALA_ANSWERS,
        lines: [
          { layer: "AUTHORS", amountMinor: 742000 },
          { layer: "PERFORMERS", amountMinor: 322000 },
          { layer: "PRODUCERS", amountMinor: 322000 },
        ],
        currency: "VND",
        tariffVersion: TARIFF,
      },
    ],
    rulebook: { documents: ["USE_START_PROOF", "LEASE"], claimEvidence: "SUPPLIER_INVOICE", explanationVersion: 3 },
  };
}
