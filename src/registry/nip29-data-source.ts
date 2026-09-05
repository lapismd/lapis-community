import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { generateSecretKey, verifyEvent } from "nostr-tools/pure";

import {
  SecretKeyRegistrySigner,
  authenticateRegistryRelay,
  type RegistrySigner,
} from "../auth/index.js";
import {
  fetchNip29ReleaseManifestDocuments,
  queryRelayUnion,
  type CommunityRelayFactory,
  type CommunityRelaySubscription,
  type Nip29ReleaseManifestDocument,
  type RelayQuerySource,
} from "../nostr/index.js";
import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import {
  canonicalHash,
  getNip29ManifestAttachment,
  isNip29PublisherAuthorized,
  LAPIS_GROUPS,
  LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
  LAPIS_RELEASE_TOPIC,
  lapisGroupId,
  materializeNip29Registry,
  NIP29_KINDS,
  projectNip29Registry,
  type JsonObject,
  type MaterializedNip29Registry,
  type Nip29RegistryAuthorities,
  type Nip29ReleaseManifestSource,
  type NostrEvent,
  type NostrReleaseProof,
} from "../protocol/index.js";

import {
  registryCatalogDetailSchema,
  registryCatalogIndexSchema,
  type LiveRegistryCatalogDataSource,
  type RegistryCatalogDetail,
  type RegistryCatalogIndex,
  type RegistryCatalogRelayStatus,
  type RegistryCatalogSourceEvent,
  type RegistryCatalogSourceListener,
  type RegistryCatalogSourceStatus,
  type RegistryImageReference,
  type RegistryLoadOptions,
  type RegistryMarkdownReference,
  type RegistryReleaseDiagnostic,
  type RegistryRuntime,
} from "./model.js";
import {
  failedRegistryReleaseInspection,
  inspectRegistryReleaseCandidate,
  recognizeRegistryReleaseCandidate,
} from "./release-inspection.js";
import {
  createBrowserRegistrySnapshotStore,
  type RegistryEventSnapshot,
  type RegistryManifestSnapshot,
  type RegistrySnapshotStore,
} from "./snapshot-store.js";

export interface Nip29RegistryCatalogDataSourceOptions {
  relays: readonly string[];
  authorities: Nip29RegistryAuthorities;
  relayFactory: CommunityRelayFactory;
  readerSigner?: RegistrySigner;
  blossomUrl?: string | URL;
  snapshotStore?: RegistrySnapshotStore;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  liveBatchMs?: number;
  installQuorum?: number;
}

interface CurrentProjection {
  index: RegistryCatalogIndex;
  details: ReadonlyMap<string, RegistryCatalogDetail>;
  runtime: RegistryRuntime;
  registry: MaterializedNip29Registry;
}

const RELEASE_LIMIT = 2_000;

export function createNip29RegistryCatalogDataSource(
  options: Nip29RegistryCatalogDataSourceOptions,
): LiveRegistryCatalogDataSource {
  const relayUrls = options.relays.map(normalizeRelayUrl);
  if (relayUrls.length === 0) {
    throw new Error("At least one registry relay is required");
  }
  const authorities = copyAuthorities(options.authorities);
  if (authorities.curatorPubkeys.size === 0) {
    throw new Error("At least one registry curator is required");
  }
  const installQuorum = options.installQuorum ?? relayUrls.length;
  if (
    !Number.isInteger(installQuorum) ||
    installQuorum < 1 ||
    installQuorum > relayUrls.length
  ) {
    throw new Error("installQuorum must be between one and the relay count");
  }

  const blossomUrl =
    options.blossomUrl === undefined
      ? undefined
      : credentialFreeHttpUrl(options.blossomUrl, "blossomUrl", true);
  const request =
    options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const now = options.now ?? (() => new Date());
  const liveBatchMs = Math.max(0, options.liveBatchMs ?? 250);
  const store = options.snapshotStore ?? createBrowserRegistrySnapshotStore();
  const readerSigner =
    options.readerSigner ?? new SecretKeyRegistrySigner(generateSecretKey());
  const signEvent = readerSigner.signEvent.bind(readerSigner);
  const relays = relayUrls.map((url) => options.relayFactory.create(url));
  const releaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);
  const snapshotKey = registrySnapshotKey(relayUrls, authorities);
  const listeners = new Set<RegistryCatalogSourceListener>();
  const subscriptions = new Set<CommunityRelaySubscription>();
  const pendingEvents = new Map<string, NostrEvent>();
  const manifestBytes = new Map<string, Uint8Array>();
  const authorizationByOrigin = new Map<string, Promise<string>>();
  const lifecycleController = new AbortController();

  let current: CurrentProjection | undefined;
  let currentEvents: NostrEvent[] = [];
  let candidateEvents: NostrEvent[] = [];
  let state: RegistryCatalogSourceStatus = {
    phase: "loading",
    fresh: false,
    installReady: false,
    relays: relayUrls.map((relay) => ({ relay })),
  };
  let storePromise: Promise<void> | undefined;
  let startPromise: Promise<void> | undefined;
  let refreshPromise: Promise<void> | undefined;
  let subscriptionsPromise: Promise<void> | undefined;
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function emit(event: RegistryCatalogSourceEvent): void {
    for (const listener of listeners) listener(event);
  }

  function updateStatus(next: RegistryCatalogSourceStatus): void {
    state = next;
    emit({ type: "status", status: state });
  }

  async function openStore(): Promise<void> {
    storePromise ??= store.open();
    await storePromise;
  }

  async function start(): Promise<void> {
    assertActive();
    if (current !== undefined) return;
    if (startPromise !== undefined) return await startPromise;
    startPromise = (async () => {
      await openStore();
      const cached = await store.loadSnapshot(snapshotKey);
      if (cached !== undefined) {
        try {
          const documents = verifiedSnapshotDocuments(cached, authorities);
          setProjection(
            cached.events,
            documents,
            cached.synchronizedAt,
            false,
            "cache",
            relayUrls.map((relay) => ({ relay })),
            false,
          );
          for (const document of cached.manifests) {
            manifestBytes.set(document.attachmentSha256, document.bytes);
          }
          void synchronize().catch(() => undefined);
          return;
        } catch {
          // A disposable cache is never allowed to bypass verification.
        }
      }
      await synchronize();
    })();
    try {
      await startPromise;
    } catch (cause) {
      startPromise = undefined;
      throw cause;
    }
  }

  async function startSubscriptions(signal: AbortSignal): Promise<void> {
    if (subscriptionsPromise !== undefined) return await subscriptionsPromise;
    subscriptionsPromise = (async () => {
      await Promise.allSettled(
        relays.map(async (relay) => {
          await authenticateRegistryRelay(relay, readerSigner, signal);
          const handlers = {
            onevent(event: NostrEvent) {
              pendingEvents.set(event.id, event);
              scheduleLiveProjection();
            },
          };
          const [releaseSubscription, decisionSubscription] = await Promise.all(
            [
              relay.subscribe(
                {
                  kinds: [NIP29_KINDS.streamMessage],
                  "#h": [releaseGroupId],
                  "#t": [
                    LAPIS_RELEASE_TOPIC,
                    LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
                  ],
                },
                handlers,
                signal,
              ),
              relay.subscribe(
                {
                  kinds: [NIP29_KINDS.reaction],
                  "#h": [releaseGroupId],
                },
                handlers,
                signal,
              ),
            ],
          );
          subscriptions.add(releaseSubscription);
          subscriptions.add(decisionSubscription);
        }),
      );
    })();
    return await subscriptionsPromise;
  }

  async function synchronize(externalSignal?: AbortSignal): Promise<void> {
    assertActive();
    if (refreshPromise !== undefined) return await refreshPromise;
    refreshPromise = (async () => {
      await openStore();
      const signal = combinedSignal(lifecycleController.signal, externalSignal);
      const previousStatus = state;
      updateStatus({
        ...state,
        phase: current === undefined ? "loading" : "refreshing",
      });
      try {
        await startSubscriptions(lifecycleController.signal);
        const releaseResult = await queryRelayUnion(
          relays,
          {
            kinds: [NIP29_KINDS.streamMessage],
            "#h": [releaseGroupId],
            "#t": [LAPIS_RELEASE_TOPIC, LAPIS_PUBLISHER_AUTHORIZATION_TOPIC],
            limit: RELEASE_LIMIT,
          },
          signal,
        );
        const bufferedEvents = [...pendingEvents.values()];
        const releases = mergeEvents(
          currentEvents,
          releaseResult.events,
          bufferedEvents,
        ).filter(
          (event) =>
            event.kind === NIP29_KINDS.streamMessage &&
            event.tags.some(
              (tag) => tag[0] === "t" && tag[1] === LAPIS_RELEASE_TOPIC,
            ),
        );
        const releaseIds = releases.map((event) => event.id);
        const decisionResult =
          releaseIds.length === 0
            ? {
                events: [],
                sources: successfulEmptySources(releaseResult.sources),
              }
            : await queryRelayUnion(
                relays,
                {
                  kinds: [NIP29_KINDS.reaction],
                  "#e": releaseIds,
                  limit: RELEASE_LIMIT,
                },
                signal,
              );
        const relayStatuses = mergedRelayStatuses(
          relayUrls,
          releaseResult.sources,
          decisionResult.sources,
        );
        if (!relayStatuses.some((relay) => relay.error === undefined)) {
          throw new Error(
            "No configured relay returned a complete registry snapshot",
          );
        }
        const events = mergeEvents(
          currentEvents,
          releaseResult.events,
          decisionResult.events,
          bufferedEvents,
        );
        candidateEvents = events;
        const documents = await hydrateManifestDocuments(events, signal);
        const synchronizedAt = now().toISOString();
        setProjection(
          events,
          documents,
          synchronizedAt,
          true,
          "relay",
          relayStatuses,
          true,
        );
        removePendingEvents(bufferedEvents);
        await saveSnapshot(events, documents, synchronizedAt);
      } catch (cause) {
        if (signal.aborted || isAbortError(cause)) {
          updateStatus(previousStatus);
          throw cause;
        }
        const message =
          cause instanceof Error ? cause.message : "Registry refresh failed";
        updateStatus({
          ...state,
          phase: current === undefined ? "error" : "degraded",
          fresh: false,
          installReady: false,
          message,
        });
        throw cause;
      } finally {
        refreshPromise = undefined;
      }
    })();
    return await refreshPromise;
  }

  function scheduleLiveProjection(): void {
    if (disposed || liveTimer !== undefined) return;
    liveTimer = setTimeout(() => {
      liveTimer = undefined;
      void applyPendingLiveEvents().catch(() => undefined);
    }, liveBatchMs);
  }

  async function applyPendingLiveEvents(): Promise<void> {
    if (pendingEvents.size === 0 || current === undefined) return;
    const bufferedEvents = [...pendingEvents.values()];
    const events = mergeEvents(currentEvents, bufferedEvents);
    candidateEvents = events;
    try {
      const documents = await hydrateManifestDocuments(
        events,
        lifecycleController.signal,
      );
      const synchronizedAt = now().toISOString();
      setProjection(
        events,
        documents,
        synchronizedAt,
        state.fresh,
        "relay",
        state.relays,
        true,
      );
      removePendingEvents(bufferedEvents);
      await saveSnapshot(events, documents, synchronizedAt);
    } catch (cause) {
      if (lifecycleController.signal.aborted || isAbortError(cause)) return;
      updateStatus({
        ...state,
        phase: "degraded",
        fresh: false,
        installReady: false,
        message:
          cause instanceof Error
            ? cause.message
            : "A live registry update could not be verified",
      });
    }
  }

  function removePendingEvents(events: readonly NostrEvent[]): void {
    for (const event of events) {
      if (pendingEvents.get(event.id) === event) pendingEvents.delete(event.id);
    }
  }

  async function hydrateManifestDocuments(
    events: readonly NostrEvent[],
    signal: AbortSignal,
  ): Promise<Nip29ReleaseManifestDocument[]> {
    const authorized = authorizedReleaseEvents(events, authorities);
    const documents = new Map<string, Nip29ReleaseManifestDocument>();
    const missing: NostrEvent[] = [];
    for (const event of authorized) {
      const attachment = getNip29ManifestAttachment(event);
      if (attachment === undefined) continue;
      const bytes = manifestBytes.get(attachment.sha256);
      if (bytes === undefined) {
        missing.push(event);
        continue;
      }
      try {
        documents.set(
          attachment.sha256,
          manifestDocument(attachment.sha256, bytes, attachment.size),
        );
      } catch {
        manifestBytes.delete(attachment.sha256);
        missing.push(event);
      }
    }
    if (missing.length > 0) {
      const fetched = await fetchNip29ReleaseManifestDocuments(missing, {
        fetch: request,
        mediaAuthSigner: signEvent,
        relayUrls,
        signal,
      });
      for (const document of fetched) {
        manifestBytes.set(document.attachmentSha256, document.bytes);
        documents.set(document.attachmentSha256, document);
      }
    }
    return [...documents.values()].toSorted((left, right) =>
      left.attachmentSha256.localeCompare(right.attachmentSha256),
    );
  }

  function setProjection(
    events: readonly NostrEvent[],
    documents: readonly Nip29ReleaseManifestSource[],
    synchronizedAt: string,
    fresh: boolean,
    origin: "cache" | "relay",
    relayStatuses: readonly RegistryCatalogRelayStatus[],
    announceRevision: boolean,
  ): void {
    const registry = materializeNip29Registry(events, documents, authorities);
    const projection = projectNip29Registry(registry, synchronizedAt);
    const index = registryCatalogIndexSchema.parse(projection.index);
    const details = new Map(
      [...projection.plugins.entries()].map(([pluginId, detail]) => [
        pluginId,
        registryCatalogDetailSchema.parse(detail),
      ]),
    );
    const registryRoot = projectionRoot(
      registry.acceptedEventIds,
      projection.index,
      projection.plugins,
    );
    const publisherPubkeys = [
      ...(authorities.defaultPublisherPubkeys ?? []),
      ...[...authorities.publisherPubkeysByPlugin.values()].flatMap(
        (values) => [...values],
      ),
      ...registry.plugins.flatMap((plugin) =>
        plugin.releases.map((release) => release.event.pubkey),
      ),
    ];
    current = {
      index,
      details,
      registry,
      runtime: {
        schemaVersion: 1,
        backend: "nostr-nip29",
        registryRoot,
        sourceRegistryRoot: registry.root,
        relays: relayUrls,
        releaseGroupId,
        curatorPubkeys: [...authorities.curatorPubkeys].toSorted(),
        publisherPubkeys: [...new Set(publisherPubkeys)].toSorted(),
      },
    };
    currentEvents = mergeEvents(events);
    candidateEvents = currentEvents;
    state = {
      phase: "ready",
      fresh,
      installReady:
        origin === "relay" &&
        relayStatuses.filter((relay) => relay.error === undefined).length >=
          installQuorum,
      origin,
      registryRoot,
      synchronizedAt,
      relays: relayStatuses,
      ...(relayStatuses.some((relay) => relay.error !== undefined)
        ? { message: "Some configured registry relays were unavailable" }
        : {}),
    };
    if (announceRevision) emit({ type: "revision", status: state });
    else emit({ type: "status", status: state });
  }

  async function saveSnapshot(
    events: readonly NostrEvent[],
    documents: readonly Nip29ReleaseManifestDocument[],
    synchronizedAt: string,
  ): Promise<void> {
    await store.saveSnapshot({
      schemaVersion: 1,
      key: snapshotKey,
      synchronizedAt,
      events,
      manifests: documents.map((document) => ({
        attachmentSha256: document.attachmentSha256,
        bytes: document.bytes,
      })),
    });
  }

  async function loadVerifiedResource(
    reference: RegistryImageReference | RegistryMarkdownReference,
    loadOptions: RegistryLoadOptions = {},
  ): Promise<Uint8Array> {
    await openStore();
    loadOptions.signal?.throwIfAborted();
    const cached = await store.loadResource(reference.sha256);
    if (cached !== undefined) {
      try {
        verifyResource(reference, cached.bytes);
        return cached.bytes;
      } catch {
        // Fetching the signed source can replace a corrupt disposable entry.
      }
    }
    let finalError: unknown;
    for (const source of resourceSources(reference, blossomUrl)) {
      try {
        const authorization = await resourceAuthorization(source);
        const response = await request(source, {
          headers: {
            Accept: reference.mediaType,
            ...(authorization === undefined
              ? {}
              : { Authorization: authorization }),
          },
          ...(loadOptions.signal === undefined
            ? {}
            : { signal: loadOptions.signal }),
        });
        if (!response.ok) {
          throw new Error(`${source.toString()} returned ${response.status}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        verifyResource(reference, bytes);
        await store.saveResource({
          sha256: reference.sha256,
          mediaType: reference.mediaType,
          bytes,
          lastAccessedAt: Date.now(),
        });
        return bytes;
      } catch (cause) {
        if (loadOptions.signal?.aborted === true || isAbortError(cause)) {
          throw cause;
        }
        finalError = cause;
      }
    }
    throw finalError ?? new Error("Registry resource has no verified source");
  }

  async function resourceAuthorization(
    source: URL,
  ): Promise<string | undefined> {
    if (!relayUrls.map(relayHttpOrigin).includes(source.origin))
      return undefined;
    let authorization = authorizationByOrigin.get(source.origin);
    if (authorization === undefined) {
      authorization = (async () => {
        const createdAt = Math.floor(now().getTime() / 1_000);
        const event = await readerSigner.signEvent({
          kind: 24_242,
          created_at: createdAt,
          content: "Get Lapis registry resource",
          tags: [
            ["t", "get"],
            ["expiration", String(createdAt + 600)],
            ["server", source.origin],
            ["server", source.host],
          ],
        });
        return encodeNostrHttpAuthorization(event);
      })();
      authorizationByOrigin.set(source.origin, authorization);
    }
    return await authorization;
  }

  function requireCurrent(): CurrentProjection {
    if (current === undefined)
      throw new Error("Registry catalog is unavailable");
    return current;
  }

  function assertActive(): void {
    if (disposed) throw new Error("Registry catalog source is disposed");
  }

  return {
    async loadIndex(loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      await waitForSignal(start(), loadOptions?.signal);
      return requireCurrent().index;
    },
    async loadRuntime(loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      await waitForSignal(start(), loadOptions?.signal);
      return requireCurrent().runtime;
    },
    async loadPluginDetail(entry, loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      await waitForSignal(start(), loadOptions?.signal);
      const detail = requireCurrent().details.get(entry.id);
      if (detail === undefined) {
        throw new Error(
          `${entry.id}: plugin detail is not in the registry snapshot`,
        );
      }
      return detail;
    },
    async loadMarkdown(reference, loadOptions) {
      const bytes = await loadVerifiedResource(reference, loadOptions);
      return new TextDecoder().decode(bytes);
    },
    async loadImage(reference, loadOptions) {
      const bytes = await loadVerifiedResource(reference, loadOptions);
      return new Blob([bytes], { type: reference.mediaType });
    },
    async loadReleaseInspection(eventId, loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      try {
        await waitForSignal(start(), loadOptions?.signal);
      } catch (cause) {
        if (loadOptions?.signal?.aborted || isAbortError(cause)) throw cause;
        // Candidate events captured before a failed projection remain inspectable.
      }
      const events = mergeEvents(candidateEvents, currentEvents, [
        ...pendingEvents.values(),
      ]);
      const event = events.find((candidate) => candidate.id === eventId);
      if (event === undefined) {
        return undefined;
      }
      const candidate = recognizeRegistryReleaseCandidate(
        event,
        authorities,
        events,
      );
      if (candidate === undefined) return undefined;
      if (!candidate.trusted || candidate.manifestSha256 === undefined) {
        return inspectRegistryReleaseCandidate(
          candidate,
          events,
          undefined,
          now().toISOString(),
          authorities,
        );
      }

      const attachment = getNip29ManifestAttachment(event);
      if (attachment === undefined) {
        return inspectRegistryReleaseCandidate(
          candidate,
          events,
          undefined,
          now().toISOString(),
          authorities,
        );
      }
      try {
        let document: Nip29ReleaseManifestDocument;
        const cached = manifestBytes.get(attachment.sha256);
        if (cached === undefined) {
          const fetched = await fetchNip29ReleaseManifestDocuments([event], {
            fetch: request,
            mediaAuthSigner: signEvent,
            relayUrls,
            ...(loadOptions?.signal === undefined
              ? {}
              : { signal: loadOptions.signal }),
          });
          document = fetched[0]!;
          manifestBytes.set(document.attachmentSha256, document.bytes);
        } else {
          document = manifestDocument(
            attachment.sha256,
            cached,
            attachment.size,
          );
        }
        return inspectRegistryReleaseCandidate(
          candidate,
          events,
          document.manifest,
          now().toISOString(),
          authorities,
        );
      } catch (cause) {
        if (loadOptions?.signal?.aborted || isAbortError(cause)) throw cause;
        const message =
          cause instanceof Error
            ? cause.message
            : "Release manifest could not be loaded";
        const invalid =
          cause instanceof SyntaxError ||
          message.includes("failed size verification") ||
          message.includes("failed SHA-256 verification") ||
          message.includes("failed verification") ||
          message.includes("must use HTTP(S)");
        const diagnostic: RegistryReleaseDiagnostic = {
          stage: invalid ? "manifest" : "attachment",
          code: invalid ? "manifest-integrity" : "manifest-unavailable",
          path: "manifest",
          message: invalid
            ? "Release manifest failed integrity or JSON verification."
            : "Release manifest is currently unavailable.",
        };
        return failedRegistryReleaseInspection(
          candidate,
          invalid ? "invalid" : "unavailable",
          diagnostic,
        );
      }
    },
    async loadReleaseProof(pluginId, version, loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      await waitForSignal(start(), loadOptions?.signal);
      if (!state.installReady) {
        throw new Error(
          "Registry relay quorum is required before creating an install proof",
        );
      }
      const release = requireCurrent()
        .registry.plugins.find((plugin) => plugin.content.pluginId === pluginId)
        ?.releases.find((candidate) => candidate.content.version === version);
      if (release === undefined) {
        throw new Error(
          `${pluginId}@${version}: curated release is unavailable`,
        );
      }
      if (release.authorizationEvent === undefined) {
        throw new Error(
          `${pluginId}@${version}: portable proof requires a signed publisher authorization`,
        );
      }
      const bytes = manifestBytes.get(release.attachment.sha256);
      if (bytes === undefined) {
        throw new Error(
          `${pluginId}@${version}: release manifest is unavailable`,
        );
      }
      const proof: NostrReleaseProof = {
        schema: "lapis.plugin.release-proof/1",
        authorizationEvent: release.authorizationEvent,
        releaseEvent: release.event,
        decisionEvent: release.decisionEvent,
        manifest: {
          sha256: release.attachment.sha256,
          size: bytes.byteLength,
          content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        },
      };
      return proof;
    },
    getStatus() {
      return state;
    },
    subscribe(listener) {
      assertActive();
      listeners.add(listener);
      listener({ type: "status", status: state });
      return () => listeners.delete(listener);
    },
    async refresh(loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      await synchronize(loadOptions?.signal);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifecycleController.abort(new DOMException("Disposed", "AbortError"));
      if (liveTimer !== undefined) clearTimeout(liveTimer);
      for (const subscription of subscriptions) subscription.close();
      subscriptions.clear();
      for (const relay of relays) relay.close();
      listeners.clear();
      void store.close();
    },
  };
}

function copyAuthorities(
  authorities: Nip29RegistryAuthorities,
): Nip29RegistryAuthorities {
  return {
    curatorPubkeys: new Set(authorities.curatorPubkeys),
    publisherPubkeysByPlugin: new Map(
      [...authorities.publisherPubkeysByPlugin].map(([pluginId, pubkeys]) => [
        pluginId,
        new Set(pubkeys),
      ]),
    ),
    ...(authorities.defaultPublisherPubkeys === undefined
      ? {}
      : {
          defaultPublisherPubkeys: new Set(authorities.defaultPublisherPubkeys),
        }),
  };
}

function registrySnapshotKey(
  relays: readonly string[],
  authorities: Nip29RegistryAuthorities,
): string {
  return canonicalHash({
    schemaVersion: 1,
    relays: [...relays].toSorted(),
    curatorPubkeys: [...authorities.curatorPubkeys].toSorted(),
    defaultPublisherPubkeys: [
      ...(authorities.defaultPublisherPubkeys ?? []),
    ].toSorted(),
    publisherPubkeysByPlugin: Object.fromEntries(
      [...authorities.publisherPubkeysByPlugin.entries()]
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([pluginId, pubkeys]) => [pluginId, [...pubkeys].toSorted()]),
    ),
    releaseGroupId: lapisGroupId(LAPIS_GROUPS.pluginReleases),
  });
}

function verifiedSnapshotDocuments(
  snapshot: RegistryEventSnapshot,
  authorities: Nip29RegistryAuthorities,
): Nip29ReleaseManifestDocument[] {
  if (snapshot.events.some((event) => !verifyEvent(event))) {
    throw new Error("Cached registry snapshot contains an invalid event");
  }
  const attachments = new Map(
    authorizedReleaseEvents(snapshot.events, authorities).flatMap((event) => {
      const attachment = getNip29ManifestAttachment(event);
      return attachment === undefined
        ? []
        : [[attachment.sha256, attachment] as const];
    }),
  );
  const documents = snapshot.manifests.map((manifest) => {
    const attachment = attachments.get(manifest.attachmentSha256);
    if (attachment === undefined) {
      throw new Error("Cached registry manifest has no signed attachment");
    }
    return manifestDocument(
      manifest.attachmentSha256,
      manifest.bytes,
      attachment.size,
    );
  });
  if (documents.length !== attachments.size) {
    throw new Error("Cached registry snapshot is missing a manifest");
  }
  return documents;
}

function manifestDocument(
  attachmentSha256: string,
  bytes: Uint8Array,
  expectedSize: number,
): Nip29ReleaseManifestDocument {
  if (bytes.byteLength !== expectedSize || digest(bytes) !== attachmentSha256) {
    throw new Error(`Release manifest ${attachmentSha256} failed verification`);
  }
  return {
    attachmentSha256,
    bytes,
    manifest: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
  };
}

function authorizedReleaseEvents(
  events: readonly NostrEvent[],
  authorities: Nip29RegistryAuthorities | undefined,
): NostrEvent[] {
  const releaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);
  return events.filter((event) => {
    if (
      event.kind !== NIP29_KINDS.streamMessage ||
      event.tags.find((tag) => tag[0] === "h")?.[1] !== releaseGroupId ||
      !event.tags.some(
        (tag) => tag[0] === "t" && tag[1] === LAPIS_RELEASE_TOPIC,
      )
    ) {
      return false;
    }
    if (authorities === undefined) return true;
    const pluginTopics = event.tags
      .filter((tag) => tag[0] === "t" && tag[1]?.startsWith("plugin:") === true)
      .map((tag) => tag[1]!.slice("plugin:".length));
    if (pluginTopics.length !== 1) return false;
    return isNip29PublisherAuthorized(
      events,
      authorities,
      pluginTopics[0]!,
      event.pubkey,
    );
  });
}

function projectionRoot(
  acceptedEventIds: readonly string[],
  index: JsonObject,
  plugins: ReadonlyMap<string, JsonObject>,
): string {
  return canonicalHash({
    acceptedEventIds: [...acceptedEventIds].toSorted(),
    index,
    plugins: Object.fromEntries(
      [...plugins].toSorted(([left], [right]) => left.localeCompare(right)),
    ),
  });
}

function mergedRelayStatuses(
  relayUrls: readonly string[],
  releases: readonly RelayQuerySource[],
  decisions: readonly RelayQuerySource[],
): RegistryCatalogRelayStatus[] {
  return relayUrls.map((relay) => {
    const release = releases.find((source) => source.relay === relay);
    const decision = decisions.find((source) => source.relay === relay);
    const errors = [release?.error, decision?.error].filter(
      (error): error is string => error !== undefined,
    );
    return {
      relay,
      ...(release === undefined || decision === undefined || errors.length > 0
        ? {
            error:
              errors.join("; ") || "Relay did not complete the registry query",
          }
        : {}),
    };
  });
}

function successfulEmptySources(
  sources: readonly RelayQuerySource[],
): RelayQuerySource[] {
  return sources.map((source) => ({
    relay: source.relay,
    eventIds: [],
    ...(source.error === undefined ? {} : { error: source.error }),
  }));
}

function mergeEvents(
  ...sets: readonly (readonly NostrEvent[])[]
): NostrEvent[] {
  const merged = new Map<string, NostrEvent>();
  for (const event of sets.flat()) {
    if (!verifyEvent(event)) continue;
    const current = merged.get(event.id);
    if (
      current === undefined ||
      JSON.stringify(event) < JSON.stringify(current)
    ) {
      merged.set(event.id, event);
    }
  }
  return [...merged.values()].toSorted(
    (left, right) =>
      left.created_at - right.created_at || left.id.localeCompare(right.id),
  );
}

function verifyResource(
  reference: RegistryImageReference | RegistryMarkdownReference,
  bytes: Uint8Array,
): void {
  if (bytes.byteLength !== reference.size) {
    throw new Error(`${reference.sourceUrl} failed size verification`);
  }
  if (digest(bytes) !== reference.sha256) {
    throw new Error(`${reference.sourceUrl} failed SHA-256 verification`);
  }
}

function digest(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function resourceSources(
  reference: RegistryImageReference | RegistryMarkdownReference,
  blossomUrl: URL | undefined,
): URL[] {
  const source = credentialFreeHttpUrl(
    reference.sourceUrl,
    "Registry resource sourceUrl",
  );
  if (!reference.mediaType.startsWith("image/") || blossomUrl === undefined) {
    return [source];
  }
  const blossom = new URL(source.pathname.replace(/^\/+/, ""), blossomUrl);
  return blossom.href === source.href ? [source] : [blossom, source];
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
    throw new Error(
      `${label} must be an absolute HTTP(S) URL without credentials`,
    );
  }
  if (directory && !url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  if (
    (url.protocol !== "ws:" && url.protocol !== "wss:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error("Registry relays must use WS(S) URLs without credentials");
  }
  url.hash = "";
  return url.toString();
}

function relayHttpOrigin(relayUrl: string): string {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return url.origin;
}

function combinedSignal(
  lifecycle: AbortSignal,
  external: AbortSignal | undefined,
): AbortSignal {
  return external === undefined
    ? lifecycle
    : AbortSignal.any([lifecycle, external]);
}

async function waitForSignal<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (signal === undefined) return await operation;
  signal.throwIfAborted();
  return await new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void operation.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (cause) => {
        signal.removeEventListener("abort", abort);
        reject(cause);
      },
    );
  });
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}
