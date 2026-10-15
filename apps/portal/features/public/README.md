# public

What the public pages (`app/(public)`, SCR-PUB-01 to 05) share: their server actions and the pieces two
or more of them draw.

    actions.ts              "Xem kết quả", "Tính số tiền" and "Tra cứu": each asks the service once and opens
                            the page that shows its answer, with the answer and what was typed (`?attempt=`)
    guidance.ts             the sentences of a guidance answer, written from its data: the facts declared, the
                            basis, the floor-area band, the exemptions tested
    next-action.ts          "Việc tiếp theo" of a guidance answer: registering and applying lead to signing in
    rate-limited.ts         VERIFICATION_RATE_LIMITED's sentence with the time to retry
    layout.ts               the narrow layout per frame, and who reads a verification page
    PageError.tsx           the public error state, worded once (PUB convention 2)
    SupportPanel.tsx        the support line from the help route register
    VerificationAnswer.tsx  RECORD, ABSENT and UNABLE, as SCR-PUB-04 and SCR-PUB-05 draw them
