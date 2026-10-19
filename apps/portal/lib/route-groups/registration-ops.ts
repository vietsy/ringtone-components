import { enc, route } from "./route";

/**
 * REG on the operations console: the review queue to the approved decision (SCR-REG-09 to 18).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string from the values given, in the order given; empty when none is. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined && value !== "") params.set(key, value);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

const caseFile = (application: string) => `/ops/registration/applications/${enc(application)}`;

export const registrationOpsRoutes = {
  /** SCR-REG-09 Review queue, the registration workspace's landing: filtered by queue, state and premises, a page at a time */
  opsRegistration: (filter?: { queue?: string | null; status?: string | null; premises?: string | null; position?: string | null }) =>
    route(`/ops/registration${query({ queue: filter?.queue, status: filter?.status, premises: filter?.premises, cursor: filter?.position })}`),
  /** SCR-REG-10 Application case file */
  opsApplication: (application: string) => route(caseFile(application)),
  /** SCR-REG-11 Request evidence */
  opsEvidenceRequest: (application: string) => route(`${caseFile(application)}/evidence-request`),
  /** SCR-REG-12 Claim review, for one claim of the application */
  opsClaimReview: (application: string, claim: string) => route(`${caseFile(application)}/claims/${enc(claim)}`),
  /** SCR-REG-13 Decision proposal */
  opsDecisionProposal: (application: string) => route(`${caseFile(application)}/proposal`),
  /** SCR-REG-14 Approve or return a proposal: the proposals awaiting the reader's approval, one opened */
  opsApprovals: (proposal?: string | null) => route(`/ops/registration/approvals${query({ proposal })}`),
  /** SCR-REG-15 Record a withdrawal on instruction */
  opsWithdrawal: (application: string) => route(`${caseFile(application)}/withdrawal`),
  /** SCR-REG-16 Registration reports, the reports workspace's landing, for a period */
  opsRegistrationReports: (period?: { from?: string | null; to?: string | null; all?: boolean }) =>
    route(`/ops/reports/registration${query({ from: period?.from, to: period?.to, all: period?.all === true ? "1" : null })}`),
  /** SCR-REG-17 Effective registration policy, at an instant */
  opsRegistrationPolicy: (asOf?: string | null) => route(`/ops/reports/registration/policy${query({ as_of: asOf })}`),
  /** SCR-REG-18 Premises use-start record, for a premises, or for the premises of the case file it is opened from */
  opsUseStarts: (of?: { premises?: string | null; application?: string | null }) =>
    route(`/ops/reports/registration/use-starts${query({ premises: of?.premises, application: of?.application })}`),
} as const;
