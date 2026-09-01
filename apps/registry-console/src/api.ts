import {
  loadBuzzRelayRegistryState,
  WebSocketRegistryRelay,
} from "@lapismd/registry-nostr";
import type { RelayAuthSigner } from "@lapismd/registry-nostr";
import type {
  BuzzCatalogPlugin,
  BuzzRegistryAuthorities,
} from "@lapismd/registry-protocol";

import type { RegistryDashboard } from "./types.js";

export interface ConsoleConfig {
  backend: "nostr-buzz";
  buzzRelays: string[];
  catalogUrl: string;
  curatorPubkeys: string[];
  publisherPubkeys: string[];
}

export async function loadConsoleConfig(): Promise<ConsoleConfig> {
  const response = await fetch("./config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Console configuration failed with ${response.status}`);
  }
  return parseConsoleConfig(await response.json());
}

export function parseConsoleConfig(value: unknown): ConsoleConfig {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Console configuration must be an object");
  }
  const candidate = value as Partial<ConsoleConfig>;
  if (candidate.backend !== "nostr-buzz") {
    throw new Error("Console backend must be nostr-buzz");
  }
  return {
    backend: candidate.backend,
    buzzRelays: normalizeRelayUrls(candidate.buzzRelays ?? []),
    catalogUrl: normalizeHttpUrl(candidate.catalogUrl ?? ""),
    curatorPubkeys: normalizePubkeys(candidate.curatorPubkeys ?? []),
    publisherPubkeys: normalizePubkeys(candidate.publisherPubkeys ?? []),
  };
}

export function normalizeRelayUrls(values: readonly string[]): string[] {
  if (values.length === 0)
    throw new Error("At least one Buzz relay is required");
  return [...new Set(values.map((value) => normalizeRelayUrl(value)))];
}

export function parseRelayList(value: string): string[] {
  return normalizeRelayUrls(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== ""),
  );
}

export async function loadDashboard(
  config: ConsoleConfig,
  authSigner: RelayAuthSigner,
): Promise<RegistryDashboard> {
  const catalog = await loadCatalog(config.catalogUrl);
  const relays = config.buzzRelays.map(
    (url) => new WebSocketRegistryRelay(url, { authenticationRelayUrl: url }),
  );
  try {
    const state = await loadBuzzRelayRegistryState({
      relays,
      catalog,
      authorities: registryAuthorities(config, catalog),
      generatedAt: new Date().toISOString(),
      authSigner,
    });
    return {
      index: state.projection.index as unknown as RegistryDashboard["index"],
      provenance: {
        backend: config.backend,
        root: state.registry.root,
        acceptedEventIds: state.registry.acceptedEventIds,
        sourceCounts: Object.fromEntries(
          state.sources.map((source) => [source.relay, source.eventIds.length]),
        ),
        issues: state.registry.issues,
      },
      releaseEvents: state.events.filter((event) => event.kind === 9).length,
      decisionEvents: state.events.filter((event) => event.kind === 7).length,
    };
  } finally {
    for (const relay of relays) relay.close();
  }
}

export function registryAuthorities(
  config: ConsoleConfig,
  catalog: readonly BuzzCatalogPlugin[],
): BuzzRegistryAuthorities {
  return {
    curatorPubkeys: new Set(config.curatorPubkeys),
    publisherPubkeysByPlugin: new Map(
      catalog.map((plugin) => [
        plugin.content.pluginId,
        new Set(config.publisherPubkeys),
      ]),
    ),
  };
}

async function loadCatalog(url: string): Promise<BuzzCatalogPlugin[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Catalog request failed with ${response.status}`);
  }
  const value = (await response.json()) as unknown;
  if (!Array.isArray(value)) throw new Error("Buzz catalog must be an array");
  return value as BuzzCatalogPlugin[];
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Buzz relays must use WS or WSS");
  }
  if (url.username || url.password || url.hash || url.search) {
    throw new Error("Buzz relay URLs cannot contain credentials or state");
  }
  return url.toString();
}

function normalizeHttpUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Catalog URL must use HTTP or HTTPS");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Catalog URL cannot contain credentials or a fragment");
  }
  return url.toString();
}

function normalizePubkeys(values: readonly string[]): string[] {
  const pubkeys = [...new Set(values.map((value) => value.trim()))];
  if (pubkeys.some((value) => !/^[0-9a-f]{64}$/u.test(value))) {
    throw new Error("Trusted keys must be raw lowercase Nostr pubkeys");
  }
  return pubkeys;
}
