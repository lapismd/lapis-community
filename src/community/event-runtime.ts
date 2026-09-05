import type { NostrEvent } from "../protocol/index.js";
import { isRegistryPublisherAuthorizationEvent } from "../protocol/registry-control.js";

import type {
  CommunityCacheState,
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
  readonly #store: CommunityEventStore;
  readonly #events = new Map<string, Map<string, NostrEvent>>();
  readonly #relayUrls = new Map<string, Map<string, string>>();
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
  ): Promise<CommunityRuntimeRevision> {
    await this.#writeQueue;
    await this.#open();
    this.#approximateBytes = 0;
    const syncPlans: Record<
      string,
      Awaited<ReturnType<CommunityEventStore["syncPlan"]>>
    > = {};
    for (const scope of scopes) {
      const cached = await this.#store.restore(scope);
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
    const events = this.#events.get(batch.scope.id) ?? new Map();
    const relayUrls = this.#relayUrls.get(batch.scope.id) ?? new Map();
    const accepted: NostrEvent[] = [];
    for (const incoming of batch.events) {
      if (events.has(incoming.id)) continue;
      const event = verifiedNostrEvent(incoming);
      if (event === undefined) continue;
      events.set(event.id, event);
      relayUrls.set(event.id, batch.relayUrl);
      accepted.push(event);
    }
    if (accepted.length === 0 && (batch.checkpoints?.length ?? 0) === 0) {
      return undefined;
    }
    if (accepted.length > 0) {
      this.#events.set(batch.scope.id, events);
      this.#relayUrls.set(batch.scope.id, relayUrls);
    }
    if (batch.persist !== false) {
      const persistedBatch = {
        scope: batch.scope,
        records: accepted.map((event) => {
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
      };
      const commit = this.#writeQueue.then(() =>
        this.#store.commit(persistedBatch),
      );
      this.#writeQueue = commit
        .then(() => {
          this.#writeError = undefined;
        })
        .catch((cause: unknown) => {
          this.#writeError = `Local cache write failed: ${
            cause instanceof Error ? cause.message : String(cause)
          }`;
        });
      if (batch.checkpoints !== undefined) await commit;
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

  async project(
    selection: CommunityRuntimeSelection,
  ): Promise<CommunityRuntimeRevision> {
    await this.#open();
    this.#revision += 1;
    const eventsByScope = this.#eventRecord();
    const events = eventsByScope[selection.activeCommunityId] ?? [];
    const workspace = materializeCommunityWorkspace(
      selection.scopes,
      eventsByScope,
      selection.activeCommunityId,
      {
        activeRoomId: selection.activeRoomId,
        ...(selection.activeTopicId === undefined
          ? {}
          : { activeTopicId: selection.activeTopicId }),
        ...(selection.activeThreadId === undefined
          ? {}
          : { activeThreadId: selection.activeThreadId }),
        ...(selection.identityPubkey === undefined
          ? {}
          : { identityPubkey: selection.identityPubkey }),
        privateEvents:
          selection.privateEventsByScope?.[selection.activeCommunityId] ?? [],
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
    await this.#open();
    const query = request.query.trim().toLocaleLowerCase();
    if (query === "") return [];
    const events = request.scopeId
      ? [...(this.#events.get(request.scopeId)?.values() ?? [])]
      : [...this.#events.values()].flatMap((scope) => [...scope.values()]);
    return events
      .filter(
        (event) =>
          !isRegistryPublisherAuthorizationEvent(event) &&
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
            .find((relayUrl) => relayUrl !== undefined) ?? "",
      }));
  }

  async clear(scope?: CommunityScope): Promise<void> {
    await this.#writeQueue;
    await this.#open();
    if (scope === undefined) {
      this.#events.clear();
      this.#relayUrls.clear();
      this.#approximateBytes = 0;
    } else {
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
    this.#revision += 1;
  }

  dispose(): void {
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
