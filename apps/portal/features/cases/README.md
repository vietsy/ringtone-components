# cases

What the case screens need beyond links: the public surface's (`app/(premises)/cases`, SCR-CAS-01, 02, 08) and the
case console's (`app/(ops)/ops/cases`, SCR-CAS-01 for the support line, 03, 04, 06, 07, 09, 10, 15, 16, 18).

    actions.ts              the public surface's acts: raise, withdraw, answer a request, add an item, lodge an
                            appeal, ask for a reopening
    console-actions.ts      the console's acts, one per command; a refusal is kept for the form it fell on; a case
                            the support-line agent records for a caller (SCR-CAS-01's other entry point)
    copy.ts                 the translators, the reader, the states in words or as codes, refusals in the catalogue's words
    dates.ts                a date as R1's date field sends it
    RequiredForm.tsx        a form whose act waits for its required fields, with the reason beside it
    SubmitButton.tsx        the submit of the form around it, working while its action runs
    ConfirmSubmit.tsx       a confirmed act: the dialog names the consequence, then sends the form
    ConsoleFailure.tsx      a console read that failed: a refusal in the family's words, or our error
    QueueFilter.tsx         SCR-CAS-03's filters, each a field of the request
    IntakeRoutesEditor.tsx  SCR-CAS-16's route table, with the account-free check as it is edited
    GroupChoice.tsx         SCR-CAS-01's I am a: choosing a group reads its routes again
    WithdrawCase.tsx        SCR-CAS-02's Withdraw this case and the dialog that names the consequence
