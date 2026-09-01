#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture_dir="${repo_root}/.local/registry-fixture"
fixture_env="${fixture_dir}/fixture.env"
relay_env="${fixture_dir}/lapis-relay.env"
relay_flavor=${REGISTRY_RELAY_FLAVOR:-buzz}
if [[ ${relay_flavor} != buzz && ${relay_flavor} != lapis ]]; then
  echo "REGISTRY_RELAY_FLAVOR must be buzz or lapis" >&2
  exit 2
fi

resolve_directory() {
  local configured=$1
  shift
  if [[ -n ${configured} ]]; then
    [[ -d ${configured} ]] || { echo "Configured directory does not exist: ${configured}" >&2; exit 1; }
    (cd "${configured}" && pwd)
    return
  fi
  local candidate
  for candidate in "$@"; do
    if [[ -d ${candidate} ]]; then
      (cd "${candidate}" && pwd)
      return
    fi
  done
  echo "Could not resolve a required sibling workspace" >&2
  exit 1
}

if [[ ! -f ${fixture_env} || ! -f ${fixture_dir}/fixture-secrets.json ]] ||
  ! rg -q '^REGISTRY_PUBLISHER_PUBKEY=' "${fixture_env}" ||
  ! rg -q '^REGISTRY_FIXTURE_CREATED_AT=' "${fixture_env}"; then
  pnpm --dir "${repo_root}" --filter @lapismd/registry-local-fixture... build >/dev/null
  node "${repo_root}/services/registry-local-fixture/dist/init.js" \
    --output "${fixture_dir}" >/dev/null
fi

# The generated environment records an absolute path. Always override it with
# the current checkout so moving or renaming this workspace cannot make Docker
# create a directory at the stale source path.
export REGISTRY_FIXTURE_SECRETS_FILE="${fixture_dir}/fixture-secrets.json"

if [[ ${relay_flavor} == lapis ]]; then
  operator_secret=$(jq -er '.keys.operator | select(test("^[0-9a-f]{64}$"))' \
    "${fixture_dir}/fixture-secrets.json")
  operator_pubkey=$(awk -F= '$1 == "REGISTRY_OPERATOR_PUBKEYS" { print $2 }' \
    "${fixture_env}")
  [[ ${operator_pubkey} =~ ^[0-9a-f]{64}$ ]] || {
    echo "Fixture operator pubkey is invalid" >&2
    exit 1
  }
  umask 077
  printf "LAPIS_RELAY_SECRET=%s\nLAPIS_RELAY_ADMIN_PUBKEYS='\"%s\"'\n" \
    "${operator_secret}" "${operator_pubkey}" >"${relay_env}"
  chmod 600 "${relay_env}"
fi

export LAPIS_PLUGINS_PATH
LAPIS_PLUGINS_PATH=$(resolve_directory "${LAPIS_PLUGINS_PATH:-}" "${repo_root}/../lapis-plugins")
export PLUGIN_REGISTRY_PATH
PLUGIN_REGISTRY_PATH=$(resolve_directory "${PLUGIN_REGISTRY_PATH:-}" "${repo_root}/../nostr-plugin-registry")
if [[ ${relay_flavor} == lapis ]]; then
  export LAPIS_RELAY_PATH
  LAPIS_RELAY_PATH=$(resolve_directory "${LAPIS_RELAY_PATH:-}" "${repo_root}/../nostr-relay")
fi
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-lapis-registry-${relay_flavor}}

relay_compose="${repo_root}/deploy/local-single.compose.yml"
relay_env_args=()
if [[ ${relay_flavor} == lapis ]]; then
  relay_compose="${repo_root}/deploy/local-lapis-relay.compose.yml"
  relay_env_args=(--env-file "${relay_env}")
fi

compose=(
  docker compose
  --project-name "${COMPOSE_PROJECT_NAME}"
  --env-file "${repo_root}/deploy/.env.example"
  --env-file "${fixture_env}"
  "${relay_env_args[@]}"
  -f "${repo_root}/deploy/local.compose.yml"
  -f "${relay_compose}"
)

wait_for_health() {
  local service=$1
  local container_id status health
  for _ in $(seq 1 180); do
    container_id=$("${compose[@]}" ps --all -q "${service}")
    if [[ -n ${container_id} ]]; then
      status=$(docker inspect --format '{{.State.Status}}' "${container_id}")
      health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")
      [[ ${health} == healthy ]] && return 0
      if [[ ${status} == exited || ${status} == dead ]]; then
        echo "${service} stopped before becoming healthy" >&2
        return 1
      fi
    fi
    sleep 1
  done
  echo "Timed out waiting for ${service}" >&2
  return 1
}

refresh_fixture_clock_for_unseeded_relay() {
  if [[ ${relay_flavor} != buzz ]]; then
    return
  fi
  local registry_event_count fresh_created_at temporary_env
  registry_event_count=$("${compose[@]}" exec -T postgres \
    psql -U buzz -d buzz -tAc \
    "SELECT count(*) FROM events WHERE kind = 9 AND deleted_at IS NULL AND tags @> '[[\"t\", \"lapis-plugin-release\"]]'::jsonb;" \
    | tr -d '[:space:]')
  if [[ ${registry_event_count} != 0 ]]; then
    return
  fi

  fresh_created_at=$(($(date +%s) - 300))
  temporary_env=$(mktemp "${fixture_env}.XXXXXX")
  awk -v created_at="${fresh_created_at}" '
    /^REGISTRY_FIXTURE_CREATED_AT=/ {
      print "REGISTRY_FIXTURE_CREATED_AT=" created_at
      next
    }
    { print }
  ' "${fixture_env}" >"${temporary_env}"
  chmod 600 "${temporary_env}"
  mv "${temporary_env}" "${fixture_env}"
}

command=${1:-up}
[[ $# -eq 0 ]] || shift
case "${command}" in
  up)
    if [[ ${relay_flavor} == buzz ]]; then
      "${compose[@]}" pull registry-relay postgres redis minio minio-init
      "${compose[@]}" up -d registry-relay
    else
      "${compose[@]}" pull postgres
      "${compose[@]}" up -d --build registry-relay
    fi
    wait_for_health registry-relay
    refresh_fixture_clock_for_unseeded_relay
    "${compose[@]}" up -d --build "$@"
    echo "Rendered registry: http://localhost:${REGISTRY_SITE_PORT:-4321}/"
    echo "Fixture status:   http://127.0.0.1:${REGISTRY_FIXTURE_PORT:-8090}/status.json"
    echo "Registry relay:   ws://registry.localhost:${LAPIS_RELAY_PORT:-8281} (${relay_flavor})"
    ;;
  down)
    "${compose[@]}" down --remove-orphans "$@"
    ;;
  reset)
    "${compose[@]}" down --volumes --remove-orphans "$@"
    rm -f "${fixture_dir}/fixture.env" "${fixture_dir}/fixture-secrets.json" "${relay_env}"
    ;;
  config | logs | port | ps | restart | stop)
    "${compose[@]}" "${command}" "$@"
    ;;
  *)
    echo "usage: local-stack.sh {up|down|reset|config|logs|port|ps|restart|stop} [args...]" >&2
    exit 2
    ;;
esac
