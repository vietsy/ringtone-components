# [reference]

    page.tsx    SCR-PUB-05  Verification result

The answer for one reference: `RECORD`, `ABSENT` or `UNABLE` (three answers, none drawn as an error),
a refusal with its code and the refusal catalogue's sentence, or the public error state. The seam,
`lib/api/verification.ts`, returns a failure without mock data and never an empty result: an empty
would tell a member of the public that no record matches their reference, a claim about a business
rather than an admission that our service is not wired up.

Opened from SCR-PUB-04, the page shows the answer that lookup gave (`?attempt=`); opened from a QR code or
a link, it looks the reference up, counted against the requester's volume (`ALG-459`'s tested defaults).
The register is seeded with every status record the canvas draws, in its state: Pasteur's
R1-CER-2026-T7QM4BWJ (active since 18 September 2026, in force to 17 September 2027, printout
CRP-4WTN8QHC2K) and the other issued records of SCR-CER-01, R1-CER-2026-Q4RT8XZW (suspended, SCR-PUB-05) and
R1-CER-2026-V8JD3MRA (suspended, SCR-VER-02). A record's reference answers the record; its current printout's
reference answers the same record and names the printout ("Bản in đã quét"); any other well-formed reference
is no record (R1-CER-2026-H8WX2DQR, as the canvas answers it); a malformed one is refused. Each answer
carries the instant of the lookup and a new answer reference (`VRA-`, VER's `ALG-718` form), and the world keeps it
as VER keeps a public answer (`SEC-741`: what it showed, the hour, the record resolved or the value presented, nobody
who asked), so the premises can quote it in a request to reconsider (SCR-VER-14) and VER reads it back
(`publicVerificationAnswer`). The record's fields are those the disclosure profile in effect admits (SCR-PUB-20);
while GOV has approved no version, the minimum of `DR-486` row 6.

`?view=` shows any view the canvas drew: unable, absent, record, record-suspended, checking,
identifier-not-accepted, rate-limited, enumeration, error; `?reader=inspector` draws the inspector's page,
as does an inspector's own session.

"Đề nghị đính chính" opens SCR-PUB-12 with the way back here; an inspector is not offered it.

Deviation: `UNABLE` is reached only as `?view=unable`: the mock's register always answers.
