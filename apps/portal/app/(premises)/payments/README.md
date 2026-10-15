# payments

    page.tsx                    SCR-FIN-03  invoices and corrective documents, where the Payments item opens
    [decision]/page.tsx         SCR-FIN-02  where the payment of one obligation decision stands
    [decision]/pay/page.tsx     SCR-FIN-01  pay an obligation decision: authorise, then the instruction

The screens of the FIN family's premises portal. Each page reads the signed-in session's finance from the
mock backend (`lib/mock/backend/finance.ts`) and draws the state the data is in; `?view=` still forces any
state the canvas drew, for review, on the canvas's sample data. A review view is drawn for the decision the
canvas drew it on; asked for under another decision's address, the page shows that decision's first drawn
view instead, so one premises' data never appears under another's reference.

The journey a session walks: Pasteur's decision `OBD-3FJW6NRA5C` (986,000 VND, its first payment taken back by
a card chargeback) starts with no instruction, so SCR-FIN-01 offers Authorise payment. Authorising makes a
payment instruction valid for seven days, as the canvas draws `INS-9RFD3KQW6T`, whose transfer content is its
own reference. There is no bank behind the mock, so the backend plays it: a bank transfer of the instruction
arrives and is reconciled `MOCK_BANK_SETTLE_SECONDS` seconds (20 unless set) after the instruction was made,
applied the next time the session's finance is read; a card payment settles at once. Either way the payment is
recorded, reconciled and invoiced in the canvas's series (`1C26TRO`, numbered on from `00000511`). Until then
SCR-FIN-01 shows the instruction to pay and SCR-FIN-02 waits for the new payment; afterwards SCR-FIN-01 hands
over to SCR-FIN-02, which shows the payment reconciled with the way to its status record, and SCR-FIN-03 lists
the new invoice first.

SCR-FIN-03: the list is the session's; one, not-settled, einvoice-unavailable, empty, loading and error are
review views. An invoice has no address of its own yet, so the list opens none.
