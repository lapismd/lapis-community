import { describe, expect, it } from "vitest";
import { sweepExpiredPermissionState } from "./permission-expiry.js";

const agent = "a".repeat(64);
const scopeKey = "relay/general/agent/thread/root";

describe("permission-expiry", () => {
  it("drops expired cards and keeps the turn running", () => {
    const patch = sweepExpiredPermissionState(
      {
        pendingPermissions: {
          [agent]: [
            {
              agentPubkey: agent,
              requestId: "permission-1",
              scopeKey,
              tool: "shell",
              options: ["allow_once"],
              expiresAt: 10,
            },
          ],
        },
        controllerScopes: {
          [agent]: {
            agentPubkey: agent,
            scopeKey,
            active: true,
            state: "waiting_permission",
            preview: "Waiting for your permission",
            updatedAt: 1,
          },
        },
        conversationScopes: {
          [`${agent}:${scopeKey}`]: {
            agentPubkey: agent,
            scopeKey,
            active: true,
            state: "waiting_permission",
            updatedAt: 1,
          },
        },
      },
      10,
    );
    expect(patch?.pendingPermissions[agent]).toEqual([]);
    expect(patch?.controllerScopes[agent]).toMatchObject({
      active: true, state: "running",
      preview: "Permission expired. The agent is continuing.",
    });
  });

  it("keeps live cards and waiting scopes", () => {
    expect(
      sweepExpiredPermissionState(
        {
          pendingPermissions: {
            [agent]: [
              {
                agentPubkey: agent,
                requestId: "permission-1",
                scopeKey,
                tool: "shell",
                options: ["allow_once"],
                expiresAt: 11,
              },
            ],
          },
          controllerScopes: {
            [agent]: {
              agentPubkey: agent,
              scopeKey,
              active: true,
              state: "waiting_permission",
              updatedAt: 1,
            },
          },
        },
        10,
      ),
    ).toBeUndefined();
  });
});
