# artist

The artist portal (ACT-ART): an artist signed in, acting for themselves. Every page asks `requireArtist()` first, and
every read is of the artist's own record. Only the screens the specification has opened are built; the rest of the
portal stays reserved until its specification is approved.

    page.tsx                     the landing: the artist's engagement, the first item of the nav
    engagement/page.tsx          SCR-ENG-01  take part in engagement
    engagement/balance/          SCR-ENG-02  balance and history, as at an instant
    engagement/points/           SCR-ENG-03  what these points are
    engagement/events/[event]/   SCR-ENG-04  one ledger event of the artist's own
    engagement/referral/         SCR-ENG-05  referral reference
    geography/                   where the artist's works were used, as `GET /reporting/artist-geography` answers it

The engagement screens are the ones the premises portal draws (`features/engagement`), in this portal's shell and nav.
