# pay

    page.tsx   SCR-FIN-01  pay an obligation decision

Live: the decision as the session holds it. No instruction yet: the fee, the decision and Authorise payment.
An instruction to pay: How to pay, with the bank's transfer code for its amount and content, and the card,
under "Valid to the end of {date}". An instruction past its last day: the expired banner and Authorise again.
A decision no longer in force or without a fee: its refusal in place of the act. A decision already paid has
nothing to pay, so the page hands over to its payment position (SCR-FIN-02); Nguyễn Huệ's decision does so
from the start, Pasteur's once its payment is settled.

Authorise payment that repeats a request already answered (the decision has an instruction to pay, or is paid,
for instance from a second tab) is refused with `FIN_IDEMPOTENCY_CONFLICT` and drawn as the board's
repeated-request state: the page as the payer had it, the refusal under the fee, Authorise payment unavailable
and Reload the page, which shows the decision as it stands. Pay by card on an instruction no longer open to pay
is refused the same way.

The board's paying state is the card payment page opening ("You chose to pay by card"). The mock's card
settles at once, so a session never stays in it, and a bank transfer is never drawn in it: while the transfer
is awaited the page shows the instruction to pay, as the board does before money arrives.

Review views: instruction, authorise, authorise-confirm, repeated-request, paying, expired on
`OBD-3FJW6NRA5C` (Pasteur); decision-not-current on `OBD-6RHC4WNE9B`; no-fee on `OBD-9MZB3QFT4X`;
not-authorised on `OBD-8KWT2PZH6M`; loading and error on any.

Two client components carry the interaction (`features/finance`): Authorise payment with its confirmation
dialog, which the authorise-confirm view opens once the page has mounted (the dialog portals into the
body, which the server render does not have), and the expired instruction's banner with Authorise again,
whose form a server page cannot hand to the banner as a prop. Save the code draws the QR code on screen
into a PNG. The bank identifier and account are the canvas's placeholders, not a bank.
