# assurance

    page.tsx   the assurance read of GET /engagement/balance/as-at for the auditor (ACT-AUD): a participant's balance
               and history as at a past instant, under the assurance engagement named, and the audit log the read is
               written to

ENG's inventory gives this read no screen of its own (SCR-ENG-02 is the participant's), so it shares SCR-ENG-02's
figure sentence and history. A future instant is refused AS_AT_IN_FUTURE beside its field, naming the latest instant
that may be asked; anyone but an auditor naming an engagement is refused PARTICIPANT_NOT_SELF, which names nobody.
