import { readCachedContentWindow } from "./cached-content-window.js";
import { createHistoryScheduler } from "./history-scheduler.js";
import { historyPageKey, eventInHistoryWindow } from "./history-pages.js";
import { createProjectionQueue, shareProjection } from "./projection-state.js";
import {
  conversationKey,
  privateConversation,
  timelineReadKey,
  isTimelineRoot,
  isUnreadInConversation,
  type CommunityConversationReference,
} from "./conversations.js";
import type { CommunityInboxFilter } from "../components/community-inbox/model.js";
import type {
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
  CommunityWorkspaceHandlers,
  CommunityWorkspaceModel,
} from "../components/index.js";
import { nip19 } from "nostr-tools";
import { normalizeURL } from "nostr-tools/utils";
import type {
  CommunityPresenceState,
  CommunityPresenceSession,
} from "./presence-contracts.js";
import {
  createNip29ForumCommentTemplate,
  createNip29ForumThreadTemplate,
  type NostrEvent,
  type NostrEventTemplate,
} from "../protocol/index.js";
import { isRegistryControlEvent } from "../protocol/registry-control.js";
import {
  canvasEditingAllowed,
  canvasReadingAllowed,
  channelCanvasKey,
  latestChannelCanvas,
  type CommunityChannelCanvasModel,
} from "./channel-canvas.js";

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
  CommunityContentCursor,
  CommunityHistoryState,
  CommunityHistoryTarget,
  CommunityTimelinePresentation,
  CommunityController,
  CommunityControllerActions,
  CommunityControllerOptions,
  CommunityControllerState,
  CommunityGroupInvite,
  CommunityIdentity,
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
  buildCommunityGroupInvite,
  createCommunityInviteCode,
  normalizeInviteRelayUrl,
  parseCommunityGroupInvite,
} from "./group-invites.js";
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
import { unwrapNip17GiftWrap } from "./nip17.js";
import { registerCommunityControllerIdentityReader } from "./controller-identity-context.js";
import {
  createCommunityAgentsController,
  type CommunityAgentsController,
} from "./agent-controller.js";
import type { CommunityAgentsState } from "./agent-contracts.js";
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
  const defaultRelayUrls = new Map(
    initialScopes.map((scope) => [scope.id, scope.relayUrl]),
  );
  let scopes = $state<CommunityScope[]>(initialScopes);
  let relayUrlOverrideIds = $state<string[]>([]);
  const now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  const inviteCodeFactory =
    options.inviteCodeFactory ?? createCommunityInviteCode;
  const eventRuntime = options.runtime ?? createInlineCommunityEventRuntime();
  const clientId = options.clientId ?? createClientId();
  const sessions = new Map<string, CommunitySession>();
  const presenceSessions = new Map<string, CommunityPresenceSession>();
  let presenceByScope = $state<Record<string, CommunityPresenceState>>({});
  const subscriptions = new Map<string, CommunitySessionSubscription>();
  const retries = new Map<string, () => Promise<void>>();
  const operationVersions = new Map<string, symbol>();
  let memberSearchVersion = 0;
  let searchVersion = 0;
  const canvasReads = new Map<
    string,
    { token: symbol; promise: Promise<void> }
  >();
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
  const historyScheduler = createHistoryScheduler(2);
  const historyWindows = new Map<
    string,
    {
      window: CommunityContentWindow;
      generation: number;
      visibleLimit: number;
      visibleIds?: Set<string>;
      scopeId: string;
      request: CommunityContentWindowRequest;
    }
  >();
  let historyStates = $state<Record<string, CommunityHistoryState>>({});
  const historyIntents = new Map<string, number>();
  const notificationCandidates = new Map<string, Set<string>>();
  const notificationInitialized = new Set<string>();
  const timelinePresentations = new Map<
    string,
    CommunityTimelinePresentation
  >();
  let presentationRevision = $state(0);
  let progressiveRun = 0;
  let progressiveAbort: AbortController | undefined;
  let pulseAbort: AbortController | undefined;
  let pulseRun = 0;
  let pulseActive = false;
  let pulseNoteTimer: ReturnType<typeof setInterval> | undefined;
  let pulseReactionTimer: ReturnType<typeof setInterval> | undefined;
  let pulseEvents: NostrEvent[] = [];
  let pulsePrimaryEventIds: string[] = [];
  let agentController: CommunityAgentsController | undefined;
  let agents = $state<CommunityAgentsState | undefined>();

  let status = $state<CommunityControllerState["status"]>("idle");
  let cache = $state<CommunityControllerState["cache"]>({
    mode: "memory",
    freshness: "empty",
  });
  let eventsByScope: Record<string, NostrEvent[]> = {};
  let privateEventsByScope: Record<string, CommunityPrivateEvent[]> = {};
  let canvases = $state<Record<string, CommunityChannelCanvasModel>>({});
  let directParticipantsByRoom = $state<Record<string, readonly string[]>>({});
  let capabilitiesByScope = $state<Record<string, CommunityCapabilities>>({});
  let operations = $state<Record<string, CommunityOperationState>>({});
  let error = $state("");
  let identityPubkey = $state("");
  let identityRequest = 0;
  let identityEstablished = false;
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
  const pendingDirectCommands = new Map<
    string,
    {
      fingerprint: string;
      command: Extract<CommunityCommand, { type: "direct-message" }>;
    }
  >();
  const directCursors = new Map<string, CommunityContentCursor>();
  const directLimits = new Map<string, number>();
  const inboxCursors = new Map<string, CommunityContentCursor>();
  let inboxVisibleLimit = 50;
  let inboxHistory = $state<CommunityHistoryState>({
    key: "inbox",
    loading: false,
    hasOlder: true,
    hasNewer: false,
    complete: false,
  });
  let directHistoryByScope = $state<
    Record<
      string,
      {
        hasOlder: boolean;
        loading: boolean;
        complete?: boolean;
        gapped?: boolean;
        error?: string;
      }
    >
  >({});
  let activeInboxItemId = "";
  let inboxFilter: CommunityInboxFilter = "All";
  let inboxUnreadOnly = false;
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
      // Keep heartbeat updates from invalidating the shell's composed state.
      get presence() {
        return (
          presenceByScope[activeCommunityId] ?? {
            status: "unavailable",
            members: {},
            preference: "auto",
            pending: false,
          }
        );
      },
      status,
      cache,
      connections: scopes.map((scope) => ({
        communityId: scope.id,
        name: scope.name,
        relayUrl: scope.relayUrl,
        defaultRelayUrl: defaultRelayUrls.get(scope.id) ?? scope.relayUrl,
        relayUrlSource: relayUrlOverrideIds.includes(scope.id)
          ? "override"
          : "default",
      })),
      workspace,
      get timelinePresentation() {
        return timelinePresentationFor(
          activeCommunityId,
          activeRoomId,
          activeTopicId,
        );
      },
      get threadPresentation() {
        return activeThreadId
          ? timelinePresentationFor(
              activeCommunityId,
              activeRoomId,
              activeThreadId,
            )
          : undefined;
      },
      get inboxPresentation() {
        const selected =
          inbox?.selectedItem ??
          inbox?.items.find((item) => item.id === activeInboxItemId);
        return selected
          ? timelinePresentationFor(
              selected.scopeId ?? activeCommunityId,
              selected.roomId ?? activeRoomId,
              selected.rootEventId,
            )
          : undefined;
      },
      inboxConversationHistory: (() => {
        const selected =
          inbox?.selectedItem ??
          inbox?.items.find((item) => item.id === activeInboxItemId);
        return selected
          ? historyStates[
              historyResourceKey(
                selected.scopeId ?? activeCommunityId,
                selected.roomId ?? activeRoomId,
                selected.rootEventId,
              )
            ]
          : undefined;
      })(),
      history:
        historyStates[
          historyResourceKey(activeCommunityId, activeRoomId, activeTopicId)
        ],
      threadHistory: activeThreadId
        ? historyStates[
            historyResourceKey(activeCommunityId, activeRoomId, activeThreadId)
          ]
        : undefined,
      directHistory: directHistoryByScope[activeCommunityId] ?? {
        hasOlder: false,
        loading: false,
      },
      canvases,
      inboxHistory,
      ...(inbox === undefined ? {} : { inbox }),
      settings,
      capabilities,
      get operations() {
        return operations;
      },
      searchResults,
      searchQuery,
      authentication,
      get memberDirectory() {
        return memberDirectory;
      },
      contentSync,
      navigation,
      ...(replyTarget === undefined ? {} : { replyTarget }),
      ...(pulse === undefined ? {} : { pulse }),
      ...(agents === undefined ? {} : { agents }),
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
        const overrideIds: string[] = [];
        const configuredScopes = await Promise.all(
          scopes.map(async (scope) => {
            const configuredRelayUrl =
              await options.configurationStore!.loadRelayUrl(scope.id);
            if (configuredRelayUrl === undefined) return scope;
            overrideIds.push(scope.id);
            return {
              ...scope,
              relayUrl: normalizeRelayUrl(configuredRelayUrl),
            };
          }),
        );
        if (generation !== currentGeneration) return;
        scopes = configuredScopes;
        relayUrlOverrideIds = overrideIds;
        configurationLoaded = true;
      }
      const nextIdentityPubkey = identity ? await identity.getPublicKey() : "";
      if (generation !== currentGeneration || signal.aborted) return;
      if (identityEstablished && nextIdentityPubkey !== identityPubkey) {
        await eventRuntime.clearPrivate?.();
        if (generation !== currentGeneration || signal.aborted) return;
        eventsByScope = Object.fromEntries(
          scopes.map((scope) => [
            scope.id,
            persistentPublicEvents(scope, eventsByScope[scope.id] ?? []),
          ]),
        );
        privateEventsByScope = {};
        historyWindows.clear();
        historyIntents.clear();
        notificationCandidates.clear();
        notificationInitialized.clear();
        timelinePresentations.clear();
        presentationRevision++;
        historyStates = {};
        canvases = {};
        storedStates.clear();
        directParticipantsByRoom = {};
        directHistoryByScope = {};
        directCursors.clear();
        directLimits.clear();
        inboxCursors.clear();
        inboxVisibleLimit = 50;
        pendingDirectCommands.clear();
        activeInboxItemId = "";
        inbox = undefined;
        replyTarget = undefined;
        searchResults = [];
      }
      identityPubkey = nextIdentityPubkey;
      identityEstablished = true;
      authentication =
        identityPubkey === ""
          ? { status: "anonymous" }
          : { status: "connected", pubkey: identityPubkey };
      if (options.stateStore !== undefined && identityPubkey !== "") {
        for (const scope of scopes) {
          const stored = await options.stateStore.load(stateScope(scope));
          if (generation !== currentGeneration || signal.aborted) return;
          if (stored !== undefined) applyStoredState(scope, stored, true);
        }
      }
      if (restoreRuntime) {
        const restored = await eventRuntime.restore(
          scopes.map(runtimeScope),
          currentGeneration,
          { metadataOnly: options.source.historyPaging ?? false },
        );
        if (generation !== currentGeneration) return;
        applyRuntimeRevision(restored);
        syncPlans = restored.syncPlans ?? {};
        if (options.source.historyPaging) {
          await restoreCachedHead(
            activeCommunityId,
            activeRoomId,
            activeTopicId,
            currentGeneration,
          );
          if (
            identityPubkey &&
            identity?.nip44 &&
            eventRuntime.readCachedEvents
          ) {
            for (const scope of scopes) {
              const cached = await eventRuntime.readCachedEvents(scope, {
                audience: { type: "inbox", pubkey: identityPubkey },
                kinds: [1059],
                limit: 100,
              });
              if (generation !== currentGeneration) return;
              const decoded = await decryptPrivateEvents(
                scope.id,
                cached.events,
                currentGeneration,
              );
              mergePrivateEvents(scope.id, decoded);
            }
          }
        }
      }
      await refreshProjection(currentGeneration);
      if (generation !== currentGeneration || signal.aborted) return;
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
        const presenceRelay = normalizeURL(scope.relayUrl);
        if (session.presence && !presenceSessions.has(presenceRelay)) {
          presenceSessions.set(presenceRelay, session.presence);
          session.presence.start((presence) => {
            if (generation !== currentGeneration) return;
            presenceByScope = {
              ...presenceByScope,
              ...Object.fromEntries(
                scopes
                  .filter(
                    (candidate) =>
                      normalizeURL(candidate.relayUrl) === presenceRelay,
                  )
                  .map((candidate) => [candidate.id, presence]),
              ),
            };
          }, options.idleSeconds);
          session.presence.watch(workspace.members.map((member) => member.id));
        }
        if (scope.id === activeCommunityId) startAgents();
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
        if (generation !== currentGeneration || signal.aborted) {
          subscription.close();
          return;
        }
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
        directHistoryByScope = {
          ...directHistoryByScope,
          [scope.id]: {
            hasOlder: snapshot.hasOlderDirectMessages ?? false,
            complete:
              !snapshot.hasOlderDirectMessages &&
              !snapshot.encryptedPage?.window.coverageGaps?.length,
            gapped: Boolean(
              snapshot.encryptedPage?.window.coverageGaps?.length,
            ),
            loading: false,
          },
        };
        mergePrivateEvents(
          scope.id,
          await decryptPrivateEvents(
            scope.id,
            pendingEvents,
            currentGeneration,
          ),
        );
        capabilitiesByScope = {
          ...capabilitiesByScope,
          [scope.id]: snapshot.capabilities,
        };
        snapshotReady = true;
      }
      if (options.stateStore !== undefined && identityPubkey !== "") {
        for (const scope of scopes) {
          const stored = await options.stateStore.refresh(stateScope(scope));
          if (generation !== currentGeneration || signal.aborted) return;
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
      if (signal.aborted || generation !== currentGeneration) return;
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

  async function restoreCachedHead(
    scopeId: string,
    roomId: string,
    rootEventId: string | undefined,
    currentGeneration: number,
  ): Promise<void> {
    const scope = scopes.find((scope) => scope.id === scopeId);
    const room =
      scope &&
      communityRooms(
        scope,
        eventsByScope[scopeId] ?? [],
        identityPubkey || undefined,
      ).find((room) => room.id === roomId);
    if (!scope || !room || room.private) return;
    const request: CommunityContentWindowRequest = {
      collection: rootEventId
        ? "thread"
        : room.kind === "forum"
          ? "forum-topics"
          : "channel-roots",
      groupId: room.groupId,
      ...(rootEventId ? { rootEventId } : {}),
      limit: 50,
    };
    const key = historyPageKey(
      scope,
      { type: "public" },
      room.transport ?? "nip29",
      request,
    );
    const cached = await readCachedContentWindow(
      eventRuntime,
      scope,
      request,
      key,
      controllerAbort?.signal,
    );
    const events = cached?.window.events ?? [];
    if (generation !== currentGeneration) return;
    const revision = await eventRuntime.ingest({
      generation: currentGeneration,
      scope: runtimeScope(scope),
      relayUrl: scope.relayUrl,
      events,
      fromCache: true,
    });
    if (generation !== currentGeneration) return;
    if (revision) applyRuntimeRevision(revision);
    if (cached) {
      const resource = historyResourceKey(scopeId, roomId, rootEventId);
      const window = cached.window;
      if (!historyWindows.has(resource))
        historyWindows.set(resource, {
          window,
          scopeId,
          request,
          generation: -1,
          visibleLimit: 50,
          visibleIds: new Set([
            ...cached.window.primaryEventIds,
            ...(rootEventId ? [rootEventId] : []),
          ]),
        });
      historyStates = {
        ...historyStates,
        [resource]: {
          key: resource,
          loading: false,
          hasOlder: window.hasOlder,
          hasNewer: true,
          complete: false,
        },
      };
    }
  }

  function historyResourceKey(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
  ): string {
    return JSON.stringify([
      scopeId,
      scopes.find((scope) => scope.id === scopeId)?.relayUrl,
      identityPubkey,
      roomId,
      rootEventId ?? null,
    ]);
  }

  function timelinePresentationFor(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
  ): CommunityTimelinePresentation {
    void presentationRevision;
    const key = historyResourceKey(scopeId, roomId, rootEventId);
    let presentation = timelinePresentations.get(key);
    if (!presentation) {
      presentation = { key, draft: "" };
      timelinePresentations.set(key, presentation);
    }
    return presentation;
  }

  function historyTarget(target?: CommunityHistoryTarget) {
    return {
      scopeId: target?.scopeId ?? activeCommunityId,
      roomId: target?.roomId ?? activeRoomId,
      rootEventId: target?.rootEventId ?? activeTopicId,
    };
  }

  async function loadInteractiveRoom(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
    _signal?: AbortSignal,
    direction: "head" | "older" | "newer" = "head",
    around?: { createdAt: number; eventId: string },
  ): Promise<void> {
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    const session = sessions.get(scopeId);
    const room =
      scope &&
      communityRooms(
        scope,
        eventsByScope[scopeId] ?? [],
        identityPubkey || undefined,
      ).find((candidate) => candidate.id === roomId);
    if (
      !scope ||
      !room ||
      (!session?.loadContentWindow && !options.source.historyPaging)
    )
      return;
    const key = historyResourceKey(scopeId, roomId, rootEventId);
    const current = historyWindows.get(key);
    if (direction === "head" && current?.generation === generation) return;
    if (direction === "older" && current && !current.window.hasOlder) return;
    const currentGeneration = generation;
    const signal = controllerAbort?.signal;
    const intent =
      (historyIntents.get(key) ?? 0) + (direction === "newer" ? 1 : 0);
    historyIntents.set(key, intent);
    const group = `${generation}:${key}`;
    const requested = JSON.stringify([group, direction, around, intent]);
    return historyScheduler.run(
      requested,
      async () => {
        signal?.throwIfAborted();
        if (
          generation !== currentGeneration ||
          historyIntents.get(key) !== intent
        )
          return;
        const previous = historyWindows.get(key);
        historyStates = {
          ...historyStates,
          [key]: {
            key,
            loading: true,
            hasOlder: previous?.window.hasOlder ?? true,
            hasNewer: false,
            complete: false,
          },
        };
        const request: CommunityContentWindowRequest = {
          collection: rootEventId
            ? "thread"
            : room.kind === "forum"
              ? "forum-topics"
              : "channel-roots",
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
                eventRuntime,
                scope,
                request,
                pageKey,
                signal,
              );
          if (generation !== currentGeneration) return;
          if (cached) {
            const revision = await eventRuntime.ingest({
              generation: currentGeneration,
              scope: runtimeScope(scope),
              relayUrl: scope.relayUrl,
              events: cached.window.events,
              fromCache: true,
            });
            if (generation !== currentGeneration) return;
            if (revision) applyRuntimeRevision(revision);
            if (!previous && direction === "head")
              historyWindows.set(key, {
                window: cached.window,
                scopeId,
                request,
                generation: -1,
                visibleLimit: 50,
                visibleIds: new Set([
                  ...cached.window.primaryEventIds,
                  ...(rootEventId ? [rootEventId] : []),
                ]),
              });
            await refreshProjection(currentGeneration);
          }
          // Legacy cached rows can render immediately but cannot prove a covered
          // relay range or justify newer-only reconciliation.
          const cachedWindow = cached?.window;
          const head = cached?.covered
            ? cachedWindow?.events
                .filter((event) =>
                  cachedWindow.primaryEventIds.includes(event.id),
                )
                .toSorted(
                  (a, b) =>
                    a.created_at - b.created_at || a.id.localeCompare(b.id),
                )
                .at(-1)
            : undefined;
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
            : await session?.loadContentWindow?.(relayRequest, signal);
          if (!window)
            throw new Error(
              "This history is not cached. Reconnect to load more messages.",
            );
          if (remoteLoaded && direction === "head" && cachedWindow) {
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
              .sort(
                (a, b) =>
                  a.created_at - b.created_at || a.id.localeCompare(b.id),
              )
              .slice(-50);
            const oldest = primary[0];
            window = {
              ...(window.coverageGaps
                ? { coverageGaps: window.coverageGaps }
                : {}),
              events: [...byId.values()],
              primaryEventIds: primary.map((event) => event.id),
              hasOlder:
                window.hasOlder ||
                cachedWindow.hasOlder ||
                primaryIds.size > 50,
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
          if (generation !== currentGeneration) return;
          const coverageGaps = [
            ...new Map(
              [
                ...(previous?.window.coverageGaps ?? []),
                ...(cachedWindow?.coverageGaps ?? []),
                ...(window.coverageGaps ?? []),
              ].map((gap) => [gap.createdAt, gap]),
            ).values(),
          ];
          if (coverageGaps.length) window = { ...window, coverageGaps };
          if (remoteLoaded) {
            const revision = await eventRuntime.ingest({
              generation: currentGeneration,
              scope: runtimeScope(scope),
              relayUrl: scope.relayUrl,
              events: window.events,
              ...(room.private
                ? { persist: false }
                : {
                    historyPages: [
                      {
                        key: pageKey,
                        audience,
                        relayUrls: [
                          scope.relayUrl,
                          ...(scope.readRelayUrls ?? []),
                        ],
                        request,
                        eventIds: window.events.map((event) => event.id),
                        primaryEventIds: window.primaryEventIds,
                        ...(window.olderCursor
                          ? { olderCursor: window.olderCursor }
                          : {}),
                        hasOlder: window.hasOlder,
                        ...(window.coverageGaps
                          ? { coverageGaps: window.coverageGaps }
                          : {}),
                        synchronizedAt: now(),
                      },
                    ],
                  }),
            });
            if (generation !== currentGeneration) return;
            if (revision) applyRuntimeRevision(revision);
          }
          if (historyIntents.get(key) !== intent) return;
          if (direction !== "older") notificationInitialized.delete(key);
          const visibleIds = new Set([
            ...(direction === "older" ||
            (direction === "head" &&
              timelinePresentations.get(key)?.position?.atLatest === false)
              ? (previous?.visibleIds ?? previous?.window.primaryEventIds ?? [])
              : []),
            ...window.primaryEventIds,
            ...(rootEventId ? [rootEventId] : []),
          ]);
          historyWindows.set(key, {
            window,
            scopeId,
            request,
            visibleIds,
            generation: currentGeneration,
            visibleLimit:
              direction === "older"
                ? (previous?.visibleLimit ?? 50) + window.primaryEventIds.length
                : 50,
          });
          historyStates = {
            ...historyStates,
            [key]: {
              key,
              loading: false,
              hasOlder: window.hasOlder,
              hasNewer: !session?.loadContentWindow || Boolean(around),
              complete:
                !!session?.loadContentWindow &&
                !window.hasOlder &&
                !around &&
                !window.coverageGaps?.length,
            },
          };
          if (!rootEventId)
            updateRoomContentSync(
              roomId,
              !session?.loadContentWindow ||
                window.hasOlder ||
                window.coverageGaps?.length
                ? "partial"
                : "complete",
            );
          await refreshProjection(currentGeneration);
        } catch (cause) {
          if (
            generation !== currentGeneration ||
            historyIntents.get(key) !== intent ||
            isAbort(cause)
          )
            return;
          historyStates = {
            ...historyStates,
            [key]: {
              key,
              loading: false,
              hasOlder: true,
              hasNewer: false,
              complete: false,
              error:
                cause instanceof Error
                  ? cause.message
                  : "History could not be loaded",
            },
          };
          await refreshProjection(currentGeneration);
          throw cause;
        }
      },
      () =>
        key ===
          historyResourceKey(activeCommunityId, activeRoomId, activeTopicId) ||
        (activeThreadId !== undefined &&
          key ===
            historyResourceKey(
              activeCommunityId,
              activeRoomId,
              activeThreadId,
            )),
      group,
    );
  }

  async function runProgressiveSynchronization(
    currentGeneration: number,
    parentSignal: AbortSignal,
    priority = {
      scopeId: activeCommunityId,
      roomId: activeRoomId,
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
            : "History could not be loaded",
      };
      cache = { ...cache, freshness: "synchronizing" };
    }
  }

  function prioritizeContent(
    scopeId: string,
    roomId: string,
    rootEventId?: string,
  ): void {
    if (controllerAbort === undefined) return;
    const session = sessions.get(scopeId);
    if (session?.loadContentWindow === undefined) {
      if (options.source.historyPaging) {
        const requestedGeneration = generation;
        void restoreCachedHead(
          scopeId,
          roomId,
          rootEventId,
          requestedGeneration,
        ).then(() => refreshProjection(requestedGeneration));
      }
      return;
    }
    contentSync = { ...contentSync, phase: "background" };
    cache = { ...cache, freshness: "synchronizing" };
    void runProgressiveSynchronization(generation, controllerAbort.signal, {
      scopeId,
      roomId,
      rootEventId,
    });
  }

  function stopAgents(): void {
    agentController?.dispose();
    agentController = undefined;
    agents = undefined;
  }

  function startAgents(): void {
    stopAgents();
    const session = sessions.get(activeCommunityId)?.agents;
    if (!session || !identity || !identityPubkey) return;
    const scope = activeScope();
    const currentGeneration = generation;
    const controller = createCommunityAgentsController({
      scope: {
        communityId: scope.id,
        ownerPubkey: identityPubkey,
        relayUrls: [scope.relayUrl, ...(scope.readRelayUrls ?? [])],
      },
      identity,
      session,
      archive: eventRuntime.agentActivity,
      now,
      storageMode: () => cache.mode,
      onState: (next) => {
        if (agentController !== controller || generation !== currentGeneration)
          return;
        const identitiesChanged = agents?.agents !== next.agents;
        agents = next;
        if (identitiesChanged) updatePulseAvailability();
      },
      onDirectory: (events) => {
        if (agentController === controller && generation === currentGeneration)
          queueLiveEvents(scope.id, events, currentGeneration);
      },
    });
    agentController = controller;
    void controller.start();
  }

  function pulseAgents() {
    return (
      options.pulse?.agents ??
      (agents?.capabilities.directory ? agents.agents : undefined)
    );
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
        ...(pulseAgents() === undefined ? {} : { agents: pulseAgents()! }),
      };
      return;
    }
    pulse = {
      tab: "everyone",
      status: "idle",
      notes: [],
      agentActivities: [],
      members: [],
      ...(pulseAgents() === undefined ? {} : { agents: pulseAgents()! }),
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
                agentPubkeys: pulseAgents()?.map((agent) => agent.pubkey) ?? [],
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
        ...(pulseAgents() === undefined ? {} : { agents: pulseAgents()! }),
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
    identityRequest++;
    pulseActive = false;
    stopPulseRefreshTimers("Controller disposed");
    closeConnections("Controller disposed");
    identity?.dispose?.();
    identity = undefined;
    eventRuntime.dispose();
    canvases = {};
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
    await Promise.allSettled(
      Object.entries(canvases)
        .filter(
          ([key, canvas]) =>
            key === channelCanvasKey(activeCommunityId, canvas.roomId),
        )
        .map(([, canvas]) => actions.loadCanvas?.(canvas.roomId)),
    );
  }

  function closeConnections(reason: string): void {
    stopAgents();
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
    presenceSessions.clear();
    presenceByScope = {};
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
    const currentGeneration = generation;
    const session = sessions.get(scopeId);
    const isCurrent = () =>
      generation === currentGeneration &&
      sessions.get(scopeId) === session &&
      !signal?.aborted;
    if (session === undefined || !isCurrent()) return;
    const plan = syncPlans[scopeId] ?? {
      checkpoints: [],
      cachedEventIds: [],
    };
    const snapshot =
      session.loadContentWindow !== undefined &&
      session.synchronize !== undefined
        ? await session.synchronize({ plan, strategy: "bootstrap" }, signal)
        : await session.snapshot(signal);
    if (!isCurrent()) return;
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    if (scope !== undefined) {
      await cacheSnapshot(scope, snapshot, [], currentGeneration);
    }
    if (!isCurrent()) return;
    mergePrivateEvents(scopeId, snapshot.privateEvents ?? []);
    capabilitiesByScope = {
      ...capabilitiesByScope,
      [scopeId]: snapshot.capabilities,
    };
    if (scopeId === activeCommunityId) updatePulseAvailability();
    await refreshProjection(currentGeneration);
    if (!isCurrent()) return;
    if (
      session.loadContentWindow !== undefined &&
      controllerAbort !== undefined
    ) {
      contentSync = { ...contentSync, phase: "background" };
      cache = { ...cache, freshness: "synchronizing" };
      const requestedGeneration = currentGeneration;
      const entry = historyWindows.get(
        historyResourceKey(activeCommunityId, activeRoomId, activeTopicId),
      );
      if (entry) entry.generation = -1;
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
        ...(pulseAgents() === undefined ? {} : { agents: pulseAgents()! }),
        asOf: now(),
        canDirectMessage: capabilities.directMessages,
      }),
      status,
      ...(pulseError === undefined ? {} : { error: pulseError }),
    };
  }

  async function selectPulseTab(tab: CommunityPulseTab): Promise<void> {
    if (tab === "agents" && pulseAgents() === undefined) return;
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
    updateTimelinePresentation(key, update) {
      const current = timelinePresentations.get(key);
      // A stale component cannot recreate private drafts after an identity change.
      if (!current) return;
      const next = { ...current, ...update };
      if (
        current.draft === next.draft &&
        JSON.stringify(current.position) === JSON.stringify(next.position)
      )
        return;
      timelinePresentations.set(key, next);
      presentationRevision++;
    },
    async loadOlderHistory(target) {
      const selected = historyTarget(target);
      await loadInteractiveRoom(
        selected.scopeId,
        selected.roomId,
        selected.rootEventId,
        undefined,
        "older",
      );
    },
    async loadNewerHistory(target) {
      const selected = historyTarget(target);
      await loadInteractiveRoom(
        selected.scopeId,
        selected.roomId,
        selected.rootEventId,
        undefined,
        "newer",
      );
    },
    async loadAroundMessage(target, eventId) {
      const selected = historyTarget(target);
      const event =
        (eventsByScope[selected.scopeId] ?? []).find(
          (event) => event.id === eventId,
        ) ?? searchResults.find((result) => result.event.id === eventId)?.event;
      if (!event)
        throw new Error(
          "Message context is unavailable; retry the search or open the latest messages",
        );
      await loadInteractiveRoom(
        selected.scopeId,
        selected.roomId,
        selected.rootEventId,
        undefined,
        "newer",
        { createdAt: event.created_at, eventId },
      );
    },
    async loadDirectHistory() {
      const scopeId = activeCommunityId,
        currentGeneration = generation,
        roomId = activeRoomId;
      const scope = activeScope();
      const session = sessions.get(scopeId);
      if (!session?.loadDirectHistory || directHistoryByScope[scopeId]?.loading)
        return;
      const key = historyResourceKey(scopeId, roomId);
      const currentLimit = directLimits.get(key) ?? 50;
      const count = () =>
        (privateEventsByScope[scopeId] ?? []).filter(
          (event) =>
            event.kind === 14 &&
            directConversationId(
              privateConversation(event).participants.filter(
                (pubkey) => pubkey !== identityPubkey,
              ),
            ) === roomId,
        ).length;
      if (count() > currentLimit) {
        directLimits.set(key, currentLimit + 50);
        await refreshProjection(currentGeneration);
        return;
      }
      return historyScheduler.run(
        `mailbox:${currentGeneration}:${scopeId}`,
        async () => {
          if (generation !== currentGeneration) return;
          const previous = directHistoryByScope[scopeId];
          directHistoryByScope = {
            ...directHistoryByScope,
            [scopeId]: { ...previous, hasOlder: true, loading: true },
          };
          try {
            let hasOlder = true;
            let coverageComplete = !previous?.gapped;
            for (
              let batch = 0;
              batch < 3 && count() < currentLimit + 50 && hasOlder;
              batch++
            ) {
              const before = directCursors.get(scopeId);
              const request: CommunityContentWindowRequest = {
                collection: "room-history",
                groupId: identityPubkey,
                limit: 100,
                ...(before ? { before } : {}),
              };
              const cached = await eventRuntime.readHistoryPage?.(
                scope,
                historyPageKey(
                  scope,
                  { type: "inbox", pubkey: identityPubkey },
                  "nip17-mailbox",
                  request,
                ),
              );
              const snapshot = cached
                ? {
                    events: [],
                    encryptedEvents: cached.events,
                    privateEvents: await decryptPrivateEvents(
                      scopeId,
                      cached.events,
                      currentGeneration,
                    ),
                    capabilities:
                      capabilitiesByScope[scopeId] ?? NO_CAPABILITIES,
                    hasOlderDirectMessages: cached.page.hasOlder,
                    encryptedPage: {
                      request,
                      window: {
                        events: cached.events,
                        primaryEventIds: cached.page.primaryEventIds,
                        hasOlder: cached.page.hasOlder,
                        ...(cached.page.coverageGaps
                          ? { coverageGaps: cached.page.coverageGaps }
                          : {}),
                        ...(cached.page.olderCursor
                          ? { olderCursor: cached.page.olderCursor }
                          : {}),
                      },
                      relayUrls: cached.page.relayUrls,
                    },
                  }
                : await session.loadDirectHistory!(
                    controllerAbort?.signal,
                    before,
                  );
              if (generation !== currentGeneration) return;
              mergePrivateEvents(scopeId, snapshot.privateEvents ?? []);
              await cacheSnapshot(scope, snapshot, [], currentGeneration);
              hasOlder = snapshot.hasOlderDirectMessages ?? true;
              coverageComplete &&=
                !snapshot.encryptedPage?.window.coverageGaps?.length;
              if (batch < 2) await yieldToBrowser();
            }
            directLimits.set(key, currentLimit + 50);
            directHistoryByScope = {
              ...directHistoryByScope,
              [scopeId]: {
                hasOlder,
                complete: !hasOlder && coverageComplete,
                gapped: !coverageComplete,
                loading: false,
              },
            };
            await refreshProjection(currentGeneration);
          } catch (cause) {
            if (generation !== currentGeneration) return;
            directHistoryByScope = {
              ...directHistoryByScope,
              [scopeId]: {
                ...previous,
                hasOlder: true,
                loading: false,
                error:
                  cause instanceof Error
                    ? cause.message
                    : "Earlier messages could not be loaded",
              },
            };
            throw cause;
          }
        },
      );
    },
    async loadOlderInbox() {
      if (inboxHistory.loading) return;
      const scope = activeScope(),
        session = sessions.get(scope.id),
        currentGeneration = generation;
      if (!session?.loadInboxWindow) return;
      return historyScheduler.run(
        `inbox:${generation}:${scope.id}`,
        async () => {
          if (generation !== currentGeneration) return;
          inboxHistory = { ...inboxHistory, loading: true };
          try {
            const window = await session.loadInboxWindow!(
              inboxCursors.get(scope.id),
              50,
              controllerAbort?.signal,
            );
            if (generation !== currentGeneration) return;
            await cacheContentWindow(scope, window, currentGeneration);
            if (window.olderCursor)
              inboxCursors.set(scope.id, window.olderCursor);
            inboxVisibleLimit += 50;
            inboxHistory = {
              key: "inbox",
              loading: false,
              hasOlder: window.hasOlder,
              hasNewer: false,
              complete: !window.hasOlder,
            };
            await refreshProjection(currentGeneration);
          } catch (cause) {
            if (generation !== currentGeneration) return;
            inboxHistory = {
              ...inboxHistory,
              loading: false,
              error:
                cause instanceof Error
                  ? cause.message
                  : "Inbox history could not be loaded",
            };
            throw cause;
          }
        },
      );
    },
    async openBuzzDirectMessage(participants) {
      const scopeId = activeCommunityId;
      const currentGeneration = generation;
      await ensureIdentity("buzz-direct:open");
      const session = sessions.get(scopeId);
      if (!session?.openBuzzDirectMessage)
        throw new Error("Buzz messaging is unavailable on this relay");
      const group = await session.openBuzzDirectMessage(
        participants,
        controllerAbort?.signal,
      );
      if (generation !== currentGeneration || activeCommunityId !== scopeId)
        throw new Error("The active community changed");
      scopes = scopes.map((scope) =>
        scope.id === scopeId
          ? {
              ...scope,
              rooms: [
                ...communityRooms(
                  scope,
                  eventsByScope[scopeId] ?? [],
                  identityPubkey,
                ).filter((room) => room.id !== group.room.id),
                group.room,
              ],
            }
          : scope,
      );
      await cacheLiveEvents(scopeId, group.events, generation, false);
      activeRoomId = group.room.id;
      await refreshScope(scopeId, controllerAbort?.signal);
      await refreshProjection(generation);
      return group.room.id;
    },
    async selectInboxItem(itemId) {
      const item = inbox?.items.find((candidate) => candidate.id === itemId);
      if (!item?.roomId || !item.scopeId) return;
      activeInboxItemId = itemId;
      navigation = {
        ...navigation,
        forcedUnreadRoomIds: navigation.forcedUnreadRoomIds.filter(
          (id) => id !== item.roomId,
        ),
      };
      activeCommunityId = item.scopeId;
      activeRoomId = item.roomId;
      activeThreadId = item.rootEventId;
      activeTopicId =
        inbox?.room.kind === "forum" ? item.rootEventId : undefined;
      sidePanel = "none";
      replyTarget = undefined;
      if (item.conversation?.transport === "nip17")
        directParticipantsByRoom = {
          ...directParticipantsByRoom,
          [item.roomId]: item.conversation.participants.filter(
            (key) => key !== identityPubkey,
          ),
        };
      await updateStoredState(
        item.scopeId,
        (stored) => {
          stored.preferences.forcedUnreadRoomIds = preferenceValue(
            navigation.forcedUnreadRoomIds,
          );
        },
        false,
      );
      prioritizeContent(item.scopeId, item.roomId, item.rootEventId);
      await refreshProjection(generation);
    },
    setInboxFilter(filter, unreadOnly) {
      inboxFilter = filter;
      inboxUnreadOnly = unreadOnly;
      requestProjection();
    },
    async sendInboxMessage(content) {
      const item =
        inbox?.selectedItem ??
        inbox?.items.find((candidate) => candidate.id === inbox?.activeItemId);
      if (!item?.roomId) throw new Error("Select an Inbox conversation");
      const replyId = replyTarget?.eventId;
      await actions.selectInboxItem?.(item.id);
      if (item.conversation?.transport === "nip17")
        await actions.sendDirectMessage(
          item.conversation.participants,
          content,
          replyId,
        );
      else if (replyId || item.rootEventId)
        await actions.sendReply(replyId ?? item.rootEventId!, content);
      else await actions.sendMessage(item.roomId, content);
    },
    async loadCanvas(roomId) {
      const scope = activeScope();
      const room = roomById(roomId);
      const session = sessions.get(scope.id);
      if (!room || !session?.loadCanvas)
        throw new Error("Channel canvas is unavailable");
      const key = channelCanvasKey(scope.id, room.id);
      const requestKey = `${generation}:${key}`;
      const pending = canvasReads.get(requestKey);
      if (pending) return pending.promise;
      const token = Symbol(requestKey);
      const currentGeneration = generation;
      const isCurrent = () =>
        generation === currentGeneration &&
        canvasReads.get(requestKey)?.token === token;
      const promise = Promise.resolve().then(async () => {
        const previous = canvases[key];
        canvases = {
          ...canvases,
          [key]: {
            roomId: room.id,
            groupId: room.groupId,
            content: previous?.content ?? "",
            eventId: previous?.eventId ?? null,
            author: previous?.author ?? null,
            updatedAt: previous?.updatedAt ?? null,
            canEdit: false,
            loading: true,
          },
        };
        try {
          const group = await session.loadGroup?.(
            { groupId: room.groupId },
            controllerAbort?.signal,
          );
          const head = await session.loadCanvas!(
            room.groupId,
            controllerAbort?.signal,
          );
          if (!isCurrent()) return;
          canvases = {
            ...canvases,
            [key]: {
              roomId: room.id,
              groupId: room.groupId,
              content: head?.content ?? "",
              eventId: head?.id ?? null,
              author: head?.pubkey ?? null,
              updatedAt: head?.created_at ?? null,
              loading: false,
              canEdit: canvasEditingAllowed(
                group?.events ?? [],
                room.groupId,
                identityPubkey,
              ),
            },
          };
        } catch (cause) {
          if (!isCurrent()) return;
          canvases = {
            ...canvases,
            [key]: {
              ...canvases[key]!,
              content: room.private ? "" : canvases[key]!.content,
              loading: false,
              canEdit: false,
              error:
                cause instanceof Error
                  ? cause.message
                  : "Canvas could not be loaded",
            },
          };
          throw cause;
        }
      });
      canvasReads.set(requestKey, { token, promise });
      try {
        await promise;
      } finally {
        if (isCurrent()) canvasReads.delete(requestKey);
      }
    },
    async saveCanvas(roomId, content, expectedEventId) {
      const scope = activeScope();
      const room = roomById(roomId);
      if (!room) throw new Error("Channel is unavailable");
      const currentGeneration = generation;
      canvasReads.delete(
        `${generation}:${channelCanvasKey(scope.id, room.id)}`,
      );
      try {
        await execute(
          `canvas:save:${scope.id}:${room.id}`,
          {
            type: "save-canvas",
            groupId: room.groupId,
            content,
            expectedEventId,
          },
          scope.id,
        );
      } finally {
        if (generation === currentGeneration && activeCommunityId === scope.id)
          await actions.loadCanvas?.(room.id);
      }
    },
    async setPresencePreference(preference) {
      const scope = scopes.find(
        (candidate) => candidate.id === activeCommunityId,
      );
      const presence =
        scope && presenceSessions.get(normalizeURL(scope.relayUrl));
      if (!presence) throw new Error("Presence is unavailable on this relay");
      await presence.setPreference(preference);
    },
    agents: {
      refresh: async () => {
        await agentController?.actions.refresh();
      },
      registerAgent: async (pubkey) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`agent:register:${pubkey}`, () =>
          agentController!.actions.registerAgent(pubkey),
        );
      },
      savePersona: async (input) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`persona:save:${input.personaSlug}`, () =>
          agentController!.actions.savePersona(input),
        );
      },
      saveAgent: async (input) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`agent:save:${input.pubkey}`, () =>
          agentController!.actions.saveAgent(input),
        );
      },
      unlinkAgent: async (pubkey, fallbackName) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`agent:unlink:${pubkey}`, () =>
          agentController!.actions.unlinkAgent(pubkey, fallbackName),
        );
      },
      deletePersona: async (slug) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`persona:delete:${slug}`, () =>
          agentController!.actions.deletePersona(slug),
        );
      },
      createManagedAgent: async (input) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        let bootstrap;
        await runOperation(
          `agent:create-managed:${input.personaSlug}`,
          async () => {
            bootstrap =
              await agentController!.actions.createManagedAgent(input);
          },
        );
        return bootstrap!;
      },
      clearManagedAgentDraft: () =>
        agentController?.actions.clearManagedAgentDraft(),
      createManagedAgentReplacement: async (pubkey) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        let bootstrap;
        await runOperation(`agent:replace-controller:${pubkey}`, async () => {
          bootstrap =
            await agentController!.actions.createManagedAgentReplacement(
              pubkey,
            );
        });
        return bootstrap!;
      },
      revokeManagedAgent: async (pubkey) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`agent:revoke-controller:${pubkey}`, () =>
          agentController!.actions.revokeManagedAgent(pubkey),
        );
      },
      deleteManagedAgent: async (pubkey) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`agent:delete-managed:${pubkey}`, () =>
          agentController!.actions.deleteManagedAgent(pubkey),
        );
      },
      setFollow: async (pubkey, following) => {
        if (!agentController)
          throw new Error("Agent actions require a signed-in community");
        await runOperation(`agent:follow:${pubkey}`, () =>
          agentController!.actions.setFollow(pubkey, following),
        );
      },
      openActivity: async (pubkey, channel) => {
        if (!agentController)
          throw new Error("Agent activity requires a signed-in community");
        await agentController.actions.openActivity(pubkey, channel);
      },
      syncActivity: async (context, agentPubkeys) => {
        if (!agentController) return;
        await agentController.actions.syncActivity(context, agentPubkeys);
      },
      cancelActivitySync: () => {
        agentController?.actions.cancelActivitySync();
      },
      loadOlderActivity: async () => {
        await agentController?.actions.loadOlderActivity();
      },
      clearHistory: async (pubkey) => {
        if (!agentController)
          throw new Error("Agent history requires a signed-in community");
        await agentController.actions.clearHistory(pubkey);
      },
      cancelTurn: async (pubkey, scopeKey, channelId) => {
        if (!agentController)
          throw new Error("Agent controls require a signed-in community");
        await runOperation(`agent:cancel:${pubkey}`, () =>
          agentController!.actions.cancelTurn(pubkey, scopeKey, channelId),
        );
      },
      resetConversation: async (pubkey, scopeKey, channelId) => {
        if (!agentController)
          throw new Error("Agent controls require a signed-in community");
        await runOperation(`agent:reset:${pubkey}`, () =>
          agentController!.actions.resetConversation(
            pubkey,
            scopeKey,
            channelId,
          ),
        );
      },
      respondPermission: async (pubkey, requestId, decision, channelId) => {
        if (!agentController)
          throw new Error("Agent controls require a signed-in community");
        await runOperation(`agent:permission:${requestId}`, () =>
          agentController!.actions.respondPermission(
            pubkey,
            requestId,
            decision,
            channelId,
          ),
        );
      },
      loadProcessing: async (pubkey) => {
        if (!agentController?.actions.loadProcessing)
          throw new Error("Agent controls require a signed-in community");
        return agentController.actions.loadProcessing(pubkey);
      },
      setProcessing: async (pubkey, enabled, expectedRevision) => {
        if (!agentController?.actions.setProcessing)
          throw new Error("Agent controls require a signed-in community");
        return agentController.actions.setProcessing(
          pubkey,
          enabled,
          expectedRevision,
        );
      },
      loadRuntime: async (pubkey) => {
        if (!agentController)
          throw new Error("Agent controls require a signed-in community");
        return agentController.actions.loadRuntime(pubkey);
      },
      saveRuntime: async (pubkey, defaults) => {
        if (!agentController)
          throw new Error("Agent controls require a signed-in community");
        return agentController.actions.saveRuntime(pubkey, defaults);
      },
      loadMemories: async (pubkey, channelId, filter) => {
        if (!agentController)
          throw new Error("Agent controls require a signed-in community");
        return agentController.actions.loadMemories(pubkey, channelId, filter);
      },
      actOnMemory: async (pubkey, input) => {
        if (!agentController)
          throw new Error("Agent controls require a signed-in community");
        return agentController.actions.actOnMemory(pubkey, input);
      },
    },
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
      startAgents();
      const rooms = communityRooms(
        scope,
        eventsByScope[scope.id] ?? [],
        identityPubkey || undefined,
      );
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
      if (
        activeRoomModel()?.kind === "direct" &&
        activeRoomModel()?.conversation?.transport !== "buzz-dm"
      ) {
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
      if (peers.length > 8 || peers.some((key) => !/^[0-9a-f]{64}$/u.test(key)))
        throw new Error("Choose at most eight valid direct-message recipients");
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
      const key = JSON.stringify([
        activeCommunityId,
        identityPubkey,
        operation,
      ]);
      const fingerprint = JSON.stringify([
        peers,
        content.trim(),
        replyToEventId,
      ]);
      const pending = pendingDirectCommands.get(key);
      const command =
        pending?.fingerprint === fingerprint
          ? pending.command
          : {
              type: "direct-message" as const,
              recipients: peers,
              content: content.trim(),
              ...(replyToEventId ? { replyToEventId } : {}),
            };
      pendingDirectCommands.set(key, { fingerprint, command });
      await execute(operation, command);
      pendingDirectCommands.delete(key);
      replyTarget = undefined;
    },
    async toggleReaction(eventId, emoji, customEmoji) {
      const operation = `reaction:${eventId}:${emoji.trim() || "unknown"}`;
      validateCustomEmojiReaction(operation, customEmoji);
      if (
        activeRoomModel()?.kind === "direct" &&
        activeRoomModel()?.conversation?.transport !== "buzz-dm"
      ) {
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
      if (
        activeRoomModel()?.kind === "direct" &&
        activeRoomModel()?.conversation?.transport !== "buzz-dm"
      ) {
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
      if (
        activeRoomModel()?.kind === "direct" &&
        activeRoomModel()?.conversation?.transport !== "buzz-dm"
      ) {
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
      if (
        activeRoomModel()?.kind === "direct" &&
        activeRoomModel()?.conversation?.transport !== "buzz-dm"
      ) {
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
        const replacement = communityRooms(
          activeScope(),
          activeEvents(),
          identityPubkey || undefined,
        ).find((candidate) => candidate.groupId !== room.groupId);
        activeRoomId = replacement?.id ?? "";
        sidePanel = "none";
      }
      await refreshProjection(generation);
    },
    async search(query) {
      const version = ++searchVersion;
      const scopeId = activeCommunityId;
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
      if (
        searchVersion === version &&
        activeCommunityId === scopeId &&
        generation === requestedGeneration
      ) {
        searchResults = resolveSearchResultRooms(local);
      }
      const session = sessions.get(activeCommunityId);
      if (session === undefined) return;
      await runOperation("search", async () => {
        const result = await session.search(query, controllerAbort?.signal);
        if (
          searchVersion === version &&
          activeCommunityId === scopeId &&
          generation === requestedGeneration
        ) {
          searchResults = distinctSearchResults(
            resolveSearchResultRooms([...local, ...result]),
          );
        }
      });
    },
    async searchMembers(query) {
      const version = ++memberSearchVersion;
      const scopeId = activeCommunityId;
      const requestedGeneration = generation;
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
        if (
          version !== memberSearchVersion ||
          generation !== requestedGeneration ||
          activeCommunityId !== scopeId
        )
          return;
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
    async markRead(roomId, through) {
      const model = workspace.navigationSections
        .flatMap((section) => section.rooms)
        .find((room) => room.id === roomId);
      const room = communityRooms(
        activeScope(),
        activeEvents(),
        identityPubkey || undefined,
      ).find((candidate) => candidate.id === roomId);
      const reference = model?.conversation;
      const candidates =
        reference?.transport === "nip17"
          ? activePrivateEvents().filter(
              (event) =>
                event.kind === 14 &&
                conversationKey(privateConversation(event)) ===
                  conversationKey(reference),
            )
          : activeEvents().filter(
              (event) =>
                [9, 11, 1111].includes(event.kind) &&
                event.tags.some(
                  (tag) => tag[0] === "h" && tag[1] === room?.groupId,
                ),
            );
      const latest = candidates
        .filter(
          (event) =>
            event.pubkey !== identityPubkey &&
            (through === undefined || event.id === through.eventId) &&
            (!through?.timeline || isTimelineRoot(event)) &&
            (!through?.threadId ||
              event.id === through.threadId ||
              event.tags.some(
                (tag) =>
                  (tag[0] === "E" || tag[0] === "e") &&
                  tag[1] === through.threadId,
              )),
        )
        .toSorted(
          (left, right) =>
            right.created_at - left.created_at ||
            right.id.localeCompare(left.id),
        )[0];
      if (latest === undefined) return;
      const readReference =
        reference?.transport === "nip29" && through?.threadId
          ? { ...reference, threadId: through.threadId }
          : reference;
      const markerKey = readReference
        ? through?.timeline && reference?.transport === "nip29"
          ? timelineReadKey(reference)
          : conversationKey(readReference)
        : roomId;
      await updateStoredState(activeCommunityId, (stored) => {
        const previous = stored.readMarkers[markerKey];
        if (
          !previous ||
          latest.created_at > previous.createdAt ||
          (latest.created_at === previous.createdAt &&
            latest.id > previous.eventId)
        ) {
          stored.readMarkers[markerKey] = {
            createdAt: latest.created_at,
            eventId: latest.id,
            granularity: through?.timeline
              ? "message"
              : through?.threadId
                ? "thread"
                : "room",
          };
        }
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
      const room = workspace.navigationSections
        .flatMap((section) => section.rooms)
        .find((room) => room.id === roomId);
      for (const scopeId of room?.conversation?.transport === "nip17"
        ? scopes.map((scope) => scope.id)
        : [activeCommunityId])
        await updateStoredState(scopeId, (stored) => {
          delete stored.readMarkers[roomId];
          if (room?.conversation) {
            const roomKey = conversationKey(room.conversation);
            delete stored.readMarkers[roomKey];
            delete stored.readMarkers[timelineReadKey(room.conversation)];
            if (room.conversation.transport === "nip29") {
              const threadPrefix = `${roomKey.slice(0, -1)},`;
              for (const key of Object.keys(stored.readMarkers))
                if (key.startsWith(threadPrefix))
                  delete stored.readMarkers[key];
            }
          }
          for (const item of inbox?.items ?? [])
            if (item.scopeId === activeCommunityId && item.roomId === roomId)
              delete stored.readMarkers[item.id];
        });
      await setNavigationList("forcedUnreadRoomIds", roomId, true);
    },
    async markAllRead() {
      for (const room of workspace.navigationSections.flatMap(
        (section) => section.rooms,
      ))
        await actions.markRead(room.id);
      for (const item of inbox?.items ?? []) {
        if (
          !item.scopeId ||
          !item.latestEventId ||
          item.latestCreatedAt === undefined
        )
          continue;
        await updateStoredState(item.scopeId, (stored) => {
          stored.readMarkers[item.id] = {
            createdAt: item.latestCreatedAt!,
            eventId: item.latestEventId!,
            granularity: item.rootEventId ? "thread" : "room",
          };
        });
      }
      await refreshProjection(generation);
    },
    async setRoomStarred(roomId, starred) {
      await setNavigationList("starredRoomIds", roomId, starred);
    },
    async setRoomMuted(roomId, muted) {
      await setNavigationList("mutedRoomIds", roomId, muted);
    },
    async setRoomHidden(roomId, hidden) {
      const room = workspace.navigationSections
        .flatMap((section) => section.rooms)
        .find((room) => room.id === roomId);
      if (room?.conversation?.transport === "buzz-dm") {
        const session = sessions.get(activeCommunityId);
        if (hidden)
          await session?.hideBuzzDirectMessage?.(
            room.conversation.groupId,
            controllerAbort?.signal,
          );
        else if (room.participantIds)
          await actions.openBuzzDirectMessage?.(room.participantIds);
        await refreshScope(activeCommunityId, controllerAbort?.signal);
        return;
      }
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
    async setMemberRoles(roomId, pubkey, roles) {
      const operation = `member-roles:${roomId}:${pubkey}`;
      const room = roomById(roomId);
      const roomModel = workspaceRoomById(roomId);
      if (room === undefined || roomModel === undefined) {
        throwOperationFailure(operation, "validation", "Room is unavailable");
      }
      if (roomModel.permissions?.manageMembers.state !== "enabled") {
        throwOperationFailure(
          operation,
          "restricted",
          roomModel.permissions?.manageMembers.reason ??
            "The relay has not granted permission to manage member roles",
        );
      }
      if (
        workspace.members.find((member) => member.id === pubkey)
          ?.administrator === true
      ) {
        throwOperationFailure(
          operation,
          "restricted",
          "Relay administrators cannot be changed from Community",
        );
      }
      await execute(operation, {
        type: "add-member",
        groupId: room.groupId,
        pubkey,
        roles: normalizeMemberRoles(roles),
      });
    },
    async createGroupInvite(roomId): Promise<CommunityGroupInvite> {
      const operation = `group-invite:create:${roomId}`;
      const room = roomById(roomId);
      const roomModel = workspaceRoomById(roomId);
      if (room === undefined || roomModel === undefined) {
        throwOperationFailure(operation, "validation", "Room is unavailable");
      }
      const metadata = latestGroupEvent(activeEvents(), 39_000, room.groupId);
      const metadataContent = parseJsonObject(metadata?.content);
      const privateRoom =
        roomModel.private === true ||
        metadata?.tags.some((tag) => tag[0] === "private") === true ||
        metadataContent.private === true;
      if (!privateRoom) {
        throwOperationFailure(
          operation,
          "validation",
          "Invite links are available for private rooms",
        );
      }
      if (roomModel.permissions?.manageMembers.state !== "enabled") {
        throwOperationFailure(
          operation,
          "restricted",
          roomModel.permissions?.manageMembers.reason ??
            "The relay has not granted permission to create invites",
        );
      }
      const scope = scopes.find(
        (candidate) => candidate.id === activeCommunityId,
      );
      if (metadata === undefined || scope === undefined) {
        throwOperationFailure(
          operation,
          "validation",
          "Current relay group metadata is unavailable",
        );
      }
      const code = inviteCodeFactory().trim();
      if (code === "") {
        throwOperationFailure(
          operation,
          "validation",
          "Invite code is unavailable",
        );
      }
      await execute(operation, {
        type: "create-invite",
        groupId: room.groupId,
        code,
      });
      return buildCommunityGroupInvite({
        groupId: room.groupId,
        relayUrl: scope.relayUrl,
        relayPubkey: metadata.pubkey,
        code,
      });
    },
    async joinWithInvite(value) {
      const parsed = parseCommunityGroupInvite(value);
      const operation = `group-invite:join:${parsed.groupId}`;
      const scope = scopes.find(
        (candidate) =>
          normalizeInviteRelayUrl(candidate.relayUrl) === parsed.relayUrl,
      );
      if (scope === undefined) {
        throwOperationFailure(
          operation,
          "validation",
          "This invite does not belong to a configured Community relay",
        );
      }
      await ensureIdentity(operation);
      const session = sessions.get(scope.id);
      if (session?.loadGroup === undefined) {
        throwOperationFailure(
          operation,
          "restricted",
          "This Community source cannot load invite-only groups",
        );
      }
      let loaded: Awaited<
        ReturnType<NonNullable<CommunitySession["loadGroup"]>>
      >;
      try {
        loaded = await session.loadGroup(
          { groupId: parsed.groupId, relayPubkey: parsed.relayPubkey },
          controllerAbort?.signal,
        );
      } catch (cause) {
        throwOperationFailure(
          operation,
          "invalid",
          cause instanceof Error
            ? cause.message
            : "Invite group is unavailable",
        );
      }
      await cacheLiveEvents(scope.id, loaded.events, generation, false);
      await execute(
        operation,
        { type: "join", groupId: parsed.groupId, code: parsed.code },
        scope.id,
      );
      scopes = scopes.map((candidate) =>
        candidate.id === scope.id &&
        !(candidate.rooms ?? []).some((room) => room.groupId === parsed.groupId)
          ? { ...candidate, rooms: [...(candidate.rooms ?? []), loaded.room] }
          : candidate,
      );
      activeCommunityId = scope.id;
      activeRoomId = loaded.room.id;
      activeTopicId = undefined;
      activeThreadId = undefined;
      sidePanel = "none";
      await refreshProjection(generation);
      if (workspaceRoomById(loaded.room.id)?.membership !== "joined") {
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
        relayUrlOverrideIds = [
          ...relayUrlOverrideIds.filter((id) => id !== communityId),
          communityId,
        ];
        if (communityId === activeCommunityId) await reconnect();
      });
    },
    async resetRelayUrl(communityId) {
      const scope = scopes.find((candidate) => candidate.id === communityId);
      const defaultRelayUrl = defaultRelayUrls.get(communityId);
      if (scope === undefined || defaultRelayUrl === undefined) {
        throw new Error("Community was not found");
      }
      await runOperation(`settings:relay:${communityId}`, async () => {
        await options.configurationStore?.removeRelayUrl(communityId);
        scopes = scopes.map((candidate) =>
          candidate.id === communityId
            ? { ...candidate, relayUrl: defaultRelayUrl }
            : candidate,
        );
        relayUrlOverrideIds = relayUrlOverrideIds.filter(
          (id) => id !== communityId,
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
          canvases = {};
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
      const request = ++identityRequest;
      let pendingIdentity: CommunityIdentity | undefined;
      try {
        pendingIdentity = await connector.connect();
        if (request !== identityRequest) {
          pendingIdentity.dispose?.();
          return;
        }
        const pubkey = await pendingIdentity.getPublicKey();
        if (request !== identityRequest) {
          pendingIdentity.dispose?.();
          return;
        }
        identity?.dispose?.();
        identity = pendingIdentity;
        pendingIdentity = undefined;
        authentication = { status: "connected", pubkey };
        await reconnect(false);
      } catch (cause) {
        if (request !== identityRequest) {
          pendingIdentity?.dispose?.();
          return;
        }
        const message =
          cause instanceof Error ? cause.message : "Sign in failed";
        pendingIdentity?.dispose?.();
        identity?.dispose?.();
        identity = undefined;
        identityPubkey = "";
        authentication = { status: "error", error: message };
        throw cause;
      }
    },
    async disconnectIdentity() {
      const request = ++identityRequest;
      closeConnections("Identity disconnected");
      identity?.dispose?.();
      identity = undefined;
      identityPubkey = "";
      authentication = { status: "anonymous" };
      await eventRuntime.clearPrivate?.();
      if (request !== identityRequest) return;
      eventsByScope = Object.fromEntries(
        scopes.map((scope) => [
          scope.id,
          persistentPublicEvents(scope, eventsByScope[scope.id] ?? []),
        ]),
      );
      searchResults = [];
      privateEventsByScope = {};
      activeInboxItemId = "";
      pendingDirectCommands.clear();
      historyWindows.clear();
      historyIntents.clear();
      historyStates = {};
      notificationCandidates.clear();
      notificationInitialized.clear();
      timelinePresentations.clear();
      presentationRevision++;
      directCursors.clear();
      directLimits.clear();
      inboxCursors.clear();
      inboxVisibleLimit = 50;
      directHistoryByScope = {};
      inbox = undefined;
      storedStates.clear();
      canvases = {};
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
          communityRooms(
            activeScope(),
            activeEvents(),
            identityPubkey || undefined,
          )[0]?.id ?? "";
      }
      await reconnect(false);
    },
  };

  const handlers: CommunityWorkspaceHandlers = {
    onSelectCommunity: actions.selectCommunity,
    onSelectRoom: actions.selectRoom,
    onReadRoom: (roomId, through) => {
      void actions.markRead(roomId, through).catch(() => undefined);
    },
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
    scopeId = activeCommunityId,
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
      const session = sessions.get(scopeId);
      if (session === undefined) {
        throw new CommunityActionFailure(
          "network",
          "Community is not connected",
          true,
        );
      }
      acceptedEvents = await session.execute(command, controllerAbort?.signal);
      await cacheLiveEvents(scopeId, acceptedEvents, generation);
      if (commandNeedsReconciliation(command)) {
        await refreshScope(scopeId, controllerAbort?.signal);
      }
    });
    if (
      command.type !== "direct-message" &&
      acceptedEvents.length > 0 &&
      acceptedEvents.some(
        (event) =>
          !(eventsByScope[scopeId] ?? []).some(
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
    const version = Symbol(operation);
    const requestedGeneration = generation;
    operationVersions.set(operation, version);
    const isCurrent = () =>
      generation === requestedGeneration &&
      operationVersions.get(operation) === version;
    retries.delete(operation);
    acceptedEventIdsByOperation.delete(operation);
    operations = {
      ...operations,
      [operation]: { status: "pending" },
    };
    try {
      await action();
      if (!isCurrent()) return;
      operations = {
        ...operations,
        [operation]: { status: "idle" },
      };
      retries.delete(operation);
    } catch (cause) {
      if (!isCurrent()) return;
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
    for (const [key, canvas] of Object.entries(canvases)) {
      if (key !== channelCanvasKey(scopeId, canvas.roomId)) continue;
      const head = latestChannelCanvas(
        eventsByScope[scopeId] ?? [],
        canvas.groupId,
      );
      if (
        head &&
        (!canvas.updatedAt ||
          head.created_at > canvas.updatedAt ||
          (head.created_at === canvas.updatedAt &&
            head.id < (canvas.eventId ?? "")))
      )
        canvases = {
          ...canvases,
          [key]: {
            ...canvas,
            content: head.content,
            eventId: head.id,
            updatedAt: head.created_at,
            author: head.pubkey,
          },
        };
    }
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

  function projectTimelineNotifications(
    scopeId: string,
    room: CommunityRoomModel,
    messages: readonly CommunityMessageModel[],
    rootEventId?: string,
  ): void {
    const key = historyResourceKey(scopeId, room.id, rootEventId);
    const reference: CommunityConversationReference | undefined =
      room.conversation;
    if (!reference) return;
    const cursors = storedStates.get(scopeId)?.readMarkers ?? {};
    const conversation =
      reference.transport === "nip29" && rootEventId
        ? { ...reference, threadId: rootEventId }
        : reference;
    const candidates = notificationCandidates.get(key) ?? new Set<string>();
    const window = historyWindows.get(key);
    const history = historyStates[key];
    const sourceEvents = new Map(
      [
        ...(eventsByScope[scopeId] ?? []),
        ...(privateEventsByScope[scopeId] ?? []),
      ].map((event) => [event.id, event]),
    );
    const applicableMarkers = [
      room.id,
      conversationKey(reference),
      conversationKey(conversation),
      timelineReadKey(reference),
    ];
    if (!history?.loading && !notificationInitialized.has(key)) {
      if (applicableMarkers.some((marker) => cursors[marker])) {
        const known =
          window?.window.primaryEventIds ??
          messages.slice(-50).map((message) => message.id);
        for (const id of known) candidates.add(id);
      }
      notificationInitialized.add(key);
    }
    const visible = new Set(
      messages
        .filter((message) => !message.activity)
        .map((message) => message.id),
    );
    const unreadEventIds = [...candidates]
      .filter((id) => {
        const event = sourceEvents.get(id);
        return (
          visible.has(id) &&
          event !== undefined &&
          isUnreadInConversation(
            event,
            conversation,
            room.id,
            identityPubkey,
            cursors,
          )
        );
      })
      .sort();
    notificationCandidates.set(key, candidates);
    const direct =
      reference.transport === "nip17"
        ? directHistoryByScope[scopeId]
        : undefined;
    if (history || direct) {
      const next: CommunityHistoryState = {
        key,
        loading: direct?.loading ?? false,
        hasOlder: direct?.hasOlder ?? false,
        hasNewer: false,
        complete: direct?.complete ?? false,
        ...history,
        ...(direct
          ? {
              loading: direct.loading,
              hasOlder:
                direct.hasOlder ||
                messages.length > (directLimits.get(key) ?? 50),
              complete: direct.complete ?? false,
            }
          : {}),
        unreadEventIds,
      };
      const shared = shareProjection(history, next);
      if (shared !== undefined && shared !== history)
        historyStates = { ...historyStates, [key]: shared };
    }
  }

  const projectLatest = createProjectionQueue(async (isCurrent) => {
    const currentGeneration = generation;
    const revision = await eventRuntime.project({
      generation: currentGeneration,
      scopes: scopes.map(runtimeScope),
      activeCommunityId,
      activeRoomId,
      ...(activeTopicId === undefined ? {} : { activeTopicId }),
      ...(activeThreadId === undefined ? {} : { activeThreadId }),
      ...(identityPubkey === "" ? {} : { identityPubkey }),
      inboxSelection: {
        ...(options.source.historyPaging ||
        sessions.get(activeCommunityId)?.loadContentWindow
          ? {
              itemLimit: inboxVisibleLimit,
              messageLimit:
                directLimits.get(
                  historyResourceKey(
                    activeCommunityId,
                    activeRoomId,
                    activeThreadId ?? activeTopicId,
                  ),
                ) ??
                historyWindows.get(
                  historyResourceKey(
                    activeCommunityId,
                    activeRoomId,
                    activeThreadId ?? activeTopicId,
                  ),
                )?.visibleLimit ??
                50,
            }
          : {}),
        activeItemId: activeInboxItemId,
        filter: inboxFilter,
        unreadOnly: inboxUnreadOnly,
        readMarkersByScope: Object.fromEntries(
          [...storedStates].map(([scopeId, stored]) => [
            scopeId,
            structuredClone(stored.readMarkers),
          ]),
        ),
      },
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
      !isCurrent() ||
      revision.generation !== generation ||
      revision.generation !== currentGeneration ||
      revision.revision < runtimeRevision
    ) {
      return;
    }
    runtimeRevision = revision.revision;
    if (revision.workspace !== undefined) {
      const projected = revision.workspace;
      if (
        options.source.historyPaging ||
        sessions.get(activeCommunityId)?.loadContentWindow
      ) {
        projected.navigationSections = projected.navigationSections.map(
          (section) => ({
            ...section,
            rooms: section.rooms.map((room) => ({
              ...room,
              unreadComplete:
                room.conversation?.transport === "nip17"
                  ? (directHistoryByScope[activeCommunityId]?.complete ?? false)
                  : false,
            })),
          }),
        );
        projected.topics = projected.topics.map((topic) => {
          const thread =
            historyStates[
              historyResourceKey(activeCommunityId, activeRoomId, topic.id)
            ];
          return {
            ...topic,
            replyCountAvailable:
              thread?.complete === true || topic.replyCount > 0,
            replyCountApproximate: thread?.complete !== true,
          };
        });
      }
      const notificationRoom = projected.navigationSections
        .flatMap((section) => section.rooms)
        .find((room) => room.id === activeRoomId);
      if (notificationRoom) {
        projectTimelineNotifications(
          activeCommunityId,
          notificationRoom,
          projected.messages,
          activeTopicId,
        );
        if (projected.thread)
          projectTimelineNotifications(
            activeCommunityId,
            notificationRoom,
            projected.thread.messages,
            projected.thread.rootMessageId,
          );
      }
      if (
        options.source.historyPaging ||
        sessions.get(activeCommunityId)?.loadContentWindow
      ) {
        const limit =
          directLimits.get(
            historyResourceKey(activeCommunityId, activeRoomId),
          ) ??
          historyWindows.get(
            historyResourceKey(activeCommunityId, activeRoomId, activeTopicId),
          )?.visibleLimit ??
          50;
        const selectedWindow = historyWindows.get(
          historyResourceKey(activeCommunityId, activeRoomId, activeTopicId),
        );
        projected.messages = selectedWindow?.visibleIds
          ? projected.messages.filter((message) =>
              selectedWindow.visibleIds!.has(message.id),
            )
          : projected.messages.slice(-limit);
        projected.topics = selectedWindow?.visibleIds
          ? projected.topics.filter((topic) =>
              selectedWindow.visibleIds!.has(topic.id),
            )
          : projected.topics.slice(0, limit);
        if (projected.thread) {
          const threadLimit =
            historyWindows.get(
              historyResourceKey(
                activeCommunityId,
                activeRoomId,
                projected.thread.rootMessageId,
              ),
            )?.visibleLimit ?? 50;
          projected.thread = {
            ...projected.thread,
            messages: (() => {
              const selected = historyWindows.get(
                historyResourceKey(
                  activeCommunityId,
                  activeRoomId,
                  projected.thread!.rootMessageId,
                ),
              );
              return selected?.visibleIds
                ? projected.thread!.messages.filter((message) =>
                    selected.visibleIds!.has(message.id),
                  )
                : projected.thread!.messages.slice(-threadLimit);
            })(),
          };
        }
      }
      workspace = shareProjection(workspace, projected);
      const scope = scopes.find(
        (candidate) => candidate.id === activeCommunityId,
      );
      if (scope)
        presenceSessions
          .get(normalizeURL(scope.relayUrl))
          ?.watch(workspace.members.map((member) => member.id));
      reconcileAcceptedMembershipOperations();
    }
    if (revision.inbox) {
      if (
        options.source.historyPaging ||
        sessions.get(activeCommunityId)?.loadContentWindow
      )
        revision.inbox.unreadComplete = false;
      const selected =
        revision.inbox.selectedItem ??
        revision.inbox.items.find(
          (item) => item.id === revision.inbox!.activeItemId,
        );
      projectTimelineNotifications(
        selected?.scopeId ?? activeCommunityId,
        revision.inbox.room,
        revision.inbox.messages,
        selected?.rootEventId,
      );
    }
    if (
      revision.inbox &&
      (options.source.historyPaging ||
        sessions.get(activeCommunityId)?.loadContentWindow)
    ) {
      const selected =
        revision.inbox.selectedItem ??
        revision.inbox.items.find(
          (item) => item.id === revision.inbox!.activeItemId,
        );
      const resource = historyResourceKey(
        selected?.scopeId ?? activeCommunityId,
        selected?.roomId ?? activeRoomId,
        selected?.rootEventId,
      );
      const limit =
        directLimits.get(resource) ??
        historyWindows.get(resource)?.visibleLimit ??
        50;
      const selectedWindow = historyWindows.get(resource);
      revision.inbox.messages = selectedWindow?.visibleIds
        ? revision.inbox.messages.filter((message) =>
            selectedWindow.visibleIds!.has(message.id),
          )
        : revision.inbox.messages.slice(-limit);
      revision.inbox.items = revision.inbox.items.slice(0, inboxVisibleLimit);
    }
    inbox = shareProjection(inbox, revision.inbox);
    if (inbox) activeInboxItemId = inbox.activeItemId;
    for (const [key, canvas] of Object.entries(canvases)) {
      if (key !== channelCanvasKey(activeCommunityId, canvas.roomId)) continue;
      const allowed = canvasReadingAllowed(
        activeEvents(),
        canvas.groupId,
        identityPubkey,
      );
      const next = allowed
        ? {
            ...canvas,
            canEdit: canvasEditingAllowed(
              activeEvents(),
              canvas.groupId,
              identityPubkey,
            ),
          }
        : {
            ...canvas,
            content: "",
            eventId: null,
            author: null,
            updatedAt: null,
            canEdit: false,
            loading: false,
            error: "Canvas access is unavailable",
          };
      const shared = shareProjection(canvas, next);
      if (shared !== canvas) canvases = { ...canvases, [key]: shared };
    }
    if (revision.settings !== undefined)
      settings = shareProjection(settings, revision.settings);
  });

  async function refreshProjection(currentGeneration: number): Promise<void> {
    if (generation !== currentGeneration) return;
    await projectLatest();
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
    project = true,
  ): Promise<void> {
    if (snapshot.encryptedPage?.window.olderCursor)
      directCursors.set(scope.id, snapshot.encryptedPage.window.olderCursor);
    if (snapshot.inboxCursor) inboxCursors.set(scope.id, snapshot.inboxCursor);
    if (snapshot.hasOlderInbox !== undefined)
      inboxHistory = {
        key: "inbox",
        loading: false,
        hasOlder: snapshot.hasOlderInbox,
        hasNewer: false,
        complete: !snapshot.hasOlderInbox,
      };
    let changed = false;
    const requestedIds = new Set(
      [...snapshot.events, ...pendingEvents].map((event) => event.id),
    );
    const publicEvents = persistentPublicEvents(scope, [
      ...(eventsByScope[scope.id] ?? []),
      ...snapshot.events,
      ...pendingEvents,
    ]).filter((event) => requestedIds.has(event.id));
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
      changed = true;
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
        changed = true;
      }
    }
    if (identityPubkey === "") {
      if (changed && project) await refreshProjection(currentGeneration);
      return;
    }
    const wraps = [
      ...(snapshot.encryptedEvents ?? []),
      ...pendingEvents.filter((event) => event.kind === 1_059),
    ];
    if (
      wraps.length > 0 ||
      snapshot.encryptedPage ||
      snapshot.encryptedCheckpoints
    ) {
      const encryptedPage = snapshot.encryptedPage;
      const wrapRevision = await eventRuntime.ingest({
        generation: currentGeneration,
        scope: runtimeScope(scope),
        relayUrl: scope.relayUrl,
        events: wraps,
        audience: { type: "inbox", pubkey: identityPubkey },
        ...(snapshot.encryptedCheckpoints
          ? { checkpoints: snapshot.encryptedCheckpoints }
          : {}),
        ...(encryptedPage
          ? {
              historyPages: [
                {
                  key: historyPageKey(
                    scope,
                    { type: "inbox", pubkey: identityPubkey },
                    "nip17-mailbox",
                    encryptedPage.request,
                  ),
                  audience: { type: "inbox", pubkey: identityPubkey },
                  relayUrls: encryptedPage.relayUrls,
                  request: encryptedPage.request,
                  eventIds: encryptedPage.window.events.map(
                    (event) => event.id,
                  ),
                  primaryEventIds: encryptedPage.window.primaryEventIds,
                  ...(encryptedPage.window.olderCursor
                    ? { olderCursor: encryptedPage.window.olderCursor }
                    : {}),
                  hasOlder: encryptedPage.window.hasOlder,
                  ...(encryptedPage.window.coverageGaps
                    ? { coverageGaps: encryptedPage.window.coverageGaps }
                    : {}),
                  synchronizedAt: now(),
                },
              ],
            }
          : {}),
      });
      if (wrapRevision !== undefined && generation === currentGeneration) {
        applyRuntimeRevision(wrapRevision);
        changed = true;
      }
    }
    if (changed && project) await refreshProjection(currentGeneration);
  }

  function extendLiveWindows(
    scopeId: string,
    events: readonly NostrEvent[],
    knownBefore: ReadonlySet<string>,
  ): void {
    const acceptedIds = new Set(
      (eventsByScope[scopeId] ?? []).map((event) => event.id),
    );
    for (const [key, entry] of historyWindows) {
      if (entry.scopeId !== scopeId) continue;
      for (const event of events) {
        if (
          !acceptedIds.has(event.id) ||
          !eventInHistoryWindow(event, entry.request)
        )
          continue;
        if (!historyStates[key]?.hasNewer) entry.visibleIds?.add(event.id);
        if (
          !knownBefore.has(event.id) &&
          event.pubkey !== identityPubkey &&
          [9, 11, 1111].includes(event.kind)
        ) {
          const candidates =
            notificationCandidates.get(key) ?? new Set<string>();
          candidates.add(event.id);
          notificationCandidates.set(key, candidates);
        }
      }
    }
  }

  async function cacheLiveEvents(
    scopeId: string,
    events: readonly NostrEvent[],
    currentGeneration: number,
    live = true,
  ): Promise<void> {
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    if (scope === undefined || generation !== currentGeneration) return;
    const knownBefore = new Set(
      (eventsByScope[scopeId] ?? []).map((event) => event.id),
    );
    try {
      await cacheSnapshot(
        scope,
        {
          events,
          capabilities: capabilitiesByScope[scopeId] ?? NO_CAPABILITIES,
        },
        [],
        currentGeneration,
        false,
      );
      if (generation !== currentGeneration) return;
      if (live) extendLiveWindows(scopeId, events, knownBefore);
      const privateEvents = await decryptPrivateEvents(
        scopeId,
        events,
        currentGeneration,
      );
      if (privateEvents.length === 0) {
        await refreshProjection(currentGeneration);
        return;
      }
      for (const event of privateEvents) {
        if (
          !live ||
          event.kind !== 14 ||
          event.pubkey === identityPubkey ||
          (privateEventsByScope[scopeId] ?? []).some(
            (known) => known.id === event.id,
          )
        )
          continue;
        const roomId = directConversationId(
          privateConversation(event).participants.filter(
            (pubkey) => pubkey !== identityPubkey,
          ),
        );
        const key = historyResourceKey(scopeId, roomId);
        const candidates = notificationCandidates.get(key) ?? new Set<string>();
        candidates.add(event.id);
        notificationCandidates.set(key, candidates);
      }
      mergePrivateEvents(scopeId, privateEvents);
      await refreshProjection(currentGeneration);
    } catch (cause) {
      cache = {
        ...cache,
        degradedReason:
          cause instanceof Error ? cause.message : "Local cache write failed",
      };
    }
  }

  async function decryptPrivateEvents(
    scopeId: string,
    events: readonly NostrEvent[],
    currentGeneration: number,
  ): Promise<CommunityPrivateEvent[]> {
    const currentIdentity = identity;
    const recipientPubkey = identityPubkey;
    if (
      generation !== currentGeneration ||
      currentIdentity?.nip44 === undefined ||
      recipientPubkey === ""
    ) {
      return [];
    }
    const knownWrapIds = new Set(
      (privateEventsByScope[scopeId] ?? []).map((event) => event.wrapId),
    );
    const liveWraps = events.filter(
      (event) =>
        event.kind === 1_059 &&
        !knownWrapIds.has(event.id) &&
        event.tags.some((tag) => tag[0] === "p" && tag[1] === recipientPubkey),
    );
    const settled: PromiseSettledResult<CommunityPrivateEvent>[] = [];
    for (let offset = 0; offset < liveWraps.length; offset += 16) {
      if (generation !== currentGeneration) return [];
      settled.push(
        ...(await Promise.allSettled(
          liveWraps
            .slice(offset, offset + 16)
            .map((wrap) => unwrapNip17GiftWrap(currentIdentity, wrap)),
        )),
      );
      if (offset + 16 < liveWraps.length) await yieldToBrowser();
    }
    if (generation !== currentGeneration) return [];
    return settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
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
    return communityRooms(
      activeScope(),
      activeEvents(),
      identityPubkey || undefined,
    ).find((room) => room.id === activeRoomId);
  }

  function activeRoomModel() {
    return workspace.navigationSections
      .flatMap((section) => section.rooms)
      .find((room) => room.id === activeRoomId);
  }

  function roomById(roomId: string) {
    return communityRooms(
      activeScope(),
      activeEvents(),
      identityPubkey || undefined,
    ).find((room) => room.id === roomId || room.groupId === roomId);
  }

  function workspaceRoomById(roomId: string): CommunityRoomModel | undefined {
    return workspace.navigationSections
      .flatMap((section) => section.rooms)
      .find((room) => room.id === roomId);
  }

  function resolveSearchResultRooms(
    results: readonly CommunitySearchResult[],
  ): CommunitySearchResult[] {
    const rooms = communityRooms(
      activeScope(),
      activeEvents(),
      identityPubkey || undefined,
    );
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
    return [
      ...new Map(
        Object.values(privateEventsByScope)
          .flat()
          .map((event) => [event.id, event]),
      ).values(),
    ];
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
    await updateStoredState(
      scopeId,
      (stored) => {
        stored.preferences.activeRoomId = {
          value: activeRoomId,
          updatedAt: now(),
          clientId,
        };
      },
      false,
    );
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
    project = true,
  ): Promise<void> {
    if (identityPubkey === "") return;
    const scope = scopes.find((candidate) => candidate.id === scopeId);
    if (scope === undefined) return;
    const stored =
      storedStates.get(scopeId) ?? createCommunityStoredState(clientId, now());
    update(stored);
    stored.updatedAt = now();
    storedStates.set(scopeId, stored);
    const requestedGeneration = generation;
    await options.stateStore?.save(stateScope(scope), stored);
    if (project && generation === requestedGeneration)
      await refreshProjection(requestedGeneration);
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
      (communityRooms(
        scope,
        eventsByScope[scope.id] ?? [],
        identityPubkey || undefined,
      ).some((room) => room.id === selected) ||
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
  if (
    update.postingPolicy === "writers" &&
    capabilities.writeRestrictedRooms !== true
  ) {
    throw new Error("This relay does not advertise writer-restricted rooms");
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

function normalizeMemberRoles(roles: readonly string[]): string[] {
  return [
    ...new Set(roles.map((role) => role.trim()).filter(Boolean)),
  ].toSorted();
}

function latestGroupEvent(
  events: readonly NostrEvent[],
  kind: number,
  groupId: string,
): NostrEvent | undefined {
  return events
    .filter(
      (event) =>
        event.kind === kind &&
        event.tags.some((tag) => tag[0] === "d" && tag[1] === groupId),
    )
    .toSorted(
      (left, right) =>
        right.created_at - left.created_at || right.id.localeCompare(left.id),
    )[0];
}

function persistentPublicEvents(
  scope: CommunityScope,
  events: readonly NostrEvent[],
): NostrEvent[] {
  const allEvents = events;
  const privateGroups = new Set(
    (scope.rooms ?? [])
      .filter((room) => room.private || room.transport === "buzz-dm")
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
    (event) =>
      ![1059, 30622].includes(event.kind) && !privateEventIds.has(event.id),
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
            ...(room.transport === undefined
              ? {}
              : { transport: room.transport }),
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
