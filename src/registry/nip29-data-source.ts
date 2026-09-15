import { generateSecretKey, verifyEvent } from "nostr-tools/pure";
import semver from "semver";

import {
  SecretKeyRegistrySigner,
  authenticateRegistryRelay,
  type RegistrySigner,
} from "../auth/index.js";
import {
  fetchNip29ReleaseManifestDocuments,
  queryRelayUnion,
  type CommunityRelay,
  type CommunityRelayFactory,
  type CommunityRelaySubscription,
  type Nip29ReleaseManifestDocument,
  type RelayQuerySource,
} from "../nostr/index.js";
import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import {
  canonicalHash,
  compareCanonicalDecimal,
  createNip29CuratorDecisionTemplate,
  createNip29PublisherWithdrawalTemplate,
  createNip29RegistryHeadTemplate,
  getNip29ManifestAttachment,
  isNip29PublisherAuthorized,
  LAPIS_GROUPS,
  LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
  LAPIS_REGISTRY_HEAD_TOPIC,
  LAPIS_RELEASE_TOPIC,
  lapisGroupId,
  materializeNip29Registry,
  nip29ReleaseManifestSchema,
  NIP29_KINDS,
  parseNip29ReleaseEvent,
  parseNip29CuratorDecision,
  parseNip29PublisherWithdrawal,
  parseNip29RegistryHead,
  projectNip29Registry,
  projectRegistry,
  type JsonObject,
  type MaterializedNip29Registry,
  type MaterializedNip29Release,
  type Nip29RegistryAuthorities,
  type Nip29ReleaseManifestSource,
  type NostrEvent,
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
  type RegistryReleaseManagementAction,
  type RegistryReleaseManagementCapabilities,
  type RegistryReleaseManagementResult,
  type RegistryReleaseReviewEntry,
  type RegistryReleaseInspection,
  type RegistryRuntime,
  type RegistryVersionSnapshot,
  type RegistryTrustState,
} from "./model.js";
import {
  failedRegistryReleaseInspection,
  inspectRegistryReleaseCandidate,
  recognizeRegistryReleaseCandidate,
} from "./release-inspection.js";
import {
  digest,
  hydrateRegistryManifestDocuments,
  manifestDocument,
  verifiedSnapshotDocuments,
} from "./nip29-hydrate.js";
import { subscribeRegistryCatalogRelays } from "./nip29-subscriptions.js";
import { createNip29ReleaseProof } from "./nip29-release-proof.js";
import {
  createBrowserRegistrySnapshotStore,
  type RegistryEventSnapshot,
  type RegistryManifestSnapshot,
  type RegistrySnapshotStore,
  type RegistryTrustRecord,
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
  versions: ReadonlyMap<string, RegistryVersionSnapshot>;
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

  const blossomUrls =
    options.blossomUrl === undefined
      ? relayUrls.map(relayHttpBaseUrl)
      : [credentialFreeHttpUrl(options.blossomUrl, "blossomUrl", true)];
  const blossomUrl = blossomUrls[0]!;
  const request =
    options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const now = options.now ?? (() => new Date());
  const liveBatchMs = Math.max(0, options.liveBatchMs ?? 250);
  const store = options.snapshotStore ?? createBrowserRegistrySnapshotStore();
  const readerSigner =
    options.readerSigner ?? new SecretKeyRegistrySigner(generateSecretKey());
  const signEvent = readerSigner.signEvent.bind(readerSigner);
  const relays: CommunityRelay[] = relayUrls.map((url) =>
    options.relayFactory.create(url),
  );
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
  let inspectionInputs: readonly unknown[] = [];
  let inspectionPendingRevision = 0;
  let inspectionSnapshot: {
    events: NostrEvent[];
    inspections: Map<string, Promise<RegistryReleaseInspection | undefined>>;
    reviews?: Promise<readonly RegistryReleaseReviewEntry[]> | undefined;
  } = { events: [], inspections: new Map() };

  function releaseInspectionSnapshot() {
    const inputs = [candidateEvents, currentEvents, inspectionPendingRevision];
    if (inputs.some((input, index) => input !== inspectionInputs[index])) {
      inspectionInputs = inputs;
      const events = mergeEvents(candidateEvents, currentEvents, [
        ...pendingEvents.values(),
      ]);
      if (
        events.length !== inspectionSnapshot.events.length ||
        events.some(
          (event, index) => event.id !== inspectionSnapshot.events[index]?.id,
        )
      ) {
        inspectionSnapshot = { events, inspections: new Map() };
      }
    }
    return inspectionSnapshot;
  }

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
          await setProjection(
            cached.events,
            documents,
            cached.synchronizedAt,
            false,
            "cache",
            relayUrls.map((relay) => ({ relay })),
            false,
            undefined,
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
    subscriptionsPromise = subscribeRegistryCatalogRelays({
      relays,
      readerSigner,
      signal,
      releaseGroupId,
      subscriptions,
      onEvent(event) {
        if (!pendingEvents.has(event.id)) inspectionPendingRevision += 1;
        pendingEvents.set(event.id, event);
        scheduleLiveProjection();
      },
    });
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
            "#t": [
              LAPIS_RELEASE_TOPIC,
              LAPIS_PUBLISHER_AUTHORIZATION_TOPIC,
              LAPIS_REGISTRY_HEAD_TOPIC,
            ],
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
        const documents = await hydrateRegistryManifestDocuments(events, {
          authorities,
          manifestBytes,
          fetch: request,
          mediaAuthSigner: signEvent,
          relayUrls,
          blossomUrls,
          signal,
        });
        const synchronizedAt = now().toISOString();
        await setProjection(
          events,
          documents,
          synchronizedAt,
          true,
          "relay",
          relayStatuses,
          true,
          new Map(
            releaseResult.sources.map((source) => [
              source.relay,
              new Set(source.eventIds),
            ]),
          ),
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
    // A subscription proves only that one relay observed the event. Re-query all
    // configured relays before a live release or head can affect trusted state.
    await synchronize(lifecycleController.signal);
  }

  function removePendingEvents(events: readonly NostrEvent[]): void {
    for (const event of events) {
      if (pendingEvents.get(event.id) === event) {
        pendingEvents.delete(event.id);
        inspectionPendingRevision += 1;
      }
    }
  }

  async function setProjection(
    events: readonly NostrEvent[],
    documents: readonly Nip29ReleaseManifestSource[],
    synchronizedAt: string,
    fresh: boolean,
    origin: "cache" | "relay",
    relayStatuses: readonly RegistryCatalogRelayStatus[],
    announceRevision: boolean,
    relayEventIds?: ReadonlyMap<string, ReadonlySet<string>>,
  ): Promise<void> {
    const registry = materializeNip29Registry(events, documents, authorities, {
      now: now(),
    });
    const trustAssessment = await assessRegistryTrust(
      registry,
      events,
      origin,
      synchronizedAt,
      relayEventIds,
    );
    const projection = projectNip29Registry(registry, synchronizedAt);
    const index = registryCatalogIndexSchema.parse(projection.index);
    const details = new Map(
      [...projection.plugins.entries()].map(([pluginId, detail]) => [
        pluginId,
        relayBackedDetail(
          registryCatalogDetailSchema.parse(detail),
          blossomUrl,
        ),
      ]),
    );
    const versions = new Map<string, RegistryVersionSnapshot>();
    for (const plugin of registry.plugins) {
      for (const release of plugin.releases) {
        const snapshot = projectVersionSnapshot(
          release,
          synchronizedAt,
          blossomUrl,
        );
        versions.set(
          versionSnapshotKey(plugin.content.pluginId, release.content.version),
          snapshot,
        );
      }
    }
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
      versions,
      runtime: {
        schemaVersion: 1,
        backend: "nostr-nip29",
        registryRoot,
        sourceRegistryRoot: registry.root,
        relays: relayUrls,
        releaseGroupId,
        ...(authorities.authorityEpoch === undefined
          ? {}
          : { authorityEpoch: authorities.authorityEpoch }),
        curatorRole: "registry-curator",
        curatorPubkeys: [...authorities.curatorPubkeys].toSorted(),
        publisherPubkeys: [...new Set(publisherPubkeys)].toSorted(),
      },
    };
    currentEvents = mergeEvents(events);
    candidateEvents = currentEvents;
    state = {
      phase:
        trustAssessment.trust === "fresh" || trustAssessment.trust === "legacy"
          ? "ready"
          : "degraded",
      fresh:
        fresh &&
        (trustAssessment.trust === "fresh" ||
          trustAssessment.trust === "legacy"),
      installReady:
        origin === "relay" &&
        (trustAssessment.trust === "fresh" ||
          trustAssessment.trust === "legacy") &&
        relayStatuses.filter((relay) => relay.error === undefined).length >=
          installQuorum,
      origin,
      registryRoot,
      synchronizedAt,
      relays: relayStatuses,
      trust: trustAssessment.trust,
      ...(trustAssessment.message !== undefined
        ? { message: trustAssessment.message }
        : relayStatuses.some((relay) => relay.error !== undefined)
          ? { message: "Some configured registry relays were unavailable" }
          : {}),
    };
    if (announceRevision) emit({ type: "revision", status: state });
    else emit({ type: "status", status: state });
  }

  async function assessRegistryTrust(
    registry: MaterializedNip29Registry,
    events: readonly NostrEvent[],
    origin: "cache" | "relay",
    synchronizedAt: string,
    relayEventIds?: ReadonlyMap<string, ReadonlySet<string>>,
  ): Promise<{ trust: RegistryTrustState; message?: string }> {
    const headsByRevision = new Map<string, string>();
    for (const event of events) {
      if (!authorities.curatorPubkeys.has(event.pubkey)) continue;
      const head = parseNip29RegistryHead(event);
      if (
        head === undefined ||
        authorities.authorityEpoch === undefined ||
        head.content.authorityEpoch !== authorities.authorityEpoch
      ) {
        continue;
      }
      const key = `${head.content.pluginId}\u0000${head.content.headRevision}`;
      const previous = headsByRevision.get(key);
      if (previous !== undefined && previous !== event.id) {
        return {
          trust: "equivocation",
          message:
            "Conflicting signed Registry heads were observed at the same revision.",
        };
      }
      headsByRevision.set(key, event.id);
    }
    const pluginIds = new Set(
      events.flatMap((event) => {
        const release = parseNip29ReleaseEvent(event);
        return release === undefined ? [] : [release.pluginId];
      }),
    );
    if (registry.heads.size === 0) {
      for (const pluginId of pluginIds) {
        if (
          (await store.loadTrust(registryTrustKey(authorities, pluginId))) !==
          undefined
        ) {
          return {
            trust: "rollback",
            message:
              "A previously trusted Registry head is missing; installs and management are paused.",
          };
        }
      }
      return { trust: "legacy" };
    }

    let sawStale = false;
    const pendingTrustRecords: RegistryTrustRecord[] = [];
    for (const [pluginId, head] of registry.heads) {
      const key = registryTrustKey(authorities, pluginId);
      const stored = await store.loadTrust(key);
      const headHash = canonicalHash(head.content as unknown as JsonObject);
      const active = head.content.releases.find(
        (release) =>
          release.releaseEventId === head.content.activeReleaseEventId,
      );
      if (
        origin === "relay" &&
        [...(relayEventIds?.values() ?? [])].filter((ids) =>
          ids.has(head.event.id),
        ).length < installQuorum
      ) {
        return {
          trust: "rollback",
          message:
            "The current signed Registry head is not present on the configured install quorum.",
        };
      }
      const releaseOwners = new Map(
        events.flatMap((event) => {
          const release = parseNip29ReleaseEvent(event);
          return release?.pluginId === pluginId
            ? [[event.id, event.pubkey] as const]
            : [];
        }),
      );
      const unreconciledWithdrawal = events.some((event) => {
        const withdrawal = parseNip29PublisherWithdrawal(event);
        return (
          withdrawal !== undefined &&
          releaseOwners.get(withdrawal.releaseEventId) === event.pubkey &&
          !head.content.releases.some(
            (release) =>
              release.state === "withdrawn" &&
              release.decisionEventId === event.id,
          )
        );
      });
      if (unreconciledWithdrawal) {
        return {
          trust: "stale",
          message:
            "A publisher withdrawal is awaiting a curator checkpoint; installs and ordinary management are paused.",
        };
      }
      if (stored !== undefined) {
        const revision = compareCanonicalDecimal(
          head.content.headRevision,
          stored.headRevision,
        );
        if (
          revision < 0 ||
          (stored.activeReleaseSequence !== undefined &&
            active?.releaseSequence !== undefined &&
            compareCanonicalDecimal(
              active.releaseSequence,
              stored.activeReleaseSequence,
            ) < 0)
        ) {
          return {
            trust: "rollback",
            message:
              "The Registry relay returned an older trusted checkpoint; installs and management are paused.",
          };
        }
        if (revision === 0 && stored.headHash !== headHash) {
          return {
            trust: "equivocation",
            message:
              "Conflicting signed Registry heads were observed at the same revision.",
          };
        }
        if (
          stored.seenWithdrawalEventIds.some(
            (id) =>
              !head.content.releases.some(
                (release) =>
                  release.state === "withdrawn" &&
                  release.decisionEventId === id,
              ),
          )
        ) {
          return {
            trust: "rollback",
            message:
              "Previously observed publisher withdrawals are missing from the Registry head.",
          };
        }
      }
      sawStale ||= !head.fresh;
      if (origin === "relay") {
        pendingTrustRecords.push({
          schemaVersion: 1,
          key,
          pluginId,
          authorityEpoch: head.content.authorityEpoch,
          headRevision: head.content.headRevision,
          headEventId: head.event.id,
          headHash,
          ...(head.content.activeReleaseEventId === undefined
            ? {}
            : { activeReleaseEventId: head.content.activeReleaseEventId }),
          ...(active?.releaseSequence === undefined
            ? {}
            : { activeReleaseSequence: active.releaseSequence }),
          seenWithdrawalEventIds: head.content.releases
            .filter((release) => release.state === "withdrawn")
            .map((release) => release.decisionEventId)
            .toSorted(),
          updatedAt: synchronizedAt,
        });
      }
    }
    for (const record of pendingTrustRecords) await store.saveTrust(record);
    return sawStale
      ? {
          trust: "stale",
          message:
            "The signed Registry freshness window has expired; browsing remains available while installs are paused.",
        }
      : { trust: "fresh" };
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
    for (const source of resourceSources(reference, blossomUrls)) {
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

  function releaseManagementState(
    event: NostrEvent,
  ): "approved" | "pending" | "rejected" | "revoked" | "withdrawn" {
    const events = mergeEvents(candidateEvents, currentEvents, [
      ...pendingEvents.values(),
    ]);
    if (
      events.some((candidate) => {
        const withdrawal = parseNip29PublisherWithdrawal(candidate, event.id);
        return withdrawal !== undefined && candidate.pubkey === event.pubkey;
      })
    ) {
      return "withdrawn";
    }
    const decision = events
      .flatMap((candidate) => {
        const parsed = parseNip29CuratorDecision(candidate, event.id);
        return parsed === undefined ||
          !authorities.curatorPubkeys.has(candidate.pubkey)
          ? []
          : [{ event: candidate, decision: parsed.decision }];
      })
      .toSorted((left, right) =>
        left.event.created_at === right.event.created_at
          ? left.event.id.localeCompare(right.event.id)
          : right.event.created_at - left.event.created_at,
      )[0];
    return decision?.decision ?? "pending";
  }

  async function hasCuratorRole(
    pubkey: string,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const results = await Promise.allSettled(
      relays.map(async (relay) => {
        const snapshots = await relay.query(
          {
            kinds: [NIP29_KINDS.groupMembers],
            "#d": [releaseGroupId],
            limit: 1,
          },
          signal,
        );
        const snapshot = snapshots
          .filter(verifyEvent)
          .toSorted((left, right) =>
            left.created_at === right.created_at
              ? left.id.localeCompare(right.id)
              : right.created_at - left.created_at,
          )[0];
        return (
          snapshot?.tags.some(
            (tag) =>
              tag[0] === "p" &&
              tag[1] === pubkey &&
              tag.slice(2).includes("registry-curator"),
          ) === true
        );
      }),
    );
    return (
      results.filter((result) => result.status === "fulfilled" && result.value)
        .length >= installQuorum
    );
  }

  async function loadManagementCapabilities(
    eventId: string,
    signer: RegistrySigner | undefined,
    signal?: AbortSignal,
  ): Promise<RegistryReleaseManagementCapabilities | undefined> {
    if (signer === undefined || authorities.authorityEpoch === undefined)
      return undefined;
    await waitForSignal(start(), signal);
    const event = mergeEvents(candidateEvents, currentEvents, [
      ...pendingEvents.values(),
    ]).find((candidate) => candidate.id === eventId);
    const release =
      event === undefined ? undefined : parseNip29ReleaseEvent(event);
    if (event === undefined || release === undefined) return undefined;
    const pubkey = await signer.getPublicKey();
    const stateValue = releaseManagementState(event);
    const trust = state.trust ?? "legacy";
    const curator =
      authorities.curatorPubkeys.has(pubkey) &&
      (await hasCuratorRole(pubkey, signal));
    const author = pubkey === event.pubkey;
    const actions: RegistryReleaseManagementAction[] = [];
    if (trust === "stale" && curator) actions.push("renew");
    if (
      trust === "legacy" &&
      curator &&
      current?.registry.heads.get(release.pluginId) === undefined
    ) {
      actions.push("renew");
    }
    if (trust === "fresh" || trust === "legacy") {
      if (curator && stateValue === "pending")
        actions.push("approve", "reject");
      if (curator && stateValue === "approved") actions.push("revoke");
      if (author && (stateValue === "pending" || stateValue === "approved"))
        actions.push("withdraw");
    }
    return {
      eventId,
      state: stateValue,
      trust,
      actions,
      ...(current?.registry.heads.get(release.pluginId) === undefined
        ? {}
        : {
            headEventId: current.registry.heads.get(release.pluginId)!.event.id,
          }),
    };
  }

  async function publishToWriteQuorum(
    event: NostrEvent,
    signer: RegistrySigner,
    signal?: AbortSignal,
  ): Promise<void> {
    const results = await Promise.allSettled(
      relays.map(async (relay) => {
        await authenticateRegistryRelay(relay, signer, signal);
        return await relay.publish(event, signal);
      }),
    );
    const accepted = results.filter(
      (result) => result.status === "fulfilled" && result.value.accepted,
    ).length;
    if (accepted < installQuorum) {
      throw new Error(
        `Registry write quorum was not reached (${accepted}/${installQuorum})`,
      );
    }
  }

  function buildRegistryHeadTemplate(
    pluginId: string,
    extraEvents: readonly NostrEvent[],
    createdAt: number,
  ) {
    const allEvents = mergeEvents(
      candidateEvents,
      currentEvents,
      [...pendingEvents.values()],
      extraEvents,
    );
    const evidence = allEvents.flatMap((event) => {
      const release = parseNip29ReleaseEvent(event);
      if (
        release === undefined ||
        release.pluginId !== pluginId ||
        !isNip29PublisherAuthorized(
          allEvents,
          authorities,
          pluginId,
          event.pubkey,
        )
      ) {
        return [];
      }
      const bytes = manifestBytes.get(release.attachment.sha256);
      if (bytes === undefined) return [];
      let value: unknown;
      try {
        value = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      } catch {
        return [];
      }
      const manifest = nip29ReleaseManifestSchema.safeParse(value);
      if (!manifest.success || manifest.data.release.pluginId !== pluginId)
        return [];
      const withdrawal = allEvents.find((candidate) => {
        const parsed = parseNip29PublisherWithdrawal(candidate, event.id);
        return parsed !== undefined && candidate.pubkey === event.pubkey;
      });
      const decision = allEvents
        .flatMap((candidate) => {
          const parsed = parseNip29CuratorDecision(candidate, event.id);
          return parsed === undefined ||
            !authorities.curatorPubkeys.has(candidate.pubkey)
            ? []
            : [{ event: candidate, state: parsed.decision }];
        })
        .toSorted((left, right) =>
          left.event.created_at === right.event.created_at
            ? left.event.id.localeCompare(right.event.id)
            : right.event.created_at - left.event.created_at,
        )[0];
      if (withdrawal === undefined && decision === undefined) return [];
      return [
        {
          release,
          manifest: manifest.data,
          state:
            withdrawal === undefined ? decision!.state : ("withdrawn" as const),
          decisionEventId: withdrawal?.id ?? decision!.event.id,
        },
      ];
    });
    const previous = current?.registry.heads.get(pluginId);
    const approved = evidence.filter((item) => item.state === "approved");
    const active = approved.toSorted((left, right) => {
      const leftSequence =
        left.manifest.release.schema === "lapis.registry.release/2"
          ? left.manifest.release.releaseSequence
          : "0";
      const rightSequence =
        right.manifest.release.schema === "lapis.registry.release/2"
          ? right.manifest.release.releaseSequence
          : "0";
      const sequence = compareCanonicalDecimal(rightSequence, leftSequence);
      return sequence !== 0
        ? sequence
        : right.release.event.created_at - left.release.event.created_at ||
            left.release.event.id.localeCompare(right.release.event.id);
    })[0];
    const releases = evidence
      .map((item) => ({
        releaseEventId: item.release.event.id,
        manifestSha256: item.release.attachment.sha256,
        version: item.manifest.release.version,
        ...(item.manifest.release.schema === "lapis.registry.release/2"
          ? { releaseSequence: item.manifest.release.releaseSequence }
          : item.release.event.id === active?.release.event.id
            ? { releaseSequence: "0" }
            : {}),
        state: item.state,
        decisionEventId: item.decisionEventId,
      }))
      .toSorted((left, right) => {
        if (
          left.releaseSequence === undefined &&
          right.releaseSequence !== undefined
        )
          return -1;
        if (
          left.releaseSequence !== undefined &&
          right.releaseSequence === undefined
        )
          return 1;
        if (
          left.releaseSequence !== undefined &&
          right.releaseSequence !== undefined
        ) {
          const sequence = compareCanonicalDecimal(
            left.releaseSequence,
            right.releaseSequence,
          );
          if (sequence !== 0) return sequence;
        } else {
          const version = semver.compare(left.version, right.version);
          if (version !== 0) return version;
        }
        return left.releaseEventId.localeCompare(right.releaseEventId);
      });
    const issuedAt = new Date(createdAt * 1_000);
    return createNip29RegistryHeadTemplate(
      {
        schema: "lapis.registry.plugin-head/1",
        pluginId,
        authorityEpoch: authorities.authorityEpoch!,
        headRevision:
          previous === undefined
            ? "1"
            : (BigInt(previous.content.headRevision) + 1n).toString(),
        ...(previous === undefined
          ? {}
          : { previousHeadEventId: previous.event.id }),
        ...(active === undefined
          ? {}
          : { activeReleaseEventId: active.release.event.id }),
        releases,
        issuedAt: issuedAt.toISOString(),
        validUntil: new Date(
          issuedAt.getTime() + 30 * 24 * 60 * 60 * 1_000,
        ).toISOString(),
      },
      createdAt,
    );
  }

  async function loadReleaseInspection(
    eventId: string,
    loadOptions?: RegistryLoadOptions,
  ): Promise<RegistryReleaseInspection | undefined> {
    loadOptions?.signal?.throwIfAborted();
    try {
      await waitForSignal(start(), loadOptions?.signal);
    } catch (cause) {
      if (loadOptions?.signal?.aborted || isAbortError(cause)) throw cause;
      // Candidate events captured before a failed projection remain inspectable.
    }
    return await waitForSignal(
      inspectRelease(releaseInspectionSnapshot(), eventId),
      loadOptions?.signal,
    );
  }

  function inspectRelease(
    snapshot: typeof inspectionSnapshot,
    eventId: string,
  ) {
    let pending = snapshot.inspections.get(eventId);
    if (!pending) {
      pending = buildReleaseInspection(eventId, snapshot.events).then(
        (inspection) => {
          // Transient attachment errors are retryable without a signed-event change.
          if (inspection?.state === "unavailable")
            snapshot.inspections.delete(eventId);
          return inspection;
        },
        (error) => {
          snapshot.inspections.delete(eventId);
          throw error;
        },
      );
      snapshot.inspections.set(eventId, pending);
    }
    return pending;
  }

  async function buildReleaseInspection(
    eventId: string,
    events: NostrEvent[],
  ): Promise<RegistryReleaseInspection | undefined> {
    const signal = lifecycleController.signal;
    signal.throwIfAborted();
    const event = events.find((candidate) => candidate.id === eventId);
    if (event === undefined) return undefined;
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
          blossomUrls,
          signal,
        });
        signal.throwIfAborted();
        document = fetched[0]!;
        manifestBytes.set(document.attachmentSha256, document.bytes);
      } else {
        document = manifestDocument(attachment.sha256, cached, attachment.size);
      }
      return inspectRegistryReleaseCandidate(
        candidate,
        events,
        document.manifest,
        now().toISOString(),
        authorities,
      );
    } catch (cause) {
      if (signal.aborted || isAbortError(cause)) throw cause;
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
  }

  async function buildReleaseReviews(
    snapshot: typeof inspectionSnapshot,
  ): Promise<readonly RegistryReleaseReviewEntry[]> {
    const events = snapshot.events;
    const releaseEvents = events
      .filter(
        (event) =>
          recognizeRegistryReleaseCandidate(event, authorities, events) !==
          undefined,
      )
      .toSorted((left, right) =>
        left.created_at === right.created_at
          ? left.id.localeCompare(right.id)
          : right.created_at - left.created_at,
      );
    const entries = await Promise.all(
      releaseEvents.map(async (releaseEvent) => {
        const inspection = await inspectRelease(snapshot, releaseEvent.id);
        if (inspection === undefined) return [];
        const curatorDecisionEvents = events
          .filter(
            (event) =>
              authorities.curatorPubkeys.has(event.pubkey) &&
              parseNip29CuratorDecision(event, releaseEvent.id) !== undefined,
          )
          .toSorted((left, right) =>
            left.created_at === right.created_at
              ? left.id.localeCompare(right.id)
              : right.created_at - left.created_at,
          );
        return [
          {
            releaseEvent,
            inspection,
            curatorDecisionEvents,
          } satisfies RegistryReleaseReviewEntry,
        ];
      }),
    );
    return entries.flat();
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
    async loadPluginVersionDetail(pluginId, version, loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      await waitForSignal(start(), loadOptions?.signal);
      const snapshot = requireCurrent().versions.get(
        versionSnapshotKey(pluginId, version),
      );
      if (snapshot === undefined) {
        throw new Error(
          `${pluginId}@${version}: accepted release is unavailable`,
        );
      }
      return snapshot;
    },
    async loadMarkdown(reference, loadOptions) {
      const bytes = await loadVerifiedResource(reference, loadOptions);
      return new TextDecoder().decode(bytes);
    },
    async loadImage(reference, loadOptions) {
      const bytes = await loadVerifiedResource(reference, loadOptions);
      return new Blob([bytes], { type: reference.mediaType });
    },
    loadReleaseInspection,
    async loadReleaseReviewEntries(loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      try {
        await waitForSignal(start(), loadOptions?.signal);
      } catch (cause) {
        if (loadOptions?.signal?.aborted || isAbortError(cause)) throw cause;
        // Preserve the same degraded-read behavior as release inspection.
      }
      const snapshot = releaseInspectionSnapshot();
      snapshot.reviews ??= buildReleaseReviews(snapshot).then(
        (entries) => {
          if (entries.some((entry) => entry.inspection.state === "unavailable"))
            snapshot.reviews = undefined;
          return entries;
        },
        (error) => {
          snapshot.reviews = undefined;
          throw error;
        },
      );
      return await waitForSignal(snapshot.reviews, loadOptions?.signal);
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
      return createNip29ReleaseProof(
        pluginId,
        version,
        release,
        manifestBytes.get(release.attachment.sha256),
      );
    },
    async loadReleaseManagementCapabilities(eventId, signer, loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      return await loadManagementCapabilities(
        eventId,
        signer,
        loadOptions?.signal,
      );
    },
    async performReleaseAction(requested, signer, loadOptions) {
      loadOptions?.signal?.throwIfAborted();
      const capabilities = await loadManagementCapabilities(
        requested.eventId,
        signer,
        loadOptions?.signal,
      );
      if (
        capabilities === undefined ||
        !capabilities.actions.includes(requested.action)
      ) {
        throw new Error(
          "The connected identity is not allowed to perform this action",
        );
      }
      const event = mergeEvents(candidateEvents, currentEvents, [
        ...pendingEvents.values(),
      ]).find((candidate) => candidate.id === requested.eventId);
      const release =
        event === undefined ? undefined : parseNip29ReleaseEvent(event);
      if (event === undefined || release === undefined) {
        throw new Error("The targeted Registry release is unavailable");
      }
      if (
        requested.expectedManifestSha256 !== undefined &&
        requested.expectedManifestSha256 !== release.attachment.sha256
      ) {
        throw new Error(
          "The release manifest changed before the action was signed",
        );
      }
      const currentHead = current?.registry.heads.get(release.pluginId);
      if (
        requested.expectedHeadEventId !== undefined &&
        requested.expectedHeadEventId !== currentHead?.event.id
      ) {
        throw new Error(
          "The Registry head changed before the action was signed",
        );
      }
      const createdAt = Math.max(
        Math.floor(now().getTime() / 1_000),
        event.created_at + 1,
        (current?.registry.heads.get(release.pluginId)?.event.created_at ??
          -1) + 1,
        ...mergeEvents(candidateEvents, currentEvents, [
          ...pendingEvents.values(),
        ])
          .filter((candidate) =>
            candidate.tags.some((tag) => tag[0] === "e" && tag[1] === event.id),
          )
          .map((candidate) => candidate.created_at + 1),
      );
      let decisionEvent: NostrEvent | undefined;
      if (requested.action === "withdraw") {
        decisionEvent = await signer.signEvent(
          createNip29PublisherWithdrawalTemplate(event.id, createdAt),
        );
        await publishToWriteQuorum(decisionEvent, signer, loadOptions?.signal);
        inspectionPendingRevision += 1;
        pendingEvents.set(decisionEvent.id, decisionEvent);
        await synchronize(loadOptions?.signal).catch(() => undefined);
        return {
          action: requested.action,
          eventId: event.id,
          decisionEventId: decisionEvent.id,
        } satisfies RegistryReleaseManagementResult;
      }
      if (requested.action !== "renew") {
        const decision =
          requested.action === "approve"
            ? "approved"
            : requested.action === "reject"
              ? "rejected"
              : "revoked";
        decisionEvent = await signer.signEvent(
          createNip29CuratorDecisionTemplate(event.id, decision, createdAt),
        );
        await publishToWriteQuorum(decisionEvent, signer, loadOptions?.signal);
        inspectionPendingRevision += 1;
        pendingEvents.set(decisionEvent.id, decisionEvent);
      }
      const headEvent = await signer.signEvent(
        buildRegistryHeadTemplate(
          release.pluginId,
          decisionEvent === undefined ? [] : [decisionEvent],
          createdAt,
        ),
      );
      await publishToWriteQuorum(headEvent, signer, loadOptions?.signal);
      inspectionPendingRevision += 1;
      pendingEvents.set(headEvent.id, headEvent);
      await synchronize(loadOptions?.signal);
      return {
        action: requested.action,
        eventId: event.id,
        ...(decisionEvent === undefined
          ? {}
          : { decisionEventId: decisionEvent.id }),
        headEventId: headEvent.id,
      } satisfies RegistryReleaseManagementResult;
    },
    async resetTrustHistory(pluginId) {
      await openStore();
      if (pluginId === undefined) {
        await store.resetTrust();
      } else {
        await store.resetTrust(registryTrustKey(authorities, pluginId));
      }
      // The explicit recovery action must re-bootstrap exclusively from the
      // next complete relay snapshot. Keep the rendered projection available
      // while discarding cached event merge inputs that could otherwise pin a
      // missing high-water head into the next synchronization.
      currentEvents = [];
      candidateEvents = [];
      pendingEvents.clear();
      inspectionPendingRevision += 1;
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
      inspectionSnapshot = { events: [], inspections: new Map() };
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
    ...(authorities.authorityEpoch === undefined
      ? {}
      : { authorityEpoch: authorities.authorityEpoch }),
  };
}

function versionSnapshotKey(pluginId: string, version: string): string {
  return `${pluginId}\u0000${version}`;
}

function registryTrustKey(
  authorities: Nip29RegistryAuthorities,
  pluginId: string,
): string {
  return canonicalHash({
    schema: "lapis.registry.trust-scope/1",
    pluginId,
    releaseGroupId: lapisGroupId(LAPIS_GROUPS.pluginReleases),
    authorityEpoch: authorities.authorityEpoch ?? "legacy",
    curatorPubkeys: [...authorities.curatorPubkeys].toSorted(),
  });
}

function projectVersionSnapshot(
  release: MaterializedNip29Release,
  generatedAt: string,
  blossomUrl: URL,
): RegistryVersionSnapshot {
  const projection = projectRegistry(
    [
      {
        content: release.plugin,
        releases: [release.content],
        latestVersion: release.content.version,
      },
    ],
    { generatedAt },
    {
      backend: "nostr",
      root: release.event.id,
      acceptedEventIds: [release.event.id, release.decisionEvent.id],
      exclusionCounts: {},
    },
  );
  const index = registryCatalogIndexSchema.parse(projection.index);
  const entry = index.plugins[0];
  const detailValue = projection.plugins.get(release.content.pluginId);
  if (entry === undefined || detailValue === undefined) {
    throw new Error(`${release.content.pluginId}: version projection failed`);
  }
  const detail = relayBackedDetail(
    registryCatalogDetailSchema.parse(detailValue),
    blossomUrl,
  );
  const version = detail.versions[release.content.version];
  if (version === undefined) {
    throw new Error(
      `${release.content.pluginId}@${release.content.version}: version projection failed`,
    );
  }
  return {
    entry,
    detail,
    release: {
      ...version,
      releaseEventId: release.event.id,
      manifestSha256: release.attachment.sha256,
      ...(release.content.schema === "lapis.registry.release/2"
        ? { releaseSequence: release.content.releaseSequence }
        : {}),
    },
    manifestSha256: release.attachment.sha256,
    releaseEvent: release.event,
    ...(release.content.schema === "lapis.registry.release/2"
      ? { releaseSequence: release.content.releaseSequence }
      : {}),
    latestStatus: "approved",
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

function resourceSources(
  reference: RegistryImageReference | RegistryMarkdownReference,
  blossomUrls: readonly URL[],
): URL[] {
  return [
    ...new Map(
      blossomUrls.map((base) => {
        const source = new URL(reference.sha256, base);
        return [source.href, source] as const;
      }),
    ).values(),
  ];
}

function relayBackedDetail(
  detail: RegistryCatalogDetail,
  blossomUrl: URL,
): RegistryCatalogDetail {
  const resource = <
    T extends RegistryImageReference | RegistryMarkdownReference,
  >(
    reference: T,
  ): T => ({
    ...reference,
    sourceUrl: new URL(reference.sha256, blossomUrl).toString(),
  });
  const images = (item: {
    preview: RegistryImageReference;
    full: RegistryImageReference;
    light: RegistryImageReference;
    dark: RegistryImageReference;
  }) => ({
    preview: resource(item.preview),
    full: resource(item.full),
    light: resource(item.light),
    dark: resource(item.dark),
  });

  return registryCatalogDetailSchema.parse({
    ...detail,
    ...(detail.appearance?.logo === undefined
      ? {}
      : {
          appearance: {
            ...detail.appearance,
            logo: resource(detail.appearance.logo),
          },
        }),
    ...(detail.media === undefined
      ? {}
      : {
          media: {
            ...(detail.media.banner === undefined
              ? {}
              : {
                  banner: {
                    ...detail.media.banner,
                    images: images(detail.media.banner.images),
                  },
                }),
            ...(detail.media.overview === undefined
              ? {}
              : {
                  overview: {
                    ...detail.media.overview,
                    images: images(detail.media.overview.images),
                  },
                }),
          },
        }),
    ...(detail.gallery === undefined
      ? {}
      : {
          gallery: detail.gallery.map((item) => ({
            ...item,
            images: images(item.images),
          })),
        }),
    ...(detail.content === undefined
      ? {}
      : {
          content: {
            ...(detail.content.overview === undefined
              ? {}
              : { overview: resource(detail.content.overview) }),
            ...(detail.content.changelog === undefined
              ? {}
              : { changelog: resource(detail.content.changelog) }),
          },
        }),
    versions: Object.fromEntries(
      Object.entries(detail.versions).map(([version, release]) => [
        version,
        {
          ...release,
          bundle: {
            ...release.bundle,
            url: new URL(release.bundle.sha256, blossomUrl).toString(),
            downloadUrl: undefined,
          },
        },
      ]),
    ),
  });
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
