import type { LoadOutcome } from "@rightone/ui";
import type { Availability, AvailabilityPeriod, AvailabilityQuery, ProcessKey, RouteDependency, ServiceLocation, ServiceLocations } from "@/lib/api/continuity";
import {
  CERTIFICATE_FALLBACK,
  DEPENDENCIES,
  DEPENDENCIES_EVALUATED_AT,
  DEPENDENCY_EXCEPTION_TAKEN,
  DESIGNATED_ON,
  INCIDENT,
  LOCATION_EXCEPTION,
  MEASUREMENTS,
  PLACEMENT,
  PROCESSES,
  RECORDED_FROM,
  RECORDED_TO,
  type SeedMeasurement,
} from "@/lib/mock/continuity";
import { table, type StaffRole } from "./store";

/**
 * SVC's service continuity, played by the mock backend: the availability measurements of closed periods with
 * `DR-103`'s verdict, the recordings of where each critical service was served from, every 15 minutes, and the
 * components the public verification route depends on. All three are the record the probes, the period-close job and
 * the release check leave; nothing in the portal writes them, so a world reads them as seeded.
 */

interface Recording {
  service: ProcessKey;
  location: string;
  /** The failure domain the location belongs to: two machines in one domain are one location. */
  domain: string;
  recordedAt: string;
  recordedBy: "probe" | "operator";
}

interface ContinuityState {
  measurements: SeedMeasurement[];
  recordings: Recording[];
  /** `service_ops.route_dependencies`, each with the exception the sweep keeps open while it is not shown independent. */
  dependencies: RouteDependency[];
}

const INTERVAL_MS = 15 * 60_000;
const HOUR_MS = 3_600_000;

/** An instant as Vietnam writes it, with its offset: "2026-09-30T02:15:00+07:00". */
const vietnam = (ms: number) => `${new Date(ms + 7 * HOUR_MS).toISOString().slice(0, 19)}+07:00`;
const domainOf = (location: string) => location.split("/")[0] ?? location;

/**
 * The record of 30 September: two domains for every service until the provider failed at 02:10; then the Hồ Chí Minh
 * domain gone until 05:40; certificate issue unserved until it was moved to Hà Nội at 02:22, which the operator
 * recorded, and served from there alone since.
 */
function recordingsOf(): Recording[] {
  const failed = Date.parse(INCIDENT.raisedAt);
  const moved = Date.parse(INCIDENT.containedAt);
  const restored = Date.parse(INCIDENT.providerRestoredAt);
  const out: Recording[] = [];
  const record = (service: ProcessKey, locations: readonly string[], at: number, recordedBy: Recording["recordedBy"]) =>
    locations.forEach((location) => out.push({ service, location, domain: domainOf(location), recordedAt: vietnam(at), recordedBy }));
  for (let at = Date.parse(RECORDED_FROM); at <= Date.parse(RECORDED_TO); at += INTERVAL_MS) {
    for (const service of PROCESSES) {
      const placed = PLACEMENT[service];
      if (service === "certificate-issue") {
        if (at < failed) record(service, [...placed.hcm, ...placed.hni], at, "probe");
        else if (at >= moved) record(service, CERTIFICATE_FALLBACK, at, "probe");
      } else {
        record(service, at >= failed && at < restored ? placed.hni : [...placed.hcm, ...placed.hni], at, "probe");
      }
    }
    if (at < moved && moved < at + INTERVAL_MS) record("certificate-issue", CERTIFICATE_FALLBACK, moved, "operator");
  }
  return out.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

const stateOf = (key: string): ContinuityState =>
  table(key, "continuity", () => ({
    measurements: MEASUREMENTS.map((row) => ({ ...row })),
    recordings: recordingsOf(),
    dependencies: DEPENDENCIES.map((dependency) => ({
      component: dependency.key,
      kind: dependency.kind,
      independentlyAvailable: false,
      evaluatedAt: DEPENDENCIES_EVALUATED_AT,
      evidenceRef: null,
      exception: { takenBy: DEPENDENCY_EXCEPTION_TAKEN.by, takenAt: DEPENDENCY_EXCEPTION_TAKEN.at },
    })),
  }));

const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });
const refused = (code: string): LoadOutcome<never> => ({ data: null, failure: { code, traceId: null, retryable: false } });
const holds = (roles: readonly StaffRole[], ...allowed: readonly StaffRole[]) => allowed.some((role) => roles.includes(role));
const isProcess = (value: string): value is ProcessKey => (PROCESSES as readonly string[]).includes(value);

// ---------------------------------------------------------------- GET /availability (SCR-SVC-13)

/**
 * `DR-103` with no objective in force, which is where the world stands (SCR-SVC-12: the Ministry's decision on the
 * targets is open): a measured period is NO_OBJECTIVE, one with no measurement UNMEASURED, never MET.
 */
function judged(row: SeedMeasurement): AvailabilityPeriod {
  const measured = row.measuredValue !== null;
  return {
    processKey: row.processKey,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    measuredValue: row.measuredValue,
    outcome: measured ? "NO_OBJECTIVE" : "UNMEASURED",
    reason: measured ? "NO_OBJECTIVE_IN_FORCE" : "NO_OBJECTIVE_AND_NOT_MEASURED",
    objectiveVersion: null,
    gap: row.gap,
  };
}

/**
 * `GET /availability` (ACT-OPS, ACT-SEC): each process's closed periods overlapping the period asked, grouped by
 * process, latest first. The period has no default (PERIOD_REQUIRED); a process not designated is PROCESS_NOT_FOUND.
 */
export function availability(key: string, roles: readonly StaffRole[], asked: NonNullable<AvailabilityQuery>): LoadOutcome<Availability> {
  if (!holds(roles, "ACT-OPS", "ACT-SEC")) return refused("NOT_AUTHORISED");
  const process = asked.processKey === null || asked.processKey === "" ? null : asked.processKey;
  if (process !== null && !isProcess(process)) return refused("PROCESS_NOT_FOUND");
  if (asked.from === null || asked.to === null || asked.to < asked.from) return refused("PERIOD_REQUIRED");
  const { from, to } = asked;
  const mine = stateOf(key).measurements.filter((row) => process === null || row.processKey === process);
  const periods = mine
    .filter((row) => row.periodStart <= to && row.periodEnd >= from)
    .map(judged)
    .sort((a, b) => PROCESSES.indexOf(a.processKey) - PROCESSES.indexOf(b.processKey) || b.periodStart.localeCompare(a.periodStart));
  const lastMeasuredEnd = mine.reduce<string | null>((last, row) => (last === null || row.periodEnd > last ? row.periodEnd : last), null);
  return ok({ processKey: process, period: { from, to }, periods, objectiveInForce: false, designatedOn: DESIGNATED_ON, lastMeasuredEnd });
}

// ---------------------------------------------------------------- GET /service-locations (SCR-SVC-14)

/** The 15-minute interval holding an instant. */
const intervalOf = (ms: number) => Math.floor(ms / INTERVAL_MS) * INTERVAL_MS;

/**
 * Since when a service has been on fewer than two domains, up to the end of an interval: the first recording after
 * the last instant it was recorded in two. It names the incident when the move began after the incident was raised.
 */
function singleSince(recordings: readonly Recording[], service: ProcessKey, end: number): ServiceLocation["singleSince"] {
  const byInstant = new Map<string, Set<string>>();
  for (const recording of recordings) {
    if (recording.service !== service || Date.parse(recording.recordedAt) >= end) continue;
    byInstant.set(recording.recordedAt, (byInstant.get(recording.recordedAt) ?? new Set()).add(recording.domain));
  }
  const instants = [...byInstant.keys()].sort();
  const lastTwo = instants.filter((at) => (byInstant.get(at)?.size ?? 0) >= 2).at(-1) ?? null;
  const since = instants.find((at) => lastTwo === null || at > lastTwo) ?? null;
  if (since === null) return null;
  return { at: since, incident: Date.parse(since) >= Date.parse(INCIDENT.raisedAt) ? INCIDENT.reference : null };
}

/**
 * `GET /service-locations` (ACT-OPS, ACT-SEC) for one interval: the interval holding the instant asked, or the last one
 * the probes recorded. Each critical service with its distinct domains, the last instant recorded, since when it has
 * had fewer than two, and the exception open about it once the sweep has raised one.
 */
export function serviceLocations(key: string, roles: readonly StaffRole[], at: string | null): LoadOutcome<ServiceLocations> {
  if (!holds(roles, "ACT-OPS", "ACT-SEC")) return refused("NOT_AUTHORISED");
  const { recordings } = stateOf(key);
  const last = intervalOf(Date.parse(recordings.at(-1)?.recordedAt ?? RECORDED_TO));
  const asked = at !== null && !Number.isNaN(Date.parse(at)) ? intervalOf(Date.parse(at)) : last;
  const end = asked + INTERVAL_MS;
  const services = PROCESSES.map((service): ServiceLocation => {
    const inside = recordings.filter((r) => r.service === service && Date.parse(r.recordedAt) >= asked && Date.parse(r.recordedAt) < end);
    const domains = [...new Set(inside.map((r) => r.domain))].sort();
    const single = domains.length === 1 ? singleSince(recordings, service, end) : null;
    const raised = service === LOCATION_EXCEPTION.service && single !== null && Date.parse(LOCATION_EXCEPTION.raisedAt) < end;
    return {
      service,
      domains,
      machines: new Set(inside.map((r) => r.location)).size,
      recordedAt: inside.at(-1)?.recordedAt ?? null,
      singleSince: single,
      exception: raised ? { raisedAt: LOCATION_EXCEPTION.raisedAt, takenBy: LOCATION_EXCEPTION.takenBy, takenAt: LOCATION_EXCEPTION.takenAt } : null,
    };
  });
  // A service with a problem first - none recorded, then one domain - then by name.
  const rank = (row: ServiceLocation) => (row.domains.length === 0 ? 0 : row.domains.length === 1 ? 1 : 2);
  services.sort((a, b) => rank(a) - rank(b) || a.service.localeCompare(b.service));
  return ok({ interval: { from: vietnam(asked), to: vietnam(end) }, lastRecorded: vietnam(last), services });
}

// ---------------------------------------------------------------- GET /route-dependencies (SCR-SVC-14)

/**
 * `GET /route-dependencies` (ACT-SEC alone): every component the public verification route reaches, whether it is
 * independently available (false until an evaluation shows it), when that was evaluated and the evidence. A component
 * not shown independent carries the exception the sweep keeps open about it. Components not shown first, then by name.
 */
export function routeDependencies(key: string, roles: readonly StaffRole[]): LoadOutcome<readonly RouteDependency[]> {
  if (!holds(roles, "ACT-SEC")) return refused("ROLE_NOT_ASSIGNED");
  return ok([...stateOf(key).dependencies].sort((a, b) => Number(a.independentlyAvailable) - Number(b.independentlyAvailable) || a.component.localeCompare(b.component)));
}
