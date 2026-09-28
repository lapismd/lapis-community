import {
  eventReferenceStatements,
  eventAccountingStatements,
  cachePageStatements,
  pruneCache,
  clearCacheStatements,
  removeCachedEventStatements,
} from "./cache-accounting-sql.js";
import {
  openTursoCommunityDatabase,
  type TursoDatabase,
} from "./turso-database-open.js";
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
import { createTursoAgentActivityStore } from "./agent-archive-turso.js";
import { canUseTursoCommunityEventStore } from "./turso-browser-capabilities.js";

export { canUseTursoCommunityEventStore };

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
  openTimeoutMs?: number;
}

const DEFAULT_MAX_BYTES = 64 * 1_024 * 1_024;

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
  readonly #openTimeoutMs: number | undefined;
  #database: TursoDatabase | undefined;
  #opening: Promise<void> | undefined;
  #releaseLock: (() => void) | undefined;

  constructor(options: TursoCommunityEventStoreOptions) {
    super();
    this.#databaseName =
      options.databaseName ?? "lapismd-community-event-cache-v1.db";
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.#openTimeoutMs = options.openTimeoutMs;
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
    const opened = await openTursoCommunityDatabase({
      databaseName: this.#databaseName,
      ...(this.#openTimeoutMs === undefined
        ? {}
        : { openTimeoutMs: this.#openTimeoutMs }),
    });
    this.#database = opened.database;
    this.#releaseLock = opened.releaseLock;
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

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
  return url.toString();
}
