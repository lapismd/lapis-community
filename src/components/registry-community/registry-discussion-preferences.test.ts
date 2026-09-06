import { describe, expect, it } from "vitest";

import {
  advanceRegistryDiscussionTopicCursor,
  emptyRegistryDiscussionPreferences,
  markRegistryDiscussionTopicUnread,
  readRegistryDiscussionPreferences,
  registryDiscussionPreferenceKey,
  writeRegistryDiscussionPreferences,
} from "./registry-discussion-preferences.js";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("registry discussion preferences", () => {
  it("normalizes relay scope and separates viewer identities", () => {
    const anonymous = registryDiscussionPreferenceKey(
      ["wss://b.example", "wss://a.example", "wss://b.example"],
      "support:ai",
      "",
    );
    expect(anonymous).toBe(
      registryDiscussionPreferenceKey(
        ["wss://a.example", "wss://b.example"],
        "support:ai",
        "anonymous",
      ),
    );
    expect(anonymous).not.toBe(
      registryDiscussionPreferenceKey(
        ["wss://a.example", "wss://b.example"],
        "support:ai",
        "a".repeat(64),
      ),
    );
  });

  it("keeps read cursors monotonic while forced unread is explicit", () => {
    const root = "a".repeat(64);
    const initial = emptyRegistryDiscussionPreferences(1_000);
    const advanced = advanceRegistryDiscussionTopicCursor(initial, root, {
      eventId: "b".repeat(64),
      createdAt: 20,
    });
    const unread = markRegistryDiscussionTopicUnread(advanced, root);
    expect(unread.topics[root]?.forcedUnread).toBe(true);
    const viewedEarlier = advanceRegistryDiscussionTopicCursor(unread, root, {
      eventId: "c".repeat(64),
      createdAt: 19,
    });
    expect(viewedEarlier.topics[root]).toEqual({
      readCursor: { eventId: "b".repeat(64), createdAt: 20 },
      forcedUnread: false,
    });
  });

  it("sanitizes corrupt storage and persists local-only flags", () => {
    const storage = memoryStorage();
    storage.values.set("corrupt", "not json");
    expect(
      readRegistryDiscussionPreferences(storage, "corrupt", 2_000),
    ).toEqual({
      version: 1,
      forumFirstSeenAt: 2,
      followed: false,
      bookmarked: false,
      topics: {},
    });
    const preferences = {
      ...emptyRegistryDiscussionPreferences(1_000),
      followed: true,
      bookmarked: true,
      composerHeight: 360,
    };
    expect(
      writeRegistryDiscussionPreferences(storage, "valid", preferences),
    ).toBe(true);
    expect(readRegistryDiscussionPreferences(storage, "valid")).toMatchObject({
      followed: true,
      bookmarked: true,
      composerHeight: 360,
    });
  });
});
