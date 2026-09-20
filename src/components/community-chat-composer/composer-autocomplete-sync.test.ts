import { describe, expect, it } from "vitest";

import type { CommunityComposerAutocompleteItem } from "./autocomplete.js";
import {
  composerActiveActionsEqual,
  composerAutocompleteItemsEqual,
  composerAutocompleteQueryEquals,
  planComposerAutocompleteUpdate,
  shouldSkipComposerAutocompleteUpdate,
} from "./composer-autocomplete-sync.js";

const nyra: CommunityComposerAutocompleteItem = {
  id: "member:nyra",
  kind: "member",
  label: "Nyra",
  detail: "@nyra",
};

describe("composer autocomplete sync", () => {
  it("skips a repeated member query whose rows did not change", () => {
    const query = { kind: "member" as const, query: "Ny", from: 0, to: 3 };
    expect(
      shouldSkipComposerAutocompleteUpdate(query, query, [nyra], [nyra]),
    ).toBe(true);
    expect(
      shouldSkipComposerAutocompleteUpdate(
        query,
        query,
        [nyra],
        [{ ...nyra, detail: "agent · managed by you" }],
      ),
    ).toBe(false);
    expect(
      shouldSkipComposerAutocompleteUpdate(
        query,
        { ...query, query: "Nyr" },
        [nyra],
        [nyra],
      ),
    ).toBe(false);
  });

  it("skips clearing an already-closed picker", () => {
    expect(shouldSkipComposerAutocompleteUpdate(undefined, null, [], [])).toBe(
      true,
    );
    expect(
      shouldSkipComposerAutocompleteUpdate(
        { kind: "member", query: "", from: 0, to: 1 },
        null,
        [nyra],
        [],
      ),
    ).toBe(false);
  });

  it("skips a repeated emoji query so the async search is not restarted", () => {
    const query = { kind: "emoji" as const, query: "ro", from: 5, to: 8 };
    expect(
      shouldSkipComposerAutocompleteUpdate(query, query, [], undefined),
    ).toBe(true);
  });

  it("plans a skipped update for an unchanged member query", () => {
    const query = { kind: "member" as const, query: "", from: 0, to: 1 };
    expect(
      planComposerAutocompleteUpdate({
        currentQuery: query,
        nextQuery: query,
        currentItems: [nyra],
        members: [{ id: "nyra", name: "Nyra", handle: "nyra", initials: "NY" }],
        agents: [],
        rooms: [],
        currentMemberId: "steve",
        channelId: "general",
      }).kind,
    ).toBe("skip");
  });

  it("compares query bounds and action sets by value", () => {
    expect(
      composerAutocompleteQueryEquals(
        { kind: "room", query: "gen", from: 1, to: 4 },
        { kind: "room", query: "gen", from: 1, to: 4 },
      ),
    ).toBe(true);
    expect(
      composerAutocompleteItemsEqual([nyra], [{ ...nyra, label: "NYRA" }]),
    ).toBe(false);
    expect(
      composerActiveActionsEqual(new Set(["bold"]), new Set(["bold"])),
    ).toBe(true);
    expect(
      composerActiveActionsEqual(new Set(["bold"]), new Set(["italic"])),
    ).toBe(false);
  });
});
