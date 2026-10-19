import type { LoadOutcome } from "@rightone/ui";
import type { GeographyArea, GeographyPeriod } from "@/lib/api/artist-geography";
import { MOCK_ARTIST } from "./session";

/**
 * What `GET /reporting/artist-geography` answers from, for the artist portal's location view: where the artist's works
 * were played, as DAT's measurement would hold it. No board draws an artist's location view, so the areas are the four
 * provinces SCR-DAT-16's preview names (with the same premises counts for the third quarter of 2026) and three wards of
 * Hồ Chí Minh City for a finer level, the periods the quarter and its months. Each area numbers its premises; a month
 * lists the ones where a work of the artist was played, and the quarter is their union, so two answers can be compared
 * premises by premises, which the differencing check does. Invented figures; nothing here is a real record.
 */

/** The artists the read answers for, by their RightOne ID address, and the party DAT records a release against. */
export const GEOGRAPHY_ARTISTS: readonly { email: string; party: string }[] = [{ email: MOCK_ARTIST.email, party: MOCK_ARTIST.party }];

export const GEOGRAPHY_PERIODS: readonly GeographyPeriod[] = [
  { code: "2026-Q3", from: "2026-07-01", to: "2026-09-30" },
  { code: "2026-07", from: "2026-07-01", to: "2026-07-31" },
  { code: "2026-08", from: "2026-08-01", to: "2026-08-31" },
  { code: "2026-09", from: "2026-09-01", to: "2026-09-30" },
];

/** The provinces an artist asks about, and the wards a finer level breaks Hồ Chí Minh City into. */
export const GEOGRAPHY_AREAS: readonly GeographyArea[] = [
  { code: "hcm", name: "TP. Hồ Chí Minh", level: "province", parent: null },
  { code: "hn", name: "Hà Nội", level: "province", parent: null },
  { code: "ct", name: "Cần Thơ", level: "province", parent: null },
  { code: "dn", name: "Đồng Nai", level: "province", parent: null },
  { code: "ben-thanh", name: "Phường Bến Thành", level: "ward", parent: "hcm" },
  { code: "sai-gon", name: "Phường Sài Gòn", level: "ward", parent: "hcm" },
  { code: "cho-lon", name: "Phường Chợ Lớn", level: "ward", parent: "hcm" },
];

type Month = "2026-07" | "2026-08" | "2026-09";
const MONTHS: readonly Month[] = ["2026-07", "2026-08", "2026-09"];

/** An inclusive range of an area's premises numbers. */
type Range = readonly [number, number];

/**
 * Each province's premises where the artist's works were played, month by month. Cần Thơ is the area at the minimum:
 * eleven premises over the quarter and ten in each month, so once one of its figures is released the others would
 * disclose a single premises. Đồng Nai holds four, below any minimum the policy allows.
 */
const PLAYED: Readonly<Record<string, Readonly<Record<Month, Range>>>> = {
  hcm: { "2026-07": [1, 180], "2026-08": [21, 212], "2026-09": [1, 200] },
  hn: { "2026-07": [1, 20], "2026-08": [11, 34], "2026-09": [1, 10] },
  ct: { "2026-07": [1, 10], "2026-08": [2, 11], "2026-09": [1, 10] },
  dn: { "2026-07": [1, 2], "2026-08": [3, 3], "2026-09": [1, 4] },
};

/** The wards' premises, as numbers of Hồ Chí Minh City's: Phường Sài Gòn holds four. */
const WARDS: Readonly<Record<string, Range>> = { "ben-thanh": [1, 14], "sai-gon": [15, 18], "cho-lon": [19, 40] };

/** How many times the artist's works were played at one premises in one month: a fixed figure per premises and month. */
const playsAt = (area: string, premises: number, month: Month) => 8 + ((premises * 7 + Number(month.slice(5)) * 3 + area.length) % 23);

/**
 * The premises of an area where the artist's works were played over a period, as stable references DAT keeps to itself
 * (never shown), and the plays there: the scope a geography answer covers.
 */
export function geographyUse(area: string, period: string): { premises: ReadonlySet<string>; plays: number } {
  const province = WARDS[area] !== undefined ? "hcm" : area;
  const months = period === "2026-Q3" ? MONTHS : MONTHS.filter((month) => month === period);
  const within = WARDS[area] ?? ([1, Number.MAX_SAFE_INTEGER] as const);
  const premises = new Set<string>();
  let plays = 0;
  for (const month of months) {
    const range = PLAYED[province]?.[month];
    if (range === undefined) continue;
    for (let number = Math.max(range[0], within[0]); number <= Math.min(range[1], within[1]); number += 1) {
      premises.add(`${province}-${String(number).padStart(3, "0")}`);
      plays += playsAt(province, number, month);
    }
  }
  return { premises, plays };
}

/**
 * The disclosure bases a data protection officer has approved for an artist to see a level finer than the default
 * (`FR-DAT-012`). None: `DEC-23` leaves the expansion of artist geographic disclosure open.
 */
export const GEOGRAPHY_BASES: readonly { ref: string; artist: string; level: GeographyArea["level"]; effectiveFrom: string; effectiveTo: string | null }[] = [];

/** The review states the location view names that the live data never reaches: loading and our outage. */
export const GEOGRAPHY_VIEWS = ["loading", "error"] as const;
export type GeographyView = (typeof GEOGRAPHY_VIEWS)[number];

export function mockArtistGeographyFailure(): LoadOutcome<never> {
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: "d61b3f9a07c4e258", retryable: true } };
}
