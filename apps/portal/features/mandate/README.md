# mandate

    register/   Mandate Register: the sample cross-organisation register, filters and review states
    detail/   Mandate Detail, the APPA specimen from SCR-GOV-02

The existing organisation's own mandate form remains in `features/governance`. The register is a
separate read surface; its fixture does not authorise access to another organisation's real records.

`components/shells/GovernanceShell.tsx` shares administration navigation between register, detail and coverage, including
localised search, mock-only queue count, language switching and unavailable-screen feedback.
