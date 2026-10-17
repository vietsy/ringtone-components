import type { LoadOutcome } from "@rightone/ui";
import type { MandateDetailPerson, MandateDetailRecord, MandateDetailView } from "@/lib/api/mandate-detail";

/** Figma m5jgAuVYNjDLvzBIrz6n1L, node 149:1371. `appa` is the local review record ID. */
const preparer: MandateDetailPerson = {
  id: "appa-preparer",
  name: "Đoàn Thị Mai",
  organisationName: "APPA",
  role: "administrator",
};

const submittedAt = "2026-09-18T15:40:00+07:00";

const appa: MandateDetailRecord = {
  id: "appa",
  organisation: { id: "appa", name: "APPA" },
  state: "SUBMITTED",
  effectiveFrom: "2026-10-01",
  effectiveTo: null,
  authority: {
    id: "AUTH-COPYRIGHT-01",
    name: { vi: "Cục Bản quyền tác giả", en: "Copyright Office of Vietnam" },
    provenance: "registry",
  },
  scope: [
    { id: "appa-hn", rightType: "performers", repertoire: "*", territory: "hn" },
    { id: "appa-hcm", rightType: "performers", repertoire: "*", territory: "hcm" },
    { id: "appa-dn", rightType: "performers", repertoire: "*", territory: "dn" },
    { id: "appa-ct", rightType: "performers", repertoire: "*", territory: "ct" },
  ],
  evidence: [{
    id: "appa-resolution-2026",
    title: {
      vi: "Nghị quyết uỷ quyền của hội viên APPA, 2026",
      en: "APPA members’ resolution to mandate, 2026",
    },
    mediaType: "application/pdf",
    sizeBytes: 1_400_000,
    uploadedAt: submittedAt,
    href: "#",
  }],
  submittedAt,
  preparer,
  approval: null,
  history: [{
    id: "appa-submitted",
    event: "submitted",
    state: "SUBMITTED",
    at: submittedAt,
    actor: preparer,
    source: "participation-portal",
  }],
};

export function mockMandateDetail(
  mandateId: string,
  view: Exclude<MandateDetailView, "loading">,
): LoadOutcome<MandateDetailRecord> {
  // An unknown ID never reveals APPA's record, including when a review view was requested.
  if (mandateId !== appa.id) {
    return { data: null, failure: { code: "MANDATE_NOT_FOUND", traceId: null, retryable: false } };
  }
  if (view === "error") {
    return { data: null, failure: { code: "INTERNAL_ERROR", traceId: null, retryable: true } };
  }
  // Each read is independent: UI preparation cannot mutate later requests' sample data.
  const record = structuredClone(appa);
  if (view === "empty") record.scope = [];
  return { data: record, failure: null };
}
