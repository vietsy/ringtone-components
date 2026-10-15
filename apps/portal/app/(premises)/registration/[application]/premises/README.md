# premises

    page.tsx    SCR-REG-03  tell us about the premises: what the register holds, and at most five questions

Views: populated, renewal, class-unknown, all-known, saved, use-start-missing, field-invalid, derived,
rulebook-not-approved, exceeds-limit, use-start-required, unavailable, premises-unavailable,
governance-unavailable, processing-not-permitted, not-authorised, loading, error. Pasteur's renewal
REG-N4CT7WQA2H is drawn only as `?view=renewal`. Without `?view=` the page reads the session's draft.

- Next: documents and Save and leave both save the answers (server action `saveFacts`); Next opens SCR-REG-04,
  Save and leave SCR-REG-01. A refused answer (FACT_VALUE_INVALID) comes back under its field with every answer
  as typed, and nothing is saved. Save and leave is a submit here where the board draws a link, because the
  specification has it save.
- Next waits for every question, read as the person answers; the first unanswered one says why, in the board's
  words ("Answer all five questions", the date music began). With four questions it says "Answer all four
  questions" (new copy, the same sentence for four).
- What the register does not answer is not shown empty: an unknown class becomes the fifth question, an unknown
  administrative area is left out of Already known.
- Read the questions again opens the step again.
