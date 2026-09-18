import { describe, expect, it, vi } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import {
  countRetainedFixtureCopies,
  describeMissingFixtureEvents,
  fixtureAddressFilter,
} from "./seed-retention.js";

function event(
  partial: Partial<NostrEvent> & Pick<NostrEvent, "id">,
): NostrEvent {
  return {
    pubkey: "a".repeat(64),
    created_at: 1_700_000_000,
    kind: 9,
    tags: [],
    content: "",
    sig: "b".repeat(128),
    ...partial,
  };
}

describe("fixtureAddressFilter", () => {
  it("queries replaceable metadata by author", () => {
    expect(
      fixtureAddressFilter(
        event({ id: "profile", kind: 0, pubkey: "c".repeat(64) }),
      ),
    ).toEqual({
      kinds: [0],
      authors: ["c".repeat(64)],
      limit: 1,
    });
  });

  it("queries addressable project heads by d tag", () => {
    expect(
      fixtureAddressFilter(
        event({
          id: "project",
          kind: 30_621,
          tags: [
            ["d", "lapis-community"],
            ["name", "Lapis Community"],
          ],
        }),
      ),
    ).toEqual({
      kinds: [30_621],
      authors: ["a".repeat(64)],
      "#d": ["lapis-community"],
      limit: 1,
    });
  });

  it("leaves regular events without an address filter", () => {
    expect(
      fixtureAddressFilter(event({ id: "note", kind: 9 })),
    ).toBeUndefined();
  });
});

describe("countRetainedFixtureCopies", () => {
  it("counts exact IDs and a newer addressable head as retained", async () => {
    const published = [
      event({ id: "thread", kind: 11 }),
      event({
        id: "fixture-project",
        kind: 30_621,
        tags: [["d", "lapis-community"]],
      }),
    ];
    const replacement = event({
      id: "live-project",
      kind: 30_621,
      created_at: 1_800_000_000,
      tags: [["d", "lapis-community"]],
    });
    const query = vi.fn(
      async (filter: { ids?: string[]; kinds?: number[] }) => {
        if (filter.ids?.includes("thread")) return [published[0]!];
        if (filter.ids?.includes("fixture-project")) return [];
        if (filter.kinds?.includes(30_621)) return [replacement];
        return [];
      },
    );

    await expect(countRetainedFixtureCopies(published, query)).resolves.toBe(2);
  });

  it("still fails when a regular event ID is absent", async () => {
    const published = [
      event({ id: "kept", kind: 11 }),
      event({ id: "dropped", kind: 11 }),
    ];
    const query = vi.fn(async (filter: { ids?: string[] }) =>
      published.filter(
        (item) => filter.ids?.includes(item.id) && item.id === "kept",
      ),
    );

    await expect(countRetainedFixtureCopies(published, query)).rejects.toThrow(
      "The relay retained 1/2 fixture events (kind 11 dropped)",
    );
  });
});

describe("describeMissingFixtureEvents", () => {
  it("names addressable coordinates", () => {
    expect(
      describeMissingFixtureEvents([
        event({
          id: "fixture-project",
          kind: 30_621,
          tags: [["d", "lapis-community"]],
        }),
      ]),
    ).toBe("kind 30621 d=lapis-community fixture-project");
  });
});
