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

Scan, as the web stand-in has it: there is no camera, so the inspector types the reference of the printout in front of
the camera and the stand-in reads the code CER printed on it - the payload, the signature and the key a camera would
read off the paper (`scanPrintout`, `scanCode`); a printout CER never made carries no code, and the page says so.
Online the code is verified (`POST /verifications` with its payload, signature and key): checked against the keys CER
publishes now, a signature that does not verify answers NOT_AUTHENTICATED, a reference that is not the one the code
signs is refused PAYLOAD_REFERENCE_MISMATCH. With Check offline ticked the phone checks the code against the keys it
holds (`ALG-711`): keys older than 7 days or none for the code's key give UNABLE_TO_VERIFY, an altered code
NOT_AUTHENTICATED, an authentic one LIMITED_OFFLINE; the offline answer opens on SCR-VER-02 by the key the phone gave
it, and the result waits to upload. Checked from SCR-VER-04, it waits as that inspection's evidence.

Refresh keys reads CER's key set (`GET /verification-keys`): retired keys stay, a key revoked on SCR-CER-10 leaves the
set, the strip's date moves to 7 days on; with no key published it is refused KEYS_UNAVAILABLE beside the keys, which
the phone keeps with their earlier instant. Upload now uploads the waiting result (`POST /verifications/offline-results`):
RightOne checks the code again against the keys published now and reads CER's record as at the code's issue, so a key
revoked since makes it NOT_AUTHENTICATED whatever the phone said, and the row says RightOne's result differs. Refused
as an inspection's evidence (INSPECTION_NOT_FOUND, ANSWER_NOT_FOR_PREMISES, ANSWER_OUTSIDE_INSPECTION_WINDOW, a DR-740
refusal now), it is uploaded again without the inspection and the Uploaded row says why it is not attached;
PAYLOAD_UNREADABLE, PAYLOAD_REFERENCE_MISMATCH, DEVICE_TIME_IN_FUTURE and a DR-740 refusal at the check instant move it
to Could not upload; KEYS_UNAVAILABLE and CERTIFICATE_READ_UNAVAILABLE leave it waiting with the reason on its row.
A result is uploaded under the key the phone gave it when it checked the code, so one sent again after a lost answer
is stored once and answers the answer already stored (EXC-VER-06). Discard, after its dialog, deletes a result that
could not be uploaded from the phone. Open on an uploaded row opens
that answer on SCR-VER-02.

Review views: online, offline, keys-expiring, no-keys, keys-unavailable, checking, camera-denied, record-offline,
row-refused, no-appointment, appointment-required, suspended, discard-confirm, not-authorised, loading, error.

What the mock cannot do: the camera view is drawn as the board draws it (scanning) beside the stand-in. The result the
canvas shows waiting on the phone (CRP-7QX2M4KD9A) is drawn without the code it was checked from, so its upload is
refused PAYLOAD_UNREADABLE and it moves to Could not upload. The two uploaded rows of the seed (VRA-8MQ2TK5WXD,
VRA-3WT8KQ2M5N) carry no answer the canvas draws, so opening one answers ANSWER_NOT_FOUND, as the board's row-refused
view draws for one of them. Uploads do not start by themselves. The phone is always online in the stand-in.
