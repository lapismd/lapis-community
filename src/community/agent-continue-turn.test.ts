import { afterEach, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { createCommunityAgentsController } from "./agent-controller.js";
import { materializeAgentDirectory } from "./agent-protocol.js";
import type {
  CommunityAgentSession,
  CommunityAgentObserver,
} from "./agent-contracts.js";

const ownerKey = new Uint8Array(32).fill(71);
const agentKey = new Uint8Array(32).fill(72);
const relayKey = new Uint8Array(32).fill(73);
const owner = getPublicKey(ownerKey),
  agent = getPublicKey(agentKey),
  relay = getPublicKey(relayKey);
const now = 1800000000;
const profile = finalizeEvent(
  {
    kind: 0,
    created_at: now,
    tags: [["lapis-managed", owner, relay]],
    content: '{"name":"Test agent"}',
  },
  agentKey,
);
const instance = finalizeEvent(
  {
    kind: 30177,
    created_at: now,
    tags: [["d", agent]],
    content: '{"name":"Test agent"}',
  },
  ownerKey,
);
const channel = finalizeEvent(
  {
    kind: 39002,
    created_at: now,
    tags: [
      ["d", "general"],
      ["p", owner],
      ["p", agent],
    ],
    content: "",
  },
  relayKey,
);
const events = [profile, instance, channel];
const key = nip44.v2.utils.getConversationKey(agentKey, owner);
const disposers: Array<() => void> = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
});

async function setup() {
  let receive = (_event: ReturnType<typeof finalizeEvent>) => {};
  const sendControl = vi.fn<NonNullable<CommunityAgentSession["sendControl"]>>(
    async () => profile,
  );
  const session = {
    loadDirectory: async () => ({
      agents: materializeAgentDirectory(events, owner, relay),
      personas: [],
      events,
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    }),
    loadPresence: async () => [],
    subscribe: async (
      _keys: unknown,
      handlers: { onevent: typeof receive },
    ) => {
      receive = handlers.onevent;
      return { close() {} };
    },
    sendControl,
  } as unknown as CommunityAgentSession;
  const controller = createCommunityAgentsController({
    scope: {
      communityId: "test",
      relayUrls: ["wss://relay.example/"],
      ownerPubkey: owner,
    },
    session,
    identity: {
      getPublicKey: async () => owner,
      signEvent: async () => profile,
      nip44: {
        encrypt: async () => "",
        decrypt: async (_key, ciphertext) => nip44.v2.decrypt(ciphertext, key),
      },
    },
    storageMode: () => "memory",
    onState: () => {},
    now: () => now,
  });
  disposers.push(() => controller.dispose());
  await controller.start();
  let seq = 0;
  async function frame(
    kind: string,
    payload: Record<string, unknown>,
    sessionId = "session",
    turnId = "turn",
  ) {
    const data: CommunityAgentObserver = {
      version: 2,
      seq: ++seq,
      timestamp: new Date(now * 1000).toISOString(),
      kind,
      sessionId,
      turnId,
      channelId: "general",
      payload,
    };
    receive(
      finalizeEvent(
        {
          kind: 24200,
          created_at: now,
          tags: [
            ["p", owner],
            ["agent", agent],
            ["frame", "telemetry"],
            ["h", "general"],
          ],
          content: nip44.v2.encrypt(JSON.stringify(data), key),
        },
        agentKey,
      ),
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const target = { requestId: "request", sessionId: "session", turnId: "turn" };
  async function stopped(
    state = "failed",
    scopeKey = "scope/original",
    requestId = "request",
    sessionId = "session",
    turnId = "turn",
  ) {
    await frame(
      "request_status",
      { scopeKey, lifecycleRequestId: requestId, state },
      sessionId,
      turnId,
    );
    await vi.waitFor(() =>
      expect(
        Object.values(controller.state.conversationScopes ?? {}).some(
          (scope) => scope.requestId === requestId,
        ),
      ).toBe(true),
    );
  }
  async function acknowledge(control: Record<string, unknown>, extra = {}) {
    await frame("turn_control_state", {
      requestId: control.requestId,
      command: "continue_turn",
      targetRequestId: control.targetRequestId,
      invocationId: "next-attempt",
      sessionId: "session",
      state: "queued",
      ...extra,
    });
  }
  return { controller, sendControl, frame, stopped, acknowledge, target };
}

it("continues the exact stopped attempt after activity in another conversation and awaits its acknowledgement", async () => {
  const { controller, sendControl, stopped, acknowledge, target } =
    await setup();
  await stopped();
  await stopped(
    "running",
    "scope/other",
    "other",
    "another-session",
    "another-turn",
  );
  let settled = false;
  const result = controller.actions
    .continueTurn(agent, "scope/original", target)
    .then(() => {
      settled = true;
    });
  await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(1));
  const control = sendControl.mock.calls[0]![1] as unknown as Record<
    string,
    unknown
  >;
  expect(control).toEqual({
    version: 2,
    command: "continue_turn",
    requestId: expect.any(String),
    targetRequestId: "request",
    scopeKey: "scope/original",
    expectedSessionId: "session",
    expectedTurnId: "turn",
  });
  expect(settled).toBe(false);
  await acknowledge(control);
  await result;
  expect(settled).toBe(true);
  expect(Object.values(controller.state.turnControls ?? {})).toEqual([
    expect.objectContaining({
      status: "acknowledged",
      invocationId: "next-attempt",
    }),
  ]);
});

it("coalesces concurrent clicks and does not dispatch another continuation after acknowledgement", async () => {
  const { controller, sendControl, stopped, acknowledge, target } =
    await setup();
  await stopped();
  const first = controller.actions.continueTurn(
    agent,
    "scope/original",
    target,
  );
  const second = controller.actions.continueTurn(
    agent,
    "scope/original",
    target,
  );
  await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(1));
  await acknowledge(
    sendControl.mock.calls[0]![1] as unknown as Record<string, unknown>,
  );
  await Promise.all([first, second]);
  await controller.actions.continueTurn(agent, "scope/original", target);
  expect(sendControl).toHaveBeenCalledTimes(1);
});

it("does not accept an acknowledgement for another target and surfaces correlated controller errors", async () => {
  const { controller, sendControl, stopped, frame, acknowledge, target } =
    await setup();
  await stopped();
  const result = controller.actions
    .continueTurn(agent, "scope/original", target)
    .catch((error) => error);
  await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(1));
  const control = sendControl.mock.calls[0]![1] as unknown as Record<
    string,
    unknown
  >;
  await acknowledge(control, { targetRequestId: "wrong-request" });
  expect(Object.values(controller.state.turnControls ?? {})[0]?.status).toBe(
    "pending",
  );
  await frame("administration_error", {
    requestId: control.requestId,
    responseKind: "turn_control_state",
    message: "Prior tool outcome needs reconciliation",
  });
  expect((await result).message).toMatch(/reconciliation/);
  expect(Object.values(controller.state.turnControls ?? {})[0]).toMatchObject({
    status: "error",
    message: "Prior tool outcome needs reconciliation",
  });
});

it.each(["running", "waiting_permission", "uncertain", "unknown"])(
  "refuses to blindly continue %s work",
  async (state) => {
    const { controller, sendControl, stopped, target } = await setup();
    await stopped(state);
    await expect(
      controller.actions.continueTurn(agent, "scope/original", target),
    ).rejects.toThrow(/stopped|uncertain|unavailable/i);
    expect(sendControl).not.toHaveBeenCalled();
  },
);

it("rejects a stale request/session/turn selection", async () => {
  const { controller, sendControl, stopped, target } = await setup();
  await stopped();
  await expect(
    controller.actions.continueTurn(agent, "scope/original", {
      ...target,
      requestId: "stale",
    }),
  ).rejects.toThrow(/displayed|stale|available/i);
  expect(sendControl).not.toHaveBeenCalled();
});

it("retries with the same identity after a lost acknowledgement", async () => {
  const { controller, sendControl, stopped, acknowledge, target } =
    await setup();
  await stopped();
  vi.useFakeTimers();
  const first = controller.actions
    .continueTurn(agent, "scope/original", target)
    .catch((error) => error);
  await vi.advanceTimersByTimeAsync(30001);
  expect((await first).message).toMatch(/acknowledge|unconfirmed/i);
  const retry = controller.actions.continueTurn(
    agent,
    "scope/original",
    target,
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(sendControl).toHaveBeenCalledTimes(2);
  expect(sendControl.mock.calls[1]![1]).toEqual(sendControl.mock.calls[0]![1]);
  vi.useRealTimers();
  await acknowledge(
    sendControl.mock.calls[0]![1] as unknown as Record<string, unknown>,
  );
  await retry;
});

it("cancels the selected active turn rather than the most recently updated conversation", async () => {
  const { controller, sendControl, stopped, target } = await setup();
  await stopped("running");
  await stopped(
    "running",
    "scope/other",
    "other",
    "another-session",
    "another-turn",
  );
  await controller.actions.cancelTurn(
    agent,
    "scope/original",
    "general",
    target,
  );
  expect(sendControl).toHaveBeenCalledWith(
    agent,
    expect.objectContaining({
      command: "cancel_turn",
      scopeKey: "scope/original",
      expectedSessionId: "session",
      expectedTurnId: "turn",
    }),
    expect.any(AbortSignal),
  );
});

it("retains one command identity across a page reload", async () => {
  const first = await setup();
  await first.stopped();
  const pending = first.controller.actions
    .continueTurn(agent, "scope/original", first.target)
    .catch((error) => error);
  await vi.waitFor(() => expect(first.sendControl).toHaveBeenCalledTimes(1));
  const control = first.sendControl.mock.calls[0]![1] as unknown as Record<
    string,
    unknown
  >;
  first.controller.dispose();
  await pending;
  const next = await setup();
  await next.stopped();
  const retry = next.controller.actions.continueTurn(
    agent,
    "scope/original",
    next.target,
  );
  await vi.waitFor(() => expect(next.sendControl).toHaveBeenCalledTimes(1));
  expect(next.sendControl.mock.calls[0]![1]).toEqual(control);
  await next.acknowledge(control);
  await retry;
});

it("retains a late failed continuation outcome without accepting another invocation", async () => {
  const { controller, sendControl, stopped, acknowledge, target } =
    await setup();
  await stopped();
  const result = controller.actions.continueTurn(
    agent,
    "scope/original",
    target,
  );
  await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(1));
  const control = sendControl.mock.calls[0]![1] as unknown as Record<
    string,
    unknown
  >;
  await acknowledge(control);
  await result;
  await acknowledge(control, {
    invocationId: "wrong-attempt",
    state: "failed",
    message: "Wrong attempt",
  });
  expect(Object.values(controller.state.turnControls ?? {})[0]?.outcome).toBe(
    "queued",
  );
  await acknowledge(control, {
    state: "failed",
    message: "Capture is unavailable. Open the new attempt for details.",
  });
  expect(Object.values(controller.state.turnControls ?? {})[0]).toMatchObject({
    status: "acknowledged",
    invocationId: "next-attempt",
    outcome: "failed",
    message: "Capture is unavailable. Open the new attempt for details.",
  });
  await acknowledge(control);
  expect(Object.values(controller.state.turnControls ?? {})[0]?.outcome).toBe(
    "failed",
  );
});

it("resets the displayed idle session after multiple historical turns", async () => {
  const { controller, sendControl, stopped, target } = await setup();
  await stopped(
    "completed",
    "scope/original",
    "prior",
    "session",
    "prior-turn",
  );
  await stopped();
  await controller.actions.resetConversation(
    agent,
    "scope/original",
    "general",
    {
      sessionId: target.sessionId,
      turnId: "",
    },
  );
  expect(sendControl).toHaveBeenCalledWith(
    agent,
    expect.objectContaining({
      command: "reset_conversation",
      expectedSessionId: "session",
      expectedTurnId: "",
    }),
    expect.any(AbortSignal),
  );
});
