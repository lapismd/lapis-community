import {
  materializeRegistry,
  parseJsonContent,
  snapshotContentSchema,
  verifySnapshot,
} from "@lapismd/registry-protocol";
import type {
  MaterializedRegistry,
  NostrEvent,
  RegistryAuthorities,
  RegistryKindMap,
  SnapshotContent,
} from "@lapismd/registry-protocol";

import { resolveExactEvents } from "./resolve.js";
import type { RelayResolution } from "./resolve.js";
import type { RegistryRelay } from "./transport.js";

export interface VerifiedRegistrySnapshot {
  snapshotEvent: NostrEvent;
  snapshot: SnapshotContent;
  events: NostrEvent[];
  registry: MaterializedRegistry;
  resolution: RelayResolution[];
}

export interface SnapshotLoadAttempt {
  snapshotEventId?: string | undefined;
  message: string;
}

export class RegistrySnapshotUnavailableError extends Error {
  readonly attempts: SnapshotLoadAttempt[];

  constructor(attempts: SnapshotLoadAttempt[]) {
    super("No complete, verified registry snapshot was available");
    this.name = "RegistrySnapshotUnavailableError";
    this.attempts = attempts;
  }
}

export interface SnapshotLoadOptions {
  signal?: AbortSignal | undefined;
  verifySignature?: ((event: NostrEvent) => boolean) | undefined;
}

export async function loadVerifiedRegistrySnapshot(
  relays: readonly RegistryRelay[],
  kinds: RegistryKindMap,
  authorities: RegistryAuthorities,
  options: SnapshotLoadOptions = {},
): Promise<VerifiedRegistrySnapshot> {
  const attempts: SnapshotLoadAttempt[] = [];
  const responses = await Promise.all(
    relays.map(async (relay) => {
      try {
        return await relay.query(
          {
            kinds: [kinds.snapshot],
            authors: [...authorities.snapshotSignerPubkeys],
            limit: 20,
          },
          options.signal,
        );
      } catch (error) {
        attempts.push({
          message: `${relay.url}: ${error instanceof Error ? error.message : String(error)}`,
        });
        return [];
      }
    }),
  );

  const candidates = new Map<string, NostrEvent>();
  for (const event of responses.flat()) {
    candidates.set(event.id, event);
  }
  const ordered = [...candidates.values()].toSorted(
    (left, right) =>
      right.created_at - left.created_at || left.id.localeCompare(right.id),
  );

  for (const snapshotEvent of ordered) {
    const parsed = snapshotContentSchema.safeParse(
      parseJsonContent(snapshotEvent.content),
    );
    if (!parsed.success) {
      attempts.push({
        snapshotEventId: snapshotEvent.id,
        message: "Snapshot content failed schema validation",
      });
      continue;
    }

    const resolution = await resolveExactEvents(
      parsed.data.eventIds,
      relays,
      options.signal,
    );
    if (resolution.missingEventIds.length > 0) {
      attempts.push({
        snapshotEventId: snapshotEvent.id,
        message: `Snapshot is incomplete: ${resolution.missingEventIds.length} event(s) missing`,
      });
      continue;
    }

    const registry = materializeRegistry(
      resolution.events,
      kinds,
      authorities,
      options.verifySignature === undefined
        ? {}
        : { verifySignature: options.verifySignature },
    );
    const verified = verifySnapshot(
      snapshotEvent,
      registry,
      kinds,
      authorities,
      options.verifySignature,
    );
    if (!verified) {
      attempts.push({
        snapshotEventId: snapshotEvent.id,
        message:
          "Snapshot signature, authority, event set, or root did not verify",
      });
      continue;
    }

    return {
      snapshotEvent,
      snapshot: parsed.data,
      events: resolution.events,
      registry,
      resolution: resolution.relays,
    };
  }

  throw new RegistrySnapshotUnavailableError(attempts);
}
