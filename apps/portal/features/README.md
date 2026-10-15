# features

Domain-facing code, one directory per domain: server actions, their input schemas, and the
components only that domain uses.

A feature does not import another feature's internals. If two need the same thing, it moves to
`components/` or a package.

    public/           the public pages (SCR-PUB)
    identity/         the RightOne ID stand-ins (SCR-RID)
    registration/     applications and decisions (SCR-REG)
    finance/          payment (SCR-FIN)
    status-records/   status records (SCR-CER)
    inspection/       the inspector's field client and console (SCR-VER)
    governance/       a rights organisation's mandate and terms (SCR-GOV-14, 15)
    participation/    its participation, scope amendment and objections (SCR-CAT-01..03, 25)
    submissions/      its record submissions and claims (SCR-CAT-04, 05, 07, 24)
    authorisation/    verifying an authority to collect (SCR-PTY-17)

A server page cannot hand a function to a client component, so the interaction a link or a form cannot
express lives here as a small client component, and every act that moves a flow on is a server action that
redirects. With mock data no action records anything.
