import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { SecretKeyRegistrySigner } from "../auth/index.js";
import {
  loadNip29RelayRegistryState,
  WebSocketRegistryRelay,
} from "../nostr/index.js";
import {
  canonicalHash,
  canonicalJson,
  lapisGroupId,
  LAPIS_GROUPS,
} from "../protocol/index.js";
import type { JsonObject, JsonValue } from "../protocol/index.js";
import {
  projectionResourceSourceConfiguration,
  resolveProjectionResourceSource,
  verifyProjectionResourceBytes,
  type ProjectionResource,
} from "./projection-resource.js";

const outputIndex = process.argv.indexOf("--output");
const outputTarget = path.resolve(
  outputIndex === -1
    ? "artifacts/registry"
    : required(process.argv[outputIndex + 1], "--output"),
);
const output = path.join(
  path.dirname(outputTarget),
  `.${path.basename(outputTarget)}.materializing-${process.pid}`,
);
const relayUrls = list("REGISTRY_RELAYS");
if (relayUrls.length === 0)
  throw new Error("REGISTRY_RELAYS must not be empty");
const publicUrls = list("REGISTRY_PUBLIC_RELAYS");
const resourceSourceConfiguration = projectionResourceSourceConfiguration(
  process.env,
);
const readerSigner = await loadReaderSigner();
const authSigner = readerSigner.signEvent.bind(readerSigner);
const relays = relayUrls.map(
  (url, index) =>
    new WebSocketRegistryRelay(url, {
      authenticationRelayUrl: publicUrls[index] ?? url,
      eoseTimeoutMs: 15_000,
    }),
);

try {
  const generatedAt = new Date().toISOString();
  const publishers = list("REGISTRY_PUBLISHER_PUBKEYS");
  if (publishers.length === 0) {
    throw new Error("REGISTRY_PUBLISHER_PUBKEYS must not be empty");
  }
  const curator = required(
    process.env.REGISTRY_CURATOR_PUBKEYS,
    "REGISTRY_CURATOR_PUBKEYS",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const state = await loadNip29RelayRegistryState({
    relays,
    authorities: {
      curatorPubkeys: new Set(curator),
      publisherPubkeysByPlugin: new Map(),
      defaultPublisherPubkeys: new Set(publishers),
    },
    generatedAt,
    authSigner,
  });
  const acceptedEventIds = new Set(state.registry.acceptedEventIds);
  const acceptedEvents = state.events
    .filter((event) => acceptedEventIds.has(event.id))
    .toSorted((left, right) => left.id.localeCompare(right.id));
  const projectedPlugins = Object.fromEntries(
    [...state.projection.plugins].toSorted(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  const projectionRoot = canonicalHash({
    acceptedEventIds: acceptedEvents.map((event) => event.id),
    index: state.projection.index,
    plugins: projectedPlugins,
  });
  const publishedRelays = publicUrls.length === 0 ? relayUrls : publicUrls;
  await rm(output, { force: true, recursive: true });
  await mkdir(path.join(output, "plugins"), { recursive: true });
  await mirrorProjectionResources(state.projection.plugins, output);
  await Promise.all([
    copyCommunityBundle(output),
    jsonFile(path.join(output, "index.json"), state.projection.index),
    jsonFile(path.join(output, "provenance.json"), {
      schema: "lapis.registry.provenance/1",
      ...state.projection.provenance,
      root: projectionRoot,
      sourceRegistryRoot: state.registry.root,
      generatedAt,
      relaySources: state.sources,
    }),
    jsonFile(path.join(output, "accepted-events.json"), acceptedEvents),
    jsonFile(path.join(output, "runtime.json"), {
      schemaVersion: 1,
      backend: "nostr-nip29",
      registryRoot: projectionRoot,
      sourceRegistryRoot: state.registry.root,
      relays: publishedRelays,
      releaseGroupId: lapisGroupId(LAPIS_GROUPS.pluginReleases),
      curatorPubkeys: curator.toSorted(),
      publisherPubkeys: publishers.toSorted(),
    }),
    ...Object.entries(projectedPlugins).map(([pluginId, plugin]) =>
      jsonFile(path.join(output, "plugins", `${pluginId}.json`), plugin),
    ),
  ]);
  await rm(outputTarget, { force: true, recursive: true });
  await rename(output, outputTarget);
  console.log(
    `Materialized ${state.registry.plugins.length} NIP-29 plugins into ${outputTarget}.`,
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
      "dist/client/registry-community.js",
  );
  const target = path.join(targetRoot, "client", "registry-community.js");
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function jsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${canonicalJson(value as JsonValue)}\n`, "utf8");
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
    candidate.url.startsWith("/registry/") &&
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
  const pathname = new URL(resource.url, "https://community.lapis.md").pathname;
  const source = resolveProjectionResourceSource(
    resource,
    resourceSourceConfiguration,
  );
  const response = await fetch(source);
  if (!response.ok)
    throw new Error(`${source.toString()} returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  verifyProjectionResourceBytes(resource, bytes);
  const target = path.resolve(targetRoot, pathname.slice("/registry/".length));
  if (!target.startsWith(`${path.resolve(targetRoot)}${path.sep}`)) {
    throw new Error(`Unsafe resource path ${resource.url}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
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

async function loadReaderSigner(): Promise<SecretKeyRegistrySigner> {
  const secretPath = path.resolve(
    required(
      process.env.REGISTRY_READER_SECRET_FILE,
      "REGISTRY_READER_SECRET_FILE",
    ),
  );
  const secretHex = (await readFile(secretPath, "utf8")).trim();
  if (!/^[0-9a-f]{64}$/u.test(secretHex)) {
    throw new Error(
      "REGISTRY_READER_SECRET_FILE must contain one lowercase hex Nostr secret",
    );
  }
  return new SecretKeyRegistrySigner(
    new Uint8Array(Buffer.from(secretHex, "hex")),
  );
}
