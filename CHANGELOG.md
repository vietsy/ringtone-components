# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Changed

- **Breaking:** `@rightone/tokens` 2.0.0 is generated from the RightOne Design System R1
  (`packages/tokens/r1/tokens.json`). The portal's root variables are now R1's dark theme, with
  `color-scheme: dark`; the primitive names follow R1's ramps (`n-50` is gone, `navy-50` and the other
  ramps replace it); `THEMES`, `STATUS_BY_THEME` and the scales (`SPACE` to `BACKDROP`, `TYPE_STYLES`)
  are new. `PRIMITIVE`, `SEMANTIC`, `STATUS` and `StatusFamily` keep their names. The package is published
  for rightone-mobile, which does not depend on it yet; when it does, it starts from 2.0.0.

### Added

- `@rightone/tokens` with contrast ratios asserted as tests: since 2.0.0, 48 of the ratios the design system
  R1 states and the five status families on each of its three themes.
- `@rightone/formatting`: the one place money, dates, periods, percentages and identifiers are
  rendered, and the rule that an unknown amount is `-` rather than `0`.
- `@rightone/ui`: the four-state contract, where a failure can never become an empty result, and
  the status system with the five product-specific mappings named individually.
- The portal with all five surfaces as route groups, and public verification worked through all
  four states.
- A message catalogue in both locales, with a test that they carry the same keys.
