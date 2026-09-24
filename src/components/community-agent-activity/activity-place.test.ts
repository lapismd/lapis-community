import { describe, expect, it } from "vitest";
import { activityPlace } from "./activity-place.js";
import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";

const agent = "a".repeat(64);
const topic = "b".repeat(64);

function scope(
  patch: Partial<CommunityAgentControllerScope>,
): CommunityAgentControllerScope {
  return {
    agentPubkey: agent,
    scopeKey: "relay/room/agent/channel",
    active: true,
    sessionId: "session",
    turnId: "turn",
    ...patch,
  };
}

const rooms = [
  {
    id: "plugin-development",
    groupId: "group-channel",
    name: "plugin-development",
    kind: "channel" as const,
  },
  {
    id: "ideas",
    groupId: "group-forum",
    name: "plugin-ideas",
    kind: "forum" as const,
  },
];

describe("activity place links", () => {
  it("links a channel and a forum topic to their rooms", () => {
    expect(
      activityPlace(
        scope({ channelId: "group-channel", conversationKind: "channel" }),
        rooms,
      ),
    ).toEqual({
      label: "#plugin-development",
      href: "#/channels/plugin-development",
    });
    expect(
      activityPlace(
        scope({
          channelId: "group-forum",
          conversationKind: "forum-topic",
          threadRootId: topic,
          scopeKey: `relay/room/agent/thread/${topic}`,
        }),
        rooms,
      ),
    ).toEqual({
      label: "#plugin-ideas · Topic",
      href: `#/forums/ideas/${topic}`,
    });
    expect(
      activityPlace(
        scope({ conversationKind: "dm", conversationId: "dm-1" }),
        rooms,
      ).href,
    ).toBeUndefined();
  });
});
