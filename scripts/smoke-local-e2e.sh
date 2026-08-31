#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
project_name=${COMPOSE_PROJECT_NAME:-lapis-registry-e2e-smoke-$$}
smoke_tmp=$(mktemp -d /tmp/lapis-registry-e2e-smoke.XXXXXX)
port_base=$((24000 + ($$ % 20000)))

export COMPOSE_PROJECT_NAME=${project_name}
export POSTGRES_PORT=${POSTGRES_PORT:-${port_base}}
export REGISTRY_SERVICE_PORT=${REGISTRY_SERVICE_PORT:-$((port_base + 1))}
export REGISTRY_FIXTURE_PORT=${REGISTRY_FIXTURE_PORT:-$((port_base + 2))}
export REGISTRY_CONSOLE_PORT=${REGISTRY_CONSOLE_PORT:-$((port_base + 3))}
export GRAIN_OFFICIAL_A_PORT=${GRAIN_OFFICIAL_A_PORT:-$((port_base + 4))}
export GRAIN_OFFICIAL_B_PORT=${GRAIN_OFFICIAL_B_PORT:-$((port_base + 5))}
export GRAIN_OFFICIAL_C_PORT=${GRAIN_OFFICIAL_C_PORT:-$((port_base + 6))}
export GRAIN_COMMUNITY_PORT=${GRAIN_COMMUNITY_PORT:-$((port_base + 7))}
export REGISTRY_PUBLIC_BASE_URL="http://127.0.0.1:${REGISTRY_SERVICE_PORT}/"
export REGISTRY_CONSOLE_ORIGINS="http://127.0.0.1:${REGISTRY_CONSOLE_PORT}"

stack=("${repo_root}/scripts/local-stack.sh")

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
      if [[ ${health} == dead ]]; then
        echo "${service} became dead" >&2
        return 1
      fi
    fi
    sleep 2
  done
  echo "Timed out waiting for ${service} to become healthy" >&2
  return 1
}

for service in \
  postgres \
  registry-service \
  registry-community \
  registry-fixture \
  registry-console; do
  wait_for_health "${service}"
done

wait_for_official_quorum() {
  for _ in $(seq 1 180); do
    healthy=0
    for service in \
      registry-official-a \
      registry-official-b \
      registry-official-c; do
      container_id=$(docker ps --all --quiet \
        --filter "label=com.docker.compose.project=${project_name}" \
        --filter "label=com.docker.compose.service=${service}")
      if [[ -n ${container_id} ]]; then
        health=$(docker inspect \
          --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
          "${container_id}")
        if [[ ${health} == healthy ]]; then
          healthy=$((healthy + 1))
        fi
      fi
    done
    if [[ ${healthy} -ge 2 ]]; then
      return 0
    fi
    sleep 2
  done
  echo "Timed out waiting for two healthy official relays" >&2
  return 1
}

wait_for_official_quorum

api_base="http://127.0.0.1:${REGISTRY_SERVICE_PORT}/"
fixture_base="http://127.0.0.1:${REGISTRY_FIXTURE_PORT}/"
console_base="http://127.0.0.1:${REGISTRY_CONSOLE_PORT}/"

/usr/bin/curl -fsS "${api_base}health" | jq -e '.status == "ok"' >/dev/null
/usr/bin/curl -fsS "${fixture_base}status.json" >"${smoke_tmp}/status.json"
/usr/bin/curl -fsS "${api_base}preview/v1/index.json" >"${smoke_tmp}/index.json"
/usr/bin/curl -fsS "${api_base}preview/v1/provenance.json" >"${smoke_tmp}/provenance.json"
/usr/bin/curl -fsS "${api_base}preview/community.json" >"${smoke_tmp}/community.json"
/usr/bin/curl -fsS "${api_base}preview/security.json" >"${smoke_tmp}/security.json"

jq -e '
  .pluginCount == 3 and
  .communityEventCount == 6 and
  (.officialEventCount > .communityEventCount) and
  .relayCopies.officialQuorum >= 2 and
  (.officialEventCount as $count |
    ([.relayCopies.official[] | select(. == $count)] | length) >= 2) and
  .relayCopies.community == .communityEventCount and
  (.registryRoot | test("^[0-9a-f]{64}$")) and
  (.communityRoot | test("^[0-9a-f]{64}$")) and
  (.securityRoot | test("^[0-9a-f]{64}$"))
' "${smoke_tmp}/status.json" >/dev/null

jq -e '.schemaVersion == 1 and (.plugins | length) == 3' \
  "${smoke_tmp}/index.json" >/dev/null
jq -e --slurpfile status "${smoke_tmp}/status.json" '
  .root == $status[0].registryRoot and
  .sourceCounts.api ==
    ($status[0].officialEventCount + $status[0].communityEventCount)
' "${smoke_tmp}/provenance.json" >/dev/null
jq -e --slurpfile status "${smoke_tmp}/status.json" '
  .root == $status[0].communityRoot and
  ([.ratingAggregates[].count] | add) == 2 and
  (.reviews | length) == 1 and
  (.reports | length) == 1 and
  (.collections | length) == 1 and
  (.followLists | length) == 1
' "${smoke_tmp}/community.json" >/dev/null
jq -e --slurpfile status "${smoke_tmp}/status.json" '
  .root == $status[0].securityRoot and
  (.statuses | length) == 1 and
  .statuses[0].enforcement == "warn"
' "${smoke_tmp}/security.json" >/dev/null

plugin_id=$(jq -r '.plugins[0].id' "${smoke_tmp}/index.json")
/usr/bin/curl -fsS "${api_base}preview/v1/plugins/${plugin_id}.json" \
  >"${smoke_tmp}/plugin.json"
latest_version=$(jq -r '.latestVersion' "${smoke_tmp}/plugin.json")
artifact_url=$(jq -r --arg version "${latest_version}" \
  '.versions[$version].bundle.url' "${smoke_tmp}/plugin.json")
expected_sha=$(jq -r --arg version "${latest_version}" \
  '.versions[$version].bundle.sha256' "${smoke_tmp}/plugin.json")
/usr/bin/curl -fsS "${artifact_url}" >"${smoke_tmp}/artifact.json"
actual_sha=$(/usr/bin/shasum -a 256 "${smoke_tmp}/artifact.json" | awk '{print $1}')
if [[ ${actual_sha} != "${expected_sha}" ]]; then
  echo "Fixture artifact digest does not match the projected release" >&2
  exit 1
fi
jq -e '.schema == "lapis.registry.local-source-fixture/1"' \
  "${smoke_tmp}/artifact.json" >/dev/null

/usr/bin/curl -fsS "${console_base}" >"${smoke_tmp}/console.html"
/usr/bin/curl -fsS "${console_base}assets/main.js" >"${smoke_tmp}/console.js"
rg -q 'Community &amp; security' "${smoke_tmp}/console.html"
rg -q 'summarizeCommunity' "${smoke_tmp}/console.js"

echo "Local registry end-to-end container smoke passed."
