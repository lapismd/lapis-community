import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { hexToBytes } from "@noble/hashes/utils.js";
import {
  loadBuzzRelayRegistryState,
  WebSocketRegistryRelay,
} from "@lapismd/registry-nostr";
import {
  canonicalJson,
  lapisBuzzGroupId,
  LAPIS_BUZZ_GROUP_PATHS,
} from "@lapismd/registry-protocol";
import type {
  BuzzCatalogPlugin,
  JsonObject,
  JsonValue,
  NostrEventTemplate,
} from "@lapismd/registry-protocol";
import { finalizeEvent } from "nostr-tools/pure";

const outputIndex = process.argv.indexOf("--output");
const outputTarget = path.resolve(
  outputIndex === -1
    ? "artifacts/relay-v1"
    : required(process.argv[outputIndex + 1], "--output"),
);
const output = path.join(
  path.dirname(outputTarget),
  `.${path.basename(outputTarget)}.materializing-${process.pid}`,
);
const relayUrls = list("REGISTRY_BUZZ_RELAYS");
if (relayUrls.length === 0)
  throw new Error("REGISTRY_BUZZ_RELAYS must not be empty");
const secretFile = required(
  process.env.REGISTRY_FIXTURE_SECRETS_FILE,
  "REGISTRY_FIXTURE_SECRETS_FILE",
);
const secrets = JSON.parse(await readFile(secretFile, "utf8")) as {
  keys?: Record<string, string>;
};
const readerSecretHex = secrets.keys?.publisher;
if (readerSecretHex === undefined || !/^[0-9a-f]{64}$/u.test(readerSecretHex)) {
  throw new Error("Fixture publisher key is missing");
}
const readerSecret = hexToBytes(readerSecretHex);
const publicUrls = list("REGISTRY_PUBLIC_BUZZ_RELAYS");
const relays = relayUrls.map(
  (url, index) =>
    new WebSocketRegistryRelay(url, {
      authenticationRelayUrl: publicUrls[index] ?? url,
      eoseTimeoutMs: 15_000,
    }),
);

try {
  const catalogResponse = await fetch(
    required(process.env.REGISTRY_CATALOG_URL, "REGISTRY_CATALOG_URL"),
  );
  if (!catalogResponse.ok)
    throw new Error(`Catalog returned ${catalogResponse.status}`);
  const catalog = (await catalogResponse.json()) as BuzzCatalogPlugin[];
  const publisher = required(
    process.env.REGISTRY_PUBLISHER_PUBKEY,
    "REGISTRY_PUBLISHER_PUBKEY",
  );
  const curator = required(
    process.env.REGISTRY_CURATOR_PUBKEYS,
    "REGISTRY_CURATOR_PUBKEYS",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const state = await loadBuzzRelayRegistryState({
    relays,
    catalog,
    authorities: {
      curatorPubkeys: new Set(curator),
      publisherPubkeysByPlugin: new Map(
        catalog.map((plugin) => [
          plugin.content.pluginId,
          new Set([publisher]),
        ]),
      ),
    },
    generatedAt: new Date().toISOString(),
    authSigner: async (template: NostrEventTemplate) =>
      finalizeEvent(template, readerSecret),
  });
  const acceptedEventIds = new Set(state.registry.acceptedEventIds);
  const acceptedEvents = state.events.filter((event) =>
    acceptedEventIds.has(event.id),
  );
  await rm(output, { force: true, recursive: true });
  await mkdir(path.join(output, "plugins"), { recursive: true });
  await mirrorProjectionResources(state.projection.plugins, output);
  await Promise.all([
    copyCommunityBundle(output),
    jsonFile(path.join(output, "index.json"), state.projection.index),
    jsonFile(path.join(output, "provenance.json"), {
      ...state.projection.provenance,
      relaySources: state.sources,
    }),
    jsonFile(path.join(output, "accepted-events.json"), acceptedEvents),
    jsonFile(path.join(output, "community.json"), {
      schemaVersion: 2,
      backend: "buzz",
      groups: "nip29",
    }),
    jsonFile(path.join(output, "security.json"), {
      schemaVersion: 2,
      statuses: [],
      deferredToBuzzPrivateMessaging: true,
    }),
    jsonFile(path.join(output, "runtime.json"), {
      schemaVersion: 2,
      backend: "nostr-buzz",
      registryRoot: state.registry.root,
      buzzRelays: publicUrls.length === 0 ? relayUrls : publicUrls,
      releaseGroupId: lapisBuzzGroupId(LAPIS_BUZZ_GROUP_PATHS.pluginReleases),
      curatorPubkeys: curator.toSorted(),
      publisherPubkeysByPlugin: Object.fromEntries(
        catalog.map((plugin) => [plugin.content.pluginId, [publisher]]),
      ),
    }),
    ...[...state.projection.plugins].map(([pluginId, plugin]) =>
      jsonFile(path.join(output, "plugins", `${pluginId}.json`), plugin),
    ),
  ]);
  await rm(outputTarget, { force: true, recursive: true });
  await rename(output, outputTarget);
  console.log(
    `Materialized ${state.registry.plugins.length} Buzz plugins into ${outputTarget}.`,
  );
} catch (error) {
  await rm(output, { force: true, recursive: true });
  throw error;
} finally {
  for (const relay of relays) relay.close();
}

async function copyCommunityBundle(targetRoot: string): Promise<void> {
  const source = path.resolve(
    process.env.REGISTRY_COMMUNITY_BUNDLE_PATH?.trim() ||
      "apps/registry-community/dist/registry-community.js",
  );
  const target = path.join(targetRoot, "client", "registry-community.js");
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
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
  await Promise.all(
    [...resources.values()].map(
      async (resource) => await mirrorResource(resource, targetRoot),
    ),
  );
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
    typeof candidate.size === "number"
  ) {
    resources.set(candidate.url, candidate as unknown as ProjectionResource);
  }
  for (const child of Object.values(candidate))
    collectResources(child, resources);
}

async function mirrorResource(
  resource: ProjectionResource,
  targetRoot: string,
): Promise<void> {
  const pathname = new URL(resource.url, "https://registry.lapismd.com")
    .pathname;
  const origin = process.env.REGISTRY_ASSET_FETCH_ORIGIN?.trim();
  const source = origin
    ? new URL(
        new URL(resource.sourceUrl).pathname.slice(1),
        ensureSlash(origin),
      )
    : new URL(resource.sourceUrl);
  const response = await fetch(source);
  if (!response.ok)
    throw new Error(`${source.toString()} returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== resource.size)
    throw new Error(`${resource.url} size mismatch`);
  if (createHash("sha256").update(bytes).digest("hex") !== resource.sha256) {
    throw new Error(`${resource.url} hash mismatch`);
  }
  const target = path.resolve(targetRoot, pathname.slice("/v1/".length));
  if (!target.startsWith(`${path.resolve(targetRoot)}${path.sep}`)) {
    throw new Error(`Unsafe resource path ${resource.url}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

function ensureSlash(value: string): URL {
  return new URL(value.endsWith("/") ? value : `${value}/`);
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "")
    throw new Error(`${name} is required`);
  return value;
}
