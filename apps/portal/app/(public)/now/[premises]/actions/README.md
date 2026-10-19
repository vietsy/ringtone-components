# actions

    page.tsx    SCR-PLR-19  guest actions (D-PLY-06, `/now/[venue]/actions`)

GET /now-playing/{premisesId}, the answer SCR-PLR-06 reads (`loadNowPlaying`, from the Player device's mock
`nowPlaying`). Two frames from one address, as `getFrame` decides (`?frame=phone` on a desktop browser):

- The installed display (1920, Figma 807:244768): the title and the four credit roles on the left, with Lyrics,
  Support the artist and Verify this venue listed under them, each with its state word; on the right the cover, the
  code and the scan line. Nothing on it is touched. The code opens this page on a guest's phone.
- The guest's phone (390, Figma 807:244873), in PublicShell: the cover beside the venue line, the title, byline and
  four credits, then Verify this venue (primary, opens PUB's Player verification page with the printed code of the
  premises' current verification document), Read the lyrics and Support the artist, full width. One that cannot open
  stays, disabled with its reason, and the music is not affected.

The actions follow the service. When delivery stops (VEN's public status of the premises' Player service is not
ACTIVE, or the device's credential is not ACTIVE), the answer is STOPPED with no track: the display shows the venue
and "Lúc này chưa có nhạc", with the code only where Verify this venue can still open; the phone shows the same
words, Verify this venue open, and the two others disabled with "Lúc này không có bài nào đang phát." A device that
is offline plays on from what it holds, so its track and credits stay, and Verify this venue reads unavailable.
No device paired: no venue, nothing to verify. Views: loading, error.

- The mock holds no lyrics and no tip provider, so both read unavailable everywhere, with SCR-PLR-06's sentences
  for lyrics and the board's for support.
- The board's glass pane behind the cover is a class no screen may write, so it is left out, as on SCR-PLR-06; the
  ambient ground is R1's PlayerAmbient, drawn once the page is in the browser (`features/venue/Cover.tsx`).
- The words both guest screens share (the labels, Xem lời bài hát, Xác minh cơ sở này, the idle line and the
  reasons) are SCR-PLR-06's (`plr06.*`); the scan lines, the code's label and the two reasons only this screen has
  are `plr19.*` in `messages/screens/plrops.*.json`.
