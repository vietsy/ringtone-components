# authorities

    page.tsx                     SCR-PTY-11  authorities of the party the principal acts for
    new/page.tsx                 SCR-PTY-12  grant an authority
    [authority]/page.tsx         SCR-PTY-13  authority detail and revocation
    [authority]/amend/page.tsx   SCR-PTY-12  amend an authority from a date

Who may act for the party, opened from the portfolio (SCR-PTY-19), and the principal's grants, amendments and
revocations (`requirePartyPrincipal`: the party's principal alone; a delegate is sent to their portfolio). An authority's state is worked out when it
is read, so it starts and ends on its dates with nobody acting. `?party=<record>` asks for another party, which is
NOT_YOUR_PARTY. The security admin reads the same authorities on the security console (`app/(ops)/security/authorities`).
