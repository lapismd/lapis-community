import { readCachedContentWindow } from "../cached-content-window.js";
import type {
  CommunityContentWindow,
  CommunityContentWindowRequest,
  CommunityEventRuntime,
  CommunityHistoryState,
  CommunityRuntimeRevision,
  CommunityScope,
  CommunitySession,
} from "../contracts.js";
import { historyPageKey } from "../history-pages.js";
import { isAbort } from "./abort.js";
import {
  buildHistoryRequest,
  cachedHeadEntry,
  coveredHeadEvent,
  historyVisibleIds,
  mergeCoverageGaps,
  mergeRemoteHeadWindow,
  type HistoryRoom,
  type HistoryWindowEntry,
} from "./history-window.js";

export interface ScheduledHistoryLoad {
  key: string;
  scope: CommunityScope;
  room: HistoryRoom;
  session: CommunitySession | undefined;
  rootEventId?: string | undefined;
  direction: "head" | "older" | "newer";
  around?: { createdAt: number; eventId: string } | undefined;
  intent: number;
  currentGeneration: number;
  getGeneration: () => number;
  getIntent: (key: string) => number | undefined;
  getWindow: (key: string) => HistoryWindowEntry | undefined;
  setWindow: (key: string, entry: HistoryWindowEntry) => void;
  setHistoryState: (key: string, state: CommunityHistoryState) => void;
  keepPreviousOnHead: (key: string) => boolean;
  eventRuntime: CommunityEventRuntime;
  runtimeScope: (scope: CommunityScope) => CommunityScope;
  applyRuntimeRevision: (revision: CommunityRuntimeRevision) => void;
  refreshProjection: (generation: number) => Promise<void>;
  updateRoomContentSync: (
    roomId: string,
    roomState: "partial" | "complete",
  ) => void;
  onWindowCommitted: (
    key: string,
    direction: "head" | "older" | "newer",
  ) => void;
  signal?: AbortSignal | undefined;
  now: () => number;
}

export async function loadScheduledHistoryWindow(
  input: ScheduledHistoryLoad,
): Promise<void> {
  const {
    key,
    scope,
    room,
    session,
    rootEventId,
    direction,
    around,
    intent,
    currentGeneration,
  } = input;
  const previous = input.getWindow(key);
  input.setHistoryState(key, {
    key,
    loading: true,
    hasOlder: previous?.window.hasOlder ?? true,
    hasNewer: false,
    complete: false,
  });
  const request = buildHistoryRequest(
    room,
    rootEventId,
    direction,
    previous,
    around,
  );
  const audience = { type: "public" as const };
  const pageKey = historyPageKey(
    scope,
    audience,
    room.transport ?? "nip29",
    request,
  );
  try {
    const cached = room.private
      ? undefined
      : await readCachedContentWindow(
          input.eventRuntime,
          scope,
          request,
          pageKey,
          input.signal,
        );
    if (input.getGeneration() !== currentGeneration) return;
    if (cached) {
      const revision = await input.eventRuntime.ingest({
        generation: currentGeneration,
        scope: input.runtimeScope(scope),
        relayUrl: scope.relayUrl,
        events: cached.window.events,
        fromCache: true,
      });
      if (input.getGeneration() !== currentGeneration) return;
      if (revision) input.applyRuntimeRevision(revision);
      if (!previous && direction === "head") {
        input.setWindow(
          key,
          cachedHeadEntry(scope.id, request, cached.window, rootEventId),
        );
      }
      await input.refreshProjection(currentGeneration);
    }
    // Legacy cached rows can render immediately but cannot prove a covered
    // relay range or justify newer-only reconciliation.
    const cachedWindow = cached?.window;
    const head = coveredHeadEvent(cached);
    const relayRequest =
      direction === "head" && head
        ? {
            ...request,
            after: { createdAt: head.created_at, eventId: head.id },
          }
        : request;
    const useCache =
      cachedWindow &&
      ((cached?.covered && direction === "older") ||
        !session?.loadContentWindow);
    const remoteLoaded = !useCache && !!session?.loadContentWindow;
    let window = useCache
      ? cachedWindow
      : await session?.loadContentWindow?.(relayRequest, input.signal);
    if (!window) {
      throw new Error(
        "This history is not cached. Reconnect to load more messages.",
      );
    }
    if (remoteLoaded && direction === "head" && cachedWindow) {
      window = mergeRemoteHeadWindow(cachedWindow, window);
    }
    if (input.getGeneration() !== currentGeneration) return;
    window = withCoverageGaps(window, previous?.window, cachedWindow);
    if (remoteLoaded) {
      await ingestRemoteHistory(input, {
        scope,
        room,
        window,
        pageKey,
        audience,
        request,
      });
      if (input.getGeneration() !== currentGeneration) return;
    }
    if (input.getIntent(key) !== intent) return;
    commitLoadedWindow(input, {
      key,
      previous,
      window,
      request,
      session,
      direction,
      around,
      rootEventId,
      currentGeneration,
    });
    await input.refreshProjection(currentGeneration);
  } catch (cause) {
    if (
      input.getGeneration() !== currentGeneration ||
      input.getIntent(key) !== intent ||
      isAbort(cause)
    ) {
      return;
    }
    input.setHistoryState(key, {
      key,
      loading: false,
      hasOlder: true,
      hasNewer: false,
      complete: false,
      error:
        cause instanceof Error ? cause.message : "History could not be loaded",
    });
    await input.refreshProjection(currentGeneration);
    throw cause;
  }
}

function withCoverageGaps(
  window: CommunityContentWindow,
  previous?: CommunityContentWindow,
  cachedWindow?: CommunityContentWindow,
): CommunityContentWindow {
  const coverageGaps = mergeCoverageGaps(previous, cachedWindow, window);
  return coverageGaps.length ? { ...window, coverageGaps } : window;
}

async function ingestRemoteHistory(
  input: ScheduledHistoryLoad,
  args: {
    scope: CommunityScope;
    room: HistoryRoom;
    window: CommunityContentWindow;
    pageKey: string;
    audience: { type: "public" };
    request: CommunityContentWindowRequest;
  },
): Promise<void> {
  const revision = await input.eventRuntime.ingest({
    generation: input.currentGeneration,
    scope: input.runtimeScope(args.scope),
    relayUrl: args.scope.relayUrl,
    events: args.window.events,
    ...(args.room.private
      ? { persist: false }
      : {
          historyPages: [
            {
              key: args.pageKey,
              audience: args.audience,
              relayUrls: [
                args.scope.relayUrl,
                ...(args.scope.readRelayUrls ?? []),
              ],
              request: args.request,
              eventIds: args.window.events.map((event) => event.id),
              primaryEventIds: args.window.primaryEventIds,
              ...(args.window.olderCursor
                ? { olderCursor: args.window.olderCursor }
                : {}),
              hasOlder: args.window.hasOlder,
              ...(args.window.coverageGaps
                ? { coverageGaps: args.window.coverageGaps }
                : {}),
              synchronizedAt: input.now(),
            },
          ],
        }),
  });
  if (revision) input.applyRuntimeRevision(revision);
}

function commitLoadedWindow(
  input: ScheduledHistoryLoad,
  args: {
    key: string;
    previous: HistoryWindowEntry | undefined;
    window: CommunityContentWindow;
    request: CommunityContentWindowRequest;
    session: CommunitySession | undefined;
    direction: "head" | "older" | "newer";
    around?: { createdAt: number; eventId: string } | undefined;
    rootEventId?: string | undefined;
    currentGeneration: number;
  },
): void {
  input.onWindowCommitted(args.key, args.direction);
  const visibleIds = historyVisibleIds(
    args.direction,
    args.previous,
    args.window,
    args.rootEventId,
    input.keepPreviousOnHead(args.key),
  );
  input.setWindow(args.key, {
    window: args.window,
    scopeId: input.scope.id,
    request: args.request,
    visibleIds,
    generation: args.currentGeneration,
    visibleLimit:
      args.direction === "older"
        ? (args.previous?.visibleLimit ?? 50) +
          args.window.primaryEventIds.length
        : 50,
  });
  input.setHistoryState(args.key, {
    key: args.key,
    loading: false,
    hasOlder: args.window.hasOlder,
    hasNewer: !args.session?.loadContentWindow || Boolean(args.around),
    complete:
      !!args.session?.loadContentWindow &&
      !args.window.hasOlder &&
      !args.around &&
      !args.window.coverageGaps?.length,
  });
  if (!args.rootEventId) {
    input.updateRoomContentSync(
      input.room.id,
      !args.session?.loadContentWindow ||
        args.window.hasOlder ||
        args.window.coverageGaps?.length
        ? "partial"
        : "complete",
    );
  }
}
