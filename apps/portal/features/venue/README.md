# venue

What the RightOne Player screens need beyond links: the premises portal's (SCR-VEN-01 to 11, SCR-PLR-04 to 06,
SCR-IAM-06) and the consoles' (SCR-VEN-12 to 18).

    actions.ts             the acts: enrol, accept the terms, issue and download a document, set the default,
                           archive, save a playlist, search tracks, add and withdraw a schedule, show a week, end the
                           service, issue and revoke a pairing code; each opens the next screen, or the same with the
                           refusal kept
    copy.ts                the three catalogues' translators, the state words and families, refusal sentences
                           split for a Banner, period outcomes, days, credits, values formatted for a sentence, a
                           device's condition and, when nothing reaches it, why
    fields.ts              reading the forms: a field as typed, a date and a time as R1's fields send them
    Frame.tsx              the portal around a Player page, the error state, a refusal in the body or as a banner
    ListPager.tsx          a list's pages (convention 11): R1's pager with the next and previous page and the start, or
                           a refused cursor (CURSOR_INVALID) with the way back to the first page
    SubmitButton.tsx       R1's Button as a form's submit, working while its action runs
    EnrolForm.tsx          SCR-VEN-01's premises and Enrol, the answer in the result panel
    TermsForm.tsx          SCR-VEN-02's attestation and Accept and start the service
    DocumentActions.tsx    SCR-VEN-05's format, Download and Issue a new document
    PrintButton.tsx        the browser's print of a document
    PlaylistTable.tsx      SCR-VEN-06's list: Set as default, Archive and its confirmation
    StatusFilter.tsx       SCR-VEN-06's filter by state
    PlaylistEditorForm.tsx SCR-VEN-07's editor: items, search, moods, Save, the leave confirmation
    ScheduleTable.tsx      SCR-VEN-08's schedules and Withdraw with its confirmation
    PeriodsByDay.tsx       SCR-VEN-08's periods of a chosen day
    EndServiceForm.tsx     SCR-VEN-11's date, reason and End the service with its confirmation
    PairingControls.tsx    SCR-IAM-06's premises choice and Revoke with its confirmation
    Cover.tsx              R1's Artwork and PlayerAmbient, drawn once in the browser
    console-actions.ts     the consoles' acts: open a service by its code, show a week, record an enforcement action,
                           a reinstatement and a scope exit, create a mood, prepare, approve and withdraw a version
    console-copy.ts        the consoles' shared words: classes, actions, causes, mood version states, refusal sentences
    instants.ts            a date and time field's value as an instant in Vietnam time
    ConsoleFilter.tsx      SCR-VEN-12 and 17's filter, whose values are the list's address
    EnforcementForm.tsx    SCR-VEN-14's form (effective now, as recorded, or at a typed time), its conditions and
                           Record the action with its confirmation
    ReinstatementForm.tsx  SCR-VEN-15's evidence per condition and Reinstate with its confirmation
    ScopeExitForm.tsx      SCR-VEN-16's cause, Detail filtered by family, and Record with its confirmation
    MoodForm.tsx           SCR-VEN-17's new mood and SCR-VEN-18's next version: date, tracks found and ordered
    VersionActions.tsx     SCR-VEN-18's Approve and Withdraw with a reason
    ShortcutButton.tsx     SCR-VEN-13's act buttons, their Alt shortcut drawn once hydrated (R1 draws it per platform)
