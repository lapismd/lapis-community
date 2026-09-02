import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

import {
  InMemoryCommunityRelay,
  Nip29MemoryPolicy,
  createInMemoryRelayFactory,
} from "./in-memory-community-relay.js";

const aliceKey = new Uint8Array(32).fill(1);
const bobKey = new Uint8Array(32).fill(2);
const relayKey = new Uint8Array(32).fill(3);

function sign(secretKey: Uint8Array, template: NostrEventTemplate): NostrEvent {
  return finalizeEvent(template, secretKey);
}

function message(
  secretKey: Uint8Array,
  createdAt: number,
  content: string,
  groupId = "general",
): NostrEvent {
  return sign(secretKey, {
    kind: 9,
    created_at: createdAt,
    content,
    tags: [["h", groupId]],
  });
}

describe("InMemoryCommunityRelay", () => {
  it("queries, counts, filters, and orders the retained event set", async () => {
    const relay = new InMemoryCommunityRelay();
    const first = message(aliceKey, 100, "first");
    const second = message(bobKey, 101, "second");
    const elsewhere = message(aliceKey, 102, "elsewhere", "random");
    await relay.publish(first);
    await relay.publish(second);
    await relay.publish(elsewhere);

    expect(
      (await relay.query({ kinds: [9], "#h": ["general"] })).map(
        (event) => event.id,
      ),
    ).toEqual([second.id, first.id]);
    expect(
      await relay.count({ kinds: [9], authors: [getPublicKey(aliceKey)] }),
    ).toBe(2);
    expect((await relay.query({ kinds: [9], limit: 1 }))[0]?.id).toBe(
      elsewhere.id,
    );
  });

  it("validates publishes and retains only the newest addressable event", async () => {
    const relay = new InMemoryCommunityRelay();
    const older = sign(aliceKey, {
      kind: 30_078,
      created_at: 100,
      content: "older",
      tags: [["d", "community-state"]],
    });
    const newer = sign(aliceKey, {
      kind: 30_078,
      created_at: 101,
      content: "newer",
      tags: [["d", "community-state"]],
    });
    await relay.publish(older);
    await relay.publish(newer);
    await relay.publish(older);

    expect(await relay.query({ kinds: [30_078] })).toMatchObject([
      { id: newer.id, content: "newer" },
    ]);
    await expect(
      relay.publish({ ...newer, content: "tampered" }),
    ).rejects.toThrow("invalid Nostr event");
  });

  it("delivers live events, supports deterministic duplicates, and closes", async () => {
    const relay = new InMemoryCommunityRelay({
      faults: { duplicateDeliveries: 2 },
    });
    const received: string[] = [];
    let closed = "";
    const subscription = await relay.subscribe(
      { kinds: [9], "#h": ["general"] },
      {
        onevent: (event) => received.push(event.id),
        onclose: (reason) => {
          closed = reason;
        },
      },
    );
    const event = message(aliceKey, 100, "live");
    await relay.publish(event);
    expect(received).toEqual([event.id, event.id]);

    subscription.close("test complete");
    expect(closed).toBe("test complete");
    await relay.publish(message(aliceKey, 101, "after close"));
    expect(received).toHaveLength(2);
  });

  it("requires and verifies NIP-42 authentication when configured", async () => {
    const relay = new InMemoryCommunityRelay({
      authentication: { read: true, write: true },
    });
    await expect(relay.query({ kinds: [9] })).rejects.toThrow(
      "NIP-42 authentication required",
    );
    await relay.authenticate(async (template) => sign(aliceKey, template));
    expect(relay.authenticatedPubkey).toBe(getPublicKey(aliceKey));
    await expect(
      relay.publish(message(aliceKey, 100, "signed in")),
    ).resolves.toMatchObject({ accepted: true });
  });

  it("applies author deletions", async () => {
    const relay = new InMemoryCommunityRelay();
    const target = message(aliceKey, 100, "delete me");
    await relay.publish(target);
    await relay.publish(
      sign(aliceKey, {
        kind: 5,
        created_at: 101,
        content: "",
        tags: [["e", target.id]],
      }),
    );
    expect(await relay.query({ ids: [target.id] })).toEqual([]);
  });

  it("creates relay-signed NIP-29 state and enforces administrator actions", async () => {
    const relay = new InMemoryCommunityRelay({
      now: () => 100,
      policy: new Nip29MemoryPolicy({
        relaySecretKey: relayKey,
        now: () => 100,
      }),
    });
    await relay.publish(
      sign(aliceKey, {
        kind: 9_007,
        created_at: 100,
        content: JSON.stringify({ name: "General" }),
        tags: [
          ["h", "general"],
          ["supported_kinds", "9", "7"],
        ],
      }),
    );
    expect(
      await relay.query({ kinds: [39_000, 39_001, 39_002], "#d": ["general"] }),
    ).toHaveLength(3);

    await relay.publish(
      sign(bobKey, {
        kind: 9_021,
        created_at: 101,
        content: "",
        tags: [["h", "general"]],
      }),
    );
    const members = await relay.query({
      kinds: [39_002],
      "#d": ["general"],
    });
    expect(members[0]?.tags).toContainEqual(["p", getPublicKey(bobKey)]);

    await expect(
      relay.publish(
        sign(bobKey, {
          kind: 9_002,
          created_at: 102,
          content: "",
          tags: [
            ["h", "general"],
            ["name", "Not allowed"],
          ],
        }),
      ),
    ).rejects.toThrow("administrator permission required");
  });

  it("provides stable relay instances through the factory boundary", () => {
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
