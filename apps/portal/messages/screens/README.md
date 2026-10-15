# screens

One catalogue pair per family of screens, `<area>.vi.json` and `<area>.en.json`, keyed
`<screen>.<name>` (for example `reg01.title`). A screen builds its translator from its own pair, so two
families never edit the same file, and `test/messages.test.ts` checks every pair has the same keys and
no empty message.

The wording comes from the design canvas boards, word for word in both locales: the canvas is where it
was reviewed. A refusal's sentence comes from the family's refusal catalogue, also word for word.

Besides the families: `page.*` holds the application's own pages (the error boundary, not found, the
reserved surfaces, the Player section) and `ds.*` the `/design-system` gallery.
