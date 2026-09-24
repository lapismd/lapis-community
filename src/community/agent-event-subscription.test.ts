import { expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type {
  CommunityRelay,
  RelayFilter,
  CommunityRelaySubscriptionHandlers,
} from "../nostr/transport.js";
import { createCommunityAgentSession } from "./agent-session.js";

it("identifies replay until EOSE, live telemetry afterwards, and closes every subscription", async () => {
  const key = new Uint8Array(32).fill(75),
    owner = getPublicKey(key);
  const callbacks: Array<{
    filter: RelayFilter;
    handlers: CommunityRelaySubscriptionHandlers;
  }> = [];
  const close = vi.fn();
  const relay = {
    url: "wss://relay.example/",
    query: async () => [],
    close() {},
    publish: async () => ({ accepted: true }),
    subscribe: async (
      filter: RelayFilter,
      handlers: CommunityRelaySubscriptionHandlers,
    ) => {
      callbacks.push({ filter, handlers });
      return { close };
    },
  } as unknown as CommunityRelay;
  const session = createCommunityAgentSession({
    scope: { id: "test", name: "Test", relayUrl: relay.url },
    relay,
    identity: {
      getPublicKey: async () => owner,
      signEvent: async (template) => finalizeEvent(template, key),
    },
    authenticate: async () => {},
    fetch: async () =>
      Response.json({ self: owner, supported_nips: [29, 44, "OA", "AO"] }),
    now: () => 1800000000,
  });
  const onevent = vi.fn();
  const subscription = await session.subscribe([owner], {
    onevent,
    onclose() {},
  });
  const activity = callbacks.find((item) =>
    item.filter.kinds?.includes(24200),
  )!;
  const event = finalizeEvent(
    {
      kind: 24200,
      created_at: 1800000000,
      content: "encrypted",
      tags: [["p", owner]],
    },
    key,
  );
  activity.handlers.onevent(event);
  expect(onevent).toHaveBeenLastCalledWith(event, "replay");
  activity.handlers.oneose?.();
  activity.handlers.onevent(event);
  expect(onevent).toHaveBeenLastCalledWith(event, "live");
  subscription.close();
  expect(close).toHaveBeenCalledTimes(callbacks.length);
  activity.handlers.onevent(event);
  expect(onevent).toHaveBeenCalledTimes(2);
});
