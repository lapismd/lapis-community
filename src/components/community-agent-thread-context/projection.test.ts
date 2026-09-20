import { describe, expect, it } from "vitest";
import type {
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import { ownerThreadActivity } from "./projection.js";

const agent = "a".repeat(64);
const request = "b".repeat(64);
const root = "c".repeat(64);

function item(
  seq: number,
  entry: CommunityAgentTranscriptEntry,
  requestId = request,
  threadRootId = root,
): CommunityAgentActivityItem {
  return {
    id: `event-${seq}`,
    agentPubkey: agent,
    createdAt: 1_700_000_000 + seq,
    frame: {
      version: 2,
      seq,
      sessionId: "session",
      turnId: "turn",
      channelId: "room",
      timestamp: new Date((1_700_000_000 + seq) * 1_000).toISOString(),
      kind: `${entry.type}_update`,
      payload: {
        lifecycleRequestId: `agent-id:${requestId}`,
        scopeKey: `relay/room/agent/thread/${threadRootId}`,
        threadRootId,
        entry,
      },
    },
  };
}

describe("owner thread activity", () => {
  it("keeps exact private progress and omits unrelated or source-backed messages", () => {
    const thinking = item(1, {
      id: "thinking",
      type: "thinking",
      text: "Inspecting README",
      state: "streaming",
      createdAt: "2026-09-20T12:00:01.000Z",
    });
    const tool = item(2, {
      id: "tool",
      type: "tool",
      toolId: "read",
      name: "Read file",
      state: "completed",
      output: "README",
      createdAt: "2026-09-20T12:00:02.000Z",
    });
    const sourceMessage = item(3, {
      id: "reply",
      type: "message",
      role: "assistant",
      authorPubkey: agent,
      text: "Already a normal thread reply",
      sourceEventId: "d".repeat(64),
      createdAt: "2026-09-20T12:00:03.000Z",
    });
    const unrelated = item(
      4,
      {
        id: "other",
        type: "thinking",
        text: "Another request",
        state: "streaming",
        createdAt: "2026-09-20T12:00:04.000Z",
      },
      "e".repeat(64),
    );
    const otherThread = item(
      5,
      {
        id: "other-thread",
        type: "thinking",
        text: "Another thread",
        state: "streaming",
        createdAt: "2026-09-20T12:00:05.000Z",
      },
      request,
      "f".repeat(64),
    );

    expect(
      ownerThreadActivity(
        [otherThread, unrelated, sourceMessage, tool, thinking],
        { kind: "thread", channelId: "room", threadRootId: root },
        request,
      ).map((activity) => activity.id),
    ).toEqual(["event-2", "event-1"]);
  });
});
