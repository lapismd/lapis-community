import {
  isBuzzDirectMetadata,
  buzzHiddenChannels,
} from "./buzz-direct-messages.js";
import {
  afterReadCursor,
  isUnreadInConversation,
  contentMentionPubkeys,
  conversationKey,
  privateConversation,
} from "./conversations.js";
import type { CommunityConversationReference } from "./conversations.js";
import type { CommunityReadCursor } from "./contracts.js";
import type {
  CommunityInboxFilter,
  CommunityInboxItemModel,
} from "../components/community-inbox/model.js";
import type {
  CommunityDetailsModel,
  CommunityInboxModel,
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityReactionModel,
  CommunityRoleDefinition,
  CommunityRoomModel,
  CommunityTopicModel,
  CommunityWorkspaceModel,
} from "../components/index.js";
import type { NostrEvent } from "../protocol/index.js";
import { isRegistryControlEvent } from "../protocol/registry-control.js";

import type {
  CommunityPrivateEvent,
  CommunityRoomScope,
  CommunityScope,
} from "./contracts.js";
import { COMMUNITY_MESSAGE_EDIT_KIND } from "./message-moderation.js";
import { isVerifiedNostrEvent } from "./verified-events.js";

export interface CommunityProjectionOptions {
  readMarkers?: Readonly<Record<string, CommunityReadCursor>>;
  asOf?: number;
  activeRoomId?: string;
  activeTopicId?: string;
  activeThreadId?: string;
  identityPubkey?: string;
  privateEvents?: readonly CommunityPrivateEvent[];
  directParticipants?: Readonly<Record<string, readonly string[]>>;
  sidePanel?: "thread" | "details" | "none";
}

interface DirectConversation {
  id: string;
  participants: readonly string[];
  events: readonly CommunityPrivateEvent[];
}

interface Profile {
  name: string;
  picture?: string;
}

const CHANNEL_ACTIVITY_KINDS = new Set([9_000, 9_001, 9_007, 9_021, 9_022]);

function compareOldest(left: NostrEvent, right: NostrEvent): number {
  return left.created_at - right.created_at || left.id.localeCompare(right.id);
}

function newer(left: NostrEvent, right: NostrEvent): boolean {
  return (
    left.created_at > right.created_at ||
    (left.created_at === right.created_at && left.id > right.id)
  );
}

export function communityRooms(
  scope: CommunityScope,
  events: readonly NostrEvent[] = [],
  identityPubkey?: string,
): readonly CommunityRoomScope[] {
  const configured =
    scope.rooms !== undefined && scope.rooms.length > 0
      ? [...scope.rooms]
      : scope.groupId === undefined || scope.groupId === ""
        ? []
        : [
            {
              id: scope.groupId,
              groupId: scope.groupId,
              name: scope.groupId,
              kind: "channel" as const,
            },
          ];
  // Calls without identity or events also inventory configured groups for relay queries.
  if (
    !scope.discoverPublicRooms &&
    events.length === 0 &&
    identityPubkey === undefined
  )
    return configured;

  const configuredGroupIds = new Set(configured.map((room) => room.groupId));
  const membershipsByGroup = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 39_002 || !isVerifiedNostrEvent(event)) continue;
    const groupId = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (groupId === undefined || groupId === "") continue;
    const current = membershipsByGroup.get(groupId);
    if (current === undefined || newer(event, current)) {
      membershipsByGroup.set(groupId, event);
    }
  }
  const metadataByGroup = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 39_000 || !isVerifiedNostrEvent(event)) continue;
    const groupId = event.tags.find((tag) => tag[0] === "d")?.[1];
    const privateRoom = event.tags.some(
      (tag) => tag[0] === "private" || tag[0] === "hidden",
    );
    const joined =
      identityPubkey !== undefined &&
      membershipsByGroup.get(groupId ?? "")?.pubkey === event.pubkey &&
      membershipsByGroup
        .get(groupId ?? "")
        ?.tags.some((tag) => tag[0] === "p" && tag[1] === identityPubkey) ===
        true;
    if (
      groupId === undefined ||
      groupId === "" ||
      configuredGroupIds.has(groupId) ||
      (privateRoom && !joined)
    ) {
      continue;
    }
    const current = metadataByGroup.get(groupId);
    if (current === undefined || newer(event, current)) {
      metadataByGroup.set(groupId, event);
    }
  }
  const discovered = [...metadataByGroup]
    .map(([groupId, metadata]): CommunityRoomScope | undefined => {
      const supportedKinds = new Set(
        metadata.tags
          .filter((tag) => tag[0] === "supported_kinds")
          .flatMap((tag) => tag.slice(1))
          .map(Number),
      );
      const buzzDirect = isBuzzDirectMetadata(metadata);
      const kind = buzzDirect
        ? "channel"
        : supportedKinds.has(11) || supportedKinds.has(1_111)
          ? "forum"
          : supportedKinds.has(9)
            ? "channel"
            : metadata.tags.find((tag) => tag[0] === "channel_type")?.[1] ===
                "forum"
              ? "forum"
              : metadata.tags.find((tag) => tag[0] === "channel_type")?.[1] ===
                  "stream"
                ? "channel"
                : undefined;
      if (kind === undefined) return undefined;
      const name =
        metadata.tags.find((tag) => tag[0] === "name")?.[1]?.trim() || groupId;
      const description = metadata.tags
        .find((tag) => tag[0] === "about")?.[1]
        ?.trim();
      const privateRoom = metadata.tags.some(
        (tag) => tag[0] === "private" || tag[0] === "hidden",
      );
      return {
        id: groupId,
        groupId,
        name,
        kind,
        ...(buzzDirect ? { transport: "buzz-dm" as const } : {}),
        ...(description ? { description } : {}),
        ...(privateRoom ? { private: true } : {}),
      };
    })
    .filter((room): room is CommunityRoomScope => room !== undefined)
    .toSorted(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name),
    );
  const visibleConfigured = configured.filter((room) => {
    const metadata = events
      .filter(
        (event) =>
          event.kind === 39000 &&
          isVerifiedNostrEvent(event) &&
          event.tags.some((tag) => tag[0] === "d" && tag[1] === room.groupId),
      )
      .toSorted(
        (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
      )[0];
    const privateRoom =
      room.private ||
      room.transport === "buzz-dm" ||
      metadata?.tags.some((tag) => tag[0] === "private" || tag[0] === "hidden");
    if (!privateRoom) return true;
    const membership = membershipsByGroup.get(room.groupId);
    return (
      !!identityPubkey &&
      !!metadata &&
      membership?.pubkey === metadata.pubkey &&
      membership.tags.some((tag) => tag[0] === "p" && tag[1] === identityPubkey)
    );
  });
  return [
    ...visibleConfigured,
    ...(scope.discoverPublicRooms ? discovered : []),
  ];
}

export function materializeCommunityWorkspace(
  scopes: readonly CommunityScope[],
  eventsByScope: Readonly<Record<string, readonly NostrEvent[]>>,
  activeCommunityId: string,
  options: CommunityProjectionOptions = {},
): CommunityWorkspaceModel {
  const scope =
    scopes.find((candidate) => candidate.id === activeCommunityId) ?? scopes[0];
  if (scope === undefined) return emptyWorkspace();
  const events = acceptedEvents(eventsByScope[scope.id] ?? []);
  const rooms = communityRooms(scope, events, options.identityPubkey);
  const configuredActiveRoom =
    rooms.find((room) => room.id === options.activeRoomId) ?? rooms[0];
  const profiles = profilesFrom(events);
  const statuses = statusesFrom(events);
  const directConversations = directConversationModels(
    options.privateEvents ?? [],
    options.identityPubkey,
    options.directParticipants ?? {},
  );
  const activeDirect = directConversations.find(
    (conversation) => conversation.id === options.activeRoomId,
  );
  const activeRoom =
    activeDirect === undefined ? configuredActiveRoom : undefined;
  const deleted = deletedEventIds(events);
  const visible = events.filter((event) => !deleted.has(event.id));
  const roomModels = rooms.map((room) =>
    roomModel(room, visible, options.identityPubkey),
  );
  for (const model of roomModels) {
    const roomScope = rooms.find((room) => room.id === model.id);
    if (roomScope?.transport !== "buzz-dm") continue;
    const metadata = latestGroupState(events, 39000, roomScope.groupId);
    const membership = latestGroupState(events, 39002, roomScope.groupId);
    if (metadata && membership?.pubkey === metadata.pubkey) {
      model.kind = "direct";
      model.conversation = {
        transport: "buzz-dm",
        relayUrl: scope.relayUrl,
        groupId: roomScope.groupId,
      };
      model.participantIds = membership.tags
        .filter((tag) => tag[0] === "p" && tag[1])
        .map((tag) => tag[1]!);
      model.name = model.participantIds
        .filter((key) => key !== options.identityPubkey)
        .map((key) => profiles.get(key)?.name ?? shortKey(key))
        .join(", ");
    }
  }
  const directRooms = directConversations.map((conversation) =>
    directRoomModel(conversation, profiles, options.identityPubkey),
  );
  for (const model of [...roomModels, ...directRooms]) {
    const direct = directConversations.find(
      (conversation) => conversation.id === model.id,
    );
    const reference =
      model.conversation ??
      (direct
        ? { transport: "nip17" as const, participants: direct.participants }
        : {
            transport: "nip29" as const,
            relayUrl: scope.relayUrl,
            groupId: model.groupId ?? model.id,
          });
    model.conversation ??= reference;
    if (!options.identityPubkey) continue;
    const candidates = direct
      ? direct.events.filter(
          (event) =>
            event.kind === 14 &&
            directMessageModels(direct, options.identityPubkey).some(
              (message) => message.id === event.id,
            ),
        )
      : visible.filter(
          (event) =>
            [9, 11, 1111].includes(event.kind) &&
            event.tags.some(
              (tag) => tag[0] === "h" && tag[1] === model.groupId,
            ),
        );
    const latestIncoming = candidates
      .filter((event) => event.pubkey !== options.identityPubkey)
      .toSorted(
        (left, right) =>
          right.created_at - left.created_at || right.id.localeCompare(left.id),
      )[0];
    if (latestIncoming) model.latestUnreadEventId = latestIncoming.id;
    model.unreadCount = candidates.filter((event) =>
      isUnreadInConversation(
        event,
        reference,
        model.id,
        options.identityPubkey!,
        options.readMarkers,
      ),
    ).length;
  }
  const members =
    activeDirect === undefined
      ? memberModels(activeRoom, visible, profiles, statuses)
      : directMemberModels(activeDirect, profiles, statuses);
  const conversationMessages =
    activeDirect !== undefined
      ? directMessageModels(activeDirect, options.identityPubkey)
      : activeRoom === undefined
        ? []
        : messageModels(
            activeRoom,
            visible,
            profiles,
            options.activeTopicId,
            options.asOf,
            options.identityPubkey,
          );
  const messages =
    activeRoom?.kind === "channel" && activeRoom.transport !== "buzz-dm"
      ? conversationMessages.filter(
          (message) => message.parentMessageId === undefined,
        )
      : conversationMessages;
  const topics =
    activeRoom?.kind === "forum"
      ? topicModels(activeRoom, visible, profiles, options.asOf)
      : [];
  const thread =
    options.activeThreadId === undefined
      ? undefined
      : {
          rootMessageId: options.activeThreadId,
          messages: conversationMessages.filter(
            (message) =>
              message.id === options.activeThreadId ||
              message.parentMessageId === options.activeThreadId,
          ),
        };
  const details =
    activeDirect !== undefined
      ? {
          description: "Private NIP-17 conversation",
          memberIds: [...activeDirect.participants],
        }
      : activeRoom === undefined
        ? undefined
        : detailsModel(activeRoom, visible, members);

  return {
    communities: scopes.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      initials: initials(candidate.name),
      description: candidate.name,
    })),
    activeCommunityId: scope.id,
    navigationSections: [
      {
        id: "channels",
        label: "Channels",
        rooms: roomModels.filter((room) => room.kind === "channel"),
      },
      {
        id: "forums",
        label: "Forums",
        rooms: roomModels.filter((room) => room.kind === "forum"),
      },
      {
        id: "direct-messages",
        label: "Direct messages",
        rooms: [
          ...directRooms,
          ...roomModels.filter(
            (room) =>
              room.kind === "direct" &&
              !buzzHiddenChannels(
                events,
                options.identityPubkey ?? "",
                latestGroupState(events, 39000, room.groupId ?? room.id)
                  ?.pubkey ?? "",
              ).has(room.groupId ?? room.id),
          ),
        ],
      },
    ],
    activeRoomId: activeDirect?.id ?? activeRoom?.id ?? "",
    view:
      activeDirect !== undefined
        ? "channel"
        : activeRoom?.kind === "forum"
          ? options.activeTopicId === undefined
            ? "forum-index"
            : "forum-thread"
          : "channel",
    messages,
    topics,
    members,
    ...(options.identityPubkey === undefined
      ? {}
      : { currentMemberId: options.identityPubkey }),
    ...(thread === undefined ? {} : { thread }),
    ...(details === undefined ? {} : { details }),
    sidePanel: options.sidePanel ?? "none",
  };
}

export function directConversationId(participants: readonly string[]): string {
  return `dm:${[...new Set(participants)].toSorted().join(",")}`;
}

export interface CommunityInboxProjectionOptions {
  messageLimit?: number;
  itemLimit?: number;
  privateEventsByScope?: Readonly<
    Record<string, readonly CommunityPrivateEvent[]>
  >;
  readMarkersByScope?: Readonly<
    Record<string, Readonly<Record<string, CommunityReadCursor>>>
  >;
  activeItemId?: string;
  filter?: CommunityInboxFilter;
  unreadOnly?: boolean;
}
export function materializeCommunityInbox(
  scopes: readonly CommunityScope[],
  eventsByScope: Readonly<Record<string, readonly NostrEvent[]>>,
  identityPubkey: string | undefined,
  asOf?: number,
  options: CommunityInboxProjectionOptions = {},
): CommunityInboxModel | undefined {
  if (identityPubkey === undefined) return undefined;
  const rows: {
    item: CommunityInboxItemModel;
    room: CommunityRoomModel;
    messages: () => CommunityMessageModel[];
    members: CommunityMemberModel[];
  }[] = [];
  const allPrivateEvents = [
    ...new Map(
      Object.values(options.privateEventsByScope ?? {})
        .flat()
        .map((event) => [event.id, event]),
    ).values(),
  ];
  const directScopeId = scopes.find(
    (scope) => (options.privateEventsByScope?.[scope.id]?.length ?? 0) > 0,
  )?.id;
  const directCursors: Record<string, CommunityReadCursor> = {};
  for (const markers of Object.values(options.readMarkersByScope ?? {}))
    for (const [key, cursor] of Object.entries(markers)) {
      const prior = directCursors[key];
      if (
        !prior ||
        cursor.createdAt > prior.createdAt ||
        (cursor.createdAt === prior.createdAt && cursor.eventId > prior.eventId)
      )
        directCursors[key] = cursor;
    }
  for (const scope of scopes) {
    const events = acceptedEvents(eventsByScope[scope.id] ?? []);
    const deleted = deletedEventIds(events);
    const profiles = profilesFrom(events);
    const statuses = statusesFrom(events);
    const cursors = options.readMarkersByScope?.[scope.id] ?? {};
    for (const direct of directConversationModels(
      scope.id === directScopeId ? allPrivateEvents : [],
      identityPubkey,
      {},
    )) {
      const reference: CommunityConversationReference = {
        transport: "nip17",
        participants: direct.participants,
      };
      const deletedDirect = directDeletedIds(direct);
      const visibleIds = new Set(
        direct.events
          .filter((event) => event.kind === 14 && !deletedDirect.has(event.id))
          .map((event) => event.id),
      );
      const incoming = direct.events.filter(
        (event) =>
          event.kind === 14 &&
          event.pubkey !== identityPubkey &&
          visibleIds.has(event.id),
      );
      const latest = incoming.at(-1);
      if (!latest) continue;
      const room = directRoomModel(direct, profiles, identityPubkey);
      const id = conversationKey(reference);
      rows.push({
        item: {
          id,
          conversation: reference,
          scopeId: scope.id,
          roomId: direct.id,
          categories: [
            "Direct messages",
            ...(incoming.some((event) =>
              contentMentionPubkeys(event.content).includes(identityPubkey),
            )
              ? ["Mentions" as const]
              : []),
          ],
          authorId: latest.pubkey,
          context: room.name,
          excerpt: latest.content,
          timestamp: timestamp(latest.created_at),
          latestEventId: latest.id,
          latestCreatedAt: latest.created_at,
          unread: incoming.some((event) =>
            afterReadCursor(
              event,
              directCursors[id] ?? directCursors[direct.id],
            ),
          ),
        },
        room,
        messages: () =>
          directMessageModels(direct, identityPubkey, options.messageLimit),
        members: directMemberModels(direct, profiles, statuses),
      });
    }
    for (const roomScope of communityRooms(scope, events, identityPubkey)) {
      const roomEvents: NostrEvent[] = events.filter(
        (event) =>
          [9, 11, 1111].includes(event.kind) &&
          !deleted.has(event.id) &&
          event.tags.some(
            (tag) => tag[0] === "h" && tag[1] === roomScope.groupId,
          ),
      );
      const root = (event: NostrEvent): string | undefined =>
        event.tags.find(
          (tag) => tag[0] === "E" || (tag[0] === "e" && tag[3] === "root"),
        )?.[1] ?? event.tags.find((tag) => tag[0] === "e")?.[1];
      const participated = new Set(
        roomEvents
          .filter((event) => event.pubkey === identityPubkey)
          .map((event) => root(event) ?? event.id),
      );
      const groups = new Map<
        string,
        {
          reference: CommunityConversationReference;
          incoming: NostrEvent[];
          categories: Set<"Direct messages" | "Mentions" | "Threads">;
          rootId?: string;
        }
      >();
      for (const event of roomEvents) {
        if (event.pubkey === identityPubkey) continue;
        const rootId = root(event);
        const mention =
          event.tags.some(
            (tag) => ["p", "P"].includes(tag[0]!) && tag[1] === identityPubkey,
          ) || contentMentionPubkeys(event.content).includes(identityPubkey);
        const thread = rootId !== undefined && participated.has(rootId);
        const buzzDirect = roomScope.transport === "buzz-dm";
        const authority =
          latestGroupState(events, 39000, roomScope.groupId)?.pubkey ?? "";
        if (
          buzzDirect &&
          buzzHiddenChannels(events, identityPubkey, authority).has(
            roomScope.groupId,
          )
        )
          continue;
        if (!mention && !thread && !buzzDirect) continue;
        const reference: CommunityConversationReference = {
          transport: buzzDirect ? "buzz-dm" : "nip29",
          relayUrl: scope.relayUrl,
          groupId: roomScope.groupId,
          ...(!buzzDirect && rootId ? { threadId: rootId } : {}),
        };
        const id = conversationKey(reference);
        const group = groups.get(id) ?? {
          reference,
          incoming: [],
          categories: new Set<"Direct messages" | "Mentions" | "Threads">(),
          ...(!buzzDirect && rootId ? { rootId } : {}),
        };
        group.incoming.push(event);
        if (buzzDirect) group.categories.add("Direct messages");
        if (mention) group.categories.add("Mentions");
        if (thread) group.categories.add("Threads");
        groups.set(id, group);
      }
      for (const [id, group] of groups) {
        const latest = group.incoming.at(-1)!;
        const room = {
          ...roomModel(roomScope, events, identityPubkey),
          conversation: group.reference,
          ...(roomScope.transport === "buzz-dm"
            ? { kind: "direct" as const }
            : {}),
        };
        const selectedEvents = group.rootId
          ? roomEvents.filter(
              (event) =>
                event.id === group.rootId || root(event) === group.rootId,
            )
          : roomEvents.filter(
              (event) => roomScope.transport === "buzz-dm" || !root(event),
            );
        rows.push({
          item: {
            id,
            conversation: group.reference,
            scopeId: scope.id,
            roomId: room.id,
            ...(group.rootId ? { rootEventId: group.rootId } : {}),
            categories: [...group.categories],
            authorId: latest.pubkey,
            context: room.name,
            timestamp: timestamp(latest.created_at),
            excerpt: latest.content,
            latestEventId: latest.id,
            latestCreatedAt: latest.created_at,
            unread: group.incoming.some((event) =>
              isUnreadInConversation(
                event,
                group.reference,
                room.id,
                identityPubkey,
                cursors,
              ),
            ),
          },
          room,
          messages: () =>
            selectedEvents
              .slice(-(options.messageLimit ?? selectedEvents.length))
              .map((event) =>
                eventMessage(event, events, profiles, asOf, identityPubkey),
              ),
          members: memberModels(roomScope, selectedEvents, profiles, statuses),
        });
      }
    }
  }
  rows.sort(
    (a, b) =>
      (b.item.latestCreatedAt ?? 0) - (a.item.latestCreatedAt ?? 0) ||
      a.item.id.localeCompare(b.item.id),
  );
  // A NIP-17 rumor received through multiple community relay connections is one item.
  const unique = [...new Map(rows.map((row) => [row.item.id, row])).values()];
  const filter = options.filter ?? "All";
  const visible = unique.filter(
    (row) =>
      (filter === "All" || row.item.categories?.includes(filter)) &&
      (!options.unreadOnly || row.item.unread),
  );
  const active =
    unique.find((row) => row.item.id === options.activeItemId) ??
    visible[0] ??
    unique[0];
  if (!active) return undefined;
  return {
    items: (options.itemLimit === undefined
      ? unique
      : visible.slice(0, options.itemLimit)
    ).map((row) => row.item),
    activeItemId: active.item.id,
    selectedItem: active.item,
    filter,
    unreadOnly: options.unreadOnly ?? false,
    unreadCount: unique.filter((row) => row.item.unread).length,
    threadTitle: active.room.name,
    room: active.room,
    messages: active.messages(),
    members: [
      ...new Map(
        unique
          .flatMap((row) => row.members)
          .map((member) => [member.id, member]),
      ).values(),
    ],
    participantCount: active.members.length,
  };
}

function acceptedEvents(events: readonly NostrEvent[]): NostrEvent[] {
  const accepted = new Map<string, NostrEvent>();
  for (const event of events) {
    if (isVerifiedNostrEvent(event) && !isRegistryControlEvent(event)) {
      accepted.set(event.id, event);
    }
  }
  return [...accepted.values()].toSorted(compareOldest);
}

function deletedEventIds(events: readonly NostrEvent[]): Set<string> {
  const authors = new Map(
    events.map((event) => [event.id, event.pubkey] as const),
  );
  const deleted = new Set<string>();
  for (const event of events) {
    if (event.kind !== 5 && event.kind !== 9_005) continue;
    for (const tag of event.tags) {
      if (tag[0] !== "e" || tag[1] === undefined) continue;
      if (event.kind === 9_005 || authors.get(tag[1]) === event.pubkey) {
        deleted.add(tag[1]);
      }
    }
  }
  return deleted;
}

function profilesFrom(events: readonly NostrEvent[]): Map<string, Profile> {
  const selected = new Map<string, { event: NostrEvent; profile: Profile }>();
  for (const event of events) {
    if (event.kind !== 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.content) as unknown;
    } catch {
      continue;
    }
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
      continue;
    const candidate = parsed as {
      display_name?: unknown;
      name?: unknown;
      picture?: unknown;
    };
    const name =
      typeof candidate.display_name === "string" &&
      candidate.display_name.trim() !== ""
        ? candidate.display_name.trim()
        : typeof candidate.name === "string" && candidate.name.trim() !== ""
          ? candidate.name.trim()
          : "";
    if (name === "") continue;
    const picture =
      typeof candidate.picture === "string" && candidate.picture.trim() !== ""
        ? candidate.picture.trim()
        : undefined;
    const current = selected.get(event.pubkey);
    if (current === undefined || newer(event, current.event)) {
      selected.set(event.pubkey, {
        event,
        profile: {
          name,
          ...(picture === undefined ? {} : { picture }),
        },
      });
    }
  }
  return new Map(
    [...selected].map(([pubkey, entry]) => [pubkey, entry.profile]),
  );
}

function statusesFrom(events: readonly NostrEvent[]): Map<string, string> {
  const selected = new Map<string, NostrEvent>();
  for (const event of events) {
    if (
      event.kind !== 30_315 ||
      !event.tags.some((tag) => tag[0] === "d" && tag[1] === "general")
    ) {
      continue;
    }
    const current = selected.get(event.pubkey);
    if (current === undefined || newer(event, current)) {
      selected.set(event.pubkey, event);
    }
  }
  return new Map(
    [...selected]
      .filter(([, event]) => event.content.trim() !== "")
      .map(([pubkey, event]) => [pubkey, event.content.trim()]),
  );
}

function roomModel(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  identityPubkey?: string,
): CommunityRoomModel {
  const metadata = latestGroupState(events, 39_000, room.groupId);
  const members = latestGroupState(events, 39_002, room.groupId);
  const admins = latestGroupState(events, 39_001, room.groupId);
  const rolesState = latestGroupRoleState(
    events,
    room.groupId,
    metadata?.pubkey,
  );
  const name =
    metadata?.tags.find((tag) => tag[0] === "name")?.[1] ?? room.name;
  const description =
    metadata?.tags.find((tag) => tag[0] === "about")?.[1] ?? room.description;
  const memberCount = members?.tags.filter((tag) => tag[0] === "p").length;
  const deleted = deletedEventIds(events);
  const messageEvents = events.filter(
    (event) =>
      !deleted.has(event.id) &&
      [9, 11, 1_111].includes(event.kind) &&
      event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
  );
  const lastActivity = [
    ...messageEvents,
    ...(metadata === undefined ? [] : [metadata]),
  ].toSorted((left, right) => compareOldest(right, left))[0];
  const privateRoom =
    room.private === true ||
    metadata?.tags.some((tag) => tag[0] === "private") === true;
  const joined =
    identityPubkey === undefined
      ? undefined
      : members?.tags.some(
          (tag) => tag[0] === "p" && tag[1] === identityPubkey,
        );
  const administrator =
    identityPubkey !== undefined &&
    admins?.tags.some((tag) => tag[0] === "p" && tag[1] === identityPubkey) ===
      true;
  const memberRoles = normalizeRoles(
    members?.tags
      .filter((tag) => tag[0] === "p" && tag[1] === identityPubkey)
      .flatMap((tag) => tag.slice(2)) ?? [],
  );
  const metadataContent = parseJsonObject(metadata?.content);
  const membershipRequired =
    metadata?.tags.some(
      (tag) => tag[0] === "restricted" || tag[0] === "closed",
    ) === true ||
    metadataContent?.restricted === true ||
    metadataContent?.closed === true;
  const writerRequired =
    metadata?.tags.some((tag) => tag[0] === "write-restricted") === true ||
    metadataContent?.["write-restricted"] === true;
  const roleDefinitions = communityRoleDefinitions(metadata, rolesState);
  const authenticationRequired = {
    state: "requires-authentication" as const,
    reason: "Connect a NIP-07 identity to perform this action",
    requirement: "authentication" as const,
  };
  const denied = {
    state: "denied" as const,
    reason: "The relay has not granted permission for this room",
  };
  const enabled = { state: "enabled" as const };
  const membershipDenied = {
    state: "denied" as const,
    reason: "Join this room before posting",
    requirement: "membership" as const,
  };
  const reactionMembershipDenied = {
    state: "denied" as const,
    reason: "Join this room before reacting",
    requirement: "membership" as const,
  };
  const writerDenied = {
    state: "denied" as const,
    reason: "A writer or administrator role is required to publish here",
    requirement: "writer" as const,
  };
  const administrativeAvailability =
    identityPubkey === undefined
      ? authenticationRequired
      : admins === undefined || administrator
        ? enabled
        : denied;
  return {
    id: room.id,
    groupId: room.groupId,
    name,
    kind: room.kind,
    ...(description === undefined ? {} : { description }),
    ...(memberCount === undefined ? {} : { memberCount }),
    messageCount: messageEvents.length,
    private: privateRoom,
    postingPolicy: writerRequired ? "writers" : "standard",
    roleDefinitions,
    membership:
      members === undefined
        ? "unknown"
        : joined === true
          ? "joined"
          : "not-joined",
    memberListCompleteness: members === undefined ? "unavailable" : "partial",
    lifecycle: "ongoing",
    ...(lastActivity === undefined
      ? {}
      : {
          lastActivityAt: new Date(
            lastActivity.created_at * 1_000,
          ).toISOString(),
        }),
    permissions: {
      publish:
        identityPubkey === undefined
          ? authenticationRequired
          : membershipRequired && joined === false
            ? membershipDenied
            : writerRequired &&
                members !== undefined &&
                !administrator &&
                !memberRoles.includes("writer")
              ? writerDenied
              : enabled,
      react:
        identityPubkey === undefined
          ? authenticationRequired
          : membershipRequired && joined === false
            ? reactionMembershipDenied
            : enabled,
      join:
        identityPubkey === undefined
          ? authenticationRequired
          : joined === true
            ? denied
            : enabled,
      leave:
        identityPubkey === undefined
          ? authenticationRequired
          : joined === true
            ? enabled
            : denied,
      update: administrativeAvailability,
      delete: administrativeAvailability,
      manageMembers: administrativeAvailability,
    },
  };
}

function parseJsonObject(value: string | undefined): Record<string, unknown> {
  if (value === undefined || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function latestGroupState(
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
    .toSorted((left, right) => compareOldest(right, left))[0];
}

function latestGroupRoleState(
  events: readonly NostrEvent[],
  groupId: string,
  relayPubkey: string | undefined,
): NostrEvent | undefined {
  if (relayPubkey === undefined) return undefined;
  return events
    .filter(
      (event) =>
        event.kind === 39_003 &&
        event.pubkey === relayPubkey &&
        event.tags.some((tag) => tag[0] === "d" && tag[1] === groupId),
    )
    .toSorted((left, right) => compareOldest(right, left))[0];
}

function memberModels(
  room: CommunityRoomScope | undefined,
  events: readonly NostrEvent[],
  profiles: ReadonlyMap<string, Profile>,
  statuses: ReadonlyMap<string, string>,
): CommunityMemberModel[] {
  const groupMembers =
    room === undefined
      ? undefined
      : latestGroupState(events, 39_002, room.groupId);
  const groupAdmins =
    room === undefined
      ? undefined
      : latestGroupState(events, 39_001, room.groupId);
  const roles = new Map<string, string[]>();
  const administratorIds = new Set<string>();
  for (const tag of groupMembers?.tags ?? []) {
    if (tag[0] === "p" && tag[1] !== undefined) {
      roles.set(
        tag[1],
        normalizeRoles([...(roles.get(tag[1]) ?? []), ...tag.slice(2)]),
      );
    }
  }
  for (const tag of groupAdmins?.tags ?? []) {
    if (tag[0] === "p" && tag[1] !== undefined) {
      administratorIds.add(tag[1]);
      roles.set(
        tag[1],
        normalizeRoles([...(roles.get(tag[1]) ?? []), ...tag.slice(2)]),
      );
    }
  }
  const pubkeys = new Set([
    ...roles.keys(),
    ...events.map((event) => event.pubkey),
    ...events.flatMap((event) =>
      event.tags
        .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
        .map((tag) => tag[1]!),
    ),
  ]);
  return [...pubkeys].toSorted().map((pubkey) => {
    const name = profiles.get(pubkey)?.name ?? shortKey(pubkey);
    return {
      id: pubkey,
      name,
      handle: shortKey(pubkey),
      initials: initials(name),
      ...(profiles.get(pubkey)?.picture === undefined
        ? {}
        : { avatarUrl: profiles.get(pubkey)!.picture! }),
      presence: "offline",
      ...(statuses.get(pubkey) === undefined
        ? {}
        : { status: statuses.get(pubkey)! }),
      ...(roles.get(pubkey) === undefined
        ? {}
        : {
            roles: roles.get(pubkey)!,
            role: administratorIds.has(pubkey)
              ? "administrator"
              : (roles.get(pubkey)?.[0] ?? "member"),
          }),
      ...(administratorIds.has(pubkey) ? { administrator: true } : {}),
    };
  });
}

function communityRoleDefinitions(
  metadata: NostrEvent | undefined,
  rolesState: NostrEvent | undefined,
): CommunityRoleDefinition[] {
  const definitions = new Map<string, CommunityRoleDefinition>();
  if (metadata !== undefined && rolesState?.pubkey === metadata.pubkey) {
    for (const tag of rolesState.tags) {
      if (tag[0] !== "role" || tag[1]?.trim() === "") continue;
      const id = tag[1]!.trim();
      if (definitions.has(id)) continue;
      definitions.set(id, {
        id,
        label: roleLabel(id),
        ...(tag[2]?.trim() ? { description: tag[2]!.trim() } : {}),
      });
    }
  }
  if (!definitions.has("writer")) {
    definitions.set("writer", {
      id: "writer",
      label: "Writer",
      description: "Can publish when this room is limited to writers.",
    });
  }
  return [...definitions.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function normalizeRoles(roles: readonly string[]): string[] {
  return [
    ...new Set(roles.map((role) => role.trim()).filter(Boolean)),
  ].toSorted();
}

function roleLabel(role: string): string {
  return role
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => part[0]!.toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

function messageModels(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  profiles: ReadonlyMap<string, Profile>,
  activeTopicId: string | undefined,
  asOf: number | undefined,
  identityPubkey: string | undefined,
): CommunityMessageModel[] {
  const kinds =
    room.kind === "channel"
      ? new Set([9, ...CHANNEL_ACTIVITY_KINDS])
      : new Set([11, 1_111]);
  const roomEvents = events.filter(
    (event) =>
      kinds.has(event.kind) &&
      event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
  );
  const selected =
    room.kind === "forum" && activeTopicId !== undefined
      ? roomEvents.filter(
          (event) =>
            event.id === activeTopicId ||
            event.tags.some(
              (tag) => tag[0] === "E" && tag[1] === activeTopicId,
            ),
        )
      : roomEvents;
  return selected
    .toSorted(compareOldest)
    .map((event) =>
      CHANNEL_ACTIVITY_KINDS.has(event.kind)
        ? channelActivityMessage(event)
        : eventMessage(event, events, profiles, asOf, identityPubkey),
    );
}

function channelActivityMessage(event: NostrEvent): CommunityMessageModel {
  const targetMemberId =
    event.kind === 9_021 || event.kind === 9_022
      ? event.pubkey
      : event.tags.find((tag) => tag[0] === "p")?.[1];
  const type =
    event.kind === 9_007
      ? ("channel-created" as const)
      : event.kind === 9_000
        ? ("member-added" as const)
        : event.kind === 9_001
          ? ("member-removed" as const)
          : event.kind === 9_021
            ? ("member-joined" as const)
            : ("member-left" as const);
  return {
    id: event.id,
    authorId: event.pubkey,
    content: "",
    sourceEvent: event,
    activity: {
      type,
      ...(targetMemberId === undefined ? {} : { targetMemberId }),
    },
    timestamp: timestamp(event.created_at),
    createdAt: new Date(event.created_at * 1_000).toISOString(),
  };
}

function eventMessage(
  event: NostrEvent,
  events: readonly NostrEvent[],
  _profiles: ReadonlyMap<string, Profile>,
  asOf: number | undefined,
  identityPubkey: string | undefined,
): CommunityMessageModel {
  const edit = latestMessageEdit(event, events);
  const renderedEvent = edit ?? event;
  const parentMessageId =
    event.tags.find((tag) => tag[0] === "e" && tag[3] === "reply")?.[1] ??
    event.tags.find((tag) => tag[0] === "e")?.[1];
  const replyKind = event.kind === 11 ? 1_111 : event.kind;
  const replies = events.filter(
    (candidate) =>
      candidate.kind === replyKind &&
      candidate.tags.some(
        (tag) => (tag[0] === "e" || tag[0] === "E") && tag[1] === event.id,
      ),
  );
  const orderedReplies = replies.toSorted(compareOldest);
  const replyCount = orderedReplies.length;
  const latestReply = orderedReplies.at(-1);
  const reactions = reactionModels(event.id, events, identityPubkey);
  const mentionPubkeys = [
    ...new Set(
      renderedEvent.tags
        .filter(
          (tag) => (tag[0] === "p" || tag[0] === "P") && tag[1] !== undefined,
        )
        .map((tag) => tag[1]!),
    ),
  ];
  return {
    id: event.id,
    authorId: event.pubkey,
    content: renderedEvent.content,
    sourceEvent: event,
    ...(edit === undefined ? {} : { edited: true }),
    ...(mentionPubkeys.length === 0 ? {} : { mentionPubkeys }),
    timestamp: timestamp(event.created_at),
    createdAt: new Date(event.created_at * 1_000).toISOString(),
    ...(parentMessageId === undefined ? {} : { parentMessageId }),
    ...(replyCount === 0
      ? {}
      : {
          replyCount,
          replyLabel: `${replyCount === 1 ? "1 reply" : `${replyCount} replies`}${
            latestReply === undefined || asOf === undefined
              ? ""
              : ` · last reply ${relativeTimestamp(latestReply.created_at, asOf)}`
          }`,
          ...(latestReply === undefined
            ? {}
            : {
                lastReplyAt: new Date(
                  latestReply.created_at * 1_000,
                ).toISOString(),
              }),
          replyParticipantIds: [
            ...new Set(
              orderedReplies.toReversed().map((reply) => reply.pubkey),
            ),
          ].slice(0, 3),
        }),
    ...(reactions.length === 0 ? {} : { reactions }),
  };
}

function latestMessageEdit(
  target: NostrEvent,
  events: readonly NostrEvent[],
): NostrEvent | undefined {
  const groupId = target.tags.find((tag) => tag[0] === "h")?.[1];
  if (groupId === undefined) return undefined;
  return events
    .filter(
      (event) =>
        event.kind === COMMUNITY_MESSAGE_EDIT_KIND &&
        event.pubkey === target.pubkey &&
        event.content.trim() !== "" &&
        event.tags.some((tag) => tag[0] === "h" && tag[1] === groupId) &&
        event.tags.some((tag) => tag[0] === "e" && tag[1] === target.id),
    )
    .toSorted(
      (left, right) =>
        right.created_at - left.created_at || right.id.localeCompare(left.id),
    )[0];
}

function reactionModels(
  eventId: string,
  events: readonly NostrEvent[],
  identityPubkey: string | undefined,
): CommunityReactionModel[] {
  const latest = new Map<string, NostrEvent>();
  for (const event of events) {
    if (
      event.kind !== 7 ||
      !event.tags.some((tag) => tag[0] === "e" && tag[1] === eventId)
    ) {
      continue;
    }
    const key = `${event.pubkey}:${event.content}`;
    const current = latest.get(key);
    if (current === undefined || newer(event, current)) latest.set(key, event);
  }
  const groups = new Map<
    string,
    { count: number; selected: boolean; customEmojiUrl?: string }
  >();
  for (const event of latest.values()) {
    const current = groups.get(event.content) ?? { count: 0, selected: false };
    const customEmojiUrl = event.tags.find(
      (tag) => tag[0] === "emoji" && tag[1] === event.content,
    )?.[2];
    groups.set(event.content, {
      count: current.count + 1,
      selected: current.selected || event.pubkey === identityPubkey,
      ...((customEmojiUrl ?? current.customEmojiUrl)
        ? { customEmojiUrl: customEmojiUrl ?? current.customEmojiUrl }
        : {}),
    });
  }
  return [...groups]
    .map(([emoji, value]) => ({
      emoji: emoji === "+" ? "❤" : emoji,
      count: value.count,
      ...(value.selected ? { selected: true } : {}),
      ...(value.customEmojiUrl === undefined
        ? {}
        : { customEmojiUrl: value.customEmojiUrl }),
    }))
    .toSorted(
      (left, right) =>
        right.count - left.count || left.emoji.localeCompare(right.emoji),
    );
}

function topicModels(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  _profiles: ReadonlyMap<string, Profile>,
  asOf: number | undefined,
): CommunityTopicModel[] {
  return events
    .filter(
      (event) =>
        event.kind === 11 &&
        event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
    )
    .toSorted((left, right) => compareOldest(right, left))
    .map((event) => {
      const replies = events.filter(
        (candidate) =>
          candidate.kind === 1_111 &&
          candidate.tags.some((tag) => tag[0] === "E" && tag[1] === event.id),
      );
      const orderedReplies = replies.toSorted(compareOldest);
      const lastActivityAt =
        orderedReplies.at(-1)?.created_at ?? event.created_at;
      return {
        id: event.id,
        title:
          event.tags.find((tag) => tag[0] === "title")?.[1] ??
          event.content.split(/\r?\n/u)[0]?.slice(0, 120) ??
          "Discussion",
        excerpt: event.content,
        authorId: event.pubkey,
        tags: event.tags
          .filter((tag) => tag[0] === "t")
          .flatMap((tag) => tag.slice(1)),
        replyCount: replies.length,
        participantIds: [
          ...new Set(orderedReplies.toReversed().map((reply) => reply.pubkey)),
        ].slice(0, 3),
        lastActivityLabel: forumActivityTimestamp(lastActivityAt, asOf),
      };
    });
}

function detailsModel(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  members: readonly CommunityMemberModel[],
): CommunityDetailsModel {
  const metadata = latestGroupState(events, 39_000, room.groupId);
  const admins = latestGroupState(events, 39_001, room.groupId);
  return {
    description:
      metadata?.tags.find((tag) => tag[0] === "about")?.[1] ??
      room.description ??
      "",
    memberIds: members.map((member) => member.id),
    moderatorIds: (admins?.tags ?? [])
      .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
      .map((tag) => tag[1]!),
  };
}

function directConversationModels(
  privateEvents: readonly CommunityPrivateEvent[],
  identityPubkey: string | undefined,
  pendingParticipants: Readonly<Record<string, readonly string[]>>,
): DirectConversation[] {
  if (identityPubkey === undefined) return [];
  const conversations = new Map<string, CommunityPrivateEvent[]>();
  const participantsById = new Map<string, readonly string[]>();
  for (const event of privateEvents) {
    const participants = [
      ...new Set([
        event.pubkey,
        ...event.tags
          .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
          .map((tag) => tag[1]!),
      ]),
    ].toSorted();
    if (!participants.includes(identityPubkey)) continue;
    const id = directConversationId(
      participants.filter((pubkey) => pubkey !== identityPubkey),
    );
    participantsById.set(id, participants);
    const current = conversations.get(id) ?? [];
    current.push(event);
    conversations.set(id, current);
  }
  for (const [id, participants] of Object.entries(pendingParticipants)) {
    participantsById.set(
      id,
      [...new Set([identityPubkey, ...participants])].toSorted(),
    );
    if (!conversations.has(id)) conversations.set(id, []);
  }
  return [...conversations]
    .map(([id, directEvents]) => ({
      id,
      participants: participantsById.get(id) ?? [identityPubkey],
      events: directEvents.toSorted(
        (left, right) =>
          left.created_at - right.created_at || left.id.localeCompare(right.id),
      ),
    }))
    .toSorted((left, right) => {
      const leftActivity = left.events.at(-1)?.created_at ?? 0;
      const rightActivity = right.events.at(-1)?.created_at ?? 0;
      return rightActivity - leftActivity || left.id.localeCompare(right.id);
    });
}

function directRoomModel(
  conversation: DirectConversation,
  profiles: ReadonlyMap<string, Profile>,
  identityPubkey: string | undefined,
): CommunityRoomModel {
  const peers = conversation.participants.filter(
    (pubkey) => pubkey !== identityPubkey,
  );
  const displayPeers = peers.length > 0 ? peers : conversation.participants;
  return {
    id: conversation.id,
    name: displayPeers
      .map((pubkey) => profiles.get(pubkey)?.name ?? shortKey(pubkey))
      .join(", "),
    kind: "direct",
    conversation: {
      transport: "nip17",
      participants: conversation.participants,
    },
    participantIds: conversation.participants,
    memberCount: conversation.participants.length,
    private: true,
    membership: "joined",
    memberListCompleteness: "complete",
    lifecycle: "ongoing",
  };
}

function directMemberModels(
  conversation: DirectConversation,
  profiles: ReadonlyMap<string, Profile>,
  statuses: ReadonlyMap<string, string>,
): CommunityMemberModel[] {
  return conversation.participants.map((pubkey) => {
    const name = profiles.get(pubkey)?.name ?? shortKey(pubkey);
    return {
      id: pubkey,
      name,
      handle: shortKey(pubkey),
      initials: initials(name),
      ...(profiles.get(pubkey)?.picture === undefined
        ? {}
        : { avatarUrl: profiles.get(pubkey)!.picture! }),
      presence: "offline",
      ...(statuses.get(pubkey) === undefined
        ? {}
        : { status: statuses.get(pubkey)! }),
    };
  });
}

function directDeletedIds(conversation: DirectConversation): Set<string> {
  const authors = new Map(
    conversation.events.map((event) => [event.id, event.pubkey]),
  );
  return new Set(
    conversation.events
      .filter((event) => event.kind === 5)
      .flatMap((event) =>
        event.tags
          .filter(
            (tag) =>
              tag[0] === "e" &&
              tag[1] !== undefined &&
              authors.get(tag[1]) === event.pubkey,
          )
          .map((tag) => tag[1]!),
      ),
  );
}

function directMessageModels(
  conversation: DirectConversation,
  identityPubkey: string | undefined,
  limit?: number,
): CommunityMessageModel[] {
  const deleted = directDeletedIds(conversation);
  const reactions = conversation.events.filter(
    (event) => event.kind === 7 && !deleted.has(event.id),
  );
  return conversation.events
    .filter((event) => event.kind === 14 && !deleted.has(event.id))
    .slice(-(limit ?? conversation.events.length))
    .map((event) => {
      const eventReactions = reactions.filter((reaction) =>
        reaction.tags.some((tag) => tag[0] === "e" && tag[1] === event.id),
      );
      const grouped = new Map<
        string,
        { count: number; selected: boolean; customEmojiUrl?: string }
      >();
      for (const reaction of eventReactions) {
        const current = grouped.get(reaction.content) ?? {
          count: 0,
          selected: false,
        };
        const customEmojiUrl = reaction.tags.find(
          (tag) => tag[0] === "emoji" && tag[1] === reaction.content,
        )?.[2];
        grouped.set(reaction.content, {
          count: current.count + 1,
          selected: current.selected || reaction.pubkey === identityPubkey,
          ...((customEmojiUrl ?? current.customEmojiUrl)
            ? { customEmojiUrl: customEmojiUrl ?? current.customEmojiUrl }
            : {}),
        });
      }
      const mentionPubkeys = contentMentionPubkeys(event.content);
      return {
        id: event.id,
        authorId: event.pubkey,
        content: event.content,
        ...(mentionPubkeys.length === 0 ? {} : { mentionPubkeys }),
        timestamp: timestamp(event.created_at),
        createdAt: new Date(event.created_at * 1_000).toISOString(),
        ...(event.tags.find((tag) => tag[0] === "e")?.[1] === undefined
          ? {}
          : {
              parentMessageId: event.tags.find((tag) => tag[0] === "e")![1]!,
            }),
        ...(grouped.size === 0
          ? {}
          : {
              reactions: [...grouped].map(([emoji, value]) => ({
                emoji,
                count: value.count,
                ...(value.selected ? { selected: true } : {}),
                ...(value.customEmojiUrl === undefined
                  ? {}
                  : { customEmojiUrl: value.customEmojiUrl }),
              })),
            }),
      };
    });
}

function emptyWorkspace(): CommunityWorkspaceModel {
  return {
    communities: [],
    activeCommunityId: "",
    navigationSections: [],
    activeRoomId: "",
    view: "channel",
    messages: [],
    topics: [],
    members: [],
    sidePanel: "none",
  };
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  return (
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`
      : (parts[0]?.slice(0, 2) ?? "C")
  ).toUpperCase();
}

function shortKey(value: string): string {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

function timestamp(createdAt: number): string {
  return new Date(createdAt * 1_000).toISOString().slice(11, 16);
}

function relativeTimestamp(createdAt: number, asOf: number): string {
  const elapsedSeconds = Math.max(0, asOf - createdAt);
  if (elapsedSeconds < 60) return "just now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
  }

  return `on ${new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(createdAt * 1_000)}`;
}

function forumActivityTimestamp(
  createdAt: number,
  asOf: number | undefined,
): string {
  if (asOf === undefined) return timestamp(createdAt);

  const elapsedSeconds = Math.max(0, asOf - createdAt);
  if (elapsedSeconds < 60) return "now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d`;

  const activityDate = new Date(createdAt * 1_000);
  const currentDate = new Date(asOf * 1_000);
  return new Intl.DateTimeFormat("en", {
    ...(activityDate.getUTCFullYear() === currentDate.getUTCFullYear()
      ? { day: "numeric", month: "short" }
      : { month: "short", year: "numeric" }),
    timeZone: "UTC",
  }).format(activityDate);
}
