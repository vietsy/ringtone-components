# registration

What the registration screens (`app/(premises)/registration`, `app/(premises)/decisions`, SCR-REG-01 to 08)
need beyond links.

    actions.ts            the acts: start, renew or change from a decision, save the answers, add a document,
                          add a claim, confirm and send, withdraw, add a requested document; each sends its
                          command and opens the next screen, or the same screen with the refusal kept
    fields.ts             reading the forms: a field as typed, a date as R1's date field sends it
    copy.ts               the family's translator, the state words, missing items, values formatted for a sentence
    DraftFrame.tsx        the frame of the four draft steps (SCR-REG-03 to 06): header, stepper, body
    GatedForm.tsx         a form whose primary submit waits for its required fields, and a second submit by intent
    UploadList.tsx        documents with Add a document: the browser's file chooser, name, type and size recorded
    MissingBanner.tsx     REQUIRED_ITEMS_MISSING with the items it names (SCR-REG-05 and 06)
    PremisesFilter.tsx    SCR-REG-01's premises filter, which reloads the list for one premises
    SubmitButton.tsx      R1's Button as a form's submit, working while its server action runs
    ClaimForm.tsx         SCR-REG-04's claim form, opened in place
    AttestForm.tsx        SCR-REG-06's two confirmations and Confirm and send
    WithdrawControl.tsx   SCR-REG-07's Withdraw and its confirmation dialog
