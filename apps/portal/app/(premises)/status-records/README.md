# status-records

    page.tsx                SCR-CER-11  the status records of a premises
    [record]/page.tsx       SCR-CER-12  one status record, or one still waiting to issue
    [record]/print/page.tsx SCR-CER-13  its A4 printout

Each page reads the signed-in session's records from the mock backend (`lib/mock/backend/status-records.ts`),
seeded with the records the canvas draws a holder's page for: Pasteur's `R1-CER-2026-T7QM4BWJ` and Nguyễn
Huệ's `R1-CER-2026-N6PZ2RKE`. `?view=` still forces any state the canvas drew, for review.

Who may read and print is PTY's answer (`mayActFor`, `PERM-770`, `771`, `775`, `776`): the principal for every
premises the party operates, a delegate for those her authority covers. The delegate Hầu Ngọc Ánh reads Nguyễn
Huệ's records and is refused Pasteur's.

SCR-CER-11: the address names the premises (`?premises=pasteur`, REG's id, or its register record). With none named
the page says so (`PREMISES_FILTER_REQUIRED`) and lists the premises the person may read the records of, each
opening its list. A named premises lists its records still waiting to issue first, each with the first condition it
waits on, then its issued records, the latest change of status first, 25 a page with Xem thêm; Back opens the
premises' page (SCR-PTY-07). Lê Thánh Tôn's amended record `R1-CER-2026-K9TE4WQC` is drawn only in this list, with no
page of its own, so it is the amended review view rather than a live record. Review views: one, amended, empty,
premises-required, not-authorised, unavailable, loading, error.

SCR-CER-12: an issued record shows its name, legal nature, legal effect and issuer as it copied them from its
definition when it issued (FR-CER-019), its periods, the ground and remedy of a suspension, revocation or
cancellation, and its printouts; while it is expiring or expired, Gia hạn opens the decision it carries
(SCR-REG-08), where the renewal is applied for. A record waiting to issue is addressed by its decision
(`/status-records/OBD-...`) and lists every condition it waits on; an approval wait is not the holder's to read
(`Q-CER-13`), and it has no remedy, printout or Print.
