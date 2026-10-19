# (artist)

Artists and direct licensors. Self-service: upload, rights declaration, direct licence, statistics.

The longest flows in the product are here, and they are where users abandon. Multi-step entry saves
progress at each step - losing twenty minutes of work is the most expensive UX failure this product
has.

Seventeen screens are reserved for this surface. What is built is what the specification has opened: the artist's
engagement record (SCR-ENG-01 to 05) and where their works were used (`GET /reporting/artist-geography`), under
`artist/`, in `PortalShell` with the artist nav (`components/shells/artist-nav.ts`). Every page asks
`requireArtist()` first. The rest stay reserved until their specification is approved.
