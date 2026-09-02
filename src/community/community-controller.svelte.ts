import type {
  CommunityWorkspaceHandlers,
  CommunityWorkspaceModel,
} from "../components/index.js";
import {
  createNip29ForumCommentTemplate,
  createNip29ForumThreadTemplate,
  type NostrEvent,
  type NostrEventTemplate,
} from "../protocol/index.js";

import {
  communityRooms,
  materializeCommunityInbox,
  materializeCommunityWorkspace,
} from "./materialize.js";
import type {
  CommunityCapabilities,
  CommunityCommand,
  CommunityController,
  CommunityControllerActions,
  CommunityControllerOptions,
  CommunityControllerState,
  CommunityOperationState,
  CommunityScope,
  CommunitySearchResult,
  CommunitySession,
  CommunitySessionSubscription,
} from "./contracts.js";

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
  const scopes = [...options.scopes];
  if (scopes.length === 0) {
    throw new Error(
      "CommunityController requires at least one community scope",
    );
  }
  const now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  const sessions = new Map<string, CommunitySession>();
  const subscriptions = new Map<string, CommunitySessionSubscription>();
  const retries = new Map<string, () => Promise<void>>();
  let controllerAbort: AbortController | undefined;
  let generation = 0;

  let status = $state<CommunityControllerState["status"]>("idle");
  let eventsByScope = $state<Record<string, NostrEvent[]>>({});
  let capabilitiesByScope = $state<Record<string, CommunityCapabilities>>({});
  let operations = $state<Record<string, CommunityOperationState>>({});
  let error = $state("");
  let identityPubkey = $state("");
  let activeCommunityId = $state(
    options.initialCommunityId ?? scopes[0]?.id ?? "",
  );
  let activeRoomId = $state(
    options.initialRoomId ??
      communityRooms(
        scopes.find((scope) => scope.id === activeCommunityId) ?? scopes[0]!,
      )[0]?.id ??
      "",
  );
  let activeTopicId = $state<string | undefined>();
  let activeThreadId = $state<string | undefined>();
  let sidePanel = $state<"thread" | "details" | "none">("none");
  let searchQuery = $state("");
  let searchResults = $state<CommunitySearchResult[]>([]);

  const workspace = $derived.by(
    (): CommunityWorkspaceModel =>
      materializeCommunityWorkspace(scopes, eventsByScope, activeCommunityId, {
        activeRoomId,
        ...(activeTopicId === undefined ? {} : { activeTopicId }),
        ...(activeThreadId === undefined ? {} : { activeThreadId }),
        ...(identityPubkey === "" ? {} : { identityPubkey }),
        sidePanel,
      }),
  );
  const inbox = $derived.by(() =>
    materializeCommunityInbox(
      scopes,
      eventsByScope,
      identityPubkey || undefined,
    ),
  );
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
      workspace,
      ...(inbox === undefined ? {} : { inbox }),
      capabilities,
      operations,
      searchResults,
      searchQuery,
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
  ): Promise<void> {
    status = "connecting";
    error = "";
    try {
      identityPubkey = options.identity
        ? await options.identity.getPublicKey()
        : "";
      for (const scope of scopes) {
        signal.throwIfAborted();
        const session = await options.source.open(
          scope,
          options.identity === undefined ? {} : { identity: options.identity },
          signal,
        );
        if (generation !== currentGeneration) {
          session.close();
          return;
        }
        sessions.set(scope.id, session);
        const subscription = await session.subscribe((events) => {
          if (generation !== currentGeneration) return;
          mergeEvents(scope.id, events);
          if (events.some((event) => [9, 11, 1_111].includes(event.kind))) {
            void refreshScope(scope.id, signal).catch((cause: unknown) => {
              if (!isAbort(cause)) {
                error =
                  cause instanceof Error
                    ? cause.message
                    : "Community refresh failed";
              }
            });
          }
        }, signal);
        subscriptions.set(scope.id, subscription);
        const snapshot = await session.snapshot(signal);
        if (generation !== currentGeneration) return;
        mergeEvents(scope.id, snapshot.events);
        capabilitiesByScope = {
          ...capabilitiesByScope,
          [scope.id]: snapshot.capabilities,
        };
      }
      status = "connected";
    } catch (cause) {
      if (signal.aborted) return;
      error =
        cause instanceof Error ? cause.message : "Community connection failed";
      status = "error";
    }
  }

  function dispose(): void {
    generation += 1;
    controllerAbort?.abort(
      new DOMException("Controller disposed", "AbortError"),
    );
    controllerAbort = undefined;
    for (const subscription of subscriptions.values()) subscription.close();
    subscriptions.clear();
    for (const session of sessions.values()) session.close();
    sessions.clear();
    status = "idle";
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
    const snapshot = await session.snapshot(signal);
    mergeEvents(scopeId, snapshot.events, true);
    capabilitiesByScope = {
      ...capabilitiesByScope,
      [scopeId]: snapshot.capabilities,
    };
  }

  async function retry(operation: string): Promise<void> {
    const action = retries.get(operation);
    if (action !== undefined) await action();
  }

  const actions: CommunityControllerActions = {
    selectCommunity(communityId) {
      const scope = scopes.find((candidate) => candidate.id === communityId);
      if (scope === undefined) return;
      activeCommunityId = communityId;
      const rooms = communityRooms(scope);
      if (!rooms.some((room) => room.id === activeRoomId)) {
        activeRoomId = rooms[0]?.id ?? "";
      }
      activeTopicId = undefined;
      activeThreadId = undefined;
      sidePanel = "none";
      searchQuery = "";
      searchResults = [];
    },
    selectRoom(roomId) {
      const room = communityRooms(activeScope()).find(
        (candidate) => candidate.id === roomId,
      );
      if (room === undefined) return;
      activeRoomId = roomId;
      activeTopicId = undefined;
      activeThreadId = undefined;
      sidePanel = "none";
    },
    openTopic(topicId) {
      activeTopicId = topicId;
      activeThreadId = undefined;
      sidePanel = "none";
    },
    openThread(messageId) {
      activeThreadId = messageId;
      sidePanel = "thread";
    },
    closeSidePanel() {
      activeThreadId = undefined;
      sidePanel = "none";
    },
    openDetails() {
      activeThreadId = undefined;
      sidePanel = "details";
    },
    async sendMessage(roomId, content) {
      const room = roomById(roomId);
      if (room === undefined || content.trim() === "") return;
      await publishTemplate(`send:${roomId}`, {
        kind: 9,
        created_at: now(),
        content: content.trim(),
        tags: [["h", room.groupId]],
      });
    },
    async sendReply(rootMessageId, content) {
      const room = activeRoomScope();
      const parent = activeEvents().find((event) => event.id === rootMessageId);
      if (room === undefined || parent === undefined || content.trim() === "")
        return;
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
      await publishTemplate(`reply:${rootMessageId}`, template);
    },
    async createTopic(roomId, content) {
      const room = roomById(roomId);
      if (room?.kind !== "forum" || content.trim() === "") return;
      await publishTemplate(
        `topic:${roomId}`,
        createNip29ForumThreadTemplate(room.groupId, content.trim(), now()),
      );
    },
    async toggleReaction(eventId, emoji) {
      const target = activeEvents().find((event) => event.id === eventId);
      if (target === undefined || emoji.trim() === "") return;
      await publishTemplate(`reaction:${eventId}:${emoji}`, {
        kind: 7,
        created_at: now(),
        content: emoji,
        tags: [
          ["e", target.id],
          ["p", target.pubkey],
          ["k", target.kind.toString()],
        ],
      });
    },
    async deleteEvent(eventId) {
      const room = activeRoomScope();
      if (room === undefined) return;
      await execute(`delete:${eventId}`, {
        type: "delete",
        eventId,
        groupId: room.groupId,
      });
    },
    async search(query) {
      searchQuery = query;
      if (query.trim() === "") {
        searchResults = [];
        return;
      }
      const session = sessions.get(activeCommunityId);
      if (session === undefined) return;
      await runOperation("search", async () => {
        const result = await session.search(query, controllerAbort?.signal);
        if (searchQuery === query) searchResults = [...result];
      });
    },
    async join(groupId) {
      await execute(`join:${groupId}`, { type: "join", groupId });
    },
    async leave(groupId) {
      await execute(`leave:${groupId}`, { type: "leave", groupId });
    },
    async addMember(groupId, pubkey, roles) {
      await execute(`add-member:${groupId}:${pubkey}`, {
        type: "add-member",
        groupId,
        pubkey,
        ...(roles === undefined ? {} : { roles }),
      });
    },
    async removeMember(groupId, pubkey) {
      await execute(`remove-member:${groupId}:${pubkey}`, {
        type: "remove-member",
        groupId,
        pubkey,
      });
    },
  };

  const handlers: CommunityWorkspaceHandlers = {
    onSelectCommunity: actions.selectCommunity,
    onSelectRoom: actions.selectRoom,
    onOpenTopic: actions.openTopic,
    onOpenThread: actions.openThread,
    onCloseSidePanel: actions.closeSidePanel,
    onOpenDetails: actions.openDetails,
    onSendMessage: (roomId, content) => {
      void actions.sendMessage(roomId, content);
    },
    onSendReply: (rootMessageId, content) => {
      void actions.sendReply(rootMessageId, content);
    },
    onToggleReaction: (messageId, emoji) => {
      void actions.toggleReaction(messageId, emoji);
    },
    onAddReaction: (messageId, emoji) => {
      void actions.toggleReaction(messageId, emoji);
    },
    onSearch: (query) => {
      void actions.search(query);
    },
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
    const session = sessions.get(activeCommunityId);
    if (session === undefined) throw new Error("Community is not connected");
    await runOperation(operation, async () => {
      const events = await session.execute(command, controllerAbort?.signal);
      mergeEvents(activeCommunityId, events);
      await refreshScope(activeCommunityId, controllerAbort?.signal);
    });
  }

  async function runOperation(
    operation: string,
    action: () => Promise<void>,
  ): Promise<void> {
    retries.set(operation, async () => runOperation(operation, action));
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
      const message =
        cause instanceof Error ? cause.message : "Community action failed";
      operations = {
        ...operations,
        [operation]: { status: "failed", message },
      };
      throw cause;
    }
  }

  function mergeEvents(
    scopeId: string,
    events: readonly NostrEvent[],
    replace = false,
  ): void {
    const merged = new Map(
      (replace ? [] : (eventsByScope[scopeId] ?? [])).map(
        (event) => [event.id, event] as const,
      ),
    );
    for (const event of events) merged.set(event.id, event);
    eventsByScope = {
      ...eventsByScope,
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
    return communityRooms(activeScope()).find(
      (room) => room.id === activeRoomId,
    );
  }

  function roomById(roomId: string) {
    return communityRooms(activeScope()).find((room) => room.id === roomId);
  }

  function activeEvents(): readonly NostrEvent[] {
    return eventsByScope[activeCommunityId] ?? [];
  }

  return {
    get state() {
      return state;
    },
    handlers,
    actions,
    initialize,
    dispose,
    refresh,
    retry,
  };
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

function isAbort(cause: unknown): boolean {
  return (
    (cause instanceof DOMException && cause.name === "AbortError") ||
    (cause instanceof Error && cause.name === "AbortError")
  );
}
