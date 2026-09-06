import {
  NIP29_KINDS,
  getNip29ManifestAttachment,
  LAPIS_GROUPS,
  LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
  LAPIS_REGISTRY_HEAD_TOPIC,
  LAPIS_RELEASE_TOPIC,
  lapisGroupId,
  materializeNip29Registry,
  projectNip29Registry,
} from "../protocol/index.js";
import type {
  Nip29RegistryAuthorities,
  Nip29ReleaseManifestSource,
  MaterializedNip29Registry,
  NostrEvent,
  RegistryProjection,
} from "../protocol/index.js";

import { queryRelayUnion } from "./query.js";
import type { RelayQuerySource } from "./query.js";
import type { RegistryRelay, RelayAuthSigner } from "./transport.js";
import { encodeNostrHttpAuthorization } from "./http-authorization.js";

export interface Nip29RelayRegistryState {
  registry: MaterializedNip29Registry;
  projection: RegistryProjection;
  events: NostrEvent[];
  manifests: Nip29ReleaseManifestSource[];
  sources: RelayQuerySource[];
}

export interface Nip29ReleaseManifestDocument
  extends Nip29ReleaseManifestSource {
  bytes: Uint8Array;
}

export interface Nip29RelayRegistryStateOptions {
  relays: readonly RegistryRelay[];
  authorities: Nip29RegistryAuthorities;
  generatedAt: string;
  authSigner?: RelayAuthSigner | undefined;
  blossomUrl?: string | URL | undefined;
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
      "#t": [
        LAPIS_RELEASE_TOPIC,
        LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
        LAPIS_REGISTRY_HEAD_TOPIC,
      ],
      limit: 2_000,
    },
    options.signal,
  );
  const decisionResult = await queryRelayUnion(
    options.relays,
    {
      kinds: [NIP29_KINDS.reaction],
      "#e": releaseResult.events
        .filter((event) =>
          event.tags.some(
            (tag) => tag[0] === "t" && tag[1] === LAPIS_RELEASE_TOPIC,
          ),
        )
        .map((event) => event.id),
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
    ...(options.blossomUrl === undefined
      ? {}
      : { blossomUrls: [options.blossomUrl] }),
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
    blossomUrls?: readonly (string | URL)[] | undefined;
    signal?: AbortSignal | undefined;
  },
): Promise<Nip29ReleaseManifestSource[]> {
  return await fetchNip29ReleaseManifestDocuments(events, options);
}

export async function fetchNip29ReleaseManifestDocuments(
  events: readonly NostrEvent[],
  options: {
    fetch: typeof globalThis.fetch;
    mediaAuthSigner?: RelayAuthSigner | undefined;
    relayUrls?: readonly string[] | undefined;
    blossomUrls?: readonly (string | URL)[] | undefined;
    signal?: AbortSignal | undefined;
  },
): Promise<Nip29ReleaseManifestDocument[]> {
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
        let finalError: unknown;
        for (const attachmentUrl of manifestSources(attachment, options)) {
          try {
            const origin = attachmentUrl.origin;
            const authorization =
              options.mediaAuthSigner !== undefined && mediaOrigins.has(origin)
                ? await mediaAuthorization(
                    origin,
                    options.mediaAuthSigner,
                    authorizationByOrigin,
                  )
                : undefined;
            const response = await options.fetch(attachmentUrl, {
              ...(options.signal === undefined
                ? {}
                : { signal: options.signal }),
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
            if (bytes.byteLength !== attachment.size) {
              throw new Error(
                `Release manifest ${attachment.sha256} failed size verification`,
              );
            }
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
              bytes,
              manifest: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
            };
          } catch (cause) {
            if (options.signal?.aborted === true) throw cause;
            finalError = cause;
          }
        }
        throw (
          finalError ??
          new Error(`Release manifest ${attachment.sha256} has no relay source`)
        );
      }),
  );
}

function manifestSources(
  attachment: { url: string; sha256: string },
  options: {
    relayUrls?: readonly string[] | undefined;
    blossomUrls?: readonly (string | URL)[] | undefined;
  },
): URL[] {
  const configured = options.blossomUrls?.map((value) =>
    credentialFreeHttpUrl(value, "Registry relay Blossom URL", true),
  );
  const relayBases = (options.relayUrls ?? []).map(relayHttpBaseUrl);
  const bases = configured?.length ? configured : relayBases;
  if (bases.length === 0) {
    return [
      credentialFreeHttpUrl(
        attachment.url,
        `Release manifest ${attachment.sha256}`,
      ),
    ];
  }
  return [
    ...new Map(
      bases.map((base) => {
        const source = new URL(attachment.sha256, base);
        return [source.href, source] as const;
      }),
    ).values(),
  ];
}

function credentialFreeHttpUrl(
  value: string | URL,
  label: string,
  directory = false,
): URL {
  const url = new URL(value);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error(`${label} must use HTTP(S) without credentials`);
  }
  if (directory && !url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function relayHttpOrigin(relayUrl: string): string {
  return relayHttpBaseUrl(relayUrl).origin;
}

function relayHttpBaseUrl(relayUrl: string): URL {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
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
      return encodeNostrHttpAuthorization(event);
    })();
    cache.set(origin, authorization);
  }
  return await authorization;
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
