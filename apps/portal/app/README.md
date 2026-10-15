# app

The router. One directory per route group, each with its own layout.

`layout.tsx` sets `lang` from the reader's locale (the `r1-locale` cookie), emits the design tokens as CSS
custom properties, so a hex value exists in exactly one place, loads the R1 component stylesheet, and in mock
mode says at the foot of every page that its data is sample data. `error.tsx` is the last-resort boundary and
states what failed, whether retrying is worthwhile, and the digest support can search for.

| Route group | Pages | Screens |
|---|---|---|
| `(public)` | `/`, `/scope`, `/indicative-amount`, `/verify`, `/verify/[reference]` | SCR-PUB-01 to 05 |
| `(id)` | `/id/sign-in`, `/id/register`, `/id/confirm-email`, `/id/choose-organisation`, `/id/sign-out` | SCR-RID-01, 07, 08, 04 (stand-ins for RightOne ID); signing out |
| `(premises)` | `/registration/**`, `/decisions/[decision]` | SCR-REG-01 to 08 |
| | `/payments`, `/payments/[decision]`, `/payments/[decision]/pay` | SCR-FIN-03, 02, 01 |
| | `/status-records`, `/status-records/[record]`, `.../print` | SCR-CER-11, 12, 13 |
| | `/player` | reserved |
| `(inspector)` | `/field/**` | SCR-VER-17, 01 to 06 (the field client) |
| | `/inspection/lists`, `/inspection/lists/[list]` | SCR-VER-07, 08 (the console) |
| `(org)` | `/org` (landing), `/org/mandate`, `/org/terms` | SCR-GOV-14, 15 |
| | `/org/participation`, `/org/participation/apply`, `/org/participation/amend`, `/org/objections/new` | SCR-CAT-02, 01, 03, 25 |
| | `/org/submissions/**`, `/org/claims/**` | SCR-CAT-04, 05, 24, 07 |
| | `/org/verify`, `/org/verify/overlaps` | SCR-PTY-17, 18 (refused to a CMO) |
| `(artist)`, `(ops)` | one page each | reserved |
| `(dev)` | `/design-system` | every R1 component (mock mode only) |

Every path is built in `lib/routes.ts`; a page links only through it. Every page of `(premises)`,
`(inspector)` and `(org)` asks `lib/api/session.ts` first and sends a reader without the right session to sign in.
