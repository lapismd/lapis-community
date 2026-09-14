import { describe, it, expect } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import {
  createInMemoryRelayFactory,
  createCommunityTestScenario,
} from "../testing/index.js";
import type { CommunityRelayFactory } from "../nostr/index.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";
import {
  communityRooms,
  materializeCommunityWorkspace,
  materializeCommunityInbox,
} from "./materialize.js";
import { buzzHiddenChannels } from "./buzz-direct-messages.js";
import { createNip17GiftWraps } from "./nip17.js";
const key = new Uint8Array(32).fill(82),
  relayPubkey = getPublicKey(key),
  groupId = "a".repeat(64);
const signed = (
  kind: number,
  tags: string[][],
  created_at = 10,
  content = "",
) => finalizeEvent({ kind, tags, created_at, content }, key);
describe("Buzz direct messaging", () => {
  it("discovers signed private DM membership, keeps its transport, and applies only owner-scoped relay visibility", async () => {
    const scenario = createCommunityTestScenario();
    const owner = await scenario.operator.getPublicKey(),
      peer = await scenario.member.getPublicKey();
    const scope = { ...scenario.scope, rooms: [], discoverPublicRooms: true };
    const metadata = signed(39000, [
      ["d", groupId],
      ["channel_type", "dm"],
      ["private"],
      ["supported_kinds", "9"],
    ]);
    const members = signed(39002, [
      ["d", groupId],
      ["p", owner],
      ["p", peer],
    ]);
    const message = await scenario.member.signEvent({
      kind: 9,
      created_at: 11,
      tags: [["h", groupId]],
      content: "Existing Buzz message",
    });
    const events = [metadata, members, message];
    const workspace = materializeCommunityWorkspace(
      [scope],
      { [scope.id]: events },
      scope.id,
      { identityPubkey: owner, activeRoomId: groupId },
    );
    const room = workspace.navigationSections.find(
      (section) => section.id === "direct-messages",
    )?.rooms[0];
    expect(room).toMatchObject({
      id: groupId,
      kind: "direct",
      conversation: { transport: "buzz-dm", groupId },
    });
    expect(workspace.messages.map((message) => message.content)).toContain(
      "Existing Buzz message",
    );
    expect(
      materializeCommunityInbox([scope], { [scope.id]: events }, owner)
        ?.items[0],
    ).toMatchObject({
      categories: ["Direct messages"],
      conversation: { transport: "buzz-dm" },
    });
    const hidden = signed(
      30622,
      [
        ["d", owner],
        ["p", owner],
        ["h", groupId],
      ],
      20,
    );
    expect(buzzHiddenChannels([hidden], owner, relayPubkey).has(groupId)).toBe(
      true,
    );
    expect(buzzHiddenChannels([hidden], peer, relayPubkey).size).toBe(0);
    expect(
      materializeCommunityWorkspace(
        [scope],
        { [scope.id]: [...events, hidden] },
        scope.id,
        { identityPubkey: owner },
      ).navigationSections.find((section) => section.id === "direct-messages")
        ?.rooms,
    ).toHaveLength(0);
    const stranger = await scenario.participant.signEvent({
      kind: 39002,
      created_at: 30,
      tags: [
        ["d", groupId],
        ["p", owner],
      ],
      content: "",
    });
    expect(
      materializeCommunityWorkspace(
        [scope],
        { [scope.id]: [metadata, stranger, message] },
        scope.id,
        { identityPubkey: owner },
      ).navigationSections.flatMap((section) => section.rooms),
    ).toHaveLength(0);
  });
  it("opens, hides and reopens with exact Buzz commands and verifies the acknowledged participant set", async () => {
    const scenario = createCommunityTestScenario({
      relayUrl: "wss://buzz-fixture.test/",
    });
    const owner = await scenario.operator.getPublicKey(),
      peer = await scenario.member.getPublicKey();
    const base = createInMemoryRelayFactory();
    let stamp = 20;
    const commands: number[] = [];
    const factory: CommunityRelayFactory = {
      create(url) {
        const relay = base.create(url);
        return new Proxy(relay, {
          get(target, property) {
            if (property === "publish")
              return async (
                event: import("../protocol/index.js").NostrEvent,
              ) => {
                if (event.kind !== 41010 && event.kind !== 41012)
                  return target.publish(event);
                commands.push(event.kind);
                base
                  .relay(url)
                  .inject(
                    signed(
                      39000,
                      [
                        ["d", groupId],
                        ["channel_type", "dm"],
                        ["private"],
                        ["supported_kinds", "9"],
                      ],
                      stamp,
                    ),
                  );
                base.relay(url).inject(
                  signed(
                    39002,
                    [
                      ["d", groupId],
                      ["p", owner],
                      ["p", peer],
                    ],
                    stamp,
                  ),
                );
                base
                  .relay(url)
                  .inject(
                    signed(
                      30622,
                      [
                        ["d", owner],
                        ["p", owner],
                        ...(event.kind === 41012 ? [["h", groupId]] : []),
                      ],
                      ++stamp,
                    ),
                  );
                return {
                  accepted: true,
                  message:
                    "response:" + JSON.stringify({ channel_id: groupId }),
                };
              };
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    };
    const source = createNip29CommunitySource({
      relayFactory: factory,
      fetch: async () =>
        new Response(
          JSON.stringify({
            software: "https://github.com/block/buzz",
            self: relayPubkey,
          }),
          { status: 200 },
        ),
    });
    const session = await source.open(
      { ...scenario.scope, rooms: [], discoverPublicRooms: true },
      { identity: scenario.operator },
    );
    expect((await session.snapshot()).capabilities.buzzDirectMessages).toBe(
      true,
    );
    expect((await session.openBuzzDirectMessage!([peer])).room.transport).toBe(
      "buzz-dm",
    );
    await session.hideBuzzDirectMessage!(groupId);
    expect(
      buzzHiddenChannels(
        base.relay(scenario.scope.relayUrl).events,
        owner,
        relayPubkey,
      ).has(groupId),
    ).toBe(true);
    await session.openBuzzDirectMessage!([peer]);
    expect(
      buzzHiddenChannels(
        base.relay(scenario.scope.relayUrl).events,
        owner,
        relayPubkey,
      ).size,
    ).toBe(0);
    expect(commands).toEqual([41010, 41012, 41010]);
    await expect(
      session.openBuzzDirectMessage!([
        await scenario.participant.getPublicKey(),
      ]),
    ).rejects.toThrow("different DM participant set");
    session.close();
  });
  it("loads and pages encrypted Inbox history even when there are no channels", async () => {
    const scenario = createCommunityTestScenario();
    const owner = await scenario.operator.getPublicKey();
    const factory = createInMemoryRelayFactory();
    const relay = factory.relay(scenario.scope.relayUrl);
    for (let i = 0; i < 101; i++) {
      const wraps = await createNip17GiftWraps({
        identity: scenario.member,
        recipients: [owner],
        content: `message ${i}`,
        createdAt: 1000 + i,
        randomOffsetSeconds: () => 0,
      });
      relay.inject(
        wraps.find((event) =>
          event.tags.some((tag) => tag[0] === "p" && tag[1] === owner),
        )!,
      );
    }
    const session = await createNip29CommunitySource({
      relayFactory: factory,
    }).open(
      { ...scenario.scope, rooms: [], groupId: "" },
      { identity: scenario.operator },
    );
    const first = await session.snapshot();
    expect(first.privateEvents).toHaveLength(100);
    expect(first.hasOlderDirectMessages).toBe(true);
    const second = await session.loadDirectHistory!();
    expect(second.privateEvents?.map((event) => event.content)).toEqual([
      "message 0",
    ]);
    expect(second.hasOlderDirectMessages).toBe(false);
    session.close();
  }, 15000);
});

it("requires fresh membership for explicitly configured Buzz DMs", async () => {
  const scenario = createCommunityTestScenario();
  const owner = await scenario.operator.getPublicKey();
  const peer = await scenario.member.getPublicKey();
  const scope = {
    ...scenario.scope,
    discoverPublicRooms: false,
    rooms: [
      {
        id: groupId,
        groupId,
        name: "Private",
        kind: "channel" as const,
        transport: "buzz-dm" as const,
      },
    ],
  };
  const metadata = signed(39000, [
    ["d", groupId],
    ["private"],
    ["channel_type", "dm"],
  ]);
  const members = signed(39002, [
    ["d", groupId],
    ["p", owner],
    ["p", peer],
  ]);
  expect(communityRooms(scope, [metadata, members], owner)).toHaveLength(1);
  expect(
    communityRooms(scope, [metadata, members], "e".repeat(64)),
  ).toHaveLength(0);
  const revoked = signed(
    39002,
    [
      ["d", groupId],
      ["p", peer],
    ],
    11,
  );
  expect(
    communityRooms(scope, [metadata, members, revoked], owner),
  ).toHaveLength(0);
});
