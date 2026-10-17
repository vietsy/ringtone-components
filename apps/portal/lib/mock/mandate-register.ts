import type { LoadOutcome } from "@rightone/ui";
import type { MandateRegisterEntry, MandateRegisterSnapshot, MandateRegisterView } from "@/lib/api/mandate-register";

/** Figma m5jgAuVYNjDLvzBIrz6n1L, node 140:461: a snapshot, not a historical event log. */
export const MANDATE_REGISTER_AS_OF = "2026-09-28";

const authority = { vi: "Cục Bản quyền tác giả", en: "Copyright Office of Vietnam" } as const;

const entries: readonly MandateRegisterEntry[] = [
  {
    id: "appa", granteeId: "appa", grantee: { vi: "APPA", en: "APPA" },
    kind: "organisation", status: "SUBMITTED", scopeCount: 4,
    effectiveFrom: "2026-10-01", effectiveTo: null, authority,
  },
  {
    id: "riav", granteeId: "riav", grantee: { vi: "RIAV", en: "RIAV" },
    kind: "organisation", status: "SUSPENDED", scopeCount: 6,
    effectiveFrom: "2026-08-01", effectiveTo: null, authority,
  },
  {
    id: "vcpmc", granteeId: "vcpmc", grantee: { vi: "VCPMC", en: "VCPMC" },
    kind: "organisation", status: "EFFECTIVE", scopeCount: 12,
    effectiveFrom: "2026-07-01", effectiveTo: null, authority,
  },
  {
    id: "riav-pilot", granteeId: "riav", grantee: { vi: "RIAV, thí điểm", en: "RIAV, pilot" },
    kind: "organisation", status: "EXPIRED", scopeCount: 3,
    effectiveFrom: "2026-03-01", effectiveTo: "2026-06-30", authority,
  },
  {
    id: "rightone", granteeId: "rightone", grantee: { vi: "RightOne (đơn vị vận hành)", en: "RightOne (operator)" },
    kind: "portal", status: "EFFECTIVE", scopeCount: null,
    effectiveFrom: "2026-01-01", effectiveTo: null, authority,
  },
];

export function mockMandateRegister(
  view: Exclude<MandateRegisterView, "loading">,
): LoadOutcome<MandateRegisterSnapshot> {
  if (view === "error") {
    return { data: null, failure: { code: "INTERNAL_ERROR", traceId: null, retryable: true } };
  }
  return {
    data: {
      asOf: MANDATE_REGISTER_AS_OF,
      // Return independent data so a caller cannot mutate later mock reads.
      entries: view === "empty" ? [] : entries.map((entry) => ({ ...entry, grantee: { ...entry.grantee }, authority: { ...entry.authority } })),
    },
    failure: null,
  };
}
