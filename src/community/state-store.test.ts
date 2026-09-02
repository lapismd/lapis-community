import { describe, expect, it } from "vitest";

import { SecretKeyRegistrySigner } from "../auth/index.js";
import { createInMemoryRelayFactory } from "../testing/index.js";
import type { CommunityStateScope, CommunityStoredState } from "./contracts.js";
import {
  createBrowserCommunityStateStore,
  createCommunityStoredState,
  createNip78CommunityStateStore,
  mergeCommunityStates,
  type StorageLike,
} from "./state-store.js";

function storage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("community state stores", () => {
  it("persists browser-local state without a relay", async () => {
    const local = createBrowserCommunityStateStore({ storage: storage() });
    const scope: CommunityStateScope = {
      communityId: "lapis",
      relayUrl: "memory://state.test",
      pubkey: "ab".repeat(32),
    };
    const state = createCommunityStoredState("browser", 100);
    state.preferences.activeRoomId = {
      value: "general",
      updatedAt: 100,
      clientId: "browser",
    };
    await local.save(scope, state);
    await expect(local.load(scope)).resolves.toEqual(state);
  });

  it("merges read cursors monotonically and preferences deterministically", () => {
    const older = createCommunityStoredState("a", 100);
    older.readMarkers.general = {
      createdAt: 10,
      eventId: "a",
      granularity: "room",
    };
    older.preferences.activeRoomId = {
      value: "general",
      updatedAt: 20,
      clientId: "a",
    };
    const newer = createCommunityStoredState("b", 101);
    newer.readMarkers.general = {
      createdAt: 11,
      eventId: "b",
      granularity: "room",
    };
    newer.preferences.activeRoomId = {
      value: "support",
      updatedAt: 20,
      clientId: "b",
    };
    expect(mergeCommunityStates([newer, older], "merged", 102)).toMatchObject({
      readMarkers: { general: { eventId: "b" } },
      preferences: { activeRoomId: { value: "support" } },
    });
  });

  it("encrypts per-device NIP-78 slots and merges them across stores", async () => {
    const identity = new SecretKeyRegistrySigner(new Uint8Array(32).fill(71));
    const pubkey = await identity.getPublicKey();
    const scope: CommunityStateScope = {
      communityId: "lapis",
      relayUrl: "memory://state-sync.test",
      pubkey,
    };
    const relayFactory = createInMemoryRelayFactory();
    const first = createNip78CommunityStateStore({
      relayFactory,
      identity,
      local: createBrowserCommunityStateStore({ storage: storage() }),
      clientId: "device-a",
      now: () => 100,
      debounceMs: 60_000,
    });
    const second = createNip78CommunityStateStore({
      relayFactory,
      identity,
      local: createBrowserCommunityStateStore({ storage: storage() }),
      clientId: "device-b",
      now: () => 101,
      debounceMs: 60_000,
    });
    const stateA = createCommunityStoredState("device-a", 100);
    stateA.readMarkers.general = {
      createdAt: 10,
      eventId: "a",
      granularity: "room",
    };
    stateA.preferences.activeRoomId = {
      value: "general",
      updatedAt: 100,
      clientId: "device-a",
    };
    await first.save(scope, stateA);
    await first.flush(scope);

    const stateB = (await second.refresh(scope))!;
    stateB.readMarkers.general = {
      createdAt: 11,
      eventId: "b",
      granularity: "room",
    };
    stateB.preferences.activeRoomId = {
      value: "support",
      updatedAt: 101,
      clientId: "device-b",
    };
    await second.save(scope, stateB);
    await second.flush(scope);

    await expect(first.refresh(scope)).resolves.toMatchObject({
      readMarkers: { general: { eventId: "b" } },
      preferences: { activeRoomId: { value: "support" } },
    });
    const relayEvents = await relayFactory.relay(scope.relayUrl).query({
      kinds: [30_078],
    });
    expect(relayEvents).toHaveLength(2);
    expect(
      relayEvents.every((event) => !event.content.includes("support")),
    ).toBe(true);
    first.dispose();
    second.dispose();
  });
});
