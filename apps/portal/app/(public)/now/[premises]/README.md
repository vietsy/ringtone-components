# [premises]

    page.tsx            SCR-PLR-06  now playing
    actions/page.tsx    SCR-PLR-19  guest actions

GET /now-playing/{premisesId}: what the premises' device plays, the title and four credit roles as the layout, and
the optional surfaces each with its own availability. The premises' name is the only thing shown about it. A device
offline plays from what it holds and cannot verify; a device stopped, or none paired, shows "Lúc này chưa có nhạc".
Verify this venue opens PUB's Player verification page (SCR-PUB-06) with the printed code of the premises' current
verification document. Views: paused (the board's "music paused"), loading, error.

- The mock holds no lyrics and no tip provider, so both surfaces read unavailable, with the board's sentences; the
  board draws lyrics available at Lê Thánh Tôn.
- While music plays the display stands on R1's PlayerAmbient ground, as the board draws it; the board's glass strip
  behind the poster is a class no screen may write, so it is left out. The scan line and the idle words are set in
  the guest body type (Text size guest).
- The cover and the ambient ground are drawn once the page is in the browser: R1's groove stand-in does not hydrate
  cleanly when drawn on the server.
- The display's code opens the guest actions (SCR-PLR-19) on the phone, where Verify this venue, Read the lyrics and
  Support the artist are; the screen inventory reaches SCR-PLR-19 from this screen, and nothing on a display is
  touched, so the code is that way.
