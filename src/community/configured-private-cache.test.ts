import "fake-indexeddb/auto";
import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { createIndexedDbCommunityEventStore } from "./indexeddb-event-store.js";
import { createBrowserCommunityEventStore } from "./browser-event-store.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import type { CommunityScope, CommunityHistoryPage } from "./contracts.js";
const publicScope: CommunityScope = {
  id: "configured",
  name: "Configured",
  relayUrl: "wss://relay.test",
};
const privateScope: CommunityScope = {
  ...publicScope,
  rooms: [
    {
      id: "secret",
      groupId: "secret",
      name: "Secret",
      kind: "channel",
      private: true,
    },
  ],
};
const key = new Uint8Array(32).fill(43);
const event = (content: string, tags: string[][], kind = 9) =>
  finalizeEvent({ kind, content, tags, created_at: 100 }, key);
const root = event("Secret cached root", [["h", "secret"]]);
const reply = event("Secret cached reply", [["E", root.id]], 1111);
const visible = event("Public retained", [["h", "general"]]);
const record = (event: ReturnType<typeof finalizeEvent>) => ({
  event,
  relayUrl: publicScope.relayUrl,
  audience: { type: "public" as const },
});
const page: CommunityHistoryPage = {
  key: "public",
  audience: { type: "public" },
  relayUrls: [publicScope.relayUrl],
  request: { collection: "channel-roots", groupId: "general", limit: 50 },
  eventIds: [visible.id],
  primaryEventIds: [visible.id],
  hasOlder: false,
  synchronizedAt: 200,
};
for (const [name, create] of [
  ["memory", () => createMemoryCommunityEventStore()],
  [
    "IndexedDB",
    () =>
      createIndexedDbCommunityEventStore({
        databaseName: `configured-${crypto.randomUUID()}`,
      }),
  ],
  [
    "browser",
    () =>
      createBrowserCommunityEventStore({
        databaseName: `configured-browser-${crypto.randomUUID()}`,
      }),
  ],
] as const) {
  describe(`${name} configured private cache`, () => {
    it("purges an unmounted private conversation before metadata-only restore and search", async () => {
      const store = create();
      await store.open();
      await store.commit({
        scope: publicScope,
        records: [reply, visible, root].map(record),
        historyPages: [page],
      });
      const runtime = createInlineCommunityEventRuntime({ store });
      const restored = await runtime.restore([privateScope], 0, {
        metadataOnly: true,
      });
      expect(restored.acceptedEventsByScope?.[privateScope.id] ?? []).toEqual(
        [],
      );
      expect(await runtime.search({ generation: 0, query: "Secret" })).toEqual(
        [],
      );
      expect(
        (
          await runtime.readCachedEvents!(privateScope, {
            kinds: [9, 1111],
            limit: 50,
          })
        ).events.map((event) => event.id),
      ).toEqual([visible.id]);
      expect(
        (await runtime.readHistoryPage!(privateScope, "public"))?.page,
      ).toEqual(page);
      const restore = vi.spyOn(store, "restore");
      await runtime.restore([privateScope], 0, { metadataOnly: true });
      expect(
        restore.mock.calls.every(
          (args: readonly unknown[]) => args[2] === true,
        ),
      ).toBe(true);
      restore.mockClear();
      await runtime.ingest({
        generation: 0,
        scope: privateScope,
        relayUrl: privateScope.relayUrl,
        events: [root, reply],
      });
      await runtime.readCachedEvents!(privateScope, { kinds: [9], limit: 50 });
      expect(restore).not.toHaveBeenCalled();
      runtime.dispose();
    });
    it("enforces configured access when indexed reads precede runtime restoration", async () => {
      const store = create();
      await store.open();
      const privatePage = {
        ...page,
        key: "private",
        eventIds: [root.id],
        primaryEventIds: [root.id],
      };
      await store.commit({
        scope: publicScope,
        records: [root, reply, visible].map(record),
        historyPages: [page, privatePage],
      });
      const runtime = createInlineCommunityEventRuntime({ store });
      const [cached, history] = await Promise.all([
        runtime.readCachedEvents!(privateScope, {
          kinds: [9, 1111],
          limit: 50,
        }),
        runtime.readHistoryPage!(privateScope, "private"),
      ]);
      expect(cached.events.map((event) => event.id)).toEqual([visible.id]);
      expect(history).toBeUndefined();
      expect(
        (await runtime.readHistoryPage!(privateScope, "public"))?.page,
      ).toEqual(page);
      runtime.dispose();
    });
    it("applies a configuration change even when its event batch is empty", async () => {
      const store = create(),
        runtime = createInlineCommunityEventRuntime({ store });
      await runtime.restore([publicScope]);
      await runtime.ingest({
        generation: 0,
        scope: publicScope,
        relayUrl: publicScope.relayUrl,
        events: [root, reply, visible],
      });
      expect(
        await runtime.search({ generation: 0, query: "Secret" }),
      ).toHaveLength(2);
      await runtime.ingest({
        generation: 0,
        scope: privateScope,
        relayUrl: privateScope.relayUrl,
        events: [],
      });
      expect(await runtime.search({ generation: 0, query: "Secret" })).toEqual(
        [],
      );
      expect(
        (await store.restore(publicScope)).events.map((event) => event.id),
      ).toEqual([visible.id]);
      await runtime.clearPrivate!();
      await runtime.restore([privateScope], 1, { metadataOnly: true });
      expect(await runtime.search({ generation: 1, query: "Secret" })).toEqual(
        [],
      );
      runtime.dispose();
    });
    it("quarantines failed configured-room purges and retries without deleting unrelated coverage", async () => {
      const store = create();
      await store.open();
      await store.commit({
        scope: publicScope,
        records: [root, reply, visible].map(record),
        historyPages: [page],
      });
      const remove = vi
        .spyOn(store, "removePublicEvents")
        .mockRejectedValue(new Error("Storage unavailable"));
      const runtime = createInlineCommunityEventRuntime({ store });
      await expect(
        runtime.restore([privateScope], 0, { metadataOnly: true }),
      ).rejects.toThrow("Storage unavailable");
      await expect(
        runtime.readHistoryPage!(privateScope, "public"),
      ).rejects.toThrow("Storage unavailable");
      expect(await runtime.search({ generation: 0, query: "Secret" })).toEqual(
        [],
      );
      await runtime.clearPrivate!();
      remove.mockRestore();
      await runtime.restore([privateScope], 1, { metadataOnly: true });
      expect(
        (await store.restore(publicScope)).events.map((event) => event.id),
      ).toEqual([visible.id]);
      expect(
        (await runtime.readHistoryPage!(privateScope, "public"))?.page,
      ).toEqual(page);
      runtime.dispose();
    });
  });
}
