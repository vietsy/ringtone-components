# [code]

    page.tsx    SCR-PUB-06  Player service verification

Opened by the QR code of a RightOne Player verification document, or from SCR-PUB-04 with "Player" chosen and the
code typed. The page names the record type and says first that it is not the premises certificate; the answer
never uses the certificate's words or seal.

The code is `ALG-234`'s printed token: the document's 26-character public reference, a dot, the key identifier and
a 16-character tag (`printedCodeOf` in `lib/mock/backend/public.ts`, a fixed mock link key). The read is
`verifyServiceEntitlement`, counted against the requester's volume like the certificate route: an empty code, a
list or a wildcard is ENUMERATION_NOT_PERMITTED, too many lookups VERIFICATION_RATE_LIMITED, a code not of the
printed form (a certificate reference included) IDENTIFIER_NOT_ACCEPTED with the Player route's hint. Otherwise
VEN is asked, in this browser's world (`entitlementForDocument`, appended to `lib/mock/backend/venue.ts`): the
service of the document while it is the service's current one, with its status now and the minimum profile
(premises name, business type, locality, entitlement reference); any other code is "no entitlement matches this
printed code", neutral, and counts as an absence. Pasteur's seeded document K3VQ7M2XRDZ5PWN4TB6HCJYLAE prints
`K3VQ7M2XRDZ5PWN4TB6HCJYLAE.K27WWIN63MR7MXFIS` and answers "Dịch vụ RightOne Player đang hoạt động"; a document
the premises portal issues later answers the same way, and the one it replaced no longer does.

"Tra cứu mã khác" opens SCR-PUB-04 for a Player code; "Đề nghị đính chính" opens SCR-PUB-12 with the way back
here, and is not offered to an inspector, who is not admitted to the help journey.

`?view=` shows any view the canvas drew: absent (P1's, the default), unable, record, record-suspended, checking,
identifier-not-accepted, rate-limited, error; `?reader=inspector` draws the inspector's page.

Deviations: the business type is not in the mock VEN's seed, so it is read from the premises' trade names
(`PLAYER_BUSINESS_TYPES`), and every Then Cửa premises is in Ho Chi Minh City. UNABLE is reached only as
`?view=unable`: the mock VEN always answers. The board's record view names Lê Thánh Tôn under RPS-W5LQ3ZK7NA;
the VEN seed gives that code to Nguyễn Huệ, and the live answer follows the VEN seed.
