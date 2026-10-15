# amend

    page.tsx    SCR-CAT-03  scope amendment: rows to add and to close, the effective date, the scope now and after

Views: populated, draft, past-date, confirm, loading, error, refused (AMENDMENT_NOT_PENDING); readers:
organisation, legal (`?reader=legal`; confirm always draws the legal reader). Review draws Lam Hồng's
AMD-2026-0044 as the board does. Without `?view=` the page is a new amendment of the signed-in organisation's
active participation; without one active it goes back to SCR-CAT-02, where the control says why.

- Submit for approval sends POST /participations/{id}/scope-amendments: accepted, SCR-CAT-02 lists the amendment
  awaiting approval and no scope row changes; refused, the form comes back with the rows, closings and date as
  entered and the refusal under its field (EFFECTIVE_FROM_IN_PAST, FIELD_MISSING).
- The date refuses a day that is not after today at the field, with the full two-sentence message, before the
  service refuses it again. Submit waits for such a date ("Choose an effective date after today to submit.") and
  for one change at least ("Add a scope row or choose one to close to submit.", new copy).
- The comparison follows what is chosen; with nothing chosen it says nothing changes (R1's own words) and draws
  no table. "N scope rows change: ..." is new copy for more than one row. A refused date leaves the after
  column's date unwritten.
- Addition rows start unchosen ("Choose", new copy), and every row can be removed: an amendment may only close
  rows. The proposer is the signed-in administrator; a new amendment carries no time until it is sent.
- The approver's Approve and its confirmation are drawn for review only and do nothing: the approvals surface
  is not built, so nothing is ever approved here (SEC-13 also refuses the proposer).
- The board's own submitted amendment is reached only by review: `routes.orgAmendScope()` takes no reference,
  so SCR-CAT-02 cannot open a pending amendment here (asked of the lead).
