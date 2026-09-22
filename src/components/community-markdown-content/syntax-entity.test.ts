import { describe, expect, it } from "vitest";

import { tokenizeCommunityMarkdownText } from "./syntax.js";
import { applyCommunityMarkdownSyntax } from "./syntax-hast.js";

const eventId = "c".repeat(64);
const href = `lapis-community://message?channel=general&id=${eventId}`;

describe("community entity markdown syntax", () => {
  it("tokenizes scheme, hash, and absolute Community URLs", () => {
    expect(
      tokenizeCommunityMarkdownText(
        `see ${href} and #/channels/general`,
        [],
        [],
        [],
        [],
      ),
    ).toEqual([
      { kind: "text", value: "see " },
      { kind: "entity", href, value: href },
      { kind: "text", value: " and " },
      {
        kind: "entity",
        href: "lapis-community://channel/general",
        value: "#/channels/general",
      },
    ]);
  });

  it("replaces labeled Community pathlinks with entity chips", () => {
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
              properties: { href },
              children: [{ type: "text", value: "Open thread" }],
            },
          ],
        },
      ],
    };
    applyCommunityMarkdownSyntax(
      tree,
      {
        members: () => [],
        rooms: () => [],
        emojis: () => [],
        mentionPubkeys: () => [],
      },
      tokenizeCommunityMarkdownText,
    );
    expect(tree.children[0]?.children).toEqual([
      {
        type: "element",
        tagName: "communityentity",
        properties: { href, label: "Open thread" },
        children: [],
      },
    ]);
  });
});
