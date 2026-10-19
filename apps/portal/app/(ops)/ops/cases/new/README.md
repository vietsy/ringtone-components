# new

    page.tsx   SCR-CAS-01  raise a case, as the support-line agent records one for a caller

SCR-CAS-01's other entry point, the support line agent's console (ACT-SUP). The caller says which group they are;
choosing a group reloads the page with `?group=` and the case goes in on that group's support line, which needs no
account. The matter is the caller's words and the contact is the one they give: the case is recorded RECEIVED with
the caller as its raiser and the agent beside them, both identities stored, and the acknowledgement (NTF-CAS-01)
goes to that contact through COM, never only to this screen.

Record the case opens the same page again with the reference to read back to the caller and a link to the case on
SCR-CAS-04; refused, the form comes back with the refusal in the page header (GROUP_NOT_IN_MATRIX,
MATRIX_VERSION_NOT_APPROVED) or beside the field (FIELD_MISSING, PERIOD_INVALID, REMEDY_KIND_UNKNOWN), every value as
typed. The case queue (SCR-CAS-03) offers the page to anyone holding ACT-SUP.

Review views: loading, error.
