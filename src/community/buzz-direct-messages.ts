import type { NostrEvent } from "../protocol/index.js";
import { isVerifiedNostrEvent } from "./verified-events.js";
export function isBuzzDirectMetadata(event: NostrEvent): boolean {
  return (
    event.kind === 39000 &&
    isVerifiedNostrEvent(event) &&
    event.tags.some((tag) => tag[0] === "channel_type" && tag[1] === "dm") &&
    event.tags.some((tag) => tag[0] === "private")
  );
}
export function buzzHiddenChannels(
  events: readonly NostrEvent[],
  owner: string,
  relayPubkey: string,
): Set<string> {
  const latest = events
    .filter(
      (event) =>
        event.kind === 30622 &&
        event.pubkey === relayPubkey &&
        isVerifiedNostrEvent(event) &&
        event.tags.filter((tag) => tag[0] === "d").length === 1 &&
        event.tags.some((tag) => tag[0] === "d" && tag[1] === owner) &&
        event.tags.filter((tag) => tag[0] === "p").length === 1 &&
        event.tags.some((tag) => tag[0] === "p" && tag[1] === owner),
    )
    .toSorted(
      (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
    )[0];
  return new Set(
    latest?.tags
      .filter((tag) => tag[0] === "h" && tag[1])
      .map((tag) => tag[1]!) ?? [],
  );
}
