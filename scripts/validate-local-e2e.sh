#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
validation_tmp=$(mktemp -d "/tmp/lapis-registry-compose.XXXXXX")
trap 'rm -rf "${validation_tmp}"' EXIT

if [[ $# -ne 0 ]]; then
  echo "usage: validate-local-e2e.sh" >&2
  exit 2
fi

"${repo_root}/scripts/local-stack.sh" config --format json >"${validation_tmp}/compose.json"

jq -e '
  .services | keys == [
    "postgres",
    "registry-fixture",
    "registry-materializer",
    "registry-relay",
    "registry-site",
    "registry-site-builder"
  ]
' "${validation_tmp}/compose.json" >/dev/null

jq -e \
  --arg secret_file "${repo_root}/.local/registry-fixture/fixture-secrets.json" \
  --arg reader_secret_file "${repo_root}/.local/registry-fixture/materializer-reader.key" '
  . as $compose |
  $compose.services["registry-relay"].image == "lapis-relay:local" and
  ($compose.services["registry-relay"].build.context | endswith("/nostr-relay")) and
  $compose.services["registry-relay"].environment.GROUPS_ADMIN_CREATE_ONLY == "true" and
  $compose.services["registry-relay"].environment.GROUPS_PRIVATE_ADMIN_ONLY == "true" and
  ($compose.services["registry-relay"].environment.BLOSSOM_PUBLIC_URL |
    startswith("http://registry.localhost:")) and
  $compose.services["registry-fixture"].read_only == true and
  $compose.services["registry-site"].read_only == true and
  $compose.services["registry-fixture"].depends_on["registry-relay"].condition ==
    "service_healthy" and
  $compose.services["registry-materializer"].depends_on["registry-fixture"].condition ==
    "service_healthy" and
  $compose.services["registry-site-builder"].depends_on["registry-materializer"].condition ==
    "service_completed_successfully" and
  $compose.services["registry-site"].depends_on["registry-site-builder"].condition ==
    "service_completed_successfully" and
  any($compose.services["registry-fixture"].volumes[];
    .type == "bind" and .target == "/workspace/lapis-plugins" and .read_only == true) and
  any($compose.services["registry-fixture"].volumes[];
    .type == "bind" and .source == $secret_file and
    .target == "/run/lapis-registry/fixture-secrets.json" and .read_only == true) and
  any($compose.services["registry-materializer"].volumes[];
    .type == "bind" and .source == $reader_secret_file and
    .target == "/run/lapis-registry/materializer-reader.key" and .read_only == true) and
  $compose.services["registry-materializer"].environment.REGISTRY_READER_SECRET_FILE ==
    "/run/lapis-registry/materializer-reader.key" and
  ($compose.services["registry-materializer"].environment.BLOSSOM_URL |
    startswith("http://registry.localhost:")) and
  ($compose.services["registry-materializer"].environment.REGISTRY_RELAYS |
    startswith("ws://registry.localhost:")) and
  $compose.services["registry-site-builder"].environment.LAPIS_REGISTRY_SOURCE_DIR ==
    "/projection/registry"
' "${validation_tmp}/compose.json" >/dev/null

if rg -q '"keys"[[:space:]]*:' "${validation_tmp}/compose.json"; then
  echo "Rendered Compose configuration contains fixture secret material" >&2
  exit 1
fi

secret_file="${repo_root}/.local/registry-fixture/fixture-secrets.json"
reader_secret_file="${repo_root}/.local/registry-fixture/materializer-reader.key"
for secret_file in "${secret_file}" "${reader_secret_file}"; do
  secret_mode=$(stat -f '%Lp' "${secret_file}" 2>/dev/null || stat -c '%a' "${secret_file}")
  [[ ${secret_mode} == 600 ]] || {
    echo "Secret file ${secret_file} mode is ${secret_mode}; expected 600" >&2
    exit 1
  }
done

echo "Local Nostr registry Compose configuration validation passed."
