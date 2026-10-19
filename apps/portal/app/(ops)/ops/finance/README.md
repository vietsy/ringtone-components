# finance

    page.tsx                     SCR-FIN-14  outstanding amounts, the Finance workspace's landing
    suspense/page.tsx            SCR-FIN-04  suspense: held amounts, the holding account, the grounds recorded
    corrections/page.tsx         SCR-FIN-10  corrections, refunds and chargebacks
    write-offs/[amount]/page.tsx SCR-FIN-15  write-off approval of one outstanding amount

The FIN family on the operations console, in the Finance workspace of the rail. The three lists share the board's
link tabs, Suspense, Corrections and Outstanding, each with the count of what is open; Remittances and Period close
are the board's other tabs and have no page yet, so they are left out. The finance officer (ACT-FIN-OP, Phan Gia
Lượng) works both lists; the finance approver (ACT-FIN-APR, Thạch Minh Khải) opens both, decides the write-offs
and the refunds the officer records under a case; the auditor reads. The officer proposes a write-off from an outstanding amount's side
panel on SCR-FIN-14, with its ground; the amount's notices are the ones COM issued on the events FIN raised (a
reminder before the due date, the overdue notice after it), and the backend states over the table that no consequence
beyond them applies while DEC-13 is reserved (`FIN_CONSEQUENCE_RESERVED`, which `applyOutstandingConsequence` also
refuses with). The approver decides the return of a second payment as he decides a refund. Each page reads the world's finance from
`lib/mock/backend/finance.ts`; `?view=loading` and `?view=error` (and `unavailable` on suspense and corrections)
draw the states the data never reaches, for review.
