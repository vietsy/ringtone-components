# @rightone/ui

Logic, not components. The React that renders this lives in the portal; what lives here is the part
that has to be identical everywhere and testable without a renderer.

**The four-state contract.** A view that loads data is loading, empty, error or populated, and an
empty state must say which kind of empty it is. `toViewState` exists to enforce one rule: a failure
never becomes an empty result.

**The status system.** Over a hundred states from seventeen state models map onto five families.
Five of those mappings are product-specific and named individually, because the intuitive colour
would teach the user the wrong thing - offline-but-playing is `info` and not `danger`, because red
there trains a venue to ignore red, and then it ignores the red that means the entitlement was
revoked.

An unmapped state returns null rather than defaulting to neutral: rendering it as "historical"
would be a claim about the business instead of an admission that nobody mapped it.
