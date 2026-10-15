# submissions

    page.tsx                          the nav's Submissions: opens SCR-CAT-05 on one submission (G-11)
    new/page.tsx                      SCR-CAT-04  Submit records
    [submission]/page.tsx             SCR-CAT-05  Submission outcomes
    [submission]/cancel/page.tsx      SCR-CAT-24  Cancel a submission

The organisation's catalogue submissions (CAT, FR-CAT-009, 010, 020, 024, 028). Each page reads the signed-in
session's live state from the mock backend (`lib/mock/backend/submissions.ts`), seeded with the two submissions
the boards draw for Lam Hồng: SUB-2026-09-27-0731 (completed, 2,318 outcomes, seven needing action) and
SUB-2026-09-30-0268 (received, 42,760 records). Hạc Bạch and Dây Đàn have none. `?view=` still forces any state
a board drew, for review, in Lam Hồng's session only, since every fixture is Lam Hồng's.

No list of submissions is specified (G-11, Q-CMO-10), so the nav's Submissions opens one submission: the
earliest completed one not yet acknowledged (what NTF-CAT-01 sends the organisation to), otherwise the latest
received. An organisation with none reads the board's words for it ("No submission yet: the organisation does
not participate", from SCR-CAT-01's nav). An unknown reference is the contract's 404 (the app's not-found page);
another organisation's is refused NOT_YOUR_SUBMISSION, as the boards draw it.
