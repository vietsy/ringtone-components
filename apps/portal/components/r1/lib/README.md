# lib

What more than one R1 component reads. A component's own logic stays in its file; a piece moves here
when a second component needs it.

    types.ts                 the shared props types (Family, Locale, StatusValue, FieldBase, ActionSpec, ...)
    strings.ts               every component's words, Vietnamese and English; tx(locale) returns them
    icons.ts                 the icons R1 draws (94 Lucide outlines), the seal's points, the status families
    helpers.ts               class names, ids, synced values, focus, typing and control tests
    formatting.ts            the format rules, taken from @rightone/formatting (R23.7)
    format.ts                format: the helpers R1 publishes for a value rendered outside a component
    dates.ts                 a calendar day and its arithmetic, for Calendar and DateField
    time-limits.ts           a duration in words, for the clocks and deadlines
    value-atoms.tsx          a missing value, a masked value, an identifier read character by character
    form-parts.tsx           the field frame: label, hint, reason, read-only box, icon and affix sizes
    choice-controls.tsx      the mark a checkbox or radio draws over its real input
    more-inputs.ts           a time as people type it, snapped to a step
    search-and-pick.ts       search words for screen readers and keyboard shortcuts in fields
    keyboard-rules.ts        single-key shortcuts: who holds a key in a shell, and turning them off
    button.tsx               a reference in a label kept on one line (OBD-2YDA7KMS5X), for buttons and links
    menus-and-notices.ts     a token read in pixels, for placing an open menu or a row of buttons
    dialog.tsx               the theme a dialog or toast carries outside its shell
    shells.tsx               the shell theme, the mark, the skip link, navigation and sign-out
    table.tsx                a table cell by kind, also drawn by FactList; row messages
    side-by-side-lineage.tsx how a Comparison row or a TracePath step writes its values
    status-badge.ts          the words of a state that is running now
    documents.ts             the icon of a file by its type
    player.ts                the Player conditions and their families, and a value on the Player
    player-parts.ts          the Player clock, position and day as people read them
