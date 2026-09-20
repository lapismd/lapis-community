import { describe, expect, it } from "vitest";

import { threadComposerAudience } from "./thread-composer-audience.js";

const owner = "1".repeat(64);
const fizz = "a".repeat(64);

describe("threadComposerAudience", () => {
  it("scopes the thread and inherits root agent mentions", () => {
    expect(
      threadComposerAudience(
        owner,
        [{ id: "general", name: "general", kind: "channel" }],
        {
          id: "root",
          authorId: owner,
          timestamp: "09:00",
          content: "Ask @Fizz",
          mentionPubkeys: [fizz],
        },
        "root",
        [
          {
            pubkey: fizz,
            name: "Fizz",
            ownerPubkey: owner,
            channelIds: ["general"],
          },
        ],
      ),
    ).toEqual({
      audience: {
        ownerPubkey: owner,
        channelId: "general",
        threadRootId: "root",
      },
      initialAgentPubkeys: [fizz],
    });
  });
});
