import { describe, expect, it } from "vitest";
import { activityConversationKey } from "./activity-conversation-key.js";

describe("activityConversationKey", () => {
  it("scopes pinning to the selected agent and activity origin", () => {
    expect(activityConversationKey("agent", { kind: "overview" })).toBe(
      "agent:overview",
    );
    expect(
      activityConversationKey("agent", {
        kind: "channel",
        channelId: "general",
      }),
    ).toBe("agent:channel:general");
    expect(
      activityConversationKey("agent", {
        kind: "thread",
        channelId: "general",
        threadRootId: "root",
      }),
    ).toBe("agent:thread:general:root");
  });
});
