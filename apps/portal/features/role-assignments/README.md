# Role assignments

Route: `/role-assignments`. The thin route forwards framework props to `RoleAssignmentsPage.tsx`.
The server requires `ACT-SEC` staff permission and an explicit mock holder identity, resolves locale/frame/view,
loads the authorised snapshot and wraps the client in Suspense, following the mandate register.

`RoleAssignmentsPageClient.tsx` keeps the table and interactions together and uses the shared
`components/shells/GovernanceShell.tsx`, with Appointments marked current. Register, detail and coverage
also import this shared shell directly. Search, queue and unavailable
destinations use its existing dialogs. No organisation permission is promoted to staff permission.

`types.ts` owns the feature contracts. `state.ts` validates queries and dates, filters and groups source
rows and updates URLs. Adjacent CSS Modules own token-based content layout and the table's minimum width.
Column widths use R1's `columns[].width/minWidth` with CSS tokens, only in table layout; no `nth-child`
selectors are needed. The feature
does not override shell structure or use JSX style props. R1 is imported through `@/components/r1`.

## Run with mock data (PowerShell, repository root)

```powershell
$env:RIGHTONE_DATA = 'mock'
pnpm --filter @rightone/portal dev
```

Sign in at `http://localhost:3000/id/sign-in` with:

- Email: `anhtuan.hoang@rightone.example`
- Password: `RightOne-AnNinh-2026`

These invented credentials belong to Hoàng Anh Tuấn, a staff account holding `ACT-SEC`.
Staff sign-in follows main's operations landing; then open `/role-assignments`.
Restart a development server that still retains the pre-migration account/session in memory, then sign in again.
Outside mock mode, the read/write API seams return `SERVICE_NOT_CONFIGURED`.

The backend resolves the active account, retained staff session and explicit holder link before every read/write.
It refuses self changes, revoked appointments, stale transitions and unsupported commands. The store resolves a
session to the browser's world: changes survive sign-out/sign-in, are shared by authorised staff in that world,
and remain isolated from other browser worlds. Resetting the world restores the seed.

## Design review and query behaviour

- `/role-assignments`: live world snapshot, with suspend/restore commands.
- `/role-assignments?view=populated`: stable Figma fixture; action clicks offer a return to live data.
- `/role-assignments?view=loading`: stable skeleton.
- `/role-assignments?view=empty`: no recorded appointments.
- `/role-assignments?view=error`: retry removes the review override.
- `/role-assignments?view=populated&frame=phone`: cards, stacked filters and portal-sized targets.
- `/role-assignments?view=populated&frame=tablet`: constrained content and internal table scrolling.

Review overrides only apply in mock mode and never bypass the staff gate.
Absent or invalid views use normal reads; invalid frames use the existing user-agent helper.
Locale comes from the shell's VI/EN switch and cookie, not a locale query.

The client filters its authorised snapshot through Next's native History API integration without an API read
for each edit. Filters are `role`, `holder`, `status`, `effectiveOn` (ISO calendar day). Unknown/repeated values
use defaults. Changes retain unrelated query parameters and the fragment; the language switch retains them too.
Incomplete or impossible date text is reported on blur and does not replace the last valid query.

The date filter selects appointments whose effective start has been reached and retains ended history as the
Figma board does. It does not reconstruct historical statuses. The default is the design reference day,
2026-09-28. Populated rows, holder names and Vietnamese wording follow node `167:2255`; English copy,
loading/empty/error and narrow layouts extend that desktop design.

## Verification

Portal scripts: `typecheck`, `test`, `build`; workspace lint: `pnpm lint`.
API tests cover permissions, commands, preview isolation and browser-world persistence/reset/isolation.
State tests cover query allowlists, date validation, grouping, filtering and URL/fragment preservation.
The design-system test explicitly lists this feature's CSS Modules/consumers and scopes its no-inline-style
check to this feature. Final verification passed 822 tests in 23 files, scoped ESLint, TypeScript and the
production build. Browser checks against a fresh production mock server covered suspend/restore, filters,
invalid-date feedback, query/hash preservation, VI/EN, loading/empty/error/populated reviews, retry,
read-only review actions, phone/tablet overflow, dialog Escape/focus return, mandate/coverage smoke tests
and the CMO access gate. The inspected browser console had no warnings or errors. These checks do not
establish full WCAG compliance.
