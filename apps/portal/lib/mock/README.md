# mock

    backend/   the mock backend: per-session state, accounts, references, the clock; one module per family

The sample data of the design canvas, word for word, in two roles: the seed each family's backend
(`backend/<family>.ts`) starts every session from, and the states a reviewer draws with `?view=`, so a
screen shows what was designed and reviewed. Invented people, premises and references; nothing here is a
real record, and every page says so at its foot.

One module per family. A review state is the same `LoadOutcome` the API seam will answer: data, a governed
empty, or a failure with its code - never an empty result standing in for a failure.

    session.ts          the canvas's people: the premises principal, the organisation they act for, the inspector
    public.ts           the public pages: scope, indicative amount, verification (SCR-PUB)
    identity.ts         the RightOne ID stand-ins: sign in, register, confirm, organisation (SCR-RID)
    registration.ts     applications and obligation decisions (SCR-REG)
    finance.ts          payment, payment position, invoices (SCR-FIN)
    status-records.ts   status records and their printout (SCR-CER)
    inspection.ts       the inspector's field client and console (SCR-VER)
    governance.ts       a rights organisation's mandate and participation terms (SCR-GOV-14, 15)
    participation.ts    its participation application, scope and amendments, objections (SCR-CAT-01..03, 25)
    submissions.ts      its record submissions and claims (SCR-CAT-04, 05, 07, 24)
    authorisation.ts    verifying an authority to collect for a premises (SCR-PTY-17, 18)

Without `?view=`, a page reads the session's live state from the backend: the reference in the address
selects the record, and a reference the session does not hold is not found. One premises' data never
appears under another's reference.
