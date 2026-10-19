# r1

The components of the design system R1, as TypeScript source. Import them from the folder:
`import { Button, Table } from "@/components/r1"`.

    <Name>.tsx       one component per file: its props type (<Name>Props) and the component
    lib/             what several components share
      types.ts       the shared props types (Family, Locale, StatusValue, FieldBase, ActionSpec, ...)
      strings.ts     every component's words, Vietnamese and English; tx(locale) returns them
      icons.ts       the icons R1 draws (94, Lucide outlines)
      helpers.ts     class names, ids, focus, live regions, text and matching helpers
      formatting.ts  the format rules, taken from @rightone/formatting (R23.7)
      format.ts      format: the helpers R1 publishes for a value rendered outside a component
      *.ts(x)        one file per area the components share: table, form parts, keyboard rules, player, ...
    r1.css           the components' stylesheet; every colour, size and radius is a token
    gallery/         each component's specimen, one file per component, shown at /design-system
    Gallery.tsx      the body of /design-system
    index.ts         the import path: every component, its props type, format and the shared types

## Changing a component

A component is code like any other here: TypeScript strict, ESLint and the tests apply. Change it in its
file, and keep it in step with the design system R1 (https://claude.ai/artifact/7UFbwnuFWCvgVs6JXM8FaD), where
the states, keyboard behaviour and wording of each component are designed and reviewed: a change decided
there is made here, and a change made here is proposed there, so the two do not drift.

`test/design-system-use.test.ts` holds every screen to these components and does not read this folder:
these files are what the screens are held to. `test/theme.test.ts` checks that every custom property the
stylesheet and the components read is defined, and that the tokens the portal emits match R1's token
stylesheet (`packages/tokens/r1/tokens.css`).

The format rules stay in `@rightone/formatting` (R23.7). `lib/formatting.ts` takes them from there, so a
money amount or a date reads the same in a component and on a server page.

## Where this came from

Until 15 October 2026 the portal carried a copy of R1's script bundle and turned it into a generated module,
and `/design-system` was built from the design system's HTML preview pages. That copy was converted once into
this source: each component its own file, each `h(...)` call JSX, each props type from R1's published
declarations, the helpers typed. Every page of the portal was rendered before and after the conversion and
compared: the same DOM, pixel for pixel.
