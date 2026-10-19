# engagement

    page.tsx                              the workspace's home: the capability, the screens the reader's roles open,
                                          and the corrections waiting for a second person
    release/page.tsx                      SCR-ENG-12  capability release: conditions, release, suspend, resume, withdraw
    qualifying-actions/page.tsx           SCR-ENG-08  record a qualifying action under the version governing its instant
    support/page.tsx                      SCR-ENG-10  participant balance for support, read with a recorded purpose
    events/[event]/page.tsx               SCR-ENG-04  one ledger event, under the officer's support read (`?read=`)
    corrections/new/page.tsx              SCR-ENG-09  propose a correction of the event selected in the support view
    corrections/[correction]/page.tsx     SCR-ENG-09  the proposed correction and its authorisation
    metrics/page.tsx                      SCR-ENG-11  metric definitions, snapshots and their reconciliation
    assurance/page.tsx                    the auditor's balance as at a past instant (GET /balance/as-at under an
                                          assurance engagement), with the audit log it is written to; no SCR of its own

The ENG family on the operations console, in the Engagement workspace ("Điểm thưởng"). No board or Figma frame draws
these screens; they are built from ENG's specification and wireframes on the console pattern. Lượng records actions
and owns the metrics (ACT-MKT-OP, ACT-REP), Trâm and Lượng read balances for support and propose corrections
(ACT-OPS), Khải releases the capability and authorises corrections (ACT-BIZ-APR), Cường reads the metrics and
reproduces a balance as at a past instant under an assurance engagement (ACT-AUD).
