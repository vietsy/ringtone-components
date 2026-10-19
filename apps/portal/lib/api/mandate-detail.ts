import type { LoadOutcome } from "@rightone/ui";
import type { Localised, Mandate, MandateState, ScopeRow } from "./governance";
import { mockMandateDetail } from "@/lib/mock/mandate-detail";
import { NOT_CONFIGURED, usesMockData } from "./source";

export const MANDATE_DETAIL_VIEWS = ["submitted", "loading", "empty", "error"] as const;
export type MandateDetailView = (typeof MANDATE_DETAIL_VIEWS)[number];

export interface MandateDetailScope extends ScopeRow {
  id: string;
}

export interface MandateDetailPerson {
  id: string;
  name: string;
  organisationName: string;
  role: "administrator";
}

export interface MandateDetailEvidence {
  id: string;
  title: Localised;
  mediaType: "application/pdf";
  sizeBytes: number;
  uploadedAt: string;
  /** Placeholder until the actual evidence URL is supplied; no PDF is manufactured. */
  href: string;
}

export interface MandateDetailHistoryEntry {
  id: string;
  event: "submitted";
  state: MandateState;
  at: string;
  actor: MandateDetailPerson;
  source: "participation-portal";
}

export interface MandateDetailApproval {
  actor: MandateDetailPerson;
  at: string;
  decision: "approved" | "returned";
  comment: Localised | null;
}

export interface MandateDetailRecord extends Pick<Mandate, "state" | "effectiveFrom" | "effectiveTo"> {
  id: string;
  organisation: { id: string; name: string };
  authority: { id: string; name: Localised; provenance: "registry" };
  scope: readonly MandateDetailScope[];
  evidence: readonly MandateDetailEvidence[];
  submittedAt: string;
  preparer: MandateDetailPerson;
  approval: MandateDetailApproval | null;
  history: readonly MandateDetailHistoryEntry[];
}

/**
 * Read seam for Mandate Detail. The feature retains the existing session gate; reviewer
 * permissions and write commands are deferred as requested. This seam only reads fixtures
 * in mock mode, and never changes the signed-in organisation's governance records.
 * MANDATE_NOT_FOUND is the local mock's missing-record code, not a published API contract.
 */
export function loadMandateDetail(
  mandateId: string,
  view: Exclude<MandateDetailView, "loading"> | null,
): Promise<LoadOutcome<MandateDetailRecord>> {
  // Select mock before touching any real service configuration.
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(mockMandateDetail(mandateId, view ?? "submitted"));
}
