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

async function setup(initiallyUnknown = false) {
  let loads = 0;
  let receive = (
    _event: ReturnType<typeof finalizeEvent>,
    _origin?: "live" | "replay",
  ) => {};
  const sendControl = vi.fn<NonNullable<CommunityAgentSession["sendControl"]>>(
    async () => profile,
  );
  const session = {
    loadDirectory: async () => ({
      agents: materializeAgentDirectory(
        initiallyUnknown && ++loads === 1 ? [channel] : events,
        owner,
        relay,
      ),
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
    origin: "live" | "replay" = "live",
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
      origin,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return { controller, frame };
}

const approval = {
  scopeKey: "scope/thread/root",
  requestId: "permission",
  tool: "shell",
  options: ["allow_once", "reject_once"],
  expiresAt: now * 1000 + 60000,
};

it("claims a live request once while Activity is closed and retains its exact conversation", async () => {
  const { controller, frame } = await setup();
  await frame("permission_requested", approval);
  expect(controller.state.activityAgent).toBeUndefined();
  const take = () => controller.actions.takePermissionNotifications?.() ?? [];
  expect(take()).toEqual([
    expect.objectContaining({
      agentPubkey: agent,
      requestId: "permission",
      sessionId: "session",
      turnId: "turn",
      context: {
        kind: "thread",
        channelId: "general",
        threadRootId: "root",
        focusTurnId: "turn",
      },
    }),
  ]);
  expect(take()).toEqual([]);
  await frame("permission_requested", approval);
  expect(take()).toEqual([]);
});
it("never notifies for replay even when the same request is later repeated live", async () => {
  const { controller, frame } = await setup();
  await frame("permission_requested", approval, "session", "turn", "replay");
  expect(controller.actions.takePermissionNotifications?.() ?? []).toEqual([]);
  await frame("permission_requested", approval);
  expect(controller.actions.takePermissionNotifications?.() ?? []).toEqual([]);
});
it("does not claim resolved or already expired requests", async () => {
  const { controller, frame } = await setup();
  await frame("permission_requested", approval);
  await frame("permission_resolved", approval);
  expect(controller.actions.takePermissionNotifications?.() ?? []).toEqual([]);
  await frame("permission_requested", {
    ...approval,
    requestId: "expired",
    expiresAt: now * 1000 - 1,
  });
  expect(controller.actions.takePermissionNotifications?.() ?? []).toEqual([]);
});
it("keeps independent requests in the same session separate", async () => {
  const { controller, frame } = await setup();
  await frame("permission_requested", approval);
  await frame("permission_requested", { ...approval, requestId: "second" });
  expect(
    (controller.actions.takePermissionNotifications?.() ?? []).map(
      (item) => item.requestId,
    ),
  ).toEqual(["permission", "second"]);
});

it("retains live notification origin while verifying a newly discovered agent", async () => {
  const { controller, frame } = await setup(true);
  await frame("permission_requested", approval);
  await controller.actions.refresh();
  await vi.waitFor(() =>
    expect(controller.state.pendingPermissions[agent]).toHaveLength(1),
  );
  expect(controller.actions.takePermissionNotifications?.()).toHaveLength(1);
});
