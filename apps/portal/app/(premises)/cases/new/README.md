# new

    page.tsx   SCR-CAS-01  raise a case

A principal signed in raises as a premises principal on that group's account route (the web form that needs
the account), inside the portal, answered at their account's address unless they change it. Anyone else says
which group they are; choosing a group reloads the page with `?group=` (GET /intake-routes) and the line under
the field says whether this way needs an account. A group whose web form needs one is told to sign in or to call
the support line, which needs none, and Raise the case says why it waits. `?subject=` fills the affected record:
REG-08's appeal route says to raise a case about the decision, so a link from it can carry the decision.

Raise the case opens SCR-CAS-02 of the new case; refused, the form comes back with the refusal in the page header
(GROUP_NOT_IN_MATRIX, MATRIX_VERSION_NOT_APPROVED) or beside the field (FIELD_MISSING, PERIOD_INVALID,
REMEDY_KIND_UNKNOWN), every value as typed. A group only the prepared matrix version lists (`?group=music_teacher`)
is MATRIX_VERSION_NOT_APPROVED; a group no version lists is GROUP_NOT_IN_MATRIX.

Review views: loading, error, not-open (MATRIX_VERSION_NOT_APPROVED over the form).

- The approved matrix is version 3, as the specification's sources draw it (SCR-CAS-16, UAT-CAS-01): the public
  with this form and the support line, both without an account; the premises principal and the rights
  organisation with this form from their account and the support line without one.
- The contact field is labelled "Email hoặc số điện thoại" rather than "Liên hệ": the specification's label does
  not say what to type; the specified sentence under it is kept word for word.
- There is no mail behind the mock: the acknowledgement's message, with the case's address, is written to the
  server's log, as RightOne ID's confirmation link is.
