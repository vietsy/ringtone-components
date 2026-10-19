# appeal

    page.tsx   SCR-CAS-08  lodge an appeal, by the case's reference, with or without an account

The decision and the date it gave sit beside today's; a challenge after that date is still lodged and answered,
recorded late (DR-48 row 2). A decision is challenged once (AC-FR-CAS-008-06): while that appeal is open the page
says when it will be answered, and once it is decided it says the outcome names where to go next; a challenge no
approved period measured says it will be answered without a date (PERIOD_VERSION_NOT_APPROVED).

Where the appeal is no longer the reader's route - the decision was challenged already, or the case was closed
without one (inadmissible, incomplete) - and the case is closed, the page shows the reopening block instead, never
both: Ask for a reopening (POST /cases/{id}/reopenings by the raiser) with the new evidence, the day it came to exist
and what it would change over the outcomes the decision carried, naming nothing being an answer. Its refusals sit
beside their fields (REOPEN_GROUND_ABSENT, EVIDENCE_NOT_NEW, DISPLACEMENT_NOT_STATED, OUTCOME_NOT_ON_DECISION);
REOPEN_WINDOW_CLOSED replaces the block with the date and the support line; a proposal already waiting is said in
its place. The proposal waits on SCR-CAS-15 for an authority, as a case officer's does.
