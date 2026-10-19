# public

What the public pages (`app/(public)`, SCR-PUB-01 to 13) share: their server actions and the pieces two
or more of them draw; and the staff side of the same family, the policy console and the help route register
(SCR-PUB-14 to 18).

    actions.ts              "Xem kết quả", "Tính số tiền" and "Tra cứu" (a certificate, a Player document, a
                            licence or proof): each asks the service once and opens the page that shows its
                            answer, with the answer and what was typed (`?attempt=`)
    guidance.ts             the sentences of a guidance answer, written from its data: the facts declared, the
                            basis, the floor-area band, the exemptions tested
    next-action.ts          "Việc tiếp theo" of a guidance answer: registering and applying lead to signing in
    rate-limited.ts         VERIFICATION_RATE_LIMITED's sentence with the time to retry
    layout.ts               the narrow layout per frame, and who reads a verification page
    PageError.tsx           the public error state, worded once (PUB convention 2)
    SupportPanel.tsx        the support line from the help route register
    VerificationAnswer.tsx  RECORD, ABSENT and UNABLE, as SCR-PUB-04 and SCR-PUB-05 draw them
    PlayerAnswer.tsx        the Player route's answer (SCR-PUB-06): the status word, never a certificate's
    DirectRecordVerification.tsx  SCR-PUB-07, one page for the licence and the proof routes
    verification-refusal.ts the three refusals of a verification route, with the refusing route's hint
    source-refusal.ts       SOURCE_UNAVAILABLE (not offered, or not read) and not-public, for SCR-PUB-08 and 09
    help-items.ts           a help route as a line of SCR-PUB-12 or 13
    track-length.ts         a track's length as minutes and seconds
    console.ts              the console screens' catalogue, refusal sentences, instants, a version's state, what the
                            reader's roles allow, and the attempt a console form keeps for its page
    console-actions.ts      the console's acts: draft, save, submit, withdraw, decide a version; add, edit, confirm,
                            retire a help route; each redirects to the page that shows its answer (`?attempt=`)
    VersionEditor.tsx       SCR-PUB-15's editor, for a new version and for one that exists
    VersionDecision.tsx     SCR-PUB-16's decision: the plain-language review, the reason, Approve and Return confirmed
    ActConfirm.tsx          an act confirmed in a dialog with the reason it needs (Withdraw), in a form of its own
    SubmitAs.tsx            one of two acts a single form carries (Lưu, Gửi duyệt)
    RouteRegisterTable.tsx  SCR-PUB-18's register with its row acts: Confirm at once, Edit beside it, Retire confirmed
