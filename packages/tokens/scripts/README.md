# scripts

`generate-from-r1.mjs` writes `src/primitive.ts`, `src/semantic.ts` and `src/scale.ts` from
`../r1/tokens.json`. It has no dependencies, so it runs before the workspace is installed, and CI runs it
with `--check` so a generated file that no longer matches the copy fails the build.

It generates every section of the copy or refuses: a section it does not know, a colour missing a value
for one of the three themes, or a scale token whose value is not a plain string stops it with the name of
what it could not place.
