import { verifyEvent } from "nostr-tools/pure";

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

import type { CommunityRoomScope, CommunityScope } from "./contracts.js";

export interface CommunityProjectionOptions {
  activeRoomId?: string;
  activeTopicId?: string;
  activeThreadId?: string;
  identityPubkey?: string;
  sidePanel?: "thread" | "details" | "none";
}

interface Profile {
  name: string;
}

function eventCopy(event: NostrEvent): NostrEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
    sig: event.sig,
  };
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
): readonly CommunityRoomScope[] {
  if (scope.rooms !== undefined && scope.rooms.length > 0) return scope.rooms;
  if (scope.groupId === undefined || scope.groupId === "") return [];
  return [
    {
      id: scope.groupId,
      groupId: scope.groupId,
      name: scope.groupId,
      kind: "channel",
    },
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
  const rooms = communityRooms(scope);
  const activeRoom =
    rooms.find((room) => room.id === options.activeRoomId) ?? rooms[0];
  const profiles = profilesFrom(events);
  const deleted = deletedEventIds(events);
  const visible = events.filter((event) => !deleted.has(event.id));
  const roomModels = rooms.map((room) => roomModel(room, visible));
  const members = memberModels(activeRoom, visible, profiles);
  const messages =
    activeRoom === undefined
      ? []
      : messageModels(activeRoom, visible, profiles, options.activeTopicId);
  const topics =
    activeRoom?.kind === "forum"
      ? topicModels(activeRoom, visible, profiles)
      : [];
  const thread =
    options.activeThreadId === undefined
      ? undefined
      : {
          rootMessageId: options.activeThreadId,
          messages: messages.filter(
            (message) =>
              message.id === options.activeThreadId ||
              message.parentMessageId === options.activeThreadId,
          ),
        };
  const details =
    activeRoom === undefined
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
    ].filter((section) => section.rooms.length > 0),
    activeRoomId: activeRoom?.id ?? "",
    view:
      activeRoom?.kind === "forum"
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

export function materializeCommunityInbox(
  scopes: readonly CommunityScope[],
  eventsByScope: Readonly<Record<string, readonly NostrEvent[]>>,
  identityPubkey: string | undefined,
): CommunityInboxModel | undefined {
  if (identityPubkey === undefined) return undefined;
  const candidates = scopes.flatMap((scope) => {
    const rooms = communityRooms(scope);
    const events = acceptedEvents(eventsByScope[scope.id] ?? []);
    const profiles = profilesFrom(events);
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
      .map((event) => ({ scope, rooms, profiles, event }));
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
  const members = memberModels(roomScope, threadEvents, active.profiles);
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
      .map((event) => eventMessage(event, threadEvents, active.profiles)),
    members,
    participantCount: new Set(threadEvents.map((event) => event.pubkey)).size,
  };
}

function acceptedEvents(events: readonly NostrEvent[]): NostrEvent[] {
  const accepted = new Map<string, NostrEvent>();
  for (const event of events) {
    const copy = eventCopy(event);
    if (verifyEvent(copy)) accepted.set(copy.id, copy);
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
    const candidate = parsed as { display_name?: unknown; name?: unknown };
    const name =
      typeof candidate.display_name === "string" &&
      candidate.display_name.trim() !== ""
        ? candidate.display_name.trim()
        : typeof candidate.name === "string" && candidate.name.trim() !== ""
          ? candidate.name.trim()
          : "";
    if (name === "") continue;
    const current = selected.get(event.pubkey);
    if (current === undefined || newer(event, current.event)) {
      selected.set(event.pubkey, { event, profile: { name } });
    }
  }
  return new Map(
    [...selected].map(([pubkey, entry]) => [pubkey, entry.profile]),
  );
}

function roomModel(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
): CommunityRoomModel {
  const metadata = latestGroupState(events, 39_000, room.groupId);
  const members = latestGroupState(events, 39_002, room.groupId);
  const name =
    metadata?.tags.find((tag) => tag[0] === "name")?.[1] ?? room.name;
  const description =
    metadata?.tags.find((tag) => tag[0] === "about")?.[1] ?? room.description;
  const memberCount = members?.tags.filter((tag) => tag[0] === "p").length;
  return {
    id: room.id,
    name,
    kind: room.kind,
    ...(description === undefined ? {} : { description }),
    ...(memberCount === undefined ? {} : { memberCount }),
    ...(room.private === undefined ? {} : { private: room.private }),
  };
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
      presence: "offline",
      ...(roles.get(pubkey) === undefined ? {} : { role: roles.get(pubkey)! }),
    };
  });
}

function messageModels(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  profiles: ReadonlyMap<string, Profile>,
  activeTopicId: string | undefined,
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
    .map((event) => eventMessage(event, events, profiles));
}

function eventMessage(
  event: NostrEvent,
  events: readonly NostrEvent[],
  _profiles: ReadonlyMap<string, Profile>,
): CommunityMessageModel {
  const parentMessageId =
    event.tags.find((tag) => tag[0] === "e" && tag[3] === "reply")?.[1] ??
    event.tags.find((tag) => tag[0] === "e")?.[1];
  const replyCount = events.filter((candidate) =>
    candidate.tags.some(
      (tag) => (tag[0] === "e" || tag[0] === "E") && tag[1] === event.id,
    ),
  ).length;
  const reactions = reactionModels(event.id, events);
  return {
    id: event.id,
    authorId: event.pubkey,
    content: event.content,
    timestamp: timestamp(event.created_at),
    createdAt: new Date(event.created_at * 1_000).toISOString(),
    ...(parentMessageId === undefined ? {} : { parentMessageId }),
    ...(replyCount === 0
      ? {}
      : {
          replyCount,
          replyLabel: replyCount === 1 ? "1 reply" : `${replyCount} replies`,
        }),
    ...(reactions.length === 0 ? {} : { reactions }),
  };
}

function reactionModels(
  eventId: string,
  events: readonly NostrEvent[],
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
  const groups = new Map<string, number>();
  for (const event of latest.values()) {
    groups.set(event.content, (groups.get(event.content) ?? 0) + 1);
  }
  return [...groups]
    .map(([emoji, count]) => ({ emoji: emoji === "+" ? "❤" : emoji, count }))
    .toSorted(
      (left, right) =>
        right.count - left.count || left.emoji.localeCompare(right.emoji),
    );
}

function topicModels(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  _profiles: ReadonlyMap<string, Profile>,
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
          ...new Set([event.pubkey, ...replies.map((reply) => reply.pubkey)]),
        ],
        lastActivityLabel: timestamp(
          replies.toSorted((left, right) => compareOldest(right, left))[0]
            ?.created_at ?? event.created_at,
        ),
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
