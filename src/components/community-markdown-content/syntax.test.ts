import { describe, expect, it } from "vitest";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import { tokenizeCommunityMarkdownText } from "./syntax.js";

const members: CommunityMemberModel[] = [
  { id: "ada", name: "Ada Lovelace", handle: "ada", initials: "AL" },
  { id: "ben", name: "Ben", handle: "ben", initials: "B" },
  { id: "ben-two", name: "Ben", handle: "ben-two", initials: "B2" },
];
const rooms: CommunityRoomModel[] = [
  { id: "general", name: "general", kind: "channel" },
  { id: "support", name: "support ai", kind: "forum" },
  { id: "support-copy", name: "support ai", kind: "channel" },
];
const emojis: CommunityCustomEmoji[] = [
  {
    shortcode: "lapis",
    url: "https://cdn.example/lapis.webp",
    ownerPubkey: "ada",
    owned: true,
  },
];

describe("community message markdown syntax", () => {
  it("turns known, unambiguous references into semantic segments", () => {
    expect(
      tokenizeCommunityMarkdownText(
        "Hi @Ada Lovelace in #general :lapis:",
        members,
        rooms,
        emojis,
        ["ada"],
      ),
    ).toEqual([
      { kind: "text", value: "Hi " },
      { kind: "member", value: "@Ada Lovelace", memberId: "ada" },
      { kind: "text", value: " in " },
      { kind: "room", value: "#general", roomId: "general" },
      { kind: "text", value: " " },
      {
        kind: "emoji",
        value: ":lapis:",
        shortcode: "lapis",
        url: "https://cdn.example/lapis.webp",
      },
    ]);
  });

  it("leaves untagged and ambiguous references as text", () => {
    expect(
      tokenizeCommunityMarkdownText(
        "@Ben #support ai",
        members,
        rooms,
        emojis,
        ["ben", "ben-two"],
      ),
    ).toEqual([{ kind: "text", value: "@Ben #support ai" }]);
  });

  it("creates a concealed spoiler segment", () => {
    expect(
      tokenizeCommunityMarkdownText(
        "The answer is ||forty two||.",
        members,
        rooms,
        emojis,
        [],
      ),
    ).toEqual([
      { kind: "text", value: "The answer is " },
      { kind: "spoiler", value: "forty two" },
      { kind: "text", value: "." },
    ]);
  });
});
