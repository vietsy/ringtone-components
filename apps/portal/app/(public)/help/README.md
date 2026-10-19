# help

    page.tsx    SCR-PUB-12  Help, privacy and contacts
    player/     SCR-PUB-13  Player installation guide

The routes of the help route register, per world (`lib/mock/backend/public.ts`, seeded from SCR-PUB-18): support
(1900 2468 13), complaint, correction (rightone.vn/dinh-chinh) and the authoritative contact (lienhe@rightone.vn),
then privacy information and privacy rights (baovedulieu@rightone.vn), each with who answers it and the day it was
last confirmed. A purpose with no confirmed route shows the authoritative contact in its place and says so: at P1
the complaint route (unconfirmed, more than 90 days since 29 June 2026) and privacy information (DAT's notice is not
offered). `?journey=` lists one journey's routes (the footer's "Quyền riêng tư" opens the privacy journey); a
journey outside the set is JOURNEY_UNKNOWN. `?from=` carries the verification answer or track page "Quay lại"
returns to; anything else offers no way back.

Above the routes, the help page (`GET /pages/HELP`) in effect, as the policy console published it, when its version
holds a text of its own; the seed's 2026.1 holds none.

`?view=` shows any view the canvas drew: p1-partial (the default), populated, journey-unknown, loading, error.

Deviation: on a phone the confirmation day joins the line of who answers, where the board puts it beside the title
and leaves the title a word per line.
