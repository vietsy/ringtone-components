# r1

`tokens.json` is a copy of the RightOne Design System R1's `project/tokens.json`
(https://claude.ai/artifact/7UFbwnuFWCvgVs6JXM8FaD), the one source of tokens (Design Brief
`02-Design-Tokens.md` 1.1). It is kept here so a build never reaches the network.

Refresh it by copying the design system's file over this one, then run
`pnpm --filter @rightone/tokens generate`. Every generated file names the sha256 of the copy it was made
from, so a reader can tell which copy produced the code. The copy of 8 October 2026 has sha256
`5ba427dc5c1b1681…` and carries R1 version 10's `bp-xs`.
