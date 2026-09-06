#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
command=${1:-up}
[[ $# -eq 0 ]] || shift

case "${command}" in
  test | storybook | storybook-test)
    export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-lapis-community-relay-${PPID}-${RANDOM}}
    ;;
  *)
    export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-lapis-community-relay}
    ;;
esac

[[ ${COMPOSE_PROJECT_NAME} =~ ^[a-z0-9][a-z0-9_-]*$ ]] || {
  echo "COMPOSE_PROJECT_NAME must contain only lowercase letters, numbers, underscores, and hyphens" >&2
  exit 2
}

resolve_relay_path() {
  local configured=${LAPIS_RELAY_PATH:-}
  if [[ -n ${configured} ]]; then
    [[ -f ${configured}/Dockerfile ]] || {
      echo "LAPIS_RELAY_PATH does not contain the relay Dockerfile" >&2
      exit 1
    }
    (cd "${configured}" && pwd)
    return
  fi
  [[ -f ${repo_root}/../nostr-relay/Dockerfile ]] || {
    echo "Could not resolve sibling nostr-relay checkout" >&2
    exit 1
  }
  (cd "${repo_root}/../nostr-relay" && pwd)
}

allocate_port() {
  node --input-type=module -e '
    import net from "node:net";
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") process.exit(1);
      process.stdout.write(String(address.port));
      server.close();
    });
  '
}

runtime_dir=${COMMUNITY_RELAY_RUNTIME_DIR:-${repo_root}/.local/community-relay/${COMPOSE_PROJECT_NAME}}
port_file=${runtime_dir}/port
secret_file=${runtime_dir}/relay-secret
mkdir -p "${runtime_dir}"
chmod 700 "${runtime_dir}"

if [[ -f ${port_file} ]]; then
  COMMUNITY_RELAY_PORT=$(<"${port_file}")
else
  COMMUNITY_RELAY_PORT=${COMMUNITY_RELAY_PORT:-$(allocate_port)}
  printf '%s\n' "${COMMUNITY_RELAY_PORT}" >"${port_file}"
fi
[[ ${COMMUNITY_RELAY_PORT} =~ ^[0-9]+$ ]] || {
  echo "Community relay port is invalid" >&2
  exit 1
}

if [[ ! -f ${secret_file} ]]; then
  umask 077
  openssl rand -hex 32 >"${secret_file}"
fi
chmod 600 "${secret_file}"

export COMMUNITY_RELAY_PORT
export COMMUNITY_RELAY_SECRET_FILE=${secret_file}
export COMMUNITY_RELAY_URL=ws://community-relay.localhost:${COMMUNITY_RELAY_PORT}
export LAPIS_RELAY_PATH
LAPIS_RELAY_PATH=$(resolve_relay_path)

compose=(
  docker compose
  --project-name "${COMPOSE_PROJECT_NAME}"
  -f "${repo_root}/deploy/community-relay.compose.yml"
)

start_relay() {
  "${compose[@]}" pull postgres
  "${compose[@]}" up -d --build --wait
}

seed_relay() {
  COMMUNITY_RELAY_URL=${COMMUNITY_RELAY_URL} \
    COMMUNITY_SCENARIO_NAMESPACE=${COMMUNITY_SCENARIO_NAMESPACE:-seed} \
    pnpm --dir "${repo_root}" exec tsx scripts/seed-community-relay.ts
}

stop_relay() {
  "${compose[@]}" down --volumes --remove-orphans
}

cleanup_ephemeral() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "${port_file}" "${secret_file}"
  rmdir "${runtime_dir}" 2>/dev/null || true
}

case "${command}" in
  up)
    start_relay
    seed_relay
    echo "Community relay ready: ${COMMUNITY_RELAY_URL}"
    ;;
  seed)
    seed_relay
    ;;
  url)
    echo "${COMMUNITY_RELAY_URL}"
    ;;
  test)
    trap cleanup_ephemeral EXIT INT TERM
    start_relay
    seed_relay
    COMMUNITY_RELAY_URL=${COMMUNITY_RELAY_URL} pnpm --dir "${repo_root}" exec vitest run \
      --project unit \
      src/testing/relay-contract.test.ts \
      src/testing/relay-contract.docker.test.ts
    ;;
  storybook)
    trap cleanup_ephemeral EXIT INT TERM
    start_relay
    seed_relay
    VITE_COMMUNITY_RELAY_BACKEND=docker \
      VITE_COMMUNITY_RELAY_URL=${COMMUNITY_RELAY_URL} \
      pnpm --dir "${repo_root}" storybook "$@"
    ;;
  storybook-test)
    trap cleanup_ephemeral EXIT INT TERM
    start_relay
    seed_relay
    VITE_COMMUNITY_RELAY_BACKEND=docker \
      VITE_COMMUNITY_RELAY_URL=${COMMUNITY_RELAY_URL} \
      pnpm --dir "${repo_root}" exec vitest run \
      --project storybook \
      --maxWorkers=1 \
      src/components/community-application/CommunityApplication.stories.svelte \
      src/components/community-workspace/CommunityWorkspace.stories.svelte \
      src/components/registry-community/RegistryCommunity.stories.svelte
    ;;
  down)
    stop_relay
    ;;
  reset)
    stop_relay
    rm -f "${port_file}" "${secret_file}"
    rmdir "${runtime_dir}" 2>/dev/null || true
    echo "Removed the disposable relay volumes and generated runtime credentials."
    ;;
  config | logs | ps | restart | stop)
    "${compose[@]}" "${command}" "$@"
    ;;
  *)
    echo "usage: community-relay.sh {up|seed|url|test|storybook|storybook-test|down|reset|config|logs|ps|restart|stop}" >&2
    exit 2
    ;;
esac
