import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import {
  Nip29MemoryPolicy,
  createCommunityTestScenario,
  createInMemoryRelayFactory,
} from "../testing/index.js";
import { materializeCommunityWorkspace } from "./materialize.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";

const relayKey = new Uint8Array(32).fill(41);

describe("createNip29CommunitySource", () => {
  it("treats an exact duplicate acknowledgement as idempotent success", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    const event = await scenario.operator.signEvent({
      kind: 9,
      created_at: 1_700_000_100,
      content: "Already stored",
      tags: [["h", "general"]],
    });
    relay.inject(event);
    relay.setFaults({ rejectPublish: "duplicate: event already stored" });
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );

    await expect(
      session.execute({
        type: "publish",
        template: {
          kind: event.kind,
          created_at: event.created_at,
          content: event.content,
          tags: event.tags,
        },
        optimisticEvent: event,
      }),
    ).resolves.toEqual([event]);
    session.close();
    relayFactory.reset();
  });

  it("loads group content, authoritative state, profiles, and referenced reactions", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    const target = scenario.events.find((event) => event.kind === 9)!;
    await relay.publish(
      await scenario.member.signEvent({
        kind: 7,
        created_at: 1_700_000_010,
        content: "👍",
        tags: [
          ["e", target.id],
          ["p", target.pubkey],
        ],
      }),
    );

    const source = createNip29CommunitySource({ relayFactory });
    const session = await source.open(scenario.scope, {
      identity: scenario.operator,
    });
    const snapshot = await session.snapshot();
    expect(snapshot.events.some((event) => event.kind === 39_000)).toBe(true);
    expect(snapshot.events.some((event) => event.kind === 0)).toBe(true);
    expect(snapshot.events.some((event) => event.kind === 30_315)).toBe(true);
    expect(snapshot.events.some((event) => event.kind === 7)).toBe(true);
    expect(snapshot.capabilities.archive).toBe(false);
    session.close();
  });

  it("retains publisher authorization events without exposing them as community content", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    const authorization = await scenario.operator.signEvent({
      kind: 9,
      created_at: 1_700_000_015,
      content: JSON.stringify({
        schema: "lapis.registry.publisher-authorization/1",
        status: "authorized",
      }),
      tags: [
        ["h", "general"],
        ["t", "lapis-plugin-publisher-authorization"],
        ["t", "plugin:ai"],
      ],
    });
    await relay.publish(authorization);

    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );
    const snapshot = await session.snapshot();
    const workspace = materializeCommunityWorkspace(
      [scenario.scope],
      { [scenario.scope.id]: snapshot.events },
      scenario.scope.id,
      { activeRoomId: "general" },
    );

    expect(snapshot.events.map((event) => event.id)).toContain(
      authorization.id,
    );
    expect(workspace.messages.map((message) => message.id)).not.toContain(
      authorization.id,
    );
    await expect(session.search("authorized")).resolves.toEqual([]);
    session.close();
  });

  it("discovers public rooms from standard and Buzz metadata", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    const groupId = "support-ai";
    await relay.publish(
      await scenario.operator.signEvent({
        kind: 9_007,
        created_at: 1_700_000_020,
        content: JSON.stringify({
          name: "support-ai",
          about: "Support for the AI plugin",
        }),
        tags: [
          ["h", groupId],
          ["name", "support-ai"],
          ["about", "Support for the AI plugin"],
          ["supported_kinds", "11", "1111", "7"],
        ],
      }),
    );
    const topic = await scenario.member.signEvent({
      kind: 11,
      created_at: 1_700_000_021,
      content: "How should provider fallback work?",
      tags: [
        ["h", groupId],
        ["title", "AI provider fallback"],
      ],
    });
    await relay.publish(topic);
    await relay.publish(
      await scenario.operator.signEvent({
        kind: 9_007,
        created_at: 1_700_000_022,
        content: JSON.stringify({ name: "buzz-stream" }),
        tags: [
          ["h", "buzz-stream"],
          ["name", "buzz-stream"],
          ["visibility", "open"],
          ["channel_type", "stream"],
        ],
      }),
    );
    await relay.publish(
      await scenario.operator.signEvent({
        kind: 9_007,
        created_at: 1_700_000_023,
        content: JSON.stringify({ name: "buzz-forum" }),
        tags: [
          ["h", "buzz-forum"],
          ["name", "buzz-forum"],
          ["visibility", "open"],
          ["channel_type", "forum"],
        ],
      }),
    );

    const scope = { ...scenario.scope, discoverPublicRooms: true };
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scope,
      { identity: scenario.operator },
    );
    const snapshot = await session.snapshot();
    const workspace = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: snapshot.events },
      scope.id,
      { activeRoomId: groupId },
    );

    expect(
      workspace.navigationSections
        .find((section) => section.id === "forums")
        ?.rooms.find((room) => room.id === groupId),
    ).toMatchObject({ name: "support-ai", kind: "forum" });
    expect(
      workspace.navigationSections
        .find((section) => section.id === "channels")
        ?.rooms.find((room) => room.id === "buzz-stream"),
    ).toMatchObject({ name: "buzz-stream", kind: "channel" });
    expect(
      workspace.navigationSections
        .find((section) => section.id === "forums")
        ?.rooms.find((room) => room.id === "buzz-forum"),
    ).toMatchObject({ name: "buzz-forum", kind: "forum" });
    expect(workspace.topics).toMatchObject([
      { id: topic.id, title: "AI provider fallback" },
    ]);
    session.close();
  });

  it("subscribes before snapshots without losing a concurrent event", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    const source = createNip29CommunitySource({ relayFactory });
    const session = await source.open(scenario.scope, {
      identity: scenario.operator,
    });
    const live: string[] = [];
    await session.subscribe((events) =>
      live.push(...events.map((event) => event.id)),
    );
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_020,
        content: "arrived during startup",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(42),
    );
    await relay.publish(event);
    const snapshot = await session.snapshot();
    expect(live).toContain(event.id);
    expect(snapshot.events.map((candidate) => candidate.id)).toContain(
      event.id,
    );
    session.close();
  });

  it("uses a one-second inclusive checkpoint overlap for warm content sync", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    const query = vi.spyOn(relay, "query");
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );

    const snapshot = await session.synchronize?.({
      plan: {
        cachedEventIds: [],
        checkpoints: [
          {
            relayUrl: scenario.scope.relayUrl,
            stream: "content",
            createdAt: 1_700_000_000,
            synchronizedAt: 1_700_000_010,
          },
        ],
      },
    });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ since: 1_699_999_999 }),
      undefined,
    );
    expect(snapshot?.complete).toBe(false);
    expect(snapshot?.checkpoints?.[0]?.createdAt).toBeGreaterThanOrEqual(
      1_700_000_000,
    );
    session.close();
  });

  it("publishes signed commands through only the authoritative relay", async () => {
    const scenario = createCommunityTestScenario({
      relayUrl: "memory://authority.test",
    });
    const scope = {
      ...scenario.scope,
      readRelayUrls: ["memory://mirror.test"],
    };
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scope.relayUrl));
    const source = createNip29CommunitySource({ relayFactory });
    const session = await source.open(scope, {
      identity: scenario.operator,
    });
    const [published] = await session.execute({
      type: "publish",
      template: {
        kind: 9,
        created_at: 1_700_000_030,
        content: "authority only",
        tags: [["h", "general"]],
      },
    });
    expect(
      await relayFactory.relay(scope.relayUrl).query({
        ids: [published!.id],
      }),
    ).toHaveLength(1);
    expect(
      await relayFactory.relay("memory://mirror.test").query({
        ids: [published!.id],
      }),
    ).toHaveLength(0);
    session.close();
  });

  it("routes NIP-17 gift wraps to each participant's advertised inbox relay", async () => {
    const scenario = createCommunityTestScenario({
      relayUrl: "memory://authority.test",
    });
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const authority = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(authority);
    const senderPubkey = await scenario.operator.getPublicKey();
    const recipientPubkey = await scenario.member.getPublicKey();
    const senderInbox = "memory://sender-inbox.test";
    const recipientInbox = "memory://recipient-inbox.test";
    await authority.publish(
      await scenario.operator.signEvent({
        kind: 10_050,
        created_at: 1_700_000_050,
        content: "",
        tags: [["relay", senderInbox]],
      }),
    );
    await authority.publish(
      await scenario.member.signEvent({
        kind: 10_050,
        created_at: 1_700_000_050,
        content: "",
        tags: [["relay", recipientInbox]],
      }),
    );
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );

    await session.execute({
      type: "direct-message",
      recipients: [recipientPubkey],
      content: "private route",
    });

    expect(
      await relayFactory.relay(senderInbox).count({
        kinds: [1_059],
        "#p": [senderPubkey],
      }),
    ).toBe(1);
    expect(
      await relayFactory.relay(recipientInbox).count({
        kinds: [1_059],
        "#p": [recipientPubkey],
      }),
    ).toBe(1);
    expect(await authority.count({ kinds: [1_059] })).toBe(0);
    session.close();
  });

  it("rejects a direct-message recipient without a kind 10050 inbox", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    const recipientPubkey = await scenario.member.getPublicKey();
    await relay.publish(
      await scenario.member.signEvent({
        kind: 10_050,
        created_at: 1_700_000_050,
        content: "",
        tags: [],
      }),
    );
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );

    await expect(
      session.execute({
        type: "direct-message",
        recipients: [recipientPubkey],
        content: "cannot route",
      }),
    ).rejects.toThrow("not advertised a NIP-17 inbox relay");
    session.close();
  });
});
