# Mandate Detail route

Thin adapter for `features/mandate/detail/MandateDetailPage.tsx`.
With `RIGHTONE_DATA=mock`, review `/ops/governance/mandates/appa?view=submitted` and
`view=loading|empty|error`, combined with `frame=phone|tablet`.
Unknown IDs return not-found. Locale follows the shell's VI/EN switch.
