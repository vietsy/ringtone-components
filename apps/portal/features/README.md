# features

Domain-facing code, one directory per domain: server actions, their input schemas, and the
components only that domain uses.

A feature does not import another feature's internals. If two need the same thing, it moves to
`components/` or a package.

    public/           the public pages, the policy console and the help route register (SCR-PUB)
    identity/         the RightOne ID stand-ins (SCR-RID)
    registration/     applications and decisions, and their review on the operations console (SCR-REG)
    finance/          payment, and corrections, refunds, write-offs and outstanding amounts on the console (SCR-FIN)
    tariff/           calculations, declared classifications and how a fee was calculated (SCR-TAR)
    status-records/   status records, their reviews and the signing keys (SCR-CER)
    cases/            raising and following a case, and the case console (SCR-CAS)
    notices/          a premises' notices and preferences, and the notice console (SCR-COM)
    inspection/       the inspector's field client and console (SCR-VER)
    governance/       a rights organisation's mandate and terms (SCR-GOV-14, 15)
    participation/    its participation, scope amendment and objections (SCR-CAT-01..03, 25)
    submissions/      its record submissions and claims (SCR-CAT-04, 05, 07, 24)
    parties/          parties, identification, authority to act and the premises register (SCR-PTY-01..16)
    authorisation/    verifying an authority to collect (SCR-PTY-17)
    venue/            RightOne Player for the premises, its devices and the guest view, and the entitlement and shared-mood consoles (SCR-VEN-01..18, SCR-PLR-04..06, SCR-IAM-06)
    player-ops/       the Player device on the consoles and in public, and the guest's actions (SCR-PLR-01..03, 07, 10, 11, 13, 15, 19, SCR-IAM-07, 08)
    oversight/        the oversight console's reads of the public service (SCR-PUB-19, 20)
    data-governance/  provenance classes and the geography policy (SCR-DAT-04, 16)
    continuity/       service continuity: availability and locations (SCR-SVC-13, 14)
    engagement/       loyalty and engagement: the participant's record, operations and policy (SCR-ENG-01..04, 06..13)

A server page cannot hand a function to a client component, so the interaction a link or a form cannot
express lives here as a small client component, and every act that moves a flow on is a server action that
redirects. With mock data an action writes to this browser's world in `lib/mock/backend/`, so the next screen,
and the next person to sign in on the same browser, reads what it did.
