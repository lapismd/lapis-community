import type { CommunityHistoryPage } from "./contracts.js";
import {
  communityCacheAudienceKey,
  referencedEventIds,
} from "./event-store.js";

type Statement = { sql: string; args?: unknown[] };
interface Database {
  exec(sql: string): Promise<void>;
  all<T extends Record<string, unknown>>(
    sql: string,
    ...parameters: unknown[]
  ): Promise<T[]>;
  batch(statements: Statement[], mode?: string): Promise<unknown>;
}

export async function initializeCacheAccounting(
  database: Database,
): Promise<void> {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS community_cache_usage (cache_key TEXT PRIMARY KEY, bytes INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS community_history_page_events (page_key TEXT NOT NULL, event_key TEXT NOT NULL, PRIMARY KEY(page_key, event_key));
    CREATE INDEX IF NOT EXISTS community_history_page_events_event_idx ON community_history_page_events(event_key);
    CREATE INDEX IF NOT EXISTS community_events_access_key_idx ON community_events(last_accessed_at, cache_key);
  `);
  const columns = await database.all<{ name: string }>(
    "PRAGMA table_info(community_history_pages)",
  );
  if (!columns.some((column) => column.name === "last_accessed_at"))
    await database.exec(
      "ALTER TABLE community_history_pages ADD COLUMN last_accessed_at INTEGER NOT NULL DEFAULT 0",
    );
  await database.exec(
    "CREATE INDEX IF NOT EXISTS community_history_pages_access_idx ON community_history_pages(last_accessed_at, cache_key)",
  );
  const initialized = await database.all(
    "SELECT bytes FROM community_cache_usage WHERE cache_key = 'meta:version'",
  );
  if (initialized.length) return;
  let after = "";
  for (;;) {
    const pages = await database.all<{
      cache_key: string;
      scope_key: string;
      raw_json: string;
    }>(
      "SELECT cache_key, scope_key, raw_json FROM community_history_pages WHERE cache_key > ? ORDER BY cache_key LIMIT 100",
      after,
    );
    if (!pages.length) break;
    const statements: Statement[] = [];
    for (const row of pages) {
      let page: CommunityHistoryPage;
      try {
        page = JSON.parse(row.raw_json) as CommunityHistoryPage;
        if (
          !Array.isArray(page.eventIds) ||
          !Number.isFinite(page.synchronizedAt)
        )
          throw new Error("Invalid cached page");
      } catch {
        statements.push(
          {
            sql: "DELETE FROM community_history_page_events WHERE page_key=?",
            args: [row.cache_key],
          },
          {
            sql: "DELETE FROM community_history_pages WHERE cache_key=?",
            args: [row.cache_key],
          },
        );
        continue;
      }
      statements.push({
        sql: "UPDATE community_history_pages SET last_accessed_at = ? WHERE cache_key = ?",
        args: [page.synchronizedAt * 1000, row.cache_key],
      });
      statements.push(
        ...pageReferenceStatements(row.cache_key, row.scope_key, page),
      );
    }
    await database.batch(statements, "immediate");
    after = pages.at(-1)!.cache_key;
    if (pages.length < 100) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  // Only migration reads all byte counters; ordinary commits update exact deltas.
  await database.batch(
    [
      { sql: "DELETE FROM community_cache_usage" },
      {
        sql: "INSERT INTO community_cache_usage(cache_key,bytes) SELECT 'partition:' || partition_key, SUM(bytes) FROM community_events GROUP BY partition_key",
      },
      {
        sql: "INSERT INTO community_cache_usage(cache_key,bytes) VALUES ('total',(SELECT COALESCE(SUM(bytes),0) FROM community_events)+(SELECT COALESCE(SUM(bytes),0) FROM community_history_pages))",
      },
      {
        sql: "INSERT INTO community_cache_usage(cache_key,bytes) VALUES ('meta:version',1)",
      },
    ],
    "immediate",
  );
}

export function eventAccountingStatements(
  rows: readonly unknown[][],
): Statement[] {
  const partitions = new Map<string, unknown[][]>();
  for (const row of rows) {
    const key = String(row[2]);
    const grouped = partitions.get(key) ?? [];
    grouped.push(row);
    partitions.set(key, grouped);
  }
  return [...partitions].flatMap(([partition, records]) => {
    const added = records
      .map(
        () =>
          "CASE WHEN EXISTS (SELECT 1 FROM community_events WHERE cache_key=?) THEN 0 ELSE ? END",
      )
      .join(" + ");
    return ["total", `partition:${partition}`].map((key) => ({
      sql: `INSERT INTO community_cache_usage(cache_key,bytes) VALUES (?, ${added}) ON CONFLICT(cache_key) DO UPDATE SET bytes=community_cache_usage.bytes+excluded.bytes`,
      args: [key, ...records.flatMap((row) => [row[0], row[8]])],
    }));
  });
}

function pageReferenceStatements(
  key: string,
  scope: string,
  page: CommunityHistoryPage,
): Statement[] {
  const ids = [...new Set(page.eventIds)];
  const prefix = `${scope}:${communityCacheAudienceKey(page.audience)}:`;
  const statements: Statement[] = [
    {
      sql: "DELETE FROM community_history_page_events WHERE page_key = ?",
      args: [key],
    },
  ];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    statements.push({
      sql: `INSERT INTO community_history_page_events(page_key,event_key) VALUES ${batch.map(() => "(?,?)").join(",")}`,
      args: batch.flatMap((id) => [key, `${prefix}${id}`]),
    });
  }
  return statements;
}

export function cachePageStatements(
  scope: string,
  page: CommunityHistoryPage,
): Statement[] {
  const key = `${scope}:${page.key}`,
    json = JSON.stringify(page),
    bytes = new TextEncoder().encode(json).byteLength;
  return [
    {
      sql: "INSERT INTO community_cache_usage(cache_key,bytes) VALUES ('total', ? - COALESCE((SELECT bytes FROM community_history_pages WHERE cache_key=?),0)) ON CONFLICT(cache_key) DO UPDATE SET bytes=community_cache_usage.bytes+excluded.bytes",
      args: [bytes, key],
    },
    {
      sql: "INSERT INTO community_history_pages(cache_key,scope_key,raw_json,bytes,last_accessed_at) VALUES (?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET raw_json=excluded.raw_json,bytes=excluded.bytes,last_accessed_at=excluded.last_accessed_at",
      args: [key, scope, json, bytes, Date.now()],
    },
    ...pageReferenceStatements(key, scope, page),
  ];
}

export async function pruneCache(
  database: Database,
  maximum: number,
): Promise<void> {
  let [{ bytes = 0 } = {}] = await database.all<{ bytes: number }>(
    "SELECT bytes FROM community_cache_usage WHERE cache_key='total'",
  );
  while (bytes > maximum) {
    const [events, pages] = await Promise.all([
      database.all<{
        cache_key: string;
        partition_key: string;
        bytes: number;
        last_accessed_at: number;
      }>(
        "SELECT cache_key,partition_key,bytes,last_accessed_at FROM community_events ORDER BY last_accessed_at,cache_key LIMIT 100",
      ),
      database.all<{
        cache_key: string;
        bytes: number;
        last_accessed_at: number;
      }>(
        "SELECT cache_key,bytes,last_accessed_at FROM community_history_pages ORDER BY last_accessed_at,cache_key LIMIT 100",
      ),
    ]);
    const candidates = [
      ...events.map((row) => ({ ...row, kind: "event" as const })),
      ...pages.map((row) => ({ ...row, kind: "page" as const })),
    ]
      .sort(
        (a, b) =>
          a.last_accessed_at - b.last_accessed_at ||
          a.cache_key.localeCompare(b.cache_key),
      )
      .slice(0, 100);
    if (!candidates.length) break;
    const statements: Statement[] = [];
    let estimate = bytes;
    for (const row of candidates) {
      if (row.kind === "page") {
        statements.push(
          {
            sql: "UPDATE community_cache_usage SET bytes=bytes-COALESCE((SELECT bytes FROM community_history_pages WHERE cache_key=?),0) WHERE cache_key='total'",
            args: [row.cache_key],
          },
          {
            sql: "DELETE FROM community_history_page_events WHERE page_key=?",
            args: [row.cache_key],
          },
          {
            sql: "DELETE FROM community_history_pages WHERE cache_key=?",
            args: [row.cache_key],
          },
        );
      } else {
        statements.push(
          ...removeCachedEventStatements(row.cache_key, row.partition_key),
        );
      }
      estimate -= row.bytes;
      if (estimate <= maximum) break;
    }
    await database.batch(statements, "immediate");
    const current = await database.all<{ bytes: number }>(
      "SELECT bytes FROM community_cache_usage WHERE cache_key='total'",
    );
    const next = Number(current[0]?.bytes ?? 0);
    if (next >= bytes)
      throw new Error("Cache eviction did not reduce accounted storage");
    bytes = next;
    if (bytes > maximum)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export function clearCacheStatements(scopeKey?: string): Statement[] {
  if (scopeKey === undefined)
    return [
      "community_history_page_events",
      "community_event_references",
      "community_events",
      "community_history_pages",
      "community_checkpoints",
      "community_cache_usage",
    ].map((table) => ({ sql: `DELETE FROM ${table}` }));
  const prefix = `partition:${scopeKey}:`;
  return [
    {
      sql: "UPDATE community_cache_usage SET bytes=bytes-(SELECT COALESCE(SUM(bytes),0) FROM community_events WHERE scope_key=?)-(SELECT COALESCE(SUM(bytes),0) FROM community_history_pages WHERE scope_key=?) WHERE cache_key='total'",
      args: [scopeKey, scopeKey],
    },
    {
      sql: "DELETE FROM community_cache_usage WHERE cache_key >= ? AND cache_key < ?",
      args: [prefix, `${prefix}\uffff`],
    },
    {
      sql: "DELETE FROM community_history_page_events WHERE page_key IN (SELECT cache_key FROM community_history_pages WHERE scope_key=?)",
      args: [scopeKey],
    },
    {
      sql: "DELETE FROM community_event_references WHERE event_key IN (SELECT cache_key FROM community_events WHERE scope_key=?)",
      args: [scopeKey],
    },
    ...[
      "community_events",
      "community_history_pages",
      "community_checkpoints",
    ].map((table) => ({
      sql: `DELETE FROM ${table} WHERE scope_key=?`,
      args: [scopeKey],
    })),
  ];
}

export function removeCachedEventStatements(
  key: string,
  partition: string,
): Statement[] {
  const affected =
    "SELECT page_key FROM community_history_page_events WHERE event_key=?";
  return [
    {
      sql: `UPDATE community_cache_usage SET bytes=bytes-COALESCE((SELECT SUM(bytes) FROM community_history_pages WHERE cache_key IN (${affected})),0) WHERE cache_key='total'`,
      args: [key],
    },
    {
      sql: `DELETE FROM community_history_pages WHERE cache_key IN (${affected})`,
      args: [key],
    },
    {
      sql: `DELETE FROM community_history_page_events WHERE page_key IN (${affected})`,
      args: [key],
    },
    {
      sql: "UPDATE community_cache_usage SET bytes=bytes-COALESCE((SELECT bytes FROM community_events WHERE cache_key=?),0) WHERE cache_key IN ('total',?)",
      args: [key, `partition:${partition}`],
    },
    {
      sql: "DELETE FROM community_event_references WHERE event_key=?",
      args: [key],
    },
    {
      sql: "DELETE FROM community_events WHERE cache_key=?",
      args: [key],
    },
  ];
}

export function eventReferenceStatements(
  rows: readonly unknown[][],
): Statement[] {
  const references = rows.flatMap((row) => {
    const event = JSON.parse(String(row[9])) as { tags: string[][] };
    return referencedEventIds(event).map((id) => [row[0], `${row[2]}:${id}`]);
  });
  const statements: Statement[] = [];
  for (let offset = 0; offset < references.length; offset += 100) {
    const batch = references.slice(offset, offset + 100);
    statements.push({
      sql: `INSERT OR IGNORE INTO community_event_references(event_key,reference_key) VALUES ${batch.map(() => "(?,?)").join(",")}`,
      args: batch.flat(),
    });
  }
  return statements;
}

export async function initializeEventReferences(
  database: Database,
): Promise<void> {
  await database.exec(`CREATE TABLE IF NOT EXISTS community_event_references(event_key TEXT NOT NULL,reference_key TEXT NOT NULL,PRIMARY KEY(event_key,reference_key));
    CREATE INDEX IF NOT EXISTS community_event_references_reference_idx ON community_event_references(reference_key);`);
  if (
    (
      await database.all(
        "SELECT bytes FROM community_cache_usage WHERE cache_key='meta:references'",
      )
    ).length
  )
    return;
  let after = "";
  for (;;) {
    const rows = await database.all<{
      cache_key: string;
      partition_key: string;
      raw_json: string;
    }>(
      "SELECT cache_key,partition_key,raw_json FROM community_events WHERE cache_key>? ORDER BY cache_key LIMIT 100",
      after,
    );
    if (!rows.length) break;
    const statements = eventReferenceStatements(
      rows.map((row) => [
        row.cache_key,
        null,
        row.partition_key,
        null,
        null,
        null,
        null,
        null,
        null,
        row.raw_json,
      ]),
    );
    if (statements.length) await database.batch(statements, "immediate");
    after = rows.at(-1)!.cache_key;
    if (rows.length < 100) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  await database.batch(
    [
      {
        sql: "INSERT OR REPLACE INTO community_cache_usage(cache_key,bytes) VALUES ('meta:references',1)",
      },
    ],
    "immediate",
  );
}
