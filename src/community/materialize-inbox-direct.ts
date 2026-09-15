import {
  afterReadCursor,
  contentMentionPubkeys,
  conversationKey,
  type CommunityConversationReference,
} from "./conversations.js";
import type { CommunityReadCursor } from "./contracts.js";
import type { CommunityInboxItemModel } from "./inbox-model.js";
import type {
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
} from "./workspace-model.js";
import { timestamp, type Profile } from "./materialize-shared.js";
import {
  type DirectConversation,
  directDeletedIds,
  directMemberModels,
  directMessageModels,
  directRoomModel,
} from "./materialize-direct.js";

export interface InboxProjectionRow {
  item: CommunityInboxItemModel;
  room: CommunityRoomModel;
  messages: () => CommunityMessageModel[];
  members: CommunityMemberModel[];
}

export function collectInboxDirectRows(
  conversations: readonly DirectConversation[],
  profiles: ReadonlyMap<string, Profile>,
  statuses: ReadonlyMap<string, string>,
  identityPubkey: string,
  scopeId: string,
  directCursors: Readonly<Record<string, CommunityReadCursor>>,
  messageLimit: number | undefined,
): InboxProjectionRow[] {
  const rows: InboxProjectionRow[] = [];
  for (const direct of conversations) {
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
        scopeId,
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
          afterReadCursor(event, directCursors[id] ?? directCursors[direct.id]),
        ),
      },
      room,
      messages: () => directMessageModels(direct, identityPubkey, messageLimit),
      members: directMemberModels(direct, profiles, statuses),
    });
  }
  return rows;
}
