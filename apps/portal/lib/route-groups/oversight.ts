import { route } from "./route";

/**
 * The oversight, data-governance, translation and continuity screens (SCR-PUB-19, 20, SCR-DAT-04, 16, SCR-SVC-13, 14, 21).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A path with the query a console's filter sends, leaving out what was not asked. */
function withQuery(path: string, query: Readonly<Record<string, string | null | undefined>>): string {
  const given = Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
  return given.length === 0 ? path : `${path}?${new URLSearchParams(given).toString()}`;
}

type Query<K extends string> = Partial<Record<K, string | null>>;

export const oversightRoutes = {
  /** The oversight console's landing */
  oversight: () => route("/oversight"),
  /** SCR-PUB-19 Verification outcome counts (the oversight console), for a period and a route */
  oversightVerificationCounts: (query: Query<"period-from" | "period-to" | "route"> = {}) =>
    route(withQuery("/oversight/verification-counts", query)),
  /** SCR-PUB-20 Disclosure profile in effect (the oversight console), for a record type, now or at an instant */
  oversightDisclosureProfile: (query: Query<"type" | "at"> = {}) => route(withQuery("/oversight/disclosure-profile", query)),

  // The operations console: data governance and privacy operations
  /** SCR-DAT-04 Provenance classification, at the value a report's figure links to, now or as at a past day */
  opsProvenance: (query: Query<"value" | "fields" | "as-of"> = {}) => route(withQuery("/ops/data/provenance", query)),
  /** SCR-DAT-04 Export: the figure and its inputs as a CSV file, every value with its class in a column */
  opsProvenanceExport: (query: Query<"value" | "as-of">) => route(withQuery("/ops/data/provenance/export", query)),
  /** SCR-DAT-16 Geography policy, with the preview's filter and, while one is prepared, the new version */
  opsGeographyPolicy: (query: Query<"q" | "period" | "draft"> = {}) => route(withQuery("/ops/privacy/geography-policy", query)),

  // The operations console: the translation register
  /** SCR-SVC-21 Translation register, for the content key typed; `record` opens the form that records a translation */
  opsTranslations: (query: Query<"content" | "record"> = {}) => route(withQuery("/ops/translations", query)),

  // The security console: service continuity
  /** SCR-SVC-13 Availability by period, for one critical process or every one */
  securityAvailability: (query: Query<"process" | "period-from" | "period-to"> = {}) => route(withQuery("/security/availability", query)),
  /** SCR-SVC-14 Locations and route dependencies, at the recording interval asked or the last one recorded */
  securityLocations: (query: Query<"at"> = {}) => route(withQuery("/security/locations", query)),
} as const;
