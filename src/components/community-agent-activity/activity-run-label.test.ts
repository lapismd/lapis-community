import { describe, expect, it } from "vitest";
import {
  activityCancelTarget,
  activityControlHeading,
  activityControlRows,
  activityRunLabel,
  activityStreams,
  activityShowsReset,
} from "./activity-run-label.js";
import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";

const agent = "a".repeat(64);

function scope(
  patch: Partial<CommunityAgentControllerScope>,
): CommunityAgentControllerScope {
  return {
    agentPubkey: agent,
    scopeKey: "relay/room/agent/channel",
    active: true,
    state: "queued",
    sessionId: "session",
    turnId: "turn",
    ...patch,
  };
}

describe("activity run labels", () => {
  it("labels queued work and an interrupted run that blocks the workspace", () => {
    const rows = [
      scope({
        state: "queued",
        turnId: "queued-run",
        channelId: "room",
        conversationKind: "channel",
      }),
      scope({
        state: "interrupted",
        scopeKey: "relay/room/agent/thread/root",
        sessionId: "thread-session",
        turnId: "fence-run",
        channelId: "room",
        conversationKind: "thread",
        threadRootId: "root",
      }),
    ];
    expect(rows.map((row) => activityControlHeading(row))).toEqual([
      "Channel · Queued",
      "Channel · Thread · Interrupted. This run is blocking later requests in the workspace.",
    ]);
    expect(rows.map((row) => activityRunLabel(row.state))).toEqual([
      "Queued",
      "Interrupted. This run is blocking later requests in the workspace.",
    ]);
    expect(activityRunLabel("interrupted", "Permission request expired")).toBe(
      "Interrupted. Permission request expired. This run is blocking later requests in the workspace.",
    );
    expect(
      activityRunLabel(
        "interrupted",
        "Blocking later requests in this workspace",
      ),
    ).toBe(
      "Interrupted. This run is blocking later requests in the workspace.",
    );
    expect(activityControlRows([...rows, rows[0]!])).toEqual(rows);
    expect(
      rows.map((row) =>
        activityShowsReset(row, rows, { kind: "channel", channelId: "room" }),
      ),
    ).toEqual([true, false]);
    expect(rows.map((row) => activityCancelTarget(row))).toEqual([
      {
        scopeKey: "relay/room/agent/channel",
        channelId: "room",
        sessionId: "session",
        turnId: "queued-run",
      },
      {
        scopeKey: "relay/room/agent/thread/root",
        channelId: "room",
        sessionId: "thread-session",
        turnId: "fence-run",
      },
    ]);
  });
});

describe("turn lifecycle labels", () => {
  it.each([
    ["completed", "Completed"],
    ["failed", "Failed"],
    ["cancelled", "Cancelled"],
    ["uncertain", "Outcome uncertain"],
    ["unknown", "Status unavailable"],
    ["waiting_input", "Waiting for your answer"],
    ["waiting_permission", "Waiting for your permission"],
  ])("labels %s without animating", (state, label) => {
    expect(activityRunLabel(state)).toBe(label);
    expect(activityStreams(state)).toBe(false);
  });
  it("animates only confirmed running work", () => {
    expect(activityStreams("running")).toBe(true);
    for (const state of [undefined, "starting", "queued", "future-state"])
      expect(activityStreams(state)).toBe(false);
  });
});
