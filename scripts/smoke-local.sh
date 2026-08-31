#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project_name=${COMPOSE_PROJECT_NAME:-lapis-registry-local-smoke-$$}
preview_headers=""
compose=(
  docker compose
  --project-name "${project_name}"
  --env-file "${repo_root}/deploy/.env.example"
  -f "${repo_root}/deploy/local.compose.yml"
)

export POSTGRES_PORT=0
export REGISTRY_SERVICE_PORT=0

cleanup() {
  exit_code=$?
  trap - EXIT
  if [[ -n ${preview_headers} ]]; then
    rm -f "${preview_headers}"
  fi
  if [[ ${exit_code} -ne 0 ]]; then
    "${compose[@]}" ps || true
    "${compose[@]}" logs --no-color --tail=200 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap cleanup EXIT

"${compose[@]}" up -d --build

for _ in $(seq 1 120); do
  container_id=$("${compose[@]}" ps -q registry-service)
  if [[ -n ${container_id} ]]; then
    health=$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")
    if [[ ${health} == healthy ]]; then
      break
    fi
    if [[ ${health} == unhealthy ]]; then
      echo "registry-service became unhealthy" >&2
      exit 1
    fi
  fi
  sleep 1
done

published_port=$("${compose[@]}" port registry-service 8787 | awk -F: '{print $NF}')
if [[ -z ${published_port} ]]; then
  echo "could not resolve registry service port" >&2
  exit 1
fi

/usr/bin/curl -fsS "http://127.0.0.1:${published_port}/health" |
  jq -e '.status == "ok"' >/dev/null

preview_headers=$(mktemp)
/usr/bin/curl -fsS -D "${preview_headers}" \
  "http://127.0.0.1:${published_port}/preview/v1/index.json" |
  jq -e '.schemaVersion == 1 and .plugins == []' >/dev/null
tr -d '\r' <"${preview_headers}" |
  grep -qi '^x-lapis-registry-unsigned: true$'
tr -d '\r' <"${preview_headers}" |
  grep -Eqi '^x-lapis-registry-root: [0-9a-f]{64}$'
rm -f "${preview_headers}"
preview_headers=""

echo "Registry service local container smoke passed."
