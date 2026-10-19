# field

The field client on the inspector's phone (R1 PublicShell, variant field).

    page.tsx                                   SCR-VER-17  Field client home
    scan/page.tsx                              SCR-VER-01  Scan and verify
    answers/[answer]/page.tsx                  SCR-VER-02  Verification answer
    inspections/new/page.tsx                   SCR-VER-03  Start an inspection
    inspections/[inspection]/page.tsx          SCR-VER-04  Inspection in progress
    inspections/[inspection]/conclude/page.tsx SCR-VER-05  Conclude the inspection
    records/[record]/page.tsx                  SCR-VER-06  Inspection record
    records/[record]/print/page.tsx            SCR-VER-06  Print a copy

SCR-VER-17 (`page.tsx`) reads the session: the appointments in force, the authority acted for, the inspector's
open inspections (the seed's three: Quán Nướng Hẻm 214 open past the recording interval, Pasteur, and Áp Mái
Bar – Thảo Điền under KTVH-KV2's last-day allowance; then those the inspector opens) and the counts of the
phone's results waiting and not uploaded. Review views: populated, empty, offline, p1-queue, update,
no-appointment, suspended, authority-not-active, policy-unavailable, cursor-invalid, signout-confirm,
not-authorised, loading, error.

Choosing the authority acted for is the act (`chooseActingFor`, through `features/inspection/ActingForChoice.tsx`):
the phone keeps it and every verification that names no inspection is made under it; the choice shows only with
two or more appointments in force (design/03). Open (a record reference) opens SCR-VER-06; each open inspection
opens SCR-VER-04; Verify a record opens SCR-VER-01; Sign out asks first while results wait to upload, then ends
the session (`endSession`) and RightOne ID's sign-in follows. Reload under "a new version is ready" and Retry
reload the page.

Deviations: the count of results not uploaded is the rows SCR-VER-01 draws (one), where SCR-VER-17's board writes
0; the two boards disagree and the count follows the phone's rows, so Discard on SCR-VER-01 brings it to 0. The
seeded inspections keep the canvas's reading of the recording interval and of KTVH-KV2's allowance (its moment is
30 September); an inspection opened in the session is flagged by the 24-hour rule (CFG-773) against the clock.
