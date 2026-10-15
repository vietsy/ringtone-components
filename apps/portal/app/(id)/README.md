# (id)

Stand-ins for the RightOne ID pages until the portal signs in through RightOne ID itself. RightOne ID is a
separate product at id.rightone.vn (the identity provider every RightOne application signs in through); in
production the portal redirects to it and back. Until then these pages sign people in for real against the
mock backend's accounts (`lib/mock/backend/accounts.ts`), so the portal is walked as it will be used.

The pages follow the RightOne IAM canvas (SCR-RID-*), which RightOne ID draws on R1: brand "RightOne ID",
no language switch, one column of `--container-md`. The canvas is Vietnamese only; the English catalogue
(`messages/screens/rid.en.json`) is written here so a reader who chose English elsewhere is not shown raw
keys. Signing in starts a session (an httpOnly cookie, `lib/api/session.ts`); a wrong password, a locked,
suspended or unconfirmed account are answered as the canvas draws them. Registering creates an unconfirmed
account and writes its confirmation link to the server's log (there is no mail); following the link confirms
it. Choosing the organisation sets who the principal acts for. `/id/sign-out` ends the session.

Flow: sign in -> choose an organisation -> the premises portal (`routes.applications()`), or for an
inspector the field client (`routes.field()`); register -> confirm the email (the link in the log) -> sign
in. Each page still draws any state of its board with `?view=`, for design review only.

    id/sign-out/   ends the session (a route handler; the shells' Sign out links here)

    id/    the pages, under /id/...
