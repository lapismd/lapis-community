import { buzzHiddenChannels } from "./buzz-direct-messages.js";
import {
  contentMentionPubkeys,
  isUnreadInConversation,
  conversationKey,
} from "./conversations.js";
import type { CommunityConversationReference } from "./conversations.js";
import type { CommunityReadCursor } from "./contracts.js";
import type {
  CommunityInboxFilter,
  CommunityInboxItemModel,
  CommunityInboxModel,
} from "./inbox-model.js";
import type {
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
} from "./workspace-model.js";
import type { NostrEvent } from "../protocol/index.js";
import type { CommunityPrivateEvent, CommunityScope } from "./contracts.js";
import {
  acceptedEvents,
  deletedEventIds,
  latestGroupState,
  profilesFrom,
  statusesFrom,
  timestamp,
} from "./materialize-shared.js";
import { communityRooms } from "./materialize-rooms.js";
import { eventMessage } from "./materialize-messages.js";
import { memberModels, roomModel } from "./materialize-room-model.js";
import { withCommunityMemberKinds } from "./member-identity.js";
import { directConversationModels } from "./materialize-direct.js";
import {
  collectInboxDirectRows,
  type InboxProjectionRow,
} from "./materialize-inbox-direct.js";

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
  agentPubkeys?: readonly string[];
}
export function materializeCommunityInbox(
  scopes: readonly CommunityScope[],
  eventsByScope: Readonly<Record<string, readonly NostrEvent[]>>,
  identityPubkey: string | undefined,
  asOf?: number,
  options: CommunityInboxProjectionOptions = {},
): CommunityInboxModel | undefined {
  if (identityPubkey === undefined) return undefined;
  const rows: InboxProjectionRow[] = [];
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
    rows.push(
      ...collectInboxDirectRows(
        directConversationModels(
          scope.id === directScopeId ? allPrivateEvents : [],
          identityPubkey,
          {},
        ),
        profiles,
        statuses,
        identityPubkey,
        scope.id,
        directCursors,
        options.messageLimit,
      ),
    );
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
          members: withCommunityMemberKinds(
            memberModels(roomScope, selectedEvents, profiles, statuses),
            options.agentPubkeys ?? [],
          ),
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
    members: withCommunityMemberKinds(
      [
        ...new Map(
          unique
            .flatMap((row) => row.members)
            .map((member) => [member.id, member]),
        ).values(),
      ],
      options.agentPubkeys ?? [],
    ),
    participantCount: active.members.length,
  };
}
