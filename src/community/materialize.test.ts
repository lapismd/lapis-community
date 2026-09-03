import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  Nip29MemoryPolicy,
  createCommunityTestScenario,
  createInMemoryRelayFactory,
} from "../testing/index.js";
import { materializeCommunityWorkspace } from "./materialize.js";
import { materializeCommunitySettings } from "./materialize-settings.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";

describe("materializeCommunityWorkspace", () => {
  it("is deterministic across event order, duplicates, and replay", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: new Uint8Array(32).fill(51),
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scenario.scope.relayUrl));
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );
    const snapshot = await session.snapshot();
    const forward = materializeCommunityWorkspace(
      [scenario.scope],
      { [scenario.scope.id]: snapshot.events },
      scenario.scope.id,
      { activeRoomId: "general" },
    );
    const replayed = materializeCommunityWorkspace(
      [scenario.scope],
      {
        [scenario.scope.id]: [
          ...snapshot.events.toReversed(),
          ...snapshot.events,
        ],
      },
      scenario.scope.id,
      { activeRoomId: "general" },
    );
    expect(replayed).toEqual(forward);
    session.close();
  });

  it("keeps channel replies in their thread and projects reply and reaction summaries", () => {
    const root = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_000,
        content: "Root message",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(53),
    );
    const reply = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_010,
        content: "Thread reply",
        tags: [
          ["h", "general"],
          ["e", root.id, "memory://community.test", "root"],
          ["e", root.id, "memory://community.test", "reply"],
          ["p", root.pubkey],
        ],
      },
      new Uint8Array(32).fill(54),
    );
    const reaction = finalizeEvent(
      {
        kind: 7,
        created_at: 1_700_000_020,
        content: "👍",
        tags: [
          ["h", "general"],
          ["e", root.id],
          ["p", root.pubkey],
          ["k", "9"],
        ],
      },
      new Uint8Array(32).fill(54),
    );
    const scope = {
      id: "lapis",
      name: "Lapis Community",
      relayUrl: "memory://community.test",
      rooms: [
        {
          id: "general",
          groupId: "general",
          name: "general",
          kind: "channel" as const,
        },
      ],
    };

    const workspace = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: [root, reply, reaction] },
      scope.id,
      {
        activeRoomId: "general",
        activeThreadId: root.id,
        asOf: 1_700_000_080,
      },
    );

    expect(workspace.messages).toHaveLength(1);
    expect(workspace.messages[0]).toMatchObject({
      id: root.id,
      replyCount: 1,
      replyParticipantIds: [reply.pubkey],
      reactions: [{ emoji: "👍", count: 1 }],
    });
    expect(workspace.messages[0]?.replyLabel).toContain("last reply");
    expect(workspace.thread?.messages.map((message) => message.id)).toEqual([
      root.id,
      reply.id,
    ]);
  });

  it("orders recent forum participants and uses compact relative activity before dates", () => {
    const topic = finalizeEvent(
      {
        kind: 11,
        created_at: 1_700_000_000,
        content: "Forum topic",
        tags: [
          ["h", "support"],
          ["title", "Forum activity"],
        ],
      },
      new Uint8Array(32).fill(60),
    );
    const oldTopic = finalizeEvent(
      {
        kind: 11,
        created_at: 1_665_440_000,
        content: "Old forum topic",
        tags: [
          ["h", "support"],
          ["title", "Older activity"],
        ],
      },
      new Uint8Array(32).fill(61),
    );
    const replyKeys = [61, 62, 63, 61].map((value) =>
      new Uint8Array(32).fill(value),
    );
    const replies = replyKeys.map((key, index) =>
      finalizeEvent(
        {
          kind: 1_111,
          created_at: 1_700_000_060 + index * 60,
          content: `Reply ${index + 1}`,
          tags: [
            ["h", "support"],
            ["E", topic.id],
          ],
        },
        key,
      ),
    );
    const scope = {
      id: "lapis",
      name: "Lapis Community",
      relayUrl: "memory://community.test",
      rooms: [
        {
          id: "support",
          groupId: "support",
          name: "support",
          kind: "forum" as const,
        },
      ],
    };

    const workspace = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: [oldTopic, topic, ...replies] },
      scope.id,
      { activeRoomId: "support", asOf: 1_700_007_440 },
    );

    expect(workspace.topics[0]).toMatchObject({
      id: topic.id,
      replyCount: 4,
      participantIds: [
        replies[3]!.pubkey,
        replies[2]!.pubkey,
        replies[1]!.pubkey,
      ],
      lastActivityLabel: "2h",
    });
    expect(workspace.topics[1]).toMatchObject({
      id: oldTopic.id,
      participantIds: [],
      lastActivityLabel: "Oct 2022",
    });
  });
});

describe("materializeCommunitySettings", () => {
  it("does not mutate events while verifying profile metadata", () => {
    const event = Object.freeze(
      structuredClone(
        finalizeEvent(
          {
            kind: 0,
            created_at: 1_700_000_000,
            content: JSON.stringify({ display_name: "Reader" }),
            tags: [],
          },
          new Uint8Array(32).fill(52),
        ),
      ),
    );

    expect(materializeCommunitySettings([event], event.pubkey).profile).toEqual(
      expect.objectContaining({ displayName: "Reader" }),
    );
  });
});
