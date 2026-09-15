import type { CommunityContentWindowRequest } from "./contracts.js";
import type { NostrEvent } from "../protocol/index.js";
import type { RelayFilter } from "../nostr/index.js";

export const COMMUNITY_CONTENT_KINDS = [
  5, 7, 9, 11, 1_111, 9_005, 40_003,
] as const;
export const COMMUNITY_CHANNEL_ACTIVITY_KINDS = [
  9_000, 9_001, 9_007, 9_021, 9_022,
] as const;

export function contentWindowFilter(
  request: CommunityContentWindowRequest,
): RelayFilter {
  const context = { "#h": [request.groupId] };
  switch (request.collection) {
    case "channel-roots":
      return { kinds: [9], ...context };
    case "forum-topics":
      return { kinds: [11], ...context };
    case "thread":
      return {
        kinds: [9, 1_111],
        ...context,
        "#e": [request.rootEventId!],
      };
    case "room-history":
      return { kinds: [...COMMUNITY_CONTENT_KINDS], ...context };
  }
}

export function contentWindowPrimary(
  event: NostrEvent,
  collection: CommunityContentWindowRequest["collection"],
): boolean {
  if (collection === "channel-roots") {
    return (
      COMMUNITY_CHANNEL_ACTIVITY_KINDS.some((kind) => kind === event.kind) ||
      (event.kind === 9 &&
        !event.tags.some((tag) => tag[0] === "e" || tag[0] === "E"))
    );
  }
  if (collection === "forum-topics") return event.kind === 11;
  if (collection === "thread") {
    return event.kind === 9 || event.kind === 1_111;
  }
  return (
    COMMUNITY_CONTENT_KINDS.some((kind) => kind === event.kind) ||
    COMMUNITY_CHANNEL_ACTIVITY_KINDS.some((kind) => kind === event.kind)
  );
}
