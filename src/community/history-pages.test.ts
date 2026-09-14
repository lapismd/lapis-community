import "fake-indexeddb/auto";
import { openDB } from "idb";
import {
  communityCacheScopeKey,
  communityCacheAudienceKey,
} from "./event-store.js";
import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { createIndexedDbCommunityEventStore } from "./indexeddb-event-store.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import { createHistoryScheduler } from "./history-scheduler.js";
import { historyPageKey } from "./history-pages.js";
import type { CommunityHistoryPage, CommunityScope } from "./contracts.js";

const scope: CommunityScope = {
  id: "test",
  name: "Test",
  relayUrl: "wss://relay.test/",
};
const event = finalizeEvent(
  {
    kind: 9,
    created_at: 100,
    content: "A cached message",
    tags: [["h", "general"]],
  },
  new Uint8Array(32).fill(71),
);
const request = {
  groupId: "general",
  collection: "channel-roots" as const,
  limit: 50,
};
const page: CommunityHistoryPage = {
  key: historyPageKey(scope, { type: "public" }, "nip29", request),
  audience: { type: "public" },
  relayUrls: [scope.relayUrl],
  request,
  eventIds: [event.id],
  primaryEventIds: [event.id],
  olderCursor: { createdAt: 100, eventId: event.id },
  hasOlder: true,
  synchronizedAt: 200,
};

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
        ...(maxBytes === undefined ? {} : { maxBytes }),
        databaseName: `history-${crypto.randomUUID()}`,
      }),
  ],
] as const)
  describe(`${name} indexed history pages`, () => {
    it("commits coverage with its events and restores an exact bounded page without a scope replay", async () => {
      const store = create();
      await store.open();
      await store.commit({
        scope,
        records: [
          { event, relayUrl: scope.relayUrl, audience: { type: "public" } },
        ],
        historyPages: [page],
      });
      const restore = vi.spyOn(store, "restore");
      expect(await store.readHistoryPage!(scope, page.key)).toEqual({
        page,
        events: [event],
      });
      expect(restore).not.toHaveBeenCalled();
      expect(
        await store.readHistoryPage!(
          { ...scope, relayUrl: "wss://other.test/" },
          page.key,
        ),
      ).toBeUndefined();
      await store.close();
      await store.open();
      expect(
        (await store.readHistoryPage!(scope, page.key))?.page.hasOlder,
      ).toBe(true);
      await store.clear(scope);
      expect(await store.readHistoryPage!(scope, page.key)).toBeUndefined();
      await store.close();
    });

    it("invalidates page coverage when cache eviction removes its events", async () => {
      const store = create(1400);
      await store.open();
      const records = Array.from({ length: 5 }, (_, index) => ({
        event: finalizeEvent(
          {
            kind: 9,
            created_at: 101 + index,
            content: "x".repeat(600),
            tags: [["h", "general"]],
          },
          new Uint8Array(32).fill(71),
        ),
        relayUrl: scope.relayUrl,
        audience: { type: "public" as const },
      }));
      await store.commit({
        scope,
        records: [
          { event, relayUrl: scope.relayUrl, audience: { type: "public" } },
        ],
        historyPages: [page],
      });
      expect(await store.readHistoryPage!(scope, page.key)).toBeDefined();
      await store.commit({ scope, records });
      expect(await store.readHistoryPage!(scope, page.key)).toBeUndefined();
      expect(
        (await store.syncPlan(scope)).checkpoints.every(
          (checkpoint) => checkpoint.complete !== true,
        ),
      ).toBe(true);
      await store.close();
    });

    it("does not treat a legacy checkpoint or missing event as complete coverage", async () => {
      const store = create();
      await store.open();
      await store.commit({
        scope,
        records: [],
        checkpoints: [
          {
            relayUrl: scope.relayUrl,
            stream: "content",
            createdAt: 100,
            synchronizedAt: 200,
            complete: true,
          },
        ],
        historyPages: [page],
      });
      expect(await store.readHistoryPage!(scope, page.key)).toBeUndefined();
      const empty = {
        ...page,
        key: "empty",
        eventIds: [],
        primaryEventIds: [],
        hasOlder: false,
      };
      await store.commit({ scope, records: [], historyPages: [empty] });
      expect(
        (await store.readHistoryPage!(scope, "empty"))?.page.hasOlder,
      ).toBe(false);
      await store.close();
    });

    it("searches older cached public history without replaying it into the active graph", async () => {
      const store = create();
      await store.open();
      const secret = finalizeEvent(
        {
          kind: 9,
          created_at: 120,
          content: "A cached private message",
          tags: [["h", "secret"]],
        },
        new Uint8Array(32).fill(71),
      );
      await store.commit({
        scope,
        records: [
          { event, relayUrl: scope.relayUrl, audience: { type: "public" } },
          {
            event: secret,
            relayUrl: scope.relayUrl,
            audience: { type: "inbox", pubkey: secret.pubkey },
          },
        ],
      });
      const runtime = createInlineCommunityEventRuntime({ store });
      expect(
        (await runtime.restore([scope], 1, { metadataOnly: true }))
          .acceptedEventsByScope?.[scope.id],
      ).toEqual([]);
      const results = await runtime.search({
        generation: 1,
        scopeId: scope.id,
        query: "cached",
      });
      expect(results.map((result) => result.event.id)).toEqual([event.id]);
      expect(
        (await runtime.restore([scope], 1, { metadataOnly: true }))
          .acceptedEventsByScope?.[scope.id],
      ).toEqual([]);
      runtime.dispose();
    });

    it("restores metadata without message replay and pages equal timestamps independently", async () => {
      const store = create();
      await store.open();
      const profile = finalizeEvent(
        { kind: 0, created_at: 100, content: '{"name":"Reader"}', tags: [] },
        new Uint8Array(32).fill(71),
      );
      const messages = [
        event,
        ...Array.from({ length: 5 }, (_, index) =>
          finalizeEvent(
            {
              kind: 9,
              created_at: 100,
              content: `Equal time ${index}`,
              tags: [["h", "general"]],
            },
            new Uint8Array(32).fill(71),
          ),
        ),
      ];
      await store.commit({
        scope,
        records: [profile, ...messages].map((event) => ({
          event,
          relayUrl: scope.relayUrl,
          audience: { type: "public" as const },
        })),
      });
      expect((await store.restoreMetadata!(scope)).events).toEqual([profile]);
      const first = await store.readCachedEvents!(scope, {
        kinds: [9],
        groupId: "general",
        limit: 3,
      });
      const second = await store.readCachedEvents!(scope, {
        kinds: [9],
        groupId: "general",
        limit: 3,
        before: first.olderCursor!,
      });
      expect(first.hasMoreCached).toBe(true);
      expect(second.hasMoreCached).toBe(false);
      expect(
        new Set([...first.events, ...second.events].map((event) => event.id))
          .size,
      ).toBe(6);
      await store.close();
    });
  });

it("does not acknowledge durable coverage when event persistence fails", async () => {
  const store = createMemoryCommunityEventStore();
  const runtime = createInlineCommunityEventRuntime({ store });
  vi.spyOn(store, "commit").mockRejectedValueOnce(new Error("Disk full"));
  await expect(
    runtime.ingest({
      scope,
      generation: 1,
      relayUrl: scope.relayUrl,
      events: [event],
      historyPages: [page],
    }),
  ).rejects.toThrow("Disk full");
  expect(await runtime.readHistoryPage!(scope, page.key)).toBeUndefined();
  await runtime.ingest({
    scope,
    generation: 1,
    relayUrl: scope.relayUrl,
    events: [event],
    historyPages: [page],
  });
  expect((await runtime.readHistoryPage!(scope, page.key))?.events).toEqual([
    event,
  ]);
  runtime.dispose();
});

it("shares one load per conversation and admits at most two logical loads", async () => {
  const scheduler = createHistoryScheduler();
  const releases: (() => void)[] = [];
  const started: string[] = [];
  const run = (key: string, visible = true) =>
    scheduler.run(
      key,
      async () => {
        started.push(key);
        await new Promise<void>((resolve) => releases.push(resolve));
      },
      visible,
    );
  const a = run("a");
  expect(run("a")).toBe(a);
  const b = run("b"),
    hidden = run("hidden", false),
    selected = run("selected");
  await Promise.resolve();
  expect(started).toEqual(["a", "b"]);
  releases.shift()!();
  await a;
  await vi.waitFor(() => expect(started).toEqual(["a", "b", "selected"]));
  releases.shift()!();
  await b;
  await vi.waitFor(() =>
    expect(started).toEqual(["a", "b", "selected", "hidden"]),
  );
  releases.splice(0).forEach((release) => release());
  await Promise.all([hidden, selected]);
});

it("migrates version-four caches additively and indexes legacy rows without room fields", async () => {
  const databaseName = `legacy-history-${crypto.randomUUID()}`;
  const scopeKey = communityCacheScopeKey(scope);
  const partitionKey = `${scopeKey}:${communityCacheAudienceKey({ type: "public" })}`;
  const legacy = await openDB(databaseName, 4, {
    upgrade(database) {
      const rows = database.createObjectStore("events", { keyPath: "key" });
      rows.createIndex("scope", "scopeKey");
      rows.createIndex("partition", "partitionKey");
      rows.createIndex("access", "lastAccessedAt");
      database
        .createObjectStore("checkpoints", { keyPath: "key" })
        .createIndex("scope", "scopeKey");
      database.createObjectStore("agentIdentities");
    },
  });
  await legacy.put("events", {
    key: `${partitionKey}:${event.id}`,
    scopeKey,
    partitionKey,
    eventId: event.id,
    event,
    relayUrl: scope.relayUrl,
    createdAt: event.created_at,
    lastAccessedAt: 100,
    bytes: 512,
  });
  await legacy.put(
    "agentIdentities",
    { label: "Existing agent identity" },
    "retained",
  );
  legacy.close();
  const store = createIndexedDbCommunityEventStore({ databaseName });
  await store.open();
  try {
    expect(
      (
        await store.readCachedEvents(scope, {
          groupId: "general",
          kinds: [9],
          limit: 50,
        })
      ).events,
    ).toEqual([event]);
    expect(await store.readHistoryPage(scope, page.key)).toBeUndefined();
    const upgraded = await openDB(databaseName);
    expect(upgraded.version).toBe(5);
    expect(await upgraded.get("agentIdentities", "retained")).toEqual({
      label: "Existing agent identity",
    });
    upgraded.close();
  } finally {
    await store.close();
  }
});
