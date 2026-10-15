# scripts

| Script | Does |
|---|---|
| `bootstrap` | install dependencies |
| `install` | `pnpm install` with a time limit and retries; Jenkins uses it, because a download on the build host can stall for good |
| `lint` | eslint, tsc, the acceptance-criteria binding and the README gate |
| `test` | every package and the portal |
| `ci` | lint, build, test - exactly what CI runs |
| `check-ac-titles.mjs` | every `AC-FR-` tag in a test file sits in an `it` or `test` title (rightone-api ADR-0016); `lint` runs it |
| `check-commit-msg.py` | a commit message follows conventions.md §7; the `commit-msg` hook runs it, and CI will with `--range` |

`scripts/ci` passing locally means the build passes.
