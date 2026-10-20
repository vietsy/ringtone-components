import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import { mockMandateRegister } from "@/lib/mock/mandate-register";
import { NOT_CONFIGURED, usesMockData } from "./source";

export const MANDATE_REGISTER_VIEWS = ["populated", "loading", "empty", "error"] as const;
export type MandateRegisterView = (typeof MANDATE_REGISTER_VIEWS)[number];
export type MandateRegisterKind = "portal" | "organisation";
export type MandateRegisterStatus = "SUBMITTED" | "SUSPENDED" | "EFFECTIVE" | "EXPIRED";
export type MandateRegisterSortKey = "grantee" | "status" | "effectiveFrom";

export interface MandateRegisterFilters {
  grantee: string | null;
  kind: MandateRegisterKind | null;
  status: MandateRegisterStatus | null;
  asOf: string;
}

export interface MandateRegisterSort {
  key: MandateRegisterSortKey;
  direction: "asc" | "desc";
}

export interface MandateRegisterEntry {
  id: string;
  granteeId: string;
  grantee: Readonly<Record<Locale, string>>;
  kind: MandateRegisterKind;
  /** Status recorded at the snapshot date; no unrecorded historical transitions are inferred. */
  status: MandateRegisterStatus;
  /** Null for the portal mandate: the design records no scope-row count. */
  scopeCount: number | null;
  effectiveFrom: string;
  /** Null denotes an open-ended period. */
  effectiveTo: string | null;
  authority: Readonly<Record<Locale, string>>;
}

export interface MandateRegisterSnapshot {
  asOf: string;
  entries: readonly MandateRegisterEntry[];
}

/**
 * Sample register for design review, gated by mock mode and called after requireCmo().
 * This cross-organisation fixture grants no access to a real register. The production
 * seam must acquire its own register-read authorisation before an API is connected.
 * Loading is rendered by the feature without calling the loader.
 */
export function loadMandateRegister(
  _reader: { account: string },
  view: Exclude<MandateRegisterView, "loading"> | null,
): Promise<LoadOutcome<MandateRegisterSnapshot>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  return Promise.resolve(mockMandateRegister(view ?? "populated"));
}
