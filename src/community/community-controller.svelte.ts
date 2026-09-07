import type {
  CommunityMemberModel,
  CommunityRoomModel,
  CommunityWorkspaceHandlers,
  CommunityWorkspaceModel,
} from "../components/index.js";
import { nip19 } from "nostr-tools";
import {
  createNip29ForumCommentTemplate,
  createNip29ForumThreadTemplate,
  type NostrEvent,
  type NostrEventTemplate,
} from "../protocol/index.js";
import { isRegistryControlEvent } from "../protocol/registry-control.js";

import {
  communityRooms,
  directConversationId,
  materializeCommunityInbox,
  materializeCommunityWorkspace,
} from "./materialize.js";
import type {
  CommunityCapabilities,
  CommunityCommand,
  CommunityContentSyncState,
  CommunityContentWindow,
  CommunityContentWindowRequest,
  CommunityController,
  CommunityControllerActions,
  CommunityControllerOptions,
  CommunityControllerState,
  CommunityOperationFailure,
  CommunityOperationState,
  CommunityPrivateEvent,
  CommunityMessageReport,
  CommunityReplyTarget,
  CommunityRoomUpdate,
  CommunityPulseFeedTab,
  CommunityPulseModel,
  CommunityPulseTab,
  CommunityRuntimeRevision,
  CommunityScope,
  CommunitySearchResult,
  CommunitySession,
  CommunitySessionSubscription,
  CommunitySnapshot,
  CommunityStateScope,
  CommunityStoredState,
} from "./contracts.js";
import {
  materializeCommunityPulse,
  pulseEventTargetId,
} from "./materialize-pulse.js";
import { createCommunityStoredState } from "./state-store.js";
import {
  materializeCommunitySettings,
  normalizeShortcode,
} from "./materialize-settings.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import { registerCommunityControllerIdentityReader } from "./controller-identity-context.js";
import {
  COMMUNITY_MESSAGE_EDIT_KIND,
  configuredCuratorPubkeys,
  formatCommunityMessageReport,
} from "./message-moderation.js";

const NO_CAPABILITIES: CommunityCapabilities = {
  channels: false,
  forums: false,
  directMessages: false,
  search: false,
  manageGroup: false,
  manageMembers: false,
  deleteEvents: false,
  archive: false,
  editMessages: false,
};

export function createCommunityController(
  options: CommunityControllerOptions,
): CommunityController {
  const initialScopes = options.scopes.map((scope) => ({
    ...scope,
    ...(scope.rooms === undefined ? {} : { rooms: [...scope.rooms] }),
    ...(scope.readRelayUrls === undefined
      ? {}
      : { readRelayUrls: [...scope.readRelayUrls] }),
  }));
  if (initialScopes.length === 0) {
    throw new Error(
      "CommunityController requires at least one community scope",
    );
  }
  let scopes = $state<CommunityScope[]>(initialScopes);
  const now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  const eventRuntime = options.runtime ?? createInlineCommunityEventRuntime();
  const clientId = options.clientId ?? createClientId();
  const sessions = new Map<string, CommunitySession>();
  const subscriptions = new Map<string, CommunitySessionSubscription>();
  const retries = new Map<string, () => Promise<void>>();
  const acceptedEventIdsByOperation = new Map<string, readonly string[]>();
  const queuedEvents = new Map<string, NostrEvent[]>();
  const queuedEventGenerations = new Map<string, number>();
  const scheduledEventScopes = new Set<string>();
  const storedStates = new Map<string, CommunityStoredState>();
  let controllerAbort: AbortController | undefined;
  let identity = options.identity;
  let generation = 0;
  let configurationLoaded = false;
  let runtimeRevision = 0;
  let syncPlans: NonNullable<
    Awaited<ReturnType<typeof eventRuntime.restore>>["syncPlans"]
  > = {};
  let progressiveRun = 0;
  let progressiveAbort: AbortController | undefined;
  let pulseAbort: AbortController | undefined;
  let pulseRun = 0;
  let pulseActive = false;
  let pulseNoteTimer: ReturnType<typeof setInterval> | undefined;
  let pulseReactionTimer: ReturnType<typeof setInterval> | undefined;
  let pulseEvents: NostrEvent[] = [];
  let pulsePrimaryEventIds: string[] = [];

  let status = $state<CommunityControllerState["status"]>("idle");
  let cache = $state<CommunityControllerState["cache"]>({
    mode: "memory",
    freshness: "empty",
  });
  let eventsByScope: Record<string, NostrEvent[]> = {};
  let privateEventsByScope: Record<string, CommunityPrivateEvent[]> = {};
  let directParticipantsByRoom = $state<Record<string, readonly string[]>>({});
  let capabilitiesByScope = $state<Record<string, CommunityCapabilities>>({});
  let operations = $state<Record<string, CommunityOperationState>>({});
  let error = $state("");
  let identityPubkey = $state("");
  let authentication = $state<CommunityControllerState["authentication"]>(
    options.identity === undefined
      ? { status: "anonymous" }
      : { status: "connecting" },
  );
  const initialActiveCommunityId =
    options.initialCommunityId ?? initialScopes[0]?.id ?? "";
  const initialActiveRoomId =
    options.initialRoomId ??
    communityRooms(
      initialScopes.find((scope) => scope.id === initialActiveCommunityId) ??
        initialScopes[0]!,
    )[0]?.id ??
    "";
  let activeCommunityId = $state(initialActiveCommunityId);
  let activeRoomId = $state(initialActiveRoomId);
  let activeTopicId = $state<string | undefined>();
  let activeThreadId = $state<string | undefined>();
  let sidePanel = $state<"thread" | "details" | "none">("none");
  let searchQuery = $state("");
  let searchResults = $state<CommunitySearchResult[]>([]);
  let memberDirectory = $state<CommunityControllerState["memberDirectory"]>({
    query: "",
    results: [],
    completeness: "unavailable",
  });
  let contentSync = $state<CommunityContentSyncState>({
    phase: "initial",
    rooms: {},
  });
  let replyTarget = $state<CommunityReplyTarget | undefined>();
  let pulse = $state<CommunityPulseModel | undefined>();
  let navigation = $state<CommunityControllerState["navigation"]>({
    starredRoomIds: [],
    mutedRoomIds: [],
    hiddenRoomIds: [],
    forcedUnreadRoomIds: [],
    sections: [],
  });

  let workspace = $state<CommunityWorkspaceModel>(
    materializeCommunityWorkspace(initialScopes, {}, initialActiveCommunityId, {
      asOf: now(),
      activeRoomId: initialActiveRoomId,
      privateEvents: [],
      directParticipants: {},
      sidePanel: "none",
    }),
  );
  let inbox = $state(
    materializeCommunityInbox(initialScopes, {}, undefined, now()),
  );
  let settings = $state(materializeCommunitySettings([], ""));
  const capabilities = $derived.by(() => {
    const base = capabilitiesByScope[activeCommunityId] ?? NO_CAPABILITIES;
    const room = activeRoomScope();
    const admin =
      room !== undefined && identityPubkey !== ""
        ? isGroupAdmin(
            eventsByScope[activeCommunityId] ?? [],
            room.groupId,
            identityPubkey,
          )
        : false;
    return {
      ...base,
      manageGroup: base.manageGroup && admin,
      manageMembers: base.manageMembers && admin,
    };
  });
  const state = $derived.by(
    (): CommunityControllerState => ({
      status,
      cache,
      connections: scopes.map((scope) => ({
        communityId: scope.id,
        name: scope.name,
        relayUrl: scope.relayUrl,
      })),
      workspace,
      ...(inbox === undefined ? {} : { inbox }),
      settings,
      capabilities,
      operations,
      searchResults,
      searchQuery,
      authentication,
      memberDirectory,
      contentSync,
      navigation,
      ...(replyTarget === undefined ? {} : { replyTarget }),
      ...(pulse === undefined ? {} : { pulse }),
      ...(error === "" ? {} : { error }),
    }),
  );

  function initialize(): void {
    if (controllerAbort !== undefined) return;
    controllerAbort = new AbortController();
    const currentGeneration = ++generation;
    void connect(currentGeneration, controllerAbort.signal);
  }

  async function connect(
    currentGeneration: number,
    signal: AbortSignal,
    restoreRuntime = true,
  ): Promise<void> {
    status = "restoring";
    error = "";
    try {
      if (!configurationLoaded && options.configurationStore !== undefined) {
        const configuredScopes = await Promise.all(
          scopes.map(async (scope) => {
            const configuredRelayUrl =
              await options.configurationStore!.loadRelayUrl(scope.id);
            return configuredRelayUrl === undefined
              ? scope
              : { ...scope, relayUrl: normalizeRelayUrl(configuredRelayUrl) };
          }),
        );
        if (generation !== currentGeneration) return;
        scopes = configuredScopes;
        configurationLoaded = true;
      }
      identityPubkey = identity ? await identity.getPublicKey() : "";
      authentication =
        identityPubkey === ""
          ? { status: "anonymous" }
          : { status: "connected", pubkey: identityPubkey };
      if (options.stateStore !== undefined && identityPubkey !== "") {
        for (const scope of scopes) {
          const stored = await options.stateStore.load(stateScope(scope));
          if (stored !== undefined) applyStoredState(scope, stored, true);
        }
      }
      if (restoreRuntime) {
        const restored = await eventRuntime.restore(
          scopes.map(runtimeScope),
          currentGeneration,
        );
        if (generation !== currentGeneration) return;
        applyRuntimeRevision(restored);
        syncPlans = restored.syncPlans ?? {};
      }
      await refreshProjection(currentGeneration);
      status = "connecting";
      let progressive = false;
      for (const scope of scopes) {
        signal.throwIfAborted();
        const session = await options.source.open(
          scope,
          identity === undefined ? {} : { identity },
          signal,
        );
        if (generation !== currentGeneration) {
          session.close();
          return;
        }
        sessions.set(scope.id, session);
        let snapshotReady = false;
        const pendingEvents: NostrEvent[] = [];
        const subscription = await session.subscribe((events) => {
          if (generation !== currentGeneration) return;
          if (!snapshotReady) {
            pendingEvents.push(...events);
            return;
          }
          queueLiveEvents(scope.id, events, currentGeneration);
        }, signal);
        subscriptions.set(scope.id, subscription);
        status = "synchronizing";
        const plan = syncPlans[scope.id] ?? {
          checkpoints: [],
          cachedEventIds: [],
        };
        const snapshot =
          session.synchronize === undefined
            ? await session.snapshot(signal)
            : await session.synchronize(
                {
                  plan,
                  ...(session.loadContentWindow === undefined
                    ? {}
                    : { strategy: "bootstrap" as const }),
                },
                signal,
              );
        progressive ||= session.loadContentWindow !== undefined;
        if (generation !== currentGeneration) return;
        await cacheSnapshot(scope, snapshot, pendingEvents, currentGeneration);
        mergePrivateEvents(scope.id, snapshot.privateEvents ?? []);
        capabilitiesByScope = {
          ...capabilitiesByScope,
          [scope.id]: snapshot.capabilities,
        };
        snapshotReady = true;
      }
      if (options.stateStore !== undefined && identityPubkey !== "") {
        for (const scope of scopes) {
          const stored = await options.stateStore.refresh(stateScope(scope));
          if (stored !== undefined) applyStoredState(scope, stored, true);
        }
      }
      status = "connected";
      await refreshProjection(currentGeneration);
      updatePulseAvailability();
      if (pulseActive) {
        startPulseRefreshTimers();
        void refreshPulse().catch(() => undefined);
      }
      cache = {
        ...cache,
        freshness: progressive ? "synchronizing" : "current",
        ...(cache.lastSynchronizedAt === undefined
          ? { lastSynchronizedAt: now() }
          : {}),
      };
      if (progressive) {
        contentSync = {
          phase: "background",
          rooms: Object.fromEntries(
            workspace.navigationSections
              .flatMap((section) => section.rooms)
              .filter((room) => room.kind !== "direct")
              .map((room) => [room.id, "unloaded" as const]),
          ),
        };
        void runProgressiveSynchronization(currentGeneration, signal);
      } else {
        contentSync = { phase: "complete", rooms: {} };
      }
    } catch (cause) {
      if (signal.aborted) return;
      error =
        cause instanceof Error ? cause.message : "Community connection failed";
      if (Object.values(eventsByScope).some((events) => events.length > 0)) {
        status = "offline";
        cache = { ...cache, freshness: "offline" };
      } else {
        status = "error";
      }
    }
  }

  function updateRoomContentSync(
    roomId: string,
    roomState: CommunityContentSyncState["rooms"][string],
  ): void {
    contentSync = {
      ...contentSync,
      rooms: { ...contentSync.rooms, [roomId]: roomState },
    };
  }

  async function cacheContentWindow(
    scope: CommunityScope,
    window: CommunityContentWindow,
    currentGeneration: number,
    checkpoint?: CommunitySnapshot["checkpoints"],
  ): Promise<void> {
    await cacheSnapshot(
      scope,
      {
        events: window.events,
        capabilities: capabilitiesByScope[scope.id] ?? NO_CAPABILITIES,
        ...(checkpoint === undefined ? {} : { checkpoints: checkpoint }),
      },
      [],
      currentGeneration,
    );
  }

  async function loadInteractiveRoom(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const requestedGeneration = generation;
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    const session = sessions.get(scopeId);
    const room =
      scope === undefined
        ? undefined
        : communityRooms(scope, eventsByScope[scopeId] ?? []).find(
            (candidate) => candidate.id === roomId,
          );
    if (
      scope === undefined ||
      session?.loadContentWindow === undefined ||
      room === undefined
    ) {
      return;
    }
    const request: CommunityContentWindowRequest =
      rootEventId === undefined
        ? {
            collection:
              room.kind === "forum" ? "forum-topics" : "channel-roots",
            groupId: room.groupId,
            limit: 50,
          }
        : {
            collection: "thread",
            groupId: room.groupId,
            rootEventId,
            limit: 20,
          };
    try {
      const window = await session.loadContentWindow(
        request,
        signal ?? controllerAbort?.signal,
      );
      if (generation !== requestedGeneration) return;
      await cacheContentWindow(scope, window, requestedGeneration);
      if (rootEventId === undefined) updateRoomContentSync(room.id, "partial");
    } catch (cause) {
      if (generation !== requestedGeneration || isAbort(cause)) return;
      contentSync = {
        ...contentSync,
        phase: "partial-error",
        message:
          cause instanceof Error
            ? cause.message
            : "Recent community content could not be loaded",
      };
      throw cause;
    }
  }

  async function runProgressiveSynchronization(
    currentGeneration: number,
    parentSignal: AbortSignal,
    priority: {
      scopeId: string;
      roomId: string;
      rootEventId?: string;
    } = {
      scopeId: activeCommunityId,
      roomId: activeRoomId,
    },
  ): Promise<void> {
    const run = ++progressiveRun;
    progressiveAbort?.abort(
      new DOMException("Community history priority changed", "AbortError"),
    );
    const runAbort = new AbortController();
    progressiveAbort = runAbort;
    const signal = AbortSignal.any([parentSignal, runAbort.signal]);
    try {
      await loadInteractiveRoom(
        priority.scopeId,
        priority.roomId,
        priority.rootEventId,
        signal,
      );
      if (run !== progressiveRun) return;
      for (const scope of scopes) {
        const session = sessions.get(scope.id);
        if (session?.loadContentWindow === undefined) continue;
        const rooms = communityRooms(scope, eventsByScope[scope.id] ?? []);
        for (const room of rooms) {
          signal.throwIfAborted();
          if (generation !== currentGeneration || run !== progressiveRun)
            return;
          const stream = `history:${room.groupId}`;
          const restoredCheckpoint = syncPlans[scope.id]?.checkpoints.find(
            (checkpoint) => checkpoint.stream === stream,
          );
          updateRoomContentSync(room.id, "partial");
          const recent = await session.loadContentWindow(
            {
              collection: "room-history",
              groupId: room.groupId,
              limit: 100,
            },
            signal,
          );
          if (generation !== currentGeneration || run !== progressiveRun)
            return;
          const canResume =
            restoredCheckpoint !== undefined &&
            restoredCheckpoint.cursorEventId !== undefined;
          if (restoredCheckpoint?.complete || (canResume && recent.hasOlder)) {
            await cacheContentWindow(scope, recent, currentGeneration);
          } else {
            const checkpoint = contentCheckpoint(scope, stream, recent, now());
            await cacheContentWindow(scope, recent, currentGeneration, [
              checkpoint,
            ]);
            rememberSyncCheckpoint(scope.id, checkpoint, recent.events);
          }
          if (restoredCheckpoint?.complete || !recent.hasOlder) {
            updateRoomContentSync(room.id, "complete");
            continue;
          }
          let before = canResume
            ? {
                createdAt: restoredCheckpoint.createdAt,
                eventId: restoredCheckpoint.cursorEventId!,
              }
            : recent.olderCursor;
          for (;;) {
            if (before === undefined) break;
            signal.throwIfAborted();
            const window = await session.loadContentWindow(
              {
                collection: "room-history",
                groupId: room.groupId,
                ...(before === undefined ? {} : { before }),
                limit: 100,
              },
              signal,
            );
            if (generation !== currentGeneration || run !== progressiveRun)
              return;
            const checkpoint = contentCheckpoint(scope, stream, window, now());
            await cacheContentWindow(scope, window, currentGeneration, [
              checkpoint,
            ]);
            rememberSyncCheckpoint(scope.id, checkpoint, window.events);
            if (!window.hasOlder || window.olderCursor === undefined) break;
            before = window.olderCursor;
            await yieldToBrowser();
          }
          updateRoomContentSync(room.id, "complete");
        }
      }
      if (generation !== currentGeneration || run !== progressiveRun) return;
      contentSync = { ...contentSync, phase: "complete" };
      cache = { ...cache, freshness: "current" };
    } catch (cause) {
      if (
        generation !== currentGeneration ||
        run !== progressiveRun ||
        isAbort(cause)
      )
        return;
      contentSync = {
        ...contentSync,
        phase: "partial-error",
        message:
          cause instanceof Error
            ? cause.message
            : "Older community history could not be synchronized",
      };
      cache = {
        ...cache,
        freshness: "synchronizing",
        ...(contentSync.message === undefined
          ? {}
          : { degradedReason: contentSync.message }),
      };
    } finally {
      if (run === progressiveRun && progressiveAbort === runAbort) {
        progressiveAbort = undefined;
      }
    }
  }

  function contentCheckpoint(
    scope: CommunityScope,
    stream: string,
    window: CommunityContentWindow,
    synchronizedAt: number,
  ): NonNullable<CommunitySnapshot["checkpoints"]>[number] {
    return {
      relayUrl: scope.relayUrl,
      stream,
      createdAt: window.olderCursor?.createdAt ?? 0,
      synchronizedAt,
      ...(window.olderCursor === undefined
        ? {}
        : { cursorEventId: window.olderCursor.eventId }),
      complete: !window.hasOlder,
    };
  }

  function rememberSyncCheckpoint(
    scopeId: string,
    checkpoint: NonNullable<CommunitySnapshot["checkpoints"]>[number],
    events: readonly NostrEvent[],
  ): void {
    syncPlans = {
      ...syncPlans,
      [scopeId]: {
        checkpoints: [
          ...(syncPlans[scopeId]?.checkpoints ?? []).filter(
            (candidate) => candidate.stream !== checkpoint.stream,
          ),
          checkpoint,
        ],
        cachedEventIds: [
          ...new Set([
            ...(syncPlans[scopeId]?.cachedEventIds ?? []),
            ...events.map((event) => event.id),
          ]),
        ],
      },
    };
  }

  function prioritizeContent(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
  ): void {
    if (controllerAbort === undefined) return;
    const session = sessions.get(scopeId);
    if (session?.loadContentWindow === undefined) return;
    contentSync = { ...contentSync, phase: "background" };
    cache = { ...cache, freshness: "synchronizing" };
    void runProgressiveSynchronization(generation, controllerAbort.signal, {
      scopeId,
      roomId,
      ...(rootEventId === undefined ? {} : { rootEventId }),
    });
  }

  function updatePulseAvailability(): void {
    const session = sessions.get(activeCommunityId);
    if (
      capabilitiesByScope[activeCommunityId]?.pulse !== true ||
      session?.loadPulseWindow === undefined
    ) {
      pulse = undefined;
      return;
    }
    if (pulse !== undefined) {
      pulse = {
        ...pulse,
        canDirectMessage: capabilities.directMessages,
        ...(options.pulse?.agents === undefined
          ? {}
          : { agents: options.pulse.agents }),
      };
      return;
    }
    pulse = {
      tab: "everyone",
      status: "idle",
      notes: [],
      agentActivities: [],
      members: [],
      ...(options.pulse?.agents === undefined
        ? {}
        : { agents: options.pulse.agents }),
      canDirectMessage: capabilities.directMessages,
    };
  }

  async function refreshPulse(
    kind: "notes" | "reactions" = "notes",
  ): Promise<void> {
    if (pulse === undefined) return;
    const currentPulse = pulse;
    const selected = currentPulse.tab;
    if (selected === "search") return;
    const session = sessions.get(activeCommunityId);
    if (session?.loadPulseWindow === undefined) return;
    const requestedGeneration = generation;
    const run = ++pulseRun;
    pulseAbort?.abort(new DOMException("Pulse request replaced", "AbortError"));
    const requestAbort = new AbortController();
    pulseAbort = requestAbort;
    const parentSignal = controllerAbort?.signal;
    const signal =
      parentSignal === undefined
        ? requestAbort.signal
        : AbortSignal.any([parentSignal, requestAbort.signal]);
    const { error: _currentError, ...pulseWithoutError } = currentPulse;
    pulse = {
      ...pulseWithoutError,
      status: currentPulse.notes.length === 0 ? "loading" : "refreshing",
    };
    try {
      const window = await session.loadPulseWindow(
        {
          tab: selected,
          ...(selected === "agents"
            ? {
                agentPubkeys:
                  options.pulse?.agents?.map((agent) => agent.pubkey) ?? [],
              }
            : {}),
          ...(kind === "reactions" && currentPulse.notes.length > 0
            ? { noteIds: currentPulse.notes.map((note) => note.id) }
            : {}),
        },
        signal,
      );
      if (
        run !== pulseRun ||
        requestedGeneration !== generation ||
        pulse?.tab !== selected
      ) {
        return;
      }
      pulseEvents = [...window.events];
      pulsePrimaryEventIds = [...window.primaryEventIds];
      pulse = materializeCommunityPulse(pulseEvents, {
        tab: selected,
        primaryEventIds: pulsePrimaryEventIds,
        ...(identityPubkey === "" ? {} : { identityPubkey }),
        ...(options.pulse?.agents === undefined
          ? {}
          : { agents: options.pulse.agents }),
        asOf: now(),
        canDirectMessage: capabilities.directMessages,
      });
    } catch (cause) {
      if (
        isAbort(cause) ||
        run !== pulseRun ||
        requestedGeneration !== generation
      ) {
        return;
      }
      const message =
        cause instanceof Error ? cause.message : "Pulse could not be loaded";
      pulse = {
        ...(pulse ?? {
          tab: selected,
          notes: [],
          agentActivities: [],
          members: [],
          canDirectMessage: capabilities.directMessages,
        }),
        status: "error",
        error: message,
      };
      throw cause;
    } finally {
      if (pulseAbort === requestAbort) pulseAbort = undefined;
    }
  }

  function startPulseRefreshTimers(): void {
    stopPulseRefreshTimers("Pulse timers restarted");
    if (!pulseActive || pulse === undefined) return;
    pulseNoteTimer = setInterval(
      () => void refreshPulse("notes").catch(() => undefined),
      30_000,
    );
    pulseReactionTimer = setInterval(
      () => void refreshPulse("reactions").catch(() => undefined),
      60_000,
    );
  }

  function stopPulseRefreshTimers(reason: string): void {
    if (pulseNoteTimer !== undefined) clearInterval(pulseNoteTimer);
    if (pulseReactionTimer !== undefined) clearInterval(pulseReactionTimer);
    pulseNoteTimer = undefined;
    pulseReactionTimer = undefined;
    pulseAbort?.abort(new DOMException(reason, "AbortError"));
    pulseAbort = undefined;
    pulseRun += 1;
  }

  function dispose(): void {
    pulseActive = false;
    stopPulseRefreshTimers("Controller disposed");
    closeConnections("Controller disposed");
    eventRuntime.dispose();
    status = "idle";
  }

  async function reconnect(restoreRuntime = true): Promise<void> {
    closeConnections("Controller reconnecting");
    controllerAbort = new AbortController();
    const currentGeneration = ++generation;
    await connect(currentGeneration, controllerAbort.signal, restoreRuntime);
    if (status === "error") {
      throw new Error(error || "Community connection failed");
    }
  }

  function closeConnections(reason: string): void {
    generation += 1;
    progressiveRun += 1;
    progressiveAbort?.abort(new DOMException(reason, "AbortError"));
    progressiveAbort = undefined;
    stopPulseRefreshTimers(reason);
    controllerAbort?.abort(new DOMException(reason, "AbortError"));
    controllerAbort = undefined;
    for (const subscription of subscriptions.values()) subscription.close();
    subscriptions.clear();
    queuedEvents.clear();
    queuedEventGenerations.clear();
    scheduledEventScopes.clear();
    for (const session of sessions.values()) session.close();
    sessions.clear();
  }

  async function refresh(): Promise<void> {
    const signal = controllerAbort?.signal;
    await runOperation("refresh", async () => {
      for (const scope of scopes) await refreshScope(scope.id, signal);
    });
  }

  async function refreshScope(
    scopeId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const session = sessions.get(scopeId);
    if (session === undefined) return;
    const plan = syncPlans[scopeId] ?? {
      checkpoints: [],
      cachedEventIds: [],
    };
    const snapshot =
      session.loadContentWindow !== undefined &&
      session.synchronize !== undefined
        ? await session.synchronize({ plan, strategy: "bootstrap" }, signal)
        : await session.snapshot(signal);
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    if (scope !== undefined) {
      await cacheSnapshot(scope, snapshot, [], generation);
    }
    mergePrivateEvents(scopeId, snapshot.privateEvents ?? [], true);
    capabilitiesByScope = {
      ...capabilitiesByScope,
      [scopeId]: snapshot.capabilities,
    };
    if (scopeId === activeCommunityId) updatePulseAvailability();
    await refreshProjection(generation);
    if (
      session.loadContentWindow !== undefined &&
      controllerAbort !== undefined
    ) {
      contentSync = { ...contentSync, phase: "background" };
      cache = { ...cache, freshness: "synchronizing" };
      const requestedGeneration = generation;
      void runProgressiveSynchronization(
        requestedGeneration,
        controllerAbort.signal,
      );
    }
  }

  async function retry(operation: string): Promise<void> {
    if (operations[operation]?.failure?.retryable !== true) return;
    const action = retries.get(operation);
    if (action !== undefined) await action();
  }

  function dismissOperation(operation: string): void {
    retries.delete(operation);
    acceptedEventIdsByOperation.delete(operation);
    if (operations[operation] === undefined) return;
    operations = {
      ...operations,
      [operation]: { status: "idle" },
    };
  }

  function rematerializePulse(
    status: CommunityPulseModel["status"] = "ready",
    pulseError?: string,
  ): void {
    const selected = pulse?.tab;
    if (selected === undefined || selected === "search") return;
    pulse = {
      ...materializeCommunityPulse(pulseEvents, {
        tab: selected,
        primaryEventIds: pulsePrimaryEventIds,
        ...(identityPubkey === "" ? {} : { identityPubkey }),
        ...(options.pulse?.agents === undefined
          ? {}
          : { agents: options.pulse.agents }),
        asOf: now(),
        canDirectMessage: capabilities.directMessages,
      }),
      status,
      ...(pulseError === undefined ? {} : { error: pulseError }),
    };
  }

  async function selectPulseTab(tab: CommunityPulseTab): Promise<void> {
    if (tab === "agents" && options.pulse?.agents === undefined) return;
    if (tab === "following" || tab === "liked" || tab === "mine") {
      await ensureIdentity(`pulse:tab:${tab}`);
    }
    updatePulseAvailability();
    if (pulse === undefined) return;
    pulseAbort?.abort(new DOMException("Pulse tab changed", "AbortError"));
    pulseRun += 1;
    pulseEvents = [];
    pulsePrimaryEventIds = [];
    const { error: _previousError, ...pulseWithoutError } = pulse;
    pulse = {
      ...pulseWithoutError,
      tab,
      status: tab === "search" ? "ready" : "idle",
      notes: [],
      agentActivities: [],
      members: [],
    };
    if (tab !== "search") await refreshPulse();
  }

  async function publishPulse(
    submission: import("../components/index.js").CommunityComposerSubmission,
    replyToEventId?: string,
  ): Promise<void> {
    const content = submission.content.trim();
    const operation = `pulse:publish:${replyToEventId ?? "note"}`;
    if (content === "") {
      throwOperationFailure(
        operation,
        "validation",
        "Write a note before publishing",
      );
    }
    await ensureIdentity(operation);
    const parent =
      replyToEventId === undefined
        ? undefined
        : pulseEvents.find(
            (event) => event.kind === 1 && event.id === replyToEventId,
          );
    if (replyToEventId !== undefined && parent === undefined) {
      throwOperationFailure(
        operation,
        "validation",
        "The note being replied to is unavailable",
      );
    }
    const mentions = [
      ...new Set([
        ...submission.mentionPubkeys,
        ...(parent === undefined ? [] : [parent.pubkey]),
      ]),
    ];
    const template: NostrEventTemplate = {
      kind: 1,
      created_at: now(),
      content,
      tags: [
        ...(parent === undefined
          ? []
          : [["e", parent.id, activeScope().relayUrl, "reply"]]),
        ...mentions.map((pubkey) => ["p", pubkey]),
        ...submission.attachments.map((media) => [
          "imeta",
          `url ${media.url}`,
          `m ${media.mimeType}`,
          `x ${media.sha256}`,
          `size ${media.size}`,
          ...(media.width === undefined || media.height === undefined
            ? []
            : [`dim ${media.width}x${media.height}`]),
          ...(media.alt === undefined ? [] : [`alt ${media.alt}`]),
        ]),
      ],
    };
    const signed = await identity!.signEvent(template);
    const previousEvents = pulseEvents;
    const previousIds = pulsePrimaryEventIds;
    pulseEvents = [...pulseEvents, signed];
    if (pulse?.tab === "everyone" || pulse?.tab === "mine") {
      pulsePrimaryEventIds = [
        signed.id,
        ...pulsePrimaryEventIds.filter((id) => id !== signed.id),
      ];
    }
    rematerializePulse("refreshing");
    try {
      await execute(operation, {
        type: "publish",
        template,
        optimisticEvent: signed,
      });
    } catch (cause) {
      pulseEvents = previousEvents;
      pulsePrimaryEventIds = previousIds;
      rematerializePulse(
        "error",
        cause instanceof Error
          ? cause.message
          : "The note could not be published",
      );
      throw cause;
    }
    await refreshPulse().catch(() => undefined);
  }

  async function togglePulseLike(eventId: string): Promise<void> {
    const operation = `pulse:like:${eventId}`;
    await ensureIdentity(operation);
    const target = pulseEvents.find(
      (event) => event.kind === 1 && event.id === eventId,
    );
    if (target === undefined) {
      throwOperationFailure(operation, "validation", "The note is unavailable");
    }
    const previousReaction = pulseEvents.find(
      (event) =>
        event.kind === 7 &&
        event.pubkey === identityPubkey &&
        event.content === "+" &&
        pulseEventTargetId(event) === eventId &&
        !eventDeleted(pulseEvents, event.id),
    );
    const template: NostrEventTemplate =
      previousReaction === undefined
        ? {
            kind: 7,
            created_at: now(),
            content: "+",
            tags: [
              ["e", target.id],
              ["p", target.pubkey],
              ["k", "1"],
            ],
          }
        : {
            kind: 5,
            created_at: now(),
            content: "",
            tags: [
              ["e", previousReaction.id],
              ["k", "7"],
            ],
          };
    const signed = await identity!.signEvent(template);
    const previousEvents = pulseEvents;
    pulseEvents = [...pulseEvents, signed];
    rematerializePulse("refreshing");
    try {
      await execute(operation, {
        type: "publish",
        template,
        optimisticEvent: signed,
      });
    } catch (cause) {
      pulseEvents = previousEvents;
      rematerializePulse(
        "error",
        cause instanceof Error
          ? cause.message
          : "The reaction could not be published",
      );
      throw cause;
    }
    await refreshPulse("reactions").catch(() => undefined);
  }

  const actions: CommunityControllerActions = {
    pulse: {
      setActive(active) {
        pulseActive = active;
        updatePulseAvailability();
        if (!active) {
          stopPulseRefreshTimers("Pulse closed");
          return;
        }
        startPulseRefreshTimers();
        if (pulse?.status === "idle") {
          void refreshPulse().catch(() => undefined);
        }
      },
      selectTab: selectPulseTab,
      refresh: refreshPulse,
      publish: publishPulse,
      toggleLike: togglePulseLike,
    },
    selectCommunity(communityId) {
      const scope = scopes.find((candidate) => candidate.id === communityId);
      if (scope === undefined) return;
      activeCommunityId = communityId;
      const rooms = communityRooms(scope, eventsByScope[scope.id] ?? []);
      if (!rooms.some((room) => room.id === activeRoomId)) {
        activeRoomId = rooms[0]?.id ?? "";
      }
      activeTopicId = undefined;
      activeThreadId = undefined;
      sidePanel = "none";
      searchQuery = "";
      searchResults = [];
      replyTarget = undefined;
      requestProjection();
      void persistSelection(scope.id);
      prioritizeContent(scope.id, activeRoomId);
      updatePulseAvailability();
      if (pulseActive) void refreshPulse().catch(() => undefined);
    },
    selectRoom(roomId) {
      const roomExists = workspace.navigationSections
        .flatMap((section) => section.rooms)
        .some((candidate) => candidate.id === roomId);
      if (!roomExists) return;
      activeRoomId = roomId;
      activeTopicId = undefined;
      activeThreadId = undefined;
      sidePanel = "none";
      replyTarget = undefined;
      requestProjection();
      void persistSelection(activeCommunityId);
      prioritizeContent(activeCommunityId, roomId);
    },
    openTopic(topicId) {
      activeTopicId = topicId;
      activeThreadId = undefined;
      sidePanel = "none";
      requestProjection();
      prioritizeContent(activeCommunityId, activeRoomId, topicId);
    },
    openThread(messageId) {
      activeThreadId = messageId;
      sidePanel = "thread";
      requestProjection();
      prioritizeContent(activeCommunityId, activeRoomId, messageId);
    },
    closeSidePanel() {
      activeThreadId = undefined;
      sidePanel = "none";
      replyTarget = undefined;
      requestProjection();
    },
    openDetails() {
      activeThreadId = undefined;
      sidePanel = "details";
      requestProjection();
    },
    openDirectMessage(participants) {
      const peers = [...new Set(participants)]
        .filter((pubkey) => pubkey !== identityPubkey)
        .toSorted();
      if (peers.length === 0) return;
      const roomId = directConversationId(peers);
      directParticipantsByRoom = {
        ...directParticipantsByRoom,
        [roomId]: peers,
      };
      activeRoomId = roomId;
      activeTopicId = undefined;
      activeThreadId = undefined;
      sidePanel = "none";
      replyTarget = undefined;
      requestProjection();
    },
    async sendMessage(roomId, content) {
      const operation = `send:${roomId}`;
      const room = roomById(roomId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      if (
        room.kind === "forum" &&
        room.id === activeRoomId &&
        activeTopicId !== undefined
      ) {
        await actions.sendReply(activeTopicId, content);
        return;
      }
      if (content.trim() === "")
        throwOperationFailure(
          operation,
          "validation",
          "Write a message before sending",
        );
      assertCanPublish(room.id, operation);
      await publishTemplate(operation, {
        kind: 9,
        created_at: now(),
        content: content.trim(),
        tags: [["h", room.groupId]],
      });
    },
    async sendReply(rootMessageId, content) {
      const operation = `reply:${rootMessageId}`;
      if (activeRoomModel()?.kind === "direct") {
        if (content.trim() === "")
          throwOperationFailure(
            operation,
            "validation",
            "Write a reply before sending",
          );
        await actions.sendDirectMessage(
          currentDirectRecipients(),
          content.trim(),
          rootMessageId,
        );
        return;
      }
      const room = activeRoomScope();
      const parent = activeEvents().find((event) => event.id === rootMessageId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      if (parent === undefined)
        throwOperationFailure(
          operation,
          "validation",
          "The message being replied to is unavailable",
        );
      if (content.trim() === "")
        throwOperationFailure(
          operation,
          "validation",
          "Write a reply before sending",
        );
      assertCanPublish(room.id, operation);
      let template: NostrEventTemplate;
      if (room.kind === "forum") {
        const rootId =
          parent.kind === 11
            ? parent.id
            : parent.tags.find((tag) => tag[0] === "E")?.[1];
        const root =
          activeEvents().find((event) => event.id === rootId) ?? parent;
        template = createNip29ForumCommentTemplate(
          room.groupId,
          root,
          parent,
          content.trim(),
          now(),
          activeScope().relayUrl,
        );
      } else {
        const rootId =
          parent.tags.find((tag) => tag[0] === "e" && tag[3] === "root")?.[1] ??
          parent.id;
        template = {
          kind: 9,
          created_at: now(),
          content: content.trim(),
          tags: [
            ["h", room.groupId],
            ["e", rootId, activeScope().relayUrl, "root"],
            ["e", parent.id, activeScope().relayUrl, "reply"],
            ["p", parent.pubkey],
          ],
        };
      }
      await publishTemplate(operation, template);
    },
    async createTopic(roomId, draft) {
      const operation = `topic:${roomId}`;
      const room = roomById(roomId);
      const content = typeof draft === "string" ? draft : draft.content;
      if (room?.kind !== "forum")
        throwOperationFailure(
          operation,
          "validation",
          "Select a forum before creating a post",
        );
      if (content.trim() === "")
        throwOperationFailure(
          operation,
          "validation",
          "Write a post before publishing",
        );
      assertCanPublish(room.id, operation);
      const title =
        typeof draft === "string"
          ? content.trim().split(/\r?\n/u)[0]?.slice(0, 120) || "Discussion"
          : draft.title.trim() || "Discussion";
      const tags =
        typeof draft === "string"
          ? []
          : [...new Set(draft.tags ?? [])]
              .map((tag) => tag.trim())
              .filter(Boolean);
      const template = createNip29ForumThreadTemplate(
        room.groupId,
        content.trim(),
        now(),
      );
      await publishTemplate(operation, {
        ...template,
        tags: [
          ...template.tags.filter((tag) => tag[0] !== "title"),
          ["title", title],
          ...tags.map((tag) => ["t", tag]),
        ],
      });
    },
    async sendDirectMessage(recipients, content, replyToEventId) {
      const peers = [...new Set(recipients)]
        .filter((pubkey) => pubkey !== identityPubkey)
        .toSorted();
      const operation = `direct:${peers.length === 0 ? "new" : directConversationId(peers)}`;
      if (peers.length === 0)
        throwOperationFailure(
          operation,
          "validation",
          "Choose at least one recipient",
        );
      if (content.trim() === "")
        throwOperationFailure(
          operation,
          "validation",
          "Write a message before sending",
        );
      const roomId = directConversationId(peers);
      directParticipantsByRoom = {
        ...directParticipantsByRoom,
        [roomId]: peers,
      };
      activeRoomId = roomId;
      await execute(operation, {
        type: "direct-message",
        recipients: peers,
        content: content.trim(),
        ...(replyToEventId === undefined ? {} : { replyToEventId }),
      });
      replyTarget = undefined;
    },
    async toggleReaction(eventId, emoji, customEmoji) {
      const operation = `reaction:${eventId}:${emoji.trim() || "unknown"}`;
      validateCustomEmojiReaction(operation, customEmoji);
      if (activeRoomModel()?.kind === "direct") {
        const target = activePrivateEvents().find(
          (event) => event.id === eventId && event.kind === 14,
        );
        if (target === undefined)
          throwOperationFailure(
            operation,
            "validation",
            "The message being reacted to is unavailable",
          );
        if (emoji.trim() === "")
          throwOperationFailure(
            operation,
            "validation",
            "Choose a reaction before publishing",
          );
        await ensureIdentity(`direct-reaction:${eventId}:${emoji}`);
        const previous = activePrivateEvents().find(
          (event) =>
            event.kind === 7 &&
            event.pubkey === identityPubkey &&
            event.content === emoji &&
            event.tags.some((tag) => tag[0] === "e" && tag[1] === eventId) &&
            !privateEventDeleted(activePrivateEvents(), event.id),
        );
        await execute(`direct-reaction:${eventId}:${emoji}`, {
          type: "direct-message",
          recipients: currentDirectRecipients(),
          content: previous === undefined ? emoji : "",
          eventKind: previous === undefined ? 7 : 5,
          targetEventId: previous?.id ?? target.id,
          ...(previous === undefined && customEmoji !== undefined
            ? { customEmoji }
            : {}),
        });
        return;
      }
      const target = activeEvents().find((event) => event.id === eventId);
      const room = activeRoomScope();
      if (target === undefined)
        throwOperationFailure(
          operation,
          "validation",
          "The message being reacted to is unavailable",
        );
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      if (emoji.trim() === "")
        throwOperationFailure(
          operation,
          "validation",
          "Choose a reaction before publishing",
        );
      assertCanReact(room.id, operation);
      await ensureIdentity(`reaction:${eventId}:${emoji}`);
      const previous = activeEvents().find(
        (event) =>
          event.kind === 7 &&
          event.pubkey === identityPubkey &&
          event.content === emoji &&
          event.tags.some((tag) => tag[0] === "e" && tag[1] === eventId) &&
          !eventDeleted(activeEvents(), event.id),
      );
      if (previous !== undefined) {
        await execute(`reaction:${eventId}:${emoji}:remove`, {
          type: "delete",
          eventId: previous.id,
          groupId: room.groupId,
          mode: "owner",
        });
        return;
      }
      await publishTemplate(`reaction:${eventId}:${emoji}`, {
        kind: 7,
        created_at: now(),
        content: emoji,
        tags: [
          ["h", room.groupId],
          ["e", target.id],
          ["p", target.pubkey],
          ["k", target.kind.toString()],
          ...(customEmoji === undefined
            ? []
            : [["emoji", customEmoji.shortcode, customEmoji.url]]),
        ],
      });
    },
    async editEvent(eventId, content) {
      const operation = `edit:${eventId}`;
      if (activeRoomModel()?.kind === "direct") {
        throwOperationFailure(
          operation,
          "restricted",
          "Direct messages cannot be edited",
        );
      }
      const room = activeRoomScope();
      const target = activeEvents().find((event) => event.id === eventId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      if (
        target === undefined ||
        ![9, 11, 1_111].includes(target.kind) ||
        !target.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId)
      ) {
        throwOperationFailure(
          operation,
          "validation",
          "The message is unavailable",
        );
      }
      if (content.trim() === "") {
        throwOperationFailure(
          operation,
          "validation",
          "Write a message before saving",
        );
      }
      await ensureIdentity(operation);
      if (target.pubkey !== identityPubkey) {
        throwOperationFailure(
          operation,
          "restricted",
          "Only the author can edit this message",
        );
      }
      if (!capabilities.editMessages) {
        throwOperationFailure(
          operation,
          "restricted",
          "This community source does not support message editing",
        );
      }
      assertCanPublish(room.id, operation);
      await publishTemplate(operation, {
        kind: COMMUNITY_MESSAGE_EDIT_KIND,
        created_at: now(),
        content: content.trim(),
        tags: [
          ["h", room.groupId],
          ["e", target.id],
        ],
      });
    },
    async deleteEvent(eventId) {
      const operation = `delete:${eventId}`;
      if (activeRoomModel()?.kind === "direct") {
        const target = activePrivateEvents().find(
          (event) => event.id === eventId && event.kind === 14,
        );
        if (target === undefined)
          throwOperationFailure(
            operation,
            "validation",
            "The direct message is unavailable",
          );
        if (target.pubkey !== identityPubkey)
          throwOperationFailure(
            operation,
            "restricted",
            "Only your own direct messages can be deleted",
          );
        await execute(`direct-delete:${eventId}`, {
          type: "direct-message",
          recipients: currentDirectRecipients(),
          content: "",
          eventKind: 5,
          targetEventId: eventId,
        });
        return;
      }
      const room = activeRoomScope();
      const target = activeEvents().find((event) => event.id === eventId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      if (target === undefined)
        throwOperationFailure(
          operation,
          "validation",
          "The message is unavailable",
        );
      await ensureIdentity(`delete:${eventId}`);
      const owner = target.pubkey === identityPubkey;
      if (
        !owner &&
        !isGroupAdmin(activeEvents(), room.groupId, identityPubkey)
      ) {
        throwOperationFailure(
          operation,
          "restricted",
          "The relay has not granted permission to delete this message",
        );
      }
      await execute(`delete:${eventId}`, {
        type: "delete",
        eventId,
        groupId: room.groupId,
        mode: owner ? "owner" : "moderator",
      });
    },
    async reportEvent(eventId, report) {
      const operation = `report:${eventId}`;
      if (activeRoomModel()?.kind === "direct") {
        throwOperationFailure(
          operation,
          "restricted",
          "Direct messages cannot be reported from this view",
        );
      }
      const room = activeRoomScope();
      const target = activeEvents().find(
        (event) => event.id === eventId && [9, 11, 1_111].includes(event.kind),
      );
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      if (
        target === undefined ||
        !target.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId)
      )
        throwOperationFailure(
          operation,
          "validation",
          "The message is unavailable",
        );
      await ensureIdentity(operation);
      const recipients = configuredCuratorPubkeys(activeEvents()).filter(
        (pubkey) => pubkey !== identityPubkey,
      );
      if (recipients.length === 0) {
        throwOperationFailure(
          operation,
          "restricted",
          "No curator recipients are configured on this relay",
        );
      }
      await execute(operation, {
        type: "direct-message",
        recipients,
        content: formatCommunityMessageReport(target, room.name, report),
      });
    },
    async createRoom(roomKind, update) {
      validateRoomUpdate(update, capabilities);
      const groupId = createGroupId();
      await execute(`room:create:${groupId}`, {
        type: "create-room",
        groupId,
        roomKind,
        update,
      });
      scopes = scopes.map((scope) =>
        scope.id === activeCommunityId
          ? {
              ...scope,
              rooms: [
                ...(scope.rooms ?? []),
                {
                  id: groupId,
                  groupId,
                  name: update.name.trim(),
                  kind: roomKind,
                  ...(update.description.trim() === ""
                    ? {}
                    : { description: update.description.trim() }),
                  private: update.visibility === "private",
                },
              ],
            }
          : scope,
      );
      activeRoomId = groupId;
      sidePanel = "none";
      await refreshProjection(generation);
    },
    async updateRoom(roomId, update) {
      const operation = `room:update:${roomId}`;
      const room = roomById(roomId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      validateRoomUpdate(update, capabilities);
      await execute(operation, {
        type: "update-room",
        groupId: room.groupId,
        update,
      });
      sidePanel = "none";
    },
    async deleteRoom(roomId) {
      const operation = `room:delete:${roomId}`;
      const room = roomById(roomId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      const wasActive = activeRoomScope()?.groupId === room.groupId;
      await execute(operation, {
        type: "delete-room",
        groupId: room.groupId,
      });
      scopes = scopes.map((scope) =>
        scope.id === activeCommunityId
          ? {
              ...scope,
              rooms: (scope.rooms ?? []).filter(
                (candidate) => candidate.groupId !== room.groupId,
              ),
            }
          : scope,
      );
      if (wasActive) {
        const replacement = communityRooms(activeScope(), activeEvents()).find(
          (candidate) => candidate.groupId !== room.groupId,
        );
        activeRoomId = replacement?.id ?? "";
        sidePanel = "none";
      }
      await refreshProjection(generation);
    },
    async search(query) {
      searchQuery = query;
      if (query.trim() === "") {
        searchResults = [];
        return;
      }
      const requestedGeneration = generation;
      const local = await eventRuntime.search({
        generation: requestedGeneration,
        scopeId: activeCommunityId,
        query,
      });
      if (searchQuery === query && generation === requestedGeneration) {
        searchResults = resolveSearchResultRooms(local);
      }
      const session = sessions.get(activeCommunityId);
      if (session === undefined) return;
      await runOperation("search", async () => {
        const result = await session.search(query, controllerAbort?.signal);
        if (searchQuery === query && generation === requestedGeneration) {
          searchResults = distinctSearchResults(
            resolveSearchResultRooms([...local, ...result]),
          );
        }
      });
    },
    async searchMembers(query) {
      const normalized = query.trim().toLocaleLowerCase();
      const loaded = workspace.members.filter((member) =>
        `${member.name} ${member.handle} ${member.id}`
          .toLocaleLowerCase()
          .includes(normalized),
      );
      const directKey = parsePublicKey(query);
      const directMember =
        directKey === undefined
          ? []
          : [
              {
                id: directKey,
                name: directKey.slice(0, 12),
                handle: directKey.slice(0, 12),
                initials: directKey.slice(0, 2).toUpperCase(),
                presence: "offline" as const,
              },
            ];
      memberDirectory = {
        query,
        results: distinctMembers([...loaded, ...directMember]),
        completeness:
          activeRoomModel()?.memberListCompleteness ?? "unavailable",
      };
      if (normalized === "") return;
      const session = sessions.get(activeCommunityId);
      if (session === undefined) return;
      await runOperation("members:search", async () => {
        const remote = await session.search(query, controllerAbort?.signal);
        const remoteMembers = remote.map(({ event }) => memberFromEvent(event));
        memberDirectory = {
          query,
          results: distinctMembers([
            ...loaded,
            ...directMember,
            ...remoteMembers,
          ]),
          completeness:
            activeRoomModel()?.memberListCompleteness ?? "unavailable",
        };
      });
    },
    setReplyTarget(eventId) {
      const workspaceMessage =
        workspace.messages.find((candidate) => candidate.id === eventId) ??
        workspace.thread?.messages.find(
          (candidate) => candidate.id === eventId,
        );
      const inboxMessage = inbox?.messages.find(
        (candidate) => candidate.id === eventId,
      );
      const message = workspaceMessage ?? inboxMessage;
      const room =
        workspaceMessage === undefined ? inbox?.room : activeRoomModel();
      if (message === undefined || room === undefined) return;
      const author = workspace.members.find(
        (member) => member.id === message.authorId,
      );
      replyTarget = {
        eventId,
        roomId: room.id,
        authorId: message.authorId,
        authorName: author?.name ?? message.authorId.slice(0, 12),
        content: message.content,
        kind: room.kind,
      };
      if (workspaceMessage !== undefined && room.kind === "channel") {
        activeThreadId = rootMessageId(activeEvents(), message.id);
        sidePanel = "thread";
      }
    },
    clearReplyTarget() {
      replyTarget = undefined;
    },
    async markRead(roomId) {
      const room = communityRooms(activeScope(), activeEvents()).find(
        (candidate) => candidate.id === roomId,
      );
      if (room === undefined) return;
      const latest = activeEvents()
        .filter((event) =>
          event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
        )
        .toSorted(
          (left, right) =>
            right.created_at - left.created_at ||
            right.id.localeCompare(left.id),
        )[0];
      if (latest === undefined) return;
      await updateStoredState(activeCommunityId, (stored) => {
        stored.readMarkers[roomId] = {
          createdAt: latest.created_at,
          eventId: latest.id,
          granularity: "room",
        };
        stored.preferences.forcedUnreadRoomIds = preferenceValue(
          navigation.forcedUnreadRoomIds.filter((id) => id !== roomId),
        );
      });
      navigation = {
        ...navigation,
        forcedUnreadRoomIds: navigation.forcedUnreadRoomIds.filter(
          (id) => id !== roomId,
        ),
      };
    },
    async markUnread(roomId) {
      await setNavigationList("forcedUnreadRoomIds", roomId, true);
    },
    async markAllRead() {
      for (const room of communityRooms(activeScope(), activeEvents())) {
        await actions.markRead(room.id);
      }
    },
    async setRoomStarred(roomId, starred) {
      await setNavigationList("starredRoomIds", roomId, starred);
    },
    async setRoomMuted(roomId, muted) {
      await setNavigationList("mutedRoomIds", roomId, muted);
    },
    async setRoomHidden(roomId, hidden) {
      await setNavigationList("hiddenRoomIds", roomId, hidden);
    },
    async assignRoomToSection(roomId, sectionId) {
      const sections = navigation.sections.map((section) => ({
        ...section,
        roomIds: section.roomIds.filter((id) => id !== roomId),
      }));
      const next =
        sectionId === undefined
          ? sections
          : sections.map((section) =>
              section.id === sectionId
                ? { ...section, roomIds: [...section.roomIds, roomId] }
                : section,
            );
      await persistNavigation({ ...navigation, sections: next });
    },
    async createNavigationSection(name) {
      const normalized = name.trim();
      if (normalized === "") throw new Error("Section name is required");
      const id = `section-${createGroupId()}`;
      await persistNavigation({
        ...navigation,
        sections: [
          ...navigation.sections,
          { id, name: normalized, roomIds: [] },
        ],
      });
      return id;
    },
    async renameNavigationSection(sectionId, name) {
      const normalized = name.trim();
      if (normalized === "") throw new Error("Section name is required");
      await persistNavigation({
        ...navigation,
        sections: navigation.sections.map((section) =>
          section.id === sectionId ? { ...section, name: normalized } : section,
        ),
      });
    },
    async deleteNavigationSection(sectionId) {
      await persistNavigation({
        ...navigation,
        sections: navigation.sections.filter(
          (section) => section.id !== sectionId,
        ),
      });
    },
    async reorderNavigationSections(sectionIds) {
      const byId = new Map(
        navigation.sections.map((section) => [section.id, section]),
      );
      const ordered = sectionIds
        .map((id) => byId.get(id))
        .filter((section) => section !== undefined);
      const missing = navigation.sections.filter(
        (section) => !sectionIds.includes(section.id),
      );
      await persistNavigation({
        ...navigation,
        sections: [...ordered, ...missing],
      });
    },
    async join(roomId) {
      const operation = `join:${roomId}`;
      const room = roomById(roomId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      await execute(operation, { type: "join", groupId: room.groupId });
      if (workspaceRoomById(room.id)?.membership !== "joined") {
        operations = {
          ...operations,
          [operation]: {
            status: "accepted",
            message:
              "Join request accepted by the relay. Waiting for membership confirmation.",
          },
        };
      }
    },
    async leave(roomId) {
      const operation = `leave:${roomId}`;
      const room = roomById(roomId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      await execute(operation, { type: "leave", groupId: room.groupId });
    },
    async addMember(roomId, pubkey, roles) {
      const operation = `add-member:${roomId}:${pubkey}`;
      const room = roomById(roomId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      await execute(operation, {
        type: "add-member",
        groupId: room.groupId,
        pubkey,
        ...(roles === undefined ? {} : { roles }),
      });
    },
    async removeMember(roomId, pubkey) {
      const operation = `remove-member:${roomId}:${pubkey}`;
      const room = roomById(roomId);
      if (room === undefined)
        throwOperationFailure(operation, "validation", "Room is unavailable");
      await execute(operation, {
        type: "remove-member",
        groupId: room.groupId,
        pubkey,
      });
    },
    async updateProfile(profile) {
      await ensureIdentity("settings:profile");
      const previous = latestAuthoredEvent(0);
      const content = parseJsonObject(previous?.content);
      setProfileField(content, "display_name", profile.displayName);
      setProfileField(content, "name", profile.username);
      setProfileField(content, "about", profile.about);
      setProfileField(content, "picture", profile.picture);
      await publishTemplate("settings:profile", {
        kind: 0,
        created_at: nextAuthoredTimestamp(0),
        content: JSON.stringify(content),
        tags: [],
      });
    },
    async updateStatus(userStatus) {
      await ensureIdentity("settings:status");
      await publishTemplate("settings:status", {
        kind: 30_315,
        created_at: nextAuthoredTimestamp(30_315),
        content: userStatus.trim(),
        tags: [["d", "general"]],
      });
    },
    async setCustomEmoji(shortcode, url) {
      await ensureIdentity("settings:emoji");
      const normalized = normalizeShortcode(shortcode);
      const normalizedUrl = url.trim();
      if (normalized === "") throw new Error("Emoji shortcode is required");
      if (normalizedUrl === "") throw new Error("Emoji image URL is required");
      const emojis = ownedEmojiMap();
      emojis.set(normalized, normalizedUrl);
      await publishEmojiSet(emojis, `settings:emoji:${normalized}`);
    },
    async removeCustomEmoji(shortcode) {
      await ensureIdentity("settings:emoji:remove");
      const normalized = normalizeShortcode(shortcode);
      const emojis = ownedEmojiMap();
      if (!emojis.delete(normalized)) return;
      await publishEmojiSet(emojis, `settings:emoji:${normalized}:remove`);
    },
    async updateRelayUrl(communityId, relayUrl) {
      const scope = scopes.find((candidate) => candidate.id === communityId);
      if (scope === undefined) throw new Error("Community was not found");
      const normalizedRelayUrl = normalizeRelayUrl(relayUrl);
      await runOperation(`settings:relay:${communityId}`, async () => {
        await options.configurationStore?.saveRelayUrl(
          communityId,
          normalizedRelayUrl,
        );
        scopes = scopes.map((candidate) =>
          candidate.id === communityId
            ? { ...candidate, relayUrl: normalizedRelayUrl }
            : candidate,
        );
        if (communityId === activeCommunityId) await reconnect();
      });
    },
    async clearCache(communityId) {
      const scope =
        communityId === undefined
          ? undefined
          : scopes.find((candidate) => candidate.id === communityId);
      if (communityId !== undefined && scope === undefined) return;
      await runOperation("cache:clear", async () => {
        await eventRuntime.clear(scope);
        cache = {
          mode: cache.mode,
          freshness: "empty",
          approximateBytes: 0,
        };
        if (status !== "offline") return;
        if (scope === undefined) {
          eventsByScope = {};
          return;
        }
        const next = { ...eventsByScope };
        delete next[scope.id];
        eventsByScope = next;
      });
    },
    async connectIdentity(connector = options.identityConnector) {
      if (identity !== undefined && identityPubkey !== "") return;
      if (connector === undefined) {
        const message = "No identity connector is available";
        authentication = { status: "error", error: message };
        throw new Error(message);
      }
      authentication = { status: "connecting" };
      try {
        identity = await connector.connect();
        const pubkey = await identity.getPublicKey();
        authentication = { status: "connected", pubkey };
        await reconnect(false);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Sign in failed";
        identity = undefined;
        identityPubkey = "";
        authentication = { status: "error", error: message };
        throw cause;
      }
    },
    async disconnectIdentity() {
      identity = undefined;
      identityPubkey = "";
      authentication = { status: "anonymous" };
      privateEventsByScope = {};
      directParticipantsByRoom = {};
      retries.clear();
      acceptedEventIdsByOperation.clear();
      operations = {};
      activeTopicId = undefined;
      activeThreadId = undefined;
      sidePanel = "none";
      replyTarget = undefined;
      if (pulse !== undefined) pulse = { ...pulse, tab: "everyone" };
      if (activeRoomId.startsWith("dm:")) {
        activeRoomId =
          communityRooms(activeScope(), activeEvents())[0]?.id ?? "";
      }
      await reconnect(false);
    },
  };

  const handlers: CommunityWorkspaceHandlers = {
    onSelectCommunity: actions.selectCommunity,
    onSelectRoom: actions.selectRoom,
    onOpenTopic: actions.openTopic,
    onOpenThread: actions.openThread,
    onCloseSidePanel: actions.closeSidePanel,
    onOpenDetails: actions.openDetails,
    onSendMessage: actions.sendMessage,
    onSendReply: actions.sendReply,
    onToggleReaction: actions.toggleReaction,
    onAddReaction: actions.toggleReaction,
    onJoinRoom: actions.join,
    onSearch: actions.search,
  };

  async function publishTemplate(
    operation: string,
    template: NostrEventTemplate,
  ): Promise<void> {
    await execute(operation, { type: "publish", template });
  }

  async function execute(
    operation: string,
    command: CommunityCommand,
  ): Promise<void> {
    let acceptedEvents: readonly NostrEvent[] = [];
    await runOperation(operation, async () => {
      if (status !== "connected") {
        throw new CommunityActionFailure(
          "network",
          "Reconnect to perform this action",
          true,
        );
      }
      await ensureIdentity(operation);
      const session = sessions.get(activeCommunityId);
      if (session === undefined) {
        throw new CommunityActionFailure(
          "network",
          "Community is not connected",
          true,
        );
      }
      acceptedEvents = await session.execute(command, controllerAbort?.signal);
      await cacheLiveEvents(activeCommunityId, acceptedEvents, generation);
      if (commandNeedsReconciliation(command)) {
        await refreshScope(activeCommunityId, controllerAbort?.signal);
      }
    });
    if (
      command.type !== "direct-message" &&
      acceptedEvents.length > 0 &&
      acceptedEvents.some(
        (event) =>
          !(eventsByScope[activeCommunityId] ?? []).some(
            (candidate) => candidate.id === event.id,
          ),
      )
    ) {
      acceptedEventIdsByOperation.set(
        operation,
        acceptedEvents.map((event) => event.id),
      );
      operations = {
        ...operations,
        [operation]: {
          status: "accepted",
          message: "Accepted by relay, still syncing.",
        },
      };
    }
  }

  async function runOperation(
    operation: string,
    action: () => Promise<void>,
  ): Promise<void> {
    retries.delete(operation);
    acceptedEventIdsByOperation.delete(operation);
    operations = {
      ...operations,
      [operation]: { status: "pending" },
    };
    try {
      await action();
      operations = {
        ...operations,
        [operation]: { status: "idle" },
      };
      retries.delete(operation);
    } catch (cause) {
      const failure = normalizeCommunityOperationFailure(cause);
      operations = {
        ...operations,
        [operation]: {
          status: "failed",
          message: failure.message,
          failure,
        },
      };
      if (failure.retryable) {
        retries.set(operation, async () => runOperation(operation, action));
      }
      throw cause;
    }
  }

  function throwOperationFailure(
    operation: string,
    category: CommunityOperationFailure["category"],
    message: string,
  ): never {
    const failure: CommunityOperationFailure = {
      category,
      message,
      retryable: false,
    };
    retries.delete(operation);
    operations = {
      ...operations,
      [operation]: { status: "failed", message, failure },
    };
    throw new CommunityActionFailure(category, message);
  }

  function assertCanPublish(roomId: string, operation: string): void {
    assertRoomActionAvailable(roomId, operation, "publish");
  }

  function assertCanReact(roomId: string, operation: string): void {
    assertRoomActionAvailable(roomId, operation, "react");
  }

  function assertRoomActionAvailable(
    roomId: string,
    operation: string,
    action: "publish" | "react",
  ): void {
    const room = workspaceRoomById(roomId);
    if (room === undefined) {
      throwOperationFailure(operation, "validation", "Room is unavailable");
    }
    const availability =
      room.permissions?.[action] ?? room.permissions?.publish;
    if (availability?.state === "denied") {
      throwOperationFailure(
        operation,
        availability.requirement === "membership" ? "membership" : "restricted",
        availability.reason ??
          "The relay has not granted permission to publish here",
      );
    }
    if (availability?.state === "unsupported") {
      throwOperationFailure(
        operation,
        "restricted",
        availability.reason ??
          `${action === "react" ? "Reacting" : "Publishing"} is not supported in this room`,
      );
    }
  }

  function validateCustomEmojiReaction(
    operation: string,
    customEmoji?: { shortcode: string; url: string },
  ): void {
    if (customEmoji === undefined) return;
    if (normalizeShortcode(customEmoji.shortcode) === "") {
      throwOperationFailure(
        operation,
        "validation",
        "Custom reactions require an emoji shortcode",
      );
    }
    let url: URL;
    try {
      url = new URL(customEmoji.url);
    } catch {
      throwOperationFailure(
        operation,
        "validation",
        "Custom reactions require a valid emoji image URL",
      );
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throwOperationFailure(
        operation,
        "validation",
        "Custom reaction images must use http:// or https://",
      );
    }
  }

  function mergeAcceptedEvents(
    scopeId: string,
    events: readonly NostrEvent[],
  ): void {
    if (events.length === 0) return;
    const current = eventsByScope[scopeId] ?? [];
    const merged = new Map(current.map((event) => [event.id, event] as const));
    let changed = false;
    for (const incoming of events) {
      if (merged.has(incoming.id)) continue;
      merged.set(incoming.id, incoming);
      changed = true;
    }
    if (!changed) return;
    eventsByScope = {
      ...eventsByScope,
      [scopeId]: [...merged.values()].toSorted(
        (left, right) =>
          left.created_at - right.created_at || left.id.localeCompare(right.id),
      ),
    };
  }

  function applyRuntimeRevision(revision: CommunityRuntimeRevision): void {
    if (
      revision.generation !== generation ||
      revision.revision < runtimeRevision
    ) {
      return;
    }
    runtimeRevision = revision.revision;
    for (const [scopeId, acceptedEvents] of Object.entries(
      revision.acceptedEventsByScope ?? {},
    )) {
      mergeAcceptedEvents(scopeId, acceptedEvents);
    }
    reconcileAcceptedEventOperations();
    cache = {
      ...revision.cache,
      ...(status === "connected" && contentSync.phase === "complete"
        ? { freshness: "current" as const }
        : {}),
    };
  }

  async function refreshProjection(currentGeneration: number): Promise<void> {
    const revision = await eventRuntime.project({
      generation: currentGeneration,
      scopes: scopes.map(runtimeScope),
      activeCommunityId,
      activeRoomId,
      ...(activeTopicId === undefined ? {} : { activeTopicId }),
      ...(activeThreadId === undefined ? {} : { activeThreadId }),
      ...(identityPubkey === "" ? {} : { identityPubkey }),
      privateEventsByScope: Object.fromEntries(
        Object.entries(privateEventsByScope).map(([scopeId, events]) => [
          scopeId,
          events.map(copyPrivateEvent),
        ]),
      ),
      directParticipantsByRoom: Object.fromEntries(
        Object.entries(directParticipantsByRoom).map(
          ([roomId, participants]) => [roomId, [...participants]],
        ),
      ),
      sidePanel,
      asOf: now(),
    });
    if (
      revision.generation !== generation ||
      revision.generation !== currentGeneration ||
      revision.revision < runtimeRevision
    ) {
      return;
    }
    runtimeRevision = revision.revision;
    if (revision.workspace !== undefined) {
      workspace = revision.workspace;
      reconcileAcceptedMembershipOperations();
    }
    inbox = revision.inbox;
    if (revision.settings !== undefined) settings = revision.settings;
  }

  function requestProjection(): void {
    const requestedGeneration = generation;
    void refreshProjection(requestedGeneration).catch((cause: unknown) => {
      if (generation !== requestedGeneration) return;
      error =
        cause instanceof Error ? cause.message : "Community projection failed";
    });
  }

  function reconcileAcceptedMembershipOperations(): void {
    let next = operations;
    let changed = false;
    for (const [operation, operationState] of Object.entries(operations)) {
      if (
        !operation.startsWith("join:") ||
        operationState.status !== "accepted"
      )
        continue;
      const roomId = operation.slice("join:".length);
      if (workspaceRoomById(roomId)?.membership !== "joined") continue;
      next = { ...next, [operation]: { status: "idle" } };
      changed = true;
    }
    if (changed) operations = next;
  }

  function reconcileAcceptedEventOperations(): void {
    const eventIds = new Set(activeEvents().map((event) => event.id));
    let next = operations;
    let changed = false;
    for (const [operation, acceptedIds] of acceptedEventIdsByOperation) {
      if (!acceptedIds.every((eventId) => eventIds.has(eventId))) continue;
      acceptedEventIdsByOperation.delete(operation);
      next = { ...next, [operation]: { status: "idle" } };
      changed = true;
    }
    if (changed) operations = next;
  }

  async function cacheSnapshot(
    scope: CommunityScope,
    snapshot: CommunitySnapshot,
    pendingEvents: readonly NostrEvent[],
    currentGeneration: number,
  ): Promise<void> {
    const publicEvents = persistentPublicEvents(scope, [
      ...snapshot.events,
      ...pendingEvents,
    ]);
    const revision = await eventRuntime.ingest({
      generation: currentGeneration,
      scope: runtimeScope(scope),
      relayUrl: scope.relayUrl,
      events: publicEvents,
      ...(snapshot.checkpoints === undefined
        ? {}
        : { checkpoints: snapshot.checkpoints }),
    });
    if (revision !== undefined && generation === currentGeneration) {
      applyRuntimeRevision(revision);
    }
    const publicIds = new Set(publicEvents.map((event) => event.id));
    const memoryOnlyEvents = [...snapshot.events, ...pendingEvents].filter(
      (event) => event.kind !== 1_059 && !publicIds.has(event.id),
    );
    if (memoryOnlyEvents.length > 0) {
      const privateRevision = await eventRuntime.ingest({
        generation: currentGeneration,
        scope: runtimeScope(scope),
        relayUrl: scope.relayUrl,
        events: memoryOnlyEvents,
        persist: false,
      });
      if (privateRevision !== undefined && generation === currentGeneration) {
        applyRuntimeRevision(privateRevision);
      }
    }
    if (identityPubkey === "") {
      await refreshProjection(currentGeneration);
      return;
    }
    const wraps = [
      ...(snapshot.encryptedEvents ?? []),
      ...pendingEvents.filter((event) => event.kind === 1_059),
    ];
    if (wraps.length > 0) {
      const wrapRevision = await eventRuntime.ingest({
        generation: currentGeneration,
        scope: runtimeScope(scope),
        relayUrl: scope.relayUrl,
        events: wraps,
        audience: { type: "inbox", pubkey: identityPubkey },
      });
      if (wrapRevision !== undefined && generation === currentGeneration) {
        applyRuntimeRevision(wrapRevision);
      }
    }
    await refreshProjection(currentGeneration);
  }

  async function cacheLiveEvents(
    scopeId: string,
    events: readonly NostrEvent[],
    currentGeneration: number,
  ): Promise<void> {
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    if (scope === undefined || generation !== currentGeneration) return;
    try {
      await cacheSnapshot(
        scope,
        {
          events,
          capabilities: capabilitiesByScope[scopeId] ?? NO_CAPABILITIES,
        },
        [],
        currentGeneration,
      );
    } catch (cause) {
      cache = {
        ...cache,
        degradedReason:
          cause instanceof Error ? cause.message : "Local cache write failed",
      };
    }
  }

  function queueLiveEvents(
    scopeId: string,
    events: readonly NostrEvent[],
    currentGeneration: number,
  ): void {
    if (events.length === 0) return;
    const queued = queuedEvents.get(scopeId) ?? [];
    queued.push(...events);
    queuedEvents.set(scopeId, queued);
    queuedEventGenerations.set(scopeId, currentGeneration);
    if (scheduledEventScopes.has(scopeId) || queued.length >= 100) {
      if (queued.length >= 100) flushQueuedEvents(scopeId);
      return;
    }
    scheduleQueuedEventFlush(scopeId);
  }

  function flushQueuedEvents(scopeId: string): void {
    scheduledEventScopes.delete(scopeId);
    const queued = queuedEvents.get(scopeId);
    const queuedGeneration = queuedEventGenerations.get(scopeId);
    if (
      queued === undefined ||
      queued.length === 0 ||
      queuedGeneration !== generation
    ) {
      queuedEvents.delete(scopeId);
      queuedEventGenerations.delete(scopeId);
      return;
    }
    const batch = queued.splice(0, 100);
    if (queued.length === 0) {
      queuedEvents.delete(scopeId);
      queuedEventGenerations.delete(scopeId);
    } else {
      scheduleQueuedEventFlush(scopeId);
    }
    void cacheLiveEvents(scopeId, batch, queuedGeneration);
  }

  function scheduleQueuedEventFlush(scopeId: string): void {
    if (scheduledEventScopes.has(scopeId)) return;
    scheduledEventScopes.add(scopeId);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => flushQueuedEvents(scopeId));
      return;
    }
    queueMicrotask(() => flushQueuedEvents(scopeId));
  }

  function mergePrivateEvents(
    scopeId: string,
    events: readonly CommunityPrivateEvent[],
    replace = false,
  ): void {
    const merged = new Map(
      (replace ? [] : (privateEventsByScope[scopeId] ?? [])).map(
        (event) => [event.id, event] as const,
      ),
    );
    for (const event of events) merged.set(event.id, event);
    privateEventsByScope = {
      ...privateEventsByScope,
      [scopeId]: [...merged.values()].toSorted(
        (left, right) =>
          left.created_at - right.created_at || left.id.localeCompare(right.id),
      ),
    };
  }

  function activeScope(): CommunityScope {
    return scopes.find((scope) => scope.id === activeCommunityId) ?? scopes[0]!;
  }

  function activeRoomScope() {
    return communityRooms(activeScope(), activeEvents()).find(
      (room) => room.id === activeRoomId,
    );
  }

  function activeRoomModel() {
    return workspace.navigationSections
      .flatMap((section) => section.rooms)
      .find((room) => room.id === activeRoomId);
  }

  function roomById(roomId: string) {
    return communityRooms(activeScope(), activeEvents()).find(
      (room) => room.id === roomId || room.groupId === roomId,
    );
  }

  function workspaceRoomById(roomId: string): CommunityRoomModel | undefined {
    return workspace.navigationSections
      .flatMap((section) => section.rooms)
      .find((room) => room.id === roomId);
  }

  function resolveSearchResultRooms(
    results: readonly CommunitySearchResult[],
  ): CommunitySearchResult[] {
    const rooms = communityRooms(activeScope(), activeEvents());
    return results
      .filter((result) => !isRegistryControlEvent(result.event))
      .map((result) => {
        const groupId = result.event.tags.find((tag) => tag[0] === "h")?.[1];
        const room = rooms.find((candidate) => candidate.groupId === groupId);
        return room === undefined ? result : { ...result, roomId: room.id };
      });
  }

  function activeEvents(): readonly NostrEvent[] {
    return eventsByScope[activeCommunityId] ?? [];
  }

  function activePrivateEvents(): readonly CommunityPrivateEvent[] {
    return privateEventsByScope[activeCommunityId] ?? [];
  }

  function currentDirectRecipients(): string[] {
    return [
      ...new Set(
        directParticipantsByRoom[activeRoomId] ??
          workspace.members.map((member) => member.id),
      ),
    ].filter((pubkey) => pubkey !== identityPubkey);
  }

  async function ensureIdentity(operation: string): Promise<void> {
    if (identity !== undefined && identityPubkey !== "") return;
    try {
      await actions.connectIdentity();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Connect an identity to continue";
      const failure: CommunityOperationFailure = {
        category: "authentication",
        message,
        retryable: false,
      };
      retries.delete(operation);
      operations = {
        ...operations,
        [operation]: { status: "failed", message, failure },
      };
      throw cause;
    }
  }

  function latestAuthoredEvent(kind: number): NostrEvent | undefined {
    return activeEvents()
      .filter((event) => event.kind === kind && event.pubkey === identityPubkey)
      .toSorted(
        (left, right) =>
          right.created_at - left.created_at || right.id.localeCompare(left.id),
      )[0];
  }

  function nextAuthoredTimestamp(kind: number): number {
    return Math.max(now(), (latestAuthoredEvent(kind)?.created_at ?? 0) + 1);
  }

  function ownedEmojiMap(): Map<string, string> {
    const event = activeEvents()
      .filter(
        (candidate) =>
          candidate.kind === 30_030 && candidate.pubkey === identityPubkey,
      )
      .toSorted(
        (left, right) =>
          right.created_at - left.created_at || right.id.localeCompare(left.id),
      )[0];
    const emojis = new Map<string, string>();
    for (const tag of event?.tags ?? []) {
      if (tag[0] === "emoji" && tag[1] && tag[2]) {
        emojis.set(normalizeShortcode(tag[1]), tag[2]);
      }
    }
    return emojis;
  }

  async function publishEmojiSet(
    emojis: ReadonlyMap<string, string>,
    operation: string,
  ): Promise<void> {
    await publishTemplate(operation, {
      kind: 30_030,
      created_at: nextAuthoredTimestamp(30_030),
      content: "",
      tags: [
        ["d", "emojis"],
        ...[...emojis.entries()]
          .toSorted(([left], [right]) => left.localeCompare(right))
          .map(([shortcode, url]) => ["emoji", shortcode, url]),
      ],
    });
  }

  async function persistSelection(scopeId: string): Promise<void> {
    await updateStoredState(scopeId, (stored) => {
      stored.preferences.activeRoomId = {
        value: activeRoomId,
        updatedAt: now(),
        clientId,
      };
    });
  }

  function preferenceValue(value: unknown) {
    return {
      value: value as CommunityStoredState["preferences"][string]["value"],
      updatedAt: now(),
      clientId,
    };
  }

  async function setNavigationList(
    key:
      | "starredRoomIds"
      | "mutedRoomIds"
      | "hiddenRoomIds"
      | "forcedUnreadRoomIds",
    roomId: string,
    selected: boolean,
  ): Promise<void> {
    const values = new Set(navigation[key]);
    if (selected) values.add(roomId);
    else values.delete(roomId);
    await persistNavigation({
      ...navigation,
      [key]: [...values].toSorted(),
    });
  }

  async function persistNavigation(
    next: CommunityControllerState["navigation"],
  ): Promise<void> {
    navigation = next;
    await updateStoredState(activeCommunityId, (stored) => {
      stored.preferences.starredRoomIds = preferenceValue(next.starredRoomIds);
      stored.preferences.mutedRoomIds = preferenceValue(next.mutedRoomIds);
      stored.preferences.hiddenRoomIds = preferenceValue(next.hiddenRoomIds);
      stored.preferences.forcedUnreadRoomIds = preferenceValue(
        next.forcedUnreadRoomIds,
      );
      stored.preferences.navigationSections = preferenceValue(next.sections);
    });
  }

  async function updateStoredState(
    scopeId: string,
    update: (state: CommunityStoredState) => void,
  ): Promise<void> {
    if (options.stateStore === undefined || identityPubkey === "") return;
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    if (scope === undefined) return;
    const stored =
      storedStates.get(scopeId) ?? createCommunityStoredState(clientId, now());
    update(stored);
    stored.updatedAt = now();
    storedStates.set(scopeId, stored);
    await options.stateStore.save(stateScope(scope), stored);
  }

  function applyStoredState(
    scope: CommunityScope,
    stored: CommunityStoredState,
    restoreSelection: boolean,
  ): void {
    storedStates.set(scope.id, stored);
    navigation = navigationFromStoredState(stored);
    if (!restoreSelection || scope.id !== activeCommunityId) return;
    const selected = stored.preferences.activeRoomId?.value;
    if (
      typeof selected === "string" &&
      (communityRooms(scope, eventsByScope[scope.id] ?? []).some(
        (room) => room.id === selected,
      ) ||
        selected.startsWith("dm:"))
    ) {
      activeRoomId = selected;
    }
  }

  function stateScope(scope: CommunityScope): CommunityStateScope {
    return {
      communityId: scope.id,
      relayUrl: scope.relayUrl,
      pubkey: identityPubkey,
    };
  }

  const controller: CommunityController = {
    get state() {
      return state;
    },
    handlers,
    actions,
    initialize,
    dispose,
    reconnect,
    refresh,
    retry,
    dismissOperation,
  };
  registerCommunityControllerIdentityReader(controller, () => identity);
  return controller;
}

class CommunityActionFailure extends Error {
  readonly failure: CommunityOperationFailure;

  constructor(
    category: CommunityOperationFailure["category"],
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "CommunityActionFailure";
    this.failure = { category, message, retryable };
  }
}

export function normalizeCommunityOperationFailure(
  cause: unknown,
): CommunityOperationFailure {
  if (cause instanceof CommunityActionFailure) return cause.failure;
  const message =
    cause instanceof Error ? cause.message : "Community action failed";
  if (/recipients?.+not advertised.+(?:inbox )?relay/iu.test(message)) {
    return {
      category: "validation",
      message,
      relayReason: message,
      retryable: false,
    };
  }
  const relayMatch = message.match(
    /(?:^|\s)(invalid|restricted|blocked|rate-limited|pow|mute|error):\s*(.*)$/iu,
  );
  if (relayMatch !== null) {
    const prefix = relayMatch[1]!.toLocaleLowerCase();
    const category = prefix === "error" ? "relay" : prefix;
    return {
      category: category as CommunityOperationFailure["category"],
      message,
      relayReason: message,
      retryable: prefix === "rate-limited" || prefix === "error",
    };
  }
  if (/timed?\s*out|timeout/iu.test(message)) {
    return {
      category: "timeout",
      message,
      relayReason: message,
      retryable: true,
    };
  }
  if (
    /disconnect|network|socket|connection|reconnect|failed to fetch/iu.test(
      message,
    )
  ) {
    return {
      category: "network",
      message,
      relayReason: message,
      retryable: true,
    };
  }
  if (/identity|sign[ -]?in|authentication|nip-07|nip-42/iu.test(message)) {
    return { category: "authentication", message, retryable: false };
  }
  if (/member|join|permission|writer|administrator/iu.test(message)) {
    return {
      category: "membership",
      message,
      relayReason: message,
      retryable: false,
    };
  }
  return { category: "relay", message, relayReason: message, retryable: true };
}

function createGroupId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `community-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function validateRoomUpdate(
  update: CommunityRoomUpdate,
  capabilities: CommunityCapabilities,
): void {
  if (update.name.trim() === "") throw new Error("Room name is required");
  if (
    update.lifecycle === "temporary" &&
    capabilities.configurableRetention !== true
  ) {
    throw new Error(
      "This relay does not advertise configurable group retention",
    );
  }
}

function eventDeleted(events: readonly NostrEvent[], eventId: string): boolean {
  return events.some(
    (event) =>
      (event.kind === 5 || event.kind === 9_005) &&
      event.tags.some((tag) => tag[0] === "e" && tag[1] === eventId),
  );
}

function privateEventDeleted(
  events: readonly CommunityPrivateEvent[],
  eventId: string,
): boolean {
  return events.some(
    (event) =>
      event.kind === 5 &&
      event.tags.some((tag) => tag[0] === "e" && tag[1] === eventId),
  );
}

function rootMessageId(events: readonly NostrEvent[], eventId: string): string {
  const event = events.find((candidate) => candidate.id === eventId);
  return (
    event?.tags.find(
      (tag) => (tag[0] === "e" && tag[3] === "root") || tag[0] === "E",
    )?.[1] ?? eventId
  );
}

function memberFromEvent(event: NostrEvent): CommunityMemberModel {
  const content = parseJsonObject(event.kind === 0 ? event.content : undefined);
  const name =
    (typeof content.display_name === "string" && content.display_name.trim()) ||
    (typeof content.name === "string" && content.name.trim()) ||
    event.pubkey.slice(0, 12);
  const picture =
    typeof content.picture === "string" && content.picture.trim() !== ""
      ? content.picture.trim()
      : undefined;
  return {
    id: event.pubkey,
    name,
    handle: event.pubkey.slice(0, 12),
    initials: name.slice(0, 2).toUpperCase(),
    ...(picture === undefined ? {} : { avatarUrl: picture }),
    presence: "offline",
  };
}

function distinctMembers(
  members: readonly CommunityMemberModel[],
): CommunityMemberModel[] {
  return [
    ...new Map(members.map((member) => [member.id, member])).values(),
  ].toSorted((left, right) => left.name.localeCompare(right.name));
}

function distinctSearchResults(
  results: readonly CommunitySearchResult[],
): CommunitySearchResult[] {
  return [
    ...new Map(results.map((result) => [result.event.id, result])).values(),
  ];
}

function parsePublicKey(value: string): string | undefined {
  const normalized = value.trim();
  if (/^[0-9a-f]{64}$/iu.test(normalized)) return normalized.toLowerCase();
  if (!normalized.startsWith("npub1")) return undefined;
  try {
    const decoded = nip19.decode(normalized);
    return decoded.type === "npub" && typeof decoded.data === "string"
      ? decoded.data
      : undefined;
  } catch {
    return undefined;
  }
}

function persistentPublicEvents(
  scope: CommunityScope,
  events: readonly NostrEvent[],
): NostrEvent[] {
  const allEvents = events;
  const privateGroups = new Set(
    (scope.rooms ?? [])
      .filter((room) => room.private)
      .map((room) => room.groupId),
  );
  for (const event of allEvents) {
    if (event.kind !== 39_000) continue;
    if (
      !event.tags.some((tag) => tag[0] === "private" || tag[0] === "hidden")
    ) {
      continue;
    }
    const groupId = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (groupId !== undefined) privateGroups.add(groupId);
  }
  const privateEventIds = new Set<string>();
  for (const event of allEvents) {
    const groupId = event.tags.find(
      (tag) => tag[0] === "h" || tag[0] === "d",
    )?.[1];
    if (groupId !== undefined && privateGroups.has(groupId)) {
      privateEventIds.add(event.id);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const event of allEvents) {
      if (privateEventIds.has(event.id)) continue;
      if (
        event.tags.some(
          (tag) =>
            (tag[0] === "e" || tag[0] === "E") &&
            tag[1] !== undefined &&
            privateEventIds.has(tag[1]),
        )
      ) {
        privateEventIds.add(event.id);
        changed = true;
      }
    }
  }
  return allEvents.filter(
    (event) => event.kind !== 1_059 && !privateEventIds.has(event.id),
  );
}

function runtimeScope(scope: CommunityScope): CommunityScope {
  return {
    id: scope.id,
    name: scope.name,
    relayUrl: scope.relayUrl,
    ...(scope.groupId === undefined ? {} : { groupId: scope.groupId }),
    ...(scope.discoverPublicRooms === undefined
      ? {}
      : { discoverPublicRooms: scope.discoverPublicRooms }),
    ...(scope.readRelayUrls === undefined
      ? {}
      : { readRelayUrls: [...scope.readRelayUrls] }),
    ...(scope.rooms === undefined
      ? {}
      : {
          rooms: scope.rooms.map((room) => ({
            id: room.id,
            groupId: room.groupId,
            name: room.name,
            kind: room.kind,
            ...(room.description === undefined
              ? {}
              : { description: room.description }),
            ...(room.private === undefined ? {} : { private: room.private }),
          })),
        }),
  };
}

function copyPrivateEvent(event: CommunityPrivateEvent): CommunityPrivateEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
    wrapId: event.wrapId,
    recipientPubkey: event.recipientPubkey,
  };
}

function navigationFromStoredState(
  stored: CommunityStoredState,
): CommunityControllerState["navigation"] {
  return {
    starredRoomIds: stringArrayPreference(stored, "starredRoomIds"),
    mutedRoomIds: stringArrayPreference(stored, "mutedRoomIds"),
    hiddenRoomIds: stringArrayPreference(stored, "hiddenRoomIds"),
    forcedUnreadRoomIds: stringArrayPreference(stored, "forcedUnreadRoomIds"),
    sections: sectionPreference(stored),
  };
}

function stringArrayPreference(
  stored: CommunityStoredState,
  key: string,
): string[] {
  const value = stored.preferences[key]?.value;
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function sectionPreference(
  stored: CommunityStoredState,
): CommunityControllerState["navigation"]["sections"] {
  const value = stored.preferences.navigationSections?.value;
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      entry === null ||
      Array.isArray(entry) ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      !Array.isArray(entry.roomIds)
    ) {
      return [];
    }
    return [
      {
        id: entry.id,
        name: entry.name,
        roomIds: entry.roomIds.filter(
          (roomId): roomId is string => typeof roomId === "string",
        ),
      },
    ];
  });
}

function normalizeRelayUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error("Relay URL is required");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid relay URL");
  }
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Relay URL must use ws:// or wss://");
  }
  return url.toString();
}

function commandNeedsReconciliation(command: CommunityCommand): boolean {
  return [
    "create-room",
    "update-room",
    "delete-room",
    "join",
    "leave",
    "add-member",
    "remove-member",
    "direct-message",
  ].includes(command.type);
}

function isGroupAdmin(
  events: readonly NostrEvent[],
  groupId: string,
  pubkey: string,
): boolean {
  return (
    events
      .filter(
        (event) =>
          event.kind === 39_001 &&
          event.tags.some((tag) => tag[0] === "d" && tag[1] === groupId),
      )
      .toSorted(
        (left, right) =>
          right.created_at - left.created_at || right.id.localeCompare(left.id),
      )[0]
      ?.tags.some((tag) => tag[0] === "p" && tag[1] === pubkey) === true
  );
}

function parseJsonObject(value: string | undefined): Record<string, unknown> {
  if (value === undefined) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

function setProfileField(
  profile: Record<string, unknown>,
  field: string,
  value: string,
): void {
  const normalized = value.trim();
  if (normalized === "") delete profile[field];
  else profile[field] = normalized;
}

function isAbort(cause: unknown): boolean {
  return (
    (cause instanceof DOMException && cause.name === "AbortError") ||
    (cause instanceof Error && cause.name === "AbortError")
  );
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function createClientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
