#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
validation_tmp=$(mktemp -d /tmp/lapis-registry-deploy.XXXXXX)
trap 'rm -rf "${validation_tmp}"' EXIT

docker compose \
  --env-file "${repo_root}/deploy/.env.example" \
  -f "${repo_root}/deploy/local.compose.yml" \
  config --format json >"${validation_tmp}/local.json"

REGISTRY_SERVICE_IMAGE=registry-service@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
DATABASE_URL=postgresql://registry:placeholder@postgres.example/registry \
REGISTRY_PUBLIC_BASE_URL=https://registry.example/ \
REGISTRY_CONSOLE_ORIGINS=https://console.registry.example/ \
REGISTRY_APPROVAL_KIND=64010 \
REGISTRY_REVOCATION_KIND=64011 \
REGISTRY_SNAPSHOT_KIND=64012 \
REGISTRY_ASSESSOR_PUBKEYS=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
REGISTRY_CURATOR_PUBKEYS=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \
REGISTRY_MODERATOR_PUBKEYS=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc \
REGISTRY_SNAPSHOT_SIGNER_PUBKEYS=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd \
REGISTRY_OPERATOR_PUBKEYS=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee \
docker compose \
  -f "${repo_root}/deploy/production.compose.yml" \
  config --format json >"${validation_tmp}/production.json"

jq -e '
  (.services | keys) == ["postgres", "registry-service"] and
  .services.postgres.image ==
    "postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94" and
  .services["registry-service"].build.dockerfile ==
    "services/registry-service/Dockerfile" and
  .services["registry-service"].environment.REGISTRY_USE_TEST_KINDS == "true"
' "${validation_tmp}/local.json" >/dev/null

jq -e '
  (.services | keys) == ["registry-service"] and
  (.services["registry-service"] | has("build") | not) and
  (.services["registry-service"].environment | has("REGISTRY_USE_TEST_KINDS") | not) and
  .services["registry-service"].environment.REGISTRY_CONSOLE_ORIGINS ==
    "https://console.registry.example/" and
  .services["registry-service"].environment.NODE_ENV == "production"
' "${validation_tmp}/production.json" >/dev/null

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck "${repo_root}/scripts/"*.sh
fi

if docker buildx version >/dev/null 2>&1; then
  docker buildx build --check \
    --file "${repo_root}/services/registry-service/Dockerfile" \
    "${repo_root}"
fi

echo "Registry service deployment validation passed."
