import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  loadRelayRegistryState,
  WebSocketRegistryRelay,
} from "@lapismd/registry-nostr";
import {
  canonicalJson,
  createCommunityKindMap,
  createRegistryKindMap,
  createSecurityKindMap,
  TEST_COMMUNITY_KINDS,
  TEST_REGISTRY_KINDS,
  TEST_SECURITY_KINDS,
} from "@lapismd/registry-protocol";
import type {
  JsonValue,
  RegistryAuthorities,
} from "@lapismd/registry-protocol";

const outputIndex = process.argv.indexOf("--output");
const output = path.resolve(
  outputIndex === -1
    ? "artifacts/relay-v1"
    : requiredArgument(process.argv[outputIndex + 1], "--output"),
);
const officialRelays = relayList("REGISTRY_OFFICIAL_RELAYS").map(
  (url) => new WebSocketRegistryRelay(url, { eoseTimeoutMs: 15_000 }),
);
const communityRelays = relayList("REGISTRY_COMMUNITY_RELAYS").map(
  (url) => new WebSocketRegistryRelay(url, { eoseTimeoutMs: 15_000 }),
);
const testKinds = process.env.REGISTRY_USE_TEST_KINDS === "true";
const kinds = testKinds
  ? TEST_REGISTRY_KINDS
  : createRegistryKindMap({
      approval: kind("REGISTRY_APPROVAL_KIND"),
      moderationDecision: kind("REGISTRY_MODERATION_DECISION_KIND"),
      revocation: kind("REGISTRY_REVOCATION_KIND"),
      snapshot: kind("REGISTRY_SNAPSHOT_KIND"),
    });
const communityKinds = testKinds
  ? TEST_COMMUNITY_KINDS
  : createCommunityKindMap({
      rating: kind("REGISTRY_RATING_KIND"),
      comment: 1_111,
      report: 1_984,
      followList: 3,
      appCurationSet: 30_267,
      softwareApplication: 32_267,
    });
const securityKinds = testKinds
  ? TEST_SECURITY_KINDS
  : createSecurityKindMap({
      advisory: kind("REGISTRY_SECURITY_ADVISORY_KIND"),
      disposition: kind("REGISTRY_SECURITY_DISPOSITION_KIND"),
    });

try {
  const state = await loadRelayRegistryState({
    officialRelays,
    communityRelays,
    kinds,
    communityKinds,
    securityKinds,
    authorities: authorities(),
    securityAuthorities: {
      advisoryPubkeys: new Set(list("REGISTRY_SECURITY_ADVISORY_PUBKEYS")),
      dispositionPubkeys: new Set(
        list("REGISTRY_SECURITY_DISPOSITION_PUBKEYS"),
      ),
    },
  });
  await mkdir(path.join(output, "plugins"), { recursive: true });
  await Promise.all([
    jsonFile(path.join(output, "index.json"), state.projection.index),
    jsonFile(path.join(output, "provenance.json"), {
      ...state.projection.provenance,
      snapshotEventId: state.snapshot.snapshotEvent.id,
      relaySources: state.sources.official,
    }),
    jsonFile(path.join(output, "community.json"), state.community),
    jsonFile(path.join(output, "security.json"), state.security),
    jsonFile(
      path.join(output, "snapshot-event.json"),
      state.snapshot.snapshotEvent,
    ),
    ...[...state.projection.plugins].map(([pluginId, plugin]) =>
      jsonFile(path.join(output, "plugins", `${pluginId}.json`), plugin),
    ),
  ]);
  console.log(
    `Materialized ${state.registry.plugins.length} plugins from snapshot ${state.snapshot.snapshotEvent.id} into ${output}.`,
  );
} finally {
  for (const relay of [...officialRelays, ...communityRelays]) relay.close();
}

function authorities(): RegistryAuthorities {
  const publisherJson = process.env.REGISTRY_PUBLISHERS_JSON?.trim();
  const publishers = JSON.parse(
    publisherJson === undefined || publisherJson === "" ? "{}" : publisherJson,
  ) as unknown;
  if (
    publishers === null ||
    Array.isArray(publishers) ||
    typeof publishers !== "object"
  ) {
    throw new Error("REGISTRY_PUBLISHERS_JSON must be an object");
  }
  return {
    assessorPubkeys: new Set(list("REGISTRY_ASSESSOR_PUBKEYS")),
    curatorPubkeys: new Set(list("REGISTRY_CURATOR_PUBKEYS")),
    moderatorPubkeys: new Set(list("REGISTRY_MODERATOR_PUBKEYS")),
    snapshotSignerPubkeys: new Set(list("REGISTRY_SNAPSHOT_SIGNER_PUBKEYS")),
    registryOperatorPubkeys: new Set(list("REGISTRY_OPERATOR_PUBKEYS")),
    ...(Object.keys(publishers).length === 0
      ? {}
      : {
          publisherPubkeysByPlugin: new Map(
            Object.entries(publishers).map(([pluginId, value]) => {
              if (
                !Array.isArray(value) ||
                value.some((pubkey) => typeof pubkey !== "string")
              ) {
                throw new Error(
                  `REGISTRY_PUBLISHERS_JSON.${pluginId} must be a string array`,
                );
              }
              return [pluginId, new Set(value as string[])] as const;
            }),
          ),
        }),
  };
}

async function jsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${canonicalJson(value as JsonValue)}\n`, "utf8");
}

function relayList(name: string): string[] {
  const values = list(name);
  if (values.length === 0) throw new Error(`${name} must not be empty`);
  return values.map((value) => {
    const url = new URL(value);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      throw new Error(`${name} must contain only WS or WSS URLs`);
    }
    return url.toString();
  });
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

function kind(name: string): number {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error(`${name} must be a Nostr kind integer`);
  }
  return value;
}

function requiredArgument(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} requires a path`);
  }
  return value;
}
