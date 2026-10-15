# cancel

    page.tsx   SCR-CAT-24  Cancel a submission

Review views: populated, confirm, processing-began, refused, loading, error (all of SUB-2026-09-30-0268; the
populated and confirm views type the board's sample reason). Live: while RECEIVED, the reason (1 to 500
characters) and Cancel, which waits for a reason with FIELD_MISSING's words and asks before it cancels; confirmed,
SCR-CAT-05 reads the submission back cancelled under its kept reference. Once processing has begun the form is
replaced by the board's refusal and the way to the outcomes; the page reads the state again every 15 seconds
while the form is open, so the switch happens in place. A cancelled submission has nothing left to cancel and
opens SCR-CAT-05.
