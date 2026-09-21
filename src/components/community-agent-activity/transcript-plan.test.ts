import { describe, expect, it } from "vitest";
import type {
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import { agentTranscriptTimeline } from "./model.js";
import { transcriptEntry } from "./transcript-entry.js";

const agent = "a".repeat(64);

function activity(
  seq: number,
  entry: CommunityAgentTranscriptEntry,
): CommunityAgentActivityItem {
  return {
    id: `event-${seq}`,
    agentPubkey: agent,
    createdAt: 1_000 + seq,
    frame: {
      version: 2,
      seq,
      turnId: "turn",
      timestamp: new Date((1_000 + seq) * 1_000).toISOString(),
      kind: "plan_updated",
      channelId: "general",
      payload: { scopeKey: "group/general", entry },
    },
  };
}

describe("transcript plan records", () => {
  it("keeps plan entries and accepts plan_entries", () => {
    expect(
      transcriptEntry({
        id: "run:plan",
        type: "plan",
        plan_entries: [
          {
            content: "Inspect README",
            status: "in_progress",
            priority: "high",
          },
        ],
        createdAt: new Date(1_001_000).toISOString(),
      }),
    ).toEqual({
      id: "run:plan",
      type: "plan",
      entries: [
        { content: "Inspect README", status: "in_progress", priority: "high" },
      ],
      createdAt: new Date(1_001_000).toISOString(),
    });
  });

  it("replaces the live list in place and clears an empty snapshot", () => {
    const first = activity(1, {
      id: "run:plan",
      type: "plan",
      entries: [
        { content: "Inspect README", status: "pending" },
        { content: "Write the guide", status: "pending" },
      ],
      createdAt: new Date(1_001_000).toISOString(),
    });
    const second = activity(2, {
      id: "run:plan",
      type: "plan",
      entries: [{ content: "Inspect README", status: "completed" }],
      createdAt: new Date(1_002_000).toISOString(),
    });
    const cleared = activity(3, {
      id: "run:plan",
      type: "plan",
      entries: [],
      createdAt: new Date(1_003_000).toISOString(),
    });
    expect(
      agentTranscriptTimeline([first, second], agent, {
        kind: "channel",
        channelId: "general",
      }),
    ).toEqual([
      {
        kind: "plan",
        item: {
          id: "run:plan",
          type: "plan",
          entries: [{ content: "Inspect README", status: "completed" }],
          createdAt: new Date(1_002_000).toISOString(),
          sequence: 2,
        },
      },
    ]);
    expect(
      agentTranscriptTimeline([first, second, cleared], agent, {
        kind: "channel",
        channelId: "general",
      }),
    ).toEqual([]);
  });
});
