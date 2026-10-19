# backend

The mock backend's rules, tested the way the portal calls them: a session made by `harness.ts` in a world of
its own, then the family's commands and reads, each answer checked against the refusal codes and the state
changes its specification names. A test that proves an acceptance criterion carries the criterion's tag in its
`it` title (`@AC-FR-REG-001-01 ...`), which `scripts/check-ac-titles.mjs` checks for shape.

    harness.ts          signIn, signInBeside, PEOPLE: the seed's people by role
    <family>.test.ts    one per family
