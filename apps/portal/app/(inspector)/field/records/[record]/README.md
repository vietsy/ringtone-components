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

Deviations: "Read version 1, superseded" (the corrected view) is left out: the board links it to itself and no
route opens an earlier version. A record with no answer in force attached, or no finding, says "None" there
(`ver06.none`, design/03 section 5c's word); with nobody present the representative line is the acknowledgement's
words alone; a dated follow-up carries its date (`ver05.reVisitBy`, `ver05.awaitBy`). Print is the browser's
print of the page, not the PDF with a QR code design/03 describes. The notice to the premises is drawn only as
"Not sent": the mock has no notification service. A request to reconsider is never recorded in the mock, so it
reads "No". Retry under a header refusal reloads the page.
