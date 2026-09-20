import { describe, expect, it } from "vitest";

import {
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
});
