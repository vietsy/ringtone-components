# inspection

What the inspection family's pages share - the inspector's (`app/(inspector)`), the operations and oversight
consoles' (`app/(ops)/ops/inspection-*`, `app/(ops)/oversight/inspections`) and the premises' records
(`app/(premises)/inspection-records`, `reconsideration-requests`) - and the interaction a server page cannot express.

    actions.ts                the inspector's acts as server actions: each calls its seam and moves on, or
                              comes back to its screen with what was sent and the refusal (`keepForPage`)
    words.ts                  refusal sentences split as a Banner splits them, counts, dates, joins (server-safe)
    FieldFrame.tsx            the field client's frame and the failure that replaces a field screen
    ConsoleFrame.tsx          the inspection console's frame and the failure that replaces a console page
    ActingForChoice.tsx       SCR-VER-17 Acting for: choosing is the act
    ReferenceForm.tsx         a reference typed and sent: SCR-VER-17's record, SCR-VER-01's reference
    RowActTable.tsx           rows that each send one act: SCR-VER-01 Upload now, SCR-VER-04 Attach
    DiscardableResults.tsx    SCR-VER-01's results that could not upload, each discarded after a dialog
    IntentButtons.tsx         several buttons sending one form, each naming its act: SCR-VER-03
    ObservedFields.tsx        SCR-VER-03's time, with the reason for late recording once it is due
    ConfirmButton.tsx         an act confirmed in a dialog first: Sign out, Abandon
    IssueRecordButton.tsx     SCR-VER-05 Issue the record, naming what the form holds before it is sent
    OutcomeFields.tsx         SCR-VER-05's outcome and the fields it asks for
    FollowUpFields.tsx        SCR-VER-05's follow-up, with its date for every follow-up but none
    PrintButton.tsx           SCR-VER-06 Print a copy
    SupplyList.tsx            SCR-VER-07's supplies with their kind and state filters
    EntryList.tsx             SCR-VER-08's entries with their filters, the entry in focus, and Copy
    CopyButton.tsx            SCR-VER-08 Copy the premises reference
    ShortcutButton.tsx        an R1 Button whose Alt shortcut is bound after hydration
    standing-actions.ts       the operations console's acts on designations and appointments (SCR-VER-09 to 12)
    record-actions.ts         the request to reconsider (SCR-VER-14), Close the inspection (18), the correction (15)
    standing.ts               the words of a standing, the tabs, refusals naming a date or a case (server-safe)
    StandingForms.tsx         SCR-VER-09 Record a designation, SCR-VER-11 Record an appointment
    DecisionForm.tsx          SCR-VER-10 and 12 Record the decision, an approval confirmed first
    RowDialogTable.tsx        rows whose acts are links or are confirmed in a dialog asking a date or a reason
    PremisesRecords.tsx       SCR-VER-13, a premises' records and the one opened, for both of its addresses
    Filters.tsx               SCR-VER-13's premises, SCR-VER-18's flag and reference, SCR-VER-16's month and authority
    CorrectionForm.tsx        SCR-VER-15's corrected content: the case, the outcome, finding rows, follow-up, reason

R1 draws an Alt shortcut the platform's way ("⌥R" on Apple devices, "Alt+R" elsewhere), which the server
cannot know, so a Button with one would not hydrate cleanly; `ShortcutButton` sets the shortcut once the page
has hydrated.
