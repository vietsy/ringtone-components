# status-records

    page.tsx                SCR-CER-11  the status records of a premises
    [record]/page.tsx       SCR-CER-12  one status record
    [record]/print/page.tsx SCR-CER-13  its A4 printout

Each page reads the signed-in session's records from the mock backend (`lib/mock/backend/status-records.ts`),
seeded with the records the canvas draws a holder's page for: Pasteur's `R1-CER-2026-T7QM4BWJ` and Nguyễn
Huệ's `R1-CER-2026-N6PZ2RKE`. `?view=` still forces any state the canvas drew, for review.

SCR-CER-11: the portal's address names no premises yet, so the live list is every record of the party, the
latest change of status first, each reference with its premises under it (the board's list is one premises',
named in its title). Lê Thánh Tôn's amended record `R1-CER-2026-K9TE4WQC` is drawn only in this list, with no
page of its own, so it is the amended review view rather than a live record. Review views: one, amended,
empty, premises-required, not-authorised, unavailable, loading, error. The canvas's "Back to the premises"
button is left out until the premises page (PTY) exists: a control that leads nowhere is worse than none.
