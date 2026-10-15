# src

`primitive.ts`, `semantic.ts` and `scale.ts` are generated from `../r1/tokens.json` by
`../scripts/generate-from-r1.mjs` and are never edited by hand. `primitive.ts` is the raw ramps;
`semantic.ts` is what components use, one value per theme; `scale.ts` is every token that is not a
colour, the type styles among them. `contrast.ts` is the WCAG relative-luminance calculation, written out rather than taken from
a library because it is a dozen lines and the token tests are built on it - a dependency that changed
its rounding would quietly change what the gate means. It also lays a see-through colour over its
ground before measuring, because R1's dark theme has see-through dividers and tints.
