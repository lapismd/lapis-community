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
  ! rg -q '^REGISTRY_OFFICIAL_PUBKEYS=' "${fixture_env}"; then
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
if [[ ! -f ${nostr_relay_context}/deploy/strfry/Dockerfile ||
  ! -f ${nostr_relay_context}/deploy/strfry/profiles/registry-local.conf ]]; then
  echo "The resolved nostr-relay workspace has no Lapis strfry registry image" >&2
  exit 1
fi

upstream_strfry_image=$(sed -n 's/^STRFRY_IMAGE=//p' \
  "${nostr_relay_context}/deploy/versions.env")
if [[ -z ${upstream_strfry_image} ]]; then
  echo "The resolved nostr-relay workspace does not pin STRFRY_IMAGE" >&2
  exit 1
fi

export LAPIS_PLUGINS_PATH=${lapis_plugins_path}
export PLUGIN_REGISTRY_PATH=${plugin_registry_path}
export NOSTR_RELAY_CONTEXT=${nostr_relay_context}
export STRFRY_IMAGE=${STRFRY_IMAGE:-${upstream_strfry_image}}
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-lapis-registry-${profile}}

compose=(
  docker compose
  --project-name "${COMPOSE_PROJECT_NAME}"
  --env-file "${repo_root}/deploy/.env.example"
  --env-file "${fixture_env}"
  -f "${repo_root}/deploy/local.compose.yml"
  -f "${repo_root}/deploy/local-${profile}.compose.yml"
)

command=${1:-up}
if [[ $# -gt 0 ]]; then shift; fi
case "${command}" in
  up)
    docker build \
      --tag "${STRFRY_REGISTRY_IMAGE:-nostr-relay-strfry-registry:local}" \
      --build-arg "STRFRY_IMAGE=${STRFRY_IMAGE}" \
      --file "${nostr_relay_context}/deploy/strfry/Dockerfile" \
      "${nostr_relay_context}"
    "${compose[@]}" up -d --build "$@"
    echo "Rendered registry: http://localhost:${REGISTRY_SITE_PORT:-4321}/"
    echo "Registry console: http://localhost:${REGISTRY_CONSOLE_PORT:-4173}/"
    echo "Fixture status:   http://127.0.0.1:${REGISTRY_FIXTURE_PORT:-8090}/status.json"
    if [[ ${profile} == quorum ]]; then
      echo "Official relays:  ws://127.0.0.1:${STRFRY_OFFICIAL_A_PORT:-8281}, ws://127.0.0.1:${STRFRY_OFFICIAL_B_PORT:-8282}, ws://127.0.0.1:${STRFRY_OFFICIAL_C_PORT:-8283}"
      echo "Community relay:  ws://127.0.0.1:${STRFRY_COMMUNITY_PORT:-8381}"
    else
      echo "Registry relay:   ws://127.0.0.1:${STRFRY_LOCAL_PORT:-8281}"
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
