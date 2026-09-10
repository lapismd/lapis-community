import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import type { ProjectForgeCatalogStorage } from "./catalog-store.js";
import {
  createBrowserProjectForgeCatalogStore,
  projectForgeCatalogCacheKey,
} from "./catalog-store.js";
import { materializeProjectForgeCatalog } from "./reducer.js";

function memoryStorage(): ProjectForgeCatalogStorage & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const projectEvent = finalizeEvent(
  {
    kind: 30_621,
    created_at: 1_700_000_000,
    content: "Cached project",
    tags: [
      ["d", "cached-project"],
      ["name", "Cached project"],
      ["r", "30617:" + "2".repeat(64) + ":repository"],
    ],
  },
  new Uint8Array(32).fill(91),
);

describe("project forge catalog store", () => {
  it("restores only verified catalog events in the exact relay scope", async () => {
    const storage = memoryStorage();
    const scope = {
      relayUrl: "wss://relay.example",
      communityId: "lapis",
      channelId: "projects",
    };
    const store = createBrowserProjectForgeCatalogStore({
      storage,
      now: () => 42,
    });
    await store.save(scope, materializeProjectForgeCatalog([projectEvent]));

    await expect(store.load(scope)).resolves.toMatchObject({
      cachedAt: 42,
      catalog: { projects: [{ name: "Cached project" }] },
    });
    await expect(
      store.load({ ...scope, relayUrl: "wss://other-relay.example" }),
    ).resolves.toBeUndefined();
    await expect(
      store.load({ ...scope, communityId: "other-community" }),
    ).resolves.toBeUndefined();
  });

  it("rejects and removes a snapshot containing an invalid event", async () => {
    const storage = memoryStorage();
    const scope = {
      relayUrl: "wss://relay.example",
      communityId: "lapis",
    };
    const key = projectForgeCatalogCacheKey(scope);
    storage.setItem(
      key,
      JSON.stringify({
        version: 1,
        relayUrl: "wss://relay.example/",
        communityId: "lapis",
        channelId: "",
        cachedAt: 42,
        events: [{ ...projectEvent, content: "tampered" }],
      }),
    );
    const store = createBrowserProjectForgeCatalogStore({ storage });

    await expect(store.load(scope)).resolves.toBeUndefined();
    expect(storage.values.has(key)).toBe(false);
  });
});
