import { describe, expect, it } from "vitest";
import { projectActivityScope } from "./activity-scope-projection.js";
import type {
  CommunityAgentObserver,
  CommunityAgentPermissionRequest,
} from "./agent-contracts.js";

const frame: CommunityAgentObserver = {
  version: 2,
  seq: 1,
  timestamp: new Date(1000).toISOString(),
  kind: "request_status",
  sessionId: "session",
  turnId: "turn",
  payload: {
    scopeKey: "scope",
    lifecycleRequestId: "request",
    state: "running",
  },
};
const permission = (requestId: string): CommunityAgentPermissionRequest => ({
  agentPubkey: "agent",
  requestId,
  scopeKey: "scope",
  tool: "shell",
  sessionId: "session",
  turnId: "turn",
  options: ["allow_once"],
  expiresAt: 2000,
});

describe("signed activity scope projection", () => {
  it("preserves waiting while another approval on this exact turn remains", () => {
    const settled = { ...frame, kind: "permission_resolved" };
    expect(
      projectActivityScope(
        "agent",
        settled,
        undefined,
        [permission("second")],
        1000,
      )?.state,
    ).toBe("waiting_permission");
    expect(
      projectActivityScope(
        "agent",
        settled,
        undefined,
        [{ ...permission("other"), turnId: "other" }],
        1000,
      )?.state,
    ).toBe("running");
  });
  it.each(["completed", "failed", "cancelled", "interrupted", "uncertain"])(
    "never resurrects %s from later output",
    (state) => {
      const previous = projectActivityScope(
        "agent",
        {
          ...frame,
          kind: "turn_finished",
          payload: { ...(frame.payload as object), state },
        },
        undefined,
        [],
        1000,
      );
      expect(projectActivityScope("agent", frame, previous, [], 1000)).toEqual(
        previous,
      );
    },
  );
  it("projects expired waiting snapshots as unknown rather than resumed", () => {
    expect(
      projectActivityScope(
        "agent",
        {
          ...frame,
          payload: {
            ...(frame.payload as object),
            state: "waiting_permission",
          },
        },
        undefined,
        [permission("expired")],
        3000,
      )?.state,
    ).toBe("unknown");
  });
});
