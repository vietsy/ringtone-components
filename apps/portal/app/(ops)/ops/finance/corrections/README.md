# corrections

    page.tsx   SCR-FIN-10  corrections, refunds and chargebacks; `?correction=` opens one, `?form=chargeback` the
               chargeback form, `?form=refund` (with `&case=`) the refund form, `?form=send` a refund's confirmation

The list, open first, and the correction opened under it: the original event, the chargeback or the refund, the
consequences, the settlement by component and the owning service's review, with Open the review (SCR-CER-06) once
one is opened. Record a chargeback opens its form on the page; a card payment made in the world can be taken back, a
transfer is refused under Evidence. Record a correction sets a raised chargeback's consequences once; with any other
correction opened it opens the refund form: the payment, the case that decided the refund, the amount. The case is
read in CAS, and the correction names it, as does the calculation it links in TAR and the corrective document its
sending produces, so the case's remedy linkage (SCR-CAS-10) finds each from its own side. The finance approver who
did not prepare the refund approves or declines it here; the officer then sends it once, after its confirmation.
Close the correction waits while a review runs, and says so. A chargeback's payment event opens CER's review of the
status record the payment bears on (`openStatusReview`); the correction reads it (`statusReviewState`) and agrees
once CER approves the review or a terminal status supersedes it, after which it closes. A review past its 5 working
days raises the exception naming the record and the event, once. A refund under a case holds its amount in suspense
for the payer, with the ground the case relied on; while the grounds for refunds are not decided, Approve the refund
is unavailable and `FIN_GROUNDS_RESERVED` stands beside it, and Decline returns the amount to its payment. A second
payment of a fee already paid opens its own correction, raised by RightOne (FR-FIN-010): the return of the transfer,
which a finance approver approves or declines here and the officer then sends once. The return waits on no ground
(DR-359), corrects no invoice and leaves the status record standing; declined, the transfer stays held for its payer.
A card payment not settled yet can be taken back too, which cancels the invoice it waited for.
