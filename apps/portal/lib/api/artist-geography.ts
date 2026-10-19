import type { LoadOutcome } from "@rightone/ui";
import { artistGeography, artistGeographyReleases, geographyTermsInForce } from "@/lib/mock/backend/data-governance";
import { GEOGRAPHY_AREAS, GEOGRAPHY_PERIODS, mockArtistGeographyFailure, type GeographyView } from "@/lib/mock/artist-geography";
import type { GeographyLevel } from "./data-governance";
import type { Artist } from "./session";
import { NOT_CONFIGURED, usesMockData } from "./source";

/*
 * DAT's artist-facing geography read (`GET /api/v1/reporting/artist-geography`, `FR-DAT-012`, `037`, `038`, `DR-92`),
 * for the artist portal's location view: where the artist's works were played, one area at one level over one period.
 * Kept apart from `data-governance.ts`, which holds DAT's console reads, because its reader is the artist and nothing
 * else of DAT's is read in that portal. Every answer is recorded as a release, so the next answer can be tested against
 * what the artist already holds.
 */

/** An area an artist may ask about; a ward names the province it lies in. */
export interface GeographyArea {
  code: string;
  name: string;
  level: GeographyLevel;
  parent: string | null;
}

/** A period an answer covers: the quarter or one of its months, first and last day inclusive. */
export interface GeographyPeriod {
  code: string;
  from: string;
  to: string;
}

/** `DR-92`'s outcomes, and the reason code of each row, with the two refusals the contract adds ahead of it. */
export type GeographyOutcome = "RELEASE" | "SUPPRESS" | "REFUSE";
export type GeographyReason =
  | "DEFAULT_LEVEL"
  | "AT_MINIMUM_INCLUSIVE"
  | "BASIS_PERMITS_FINER_LEVEL"
  | "BASIS_NOT_EFFECTIVE"
  | "GEOGRAPHY_BELOW_MINIMUM"
  | "DIFFERENCING_WOULD_DISCLOSE"
  | "PREMISES_IDENTITY_NOT_DISCLOSABLE"
  | "LEVEL_NOT_PERMITTED";

/** What the artist asks: an area, the level of detail, a period, and whether they asked which venue it was. */
export interface GeographyAsk {
  area: string;
  level: string;
  period: string;
  identify: boolean;
}

/** A disclosure basis the data protection officer approved for the artist to see a finer level, and until when. */
export interface GeographyBasis {
  ref: string;
  level: GeographyLevel;
  effectiveTo: string | null;
}

/** The policy terms an answer was bounded by (`reporting.geography_policies`). */
export interface GeographyTerms {
  version: number;
  permittedLevels: readonly GeographyLevel[];
  defaultLevel: GeographyLevel;
  minimum: number;
  differencingAcrossPeriods: boolean;
}

/** One area of a finer-level answer: its figure, or that it is suppressed and not merged into its neighbour (row 8). */
export interface GeographyChild {
  area: GeographyArea;
  plays: number | null;
  suppressed: boolean;
}

/** One answer, as the read returns it and the release log keeps it. */
export interface GeographyAnswer {
  outcome: GeographyOutcome;
  reason: GeographyReason;
  area: GeographyArea;
  period: GeographyPeriod;
  /** The level asked for, as asked. */
  requestedLevel: string;
  /** The level the figure is aggregated to: the one asked, or the default where no basis permits a finer one. */
  level: GeographyLevel | null;
  /** The plays of the artist's works in the scope; null unless the figure is released. */
  plays: number | null;
  /** The basis a finer level was released under; null for the default level, which needs none. */
  basis: GeographyBasis | null;
  /** A finer basis that is no longer effective, which the answer says (row 5). */
  lapsedBasis: GeographyBasis | null;
  children: readonly GeographyChild[];
  /** DIFFERENCING_WOULD_DISCLOSE: the answer already released that this one was compared with. */
  compared: { area: GeographyArea; period: GeographyPeriod } | null;
  terms: GeographyTerms;
  recordedAt: string;
}

/** A row of the artist's release log, newest first: each answer they were given, released, suppressed or refused. */
export interface GeographyRelease {
  area: GeographyArea;
  period: GeographyPeriod;
  requestedLevel: string;
  outcome: GeographyOutcome;
  reason: GeographyReason;
  /** DIFFERENCING_WOULD_DISCLOSE: the scope already released it was compared with, so both scopes are on the row. */
  compared: { area: GeographyArea; period: GeographyPeriod } | null;
  /** Who was answered, and when: a refused attempt is recorded with the actor and the instant. */
  by: string;
  recordedAt: string;
}

/** The location view: what may be asked, the policy in force, the answer to what was asked, and what was given before. */
export interface ArtistGeographyPage {
  areas: readonly GeographyArea[];
  periods: readonly GeographyPeriod[];
  levels: readonly GeographyLevel[];
  terms: GeographyTerms;
  answer: GeographyAnswer | null;
  /** The request for a venue's identity, refused and recorded with the instant; the view stays at the level permitted. */
  identityRefused: { at: string } | null;
  released: readonly GeographyRelease[];
}

const LEVELS: readonly GeographyLevel[] = ["province", "ward"];

/**
 * The location view for the signed-in artist. With nothing asked, the choices and what they were given before. Asked
 * which venue it was, the read is refused PREMISES_IDENTITY_NOT_DISCLOSABLE and recorded, and the same scope is asked
 * again without it, so the view stays at the geography the policy and basis permit (`AC-FR-DAT-012-03`).
 */
export function loadArtistGeography(artist: Artist, asked: GeographyAsk | null, view: GeographyView | null): Promise<LoadOutcome<ArtistGeographyPage>> {
  if (!usesMockData()) return Promise.resolve(NOT_CONFIGURED);
  if (view === "error") return Promise.resolve(mockArtistGeographyFailure());
  const who = { email: artist.email, name: artist.account };
  const terms = geographyTermsInForce(artist.sessionId);
  const page = { areas: GEOGRAPHY_AREAS.filter((area) => area.level === "province"), periods: GEOGRAPHY_PERIODS, levels: LEVELS, terms };
  let answer: GeographyAnswer | null = null;
  let identityRefused: { at: string } | null = null;
  if (asked !== null) {
    const first = artistGeography(artist.sessionId, who, asked);
    if (first.data === null) return Promise.resolve({ data: null, failure: first.failure });
    answer = first.data;
    if (asked.identify && first.data.reason === "PREMISES_IDENTITY_NOT_DISCLOSABLE") {
      identityRefused = { at: first.data.recordedAt };
      const again = artistGeography(artist.sessionId, who, { ...asked, identify: false });
      if (again.data === null) return Promise.resolve({ data: null, failure: again.failure });
      answer = again.data;
    }
  }
  const released = artistGeographyReleases(artist.sessionId, who);
  if (released.data === null) return Promise.resolve({ data: null, failure: released.failure });
  return Promise.resolve({ data: { ...page, answer, identityRefused, released: released.data }, failure: null });
}
