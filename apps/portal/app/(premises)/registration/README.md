# registration

    page.tsx                              SCR-REG-01  my applications and decisions, where the Applications item opens
    new/page.tsx                          SCR-REG-02  start an application
    [application]/premises/page.tsx       SCR-REG-03  tell us about the premises
    [application]/evidence/page.tsx       SCR-REG-04  evidence and claims
    [application]/review/page.tsx         SCR-REG-05  review and explanation
    [application]/submit/page.tsx         SCR-REG-06  attest and submit
    [application]/page.tsx                SCR-REG-07  application status

The registration family on the premises portal. Every page asks for the signed-in principal first and reads
the session's own applications and decisions through `lib/api/registration.ts`; with mock data the mock backend
(`lib/mock/backend/registration.ts`) plays the API, so each act changes what the next screen shows, and every
sign-in starts again from the canvas's state. `?view=` shows a state the canvas drew instead, for review.
SCR-REG-08, the decision an application ends in, is under `app/(premises)/decisions`. Each directory's README
lists its views and every deviation.

SCR-REG-01 views: populated, empty, partial, cursor-invalid, premises-unavailable, loading, error. Without
`?view=` the two lists are the session's, newest first.

- The board's Close button is left out: it leads nowhere on the portal.
- The premises filter reloads the page with `?premises=`, which both lists send as their premises_id.
- Try again and Reload from the start open the list again from its first page. Show more stays unavailable
  with its reason: the mock has no further page.
- Every row opens SCR-REG-07 or SCR-REG-08 for its own reference; a draft's Continue opens SCR-REG-03; an
  application that ended (withdrawn, refused, closed) says Read why it ended and opens SCR-REG-07, the words the
  specification gives for those rows (the board draws none). The board names no decision behind a decided
  application; the rows pair them per premises, as the data sheet does.
