# print

    page.tsx   SCR-VER-06  Print a copy

The whole record as the issuing authority reads it (`GET /inspection-records/{ref}`, `version` where an earlier one
is asked for), as R1's PrintableRecord, A4, in the light theme, with no shell: the browser prints it or saves it as a
PDF. It carries the answers the record cites with their limits, the digest's tail, and a QR code encoding the record's
reference, which any inspector scans or types on SCR-VER-01 to confirm it (FR-VER-036). Another authority's inspector
reads the confirmation only, so the sheet says the whole record is the issuing authority's; a refused read says why.
