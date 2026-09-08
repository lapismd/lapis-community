#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture_dir="${repo_root}/.local/registry-fixture"
fixture_env="${fixture_dir}/fixture.env"
relay_env="${fixture_dir}/lapis-relay.env"
forge_env="${fixture_dir}/lapis-forge.env"
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
  pnpm --dir "${repo_root}" build >/dev/null
  node "${repo_root}/dist/fixture/init.js" \
    --output "${fixture_dir}" >/dev/null
fi

export REGISTRY_FIXTURE_SECRETS_FILE="${fixture_dir}/fixture-secrets.json"
export REGISTRY_READER_SECRET_FILE="${reader_secret}"
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

if [[ ! -f ${forge_env} ]] ||
  ! rg -q '^LAPIS_WALGIT_RELAY_TOKEN=[0-9a-f]{64}$' "${forge_env}" ||
  ! rg -q '^LAPIS_WALGIT_WEBHOOK_SECRET=[0-9a-f]{64}$' "${forge_env}" ||
  ! rg -q '^LAPIS_RUSTFS_ACCESS_KEY=[0-9a-f]{64}$' "${forge_env}" ||
  ! rg -q '^LAPIS_RUSTFS_SECRET_KEY=[0-9a-f]{64}$' "${forge_env}"; then
  umask 077
  {
    printf 'LAPIS_WALGIT_RELAY_TOKEN=%s\n' "$(openssl rand -hex 32)"
    printf 'LAPIS_WALGIT_WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'LAPIS_RUSTFS_ACCESS_KEY=%s\n' "$(openssl rand -hex 32)"
    printf 'LAPIS_RUSTFS_SECRET_KEY=%s\n' "$(openssl rand -hex 32)"
  } >"${forge_env}"
fi
chmod 600 "${forge_env}"

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
  --env-file "${forge_env}"
  -f "${repo_root}/deploy/local.compose.yml"
)

command=${1:-up}
[[ $# -eq 0 ]] || shift
case "${command}" in
  up)
    "${compose[@]}" pull postgres rustfs create-walgit-bucket
    "${compose[@]}" up -d --build "$@"
    echo "Rendered registry: http://localhost:${REGISTRY_SITE_PORT:-4321}/"
    echo "Fixture status:   http://127.0.0.1:${REGISTRY_FIXTURE_PORT:-8090}/status.json"
    echo "Registry relay:   ws://registry.localhost:${LAPIS_RELAY_PORT:-8281}"
    echo "Project forge:    enabled behind the Registry relay"
    ;;
  down)
    "${compose[@]}" down --remove-orphans "$@"
    ;;
  reset)
    "${compose[@]}" down --volumes --remove-orphans "$@"
    rm -f "${fixture_env}" "${REGISTRY_FIXTURE_SECRETS_FILE}" "${reader_secret}" "${relay_env}" "${forge_env}"
    ;;
  config | logs | port | ps | restart | stop)
    "${compose[@]}" "${command}" "$@"
    ;;
  *)
    echo "usage: local-stack.sh {up|down|reset|config|logs|port|ps|restart|stop} [args...]" >&2
    exit 2
    ;;
esac
