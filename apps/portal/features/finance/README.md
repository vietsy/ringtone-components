# finance

What the payment screens (`app/(premises)/payments`, SCR-FIN-01 to 03) need beyond links.

    actions.ts              authorise payment, pay by card: each calls the seam's command and goes to the
                            screen that comes next; a repeated request goes back to SCR-FIN-01 with its refusal
    AuthorisePayment.tsx    Authorise payment and its one confirmation dialog
    ReauthoriseBanner.tsx   the expired instruction's banner and Authorise again
    SaveQrCode.tsx          saves the QR code on screen as a PNG, in the colours it is drawn in

With mock data the commands run in `lib/mock/backend/finance.ts`, which plays the bank as well: a transfer
arrives `MOCK_BANK_SETTLE_SECONDS` seconds (20 unless set) after the instruction is made, a card settles at once.
