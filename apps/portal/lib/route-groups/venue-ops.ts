import { enc, route } from "./route";

/**
 * RightOne Player service entitlements and shared moods on the consoles (SCR-VEN-12 to 18).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string from the values set, or nothing. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const set = Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
  return set.length === 0 ? "" : `?${new URLSearchParams(set).toString()}`;
}

export const venueOpsRoutes = {
  /** SCR-VEN-12 Entitlement register, filtered by state and premises */
  opsServices: (filter?: { status?: string | null; premises?: string | null; after?: string | null }) =>
    route(`/ops/services${query({ status: filter?.status, premises_id: filter?.premises, after: filter?.after })}`),
  /** SCR-VEN-13 Entitlement case file, with the week whose periods are shown and the fallbacks' page */
  opsService: (service: string, week?: { from: string; to: string; asOf: string }, after?: string) =>
    route(`/ops/services/${enc(service)}${query({ from: week?.from, to: week?.to, as_of: week?.asOf, after })}`),
  /** SCR-VEN-14 Enforcement action */
  opsServiceEnforcement: (service: string) => route(`/ops/services/${enc(service)}/enforcement`),
  /** SCR-VEN-15 Reinstatement */
  opsServiceReinstatement: (service: string) => route(`/ops/services/${enc(service)}/reinstatement`),
  /** SCR-VEN-16 Record a scope exit */
  opsServiceScopeExit: (service: string) => route(`/ops/services/${enc(service)}/scope-exit`),
  /** SCR-VEN-17 Shared mood library, filtered by version state */
  opsMoods: (status?: string | null, after?: string | null) => route(`/ops/shared-moods${query({ status, after })}`),
  /** SCR-VEN-18 Shared mood version */
  opsMoodVersion: (version: string) => route(`/ops/shared-moods/${enc(version)}`),
} as const;
