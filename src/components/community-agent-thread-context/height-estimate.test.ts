import { describe, expect, it } from "vitest";
import type {
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import { estimateAgentTranscriptHeight } from "./height-estimate.js";

const agent = "a".repeat(64);

function activity(
  sequence: number,
  entry: CommunityAgentTranscriptEntry,
): CommunityAgentActivityItem {
  return {
    id: `event-${sequence}`,
    agentPubkey: agent,
    createdAt: 1_800_000_000 + sequence,
    frame: {
      version: 2,
      seq: sequence,
      sessionId: "session",
      turnId: "turn",
      channelId: "room",
      timestamp: entry.createdAt,
      kind: `${entry.type}_update`,
      payload: { entry },
    },
  };
}

const createdAt = "2027-01-15T08:00:00.000Z";
const tool = (sequence: number): CommunityAgentTranscriptEntry => ({
  id: `tool-${sequence}`,
  type: "tool",
  toolId: `tool-${sequence}`,
  name: "Read file",
  state: "completed",
  output: "README",
  createdAt,
});
const thinking = (sequence: number): CommunityAgentTranscriptEntry => ({
  id: `thinking-${sequence}`,
  type: "thinking",
  text: "Inspecting the repository",
  state: "done",
  createdAt,
});
const permission = (sequence: number): CommunityAgentTranscriptEntry => ({
  id: `permission-${sequence}`,
  type: "permission",
  requestId: `permission-${sequence}`,
  tool: "Read file",
  options: ["allow-once"],
  state: "resolved",
  createdAt,
});

describe("agent transcript height estimate", () => {
  it("matches the collapsed geometry of a tool-heavy transcript", () => {
    const entries = [
      tool(1),
      tool(2),
      thinking(3),
      tool(4),
      permission(5),
      tool(6),
      thinking(7),
      permission(8),
      tool(9),
      thinking(10),
      permission(11),
      thinking(12),
      tool(13),
    ];

    expect(
      estimateAgentTranscriptHeight(
        entries.map((entry, index) => activity(index + 1, entry)),
        agent,
      ),
    ).toBe(480);
  });

  it("does not reserve space for transcript entries that render no row", () => {
    expect(
      estimateAgentTranscriptHeight(
        [
          activity(1, {
            id: "pending",
            type: "permission",
            requestId: "pending",
            tool: "Write file",
            options: ["allow-once"],
            state: "pending",
            createdAt,
          }),
        ],
        agent,
      ),
    ).toBe(0);
  });
});
