import { verifyEvent } from "nostr-tools/pure";

import type { NostrEvent } from "../protocol/index.js";
import { WebSocketRegistryRelay } from "../nostr/transport.js";
import type { CommunityIdentity } from "./contracts.js";
import { copyNostrEvent } from "./verified-events.js";

export function blossomServersFromEvents(
  events: readonly NostrEvent[],
  pubkey: string,
): string[] {
  const latest = events
    .filter(
      (event) =>
        event.kind === 10_063 &&
        event.pubkey === pubkey &&
        verifyEvent(copyNostrEvent(event)),
    )
    .toSorted(
      (left, right) =>
        right.created_at - left.created_at || right.id.localeCompare(left.id),
    )[0];
  if (!latest) return [];
  const servers: string[] = [];
  for (const tag of latest.tags) {
    if (tag[0] !== "server" || typeof tag[1] !== "string") continue;
    try {
      const url = new URL(tag[1]);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username !== "" ||
        url.password !== ""
      )
        continue;
      const origin = url.origin;
      if (!servers.includes(origin)) servers.push(origin);
    } catch {
      continue;
    }
  }
  return servers;
}

export async function discoverBlossomServers(
  relayUrl: string,
  identity: CommunityIdentity,
): Promise<string[]> {
  const pubkey = await identity.getPublicKey();
  const relay = new WebSocketRegistryRelay(relayUrl, {
    connectTimeoutMs: 2_000,
    eoseTimeoutMs: 2_000,
  });
  const signal = AbortSignal.timeout(5_000);
  const filter = { kinds: [10_063], authors: [pubkey], limit: 10 };
  try {
    let events: NostrEvent[];
    try {
      events = await relay.query(filter, signal);
    } catch {
      await relay.authenticate(
        (template) => identity.signEvent(template),
        signal,
      );
      events = await relay.query(filter, signal);
    }
    return blossomServersFromEvents(events, pubkey);
  } finally {
    relay.close();
  }
}
