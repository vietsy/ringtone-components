# authorisation

What SCR-PTY-17 (`app/(org)/org/verify`) needs beyond links.

    actions.ts     Ask: sends POST /authority-verifications and opens the same screen with the answer, or the
                   refusal beside its field, the question kept as typed (`keepForPage`)
    AskForm.tsx    the question as a form: Ask waits for a premises and a moment, works while the register is
                   asked, and the answer area shows the board's checking state meanwhile; when the register did
                   not answer, Try again sends the same question again (R1's default would only reload the page,
                   which shows the failure the last attempt kept)
