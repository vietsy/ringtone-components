# new

    page.tsx    SCR-REG-02  start an application

Views: first, no-premises-chosen, renewal, change, starting, open-exists, period-invalid, pre-registration,
relationship, not-authorised, prior-not-found, prior-superseded, cause-required, premises-unavailable,
governance-unavailable, no-premises, loading, error. Without `?view=` the form starts a first registration from
today for a year, with no premises chosen.

- Start the application sends the start (`features/registration/actions.ts`): accepted, SCR-REG-03 of the new
  draft opens; refused, the form comes back with the refusal where the board draws it (beside the dates or the
  cause, or in place of the result panel) and every value as entered. The checks and their order are the
  contract's: a premises with an application of the same kind open is refused OPEN_APPLICATION_EXISTS, and
  Open REG-… opens SCR-REG-07 of that application; a period another decision governs is refused
  INTENDED_PERIOD_INVALID, and Open decision OBD-… opens SCR-REG-08 of that decision.
- Start waits for a premises: unavailable with "Choose a premises first." until one is chosen, read as the
  person chooses (`features/registration/GatedForm.tsx`).
- The kind is not chosen here, as the board draws it: SCR-REG-01 starts a first registration, and SCR-REG-08's
  Renew and Report a change open this page as a renewal or a change of that decision, its premises fixed.
