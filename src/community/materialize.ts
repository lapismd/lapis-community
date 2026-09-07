import type {
  CommunityDetailsModel,
  CommunityInboxModel,
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityReactionModel,
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
  if (!scope.discoverPublicRooms) return configured;

  const configuredGroupIds = new Set(configured.map((room) => room.groupId));
  const metadataByGroup = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 39_000 || !isVerifiedNostrEvent(event)) continue;
    const groupId = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (
      groupId === undefined ||
      groupId === "" ||
      configuredGroupIds.has(groupId) ||
      event.tags.some((tag) => tag[0] === "private" || tag[0] === "hidden")
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
      const kind =
        supportedKinds.has(11) || supportedKinds.has(1_111)
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
      return {
        id: groupId,
        groupId,
        name,
        kind,
        ...(description ? { description } : {}),
      };
    })
    .filter((room): room is CommunityRoomScope => room !== undefined)
    .toSorted(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name),
    );
  return [...configured, ...discovered];
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
  const rooms = communityRooms(scope, events);
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
  const directRooms = directConversations.map((conversation) =>
    directRoomModel(conversation, profiles, options.identityPubkey),
  );
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
    activeRoom?.kind === "channel"
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
        rooms: directRooms,
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

export function materializeCommunityInbox(
  scopes: readonly CommunityScope[],
  eventsByScope: Readonly<Record<string, readonly NostrEvent[]>>,
  identityPubkey: string | undefined,
  asOf?: number,
): CommunityInboxModel | undefined {
  if (identityPubkey === undefined) return undefined;
  const candidates = scopes.flatMap((scope) => {
    const events = acceptedEvents(eventsByScope[scope.id] ?? []);
    const rooms = communityRooms(scope, events);
    const profiles = profilesFrom(events);
    const statuses = statusesFrom(events);
    return events
      .filter(
        (event) =>
          (event.kind === 9 || event.kind === 1_111) &&
          event.pubkey !== identityPubkey &&
          event.tags.some(
            (tag) =>
              (tag[0] === "p" || tag[0] === "P") && tag[1] === identityPubkey,
          ),
      )
      .map((event) => ({ scope, rooms, profiles, statuses, event }));
  });
  const ordered = candidates.toSorted((left, right) =>
    compareOldest(right.event, left.event),
  );
  const active = ordered[0];
  if (active === undefined) return undefined;
  const groupId = active.event.tags.find((tag) => tag[0] === "h")?.[1] ?? "";
  const roomScope =
    active.rooms.find((room) => room.groupId === groupId) ?? active.rooms[0];
  if (roomScope === undefined) return undefined;
  const room = roomModel(
    roomScope,
    acceptedEvents(eventsByScope[active.scope.id] ?? []),
    identityPubkey,
  );
  const rootId =
    active.event.tags.find((tag) => tag[0] === "E")?.[1] ??
    active.event.tags.find((tag) => tag[0] === "e")?.[1] ??
    active.event.id;
  const threadEvents = acceptedEvents(
    eventsByScope[active.scope.id] ?? [],
  ).filter(
    (event) =>
      event.id === rootId ||
      event.id === active.event.id ||
      event.tags.some(
        (tag) => (tag[0] === "e" || tag[0] === "E") && tag[1] === rootId,
      ),
  );
  const members = memberModels(
    roomScope,
    threadEvents,
    active.profiles,
    active.statuses,
  );
  return {
    items: ordered.map(({ event, profiles }) => ({
      id: event.id,
      authorId: event.pubkey,
      context: profiles.get(event.pubkey)?.name ?? shortKey(event.pubkey),
      timestamp: timestamp(event.created_at),
      excerpt: event.content,
      unread: true,
    })),
    activeItemId: active.event.id,
    threadTitle: room.name,
    room,
    messages: threadEvents
      .toSorted(compareOldest)
      .map((event) =>
        eventMessage(
          event,
          threadEvents,
          active.profiles,
          asOf,
          identityPubkey,
        ),
      ),
    members,
    participantCount: new Set(threadEvents.map((event) => event.pubkey)).size,
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
  const name =
    metadata?.tags.find((tag) => tag[0] === "name")?.[1] ?? room.name;
  const description =
    metadata?.tags.find((tag) => tag[0] === "about")?.[1] ?? room.description;
  const memberCount = members?.tags.filter((tag) => tag[0] === "p").length;
  const lastActivity = events
    .filter(
      (event) =>
        [9, 11, 1_111].includes(event.kind) &&
        event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
    )
    .toSorted((left, right) => compareOldest(right, left))[0];
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
  const memberRoles =
    members?.tags
      .find((tag) => tag[0] === "p" && tag[1] === identityPubkey)
      ?.slice(2) ?? [];
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
    name,
    kind: room.kind,
    ...(description === undefined ? {} : { description }),
    ...(memberCount === undefined ? {} : { memberCount }),
    private: privateRoom,
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
  const roles = new Map<string, string>();
  for (const tag of groupMembers?.tags ?? []) {
    if (tag[0] === "p" && tag[1] !== undefined)
      roles.set(tag[1], tag[2] ?? "member");
  }
  for (const tag of groupAdmins?.tags ?? []) {
    if (tag[0] === "p" && tag[1] !== undefined)
      roles.set(tag[1], tag[2] ?? "admin");
  }
  const pubkeys = new Set([
    ...roles.keys(),
    ...events.map((event) => event.pubkey),
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
      ...(roles.get(pubkey) === undefined ? {} : { role: roles.get(pubkey)! }),
    };
  });
}

function messageModels(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  profiles: ReadonlyMap<string, Profile>,
  activeTopicId: string | undefined,
  asOf: number | undefined,
  identityPubkey: string | undefined,
): CommunityMessageModel[] {
  const kinds = room.kind === "channel" ? new Set([9]) : new Set([11, 1_111]);
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
      eventMessage(event, events, profiles, asOf, identityPubkey),
    );
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

function directMessageModels(
  conversation: DirectConversation,
  identityPubkey: string | undefined,
): CommunityMessageModel[] {
  const deleted = new Set(
    conversation.events
      .filter((event) => event.kind === 5)
      .flatMap((event) =>
        event.tags
          .filter((tag) => tag[0] === "e" && tag[1] !== undefined)
          .map((tag) => tag[1]!),
      ),
  );
  const reactions = conversation.events.filter(
    (event) => event.kind === 7 && !deleted.has(event.id),
  );
  return conversation.events
    .filter((event) => event.kind === 14 && !deleted.has(event.id))
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
      const mentionPubkeys = [
        ...new Set(
          event.tags
            .filter(
              (tag) =>
                (tag[0] === "p" || tag[0] === "P") && tag[1] !== undefined,
            )
            .map((tag) => tag[1]!),
        ),
      ];
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
