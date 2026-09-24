import { describe, expect, it } from "vitest";
import type { CommunityAgentObserver } from "./agent-contracts.js";
import {
  controllerPermission,
  applyPermissionCards,
  replaceScopePendingPermissions,
  snapshotPermissionRequests,
} from "./activity-sync-permissions.js";

const agent = "a".repeat(64);
const scopeKey = "relay/general/agent/thread/root";

function observer(
  kind: string,
  payload: Record<string, unknown>,
  seq = 1,
): CommunityAgentObserver {
  return {
    version: 2,
    seq,
    timestamp: new Date(1_800_000_000_000).toISOString(),
    kind,
    channelId: "general",
    sessionId: "session",
    turnId: "turn",
    payload,
  };
}

const permissionFrame = observer(
  "permission_requested",
  {
    scopeKey,
    requestId: "permission-1",
    tool: "Read",
    input: { path: "README.md" },
    options: ["allow_once", "reject_once"],
    expiresAt: 1_800_060_000_000,
  },
  5,
);

const waitingStatus = observer(
  "request_status",
  {
    scopeKey,
    lifecycleRequestId: "request-1",
    state: "waiting_permission",
  },
  8,
);

describe("activity-sync-permissions", () => {
  it("reads offered decisions from a permission snapshot", () => {
    expect(
      controllerPermission(
        agent,
        permissionFrame,
        permissionFrame.payload as Record<string, unknown>,
      ),
    ).toMatchObject({
      requestId: "permission-1",
      tool: "Read",
      options: ["allow_once", "reject_once"],
    });
  });

  it("keeps snapshot permission cards after live telemetry already applied them", () => {
    const live = snapshotPermissionRequests(agent, [permissionFrame]);
    expect(
      replaceScopePendingPermissions(
        { [agent]: live },
        agent,
        scopeKey,
        snapshotPermissionRequests(agent, [permissionFrame, waitingStatus]),
      )[agent],
    ).toEqual(live);
  });

  it("omits expired snapshot permission frames", () => {
    const expired = observer(
      "permission_requested",
      {
        scopeKey,
        requestId: "permission-expired",
        tool: "Read",
        options: ["allow_once"],
        expiresAt: 1_800_000_000_000,
      },
      6,
    );
    expect(
      snapshotPermissionRequests(agent, [expired], 1_800_000_000_001),
    ).toEqual([]);
    expect(
      replaceScopePendingPermissions(
        { [agent]: snapshotPermissionRequests(agent, [permissionFrame]) },
        agent,
        scopeKey,
        snapshotPermissionRequests(agent, [expired], 1_800_000_000_001),
      )[agent],
    ).toEqual([]);
  });

  it("clears a scope when the snapshot has no pending permission frames", () => {
    const live = snapshotPermissionRequests(agent, [permissionFrame]);
    expect(
      replaceScopePendingPermissions(
        { [agent]: live },
        agent,
        scopeKey,
        snapshotPermissionRequests(agent, [waitingStatus]),
      )[agent],
    ).toEqual([]);
  });
});

describe("permission settlement replay", () => {
  it.each([
    "permission_resolved",
    "permission_expired",
    "permission_cancelled",
  ])("removes %s from live and snapshot cards", (kind) => {
    const settled = observer(kind, { scopeKey, requestId: "permission-1" }, 9);
    const pending = snapshotPermissionRequests(agent, [permissionFrame]);
    expect(
      applyPermissionCards(
        { [agent]: pending },
        agent,
        settled,
        1_800_000_000_000,
      )?.[agent],
    ).toEqual([]);
    expect(
      snapshotPermissionRequests(agent, [permissionFrame, settled]),
    ).toEqual([]);
  });
  it("does not settle a different session sharing a turn id", () => {
    const pending = snapshotPermissionRequests(agent, [permissionFrame]);
    const terminal = {
      ...observer("turn_finished", { scopeKey }),
      sessionId: "other",
    };
    expect(
      applyPermissionCards(
        { [agent]: pending },
        agent,
        terminal,
        1_800_000_000_000,
      )?.[agent],
    ).toEqual(pending);
  });
});

it("does not resurrect a settled snapshot request from later stale output", () => {
  const settled = observer(
    "permission_resolved",
    { scopeKey, requestId: "permission-1" },
    9,
  );
  expect(
    snapshotPermissionRequests(agent, [
      permissionFrame,
      settled,
      { ...permissionFrame, seq: 10 },
    ]),
  ).toEqual([]);
});
