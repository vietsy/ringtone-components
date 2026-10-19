# geography-policy

    page.tsx   SCR-DAT-16  the policy in force, the preview of what it releases, a new version previewed and approved

The data protection officer (ACT-DPO, Lê Văn Cường) prepares a version (`?draft=new`), previews it, and approves it,
confirmed in a dialog; it takes effect on its day, and the version in force ends the day before. The refusals of
`POST /geography-policies` stand at their fields: FIELD_MISSING, LEVEL_NOT_PERMITTED (only the province is approved for
artists), DEFAULT_LEVEL_NOT_PERMITTED, MINIMUM_POPULATION_INVALID and EFFECTIVE_PERIOD_OVERLAP with the days it
overlaps. The artist's own read (ACT-ART) is the artist portal's, which is reserved. `?view=loading` and `error` draw
those states for review.
