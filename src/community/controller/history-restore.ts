import { readCachedContentWindow } from "../cached-content-window.js";
import type {
  CommunityEventRuntime,
  CommunityHistoryState,
  CommunityRuntimeRevision,
  CommunityScope,
} from "../contracts.js";
import { historyPageKey } from "../history-pages.js";
import {
  buildHistoryRequest,
  cachedHeadEntry,
  type HistoryRoom,
  type HistoryWindowEntry,
} from "./history-window.js";

export async function restoreCachedHead(input: {
  scopeId: string;
  roomId: string;
  rootEventId: string | undefined;
  currentGeneration: number;
  getGeneration: () => number;
  getScope: (scopeId: string) => CommunityScope | undefined;
  findRoom: (scopeId: string, roomId: string) => HistoryRoom | undefined;
  getControllerSignal: () => AbortSignal | undefined;
  eventRuntime: CommunityEventRuntime;
  runtimeScope: (scope: CommunityScope) => CommunityScope;
  applyRuntimeRevision: (revision: CommunityRuntimeRevision) => void;
  resourceKey: (
    scopeId: string,
    roomId: string,
    rootEventId?: string,
  ) => string;
  historyWindows: Map<string, HistoryWindowEntry>;
  setHistoryState: (key: string, state: CommunityHistoryState) => void;
}): Promise<void> {
  const scope = input.getScope(input.scopeId);
  const room = input.findRoom(input.scopeId, input.roomId);
  if (!scope || !room || room.private) return;
  const request = buildHistoryRequest(
    room,
    input.rootEventId,
    "head",
    undefined,
  );
  const key = historyPageKey(
    scope,
    { type: "public" },
    room.transport ?? "nip29",
    request,
  );
  const cached = await readCachedContentWindow(
    input.eventRuntime,
    scope,
    request,
    key,
    input.getControllerSignal(),
  );
  const events = cached?.window.events ?? [];
  if (input.getGeneration() !== input.currentGeneration) return;
  const revision = await input.eventRuntime.ingest({
    generation: input.currentGeneration,
    scope: input.runtimeScope(scope),
    relayUrl: scope.relayUrl,
    events,
    fromCache: true,
  });
  if (input.getGeneration() !== input.currentGeneration) return;
  if (revision) input.applyRuntimeRevision(revision);
  if (!cached) return;
  const resource = input.resourceKey(
    input.scopeId,
    input.roomId,
    input.rootEventId,
  );
  if (!input.historyWindows.has(resource)) {
    input.historyWindows.set(
      resource,
      cachedHeadEntry(input.scopeId, request, cached.window, input.rootEventId),
    );
  }
  input.setHistoryState(resource, {
    key: resource,
    loading: false,
    hasOlder: cached.window.hasOlder,
    hasNewer: true,
    complete: false,
  });
}
