# inspection

What the inspector's pages (`app/(inspector)`) share, and the interaction a server page cannot express.

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

R1 draws an Alt shortcut the platform's way ("⌥R" on Apple devices, "Alt+R" elsewhere), which the server
cannot know, so a Button with one would not hydrate cleanly; `ShortcutButton` sets the shortcut once the page
has hydrated.
