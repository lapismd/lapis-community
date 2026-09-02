import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  Nip29MemoryPolicy,
  createCommunityTestScenario,
  createInMemoryRelayFactory,
} from "../testing/index.js";
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
