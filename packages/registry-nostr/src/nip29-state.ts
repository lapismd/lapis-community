import {
  NIP29_KINDS,
  getNip29ManifestAttachment,
  LAPIS_GROUPS,
  LAPIS_RELEASE_TOPIC,
  lapisGroupId,
  materializeNip29Registry,
  projectNip29Registry,
} from "@lapismd/registry-protocol";
import type {
  Nip29RegistryAuthorities,
  Nip29ReleaseManifestSource,
  MaterializedNip29Registry,
  NostrEvent,
  RegistryProjection,
} from "@lapismd/registry-protocol";

import { queryRelayUnion } from "./query.js";
import type { RelayQuerySource } from "./query.js";
import type { RegistryRelay, RelayAuthSigner } from "./transport.js";

export interface Nip29RelayRegistryState {
  registry: MaterializedNip29Registry;
  projection: RegistryProjection;
  events: NostrEvent[];
  manifests: Nip29ReleaseManifestSource[];
  sources: RelayQuerySource[];
}

export interface Nip29RelayRegistryStateOptions {
  relays: readonly RegistryRelay[];
  authorities: Nip29RegistryAuthorities;
  generatedAt: string;
  authSigner?: RelayAuthSigner | undefined;
  fetch?: typeof globalThis.fetch | undefined;
  signal?: AbortSignal | undefined;
}

export async function loadNip29RelayRegistryState(
  options: Nip29RelayRegistryStateOptions,
): Promise<Nip29RelayRegistryState> {
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
  const groupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);
  const releaseResult = await queryRelayUnion(
    options.relays,
    {
      kinds: [NIP29_KINDS.streamMessage],
      "#h": [groupId],
      "#t": [LAPIS_RELEASE_TOPIC],
      limit: 2_000,
    },
    options.signal,
  );
  const decisionResult = await queryRelayUnion(
    options.relays,
    {
      kinds: [NIP29_KINDS.reaction],
      "#e": releaseResult.events.map((event) => event.id),
      limit: 2_000,
    },
    options.signal,
  );
  const events = distinctEvents([
    ...releaseResult.events,
    ...decisionResult.events,
  ]);
  const manifests = await fetchNip29ReleaseManifests(events, {
    fetch: options.fetch ?? ((input, init) => globalThis.fetch(input, init)),
    mediaAuthSigner: options.authSigner,
    relayUrls: options.relays.map((relay) => relay.url),
    signal: options.signal,
  });
  const registry = materializeNip29Registry(
    events,
    manifests,
    options.authorities,
  );
  return {
    registry,
    projection: projectNip29Registry(registry, options.generatedAt),
    events,
    manifests,
    sources: mergeSources(releaseResult.sources, decisionResult.sources),
  };
}

export async function fetchNip29ReleaseManifests(
  events: readonly NostrEvent[],
  options: {
    fetch: typeof globalThis.fetch;
    mediaAuthSigner?: RelayAuthSigner | undefined;
    relayUrls?: readonly string[] | undefined;
    signal?: AbortSignal | undefined;
  },
): Promise<Nip29ReleaseManifestSource[]> {
  const attachments = new Map(
    events.flatMap((event) => {
      const attachment = getNip29ManifestAttachment(event);
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
          ["server", origin],
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
