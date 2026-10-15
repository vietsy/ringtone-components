# submit

    page.tsx    SCR-REG-06  attest and submit: the two confirmations, then the application goes to RightOne

Views: ready, unticked, sending, partial, not-confirmed, facts-changed, explanation-superseded, missing-items,
reconfirm, period-invalid, explanation-not-approved, use-start-required, exceeds-limit, rulebook-not-approved,
tariff-not-approved, processing-not-permitted. Pasteur's renewal REG-N4CT7WQA2H is drawn only as
`?view=reconfirm`. Without `?view=` the boxes are unticked each time the page opens (the specification), and
Confirm and send waits until both are ticked.

- Confirm and send (server action `sendApplication`) records the confirmation against the review SCR-REG-05
  showed, then sends: accepted, SCR-REG-07 opens with the application in review; refused, the refusal shows
  above the button with its way on, and the boxes as they were ticked. Answers changed since the review are
  refused FACTS_CHANGED_SINCE_PREVIEW; no review to rest on, EXPLANATION_SUPERSEDED.
- The board draws no loading or error view; a step that cannot be read shows the error state with its trace.
- Open the governing decision (period-invalid) opens SCR-REG-08 for OBD-2YDA7KMS5X, which the canvas does not
  draw in full: it is not found there.
