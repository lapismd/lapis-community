import type { NostrEvent } from "../../protocol/index.js";
import type {
  CommunityContentWindow,
  CommunityContentWindowRequest,
} from "../contracts.js";

export interface HistoryWindowEntry {
  window: CommunityContentWindow;
  generation: number;
  visibleLimit: number;
  visibleIds?: Set<string>;
  scopeId: string;
  request: CommunityContentWindowRequest;
}

export interface HistoryRoom {
  id: string;
  kind: string;
  groupId: string;
  private?: boolean;
  transport?: string;
}

export function historyResourceKey(
  scopeId: string,
  relayUrl: string | undefined,
  identityPubkey: string,
  roomId: string,
  rootEventId?: string,
): string {
  return JSON.stringify([
    scopeId,
    relayUrl,
    identityPubkey,
    roomId,
    rootEventId ?? null,
  ]);
}

export function historyCollection(
  room: HistoryRoom,
  rootEventId?: string,
): CommunityContentWindowRequest["collection"] {
  return rootEventId
    ? "thread"
    : room.kind === "forum"
      ? "forum-topics"
      : "channel-roots";
}

export function buildHistoryRequest(
  room: HistoryRoom,
  rootEventId: string | undefined,
  direction: "head" | "older" | "newer",
  previous: HistoryWindowEntry | undefined,
  around?: { createdAt: number; eventId: string },
): CommunityContentWindowRequest {
  return {
    collection: historyCollection(room, rootEventId),
    groupId: room.groupId,
    ...(rootEventId ? { rootEventId } : {}),
    limit: 50,
    ...(direction === "older" && previous?.window.olderCursor
      ? { before: previous.window.olderCursor }
      : {}),
    ...(around
      ? { before: { createdAt: around.createdAt + 1, eventId: "~" } }
      : {}),
  };
}

export function mergeRemoteHeadWindow(
  cachedWindow: CommunityContentWindow,
  window: CommunityContentWindow,
): CommunityContentWindow {
  const byId = new Map(
    [...cachedWindow.events, ...window.events].map((event) => [
      event.id,
      event,
    ]),
  );
  const primaryIds = new Set([
    ...cachedWindow.primaryEventIds,
    ...window.primaryEventIds,
  ]);
  const primary = [...byId.values()]
    .filter((event) => primaryIds.has(event.id))
    .sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id))
    .slice(-50);
  const oldest = primary[0];
  return {
    ...(window.coverageGaps ? { coverageGaps: window.coverageGaps } : {}),
    events: [...byId.values()],
    primaryEventIds: primary.map((event) => event.id),
    hasOlder: window.hasOlder || cachedWindow.hasOlder || primaryIds.size > 50,
    ...(oldest
      ? {
          olderCursor: {
            createdAt: oldest.created_at,
            eventId: oldest.id,
          },
        }
      : {}),
  };
}

export function mergeCoverageGaps(
  ...windows: (CommunityContentWindow | undefined)[]
): readonly { createdAt: number; eventId: string }[] {
  return [
    ...new Map(
      windows
        .flatMap((window) => window?.coverageGaps ?? [])
        .map((gap) => [gap.createdAt, gap]),
    ).values(),
  ];
}

export function coveredHeadEvent(
  cached: { covered?: boolean; window?: CommunityContentWindow } | undefined,
): NostrEvent | undefined {
  const cachedWindow = cached?.window;
  return cached?.covered
    ? cachedWindow?.events
        .filter((event) => cachedWindow.primaryEventIds.includes(event.id))
        .toSorted(
          (a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id),
        )
        .at(-1)
    : undefined;
}

export function historyVisibleIds(
  direction: "head" | "older" | "newer",
  previous: HistoryWindowEntry | undefined,
  window: CommunityContentWindow,
  rootEventId: string | undefined,
  keepPreviousOnHead: boolean,
): Set<string> {
  return new Set([
    ...(direction === "older" || (direction === "head" && keepPreviousOnHead)
      ? (previous?.visibleIds ?? previous?.window.primaryEventIds ?? [])
      : []),
    ...window.primaryEventIds,
    ...(rootEventId ? [rootEventId] : []),
  ]);
}

export function cachedHeadEntry(
  scopeId: string,
  request: CommunityContentWindowRequest,
  window: CommunityContentWindow,
  rootEventId?: string,
): HistoryWindowEntry {
  return {
    window,
    scopeId,
    request,
    generation: -1,
    visibleLimit: 50,
    visibleIds: new Set([
      ...window.primaryEventIds,
      ...(rootEventId ? [rootEventId] : []),
    ]),
  };
}
