# components

Presentation shared across surfaces.

Every component implements the full set of states its element has - default, hover, focus, active,
disabled, loading, error - and never conveys information by colour alone. `StatusBadge` carries its
label and its family's shape as well as its colour, so it survives deuteranopia, a printed A4
certificate and a photocopied inspection record.

    r1/               the design system R1's components, generated - see r1/README.md
    shells/           R1's shells with the language switch wired, and the premises nav
    Text.tsx          running text between R1 components: size, ink, weight and measure, all tokens
    ThemeSurface.tsx  a page in another R1 theme with no shell to set it (the printout's paper)
    ReservedPage.tsx  a surface whose screens are not specified yet
    StatusBadge.tsx   a state from the API as R1's badge, through @rightone/ui's mapping
    MockDataNote.tsx  the line at the foot of every page while the data is mock

## Every screen is built from R1

A screen arranges R1's components and lays them out with tokens (flex, grid, gap, a maximum width). What
anything looks like - ink, surface, border, type - belongs to a component: R1's, or one of the two here that
R1 lacks (`Text`, `ThemeSurface`). R1 has no text component and its canvases write running text as bare
paragraphs; `Text` is that one pattern, so no screen styles its own. `test/design-system-use.test.ts` holds
every file under `app`, `features` and `components` to this: no raw text, action, field or list element, no
visual style property, no class name, no length or colour literal, no stylesheet. A finding is fixed by
using a component, extending one, or adding one here; the test carries no exceptions.

A component added here is a proposal for R1: when the design system ships its own, the screens move to it
and this one goes.
