import {
  canonicalJson,
  createSnapshotContent,
  createSnapshotEventTemplate,
  eventAddress,
  materializeCommunity,
  materializeRegistry,
  materializeSecurity,
  projectV1,
} from "@lapismd/registry-protocol";
import type {
  CommunityKindMap,
  JsonValue,
  MaterializedCommunity,
  MaterializedRegistry,
  MaterializedSecurity,
  NostrEvent,
  NostrEventTemplate,
  RegistryAuthorities,
  RegistryKindMap,
  SecurityAuthorities,
  SecurityKindMap,
  V1Projection,
} from "@lapismd/registry-protocol";

import { loadVerifiedRegistrySnapshot } from "./snapshot.js";
import type { VerifiedRegistrySnapshot } from "./snapshot.js";
import type { RegistryRelay, RelayFilter } from "./transport.js";

export interface RelayQuerySource {
  relay: string;
  eventIds: string[];
  error?: string | undefined;
}

export interface RelayRegistryState {
  snapshot: VerifiedRegistrySnapshot;
  registry: MaterializedRegistry;
  projection: V1Projection;
  community: MaterializedCommunity;
  security: MaterializedSecurity;
  sources: {
    official: RelayQuerySource[];
    community: RelayQuerySource[];
    security: RelayQuerySource[];
  };
}

export interface RelayRegistryStateOptions {
  officialRelays: readonly RegistryRelay[];
  communityRelays: readonly RegistryRelay[];
  kinds: RegistryKindMap;
  communityKinds: CommunityKindMap;
  securityKinds: SecurityKindMap;
  authorities: RegistryAuthorities;
  securityAuthorities: SecurityAuthorities;
  signal?: AbortSignal | undefined;
}

export async function loadRelayRegistryState(
  options: RelayRegistryStateOptions,
): Promise<RelayRegistryState> {
  const snapshot = await loadVerifiedRegistrySnapshot(
    options.officialRelays,
    options.kinds,
    options.authorities,
    { signal: options.signal },
  );
  const pluginAddresses = new Map(
    snapshot.registry.plugins.map((plugin) => [
      plugin.content.pluginId,
      eventAddress(
        options.kinds.softwareApplication,
        plugin.event.pubkey,
        plugin.content.pluginId,
      ),
    ]),
  );
  const trustedArtifacts = new Map(
    snapshot.registry.plugins.flatMap((plugin) =>
      plugin.releases.map(
        (release) =>
          [release.event.id, release.content.artifact.sha256] as const,
      ),
    ),
  );
  const [communityResult, securityResult] = await Promise.all([
    queryRelayUnion(
      options.communityRelays,
      {
        kinds: uniqueNumbers(Object.values(options.communityKinds)),
        limit: 2_000,
      },
      options.signal,
    ),
    queryRelayUnion(
      options.officialRelays,
      {
        kinds: uniqueNumbers(Object.values(options.securityKinds)),
        limit: 2_000,
      },
      options.signal,
    ),
  ]);
  const community = materializeCommunity(
    communityResult.events,
    options.communityKinds,
    pluginAddresses,
  );
  const security = materializeSecurity(
    securityResult.events,
    options.securityKinds,
    options.securityAuthorities,
    { trustedArtifactByRelease: trustedArtifacts },
  );

  return {
    snapshot,
    registry: snapshot.registry,
    projection: projectV1(snapshot.registry, snapshot.snapshot.generatedAt),
    community,
    security,
    sources: {
      official: snapshot.resolution,
      community: communityResult.sources,
      security: securityResult.sources,
    },
  };
}

export async function createLiveSnapshotTemplate(
  relays: readonly RegistryRelay[],
  kinds: RegistryKindMap,
  authorities: RegistryAuthorities,
  createdAt: number,
  signal?: AbortSignal,
): Promise<{ registry: MaterializedRegistry; template: NostrEventTemplate }> {
  const result = await queryRelayUnion(
    relays,
    { kinds: uniqueNumbers(Object.values(kinds)), limit: 2_000 },
    signal,
  );
  if (result.sources.some((source) => source.eventIds.length >= 2_000)) {
    throw new Error(
      "Live registry query reached the relay limit; snapshot publication requires a paginated operator job",
    );
  }
  const registry = materializeRegistry(result.events, kinds, authorities);
  const content = createSnapshotContent(
    registry,
    new Date(createdAt * 1_000).toISOString(),
  );
  return {
    registry,
    template: createSnapshotEventTemplate(content, kinds, createdAt),
  };
}

export async function queryRelayUnion(
  relays: readonly RegistryRelay[],
  filter: RelayFilter,
  signal?: AbortSignal,
): Promise<{ events: NostrEvent[]; sources: RelayQuerySource[] }> {
  if (relays.length === 0) throw new Error("At least one relay is required");
  const settled = await Promise.all(
    relays.map(async (relay) => {
      try {
        const events = await relay.query(filter, signal);
        return { relay: relay.url, events };
      } catch (error) {
        return {
          relay: relay.url,
          events: [] as NostrEvent[],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  if (settled.every((result) => result.error !== undefined)) {
    throw new Error(
      `No configured relay answered the query: ${settled
        .map((result) => `${result.relay}: ${result.error}`)
        .join("; ")}`,
    );
  }
  const distinct = new Map<string, NostrEvent>();
  for (const result of settled) {
    for (const event of result.events) {
      distinct.set(canonicalJson(event as unknown as JsonValue), event);
    }
  }
  return {
    events: [...distinct.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([, event]) => event),
    sources: settled.map((result) => ({
      relay: result.relay,
      eventIds: [...new Set(result.events.map((event) => event.id))].toSorted(),
      ...(result.error === undefined ? {} : { error: result.error }),
    })),
  };
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].toSorted((left, right) => left - right);
}
