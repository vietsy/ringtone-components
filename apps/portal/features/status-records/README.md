# status-records

    actions.ts            every CER act: print (SCR-CER-12 and 02), assess again, approve or decline an issue,
                          propose and decide a status change, resolve a follow-up, register, retire and revoke a key
    console.tsx           the link tabs over SCR-CER-01, 04 and 07, and a failure that replaces a console page
    words.ts              statuses as words on their family's badge, written reasons, times, fees and delays
    holder.ts             the holder's state as the record's own status
    ListFilter.tsx        R1's FilterBar over a list whose filter is its address: chips and Clear open it without them
    DecisionControls.tsx  Approve (confirmed in a dialog restating what was typed) and Decline, SCR-CER-03 and 06
    ProposalFields.tsx    SCR-CER-05's act, ground, conditions, reason, evidence and effect, changing with the act
    ResolveFields.tsx     SCR-CER-08's outcome and reason, Resolve unavailable until a reason is written
    KeyTable.tsx          SCR-CER-10's keys with Retire and Revoke confirmed in the danger family
    KeyRegistration.tsx   SCR-CER-10's Register a key
    PrintedSheet.tsx      SCR-CER-13's A4 sheet, for the holder's printout and an officer's
