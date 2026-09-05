import "fake-indexeddb/auto";

import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import type {
  CommunityEventStore,
  CommunityScope,
  CommunityVerifiedEventRecord,
} from "./contracts.js";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { createIndexedDbCommunityEventStore } from "./indexeddb-event-store.js";

const scope: CommunityScope = {
  id: "lapis",
  name: "Lapis Community",
  relayUrl: "wss://relay.example/",
};

const publicEvent = finalizeEvent(
  {
    kind: 9,
    created_at: 1_700_000_000,
    content: "Cached public message",
    tags: [["h", "general"]],
  },
  new Uint8Array(32).fill(41),
);

const wrap = finalizeEvent(
  {
    kind: 1059,
    created_at: 1_700_000_010,
    content: "encrypted gift wrap",
    tags: [["p", "recipient"]],
  },
  new Uint8Array(32).fill(42),
);

function publicRecord(): CommunityVerifiedEventRecord {
  return {
    event: publicEvent,
    relayUrl: scope.relayUrl,
    audience: { type: "public" },
    roomId: "general",
    lastAccessedAt: 1_700_000_000_000,
  };
}

function runEventStoreContract(
  name: string,
  factory: () => CommunityEventStore,
): void {
  describe(name, () => {
    it("restores deterministic public events and checkpoints", async () => {
      const store = factory();
      await store.open();
      await store.commit({
        scope,
        records: [publicRecord(), publicRecord()],
        checkpoints: [
          {
            relayUrl: scope.relayUrl,
            stream: "content",
            createdAt: publicEvent.created_at,
            synchronizedAt: 1_700_000_020,
            cursorEventId: publicEvent.id,
            complete: false,
          },
        ],
      });

      const restored = await store.restore(scope);
      expect(restored.events).toEqual([publicEvent]);
      expect(restored.checkpoints).toEqual([
        {
          relayUrl: "wss://relay.example/",
          stream: "content",
          createdAt: publicEvent.created_at,
          synchronizedAt: 1_700_000_020,
          cursorEventId: publicEvent.id,
          complete: false,
        },
      ]);
      expect((await store.syncPlan(scope)).cachedEventIds).toEqual([
        publicEvent.id,
      ]);
      await store.close();
    });

    it("keeps encrypted inbox partitions separate from public data", async () => {
      const store = factory();
      await store.open();
      await store.commit({
        scope,
        records: [
          publicRecord(),
          {
            event: wrap,
            relayUrl: scope.relayUrl,
            audience: { type: "inbox", pubkey: "recipient" },
          },
        ],
      });

      expect((await store.restore(scope)).events).toEqual([publicEvent]);
      expect(
        (await store.restore(scope, { type: "inbox", pubkey: "recipient" }))
          .events,
      ).toEqual([wrap]);
      expect(
        (await store.restore(scope, { type: "inbox", pubkey: "other" })).events,
      ).toEqual([]);
      await store.close();
    });

    it("clears one scope without changing another", async () => {
      const store = factory();
      const otherScope = { ...scope, id: "other" };
      await store.open();
      await store.commit({ scope, records: [publicRecord()] });
      await store.commit({ scope: otherScope, records: [publicRecord()] });
      await store.clear(scope);
      expect((await store.restore(scope)).events).toEqual([]);
      expect((await store.restore(otherScope)).events).toEqual([publicEvent]);
      await store.close();
    });
  });
}

let databaseSequence = 0;
runEventStoreContract("memory", () => createMemoryCommunityEventStore());
runEventStoreContract("indexeddb", () =>
  createIndexedDbCommunityEventStore({
    databaseName: `lapis-community-test-${databaseSequence++}`,
  }),
);
