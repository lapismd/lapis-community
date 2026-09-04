import { describe, expect, it } from "vitest";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import {
  communityEmojiAutocompleteItems,
  communityMemberAutocompleteItems,
  communityRoomAutocompleteItems,
  detectCommunityComposerAutocomplete,
} from "./autocomplete.js";

const members: CommunityMemberModel[] = [
  { id: "ben", name: "Ben Stone", handle: "ben", initials: "BS" },
  { id: "mara", name: "Mara Chen", handle: "mara", initials: "MC" },
];

const rooms: CommunityRoomModel[] = [
  { id: "general", name: "general", kind: "channel" },
  { id: "plugins", name: "plugin-development", kind: "forum" },
  { id: "archive", name: "archive", kind: "channel", archived: true },
  { id: "dm", name: "Ben Stone", kind: "direct" },
];

describe("community composer autocomplete", () => {
  it("keeps a candidate-aware multiword mention open across spaces and deletion", () => {
    const withSpace = "Ask @Ben ";
    expect(
      detectCommunityComposerAutocomplete(withSpace, withSpace.length, members),
    ).toEqual({
      kind: "member",
      query: "Ben ",
      from: 4,
      to: withSpace.length,
    });

    const afterBackspace = "Ask @Ben St";
    expect(
      detectCommunityComposerAutocomplete(
        afterBackspace,
        afterBackspace.length,
        members,
      ),
    ).toEqual({
      kind: "member",
      query: "Ben St",
      from: 4,
      to: afterBackspace.length,
    });
  });

  it("closes a complete mention after its trailing separator", () => {
    const value = "Ask @Ben Stone ";
    expect(
      detectCommunityComposerAutocomplete(value, value.length, members),
    ).toBeNull();
  });

  it("detects standard emoji search after two characters", () => {
    expect(detectCommunityComposerAutocomplete("Ship :ro", 8, members)).toEqual(
      { kind: "emoji", query: "ro", from: 5, to: 8 },
    );
    expect(
      detectCommunityComposerAutocomplete("Ship :r", 7, members),
    ).toBeNull();
  });

  it("filters members and public rooms without surfacing archived or direct rooms", () => {
    expect(
      communityMemberAutocompleteItems(members, "ben st").map(
        (item) => item.member?.id,
      ),
    ).toEqual(["ben"]);
    expect(
      communityRoomAutocompleteItems(rooms, "").map((item) => item.room?.id),
    ).toEqual(["general", "plugins"]);
  });

  it("merges the standard emoji index with safe unambiguous custom emoji", async () => {
    const customEmoji: CommunityCustomEmoji[] = [
      {
        shortcode: "lapis",
        url: "https://cdn.example/lapis.webp",
        ownerPubkey: "ben",
        owned: true,
      },
      {
        shortcode: "duplicate",
        url: "https://cdn.example/one.webp",
        ownerPubkey: "ben",
        owned: true,
      },
      {
        shortcode: "duplicate",
        url: "https://cdn.example/two.webp",
        ownerPubkey: "mara",
        owned: false,
      },
      {
        shortcode: "unsafe",
        url: "javascript:alert(1)",
        ownerPubkey: "mara",
        owned: false,
      },
    ];

    const custom = await communityEmojiAutocompleteItems(customEmoji, "lap");
    expect(custom.some((item) => item.customEmoji?.shortcode === "lapis")).toBe(
      true,
    );
    const duplicate = await communityEmojiAutocompleteItems(
      customEmoji,
      "duplicate",
    );
    expect(duplicate.some((item) => item.customEmoji)).toBe(false);
    const standard = await communityEmojiAutocompleteItems(customEmoji, "rock");
    expect(
      standard.some((item) => item.label === "rocket" && item.native === "🚀"),
    ).toBe(true);
  });
});
