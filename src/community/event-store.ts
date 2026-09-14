import {
  COMMUNITY_CACHE_METADATA_KINDS,
  cachedEventPage,
  cachePageLimit,
} from "./history-pages.js";
import type {
  CommunityCacheAudience,
  CommunityCachedHistoryPage,
  CommunityHistoryPage,
  CommunityCachedEventQuery,
  CommunityCachedScope,
  CommunityEventStore,
  CommunityScope,
  CommunityStorageMode,
  CommunitySyncCheckpoint,
  CommunitySyncPlan,
  CommunityVerifiedEventBatch,
  CommunityVerifiedEventRecord,
} from "./contracts.js";
import { isVerifiedNostrEvent } from "./verified-events.js";
import { createMemoryAgentActivityStore } from "./agent-archive.js";

export interface CommunityEventStoreOptions {
  maxBytes?: number;
}

interface StoredRecord extends CommunityVerifiedEventRecord {
  bytes: number;
}

const DEFAULT_MAX_BYTES = 64 * 1_024 * 1_024;

export function communityCacheScopeKey(scope: CommunityScope): string {
  return `${scope.id}:${normalizeRelayUrl(scope.relayUrl)}`;
}

export function communityCacheAudienceKey(
  audience: CommunityCacheAudience = { type: "public" },
): string {
  return audience.type === "public" ? "public" : `inbox:${audience.pubkey}`;
}

export function communityCachedEventKey(
  scope: CommunityScope,
  audience: CommunityCacheAudience,
  eventId: string,
): string {
  return `${communityCacheScopeKey(scope)}:${communityCacheAudienceKey(audience)}:${eventId}`;
}

export function communityEventBytes(
  record: CommunityVerifiedEventRecord,
): number {
  return new TextEncoder().encode(JSON.stringify(record.event)).byteLength;
}

export function createMemoryCommunityEventStore(
  options: CommunityEventStoreOptions = {},
): CommunityEventStore {
  return new MemoryCommunityEventStore(options.maxBytes ?? DEFAULT_MAX_BYTES);
}

export abstract class BaseCommunityEventStore implements CommunityEventStore {
  abstract readonly mode: CommunityStorageMode;
  abstract open(): Promise<void>;
  abstract restore(
    scope: CommunityScope,
    audience?: CommunityCacheAudience,
  ): Promise<CommunityCachedScope>;
  abstract commit(batch: CommunityVerifiedEventBatch): Promise<void>;
  abstract markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void>;
  abstract prune(): Promise<void>;
  abstract clear(scope?: CommunityScope): Promise<void>;
  abstract close(): Promise<void>;

  async syncPlan(scope: CommunityScope): Promise<CommunitySyncPlan> {
    const cached = await this.restore(scope);
    return {
      checkpoints: cached.checkpoints,
      cachedEventIds: cached.events.map((event) => event.id),
    };
  }
}

class MemoryCommunityEventStore extends BaseCommunityEventStore {
  readonly agentActivity = createMemoryAgentActivityStore();
  readonly mode = "memory" as const;
  readonly #records = new Map<string, Map<string, StoredRecord>>();
  readonly #checkpoints = new Map<
    string,
    Map<string, CommunitySyncCheckpoint>
  >();
  readonly #ordered = new Map<string, StoredRecord[]>();
  readonly #historyPages = new Map<string, CommunityHistoryPage>();
  readonly #maxBytes: number;
  #opened = false;

  constructor(maxBytes: number) {
    super();
    this.#maxBytes = maxBytes;
  }

  async open(): Promise<void> {
    this.#opened = true;
  }

  async restore(
    scope: CommunityScope,
    audience: CommunityCacheAudience = { type: "public" },
  ): Promise<CommunityCachedScope> {
    this.#assertOpen();
    const key = partitionKey(scope, audience);
    const records = [...(this.#records.get(key)?.values() ?? [])]
      .filter((record) => isVerifiedNostrEvent(record.event))
      .toSorted(compareStoredRecords);
    return {
      events: records.map((record) => record.event),
      checkpoints: [
        ...(this.#checkpoints.get(communityCacheScopeKey(scope))?.values() ??
          []),
      ],
      approximateBytes: records.reduce(
        (total, record) => total + record.bytes,
        0,
      ),
    };
  }

  async restoreMetadata(scope: CommunityScope): Promise<CommunityCachedScope> {
    this.#assertOpen();
    const partition = partitionKey(scope, { type: "public" });
    const events = COMMUNITY_CACHE_METADATA_KINDS.flatMap((kind) =>
      (this.#ordered.get(`${partition}:${kind}`) ?? []).map(
        (record) => record.event,
      ),
    );
    return {
      events,
      checkpoints: [
        ...(this.#checkpoints.get(communityCacheScopeKey(scope))?.values() ??
          []),
      ],
      approximateBytes: [
        ...(this.#records.get(partition)?.values() ?? []),
      ].reduce((total, record) => total + record.bytes, 0),
    };
  }

  async readCachedEvents(
    scope: CommunityScope,
    query: CommunityCachedEventQuery,
  ) {
    this.#assertOpen();
    const partition = partitionKey(scope, query.audience ?? { type: "public" });
    const limit = cachePageLimit(query.limit);
    const selected = query.kinds.flatMap((kind) => {
      const records =
        this.#ordered.get(
          `${partition}:${kind}${query.groupId ? `:${query.groupId}` : ""}`,
        ) ?? [];
      let end = records.length;
      if (query.before) {
        let low = 0,
          high = end;
        while (low < high) {
          const middle = (low + high) >>> 1;
          const event = records[middle]!.event;
          if (
            event.created_at < query.before.createdAt ||
            (event.created_at === query.before.createdAt &&
              event.id < query.before.eventId)
          )
            low = middle + 1;
          else high = middle;
        }
        end = low;
      }
      return records
        .slice(Math.max(0, end - limit - 1), end)
        .map((record) => record.event);
    });
    return cachedEventPage(selected, limit);
  }

  async readHistoryPage(
    scope: CommunityScope,
    key: string,
  ): Promise<CommunityCachedHistoryPage | undefined> {
    this.#assertOpen();
    const page = this.#historyPages.get(
      `${communityCacheScopeKey(scope)}:${key}`,
    );
    if (!page) return undefined;
    const records = this.#records.get(partitionKey(scope, page.audience));
    const events = page.eventIds.flatMap((id) => {
      const record = records?.get(id);
      return record ? [record.event] : [];
    });
    if (events.length !== page.eventIds.length) return undefined;
    return { page: structuredClone(page), events };
  }

  async commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    this.#assertOpen();
    for (const record of batch.records) {
      if (!isVerifiedNostrEvent(record.event)) continue;
      const key = partitionKey(batch.scope, record.audience);
      const records = this.#records.get(key) ?? new Map<string, StoredRecord>();
      const current = records.get(record.event.id);
      records.set(record.event.id, {
        ...record,
        lastAccessedAt: Math.max(
          record.lastAccessedAt ?? Date.now(),
          current?.lastAccessedAt ?? 0,
        ),
        bytes: communityEventBytes(record),
      });
      this.#records.set(key, records);
      if (!current) {
        const group =
          record.roomId ?? record.event.tags.find((tag) => tag[0] === "h")?.[1];
        for (const indexKey of [
          `${key}:${record.event.kind}`,
          ...(group ? [`${key}:${record.event.kind}:${group}`] : []),
        ]) {
          const ordered = this.#ordered.get(indexKey) ?? [];
          const stored = records.get(record.event.id)!;
          let low = 0,
            high = ordered.length;
          while (low < high) {
            const middle = (low + high) >>> 1;
            if (compareStoredRecords(ordered[middle]!, stored) < 0)
              low = middle + 1;
            else high = middle;
          }
          ordered.splice(low, 0, stored);
          this.#ordered.set(indexKey, ordered);
        }
      }
    }
    for (const page of batch.historyPages ?? [])
      this.#historyPages.set(
        `${communityCacheScopeKey(batch.scope)}:${page.key}`,
        structuredClone(page),
      );
    if (batch.checkpoints !== undefined) {
      await this.markSynchronized(batch.scope, batch.checkpoints);
    }
    await this.prune();
  }

  async markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void> {
    this.#assertOpen();
    const key = communityCacheScopeKey(scope);
    const stored = this.#checkpoints.get(key) ?? new Map();
    for (const checkpoint of checkpoints) {
      stored.set(
        `${normalizeRelayUrl(checkpoint.relayUrl)}:${checkpoint.stream}`,
        {
          ...checkpoint,
          relayUrl: normalizeRelayUrl(checkpoint.relayUrl),
        },
      );
    }
    this.#checkpoints.set(key, stored);
  }

  async prune(): Promise<void> {
    this.#assertOpen();
    const all = [...this.#records.entries()].flatMap(([partition, records]) =>
      [...records.values()].map((record) => ({ partition, record })),
    );
    let bytes = all.reduce((total, entry) => total + entry.record.bytes, 0);
    const pageBytes = [...this.#historyPages.values()].reduce(
      (sum, page) =>
        sum + new TextEncoder().encode(JSON.stringify(page)).byteLength,
      0,
    );
    if (bytes + pageBytes <= this.#maxBytes) return;
    this.#historyPages.clear();
    if (bytes <= this.#maxBytes) return;
    for (const entry of all.toSorted(
      (left, right) =>
        (left.record.lastAccessedAt ?? 0) - (right.record.lastAccessedAt ?? 0),
    )) {
      this.#records.get(entry.partition)?.delete(entry.record.event.id);
      for (const [key, ordered] of this.#ordered)
        if (key.startsWith(`${entry.partition}:`)) {
          const index = ordered.findIndex(
            (record) => record.event.id === entry.record.event.id,
          );
          if (index >= 0) ordered.splice(index, 1);
        }
      bytes -= entry.record.bytes;
      if (bytes <= this.#maxBytes) break;
    }
  }

  async clear(scope?: CommunityScope): Promise<void> {
    this.#assertOpen();
    if (scope === undefined) {
      this.#records.clear();
      this.#ordered.clear();
      this.#checkpoints.clear();
      this.#historyPages.clear();
      return;
    }
    const prefix = `${communityCacheScopeKey(scope)}:`;
    for (const key of this.#records.keys()) {
      if (key.startsWith(prefix)) this.#records.delete(key);
    }
    this.#checkpoints.delete(communityCacheScopeKey(scope));
    for (const key of this.#ordered.keys())
      if (key.startsWith(prefix)) this.#ordered.delete(key);
    for (const key of this.#historyPages.keys())
      if (key.startsWith(prefix)) this.#historyPages.delete(key);
  }

  async close(): Promise<void> {
    this.#opened = false;
  }

  #assertOpen(): void {
    if (!this.#opened) throw new Error("Community event store is not open");
  }
}

function partitionKey(
  scope: CommunityScope,
  audience: CommunityCacheAudience,
): string {
  return `${communityCacheScopeKey(scope)}:${communityCacheAudienceKey(audience)}`;
}

function compareStoredRecords(left: StoredRecord, right: StoredRecord): number {
  return (
    left.event.created_at - right.event.created_at ||
    left.event.id.localeCompare(right.event.id)
  );
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString();
}
