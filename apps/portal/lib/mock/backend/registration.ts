import { createHash, randomUUID } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  ApplicationDraft,
  ApplicationKind,
  ApplicationList,
  ApplicationRecord,
  ApplicationStatus,
  ApplicationSummary,
  AttestationStep,
  AttestInput,
  ChosenFile,
  ClaimInput,
  ClaimKind,
  CommandAnswer,
  CommandRefusal,
  DecisionList,
  DecisionRecord,
  DocumentItem,
  EvidenceStep,
  FactAnswers,
  FactQuestion,
  FactsInput,
  FactsStep,
  MissingItem,
  MusicMethod,
  Period,
  PremisesClass,
  PremisesOption,
  RequiredDocument,
  ReviewStep,
  RightsLayer,
  StartApplication,
  StartAttempt,
  StartInput,
  StartValues,
} from "@/lib/api/registration";
import { registrationSeed, type RegistrationSeed, type SeedDocument } from "../registration";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { table } from "./store";

/*
 * The registration family's backend (REG), as the API will behave: applications keyed by reference, each with
 * its status and history, and one function per command of `srs/02-api-contracts.md`. A command checks what the
 * contract checks, in the contract's order, and answers with the codes of `design/04-refusal-codes.md`; a
 * refused command records nothing. What the person does happens now (`clock.ts`); the seed keeps the canvas's
 * moments.
 *
 * Two answers the API takes from other services stay as the canvas has them. The fee is TAR's: the canvas
 * works it out for the Sala draft's answers only, so any other draft, or Sala with other answers, gets the
 * board's TARIFF_NOT_APPROVED. A decision is a reviewer's, on the operations console, which is not built: a sent
 * application waits in review, and no decision is issued here.
 */

const OPEN: readonly ApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "EVIDENCE_REQUIRED"];
const CLASSES: readonly PremisesClass[] = ["cafe", "restaurant", "bar", "karaoke", "hotel", "shop"];
const METHODS: readonly MusicMethod[] = ["speakers", "live", "both", "screens"];
const LAYERS: readonly RightsLayer[] = ["AUTHORS", "PERFORMERS", "PRODUCERS"];
const CAUSES = ["FACT_CHANGE_REPORTED", "APPLICANT_REQUEST"] as const;
const QUESTIONS: readonly FactQuestion[] = ["premises_class", "customer_area", "days_open", "music_method", "use_began_on"];

/** The review period of every review type in the canvas's `REG-REVIEW-PERIODS`: 21 days (DR-41, CFG-327's default). */
const REVIEW_DAYS = 21;
/** The payment deadline is 89 days after the day use began: 90 days counting that day (DR-23). */
const DEADLINE_DAYS = 89;

// ---------------------------------------------------------------- the state

interface StoredDocument {
  item: DocumentItem;
  receivedOn: string | null;
  file: ChosenFile | null;
}

interface Claim {
  kind: ClaimKind;
  layer: RightsLayer;
  period: Period;
  state: "DRAFT" | "UNDER_REVIEW" | "WITHDRAWN";
  documents: StoredDocument[];
}

/** A draft's steps: what SCR-REG-03 to 06 read and write. */
interface Work {
  period: Period;
  prior: string | null;
  cause: string | null;
  known: FactsStep["known"];
  questions: readonly FactQuestion[];
  answers: FactAnswers;
  copied: Partial<Record<FactQuestion, boolean>> | null;
  documents: StoredDocument[];
  /** The latest review shown (SCR-REG-05), and the answers it showed, as their digest. */
  presentation: { id: string; digest: string } | null;
  /** The latest confirmation, for the answers it confirmed. */
  attestation: { digest: string } | null;
}

interface Request {
  askedBy: "REVIEWER" | "RIGHTONE";
  askedOn: string;
  dueOn: string | null;
  closed: boolean;
  items: { item: DocumentItem; receivedOn: string | null; file: ChosenFile | null }[];
}

type Dates = NonNullable<ApplicationRecord["dates"]>;
type HistoryEntry = ApplicationRecord["history"][number];

interface Application {
  reference: string;
  premisesId: string;
  kind: ApplicationKind;
  startedByRightOne: boolean;
  status: ApplicationStatus;
  savedAt: string | null;
  sentAt: string | null;
  review: ApplicationRecord["review"];
  request: Request | null;
  dates: Dates | null;
  claims: Claim[];
  /** Newest first. */
  history: HistoryEntry[];
  decision: ApplicationRecord["decision"];
  ended: ApplicationRecord["ended"];
  /** A draft's steps; null once sent, and for an application the canvas draws no steps of. */
  work: Work | null;
}

interface State {
  seed: RegistrationSeed;
  /** References, newest first: the list's order. */
  order: string[];
  applications: Map<string, Application>;
}

const stored = (document: SeedDocument): StoredDocument => ({
  item: document.item,
  receivedOn: document.received?.on ?? null,
  file: document.received?.file ?? null,
});

function fromSeed(seed: RegistrationSeed): State {
  const applications = new Map<string, Application>();
  for (const application of seed.applications) {
    const { record, draft } = application;
    applications.set(application.reference, {
      reference: application.reference,
      premisesId: application.premisesId,
      kind: application.kind,
      startedByRightOne: application.startedByRightOne,
      status: record.status,
      savedAt: record.savedAt,
      sentAt: record.sentAt,
      review: record.review,
      request:
        record.evidenceRequest === null
          ? null
          : { ...record.evidenceRequest, items: record.evidenceRequest.items.map((entry) => ({ item: entry.item, receivedOn: entry.receivedOn, file: null })) },
      dates: record.dates,
      claims: record.claims.map((claim, index) => ({ ...claim, documents: (application.claimDocuments[index] ?? []).map(stored) })),
      history: [...record.history],
      decision: record.decision,
      ended: record.ended,
      work:
        draft === null
          ? null
          : {
              period: draft.period,
              prior: draft.prior,
              cause: draft.cause,
              known: draft.known,
              questions: draft.questions,
              answers: { ...draft.answers },
              copied: draft.copied === null ? null : { ...draft.copied },
              documents: draft.documents.map(stored),
              presentation: null,
              attestation: null,
            },
    });
  }
  return { seed, order: seed.applications.map((application) => application.reference), applications };
}

/** The session's registration state, seeded from the canvas the first time the session reads it. */
const state = (sessionId: string): State => table(sessionId, "registration", () => fromSeed(registrationSeed()));

// ---------------------------------------------------------------- answers

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusedRead = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const accept = <T,>(accepted: T): CommandAnswer<T> => ({ accepted, refusal: null });

function refuse(code: string, more: Partial<Omit<CommandRefusal, "code">> = {}): CommandAnswer<never> {
  return {
    accepted: null,
    refusal: { code, field: null, openApplication: null, governingDecision: null, missing: [], fieldErrors: {}, ...more },
  };
}

const premisesName = (s: State, id: string): string => s.seed.premises.find((premises) => premises.id === id)?.name ?? id;

/** The application, or why it cannot be read: a reference the session does not have is not found. */
function find(s: State, ref: string): Application | null {
  return s.applications.get(ref) ?? null;
}

/** A draft and its steps, or the refusal a step answers: not found, or not editable once sent. */
function draftOf(s: State, ref: string): { application: Application; work: Work } | { code: string } {
  const application = find(s, ref);
  if (application === null) return { code: "APPLICATION_NOT_FOUND" };
  if (application.status !== "DRAFT" || application.work === null) return { code: "APPLICATION_NOT_EDITABLE" };
  return { application, work: application.work };
}

// ---------------------------------------------------------------- dates

/** The day before the same date a year later: a period of one year, as SCR-REG-02 prefills it. */
function yearFrom(from: string): string {
  const [y, m, d] = from.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return from;
  return addDays(new Date(Date.UTC(y + 1, m - 1, d)).toISOString(), -1);
}

const overlaps = (a: Period, b: Period) => a.from <= b.to && a.to >= b.from;

/**
 * The first decision of the premises that governs a day of the period: a current decision governs its period, a
 * replaced one the days before its successor takes effect (ALG-262 g3).
 */
function governingDecision(s: State, premisesId: string, period: Period): string | null {
  for (const { summary } of s.seed.decisions) {
    if (summary.premises.id !== premisesId) continue;
    const governs =
      summary.status === "CURRENT"
        ? summary.period
        : summary.replacedBy !== null
          ? { from: summary.period.from, to: addDays(summary.replacedBy.from, -1) }
          : null;
    if (governs !== null && governs.from <= governs.to && overlaps(period, governs)) return summary.reference;
  }
  return null;
}

// ---------------------------------------------------------------- the steps' rules

const answerOf = (answers: FactAnswers, question: FactQuestion): string | number | null => {
  switch (question) {
    case "premises_class":
      return answers.premisesClass;
    case "customer_area":
      return answers.customerArea;
    case "days_open":
      return answers.daysOpen;
    case "music_method":
      return answers.musicMethod;
    case "use_began_on":
      return answers.useBeganOn;
  }
};

/** Every item still needed before the review (ALG-260 `remaining`): unanswered facts, then documents, then claims'. */
function missingItems(application: Application, work: Work): MissingItem[] {
  return [
    ...work.questions.filter((question) => answerOf(work.answers, question) === null).map((question) => ({ for: "FACTS" as const, question })),
    ...work.documents.filter((document) => document.receivedOn === null).map((document) => ({ for: "RULES" as const, item: document.item })),
    ...application.claims
      .filter((claim) => claim.state === "DRAFT")
      .flatMap((claim) =>
        claim.documents.filter((document) => document.receivedOn === null).map((document) => ({ for: "CLAIM" as const, item: document.item, layer: claim.layer })),
      ),
  ];
}

/** The digest of the answers a review showed and a confirmation confirms (`facts_digest`). */
function digest(work: Work): string {
  return createHash("sha256").update(JSON.stringify({ answers: work.answers, copied: work.copied })).digest("hex");
}

const sameAnswers = (a: FactAnswers, b: FactAnswers) => QUESTIONS.every((question) => answerOf(a, question) === answerOf(b, question));

/** The fee for the draft as it stands: the canvas's, for the draft and the answers it draws; otherwise none. */
function feeFor(s: State, application: Application, work: Work) {
  return s.seed.fees.find((fee) => fee.application === application.reference && sameAnswers(fee.answers, work.answers)) ?? null;
}

const toRequired = (document: StoredDocument): RequiredDocument =>
  document.receivedOn !== null && document.file !== null
    ? { item: document.item, status: { state: "RECEIVED", receivedOn: document.receivedOn, file: { name: document.file.name, sizeBytes: document.file.sizeBytes } } }
    : { item: document.item, status: { state: "NEEDED", refusal: null } };

/** A file the document store would refuse: empty, or of no media type (SEC-290). The mock keeps no content to check further. */
const invalidFile = (file: ChosenFile) => file.sizeBytes <= 0 || file.type.trim() === "" || file.name.trim() === "";

/** The expected-date statement for an application complete on a day (DR-41 rows 1 to 3). */
function statement(completeOn: string, useBeganOn: string): Dates {
  const paymentDeadline = addDays(useBeganOn, DEADLINE_DAYS);
  const decisionExpectedBy = addDays(completeOn, REVIEW_DAYS);
  const passedWhenComplete = completeOn > paymentDeadline;
  return {
    completeOn,
    decisionExpectedBy,
    reset: false,
    paymentDeadline,
    useBeganOn,
    // Row 2: told on the day of the statement, before the deadline passes. Row 3 says so in its own words.
    toldOn: !passedWhenComplete && decisionExpectedBy > paymentDeadline ? today() : null,
    passedWhenComplete,
  };
}

// ---------------------------------------------------------------- reads

export function premisesActedFor(sessionId: string): LoadOutcome<readonly PremisesOption[]> {
  return ok(state(sessionId).seed.premises);
}

function summary(s: State, application: Application): ApplicationSummary {
  const request = application.request;
  return {
    reference: application.reference,
    premises: { id: application.premisesId, name: premisesName(s, application.premisesId) },
    kind: application.kind,
    status: application.status,
    startedByRightOne: application.startedByRightOne,
    savedAt: application.savedAt,
    sentAt: application.sentAt,
    evidence: application.status === "EVIDENCE_REQUIRED" && request !== null && request.dueOn !== null ? { askedOn: request.askedOn, dueOn: request.dueOn } : null,
    decision: application.decision?.reference ?? null,
  };
}

/** GET /applications: newest first, for one premises or every premises the person acts for. */
export function applicationList(sessionId: string, premisesId: string | null): LoadOutcome<ApplicationList> {
  const s = state(sessionId);
  const items = s.order
    .map((ref) => s.applications.get(ref))
    .filter((application): application is Application => application !== undefined && (premisesId === null || application.premisesId === premisesId))
    .map((application) => summary(s, application));
  return ok({ items, hasMore: false, moreRefused: null });
}

/** GET /obligation-decisions. */
export function decisionList(sessionId: string, premisesId: string | null): LoadOutcome<DecisionList> {
  const items = state(sessionId)
    .seed.decisions.map((decision) => decision.summary)
    .filter((decision) => premisesId === null || decision.premises.id === premisesId);
  return ok({ items, hasMore: false });
}

/** GET /obligation-decisions/{id}. The canvas draws OBD-2YDA7KMS5X only as a list row, so its record cannot be read. */
export function decisionRecord(sessionId: string, ref: string): LoadOutcome<DecisionRecord> {
  const decision = state(sessionId).seed.decisions.find((entry) => entry.summary.reference === ref);
  const record = decision?.record ?? null;
  return record !== null ? ok(record) : refusedRead("DECISION_NOT_FOUND");
}

/** SCR-REG-02's form: a first registration from today for a year, or as the last attempt left it. */
export function startForm(sessionId: string, party: string, attempt: StartAttempt | null): LoadOutcome<StartApplication> {
  const s = state(sessionId);
  const day = today();
  const only = s.seed.premises.length === 1 ? (s.seed.premises[0]?.id ?? null) : null;
  return ok({
    today: day,
    party,
    premises: s.seed.premises,
    values: attempt?.values ?? { premisesId: only, kind: "NEW", prior: null, cause: null, period: { from: day, to: yearFrom(day) } },
    refusal: attempt?.refusal ?? null,
    fieldError: attempt?.fieldError ?? null,
  });
}

/**
 * The form SCR-REG-08's Renew or Report a change opens SCR-REG-02 with: the decision's premises, the kind, and
 * the period the specification prefills (a renewal from the day after the decision ends, for a year; a change
 * from today to the decision's end).
 */
export function startValuesFrom(sessionId: string, decisionRef: string, kind: "RENEWAL" | "AMENDMENT"): LoadOutcome<StartValues> {
  const decision = state(sessionId).seed.decisions.find((entry) => entry.summary.reference === decisionRef)?.summary;
  if (decision === undefined) return refusedRead("DECISION_NOT_FOUND");
  const from = kind === "RENEWAL" ? addDays(decision.period.to, 1) : today();
  return ok({
    premisesId: decision.premises.id,
    kind,
    prior: { reference: decision.reference, period: decision.period },
    cause: null,
    period: { from, to: kind === "RENEWAL" ? yearFrom(from) : decision.period.to },
  });
}

export function applicationDraft(sessionId: string, ref: string): LoadOutcome<ApplicationDraft> {
  const s = state(sessionId);
  const draft = draftOf(s, ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { application, work } = draft;
  return ok({ reference: ref, premises: premisesName(s, application.premisesId), kind: application.kind, period: work.period, savedAt: application.savedAt });
}

/** GET /applications/{id}/requirements, as SCR-REG-03 reads it. */
export function factsStep(sessionId: string, ref: string): LoadOutcome<FactsStep> {
  const draft = draftOf(state(sessionId), ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { work } = draft;
  return ok({
    today: today(),
    known: work.known,
    blocked: null,
    questions: work.questions,
    answers: work.answers,
    copied: work.copied,
    fieldErrors: {},
    saveRefusal: null,
  });
}

/** GET /applications/{id}/requirements, as SCR-REG-04 reads it. */
export function evidenceStep(sessionId: string, ref: string): LoadOutcome<EvidenceStep> {
  const draft = draftOf(state(sessionId), ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { application, work } = draft;
  return ok({
    today: today(),
    blocked: null,
    documents: work.documents.map(toRequired),
    afterSending: [],
    claims: application.claims.map((claim) => ({ kind: claim.kind, layer: claim.layer, period: claim.period, documents: claim.documents.map(toRequired) })),
    claimAttempt: null,
    stillNeeded: missingItems(application, work),
  });
}

/**
 * POST /applications/{id}/previews: the review SCR-REG-05 opens with. Items missing refuse it; a fee the canvas
 * does not work out is TARIFF_NOT_APPROVED and records nothing; otherwise the presentation is recorded, and the
 * confirmation that follows rests on it.
 */
export function previewApplication(sessionId: string, ref: string): LoadOutcome<ReviewStep> {
  const s = state(sessionId);
  const draft = draftOf(s, ref);
  if ("code" in draft) return refusedRead(draft.code);
  const { application, work } = draft;
  const explanation = { version: s.seed.rulebook.explanationVersion, published: true };
  const declaredClass = work.questions.includes("premises_class");
  const missing = missingItems(application, work);
  const { premisesClass, customerArea, daysOpen, musicMethod, useBeganOn } = work.answers;
  if (missing.length > 0 || customerArea === null || daysOpen === null || musicMethod === null || useBeganOn === null) {
    return ok({ blocked: "REQUIRED_ITEMS_MISSING", missing, told: null, fee: null, feeRefusal: null, declaredClass, exemption: null, payBy: null, explanation });
  }
  const told = { premisesClass: declaredClass ? premisesClass : null, customerArea, daysOpen, musicMethod, useBeganOn };
  const payBy = addDays(useBeganOn, DEADLINE_DAYS);
  const fee = feeFor(s, application, work);
  if (fee === null) {
    return ok({ blocked: null, missing: [], told, fee: null, feeRefusal: "TARIFF_NOT_APPROVED", declaredClass, exemption: null, payBy, explanation });
  }
  work.presentation = { id: randomUUID(), digest: digest(work) };
  // A claim to be reviewed leaves its layer charged in full while it is pending (DR-289 row 2).
  const claimed = new Set(application.claims.filter((claim) => claim.state !== "WITHDRAWN").map((claim) => claim.layer));
  return ok({
    blocked: null,
    missing: [],
    told,
    fee: {
      period: work.period,
      lines: fee.lines.map((line) => ({ ...line, claimPending: claimed.has(line.layer) })),
      totalMinor: fee.lines.reduce((total, line) => total + line.amountMinor, 0),
      currency: fee.currency,
      tariffVersion: fee.tariffVersion,
      workedOutAt: now(),
    },
    feeRefusal: null,
    declaredClass,
    exemption: null,
    payBy,
    explanation,
  });
}

/** SCR-REG-06: the boxes unticked each time the page opens, and the review the confirmation rests on. */
export function attestationStep(sessionId: string, party: string, ref: string): LoadOutcome<AttestationStep> {
  const draft = draftOf(state(sessionId), ref);
  if ("code" in draft) return refusedRead(draft.code);
  const shown = draft.work.presentation;
  return ok({
    party,
    confirmed: false,
    changeDutyAcknowledged: false,
    refusal: null,
    missing: [],
    sendPending: false,
    shown: shown === null ? null : { presentation: shown.id, factsDigest: shown.digest },
  });
}

/** GET /applications/{id}, as SCR-REG-07 reads it. */
export function applicationRecord(sessionId: string, ref: string): LoadOutcome<ApplicationRecord> {
  const s = state(sessionId);
  const application = find(s, ref);
  if (application === null) return refusedRead("APPLICATION_NOT_FOUND");
  const request = application.request;
  return ok({
    reference: application.reference,
    premises: premisesName(s, application.premisesId),
    kind: application.kind,
    status: application.status,
    savedAt: application.savedAt,
    sentAt: application.sentAt,
    review: application.review,
    evidenceRequest:
      request === null
        ? null
        : { ...request, items: request.items.map((entry) => ({ item: entry.item, receivedOn: entry.receivedOn, refusal: null })) },
    dates: application.dates,
    claims: application.claims.map(({ kind, layer, period, state: claimState }) => ({ kind, layer, period, state: claimState })),
    history: application.history,
    decision: application.decision,
    ended: application.ended,
    canWithdraw: OPEN.includes(application.status),
    withdrawRefusal: null,
  });
}

// ---------------------------------------------------------------- commands

/** A calendar date as the API takes it (2026-08-03); null when it is not one. */
function isoDate(text: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text) ? text : null;
}

/** A whole number of square metres as typed in either language (64, 1.200, 1,200); null when it is not one. */
function readWholeNumber(text: string): number | null {
  const value = text.replace(/\s/g, "");
  if (!/^\d+$/.test(value) && !/^\d{1,3}([.,]\d{3})+$/.test(value)) return null;
  const number = Number(value.replace(/[.,]/g, ""));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** POST /applications: checks in the contract's order; a draft with its new reference when every one passes. */
export function startApplication(sessionId: string, input: StartInput): CommandAnswer<{ application: string }> {
  const s = state(sessionId);
  if (!s.seed.premises.some((premises) => premises.id === input.premisesId)) return refuse("NOT_AUTHORISED_FOR_PREMISES");
  const day = today();
  const { kind, from, to } = input;
  if (kind !== "AMENDMENT") {
    if (from === null || to === null || to <= from) return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
    const governing = governingDecision(s, input.premisesId, { from, to });
    if (governing !== null) return refuse("INTENDED_PERIOD_INVALID", { field: "period", governingDecision: governing });
    if (kind === "NEW" && from < day) return refuse("PRE_REGISTRATION_OBLIGATION_RESERVED", { field: "period" });
  }
  const prior = kind === "NEW" ? null : (s.seed.decisions.find((entry) => entry.summary.reference === input.prior && entry.summary.premises.id === input.premisesId) ?? null);
  if (kind !== "NEW") {
    if (prior === null) return refuse("PRIOR_DECISION_NOT_FOUND");
    if (prior.summary.status === "SUPERSEDED") return refuse("PRIOR_DECISION_SUPERSEDED");
  }
  let period: Period;
  if (kind === "AMENDMENT") {
    // A change runs to the end of the decision it changes, and must start before that end (ALG-266 step 2a).
    const end = prior?.summary.period.to ?? null;
    if (from === null || end === null || from >= end) return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
    if (!(CAUSES as readonly string[]).includes(input.cause ?? "")) return refuse("AMENDMENT_CAUSE_REQUIRED", { field: "cause" });
    period = { from, to: end };
  } else if (from !== null && to !== null) {
    period = { from, to };
  } else {
    return refuse("INTENDED_PERIOD_INVALID", { field: "period" });
  }
  const open = [...s.applications.values()].find(
    (application) => application.premisesId === input.premisesId && application.kind === kind && OPEN.includes(application.status),
  );
  if (open !== undefined) return refuse("OPEN_APPLICATION_EXISTS", { openApplication: open.reference });

  let ref = reference("REG");
  while (s.applications.has(ref)) ref = reference("REG");
  const register = s.seed.register.premises[input.premisesId] ?? null;
  const knownClass = register?.premisesClass ?? null;
  const questions: readonly FactQuestion[] = knownClass === null ? QUESTIONS : QUESTIONS.filter((question) => question !== "premises_class");
  // A renewal or a change copies the facts its decision rests on, where the canvas draws them (FR-REG-012); each
  // copied answer waits for the person to confirm it is still true.
  const copiedFacts = prior !== null ? (s.seed.decisionFacts[prior.summary.reference] ?? null) : null;
  const answers: FactAnswers = copiedFacts ?? { premisesClass: null, customerArea: null, daysOpen: null, musicMethod: null, useBeganOn: null };
  const copied =
    copiedFacts === null ? null : Object.fromEntries(questions.filter((question) => answerOf(answers, question) !== null).map((question) => [question, false]));
  s.applications.set(ref, {
    reference: ref,
    premisesId: input.premisesId,
    kind,
    startedByRightOne: false,
    status: "DRAFT",
    savedAt: null,
    sentAt: null,
    review: null,
    request: null,
    dates: null,
    claims: [],
    history: [{ at: now(), event: "STARTED" }],
    decision: null,
    ended: null,
    work: {
      period,
      prior: prior?.summary.reference ?? null,
      cause: kind === "AMENDMENT" ? input.cause : null,
      known: {
        businessRegistration: s.seed.register.businessRegistration,
        administrativeArea: register?.administrativeArea ?? null,
        premisesClass: knownClass,
        classChanged: kind !== "NEW" && (register?.classChanged ?? false),
      },
      questions,
      answers: { ...answers, premisesClass: knownClass === null ? answers.premisesClass : null },
      copied,
      documents: s.seed.rulebook.documents.map((item) => ({ item, receivedOn: null, file: null })),
      presentation: null,
      attestation: null,
    },
  });
  s.order.unshift(ref);
  return accept({ application: ref });
}

/**
 * POST /applications/{id}/fact-declarations: every answer sent is checked, and one refused answer refuses the
 * save, so nothing half-saves. A copied answer the person changes is theirs from then on, not a copy to confirm.
 */
export function declareFacts(sessionId: string, ref: string, input: FactsInput): CommandAnswer<{ complete: boolean }> {
  const draft = draftOf(state(sessionId), ref);
  if ("code" in draft) return refuse(draft.code);
  const { application, work } = draft;
  const next: FactAnswers = { ...work.answers };
  const fieldErrors: Partial<Record<FactQuestion, string>> = {};
  for (const question of QUESTIONS) {
    const raw = input.values[question];
    if (raw === undefined) continue;
    if (!work.questions.includes(question)) {
      if (question === "premises_class" && raw !== "") fieldErrors[question] = "FACT_DERIVED_NOT_DECLARABLE";
      continue;
    }
    const text = raw.trim();
    switch (question) {
      case "premises_class": {
        const value = CLASSES.find((option) => option === text);
        if (text !== "" && value === undefined) fieldErrors[question] = "FACT_VALUE_INVALID";
        next.premisesClass = value ?? null;
        break;
      }
      case "customer_area": {
        const value = readWholeNumber(text);
        if (text !== "" && value === null) fieldErrors[question] = "FACT_VALUE_INVALID";
        next.customerArea = value;
        break;
      }
      case "days_open": {
        const value = /^[1-7]$/.test(text) ? Number(text) : null;
        if (text !== "" && value === null) fieldErrors[question] = "FACT_VALUE_INVALID";
        next.daysOpen = value;
        break;
      }
      case "music_method": {
        const value = METHODS.find((option) => option === text);
        if (text !== "" && value === undefined) fieldErrors[question] = "FACT_VALUE_INVALID";
        next.musicMethod = value ?? null;
        break;
      }
      case "use_began_on": {
        const value = text === "" ? null : isoDate(text);
        // A date that cannot be read, or later than today, is not a valid answer (SCR-REG-03).
        if (text !== "" && (value === null || value > today())) fieldErrors[question] = "FACT_VALUE_INVALID";
        next.useBeganOn = value;
        break;
      }
    }
  }
  const first = Object.values(fieldErrors)[0];
  if (first !== undefined) return refuse(first, { fieldErrors });
  if (work.copied !== null) {
    const copied: Partial<Record<FactQuestion, boolean>> = {};
    for (const [question, confirmed] of Object.entries(work.copied) as [FactQuestion, boolean][]) {
      if (answerOf(next, question) !== answerOf(work.answers, question)) continue;
      // The box on the page is the answer: ticked, the copied value is confirmed as still true.
      void confirmed;
      copied[question] = input.reconfirmed.includes(question);
    }
    work.copied = copied;
  }
  work.answers = next;
  application.savedAt = now();
  return accept({ complete: work.questions.every((question) => answerOf(next, question) !== null) });
}

/**
 * Where a document goes on SCR-REG-04: `rules:<item>` for a document the rules ask for, `claim:<kind>:<layer>:<item>`
 * for one a claim asks for.
 */
function slotOf(application: Application, work: Work, target: string): StoredDocument | null {
  const [where, ...rest] = target.split(":");
  if (where === "rules") return work.documents.find((document) => document.item === rest[0]) ?? null;
  if (where === "claim") {
    const [kind, layer, item] = rest;
    const claim = application.claims.find((entry) => entry.kind === kind && entry.layer === layer && entry.state === "DRAFT");
    return claim?.documents.find((document) => document.item === item) ?? null;
  }
  return null;
}

/** POST /applications/{id}/evidence-items on a draft: the file's name, type and size are recorded; no file is kept. */
export function addEvidenceItem(sessionId: string, ref: string, target: string, file: ChosenFile): CommandAnswer<{ receivedOn: string }> {
  const draft = draftOf(state(sessionId), ref);
  if ("code" in draft) return refuse(draft.code);
  const { application, work } = draft;
  const slot = slotOf(application, work, target);
  if (slot === null) return refuse("EVIDENCE_NOT_REQUESTED");
  if (invalidFile(file)) return refuse("DOCUMENT_INVALID");
  const receivedOn = today();
  slot.file = { name: file.name, type: file.type, sizeBytes: file.sizeBytes };
  slot.receivedOn = receivedOn;
  application.savedAt = now();
  return accept({ receivedOn });
}

/** POST /applications/{id}/assertions: a claim on one rights layer, within the registered period. */
export function raiseAssertion(sessionId: string, ref: string, input: ClaimInput): CommandAnswer<{ layer: RightsLayer }> {
  const s = state(sessionId);
  const draft = draftOf(s, ref);
  if ("code" in draft) return refuse(draft.code);
  const { application, work } = draft;
  const kind: ClaimKind = input.kind === "DIRECT_LICENCE" ? "DIRECT_LICENCE" : "NON_USE";
  const layer = LAYERS.find((option) => option === input.layer);
  if (layer === undefined) return refuse("RIGHTS_LAYER_UNKNOWN", { field: "layer" });
  const { from, to } = input;
  if (from === null || to === null || to < from || from < work.period.from || to > work.period.to) return refuse("ASSERTION_PERIOD_INVALID", { field: "period" });
  if (application.claims.some((claim) => claim.kind === kind && claim.layer === layer && claim.state !== "WITHDRAWN")) {
    return refuse("ASSERTION_DUPLICATE", { field: "layer" });
  }
  application.claims.push({
    kind,
    layer,
    period: { from, to },
    state: "DRAFT",
    documents: [{ item: s.seed.rulebook.claimEvidence, receivedOn: null, file: null }],
  });
  application.savedAt = now();
  return accept({ layer });
}

/**
 * POST /applications/{id}/attestations, then /submissions (SCR-REG-06's one act). The confirmation must name
 * the latest review and the answers it showed; sending then checks what the contract checks. Sent, the
 * application goes to review - claim review with a claim, rulebook review otherwise - and waits there for a
 * reviewer: no decision is issued without one.
 */
export function attestAndSubmit(sessionId: string, ref: string, input: AttestInput): CommandAnswer<{ status: ApplicationStatus }> {
  const s = state(sessionId);
  const draft = draftOf(s, ref);
  if ("code" in draft) return refuse(draft.code);
  const { application, work } = draft;
  const current = digest(work);
  if (work.presentation === null || work.presentation.id !== input.presentation) return refuse("EXPLANATION_SUPERSEDED");
  if (input.factsDigest !== current || work.presentation.digest !== current) return refuse("FACTS_CHANGED_SINCE_PREVIEW");
  if (!input.confirmed || !input.changeDutyAcknowledged) return refuse("ATTESTATION_NOT_CONFIRMED");
  // Recorded once for these answers: sending again reuses it.
  if (work.attestation?.digest !== current) {
    work.attestation = { digest: current };
    application.history.unshift({ at: now(), event: "CONFIRMED" });
  }

  const missing = missingItems(application, work);
  if (missing.length > 0) return refuse("REQUIRED_ITEMS_MISSING", { missing });
  if (work.copied !== null && Object.values(work.copied).some((confirmed) => !confirmed)) return refuse("RECONFIRMATION_REQUIRED");
  if (feeFor(s, application, work) === null) return refuse("TARIFF_NOT_APPROVED");
  const governing = application.kind === "AMENDMENT" ? null : governingDecision(s, application.premisesId, work.period);
  if (governing !== null) return refuse("INTENDED_PERIOD_INVALID", { governingDecision: governing });
  // Never null here: an unanswered date is a missing item, refused above.
  const useBeganOn = work.answers.useBeganOn ?? today();

  const sentAt = now();
  const claimed = application.claims.filter((claim) => claim.state === "DRAFT");
  for (const claim of claimed) claim.state = "UNDER_REVIEW";
  // Complete on the day the application and its last document were both in: the canvas's Sala draft was sent
  // the day its last document arrived.
  const arrived = [...work.documents, ...claimed.flatMap((claim) => claim.documents)].map((document) => document.receivedOn ?? "");
  const completeOn = [today(), ...arrived].reduce((latest, day) => (day > latest ? day : latest));
  application.status = "UNDER_REVIEW";
  application.sentAt = sentAt;
  application.savedAt = null;
  application.review = claimed.length > 0 ? "CLAIM" : "RULEBOOK";
  application.dates = statement(completeOn, useBeganOn);
  application.history.unshift({
    at: sentAt,
    event: "SENT",
    route: claimed.length > 0 ? "CLAIM_REVIEW" : "RULEBOOK_REVIEW",
    claim: claimed[0]?.kind ?? null,
  });
  application.work = null;
  return accept({ status: application.status });
}

/**
 * POST /applications/{id}/evidence-items for an item a request asks for (SCR-REG-07). The last item puts a
 * reviewed application back in review with its dates stated again; on the automated route it would issue the
 * decision, which needs the tariff the mock does not have, so it is refused as TAR's absence is.
 */
export function addRequestedDocument(sessionId: string, ref: string, item: string, file: ChosenFile): CommandAnswer<{ status: ApplicationStatus }> {
  const application = find(state(sessionId), ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  const request = application.request;
  if (application.status !== "EVIDENCE_REQUIRED" || request === null) return refuse("APPLICATION_NOT_EDITABLE");
  const entry = request.items.find((candidate) => candidate.item === item);
  if (entry === undefined) return refuse("EVIDENCE_NOT_REQUESTED");
  // The request ends on its due date (SCR-REG-07: after the due date, EVIDENCE_REQUEST_CLOSED).
  if (request.closed || entry.receivedOn !== null || (request.dueOn !== null && today() > request.dueOn)) return refuse("EVIDENCE_REQUEST_CLOSED");
  if (invalidFile(file)) return refuse("DOCUMENT_INVALID");
  const last = request.items.every((candidate) => candidate === entry || candidate.receivedOn !== null);
  if (last && request.askedBy === "RIGHTONE") return refuse("TARIFF_NOT_APPROVED");
  const day = today();
  entry.receivedOn = day;
  entry.file = { name: file.name, type: file.type, sizeBytes: file.sizeBytes };
  if (last) {
    request.dueOn = null;
    application.status = "UNDER_REVIEW";
    if (application.dates !== null) application.dates = statement(day, application.dates.useBeganOn);
    application.history.unshift({ at: now(), event: "EVIDENCE_COMPLETE" });
  }
  return accept({ status: application.status });
}

/** POST /applications/{id}/withdrawals: the applicant's own; an application that has ended cannot be withdrawn. */
export function withdrawApplication(sessionId: string, ref: string): CommandAnswer<{ status: ApplicationStatus }> {
  const application = find(state(sessionId), ref);
  if (application === null) return refuse("APPLICATION_NOT_FOUND");
  if (!OPEN.includes(application.status)) return refuse("APPLICATION_ALREADY_FINAL");
  const at = now();
  application.status = "WITHDRAWN";
  application.ended = { kind: "WITHDRAWN", on: today(), at };
  for (const claim of application.claims) if (claim.state !== "WITHDRAWN") claim.state = "WITHDRAWN";
  if (application.request !== null) application.request.closed = true;
  application.history.unshift({ at, event: "WITHDRAWN" });
  return accept({ status: application.status });
}
