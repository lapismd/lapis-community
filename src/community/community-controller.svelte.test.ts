import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommunityCapabilities } from "./contracts.js";
import { createCommunityController } from "./community-controller.svelte.js";
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
      controller.state.workspace.messages.map((message) => message.content),
    ).toEqual(["Welcome to Lapis Community", "Hello from a member"]);
    expect(controller.state.inbox?.items).toHaveLength(1);
    expect(controller.state.capabilities.manageMembers).toBe(true);

    controller.actions.selectRoom("support");
    await vi.waitFor(() =>
      expect(controller.state.workspace.view).toBe("forum-index"),
    );
    expect(controller.state.workspace.topics[0]?.title).toBe("Portable forums");
    controller.actions.openTopic(controller.state.workspace.topics[0]!.id);
    await vi.waitFor(() =>
      expect(controller.state.workspace.view).toBe("forum-thread"),
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
    });
    expect(runtime.controller.state.capabilities.archive).toBe(false);
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

  it("adds NIP-30 tags to custom reactions", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const target = runtime.controller.state.workspace.messages[0]!;

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
