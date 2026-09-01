#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture_dir="${repo_root}/.local/registry-fixture"
fixture_env="${fixture_dir}/fixture.env"
relay_env="${fixture_dir}/lapis-relay.env"
reader_secret="${fixture_dir}/materializer-reader.key"

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

if [[ ! -f ${fixture_env} || ! -f ${fixture_dir}/fixture-secrets.json || ! -f ${reader_secret} ]] ||
  ! rg -q '^REGISTRY_PUBLISHER_PUBKEYS=' "${fixture_env}" ||
  ! rg -q '^REGISTRY_FIXTURE_CREATED_AT=' "${fixture_env}"; then
  pnpm --dir "${repo_root}" --filter @lapismd/registry-local-fixture... build >/dev/null
  node "${repo_root}/services/registry-local-fixture/dist/init.js" \
    --output "${fixture_dir}" >/dev/null
fi

export REGISTRY_FIXTURE_SECRETS_FILE="${fixture_dir}/fixture-secrets.json"
operator_secret=$(jq -er '.keys.operator | select(test("^[0-9a-f]{64}$"))' \
  "${REGISTRY_FIXTURE_SECRETS_FILE}")
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

export LAPIS_PLUGINS_PATH
LAPIS_PLUGINS_PATH=$(resolve_directory "${LAPIS_PLUGINS_PATH:-}" "${repo_root}/../lapis-plugins")
export PLUGIN_REGISTRY_PATH
PLUGIN_REGISTRY_PATH=$(resolve_directory "${PLUGIN_REGISTRY_PATH:-}" "${repo_root}/../nostr-plugin-registry")
export LAPIS_RELAY_PATH
LAPIS_RELAY_PATH=$(resolve_directory "${LAPIS_RELAY_PATH:-}" "${repo_root}/../nostr-relay")
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-lapis-registry-local}

compose=(
  docker compose
  --project-name "${COMPOSE_PROJECT_NAME}"
  --env-file "${repo_root}/deploy/.env.example"
  --env-file "${fixture_env}"
  --env-file "${relay_env}"
  -f "${repo_root}/deploy/local.compose.yml"
)

command=${1:-up}
[[ $# -eq 0 ]] || shift
case "${command}" in
  up)
    "${compose[@]}" pull postgres
    "${compose[@]}" up -d --build "$@"
    echo "Rendered registry: http://localhost:${REGISTRY_SITE_PORT:-4321}/"
    echo "Fixture status:   http://127.0.0.1:${REGISTRY_FIXTURE_PORT:-8090}/status.json"
    echo "Registry relay:   ws://registry.localhost:${LAPIS_RELAY_PORT:-8281}"
    ;;
  down)
    "${compose[@]}" down --remove-orphans "$@"
    ;;
  reset)
    "${compose[@]}" down --volumes --remove-orphans "$@"
    rm -f "${fixture_env}" "${REGISTRY_FIXTURE_SECRETS_FILE}" "${reader_secret}" "${relay_env}"
    ;;
  config | logs | port | ps | restart | stop)
    "${compose[@]}" "${command}" "$@"
    ;;
  *)
    echo "usage: local-stack.sh {up|down|reset|config|logs|port|ps|restart|stop} [args...]" >&2
    exit 2
    ;;
esac
