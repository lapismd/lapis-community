import { afterEach, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { createCommunityAgentsController } from "./agent-controller.js";
import { createMemoryAgentActivityStore } from "./agent-archive.js";
import { materializeAgentDirectory } from "./agent-protocol.js";
import type {
  CommunityAgentSession,
  CommunityAgentObserver,
} from "./agent-contracts.js";
const ownerKey = new Uint8Array(32).fill(71),
  agentKey = new Uint8Array(32).fill(72),
  relayKey = new Uint8Array(32).fill(73);
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
const key = nip44.v2.utils.getConversationKey(agentKey, owner);
const secondKey = new Uint8Array(32).fill(74);
const second = getPublicKey(secondKey);
const disposers: (() => void)[] = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
});
const context = {
  kind: "thread" as const,
  channelId: "general",
  threadRootId: "root",
};
function event(frame: CommunityAgentObserver, signer = agentKey) {
  return finalizeEvent(
    {
      kind: 24200,
      created_at: now,
      tags: [
        ["p", owner],
        ["agent", getPublicKey(signer)],
        ["frame", "telemetry"],
        ["h", "general"],
      ],
      content: nip44.v2.encrypt(
        JSON.stringify(frame),
        nip44.v2.utils.getConversationKey(signer, owner),
      ),
    },
    signer,
  );
}
function status(
  seq: number,
  state = "running",
  root = "root",
  turnId = "turn",
  signer = agentKey,
) {
  return event(
    {
      version: 2,
      seq,
      streamId: "stream",
      timestamp: new Date(now * 1000).toISOString(),
      kind: "request_status",
      channelId: "general",
      sessionId: "session",
      turnId,
      payload: {
        scopeKey: `scope/thread/${root}`,
        threadRootId: root,
        lifecycleRequestId: turnId,
        state,
      },
    },
    signer,
  );
}
async function setup(archive = true, multiple = false) {
  const events = multiple
    ? [
        profile,
        instance,
        finalizeEvent(
          { ...profile, content: '{"name":"Second agent"}' },
          secondKey,
        ),
        finalizeEvent({ ...instance, tags: [["d", second]] }, ownerKey),
        finalizeEvent(
          { ...channel, tags: [...channel.tags, ["p", second]] },
          relayKey,
        ),
      ]
    : [profile, instance, channel];
  let receive: Parameters<
    CommunityAgentSession["subscribe"]
  >[1]["onevent"] = () => {};
  const sendControl = vi.fn<NonNullable<CommunityAgentSession["sendControl"]>>(
    async () => profile,
  );
  const session: CommunityAgentSession = {
    loadDirectory: async () => ({
      agents: materializeAgentDirectory(events, owner, relay),
      personas: [],
      events,
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    }),
    setFollow: async () => profile,
    loadPresence: async () => [],
    subscribe: async (_keys, handlers) => {
      receive = handlers.onevent;
      return { close() {} };
    },
    sendControl,
  };
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
        decrypt: async (pubkey, ciphertext) =>
          nip44.v2.decrypt(
            ciphertext,
            pubkey === agent
              ? key
              : nip44.v2.utils.getConversationKey(secondKey, owner),
          ),
      },
    },
    ...(archive ? { archive: createMemoryAgentActivityStore() } : {}),
    storageMode: () => "memory",
    onState() {},
    now: () => now,
  });
  disposers.push(() => controller.dispose());
  await controller.start();
  const deliver = async (
    input: ReturnType<typeof event>,
    origin: "live" | "replay" = "live",
  ) => {
    receive(input, origin);
    await vi.waitFor(() =>
      expect(controller.state.conversationScopes).toBeDefined(),
    );
    await Promise.resolve();
  };
  const snapshot = (snapshot: ReturnType<typeof event>) => {
    const request = sendControl.mock.calls.at(-1)![1] as { requestId: string };
    receive(
      event(
        {
          version: 2,
          seq: 0,
          streamId: "stream",
          timestamp: new Date(now * 1000).toISOString(),
          kind: "activity_sync_page",
          channelId: "general",
          payload: {
            requestId: request.requestId,
            context,
            streamId: "stream",
            afterOffset: 0,
            nextOffset: 0,
            highWaterMark: 0,
            complete: true,
            events: [],
            snapshotEvents: [snapshot],
          },
        },
        snapshot.pubkey === agent ? agentKey : secondKey,
      ),
      "live",
    );
  };
  return { controller, deliver, snapshot, sendControl };
}
const scopes = (controller: Awaited<ReturnType<typeof setup>>["controller"]) =>
  Object.values(controller.state.conversationScopes ?? {});
it("makes only the unavailable conversation unknown and preserves settled turns", async () => {
  const { controller, deliver } = await setup();
  await deliver(status(1));
  await deliver(status(2, "running", "other"));
  await deliver(status(3, "completed", "root", "finished"));
  await vi.waitFor(() => expect(scopes(controller)).toHaveLength(3));
  vi.useFakeTimers();
  await controller.actions.syncActivity(context, [agent]);
  await vi.advanceTimersByTimeAsync(10001);
  expect(
    scopes(controller).find(
      (s) => s.requestId === "turn" && s.threadRootId === "root",
    )?.state,
  ).toBe("unknown");
  expect(
    scopes(controller).find((s) => s.threadRootId === "other")?.state,
  ).toBe("running");
  expect(
    scopes(controller).find((s) => s.requestId === "finished")?.state,
  ).toBe("completed");
  expect(controller.state.activityUnavailable).toEqual([
    { agentPubkey: agent, context },
  ]);
});
it("marks unavailable execution when the runtime has no archive", async () => {
  const { controller, deliver } = await setup(false);
  await deliver(status(1));
  await controller.actions.syncActivity(context, [agent]);
  expect(scopes(controller)[0]?.state).toBe("unknown");
});
it("restores a signed equal-sequence snapshot but ignores replay after a failed catch-up", async () => {
  const { controller, deliver, snapshot } = await setup();
  const running = status(5);
  await deliver(running);
  vi.useFakeTimers();
  await controller.actions.syncActivity(context, [agent]);
  await vi.advanceTimersByTimeAsync(10001);
  vi.useRealTimers();
  await deliver(status(5), "replay");
  expect(scopes(controller)[0]?.state).toBe("unknown");
  await controller.actions.syncActivity(context, [agent]);
  snapshot(running);
  await vi.waitFor(() =>
    expect(controller.state.activitySyncStatus).toBe("caught-up"),
  );
  expect(scopes(controller)[0]?.state).toBe("running");
});
it("does not let an older signed snapshot replace fresher live execution", async () => {
  const { controller, deliver, snapshot } = await setup();
  await deliver(status(5));
  await controller.actions.syncActivity(context, [agent]);
  await deliver(status(6, "failed"));
  await vi.waitFor(() => expect(scopes(controller)[0]?.state).toBe("failed"));
  snapshot(status(5));
  await vi.waitFor(() =>
    expect(controller.state.activitySyncStatus).toBe("caught-up"),
  );
  expect(scopes(controller)[0]?.state).toBe("failed");
});
it("does not present later replay as current execution after catch-up failed", async () => {
  const { controller, deliver } = await setup(false);
  await deliver(status(1));
  await controller.actions.syncActivity(context, [agent]);
  await deliver(status(2), "replay");
  await vi.waitFor(() => expect(scopes(controller)[0]?.state).toBe("unknown"));
  await deliver(status(3));
  await vi.waitFor(() => expect(scopes(controller)[0]?.state).toBe("running"));
});
it("preserves an agent's completed catch-up when the next agent fails", async () => {
  const { controller, deliver, snapshot, sendControl } = await setup(
    true,
    true,
  );
  await deliver(status(1));
  await deliver(status(1, "running", "root", "turn", secondKey));
  await vi.waitFor(() => expect(scopes(controller)).toHaveLength(2));
  const [first, last] = [agent, second].sort();
  await controller.actions.syncActivity(context, [agent, second]);
  snapshot(
    status(
      1,
      "running",
      "root",
      "turn",
      first === agent ? agentKey : secondKey,
    ),
  );
  await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(2));
  // The second request already owns a real timer; fail its next page validation.
  snapshot(
    status(
      1,
      "running",
      "wrong-thread",
      "turn",
      last === agent ? agentKey : secondKey,
    ),
  );
  await vi.waitFor(() =>
    expect(controller.state.activitySyncStatus).toBe("unavailable"),
  );
  expect(
    scopes(controller).find((scope) => scope.agentPubkey === first)?.state,
  ).toBe("running");
  expect(
    scopes(controller).find((scope) => scope.agentPubkey === last)?.state,
  ).toBe("unknown");
});
