import { describe, expect, it } from "vitest";
import type {
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import { agentTranscriptTimeline, pendingTranscriptStatuses } from "./model.js";

const agent = "a".repeat(64);
const time = "2026-09-19T00:00:00.000Z";
function frame(
  seq: number,
  entry: CommunityAgentTranscriptEntry,
  run = "run",
): CommunityAgentActivityItem {
  return {
    id: `event-${seq}`,
    agentPubkey: agent,
    createdAt: seq,
    frame: {
      version: 2,
      seq,
      timestamp: time,
      kind: `${entry.type}_update`,
      channelId: "general",
      turnId: run,
      payload: { scopeKey: "group/general", entry },
    },
  };
}
const thought = (id: string): CommunityAgentTranscriptEntry => ({
  id,
  type: "thinking",
  state: "streaming",
  text: "Inspecting",
  createdAt: time,
});
const tool = (
  patch: Partial<Extract<CommunityAgentTranscriptEntry, { type: "tool" }>> = {},
): CommunityAgentTranscriptEntry => ({
  id: "run:tool:read",
  toolId: "read",
  type: "tool",
  name: "Read",
  state: "running",
  createdAt: time,
  ...patch,
});
const turn = (
  state: "started" | "completed" | "failed" | "cancelled",
): CommunityAgentTranscriptEntry => ({
  id: "run:turn",
  type: "turn",
  state,
  createdAt: time,
});
const timeline = (events: CommunityAgentActivityItem[]) =>
  agentTranscriptTimeline(events, agent, undefined);

describe("agent activity completion", () => {
  it.each(["completed", "failed", "cancelled"] as const)(
    "finishes every thought when an existing turn becomes %s, isolating other turns",
    (state) => {
      const events = [
        frame(1, turn("started")),
        frame(2, thought("first")),
        frame(3, thought("second")),
        frame(4, thought("other"), "other"),
        frame(5, turn(state)),
      ];
      expect(
        timeline(events)
          .filter((e) => e.kind === "thinking")
          .map((e) => e.item.state),
      ).toEqual(["done", "done", "streaming"]);
      expect(pendingTranscriptStatuses(events, agent)).toEqual([]);
      expect(
        (events[1]!.frame.payload as { entry: { state: string } }).entry.state,
      ).toBe("streaming");
    },
  );
  it("finishes a reasoning phase on tool output without ending the active request", () => {
    const events = [
      frame(1, turn("started")),
      frame(2, thought("first")),
      frame(3, tool()),
    ];
    expect(timeline(events)[1]).toMatchObject({
      kind: "thinking",
      item: { state: "done" },
    });
    expect(pendingTranscriptStatuses(events, agent)).toEqual([
      { id: "run", text: "Working" },
    ]);
  });
  it("resolves result-only tool updates and never restarts their spinner on metadata or replay", () => {
    const result = frame(2, tool({ output: "" }));
    expect(
      timeline([
        frame(3, tool({ name: "Read README" })),
        result,
        frame(1, tool({ input: "README" })),
        result,
      ])[0],
    ).toMatchObject({
      kind: "tools",
      items: [
        {
          state: "completed",
          input: "README",
          output: "",
          name: "Read README",
        },
      ],
    });
    expect(
      timeline([
        frame(1, tool({ output: "failed", error: "Permission denied" })),
      ])[0],
    ).toMatchObject({ kind: "tools", items: [{ state: "error" }] });
  });
  it("does not report an unfinished tool as successful when its turn ends", () => {
    expect(
      timeline([frame(1, tool()), frame(2, turn("cancelled"))])[0],
    ).toMatchObject({
      kind: "tools",
      items: [
        {
          state: "error",
          error: "The turn ended before a tool result was received.",
        },
      ],
    });
  });
  it("does not append replayed text twice or revive completed requests", () => {
    const thinking = frame(2, thought("first"));
    const events = [
      frame(1, turn("started")),
      thinking,
      frame(3, turn("completed")),
      thinking,
      frame(4, turn("started")),
    ];
    expect(timeline(events)[1]).toMatchObject({
      kind: "thinking",
      item: { text: "Inspecting", state: "done" },
    });
    expect(timeline(events)[0]).toMatchObject({
      kind: "turn",
      item: { state: "completed" },
    });
    expect(pendingTranscriptStatuses(events, agent)).toEqual([]);
  });
});
