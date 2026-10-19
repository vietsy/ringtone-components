import { enc, route } from "./route";

/**
 * RightOne Player for the premises: enrolment, terms, services, playlists, schedule, venue view, pairing (SCR-VEN-01 to 11, SCR-PLR-04, 05, 06, SCR-IAM-06).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 *
 * The Player section's landing is `routes.player()` (`/player`, SCR-VEN-03), defined with the portal's sections.
 * A service is addressed by its entitlement code (RPS-7K2MQXB4TD), a device by its device reference (PLY-0023).
 */
/** A query string from the values set, or nothing. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const set = Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
  return set.length === 0 ? "" : `?${new URLSearchParams(set).toString()}`;
}

export const venuePortalRoutes = {
  /** SCR-VEN-03 My premises services, at the page a cursor names (the first page is `routes.player()`) */
  playerServices: (after?: string) => route(`/player${query({ after })}`),
  /** SCR-VEN-01 Enrol a premises */
  playerEnrol: () => route("/player/enrol"),
  /** SCR-VEN-04 Service detail and history */
  playerService: (service: string) => route(`/player/services/${enc(service)}`),
  /** SCR-VEN-02 Accept the service terms */
  playerTerms: (service: string) => route(`/player/services/${enc(service)}/terms`),
  /** SCR-VEN-05 Verification document */
  playerDocument: (service: string) => route(`/player/services/${enc(service)}/document`),
  /** SCR-VEN-05 Download: the issued document as a printable sheet, in the format chosen */
  playerDocumentFile: (document: string, format: "pdf" | "html") => route(`/player/documents/${enc(document)}?format=${format}`),
  /** SCR-VEN-06 Playlists and the default playlist, filtered by state once one is chosen */
  playerPlaylists: (service: string, status?: string, after?: string) => route(`/player/services/${enc(service)}/playlists${query({ status, after })}`),
  /** SCR-VEN-07 Playlist editor, a new playlist */
  playerNewPlaylist: (service: string) => route(`/player/services/${enc(service)}/playlists/new`),
  /** SCR-VEN-07 Playlist editor, a revision of one playlist */
  playerPlaylist: (service: string, playlist: string) => route(`/player/services/${enc(service)}/playlists/${enc(playlist)}`),
  /** SCR-VEN-08 Weekly schedule; the week and the as-at instant travel in the address once chosen, and the schedules' page */
  playerSchedule: (service: string, week?: Readonly<{ from: string; to: string; asOf: string }>, after?: string) =>
    route(`/player/services/${enc(service)}/schedule${query({ from: week?.from, to: week?.to, as_of: week?.asOf, after })}`),
  /** SCR-VEN-09 Fallbacks, at the page a cursor names */
  playerFallbacks: (service: string, after?: string) => route(`/player/services/${enc(service)}/fallbacks${query({ after })}`),
  /** SCR-VEN-10 Premises service view */
  playerServiceView: (service: string) => route(`/player/services/${enc(service)}/overview`),
  /** SCR-VEN-11 End the service */
  playerEnd: (service: string) => route(`/player/services/${enc(service)}/end`),
  /** The Player devices of the premises the person acts for, each opening its venue view */
  playerDevices: () => route("/player/devices"),
  /** SCR-PLR-04 Venue view, and SCR-PLR-05 Offline limit reached for a device whose limit has run out */
  playerDevice: (device: string) => route(`/player/devices/${enc(device)}`),
  /** SCR-IAM-06 Issue a pairing authorisation, for one premises once chosen */
  playerPairing: (premises?: string) => route(premises === undefined ? "/player/pairing" : `/player/pairing?premises=${enc(premises)}`),
  /** SCR-PLR-06 Now playing: the guest display and a guest's phone, no account */
  nowPlaying: (premises: string) => route(`/now/${enc(premises)}`),
} as const;
