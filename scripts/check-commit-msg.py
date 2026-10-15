#!/usr/bin/env python3
"""Check commit messages against the RightOne commit convention (conventions.md §7).

    python3 scripts/check-commit-msg.py .git/COMMIT_EDITMSG          what the commit-msg hook runs
    python3 scripts/check-commit-msg.py --range origin/main..HEAD    every commit in a range, for CI
    python3 scripts/check-commit-msg.py --list-scopes                the closed scope set

The shape:

    <type>(<scope>)[!]: <description>

    [body]

    Refs: R1-<number>[, R1-<number>...]

`type` is a Conventional Commits type. `scope` is required and comes from a closed set: the parts
this repository is built from, plus a few scopes for work that belongs to none of them. A free-text
scope cannot answer "what changed in public verification over the last two years"; a closed one
used from the first commit can, and history cannot be rewritten later to make it so. Adding a
scope is a reviewed change to this file (conventions.md §7).

`Refs: R1-<number>` is required, as a trailer - a line in the last paragraph. It is the join key
between a commit and its JIRA issue (jira-and-ci-integration.md §1): the Development panel on an
issue is filled only from a key in a branch name, a commit message or a pull request title. The
prepare-commit-msg hook copies the key from a branch named `<type>/R1-<number>-<description>`, so an
author who names the branch once never types it.

Exempt from the Refs trailer, because a person did not write the message:

- merges, and the commits git writes for `git revert` (`Merge ...`, `Revert "..."`), plus
  `fixup!`, `squash!` and `amend!` commits, which exist only until an interactive rebase. The
  whole message is exempt, not only the trailer: git decides its format.
- a Conventional `revert(<scope>): ...`. The key belongs to the commit being reverted, which the
  body names by hash.
- `chore(deps): ...` written by dependabot - recognised by its author in `--range` mode and by its
  `Signed-off-by: dependabot[bot]` trailer otherwise. Dependabot opens its own pull requests and
  has no issue to cite.

These may say `Refs: none`, or leave the trailer out. Nothing else may: a person upgrading a
dependency by hand works on an issue like any other change (`chore/R1-88-upgrade-efcore`).

Exit status: 0 conforms, 1 does not, 2 the check itself could not run.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class CannotCheck(Exception):
    """The check could not run - exit 2, never a pass."""


# --------------------------------------------------------------------------------------------------
# What differs between rightone-api, rightone-web and rightone-mobile is this block. Everything
# below the next rule is the same in all three repositories; keep it so, and a fix lands in all
# three or in none.
# --------------------------------------------------------------------------------------------------

REPOSITORY = "rightone-web"


def owned_scopes() -> dict[str, str]:
    """One scope per surface and per package: the parts of this repository a change belongs to.

    The five surfaces are route groups of one application (README.md, "One application, not
    five"), so a change to one of them is scoped to the surface and not to the application.
    """
    return {
        "public": "public verification, apps/portal/app/(public)",
        "premises": "the premises portal, apps/portal/app/(premises)",
        "artist": "the artist portal, apps/portal/app/(artist)",
        "org": "the rights organisation portal, apps/portal/app/(org)",
        "ops": "the operations console, apps/portal/app/(ops)",
        "portal": "apps/portal outside any one surface: layout, lib/, components/, messages/",
        "tokens": "design tokens, packages/tokens",
        "formatting": "money, dates, periods and identifiers, packages/formatting",
        "ui": "the four-state contract and the status system, packages/ui",
    }


# Work that belongs to no surface or package. `architecture` is the one scope this repository's
# history used before the check existed; the rest each name work that will take commits of its own.
# Kept narrow on purpose: a scope that could mean anything answers nothing.
SHARED_SCOPES = {
    "architecture": "docs/architecture",
    "e2e": "e2e/: journeys, accessibility and performance against a real page",
    "quality": "gates: scripts/lint, the hooks, eslint and tsc configuration",
    "ci": "the pipeline definition",
    "deps": "dependency versions and lockfiles",
    "docs": "documentation outside docs/architecture",
}

EXAMPLES = (
    "feat(public): show a revoked certificate as revoked, with its date",
    "fix(formatting): render an unknown amount as a dash, never as zero",
    "docs(architecture): the view-state contract and its four states",
)

# --------------------------------------------------------------------------------------------------

TYPES = {"feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore",
         "revert"}
MAX_HEADER = 100
MIN_DESCRIPTION = 10

HEADER = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]*)\))?(?P<bang>!)?: (?P<description>.*)$")
GIT_WRITTEN = re.compile(r'^(Merge |Revert "|fixup! |squash! |amend! )')
REFS_LINE = re.compile(r"^Refs:(?P<value>.*)$")
REFS_VALUE = re.compile(r"R1-[1-9]\d*(?:\s*,\s*R1-[1-9]\d*)*")
ADDED_TRAILER = re.compile(r"^(Refs|Signed-off-by|Co-authored-by):", re.IGNORECASE)
DEPENDABOT = re.compile(r"dependabot\[bot\]")
SCISSORS = re.compile(r"^# -+ >8 -+$")


def scopes() -> dict[str, str]:
    owned = owned_scopes()
    clash = sorted(set(owned) & set(SHARED_SCOPES))
    if clash:
        raise CannotCheck(f"a scope is both owned and shared: {', '.join(clash)}")
    return {**owned, **SHARED_SCOPES}


def content_lines(message: str) -> list[str]:
    """The message as git will store it: comments and everything below the scissors removed."""
    kept = []
    for line in message.splitlines():
        if SCISSORS.match(line):
            break
        if not line.startswith("#"):
            kept.append(line.rstrip())
    while kept and not kept[0].strip():
        kept.pop(0)
    while kept and not kept[-1].strip():
        kept.pop()
    return kept


def paragraphs(lines: list[str]) -> list[list[str]]:
    found, current = [], []
    for line in lines:
        if line.strip():
            current.append(line)
        elif current:
            found.append(current)
            current = []
    if current:
        found.append(current)
    return found


def check(message: str, author: str = "", known: dict[str, str] | None = None) -> list[str]:
    known = scopes() if known is None else known
    lines = content_lines(message)
    blocks = paragraphs(lines)

    if not blocks or all(ADDED_TRAILER.match(line) for line in lines if line.strip()):
        # Only trailers left is what an abandoned message looks like once the prepare-commit-msg
        # hook has added `Refs:` to it. Git would store it; refuse it as the empty message it is.
        return ["the message is empty (a trailer on its own is not a message)"]

    header = lines[0]
    if GIT_WRITTEN.match(header):
        return []

    errors = []
    if len(blocks[0]) > 1:
        errors.append("the first paragraph is more than one line; leave a blank line after the "
                      "header, or git joins the lines into one subject")
    if len(header) > MAX_HEADER:
        errors.append(f"the header is {len(header)} characters; the limit is {MAX_HEADER}")

    match = HEADER.match(header)
    if not match:
        errors.append("the header is not `<type>(<scope>): <description>`")
        return errors

    kind, scope, description = match.group("type"), match.group("scope"), match.group("description")
    if kind not in TYPES:
        errors.append(f"type `{kind}` is not one of: {', '.join(sorted(TYPES))}")
    if scope is None or not scope.strip():
        errors.append("a scope is required: the part of this repository the change belongs to "
                      "(--list-scopes prints the set)")
    elif scope not in known:
        errors.append(f"scope `{scope}` is not in {REPOSITORY}'s closed set (--list-scopes "
                      f"prints it); a new scope is a reviewed change to "
                      f"scripts/check-commit-msg.py")
    if description != description.strip() or not description:
        errors.append("the description is empty or has stray spaces around it")
    elif description.endswith("."):
        errors.append("the description ends with a full stop; a header is a title, not a sentence")
    elif len(description) < MIN_DESCRIPTION:
        errors.append(f"the description is {len(description)} characters; say what changed, not "
                      f"only where")

    trailers = blocks[-1] if len(blocks) > 1 else []
    refs = [REFS_LINE.match(line) for line in trailers]
    refs = [r.group("value").strip() for r in refs if r]
    exempt = kind == "revert" or (
        kind == "chore" and scope == "deps"
        and (DEPENDABOT.search(author) or any(
            line.startswith("Signed-off-by:") and DEPENDABOT.search(line) for line in trailers)))

    if not refs:
        if any(REFS_LINE.match(line) for block in blocks[:-1] for line in block) or (
                len(blocks) == 1 and any(REFS_LINE.match(line) for line in blocks[0])):
            errors.append("`Refs:` is not in the trailer block; put it in the last paragraph, "
                          "after a blank line")
        elif not exempt:
            errors.append("no trailing `Refs: R1-<number>` line. Name the branch "
                          "`<type>/R1-<number>-<description>` and the prepare-commit-msg hook "
                          "writes it for you")
    for value in refs:
        if value == "none":
            if not exempt:
                errors.append("`Refs: none` is only for merges, reverts and dependabot's "
                              "`chore(deps)`; name the R1 issue this change answers")
        elif not REFS_VALUE.fullmatch(value):
            errors.append(f"`Refs: {value}` is not `R1-<number>` or a comma-separated list of "
                          f"them")
    return errors


def commits(revisions: str) -> list[tuple[str, str, str]]:
    result = subprocess.run(
        ["git", "log", "--format=%H%x1f%an <%ae>%x1f%B%x1e", revisions],
        cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        # Without this, a mistyped range reads as "every commit conforms".
        raise CannotCheck(f"git log {revisions} failed: {result.stderr.strip()}")
    found = []
    for record in result.stdout.split("\x1e"):
        if record.strip():
            sha, author, body = record.lstrip("\n").split("\x1f", 2)
            found.append((sha, author, body))
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("path", nargs="?", help="the file holding the commit message")
    parser.add_argument("--range", dest="revisions",
                        help="check every commit git log lists for this, e.g. origin/main..HEAD")
    parser.add_argument("--list-scopes", action="store_true", help="print the closed scope set")
    args = parser.parse_args()

    try:
        known = scopes()
    except (OSError, CannotCheck) as error:
        print(f"check-commit-msg: {error}", file=sys.stderr)
        return 2

    if args.list_scopes:
        width = max(len(scope) for scope in known)
        for scope, meaning in known.items():
            print(f"{scope:<{width}}  {meaning}")
        return 0

    if args.revisions:
        try:
            found = commits(args.revisions)
        except CannotCheck as error:
            print(f"check-commit-msg: {error}", file=sys.stderr)
            return 2
        failed = 0
        for sha, author, body in found:
            errors = check(body, author, known)
            if errors:
                failed += 1
                subject = (content_lines(body) or [""])[0]
                print(f"\n{sha[:8]}  {subject[:88]}", file=sys.stderr)
                for error in errors:
                    print(f"    {error}", file=sys.stderr)
        passed = len(found) - failed
        print(f"\n{REPOSITORY}: {passed} of {len(found)} commits in {args.revisions} conform "
              f"to conventions.md §7", file=sys.stderr if failed else sys.stdout)
        return 1 if failed else 0

    if not args.path:
        parser.error("give the message file, or --range")
    try:
        message = pathlib.Path(args.path).read_text(encoding="utf-8", errors="replace")
    except OSError as error:
        print(f"check-commit-msg: {error}", file=sys.stderr)
        return 2
    errors = check(message, known=known)
    if not errors:
        return 0

    print("The commit message does not follow conventions.md §7:", file=sys.stderr)
    for error in errors:
        print(f"  - {error}", file=sys.stderr)
    print("\nFor example:\n", file=sys.stderr)
    for example in EXAMPLES:
        print(f"  {example}", file=sys.stderr)
    print(f"\n  Refs: R1-241\n\nYour message is kept in {args.path}.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
