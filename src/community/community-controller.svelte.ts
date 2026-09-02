import type {
  CommunityMemberModel,
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

import {
  communityRooms,
  directConversationId,
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
  CommunityPrivateEvent,
  CommunityReplyTarget,
  CommunityRoomUpdate,
  CommunityScope,
  CommunitySearchResult,
  CommunitySession,
  CommunitySessionSubscription,
  CommunityStateScope,
  CommunityStoredState,
} from "./contracts.js";
import { createCommunityStoredState } from "./state-store.js";
import {
  materializeCommunitySettings,
  normalizeShortcode,
} from "./materialize-settings.js";
import { verifiedNostrEvent } from "./verified-events.js";

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
  const clientId = options.clientId ?? createClientId();
  const sessions = new Map<string, CommunitySession>();
  const subscriptions = new Map<string, CommunitySessionSubscription>();
  const retries = new Map<string, () => Promise<void>>();
  const queuedEvents = new Map<string, NostrEvent[]>();
  const queuedEventGenerations = new Map<string, number>();
  const scheduledEventScopes = new Set<string>();
  const storedStates = new Map<string, CommunityStoredState>();
  let controllerAbort: AbortController | undefined;
  let identity = options.identity;
  let generation = 0;
  let configurationLoaded = false;

  let status = $state<CommunityControllerState["status"]>("idle");
  let cache = $state<CommunityControllerState["cache"]>({
    mode: "memory",
    freshness: "empty",
  });
  let eventsByScope = $state<Record<string, NostrEvent[]>>({});
  let privateEventsByScope = $state<Record<string, CommunityPrivateEvent[]>>(
    {},
  );
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
  let activeCommunityId = $state(
    options.initialCommunityId ?? initialScopes[0]?.id ?? "",
  );
  let activeRoomId = $state(
    options.initialRoomId ??
      communityRooms(
        initialScopes.find((scope) => scope.id === activeCommunityId) ??
          initialScopes[0]!,
      )[0]?.id ??
      "",
  );
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
  let replyTarget = $state<CommunityReplyTarget | undefined>();
  let navigation = $state<CommunityControllerState["navigation"]>({
    starredRoomIds: [],
    mutedRoomIds: [],
    hiddenRoomIds: [],
    forcedUnreadRoomIds: [],
    sections: [],
  });

  const workspace = $derived.by(
    (): CommunityWorkspaceModel =>
      materializeCommunityWorkspace(scopes, eventsByScope, activeCommunityId, {
        asOf: now(),
        activeRoomId,
        ...(activeTopicId === undefined ? {} : { activeTopicId }),
        ...(activeThreadId === undefined ? {} : { activeThreadId }),
        ...(identityPubkey === "" ? {} : { identityPubkey }),
        privateEvents: privateEventsByScope[activeCommunityId] ?? [],
        directParticipants: directParticipantsByRoom,
        sidePanel,
      }),
  );
  const inbox = $derived.by(() =>
    materializeCommunityInbox(
      scopes,
      eventsByScope,
      identityPubkey || undefined,
      now(),
    ),
  );
  const settings = $derived.by(() =>
    materializeCommunitySettings(activeEvents(), identityPubkey),
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
      navigation,
      ...(replyTarget === undefined ? {} : { replyTarget }),
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
        const snapshot = await session.snapshot(signal);
        if (generation !== currentGeneration) return;
        mergeEvents(scope.id, [...snapshot.events, ...pendingEvents]);
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
    } catch (cause) {
      if (signal.aborted) return;
      error =
        cause instanceof Error ? cause.message : "Community connection failed";
      status = "error";
    }
  }

  function dispose(): void {
    closeConnections("Controller disposed");
    status = "idle";
  }

  async function reconnect(): Promise<void> {
    closeConnections("Controller reconnecting");
    controllerAbort = new AbortController();
    const currentGeneration = ++generation;
    await connect(currentGeneration, controllerAbort.signal);
    if (status === "error") {
      throw new Error(error || "Community connection failed");
    }
  }

  function closeConnections(reason: string): void {
    generation += 1;
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
    const snapshot = await session.snapshot(signal);
    mergeEvents(scopeId, snapshot.events, true);
    mergePrivateEvents(scopeId, snapshot.privateEvents ?? [], true);
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
      void persistSelection(scope.id);
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
      void persistSelection(activeCommunityId);
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
      replyTarget = undefined;
    },
    openDetails() {
      activeThreadId = undefined;
      sidePanel = "details";
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
      if (activeRoomModel()?.kind === "direct") {
        if (content.trim() === "") return;
        await actions.sendDirectMessage(
          currentDirectRecipients(),
          content.trim(),
          rootMessageId,
        );
        return;
      }
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
    async createTopic(roomId, draft) {
      const room = roomById(roomId);
      const content = typeof draft === "string" ? draft : draft.content;
      if (room?.kind !== "forum" || content.trim() === "") return;
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
      await publishTemplate(`topic:${roomId}`, {
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
      if (peers.length === 0 || content.trim() === "") return;
      const roomId = directConversationId(peers);
      directParticipantsByRoom = {
        ...directParticipantsByRoom,
        [roomId]: peers,
      };
      activeRoomId = roomId;
      await execute(`direct:${roomId}`, {
        type: "direct-message",
        recipients: peers,
        content: content.trim(),
        ...(replyToEventId === undefined ? {} : { replyToEventId }),
      });
      replyTarget = undefined;
    },
    async toggleReaction(eventId, emoji, customEmoji) {
      if (activeRoomModel()?.kind === "direct") {
        const target = activePrivateEvents().find(
          (event) => event.id === eventId && event.kind === 14,
        );
        if (target === undefined || emoji.trim() === "") return;
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
      if (target === undefined || room === undefined || emoji.trim() === "")
        return;
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
    async deleteEvent(eventId) {
      if (activeRoomModel()?.kind === "direct") {
        const target = activePrivateEvents().find(
          (event) => event.id === eventId && event.kind === 14,
        );
        if (target === undefined || target.pubkey !== identityPubkey) {
          throw new Error("Only your own direct messages can be deleted");
        }
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
      if (room === undefined || target === undefined) return;
      await ensureIdentity(`delete:${eventId}`);
      const owner = target.pubkey === identityPubkey;
      if (
        !owner &&
        !isGroupAdmin(activeEvents(), room.groupId, identityPubkey)
      ) {
        throw new Error(
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
    },
    async updateRoom(groupId, update) {
      validateRoomUpdate(update, capabilities);
      await execute(`room:update:${groupId}`, {
        type: "update-room",
        groupId,
        update,
      });
      sidePanel = "none";
    },
    async deleteRoom(groupId) {
      const wasActive = activeRoomScope()?.groupId === groupId;
      await execute(`room:delete:${groupId}`, {
        type: "delete-room",
        groupId,
      });
      scopes = scopes.map((scope) =>
        scope.id === activeCommunityId
          ? {
              ...scope,
              rooms: (scope.rooms ?? []).filter(
                (room) => room.groupId !== groupId,
              ),
            }
          : scope,
      );
      if (wasActive) {
        const replacement = communityRooms(activeScope(), activeEvents()).find(
          (room) => room.groupId !== groupId,
        );
        activeRoomId = replacement?.id ?? "";
        sidePanel = "none";
      }
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
      const message =
        workspace.messages.find((candidate) => candidate.id === eventId) ??
        workspace.thread?.messages.find(
          (candidate) => candidate.id === eventId,
        );
      const room = activeRoomModel();
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
      if (room.kind !== "direct") {
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
    async connectIdentity() {
      if (identity !== undefined && identityPubkey !== "") return;
      if (options.identityConnector === undefined) {
        const message = "No NIP-07 identity connector is available";
        authentication = { status: "error", error: message };
        throw new Error(message);
      }
      authentication = { status: "connecting" };
      try {
        identity = await options.identityConnector.connect();
        const pubkey = await identity.getPublicKey();
        authentication = { status: "connected", pubkey };
        await reconnect();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Sign in failed";
        identity = undefined;
        identityPubkey = "";
        authentication = { status: "error", error: message };
        throw cause;
      }
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
      settleHandler(actions.sendMessage(roomId, content));
    },
    onSendReply: (rootMessageId, content) => {
      settleHandler(actions.sendReply(rootMessageId, content));
    },
    onToggleReaction: (messageId, emoji) => {
      settleHandler(actions.toggleReaction(messageId, emoji));
    },
    onAddReaction: (messageId, emoji) => {
      settleHandler(actions.toggleReaction(messageId, emoji));
    },
    onSearch: (query) => {
      settleHandler(actions.search(query));
    },
  };

  function settleHandler(operation: Promise<void>): void {
    void operation.catch(() => undefined);
  }

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
    await ensureIdentity(operation);
    const session = sessions.get(activeCommunityId);
    if (session === undefined) throw new Error("Community is not connected");
    await runOperation(operation, async () => {
      const events = await session.execute(command, controllerAbort?.signal);
      mergeEvents(activeCommunityId, events);
      if (commandNeedsReconciliation(command)) {
        await refreshScope(activeCommunityId, controllerAbort?.signal);
      }
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
    if (events.length === 0 && !replace) return;
    const current = replace ? [] : (eventsByScope[scopeId] ?? []);
    const merged = new Map(
      current.map((event) => [event.id, event] as const),
    );
    let changed = replace && current.length > 0;
    for (const incoming of events) {
      if (!replace && merged.has(incoming.id)) continue;
      const event = verifiedNostrEvent(incoming);
      if (event === undefined) continue;
      merged.set(event.id, event);
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
    scheduledEventScopes.add(scopeId);
    queueMicrotask(() => flushQueuedEvents(scopeId));
  }

  function flushQueuedEvents(scopeId: string): void {
    scheduledEventScopes.delete(scopeId);
    const queued = queuedEvents.get(scopeId);
    queuedEvents.delete(scopeId);
    const queuedGeneration = queuedEventGenerations.get(scopeId);
    queuedEventGenerations.delete(scopeId);
    if (
      queued === undefined ||
      queued.length === 0 ||
      queuedGeneration !== generation
    ) {
      return;
    }
    mergeEvents(scopeId, queued);
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
      (room) => room.id === roomId,
    );
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
    retries.set(operation, async () => actions.connectIdentity());
    await actions.connectIdentity();
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

  return {
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
  };
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

function createClientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
