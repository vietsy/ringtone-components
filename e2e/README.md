# e2e

Playwright. Journeys, and the checks that only a real page can make:

| Suite | Covers |
|---|---|
| keyboard | every interactive element reachable and operable, focus order follows reading order |
| axe | `axe-core` on each surface; it blocks at `T2` |
| budgets | Lighthouse against the per-route budgets, with public verification held to 300 KB |
| journeys | the main flows per surface |

`axe-core` catches roughly a third of what matters. The other two thirds are the manual rows in the
frontend standard, and they belong to the reviewer rather than to this directory.

RESERVED. Opens with the first screen specification.
