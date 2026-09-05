import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type {
  CommunityCacheAudience,
  CommunityCachedScope,
  CommunityScope,
  CommunitySyncCheckpoint,
  CommunityVerifiedEventBatch,
} from "./contracts.js";
import {
  BaseCommunityEventStore,
  communityCacheAudienceKey,
  communityCacheScopeKey,
  communityEventBytes,
  type CommunityEventStoreOptions,
} from "./event-store.js";
import { isVerifiedNostrEvent, verifiedNostrEvent } from "./verified-events.js";

interface IndexedEventRow {
  key: string;
  scopeKey: string;
  partitionKey: string;
  eventId: string;
  event: CommunityVerifiedEventBatch["records"][number]["event"];
  relayUrl: string;
  roomId?: string;
  createdAt: number;
  lastAccessedAt: number;
  bytes: number;
}

interface IndexedCheckpointRow extends CommunitySyncCheckpoint {
  key: string;
  scopeKey: string;
}

interface CommunityCacheDb extends DBSchema {
  events: {
    key: string;
    value: IndexedEventRow;
    indexes: {
      scope: string;
      partition: string;
      access: number;
    };
  };
  checkpoints: {
    key: string;
    value: IndexedCheckpointRow;
    indexes: { scope: string };
  };
}

export interface IndexedDbCommunityEventStoreOptions
  extends CommunityEventStoreOptions {
  databaseName?: string;
}

const DEFAULT_MAX_BYTES = 64 * 1_024 * 1_024;

export function createIndexedDbCommunityEventStore(
  options: IndexedDbCommunityEventStoreOptions = {},
) {
  return new IndexedDbCommunityEventStore(options);
}

class IndexedDbCommunityEventStore extends BaseCommunityEventStore {
  readonly mode = "indexeddb" as const;
  readonly #databaseName: string;
  readonly #maxBytes: number;
  #database: IDBPDatabase<CommunityCacheDb> | undefined;

  constructor(options: IndexedDbCommunityEventStoreOptions) {
    super();
    this.#databaseName =
      options.databaseName ?? "lapismd-community-event-cache-v1";
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  async open(): Promise<void> {
    if (this.#database !== undefined) return;
    this.#database = await openDB<CommunityCacheDb>(this.#databaseName, 1, {
      upgrade(database) {
        const events = database.createObjectStore("events", { keyPath: "key" });
        events.createIndex("scope", "scopeKey");
        events.createIndex("partition", "partitionKey");
        events.createIndex("access", "lastAccessedAt");
        const checkpoints = database.createObjectStore("checkpoints", {
          keyPath: "key",
        });
        checkpoints.createIndex("scope", "scopeKey");
      },
    });
  }

  async restore(
    scope: CommunityScope,
    audience: CommunityCacheAudience = { type: "public" },
  ): Promise<CommunityCachedScope> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const partitionKey = `${scopeKey}:${communityCacheAudienceKey(audience)}`;
    const [rows, checkpoints] = await Promise.all([
      database.getAllFromIndex("events", "partition", partitionKey),
      database.getAllFromIndex("checkpoints", "scope", scopeKey),
    ]);
    const validRows = rows
      .flatMap((row) => {
        const event = verifiedNostrEvent(row.event);
        return event === undefined ? [] : [{ ...row, event }];
      })
      .toSorted(
        (left, right) =>
          left.createdAt - right.createdAt ||
          left.eventId.localeCompare(right.eventId),
      );
    return {
      events: validRows.map((row) => row.event),
      checkpoints: checkpoints.map((checkpoint) => ({
        relayUrl: checkpoint.relayUrl,
        stream: checkpoint.stream,
        createdAt: checkpoint.createdAt,
        synchronizedAt: checkpoint.synchronizedAt,
        ...(checkpoint.cursorEventId === undefined
          ? {}
          : { cursorEventId: checkpoint.cursorEventId }),
        ...(checkpoint.complete === undefined
          ? {}
          : { complete: checkpoint.complete }),
      })),
      approximateBytes: validRows.reduce((total, row) => total + row.bytes, 0),
    };
  }

  async commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(batch.scope);
    const transaction = database.transaction(
      ["events", "checkpoints"],
      "readwrite",
    );
    for (const record of batch.records) {
      if (!isVerifiedNostrEvent(record.event)) continue;
      const audience = communityCacheAudienceKey(record.audience);
      const partitionKey = `${scopeKey}:${audience}`;
      const key = `${partitionKey}:${record.event.id}`;
      const current = await transaction.objectStore("events").get(key);
      await transaction.objectStore("events").put({
        key,
        scopeKey,
        partitionKey,
        eventId: record.event.id,
        event: record.event,
        relayUrl: record.relayUrl,
        ...(record.roomId === undefined ? {} : { roomId: record.roomId }),
        createdAt: record.event.created_at,
        lastAccessedAt: Math.max(
          record.lastAccessedAt ?? Date.now(),
          current?.lastAccessedAt ?? 0,
        ),
        bytes: communityEventBytes(record),
      });
    }
    for (const checkpoint of batch.checkpoints ?? []) {
      await transaction
        .objectStore("checkpoints")
        .put(checkpointRow(scopeKey, checkpoint));
    }
    await transaction.done;
    await this.prune();
  }

  async markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const transaction = database.transaction("checkpoints", "readwrite");
    for (const checkpoint of checkpoints) {
      await transaction.store.put(checkpointRow(scopeKey, checkpoint));
    }
    await transaction.done;
  }

  async prune(): Promise<void> {
    const database = this.#requireDatabase();
    const rows = await database.getAllFromIndex("events", "access");
    let total = rows.reduce((sum, row) => sum + row.bytes, 0);
    if (total <= this.#maxBytes) return;
    const transaction = database.transaction("events", "readwrite");
    for (const row of rows) {
      await transaction.store.delete(row.key);
      total -= row.bytes;
      if (total <= this.#maxBytes) break;
    }
    await transaction.done;
  }

  async clear(scope?: CommunityScope): Promise<void> {
    const database = this.#requireDatabase();
    if (scope === undefined) {
      const transaction = database.transaction(
        ["events", "checkpoints"],
        "readwrite",
      );
      await transaction.objectStore("events").clear();
      await transaction.objectStore("checkpoints").clear();
      await transaction.done;
      return;
    }
    const scopeKey = communityCacheScopeKey(scope);
    const transaction = database.transaction(
      ["events", "checkpoints"],
      "readwrite",
    );
    const eventKeys = await transaction
      .objectStore("events")
      .index("scope")
      .getAllKeys(scopeKey);
    const checkpointKeys = await transaction
      .objectStore("checkpoints")
      .index("scope")
      .getAllKeys(scopeKey);
    await Promise.all([
      ...eventKeys.map((key) => transaction.objectStore("events").delete(key)),
      ...checkpointKeys.map((key) =>
        transaction.objectStore("checkpoints").delete(key),
      ),
    ]);
    await transaction.done;
  }

  async close(): Promise<void> {
    this.#database?.close();
    this.#database = undefined;
  }

  #requireDatabase(): IDBPDatabase<CommunityCacheDb> {
    if (this.#database === undefined) {
      throw new Error("Community event store is not open");
    }
    return this.#database;
  }
}

function checkpointRow(
  scopeKey: string,
  checkpoint: CommunitySyncCheckpoint,
): IndexedCheckpointRow {
  return {
    ...checkpoint,
    relayUrl: normalizeRelayUrl(checkpoint.relayUrl),
    scopeKey,
    key: `${scopeKey}:${normalizeRelayUrl(checkpoint.relayUrl)}:${checkpoint.stream}`,
  };
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString();
}
