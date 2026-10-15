# packages

| Package | Holds | Also consumed by |
|---|---|---|
| `tokens` | the design tokens, and every documented contrast ratio as a test | `rightone-mobile` |
| `formatting` | money, dates, periods, percentages, identifiers | - |
| `ui` | the four-state contract and the status system | - |

`tokens` is published because the device application needs the same palette and the same type
scale. Publishing it means a colour change reaches the device as a version bump rather than as a
copied hex value that diverges quietly.
