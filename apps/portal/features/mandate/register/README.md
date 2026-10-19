# Mandate Register

Figma file `m5jgAuVYNjDLvzBIrz6n1L`, content node `140:461`.

`MandateRegisterPage.tsx` is the server entry: it requires the CMO session, reads locale and frame,
loads the API seam and passes the signed-in account to `MandateRegisterClient.tsx`. The client owns
the shared `ConsoleShell`, its rail click handlers and the existing cookie-based language switch, and composes
R1 controls and the table; `state.ts` normalises queries and selects the displayed rows.
`MandateRegister.module.css` lives beside these components and owns their token-based layout,
filter control limits and table column sizes through scoped classes, without inline styles.

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

The design-system checks allow this feature's CSS Module and its two consumers while continuing
to check token usage. Browser keyboard/semantic checks and token tests do not constitute a full
WCAG audit; no axe suite is configured in the repository yet.

## Administration rail review

The rail follows the supplied GOV screenshot: twelve entries from Mandates to Review authority,
with the register marked current and linked to `/org/mandate/register` (not `/authorities`,
which belongs to another surface). Labels are translated in both catalogues and icons come from R1.
Coverage now links to `/org/coverage`; the other ten administration routes are not implemented on this branch. Their buttons open an
explicit unavailable-screen dialog. They do not navigate to unrelated routes or silently do nothing.
The existing organisation session gate and signed-in account are preserved. The shared shell displays the fixture queue count only in server-confirmed mock mode;
no queue count is invented in real-data mode.
