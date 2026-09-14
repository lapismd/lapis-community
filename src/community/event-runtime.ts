import type { NostrEvent } from "../protocol/index.js";
import { isRegistryControlEvent } from "../protocol/registry-control.js";

import type {
  CommunityCacheState,
  CommunityCachedEventQuery,
  CommunityEventBatch,
  CommunityEventRuntime,
  CommunityEventStore,
  CommunityRuntimeRevision,
  CommunityRuntimeSearch,
  CommunityRuntimeSelection,
  CommunityScope,
  CommunitySearchResult,
} from "./contracts.js";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { communityEventBytes } from "./event-store.js";
import {
  materializeCommunityInbox,
  materializeCommunityWorkspace,
} from "./materialize.js";
import { materializeCommunitySettings } from "./materialize-settings.js";
import { verifiedNostrEvent } from "./verified-events.js";
import { PrivateEventIndex } from "./private-event-index.js";
import { agentActivityProxy } from "./agent-archive.js";

export interface InlineCommunityEventRuntimeOptions {
  store?: CommunityEventStore;
}

export function createInlineCommunityEventRuntime(
  options: InlineCommunityEventRuntimeOptions = {},
): CommunityEventRuntime {
  return new InlineCommunityEventRuntime(
    options.store ?? createMemoryCommunityEventStore(),
  );
}

export class InlineCommunityEventRuntime implements CommunityEventRuntime {
  readonly agentActivity = agentActivityProxy(async () => {
    await this.#open();
    const archive = this.#store.agentActivity;
    if (!archive)
      throw new Error("This custom event store does not support agent history");
    return archive;
  });
  readonly #store: CommunityEventStore;
  readonly #events = new Map<string, Map<string, NostrEvent>>();
  readonly #relayUrls = new Map<string, Map<string, string>>();
  readonly #privateIds = new Set<string>();
  readonly #privacy = new Map<string, PrivateEventIndex>();
  readonly #privacyFailures = new Map<string, string>();
  readonly #scopes = new Map<string, CommunityScope>();
  #searchVersion = 0;
  #revision = 0;
  #opened = false;
  #lastSynchronizedAt: number | undefined;
  #approximateBytes = 0;
  #writeQueue: Promise<void> = Promise.resolve();
  #writeError: string | undefined;

  constructor(store: CommunityEventStore) {
    this.#store = store;
  }

  async restore(
    scopes: readonly CommunityScope[],
    generation = 0,
    options: { metadataOnly?: boolean } = {},
  ): Promise<CommunityRuntimeRevision> {
    await this.#writeQueue;
    await this.#open();
    this.#approximateBytes = 0;
    const activeScopes = new Set(scopes.map((scope) => scope.id));
    for (const scopeId of this.#scopes.keys()) {
      if (activeScopes.has(scopeId)) continue;
      this.#scopes.delete(scopeId);
      this.#events.delete(scopeId);
      this.#relayUrls.delete(scopeId);
      this.#privacy.delete(scopeId);
    }
    const syncPlans: Record<
      string,
      Awaited<ReturnType<CommunityEventStore["syncPlan"]>>
    > = {};
    for (const scope of scopes) {
      this.#scopes.set(scope.id, scope);
      let cached = await (options.metadataOnly && this.#store.restoreMetadata
        ? this.#store.restoreMetadata(scope)
        : this.#store.restore(scope));
      const privacy = this.#privacyFor(scope);
      const verified = cached.events.flatMap((incoming) => {
        const event = verifiedNostrEvent(incoming);
        return event ? [event] : [];
      });
      const transition = privacy.add(verified);
      for (const id of transition.privateIds) this.#privateIds.add(id);
      // Legacy caches can contain private plaintext, including unmounted replies.
      // Only a newly discovered private group or a failed purge requires a scan.
      if (transition.groupIds.length || this.#privacyFailures.has(scope.id)) {
        await this.#purgePrivateCache(scope);
        cached = await (options.metadataOnly && this.#store.restoreMetadata
          ? this.#store.restoreMetadata(scope)
          : this.#store.restore(scope));
      }
      this.#approximateBytes += cached.approximateBytes;
      const events =
        this.#events.get(scope.id) ?? new Map<string, NostrEvent>();
      const relayUrls =
        this.#relayUrls.get(scope.id) ?? new Map<string, string>();
      for (const incoming of cached.events) {
        if (events.has(incoming.id)) continue;
        const event = verifiedNostrEvent(incoming);
        if (event !== undefined) {
          events.set(event.id, event);
          relayUrls.set(event.id, scope.relayUrl);
        }
      }
      this.#events.set(scope.id, events);
      this.#relayUrls.set(scope.id, relayUrls);
      const synchronizedAt = Math.max(
        0,
        ...cached.checkpoints.map((checkpoint) => checkpoint.synchronizedAt),
      );
      if (synchronizedAt > (this.#lastSynchronizedAt ?? 0)) {
        this.#lastSynchronizedAt = synchronizedAt;
      }
      syncPlans[scope.id] = {
        checkpoints: cached.checkpoints,
        cachedEventIds: cached.events.map((event) => event.id),
      };
    }
    this.#revision += 1;
    return {
      ...this.#revisionValue(
        generation,
        this.#eventCount() === 0 ? "empty" : "cached",
      ),
      acceptedEventsByScope: this.#eventRecord(),
      syncPlans,
    };
  }

  async ingest(
    batch: CommunityEventBatch,
  ): Promise<CommunityRuntimeRevision | undefined> {
    await this.#open();
    this.#scopes.set(batch.scope.id, batch.scope);
    const events =
      this.#events.get(batch.scope.id) ?? new Map<string, NostrEvent>();
    const relayUrls =
      this.#relayUrls.get(batch.scope.id) ?? new Map<string, string>();
    const accepted: NostrEvent[] = [],
      validated: NostrEvent[] = [];
    for (const incoming of batch.events) {
      // Transient telemetry belongs only to its dedicated encrypted archive.
      if (incoming.kind >= 20_000 && incoming.kind < 30_000) continue;
      const event = verifiedNostrEvent(incoming);
      if (!event) continue;
      validated.push(event);
      if (events.has(event.id)) continue;
      events.set(event.id, event);
      relayUrls.set(event.id, batch.relayUrl);
      accepted.push(event);
    }
    const privacy = this.#privacyFor(batch.scope);
    const transition = privacy.add(validated, batch.persist === false);
    // Encrypted recipient wraps are persisted in their private audience; they
    // are never public search content and do not trigger plaintext cache scans.
    for (const event of validated) {
      if (batch.audience?.type === "inbox" || event.kind === 30622) {
        for (const id of privacy.markPrivate([event.id]))
          transition.privateIds.push(id);
      }
    }
    for (const id of transition.privateIds) this.#privateIds.add(id);
    if (
      transition.groupIds.length ||
      transition.privateIds.length ||
      this.#privacyFailures.has(batch.scope.id)
    ) {
      const purge = this.#writeQueue.then(async () => {
        const force =
          transition.groupIds.length > 0 ||
          this.#privacyFailures.has(batch.scope.id);
        if (
          !force &&
          this.#store.hasPublicEventReferences &&
          !(await this.#store.hasPublicEventReferences(
            batch.scope,
            transition.privateIds,
          ))
        )
          return;
        await this.#purgePrivateCache(batch.scope);
      });
      this.#writeQueue = purge.catch((cause: unknown) => {
        const error = `Local cache privacy update failed: ${cause instanceof Error ? cause.message : String(cause)}`;
        this.#privacyFailures.set(batch.scope.id, error);
        this.#writeError = error;
      });
    }
    if (
      accepted.length === 0 &&
      (batch.checkpoints?.length ?? 0) === 0 &&
      (batch.historyPages?.length ?? 0) === 0
    ) {
      return undefined;
    }
    if (accepted.length > 0) {
      this.#events.set(batch.scope.id, events);
      this.#relayUrls.set(batch.scope.id, relayUrls);
    }
    if (batch.persist !== false && !batch.fromCache) {
      const persistedBatch = {
        scope: batch.scope,
        records: (batch.historyPages?.length
          ? batch.events.flatMap((event) => {
              const known = events.get(event.id);
              return known ? [known] : [];
            })
          : accepted
        )
          .filter(
            (event) =>
              batch.audience?.type === "inbox" ||
              !this.#privateIds.has(event.id),
          )
          .map((event) => {
            const roomId = eventRoomId(event);
            return {
              event,
              relayUrl: batch.relayUrl,
              audience: batch.audience ?? { type: "public" },
              ...(roomId === undefined ? {} : { roomId }),
            };
          }),
        ...(batch.checkpoints === undefined
          ? {}
          : { checkpoints: batch.checkpoints }),
        ...(batch.historyPages === undefined
          ? {}
          : {
              historyPages: batch.historyPages.filter((page) =>
                page.eventIds.every(
                  (id) =>
                    !this.#privateIds.has(id) || page.audience.type === "inbox",
                ),
              ),
            }),
      };
      const commit = this.#writeQueue.then(() =>
        this.#store.commit(persistedBatch),
      );
      this.#writeQueue = commit
        .then(() => {
          if (!this.#privacyFailures.size) this.#writeError = undefined;
        })
        .catch((cause: unknown) => {
          this.#writeError = `Local cache write failed: ${
            cause instanceof Error ? cause.message : String(cause)
          }`;
        });
      if (batch.checkpoints !== undefined || batch.historyPages !== undefined)
        await commit;
      this.#approximateBytes += accepted.reduce(
        (total, event) =>
          total +
          communityEventBytes({
            event,
            relayUrl: batch.relayUrl,
            audience: batch.audience ?? { type: "public" },
          }),
        0,
      );
    }
    if (batch.checkpoints !== undefined) {
      const synchronizedAt = Math.max(
        0,
        ...batch.checkpoints.map((checkpoint) => checkpoint.synchronizedAt),
      );
      if (synchronizedAt > (this.#lastSynchronizedAt ?? 0)) {
        this.#lastSynchronizedAt = synchronizedAt;
      }
    }
    this.#revision += 1;
    return {
      ...this.#revisionValue(batch.generation, "synchronizing"),
      ...(accepted.length === 0
        ? {}
        : { acceptedEventsByScope: { [batch.scope.id]: accepted } }),
    };
  }

  #privacyFor(scope: CommunityScope): PrivateEventIndex {
    let privacy = this.#privacy.get(scope.id);
    if (!privacy) {
      privacy = new PrivateEventIndex();
      this.#privacy.set(scope.id, privacy);
    }
    return privacy;
  }

  #assertCacheReadable(scope: CommunityScope): void {
    const error = this.#privacyFailures.get(scope.id);
    if (error) throw new Error(error);
  }

  async #purgePrivateCache(scope: CommunityScope): Promise<void> {
    try {
      await this.#applyPrivateCachePurge(scope);
    } catch (cause) {
      const error = `Local cache privacy update failed: ${cause instanceof Error ? cause.message : String(cause)}`;
      this.#privacyFailures.set(scope.id, error);
      this.#writeError = error;
      throw cause;
    }
  }

  async #applyPrivateCachePurge(scope: CommunityScope): Promise<void> {
    const privacy = this.#privacyFor(scope);
    if (
      this.#privacyFailures.has(scope.id) &&
      !privacy.privateIds.size &&
      !privacy.groups.size
    ) {
      // An identity reset discarded the in-memory private graph. Keep the scope
      // quarantined until its old public cache has been safely discarded.
      await this.#store.clear(scope);
    }
    const cached = await this.#store.restore(scope);
    const cachedPrivacy = new PrivateEventIndex();
    for (const group of privacy.groups) cachedPrivacy.groups.add(group);
    for (const id of privacy.privateIds) cachedPrivacy.privateIds.add(id);
    for (let offset = 0; offset < cached.events.length; offset += 100) {
      cachedPrivacy.add(cached.events.slice(offset, offset + 100));
      if (offset + 100 < cached.events.length)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    for (const id of privacy.markPrivate(cachedPrivacy.privateIds))
      this.#privateIds.add(id);
    const removed = cached.events
      .filter((event) => cachedPrivacy.privateIds.has(event.id))
      .map((event) => event.id);
    if (removed.length) {
      if (this.#store.removePublicEvents)
        await this.#store.removePublicEvents(scope, removed);
      else {
        // Existing custom stores can keep their unpaged contract.
        await this.#store.clear(scope);
        await this.#store.commit({
          scope,
          records: cached.events
            .filter((event) => !cachedPrivacy.privateIds.has(event.id))
            .map((event) => ({
              event,
              relayUrl: scope.relayUrl,
              audience: { type: "public" as const },
            })),
          checkpoints: cached.checkpoints,
        });
      }
    }
    this.#privacyFailures.delete(scope.id);
    if (!this.#privacyFailures.size) this.#writeError = undefined;
  }

  async readCachedEvents(
    scope: CommunityScope,
    query: CommunityCachedEventQuery,
  ) {
    await this.#writeQueue;
    await this.#open();
    this.#assertCacheReadable(scope);
    return (
      this.#store.readCachedEvents?.(scope, query) ?? {
        events: [],
        hasMoreCached: false,
      }
    );
  }

  async readHistoryPage(scope: CommunityScope, key: string) {
    await this.#writeQueue;
    await this.#open();
    this.#assertCacheReadable(scope);
    return this.#store.readHistoryPage?.(scope, key);
  }

  async project(
    selection: CommunityRuntimeSelection,
  ): Promise<CommunityRuntimeRevision> {
    await this.#open();
    this.#revision += 1;
    const eventsByScope = this.#eventRecord();
    const events = eventsByScope[selection.activeCommunityId] ?? [];
    const directReadMarkers: Record<
      string,
      import("./contracts.js").CommunityReadCursor
    > = {};
    for (const markers of Object.values(
      selection.inboxSelection?.readMarkersByScope ?? {},
    ))
      for (const [key, cursor] of Object.entries(markers)) {
        if (!key.startsWith('["nip17",')) continue;
        const prior = directReadMarkers[key];
        if (
          !prior ||
          cursor.createdAt > prior.createdAt ||
          (cursor.createdAt === prior.createdAt &&
            cursor.eventId > prior.eventId)
        )
          directReadMarkers[key] = cursor;
      }
    const workspace = materializeCommunityWorkspace(
      selection.scopes,
      eventsByScope,
      selection.activeCommunityId,
      {
        activeRoomId: selection.activeRoomId,
        readMarkers: {
          ...selection.inboxSelection?.readMarkersByScope?.[
            selection.activeCommunityId
          ],
          ...directReadMarkers,
        },
        ...(selection.activeTopicId === undefined
          ? {}
          : { activeTopicId: selection.activeTopicId }),
        ...(selection.activeThreadId === undefined
          ? {}
          : { activeThreadId: selection.activeThreadId }),
        ...(selection.identityPubkey === undefined
          ? {}
          : { identityPubkey: selection.identityPubkey }),
        privateEvents: [
          ...new Map(
            Object.values(selection.privateEventsByScope ?? {})
              .flat()
              .map((event) => [event.id, event]),
          ).values(),
        ],
        directParticipants: selection.directParticipantsByRoom ?? {},
        sidePanel: selection.sidePanel ?? "none",
        ...(selection.asOf === undefined ? {} : { asOf: selection.asOf }),
      },
    );
    const inbox = materializeCommunityInbox(
      selection.scopes,
      eventsByScope,
      selection.identityPubkey,
      selection.asOf,
      {
        ...selection.inboxSelection,
        privateEventsByScope: selection.privateEventsByScope ?? {},
      },
    );
    return {
      ...this.#revisionValue(selection.generation, "current"),
      workspace,
      ...(inbox === undefined ? {} : { inbox }),
      settings: materializeCommunitySettings(
        events,
        selection.identityPubkey ?? "",
      ),
    };
  }

  async search(
    request: CommunityRuntimeSearch,
  ): Promise<readonly CommunitySearchResult[]> {
    const version = ++this.#searchVersion;
    await this.#writeQueue;
    await this.#open();
    const query = request.query.trim().toLocaleLowerCase();
    if (query === "") return [];
    const events = request.scopeId
      ? [...(this.#events.get(request.scopeId)?.values() ?? [])]
      : [...this.#events.values()].flatMap((scope) => [...scope.values()]);
    const cachedRelayUrls = new Map<string, string>();
    if (this.#store.readCachedEvents) {
      const limit = Math.max(1, Math.min(100, request.limit ?? 100));
      for (const scope of this.#scopes.values()) {
        if (request.scopeId && scope.id !== request.scopeId) continue;
        if (this.#privacyFailures.has(scope.id)) continue;
        let before: import("./contracts.js").CommunityContentCursor | undefined;
        let matches = 0;
        while (matches < limit) {
          const page = await this.#store.readCachedEvents(scope, {
            kinds: [9, 11, 1111],
            limit: 100,
            ...(before ? { before } : {}),
          });
          if (version !== this.#searchVersion) return [];
          for (const event of page.events) {
            if (!event.content.toLocaleLowerCase().includes(query)) continue;
            events.push(event);
            cachedRelayUrls.set(event.id, scope.relayUrl);
            matches++;
          }
          if (
            !page.hasMoreCached ||
            !page.olderCursor ||
            (before?.eventId === page.olderCursor.eventId &&
              before.createdAt === page.olderCursor.createdAt)
          )
            break;
          before = page.olderCursor;
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
    }
    return [...new Map(events.map((event) => [event.id, event])).values()]
      .filter(
        (event) =>
          !this.#privateIds.has(event.id) &&
          ![1059, 30622, 40100].includes(event.kind) &&
          !isRegistryControlEvent(event) &&
          event.content.toLocaleLowerCase().includes(query),
      )
      .toSorted(
        (left, right) =>
          right.created_at - left.created_at || right.id.localeCompare(left.id),
      )
      .slice(0, request.limit ?? 100)
      .map((event) => ({
        event,
        relayUrl:
          [...this.#relayUrls.values()]
            .map((relayUrls) => relayUrls.get(event.id))
            .find((relayUrl) => relayUrl !== undefined) ??
          cachedRelayUrls.get(event.id) ??
          "",
      }));
  }

  async clearPrivate(): Promise<void> {
    this.#searchVersion++;
    await this.#writeQueue;
    for (const [scopeId, events] of this.#events) {
      const privateGroups =
        this.#privacy.get(scopeId)?.groups ?? new Set<string>();
      for (const [id, event] of events)
        if (
          this.#privateIds.has(id) ||
          [1059, 30622].includes(event.kind) ||
          event.tags.some(
            (tag) =>
              (tag[0] === "h" || tag[0] === "d") &&
              !!tag[1] &&
              privateGroups.has(tag[1]),
          )
        ) {
          events.delete(id);
          this.#relayUrls.get(scopeId)?.delete(id);
        }
    }
    this.#privateIds.clear();
    this.#privacy.clear();
    this.#revision += 1;
  }

  async clear(scope?: CommunityScope): Promise<void> {
    this.#searchVersion++;
    await this.#writeQueue;
    await this.#open();
    if (scope === undefined) {
      this.#scopes.clear();
      this.#privacy.clear();

      this.#events.clear();
      this.#relayUrls.clear();
      this.#approximateBytes = 0;
    } else {
      this.#scopes.delete(scope.id);
      this.#privacy.delete(scope.id);

      const removed = this.#events.get(scope.id);
      if (removed !== undefined) {
        this.#approximateBytes = Math.max(
          0,
          this.#approximateBytes -
            [...removed.values()].reduce(
              (total, event) =>
                total +
                communityEventBytes({
                  event,
                  relayUrl: scope.relayUrl,
                  audience: { type: "public" },
                }),
              0,
            ),
        );
      }
      this.#events.delete(scope.id);
      this.#relayUrls.delete(scope.id);
    }
    await this.#store.clear(scope);
    if (scope) this.#privacyFailures.delete(scope.id);
    else this.#privacyFailures.clear();
    this.#revision += 1;
  }

  dispose(): void {
    this.#searchVersion++;
    this.#scopes.clear();
    this.#events.clear();
    this.#relayUrls.clear();
    void this.#writeQueue.finally(() => this.#store.close());
    this.#opened = false;
  }

  async #open(): Promise<void> {
    if (this.#opened) return;
    await this.#store.open();
    this.#opened = true;
  }

  #eventCount(): number {
    return [...this.#events.values()].reduce(
      (total, events) => total + events.size,
      0,
    );
  }

  #eventRecord(): Record<string, readonly NostrEvent[]> {
    return Object.fromEntries(
      [...this.#events].map(([scopeId, events]) => [
        scopeId,
        [...events.values()].toSorted(
          (left, right) =>
            left.created_at - right.created_at ||
            left.id.localeCompare(right.id),
        ),
      ]),
    );
  }

  #revisionValue(
    generation: number,
    freshness: CommunityCacheState["freshness"],
  ): CommunityRuntimeRevision {
    const degradedReason = this.#writeError ?? storeDegradedReason(this.#store);
    return {
      generation,
      revision: this.#revision,
      cache: {
        mode: this.#store.mode,
        freshness,
        ...(degradedReason === undefined ? {} : { degradedReason }),
        ...(this.#lastSynchronizedAt === undefined
          ? {}
          : { lastSynchronizedAt: this.#lastSynchronizedAt }),
        approximateBytes: this.#approximateBytes,
      },
    };
  }
}

function storeDegradedReason(store: CommunityEventStore): string | undefined {
  return "degradedReason" in store &&
    typeof (store as CommunityEventStore & { degradedReason?: unknown })
      .degradedReason === "string"
    ? (store as CommunityEventStore & { degradedReason: string }).degradedReason
    : undefined;
}

function eventRoomId(event: NostrEvent): string | undefined {
  return (
    event.tags.find((tag) => tag[0] === "h")?.[1] ??
    (event.kind >= 30_000 && event.kind < 40_000
      ? event.tags.find((tag) => tag[0] === "d")?.[1]
      : undefined)
  );
}
