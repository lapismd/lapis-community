import type {
  CommunityCacheAudience,
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

export function communityEventBytes(record: CommunityVerifiedEventRecord): number {
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
  readonly mode = "memory" as const;
  readonly #records = new Map<string, Map<string, StoredRecord>>();
  readonly #checkpoints = new Map<string, Map<string, CommunitySyncCheckpoint>>();
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
      checkpoints: [...(this.#checkpoints.get(communityCacheScopeKey(scope))?.values() ?? [])],
      approximateBytes: records.reduce((total, record) => total + record.bytes, 0),
    };
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
    }
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
      stored.set(`${normalizeRelayUrl(checkpoint.relayUrl)}:${checkpoint.stream}`, {
        ...checkpoint,
        relayUrl: normalizeRelayUrl(checkpoint.relayUrl),
      });
    }
    this.#checkpoints.set(key, stored);
  }

  async prune(): Promise<void> {
    this.#assertOpen();
    const all = [...this.#records.entries()].flatMap(([partition, records]) =>
      [...records.values()].map((record) => ({ partition, record })),
    );
    let bytes = all.reduce((total, entry) => total + entry.record.bytes, 0);
    if (bytes <= this.#maxBytes) return;
    for (const entry of all.toSorted(
      (left, right) =>
        (left.record.lastAccessedAt ?? 0) -
        (right.record.lastAccessedAt ?? 0),
    )) {
      this.#records.get(entry.partition)?.delete(entry.record.event.id);
      bytes -= entry.record.bytes;
      if (bytes <= this.#maxBytes) break;
    }
  }

  async clear(scope?: CommunityScope): Promise<void> {
    this.#assertOpen();
    if (scope === undefined) {
      this.#records.clear();
      this.#checkpoints.clear();
      return;
    }
    const prefix = `${communityCacheScopeKey(scope)}:`;
    for (const key of this.#records.keys()) {
      if (key.startsWith(prefix)) this.#records.delete(key);
    }
    this.#checkpoints.delete(communityCacheScopeKey(scope));
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
