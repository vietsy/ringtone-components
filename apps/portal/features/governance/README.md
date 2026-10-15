# governance

What the governance screens of the organisation portal (`app/(org)/org/mandate`, `app/(org)/org/terms`,
SCR-GOV-14 and 15) need beyond links.

    actions.ts             the acts: save the mandate draft or submit it (`POST /mandates`), record the terms
                           (`POST /participation-terms`); each opens the same screen with the new state, or with the
                           refusal kept and the values as entered
    fields.ts              reading the forms: a field as typed, a date as R1's date field sends it, the rows
    copy.ts                the family's translator, refusal sentences with their placeholders filled, file sizes,
                           the represented rights as a list
    MandateDraftForm.tsx   SCR-GOV-14's draft: rows added and removed, the evidence's name, type and size, Save
                           draft, Submit for approval and its confirmation
    TermsForm.tsx          SCR-GOV-15's date, Record the terms and its confirmation
