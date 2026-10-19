import { enc, route } from "./route";

/** The legal documents of SCR-PUB-10, by the address each is read at. */
export type LegalDocumentSlug = "premises-service-terms" | "artist-terms" | "rights-withdrawal" | "takedown-process" | "privacy-notice";

/** The public help journeys (`GET /help-routes?journey=`), as SCR-PUB-12 is opened for one. */
export type HelpJourney = "about" | "scope" | "tariff" | "verify" | "complain" | "privacy" | "player" | "legal";

const query = (pairs: Readonly<Record<string, string | undefined>>): string => {
  const given = Object.entries(pairs).filter((pair): pair is [string, string] => pair[1] !== undefined && pair[1] !== "");
  return given.length === 0 ? "" : `?${new URLSearchParams(given).toString()}`;
};

/**
 * Public web: Player and licence verification, artist and track pages, legal documents, tariff, help, Player guide (SCR-PUB-06 to 13).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */
export const publicPagesRoutes = {
  /** SCR-PUB-01 What RightOne is, as in effect or as at an instant (`at`), the date chosen in the page's history */
  about: (options: { at?: string } = {}) => route(`/${query({ at: options.at })}`),
  /** SCR-PUB-04 Verify a record, for a RightOne Player document or for a direct licence or proof rather than a certificate */
  verifyOf: (kind: "player" | "licence") => route(`/verify?kind=${kind}`),
  /** SCR-PUB-06 Player service verification: the address the QR code of a Player verification document opens, by the token printed on it */
  verifyPlayer: (printedCode: string) => route(`/verify/player/${enc(printedCode)}`),
  /** SCR-PUB-07 Direct-licence verification, by the licence's public reference */
  verifyLicence: (reference: string) => route(`/verify/licence/${enc(reference)}`),
  /** SCR-PUB-07 Proof verification, by the evidence set's public reference */
  verifyProof: (reference: string) => route(`/verify/proof/${enc(reference)}`),
  /** SCR-PUB-08 Public artist profile */
  artist: (slug: string) => route(`/a/${enc(slug)}`),
  /** SCR-PUB-09 Public track page */
  track: (id: string) => route(`/t/${enc(id)}`),
  /** SCR-PUB-10 Legal document library: one document, as in effect, as at an instant (`at`), or with a version list (`history`) */
  legalDocument: (slug: LegalDocumentSlug = "premises-service-terms", options: { at?: string; history?: "document" | "page" } = {}) =>
    route(`/legal/${slug}${query({ at: options.at, history: options.history })}`),
  /** SCR-PUB-11 Tariff and public disclosures, as in effect today or as at a past date, with the disclosure "Mở" opened */
  disclosures: (options: { at?: string; open?: string } = {}) => route(`/reports${query({ at: options.at, open: options.open })}`),
  /** SCR-PUB-12 Help, privacy and contacts: every journey's routes, or one journey's; `from` is the page "Quay lại" returns to */
  help: (options: { journey?: HelpJourney; from?: string } = {}) => route(`/help${query({ journey: options.journey, from: options.from })}`),
  /** SCR-PUB-13 Player installation guide */
  playerGuide: () => route("/help/player"),
} as const;
