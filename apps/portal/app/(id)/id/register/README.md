# register

    page.tsx    SCR-RID-07  Register

Every view the canvas drew is reachable as `?view=`: form (the default), field-error, submitting,
breached, sent, closed, error; `?client=none` with mock data.

"Đăng ký" submits to `register`, which goes to SCR-RID-08. On the canvas the submit answers "sent" and
RightOne ID mails a link that opens SCR-RID-08; the stand-in sends no mail, and "sent" has no control
that leads on (its one link goes back to sign in), so showing it first would end the journey there.
"sent" stays reachable as `?view=sent`.

Deviation: the password's rule checklist follows what is typed (`NewPasswordField`, a client component),
where the canvas draws it for the sample value only; the rules are the canvas's four.
