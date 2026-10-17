# Mandate Register

Figma file `m5jgAuVYNjDLvzBIrz6n1L`, content node `140:461`.

`MandateRegisterPage.tsx` is the server entry: it requires the CMO session, reads locale and frame,
loads the API seam and supplies the existing organisation shell. `MandateRegisterClient.tsx` composes
R1 controls and the table; `state.ts` normalises queries and selects the displayed rows.

Data comes only through `lib/api/mandate-register.ts`; messages come from the `mandate-register`
catalogue pair. The loader exposes sample records only with `RIGHTONE_DATA=mock`. Connecting a real
register requires a register-read authorisation contract; the organisation session alone is not one.

Review states: `view=populated|loading|empty|error`, honoured only in mock mode. A missing or invalid
view loads normally. `frame=phone` uses cards and stacked filters; `frame=tablet` constrains the
content using existing container tokens, wraps filters and allows horizontal table scrolling.
The phone's Sort order combobox keeps sorting available when the table headers become cards.

Filters: `grantee`, `kind=portal|organisation`, `status=SUBMITTED|SUSPENDED|EFFECTIVE|EXPIRED`, and
`asOf=YYYY-MM-DD`. Sorting: `sort=grantee|status|effectiveFrom` and `dir=asc|desc`. Unknown or repeated
values use defaults. Filter/sort changes preserve other query parameters and the fragment, and the
shell's locale switch refreshes without dropping the query.

The fixture is the register snapshot at 2026-09-28, with no historical transition log. Selecting
another valid day explains this limit instead of inventing a historical result. The three additional
review states, mobile/tablet layout and English copy follow the approved implementation plan; they
are not additional frames supplied by the referenced node.

The two header actions and each grantee link intentionally use `href="#"` pending destination URLs.
The thin route is `app/(org)/org/mandate/register/page.tsx`.

In PowerShell, start the sample portal from the repository root:

```powershell
$env:RIGHTONE_DATA = 'mock'
pnpm --filter @rightone/portal dev
```

Sign in with a sample organisation account from `apps/portal/README.md`, then open:

- `/org/mandate/register?view=populated`
- `/org/mandate/register?view=empty&frame=phone`
- `/org/mandate/register?view=error&frame=tablet`

Use the shell's VI/EN switch for locale; `locale=` is not a locale-routing mechanism in this app.

Verification covers production build/type checking, scoped ESLint, catalogue/data/query tests, and
browser checks for both locales, sorting and filtering by keyboard, date validation, all review states,
invalid review queries, phone widths 320/390 and tablet width 768. Phone has no page-level horizontal
overflow; the tablet table scrolls inside its named, keyboard-focusable region.

The existing `test/design-system-use.test.ts` has a Windows path-separator false positive for the
unchanged `components/Text.tsx` and `components/ThemeSurface.tsx`. This is reported separately from
the register checks. Browser keyboard/semantic checks and token tests do not constitute a full
WCAG audit; no axe suite is configured in the repository yet.
