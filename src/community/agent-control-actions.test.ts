import { expect, it, vi } from "vitest";
import { agentControlActions } from "./agent-control-actions.js";
import type { CommunityAgentsActions } from "./agent-contracts.js";
import { validateAgentControl } from "./agent-control-validation.js";

it("preserves the exact displayed target across the application operation boundary", async () => {
  const target = { requestId: "request", sessionId: "session", turnId: "turn" };
  const actions = {
    continueTurn: vi.fn(),
    cancelTurn: vi.fn(),
    resetConversation: vi.fn(),
  } as unknown as CommunityAgentsActions;
  const forwarded = agentControlActions(
    () => actions,
    async (_key, operation) => operation(),
  );
  await forwarded.continueTurn("agent", "scope", target);
  await forwarded.cancelTurn("agent", "scope", "channel", target);
  await forwarded.resetConversation("agent", "scope", "channel", target);
  expect(actions.continueTurn).toHaveBeenCalledWith("agent", "scope", target);
  expect(actions.cancelTurn).toHaveBeenCalledWith(
    "agent",
    "scope",
    "channel",
    target,
  );
  expect(actions.resetConversation).toHaveBeenCalledWith(
    "agent",
    "scope",
    "channel",
    target,
  );
});
it("validates the exact version-2 continuation envelope before signing", () => {
  const control = {
    version: 2 as const,
    command: "continue_turn" as const,
    requestId: "control",
    targetRequestId: "original",
    scopeKey: "scope",
    expectedSessionId: "session",
    expectedTurnId: "turn",
  };
  expect(() => validateAgentControl(control)).not.toThrow();
  for (const changed of [
    { version: 1 },
    { channelId: "channel" },
    { targetRequestId: "" },
    { expectedSessionId: "" },
    { expectedTurnId: "" },
    { scopeKey: "" },
  ])
    expect(() =>
      validateAgentControl({ ...control, ...changed } as typeof control),
    ).toThrow();
});
