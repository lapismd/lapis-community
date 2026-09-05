import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  count: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("nostr-tools/relay", () => ({
  Relay: { connect: relayMocks.connect },
}));

import { WebSocketRegistryRelay } from "./transport.js";

describe("WebSocketRegistryRelay bounded queries", () => {
  beforeEach(() => {
    relayMocks.connect.mockReset();
    relayMocks.count.mockReset();
    relayMocks.subscribe.mockReset();
    relayMocks.connect.mockResolvedValue({
      auth: vi.fn(),
      close: vi.fn(),
      count: relayMocks.count,
      publish: vi.fn(),
      publishTimeout: 0,
      subscribe: relayMocks.subscribe,
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
    relayMocks.count.mockRejectedValue(
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
});
