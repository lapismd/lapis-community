import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import { previewCommunityMarkdown } from "./preview-mentions.js";
import { tokenizeCommunityMarkdownText } from "./syntax.js";

const ada = "a".repeat(64);
const adaNpub = npubEncode(ada);

describe("previewCommunityMarkdown", () => {
  it("rewrites published NIP-27 tokens to @Name before Mira can autolink them", () => {
    const preview = previewCommunityMarkdown(
      `nostr:${adaNpub} Live owner-thread acceptance`,
      [{ id: ada, name: "Ada Lovelace", handle: "ada", initials: "AL" }],
    );
    expect(preview.content).toBe("@Ada Lovelace Live owner-thread acceptance");
    expect(preview.mentionPubkeys).toEqual([ada]);
    expect(
      tokenizeCommunityMarkdownText(
        preview.content,
        preview.members,
        [],
        [],
        preview.mentionPubkeys,
      ),
    ).toEqual([
      { kind: "member", value: "@Ada Lovelace", memberId: ada },
      { kind: "text", value: " Live owner-thread acceptance" },
    ]);
  });

  it("leaves fenced nostr tokens as published text", () => {
    const content = "```\nnostr:" + adaNpub + "\n```";
    expect(previewCommunityMarkdown(content, []).content).toBe(content);
  });
});
