# shells

R1's three shells - `PublicShell`, `PortalShell`, `ConsoleShell` - with their language switch wired
to the locale cookie. A server page cannot hand a function to a client component, so the wiring lives
here, once, and a page passes only serialisable props.

`PublicShell` also replaces R1's default footer links (/help, /privacy, /contact, /legal) with the portal's own
pages through `routes`: help and contact SCR-PUB-12, privacy its privacy journey, legal SCR-PUB-10. RightOne ID's
stand-ins (`brand`) and the inspector's field client (`variant="field"`) draw no footer: the first are another
service's pages, and the inspector is not admitted to the public help journey. A page may still pass `links`.

    use-locale-switch.ts   writes the cookie and asks the router to render again
    premises-nav.ts        the premises portal's seven nav items, with the current one marked
    org-nav.ts             the organisation portal's sections in the boards' order, the seventh drawn on the PTY boards
    artist-nav.ts          the artist portal's sections that have screens: the artist's engagement and where their
                           works were used
    ops-nav.ts             the gateway's consoles (Vận hành, Chính sách, Giám sát) and the workspaces each
                           member's roles open; a workspace shows once its landing page exists
    OpsFrame.tsx           every staff page's frame: ConsoleShell with the console, its rail and the member
    GovernanceShell.tsx    shared GOV rail for mandate register/detail, coverage and role assignments;
                           locale switching and dialogs for search, queue and unavailable destinations
