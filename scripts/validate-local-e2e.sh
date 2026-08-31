#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
validation_tmp=$(mktemp -d /tmp/lapis-registry-local-e2e.XXXXXX)
trap 'rm -rf "${validation_tmp}"' EXIT

profile=single
stack=("${repo_root}/scripts/local-stack.sh")
if [[ ${1:-} == "--quorum" ]]; then
  profile=quorum
  stack+=(--quorum)
  shift
fi
if [[ $# -ne 0 ]]; then
  echo "usage: validate-local-e2e.sh [--quorum]" >&2
  exit 2
fi

"${stack[@]}" config --format json >"${validation_tmp}/compose.json"

jq -e --arg profile "${profile}" '
  . as $compose |
  .services["registry-fixture"].build.dockerfile ==
    "services/registry-local-fixture/Dockerfile" and
  .services["registry-console"].build.dockerfile ==
    "apps/registry-console/Dockerfile" and
  .services["registry-fixture"].read_only == true and
  .services["registry-console"].read_only == true and
  .services["registry-console"].depends_on["registry-fixture"].condition ==
    "service_healthy" and
  any(.services["registry-fixture"].volumes[];
    .type == "bind" and
    .target == "/workspace/lapis-plugins" and
    .read_only == true) and
  any(.services["registry-fixture"].volumes[];
    .type == "bind" and
    .target == "/run/lapis-registry/fixture-secrets.json" and
    .read_only == true) and
  ([.services[] | select(.image == "nostr-relay-strfry-registry:local")] | length) ==
    (if $profile == "quorum" then 4 else 1 end) and
  ([.services[] | select(.image == "nostr-relay-strfry-registry:local") |
    any(.volumes[];
      .type == "bind" and
      .target == "/app/strfry.conf" and
      .read_only == true)] | all) and
  (.services | has("postgres") | not) and
  (.services | has("registry-service") | not) and
  ([.services[].environment // {} | has("DATABASE_URL")] | any | not) and
  (if $profile == "quorum" then
    (.services | keys) == [
      "registry-community",
      "registry-console",
      "registry-fixture",
      "registry-official-a",
      "registry-official-b",
      "registry-official-c"
    ] and
    .services["registry-fixture"].environment.REGISTRY_PUBLISH_QUORUM == "2" and
    .services["registry-console"].environment.REGISTRY_PUBLISH_QUORUM == "2"
  else
    (.services | keys) == ["registry-console", "registry-fixture", "registry-relay"] and
    .services["registry-fixture"].environment.REGISTRY_PUBLISH_QUORUM == "1" and
    .services["registry-console"].environment.REGISTRY_PUBLISH_QUORUM == "1"
  end)
' "${validation_tmp}/compose.json" >/dev/null

if rg -q '"keys"[[:space:]]*:' "${validation_tmp}/compose.json"; then
  echo "Rendered Compose configuration contains fixture secret material" >&2
  exit 1
fi

secret_file="${repo_root}/.local/registry-fixture/fixture-secrets.json"
if [[ ! -f ${secret_file} ]]; then
  echo "Fixture secret file was not generated" >&2
  exit 1
fi
secret_mode=$(stat -f '%Lp' "${secret_file}" 2>/dev/null || stat -c '%a' "${secret_file}")
if [[ ${secret_mode} != 600 ]]; then
  echo "Fixture secret file mode is ${secret_mode}; expected 600" >&2
  exit 1
fi

echo "Local ${profile} strfry Compose configuration validation passed."
