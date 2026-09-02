import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  Nip29MemoryPolicy,
  createCommunityTestScenario,
  createInMemoryRelayFactory,
} from "../testing/index.js";
import { materializeCommunityWorkspace } from "./materialize.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";

const relayKey = new Uint8Array(32).fill(41);

describe("createNip29CommunitySource", () => {
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
    expect(snapshot.events.some((event) => event.kind === 7)).toBe(true);
    expect(snapshot.capabilities.archive).toBe(false);
    session.close();
  });

  it("discovers public channel and forum groups from authoritative metadata", async () => {
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
});
