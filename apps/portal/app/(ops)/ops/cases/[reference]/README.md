# [reference]

    page.tsx                SCR-CAS-04  case detail and triage: classify and derive, links, parties, history, next acts;
                                        refer, close as inadmissible or incomplete, classify as protected
    evidence/page.tsx       SCR-CAS-06  evidence requests: the requests, a new one, cancelling one with its reason, a
                                        response that arrived another way, the items held and one added on its own
    decision/page.tsx       SCR-CAS-07  record a decision, and the decision once issued, read-only
    remedy/page.tsx         SCR-CAS-10  remedy linkage: the artefacts the remedy requires and whether each names the case
    reopening/page.tsx      SCR-CAS-15  reopen a case: the proposal, and its authorisation by someone else

One case, by its reference. SCR-CAS-04 is the hub the others are opened from; each says why a control waits when it
does. SCR-CAS-05 (clock change), 11 (protected matter) and 13 (dispute) are not built, so their controls are left
out rather than linked to pages that do not exist - except Classify as protected, which SCR-CAS-04 records itself
(POST /protected-classification): the restriction attaches at that call, so the case is from then on readable only
by the category's access list, and the officer who classified it may lose access with the next read.

Classification leaves a case TRIAGED with its owner recorded: from there it can be referred or closed as
inadmissible, and Start investigating or a request for evidence takes it to ASSIGNED first (SM-05 transition 2).
