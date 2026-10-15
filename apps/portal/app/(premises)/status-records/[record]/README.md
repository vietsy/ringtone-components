# [record]

    page.tsx   SCR-CER-12  one status record: what it is, until when, why it is suspended, print it

Live: the session's record, with its printouts the latest first; a record the session does not hold is
`CERTIFICATE_NOT_FOUND`. Print is a server action (`features/status-records/actions.ts`) that makes a new
printout, with a new reference and the moment it was made, and opens it (SCR-CER-13); back on this page the
printout is the first of the list. Print refused (`RECORD_NOT_CURRENT`) is drawn beside Print.

The printout page opens a record's latest printout, as its address names no printout. So that no row opens
another printout than its own, only the latest row offers Open in the live list; the review views draw Open
on every row, as the board does.

Review views: active (`R1-CER-2026-T7QM4BWJ`, Pasteur), printing, printed, suspended, not-current-print,
signing-unavailable, not-printable, printout-not-found, not-authorised, not-found, unavailable, loading, error.
