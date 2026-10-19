import type { LoadOutcome } from "@rightone/ui";
import type { ComponentKind, ProcessKey } from "@/lib/api/continuity";

/**
 * SVC's sample data for service continuity (SCR-SVC-13, 14), from the SVC boards. The world's record ends where the
 * boards stand, at 15:15 on 30 September 2026, the day the hosting provider Mây Hiên stopped answering at the
 * TP. Hồ Chí Minh data centre (incident INC-2026-0386, SCR-SVC-16): the recordings show it rather than a clock
 * playing it. Invented figures; nothing here is a real record.
 */

/** The three critical processes, each designated on 1 July 2026, the first reporting period (SCR-SVC-12, 13). */
export const PROCESSES: readonly ProcessKey[] = ["certificate-issue", "premises-register", "public-verification"];
export const DESIGNATED_ON = "2026-07-01";

/** One closed monthly period's measurement (`service_ops.availability_measurements`); no objective is in force. */
export interface SeedMeasurement {
  processKey: ProcessKey;
  periodStart: string;
  periodEnd: string;
  /** Percent; null where the period was not measured. */
  measuredValue: number | null;
  /** Where the measurement window was incomplete, the days it missed. */
  gap: { from: string; to: string } | null;
}

/** SCR-SVC-13 on the board: July and August 2026; the public route's August window missed 12 to 14 August. */
export const MEASUREMENTS: readonly SeedMeasurement[] = [
  { processKey: "certificate-issue", periodStart: "2026-07-01", periodEnd: "2026-07-31", measuredValue: 99.81, gap: null },
  { processKey: "certificate-issue", periodStart: "2026-08-01", periodEnd: "2026-08-31", measuredValue: 99.72, gap: null },
  { processKey: "premises-register", periodStart: "2026-07-01", periodEnd: "2026-07-31", measuredValue: 99.4, gap: null },
  { processKey: "premises-register", periodStart: "2026-08-01", periodEnd: "2026-08-31", measuredValue: 98.9, gap: null },
  { processKey: "public-verification", periodStart: "2026-07-01", periodEnd: "2026-07-31", measuredValue: 99.96, gap: null },
  { processKey: "public-verification", periodStart: "2026-08-01", periodEnd: "2026-08-31", measuredValue: null, gap: { from: "2026-08-12", to: "2026-08-14" } },
];

/** The incident the recordings of 30 September show, as SCR-SVC-16 records it. */
export const INCIDENT = {
  reference: "INC-2026-0386",
  raisedAt: "2026-09-30T02:10:00+07:00",
  /** Traffic moved to hni-1; certificate issue was not served from the moment the provider failed until then. */
  containedAt: "2026-09-30T02:22:00+07:00",
  providerRestoredAt: "2026-09-30T05:40:00+07:00",
} as const;

/** The first and the last probe of the world's record of serving locations, every 15 minutes. */
export const RECORDED_FROM = "2026-09-30T00:00:00+07:00";
export const RECORDED_TO = "2026-09-30T15:00:00+07:00";

/** The data centres each service runs in, by failure domain: hcm-1 (TP. Hồ Chí Minh, Mây Hiên) and hni-1 (Hà Nội). */
export const PLACEMENT: Readonly<Record<ProcessKey, { hcm: readonly string[]; hni: readonly string[] }>> = {
  "certificate-issue": { hcm: ["hcm-1/cer-01"], hni: ["hni-1/cer-01"] },
  "premises-register": { hcm: ["hcm-1/reg-01", "hcm-1/reg-02"], hni: ["hni-1/reg-01", "hni-1/reg-02"] },
  "public-verification": { hcm: ["hcm-1/ver-01", "hcm-1/ver-02", "hcm-1/ver-03"], hni: ["hni-1/ver-01", "hni-1/ver-02", "hni-1/ver-03"] },
};

/** Certificate issue was moved to Hà Nội at containment on a second machine there, and has not moved back. */
export const CERTIFICATE_FALLBACK: readonly string[] = ["hni-1/cer-01", "hni-1/cer-02"];

/** What the public verification route reaches (`service_ops.route_dependencies`), none yet shown independent. */
export const DEPENDENCIES: readonly { key: string; kind: ComponentKind }[] = [
  { key: "evd-reader", kind: "module" },
  { key: "lic-reader", kind: "module" },
  { key: "primary-db", kind: "datastore" },
  { key: "rightone-api", kind: "module" },
  { key: "ven-reader", kind: "module" },
  { key: "ver-reader", kind: "module" },
];
export const DEPENDENCIES_EVALUATED_AT = "2026-09-30T15:00:00+07:00";

/**
 * The service exceptions open about what SCR-SVC-14 shows (SCR-SVC-15): certificate issue on one failure domain,
 * raised at 02:37 and not yet taken; each dependency not shown independent, taken by Hoàng Anh Tuấn.
 */
export const LOCATION_EXCEPTION = { service: "certificate-issue" as ProcessKey, raisedAt: "2026-09-30T02:37:00+07:00", takenBy: null, takenAt: null };
export const DEPENDENCY_EXCEPTION_TAKEN = { by: "Hoàng Anh Tuấn", at: "2026-09-26T09:14:00+07:00" };

/** The review states the boards draw that the live data never reaches: loading and our outage. */
export const SVC_VIEWS = ["loading", "error"] as const;
export type SvcView = (typeof SVC_VIEWS)[number];

export function mockContinuityFailure(screen: "svc13" | "svc14"): LoadOutcome<never> {
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: screen === "svc13" ? "d61e8a03b5f97c24" : "7b3f90e6c2d14a85", retryable: true } };
}
