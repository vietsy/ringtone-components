import { enc, route } from "./route";

/**
 * The artist portal (ACT-ART): its landing, the artist's engagement record (SCR-ENG-01 to 05) and the location view
 * DAT answers (`GET /artist-geography`). This group's routes, spread into `routes` by `lib/routes.ts`; only the work on
 * this group edits this file. The artist's public profile is PUB's (`routes.artist`), not this portal's.
 */

/** A query string from the values given, in the order given; empty when none is. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== null && value !== undefined && value !== "") params.set(key, value);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

export const artistRoutes = {
  /** The artist portal's landing: the artist's engagement, the first item of its nav */
  artistHome: () => route("/artist"),
  /** SCR-ENG-01 Take part in engagement, for the artist */
  artistEngagement: () => route("/artist/engagement"),
  /** SCR-ENG-02 Balance and history, as at an instant, from a page cursor */
  artistEngagementBalance: (at?: { asAt?: string | null; after?: string | null }) => route(`/artist/engagement/balance${query({ as_at: at?.asAt, after: at?.after })}`),
  /** SCR-ENG-03 What these points are */
  artistEngagementPoints: () => route("/artist/engagement/points"),
  /** SCR-ENG-04 One ledger event, the artist's own */
  artistEngagementEvent: (event: string) => route(`/artist/engagement/events/${enc(event)}`),
  /** SCR-ENG-05 Referral reference */
  artistReferral: () => route("/artist/engagement/referral"),
  /** Where the artist's works were used: one area, one period, one level, as `GET /artist-geography` answers it */
  artistGeography: (asked?: { area?: string | null; period?: string | null; level?: string | null; identify?: boolean }) =>
    route(`/artist/geography${query({ area: asked?.area, period: asked?.period, level: asked?.level, identify: asked?.identify === true ? "yes" : null })}`),
} as const;
