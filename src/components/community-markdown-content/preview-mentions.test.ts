import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import { truncatedContentMention } from "../../community/content-mentions.js";
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

  it("rewrites unknown npub tokens to a truncated mention", () => {
    const preview = previewCommunityMarkdown(`nostr:${adaNpub} hello`, []);
    const label = `@${truncatedContentMention(`nostr:${adaNpub}`, ada)}`;
    expect(preview.content).toBe(`${label} hello`);
    expect(preview.members[0]?.name).toBe(label.slice(1));
  });

  it("leaves fenced nostr tokens as published text", () => {
    const content = "```\nnostr:" + adaNpub + "\n```";
    expect(previewCommunityMarkdown(content, []).content).toBe(content);
  });
});
