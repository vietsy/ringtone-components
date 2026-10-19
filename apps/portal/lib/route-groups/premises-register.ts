import { enc, route } from "./route";

/**
 * PTY premises register, reconciliation, exceptions, entitlement disposition (SCR-PTY-06 to 10, 14 to 16).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string from the values that are set, in the order given. */
function withQuery(path: string, query: Readonly<Record<string, string | null | undefined>>): string {
  const pairs = Object.entries(query).filter((entry): entry is [string, string] => entry[1] !== null && entry[1] !== undefined && entry[1] !== "");
  return pairs.length === 0 ? path : `${path}?${new URLSearchParams(pairs).toString()}`;
}

/** The register's filter: an area (a ward, or `all`), a search, a licensing status. */
export interface RegisterQuery {
  area?: string | null;
  q?: string | null;
  licensing?: string | null;
  panel?: "admit" | null;
}

export const premisesRegisterRoutes = {
  /** SCR-PTY-06 Premises register and coverage, by area, search and licensing status; `panel` opens Admit premises */
  opsPremisesRegister: (query: RegisterQuery = {}) =>
    route(withQuery("/ops/premises", { area: query.area, q: query.q, licensing: query.licensing, panel: query.panel })),
  /** RPT-PTY-01 Coverage report of the area in view, as a CSV file */
  opsCoverageReport: (area: string | null) => route(withQuery("/ops/premises/coverage", { area })),
  /** SCR-PTY-07 Premises detail; `panel` opens Record party beside it */
  opsPremises: (premises: string, panel?: "party") => route(withQuery(`/ops/premises/${enc(premises)}`, { panel })),
  /** SCR-PTY-07's relationship question: who operated the premises at a day and time (GET /premises/{id}/relationship-at) */
  opsPremisesAt: (premises: string, at?: string | null) => route(withQuery(`/ops/premises/${enc(premises)}`, { at })),
  /** SCR-PTY-18 Verification reads of one premises, for the data owner and assurance (the register data console) */
  opsOverlapReport: (query: { premises?: string | null; from?: string | null; to?: string | null } = {}) =>
    route(withQuery("/ops/verification-reads", { premises: query.premises, from: query.from, to: query.to })),
  /** SCR-PTY-08 Provenance and override */
  opsPremisesProvenance: (premises: string) => route(`/ops/premises/${enc(premises)}/provenance`),
  /** SCR-PTY-09 Record a premises change, with the cause, date and incoming party being entered */
  opsPremisesChange: (premises: string, draft: { cause?: string | null; effective?: string | null; incoming?: string | null } = {}) =>
    route(withQuery(`/ops/premises/${enc(premises)}/change`, { cause: draft.cause, effective: draft.effective, incoming: draft.incoming })),
  /** SCR-PTY-10 Premises history */
  opsPremisesHistory: (premises: string) => route(`/ops/premises/${enc(premises)}/history`),
  /** SCR-PTY-10 Export: the history as displayed, as a CSV file */
  opsPremisesHistoryExport: (premises: string) => route(`/ops/premises/${enc(premises)}/history/export`),

  /** SCR-PTY-14 Reconciliation runs and differences (the register data console) */
  opsReconciliation: () => route("/ops/reconciliation"),
  /** SCR-PTY-15 Exception queue, with the exception opened under the table */
  opsRegisterExceptions: (exception?: string) => route(withQuery("/ops/reconciliation/exceptions", { exception })),

  /** SCR-PTY-16 Entitlement dispositions: the premises changes that left records behind; `record` opens the one a status record waits on */
  opsEntitlementDispositions: (record?: string) => route(withQuery("/ops/entitlement-dispositions", { record })),
  /** SCR-PTY-16 What one premises change left behind, with one record opened under the table */
  opsChangeDispositions: (change: string, disposition?: string) => route(withQuery(`/ops/entitlement-dispositions/${enc(change)}`, { record: disposition })),
} as const;
