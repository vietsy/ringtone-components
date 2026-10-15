# [decision]

    page.tsx    SCR-REG-08  obligation decision: the fee, the period and the deadline, what it rests on, how to appeal

Views: otherwise, as-applied, no-fee, claim-pending, claim-partly-accepted, superseded, appeal-open,
not-found, loading, error. Without `?view=` the page reads the session's decision; a reference the session does
not have is not found (Mây Sông's OBD-6WSN2LQB8H belongs to another organisation, drawn only as
`?view=claim-partly-accepted`). With `?view=` the reference selects the decision, each drawn in one state.

- OBD-2YDA7KMS5X is a row of SCR-REG-01 only: the canvas draws neither its amounts by rights layer nor when it was
  issued, so it is not found rather than shown with amounts made up.
- Addition awaiting the BA: a decision with a fee to pay (current, payable, with a pay-by date) carries a
  primary button Trả phí / Pay the fee, first in the row of actions, which opens SCR-FIN-01 for the decision.
- Report a change and Renew open SCR-REG-02 as a change or a renewal of this decision (server actions
  `changeDecision`, `renewDecision`): its premises, the decision and its period, and the period the
  specification prefills. A renewal copies the answers its decision rests on where the canvas draws them
  (OBD-3FJW6NRA5C), each waiting to be confirmed as still true.
- Open the application is drawn only where the data names the application (OBD-4NPV8CRA2J, OBD-6RHC4WNE9B and
  OBD-6WSN2LQB8H name none).
- A statement's reason, condition not met and what the premises can do are the decision's own text, so they
  come with the data in both languages rather than from the catalogue.
