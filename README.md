# rightone-web

The RightOne web surfaces: public verification, the premises portal, the artist portal, the rights
organisation portal and the operations console. Next.js 16, React 19.

Five audiences with different authority and very different needs, one design system, one set of
rules. Every directory carries a `README.md`. Start with `scripts/bootstrap`.

```
rightone-web/
├── apps/portal/       one Next.js application, five surfaces as route groups
│   ├── app/(public)/ (premises)/ (artist)/ (org)/ (ops)/
│   │   (id)/ (inspector)/ (dev)/   demo stand-ins, the inspector, review pages
│   ├── lib/           api seams, mock data, routes, i18n, theme
│   ├── components/    the design system R1 (generated), shells, shared presentation
│   ├── features/      server actions and the client pieces of each domain
│   └── messages/      vi and en catalogues
├── packages/
│   ├── tokens/        design tokens, with every documented contrast ratio asserted
│   ├── formatting/    money, dates, periods, identifiers - the only place they are rendered
│   └── ui/            the four-state contract and the status system
├── e2e/ docs/ scripts/
```

## One application, not five

The five surfaces share authentication, the design system and the formatting layer, and route
groups give each its own layout. Splitting them into five deployments buys isolation nobody has
asked for and costs a shared session. That changes only when one surface needs infrastructure
isolation the others do not - the operations console is the first candidate, and it is not one yet.

## Three rules that are enforced rather than described

**Four states, always.** Every view that loads data implements loading, empty, error and
populated. The empty state says *which kind* of empty it is, because in this product "no data" is
usually a governed outcome - no accepted evidence yet for this period, no payable obligation - and
not a gap. A failure never renders as an empty result: telling a premises it has no evidence when
the evidence service is down is a claim about their business rather than an admission about ours.

**One formatting layer.** Money, dates, periods, percentages and identifiers are rendered in
`@rightone/formatting` and nowhere else (R23.7). The rule that earns it: an unknown amount renders
as `-`, never as `0` and never as blank, because a blank where an amount belongs reads as zero, and
zero and unknown are different facts on every finance screen here.

**Messages come from error codes.** Never from parsing `detail` (R23.8), so the same failure reads
correctly in both locales and a wording change on the server is not a breaking change here.

## Accessibility is a gate, not a review note

WCAG 2.2 AA. Public verification is used by inspectors in the field and by members of the public;
the operations console is used for six hours a day. Both make contrast, target size and keyboard
operation functional requirements.

Every documented contrast ratio in the design brief is asserted in `packages/tokens/test`, so a
token change that breaks one fails the build. The pair with almost no margin - muted text on a
sunken panel, 4.51 against a 4.5 gate - is asserted individually, because it is the one that fails
first if the neutral scale is retuned.

## Depends on rightone-api

The HTTP contract, the error codes and `@rightone/api-client` are published from `rightone-api`.
The client is not wired yet - the `@rightone` registry is not live - so `lib/api/` holds seams that
return a failure rather than pretending to have data.

## Everyday commands

    scripts/bootstrap    install dependencies
    scripts/lint         everything CI checks statically
    scripts/test         the test suites
    scripts/ci           exactly what CI runs

## Commit messages, and the hooks that check them

Every commit carries a Conventional Commits header scoped to a surface, a package or a shared
scope, and a trailing `Refs: R1-<number>` naming its JIRA issue - conventions.md §7 in
`rightone-platform`. Name the branch `<type>/R1-<number>-<description>` and the key is copied into
each commit for you:

    feat/R1-305-revoked-certificate

    feat(public): show a revoked certificate as revoked, with its date

    Refs: R1-305

The two hooks that do this are in `.githooks/`. Enable them once per clone:

    git config core.hooksPath .githooks

`prepare-commit-msg` copies the key from the branch name; `commit-msg` refuses a message that
breaks the rule, and needs Python 3.9 or newer. The rule and the closed scope set live in
`scripts/check-commit-msg.py`:

    python3 scripts/check-commit-msg.py --list-scopes              the closed scope set
    python3 scripts/check-commit-msg.py --range origin/main..HEAD  a branch, as CI will check it
