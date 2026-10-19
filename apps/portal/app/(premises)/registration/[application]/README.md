# [application]

    page.tsx    SCR-REG-07  application status: state, documents asked for, dates, claims, history, withdraw

The four draft steps are the subdirectories (`premises`, `evidence`, `review`, `submit`, SCR-REG-03 to 06).
An application that is no longer a draft has no steps: each step page opens this page for it.

SCR-REG-07 views: evidence, received, automated, after-deadline, in-review, draft, decided, refused, withdrawn,
closed, withdraw-confirm, doc-invalid, request-closed, tariff-not-approved, already-final, not-found,
not-authorised, loading, error. Without `?view=` the page reads the session's application; a reference the
session does not have is not found.

With `?view=` the reference selects the application the view is drawn on, as on the finance screens: Hai Bà
Trưng's REG-W3HN6DRZ2Q, Bùi Viện's REG-D2VL7KQE3S (after-deadline), Pasteur's REG-Y6TN4JHA8D (automated,
tariff-not-approved, decided) and the Sala draft (draft, and in review once sent at the canvas's moment).

- Sent from SCR-REG-06, an application waits here in review - claim review with a claim, rulebook review
  otherwise - for an officer on the operations console (SCR-REG-09 to 14), whose acts this page then shows: the
  documents a reviewer asked for, each in the reviewer's own sentence; the decision once issued; a refusal with
  its statement; a withdrawal recorded on the applicant's instruction, named as such. Its dates
  are the canvas's rules: complete on the day it and its last document were both in, decision expected 21 days
  later, payment deadline 89 days after use began; a decision expected after that deadline says so (DR-41).
- Add a document opens the browser's file chooser and records the file's name, type and size against the item;
  no file is kept. A request past its due date refuses it EVIDENCE_REQUEST_CLOSED beside the item.
- Withdraw opens its dialog over the window; withdrawing records the withdrawal and the page shows it ended.
  The withdraw-confirm view draws the dialog open on arrival in the page, as the board's overlay does.
- An application that has ended shows no dates: no decision is expected. The canvas draws none on one.
- An application the canvas draws only as a row of SCR-REG-01 shows what the row and its decision give; a moment
  the canvas does not give is a dash in the history, and an unknown sending time leaves the Sent line out.
- A refusal's statement is the reviewer's own text, so it comes with the data in both languages.
