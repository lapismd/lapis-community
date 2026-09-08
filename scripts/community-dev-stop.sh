#!/usr/bin/env bash
# Stop this checkout's Community Vite supervisor and descendants.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/scripts/community-dev-process.mjs" stop
