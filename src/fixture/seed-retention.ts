import type { RelayFilter } from "../nostr/index.js";
import type { NostrEvent } from "../protocol/index.js";

export type FixtureRetentionQuery = (
  filter: RelayFilter,
) => Promise<readonly NostrEvent[]>;

const ID_QUERY_BATCH = 250;

export function fixtureAddressFilter(
  event: NostrEvent,
): RelayFilter | undefined {
  if (
    event.kind === 0 ||
    event.kind === 3 ||
    (event.kind >= 10_000 && event.kind < 20_000)
  ) {
    return { kinds: [event.kind], authors: [event.pubkey], limit: 1 };
  }
  if (event.kind >= 30_000 && event.kind < 40_000) {
    const identifier = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (identifier === undefined) return undefined;
    return {
      kinds: [event.kind],
      authors: [event.pubkey],
      "#d": [identifier],
      limit: 1,
    };
  }
  return undefined;
}

export function describeMissingFixtureEvents(
  events: readonly NostrEvent[],
): string {
  return events
    .map((event) => {
      const identifier = event.tags.find((tag) => tag[0] === "d")?.[1];
      const address =
        identifier === undefined
          ? `kind ${event.kind}`
          : `kind ${event.kind} d=${identifier}`;
      return `${address} ${event.id}`;
    })
    .join("; ");
}

export async function countRetainedFixtureCopies(
  events: readonly NostrEvent[],
  query: FixtureRetentionQuery,
): Promise<number> {
  const retainedIds = new Set<string>();
  for (let offset = 0; offset < events.length; offset += ID_QUERY_BATCH) {
    const chunk = events.slice(offset, offset + ID_QUERY_BATCH);
    for (const copy of await query({
      ids: chunk.map((event) => event.id),
      limit: ID_QUERY_BATCH,
    })) {
      retainedIds.add(copy.id);
    }
  }
  const missing: NostrEvent[] = [];
  let retained = 0;
  for (const event of events) {
    if (retainedIds.has(event.id)) {
      retained += 1;
      continue;
    }
    const filter = fixtureAddressFilter(event);
    if (
      filter !== undefined &&
      (await query(filter)).some((head) => head.kind === event.kind)
    ) {
      retained += 1;
      continue;
    }
    missing.push(event);
  }
  if (missing.length > 0) {
    throw new Error(
      `The relay retained ${retained}/${events.length} fixture events (${describeMissingFixtureEvents(missing)})`,
    );
  }
  return retained;
}
