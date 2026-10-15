# submissions

What the submission and claim screens (`app/(org)/org/submissions`, `app/(org)/org/claims`, SCR-CAT-04, 05, 07,
24) need beyond links.

    actions.ts                 the acts: a part of the chosen file, submit, acknowledge, cancel; each sends its
                               command and opens the next screen, or the same screen with the refusal kept
    copy.ts                    the catalogue pair's translator; the participation line, channel names, a
                               record's reason and route, a submission's state and meta line, completeness
    fields.ts                  reading the forms: a field as typed, a date as R1's date field sends it
    sizes.ts                   a file's size as the boards write it, and filling a template in a client component
    SubmitRecordsForm.tsx      SCR-CAT-04's form: channel, format, file counted on select, Submit in parts
    OutcomeTable.tsx           SCR-CAT-05's records needing action, with the outcome filter and sort
    AcknowledgeControl.tsx     SCR-CAT-05's Acknowledge all and its confirmation
    CancelSubmissionForm.tsx   SCR-CAT-24's reason, Cancel the submission and its confirmation
    StatePoll.tsx              reads the page again while a state can change without the reader (SCR-CAT-24)
