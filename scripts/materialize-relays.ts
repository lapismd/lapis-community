import { createHash } from "node:crypto";
import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
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
  JsonObject,
  JsonValue,
  RegistryAuthorities,
} from "@lapismd/registry-protocol";

const outputIndex = process.argv.indexOf("--output");
const outputTarget = path.resolve(
  outputIndex === -1
    ? "artifacts/relay-v1"
    : requiredArgument(process.argv[outputIndex + 1], "--output"),
);
const output = path.join(
  path.dirname(outputTarget),
  `.${path.basename(outputTarget)}.materializing-${process.pid}`,
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
      reaction: 7,
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
  await rm(output, { force: true, recursive: true });
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
  await mirrorProjectionResources(state.projection.plugins, output);
  await Promise.all([
    copyCommunityBundle(output),
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
    jsonFile(
      path.join(output, "accepted-events.json"),
      state.snapshot.events
        .filter((event) => state.registry.acceptedEventIds.includes(event.id))
        .toSorted((left, right) => left.id.localeCompare(right.id)),
    ),
    jsonFile(path.join(output, "runtime.json"), {
      schemaVersion: 1,
      backend: "nostr-relay-quorum",
      registryRoot: state.registry.root,
      snapshotEventId: state.snapshot.snapshotEvent.id,
      officialRelays: publicRelayList(
        "REGISTRY_PUBLIC_OFFICIAL_RELAYS",
        officialRelays.map((relay) => relay.url),
      ),
      communityRelays: publicRelayList(
        "REGISTRY_PUBLIC_COMMUNITY_RELAYS",
        communityRelays.map((relay) => relay.url),
      ),
      kinds,
      communityKinds,
      securityKinds,
      snapshotSignerPubkeys: [
        ...authorities().snapshotSignerPubkeys,
      ].toSorted(),
    }),
    ...[...state.projection.plugins].map(([pluginId, plugin]) =>
      jsonFile(path.join(output, "plugins", `${pluginId}.json`), plugin),
    ),
  ]);
  await rm(outputTarget, { force: true, recursive: true });
  await rename(output, outputTarget);
  console.log(
    `Materialized ${state.registry.plugins.length} plugins from snapshot ${state.snapshot.snapshotEvent.id} into ${outputTarget}.`,
  );
} catch (error) {
  await rm(output, { force: true, recursive: true });
  throw error;
} finally {
  for (const relay of [...officialRelays, ...communityRelays]) relay.close();
}

async function copyCommunityBundle(targetRoot: string): Promise<void> {
  const configured = process.env.REGISTRY_COMMUNITY_BUNDLE_PATH?.trim();
  const source = path.resolve(
    configured === undefined || configured === ""
      ? "apps/registry-community/dist/registry-community.js"
      : configured,
  );
  const target = path.join(targetRoot, "client", "registry-community.js");
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
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

interface ProjectionResource {
  url: string;
  sourceUrl: string;
  sha256: string;
  size: number;
}

async function mirrorProjectionResources(
  plugins: ReadonlyMap<string, JsonObject>,
  targetRoot: string,
): Promise<void> {
  const resources = new Map<string, ProjectionResource>();
  for (const plugin of plugins.values()) collectResources(plugin, resources);
  const queue = [...resources.values()].toSorted((left, right) =>
    left.url.localeCompare(right.url),
  );
  const workers = Array.from(
    { length: Math.min(8, queue.length) },
    async () => {
      for (;;) {
        const resource = queue.shift();
        if (resource === undefined) return;
        await mirrorResource(resource, targetRoot);
      }
    },
  );
  await Promise.all(workers);
}

function collectResources(
  value: JsonValue,
  resources: Map<string, ProjectionResource>,
): void {
  if (Array.isArray(value)) {
    for (const child of value) collectResources(child, resources);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const candidate = value as Record<string, JsonValue>;
  if (
    typeof candidate.url === "string" &&
    candidate.url.startsWith("/v1/") &&
    typeof candidate.sourceUrl === "string" &&
    typeof candidate.sha256 === "string" &&
    /^[0-9a-f]{64}$/u.test(candidate.sha256) &&
    typeof candidate.size === "number" &&
    Number.isInteger(candidate.size) &&
    candidate.size >= 0
  ) {
    const resource: ProjectionResource = {
      url: candidate.url,
      sourceUrl: candidate.sourceUrl,
      sha256: candidate.sha256,
      size: candidate.size,
    };
    const current = resources.get(resource.url);
    if (
      current !== undefined &&
      canonicalJson(current as unknown as JsonValue) !==
        canonicalJson(resource as unknown as JsonValue)
    ) {
      throw new Error(`Conflicting projection resource ${resource.url}`);
    }
    resources.set(resource.url, resource);
  }
  for (const child of Object.values(candidate)) {
    collectResources(child, resources);
  }
}

async function mirrorResource(
  resource: ProjectionResource,
  targetRoot: string,
): Promise<void> {
  const pathname = new URL(resource.url, "https://registry.lapis.md").pathname;
  if (!pathname.startsWith("/v1/")) {
    throw new Error(`Projection resource is outside /v1: ${resource.url}`);
  }
  const fetchOrigin = process.env.REGISTRY_ASSET_FETCH_ORIGIN?.trim();
  const source =
    fetchOrigin === undefined || fetchOrigin === ""
      ? new URL(resource.sourceUrl)
      : new URL(
          new URL(resource.sourceUrl).pathname.slice(1),
          ensureSlash(fetchOrigin),
        );
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`${source.toString()} returned HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== resource.size) {
    throw new Error(`${resource.url} size does not match its signed metadata`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== resource.sha256) {
    throw new Error(`${resource.url} hash does not match its signed metadata`);
  }
  const relativePath = pathname.slice("/v1/".length);
  const target = path.resolve(targetRoot, relativePath);
  if (!target.startsWith(`${path.resolve(targetRoot)}${path.sep}`)) {
    throw new Error(`Unsafe projection resource path ${resource.url}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

function ensureSlash(value: string): URL {
  return new URL(value.endsWith("/") ? value : `${value}/`);
}

function publicRelayList(name: string, fallback: string[]): string[] {
  const configured = list(name);
  return configured.length === 0 ? fallback : configured;
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
