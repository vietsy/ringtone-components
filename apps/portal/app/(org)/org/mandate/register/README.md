# Mandate Register

    page.tsx   /org/mandate/register

Thin route adapter for `features/mandate/register/MandateRegisterPage.tsx`.
Requires a signed-in organisation administrator, including during design review.

With `RIGHTONE_DATA=mock`, review `?view=populated|loading|empty|error` and
`?frame=phone|tablet`. Locale follows the shell's language switch (`r1-locale` cookie).
The two header actions and row links intentionally use `href="#"` pending their destination URLs.

See `features/mandate/register/README.md` for filters, sorting and snapshot limits.
