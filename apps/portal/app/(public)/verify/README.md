# verify

Certificate verification: the form (SCR-PUB-04) and the answer at the reference's own address
(SCR-PUB-05, in `[reference]/`), the address a certificate's QR code opens.

    page.tsx    SCR-PUB-04  Verify a record
    player/     SCR-PUB-06  Player service verification, under [code]
    licence/    SCR-PUB-07  Direct-licence verification, under [reference]
    proof/      SCR-PUB-07  Proof verification, under [reference]

`D-PUB-05` and `D-PUB-06` must be **unmistakable from each other**: a Player service entitlement is
never presented as the authoritative RightOne certificate, and never as proof that unrelated
statutory obligations are satisfied (FR-VEN-003).

"Tra cứu" submits to `verifyReference`, which looks the reference up once (`lookUpCertificate`, the mock
backend's `GET /verifications/certificates/{reference}`): an answer opens SCR-PUB-05 at the reference's
address with that answer; a refusal comes back here, drawn where the board draws it, with what was typed:
IDENTIFIER_NOT_ACCEPTED beside the field, ENUMERATION_NOT_PERMITTED (an empty field, a list, a wildcard) and
VERIFICATION_RATE_LIMITED, with its real retry time, above it. A reference typed in lower case is sent in
upper case. An inspector signed in reads the inspector's page (no "Về RightOne").

`page.tsx` draws every view of the canvas as `?view=`: form, checking, unable, absent,
identifier-not-accepted, rate-limited, enumeration, error; `?reader=inspector` draws the inspector's page.

Deviations: the canvas draws the answer in place under the form, and those views are kept for review, read
through the same seam as SCR-PUB-05; so their "lookup ended" or "answered at" time and the error's trace id
are SCR-PUB-05's (10:14:07, 5e2a91c07d4b8f36) rather than the form board's (10:12:40, d84a1c3e07b9f526).
Live, an answer is shown at its own address instead, so the page a QR code opens and the page a typed
reference opens are one. "Loại giấy tờ khác" chooses the kind of document the form checks (`?kind=`): the
certificate (the default), a RightOne Player document ("Mã in trên giấy", the Player route's hint) or a direct
licence or proof; for the last two "Tra cứu" submits to `verifyDocument`, which opens SCR-PUB-06 or 07 at the
answer's address, or comes back with the refusal and what was typed. A licence and a proof share the field: a
reference in a proof's form (PRF-) asks the proof route, any other the licence route. The board draws the items
as links to the answer screens; with no reference to open, they choose the form instead. "Về RightOne" and
"Trợ giúp" are the public reader's; the verification shell's one link is Liên hệ (SCR-PUB-12).
