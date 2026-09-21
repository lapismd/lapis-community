import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import { applyCommunityMarkdownSyntax } from "./syntax-hast.js";
import { tokenizeCommunityMarkdownText } from "./syntax.js";

const adaKey = "a".repeat(64);
const adaNpub = npubEncode(adaKey);
const members: CommunityMemberModel[] = [
  { id: adaKey, name: "Ada Lovelace", handle: "ada", initials: "AL" },
];
const rooms: CommunityRoomModel[] = [];
const emojis: CommunityCustomEmoji[] = [];

describe("published NIP-27 mention syntax", () => {
  it("chips published NIP-27 mentions without a composer @Name token", () => {
    expect(
      tokenizeCommunityMarkdownText(
        `nostr:${adaNpub} Live owner-thread acceptance`,
        members,
        rooms,
        emojis,
        [],
      ),
    ).toEqual([
      { kind: "member", value: "@Ada Lovelace", memberId: adaKey },
      { kind: "text", value: " Live owner-thread acceptance" },
    ]);
  });

  it("replaces Mira nostr autolinks with the same member chip", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          children: [
            {
              type: "element",
              tagName: "a",
              properties: { href: `nostr:${adaNpub}` },
              children: [{ type: "text", value: "nostr" }],
            },
            { type: "text", value: " Live owner-thread acceptance" },
          ],
        },
      ],
    };
    applyCommunityMarkdownSyntax(
      tree,
      {
        members: () => members,
        rooms: () => rooms,
        emojis: () => emojis,
        mentionPubkeys: () => [],
      },
      tokenizeCommunityMarkdownText,
    );
    expect(tree.children[0]?.children).toEqual([
      {
        type: "element",
        tagName: "communitymember",
        properties: { memberId: adaKey, label: "@Ada Lovelace" },
        children: [],
      },
      { type: "text", value: " Live owner-thread acceptance" },
    ]);
  });
});
