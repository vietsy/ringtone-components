import { enc, route } from "./route";

/**
 * VER beyond the field client: designations, appointments, the premises' inspection records, corrections, oversight (SCR-VER-09 to 16, 18).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A path with the query a screen reads, leaving out what is not given. */
function withQuery(path: string, query: Readonly<Record<string, string | null | undefined>>): string {
  const given = Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
  return given.length === 0 ? path : `${path}?${new URLSearchParams(given).toString()}`;
}

export const inspectionMoreRoutes = {
  // The operations console
  /** SCR-VER-09 Inspection authorities */
  opsInspectionAuthorities: () => route("/ops/inspection-authorities"),
  /** SCR-VER-10 Decide a designation: the designations waiting, one opened, or the decision just recorded */
  opsDesignationDecisions: (query: { designation?: string | undefined; decided?: string | undefined } = {}) =>
    route(withQuery("/ops/inspection-authorities/decisions", query)),
  /** SCR-VER-11 Inspector appointments, of one authority */
  opsInspectorAppointments: (authority?: string) => route(withQuery("/ops/inspection-appointments", { authority })),
  /** SCR-VER-12 Decide an appointment: the appointments waiting and suspended, one opened, or the decision just recorded */
  opsAppointmentDecisions: (query: { appointment?: string | undefined; decided?: string | undefined } = {}) =>
    route(withQuery("/ops/inspection-appointments/decisions", query)),

  // The premises portal
  /** SCR-VER-13 Inspection records of your premises */
  inspectionRecords: (premises?: string) => route(withQuery("/inspection-records", { premises })),
  /** SCR-VER-13 with one record opened */
  inspectionRecord: (record: string) => route(`/inspection-records/${enc(record)}`),
  /** SCR-VER-13 Download PDF: the record's printable sheet */
  inspectionRecordPrint: (record: string) => route(`/inspection-records/${enc(record)}/print`),
  /** SCR-VER-14 Request reconsideration of a record or an answer, by its reference; with `sent`, the case it opened */
  requestReconsideration: (query: { subject?: string | undefined; sent?: string | undefined } = {}) => route(withQuery("/reconsideration-requests/new", query)),

  // The field client
  /** SCR-VER-06 with a version a correction superseded, read whole as it was issued */
  fieldRecordVersion: (record: string, version: number) => route(withQuery(`/field/records/${enc(record)}`, { version: String(version) })),
  /** SCR-VER-06 Print a copy: the record's printable sheet, with a QR code carrying its reference */
  fieldRecordPrint: (record: string, version: number | null = null) =>
    route(withQuery(`/field/records/${enc(record)}/print`, { version: version === null ? null : String(version) })),

  // The inspection console
  /** SCR-VER-18 Inspections and records of the authority: filtered by flag, a record opened, an inspection just closed; a page by its cursor */
  inspectionWork: (query: { flag?: string | undefined; record?: string | undefined; closed?: string | undefined; cursor?: string | undefined } = {}) =>
    route(withQuery("/inspection/records", query)),
  /** SCR-VER-15 Correct a record, under the case named */
  inspectionCorrection: (record: string, caseRef?: string) =>
    route(withQuery(`/inspection/records/${enc(record)}/correct`, { case: caseRef })),

  // The oversight console
  /** SCR-VER-16 Oversight of inspections and supplies, for a month and an authority, with one supply's header opened */
  oversightInspections: (query: { period?: string | undefined; authority?: string | undefined; supply?: string | undefined } = {}) =>
    route(withQuery("/oversight/inspections", query)),
  /** SCR-VER-16 Export CSV: the month's counts, no names */
  oversightInspectionsExport: (query: { period?: string | undefined; authority?: string | undefined } = {}) =>
    route(withQuery("/oversight/inspections/export", query)),
} as const;
