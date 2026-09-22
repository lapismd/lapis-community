import {
  initializeCacheAccounting,
  initializeEventReferences,
} from "./cache-accounting-sql.js";
import { initializeAgentArchiveDatabase } from "./agent-archive-turso.js";

export const DEFAULT_TURSO_OPEN_TIMEOUT_MS = 8_000;
export const TURSO_OPEN_TIMEOUT_MESSAGE = "Community cache open timed out";

export interface TursoDatabase {
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

export interface TursoDatabaseOpenOptions {
  databaseName: string;
  openTimeoutMs?: number;
}

export interface OpenedTursoDatabase {
  database: TursoDatabase;
  releaseLock: () => void;
}

export async function openTursoCommunityDatabase(
  options: TursoDatabaseOpenOptions,
): Promise<OpenedTursoDatabase> {
  const timeoutMs = options.openTimeoutMs ?? DEFAULT_TURSO_OPEN_TIMEOUT_MS;
  let abandoned = false;
  let releaseLock: (() => void) | undefined;
  const ready = (async () => {
    releaseLock = await acquireDatabaseLock(options.databaseName);
    if (abandoned) {
      releaseLock();
      throw new Error("Community cache open was abandoned");
    }
    const database = await connectTursoDatabase(options.databaseName);
    if (abandoned) {
      await database.close().catch(() => undefined);
      releaseLock();
      throw new Error("Community cache open was abandoned");
    }
    return database;
  })();
  let database: TursoDatabase;
  try {
    database = await withDeadline(ready, timeoutMs, TURSO_OPEN_TIMEOUT_MESSAGE);
  } catch (cause) {
    abandoned = true;
    releaseLock?.();
    releaseLock = undefined;
    throw cause;
  }
  try {
    await initializeOpenedTursoDatabase(database);
  } catch (cause) {
    await database.close().catch(() => undefined);
    releaseLock?.();
    throw cause;
  }
  return { database, releaseLock: releaseLock! };
}

async function connectTursoDatabase(
  databaseName: string,
): Promise<TursoDatabase> {
  // The package's prebuilt browser bundle keeps its WASM worker graph
  // self-contained. The Vite development entry currently initializes an
  // incomplete emnapi worker pool and fails while reading `whenLoaded`.
  const { connect } = (await import(
    "@tursodatabase/database-wasm/bundle" as string
  )) as { connect(path: string): Promise<TursoDatabase> };
  return connect(databaseName);
}

async function initializeOpenedTursoDatabase(
  database: TursoDatabase,
): Promise<void> {
  await initializeAgentArchiveDatabase(database);
  await database.exec(`
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
  await initializeCacheAccounting(database);
  await initializeEventReferences(database);
  let afterKey = "";
  for (;;) {
    const legacy = await database.all<{
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
    if (updates.length) await database.batch(updates, "write");
    afterKey = legacy.at(-1)!.cache_key;
    if (legacy.length < 100) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  try {
    await database.exec(
      "ALTER TABLE community_checkpoints ADD COLUMN cursor_event_id TEXT",
    );
  } catch {
    // Existing databases may already contain the additive cursor column.
  }
  try {
    await database.exec(
      "ALTER TABLE community_checkpoints ADD COLUMN complete INTEGER",
    );
  } catch {
    // Existing databases may already contain the additive completion column.
  }
}

export async function acquireDatabaseLock(name: string): Promise<() => void> {
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
  return () => {
    release?.();
    release = undefined;
  };
}

async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
