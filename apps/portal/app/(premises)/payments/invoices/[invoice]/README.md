# [invoice]

    page.tsx   SCR-FIN-03  one invoice: Retrieve the issued invoice, Retrieve the original of a corrected invoice

Addressed by an invoice number with a hyphen for its space (`1C26TRO-00000418`), or by a payment's reference
(`PAY-...`). An issued invoice or corrective document shows the documents of its payment, the original and its
corrective document side by side, each opening the other; the amount by component; and what it records: the issuer
(the designated collection authority), the payer, the payment, the decision, and Kept until, which reads "No
retention period approved yet" while CFG-406 has no approved value. A corrective document names the invoice it
corrects, which stays retrievable. By a payment, the page is that payment's invoice: issued, or not issued yet,
because the payment is not settled (`FIN_PAYMENT_NOT_SETTLED`, a refusal with its code) or because the e-invoice
service was down when it fell due (`FIN_EINVOICE_UNAVAILABLE`, a condition without one; the invoice is issued on the
first read after the service is back). Anything of another party, or of a premises a delegate's authority does not
reach, is `SRS_RESOURCE_NOT_ACCESSIBLE`.

Review views: one, not-settled, einvoice-unavailable (the canvas's, whatever the address), loading.
