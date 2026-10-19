# pairing

    page.tsx    SCR-IAM-06  issue a pairing authorisation

The premises (those the party holds an effective relationship for) and the purpose; Issue the code shows the value
once, with its expiry 15 minutes on, and RightOne keeps only its hash, so the value lives only in the attempt the act
hands the page. Issue another and Revoke (a required reason, confirmed) act on it; the premises' codes are listed with
what became of each, never their value. Views: empty, refused, loading, error.

- The board draws the screen under RightOne ID's own nav (My access, Issue a pairing authorisation); on the portal it
  is in the Player section, since My access (SCR-IAM-05) is not on the portal.
- Rate limits are CFG-196's five attempts per ten minutes from this browser, a refused attempt counted as well and
  the sixth refused whatever it asked for, and the contract's twenty issues an hour per premises. A refused attempt is
  recorded with the origin and the count; an issued code names who asked for it and raises NTF-IAM-01 with COM, which
  holds no class for it yet, so IAM records it as issued and undelivered. No device claims a code in the mock: the
  device's side (SCR-PLR-16) is not on the portal, so a code stays issued until it expires or is revoked.
