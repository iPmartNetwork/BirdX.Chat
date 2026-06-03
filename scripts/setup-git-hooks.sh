#!/usr/bin/env bash
# Point this repo at .githooks/ (run once per clone).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
chmod +x "$root/.githooks/prepare-commit-msg"
git -C "$root" config core.hooksPath .githooks
echo "Git hooks enabled: $root/.githooks"
