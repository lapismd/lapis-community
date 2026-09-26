import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "../protocol/index.js";
import { createMemoryAgentActivityStore } from "./agent-archive.js";
import {
  createCommunityAgentsController,
  type CommunityAgentsController,
} from "./agent-controller.js";
import type {
  CommunityAgentDirectory,
  CommunityAgentSession,
} from "./agent-contracts.js";
import { materializeAgentDirectory } from "./agent-protocol.js";

const ownerKey = new Uint8Array(32).fill(71);
const agentKey = new Uint8Array(32).fill(72);
const relayKey = new Uint8Array(32).fill(73);
const owner = getPublicKey(ownerKey);
const agent = getPublicKey(agentKey);
const relay = getPublicKey(relayKey);
const now = 1_800_000_000;
const conversation = nip44.v2.utils.getConversationKey(agentKey, owner);
const proof = bytesToHex(
  schnorr.sign(
    sha256(new TextEncoder().encode(`nostr:agent-auth:${agent}:`)),
    ownerKey,
  ),
);
const profile = finalizeEvent(
  {
    kind: 0,
    created_at: now,
    tags: [["auth", owner, "", proof]],
    content: '{"name":"Batch agent"}',
  },
  agentKey,
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
const scope = {
  communityId: "batch-test",
  relayUrls: ["wss://relay.example/"],
  ownerPubkey: owner,
};
const context = { kind: "channel" as const, channelId: "general" };
let controllers: CommunityAgentsController[] = [];

afterEach(() => {
  controllers.forEach((controller) => controller.dispose());
  controllers = [];
});

function telemetryEvent(payload: Record<string, unknown>, createdAt = now) {
  return finalizeEvent(
    {
      kind: 24200,
      created_at: createdAt,
      tags: [
        ["p", owner],
        ["agent", agent],
        ["frame", "telemetry"],
        ["h", "general"],
      ],
      content: nip44.v2.encrypt(JSON.stringify(payload), conversation),
    },
    agentKey,
  );
}

function singleFrame(
  seq: number,
  kind: string,
  payload: Record<string, unknown>,
  createdAt = now,
) {
  return telemetryEvent(
    {
      version: 2,
      seq,
      streamId: "stream-1",
      timestamp: new Date(createdAt * 1_000).toISOString(),
      kind,
      channelId: "general",
      sessionId: "session-1",
      turnId: "turn-1",
      payload,
    },
    createdAt,
  );
}

function batchFrame(
  seq: number,
  records: readonly {
    id: string;
    seq: number;
    kind: string;
    payload: Record<string, unknown>;
  }[],
  createdAt = now,
) {
  return telemetryEvent(
    {
      version: 3,
      seq,
      streamId: "stream-1",
      timestamp: new Date(createdAt * 1_000).toISOString(),
      kind: "batch",
      channelId: "general",
      sessionId: "session-1",
      turnId: "turn-1",
      records: records.map((record) => ({
        ...record,
        timestamp: new Date(createdAt * 1_000).toISOString(),
      })),
    },
    createdAt,
  );
}

function syncPage(requestId: string, events: readonly NostrEvent[]) {
  return telemetryEvent({
    version: 2,
    seq: 1,
    streamId: "stream-1",
    timestamp: new Date(now * 1_000).toISOString(),
    kind: "activity_sync_page",
    channelId: "general",
    payload: {
      requestId,
      context,
      streamId: "stream-1",
      afterOffset: 0,
      nextOffset: 1,
      highWaterMark: 1,
      complete: true,
      events,
      snapshotEvents: [],
    },
  });
}

async function setup() {
  const archive = createMemoryAgentActivityStore();
  const onState = vi.fn();
  let receive: (event: NostrEvent) => void = () => {};
  const directory: CommunityAgentDirectory = {
    agents: materializeAgentDirectory([profile, channel], owner, relay),
    personas: [],
    events: [profile, channel],
    relayPubkey: relay,
    capabilities: { directory: true, presence: true, activity: true },
    partial: false,
  };
  const session: CommunityAgentSession = {
    loadDirectory: async () => directory,
    loadPresence: async () => [],
    subscribe: async (_keys, handlers) => {
      receive = handlers.onevent;
      return { close() {} };
    },
    setFollow: async () => profile,
    sendControl: vi.fn(async () => profile),
  };
  const controller = createCommunityAgentsController({
    scope,
    identity: {
      getPublicKey: async () => owner,
      signEvent: async () => profile,
      nip44: {
        decrypt: async (_key, ciphertext) =>
          nip44.v2.decrypt(ciphertext, conversation),
        encrypt: async () => "",
      },
    },
    session,
    archive,
    storageMode: () => "indexeddb",
    onState,
    now: () => now,
  });
  controllers.push(controller);
  await controller.start();
  return { archive, controller, onState, receive, session };
}

const lifecycle = {
  scopeKey: "relay/general/agent/channel",
  lifecycleRequestId: "request-batch",
};

describe("batched agent activity", () => {
  it("projects one progress batch atomically and archives its event once", async () => {
    const { archive, controller, onState, receive } = await setup();
    await controller.actions.openActivity(agent, context);
    onState.mockClear();
    const event = batchFrame(1, [
      {
        id: "status-start",
        seq: 40,
        kind: "turn_started",
        payload: { ...lifecycle, state: "running", preview: "Starting batch" },
      },
      {
        id: "status-running",
        seq: 41,
        kind: "request_status",
        payload: { ...lifecycle, state: "running", preview: "Working batch" },
      },
    ]);
    receive(event);
    await vi.waitFor(() =>
      expect(controller.state.controllerScopes[agent]?.preview).toBe(
        "Working batch",
      ),
    );
    expect(
      onState.mock.calls.some(
        ([state]) =>
          state.controllerScopes[agent]?.preview === "Starting batch",
      ),
    ).toBe(false);
    expect(controller.state.working[agent]).toBe(true);
    expect(controller.state.activity.map(({ id }) => id).sort()).toEqual(
      [`${event.id}:status-running`, `${event.id}:status-start`].sort(),
    );
    await vi.waitFor(async () =>
      expect((await archive.page({ scope })).records).toHaveLength(1),
    );
  });

  it("keeps terminal state settled when older progress and permission arrive late", async () => {
    const { controller, receive } = await setup();
    await controller.actions.openActivity(agent, context);
    receive(
      singleFrame(2, "turn_completed", {
        ...lifecycle,
        state: "completed",
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.controllerScopes[agent]?.state).toBe("completed"),
    );
    receive(
      batchFrame(1, [
        {
          id: "late-status",
          seq: 500,
          kind: "request_status",
          payload: { ...lifecycle, state: "running" },
        },
      ]),
    );
    receive(
      singleFrame(1, "permission_requested", {
        ...lifecycle,
        requestId: "permission-late",
        tool: "shell",
        options: ["allow_once"],
        expiresAt: now * 1_000 + 60_000,
      }),
    );
    await vi.waitFor(() =>
      expect(
        controller.state.activity.some(({ id }) => id.endsWith("late-status")),
      ).toBe(true),
    );
    expect(controller.state.controllerScopes[agent]).toMatchObject({
      active: false,
      state: "completed",
    });
    expect(controller.state.pendingPermissions[agent] ?? []).toEqual([]);
    expect(controller.state.working[agent]).toBe(false);
    receive(singleFrame(3, "checkpoint_sync_pending", lifecycle));
    receive(singleFrame(4, "reply_delivered", lifecycle));
    receive(singleFrame(5, "checkpoint_sync_completed", lifecycle));
    await vi.waitFor(() =>
      expect(controller.state.controllerScopes[agent]).toMatchObject({
        state: "completed",
        replyDelivery: "delivered",
        checkpointSync: "completed",
      }),
    );
    expect(controller.state.working[agent]).toBe(false);
  });

  it("expands catch-up records while advancing the outer cursor once", async () => {
    const { archive, controller, receive, session } = await setup();
    await controller.actions.openActivity(agent, context);
    const sendControl = vi.mocked(session.sendControl!);
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalled());
    const request = sendControl.mock.calls.at(-1)![1] as { requestId: string };
    const event = batchFrame(
      1,
      [
        {
          id: "thought",
          seq: 20,
          kind: "thinking_chunk",
          payload: {
            ...lifecycle,
            entry: { id: "thought", type: "thinking", text: "Checking" },
          },
        },
        {
          id: "status",
          seq: 21,
          kind: "request_status",
          payload: { ...lifecycle, state: "running" },
        },
      ],
      now - 3_600,
    );
    receive(syncPage(request.requestId, [event]));
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );
    expect(controller.state.activity.map(({ id }) => id).sort()).toEqual(
      [`${event.id}:status`, `${event.id}:thought`].sort(),
    );
    expect(await archive.checkpoint(scope, agent, context)).toMatchObject({
      offset: 1,
    });
    expect(
      (await archive.page({ scope, agentPubkey: agent })).records,
    ).toHaveLength(1);
  });
});
