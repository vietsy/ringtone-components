# status-records

    page.tsx                      SCR-CER-01  status records, the Status records workspace's landing
    [record]/page.tsx             SCR-CER-02  one status record
    [record]/approve/page.tsx     SCR-CER-03  approve or decline an issue routed to an approver
    [record]/propose/page.tsx     SCR-CER-05  propose a status change
    [record]/history/page.tsx     SCR-CER-09  the record's periods, status changes and follow-ups
    [record]/print/page.tsx       the printout an officer's Print opens (the SCR-CER-13 sheet)
    reviews/page.tsx              SCR-CER-04  status reviews
    reviews/[review]/page.tsx     SCR-CER-06  decide a status change
    follow-ups/page.tsx           SCR-CER-07  re-decided obligations
    follow-ups/[followUp]/page.tsx SCR-CER-08 resolve a follow-up

The CER family on the operations console. A record is addressed by its reference once issued, by the decision it
was opened under while it waits to issue. Every page reads the browser's world from `lib/mock/backend/status-records.ts`;
the acts are `features/status-records/actions.ts`. The officer (ACT-OPS, Phan Gia Lượng) assesses, prints, proposes
and resolves; the business approver (ACT-BIZ-APR, Thạch Minh Khải) approves issues and decides status changes and
reads the follow-ups read only (he holds ACT-LGL); the auditor (ACT-AUD, Lê Văn Cường) reads. `?view=loading`,
`error` and the outages no act reaches (`unavailable`, `cursor-invalid`, `no-policy`, `policy-unavailable`,
`decision-unavailable`) draw those states for review.
