#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture_dir="${repo_root}/.local/registry-fixture"
fixture_env="${fixture_dir}/fixture.env"
profile=single

if [[ ${1:-} == "--quorum" ]]; then
  profile=quorum
  shift
fi

resolve_directory() {
  configured=$1
  shift
  if [[ -n ${configured} ]]; then
    if [[ ! -d ${configured} ]]; then
      echo "Configured directory does not exist: ${configured}" >&2
      exit 1
    fi
    (cd "${configured}" && pwd)
    return
  fi
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
  ! rg -q '^REGISTRY_OFFICIAL_PUBKEYS=' "${fixture_env}" ||
  ! rg -q '^LAPIS_MEMBERSHIP_ADMIN_PUBKEYS=' "${fixture_env}"; then
  pnpm --dir "${repo_root}" --filter @lapismd/registry-local-fixture build >/dev/null
  node "${repo_root}/services/registry-local-fixture/dist/init.js" \
    --output "${fixture_dir}" >/dev/null
fi

lapis_plugins_path=$(resolve_directory \
  "${LAPIS_PLUGINS_PATH:-}" \
  "${repo_root}/../lapis-plugins")
plugin_registry_path=$(resolve_directory \
  "${PLUGIN_REGISTRY_PATH:-}" \
  "${repo_root}/../plugin-registry")
nostr_relay_context=$(resolve_directory \
  "${NOSTR_RELAY_CONTEXT:-}" \
  "${repo_root}/../nostr-relay-registry" \
  "${repo_root}/../nostr-relay")
if [[ ! -f ${nostr_relay_context}/deploy/grain/Dockerfile ||
  ! -f ${nostr_relay_context}/lapis-relay/cmd/lapis-relay/main.go ]]; then
  echo "The resolved nostr-relay workspace has no embedded Grain Lapis relay" >&2
  exit 1
fi

grain_version=$(sed -n 's/^GRAIN_VERSION=//p' \
  "${nostr_relay_context}/deploy/versions.env")
if [[ -z ${grain_version} ]]; then
  echo "The resolved nostr-relay workspace does not pin GRAIN_VERSION" >&2
  exit 1
fi

export LAPIS_PLUGINS_PATH=${lapis_plugins_path}
export PLUGIN_REGISTRY_PATH=${plugin_registry_path}
export NOSTR_RELAY_CONTEXT=${nostr_relay_context}
export GRAIN_VERSION=${GRAIN_VERSION:-${grain_version}}
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-lapis-registry-${profile}}

compose=(
  docker compose
  --project-name "${COMPOSE_PROJECT_NAME}"
  --env-file "${repo_root}/deploy/.env.example"
  --env-file "${fixture_env}"
  -f "${repo_root}/deploy/local.compose.yml"
  -f "${repo_root}/deploy/local-${profile}.compose.yml"
)

if [[ ${profile} == quorum ]]; then
  relay_services=(
    registry-official-a
    registry-official-b
    registry-official-c
    registry-community
  )
else
  relay_services=(registry-relay)
fi

wait_for_relay_health() {
  local service=$1
  local container_id
  local container_status
  local health_status

  for _ in $(seq 1 120); do
    container_id=$("${compose[@]}" ps --all -q "${service}")
    if [[ -n ${container_id} ]]; then
      container_status=$(docker inspect --format '{{.State.Status}}' "${container_id}")
      health_status=$(docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "${container_id}")
      if [[ ${health_status} == healthy ]]; then
        return 0
      fi
      if [[ ${container_status} == exited || ${container_status} == dead ]]; then
        echo "${service} stopped before becoming healthy" >&2
        return 1
      fi
    fi
    sleep 1
  done

  echo "Timed out waiting for ${service} to become healthy" >&2
  return 1
}

command=${1:-up}
if [[ $# -gt 0 ]]; then shift; fi
case "${command}" in
  up)
    docker build \
      --tag "${LAPIS_RELAY_IMAGE:-nostr-relay-lapis:local}" \
      --target lapis-runtime \
      --build-arg "GRAIN_VERSION=${GRAIN_VERSION}" \
      --file "${nostr_relay_context}/deploy/grain/Dockerfile" \
      "${nostr_relay_context}"
    # Bring the native nostrdb processes to health before Compose evaluates
    # dependencies. On Docker Desktop a brand-new LMDB volume can require an
    # automatic relay restart; starting dependants in the same transaction
    # makes Compose fail that recoverable first boot immediately.
    "${compose[@]}" up -d --no-deps "${relay_services[@]}"
    for relay_service in "${relay_services[@]}"; do
      wait_for_relay_health "${relay_service}"
    done
    "${compose[@]}" up -d --build "$@"
    echo "Rendered registry: http://localhost:${REGISTRY_SITE_PORT:-4321}/"
    echo "Registry console: http://localhost:${REGISTRY_CONSOLE_PORT:-4173}/"
    echo "Fixture status:   http://127.0.0.1:${REGISTRY_FIXTURE_PORT:-8090}/status.json"
    if [[ ${profile} == quorum ]]; then
      echo "Official relays:  ws://127.0.0.1:${LAPIS_RELAY_A_PORT:-8281}, ws://127.0.0.1:${LAPIS_RELAY_B_PORT:-8282}, ws://127.0.0.1:${LAPIS_RELAY_C_PORT:-8283}"
      echo "Community relay:  ws://127.0.0.1:${LAPIS_COMMUNITY_RELAY_PORT:-8381}"
    else
      echo "Registry relay:   ws://127.0.0.1:${LAPIS_RELAY_PORT:-8281}"
    fi
    ;;
  down)
    "${compose[@]}" down --remove-orphans "$@"
    ;;
  reset)
    "${compose[@]}" down --volumes --remove-orphans "$@"
    rm -f "${fixture_dir}/fixture.env" "${fixture_dir}/fixture-secrets.json"
    ;;
  config | logs | port | ps | restart | stop)
    "${compose[@]}" "${command}" "$@"
    ;;
  *)
    echo "usage: local-stack.sh [--quorum] {up|down|reset|config|logs|port|ps|restart|stop} [args...]" >&2
    exit 2
    ;;
esac
