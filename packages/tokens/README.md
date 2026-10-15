# @rightone/tokens

Three layers, one rule each. A primitive is a raw scale value and no component references it. A
semantic token is the only layer a component may use. A component token is defined here and
reviewed by design.

## Where the values come from

Since 2.0.0 (7 October 2026) every value is generated from the RightOne Design System R1, the one
source of tokens (Design Brief `02-Design-Tokens.md` 1.1). `r1/tokens.json` is a copy of the design
system's `project/tokens.json` (https://claude.ai/artifact/7UFbwnuFWCvgVs6JXM8FaD), and
`scripts/generate-from-r1.mjs` writes `src/primitive.ts`, `src/semantic.ts` and `src/scale.ts` from it.
Those three files are never edited by hand: change the design system, copy its `tokens.json` over
`r1/tokens.json`, run `pnpm --filter @rightone/tokens generate`, and let the contrast tests say whether
anything broke. `pnpm --filter @rightone/tokens generate:check`, which CI runs, fails when a generated file
no longer matches the copy. Every section of the copy is generated: the colours, the type families and
styles, and every scale, including `SCALE` and `BACKDROP`; a section the script does not know stops it.

R1 has three themes and no switch: **dark** for every console, portal and public page, **light** for
paper (the printed record, a document sheet), **player** for the device and the guest display.
`THEMES` holds all three; `SEMANTIC` and `STATUS` are the dark theme, which is what the portal emits
as its root variables. A key folds R1's name into camelCase (`on-surface-secondary` is
`onSurfaceSecondary`), except before a digit (`chart-1`), so turning a key back into kebab case gives
the R1 variable name.

1.x held the warm-grey light palette of the brief's first draft (R1-UXD-003 v1.0). The export names
`PRIMITIVE`, `SEMANTIC`, `STATUS` and `StatusFamily` are kept; the primitive names follow R1's ramps
(`navy-900`, `teal-500`), and `THEMES`, `STATUS_BY_THEME` and the scales (`SPACE`, `RADIUS`,
`FONT_SIZE`, `SIZE`, `BREAKPOINT` and the rest) are new.

## The tests are the point

R1 states measured contrast ratios in the usage of the colour tokens that carry text or bound a
control. `test/contrast.test.ts` asserts 48 of the ratios R1 states for its text and control pairs over the three themes, and the five status families on each; R1 states no ratio for the player theme's positive, attention and danger tints, which are held at their measurement of 7 October 2026. R1 states more ratios than these, such as the accent over a hovered layer, which are not asserted. Each asserted pair is checked twice: it still
passes its gate, and it still measures what the design system says. A test name says where its
expected value comes from. A token edited to a near value would keep
passing the gate while quietly making the documentation wrong.

Three facts worth keeping visible. On the dark theme the thinnest text pair is the accent on a
raised layer, 4.64:1. On paper, muted text measures 4.79 on white and 4.34 on the tinted page, so
it sits on white cards only. And the dark theme draws its dividers and status tints see-through
(white at 10 %, green at 12 %): `contrastRatio` lays a see-through colour over its ground before it
measures, and `over` returns that blended colour.
