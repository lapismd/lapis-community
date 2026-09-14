import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, expect, it, vi } from "vitest";
import type { CommunityHistoryPage, CommunityScope } from "./contracts.js";
import { createTursoCommunityEventStore } from "./turso-event-store.js";
import { historyPageKey } from "./history-pages.js";
import {
  communityCacheScopeKey,
  communityCacheAudienceKey,
} from "./event-store.js";

const connect = vi.hoisted(() => vi.fn());
vi.mock("@tursodatabase/database-wasm/bundle", () => ({ connect }));
afterEach(() => {
  vi.unstubAllGlobals();
  connect.mockReset();
});

function databaseFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const query = vi.fn(async (sql: string, ...args: unknown[]) =>
    sqlite.prepare(sql).all(...(args as SQLInputValue[])),
  );
  let failWrite = false;
  connect.mockResolvedValue({
    exec: async (sql: string) => {
      sqlite.exec(sql);
    },
    all: query,
    batch: async (statements: { sql: string; args?: unknown[] }[]) => {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const statement of statements) {
          sqlite
            .prepare(statement.sql)
            .run(...((statement.args ?? []) as SQLInputValue[]));
          if (failWrite) throw new Error("Simulated disk failure");
        }
        sqlite.exec("COMMIT");
      } catch (cause) {
        sqlite.exec("ROLLBACK");
        throw cause;
      }
    },
    close: async () => {
      sqlite.close();
    },
  });
  vi.stubGlobal("navigator", {
    storage: { getDirectory() {} },
    locks: {
      request: (
        _name: string,
        _options: unknown,
        callback: (lock: object) => Promise<void>,
      ) => callback({}),
    },
  });
  vi.stubGlobal("crossOriginIsolated", true);
  return {
    query,
    sqlite,
    setFailure(value: boolean) {
      failWrite = value;
    },
  };
}
const scope: CommunityScope = {
  id: "sql",
  name: "SQL",
  relayUrl: "wss://relay.test/",
};
const events = Array.from({ length: 7 }, (_, index) =>
  finalizeEvent(
    {
      kind: 9,
      created_at: 100,
      content: `Message ${index}`,
      tags: [["h", "room"]],
    },
    new Uint8Array(32).fill(72),
  ),
).sort((a, b) => a.id.localeCompare(b.id));
const request = {
  groupId: "room",
  collection: "channel-roots" as const,
  limit: 50,
};
const page: CommunityHistoryPage = {
  key: historyPageKey(scope, { type: "public" }, "nip29", request),
  audience: { type: "public" },
  relayUrls: [scope.relayUrl],
  request,
  eventIds: events.map((event) => event.id),
  primaryEventIds: events.map((event) => event.id),
  hasOlder: false,
  synchronizedAt: 200,
};
const batch = {
  scope,
  records: events.map((event) => ({
    event,
    roomId: "room",
    relayUrl: scope.relayUrl,
    audience: { type: "public" as const },
  })),
  historyPages: [page],
};

it("executes indexed history and coverage SQL without restoring message history", async () => {
  const { query } = databaseFixture();
  const store = createTursoCommunityEventStore();
  await store.open();
  try {
    await store.commit(batch);
    query.mockClear();
    const first = await store.readCachedEvents(scope, {
      kinds: [9],
      groupId: "room",
      limit: 3,
    });
    const second = await store.readCachedEvents(scope, {
      kinds: [9],
      groupId: "room",
      limit: 3,
      before: first.olderCursor!,
    });
    expect(first.events).toEqual(events.slice(4));
    expect(second.events).toEqual(events.slice(1, 4));
    expect(first.hasMoreCached).toBe(true);
    expect(query.mock.calls.every(([sql]) => sql.includes("LIMIT ?"))).toBe(
      true,
    );
    const metadata = await store.restoreMetadata(scope);
    expect(metadata.events).toEqual([]);
    expect(metadata.approximateBytes).toBeGreaterThan(0);
    expect((await store.readHistoryPage(scope, page.key))?.page).toEqual(page);
    expect(
      await store.readHistoryPage(
        { ...scope, relayUrl: "wss://elsewhere.test/" },
        page.key,
      ),
    ).toBeUndefined();
  } finally {
    await store.close();
  }
});

it("rolls back events and durable coverage together after a failed write", async () => {
  const fixture = databaseFixture();
  const store = createTursoCommunityEventStore();
  await store.open();
  try {
    fixture.setFailure(true);
    await expect(store.commit(batch)).rejects.toThrow("Simulated disk failure");
    expect(await store.readHistoryPage(scope, page.key)).toBeUndefined();
    expect(
      (
        await store.readCachedEvents(scope, {
          kinds: [9],
          groupId: "room",
          limit: 50,
        })
      ).events,
    ).toEqual([]);
    fixture.setFailure(false);
    await store.commit(batch);
    expect((await store.readHistoryPage(scope, page.key))?.events).toEqual(
      events,
    );
  } finally {
    await store.close();
  }
});

it("retains and indexes legacy SQL messages with no denormalized room identity", async () => {
  const { sqlite } = databaseFixture();
  sqlite.exec(
    `CREATE TABLE community_events (cache_key TEXT PRIMARY KEY, scope_key TEXT NOT NULL, partition_key TEXT NOT NULL, event_id TEXT NOT NULL, relay_url TEXT NOT NULL, room_id TEXT, created_at INTEGER NOT NULL, last_accessed_at INTEGER NOT NULL, bytes INTEGER NOT NULL, raw_json TEXT NOT NULL)`,
  );
  const scopeKey = communityCacheScopeKey(scope);
  const partition = `${scopeKey}:${communityCacheAudienceKey({ type: "public" })}`;
  for (const event of events)
    sqlite
      .prepare(
        "INSERT INTO community_events VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)",
      )
      .run(
        event.id,
        scopeKey,
        partition,
        event.id,
        scope.relayUrl,
        event.created_at,
        100,
        512,
        JSON.stringify(event),
      );
  const store = createTursoCommunityEventStore();
  await store.open();
  try {
    expect(
      (
        await store.readCachedEvents(scope, {
          groupId: "room",
          kinds: [9],
          limit: 50,
        })
      ).events,
    ).toEqual(events);
    expect(await store.readHistoryPage(scope, page.key)).toBeUndefined();
  } finally {
    await store.close();
  }
});

it("accounts for duplicate writes and metadata-only reads without scanning cached byte totals", async () => {
  const fixture = databaseFixture();
  const store = createTursoCommunityEventStore();
  await store.open();
  await store.commit(batch);
  const before = await store.restoreMetadata(scope);
  fixture.query.mockClear();
  await store.commit(batch);
  expect((await store.restoreMetadata(scope)).approximateBytes).toBe(
    before.approximateBytes,
  );
  expect(
    fixture.query.mock.calls.some(([sql]) => sql.includes("SUM(bytes)")),
  ).toBe(false);
  const usage = fixture.sqlite
    .prepare("SELECT bytes FROM community_cache_usage WHERE cache_key='total'")
    .get()!;
  const actual = fixture.sqlite
    .prepare(
      "SELECT (SELECT COALESCE(SUM(bytes),0) FROM community_events)+(SELECT COALESCE(SUM(bytes),0) FROM community_history_pages) AS bytes",
    )
    .get()!;
  expect(usage.bytes).toBe(actual.bytes);
  await store.close();
});

it("rolls back byte accounting when a page write fails and retains existing coverage", async () => {
  const fixture = databaseFixture();
  const store = createTursoCommunityEventStore();
  await store.open();
  await store.commit(batch);
  const before = fixture.sqlite
    .prepare("SELECT bytes FROM community_cache_usage WHERE cache_key='total'")
    .get()!.bytes;
  const added = finalizeEvent(
    {
      kind: 9,
      created_at: 200,
      content: "A failed new page",
      tags: [["h", "room"]],
    },
    new Uint8Array(32).fill(72),
  );
  fixture.setFailure(true);
  await expect(
    store.commit({
      scope,
      records: [
        {
          event: added,
          relayUrl: scope.relayUrl,
          audience: { type: "public" },
        },
      ],
      historyPages: [
        {
          ...page,
          key: "failed",
          eventIds: [added.id],
          primaryEventIds: [added.id],
        },
      ],
    }),
  ).rejects.toThrow("Simulated disk failure");
  fixture.setFailure(false);
  expect(
    fixture.sqlite
      .prepare(
        "SELECT bytes FROM community_cache_usage WHERE cache_key='total'",
      )
      .get()!.bytes,
  ).toBe(before);
  expect(await store.readHistoryPage(scope, page.key)).toBeDefined();
  expect(await store.readHistoryPage(scope, "failed")).toBeUndefined();
  expect(
    (await store.restore(scope)).events.some((event) => event.id === added.id),
  ).toBe(false);
  await store.close();
});

it("coalesces concurrent Turso opens and waits for initialization before closing", async () => {
  databaseFixture();
  const connectDatabase = connect.getMockImplementation()!;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  connect.mockImplementation(async () => {
    await gate;
    return connectDatabase();
  });
  const store = createTursoCommunityEventStore();
  const first = store.open(),
    second = store.open();
  const closed = store.close();
  release();
  await Promise.all([first, second, closed]);
  expect(connect).toHaveBeenCalledTimes(1);
  await expect(store.restoreMetadata(scope)).rejects.toThrow("not open");
});

it("closes a failed Turso candidate and permits a fresh open on retry", async () => {
  const failed = databaseFixture();
  const connection = await connect.getMockImplementation()!();
  connection.exec = async () => {
    throw new Error("Initialization failed");
  };
  const store = createTursoCommunityEventStore();
  await expect(store.open()).rejects.toThrow("Initialization failed");
  expect(() => failed.sqlite.prepare("SELECT 1")).toThrow();
  databaseFixture();
  await store.open();
  await store.commit(batch);
  expect(await store.readHistoryPage(scope, page.key)).toBeDefined();
  await store.close();
});
