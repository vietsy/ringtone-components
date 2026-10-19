# r1

`tokens.json` is a copy of the RightOne Design System R1's `project/tokens.json`
(https://claude.ai/artifact/7UFbwnuFWCvgVs6JXM8FaD), the one source of tokens (Design Brief
`02-Design-Tokens.md` 1.1). It is kept here so a build never reaches the network.

Refresh it by copying the design system's file over this one, then run
`pnpm --filter @rightone/tokens generate`. Every generated file names the sha256 of the copy it was made
from, so a reader can tell which copy produced the code. The copy of 8 October 2026 has sha256
`5ba427dc5c1b1681…` and carries R1 version 10's `bp-xs`.

The Figma library of R1 (file `GJADVtfzdc65W1mIHowvGw`, which labels itself version 15) holds the same tokens as
variables. On 18 October 2026 (R1-112) the two were compared value by value: every primitive, every colour in
every theme, and the spacing, radius, size, type, opacity and shadow scales are equal. What differs on purpose
is recorded in the library's Foundations note: it draws the system font stack as Roboto and cannot express the
`saturate()` and `brightness()` of the backdrop filters, and some Player and pairing-code sizes the code computes
in `r1.css` are variables there. Refresh this copy when the design system changes, then compare again.

`tokens.css` is the design system's token stylesheet, the same tokens written as CSS custom properties. The
portal does not load it; `apps/portal/test/theme.test.ts` holds the theme the portal emits to it, value by
value. Refresh it together with `tokens.json`.
