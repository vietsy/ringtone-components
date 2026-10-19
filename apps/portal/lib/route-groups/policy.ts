import { enc, route } from "./route";

/** A query string from the values given, in the order given; empty when none is. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined && value !== "") params.set(key, value);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

/**
 * The policy console: public documents, versions, approval, publication currency; and the help route register on the
 * operations console (SCR-PUB-14 to 18).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */
export const policyRoutes = {
  /** SCR-PUB-14 Public documents, the policy console's landing, filtered by class and by the state of a version */
  policyDocuments: (filter?: { documentClass?: string | null; status?: string | null }) =>
    route(`/policy${query({ class: filter?.documentClass, status: filter?.status })}`),
  /** SCR-PUB-15 Version editor, opened from "Soạn phiên bản mới" for a document, before the version exists */
  policyNewVersion: (document: string) => route(`/policy/documents/${enc(document)}/new`),
  /** SCR-PUB-15 Version editor, for a version that exists */
  policyVersion: (version: string) => route(`/policy/versions/${enc(version)}`),
  /** SCR-PUB-16 Approve a version */
  policyVersionReview: (version: string) => route(`/policy/versions/${enc(version)}/review`),
  /** SCR-PUB-17 Publication currency, filtered by state and by the period the change was approved in */
  policyCurrency: (filter?: { status?: string | null; from?: string | null; to?: string | null }) =>
    route(`/policy/currency${query({ status: filter?.status, from: filter?.from, to: filter?.to })}`),
  /** SCR-PUB-18 Help route register, on the operations console; `edit` opens a route's form, `new` an empty one */
  opsHelpRoutes: (filter?: { state?: string | null; purpose?: string | null; edit?: string | null; adding?: boolean }) =>
    route(`/ops/help-routes${query({ state: filter?.state, purpose: filter?.purpose, edit: filter?.edit, new: filter?.adding === true ? "route" : null })}`),
} as const;
