# notices

What the notice screens need beyond links: the premises' side (`app/(premises)/notices`, SCR-COM-10 and 12) and the
notice console (`app/(ops)/ops/notices`, SCR-COM-01 to 04, 06 with 07, 08, 09, 13, 15, 16).

    actions.ts            Save on SCR-COM-12: a suppression recorded or released per class whose choice changed
    copy.ts               the family's translator, the reader, a notice's six elements from the template version
                          it was composed from, and a template body previewed the same way
    PreferenceForm.tsx    the classes' switches, required ones fixed with their sentence, and Save once one changed
    SaveButton.tsx        Save, working while the form's action runs and unavailable with its reason
    console.ts            the console's tabs and who opens each, each state's words and family, dates in words
    console-actions.ts    the console's acts: prepare a version, add a class, send, approve or withdraw, prepare and
                          approve a template, record a service, reissue or withdraw a notice, record a track change
                          and issue a run's outstanding notices
    NoticeFrame.tsx       a console page's frame (rail, header, tabs) and a read that did not answer
    ActButton.tsx         a console form's submit, working while its action runs
    ConfirmAct.tsx        an act confirmed in a dialog first, sending the page's form by its id
    ClassForm.tsx         Add a class: the register's facts filled in, both designations left unset until chosen

A notice's wording is the approved template version of its class in force when it was composed, kept with the
notice and filled with the values the event recorded: a family raising a notice passes the values its class's
template names, and a notice missing one waits DUE with NOTICE_ELEMENT_MISSING. The catalogue's
`com.tpl.<class>.*` is only the text version 1 was seeded from (`lib/mock/notices.ts`); a value given as a code is
worded by `com.value.<name>.<code>`, whose words may name another value (a fallback to the default playlist names
`{instead}`, the playlist that played), and a notice missing that value waits the same way. A schedule's period
recorded as `2026-09-25 18:00-22:00` reads as its hours and its day (`com.slot`).
