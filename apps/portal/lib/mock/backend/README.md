# backend

The mock backend: what the API will hold and do, played in the server process while the portal runs on
mock data. Commands change state and later reads see the change, so the portal is walked as it will be
used: sign in, act, and the next screen shows what the act did.

    store.ts       the memory: accounts and sessions process-wide, each family's tables per world (a browser)
    accounts.ts    RightOne ID's accounts and organisations, from the canvas's data sheet
    identity.ts    RightOne ID's answers: sign-in, organisation choice, registration, confirmation
    ids.ts         new references in the canvas's form (REG-P5TJ4BXC7M, R1-CER-2026-T7QM4BWJ)
    clock.ts       the moment an act happens, and calendar arithmetic in Vietnam time
    <family>.ts    one per family: its state, seeded from the canvas data in `lib/mock/<family>.ts`, and
                   one function per command the API will offer, refusing with the spec's refusal codes
    player.ts      two families of the Player device beside `venue.ts` (VEN), each in its own tables: PLR's estate,
                   certifications, evidence, decisions and offline policy ("plr"), IAM's pairing authorisations
                   ("iam-pairing"), the credentials devices hold once paired ("iam-credentials"), and IAM's refusals,
                   audit log and notices raised ("iam-audit")

Everyone who signs in from one browser acts in one world (the `r1-world` cookie), so a principal's application is
in the staff's review queue and the staff's decision is on the principal's list; another browser has a world of its
own. Signing out keeps the world; "Đặt lại dữ liệu mẫu" at the page foot (`/id/reset`) returns it to the seed, and a
server restart forgets everything. Families read each other only through exported functions, and a family adds such a
function at the end of its own module rather than reaching into another's tables:

    registration.ts     decisionReferences, decisionForCollection, decisionFactsOf, premisesActedFor,
                        restsOnDeclaredClassification, deadlineStateAt and openFactChangeReportsAt (CAS's and
                        VER's reads of a premises' deadline state and its open reports of a changed fact)
    parties.ts          PTY's IPartyReader: authorityToActAt (DR-201: may this person act for this premises with this
                        permission at this instant), mayActFor (the same as a guard), premisesActableBy (the premises
                        the person signed in may act for), actingAs (principal or delegate), personExists (CURRENT,
                        SUPERSEDED, NEVER_EXISTED), premisesRecordOf (a family's premises id to its PRM- record),
                        recordActUnderAuthority (an act a family performed under a delegate's authority)
    premises.ts         premisesRelationshipAt (EFFECTIVE, ENDED with its cause, NONE), operatesNow (the same as a
                        guard), premisesProfileAt (each field with its provenance), registerEntries, premisesNameOf;
                        no family keeps a flag of its own for whether a premises is operated
    finance.ts          settlementOf and paymentConditionFor (CER's reads of a decision's fee), corrections and
                        invoiceList (CAS's remedy linkage reads a refund, a correction and an invoice by reference)
    status-records.ts   certificateForDecision, publishedRecord, openStatusReview, statusReviewState;
                        inspectorRecordAt, premisesRecordAt (VER's ICertificateReader: a record by its public or
                        printout reference, a premises' current record, at an instant), verificationKeysAt (the keys
                        published, retired ones included), signedCodeOf (the signed code a printout carries)
    cases.ts            openReconsideration, caseDecisionFor (VER's correction rule), caseRemedyFor (FIN's refund);
                        openCase (ICaseIntake.OpenCase: a case another module opens on a subject it holds - a
                        verification answer, an inspection record, or an inspection's follow-up referral with the
                        premises as respondent - idempotent by its key)
    notices.ts          recordNoticeEvent, the way any family raises a notice (raiseNoticeEvent answers with
                        DR-131's reason as well); noticeStateOf, a raised notice's state, due instant and delivery;
                        officeDestinationOf, the office address a notice to a gateway role (ACT-OPS, ACT-SEC, ACT-EVD)
                        is sent to, from the contact register;
                        recordTrackChange, a change CAT records to a track; reportDeliveryOutcome and
                        reportDeliveryExhausted, what the delivery treatment (OPS's CFG-43) reports of an attempt
    tariff.ts           calculateFee and indicateFee (ITariffCalculator: REG's fee, recorded or only worked out),
                        changeEffectiveOn and changeReportPeriodAt (a reported change's date, CFG-360's period),
                        recordMandateStateChange (GOV's mandate event), reconcileDeclaredClassifications (the sweep),
                        recordLinkedCalculation, a recalculation made under a correction
    inspection.ts       recordVersions, a corrected record as CAS links it; challengeSnapshotFor, what a challenge
                        copied of its subject into its case (FR-VER-008); subjectPremisesOf, the premises a record or
                        an answer is about (CAS asks PTY about a case's premises by it)
    venue.ts            servicePublicStatus (PLR stops delivery on it), entitlementForDocument (PUB-06),
                        premisesHoldingTrack (COM's track-change runs)
    player.ts           deviceCredentialState, deviceSummary, devicePremisesOf (the premises a device plays at)
    public.ts           legalDocument (VEN-02 offers the version in effect), printedCodeOf (VEN-05, PUB-06),
                        contentVersions (SVC-21 links a translation to its Vietnamese version),
                        publicVerificationAnswer (VER reads back and challenges a certificate route answer, VRA-),
                        approveDisclosureProfileVersion (GOV's approval of PUB-DISCLOSURE-PROFILE),
                        disclosureProfileAt (the profile in effect, for SCR-PUB-20)
    translations.ts     servedText (which text a page in a language other than Vietnamese may present as current)
    oversight.ts        countVerification, countAssessment, the public routes' tallies

Nothing here is a real record.
