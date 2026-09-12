#!/usr/bin/env bash
set -euo pipefail
community_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
relay_root="${LAPIS_RELAY_PATH:-$community_root/../nostr-relay}"
exec "$relay_root/scripts/local-dev.sh" "$@"
