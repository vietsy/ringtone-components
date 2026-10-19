import { enc, route } from "./route";

/**
 * CAS on the case console (SCR-CAS-01 for the support line, 03, 04, 06, 07, 09, 10, 15, 16, 18) and the appeal the
 * public surface lodges against a decision (SCR-CAS-08). This group's routes, spread into `routes` by `lib/routes.ts`;
 * only the work on this group edits this file.
 */

/** A query string from the values given, in the order given; empty when none is. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined && value !== "") params.set(key, value);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

const caseOf = (reference: string) => `/ops/cases/${enc(reference)}`;

export const casesRoutes = {
  /** SCR-CAS-03 Case queue, the case workspace's landing: filtered by state, case type and owner, a keyset page at a time */
  opsCases: (filter?: { state?: string | null; type?: string | null; owner?: string | null; after?: string | null }) =>
    route(`/ops/cases${query({ state: filter?.state, type: filter?.type, owner: filter?.owner, after: filter?.after })}`),
  /** SCR-CAS-01 Raise a case, as the support-line agent records one for a caller, for the caller's group */
  opsCallerCase: (group?: string | null) => route(`/ops/cases/new${query({ group })}`),
  /** SCR-CAS-04 Case detail and triage */
  opsCase: (reference: string) => route(caseOf(reference)),
  /** SCR-CAS-06 Evidence requests */
  opsCaseEvidence: (reference: string) => route(`${caseOf(reference)}/evidence`),
  /** SCR-CAS-07 Record a decision, and the decision once recorded, read-only */
  opsCaseDecision: (reference: string) => route(`${caseOf(reference)}/decision`),
  /** SCR-CAS-10 Remedy linkage */
  opsCaseRemedy: (reference: string) => route(`${caseOf(reference)}/remedy`),
  /** SCR-CAS-15 Reopen a case */
  opsCaseReopening: (reference: string) => route(`${caseOf(reference)}/reopening`),
  /** The approvals surface's queue: the appeals and the reopenings waiting on a dispute authority */
  opsCaseApprovals: () => route("/ops/cases/approvals"),
  /** SCR-CAS-09 Decide an appeal */
  opsAppeal: (appeal: string) => route(`/ops/cases/approvals/appeals/${enc(appeal)}`),
  /** SCR-CAS-16 Case-intake matrix */
  opsIntakeMatrix: () => route("/ops/cases/intake-matrix"),
  /** SCR-CAS-18 Case policy register, one register open */
  opsCasePolicy: (register?: string | null) => route(`/ops/cases/policy${query({ register })}`),
  /** SCR-CAS-08 Lodge an appeal, by the case's reference, with or without an account */
  lodgeAppeal: (reference: string) => route(`/cases/${enc(reference)}/appeal`),
} as const;
