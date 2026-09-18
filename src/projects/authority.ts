import type { NostrEvent } from "../protocol/index.js";
import { firstTagValue } from "./model.js";

export interface CollaborationAuthority {
  canMaintain(pubkey: string): boolean;
  isAdmin?(pubkey: string): boolean;
}

export function maintainersAuthority(
  pubkeys: readonly string[],
): CollaborationAuthority {
  const allowed = new Set(pubkeys);
  return {
    canMaintain: (pubkey) => allowed.has(pubkey),
    isAdmin: (pubkey) => allowed.has(pubkey),
  };
}

export function collaborationAuthorityFromGroupState(
  events: readonly NostrEvent[],
  channelId: string,
): CollaborationAuthority {
  if (!channelId) return maintainersAuthority([]);
  const metadata = latestGroupState(events, 39_000, channelId);
  const admins = latestGroupState(events, 39_001, channelId);
  const members = latestGroupState(events, 39_002, channelId);
  const administratorIds = new Set<string>();
  const maintainerIds = new Set<string>();
  const creator = metadata?.pubkey;
  for (const tag of admins?.tags ?? []) {
    if (tag[0] === "p" && tag[1]) administratorIds.add(tag[1]);
  }
  for (const tag of members?.tags ?? []) {
    if (tag[0] !== "p" || !tag[1]) continue;
    if (tag.slice(2).includes("maintainer")) maintainerIds.add(tag[1]);
  }
  return {
    canMaintain(pubkey) {
      return (
        pubkey === creator ||
        administratorIds.has(pubkey) ||
        maintainerIds.has(pubkey)
      );
    },
    isAdmin(pubkey) {
      return pubkey === creator || administratorIds.has(pubkey);
    },
  };
}

function latestGroupState(
  events: readonly NostrEvent[],
  kind: number,
  groupId: string,
): NostrEvent | undefined {
  return events
    .filter(
      (event) =>
        event.kind === kind && firstTagValue(event, "d") === groupId,
    )
    .toSorted((left, right) => {
      if (right.created_at !== left.created_at)
        return right.created_at - left.created_at;
      return right.id.localeCompare(left.id);
    })[0];
}
