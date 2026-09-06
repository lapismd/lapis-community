export type DiscussionLoadDirection = "replace" | "prepend" | "append";

export interface DiscussionWindowRange {
  startIndex: number;
  endIndex: number;
  targetIndex: number;
}

export interface DiscussionWindow<T> extends DiscussionWindowRange {
  posts: T[];
  total: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

export interface DiscussionViewportItem {
  top: number;
  bottom: number;
}

export class DiscussionPaginationError extends Error {
  override readonly name = "DiscussionPaginationError";
}

export function initialDiscussionWindow(
  total: number,
  pageSize: number,
): DiscussionWindowRange {
  const safeTotal = Math.max(0, Math.floor(total));
  const size = Math.max(1, Math.floor(pageSize));
  return {
    startIndex: 0,
    endIndex: Math.min(safeTotal, size),
    targetIndex: 0,
  };
}

export function centeredDiscussionWindow(
  total: number,
  targetIndex: number,
  pageSize: number,
): DiscussionWindowRange {
  const safeTotal = Math.max(0, Math.floor(total));
  const size = Math.max(1, Math.floor(pageSize));
  if (safeTotal === 0) {
    return { startIndex: 0, endIndex: 0, targetIndex: 0 };
  }
  const target = Math.max(0, Math.min(Math.floor(targetIndex), safeTotal - 1));
  const maximumStart = Math.max(0, safeTotal - size);
  const startIndex = Math.min(
    maximumStart,
    Math.max(0, target - Math.floor(size / 2)),
  );
  return {
    startIndex,
    endIndex: Math.min(safeTotal, startIndex + size),
    targetIndex: target,
  };
}

export function adjacentDiscussionWindow(
  total: number,
  loadedStartIndex: number,
  loadedEndIndex: number,
  direction: "prepend" | "append",
  pageSize: number,
): DiscussionWindowRange {
  const safeTotal = Math.max(0, Math.floor(total));
  const size = Math.max(1, Math.floor(pageSize));
  const start = Math.max(0, Math.min(Math.floor(loadedStartIndex), safeTotal));
  const end = Math.max(start, Math.min(Math.floor(loadedEndIndex), safeTotal));
  if (direction === "prepend") {
    const nextStart = Math.max(0, start - size);
    return {
      startIndex: nextStart,
      endIndex: start,
      targetIndex: nextStart,
    };
  }
  const nextEnd = Math.min(safeTotal, end + size);
  return {
    startIndex: end,
    endIndex: nextEnd,
    targetIndex: Math.max(end, nextEnd - 1),
  };
}

export function mergeDiscussionPosts<T>(
  current: readonly T[],
  incoming: readonly T[],
  eventId: (post: T) => string,
  compare: (left: T, right: T) => number,
): T[] {
  return [
    ...new Map(
      [...current, ...incoming].map((post) => [eventId(post), post] as const),
    ).values(),
  ].toSorted(compare);
}

export function completeNewestBoundedSlice<T>(options: {
  requestedEvents: readonly T[];
  boundaryEvents: readonly T[];
  size: number;
  eventId: (event: T) => string;
  createdAt: (event: T) => number;
  compare: (left: T, right: T) => number;
}): { events: T[]; hasOlder: boolean } {
  const requested = options.requestedEvents.toSorted(options.compare);
  const oldest = requested[0];
  if (oldest === undefined || options.size <= 0) {
    return { events: [], hasOlder: false };
  }
  const oldestTimestamp = options.createdAt(oldest);
  const candidates = [
    ...requested.filter((event) => options.createdAt(event) > oldestTimestamp),
    ...options.boundaryEvents,
  ];
  const distinct = [
    ...new Map(
      candidates.map((event) => [options.eventId(event), event] as const),
    ).values(),
  ].toSorted(options.compare);
  return {
    events: distinct.slice(-options.size),
    hasOlder: requested.length > options.size || distinct.length > options.size,
  };
}

export function sliceBoundaryWindow<T>(options: {
  olderEvents: readonly T[];
  boundaryEvents: readonly T[];
  countBeforeBoundary: number;
  expectedBoundaryCount: number;
  range: DiscussionWindowRange;
  eventId: (event: T) => string;
  compare: (left: T, right: T) => number;
}): T[] {
  const distinctBoundary = [
    ...new Map(
      options.boundaryEvents.map((event) => [options.eventId(event), event]),
    ).values(),
  ].toSorted(options.compare);
  if (distinctBoundary.length !== options.expectedBoundaryCount) {
    throw new DiscussionPaginationError(
      "The relay returned an incomplete same-second event bucket. Retry after the relay index catches up.",
    );
  }
  const distinctOlder = [
    ...new Map(
      options.olderEvents.map((event) => [options.eventId(event), event]),
    ).values(),
  ].toSorted(options.compare);
  const combinedStart = options.countBeforeBoundary - distinctOlder.length;
  const combined = [...distinctOlder, ...distinctBoundary];
  const sliceStart = options.range.startIndex - combinedStart;
  const sliceEnd = options.range.endIndex - combinedStart;
  if (sliceStart < 0 || sliceEnd > combined.length) {
    throw new DiscussionPaginationError(
      "The relay could not provide the complete discussion window. Retry the request.",
    );
  }
  return combined.slice(sliceStart, sliceEnd);
}

export function shouldCloakDiscussionPost(
  item: DiscussionViewportItem,
  viewportHeight: number,
  protectedPost = false,
): boolean {
  if (protectedPost || viewportHeight <= 0) return false;
  return item.bottom < -viewportHeight || item.top > viewportHeight * 2;
}
