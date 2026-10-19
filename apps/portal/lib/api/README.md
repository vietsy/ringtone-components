# api

Where `@rightone/api-client` is called, and the only place a token is ever handled - on the server,
never in a client component (R23.6).

The client is not published yet, so these functions return a failure. They do not return an empty
result: the difference between "there is nothing" and "we could not ask" is the distinction the
whole view-state contract exists to preserve.

With `RIGHTONE_DATA=mock` they answer from the mock backend (`lib/mock/backend`), which behaves as the API
will: commands change state and later reads see the change.

    session.ts   who is signed in and in which world: the data access layer every page, seam and action asks first;
                 `requireStaff(...roles)` for the gateway's staff
    flash.ts     what a form hands to the page it redirects to (a refused act, fields to correct)
    source.ts    whether the portal runs on mock data, and the failure every seam returns otherwise
    <family>.ts  one seam per family: its reads and commands, each answering a `LoadOutcome`
    artist-geography.ts  DAT's artist-facing geography read, kept apart from DAT's console seam because the artist portal
                 reads nothing else of DAT's
    <family>-terms.ts  the vocabularies a client component of that family needs (`parties-terms.ts`,
                 `premises-terms.ts`, `venue-terms.ts`); the seam re-exports them

A client component imports values only from a `-terms.ts` module, never from a seam: a seam imports the mock
backend, and a value import would carry it, seed data included, into the browser's bundle. Type imports from a
seam are erased and are fine.
