#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
validation_tmp=$(mktemp -d /tmp/lapis-registry-deploy.XXXXXX)
trap 'rm -rf "${validation_tmp}"' EXIT

REGISTRY_CONSOLE_IMAGE=registry-console@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
REGISTRY_OFFICIAL_RELAYS=wss://one.registry.example/,wss://two.registry.example/ \
REGISTRY_COMMUNITY_RELAYS=wss://community.registry.example/ \
REGISTRY_PUBLISH_QUORUM=2 \
REGISTRY_APPROVAL_KIND=64010 \
REGISTRY_MODERATION_DECISION_KIND=64013 \
REGISTRY_REVOCATION_KIND=64011 \
REGISTRY_SNAPSHOT_KIND=64012 \
REGISTRY_RATING_KIND=64014 \
REGISTRY_SECURITY_ADVISORY_KIND=64015 \
REGISTRY_SECURITY_DISPOSITION_KIND=64016 \
REGISTRY_ASSESSOR_PUBKEYS=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
REGISTRY_CURATOR_PUBKEYS=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \
REGISTRY_MODERATOR_PUBKEYS=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc \
REGISTRY_SNAPSHOT_SIGNER_PUBKEYS=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd \
REGISTRY_OPERATOR_PUBKEYS=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee \
REGISTRY_SECURITY_ADVISORY_PUBKEYS=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff \
REGISTRY_SECURITY_DISPOSITION_PUBKEYS=1111111111111111111111111111111111111111111111111111111111111111 \
docker compose \
  -f "${repo_root}/deploy/production.compose.yml" \
  config --format json >"${validation_tmp}/production.json"

jq -e '
  (.services | keys) == ["registry-console"] and
  (.services["registry-console"] | has("build") | not) and
  .services["registry-console"].read_only == true and
  (.services["registry-console"].environment | has("DATABASE_URL") | not) and
  (.services["registry-console"].environment | has("REGISTRY_USE_TEST_KINDS") | not) and
  .services["registry-console"].environment.REGISTRY_OFFICIAL_RELAYS ==
    "wss://one.registry.example/,wss://two.registry.example/" and
  .services["registry-console"].environment.REGISTRY_PUBLISH_QUORUM == "2" and
  .services["registry-console"].environment.REGISTRY_RATING_KIND == "64014" and
  .services["registry-console"].environment.REGISTRY_SECURITY_ADVISORY_KIND == "64015" and
  .services["registry-console"].environment.NODE_ENV == "production"
' "${validation_tmp}/production.json" >/dev/null

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck "${repo_root}/scripts/"*.sh
fi

if docker buildx version >/dev/null 2>&1; then
  docker buildx build --check \
    --file "${repo_root}/apps/registry-console/Dockerfile" \
    "${repo_root}"
fi

echo "Stateless registry console deployment validation passed."
