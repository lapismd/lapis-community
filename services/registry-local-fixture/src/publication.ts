import type {
  RegistryRelay,
  RelayPublicationAttempt,
} from "@lapismd/registry-nostr";
import type { NostrEvent } from "@lapismd/registry-protocol";

export interface RetainedQuorumPublication {
  eventId: string;
  required: number;
  retained: number;
  attempts: RelayPublicationAttempt[];
}

export async function publishWithRetainedQuorum(
  event: NostrEvent,
  relays: readonly RegistryRelay[],
  required: number,
): Promise<RetainedQuorumPublication> {
  if (!Number.isInteger(required) || required < 1 || required > relays.length) {
    throw new Error(
      "Publication quorum must be within the configured relay set",
    );
  }

  const retained = new Set<string>();
  const attempts = await Promise.all(
    relays.map(async (relay): Promise<RelayPublicationAttempt> => {
      try {
        const result = await relay.publish(event);
        if (result.accepted) retained.add(relay.url);
        return {
          relay: relay.url,
          accepted: result.accepted,
          message: result.message,
        };
      } catch (error) {
        try {
          const copies = await relay.query({ ids: [event.id] });
          if (copies.some((copy) => copy.id === event.id)) {
            retained.add(relay.url);
            return {
              relay: relay.url,
              accepted: true,
              message: "event retained despite missing publish acknowledgement",
            };
          }
        } catch {
          // The next fixture retry will reconnect and try this relay again.
        }
        return {
          relay: relay.url,
          accepted: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const result = {
    eventId: event.id,
    required,
    retained: retained.size,
    attempts,
  };
  if (retained.size < required) {
    throw new Error(
      `Publication quorum failed for ${event.id}: ${retained.size}/${required}`,
    );
  }
  return result;
}
