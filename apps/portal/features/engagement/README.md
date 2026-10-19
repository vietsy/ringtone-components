# engagement

What the ENG screens need beyond links: the participant screens both participant portals draw (`app/(premises)/engagement`
for the premises principal, `app/(artist)/artist/engagement` for the artist), the engagement workspace of the operations
console (`app/(ops)/ops/engagement`) and of the policy console (`app/(ops)/policy/engagement`).

    participant.ts         the portal a participant reads their record in: who reads, the shell's account and nav, and
                           where the five screens are; `requirePortal` for an act that names its portal
    TakePartScreen.tsx     SCR-ENG-01, in either portal
    BalanceScreen.tsx      SCR-ENG-02, in either portal; the artist's links on to SCR-ENG-05
    PointsScreen.tsx       SCR-ENG-03, in either portal; Use points refused naming DEC-30 if sent anyway
    EventScreen.tsx        SCR-ENG-04, in either portal
    ReferralScreen.tsx     SCR-ENG-05, the artist's alone
    actions.ts             every engagement act: the seam's command, then the screen that comes next; a refusal goes
                           back where the act was, with what was typed
    copy.ts                the family's translator, value formats, state words and families, refusal wording
    Refusals.tsx           a refused act drawn where it was, and a read that did not answer
    EventDetail.tsx        SCR-ENG-04's body, for the participant and under a support read
    EventBlock.tsx         SCR-ENG-09's event block
    PolicyTabs.tsx         the policy workspace's two link tabs
    ConfirmAct.tsx         an act confirmed with the sentence of its consequence
    SubmitFor.tsx          a button that sends a form drawn elsewhere on the page
    RowActs.tsx            a console table whose rows carry one act each (Remove, Publish)
    DisclosureDraft.tsx    SCR-ENG-13's draft, Approve naming the missing language
    CorrectionFields.tsx   SCR-ENG-09's ground and delta with the resulting balance as it is typed
