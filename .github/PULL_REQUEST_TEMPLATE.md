<!--
How to fill this in: review-standard 3, https://docs.rightone.vn/00-governance/delivery/01-process/03-review-standard#_3-2-recording-it

Result is one of:
  Pass       checked, and it holds. Evidence is something the reviewer can open:
             file:line, a test name, command output, a commit.
  N/A        cannot apply. Give the reason in one line.
  Exception  applies and does not hold, on purpose. Give the reason, and who agreed
             where a rule requires agreement (for example a 400-line exception).

A whole group that cannot apply - to this repository, or to this change, as B to G for a
change to documentation only - is marked N/A once, on its group row.
Each Evidence cell starts as [give: ...], naming what to give; replace it. Leave no row blank.
A Pass the reviewer disproves is a finding against the self-review itself (RV-15).
Put the link to the Self-review heading of this description in the ticket's Self-review field.
-->

**Ticket:** R1-
**Tier:** T-A / T-B / T-C / T-D
**Design note:** [link; required for M, L, XL, T-A and T-B]
**Base:** `main` [or, if stacked: the branch below, why, and the merge order]
**Reviewers:** [peer]; [Lead or Architect as well, for T-A and T-B]

## What changed

<!-- One paragraph. A reviewer with no context can follow it. -->

## Why

<!-- The problem being solved. Link the item, the FR, and the ADR if there is one. -->

## Risk

<!-- What could break? Evidence, certificates, money, keys, migrations, contracts? -->

## How it was verified

<!-- Which tests cover it and what you exercised by hand. Paste the results. -->

```
scripts/ci            pass / fail
unit and component    total   failed   skipped
accessibility (axe)   violations
end-to-end            total   failed   skipped    (main journeys only)
bundle budget         [size] of [budget]
coverage report       [path]
```

## How to roll back

<!-- If it fails in production, what happens? Feature flag? Can the previous image be redeployed as it is? -->

## Contract

- [ ] No contract change consumed
- [ ] A new version of `@rightone/contracts` is consumed: [version], and every new refusal code has a message (SR-K3)

## Screens

<!-- SR-K1 and SR-K2. One screenshot or test per state; delete rows for a change with no screen. -->

| State | Screenshot or test |
|---|---|
| Loading | |
| Empty, governed | |
| Empty, broken | |
| Error | |
| Populated | |
| Keyboard and focus | |

## Self-review

<!-- The checklist is https://docs.rightone.vn/00-governance/delivery/01-process/03-review-standard#_3-1-the-checklist -->

| ID | Check | Result | Evidence |
|---|---|---|---|
| **A** | **Scope and requirement** | | |
| SR-A1 | Read every document the work item lists before writing code | | [give: The documents and the sections compared] |
| SR-A2 | Every line of the work item's `acceptance:` maps to where it is met | | [give: Each line, then file:line or test name] |
| SR-A3 | Nothing unrelated to this item; work another item owns is named | | [give: "None", or the list] |
| SR-A4 | What waits on another item is listed under Deferred to integration, not marked Blocked | | [give: The *Deferred to integration* section] |
| SR-A5 | Every gap in the specification asked on the ticket; no default invented (Article 3.1(c)) | | [give: Link to the comment] |
| **B** | **Faithful to the specification** | | |
| SR-B1 | Every refusal code in the contract produced and tested; none outside it | | [give: Each code, then the test] |
| SR-B2 | Every permitted transition tested; one forbidden transition refused from each state | | [give: Test names] |
| SR-B3 | Every row of each decision table exercised, evaluation order included | | [give: Test names] |
| SR-B4 | Evaluation instant is a parameter: no clock read, no `current_date` or `now()` (R1.11) | | [give: Search result] |
| SR-B5 | No business figure written as a constant (R5.2) | | [give: Each figure and its source] |
| SR-B6 | Request and response match the contract field by field | | [give: Field-by-field comparison] |
| SR-B7 | No closed record edited in place; a correction is a linked new record | | [give: Test or file:line] |
| **C** | **Code an assistant drafted** | | |
| SR-C1 | Read every line as if someone else wrote it | | [give: The number of changes made after reading] |
| SR-C2 | Description, commit messages and comments say what the code does | | [give: Each claim checked against the diff] |
| SR-C3 | No invented method, package or API; every new dependency deliberate | | [give: Packages added, and why] |
| SR-C4 | Tests fail when the logic is broken on purpose (say what you broke) | | [give: One or two deliberate breaks, and which tests failed] |
| SR-C5 | Segregation, RLS, grants, money and concurrency code checked by hand | | [give: The parts checked by hand] |
| SR-C6 | No licensed code reproduced from training data | | [give: nothing beyond the result] |
| **E** | **Security within the item's scope** | | |
| SR-E1 | No personal data or internal key beyond the contract; new personal-data field in the inventory | | [give: Fields returned] |
| SR-E2 | No secret, credential or real personal data in code, logs, tests, fixtures | | [give: Local secret scan] |
| SR-E3 | Every read scoped to the organisation; no org or actor id trusted from the caller where a trusted source exists | | [give: file:line] |
| SR-E4 | Preparer refused when approving, inside the writing transaction (R4.3) | | [give: Test name] |
| SR-E5 | No endpoint mapped before sign-in and the authority check exist | | [give: The *Deferred to integration* section] |
| **F** | **Tests** | | |
| SR-F1 | Every `AC-` on the ticket is a tagged, passing test | | [give: Each AC, then the test] |
| SR-F2 | Every applicable mandatory negative test (testing-standard §5) | | [give: Each row of §5 that applies, then the test] |
| SR-F3 | Boundaries tested at the boundary | | [give: Test names] |
| SR-F4 | Integration and acceptance against real PostgreSQL, zero skipped (total / failed / skipped) | | [give: `total / failed / skipped`] |
| SR-F5 | Independent of order and machine clock; two runs agree | | [give: Both results] |
| SR-F6 | Every `alt` and `break` branch of the sequence diagram has a test | | [give: Branch, then test] |
| SR-F7 | Coverage report from the same run as the tests | | [give: The report path] |
| **G** | **Code quality** | | |
| SR-G1 | No debug statement, commented-out code, TODO without an item number, temporary credential | | [give: Search result] |
| SR-G2 | No swallowed exception or over-broad catch; database errors translated to their codes | | [give: file:line] |
| SR-G3 | Retries idempotent; concurrent writes guarded, with a test | | [give: Test names] |
| SR-G4 | Names from the specification; this repository's conventions | | [give: nothing beyond the result] |
| SR-G5 | No business rule stated twice; comments say why | | [give: nothing beyond the result] |
| SR-G6 | Build clean with warnings as errors; lint clean | | [give: Command output] |
| **H** | **Contract, documentation, diagrams** | | |
| SR-H1 | Contract and error codes match the code; CHANGELOG updated; compatibility check passes | | [give: `oasdiff` output] |
| SR-H2 | Generated client regenerated and committed | | [give: nothing beyond the result] |
| SR-H3 | READMEs updated, including what is deliberately absent | | [give: Files] |
| SR-H4 | Diagrams regenerated or updated where R27.11 applies | | [give: Diagram names] |
| SR-H5 | Design note updated if the shape changed | | [give: Link] |
| **I** | **Pull request and Git** | | |
| SR-I1 | `scripts/ci` passes locally (until `gate.py` exists) | | [give: Summary of the run] |
| SR-I2 | At most 400 hand-written changed lines, or a labelled exception; generated counted apart | | [give: Hand-written and generated counts] |
| SR-I3 | Targets `main`; if stacked, why and the merge order | | [give: Base branch] |
| SR-I4 | The five sections above are complete, including how to roll back | | [give: The sections] |
| SR-I5 | Every commit message carries the item key; no unrelated commit | | [give: Commit list] |
| SR-I6 | Rebased onto `main` today | | [give: nothing beyond the result] |
| **J** | **The ticket** | | |
| SR-J1 | Estimate fields recorded before starting; Original Estimate unchanged since | | [give: Ticket link] |
| SR-J2 | Actual effort logged on the days it was spent | | [give: Hours logged] |
| SR-J3 | Status reflects reality: In Review with this PR, not Done before review, not Blocked for another item's work | | [give: Ticket status] |
| SR-J4 | Ticket fields Pull request and Self-review point here | | [give: Ticket link] |
| SR-J5 | Daily reports for these days match git and the ticket | | [give: nothing beyond the result] |
| **K** | **Screens and the Player** | | |
| SR-K1 | Four states; governed-empty differs from broken-empty; a failure never renders as empty | | [give: Screenshot or test of each state] |
| SR-K2 | Keyboard operable, visible focus, axe-core clean, contrast and target size, not colour alone | | [give: `axe-core` output] |
| SR-K3 | Messages from error codes and say how to fix; every string in the catalogue, both locales | | [give: Catalogue keys] |
| SR-K4 | Money, dates, periods, identifiers through the shared formatters; unknown amount renders `-` | | [give: nothing beyond the result] |
| SR-K5 | No token, secret or credential in a client component or the bundle | | [give: nothing beyond the result] |
| SR-K6 | Every visual value from a design token; bundle budget met | | [give: Budget output] |
| **D** | **Data and migration** | N/A | No schema or migration in this repository |

### Found and fixed

<!-- What this self-review caught, and the commit that fixed it. "Nothing found" is an answer; leaving it out is not. -->

### Deferred to integration

<!-- What waits on another item, with its key: route mapping, sign-in, ROLE_NOT_ASSIGNED, audit write. "Nothing deferred" is an answer. -->

