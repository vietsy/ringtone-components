# reports

    page.tsx    SCR-PUB-11  Tariff and public disclosures

The tariff in force, the amnesty period and the reports, each section its owner's answer, read as at today or as
at the day "Xem tại ngày" asks (`?at=`, a GET form). A day that has not come or is not a day is INSTANT_INVALID,
said under the field, and the sections are read as at today. The tariff is the version TAR applies that day, from
the same versions SCR-PUB-02 and 03 calculate under (`TARIFF_VERSIONS`): TV-2026.1 from 1 July 2026, TV-2026.0 for
1 March to 30 June 2026 (marked no longer current, with TV-2026.1 named), and no approved tariff before. REG's
amnesty period AMV-2026-1 (1 January to 30 June 2027, approved 25 September 2026) is not released before it begins
and is announced as upcoming; asked as at a day before its approval, nothing of it is known. Each report is
released from the day its owner released it (`REPORT_RELEASES`); a released report's "Mở" opens it at
`?open=<name>`, and a name that is no disclosure is DISCLOSURE_KIND_UNKNOWN, above the page.

`?view=` shows any view the canvas drew: p1 (the default), populated (TV-2026.1, four reports released),
superseded (as at 15 June 2026), instant-invalid, kind-unknown, loading, error.

Above the sections, the page "Cách đọc biểu phí" (`GET /pages/TARIFF`) as the policy console published it, as at the
same day, when its version holds a text of its own; the seed's 2026.1 holds none. `/mandates`, the spec's second
address for this page, opens it with the mandate list (`../mandates/`).

Deviations: the default is the world's data, not the board's P1 frame (tariff and reports not offered); that
frame is `?view=p1`.
