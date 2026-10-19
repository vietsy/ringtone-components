import { enc, route } from "./route";

/**
 * PTY on the operations console: parties, identification, authorities (SCR-PTY-01 to 04, 11 to 13).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string from the values that are set, in the order given. */
function withQuery(path: string, query: Readonly<Record<string, string | null | undefined>>): string {
  const pairs = Object.entries(query).filter((entry): entry is [string, string] => entry[1] !== null && entry[1] !== undefined && entry[1] !== "");
  return pairs.length === 0 ? path : `${path}?${new URLSearchParams(pairs).toString()}`;
}

export const partiesRoutes = {
  /** SCR-PTY-01 Party search and list: by name or record and state; `panel` opens Create party beside the list */
  opsParties: (query: { q?: string | null; state?: string | null; panel?: "create" | null } = {}) =>
    route(withQuery("/ops/parties", { q: query.q, state: query.state, panel: query.panel })),
  /** SCR-PTY-02 Party detail; `panel` opens Add person or Record principal beside it */
  opsParty: (party: string, panel?: "person" | "principal") => route(withQuery(`/ops/parties/${enc(party)}`, { panel })),
  /** SCR-PTY-03 Identification of a party */
  opsPartyIdentification: (party: string) => route(`/ops/parties/${enc(party)}/identification`),
  /** SCR-PTY-04 Identification review queue, by kind and by age in days */
  opsIdentificationReviews: (query: { kind?: string | null; age?: string | null } = {}) =>
    route(withQuery("/ops/identification-reviews", { kind: query.kind, age: query.age })),
  /** SCR-PTY-05 Review detail and decision */
  opsIdentificationReview: (review: string) => route(`/ops/identification-reviews/${enc(review)}`),

  /** SCR-PTY-19 Premises portfolio: the premises the person's authority covers, for the party they act for */
  premisesPortfolio: (party?: string) => route(withQuery("/portfolio", { party })),
  /** SCR-PTY-07 on the premises portal: one premises of the portfolio, its relationships and changes */
  portfolioPremises: (premises: string) => route(`/portfolio/${enc(premises)}`),
  /** SCR-PTY-02 with one person of the register opened beside it, to read and to link an account (PATCH /party-persons) */
  opsPartyPerson: (party: string, person: string) => route(withQuery(`/ops/parties/${enc(party)}`, { panel: "amend-person", person })),
  /** SCR-PTY-04 with Raise candidacy open beside the queue */
  opsRaiseCandidacy: () => route("/ops/identification-reviews?panel=candidacy"),
  /** FR-PTY-048 The change records of the party register, for a period (the register data console) */
  opsChangeRecords: (query: { from?: string | null; to?: string | null; kind?: string | null; subject?: string | null } = {}) =>
    route(withQuery("/ops/change-records", { from: query.from, to: query.to, kind: query.kind, subject: query.subject })),

  /** SCR-PTY-11 Authorities of a party, on the premises portal: the principal's own party, or the one asked about */
  partyAuthorities: (party?: string) => route(withQuery("/authorities", { party })),
  /** SCR-PTY-12 Grant an authority */
  grantPartyAuthority: () => route("/authorities/new"),
  /** SCR-PTY-12 Amend an authority */
  amendPartyAuthority: (authority: string) => route(`/authorities/${enc(authority)}/amend`),
  /** SCR-PTY-13 Authority detail and revocation */
  partyAuthority: (authority: string) => route(`/authorities/${enc(authority)}`),

  /** SCR-PTY-11 on the security console, read only: the authorities of the party chosen */
  securityPartyAuthorities: (party?: string) => route(withQuery("/security/authorities", { party })),
  /** SCR-PTY-13 on the security console, read only */
  securityPartyAuthority: (authority: string) => route(`/security/authorities/${enc(authority)}`),
} as const;
