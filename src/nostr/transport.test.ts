import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";

const relayMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connect: vi.fn(),
  count: vi.fn(),
  countWithHLL: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("nostr-tools/relay", () => ({
  Relay: { connect: relayMocks.connect },
}));

import { WebSocketRegistryRelay } from "./transport.js";
import { authenticateRegistryRelay } from "../auth/relay-auth.js";
import type { RegistrySigner } from "../auth/types.js";

function createSigner(): RegistrySigner {
  const secretKey = generateSecretKey();
  return {
    getPublicKey: async () => getPublicKey(secretKey),
    signEvent: async (template) => finalizeEvent(template, secretKey),
  };
}

describe("WebSocketRegistryRelay", () => {
  beforeEach(() => {
    relayMocks.connect.mockReset();
    relayMocks.auth.mockReset();
    relayMocks.count.mockReset();
    relayMocks.countWithHLL.mockReset();
    relayMocks.subscribe.mockReset();
    relayMocks.connect.mockResolvedValue({
      auth: relayMocks.auth,
      close: vi.fn(),
      count: relayMocks.count,
      countWithHLL: relayMocks.countWithHLL,
      publish: vi.fn(),
      publishTimeout: 0,
      subscribe: relayMocks.subscribe,
    });
  });

  it("reuses one authentication operation across count requests", async () => {
    relayMocks.auth.mockResolvedValue("authenticated");
    relayMocks.countWithHLL.mockResolvedValue({ count: 7 });
    const relay = new WebSocketRegistryRelay("wss://relay.example", {
      eoseTimeoutMs: 100,
    });
    const signer = vi.fn();

    await relay.authenticate(signer);
    await relay.count({ kinds: [9] });
    await relay.countMany([{ kinds: [9] }, { kinds: [11] }]);

    expect(relayMocks.auth).toHaveBeenCalledTimes(1);
  });

  it("publishes with a replacement signer's authenticated connection", async () => {
    const connections = [0, 1].map(() => ({
      auth: vi.fn(
        async (
          signEvent: Parameters<
            InstanceType<typeof WebSocketRegistryRelay>["authenticate"]
          >[0],
        ) => {
          const event = await signEvent({
            kind: 22_242,
            created_at: 1,
            tags: [
              ["relay", "wss://relay.example/"],
              ["challenge", "challenge"],
            ],
            content: "",
          });
          return `authenticated ${event.pubkey}`;
        },
      ),
      close: vi.fn(),
      count: vi.fn(),
      countWithHLL: vi.fn(),
      publish: vi.fn().mockResolvedValue("stored"),
      publishTimeout: 0,
      subscribe: vi.fn(),
    }));
    relayMocks.connect
      .mockResolvedValueOnce(connections[0])
      .mockResolvedValueOnce(connections[1]);
    const relay = new WebSocketRegistryRelay("wss://relay.example");
    const reader = createSigner();
    const author = createSigner();

    await authenticateRegistryRelay(relay, reader);
    await authenticateRegistryRelay(relay, reader);
    await authenticateRegistryRelay(relay, author);
    const event = await author.signEvent({
      kind: 11,
      created_at: 2,
      tags: [["h", "support-plugin"]],
      content: "A review",
    });
    await relay.publish(event);

    expect(relayMocks.connect).toHaveBeenCalledTimes(2);
    expect(connections[0]!.auth).toHaveBeenCalledTimes(1);
    expect(connections[1]!.auth).toHaveBeenCalledTimes(1);
    expect(connections[0]!.publish).not.toHaveBeenCalled();
    expect(connections[1]!.publish).toHaveBeenCalledWith(event);
    expect(connections[0]!.close).not.toHaveBeenCalled();

    relay.close();
    await vi.waitFor(() => {
      expect(connections[0]!.close).toHaveBeenCalledOnce();
      expect(connections[1]!.close).toHaveBeenCalledOnce();
    });
  });

  it("sends the requested limit to the relay", async () => {
    relayMocks.subscribe.mockImplementation(
      (_filters: unknown, handlers: { oneose(): void }): { close(): void } => {
        queueMicrotask(() => handlers.oneose());
        return { close: vi.fn() };
      },
    );
    const relay = new WebSocketRegistryRelay("wss://relay.example", {
      eoseTimeoutMs: 100,
    });

    await expect(relay.query({ kinds: [9], limit: 20 })).resolves.toEqual([]);

    expect(relayMocks.subscribe).toHaveBeenCalledWith(
      [{ kinds: [9], limit: 20 }],
      expect.objectContaining({ eoseTimeout: 100 }),
    );
  });

  it("does not replace an unsupported COUNT with an event query", async () => {
    relayMocks.countWithHLL.mockRejectedValue(
      new Error("relay does not support NIP-45 COUNT"),
    );
    const relay = new WebSocketRegistryRelay("wss://relay.example", {
      eoseTimeoutMs: 100,
    });

    await expect(relay.count({ kinds: [9] })).rejects.toThrow(
      "does not support NIP-45",
    );
    expect(relayMocks.subscribe).not.toHaveBeenCalled();
  });

  it("preserves multiple filters and tagged count metadata", async () => {
    relayMocks.countWithHLL.mockResolvedValue({
      count: 42,
      approximate: true,
      hll: "AAECAw==",
    });
    const relay = new WebSocketRegistryRelay("wss://relay.example", {
      eoseTimeoutMs: 100,
    });

    await expect(
      relay.countMany([{ kinds: [1] }, { kinds: [9], "#h": ["public"] }]),
    ).resolves.toEqual({
      count: 42,
      approximate: true,
      hyperLogLog: "AAECAw==",
    });
    expect(relayMocks.countWithHLL).toHaveBeenCalledWith(
      [{ kinds: [1] }, { kinds: [9], "#h": ["public"] }],
      {},
    );
  });

  it("implements the numeric count API through countMany", async () => {
    relayMocks.countWithHLL.mockResolvedValue({ count: 7 });
    const relay = new WebSocketRegistryRelay("wss://relay.example", {
      eoseTimeoutMs: 100,
    });

    await expect(relay.count({ kinds: [9] })).resolves.toBe(7);
    expect(relayMocks.countWithHLL).toHaveBeenCalledWith([{ kinds: [9] }], {});
  });

  it("rejects malformed count payloads", async () => {
    relayMocks.countWithHLL.mockResolvedValue({ count: -1 });
    const relay = new WebSocketRegistryRelay("wss://relay.example", {
      eoseTimeoutMs: 100,
    });

    await expect(relay.countMany([{ kinds: [9] }])).rejects.toThrow(
      "invalid COUNT",
    );
  });
});
