import { describe, expect, it, vi } from "vitest";
import {
  createCommunityTestScenario,
  createInMemoryRelayFactory,
} from "../testing/index.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";

describe("bounded history and independent live observation", () => {
  it("keeps unrelated communities from crowding out a scoped Inbox page", async () => {
    const scenario = createCommunityTestScenario();
    const factory = createInMemoryRelayFactory();
    const relay = factory.relay(scenario.scope.relayUrl);
    for (const event of scenario.events) relay.inject(event);
    const pubkey = await scenario.operator.getPublicKey();
    for (let index = 0; index < 120; index++) {
      relay.inject(
        await scenario.member.signEvent({
          kind: 9,
          created_at: 1_800_000_000 + index,
          content: `Unrelated mention ${index}`,
          tags: [
            ["h", "another-community"],
            ["p", pubkey],
          ],
        }),
      );
    }
    const query = vi.spyOn(relay, "query");
    const session = await createNip29CommunitySource({
      relayFactory: factory,
    }).open(scenario.scope, { identity: scenario.operator });
    try {
      const page = await session.loadInboxWindow!();
      expect(
        page.events.some((event) => event.content === "Hello from a member"),
      ).toBe(true);
      expect(
        page.events.every(
          (event) => !event.content.startsWith("Unrelated mention"),
        ),
      ).toBe(true);
      const contentQueries = query.mock.calls.filter(([filter]) =>
        filter.kinds?.includes(9),
      );
      expect(contentQueries.length).toBeGreaterThanOrEqual(2);
      expect(contentQueries.length).toBeLessThanOrEqual(3);
      expect(contentQueries.every(([filter]) => filter["#h"]?.length)).toBe(
        true,
      );
    } finally {
      session.close();
    }
  });

  it("retains a coverage gap for a saturated timestamp without issuing an unbounded boundary query", async () => {
    const scenario = createCommunityTestScenario();
    const factory = createInMemoryRelayFactory(),
      relay = factory.relay(scenario.scope.relayUrl);
    for (let index = 0; index < 130; index++)
      relay.inject(
        await scenario.member.signEvent({
          kind: 9,
          created_at: 1_700_000_000,
          content: `Equal timestamp ${index}`,
          tags: [["h", "general"]],
        }),
      );
    const query = vi.spyOn(relay, "query");
    const session = await createNip29CommunitySource({
      relayFactory: factory,
    }).open(scenario.scope, {});
    const page = await session.loadContentWindow!({
      groupId: "general",
      collection: "channel-roots",
      limit: 50,
    });
    expect(page.primaryEventIds).toHaveLength(50);
    expect(page.coverageGaps).toEqual([
      expect.objectContaining({ createdAt: 1_700_000_000 }),
    ]);
    expect(
      query.mock.calls.filter(([filter]) => filter.kinds?.includes(9)),
    ).toHaveLength(1);
    expect(
      query.mock.calls.every(([filter]) => (filter.limit ?? 0) <= 100),
    ).toBe(true);
    session.close();
  });

  it("retains already-fetched replies for selected roots without extra thread queries", async () => {
    const scenario = createCommunityTestScenario();
    const factory = createInMemoryRelayFactory();
    const relay = factory.relay(scenario.scope.relayUrl);
    const root = await scenario.member.signEvent({
      kind: 9,
      created_at: 100,
      content: "Root",
      tags: [["h", "general"]],
    });
    const reply = await scenario.operator.signEvent({
      kind: 9,
      created_at: 101,
      content: "Reply",
      tags: [
        ["h", "general"],
        ["e", root.id, "", "root"],
      ],
    });
    relay.inject(root);
    relay.inject(reply);
    const query = vi.spyOn(relay, "query");
    const session = await createNip29CommunitySource({
      relayFactory: factory,
    }).open(scenario.scope, {});
    const page = await session.loadContentWindow!({
      groupId: "general",
      collection: "channel-roots",
      limit: 50,
    });
    expect(page.primaryEventIds).toEqual([root.id]);
    expect(page.events).toContainEqual(reply);
    expect(
      query.mock.calls.filter(([filter]) => filter.kinds?.includes(9)),
    ).toHaveLength(1);
    session.close();
  });

  it("loads nested forum replies by their NIP-22 root without reading other channel threads", async () => {
    const scenario = createCommunityTestScenario();
    const factory = createInMemoryRelayFactory(),
      relay = factory.relay(scenario.scope.relayUrl);
    const root = "a".repeat(64),
      parent = "b".repeat(64);
    const reply = await scenario.member.signEvent({
      kind: 1111,
      created_at: 100,
      content: "Nested forum reply",
      tags: [
        ["h", "support"],
        ["E", root],
        ["e", parent],
      ],
    });
    relay.inject(reply);
    const query = vi.spyOn(relay, "query");
    const session = await createNip29CommunitySource({
      relayFactory: factory,
    }).open(scenario.scope, {});
    const page = await session.loadContentWindow!({
      groupId: "support",
      collection: "thread",
      rootEventId: root,
      limit: 50,
    });
    expect(page.primaryEventIds).toEqual([reply.id]);
    const content = query.mock.calls.filter(([filter]) =>
      filter.kinds?.some((kind) => [9, 1111].includes(kind)),
    );
    expect(
      content.every(
        ([filter]) =>
          filter["#e"]?.includes(root) || filter["#E"]?.includes(root),
      ),
    ).toBe(true);
    session.close();
  });
  it("never replays stored content through live subscriptions", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory();
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    const subscribe = vi.spyOn(relay, "subscribe");
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );
    await session.subscribe(() => {});
    const content = subscribe.mock.calls
      .map(([filter]) => filter)
      .filter((filter) =>
        filter.kinds?.some((kind) => [9, 11, 1111, 1059, 40100].includes(kind)),
      );
    expect(content.length).toBeGreaterThan(0);
    expect(content.every((filter) => filter.limit === 0)).toBe(true);
    session.close();
  });

  it("returns a continuation after three sparse candidate batches instead of scanning the channel", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory();
    const relay = relayFactory.relay(scenario.scope.relayUrl);
    for (let index = 0; index < 350; index++)
      relay.inject(
        await scenario.member.signEvent({
          kind: 9,
          created_at: 1_700_000_000 + index,
          content: "Thread reply",
          tags: [
            ["h", "general"],
            ["e", "a".repeat(64), "", "root"],
          ],
        }),
      );
    const query = vi.spyOn(relay, "query");
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      {},
    );
    const page = await session.loadContentWindow!({
      groupId: "general",
      collection: "channel-roots",
      limit: 50,
    });
    expect(page.primaryEventIds).toHaveLength(0);
    expect(page.hasOlder).toBe(true);
    expect(page.olderCursor).toBeDefined();
    const candidateQueries = query.mock.calls.filter(([filter]) =>
      filter.kinds?.includes(9),
    );
    expect(candidateQueries).toHaveLength(3);
    expect(candidateQueries.every(([filter]) => filter.limit === 100)).toBe(
      true,
    );
    query.mockClear();
    await session.loadContentWindow!({
      groupId: "general",
      collection: "channel-roots",
      limit: 50,
      before: page.olderCursor!,
    });
    expect(
      query.mock.calls.filter(([filter]) => filter.kinds?.includes(9)).length,
    ).toBeLessThanOrEqual(3);
    expect(
      query.mock.calls.every(
        ([filter]) => !filter.limit || filter.limit <= 100,
      ),
    ).toBe(true);
    session.close();
  });
});
