import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CommunityCapabilities,
  CommunityContentWindowRequest,
  CommunityEventRuntime,
} from "./contracts.js";
import {
  createCommunityController,
  normalizeCommunityOperationFailure,
} from "./community-controller.svelte.js";
import { createMemoryCommunityEventStore } from "./event-store.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import {
  Nip29MemoryPolicy,
  createCommunityTestScenario,
  createCommunityTestRuntime,
  createInMemoryRelayFactory,
  type CommunityTestRuntime,
} from "../testing/index.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";

let runtime: CommunityTestRuntime | undefined;

const NO_TEST_CAPABILITIES: CommunityCapabilities = {
  channels: true,
  forums: true,
  directMessages: false,
  search: true,
  manageGroup: false,
  manageMembers: false,
  deleteEvents: false,
  archive: false,
  editMessages: false,
};

afterEach(() => runtime?.dispose());

async function connected(current: CommunityTestRuntime): Promise<void> {
  current.controller.initialize();
  await vi.waitFor(() => {
    expect(current.controller.state.status).toBe("connected");
  });
}

describe("createCommunityController", () => {
  it("publishes Pulse notes, replies, likes, and unlikes through the signer boundary", async () => {
    runtime = await createCommunityTestRuntime();
    const memberPubkey = await runtime.scenario.member.getPublicKey();
    const operatorPubkey = await runtime.scenario.operator.getPublicKey();
    const target = await runtime.scenario.member.signEvent({
      kind: 1,
      created_at: 1_700_000_050,
      content: "Reply to this Pulse note",
      tags: [],
    });
    runtime.relay.inject(target);
    await connected(runtime);
    const pulse = runtime.controller.actions.pulse;
    expect(pulse).toBeDefined();
    pulse!.setActive(true);
    await vi.waitFor(() =>
      expect(runtime?.controller.state.pulse?.notes[0]?.id).toBe(target.id),
    );

    await pulse!.publish({
      content: "A new Pulse note",
      mentionPubkeys: [memberPubkey],
      channelIds: [],
      attachments: [
        {
          url: "https://cdn.example/pulse.png",
          mimeType: "image/png",
          size: 42,
          sha256: "a".repeat(64),
          alt: "Pulse preview",
          width: 640,
          height: 360,
        },
      ],
    });
    await pulse!.publish(
      {
        content: "A Pulse reply",
        mentionPubkeys: [],
        channelIds: [],
        attachments: [],
      },
      target.id,
    );
    const authored = await runtime.relay.query({
      kinds: [1],
      authors: [operatorPubkey],
    });
    const note = authored.find((event) => event.content === "A new Pulse note");
    const reply = authored.find((event) => event.content === "A Pulse reply");
    expect(note?.tags).toEqual(
      expect.arrayContaining([
        ["p", memberPubkey],
        expect.arrayContaining(["imeta", "url https://cdn.example/pulse.png"]),
      ]),
    );
    expect(reply?.tags).toEqual(
      expect.arrayContaining([
        ["e", target.id, runtime.scenario.scope.relayUrl, "reply"],
        ["p", memberPubkey],
      ]),
    );

    await pulse!.toggleLike(target.id);
    const reactions = await runtime.relay.query({
      kinds: [7],
      authors: [operatorPubkey],
      "#e": [target.id],
    });
    expect(reactions).toMatchObject([
      { content: "+", tags: expect.arrayContaining([["k", "1"]]) },
    ]);
    await pulse!.toggleLike(target.id);
    const deletions = await runtime.relay.query({
      kinds: [5],
      authors: [operatorPubkey],
      "#e": [reactions[0]!.id],
    });
    expect(deletions).toMatchObject([
      { tags: expect.arrayContaining([["k", "7"]]) },
    ]);
    pulse!.setActive(false);
  });

  it("becomes connected after bootstrap while bounded history continues", async () => {
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_000,
        content: "Loaded after bootstrap",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(44),
    );
    let releaseFirstWindow!: () => void;
    const firstWindow = new Promise<void>((resolve) => {
      releaseFirstWindow = resolve;
    });
    const synchronize = vi.fn(async () => ({
      events: [],
      capabilities: NO_TEST_CAPABILITIES,
      complete: false,
    }));
    const loadContentWindow = vi.fn(
      async (_request: CommunityContentWindowRequest) => {
        if (loadContentWindow.mock.calls.length === 1) await firstWindow;
        return {
          events: [event],
          primaryEventIds: [event.id],
          olderCursor: { createdAt: event.created_at, eventId: event.id },
          hasOlder: false,
        };
      },
    );
    const controller = createCommunityController({
      scopes: [
        {
          id: "lapis",
          name: "Lapis Community",
          relayUrl: "memory://progressive.test",
          rooms: [
            {
              id: "general",
              groupId: "general",
              name: "general",
              kind: "channel",
            },
          ],
        },
      ],
      source: {
        async open() {
          return {
            async snapshot() {
              throw new Error("complete snapshot should not be used");
            },
            synchronize,
            loadContentWindow,
            async subscribe() {
              return { close() {} };
            },
            async execute() {
              return [];
            },
            async search() {
              return [];
            },
            close() {},
          };
        },
      },
    });

    controller.initialize();
    await vi.waitFor(() => expect(controller.state.status).toBe("connected"));
    expect(controller.state.cache.freshness).toBe("synchronizing");
    expect(controller.state.contentSync?.phase).toBe("background");
    expect(synchronize).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: "bootstrap" }),
      expect.any(AbortSignal),
    );
    expect(controller.state.workspace.messages).toHaveLength(0);

    releaseFirstWindow();
    await vi.waitFor(() =>
      expect(controller.state.contentSync?.phase).toBe("complete"),
    );
    expect(controller.state.workspace.messages).toMatchObject([
      { content: "Loaded after bootstrap" },
    ]);
    expect(controller.state.cache.freshness).toBe("current");
    expect(loadContentWindow.mock.calls.map(([request]) => request)).toEqual([
      expect.objectContaining({ collection: "channel-roots", limit: 50 }),
      expect.objectContaining({ collection: "room-history", limit: 100 }),
    ]);
    controller.dispose();
  });

  it("interrupts background history to prioritize a newly selected room", async () => {
    let firstGeneralSignal: AbortSignal | undefined;
    let firstGeneralAborted = false;
    const loadContentWindow = vi.fn(
      async (request: CommunityContentWindowRequest, signal?: AbortSignal) => {
        if (
          request.collection === "channel-roots" &&
          request.groupId === "general" &&
          firstGeneralSignal === undefined
        ) {
          firstGeneralSignal = signal;
          await new Promise<void>((_resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () => {
                firstGeneralAborted = true;
                reject(signal.reason);
              },
              { once: true },
            );
          });
        }
        return { events: [], primaryEventIds: [], hasOlder: false };
      },
    );
    const controller = createCommunityController({
      scopes: [
        {
          id: "lapis",
          name: "Lapis Community",
          relayUrl: "memory://priority.test",
          rooms: [
            {
              id: "general",
              groupId: "general",
              name: "general",
              kind: "channel",
            },
            {
              id: "support",
              groupId: "support",
              name: "support",
              kind: "forum",
            },
          ],
        },
      ],
      source: {
        async open() {
          return {
            async snapshot() {
              throw new Error("complete snapshot should not be used");
            },
            async synchronize() {
              return {
                events: [],
                capabilities: NO_TEST_CAPABILITIES,
                complete: false,
              };
            },
            loadContentWindow,
            async subscribe() {
              return { close() {} };
            },
            async execute() {
              return [];
            },
            async search() {
              return [];
            },
            close() {},
          };
        },
      },
    });

    controller.initialize();
    await vi.waitFor(() => expect(firstGeneralSignal).toBeDefined());
    controller.actions.selectRoom("support");

    await vi.waitFor(() => expect(firstGeneralAborted).toBe(true));
    await vi.waitFor(() =>
      expect(
        loadContentWindow.mock.calls.some(
          ([request]) =>
            request.collection === "forum-topics" &&
            request.groupId === "support",
        ),
      ).toBe(true),
    );
    expect(controller.state.workspace.activeRoomId).toBe("support");
    controller.dispose();
  });

  it("keeps loaded data usable after background failure and resumes on refresh", async () => {
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_000,
        content: "Recovered bounded history",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(45),
    );
    let failNextWindow = true;
    const loadContentWindow = vi.fn(
      async (_request: CommunityContentWindowRequest) => {
        if (failNextWindow) {
          failNextWindow = false;
          throw new Error("Background history is temporarily unavailable");
        }
        return {
          events: [event],
          primaryEventIds: [event.id],
          olderCursor: { createdAt: event.created_at, eventId: event.id },
          hasOlder: false,
        };
      },
    );
    const controller = createCommunityController({
      scopes: [
        {
          id: "lapis",
          name: "Lapis Community",
          relayUrl: "memory://resume.test",
          rooms: [
            {
              id: "general",
              groupId: "general",
              name: "general",
              kind: "channel",
            },
          ],
        },
      ],
      source: {
        async open() {
          return {
            async snapshot() {
              throw new Error("complete snapshot should not be used");
            },
            async synchronize() {
              return {
                events: [],
                capabilities: NO_TEST_CAPABILITIES,
                complete: false,
              };
            },
            loadContentWindow,
            async subscribe() {
              return { close() {} };
            },
            async execute() {
              return [];
            },
            async search() {
              return [];
            },
            close() {},
          };
        },
      },
    });

    controller.initialize();
    await vi.waitFor(() =>
      expect(controller.state.contentSync?.phase).toBe("partial-error"),
    );
    expect(controller.state.status).toBe("connected");
    expect(controller.state.cache.freshness).toBe("synchronizing");

    await controller.refresh();
    await vi.waitFor(() =>
      expect(controller.state.contentSync?.phase).toBe("complete"),
    );
    expect(controller.state.workspace.messages).toMatchObject([
      { content: "Recovered bounded history" },
    ]);
    expect(controller.state.cache.freshness).toBe("current");
    controller.dispose();
  });

  it("restores cached public conversations when the relay is offline", async () => {
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_000,
        content: "Available offline",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(46),
    );
    const store = createMemoryCommunityEventStore();
    const scope = {
      id: "lapis",
      name: "Lapis Community",
      relayUrl: "memory://offline.test",
      rooms: [
        {
          id: "general",
          groupId: "general",
          name: "general",
          kind: "channel" as const,
        },
      ],
    };
    const first = createCommunityController({
      scopes: [scope],
      runtime: createInlineCommunityEventRuntime({ store }),
      source: {
        async open() {
          return {
            async snapshot() {
              return { events: [event], capabilities: NO_TEST_CAPABILITIES };
            },
            async subscribe() {
              return { close() {} };
            },
            async execute() {
              return [];
            },
            async search() {
              return [];
            },
            close() {},
          };
        },
      },
    });
    first.initialize();
    await vi.waitFor(() => expect(first.state.status).toBe("connected"));
    first.dispose();

    const offline = createCommunityController({
      scopes: [scope],
      runtime: createInlineCommunityEventRuntime({ store }),
      source: {
        async open() {
          throw new Error("Relay unavailable");
        },
      },
    });
    offline.initialize();
    await vi.waitFor(() => expect(offline.state.status).toBe("offline"));
    expect(offline.state.cache.freshness).toBe("offline");
    expect(offline.state.workspace.messages).toMatchObject([
      { content: "Available offline" },
    ]);
    expect(offline.state.error).toBe("Relay unavailable");
    await offline.actions.search("available");
    expect(offline.state.searchResults).toMatchObject([
      { event: { content: "Available offline" }, relayUrl: scope.relayUrl },
    ]);
    await expect(
      offline.actions.sendMessage("general", "Offline draft"),
    ).rejects.toThrow("Reconnect to perform this action");
    offline.dispose();
  });

  it("buffers subscription replay until the initial snapshot is committed", async () => {
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_000,
        content: "Snapshot race",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(45),
    );
    const capabilities: CommunityCapabilities = {
      channels: true,
      forums: true,
      directMessages: false,
      search: true,
      manageGroup: false,
      manageMembers: false,
      deleteEvents: false,
      archive: false,
      editMessages: false,
    };
    const snapshot = vi.fn(async () => ({ events: [event], capabilities }));
    let deliver: ((events: readonly (typeof event)[]) => void) | undefined;
    const controller = createCommunityController({
      scopes: [
        {
          id: "lapis",
          name: "Lapis Community",
          relayUrl: "memory://snapshot-race.test",
          rooms: [
            {
              id: "general",
              groupId: "general",
              name: "general",
              kind: "channel",
            },
          ],
        },
      ],
      source: {
        async open() {
          return {
            snapshot,
            async subscribe(listener) {
              deliver = listener;
              listener([event]);
              return { close() {} };
            },
            async execute() {
              return [];
            },
            async search() {
              return [];
            },
            close() {},
          };
        },
      },
    });

    controller.initialize();
    await vi.waitFor(() => expect(controller.state.status).toBe("connected"));

    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(controller.state.workspace.messages).toHaveLength(1);
    deliver?.([event, event]);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(controller.state.workspace.messages).toHaveLength(1);
    controller.dispose();
  });

  it("projects channels, forums, inbox, members, and administrator capabilities", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const { controller } = runtime;
    expect(controller.state.workspace.activeRoomId).toBe("general");
    expect(
      controller.state.workspace.messages
        .filter((message) => message.activity === undefined)
        .map((message) => message.content),
    ).toEqual(["Welcome to Lapis Community", "Hello from a member"]);
    expect(
      controller.state.workspace.messages
        .map((message) => message.activity?.type)
        .filter((activity) => activity !== undefined),
    ).toEqual(["channel-created", "member-added"]);
    expect(controller.state.inbox?.items).toHaveLength(3);
    expect(controller.state.capabilities.manageMembers).toBe(true);

    controller.actions.selectRoom("support");
    await vi.waitFor(() =>
      expect(controller.state.workspace.view).toBe("forum-index"),
    );
    const topic = controller.state.workspace.topics[0];
    expect(topic?.title).toBe("Portable forums");
    expect(topic?.replyCount).toBe(3);
    expect(topic?.participantIds).toEqual([
      await runtime.scenario.operator.getPublicKey(),
      await runtime.scenario.participant.getPublicKey(),
      await runtime.scenario.member.getPublicKey(),
    ]);
    controller.actions.openTopic(controller.state.workspace.topics[0]!.id);
    await vi.waitFor(() =>
      expect(controller.state.workspace.view).toBe("forum-thread"),
    );
    controller.actions.setReplyTarget(
      controller.state.workspace.messages.at(-1)!.id,
    );
    expect(controller.state.replyTarget?.kind).toBe("forum");
    expect(controller.state.workspace.sidePanel).toBe("none");
  });

  it("publishes an undirected forum-thread message as a reply to the topic root", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const { controller, relay } = runtime;

    controller.actions.selectRoom("support");
    await vi.waitFor(() =>
      expect(controller.state.workspace.view).toBe("forum-index"),
    );
    const topic = controller.state.workspace.topics[0]!;
    controller.actions.openTopic(topic.id);
    await vi.waitFor(() =>
      expect(controller.state.workspace.view).toBe("forum-thread"),
    );

    await controller.actions.sendMessage("support", "A top-level forum reply");

    await vi.waitFor(() =>
      expect(controller.state.workspace.messages.at(-1)?.content).toBe(
        "A top-level forum reply",
      ),
    );
    const [published] = await relay.query({
      kinds: [1_111],
      "#E": [topic.id],
    });
    expect(published).toMatchObject({
      kind: 1_111,
      content: "A top-level forum reply",
    });
    expect(published?.tags).toContainEqual([
      "E",
      topic.id,
      runtime.scenario.scope.relayUrl,
      expect.any(String),
    ]);
    expect(published?.tags).toContainEqual([
      "e",
      topic.id,
      runtime.scenario.scope.relayUrl,
      expect.any(String),
    ]);
    expect(
      await relay.query({ kinds: [9], "#h": ["support"] }),
    ).not.toContainEqual(
      expect.objectContaining({ content: published?.content }),
    );
  });

  it("publishes controller actions and reconciles live relay events", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const { controller, relay, scenario } = runtime;

    await controller.actions.sendMessage("general", "Controller message");
    expect(controller.state.workspace.messages.at(-1)?.content).toBe(
      "Controller message",
    );
    const published = controller.state.workspace.messages.at(-1)!;
    await controller.actions.toggleReaction(published.id, "👍");
    const [publishedReaction] = await relay.query({
      kinds: [7],
      "#e": [published.id],
    });
    expect(publishedReaction?.tags).toContainEqual([
      "h",
      scenario.scope.rooms?.[0]?.groupId,
    ]);
    expect(
      controller.state.workspace.messages.find(
        (message) => message.id === published.id,
      )?.reactions?.[0],
    ).toMatchObject({ emoji: "👍", count: 1, selected: true });

    await controller.actions.toggleReaction(published.id, "👍");
    expect(
      controller.state.workspace.messages.find(
        (message) => message.id === published.id,
      )?.reactions,
    ).toBeUndefined();

    const live = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_200,
        content: "Live member event",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(44),
    );
    await relay.publish(live);
    await vi.waitFor(() => {
      expect(
        controller.state.workspace.messages.some(
          (message) => message.content === "Live member event",
        ),
      ).toBe(true);
    });

    await controller.actions.search("member");
    expect(controller.state.searchResults.length).toBeGreaterThan(0);
    expect(
      controller.state.searchResults.find((result) => result.event.kind === 9),
    ).toMatchObject({ roomId: "general" });
    expect(scenario.scope.id).toBe(
      controller.state.workspace.activeCommunityId,
    );
  });

  it("retains retryable operation failures without changing protocol capabilities", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    runtime.relay.setFaults({ rejectPublish: "policy rejected the message" });
    await expect(
      runtime.controller.actions.sendMessage("general", "Rejected"),
    ).rejects.toThrow("policy rejected the message");
    expect(runtime.controller.state.operations["send:general"]).toEqual({
      status: "failed",
      message: "policy rejected the message",
      failure: {
        category: "relay",
        message: "policy rejected the message",
        relayReason: "policy rejected the message",
        retryable: true,
      },
    });
    expect(runtime.controller.state.capabilities.archive).toBe(false);

    runtime.relay.setFaults({});
    await runtime.controller.retry("send:general");
    expect(runtime.controller.state.operations["send:general"]).toEqual({
      status: "idle",
    });

    const messageId = runtime.controller.state.workspace.messages.find(
      (message) => message.activity === undefined,
    )!.id;
    await expect(
      runtime.controller.actions.toggleReaction(messageId, "wave", {
        shortcode: "wave",
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow("Custom reaction images must use http:// or https://");
    expect(
      runtime.controller.state.operations[`reaction:${messageId}:wave`]
        ?.failure,
    ).toMatchObject({ category: "validation", retryable: false });
    expect(runtime.controller.state.workspace.messages.at(-1)?.content).toBe(
      "Rejected",
    );
  });

  it("records invalid input instead of silently ignoring the action", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const before = await runtime.relay.count({ kinds: [9] });

    const submission = runtime.controller.handlers.onSendMessage?.(
      "general",
      "   ",
    );
    expect(submission).toBeInstanceOf(Promise);
    await expect(submission).rejects.toThrow("Write a message before sending");

    expect(await runtime.relay.count({ kinds: [9] })).toBe(before);
    expect(
      runtime.controller.state.operations["send:general"]?.failure,
    ).toMatchObject({
      category: "validation",
      retryable: false,
    });
    runtime.controller.dismissOperation("send:general");
    expect(runtime.controller.state.operations["send:general"]).toEqual({
      status: "idle",
    });
  });

  it("lets a known nonmember publish to an open group", async () => {
    const scenario = createCommunityTestScenario({ namespace: "membership" });
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: new Uint8Array(32).fill(24),
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scenario.scope.relayUrl));
    const controller = createCommunityController({
      scopes: [scenario.scope],
      source: createNip29CommunitySource({ relayFactory }),
      identity: scenario.participant,
      now: () => 1_700_000_100,
    });
    controller.initialize();
    await vi.waitFor(() => expect(controller.state.status).toBe("connected"));

    const room = controller.state.workspace.navigationSections
      .flatMap((section) => section.rooms)
      .find((candidate) => candidate.id === "general");
    expect(room).toMatchObject({
      membership: "not-joined",
      permissions: {
        publish: {
          state: "enabled",
        },
        react: { state: "enabled" },
      },
    });
    await controller.actions.sendMessage("general", "Before joining");
    expect(controller.state.workspace.messages.at(-1)?.content).toBe(
      "Before joining",
    );
    controller.dispose();
    relayFactory.reset();
  });

  it("does not republish an accepted event while its projection is still syncing", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: new Uint8Array(32).fill(25),
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scenario.scope.relayUrl));
    const eventRuntime = createInlineCommunityEventRuntime();
    const controller = createCommunityController({
      scopes: [scenario.scope],
      source: createNip29CommunitySource({ relayFactory }),
      identity: scenario.member,
      runtime: eventRuntime,
      now: () => 1_700_000_100,
    });
    controller.initialize();
    await vi.waitFor(() => expect(controller.state.status).toBe("connected"));
    vi.spyOn(eventRuntime, "ingest").mockResolvedValue(undefined);
    const before = await relayFactory
      .relay(scenario.scope.relayUrl)
      .count({ kinds: [9] });

    await controller.actions.sendMessage("general", "Waiting to project");

    expect(controller.state.operations["send:general"]).toEqual({
      status: "accepted",
      message: "Accepted by relay, still syncing.",
    });
    expect(
      controller.state.workspace.messages.some(
        (message) => message.content === "Waiting to project",
      ),
    ).toBe(false);
    expect(
      await relayFactory.relay(scenario.scope.relayUrl).count({ kinds: [9] }),
    ).toBe(before + 1);
    await controller.retry("send:general");
    expect(
      await relayFactory.relay(scenario.scope.relayUrl).count({ kinds: [9] }),
    ).toBe(before + 1);
    controller.dispose();
    relayFactory.reset();
  });

  it("normalizes relay acknowledgement reasons without discarding them", () => {
    expect(
      normalizeCommunityOperationFailure(
        new Error("wss://relay.test: restricted: members only"),
      ),
    ).toEqual({
      category: "restricted",
      message: "wss://relay.test: restricted: members only",
      relayReason: "wss://relay.test: restricted: members only",
      retryable: false,
    });
    expect(
      normalizeCommunityOperationFailure(new Error("publish timed out")),
    ).toMatchObject({ category: "timeout", retryable: true });
    for (const category of [
      "invalid",
      "blocked",
      "rate-limited",
      "pow",
      "mute",
    ] as const) {
      const reason = `${category}: relay policy detail`;
      expect(
        normalizeCommunityOperationFailure(new Error(reason)),
      ).toMatchObject({
        category,
        relayReason: reason,
        retryable: category === "rate-limited",
      });
    }
    expect(
      normalizeCommunityOperationFailure(
        new TypeError("WebSocket disconnected"),
      ),
    ).toMatchObject({ category: "network", retryable: true });
    expect(
      normalizeCommunityOperationFailure(
        new Error("Recipient has not advertised a NIP-17 inbox relay"),
      ),
    ).toMatchObject({ category: "validation", retryable: false });
  });

  it("sends and materializes NIP-17 direct messages through the same source", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const memberPubkey = await runtime.scenario.member.getPublicKey();
    await runtime.controller.actions.sendDirectMessage(
      [memberPubkey],
      "Encrypted hello",
    );
    expect(runtime.controller.state.workspace.activeRoomId).toBe(
      `dm:${memberPubkey}`,
    );
    expect(
      runtime.controller.state.workspace.navigationSections
        .find((section) => section.id === "direct-messages")
        ?.rooms.find((room) => room.id === `dm:${memberPubkey}`)
        ?.participantIds,
    ).toContain(memberPubkey);
    expect(runtime.controller.state.workspace.messages).toMatchObject([
      { content: "Encrypted hello" },
    ]);
    expect(await runtime.relay.count({ kinds: [1_059] })).toBe(2);
  });

  it("encrypts direct-message reactions and deletion toggles", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const memberPubkey = await runtime.scenario.member.getPublicKey();
    await runtime.controller.actions.sendDirectMessage(
      [memberPubkey],
      "React privately",
    );
    const messageId = runtime.controller.state.workspace.messages[0]!.id;

    await runtime.controller.actions.toggleReaction(messageId, "👍");
    expect(runtime.controller.state.workspace.messages[0]?.reactions).toEqual([
      expect.objectContaining({ emoji: "👍", count: 1, selected: true }),
    ]);

    await runtime.controller.actions.toggleReaction(messageId, "👍");
    expect(
      runtime.controller.state.workspace.messages[0]?.reactions,
    ).toBeUndefined();
    expect(await runtime.relay.count({ kinds: [1_059] })).toBe(6);
  });

  it("lets an author edit and delete their own message", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const operatorPubkey = await runtime.scenario.operator.getPublicKey();
    const ownMessage = runtime.controller.state.workspace.messages.find(
      (message) =>
        message.authorId === operatorPubkey && message.activity === undefined,
    )!;
    const otherMessage = runtime.controller.state.workspace.messages.find(
      (message) =>
        message.authorId !== operatorPubkey && message.activity === undefined,
    )!;

    await runtime.controller.actions.editEvent!(
      ownMessage.id,
      "Welcome to the edited Lapis Community",
    );

    expect(runtime.controller.state.workspace.messages).toContainEqual(
      expect.objectContaining({
        id: ownMessage.id,
        content: "Welcome to the edited Lapis Community",
        edited: true,
      }),
    );
    expect(await runtime.relay.count({ kinds: [40_003] })).toBe(1);
    await expect(
      runtime.controller.actions.editEvent!(otherMessage.id, "Forged edit"),
    ).rejects.toThrow("Only the author can edit this message");

    await runtime.controller.actions.deleteEvent(ownMessage.id);
    expect(runtime.controller.state.workspace.messages).not.toContainEqual(
      expect.objectContaining({ id: ownMessage.id }),
    );
    expect(await runtime.relay.count({ kinds: [5] })).toBe(1);
  });

  it("sends reports privately to every configured curator", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const memberPubkey = await runtime.scenario.member.getPublicKey();
    const target = runtime.controller.state.workspace.messages.find(
      (message) => message.authorId === memberPubkey,
    )!;
    await runtime.controller.actions.addMember("general", memberPubkey, [
      "curator",
    ]);

    await runtime.controller.actions.reportEvent!(target.id, {
      category: "spam",
      context: "Repeated links across rooms",
    });

    expect(await runtime.relay.count({ kinds: [1_059] })).toBe(2);
    expect(runtime.controller.state.workspace.activeRoomId).toBe("general");
  });

  it("fails visibly when no curator recipients are configured", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const operatorPubkey = await runtime.scenario.operator.getPublicKey();
    const target = runtime.controller.state.workspace.messages.find(
      (message) => message.authorId !== operatorPubkey,
    )!;

    await expect(
      runtime.controller.actions.reportEvent!(target.id, { category: "other" }),
    ).rejects.toThrow("No curator recipients are configured on this relay");
    expect(await runtime.relay.count({ kinds: [1_059] })).toBe(0);
  });

  it("connects a NIP-07-style identity and retries a protected action once", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: new Uint8Array(32).fill(24),
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scenario.scope.relayUrl));
    const connect = vi.fn(async () => scenario.operator);
    const controller = createCommunityController({
      scopes: [scenario.scope],
      source: createNip29CommunitySource({ relayFactory }),
      identityConnector: { connect },
      now: () => 1_700_000_100,
    });
    controller.initialize();
    await vi.waitFor(() => expect(controller.state.status).toBe("connected"));

    await controller.actions.sendMessage("general", "Signed after prompt");

    expect(connect).toHaveBeenCalledTimes(1);
    expect(controller.state.authentication.status).toBe("connected");
    expect(controller.state.workspace.messages.at(-1)?.content).toBe(
      "Signed after prompt",
    );
    controller.dispose();
    relayFactory.reset();
  });

  it("connects through an identity method selected after construction", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: new Uint8Array(32).fill(24),
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scenario.scope.relayUrl));
    const connect = vi.fn(async () => scenario.operator);
    const controller = createCommunityController({
      scopes: [scenario.scope],
      source: createNip29CommunitySource({ relayFactory }),
      now: () => 1_700_000_100,
    });
    controller.initialize();
    await vi.waitFor(() => expect(controller.state.status).toBe("connected"));

    await controller.actions.connectIdentity({ connect });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(controller.state.authentication).toEqual({
      status: "connected",
      pubkey: await scenario.operator.getPublicKey(),
    });
    controller.dispose();
    relayFactory.reset();
  });

  it("reuses restored runtime state when the identity changes", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: new Uint8Array(32).fill(24),
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scenario.scope.relayUrl));
    const baseRuntime = createInlineCommunityEventRuntime();
    const restore = vi.fn(
      async (...args: Parameters<CommunityEventRuntime["restore"]>) => {
        if (restore.mock.calls.length > 1) {
          throw new Error("Identity reconnect replayed the local cache");
        }
        return await baseRuntime.restore(...args);
      },
    );
    const eventRuntime: CommunityEventRuntime = {
      restore,
      ingest: (batch) => baseRuntime.ingest(batch),
      project: (selection) => baseRuntime.project(selection),
      search: (query) => baseRuntime.search(query),
      clear: (scope) => baseRuntime.clear(scope),
      dispose: () => baseRuntime.dispose(),
    };
    const controller = createCommunityController({
      scopes: [scenario.scope],
      source: createNip29CommunitySource({ relayFactory }),
      runtime: eventRuntime,
      now: () => 1_700_000_100,
    });
    controller.initialize();
    await vi.waitFor(() => expect(controller.state.status).toBe("connected"));

    await controller.actions.connectIdentity({
      connect: async () => scenario.operator,
    });

    expect(restore).toHaveBeenCalledTimes(1);
    expect(controller.state.authentication).toEqual({
      status: "connected",
      pubkey: await scenario.operator.getPublicKey(),
    });
    controller.dispose();
    relayFactory.reset();
  });

  it("disconnects the identity while retaining anonymous public browsing", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const memberPubkey = await runtime.scenario.member.getPublicKey();
    runtime.controller.actions.openDirectMessage([memberPubkey]);

    await runtime.controller.actions.disconnectIdentity();

    expect(runtime.controller.state.authentication).toEqual({
      status: "anonymous",
    });
    expect(runtime.controller.state.settings.identityConnected).toBe(false);
    expect(runtime.controller.state.workspace.currentMemberId).toBeUndefined();
    expect(runtime.controller.state.workspace.activeRoomId).toBe("general");
    expect(
      runtime.controller.state.workspace.navigationSections
        .flatMap((section) => section.rooms)
        .find((room) => room.id === "general")?.permissions?.publish.state,
    ).toBe("requires-authentication");
  });

  it("publishes and projects profile metadata and the profile image", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const pubkey = await runtime.scenario.operator.getPublicKey();
    const picture =
      "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";

    await runtime.controller.actions.updateProfile({
      displayName: "Steve Updated",
      username: "steve-updated",
      about: "Profile changes are projected from the signed event.",
      picture,
    });

    expect(runtime.controller.state.settings.profile).toEqual({
      pubkey,
      displayName: "Steve Updated",
      username: "steve-updated",
      about: "Profile changes are projected from the signed event.",
      picture,
    });
    expect(
      runtime.controller.state.workspace.members.find(
        (member) => member.id === pubkey,
      ),
    ).toMatchObject({ name: "Steve Updated", avatarUrl: picture });
    expect(runtime.controller.state.operations["settings:profile"]).toEqual({
      status: "idle",
    });
  });

  it("creates, updates, and deletes rooms through NIP-29 commands", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);

    await runtime.controller.actions.createRoom("forum", {
      name: "Design help",
      description: "Discuss interface patterns",
      visibility: "public",
      lifecycle: "ongoing",
    });
    const groupId = runtime.controller.state.workspace.activeRoomId;
    expect(
      runtime.controller.state.workspace.navigationSections
        .find((section) => section.id === "forums")
        ?.rooms.find((room) => room.id === groupId),
    ).toMatchObject({ name: "Design help", kind: "forum" });
    expect(
      (await runtime.relay.query({ kinds: [9_007], "#h": [groupId] }))[0]?.tags,
    ).toContainEqual(["supported_kinds", "11", "1111", "7"]);

    await runtime.controller.actions.updateRoom(groupId, {
      name: "Design systems",
      description: "Discuss interface systems",
      visibility: "private",
      lifecycle: "ongoing",
    });
    expect(
      (await runtime.relay.query({ kinds: [9_002], "#h": [groupId] }))[0]?.tags,
    ).toContainEqual(["private"]);

    await runtime.controller.actions.deleteRoom(groupId);
    expect(await runtime.relay.count({ kinds: [9_008], "#h": [groupId] })).toBe(
      1,
    );
    expect(runtime.controller.state.workspace.activeRoomId).not.toBe(groupId);
  });

  it("replaces member roles and creates private group invites", async () => {
    runtime = await createCommunityTestRuntime({
      inviteCodeFactory: () => "controller-invite",
    });
    await connected(runtime);
    const memberPubkey = await runtime.scenario.member.getPublicKey();

    await runtime.controller.actions.setMemberRoles!("general", memberPubkey, [
      "writer",
      "writer",
      "",
    ]);
    expect(
      runtime.controller.state.workspace.members.find(
        (member) => member.id === memberPubkey,
      ),
    ).toMatchObject({ roles: ["writer"], role: "writer" });

    await runtime.controller.actions.setMemberRoles!(
      "general",
      memberPubkey,
      [],
    );
    expect(
      runtime.controller.state.workspace.members.find(
        (member) => member.id === memberPubkey,
      ),
    ).toMatchObject({ roles: [], role: "member" });
    const operatorPubkey = await runtime.scenario.operator.getPublicKey();
    await expect(
      runtime.controller.actions.setMemberRoles!("general", operatorPubkey, [
        "writer",
      ]),
    ).rejects.toThrow("Relay administrators cannot be changed from Community");

    await runtime.controller.actions.updateRoom("general", {
      name: "general",
      description: "Community chat",
      visibility: "private",
      lifecycle: "ongoing",
      postingPolicy: "writers",
    });
    const invite =
      await runtime.controller.actions.createGroupInvite!("general");
    expect(invite).toMatchObject({
      code: "controller-invite",
      groupId: "general",
      relayUrl: runtime.scenario.scope.relayUrl,
    });
    expect(invite.uri).toContain("?invite=controller-invite");
    expect(
      (await runtime.relay.query({ kinds: [9_009], "#h": ["general"] })).at(-1)
        ?.tags,
    ).toContainEqual(["code", "controller-invite"]);

    const invitedController = createCommunityController({
      scopes: [
        {
          ...runtime.scenario.scope,
          rooms: runtime.scenario.scope.rooms!.filter(
            (room) => room.groupId !== "general",
          ),
        },
      ],
      source: createNip29CommunitySource({
        relayFactory: runtime.relayFactory,
      }),
      identity: runtime.scenario.participant,
      now: () => 1_700_000_200,
    });
    try {
      invitedController.initialize();
      await vi.waitFor(() =>
        expect(invitedController.state.status).toBe("connected"),
      );
      await invitedController.actions.joinWithInvite!(invite.uri);
      expect(invitedController.state.workspace.activeRoomId).toBe("general");
      expect(
        invitedController.state.workspace.navigationSections
          .flatMap((section) => section.rooms)
          .find((room) => room.id === "general"),
      ).toMatchObject({ private: true, membership: "joined" });
    } finally {
      invitedController.dispose();
    }
  });

  it("adds NIP-30 tags to custom reactions", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const target = runtime.controller.state.workspace.messages.find(
      (message) => message.activity === undefined,
    )!;

    await runtime.controller.actions.toggleReaction(target.id, "lapis", {
      shortcode: "lapis",
      url: "https://example.test/lapis.png",
    });

    const [reaction] = await runtime.relay.query({
      kinds: [7],
      "#e": [target.id],
    });
    expect(reaction?.tags).toContainEqual([
      "emoji",
      "lapis",
      "https://example.test/lapis.png",
    ]);
  });
});
