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
    const mentionedPubkey = "ab".repeat(32);
    const root = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_000,
        content: "Root message",
        tags: [
          ["h", "general"],
          ["p", mentionedPubkey],
          ["P", mentionedPubkey],
        ],
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
    const deletedMessage = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_015,
        content: "Deleted message",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(55),
    );
    const deletion = finalizeEvent(
      {
        kind: 5,
        created_at: 1_700_000_020,
        content: "",
        tags: [["e", deletedMessage.id]],
      },
      new Uint8Array(32).fill(55),
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
          description: "General project coordination.",
        },
      ],
    };

    const workspace = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: [root, reply, reaction, deletedMessage, deletion] },
      scope.id,
      {
        activeRoomId: "general",
        activeThreadId: root.id,
        asOf: 1_700_000_080,
      },
    );

    expect(workspace.messages).toHaveLength(1);
    expect(workspace.navigationSections[0]?.rooms[0]).toMatchObject({
      groupId: "general",
      description: "General project coordination.",
      messageCount: 2,
      lastActivityAt: "2023-11-14T22:13:30.000Z",
    });
    expect(workspace.messages[0]).toMatchObject({
      id: root.id,
      replyCount: 1,
      replyParticipantIds: [reply.pubkey],
      reactions: [{ emoji: "👍", count: 1 }],
      mentionPubkeys: [mentionedPubkey],
    });
    expect(workspace.messages[0]?.replyLabel).toContain("last reply");
    expect(workspace.thread?.messages.map((message) => message.id)).toEqual([
      root.id,
      reply.id,
    ]);
    expect(workspace.thread?.messages[1]?.mentionPubkeys).toEqual([
      root.pubkey,
    ]);
  });

  it("projects accepted channel creation and membership commands as timeline activity", () => {
    const operatorKey = new Uint8Array(32).fill(61);
    const memberKey = new Uint8Array(32).fill(62);
    const created = finalizeEvent(
      {
        kind: 9_007,
        created_at: 1_700_000_000,
        content: "",
        tags: [["h", "general"]],
      },
      operatorKey,
    );
    const memberProfile = finalizeEvent(
      {
        kind: 0,
        created_at: 1_700_000_001,
        content: JSON.stringify({ display_name: "Maya Chen" }),
        tags: [],
      },
      memberKey,
    );
    const added = finalizeEvent(
      {
        kind: 9_000,
        created_at: 1_700_000_002,
        content: "",
        tags: [
          ["h", "general"],
          ["p", memberProfile.pubkey, "member"],
        ],
      },
      operatorKey,
    );
    const removed = finalizeEvent(
      {
        kind: 9_001,
        created_at: 1_700_000_003,
        content: "",
        tags: [
          ["h", "general"],
          ["p", memberProfile.pubkey],
        ],
      },
      operatorKey,
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
      { [scope.id]: [removed, memberProfile, created, added] },
      scope.id,
      { activeRoomId: "general", identityPubkey: created.pubkey },
    );

    expect(workspace.messages).toMatchObject([
      {
        id: created.id,
        authorId: created.pubkey,
        activity: { type: "channel-created" },
      },
      {
        id: added.id,
        authorId: added.pubkey,
        activity: {
          type: "member-added",
          targetMemberId: memberProfile.pubkey,
        },
      },
      {
        id: removed.id,
        authorId: removed.pubkey,
        activity: {
          type: "member-removed",
          targetMemberId: memberProfile.pubkey,
        },
      },
    ]);
    expect(
      workspace.members.find((member) => member.id === memberProfile.pubkey),
    ).toMatchObject({ name: "Maya Chen" });
  });

  it("projects only the latest same-author, same-room message edit", () => {
    const authorKey = new Uint8Array(32).fill(55);
    const otherKey = new Uint8Array(32).fill(56);
    const original = finalizeEvent(
      {
        kind: 9,
        created_at: 10,
        content: "Original message",
        tags: [["h", "general"]],
      },
      authorKey,
    );
    const firstEdit = finalizeEvent(
      {
        kind: 40_003,
        created_at: 11,
        content: "First correction",
        tags: [
          ["h", "general"],
          ["e", original.id],
        ],
      },
      authorKey,
    );
    const forgedEdit = finalizeEvent(
      {
        kind: 40_003,
        created_at: 13,
        content: "Forged correction",
        tags: [
          ["h", "general"],
          ["e", original.id],
        ],
      },
      otherKey,
    );
    const wrongRoomEdit = finalizeEvent(
      {
        kind: 40_003,
        created_at: 14,
        content: "Wrong room correction",
        tags: [
          ["h", "elsewhere"],
          ["e", original.id],
        ],
      },
      authorKey,
    );
    const latestEdit = finalizeEvent(
      {
        kind: 40_003,
        created_at: 12,
        content: "Final correction",
        tags: [
          ["h", "general"],
          ["e", original.id],
        ],
      },
      authorKey,
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
      {
        [scope.id]: [
          wrongRoomEdit,
          forgedEdit,
          latestEdit,
          original,
          firstEdit,
        ],
      },
      scope.id,
      { activeRoomId: "general" },
    );

    expect(workspace.messages).toHaveLength(1);
    expect(workspace.messages[0]).toMatchObject({
      id: original.id,
      content: "Final correction",
      edited: true,
      sourceEvent: original,
    });
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

  it("derives publish availability from membership and writer roles", () => {
    const reader = finalizeEvent(
      { kind: 0, created_at: 1, content: "{}", tags: [] },
      new Uint8Array(32).fill(70),
    );
    const writer = finalizeEvent(
      { kind: 0, created_at: 1, content: "{}", tags: [] },
      new Uint8Array(32).fill(71),
    );
    const relayKey = new Uint8Array(32).fill(72);
    const events = [
      finalizeEvent(
        {
          kind: 39_000,
          created_at: 2,
          content: JSON.stringify({ "write-restricted": true }),
          tags: [["d", "writers"], ["write-restricted"]],
        },
        relayKey,
      ),
      finalizeEvent(
        {
          kind: 39_001,
          created_at: 2,
          content: "",
          tags: [["d", "writers"]],
        },
        relayKey,
      ),
      finalizeEvent(
        {
          kind: 39_002,
          created_at: 2,
          content: "",
          tags: [
            ["d", "writers"],
            ["p", reader.pubkey, "member"],
            ["p", writer.pubkey, "writer"],
          ],
        },
        relayKey,
      ),
    ];
    const scope = {
      id: "lapis",
      name: "Lapis Community",
      relayUrl: "memory://community.test",
      rooms: [
        {
          id: "writers",
          groupId: "writers",
          name: "writers",
          kind: "channel" as const,
        },
      ],
    };
    const project = (identityPubkey?: string) =>
      materializeCommunityWorkspace([scope], { [scope.id]: events }, scope.id, {
        activeRoomId: "writers",
        ...(identityPubkey === undefined ? {} : { identityPubkey }),
      }).navigationSections[0]?.rooms[0];

    expect(project()?.lastActivityAt).toBe("1970-01-01T00:00:02.000Z");
    expect(project()?.permissions?.publish.state).toBe(
      "requires-authentication",
    );
    expect(project(reader.pubkey)?.permissions?.publish).toMatchObject({
      state: "denied",
      reason: "A writer or administrator role is required to publish here",
    });
    expect(project(reader.pubkey)?.permissions?.react).toEqual({
      state: "enabled",
    });
    expect(project(reader.pubkey)?.permissions?.manageMembers.state).toBe(
      "denied",
    );
    expect(project(writer.pubkey)?.permissions?.publish.state).toBe("enabled");
    const outsider = finalizeEvent(
      { kind: 0, created_at: 1, content: "{}", tags: [] },
      new Uint8Array(32).fill(74),
    );
    const closedEvents = events.map((event) =>
      event.kind === 39_000
        ? finalizeEvent(
            {
              kind: 39_000,
              created_at: 3,
              content: JSON.stringify({
                closed: true,
                "write-restricted": true,
              }),
              tags: [["d", "writers"], ["closed"], ["write-restricted"]],
            },
            relayKey,
          )
        : event,
    );
    const closedOutsider = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: closedEvents },
      scope.id,
      { activeRoomId: "writers", identityPubkey: outsider.pubkey },
    ).navigationSections[0]?.rooms[0];
    expect(closedOutsider?.permissions?.publish.requirement).toBe("membership");
    expect(closedOutsider?.permissions?.react).toMatchObject({
      state: "denied",
      requirement: "membership",
    });
    const unknownMembership = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: events.filter((event) => event.kind !== 39_002) },
      scope.id,
      { activeRoomId: "writers", identityPubkey: reader.pubkey },
    ).navigationSections[0]?.rooms[0];
    expect(unknownMembership).toMatchObject({
      membership: "unknown",
      permissions: { publish: { state: "enabled" } },
    });
    const unknownPermission = materializeCommunityWorkspace(
      [scope],
      {
        [scope.id]: events.filter(
          (event) => event.kind !== 39_001 && event.kind !== 39_002,
        ),
      },
      scope.id,
      { activeRoomId: "writers", identityPubkey: reader.pubkey },
    ).navigationSections[0]?.rooms[0];
    expect(unknownPermission?.permissions?.manageMembers.state).toBe("enabled");
  });

  it("projects multiple member roles and only authority-matched role definitions", () => {
    const relayKey = new Uint8Array(32).fill(81);
    const attackerKey = new Uint8Array(32).fill(82);
    const member = finalizeEvent(
      { kind: 0, created_at: 1, content: "{}", tags: [] },
      new Uint8Array(32).fill(83),
    );
    const administrator = finalizeEvent(
      { kind: 0, created_at: 1, content: "{}", tags: [] },
      new Uint8Array(32).fill(84),
    );
    const events = [
      finalizeEvent(
        {
          kind: 39_000,
          created_at: 2,
          content: "{}",
          tags: [["d", "roles"], ["write-restricted"]],
        },
        relayKey,
      ),
      finalizeEvent(
        {
          kind: 39_001,
          created_at: 3,
          content: "",
          tags: [
            ["d", "roles"],
            ["p", administrator.pubkey],
          ],
        },
        relayKey,
      ),
      finalizeEvent(
        {
          kind: 39_002,
          created_at: 3,
          content: "",
          tags: [
            ["d", "roles"],
            ["p", member.pubkey, "moderator", "moderator"],
            ["p", member.pubkey, "writer"],
            ["p", administrator.pubkey],
          ],
        },
        relayKey,
      ),
      finalizeEvent(
        {
          kind: 39_003,
          created_at: 3,
          content: "",
          tags: [
            ["d", "roles"],
            ["role", "moderator", "Can moderate room content."],
          ],
        },
        relayKey,
      ),
      finalizeEvent(
        {
          kind: 39_003,
          created_at: 4,
          content: "",
          tags: [
            ["d", "roles"],
            ["role", "forged", "Ignore me"],
          ],
        },
        attackerKey,
      ),
    ];
    const scope = {
      id: "lapis",
      name: "Lapis Community",
      relayUrl: "memory://community.test",
      rooms: [
        {
          id: "roles",
          groupId: "roles",
          name: "roles",
          kind: "channel" as const,
        },
      ],
    };
    const workspace = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: events },
      scope.id,
      { activeRoomId: "roles", identityPubkey: member.pubkey },
    );

    expect(
      workspace.members.find((candidate) => candidate.id === member.pubkey),
    ).toMatchObject({
      roles: ["moderator", "writer"],
      role: "moderator",
    });
    expect(
      workspace.members.find(
        (candidate) => candidate.id === administrator.pubkey,
      ),
    ).toMatchObject({ administrator: true, role: "administrator", roles: [] });
    expect(workspace.navigationSections[0]?.rooms[0]?.roleDefinitions).toEqual([
      {
        id: "moderator",
        label: "Moderator",
        description: "Can moderate room content.",
      },
      {
        id: "writer",
        label: "Writer",
        description: "Can publish when this room is limited to writers.",
      },
    ]);
    expect(
      workspace.navigationSections[0]?.rooms[0]?.permissions?.publish.state,
    ).toBe("enabled");
  });

  it("projects the latest non-empty NIP-38 general status onto members", () => {
    const key = new Uint8Array(32).fill(73);
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 1,
        content: JSON.stringify({ display_name: "Status member" }),
        tags: [],
      },
      key,
    );
    const working = finalizeEvent(
      {
        kind: 30_315,
        created_at: 2,
        content: "🏠 Working remotely",
        tags: [["d", "general"]],
      },
      key,
    );
    const meeting = finalizeEvent(
      {
        kind: 30_315,
        created_at: 3,
        content: "🗣️ In a meeting",
        tags: [["d", "general"]],
      },
      key,
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
      { [scope.id]: [profile, working, meeting] },
      scope.id,
      { activeRoomId: "general", identityPubkey: profile.pubkey },
    );
    expect(workspace.members).toContainEqual(
      expect.objectContaining({
        id: profile.pubkey,
        status: "🗣️ In a meeting",
      }),
    );

    const cleared = finalizeEvent(
      {
        kind: 30_315,
        created_at: 4,
        content: "",
        tags: [["d", "general"]],
      },
      key,
    );
    const clearedWorkspace = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: [profile, meeting, cleared] },
      scope.id,
      { activeRoomId: "general", identityPubkey: profile.pubkey },
    );
    expect(clearedWorkspace.members[0]).not.toHaveProperty("status");
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
