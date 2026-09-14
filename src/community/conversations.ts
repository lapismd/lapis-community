import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { decode } from "nostr-tools/nip19";
import type {
  CommunityPrivateEvent,
  CommunityReadCursor,
} from "./contracts.js";

/** Transport is part of identity: a Buzz DM never aliases an encrypted history. */
export type CommunityConversationReference =
  | { transport: "nip17"; participants: readonly string[] }
  | { transport: "buzz-dm"; relayUrl: string; groupId: string }
  | {
      transport: "nip29";
      relayUrl: string;
      groupId: string;
      threadId?: string;
    };

export function conversationKey(
  reference: CommunityConversationReference,
): string {
  return reference.transport === "nip17"
    ? JSON.stringify(["nip17", ...[...new Set(reference.participants)].sort()])
    : JSON.stringify([
        reference.transport,
        reference.relayUrl,
        reference.groupId,
        ...(reference.transport === "nip29" && reference.threadId
          ? [reference.threadId]
          : []),
      ]);
}
export function privateConversation(
  event: CommunityPrivateEvent,
): CommunityConversationReference & { transport: "nip17" } {
  return {
    transport: "nip17",
    participants: [
      ...new Set([
        event.pubkey,
        ...event.tags
          .filter((tag) => tag[0] === "p" && tag[1])
          .map((tag) => tag[1]!),
      ]),
    ].sort(),
  };
}
export function afterReadCursor(
  event: { created_at: number; id: string },
  cursor?: CommunityReadCursor,
): boolean {
  return (
    !cursor ||
    event.created_at > cursor.createdAt ||
    (event.created_at === cursor.createdAt && event.id > cursor.eventId)
  );
}
export function contentMentionPubkeys(content: string): string[] {
  const keys = new Set<string>();
  for (const match of content.matchAll(
    /nostr:((?:npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]+)/gu,
  )) {
    try {
      const entity = decode(match[1]!);
      if (entity.type === "npub") keys.add(entity.data);
      else if (entity.type === "nprofile") keys.add(entity.data.pubkey);
    } catch {
      /* Ordinary malformed text is not a mention. */
    }
  }
  return [...keys];
}

export function directConversationHash(
  participants: readonly string[],
): string {
  return conversationHash({ transport: "nip17", participants });
}

export function conversationHash(
  reference: CommunityConversationReference,
): string {
  return bytesToHex(sha256(utf8ToBytes(conversationKey(reference))));
}

/** Root-list viewing is narrower than an explicit mark-entire-room-read action. */
export function timelineReadKey(
  reference: CommunityConversationReference,
): string {
  return JSON.stringify(["timeline", conversationKey(reference)]);
}

export function isTimelineRoot(event: {
  kind: number;
  tags: string[][];
}): boolean {
  return (
    event.kind === 11 ||
    (event.kind === 9 &&
      !event.tags.some((tag) => tag[0] === "e" || tag[0] === "E"))
  );
}

export function isUnreadInConversation(
  event: {
    id: string;
    created_at: number;
    pubkey: string;
    kind: number;
    tags: string[][];
  },
  reference: CommunityConversationReference,
  roomId: string,
  identityPubkey: string,
  cursors: Readonly<Record<string, CommunityReadCursor>> = {},
): boolean {
  if (
    !identityPubkey ||
    event.pubkey === identityPubkey ||
    ![9, 11, 1111, 14].includes(event.kind)
  )
    return false;
  const rootId =
    event.tags.find(
      (tag) => tag[0] === "E" || (tag[0] === "e" && tag[3] === "root"),
    )?.[1] ??
    event.tags.find((tag) => tag[0] === "e")?.[1] ??
    event.id;
  const roomReference =
    reference.transport === "nip29"
      ? {
          transport: "nip29" as const,
          relayUrl: reference.relayUrl,
          groupId: reference.groupId,
        }
      : reference;
  const threadReference =
    reference.transport === "nip29"
      ? { ...roomReference, threadId: rootId }
      : reference;
  return (
    afterReadCursor(event, cursors[roomId]) &&
    afterReadCursor(event, cursors[conversationKey(roomReference)]) &&
    afterReadCursor(event, cursors[conversationKey(reference)]) &&
    afterReadCursor(event, cursors[conversationKey(threadReference)]) &&
    (!isTimelineRoot(event) ||
      afterReadCursor(event, cursors[timelineReadKey(roomReference)]))
  );
}
