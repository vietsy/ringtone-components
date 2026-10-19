import { enc, route } from "./route";

/**
 * FIN and TAR on the operations console, and the premises' fee explanation, from a decision or a review (SCR-FIN-04, 10, 14,
 * 15, SCR-TAR-08, 09, 12, 13, 14).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string from the values given, in the order given; empty when none is. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined && value !== "") params.set(key, value);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

export const financeOpsRoutes = {
  /** SCR-FIN-04 Suspense: the held amounts, the account they are held in, and the grounds recorded on them */
  opsSuspense: () => route("/ops/finance/suspense"),
  /** SCR-FIN-14 Outstanding amounts, the finance workspace's landing: filtered by state and premises, one amount opened beside them */
  opsFinance: (filter?: { state?: string | null; premises?: string | null; amount?: string | null }) =>
    route(`/ops/finance${query({ state: filter?.state, premises: filter?.premises, amount: filter?.amount })}`),
  /**
   * SCR-FIN-10 Corrections, refunds and chargebacks, with one correction opened under the list, and a form open: the
   * chargeback form, the refund form (with the case it names filled in), or the confirmation that sends a refund
   */
  opsCorrections: (correction?: string | null, form?: "chargeback" | "refund" | "send", caseRef?: string | null) =>
    route(`/ops/finance/corrections${query({ correction, form, case: caseRef })}`),
  /** SCR-FIN-15 Write-off approval, for the outstanding amount the write-off is proposed on */
  opsWriteOff: (amount: string) => route(`/ops/finance/write-offs/${enc(amount)}`),

  /** SCR-TAR-08 Calculations of a premises, the tariff workspace's landing */
  opsTariff: (filter?: { premises?: string | null; from?: string | null; to?: string | null }) =>
    route(`/ops/tariff${query({ premises: filter?.premises, from: filter?.from, to: filter?.to })}`),
  /** SCR-TAR-09 Calculation and its reproduction, with the reproduction just recorded marked */
  opsCalculation: (calculation: string, reproduced?: string) => route(`/ops/tariff/calculations/${enc(calculation)}${query({ reproduced })}`),
  /** SCR-TAR-12 Declared classifications under reconciliation, with one watch opened */
  opsDeclaredClasses: (filter?: { status?: string | null; premises?: string | null; watch?: string | null }) =>
    route(`/ops/tariff/declared-classifications${query({ status: filter?.status, premises: filter?.premises, watch: filter?.watch })}`),
  /** SCR-TAR-13 Mandate scope changes, on the policy console */
  policyMandateChanges: (filter?: { change?: string | null; from?: string | null; to?: string | null; opened?: string | null }) =>
    route(`/policy/mandate-scope-changes${query({ change: filter?.change, from: filter?.from, to: filter?.to, opened: filter?.opened })}`),
  /** SCR-TAR-14 How your fee was calculated, opened from the premises' decision */
  feeCalculation: (decision: string) => route(`/decisions/${enc(decision)}/fee`),
  /** SCR-TAR-14 How your fee was calculated, opened from the review of a draft (SCR-REG-05) by the calculation it recorded */
  reviewFeeCalculation: (application: string, calculation: string) => route(`/registration/${enc(application)}/review/fee/${enc(calculation)}`),
} as const;
