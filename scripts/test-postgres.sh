#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project_name=${COMPOSE_PROJECT_NAME:-lapis-registry-postgres-test-$$}
compose=(
  docker compose
  --project-name "${project_name}"
  --env-file "${repo_root}/deploy/.env.example"
  -f "${repo_root}/deploy/local.compose.yml"
)

export POSTGRES_PORT=0

cleanup() {
  exit_code=$?
  trap - EXIT
  if [[ ${exit_code} -ne 0 ]]; then
    "${compose[@]}" logs --no-color --tail=200 postgres || true
  fi
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap cleanup EXIT

"${compose[@]}" up -d postgres

for _ in $(seq 1 60); do
  container_id=$("${compose[@]}" ps -q postgres)
  if [[ -n ${container_id} ]]; then
    health=$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")
    if [[ ${health} == healthy ]]; then
      break
    fi
    if [[ ${health} == unhealthy ]]; then
      echo "postgres became unhealthy" >&2
      exit 1
    fi
  fi
  sleep 1
done

published_port=$("${compose[@]}" port postgres 5432 | awk -F: '{print $NF}')
if [[ -z ${published_port} ]]; then
  echo "could not resolve Postgres test port" >&2
  exit 1
fi

TEST_DATABASE_URL="postgresql://registry:registry_local_password@127.0.0.1:${published_port}/registry" \
  pnpm --dir "${repo_root}" --filter @lapismd/registry-service test:postgres

