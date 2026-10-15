# test

Covers the parts that hold rules - the message catalogue and error presentation - rather than
rendering, which Playwright checks end to end against a real page in `e2e/`.

    messages.test.ts            the catalogues: both locales, the same keys, no empty value
    theme.test.ts               the theme emitted from @rightone/tokens against R1's own tokens.css
    design-system-use.test.ts   every screen is built from R1: no raw element, visual style or literal
