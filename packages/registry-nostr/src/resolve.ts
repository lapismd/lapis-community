import { canonicalJson } from "@lapismd/registry-protocol";
import type { JsonValue, NostrEvent } from "@lapismd/registry-protocol";

import type { RegistryRelay } from "./transport.js";

export interface RelayResolution {
  relay: string;
  eventIds: string[];
  error?: string | undefined;
}

export interface ExactResolution {
  events: NostrEvent[];
  missingEventIds: string[];
  relays: RelayResolution[];
}

export async function resolveExactEvents(
  eventIds: readonly string[],
  relays: readonly RegistryRelay[],
  signal?: AbortSignal,
): Promise<ExactResolution> {
  const requested = [...new Set(eventIds)].toSorted();
  const settled = await Promise.all(
    relays.map(async (relay) => {
      try {
        const events = await relay.query({ ids: requested }, signal);
        return {
          relay: relay.url,
          events,
          eventIds: [...new Set(events.map((event) => event.id))].toSorted(),
        };
      } catch (error) {
        return {
          relay: relay.url,
          events: [] as NostrEvent[],
          eventIds: [] as string[],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const distinctEnvelopes = new Map<string, NostrEvent>();
  for (const { events } of settled) {
    for (const event of events) {
      const key = canonicalJson(event as unknown as JsonValue);
      distinctEnvelopes.set(key, event);
    }
  }
  const events = [...distinctEnvelopes.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([, event]) => event);
  const found = new Set(events.map((event) => event.id));

  return {
    events,
    missingEventIds: requested.filter((eventId) => !found.has(eventId)),
    relays: settled.map(({ relay, eventIds, error }) => ({
      relay,
      eventIds,
      ...(error === undefined ? {} : { error }),
    })),
  };
}
