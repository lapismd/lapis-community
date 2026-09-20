import { buzzHiddenChannels } from "./buzz-direct-messages.js";
import { projectThread } from "./thread-projection.js";
import { isUnreadInConversation } from "./conversations.js";
import type { CommunityReadCursor } from "./contracts.js";
import type { CommunityWorkspaceModel } from "./workspace-model.js";
import type { NostrEvent } from "../protocol/index.js";
import type { CommunityPrivateEvent, CommunityScope } from "./contracts.js";
import {
  acceptedEvents,
  deletedEventIds,
  emptyWorkspace,
  initials,
  latestGroupState,
  profilesFrom,
  shortKey,
  statusesFrom,
} from "./materialize-shared.js";
import { communityRooms } from "./materialize-rooms.js";
import {
  detailsModel,
  memberModels,
  roomModel,
} from "./materialize-room-model.js";
import { messageModels, topicModels } from "./materialize-messages.js";
import {
  directConversationModels,
  directMemberModels,
  directMessageModels,
  directRoomModel,
} from "./materialize-direct.js";

export type { CommunityInboxProjectionOptions } from "./materialize-inbox.js";
export { communityRooms };
export { materializeCommunityInbox } from "./materialize-inbox.js";
export { directConversationId } from "./materialize-direct.js";

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
  const thread = projectThread(conversationMessages, options.activeThreadId);
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
