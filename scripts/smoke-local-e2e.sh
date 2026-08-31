#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
profile=single
stack=("${repo_root}/scripts/local-stack.sh")
if [[ ${1:-} == "--quorum" ]]; then
  profile=quorum
  stack+=(--quorum)
  shift
fi
if [[ $# -ne 0 ]]; then
  echo "usage: smoke-local-e2e.sh [--quorum]" >&2
  exit 2
fi

project_name=${COMPOSE_PROJECT_NAME:-lapis-registry-${profile}-smoke-$$}
smoke_tmp=$(mktemp -d /tmp/lapis-registry-e2e-smoke.XXXXXX)
port_base=$((24000 + ($$ % 20000)))

export COMPOSE_PROJECT_NAME=${project_name}
export REGISTRY_FIXTURE_PORT=${REGISTRY_FIXTURE_PORT:-${port_base}}
export REGISTRY_CONSOLE_PORT=${REGISTRY_CONSOLE_PORT:-$((port_base + 1))}
export REGISTRY_SITE_PORT=${REGISTRY_SITE_PORT:-$((port_base + 6))}
export STRFRY_LOCAL_PORT=${STRFRY_LOCAL_PORT:-$((port_base + 2))}
export STRFRY_OFFICIAL_A_PORT=${STRFRY_OFFICIAL_A_PORT:-$((port_base + 2))}
export STRFRY_OFFICIAL_B_PORT=${STRFRY_OFFICIAL_B_PORT:-$((port_base + 3))}
export STRFRY_OFFICIAL_C_PORT=${STRFRY_OFFICIAL_C_PORT:-$((port_base + 4))}
export STRFRY_COMMUNITY_PORT=${STRFRY_COMMUNITY_PORT:-$((port_base + 5))}

report_error() {
  exit_code=$?
  echo "Smoke failed at line ${BASH_LINENO[0]}: ${BASH_COMMAND}" >&2
  return "${exit_code}"
}

cleanup() {
  exit_code=$?
  trap - EXIT
  if [[ ${exit_code} -ne 0 ]]; then
    "${stack[@]}" ps || true
    "${stack[@]}" logs --no-color --tail=250 || true
  fi
  "${stack[@]}" down --volumes >/dev/null 2>&1 || true
  rm -rf "${smoke_tmp}"
  exit "${exit_code}"
}
trap report_error ERR
trap cleanup EXIT

"${stack[@]}" up

wait_for_health() {
  service=$1
  for _ in $(seq 1 180); do
    container_id=$(docker ps --all --quiet \
      --filter "label=com.docker.compose.project=${project_name}" \
      --filter "label=com.docker.compose.service=${service}")
    if [[ -n ${container_id} ]]; then
      health=$(docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "${container_id}")
      if [[ ${health} == healthy ]]; then
        return 0
      fi
      if [[ ${health} == dead || ${health} == unhealthy ]]; then
        echo "${service} became ${health}" >&2
        return 1
      fi
    fi
    sleep 2
  done
  echo "Timed out waiting for ${service} to become healthy" >&2
  return 1
}

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
for service in "${relay_services[@]}" registry-fixture registry-console registry-site; do
  wait_for_health "${service}"
done

fixture_base="http://127.0.0.1:${REGISTRY_FIXTURE_PORT}/"
console_base="http://127.0.0.1:${REGISTRY_CONSOLE_PORT}/"
site_base="http://127.0.0.1:${REGISTRY_SITE_PORT}/"
/usr/bin/curl -fsS "${fixture_base}status.json" >"${smoke_tmp}/status.json"

expected_quorum=1
if [[ ${profile} == quorum ]]; then expected_quorum=2; fi
jq -e --argjson quorum "${expected_quorum}" '
  .pluginCount == 12 and
  .communityEventCount == 6 and
  (.officialEventCount > .communityEventCount) and
  .relayCopies.officialQuorum >= $quorum and
  .relayCopies.community == .communityEventCount and
  (.registryRoot | test("^[0-9a-f]{64}$")) and
  (.communityRoot | test("^[0-9a-f]{64}$")) and
  (.securityRoot | test("^[0-9a-f]{64}$"))
' "${smoke_tmp}/status.json" >/dev/null

/usr/bin/curl -fsS "${console_base}" >"${smoke_tmp}/console.html"
/usr/bin/curl -fsS "${console_base}config.json" >"${smoke_tmp}/config.json"
/usr/bin/curl -fsS "${console_base}assets/main.js" >"${smoke_tmp}/console.js"
jq -e --argjson quorum "${expected_quorum}" '
  .publishQuorum == $quorum and
  (.officialRelays | length) >= $quorum and
  (.communityRelays | length) >= 1 and
  (has("apiBase") | not) and
  (has("database") | not)
' "${smoke_tmp}/config.json" >/dev/null
rg -q 'See what the relays resolve\.' "${smoke_tmp}/console.html"
rg -q 'nostr-relay-quorum' "${smoke_tmp}/console.js"
if rg -q 'NIP-98|/events|DATABASE_URL' "${smoke_tmp}/console.js"; then
  echo "Console bundle still contains the retired HTTP submission path" >&2
  exit 1
fi

/usr/bin/curl -fsS "${site_base}v1/index.json" >"${smoke_tmp}/site-index.json"
/usr/bin/curl -fsS "${site_base}v1/runtime.json" >"${smoke_tmp}/site-runtime.json"
/usr/bin/curl -fsS "${site_base}v1/client/registry-community.js" >"${smoke_tmp}/community.js"
/usr/bin/curl -fsS "${site_base}plugins/" >"${smoke_tmp}/plugins.html"
jq -e '.schemaVersion == 1 and (.plugins | length) == 12' \
  "${smoke_tmp}/site-index.json" >/dev/null
jq -e '
  .backend == "nostr-relay-quorum" and
  (.communityRelays | length) >= 1 and
  (.snapshotSignerPubkeys | length) == 1
' "${smoke_tmp}/site-runtime.json" >/dev/null
rg -q 'lapis-registry-community' "${smoke_tmp}/community.js"
site_plugin_id=$(jq -r '.plugins[0].id' "${smoke_tmp}/site-index.json")
/usr/bin/curl -fsS "${site_base}plugins/${site_plugin_id}/" >"${smoke_tmp}/plugin.html"
rg -q '<lapis-registry-community' "${smoke_tmp}/plugin.html"
rg -q '/v1/client/registry-community.js' "${smoke_tmp}/plugin.html"

set -a
# shellcheck source=/dev/null
source "${repo_root}/.local/registry-fixture/fixture.env"
set +a
export REGISTRY_USE_TEST_KINDS=true
if [[ ${profile} == quorum ]]; then
  export REGISTRY_OFFICIAL_RELAYS="ws://127.0.0.1:${STRFRY_OFFICIAL_A_PORT},ws://127.0.0.1:${STRFRY_OFFICIAL_B_PORT},ws://127.0.0.1:${STRFRY_OFFICIAL_C_PORT}"
  export REGISTRY_COMMUNITY_RELAYS="ws://127.0.0.1:${STRFRY_COMMUNITY_PORT}"
else
  export REGISTRY_OFFICIAL_RELAYS="ws://127.0.0.1:${STRFRY_LOCAL_PORT}"
  export REGISTRY_COMMUNITY_RELAYS="ws://127.0.0.1:${STRFRY_LOCAL_PORT}"
fi
pnpm --dir "${repo_root}" relay:materialize --output "${smoke_tmp}/materialized"

jq -e '.schemaVersion == 1 and (.plugins | length) == 12' \
  "${smoke_tmp}/materialized/index.json" >/dev/null
jq -e --slurpfile status "${smoke_tmp}/status.json" '
  .root == $status[0].registryRoot and
  .snapshotEventId != null and
  (.relaySources | length) >= 1
' "${smoke_tmp}/materialized/provenance.json" >/dev/null
jq -e --slurpfile status "${smoke_tmp}/status.json" '
  .root == $status[0].communityRoot and
  ([.ratingAggregates[].count] | add) == 2
' "${smoke_tmp}/materialized/community.json" >/dev/null
jq -e --slurpfile status "${smoke_tmp}/status.json" '
  .root == $status[0].securityRoot and
  (.statuses | length) == 1
' "${smoke_tmp}/materialized/security.json" >/dev/null
test -s "${smoke_tmp}/materialized/client/registry-community.js"

plugin_id=$(jq -r '.plugins[0].id' "${smoke_tmp}/materialized/index.json")
latest_version=$(jq -r '.latestVersion' \
  "${smoke_tmp}/materialized/plugins/${plugin_id}.json")
artifact_url=$(jq -r --arg version "${latest_version}" \
  '.versions[$version].bundle.url' \
  "${smoke_tmp}/materialized/plugins/${plugin_id}.json")
expected_sha=$(jq -r --arg version "${latest_version}" \
  '.versions[$version].bundle.sha256' \
  "${smoke_tmp}/materialized/plugins/${plugin_id}.json")
/usr/bin/curl -fsS "${artifact_url}" >"${smoke_tmp}/artifact.json"
actual_sha=$(/usr/bin/shasum -a 256 "${smoke_tmp}/artifact.json" | awk '{print $1}')
if [[ ${actual_sha} != "${expected_sha}" ]]; then
  echo "Fixture artifact digest does not match the projected release" >&2
  exit 1
fi

echo "Local ${profile} strfry registry end-to-end smoke passed."
