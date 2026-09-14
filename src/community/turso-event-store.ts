import {
  initializeCacheAccounting,
  initializeEventReferences,
  eventReferenceStatements,
  eventAccountingStatements,
  cachePageStatements,
  pruneCache,
  clearCacheStatements,
  removeCachedEventStatements,
} from "./cache-accounting-sql.js";
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
import {
  createTursoAgentActivityStore,
  initializeAgentArchiveDatabase,
} from "./agent-archive-turso.js";

interface TursoDatabase {
  exec(sql: string): Promise<void>;
  all<T extends Record<string, unknown>>(
    sql: string,
    ...parameters: unknown[]
  ): Promise<T[]>;
  batch(
    statements: Array<{ sql: string; args?: unknown[] }>,
    mode?: string,
  ): Promise<unknown>;
  close(): Promise<void>;
}

interface TursoEventRow extends Record<string, unknown> {
  raw_json: string;
  bytes: number;
}

interface TursoCheckpointRow extends Record<string, unknown> {
  relay_url: string;
  stream: string;
  created_at: number;
  synchronized_at: number;
  cursor_event_id: string | null;
  complete: number | null;
}

export interface TursoCommunityEventStoreOptions
  extends CommunityEventStoreOptions {
  databaseName?: string;
}

const DEFAULT_MAX_BYTES = 64 * 1_024 * 1_024;

export function canUseTursoCommunityEventStore(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function" &&
    typeof navigator.locks?.request === "function" &&
    typeof SharedArrayBuffer !== "undefined" &&
    typeof Atomics !== "undefined" &&
    globalThis.crossOriginIsolated === true
  );
}

export function createTursoCommunityEventStore(
  options: TursoCommunityEventStoreOptions = {},
) {
  return new TursoCommunityEventStore(options);
}

class TursoCommunityEventStore extends BaseCommunityEventStore {
  readonly agentActivity = createTursoAgentActivityStore(() =>
    this.#requireDatabase(),
  );
  readonly mode = "turso-opfs" as const;
  readonly #databaseName: string;
  readonly #maxBytes: number;
  #database: TursoDatabase | undefined;
  #opening: Promise<void> | undefined;
  #releaseLock: (() => void) | undefined;

  constructor(options: TursoCommunityEventStoreOptions) {
    super();
    this.#databaseName =
      options.databaseName ?? "lapismd-community-event-cache-v1.db";
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  open(): Promise<void> {
    if (this.#opening) return this.#opening;
    if (this.#database !== undefined) return Promise.resolve();
    this.#opening = this.#initialize().finally(() => {
      this.#opening = undefined;
    });
    return this.#opening;
  }

  async #initialize(): Promise<void> {
    if (!canUseTursoCommunityEventStore()) {
      throw new Error("Turso requires OPFS and cross-origin isolation");
    }
    this.#releaseLock = await acquireDatabaseLock(this.#databaseName);
    try {
      // The package's prebuilt browser bundle keeps its WASM worker graph
      // self-contained. The Vite development entry currently initializes an
      // incomplete emnapi worker pool and fails while reading `whenLoaded`.
      const { connect } = (await import(
        "@tursodatabase/database-wasm/bundle" as string
      )) as { connect(path: string): Promise<TursoDatabase> };
      this.#database = await connect(this.#databaseName);
      await initializeAgentArchiveDatabase(this.#database);
      await this.#database.exec(`
        CREATE TABLE IF NOT EXISTS community_events (
          cache_key TEXT PRIMARY KEY,
          scope_key TEXT NOT NULL,
          partition_key TEXT NOT NULL,
          event_id TEXT NOT NULL,
          relay_url TEXT NOT NULL,
          room_id TEXT,
          created_at INTEGER NOT NULL,
          last_accessed_at INTEGER NOT NULL,
          bytes INTEGER NOT NULL,
          raw_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS community_events_partition_idx
          ON community_events(partition_key, created_at, event_id);
        CREATE INDEX IF NOT EXISTS community_events_kind_idx ON community_events(partition_key, json_extract(raw_json, '$.kind'), created_at, event_id);
        CREATE INDEX IF NOT EXISTS community_events_room_kind_idx ON community_events(partition_key, room_id, json_extract(raw_json, '$.kind'), created_at, event_id);
        CREATE INDEX IF NOT EXISTS community_events_access_idx
          ON community_events(last_accessed_at);
        CREATE TABLE IF NOT EXISTS community_history_pages (
          cache_key TEXT PRIMARY KEY, scope_key TEXT NOT NULL, raw_json TEXT NOT NULL, bytes INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS community_history_pages_scope_idx ON community_history_pages(scope_key);
        CREATE TABLE IF NOT EXISTS community_checkpoints (
          cache_key TEXT PRIMARY KEY,
          scope_key TEXT NOT NULL,
          relay_url TEXT NOT NULL,
          stream TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          synchronized_at INTEGER NOT NULL,
          cursor_event_id TEXT,
          complete INTEGER
        );
        CREATE INDEX IF NOT EXISTS community_checkpoints_scope_idx
          ON community_checkpoints(scope_key);
      `);
      await initializeCacheAccounting(this.#database);
      await initializeEventReferences(this.#database);
      // Add the room index without discarding caches written before room_id was
      // populated. Keep decoding and writes bounded in the database owner.
      let afterKey = "";
      for (;;) {
        const legacy = await this.#database.all<{
          cache_key: string;
          raw_json: string;
        }>(
          "SELECT cache_key, raw_json FROM community_events WHERE room_id IS NULL AND cache_key > ? ORDER BY cache_key LIMIT 100",
          afterKey,
        );
        if (!legacy.length) break;
        const updates = legacy.flatMap((row) => {
          try {
            const event = JSON.parse(row.raw_json) as { tags?: string[][] };
            const room = event.tags?.find((tag) => tag[0] === "h")?.[1];
            return room
              ? [
                  {
                    sql: "UPDATE community_events SET room_id = ? WHERE cache_key = ?",
                    args: [room, row.cache_key],
                  },
                ]
              : [];
          } catch {
            return [];
          }
        });
        if (updates.length) await this.#database.batch(updates, "write");
        afterKey = legacy.at(-1)!.cache_key;
        if (legacy.length < 100) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      try {
        await this.#database.exec(
          "ALTER TABLE community_checkpoints ADD COLUMN cursor_event_id TEXT",
        );
      } catch {
        // Existing databases may already contain the additive cursor column.
      }
      try {
        await this.#database.exec(
          "ALTER TABLE community_checkpoints ADD COLUMN complete INTEGER",
        );
      } catch {
        // Existing databases may already contain the additive completion column.
      }
    } catch (cause) {
      await this.#database?.close().catch(() => undefined);
      this.#database = undefined;
      this.#releaseLock?.();
      this.#releaseLock = undefined;
      throw cause;
    }
  }

  async restore(
    scope: CommunityScope,
    audience: CommunityCacheAudience = { type: "public" },
    metadataOnly = false,
  ): Promise<CommunityCachedScope> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const partitionKey = `${scopeKey}:${communityCacheAudienceKey(audience)}`;
    const [rows, checkpointRows, byteRows] = await Promise.all([
      database.all<TursoEventRow>(
        `SELECT raw_json, bytes FROM community_events
         WHERE partition_key = ? ${metadataOnly ? `AND json_extract(raw_json, '$.kind') IN (${COMMUNITY_CACHE_METADATA_KINDS.join(",")})` : ""} ORDER BY created_at ASC, event_id ASC`,
        partitionKey,
      ),
      database.all<TursoCheckpointRow>(
        `SELECT relay_url, stream, created_at, synchronized_at,
                cursor_event_id, complete
         FROM community_checkpoints WHERE scope_key = ?`,
        scopeKey,
      ),
      database.all<{ bytes: number }>(
        "SELECT bytes FROM community_cache_usage WHERE cache_key = ?",
        `partition:${partitionKey}`,
      ),
    ]);
    const events = rows.flatMap((row) => {
      try {
        const event = JSON.parse(
          row.raw_json,
        ) as CommunityVerifiedEventBatch["records"][number]["event"];
        const verified = verifiedNostrEvent(event);
        return verified === undefined ? [] : [verified];
      } catch {
        return [];
      }
    });
    return {
      events,
      checkpoints: checkpointRows.map((row) => ({
        relayUrl: row.relay_url,
        stream: row.stream,
        createdAt: Number(row.created_at),
        synchronizedAt: Number(row.synchronized_at),
        ...(typeof row.cursor_event_id === "string"
          ? { cursorEventId: row.cursor_event_id }
          : {}),
        ...(typeof row.complete === "number"
          ? { complete: row.complete === 1 }
          : {}),
      })),
      approximateBytes: Number(byteRows[0]?.bytes ?? 0),
    };
  }

  restoreMetadata(scope: CommunityScope) {
    return this.restore(scope, { type: "public" }, true);
  }

  async readCachedEvents(
    scope: CommunityScope,
    query: CommunityCachedEventQuery,
  ) {
    const database = this.#requireDatabase();
    const partition = `${communityCacheScopeKey(scope)}:${communityCacheAudienceKey(query.audience)}`;
    const limit = cachePageLimit(query.limit);
    if (!query.kinds.length) return cachedEventPage([], limit);
    const args: unknown[] = [partition, ...query.kinds];
    const where = [
      "partition_key = ?",
      `json_extract(raw_json, '$.kind') IN (${query.kinds.map(() => "?").join(",")})`,
    ];
    if (query.groupId) {
      where.push("room_id = ?");
      args.push(query.groupId);
    }
    if (query.before) {
      where.push("(created_at < ? OR (created_at = ? AND event_id < ?))");
      args.push(
        query.before.createdAt,
        query.before.createdAt,
        query.before.eventId,
      );
    }
    args.push(limit + 1);
    const rows = await database.all<TursoEventRow>(
      `SELECT raw_json, bytes FROM community_events WHERE ${where.join(" AND ")} ORDER BY created_at DESC, event_id DESC LIMIT ?`,
      ...args,
    );
    return cachedEventPage(
      rows.flatMap((row) => {
        const event = verifiedNostrEvent(JSON.parse(row.raw_json));
        return event ? [event] : [];
      }),
      limit,
    );
  }

  async readHistoryPage(
    scope: CommunityScope,
    key: string,
  ): Promise<CommunityCachedHistoryPage | undefined> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const [stored] = await database.all<{ raw_json: string }>(
      "SELECT raw_json FROM community_history_pages WHERE cache_key = ?",
      `${scopeKey}:${key}`,
    );
    if (!stored) return undefined;
    const page = JSON.parse(stored.raw_json) as CommunityHistoryPage;
    const partition = `${scopeKey}:${communityCacheAudienceKey(page.audience)}`;
    const rows = page.eventIds.length
      ? await database.all<TursoEventRow>(
          `SELECT raw_json, bytes FROM community_events WHERE partition_key = ? AND event_id IN (${page.eventIds.map(() => "?").join(",")})`,
          partition,
          ...page.eventIds,
        )
      : [];
    const byId = new Map(
      rows.flatMap((row) => {
        const event = verifiedNostrEvent(JSON.parse(row.raw_json));
        return event ? [[event.id, event] as const] : [];
      }),
    );
    if (page.eventIds.some((id) => !byId.has(id))) return undefined;
    return { page, events: page.eventIds.map((id) => byId.get(id)!) };
  }

  async commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(batch.scope);
    const statements: Array<{ sql: string; args?: unknown[] }> = [];
    const eventRowsByKey = new Map<string, unknown[]>();
    for (const record of batch.records) {
      if (!isVerifiedNostrEvent(record.event)) continue;
      const partitionKey = `${scopeKey}:${communityCacheAudienceKey(record.audience)}`;
      const key = `${partitionKey}:${record.event.id}`;
      const previous = eventRowsByKey.get(key);
      eventRowsByKey.set(key, [
        key,
        scopeKey,
        partitionKey,
        record.event.id,
        record.relayUrl,
        record.roomId ??
          record.event.tags.find((tag) => tag[0] === "h")?.[1] ??
          null,
        record.event.created_at,
        Math.max(
          record.lastAccessedAt ?? Date.now(),
          Number(previous?.[7] ?? 0),
        ),
        communityEventBytes(record),
        JSON.stringify(record.event),
      ]);
    }
    for (const rows of chunks([...eventRowsByKey.values()], 60)) {
      statements.push(...eventAccountingStatements(rows));
      statements.push({
        sql: `INSERT INTO community_events(
          cache_key, scope_key, partition_key, event_id, relay_url, room_id,
          created_at, last_accessed_at, bytes, raw_json
        ) VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
        ON CONFLICT(cache_key) DO UPDATE SET
          relay_url=excluded.relay_url,
          room_id=excluded.room_id,
          last_accessed_at=MAX(community_events.last_accessed_at, excluded.last_accessed_at)`,
        args: rows.flat(),
      });
    }
    statements.push(...eventReferenceStatements([...eventRowsByKey.values()]));
    for (const page of batch.historyPages ?? [])
      statements.push(...cachePageStatements(scopeKey, page));
    statements.push(
      ...(batch.checkpoints ?? []).map((checkpoint) =>
        checkpointStatement(scopeKey, checkpoint),
      ),
    );
    if (statements.length > 0) await database.batch(statements, "immediate");
    await this.prune();
  }

  async markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void> {
    if (checkpoints.length === 0) return;
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    await database.batch(
      checkpoints.map((checkpoint) =>
        checkpointStatement(scopeKey, checkpoint),
      ),
      "immediate",
    );
  }

  async prune(): Promise<void> {
    await pruneCache(this.#requireDatabase(), this.#maxBytes);
  }

  async hasPublicEventReferences(
    scope: CommunityScope,
    eventIds: readonly string[],
  ): Promise<boolean> {
    const partition = `${communityCacheScopeKey(scope)}:public`;
    for (const ids of chunks([...eventIds], 100)) {
      const rows = await this.#requireDatabase().all(
        `SELECT cache_key FROM community_events WHERE cache_key IN (${ids.map(() => "?").join(",")}) UNION ALL SELECT event_key AS cache_key FROM community_event_references WHERE reference_key IN (${ids.map(() => "?").join(",")}) LIMIT 1`,
        ...ids.map((id) => `${partition}:${id}`),
        ...ids.map((id) => `${partition}:${id}`),
      );
      if (rows.length) return true;
    }
    return false;
  }

  async removePublicEvents(
    scope: CommunityScope,
    eventIds: readonly string[],
  ): Promise<void> {
    const partition = `${communityCacheScopeKey(scope)}:public`;
    for (const ids of chunks([...eventIds], 100)) {
      await this.#requireDatabase().batch(
        ids.flatMap((id) =>
          removeCachedEventStatements(`${partition}:${id}`, partition),
        ),
        "immediate",
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  async clear(scope?: CommunityScope): Promise<void> {
    await this.#requireDatabase().batch(
      clearCacheStatements(scope ? communityCacheScopeKey(scope) : undefined),
      "immediate",
    );
  }

  async close(): Promise<void> {
    await this.#opening?.catch(() => undefined);
    await this.#database?.close();
    this.#database = undefined;
    this.#releaseLock?.();
    this.#releaseLock = undefined;
  }

  #requireDatabase(): TursoDatabase {
    if (this.#database === undefined) {
      throw new Error("Community event store is not open");
    }
    return this.#database;
  }
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function checkpointStatement(
  scopeKey: string,
  checkpoint: CommunitySyncCheckpoint,
): { sql: string; args: unknown[] } {
  const relayUrl = normalizeRelayUrl(checkpoint.relayUrl);
  return {
    sql: `INSERT INTO community_checkpoints(
      cache_key, scope_key, relay_url, stream, created_at, synchronized_at,
      cursor_event_id, complete
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      created_at=excluded.created_at,
      synchronized_at=excluded.synchronized_at,
      cursor_event_id=excluded.cursor_event_id,
      complete=excluded.complete`,
    args: [
      `${scopeKey}:${relayUrl}:${checkpoint.stream}`,
      scopeKey,
      relayUrl,
      checkpoint.stream,
      checkpoint.createdAt,
      checkpoint.synchronizedAt,
      checkpoint.cursorEventId ?? null,
      checkpoint.complete === undefined ? null : checkpoint.complete ? 1 : 0,
    ],
  };
}

async function acquireDatabaseLock(name: string): Promise<() => void> {
  let release: (() => void) | undefined;
  let resolveAcquired!: () => void;
  let rejectAcquired!: (cause: unknown) => void;
  const acquired = new Promise<void>((resolve, reject) => {
    resolveAcquired = resolve;
    rejectAcquired = reject;
  });
  void navigator.locks.request(
    `lapismd-community:${name}`,
    { ifAvailable: true, mode: "exclusive" },
    async (lock) => {
      if (lock === null) {
        rejectAcquired(new Error("Community cache is open in another tab"));
        return;
      }
      resolveAcquired();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  );
  await acquired;
  return () => release?.();
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString();
}
