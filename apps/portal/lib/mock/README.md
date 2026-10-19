# mock

    backend/   the mock backend: one world of state per browser, accounts, references, the clock; one module per family

The sample data of the design canvas, word for word, in two roles: the seed each family's backend
(`backend/<family>.ts`) starts every browser's world from, and the states a reviewer draws with `?view=`, so a
screen shows what was designed and reviewed. Invented people, premises and references; nothing here is a
real record, and every page says so at its foot.

One module per family. A review state is the same `LoadOutcome` the API seam will answer: data, a governed
empty, or a failure with its code - never an empty result standing in for a failure.

    session.ts          the canvas's people: the premises principal, the organisation they act for, the inspector, the artist
    public.ts           the public pages: scope, indicative amount, verification of a certificate, a Player
                        document, a licence or proof; artist and track pages, legal documents, tariff and
                        disclosures, help routes, the Player guide (SCR-PUB-01 to 13); the nine public documents and
                        every version of them, the currency watches and the help route register the policy and
                        operations consoles keep (SCR-PUB-14 to 18)
    identity.ts         the RightOne ID stand-ins: sign in, register, confirm, organisation (SCR-RID)
    registration.ts     applications and obligation decisions (SCR-REG)
    registration-review.ts  the console's part of them: the queue's other parties, case files, TAR's answers,
                        the reports, the policy and the use-start dates (SCR-REG-09 to 18)
    finance.ts          payment, payment position, invoices; held amounts, corrections, refunds, write-offs and
                        outstanding amounts on the console (SCR-FIN)
    tariff.ts           the version and content a fee is worked out under, the canvas's review calculation and the
                        change-report period; no board draws a tariff screen (SCR-TAR-08, 09, 12 to 14)
    cases.ts            the case-intake matrix and the registers the intake form and the case console read; no case
                        is seeded, and no board draws a case screen (SCR-CAS)
    notices.ts          notice classes, the contact register, approved templates and the delivery outcomes the
                        other families' events produce; no board draws a notice screen (SCR-COM)
    status-records.ts   status records and their printout (SCR-CER)
    inspection.ts       the inspector's field client and console (SCR-VER)
    governance.ts       a rights organisation's mandate and participation terms (SCR-GOV-14, 15)
    participation.ts    its participation application, scope and amendments, objections (SCR-CAT-01..03, 25)
    submissions.ts      its record submissions and claims (SCR-CAT-04, 05, 07, 24)
    parties.ts          the party register: parties, persons, premises relationships, authorities to act, reviews, and
                        what the business-registration source holds (SCR-PTY-01..05, 11..13, 19)
    premises.ts         the premises register joined to the premises the other families name (`PREMISES_IDS`, their ids
                        for each PRM- record): entries, provenance and overrides, changes, history, reconciliation
                        runs, exceptions, dispositions (SCR-PTY-06..10, 14..16)
    authorisation.ts    verifying an authority to collect for a premises (SCR-PTY-17, 18)
    venue.ts            RightOne Player: services, playlists, schedules, devices, pairing (SCR-VEN-01..11, SCR-PLR-04..06,
                        SCR-IAM-06); the console's register, enforcement policy and actions, and shared moods (SCR-VEN-12..18)
    player.ts           the Player device on the consoles and in public: the estate, certification register,
                        assurance policy, evidence batches, playback decisions, offline policy, device credentials
                        (SCR-PLR-01..03, 07, 10, 11, 13, 15, 19, SCR-IAM-07, 08)
    oversight.ts        the public routes' outcome counts the PUB board draws, as a world's first tallies (SCR-PUB-19, 20)
    data-governance.ts  provenance of the DAT board's values, the geography policy and its preview scopes (SCR-DAT-04, 16)
    artist-geography.ts where the artist's works were played, by province, ward and month, that DAT's artist-facing
                        geography read answers from; the disclosure bases (none: DEC-23 is open)
    continuity.ts       availability periods, the serving-location record of 30 September 2026, route dependencies (SCR-SVC-13, 14)
    translations.ts     the languages a translation may be recorded in; no translation is seeded (SCR-SVC-21)
    engagement.ts       what ENG's migrations load: award rule version 1, disclosure version 1, the two metric definitions;
                        the parties that take part, the premises principal and the artist, with their display profiles
                        (SCR-ENG-01..13); no board draws them

Without `?view=`, a page reads the browser's live world from the backend: the reference in the address
selects the record, and a reference the world does not hold is not found. One premises' data never
appears under another's reference.
