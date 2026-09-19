import { describe, expect, it } from "vitest";
import type {
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import { agentTranscriptTimeline, pendingTranscriptStatuses } from "./model.js";

const agent = "a".repeat(64);
const owner = "b".repeat(64);

function activity(
  seq: number,
  entry: CommunityAgentTranscriptEntry,
  patch: Partial<CommunityAgentActivityItem["frame"]> = {},
): CommunityAgentActivityItem {
  return {
    id: `event-${seq}`,
    agentPubkey: agent,
    createdAt: 1_000 + seq,
    frame: {
      version: 2,
      seq,
      timestamp: new Date((1_000 + seq) * 1_000).toISOString(),
      kind: `${entry.type}_update`,
      channelId: "general",
      payload: { scopeKey: "group/general", entry },
      ...patch,
    },
  };
}

describe("agent transcript timeline", () => {
  it("shows cold-start progress until output or termination in the same request", () => {
    const status = (seq: number, state: string, preview: string) => ({
      id: `status-${seq}`,
      agentPubkey: agent,
      createdAt: 1000 + seq,
      frame: {
        version: 2 as const,
        seq,
        kind: "request_status",
        channelId: "general",
        timestamp: new Date((1000 + seq) * 1000).toISOString(),
        payload: { lifecycleRequestId: "request", state, preview },
      },
    });
    const queued = status(1, "queued", "Queued");
    const starting = status(2, "starting", "Starting");
    expect(pendingTranscriptStatuses([starting, queued], agent)).toEqual([
      { id: "request", text: "Starting" },
    ]);
    expect(
      pendingTranscriptStatuses([starting], agent, {
        kind: "channel",
        channelId: "other",
      }),
    ).toEqual([]);
    const output = activity(3, {
      id: "message",
      type: "message",
      role: "assistant",
      authorPubkey: agent,
      text: "Ready",
      createdAt: new Date(1003000).toISOString(),
    });
    output.frame.payload = {
      ...output.frame.payload,
      lifecycleRequestId: "request",
    };
    expect(
      pendingTranscriptStatuses(
        [queued, starting, output, status(4, "running", "Working")],
        agent,
      ),
    ).toEqual([]);
    expect(
      pendingTranscriptStatuses(
        [queued, starting, status(5, "failed", "Failed")],
        agent,
      ),
    ).toEqual([]);
  });
  it("merges message chunks and tool updates in signed sequence order", () => {
    const values = [
      activity(4, {
        id: "run:tool:read",
        type: "tool",
        toolId: "read",
        name: "Read file",
        state: "completed",
        output: "done",
        createdAt: new Date(1_004_000).toISOString(),
      }),
      activity(2, {
        id: "run:assistant",
        type: "message",
        role: "assistant",
        text: "world",
        authorPubkey: agent,
        createdAt: new Date(1_002_000).toISOString(),
      }),
      activity(1, {
        id: "run:assistant",
        type: "message",
        role: "assistant",
        text: "Hello ",
        authorPubkey: agent,
        createdAt: new Date(1_001_000).toISOString(),
      }),
      activity(3, {
        id: "run:tool:read",
        type: "tool",
        toolId: "read",
        name: "Read file",
        state: "running",
        input: '{"path":"a.md"}',
        createdAt: new Date(1_003_000).toISOString(),
      }),
    ];

    const timeline = agentTranscriptTimeline(values, agent, {
      kind: "channel",
      channelId: "general",
    });
    expect(timeline[0]).toMatchObject({
      kind: "message",
      item: { text: "Hello world" },
    });
    expect(timeline[1]).toMatchObject({
      kind: "tools",
      items: [{ input: '{"path":"a.md"}', output: "done", state: "completed" }],
    });
  });

  it("keeps original user attribution and completes thinking at turn end", () => {
    const timeline = agentTranscriptTimeline(
      [
        activity(1, {
          id: "request",
          type: "message",
          role: "user",
          text: "Please investigate",
          authorPubkey: owner,
          sourceEventId: "c".repeat(64),
          createdAt: new Date(1_001_000).toISOString(),
        }),
        activity(2, {
          id: "run:thinking",
          type: "thinking",
          text: "Checking",
          state: "streaming",
          createdAt: new Date(1_002_000).toISOString(),
        }),
        activity(3, {
          id: "run:turn",
          type: "turn",
          state: "completed",
          createdAt: new Date(1_003_000).toISOString(),
        }),
      ],
      agent,
      { kind: "channel", channelId: "general" },
    );
    expect(timeline[0]).toMatchObject({
      kind: "message",
      item: { authorPubkey: owner, sourceEventId: "c".repeat(64) },
    });
    expect(timeline[1]).toMatchObject({
      kind: "thinking",
      item: { state: "done" },
    });
  });

  it("drops legacy and malformed records and filters exact contexts", () => {
    const valid = activity(1, {
      id: "request",
      type: "message",
      role: "user",
      text: "Hello",
      authorPubkey: owner,
      createdAt: new Date(1_001_000).toISOString(),
    });
    const legacy = {
      ...valid,
      id: "legacy",
      frame: { ...valid.frame, version: 1 as never },
    };
    const malformed = {
      ...valid,
      id: "malformed",
      frame: { ...valid.frame, payload: { entry: { id: "bad" } } },
    };
    expect(
      agentTranscriptTimeline([legacy, malformed, valid], agent, {
        kind: "channel",
        channelId: "general",
      }),
    ).toHaveLength(1);
    expect(
      agentTranscriptTimeline([valid], agent, {
        kind: "channel",
        channelId: "other",
      }),
    ).toEqual([]);
  });
});
