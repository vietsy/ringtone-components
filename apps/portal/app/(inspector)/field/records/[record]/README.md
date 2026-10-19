# [record]

    page.tsx   SCR-VER-06  Inspection record

Live, the page reads the record the reference names (the records issued in the session, and IRC-3XK7QW2MTD, Then
Cửa Bakery – Đa Kao's version 2, which the canvas draws issued before its moment), or RECORD_NOT_FOUND with Home.
The issuing authority, which is one of the inspector's appointments, reads the whole record. Record handover
(`POST /inspection-records/{ref}/deliveries`) defaults to now and to the representative's role, and the record
reads again handed over, or with HANDOVER_TIME_INVALID beside the time (before the record was issued, to the
minute, or later than now) or ALREADY_DELIVERED beside the handover. Print a copy prints the page; Close opens
SCR-VER-17.

Review views: pending, handed-over, corrected, challenge-unknown, offline, not-issuing, already-delivered,
handover-time-invalid, no-appointment, premises-unavailable, policy-unavailable, record-not-found,
not-authorised, loading, error. Who reads it is a second review axis: `?reader=other` draws another authority's
confirmation. The review fixtures select the record as before (IRC-7T2MW9KQ4D, or IRC-3XK7QW2MTD in corrected).

The record cites every answer it rests on with its limits (FR-VER-037), CER's state at the inspection for a compliant
outcome, and the case a referral opened; it says where the inspection took place (the register address, CFG-772), its
purpose and basis, the guidance, a referral's route and note, what the representative said and, recorded late, the
reason for the delay (FR-VER-007, FR-VER-038), as the printed copy does. Another authority's inspector reads that the
record is under challenge and nothing of the case (FR-VER-027). The delivery says how the record reached the premises: the notice raised
through COM at issue (its COM- reference and instant), the notice reaching the principal (NOTICE_DELIVERED, by the
notice route), a handover on site, or the period passed with neither (UNDELIVERED); a handover is recorded while it is
pending or undelivered, and a late one keeps the instant the period passed. Any inspector reads a record within
DR-740 rows 1 to 3; one whose appointments are all suspended or ended reads nothing, and under the last-day allowance
alone only the records made under it. Read version n, superseded opens a version a correction replaced
(`?version=n`), whole as it was issued, with the way back to the version in force. Print a copy opens the printable
sheet (`print/`), with a QR code carrying the reference.

Deviations: a record with no answer cited, or no finding, says "None" there (`ver06.none`, design/03 section 5c's
word); with nobody present the representative line is the acknowledgement's words alone; a dated follow-up carries its
date (`ver05.reVisitBy`, `ver05.awaitBy`). The sheet is the browser's print of an A4 page, not a PDF the phone builds.
Retry under a header refusal reloads the page.
