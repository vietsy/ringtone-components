# Coverage lookup

`CoveragePage.tsx` requires mock mode and an Operations Console session before loading the API seam.
`CoveragePageClient.tsx` composes the shared governance shell and R1 form/result components;
`CoveragePageClient.module.css` owns token-based layout. `/ops/governance/coverage` uses this feature.

There is no default date. Only the supplied performers/all-repertoire/Da Nang/2026-06-15 fixture
has a known sample conclusion; other valid queries report missing sample data rather than an
invented coverage decision. Review states are documented in `app/(ops)/ops/governance/coverage/README.md`.

`query.ts` validates inputs and constructs lookup URLs. Submissions remove forced review states
while preserving unrelated parameters. Editing fields hides the previous result until resubmission.
`test/coverage-query.test.ts` protects these query and calendar validation rules.
