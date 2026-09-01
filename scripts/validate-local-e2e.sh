#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
relay_flavor=${REGISTRY_RELAY_FLAVOR:-buzz}
validation_tmp=$(mktemp -d "/tmp/lapis-registry-${relay_flavor}-compose.XXXXXX")
trap 'rm -rf "${validation_tmp}"' EXIT

if [[ $# -ne 0 ]]; then
  echo "usage: validate-local-e2e.sh" >&2
  exit 2
fi

"${repo_root}/scripts/local-stack.sh" config --format json >"${validation_tmp}/compose.json"

if [[ ${relay_flavor} == buzz ]]; then
  jq -e '
    .services | keys == [
      "minio",
      "minio-init",
      "postgres",
      "redis",
      "registry-fixture",
      "registry-materializer",
      "registry-relay",
      "registry-site",
      "registry-site-builder"
    ]
  ' "${validation_tmp}/compose.json" >/dev/null

  jq -e '
  . as $compose |
  (.services["registry-relay"].image |
    startswith("ghcr.io/block/buzz@sha256:")) and
  ($compose.services["registry-relay"].environment.RELAY_URL |
    startswith("ws://registry.localhost:")) and
  $compose.services["registry-relay"].environment.BUZZ_REQUIRE_AUTH_TOKEN == "false" and
  $compose.services["registry-relay"].environment.BUZZ_REQUIRE_RELAY_MEMBERSHIP == "false" and
  $compose.services["registry-relay"].environment.BUZZ_AUTO_MIGRATE == "true" and
  $compose.services["registry-relay"].environment.BUZZ_RATE_LIMIT_HUMAN_MESSAGES_PER_MIN == "5000" and
  $compose.services["registry-relay"].environment.BUZZ_RATE_LIMIT_HUMAN_WS_EVENTS_PER_SEC == "500" and
  ([
    $compose.services | to_entries[] |
    select(.value.environment.DATABASE_URL? != null) |
    .key
  ] == ["registry-relay"]) and
  ([
    $compose.services | to_entries[] |
    select(.value.environment.REDIS_URL? != null) |
    .key
  ] == ["registry-relay"]) and
  ($compose.services | has("registry-service") | not) and
  ($compose.services | has("registry-community") | not)
  ' "${validation_tmp}/compose.json" >/dev/null
else
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

  jq -e '
    . as $compose |
    $compose.services["registry-relay"].image == "lapis-relay:local" and
    ($compose.services["registry-relay"].build.context | endswith("/nostr-relay")) and
    ($compose.services["registry-relay"].environment.RELAY_HOST |
      startswith("registry.localhost:")) and
    $compose.services["registry-relay"].environment.POLICY_OPEN == "true" and
    $compose.services["registry-relay"].environment.POLICY_PUBLIC_JOIN == "true" and
    $compose.services["registry-relay"].environment.GROUPS_ADMIN_CREATE_ONLY == "true" and
    $compose.services["registry-relay"].environment.GROUPS_PRIVATE_ADMIN_ONLY == "true" and
    ($compose.services["registry-relay"].environment.BLOSSOM_PUBLIC_URL |
      startswith("http://registry.localhost:")) and
    $compose.services["registry-relay"].depends_on.postgres.condition ==
      "service_healthy" and
    ([
      $compose.services | to_entries[] |
      select(.value.environment.DATABASE_URL? != null) |
      .key
    ] == ["registry-relay"]) and
    ([
      $compose.services | to_entries[] |
      select(.value.environment.REDIS_URL? != null) |
      .key
    ] == []) and
    ($compose.services | has("registry-service") | not)
  ' "${validation_tmp}/compose.json" >/dev/null
fi

jq -e --arg secret_file "${repo_root}/.local/registry-fixture/fixture-secrets.json" '
  .services["registry-fixture"].build.dockerfile ==
    "services/registry-local-fixture/Dockerfile" and
  .services["registry-site-builder"].build.dockerfile == "Dockerfile.local" and
  .services["registry-fixture"].read_only == true and
  .services["registry-fixture"].environment.REGISTRY_FIXTURE_LONG_THREAD_POSTS == "240" and
  .services["registry-site"].read_only == true and
  .services["registry-fixture"].depends_on["registry-relay"].condition ==
    "service_healthy" and
  .services["registry-materializer"].depends_on["registry-fixture"].condition ==
    "service_healthy" and
  .services["registry-site-builder"].depends_on["registry-materializer"].condition ==
    "service_completed_successfully" and
  .services["registry-site"].depends_on["registry-site-builder"].condition ==
    "service_completed_successfully" and
  any(.services["registry-fixture"].volumes[];
    .type == "bind" and
    .target == "/workspace/lapis-plugins" and
    .read_only == true) and
  any(.services["registry-fixture"].volumes[];
    .type == "bind" and
    .source == $secret_file and
    .target == "/run/lapis-registry/fixture-secrets.json" and
    .read_only == true) and
  (.services["registry-materializer"].environment.REGISTRY_BUZZ_RELAYS |
    startswith("ws://registry.localhost:")) and
  .services["registry-site-builder"].environment.LAPIS_REGISTRY_BACKEND == "buzz"
' "${validation_tmp}/compose.json" >/dev/null

if rg -q 'nostr-relay-lapis|registry-official-|GRAIN_|LAPIS_MEMBERSHIP_' \
  "${validation_tmp}/compose.json"; then
  echo "Rendered Compose configuration contains a retired custom-relay path" >&2
  exit 1
fi

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

echo "Local ${relay_flavor} Compose configuration validation passed."
