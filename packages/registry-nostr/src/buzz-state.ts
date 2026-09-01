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
  const releaseResult = await queryRelayUnion(
    options.relays,
    {
      kinds: [BUZZ_REGISTRY_KINDS.streamMessage],
      "#h": [groupId],
      "#t": [LAPIS_RELEASE_TOPIC],
      limit: 2_000,
    },
    options.signal,
  );
  const decisionResult = await queryRelayUnion(
    options.relays,
    {
      kinds: [BUZZ_REGISTRY_KINDS.reaction],
      "#e": releaseResult.events.map((event) => event.id),
      limit: 2_000,
    },
    options.signal,
  );
  const events = distinctEvents([
    ...releaseResult.events,
    ...decisionResult.events,
  ]);
  const manifests = await fetchBuzzReleaseManifests(events, {
    fetch: options.fetch ?? globalThis.fetch,
    mediaAuthSigner: options.authSigner,
    relayUrls: options.relays.map((relay) => relay.url),
    signal: options.signal,
  });
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
  options: {
    fetch: typeof globalThis.fetch;
    mediaAuthSigner?: RelayAuthSigner | undefined;
    relayUrls?: readonly string[] | undefined;
    signal?: AbortSignal | undefined;
  },
): Promise<BuzzReleaseManifestSource[]> {
  const attachments = new Map(
    events.flatMap((event) => {
      const attachment = getBuzzManifestAttachment(event);
      return attachment === undefined
        ? []
        : [[attachment.sha256, attachment] as const];
    }),
  );
  const mediaOrigins = new Set(
    (options.relayUrls ?? []).map((relayUrl) => relayHttpOrigin(relayUrl)),
  );
  const authorizationByOrigin = new Map<string, Promise<string>>();
  return await Promise.all(
    [...attachments.values()]
      .toSorted((left, right) => left.sha256.localeCompare(right.sha256))
      .map(async (attachment) => {
        const origin = new URL(attachment.url).origin;
        const authorization =
          options.mediaAuthSigner !== undefined && mediaOrigins.has(origin)
            ? await mediaAuthorization(
                origin,
                options.mediaAuthSigner,
                authorizationByOrigin,
              )
            : undefined;
        const response = await options.fetch(attachment.url, {
          ...(options.signal === undefined ? {} : { signal: options.signal }),
          headers: {
            Accept: "application/json",
            ...(authorization === undefined
              ? {}
              : { Authorization: authorization }),
          },
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

function relayHttpOrigin(relayUrl: string): string {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return url.origin;
}

async function mediaAuthorization(
  origin: string,
  signer: RelayAuthSigner,
  cache: Map<string, Promise<string>>,
): Promise<string> {
  let authorization = cache.get(origin);
  if (authorization === undefined) {
    authorization = (async () => {
      const now = Math.floor(Date.now() / 1_000);
      const event = await signer({
        kind: 24_242,
        created_at: now,
        content: "Get Lapis release manifests",
        tags: [
          ["t", "get"],
          ["expiration", String(now + 600)],
          ["server", new URL(origin).host],
        ],
      });
      return `Nostr ${base64Url(JSON.stringify(event))}`;
    })();
    cache.set(origin, authorization);
  }
  return await authorization;
}

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis
    .btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
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
