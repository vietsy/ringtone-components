# api

Where `@rightone/api-client` is called, and the only place a token is ever handled - on the server,
never in a client component (R23.6).

The client is not published yet, so these functions return a failure. They do not return an empty
result: the difference between "there is nothing" and "we could not ask" is the distinction the
whole view-state contract exists to preserve.

With `RIGHTONE_DATA=mock` they answer from the mock backend (`lib/mock/backend`), which behaves as the API
will: commands change state and later reads see the change.

    session.ts   who is signed in: the data access layer every page, seam and action asks first
    flash.ts     what a form hands to the page it redirects to (a refused act, fields to correct)
    source.ts    whether the portal runs on mock data, and the failure every seam returns otherwise
