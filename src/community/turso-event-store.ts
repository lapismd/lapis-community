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
  readonly mode = "turso-opfs" as const;
  readonly #databaseName: string;
  readonly #maxBytes: number;
  #database: TursoDatabase | undefined;
  #releaseLock: (() => void) | undefined;

  constructor(options: TursoCommunityEventStoreOptions) {
    super();
    this.#databaseName =
      options.databaseName ?? "lapismd-community-event-cache-v1.db";
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  async open(): Promise<void> {
    if (this.#database !== undefined) return;
    if (!canUseTursoCommunityEventStore()) {
      throw new Error("Turso requires OPFS and cross-origin isolation");
    }
    this.#releaseLock = await acquireDatabaseLock(this.#databaseName);
    try {
      // The package's Vite-aware export avoids recursively transforming its
      // prebundled worker entry in development while retaining the default
      // worker and WASM implementation in production builds.
      const { connect } = (await import(
        "@tursodatabase/database-wasm/vite" as string
      )) as { connect(path: string): Promise<TursoDatabase> };
      this.#database = await connect(this.#databaseName);
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
        CREATE INDEX IF NOT EXISTS community_events_access_idx
          ON community_events(last_accessed_at);
        CREATE TABLE IF NOT EXISTS community_checkpoints (
          cache_key TEXT PRIMARY KEY,
          scope_key TEXT NOT NULL,
          relay_url TEXT NOT NULL,
          stream TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          synchronized_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS community_checkpoints_scope_idx
          ON community_checkpoints(scope_key);
      `);
    } catch (cause) {
      this.#releaseLock?.();
      this.#releaseLock = undefined;
      throw cause;
    }
  }

  async restore(
    scope: CommunityScope,
    audience: CommunityCacheAudience = { type: "public" },
  ): Promise<CommunityCachedScope> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(scope);
    const partitionKey = `${scopeKey}:${communityCacheAudienceKey(audience)}`;
    const [rows, checkpointRows] = await Promise.all([
      database.all<TursoEventRow>(
        `SELECT raw_json, bytes FROM community_events
         WHERE partition_key = ? ORDER BY created_at ASC, event_id ASC`,
        partitionKey,
      ),
      database.all<TursoCheckpointRow>(
        `SELECT relay_url, stream, created_at, synchronized_at
         FROM community_checkpoints WHERE scope_key = ?`,
        scopeKey,
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
      })),
      approximateBytes: rows.reduce(
        (total, row) => total + Number(row.bytes),
        0,
      ),
    };
  }

  async commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    const database = this.#requireDatabase();
    const scopeKey = communityCacheScopeKey(batch.scope);
    const statements: Array<{ sql: string; args?: unknown[] }> = [];
    const eventRows: unknown[][] = [];
    for (const record of batch.records) {
      if (!isVerifiedNostrEvent(record.event)) continue;
      const partitionKey = `${scopeKey}:${communityCacheAudienceKey(record.audience)}`;
      eventRows.push([
        `${partitionKey}:${record.event.id}`,
        scopeKey,
        partitionKey,
        record.event.id,
        record.relayUrl,
        record.roomId ?? null,
        record.event.created_at,
        record.lastAccessedAt ?? Date.now(),
        communityEventBytes(record),
        JSON.stringify(record.event),
      ]);
    }
    for (const rows of chunks(eventRows, 60)) {
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
    const database = this.#requireDatabase();
    const [total] = await database.all<{ bytes: number }>(
      "SELECT COALESCE(SUM(bytes), 0) AS bytes FROM community_events",
    );
    let bytes = Number(total?.bytes ?? 0);
    if (bytes <= this.#maxBytes) return;
    const rows = await database.all<{ cache_key: string; bytes: number }>(
      `SELECT cache_key, bytes FROM community_events
       ORDER BY last_accessed_at ASC, created_at ASC`,
    );
    const statements: Array<{ sql: string; args: unknown[] }> = [];
    for (const row of rows) {
      statements.push({
        sql: "DELETE FROM community_events WHERE cache_key = ?",
        args: [row.cache_key],
      });
      bytes -= Number(row.bytes);
      if (bytes <= this.#maxBytes) break;
    }
    if (statements.length > 0) await database.batch(statements, "immediate");
  }

  async clear(scope?: CommunityScope): Promise<void> {
    const database = this.#requireDatabase();
    if (scope === undefined) {
      await database.batch(
        [
          { sql: "DELETE FROM community_events" },
          { sql: "DELETE FROM community_checkpoints" },
        ],
        "immediate",
      );
      return;
    }
    const key = communityCacheScopeKey(scope);
    await database.batch(
      [
        {
          sql: "DELETE FROM community_events WHERE scope_key = ?",
          args: [key],
        },
        {
          sql: "DELETE FROM community_checkpoints WHERE scope_key = ?",
          args: [key],
        },
      ],
      "immediate",
    );
  }

  async close(): Promise<void> {
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
      cache_key, scope_key, relay_url, stream, created_at, synchronized_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      created_at=excluded.created_at,
      synchronized_at=excluded.synchronized_at`,
    args: [
      `${scopeKey}:${relayUrl}:${checkpoint.stream}`,
      scopeKey,
      relayUrl,
      checkpoint.stream,
      checkpoint.createdAt,
      checkpoint.synchronizedAt,
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
