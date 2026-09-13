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
import { materializeAgentDirectory } from "./agent-protocol.js";
import type {
  CommunityAgentDirectory,
  CommunityAgentIdentity,
  CommunityAgentSession,
} from "./agent-contracts.js";

const ownerKey = new Uint8Array(32).fill(61);
const agentKey = new Uint8Array(32).fill(62);
const relayKey = new Uint8Array(32).fill(63);
const owner = getPublicKey(ownerKey);
const agent = getPublicKey(agentKey);
const relay = getPublicKey(relayKey);
const now = 1_800_000_000;
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
    content: '{"name":"Research"}',
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
const persona = finalizeEvent(
  {
    kind: 30175,
    created_at: now,
    tags: [["d", "research"]],
    content: '{"display_name":"Research"}',
  },
  ownerKey,
);
const scope = {
  communityId: "test",
  relayUrls: ["wss://relay.example/"],
  ownerPubkey: owner,
};
const conversation = nip44.v2.utils.getConversationKey(agentKey, owner);
let controllers: CommunityAgentsController[] = [];
afterEach(() => {
  controllers.forEach((controller) => controller.dispose());
  controllers = [];
});

function frame(
  seq = 1,
  kind = "turn_started",
  h = "general",
  payload: unknown = { text: "private result" },
) {
  return finalizeEvent(
    {
      kind: 24200,
      created_at: now,
      tags: [
        ["p", owner],
        ["agent", agent],
        ["frame", "telemetry"],
        ["h", h],
      ],
      content: nip44.v2.encrypt(
        JSON.stringify({
          seq,
          timestamp: new Date(now * 1000).toISOString(),
          kind,
          channelId: h,
          sessionId: "s",
          turnId: "t",
          payload,
        }),
        conversation,
      ),
    },
    agentKey,
  );
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
    loadDirectory: vi.fn(async () => directory),
    loadPresence: async () => [],
    subscribe: async (_keys, handlers) => {
      receive = handlers.onevent;
      return { close() {} };
    },
    setFollow: async () => profile,
    registerAgent: vi.fn(async () => profile),
    savePersona: vi.fn(async () => persona),
    saveAgent: vi.fn(async () => ({ persona })),
    unlinkAgent: vi.fn(async () => profile),
    deletePersona: vi.fn(async () => persona),
    sendControl: vi.fn(async () => profile),
  };
  const decrypt = vi.fn(async (_key: string, ciphertext: string) =>
    nip44.v2.decrypt(ciphertext, conversation),
  );
  const identity = {
    getPublicKey: async () => owner,
    signEvent: async () => profile,
    nip44: { decrypt, encrypt: async () => "" },
  };
  const controller = createCommunityAgentsController({
    scope,
    identity,
    session,
    archive,
    storageMode: () => "indexeddb",
    onState,
    now: () => now,
  });
  controllers.push(controller);
  await controller.start();
  return { controller, archive, receive, decrypt, onState, session };
}

describe("agent activity controller", () => {
  it("finishes empty history without waiting for incoming activity", async () => {
    const { controller } = await setup();
    await controller.actions.openActivity(agent);
    expect(controller.state.activityLoading).toBe(false);
    expect(controller.state.activity).toEqual([]);
    expect(controller.state.activityError).toBeUndefined();
  });
  it("turns a stalled archive into a retryable state and ignores its late result", async () => {
    const { controller, archive } = await setup();
    vi.useFakeTimers();
    try {
      let finish!: (value: any) => void;
      const page = archive.page;
      archive.page = () =>
        new Promise((resolve) => {
          finish = resolve;
        });
      const opening = controller.actions.openActivity(agent);
      await vi.advanceTimersByTimeAsync(15_001);
      await opening;
      expect(controller.state.activityLoading).toBe(false);
      expect(controller.state.activityError).toContain("Latest to retry");
      finish({ records: [], hasOlder: false });
      archive.page = page;
      await controller.actions.openActivity(agent);
      expect(controller.state.activityError).toBeUndefined();
      expect(controller.state.activityLoading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps independent conversations and filters encrypted history by exact thread", async () => {
    const { controller, receive } = await setup();
    receive(
      frame(1, "request_status", "general", {
        scopeKey: "relay/general/agent/thread/a",
        lifecycleRequestId: "a",
        state: "running",
        preview: "Reading",
      }),
    );
    receive(
      frame(2, "request_status", "general", {
        scopeKey: "relay/general/agent/thread/b",
        lifecycleRequestId: "b",
        state: "running",
        preview: "Testing",
      }),
    );
    await vi.waitFor(() =>
      expect(
        Object.keys(controller.state.conversationScopes ?? {}),
      ).toHaveLength(2),
    );
    receive(
      frame(3, "turn_completed", "general", {
        scopeKey: "relay/general/agent/thread/a",
        lifecycleRequestId: "a",
      }),
    );
    await vi.waitFor(() =>
      expect(
        Object.values(controller.state.conversationScopes ?? {}).filter(
          (scope) => scope.active,
        ),
      ).toHaveLength(1),
    );
    await controller.actions.openActivity(agent, {
      kind: "thread",
      channelId: "general",
      threadRootId: "b",
    });
    expect(controller.state.activity).toHaveLength(1);
    expect(controller.state.activity[0]?.frame.payload).toMatchObject({
      preview: "Testing",
    });
  });
  it("loads the relay directory without waiting for a stalled activity archive", async () => {
    const archive = createMemoryAgentActivityStore();
    archive.agents = vi.fn(
      () => new Promise<readonly CommunityAgentIdentity[]>(() => {}),
    );
    const directory: CommunityAgentDirectory = {
      agents: [],
      personas: [],
      events: [],
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    };
    const session: CommunityAgentSession = {
      loadDirectory: vi.fn(async () => directory),
      loadPresence: async () => [],
      subscribe: async () => ({ close() {} }),
      setFollow: async () => profile,
    };
    const controller = createCommunityAgentsController({
      scope,
      identity: {
        getPublicKey: async () => owner,
        signEvent: async () => profile,
      },
      session,
      archive,
      storageMode: () => "turso-opfs",
      onState() {},
      now: () => now,
    });
    controllers.push(controller);

    await controller.start();

    expect(session.loadDirectory).toHaveBeenCalledOnce();
    expect(controller.state.status).toBe("ready");
  });
  it("registers an existing agent and refreshes the verified directory", async () => {
    const { controller, session } = await setup();
    vi.mocked(session.loadDirectory).mockResolvedValueOnce({
      agents: materializeAgentDirectory([profile], owner, relay),
      personas: [],
      events: [profile],
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    });
    await controller.actions.registerAgent(agent);
    expect(session.registerAgent).toHaveBeenCalledWith(
      agent,
      expect.any(AbortSignal),
    );
    expect(session.loadDirectory).toHaveBeenCalledTimes(2);
    expect(controller.state.agents.map((entry) => entry.pubkey)).toEqual([
      agent,
    ]);
  });
  it("routes persona save, unlink, and deletion through the session", async () => {
    const { controller, session } = await setup();
    const input = {
      pubkey: agent,
      personaSlug: "research",
      displayName: "Research",
      nameMode: "inherited" as const,
    };
    await controller.actions.savePersona({
      personaSlug: "research",
      displayName: "Research",
    });
    await controller.actions.saveAgent(input);
    await controller.actions.unlinkAgent(agent, "Research");
    await controller.actions.deletePersona("research");
    expect(session.saveAgent).toHaveBeenCalledWith(
      input,
      expect.any(AbortSignal),
    );
    expect(session.savePersona).toHaveBeenCalledWith(
      { personaSlug: "research", displayName: "Research" },
      expect.any(AbortSignal),
    );
    expect(session.unlinkAgent).toHaveBeenCalledWith(
      agent,
      "Research",
      expect.any(AbortSignal),
    );
    expect(session.deletePersona).toHaveBeenCalledWith(
      "research",
      expect.any(AbortSignal),
    );
  });
  it("captures encrypted activity while the panel is closed and restores it on demand", async () => {
    const { controller, archive, receive } = await setup();
    const event = frame();
    receive(event);
    receive(event);
    await vi.waitFor(async () =>
      expect((await archive.page({ scope })).records).toHaveLength(1),
    );
    expect(controller.state.activity).toEqual([]);
    await vi.waitFor(() => expect(controller.state.working[agent]).toBe(true));
    await controller.actions.openActivity(agent);
    expect(controller.state.activity[0]?.frame.payload).toEqual({
      text: "private result",
    });
    expect(controller.state.activity).toHaveLength(1);
  });
  it("derives controller scope and exact permission choices before publishing owner controls", async () => {
    const { controller, receive, session } = await setup();
    receive(
      frame(1, "turn_started", "general", {
        scopeKey: "relay/general/agent/thread/root",
        state: "running",
      }),
    );
    receive(
      frame(2, "permission_requested", "general", {
        scopeKey: "relay/general/agent/thread/root",
        requestId: "permission-1",
        tool: "shell",
        input: { command: "pnpm test" },
        options: ["allow_once", "reject_once", "invented"],
        expiresAt: now * 1_000 + 60_000,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.pendingPermissions[agent]).toHaveLength(1),
    );
    expect(controller.state.controllerScopes[agent]).toMatchObject({
      scopeKey: "relay/general/agent/thread/root",
      active: true,
    });
    expect(controller.state.pendingPermissions[agent]?.[0]).toMatchObject({
      requestId: "permission-1",
      tool: "shell",
      options: ["allow_once", "reject_once"],
    });
    await expect(
      controller.actions.respondPermission(
        agent,
        "permission-1",
        "allow_always",
      ),
    ).rejects.toThrow(/no longer available/i);
    await controller.actions.respondPermission(
      agent,
      "permission-1",
      "allow_once",
      "general",
    );
    expect(session.sendControl).toHaveBeenCalledWith(
      agent,
      {
        version: 1,
        command: "permission_response",
        requestId: "permission-1",
        decision: "allow_once",
        channelId: "general",
      },
      expect.any(AbortSignal),
    );
    expect(controller.state.pendingPermissions[agent]).toEqual([]);

    receive(
      frame(3, "permission_requested", "general", {
        scopeKey: "relay/general/agent/thread/root",
        requestId: "permission-expired",
        tool: "shell",
        options: ["allow_once"],
        expiresAt: now * 1_000 - 1,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.pendingPermissions[agent]).toHaveLength(1),
    );
    await expect(
      controller.actions.respondPermission(
        agent,
        "permission-expired",
        "allow_once",
      ),
    ).rejects.toThrow(/expired/i);
    expect(session.sendControl).toHaveBeenCalledTimes(1);
    receive(
      frame(4, "permission_resolved", "general", {
        scopeKey: "relay/general/agent/thread/root",
        requestId: "permission-expired",
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.pendingPermissions[agent]).toEqual([]),
    );

    await controller.actions.cancelTurn(
      agent,
      "relay/general/agent/thread/root",
      "general",
    );
    await controller.actions.resetConversation(
      agent,
      "relay/general/agent/thread/root",
      "general",
    );
    expect(session.sendControl).toHaveBeenNthCalledWith(
      2,
      agent,
      {
        version: 1,
        command: "cancel_turn",
        expectedSessionId: "s",
        expectedTurnId: "t",
        scopeKey: "relay/general/agent/thread/root",
        channelId: "general",
      },
      expect.any(AbortSignal),
    );
    expect(session.sendControl).toHaveBeenNthCalledWith(
      3,
      agent,
      {
        version: 1,
        command: "reset_conversation",
        expectedSessionId: "s",
        expectedTurnId: "t",
        scopeKey: "relay/general/agent/thread/root",
        channelId: "general",
      },
      expect.any(AbortSignal),
    );

    receive(
      frame(5, "turn_completed", "general", {
        scopeKey: "relay/general/agent/thread/root",
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.controllerScopes[agent]?.active).toBe(false),
    );
    receive(
      frame(4, "turn_started", "general", {
        scopeKey: "relay/general/agent/thread/root",
      }),
    );
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(controller.state.controllerScopes[agent]?.active).toBe(false);
    await expect(
      controller.actions.cancelTurn(agent, "relay/general/agent/thread/root"),
    ).rejects.toThrow(/active controller turn/i);
  });
  it("clears working on Buzz turn_finished and ignores an out-of-order start", async () => {
    const { controller, receive } = await setup();
    receive(frame(2, "turn_finished"));
    receive(frame(1, "turn_started"));
    await controller.actions.openActivity(agent);
    await vi.waitFor(() => expect(controller.state.activity).toHaveLength(2));
    expect(controller.state.working[agent]).toBe(false);
    receive(frame(3, "turn_started"));
    await vi.waitFor(() => expect(controller.state.working[agent]).toBe(true));
    receive(frame(4, "turn_finished"));
    await vi.waitFor(() => expect(controller.state.working[agent]).toBe(false));
  });
  it("does not infer current working state from historical activity", async () => {
    const { controller, archive } = await setup();
    await archive.append(scope, [{ event: frame(), profile, receivedAt: now }]);
    await controller.actions.openActivity(agent);
    expect(controller.state.activity).toHaveLength(1);
    expect(controller.state.working[agent]).not.toBe(true);
  });
  it("drops stranger telemetry, malformed payloads and inaccessible channel frames", async () => {
    const { controller, archive, receive } = await setup();
    receive(frame(1, "turn_started", "private"));
    const stranger = finalizeEvent(frame(2), relayKey);
    receive(stranger);
    const invalid = finalizeEvent(
      { ...frame(3), content: nip44.v2.encrypt("{}", conversation) },
      agentKey,
    );
    receive(invalid);
    await vi.waitFor(async () =>
      expect((await archive.page({ scope })).records).toHaveLength(1),
    );
    await controller.actions.openActivity(agent);
    expect(controller.state.activity).toEqual([]);
  });
  it("does not capture scoped telemetry when only the agent belongs to a public channel", async () => {
    const { controller, session, receive, archive } = await setup();
    const publicMembership = finalizeEvent(
      {
        ...channel,
        created_at: now + 1,
        tags: [
          ["d", "general"],
          ["p", agent],
        ],
      },
      relayKey,
    );
    vi.mocked(session.loadDirectory).mockResolvedValue({
      agents: materializeAgentDirectory(
        [profile, publicMembership],
        owner,
        relay,
      ),
      personas: [],
      events: [profile, publicMembership],
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    });
    await controller.actions.refresh();
    expect(controller.state.agents[0]?.channelIds).toEqual(["general"]);
    receive(frame());
    await controller.actions.openActivity(agent);
    expect((await archive.page({ scope })).records).toEqual([]);
  });
  it("stops publishing decoded results when the owning controller is disposed", async () => {
    const { controller, receive, decrypt, onState } = await setup();
    let resolve!: (value: string) => void;
    decrypt.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    receive(frame());
    await vi.waitFor(() => expect(decrypt).toHaveBeenCalled());
    controller.dispose();
    const count = onState.mock.calls.length;
    resolve(
      JSON.stringify({
        seq: 1,
        timestamp: new Date(now * 1000).toISOString(),
        kind: "turn_started",
        payload: {},
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(onState).toHaveBeenCalledTimes(count);
    expect(controller.state.activity).toEqual([]);
    expect(controller.state.working).toEqual({});
  });
  it("keeps encrypted history when decryption is declined and supports retry", async () => {
    const { controller, archive, receive, decrypt } = await setup();
    decrypt.mockRejectedValueOnce(new Error("declined"));
    receive(frame());
    await vi.waitFor(() =>
      expect(controller.state.activityError).toContain("declined"),
    );
    expect((await archive.page({ scope })).records).toHaveLength(1);
    await controller.actions.openActivity(agent);
    expect(controller.state.activityError).toBeUndefined();
    expect(controller.state.activity).toHaveLength(1);
  });
  it("reports quota failures, retains old history, and permits clearing to free storage", async () => {
    const { controller, archive, receive } = await setup();
    await archive.append(scope, [
      { event: frame(1), profile, receivedAt: now },
    ]);
    vi.spyOn(archive, "append").mockRejectedValueOnce(
      new Error("QuotaExceededError"),
    );
    receive(frame(2));
    await vi.waitFor(() =>
      expect(controller.state.archiveError).toContain("could not be saved"),
    );
    expect((await archive.page({ scope })).records).toHaveLength(1);
    await controller.actions.clearHistory(agent);
    expect((await archive.page({ scope })).records).toEqual([]);
    expect(controller.state.archiveError).toBeUndefined();
  });
});
