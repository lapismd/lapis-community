import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  InMemoryCommunityRelay,
  Nip29MemoryPolicy,
  createInMemoryRelayFactory,
} from "./in-memory-community-relay.js";
import {
  registerCommunityRelayContract,
  relayContractAliceKey,
} from "./relay-contract-suite.js";

const relayKey = new Uint8Array(32).fill(3);

registerCommunityRelayContract("InMemoryCommunityRelay contract", () => {
  const suffix = crypto.randomUUID();
  const relay = new InMemoryCommunityRelay({
    url: `memory://contract-${suffix}`,
    authentication: { read: true, write: true },
    policy: new Nip29MemoryPolicy({
      relaySecretKey: relayKey,
      now: () => 0,
    }),
  });
  return {
    async connection(secretKey = relayContractAliceKey) {
      await relay.authenticate((template) =>
        Promise.resolve(finalizeEvent(template, secretKey)),
      );
      return relay;
    },
    uniqueId(label: string) {
      return `${label}-${suffix}`;
    },
    dispose() {
      relay.close();
    },
  };
});

describe("InMemoryCommunityRelay fault controls", () => {
  it("counts multiple filters as a deduplicated OR and ignores limits", async () => {
    const relay = new InMemoryCommunityRelay();
    const first = finalizeEvent(
      {
        kind: 9,
        created_at: 100,
        content: "first",
        tags: [["h", "general"]],
      },
      relayContractAliceKey,
    );
    const second = finalizeEvent(
      {
        kind: 9,
        created_at: 101,
        content: "second",
        tags: [["h", "general"]],
      },
      relayContractAliceKey,
    );
    await relay.publish(first);
    await relay.publish(second);

    await expect(
      relay.countMany([
        { kinds: [9], limit: 1 },
        { ids: [first.id], "#h": ["general"] },
      ]),
    ).resolves.toEqual({ count: 2, approximate: false });
  });

  it("delivers configured duplicates and stops after subscription close", async () => {
    const relay = new InMemoryCommunityRelay({
      faults: { duplicateDeliveries: 2 },
    });
    const received: string[] = [];
    const subscription = await relay.subscribe(
      { kinds: [9], "#h": ["general"] },
      { onevent: (event) => received.push(event.id) },
    );
    const event = finalizeEvent(
      {
        kind: 9,
        created_at: 100,
        content: "live",
        tags: [["h", "general"]],
      },
      relayContractAliceKey,
    );
    await relay.publish(event);
    expect(received).toEqual([event.id, event.id]);
    subscription.close();
    await relay.publish(
      finalizeEvent(
        {
          kind: 9,
          created_at: 101,
          content: "after close",
          tags: [["h", "general"]],
        },
        relayContractAliceKey,
      ),
    );
    expect(received).toHaveLength(2);
  });

  it("provides stable relay instances and resets factory state", () => {
    const factory = createInMemoryRelayFactory();
    expect(factory.create("memory://one")).toBe(factory.relay("memory://one"));
    expect(factory.create("memory://one")).not.toBe(
      factory.create("memory://two"),
    );
    factory.reset();
    expect(factory.create("memory://one")).not.toBe(
      factory.create("memory://two"),
    );
  });
});
