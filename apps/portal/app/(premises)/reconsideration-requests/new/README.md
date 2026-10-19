# new

    page.tsx   SCR-VER-14  Request reconsideration

Shows what the subject showed and when, asks for the grounds (and the premises where an answer names none) and sends
the request (POST /verification-challenges): CAS opens a case (`openReconsideration` in the case family's backend),
whose reference the success state says (`?sent=CAS-…`) and opens on SCR-CAS-02. The case is triaged and decided on the
case console, and SCR-VER-15 corrects the record under it once CAS says the decision requires it. Refusals are drawn
where design/03 places them; the grounds typed are kept. NOT_PARTY_TO_SUBJECT is judged by the party PTY's register
says operated the premises at the subject's instant (a record's inspection, an answer's), never by who operates it now. The case and the request both keep what the subject showed
(FR-VER-008): a record's version, outcome, findings, digest and issue instant; an answer's identifier, outcome, scope
and instant. An answer the public verification page gave (SCR-PUB-05, its VRA- reference) is a subject too, read from
where PUB keeps it, in the public field set and to the hour; one that found a record is about that record's premises,
and one that found none asks for the premises.
