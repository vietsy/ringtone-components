# records

    page.tsx                   SCR-VER-18  Inspections and records of the authority
    [record]/correct/page.tsx  SCR-VER-15  Correct a record

SCR-VER-18 lists what the authority must act on, oldest flag first, over every appointment of the inspector that
passes DR-740 rows 1 to 3: a record not delivered by its due date, one a decided case requires corrected, an open
inspection past the recording interval or whose inspector is no longer appointed, a follow-up overdue. The flag
filter and the record reference are the page's address (`?flag=`, `?record=`); a record opens beside the list,
whole for the issuing authority; to an inspector of another authority it is the confirmation, which says the record
is under challenge and nothing of the case (FR-VER-027). Close the inspection (INSPECTOR_NO_LONGER_APPOINTED) is confirmed in a dialog. The rows
come 20 to a page (`?cursor=`, Next page); a cursor the page did not issue reads the first page again, with the flag
kept, and says CURSOR_INVALID. A record not delivered is flagged once the delivery sweep found its period passed
(UNDELIVERED, EXC-VER-03); a late handover keeps the instant it became undelivered.
