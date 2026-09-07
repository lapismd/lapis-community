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

  it("retains registry control events without exposing them as community content", async () => {
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
    const head = await scenario.operator.signEvent({
      kind: 9,
      created_at: 1_700_000_016,
      content: JSON.stringify({ schema: "lapis.registry.plugin-head/1" }),
      tags: [
        ["h", "general"],
        ["t", "lapis-plugin-registry-head"],
        ["t", "plugin:ai"],
      ],
    });
    await relay.publish(head);

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

    expect(snapshot.events.map((event) => event.id)).toEqual(
      expect.arrayContaining([authorization.id, head.id]),
    );
    expect(workspace.messages.map((message) => message.id)).toEqual(
      expect.not.arrayContaining([authorization.id, head.id]),
    );
    await expect(session.search("lapis.registry")).resolves.toEqual([]);
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

  it("bootstraps authoritative state without querying unbounded room history", async () => {
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
      strategy: "bootstrap",
      plan: { checkpoints: [], cachedEventIds: [] },
    });

    expect(snapshot?.complete).toBe(false);
    expect(snapshot?.events.some((event) => event.kind === 39_000)).toBe(true);
    expect(
      query.mock.calls.some(
        ([filter]) =>
          filter["#h"] !== undefined &&
          filter.kinds?.some((kind) => [9, 11, 1_111].includes(kind)),
      ),
    ).toBe(false);
    session.close();
  });

  it("loads deterministic bounded room windows with exclusive cursors", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    await scenario.seed(relay);
    for (let index = 0; index < 5; index += 1) {
      await relay.publish(
        await scenario.member.signEvent({
          kind: 9,
          created_at: 1_700_000_100 + index,
          content: `Paged message ${index + 1}`,
          tags: [["h", "general"]],
        }),
      );
    }
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );

    const latest = await session.loadContentWindow?.({
      collection: "channel-roots",
      groupId: "general",
      limit: 2,
    });
    expect(latest?.primaryEventIds).toHaveLength(2);
    expect(latest?.hasOlder).toBe(true);
    const previous = await session.loadContentWindow?.({
      collection: "channel-roots",
      groupId: "general",
      before: latest!.olderCursor!,
      limit: 2,
    });
    expect(previous?.primaryEventIds).toHaveLength(2);
    expect(
      previous?.primaryEventIds.some((id) =>
        latest?.primaryEventIds.includes(id),
      ),
    ).toBe(false);
    session.close();
  });

  it("globally bounds merged relay windows and authenticates each relay once", async () => {
    const scenario = createCommunityTestScenario({
      relayUrl: "memory://bounded-primary.test",
    });
    const mirrorUrl = "memory://bounded-mirror.test";
    const scope = { ...scenario.scope, readRelayUrls: [mirrorUrl] };
    const relayFactory = createInMemoryRelayFactory();
    const primary = relayFactory.relay(scope.relayUrl);
    const mirror = relayFactory.relay(mirrorUrl);
    const events = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        scenario.member.signEvent({
          kind: 9,
          created_at: 1_700_000_100 + index,
          content: `Merged message ${index + 1}`,
          tags: [["h", "merged"]],
        }),
      ),
    );
    primary.inject(events[0]!);
    primary.inject(events[2]!);
    mirror.inject(events[1]!);
    mirror.inject(events[2]!);
    mirror.inject(events[3]!);
    const primaryAuthenticate = vi.spyOn(primary, "authenticate");
    const mirrorAuthenticate = vi.spyOn(mirror, "authenticate");
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scope,
      { identity: scenario.operator },
    );

    const first = await session.loadContentWindow?.({
      collection: "channel-roots",
      groupId: "merged",
      limit: 2,
    });
    const second = await session.loadContentWindow?.({
      collection: "channel-roots",
      groupId: "merged",
      limit: 2,
    });

    expect(first?.primaryEventIds).toEqual([events[2]!.id, events[3]!.id]);
    expect(second?.primaryEventIds).toEqual(first?.primaryEventIds);
    expect(primaryAuthenticate).toHaveBeenCalledTimes(1);
    expect(mirrorAuthenticate).toHaveBeenCalledTimes(1);
    session.close();
  });

  it("loads channel lifecycle history only from the authoritative relay", async () => {
    const scenario = createCommunityTestScenario({
      relayUrl: "memory://activity-authority.test",
    });
    const mirrorUrl = "memory://activity-mirror.test";
    const scope = { ...scenario.scope, readRelayUrls: [mirrorUrl] };
    const relayFactory = createInMemoryRelayFactory();
    const authority = relayFactory.relay(scope.relayUrl);
    const mirror = relayFactory.relay(mirrorUrl);
    const acceptedCreation = await scenario.operator.signEvent({
      kind: 9_007,
      created_at: 1_700_000_100,
      content: "",
      tags: [["h", "general"]],
    });
    const mirrorOnlyRemoval = await scenario.operator.signEvent({
      kind: 9_001,
      created_at: 1_700_000_101,
      content: "",
      tags: [
        ["h", "general"],
        ["p", await scenario.member.getPublicKey()],
      ],
    });
    authority.inject(acceptedCreation);
    mirror.inject(mirrorOnlyRemoval);
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scope,
      { identity: scenario.operator },
    );

    const history = await session.loadContentWindow?.({
      collection: "channel-roots",
      groupId: "general",
      limit: 10,
    });

    expect(history?.primaryEventIds).toContain(acceptedCreation.id);
    expect(history?.primaryEventIds).not.toContain(mirrorOnlyRemoval.id);
    session.close();
  });

  it("fills channel-root windows across reply-dense bounded relay pages", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 1_700_000_000,
      }),
    });
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    const roots = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        scenario.member.signEvent({
          kind: 9,
          created_at: 1_700_000_100 + index,
          content: `Root ${index + 1}`,
          tags: [["h", "dense"]],
        }),
      ),
    );
    for (const root of roots) relay.inject(root);
    for (let index = 0; index < 120; index += 1) {
      relay.inject(
        await scenario.member.signEvent({
          kind: 9,
          created_at: 1_700_000_200 + index,
          content: `Reply ${index + 1}`,
          tags: [
            ["h", "dense"],
            ["e", roots[2]!.id, "", "root"],
          ],
        }),
      );
    }
    const query = vi.spyOn(relay, "query");
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );

    const latest = await session.loadContentWindow?.({
      collection: "channel-roots",
      groupId: "dense",
      limit: 2,
    });
    expect(latest?.primaryEventIds).toEqual([roots[1]!.id, roots[2]!.id]);
    expect(latest?.hasOlder).toBe(true);
    const previous = await session.loadContentWindow?.({
      collection: "channel-roots",
      groupId: "dense",
      before: latest!.olderCursor!,
      limit: 2,
    });
    expect(previous?.primaryEventIds).toEqual([roots[0]!.id]);
    expect(previous?.hasOlder).toBe(false);
    expect(
      query.mock.calls
        .map(([filter]) => filter)
        .filter((filter) => filter["#h"]?.includes("dense"))
        .every(
          (filter) =>
            filter.limit !== undefined &&
            (filter.limit <= 100 || filter.limit === 1_001),
        ),
    ).toBe(true);
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
