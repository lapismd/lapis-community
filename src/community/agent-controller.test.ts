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
const managedProfile = finalizeEvent(
  {
    kind: 0,
    created_at: now,
    tags: [["lapis-managed", owner, relay]],
    content: '{"name":"Managed research"}',
  },
  agentKey,
);
const managedInstance = finalizeEvent(
  {
    kind: 30177,
    created_at: now,
    tags: [["d", agent]],
    content: '{"name":"Managed research"}',
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
          version: 2,
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

function administrationFrame(
  kind:
    | "runtime_state"
    | "memory_state"
    | "processing_state"
    | "administration_error",
  payload: Record<string, unknown>,
  channelId?: string,
) {
  return finalizeEvent(
    {
      kind: 24200,
      created_at: now,
      tags: [
        ["p", owner],
        ["agent", agent],
        ["frame", "telemetry"],
        ...(channelId ? [["h", channelId]] : []),
      ],
      content: nip44.v2.encrypt(
        JSON.stringify({
          version: 2,
          seq: 0,
          timestamp: new Date(now * 1000).toISOString(),
          kind,
          ...(channelId ? { channelId } : {}),
          payload,
        }),
        conversation,
      ),
    },
    agentKey,
  );
}

function streamFrame(
  seq: number,
  kind: string,
  payload: Record<string, unknown>,
  createdAt = now - 3_600,
) {
  const streamId = "stream-activity-1";
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
      content: nip44.v2.encrypt(
        JSON.stringify({
          version: 2,
          seq,
          streamId,
          timestamp: new Date(createdAt * 1_000).toISOString(),
          kind,
          channelId: "general",
          sessionId: "session-sync",
          turnId: "turn-sync",
          payload,
        }),
        conversation,
      ),
    },
    agentKey,
  );
}

function syncPage(
  requestId: string,
  events: readonly NostrEvent[],
  snapshotEvents: readonly NostrEvent[],
  input: {
    streamId?: string;
    afterOffset?: number;
    nextOffset?: number;
    highWaterMark?: number;
    complete?: boolean;
    streamChanged?: boolean;
    migrationGap?: { fromOffset: number; toOffset: number };
  } = {},
) {
  const streamId = input.streamId ?? "stream-activity-1";
  const highWaterMark = input.highWaterMark ?? 2;
  return finalizeEvent(
    {
      kind: 24200,
      created_at: now,
      tags: [
        ["p", owner],
        ["agent", agent],
        ["frame", "telemetry"],
        ["h", "general"],
      ],
      content: nip44.v2.encrypt(
        JSON.stringify({
          version: 2,
          seq: highWaterMark,
          streamId,
          timestamp: new Date(now * 1_000).toISOString(),
          kind: "activity_sync_page",
          channelId: "general",
          payload: {
            requestId,
            context: { kind: "channel", channelId: "general" },
            streamId,
            afterOffset: input.afterOffset ?? 0,
            nextOffset: input.nextOffset ?? highWaterMark,
            highWaterMark,
            complete: input.complete ?? true,
            ...(input.streamChanged ? { streamChanged: true } : {}),
            ...(input.migrationGap ? { migrationGap: input.migrationGap } : {}),
            events,
            snapshotEvents,
          },
        }),
        conversation,
      ),
    },
    agentKey,
  );
}

async function setup(
  directoryEvents: readonly NostrEvent[] = [profile, channel],
  options: { now?: () => number } = {},
) {
  const archive = createMemoryAgentActivityStore();
  const onState = vi.fn();
  let receive: (event: NostrEvent) => void = () => {};
  let disconnect: () => void = () => {};
  const directory: CommunityAgentDirectory = {
    agents: materializeAgentDirectory(directoryEvents, owner, relay),
    personas: [],
    events: directoryEvents,
    relayPubkey: relay,
    capabilities: { directory: true, presence: true, activity: true },
    partial: false,
  };
  const session: CommunityAgentSession = {
    loadDirectory: vi.fn(async () => directory),
    loadPresence: async () => [],
    subscribe: async (_keys, handlers) => {
      receive = handlers.onevent;
      disconnect = () => handlers.onclose("test disconnect");
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
    now: options.now ?? (() => now),
  });
  controllers.push(controller);
  await controller.start();
  return {
    controller,
    archive,
    receive,
    disconnect: () => disconnect(),
    decrypt,
    onState,
    session,
  };
}

describe("agent activity controller", () => {
  it("correlates owner runtime and memory administration without archiving it", async () => {
    const { controller, receive, session, archive } = await setup();
    const runtimePromise = controller.actions.loadRuntime(agent);
    await vi.waitFor(() =>
      expect(session.sendControl).toHaveBeenCalledWith(
        agent,
        expect.objectContaining({ command: "runtime_get" }),
        expect.any(AbortSignal),
      ),
    );
    const runtimeControl = vi
      .mocked(session.sendControl!)
      .mock.calls.at(-1)![1];
    const runtimeRequestId =
      "requestId" in runtimeControl ? runtimeControl.requestId : "";
    receive(
      administrationFrame("runtime_state", {
        requestId: runtimeRequestId,
        agentId: "agent-research",
        host: { id: "workspace", kind: "managed", workspace: "/workspace" },
        runtimeAgents: [{ id: "codex", label: "Codex", mcpTransport: "stdio" }],
        configured: { runtimeAgent: "codex", model: "gpt-6" },
        saved: null,
        effective: {
          runtimeAgent: "codex",
          model: "gpt-6",
          thinking: "high",
        },
        catalog: {
          agent: "codex",
          currentModel: "gpt-6",
          models: ["gpt-6"],
          configOptions: [],
        },
        tools: [{ name: "memory.search", effect: "read" }],
        bootstrapRevision: "persona:1",
        memory: { enabled: true, candidates: 1 },
      }),
    );
    await expect(runtimePromise).resolves.toMatchObject({
      effective: { model: "gpt-6", thinking: "high" },
    });
    expect(controller.state.runtime?.[agent]?.tools).toEqual([
      { name: "memory.search", effect: "read" },
    ]);

    const memoriesPromise = controller.actions.loadMemories(agent, "general", {
      status: "review",
    });
    await vi.waitFor(() =>
      expect(session.sendControl).toHaveBeenCalledWith(
        agent,
        expect.objectContaining({ command: "memory_list" }),
        expect.any(AbortSignal),
      ),
    );
    const memoryControl = vi.mocked(session.sendControl!).mock.calls.at(-1)![1];
    const memoryRequestId =
      "requestId" in memoryControl ? memoryControl.requestId : "";
    receive(
      administrationFrame(
        "memory_state",
        {
          requestId: memoryRequestId,
          channelId: "general",
          records: [
            {
              type: "candidate",
              candidateId: "candidate-1",
              kind: "fact",
              claim: "Release blockers come first.",
              origin: "agent",
              status: "review",
              createdAt: now,
              evidence: [
                {
                  eventId: "a".repeat(64),
                  evidenceHash: "b".repeat(64),
                  conversationKey: "general",
                  observedAt: now,
                },
              ],
            },
          ],
        },
        "general",
      ),
    );
    await expect(memoriesPromise).resolves.toMatchObject({
      channelId: "general",
      records: [{ candidateId: "candidate-1" }],
    });
    expect(controller.state.memories?.[agent]?.records).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(
      archive.page({
        scope: { ...scope, relayPubkey: relay },
        agentPubkey: agent,
      }),
    ).resolves.toMatchObject({ records: [] });
  });

  it("times out an unanswered administration request", async () => {
    vi.useFakeTimers();
    try {
      const { controller } = await setup();
      const pending = expect(
        controller.actions.loadRuntime(agent),
      ).rejects.toThrow(/within ten seconds/iu);
      await vi.advanceTimersByTimeAsync(10_001);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a correlated administration error without waiting for timeout", async () => {
    const { controller, receive, session } = await setup();
    const runtime = controller.actions.loadRuntime(agent);
    await vi.waitFor(() =>
      expect(session.sendControl).toHaveBeenCalledWith(
        agent,
        expect.objectContaining({ command: "runtime_get" }),
        expect.any(AbortSignal),
      ),
    );
    const control = vi.mocked(session.sendControl!).mock.calls.at(-1)![1];
    receive(
      administrationFrame("administration_error", {
        requestId: "requestId" in control ? control.requestId : "",
        responseKind: "runtime_state",
        code: "administration_failed",
        message: "Runtime catalog unavailable",
      }),
    );
    await expect(runtime).rejects.toThrow("Runtime catalog unavailable");
    expect(controller.state.activity).toEqual([]);
  });

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
  it("keeps definitions linked to undiscoverable agents out of saved setups", async () => {
    const { controller, session } = await setup();
    const definition = {
      slug: "research",
      displayName: "Research",
      ownerPubkey: owner,
      systemPrompt: "",
      description: "",
      content: {},
      event: persona,
    };
    const instance = finalizeEvent(
      {
        kind: 30177,
        created_at: now,
        tags: [["d", agent]],
        content: '{"persona_id":"research","name":"Research"}',
      },
      ownerKey,
    );
    vi.mocked(session.loadDirectory).mockResolvedValue({
      agents: [],
      personas: [definition],
      events: [instance],
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    });
    await controller.refresh();
    expect(controller.state.setupDrafts).toEqual([]);
    const deletion = finalizeEvent(
      {
        kind: 5,
        created_at: now + 1,
        tags: [["a", `30177:${owner}:${agent}`]],
        content: "",
      },
      ownerKey,
    );
    vi.mocked(session.loadDirectory).mockResolvedValue({
      agents: [],
      personas: [definition],
      events: [instance, deletion],
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    });
    await controller.refresh();
    expect(controller.state.setupDrafts).toEqual([definition]);
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
  it("accepts activity from a relay-managed agent only through the current relay authorization", async () => {
    const { controller, archive, receive } = await setup([
      managedProfile,
      managedInstance,
      channel,
    ]);
    receive(frame());
    await vi.waitFor(async () =>
      expect(
        (
          await archive.page({
            scope: { ...scope, relayPubkey: relay },
            agentPubkey: agent,
            limit: 10,
          })
        ).records,
      ).toHaveLength(1),
    );
    await controller.actions.openActivity(agent, {
      kind: "channel",
      channelId: "general",
    });
    expect(controller.state.activity).toHaveLength(1);
  });
  it("waits for the target live subscription before requesting catch-up", async () => {
    let resolveSubscription!: (value: { close(): void }) => void;
    const subscribed = new Promise<{ close(): void }>((resolve) => {
      resolveSubscription = resolve;
    });
    const sendControl = vi.fn(async () => profile);
    const session: CommunityAgentSession = {
      loadDirectory: async () => ({
        agents: materializeAgentDirectory([profile, channel], owner, relay),
        personas: [],
        events: [profile, channel],
        relayPubkey: relay,
        capabilities: { directory: true, presence: true, activity: true },
        partial: false,
      }),
      loadPresence: async () => [],
      subscribe: async () => subscribed,
      setFollow: async () => profile,
      sendControl,
    };
    const controller = createCommunityAgentsController({
      scope,
      identity: {
        getPublicKey: async () => owner,
        signEvent: async () => profile,
        nip44: { decrypt: async () => "", encrypt: async () => "" },
      },
      session,
      archive: createMemoryAgentActivityStore(),
      storageMode: () => "indexeddb",
      onState() {},
      now: () => now,
    });
    controllers.push(controller);
    const starting = controller.start();
    await vi.waitFor(() => expect(controller.state.agents).toHaveLength(1));
    await controller.actions.syncActivity(
      { kind: "channel", channelId: "general" },
      [agent],
    );
    expect(sendControl).not.toHaveBeenCalled();
    resolveSubscription({ close() {} });
    await starting;
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalledOnce());
  });
  it("catches up historical activity atomically and restores the fresh current snapshot", async () => {
    const { controller, archive, receive, session } = await setup();
    const sendControl = vi.mocked(session.sendControl!);
    const context = { kind: "channel" as const, channelId: "general" };
    await controller.actions.openActivity(agent, context);
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalled());
    const control = sendControl.mock.calls.at(-1)?.[1];
    expect(control).toMatchObject({
      command: "sync_activity",
      context,
    });
    const started = streamFrame(1, "turn_started", {
      scopeKey: "relay/general/agent/channel",
      conversationKind: "channel",
      lifecycleRequestId: "request-sync",
      state: "running",
    });
    const completed = streamFrame(2, "turn_completed", {
      scopeKey: "relay/general/agent/channel",
      conversationKind: "channel",
      lifecycleRequestId: "request-sync",
      state: "completed",
    });
    receive(
      syncPage(
        (control as { requestId: string }).requestId,
        [started, completed],
        [completed],
      ),
    );
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );
    expect(new Set(controller.state.activity.map((item) => item.id))).toEqual(
      new Set([completed.id, started.id]),
    );
    expect(controller.state.controllerScopes[agent]).toMatchObject({
      active: false,
      state: "completed",
    });
    expect(await archive.checkpoint(scope, agent, context)).toMatchObject({
      streamId: "stream-activity-1",
      offset: 2,
    });
    expect(
      (await archive.page({ scope, agentPubkey: agent })).records,
    ).toHaveLength(2);

    await controller.actions.syncActivity(context, [agent]);
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(2));
    const retry = sendControl.mock.calls.at(-1)?.[1] as {
      requestId: string;
      cursor: { streamId: string; offset: number };
    };
    expect(retry.cursor).toEqual({
      streamId: "stream-activity-1",
      offset: 2,
    });
    receive(
      syncPage(retry.requestId, [], [completed], {
        afterOffset: 2,
        nextOffset: 2,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );
    expect(controller.state.activity).toHaveLength(2);
  });
  it("continues a fixed activity page and commits only after each valid page", async () => {
    const { controller, archive, receive, session } = await setup();
    const sendControl = vi.mocked(session.sendControl!);
    const context = { kind: "channel" as const, channelId: "general" };
    await controller.actions.openActivity(agent, context);
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalledOnce());
    const firstControl = sendControl.mock.calls[0]![1] as {
      requestId: string;
    };
    const started = streamFrame(1, "turn_started", {
      scopeKey: "relay/general/agent/channel",
      conversationKind: "channel",
      lifecycleRequestId: "request-page",
      state: "running",
    });
    receive(
      syncPage(firstControl.requestId, [started], [], {
        nextOffset: 1,
        highWaterMark: 2,
        complete: false,
      }),
    );
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(2));
    expect(await archive.checkpoint(scope, agent, context)).toMatchObject({
      streamId: "stream-activity-1",
      offset: 1,
    });
    const continuation = sendControl.mock.calls[1]![1] as {
      requestId: string;
      cursor: { streamId: string; offset: number };
      highWaterMark: number;
    };
    expect(continuation).toMatchObject({
      requestId: firstControl.requestId,
      cursor: { streamId: "stream-activity-1", offset: 1 },
      highWaterMark: 2,
    });
    const completed = streamFrame(2, "turn_completed", {
      scopeKey: "relay/general/agent/channel",
      conversationKind: "channel",
      lifecycleRequestId: "request-page",
      state: "completed",
    });
    receive(
      syncPage(firstControl.requestId, [completed], [completed], {
        afterOffset: 1,
        nextOffset: 2,
        highWaterMark: 2,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );
    expect(await archive.checkpoint(scope, agent, context)).toMatchObject({
      offset: 2,
    });
  });
  it("replaces a controller stream with an explicit migration gap", async () => {
    const { controller, archive, receive, session } = await setup();
    const sendControl = vi.mocked(session.sendControl!);
    const context = { kind: "channel" as const, channelId: "general" };
    await controller.actions.syncActivity(context, [agent]);
    const first = sendControl.mock.calls[0]![1] as { requestId: string };
    receive(syncPage(first.requestId, [], [], { highWaterMark: 2 }));
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );

    await controller.actions.syncActivity(context, [agent]);
    const replacement = sendControl.mock.calls.at(-1)![1] as {
      requestId: string;
    };
    receive(
      syncPage(replacement.requestId, [], [], {
        streamId: "stream-activity-2",
        afterOffset: 0,
        nextOffset: 7,
        highWaterMark: 7,
        streamChanged: true,
        migrationGap: { fromOffset: 1, toOffset: 5 },
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );
    expect(controller.state.activitySyncGap).toBe(true);
    expect(await archive.checkpoint(scope, agent, context)).toMatchObject({
      streamId: "stream-activity-2",
      offset: 7,
    });
  });
  it("retries the last exact selection after the live subscription reconnects", async () => {
    const { controller, disconnect, session } = await setup();
    const sendControl = vi.mocked(session.sendControl!);
    const context = { kind: "channel" as const, channelId: "general" };
    await controller.actions.syncActivity(context, [agent]);
    expect(sendControl).toHaveBeenCalledOnce();
    disconnect();
    expect(controller.state.activitySyncStatus).toBe("unavailable");
    await controller.actions.refresh();
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(2));
    expect(sendControl.mock.calls[1]![1]).toMatchObject({ context });
  });
  it("retries unavailable catch-up when the selected agent returns online", async () => {
    const { controller, receive, session } = await setup();
    const sendControl = vi.mocked(session.sendControl!);
    sendControl.mockRejectedValueOnce(new Error("temporarily unavailable"));
    const context = { kind: "channel" as const, channelId: "general" };
    await controller.actions.syncActivity(context, [agent]);
    expect(controller.state.activitySyncStatus).toBe("unavailable");
    receive(
      finalizeEvent(
        {
          kind: 20001,
          created_at: now,
          tags: [["agent", agent]],
          content: JSON.stringify({ status: "online" }),
        },
        agentKey,
      ),
    );
    await vi.waitFor(() => expect(sendControl).toHaveBeenCalledTimes(2));
    expect(sendControl.mock.calls[1]![1]).toMatchObject({ context });
  });
  it("rejects an invalid replay atomically and ignores a response after cancellation", async () => {
    const { controller, archive, receive, session } = await setup();
    const sendControl = vi.mocked(session.sendControl!);
    const context = { kind: "channel" as const, channelId: "general" };
    await controller.actions.syncActivity(context, [agent]);
    const request = sendControl.mock.calls[0]![1] as {
      requestId: string;
    };
    const forged = finalizeEvent(
      {
        ...streamFrame(1, "turn_started", {
          scopeKey: "relay/general/agent/channel",
          conversationKind: "channel",
        }),
      },
      relayKey,
    );
    receive(syncPage(request.requestId, [forged], [], { highWaterMark: 1 }));
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("unavailable"),
    );
    expect(await archive.checkpoint(scope, agent, context)).toBeUndefined();
    expect((await archive.page({ scope })).records).toEqual([]);

    await controller.actions.syncActivity(context, [agent]);
    const cancelled = sendControl.mock.calls.at(-1)![1] as {
      requestId: string;
    };
    controller.actions.cancelActivitySync();
    receive(
      syncPage(
        cancelled.requestId,
        [
          streamFrame(1, "turn_started", {
            scopeKey: "relay/general/agent/channel",
            conversationKind: "channel",
          }),
        ],
        [],
        { highWaterMark: 1 },
      ),
    );
    await Promise.resolve();
    expect(controller.state.activitySyncStatus).toBeUndefined();
    expect(await archive.checkpoint(scope, agent, context)).toBeUndefined();
  });
  it("restores a pending permission only from a fresh snapshot envelope", async () => {
    const { controller, receive, session } = await setup();
    const sendControl = vi.mocked(session.sendControl!);
    const context = { kind: "channel" as const, channelId: "general" };
    await controller.actions.syncActivity(context, [agent]);
    const request = sendControl.mock.calls[0]![1] as {
      requestId: string;
    };
    const pending = streamFrame(5, "permission_requested", {
      scopeKey: "relay/general/agent/channel",
      conversationKind: "channel",
      lifecycleRequestId: "request-permission",
      requestId: "permission-1",
      tool: "Run tests",
      input: { command: "pnpm test" },
      options: ["allow_once", "reject_once"],
      expiresAt: now * 1_000 + 60_000,
    });
    receive(
      syncPage(request.requestId, [], [pending], {
        nextOffset: 5,
        highWaterMark: 5,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );
    expect(controller.state.pendingPermissions[agent]).toEqual([
      expect.objectContaining({
        requestId: "permission-1",
        tool: "Run tests",
      }),
    ]);
    expect(controller.state.controllerScopes[agent]).toMatchObject({
      active: true,
      state: "waiting_permission",
      updatedAt: now * 1_000,
    });

    await controller.actions.syncActivity(context, [agent]);
    const continuation = sendControl.mock.calls.at(-1)![1] as {
      requestId: string;
    };
    const current = streamFrame(6, "request_status", {
      scopeKey: "relay/general/agent/channel",
      conversationKind: "channel",
      lifecycleRequestId: "request-permission",
      state: "running",
    });
    receive(
      syncPage(continuation.requestId, [], [current], {
        afterOffset: 5,
        nextOffset: 5,
        highWaterMark: 5,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.activitySyncStatus).toBe("caught-up"),
    );
    expect(controller.state.pendingPermissions[agent]).toEqual([]);
    expect(controller.state.controllerScopes[agent]).toMatchObject({
      active: true,
      state: "running",
    });
  });
  it("marks unanswered catch-up unavailable after ten seconds", async () => {
    vi.useFakeTimers();
    try {
      const { controller } = await setup();
      await controller.actions.syncActivity(
        { kind: "channel", channelId: "general" },
        [agent],
      );
      expect(controller.state.activitySyncStatus).toBe("checking");
      await vi.advanceTimersByTimeAsync(10_001);
      expect(controller.state.activitySyncStatus).toBe("unavailable");
    } finally {
      vi.useRealTimers();
    }
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
      frame(3, "permission_resolved", "general", {
        scopeKey: "relay/general/agent/thread/root",
        requestId: "permission-1",
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.controllerScopes[agent]).toMatchObject({
        state: "running",
        active: true,
      }),
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
  it("drops expired permission cards without sending a decision", async () => {
    let clock = now;
    const { controller, receive, session } = await setup([profile, channel], {
      now: () => clock,
    });
    receive(
      frame(1, "turn_started", "general", {
        scopeKey: "relay/general/agent/thread/root",
        state: "running",
      }),
    );
    receive(
      frame(2, "permission_requested", "general", {
        scopeKey: "relay/general/agent/thread/root",
        requestId: "permission-live",
        tool: "shell",
        options: ["allow_once"],
        expiresAt: now * 1_000 + 60_000,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.pendingPermissions[agent]).toHaveLength(1),
    );
    clock = now + 120;
    await controller.actions.respondPermission(
      agent,
      "permission-live",
      "allow_once",
    );
    expect(session.sendControl).not.toHaveBeenCalled();
    expect(controller.state.pendingPermissions[agent]).toEqual([]);
    expect(controller.state.controllerScopes[agent]).toMatchObject({
      active: true, state: "running",
      preview: "Permission expired. The agent is continuing.",
    });
  });
  it("ignores already expired permission frames and later waiting status", async () => {
    const { controller, receive } = await setup();
    receive(
      frame(1, "permission_requested", "general", {
        scopeKey: "relay/general/agent/thread/root",
        requestId: "permission-expired",
        tool: "shell",
        options: ["allow_once"],
        expiresAt: now * 1_000 - 1,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.controllerScopes[agent]?.state).toBe("running"),
    );
    expect(controller.state.pendingPermissions[agent] ?? []).toEqual([]);
    receive(
      frame(2, "request_status", "general", {
        scopeKey: "relay/general/agent/thread/root",
        lifecycleRequestId: "request-1",
        state: "waiting_permission",
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.controllerScopes[agent]?.state).toBe("running"),
    );
    expect(controller.state.pendingPermissions[agent] ?? []).toEqual([]);
  });
  it("sweeps expired cards on the controller tick", async () => {
    let clock = now;
    const { controller, receive } = await setup([profile, channel], {
      now: () => clock,
    });
    receive(
      frame(1, "permission_requested", "general", {
        scopeKey: "relay/general/agent/thread/root",
        requestId: "permission-live",
        tool: "shell",
        options: ["allow_once"],
        expiresAt: now * 1_000 + 60_000,
      }),
    );
    await vi.waitFor(() =>
      expect(controller.state.pendingPermissions[agent]).toHaveLength(1),
    );
    clock = now + 120;
    await vi.waitFor(
      () => {
        expect(controller.state.pendingPermissions[agent]).toEqual([]);
        expect(controller.state.controllerScopes[agent]).toMatchObject({
          active: true,
          state: "running",
        });
      },
      { timeout: 2_000 },
    );
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
        version: 2,
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

it("waits for a correlated processing acknowledgement and retains cancellation errors", async () => {
  const { controller, session, receive } = await setup();
  let settled = false;
  const waiting = controller.actions.setProcessing!(agent, false, 0).then(
    (value) => {
      settled = true;
      return value;
    },
  );
  await vi.waitFor(() =>
    expect(session.sendControl).toHaveBeenCalledWith(
      agent,
      expect.objectContaining({ command: "processing_set" }),
      expect.any(AbortSignal),
    ),
  );
  const control = vi.mocked(session.sendControl!).mock.calls.at(-1)![1];
  const id = "requestId" in control ? control.requestId : "";
  expect(settled).toBe(false);
  receive(
    administrationFrame("processing_state", {
      requestId: "wrong-request",
      enabled: false,
      revision: 1,
      status: "applied",
      updatedAt: now,
      applied: true,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(settled).toBe(false);
  receive(
    administrationFrame("processing_state", {
      requestId: id,
      enabled: false,
      revision: 1,
      status: "applied",
      updatedAt: now,
      applied: true,
    }),
  );
  await expect(waiting).resolves.toMatchObject({ enabled: false, revision: 1 });
  expect(controller.state.processing?.[agent]).toMatchObject({
    enabled: false,
    status: "applied",
  });
  const retry = controller.actions.setProcessing!(agent, false, 1);
  const failed = expect(retry).rejects.toThrow("Cancellation failed");
  await vi.waitFor(() =>
    expect(vi.mocked(session.sendControl!).mock.calls.at(-1)![1]).toMatchObject(
      { expectedRevision: 1 },
    ),
  );
  const request = vi.mocked(session.sendControl!).mock.calls.at(-1)![1];
  receive(
    administrationFrame("processing_state", {
      requestId: "requestId" in request ? request.requestId : "",
      enabled: false,
      revision: 2,
      status: "error",
      updatedAt: now,
      applied: false,
      error: "Cancellation failed",
    }),
  );
  await failed;
  expect(controller.state.processing?.[agent]?.status).toBe("error");
});
