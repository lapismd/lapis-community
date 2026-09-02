#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
stack=("${repo_root}/scripts/local-stack.sh")
if [[ $# -ne 0 ]]; then
  echo "usage: smoke-local-e2e.sh" >&2
  exit 2
fi

project_name=${COMPOSE_PROJECT_NAME:-lapis-registry-smoke-$$}
smoke_tmp=$(mktemp -d "/tmp/lapis-registry-smoke.XXXXXX")
port_base=$((24000 + ($$ % 20000)))

export COMPOSE_PROJECT_NAME=${project_name}
export REGISTRY_FIXTURE_PORT=${REGISTRY_FIXTURE_PORT:-${port_base}}
export LAPIS_RELAY_PORT=${LAPIS_RELAY_PORT:-$((port_base + 1))}
export REGISTRY_SITE_PORT=${REGISTRY_SITE_PORT:-$((port_base + 2))}
export REGISTRY_FIXTURE_LONG_THREAD_POSTS=${REGISTRY_FIXTURE_LONG_THREAD_POSTS:-240}
expected_community_events=$((REGISTRY_FIXTURE_LONG_THREAD_POSTS + ((REGISTRY_FIXTURE_LONG_THREAD_POSTS + 1) / 3) + 32))
expected_relay_copies=$((expected_community_events + 24))

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
  rm -r "${smoke_tmp}"
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
      [[ ${health} == healthy ]] && return 0
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

for service in registry-relay registry-fixture registry-site; do
  wait_for_health "${service}"
done

/usr/bin/curl -fsS \
  -H 'Accept: application/nostr+json' \
  "http://registry.localhost:${LAPIS_RELAY_PORT}" \
  >"${smoke_tmp}/nip11.json"
jq -e '(.supported_nips | index(29)) and (.supported_nips | index(42))' \
  "${smoke_tmp}/nip11.json" >/dev/null

fixture_base="http://127.0.0.1:${REGISTRY_FIXTURE_PORT}/"
site_base="http://127.0.0.1:${REGISTRY_SITE_PORT}/"
/usr/bin/curl -fsS "${fixture_base}status.json" >"${smoke_tmp}/status.json"
jq -e \
  --argjson expected_community_events "${expected_community_events}" \
  --argjson expected_relay_copies "${expected_relay_copies}" '
  .schema == "lapis.registry.nip29-local-fixture-status/1" and
  .pluginCount == 12 and
  .registryEventCount == 24 and
  .communityEventCount == $expected_community_events and
  .relayCopies == $expected_relay_copies and
  (.registryRoot | test("^[0-9a-f]{64}$")) and
  (.groupIds | length) == 16 and
  (.groupIds["support-ai"] | test("^[0-9a-f-]{36}$"))
' "${smoke_tmp}/status.json" >/dev/null

/usr/bin/curl -fsS "${site_base}registry/index.json" >"${smoke_tmp}/site-index.json"
/usr/bin/curl -fsS "${site_base}registry/runtime.json" >"${smoke_tmp}/site-runtime.json"
/usr/bin/curl -fsS "${site_base}registry/client/registry-community.js" \
  >"${smoke_tmp}/community.js"
/usr/bin/curl -fsS "${site_base}plugins/" >"${smoke_tmp}/plugins.html"
jq -e '.schemaVersion == 1 and (.plugins | length) == 12' \
  "${smoke_tmp}/site-index.json" >/dev/null
jq -e '
  .backend == "nostr-nip29" and
  (.relays | length) == 1 and
  (.curatorPubkeys | length) == 1
' "${smoke_tmp}/site-runtime.json" >/dev/null
rg -q 'lapis-registry-community' "${smoke_tmp}/community.js"
plugin_id=$(jq -r '.plugins[0].id' "${smoke_tmp}/site-index.json")
/usr/bin/curl -fsS "${site_base}plugins/${plugin_id}/" >"${smoke_tmp}/plugin.html"
rg -q '<lapis-registry-community' "${smoke_tmp}/plugin.html"
rg -q '/registry/client/registry-community.js' "${smoke_tmp}/plugin.html"

set -a
# shellcheck source=/dev/null
source "${repo_root}/.local/registry-fixture/fixture.env"
set +a
export REGISTRY_READER_SECRET_FILE="${repo_root}/.local/registry-fixture/materializer-reader.key"
export REGISTRY_RELAYS="ws://registry.localhost:${LAPIS_RELAY_PORT}"
export REGISTRY_PUBLIC_RELAYS="${REGISTRY_RELAYS}"
export REGISTRY_ASSET_FETCH_ORIGIN="${fixture_base}"
pnpm --dir "${repo_root}" build
pnpm --dir "${repo_root}" registry:materialize --output "${smoke_tmp}/materialized"

jq -e '.schemaVersion == 1 and (.plugins | length) == 12' \
  "${smoke_tmp}/materialized/index.json" >/dev/null
jq -e --slurpfile status "${smoke_tmp}/status.json" '
  (.root | test("^[0-9a-f]{64}$")) and
  .sourceRegistryRoot == $status[0].registryRoot and
  (.acceptedEventIds | length) == 24 and
  (.relaySources | length) == 1
' "${smoke_tmp}/materialized/provenance.json" >/dev/null
test -s "${smoke_tmp}/materialized/client/registry-community.js"

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

echo "Local Nostr registry end-to-end smoke passed."
