import { describe, expect, it } from "vitest";

import {
  readRegistryDiscussionCursor,
  registryDiscussionReadKey,
  writeRegistryDiscussionCursor,
} from "./registry-discussion-read-state.js";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("registry discussion read state", () => {
  it("normalizes relay scope and anonymous viewers", () => {
    expect(
      registryDiscussionReadKey(
        ["wss://b.example", "wss://a.example", "wss://b.example"],
        "support:plugin",
        "",
      ),
    ).toBe(
      registryDiscussionReadKey(
        ["wss://a.example", "wss://b.example"],
        "support:plugin",
        "anonymous",
      ),
    );
  });

  it("persists only monotonically advancing valid cursors", () => {
    const storage = memoryStorage();
    const key = "discussion";
    expect(
      writeRegistryDiscussionCursor(storage, key, {
        eventId: "b".repeat(64),
        createdAt: 20,
      }),
    ).toBe(true);
    expect(
      writeRegistryDiscussionCursor(storage, key, {
        eventId: "a".repeat(64),
        createdAt: 19,
      }),
    ).toBe(false);
    expect(readRegistryDiscussionCursor(storage, key)).toEqual({
      eventId: "b".repeat(64),
      createdAt: 20,
    });
  });

  it("ignores corrupt, unavailable, and wrong-version records", () => {
    const storage = memoryStorage();
    storage.values.set("corrupt", "not json");
    storage.values.set(
      "wrong-version",
      JSON.stringify({ version: 2, eventId: "a".repeat(64), createdAt: 1 }),
    );
    storage.values.set(
      "invalid-id",
      JSON.stringify({ version: 1, eventId: "unsafe", createdAt: 1 }),
    );
    expect(readRegistryDiscussionCursor(storage, "missing")).toBeUndefined();
    expect(readRegistryDiscussionCursor(storage, "corrupt")).toBeUndefined();
    expect(
      readRegistryDiscussionCursor(storage, "wrong-version"),
    ).toBeUndefined();
    expect(readRegistryDiscussionCursor(storage, "invalid-id")).toBeUndefined();
  });
});
