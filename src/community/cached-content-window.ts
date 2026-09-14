import type { NostrEvent } from "../protocol/index.js";
import type {
  CommunityContentWindow,
  CommunityContentWindowRequest,
  CommunityEventRuntime,
  CommunityScope,
} from "./contracts.js";
import { eventInHistoryWindow } from "./history-pages.js";

type CacheReader = Pick<
  CommunityEventRuntime,
  "readHistoryPage" | "readCachedEvents"
>;
export interface CachedContentWindow {
  window: CommunityContentWindow;
  /** Only an explicitly committed page can cover a historical relay query. */
  covered: boolean;
  hasMoreCached?: boolean;
}

/** Restore a bounded legacy window without treating cached rows as relay coverage. */
export async function readCachedContentWindow(
  runtime: CacheReader,
  scope: CommunityScope,
  request: CommunityContentWindowRequest,
  key: string,
  signal?: AbortSignal,
): Promise<CachedContentWindow | undefined> {
  signal?.throwIfAborted();
  const saved = await runtime.readHistoryPage?.(scope, key);
  signal?.throwIfAborted();
  if (saved)
    return {
      covered: true,
      window: {
        events: saved.events,
        primaryEventIds: saved.page.primaryEventIds,
        hasOlder: saved.page.hasOlder,
        ...(saved.page.olderCursor
          ? { olderCursor: saved.page.olderCursor }
          : {}),
        ...(saved.page.coverageGaps
          ? { coverageGaps: saved.page.coverageGaps }
          : {}),
      },
    };
  if (!runtime.readCachedEvents) return;
  const primary = new Map<string, NostrEvent>(),
    candidates = new Map<string, NostrEvent>();
  const limit = Math.max(1, Math.min(100, Math.floor(request.limit) || 50));
  const kinds =
    request.collection === "forum-topics"
      ? [11]
      : request.collection === "thread"
        ? [9, 11, 1111]
        : request.collection === "room-history"
          ? [9, 11, 1111, 9000, 9001, 9007, 9021, 9022]
          : [9, 9000, 9001, 9007, 9021, 9022];
  let before = request.before,
    hasMoreCached = false;
  for (let batch = 0; batch < 3; batch++) {
    signal?.throwIfAborted();
    const page = await runtime.readCachedEvents(scope, {
      kinds,
      groupId: request.groupId,
      limit: 100,
      ...(before ? { before } : {}),
    });
    signal?.throwIfAborted();
    for (const event of page.events) {
      candidates.set(event.id, event);
      if (eventInHistoryWindow(event, request)) primary.set(event.id, event);
    }
    hasMoreCached = page.hasMoreCached;
    const previous = before;
    if (page.olderCursor) before = page.olderCursor;
    if (
      primary.size >= limit ||
      !hasMoreCached ||
      !page.olderCursor ||
      (previous?.createdAt === before?.createdAt &&
        previous?.eventId === before?.eventId)
    )
      break;
    if (batch < 2) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  if (!candidates.size) return;
  const selected = [...primary.values()].sort(compareEvents).slice(-limit);
  const selectedIds = new Set(selected.map((event) => event.id));
  const supporting = [...candidates.values()].filter(
    (event) =>
      !selectedIds.has(event.id) &&
      event.tags.some(
        ([tag, id]) =>
          (tag === "e" || tag === "E") && selectedIds.has(id ?? ""),
      ),
  );
  const oldest = selected[0];
  const olderCursor =
    selected.length >= limit && oldest
      ? { createdAt: oldest.created_at, eventId: oldest.id }
      : before;
  return {
    covered: false,
    hasMoreCached: hasMoreCached || primary.size > limit,
    window: {
      events: [...selected, ...supporting].sort(compareEvents),
      primaryEventIds: selected.map((event) => event.id),
      // Cache exhaustion never establishes relay exhaustion or exact zero unread.
      hasOlder: true,
      ...(olderCursor ? { olderCursor } : {}),
    },
  };
}
function compareEvents(a: NostrEvent, b: NostrEvent) {
  return a.created_at - b.created_at || a.id.localeCompare(b.id);
}
