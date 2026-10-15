# r1

The components of the design system R1, as the portal uses them. Nothing here is written by hand.

    source/      a copy of the design system's bundle.js, bundle.css, index.d.ts and tokens.css
    generated/   the ES module, stylesheet and types made from that copy
    index.ts     the import path: `import { Button, Table } from "@/components/r1"`
    Gallery.tsx  every component in its specimen states, served at /design-system with mock data

R1 ships its components as one script that reads React from the page and attaches itself to
`window.R1`. `scripts/generate-r1-components.mjs` turns it into a module without changing a
component: React and `createPortal` are imported, every component is exported by name, and the
design system's own copy of the format rules is replaced by `R1_FORMAT` from `@rightone/formatting`,
so money and dates are rendered one way across the portal (R23.7).

## Refreshing the copy

Copy `project/components/bundle.js`, `bundle.css` and `index.d.ts` from the design system
(https://claude.ai/artifact/7UFbwnuFWCvgVs6JXM8FaD) over the files in `source/`, then run

    pnpm --filter @rightone/portal generate:r1

CI runs `generate:r1:check`, which fails when a generated file no longer matches the copy. When the
design system changed its format rules the generator stops and says so: port the change into
`packages/formatting/src/r1.ts` first, then set the hash it prints.

`source/tokens.css` is R1's token stylesheet. The portal does not load it - the variables come from
`@rightone/tokens` through `lib/theme` - but `test/theme.test.ts` holds the emitted variables to it,
value by value, and checks every variable the components read is defined.

## Why a generated copy rather than components written here

The design system is where each component's states, keyboard behaviour and wording are decided and
reviewed. Writing them a second time here would fork that decision ninety-nine times. The copy keeps
one source, the way `@rightone/tokens` keeps one source of colour.
