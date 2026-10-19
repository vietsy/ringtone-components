# finance

What the payment screens (`app/(premises)/payments`, SCR-FIN-01 to 03) and the Finance workspace of the operations
console (`app/(ops)/ops/finance`, SCR-FIN-10, 14, 15) need beyond links.

    actions.ts              authorise payment, pay by card; on the console record a chargeback, record a
                            correction, record a refund under a case, approve or decline it, send it, close a
                            correction, propose a write-off, approve or decline it. Each calls the seam's command and goes to
                            the screen that comes next; a refusal goes back where the act was
    AuthorisePayment.tsx    Authorise payment and its one confirmation dialog
    ReauthoriseBanner.tsx   the expired instruction's banner and Authorise again
    SaveQrCode.tsx          saves the QR code on screen as a PNG, in the colours it is drawn in
    ApproverDecision.tsx    the finance approver's reason, Approve (after its confirmation) and Decline: a write-off
                            on SCR-FIN-15, a refund on SCR-FIN-10
    ConfirmSend.tsx         Send the return on SCR-FIN-10 and its confirmation
    console.ts              the console's translator, value formats in sentences, and the workspace's link tabs
                            (Suspense, Corrections, Outstanding)

With mock data the commands run in `lib/mock/backend/finance.ts`, which plays the bank and the card scheme as well:
a transfer arrives `MOCK_BANK_SETTLE_SECONDS` seconds (20 unless set) after the instruction is made, a card settles
`MOCK_CARD_SETTLE_SECONDS` seconds after it is authorised (at once unless set), the e-invoice service is down while
`MOCK_EINVOICE_UNAVAILABLE` is set, a payer who pays by card had sent the transfer as well while
`MOCK_BANK_DUPLICATE_TRANSFER` is set (a second payment, held and returned), and a card payment can be taken back by a
chargeback the finance officer records.
