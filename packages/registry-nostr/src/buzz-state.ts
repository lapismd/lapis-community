import {
  BUZZ_REGISTRY_KINDS,
  getBuzzManifestAttachment,
  LAPIS_BUZZ_GROUP_PATHS,
  LAPIS_RELEASE_TOPIC,
  lapisBuzzGroupId,
  materializeBuzzRegistry,
  projectBuzzV1,
} from "@lapismd/registry-protocol";
import type {
  BuzzCatalogPlugin,
  BuzzRegistryAuthorities,
  BuzzReleaseManifestSource,
  MaterializedBuzzRegistry,
  NostrEvent,
  V1Projection,
} from "@lapismd/registry-protocol";

import { queryRelayUnion } from "./state.js";
import type { RelayQuerySource } from "./state.js";
import type { RegistryRelay, RelayAuthSigner } from "./transport.js";

export interface BuzzRelayRegistryState {
  registry: MaterializedBuzzRegistry;
  projection: V1Projection;
  events: NostrEvent[];
  manifests: BuzzReleaseManifestSource[];
  sources: RelayQuerySource[];
}

export interface BuzzRelayRegistryStateOptions {
  relays: readonly RegistryRelay[];
  catalog: readonly BuzzCatalogPlugin[];
  authorities: BuzzRegistryAuthorities;
  generatedAt: string;
  authSigner?: RelayAuthSigner | undefined;
  fetch?: typeof globalThis.fetch | undefined;
  signal?: AbortSignal | undefined;
}

export async function loadBuzzRelayRegistryState(
  options: BuzzRelayRegistryStateOptions,
): Promise<BuzzRelayRegistryState> {
  if (options.authSigner !== undefined) {
    await Promise.all(
      options.relays.map(async (relay) => {
        if (relay.authenticate === undefined) {
          throw new Error(
            `${relay.url}: relay transport does not support NIP-42`,
          );
        }
        await relay.authenticate(options.authSigner!, options.signal);
      }),
    );
  }
  const groupId = lapisBuzzGroupId(LAPIS_BUZZ_GROUP_PATHS.pluginReleases);
  const [releaseResult, decisionResult] = await Promise.all([
    queryRelayUnion(
      options.relays,
      {
        kinds: [BUZZ_REGISTRY_KINDS.streamMessage],
        "#h": [groupId],
        "#t": [LAPIS_RELEASE_TOPIC],
        limit: 2_000,
      },
      options.signal,
    ),
    queryRelayUnion(
      options.relays,
      {
        kinds: [BUZZ_REGISTRY_KINDS.reaction],
        "#h": [groupId],
        limit: 2_000,
      },
      options.signal,
    ),
  ]);
  const events = distinctEvents([
    ...releaseResult.events,
    ...decisionResult.events,
  ]);
  const manifests = await fetchBuzzReleaseManifests(
    events,
    options.fetch ?? globalThis.fetch,
    options.signal,
  );
  const registry = materializeBuzzRegistry(
    events,
    manifests,
    options.catalog,
    options.authorities,
  );
  return {
    registry,
    projection: projectBuzzV1(registry, options.generatedAt),
    events,
    manifests,
    sources: mergeSources(releaseResult.sources, decisionResult.sources),
  };
}

export async function fetchBuzzReleaseManifests(
  events: readonly NostrEvent[],
  fetcher: typeof globalThis.fetch,
  signal?: AbortSignal,
): Promise<BuzzReleaseManifestSource[]> {
  const attachments = new Map(
    events.flatMap((event) => {
      const attachment = getBuzzManifestAttachment(event);
      return attachment === undefined
        ? []
        : [[attachment.sha256, attachment] as const];
    }),
  );
  return await Promise.all(
    [...attachments.values()]
      .toSorted((left, right) => left.sha256.localeCompare(right.sha256))
      .map(async (attachment) => {
        const response = await fetcher(attachment.url, {
          ...(signal === undefined ? {} : { signal }),
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(
            `Release manifest ${attachment.sha256} returned ${response.status}`,
          );
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        const digest = new Uint8Array(
          await globalThis.crypto.subtle.digest("SHA-256", bytes),
        );
        const actual = [...digest]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");
        if (actual !== attachment.sha256) {
          throw new Error(
            `Release manifest ${attachment.sha256} failed SHA-256 verification`,
          );
        }
        return {
          attachmentSha256: attachment.sha256,
          manifest: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
        };
      }),
  );
}

function distinctEvents(events: readonly NostrEvent[]): NostrEvent[] {
  return [
    ...new Map(
      events
        .toSorted((left, right) => left.id.localeCompare(right.id))
        .map((event) => [event.id, event]),
    ).values(),
  ];
}

function mergeSources(
  ...sets: readonly (readonly RelayQuerySource[])[]
): RelayQuerySource[] {
  const merged = new Map<string, RelayQuerySource>();
  for (const source of sets.flat()) {
    const current = merged.get(source.relay);
    merged.set(source.relay, {
      relay: source.relay,
      eventIds: [
        ...new Set([...(current?.eventIds ?? []), ...source.eventIds]),
      ].toSorted(),
      ...(source.error === undefined ? {} : { error: source.error }),
    });
  }
  return [...merged.values()].toSorted((left, right) =>
    left.relay.localeCompare(right.relay),
  );
}
