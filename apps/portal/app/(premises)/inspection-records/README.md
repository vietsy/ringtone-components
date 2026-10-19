# inspection-records

    page.tsx                  SCR-VER-13  Inspection records of your premises (`?premises=`)
    [record]/page.tsx         SCR-VER-13  the same, with one record opened
    [record]/print/page.tsx   SCR-VER-13  Download PDF: the record version as an A4 sheet

The premises portal's Inspections section. The principal reads the records of one premises the party acts for,
newest first (the premises of the newest record by default), and opens one: its words, never its codes but the
reference, with any earlier version still readable and marked superseded. A record is the party's when PTY's register
says the party operated the premises at the instant of the inspection (`premisesRelationshipAt`, SEC-745): a visit made
before the party took the premises over is neither listed nor opened by reference. A delegate reads, prints and asks to
reconsider only the records of a premises her delegation names (PTY, DR-201); any other is RECORD_NOT_FOUND to her, and
the list of a premises outside it NOT_AUTHORISED_FOR_PREMISES. The record reads as the party
received it: the guidance, a referral with its note, what its representative said and, recorded late, the reason. A version not already under a request can
be asked to be reconsidered (SCR-VER-14). Both pages render `features/inspection/PremisesRecords.tsx`. A record
says the answers it rests on with their limits (an offline check: the state printed and when, and that the current state
was not checked) and how it reached the premises: handed over on site, or the notice COM sent reaching the principal.
