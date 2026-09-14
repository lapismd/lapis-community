import "fake-indexeddb/auto";
import { openDB } from "idb";
import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CacheAccessOrder } from "./cache-access-order.js";
import {
  createMemoryCommunityEventStore,
  communityCacheScopeKey,
  communityEventBytes,
} from "./event-store.js";
import { createIndexedDbCommunityEventStore } from "./indexeddb-event-store.js";
import type { CommunityHistoryPage, CommunityScope } from "./contracts.js";

const scope: CommunityScope = {
  id: "usage",
  name: "Usage",
  relayUrl: "wss://relay.test/",
};
const key = new Uint8Array(32).fill(74);
const record = (index: number, content = "A cached message") => ({
  event: finalizeEvent(
    { kind: 9, created_at: 100 + index, content, tags: [["h", "room"]] },
    key,
  ),
  relayUrl: scope.relayUrl,
  audience: { type: "public" as const },
  lastAccessedAt: index,
});
const first = record(1),
  second = record(2),
  third = record(3);
const head = (key: string, id: string): CommunityHistoryPage => ({
  key,
  audience: { type: "public" },
  relayUrls: [scope.relayUrl],
  request: { collection: "channel-roots", groupId: "room", limit: 50 },
  eventIds: [id],
  primaryEventIds: [id],
  hasOlder: false,
  synchronizedAt: 200,
});
const pageBytes = (page: CommunityHistoryPage) =>
  new TextEncoder().encode(JSON.stringify(page)).byteLength;
afterEach(() => vi.restoreAllMocks());

for (const [name, create] of [
  [
    "memory",
    (maxBytes?: number) =>
      createMemoryCommunityEventStore(
        maxBytes === undefined ? {} : { maxBytes },
      ),
  ],
  [
    "IndexedDB",
    (maxBytes?: number) =>
      createIndexedDbCommunityEventStore({
        databaseName: `accounting-${crypto.randomUUID()}`,
        ...(maxBytes === undefined ? {} : { maxBytes }),
      }),
  ],
] as const)
  describe(`${name} cache accounting`, () => {
    it("reports all partition bytes while restoring metadata only and preserves duplicate touches", async () => {
      const maximum = communityEventBytes(first) + communityEventBytes(second);
      const store = create(maximum);
      await store.open();
      await store.commit({ scope, records: [first, second] });
      expect(await store.restoreMetadata!(scope)).toMatchObject({
        events: [],
        approximateBytes: maximum,
      });
      await store.commit({
        scope,
        records: [{ ...first, lastAccessedAt: 10 }, first],
      });
      expect((await store.restoreMetadata!(scope)).approximateBytes).toBe(
        maximum,
      );
      await store.commit({ scope, records: [third] });
      expect(
        (await store.restore(scope)).events.map((event) => event.id),
      ).toEqual([first.event.id, third.event.id]);
      await store.close();
      await store.open();
      expect((await store.restoreMetadata!(scope)).approximateBytes).toBe(
        maximum,
      );
      await store.close();
    });

    it("evicts only dependent coverage and keeps unrelated cached pages usable", async () => {
      const firstPage = head("first", first.event.id),
        secondPage = head("second", second.event.id);
      const large = record(3, "x".repeat(3500));
      const budget =
        communityEventBytes(second) +
        pageBytes(secondPage) +
        communityEventBytes(large) +
        1;
      const store = create(budget);
      await store.open();
      await store.commit({
        scope,
        records: [first, second],
        historyPages: [firstPage, secondPage],
      });
      await store.commit({ scope, records: [large] });
      expect(
        await store.readHistoryPage!(scope, firstPage.key),
      ).toBeUndefined();
      expect(
        (await store.readHistoryPage!(scope, secondPage.key))?.events.map(
          (event) => event.id,
        ),
      ).toEqual([second.event.id]);
      expect(
        (await store.restore(scope)).events.map((event) => event.id),
      ).toEqual([second.event.id, large.event.id]);
      await store.close();
    });

    it("clears one scope without corrupting the remaining scope's budget", async () => {
      const other = { ...scope, id: "other" };
      const bytes = communityEventBytes(first);
      const store = create(bytes * 2);
      await store.open();
      await store.commit({ scope, records: [first] });
      await store.commit({ scope: other, records: [first] });
      await store.clear(scope);
      expect((await store.restoreMetadata!(scope)).approximateBytes).toBe(0);
      expect((await store.restoreMetadata!(other)).approximateBytes).toBe(
        bytes,
      );
      await store.commit({ scope: other, records: [second] });
      expect((await store.restore(other)).events).toHaveLength(2);
      await store.clear();
      expect((await store.restoreMetadata!(other)).approximateBytes).toBe(0);
      await store.close();
    });

    it("bounds empty coverage pages even when there are no events to evict", async () => {
      const budget = 1000,
        store = create(budget);
      await store.open();
      const pages = Array.from({ length: 40 }, (_, index) => ({
        ...head(`empty-${index}`, first.event.id),
        eventIds: [],
        primaryEventIds: [],
      }));
      await store.commit({ scope, records: [], historyPages: pages });
      const retained = (
        await Promise.all(
          pages.map((page) => store.readHistoryPage!(scope, page.key)),
        )
      ).filter((page) => page !== undefined);
      expect(retained.length).toBeGreaterThan(0);
      expect(
        retained.reduce((sum, value) => sum + pageBytes(value!.page), 0),
      ).toBeLessThanOrEqual(budget);
      await store.close();
    });
  });

it("IndexedDB under-budget writes do not scan cached event payloads", async () => {
  const store = createIndexedDbCommunityEventStore({
    databaseName: `bounded-${crypto.randomUUID()}`,
  });
  await store.open();
  await store.commit({
    scope,
    records: Array.from({ length: 200 }, (_, index) => record(index)),
  });
  const indexReads = vi.spyOn(IDBIndex.prototype, "getAll");
  const storeReads = vi.spyOn(IDBObjectStore.prototype, "getAll");
  await store.commit({ scope, records: [record(201)] });
  expect(
    indexReads.mock.contexts.filter(
      (index) =>
        index instanceof IDBIndex && index.objectStore.name === "events",
    ),
  ).toHaveLength(0);
  expect(
    storeReads.mock.contexts.filter(
      (store) => store instanceof IDBObjectStore && store.name === "events",
    ),
  ).toHaveLength(0);
  await store.close();
});

it("IndexedDB failed writes roll back events, coverage and byte accounting together", async () => {
  const store = createIndexedDbCommunityEventStore({
    databaseName: `abort-${crypto.randomUUID()}`,
  });
  await store.open();
  const oldPage = head("old", first.event.id);
  await store.commit({ scope, records: [first], historyPages: [oldPage] });
  const original = IDBObjectStore.prototype.put;
  const put = vi
    .spyOn(IDBObjectStore.prototype, "put")
    .mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === "historyPages")
        throw new DOMException("Simulated disk failure", "QuotaExceededError");
      return original.apply(this, args);
    });
  await expect(
    store.commit({
      scope,
      records: [second],
      historyPages: [head("new", second.event.id)],
    }),
  ).rejects.toThrow("Simulated disk failure");
  put.mockRestore();
  expect((await store.restore(scope)).events.map((event) => event.id)).toEqual([
    first.event.id,
  ]);
  expect((await store.restoreMetadata!(scope)).approximateBytes).toBe(
    communityEventBytes(first),
  );
  expect(await store.readHistoryPage!(scope, "old")).toBeDefined();
  expect(await store.readHistoryPage!(scope, "new")).toBeUndefined();
  await store.commit({ scope, records: [second] });
  expect((await store.restoreMetadata!(scope)).approximateBytes).toBe(
    communityEventBytes(first) + communityEventBytes(second),
  );
  await store.close();
});

it("IndexedDB v5 migration retains cached pages and agent records while initializing accounting", async () => {
  const databaseName = `migration-usage-${crypto.randomUUID()}`;
  const legacy = await openDB(databaseName, 5, {
    upgrade(db) {
      const events = db.createObjectStore("events", { keyPath: "key" });
      for (const [name, path] of [
        ["scope", "scopeKey"],
        ["partition", "partitionKey"],
        ["access", "lastAccessedAt"],
      ])
        events.createIndex(name!, path!);
      events.createIndex("chronological", [
        "partitionKey",
        "event.kind",
        "createdAt",
        "eventId",
      ]);
      events.createIndex("roomChronological", [
        "partitionKey",
        "roomId",
        "event.kind",
        "createdAt",
        "eventId",
      ]);
      db.createObjectStore("checkpoints", { keyPath: "key" }).createIndex(
        "scope",
        "scopeKey",
      );
      db.createObjectStore("historyPages", { keyPath: "key" }).createIndex(
        "scope",
        "scopeKey",
      );
      db.createObjectStore("agentIdentities", { keyPath: "key" });
    },
  });
  const scopeKey = communityCacheScopeKey(scope),
    partitionKey = `${scopeKey}:public`,
    page = head("legacy", first.event.id);
  await legacy.put("events", {
    key: `${partitionKey}:${first.event.id}`,
    scopeKey,
    partitionKey,
    eventId: first.event.id,
    event: first.event,
    relayUrl: scope.relayUrl,
    roomId: "room",
    createdAt: 101,
    lastAccessedAt: 1,
    bytes: communityEventBytes(first),
  });
  await legacy.put("historyPages", {
    key: `${scopeKey}:${page.key}`,
    scopeKey,
    page,
    bytes: pageBytes(page),
  });
  await legacy.put("agentIdentities", {
    key: "retained",
    value: "agent configuration",
  });
  legacy.close();
  const store = createIndexedDbCommunityEventStore({ databaseName });
  await Promise.all([store.open(), store.open()]);
  expect((await store.restoreMetadata!(scope)).approximateBytes).toBe(
    communityEventBytes(first),
  );
  expect(
    (await store.readHistoryPage!(scope, "legacy"))?.events.map(
      (event) => event.id,
    ),
  ).toEqual([first.event.id]);
  await store.close();
  const migrated = await openDB(databaseName);
  expect(migrated.version).toBe(6);
  expect((await migrated.get("agentIdentities", "retained")).value).toBe(
    "agent configuration",
  );
  expect((await migrated.get("cacheUsage", "total")).bytes).toBe(
    communityEventBytes(first) + pageBytes(page),
  );
  migrated.close();
});

it("cache access ordering remains correct through repeated touches and removals", () => {
  const queue = new CacheAccessOrder(),
    reference = new Map<string, number>();
  let seed = 73;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let index = 0; index < 1000; index++) {
    const key = `event:${random() % 100}`;
    if (random() % 4 === 0) {
      queue.delete(key);
      reference.delete(key);
    } else {
      const time = random() % 100;
      queue.touch(key, time);
      reference.set(key, time);
    }
    const first = [...reference].sort(
      (a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1),
    )[0]?.[0];
    expect(queue.oldest).toBe(first);
  }
});
