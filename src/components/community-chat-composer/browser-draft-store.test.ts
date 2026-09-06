import { describe, expect, it } from "vitest";

import { createBrowserCommunityComposerDraftStore } from "./browser-draft-store.js";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe("browser composer draft store", () => {
  it("round trips safe text drafts and removes them", async () => {
    const storage = memoryStorage();
    const store = createBrowserCommunityComposerDraftStore(storage, "test");
    await store.save("discussion", {
      value: "Retain this reply",
      mentionPubkeys: ["a".repeat(64)],
      channelIds: [],
      attachments: [],
      updatedAt: 42,
    });
    await expect(store.load("discussion")).resolves.toEqual({
      value: "Retain this reply",
      mentionPubkeys: ["a".repeat(64)],
      channelIds: [],
      attachments: [],
      updatedAt: 42,
    });
    await store.remove("discussion");
    await expect(store.load("discussion")).resolves.toBeUndefined();
  });

  it("fails closed for corrupt and oversized drafts", async () => {
    const storage = memoryStorage();
    const store = createBrowserCommunityComposerDraftStore(storage, "test");
    storage.values.set("test:corrupt", "not json");
    await expect(store.load("corrupt")).resolves.toBeUndefined();
    await store.save("large", {
      value: "x".repeat(100_001),
      mentionPubkeys: [],
      channelIds: [],
      attachments: [],
      updatedAt: 1,
    });
    await expect(store.load("large")).resolves.toBeUndefined();
  });
});
