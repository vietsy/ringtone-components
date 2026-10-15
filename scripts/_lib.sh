#!/usr/bin/env bash
# Shared helpers. Sourced by the other scripts; not run directly.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1  ($2)" >&2; exit 1; }; }
say() { printf '\n== %s\n' "$*"; }
