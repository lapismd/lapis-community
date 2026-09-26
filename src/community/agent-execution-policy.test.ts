import { expect, it } from "vitest";
import { projectActivityScope } from "./activity-scope-state.js";
import { parseExecutionPolicy } from "./agent-execution-policy.js";
import type { CommunityAgentObserver } from "./agent-contracts.js";

const policy = {
  requested: "allow-all",
  effective: "ask",
  restricted: true,
  nativeMode: { requested: "bypass", status: "rejected" },
} as const;
it("retains actual execution policy through terminal scope snapshots", () => {
  const frame: CommunityAgentObserver = {
    version: 2,
    seq: 1,
    timestamp: new Date(1000).toISOString(),
    kind: "runtime_policy",
    sessionId: "session",
    turnId: "turn",
    payload: {
      scopeKey: "scope",
      lifecycleRequestId: "request",
      executionPolicy: policy,
    },
  };
  const projected = projectActivityScope("agent", frame, undefined, [], 1000);
  expect(projected).toMatchObject({ executionPolicy: policy });
  expect(
    projectActivityScope(
      "agent",
      {
        ...frame,
        kind: "turn_finished",
        payload: {
          scopeKey: "scope",
          lifecycleRequestId: "request",
          state: "failed",
        },
      },
      projected,
      [],
      1000,
    ),
  ).toMatchObject({ state: "failed", executionPolicy: policy });
});
it.each(["applied", "unsupported", "rejected", "unreported"])(
  "preserves native %s without inventing applied state",
  (status) => {
    const parsed = parseExecutionPolicy({
      ...policy,
      nativeMode: { requested: "bypass", status, effective: "bypass" },
    });
    expect(parsed?.nativeMode).toEqual({
      requested: "bypass",
      status,
      ...(status === "applied" ? { effective: "bypass" } : {}),
    });
  },
);
it("rejects impossible restricted allow-all and unrecognized native status", () => {
  expect(
    parseExecutionPolicy({ ...policy, effective: "allow-all" }),
  ).toBeUndefined();
  expect(
    parseExecutionPolicy({
      ...policy,
      nativeMode: { requested: "bypass", status: "unknown" },
    }),
  ).toBeUndefined();
});

it("accepts a late policy report without resurrecting terminal execution", () => {
  const frame: CommunityAgentObserver = {
    version: 2,
    seq: 1,
    timestamp: new Date(1000).toISOString(),
    kind: "turn_failed",
    sessionId: "session",
    turnId: "turn",
    payload: { scopeKey: "scope", lifecycleRequestId: "request" },
  };
  const ended = projectActivityScope("agent", frame, undefined, [], 1000);
  expect(
    projectActivityScope(
      "agent",
      {
        ...frame,
        kind: "runtime_policy",
        payload: { ...(frame.payload as object), executionPolicy: policy },
      },
      ended,
      [],
      1000,
    ),
  ).toMatchObject({ state: "failed", active: false, executionPolicy: policy });
});
