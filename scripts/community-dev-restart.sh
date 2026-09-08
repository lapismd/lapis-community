#!/usr/bin/env bash
# Replace this checkout's Community Vite lane with a fresh supervised server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec env COMMUNITY_DEV_REPLACE=1 node "$ROOT/scripts/community-dev-run.mjs" --open
