import { canonicalJson } from "../protocol/index.js";
import type { JsonValue, NostrEvent } from "../protocol/index.js";

import type { RegistryRelay, RelayFilter } from "./transport.js";

export interface RelayQuerySource {
  relay: string;
  eventIds: string[];
  error?: string | undefined;
}

export async function queryRelayUnion(
  relays: readonly RegistryRelay[],
  filter: RelayFilter,
  signal?: AbortSignal,
): Promise<{ events: NostrEvent[]; sources: RelayQuerySource[] }> {
  if (relays.length === 0) throw new Error("At least one relay is required");
  const settled = await Promise.all(
    relays.map(async (relay) => {
      try {
        const events = await relay.query(filter, signal);
        return { relay: relay.url, events };
      } catch (error) {
        return {
          relay: relay.url,
          events: [] as NostrEvent[],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  if (settled.every((result) => result.error !== undefined)) {
    throw new Error(
      `No configured relay answered the query: ${settled
        .map((result) => `${result.relay}: ${result.error}`)
        .join("; ")}`,
    );
  }
  const distinct = new Map<string, NostrEvent>();
  for (const result of settled) {
    for (const event of result.events) {
      distinct.set(canonicalJson(event as unknown as JsonValue), event);
    }
  }
  return {
    events: [...distinct.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([, event]) => event),
    sources: settled.map((result) => ({
      relay: result.relay,
      eventIds: [...new Set(result.events.map((event) => event.id))].toSorted(),
      ...(result.error === undefined ? {} : { error: result.error }),
    })),
  };
}
