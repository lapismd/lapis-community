import "fake-indexeddb/auto";
import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { createBrowserCommunityEventStore } from "./browser-event-store.js";
import { createIndexedDbCommunityEventStore } from "./indexeddb-event-store.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import { copyNostrEvent } from "./verified-events.js";
import type { CommunityScope, CommunityHistoryPage } from "./contracts.js";
const scope: CommunityScope = {
  id: "private",
  name: "Private",
  relayUrl: "wss://relay.test/",
};
const key = new Uint8Array(32).fill(42);
const event = (content: string, tags: string[][], kind = 9, created_at = 100) =>
  finalizeEvent({ kind, content, tags, created_at }, key);
const metadata = event("", [["d", "secret"], ["private"]], 39000);
const publicMessage = event("Public retained", [["h", "general"]]);
const record = (event: ReturnType<typeof finalizeEvent>) => ({
  event,
  relayUrl: scope.relayUrl,
  audience: { type: "public" as const },
});
const head = (key: string, id: string): CommunityHistoryPage => ({
  key,
  audience: { type: "public" },
  relayUrls: [scope.relayUrl],
  request: { collection: "channel-roots", groupId: "general", limit: 50 },
  eventIds: [id],
  primaryEventIds: [id],
  hasOlder: false,
  synchronizedAt: 200,
});

for (const [name, create] of [
  [
    "browser fallback",
    () =>
      createBrowserCommunityEventStore({
        databaseName: `privacy-browser-${crypto.randomUUID()}`,
      }),
  ],
  ["memory", () => createMemoryCommunityEventStore()],
  [
    "IndexedDB",
    () =>
      createIndexedDbCommunityEventStore({
        databaseName: `privacy-${crypto.randomUUID()}`,
      }),
  ],
] as const) {
  describe(`${name} incremental private cache`, () => {
    it("does not restore or clear public history for ordinary private arrivals or duplicate replay", async () => {
      const store = create(),
        runtime = createInlineCommunityEventRuntime({ store });
      await runtime.restore([scope], 0, { metadataOnly: true });
      await runtime.ingest({
        generation: 0,
        scope,
        relayUrl: scope.relayUrl,
        events: [metadata],
        persist: false,
      });
      await runtime.readCachedEvents!(scope, { kinds: [9], limit: 50 });
      const restore = vi.spyOn(store, "restore"),
        clear = vi.spyOn(store, "clear");
      const messages = Array.from({ length: 120 }, (_, index) =>
        event(`Private ${index}`, [["h", "secret"]], 9, 101 + index),
      );
      for (const messagesBatch of [
        messages.slice(0, 100),
        messages.slice(100),
        messages,
      ])
        await runtime.ingest({
          generation: 0,
          scope,
          relayUrl: scope.relayUrl,
          events: messagesBatch,
          persist: false,
        });
      await runtime.readCachedEvents!(scope, { kinds: [9], limit: 50 });
      expect(restore).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(await runtime.search({ generation: 0, query: "Private" })).toEqual(
        [],
      );
      runtime.dispose();
    });
    it("purges unloaded private descendants while preserving unrelated page coverage", async () => {
      const store = create();
      await store.open();
      const root = event("Hidden root", [["h", "secret"]]);
      const reply = event("Hidden reply", [["e", root.id]]);
      const reaction = event("+", [["e", reply.id]], 7);
      const page = head("public", publicMessage.id),
        unsafe = head("private", root.id);
      await store.commit({
        scope,
        records: [root, reply, reaction, publicMessage].map(record),
        historyPages: [page, unsafe],
      });
      const runtime = createInlineCommunityEventRuntime({ store });
      await runtime.restore([scope], 0, { metadataOnly: true });
      await runtime.ingest({
        generation: 0,
        scope,
        relayUrl: scope.relayUrl,
        events: [metadata],
        persist: false,
      });
      expect(await runtime.search({ generation: 0, query: "Hidden" })).toEqual(
        [],
      );
      expect(
        (await store.restore(scope)).events.map((event) => event.id),
      ).toEqual([publicMessage.id]);
      expect((await store.readHistoryPage!(scope, "public"))?.page).toEqual(
        page,
      );
      expect(await store.readHistoryPage!(scope, "private")).toBeUndefined();
      runtime.dispose();
    });
    it("finds orphaned cached replies when their private parent arrives later", async () => {
      const store = create();
      await store.open();
      const root = event("Private parent", [["h", "secret"]]);
      const orphan = event("Orphan secret", [["E", root.id]], 1111);
      await store.commit({
        scope,
        records: [record(orphan), record(publicMessage)],
      });
      const runtime = createInlineCommunityEventRuntime({ store });
      await runtime.restore([scope], 0, { metadataOnly: true });
      await runtime.ingest({
        generation: 0,
        scope,
        relayUrl: scope.relayUrl,
        events: [metadata],
        persist: false,
      });
      // The private channel metadata alone cannot resolve an orphan's missing parent.
      await runtime.readCachedEvents!(scope, { kinds: [9], limit: 1 });
      expect((await store.restore(scope)).events).toHaveLength(2);
      await runtime.ingest({
        generation: 0,
        scope,
        relayUrl: scope.relayUrl,
        events: [root],
        persist: false,
      });
      expect(await runtime.search({ generation: 0, query: "Orphan" })).toEqual(
        [],
      );
      expect(
        (await store.restore(scope)).events.map((event) => event.id),
      ).toEqual([publicMessage.id]);
      runtime.dispose();
    });
    it("keeps failed privacy purges quarantined across read, search and identity reset", async () => {
      const store = create();
      await store.open();
      const secret = event("Private stored", [["h", "secret"]]);
      await store.commit({
        scope,
        records: [record(secret), record(publicMessage)],
      });
      const runtime = createInlineCommunityEventRuntime({ store });
      await runtime.restore([scope], 0, { metadataOnly: true });
      const remove = vi
        .spyOn(store, "removePublicEvents")
        .mockRejectedValue(new Error("Disk failure"));
      await runtime.ingest({
        generation: 0,
        scope,
        relayUrl: scope.relayUrl,
        events: [metadata],
        persist: false,
      });
      await expect(
        runtime.readCachedEvents!(scope, { kinds: [9], limit: 50 }),
      ).rejects.toThrow("Disk failure");
      expect(
        await runtime.search({ generation: 0, query: "Private stored" }),
      ).toEqual([]);
      await runtime.clearPrivate!();
      remove.mockRestore();
      await runtime.restore([scope], 1, { metadataOnly: true });
      expect((await store.restore(scope)).events).toEqual([]);
      runtime.dispose();
    });
    it("indexes reference existence by scope and removes dependency coverage without touching inbox partitions", async () => {
      const store = create();
      await store.open();
      const parent = event("parent", []),
        child = event("child", [["e", parent.id]]);
      const page = head("child", child.id);
      await store.commit({
        scope,
        records: [
          record(child),
          { ...record(child), audience: { type: "inbox", pubkey: "owner" } },
        ],
        historyPages: [page],
      });
      expect(await store.hasPublicEventReferences!(scope, [parent.id])).toBe(
        true,
      );
      expect(
        await store.hasPublicEventReferences!({ ...scope, id: "other" }, [
          parent.id,
        ]),
      ).toBe(false);
      await store.removePublicEvents!(scope, [child.id]);
      expect(await store.hasPublicEventReferences!(scope, [parent.id])).toBe(
        false,
      );
      expect(await store.readHistoryPage!(scope, "child")).toBeUndefined();
      expect((await store.restoreMetadata!(scope)).approximateBytes).toBe(0);
      expect(
        (await store.restore(scope, { type: "inbox", pubkey: "owner" })).events,
      ).toHaveLength(1);
      await store.close();
    });
  });
}
it("rejects unverified private metadata before changing cached visibility", async () => {
  const store = createMemoryCommunityEventStore(),
    runtime = createInlineCommunityEventRuntime({ store });
  await runtime.restore([scope]);
  await runtime.ingest({
    generation: 0,
    scope,
    relayUrl: scope.relayUrl,
    events: [publicMessage],
  });
  const invalid = copyNostrEvent(metadata);
  invalid.sig = "0".repeat(128);
  const restore = vi.spyOn(store, "restore");
  await runtime.ingest({
    generation: 0,
    scope,
    relayUrl: scope.relayUrl,
    events: [invalid],
    persist: false,
  });
  await runtime.readCachedEvents!(scope, { kinds: [9], limit: 50 });
  expect(restore).not.toHaveBeenCalled();
  expect((await store.restore(scope)).events.map((event) => event.id)).toEqual([
    publicMessage.id,
  ]);
  runtime.dispose();
});
it("preserves the fallback for existing custom stores without indexed invalidation", async () => {
  const store = createMemoryCommunityEventStore();
  delete store.hasPublicEventReferences;
  delete store.removePublicEvents;
  const runtime = createInlineCommunityEventRuntime({ store });
  await runtime.restore([scope]);
  const root = event("Secret", [["h", "secret"]]);
  await runtime.ingest({
    generation: 0,
    scope,
    relayUrl: scope.relayUrl,
    events: [root, publicMessage],
  });
  await runtime.ingest({
    generation: 0,
    scope,
    relayUrl: scope.relayUrl,
    events: [metadata],
    persist: false,
  });
  expect(await runtime.search({ generation: 0, query: "Secret" })).toEqual([]);
  expect((await store.restore(scope)).events.map((event) => event.id)).toEqual([
    publicMessage.id,
  ]);
  runtime.dispose();
});

it("backfills references in an IndexedDB v6 cache without discarding records", async () => {
  const { openDB } = await import("idb");
  const { communityCacheScopeKey, communityEventBytes } = await import(
    "./event-store.js"
  );
  const databaseName = `legacy-privacy-${crypto.randomUUID()}`;
  const old = await openDB(databaseName, 6, {
    upgrade(db) {
      const events = db.createObjectStore("events", { keyPath: "key" });
      events.createIndex("scope", "scopeKey");
      events.createIndex("partition", "partitionKey");
      events.createIndex("access", "lastAccessedAt");
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
      db.createObjectStore("cacheUsage", { keyPath: "key" });
      db.createObjectStore("checkpoints", { keyPath: "key" }).createIndex(
        "scope",
        "scopeKey",
      );
      const pages = db.createObjectStore("historyPages", { keyPath: "key" });
      pages.createIndex("scope", "scopeKey");
      pages.createIndex("access", "lastAccessedAt");
      pages.createIndex("eventKeys", "eventKeys", { multiEntry: true });
    },
  });
  const root = event("root", []),
    child = event("reply", [["E", root.id]], 1111),
    scopeKey = communityCacheScopeKey(scope),
    partitionKey = `${scopeKey}:public`,
    bytes = communityEventBytes(record(child));
  await old.put("events", {
    key: `${partitionKey}:${child.id}`,
    scopeKey,
    partitionKey,
    eventId: child.id,
    event: child,
    relayUrl: scope.relayUrl,
    createdAt: child.created_at,
    lastAccessedAt: 100,
    bytes,
  });
  await old.put("cacheUsage", { key: "total", bytes });
  await old.put("cacheUsage", { key: `partition:${partitionKey}`, bytes });
  await old.close();
  const store = createIndexedDbCommunityEventStore({ databaseName });
  await store.open();
  expect(await store.hasPublicEventReferences(scope, [root.id])).toBe(true);
  expect((await store.restore(scope)).events.map((event) => event.id)).toEqual([
    child.id,
  ]);
  await store.removePublicEvents(scope, [child.id]);
  expect(await store.hasPublicEventReferences(scope, [root.id])).toBe(false);
  expect((await store.restoreMetadata(scope)).approximateBytes).toBe(0);
  await store.close();
});

it("retries a failed legacy privacy purge before returning any cached restoration", async () => {
  const store = createMemoryCommunityEventStore();
  await store.open();
  const secret = event("Legacy secret", [["h", "secret"]]);
  await store.commit({ scope, records: [record(metadata), record(secret)] });
  const runtime = createInlineCommunityEventRuntime({ store });
  const remove = vi
    .spyOn(store, "removePublicEvents")
    .mockRejectedValue(new Error("Read-only storage"));
  await expect(
    runtime.restore([scope], 0, { metadataOnly: true }),
  ).rejects.toThrow("Read-only storage");
  await expect(
    runtime.restore([scope], 0, { metadataOnly: true }),
  ).rejects.toThrow("Read-only storage");
  expect(
    await runtime.search({ generation: 0, query: "Legacy secret" }),
  ).toEqual([]);
  remove.mockRestore();
  const restored = await runtime.restore([scope], 0, { metadataOnly: true });
  expect(restored.acceptedEventsByScope?.[scope.id] ?? []).toEqual([]);
  expect((await store.restore(scope)).events).toEqual([]);
  runtime.dispose();
});
