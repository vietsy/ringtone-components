# @rightone/formatting

Every money amount, date, period, percentage and identifier in the product is rendered here. R23.7
bans an inline `toLocaleString` elsewhere.

The reason is not tidiness. Each of these carries a correctness rule that gets forgotten the moment
it depends on someone remembering:

- An unknown amount renders `-`, never `0` and never blank. A blank where an amount belongs reads
  as zero, and zero means "calculated, and it came to nothing" while unknown means "not
  calculated". A premises disputing a fee, and the officer answering them, need to tell those apart.
- A date is never numeric-only: `09/07/2026` is July in one country and September in another, and
  this product is read by overseas rights organisations.
- A timestamp carries its offset, in a form that survives a photocopy.
- A period states both ends, so whether the last day is included is not in doubt.
- A percentage states its basis when the basis is not obvious.

A count is the deliberate exception: zero renders as `0`, because "none, and we counted" is what
the reader needs.
