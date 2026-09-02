import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import { createMemoryCommunityEventStore } from "./event-store.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";

const scope = {
  id: "lapis",
  name: "Lapis Community",
  relayUrl: "memory://runtime.test",
  rooms: [
    {
      id: "general",
      groupId: "general",
      name: "general",
      kind: "channel" as const,
    },
  ],
};

describe("CommunityEventRuntime", () => {
  it("verifies, persists, and projects an event only once", async () => {
    const store = createMemoryCommunityEventStore();
    const commit = vi.spyOn(store, "commit");
    const runtime = createInlineCommunityEventRuntime({ store });
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_000,
        content: "One projection",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(44),
    );

    await runtime.restore([scope], 7);
    const first = await runtime.ingest({
      generation: 7,
      scope,
      relayUrl: scope.relayUrl,
      events: [event],
    });
    const replay = await runtime.ingest({
      generation: 7,
      scope,
      relayUrl: scope.relayUrl,
      events: [event, event],
    });
    const projection = await runtime.project({
      generation: 7,
      scopes: [scope],
      activeCommunityId: scope.id,
      activeRoomId: "general",
    });

    expect(first?.revision).toBe(2);
    expect(first?.cache.approximateBytes).toBeGreaterThan(0);
    expect(replay).toBeUndefined();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(projection.workspace?.messages).toMatchObject([
      { id: event.id, content: "One projection" },
    ]);
    await expect(
      runtime.search({ generation: 7, scopeId: scope.id, query: "projection" }),
    ).resolves.toEqual([{ event, relayUrl: scope.relayUrl }]);
    runtime.dispose();
  });

  it("keeps private NIP-29 events memory-only when persistence is disabled", async () => {
    const store = createMemoryCommunityEventStore();
    const runtime = createInlineCommunityEventRuntime({ store });
    const privateEvent = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_001,
        content: "Private plaintext",
        tags: [["h", "private-room"]],
      },
      new Uint8Array(32).fill(45),
    );
    await runtime.restore([scope], 1);
    await runtime.ingest({
      generation: 1,
      scope,
      relayUrl: scope.relayUrl,
      events: [privateEvent],
      persist: false,
    });
    runtime.dispose();

    const restored = createInlineCommunityEventRuntime({ store });
    const revision = await restored.restore([scope], 2);
    expect(revision.acceptedEventsByScope?.[scope.id]).toEqual([]);
    restored.dispose();
  });

  it("returns only accepted deltas after the initial restore", async () => {
    const runtime = createInlineCommunityEventRuntime();
    const firstEvent = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_002,
        content: "First",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(46),
    );
    const secondEvent = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_003,
        content: "Second",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(47),
    );

    await runtime.restore([scope], 1);
    await runtime.ingest({
      generation: 1,
      scope,
      relayUrl: scope.relayUrl,
      events: [firstEvent],
    });
    const delta = await runtime.ingest({
      generation: 1,
      scope,
      relayUrl: scope.relayUrl,
      events: [firstEvent, secondEvent],
    });
    const projection = await runtime.project({
      generation: 1,
      scopes: [scope],
      activeCommunityId: scope.id,
      activeRoomId: "general",
    });

    expect(delta?.acceptedEventsByScope).toEqual({
      [scope.id]: [secondEvent],
    });
    expect(projection.acceptedEventsByScope).toBeUndefined();
    runtime.dispose();
  });
});
