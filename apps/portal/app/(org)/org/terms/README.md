# terms

    page.tsx   SCR-GOV-15  Participation terms

The page reads the session's organisation's terms from the mock backend (`lib/mock/backend/governance.ts`):
not recorded (the board's empty-not-recorded: the date and Record the terms), or recorded (the positive
banner, when they take effect and when they were recorded). Record the terms asks for confirmation with the
date chosen and the retained right restated, then sends `POST /participation-terms`; the page then reads the
terms as recorded. The retained direct-licensing right is the page's heading, a statement and never a control.

Seed: no organisation has terms recorded (the canvas draws them recorded only as a review state, and no rule
makes Lam Hồng's catalogue participation imply them). The current version is 3, from 1 July 2026.

Review views (`?view=`): empty-not-recorded, confirm, recorded, superseded, loading, error, with the canvas's
data (Hạc Bạch, 1 October 2026); their form sends nothing.

Refusals: `FIELD_MISSING` under the date; `TERMS_VERSION_SUPERSEDED` as the board's superseded banner with its
code; `RIGHT_CANNOT_BE_WAIVED` and `RANGE_OVERLAP` (terms already in effect, a second recording) as a banner with
the code. The form always sends the right as retained, so a waiver cannot be sent from here.

"Back to our mandate" leads to SCR-GOV-14.
