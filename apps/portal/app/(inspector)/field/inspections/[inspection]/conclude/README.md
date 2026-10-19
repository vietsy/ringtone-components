# conclude

    page.tsx   SCR-VER-05  Conclude the inspection

Live, the page reads the inspection the reference names and opens the form empty, except a delay reason given
when it was opened (DR-742 keeps it) and, for Quán Nướng Hẻm 214's inspection of the seed, the conclusion the
canvas draws being entered. Issue the record asks first, naming the outcome, the route of a referral and the
follow-up as the form holds them at that moment (`features/inspection/IssueRecordButton.tsx`), then sends the form
to `issueRecord` (`POST /inspections/{id}/conclusions`). Issued, the record (a new IRC- reference, version 1,
delivery pending and due 5 days after issue, CFG-774) opens on SCR-VER-06 and the inspection is concluded. Refused,
the form comes back as sent with the refusal where design/03 places it: OUTCOME_NOT_SUPPORTED (compliant with no
attached answer showing a record in force), RECORD_NOT_CURRENT_AT_INSPECTION, OUTCOME_CONTRADICTS_FINDING and
PENALTY_ROUTE_NOT_IN_FORCE beside the outcome; GUIDANCE_MISSING, REFERRAL_NOTE_MISSING,
REPRESENTATIVE_ROLE_MISSING, DELAY_REASON_REQUIRED and FOLLOW_UP_DATE_INVALID beside their fields;
CASE_INTAKE_UNAVAILABLE in the header with Retry. An inspection that has ended says INSPECTION_NOT_OPEN with its
record. Back opens SCR-VER-04.

Review views: penalty-refused, guidance, outcome-not-supported, not-current, contradicts, guidance-missing,
representative-missing, follow-up-invalid, delay-missing, offline-waiting, confirm-offline-waiting, no-network,
not-open, case-intake-unavailable, certificate-unavailable, premises-unavailable, no-appointment, not-found,
confirm, not-authorised, error. There is no loading view: the screen opens on what SCR-VER-04 already read. The
review fixtures select the inspection as before: ISP-5H3WQ8KM2A is the board's, ISP-2QK7TM4W8E is concluded as
IRC-7T2MW9KQ4D reads, any other reference is not found.

A referral for case follow-up, or a follow-up by case, opens its case in CAS first (`openCase`, subject
INSPECTION_REFERRAL, the premises' party the respondent), and the record carries the case's reference; the case is in
the case officers' queue (SCR-CAS). COMPLIANT reads CER's live record of the premises at the instant the inspection
took place, so a record issued after it, or revoked before it, is refused RECORD_NOT_CURRENT_AT_INSPECTION. The record
cites every attached answer with its limits (an offline one: the state printed, its instant, the keys' refresh, what was
not checked), and is raised to the premises' party through COM at its principal's address. While a result checked
offline for the inspection waits on the phone, the page says so (offlineResultWaiting).

What the mock cannot do: CAS never fails to take a case and CER never fails to answer, so CASE_INTAKE_UNAVAILABLE and
CERTIFICATE_READ_UNAVAILABLE are drawn only in their review views.

Deviations: the follow-up date shows for every follow-up but none (the contract requires `follow_up_by` unless
NONE); the board draws it with its re-visit. A field the chosen outcome does not show is not sent, and keeps what
the page held for it when the form comes back refused. The board draws only a late inspection, whose header says
so; one recorded in time has no meta line. Retry under a header refusal reloads the page.
