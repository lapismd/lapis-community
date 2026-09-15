import type {
  CommunityCacheState,
  CommunityContentSyncState,
  CommunityEventRuntime,
  CommunityHistoryState,
  CommunityHistoryTarget,
  CommunityRuntimeRevision,
  CommunityScope,
  CommunitySession,
} from "../contracts.js";
import { createHistoryScheduler } from "../history-scheduler.js";
import { isAbort } from "./abort.js";
import { loadScheduledHistoryWindow } from "./history-load.js";
import { restoreCachedHead as restoreCachedHeadWindow } from "./history-restore.js";
import {
  historyResourceKey,
  type HistoryRoom,
  type HistoryWindowEntry,
} from "./history-window.js";

export interface ControllerHistoryDeps {
  getGeneration: () => number;
  getIdentityPubkey: () => string;
  getActiveCommunityId: () => string;
  getActiveRoomId: () => string;
  getActiveTopicId: () => string | undefined;
  getActiveThreadId: () => string | undefined;
  getControllerSignal: () => AbortSignal | undefined;
  getScope: (scopeId: string) => CommunityScope | undefined;
  getSession: (scopeId: string) => CommunitySession | undefined;
  findRoom: (scopeId: string, roomId: string) => HistoryRoom | undefined;
  historyPaging: boolean;
  eventRuntime: CommunityEventRuntime;
  runtimeScope: (scope: CommunityScope) => CommunityScope;
  applyRuntimeRevision: (revision: CommunityRuntimeRevision) => void;
  refreshProjection: (generation: number) => Promise<void>;
  updateRoomContentSync: (
    roomId: string,
    roomState: CommunityContentSyncState["rooms"][string],
  ) => void;
  keepPreviousOnHead: (key: string) => boolean;
  onWindowCommitted: (
    key: string,
    direction: "head" | "older" | "newer",
  ) => void;
  patchContentSync: (patch: Partial<CommunityContentSyncState>) => void;
  patchCache: (patch: Partial<CommunityCacheState>) => void;
  now: () => number;
}

export function createControllerHistory(deps: ControllerHistoryDeps) {
  const historyScheduler = createHistoryScheduler(2);
  const historyWindows = new Map<string, HistoryWindowEntry>();
  let historyStates = $state<Record<string, CommunityHistoryState>>({});
  const historyIntents = new Map<string, number>();
  let progressiveRun = 0;

  function resourceKey(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
  ): string {
    return historyResourceKey(
      scopeId,
      deps.getScope(scopeId)?.relayUrl,
      deps.getIdentityPubkey(),
      roomId,
      rootEventId,
    );
  }

  function historyTarget(target?: CommunityHistoryTarget) {
    return {
      scopeId: target?.scopeId ?? deps.getActiveCommunityId(),
      roomId: target?.roomId ?? deps.getActiveRoomId(),
      rootEventId: target?.rootEventId ?? deps.getActiveTopicId(),
    };
  }

  function setHistoryState(key: string, state: CommunityHistoryState): void {
    historyStates = { ...historyStates, [key]: state };
  }

  async function loadInteractiveRoom(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
    _signal?: AbortSignal,
    direction: "head" | "older" | "newer" = "head",
    around?: { createdAt: number; eventId: string },
  ): Promise<void> {
    const scope = deps.getScope(scopeId);
    const session = deps.getSession(scopeId);
    const room = deps.findRoom(scopeId, roomId);
    if (
      !scope ||
      !room ||
      (!session?.loadContentWindow && !deps.historyPaging)
    ) {
      return;
    }
    const key = resourceKey(scopeId, roomId, rootEventId);
    const current = historyWindows.get(key);
    if (direction === "head" && current?.generation === deps.getGeneration()) {
      return;
    }
    if (direction === "older" && current && !current.window.hasOlder) return;
    const currentGeneration = deps.getGeneration();
    const signal = deps.getControllerSignal();
    const intent =
      (historyIntents.get(key) ?? 0) + (direction === "newer" ? 1 : 0);
    historyIntents.set(key, intent);
    const group = `${currentGeneration}:${key}`;
    const requested = JSON.stringify([group, direction, around, intent]);
    return historyScheduler.run(
      requested,
      () =>
        loadScheduledHistoryWindow({
          key,
          scope,
          room,
          session,
          rootEventId,
          direction,
          around,
          intent,
          currentGeneration,
          getGeneration: deps.getGeneration,
          getIntent: (entry) => historyIntents.get(entry),
          getWindow: (entry) => historyWindows.get(entry),
          setWindow: (entry, next) => historyWindows.set(entry, next),
          setHistoryState,
          keepPreviousOnHead: deps.keepPreviousOnHead,
          eventRuntime: deps.eventRuntime,
          runtimeScope: deps.runtimeScope,
          applyRuntimeRevision: deps.applyRuntimeRevision,
          refreshProjection: deps.refreshProjection,
          updateRoomContentSync: deps.updateRoomContentSync,
          onWindowCommitted: deps.onWindowCommitted,
          signal,
          now: deps.now,
        }),
      () =>
        key ===
          resourceKey(
            deps.getActiveCommunityId(),
            deps.getActiveRoomId(),
            deps.getActiveTopicId(),
          ) ||
        (deps.getActiveThreadId() !== undefined &&
          key ===
            resourceKey(
              deps.getActiveCommunityId(),
              deps.getActiveRoomId(),
              deps.getActiveThreadId(),
            )),
      group,
    );
  }

  async function restoreCachedHead(
    scopeId: string,
    roomId: string,
    rootEventId: string | undefined,
    currentGeneration: number,
  ): Promise<void> {
    await restoreCachedHeadWindow({
      scopeId,
      roomId,
      rootEventId,
      currentGeneration,
      getGeneration: deps.getGeneration,
      getScope: deps.getScope,
      findRoom: deps.findRoom,
      getControllerSignal: deps.getControllerSignal,
      eventRuntime: deps.eventRuntime,
      runtimeScope: deps.runtimeScope,
      applyRuntimeRevision: deps.applyRuntimeRevision,
      resourceKey,
      historyWindows,
      setHistoryState,
    });
  }

  async function runProgressiveSynchronization(
    currentGeneration: number,
    parentSignal: AbortSignal,
    priority = {
      scopeId: deps.getActiveCommunityId(),
      roomId: deps.getActiveRoomId(),
      rootEventId: undefined as string | undefined,
    },
  ): Promise<void> {
    const run = ++progressiveRun;
    try {
      await loadInteractiveRoom(
        priority.scopeId,
        priority.roomId,
        priority.rootEventId,
        parentSignal,
      );
      if (
        deps.getGeneration() !== currentGeneration ||
        run !== progressiveRun
      ) {
        return;
      }
      deps.patchContentSync({ phase: "complete" });
      deps.patchCache({ freshness: "current" });
    } catch (cause) {
      if (
        deps.getGeneration() !== currentGeneration ||
        run !== progressiveRun ||
        isAbort(cause)
      ) {
        return;
      }
      deps.patchContentSync({
        phase: "partial-error",
        message:
          cause instanceof Error
            ? cause.message
            : "History could not be loaded",
      });
      deps.patchCache({ freshness: "synchronizing" });
    }
  }

  function prioritizeContent(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
  ): void {
    const signal = deps.getControllerSignal();
    if (signal === undefined) return;
    const session = deps.getSession(scopeId);
    if (session?.loadContentWindow === undefined) {
      if (deps.historyPaging) {
        const requestedGeneration = deps.getGeneration();
        void restoreCachedHead(
          scopeId,
          roomId,
          rootEventId,
          requestedGeneration,
        ).then(() => deps.refreshProjection(requestedGeneration));
      }
      return;
    }
    deps.patchContentSync({ phase: "background" });
    deps.patchCache({ freshness: "synchronizing" });
    void runProgressiveSynchronization(deps.getGeneration(), signal, {
      scopeId,
      roomId,
      rootEventId,
    });
  }

  function resetWindows(): void {
    historyWindows.clear();
    historyIntents.clear();
    historyStates = {};
  }

  function clear(): void {
    resetWindows();
    progressiveRun += 1;
  }

  function invalidateActiveWindow(): void {
    const entry = historyWindows.get(
      resourceKey(
        deps.getActiveCommunityId(),
        deps.getActiveRoomId(),
        deps.getActiveTopicId(),
      ),
    );
    if (entry) entry.generation = -1;
  }

  return {
    historyWindows,
    historyIntents,
    get historyStates() {
      return historyStates;
    },
    setHistoryStates(next: Record<string, CommunityHistoryState>) {
      historyStates = next;
    },
    resourceKey,
    historyTarget,
    loadInteractiveRoom,
    restoreCachedHead,
    runProgressiveSynchronization,
    prioritizeContent,
    resetWindows,
    clear,
    invalidateActiveWindow,
    bumpProgressiveRun() {
      progressiveRun += 1;
    },
    historyScheduler,
  };
}
