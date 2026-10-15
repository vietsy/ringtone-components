# scan

    page.tsx   SCR-VER-01  Scan and verify

Live, the page reads the phone's keys and results from the session. Verify sends the typed reference to
`verifyReference`: an IRC- reference opens SCR-VER-06, a VRA- reference that stored answer on SCR-VER-02, and any
other is verified (`POST /verifications`) and its new answer, with a new VRA- reference, opens on SCR-VER-02. The
type comes from the prefix (R1-CER- public, CRP- printout, otherwise premises) or the Identifier type override;
a reference not in its type's form is answered INVALID_INPUT with the expected format, one the register does not
hold NO_RECORD, a premises reference outside the jurisdiction acted for NO_PREMISES_IN_JURISDICTION. A refusal of
the act itself (APPOINTMENT_REQUIRED, INSPECTION_NOT_FOUND) comes back in the page header with the reference typed.
Opened from SCR-VER-04's Verify the record, the page carries that inspection (a hidden field) and the answer is
attached to it.

Refresh keys refreshes them (the strip's date moves to 7 days on). Upload now uploads the waiting result
(`POST /verifications/offline-results`); Discard, after its dialog, deletes a result that could not be uploaded
from the phone. Open on an uploaded row opens that answer on SCR-VER-02.

Review views: online, offline, keys-expiring, no-keys, keys-unavailable, checking, camera-denied, record-offline,
row-refused, no-appointment, appointment-required, suspended, discard-confirm, not-authorised, loading, error.

What the mock cannot do: there is no camera in the web stand-in, so the scan view is drawn as the board draws it
(scanning) and a reference is typed. The printouts the canvas shows waiting on the phone (CRP-7QX2M4KD9A) belong to
no record the canvas draws, so their upload is answered as the API answers when CER cannot read the record:
CERTIFICATE_READ_UNAVAILABLE, the result stays waiting with the reason on its row. The two uploaded rows of the seed
(VRA-8MQ2TK5WXD, VRA-3WT8KQ2M5N) carry no answer the canvas draws, so opening one answers ANSWER_NOT_FOUND, as the
board's row-refused view draws for one of them. Uploads do not start by themselves.
