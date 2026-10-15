# [inspection]

    page.tsx            SCR-VER-04  Inspection in progress
    conclude/page.tsx   SCR-VER-05  Conclude the inspection

Live, the page reads the inspection the reference names, or INSPECTION_NOT_FOUND with Home: the answers attached,
the answers uploaded about the premises under the same appointment and not attached, and the findings, each added
as it is recorded. Verify the record opens SCR-VER-01 with this inspection named, so the answer attaches to it;
Attach attaches an uploaded answer (or says on the row why it cannot); Add a finding records it (`addFinding`), or
comes back with NOTE_REQUIRED beside the note; Conclude opens SCR-VER-05; Abandon (only while nothing is attached
or found, DR-748) asks for a reason in its dialog and closes the inspection without a record, back to SCR-VER-17.
An inspection concluded or abandoned says it has ended, with its record where one was issued.

Review views: populated, empty, waiting-offline, offline, note-required, row-refused, last-day, not-open,
not-found, no-appointment, suspended, policy-unavailable, abandon-confirm, abandon-reason-missing,
not-authorised, loading, error.

Deviations: the "Nothing recorded yet" empty state shows whenever nothing is recorded, so the abandon views draw it
behind their dialog. The canvas does not draw what the seeded inspections at Quán Nướng Hẻm 214 and Áp Mái Bar –
Thảo Điền were for, so their header says only when they took place (`ver04.metaNoPurpose`). An abandoned
inspection's status reads "Closed without a record" (design/03 section 5c), a state the board does not draw. An
attached answer whose record was suspended, or about a premises with no record in force, says so on its row
(`ver02.suspended`, `ver04.noCurrent`). Retry under the policy refusal reloads the page.
