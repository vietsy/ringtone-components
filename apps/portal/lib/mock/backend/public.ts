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
  HelpRoute,
  IndicativeResult,
  PremisesClass,
  ScopeAnswer,
  ScopeQuestions,
} from "@/lib/api/public";
import type { VerificationOutcome } from "@/lib/api/verification";
import {
  ABOUT_IN_EFFECT,
  HELP_ROUTES,
  INDICATIVE_OFFERED,
  PUBLISHED_RECORDS,
  TARIFF_VERSIONS,
  type PublishedRecord,
  type TariffContent,
  type TariffVersion,
} from "@/lib/mock/public";
import { now, today } from "./clock";
import { reference } from "./ids";
import { PUBLIC_SESSION, table } from "./store";

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

/**
 * `GET /pages/ABOUT` at today's date. The canvas writes the text of 2026.2 and only the date of 2026.3, so the
 * mock answers 2026.2 and names 2026.3 as upcoming until its date.
 */
export function aboutPage(): LoadOutcome<AboutPageAnswer> {
  const upcoming = ABOUT_IN_EFFECT.upcoming !== null && ABOUT_IN_EFFECT.upcoming.effectiveFrom > today() ? ABOUT_IN_EFFECT.upcoming : null;
  return ok({ page: { ...ABOUT_IN_EFFECT, upcoming } });
}

/** The help route register's active routes, read by the pages that offer a way to help. */
export function helpRoutes(): LoadOutcome<readonly HelpRoute[]> {
  return ok(HELP_ROUTES);
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

/** The questions of the tariff version for a date; none when no version applies, a 503 when TAR cannot answer. */
export function scopeQuestions(date: string = today()): LoadOutcome<ScopeQuestions> {
  const version = versionAt(date);
  if (version === null) return ok({ assessmentDate: date, questions: null });
  if (version.content === null) return refusal("GUIDANCE_UNAVAILABLE", true);
  return ok({ assessmentDate: date, questions: { premisesClasses: PREMISES_CLASSES, adminAreas: version.content.adminAreas } });
}

// ---------------------------------------------------------------- POST /scope-assessments

const NEXT_ACTION = { in_scope: "register", out_of_scope: "no-registration", indeterminate: "apply" } as const;

/**
 * `DR-491`: what the public guidance answers for declared facts. The treatment is TAR's: in scope when both
 * class kinds have a class, indeterminate when either has none. A declared class never reaches out of scope.
 * Only the refusal of the input is a failure; every other outcome is an answer.
 */
export function assessScope(facts: FormFacts): Attempt<ScopeAnswer> {
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
      nextAction: cause === "GUIDANCE_UNAVAILABLE" ? "support" : "apply",
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
      nextAction: NEXT_ACTION[outcome],
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
 * `ALG-455`, certificate route: refused before any read when the request asks for more than one record, when
 * the requester is over the volume, or when the reference is not in a certificate's form; otherwise answered
 * from the published register, a record or its absence, at the instant of the lookup and with a new answer
 * reference (`VRA-`, as VER's `ALG-718` writes it). The register never fails in the mock, so it never answers
 * that it could not tell.
 */
export function verifyCertificate(asked: string, address: string): VerificationOutcome {
  const at = now();
  if (asked === "" || /[*%,]/.test(asked)) return answer(refusal("ENUMERATION_NOT_PERMITTED", false));
  const bucket = bucketOf(address);
  const retryAfter = admit(bucket, Date.parse(at));
  if (retryAfter !== null) return answer(refusal("VERIFICATION_RATE_LIMITED", true), retryAfter);
  const printout = PRINTOUT.test(asked);
  if (!CERTIFICATE.test(asked) && !printout) return answer(refusal("IDENTIFIER_NOT_ACCEPTED", false));
  const records = state().records;
  const record = printout ? [...records.values()].find((r) => r.printout === asked) : records.get(asked);
  if (record === undefined) {
    countAbsence(bucket, Date.parse(at));
    return answer(ok({ outcome: "absent", reference: asked, sourceAnsweredAt: at, attemptEndedAt: null, record: null }));
  }
  return answer(
    ok({
      outcome: "record",
      reference: record.reference,
      sourceAnsweredAt: at,
      attemptEndedAt: null,
      record: {
        status: record.status,
        statusSince: record.statusSince,
        validFrom: record.validFrom,
        validTo: record.validTo,
        printout: printout ? asked : null,
        answerRef: reference("VRA"),
      },
    }),
  );
}
