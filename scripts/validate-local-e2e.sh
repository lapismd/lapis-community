#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
validation_tmp=$(mktemp -d /tmp/lapis-registry-local-e2e.XXXXXX)
trap 'rm -rf "${validation_tmp}"' EXIT

"${repo_root}/scripts/local-stack.sh" config --format json \
  >"${validation_tmp}/compose.json"

jq -e '
  . as $compose |
  (.services | keys) == [
    "postgres",
    "registry-community",
    "registry-console",
    "registry-fixture",
    "registry-official-a",
    "registry-official-b",
    "registry-official-c",
    "registry-service"
  ] and
  .services["registry-fixture"].build.dockerfile ==
    "services/registry-local-fixture/Dockerfile" and
  .services["registry-console"].build.dockerfile ==
    "apps/registry-console/Dockerfile" and
  (["registry-official-a", "registry-official-b", "registry-official-c", "registry-community"] |
    all(.[];
      . as $service |
      ($compose.services[$service] | has("build") | not) and
      $compose.services[$service].image == "nostr-relay-grain:local" and
      any($compose.services[$service].volumes[];
        .type == "bind" and
        .target == "/home/grain/.grain/config.yml" and
        .read_only == true))) and
  .services["registry-fixture"].read_only == true and
  .services["registry-console"].read_only == true and
  .services["registry-fixture"].depends_on["registry-service"].condition ==
    "service_healthy" and
  .services["registry-console"].depends_on["registry-fixture"].condition ==
    "service_healthy" and
  (["registry-official-a", "registry-official-b", "registry-official-c"] |
    all(.[];
      . as $service |
      $compose.services[$service].environment.GRAIN_PROFILE == "registry-official" and
      any($compose.services[$service].volumes[];
        .type == "bind" and
        .target == "/home/grain/.grain/whitelist.yml" and
        .read_only == true))) and
  .services["registry-community"].environment.GRAIN_PROFILE ==
    "registry-community" and
  any(.services["registry-fixture"].volumes[];
    .type == "bind" and
    .target == "/workspace/lapis-plugins" and
    .read_only == true) and
  any(.services["registry-fixture"].volumes[];
    .type == "bind" and
    .target == "/run/lapis-registry/fixture-secrets.json" and
    .read_only == true)
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

echo "Local end-to-end Compose configuration validation passed."
