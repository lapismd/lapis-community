import type { NostrEvent } from "@lapismd/registry-protocol";

import type { RegistryRelay } from "./transport.js";

export interface RelayPublicationAttempt {
  relay: string;
  accepted: boolean;
  message: string;
}

export interface QuorumPublication {
  eventId: string;
  required: number;
  accepted: number;
  attempts: RelayPublicationAttempt[];
}

export class PublicationQuorumError extends Error {
  readonly result: QuorumPublication;

  constructor(result: QuorumPublication) {
    super(
      `Publication quorum failed for ${result.eventId}: ${result.accepted}/${result.required}`,
    );
    this.name = "PublicationQuorumError";
    this.result = result;
  }
}

export async function publishWithQuorum(
  event: NostrEvent,
  relays: readonly RegistryRelay[],
  required = 2,
  signal?: AbortSignal,
): Promise<QuorumPublication> {
  if (!Number.isInteger(required) || required < 1 || required > relays.length) {
    throw new Error(
      "Publication quorum must be within the configured relay set",
    );
  }

  const attempts = await Promise.all(
    relays.map(async (relay): Promise<RelayPublicationAttempt> => {
      try {
        const result = await relay.publish(event, signal);
        return {
          relay: relay.url,
          accepted: result.accepted,
          message: result.message,
        };
      } catch (error) {
        return {
          relay: relay.url,
          accepted: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  const accepted = attempts.filter((attempt) => attempt.accepted).length;
  const result = { eventId: event.id, required, accepted, attempts };
  if (accepted < required) {
    throw new PublicationQuorumError(result);
  }

  return result;
}
