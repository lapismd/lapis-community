import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import {
  mentionPubkeysForPublish,
  normalizeMentionPubkeys,
  publishMentionTags,
} from "./publish-mention-tags.js";

const agent = "a".repeat(64);
const parent = "b".repeat(64);

describe("publishMentionTags", () => {
  it("appends unique lowercase mention p tags", () => {
    expect(
      publishMentionTags(
        [
          ["h", "general"],
          ["p", parent],
        ],
        [agent, agent.toUpperCase(), parent, "not-a-key"],
      ),
    ).toEqual([
      ["h", "general"],
      ["p", parent],
      ["p", agent],
    ]);
  });

  it("normalizes mention pubkeys", () => {
    expect(
      normalizeMentionPubkeys([` ${agent.toUpperCase()} `, agent]),
    ).toEqual([agent]);
  });

  it("adds p tags from NIP-27 content when the composer list is empty", () => {
    const content = `nostr:${npubEncode(agent)} please inspect README`;
    expect(mentionPubkeysForPublish(content, [])).toEqual([agent]);
    expect(
      publishMentionTags([["h", "general"]], mentionPubkeysForPublish(content)),
    ).toEqual([
      ["h", "general"],
      ["p", agent],
    ]);
  });
});
