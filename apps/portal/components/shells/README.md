# shells

R1's three shells - `PublicShell`, `PortalShell`, `ConsoleShell` - with their language switch wired
to the locale cookie. A server page cannot hand a function to a client component, so the wiring lives
here, once, and a page passes only serialisable props.

`PublicShell` also empties R1's default footer links (/help, /privacy, /contact, /legal): the portal has
none of those pages, and a footer of links to a 404 is worse than no footer. A page that exists is passed
through `links`.

    use-locale-switch.ts   writes the cookie and asks the router to render again
    premises-nav.ts        the premises portal's seven nav items, with the current one marked
