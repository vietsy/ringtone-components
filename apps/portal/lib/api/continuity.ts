import type { LoadOutcome } from "@rightone/ui";
import { availability, routeDependencies, serviceLocations } from "@/lib/mock/backend/continuity";
import { mockContinuityFailure, type SvcView } from "@/lib/mock/continuity";
import type { Staff } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/**
 * SVC's seam for service continuity: availability by period (`GET /availability`, SCR-SVC-13), the serving locations of
 * each critical service (`GET /service-locations`) and the public verification route's dependencies
 * (`GET /route-dependencies`, both SCR-SVC-14). Reads only.
 */

/** The critical processes, by the key the service records them under. */
export type ProcessKey = "certificate-issue" | "premises-register" | "public-verification";

/** `DR-103`'s outcome, and the reason beside it. */
export type AvailabilityOutcome = "MET" | "NOT_MET" | "UNMEASURED" | "NO_OBJECTIVE";
export type AvailabilityReason =
  | "OBJECTIVE_MET"
  | "OBJECTIVE_MISSED"
  | "PERIOD_NOT_MEASURED"
  | "WINDOW_INCOMPLETE"
  | "NO_OBJECTIVE_IN_FORCE"
  | "NO_OBJECTIVE_AND_NOT_MEASURED";

/** One process's closed reporting period, with its measurement and verdict. */
export interface AvailabilityPeriod {
  processKey: ProcessKey;
  periodStart: string;
  periodEnd: string;
  /** Percent; null where no measurement was taken, never 0. */
  measuredValue: number | null;
  outcome: AvailabilityOutcome;
  reason: AvailabilityReason;
  /** The objective version it was judged against; null where none was in force. */
  objectiveVersion: string | null;
  /** Where the measurement window was incomplete, the days it missed. */
  gap: { from: string; to: string } | null;
}

export interface Availability {
  processKey: ProcessKey | null;
  period: { from: string; to: string };
  /** Grouped by process, latest period first. */
  periods: readonly AvailabilityPeriod[];
  /** Whether any objective is in force, which decides whether a period can be judged at all. */
  objectiveInForce: boolean;
  designatedOn: string;
  /** The end of the last period measured for the process (or any process), for the empty state's sentence. */
  lastMeasuredEnd: string | null;
}

/** What the period form asked: nothing yet on first opening, or a process and a period, either end perhaps missing. */
export type AvailabilityQuery = { processKey: string | null; from: string | null; to: string | null } | null;

/** One critical service in a recording interval: its distinct failure domains, never its machines counted twice. */
export interface ServiceLocation {
  service: ProcessKey;
  /** Distinct failure domains, in the order recorded; empty where nothing was recorded in the interval. */
  domains: readonly string[];
  /** The serving locations (data centre machines) recorded in the interval. */
  machines: number;
  /** The last recording in the interval; null where there was none. */
  recordedAt: string | null;
  /** Since when the service has been served from fewer than two domains, and the incident it was moved under. */
  singleSince: { at: string; incident: string | null } | null;
  /** The service exception open about it, and who has taken it. */
  exception: { raisedAt: string; takenBy: string | null; takenAt: string | null } | null;
}

export interface ServiceLocations {
  interval: { from: string; to: string };
  /** The last interval with a recording, which the screen opens at. */
  lastRecorded: string;
  services: readonly ServiceLocation[];
}

export type ComponentKind = "identity" | "datastore" | "network" | "module";

export interface RouteDependency {
  component: string;
  kind: ComponentKind;
  independentlyAvailable: boolean;
  evaluatedAt: string;
  evidenceRef: string | null;
  exception: { takenBy: string | null; takenAt: string | null } | null;
}

/** SCR-SVC-13: nothing is read until a period is asked; a period missing an end is PERIOD_REQUIRED. */
export function loadAvailability(staff: Staff, asked: AvailabilityQuery, view: SvcView | null): Promise<LoadOutcome<Availability> | null> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockContinuityFailure("svc13"));
  return Promise.resolve(asked === null ? null : availability(staff.sessionId, staff.roles, asked));
}

/** SCR-SVC-14's locations: the interval holding the instant asked, or the last one recorded. */
export function loadServiceLocations(staff: Staff, at: string | null, view: SvcView | null): Promise<LoadOutcome<ServiceLocations>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockContinuityFailure("svc14"));
  return Promise.resolve(serviceLocations(staff.sessionId, staff.roles, at));
}

/** SCR-SVC-14's dependencies of the public verification route: the security officer's read alone. */
export function loadRouteDependencies(staff: Staff): Promise<LoadOutcome<readonly RouteDependency[]>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(routeDependencies(staff.sessionId, staff.roles));
}
