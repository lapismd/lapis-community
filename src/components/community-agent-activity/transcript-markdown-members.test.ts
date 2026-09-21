import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import { previewCommunityMarkdown } from "../community-markdown-content/preview-mentions.js";
import { storyAgent } from "../community-agents/story-fixtures.js";
import { transcriptMarkdownMembers } from "./transcript-markdown-members.js";

describe("transcriptMarkdownMembers", () => {
  it("lets the shared preview chip a NIP-27 agent mention by name", () => {
    const members = transcriptMarkdownMembers([], [storyAgent]);
    const preview = previewCommunityMarkdown(
      `nostr:${npubEncode(storyAgent.pubkey)} reformat the markdown`,
      members,
    );
    expect(preview.content).toBe(`@${storyAgent.name} reformat the markdown`);
    expect(preview.content).not.toContain("nostr:");
  });

  it("keeps workspace members and still includes the selected agent", () => {
    const ada = "a".repeat(64);
    const members = transcriptMarkdownMembers(
      [{ id: ada, name: "Ada Lovelace", handle: "ada", initials: "AL" }],
      [storyAgent],
    );
    expect(members.map((member) => member.id)).toEqual([
      ada,
      storyAgent.pubkey,
    ]);
  });
});
