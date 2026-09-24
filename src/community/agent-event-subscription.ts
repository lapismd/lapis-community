import { matchFilter } from "nostr-tools/filter";
import { signedAgentEvent } from "./agent-protocol.js";
import type { CommunityRelay, RelayFilter } from "../nostr/transport.js";
import type {
  CommunityAgentCapabilities,
  CommunityAgentSession,
} from "./agent-contracts.js";

export async function subscribeAgentEvents(
  relay: CommunityRelay,
  info: { self: string; capabilities: CommunityAgentCapabilities },
  owner: string,
  pubkeys: readonly string[],
  handlers: Parameters<CommunityAgentSession["subscribe"]>[1],
  now: number,
  signal?: AbortSignal,
): Promise<{ close(): void }> {
  const filters: RelayFilter[] = [
    { kinds: [30175, 30177, 3, 5], authors: [owner] },
    { kinds: [39002], authors: [info.self] },
    ...(info.capabilities.activity
      ? [{ kinds: [24200], "#p": [owner], since: now - 300 }]
      : []),
  ];
  for (let start = 0; start < pubkeys.length; start += 100)
    filters.push({
      kinds: [0, 10100, 5, 20001, 20002],
      authors: pubkeys.slice(start, start + 100),
    });
  let closed = false;
  const subscriptions: { close(): void }[] = [];
  const close = () => {
    closed = true;
    subscriptions.forEach((subscription) => subscription.close());
  };
  try {
    for (const filter of filters) {
      let replay = true;
      subscriptions.push(
        await relay.subscribe(
          filter,
          {
            onevent: (input) => {
              const event = signedAgentEvent(input);
              if (!closed && event && matchFilter(filter, event))
                handlers.onevent(event, replay ? "replay" : "live");
            },
            oneose: () => {
              replay = false;
            },
            onclose: (reason) => {
              if (!closed && !signal?.aborted) handlers.onclose(reason);
            },
          },
          signal,
        ),
      );
    }
    signal?.throwIfAborted();
    return { close };
  } catch (error) {
    close();
    throw error;
  }
}
