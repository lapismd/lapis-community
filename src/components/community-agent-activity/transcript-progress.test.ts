import { describe, expect, it } from "vitest";
import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
import { pendingTranscriptStatuses } from "./transcript-progress.js";

const agent = "a".repeat(64);

describe("pending transcript permission waits", () => {
  it("hides an expired or stale permission wait", () => {
    const now = 1_800_000_180_000;
    const waiting: CommunityAgentActivityItem = {
      id: "wait",
      agentPubkey: agent,
      createdAt: 1_800_000_000,
      frame: {
        version: 2,
        seq: 2,
        kind: "request_status",
        channelId: "general",
        turnId: "turn",
        timestamp: new Date(now).toISOString(),
        payload: {
          lifecycleRequestId: "request",
          state: "waiting_permission",
          preview: "Waiting for your permission",
        },
      },
    };
    const expiredPermission = {
      ...waiting,
      id: "permission",
      createdAt: 1_800_000_000,
      frame: {
        ...waiting.frame,
        seq: 1,
        kind: "permission_requested",
        payload: {
          requestId: "permission-1",
          scopeKey: "group/general",
          tool: "Read",
          options: ["allow_once"],
          expiresAt: now - 1,
        },
      },
    } satisfies CommunityAgentActivityItem;
    expect(
      pendingTranscriptStatuses(
        [expiredPermission, waiting],
        agent,
        undefined,
        now,
      ),
    ).toEqual([]);
    expect(pendingTranscriptStatuses([waiting], agent, undefined, now)).toEqual(
      [],
    );
    expect(
      pendingTranscriptStatuses(
        [
          {
            ...expiredPermission,
            frame: {
              ...expiredPermission.frame,
              payload: {
                ...expiredPermission.frame.payload,
                expiresAt: now + 60_000,
              },
            },
          },
          waiting,
        ],
        agent,
        undefined,
        now,
      ),
    ).toEqual([
      { id: "request", text: "Waiting for your permission", streaming: false },
    ]);
  });
});
