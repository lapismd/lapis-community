#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture_dir="${repo_root}/.local/registry-fixture"
fixture_env="${fixture_dir}/fixture.env"

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

if [[ ! -f ${fixture_env} ||
  ! -f ${fixture_dir}/fixture-secrets.json ||
  ! -f ${fixture_dir}/official-whitelist.yml ]]; then
  pnpm --dir "${repo_root}" --filter @lapismd/registry-local-fixture build >/dev/null
  node "${repo_root}/services/registry-local-fixture/dist/init.js" \
    --output "${fixture_dir}" >/dev/null
fi

lapis_plugins_path=$(resolve_directory \
  "${LAPIS_PLUGINS_PATH:-}" \
  "${repo_root}/../lapis-plugins")
nostr_relay_context=$(resolve_directory \
  "${NOSTR_RELAY_CONTEXT:-}" \
  "${repo_root}/../nostr-relay" \
  "${repo_root}/../nostr-relay-registry")
if [[ ! -f ${nostr_relay_context}/deploy/grain/profiles/registry-official/config.yml ]]; then
  fallback="${repo_root}/../nostr-relay-registry"
  if [[ -f ${fallback}/deploy/grain/profiles/registry-official/config.yml ]]; then
    nostr_relay_context=$(cd "${fallback}" && pwd)
  else
    echo "The resolved nostr-relay workspace has no registry Grain profiles" >&2
    exit 1
  fi
fi

export LAPIS_PLUGINS_PATH=${lapis_plugins_path}
export NOSTR_RELAY_CONTEXT=${nostr_relay_context}
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-lapis-registry-e2e}

compose=(
  docker compose
  --project-name "${COMPOSE_PROJECT_NAME}"
  --env-file "${repo_root}/deploy/.env.example"
  --env-file "${fixture_env}"
  -f "${repo_root}/deploy/local.compose.yml"
  -f "${repo_root}/deploy/local-e2e.compose.yml"
)

command=${1:-up}
if [[ $# -gt 0 ]]; then shift; fi
case "${command}" in
  up)
    grain_build=(
      docker build
      --tag "${GRAIN_IMAGE:-nostr-relay-grain:local}"
      --build-arg "GRAIN_VERSION=${GRAIN_VERSION:-c0709db6e59d57620ba2053c7078b1e07942d38c}"
      --file "${nostr_relay_context}/deploy/grain/Dockerfile"
    )
    if [[ -n ${IMAGE_PLATFORM:-} ]]; then
      grain_build+=(--platform "${IMAGE_PLATFORM}")
    fi
    "${grain_build[@]}" "${nostr_relay_context}"
    "${compose[@]}" up -d --build "$@"
    echo "Registry console: http://localhost:${REGISTRY_CONSOLE_PORT:-4173}/"
    echo "Registry API:     http://127.0.0.1:${REGISTRY_SERVICE_PORT:-8787}/"
    echo "Fixture status:   http://127.0.0.1:${REGISTRY_FIXTURE_PORT:-8090}/status.json"
    ;;
  down)
    "${compose[@]}" down --remove-orphans "$@"
    ;;
  reset)
    "${compose[@]}" down --volumes --remove-orphans "$@"
    rm -f \
      "${fixture_dir}/fixture.env" \
      "${fixture_dir}/fixture-secrets.json" \
      "${fixture_dir}/official-whitelist.yml"
    ;;
  config | logs | port | ps | restart | stop)
    "${compose[@]}" "${command}" "$@"
    ;;
  *)
    echo "usage: local-stack.sh {up|down|reset|config|logs|port|ps|restart|stop} [args...]" >&2
    exit 2
    ;;
esac
