import {
  loadRelayRegistryState,
  WebSocketRegistryRelay,
} from "@lapismd/registry-nostr";
import type { RelayRegistryState } from "@lapismd/registry-nostr";
import type {
  CommunityKindMap,
  RegistryAuthorities,
  RegistryKindMap,
  SecurityAuthorities,
  SecurityKindMap,
} from "@lapismd/registry-protocol";

import type { RegistryDashboard } from "./types.js";

export interface ConsoleConfig {
  officialRelays: string[];
  communityRelays: string[];
  publishQuorum: number;
  kinds: RegistryKindMap;
  communityKinds: CommunityKindMap;
  securityKinds: SecurityKindMap;
  authorities: {
    assessorPubkeys: string[];
    curatorPubkeys: string[];
    moderatorPubkeys: string[];
    snapshotSignerPubkeys: string[];
    registryOperatorPubkeys: string[];
    publisherPubkeysByPlugin?: Record<string, string[]> | undefined;
  };
  securityAuthorities: {
    advisoryPubkeys: string[];
    dispositionPubkeys: string[];
  };
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
  const officialRelays = normalizeRelayUrls(candidate.officialRelays ?? []);
  const communityRelays = normalizeRelayUrls(candidate.communityRelays ?? []);
  const publishQuorum = candidate.publishQuorum;
  if (
    !Number.isInteger(publishQuorum) ||
    publishQuorum === undefined ||
    publishQuorum < 1 ||
    publishQuorum > officialRelays.length
  ) {
    throw new Error("Publish quorum must fit the official relay set");
  }
  if (
    candidate.kinds === undefined ||
    candidate.communityKinds === undefined ||
    candidate.securityKinds === undefined ||
    candidate.authorities === undefined ||
    candidate.securityAuthorities === undefined
  ) {
    throw new Error("Console trust and kind configuration is incomplete");
  }
  return {
    officialRelays,
    communityRelays,
    publishQuorum,
    kinds: candidate.kinds,
    communityKinds: candidate.communityKinds,
    securityKinds: candidate.securityKinds,
    authorities: candidate.authorities,
    securityAuthorities: candidate.securityAuthorities,
  };
}

export function normalizeRelayUrls(values: readonly string[]): string[] {
  if (values.length === 0) throw new Error("At least one relay is required");
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
): Promise<RegistryDashboard> {
  const officialRelays = config.officialRelays.map(
    (url) => new WebSocketRegistryRelay(url),
  );
  const communityRelays = config.communityRelays.map(
    (url) => new WebSocketRegistryRelay(url),
  );
  try {
    return dashboardFromRelayState(
      await loadRelayRegistryState({
        officialRelays,
        communityRelays,
        kinds: config.kinds,
        communityKinds: config.communityKinds,
        securityKinds: config.securityKinds,
        authorities: registryAuthorities(config),
        securityAuthorities: securityAuthorities(config),
      }),
    );
  } finally {
    for (const relay of [...officialRelays, ...communityRelays]) relay.close();
  }
}

export function dashboardFromRelayState(
  state: RelayRegistryState,
): RegistryDashboard {
  return {
    index: state.projection.index as unknown as RegistryDashboard["index"],
    provenance: {
      backend: "nostr-relay-quorum",
      root: state.registry.root,
      acceptedEventIds: state.registry.acceptedEventIds,
      exclusionCounts: state.registry.exclusionCounts,
      sourceCounts: Object.fromEntries(
        state.sources.official.map((source) => [
          source.relay,
          source.eventIds.length,
        ]),
      ),
      issues: state.registry.issues,
    },
    community: state.community as unknown as RegistryDashboard["community"],
    security: state.security as unknown as RegistryDashboard["security"],
    unsigned: false,
    responseRoot: state.registry.root,
    communityRoot: state.community.root,
    securityRoot: state.security.root,
  };
}

export function registryAuthorities(
  config: ConsoleConfig,
): RegistryAuthorities {
  return {
    assessorPubkeys: new Set(config.authorities.assessorPubkeys),
    curatorPubkeys: new Set(config.authorities.curatorPubkeys),
    moderatorPubkeys: new Set(config.authorities.moderatorPubkeys),
    snapshotSignerPubkeys: new Set(config.authorities.snapshotSignerPubkeys),
    registryOperatorPubkeys: new Set(
      config.authorities.registryOperatorPubkeys,
    ),
    ...(config.authorities.publisherPubkeysByPlugin === undefined
      ? {}
      : {
          publisherPubkeysByPlugin: new Map(
            Object.entries(config.authorities.publisherPubkeysByPlugin).map(
              ([pluginId, pubkeys]) => [pluginId, new Set(pubkeys)],
            ),
          ),
        }),
  };
}

export function securityAuthorities(
  config: ConsoleConfig,
): SecurityAuthorities {
  return {
    advisoryPubkeys: new Set(config.securityAuthorities.advisoryPubkeys),
    dispositionPubkeys: new Set(config.securityAuthorities.dispositionPubkeys),
  };
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Registry relays must use WS or WSS");
  }
  if (url.username || url.password || url.hash || url.search) {
    throw new Error("Registry relay URLs cannot contain credentials or state");
  }
  return url.toString();
}
