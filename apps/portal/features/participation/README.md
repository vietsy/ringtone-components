# participation

What the participation screens (`app/(org)/org/participation`, `app/(org)/org/objections`, SCR-CAT-01, 02, 03, 25)
need beyond links.

    actions.ts            the acts: save or submit the application, propose an amendment, lodge an answer to a
                          decision; each sends its command for the signed-in organisation and opens the next
                          screen, or the same screen with the refusal kept
    fields.ts             reading the forms, on the server and in the browser: text, repeated fields, register
                          values, a date as R1's date field sends it
    copy.ts               the family's translator, the state badge, the context line, scope rows in a sentence,
                          an amendment's line, values formatted for a sentence
    comparison.ts         the scope now and after an amendment, and its summary line
    useFormReading.ts     re-reads a form as the person fills it in, for the controls that wait on it
    ApplicationForm.tsx   SCR-CAT-01's form: contacts added and removed, a document recorded, Submit waiting
    AmendmentForm.tsx     SCR-CAT-03's form: rows to add and close, the date refused at the field, the comparison
    ObjectionForm.tsx     SCR-CAT-25's request, Lodge and its confirmation
