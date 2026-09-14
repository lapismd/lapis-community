import type {
  CommunityCacheAudience,
  CommunityContentWindowRequest,
  CommunityScope,
} from "./contracts.js";
import type { NostrEvent } from "../protocol/index.js";

export const COMMUNITY_CACHE_METADATA_KINDS = [
  0, 3, 5, 9005, 10000, 10002, 10063, 30030, 30315, 30622, 39000, 39001, 39002,
  39003,
] as const;

export function cachedEventPage(events: readonly NostrEvent[], limit: number) {
  const selected = events
    .toSorted((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id))
    .slice(-limit);
  const first = selected[0];
  return {
    events: selected,
    hasMoreCached: events.length > selected.length,
    ...(first
      ? { olderCursor: { createdAt: first.created_at, eventId: first.id } }
      : {}),
  };
}

export function cachePageLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.floor(limit) || 50));
}

/** Include transport and audience even when room IDs happen to be identical. */
export function historyPageKey(
  scope: CommunityScope,
  audience: CommunityCacheAudience,
  transport: string,
  request: CommunityContentWindowRequest,
): string {
  return JSON.stringify([
    scope.id,
    scope.relayUrl,
    [...(scope.readRelayUrls ?? [])].sort(),
    audience,
    transport,
    request.groupId,
    request.collection,
    request.rootEventId ?? null,
    request.before ?? null,
    request.after ?? null,
    request.limit,
  ]);
}

/** Match a live event to the loaded collection without hydrating another timeline. */
export function eventInHistoryWindow(
  event: NostrEvent,
  request: CommunityContentWindowRequest,
): boolean {
  if (!event.tags.some((tag) => tag[0] === "h" && tag[1] === request.groupId))
    return false;
  if (request.collection === "forum-topics") return event.kind === 11;
  if (request.collection === "thread")
    return (
      (event.kind === 9 || event.kind === 1111) &&
      (event.id === request.rootEventId ||
        event.tags.some(
          (tag) =>
            (tag[0] === "E" || tag[0] === "e") &&
            tag[1] === request.rootEventId,
        ))
    );
  const activity = [9000, 9001, 9007, 9021, 9022].includes(event.kind);
  if (request.collection === "channel-roots")
    return (
      activity ||
      (event.kind === 9 &&
        !event.tags.some((tag) => tag[0] === "e" || tag[0] === "E"))
    );
  return activity || [9, 11, 1111].includes(event.kind);
}
