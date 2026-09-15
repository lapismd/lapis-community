import { describe, expect, it } from "vitest";
import type { CommunityNavigationSectionModel } from "../community-navigation/model.js";
import {
  loadNavigationSections,
  navigationSectionStorageKey,
  orderNavigationSections,
  saveNavigationSections,
  sectionsForDestination,
} from "./navigation-sections.js";

const sections: readonly CommunityNavigationSectionModel[] = [
  {
    id: "projects",
    label: "Projects",
    items: [
      {
        id: "projects/example",
        label: "Example",
        kind: "projects",
        children: [{ id: "general", label: "General", kind: "channel" }],
      },
    ],
  },
  {
    id: "channels",
    label: "Channels",
    items: [
      { id: "general", label: "General", kind: "channel", starred: true },
    ],
  },
  {
    id: "forums",
    label: "Forums",
    items: [{ id: "support", label: "Support", kind: "forum" }],
  },
  {
    id: "direct-messages",
    label: "Direct messages",
    items: [{ id: "dm", label: "Member", kind: "direct-message" }],
  },
];

describe("sidebar section preferences", () => {
  it("round-trips collapsed and expanded sections without sharing accounts or relays", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const key = navigationSectionStorageKey(
      "community",
      "wss://relay.test",
      "alice",
    );
    saveNavigationSections(storage, key, {
      channels: false,
      forums: true,
      "direct-messages": false,
    });
    expect(loadNavigationSections(storage, key)).toEqual({
      channels: false,
      forums: true,
      "direct-messages": false,
    });
    expect(
      loadNavigationSections(
        storage,
        navigationSectionStorageKey("community", "wss://relay.test", "bob"),
      ),
    ).toEqual({});
    expect(
      loadNavigationSections(
        storage,
        navigationSectionStorageKey("community", "wss://other.test", "alice"),
      ),
    ).toEqual({});
  });

  it.each([
    "invalid JSON",
    "null",
    '{"version":2,"sections":{"channels":false}}',
    '{"version":1,"sections":[false]}',
    '{"version":1,"sections":{"channels":"false"}}',
  ])("ignores invalid persisted preferences: %s", (value) => {
    expect(
      loadNavigationSections(
        { getItem: () => value, setItem: () => {} },
        "key",
      ),
    ).toEqual({});
  });

  it("survives unavailable and throwing storage", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadNavigationSections(undefined, "key")).toEqual({});
    expect(loadNavigationSections(storage, "key")).toEqual({});
    expect(() =>
      saveNavigationSections(storage, "key", { channels: false }),
    ).not.toThrow();
  });

  it("orders direct messages before projects without reordering the other groups", () => {
    expect(
      orderNavigationSections(sections).map((section) => section.id),
    ).toEqual(["starred", "direct-messages", "projects", "channels", "forums"]);
    expect(sections.map((section) => section.id)).toEqual([
      "projects",
      "channels",
      "forums",
      "direct-messages",
    ]);
  });

  it("resolves channel ancestors, forum and DM destinations without opening starred duplicates", () => {
    const ordered = orderNavigationSections(sections);
    expect(sectionsForDestination(ordered, "general")).toEqual([
      "projects",
      "channels",
    ]);
    expect(sectionsForDestination(ordered, "support")).toEqual(["forums"]);
    expect(sectionsForDestination(ordered, "dm")).toEqual(["direct-messages"]);
    expect(sectionsForDestination(ordered, "projects/example")).toEqual([
      "projects",
    ]);
    expect(sectionsForDestination(ordered, "registry")).toEqual([]);
    expect(sectionsForDestination([], "general")).toEqual([]);
  });
});
