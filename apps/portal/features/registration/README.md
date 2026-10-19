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

The operations console's registration screens (`app/(ops)/ops/registration`, `app/(ops)/ops/reports/registration`,
SCR-REG-09 to 18):

    review-actions.ts         the officer's and the approver's acts: correct a fact, start and send an amendment,
                              request evidence, record a claim outcome, propose a decision, approve or return it,
                              record a withdrawal
    console-copy.ts           the console's translator (`regops`), its codes, documents, facts and refusals in words
    ConsoleFailure.tsx        a read that failed: a refusal in the family's words, or our error with its trace
    ConfirmSubmit.tsx         an act confirmed in a dialog that names it, then sent with its form
    ShortcutButton.tsx        a button whose Alt shortcut is drawn once the page has hydrated
    QueueFilter.tsx           SCR-REG-09's filters, each a field of the request
    CorrectionPanel.tsx       SCR-REG-10's Correct a fact, opened under the facts
    AmendmentFields.tsx       SCR-REG-10's Start an amendment: the officer's cause, the appeal case, the first day
    EvidenceRequestFields.tsx SCR-REG-11's items and Request {n} items
    ClaimOutcomeFields.tsx    SCR-REG-12's outcome, reason, scope and effect
    ProposalFields.tsx        SCR-REG-13's outcome, statement and the act it calls for
    VerdictFields.tsx         SCR-REG-14's note, Approve and Return with the note
    WithdrawalFields.tsx      SCR-REG-15's instruction and Record the withdrawal
    reporting.ts              the reporting surface's link tabs, by the reader's roles

