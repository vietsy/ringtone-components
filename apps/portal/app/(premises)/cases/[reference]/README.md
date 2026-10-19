# [reference]

    page.tsx   SCR-CAS-02  my case

Read by its reference, with or without an account: the reference, the time it was raised, its state in words, what
happens next (who acts, by when), what was asked for - with the answer form for each open request addressed to the
reader, which shows the disclosure status before anything is supplied - what the case team holds, each item's
content withheld where its status says so and why (AC-FR-CAS-006-02), with Add something to your case (POST
/cases/{id}/evidence, its disclosure chosen before it is sent) - the decision once there is one, the challenge to it
and its outcome, a referral (which process has it), a closure without a decision (why, the route instead, and until
when it can reopen), and a reopening asked for or refused with its reason. Ask for a reopening opens SCR-CAS-08 on a
closed case whose appeal is no longer the reader's route. Withdraw this case asks
first, naming the consequence (convention 9), and is the raiser's alone: on a case raised from an account, anyone
else is refused ROLE_OUT_OF_SCOPE, recorded, and the refusal is drawn in the page header; a decided case is
CASE_ALREADY_DECIDED. A reference that names nothing is CASE_NOT_FOUND, with the support line.

Review views: loading, error, protected (PROTECTED_MATTER_NO_ACCESS).

- Withdraw follows SM-05 transition 16 (RECEIVED, TRIAGED, ASSIGNED); the screen specification enables it until
  DECIDED. In the states between, the button is unavailable and says the case is being worked on.
- Challenge the decision opens SCR-CAS-08 once a decision is issued; before that it is drawn unavailable with
  NO_DECISION_TO_APPEAL, and while a challenge is open it says so. Raise a concern (SCR-CAS-12) is not built and is
  left out, rather than linking to a page that does not exist.
- What is supplied against a request is described in words; the mock holds no files.
- The classification date the acknowledgement names is five working days after the case is raised: the
  specification requires a period for that step and approves none (`CLASSIFY_WORKING_DAYS` in the backend).
