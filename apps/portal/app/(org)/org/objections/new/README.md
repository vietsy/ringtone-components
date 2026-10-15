# new

    page.tsx    SCR-CAT-25  objection and data-subject request

Views: populated, confirm, already-open, decided, refused (OBJECTION_UNKNOWN), loading, error, all drawn for
Bến Sậy's suspension of PTC-2026-0342 as the board does. Without `?view=` the page reads the decision
`?decision=` names among those notified to the signed-in organisation: nothing lodged, the request form; an
objection open, the board's already-open state with what was lodged and when it is due; decided, the decision
and its ground.

- Lodge waits for a kind and a ground, then asks for confirmation stating the answer's due date for the kind
  chosen (CFG-35: ten days, twenty, fifteen) and that the decision stays in force; confirmed, it sends
  POST /objections and the page reads the request back. A second lodging while one is open is refused
  (OBJECTION_ALREADY_OPEN): the already-open state carries the code. FIELD_MISSING shows under the field.
- The seed notifies no decision to any organisation: the canvas draws "No decision about this participation has
  been notified." for Lam Hồng, and nothing for Dây Đàn or Hạc Bạch. So SCR-CAT-02's entry stays unavailable and
  this page is reached live only by its address: without a decision it goes back to SCR-CAT-02; with a reference
  that names no decision notified to the organisation it draws the board's not-found state (OBJECTION_UNKNOWN),
  which says nothing of whether the reference exists for someone else.
- The confirmation's title and button for a correction or an erasure are new copy; the board draws the objection's.
- The shell's account is the signed-in administrator; the board's "Tôn Nữ Bích Vân" is Bến Sậy's.
