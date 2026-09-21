import { describe, expect, it } from "vitest";

import { truncatedContentMention } from "../../community/content-mentions.js";
import { communityMentionAutocompleteItems } from "./agent-mention-candidates.js";

const owner = "1".repeat(64);
const fizz = "a".repeat(64);
const honey = "b".repeat(64);

describe("community mention autocomplete items", () => {
  it("labels owned and out-of-channel agents", () => {
    const items = communityMentionAutocompleteItems(
      [
        { id: owner, name: "Steve", handle: "steve", initials: "S" },
        {
          id: fizz,
          name: "Fizz",
          handle: "fizz",
          initials: "F",
          kind: "agent",
        },
      ],
      [
        {
          pubkey: fizz,
          name: "Fizz",
          ownerPubkey: owner,
          channelIds: ["general"],
        },
        {
          pubkey: honey,
          name: "BHoney",
          ownerPubkey: owner,
          channelIds: [],
        },
      ],
      "",
      owner,
      "general",
    );
    expect(items.map((item) => [item.label, item.detail])).toEqual([
      ["BHoney", "agent · managed by you · not in channel"],
      ["Fizz", "agent · managed by you"],
    ]);
  });

  it("keeps people before agents", () => {
    const items = communityMentionAutocompleteItems(
      [{ id: "ben", name: "Ben Stone", handle: "ben", initials: "BS" }],
      [
        {
          pubkey: fizz,
          name: "Fizz",
          ownerPubkey: owner,
          channelIds: ["general"],
        },
      ],
      "",
      owner,
      "general",
    );
    expect(items.map((item) => item.label)).toEqual(["Ben Stone", "Fizz"]);
  });

  it("shows a truncated npub when people share a display name", () => {
    const ada = "c".repeat(64);
    const guest = "d".repeat(64);
    const items = communityMentionAutocompleteItems(
      [
        { id: ada, name: "Nyra", handle: "nyra-human", initials: "NY" },
        { id: guest, name: "Nyra", handle: "nyra-guest", initials: "NG" },
      ],
      [],
      "Nyra",
    );
    expect(items.map((item) => item.detail)).toEqual([
      `@nyra-guest · ${truncatedContentMention("", guest)}`,
      `@nyra-human · ${truncatedContentMention("", ada)}`,
    ]);
  });
});
