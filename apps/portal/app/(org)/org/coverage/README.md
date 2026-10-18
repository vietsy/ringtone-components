# Coverage

SCR-GOV-03, coverage not covered. `/coverage` renders the supplied Content frame through
`features/coverage/CoveragePage.tsx` and `CoveragePageClient.tsx`. Available only with
`RIGHTONE_DATA=mock`; otherwise the feature returns 404. No operations authority or production API
is implied by this review route.

Start from PowerShell at the workspace root:

```powershell
$env:RIGHTONE_DATA = 'mock'
pnpm --filter @rightone/portal dev
```

Open `http://localhost:3000/coverage?view=not-covered`. Review states are `form`, `loading`,
`not-covered`, `empty` (the same governed result), and `error`. An absent or invalid `view` follows
the input query. An absent input query opens a blank form without a default date.

`frame=phone` and `frame=tablet` use the existing frame helper and token widths. Locale follows the
existing `r1-locale` cookie (`vi` by default, `en` for English), as set by the portal language switch.
Locale refreshes preserve the URL and query.

The only sample lookup is `right_type=performers&repertoire_key=*&territory_code=VN-DN&as_of=2026-06-15`.
Other valid queries return a sample-unavailable failure, never an invented coverage result.

Example review URLs:

- `/coverage?view=not-covered&frame=phone`
- `/coverage?view=empty&frame=tablet`
- `/coverage?view=loading`
- `/coverage?view=error`
- `/coverage?right_type=performers&repertoire_key=*&territory_code=VN-DN&as_of=2026-06-15`
