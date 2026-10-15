# Contributing

    scripts/bootstrap
    git config core.hooksPath .githooks
    scripts/ci

## What will be refused in review

- A view that loads data with fewer than four states.
- An empty state that does not say which kind of empty it is.
- A failure rendered as an empty result. Telling a premises it has no evidence when the service is
  down is a claim about their business rather than an admission about ours.
- An inline `toLocaleString`, or any money rendered outside `@rightone/formatting`.
- An unknown amount rendered as `0` or as a blank cell.
- A message built by parsing `detail` instead of rendering from the error code.
- A user-visible string written inline in a component.
- A token, secret or credential in a client component.
- Information conveyed by colour alone.
- A hex value written into a stylesheet instead of a token.

## Language

Everything written by the team is in international English: documentation, comments, identifiers,
commit messages, pull requests and issues.

The message catalogues are the exception, and not an oversight: the product is delivered in
Vietnamese with English as the second locale, so the Vietnamese values there are the product rather
than documentation.
