import { createHmac, randomBytes } from "node:crypto";
import type { LoadOutcome } from "@rightone/ui";
import type {
  AboutPageAnswer,
  AdminArea,
  AssumedPremises,
  Attempt,
  ClassificationPath,
  ClassKind,
  DeclaredPremises,
  ExemptionTested,
  FactField,
  FormFacts,
  HelpPurpose,
  HelpRoute,
  HelpRouteItem,
  IndicativeResult,
  LegalDocumentKind,
  PageKind,
  PremisesClass,
  ArtistProfile,
  DirectRecordAnswer,
  DirectRecordRoute,
  DisclosuresPage,
  NextAction,
  PublicPageAnswer,
  PublicTariff,
  PublicTrack,
  PublicVerificationOutcome,
  ScopeAnswer,
  ScopeFact,
  ScopeQuestions,
  ServiceEntitlementAnswer,
  ServiceStatusWord,
  PlayerBusinessType,
  SourceKind,
  LocalizedText,
  VersionedText,
  VersionText,
  AwaitedChange,
  CurrencyList,
  CurrencyWatch,
  DifferenceRow,
  DocumentClass,
  DocumentKind,
  DocumentList,
  DocumentRow,
  DocumentStanding,
  DocumentStatusFilter,
  HelpRouteRegister,
  NewVersionForm,
  PolicyAnswer,
  PolicyReader,
  RegisterRoute,
  RouteInput,
  SourceRef,
  VersionDetail,
  VersionInput,
  VersionLine,
  VersionPhase,
  VersionStatus,
  WatchStatus,
} from "@/lib/api/public";
import type { ProfileEntry, RecordType } from "@/lib/api/oversight";
import type { VerificationOutcome, VerifiedRecord } from "@/lib/api/verification";
import type { HelpJourney } from "@/lib/route-groups/public-pages";
import {
  ABOUT_IN_EFFECT,
  AMNESTY,
  CURRENCY_WATCHES,
  DOCUMENTS,
  DOCUMENT_VERSIONS,
  HELP_ROUTE_REGISTER,
  INDICATIVE_OFFERED,
  LEGAL_RELEASE_HOLDERS,
  NOT_OFFERED,
  PLAYER_BUSINESS_TYPES,
  PUBLICATION_PERIOD_HOURS,
  PUBLISHED_RECORDS,
  PURPOSE_JOURNEYS,
  ROUTE_CONFIRMATION_DAYS,
  TARIFF_VERSIONS,
  bodyDigestOf,
  normalisedBody,
  reportsAsAt,
  sectionKeysOf,
  sectionsOf,
  type CurrencyWatchRecord,
  type DocumentVersionRecord,
  type PublicDocument,
  type PublishedRecord,
  type PublishedVersion,
  type RegisteredHelpRoute,
  type TariffContent,
  type TariffVersion,
} from "@/lib/mock/public";
import { addDays, now, today } from "./clock";
import { reference } from "./ids";
import { recordNoticeEvent } from "./notices";
import { entitlementForDocument } from "./venue";
import { publishedRecord } from "./status-records";
import { PUBLIC_SESSION, table, type StaffRole } from "./store";

/**
 * The public service as the mock backend plays it (PUB): the pages it publishes, the scope guidance and the
 * indicative amount worked out by the tariff's rules, and the verification of a status record against the
 * published register. Nobody is signed in, so its state is the public table (`PUBLIC_SESSION`): the published
 * records and the volume counters of the verification route. Nothing a reader declares is kept.
 *
 * The tariff calculation is TAR's `ITariffCalculator.Indicate`, which this family asks and does not own; the
 * mock plays it here from the tariff the canvas states (`TARIFF_VERSIONS`), by `ALG-295` and `ALG-296` for
 * declared facts.
 */

interface Counter {
  /** The window or hour the count belongs to, as its index since the epoch. */
  period: number;
  count: number;
}

interface PublicState {
  records: Map<string, PublishedRecord>;
  limiter: {
    /** The Vietnam day the salt is for; a new day draws a new salt and forgets every counter. */
    day: string;
    salt: Buffer;
    answers: Map<string, Counter>;
    absences: Map<string, Counter>;
  };
}

const state = (): PublicState =>
  table<PublicState>(PUBLIC_SESSION, "public", () => ({
    records: new Map(PUBLISHED_RECORDS.map((record) => [record.reference, { ...record }])),
    limiter: { day: today(), salt: randomBytes(32), answers: new Map(), absences: new Map() },
  }));

const ok = <T,>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refusal = (code: string, retryable: boolean) => ({ data: null, failure: { code, traceId: null, retryable } });

// ---------------------------------------------------------------- pages

/** The five public pages, the documents of class `PAGE` (`GET /pages/{kind}`). */
const PAGE_KINDS: readonly PageKind[] = ["ABOUT", "SCOPE_GUIDE", "TARIFF", "HELP", "PLAYER_GUIDE"];

/**
 * The source kinds of a page with an approved change its text does not describe yet: each with an `OPEN` or `OVERDUE`
 * watch (`DR-488` row 2, `ALG-464` step 4), in the order the document names them.
 */
function newerSourcesOf(register: PublicRegister, kind: DocumentKind): SourceKind[] {
  const awaited = (source: SourceKind) => register.watches.some((watch) => watch.sourceKind === source && (watch.status === "OPEN" || watch.status === "OVERDUE"));
  return (documentOf(kind)?.sourceKinds ?? []).filter(awaited);
}

/**
 * `GET /pages/{kind}`, in `DR-487`'s order: a kind that names no page, then an instant asked that has not come or is not
 * one; then the published version in effect at the instant, or at the request instant, or none (`text.version` null,
 * NO_VERSION_AT_INSTANT, as `GET /legal-documents/{kind}` answers it). A draft, a submitted and a withdrawn version are
 * never candidates, so an edition approved on SCR-PUB-16 is what a reader gets from its effective instant on. Read now,
 * the page names the sources with an approved change it does not describe yet; read as at an instant, none
 * (`ALG-464` step 4). `CFG-518`'s tested default disposes of no version, so VERSION_NO_LONGER_HELD is never answered.
 * The currency sweep runs as the page is read.
 */
export function publicPage(world: string, kind: string, at: string | null): LoadOutcome<PublicPageAnswer> {
  const page = PAGE_KINDS.find((candidate) => candidate === kind);
  if (page === undefined) return refusal("PAGE_KIND_UNKNOWN", false);
  const asAt = instantOf(at);
  if (asAt === "invalid") return refusal("INSTANT_INVALID", false);
  const register = registerOf(world);
  sweep(world, register);
  return ok({
    kind: page,
    text: textAt(publishedOf(register, page), asAt),
    newerApprovedSources: asAt === null ? newerSourcesOf(register, page) : [],
    servedAt: now(),
  });
}

/**
 * `GET /pages/ABOUT`, now or as at an instant (`ALG-464`): the edition's text in the version that applies, as the policy
 * console published it, with the version now in effect beside one superseded and the next one upcoming; the sections
 * read at use from their owners, which the canvas composes for P1 (the operator, the collection-authority designation
 * pending, the instrument, mandates and participants not offered by GOV and CAT, `DR-495` row 4); and, while a change
 * to a source the page describes awaits the edition that describes it (`SM-457` `OPEN` or `OVERDUE`), the sources with a
 * more recent approved version (`FR-PUB-032`).
 */
export function aboutPage(world: string, at: string | null = null): LoadOutcome<AboutPageAnswer> {
  const answer = publicPage(world, "ABOUT", at);
  if (answer.data === null) return { data: null, failure: answer.failure };
  const { text, newerApprovedSources, servedAt } = answer.data;
  const version = text.version;
  if (version === null) return ok({ page: null });
  return ok({
    page: {
      ...ABOUT_IN_EFFECT,
      version: version.label,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      asAt: text.asAt,
      current: text.current === null ? null : { version: text.current.label, effectiveFrom: text.current.effectiveFrom },
      upcoming: text.upcoming === null ? null : { version: text.upcoming.label, effectiveFrom: text.upcoming.effectiveFrom },
      sections: version.sections,
      newerApprovedVersionExists: newerApprovedSources.length > 0,
      newerApprovedSources,
      servedAt,
    },
  });
}

/**
 * The support line and the authoritative contact, from the help route register of a world (`registerOf` below): what
 * SCR-PUB-01, 02 and 03 offer when they cannot guide the reader themselves.
 */
export function helpRoutes(world: string): LoadOutcome<readonly HelpRoute[]> {
  const register = registerOf(world);
  checkRoutes(register);
  const line = register.routes.find((route) => route.purpose === "support" && route.destinationKind === "PHONE" && route.state === "active");
  const office = authoritativeContact(register.routes);
  return ok([
    ...(line !== undefined ? [{ kind: "support_line" as const, value: line.destination, confirmedOn: dayOf(line.confirmedAt) }] : []),
    ...(office !== null ? [{ kind: "contact_email" as const, value: office.destination, confirmedOn: dayOf(office.confirmedAt) }] : []),
  ]);
}

// ---------------------------------------------------------------- the tariff (TAR, as the mock plays it)

/** The version TAR's `PublicTariffAt` answers for a date, or null when none applies (`NONE`). */
function versionAt(date: string): TariffVersion | null {
  return TARIFF_VERSIONS.find((v) => v.effectiveFrom <= date && (v.effectiveTo === null || date <= v.effectiveTo)) ?? null;
}

/** The classes, the size band and the exemption of declared facts under a content (`ALG-296`, `ALG-295` steps 3 and 4). */
function classify(content: TariffContent, facts: AssumedPremises): { path: ClassificationPath; exemption: ExemptionTested } {
  const localityClass = facts.adminArea !== null ? (content.localityOf[facts.adminArea] ?? null) : null;
  // A class kind with no value, or a declared value the content does not list, has no class (ALG-296 rows 5, 6).
  const unclassified: ClassKind[] = [];
  if (facts.premisesClass === null) unclassified.push("PREMISES_CLASS");
  if (localityClass === null) unclassified.push("ADMIN_AREA_KEY");
  const band = bandOf(content, facts.floorAreaM2);
  const { floorAtMostM2, seatsAtMost } = content.microBusiness;
  const floorMet = facts.floorAreaM2 <= floorAtMostM2;
  const seatsMet = facts.seats !== null && facts.seats <= seatsAtMost;
  return {
    path: { premisesClass: facts.premisesClass, adminArea: facts.adminArea, localityClass, band: { fromM2: band.fromM2, toM2: band.toM2 }, unclassified },
    exemption: {
      code: "MICRO_BUSINESS",
      applied: floorMet && seatsMet,
      criteria: [
        { fact: "FLOOR_AREA_M2", atMost: floorAtMostM2, value: facts.floorAreaM2, met: floorMet },
        { fact: "SEATING_CAPACITY", atMost: seatsAtMost, value: facts.seats, met: seatsMet },
      ],
    },
  };
}

function bandOf(content: TariffContent, floorAreaM2: number): TariffContent["bands"][number] {
  const band = content.bands.find((b) => b.fromM2 <= floorAreaM2 && (b.toM2 === null || floorAreaM2 < b.toM2));
  // The bands start at 0 and the last is open, and a floor area is validated as at least 0 before it gets here.
  if (band === undefined) throw new Error(`No floor-area band holds ${floorAreaM2} m²`);
  return band;
}

/** `apportion` of ALG-295: each part its whole-dong floor, the remainder to the largest part, ties to the first. */
function apportion(target: bigint, parts: readonly bigint[]): bigint[] {
  const sum = parts.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return parts.map(() => 0n);
  const shares = parts.map((p) => (target * p) / sum);
  const remainder = target - shares.reduce((a, b) => a + b, 0n);
  const largest = parts.reduce((best, p, i) => (p > (parts[best] ?? 0n) ? i : best), 0);
  shares[largest] = (shares[largest] ?? 0n) + remainder;
  return shares;
}

/** The components, cap and rounding of an in-scope calculation (`ALG-295` steps 6 to 9). */
function amounts(content: TariffContent, path: ClassificationPath, facts: AssumedPremises, exempt: boolean) {
  // Every factor is in hundredths, so the exact amount is an integer number of hundred-millionths of a dong.
  const locality = BigInt(path.localityClass !== null ? (content.localityFactorHundredths[path.localityClass] ?? 0) : 0);
  const premises = BigInt(facts.premisesClass !== null ? content.premisesClassFactorHundredths[facts.premisesClass] : 0);
  const band = BigInt(bandOf(content, facts.floorAreaM2).factorHundredths);
  const exact = content.components.map((c) => (exempt ? 0n : BigInt(content.baseAmountMinor) * BigInt(c.shareHundredths) * locality * premises * band));
  const beforeCap = exact.reduce((a, b) => a + b, 0n) / 100_000_000n;
  const partsBeforeCap = apportion(beforeCap, exact);
  const cap = BigInt(content.capMinor);
  const capApplied = beforeCap > cap;
  const parts = capApplied ? apportion(cap, partsBeforeCap) : partsBeforeCap;
  const beforeRounding = parts.reduce((a, b) => a + b, 0n);
  const unit = BigInt(content.roundingUnitMinor);
  const amount = (beforeRounding / unit) * unit;
  // The rounding difference goes to the largest charged component, so the components sum to the amount.
  if (!exempt) {
    const largest = parts.reduce((best, p, i) => (p > (parts[best] ?? 0n) ? i : best), 0);
    parts[largest] = (parts[largest] ?? 0n) + (amount - beforeRounding);
  }
  return {
    components: content.components.map((c, i) => ({ right: c.right, treatment: exempt ? ("exempt" as const) : ("charged" as const), amountMinor: Number(parts[i] ?? 0n) })),
    amountBeforeCapMinor: Number(beforeCap),
    capMinor: content.capMinor,
    capApplied,
    roundingUnitMinor: content.roundingUnitMinor,
    amountBeforeRoundingMinor: Number(beforeRounding),
    amountMinor: Number(amount),
  };
}

/** The transition rule FROM_NEXT_MONTH: a year from the first day of the month after the assessment date. */
function periodFrom(assessmentDate: string): { from: string; to: string } {
  const [year = 0, month = 1] = assessmentDate.split("-").map(Number);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(year, month, 1))), to: iso(new Date(Date.UTC(year + 1, month, 0))) };
}

// ---------------------------------------------------------------- the form's facts

const PREMISES_CLASSES: readonly PremisesClass[] = ["cafe", "bar", "shop"];
const ADMIN_AREAS: readonly AdminArea[] = ["hcm", "hn", "dn", "ct", "hue"];
const DECIMAL = /^\d+(\.\d+)?$/;
const WHOLE = /^\d+$/;

/** An ISO date, or day/month/year as the date field sends it; null when it is not a date on the calendar. */
function parseDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(text);
  const [y, m, d] = iso !== null ? [iso[1], iso[2], iso[3]] : dmy !== null ? [dmy[3], dmy[2], dmy[1]] : [];
  if (y === undefined || m === undefined || d === undefined) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const key = date.toISOString().slice(0, 10);
  return date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d) ? key : null;
}

interface Read {
  declared: DeclaredPremises;
  /** The date's form is checked first, with no read (`DR-491` evaluation order). */
  date: string | null;
}

function read(facts: FormFacts): Read {
  const date = facts.assessmentDate === "" ? today() : parseDate(facts.assessmentDate);
  return {
    date,
    declared: {
      assessmentDate: date ?? "",
      premisesClass: PREMISES_CLASSES.find((c) => c === facts.premisesClass) ?? null,
      adminArea: ADMIN_AREAS.find((a) => a === facts.adminArea) ?? null,
      floorAreaM2: facts.floorAreaM2,
      seats: facts.seats,
    },
  };
}

/**
 * The facts against the questions of the version (`DR-491` row 3, `DR-492` row 2): a class or an area outside
 * the version's value sets, a floor area that is missing or not a number of at least 0 (the size bands use it),
 * or a seating capacity that is given and not a whole number.
 */
function validate(content: TariffContent, facts: FormFacts): { invalid: FactField[]; assumed: AssumedPremises | null } {
  const invalid: FactField[] = [];
  if (facts.premisesClass !== "" && !PREMISES_CLASSES.some((c) => c === facts.premisesClass)) invalid.push("premises_class");
  if (facts.adminArea !== "" && !content.adminAreas.some((a) => a === facts.adminArea)) invalid.push("admin_area_key");
  if (!DECIMAL.test(facts.floorAreaM2)) invalid.push("floor_area_m2");
  if (facts.seats !== "" && !WHOLE.test(facts.seats)) invalid.push("seating_capacity");
  if (invalid.length > 0) return { invalid, assumed: null };
  return {
    invalid,
    assumed: {
      premisesClass: PREMISES_CLASSES.find((c) => c === facts.premisesClass) ?? null,
      adminArea: content.adminAreas.find((a) => a === facts.adminArea) ?? null,
      floorAreaM2: Number(facts.floorAreaM2),
      seats: facts.seats === "" ? null : Number(facts.seats),
    },
  };
}

// ---------------------------------------------------------------- GET /scope-questions

/**
 * The facts beside the two class kinds that a version uses, derived from its content: the floor area, required because
 * its size bands place a premises by it, and the seating capacity, which only the exemption's criteria read.
 */
function factsOf(content: TariffContent): ScopeFact[] {
  return [
    ...(content.bands.length > 0 ? [{ key: "FLOOR_AREA_M2" as const, required: true }] : []),
    { key: "SEATING_CAPACITY" as const, required: false },
  ];
}

/**
 * `GET /scope-questions` for the assessment date asked, or today when none is: a date not on the calendar is refused
 * before TAR is asked (`ASSESSMENT_INPUT_INVALID`, `@AC-FR-PUB-003-05`); then the questions of the tariff version for
 * that date, none when no version applies (`NO_RULES_FOR_DATE`), a 503 when TAR cannot answer (`DR-491` rows 1 to 3).
 */
export function scopeQuestions(asked: string | null = null): LoadOutcome<ScopeQuestions> {
  const date = asked === null || asked === "" ? today() : parseDate(asked);
  if (date === null) return refusal("ASSESSMENT_INPUT_INVALID", false);
  const version = versionAt(date);
  if (version === null) return ok({ assessmentDate: date, questions: null });
  if (version.content === null) return refusal("GUIDANCE_UNAVAILABLE", true);
  return ok({ assessmentDate: date, questions: { premisesClasses: PREMISES_CLASSES, adminAreas: version.content.adminAreas, facts: factsOf(version.content) } });
}

// ---------------------------------------------------------------- POST /scope-assessments

const NEXT_ACTION = { in_scope: "register", out_of_scope: "no-registration", indeterminate: "apply" } as const;

/** The section of the scope guide that holds each treatment's next action (`DOCUMENTS`, `SCOPE_GUIDE`'s required sections). */
const GUIDE_SECTION = { in_scope: "IN_SCOPE", out_of_scope: "OUT_OF_SCOPE", indeterminate: "INDETERMINATE" } as const;

const SUPPORT: { nextAction: NextAction; nextActionText: LocalizedText | null; guideVersion: string | null } = { nextAction: "support", nextActionText: null, guideVersion: null };

/**
 * The next action of a treatment (`DR-491` evaluation order): the section of the same name in the `SCOPE_GUIDE` version
 * in effect at the request instant, approved text rather than a string in code; with no version of the guide in effect,
 * the support route of the journey `SCOPE`, as when the guidance cannot be reached.
 */
function nextActionOf(world: string, outcome: ScopeAnswer["outcome"]): Pick<ScopeAnswer, "nextAction" | "nextActionText" | "guideVersion"> {
  const guide = textAt(publishedOf(registerOf(world), "SCOPE_GUIDE"), null).version;
  const index = guide === null ? -1 : guide.sectionKeys.indexOf(GUIDE_SECTION[outcome]);
  const section = guide === null || index < 0 ? undefined : guide.sections[index];
  if (guide === null || section === undefined) return SUPPORT;
  return { nextAction: NEXT_ACTION[outcome], nextActionText: section.body, guideVersion: guide.label };
}

/**
 * `DR-491`: what the public guidance answers for declared facts. The treatment is TAR's: in scope when both
 * class kinds have a class, indeterminate when either has none. A declared class never reaches out of scope.
 * Only the refusal of the input is a failure; every other outcome is an answer, with the next action of the world's
 * scope guide in effect.
 */
export function assessScope(world: string, facts: FormFacts): Attempt<ScopeAnswer> {
  const { declared, date } = read(facts);
  if (date === null) return { declared, answer: refusal("ASSESSMENT_INPUT_INVALID", false), invalid: ["assessment_date"] };
  const indeterminate = (cause: "NO_RULES_FOR_DATE" | "GUIDANCE_UNAVAILABLE", tariffVersion: string | null): Attempt<ScopeAnswer> => ({
    declared,
    answer: ok({
      outcome: "indeterminate",
      cause,
      assessmentDate: date,
      tariffVersion,
      basis: null,
      assumed: null,
      exemptions: [],
      // DR-491 row 1 sends the reader to the support route; row 2 to the guide's INDETERMINATE section.
      ...(cause === "GUIDANCE_UNAVAILABLE" ? SUPPORT : nextActionOf(world, "indeterminate")),
    }),
    invalid: [],
  });
  const version = versionAt(date);
  if (version === null) return indeterminate("NO_RULES_FOR_DATE", null);
  if (version.content === null) return indeterminate("GUIDANCE_UNAVAILABLE", version.version);
  const { invalid, assumed } = validate(version.content, facts);
  if (assumed === null) return { declared, answer: refusal("ASSESSMENT_INPUT_INVALID", false), invalid };
  const { path, exemption } = classify(version.content, assumed);
  const outcome = path.unclassified.length === 0 ? "in_scope" : "indeterminate";
  return {
    declared,
    answer: ok({
      outcome,
      cause: null,
      assessmentDate: date,
      tariffVersion: version.version,
      basis: path,
      assumed,
      exemptions: [exemption],
      ...nextActionOf(world, outcome),
    }),
    invalid: [],
  };
}

// ---------------------------------------------------------------- POST /indicative-amounts

/** Whether `PUB-INDICATIVE` offers the calculation (`DR-492` row 1). */
export function indicativeOffered(): boolean {
  return INDICATIVE_OFFERED;
}

/**
 * `DR-492`: the indicative amount for declared facts, every figure TAR's and labelled non-binding; no amount,
 * never 0, where the premises is not shown to be in scope. A version the mock holds no content for is TAR
 * not answering: the calculation could not be made.
 */
export function indicateAmount(facts: FormFacts): Attempt<IndicativeResult> {
  const { declared, date } = read(facts);
  const refused = (code: string, retryable: boolean, invalid: FactField[] = []): Attempt<IndicativeResult> => ({ declared, answer: refusal(code, retryable), invalid });
  if (!indicativeOffered()) return refused("INDICATIVE_NOT_OFFERED", false);
  if (date === null) return refused("ASSESSMENT_INPUT_INVALID", false, ["assessment_date"]);
  const version = versionAt(date);
  if (version === null) return refused("NO_TARIFF_FOR_DATE", false);
  if (version.content === null) return refused("TARIFF_UNAVAILABLE", true);
  const content = version.content;
  const { invalid, assumed } = validate(content, facts);
  if (assumed === null) return refused("ASSESSMENT_INPUT_INVALID", false, invalid);
  const { path, exemption } = classify(content, assumed);
  if (path.unclassified.length > 0) {
    return { declared, answer: ok({ outcome: "no_amount", treatment: "indeterminate", nextAction: "apply" }), invalid: [] };
  }
  return {
    declared,
    answer: ok({
      outcome: "indicated",
      tariffVersion: version.version,
      assessmentDate: date,
      period: periodFrom(date),
      transitionRule: "FROM_NEXT_MONTH",
      currency: content.currency,
      basis: path,
      assumed,
      exemptions: [exemption],
      ...amounts(content, path, assumed, exemption.applied),
    }),
    invalid: [],
  };
}

// ---------------------------------------------------------------- GET /verifications/certificates/{reference}

/** `ALG-456`, certificate route: a public reference, or a printout (representation) reference, Crockford base 32. */
const CERTIFICATE = /^R1-CER-[0-9]{4}-[0-9A-HJKMNP-TV-Z]{8}$/;
const PRINTOUT = /^CRP-[0-9A-HJKMNP-TV-Z]{10}$/;

/** The tested default of `PUB-VERIFICATION-CONTROLS` (`ALG-459` row 4): no version is approved. */
const ANSWERS_PER_WINDOW = 60;
const WINDOW_MS = 10 * 60_000;
const ABSENCES_PER_HOUR = 20;
const HOUR_MS = 60 * 60_000;

/** The /24 of an IPv4 address or the /56 of an IPv6 one: what one network's requests share. */
function prefixOf(address: string): string {
  const v4 = /(\d+)\.(\d+)\.(\d+)\.\d+$/.exec(address);
  if (v4 !== null) return `${v4[1]}.${v4[2]}.${v4[3]}`;
  if (!address.includes(":")) return address;
  const [head = "", tail = ""] = address.split("::");
  const left = head === "" ? [] : head.split(":");
  const right = tail === "" ? [] : tail.split(":");
  const groups = [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return groups.map((g) => g.padStart(4, "0")).join("").slice(0, 14);
}

/**
 * The bucket of an address: a keyed hash of its prefix with a salt replaced each Vietnam day, so a counter
 * cannot be turned back into an address (`SEC-482`).
 */
function bucketOf(address: string): string {
  const { limiter } = state();
  const day = today();
  if (limiter.day !== day) {
    limiter.day = day;
    limiter.salt = randomBytes(32);
    limiter.answers.clear();
    limiter.absences.clear();
  }
  return createHmac("sha256", limiter.salt).update(prefixOf(address)).digest("hex");
}

/**
 * `ALG-459`: admits the request or answers when it may retry. Windows are fixed: the ten minutes and the clock
 * hour that hold the instant (Vietnam is a whole number of hours from UTC, so they fall on the same instants).
 */
function admit(bucket: string, at: number): string | null {
  const { limiter } = state();
  const hour = Math.floor(at / HOUR_MS);
  const absences = limiter.absences.get(bucket);
  if (absences?.period === hour && absences.count >= ABSENCES_PER_HOUR) return new Date((hour + 1) * HOUR_MS).toISOString();
  const window = Math.floor(at / WINDOW_MS);
  const answers = limiter.answers.get(bucket);
  const count = answers?.period === window ? answers.count + 1 : 1;
  limiter.answers.set(bucket, { period: window, count });
  return count > ANSWERS_PER_WINDOW ? new Date((window + 1) * WINDOW_MS).toISOString() : null;
}

function countAbsence(bucket: string, at: number): void {
  const { limiter } = state();
  const hour = Math.floor(at / HOUR_MS);
  const absences = limiter.absences.get(bucket);
  limiter.absences.set(bucket, { period: hour, count: absences?.period === hour ? absences.count + 1 : 1 });
}

const answer = (outcome: LoadOutcome<NonNullable<VerificationOutcome["data"]>>, retryAfter: string | null = null): VerificationOutcome => ({ ...outcome, retryAfter });

/**
 * A public answer of the certificate route as VER keeps it (`SEC-741`, `certificate.verification_answers` with the
 * channel `PUBLIC`): nothing about who asked; the record it resolved, or the value presented where it resolved none;
 * the instant truncated to the hour; and what the answer showed, so a request to reconsider it can say what it was.
 */
export interface PublicAnswerRecord {
  reference: string;
  answeredHour: string;
  outcome: "RECORD" | "ABSENT";
  record: string | null;
  presented: string | null;
  shown: Omit<VerifiedRecord, "answerRef"> | null;
}

/** The hour an instant falls in, in Vietnam time, as an instant with its offset: "2026-10-16T10:00:00+07:00". */
function hourOf(instant: string): string {
  const local = new Date(ms(instant) + 7 * HOUR_MS).toISOString();
  return `${local.slice(0, 13)}:00:00+07:00`;
}

/**
 * `ALG-455`, certificate route: refused before any read when the request asks for more than one record, when
 * the requester is over the volume, or when the reference is not in a certificate's form; otherwise answered
 * from the published register, a record or its absence, at the instant of the lookup and with a new answer
 * reference (`VRA-`, as VER's `ALG-718` writes it), which the world keeps so the answer can be read back and
 * challenged (`publicVerificationAnswer`). The record's fields are those the disclosure profile in effect at the query
 * instant admits (`ALG-458`); the status is the answer's own (`DR-39` row 4). The register never fails in the mock, so
 * it never answers that it could not tell.
 *
 * The register is CER's, read in the browser's world (`ICertificateReader`): a record issued, suspended or
 * replaced on the console answers so here at once. Two references the PUB and VER boards answer, whose premises no
 * board names, are not CER's records; they keep the answer the register published for them.
 */
export function verifyCertificate(asked: string, address: string, world: string): VerificationOutcome {
  const at = now();
  if (asked === "" || /[*%,]/.test(asked)) return answer(refusal("ENUMERATION_NOT_PERMITTED", false));
  const bucket = bucketOf(address);
  const retryAfter = admit(bucket, Date.parse(at));
  if (retryAfter !== null) return answer(refusal("VERIFICATION_RATE_LIMITED", true), retryAfter);
  const printout = PRINTOUT.test(asked);
  if (!CERTIFICATE.test(asked) && !printout) return answer(refusal("IDENTIFIER_NOT_ACCEPTED", false));
  const records = state().records;
  const held = publishedRecord(world, asked);
  const legacy = printout ? [...records.values()].find((r) => r.printout === asked) : records.get(asked);
  const record = held ?? (legacy !== undefined && publishedRecord(world, legacy.reference) === null ? legacy : undefined);
  const register = registerOf(world);
  const answerRef = reference("VRA");
  const keep = (stored: Omit<PublicAnswerRecord, "reference" | "answeredHour">) => register.answers.set(answerRef, { reference: answerRef, answeredHour: hourOf(at), ...stored });
  if (record === undefined) {
    countAbsence(bucket, Date.parse(at));
    keep({ outcome: "ABSENT", record: null, presented: asked, shown: null });
    return answer(ok({ outcome: "absent", reference: asked, sourceAnsweredAt: at, attemptEndedAt: null, record: null, answerRef }));
  }
  const admitted = profileAt(register, "AUTHORITATIVE_PREMISES_STATUS", Date.parse(at)).admitted;
  const scanned = held !== null ? held.printout : printout ? asked : null;
  const shown: Omit<VerifiedRecord, "answerRef"> = {
    status: record.status,
    ...(admitted.has("status_since") ? { statusSince: record.statusSince } : {}),
    ...(admitted.has("valid_from") ? { validFrom: record.validFrom } : {}),
    ...(admitted.has("valid_to") ? { validTo: record.validTo } : {}),
    printout: admitted.has("representation_current") ? scanned : null,
  };
  keep({ outcome: "RECORD", record: record.reference, presented: null, shown });
  return answer(ok({ outcome: "record", reference: record.reference, sourceAnsweredAt: at, attemptEndedAt: null, record: { ...shown, answerRef } }));
}

// ---------------------------------------------------------------- the public web beyond the certificate (SCR-PUB-06 to 13)

/**
 * What a world's public service holds beyond the certificate register: every version of the nine public documents in
 * every state, the help route register and the currency watches. Seeded from the canvas; the policy console writes
 * them and the public pages of the same browser read what is published, so a version approved on SCR-PUB-16 is the
 * one SCR-PUB-10 and VEN-02 read from the instant it takes effect, and a route edited on SCR-PUB-18 is on SCR-PUB-12 at
 * once. Instants pass on every read: which version is in effect, a watch past its due instant and a route past its
 * confirmation are decided as the table is read, never by a timer.
 */
interface PublicRegister {
  versions: DocumentVersionRecord[];
  routes: RegisteredHelpRoute[];
  watches: CurrencyWatchRecord[];
  /** The certificate route's answers, by their reference (`VRA-`), as VER keeps them. */
  answers: Map<string, PublicAnswerRecord>;
  /** The versions of `PUB-DISCLOSURE-PROFILE` GOV approved in this world; none at first, its tested default (`CFG-21`). */
  profiles: DisclosureProfileVersion[];
  /** The exceptions this family raised (`EXC-PUB-02`, `04`, `05`), each with what its audit record names. */
  exceptions: PublicException[];
}

/** An exception raised and recorded (`frd/11-exceptions-and-audit.md`): no request is refused by one. */
interface PublicException {
  code: "EXC-PUB-02" | "EXC-PUB-04" | "EXC-PUB-05";
  at: string;
  /** The watch, the profile version and field, or the source the record names. */
  subject: string;
  facts: Readonly<Record<string, string | number | null>>;
}

const registerOf = (key: string): PublicRegister =>
  table<PublicRegister>(key, "public-register", () => ({
    versions: DOCUMENT_VERSIONS.map((version) => ({ ...version })),
    routes: HELP_ROUTE_REGISTER.map((route) => ({ ...route })),
    watches: CURRENCY_WATCHES.map((watch) => ({ ...watch })),
    answers: new Map(),
    profiles: [],
    exceptions: [],
  }));

function raiseException(register: PublicRegister, code: PublicException["code"], subject: string, facts: PublicException["facts"]): void {
  register.exceptions.push({ code, at: now(), subject, facts });
}

const DAY_MS = 24 * 60 * 60_000;
const ms = (instant: string): number => Date.parse(instant);

/** The calendar day of an instant, in Vietnam time. */
const dayOf = (instant: string): string => addDays(instant, 0);

/** The last calendar day, in Vietnam time, before an instant: the last day a version applied before the next took effect. */
const dayBefore = (instant: string): string => addDays(new Date(ms(instant) - 1).toISOString(), 0);

/** A document's published versions, as the public routes read them. */
function publishedOf(register: PublicRegister, kind: DocumentKind): PublishedVersion[] {
  return register.versions.flatMap((version) =>
    version.kind === kind && version.status === "PUBLISHED" && version.effectiveFrom !== null
      ? [{ label: version.label, effectiveFrom: version.effectiveFrom, sectionKeys: version.sectionKeys, sections: version.sections, digest: version.digest }]
      : [],
  );
}

const verified = <T,>(outcome: LoadOutcome<T>): PublicVerificationOutcome<T> => ({ ...outcome, retryAfter: null });
const refusedLookup = (code: string, retryable: boolean, retryAfter: string | null = null): PublicVerificationOutcome<never> => ({
  data: null,
  failure: { code, traceId: null, retryable },
  retryAfter,
});

/**
 * `DR-39` row 1 and `ALG-459`, shared by every verification route: a request for more than one record is refused
 * before anything is read, then the requester's volume is counted. Returns the refusal, or the requester's bucket.
 */
function admitLookup(asked: string, address: string, at: string): { refused: PublicVerificationOutcome<never> } | { bucket: string } {
  if (asked === "" || /[*%,]/.test(asked)) return { refused: refusedLookup("ENUMERATION_NOT_PERMITTED", false) };
  const bucket = bucketOf(address);
  const retryAfter = admit(bucket, Date.parse(at));
  return retryAfter !== null ? { refused: refusedLookup("VERIFICATION_RATE_LIMITED", true, retryAfter) } : { bucket };
}

/**
 * `ALG-234`'s printed code: the 26-character public reference, a dot, the key identifier and the 16-character tag.
 * The mock's VEN draws a reference from the references' alphabet (no 0, 1, I, L, O, U) rather than RFC 4648's, so
 * the reference admits both; the tag is RFC 4648 base 32.
 */
const PRINTED_CODE = /^[A-Z2-9]{26}\.[A-Z2-7]{17}$/;

/**
 * `SEC-253`'s link key as the mock holds it: fixed, so a code printed before a restart of the development server
 * still verifies. The key identifier is the character the printed code carries before its tag.
 */
const LINK_KEY = "rightone-mock-link-key-2026";
const LINK_KEY_ID = "K";
const RFC4648 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** `ALG-234` step 7: the first 16 RFC 4648 base 32 characters of HMAC-SHA256(link key, public reference), 80 bits. */
function linkTag(publicReference: string): string {
  const digest = createHmac("sha256", LINK_KEY).update(publicReference).digest();
  let bits = "";
  for (const byte of digest.subarray(0, 10)) bits += byte.toString(2).padStart(8, "0");
  return Array.from({ length: 16 }, (_, i) => RFC4648[parseInt(bits.slice(i * 5, i * 5 + 5), 2)]).join("");
}

/** The code a Player verification document prints and its QR code carries, for the document's public reference. */
export function printedCodeOf(publicReference: string): string {
  return `${publicReference}.${LINK_KEY_ID}${linkTag(publicReference)}`;
}

/** What VEN answers PUB for an entitlement: every field it returns, before the disclosure profile admits any. */
interface SourceEntitlement {
  statusWord: ServiceStatusWord;
  premisesName: string;
  businessType: PlayerBusinessType | null;
  locality: AdminArea;
  reference: string;
}

/**
 * The entitlement a printed code names in a world, as VEN answers PUB: the tag must verify for the reference, and the
 * document must be its service's current one; otherwise none, alike for an unknown reference and a forged tag.
 */
function entitlementForPrintedCode(world: string, printedCode: string): SourceEntitlement | null {
  const [publicReference = "", signature = ""] = printedCode.split(".");
  if (signature !== `${LINK_KEY_ID}${linkTag(publicReference)}`) return null;
  const service = entitlementForDocument(world, publicReference);
  if (service === null) return null;
  return {
    statusWord: `SERVICE_${service.status}`,
    premisesName: service.premisesName,
    businessType: PLAYER_BUSINESS_TYPES[service.premisesId] ?? null,
    locality: "hcm",
    reference: service.code,
  };
}

/**
 * `GET /verifications/service-entitlements/{reference}`: the Player route. Refused in `DR-39`'s order before VEN
 * is asked; a code not of the printed form, a certificate reference included, is IDENTIFIER_NOT_ACCEPTED. VEN
 * answers the entitlement the code names in this world, or NOT_FOUND, alike for an unknown reference and a tag that
 * does not verify; that absence is counted toward the pattern control.
 */
export function verifyServiceEntitlement(world: string, printedCode: string, address: string): PublicVerificationOutcome<ServiceEntitlementAnswer> {
  const at = now();
  const admitted = admitLookup(printedCode, address, at);
  if ("refused" in admitted) return admitted.refused;
  if (!PRINTED_CODE.test(printedCode)) return refusedLookup("IDENTIFIER_NOT_ACCEPTED", false);
  const entitlement = entitlementForPrintedCode(world, printedCode);
  if (entitlement === null) {
    countAbsence(admitted.bucket, Date.parse(at));
    return verified(ok({ outcome: "absent", printedCode, sourceAnsweredAt: at, attemptEndedAt: null, cause: null, entitlement: null }));
  }
  // The fields the disclosure profile in effect at the query instant admits (ALG-458); the status and the reference are the answer.
  const fields = profileAt(registerOf(world), "PLAYER_SERVICE_ENTITLEMENT", Date.parse(at)).admitted;
  return verified(
    ok({
      outcome: "record",
      printedCode,
      sourceAnsweredAt: at,
      attemptEndedAt: null,
      cause: null,
      entitlement: {
        statusWord: entitlement.statusWord,
        ...(fields.has("premises_name") ? { premisesName: entitlement.premisesName } : {}),
        ...(fields.has("business_type") ? { businessType: entitlement.businessType } : {}),
        ...(fields.has("locality_level") ? { locality: entitlement.locality } : {}),
        reference: entitlement.reference,
        answerRef: reference("VRA"),
      },
    }),
  );
}

/** The public reference of a licence or a proof: 1 to 64 characters of `[A-Za-z0-9._-]`; the form within that is the owner's. */
const DIRECT_REFERENCE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * `GET /verifications/licences/{reference}` and `/proofs/{reference}`. Neither LIC nor EVD offers a public reader yet
 * (`CR-PUB-02`), so a reference admitted past the refusals answers UNABLE with SOURCE_NOT_OFFERED: never that no
 * record exists, and never counted as an absence.
 */
export function verifyDirectRecord(route: DirectRecordRoute, asked: string, address: string): PublicVerificationOutcome<DirectRecordAnswer> {
  const at = now();
  const admitted = admitLookup(asked, address, at);
  if ("refused" in admitted) return admitted.refused;
  if (!DIRECT_REFERENCE.test(asked)) return refusedLookup("IDENTIFIER_NOT_ACCEPTED", false);
  return verified(ok({ route, outcome: "unable", reference: asked, attemptEndedAt: at, cause: "SOURCE_NOT_OFFERED" }));
}

/**
 * `GET /artists/{slug}`. An address not of a slug's form (1 to 80 of `[a-z0-9-]`) names no profile, which is
 * ARTIST_NOT_PUBLIC, the one answer for no profile and one not public. ART offers no public reader yet, so every
 * other profile is SOURCE_UNAVAILABLE and nothing older is shown.
 */
export function artistProfile(slug: string): LoadOutcome<ArtistProfile> {
  return /^[a-z0-9-]{1,80}$/.test(slug) ? NOT_OFFERED : refusal("ARTIST_NOT_PUBLIC", false);
}

/**
 * `GET /tracks/{id}`. An identifier longer than 64 characters names no public track (TRACK_NOT_PUBLIC). TRK offers no
 * public reader yet, so every other track is SOURCE_UNAVAILABLE and nothing older is shown.
 */
export function publicTrack(id: string): LoadOutcome<PublicTrack> {
  return id.length >= 1 && id.length <= 64 ? NOT_OFFERED : refusal("TRACK_NOT_PUBLIC", false);
}

/**
 * An instant asked for (`at`): a calendar day, read at its end or now when it is today, or an instant with its offset;
 * one that has not come, or is neither, is INSTANT_INVALID. None asked reads now.
 */
function instantOf(at: string | null): { asked: string; at: number } | null | "invalid" {
  if (at === null) return null;
  const day = parseDate(at);
  if (day !== null) return day > today() ? "invalid" : { asked: day, at: Math.min(ms(`${day}T23:59:59.999+07:00`), Date.now()) };
  const instant = /^\d{4}-\d{2}-\d{2}T/.test(at) ? ms(at) : Number.NaN;
  return Number.isNaN(instant) || instant > Date.now() ? "invalid" : { asked: at, at: instant };
}

/**
 * Each published version with its period and where it stands now (`ALG-457`), newest first. A version ends the day
 * before the next one took effect; one followed only by an upcoming version is still open-ended.
 */
function periodsOf(versions: readonly PublishedVersion[]): VersionText[] {
  const instant = Date.now();
  const ordered = [...versions].sort((a, b) => ms(a.effectiveFrom) - ms(b.effectiveFrom));
  return ordered
    .map((version, index): VersionText => {
      const next = ordered[index + 1];
      const effectiveTo = next !== undefined && ms(next.effectiveFrom) <= instant ? dayBefore(next.effectiveFrom) : null;
      const state = ms(version.effectiveFrom) > instant ? "UPCOMING" : effectiveTo !== null ? "SUPERSEDED" : "IN_EFFECT";
      return { label: version.label, state, effectiveFrom: version.effectiveFrom, effectiveTo, sectionKeys: version.sectionKeys, sections: version.sections, digest: version.digest };
    })
    .reverse();
}

/**
 * `DR-487`: the version in effect at the instant asked, or now; the version in effect now beside one superseded; the
 * next upcoming version beside the one in effect now. No version at that instant is NO_VERSION_AT_INSTANT.
 */
function textAt(versions: readonly PublishedVersion[], asAt: { asked: string; at: number } | null): VersionedText {
  const periods = periodsOf(versions);
  const instant = asAt?.at ?? Date.now();
  const version = periods.find((period) => ms(period.effectiveFrom) <= instant) ?? null;
  const inEffect = periods.find((period) => period.state === "IN_EFFECT") ?? null;
  return {
    version,
    asAt: asAt?.asked ?? null,
    current: version !== null && version.state === "SUPERSEDED" ? inEffect : null,
    upcoming: asAt === null ? ([...periods].reverse().find((period) => period.state === "UPCOMING") ?? null) : null,
  };
}

/**
 * `GET /legal-documents/{kind}`, in `DR-487`'s order: an instant asked that has not come or is not one; the privacy
 * notice, DAT's, which DAT does not offer yet; then the version that applied, or none. VEN reads the premises terms in
 * effect through this (`IPublicDocumentReader.EffectiveDocument`), so a version published on the policy console is the
 * one VEN-02 offers from its effective instant.
 */
export function legalDocument(world: string, kind: LegalDocumentKind, at: string | null): LoadOutcome<VersionedText> {
  const asAt = instantOf(at);
  if (asAt === "invalid") return refusal("INSTANT_INVALID", false);
  if (kind === "PRIVACY_NOTICE") return NOT_OFFERED;
  return ok(textAt(publishedOf(registerOf(world), kind), asAt));
}

/** `GET /legal-documents/{kind}/versions`: the published versions, newest first; the privacy notice's list is DAT's. */
export function legalDocumentVersions(world: string, kind: LegalDocumentKind): LoadOutcome<readonly VersionText[]> {
  return kind === "PRIVACY_NOTICE" ? NOT_OFFERED : ok(periodsOf(publishedOf(registerOf(world), kind)));
}

/** `GET /pages/{kind}/versions`: a public page's published versions, newest first; a kind that names no page is PAGE_KIND_UNKNOWN. */
export function pageVersions(world: string, kind: string): LoadOutcome<readonly VersionText[]> {
  const page = PAGE_KINDS.find((candidate) => candidate === kind);
  return page === undefined ? refusal("PAGE_KIND_UNKNOWN", false) : ok(periodsOf(publishedOf(registerOf(world), page)));
}

/** `GET /pages/PLAYER_GUIDE`, as in effect now or at the instant asked. */
export function playerGuide(world: string, at: string | null): LoadOutcome<VersionedText> {
  const page = publicPage(world, "PLAYER_GUIDE", at);
  return page.data === null ? { data: null, failure: page.failure } : ok(page.data.text);
}

/** The disclosures "Mở" opens, by the name the address carries. */
const DISCLOSURE_NAMES = ["audited-financial-report", "pilot-report", "tariff-publication", "mandate-list", "cost-position", "amnesty-period"];

/**
 * `GET /tariff` as at a day: the version TAR applies that day (`versionAt`, the one SCR-PUB-02 and 03 calculate under),
 * marked superseded with the version in effect today when the day asked is under an earlier one; no approved tariff
 * before the first version.
 */
function publicTariff(day: string, answeredAt: string): PublicTariff {
  const version = versionAt(day);
  if (version === null) return { state: "NO_APPROVED_TARIFF", sourceAnsweredAt: answeredAt };
  const current = versionAt(today());
  const superseded = current !== null && current.version !== version.version;
  return {
    state: superseded ? "SUPERSEDED" : "IN_EFFECT",
    version: version.version,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    current: superseded ? { version: current.version, effectiveFrom: current.effectiveFrom } : null,
    ...version.publication,
    sourceAnsweredAt: answeredAt,
  };
}

/**
 * SCR-PUB-11's reads: `GET /tariff` and `GET /disclosures/{kind}` for each section, as at today or the day asked.
 * The tariff is TAR's version for that day; REG's amnesty period is not released before it begins and is announced
 * from its approval on; each report is released from the day its owner released it. A day asked that has not come
 * is refused in the field and the page reads today; a disclosure the address names that does not exist is
 * DISCLOSURE_KIND_UNKNOWN.
 */
export function disclosuresAt(at: string | null, open: string | null): LoadOutcome<DisclosuresPage> {
  const asAt = instantOf(at);
  const asked = asAt === "invalid" || asAt === null ? null : dayOf(new Date(asAt.at).toISOString());
  const day = asked ?? today();
  const served = now();
  return ok({
    asAt: asked,
    servedAt: served,
    instantRefused: asAt === "invalid" ? at : null,
    unknownDisclosure: open !== null && !DISCLOSURE_NAMES.includes(open) ? open : null,
    tariff: ok(publicTariff(day, served)),
    amnesty: ok({
      ...AMNESTY,
      state: day >= AMNESTY.period.from ? "RELEASED" : "NOT_RELEASED",
      approvedAt: day >= AMNESTY.approvedAt.slice(0, 10) ? AMNESTY.approvedAt : null,
      sourceAnsweredAt: served,
    }),
    reports: reportsAsAt(day),
  });
}

const JOURNEYS: readonly HelpJourney[] = ["about", "scope", "tariff", "verify", "complain", "privacy", "player", "legal"];

/** The purposes in the order the public pages list them. */
const PUBLIC_PURPOSES: readonly HelpPurpose[] = ["support", "complaint", "correction", "authoritative", "privacy_information", "privacy_rights", "external_escalation", "player_guide"];

const routeItem = (route: RegisteredHelpRoute): HelpRouteItem => ({
  purpose: route.purpose,
  destinationKind: route.destinationKind,
  destination: route.destination,
  responsible: route.responsible,
  confirmedOn: dayOf(route.confirmedAt),
  replacedByAuthoritativeContact: false,
  publicAccess: route.publicAccess,
});

/**
 * The authoritative contact `DR-489` row 2 shows: the active one confirmed last, or, when none is active, the one not
 * retired confirmed last; an unconfirmed one is still shown, because a journey with no route is the failure FR-PUB-007
 * forbids.
 */
function authoritativeContact(routes: readonly RegisteredHelpRoute[]): RegisteredHelpRoute | null {
  const latest = (state: (route: RegisteredHelpRoute) => boolean) =>
    routes.filter((route) => route.purpose === "authoritative" && state(route)).sort((a, b) => ms(b.confirmedAt) - ms(a.confirmedAt))[0] ?? null;
  return latest((route) => route.state === "active") ?? latest((route) => route.state !== "retired");
}

/** The last run of the nightly check (`ALG-461`): 03:00 Vietnam time, today's or yesterday's. */
function lastNightlyRun(): number {
  const run = ms(`${today()}T03:00:00+07:00`);
  return run <= Date.now() ? run : run - DAY_MS;
}

/**
 * `ALG-461` step 1 and `DR-489` row 4, applied as the register is read: an active route whose confirmation was older
 * than `CFG-517` allows at the last nightly run is unconfirmed. The mock requests no web address, so no route fails
 * its check (row 5); only an officer's confirmation makes a route current again.
 */
function checkRoutes(register: PublicRegister): void {
  const run = lastNightlyRun();
  for (const route of register.routes) {
    if (route.state === "active" && run - ms(route.confirmedAt) > ROUTE_CONFIRMATION_DAYS * DAY_MS) {
      route.state = "unconfirmed";
      route.unconfirmedReason = "CONFIRMATION_EXPIRED";
    }
  }
}

/**
 * `GET /help-routes`, `DR-489`: for each purpose the journey offers, in the order of purposes, its confirmed public
 * routes; where it has none, the authoritative contact in its place, marked so. A purpose no journey requires is
 * offered where an active route names the journey. A journey outside the set is JOURNEY_UNKNOWN; none asked lists every
 * journey's.
 */
export function helpRouteList(world: string, journey: string | null): LoadOutcome<readonly HelpRouteItem[]> {
  const asked = JOURNEYS.find((j) => j === journey) ?? null;
  if (journey !== null && asked === null) return refusal("JOURNEY_UNKNOWN", false);
  const register = registerOf(world);
  checkRoutes(register);
  const shown = (route: RegisteredHelpRoute) => route.state === "active" && (asked === null || route.journeys.includes(asked));
  const office = authoritativeContact(register.routes);
  const purposes = PUBLIC_PURPOSES.filter((purpose) => {
    const required = asked === null ? PURPOSE_JOURNEYS[purpose].length > 0 : PURPOSE_JOURNEYS[purpose].includes(asked);
    return required || register.routes.some((route) => route.purpose === purpose && shown(route));
  });
  return ok(
    purposes.flatMap((purpose) => {
      const confirmed = register.routes.filter((route) => route.purpose === purpose && shown(route));
      if (confirmed.length > 0) return confirmed.map(routeItem);
      return office === null ? [] : [{ ...routeItem(office), purpose, replacedByAuthoritativeContact: true }];
    }),
  );
}

// ---------------------------------------------------------------- the policy console (SCR-PUB-14 to 17)

/** A member of staff acting on the public service: who they are, and the spec roles RightOne ID gives them. */
export interface PolicyActor {
  email: string;
  name: string;
  roles: readonly StaffRole[];
}

/** `DR-494`: who writes a version of each class, and who decides it. */
const AUTHOR: Readonly<Record<DocumentClass, StaffRole>> = { PAGE: "ACT-POL-PRE", LEGAL: "ACT-OPS" };
const APPROVER: Readonly<Record<DocumentClass, StaffRole>> = { PAGE: "ACT-POL-APR", LEGAL: "ACT-LGL" };
const CLASSES: readonly DocumentClass[] = ["PAGE", "LEGAL"];

const holdsAny = (actor: PolicyActor, ...roles: readonly StaffRole[]): boolean => roles.some((role) => actor.roles.includes(role));

/** GOV's `IAccountableAuthority.Holds(person, PUB-LEGAL-RELEASE)`, as the mock plays it (`CFG-520`). */
const releases = (actor: PolicyActor): boolean => actor.roles.includes("ACT-LGL") && LEGAL_RELEASE_HOLDERS.includes(actor.email);

function readerOf(actor: PolicyActor): PolicyReader {
  return {
    drafts: CLASSES.filter((documentClass) => actor.roles.includes(AUTHOR[documentClass])),
    approves: CLASSES.filter((documentClass) => actor.roles.includes(APPROVER[documentClass])),
    releasesLegal: releases(actor),
  };
}

const refuse = <T,>(code: string, field: string | null = null, values: Readonly<Record<string, string>> = {}): PolicyAnswer<T> => ({
  accepted: null,
  refusal: { code, field, values },
});
const accept = <T,>(accepted: T): PolicyAnswer<T> => ({ accepted, refusal: null });

const documentOf = (kind: string): PublicDocument | null => DOCUMENTS.find((document) => document.kind === kind) ?? null;
const versionsOf = (register: PublicRegister, kind: DocumentKind) => register.versions.filter((version) => version.kind === kind);
const isOpen = (version: DocumentVersionRecord) => version.status === "DRAFT" || version.status === "SUBMITTED";

/** A published version's place now (`ALG-457`): upcoming before its instant, superseded once a later one has taken effect. */
function phaseOf(register: PublicRegister, version: DocumentVersionRecord): VersionPhase | null {
  if (version.status !== "PUBLISHED" || version.effectiveFrom === null) return null;
  const from = ms(version.effectiveFrom);
  if (from > Date.now()) return "UPCOMING";
  const later = versionsOf(register, version.kind).some(
    (other) => other.status === "PUBLISHED" && other.effectiveFrom !== null && ms(other.effectiveFrom) > from && ms(other.effectiveFrom) <= Date.now(),
  );
  return later ? "SUPERSEDED" : "IN_EFFECT";
}

const lineOf = (register: PublicRegister, version: DocumentVersionRecord): VersionLine => ({
  id: version.id,
  label: version.label,
  status: version.status,
  phase: phaseOf(register, version),
  effectiveFrom: version.effectiveFrom,
  draftedBy: version.draftedBy?.name ?? null,
  savedAt: version.savedAt,
  submittedAt: version.submittedAt,
});

function standingOf(register: PublicRegister, kind: DocumentKind): DocumentStanding {
  const versions = versionsOf(register, kind);
  const inEffect = versions.find((version) => phaseOf(register, version) === "IN_EFFECT");
  const open = versions.find(isOpen);
  return {
    inEffect: inEffect !== undefined ? lineOf(register, inEffect) : null,
    upcoming: versions
      .filter((version) => phaseOf(register, version) === "UPCOMING")
      .sort((a, b) => ms(a.effectiveFrom ?? "") - ms(b.effectiveFrom ?? ""))
      .map((version) => lineOf(register, version)),
    open: open !== undefined ? lineOf(register, open) : null,
  };
}

/** The changes a document must describe that no edition serves yet: its source kinds' open and overdue watches. */
function awaitingFor(register: PublicRegister, document: PublicDocument): AwaitedChange[] {
  return register.watches.flatMap((watch) =>
    document.sourceKinds.includes(watch.sourceKind) && (watch.status === "OPEN" || watch.status === "OVERDUE") && watch.dueAt !== null
      ? [{ kind: watch.sourceKind, ref: watch.versionRef, status: watch.status, dueAt: watch.dueAt }]
      : [],
  );
}

/**
 * `GET /documents`: every document with its version in effect, its upcoming versions and its open version. The list is
 * nine rows, one page, so it issues no cursor and any cursor presented is one it did not issue.
 */
export function documentList(
  key: string,
  actor: PolicyActor,
  filter: { documentClass: DocumentClass | null; status: DocumentStatusFilter | null; cursor: string | null },
): LoadOutcome<DocumentList> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS", "ACT-LGL")) return refusal("NOT_AUTHORISED", false);
  if (filter.cursor !== null) return refusal("CURSOR_INVALID", false);
  const register = registerOf(key);
  const rows: DocumentRow[] = DOCUMENTS.filter((document) => filter.documentClass === null || document.documentClass === filter.documentClass)
    .filter((document) => filter.status === null || versionsOf(register, document.kind).some((version) => version.status === filter.status))
    .map((document) => ({ kind: document.kind, documentClass: document.documentClass, ...standingOf(register, document.kind) }));
  return ok({
    rows,
    documents: DOCUMENTS.length,
    awaitingApproval: register.versions.filter((version) => version.status === "SUBMITTED").length,
    filter: { documentClass: filter.documentClass, status: filter.status },
    reader: readerOf(actor),
  });
}

/** The label a new version is offered: the next number after the document's last ("4" after "3", "2026.5" after "2026.4"). */
function nextLabel(versions: readonly DocumentVersionRecord[], documentClass: DocumentClass): string {
  const year = Number(today().slice(0, 4));
  const yearly = versions.flatMap((version) => {
    const match = /^(\d{4})\.(\d+)$/.exec(version.label);
    return match === null ? [] : [{ year: Number(match[1]), n: Number(match[2]) }];
  });
  if (yearly.length > 0) {
    const last = yearly.reduce((a, b) => (b.year > a.year || (b.year === a.year && b.n > a.n) ? b : a));
    return last.year < year ? `${year}.1` : `${last.year}.${last.n + 1}`;
  }
  const numbered = versions.flatMap((version) => (/^\d+$/.test(version.label) ? [Number(version.label)] : []));
  if (numbered.length > 0) return String(Math.max(...numbered) + 1);
  return documentClass === "LEGAL" ? "1" : `${year}.1`;
}

/** The latest published text a document holds, which a new version starts from. */
function latestText(register: PublicRegister, kind: DocumentKind): DocumentVersionRecord | null {
  return (
    versionsOf(register, kind)
      .filter((version) => version.status === "PUBLISHED" && version.body !== null && version.effectiveFrom !== null)
      .sort((a, b) => ms(b.effectiveFrom ?? "") - ms(a.effectiveFrom ?? ""))[0] ?? null
  );
}

/** SCR-PUB-15 opened from "Soạn phiên bản mới": the document's rules, the text it starts from, its label. */
export function newVersionForm(key: string, actor: PolicyActor, kind: string): LoadOutcome<NewVersionForm> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-OPS")) return refusal("NOT_AUTHORISED", false);
  const document = documentOf(kind);
  if (document === null) return refusal("DOCUMENT_NOT_FOUND", false);
  const register = registerOf(key);
  sweep(key, register);
  const start = latestText(register, document.kind);
  return ok({
    kind: document.kind,
    documentClass: document.documentClass,
    requiredSections: document.requiredSections,
    sourceKinds: document.sourceKinds,
    startFrom: start !== null && start.body !== null ? { label: start.label, body: start.body, sectionKeys: sectionKeysOf(start.body.vi) } : null,
    suggestedLabel: nextLabel(versionsOf(register, document.kind), document.documentClass),
    standing: standingOf(register, document.kind),
    awaiting: awaitingFor(register, document),
    reader: readerOf(actor),
  });
}

/** Each section of a version's text by its key (`ALG-462`), with its heading and text in both languages. */
function keyedSections(version: DocumentVersionRecord): { key: string; heading: { vi: string; en: string }; body: { vi: string; en: string } }[] {
  if (version.body === null) return [];
  const keys = sectionKeysOf(version.body.vi);
  return sectionsOf(version.body).map((section, index) => ({ key: keys[index] ?? section.id, heading: section.heading, body: section.body }));
}

/** The sections changed between the version compared against and the one read, in the order of the one read. */
function differenceOf(read: DocumentVersionRecord, against: DocumentVersionRecord | null): DifferenceRow[] {
  const mine = keyedSections(read);
  const theirs = against !== null ? keyedSections(against) : [];
  const rows: DifferenceRow[] = mine.map((section) => {
    const before = theirs.find((other) => other.key === section.key) ?? null;
    return { key: section.key, heading: section.heading, inEffect: before?.body ?? null, read: section.body, changed: before === null || before.body.vi !== section.body.vi };
  });
  for (const section of theirs) {
    if (!mine.some((other) => other.key === section.key)) rows.push({ key: section.key, heading: section.heading, inEffect: section.body, read: null, changed: true });
  }
  return rows;
}

/** The version a reader compares one against: the version in effect, or for the version in effect, the one before it. */
function comparedWith(register: PublicRegister, version: DocumentVersionRecord): DocumentVersionRecord | null {
  const inEffect = versionsOf(register, version.kind).find((other) => phaseOf(register, other) === "IN_EFFECT") ?? null;
  if (inEffect !== null && inEffect.id !== version.id) return inEffect;
  const from = ms(version.effectiveFrom ?? "");
  return (
    versionsOf(register, version.kind)
      .filter((other) => other.status === "PUBLISHED" && other.effectiveFrom !== null && ms(other.effectiveFrom) < from)
      .sort((a, b) => ms(b.effectiveFrom ?? "") - ms(a.effectiveFrom ?? ""))[0] ?? null
  );
}

/** `GET /document-versions/{id}`: the version whole, its document's rules and the difference from the version in effect. */
export function documentVersion(key: string, actor: PolicyActor, id: string): LoadOutcome<VersionDetail> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS", "ACT-LGL")) return refusal("NOT_AUTHORISED", false);
  const register = registerOf(key);
  sweep(key, register);
  const version = register.versions.find((candidate) => candidate.id === id);
  const document = version !== undefined ? documentOf(version.kind) : null;
  if (version === undefined || document === null) return refusal("VERSION_NOT_FOUND", false);
  const against = comparedWith(register, version);
  return ok({
    id: version.id,
    kind: version.kind,
    documentClass: document.documentClass,
    label: version.label,
    status: version.status,
    phase: phaseOf(register, version),
    body: version.body,
    sections: version.body !== null ? sectionsOf(version.body) : version.sections,
    sectionKeys: version.body !== null ? sectionKeysOf(version.body.vi) : version.sectionKeys,
    requiredSections: document.requiredSections,
    sourceKinds: document.sourceKinds,
    sourceRefs: version.sourceRefs,
    effectiveFrom: version.effectiveFrom,
    digest: version.digest,
    draftedBy: version.draftedBy?.name ?? null,
    savedAt: version.savedAt,
    submittedAt: version.submittedAt,
    decidedBy: version.decidedBy?.name ?? null,
    decidedAt: version.decidedAt,
    lastDecision: version.lastDecision,
    decisionReason: version.decisionReason,
    publishedAt: version.publishedAt,
    withdrawnBy: version.withdrawnBy?.name ?? null,
    withdrawnAt: version.withdrawnAt,
    withdrawalReason: version.withdrawalReason,
    standing: standingOf(register, version.kind),
    difference: { against: against?.label ?? null, held: against === null || against.body !== null, rows: differenceOf(version, against !== null && against.body !== null ? against : null) },
    awaiting: awaitingFor(register, document),
    reader: { ...readerOf(actor), isAuthor: version.draftedBy?.email === actor.email },
  });
}

/** The text as the version holds it: as typed, in every language, with the sections and keys read from it. */
function written(body: string): Pick<DocumentVersionRecord, "body" | "sections" | "sectionKeys"> {
  const text = { vi: body, en: body };
  return { body: text, sections: sectionsOf(text), sectionKeys: sectionKeysOf(body) };
}

/** A version's form, refused in the order its endpoint evaluates the label, the text and the sources. */
function checkInput(register: PublicRegister, document: PublicDocument, input: VersionInput, self: string | null): PolicyAnswer<never> | { label: string; body: string; sources: SourceRef[] } {
  const label = input.label.trim();
  if (versionsOf(register, document.kind).some((version) => version.label === label && version.id !== self)) return refuse("VERSION_LABEL_EXISTS", "version_label", { version: label });
  const body = normalisedBody(input.body).trim();
  if (body === "") return refuse("BODY_REQUIRED", "body");
  const sources = input.sources.filter((source) => source.ref.trim() !== "").map((source) => ({ kind: source.kind, ref: source.ref.trim() }));
  if (sources.some((source) => !document.sourceKinds.includes(source.kind))) return refuse("SOURCE_KIND_INVALID", "sources");
  return { label, body, sources };
}

/**
 * `POST /documents/{id}/versions`, `SM-455` transition 1: refused in the endpoint's order, the author's role for the
 * document's class, one open version per document, a label not used, a text, sources the document describes.
 */
export function draftVersion(key: string, actor: PolicyActor, kind: string, input: VersionInput): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const document = documentOf(kind);
  if (document === null) return refuse("DOCUMENT_NOT_FOUND");
  if (!actor.roles.includes(AUTHOR[document.documentClass])) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  const open = versionsOf(register, document.kind).find(isOpen);
  if (open !== undefined) return refuse("DRAFT_EXISTS", null, { version: open.label, id: open.id });
  const checked = checkInput(register, document, input, null);
  if ("refusal" in checked) return checked;
  const at = now();
  const id = reference("DV");
  register.versions.push({
    id,
    kind: document.kind,
    label: checked.label,
    status: "DRAFT",
    ...written(checked.body),
    digest: null,
    sourceRefs: checked.sources,
    effectiveFrom: null,
    draftedBy: { email: actor.email, name: actor.name },
    savedAt: at,
    submittedAt: null,
    decidedBy: null,
    decidedAt: null,
    lastDecision: null,
    decisionReason: null,
    plainLanguageConfirmed: false,
    publishedAt: null,
    withdrawnBy: null,
    withdrawnAt: null,
    withdrawalReason: null,
  });
  return accept({ id });
}

/** The version a command names, with its document; null when there is none. */
function found(register: PublicRegister, id: string): { version: DocumentVersionRecord; document: PublicDocument } | null {
  const version = register.versions.find((candidate) => candidate.id === id);
  const document = version !== undefined ? documentOf(version.kind) : null;
  return version !== undefined && document !== null ? { version, document } : null;
}

/** `PUT /document-versions/{id}`, `SM-455` transition 2: the author's draft only. */
export function saveVersion(key: string, actor: PolicyActor, id: string, input: VersionInput): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  const target = found(register, id);
  if (target === null) return refuse("VERSION_NOT_FOUND");
  const { version, document } = target;
  if (version.draftedBy?.email !== actor.email) return refuse("NOT_AUTHORISED");
  if (version.status !== "DRAFT") return refuse("VERSION_NOT_EDITABLE");
  const checked = checkInput(register, document, input, version.id);
  if ("refusal" in checked) return checked;
  Object.assign(version, { label: checked.label, ...written(checked.body), sourceRefs: checked.sources, savedAt: now() });
  return accept({ id });
}

/** An instant as the date field sends it (`2026-10-15T16:30+07:00`), with its offset; null when it is not one. */
function instantField(text: string | null): string | null {
  if (text === null) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?([+-]\d{2}:\d{2})$/.exec(text.trim());
  if (match === null) return null;
  const instant = `${match[1] ?? ""}T${match[2] ?? ""}:${match[3] ?? ""}:00${match[4] ?? ""}`;
  return Number.isNaN(ms(instant)) ? null : instant;
}

/**
 * `POST /document-versions/{id}/submissions`, `SM-455` transition 3: by the author, with a text, every section the
 * document requires (`DR-494` row 7, naming each missing one) and an effective instant not before now. The text is
 * frozen and digested (`ALG-462`).
 */
export function submitVersion(key: string, actor: PolicyActor, id: string, effectiveFrom: string | null): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  const target = found(register, id);
  if (target === null) return refuse("VERSION_NOT_FOUND");
  const { version, document } = target;
  if (version.draftedBy?.email !== actor.email) return refuse("NOT_AUTHORISED");
  if (version.status !== "DRAFT") return refuse("VERSION_NOT_EDITABLE");
  const body = version.body?.vi ?? "";
  if (body.trim() === "") return refuse("BODY_REQUIRED", "body");
  const keys = sectionKeysOf(body);
  const missing = document.requiredSections.filter((section) => !keys.includes(section));
  if (missing.length > 0) return refuse("SECTIONS_MISSING", "body", { sections: missing.join(", ") });
  const instant = instantField(effectiveFrom);
  if (instant === null || ms(instant) < Date.now()) return refuse("EFFECTIVE_DATE_INVALID", "effective_from");
  const at = now();
  Object.assign(version, { status: "SUBMITTED" satisfies VersionStatus, effectiveFrom: instant, digest: bodyDigestOf(body), submittedAt: at, savedAt: at });
  return accept({ id });
}

/** How often `PublicDisclosure.CheckCurrency` runs (`ALG-460`): a raise COM did not take is asked again on its next run. */
const SWEEP_INTERVAL_MS = 5 * 60_000;

/** `EXC-PUB-02`'s audit record: the change, its approval and the time it has waited (`frd/11-exceptions-and-audit.md`). */
function overdueRaised(register: PublicRegister, watch: CurrencyWatchRecord): void {
  raiseException(register, "EXC-PUB-02", watch.id, { sourceKind: watch.sourceKind, version: watch.versionRef, approvedAt: watch.approvedAt, elapsedSeconds: elapsedOf(watch) });
}

/**
 * `NTF-PUB-01` to the policy owner through COM (`INoticeObligations.Raise`, `ALG-460` step 6), under the occurrence key
 * `PUB-CURRENCY-` + the watch + its reopening instant, or its overdue instant where it was never reopened, so a watch
 * reopened late is a new occurrence. COM's answer is stored as `notice_ref`; a raise COM does not take - in P1 this
 * family is not among its raising modules (`CR-PUB-02`), so it holds no class for the event - leaves it empty, and the
 * next run asks again (`@AC-FR-PUB-032-04`).
 */
function notifyOwner(key: string, watch: CurrencyWatchRecord): void {
  if (watch.noticeRef !== null || (watch.noticeTriedAt !== null && Date.now() - ms(watch.noticeTriedAt) < SWEEP_INTERVAL_MS)) return;
  const since = watch.reopenedAt ?? watch.overdueAt ?? now();
  watch.noticeTriedAt = now();
  watch.noticeRef = recordNoticeEvent(key, {
    sourceModule: "PUB",
    eventKind: "publication_overdue",
    occurrenceRef: `PUB-CURRENCY-${watch.id}-${since}`,
    occurredAt: since,
    subjectKind: "currency_watch",
    subjectRef: watch.id,
    recipientPartyId: null,
    destination: null,
    facts: {
      by: dayOf(watch.dueAt ?? since),
      sourceKind: watch.sourceKind,
      version: watch.versionRef,
      approvedAt: watch.approvedAt ?? "",
      dueAt: watch.dueAt ?? "",
      elapsedSeconds: elapsedOf(watch) ?? 0,
    },
  });
}

/**
 * `ALG-460` steps 5 and 6, as a read or a publication meets them: an open watch past its due instant is overdue from it,
 * with `EXC-PUB-02` recorded; and the policy owner is told of each overdue watch whose notice COM has not taken yet.
 */
function sweep(key: string, register: PublicRegister): void {
  for (const watch of register.watches) {
    if (watch.status === "OPEN" && watch.dueAt !== null && ms(watch.dueAt) < Date.now()) {
      watch.status = "OVERDUE";
      watch.overdueAt = watch.dueAt;
      overdueRaised(register, watch);
    }
  }
  for (const watch of register.watches) if (watch.status === "OVERDUE") notifyOwner(key, watch);
}

/** `DR-488` rows 3 and 5: a watch the published version names is reached, in time or late against its due instant. */
function reach(watch: CurrencyWatchRecord, version: DocumentVersionRecord): void {
  watch.status = watch.dueAt !== null && version.publishedAt !== null && ms(version.publishedAt) > ms(watch.dueAt) ? "REACHED_LATE" : "REACHED";
  watch.reachedAt = version.publishedAt;
  watch.reachedByVersion = version.id;
}

const names = (version: DocumentVersionRecord, watch: CurrencyWatchRecord) =>
  version.sourceRefs.some((source) => source.kind === watch.sourceKind && source.ref === watch.versionRef);

/**
 * `POST /document-versions/{id}/decisions`, `DR-494` in its evaluation order. An approval publishes the version
 * (`SM-455` transition 4) and closes the watches its sources name (`SM-457` transitions 3 to 5); a return sends it back
 * to its author with the reason, its digest and effective instant emptied (transition 5).
 */
export function decideVersion(
  key: string,
  actor: PolicyActor,
  id: string,
  input: { decision: "APPROVE" | "RETURN"; plainLanguageConfirmed: boolean; reason: string },
): PolicyAnswer<{ id: string; status: VersionStatus }> {
  if (!holdsAny(actor, "ACT-POL-APR", "ACT-LGL")) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  const target = found(register, id);
  if (target === null) return refuse("VERSION_NOT_FOUND");
  const { version, document } = target;
  if (!actor.roles.includes(APPROVER[document.documentClass])) return refuse("NOT_AUTHORISED");
  if (version.draftedBy?.email === actor.email) return refuse("SEGREGATION_REQUIRED");
  if (version.status !== "SUBMITTED") return refuse("VERSION_NOT_SUBMITTED");
  const at = now();
  const person = { email: actor.email, name: actor.name };
  if (input.decision === "RETURN") {
    const reason = input.reason.trim();
    if (reason === "") return refuse("REASON_REQUIRED", "reason");
    Object.assign(version, { status: "DRAFT" satisfies VersionStatus, decidedBy: person, decidedAt: at, lastDecision: "RETURN", decisionReason: reason, digest: null, effectiveFrom: null });
    return accept({ id, status: version.status });
  }
  if (document.documentClass === "LEGAL" && !releases(actor)) return refuse("NOT_AUTHORISED");
  const from = ms(version.effectiveFrom ?? "");
  if (Number.isNaN(from) || from < Date.now()) return refuse("EFFECTIVE_DATE_INVALID", "effective_from");
  const later = versionsOf(register, version.kind).find((other) => other.status === "PUBLISHED" && other.effectiveFrom !== null && ms(other.effectiveFrom) >= from);
  if (later !== undefined) return refuse("EFFECTIVE_DATE_NOT_LATEST", "effective_from", { version: later.label });
  if (document.documentClass === "PAGE" && !input.plainLanguageConfirmed) return refuse("PLAIN_LANGUAGE_REVIEW_REQUIRED", "plain_language_confirmed");
  Object.assign(version, {
    status: "PUBLISHED" satisfies VersionStatus,
    decidedBy: person,
    decidedAt: at,
    lastDecision: "APPROVE",
    decisionReason: null,
    plainLanguageConfirmed: document.documentClass === "PAGE",
    publishedAt: at,
  });
  // SM-457 transitions 3 to 5: each watch the version names closes. One still OPEN past its due instant is recorded
  // overdue and reached late at once, raising EXC-PUB-02 for the record and no notice: the change is served now.
  for (const watch of register.watches) {
    if (!names(version, watch) || (watch.status !== "OPEN" && watch.status !== "OVERDUE")) continue;
    if (watch.status === "OPEN" && watch.dueAt !== null && ms(watch.dueAt) < Date.now()) {
      watch.status = "OVERDUE";
      watch.overdueAt = watch.dueAt;
      overdueRaised(register, watch);
    }
    reach(watch, version);
  }
  sweep(key, register);
  return accept({ id, status: version.status });
}

/**
 * `POST /document-versions/{id}/withdrawals`, in the endpoint's order: a draft by its author or an approver of its
 * class (`SM-455` transition 6); a published version before it takes effect, by an approver of its class who is not
 * its author and holds the release decision for a legal one (transition 7), moving each watch it reached to another
 * published version naming the change, or reopening it (`SM-457` transition 7). A submitted version is returned, not
 * withdrawn.
 */
export function withdrawVersion(key: string, actor: PolicyActor, id: string, reason: string): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-OPS", "ACT-POL-APR", "ACT-LGL")) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  const target = found(register, id);
  if (target === null) return refuse("VERSION_NOT_FOUND");
  const { version, document } = target;
  const author = version.draftedBy?.email === actor.email;
  const approver = actor.roles.includes(APPROVER[document.documentClass]);
  const published = version.status === "PUBLISHED";
  if (!(author || approver) || (published && document.documentClass === "LEGAL" && !releases(actor))) return refuse("NOT_AUTHORISED");
  if (published && author) return refuse("SEGREGATION_REQUIRED");
  if (published && ms(version.effectiveFrom ?? "") <= Date.now()) return refuse("VERSION_ALREADY_IN_EFFECT");
  if (version.status === "SUBMITTED" || version.status === "WITHDRAWN") return refuse("VERSION_NOT_EDITABLE");
  const why = reason.trim();
  if (why === "") return refuse("REASON_REQUIRED", "reason");
  Object.assign(version, { status: "WITHDRAWN" satisfies VersionStatus, withdrawnBy: { email: actor.email, name: actor.name }, withdrawnAt: now(), withdrawalReason: why });
  if (published) {
    for (const watch of register.watches) {
      if (watch.reachedByVersion !== version.id) continue;
      const other = register.versions
        .filter((candidate) => candidate.status === "PUBLISHED" && candidate.publishedAt !== null && names(candidate, watch))
        .sort((a, b) => ms(a.publishedAt ?? "") - ms(b.publishedAt ?? ""))[0];
      if (other !== undefined) {
        reach(watch, other);
        continue;
      }
      watch.reachedAt = null;
      watch.reachedByVersion = null;
      if (watch.dueAt !== null && ms(watch.dueAt) < Date.now()) {
        // Reopened past its due instant: overdue again, the owner told again under a new occurrence (AC-FR-PUB-031-13).
        watch.status = "OVERDUE";
        watch.overdueAt ??= watch.dueAt;
        watch.reopenedAt = now();
        watch.noticeRef = null;
        watch.noticeTriedAt = null;
        overdueRaised(register, watch);
        notifyOwner(key, watch);
      } else watch.status = "OPEN";
    }
  }
  return accept({ id });
}

/** The start of a watch's measure: its approval, or its observation where the owner gave none; a baseline is not measured. */
function elapsedOf(watch: CurrencyWatchRecord): number | null {
  if (watch.measuredFrom === "BASELINE" || watch.status === "CANCELLED") return null;
  const start = watch.measuredFrom === "APPROVAL" && watch.approvedAt !== null ? ms(watch.approvedAt) : ms(watch.observedAt);
  const end = watch.reachedAt !== null ? ms(watch.reachedAt) : Date.now();
  return Math.max(0, Math.round((end - start) / 1000));
}

const WATCH_ORDER: Readonly<Record<WatchStatus, number>> = { OVERDUE: 0, OPEN: 1, REACHED_LATE: 2, REACHED: 2, CANCELLED: 2 };

/**
 * `GET /currency-watches`: open and overdue first, nearest due first, then the rest newest first, each with the time it
 * took. The sweep's overdue step runs as the list is read. A period that ends before it starts is PERIOD_INVALID; the
 * list is one page, so any cursor is one it did not issue.
 */
export function currencyWatches(
  key: string,
  actor: PolicyActor,
  filter: { status: WatchStatus | null; from: string | null; to: string | null; cursor: string | null },
): LoadOutcome<CurrencyList> {
  if (!holdsAny(actor, "ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS")) return refusal("NOT_AUTHORISED", false);
  if (filter.cursor !== null) return refusal("CURSOR_INVALID", false);
  if (filter.from !== null && filter.to !== null && filter.to < filter.from) return refusal("PERIOD_INVALID", false);
  const register = registerOf(key);
  sweep(key, register);
  const day = (watch: CurrencyWatchRecord) => dayOf(watch.approvedAt ?? watch.observedAt);
  const rows: CurrencyWatch[] = register.watches
    .filter((watch) => filter.status === null || watch.status === filter.status)
    .filter((watch) => (filter.from === null || day(watch) >= filter.from) && (filter.to === null || day(watch) <= filter.to))
    .sort((a, b) => {
      const rank = WATCH_ORDER[a.status] - WATCH_ORDER[b.status];
      if (rank !== 0) return rank;
      if (WATCH_ORDER[a.status] < 2) return ms(a.dueAt ?? "") - ms(b.dueAt ?? "");
      return ms(b.approvedAt ?? b.observedAt) - ms(a.approvedAt ?? a.observedAt);
    })
    .map((watch) => {
      const by = watch.reachedByVersion !== null ? register.versions.find((version) => version.id === watch.reachedByVersion) : undefined;
      return {
        id: watch.id,
        sourceKind: watch.sourceKind,
        versionRef: watch.versionRef,
        approvedAt: watch.approvedAt,
        observedAt: watch.observedAt,
        measuredFrom: watch.measuredFrom,
        dueAt: watch.dueAt,
        status: watch.status,
        reachedAt: watch.reachedAt,
        reachedBy: by !== undefined ? { id: by.id, kind: by.kind, label: by.label } : null,
        overdueAt: watch.overdueAt,
        reopenedAt: watch.reopenedAt,
        cancelledAt: watch.cancelledAt,
        cancelReason: watch.cancelReason,
        noticeRef: watch.noticeRef,
        elapsedSeconds: elapsedOf(watch),
      };
    });
  return ok({ rows, periodHours: PUBLICATION_PERIOD_HOURS, sweptAt: now(), filter: { status: filter.status, from: filter.from, to: filter.to } });
}

// ---------------------------------------------------------------- the help route register (SCR-PUB-18)

/** The purposes in SCR-PUB-18's order. */
const REGISTER_PURPOSES: readonly HelpPurpose[] = ["complaint", "support", "correction", "privacy_information", "privacy_rights", "external_escalation", "player_guide", "authoritative"];
const STATE_ORDER: Readonly<Record<RegisteredHelpRoute["state"], number>> = { unconfirmed: 0, active: 1, retired: 2 };

const lastAuthoritative = (routes: readonly RegisteredHelpRoute[], route: RegisteredHelpRoute) =>
  route.purpose === "authoritative" && route.state !== "retired" && routes.filter((other) => other.purpose === "authoritative" && other.state !== "retired").length <= 1;

/**
 * `GET /help-route-register`: every route in every state, unconfirmed first, then by purpose, retired last; the nightly
 * check is applied as it is read. The register is one page, so any cursor is one it did not issue.
 */
export function helpRouteRegister(
  key: string,
  actor: PolicyActor,
  filter: { state: RegisterRoute["state"] | null; purpose: HelpPurpose | null; cursor: string | null },
): LoadOutcome<HelpRouteRegister> {
  if (!holdsAny(actor, "ACT-OPS")) return refusal("NOT_AUTHORISED", false);
  if (filter.cursor !== null) return refusal("CURSOR_INVALID", false);
  const register = registerOf(key);
  checkRoutes(register);
  const all = register.routes;
  const routes: RegisterRoute[] = all
    .filter((route) => (filter.state === null || route.state === filter.state) && (filter.purpose === null || route.purpose === filter.purpose))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || REGISTER_PURPOSES.indexOf(a.purpose) - REGISTER_PURPOSES.indexOf(b.purpose) || a.id.localeCompare(b.id))
    .map((route) => ({ ...route, lastAuthoritative: lastAuthoritative(all, route) }));
  const count = (state: RegisteredHelpRoute["state"]) => all.filter((route) => route.state === state).length;
  return ok({
    routes,
    counts: { all: all.length, active: count("active"), unconfirmed: count("unconfirmed"), retired: count("retired") },
    filter: { state: filter.state, purpose: filter.purpose },
    confirmationDays: ROUTE_CONFIRMATION_DAYS,
  });
}

const DESTINATION_KINDS: readonly RegisteredHelpRoute["destinationKind"][] = ["URL", "PHONE", "EMAIL", "POSTAL"];

/**
 * A route's destination in the form its kind requires (`DESTINATION_INVALID`, naming the field): a web address from
 * https:// (held without it, as the public pages write it), a telephone number of 8 to 15 digits, an e-mail address,
 * a postal address of at least ten characters, and a responsible destination; journeys and purpose in their sets.
 */
function routeFields(input: RouteInput, purposeAsked: boolean): PolicyAnswer<never> | Omit<RegisteredHelpRoute, "id" | "confirmedAt" | "confirmedBy" | "state" | "unconfirmedReason" | "retiredAt" | "retiredBy" | "retirementReason"> {
  const purpose = REGISTER_PURPOSES.find((candidate) => candidate === input.purpose);
  if (purposeAsked && purpose === undefined) return refuse("DESTINATION_INVALID", "route_kind");
  const journeys = JOURNEYS.filter((journey) => input.journeys.includes(journey));
  if (journeys.length === 0 || journeys.length !== new Set(input.journeys).size) return refuse("DESTINATION_INVALID", "journeys");
  const kind = DESTINATION_KINDS.find((candidate) => candidate === input.destinationKind);
  if (kind === undefined) return refuse("DESTINATION_INVALID", "destination_kind");
  const typed = input.destination.trim();
  const digits = typed.replace(/\D/g, "").length;
  const valid =
    kind === "URL"
      ? /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(typed)
      : kind === "PHONE"
        ? /^\+?[0-9][0-9 .]*[0-9]$/.test(typed) && digits >= 8 && digits <= 15
        : kind === "EMAIL"
          ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(typed)
          : typed.length >= 10;
  if (!valid) return refuse("DESTINATION_INVALID", "destination", { kind });
  const responsible = input.responsible;
  if (responsible === null || (typeof responsible !== "string" && responsible.name.trim() === "")) return refuse("DESTINATION_INVALID", "responsible_destination");
  return {
    purpose: purpose ?? "support",
    journeys,
    destinationKind: kind,
    destination: kind === "URL" ? typed.slice("https://".length) : typed,
    responsible: typeof responsible === "string" ? responsible : { name: responsible.name.trim() },
    publicAccess: input.publicAccess,
  };
}

/** `POST /help-routes`, `SM-456` transition 1: a new route, confirmed by its creation. */
export function createHelpRoute(key: string, actor: PolicyActor, input: RouteInput): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const fields = routeFields(input, true);
  if ("refusal" in fields) return fields;
  const register = registerOf(key);
  const next = Math.max(...register.routes.map((route) => Number(route.id.slice(3)) || 0)) + 1;
  const id = `HR-${String(next).padStart(2, "0")}`;
  register.routes.push({ ...fields, id, confirmedAt: now(), confirmedBy: actor.name, state: "active", unconfirmedReason: null, retiredAt: null, retiredBy: null, retirementReason: null });
  return accept({ id });
}

/** The route a command names, refused ROUTE_NOT_FOUND or ROUTE_RETIRED in that order. */
function liveRoute(register: PublicRegister, id: string): PolicyAnswer<never> | RegisteredHelpRoute {
  const route = register.routes.find((candidate) => candidate.id === id);
  if (route === undefined) return refuse("ROUTE_NOT_FOUND");
  if (route.state === "retired") return refuse("ROUTE_RETIRED");
  return route;
}

/** `PUT /help-routes/{id}`, `SM-456` transitions 3 and 4: the edit confirms the route; its purpose stays. */
export function editHelpRoute(key: string, actor: PolicyActor, id: string, input: RouteInput): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  checkRoutes(register);
  const route = liveRoute(register, id);
  if ("refusal" in route) return route;
  const fields = routeFields(input, false);
  if ("refusal" in fields) return fields;
  Object.assign(route, { ...fields, purpose: route.purpose, state: "active", confirmedAt: now(), confirmedBy: actor.name, unconfirmedReason: null });
  return accept({ id });
}

/** `POST /help-routes/{id}/confirmations`, `SM-456` transitions 3 and 4. */
export function confirmHelpRoute(key: string, actor: PolicyActor, id: string): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  checkRoutes(register);
  const route = liveRoute(register, id);
  if ("refusal" in route) return route;
  Object.assign(route, { state: "active", confirmedAt: now(), confirmedBy: actor.name, unconfirmedReason: null });
  return accept({ id });
}

/** `POST /help-routes/{id}/retirements`, `SM-456` transition 5: never the last authoritative contact, always with a reason. */
export function retireHelpRoute(key: string, actor: PolicyActor, id: string, reason: string): PolicyAnswer<{ id: string }> {
  if (!holdsAny(actor, "ACT-OPS")) return refuse("NOT_AUTHORISED");
  const register = registerOf(key);
  const route = liveRoute(register, id);
  if ("refusal" in route) return route;
  if (lastAuthoritative(register.routes, route)) return refuse("LAST_AUTHORITATIVE_CONTACT");
  const why = reason.trim();
  if (why === "") return refuse("REASON_REQUIRED", "reason");
  Object.assign(route, { state: "retired", retiredAt: now(), retiredBy: actor.name, retirementReason: why });
  return accept({ id });
}

// ---------------------------------------------------------------- the disclosure profile (ALG-458)

/**
 * A version of `PUB-DISCLOSURE-PROFILE` (`CFG-21`) as GOV approves it: for each record type it lists, the fields it
 * admits and, for a protected field, the separately approved disclosure decision that authorises it (`DEC-23`).
 */
export interface DisclosureProfileVersion {
  ref: string;
  approvedOn: string;
  /** The instant it takes effect, with its offset. */
  effectiveFrom: string;
  entries: Readonly<Partial<Record<RecordType, readonly { field: string; decision: string | null }[]>>>;
}

/**
 * `ALG-458`'s minimum per record type: the eight fields of VER's public set for a certificate, the five of `BR-PUB-11`
 * for a Player entitlement, the owner's display fields for the others. The minimum is code, so a failed or missing
 * read can never widen an answer (`DR-486` row 6).
 */
const MINIMUM: Readonly<Record<RecordType, readonly string[]>> = {
  AUTHORITATIVE_PREMISES_STATUS: ["reference", "status", "status_since", "valid_from", "valid_to", "scope", "issuer", "representation_current"],
  PLAYER_SERVICE_ENTITLEMENT: ["premises_name", "business_type", "locality_level", "service_entitlement_id", "status"],
  DIRECT_LICENCE: ["track", "artist_display_name", "signed_on", "term", "status", "terms_version", "proof_status"],
  EVIDENCE_PROOF: ["proof_status", "anchored_at"],
  ARTIST_PROFILE: ["display_name", "public_repertoire"],
  TRACK: ["title", "artist_display_name", "duration_seconds", "preview"],
};

/** The three fields a profile admits only with the decision that authorises it (`DR-486` rows 2 and 3). */
const PROTECTED: readonly string[] = ["premises_telephone", "premises_street_address", "owner_identity"];

/** The fields that hold personal data, which beyond the minimum need DAT's purpose attribution (`DR-486` row 7). */
const PERSONAL: readonly string[] = ["premises_name", ...PROTECTED, "legal_name", "biography", "image"];

interface ResolvedProfile {
  state: "APPLIED" | "MINIMUM_PROFILE";
  version: DisclosureProfileVersion | null;
  /** Admitted first, then withheld, each in the version's order. */
  entries: ProfileEntry[];
  admitted: ReadonlySet<string>;
}

/** An exception raised once for its subject (`EXC-PUB-04` per version and field), or once in a window (`EXC-PUB-05`, a minute). */
function raiseOnce(register: PublicRegister, code: PublicException["code"], subject: string, facts: PublicException["facts"], windowMs: number | null = null): void {
  const earlier = register.exceptions.find((raised) => raised.code === code && raised.subject === subject && (windowMs === null || Date.now() - ms(raised.at) < windowMs));
  if (earlier === undefined) raiseException(register, code, subject, facts);
}

/**
 * `DR-486` for a record type at an instant, in its evaluation order: row 6 first, the minimum while no version GOV
 * approved is in effect (the tested default) or the one in effect lists nothing for the record type; then for each field
 * the version lists, rows 2 and 3 for a protected field, row 7 for one holding personal data beyond the minimum, and
 * row 1 for the rest. DAT's `IPurposeLimits.IsFieldAttributed` is not offered to this family yet (`BR-DAT-05`, P3), so a
 * personal-data field beyond the minimum is withheld as not attributed and `EXC-PUB-05` raised: a read that cannot be
 * made narrows, it never widens.
 */
function profileAt(register: PublicRegister, recordType: RecordType, instant: number): ResolvedProfile {
  const version = register.profiles.filter((candidate) => ms(candidate.effectiveFrom) <= instant).sort((a, b) => ms(b.effectiveFrom) - ms(a.effectiveFrom))[0] ?? null;
  const listed = version?.entries[recordType];
  if (version === null || listed === undefined) {
    const entries = MINIMUM[recordType].map((field): ProfileEntry => ({ field, admittedBy: { kind: "MINIMUM" }, state: "ADMITTED", finding: null }));
    return { state: "MINIMUM_PROFILE", version: null, entries, admitted: new Set(MINIMUM[recordType]) };
  }
  const admitted: ProfileEntry[] = [];
  const withheld: ProfileEntry[] = [];
  for (const { field, decision } of listed) {
    const by: ProfileEntry["admittedBy"] = decision !== null ? { kind: "DECISION", decision } : { kind: "VERSION", version: version.ref };
    if (PROTECTED.includes(field) && decision === null) {
      raiseOnce(register, "EXC-PUB-04", `${version.ref} ${recordType} ${field}`, { version: version.ref, recordType, field });
      withheld.push({ field, admittedBy: by, state: "WITHHELD", finding: "DECISION_REF_MISSING" });
    } else if (PERSONAL.includes(field) && !MINIMUM[recordType].includes(field)) {
      raiseOnce(register, "EXC-PUB-05", "DAT", { source: "DAT", read: "IsFieldAttributed", cause: "SOURCE_NOT_OFFERED" }, 60_000);
      withheld.push({ field, admittedBy: by, state: "WITHHELD", finding: "NOT_ATTRIBUTED" });
    } else admitted.push({ field, admittedBy: by, state: "ADMITTED", finding: null });
  }
  return { state: "APPLIED", version, entries: [...admitted, ...withheld], admitted: new Set(admitted.map((entry) => entry.field)) };
}

// ---------------------------------------------------------------- what other families call

/** One version of a public document as another family reads its Vietnamese text: approved once published. */
export interface ContentVersion {
  label: string;
  status: VersionStatus;
  /** Where a published version stands now; null for one never published. */
  phase: VersionPhase | null;
  effectiveFrom: string | null;
}

/**
 * The versions of one public document in the order they were written, keyed by its kind (`PREMISES_SERVICE_TERMS`): what SVC's
 * translation register links each translation to (SCR-SVC-21). Null where no public document has that key.
 */
export function contentVersions(key: string, contentKey: string): readonly ContentVersion[] | null {
  const document = documentOf(contentKey);
  if (document === null) return null;
  const register = registerOf(key);
  return versionsOf(register, document.kind).map((version) => ({ label: version.label, status: version.status, phase: phaseOf(register, version), effectiveFrom: version.effectiveFrom }));
}

/**
 * SCR-PUB-20's read (`oversight.ts`, `GET /disclosure-profile`): the profile in effect for a record type at an instant,
 * every entry with what admits it, and each one withheld with its finding (`DR-486` rows 3 and 7).
 */
export function disclosureProfileAt(
  key: string,
  recordType: RecordType,
  instant: number,
): { state: ResolvedProfile["state"]; version: { ref: string; approvedOn: string } | null; entries: readonly ProfileEntry[] } {
  const resolved = profileAt(registerOf(key), recordType, instant);
  return { state: resolved.state, version: resolved.version === null ? null : { ref: resolved.version.ref, approvedOn: resolved.version.approvedOn }, entries: resolved.entries };
}

/**
 * GOV's approval of a version of `PUB-DISCLOSURE-PROFILE` (`IRuleVersionResolver`), the one way a version reaches this
 * family: from its effective instant every public answer of the world carries the fields it admits. The mock plays no
 * GOV rule register, so no screen of the portal approves one; a world starts with none, the tested default.
 */
export function approveDisclosureProfileVersion(key: string, version: DisclosureProfileVersion): void {
  registerOf(key).profiles.push({ ...version, entries: { ...version.entries } });
}

/**
 * A public answer of the certificate route by its reference (`VRA-`), as VER keeps it (`SEC-741`): what it showed, the
 * hour it was given, and the record it resolved or the value presented, so VER can read it back
 * (`GET /verification-answers/{ref}`) and a request to reconsider it can carry what it was. Null for a reference the
 * world's public route never gave.
 */
export function publicVerificationAnswer(key: string, answerRef: string): PublicAnswerRecord | null {
  const stored = registerOf(key).answers.get(answerRef.trim().toUpperCase());
  return stored === undefined ? null : { ...stored, shown: stored.shown === null ? null : { ...stored.shown } };
}
